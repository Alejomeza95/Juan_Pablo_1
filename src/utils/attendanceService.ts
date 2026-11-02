import * as XLSX from 'xlsx';
import { 
  collection, 
  doc, 
  getDoc,
  getDocs, 
  setDoc, 
  deleteDoc, 
  writeBatch,
  query,
  where
} from 'firebase/firestore';
import { db, auth, ADMIN_EMAIL } from '../firebase';
import { 
  StudentRecord, 
  AttendanceSessionRecord, 
  AttendanceStatus,
  StudentAttendanceEntry,
  AusentismoConfig,
  StudentStatsSummary,
  ExcelParsedStudent,
  ExcelImportSummary
} from '../types';
import { isPermissionError } from './academicConfigService';

const ATTENDANCE_STORAGE_KEYS = {
  students: 'jp1_students_cache',
  sessions: 'jp1_attendance_sessions_cache',
  ausentismoConfig: 'jp1_ausentismo_config'
};

export const DEFAULT_AUSENTISMO_CONFIG: AusentismoConfig = {
  umbralVerde: 10,     // Menor al 10%
  umbralAmarillo: 20,  // 10% a menos del 20%
  umbralRojo: 20,      // 20% o superior
  updatedAt: Date.now()
};

/**
 * ========================================================
 * 1. IMPORTACIÓN Y PARSEO DE ARCHIVOS EXCEL (.xlsx / .xls)
 * ========================================================
 * - Lectura a partir de la fila 8 (filas 1 a 7 son encabezados/metadatos)
 * - Columna A: Código del estudiante (A8...)
 * - Columna B: Apellidos (B8...)
 * - Columna C: Nombres (C8...)
 * - Preservación de ceros a la izquierda y advertencias si Excel los truncó
 */
export async function parseStudentsExcelFile(
  file: File,
  existingCourseStudents: StudentRecord[] = []
): Promise<{
  rows: ExcelParsedStudent[];
  summary: ExcelImportSummary;
}> {
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: 'array', cellDates: true });
  
  if (!workbook.SheetNames || workbook.SheetNames.length === 0) {
    throw new Error('El archivo Excel no contiene hojas de cálculo válidas.');
  }

  const sheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[sheetName];

  // Convert to array of rows (row index 0 is Excel row 1)
  const rawRows: any[][] = XLSX.utils.sheet_to_json(worksheet, { 
    header: 1, 
    defval: '',
    raw: false // raw: false ensures strings are formatted as seen when possible
  });

  const parsedStudents: ExcelParsedStudent[] = [];
  const seenCodesInFile = new Set<string>();
  const existingCodesSet = new Set(existingCourseStudents.map(s => s.codigo.trim().toLowerCase()));

  let totalRowsAnalyzed = 0;
  let importedCount = 0;
  let updatedCount = 0;
  let duplicateInFileCount = 0;
  let existingCount = 0;
  let errorCount = 0;
  const errors: string[] = [];

  // Requisito estricto: Empezar en la fila 8 (índice 7 en array basado en 0)
  const START_ROW_INDEX = 7; // Fila 8 de Excel

  for (let r = START_ROW_INDEX; r < rawRows.length; r++) {
    const row = rawRows[r] || [];
    const excelRowNumber = r + 1; // 1-indexed for user visibility (e.g. Fila 8, Fila 9...)

    const rawColA = row[0] !== undefined && row[0] !== null ? String(row[0]).trim() : '';
    const rawColB = row[1] !== undefined && row[1] !== null ? String(row[1]).trim() : '';
    const rawColC = row[2] !== undefined && row[2] !== null ? String(row[2]).trim() : '';

    // Ignorar filas totalmente vacías
    if (!rawColA && !rawColB && !rawColC) {
      continue;
    }

    totalRowsAnalyzed++;

    // Validaciones de fila
    let isValid = true;
    let rowError: string | undefined;
    let hasLeadingZeroWarning = false;

    // Validación Columna A (Código)
    if (!rawColA) {
      isValid = false;
      rowError = `Fila ${excelRowNumber}: El código del estudiante está vacío.`;
    }

    // Advertencia de posibles ceros a la izquierda eliminados por Excel
    // Por ejemplo si el código es numérico puro y tiene longitud sospechosa corta
    if (isValid && /^\d+$/.test(rawColA) && rawColA.length <= 4) {
      hasLeadingZeroWarning = true;
    }

    // Validación Columna B (Apellidos)
    if (isValid && !rawColB) {
      isValid = false;
      rowError = `Fila ${excelRowNumber}: Faltan los apellidos del estudiante.`;
    }

    // Validación Columna C (Nombres)
    if (isValid && !rawColC) {
      isValid = false;
      rowError = `Fila ${excelRowNumber}: Faltan los nombres del estudiante.`;
    }

    const normalizedCode = rawColA.toLowerCase();

    // Detección de duplicado dentro del mismo archivo
    if (isValid && seenCodesInFile.has(normalizedCode)) {
      isValid = false;
      rowError = `Fila ${excelRowNumber}: El código "${rawColA}" está duplicado dentro de este archivo.`;
      duplicateInFileCount++;
    } else if (isValid) {
      seenCodesInFile.add(normalizedCode);
    }

    const isAlreadyExisting = isValid && existingCodesSet.has(normalizedCode);
    if (isAlreadyExisting) {
      existingCount++;
    }

    if (!isValid) {
      errorCount++;
      if (rowError) errors.push(rowError);
    } else if (isAlreadyExisting) {
      updatedCount++;
    } else {
      importedCount++;
    }

    parsedStudents.push({
      rowNumber: excelRowNumber,
      codigo: rawColA,
      apellidos: rawColB,
      nombres: rawColC,
      nombreCompleto: `${rawColB} ${rawColC}`.trim(),
      hasLeadingZeroWarning,
      isValid,
      error: rowError
    });
  }

  const summary: ExcelImportSummary = {
    totalRowsAnalyzed,
    importedCount,
    updatedCount,
    duplicateInFileCount,
    existingCount,
    errorCount,
    errors
  };

  return { rows: parsedStudents, summary };
}

