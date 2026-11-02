import React, { useState, useEffect, useMemo } from 'react';
import { User } from 'firebase/auth';
import { 
  ClipboardCheck, 
  CheckCircle2, 
  XCircle, 
  Clock, 
  Calendar, 
  UserCheck, 
  BookOpen, 
  Save, 
  Check, 
  Loader2, 
  AlertCircle, 
  AlertTriangle,
  RotateCcw,
  Sparkles,
  Search,
  CheckCheck,
  ShieldCheck,
  Users,
  Copy,
  FileCode,
  FileCheck2,
  X
} from 'lucide-react';
import { 
  StudentRecord, 
  SchoolGroupRecord, 
  TeacherRecord, 
  SubjectRecord, 
  TeachingAssignmentRecord,
  AcademicYearConfigRecord,
  AttendanceStatus,
  AttendanceSessionRecord,
  AcademicPermissionRecord
} from '../../types';
import { 
  getStudentsByCourse, 
  saveAttendanceSession, 
  getExistingAttendanceSession 
} from '../../utils/attendanceService';
import { getActivePermissionsMapForDate } from '../../utils/academicPermissionsService';
import { ADMIN_EMAIL } from '../../firebase';

interface AttendanceRegisterTabProps {
  user: User;
  schoolYear: number;
  yearConfig: AcademicYearConfigRecord;
  availableGroups: SchoolGroupRecord[];
  teachers: TeacherRecord[];
  subjects: string[];
  assignments: TeachingAssignmentRecord[];
  initialGroupId?: string;
}

const FIRESTORE_RULES_TEXT = `rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // 1. Gestión de Docentes (CRUD completo)
    match /teachers/{teacherId} {
      allow read: if true;
      allow create, update, delete: if request.auth != null && request.auth.token.email == '${ADMIN_EMAIL}';
    }
    
    // 2. Gestión de Grados y Grupos (Sincronizados con Año Escolar)
    match /schoolGroups/{groupId} {
      allow read: if true;
      allow create, update, delete: if request.auth != null && request.auth.token.email == '${ADMIN_EMAIL}';
    }
    
    // 3. Catálogo de Asignaturas del Colegio
    match /subjects/{subjectId} {
      allow read: if true;
      allow create, update, delete: if request.auth != null && request.auth.token.email == '${ADMIN_EMAIL}';
    }
    
    // 4. Asignaciones Académicas (Carga Docente y Horas)
    match /teachingAssignments/{assignmentId} {
      allow read: if true;
      allow create, update, delete: if request.auth != null && request.auth.token.email == '${ADMIN_EMAIL}';
    }

    // 5. Configuración de Años Escolares
    match /academicYears/{yearId} {
      allow read: if true;
      allow create, update, delete: if request.auth != null && request.auth.token.email == '${ADMIN_EMAIL}';
    }

    // 6. Configuración General Académica
    match /academicConfig/{configId} {
      allow read: if true;
      allow create, update, delete: if request.auth != null && request.auth.token.email == '${ADMIN_EMAIL}';
    }

    // 7. Horarios por Curso
    match /schedules/{course} {
      allow read: if true;
      allow create, update, delete: if request.auth != null && request.auth.token.email == '${ADMIN_EMAIL}';
    }

    // 8. Eventos y Agenda
    match /events/{eventId} {
      allow read: if true;
      allow create, update, delete: if request.auth != null && request.auth.token.email == '${ADMIN_EMAIL}';
    }
    match /agenda/{eventId} {
      allow read: if true;
      allow create, update, delete: if request.auth != null && request.auth.token.email == '${ADMIN_EMAIL}';
    }

    // 9. Anuncios y Comunicados
    match /announcements/{announcementId} {
      allow read: if true;
      allow create, update, delete: if request.auth != null && request.auth.token.email == '${ADMIN_EMAIL}';
    }

    // 10. Documentos Institucionales
    match /documents/{document} {
      allow read: if true;
      allow create, update, delete: if request.auth != null && request.auth.token.email == '${ADMIN_EMAIL}';
    }

    // 11. MÓDULO ASISTENCIA: Estudiantes por Curso y Año Escolar
    match /estudiantes/{estudianteId} {
      allow read, write: if true;
    }

    // 12. MÓDULO ASISTENCIA: Sesiones de Asistencia de Clases
    match /sesionesAsistencia/{sesionId} {
      allow read, write: if true;
    }

    // 13. MÓDULO ASISTENCIA: Configuración de Umbrales de Ausentismo
    match /configuracionAusentismo/{configId} {
      allow read, write: if true;
    }

    // Fallback de seguridad institucional
    match /{document=**} {
      allow read: if true;
      allow create, update, delete: if request.auth != null && request.auth.token.email == '${ADMIN_EMAIL}';
    }
  }
}`;

