import React, { useState, useEffect, useMemo } from 'react';
import { User } from 'firebase/auth';
import { 
  FileCheck2, 
  Search, 
  Filter, 
  Calendar, 
  Users, 
  FileText, 
  Clock, 
  Eye, 
  Trash2, 
  Edit3, 
  Download, 
  X, 
  Loader2 
} from 'lucide-react';
import { AcademicPermissionRecord, SchoolGroupRecord } from '../../types';
import { 
  getAllPermissions, 
  deleteAcademicPermission 
} from '../../utils/academicPermissionsService';
import { PermissionModal } from './PermissionModal';

interface PermissionsListTabProps {
  user: User;
  schoolYear: number;
  availableGroups: SchoolGroupRecord[];
}

export function PermissionsListTab({
  user,
  schoolYear,
  availableGroups
}: PermissionsListTabProps) {
  const [permissions, setPermissions] = useState<AcademicPermissionRecord[]>([]);
  const [loading, setLoading] = useState(false);

  // Filters
  const [selectedCourseFilter, setSelectedCourseFilter] = useState<string>('all');
  const [dateFilter, setDateFilter] = useState<string>('');
  const [searchTerm, setSearchTerm] = useState('');

  // Modals
  const [editingPermission, setEditingPermission] = useState<AcademicPermissionRecord | null>(null);
  const [pdfPreview, setPdfPreview] = useState<{ url: string; title: string } | null>(null);

  const loadData = () => {
    setLoading(true);
    getAllPermissions(schoolYear)
      .then(data => setPermissions(data))
      .catch(e => console.error(e))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadData();
  }, [schoolYear]);

  const filtered = useMemo(() => {
    return permissions.filter(p => {
      if (selectedCourseFilter !== 'all' && p.cursoId !== selectedCourseFilter) return false;
      if (dateFilter && p.fecha !== dateFilter) return false;
      if (searchTerm) {
        const term = searchTerm.toLowerCase();
        return (
          p.codigo.toLowerCase().includes(term) ||
          p.nombreCompleto.toLowerCase().includes(term) ||
          p.motivo.toLowerCase().includes(term) ||
          p.cursoNombre.toLowerCase().includes(term)
        );
      }
      return true;
    });
  }, [permissions, selectedCourseFilter, dateFilter, searchTerm]);

  const handleDelete = async (permId: string) => {
    if (confirm("¿Deseas eliminar este registro de permiso académico?")) {
      await deleteAcademicPermission(permId);
      setPermissions(prev => prev.filter(p => p.id !== permId));
    }
  };

  return (
    <div className="space-y-6">
      {/* Header and Filters */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-purple-600 text-white rounded-xl shadow-xs">
              <FileCheck2 className="w-5 h-5 text-amber-300" />
            </div>
            <div>
              <h3 className="font-black text-slate-900 text-base">
                Historial y Consulta de Permisos Académicos
              </h3>
              <p className="text-xs text-slate-500">
                Consulta, filtra y descarga los soportes de permisos registrados en toda la institución
              </p>
            </div>
          </div>
          <span className="text-xs font-bold text-slate-600 bg-slate-100 px-3 py-1 rounded-xl">
            Total Registros: {filtered.length} de {permissions.length}
          </span>
        </div>

        {/* Filter Controls */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
              <Users className="w-3.5 h-3.5 text-purple-600" />
              <span>Filtrar por Curso</span>
            </label>
            <select
              value={selectedCourseFilter}
              onChange={(e) => setSelectedCourseFilter(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-purple-500"
            >
              <option value="all">Todos los Cursos</option>
              {availableGroups.map(g => (
                <option key={g.id} value={g.id}>{g.displayName}</option>
              ))}
            </select>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5 text-purple-600" />
              <span>Filtrar por Fecha</span>
            </label>
            <div className="flex gap-2">
              <input
                type="date"
                value={dateFilter}
                onChange={(e) => setDateFilter(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-purple-500"
              />
              {dateFilter && (
                <button
                  type="button"
                  onClick={() => setDateFilter('')}
                  className="px-2.5 py-1 text-slate-500 hover:text-slate-800 bg-slate-100 hover:bg-slate-200 rounded-xl text-xs font-bold"
                  title="Limpiar fecha"
                >
                  ✕
                </button>
              )}
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
              <Search className="w-3.5 h-3.5 text-purple-600" />
              <span>Buscar por Estudiante o Motivo</span>
            </label>
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Código, apellido o motivo..."
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-purple-500"
            />
          </div>
        </div>
      </div>

      {/* Permissions Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        {loading ? (
          <div className="py-16 text-center text-slate-400 flex flex-col items-center justify-center gap-2">
            <Loader2 className="w-8 h-8 animate-spin text-purple-600" />
            <span className="text-xs font-bold">Cargando permisos académicos...</span>
          </div>
        ) : filtered.length === 0 ? (
          <div className="py-16 text-center text-slate-400 flex flex-col items-center justify-center gap-2">
            <FileText className="w-10 h-10 text-slate-300" />
            <p className="font-bold text-sm text-slate-600">No se encontraron permisos con los filtros actuales</p>
            <p className="text-xs text-slate-400">Prueba cambiando la fecha o el curso seleccionado.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[780px] text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50/80 border-b border-slate-200 text-slate-500 font-bold uppercase tracking-wider text-[11px]">
                  <th className="py-3 px-4 w-12 text-center">N°</th>
                  <th className="py-3 px-4 w-24">Fecha</th>
                  <th className="py-3 px-4 w-28">Curso</th>
                  <th className="py-3 px-4 w-28">Código</th>
                  <th className="py-3 px-4">Estudiante</th>
                  <th className="py-3 px-4">Motivo / Modalidad</th>
                  <th className="py-3 px-4 text-center w-28">Soporte PDF</th>
                  <th className="py-3 px-4 text-center w-24">Estado</th>
                  <th className="py-3 px-4 text-center w-24">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map((p, idx) => (
                  <tr key={p.id} className="hover:bg-slate-50/60 transition-colors">
                    <td className="py-3 px-4 text-center font-bold text-slate-400">
                      {idx + 1}
                    </td>
                    <td className="py-3 px-4 font-bold text-slate-800">
                      {p.fecha}
                    </td>
                    <td className="py-3 px-4 font-bold text-purple-700">
                      {p.cursoNombre}
                    </td>
                    <td className="py-3 px-4 font-mono font-bold text-slate-600">
                      {p.codigo}
                    </td>
                    <td className="py-3 px-4 font-bold text-slate-900 uppercase">
                      {p.nombreCompleto}
                    </td>
                    <td className="py-3 px-4">
                      <div className="space-y-0.5">
                        <span className="font-bold text-slate-800 block">{p.motivo}</span>
                        <span className="text-[11px] text-slate-500 flex items-center gap-1">
                          <Clock className="w-3 h-3 text-slate-400" />
                          {p.tipoRango === 'dia_completo' ? 'Jornada Completa' : `${p.horaInicio} a ${p.horaFin}`}
                        </span>
                      </div>
                    </td>
                    <td className="py-3 px-4 text-center">
                      {p.archivoPdfBase64 ? (
                        <button
                          type="button"
                          onClick={() => setPdfPreview({ url: p.archivoPdfBase64!, title: `Soporte: ${p.nombreCompleto}` })}
                          className="inline-flex items-center gap-1 px-2.5 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 rounded-lg font-bold text-[11px] border border-emerald-200 transition-colors shadow-2xs"
                        >
                          <FileText className="w-3.5 h-3.5 text-emerald-600" />
                          <span>Ver PDF</span>
                        </button>
                      ) : (
                        <span className="text-slate-400 text-[11px]">Sin soporte</span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-center">
                      <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 font-bold rounded-md text-[10px] uppercase">
                        {p.estado}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-center">
                      <div className="flex items-center justify-center gap-1">
                        <button
                          type="button"
                          onClick={() => setEditingPermission(p)}
                          className="p-1.5 text-purple-600 hover:text-purple-800 hover:bg-purple-100 rounded-lg transition-colors"
                          title="Editar permiso"
                        >
                          <Edit3 className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDelete(p.id)}
                          className="p-1.5 text-rose-500 hover:text-rose-700 hover:bg-rose-100 rounded-lg transition-colors"
                          title="Eliminar permiso"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal para editar */}
      {editingPermission && (
        <PermissionModal
          student={{
            id: editingPermission.studentId,
            codigo: editingPermission.codigo,
            nombres: editingPermission.nombres,
            apellidos: editingPermission.apellidos,
            nombreCompleto: editingPermission.nombreCompleto,
            cursoId: editingPermission.cursoId,
            anioEscolarId: editingPermission.anioEscolarId,
            year: editingPermission.year,
            activo: true,
            createdAt: editingPermission.createdAt,
            updatedAt: editingPermission.updatedAt
          }}
          courseName={editingPermission.cursoNombre}
          schoolYear={schoolYear}
          initialDate={editingPermission.fecha}
          existingPermission={editingPermission}
          currentUserEmail={user.email || 'Coordinación'}
          onClose={() => setEditingPermission(null)}
          onSaved={(saved) => {
            setPermissions(prev => prev.map(p => p.id === saved.id ? saved : p));
          }}
        />
      )}

      {/* Modal de previsualización PDF */}
      {pdfPreview && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-4xl w-full h-[88vh] shadow-2xl flex flex-col overflow-hidden border border-slate-200">
            <div className="px-5 py-3.5 bg-slate-900 text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FileText className="w-5 h-5 text-emerald-400" />
                <span className="font-bold text-sm">{pdfPreview.title}</span>
              </div>
              <button
                type="button"
                onClick={() => setPdfPreview(null)}
                className="p-1 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="flex-1 bg-slate-100 p-2">
              <iframe
                src={pdfPreview.url}
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