/**
 * ========================================================
 * 2. PERSISTENCIA DE ESTUDIANTES (DUAL: FIRESTORE + LOCAL)
 * ========================================================
 */

export function getLocalStudents(): StudentRecord[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(ATTENDANCE_STORAGE_KEYS.students);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function saveLocalStudents(students: StudentRecord[]) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(ATTENDANCE_STORAGE_KEYS.students, JSON.stringify(students));
  } catch (e) {
    console.warn("Error saving students to localStorage:", e);
  }
}

export function notifyStudentsUpdated() {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('jp1_students_updated'));
  }
}

export function normalizeCourseCode(val: string | undefined | null): string {
  if (!val) return '';
  return String(val).toLowerCase().replace(/[\s°\-_.]/g, '').trim();
}

/**
 * Obtener todos los estudiantes cacheados localmente
 */
export function getAllCachedStudents(): StudentRecord[] {
  return getLocalStudents();
}

/**
 * Obtener estudiantes por curso y año escolar (primero Firestore, respaldo local)
 */
export async function getStudentsByCourse(year: number, courseId: string): Promise<StudentRecord[]> {
  const numYear = Number(year);
  const targetNorm = normalizeCourseCode(courseId);
  const allLocal = getLocalStudents();
  
  // 1. Filtrado local robusto (soporta comparación flexible de año y curso)
  let localList = allLocal.filter(s => {
    const matchesYear = !numYear || !s.year || Number(s.year) === numYear;
    const matchesCourse = 
      s.cursoId === courseId || 
      s.cursoId?.toLowerCase() === courseId?.toLowerCase() ||
      normalizeCourseCode(s.cursoId) === targetNorm;
    return matchesYear && matchesCourse;
  });

  // Si no encontró con el año estricto, buscar por cursoId directo
  if (localList.length === 0) {
    localList = allLocal.filter(s => 
      s.cursoId === courseId || 
      s.cursoId?.toLowerCase() === courseId?.toLowerCase() ||
      normalizeCourseCode(s.cursoId) === targetNorm
    );
  }

  // 2. Consulta a Firestore por curso y sincronización global si es necesario
  try {
    const q = query(
      collection(db, 'estudiantes'),
      where('cursoId', '==', courseId)
    );
    let snap = await getDocs(q);
    
    // Si la consulta exacta está vacía o si el caché local tiene 0 estudiantes, sincronizar colección general
    if (snap.empty || localList.length === 0) {
      try {
        const allSnap = await getDocs(collection(db, 'estudiantes'));
        if (!allSnap.empty) {
          const allRemoteMap = new Map<string, StudentRecord>();
          // Agregar existentes en local primero
          getLocalStudents().forEach(s => allRemoteMap.set(s.id, s));
          // Sobrescribir con lo que viene de Firestore
          allSnap.forEach(d => {
            const item = d.data() as StudentRecord;
            if (item && item.id) {
              allRemoteMap.set(item.id, item);
            }
          });

          const merged = Array.from(allRemoteMap.values());
          saveLocalStudents(merged);

          // Re-filtrar sobre la lista consolidada
          const matched = merged.filter(s => {
            const matchesYear = !numYear || !s.year || Number(s.year) === numYear;
            const matchesCourse = 
              s.cursoId === courseId || 
              s.cursoId?.toLowerCase() === courseId?.toLowerCase() ||
              normalizeCourseCode(s.cursoId) === targetNorm;
            return matchesYear && matchesCourse;
          });

          if (matched.length > 0) {
            return matched.sort((a, b) => a.apellidos.localeCompare(b.apellidos, 'es', { sensitivity: 'base' }));
          }

          // Fallback por curso sin año
          const matchedLoose = merged.filter(s => 
            s.cursoId === courseId || 
            s.cursoId?.toLowerCase() === courseId?.toLowerCase() ||
            normalizeCourseCode(s.cursoId) === targetNorm
          );
          if (matchedLoose.length > 0) {
            return matchedLoose.sort((a, b) => a.apellidos.localeCompare(b.apellidos, 'es', { sensitivity: 'base' }));
          }
        }
      } catch (errSync) {
        console.warn("Notice syncing full students collection:", errSync);
      }
    } else {
      const remoteList: StudentRecord[] = [];
      snap.forEach(d => {
        const item = d.data() as StudentRecord;
        if (!numYear || Number(item.year) === numYear || !item.year) {
          remoteList.push(item);
        }
      });

      if (remoteList.length > 0) {
        // Merge and update local storage
        const allOther = getLocalStudents().filter(s => 
          s.cursoId !== courseId && normalizeCourseCode(s.cursoId) !== targetNorm
        );
        const combined = [...allOther, ...remoteList];
        saveLocalStudents(combined);

        return remoteList.sort((a, b) => a.apellidos.localeCompare(b.apellidos, 'es', { sensitivity: 'base' }));
      }
    }
  } catch (error) {
    if (!isPermissionError(error)) {
      console.warn("Firestore getStudentsByCourse notice:", error);
    }
  }

  return localList.sort((a, b) => a.apellidos.localeCompare(b.apellidos, 'es', { sensitivity: 'base' }));
}

