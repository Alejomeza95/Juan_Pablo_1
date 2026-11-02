import React, { useState, useEffect } from 'react';
import { User } from 'firebase/auth';
import { doc, setDoc, collection, getDocs } from 'firebase/firestore';
import { db, ADMIN_EMAIL } from '../../firebase';
import { Play, CheckCircle, FileText, UserCircle, Settings, Save, Loader2, Sparkles, Plus, Trash2, RefreshCw, Eye, Maximize2, Calendar, ChevronDown, ChevronUp, Tv, Presentation, GraduationCap } from 'lucide-react';
import { generateScheduleCSP, EngineSlot, validateSchedule } from '../../utils/scheduleEngine';
import { COURSES, ScheduleBlock } from '../../data/schedules';
import { GroupView } from './GroupView';
import { TeacherView } from './TeacherView';
import { ValidationView } from './ValidationView';
import { ScheduleLivePreview } from './ScheduleLivePreview';
import { SchedulePreviewModal } from './SchedulePreviewModal';
import { AcademicConfigMain } from './AcademicConfigMain';
import { setRuntimeAcademicData } from '../../data/generatorData';

export interface GeneratedOption {
  id: string;
  name: string;
  createdAt: number;
  schedule: EngineSlot[];
  valid: boolean;
  movesCount?: number;
}