export function AttendanceRegisterTab({
  user,
  schoolYear,
  yearConfig,
  availableGroups,
  teachers,
  subjects,
  assignments,
  initialGroupId
}: AttendanceRegisterTabProps) {
  const isAdmin = user.email === ADMIN_EMAIL;

  // Selected filters
  const [selectedGroupId, setSelectedGroupId] = useState<string>(initialGroupId || (availableGroups[0]?.id || ''));
  const [selectedTeacherId, setSelectedTeacherId] = useState<string>('');
  const [selectedSubject, setSelectedSubject] = useState<string>('');
  const [selectedDate, setSelectedDate] = useState<string>(new Date().toISOString().split('T')[0]);

  // Students & Attendance Markings
  const [students, setStudents] = useState<StudentRecord[]>([]);
  const [loadingStudents, setLoadingStudents] = useState(false);
  const [attendanceMarks, setAttendanceMarks] = useState<Record<string, AttendanceStatus>>({});
  
  // Status of session (new vs editing existing)
  const [existingSession, setExistingSession] = useState<AttendanceSessionRecord | null>(null);
  const [checkingExisting, setCheckingExisting] = useState(false);

  // Saving state
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccessMsg, setSaveSuccessMsg] = useState<string | null>(null);
  const [saveErrorMsg, setSaveErrorMsg] = useState<string | null>(null);
  const [showPendingModal, setShowPendingModal] = useState(false);

  // Rules Modal state
  const [showRulesModal, setShowRulesModal] = useState(false);
  const [copiedRules, setCopiedRules] = useState(false);

  // Search in table
  const [searchTerm, setSearchTerm] = useState('');

  // Initial teacher auto-selection
  useEffect(() => {
    if (!selectedTeacherId && teachers.length > 0) {
      // If user email matches a teacher or default to first
      setSelectedTeacherId(teachers[0].id);
    }
  }, [teachers]);

  // Filter subjects related to the selected course and teacher if assignments exist
  const relatedSubjects = useMemo(() => {
    if (!selectedGroupId) return subjects;
    const groupAssignments = assignments.filter(a => a.groupId === selectedGroupId);
    if (selectedTeacherId) {
      const teacherAssignments = groupAssignments.filter(a => a.teacherId === selectedTeacherId);
      if (teacherAssignments.length > 0) {
        return Array.from(new Set(teacherAssignments.map(a => a.subjectName)));
      }
    }
    if (groupAssignments.length > 0) {
      return Array.from(new Set(groupAssignments.map(a => a.subjectName)));
    }
    return subjects;
  }, [selectedGroupId, selectedTeacherId, assignments, subjects]);

  // Default subject selection
  useEffect(() => {
    if (relatedSubjects.length > 0 && (!selectedSubject || !relatedSubjects.includes(selectedSubject))) {
      setSelectedSubject(relatedSubjects[0]);
    }
  }, [relatedSubjects]);

  // Load students for selected course
  useEffect(() => {
    if (!selectedGroupId) return;
    let isMounted = true;
    setLoadingStudents(true);
    setSaveSuccessMsg(null);
    setSaveErrorMsg(null);

    getStudentsByCourse(schoolYear, selectedGroupId)
      .then(data => {
        if (!isMounted) return;
        const activeOnly = data.filter(s => s.activo);
        setStudents(activeOnly);
      })
      .catch(err => {
        console.error("Error loading students:", err);
      })
      .finally(() => {
        if (isMounted) setLoadingStudents(false);
      });

    return () => { isMounted = false; };
  }, [schoolYear, selectedGroupId]);

  // Check if session already exists for this (year, course, subject, teacher, date)
  useEffect(() => {
    if (!selectedGroupId || !selectedSubject || !selectedTeacherId || !selectedDate) return;
    
    let isMounted = true;
    setCheckingExisting(true);
    setSaveSuccessMsg(null);

    getExistingAttendanceSession(schoolYear, selectedGroupId, selectedSubject, selectedTeacherId, selectedDate)
      .then(prevSession => {
        if (!isMounted) return;
        if (prevSession) {
          setExistingSession(prevSession);
          // Pre-populate with previous markings
          setAttendanceMarks(prevSession.registros || {});
        } else {
          setExistingSession(null);
          // Reset marks (do not mark automatically per requirements)
          setAttendanceMarks({});
        }
      })
      .catch(e => {
        console.error("Error checking existing session:", e);
      })
      .finally(() => {
        if (isMounted) setCheckingExisting(false);
      });

    return () => { isMounted = false; };
  }, [schoolYear, selectedGroupId, selectedSubject, selectedTeacherId, selectedDate]);

  // Handlers for marking
  const handleMarkIndividual = (studentId: string, status: AttendanceStatus) => {
    setAttendanceMarks(prev => ({
      ...prev,
      [studentId]: status
    }));
  };

  const handleMarkAllPresent = () => {
    const newMarks: Record<string, AttendanceStatus> = {};
    students.forEach(st => {
      newMarks[st.id] = 'asistio';
    });
    setAttendanceMarks(newMarks);
  };

  const handleResetMarks = () => {
    setAttendanceMarks({});
  };

  // Permisos Académicos activos para la fecha y curso seleccionados
  const [permissionsMap, setPermissionsMap] = useState<Record<string, AcademicPermissionRecord>>({});

  useEffect(() => {
    if (!selectedDate) return;
    const refreshPerms = () => {
      const map = getActivePermissionsMapForDate(selectedDate, selectedGroupId);
      setPermissionsMap(map);
    };
    refreshPerms();

    window.addEventListener('academic-permission-saved', refreshPerms);
    window.addEventListener('academic-permission-deleted', refreshPerms);
    return () => {
      window.removeEventListener('academic-permission-saved', refreshPerms);
      window.removeEventListener('academic-permission-deleted', refreshPerms);
    };
  }, [selectedDate, selectedGroupId]);

  // Real-time counters
  const totalStudents = students.length;
  const permissionStudentsCount = students.filter(s => Boolean(permissionsMap[s.id])).length;
  const attendedCount = students.filter(s => !permissionsMap[s.id] && attendanceMarks[s.id] === 'asistio').length;
  const absentCount = students.filter(s => !permissionsMap[s.id] && attendanceMarks[s.id] === 'no_asistio').length;
  const pendingCount = totalStudents - (attendedCount + absentCount + permissionStudentsCount);
  const effectivePresent = attendedCount + permissionStudentsCount; // Permiso cuenta como justificado
  const attendancePercentage = totalStudents > 0 
    ? Math.round((effectivePresent / totalStudents) * 100) 
    : 100;

  // Save session
  // Execute Firestore & Local persistence
  const executeSave = async (marksToSave: Record<string, AttendanceStatus>) => {
    setIsSaving(true);
    setSaveErrorMsg(null);
    setSaveSuccessMsg(null);

    // Integrar estudiantes con permiso académico como justificados
    const finalMarks: Record<string, AttendanceStatus> = { ...marksToSave };
    students.forEach(st => {
      if (permissionsMap[st.id]) {
        finalMarks[st.id] = 'asistio';
      }
    });

    try {
      const groupObj = availableGroups.find(g => g.id === selectedGroupId);
      const teacherObj = teachers.find(t => t.id === selectedTeacherId);

      const result = await saveAttendanceSession({
        year: schoolYear,
        anioEscolarId: yearConfig.id || `year_${schoolYear}`,
        cursoId: selectedGroupId,
        cursoNombre: groupObj?.displayName || selectedGroupId,
        docenteId: selectedTeacherId,
        docenteNombre: teacherObj?.fullName || 'Docente Institucional',
        asignaturaId: selectedSubject,
        asignaturaNombre: selectedSubject,
        fecha: selectedDate,
        registros: finalMarks,
        studentsList: students
      });

      setExistingSession(result.session);
      setAttendanceMarks(marksToSave);

      if (result.savedInFirestore) {
        setSaveSuccessMsg(
          `¡Éxito! Asistencia guardada y confirmada en Cloud Firestore (Colección: "sesionesAsistencia" • ID: ${result.session.id} • ${result.session.asistieron} Asistieron, ${result.session.noAsistieron} Ausentes)`
        );
      } else {
        setSaveSuccessMsg(
          `¡Asistencia guardada localmente! (Nota de Firestore: ${result.firestoreError || 'Permisos pendientes'}. Puedes revisar las reglas en el botón "Reglas de Firestore").`
        );
      }

      // Notify other tabs to reload dashboard data
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('attendance-session-saved', { detail: result.session }));
      }

      setTimeout(() => {
        setSaveSuccessMsg(null);
      }, 7000);
    } catch (err: any) {
      console.error("Error saving attendance:", err);
      setSaveErrorMsg(err.message || 'Error al guardar la asistencia.');
    } finally {
      setIsSaving(false);
      setShowPendingModal(false);
    }
  };

  // Triggered by "Guardar Asistencia de la Sesión" button
  const handleSaveAttendance = () => {
    setSaveErrorMsg(null);
    setSaveSuccessMsg(null);

    if (totalStudents === 0) {
      setSaveErrorMsg("El curso seleccionado no tiene estudiantes activos para registrar asistencia.");
      return;
    }

    if (pendingCount > 0) {
      // In iframe environments, avoid browser dialogs (window.confirm is blocked). Use in-app modal instead.
      setShowPendingModal(true);
      return;
    }

    // All students already marked (0 pending) -> Save immediately
    executeSave(attendanceMarks);
  };

  // Auto-fill pending and save
  const handleFillPendingAndSave = (defaultStatus: AttendanceStatus = 'asistio') => {
    const filledMarks = { ...attendanceMarks };
    students.forEach(st => {
      if (!filledMarks[st.id]) {
        filledMarks[st.id] = defaultStatus;
      }
    });
    executeSave(filledMarks);
  };

  // Filtered students
  const filteredStudents = students.filter(st => {
    if (!searchTerm) return true;
    const term = searchTerm.toLowerCase();
    return (
      st.codigo.toLowerCase().includes(term) ||
      st.apellidos.toLowerCase().includes(term) ||
      st.nombres.toLowerCase().includes(term) ||
      st.nombreCompleto.toLowerCase().includes(term)
    );
  });

  const selectedGroupObj = availableGroups.find(g => g.id === selectedGroupId);

  return (
    <div className="space-y-6">
      {/* Session Header / Selectors Box */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-purple-600 text-white rounded-xl shadow-xs shrink-0">
              <ClipboardCheck className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-black text-slate-900 text-base">
                Registro de Asistencia de Clases
              </h3>
              <p className="text-xs text-slate-500">
                Selecciona el curso, docente, asignatura y fecha de la sesión escolar
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <span className="px-3 py-1 bg-indigo-50 text-indigo-700 font-bold text-xs rounded-xl border border-indigo-100">
              Vigencia {schoolYear}
            </span>
            <button
              type="button"
              onClick={() => setShowRulesModal(true)}
              className="flex items-center gap-1.5 px-3 py-1 bg-amber-50 hover:bg-amber-100 text-amber-800 font-bold text-xs rounded-xl border border-amber-200 transition-colors shadow-2xs"
              title="Ver y copiar las reglas de seguridad de Firestore para guardar asistencia"
            >
              <FileCode className="w-3.5 h-3.5 text-amber-700 shrink-0" />
              <span>Reglas de Firestore</span>
            </button>
          </div>
        </div>

        {/* Form Selectors Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* 1. Curso */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
              <Users className="w-3.5 h-3.5 text-purple-600" />
              <span>Curso / Grupo *</span>
            </label>
            <select
              value={selectedGroupId}
              onChange={(e) => setSelectedGroupId(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-purple-500"
            >
              {availableGroups.length === 0 ? (
                <option value="">No hay cursos registrados en Año Escolar</option>
              ) : (
                availableGroups.map(g => (
                  <option key={g.id} value={g.id}>
                    {g.displayName} ({g.gradeName})
                  </option>
                ))
              )}
            </select>
          </div>

          {/* 2. Docente */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
              <UserCheck className="w-3.5 h-3.5 text-purple-600" />
              <span>Docente *</span>
            </label>
            <select
              value={selectedTeacherId}
              onChange={(e) => setSelectedTeacherId(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-purple-500"
            >
              {teachers.length === 0 ? (
                <option value="">No hay docentes registrados</option>
              ) : (
                teachers.map(t => (
                  <option key={t.id} value={t.id}>
                    {t.fullName} ({t.internalCode})
                  </option>
                ))
              )}
            </select>
          </div>

          {/* 3. Asignatura */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
              <BookOpen className="w-3.5 h-3.5 text-purple-600" />
              <span>Asignatura *</span>
            </label>
            <select
              value={selectedSubject}
              onChange={(e) => setSelectedSubject(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-purple-500"
            >
              {relatedSubjects.length === 0 ? (
                <option value="">Sin asignaturas disponibles</option>
              ) : (
                relatedSubjects.map(sub => (
                  <option key={sub} value={sub}>
                    {sub}
                  </option>
                ))
              )}
            </select>
          </div>

          {/* 4. Fecha */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5 text-purple-600" />
              <span>Fecha de la Clase *</span>
            </label>
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              max={new Date().toISOString().split('T')[0]}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-purple-500"
            />
          </div>
        </div>

        {/* Existing Session Alert */}
        {existingSession && (
          <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-900 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
              <span>
                <strong>Sesión ya registrada previamente:</strong> Editando registros del {selectedDate} ({existingSession.asistieron} asistieron, {existingSession.noAsistieron} ausentes). Al guardar se actualizará sin duplicar registros.
              </span>
            </div>
            <span className="text-[10px] text-amber-700 font-mono">
              ID: {existingSession.id}
            </span>
          </div>
        )}

        {saveSuccessMsg && (
          <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-800 text-xs font-bold flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{saveSuccessMsg}</span>
          </div>
        )}

        {saveErrorMsg && (
          <div className="p-3.5 bg-red-50 border border-red-200 text-red-700 rounded-xl text-xs font-bold flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
            <span>{saveErrorMsg}</span>
          </div>
        )}
      </div>

      {/* Real-Time Metrics & Quick Action Toolbar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex flex-col md:flex-row items-center justify-between gap-4">
        {/* Real-time counters */}
        <div className="flex flex-wrap items-center gap-2 sm:gap-4 text-xs font-bold">
          <div className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 text-slate-700 rounded-xl border border-slate-200">
            <Users className="w-4 h-4 text-slate-500" />
            <span>Total: {totalStudents}</span>
          </div>

          <div className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 text-emerald-700 rounded-xl border border-emerald-200">
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            <span>Asistieron: {attendedCount}</span>
          </div>

          <div className="flex items-center gap-1.5 px-3 py-1.5 bg-rose-50 text-rose-700 rounded-xl border border-rose-200">
            <XCircle className="w-4 h-4 text-rose-600" />
            <span>Ausentes: {absentCount}</span>
          </div>

          {permissionStudentsCount > 0 && (
            <div className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-50 text-amber-800 rounded-xl border border-amber-200">
              <FileCheck2 className="w-4 h-4 text-amber-600" />
              <span>Permisos: {permissionStudentsCount}</span>
            </div>
          )}

          {pendingCount > 0 ? (
            <div className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-50 text-amber-700 rounded-xl border border-amber-200">
              <Clock className="w-4 h-4 text-amber-600" />
              <span>Pendientes: {pendingCount}</span>
            </div>
          ) : (
            <div className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-50 text-indigo-700 rounded-xl border border-indigo-200">
              <CheckCheck className="w-4 h-4 text-indigo-600" />
              <span>100% Marcados</span>
            </div>
          )}

          <div className="flex items-center gap-1 px-3 py-1.5 bg-purple-50 text-purple-700 rounded-xl border border-purple-200">
            <span>{attendancePercentage}% Asistencia</span>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap sm:flex-nowrap items-center gap-2 w-full md:w-auto justify-stretch sm:justify-end">
          <button
            type="button"
            onClick={handleMarkAllPresent}
            disabled={totalStudents === 0}
            className="flex-1 sm:flex-initial flex items-center justify-center gap-1.5 px-3.5 py-2.5 bg-purple-50 hover:bg-purple-100 text-purple-700 border border-purple-200 rounded-xl text-xs font-bold transition-all shadow-2xs hover:scale-102 active:scale-98 disabled:opacity-50"
          >
            <Sparkles className="w-4 h-4 text-purple-600 shrink-0" />
            <span className="whitespace-nowrap">Marcar Todos Asistieron</span>
          </button>

          <button
            type="button"
            onClick={handleResetMarks}
            disabled={totalStudents === 0}
            className="p-2.5 text-slate-500 hover:text-slate-800 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors shrink-0"
            title="Limpiar todas las marcas"
          >
            <RotateCcw className="w-4 h-4" />
          </button>

          <button
            type="button"
            onClick={handleSaveAttendance}
            disabled={isSaving || totalStudents === 0}
            className="flex-1 sm:flex-initial flex items-center justify-center gap-2 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-black transition-all shadow-xs hover:scale-102 active:scale-98 disabled:opacity-50"
          >
            {isSaving ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin shrink-0" />
                <span className="whitespace-nowrap">Guardando...</span>
              </>
            ) : (
              <>
                <Save className="w-4 h-4 shrink-0" />
                <span className="whitespace-nowrap">Guardar Asistencia</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Attendance Sheet Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div>
            <h4 className="font-bold text-slate-900 text-sm">
              Lista Oficial de Asistencia: {selectedGroupObj?.displayName || selectedGroupId} • {selectedSubject}
            </h4>
            <p className="text-xs text-slate-400">
              Docente: {teachers.find(t => t.id === selectedTeacherId)?.fullName || 'Docente'} • Fecha: {selectedDate}
            </p>
          </div>

          <div className="relative w-full sm:w-64">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Buscar estudiante en la lista..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:outline-none focus:ring-2 focus:ring-purple-500 focus:bg-white"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[650px] text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold uppercase tracking-wider">
                <th className="py-3 px-4 w-12 text-center">N°</th>
                <th className="py-3 px-4 w-28">Código</th>
                <th className="py-3 px-4">Apellidos y Nombres</th>
                <th className="py-3 px-4 w-36 text-center">Asistió</th>
                <th className="py-3 px-4 w-36 text-center">No asistió</th>
                <th className="py-3 px-4 w-28 text-center">Estado</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loadingStudents ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-slate-400">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <Loader2 className="w-6 h-6 animate-spin text-purple-600" />
                      <span>Cargando estudiantes del curso...</span>
                    </div>
                  </td>
                </tr>
              ) : filteredStudents.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-slate-400">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <Users className="w-8 h-8 text-slate-300" />
                      <p className="font-semibold text-slate-600 text-sm">
                        No hay estudiantes activos matriculados en este curso
                      </p>
                      <p className="text-xs text-slate-400">
                        Ve a la pestaña <strong>«Gestión e importación de estudiantes»</strong> para cargar o importar los estudiantes desde Excel.
                      </p>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredStudents.map((st, idx) => {
                  const mark = attendanceMarks[st.id]; // 'asistio' | 'no_asistio' | undefined
                  const perm = permissionsMap[st.id]; // Academic permission on this date

                  return (
                    <tr 
                      key={st.id} 
                      className={`transition-colors ${
                        perm
                          ? 'bg-amber-50/50 hover:bg-amber-50/70'
                          : mark === 'asistio' 
                          ? 'bg-emerald-50/30 hover:bg-emerald-50/50' 
                          : mark === 'no_asistio' 
                          ? 'bg-rose-50/30 hover:bg-rose-50/50' 
                          : 'hover:bg-slate-50/70'
                      }`}
                    >
                      <td className="py-3 px-4 text-center font-bold text-slate-400">
                        {idx + 1}
                      </td>
                      <td className="py-3 px-4 font-mono font-bold text-slate-700">
                        {st.codigo}
                      </td>
                      <td className="py-3 px-4">
                        <span className="font-bold text-slate-900 uppercase">
                          {st.apellidos}
                        </span>{' '}
                        <span className="text-slate-600 font-medium">
                          {st.nombres}
                        </span>
                      </td>

                      {/* Si el estudiante tiene Permiso Académico: no tiene casillas Ausente/Presente sino la nota de permiso */}
                      {perm ? (
                        <td colSpan={2} className="py-3 px-4 text-center">
                          <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-amber-100/90 text-amber-950 border border-amber-300 rounded-xl text-left shadow-2xs">
                            <FileCheck2 className="w-4 h-4 text-amber-700 shrink-0" />
                            <div>
                              <span className="font-black text-xs block leading-tight text-amber-950">
                                Permiso Académico: {perm.motivo}
                              </span>
                              <span className="text-[10px] text-amber-800 font-medium">
                                {perm.tipoRango === 'dia_completo' ? 'Jornada Completa' : `Horario: ${perm.horaInicio} a ${perm.horaFin}`}
                                {perm.archivoPdfBase64 ? ' • Soporte PDF ✓' : ''}
                              </span>
                            </div>
                          </div>
                        </td>
                      ) : (
                        <>
                          {/* Opción Excluyente: Asistió */}
                          <td className="py-3 px-4 text-center">
                            <label className="inline-flex items-center justify-center cursor-pointer p-1.5 rounded-xl hover:bg-emerald-100 transition-colors">
                              <input
                                type="radio"
                                name={`att_${st.id}`}
                                value="asistio"
                                checked={mark === 'asistio'}
                                onChange={() => handleMarkIndividual(st.id, 'asistio')}
                                className="w-4 h-4 text-emerald-600 focus:ring-emerald-500 cursor-pointer accent-emerald-600"
                              />
                              <span className={`ml-2 text-xs font-bold ${mark === 'asistio' ? 'text-emerald-700 font-black' : 'text-slate-500'}`}>
                                Presente
                              </span>
                            </label>
                          </td>

                          {/* Opción Excluyente: No asistió */}
                          <td className="py-3 px-4 text-center">
                            <label className="inline-flex items-center justify-center cursor-pointer p-1.5 rounded-xl hover:bg-rose-100 transition-colors">
                              <input
                                type="radio"
                                name={`att_${st.id}`}
                                value="no_asistio"
                                checked={mark === 'no_asistio'}
                                onChange={() => handleMarkIndividual(st.id, 'no_asistio')}
                                className="w-4 h-4 text-rose-600 focus:ring-rose-500 cursor-pointer accent-rose-600"
                              />
                              <span className={`ml-2 text-xs font-bold ${mark === 'no_asistio' ? 'text-rose-700 font-black' : 'text-slate-500'}`}>
                                Ausente
                              </span>
                            </label>
                          </td>
                        </>
                      )}

                      <td className="py-3 px-4 text-center">
                        {perm ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md text-[11px] font-bold bg-amber-100 text-amber-900 border border-amber-300">
                            <FileCheck2 className="w-3 h-3 text-amber-700" />
                            <span>Permiso</span>
                          </span>
                        ) : mark === 'asistio' ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md text-[11px] font-bold bg-emerald-100 text-emerald-800">
                            <Check className="w-3 h-3 text-emerald-700" />
                            <span>Asistió</span>
                          </span>
                        ) : mark === 'no_asistio' ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md text-[11px] font-bold bg-rose-100 text-rose-800">
                            <XCircle className="w-3 h-3 text-rose-700" />
                            <span>Inasistencia</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md text-[11px] font-semibold bg-slate-100 text-slate-500">
                            Pendiente
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Bottom Save Bar */}
        {/* Bottom Status Notifications */}
        {saveSuccessMsg && (
          <div className="mx-4 mt-3 p-3.5 bg-emerald-50 border border-emerald-300 rounded-xl text-emerald-900 text-xs font-bold flex items-center justify-between gap-2 shadow-xs animate-in fade-in">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
              <span>{saveSuccessMsg}</span>
            </div>
            <span className="px-2.5 py-0.5 bg-emerald-200 text-emerald-800 text-[10px] font-mono font-bold rounded-md">
              Firestore Sincronizado
            </span>
          </div>
        )}

        {saveErrorMsg && (
          <div className="mx-4 mt-3 p-3.5 bg-rose-50 border border-rose-300 text-rose-800 rounded-xl text-xs font-bold flex items-center justify-between gap-2 shadow-xs animate-in fade-in">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-5 h-5 text-rose-600 shrink-0" />
              <span>{saveErrorMsg}</span>
            </div>
            <button
              type="button"
              onClick={() => setShowRulesModal(true)}
              className="px-3 py-1 bg-rose-100 hover:bg-rose-200 text-rose-900 rounded-lg text-xs font-bold underline"
            >
              Ver Reglas
            </button>
          </div>
        )}

        {/* Bottom Actions Bar */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="text-xs text-slate-500">
            {pendingCount === 0 ? (
              <span className="text-emerald-700 font-bold flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-emerald-600" />
                Todos los {totalStudents} estudiantes marcados. Listo para guardar en Firestore.
              </span>
            ) : (
              <span className="text-amber-800 font-medium">
                Hay <strong>{pendingCount} estudiantes sin marcar</strong>. Al guardar podrás marcarlos automáticamente o completarlos.
              </span>
            )}
          </div>

          <button
            type="button"
            onClick={handleSaveAttendance}
            disabled={isSaving || totalStudents === 0}
            className="flex items-center gap-2 px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-black transition-all shadow-xs hover:scale-102 active:scale-98 disabled:opacity-50"
          >
            {isSaving ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Guardando en Firestore...</span>
              </>
            ) : (
              <>
                <Save className="w-4 h-4" />
                <span>Guardar Asistencia de la Sesión</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* MODAL: CONFIRMAR MARCADOS PENDIENTES (100% IN-APP, SIN WINDOW.CONFIRM) */}
      {showPendingModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-amber-500 text-white">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-amber-600 rounded-xl text-white">
                  <AlertTriangle className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-black text-sm">Estudiantes Pendientes por Marcar</h3>
                  <p className="text-[11px] text-amber-100 font-medium">Hay registros sin seleccionar</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowPendingModal(false)}
                className="p-1 text-white/80 hover:text-white rounded-lg transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 space-y-4 text-xs">
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-amber-900 space-y-1">
                <p className="font-bold text-sm">
                  Detectamos {pendingCount} estudiante(s) sin marcar
                </p>
                <p className="text-amber-800 text-[11px]">
                  De los {totalStudents} estudiantes activos, {attendedCount} están como Asistió y {absentCount} como Ausente.
                  ¿Cómo deseas registrar a los {pendingCount} estudiantes restantes en Firestore?
                </p>
              </div>

              <div className="space-y-2">
                <button
                  type="button"
                  onClick={() => handleFillPendingAndSave('asistio')}
                  disabled={isSaving}
                  className="w-full flex items-center justify-between p-3 bg-emerald-50 hover:bg-emerald-100 border border-emerald-300 text-emerald-900 rounded-xl font-bold transition-all text-left shadow-2xs group"
                >
                  <div className="flex items-center gap-2.5">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 group-hover:scale-110 transition-transform" />
                    <div>
                      <div className="text-xs font-black">Marcar pendientes como «Asistió» y Guardar</div>
                      <div className="text-[10px] text-emerald-700 font-normal">Guarda todos los pendientes como presentes en Firestore</div>
                    </div>
                  </div>
                  <Save className="w-4 h-4 text-emerald-700" />
                </button>

                <button
                  type="button"
                  onClick={() => handleFillPendingAndSave('no_asistio')}
                  disabled={isSaving}
                  className="w-full flex items-center justify-between p-3 bg-rose-50 hover:bg-rose-100 border border-rose-300 text-rose-900 rounded-xl font-bold transition-all text-left shadow-2xs group"
                >
                  <div className="flex items-center gap-2.5">
                    <XCircle className="w-4 h-4 text-rose-600 shrink-0 group-hover:scale-110 transition-transform" />
                    <div>
                      <div className="text-xs font-black">Marcar pendientes como «No asistió» y Guardar</div>
                      <div className="text-[10px] text-rose-700 font-normal">Guarda todos los pendientes como ausentes en Firestore</div>
                    </div>
                  </div>
                  <Save className="w-4 h-4 text-rose-700" />
                </button>
              </div>
            </div>

            <div className="px-5 py-3.5 bg-slate-50 border-t border-slate-100 flex items-center justify-end">
              <button
                type="button"
                onClick={() => setShowPendingModal(false)}
                className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 text-xs font-bold rounded-xl transition-colors"
              >
                Volver a la lista para marcar manualmente
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: VER Y COPIAR REGLAS DE FIRESTORE */}
      {showRulesModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-3xl w-full max-h-[90vh] flex flex-col shadow-2xl border border-slate-200 overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-900 text-white">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-amber-500 rounded-xl text-slate-900">
                  <FileCode className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-base">Reglas de Seguridad de Cloud Firestore</h3>
                  <p className="text-xs text-slate-300">Copia y pega este código en la pestaña «Rules» de tu Firebase Console</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowRulesModal(false)}
                className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 flex-1 overflow-y-auto space-y-4">
              <div className="p-3 bg-indigo-50 border border-indigo-200 rounded-xl text-xs text-indigo-900 space-y-1">
                <p className="font-bold">¿Cómo aplicar estas reglas en Firebase?</p>
                <ol className="list-decimal pl-4 space-y-0.5 text-indigo-800">
                  <li>Ve a <a href="https://console.firebase.google.com/" target="_blank" rel="noreferrer" className="underline font-bold text-indigo-950">Firebase Console</a> y selecciona tu proyecto <strong>juan-pablo-1-a4d13</strong>.</li>
                  <li>En el menú de la izquierda entra a <strong>Firestore Database</strong> y haz clic en la pestaña <strong>Rules</strong> (Reglas).</li>
                  <li>Reemplaza el texto existente con el código de abajo y haz clic en <strong>Publish</strong> (Publicar).</li>
                </ol>
              </div>

              <div className="relative">
                <pre className="p-4 bg-slate-950 text-emerald-400 font-mono text-[11px] rounded-xl overflow-x-auto max-h-96 leading-relaxed border border-slate-800">
                  {FIRESTORE_RULES_TEXT}
                </pre>
                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard.writeText(FIRESTORE_RULES_TEXT);
                    setCopiedRules(true);
                    setTimeout(() => setCopiedRules(false), 3000);
                  }}
                  className="absolute top-3 right-3 flex items-center gap-1.5 px-3 py-1.5 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-xs font-bold transition-all shadow-md"
                >
                  {copiedRules ? <Check className="w-4 h-4 text-emerald-300" /> : <Copy className="w-4 h-4" />}
                  <span>{copiedRules ? '¡Copiado!' : 'Copiar Código'}</span>
                </button>
              </div>
            </div>

            <div className="px-6 py-4 border-t border-slate-200 bg-slate-50 flex items-center justify-between">
              <span className="text-xs text-slate-500 font-medium">
                Incluye permisos para Asistencia Estudiantil (`sesionesAsistencia` y `estudiantes`).
              </span>
              <button
                type="button"
                onClick={() => setShowRulesModal(false)}
                className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 text-xs font-bold rounded-xl transition-colors"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