/**
 * Guardar estudiantes masivamente (por lotes de hasta 450 para Firestore)
 */
export async function saveStudentsBatch(
  studentsToSave: Array<{
    codigo: string;
    nombres: string;
    apellidos: string;
    cursoId: string;
    anioEscolarId: string;
    year: number;
    activo?: boolean;
  }>,
  options: { updateExisting: boolean } = { updateExisting: true }
): Promise<{ savedCount: number; updatedCount: number }> {
  const now = Date.now();
  const allCurrent = getLocalStudents();
  let savedCount = 0;
  let updatedCount = 0;

  const updatedRecords: StudentRecord[] = [];

  studentsToSave.forEach(s => {
    const studentId = `${s.year}_${s.cursoId}_${s.codigo.trim()}`;
    const existingIndex = allCurrent.findIndex(item => item.id === studentId);

    if (existingIndex >= 0) {
      if (options.updateExisting) {
        const existing = allCurrent[existingIndex];
        const record: StudentRecord = {
          ...existing,
          nombres: s.nombres.trim(),
          apellidos: s.apellidos.trim(),
          nombreCompleto: `${s.apellidos.trim()} ${s.nombres.trim()}`,
          updatedAt: now
        };
        allCurrent[existingIndex] = record;
        updatedRecords.push(record);
        updatedCount++;
      }
    } else {
      const record: StudentRecord = {
        id: studentId,
        codigo: s.codigo.trim(),
        nombres: s.nombres.trim(),
        apellidos: s.apellidos.trim(),
        nombreCompleto: `${s.apellidos.trim()} ${s.nombres.trim()}`,
        cursoId: s.cursoId,
        anioEscolarId: s.anioEscolarId,
        year: s.year,
        activo: s.activo !== undefined ? s.activo : true,
        createdAt: now,
        updatedAt: now
      };
      allCurrent.push(record);
      updatedRecords.push(record);
      savedCount++;
    }
  });

  // Guardado local inmediato
  saveLocalStudents(allCurrent);
  notifyStudentsUpdated();

  // Guardado en Firestore en lotes seguros (<= 450 operaciones por batch)
  if (updatedRecords.length > 0) {
    try {
      const BATCH_SIZE = 400;
      for (let i = 0; i < updatedRecords.length; i += BATCH_SIZE) {
        const chunk = updatedRecords.slice(i, i + BATCH_SIZE);
        const batch = writeBatch(db);

        chunk.forEach(record => {
          const docRef = doc(db, 'estudiantes', record.id);
          batch.set(docRef, record, { merge: true });
        });

        await batch.commit();
      }
    } catch (error) {
      if (isPermissionError(error)) {
        console.warn("Firestore batch permissions notice. Guardado en caché local activo.");
      } else {
        console.warn("Firestore batch write error:", error);
      }
    }
  }

  return { savedCount, updatedCount };
}

