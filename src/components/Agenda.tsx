import React, { useState, useEffect } from 'react';
import { 
  format, 
  addMonths, 
  subMonths, 
  addDays,
  startOfMonth, 
  endOfMonth, 
  startOfWeek, 
  endOfWeek, 
  isSameMonth, 
  isSameDay, 
  eachDayOfInterval,
  parseISO
} from 'date-fns';
import { es } from 'date-fns/locale';
import { ChevronLeft, ChevronRight, Plus, Calendar as CalendarIcon, Trash2, X, AlertCircle, Loader2, Clock, FileDown, FileText, Check, Maximize2, Minimize2 } from 'lucide-react';
import { collection, query, onSnapshot, addDoc, deleteDoc, updateDoc, doc } from 'firebase/firestore';
import { db, ADMIN_EMAIL } from '../firebase';
import { AcademicEvent, EventType } from '../types';
import { User } from 'firebase/auth';
import { getColombianHolidays } from '../utils/colombianHolidays';
import { downloadAgendaPdf } from '../utils/agendaPdfExport';

const eventColors: Record<EventType, string> = {
  exam: 'bg-purple-100 text-purple-700 border-purple-200',
  assignment: 'bg-yellow-100 text-yellow-700 border-yellow-200',
  event: 'bg-indigo-100 text-indigo-700 border-indigo-200',
  holiday: 'bg-red-500 text-white border-red-600'
};

const eventLabels: Record<EventType, string> = {
  exam: 'Examen / Evaluación',
  assignment: 'Entrega / Tarea',
  event: 'Evento Institucional',
  holiday: 'Festivo Nacional / Vacaciones'
};

