import React, { useState, useEffect, useMemo } from 'react';
import { SchoolGroupRecord, TeachingAssignmentRecord, AcademicYearConfigRecord, GradeConfigItem } from '../../types';
import { 
  DEFAULT_SECTIONS, 
  syncGroupsFromMatrix, 
  deleteSchoolGroup, 
  toggleSchoolGroupActive,
  saveAcademicConfigSettings,
  getStoredSchoolYearConfig,
  getActiveYearGradesList
} from '../../utils/academicConfigService';
import { 
  CheckSquare, Square, Save, Plus, AlertTriangle, 
  CheckCircle2, XCircle, Trash2, Loader2, Sparkles, Layers, RefreshCw, Calendar, Check
} from 'lucide-react';

interface GroupsTabProps {
  groups: SchoolGroupRecord[];
  assignments: TeachingAssignmentRecord[];
  availableSections: string[];
  onRefresh?: () => void;
}

export function GroupsTab({ 
  groups, 
  assignments, 
  availableSections: initialSections,
}: GroupsTabProps) {
  // Stored School Year configuration
  const [yearConfig, setYearConfig] = useState<AcademicYearConfigRecord>(() => getStoredSchoolYearConfig());

  // Available section letters
  const [sections, setSections] = useState<string[]>(
    initialSections.length > 0 ? initialSections : DEFAULT_SECTIONS
  );
  const [newLetterInput, setNewLetterInput] = useState('');
  const [showAddLetter, setShowAddLetter] = useState(false);

  // Matrix state: gradeKey -> section -> boolean
  const [matrix, setMatrix] = useState<Record<string | number, Record<string, boolean>>>({});
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [saving, setSaving] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');

  // Group delete confirmation
  const [groupToDelete, setGroupToDelete] = useState<SchoolGroupRecord | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Keep yearConfig in sync with local events
  useEffect(() => {
    const handleUpdate = () => {
      setYearConfig(getStoredSchoolYearConfig());
    };
    window.addEventListener('jp1_academic_data_updated', handleUpdate);
    return () => window.removeEventListener('jp1_academic_data_updated', handleUpdate);
  }, []);

  // All grades from active Año Escolar
  const allGradesList = useMemo(() => {
    return getActiveYearGradesList(yearConfig);
  }, [yearConfig]);

  // Initialize matrix based on existing groups and yearConfig grades
  useEffect(() => {
    const newMatrix: Record<string | number, Record<string, boolean>> = {};
    
    // Default matrix structure for every grade configured in Año Escolar
    allGradesList.forEach(g => {
      const gKey = g.gradeNumber !== undefined ? g.gradeNumber : g.id;
      newMatrix[gKey] = {};
      sections.forEach(s => {
        newMatrix[gKey][s] = false;
      });
    });

    // Populate from active groups
    groups.forEach(grp => {
      const gKey = grp.grade;
      if (!newMatrix[gKey]) {
        newMatrix[gKey] = {};
      }
      newMatrix[gKey][grp.section] = grp.active !== false;
    });

    setMatrix(newMatrix);
    setHasUnsavedChanges(false);
  }, [groups, sections, allGradesList]);

  // Toggle single cell
  const handleToggleCell = (gradeKey: string | number, section: string) => {
    setMatrix(prev => {
      const current = prev[gradeKey]?.[section] || false;
      return {
        ...prev,
        [gradeKey]: {
          ...(prev[gradeKey] || {}),
          [section]: !current
        }
      };
    });
    setHasUnsavedChanges(true);
    setSuccessMessage('');
  };

  // Toggle whole grade row
  const handleToggleGradeRow = (gradeKey: string | number, selectAll: boolean) => {
    setMatrix(prev => {
      const row: Record<string, boolean> = {};
      sections.forEach(s => {
        row[s] = selectAll;
      });
      return {
        ...prev,
        [gradeKey]: row
      };
    });
    setHasUnsavedChanges(true);
  };

  // Total calculated selected groups
  const totalSelectedGroups = useMemo(() => {
    let count = 0;
    Object.values(matrix).forEach(row => {
      Object.values(row).forEach(checked => {
        if (checked) count++;
      });
    });
    return count;
  }, [matrix]);

  // Total grades with at least one active group
  const totalGradesWithGroups = useMemo(() => {
    let count = 0;
    Object.values(matrix).forEach(row => {
      const hasAny = Object.values(row).some(checked => checked);
      if (hasAny) count++;
    });
    return count;
  }, [matrix]);

  // Add new section letter
  const handleAddSectionLetter = async (e: React.FormEvent) => {
    e.preventDefault();
    const letter = newLetterInput.trim().toUpperCase();
    if (!letter || letter.length > 2) return;
    if (sections.includes(letter)) {
      alert(`La letra "${letter}" ya existe en las columnas.`);
      return;
    }

    const updated = [...sections, letter].sort();
    setSections(updated);
    setNewLetterInput('');
    setShowAddLetter(false);

    try {
      await saveAcademicConfigSettings({ availableSections: updated });
    } catch (err) {
      console.warn("Could not save section letters settings:", err);
    }
  };

  // Save configuration button
  const handleSaveConfiguration = async () => {
    setSaving(true);
    setSuccessMessage('');
    try {
      await syncGroupsFromMatrix(matrix);
      setHasUnsavedChanges(false);
      setSuccessMessage('¡Configuración de grados y grupos guardada con éxito en Firestore y sincronizada con Año Escolar!');
      setTimeout(() => setSuccessMessage(''), 4500);
    } catch (err: any) {
      alert('Error al guardar la configuración: ' + (err.message || 'Permiso denegado'));
    } finally {
      setSaving(false);
    }
  };

  // Delete individual group with validation
  const handleConfirmDeleteGroup = async () => {
    if (!groupToDelete) return;
    setIsDeleting(true);
    try {
      await deleteSchoolGroup(groupToDelete.id);
      // Also uncheck in matrix
      setMatrix(prev => ({
        ...prev,
        [groupToDelete.grade]: {
          ...(prev[groupToDelete.grade] || {}),
          [groupToDelete.section]: false
        }
      }));
      setGroupToDelete(null);
    } catch (err: any) {
      alert('Error al eliminar grupo: ' + err.message);
    } finally {
      setIsDeleting(false);
    }
  };

  // Quick reset to standard Juan Pablo I configuration
  const handleResetToStandard = () => {
    const standardGroups: Record<number, string[]> = {
      0: ['A'],
      1: ['A', 'B'],
      2: ['A', 'B'],
      3: ['A', 'B'],
      4: ['A', 'B'],
      5: ['A', 'B'],
      6: ['A', 'B'],
      7: ['A', 'B'],
      8: ['A', 'B'],
      9: ['A', 'B', 'C'],
      10: ['A', 'B'],
      11: ['A', 'B', 'C']
    };

    const newMatrix: Record<string | number, Record<string, boolean>> = {};
    allGradesList.forEach(g => {
      const gKey = g.gradeNumber !== undefined ? g.gradeNumber : g.id;
      newMatrix[gKey] = {};
      sections.forEach(s => {
        newMatrix[gKey][s] = standardGroups[Number(gKey)]?.includes(s) || false;
      });
    });

    setMatrix(newMatrix);
    setHasUnsavedChanges(true);
  };

  return (
    <div className="space-y-6">
      {/* Counters & Action Bar */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        {/* Counters */}
        <div className="flex items-center gap-4 flex-wrap">
          <div className="px-4 py-2.5 bg-purple-50 border border-purple-100 rounded-xl flex items-center gap-3">
            <Calendar className="w-5 h-5 text-purple-600" />
            <div>
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
                Año Lectivo Vinculado
              </span>
              <span className="text-base font-extrabold text-slate-900">
                Año Escolar {yearConfig.year || 2026}
              </span>
            </div>
          </div>

          <div className="px-4 py-2.5 bg-indigo-50 border border-indigo-100 rounded-xl flex items-center gap-3">
            <Layers className="w-5 h-5 text-indigo-600" />
            <div>
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
                Grados Habilitados
              </span>
              <span className="text-base font-extrabold text-indigo-900">
                {totalGradesWithGroups} de {allGradesList.length} Grados
              </span>
            </div>
          </div>

          <div className="px-4 py-2.5 bg-emerald-50 border border-emerald-100 rounded-xl flex items-center gap-3">
            <CheckSquare className="w-5 h-5 text-emerald-600" />
            <div>
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
                Total Grupos Creados
              </span>
              <span className="text-base font-extrabold text-emerald-950">
                {totalSelectedGroups} Grupos Activos
              </span>
            </div>
          </div>
        </div>

        {/* Buttons */}
        <div className="flex items-center gap-2.5 flex-wrap">
          <button
            onClick={handleResetToStandard}
            className="flex items-center gap-1.5 px-3.5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-xl text-xs transition-colors"
            title="Seleccionar la estructura estándar institucional"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Plantilla Estándar</span>
          </button>

          <button
            onClick={() => setShowAddLetter(!showAddLetter)}
            className="flex items-center gap-1.5 px-3.5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-xl text-xs transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>+ Añadir Letra</span>
          </button>

          <button
            onClick={handleSaveConfiguration}
            disabled={saving}
            className={`flex items-center gap-2 px-5 py-2.5 font-bold rounded-xl text-sm transition-all shadow-sm ${
              hasUnsavedChanges
                ? 'bg-purple-600 hover:bg-purple-700 text-white animate-pulse'
                : 'bg-emerald-600 hover:bg-emerald-700 text-white'
            }`}
          >
            {saving ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Guardando...</span>
              </>
            ) : (
              <>
                <Save className="w-4 h-4" />
                <span>{hasUnsavedChanges ? 'Guardar Cambios Pendientes' : 'Guardar Configuración'}</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Add Letter inline popover */}
      {showAddLetter && (
        <form onSubmit={handleAddSectionLetter} className="bg-purple-50 border border-purple-200 p-4 rounded-xl flex items-center gap-3">
          <span className="text-xs font-bold text-purple-900">Nueva Letra de Grupo:</span>
          <input
            type="text"
            maxLength={2}
            placeholder="Ej. G"
            value={newLetterInput}
            onChange={(e) => setNewLetterInput(e.target.value)}
            className="w-16 px-3 py-1.5 bg-white border border-purple-300 rounded-lg text-sm font-bold uppercase text-center focus:outline-none focus:ring-2 focus:ring-purple-500"
          />
          <button
            type="submit"
            className="px-3 py-1.5 bg-purple-600 text-white rounded-lg text-xs font-bold hover:bg-purple-700"
          >
            Añadir
          </button>
          <button
            type="button"
            onClick={() => setShowAddLetter(false)}
            className="px-3 py-1.5 text-slate-500 hover:text-slate-800 text-xs"
          >
            Cancelar
          </button>
        </form>
      )}

      {/* Success banner */}
      {successMessage && (
        <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-xl text-xs font-bold text-emerald-800 flex items-center gap-2 shadow-xs">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{successMessage}</span>
        </div>
      )}

      {/* Interactive Matrix Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-4 bg-slate-900 text-white flex items-center justify-between">
          <div>
            <h3 className="font-bold text-sm flex items-center gap-2">
              <Layers className="w-4 h-4 text-indigo-400" />
              <span>Matriz de Grados y Grupos Escolares</span>
            </h3>
            <p className="text-xs text-slate-300">
              Marca las casillas correspondientes para activar los grupos de cada grado (e.g. A, B en Sexto crea 6°A y 6°B). Todos los cursos están sincronizados con Año Escolar.
            </p>
          </div>
          {hasUnsavedChanges && (
            <span className="text-[11px] font-bold px-2.5 py-1 bg-amber-500 text-white rounded-lg animate-bounce">
              Cambios sin guardar
            </span>
          )}
        </div>

        {/* Level-by-level Sections */}
        <div className="divide-y divide-slate-200">
          {(yearConfig.levels || []).map((level) => {
            return (
              <div key={level.key} className="overflow-x-auto">
                {/* Level subheader */}
                <div className="bg-slate-100/90 px-6 py-2.5 border-y border-slate-200 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-indigo-600"></span>
                    <span className="font-extrabold text-xs text-slate-800 uppercase tracking-wider">
                      {level.name}
                    </span>
                    <span className="text-[11px] text-slate-500 font-medium">
                      ({level.subtitle})
                    </span>
                  </div>
                </div>

                <table className="w-full text-center border-collapse">
                  <thead>
                    <tr className="bg-slate-50/80 border-b border-slate-200 text-xs font-bold text-slate-600 uppercase tracking-wider">
                      <th className="px-6 py-3 text-left w-64">Grado Escolar</th>
                      {sections.map((letter) => (
                        <th key={letter} className="px-3 py-3 w-16 text-center">
                          <span className="w-7 h-7 mx-auto flex items-center justify-center rounded-lg bg-white border border-slate-200 text-slate-800 font-extrabold text-xs shadow-2xs">
                            {letter}
                          </span>
                        </th>
                      ))}
                      <th className="px-4 py-3 text-right w-44">Acción Rápida</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {level.grades.map((gradeItem) => {
                      const gKey = gradeItem.gradeNumber !== undefined ? gradeItem.gradeNumber : gradeItem.id;
                      const row = matrix[gKey] || {};
                      const activeCountInRow = sections.filter(s => row[s]).length;

                      return (
                        <tr key={gradeItem.id} className="hover:bg-slate-50/70 transition-colors">
                          {/* Grade Name */}
                          <td className="px-6 py-3.5 text-left">
                            <div className="flex items-center gap-3">
                              <span className="w-8 h-8 rounded-lg bg-purple-100 text-purple-800 font-extrabold text-xs flex items-center justify-center border border-purple-200 shrink-0">
                                {gradeItem.shortName || `${gradeItem.gradeNumber}°`}
                              </span>
                              <div>
                                <span className="font-bold text-slate-900 text-sm block">
                                  {gradeItem.name}
                                </span>
                                <span className="text-[11px] text-slate-400">
                                  {activeCountInRow} grupo{activeCountInRow === 1 ? '' : 's'} activo{activeCountInRow === 1 ? '' : 's'}
                                </span>
                              </div>
                            </div>
                          </td>

                          {/* Section Checkboxes */}
                          {sections.map((letter) => {
                            const isChecked = !!row[letter];
                            const gradeNum = gradeItem.gradeNumber !== undefined ? gradeItem.gradeNumber : (parseInt(gradeItem.id, 10) || 0);
                            const prefix = gradeItem.shortName || (gradeNum >= 0 ? `${gradeNum}°` : gradeItem.name);

                            return (
                              <td key={letter} className="px-3 py-3">
                                <button
                                  type="button"
                                  onClick={() => handleToggleCell(gKey, letter)}
                                  className={`w-8 h-8 mx-auto rounded-lg flex items-center justify-center font-bold text-xs transition-all border ${
                                    isChecked
                                      ? 'bg-purple-600 text-white border-purple-600 shadow-sm scale-105'
                                      : 'bg-slate-50 text-slate-400 border-slate-200 hover:border-purple-300 hover:bg-purple-50/50'
                                  }`}
                                  title={`Alternar grupo ${prefix}${letter}`}
                                >
                                  {isChecked ? (
                                    <span className="font-extrabold text-xs">{letter}</span>
                                  ) : (
                                    <Square className="w-3.5 h-3.5 opacity-40" />
                                  )}
                                </button>
                              </td>
                            );
                          })}

                          {/* Quick row actions */}
                          <td className="px-4 py-3 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              <button
                                type="button"
                                onClick={() => handleToggleGradeRow(gKey, true)}
                                className="px-2 py-1 text-[11px] font-semibold text-purple-700 bg-purple-50 hover:bg-purple-100 rounded-md border border-purple-200 transition-colors"
                                title="Marcar todas las letras para este grado"
                              >
                                Todos
                              </button>
                              <button
                                type="button"
                                onClick={() => handleToggleGradeRow(gKey, false)}
                                className="px-2 py-1 text-[11px] font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-md border border-slate-200 transition-colors"
                                title="Desmarcar todas"
                              >
                                Limpiar
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            );
          })}
        </div>
      </div>

      {/* Active Groups Chips Summary */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-3">
        <div className="flex items-center justify-between">
          <h4 className="font-bold text-sm text-slate-800">
            Listado Consolidado de Grupos Activos ({groups.length})
          </h4>
          <span className="text-xs text-slate-400">
            Todos estos grupos están disponibles en el registro y edición de Docentes
          </span>
        </div>

        <div className="flex flex-wrap gap-2.5">
          {groups.length === 0 ? (
            <p className="text-xs text-slate-400 italic">No hay grupos activos configurados. Selecciona casillas arriba y haz clic en Guardar Configuración.</p>
          ) : (
            groups.map((grp) => {
              const countAssignments = assignments.filter(a => a.groupId === grp.id).length;

              return (
                <div 
                  key={grp.id}
                  className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl flex items-center gap-2 hover:bg-slate-100 transition-colors"
                >
                  <span className="font-black text-xs text-purple-700 bg-purple-100 px-1.5 py-0.5 rounded">
                    {grp.displayName}
                  </span>
                  <span className="text-[11px] text-slate-500 font-medium">
                    {grp.gradeName ? `(${grp.gradeName}) • ` : ''}{countAssignments} clases
                  </span>
                  <button
                    onClick={() => setGroupToDelete(grp)}
                    className="text-slate-400 hover:text-red-600 p-0.5 rounded transition-colors"
                    title="Eliminar grupo"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Delete Group Modal with Integrity Confirmation */}
      {groupToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl border border-slate-200 space-y-4 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center gap-3 text-red-600">
              <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center">
                <AlertTriangle className="w-5 h-5 text-red-600" />
              </div>
              <div>
                <h4 className="font-bold text-slate-900 text-base">¿Eliminar Grupo {groupToDelete.displayName}?</h4>
                <p className="text-xs text-slate-500">Comprobación de integridad académica</p>
              </div>
            </div>

            {assignments.some(a => a.groupId === groupToDelete.id) ? (
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-800 space-y-1">
                <p className="font-bold">⚠️ Atención: Este grupo tiene asignaciones docentes vinculadas.</p>
                <p>
                  Hay {assignments.filter(a => a.groupId === groupToDelete.id).length} asignación(es) vinculadas a este grupo.
                  Si eliminas el grupo, te recomendamos reasignar las clases a otro grupo escolar para evitar horarios huérfanos.
                </p>
              </div>
            ) : (
              <p className="text-xs text-slate-600">
                Este grupo no tiene asignaciones activas. Puedes eliminarlo con total seguridad.
              </p>
            )}

            <div className="flex justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setGroupToDelete(null)}
                className="px-4 py-2 border border-slate-200 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-50 transition-colors"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleConfirmDeleteGroup}
                disabled={isDeleting}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-bold transition-colors flex items-center gap-1.5"
              >
                {isDeleting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                <span>Confirmar y Eliminar</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