/**
 * Actualizar estudiante individual
 */
export async function updateStudentRecord(student: StudentRecord): Promise<void> {
  const now = Date.now();
  const updated: StudentRecord = {
    ...student,
    nombreCompleto: `${student.apellidos.trim()} ${student.nombres.trim()}`,
    updatedAt: now
  };

  const all = getLocalStudents();
  const idx = all.findIndex(s => s.id === student.id);
  if (idx >= 0) {
    all[idx] = updated;
  } else {
    all.push(updated);
  }
  saveLocalStudents(all);
  notifyStudentsUpdated();

  try {
    const docRef = doc(db, 'estudiantes', updated.id);
    await setDoc(docRef, updated, { merge: true });
  } catch (e) {
    console.warn("Firestore update student notice:", e);
  }
}

/**
 * Cambiar estado activo / inactivo de un estudiante (no elimina su historial de asistencia)
 */
export async function toggleStudentActiveStatus(studentId: string, activo: boolean): Promise<void> {
  const all = getLocalStudents();
  const student = all.find(s => s.id === studentId);
  if (!student) return;

  student.activo = activo;
  student.updatedAt = Date.now();
  saveLocalStudents(all);
  notifyStudentsUpdated();

  try {
    const docRef = doc(db, 'estudiantes', studentId);
    await setDoc(docRef, { activo, updatedAt: Date.now() }, { merge: true });
  } catch (e) {
    console.warn("Firestore toggle student status notice:", e);
  }
}

/**
 * Eliminar estudiante permanentemente
 */