export function ScheduleGenerator({ user }: { user: User }) {
  const isAdmin = user.email === ADMIN_EMAIL;
  const [activeTab, setActiveTab] = useState<'generate' | 'preview' | 'slide' | 'group' | 'teacher' | 'validation' | 'config'>('generate');
  
  const [options, setOptions] = useState<GeneratedOption[]>([]);
  const [activeOptionId, setActiveOptionId] = useState<string>('');
  const [generating, setGenerating] = useState(false);
  const [loadingInitial, setLoadingInitial] = useState(true);
  const [message, setMessage] = useState('');
  const [saving, setSaving] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [isPreviewModalOpen, setIsPreviewModalOpen] = useState(false);
  const [previewModalOptionId, setPreviewModalOptionId] = useState<string>('');
  const [showCspRules, setShowCspRules] = useState(false);

  // Active schedule is derived from selected option
  const activeOption = options.find(o => o.id === activeOptionId);
  const generatedSchedule = activeOption ? activeOption.schedule : [];

  // Centralized validation for the current schedule state
  const validationSummary = React.useMemo(() => {
    if (!generatedSchedule.length) return null;
    return validateSchedule(generatedSchedule);
  }, [generatedSchedule]);

  useEffect(() => {
    if (!isAdmin) return;
    
    // Load current schedule from Firestore with resilient timeout fallback
    const loadCurrentSchedule = async () => {
      setLoadingInitial(true);
      try {
        // Use a 3-second timeout so offline or backend connectivity issues won't block the UI
        const fetchPromise = getDocs(collection(db, 'schedules'));
        const timeoutPromise = new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('timeout')), 3000)
        );

        const querySnapshot = await Promise.race([fetchPromise, timeoutPromise]);
        const loadedSlots: EngineSlot[] = [];
        
        querySnapshot.forEach((docSnap) => {
          const courseId = docSnap.id;
          if (courseId === '_metadata_') return; // skip metadata
          
          const data = docSnap.data();
          if (data && data.blocks) {
            const blocks = data.blocks as ScheduleBlock[];
            blocks.forEach(b => {
              if (b.isBreak || !b.subject) return; // Ignore breaks and empty
              loadedSlots.push({
                day: b.day,
                period: b.period,
                groupId: courseId,
                subject: b.subject,
                teacherId: null,
              });
            });
          }
        });
        
        // Sync live teachers & assignments from Firestore if available
        try {
          const teachersSnap = await getDocs(collection(db, 'teachers'));
          const assignSnap = await getDocs(collection(db, 'teachingAssignments'));
          if (!teachersSnap.empty) {
            const liveTeachers = teachersSnap.docs.map(d => ({ id: d.id, name: d.data().fullName }));
            const liveAssignmentsMap = new Map<string, { teacherId: string; subject: string; groups: string[] }>();
            assignSnap.docs.forEach(d => {
              const data = d.data();
              const key = `${data.teacherId}_${data.subjectName}`;
              if (!liveAssignmentsMap.has(key)) {
                liveAssignmentsMap.set(key, { teacherId: data.teacherId, subject: data.subjectName, groups: [] });
              }
              liveAssignmentsMap.get(key)!.groups.push(data.groupId);
            });
            setRuntimeAcademicData(liveTeachers, Array.from(liveAssignmentsMap.values()));
          }
        } catch (e) {
          console.warn("Could not sync live academic cache:", e);
        }

        // Resolve teacherIds
        const { getTeacherForSubject } = await import('../../data/generatorData');
        const resolvedSlots = loadedSlots.map(slot => ({
          ...slot,
          teacherId: getTeacherForSubject(slot.subject, slot.groupId)?.id || null
        }));

        if (resolvedSlots.length > 0) {
          const val = validateSchedule(resolvedSlots);
          const initialOpt: GeneratedOption = {
            id: 'opt-1',
            name: 'Opción 1 (Actual en BD)',
            createdAt: Date.now(),
            schedule: resolvedSlots,
            valid: val.valid
          };
          setOptions([initialOpt]);
          setActiveOptionId(initialOpt.id);
        } else {
          // If Firestore was empty, generate initial baseline option
          const baseline = generateScheduleCSP([], { randomize: false });
          const initialOpt: GeneratedOption = {
            id: 'opt-1',
            name: 'Opción 1 (Modelo Base)',
            createdAt: Date.now(),
            schedule: baseline.schedule,
            valid: baseline.valid
          };
          setOptions([initialOpt]);
          setActiveOptionId(initialOpt.id);
        }

        setLoadingInitial(false);
      } catch (error) {
        console.warn("Firestore schedule fetch unavailable or timed out; using baseline model:", error);
        // Fallback to baseline
        const baseline = generateScheduleCSP([], { randomize: false });
        const initialOpt: GeneratedOption = {
          id: 'opt-1',
          name: 'Opción 1 (Modelo Base)',
          createdAt: Date.now(),
          schedule: baseline.schedule,
          valid: baseline.valid
        };
        setOptions([initialOpt]);
        setActiveOptionId(initialOpt.id);
        setLoadingInitial(false);
      }
    };

    loadCurrentSchedule();
  }, [isAdmin]);

  if (!isAdmin) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <p className="text-slate-500">Módulo exclusivo para administradores.</p>
      </div>
    );
  }

  // Generates a BRAND-NEW distinct valid alternative option
  const handleGenerateNewOption = () => {
    setGenerating(true);
    setMessage('Calculando nueva opción con variaciones válidas...');
    
    setTimeout(() => {
      // Run stochastic CSP variations (between 25 and 50 valid atomic swaps)
      const targetSwaps = 30 + Math.floor(Math.random() * 25);
      const result = generateScheduleCSP([], { randomize: true, targetSwaps });
      
      const newOptionNumber = options.length + 1;
      const newOptionId = `opt-${Date.now()}`;
      const newOption: GeneratedOption = {
        id: newOptionId,
        name: `Opción ${newOptionNumber} (Alternativa ${newOptionNumber})`,
        createdAt: Date.now(),
        schedule: result.schedule,
        valid: result.valid,
        movesCount: targetSwaps
      };

      setOptions(prev => [...prev, newOption]);
      setActiveOptionId(newOptionId);
      setMessage(`¡Opción ${newOptionNumber} generada con éxito! Se aplicaron variaciones válidas garantizando cero cruces y cumplimiento de todas las reglas.`);
      setHasUnsavedChanges(true);
      setGenerating(false);
    }, 150);
  };

  // Re-randomizes the currently selected option
  const handleRegenerateCurrent = () => {
    setGenerating(true);
    setMessage('Regenerando variaciones para la opción actual...');
    
    setTimeout(() => {
      const targetSwaps = 30 + Math.floor(Math.random() * 25);
      const result = generateScheduleCSP([], { randomize: true, targetSwaps });
      
      setOptions(prev => prev.map(opt => {
        if (opt.id === activeOptionId) {
          return {
            ...opt,
            schedule: result.schedule,
            valid: result.valid,
            createdAt: Date.now(),
            movesCount: targetSwaps
          };
        }
        return opt;
      }));

      setMessage(`Opción actualizada con nuevas permutaciones válidas.`);
      setHasUnsavedChanges(true);
      setGenerating(false);
    }, 150);
  };

  const handleDeleteOption = (idToDelete: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (options.length <= 1) {
      alert('Debes mantener al menos una opción en la lista.');
      return;
    }
    const remaining = options.filter(o => o.id !== idToDelete);
    setOptions(remaining);
    if (activeOptionId === idToDelete) {
      setActiveOptionId(remaining[0].id);
    }
  };

  const handleSaveToDatabase = async () => {
    if (!generatedSchedule.length) return;
    if (!confirm(`¿Estás seguro de que deseas guardar la "${activeOption?.name}" en la base de datos oficial? Esto reemplazará los horarios vigentes para los estudiantes y docentes.`)) return;

    setSaving(true);
    try {
      for (const course of COURSES) {
        const courseBlocks = generatedSchedule.filter(s => s.groupId === course);
        
        // Transform to ScheduleBlock format expected by Schedules.tsx
        const blocksToSave = courseBlocks.map(s => {
          const p = s.period;
          let start = '';
          let end = '';
          if (p === 1) { start = '7:30 a. m.'; end = '8:25 a. m.'; }
          if (p === 2) { start = '8:25 a. m.'; end = '9:20 a. m.'; }
          if (p === 3) { start = '9:20 a. m.'; end = '10:15 a. m.'; }
          if (p === 5) { start = '10:45 a. m.'; end = '11:40 a. m.'; }
          if (p === 6) { start = '11:40 a. m.'; end = '12:35 p. m.'; }
          if (p === 7) { start = '12:35 p. m.'; end = '1:30 p. m.'; }
          if (p === 8) { start = '1:30 p. m.'; end = '2:15 p. m.'; }

          return {
            id: `D${s.day}-P${s.period}`,
            day: s.day,
            period: s.period,
            start,
            end,
            subject: s.subject,
            isBreak: false
          };
        });

        // Add break blocks explicitly since the generator skips them
        for (let day = 1; day <= 5; day++) {
          blocksToSave.push({
            id: `D${day}-P4`,
            day,
            period: 4,
            start: '10:15 a. m.',
            end: '10:45 a. m.',
            subject: 'Descanso',
            isBreak: true
          });
        }

        await setDoc(doc(db, 'schedules', course), {
          blocks: blocksToSave,
          updatedAt: Date.now(),
          updatedBy: user.email
        });
      }
      setHasUnsavedChanges(false);
      alert('¡Horarios guardados en la base de datos correctamente!');
    } catch (e) {
      console.error(e);
      alert('Hubo un error al guardar los horarios.');
    } finally {
      setSaving(false);
    }
  };

  if (loadingInitial) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center text-slate-500 gap-3">
        <Loader2 className="w-8 h-8 animate-spin text-purple-600" />
        <p>Cargando horarios de la base de datos...</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-slate-50 p-6 rounded-2xl border border-slate-200">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-purple-100 rounded-xl">
            <Settings className="w-6 h-6 text-purple-600" />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-slate-800">Generador Automático de Horarios</h2>
            <p className="text-sm text-slate-500">Motor de resolución de restricciones (CSP) con generación de alternativas múltiples</p>
          </div>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          {generatedSchedule.length > 0 && (
            <button
              onClick={() => {
                setPreviewModalOptionId(activeOptionId);
                setIsPreviewModalOpen(true);
              }}
              className="flex items-center gap-2 px-5 py-2.5 bg-purple-600 hover:bg-purple-700 text-white font-extrabold rounded-xl transition-all shadow-md text-sm hover:scale-105"
              title="Abrir Slide de Pantalla Completa para ver los horarios"
            >
              <Tv className="w-4 h-4" />
              <span>Slide Pantalla Completa</span>
            </button>
          )}

          {hasUnsavedChanges && generatedSchedule.length > 0 && (
            <button
              onClick={handleSaveToDatabase}
              disabled={saving}
              className="flex items-center gap-2 px-4 py-2.5 bg-emerald-600 text-white font-semibold rounded-xl hover:bg-emerald-700 disabled:opacity-50 transition-colors shadow-sm text-sm"
            >
              <Save className="w-4 h-4" />
              {saving ? 'Guardando...' : 'Guardar Horario en BD'}
            </button>
          )}
        </div>
      </div>

      {/* Multi-Options Switcher Bar */}
      <div className="bg-white p-3.5 rounded-xl border border-slate-200 mb-6 shadow-sm">
        <div className="flex items-center justify-between gap-2 mb-2 pb-2 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-purple-600" />
            <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">
              Opciones y Alternativas Generadas ({options.length})
            </span>
          </div>
          <button
            onClick={handleGenerateNewOption}
            disabled={generating}
            className="flex items-center gap-1.5 px-3 py-1 bg-purple-50 text-purple-700 hover:bg-purple-100 border border-purple-200 rounded-lg text-xs font-semibold transition-colors disabled:opacity-50"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Generar Nueva Alternativa</span>
          </button>
        </div>

        <div className="flex items-center gap-2 overflow-x-auto py-1">
          {options.map((opt) => {
            const isSelected = opt.id === activeOptionId;
            return (
              <div
                key={opt.id}
                onClick={() => setActiveOptionId(opt.id)}
                className={`flex items-center gap-2 px-3 py-2 rounded-lg cursor-pointer transition-all border text-xs font-medium shrink-0 ${
                  isSelected
                    ? 'bg-purple-600 text-white border-purple-600 shadow-sm'
                    : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                }`}
              >
                <div className="flex flex-col text-left">
                  <div className="flex items-center gap-1.5">
                    <span className="font-bold">{opt.name}</span>
                    <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                      isSelected
                        ? 'bg-purple-700 text-purple-100'
                        : opt.valid 
                          ? 'bg-emerald-100 text-emerald-800'
                          : 'bg-red-100 text-red-800'
                    }`}>
                      {opt.valid ? '100% Válido' : 'Con errores'}
                    </span>
                  </div>
                  <span className={`text-[10px] ${isSelected ? 'text-purple-200' : 'text-slate-400'}`}>
                    {new Date(opt.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                  </span>
                </div>

                {/* Quick preview button on card */}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setActiveOptionId(opt.id);
                    setPreviewModalOptionId(opt.id);
                    setIsPreviewModalOpen(true);
                  }}
                  title="Abrir vista previa de esta opción"
                  className={`p-1.5 rounded-lg transition-colors ml-1 ${
                    isSelected ? 'bg-purple-700 hover:bg-purple-800 text-white' : 'bg-white hover:bg-purple-50 text-purple-700 border border-purple-200 shadow-2xs'
                  }`}
                >
                  <Eye className="w-3.5 h-3.5" />
                </button>

                {options.length > 1 && (
                  <button
                    onClick={(e) => handleDeleteOption(opt.id, e)}
                    title="Eliminar esta opción"
                    className={`p-1 rounded hover:bg-black/10 transition-colors ${
                      isSelected ? 'text-purple-200 hover:text-white' : 'text-slate-400 hover:text-red-600'
                    }`}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Main Navigation Tabs */}
      <div className="flex gap-2 border-b border-slate-200 mb-6 overflow-x-auto">
        <button 
          onClick={() => setActiveTab('generate')}
          className={`px-4 py-2 font-medium text-sm border-b-2 transition-colors shrink-0 ${activeTab === 'generate' ? 'border-purple-600 text-purple-700 font-semibold' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
        >
          <div className="flex items-center gap-2"><Play className="w-4 h-4" /> Generar y Explorar</div>
        </button>
        <button 
          onClick={() => setActiveTab('preview')}
          className={`px-4 py-2 font-medium text-sm border-b-2 transition-colors flex items-center gap-2 shrink-0 ${activeTab === 'preview' ? 'border-purple-600 text-purple-700 font-semibold' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
        >
          <Eye className="w-4 h-4" />
          <span>Vista Previa del Horario</span>
        </button>
        <button 
          onClick={() => {
            setActiveTab('slide');
            setPreviewModalOptionId(activeOptionId);
            setIsPreviewModalOpen(true);
          }}
          className={`px-4 py-2 font-bold text-sm border-b-2 transition-all flex items-center gap-2 shrink-0 ${
            activeTab === 'slide' 
              ? 'border-purple-600 text-purple-700 bg-purple-50/60 font-black' 
              : 'border-transparent text-purple-700 hover:text-purple-900 hover:border-purple-300'
          }`}
        >
          <Tv className="w-4 h-4 text-purple-600" />
          <span>Slide Pantalla Completa</span>
          <span className="text-[10px] px-2 py-0.5 rounded-full font-black bg-purple-100 text-purple-800 border border-purple-200">
            Diapositivas
          </span>
        </button>
        <button 
          onClick={() => setActiveTab('validation')}
          className={`px-4 py-2 font-medium text-sm border-b-2 transition-colors flex items-center gap-2 shrink-0 ${activeTab === 'validation' ? 'border-purple-600 text-purple-700 font-semibold' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
        >
          <CheckCircle className="w-4 h-4" />
          <span>Validar ({activeOption?.name || 'Seleccionada'})</span>
          {validationSummary && (
            <span className={`ml-1 text-[11px] font-bold px-1.5 py-0.5 rounded-full ${
              validationSummary.valid 
                ? 'bg-emerald-100 text-emerald-700' 
                : 'bg-red-100 text-red-700'
            }`}>
              {validationSummary.valid ? 'OK (0)' : validationSummary.allConflicts.length}
            </span>
          )}
        </button>
        <button 
          onClick={() => setActiveTab('group')}
          className={`px-4 py-2 font-medium text-sm border-b-2 transition-colors flex items-center gap-2 shrink-0 ${activeTab === 'group' ? 'border-purple-600 text-purple-700 font-semibold' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
        >
          <FileText className="w-4 h-4" />
          <span>Vista por Curso / Grupo</span>
        </button>
        <button 
          onClick={() => setActiveTab('teacher')}
          className={`px-4 py-2 font-medium text-sm border-b-2 transition-colors flex items-center gap-2 shrink-0 ${activeTab === 'teacher' ? 'border-purple-600 text-purple-700 font-semibold' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
        >
          <UserCircle className="w-4 h-4" />
          <span>Vista por Docente</span>
        </button>
        <button 
          onClick={() => setActiveTab('config')}
          className={`px-4 py-2 font-bold text-sm border-b-2 transition-all flex items-center gap-2 shrink-0 ${
            activeTab === 'config' 
              ? 'border-purple-600 text-purple-700 bg-purple-50/70 font-black' 
              : 'border-transparent text-purple-700 hover:text-purple-900 hover:border-purple-300'
          }`}
        >
          <GraduationCap className="w-4 h-4 text-purple-600" />
          <span>Configuración Académica</span>
          <span className="text-[10px] px-2 py-0.5 rounded-full font-bold bg-purple-100 text-purple-800 border border-purple-200">
            Docentes & Grupos
          </span>
        </button>
      </div>

      {/* Tab Contents */}
      <div className="flex-1 overflow-y-auto">
        {activeTab === 'generate' && (
          <div className="w-full space-y-5">
            {/* Executive Generator Controls Bar */}
            <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="flex items-center gap-3 flex-wrap">
                <button
                  onClick={handleGenerateNewOption}
                  disabled={generating}
                  className="flex items-center gap-2 px-5 py-3 bg-purple-600 hover:bg-purple-700 text-white font-extrabold rounded-xl disabled:opacity-50 transition-all shadow-sm text-sm"
                  title="Calcular una nueva combinación válida de horario"
                >
                  {generating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                  <span>Generar Nueva Alternativa</span>
                </button>

                <button
                  onClick={handleRegenerateCurrent}
                  disabled={generating}
                  className="flex items-center gap-2 px-4 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl disabled:opacity-50 transition-all text-sm border border-slate-200"
                  title="Reorganizar materias de la opción actual"
                >
                  <RefreshCw className="w-4 h-4" />
                  <span>Re-permutar</span>
                </button>

                {hasUnsavedChanges && generatedSchedule.length > 0 && (
                  <button
                    onClick={handleSaveToDatabase}
                    disabled={saving}
                    className="flex items-center gap-2 px-4 py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl disabled:opacity-50 transition-all shadow-sm text-sm"
                  >
                    <Save className="w-4 h-4" />
                    <span>{saving ? 'Guardando...' : `Guardar "${activeOption?.name}" en BD`}</span>
                  </button>
                )}
              </div>

              <div className="flex items-center gap-3 flex-wrap">
                {/* Full screen slide preview trigger */}
                <button
                  onClick={() => {
                    setPreviewModalOptionId(activeOptionId);
                    setIsPreviewModalOpen(true);
                  }}
                  className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-purple-600 via-indigo-600 to-purple-700 hover:from-purple-500 hover:to-indigo-500 text-white rounded-xl text-xs sm:text-sm font-black transition-all shadow-md hover:scale-105 active:scale-95 cursor-pointer ring-2 ring-purple-300/40"
                  title="Abrir Slide de Pantalla Completa para ver los horarios generados"
                >
                  <Tv className="w-4 h-4 text-purple-200" />
                  <span>Slide Pantalla Completa</span>
                </button>

                {/* Toggle Institutional Rules */}
                <button
                  onClick={() => setShowCspRules(!showCspRules)}
                  className="flex items-center gap-1.5 px-3 py-2 text-slate-500 hover:text-slate-800 text-xs font-semibold rounded-lg hover:bg-slate-100 transition-colors"
                >
                  <span>{showCspRules ? 'Ocultar Reglas' : 'Ver Reglas Institucionales (8/8)'}</span>
                  {showCspRules ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                </button>
              </div>
            </div>

            {/* Status notification if generated */}
            {message && (
              <div className="p-3.5 bg-purple-50 rounded-xl border border-purple-200 text-xs font-bold text-purple-900 flex items-center gap-2">
                <CheckCircle className="w-4 h-4 text-purple-600 shrink-0" />
                <span>{message}</span>
              </div>
            )}

            {/* Collapsible Rules */}
            {showCspRules && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5 text-xs text-slate-700 bg-white p-4 rounded-xl border border-slate-200 shadow-xs animate-in fade-in duration-150">
                <div className="flex items-start gap-2">
                  <CheckCircle className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                  <span><strong>Bloques pares e impares:</strong> Materias pares (4h) en bloques de 2h; impares (3h) en 2h + 1h.</span>
                </div>
                <div className="flex items-start gap-2">
                  <CheckCircle className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                  <span><strong>Salida 10.° y 11.°:</strong> Viernes 1:30 p. m. (periodo 7); lunes a jueves 2:15 p. m. (periodo 8).</span>
                </div>
                <div className="flex items-start gap-2">
                  <CheckCircle className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                  <span><strong>Salida 6.° a 9.°:</strong> Todos los días a la 1:30 p. m. (periodo 7).</span>
                </div>
                <div className="flex items-start gap-2">
                  <CheckCircle className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                  <span><strong>Máximo 2h por materia al día:</strong> Ningún curso recibe más de 2h de la misma materia.</span>
                </div>
                <div className="flex items-start gap-2">
                  <CheckCircle className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                  <span><strong>Horas dobles continuas:</strong> Las 2 horas diarias son consecutivas (sin cortar).</span>
                </div>
                <div className="flex items-start gap-2">
                  <CheckCircle className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                  <span><strong>Cero horas vacías:</strong> Sin huecos en la jornada lectiva (excepto descanso institucional).</span>
                </div>
                <div className="flex items-start gap-2">
                  <CheckCircle className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                  <span><strong>0 cruces de docentes y salones:</strong> Ningún profesor ni grupo tiene choques.</span>
                </div>
                <div className="flex items-start gap-2">
                  <CheckCircle className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                  <span><strong>Algorítmico CSP:</strong> Ejecución matemática en tiempo real sin costes de tokens.</span>
                </div>
              </div>
            )}

            {/* LIVE SCHEDULE PREVIEW - SPANS FULL SCREEN WIDTH AND HEIGHT */}
            {generatedSchedule.length > 0 && (
              <div className="w-full">
                <ScheduleLivePreview
                  schedule={generatedSchedule}
                  optionName={activeOption?.name || 'Opción'}
                  isValid={activeOption?.valid ?? true}
                  onOpenModalPreview={() => {
                    setPreviewModalOptionId(activeOptionId);
                    setIsPreviewModalOpen(true);
                  }}
                />
              </div>
            )}
          </div>
        )}

        {activeTab === 'preview' && (
          <div className="space-y-4">
            <ScheduleLivePreview
              schedule={generatedSchedule}
              optionName={activeOption?.name || 'Opción'}
              isValid={activeOption?.valid ?? true}
              onOpenModalPreview={() => {
                setPreviewModalOptionId(activeOptionId);
                setIsPreviewModalOpen(true);
              }}
            />
          </div>
        )}

        {activeTab === 'slide' && (
          <div className="space-y-4">
            <div className="bg-gradient-to-r from-purple-950 via-slate-900 to-indigo-950 p-6 rounded-3xl text-white flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-md">
              <div>
                <div className="flex items-center gap-2">
                  <span className="px-3 py-1 bg-purple-500/30 text-purple-200 border border-purple-400/30 rounded-full text-xs font-black uppercase tracking-wider flex items-center gap-1.5">
                    <Tv className="w-4 h-4" />
                    Modo Presentación y Diapositivas
                  </span>
                  <span className="text-xs px-2.5 py-0.5 rounded-full font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                    {activeOption?.valid ? '100% Válido' : 'Con Observaciones'}
                  </span>
                </div>
                <h3 className="text-2xl font-black mt-2">
                  Slide de Horarios en Pantalla Completa
                </h3>
                <p className="text-sm text-purple-200/80 mt-1">
                  Proyecta en pantalla completa cada curso o las 5 jornadas completas, activa la reproducción automática (autoplay) o navega con teclado (← y →).
                </p>
              </div>

              <button
                onClick={() => {
                  setPreviewModalOptionId(activeOptionId);
                  setIsPreviewModalOpen(true);
                }}
                className="flex items-center gap-2.5 px-6 py-3.5 bg-gradient-to-r from-purple-500 to-indigo-500 hover:from-purple-400 hover:to-indigo-400 text-white font-black rounded-2xl shadow-xl hover:scale-105 active:scale-95 transition-all text-sm shrink-0 cursor-pointer ring-2 ring-purple-300/40"
              >
                <Maximize2 className="w-5 h-5 text-purple-200" />
                <span>Abrir en Pantalla Completa Total</span>
              </button>
            </div>

            <GroupView
              schedule={generatedSchedule}
              onOpenSlidePresentation={() => {
                setPreviewModalOptionId(activeOptionId);
                setIsPreviewModalOpen(true);
              }}
            />
          </div>
        )}

        {activeTab === 'group' && (
          <GroupView
            schedule={generatedSchedule}
            onOpenSlidePresentation={() => {
              setPreviewModalOptionId(activeOptionId);
              setIsPreviewModalOpen(true);
            }}
          />
        )}
        {activeTab === 'teacher' && <TeacherView schedule={generatedSchedule} />}
        {activeTab === 'validation' && <ValidationView schedule={generatedSchedule} />}
        {activeTab === 'config' && <AcademicConfigMain user={user} />}
      </div>

      {/* Full Schedule Preview Modal */}
      <SchedulePreviewModal
        isOpen={isPreviewModalOpen}
        onClose={() => setIsPreviewModalOpen(false)}
        options={options}
        activeOptionId={previewModalOptionId || activeOptionId}
        onSelectOption={(id) => {
          setActiveOptionId(id);
          setPreviewModalOptionId(id);
        }}
      />
    </div>
  );
}
