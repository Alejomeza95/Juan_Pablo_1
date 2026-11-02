import React, { useState, useEffect, useCallback, useRef } from 'react';
import { User } from 'firebase/auth';
import { 
  collection, 
  onSnapshot, 
  query, 
  orderBy, 
  doc 
} from 'firebase/firestore';
import { db, auth, ADMIN_EMAIL } from '../../firebase';
import { 
  TeacherRecord, 
  SchoolGroupRecord, 
  TeachingAssignmentRecord, 
  AcademicConfigSettings 
} from '../../types';
import { 
  seedInitialAcademicDataIfEmpty,
  DEFAULT_SECTIONS,
  getLocalAcademicData,
  saveLocalAcademicData,
  isPermissionError,
  getStoredSchoolYearConfig
} from '../../utils/academicConfigService';
import { TeachersTab } from './TeachersTab';
import { GroupsTab } from './GroupsTab';
import { WorkloadSummaryTab } from './WorkloadSummaryTab';
import { 
  GraduationCap, Users, Layers, BarChart3, 
  Loader2, RefreshCw, ShieldAlert, Copy, Check, X, Info,
  ChevronDown, ChevronUp, ArrowDown, FileDown
} from 'lucide-react';
import { downloadFullAcademicAssignmentPdf } from '../../utils/academicAssignmentPdfExport';

interface AcademicConfigMainProps {
  user: User;
  onConfigChanged?: () => void;
}

const FIRESTORE_RULES_SNIPPET = `rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // 1. Gestión de Docentes (CRUD completo: Registrar, Consultar, Editar y Eliminar)
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
    
    // 4. Asignaciones Académicas (Carga Docente y eliminación en cascada)
    match /teachingAssignments/{assignmentId} {
      allow read: if true;
      allow create, update, delete: if request.auth != null && request.auth.token.email == '${ADMIN_EMAIL}';
    }

    // 5. Configuración de Años Escolares (Año lectivo, niveles, grados y número de grupos)
    match /academicYears/{yearId} {
      allow read: if true;
      allow create, update, delete: if request.auth != null && request.auth.token.email == '${ADMIN_EMAIL}';
    }

    // 6. Configuración general del generador y límites de carga semanal
    match /academicConfig/{configId} {
      allow read: if true;
      allow create, update, delete: if request.auth != null && request.auth.token.email == '${ADMIN_EMAIL}';
    }

    // 7. Horarios por curso
    match /schedules/{course} {
      allow read: if true;
      allow create, update, delete: if request.auth != null && request.auth.token.email == '${ADMIN_EMAIL}';
    }

    // Fallback de seguridad institucional
    match /{document=**} {
      allow read: if true;
      allow create, update, delete: if request.auth != null && request.auth.token.email == '${ADMIN_EMAIL}';
    }
  }
}`;