export async function deleteStudentRecord(studentId: string): Promise<void> {
  const all = getLocalStudents().filter(s => s.id !== studentId);
  saveLocalStudents(all);
  notifyStudentsUpdated();

  try {
    const docRef = doc(db, 'estudiantes', studentId);
    await deleteDoc(docRef);
  } catch (e) {
    console.warn("Firestore delete student notice:", e);
  }
}

/**
 * ========================================================
 * 3. GESTIÓN Y PERSISTENCIA DE SESIONES DE ASISTENCIA
 * ========================================================
 */

export function getLocalAttendanceSessions(): AttendanceSessionRecord[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(ATTENDANCE_STORAGE_KEYS.sessions);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function saveLocalAttendanceSessions(sessions: AttendanceSessionRecord[]) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(ATTENDANCE_STORAGE_KEYS.sessions, JSON.stringify(sessions));
  } catch (e) {
    console.warn("Error saving attendance sessions to localStorage:", e);
  }
}

/**
 * Crea un identificador canónico de sesión para evitar duplicados en la misma fecha y asignatura
 */
export function buildAttendanceSessionId(
  year: number,
  cursoId: string,
  asignaturaId: string,
  docenteId: string,
  fecha: string
): string {
  const safeAsignatura = (asignaturaId || 'general').replace(/[^a-zA-Z0-9]/g, '_');
  const safeDocente = (docenteId || 'general').replace(/[^a-zA-Z0-9]/g, '_');
  return `session_${year}_${cursoId}_${safeAsignatura}_${safeDocente}_${fecha}`;
}

export interface SaveAttendanceResult {
  session: AttendanceSessionRecord;
  savedInFirestore: boolean;
  firestoreError?: string;
}

/**
 * Guardar o actualizar sesión de asistencia en Firestore y LocalStorage
 */
export async function saveAttendanceSession(
  sessionData: {
    year: number;
    anioEscolarId: string;
    cursoId: string;
    cursoNombre?: string;
    docenteId: string;
    docenteNombre?: string;
    asignaturaId: string;
    asignaturaNombre?: string;
    fecha: string;
    registros: Record<string, AttendanceStatus>;
    studentsList: StudentRecord[];
  }
): Promise<SaveAttendanceResult> {
  const now = Date.now();
  const sessionId = buildAttendanceSessionId(
    sessionData.year,
    sessionData.cursoId,
    sessionData.asignaturaId,
    sessionData.docenteId,
    sessionData.fecha
  );

  let asistieron = 0;
  let noAsistieron = 0;

  const registrosDetalle: StudentAttendanceEntry[] = sessionData.studentsList.map(st => {
    const estado = sessionData.registros[st.id] || 'asistio';
    if (estado === 'asistio') asistieron++;
    else noAsistieron++;

    return {
      estudianteId: st.id,
      codigo: st.codigo,
      apellidos: st.apellidos,
      nombres: st.nombres,
      nombreCompleto: st.nombreCompleto,
      estado
    };
  });

  const totalEstudiantes = registrosDetalle.length;
  const porcentajeAsistencia = totalEstudiantes > 0 ? Math.round((asistieron / totalEstudiantes) * 100) : 100;
  const porcentajeAusentismo = totalEstudiantes > 0 ? Math.round((noAsistieron / totalEstudiantes) * 100) : 0;

  const allSessions = getLocalAttendanceSessions();
  const existingIndex = allSessions.findIndex(s => s.id === sessionId);

  const sessionRecord: AttendanceSessionRecord = {
    id: sessionId,
    anioEscolarId: sessionData.anioEscolarId,
    year: sessionData.year,
    cursoId: sessionData.cursoId,
    cursoNombre: sessionData.cursoNombre || sessionData.cursoId,
    docenteId: sessionData.docenteId,
    docenteNombre: sessionData.docenteNombre || 'Docente Institucional',
    asignaturaId: sessionData.asignaturaId,
    asignaturaNombre: sessionData.asignaturaNombre || sessionData.asignaturaId,
    fecha: sessionData.fecha,
    totalEstudiantes,
    asistieron,
    noAsistieron,
    porcentajeAsistencia,
    porcentajeAusentismo,
    registros: sessionData.registros || {},
    registrosDetalle,
    createdBy: existingIndex >= 0 ? allSessions[existingIndex].createdBy : (auth.currentUser?.email || 'admin'),
    createdAt: existingIndex >= 0 ? allSessions[existingIndex].createdAt : now,
    updatedAt: now,
    updatedBy: auth.currentUser?.email || 'admin'
  };

  if (existingIndex >= 0) {
    allSessions[existingIndex] = sessionRecord;
  } else {
    allSessions.push(sessionRecord);
  }

  saveLocalAttendanceSessions(allSessions);

  // Firestore sync: Always persist directly to Cloud Firestore collection 'sesionesAsistencia'
  let savedInFirestore = false;
  let firestoreError: string | undefined;

  try {
    const docRef = doc(db, 'sesionesAsistencia', sessionId);
    const sanitizedRecord = cleanForFirestore(sessionRecord);
    await setDoc(docRef, sanitizedRecord, { merge: true });
    savedInFirestore = true;
    console.log(`[Firestore] Sesión de asistencia guardada exitosamente en 'sesionesAsistencia/${sessionId}'`);
  } catch (e: any) {
    firestoreError = e?.message || String(e);
    console.error(`[Firestore Error] No se pudo escribir en 'sesionesAsistencia/${sessionId}':`, e);
    if (isPermissionError(e)) {
      console.warn("Firestore attendance save permissions notice. Recuerda aplicar las reglas en Firebase Console.", e);
    }
  }

  return { session: sessionRecord, savedInFirestore, firestoreError };
}

