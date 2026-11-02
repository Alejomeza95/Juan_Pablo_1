import React, { useState, useEffect, useMemo } from 'react';
import { User } from 'firebase/auth';
import { 
  FileDown, 
  FileText, 
  Users, 
  Calendar, 
  CheckCircle2, 
  Building, 
  Download, 
  Loader2, 
  Eye, 
  Clock 
} from 'lucide-react';
import { 
  SchoolGroupRecord, 
  AcademicPermissionRecord, 
  AcademicYearConfigRecord 
} from '../../types';
import { 
  getPermissionsByCourse, 
  getPermissionsByDate 
} from '../../utils/academicPermissionsService';
import { 
  downloadCoursePermissionsPdf, 
  downloadGlobalPermissionsByDatePdf 
} from '../../utils/permissionsPdfExport';

interface PermissionsReportsTabProps {
  user: User;
  schoolYear: number;
  yearConfig: AcademicYearConfigRecord;
  availableGroups: SchoolGroupRecord[];
}

export function PermissionsReportsTab({
  user,
  schoolYear,
  yearConfig,
  availableGroups
}: PermissionsReportsTabProps) {
  // Report 1: Course Report State
  const [courseGroupId, setCourseGroupId] = useState<string>(() => availableGroups[0]?.id || '');
  const [courseStartDate, setCourseStartDate] = useState<string>('');
  const [courseEndDate, setCourseEndDate] = useState<string>('');
  const [coursePermissions, setCoursePermissions] = useState<AcademicPermissionRecord[]>([]);
  const [loadingCourseData, setLoadingCourseData] = useState(false);
  const [exportingCourse, setExportingCourse] = useState(false);

  useEffect(() => {
    if (availableGroups.length > 0) {
      if (!courseGroupId || !availableGroups.some(g => g.id === courseGroupId)) {
        setCourseGroupId(availableGroups[0].id);
      }
    }
  }, [availableGroups, courseGroupId]);

  // Report 2: Global Daily Report State
  const [globalDate, setGlobalDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [globalPermissions, setGlobalPermissions] = useState<AcademicPermissionRecord[]>([]);
  const [loadingGlobalData, setLoadingGlobalData] = useState(false);
  const [exportingGlobal, setExportingGlobal] = useState(false);

  // Load Course Permissions
  useEffect(() => {
    if (!courseGroupId) return;
    setLoadingCourseData(true);
    getPermissionsByCourse(schoolYear, courseGroupId)
      .then(data => {
        let filtered = data;
        if (courseStartDate) filtered = filtered.filter(p => p.fecha >= courseStartDate);
        if (courseEndDate) filtered = filtered.filter(p => p.fecha <= courseEndDate);
        setCoursePermissions(filtered);
      })
      .catch(e => console.error(e))
      .finally(() => setLoadingCourseData(false));
  }, [schoolYear, courseGroupId, courseStartDate, courseEndDate]);

  // Load Global Permissions for selected date
  useEffect(() => {
    if (!globalDate) return;
    setLoadingGlobalData(true);
    getPermissionsByDate(schoolYear, globalDate)
      .then(data => setGlobalPermissions(data))
      .catch(e => console.error(e))
      .finally(() => setLoadingGlobalData(false));
  }, [schoolYear, globalDate]);

  const selectedGroupObj = availableGroups.find(g => g.id === courseGroupId);

  const handleExportCoursePdf = async () => {
    setExportingCourse(true);
    try {
      await downloadCoursePermissionsPdf({
        schoolYear,
        courseName: selectedGroupObj?.displayName || courseGroupId,
        permissions: coursePermissions,
        startDate: courseStartDate,
        endDate: courseEndDate
      });
    } catch (e: any) {
      alert(`Error al generar el informe por curso: ${e.message || e}`);
    } finally {
      setExportingCourse(false);
    }
  };

  const handleExportGlobalPdf = async () => {
    setExportingGlobal(true);
    try {
      await downloadGlobalPermissionsByDatePdf({
        schoolYear,
        date: globalDate,
        permissions: globalPermissions
      });
    } catch (e: any) {
      alert(`Error al generar el informe global diario: ${e.message || e}`);
    } finally {
      setExportingGlobal(false);
    }
  };

  return (
    <div className="space-y-8">
      {/* SECCIÓN 1: INFORME DE PERMISOS POR CURSO */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-5">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-purple-600 text-white rounded-xl shadow-xs">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-black text-slate-900 text-base">
                1. Informe Oficial de Permisos Académicos por Curso
              </h3>
              <p className="text-xs text-slate-500">
                Genera el acta en PDF con el historial de permisos de un curso específico y sus firmas
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={handleExportCoursePdf}
            disabled={exportingCourse || coursePermissions.length === 0}
            className="w-full sm:w-auto flex items-center justify-center gap-2 px-5 py-2.5 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs font-black transition-all shadow-xs hover:scale-102 active:scale-98 disabled:opacity-50"
          >
            {exportingCourse ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin shrink-0" />
                <span>Generando Acta PDF...</span>
              </>
            ) : (
              <>
                <FileDown className="w-4 h-4 shrink-0" />
                <span>Descargar Informe por Curso (PDF)</span>
              </>
            )}
          </button>
        </div>

        {/* Filtros del Curso */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
              <Users className="w-3.5 h-3.5 text-purple-600" />
              <span>Curso / Grupo *</span>
            </label>
            <select
              value={courseGroupId}
              onChange={(e) => setCourseGroupId(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-purple-500"
            >
              {availableGroups.map(g => (
                <option key={g.id} value={g.id}>{g.displayName}</option>
              ))}
            </select>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5 text-purple-600" />
              <span>Desde (Opcional)</span>
            </label>
            <input
              type="date"
              value={courseStartDate}
              onChange={(e) => setCourseStartDate(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-purple-500"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5 text-purple-600" />
              <span>Hasta (Opcional)</span>
            </label>
            <input
              type="date"
              value={courseEndDate}
              onChange={(e) => setCourseEndDate(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-purple-500"
            />
          </div>
        </div>

        {/* Vista previa pequeña */}
        <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
          <div className="flex items-center gap-2">
            <Eye className="w-4 h-4 text-purple-600 shrink-0" />
            <span className="font-bold text-slate-700">
              Registros a incluir en el acta: {coursePermissions.length} permiso(s)
            </span>
          </div>
          <span className="text-slate-500 font-medium text-[11px] sm:text-xs">
            Formato: Acta Vertical con Membrete y Firmas de Rectoría, Coordinación y Director de Grupo
          </span>
        </div>
      </div>

      {/* SECCIÓN 2: AUTORIZACIÓN AUSENCIA ESCOLAR (TODOS LOS GRADOS POR FECHA) */}
      <div className="bg-white p-4 sm:p-6 rounded-2xl border border-slate-200 shadow-xs space-y-5">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-indigo-600 text-white rounded-xl shadow-xs shrink-0">
              <Building className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-black text-slate-900 text-base">
                2. Autorización Ausencia Escolar (Diario - Todos los Grados)
              </h3>
              <p className="text-xs text-slate-500">
                Descarga el informe oficial diario con todos los permisos del día discriminados por grado y con el motivo de la ausencia
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={handleExportGlobalPdf}
            disabled={exportingGlobal || globalPermissions.length === 0}
            className="w-full sm:w-auto flex items-center justify-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-black transition-all shadow-xs hover:scale-102 active:scale-98 disabled:opacity-50"
          >
            {exportingGlobal ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin shrink-0" />
                <span>Generando Autorización PDF...</span>
              </>
            ) : (
              <>
                <FileDown className="w-4 h-4 shrink-0" />
                <span>Descargar Autorización Ausencia Escolar (PDF)</span>
              </>
            )}
          </button>
        </div>

        {/* Selector de Fecha Global */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5 text-indigo-600" />
              <span>Fecha del Día a Consultar *</span>
            </label>
            <input
              type="date"
              value={globalDate}
              onChange={(e) => setGlobalDate(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div className="p-4 bg-indigo-50/70 border border-indigo-100 rounded-xl flex items-center justify-between text-xs">
            <div>
              <span className="text-[10px] uppercase font-bold text-indigo-700 block">Estudiantes con permiso el {globalDate}</span>
              <strong className="text-lg text-indigo-950">{globalPermissions.length} Estudiantes Autorizados</strong>
            </div>
            <span className="px-2.5 py-1 bg-indigo-200 text-indigo-800 font-bold rounded-lg text-[10px]">
              {Array.from(new Set(globalPermissions.map(p => p.cursoNombre))).length} Cursos Involucrados
            </span>
          </div>
        </div>

        {/* Tabla preliminar de permisos del día con las columnas exactas del reporte */}
        {loadingGlobalData ? (
          <div className="py-8 text-center text-slate-400 flex items-center justify-center gap-2">
            <Loader2 className="w-5 h-5 animate-spin text-indigo-600" />
            <span className="text-xs">Cargando permisos de la fecha...</span>
          </div>
        ) : globalPermissions.length === 0 ? (
          <div className="py-6 text-center text-slate-400 bg-slate-50 rounded-xl border border-slate-100 text-xs font-medium">
            No se han registrado permisos académicos en la institución para la fecha {globalDate}.
          </div>
        ) : (
          <div className="border border-slate-200 rounded-xl overflow-hidden shadow-2xs">
            <div className="bg-slate-900 text-white px-4 py-2.5 flex items-center justify-between text-xs">
              <span className="font-bold">
                Vista previa: Autorización Ausencia Escolar ({globalDate})
              </span>
              <span className="text-[11px] text-slate-300">
                Discriminado por grado • {globalPermissions.length} registro(s)
              </span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[650px] text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-100 border-b border-slate-200 text-slate-700 font-bold uppercase tracking-wider text-[11px]">
                    <th className="py-2.5 px-3 w-10 text-center">N°</th>
                    <th className="py-2.5 px-3">Nombre</th>
                    <th className="py-2.5 px-3 text-center w-24">Grado</th>
                    <th className="py-2.5 px-3 text-center w-28">Fecha</th>
                    <th className="py-2.5 px-3">Motivo de la Ausencia</th>
                    <th className="py-2.5 px-3 text-center w-28">Horario</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {globalPermissions.map((p, i) => (
                    <tr key={p.id} className="hover:bg-slate-50 transition-colors">
                      <td className="py-2.5 px-3 text-center text-slate-400 font-bold">{i + 1}</td>
                      <td className="py-2.5 px-3 font-bold text-slate-900 uppercase">{p.nombreCompleto}</td>
                      <td className="py-2.5 px-3 text-center font-bold text-indigo-700">
                        <span className="px-2 py-0.5 bg-indigo-50 border border-indigo-200 rounded-md">
                          {p.cursoId ? p.cursoId.replace(/[°\s]/g, '').toUpperCase() : p.cursoNombre}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-center text-slate-600 font-mono">
                        {p.fecha.split('-').reverse().join('/')}
                      </td>
                      <td className="py-2.5 px-3 text-slate-800">{p.motivo}</td>
                      <td className="py-2.5 px-3 text-center text-slate-500 text-[11px]">
                        {p.tipoRango === 'dia_completo' ? 'Jornada completa' : `${p.horaInicio} - ${p.horaFin}`}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