export function AcademicConfigMain({ user, onConfigChanged }: AcademicConfigMainProps) {
  const [activeSubTab, setActiveSubTab] = useState<'teachers' | 'groups' | 'summary'>('teachers');
  
  // Initialize with persisted local data immediately for zero latency
  const [teachers, setTeachers] = useState<TeacherRecord[]>(() => getLocalAcademicData().teachers);
  const [groups, setGroups] = useState<SchoolGroupRecord[]>(() => getLocalAcademicData().groups);
  const [assignments, setAssignments] = useState<TeachingAssignmentRecord[]>(() => getLocalAcademicData().assignments);
  const [configSettings, setConfigSettings] = useState<AcademicConfigSettings>(() => getLocalAcademicData().config);

  const [loading, setLoading] = useState(false);
  const [seeding, setSeeding] = useState(false);
  const [isUsingLocalFallback, setIsUsingLocalFallback] = useState(false);
  const [showRulesModal, setShowRulesModal] = useState(false);
  const [copiedRules, setCopiedRules] = useState(false);
  const [teacherToEditFromSummary, setTeacherToEditFromSummary] = useState<TeacherRecord | null>(null);
  const [teacherToDeleteFromSummary, setTeacherToDeleteFromSummary] = useState<TeacherRecord | null>(null);
  const [isExportingFullPdf, setIsExportingFullPdf] = useState(false);

  // Export full academic assignment PDF
  const handleExportFullPdf = async () => {
    setIsExportingFullPdf(true);
    try {
      const yearConfig = getStoredSchoolYearConfig();
      await downloadFullAcademicAssignmentPdf({
        teachers,
        groups,
        assignments,
        maxWeeklyHours: configSettings.maxWeeklyHours || 24,
        schoolYear: yearConfig.year || new Date().getFullYear(),
        issuedBy: user.email || 'Administración Institucional'
      });
    } catch (error) {
      console.error('Error generating full assignment PDF:', error);
      alert('Error al exportar el PDF completo de asignación académica.');
    } finally {
      setIsExportingFullPdf(false);
    }
  };

  // Scroll Container Ref and State for Sliding Up/Down
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [showScrollTop, setShowScrollTop] = useState(false);

  const handleScroll = () => {
    if (scrollContainerRef.current) {
      const { scrollTop } = scrollContainerRef.current;
      setShowScrollTop(scrollTop > 150);
    }
  };

  const scrollToBottom = () => {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollTo({
        top: scrollContainerRef.current.scrollHeight,
        behavior: 'smooth'
      });
    }
  };

  const scrollToTop = () => {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollTo({
        top: 0,
        behavior: 'smooth'
      });
    }
  };

  // Sync state from local cache
  const reloadFromLocalCache = useCallback(() => {
    const cached = getLocalAcademicData();
    setTeachers(cached.teachers);
    setGroups(cached.groups);
    setAssignments(cached.assignments);
    setConfigSettings(cached.config);
  }, []);

  // Listen to local update events
  useEffect(() => {
    const handleLocalUpdate = () => {
      reloadFromLocalCache();
      if (onConfigChanged) onConfigChanged();
    };

    window.addEventListener('jp1_academic_data_updated', handleLocalUpdate);
    return () => {
      window.removeEventListener('jp1_academic_data_updated', handleLocalUpdate);
    };
  }, [reloadFromLocalCache, onConfigChanged]);

  // Firestore real-time subscribers with defensive error recovery
  useEffect(() => {
    let unsubTeachers = () => {};
    let unsubGroups = () => {};
    let unsubAssignments = () => {};
    let unsubConfig = () => {};

    const setupListeners = async () => {
      // 1. Initial check & seed if admin
      try {
        await seedInitialAcademicDataIfEmpty();
      } catch (err: any) {
        if (!isPermissionError(err)) {
          console.warn("Seeding initial check notice:", err?.message || err);
        }
      }

      // Check if user is authenticated with admin rights to attach cloud listeners
      if (!auth.currentUser) {
        setIsUsingLocalFallback(true);
        return;
      }

      // 1. Teachers listener
      try {
        const teachersQuery = query(collection(db, 'teachers'), orderBy('fullName'));
        unsubTeachers = onSnapshot(teachersQuery, (snap) => {
          const list: TeacherRecord[] = [];
          snap.forEach(docSnap => {
            list.push({ id: docSnap.id, ...docSnap.data() } as TeacherRecord);
          });
          setTeachers(list);
          saveLocalAcademicData({ teachers: list });
          if (onConfigChanged) onConfigChanged();
        }, (error) => {
          if (isPermissionError(error)) {
            setIsUsingLocalFallback(true);
          } else {
            console.warn("Docentes listener notice:", error.message);
          }
        });
      } catch (e) {
        setIsUsingLocalFallback(true);
      }

      // 2. Groups listener
      try {
        const groupsQuery = query(collection(db, 'schoolGroups'), orderBy('grade'), orderBy('section'));
        unsubGroups = onSnapshot(groupsQuery, (snap) => {
          const list: SchoolGroupRecord[] = [];
          snap.forEach(docSnap => {
            list.push({ id: docSnap.id, ...docSnap.data() } as SchoolGroupRecord);
          });
          if (list.length > 0) {
            setGroups(list);
            saveLocalAcademicData({ groups: list });
          } else {
            // If remote is empty, use local reconciled groups
            const local = getLocalAcademicData();
            if (local.groups.length > 0) {
              setGroups(local.groups);
            }
          }
          if (onConfigChanged) onConfigChanged();
        }, (error) => {
          if (isPermissionError(error)) {
            setIsUsingLocalFallback(true);
          } else {
            console.warn("Grupos listener notice:", error.message);
          }
        });
      } catch (e) {
        setIsUsingLocalFallback(true);
      }

      // 3. Assignments listener
      try {
        const assignmentsQuery = query(collection(db, 'teachingAssignments'));
        unsubAssignments = onSnapshot(assignmentsQuery, (snap) => {
          const list: TeachingAssignmentRecord[] = [];
          snap.forEach(docSnap => {
            list.push({ id: docSnap.id, ...docSnap.data() } as TeachingAssignmentRecord);
          });
          setAssignments(list);
          saveLocalAcademicData({ assignments: list });
          if (onConfigChanged) onConfigChanged();
        }, (error) => {
          if (isPermissionError(error)) {
            setIsUsingLocalFallback(true);
          } else {
            console.warn("Asignaciones listener notice:", error.message);
          }
        });
      } catch (e) {
        setIsUsingLocalFallback(true);
      }

      // 4. Config listener
      try {
        const configDocRef = doc(db, 'academicConfig', 'general');
        unsubConfig = onSnapshot(configDocRef, (snap) => {
          if (snap.exists()) {
            const data = snap.data();
            setConfigSettings(prev => ({
              ...prev,
              ...data
            }));
          }
        }, (error) => {
          if (isPermissionError(error)) {
            setIsUsingLocalFallback(true);
          } else {
            console.warn("Configuración listener notice:", error.message);
          }
        });
      } catch (e) {
        setIsUsingLocalFallback(true);
      }
    };

    setupListeners();

    return () => {
      unsubTeachers();
      unsubGroups();
      unsubAssignments();
      unsubConfig();
    };
  }, [onConfigChanged]);

  // Manual seed trigger
  const handleManualSeed = async () => {
    if (!confirm('¿Deseas restaurar los datos institucionales estándar del Colegio Juan Pablo I? Esto cargará la nómina de 20 docentes, grupos de 6° a 11° y sus asignaciones.')) return;
    setSeeding(true);
    try {
      await seedInitialAcademicDataIfEmpty();
      reloadFromLocalCache();
    } catch (e: any) {
      console.warn("Manual seed notice:", e?.message || e);
    } finally {
      setSeeding(false);
    }
  };

  const handleCopyRules = () => {
    navigator.clipboard.writeText(FIRESTORE_RULES_SNIPPET);
    setCopiedRules(true);
    setTimeout(() => setCopiedRules(false), 2500);
  };

  // Cross tab helper from summary
  const handleEditTeacherFromSummary = (teacher: TeacherRecord) => {
    setTeacherToEditFromSummary(teacher);
    setActiveSubTab('teachers');
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center p-16 text-slate-500 gap-3">
        <Loader2 className="w-8 h-8 animate-spin text-purple-600" />
        <p className="text-sm font-semibold">Cargando configuración académica...</p>
      </div>
    );
  }

  // Calculate high-level metrics
  const activeTeachersCount = teachers.filter(t => t.status === 'activo').length;
  const totalWeeklyHours = assignments.reduce((acc, curr) => acc + (Number(curr.weeklyHours) || 0), 0);

  return (
    <div 
      ref={scrollContainerRef}
      onScroll={handleScroll}
      className="flex-1 flex flex-col h-full overflow-y-auto custom-scrollbar bg-slate-50 relative"
    >
      <div className="p-4 sm:p-6 lg:p-8 space-y-6 max-w-7xl mx-auto w-full pb-28">
        {/* Informative Security & Persistence Notice Banner */}
      {isUsingLocalFallback && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-amber-900 shadow-xs">
          <div className="flex items-start gap-3">
            <Info className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
            <div className="text-xs space-y-0.5">
              <p className="font-bold text-amber-950">
                Almacenamiento Local Seguro Activo (Modo Autónomo)
              </p>
              <p className="text-amber-800">
                Toda la información de docentes, grupos y asignaciones funciona y se guarda de forma persistente en tu navegador. Para sincronizarla en la nube con todos tus dispositivos en Firestore, despliega las reglas de seguridad.
              </p>
            </div>
          </div>
          <button
            onClick={() => setShowRulesModal(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold rounded-lg transition-colors shrink-0 shadow-2xs"
          >
            <ShieldAlert className="w-3.5 h-3.5" />
            <span>Ver Reglas Firestore</span>
          </button>
        </div>
      )}

      {/* Configuration Header Card */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-purple-950 p-6 rounded-2xl text-white shadow-md border border-slate-800">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-purple-600/30 border border-purple-400/40 flex items-center justify-center text-purple-300">
              <GraduationCap className="w-7 h-7" />
            </div>
            <div>
              <h2 className="text-xl font-bold flex items-center gap-2">
                <span>Configuración Académica</span>
                <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-200 border border-purple-400/30">
                  Base Institucional
                </span>
              </h2>
              <p className="text-xs text-slate-300 mt-1 max-w-xl">
                Administra la planta docente, los grados y grupos escolares y la intensidad horaria. 
                Los cambios son persistentes e inmediatos y organizan la estructura académica del colegio.
              </p>
            </div>
          </div>

          {/* Quick Metrics */}
          <div className="flex items-center gap-3 flex-wrap">
            <div className="px-3.5 py-2 rounded-xl bg-white/10 backdrop-blur-xs border border-white/10 flex flex-col items-center min-w-[90px]">
              <span className="text-[10px] text-slate-300 uppercase font-bold">Docentes</span>
              <span className="text-lg font-black text-white">{activeTeachersCount} <span className="text-[11px] text-slate-400 font-normal">/ {teachers.length}</span></span>
            </div>

            <div className="px-3.5 py-2 rounded-xl bg-white/10 backdrop-blur-xs border border-white/10 flex flex-col items-center min-w-[90px]">
              <span className="text-[10px] text-slate-300 uppercase font-bold">Grupos</span>
              <span className="text-lg font-black text-white">{groups.length}</span>
            </div>

            <div className="px-3.5 py-2 rounded-xl bg-white/10 backdrop-blur-xs border border-white/10 flex flex-col items-center min-w-[90px]">
              <span className="text-[10px] text-slate-300 uppercase font-bold">Carga Total</span>
              <span className="text-lg font-black text-purple-300">{totalWeeklyHours} <span className="text-[11px] font-normal">hrs</span></span>
            </div>

            <button
              onClick={handleExportFullPdf}
              disabled={isExportingFullPdf}
              className="flex items-center gap-1.5 px-3.5 py-2 bg-white text-purple-950 hover:bg-purple-50 text-xs font-bold rounded-xl transition-all shadow-sm"
              title="Exportar documento oficial en PDF con la asignación académica completa"
            >
              {isExportingFullPdf ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin text-purple-700" />
              ) : (
                <FileDown className="w-3.5 h-3.5 text-purple-700" />
              )}
              <span>Exportar PDF Completo</span>
            </button>

            <button
              onClick={handleManualSeed}
              disabled={seeding}
              className="flex items-center gap-1.5 px-3 py-2 bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold rounded-xl transition-all shadow-sm"
              title="Restaurar nómina base Juan Pablo I"
            >
              {seeding ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
              <span>Restaurar Base</span>
            </button>
          </div>
        </div>
      </div>

      {/* 3 Main Tabs Nav */}
      <div className="flex border-b border-slate-200 gap-2 bg-white px-4 pt-2 rounded-t-2xl border-t border-x overflow-x-auto shadow-2xs">
        <button
          onClick={() => setActiveSubTab('teachers')}
          className={`flex items-center gap-2 px-5 py-3 text-sm font-bold border-b-2 transition-all shrink-0 ${
            activeSubTab === 'teachers'
              ? 'border-purple-600 text-purple-700'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Users className="w-4 h-4" />
          <span>1. Gestión de Docentes</span>
          <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-slate-100 text-slate-700">
            {teachers.length}
          </span>
        </button>

        <button
          onClick={() => setActiveSubTab('groups')}
          className={`flex items-center gap-2 px-5 py-3 text-sm font-bold border-b-2 transition-all shrink-0 ${
            activeSubTab === 'groups'
              ? 'border-purple-600 text-purple-700'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Layers className="w-4 h-4" />
          <span>2. Gestión de Grados y Grupos</span>
          <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-slate-100 text-slate-700">
            {groups.length}
          </span>
        </button>

        <button
          onClick={() => setActiveSubTab('summary')}
          className={`flex items-center gap-2 px-5 py-3 text-sm font-bold border-b-2 transition-all shrink-0 ${
            activeSubTab === 'summary'
              ? 'border-purple-600 text-purple-700'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <BarChart3 className="w-4 h-4" />
          <span>3. Resumen de Asignaciones Académicas</span>
          <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-purple-100 text-purple-800">
            {assignments.length} asignaciones
          </span>
        </button>
      </div>

      {/* Subtab Contents */}
      <div>
        {activeSubTab === 'teachers' && (
          <TeachersTab
            teachers={teachers}
            groups={groups}
            assignments={assignments}
            maxWeeklyHours={configSettings.maxWeeklyHours}
            initialTeacherToEdit={teacherToEditFromSummary}
            onClearInitialTeacherToEdit={() => setTeacherToEditFromSummary(null)}
            initialTeacherToDelete={teacherToDeleteFromSummary}
            onClearInitialTeacherToDelete={() => setTeacherToDeleteFromSummary(null)}
          />
        )}

        {activeSubTab === 'groups' && (
          <GroupsTab
            groups={groups}
            assignments={assignments}
            availableSections={configSettings.availableSections || DEFAULT_SECTIONS}
          />
        )}

        {activeSubTab === 'summary' && (
          <WorkloadSummaryTab
            teachers={teachers}
            groups={groups}
            assignments={assignments}
            maxWeeklyHours={configSettings.maxWeeklyHours}
            onEditTeacher={handleEditTeacherFromSummary}
            onDeleteTeacher={(teacher) => {
              setTeacherToDeleteFromSummary(teacher);
              setActiveSubTab('teachers');
            }}
            onUpdateMaxHours={(newMax) => {
              setConfigSettings(prev => ({ ...prev, maxWeeklyHours: newMax }));
            }}
          />
        )}
      </div>

      {/* Firestore Rules Helper Modal */}
      {showRulesModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full p-6 border border-slate-200 space-y-4 max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-purple-100 text-purple-700 rounded-xl">
                  <ShieldAlert className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-base">Reglas de Seguridad de Firestore</h3>
                  <p className="text-xs text-slate-500">Copia y pega estas reglas en tu consola de Firebase Firestore</p>
                </div>
              </div>
              <button 
                onClick={() => setShowRulesModal(false)}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="bg-slate-900 text-emerald-400 p-4 rounded-xl font-mono text-xs overflow-auto flex-1 select-all border border-slate-800">
              <pre>{FIRESTORE_RULES_SNIPPET}</pre>
            </div>

            <div className="flex items-center justify-between pt-2">
              <p className="text-xs text-slate-500">
                Archivo disponible en: <code className="bg-slate-100 px-1 py-0.5 rounded text-slate-700 font-mono">firestore.rules</code>
              </p>
              <div className="flex items-center gap-2">
                <button
                  onClick={handleCopyRules}
                  className="flex items-center gap-1.5 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold rounded-xl transition-all shadow-sm"
                >
                  {copiedRules ? <Check className="w-4 h-4 text-emerald-300" /> : <Copy className="w-4 h-4" />}
                  <span>{copiedRules ? '¡Copiado!' : 'Copiar Reglas'}</span>
                </button>
                <button
                  onClick={() => setShowRulesModal(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition-colors"
                >
                  Cerrar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      </div>

      {/* Floating Scroll / Slide Controls */}
      <div className="fixed bottom-6 right-6 z-40 flex items-center gap-2 bg-slate-900/90 text-white backdrop-blur-md p-1.5 rounded-full shadow-2xl border border-slate-700/80 print:hidden transition-all">
        {showScrollTop && (
          <button
            type="button"
            onClick={scrollToTop}
            className="flex items-center gap-1.5 px-3 py-2 rounded-full bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold transition-all shadow-xs"
            title="Subir al inicio de la página"
          >
            <ChevronUp className="w-4 h-4 text-purple-400" />
            <span className="hidden sm:inline">Subir</span>
          </button>
        )}
        
        <button
          type="button"
          onClick={scrollToBottom}
          className="flex items-center gap-1.5 px-3.5 py-2 rounded-full bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold transition-all shadow-md shadow-purple-900/40"
          title="Bajar al final de la página"
        >
          <ChevronDown className="w-4 h-4" />
          <span>Bajar</span>
        </button>
      </div>
    </div>
  );
}