/**
 * Sanitiza recursivamente cualquier objeto para Firestore evitando valores undefined
 */
function cleanForFirestore(data: any): any {
  if (data === undefined) return null;
  if (data === null || typeof data !== 'object') return data;
  if (Array.isArray(data)) return data.map(cleanForFirestore);
  const cleaned: Record<string, any> = {};
  for (const [key, value] of Object.entries(data)) {
    if (value !== undefined) {
      cleaned[key] = cleanForFirestore(value);
    }
  }
  return cleaned;
}

/**
 * Cargar una sesión previa existente para consultar o editar
 */
export async function getExistingAttendanceSession(
  year: number,
  cursoId: string,
  asignaturaId: string,
  docenteId: string,
  fecha: string
): Promise<AttendanceSessionRecord | null> {
  const sessionId = buildAttendanceSessionId(year, cursoId, asignaturaId, docenteId, fecha);
  const local = getLocalAttendanceSessions().find(s => s.id === sessionId);

  try {
    const docRef = doc(db, 'sesionesAsistencia', sessionId);
    const snap = await getDoc(docRef);
    if (snap.exists()) {
      return snap.data() as AttendanceSessionRecord;
    }
  } catch (e) {
    // fallback to local
  }

  return local || null;
}

/**
 * Obtener listado de sesiones filtradas para el dashboard
 */
export async function getAttendanceSessionsByFilter(filters: {
  year: number;
  cursoId?: string;
  asignaturaId?: string;
  docenteId?: string;
  startDate?: string;
  endDate?: string;
}): Promise<AttendanceSessionRecord[]> {
  let list = getLocalAttendanceSessions().filter(s => s.year === filters.year);

  try {
    const q = query(
      collection(db, 'sesionesAsistencia'),
      where('year', '==', filters.year)
    );
    const snap = await getDocs(q);
    if (!snap.empty) {
      const remoteList: AttendanceSessionRecord[] = [];
      snap.forEach(d => remoteList.push(d.data() as AttendanceSessionRecord));
      
      // Update local storage
      const otherSessions = getLocalAttendanceSessions().filter(s => s.year !== filters.year);
      saveLocalAttendanceSessions([...otherSessions, ...remoteList]);
      list = remoteList;
    }
  } catch (e) {
    // fallback to local list
  }

  // Filtrado en memoria
  if (filters.cursoId && filters.cursoId !== 'all') {
    list = list.filter(s => s.cursoId === filters.cursoId);
  }
  if (filters.asignaturaId && filters.asignaturaId !== 'all') {
    list = list.filter(s => s.asignaturaId === filters.asignaturaId || s.asignaturaNombre === filters.asignaturaId);
  }
  if (filters.docenteId && filters.docenteId !== 'all') {
    list = list.filter(s => s.docenteId === filters.docenteId);
  }
  if (filters.startDate) {
    list = list.filter(s => s.fecha >= filters.startDate!);
  }
  if (filters.endDate) {
    list = list.filter(s => s.fecha <= filters.endDate!);
  }

  return list.sort((a, b) => b.fecha.localeCompare(a.fecha));
}

