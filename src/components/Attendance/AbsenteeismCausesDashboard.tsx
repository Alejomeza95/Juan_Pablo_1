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
  Search, 
  Clock, 
  Filter, 
  Loader2, 
  RefreshCw,
  FileText,
  ShieldCheck,
  ShieldAlert,
  Stethoscope,
  Home,
  Trophy,
  Car,
  Eye,
  Check,
  X,
  Plus,
  SlidersHorizontal,
  ChevronRight,
  ArrowUpDown
} from 'lucide-react';
import { 
  StudentRecord, 
  SchoolGroupRecord, 
  TeacherRecord, 
  AttendanceSessionRecord, 
  AcademicPermissionRecord, 
  AusentismoConfig,
  AcademicYearConfigRecord,
  StudentAbsenteeismWithCauses
} from '../../types';
import { 
  getStudentsByCourse, 
  getAttendanceSessionsByFilter,
  getStoredAusentismoConfig
} from '../../utils/attendanceService';
import { getAllPermissions } from '../../utils/academicPermissionsService';
import { 
  computeAbsenteeismWithCauses, 
  CAUSE_CATEGORIES, 
  CAUSE_COLORS 
} from '../../utils/absenteeismCausesService';
import { PermissionModal } from '../AcademicPermissions/PermissionModal';

interface AbsenteeismCausesDashboardProps {
  user: User;
  schoolYear: number;
  yearConfig: AcademicYearConfigRecord;
  availableGroups: SchoolGroupRecord[];
  teachers: TeacherRecord[];
  subjects: string[];
  onNavigateToAttendanceRegister?: () => void;
  onNavigateToPermissionsRegister?: () => void;
}

