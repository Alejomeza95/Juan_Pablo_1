import React, { useState, useMemo, useEffect } from 'react';
import { EngineSlot } from '../../utils/scheduleEngine';
import { COURSES } from '../../data/schedules';
import { TEACHERS } from '../../data/generatorData';
import { getSubjectStyle } from '../../utils/subjectStyles';
import { downloadCourseSchedulePdf, downloadAllCoursesSchedulePdf } from '../../utils/schedulePdfExport';
import {
  Maximize2,
  Minimize2,
  Calendar,
  Coffee,
  Check,
  FileDown,
  Printer,
  ZoomIn,
  CheckCircle,
  Eye,
  Layers,
  Sparkles,
  BookOpen,
  Tv,
  Presentation,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';

interface ScheduleLivePreviewProps {
  schedule: EngineSlot[];
  optionName: string;
  isValid: boolean;
  onOpenModalPreview?: () => void;
}

export function ScheduleLivePreview({
  schedule,
  optionName,
  isValid,
  onOpenModalPreview
}: ScheduleLivePreviewProps) {
  const [selectedCourse, setSelectedCourse] = useState<string>(COURSES[0]);
  // Default and primary: 'panoramic' (Las 5 Jornadas Completas lado a lado)
  const [previewMode, setPreviewMode] = useState<'panoramic' | 'cards' | 'slide' | 'subjects'>('panoramic');
  const [currentSlideDay, setCurrentSlideDay] = useState<number>(1);
  const [zoomLevel, setZoomLevel] = useState<'normal' | 'large' | 'xlarge'>('large');
  const [isFullScreen, setIsFullScreen] = useState(false);
  const [downloadingPdf, setDownloadingPdf] = useState(false);
  const [downloadingAllPdf, setDownloadingAllPdf] = useState(false);

  const isUpperGrade = selectedCourse.startsWith('10') || selectedCourse.startsWith('11');
  const groupSlots = useMemo(() => schedule.filter(s => s.groupId === selectedCourse), [schedule, selectedCourse]);
  const days = [1, 2, 3, 4, 5];
  const periods = isUpperGrade ? [1, 2, 3, 4, 5, 6, 7, 8] : [1, 2, 3, 4, 5, 6, 7];

  // Handle ESC key to exit full screen
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isFullScreen) {
        setIsFullScreen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isFullScreen]);

  const toggleFullScreen = () => {
    if (!isFullScreen) {
      setIsFullScreen(true);
      try {
        if (!document.fullscreenElement && document.documentElement.requestFullscreen) {
          document.documentElement.requestFullscreen().catch(() => {});
        }
      } catch (err) {}
    } else {
      setIsFullScreen(false);
      try {
        if (document.fullscreenElement && document.exitFullscreen) {
          document.exitFullscreen().catch(() => {});
        }
      } catch (err) {}
    }
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

  // Subject summary for this course
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

  const handleDownloadPdf = async () => {
    setDownloadingPdf(true);
    try {
      await downloadCourseSchedulePdf(selectedCourse, schedule);
    } catch (err) {
      console.error(err);
      alert('Error al descargar el PDF.');
    } finally {
      setDownloadingPdf(false);
    }
  };

  const handleDownloadAllPdf = async () => {
    setDownloadingAllPdf(true);
    try {
      await downloadAllCoursesSchedulePdf(schedule);
    } catch (err) {
      console.error(err);
      alert('Error al descargar el PDF de todos los cursos.');
    } finally {
      setDownloadingAllPdf(false);
    }
  };

  if (!schedule || schedule.length === 0) {
    return (
      <div className="p-8 text-center bg-white rounded-2xl border border-slate-200 text-slate-500">
        No hay horario generado disponible para vista previa.
      </div>
    );
  }

  // Common content of the 5 Jornadas Panorámicas
  const renderScheduleContent = () => {
    if (previewMode === 'subjects') {
      return (
        <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h4 className="font-black text-slate-900 text-xl">
                Distribución de Asignaturas — Grado {selectedCourse}
              </h4>
              <p className="text-xs text-slate-500">
                {groupSlots.length} horas académicas programadas semanalmente
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {subjectSummary.map(sub => {
              const style = getSubjectStyle(sub.subject);
              return (
                <div
                  key={sub.subject}
                  className={`p-4 rounded-2xl border-2 border-l-8 ${style.bg} ${style.border} ${style.borderAccent} shadow-xs flex flex-col justify-between`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <h5 className="font-black text-slate-900 text-lg leading-tight">{sub.subject}</h5>
                      <p className="text-xs text-slate-700 mt-1 font-semibold">
                        Docente: <span className="text-slate-900">{sub.teacherName}</span>
                      </p>
                    </div>
                    <span className="text-xs font-black px-3 py-1 rounded-xl bg-white border border-slate-200 text-purple-700 shadow-2xs">
                      {sub.total}h / sem
                    </span>
                  </div>

                  <div className="mt-3 pt-2.5 border-t border-slate-200/60 flex items-center justify-between text-xs text-slate-600">
                    <div className="flex items-center gap-1 flex-wrap">
                      {days.map(d => {
                        const periodsInDay = sub.days[d] || [];
                        if (periodsInDay.length === 0) return null;
                        return (
                          <span key={d} className="px-2 py-0.5 rounded-lg bg-white text-slate-800 font-bold text-[11px] border border-slate-200 shadow-2xs">
                            {dayNames[d]}: {periodsInDay.length}h
                          </span>
                        );
                      })}
                    </div>
                    {sub.blocks2h > 0 && (
                      <span className="text-[11px] font-bold text-purple-700 bg-purple-50 px-2 py-0.5 rounded-md">
                        {sub.blocks2h} {sub.blocks2h === 1 ? 'bloque doble' : 'bloques dobles'}
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      );
    }

    if (previewMode === 'slide') {
      return (
        <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-4 sm:p-6 space-y-4">
          {/* Slide Navigation Header */}
          <div className="bg-slate-900 text-white p-4 rounded-2xl flex flex-wrap items-center justify-between gap-3 shadow-md">
            <div className="flex items-center gap-2">
              <button
                onClick={() => setCurrentSlideDay(prev => Math.max(1, prev - 1))}
                disabled={currentSlideDay === 1}
                className="p-2 bg-slate-800 hover:bg-slate-700 text-white rounded-xl disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                title="Día anterior"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>

              <div className="flex items-center gap-1.5 flex-wrap">
                {days.map(d => {
                  const isCurrent = d === currentSlideDay;
                  return (
                    <button
                      key={d}
                      onClick={() => setCurrentSlideDay(d)}
                      className={`px-3.5 py-1.5 rounded-xl text-xs font-black transition-all ${
                        isCurrent
                          ? 'bg-purple-600 text-white shadow-md ring-2 ring-purple-400 scale-105'
                          : 'bg-slate-800 text-slate-300 hover:bg-slate-700 hover:text-white'
                      }`}
                    >
                      Día {d} • {dayNames[d]}
                    </button>
                  );
                })}
              </div>

              <button
                onClick={() => setCurrentSlideDay(prev => Math.min(5, prev + 1))}
                disabled={currentSlideDay === 5}
                className="p-2 bg-slate-800 hover:bg-slate-700 text-white rounded-xl disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                title="Día siguiente"
              >
                <ChevronRight className="w-5 h-5" />
              </button>
            </div>

            <div className="flex items-center gap-2">
              <div className="text-right mr-2 hidden sm:block">
                <span className="text-xs font-black text-purple-300 uppercase tracking-wider block">
                  Grado {selectedCourse} • {dayNames[currentSlideDay]}
                </span>
                <span className="text-[11px] text-slate-400">
                  {isUpperGrade && currentSlideDay === 5 ? 'Salida 1:30 p.m.' : isUpperGrade ? 'Salida 2:15 p.m.' : 'Salida 1:30 p.m.'}
                </span>
              </div>

              {onOpenModalPreview && (
                <button
                  onClick={onOpenModalPreview}
                  className="flex items-center gap-1.5 px-3.5 py-2 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white rounded-xl text-xs font-black transition-all shadow-sm hover:scale-105"
                  title="Abrir Slide en Pantalla Completa (Modo Diapositivas)"
                >
                  <Tv className="w-4 h-4 text-purple-200" />
                  <span>Slide Pantalla Completa</span>
                </button>
              )}
            </div>
          </div>

          {/* Big Slide Cards Stack for Current Day */}
          <div className="space-y-3 max-w-4xl mx-auto w-full">
            {periods.map(p => {
              const pInfo = getPeriodLabel(p);
              const isBreak = p === 4;

              if (isBreak) {
                return (
                  <div
                    key={p}
                    className="p-4 rounded-2xl bg-gradient-to-r from-amber-100 via-amber-50 to-amber-100 border-2 border-amber-300 flex items-center justify-between shadow-xs"
                  >
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-amber-200 rounded-xl text-amber-800">
                        <Coffee className="w-5 h-5" />
                      </div>
                      <div>
                        <h5 className="font-black text-amber-950 text-base">Descanso Institucional</h5>
                        <p className="text-xs text-amber-800 font-semibold">Franja común de receso general</p>
                      </div>
                    </div>
                    <span className="text-xs font-black px-3 py-1.5 rounded-xl bg-amber-200 text-amber-900 border border-amber-300">
                      {pInfo.time}
                    </span>
                  </div>
                );
              }

              const isFridayPeriod8 = isUpperGrade && currentSlideDay === 5 && p === 8;
              if (isFridayPeriod8) {
                return (
                  <div
                    key={p}
                    className="p-4 rounded-2xl bg-emerald-50 border-2 border-emerald-300 flex items-center justify-between text-emerald-900 shadow-xs"
                  >
                    <div className="flex items-center gap-2">
                      <Check className="w-5 h-5 text-emerald-600" />
                      <span className="font-black text-sm">Salida Institucional de Viernes</span>
                    </div>
                    <span className="text-xs font-black px-3 py-1.5 rounded-xl bg-emerald-100 text-emerald-800">
                      1:30 p.m.
                    </span>
                  </div>
                );
              }

              const slot = groupSlots.find(s => s.day === currentSlideDay && s.period === p);
              if (!slot) {
                return (
                  <div
                    key={p}
                    className="p-4 rounded-2xl bg-slate-50 border border-slate-200 text-slate-400 text-center text-sm font-semibold"
                  >
                    {pInfo.name} ({pInfo.time}) — Sin clase asignada
                  </div>
                );
              }

              const teacher = TEACHERS.find(t => t.id === slot.teacherId);
              const style = getSubjectStyle(slot.subject);
              const blockInfo = getSlotBlockInfo(currentSlideDay, p, slot.subject);

              return (
                <div
                  key={p}
                  className={`p-4 sm:p-5 rounded-2xl border-2 border-l-8 shadow-sm transition-all ${style.bg} ${style.border} ${style.borderAccent} flex flex-col sm:flex-row sm:items-center justify-between gap-3`}
                >
                  <div className="flex items-center gap-4">
                    <div className="flex flex-col items-center justify-center p-2 rounded-xl bg-white/80 border border-slate-200 min-w-[75px] shadow-2xs">
                      <span className="text-xs font-black text-purple-700">{pInfo.name}</span>
                      <span className="text-[10px] text-slate-500 font-bold mt-0.5">{pInfo.time}</span>
                    </div>

                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${style.badgeBg} ${style.badgeText}`}>
                          {style.category}
                        </span>
                        {blockInfo.is2h && (
                          <span className="text-[10px] font-black px-2 py-0.5 rounded bg-purple-700 text-white">
                            Bloque 2 Horas ({blockInfo.label})
                          </span>
                        )}
                      </div>
                      <h4 className="text-lg sm:text-xl font-black text-slate-900 leading-tight">
                        {slot.subject}
                      </h4>
                      <p className="text-xs text-slate-700 font-semibold mt-1">
                        Docente: <strong className="text-slate-900">{teacher ? teacher.name : 'Por asignar'}</strong>
                      </p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      );
    }

    if (previewMode === 'cards') {
      // 5 Column Cards View (All 5 days side by side)
      return (
        <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-4 sm:p-6 overflow-x-auto">
          <div className="grid grid-cols-5 gap-4 min-w-[1100px]">
            {days.map(d => (
              <div key={d} className="flex flex-col bg-slate-50/80 rounded-2xl border border-slate-200 overflow-hidden shadow-xs">
                <div className="p-3.5 bg-slate-900 text-white text-center">
                  <span className="text-[10px] font-black text-purple-300 uppercase tracking-widest block">
                    Jornada {d}
                  </span>
                  <h5 className="text-base sm:text-lg font-black uppercase tracking-tight text-white mt-0.5">
                    {dayNames[d]}
                  </h5>
                </div>

                <div className="p-3 space-y-2.5 flex-1">
                  {periods.map(p => {
                    const pInfo = getPeriodLabel(p);
                    const isBreak = p === 4;

                    if (isBreak) {
                      return (
                        <div key={p} className="p-2.5 rounded-xl bg-amber-100/90 border border-amber-300 text-center">
                          <span className="font-black text-amber-950 text-xs block">Descanso Institucional</span>
                          <span className="text-[10px] text-amber-800 font-bold">{pInfo.time}</span>
                        </div>
                      );
                    }

                    const isFridayPeriod8 = isUpperGrade && d === 5 && p === 8;
                    if (isFridayPeriod8) {
                      return (
                        <div key={p} className="p-2.5 rounded-xl bg-emerald-50 border border-dashed border-emerald-300 text-center text-xs text-emerald-800 font-bold">
                          Salida 1:30 p. m.
                        </div>
                      );
                    }

                    const slot = groupSlots.find(s => s.day === d && s.period === p);
                    if (!slot) {
                      return (
                        <div key={p} className="p-2.5 rounded-xl bg-white border border-slate-200 text-slate-300 text-center text-xs">
                          —
                        </div>
                      );
                    }

                    const teacher = TEACHERS.find(t => t.id === slot.teacherId);
                    const style = getSubjectStyle(slot.subject);
                    const blockInfo = getSlotBlockInfo(d, p, slot.subject);

                    return (
                      <div
                        key={p}
                        className={`p-3 rounded-xl border-2 border-l-6 shadow-2xs ${style.bg} ${style.border} ${style.borderAccent}`}
                      >
                        <div className="flex items-center justify-between text-[10px] font-bold text-slate-400 mb-1">
                          <span>{pInfo.name}</span>
                          <span>{pInfo.time}</span>
                        </div>
                        <h6 className="font-black text-slate-900 text-sm sm:text-base leading-tight">
                          {slot.subject}
                        </h6>
                        <p className="text-[11px] text-slate-700 font-semibold truncate mt-1">
                          {teacher ? teacher.name : 'Por asignar'}
                        </p>
                        {blockInfo.is2h && (
                          <span className="inline-block mt-1.5 text-[9px] font-black px-2 py-0.5 rounded-md bg-purple-700 text-white">
                            Bloque 2h
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>
      );
    }

    // Default: 'panoramic' (Matriz Panorámica Completa de las 5 Jornadas)
    return (
      <div className="bg-white rounded-3xl border-2 border-slate-200 shadow-md overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[980px]">
            <thead>
              <tr className="bg-slate-900 text-white">
                <th className="p-4 w-36 sm:w-44 border-r border-slate-800 text-center uppercase font-black text-xs tracking-wider">
                  Periodo / Hora
                </th>
                {days.map(d => (
                  <th key={d} className="p-4 border-r border-slate-800 last:border-r-0 text-center">
                    <span className="text-[10px] font-extrabold text-purple-300 uppercase tracking-widest block">
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
                      <td className="p-3 sm:p-4 border-r border-amber-200 text-center font-black text-amber-950 bg-amber-200/50">
                        <div className="flex items-center justify-center gap-1.5">
                          <Coffee className="w-4 h-4 text-amber-700" />
                          <span className="text-sm font-black">Descanso</span>
                        </div>
                        <span className="block text-[10px] text-amber-800 font-bold mt-0.5">{pInfo.time}</span>
                      </td>
                      <td colSpan={5} className="p-3.5 text-center text-amber-950">
                        <div className="flex items-center justify-center gap-2">
                          <span className="text-xs sm:text-sm font-black tracking-wide uppercase text-amber-900">
                            Descanso Institucional (30 minutos)
                          </span>
                          <span className="text-xs text-amber-800 hidden sm:inline font-medium">
                            — Franja común de receso institucional para todos los grados y docentes
                          </span>
                        </div>
                      </td>
                    </tr>
                  );
                }

                return (
                  <tr key={p} className="hover:bg-slate-50/70 transition-colors">
                    {/* Period Label Column */}
                    <td className={`p-3 sm:p-4 border-r border-slate-200 bg-slate-50 text-center font-bold text-slate-700 ${
                      zoomLevel === 'xlarge' ? 'py-5' : zoomLevel === 'large' ? 'py-4' : 'py-3'
                    }`}>
                      <span className="text-xs sm:text-sm font-black text-slate-900 block">{pInfo.name}</span>
                      <span className="text-[10px] sm:text-[11px] text-purple-700 font-extrabold block mt-0.5">{pInfo.time}</span>
                    </td>

                    {/* 5 Jornada Days Columns */}
                    {days.map(d => {
                      const isFridayPeriod8 = isUpperGrade && d === 5 && p === 8;
                      if (isFridayPeriod8) {
                        return (
                          <td key={d} className="p-3 border-r border-slate-200 last:border-r-0 text-center bg-emerald-50/60">
                            <div className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-100 border border-emerald-200 text-emerald-900 text-xs font-bold">
                              <Check className="w-3.5 h-3.5 text-emerald-600" />
                              <span>Salida 1:30 p. m.</span>
                            </div>
                            <span className="block text-[10px] text-emerald-700 mt-1">Fin de semana</span>
                          </td>
                        );
                      }

                      const slot = groupSlots.find(s => s.day === d && s.period === p);
                      if (!slot) {
                        return (
                          <td key={d} className="p-3 border-r border-slate-200 last:border-r-0 text-center text-slate-300 italic">
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
                          className={`p-3 sm:p-4 border-r border-slate-200 last:border-r-0 border-l-4 transition-all ${
                            style.bg
                          } ${style.borderAccent} ${
                            zoomLevel === 'xlarge' ? 'p-5' : zoomLevel === 'large' ? 'p-3.5' : 'p-2.5'
                          }`}
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

                              <h5 className={`font-black text-slate-900 leading-tight tracking-tight ${
                                zoomLevel === 'xlarge' ? 'text-lg' : zoomLevel === 'large' ? 'text-base' : 'text-sm'
                              } ${style.text}`}>
                                {slot.subject}
                              </h5>
                            </div>

                            <div className="mt-1.5 pt-1 border-t border-slate-200/60 text-xs font-semibold text-slate-700 truncate">
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
    );
  };

  // Full Screen View Overlay (Takes 100vw and 100vh)
  if (isFullScreen) {
    return (
      <div className="fixed inset-0 z-50 bg-slate-900 flex flex-col w-screen h-screen overflow-hidden animate-in fade-in duration-150">
        {/* Fullscreen Header */}
        <div className="px-6 py-4 bg-slate-950 text-white flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-slate-800 shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-purple-600/30 rounded-xl text-purple-300 border border-purple-500/40">
              <Eye className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-black text-purple-300 uppercase tracking-widest">
                  Horario Completo — 5 Jornadas (Lunes a Viernes)
                </span>
                <span className="text-[10px] px-2 py-0.5 rounded-full font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                  {isValid ? '100% Válido' : 'Observaciones'}
                </span>
              </div>
              <h3 className="text-xl sm:text-2xl font-black text-white flex items-center gap-2 mt-0.5">
                <span>{optionName}</span>
                <span className="text-xs font-bold text-purple-200 bg-white/10 px-2.5 py-0.5 rounded-lg">
                  Grado {selectedCourse}
                </span>
              </h3>
            </div>
          </div>

          {/* Action buttons in fullscreen */}
          <div className="flex items-center gap-2 flex-wrap">
            {/* View Mode Toggle */}
            <div className="flex items-center gap-1 bg-slate-800 p-1 rounded-xl">
              <button
                onClick={() => setPreviewMode('panoramic')}
                className={`px-3 py-1.5 rounded-lg text-xs font-black transition-all ${
                  previewMode === 'panoramic' ? 'bg-purple-600 text-white' : 'text-slate-300 hover:text-white'
                }`}
              >
                5 Jornadas (Matriz)
              </button>
              <button
                onClick={() => setPreviewMode('slide')}
                className={`px-3 py-1.5 rounded-lg text-xs font-black transition-all ${
                  previewMode === 'slide' ? 'bg-purple-600 text-white' : 'text-slate-300 hover:text-white'
                }`}
              >
                Slide Diapositiva
              </button>
              <button
                onClick={() => setPreviewMode('cards')}
                className={`px-3 py-1.5 rounded-lg text-xs font-black transition-all ${
                  previewMode === 'cards' ? 'bg-purple-600 text-white' : 'text-slate-300 hover:text-white'
                }`}
              >
                5 Columnas
              </button>
              <button
                onClick={() => setPreviewMode('subjects')}
                className={`px-3 py-1.5 rounded-lg text-xs font-black transition-all ${
                  previewMode === 'subjects' ? 'bg-purple-600 text-white' : 'text-slate-300 hover:text-white'
                }`}
              >
                Por Asignaturas
              </button>
            </div>

            {/* Scale buttons */}
            <div className="flex items-center gap-1 bg-slate-800 p-1 rounded-xl">
              {(['normal', 'large', 'xlarge'] as const).map(z => (
                <button
                  key={z}
                  onClick={() => setZoomLevel(z)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all ${
                    zoomLevel === z ? 'bg-white text-slate-900' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  {z === 'normal' ? 'Normal' : z === 'large' ? 'Grande' : 'XL'}
                </button>
              ))}
            </div>

            {onOpenModalPreview && (
              <button
                onClick={() => {
                  setIsFullScreen(false);
                  onOpenModalPreview();
                }}
                className="flex items-center gap-1.5 px-3.5 py-2 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white rounded-xl text-xs font-black transition-all shadow-sm hover:scale-105"
                title="Abrir Modo Diapositivas / Slide"
              >
                <Tv className="w-4 h-4 text-purple-200" />
                <span>Modo Slide</span>
              </button>
            )}

            <button
              onClick={() => window.print()}
              title="Imprimir"
              className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-xl transition-colors"
            >
              <Printer className="w-4 h-4" />
            </button>

            <button
              onClick={handleDownloadPdf}
              disabled={downloadingPdf}
              className="flex items-center gap-1.5 px-3.5 py-2 bg-purple-600 hover:bg-purple-500 text-white rounded-xl text-xs font-black transition-all disabled:opacity-50"
            >
              <FileDown className="w-4 h-4" />
              <span>{downloadingPdf ? 'PDF...' : `PDF (${selectedCourse})`}</span>
            </button>

            {/* Exit Full Screen Button */}
            <button
              onClick={toggleFullScreen}
              className="flex items-center gap-1.5 px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white rounded-xl text-xs font-black transition-all shadow-sm"
              title="Salir de pantalla completa (Esc)"
            >
              <Minimize2 className="w-4 h-4" />
              <span>Salir de Pantalla Completa</span>
            </button>
          </div>
        </div>

        {/* Course Selector Bar in Full Screen */}
        <div className="px-6 py-2.5 bg-slate-900 border-b border-slate-800 flex items-center gap-1.5 overflow-x-auto shrink-0">
          <span className="text-xs font-extrabold text-slate-400 mr-2 uppercase">Curso:</span>
          {COURSES.map(course => {
            const isSelected = course === selectedCourse;
            return (
              <button
                key={course}
                onClick={() => setSelectedCourse(course)}
                className={`px-3.5 py-1 rounded-xl text-xs font-black transition-all shrink-0 ${
                  isSelected
                    ? 'bg-purple-600 text-white shadow-md ring-2 ring-purple-300 scale-105'
                    : 'bg-slate-800 text-slate-300 hover:bg-slate-700 hover:text-white'
                }`}
              >
                {course}
              </button>
            );
          })}
        </div>

        {/* Fullscreen Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 bg-slate-100">
          <div className="w-full max-w-[1700px] mx-auto">
            {renderScheduleContent()}
          </div>
        </div>
      </div>
    );
  }

  // Normal In-Page View (Inside Generator)
  return (
    <div className="bg-white rounded-3xl shadow-sm border border-slate-200 w-full overflow-hidden">
      {/* Top Header of the Generator Preview */}
      <div className="p-5 sm:p-6 bg-gradient-to-r from-purple-950 via-slate-900 to-indigo-950 text-white flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="flex items-center gap-1.5 text-xs font-black uppercase tracking-widest bg-purple-500/25 text-purple-200 px-3 py-1 rounded-full border border-purple-400/30">
              <Eye className="w-4 h-4" />
              Horario Completo — Las 5 Jornadas
            </span>
            <span className={`text-xs px-2.5 py-0.5 rounded-full font-bold ${
              isValid ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' : 'bg-red-500/20 text-red-300'
            }`}>
              {isValid ? '100% Válido · Cero Conflictos' : 'Con observaciones'}
            </span>
          </div>
          <h3 className="text-2xl sm:text-3xl font-black mt-1.5 flex items-center gap-3 tracking-tight">
            <span>{optionName}</span>
            <span className="text-sm font-bold text-purple-200 bg-white/10 px-3 py-1 rounded-xl border border-white/10">
              Grado {selectedCourse}
            </span>
          </h3>
          <p className="text-sm text-purple-200/80 mt-1">
            Visualización completa de Lunes a Viernes con todas las asignaturas, periodos y descansos en paralelo.
          </p>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          {/* THE PROMINENT SLIDE PRESENTATION BUTTON */}
          {onOpenModalPreview && (
            <button
              onClick={onOpenModalPreview}
              className="flex items-center gap-2 px-5 py-3 bg-gradient-to-r from-purple-600 via-indigo-600 to-purple-700 hover:from-purple-500 hover:to-indigo-500 text-white rounded-2xl text-sm font-black transition-all shadow-md hover:scale-105 active:scale-95 ring-2 ring-purple-300/40 cursor-pointer"
              title="Abrir Slide de Pantalla Completa (Presentación con Diapositivas por Curso y 5 Jornadas)"
            >
              <Tv className="w-4 h-4 text-purple-200" />
              <span>Slide Pantalla Completa</span>
            </button>
          )}

          {/* THE PROMINENT FULL SCREEN BUTTON */}
          <button
            onClick={toggleFullScreen}
            className="flex items-center gap-2 px-5 py-3 bg-purple-600 hover:bg-purple-500 text-white rounded-2xl text-sm font-black transition-all shadow-md hover:scale-105 active:scale-95"
            title="Ver el horario de las 5 jornadas en pantalla completa"
          >
            <Maximize2 className="w-4 h-4" />
            <span>Ver en Pantalla Completa (5 Jornadas)</span>
          </button>

          <button
            onClick={handleDownloadPdf}
            disabled={downloadingPdf}
            className="flex items-center gap-2 px-4 py-2.5 bg-white/15 hover:bg-white/25 text-white rounded-xl text-xs font-bold transition-all border border-white/20 shadow-xs disabled:opacity-50"
          >
            <FileDown className="w-4 h-4" />
            <span>{downloadingPdf ? 'PDF...' : `Descargar PDF (${selectedCourse})`}</span>
          </button>

          <button
            onClick={handleDownloadAllPdf}
            disabled={downloadingAllPdf}
            className="flex items-center gap-2 px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-bold transition-all border border-slate-700 disabled:opacity-50"
          >
            <FileDown className="w-4 h-4" />
            <span>{downloadingAllPdf ? 'Generando...' : 'PDF Todos los Cursos'}</span>
          </button>
        </div>
      </div>

      {/* Sub-header: Course Picker & Mode Switcher */}
      <div className="p-4 sm:p-5 bg-slate-50 border-b border-slate-200">
        <div className="flex flex-col gap-3">
          {/* Course Selector */}
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-xs font-extrabold text-slate-600 uppercase tracking-wider mr-1">
              Curso:
            </span>
            {COURSES.map(course => {
              const isSelected = course === selectedCourse;
              return (
                <button
                  key={course}
                  onClick={() => setSelectedCourse(course)}
                  className={`px-3.5 py-1.5 rounded-xl text-xs font-black transition-all ${
                    isSelected
                      ? 'bg-purple-600 text-white shadow-md ring-2 ring-purple-400 scale-105'
                      : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  {course}
                </button>
              );
            })}
          </div>

          {/* Mode & Zoom buttons */}
          <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-slate-200/80">
            <div className="flex items-center gap-1.5 bg-slate-200/80 p-1 rounded-xl">
              <button
                onClick={() => setPreviewMode('panoramic')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-black transition-all ${
                  previewMode === 'panoramic' ? 'bg-white text-purple-700 shadow-xs' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Calendar className="w-4 h-4" />
                <span>Las 5 Jornadas (Lunes a Viernes)</span>
              </button>

              <button
                onClick={() => setPreviewMode('slide')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-black transition-all ${
                  previewMode === 'slide' ? 'bg-white text-purple-700 shadow-xs' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Tv className="w-4 h-4" />
                <span>Slide por Día (Diapositivas)</span>
              </button>

              <button
                onClick={() => setPreviewMode('cards')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-black transition-all ${
                  previewMode === 'cards' ? 'bg-white text-purple-700 shadow-xs' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Layers className="w-4 h-4" />
                <span>5 Columnas Grandes</span>
              </button>

              <button
                onClick={() => setPreviewMode('subjects')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-black transition-all ${
                  previewMode === 'subjects' ? 'bg-white text-purple-700 shadow-xs' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <BookOpen className="w-4 h-4" />
                <span>Por Asignaturas</span>
              </button>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-slate-500 flex items-center gap-1">
                <ZoomIn className="w-3.5 h-3.5 text-purple-600" />
                Tamaño:
              </span>
              {(['normal', 'large', 'xlarge'] as const).map(z => (
                <button
                  key={z}
                  onClick={() => setZoomLevel(z)}
                  className={`px-3 py-1 rounded-lg text-xs font-black transition-all ${
                    zoomLevel === z ? 'bg-purple-100 text-purple-800 border border-purple-300' : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  {z === 'normal' ? 'Normal' : z === 'large' ? 'Grande' : 'Muy Grande (XL)'}
                </button>
              ))}

              <button
                onClick={toggleFullScreen}
                className="ml-2 flex items-center gap-1 px-3 py-1 bg-purple-50 text-purple-700 hover:bg-purple-100 border border-purple-200 rounded-lg text-xs font-black transition-colors"
                title="Ver en pantalla completa"
              >
                <Maximize2 className="w-3.5 h-3.5" />
                <span>Pantalla Completa</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Content Container */}
      <div className="p-4 sm:p-6 bg-slate-100/70">
        {renderScheduleContent()}
      </div>

      {/* Footer Info */}
      <div className="p-4 sm:p-5 bg-white border-t border-slate-200 rounded-b-3xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-slate-500">
        <div className="flex items-center gap-2">
          <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>Horario institucional con las 5 jornadas escolares visibles simultáneamente (sin vista individual por día).</span>
        </div>
        <button
          onClick={toggleFullScreen}
          className="font-extrabold text-purple-700 hover:text-purple-900 hover:underline flex items-center gap-1 self-start sm:self-auto"
        >
          <span>Abrir las 5 jornadas en pantalla completa</span>
          <Maximize2 className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}