/**
 * ========================================================
 * 4. CONFIGURACIÓN DE UMBRALES DE AUSENTISMO
 * ========================================================
 */
export function getStoredAusentismoConfig(): AusentismoConfig {
  if (typeof window !== 'undefined') {
    try {
      const raw = localStorage.getItem(ATTENDANCE_STORAGE_KEYS.ausentismoConfig);
      if (raw) return JSON.parse(raw);
    } catch {}
  }
  return DEFAULT_AUSENTISMO_CONFIG;
}

export async function saveStoredAusentismoConfig(cfg: AusentismoConfig): Promise<void> {
  const updated: AusentismoConfig = {
    ...cfg,
    updatedAt: Date.now()
  };

  if (typeof window !== 'undefined') {
    try {
      localStorage.setItem(ATTENDANCE_STORAGE_KEYS.ausentismoConfig, JSON.stringify(updated));
    } catch {}
  }

  if (auth.currentUser && auth.currentUser.email === ADMIN_EMAIL) {
    try {
      const docRef = doc(db, 'configuracionAusentismo', 'general');
      await setDoc(docRef, updated, { merge: true });
    } catch (e) {
      console.warn("Firestore save ausentismo config notice:", e);
    }
  }
}

/**
 * ========================================================
 * 5. CÁLCULO DE MÉTRICAS ESTADÍSTICAS Y AUSENTISMO
 * ========================================================
 */
