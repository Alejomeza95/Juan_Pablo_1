export interface InstitutionalDocument {
  id: string;
  title: string;
  description: string;
  fileData: string; // Base64 representation of the file
  fileType: string;
  fileName: string;
  uploadedAt: number;
  uploadedBy: string;
  tags?: string[];
}

export type EventType = 'exam' | 'assignment' | 'event' | 'holiday';

export interface AcademicEvent {
  id: string;
  title: string;
  description: string;
  date: string; // YYYY-MM-DD format
  type: EventType;
  isAllDay?: boolean;
  startTime?: string;
  endTime?: string;
  createdBy: string;
  createdAt: number;
}

// ==========================================
// Configuración Académica (Generador Horarios)
// ==========================================

export type TeacherStatus = 'activo' | 'inactivo';

export interface TeacherRecord {
  id: string;
  fullName: string;
  internalCode: string;
  status: TeacherStatus;
  createdAt: number;
  updatedAt: number;
}

export interface SchoolGroupRecord {
  id: string; // e.g. '6A'
  grade: number; // 6, 7, 8, 9, 10, 11
  gradeName: string; // 'Sexto', 'Séptimo', etc.
  section: string; // 'A', 'B', 'C', etc.
  displayName: string; // '6°A'
  active: boolean;
  createdAt: number;
  updatedAt: number;
}

export interface SubjectRecord {
  id: string;
  name: string;
  active: boolean;
  createdAt: number;
  updatedAt: number;
}

export interface TeachingAssignmentRecord {
  id: string;
  teacherId: string;
  subjectId?: string;
  subjectName: string;
  groupId: string; // e.g. '6A'
  weeklyHours: number;
  createdAt: number;
  updatedAt: number;
}

export interface TeacherAssignmentItem {
  id?: string;
  subjectName: string;
  groupId: string;
  weeklyHours: number;
}

export interface AcademicConfigSettings {
  maxWeeklyHours: number;
  availableSections: string[];
  updatedAt: number;
}

// ==========================================
// Configuración de Año Escolar
// ==========================================

export type EducationalLevelKey = 'preescolar' | 'primaria' | 'secundaria' | 'media';

export interface GradeConfigItem {
  id: string; // e.g. 'transicion', '1', '6', '10'
  levelKey: EducationalLevelKey;
  levelName: string;
  gradeNumber: number; // 0 for transicion, 1..11, or custom
  name: string; // e.g. 'Transición (0°)', 'Primero (1°)', 'Sexto (6°)'
  shortName: string; // e.g. '0°', '1°', '6°'
  selected: boolean; // Casilla de selección (activa/inactiva)
  groupsCount: number; // Número de secciones/grupos proyectados (ej. 1, 2, 3...)
  sections: string[]; // ['A', 'B', 'C']
}

export interface EducationalLevelConfig {
  key: EducationalLevelKey;
  name: string;
  subtitle: string;
  description: string;
  grades: GradeConfigItem[];
}

export interface AcademicYearConfigRecord {
  id: string; // e.g. 'year_2026'
  year: number; // 2026
  displayName: string; // 'Año Escolar 2026'
  status: 'activo' | 'planificacion' | 'cerrado';
  periodCount: number; // e.g. 4 periodos académicos
  startDate?: string;
  endDate?: string;
  notes?: string;
  levels: EducationalLevelConfig[];
  updatedAt: number;
  updatedBy?: string;
}

// ==========================================
// Módulo de Asistencia Estudiantil
// ==========================================

export interface StudentRecord {
  id: string; // e.g. `${year}_${courseId}_${codigo}`
  codigo: string;
  nombres: string;
  apellidos: string;
  nombreCompleto: string;
  cursoId: string; // e.g. '6A'
  anioEscolarId: string; // e.g. 'year_2026'
  year: number; // e.g. 2026
  activo: boolean;
  createdAt: number;
  updatedAt: number;
}

export type AttendanceStatus = 'asistio' | 'no_asistio';

export interface StudentAttendanceEntry {
  estudianteId: string;
  codigo: string;
  apellidos: string;
  nombres: string;
  nombreCompleto: string;
  estado: AttendanceStatus;
}

export interface AttendanceSessionRecord {
  id: string; // session_${year}_${cursoId}_${asignaturaId}_${docenteId}_${fecha}
  anioEscolarId: string;
  year: number;
  cursoId: string;
  cursoNombre?: string;
  docenteId: string;
  docenteNombre?: string;
  asignaturaId: string;
  asignaturaNombre?: string;
  fecha: string; // YYYY-MM-DD
  totalEstudiantes: number;
  asistieron: number;
  noAsistieron: number;
  porcentajeAsistencia: number;
  porcentajeAusentismo: number;
  registros: Record<string, AttendanceStatus>; // map studentId -> status
  registrosDetalle: StudentAttendanceEntry[];
  createdBy: string;
  createdAt: number;
  updatedAt: number;
  updatedBy: string;
}

