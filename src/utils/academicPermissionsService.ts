import { 
  collection, 
  doc, 
  getDocs, 
  getDoc, 
  setDoc, 
  deleteDoc, 
  query, 
  where 
} from 'firebase/firestore';
import { db, auth } from '../firebase';
import { AcademicPermissionRecord } from '../types';

export const PERMISSIONS_STORAGE_KEY = 'juan_pablo_academic_permissions_cache';

export function getLocalPermissions(): AcademicPermissionRecord[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(PERMISSIONS_STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function saveLocalPermissions(permissions: AcademicPermissionRecord[]) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(PERMISSIONS_STORAGE_KEY, JSON.stringify(permissions));
  } catch (e) {
    console.warn("Error guardando permisos en localStorage:", e);
  }
}

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
 * Guarda o actualiza un Permiso Académico en LocalStorage y Firestore
 */
export async function saveAcademicPermission(
  data: Omit<AcademicPermissionRecord, 'id' | 'createdAt' | 'updatedAt'> & { id?: string }
): Promise<{ permission: AcademicPermissionRecord; savedInFirestore: boolean; firestoreError?: string }> {
  const now = Date.now();
  const permId = data.id || `permiso_${data.year}_${data.cursoId}_${data.studentId}_${data.fecha}_${now}`;

  const record: AcademicPermissionRecord = {
    ...data,
    id: permId,
    createdAt: data.id ? (getLocalPermissions().find(p => p.id === data.id)?.createdAt || now) : now,
    updatedAt: now
  };

  const all = getLocalPermissions();
  const existingIdx = all.findIndex(p => p.id === permId);
  if (existingIdx >= 0) {
    all[existingIdx] = record;
  } else {
    all.unshift(record);
  }
  saveLocalPermissions(all);

  let savedInFirestore = false;
  let firestoreError: string | undefined;

  try {
    const docRef = doc(db, 'permisosAcademicos', permId);
    const sanitized = cleanForFirestore(record);
    await setDoc(docRef, sanitized, { merge: true });
    savedInFirestore = true;
    console.log(`[Firestore] Permiso académico guardado con éxito: ${permId}`);
  } catch (err: any) {
    firestoreError = err?.message || String(err);
    console.error(`[Firestore Error] Fallo al guardar permiso ${permId}:`, err);
  }

  // Notificar al sistema
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('academic-permission-saved', { detail: record }));
  }

  return { permission: record, savedInFirestore, firestoreError };
}

/**
 * Elimina un Permiso Académico
 */
export async function deleteAcademicPermission(permissionId: string): Promise<void> {
  const all = getLocalPermissions().filter(p => p.id !== permissionId);
  saveLocalPermissions(all);

  try {
    const docRef = doc(db, 'permisosAcademicos', permissionId);
    await deleteDoc(docRef);
    console.log(`[Firestore] Permiso eliminado: ${permissionId}`);
  } catch (err) {
    console.warn(`[Firestore] Fallo al eliminar permiso ${permissionId}:`, err);
  }

  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('academic-permission-deleted', { detail: { id: permissionId } }));
  }
}

/**
 * Obtiene permisos por curso y año escolar (Firestore con respaldo local)
 */
export async function getPermissionsByCourse(year: number, courseId: string): Promise<AcademicPermissionRecord[]> {
  const localList = getLocalPermissions().filter(p => p.year === year && p.cursoId === courseId);

  try {
    const q = query(
      collection(db, 'permisosAcademicos'),
      where('year', '==', year),
      where('cursoId', '==', courseId)
    );
    const snap = await getDocs(q);
    if (!snap.empty) {
      const remoteList: AcademicPermissionRecord[] = [];
      snap.forEach(d => remoteList.push(d.data() as AcademicPermissionRecord));

      // Sincronizar cache local
      const otherLocal = getLocalPermissions().filter(p => !(p.year === year && p.cursoId === courseId));
      saveLocalPermissions([...otherLocal, ...remoteList]);

      return remoteList.sort((a, b) => b.createdAt - a.createdAt);
    }
  } catch (err) {
    console.warn("Firestore getPermissionsByCourse notice:", err);
  }

  return localList.sort((a, b) => b.createdAt - a.createdAt);
}

