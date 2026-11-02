import React, { useState, useMemo } from 'react';
import { 
  TeacherRecord, 
  SchoolGroupRecord, 
  TeachingAssignmentRecord 
} from '../../types';
import { 
  saveAcademicConfigSettings,
  getStoredSchoolYearConfig 
} from '../../utils/academicConfigService';
import { 
  AlertTriangle, CheckCircle, Search, Filter, ShieldCheck, 
  Sliders, User, Users, BookOpen, Clock, AlertCircle, Edit2, Trash2, Eye, X,
  FileDown, Loader2
} from 'lucide-react';
import {
  downloadFullAcademicAssignmentPdf,
  downloadTeacherAssignmentPdf
} from '../../utils/academicAssignmentPdfExport';

interface WorkloadSummaryTabProps {
  teachers: TeacherRecord[];
  groups: SchoolGroupRecord[];
  assignments: TeachingAssignmentRecord[];
  maxWeeklyHours: number;
  onEditTeacher: (teacher: TeacherRecord) => void;
  onDeleteTeacher: (teacher: TeacherRecord) => void;
  onUpdateMaxHours: (newMax: number) => void;
}

export function WorkloadSummaryTab({
  teachers,
  groups,
  assignments,
  maxWeeklyHours,
  onEditTeacher,
  onDeleteTeacher,
  onUpdateMaxHours
}: WorkloadSummaryTabProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [subjectFilter, setSubjectFilter] = useState('all');
  const [groupFilter, setGroupFilter] = useState('all');
  const [editingLimit, setEditingLimit] = useState(false);
  const [limitInput, setLimitInput] = useState(String(maxWeeklyHours));

  // Detail inspection modal
  const [selectedTeacherForDetail, setSelectedTeacherForDetail] = useState<TeacherRecord | null>(null);

  // PDF Export states
  const [isExportingFullPdf, setIsExportingFullPdf] = useState(false);
  const [exportingTeacherId, setExportingTeacherId] = useState<string | null>(null);

  const handleExportFullPdf = async () => {
    setIsExportingFullPdf(true);
    try {
      const yearConfig = getStoredSchoolYearConfig();
      await downloadFullAcademicAssignmentPdf({
        teachers,
        groups,
        assignments,
        maxWeeklyHours,
        schoolYear: yearConfig.year || new Date().getFullYear()
      });
    } catch (error) {
      console.error('Error generating full assignment PDF:', error);
      alert('Error al generar el PDF completo de asignación académica.');
    } finally {
      setIsExportingFullPdf(false);
    }
  };

  const handleExportTeacherPdf = async (teacher: TeacherRecord) => {
    setExportingTeacherId(teacher.id);
    try {
      const yearConfig = getStoredSchoolYearConfig();
      await downloadTeacherAssignmentPdf({
        teacher,
        groups,
        assignments,
        maxWeeklyHours,
        schoolYear: yearConfig.year || new Date().getFullYear()
      });
    } catch (error) {
      console.error('Error generating teacher assignment PDF:', error);
      alert(`Error al generar el PDF de asignación para ${teacher.fullName}.`);
    } finally {
      setExportingTeacherId(null);
    }
  };

  // Consolidated teacher workload data
  const teacherRows = useMemo(() => {
    return teachers.map((teacher) => {
      const teacherAssignments = assignments.filter(a => a.teacherId === teacher.id);
      const subjectsSet = new Set(teacherAssignments.map(a => a.subjectName));
      const groupsSet = new Set(teacherAssignments.map(a => a.groupId));
      const totalHours = teacherAssignments.reduce((acc, curr) => acc + (Number(curr.weeklyHours) || 0), 0);

      return {
        teacher,
        subjects: Array.from(subjectsSet),
        groups: Array.from(groupsSet),
        totalHours,
        assignments: teacherAssignments,
        isOverloaded: totalHours > maxWeeklyHours,
        hasNoAssignments: totalHours === 0
      };
    });
  }, [teachers, assignments, maxWeeklyHours]);

  // Unique subjects and groups for filtering
  const allSubjects = useMemo(() => {
    return Array.from(new Set(assignments.map(a => a.subjectName))).sort();
  }, [assignments]);

  const allGroupIds = useMemo(() => {
    return Array.from(new Set(groups.map(g => g.id))).sort();
  }, [groups]);

  // Filtered rows
  const filteredTeacherRows = useMemo(() => {
    return teacherRows.filter(row => {
      const matchesSearch = 
        row.teacher.fullName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        row.teacher.internalCode.toLowerCase().includes(searchTerm.toLowerCase());
      
      const matchesSubject = 
        subjectFilter === 'all' || row.subjects.includes(subjectFilter);

      const matchesGroup = 
        groupFilter === 'all' || row.groups.includes(groupFilter);

      return matchesSearch && matchesSubject && matchesGroup;
    });
  }, [teacherRows, searchTerm, subjectFilter, groupFilter]);

  // ==========================================
  // VALIDATIONS & AUDIT ENGINE
  // ==========================================
  const validationResults = useMemo(() => {
    const warnings: Array<{
      type: 'duplicate' | 'no_assignments' | 'empty_group' | 'invalid_hours' | 'overload' | 'conflict';
      title: string;
      description: string;
      severity: 'high' | 'medium' | 'info';
    }> = [];

    // 1. Docentes sin asignaciones
    const teachersWithoutAssignments = teacherRows.filter(r => r.hasNoAssignments && r.teacher.status === 'activo');
    if (teachersWithoutAssignments.length > 0) {
      warnings.push({
        type: 'no_assignments',
        title: `${teachersWithoutAssignments.length} Docente(s) activo(s) sin asignación académica`,
        description: `Los siguientes docentes tienen 0 horas asignadas: ${teachersWithoutAssignments.map(t => t.teacher.fullName).slice(0, 5).join(', ')}${teachersWithoutAssignments.length > 5 ? '...' : ''}`,
        severity: 'medium'
      });
    }

    // 2. Grupos sin docentes asignados
    const assignedGroupIds = new Set(assignments.map(a => a.groupId));
    const groupsWithoutTeachers = groups.filter(g => g.active && !assignedGroupIds.has(g.id));
    if (groupsWithoutTeachers.length > 0) {
      warnings.push({
        type: 'empty_group',
        title: `${groupsWithoutTeachers.length} Grupo(s) activo(s) sin asignaciones de docentes`,
        description: `Los grupos ${groupsWithoutTeachers.map(g => g.displayName).join(', ')} no tienen materias ni profesores asignados en el sistema.`,
        severity: 'high'
      });
    }

    // 3. Exceso de carga semanal
    const overloadedTeachers = teacherRows.filter(r => r.isOverloaded);
    if (overloadedTeachers.length > 0) {
      warnings.push({
        type: 'overload',
        title: `${overloadedTeachers.length} Docente(s) superan el límite de ${maxWeeklyHours} horas semanales`,
        description: `Docentes con sobrecarga: ${overloadedTeachers.map(t => `${t.teacher.fullName} (${t.totalHours}h)`).join(', ')}`,
        severity: 'medium'
      });
    }

    // 4. Intensidades horarias inválidas (<= 0)
    const invalidHours = assignments.filter(a => Number(a.weeklyHours) <= 0);
    if (invalidHours.length > 0) {
      warnings.push({
        type: 'invalid_hours',
        title: `${invalidHours.length} Asignación(es) con horas inválidas (menores o iguales a cero)`,
        description: `Existen registros con intensidades horarias no válidas que podrían afectar el generador de horarios.`,
        severity: 'high'
      });
    }

    // 5. Asignaturas de un grupo asignadas a más de un docente
    const groupSubjectMap = new Map<string, Array<{ teacherId: string; teacherName: string }>>();
    assignments.forEach(a => {
      const key = `${a.groupId}__${a.subjectName}`;
      const teacher = teachers.find(t => t.id === a.teacherId);
      if (!groupSubjectMap.has(key)) {
        groupSubjectMap.set(key, []);
      }
      groupSubjectMap.get(key)!.push({
        teacherId: a.teacherId,
        teacherName: teacher?.fullName || 'Desconocido'
      });
    });

    const sharedSubjects: string[] = [];
    groupSubjectMap.forEach((teacherList, key) => {
      const distinctTeachers = new Set(teacherList.map(t => t.teacherId));
      if (distinctTeachers.size > 1) {
        const [grp, subj] = key.split('__');
        sharedSubjects.push(`${subj} en ${grp} (${Array.from(distinctTeachers).map(id => teacherList.find(t => t.teacherId === id)?.teacherName).join(' vs ')})`);
      }
    });

    if (sharedSubjects.length > 0) {
      warnings.push({
        type: 'conflict',
        title: `${sharedSubjects.length} Conflicto(s) de asignación compartida en el mismo grupo`,
        description: `Misma materia asignada a múltiples docentes en: ${sharedSubjects.slice(0, 3).join('; ')}${sharedSubjects.length > 3 ? '...' : ''}`,
        severity: 'high'
      });
    }

    // 6. Asignaciones duplicadas exactas
    const exactDuplicates: string[] = [];
    const seenCombos = new Set<string>();
    assignments.forEach(a => {
      const key = `${a.teacherId}__${a.groupId}__${a.subjectName}`;
      if (seenCombos.has(key)) {
        exactDuplicates.push(`${a.subjectName} (${a.groupId})`);
      } else {
        seenCombos.add(key);
      }
    });

    if (exactDuplicates.length > 0) {
      warnings.push({
        type: 'duplicate',
        title: `${exactDuplicates.length} Asignación(es) exactamente duplicadas`,
        description: `Se detectaron registros idénticos para el mismo docente y grupo: ${Array.from(new Set(exactDuplicates)).join(', ')}`,
        severity: 'high'
      });
    }

    return warnings;
  }, [teacherRows, assignments, groups, teachers, maxWeeklyHours]);

  // Handle save max weekly hours
  const handleSaveMaxHours = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = parseInt(limitInput);
    if (!isNaN(parsed) && parsed >= 10 && parsed <= 60) {
      onUpdateMaxHours(parsed);
      setEditingLimit(false);
      try {
        await saveAcademicConfigSettings({ maxWeeklyHours: parsed });
      } catch (err) {
        console.warn(err);
      }
    }
  };

  return (
    <div className="space-y-6">
      {/* AUDIT & VALIDATION NOTIFICATIONS PANEL */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-4 bg-slate-900 text-white flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <ShieldCheck className="w-5 h-5 text-purple-400" />
            <div>
              <h3 className="font-bold text-sm">
                Diagnóstico de Integridad de la Carga Académica
              </h3>
              <p className="text-xs text-slate-300">
                Validaciones automáticas de consistencia para el generador de horarios
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className={`px-2.5 py-1 rounded-full text-xs font-black ${
              validationResults.length === 0 
                ? 'bg-emerald-500 text-white' 
                : 'bg-amber-500 text-white animate-pulse'
            }`}>
              {validationResults.length === 0 ? '0 Advertencias (Óptimo)' : `${validationResults.length} Advertencias`}
            </span>
          </div>
        </div>

        <div className="p-4 bg-slate-50/50">
          {validationResults.length === 0 ? (
            <div className="flex items-center gap-3 p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-800 text-xs font-semibold">
              <CheckCircle className="w-5 h-5 text-emerald-600 shrink-0" />
              <span>
                ¡Perfecto! Todas las asignaciones académicas son consistentes. No se encontraron cruces, duplicados ni grupos sin docente.
              </span>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {validationResults.map((warn, idx) => (
                <div 
                  key={idx}
                  className={`p-3.5 rounded-xl border flex items-start gap-3 text-xs ${
                    warn.severity === 'high'
                      ? 'bg-red-50/80 border-red-200 text-red-900'
                      : 'bg-amber-50/80 border-amber-200 text-amber-900'
                  }`}
                >
                  <AlertTriangle className={`w-4 h-4 shrink-0 mt-0.5 ${
                    warn.severity === 'high' ? 'text-red-600' : 'text-amber-600'
                  }`} />
                  <div className="space-y-1">
                    <p className="font-bold">{warn.title}</p>
                    <p className="text-slate-600 leading-relaxed text-[11px]">{warn.description}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* FILTER & CONFIG BAR */}
      <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        {/* Search & Filters */}
        <div className="flex items-center gap-3 flex-wrap flex-1">
          <div className="relative min-w-[220px]">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input 
              type="text"
              placeholder="Buscar docente..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-purple-500 focus:bg-white"
            />
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-slate-500">Materia:</span>
            <select
              value={subjectFilter}
              onChange={(e) => setSubjectFilter(e.target.value)}
              className="py-2 px-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-purple-500"
            >
              <option value="all">Todas las materias</option>
              {allSubjects.map((sub, i) => (
                <option key={i} value={sub}>{sub}</option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-slate-500">Grupo:</span>
            <select
              value={groupFilter}
              onChange={(e) => setGroupFilter(e.target.value)}
              className="py-2 px-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-purple-500"
            >
              <option value="all">Todos los grupos</option>
              {allGroupIds.map((grp, i) => (
                <option key={i} value={grp}>{grp}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="flex items-center gap-3 shrink-0 flex-wrap">
          {/* Export Full PDF Button */}
          <button
            onClick={handleExportFullPdf}
            disabled={isExportingFullPdf}
            className="flex items-center gap-2 px-3.5 py-2 bg-white border border-purple-200 hover:bg-purple-50 text-purple-700 font-bold rounded-xl transition-all shadow-2xs text-xs"
            title="Exportar PDF oficial del consolidado completo de asignación académica"
          >
            {isExportingFullPdf ? (
              <Loader2 className="w-4 h-4 animate-spin text-purple-600" />
            ) : (
              <FileDown className="w-4 h-4 text-purple-600" />
            )}
            <span>Exportar PDF Completo</span>
          </button>

          {/* Max Hours Configuration */}
          <div className="flex items-center gap-2 bg-purple-50 px-3.5 py-2 rounded-xl border border-purple-200 text-xs">
            <Clock className="w-4 h-4 text-purple-600" />
            <span className="font-bold text-purple-900">Máx. Horas Semanales:</span>
            {editingLimit ? (
              <form onSubmit={handleSaveMaxHours} className="flex items-center gap-1.5">
                <input
                  type="number"
                  min="10"
                  max="60"
                  value={limitInput}
                  onChange={(e) => setLimitInput(e.target.value)}
                  className="w-14 px-2 py-0.5 bg-white border border-purple-300 rounded text-center font-bold text-xs"
                />
                <button type="submit" className="px-2 py-0.5 bg-purple-600 text-white rounded text-[11px] font-bold">
                  OK
                </button>
              </form>
            ) : (
              <button 
                onClick={() => { setLimitInput(String(maxWeeklyHours)); setEditingLimit(true); }}
                className="font-extrabold text-purple-700 underline hover:text-purple-900"
                title="Clic para cambiar límite de horas"
              >
                {maxWeeklyHours} hrs
              </button>
            )}
          </div>
        </div>
      </div>

      {/* CONSOLIDATED WORKLOAD TABLE */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 border-b border-slate-200 text-xs font-bold text-slate-500 uppercase tracking-wider">
              <tr>
                <th className="px-5 py-4">Docente</th>
                <th className="px-5 py-4">Asignaturas</th>
                <th className="px-5 py-4">Grupos Asignados</th>
                <th className="px-4 py-4 text-center">Total Horas</th>
                <th className="px-3 py-4 text-center">PDF Asignación</th>
                <th className="px-4 py-4 text-center">Estado</th>
                <th className="px-5 py-4 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredTeacherRows.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-slate-400">
                    No se encontraron registros con los filtros seleccionados
                  </td>
                </tr>
              ) : (
                filteredTeacherRows.map((row) => {
                  return (
                    <tr key={row.teacher.id} className="hover:bg-slate-50/70 transition-colors">
                      {/* Teacher name & code */}
                      <td className="px-5 py-4 font-semibold text-slate-800">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center font-bold text-xs text-slate-600 shrink-0">
                            {row.teacher.fullName.slice(0, 2).toUpperCase()}
                          </div>
                          <div>
                            <span className="block font-bold text-slate-900">
                              {row.teacher.fullName}
                            </span>
                            <span className="text-[11px] font-mono text-slate-400">
                              {row.teacher.internalCode}
                            </span>
                          </div>
                        </div>
                      </td>

                      {/* Subjects */}
                      <td className="px-5 py-4">
                        <div className="flex flex-wrap gap-1 max-w-xs">
                          {row.subjects.length === 0 ? (
                            <span className="text-xs text-amber-600 italic">Sin materias</span>
                          ) : (
                            row.subjects.map((s, i) => (
                              <span 
                                key={i} 
                                className="px-2 py-0.5 bg-indigo-50 text-indigo-700 border border-indigo-100 rounded text-[11px] font-medium"
                              >
                                {s}
                              </span>
                            ))
                          )}
                        </div>
                      </td>

                      {/* Groups */}
                      <td className="px-5 py-4">
                        <div className="flex flex-wrap gap-1 max-w-xs">
                          {row.groups.length === 0 ? (
                            <span className="text-xs text-amber-600 italic">Sin grupos</span>
                          ) : (
                            row.groups.map((grp, i) => (
                              <span 
                                key={i} 
                                className="px-1.5 py-0.5 bg-slate-100 text-slate-700 border border-slate-200 rounded text-[11px] font-bold"
                              >
                                {grp}
                              </span>
                            ))
                          )}
                        </div>
                      </td>

                      {/* Total Weekly Hours */}
                      <td className="px-4 py-4 text-center">
                        <span className={`inline-block px-2.5 py-1 rounded-full text-xs font-bold border ${
                          row.isOverloaded 
                            ? 'bg-amber-100 text-amber-800 border-amber-300' 
                            : row.totalHours === 0 
                              ? 'bg-slate-100 text-slate-400 border-slate-200' 
                              : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                        }`}>
                          {row.totalHours} hrs / sem
                        </span>
                      </td>

                      {/* Exportar PDF de Asignación por Docente al lado de Horas Totales */}
                      <td className="px-3 py-4 text-center">
                        <button
                          onClick={() => handleExportTeacherPdf(row.teacher)}
                          disabled={exportingTeacherId === row.teacher.id}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-purple-50 hover:bg-purple-100 text-purple-700 hover:text-purple-900 border border-purple-200 rounded-xl text-xs font-bold transition-all shadow-2xs hover:scale-105 active:scale-95 disabled:opacity-50"
                          title={`Descargar acta oficial en PDF de asignación académica de ${row.teacher.fullName}`}
                        >
                          {exportingTeacherId === row.teacher.id ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin text-purple-600" />
                          ) : (
                            <FileDown className="w-3.5 h-3.5 text-purple-600" />
                          )}
                          <span>PDF Docente</span>
                        </button>
                      </td>

                      {/* Status */}
                      <td className="px-4 py-4 text-center">
                        <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold border ${
                          row.teacher.status === 'activo'
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                            : 'bg-slate-100 text-slate-500 border-slate-200'
                        }`}>
                          {row.teacher.status === 'activo' ? 'Activo' : 'Inactivo'}
                        </span>
                      </td>

                      {/* Actions: View, Edit, Export PDF (next to delete), Delete */}
                      <td className="px-5 py-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => setSelectedTeacherForDetail(row.teacher)}
                            className="p-1.5 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                            title="Ver desglose detallado de carga"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => onEditTeacher(row.teacher)}
                            className="p-1.5 text-slate-500 hover:text-purple-600 hover:bg-purple-50 rounded-lg transition-colors"
                            title="Editar docente"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>

                          {/* Exportar PDF individual discriminado por materia al lado del botón de eliminar */}
                          <button
                            onClick={() => handleExportTeacherPdf(row.teacher)}
                            disabled={exportingTeacherId === row.teacher.id}
                            className="p-1.5 text-rose-600 hover:text-rose-700 hover:bg-rose-50 rounded-lg transition-colors inline-flex items-center gap-1 group/pdf disabled:opacity-50"
                            title={`Exportar PDF con carga individual discriminada por materia (${row.teacher.fullName})`}
                          >
                            {exportingTeacherId === row.teacher.id ? (
                              <Loader2 className="w-4 h-4 animate-spin text-rose-600" />
                            ) : (
                              <FileDown className="w-4 h-4 group-hover/pdf:scale-110 transition-transform" />
                            )}
                          </button>

                          <button
                            onClick={() => onDeleteTeacher(row.teacher)}
                            className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                            title="Eliminar docente"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* DETAIL MODAL FOR SELECTED TEACHER */}
      {selectedTeacherForDetail && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-purple-100 text-purple-700 font-extrabold flex items-center justify-center text-sm border border-purple-200">
                  {selectedTeacherForDetail.fullName.slice(0, 2).toUpperCase()}
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-base">
                    {selectedTeacherForDetail.fullName}
                  </h3>
                  <span className="text-xs font-mono text-slate-400">
                    {selectedTeacherForDetail.internalCode} • Estado: {selectedTeacherForDetail.status}
                  </span>
                </div>
              </div>
              <button 
                onClick={() => setSelectedTeacherForDetail(null)}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3">
              <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                Desglose de Asignaciones Académicas
              </h4>

              <div className="max-h-60 overflow-y-auto space-y-2">
                {assignments
                  .filter(a => a.teacherId === selectedTeacherForDetail.id)
                  .map((a, i) => (
                    <div 
                      key={i}
                      className="p-3 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between text-xs"
                    >
                      <div>
                        <span className="font-bold text-slate-800 block text-sm">
                          {a.subjectName}
                        </span>
                        <span className="text-slate-500 font-semibold">
                          Grupo: {a.groupId}
                        </span>
                      </div>
                      <span className="px-2.5 py-1 bg-purple-100 text-purple-800 font-extrabold rounded-lg">
                        {a.weeklyHours} horas/sem
                      </span>
                    </div>
                  ))}
              </div>
            </div>

            <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
              <button
                type="button"
                onClick={() => handleExportTeacherPdf(selectedTeacherForDetail)}
                disabled={exportingTeacherId === selectedTeacherForDetail.id}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-purple-50 hover:bg-purple-100 text-purple-700 rounded-xl font-bold text-xs border border-purple-200 transition-colors disabled:opacity-50"
                title="Descargar PDF oficial discriminado por materia"
              >
                {exportingTeacherId === selectedTeacherForDetail.id ? (
                  <Loader2 className="w-4 h-4 animate-spin text-purple-600" />
                ) : (
                  <FileDown className="w-4 h-4 text-purple-600" />
                )}
                <span>Exportar PDF Carga</span>
              </button>

              <button
                type="button"
                onClick={() => setSelectedTeacherForDetail(null)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold text-xs transition-colors"
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
