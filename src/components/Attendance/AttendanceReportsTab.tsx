import React, { useState, useEffect, useMemo } from 'react';
import { User } from 'firebase/auth';
import { 
  FileText, 
  FileDown, 
  Download, 
  Calendar, 
  Users, 
  BookOpen, 
  UserCheck, 
  CheckCircle2, 
  AlertTriangle, 
  Loader2, 
  ShieldCheck,
  Building,
  Check,
  Eye
} from 'lucide-react';
import { 
  StudentRecord, 
  SchoolGroupRecord, 
  TeacherRecord, 
  AttendanceSessionRecord, 
  AusentismoConfig,
  AcademicYearConfigRecord
} from '../../types';
import { 
  getStudentsByCourse, 
  getAttendanceSessionsByFilter,
  calculateAttendanceMetrics,
  getStoredAusentismoConfig
} from '../../utils/attendanceService';
import { downloadAttendanceReportPdf } from '../../utils/attendancePdfExport';

interface AttendanceReportsTabProps {
  user: User;
  schoolYear: number;
  yearConfig: AcademicYearConfigRecord;
  availableGroups: SchoolGroupRecord[];
  teachers: TeacherRecord[];
  subjects: string[];
}

export function AttendanceReportsTab({
  user,
  schoolYear,
  yearConfig,
  availableGroups,
  teachers,
  subjects
}: AttendanceReportsTabProps) {
  const [selectedGroupId, setSelectedGroupId] = useState<string>(availableGroups[0]?.id || '');
  const [selectedSubject, setSelectedSubject] = useState<string>('all');
  const [selectedTeacherId, setSelectedTeacherId] = useState<string>('all');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [reportType, setReportType] = useState<'matrix' | 'executive'>('matrix');

  const [students, setStudents] = useState<StudentRecord[]>([]);
  const [sessions, setSessions] = useState<AttendanceSessionRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const config = getStoredAusentismoConfig();

  // Load students & sessions for selected course
  useEffect(() => {
    if (!selectedGroupId) return;
    let isMounted = true;
    setLoading(true);

    Promise.all([
      getStudentsByCourse(schoolYear, selectedGroupId),
      getAttendanceSessionsByFilter({
        year: schoolYear,
        cursoId: selectedGroupId,
        asignaturaId: selectedSubject,
        docenteId: selectedTeacherId,
        startDate: startDate || undefined,
        endDate: endDate || undefined
      })
    ]).then(([stList, sessList]) => {
      if (!isMounted) return;
      setStudents(stList.filter(s => s.activo));
      setSessions(sessList);
    }).catch(e => {
      console.error("Error loading report preview:", e);
    }).finally(() => {
      if (isMounted) setLoading(false);
    });

    return () => { isMounted = false; };
  }, [schoolYear, selectedGroupId, selectedSubject, selectedTeacherId, startDate, endDate]);

  const metrics = useMemo(() => {
    return calculateAttendanceMetrics(students, sessions, config);
  }, [students, sessions, config]);

  const selectedGroupObj = availableGroups.find(g => g.id === selectedGroupId);
  const selectedTeacherObj = teachers.find(t => t.id === selectedTeacherId);

  const handleDownloadPdf = async () => {
    setIsExporting(true);
    try {
      await downloadAttendanceReportPdf({
        schoolYear,
        courseName: selectedGroupObj?.displayName || selectedGroupId,
        subjectName: selectedSubject === 'all' ? 'Todas las asignaturas' : selectedSubject,
        teacherName: selectedTeacherId === 'all' ? 'Todos los docentes' : (selectedTeacherObj?.fullName || selectedTeacherId),
        startDate,
        endDate,
        students,
        sessions,
        config,
        reportType
      });
    } catch (err: any) {
      alert(`Error al generar el informe PDF: ${err.message || err}`);
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Configuration Header Card */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-6">
        <div className="flex items-center gap-3 pb-4 border-b border-slate-100">
          <div className="p-3 bg-purple-600 text-white rounded-2xl shadow-xs">
            <FileText className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-lg font-black text-slate-900 tracking-tight">
              Generación de Informes Oficiales en PDF
            </h3>
            <p className="text-xs text-slate-500">
              Personaliza los parámetros para descargar el acta oficial de asistencia y ausentismo estudiantil
            </p>
          </div>
        </div>

        {/* Filters Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Curso */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
              <Users className="w-3.5 h-3.5 text-purple-600" />
              <span>Curso / Grupo *</span>
            </label>
            <select
              value={selectedGroupId}
              onChange={(e) => setSelectedGroupId(e.target.value)}
              className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-purple-500"
            >
              {availableGroups.map(g => (
                <option key={g.id} value={g.id}>
                  {g.displayName} ({g.gradeName})
                </option>
              ))}
            </select>
          </div>

          {/* Asignatura */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
              <BookOpen className="w-3.5 h-3.5 text-purple-600" />
              <span>Asignatura</span>
            </label>
            <select
              value={selectedSubject}
              onChange={(e) => setSelectedSubject(e.target.value)}
              className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-purple-500"
            >
              <option value="all">Todas las Asignaturas</option>
              {subjects.map(s => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>

          {/* Docente */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
              <UserCheck className="w-3.5 h-3.5 text-purple-600" />
              <span>Docente</span>
            </label>
            <select
              value={selectedTeacherId}
              onChange={(e) => setSelectedTeacherId(e.target.value)}
              className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-purple-500"
            >
              <option value="all">Todos los Docentes</option>
              {teachers.map(t => (
                <option key={t.id} value={t.id}>{t.fullName}</option>
              ))}
            </select>
          </div>

          {/* Rango de Fechas */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5 text-purple-600" />
              <span>Rango de Fechas</span>
            </label>
            <div className="grid grid-cols-2 gap-1.5">
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                placeholder="Desde"
                className="w-full px-2 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-[11px] font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-purple-500"
              />
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                placeholder="Hasta"
                className="w-full px-2 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-[11px] font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-purple-500"
              />
            </div>
          </div>
        </div>

        {/* Selector de Tipo / Formato de Informe */}
        <div className="pt-3 border-t border-slate-100 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="space-y-0.5">
            <span className="text-xs font-bold text-slate-800 block">Formato del Documento PDF:</span>
            <span className="text-[11px] text-slate-500">Selecciona entre la Sábana de Control por Fechas con Presente/Ausente o el Informe Ejecutivo</span>
          </div>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-1.5 bg-slate-100 p-1 rounded-xl border border-slate-200 w-full sm:w-auto">
            <button
              type="button"
              onClick={() => setReportType('matrix')}
              className={`px-3 py-2 rounded-lg text-xs font-bold transition-all text-center ${
                reportType === 'matrix'
                  ? 'bg-purple-700 text-white shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Sábana por Fechas (Presente / Ausente)
            </button>
            <button
              type="button"
              onClick={() => setReportType('executive')}
              className={`px-3 py-2 rounded-lg text-xs font-bold transition-all text-center ${
                reportType === 'executive'
                  ? 'bg-purple-700 text-white shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Informe Ejecutivo y Semáforo
            </button>
          </div>
        </div>
      </div>

      {/* Live Preview Card Before Download */}
      <div className="bg-white p-4 sm:p-6 rounded-2xl border border-slate-200 shadow-xs space-y-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <Eye className="w-5 h-5 text-purple-600 shrink-0" />
            <div>
              <h4 className="font-bold text-slate-900 text-sm">
                Vista Previa: {reportType === 'matrix' ? 'Sábana de Control por Fechas' : 'Resumen Estadístico Oficial'}
              </h4>
              <p className="text-xs text-slate-400">
                {reportType === 'matrix'
                  ? 'Matriz horizontal con registro (Presente / Ausente) por fecha de sesión y totales'
                  : 'Indicadores oficiales, casos críticos y semáforo de ausentismo institucional'}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={handleDownloadPdf}
            disabled={isExporting || students.length === 0}
            className="w-full sm:w-auto flex items-center justify-center gap-2 px-6 py-2.5 bg-purple-700 hover:bg-purple-800 text-white rounded-xl text-xs font-black transition-all shadow-xs hover:scale-102 active:scale-98 disabled:opacity-50"
          >
            {isExporting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin shrink-0" />
                <span>Generando Documento PDF...</span>
              </>
            ) : (
              <>
                <FileDown className="w-4 h-4 shrink-0" />
                <span>
                  {reportType === 'matrix'
                    ? 'Descargar Sábana por Fechas (PDF)'
                    : 'Descargar Informe Ejecutivo (PDF)'}
                </span>
              </>
            )}
          </button>
        </div>

        {loading ? (
          <div className="py-12 text-center text-slate-400 flex flex-col items-center justify-center gap-2">
            <Loader2 className="w-6 h-6 animate-spin text-purple-600" />
            <span className="text-xs font-bold">Cargando métricas del informe...</span>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Highlights Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 text-center">
                <span className="text-[10px] text-slate-500 font-bold uppercase block">Estudiantes</span>
                <strong className="text-xl text-slate-900">{metrics.totalStudentsCount}</strong>
              </div>
              <div className="p-4 bg-indigo-50 rounded-2xl border border-indigo-200 text-center">
                <span className="text-[10px] text-indigo-600 font-bold uppercase block">Sesiones de Clase</span>
                <strong className="text-xl text-indigo-700">{metrics.sessionsCount}</strong>
              </div>
              <div className="p-4 bg-emerald-50 rounded-2xl border border-emerald-200 text-center">
                <span className="text-[10px] text-emerald-600 font-bold uppercase block">Asistencia Global</span>
                <strong className="text-xl text-emerald-700">{metrics.porcentajeAsistencia}%</strong>
              </div>
              <div className="p-4 bg-rose-50 rounded-2xl border border-rose-200 text-center">
                <span className="text-[10px] text-rose-600 font-bold uppercase block">Ausentismo Global</span>
                <strong className="text-xl text-rose-700">{metrics.porcentajeAusentismo}%</strong>
              </div>
            </div>

            {/* Sections Included Overview */}
            <div className="p-4 bg-slate-50/70 border border-slate-200 rounded-2xl space-y-3">
              <h5 className="font-bold text-xs text-slate-700 uppercase tracking-wider">
                Estructura del Informe Generado (Normativa y Diseño Institucional):
              </h5>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs text-slate-600">
                <div className="flex items-start gap-2 bg-white p-3 rounded-xl border border-slate-200">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                  <div>
                    <strong className="text-slate-800 block">Encabezado y Escudo Institucional</strong>
                    <span>I. E. Juan Pablo I, Municipio de La Llanada (Nariño), Vigencia {schoolYear} y fecha de expedición.</span>
                  </div>
                </div>

                <div className="flex items-start gap-2 bg-white p-3 rounded-xl border border-slate-200">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                  <div>
                    <strong className="text-slate-800 block">Sección 1. Resumen Estadístico Oficial</strong>
                    <span>Estudiantes matriculados, sesiones evaluadas, asistencia efectiva e inasistencias.</span>
                  </div>
                </div>

                <div className="flex items-start gap-2 bg-white p-3 rounded-xl border border-slate-200">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                  <div>
                    <strong className="text-slate-800 block">Sección 2. Análisis por Asignatura</strong>
                    <span>Comparativa del ausentismo en cada asignatura evaluada durante el periodo.</span>
                  </div>
                </div>

                <div className="flex items-start gap-2 bg-white p-3 rounded-xl border border-slate-200">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                  <div>
                    <strong className="text-slate-800 block">Sección 3. Seguimiento Individual y Semáforo</strong>
                    <span>Tabla completa estudiante por estudiante con conteo de faltas y nivel de alerta.</span>
                  </div>
                </div>

                <div className="flex items-start gap-2 bg-white p-3 rounded-xl border border-slate-200">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                  <div>
                    <strong className="text-slate-800 block">Sección 4. Observaciones Descriptivas Automáticas</strong>
                    <span>Síntesis objetiva generada a partir de los datos reales para el comité académico.</span>
                  </div>
                </div>

                <div className="flex items-start gap-2 bg-white p-3 rounded-xl border border-slate-200">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                  <div>
                    <strong className="text-slate-800 block">Sección 5. Responsables y Firmas</strong>
                    <span>Espacios para Docente Titular, Coordinación Académica y Rectoría Institucional.</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
