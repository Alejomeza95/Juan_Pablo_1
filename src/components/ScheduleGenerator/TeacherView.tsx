import React, { useState, useMemo } from 'react';
import { EngineSlot } from '../../utils/scheduleEngine';
import { TEACHERS } from '../../data/generatorData';
import { getSubjectStyle } from '../../utils/subjectStyles';
import { downloadTeacherSchedulePdf } from '../../utils/schedulePdfExport';
import { Clock, User, Coffee, Printer, CheckCircle, BookOpen, Layers, FileDown } from 'lucide-react';

export function TeacherView({ schedule }: { schedule: EngineSlot[] }) {
  const [selectedTeacherId, setSelectedTeacherId] = useState<string>(TEACHERS[0].id);
  const [downloadingPdf, setDownloadingPdf] = useState(false);

  if (!schedule || schedule.length === 0) {
    return (
      <div className="p-8 text-center bg-white rounded-2xl border border-slate-200 text-slate-500">
        No hay horario generado. Genera uno primero en la pestaña de Generar.
      </div>
    );
  }

  const selectedTeacher = TEACHERS.find(t => t.id === selectedTeacherId) || TEACHERS[0];
  const teacherSlots = useMemo(() => schedule.filter(s => s.teacherId === selectedTeacherId), [schedule, selectedTeacherId]);

  const days = [1, 2, 3, 4, 5];
  // Periods: 1, 2, 3, 4 (Descanso), 5, 6, 7, 8
  const periods = [1, 2, 3, 4, 5, 6, 7, 8];

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

  // Group workload summary for this teacher
  const workloadByGroup = useMemo(() => {
    const map = new Map<string, { subject: string; count: number }>();
    teacherSlots.forEach(s => {
      const key = `${s.groupId}__${s.subject}`;
      if (!map.has(key)) {
        map.set(key, { subject: s.subject, count: 0 });
      }
      map.get(key)!.count += 1;
    });

    return Array.from(map.entries()).map(([key, val]) => {
      const [groupId] = key.split('__');
      return {
        groupId,
        subject: val.subject,
        hours: val.count
      };
    }).sort((a, b) => a.groupId.localeCompare(b.groupId));
  }, [teacherSlots]);

  const uniqueGroups = useMemo(() => {
    return Array.from(new Set(teacherSlots.map(s => s.groupId))).sort();
  }, [teacherSlots]);

  const handlePrint = () => {
    window.print();
  };

  const handleDownloadPdf = async () => {
    setDownloadingPdf(true);
    try {
      await downloadTeacherSchedulePdf(selectedTeacherId, selectedTeacher.name, schedule);
    } catch (err) {
      console.error(err);
      alert('Error al generar PDF del docente.');
    } finally {
      setDownloadingPdf(false);
    }
  };

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 flex flex-col h-full overflow-hidden">
      {/* Top Bar with Teacher Info & Workload Banner */}
      <div className="p-4 sm:p-5 border-b border-slate-200 bg-slate-50/70">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-purple-600 to-indigo-600 text-white flex items-center justify-center font-black text-lg shadow-sm">
              {selectedTeacher.name.charAt(0)}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold uppercase tracking-wider text-purple-700 bg-purple-100 px-2.5 py-0.5 rounded-full border border-purple-200">
                  Horario Docente Individual
                </span>
                <span className="text-xs text-slate-500">
                  {teacherSlots.length} horas lectivas asignadas
                </span>
              </div>
              <h3 className="text-xl font-bold text-slate-900 mt-0.5">{selectedTeacher.name}</h3>
            </div>
          </div>

          {/* Teacher Selector Dropdown & Actions */}
          <div className="flex items-center gap-3 flex-wrap">
            <div className="flex items-center gap-2">
              <label className="text-xs font-bold text-slate-600">Docente:</label>
              <select
                value={selectedTeacherId}
                onChange={(e) => setSelectedTeacherId(e.target.value)}
                className="px-3.5 py-2 bg-white border border-slate-300 rounded-xl font-bold text-xs text-slate-800 focus:ring-2 focus:ring-purple-500 shadow-2xs outline-none"
              >
                {TEACHERS.map(t => {
                  const count = schedule.filter(s => s.teacherId === t.id).length;
                  return (
                    <option key={t.id} value={t.id}>
                      {t.name} ({count}h)
                    </option>
                  );
                })}
              </select>
            </div>

            <button
              onClick={handleDownloadPdf}
              disabled={downloadingPdf}
              title="Descargar horario del docente en PDF"
              className="flex items-center gap-1.5 px-3.5 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs font-bold transition-all shadow-xs disabled:opacity-50"
            >
              <FileDown className="w-3.5 h-3.5" />
              <span>{downloadingPdf ? 'Generando...' : 'Descargar PDF'}</span>
            </button>

            <button
              onClick={handlePrint}
              title="Imprimir horario del docente"
              className="flex items-center gap-1.5 px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300 rounded-xl text-xs font-semibold transition-colors"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Imprimir</span>
            </button>
          </div>
        </div>

        {/* Quick Teacher Tags by Subject Area */}
        <div className="mt-3 pt-3 border-t border-slate-200/80 flex items-center gap-2 overflow-x-auto py-1 text-xs">
          <span className="text-slate-500 font-semibold text-[11px] shrink-0">Docentes rápidos:</span>
          {TEACHERS.slice(0, 10).map(t => {
            const isSelected = t.id === selectedTeacherId;
            return (
              <button
                key={t.id}
                onClick={() => setSelectedTeacherId(t.id)}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold shrink-0 transition-all border ${
                  isSelected
                    ? 'bg-purple-600 text-white border-purple-600 shadow-2xs'
                    : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                }`}
              >
                {t.name.split(' ')[0]}
              </button>
            );
          })}
        </div>
      </div>

      {/* Main Timetable Grid */}
      <div className="p-4 sm:p-6 overflow-x-auto flex-1">
        <table className="w-full min-w-[760px] text-left border-collapse table-fixed">
          <thead>
            <tr>
              <th className="p-3 bg-slate-100 border border-slate-200 w-36 text-center text-xs font-bold text-slate-700 rounded-tl-xl">
                Hora / Periodo
              </th>
              {days.map(d => (
                <th key={d} className={`p-3 bg-slate-100 border border-slate-200 text-center text-sm font-bold text-slate-800 ${d === 5 ? 'rounded-tr-xl' : ''}`}>
                  <div className="flex flex-col items-center">
                    <span className="font-extrabold">
                      {d === 1 && 'Lunes'}
                      {d === 2 && 'Martes'}
                      {d === 3 && 'Miércoles'}
                      {d === 4 && 'Jueves'}
                      {d === 5 && 'Viernes'}
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

              // Break row (Descanso institucional)
              if (isBreak) {
                return (
                  <tr key={p} className="bg-amber-50/80">
                    <td className="p-3 border border-amber-200 text-center font-bold text-xs text-amber-900 bg-amber-100/60">
                      <div className="flex items-center justify-center gap-1.5 text-amber-800">
                        <Coffee className="w-4 h-4 text-amber-700" />
                        <span>Descanso</span>
                      </div>
                      <div className="text-[10px] font-normal text-amber-700 mt-0.5">{pInfo.time}</div>
                    </td>
                    <td colSpan={5} className="p-3 border border-amber-200 text-center text-xs font-semibold text-amber-800 tracking-wide bg-gradient-to-r from-amber-50/80 via-amber-100/60 to-amber-50/80">
                      <div className="flex items-center justify-center gap-2">
                        <Coffee className="w-4 h-4 text-amber-600" />
                        <span>Descanso Institucional Docente (30 min)</span>
                      </div>
                    </td>
                  </tr>
                );
              }

              return (
                <tr key={p} className="hover:bg-slate-50/50 transition-colors">
                  {/* Row Header */}
                  <td className="p-2.5 border border-slate-200 text-center font-medium bg-slate-50/90 text-slate-700">
                    <span className="font-extrabold text-xs text-slate-800 block">{pInfo.name}</span>
                    <span className="text-[10px] font-semibold text-slate-500 flex items-center justify-center gap-1 mt-0.5">
                      <Clock className="w-3 h-3 text-slate-400" />
                      {pInfo.time}
                    </span>
                  </td>

                  {/* Day Columns */}
                  {days.map(d => {
                    const slot = teacherSlots.find(s => s.day === d && s.period === p);

                    if (!slot) {
                      return (
                        <td key={d} className="p-2.5 border border-slate-200 text-center bg-slate-50/20">
                          <span className="text-slate-400 text-xs font-medium italic">Libre</span>
                        </td>
                      );
                    }

                    const style = getSubjectStyle(slot.subject);

                    return (
                      <td key={d} className="p-2 border border-slate-200 align-top">
                        <div
                          className={`h-full min-h-[72px] p-2.5 rounded-xl border border-l-4 transition-all flex flex-col justify-between shadow-2xs hover:shadow-xs ${
                            style.bg
                          } ${style.border} ${style.borderAccent}`}
                        >
                          <div>
                            <div className="flex items-start justify-between gap-1">
                              <span className={`font-black text-xs leading-snug line-clamp-1 ${style.text}`}>
                                {slot.subject}
                              </span>
                              <span className="text-[10px] font-black px-2 py-0.5 rounded-md bg-purple-700 text-white shadow-2xs">
                                {slot.groupId}
                              </span>
                            </div>
                          </div>

                          <div className="flex items-center justify-between mt-2 pt-1 border-t border-black/5 text-[10px] text-slate-600">
                            <span className="font-semibold">{style.category}</span>
                            <span className="font-medium text-slate-500">Salón {slot.groupId}</span>
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

      {/* Teacher Workload Summary Footer */}
      <div className="p-4 sm:p-5 border-t border-slate-200 bg-slate-50">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Layers className="w-4 h-4 text-purple-600" />
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700">
              Distribución de Carga Académica ({workloadByGroup.length} asignaciones en {uniqueGroups.length} grupos)
            </h4>
          </div>
          <span className="text-xs text-purple-700 font-bold bg-purple-100 px-2.5 py-0.5 rounded-full border border-purple-200">
            Total: {teacherSlots.length} horas / semana
          </span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2.5">
          {workloadByGroup.map(item => {
            const style = getSubjectStyle(item.subject);
            return (
              <div
                key={`${item.groupId}-${item.subject}`}
                className="p-2.5 bg-white rounded-xl border border-slate-200 shadow-2xs"
              >
                <div className="flex items-center justify-between gap-1 mb-1">
                  <span className="font-black text-xs px-1.5 py-0.5 rounded bg-purple-100 text-purple-800">
                    {item.groupId}
                  </span>
                  <span className="font-black text-xs text-slate-800">
                    {item.hours}h
                  </span>
                </div>
                <div className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-700 truncate">
                  <span className={`w-2 h-2 rounded-full shrink-0 ${style.dot}`} />
                  <span className="truncate">{item.subject}</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
