import React, { useState, useMemo } from 'react';
import { EngineSlot, validateSchedule, ScheduleConflict } from '../../utils/scheduleEngine';
import { AlertCircle, CheckCircle, UserX, Users, BookOpen, Clock, ShieldAlert, AlertTriangle, Filter } from 'lucide-react';

export function ValidationView({ schedule }: { schedule: EngineSlot[] }) {
  const [filterType, setFilterType] = useState<string>('all');

  // Single source of truth: validateSchedule
  const validation = useMemo(() => {
    if (!schedule || schedule.length === 0) return null;
    return validateSchedule(schedule);
  }, [schedule]);

  if (!validation) {
    return (
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-8 text-center text-slate-500">
        <Clock className="w-10 h-10 mx-auto text-slate-400 mb-2" />
        <p className="font-medium">No hay horario cargado para validar.</p>
        <p className="text-xs text-slate-400 mt-1">Genera un horario nuevo o selecciona un horario para auditarlo.</p>
      </div>
    );
  }

  const { metrics, totalClasses, compliancePercentage, valid } = validation;

  const filteredConflicts = useMemo(() => {
    if (filterType === 'all') return validation.allConflicts;
    if (filterType === 'teacher') return validation.teacherConflicts;
    if (filterType === 'group') return validation.groupConflicts;
    if (filterType === 'workload') return validation.workloadConflicts;
    if (filterType === 'availability') return validation.availabilityConflicts;
    if (filterType === 'blocked') return validation.blockedSlotConflicts;
    if (filterType === 'pedagogical') return validation.pedagogicalConflicts;
    return validation.allConflicts;
  }, [filterType, validation]);

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 space-y-6">
      {/* Header status */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200">
        <div>
          <h3 className="text-xl font-bold text-slate-800 flex items-center gap-2">
            {valid ? (
              <>
                <CheckCircle className="text-emerald-500 w-6 h-6" />
                <span>Horario 100% Válido y Sin Conflictos</span>
              </>
            ) : (
              <>
                <AlertCircle className="text-red-500 w-6 h-6" />
                <span>Auditoría de Horario: {validation.allConflicts.length} Observaciones</span>
              </>
            )}
          </h3>
          <p className="text-xs text-slate-500 mt-1">
            Motor de validación centralizado: cruces docentes/grupos, intensidad horaria, disponibilidad, franjas bloqueadas, máximo 2h/día, bloques pares (2h) e impares (2h + 1h), horas seguidas continuas, salida viernes 1:30 p. m. (10°/11°) y cero horas vacías.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <span className={`px-3 py-1.5 rounded-full text-xs font-semibold ${
            valid 
              ? 'bg-emerald-100 text-emerald-800 border border-emerald-200' 
              : 'bg-red-100 text-red-800 border border-red-200'
          }`}>
            {valid ? 'Aprobado para publicación' : `${metrics.errorCount} Error(es) crítico(s)`}
          </span>
        </div>
      </div>

      {/* Metrics Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Clases</p>
          <p className="text-2xl font-bold text-slate-800 mt-1">{totalClasses}</p>
          <p className="text-[11px] text-slate-400 mt-0.5">Bloques académicos</p>
        </div>

        <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Cumplimiento</p>
          <p className={`text-2xl font-bold mt-1 ${compliancePercentage === 100 ? 'text-emerald-600' : 'text-amber-600'}`}>
            {compliancePercentage}%
          </p>
          <p className="text-[11px] text-slate-400 mt-0.5">{validation.assignedHours} de {validation.totalRequiredHours}h</p>
        </div>

        <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Cruces</p>
          <p className={`text-2xl font-bold mt-1 ${(metrics.teacherConflictCount + metrics.groupConflictCount) === 0 ? 'text-emerald-600' : 'text-red-600'}`}>
            {metrics.teacherConflictCount + metrics.groupConflictCount}
          </p>
          <p className="text-[11px] text-slate-400 mt-0.5">Docentes y Salones</p>
        </div>

        <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Reglas Pedagógicas</p>
          <p className={`text-2xl font-bold mt-1 ${metrics.pedagogicalConflictCount === 0 ? 'text-emerald-600' : 'text-indigo-600'}`}>
            {metrics.pedagogicalConflictCount}
          </p>
          <p className="text-[11px] text-slate-400 mt-0.5">Máx 2h, continuas, sin huecos</p>
        </div>

        <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Bloqueos</p>
          <p className={`text-2xl font-bold mt-1 ${(metrics.availabilityConflictCount + metrics.blockedSlotConflictCount) === 0 ? 'text-emerald-600' : 'text-purple-600'}`}>
            {metrics.availabilityConflictCount + metrics.blockedSlotConflictCount}
          </p>
          <p className="text-[11px] text-slate-400 mt-0.5">Disponibilidad y Franjas</p>
        </div>
      </div>

      {/* Filter Tabs by Rule Category */}
      <div className="flex flex-wrap gap-2 pt-2 border-b border-slate-200 pb-3">
        <button
          onClick={() => setFilterType('all')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
            filterType === 'all' 
              ? 'bg-slate-900 text-white' 
              : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
          }`}
        >
          <Filter className="w-3.5 h-3.5" />
          Todos ({validation.allConflicts.length})
        </button>

        <button
          onClick={() => setFilterType('pedagogical')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
            filterType === 'pedagogical' 
              ? 'bg-indigo-600 text-white' 
              : metrics.pedagogicalConflictCount > 0
                ? 'bg-indigo-50 text-indigo-700 hover:bg-indigo-100 border border-indigo-200'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
          }`}
        >
          <CheckCircle className="w-3.5 h-3.5" />
          Reglas Pedagógicas ({metrics.pedagogicalConflictCount})
        </button>

        <button
          onClick={() => setFilterType('teacher')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
            filterType === 'teacher' 
              ? 'bg-red-600 text-white' 
              : metrics.teacherConflictCount > 0
                ? 'bg-red-50 text-red-700 hover:bg-red-100 border border-red-200'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
          }`}
        >
          <UserX className="w-3.5 h-3.5" />
          Cruces Docentes ({metrics.teacherConflictCount})
        </button>

        <button
          onClick={() => setFilterType('group')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
            filterType === 'group' 
              ? 'bg-amber-600 text-white' 
              : metrics.groupConflictCount > 0
                ? 'bg-amber-50 text-amber-700 hover:bg-amber-100 border border-amber-200'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
          }`}
        >
          <Users className="w-3.5 h-3.5" />
          Cruces Grupos ({metrics.groupConflictCount})
        </button>

        <button
          onClick={() => setFilterType('workload')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
            filterType === 'workload' 
              ? 'bg-blue-600 text-white' 
              : metrics.workloadConflictCount > 0
                ? 'bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-200'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
          }`}
        >
          <BookOpen className="w-3.5 h-3.5" />
          Intensidad Horaria ({metrics.workloadConflictCount})
        </button>

        <button
          onClick={() => setFilterType('availability')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
            filterType === 'availability' 
              ? 'bg-purple-600 text-white' 
              : metrics.availabilityConflictCount > 0
                ? 'bg-purple-50 text-purple-700 hover:bg-purple-100 border border-purple-200'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
          }`}
        >
          <ShieldAlert className="w-3.5 h-3.5" />
          Disponibilidad Docente ({metrics.availabilityConflictCount})
        </button>

        <button
          onClick={() => setFilterType('blocked')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
            filterType === 'blocked' 
              ? 'bg-orange-600 text-white' 
              : metrics.blockedSlotConflictCount > 0
                ? 'bg-orange-50 text-orange-700 hover:bg-orange-100 border border-orange-200'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
          }`}
        >
          <Clock className="w-3.5 h-3.5" />
          Horas Bloqueadas ({metrics.blockedSlotConflictCount})
        </button>
      </div>

      {/* Conflict List */}
      {filteredConflicts.length === 0 ? (
        <div className="p-8 text-center border border-dashed border-emerald-300 rounded-xl bg-emerald-50/50">
          <CheckCircle className="w-8 h-8 text-emerald-500 mx-auto mb-2" />
          <p className="font-semibold text-emerald-900 text-sm">Sin conflictos en esta categoría</p>
          <p className="text-xs text-emerald-700 mt-1">El horario cumple todos los criterios definidos para esta regla.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredConflicts.map((c: ScheduleConflict) => {
            const isError = c.severity === 'error';
            return (
              <div 
                key={c.id} 
                className={`p-4 rounded-xl border flex items-start gap-3 transition-colors ${
                  isError 
                    ? 'bg-red-50/70 border-red-200 text-red-900' 
                    : 'bg-amber-50/70 border-amber-200 text-amber-900'
                }`}
              >
                {isError ? (
                  <AlertCircle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
                ) : (
                  <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                )}

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <span className="font-bold text-sm">{c.title}</span>
                    <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${
                      isError ? 'bg-red-200 text-red-800' : 'bg-amber-200 text-amber-800'
                    }`}>
                      {c.type === 'max_daily_subject_hours' && 'Máx 2h/día'}
                      {c.type === 'non_consecutive_hours' && 'Horas cortadas'}
                      {c.type === 'parity_block_structure' && 'Bloques Par/Impar'}
                      {c.type === 'empty_gap_hour' && 'Hora vacía'}
                      {c.type === 'invalid_period' && 'Salida / Periodo no autorizado'}
                      {c.type === 'teacher_overlap' && 'Cruce docente'}
                      {c.type === 'group_overlap' && 'Cruce grupo'}
                      {c.type === 'workload_deficit' && 'Faltan horas'}
                      {c.type === 'workload_excess' && 'Exceso horas'}
                      {c.type === 'teacher_unavailability' && 'No disponible'}
                      {c.type === 'blocked_slot' && 'Hora bloqueada'}
                    </span>
                    {c.groupId && (
                      <span className="text-[11px] font-semibold bg-white/80 px-2 py-0.5 rounded border border-current/20">
                        Grupo: {c.groupId}
                      </span>
                    )}
                    {c.day && c.period && (
                      <span className="text-[11px] font-semibold bg-white/80 px-2 py-0.5 rounded border border-current/20">
                        Día {c.day} - Hora {c.period}
                      </span>
                    )}
                  </div>
                  <p className="text-xs leading-relaxed text-slate-700">{c.description}</p>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