export function AbsenteeismCausesDashboard({
  user,
  schoolYear,
  yearConfig,
  availableGroups,
  teachers,
  subjects,
  onNavigateToAttendanceRegister,
  onNavigateToPermissionsRegister
}: AbsenteeismCausesDashboardProps) {
  // Filters
  const [selectedGroupId, setSelectedGroupId] = useState<string>('all');
  const [selectedSubject, setSelectedSubject] = useState<string>('all');
  const [selectedTeacherId, setSelectedTeacherId] = useState<string>('all');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [studentSearchTerm, setStudentSearchTerm] = useState<string>('');
  const [filterType, setFilterType] = useState<'all' | 'unjustified' | 'justified' | 'critical'>('all');

  // Raw data
  const [students, setStudents] = useState<StudentRecord[]>([]);
  const [sessions, setSessions] = useState<AttendanceSessionRecord[]>([]);
  const [permissions, setPermissions] = useState<AcademicPermissionRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [config, setConfig] = useState<AusentismoConfig>(getStoredAusentismoConfig());

  // Modal State for Student Absence Dossier
  const [selectedStudentDossier, setSelectedStudentDossier] = useState<StudentAbsenteeismWithCauses | null>(null);
  const [pdfPreviewUrl, setPdfPreviewUrl] = useState<{ url: string; title: string } | null>(null);

  // Modal to register permission directly from dossier
  const [registeringPermForStudent, setRegisteringPermForStudent] = useState<{
    student: StudentRecord;
    fecha?: string;
  } | null>(null);

  // Table sorting
  const [sortField, setSortField] = useState<'inasistencias' | 'injustificadas' | 'justificadas' | 'porcentajeAusentismo' | 'apellidos'>('inasistencias');
  const [sortAsc, setSortAsc] = useState(false);

  // Load all necessary data
  const loadData = async () => {
    setLoading(true);
    try {
      const [fetchedSessions, fetchedPermissions] = await Promise.all([
        getAttendanceSessionsByFilter({
          year: schoolYear,
          cursoId: selectedGroupId,
          asignaturaId: selectedSubject,
          docenteId: selectedTeacherId,
          startDate: startDate || undefined,
          endDate: endDate || undefined
        }),
        getAllPermissions(schoolYear)
      ]);

      setSessions(fetchedSessions);
      setPermissions(fetchedPermissions);

      // Load students
      if (selectedGroupId && selectedGroupId !== 'all') {
        const courseStudents = await getStudentsByCourse(schoolYear, selectedGroupId);
        setStudents(courseStudents);
      } else {
        const allStudentsPromises = availableGroups.map(g => getStudentsByCourse(schoolYear, g.id));
        const allResults = await Promise.all(allStudentsPromises);
        const flattened = allResults.flat();
        const unique = Array.from(new Map(flattened.map(s => [s.id, s])).values());
        setStudents(unique);
      }
    } catch (e) {
      console.error("Error al cargar datos del dashboard de ausentismo y causas:", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
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
      const day = d.getDay() || 7;
      d.setDate(d.getDate() - day + 1);
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

  // Compute enriched metrics correlating absences with permissions and causes
  const correlationData = useMemo(() => {
    return computeAbsenteeismWithCauses(students, sessions, permissions, config);
  }, [students, sessions, permissions, config]);

  // Filter and sort students for the ranking table
  const displayedStudents = useMemo(() => {
    return correlationData.studentsWithCauses
      .filter(item => {
        // Search term
        if (studentSearchTerm) {
          const term = studentSearchTerm.toLowerCase();
          const matches = 
            item.student.codigo.toLowerCase().includes(term) ||
            item.student.nombreCompleto.toLowerCase().includes(term) ||
            item.student.cursoId.toLowerCase().includes(term);
          if (!matches) return false;
        }

        // Filter type
        if (filterType === 'unjustified') {
          return item.inasistenciasInjustificadas > 0;
        } else if (filterType === 'justified') {
          return item.inasistenciasJustificadas > 0 || item.permisos.length > 0;
        } else if (filterType === 'critical') {
          return item.alertaNivel === 'rojo';
        }
        return true;
      })
      .sort((a, b) => {
        let diff = 0;
        if (sortField === 'inasistencias') {
          diff = a.inasistencias - b.inasistencias;
        } else if (sortField === 'injustificadas') {
          diff = a.inasistenciasInjustificadas - b.inasistenciasInjustificadas;
        } else if (sortField === 'justificadas') {
          diff = a.inasistenciasJustificadas - b.inasistenciasJustificadas;
        } else if (sortField === 'porcentajeAusentismo') {
          diff = a.porcentajeAusentismo - b.porcentajeAusentismo;
        } else {
          diff = a.student.apellidos.localeCompare(b.student.apellidos);
        }
        return sortAsc ? diff : -diff;
      });
  }, [correlationData.studentsWithCauses, studentSearchTerm, filterType, sortField, sortAsc]);

  const handleSort = (field: typeof sortField) => {
    if (sortField === field) {
      setSortAsc(!sortAsc);
    } else {
      setSortField(field);
      setSortAsc(false);
    }
  };

  const getCauseIcon = (cat: string) => {
    if (cat === CAUSE_CATEGORIES.SALUD) return <Stethoscope className="w-3.5 h-3.5 text-sky-600 shrink-0" />;
    if (cat === CAUSE_CATEGORIES.CALAMIDAD) return <Home className="w-3.5 h-3.5 text-amber-600 shrink-0" />;
    if (cat === CAUSE_CATEGORIES.TRAMITE) return <FileText className="w-3.5 h-3.5 text-purple-600 shrink-0" />;
    if (cat === CAUSE_CATEGORIES.REPRESENTACION) return <Trophy className="w-3.5 h-3.5 text-emerald-600 shrink-0" />;
    if (cat === CAUSE_CATEGORIES.TRANSPORTE) return <Car className="w-3.5 h-3.5 text-cyan-600 shrink-0" />;
    if (cat === CAUSE_CATEGORIES.INJUSTIFICADA) return <AlertTriangle className="w-3.5 h-3.5 text-rose-600 shrink-0" />;
    return <CheckCircle2 className="w-3.5 h-3.5 text-slate-500 shrink-0" />;
  };

  const topCause = correlationData.causeStats.find(c => c.categoria !== CAUSE_CATEGORIES.INJUSTIFICADA);

  return (
    <div className="space-y-6">
      {/* Top Banner & Filters Bar */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-3 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-purple-700 text-white rounded-xl shadow-xs">
              <BarChart3 className="w-6 h-6 text-amber-300" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg sm:text-xl font-black text-slate-900 tracking-tight">
                  Dashboard de Ausentismo y Análisis de Causas
                </h2>
                <span className="px-2.5 py-0.5 rounded-full bg-purple-100 text-purple-800 font-bold text-[10px] tracking-wider uppercase border border-purple-200">
                  Permisos & Asistencia
                </span>
              </div>
              <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
                Seguimiento de estudiantes con mayor inasistencia, clasificación de motivos y correlación con Permisos Académicos
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={loadData}
              disabled={loading}
              className="flex items-center gap-1.5 px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-all shadow-2xs"
              title="Recargar y sincronizar datos"
            >
              <RefreshCw className={`w-3.5 h-3.5 text-purple-600 ${loading ? 'animate-spin' : ''}`} />
              <span>Sincronizar</span>
            </button>
            <span className="px-3 py-1.5 bg-purple-50 text-purple-700 font-bold text-xs rounded-xl border border-purple-200">
              Vigencia {schoolYear}
            </span>
          </div>
        </div>

        {/* Filters Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {/* Curso */}
          <div className="space-y-1">
            <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wider flex items-center gap-1">
              <Users className="w-3.5 h-3.5 text-purple-600" />
              <span>Curso / Grado:</span>
            </label>
            <select
              value={selectedGroupId}
              onChange={(e) => setSelectedGroupId(e.target.value)}
              className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-purple-500"
            >
              <option value="all">Todos los Cursos de la Institución</option>
              {availableGroups.map(g => (
                <option key={g.id} value={g.id}>
                  {g.displayName} ({g.gradeName})
                </option>
              ))}
            </select>
          </div>

          {/* Asignatura */}
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

          {/* Fecha Inicio */}
          <div className="space-y-1">
            <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wider flex items-center gap-1">
              <Calendar className="w-3.5 h-3.5 text-purple-600" />
              <span>Fecha Desde:</span>
            </label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-purple-500"
            />
          </div>

          {/* Fecha Fin */}
          <div className="space-y-1">
            <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wider flex items-center gap-1">
              <Calendar className="w-3.5 h-3.5 text-purple-600" />
              <span>Fecha Hasta:</span>
            </label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-purple-500"
            />
          </div>
        </div>

        {/* Date presets and quick filters */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-slate-100 text-xs">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-slate-400 font-bold text-[11px]">Periodo rápido:</span>
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
              className="px-2.5 py-1 bg-purple-50 hover:bg-purple-100 text-purple-700 rounded-lg font-bold text-[11px] transition-colors border border-purple-200"
            >
              Todo el Año Lectivo
            </button>
          </div>

          {/* Quick Filter buttons */}
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-slate-400 font-bold text-[11px]">Filtro de causas:</span>
            <button
              type="button"
              onClick={() => setFilterType('all')}
              className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-colors ${
                filterType === 'all' 
                  ? 'bg-purple-600 text-white' 
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              Todos con ausencias
            </button>
            <button
              type="button"
              onClick={() => setFilterType('unjustified')}
              className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-colors ${
                filterType === 'unjustified' 
                  ? 'bg-rose-600 text-white' 
                  : 'bg-rose-50 text-rose-700 hover:bg-rose-100 border border-rose-200'
              }`}
            >
              Injustificadas (Sin permiso)
            </button>
            <button
              type="button"
              onClick={() => setFilterType('justified')}
              className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-colors ${
                filterType === 'justified' 
                  ? 'bg-emerald-600 text-white' 
                  : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200'
              }`}
            >
              Con Permisos Registrados
            </button>
            <button
              type="button"
              onClick={() => setFilterType('critical')}
              className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-colors ${
                filterType === 'critical' 
                  ? 'bg-amber-600 text-white' 
                  : 'bg-amber-50 text-amber-700 hover:bg-amber-100 border border-amber-200'
              }`}
            >
              Riesgo Crítico (Semáforo Rojo)
            </button>
          </div>
        </div>
      </div>

      {/* 5 KEY STAT CARDS (Correlación Ausentismo - Permisos) */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
        {/* Card 1: Total Inasistencias */}
        <div className="p-4 bg-white rounded-2xl border border-slate-200 shadow-xs space-y-1">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-[11px] font-bold uppercase tracking-wider">1. Total Inasistencias</span>
            <TrendingDown className="w-4 h-4 text-rose-600" />
          </div>
          <p className="text-2xl font-black text-slate-900 tracking-tight">
            {correlationData.totalAbsences}
          </p>
          <div className="flex items-center justify-between text-[11px]">
            <span className="text-slate-500">Tasa de ausentismo:</span>
            <span className="font-bold text-rose-600">{correlationData.absenteeismRate}%</span>
          </div>
        </div>

        {/* Card 2: Inasistencias Justificadas (Permisos) */}
        <div className="p-4 bg-white rounded-2xl border border-slate-200 shadow-xs space-y-1">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-[11px] font-bold uppercase tracking-wider">2. Con Permiso</span>
            <ShieldCheck className="w-4 h-4 text-emerald-600" />
          </div>
          <p className="text-2xl font-black text-emerald-600 tracking-tight">
            {correlationData.totalJustified}
          </p>
          <div className="flex items-center justify-between text-[11px]">
            <span className="text-emerald-700 font-medium">Justificadas formalmente:</span>
            <span className="font-bold text-emerald-800">{correlationData.justifiedPercentage}%</span>
          </div>
        </div>

        {/* Card 3: Inasistencias Injustificadas */}
        <div className="p-4 bg-white rounded-2xl border border-slate-200 shadow-xs space-y-1">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-[11px] font-bold uppercase tracking-wider">3. Injustificadas</span>
            <ShieldAlert className="w-4 h-4 text-rose-600" />
          </div>
          <p className="text-2xl font-black text-rose-600 tracking-tight">
            {correlationData.totalUnjustified}
          </p>
          <div className="flex items-center justify-between text-[11px]">
            <span className="text-rose-700 font-medium">Sin permiso registrado:</span>
            <span className="font-bold text-rose-800">{correlationData.unjustifiedPercentage}%</span>
          </div>
        </div>

        {/* Card 4: Total Permisos Aprobados */}
        <div className="p-4 bg-white rounded-2xl border border-slate-200 shadow-xs space-y-1">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-[11px] font-bold uppercase tracking-wider">4. Permisos Activos</span>
            <FileText className="w-4 h-4 text-purple-600" />
          </div>
          <p className="text-2xl font-black text-purple-700 tracking-tight">
            {permissions.length}
          </p>
          <span className="text-[11px] text-slate-500 block">
            Autorizaciones institucionales
          </span>
        </div>

        {/* Card 5: Causa Principal */}
        <div className="p-4 bg-white rounded-2xl border border-slate-200 shadow-xs space-y-1 col-span-2 sm:col-span-1">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-[11px] font-bold uppercase tracking-wider">5. Causa Principal</span>
            <Stethoscope className="w-4 h-4 text-sky-600" />
          </div>
          <p className="text-sm font-black text-slate-900 tracking-tight truncate" title={topCause?.categoria || 'Sin registros'}>
            {topCause ? topCause.categoria.split('/')[0].trim() : 'N/A'}
          </p>
          <span className="text-[11px] text-sky-700 font-semibold block truncate">
            {topCause ? `${topCause.count} casos (${topCause.porcentaje}%)` : 'Sin permisos'}
          </span>
        </div>
      </div>

      {/* ANÁLISIS DE CAUSAS Y RELACIÓN VISUAL */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* PANEL 1: Distribución Institucional de Causas (7 columnas) */}
        <div className="lg:col-span-7 bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-4">
          <div className="flex items-center justify-between pb-2 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <div className="p-1.5 bg-purple-100 text-purple-700 rounded-lg">
                <FileText className="w-4 h-4" />
              </div>
              <div>
                <h4 className="font-bold text-slate-900 text-sm">
                  Causas y Motivos del Ausentismo
                </h4>
                <p className="text-xs text-slate-400">
                  Desglose según Permisos Académicos registrados y ausencias sin justificar
                </p>
              </div>
            </div>
            <span className="text-xs font-mono font-bold text-purple-700 bg-purple-50 px-2.5 py-1 rounded-lg">
              {correlationData.totalAbsences} faltas evaluadas
            </span>
          </div>

          {correlationData.causeStats.length === 0 ? (
            <div className="py-12 text-center text-xs text-slate-400">
              No se han registrado inasistencias en los filtros seleccionados.
            </div>
          ) : (
            <div className="space-y-3.5 pt-1">
              {correlationData.causeStats.map((item, idx) => (
                <div key={idx} className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-1.5">
                      {getCauseIcon(item.categoria)}
                      <span className={`font-bold ${item.categoria === CAUSE_CATEGORIES.INJUSTIFICADA ? 'text-rose-900' : 'text-slate-800'}`}>
                        {item.categoria}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-[11px] font-bold text-slate-500">
                        {item.count} {item.count === 1 ? 'falta' : 'faltas'}
                      </span>
                      <span 
                        className={`text-xs font-black px-2 py-0.5 rounded-md ${
                          item.categoria === CAUSE_CATEGORIES.INJUSTIFICADA 
                            ? 'bg-rose-100 text-rose-800' 
                            : 'bg-slate-100 text-slate-800'
                        }`}
                      >
                        {item.porcentaje}%
                      </span>
                    </div>
                  </div>
                  {/* Progress Bar */}
                  <div className="w-full bg-slate-100 rounded-full h-2.5 overflow-hidden">
                    <div 
                      className="h-full rounded-full transition-all duration-500"
                      style={{ 
                        width: `${Math.max(item.porcentaje, 2)}%`,
                        backgroundColor: item.color
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* PANEL 2: Balance Justificado vs Injustificado (5 columnas) */}
        <div className="lg:col-span-5 bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-4 flex flex-col justify-between">
          <div className="pb-2 border-b border-slate-100">
            <h4 className="font-bold text-slate-900 text-sm flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-emerald-600" />
              <span>Balance de Justificación Institucional</span>
            </h4>
            <p className="text-xs text-slate-400">
              Relación entre inasistencias amparadas por permisos vs. faltas sin soporte
            </p>
          </div>

          <div className="flex flex-col items-center justify-center py-4 space-y-4">
            {/* Visual Bar Comparison */}
            <div className="w-full space-y-2">
              <div className="flex items-center justify-between text-xs font-bold">
                <span className="text-emerald-700 flex items-center gap-1">
                  <div className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                  Justificadas: {correlationData.justifiedPercentage}%
                </span>
                <span className="text-rose-700 flex items-center gap-1">
                  <div className="w-2.5 h-2.5 rounded-full bg-rose-500" />
                  Injustificadas: {correlationData.unjustifiedPercentage}%
                </span>
              </div>
              <div className="w-full h-5 bg-slate-100 rounded-xl overflow-hidden flex shadow-inner">
                <div 
                  style={{ width: `${correlationData.justifiedPercentage}%` }} 
                  className="bg-emerald-500 h-full transition-all flex items-center justify-center text-[10px] text-white font-black"
                >
                  {correlationData.justifiedPercentage > 15 && `${correlationData.justifiedPercentage}%`}
                </div>
                <div 
                  style={{ width: `${correlationData.unjustifiedPercentage}%` }} 
                  className="bg-rose-500 h-full transition-all flex items-center justify-center text-[10px] text-white font-black"
                >
                  {correlationData.unjustifiedPercentage > 15 && `${correlationData.unjustifiedPercentage}%`}
                </div>
              </div>
            </div>

            {/* Diagnostic Alert Card */}
            <div className={`p-4 rounded-xl border w-full text-xs space-y-1.5 ${
              correlationData.unjustifiedPercentage > 40
                ? 'bg-rose-50 border-rose-200 text-rose-900'
                : 'bg-emerald-50 border-emerald-200 text-emerald-900'
            }`}>
              <div className="flex items-center gap-2 font-black">
                {correlationData.unjustifiedPercentage > 40 ? (
                  <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                ) : (
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                )}
                <span>
                  {correlationData.unjustifiedPercentage > 40
                    ? 'Alerta: Alto porcentaje de ausencias sin justificar'
                    : 'Buen control: Mayoría de ausencias con permiso'}
                </span>
              </div>
              <p className="text-[11px] leading-relaxed text-slate-600">
                De las <strong>{correlationData.totalAbsences}</strong> inasistencias registradas, 
                <strong> {correlationData.totalJustified}</strong> cuentan con Permiso Académico registrado formalmente y 
                <strong> {correlationData.totalUnjustified}</strong> corresponden a ausencias sin justificación previa o soporte médico.
              </p>
            </div>
          </div>

          <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
            <span className="text-xs text-slate-500 font-medium">¿Llegaron excusas físicas?</span>
            {onNavigateToPermissionsRegister && (
              <button
                type="button"
                onClick={onNavigateToPermissionsRegister}
                className="px-3 py-1.5 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs font-bold transition-colors shadow-2xs flex items-center gap-1"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Registrar Permiso Académico</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* TABLA PRINCIPAL: RANKING DE ESTUDIANTES CON MÁS AUSENTISMO Y SUS CAUSAS */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden space-y-4">
        <div className="p-5 border-b border-slate-100 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-black text-slate-900 text-base">
                Estudiantes con Mayor Ausentismo y Registro de Causas
              </h3>
              <span className="px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-700 font-bold text-xs">
                {displayedStudents.length} estudiantes
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              Haz clic en "Ver Expediente" para consultar el historial detallado de inasistencias y evidencias PDF de cada estudiante
            </p>
          </div>

          {/* Search Input in table header */}
          <div className="w-full md:w-72 relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              value={studentSearchTerm}
              onChange={(e) => setStudentSearchTerm(e.target.value)}
              placeholder="Buscar por nombre, código o curso..."
              className="w-full pl-9 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-purple-500"
            />
          </div>
        </div>

        {loading ? (
          <div className="py-16 text-center text-slate-400 flex flex-col items-center justify-center gap-2">
            <Loader2 className="w-8 h-8 animate-spin text-purple-600" />
            <span className="text-xs font-bold">Calculando ausentismo y cruzando permisos académicos...</span>
          </div>
        ) : displayedStudents.length === 0 ? (
          <div className="py-16 text-center text-slate-400 flex flex-col items-center justify-center gap-2">
            <Users className="w-10 h-10 text-slate-300" />
            <p className="font-bold text-sm text-slate-600">No se encontraron estudiantes para los filtros seleccionados</p>
            <p className="text-xs text-slate-400">Modifica los filtros de curso, fechas o estado de justificación.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[850px] text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold uppercase tracking-wider text-[11px]">
                  <th className="py-3 px-4 w-12 text-center">N°</th>
                  <th className="py-3 px-4 w-28">Código</th>
                  <th 
                    className="py-3 px-4 cursor-pointer hover:bg-slate-100 transition-colors select-none"
                    onClick={() => handleSort('apellidos')}
                  >
                    <div className="flex items-center gap-1">
                      <span>Estudiante</span>
                      <ArrowUpDown className="w-3 h-3 text-slate-400" />
                    </div>
                  </th>
                  <th className="py-3 px-4 text-center w-20">Curso</th>
                  <th 
                    className="py-3 px-4 text-center w-32 cursor-pointer hover:bg-slate-100 transition-colors select-none"
                    onClick={() => handleSort('inasistencias')}
                  >
                    <div className="flex items-center justify-center gap-1">
                      <span>Inasistencias</span>
                      <ArrowUpDown className="w-3 h-3 text-slate-400" />
                    </div>
                  </th>
                  <th className="py-3 px-4 w-44">
                    <span>Relación con Permisos</span>
                  </th>
                  <th className="py-3 px-4">
                    <span>Causas Principales de Ausencia</span>
                  </th>
                  <th className="py-3 px-4 text-center w-28">Semáforo</th>
                  <th className="py-3 px-4 text-center w-28">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {displayedStudents.map((item, idx) => {
                  const hasUnjustified = item.inasistenciasInjustificadas > 0;
                  const isHighAbsenteeism = item.porcentajeAusentismo >= config.umbralRojo;

                  return (
                    <tr 
                      key={item.student.id} 
                      className={`hover:bg-slate-50/80 transition-colors ${
                        isHighAbsenteeism ? 'bg-rose-50/30' : ''
                      }`}
                    >
                      {/* Ranking N° */}
                      <td className="py-3.5 px-4 text-center font-bold text-slate-400">
                        {idx + 1}
                      </td>

                      {/* Código */}
                      <td className="py-3.5 px-4 font-mono font-bold text-slate-700">
                        {item.student.codigo}
                      </td>

                      {/* Estudiante */}
                      <td className="py-3.5 px-4">
                        <span className="font-bold text-slate-900 block uppercase">
                          {item.student.nombreCompleto}
                        </span>
                        <span className="text-[10px] text-slate-400 block">
                          {item.sesionesRegistradas} sesiones registradas
                        </span>
                      </td>

                      {/* Curso */}
                      <td className="py-3.5 px-4 text-center">
                        <span className="px-2 py-0.5 bg-purple-50 text-purple-700 font-bold rounded-md border border-purple-200">
                          {item.student.cursoId.replace(/[°\s]/g, '').toUpperCase()}
                        </span>
                      </td>

                      {/* Total Inasistencias */}
                      <td className="py-3.5 px-4 text-center">
                        <span className={`text-sm font-black ${item.inasistencias > 0 ? 'text-rose-600' : 'text-slate-400'}`}>
                          {item.inasistencias}
                        </span>
                        <span className="text-[10px] text-slate-400 block font-semibold">
                          ({item.porcentajeAusentismo}%)
                        </span>
                      </td>

                      {/* Relación con Permisos */}
                      <td className="py-3.5 px-4">
                        <div className="space-y-1">
                          <div className="flex items-center gap-1.5 text-[11px]">
                            {item.inasistenciasJustificadas > 0 && (
                              <span className="px-1.5 py-0.5 bg-emerald-50 text-emerald-800 font-bold rounded border border-emerald-200" title="Inasistencias con Permiso Académico registrado">
                                ✓ {item.inasistenciasJustificadas} Justificada(s)
                              </span>
                            )}
                            {item.inasistenciasInjustificadas > 0 && (
                              <span className="px-1.5 py-0.5 bg-rose-50 text-rose-800 font-bold rounded border border-rose-200" title="Inasistencias sin justificar o sin permiso">
                                ✗ {item.inasistenciasInjustificadas} Injustificada(s)
                              </span>
                            )}
                            {item.inasistencias === 0 && (
                              <span className="text-slate-400 italic">0 faltas</span>
                            )}
                          </div>

                          {/* Mini Barra de Proporción */}
                          {item.inasistencias > 0 && (
                            <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden flex">
                              <div 
                                style={{ width: `${item.porcentajeJustificado}%` }} 
                                className="bg-emerald-500 h-full" 
                                title={`Justificado: ${item.porcentajeJustificado}%`}
                              />
                              <div 
                                style={{ width: `${100 - item.porcentajeJustificado}%` }} 
                                className="bg-rose-500 h-full" 
                                title={`Injustificado: ${100 - item.porcentajeJustificado}%`}
                              />
                            </div>
                          )}
                        </div>
                      </td>

                      {/* Causas Principales */}
                      <td className="py-3.5 px-4">
                        {item.causasPrincipales.length > 0 ? (
                          <div className="flex flex-wrap items-center gap-1.5">
                            {item.causasPrincipales.map((c, i) => (
                              <span 
                                key={i} 
                                className="inline-flex items-center gap-1 px-2 py-0.5 bg-slate-50 border border-slate-200 rounded-md text-[11px] font-semibold text-slate-700"
                              >
                                {getCauseIcon(c.causa)}
                                <span>{c.causa.split('/')[0].trim()}</span>
                                <strong className="text-purple-700 font-bold">({c.count})</strong>
                              </span>
                            ))}
                          </div>
                        ) : item.inasistencias > 0 ? (
                          <span className="inline-flex items-center gap-1 text-[11px] text-rose-700 font-bold">
                            <AlertTriangle className="w-3.5 h-3.5" />
                            <span>Sin justificación registrada</span>
                          </span>
                        ) : (
                          <span className="text-slate-300 italic">Asistencia perfecta</span>
                        )}
                      </td>

                      {/* Semáforo */}
                      <td className="py-3.5 px-4 text-center">
                        <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full font-bold text-[10px] uppercase border ${
                          item.alertaNivel === 'rojo' 
                            ? 'bg-rose-50 text-rose-700 border-rose-200' 
                            : item.alertaNivel === 'amarillo' 
                            ? 'bg-amber-50 text-amber-800 border-amber-200' 
                            : 'bg-emerald-50 text-emerald-800 border-emerald-200'
                        }`}>
                          <div className={`w-2 h-2 rounded-full ${
                            item.alertaNivel === 'rojo' 
                              ? 'bg-rose-500 animate-pulse' 
                              : item.alertaNivel === 'amarillo' 
                              ? 'bg-amber-500' 
                              : 'bg-emerald-500'
                          }`} />
                          <span>{item.alertaNivel}</span>
                        </span>
                      </td>

                      {/* Acciones */}
                      <td className="py-3.5 px-4 text-center">
                        <button
                          type="button"
                          onClick={() => setSelectedStudentDossier(item)}
                          className="inline-flex items-center gap-1 px-2.5 py-1 bg-purple-50 hover:bg-purple-100 text-purple-700 hover:text-purple-900 rounded-lg font-bold text-[11px] border border-purple-200 transition-colors shadow-2xs"
                          title="Ver expediente detallado de ausencias y permisos"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          <span>Expediente</span>
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* MODAL EXPEDIENTE DE AUSENTISMO Y PERMISOS DEL ESTUDIANTE */}
      {selectedStudentDossier && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-3xl w-full max-h-[90vh] shadow-2xl flex flex-col overflow-hidden border border-slate-200 animate-in fade-in-50 zoom-in-95">
            {/* Header del Expediente */}
            <div className="px-6 py-4 bg-purple-900 text-white flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-purple-700 rounded-xl text-amber-300">
                  <FileText className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-black text-base">
                    Expediente de Ausentismo y Permisos Académicos
                  </h3>
                  <p className="text-xs text-purple-200">
                    Estudiante: {selectedStudentDossier.student.nombreCompleto} • Código: {selectedStudentDossier.student.codigo}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedStudentDossier(null)}
                className="p-1.5 text-purple-200 hover:text-white rounded-lg hover:bg-purple-800 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Contenido con scroll */}
            <div className="p-6 overflow-y-auto space-y-6">
              {/* Tarjetas resumen del estudiante */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-0.5">
                  <span className="text-[10px] uppercase font-bold text-slate-400 block">Total Inasistencias</span>
                  <p className="text-xl font-black text-slate-900">{selectedStudentDossier.inasistencias}</p>
                  <span className="text-[10px] text-slate-500">{selectedStudentDossier.porcentajeAusentismo}% tasa ausentismo</span>
                </div>

                <div className="p-3 bg-emerald-50 border border-emerald-100 rounded-xl space-y-0.5">
                  <span className="text-[10px] uppercase font-bold text-emerald-700 block">Con Permiso (Justificadas)</span>
                  <p className="text-xl font-black text-emerald-700">{selectedStudentDossier.inasistenciasJustificadas}</p>
                  <span className="text-[10px] text-emerald-600 font-semibold">{selectedStudentDossier.porcentajeJustificado}% amparadas</span>
                </div>

                <div className="p-3 bg-rose-50 border border-rose-100 rounded-xl space-y-0.5">
                  <span className="text-[10px] uppercase font-bold text-rose-700 block">Sin Justificar</span>
                  <p className="text-xl font-black text-rose-700">{selectedStudentDossier.inasistenciasInjustificadas}</p>
                  <span className="text-[10px] text-rose-600 font-semibold">Faltas sin permiso</span>
                </div>

                <div className="p-3 bg-purple-50 border border-purple-100 rounded-xl space-y-0.5">
                  <span className="text-[10px] uppercase font-bold text-purple-700 block">Permisos en Sistema</span>
                  <p className="text-xl font-black text-purple-700">{selectedStudentDossier.permisos.length}</p>
                  <span className="text-[10px] text-purple-600">Autorizados este año</span>
                </div>
              </div>

              {/* Causas Identificadas del Estudiante */}
              <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
                <h4 className="font-bold text-slate-800 text-xs flex items-center gap-1.5">
                  <Stethoscope className="w-4 h-4 text-purple-600" />
                  <span>Causas Principales de Ausencia de este Estudiante:</span>
                </h4>
                {selectedStudentDossier.causasPrincipales.length > 0 ? (
                  <div className="flex flex-wrap gap-2 pt-1">
                    {selectedStudentDossier.causasPrincipales.map((c, i) => (
                      <div key={i} className="flex items-center gap-1.5 px-3 py-1 bg-white border border-slate-200 rounded-lg text-xs">
                        {getCauseIcon(c.causa)}
                        <span className="font-bold text-slate-800">{c.causa}</span>
                        <span className="px-1.5 py-0.2 bg-purple-100 text-purple-800 font-bold rounded text-[10px]">
                          {c.count} vez/veces
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-slate-500 italic">
                    Este estudiante no registra causas o motivos de permiso en el sistema aún.
                  </p>
                )}
              </div>

              {/* Tabla Detallada Fecha por Fecha de Inasistencias */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="font-bold text-slate-900 text-sm">
                    Historial de Inasistencias y Estado de Permiso:
                  </h4>
                  <button
                    type="button"
                    onClick={() => {
                      setRegisteringPermForStudent({
                        student: selectedStudentDossier.student
                      });
                    }}
                    className="flex items-center gap-1 px-3 py-1.5 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-xs font-bold transition-colors shadow-2xs"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Legalizar con Permiso Académico</span>
                  </button>
                </div>

                {selectedStudentDossier.detalleSesionesAusentes.length === 0 ? (
                  <div className="py-8 text-center text-xs text-slate-400 bg-slate-50 rounded-xl border border-slate-200">
                    No hay inasistencias registradas en sesiones para este estudiante.
                  </div>
                ) : (
                  <div className="border border-slate-200 rounded-xl overflow-hidden">
                    <table className="w-full text-left border-collapse text-xs">
                      <thead>
                        <tr className="bg-slate-100 border-b border-slate-200 text-slate-600 font-bold uppercase text-[10px]">
                          <th className="py-2.5 px-3 w-24">Fecha</th>
                          <th className="py-2.5 px-3">Materia / Sesión</th>
                          <th className="py-2.5 px-3 text-center w-28">Estado</th>
                          <th className="py-2.5 px-3">Causa / Motivo del Permiso</th>
                          <th className="py-2.5 px-3 text-center w-24">Soporte PDF</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {selectedStudentDossier.detalleSesionesAusentes.map((d, i) => (
                          <tr key={i} className="hover:bg-slate-50">
                            <td className="py-2.5 px-3 font-mono font-bold text-slate-700">
                              {d.fecha.split('-').reverse().join('/')}
                            </td>
                            <td className="py-2.5 px-3">
                              <span className="font-bold text-slate-900 block">{d.asignatura}</span>
                              {d.docenteNombre && (
                                <span className="text-[10px] text-slate-400 block">{d.docenteNombre}</span>
                              )}
                            </td>
                            <td className="py-2.5 px-3 text-center">
                              {d.tienePermiso ? (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-emerald-50 text-emerald-800 font-bold rounded text-[10px] border border-emerald-200">
                                  ✓ Con Permiso
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-rose-50 text-rose-800 font-bold rounded text-[10px] border border-rose-200">
                                  ✗ Sin justificar
                                </span>
                              )}
                            </td>
                            <td className="py-2.5 px-3">
                              {d.permiso ? (
                                <div className="space-y-0.5">
                                  <span className="font-bold text-purple-950 block">{d.permiso.motivo}</span>
                                  <span className="text-[10px] text-purple-700 block">
                                    {d.permiso.tipoRango === 'dia_completo' ? 'Jornada completa' : `Horas: ${d.permiso.horaInicio} - ${d.permiso.horaFin}`}
                                  </span>
                                </div>
                              ) : (
                                <span className="text-slate-400 italic text-[11px]">No se presentó excusa previa</span>
                              )}
                            </td>
                            <td className="py-2.5 px-3 text-center">
                              {d.permiso?.archivoPdfBase64 ? (
                                <button
                                  type="button"
                                  onClick={() => setPdfPreviewUrl({
                                    url: d.permiso!.archivoPdfBase64!,
                                    title: `Soporte: ${selectedStudentDossier.student.nombreCompleto} (${d.fecha})`
                                  })}
                                  className="inline-flex items-center gap-1 px-2 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 rounded font-bold text-[10px] border border-emerald-200 transition-colors"
                                >
                                  <Eye className="w-3 h-3 text-emerald-600" />
                                  <span>Ver PDF</span>
                                </button>
                              ) : (
                                <span className="text-slate-300">-</span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>

            {/* Footer Modal */}
            <div className="px-6 py-3.5 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
              <span className="text-xs text-slate-500 font-medium">
                I. E. Juan Pablo I • Expediente Estudiantil
              </span>
              <button
                type="button"
                onClick={() => setSelectedStudentDossier(null)}
                className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-800 rounded-xl text-xs font-bold transition-colors"
              >
                Cerrar Expediente
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL PARA REGISTRAR PERMISO RÁPIDAMENTE DESDE EL EXPEDIENTE */}
      {registeringPermForStudent && (
        <PermissionModal
          student={registeringPermForStudent.student}
          courseName={registeringPermForStudent.student.cursoId}
          schoolYear={schoolYear}
          initialDate={registeringPermForStudent.fecha || new Date().toISOString().split('T')[0]}
          existingPermission={null}
          currentUserEmail={user.email || 'Coordinación'}
          onClose={() => setRegisteringPermForStudent(null)}
          onSaved={async () => {
            setRegisteringPermForStudent(null);
            await loadData();
          }}
        />
      )}

      {/* VISOR DE DOCUMENTO PDF INTEGRADO */}
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
