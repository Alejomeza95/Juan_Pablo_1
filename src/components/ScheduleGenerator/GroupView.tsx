import React, { useState, useMemo } from 'react';
import { EngineSlot } from '../../utils/scheduleEngine';
import { COURSES } from '../../data/schedules';
import { TEACHERS } from '../../data/generatorData';
import { getSubjectStyle } from '../../utils/subjectStyles';
import { downloadCourseSchedulePdf, downloadAllCoursesSchedulePdf } from '../../utils/schedulePdfExport';
import {
  Clock,
  User,
  Coffee,
  FileDown,
  Sparkles,
  CheckCircle,
  BookOpen,
  Calendar,
  ChevronLeft,
  ChevronRight,
  Maximize2,
  ZoomIn,
  Layers,
  ArrowRight,
  ArrowDown,
  Check,
  Tv,
  Presentation
} from 'lucide-react';

export function GroupView({ schedule, onOpenSlidePresentation }: { schedule: EngineSlot[]; onOpenSlidePresentation?: () => void }) {
  const [selectedCourse, setSelectedCourse] = useState<string>(COURSES[0]);
  const [viewMode, setViewMode] = useState<'grid' | 'cascade' | 'slide' | 'subjects'>('grid');
  const [currentSlideDay, setCurrentSlideDay] = useState<number>(1);
  const [slideZoom, setSlideZoom] = useState<'normal' | 'large' | 'xlarge'>('large');
  const [highlightedSubject, setHighlightedSubject] = useState<string | null>(null);
  const [downloadingPdf, setDownloadingPdf] = useState(false);
  const [downloadingAllPdf, setDownloadingAllPdf] = useState(false);

  if (!schedule || schedule.length === 0) {
    return (
      <div className="p-8 text-center bg-white rounded-2xl border border-slate-200 text-slate-500">
        No hay horario generado. Genera uno primero en la pestaña de Generar.
      </div>
    );
  }

  const isUpperGrade = selectedCourse.startsWith('10') || selectedCourse.startsWith('11');
  const groupSlots = useMemo(() => schedule.filter(s => s.groupId === selectedCourse), [schedule, selectedCourse]);
  const days = [1, 2, 3, 4, 5];
  // Periods: 1 to 7 for 6-9, 1 to 8 for 10-11
  const periods = isUpperGrade ? [1, 2, 3, 4, 5, 6, 7, 8] : [1, 2, 3, 4, 5, 6, 7];

  const getPeriodLabel = (p: number) => {
    switch (p) {
      case 1: return { name: 'Hora 1', time: '7:30 - 8:25 a. m.' };
      case 2: return { name: 'Hora 2', time: '8:25 - 9:20 a. m.' };
      case 3: return { name: 'Hora 3', time: '9:20 - 10:15 a. m.' };
      case 4: return { name: 'Descanso', time: '10:15 - 10:45 a. m.' };
      case 5: return { name: 'Hora 4', time: '10:45 - 11:40 a. m.' };
      case 6: return { name: 'Hora 5', time: '11:40 - 12:35 p. m.' };
      case 7: return { name: 'Hora 6', time: '12:35 - 1:30 p. m.' };
      case 8: return { name: 'Hora 7', time: '1:30 - 2:15 p. m.' };
      default: return { name: `Hora ${p}`, time: '' };
    }
  };

  const dayNames: Record<number, string> = {
    1: 'Lunes',
    2: 'Martes',
    3: 'Miércoles',
    4: 'Jueves',
    5: 'Viernes'
  };

  // Subject breakdown
  const subjectSummary = useMemo(() => {
    const summaryMap = new Map<string, { total: number; days: { [day: number]: number[] }; teacherName: string }>();

    groupSlots.forEach(s => {
      if (!summaryMap.has(s.subject)) {
        const teacher = TEACHERS.find(t => t.id === s.teacherId);
        summaryMap.set(s.subject, {
          total: 0,
          days: { 1: [], 2: [], 3: [], 4: [], 5: [] },
          teacherName: teacher ? teacher.name : 'Por asignar'
        });
      }
      const entry = summaryMap.get(s.subject)!;
      entry.total += 1;
      entry.days[s.day].push(s.period);
    });

    return Array.from(summaryMap.entries()).map(([subject, data]) => {
      let blocks2h = 0;
      let blocks1h = 0;
      Object.values(data.days).forEach(periodsInDay => {
        if (periodsInDay.length === 2) blocks2h++;
        if (periodsInDay.length === 1) blocks1h++;
      });

      return {
        subject,
        total: data.total,
        days: data.days,
        teacherName: data.teacherName,
        blocks2h,
        blocks1h,
        isEven: data.total % 2 === 0
      };
    }).sort((a, b) => b.total - a.total);
  }, [groupSlots]);

  // Check if slot is part of a 2-hour continuous block
  const getSlotBlockInfo = (day: number, period: number, subject: string) => {
    const prev = groupSlots.find(s => s.day === day && s.subject === subject && s.period === period - 1);
    const next = groupSlots.find(s => s.day === day && s.subject === subject && s.period === period + 1);

    if (prev && !next) return { is2h: true, pos: 'end', label: '2ª hora' };
    if (!prev && next) return { is2h: true, pos: 'start', label: '1ª hora' };
    if (prev && next) return { is2h: true, pos: 'middle', label: 'Continua' };
    return { is2h: false, pos: 'single', label: '1 hora' };
  };

  const handleDownloadCoursePdf = async () => {
    setDownloadingPdf(true);
    try {
      await downloadCourseSchedulePdf(selectedCourse, schedule);
    } catch (err) {
      console.error('Error generating PDF:', err);
      alert('Hubo un error al generar el PDF.');
    } finally {
      setDownloadingPdf(false);
    }
  };

  const handleDownloadAllPdf = async () => {
    setDownloadingAllPdf(true);
    try {
      await downloadAllCoursesSchedulePdf(schedule);
    } catch (err) {
      console.error('Error generating all PDF:', err);
      alert('Hubo un error al generar el PDF de todos los cursos.');
    } finally {
      setDownloadingAllPdf(false);
    }
  };

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 flex flex-col h-full overflow-hidden">
      {/* Top Header Controls */}
      <div className="p-4 sm:p-5 border-b border-slate-200 bg-slate-50/80">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold uppercase tracking-wider text-purple-700 bg-purple-100 px-2.5 py-0.5 rounded-full border border-purple-200">
                Horario Oficial de Asignaturas
              </span>
              <span className="text-xs text-slate-500">
                {isUpperGrade ? 'Jornada extendida (salida L-J 2:15 p. m. | V 1:30 p. m.)' : 'Jornada regular (salida 1:30 p. m.)'}
              </span>
            </div>
            <h3 className="text-xl sm:text-2xl font-black text-slate-900 mt-1 flex items-center gap-2">
              <span>Curso {selectedCourse}</span>
              <span className="text-sm font-semibold text-purple-700 bg-purple-50 px-2.5 py-0.5 rounded-lg border border-purple-200">
                {groupSlots.length} horas semanales
              </span>
            </h3>
          </div>

          {/* Action PDF Buttons & Print */}
          <div className="flex items-center gap-2 flex-wrap">
            {onOpenSlidePresentation && (
              <button
                onClick={onOpenSlidePresentation}
                className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white rounded-xl text-xs font-black shadow-md transition-all hover:scale-105 active:scale-95 cursor-pointer"
                title="Abrir Slide de Pantalla Completa (Presentación con Diapositivas)"
              >
                <Tv className="w-4 h-4 text-purple-200" />
                <span>Slide Pantalla Completa</span>
              </button>
            )}

            <button
              onClick={handleDownloadCoursePdf}
              disabled={downloadingPdf}
              className="flex items-center gap-2 px-3.5 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs font-bold shadow-sm transition-all disabled:opacity-50"
            >
              <FileDown className="w-4 h-4" />
              <span>{downloadingPdf ? 'Creando PDF...' : `Descargar PDF (${selectedCourse})`}</span>
            </button>

            <button
              onClick={handleDownloadAllPdf}
              disabled={downloadingAllPdf}
              className="flex items-center gap-2 px-3.5 py-2 bg-slate-800 hover:bg-slate-900 text-white rounded-xl text-xs font-bold shadow-sm transition-all disabled:opacity-50"
            >
              <FileDown className="w-4 h-4" />
              <span>{downloadingAllPdf ? 'Generando...' : 'Descargar Todos los Cursos (PDF)'}</span>
            </button>
          </div>
        </div>

        {/* Course Quick Selector Pills */}
        <div className="mt-4 flex items-center gap-1.5 flex-wrap">
          <span className="text-xs font-bold text-slate-500 mr-1">Seleccionar Curso:</span>
          {COURSES.map(course => {
            const isSelected = course === selectedCourse;
            return (
              <button
                key={course}
                onClick={() => {
                  setSelectedCourse(course);
                  setHighlightedSubject(null);
                }}
                className={`px-3 py-1.5 rounded-xl text-xs font-extrabold transition-all ${
                  isSelected
                    ? 'bg-purple-600 text-white shadow-sm ring-2 ring-purple-400/40 scale-105'
                    : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-100'
                }`}
              >
                {course}
              </button>
            );
          })}
        </div>

        {/* View Mode Switcher: 5 Jornadas Desplegadas vs Slide Grande vs Por Asignaturas vs Cuadrícula */}
        <div className="mt-4 pt-3 border-t border-slate-200 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-1.5 bg-slate-200/70 p-1 rounded-xl flex-wrap">
            <button
              onClick={() => setViewMode('grid')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-black transition-all ${
                viewMode === 'grid'
                  ? 'bg-white text-purple-700 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Calendar className="w-3.5 h-3.5" />
              <span>Matriz Semanal (5 Jornadas)</span>
            </button>

            <button
              onClick={() => setViewMode('cascade')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-black transition-all ${
                viewMode === 'cascade'
                  ? 'bg-white text-purple-700 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Layers className="w-3.5 h-3.5" />
              <span>5 Jornadas Completas (Toda la Pantalla)</span>
            </button>

            <button
              onClick={() => setViewMode('slide')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-black transition-all ${
                viewMode === 'slide'
                  ? 'bg-white text-purple-700 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Tv className="w-3.5 h-3.5" />
              <span>Slide por Jornada</span>
            </button>

            <button
              onClick={() => setViewMode('subjects')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                viewMode === 'subjects'
                  ? 'bg-white text-purple-700 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <BookOpen className="w-3.5 h-3.5" />
              <span>Ver por Asignaturas</span>
            </button>
          </div>

          {/* Scale / Zoom controls for Slide and Grid */}
          <div className="flex items-center gap-2 text-xs">
            <span className="text-slate-500 font-semibold text-[11px] flex items-center gap-1">
              <ZoomIn className="w-3.5 h-3.5 text-purple-600" />
              Tamaño:
            </span>
            {(['normal', 'large', 'xlarge'] as const).map(size => (
              <button
                key={size}
                onClick={() => setSlideZoom(size)}
                className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all ${
                  slideZoom === size
                    ? 'bg-purple-100 text-purple-800 border border-purple-300'
                    : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
                }`}
              >
                {size === 'normal' && 'Normal'}
                {size === 'large' && 'Grande'}
                {size === 'xlarge' && 'Muy Grande'}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* VIEW MODE 0: 5 JORNADAS EN CASCADA (BAJA TODA LA PANTALLA) */}
      {viewMode === 'cascade' && (
        <div className="flex-1 p-4 sm:p-8 bg-slate-100/70 overflow-y-auto space-y-8">
          {/* Quick day jump pills */}
          <div className="flex items-center gap-2 flex-wrap pb-2 text-xs">
            <span className="text-slate-500 font-bold flex items-center gap-1">
              <ArrowDown className="w-3.5 h-3.5 text-purple-600" />
              Saltar a jornada:
            </span>
            {days.map(d => (
              <button
                key={d}
                onClick={() => {
                  const el = document.getElementById(`group-day-section-${d}`);
                  if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
                }}
                className="px-3 py-1 bg-white hover:bg-purple-50 text-slate-700 hover:text-purple-700 border border-slate-200 rounded-lg font-bold transition-colors shadow-2xs"
              >
                {dayNames[d]}
              </button>
            ))}
          </div>

          <div className="space-y-8 max-w-5xl mx-auto w-full">
            {days.map(dayNum => {
              const daySlots = groupSlots.filter(s => s.day === dayNum);
              const dayDismissal = isUpperGrade && dayNum === 5 
                ? 'Salida institucional a la 1:30 p. m. (6 periodos)' 
                : isUpperGrade 
                  ? 'Salida a las 2:15 p. m. (7 periodos)' 
                  : 'Salida institucional a la 1:30 p. m. (6 periodos)';

              return (
                <div
                  key={dayNum}
                  id={`group-day-section-${dayNum}`}
                  className="bg-white rounded-3xl border-2 border-slate-200 shadow-md overflow-hidden scroll-mt-6"
                >
                  <div className="px-6 py-4 bg-gradient-to-r from-slate-900 via-purple-950 to-slate-900 text-white flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="flex items-center gap-3.5">
                      <div className="w-12 h-12 rounded-2xl bg-purple-600/30 border-2 border-purple-400/50 text-purple-200 flex items-center justify-center font-black text-xl shadow-xs">
                        D{dayNum}
                      </div>
                      <div>
                        <span className="text-xs font-bold text-purple-300 uppercase tracking-widest block">
                          Jornada {dayNum} de 5
                        </span>
                        <h4 className="text-2xl sm:text-3xl font-black tracking-tight text-white mt-0.5">
                          {dayNames[dayNum].toUpperCase()}
                        </h4>
                        <p className="text-xs text-purple-200/80 font-medium mt-0.5">
                          {selectedCourse} • {dayDismissal}
                        </p>
                      </div>
                    </div>
                    <span className="text-xs font-black bg-white/10 px-3.5 py-1.5 rounded-xl text-purple-200 border border-white/10">
                      {daySlots.length} horas de clase
                    </span>
                  </div>

                  <div className={`p-5 sm:p-7 space-y-3.5 ${slideZoom === 'xlarge' ? 'space-y-4' : 'space-y-3'}`}>
                    {periods.map(p => {
                      const pInfo = getPeriodLabel(p);
                      const isBreak = p === 4;

                      if (isBreak) {
                        return (
                          <div
                            key={p}
                            className="p-4 sm:p-5 rounded-2xl bg-gradient-to-r from-amber-100/95 via-amber-50 to-amber-100/95 border-2 border-amber-300 shadow-xs flex items-center justify-between gap-4"
                          >
                            <div className="flex items-center gap-3.5">
                              <div className="w-11 h-11 rounded-xl bg-amber-500 text-white flex items-center justify-center shadow-xs">
                                <Coffee className="w-6 h-6" />
                              </div>
                              <div>
                                <h5 className="font-black text-amber-950 text-base sm:text-lg">
                                  Descanso Institucional (30 minutos)
                                </h5>
                                <p className="text-xs text-amber-900 font-semibold mt-0.5">
                                  Pausa común de receso institucional para todos los estudiantes y docentes
                                </p>
                              </div>
                            </div>
                            <span className="text-xs sm:text-sm font-black text-amber-900 bg-white/90 px-3.5 py-1.5 rounded-xl border border-amber-300 shadow-2xs">
                              {pInfo.time}
                            </span>
                          </div>
                        );
                      }

                      const isFridayPeriod8 = isUpperGrade && dayNum === 5 && p === 8;
                      if (isFridayPeriod8) {
                        return (
                          <div
                            key={p}
                            className="p-4 rounded-2xl bg-emerald-50 border-2 border-dashed border-emerald-300 flex items-center justify-between gap-4"
                          >
                            <div className="flex items-center gap-3">
                              <div className="w-9 h-9 rounded-xl bg-emerald-600 text-white flex items-center justify-center font-bold">
                                <Check className="w-5 h-5" />
                              </div>
                              <div>
                                <h5 className="font-black text-emerald-950 text-sm sm:text-base">
                                  Salida Institucional de Viernes: 1:30 p. m.
                                </h5>
                                <p className="text-xs text-emerald-700">
                                  Cumplimiento de la regla institucional: fin de la semana escolar para 10.° y 11.°
                                </p>
                              </div>
                            </div>
                            <span className="text-xs font-bold text-emerald-800 bg-emerald-100 px-3 py-1 rounded-xl border border-emerald-200">
                              Fin de jornada
                            </span>
                          </div>
                        );
                      }

                      const slot = daySlots.find(s => s.period === p);
                      if (!slot) return null;

                      const teacher = TEACHERS.find(t => t.id === slot.teacherId);
                      const style = getSubjectStyle(slot.subject);
                      const blockInfo = getSlotBlockInfo(dayNum, p, slot.subject);

                      return (
                        <div
                          key={p}
                          className={`rounded-2xl border-2 border-l-8 transition-all shadow-xs hover:shadow-md ${
                            style.bg
                          } ${style.border} ${style.borderAccent} ${
                            slideZoom === 'xlarge' ? 'p-6' : slideZoom === 'large' ? 'p-5' : 'p-4'
                          }`}
                        >
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                            <div className="flex items-start sm:items-center gap-4">
                              <div className="p-3 rounded-2xl bg-white/95 border border-slate-200/90 shadow-xs text-center shrink-0 min-w-[95px]">
                                <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest block">
                                  Periodo
                                </span>
                                <span className="text-base sm:text-lg font-black text-slate-900 leading-tight">
                                  {pInfo.name}
                                </span>
                                <span className="text-[11px] font-bold text-purple-700 block mt-0.5">
                                  {pInfo.time}
                                </span>
                              </div>

                              <div>
                                <div className="flex items-center gap-2 flex-wrap">
                                  <h4 className={`font-black tracking-tight ${
                                    slideZoom === 'xlarge' ? 'text-2xl sm:text-3xl' : slideZoom === 'large' ? 'text-xl sm:text-2xl' : 'text-lg sm:text-xl'
                                  } ${style.text}`}>
                                    {slot.subject}
                                  </h4>
                                  <span className={`text-xs font-bold px-2.5 py-0.5 rounded-full ${style.badgeBg} ${style.badgeText}`}>
                                    {style.category}
                                  </span>
                                  {blockInfo.is2h ? (
                                    <span className="text-xs font-black px-3 py-0.5 rounded-full bg-purple-700 text-white shadow-2xs">
                                      Bloque continuo 2h ({blockInfo.label})
                                    </span>
                                  ) : (
                                    <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-slate-200 text-slate-800">
                                      Sesión de 1h
                                    </span>
                                  )}
                                </div>

                                <div className="text-sm text-slate-700 mt-1 font-medium flex items-center gap-1.5">
                                  <span className="text-slate-500">Docente asignado:</span>
                                  <strong className="text-slate-900 font-bold">{teacher ? teacher.name : 'Por asignar'}</strong>
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* VIEW MODE 1: SLIDE GRANDE POR JORNADA */}
      {viewMode === 'slide' && (
        <div className="flex-1 flex flex-col p-4 sm:p-6 bg-slate-100/60 overflow-y-auto">
          {/* Slide Navigator */}
          <div className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-xs mb-4 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <button
                onClick={() => setCurrentSlideDay(prev => Math.max(1, prev - 1))}
                disabled={currentSlideDay === 1}
                className="p-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                title="Jornada anterior"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>

              <div className="flex items-center gap-1.5">
                {days.map(d => {
                  const isCurrent = d === currentSlideDay;
                  return (
                    <button
                      key={d}
                      onClick={() => setCurrentSlideDay(d)}
                      className={`px-3.5 py-2 rounded-xl text-xs font-black transition-all ${
                        isCurrent
                          ? 'bg-purple-600 text-white shadow-sm ring-2 ring-purple-400/40 scale-105'
                          : 'bg-slate-50 text-slate-700 border border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      Día {d} - {dayNames[d]}
                    </button>
                  );
                })}
              </div>

              <button
                onClick={() => setCurrentSlideDay(prev => Math.min(5, prev + 1))}
                disabled={currentSlideDay === 5}
                className="p-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                title="Jornada siguiente"
              >
                <ChevronRight className="w-5 h-5" />
              </button>
            </div>

            <div className="text-right">
              <span className="text-xs font-bold text-purple-700 uppercase tracking-wider block">
                {selectedCourse} • Jornada {currentSlideDay} ({dayNames[currentSlideDay]})
              </span>
              <span className="text-[11px] text-slate-500">
                {isUpperGrade && currentSlideDay === 5 ? 'Salida a la 1:30 p. m. (6 horas de clase)' : isUpperGrade ? 'Salida a las 2:15 p. m. (7 horas de clase)' : 'Salida a la 1:30 p. m. (6 horas de clase)'}
              </span>
            </div>
          </div>

          {/* Big Slide Cards Stack for the Current Day */}
          <div className="space-y-3 max-w-4xl mx-auto w-full">
            {periods.map(p => {
              const pInfo = getPeriodLabel(p);
              const isBreak = p === 4;

              // Break Slide
              if (isBreak) {
                return (
                  <div
                    key={p}
                    className="p-4 rounded-2xl bg-gradient-to-r from-amber-100/90 via-amber-50 to-amber-100/90 border-2 border-amber-300 shadow-sm flex items-center justify-between gap-4"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 rounded-xl bg-amber-500 text-white flex items-center justify-center shadow-xs">
                        <Coffee className="w-6 h-6" />
                      </div>
                      <div>
                        <h4 className="font-black text-amber-950 text-base sm:text-lg">
                          Descanso Institucional (30 minutos)
                        </h4>
                        <p className="text-xs text-amber-800 font-semibold mt-0.5">
                          Franja común de receso institucional para todos los estudiantes y docentes
                        </p>
                      </div>
                    </div>
                    <div className="text-right font-extrabold text-amber-900 bg-white/80 px-3 py-1.5 rounded-xl border border-amber-300 text-xs sm:text-sm">
                      {pInfo.time}
                    </div>
                  </div>
                );
              }

              // Check if Friday Period 8 for Upper Grade
              const isFridayPeriod8 = isUpperGrade && currentSlideDay === 5 && p === 8;
              if (isFridayPeriod8) {
                return (
                  <div
                    key={p}
                    className="p-4 rounded-2xl bg-emerald-50 border-2 border-dashed border-emerald-300 flex items-center justify-between gap-4"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center font-bold">
                        <Check className="w-5 h-5" />
                      </div>
                      <div>
                        <h4 className="font-extrabold text-emerald-900 text-base">
                          Salida Institucional de Viernes: 1:30 p. m.
                        </h4>
                        <p className="text-xs text-emerald-700">
                          Los viernes los grados 10.° y 11.° no tienen clase en el Periodo 8 según la regla institucional.
                        </p>
                      </div>
                    </div>
                    <span className="text-xs font-bold text-emerald-800 bg-emerald-100 px-3 py-1.5 rounded-xl border border-emerald-300">
                      Fin de jornada
                    </span>
                  </div>
                );
              }

              const slot = groupSlots.find(s => s.day === currentSlideDay && s.period === p);
              if (!slot) {
                return (
                  <div key={p} className="p-4 rounded-2xl bg-white border border-slate-200 text-slate-400 text-center text-sm">
                    {pInfo.name} ({pInfo.time}) - Sin clase programada
                  </div>
                );
              }

              const teacher = TEACHERS.find(t => t.id === slot.teacherId);
              const style = getSubjectStyle(slot.subject);
              const blockInfo = getSlotBlockInfo(currentSlideDay, p, slot.subject);

              return (
                <div
                  key={p}
                  className={`rounded-2xl border-2 border-l-8 transition-all shadow-sm hover:shadow-md ${
                    style.bg
                  } ${style.border} ${style.borderAccent} ${
                    slideZoom === 'xlarge' ? 'p-6' : slideZoom === 'large' ? 'p-5' : 'p-4'
                  }`}
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="flex items-start sm:items-center gap-4">
                      {/* Hour badge */}
                      <div className="p-2.5 sm:p-3 rounded-xl bg-white/90 border border-slate-200/80 shadow-2xs text-center shrink-0">
                        <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider block">
                          Periodo
                        </span>
                        <span className="text-base sm:text-lg font-black text-slate-900">
                          {pInfo.name}
                        </span>
                        <span className="text-[10px] font-bold text-purple-700 block">
                          {pInfo.time}
                        </span>
                      </div>

                      {/* Subject and Teacher details */}
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <h4 className={`font-black tracking-tight ${
                            slideZoom === 'xlarge' ? 'text-2xl sm:text-3xl' : slideZoom === 'large' ? 'text-xl sm:text-2xl' : 'text-lg sm:text-xl'
                          } ${style.text}`}>
                            {slot.subject}
                          </h4>

                          <span className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full ${style.badgeBg} ${style.badgeText}`}>
                            {style.category}
                          </span>

                          {blockInfo.is2h ? (
                            <span className="text-[11px] font-extrabold px-2.5 py-0.5 rounded-full bg-purple-700 text-white shadow-2xs flex items-center gap-1">
                              <span>Bloque continuo 2h</span>
                              <span className="opacity-80 font-normal">({blockInfo.label})</span>
                            </span>
                          ) : (
                            <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-slate-200 text-slate-800">
                              Sesión de 1h
                            </span>
                          )}
                        </div>

                        <div className="flex items-center gap-2 text-slate-700 mt-2 text-sm font-semibold">
                          <User className="w-4 h-4 text-purple-600 shrink-0" />
                          <span>Docente: <strong className="text-slate-900">{teacher?.name || 'Por asignar'}</strong></span>
                          <span className="text-slate-300">•</span>
                          <span className="text-slate-500">Curso: {selectedCourse}</span>
                        </div>
                      </div>
                    </div>

                    <div className="sm:text-right shrink-0">
                      <span className="text-xs font-bold text-slate-500 bg-white/80 px-3 py-1.5 rounded-xl border border-slate-200 inline-block">
                        Jornada {currentSlideDay} • {dayNames[currentSlideDay]}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* VIEW MODE 2: VISTA POR ASIGNATURAS */}
      {viewMode === 'subjects' && (
        <div className="flex-1 p-4 sm:p-6 bg-slate-50 overflow-y-auto">
          <div className="max-w-5xl mx-auto space-y-4">
            <div className="flex items-center justify-between">
              <h4 className="text-base font-bold text-slate-800 flex items-center gap-2">
                <BookOpen className="w-5 h-5 text-purple-600" />
                <span>Plan de Asignaturas y Distribución Semanal - Curso {selectedCourse}</span>
              </h4>
              <span className="text-xs text-emerald-700 font-bold bg-emerald-100 px-3 py-1 rounded-full border border-emerald-200 flex items-center gap-1">
                <CheckCircle className="w-3.5 h-3.5" />
                Todas las materias cumplen la regla de bloques pares e impares
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {subjectSummary.map(s => {
                const style = getSubjectStyle(s.subject);
                return (
                  <div
                    key={s.subject}
                    className={`p-5 rounded-2xl border-2 border-l-8 bg-white shadow-xs ${style.border} ${style.borderAccent} flex flex-col justify-between`}
                  >
                    <div>
                      {/* Subject Header */}
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className={`w-2.5 h-2.5 rounded-full ${style.dot}`} />
                            <h5 className={`font-black text-lg ${style.text}`}>{s.subject}</h5>
                          </div>
                          <p className="text-xs text-slate-500 font-medium mt-0.5">
                            Docente: <strong className="text-slate-800">{s.teacherName}</strong>
                          </p>
                        </div>

                        <div className="text-right">
                          <span className="text-base font-black text-purple-700 bg-purple-50 px-2.5 py-1 rounded-xl border border-purple-200 inline-block">
                            {s.total}h / sem
                          </span>
                        </div>
                      </div>

                      {/* Parity Badge */}
                      <div className="mb-3">
                        <span className={`text-[11px] font-extrabold px-2.5 py-0.5 rounded-lg ${
                          s.isEven ? 'bg-blue-100 text-blue-800' : 'bg-teal-100 text-teal-800'
                        }`}>
                          {s.isEven
                            ? `Intensidad Par: ${s.blocks2h} bloque(s) continuo(s) de 2h`
                            : `Intensidad Impar: ${s.blocks2h} bloque(s) de 2h + 1 sesión de 1h`}
                        </span>
                      </div>

                      {/* Schedule by Day Breakdown */}
                      <div className="space-y-1.5 pt-2 border-t border-slate-100 text-xs">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
                          Horarios Asignados en la Semana:
                        </span>
                        {days.map(d => {
                          const pList = s.days[d];
                          if (!pList || pList.length === 0) return null;

                          const sorted = [...pList].sort((a, b) => a - b);
                          const is2h = sorted.length === 2;

                          return (
                            <div key={d} className="flex items-center justify-between p-2 rounded-xl bg-slate-50 border border-slate-200/80">
                              <span className="font-bold text-slate-800">
                                {dayNames[d]} (Día {d})
                              </span>
                              <div className="flex items-center gap-2">
                                <span className="font-semibold text-purple-700">
                                  {sorted.map(p => {
                                    const info = getPeriodLabel(p);
                                    return `${info.name} (${info.time})`;
                                  }).join(' y ')}
                                </span>
                                <span className={`text-[10px] font-bold px-1.5 py-0.2 rounded ${
                                  is2h ? 'bg-purple-100 text-purple-800' : 'bg-slate-200 text-slate-700'
                                }`}>
                                  {is2h ? '2 horas' : '1 hora'}
                                </span>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* VIEW MODE 3: CUADRÍCULA SEMANAL COMPLETA (CON TAMAÑO AJUSTABLE) */}
      {viewMode === 'grid' && (
        <div className="flex-1 p-4 sm:p-6 overflow-x-auto">
          {/* Interactive Subject Highlight Filter */}
          <div className="mb-4 flex items-center gap-2 overflow-x-auto py-1 text-xs">
            <span className="text-slate-500 font-semibold text-[11px] shrink-0 flex items-center gap-1">
              <Sparkles className="w-3.5 h-3.5 text-purple-600" />
              Filtrar por Materia:
            </span>
            <button
              onClick={() => setHighlightedSubject(null)}
              className={`px-2.5 py-1 rounded-lg text-xs font-semibold shrink-0 transition-colors ${
                highlightedSubject === null
                  ? 'bg-slate-900 text-white'
                  : 'bg-slate-200 text-slate-700 hover:bg-slate-300'
              }`}
            >
              Todas
            </button>
            {subjectSummary.map(s => {
              const style = getSubjectStyle(s.subject);
              const isHighlighted = highlightedSubject === s.subject;
              return (
                <button
                  key={s.subject}
                  onClick={() => setHighlightedSubject(isHighlighted ? null : s.subject)}
                  className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium shrink-0 transition-all border ${
                    isHighlighted
                      ? `${style.bg} ${style.text} ring-2 ring-purple-500 font-bold border-purple-400`
                      : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  <span className={`w-2 h-2 rounded-full ${style.dot}`} />
                  <span>{s.subject}</span>
                  <span className="text-[10px] opacity-75 font-bold">({s.total}h)</span>
                </button>
              );
            })}
          </div>

          <table className="w-full min-w-[840px] text-left border-collapse table-fixed">
            <thead>
              <tr>
                <th className="p-3 bg-slate-100 border border-slate-200 w-40 text-center text-xs font-bold text-slate-700 rounded-tl-xl">
                  Hora / Franja
                </th>
                {days.map(d => (
                  <th key={d} className={`p-3 bg-slate-100 border border-slate-200 text-center text-sm font-bold text-slate-800 ${d === 5 ? 'rounded-tr-xl' : ''}`}>
                    <div className="flex flex-col items-center">
                      <span className="font-extrabold text-base">
                        {dayNames[d]}
                      </span>
                      <span className="text-[11px] font-medium text-slate-500 mt-0.5">
                        Jornada {d}
                      </span>
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {periods.map(p => {
                const pInfo = getPeriodLabel(p);
                const isBreak = p === 4;

                if (isBreak) {
                  return (
                    <tr key={p} className="bg-amber-50/80">
                      <td className="p-3 border border-amber-200 text-center font-bold text-xs text-amber-900 bg-amber-100/60">
                        <div className="flex items-center justify-center gap-1.5 text-amber-800 font-bold">
                          <Coffee className="w-4 h-4 text-amber-700" />
                          <span>Descanso</span>
                        </div>
                        <div className="text-[10px] font-normal text-amber-700 mt-0.5">{pInfo.time}</div>
                      </td>
                      <td colSpan={5} className="p-3 border border-amber-200 text-center text-xs font-semibold text-amber-800 tracking-wide bg-gradient-to-r from-amber-50/80 via-amber-100/60 to-amber-50/80">
                        <div className="flex items-center justify-center gap-2 font-bold">
                          <Coffee className="w-4 h-4 text-amber-600" />
                          <span>Descanso Institucional Estudiantil (30 min)</span>
                        </div>
                      </td>
                    </tr>
                  );
                }

                return (
                  <tr key={p} className="hover:bg-slate-50/50 transition-colors">
                    {/* Period header */}
                    <td className="p-3 border border-slate-200 text-center font-medium bg-slate-50/90 text-slate-700">
                      <span className="font-extrabold text-xs text-slate-800 block">{pInfo.name}</span>
                      <span className="text-[10px] font-semibold text-slate-500 flex items-center justify-center gap-1 mt-0.5">
                        <Clock className="w-3 h-3 text-slate-400" />
                        {pInfo.time}
                      </span>
                    </td>

                    {/* Day Slots */}
                    {days.map(d => {
                      const isFridayPeriod8 = isUpperGrade && d === 5 && p === 8;
                      if (isFridayPeriod8) {
                        return (
                          <td key={d} className="p-2.5 border border-slate-200 text-center bg-emerald-50/40">
                            <div className="flex flex-col items-center justify-center py-2 px-1">
                              <span className="text-[11px] font-bold text-emerald-800 bg-emerald-100 px-2.5 py-1 rounded-lg border border-emerald-300">
                                Salida 1:30 p. m.
                              </span>
                              <span className="text-[10px] text-emerald-700/80 mt-1">Sin clase los viernes</span>
                            </div>
                          </td>
                        );
                      }

                      const slot = groupSlots.find(s => s.day === d && s.period === p);
                      if (!slot) {
                        return (
                          <td key={d} className="p-2.5 border border-slate-200 text-center bg-slate-50/30">
                            <span className="text-slate-300 text-xs">-</span>
                          </td>
                        );
                      }

                      const teacher = TEACHERS.find(t => t.id === slot.teacherId);
                      const style = getSubjectStyle(slot.subject);
                      const blockInfo = getSlotBlockInfo(d, p, slot.subject);
                      const isSubjectHighlighted = highlightedSubject === slot.subject;
                      const isDimmed = highlightedSubject !== null && !isSubjectHighlighted;

                      return (
                        <td
                          key={d}
                          onClick={() => setHighlightedSubject(isSubjectHighlighted ? null : slot.subject)}
                          className={`p-2 border border-slate-200 align-top transition-all cursor-pointer relative group ${
                            isDimmed ? 'opacity-30 grayscale' : ''
                          }`}
                        >
                          <div
                            className={`h-full rounded-xl border border-l-4 transition-all flex flex-col justify-between ${
                              style.bg
                            } ${style.border} ${style.borderAccent} ${
                              slideZoom === 'xlarge' ? 'min-h-[96px] p-3.5' : slideZoom === 'large' ? 'min-h-[82px] p-2.5' : 'min-h-[70px] p-2'
                            } ${
                              isSubjectHighlighted ? 'ring-2 ring-purple-600 shadow-md scale-[1.02]' : 'shadow-2xs hover:shadow-xs'
                            }`}
                          >
                            <div>
                              <div className="flex items-start justify-between gap-1">
                                <span className={`font-black leading-snug line-clamp-1 ${
                                  slideZoom === 'xlarge' ? 'text-sm' : 'text-xs'
                                } ${style.text}`}>
                                  {slot.subject}
                                </span>
                                {blockInfo.is2h ? (
                                  <span className={`text-[9px] font-extrabold px-1.5 py-0.2 rounded shrink-0 ${style.badgeBg} ${style.badgeText}`}>
                                    2h ({blockInfo.label})
                                  </span>
                                ) : (
                                  <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-slate-200 text-slate-700 shrink-0">
                                    1h
                                  </span>
                                )}
                              </div>

                              <div className="flex items-center gap-1 text-[11px] text-slate-600 mt-1.5">
                                <User className="w-3 h-3 text-slate-400 shrink-0" />
                                <span className="truncate font-medium">{teacher?.name || 'Por asignar'}</span>
                              </div>
                            </div>

                            <div className="flex items-center justify-between mt-2 pt-1 border-t border-black/5 text-[10px] text-slate-500">
                              <span className="font-semibold">{style.category}</span>
                              <span className="font-bold text-slate-700">{selectedCourse}</span>
                            </div>
                          </div>
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