export function calculateAttendanceMetrics(
  students: StudentRecord[],
  sessions: AttendanceSessionRecord[],
  config: AusentismoConfig = DEFAULT_AUSENTISMO_CONFIG
) {
  const activeStudents = students.filter(s => s.activo);
  const totalStudentsCount = activeStudents.length;
  const sessionsCount = sessions.length;

  // Total de registros esperados (solo cuenta estudiantes incluidos en las sesiones registradas)
  let totalEsperados = 0;
  let totalAsistencias = 0;
  let totalInasistencias = 0;

  // Mapa de estudiante -> acumuladores
  const studentMetricsMap = new Map<string, {
    sesiones: number;
    asistencias: number;
    inasistencias: number;
  }>();

  activeStudents.forEach(st => {
    studentMetricsMap.set(st.id, { sesiones: 0, asistencias: 0, inasistencias: 0 });
  });

  sessions.forEach(sess => {
    sess.registrosDetalle.forEach(reg => {
      totalEsperados++;
      if (reg.estado === 'asistio') {
        totalAsistencias++;
      } else {
        totalInasistencias++;
      }

      const stMetrics = studentMetricsMap.get(reg.estudianteId);
      if (stMetrics) {
        stMetrics.sesiones++;
        if (reg.estado === 'asistio') {
          stMetrics.asistencias++;
        } else {
          stMetrics.inasistencias++;
        }
      }
    });
  });

  const porcentajeAsistencia = totalEsperados > 0 ? Number(((totalAsistencias / totalEsperados) * 100).toFixed(1)) : 100;
  const porcentajeAusentismo = totalEsperados > 0 ? Number(((totalInasistencias / totalEsperados) * 100).toFixed(1)) : 0;

  // Resumen individual por estudiante
  const studentSummaries: StudentStatsSummary[] = activeStudents.map(st => {
    const data = studentMetricsMap.get(st.id) || { sesiones: 0, asistencias: 0, inasistencias: 0 };
    const pctAus = data.sesiones > 0 ? Number(((data.inasistencias / data.sesiones) * 100).toFixed(1)) : 0;
    const pctAsis = data.sesiones > 0 ? Number(((data.asistencias / data.sesiones) * 100).toFixed(1)) : 100;

    let alertaNivel: 'verde' | 'amarillo' | 'rojo' = 'verde';
    if (pctAus >= config.umbralRojo) {
      alertaNivel = 'rojo';
    } else if (pctAus >= config.umbralVerde) {
      alertaNivel = 'amarillo';
    }

    return {
      student: st,
      sesionesRegistradas: data.sesiones,
      asistencias: data.asistencias,
      inasistencias: data.inasistencias,
      porcentajeAusentismo: pctAus,
      porcentajeAsistencia: pctAsis,
      alertaNivel
    };
  }).sort((a, b) => b.inasistencias - a.inasistencias || a.student.apellidos.localeCompare(b.student.apellidos));

  // Ausentismo por fecha (cronológico para gráfica de evolución)
  const byDateMap = new Map<string, { fecha: string; asistieron: number; noAsistieron: number; total: number }>();
  sessions.forEach(sess => {
    const existing = byDateMap.get(sess.fecha) || { fecha: sess.fecha, asistieron: 0, noAsistieron: 0, total: 0 };
    existing.asistieron += sess.asistieron;
    existing.noAsistieron += sess.noAsistieron;
    existing.total += sess.totalEstudiantes;
    byDateMap.set(sess.fecha, existing);
  });

  const evolutionData = Array.from(byDateMap.values())
    .sort((a, b) => a.fecha.localeCompare(b.fecha))
    .map(item => ({
      fecha: item.fecha,
      porcentajeAusentismo: item.total > 0 ? Number(((item.noAsistieron / item.total) * 100).toFixed(1)) : 0,
      porcentajeAsistencia: item.total > 0 ? Number(((item.asistieron / item.total) * 100).toFixed(1)) : 100,
      asistieron: item.asistieron,
      noAsistieron: item.noAsistieron,
      total: item.total
    }));

  // Ausentismo por asignatura
  const bySubjectMap = new Map<string, { asignatura: string; asistieron: number; noAsistieron: number; total: number }>();
  sessions.forEach(sess => {
    const subName = sess.asignaturaNombre || sess.asignaturaId || 'General';
    const existing = bySubjectMap.get(subName) || { asignatura: subName, asistieron: 0, noAsistieron: 0, total: 0 };
    existing.asistieron += sess.asistieron;
    existing.noAsistieron += sess.noAsistieron;
    existing.total += sess.totalEstudiantes;
    bySubjectMap.set(subName, existing);
  });

  const subjectData = Array.from(bySubjectMap.values()).map(item => ({
    asignatura: item.asignatura,
    porcentajeAusentismo: item.total > 0 ? Number(((item.noAsistieron / item.total) * 100).toFixed(1)) : 0,
    totalInasistencias: item.noAsistieron,
    totalSesiones: item.total
  })).sort((a, b) => b.porcentajeAusentismo - a.porcentajeAusentismo);

  // Top estudiantes con mayor número de inasistencias
  const topAbsentStudents = studentSummaries
    .filter(s => s.inasistencias > 0)
    .slice(0, 8)
    .map(s => ({
      nombre: s.student.nombreCompleto,
      codigo: s.student.codigo,
      inasistencias: s.inasistencias,
      porcentajeAusentismo: s.porcentajeAusentismo
    }));

  return {
    totalStudentsCount,
    sessionsCount,
    totalEsperados,
    totalAsistencias,
    totalInasistencias,
    porcentajeAsistencia,
    porcentajeAusentismo,
    studentSummaries,
    evolutionData,
    subjectData,
    topAbsentStudents
  };
}