export function Agenda({ user }: { user: User }) {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [events, setEvents] = useState<AcademicEvent[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Modal state
  const [showModal, setShowModal] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  
  // Form state
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [type, setType] = useState<EventType>('event');
  const [isAllDay, setIsAllDay] = useState(true);
  const [startTime, setStartTime] = useState('08:00');
  const [endTime, setEndTime] = useState('10:00');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editingEventId, setEditingEventId] = useState<string | null>(null);
  const [eventToDelete, setEventToDelete] = useState<string | null>(null);

  // PDF Export State
  const [isDownloadingPdf, setIsDownloadingPdf] = useState(false);
  const [showPdfModal, setShowPdfModal] = useState(false);
  const [pdfScope, setPdfScope] = useState<'all' | 'month'>('all');
  const [pdfIncludeHolidays, setPdfIncludeHolidays] = useState(true);

  // View mode: fit complete month on screen vs expanded scrollable
  const [fitScreen, setFitScreen] = useState(true);

  const isAdmin = user.email === ADMIN_EMAIL;

  const handleDownloadPdf = async () => {
    setIsDownloadingPdf(true);
    try {
      await downloadAgendaPdf(events, {
        includeHolidays: pdfIncludeHolidays,
        selectedYear: currentDate.getFullYear(),
        monthFilter: pdfScope === 'month' ? currentDate.getMonth() : null
      });
      setShowPdfModal(false);
    } catch (error) {
      console.error("Error generating PDF:", error);
      alert("Ocurrió un error al generar el PDF de la agenda.");
    } finally {
      setIsDownloadingPdf(false);
    }
  };

  useEffect(() => {
    const q = query(collection(db, 'events'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const eventsData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as AcademicEvent[];
      setEvents(eventsData);
      setLoading(false);
    }, (error) => {
      console.error("Error fetching events:", error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const nextMonth = () => setCurrentDate(addMonths(currentDate, 1));
  const prevMonth = () => setCurrentDate(subMonths(currentDate, 1));

  const resetForm = () => {
    setTitle('');
    setDescription('');
    setType('event');
    setIsAllDay(true);
    setStartTime('08:00');
    setEndTime('10:00');
    setEditingEventId(null);
  };

  const onDateClick = (day: Date) => {
    if (!isAdmin) return;
    setSelectedDate(day);
    resetForm();
    setShowModal(true);
  };

  const onEventClick = (e: React.MouseEvent, event: AcademicEvent) => {
    e.stopPropagation();
    if (!isAdmin || event.type === 'holiday') return;
    
    setSelectedDate(parseISO(event.date));
    setTitle(event.title);
    setDescription(event.description || '');
    setType(event.type);
    setIsAllDay(event.isAllDay ?? true);
    if (event.startTime) setStartTime(event.startTime);
    if (event.endTime) setEndTime(event.endTime);
    setEditingEventId(event.id);
    setShowModal(true);
  };

  const handleSaveEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedDate || !title.trim()) return;

    setIsSubmitting(true);
    try {
      const dateStr = format(selectedDate, 'yyyy-MM-dd');
      const eventData: Partial<AcademicEvent> = {
        title: title.trim(),
        description: description.trim(),
        date: dateStr,
        type,
        isAllDay,
      };

      if (!isAllDay) {
        eventData.startTime = startTime;
        eventData.endTime = endTime;
      } else {
        eventData.startTime = '';
        eventData.endTime = '';
      }

      if (editingEventId) {
        await updateDoc(doc(db, 'events', editingEventId), eventData);
      } else {
        eventData.createdBy = user.email || '';
        eventData.createdAt = Date.now();
        await addDoc(collection(db, 'events'), eventData);
      }
      
      setShowModal(false);
      resetForm();
    } catch (error) {
      console.error("Error saving event:", error);
      alert("Error al guardar el evento");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteEvent = async (e: React.MouseEvent | null, eventId: string) => {
    if (e) e.stopPropagation();
    if (!isAdmin) return;
    
    setEventToDelete(eventId);
  };

  const confirmDelete = async () => {
    if (!eventToDelete || !isAdmin) return;
    
    try {
      await deleteDoc(doc(db, 'events', eventToDelete));
      setShowModal(false);
      resetForm();
      setEventToDelete(null);
    } catch (error) {
      console.error("Error deleting event:", error);
    }
  };

  const renderHeader = () => {
    return (
      <div className="flex flex-wrap items-center justify-between gap-3 mb-3 shrink-0">
        <div className="flex items-center gap-3">
          <h2 className="text-xl sm:text-2xl font-bold text-slate-800 flex items-center gap-2 capitalize">
            <CalendarIcon className="w-6 h-6 text-indigo-600 shrink-0" />
            <span>{format(currentDate, 'MMMM yyyy', { locale: es })}</span>
          </h2>

          <div className="flex items-center gap-1 bg-slate-100 border border-slate-200 rounded-lg p-0.5 shadow-xs">
            <button 
              onClick={prevMonth} 
              className="p-1.5 hover:bg-white hover:text-indigo-600 rounded-md transition-all text-slate-600" 
              title="Mes anterior"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button 
              onClick={() => setCurrentDate(new Date())} 
              className="px-2.5 py-1 text-xs font-semibold text-slate-700 hover:text-indigo-600 hover:bg-white rounded-md transition-all" 
              title="Ir a hoy"
            >
              Hoy
            </button>
            <button 
              onClick={nextMonth} 
              className="p-1.5 hover:bg-white hover:text-indigo-600 rounded-md transition-all text-slate-600" 
              title="Mes siguiente"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Legend and Actions */}
        <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
          {/* Categories Legend inline */}
          <div className="hidden xl:flex items-center gap-3 bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5">
            {Object.entries(eventLabels).map(([typeKey, label]) => (
              <div key={typeKey} className="flex items-center gap-1.5 text-xs font-medium text-slate-600">
                <span className={`w-2.5 h-2.5 rounded-full border ${eventColors[typeKey as EventType]}`}></span>
                <span>{label}</span>
              </div>
            ))}
          </div>

          {/* Toggle Fit to Screen vs Expanded */}
          <button
            onClick={() => setFitScreen(!fitScreen)}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold border transition-all ${
              fitScreen 
                ? 'bg-indigo-50 border-indigo-200 text-indigo-700 hover:bg-indigo-100' 
                : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
            }`}
            title={fitScreen ? 'Modo Ajustado: Todo el mes cabe en la pantalla sin desplazarse' : 'Modo Expandido con desplazamiento'}
          >
            {fitScreen ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
            <span className="hidden sm:inline">{fitScreen ? 'Ajustado a pantalla' : 'Vista expandida'}</span>
          </button>

          {/* Download PDF button */}
          <button
            onClick={() => setShowPdfModal(true)}
            disabled={isDownloadingPdf}
            className="flex items-center gap-2 px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-semibold shadow-xs transition-all hover:shadow active:scale-95 disabled:opacity-50"
            title="Descargar Agenda Oficial en PDF con Logo y orden cronológico"
          >
            {isDownloadingPdf ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span>Generando...</span>
              </>
            ) : (
              <>
                <FileDown className="w-3.5 h-3.5" />
                <span>Descargar PDF</span>
              </>
            )}
          </button>
        </div>
      </div>
    );
  };

  const renderDays = () => {
    const days = [];
    const startDate = startOfWeek(currentDate, { weekStartsOn: 1 }); // Start on Monday

    for (let i = 0; i < 7; i++) {
      const dayDate = addDays(startDate, i);
      const dayName = format(dayDate, 'EEEE', { locale: es });
      const shortName = dayName.slice(0, 3).toUpperCase();
      const isWeekend = i >= 5;

      days.push(
        <div 
          key={i} 
          className={`text-center font-bold text-xs py-2 uppercase tracking-wider border-r last:border-r-0 border-slate-200 ${
            isWeekend ? 'bg-slate-100/70 text-slate-500' : 'bg-slate-50 text-slate-700'
          }`}
        >
          <span className="hidden sm:inline capitalize">{dayName}</span>
          <span className="sm:hidden">{shortName}</span>
        </div>
      );
    }
    return (
      <div className="grid grid-cols-7 border border-slate-200 rounded-t-xl overflow-hidden shrink-0 bg-slate-50">
        {days}
      </div>
    );
  };

  const renderCells = () => {
    const monthStart = startOfMonth(currentDate);
    const monthEnd = endOfMonth(monthStart);
    const startDate = startOfWeek(monthStart, { weekStartsOn: 1 });
    const endDate = endOfWeek(monthEnd, { weekStartsOn: 1 });

    const dateFormat = 'd';
    const interval = eachDayOfInterval({ start: startDate, end: endDate });
    const totalWeeks = Math.max(1, Math.ceil(interval.length / 7)); // usually 5 or 6 weeks
    const currentYear = currentDate.getFullYear();
    const holidays = getColombianHolidays(currentYear);

    const cellElements = interval.map((currentDay) => {
      const formattedDate = format(currentDay, dateFormat);
      const isCurrentMonth = isSameMonth(currentDay, monthStart);
      const dayDateStr = format(currentDay, 'yyyy-MM-dd');
      
      const dayEvents = events.filter(e => e.date === dayDateStr);
      
      const holidayObj = holidays.find(h => h.date === dayDateStr);
      if (holidayObj) {
        dayEvents.unshift({
          id: `holiday-${holidayObj.date}`,
          title: holidayObj.name,
          description: 'Festivo Nacional de Colombia',
          date: holidayObj.date,
          type: 'holiday',
          isAllDay: true,
          createdBy: 'system',
          createdAt: 0
        } as AcademicEvent);
      }

      const isToday = isSameDay(currentDay, new Date());

      return (
        <div
          key={currentDay.toString()}
          onClick={() => onDateClick(currentDay)}
          className={`group flex flex-col p-1 sm:p-1.5 transition-colors overflow-hidden ${
            fitScreen ? 'h-full min-h-0' : 'min-h-[115px]'
          } ${
            !isCurrentMonth 
              ? 'bg-slate-50/70 text-slate-400' 
              : 'bg-white text-slate-700'
          } ${isAdmin ? 'cursor-pointer hover:bg-indigo-50/40' : ''} ${
            isToday ? 'ring-2 ring-indigo-500 ring-inset bg-indigo-50/20' : ''
          }`}
        >
          <div className="flex justify-between items-center mb-1 shrink-0">
            <span className={`inline-flex items-center justify-center w-5 h-5 sm:w-6 sm:h-6 text-xs font-semibold rounded-full ${
              isToday 
                ? 'bg-indigo-600 text-white shadow-xs font-bold' 
                : !isCurrentMonth 
                  ? 'text-slate-400' 
                  : 'text-slate-700'
            }`}>
              {formattedDate}
            </span>

            <div className="flex items-center gap-1">
              {holidayObj && (
                <span className="hidden xl:inline text-[9px] font-bold text-red-600 bg-red-50 border border-red-200 px-1 py-0.2 rounded truncate max-w-[70px]">
                  Festivo
                </span>
              )}
              {isAdmin && isCurrentMonth && (
                <span className="opacity-0 group-hover:opacity-100 text-indigo-500 hover:text-indigo-700 transition-opacity">
                  <Plus className="w-3.5 h-3.5" />
                </span>
              )}
            </div>
          </div>
          
          <div className="flex-1 min-h-0 overflow-y-auto space-y-1 no-scrollbar pr-0.5">
            {dayEvents.map(event => (
              <div 
                key={event.id} 
                onClick={(e) => onEventClick(e, event)}
                className={`text-[10px] sm:text-[11px] leading-tight px-1.5 py-0.5 sm:py-1 rounded border flex flex-col items-start ${
                  event.type !== 'holiday' && isAdmin ? 'cursor-pointer hover:ring-1 hover:ring-indigo-300' : ''
                } group/ev relative ${eventColors[event.type]}`}
                title={event.description || event.title}
              >
                <div className="flex w-full justify-between items-center">
                  <span className="truncate pr-3 font-semibold">{event.title}</span>
                  {isAdmin && event.type !== 'holiday' && (
                    <button 
                      onClick={(e) => handleDeleteEvent(e, event.id)}
                      className="opacity-0 group-hover/ev:opacity-100 text-slate-400 hover:text-red-600 transition-colors p-0.5"
                      title="Eliminar evento"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  )}
                </div>
                {!event.isAllDay && event.startTime && (
                  <div className="flex items-center gap-1 mt-0.5 opacity-80 text-[9px]">
                    <Clock className="w-2.5 h-2.5 shrink-0" />
                    <span className="truncate">{event.startTime} {event.endTime ? `- ${event.endTime}` : ''}</span>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      );
    });

    if (fitScreen) {
      return (
        <div 
          className="flex-1 min-h-0 grid grid-cols-7 border-x border-b border-slate-200 rounded-b-xl overflow-hidden bg-slate-200 gap-[1px]"
          style={{ gridTemplateRows: `repeat(${totalWeeks}, minmax(0, 1fr))` }}
        >
          {cellElements}
        </div>
      );
    }

    return (
      <div className="flex-1 min-h-0 overflow-y-auto border-x border-b border-slate-200 rounded-b-xl bg-slate-200">
        <div className="grid grid-cols-7 gap-[1px]">
          {cellElements}
        </div>
      </div>
    );
  };

  if (loading) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center h-full">
        <Loader2 className="w-10 h-10 animate-spin text-indigo-600 mb-4" />
        <p className="text-slate-500 font-medium">Cargando agenda académica...</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full min-h-0 bg-white p-3 sm:p-4 rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
      {/* Small categories bar on smaller screens */}
      <div className="xl:hidden flex items-center gap-3 overflow-x-auto pb-2 mb-2 no-scrollbar shrink-0">
        {Object.entries(eventLabels).map(([typeKey, label]) => (
          <div key={typeKey} className="flex items-center gap-1.5 text-[11px] font-medium text-slate-600 shrink-0">
            <span className={`w-2 h-2 rounded-full border ${eventColors[typeKey as EventType]}`}></span>
            <span>{label}</span>
          </div>
        ))}
      </div>

      {renderHeader()}
      <div className="flex-1 min-h-0 flex flex-col">
        {renderDays()}
        {renderCells()}
      </div>

      {/* Add Event Modal */}
      {showModal && selectedDate && isAdmin && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-xl overflow-hidden flex flex-col">
            <div className="px-6 py-4 border-b border-slate-200 flex justify-between items-center bg-slate-50">
              <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <CalendarIcon className="w-5 h-5 text-indigo-500" />
                {editingEventId ? 'Editar Evento' : 'Nuevo Evento'}
              </h3>
              <button onClick={() => { setShowModal(false); resetForm(); }} className="text-slate-400 hover:text-slate-600 transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <form onSubmit={handleSaveEvent} className="p-6 flex flex-col gap-5">
              <div className="bg-indigo-50 text-indigo-700 px-4 py-3 rounded-xl text-sm font-medium flex items-center gap-2">
                <CalendarIcon className="w-4 h-4" />
                Fecha: {format(selectedDate, "d 'de' MMMM, yyyy", { locale: es })}
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Título del evento</label>
                <input
                  type="text"
                  required
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full px-4 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all"
                  placeholder="Ej: Examen Final Matemáticas"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Tipo de Evento</label>
                <select
                  value={type}
                  onChange={(e) => setType(e.target.value as EventType)}
                  className="w-full px-4 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all bg-white"
                >
                  <option value="exam">Examen / Evaluación</option>
                  <option value="assignment">Entrega / Tarea</option>
                  <option value="event">Evento Institucional</option>
                  <option value="holiday">Festivo Nacional / Vacaciones</option>
                </select>
              </div>

              <div className="flex flex-col gap-3 p-3 bg-slate-50 border border-slate-200 rounded-xl">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={isAllDay}
                    onChange={(e) => setIsAllDay(e.target.checked)}
                    className="w-4 h-4 text-indigo-600 border-slate-300 rounded focus:ring-indigo-500"
                  />
                  <span className="text-sm font-medium text-slate-700">Todo el día</span>
                </label>

                {!isAllDay && (
                  <div className="flex items-center gap-4 pt-2 border-t border-slate-200">
                    <div className="flex-1">
                      <label className="block text-xs font-medium text-slate-500 mb-1">Hora Inicio</label>
                      <input
                        type="time"
                        value={startTime}
                        onChange={(e) => setStartTime(e.target.value)}
                        className="w-full px-3 py-1.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none text-sm"
                        required={!isAllDay}
                      />
                    </div>
                    <div className="flex-1">
                      <label className="block text-xs font-medium text-slate-500 mb-1">Hora Fin (Opcional)</label>
                      <input
                        type="time"
                        value={endTime}
                        onChange={(e) => setEndTime(e.target.value)}
                        className="w-full px-3 py-1.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none text-sm"
                      />
                    </div>
                  </div>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Descripción (Opcional)</label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={3}
                  className="w-full px-4 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all resize-none"
                  placeholder="Detalles adicionales..."
                />
              </div>

              <div className="pt-2 flex gap-3">
                {editingEventId && (
                  <button
                    type="button"
                    onClick={(e) => handleDeleteEvent(e, editingEventId)}
                    className="px-4 py-2 text-red-600 bg-red-50 font-medium rounded-xl hover:bg-red-100 transition-colors flex items-center justify-center"
                    title="Eliminar evento"
                  >
                    <Trash2 className="w-5 h-5" />
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => { setShowModal(false); resetForm(); }}
                  className="flex-1 px-4 py-2 text-slate-700 bg-slate-100 font-medium rounded-xl hover:bg-slate-200 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex-1 px-4 py-2 bg-indigo-600 text-white font-medium rounded-xl hover:bg-indigo-700 transition-colors shadow-sm shadow-indigo-200 flex items-center justify-center gap-2 disabled:opacity-70"
                >
                  {isSubmitting ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    <>
                      <Plus className={`w-5 h-5 ${editingEventId ? 'hidden' : ''}`} />
                      {editingEventId ? 'Actualizar' : 'Guardar'}
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {eventToDelete && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl w-full max-w-sm shadow-xl overflow-hidden flex flex-col p-6 text-center">
            <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <AlertCircle className="w-8 h-8 text-red-600" />
            </div>
            <h3 className="text-xl font-bold text-slate-900 mb-2">¿Eliminar evento?</h3>
            <p className="text-slate-500 mb-6">
              Esta acción no se puede deshacer. El evento será eliminado permanentemente de la agenda.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setEventToDelete(null)}
                className="flex-1 px-4 py-2 text-slate-700 bg-slate-100 font-medium rounded-xl hover:bg-slate-200 transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={confirmDelete}
                className="flex-1 px-4 py-2 bg-red-600 text-white font-medium rounded-xl hover:bg-red-700 transition-colors shadow-sm shadow-red-200"
              >
                Eliminar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* PDF Export Modal */}
      {showPdfModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fadeIn">
          <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden flex flex-col border border-slate-200">
            {/* Modal Header */}
            <div className="px-6 py-5 border-b border-slate-200 flex justify-between items-center bg-gradient-to-r from-slate-900 to-indigo-950 text-white">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-white rounded-xl p-1 shadow-sm flex items-center justify-center shrink-0">
                  <img src="/JUANI.png" alt="Logo Institución" className="w-full h-full object-contain" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white tracking-tight">
                    Descargar Agenda en PDF
                  </h3>
                  <p className="text-xs text-indigo-200">
                    I.E. Juan Pablo I • Documento Oficial Formateado
                  </p>
                </div>
              </div>
              <button 
                onClick={() => setShowPdfModal(false)}
                className="text-slate-300 hover:text-white p-1 rounded-lg hover:bg-white/10 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-5">
              {/* Scope Selection */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">
                  Alcance del Documento
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div
                    onClick={() => setPdfScope('all')}
                    className={`p-3.5 rounded-xl border-2 cursor-pointer transition-all ${
                      pdfScope === 'all'
                        ? 'border-indigo-600 bg-indigo-50/50 text-indigo-900 shadow-sm'
                        : 'border-slate-200 hover:border-slate-300 bg-white text-slate-700'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-bold text-sm">Año Completo</span>
                      <div className={`w-4 h-4 rounded-full border flex items-center justify-center ${
                        pdfScope === 'all' ? 'border-indigo-600 bg-indigo-600 text-white' : 'border-slate-300'
                      }`}>
                        {pdfScope === 'all' && <Check className="w-3 h-3 stroke-[3]" />}
                      </div>
                    </div>
                    <p className="text-xs text-slate-500">
                      Todos los eventos registrados para el año {currentDate.getFullYear()} en orden cronológico.
                    </p>
                  </div>

                  <div
                    onClick={() => setPdfScope('month')}
                    className={`p-3.5 rounded-xl border-2 cursor-pointer transition-all ${
                      pdfScope === 'month'
                        ? 'border-indigo-600 bg-indigo-50/50 text-indigo-900 shadow-sm'
                        : 'border-slate-200 hover:border-slate-300 bg-white text-slate-700'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-bold text-sm capitalize">Mes Visible</span>
                      <div className={`w-4 h-4 rounded-full border flex items-center justify-center ${
                        pdfScope === 'month' ? 'border-indigo-600 bg-indigo-600 text-white' : 'border-slate-300'
                      }`}>
                        {pdfScope === 'month' && <Check className="w-3 h-3 stroke-[3]" />}
                      </div>
                    </div>
                    <p className="text-xs text-slate-500 capitalize">
                      Únicamente eventos de {format(currentDate, 'MMMM yyyy', { locale: es })}.
                    </p>
                  </div>
                </div>
              </div>

              {/* Options */}
              <div className="pt-2 border-t border-slate-100">
                <label className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl border border-slate-200 cursor-pointer hover:bg-slate-100/70 transition-colors">
                  <input
                    type="checkbox"
                    checked={pdfIncludeHolidays}
                    onChange={(e) => setPdfIncludeHolidays(e.target.checked)}
                    className="w-4 h-4 text-indigo-600 rounded border-slate-300 focus:ring-indigo-500"
                  />
                  <div>
                    <p className="text-xs font-semibold text-slate-800">
                      Incluir Festivos Nacionales y Vacaciones
                    </p>
                    <p className="text-[11px] text-slate-500">
                      Integra los festivos oficiales de Colombia según la Ley Emiliani y Pascua.
                    </p>
                  </div>
                </label>
              </div>

              {/* Document features note */}
              <div className="p-3 bg-indigo-50/60 rounded-xl border border-indigo-100 flex items-start gap-2.5 text-xs text-indigo-900">
                <FileText className="w-4 h-4 text-indigo-600 shrink-0 mt-0.5" />
                <p className="leading-relaxed">
                  El PDF se genera en formato A4 institucional con membrete, logo oficial en alta resolución, tabla cronológica por fecha y horario, insignias por tipo de actividad y numeración de página oficial.
                </p>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setShowPdfModal(false)}
                disabled={isDownloadingPdf}
                className="px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-800 hover:bg-slate-200/60 rounded-lg transition-colors"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleDownloadPdf}
                disabled={isDownloadingPdf}
                className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold rounded-lg shadow-sm transition-all hover:shadow active:scale-95 disabled:opacity-50"
              >
                {isDownloadingPdf ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Creando Documento...</span>
                  </>
                ) : (
                  <>
                    <FileDown className="w-4 h-4" />
                    <span>Generar y Descargar PDF</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
