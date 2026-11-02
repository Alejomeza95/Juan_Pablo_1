import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { GeneratedOption } from './index';
import { COURSES } from '../../data/schedules';
import { TEACHERS } from '../../data/generatorData';
import { getSubjectStyle } from '../../utils/subjectStyles';
import { downloadCourseSchedulePdf, downloadAllCoursesSchedulePdf } from '../../utils/schedulePdfExport';
import { EngineSlot } from '../../utils/scheduleEngine';
import {
  X,
  Calendar,
  Maximize2,
  Minimize2,
  BookOpen,
  ZoomIn,
  FileDown,
  Printer,
  CheckCircle,
  Coffee,
  Check,
  Sparkles,
  Layers,
  ChevronLeft,
  ChevronRight,
  Play,
  Pause,
  Tv,
  Presentation,
  Clock
} from 'lucide-react';

interface SchedulePreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  options?: GeneratedOption[];
  activeOptionId?: string;
  onSelectOption?: (id: string) => void;
  initialCourse?: string;
  customSchedule?: EngineSlot[];
  title?: string;
}

export function SchedulePreviewModal({
  isOpen,
  onClose,
  options = [],
  activeOptionId = '',
  onSelectOption,
  initialCourse = COURSES[0],
  customSchedule,
  title
}: SchedulePreviewModalProps) {
  // Course slide index (0 to 11)
  const initialIndex = useMemo(() => {
    const idx = COURSES.indexOf(initialCourse);
    return idx >= 0 ? idx : 0;
  }, [initialCourse]);

  const [courseIndex, setCourseIndex] = useState<number>(initialIndex);
  const selectedCourse = COURSES[courseIndex] || COURSES[0];

  // Slide presentation mode
  const [slideMode, setSlideMode] = useState<'weekly' | 'daily' | 'cards' | 'subjects'>('weekly');
  const [selectedDay, setSelectedDay] = useState<number>(1);
  const [zoomLevel, setZoomLevel] = useState<'normal' | 'large' | 'xlarge'>('large');
  const [isAutoplay, setIsAutoplay] = useState(false);
  const [isBrowserFullscreen, setIsBrowserFullscreen] = useState(false);
  const [downloadingPdf, setDownloadingPdf] = useState(false);
  const [downloadingAllPdf, setDownloadingAllPdf] = useState(false);

  useEffect(() => {
    if (initialCourse) {
      const idx = COURSES.indexOf(initialCourse);
      if (idx >= 0) setCourseIndex(idx);
    }
  }, [initialCourse]);

  const activeOption = useMemo(() => {
    if (options && options.length > 0) {
      return options.find(o => o.id === activeOptionId) || options[0];
    }
    return undefined;
  }, [options, activeOptionId]);

  const schedule = useMemo(() => {
    if (customSchedule && customSchedule.length > 0) return customSchedule;
    if (activeOption) return activeOption.schedule;
    return [];
  }, [customSchedule, activeOption]);
  const isUpperGrade = selectedCourse.startsWith('10') || selectedCourse.startsWith('11');
  const groupSlots = useMemo(() => schedule.filter(s => s.groupId === selectedCourse), [schedule, selectedCourse]);
  const days = [1, 2, 3, 4, 5];
  const periods = isUpperGrade ? [1, 2, 3, 4, 5, 6, 7, 8] : [1, 2, 3, 4, 5, 6, 7];

  const handlePrevSlide = useCallback(() => {
    if (slideMode === 'daily') {
      if (selectedDay > 1) {
        setSelectedDay(prev => prev - 1);
      } else {
        setSelectedDay(5);
        setCourseIndex(prev => (prev > 0 ? prev - 1 : COURSES.length - 1));
      }
    } else {
      setCourseIndex(prev => (prev > 0 ? prev - 1 : COURSES.length - 1));
    }
  }, [slideMode, selectedDay]);

  const handleNextSlide = useCallback(() => {
    if (slideMode === 'daily') {
      if (selectedDay < 5) {
        setSelectedDay(prev => prev + 1);
      } else {
        setSelectedDay(1);
        setCourseIndex(prev => (prev < COURSES.length - 1 ? prev + 1 : 0));
      }
    } else {
      setCourseIndex(prev => (prev < COURSES.length - 1 ? prev + 1 : 0));
    }
  }, [slideMode, selectedDay]);

  // Autoplay slideshow effect (rotates slides every 8 seconds)
  useEffect(() => {
    if (!isOpen || !isAutoplay) return;
    const interval = setInterval(() => {
      handleNextSlide();
    }, 8000);
    return () => clearInterval(interval);
  }, [isOpen, isAutoplay, handleNextSlide]);

  // Keyboard navigation: Left/Right arrows, Space, Escape, F for fullscreen
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      } else if (e.key === 'ArrowRight' || e.key === 'PageDown' || e.key === ' ') {
        e.preventDefault();
        handleNextSlide();
      } else if (e.key === 'ArrowLeft' || e.key === 'PageUp') {
        e.preventDefault();
        handlePrevSlide();
      } else if (e.key === 'f' || e.key === 'F') {
        toggleBrowserFullscreen();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose, handleNextSlide, handlePrevSlide]);

  const toggleBrowserFullscreen = () => {
    try {
      if (!document.fullscreenElement) {
        document.documentElement.requestFullscreen().then(() => setIsBrowserFullscreen(true)).catch(() => {});
      } else {
        document.exitFullscreen().then(() => setIsBrowserFullscreen(false)).catch(() => {});
      }
    } catch (e) {}
  };

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

  const getSlotBlockInfo = (day: number, period: number, subject: string) => {
    const prev = groupSlots.find(s => s.day === day && s.subject === subject && s.period === period - 1);
    const next = groupSlots.find(s => s.day === day && s.subject === subject && s.period === period + 1);

    if (prev && !next) return { is2h: true, pos: 'end', label: '2ª hora' };
    if (!prev && next) return { is2h: true, pos: 'start', label: '1ª hora' };
    if (prev && next) return { is2h: true, pos: 'middle', label: 'Continua' };
    return { is2h: false, pos: 'single', label: '1 hora' };
  };

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
        blocks1h
      };
    }).sort((a, b) => b.total - a.total);
  }, [groupSlots]);

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

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex flex-col w-screen h-screen bg-slate-950 text-white select-none overflow-hidden animate-in fade-in duration-150">
      {/* TOP HEADER: Slide Info, Modes, Autoplay, Actions */}
      <div className="px-4 sm:px-6 py-3 bg-slate-900 border-b border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-3 shrink-0">
        {/* Left: Presentation Branding & Course Badge */}
        <div className="flex items-center gap-3">
          <div className="p-2 bg-purple-600/30 text-purple-300 rounded-xl border border-purple-500/30 flex items-center justify-center">
            <Presentation className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-[11px] font-black uppercase tracking-widest text-purple-300 bg-purple-500/20 px-2 py-0.5 rounded-md border border-purple-500/30">
                SLIDE {courseIndex + 1} DE {COURSES.length}
              </span>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                {title || (activeOption ? (activeOption.valid ? '100% Válido' : 'Con Observaciones') : 'Horario Oficial')}
              </span>
              {isAutoplay && (
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30 animate-pulse">
                  Slideshow Activo (8s)
                </span>
              )}
            </div>
            <h2 className="text-xl sm:text-2xl font-black text-white flex items-center gap-2 mt-0.5">
              <span>Grado {selectedCourse}</span>
              <span className="text-xs font-semibold text-purple-300">
                {isUpperGrade ? '· Salida L-J 2:15 p.m. / V 1:30 p.m.' : '· Salida institucional 1:30 p.m.'}
              </span>
            </h2>
          </div>
        </div>

        {/* Center: Slide Switcher & Slide Modes */}
        <div className="flex items-center gap-2 flex-wrap justify-center">
          {/* Previous / Next Slide Buttons */}
          <div className="flex items-center gap-1 bg-slate-800 p-1 rounded-xl border border-slate-700">
            <button
              onClick={handlePrevSlide}
              className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-black text-slate-200 hover:text-white hover:bg-slate-700 transition-colors"
              title="Diapositiva anterior (Flecha Izquierda)"
            >
              <ChevronLeft className="w-4 h-4" />
              <span>Anterior</span>
            </button>
            <div className="px-2 text-xs font-bold text-purple-300 border-x border-slate-700">
              {courseIndex + 1} / {COURSES.length}
            </div>
            <button
              onClick={handleNextSlide}
              className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-black text-slate-200 hover:text-white hover:bg-slate-700 transition-colors"
              title="Siguiente diapositiva (Flecha Derecha / Espacio)"
            >
              <span>Siguiente</span>
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          {/* Slide Mode Toggle */}
          <div className="flex items-center gap-1 bg-slate-800 p-1 rounded-xl border border-slate-700">
            <button
              onClick={() => setSlideMode('weekly')}
              className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-black transition-all ${
                slideMode === 'weekly' ? 'bg-purple-600 text-white shadow-sm' : 'text-slate-300 hover:text-white'
              }`}
            >
              <Calendar className="w-3.5 h-3.5" />
              <span>Slide 5 Jornadas</span>
            </button>
            <button
              onClick={() => setSlideMode('daily')}
              className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-black transition-all ${
                slideMode === 'daily' ? 'bg-purple-600 text-white shadow-sm' : 'text-slate-300 hover:text-white'
              }`}
            >
              <Tv className="w-3.5 h-3.5" />
              <span>Slide por Día</span>
            </button>
            <button
              onClick={() => setSlideMode('cards')}
              className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-black transition-all ${
                slideMode === 'cards' ? 'bg-purple-600 text-white shadow-sm' : 'text-slate-300 hover:text-white'
              }`}
            >
              <Layers className="w-3.5 h-3.5" />
              <span>5 Columnas</span>
            </button>
          </div>

          {/* Autoplay Slideshow Toggle */}
          <button
            onClick={() => setIsAutoplay(!isAutoplay)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-black transition-all border ${
              isAutoplay
                ? 'bg-amber-500 hover:bg-amber-400 text-slate-950 border-amber-400 shadow-sm'
                : 'bg-slate-800 text-slate-300 hover:text-white border-slate-700'
            }`}
            title="Reproducción automática de diapositivas (cada 8 segundos)"
          >
            {isAutoplay ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
            <span>{isAutoplay ? 'Pausar' : 'Autoplay'}</span>
          </button>
        </div>

        {/* Right: Fullscreen, Print, Download, Close */}
        <div className="flex items-center gap-2 justify-end">
          {options && options.length > 1 && onSelectOption && activeOptionId && (
            <div className="flex items-center gap-1 bg-slate-800 px-2.5 py-1.5 rounded-xl border border-slate-700 text-xs">
              <span className="text-slate-400 text-[11px]">Opción:</span>
              <select
                value={activeOptionId}
                onChange={(e) => onSelectOption(e.target.value)}
                className="bg-transparent text-white font-bold outline-none cursor-pointer text-xs"
              >
                {options.map((opt) => (
                  <option key={opt.id} value={opt.id} className="bg-slate-800 text-white">
                    {opt.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          <button
            onClick={toggleBrowserFullscreen}
            className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-xl transition-colors border border-slate-700"
            title="Pantalla completa nativa (F)"
          >
            {isBrowserFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          </button>

          <button
            onClick={() => window.print()}
            title="Imprimir Diapositiva"
            className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-xl transition-colors border border-slate-700"
          >
            <Printer className="w-4 h-4" />
          </button>

          <button
            onClick={handleDownloadCoursePdf}
            disabled={downloadingPdf}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-purple-600 hover:bg-purple-500 text-white rounded-xl text-xs font-black transition-all disabled:opacity-50"
            title={`Descargar PDF de Grado ${selectedCourse}`}
          >
            <FileDown className="w-4 h-4" />
            <span className="hidden sm:inline">{downloadingPdf ? 'PDF...' : `PDF (${selectedCourse})`}</span>
          </button>

          <button
            onClick={onClose}
            className="flex items-center gap-1 px-3.5 py-1.5 bg-rose-600 hover:bg-rose-500 text-white rounded-xl text-xs font-black transition-colors shadow-sm ml-1"
            title="Salir de pantalla completa (Esc)"
          >
            <X className="w-4 h-4" />
            <span>Salir</span>
          </button>
        </div>
      </div>

      {/* STAGE: THE FULL-SCREEN SLIDE AREA */}
      <div className="flex-1 relative flex flex-col justify-center items-center p-3 sm:p-5 overflow-y-auto bg-gradient-to-b from-slate-950 via-slate-900 to-indigo-950">
        {/* Floating Left Arrow (Previous Slide) */}
        <button
          onClick={handlePrevSlide}
          className="absolute left-3 top-1/2 -translate-y-1/2 z-20 w-12 h-14 bg-slate-900/80 hover:bg-purple-600 text-white hover:text-white border border-slate-700 hover:border-purple-500 rounded-2xl flex items-center justify-center transition-all shadow-xl hover:scale-110 backdrop-blur-sm group"
          title="Diapositiva Anterior (Flecha Izquierda)"
        >
          <ChevronLeft className="w-7 h-7 group-hover:-translate-x-0.5 transition-transform" />
        </button>

        {/* Floating Right Arrow (Next Slide) */}
        <button
          onClick={handleNextSlide}
          className="absolute right-3 top-1/2 -translate-y-1/2 z-20 w-12 h-14 bg-slate-900/80 hover:bg-purple-600 text-white hover:text-white border border-slate-700 hover:border-purple-500 rounded-2xl flex items-center justify-center transition-all shadow-xl hover:scale-110 backdrop-blur-sm group"
          title="Siguiente Diapositiva (Flecha Derecha / Espacio)"
        >
          <ChevronRight className="w-7 h-7 group-hover:translate-x-0.5 transition-transform" />
        </button>

        {/* SLIDE CANVAS */}
        <div className="w-full max-w-[1750px] mx-auto px-10 transition-all duration-300">
          {/* MODE 1: WEEKLY 5 JORNADAS SLIDE (DEFAULT) */}
          {slideMode === 'weekly' && (
            <div className="bg-white rounded-3xl border-2 border-slate-300 shadow-2xl overflow-hidden text-slate-900">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse min-w-[980px]">
                  <thead>
                    <tr className="bg-slate-950 text-white">
                      <th className="p-3.5 w-36 sm:w-44 border-r border-slate-800 text-center uppercase font-black text-xs tracking-wider">
                        Periodo / Hora
                      </th>
                      {days.map(d => (
                        <th key={d} className="p-3.5 border-r border-slate-800 last:border-r-0 text-center">
                          <span className="text-[10px] font-black text-purple-300 uppercase tracking-widest block">
                            Jornada {d}
                          </span>
                          <span className="text-base sm:text-lg font-black uppercase text-white tracking-wide">
                            {dayNames[d]}
                          </span>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {periods.map(p => {
                      const pInfo = getPeriodLabel(p);
                      const isBreak = p === 4;

                      if (isBreak) {
                        return (
                          <tr key={p} className="bg-gradient-to-r from-amber-100 via-amber-50 to-amber-100 border-y-2 border-amber-300">
                            <td className="p-3 border-r border-amber-200 text-center font-black text-amber-950 bg-amber-200/50">
                              <div className="flex items-center justify-center gap-1.5">
                                <Coffee className="w-4 h-4 text-amber-700" />
                                <span className="text-xs sm:text-sm font-black">Descanso</span>
                              </div>
                              <span className="block text-[10px] text-amber-800 font-bold mt-0.5">{pInfo.time}</span>
                            </td>
                            <td colSpan={5} className="p-3 text-center text-amber-950">
                              <div className="flex items-center justify-center gap-2">
                                <span className="text-xs sm:text-sm font-black tracking-wide uppercase text-amber-900">
                                  Descanso Institucional (30 minutos)
                                </span>
                                <span className="text-xs text-amber-800 hidden sm:inline font-medium">
                                  — Franja de receso común para todos los grados y docentes
                                </span>
                              </div>
                            </td>
                          </tr>
                        );
                      }

                      return (
                        <tr key={p} className="hover:bg-slate-50/80 transition-colors">
                          <td className="p-3 border-r border-slate-200 bg-slate-50 text-center font-bold text-slate-700">
                            <span className="text-xs sm:text-sm font-black text-slate-900 block">{pInfo.name}</span>
                            <span className="text-[10px] sm:text-[11px] text-purple-700 font-extrabold block mt-0.5">{pInfo.time}</span>
                          </td>

                          {days.map(d => {
                            const isFridayPeriod8 = isUpperGrade && d === 5 && p === 8;
                            if (isFridayPeriod8) {
                              return (
                                <td key={d} className="p-2.5 border-r border-slate-200 last:border-r-0 text-center bg-emerald-50/70">
                                  <div className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-100 border border-emerald-200 text-emerald-900 text-xs font-bold">
                                    <Check className="w-3.5 h-3.5 text-emerald-600" />
                                    <span>Salida 1:30 p. m.</span>
                                  </div>
                                  <span className="block text-[10px] text-emerald-700 mt-0.5">Fin de semana</span>
                                </td>
                              );
                            }

                            const slot = groupSlots.find(s => s.day === d && s.period === p);
                            if (!slot) {
                              return (
                                <td key={d} className="p-2.5 border-r border-slate-200 last:border-r-0 text-center text-slate-300 italic">
                                  —
                                </td>
                              );
                            }

                            const teacher = TEACHERS.find(t => t.id === slot.teacherId);
                            const style = getSubjectStyle(slot.subject);
                            const blockInfo = getSlotBlockInfo(d, p, slot.subject);

                            return (
                              <td
                                key={d}
                                className={`p-2.5 sm:p-3 border-r border-slate-200 last:border-r-0 border-l-4 transition-all ${
                                  style.bg
                                } ${style.borderAccent}`}
                              >
                                <div className="flex flex-col justify-between h-full">
                                  <div>
                                    <div className="flex items-center justify-between gap-1 flex-wrap mb-1">
                                      <span className={`text-[10px] font-bold px-2 py-0.2 rounded-full ${style.badgeBg} ${style.badgeText}`}>
                                        {style.category}
                                      </span>
                                      {blockInfo.is2h && (
                                        <span className="text-[9px] font-black px-1.5 py-0.2 rounded bg-purple-700 text-white shadow-2xs">
                                          Bloque 2h
                                        </span>
                                      )}
                                    </div>

                                    <h5 className={`font-black text-slate-900 leading-tight tracking-tight text-sm sm:text-base ${style.text}`}>
                                      {slot.subject}
                                    </h5>
                                  </div>

                                  <div className="mt-1 pt-1 border-t border-slate-200/60 text-xs font-semibold text-slate-700 truncate">
                                    {teacher ? teacher.name : 'Por asignar'}
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
            </div>
          )}

          {/* MODE 2: DAILY SLIDE (GIANT 1-DAY PRESENTATION) */}
          {slideMode === 'daily' && (
            <div className="bg-white rounded-3xl border-2 border-slate-300 shadow-2xl overflow-hidden p-6 sm:p-8 text-slate-900 max-w-4xl mx-auto">
              {/* Day Header with tabs */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200 mb-6">
                <div>
                  <span className="text-xs font-black uppercase tracking-widest text-purple-600 bg-purple-100 px-3 py-1 rounded-full">
                    Jornada Escolar del Día
                  </span>
                  <h3 className="text-3xl font-black text-slate-900 mt-2">
                    {dayNames[selectedDay]} — Grado {selectedCourse}
                  </h3>
                </div>

                <div className="flex items-center gap-1.5 bg-slate-100 p-1.5 rounded-2xl border border-slate-200">
                  {days.map(d => (
                    <button
                      key={d}
                      onClick={() => setSelectedDay(d)}
                      className={`px-3.5 py-1.5 rounded-xl text-xs font-black transition-all ${
                        selectedDay === d
                          ? 'bg-purple-600 text-white shadow-sm scale-105'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      {dayNames[d]}
                    </button>
                  ))}
                </div>
              </div>

              {/* Periods List in Large Slide Format */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                {periods.map(p => {
                  const pInfo = getPeriodLabel(p);
                  const isBreak = p === 4;

                  if (isBreak) {
                    return (
                      <div key={p} className="md:col-span-2 p-4 rounded-2xl bg-amber-100 border-2 border-amber-300 flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <Coffee className="w-6 h-6 text-amber-800" />
                          <div>
                            <span className="font-black text-amber-950 text-base block">Descanso Institucional</span>
                            <span className="text-xs text-amber-800 font-bold">{pInfo.time} (30 minutos)</span>
                          </div>
                        </div>
                        <span className="text-xs font-extrabold px-3 py-1 bg-white/80 text-amber-900 rounded-xl border border-amber-200">
                          Receso Común
                        </span>
                      </div>
                    );
                  }

                  const isFridayPeriod8 = isUpperGrade && selectedDay === 5 && p === 8;
                  if (isFridayPeriod8) {
                    return (
                      <div key={p} className="p-4 rounded-2xl bg-emerald-50 border-2 border-dashed border-emerald-300 text-center flex flex-col justify-center">
                        <span className="text-sm font-black text-emerald-900">Salida 1:30 p. m.</span>
                        <span className="text-xs text-emerald-700">Fin de semana para grado {selectedCourse}</span>
                      </div>
                    );
                  }

                  const slot = groupSlots.find(s => s.day === selectedDay && s.period === p);
                  if (!slot) {
                    return (
                      <div key={p} className="p-4 rounded-2xl bg-slate-50 border border-slate-200 text-slate-400 text-center flex items-center justify-center">
                        <span>Sin asignar</span>
                      </div>
                    );
                  }

                  const teacher = TEACHERS.find(t => t.id === slot.teacherId);
                  const style = getSubjectStyle(slot.subject);
                  const blockInfo = getSlotBlockInfo(selectedDay, p, slot.subject);

                  return (
                    <div
                      key={p}
                      className={`p-4 rounded-2xl border-2 border-l-8 shadow-xs ${style.bg} ${style.border} ${style.borderAccent} flex flex-col justify-between`}
                    >
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <span className={`text-[11px] font-extrabold px-2.5 py-0.5 rounded-full ${style.badgeBg} ${style.badgeText}`}>
                          {style.category}
                        </span>
                        <div className="text-right">
                          <span className="text-xs font-black text-slate-900 block">{pInfo.name}</span>
                          <span className="text-[11px] text-purple-700 font-bold">{pInfo.time}</span>
                        </div>
                      </div>

                      <div>
                        <h4 className="font-black text-slate-900 text-lg leading-tight">
                          {slot.subject}
                        </h4>
                        <p className="text-xs text-slate-700 font-bold mt-1">
                          Docente: <span className="text-slate-900">{teacher ? teacher.name : 'Por asignar'}</span>
                        </p>
                      </div>

                      {blockInfo.is2h && (
                        <div className="mt-3 pt-2 border-t border-slate-200/60 flex items-center justify-between text-[11px] font-black text-purple-800">
                          <span>Bloque Continuo</span>
                          <span className="px-2 py-0.5 bg-purple-700 text-white rounded-md text-[10px]">
                            {blockInfo.label}
                          </span>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* MODE 3: 5 COLUMN CARDS */}
          {slideMode === 'cards' && (
            <div className="bg-white rounded-3xl border-2 border-slate-300 shadow-2xl p-6 overflow-x-auto text-slate-900">
              <div className="grid grid-cols-5 gap-3.5 min-w-[1100px]">
                {days.map(d => (
                  <div key={d} className="flex flex-col bg-slate-50 rounded-2xl border border-slate-200 overflow-hidden shadow-xs">
                    <div className="p-3 bg-slate-950 text-white text-center">
                      <span className="text-[10px] font-black text-purple-300 uppercase tracking-widest block">
                        Jornada {d}
                      </span>
                      <h5 className="text-base font-black uppercase text-white mt-0.5">
                        {dayNames[d]}
                      </h5>
                    </div>

                    <div className="p-3 space-y-2 flex-1">
                      {periods.map(p => {
                        const pInfo = getPeriodLabel(p);
                        const isBreak = p === 4;

                        if (isBreak) {
                          return (
                            <div key={p} className="p-2 rounded-xl bg-amber-100 border border-amber-300 text-center">
                              <span className="font-black text-amber-950 text-xs block">Descanso</span>
                              <span className="text-[10px] text-amber-800 font-bold">{pInfo.time}</span>
                            </div>
                          );
                        }

                        const isFridayPeriod8 = isUpperGrade && d === 5 && p === 8;
                        if (isFridayPeriod8) {
                          return (
                            <div key={p} className="p-2 rounded-xl bg-emerald-50 border border-emerald-300 text-center text-xs text-emerald-800 font-bold">
                              Salida 1:30 p.m.
                            </div>
                          );
                        }

                        const slot = groupSlots.find(s => s.day === d && s.period === p);
                        if (!slot) {
                          return (
                            <div key={p} className="p-2 rounded-xl bg-white border border-slate-200 text-slate-300 text-center text-xs">
                              —
                            </div>
                          );
                        }

                        const teacher = TEACHERS.find(t => t.id === slot.teacherId);
                        const style = getSubjectStyle(slot.subject);

                        return (
                          <div
                            key={p}
                            className={`p-2.5 rounded-xl border-2 border-l-6 shadow-2xs ${style.bg} ${style.border} ${style.borderAccent}`}
                          >
                            <div className="flex items-center justify-between text-[10px] font-bold text-slate-500 mb-0.5">
                              <span>{pInfo.name}</span>
                              <span>{pInfo.time}</span>
                            </div>
                            <h6 className="font-black text-slate-900 text-sm leading-tight">
                              {slot.subject}
                            </h6>
                            <p className="text-[11px] text-slate-700 font-semibold truncate mt-0.5">
                              {teacher ? teacher.name : 'Por asignar'}
                            </p>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* BOTTOM SLIDE DECK BAR: Clickable Course Slide Pills & Keyboard Hint */}
      <div className="px-4 sm:px-6 py-2.5 bg-slate-950 border-t border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shrink-0">
        {/* Course Slide Dots / Buttons */}
        <div className="flex items-center gap-1.5 overflow-x-auto py-1">
          <span className="text-[11px] font-black uppercase text-slate-400 mr-2 shrink-0">
            Diapositivas:
          </span>
          {COURSES.map((course, idx) => {
            const isCurrent = idx === courseIndex;
            return (
              <button
                key={course}
                onClick={() => setCourseIndex(idx)}
                className={`px-3 py-1 rounded-xl text-xs font-black transition-all shrink-0 ${
                  isCurrent
                    ? 'bg-purple-600 text-white shadow-lg ring-2 ring-purple-400 scale-110'
                    : 'bg-slate-900 text-slate-300 hover:bg-slate-800 hover:text-white border border-slate-800'
                }`}
              >
                {course}
              </button>
            );
          })}
        </div>

        {/* Keyboard instructions & All Courses PDF */}
        <div className="flex items-center gap-3 text-xs text-slate-400 self-center sm:self-auto">
          <span className="hidden md:inline text-[11px]">
            Navega con flechas <kbd className="px-1.5 py-0.5 bg-slate-800 rounded border border-slate-700 text-slate-200">←</kbd> <kbd className="px-1.5 py-0.5 bg-slate-800 rounded border border-slate-700 text-slate-200">→</kbd> o <kbd className="px-1.5 py-0.5 bg-slate-800 rounded border border-slate-700 text-slate-200">Espacio</kbd>
          </span>

          <button
            onClick={handleDownloadAllPdf}
            disabled={downloadingAllPdf}
            className="flex items-center gap-1.5 px-3 py-1 bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-800 rounded-xl text-xs font-bold transition-all disabled:opacity-50"
          >
            <FileDown className="w-3.5 h-3.5" />
            <span>{downloadingAllPdf ? 'Generando...' : 'PDF Todos los Grados'}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