export function getGradeSortWeight(gradeStr?: string): number {
  if (!gradeStr) return 9999;
  const numMatch = gradeStr.match(/\d+/);
  const gradeNum = numMatch ? parseInt(numMatch[0], 10) : 50;
  const letterMatch = gradeStr.toUpperCase().match(/[A-Z]/);
  const letterVal = letterMatch ? letterMatch[0].charCodeAt(0) : 65;
  return gradeNum * 1000 + letterVal;
}

/**
 * Obtiene todos los permisos de una fecha específica a nivel institucional (global)
 * Ordenados y discriminados por grado (6° a 11°) y luego alfabéticamente por estudiante
 */
export async function getPermissionsByDate(year: number, date: string): Promise<AcademicPermissionRecord[]> {
  const numYear = Number(year);
  const sortComparator = (a: AcademicPermissionRecord, b: AcademicPermissionRecord) => {
    const gradeA = getGradeSortWeight(a.cursoNombre || a.cursoId);
    const gradeB = getGradeSortWeight(b.cursoNombre || b.cursoId);
    if (gradeA !== gradeB) return gradeA - gradeB;
    return a.nombreCompleto.localeCompare(b.nombreCompleto, 'es', { sensitivity: 'base' });
  };

  const localList = getLocalPermissions().filter(p => 
    p.fecha === date && (!numYear || !p.year || Number(p.year) === numYear)
  );

  try {
    const q = query(
      collection(db, 'permisosAcademicos'),
      where('fecha', '==', date)
    );
    const snap = await getDocs(q);
    if (!snap.empty) {
      const remoteList: AcademicPermissionRecord[] = [];
      snap.forEach(d => {
        const item = d.data() as AcademicPermissionRecord;
        if (!numYear || !item.year || Number(item.year) === numYear) {
          remoteList.push(item);
        }
      });

      if (remoteList.length > 0) {
        const otherLocal = getLocalPermissions().filter(p => p.fecha !== date);
        saveLocalPermissions([...otherLocal, ...remoteList]);
        return remoteList.sort(sortComparator);
      }
    }
  } catch (err) {
    console.warn("Firestore getPermissionsByDate notice:", err);
  }

  return localList.sort(sortComparator);
}

/**
 * Obtiene todos los permisos de un año escolar
 */
export async function getAllPermissions(year: number): Promise<AcademicPermissionRecord[]> {
  const localList = getLocalPermissions().filter(p => p.year === year);

  try {
    const q = query(
      collection(db, 'permisosAcademicos'),
      where('year', '==', year)
    );
    const snap = await getDocs(q);
    if (!snap.empty) {
      const remoteList: AcademicPermissionRecord[] = [];
      snap.forEach(d => remoteList.push(d.data() as AcademicPermissionRecord));
      saveLocalPermissions(remoteList);
      return remoteList.sort((a, b) => b.createdAt - a.createdAt);
    }
  } catch (err) {
    console.warn("Firestore getAllPermissions notice:", err);
  }

  return localList.sort((a, b) => b.createdAt - a.createdAt);
}

/**
 * Mapa rápido de permisos activos por estudiante para una fecha determinada.
 * Se usa directamente en la tabla de Asistencia para marcar "Permiso Académico".
 */
export function getActivePermissionsMapForDate(
  date: string, 
  courseId?: string
): Record<string, AcademicPermissionRecord> {
  const all = getLocalPermissions();
  const map: Record<string, AcademicPermissionRecord> = {};

  all.forEach(p => {
    if (p.fecha === date && p.estado !== 'rechazado') {
      if (!courseId || p.cursoId === courseId) {
        map[p.studentId] = p;
      }
    }
  });

  return map;
}
