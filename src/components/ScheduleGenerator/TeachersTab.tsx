import React, { useState, useMemo, useEffect } from 'react';
import { 
  TeacherRecord, 
  SchoolGroupRecord, 
  TeachingAssignmentRecord, 
  TeacherAssignmentItem 
} from '../../types';
import { 
  saveTeacherWithAssignments, 
  deleteTeacher, 
  getStoredSubjects,
  addCustomSubject,
  getStoredSchoolYearConfig
} from '../../utils/academicConfigService';
import { 
  Search, Plus, Edit2, Trash2, CheckCircle2, XCircle, 
  BookOpen, Users, Clock, AlertTriangle, Loader2, X, Filter, Save, UserCheck, UserX,
  Sparkles, Layers, Check, PlusCircle, FileDown
} from 'lucide-react';
import {
  downloadFullAcademicAssignmentPdf,
  downloadTeacherAssignmentPdf
} from '../../utils/academicAssignmentPdfExport';

interface TeachersTabProps {
  teachers: TeacherRecord[];
  groups: SchoolGroupRecord[];
  assignments: TeachingAssignmentRecord[];
  onRefresh?: () => void;
  maxWeeklyHours: number;
  initialTeacherToEdit?: TeacherRecord | null;
  onClearInitialTeacherToEdit?: () => void;
  initialTeacherToDelete?: TeacherRecord | null;
  onClearInitialTeacherToDelete?: () => void;
}

