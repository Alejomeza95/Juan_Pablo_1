import React, { useState, useEffect, useMemo } from 'react';
import { User } from 'firebase/auth';
import { 
  BarChart3, 
  TrendingDown, 
  Users, 
  Calendar, 
  FileDown, 
  CheckCircle2, 
  XCircle, 
  AlertTriangle, 
  SlidersHorizontal, 
  Search, 
  Settings2, 
  Clock, 
  Filter, 
  Loader2, 
  RefreshCw,
  PieChart as PieChartIcon,
  HelpCircle,
  X,
  Check
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
  getStoredAusentismoConfig,
  saveStoredAusentismoConfig,
  DEFAULT_AUSENTISMO_CONFIG
} from '../../utils/attendanceService';
import { downloadAttendanceReportPdf } from '../../utils/attendancePdfExport';
import { ADMIN_EMAIL } from '../../firebase';
import { AbsenteeismCausesDashboard } from './AbsenteeismCausesDashboard';

interface AbsenteeismDashboardTabProps {
  user: User;
  schoolYear: number;
  yearConfig: AcademicYearConfigRecord;
  availableGroups: SchoolGroupRecord[];
  teachers: TeacherRecord[];
  subjects: string[];
}

export function AbsenteeismDashboardTab({
  user,
  schoolYear,
  yearConfig,
  availableGroups,
  teachers,
  subjects
}: AbsenteeismDashboardTabProps) {
  const isAdmin = user.email === ADMIN_EMAIL;

  // View mode switcher: 'causas' (Estudiantes con más ausentismo y causas con permisos) vs 'graficos' (Gráficas institucionales)
  const [viewMode, setViewMode] = useState<'causas' | 'graficos'>('causas');

  // Filters
  const [selectedGroupId, setSelectedGroupId] = useState<string>('all');
  const [selectedSubject, setSelectedSubject] = useState<string>('all');
  const [selectedTeacherId, setSelectedTeacherId] = useState<string>('all');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [studentSearchTerm, setStudentSearchTerm] = useState<string>('');
  const [selectedStudentFilter, setSelectedStudentFilter] = useState<string>('all');

  // Data
  const [students, setStudents] = useState<StudentRecord[]>([]);
  const [sessions, setSessions] = useState<AttendanceSessionRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [config, setConfig] = useState<AusentismoConfig>(getStoredAusentismoConfig());
  
  // Config Modal
  const [showConfigModal, setShowConfigModal] = useState(false);
  const [tempConfig, setTempConfig] = useState<AusentismoConfig>(config);
  const [isSavingConfig, setIsSavingConfig] = useState(false);

  // PDF Export loading
  const [isExportingPdf, setIsExportingPdf] = useState(false);

  // Load Data based on filters
  const loadDashboardData = async () => {
    setLoading(true);
    try {
      // 1. Fetch sessions
      const fetchedSessions = await getAttendanceSessionsByFilter({
        year: schoolYear,
        cursoId: selectedGroupId,
        asignaturaId: selectedSubject,
        docenteId: selectedTeacherId,
        startDate: startDate || undefined,
        endDate: endDate || undefined
      });
      setSessions(fetchedSessions);

      // 2. Fetch students for course (or all courses if 'all')
      if (selectedGroupId && selectedGroupId !== 'all') {
        const courseStudents = await getStudentsByCourse(schoolYear, selectedGroupId);
        setStudents(courseStudents);
      } else {
        // Collect from all groups
        const allStudentsPromises = availableGroups.map(g => getStudentsByCourse(schoolYear, g.id));
        const allResults = await Promise.all(allStudentsPromises);
        const flattened = allResults.flat();
        // Remove potential duplicates
        const unique = Array.from(new Map(flattened.map(s => [s.id, s])).values());
        setStudents(unique);
      }
    } catch (e) {
      console.error("Error loading dashboard data:", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDashboardData();
  }, [schoolYear, selectedGroupId, selectedSubject, selectedTeacherId, startDate, endDate]);

  // Quick Date presets
  const handleQuickDatePreset = (preset: 'today' | 'week' | 'month' | 'all') => {
    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];

    if (preset === 'today') {
      setStartDate(todayStr);
      setEndDate(todayStr);
    } else if (preset === 'week') {
      const d = new Date(today);
      const day = d.getDay() || 7; // Sunday = 7
      d.setDate(d.getDate() - day + 1); // Monday
      setStartDate(d.toISOString().split('T')[0]);
      setEndDate(todayStr);
    } else if (preset === 'month') {
      const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().split('T')[0];
      setStartDate(startOfMonth);
      setEndDate(todayStr);
    } else {
      setStartDate('');
      setEndDate('');
    }
  };

  // Filter students if an individual student filter is applied
  const filteredStudentsForMetrics = useMemo(() => {
    if (selectedStudentFilter === 'all') return students;
    return students.filter(s => s.id === selectedStudentFilter);
  }, [students, selectedStudentFilter]);

  // Compute Metrics
  const metrics = useMemo(() => {
    return calculateAttendanceMetrics(filteredStudentsForMetrics, sessions, config);
  }, [filteredStudentsForMetrics, sessions, config]);

  // Student summary table filtering & sorting
  const [tableSortColumn, setTableSortColumn] = useState<'inasistencias' | 'porcentajeAusentismo' | 'apellidos'>('inasistencias');
  const [tableSortAsc, setTableSortAsc] = useState<boolean>(false);

  const displayedStudentSummaries = useMemo(() => {
    return metrics.studentSummaries
      .filter(item => {
        if (!studentSearchTerm) return true;
        const term = studentSearchTerm.toLowerCase();
        return (
          item.student.codigo.toLowerCase().includes(term) ||
          item.student.nombreCompleto.toLowerCase().includes(term) ||
          item.student.cursoId.toLowerCase().includes(term)
        );
      })
      .sort((a, b) => {
        if (tableSortColumn === 'inasistencias') {
          return tableSortAsc ? a.inasistencias - b.inasistencias : b.inasistencias - a.inasistencias;
        } else if (tableSortColumn === 'porcentajeAusentismo') {
          return tableSortAsc ? a.porcentajeAusentismo - b.porcentajeAusentismo : b.porcentajeAusentismo - a.porcentajeAusentismo;
        } else {
          return tableSortAsc 
            ? a.student.apellidos.localeCompare(b.student.apellidos)
            : b.student.apellidos.localeCompare(a.student.apellidos);
        }
      });
  }, [metrics.studentSummaries, studentSearchTerm, tableSortColumn, tableSortAsc]);

  // Handle PDF Export
  const handleExportPdf = async () => {
    setIsExportingPdf(true);
    try {
      const groupObj = availableGroups.find(g => g.id === selectedGroupId);
      const courseLabel = selectedGroupId === 'all' ? 'Todos los Cursos de la Institución' : (groupObj?.displayName || selectedGroupId);
      const teacherObj = teachers.find(t => t.id === selectedTeacherId);
      const teacherLabel = selectedTeacherId === 'all' ? 'Todos los Docentes' : (teacherObj?.fullName || selectedTeacherId);

      await downloadAttendanceReportPdf({
        schoolYear,
        courseName: courseLabel,
        subjectName: selectedSubject === 'all' ? 'Todas las asignaturas' : selectedSubject,
        teacherName: teacherLabel,
        startDate,
        endDate,
        students: filteredStudentsForMetrics,
        sessions,
        config
      });
    } catch (e: any) {
      alert(`Error al generar informe PDF: ${e.message || e}`);
    } finally {
      setIsExportingPdf(false);
    }
  };

  // Save Thresholds
  const handleSaveThresholds = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSavingConfig(true);
    try {
      await saveStoredAusentismoConfig(tempConfig);
      setConfig(tempConfig);
      setShowConfigModal(false);
    } catch (e) {
      console.error("Error saving thresholds:", e);
    } finally {
      setIsSavingConfig(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Subnav Switch between Causas & Permisos and Métricas Generales */}
      <div className="bg-white p-2 sm:p-2.5 rounded-2xl border border-slate-200 shadow-xs flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 w-full md:w-auto">
          <button
            type="button"
            onClick={() => setViewMode('causas')}
            className={`flex items-center justify-center gap-2 px-3.5 py-2.5 rounded-xl text-xs font-black transition-all ${
              viewMode === 'causas'
                ? 'bg-purple-700 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            <TrendingDown className="w-4 h-4 text-amber-300 shrink-0" />
            <span className="text-left sm:text-center">Estudiantes con Mayor Ausentismo y Causas (Permisos)</span>
          </button>

          <button
            type="button"
            onClick={() => setViewMode('graficos')}
            className={`flex items-center justify-center gap-2 px-3.5 py-2.5 rounded-xl text-xs font-black transition-all ${
              viewMode === 'graficos'
                ? 'bg-purple-700 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            <BarChart3 className="w-4 h-4 shrink-0" />
            <span className="text-left sm:text-center">Métricas Generales y Gráficas de Asistencia</span>
          </button>
        </div>

        <span className="text-xs text-slate-400 font-semibold pr-3 hidden md:inline">
          Vigencia {schoolYear} • I. E. Juan Pablo I
        </span>
      </div>

      {viewMode === 'causas' ? (
        <AbsenteeismCausesDashboard
          user={user}
          schoolYear={schoolYear}
          yearConfig={yearConfig}
          availableGroups={availableGroups}
          teachers={teachers}
          subjects={subjects}
        />
      ) : (
        <>
          {/* Top Filter Bar & PDF Export CTA */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-purple-600 text-white rounded-xl shadow-xs">
                  <BarChart3 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-black text-slate-900 text-base">
                    Dashboard de Ausentismo y Asistencia Estudiantil
                  </h3>
                  <p className="text-xs text-slate-500">
                    Filtra por curso, asignatura, docente y rango de fechas para el análisis institucional
                  </p>
                </div>
              </div>

          <div className="flex items-center gap-2.5">
            {isAdmin && (
              <button
                type="button"
                onClick={() => {
                  setTempConfig(config);
                  setShowConfigModal(true);
                }}
                className="flex items-center gap-1.5 px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-all shadow-2xs"
                title="Configurar semáforo y umbrales institucionales de inasistencia"
              >
                <Settings2 className="w-4 h-4 text-purple-600" />
                <span className="hidden sm:inline">Umbrales Semáforo</span>
              </button>
            )}

            <button
              type="button"
              onClick={loadDashboardData}
              disabled={loading}
              className="p-2 text-slate-500 hover:text-slate-800 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors"
              title="Actualizar datos"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-purple-600' : ''}`} />
            </button>

            {/* BOTÓN OBLIGATORIO: GENERAR INFORME PDF */}
            <button
              type="button"
              onClick={handleExportPdf}
              disabled={isExportingPdf || sessions.length === 0}
              className="flex items-center gap-2 px-5 py-2.5 bg-purple-700 hover:bg-purple-800 text-white rounded-xl text-xs font-black transition-all shadow-xs hover:scale-102 active:scale-98 disabled:opacity-50"
              title="Generar y descargar informe oficial de asistencia en formato PDF"
            >
              {isExportingPdf ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Generando PDF...</span>
                </>
              ) : (
                <>
                  <FileDown className="w-4 h-4" />
                  <span>GENERAR INFORME PDF</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Filters Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          {/* 1. Curso */}
          <div className="space-y-1">
            <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wider">
              Curso / Grupo:
            </label>
            <select
              value={selectedGroupId}
              onChange={(e) => setSelectedGroupId(e.target.value)}
              className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-purple-500"
            >
              <option value="all">Todos los Cursos</option>
              {availableGroups.map(g => (
                <option key={g.id} value={g.id}>
                  {g.displayName} ({g.gradeName})
                </option>
              ))}
            </select>
          </div>

          {/* 2. Asignatura */}
          <div className="space-y-1">
            <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wider">
              Asignatura:
            </label>
            <select
              value={selectedSubject}
              onChange={(e) => setSelectedSubject(e.target.value)}
              className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-purple-500"
            >
              <option value="all">Todas las Asignaturas</option>
              {subjects.map(s => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>

          {/* 3. Docente */}
          <div className="space-y-1">
            <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wider">
              Docente:
            </label>
            <select
              value={selectedTeacherId}
              onChange={(e) => setSelectedTeacherId(e.target.value)}
              className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-purple-500"
            >
              <option value="all">Todos los Docentes</option>
              {teachers.map(t => (
                <option key={t.id} value={t.id}>{t.fullName}</option>
              ))}
            </select>
          </div>

          {/* 4. Fecha Inicio */}
          <div className="space-y-1">
            <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wider">
              Fecha Desde:
            </label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-purple-500"
            />
          </div>

          {/* 5. Fecha Fin */}
          <div className="space-y-1">
            <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wider">
              Fecha Hasta:
            </label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-purple-500"
            />
          </div>
        </div>

        {/* Date presets & Student filter */}
        <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-100 text-xs">
          <div className="flex items-center gap-1.5">
            <span className="text-slate-400 font-semibold text-[11px]">Periodo rápido:</span>
            <button
              type="button"
              onClick={() => handleQuickDatePreset('today')}
              className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg font-bold text-[11px] transition-colors"
            >
              Hoy
            </button>
            <button
              type="button"
              onClick={() => handleQuickDatePreset('week')}
              className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg font-bold text-[11px] transition-colors"
            >
              Esta Semana
            </button>
            <button
              type="button"
              onClick={() => handleQuickDatePreset('month')}
              className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg font-bold text-[11px] transition-colors"
            >
              Este Mes
            </button>
            <button
              type="button"
              onClick={() => handleQuickDatePreset('all')}
              className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg font-bold text-[11px] transition-colors"
            >
              Todo el Periodo
            </button>
          </div>

          {/* Optional Individual Student Filter */}
          {students.length > 0 && (
            <div className="flex items-center gap-2">
              <span className="text-slate-400 font-semibold text-[11px]">Estudiante individual:</span>
              <select
                value={selectedStudentFilter}
                onChange={(e) => setSelectedStudentFilter(e.target.value)}
                className="px-3 py-1 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium text-slate-800"
              >
                <option value="all">Todos los estudiantes ({students.length})</option>
                {students.map(s => (
                  <option key={s.id} value={s.id}>
                    {s.nombreCompleto} ({s.codigo})
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>
      </div>

      {/* 5 MAIN STATISTICAL METRIC CARDS */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
        {/* Card 1: Total Estudiantes */}
        <div className="p-4 bg-white rounded-2xl border border-slate-200 shadow-xs space-y-1">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-[11px] font-bold uppercase tracking-wider">1. Total Estudiantes</span>
            <Users className="w-4 h-4 text-purple-600" />
          </div>
          <p className="text-2xl font-black text-slate-900 tracking-tight">
            {metrics.totalStudentsCount}
          </p>
          <span className="text-[11px] text-slate-500 block">
            Matriculados activos
          </span>
        </div>

        {/* Card 2: Sesiones Registradas */}
        <div className="p-4 bg-white rounded-2xl border border-slate-200 shadow-xs space-y-1">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-[11px] font-bold uppercase tracking-wider">2. Sesiones</span>
            <Clock className="w-4 h-4 text-indigo-600" />
          </div>
          <p className="text-2xl font-black text-slate-900 tracking-tight">
            {metrics.sessionsCount}
          </p>
          <span className="text-[11px] text-slate-500 block">
            Clases con asistencia
          </span>
        </div>

        {/* Card 3: % Asistencia */}
        <div className="p-4 bg-white rounded-2xl border border-slate-200 shadow-xs space-y-1">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-[11px] font-bold uppercase tracking-wider">3. Asistencia</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          </div>
          <p className="text-2xl font-black text-emerald-600 tracking-tight">
            {metrics.porcentajeAsistencia}%
          </p>
          <span className="text-[11px] text-emerald-700 font-semibold block">
            {metrics.totalAsistencias} asistencias efectivas
          </span>
        </div>

        {/* Card 4: % Ausentismo */}
        <div className="p-4 bg-white rounded-2xl border border-slate-200 shadow-xs space-y-1">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-[11px] font-bold uppercase tracking-wider">4. Ausentismo</span>
            <TrendingDown className="w-4 h-4 text-rose-600" />
          </div>
          <p className={`text-2xl font-black tracking-tight ${
            metrics.porcentajeAusentismo >= config.umbralRojo 
              ? 'text-rose-600' 
              : metrics.porcentajeAusentismo >= config.umbralVerde 
              ? 'text-amber-600' 
              : 'text-emerald-600'
          }`}>
            {metrics.porcentajeAusentismo}%
          </p>
          <span className="text-[11px] text-slate-500 block">
            Tasa de inasistencia periodo
          </span>
        </div>

        {/* Card 5: Total Inasistencias */}
        <div className="p-4 bg-white rounded-2xl border border-slate-200 shadow-xs space-y-1 col-span-2 sm:col-span-1">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-[11px] font-bold uppercase tracking-wider">5. Total Inasistencias</span>
            <XCircle className="w-4 h-4 text-rose-600" />
          </div>
          <p className="text-2xl font-black text-rose-600 tracking-tight">
            {metrics.totalInasistencias}
          </p>
          <span className="text-[11px] text-slate-500 block">
            Faltas de {metrics.totalEsperados} esperadas
          </span>
        </div>
      </div>

      {/* 5 CHARTS GRID */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* GRÁFICA 1: Asistencia vs. Ausentismo (Doughnut Chart) */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <h4 className="font-bold text-slate-900 text-sm flex items-center gap-2">
              <PieChartIcon className="w-4 h-4 text-purple-600" />
              <span>Gráfica 1. Asistencia vs. Ausentismo</span>
            </h4>
            <span className="text-[11px] text-slate-400 font-mono">Consolidado general</span>
          </div>

          <div className="flex flex-col sm:flex-row items-center justify-around gap-6 py-4">
            {/* SVG Doughnut */}
            <div className="relative w-44 h-44 flex items-center justify-center">
              <svg className="w-full h-full transform -rotate-90" viewBox="0 0 36 36">
                {/* Background circle */}
                <path
                  className="text-slate-100"
                  strokeWidth="3.8"
                  stroke="currentColor"
                  fill="none"
                  d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                />
                {/* Present stroke */}
                <path
                  className="text-emerald-500 transition-all duration-1000 ease-out"
                  strokeDasharray={`${metrics.porcentajeAsistencia}, 100`}
                  strokeWidth="3.8"
                  strokeLinecap="round"
                  stroke="currentColor"
                  fill="none"
                  d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                />
              </svg>
              <div className="absolute flex flex-col items-center justify-center text-center">
                <span className="text-2xl font-black text-slate-900">{metrics.porcentajeAsistencia}%</span>
                <span className="text-[10px] font-bold text-slate-400 uppercase">Asistencia</span>
              </div>
            </div>

            {/* Legend & Details */}
            <div className="space-y-3 w-full sm:w-auto">
              <div className="p-3 bg-emerald-50/70 border border-emerald-100 rounded-xl space-y-0.5">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-emerald-500" />
                  <span className="text-xs font-bold text-emerald-900">Asistencia Efectiva</span>
                </div>
                <p className="text-lg font-black text-emerald-700 pl-5">
                  {metrics.porcentajeAsistencia}% <span className="text-xs font-medium text-emerald-600">({metrics.totalAsistencias} registros)</span>
                </p>
              </div>

              <div className="p-3 bg-rose-50/70 border border-rose-100 rounded-xl space-y-0.5">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-rose-500" />
                  <span className="text-xs font-bold text-rose-900">Inasistencias (Ausentismo)</span>
                </div>
                <p className="text-lg font-black text-rose-700 pl-5">
                  {metrics.porcentajeAusentismo}% <span className="text-xs font-medium text-rose-600">({metrics.totalInasistencias} faltas)</span>
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* GRÁFICA 2: Evolución del Ausentismo (Line Chart) */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <h4 className="font-bold text-slate-900 text-sm flex items-center gap-2">
              <TrendingDown className="w-4 h-4 text-purple-600" />
              <span>Gráfica 2. Evolución del Ausentismo en el Tiempo</span>
            </h4>
            <span className="text-[11px] text-slate-400 font-mono">{metrics.evolutionData.length} fechas registradas</span>
          </div>

          {metrics.evolutionData.length === 0 ? (
            <div className="h-44 flex items-center justify-center text-xs text-slate-400">
              No hay sesiones registradas en el periodo para graficar la evolución.
            </div>
          ) : (
            <div className="space-y-2">
              <div className="h-44 flex items-end gap-2 pt-6 pb-2 px-2 border-b border-slate-200 overflow-x-auto">
                {metrics.evolutionData.map((d, i) => {
                  const barHeight = Math.max(10, Math.min(100, (d.porcentajeAusentismo / 100) * 140));
                  return (
                    <div key={i} className="flex flex-col items-center gap-1 group flex-1 min-w-[32px]">
                      <div className="text-[10px] font-bold text-slate-500 opacity-0 group-hover:opacity-100 transition-opacity">
                        {d.porcentajeAusentismo}%
                      </div>
                      <div 
                        style={{ height: `${barHeight}px` }}
                        className={`w-full rounded-t-lg transition-all ${
                          d.porcentajeAusentismo >= config.umbralRojo 
                            ? 'bg-rose-500 group-hover:bg-rose-600' 
                            : d.porcentajeAusentismo >= config.umbralVerde 
                            ? 'bg-amber-500 group-hover:bg-amber-600' 
                            : 'bg-indigo-500 group-hover:bg-indigo-600'
                        }`}
                        title={`Fecha: ${d.fecha}\nAusentismo: ${d.porcentajeAusentismo}%\nAusentes: ${d.noAsistieron} de ${d.total}`}
                      />
                      <span className="text-[9px] font-mono text-slate-400 truncate max-w-[34px]">
                        {d.fecha.slice(5)}
                      </span>
                    </div>
                  );
                })}
              </div>
              <div className="flex items-center justify-between text-[11px] text-slate-400 font-semibold px-2">
                <span>Cronología: Primera sesión</span>
                <span>Última sesión</span>
              </div>
            </div>
          )}
        </div>

        {/* GRÁFICA 3: Estudiantes con Mayor Ausentismo (Horizontal Bars) */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <h4 className="font-bold text-slate-900 text-sm flex items-center gap-2">
              <Users className="w-4 h-4 text-purple-600" />
              <span>Gráfica 3. Estudiantes con Mayor Inasistencia</span>
            </h4>
            <span className="text-[11px] text-slate-400 font-mono">Casos prioritarios</span>
          </div>

          {metrics.topAbsentStudents.length === 0 ? (
            <div className="h-48 flex items-center justify-center text-xs text-slate-400">
              Excelente: No se registran estudiantes con inasistencias en este filtro.
            </div>
          ) : (
            <div className="space-y-3">
              {metrics.topAbsentStudents.map((st, i) => {
                const maxAbsences = Math.max(...metrics.topAbsentStudents.map(s => s.inasistencias), 1);
                const barWidth = Math.round((st.inasistencias / maxAbsences) * 100);

                return (
                  <div key={i} className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-bold text-slate-800 truncate max-w-[220px]">
                        {i + 1}. {st.nombre}
                      </span>
                      <span className="font-bold text-rose-600">
                        {st.inasistencias} {st.inasistencias === 1 ? 'falta' : 'faltas'} ({st.porcentajeAusentismo}%)
                      </span>
                    </div>
                    <div className="w-full bg-slate-100 rounded-full h-2.5 overflow-hidden">
                      <div 
                        className={`h-full rounded-full transition-all ${
                          st.porcentajeAusentismo >= config.umbralRojo ? 'bg-rose-500' : 'bg-amber-500'
                        }`}
                        style={{ width: `${barWidth}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* GRÁFICA 4: Ausentismo por Asignatura (Comparative Bars) */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <h4 className="font-bold text-slate-900 text-sm flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-purple-600" />
              <span>Gráfica 4. Ausentismo por Asignatura</span>
            </h4>
            <span className="text-[11px] text-slate-400 font-mono">Comparativa de materias</span>
          </div>

          {metrics.subjectData.length === 0 ? (
            <div className="h-48 flex items-center justify-center text-xs text-slate-400">
              No hay sesiones asignadas por materia registradas en este periodo.
            </div>
          ) : (
            <div className="space-y-3">
              {metrics.subjectData.slice(0, 6).map((sub, i) => (
                <div key={i} className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold text-slate-800">{sub.asignatura}</span>
                    <span className="font-bold text-slate-700">
                      {sub.porcentajeAusentismo}% ausentismo ({sub.totalInasistencias} faltas)
                    </span>
                  </div>
                  <div className="w-full bg-slate-100 rounded-full h-2.5 overflow-hidden">
                    <div 
                      className={`h-full rounded-full transition-all ${
                        sub.porcentajeAusentismo >= config.umbralRojo 
                          ? 'bg-rose-500' 
                          : sub.porcentajeAusentismo >= config.umbralVerde 
                          ? 'bg-amber-500' 
                          : 'bg-emerald-500'
                      }`}
                      style={{ width: `${Math.min(100, Math.max(4, sub.porcentajeAusentismo))}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* GRÁFICA 5: Resumen de Asistencia por Fecha (Presentes vs Ausentes) */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-4 lg:col-span-2">
          <div className="flex items-center justify-between">
            <h4 className="font-bold text-slate-900 text-sm flex items-center gap-2">
              <Calendar className="w-4 h-4 text-purple-600" />
              <span>Gráfica 5. Resumen de Asistencia por Fecha (Presentes vs. Ausentes por Sesión)</span>
            </h4>
            <div className="flex items-center gap-3 text-xs">
              <span className="flex items-center gap-1 font-bold text-emerald-700">
                <div className="w-2.5 h-2.5 rounded-full bg-emerald-500" /> Presentes
              </span>
              <span className="flex items-center gap-1 font-bold text-rose-700">
                <div className="w-2.5 h-2.5 rounded-full bg-rose-500" /> Ausentes
              </span>
            </div>
          </div>

          {metrics.evolutionData.length === 0 ? (
            <div className="h-32 flex items-center justify-center text-xs text-slate-400">
              No hay sesiones registradas en el periodo.
            </div>
          ) : (
            <div className="space-y-2">
              <div className="h-44 flex items-end gap-2 pt-6 pb-2 px-2 border-b border-slate-200 overflow-x-auto">
                {metrics.evolutionData.map((d, i) => {
                  const maxTotal = Math.max(...metrics.evolutionData.map(e => e.total), 1);
                  const totalHeight = (d.total / maxTotal) * 130;
                  const presPct = d.total > 0 ? (d.asistieron / d.total) : 1;
                  const presHeight = totalHeight * presPct;
                  const absHeight = totalHeight - presHeight;

                  return (
                    <div key={i} className="flex flex-col items-center gap-1 group flex-1 min-w-[36px]">
                      <div className="text-[9px] font-bold text-slate-500 opacity-0 group-hover:opacity-100 transition-opacity">
                        {d.total} est.
                      </div>
                      <div 
                        style={{ height: `${totalHeight}px` }} 
                        className="w-full flex flex-col justify-end rounded-t-lg overflow-hidden"
                        title={`Fecha: ${d.fecha}\nTotal: ${d.total}\nPresentes: ${d.asistieron}\nAusentes: ${d.noAsistieron}`}
                      >
                        <div style={{ height: `${absHeight}px` }} className="bg-rose-500 w-full" />
                        <div style={{ height: `${presHeight}px` }} className="bg-emerald-500 w-full" />
                      </div>
                      <span className="text-[9px] font-mono text-slate-400 truncate max-w-[36px]">
                        {d.fecha.slice(5)}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* TABLA DE SEGUIMIENTO INDIVIDUAL */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h4 className="font-bold text-slate-900 text-sm">
              Tabla de Seguimiento Individual y Semáforo de Alerta
            </h4>
            <p className="text-xs text-slate-400">
              Semáforo institucional: Verde (&lt; {config.umbralVerde}%), Amarillo ({config.umbralVerde}% - &lt; {config.umbralRojo}%), Rojo (&ge; {config.umbralRojo}%)
            </p>
          </div>

          <div className="flex items-center gap-3 w-full sm:w-auto">
            <div className="relative w-full sm:w-64">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Buscar por código o nombre..."
                value={studentSearchTerm}
                onChange={(e) => setStudentSearchTerm(e.target.value)}
                className="w-full pl-9 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:outline-none focus:ring-2 focus:ring-purple-500 focus:bg-white"
              />
            </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold uppercase tracking-wider">
                <th className="py-3 px-4 w-12 text-center">N°</th>
                <th className="py-3 px-4 w-28">Código</th>
                <th 
                  className="py-3 px-4 cursor-pointer hover:text-slate-800"
                  onClick={() => {
                    setTableSortColumn('apellidos');
                    setTableSortAsc(!tableSortAsc);
                  }}
                >
                  Estudiante ↕
                </th>
                <th className="py-3 px-4 text-center">Curso</th>
                <th className="py-3 px-4 text-center">Sesiones</th>
                <th className="py-3 px-4 text-center">Asistencias</th>
                <th 
                  className="py-3 px-4 text-center cursor-pointer hover:text-slate-800"
                  onClick={() => {
                    setTableSortColumn('inasistencias');
                    setTableSortAsc(!tableSortAsc);
                  }}
                >
                  Inasistencias ↕
                </th>
                <th 
                  className="py-3 px-4 text-center cursor-pointer hover:text-slate-800"
                  onClick={() => {
                    setTableSortColumn('porcentajeAusentismo');
                    setTableSortAsc(!tableSortAsc);
                  }}
                >
                  % Ausentismo ↕
                </th>
                <th className="py-3 px-4 text-center">Semáforo</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {displayedStudentSummaries.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-slate-400">
                    No se encontraron estudiantes para mostrar en este criterio.
                  </td>
                </tr>
              ) : (
                displayedStudentSummaries.map((s, idx) => (
                  <tr key={s.student.id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="py-3 px-4 text-center font-bold text-slate-400">
                      {idx + 1}
                    </td>
                    <td className="py-3 px-4 font-mono font-bold text-slate-700">
                      {s.student.codigo}
                    </td>
                    <td className="py-3 px-4 font-bold text-slate-900">
                      {s.student.nombreCompleto}
                    </td>
                    <td className="py-3 px-4 text-center font-bold text-slate-600">
                      {s.student.cursoId}
                    </td>
                    <td className="py-3 px-4 text-center font-semibold text-slate-700">
                      {s.sesionesRegistradas}
                    </td>
                    <td className="py-3 px-4 text-center font-bold text-emerald-700">
                      {s.asistencias}
                    </td>
                    <td className="py-3 px-4 text-center font-bold text-rose-600">
                      {s.inasistencias}
                    </td>
                    <td className="py-3 px-4 text-center font-black">
                      <span className={
                        s.alertaNivel === 'rojo' 
                          ? 'text-rose-600' 
                          : s.alertaNivel === 'amarillo' 
                          ? 'text-amber-600' 
                          : 'text-emerald-700'
                      }>
                        {s.porcentajeAusentismo}%
                      </span>
                    </td>
                    <td className="py-3 px-4 text-center">
                      {s.alertaNivel === 'rojo' ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black bg-rose-100 text-rose-800 border border-rose-200">
                          <span className="w-1.5 h-1.5 rounded-full bg-rose-600 animate-pulse" />
                          Rojo (&ge; {config.umbralRojo}%)
                        </span>
                      ) : s.alertaNivel === 'amarillo' ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-200">
                          <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                          Amarillo ({config.umbralVerde}-{config.umbralRojo}%)
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-600" />
                          Verde (&lt; {config.umbralVerde}%)
                        </span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* MODAL: CONFIGURAR UMBRALES DE SEMÁFORO */}
      {showConfigModal && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <Settings2 className="w-5 h-5 text-purple-600" />
                <h3 className="font-bold text-base text-slate-900">
                  Configuración de Umbrales de Ausentismo
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowConfigModal(false)}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-slate-500 leading-relaxed">
              Define los porcentajes institucionales sugeridos para categorizar el nivel de alerta por ausentismo. (Valores iniciales: Verde &lt; 10%, Amarillo 10-20%, Rojo &ge; 20%).
            </p>

            <form onSubmit={handleSaveThresholds} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-emerald-800 uppercase tracking-wider flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                  <span>Umbral Verde (Máximo % ausentismo normal):</span>
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min="1"
                    max="50"
                    value={tempConfig.umbralVerde}
                    onChange={(e) => setTempConfig(prev => ({ ...prev, umbralVerde: Number(e.target.value) }))}
                    className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold focus:outline-none focus:ring-2 focus:ring-purple-500"
                  />
                  <span className="text-sm font-bold text-slate-500">%</span>
                </div>
                <span className="text-[11px] text-slate-400">Menor a este porcentaje se considera asistencia normal.</span>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-rose-800 uppercase tracking-wider flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-rose-500" />
                  <span>Umbral Rojo (Crítico &ge; %):</span>
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min="5"
                    max="100"
                    value={tempConfig.umbralRojo}
                    onChange={(e) => setTempConfig(prev => ({ ...prev, umbralRojo: Number(e.target.value) }))}
                    className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold focus:outline-none focus:ring-2 focus:ring-purple-500"
                  />
                  <span className="text-sm font-bold text-slate-500">%</span>
                </div>
                <span className="text-[11px] text-slate-400">Igual o superior a este porcentaje activa la alerta roja.</span>
              </div>

              <div className="pt-2 flex items-center justify-end gap-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowConfigModal(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSavingConfig}
                  className="flex items-center gap-1.5 px-4 py-2 bg-purple-700 hover:bg-purple-800 text-white text-xs font-bold rounded-xl shadow-xs transition-all disabled:opacity-50"
                >
                  {isSavingConfig ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                  <span>Guardar Umbrales</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
        </>
      )}
    </div>
  );
}
