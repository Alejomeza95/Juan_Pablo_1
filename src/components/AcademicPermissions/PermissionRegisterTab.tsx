import React, { useState, useEffect, useMemo } from 'react';
import { User } from 'firebase/auth';
import { 
  Users, 
  Calendar, 
  Search, 
  CheckCircle2, 
  Clock, 
  FileCheck2, 
  FileText, 
  Plus, 
  Edit3, 
  Trash2, 
  AlertCircle, 
  Loader2, 
  Eye, 
  CheckSquare, 
  Square,
  X,
  RefreshCw 
} from 'lucide-react';
import { 
  StudentRecord, 
  SchoolGroupRecord, 
  AcademicPermissionRecord, 
  AcademicYearConfigRecord 
} from '../../types';
import { 
  getStudentsByCourse, 
  getAllCachedStudents,
  normalizeCourseCode
} from '../../utils/attendanceService';
import { 
  getPermissionsByCourse, 
  deleteAcademicPermission 
} from '../../utils/academicPermissionsService';
import { PermissionModal } from './PermissionModal';

interface PermissionRegisterTabProps {
  user: User;
  schoolYear: number;
  yearConfig: AcademicYearConfigRecord;
  availableGroups: SchoolGroupRecord[];
  selectedGroupId?: string;
  onSelectGroup?: (groupId: string) => void;
  onNavigateToAttendance?: () => void;
}