export function TeachersTab({ 
  teachers, 
  groups, 
  assignments, 
  maxWeeklyHours,
  initialTeacherToEdit,
  onClearInitialTeacherToEdit,
  initialTeacherToDelete,
  onClearInitialTeacherToDelete
}: TeachersTabProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'activo' | 'inactivo'>('all');
  const [subjectFilter, setSubjectFilter] = useState('all');
  
  // Available subjects catalog
  const [availableSubjects, setAvailableSubjects] = useState<string[]>(() => getStoredSubjects());

  // Modal states
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingTeacher, setEditingTeacher] = useState<TeacherRecord | null>(null);
  const [formData, setFormData] = useState({
    fullName: '',
    internalCode: '',
    status: 'activo' as 'activo' | 'inactivo'
  });
  const [formAssignments, setFormAssignments] = useState<TeacherAssignmentItem[]>([]);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');

  // Quick Subject / Batch Assignment Helper State
  const [showBatchAssignHelper, setShowBatchAssignHelper] = useState(false);
  const [batchSubject, setBatchSubject] = useState('');
  const [batchSelectedGroups, setBatchSelectedGroups] = useState<string[]>([]);
  const [batchHours, setBatchHours] = useState(4);
  const [newCustomSubjectInput, setNewCustomSubjectInput] = useState('');
  const [showNewSubjectInput, setShowNewSubjectInput] = useState(false);

  // Delete modal state & feedback
  const [deletingTeacher, setDeletingTeacher] = useState<TeacherRecord | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteSuccessMessage, setDeleteSuccessMessage] = useState('');

  // PDF Export states
  const [isExportingFullPdf, setIsExportingFullPdf] = useState(false);
  const [exportingTeacherId, setExportingTeacherId] = useState<string | null>(null);

  // Export full assignment PDF for all teachers
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

  // Export single teacher academic assignment PDF
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

  // Handle external triggers from Summary tab
  useEffect(() => {
    if (initialTeacherToEdit) {
      handleOpenEditModal(initialTeacherToEdit);
      onClearInitialTeacherToEdit?.();
    }
  }, [initialTeacherToEdit, onClearInitialTeacherToEdit]);

  useEffect(() => {
    if (initialTeacherToDelete) {
      setDeletingTeacher(initialTeacherToDelete);
      onClearInitialTeacherToDelete?.();
    }
  }, [initialTeacherToDelete, onClearInitialTeacherToDelete]);

  // Refresh subjects catalog on mount or when assignments change
  useEffect(() => {
    setAvailableSubjects(getStoredSubjects());
  }, [assignments]);

  // Derive workload map for each teacher
  const teacherWorkloadMap = useMemo(() => {
    const map = new Map<string, {
      subjects: Set<string>;
      groups: Set<string>;
      totalHours: number;
      items: TeachingAssignmentRecord[];
    }>();

    teachers.forEach(t => {
      map.set(t.id, {
        subjects: new Set<string>(),
        groups: new Set<string>(),
        totalHours: 0,
        items: []
      });
    });

    assignments.forEach(a => {
      const entry = map.get(a.teacherId);
      if (entry) {
        entry.subjects.add(a.subjectName);
        entry.groups.add(a.groupId);
        entry.totalHours += Number(a.weeklyHours || 0);
        entry.items.push(a);
      }
    });

    return map;
  }, [teachers, assignments]);

  // Group school groups by grade for organized selection in forms and batch tools
  const groupsByGrade = useMemo(() => {
    const map = new Map<string, { label: string; gradeNum: number; groups: SchoolGroupRecord[] }>();
    groups.forEach(g => {
      const label = g.gradeName || (g.grade >= 0 ? `Grado ${g.grade}°` : g.id);
      if (!map.has(label)) {
        map.set(label, { label, gradeNum: g.grade, groups: [] });
      }
      map.get(label)!.groups.push(g);
    });
    return Array.from(map.values()).sort((a, b) => a.gradeNum - b.gradeNum);
  }, [groups]);

  // Filtered teachers list
  const filteredTeachers = useMemo(() => {
    return teachers.filter(t => {
      const matchesSearch = 
        t.fullName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        t.internalCode.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesStatus = 
        statusFilter === 'all' || t.status === statusFilter;
      
      const teacherWorkload = teacherWorkloadMap.get(t.id);
      const matchesSubject = 
        subjectFilter === 'all' || 
        (teacherWorkload && teacherWorkload.subjects.has(subjectFilter));

      return matchesSearch && matchesStatus && matchesSubject;
    });
  }, [teachers, searchTerm, statusFilter, subjectFilter, teacherWorkloadMap]);

  // Distinct subjects oriented by this teacher in the modal form
  const teacherSelectedSubjects = useMemo(() => {
    const set = new Set<string>();
    formAssignments.forEach(a => {
      if (a.subjectName && a.subjectName.trim()) set.add(a.subjectName.trim());
    });
    return Array.from(set);
  }, [formAssignments]);

  // Open modal for new teacher
  const handleOpenNewModal = () => {
    setEditingTeacher(null);
    const nextCodeNumber = teachers.length + 1;
    const subjects = getStoredSubjects();
    setAvailableSubjects(subjects);
    const defaultSubject = subjects[0] || 'Matemáticas';
    const defaultGroup = groups[0]?.id || '6A';

    setFormData({
      fullName: '',
      internalCode: `DOC-${String(nextCodeNumber).padStart(2, '0')}`,
      status: 'activo'
    });
    setFormAssignments([
      { subjectName: defaultSubject, groupId: defaultGroup, weeklyHours: 4 }
    ]);
    setBatchSubject(defaultSubject);
    setBatchSelectedGroups([]);
    setShowBatchAssignHelper(false);
    setShowNewSubjectInput(false);
    setNewCustomSubjectInput('');
    setFormError('');
    setIsModalOpen(true);
  };

  // Open modal for editing teacher
  const handleOpenEditModal = (teacher: TeacherRecord) => {
    setEditingTeacher(teacher);
    const subjects = getStoredSubjects();
    setAvailableSubjects(subjects);
    const defaultSubject = subjects[0] || 'Matemáticas';

    setFormData({
      fullName: teacher.fullName,
      internalCode: teacher.internalCode,
      status: teacher.status
    });

    // Populate assignments of this teacher
    const existing = assignments
      .filter(a => a.teacherId === teacher.id)
      .map(a => ({
        id: a.id,
        subjectName: a.subjectName,
        groupId: a.groupId,
        weeklyHours: a.weeklyHours
      }));

    setFormAssignments(existing.length > 0 ? existing : [
      { subjectName: defaultSubject, groupId: groups[0]?.id || '6A', weeklyHours: 4 }
    ]);
    setBatchSubject(existing[0]?.subjectName || defaultSubject);
    setBatchSelectedGroups([]);
    setShowBatchAssignHelper(false);
    setShowNewSubjectInput(false);
    setNewCustomSubjectInput('');
    setFormError('');
    setIsModalOpen(true);
  };

  // Add individual assignment row
  const handleAddAssignmentRow = (prefilledSubject?: string) => {
    const subjects = availableSubjects.length > 0 ? availableSubjects : getStoredSubjects();
    const defaultSubject = prefilledSubject || subjects[0] || 'Matemáticas';
    const defaultGroup = groups[0]?.id || '6A';

    setFormAssignments(prev => [
      ...prev,
      { subjectName: defaultSubject, groupId: defaultGroup, weeklyHours: 3 }
    ]);
  };

  // Remove assignment row
  const handleRemoveAssignmentRow = (index: number) => {
    setFormAssignments(prev => prev.filter((_, idx) => idx !== index));
  };

  // Update assignment row
  const handleUpdateAssignmentRow = (index: number, field: keyof TeacherAssignmentItem, value: any) => {
    setFormAssignments(prev => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };
      return updated;
    });
  };

  // Remove all assignments for a specific subject
  const handleRemoveAllSubjectAssignments = (subjectToRemove: string) => {
    if (!confirm(`¿Deseas eliminar todas las asignaciones de "${subjectToRemove}" para este docente?`)) return;
    setFormAssignments(prev => prev.filter(a => a.subjectName !== subjectToRemove));
  };

  // Add a newly registered custom subject to catalog and select it
  const handleSaveAndSelectNewSubject = () => {
    const name = newCustomSubjectInput.trim();
    if (!name) return;
    const updated = addCustomSubject(name);
    setAvailableSubjects(updated);
    handleAddAssignmentRow(name);
    setNewCustomSubjectInput('');
    setShowNewSubjectInput(false);
  };

  // Batch assign: Add subject to multiple selected groups at once
  const handleApplyBatchAssignments = () => {
    if (!batchSubject.trim()) {
      setFormError('Por favor selecciona una asignatura para la asignación rápida.');
      return;
    }
    if (batchSelectedGroups.length === 0) {
      setFormError('Selecciona al menos un grupo escolar.');
      return;
    }

    const newRows: TeacherAssignmentItem[] = batchSelectedGroups.map(grpId => ({
      subjectName: batchSubject.trim(),
      groupId: grpId,
      weeklyHours: Number(batchHours) || 3
    }));

    // Avoid duplicates of same subject + group in the form
    const existingKeys = new Set(formAssignments.map(a => `${a.subjectName}_${a.groupId}`));
    const rowsToAdd = newRows.filter(r => !existingKeys.has(`${r.subjectName}_${r.groupId}`));

    if (rowsToAdd.length === 0) {
      setFormError('Las asignaciones seleccionadas ya se encuentran en la lista.');
      return;
    }

    setFormAssignments(prev => [...prev, ...rowsToAdd]);
    setBatchSelectedGroups([]);
    setShowBatchAssignHelper(false);
    setFormError('');
  };

  // Toggle group in batch helper
  const handleToggleBatchGroup = (groupId: string) => {
    setBatchSelectedGroups(prev => 
      prev.includes(groupId) ? prev.filter(id => id !== groupId) : [...prev, groupId]
    );
  };

  const handleSelectAllBatchGroups = () => {
    if (batchSelectedGroups.length === groups.length) {
      setBatchSelectedGroups([]);
    } else {
      setBatchSelectedGroups(groups.map(g => g.id));
    }
  };

  // Calculated values in modal form
  const calculatedModalSubjectsCount = useMemo(() => {
    const valid = formAssignments.filter(a => a.subjectName.trim() !== '');
    return new Set(valid.map(a => a.subjectName.trim())).size;
  }, [formAssignments]);

  const calculatedModalTotalHours = useMemo(() => {
    return formAssignments.reduce((acc, curr) => acc + (Number(curr.weeklyHours) || 0), 0);
  }, [formAssignments]);

  // Submit form
  const handleSubmitTeacher = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.fullName.trim()) {
      setFormError('El nombre completo del docente es obligatorio.');
      return;
    }

    // Validate assignment rows
    for (const a of formAssignments) {
      if (!a.subjectName.trim()) {
        setFormError('Todas las asignaciones deben tener una asignatura especificada.');
        return;
      }
      if (!a.groupId) {
        setFormError('Todas las asignaciones deben tener un grupo seleccionado.');
        return;
      }
      if (Number(a.weeklyHours) <= 0) {
        setFormError('La intensidad horaria semanal debe ser mayor a 0 horas.');
        return;
      }
    }

    setSaving(true);
    setFormError('');

    try {
      await saveTeacherWithAssignments({
        id: editingTeacher?.id,
        fullName: formData.fullName,
        internalCode: formData.internalCode,
        status: formData.status
      }, formAssignments);

      setIsModalOpen(false);
    } catch (err: any) {
      console.warn("Notice saving teacher:", err);
      setFormError('Error al procesar el docente: ' + (err.message || 'Error de permisos'));
    } finally {
      setSaving(false);
    }
  };

  // Delete teacher
  const handleConfirmDelete = async () => {
    if (!deletingTeacher) return;
    const teacherName = deletingTeacher.fullName;
    setIsDeleting(true);
    try {
      await deleteTeacher(deletingTeacher.id);
      setDeletingTeacher(null);
      setDeleteSuccessMessage(`Docente "${teacherName}" y sus asignaciones han sido eliminados correctamente.`);
      setTimeout(() => setDeleteSuccessMessage(''), 4500);
    } catch (err: any) {
      alert('Error al eliminar docente: ' + (err.message || 'Permiso denegado'));
    } finally {
      setIsDeleting(false);
    }
  };

  // Toggle active/inactive directly from table
  const handleToggleStatus = async (teacher: TeacherRecord) => {
    const nextStatus = teacher.status === 'activo' ? 'inactivo' : 'activo';
    try {
      await saveTeacherWithAssignments({
        id: teacher.id,
        fullName: teacher.fullName,
        internalCode: teacher.internalCode,
        status: nextStatus
      }, teacherWorkloadMap.get(teacher.id)?.items || []);
    } catch (err: any) {
      alert('Error al actualizar estado del docente: ' + err.message);
    }
  };

  return (
    <div className="space-y-6">
      {/* Delete Success Notification */}
      {deleteSuccessMessage && (
        <div className="p-3.5 bg-emerald-50 border border-emerald-300 rounded-xl text-emerald-900 text-xs sm:text-sm font-semibold flex items-center justify-between shadow-xs animate-fadeIn">
          <div className="flex items-center gap-2.5">
            <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
            <span>{deleteSuccessMessage}</span>
          </div>
          <button 
            onClick={() => setDeleteSuccessMessage('')}
            className="text-emerald-700 hover:text-emerald-900 text-xs font-bold p-1"
          >
            ✕
          </button>
        </div>
      )}

      {/* Top Action & Search Bar */}
      <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3 flex-1 flex-wrap">
          {/* Search */}
          <div className="relative flex-1 min-w-[220px]">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input 
              type="text"
              placeholder="Buscar docente por nombre o código..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 focus:bg-white transition-all"
            />
            {searchTerm && (
              <button 
                onClick={() => setSearchTerm('')} 
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Filter by Subject */}
          <div className="flex items-center gap-2">
            <BookOpen className="w-4 h-4 text-purple-600 shrink-0" />
            <select
              value={subjectFilter}
              onChange={(e) => setSubjectFilter(e.target.value)}
              className="py-2 px-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-purple-500"
            >
              <option value="all">Todas las asignaturas ({availableSubjects.length})</option>
              {availableSubjects.map((sub) => (
                <option key={sub} value={sub}>{sub}</option>
              ))}
            </select>
          </div>

          {/* Filter by Status */}
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-slate-400 shrink-0" />
            <select
              value={statusFilter}
              onChange={(e: any) => setStatusFilter(e.target.value)}
              className="py-2 px-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-purple-500"
            >
              <option value="all">Todos los estados</option>
              <option value="activo">Solo Activos</option>
              <option value="inactivo">Solo Inactivos</option>
            </select>
          </div>
        </div>

        <div className="flex items-center gap-2.5 shrink-0 flex-wrap">
          <button
            onClick={handleExportFullPdf}
            disabled={isExportingFullPdf}
            className="flex items-center gap-2 px-4 py-2.5 bg-white border border-purple-200 hover:bg-purple-50 hover:border-purple-300 text-purple-700 font-bold rounded-xl transition-all shadow-2xs text-xs"
            title="Exportar PDF oficial con el consolidado completo de asignación académica y carga docente institucional"
          >
            {isExportingFullPdf ? (
              <Loader2 className="w-4 h-4 animate-spin text-purple-600" />
            ) : (
              <FileDown className="w-4 h-4 text-purple-600" />
            )}
            <span>Exportar PDF Completo</span>
          </button>

          <button
            onClick={handleOpenNewModal}
            className="flex items-center gap-2 px-5 py-2.5 bg-purple-600 hover:bg-purple-700 text-white font-bold rounded-xl transition-all shadow-sm text-sm hover:scale-[1.02]"
          >
            <Plus className="w-4 h-4" />
            <span>+ Registrar Docente</span>
          </button>
        </div>
      </div>

      {/* Teachers Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 border-b border-slate-200 text-xs font-bold text-slate-500 uppercase tracking-wider">
              <tr>
                <th className="px-5 py-4">Docente</th>
                <th className="px-4 py-4">Código</th>
                <th className="px-4 py-4 text-center">N° Asig.</th>
                <th className="px-5 py-4">Asignaturas Orientadas</th>
                <th className="px-5 py-4">Grados / Grupos</th>
                <th className="px-4 py-4 text-center">Total Horas</th>
                <th className="px-3 py-4 text-center">PDF Asignación</th>
                <th className="px-4 py-4 text-center">Estado</th>
                <th className="px-5 py-4 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredTeachers.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-6 py-12 text-center text-slate-400">
                    <p className="font-medium text-base text-slate-500">No se encontraron docentes registrados</p>
                    <p className="text-xs text-slate-400 mt-1">
                      {searchTerm || subjectFilter !== 'all' ? 'Prueba ajustando los filtros de búsqueda' : 'Haz clic en "+ Registrar Docente" para comenzar'}
                    </p>
                  </td>
                </tr>
              ) : (
                filteredTeachers.map((teacher) => {
                  const workload = teacherWorkloadMap.get(teacher.id) || {
                    subjects: new Set<string>(),
                    groups: new Set<string>(),
                    totalHours: 0,
                    items: []
                  };
                  const subjectsList = Array.from(workload.subjects);
                  const groupsList = Array.from(workload.groups);
                  const isOverloaded = workload.totalHours > maxWeeklyHours;

                  return (
                    <tr key={teacher.id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="px-5 py-4 font-semibold text-slate-800">
                        <div className="flex items-center gap-3">
                          <div className={`w-9 h-9 rounded-full flex items-center justify-center font-bold text-xs shrink-0 ${
                            teacher.status === 'activo'
                              ? 'bg-purple-100 text-purple-700 border border-purple-200' 
                              : 'bg-slate-100 text-slate-400 border border-slate-200'
                          }`}>
                            {teacher.fullName.slice(0, 2).toUpperCase()}
                          </div>
                          <div>
                            <p className="font-bold text-slate-900 leading-tight">{teacher.fullName}</p>
                            <p className="text-[11px] text-slate-400 font-normal">
                              {workload.items.length} asignaciones configuradas
                            </p>
                          </div>
                        </div>
                      </td>

                      <td className="px-4 py-4 text-xs font-mono font-bold text-slate-600">
                        <span className="px-2 py-0.5 bg-slate-100 rounded-md border border-slate-200">
                          {teacher.internalCode}
                        </span>
                      </td>

                      <td className="px-4 py-4 text-center">
                        <span className="inline-flex items-center justify-center px-2 py-1 rounded-full text-xs font-bold bg-purple-50 text-purple-700 border border-purple-100">
                          {subjectsList.length}
                        </span>
                      </td>

                      <td className="px-5 py-4">
                        <div className="flex flex-wrap gap-1.5 max-w-xs">
                          {subjectsList.length === 0 ? (
                            <span className="text-xs text-slate-400 italic">Sin asignaturas</span>
                          ) : (
                            subjectsList.map((sub, idx) => (
                              <span 
                                key={idx}
                                className="px-2 py-0.5 rounded-md text-[11px] font-semibold bg-indigo-50 text-indigo-700 border border-indigo-100 flex items-center gap-1"
                              >
                                <BookOpen className="w-2.5 h-2.5 text-indigo-500" />
                                {sub}
                              </span>
                            ))
                          )}
                        </div>
                      </td>

                      <td className="px-5 py-4">
                        <div className="flex flex-wrap gap-1 max-w-xs">
                          {groupsList.length === 0 ? (
                            <span className="text-xs text-slate-400 italic">Sin grupos</span>
                          ) : (
                            groupsList.map((grpId, idx) => {
                              const groupObj = groups.find(g => g.id === grpId);
                              const label = groupObj?.displayName || grpId;
                              return (
                                <span 
                                  key={idx}
                                  className="px-2 py-0.5 rounded-md text-[11px] font-bold bg-slate-100 text-slate-700 border border-slate-200"
                                  title={groupObj ? `${groupObj.displayName} (${groupObj.gradeName})` : grpId}
                                >
                                  {label}
                                </span>
                              );
                            })
                          )}
                        </div>
                      </td>

                      <td className="px-4 py-4 text-center">
                        <div className="flex flex-col items-center">
                          <span className={`px-2.5 py-1 rounded-lg text-xs font-black ${
                            isOverloaded 
                              ? 'bg-red-100 text-red-700 border border-red-200' 
                              : workload.totalHours === 0 
                              ? 'bg-amber-100 text-amber-800 border border-amber-200'
                              : 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                          }`}>
                            {workload.totalHours} hrs/sem
                          </span>
                          {isOverloaded && (
                            <span className="text-[10px] text-red-600 font-bold mt-0.5">
                              Excede límite ({maxWeeklyHours}h)
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Exportar PDF de Asignación por Docente al lado de Horas Totales */}
                      <td className="px-3 py-4 text-center">
                        <button
                          onClick={() => handleExportTeacherPdf(teacher)}
                          disabled={exportingTeacherId === teacher.id}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-purple-50 hover:bg-purple-100 text-purple-700 hover:text-purple-900 border border-purple-200 rounded-xl text-xs font-bold transition-all shadow-2xs hover:scale-105 active:scale-95 disabled:opacity-50"
                          title={`Descargar acta oficial en PDF de asignación académica de ${teacher.fullName}`}
                        >
                          {exportingTeacherId === teacher.id ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin text-purple-600" />
                          ) : (
                            <FileDown className="w-3.5 h-3.5 text-purple-600" />
                          )}
                          <span>PDF Docente</span>
                        </button>
                      </td>

                      <td className="px-4 py-4 text-center">
                        <button
                          onClick={() => handleToggleStatus(teacher)}
                          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold transition-all ${
                            teacher.status === 'activo'
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100'
                              : 'bg-slate-100 text-slate-500 border border-slate-200 hover:bg-slate-200'
                          }`}
                          title="Haz clic para cambiar estado activo / inactivo"
                        >
                          {teacher.status === 'activo' ? (
                            <>
                              <UserCheck className="w-3.5 h-3.5 text-emerald-600" />
                              <span>Activo</span>
                            </>
                          ) : (
                            <>
                              <UserX className="w-3.5 h-3.5 text-slate-400" />
                              <span>Inactivo</span>
                            </>
                          )}
                        </button>
                      </td>

                      <td className="px-5 py-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => handleOpenEditModal(teacher)}
                            className="p-1.5 text-slate-600 hover:text-purple-600 hover:bg-purple-50 rounded-lg transition-colors"
                            title="Editar docente y asignaciones"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          
                          {/* Exportar PDF individual discriminado por materia al lado del botón de eliminar */}
                          <button
                            onClick={() => handleExportTeacherPdf(teacher)}
                            disabled={exportingTeacherId === teacher.id}
                            className="p-1.5 text-rose-600 hover:text-rose-700 hover:bg-rose-50 rounded-lg transition-colors inline-flex items-center gap-1 group/pdf disabled:opacity-50"
                            title={`Exportar PDF de carga individual discriminada por materia (${teacher.fullName})`}
                          >
                            {exportingTeacherId === teacher.id ? (
                              <Loader2 className="w-4 h-4 animate-spin text-rose-600" />
                            ) : (
                              <FileDown className="w-4 h-4 group-hover/pdf:scale-110 transition-transform" />
                            )}
                          </button>

                          <button
                            onClick={() => setDeletingTeacher(teacher)}
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

      {/* MODAL: REGISTRAR / EDITAR DOCENTE CON SELECCIÓN DE ASIGNATURAS */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-4xl w-full shadow-2xl border border-slate-200 overflow-hidden my-8 flex flex-col max-h-[92vh]">
            {/* Modal Header */}
            <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between shrink-0">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-purple-600 rounded-lg">
                  <Users className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h3 className="font-bold text-base">
                    {editingTeacher ? 'Editar Docente y Asignación Académica' : 'Registrar Nuevo Docente'}
                  </h3>
                  <p className="text-xs text-slate-300">
                    Selecciona las asignaturas que orienta y los grupos escolares a su cargo
                  </p>
                </div>
              </div>
              <button 
                onClick={() => setIsModalOpen(false)}
                className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Form Body */}
            <form onSubmit={handleSubmitTeacher} className="flex-1 overflow-y-auto p-6 space-y-6">
              {formError && (
                <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-xs rounded-xl flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  <span>{formError}</span>
                </div>
              )}

              {/* Información básica */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="sm:col-span-2 space-y-1.5">
                  <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                    Nombre completo del docente <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Ej. Carlos Martínez"
                    value={formData.fullName}
                    onChange={(e) => setFormData(prev => ({ ...prev, fullName: e.target.value }))}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-purple-500 focus:bg-white"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                    Código Interno
                  </label>
                  <input
                    type="text"
                    placeholder="Ej. DOC-01"
                    value={formData.internalCode}
                    onChange={(e) => setFormData(prev => ({ ...prev, internalCode: e.target.value }))}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-mono focus:outline-none focus:ring-2 focus:ring-purple-500 focus:bg-white"
                  />
                </div>
              </div>

              <div className="flex items-center gap-4 p-3 bg-slate-50 rounded-xl border border-slate-200">
                <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                  Estado del Docente:
                </label>
                <div className="flex items-center gap-4">
                  <label className="flex items-center gap-2 text-sm font-medium cursor-pointer">
                    <input
                      type="radio"
                      name="status"
                      value="activo"
                      checked={formData.status === 'activo'}
                      onChange={() => setFormData(prev => ({ ...prev, status: 'activo' }))}
                      className="text-purple-600 focus:ring-purple-500"
                    />
                    <span className="text-emerald-700 font-bold">Activo</span>
                  </label>

                  <label className="flex items-center gap-2 text-sm font-medium cursor-pointer">
                    <input
                      type="radio"
                      name="status"
                      value="inactivo"
                      checked={formData.status === 'inactivo'}
                      onChange={() => setFormData(prev => ({ ...prev, status: 'inactivo' }))}
                      className="text-purple-600 focus:ring-purple-500"
                    />
                    <span className="text-slate-500 font-bold">Inactivo</span>
                  </label>
                </div>
              </div>

              {/* 1. SELECCIÓN DE ASIGNATURAS ORIENTADAS (BARRA INTERACTIVA) */}
              <div className="bg-purple-50/50 border border-purple-100 rounded-2xl p-4 space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <BookOpen className="w-4 h-4 text-purple-700" />
                    <h4 className="text-xs font-bold text-purple-950 uppercase tracking-wider">
                      Asignaturas que orienta este docente ({teacherSelectedSubjects.length})
                    </h4>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setShowBatchAssignHelper(prev => !prev)}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                        showBatchAssignHelper 
                          ? 'bg-purple-700 text-white' 
                          : 'bg-white text-purple-700 border border-purple-200 hover:bg-purple-50'
                      }`}
                    >
                      <Sparkles className="w-3.5 h-3.5" />
                      <span>{showBatchAssignHelper ? 'Ocultar Asignación Rápida' : '⚡ Asignar a Varios Grupos'}</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setShowNewSubjectInput(prev => !prev)}
                      className="flex items-center gap-1 px-2.5 py-1.5 bg-white text-slate-700 border border-slate-200 hover:bg-slate-50 rounded-lg text-xs font-semibold"
                      title="Agregar nueva asignatura al catálogo institucional"
                    >
                      <PlusCircle className="w-3.5 h-3.5 text-purple-600" />
                      <span>+ Nueva Asignatura</span>
                    </button>
                  </div>
                </div>

                {/* Sub-Panel: Add Custom Subject to Catalog */}
                {showNewSubjectInput && (
                  <div className="p-3 bg-white rounded-xl border border-purple-200 shadow-xs flex items-center gap-2">
                    <input
                      type="text"
                      placeholder="Nombre de la nueva asignatura (ej. Robótica, Teatro)..."
                      value={newCustomSubjectInput}
                      onChange={(e) => setNewCustomSubjectInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          handleSaveAndSelectNewSubject();
                        }
                      }}
                      className="flex-1 px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-purple-500"
                    />
                    <button
                      type="button"
                      onClick={handleSaveAndSelectNewSubject}
                      className="px-3 py-1.5 bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs rounded-lg transition-colors"
                    >
                      Guardar y Asignar
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowNewSubjectInput(false)}
                      className="p-1.5 text-slate-400 hover:text-slate-600"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                )}

                {/* Badges of selected subjects */}
                <div className="flex flex-wrap gap-2 items-center">
                  {teacherSelectedSubjects.length === 0 ? (
                    <span className="text-xs text-slate-400 italic">
                      Aún no has seleccionado asignaturas. Escoge del catálogo abajo o usa la asignación rápida.
                    </span>
                  ) : (
                    teacherSelectedSubjects.map((sub) => {
                      const subjectHours = formAssignments
                        .filter(a => a.subjectName === sub)
                        .reduce((sum, curr) => sum + (Number(curr.weeklyHours) || 0), 0);
                      const groupCount = formAssignments.filter(a => a.subjectName === sub).length;

                      return (
                        <div
                          key={sub}
                          className="group inline-flex items-center gap-2 px-3 py-1 bg-white border border-purple-200 rounded-xl text-xs font-bold text-purple-900 shadow-2xs"
                        >
                          <BookOpen className="w-3 h-3 text-purple-600" />
                          <span>{sub}</span>
                          <span className="px-1.5 py-0.5 rounded-md bg-purple-100 text-purple-800 text-[10px]">
                            {groupCount} {groupCount === 1 ? 'grupo' : 'grupos'} ({subjectHours}h)
                          </span>
                          <button
                            type="button"
                            onClick={() => handleRemoveAllSubjectAssignments(sub)}
                            className="text-slate-400 hover:text-red-600 p-0.5 rounded-full hover:bg-red-50 transition-colors"
                            title={`Eliminar todas las asignaciones de ${sub}`}
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </div>
                      );
                    })
                  )}

                  {/* Quick-add subject dropdown */}
                  <div className="relative inline-block">
                    <select
                      value=""
                      onChange={(e) => {
                        const selected = e.target.value;
                        if (selected === '__NEW__') {
                          setShowNewSubjectInput(true);
                        } else if (selected) {
                          handleAddAssignmentRow(selected);
                        }
                      }}
                      className="px-2.5 py-1 bg-white border border-dashed border-purple-300 hover:border-purple-500 rounded-xl text-xs font-bold text-purple-700 cursor-pointer focus:outline-none focus:ring-2 focus:ring-purple-400 transition-colors"
                    >
                      <option value="">+ Escoger otra asignatura del catálogo...</option>
                      {availableSubjects.map((sub) => (
                        <option key={sub} value={sub}>
                          {sub} {teacherSelectedSubjects.includes(sub) ? '✓' : ''}
                        </option>
                      ))}
                      <option value="__NEW__">+ Crear nueva asignatura personalizada...</option>
                    </select>
                  </div>
                </div>

                {/* Sub-Panel: Batch Multi-Group Assignment Helper */}
                {showBatchAssignHelper && (
                  <div className="p-4 bg-white rounded-xl border border-purple-200 shadow-sm space-y-3 mt-3 animate-in fade-in duration-200">
                    <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                      <div className="flex items-center gap-2">
                        <Sparkles className="w-4 h-4 text-purple-600" />
                        <span className="text-xs font-bold text-slate-800 uppercase">
                          Asignación simultánea a múltiples grupos
                        </span>
                      </div>
                      <span className="text-[11px] text-slate-500">
                        Añade una asignatura a varios cursos con un solo clic
                      </span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-end">
                      {/* Pick subject */}
                      <div className="sm:col-span-2 space-y-1">
                        <label className="text-[11px] font-bold text-slate-700 uppercase">
                          1. Asignatura a orientar:
                        </label>
                        <select
                          value={batchSubject}
                          onChange={(e) => setBatchSubject(e.target.value)}
                          className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold focus:outline-none focus:ring-2 focus:ring-purple-500"
                        >
                          {availableSubjects.map((sub) => (
                            <option key={sub} value={sub}>{sub}</option>
                          ))}
                        </select>
                      </div>

                      {/* Pick hours */}
                      <div className="space-y-1">
                        <label className="text-[11px] font-bold text-slate-700 uppercase">
                          2. Horas por grupo:
                        </label>
                        <div className="flex items-center gap-1.5">
                          <input
                            type="number"
                            min="1"
                            max="20"
                            value={batchHours}
                            onChange={(e) => setBatchHours(Math.max(1, parseInt(e.target.value) || 1))}
                            className="w-full px-2.5 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold text-center focus:outline-none focus:ring-2 focus:ring-purple-500"
                          />
                          <span className="text-xs text-slate-500 font-semibold">hrs</span>
                        </div>
                      </div>
                    </div>

                    {/* Pick groups */}
                    <div className="space-y-1.5 pt-1">
                      <div className="flex items-center justify-between">
                        <label className="text-[11px] font-bold text-slate-700 uppercase">
                          3. Selecciona los grupos ({batchSelectedGroups.length} seleccionados):
                        </label>
                        <button
                          type="button"
                          onClick={handleSelectAllBatchGroups}
                          className="text-[11px] font-bold text-purple-600 hover:text-purple-800"
                        >
                          {batchSelectedGroups.length === groups.length ? 'Desmarcar todos' : 'Seleccionar todos'}
                        </button>
                      </div>

                      <div className="space-y-2 max-h-36 overflow-y-auto p-2 bg-slate-50 rounded-lg border border-slate-200">
                        {groupsByGrade.map((groupGrade) => (
                          <div key={groupGrade.label} className="space-y-1">
                            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
                              {groupGrade.label}
                            </span>
                            <div className="flex flex-wrap gap-1.5">
                              {groupGrade.groups.map((grp) => {
                                const isChecked = batchSelectedGroups.includes(grp.id);
                                return (
                                  <button
                                    type="button"
                                    key={grp.id}
                                    onClick={() => handleToggleBatchGroup(grp.id)}
                                    className={`px-2.5 py-1 rounded-md text-xs font-bold transition-all flex items-center gap-1.5 ${
                                      isChecked
                                        ? 'bg-purple-600 text-white shadow-2xs'
                                        : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-100'
                                    }`}
                                  >
                                    {isChecked && <Check className="w-3 h-3 text-white" />}
                                    <span>{grp.displayName}</span>
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="flex justify-end pt-2">
                      <button
                        type="button"
                        onClick={handleApplyBatchAssignments}
                        className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs rounded-xl shadow-xs transition-all flex items-center gap-1.5"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>Agregar {batchSelectedGroups.length} asignaciones de {batchSubject}</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* 2. TABLA DETALLADA DE ASIGNACIONES (ASIGNATURA, GRUPO, HORAS) */}
              <div className="space-y-3 pt-2">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="text-sm font-bold text-slate-900">
                      Detalle de Asignaciones Académicas
                    </h4>
                    <p className="text-xs text-slate-500">
                      Puedes modificar la asignatura, el grupo y las horas para cada clase asignada.
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleAddAssignmentRow()}
                    className="flex items-center gap-1 px-3 py-1.5 bg-purple-50 text-purple-700 border border-purple-200 hover:bg-purple-100 rounded-lg text-xs font-bold transition-colors"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>+ Agregar Asignación</span>
                  </button>
                </div>

                {/* Assignment items list */}
                <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                  {formAssignments.length === 0 ? (
                    <div className="p-6 bg-slate-50 border border-dashed border-slate-300 rounded-xl text-center text-xs text-slate-500">
                      No hay asignaciones configuradas. Haz clic en <strong>+ Agregar Asignación</strong> o utiliza <strong>⚡ Asignar a Varios Grupos</strong>.
                    </div>
                  ) : (
                    formAssignments.map((row, idx) => (
                      <div 
                        key={idx} 
                        className="p-3 bg-slate-50 hover:bg-slate-100/80 border border-slate-200 rounded-xl flex items-center gap-3 transition-colors"
                      >
                        {/* Selector de Asignatura */}
                        <div className="flex-1">
                          <label className="block text-[10px] font-bold text-slate-600 uppercase tracking-wider mb-1">
                            Asignatura
                          </label>
                          <select
                            value={row.subjectName}
                            onChange={(e) => {
                              const val = e.target.value;
                              if (val === '__ADD_NEW__') {
                                setShowNewSubjectInput(true);
                              } else {
                                handleUpdateAssignmentRow(idx, 'subjectName', val);
                              }
                            }}
                            className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-purple-500"
                          >
                            <option value="" disabled>-- Escoge una asignatura --</option>
                            {availableSubjects.map((sub) => (
                              <option key={sub} value={sub}>{sub}</option>
                            ))}
                            {/* If current row has a custom subject not in list, keep it */}
                            {row.subjectName && !availableSubjects.includes(row.subjectName) && (
                              <option value={row.subjectName}>{row.subjectName} (Personalizada)</option>
                            )}
                            <option value="__ADD_NEW__">+ Otra asignatura personalizada...</option>
                          </select>
                        </div>

                        {/* Selector de Grupo */}
                        <div className="w-36">
                          <label className="block text-[10px] font-bold text-slate-600 uppercase tracking-wider mb-1">
                            Grupo Escolar
                          </label>
                          <select
                            value={row.groupId}
                            onChange={(e) => handleUpdateAssignmentRow(idx, 'groupId', e.target.value)}
                            className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-bold focus:outline-none focus:ring-2 focus:ring-purple-500"
                          >
                            {groupsByGrade.map((groupGrade) => (
                              <optgroup key={groupGrade.label} label={groupGrade.label}>
                                {groupGrade.groups.map((g) => (
                                  <option key={g.id} value={g.id}>
                                    {g.displayName}
                                  </option>
                                ))}
                              </optgroup>
                            ))}
                            {row.groupId && !groups.some(g => g.id === row.groupId) && (
                              <option value={row.groupId}>{row.groupId} (Grupo no activo)</option>
                            )}
                          </select>
                        </div>

                        {/* Horas semanales */}
                        <div className="w-28">
                          <label className="block text-[10px] font-bold text-slate-600 uppercase tracking-wider mb-1">
                            Horas / sem
                          </label>
                          <div className="flex items-center gap-1">
                            <input
                              type="number"
                              min="1"
                              max="20"
                              value={row.weeklyHours}
                              onChange={(e) => handleUpdateAssignmentRow(idx, 'weeklyHours', Math.max(1, parseInt(e.target.value) || 1))}
                              className="w-full px-2 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-bold text-center focus:outline-none focus:ring-2 focus:ring-purple-500"
                            />
                            <span className="text-[11px] text-slate-400 font-medium">hrs</span>
                          </div>
                        </div>

                        {/* Eliminar fila */}
                        <div className="pt-4">
                          <button
                            type="button"
                            onClick={() => handleRemoveAssignmentRow(idx)}
                            className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                            title="Eliminar asignación"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>

                {/* Summary calculation card inside modal */}
                <div className="p-3.5 bg-purple-50/70 border border-purple-200 rounded-xl flex items-center justify-between text-xs font-semibold text-purple-900 flex-wrap gap-2">
                  <div className="flex items-center gap-4">
                    <span>
                      Asignaturas orientadas: <strong className="text-purple-950 font-black">{calculatedModalSubjectsCount}</strong>
                    </span>
                    <span>
                      Total grupos: <strong className="text-purple-950 font-black">{new Set(formAssignments.map(a => a.groupId)).size}</strong>
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span>Total Horas Semanales Asignadas:</span>
                    <span className={`px-2.5 py-1 font-extrabold rounded-lg text-xs shadow-2xs ${
                      calculatedModalTotalHours > maxWeeklyHours 
                        ? 'bg-red-600 text-white' 
                        : 'bg-purple-600 text-white'
                    }`}>
                      {calculatedModalTotalHours} horas
                    </span>
                  </div>
                </div>
              </div>

              {/* Modal Action Buttons */}
              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs rounded-xl transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="flex items-center gap-2 px-6 py-2.5 bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs rounded-xl shadow-md transition-all disabled:opacity-50"
                >
                  {saving ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Guardando...</span>
                    </>
                  ) : (
                    <>
                      <Save className="w-4 h-4" />
                      <span>{editingTeacher ? 'Guardar Cambios' : 'Registrar Docente'}</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: CONFIRMAR ELIMINACIÓN DE DOCENTE */}
      {deletingTeacher && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center gap-3 text-red-600">
              <div className="p-3 bg-red-100 rounded-xl">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <div>
                <h4 className="font-bold text-base text-slate-900">¿Eliminar Docente?</h4>
                <p className="text-xs text-slate-500">Esta acción no se puede deshacer</p>
              </div>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed">
              Estás a punto de eliminar a <strong>{deletingTeacher.fullName}</strong> ({deletingTeacher.internalCode}). 
              Se eliminarán también sus asignaciones académicas vinculadas.
            </p>

            {/* Check if teacher has assignments */}
            {teacherWorkloadMap.get(deletingTeacher.id)?.totalHours ? (
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-800 space-y-1">
                <p className="font-bold">Advertencia de Asignación:</p>
                <p>
                  El docente tiene actualmente <strong>{teacherWorkloadMap.get(deletingTeacher.id)?.totalHours} horas</strong> semanales asignadas en {teacherWorkloadMap.get(deletingTeacher.id)?.groups.size} grupos.
                </p>
                <p className="text-[11px] text-amber-700">
                  Sugerencia: Si sólo deseas retirar temporalmente al docente, considera cambiar su estado a <strong>Inactivo</strong>.
                </p>
              </div>
            ) : null}

            <div className="flex items-center justify-between gap-2 pt-2">
              <button
                type="button"
                onClick={() => handleExportTeacherPdf(deletingTeacher)}
                disabled={exportingTeacherId === deletingTeacher.id}
                className="inline-flex items-center gap-1.5 px-3 py-2 bg-purple-50 hover:bg-purple-100 text-purple-700 text-xs font-bold rounded-xl border border-purple-200 transition-colors disabled:opacity-50"
                title="Exportar respaldo en PDF antes de eliminar"
              >
                {exportingTeacherId === deletingTeacher.id ? (
                  <Loader2 className="w-4 h-4 animate-spin text-purple-600" />
                ) : (
                  <FileDown className="w-4 h-4 text-purple-600" />
                )}
                <span>Exportar PDF</span>
              </button>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setDeletingTeacher(null)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleConfirmDelete}
                  disabled={isDeleting}
                  className="flex items-center gap-1.5 px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-xs font-bold rounded-xl shadow-xs transition-colors disabled:opacity-50"
                >
                  {isDeleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                  <span>Eliminar Definitivamente</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