export interface AusentismoConfig {
  umbralVerde: number; // e.g. 10 (< 10%)
  umbralAmarillo: number; // e.g. 20 (10% - < 20%)
  umbralRojo: number; // e.g. 20 (>= 20%)
  updatedAt: number;
}

export interface StudentStatsSummary {
  student: StudentRecord;
  sesionesRegistradas: number;
  asistencias: number;
  inasistencias: number;
  porcentajeAusentismo: number;
  porcentajeAsistencia: number;
  alertaNivel: 'verde' | 'amarillo' | 'rojo';
}

export interface ExcelParsedStudent {
  rowNumber: number;
  codigo: string;
  apellidos: string;
  nombres: string;
  nombreCompleto: string;
  hasLeadingZeroWarning?: boolean;
  isValid: boolean;
  error?: string;
}

export interface ExcelImportSummary {
  totalRowsAnalyzed: number;
  importedCount: number;
  updatedCount: number;
  duplicateInFileCount: number;
  existingCount: number;
  errorCount: number;
  errors: string[];
}

/**
 * ========================================================
 * MÓDULO DE PERMISOS ACADÉMICOS
 * ========================================================
 */
export interface AcademicPermissionRecord {
  id: string; // permiso_${year}_${cursoId}_${studentId}_${fecha}_${timestamp}
  year: number;
  anioEscolarId: string;
  cursoId: string;
  cursoNombre: string;
  studentId: string;
  codigo: string;
  nombres: string;
  apellidos: string;
  nombreCompleto: string;
  fecha: string; // YYYY-MM-DD
  tipoRango: 'dia_completo' | 'rango_horas';
  horaInicio?: string; // e.g. "07:30"
  horaFin?: string; // e.g. "10:30"
  motivo: string;
  archivoPdfNombre?: string;
  archivoPdfBase64?: string; // data:application/pdf;base64,...
  archivoTamano?: string;
  estado: 'aprobado' | 'pendiente' | 'rechazado';
  observaciones?: string;
  registradoPor: string;
  createdAt: number;
  updatedAt: number;
}

export interface StudentAbsenteeismWithCauses {
  student: StudentRecord;
  sesionesRegistradas: number;
  asistencias: number;
  inasistencias: number;
  inasistenciasJustificadas: number;
  inasistenciasInjustificadas: number;
  porcentajeAusentismo: number;
  porcentajeAsistencia: number;
  porcentajeJustificado: number;
  alertaNivel: 'verde' | 'amarillo' | 'rojo';
  permisos: AcademicPermissionRecord[];
  causasPrincipales: Array<{ causa: string; count: number }>;
  detalleSesionesAusentes: Array<{
    sesionId: string;
    fecha: string;
    asignatura: string;
    docenteNombre?: string;
    tienePermiso: boolean;
    permiso?: AcademicPermissionRecord;
  }>;
}

export interface AbsenteeismCauseStat {
  categoria: string;
  count: number;
  porcentaje: number;
  color: string;
  badgeBg: string;
  textColor: string;
  iconName?: string;
}

// ==========================================
// Módulo de Gestión de Usuarios y Roles (RBAC)
// ==========================================

export type SystemUserRole = 'superadmin' | 'usuario_limitado';
export type SystemUserStatus = 'activo' | 'inactivo';

export interface SystemUserPermissions {
  documents: boolean;           // Acceso completo a Documentos Institucionales
  attendance: boolean;          // Acceso completo a Asistencia Estudiantil
  agenda: boolean;              // Acceso completo a Agenda Académica
  academicConfig: boolean;      // Acceso completo a Configuración Académica
  schoolYear: boolean;          // Acceso completo a Año Escolar
  academicPermissions: boolean; // Permisos Académicos (restringido para usuarios limitados)
  absenteeismDashboard: boolean;// Dashboard de Ausentismo en Panel de Control
  manageUsers: boolean;         // Crear y administrar usuarios (exclusivo Superadmin)
}

export interface SystemUserRecord {
  id: string; // Document ID (usually normalized username)
  username: string; // Nombre de usuario para inicio de sesión (ej: "docente1", "secretaria")
  password: string; // Contraseña asignada por el administrador
  fullName: string;
  cargo: string; // e.g. "Docente", "Coordinador Académico", "Secretaría"
  email?: string; // Correo de contacto opcional
  role: SystemUserRole;
  status: SystemUserStatus;
  permissions: SystemUserPermissions;
  createdAt: number;
  createdBy: string;
  updatedAt: number;
  updatedBy?: string;
  notas?: string;
}

export interface AppSessionUser {
  uid: string;
  displayName: string | null;
  email: string | null;
  photoURL?: string | null;
  username?: string;
  cargo?: string;
  role?: SystemUserRole;
  isCustomAuth?: boolean;
}