export function PermissionRegisterTab({
  user,
  schoolYear,
  yearConfig,
  availableGroups,
  selectedGroupId: externalGroupId,
  onSelectGroup,
  onNavigateToAttendance
}: PermissionRegisterTabProps) {
  const [internalGroupId, setInternalGroupId] = useState<string>(() => {
    return externalGroupId || availableGroups[0]?.id || '';
  });

  const activeGroupId = externalGroupId !== undefined ? externalGroupId : internalGroupId;

  const handleGroupChange = (newId: string) => {
    setInternalGroupId(newId);
    if (onSelectGroup) {
      onSelectGroup(newId);
    }
  };

  const [selectedDate, setSelectedDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [searchTerm, setSearchTerm] = useState('');

  // Students and permissions
  const [students, setStudents] = useState<StudentRecord[]>([]);
  const [permissions, setPermissions] = useState<AcademicPermissionRecord[]>([]);
  const [loading, setLoading] = useState(false);

  // Modal state
  const [activeStudentForModal, setActiveStudentForModal] = useState<StudentRecord | null>(null);
  const [activePermissionForEdit, setActivePermissionForEdit] = useState<AcademicPermissionRecord | null>(null);
  const [pdfPreviewUrl, setPdfPreviewUrl] = useState<{ url: string; title: string } | null>(null);

  // Auto-seleccionar primer curso válido si no hay ninguno seleccionado o si la lista de cursos cambió
  useEffect(() => {
    if (availableGroups.length > 0) {
      if (!activeGroupId || !availableGroups.some(g => g.id === activeGroupId)) {
        handleGroupChange(availableGroups[0].id);
      }
    }
  }, [availableGroups, activeGroupId]);

  // Cargar estudiantes y permisos del curso
  const loadData = () => {
    if (!activeGroupId) return;
    setLoading(true);

    Promise.all([
      getStudentsByCourse(schoolYear, activeGroupId),
      getPermissionsByCourse(schoolYear, activeGroupId)
    ]).then(([stList, permList]) => {
      // Filtrar únicamente los explícitamente inactivos (activo !== false)
      setStudents(stList.filter(s => s.activo !== false));
      setPermissions(permList);
    }).catch(err => {
      console.error("Error al cargar datos de permisos:", err);
    }).finally(() => {
      setLoading(false);
    });
  };

  useEffect(() => {
    loadData();
  }, [schoolYear, activeGroupId]);

  // Escuchar actualizaciones de estudiantes desde el módulo de Asistencia o Excel
  useEffect(() => {
    const handleSync = () => {
      loadData();
    };

    window.addEventListener('jp1_students_updated', handleSync);
    window.addEventListener('jp1_academic_data_updated', handleSync);
    return () => {
      window.removeEventListener('jp1_students_updated', handleSync);
      window.removeEventListener('jp1_academic_data_updated', handleSync);
    };
  }, [schoolYear, activeGroupId]);

  // Mapa de permisos activos para la fecha seleccionada
  const permissionsMap = useMemo(() => {
    const map: Record<string, AcademicPermissionRecord> = {};
    permissions.forEach(p => {
      if (p.fecha === selectedDate && p.estado !== 'rechazado') {
        map[p.studentId] = p;
      }
    });
    return map;
  }, [permissions, selectedDate]);

  // Filtro de búsqueda
  const filteredStudents = useMemo(() => {
    return students.filter(st => {
      if (!searchTerm) return true;
      const term = searchTerm.toLowerCase();
      return (
        st.codigo.toLowerCase().includes(term) ||
        st.apellidos.toLowerCase().includes(term) ||
        st.nombres.toLowerCase().includes(term) ||
        st.nombreCompleto.toLowerCase().includes(term)
      );
    });
  }, [students, searchTerm]);

  const selectedGroupObj = availableGroups.find(g => g.id === activeGroupId);

  // Calcular número de estudiantes por curso a partir del caché consolidado
  const allCached = getAllCachedStudents();
  const groupStudentCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    allCached.forEach(st => {
      if (st.cursoId) {
        const norm = normalizeCourseCode(st.cursoId);
        counts[norm] = (counts[norm] || 0) + 1;
        counts[st.cursoId] = (counts[st.cursoId] || 0) + 1;
      }
    });
    return counts;
  }, [allCached, students]);

  const handleOpenRegister = (st: StudentRecord) => {
    setActiveStudentForModal(st);
    setActivePermissionForEdit(null);
  };

  const handleOpenEdit = (st: StudentRecord, perm: AcademicPermissionRecord) => {
    setActiveStudentForModal(st);
    setActivePermissionForEdit(perm);
  };

  const handleDeletePermission = async (permId: string) => {
    if (confirm("¿Estás seguro de que deseas retirar este permiso académico?")) {
      await deleteAcademicPermission(permId);
      setPermissions(prev => prev.filter(p => p.id !== permId));
    }
  };

  // Contadores
  const totalStudents = students.length;
  const countWithPermission = Object.keys(permissionsMap).length;
  const countRegular = totalStudents - countWithPermission;

  return (
    <div className="space-y-6">
      {/* Controles de Selección */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-purple-600 text-white rounded-xl shadow-xs">
              <FileCheck2 className="w-5 h-5 text-amber-300" />
            </div>
            <div>
              <h3 className="font-black text-slate-900 text-base">
                Gestión de Permisos Académicos por Curso
              </h3>
              <p className="text-xs text-slate-500">
                Selecciona el curso y la fecha para registrar, consultar o retirar permisos con soporte
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => loadData()}
              disabled={loading}
              className="flex items-center gap-1.5 px-3 py-1 bg-slate-100 hover:bg-purple-100 text-purple-700 hover:text-purple-900 text-xs font-bold rounded-xl border border-slate-200 transition-colors shadow-2xs"
              title="Actualizar listado desde base de datos"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-purple-600' : 'text-purple-600'}`} />
              <span>Sincronizar</span>
            </button>
            <span className="px-3 py-1 bg-purple-50 text-purple-700 font-bold text-xs rounded-xl border border-purple-200">
              Vigencia Lectiva {schoolYear}
            </span>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {/* Curso */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                <Users className="w-3.5 h-3.5 text-purple-600" />
                <span>Curso / Grupo *</span>
              </label>
              {totalStudents > 0 && (
                <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
                  {totalStudents} en lista
                </span>
              )}
            </div>
            <select
              value={activeGroupId}
              onChange={(e) => handleGroupChange(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-purple-500"
            >
              {availableGroups.map(g => {
                const count = groupStudentCounts[g.id] || groupStudentCounts[normalizeCourseCode(g.id)] || 0;
                return (
                  <option key={g.id} value={g.id}>
                    {g.displayName} ({g.gradeName}) {count > 0 ? `• (${count} estudiantes)` : ''}
                  </option>
                );
              })}
            </select>
          </div>

          {/* Fecha */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5 text-purple-600" />
              <span>Fecha del Permiso *</span>
            </label>
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-purple-500"
            />
          </div>

          {/* Buscador */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
              <Search className="w-3.5 h-3.5 text-purple-600" />
              <span>Buscar Estudiante</span>
            </label>
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Código, apellido o nombre..."
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-purple-500"
            />
          </div>
        </div>
      </div>

      {/* Tarjetas de Resumen Rápido */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex items-center gap-3">
          <div className="p-3 bg-purple-50 text-purple-600 rounded-xl">
            <Users className="w-5 h-5" />
          </div>
          <div>
            <span className="text-xs text-slate-400 font-bold block">Matrícula Activa</span>
            <span className="text-xl font-black text-slate-900">{totalStudents} Estudiantes</span>
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex items-center gap-3">
          <div className="p-3 bg-amber-50 text-amber-600 rounded-xl">
            <FileCheck2 className="w-5 h-5" />
          </div>
          <div>
            <span className="text-xs text-slate-400 font-bold block">Con Permiso en {selectedDate}</span>
            <span className="text-xl font-black text-amber-600">{countWithPermission} Estudiantes</span>
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex items-center gap-3">
          <div className="p-3 bg-emerald-50 text-emerald-600 rounded-xl">
            <CheckCircle2 className="w-5 h-5" />
          </div>
          <div>
            <span className="text-xs text-slate-400 font-bold block">En Clase Regular</span>
            <span className="text-xl font-black text-emerald-600">{countRegular} Estudiantes</span>
          </div>
        </div>
      </div>

      {/* Tabla de Estudiantes y Casilla de Permiso */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="px-4 sm:px-6 py-4 border-b border-slate-100 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div>
            <h4 className="font-bold text-slate-900 text-sm">
              Listado de Estudiantes: {selectedGroupObj?.displayName || activeGroupId}
            </h4>
            <p className="text-xs text-slate-400">
              Marca o edita la casilla de permiso para cada estudiante en la fecha indicada
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => loadData()}
              disabled={loading}
              className="p-1.5 text-purple-600 hover:text-purple-800 hover:bg-purple-50 rounded-lg transition-colors"
              title="Recargar estudiantes"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
            <span className="text-xs font-mono font-bold text-purple-700 bg-purple-50 px-3 py-1 rounded-xl">
              Fecha: {selectedDate}
            </span>
          </div>
        </div>

        {loading ? (
          <div className="py-16 text-center text-slate-400 flex flex-col items-center justify-center gap-2">
            <Loader2 className="w-8 h-8 animate-spin text-purple-600" />
            <span className="text-xs font-bold">Cargando listado de estudiantes y permisos...</span>
          </div>
        ) : filteredStudents.length === 0 ? (
          <div className="py-14 text-center text-slate-400 flex flex-col items-center justify-center gap-3 px-4">
            <div className="p-3 bg-purple-50 text-purple-600 rounded-full">
              <Users className="w-8 h-8 text-purple-500" />
            </div>
            <div>
              <p className="font-bold text-sm text-slate-700">
                No se encontraron estudiantes para {selectedGroupObj?.displayName || activeGroupId}
              </p>
              <p className="text-xs text-slate-400 mt-1 max-w-md mx-auto">
                Las listas de estudiantes se sincronizan con las cargadas en el módulo de <strong>Asistencia Estudiantil</strong> o <strong>Año Escolar</strong> para el año lectivo {schoolYear}.
              </p>
            </div>
            <div className="flex flex-wrap items-center justify-center gap-2.5 mt-2">
              <button
                type="button"
                onClick={() => loadData()}
                className="px-3.5 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs font-bold transition-colors shadow-2xs flex items-center gap-1.5"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Sincronizar con Base de Datos</span>
              </button>
              {onNavigateToAttendance && (
                <button
                  type="button"
                  onClick={onNavigateToAttendance}
                  className="px-3.5 py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-xl text-xs font-bold transition-colors shadow-2xs flex items-center gap-1.5"
                >
                  <Users className="w-3.5 h-3.5" />
                  <span>Ir a Asistencia para Cargar Excel</span>
                </button>
              )}
            </div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50/80 border-b border-slate-200 text-slate-500 font-bold uppercase tracking-wider text-[11px]">
                  <th className="py-3 px-4 w-12 text-center">N°</th>
                  <th className="py-3 px-4 w-28">Código</th>
                  <th className="py-3 px-4">Apellidos y Nombres</th>
                  <th className="py-3 px-4 text-center w-36">Casilla de Permiso</th>
                  <th className="py-3 px-4">Motivo / Horario</th>
                  <th className="py-3 px-4 text-center w-28">Soporte PDF</th>
                  <th className="py-3 px-4 text-center w-28">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredStudents.map((st, idx) => {
                  const perm = permissionsMap[st.id];
                  const hasPerm = Boolean(perm);

                  return (
                    <tr 
                      key={st.id} 
                      className={`transition-colors ${
                        hasPerm ? 'bg-amber-50/40 hover:bg-amber-50/60' : 'hover:bg-slate-50/60'
                      }`}
                    >
                      <td className="py-3.5 px-4 text-center font-bold text-slate-400">
                        {idx + 1}
                      </td>
                      <td className="py-3.5 px-4 font-mono font-bold text-slate-700">
                        {st.codigo}
                      </td>
                      <td className="py-3.5 px-4">
                        <span className="font-bold text-slate-900 block uppercase">
                          {st.apellidos} {st.nombres}
                        </span>
                      </td>

                      {/* Casilla de Permiso */}
                      <td className="py-3.5 px-4 text-center">
                        {hasPerm ? (
                          <button
                            type="button"
                            onClick={() => handleOpenEdit(st, perm)}
                            className="inline-flex items-center gap-1.5 px-3 py-1 bg-amber-500 text-white rounded-xl text-xs font-black shadow-xs hover:bg-amber-600 transition-all hover:scale-102"
                            title="Haga clic para editar los datos del permiso"
                          >
                            <CheckSquare className="w-4 h-4 text-white" />
                            <span>Con Permiso</span>
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => handleOpenRegister(st)}
                            className="inline-flex items-center gap-1.5 px-3 py-1 bg-slate-100 hover:bg-purple-100 text-slate-600 hover:text-purple-700 rounded-xl text-xs font-bold border border-slate-200 hover:border-purple-300 transition-all hover:scale-102"
                            title="Haga clic para activar y registrar el permiso"
                          >
                            <Square className="w-4 h-4 text-slate-400" />
                            <span>Sin Permiso</span>
                          </button>
                        )}
                      </td>

                      {/* Motivo y Rango Horario */}
                      <td className="py-3.5 px-4">
                        {hasPerm ? (
                          <div className="space-y-0.5">
                            <span className="font-bold text-amber-950 block">
                              {perm.motivo}
                            </span>
                            <span className="text-[11px] text-amber-800 flex items-center gap-1">
                              <Clock className="w-3 h-3 text-amber-600 shrink-0" />
                              {perm.tipoRango === 'dia_completo' ? (
                                <span>Jornada Completa</span>
                              ) : (
                                <span>Rango: {perm.horaInicio} a {perm.horaFin}</span>
                              )}
                            </span>
                          </div>
                        ) : (
                          <span className="text-slate-400 italic">En clase regular</span>
                        )}
                      </td>

                      {/* Soporte PDF */}
                      <td className="py-3.5 px-4 text-center">
                        {hasPerm && perm.archivoPdfBase64 ? (
                          <button
                            type="button"
                            onClick={() => setPdfPreviewUrl({ url: perm.archivoPdfBase64!, title: `Soporte: ${st.nombreCompleto}` })}
                            className="inline-flex items-center gap-1 px-2.5 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 rounded-lg font-bold text-[11px] border border-emerald-200 transition-colors shadow-2xs"
                            title="Ver documento PDF de evidencia"
                          >
                            <FileText className="w-3.5 h-3.5 text-emerald-600" />
                            <span>Ver PDF</span>
                          </button>
                        ) : hasPerm ? (
                          <span className="text-[11px] text-slate-400">Sin archivo</span>
                        ) : (
                          <span className="text-slate-300">-</span>
                        )}
                      </td>

                      {/* Acciones */}
                      <td className="py-3.5 px-4 text-center">
                        {hasPerm ? (
                          <div className="flex items-center justify-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => handleOpenEdit(st, perm)}
                              className="p-1.5 text-purple-600 hover:text-purple-800 hover:bg-purple-100 rounded-lg transition-colors"
                              title="Editar detalles del permiso"
                            >
                              <Edit3 className="w-4 h-4" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeletePermission(perm.id)}
                              className="p-1.5 text-rose-500 hover:text-rose-700 hover:bg-rose-100 rounded-lg transition-colors"
                              title="Retirar permiso"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => handleOpenRegister(st)}
                            className="inline-flex items-center gap-1 text-[11px] text-purple-700 hover:text-purple-900 font-bold hover:underline"
                          >
                            <Plus className="w-3.5 h-3.5" />
                            <span>Registrar</span>
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal de Registro / Edición de Permiso */}
      {activeStudentForModal && (
        <PermissionModal
          student={activeStudentForModal}
          courseName={selectedGroupObj?.displayName || activeGroupId}
          schoolYear={schoolYear}
          initialDate={selectedDate}
          existingPermission={activePermissionForEdit}
          currentUserEmail={user.email || 'Coordinación'}
          onClose={() => {
            setActiveStudentForModal(null);
            setActivePermissionForEdit(null);
          }}
          onSaved={(savedPerm) => {
            setPermissions(prev => {
              const idx = prev.findIndex(p => p.id === savedPerm.id);
              if (idx >= 0) {
                const next = [...prev];
                next[idx] = savedPerm;
                return next;
              }
              return [savedPerm, ...prev];
            });
          }}
        />
      )}

      {/* Modal de Visualización de PDF */}
      {pdfPreviewUrl && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-4xl w-full h-[88vh] shadow-2xl flex flex-col overflow-hidden border border-slate-200">
            <div className="px-5 py-3.5 bg-slate-900 text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FileText className="w-5 h-5 text-emerald-400" />
                <span className="font-bold text-sm">{pdfPreviewUrl.title}</span>
              </div>
              <button
                type="button"
                onClick={() => setPdfPreviewUrl(null)}
                className="p-1 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="flex-1 bg-slate-100 p-2">
              <iframe
                src={pdfPreviewUrl.url}
                className="w-full h-full rounded-xl border border-slate-300"
                title="Soporte PDF"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
