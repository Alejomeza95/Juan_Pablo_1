import React, { useState, useEffect, useMemo } from 'react';
import { User } from 'firebase/auth';
import { doc, onSnapshot, setDoc } from 'firebase/firestore';
import { db, ADMIN_EMAIL } from '../firebase';
import { ScheduleBlock, COURSES, generateDefaultSchedule } from '../data/schedules';
import { Loader2, Save, Clock, Edit2, AlertCircle, Tv, Maximize2 } from 'lucide-react';
import { SchedulePreviewModal } from './ScheduleGenerator/SchedulePreviewModal';
import { EngineSlot } from '../utils/scheduleEngine';

export function Schedules({ user }: { user: User }) {
  const [selectedCourse, setSelectedCourse] = useState<string>('6A');
  const [schedule, setSchedule] = useState<ScheduleBlock[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [coursesList, setCoursesList] = useState<string[]>(COURSES);
  const [showManageCourses, setShowManageCourses] = useState(false);
  const [newCourseName, setNewCourseName] = useState('');
  const [showSlideModal, setShowSlideModal] = useState(false);
  
  // Edit mode state
  const [editingCell, setEditingCell] = useState<string | null>(null); // block id
  const [editSubject, setEditSubject] = useState('');
  const [editStart, setEditStart] = useState('');
  const [editEnd, setEditEnd] = useState('');

  const isAdmin = user.email === ADMIN_EMAIL;

  // Prepare full slots for all courses for the Fullscreen Slide Presentation
  const allCoursesSlots = useMemo(() => {
    const slots: EngineSlot[] = [];
    coursesList.forEach(courseName => {
      const blocks = (courseName === selectedCourse && schedule.length > 0)
        ? schedule
        : generateDefaultSchedule(courseName);

      blocks.forEach(b => {
        if (!b.isBreak && b.subject && b.subject.trim() !== '' && b.subject !== 'Descanso') {
          slots.push({
            groupId: courseName,
            day: b.day,
            period: b.period,
            subject: b.subject,
            teacherId: 'T1'
          });
        }
      });
    });
    return slots;
  }, [coursesList, selectedCourse, schedule]);

  useEffect(() => {
    const metaRef = doc(db, 'schedules', '_metadata_');
    const unsubMeta = onSnapshot(metaRef, (docSnap) => {
      if (docSnap.exists() && docSnap.data().courses) {
        setCoursesList(docSnap.data().courses);
      }
    }, (err) => {
      console.warn("No se pudo cargar metadata de horarios desde Firestore:", err);
    });
    return () => unsubMeta();
  }, []);

  useEffect(() => {
    if (!selectedCourse) return;
    setLoading(true);
    const docRef = doc(db, 'schedules', selectedCourse);
    
    const unsubscribe = onSnapshot(docRef, (docSnap) => {
      if (docSnap.exists()) {
        setSchedule(docSnap.data().blocks as ScheduleBlock[]);
      } else {
        // Load default if not exists in DB
        setSchedule(generateDefaultSchedule(selectedCourse));
      }
      setLoading(false);
    }, (error) => {
      console.error("Error fetching schedule:", error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [selectedCourse]);

  const handleAddCourse = async () => {
    if (!newCourseName.trim()) return;
    const newCourses = [...coursesList, newCourseName.trim()];
    try {
      await setDoc(doc(db, 'schedules', '_metadata_'), { courses: newCourses }, { merge: true });
      setNewCourseName('');
    } catch(e) {
      alert("Error agregando curso");
    }
  };

  const handleDeleteCourse = async (course: string) => {
    if (!confirm(`¿Seguro que quieres eliminar el curso ${course}? Se perderán sus horarios.`)) return;
    const newCourses = coursesList.filter(c => c !== course);
    try {
      await setDoc(doc(db, 'schedules', '_metadata_'), { courses: newCourses }, { merge: true });
      if (selectedCourse === course) setSelectedCourse(newCourses[0] || '');
    } catch(e) {
      alert("Error eliminando curso");
    }
  };

  const handleCellClick = (block: ScheduleBlock) => {
    if (!isAdmin) return;
    setEditingCell(block.id);
    setEditSubject(block.subject);
    setEditStart(block.start);
    setEditEnd(block.end);
  };

  const handleSaveCell = () => {
    if (!editingCell) return;
    
    const updatedSchedule = schedule.map(block => {
      if (block.id === editingCell) {
        return {
          ...block,
          subject: editSubject,
          start: editStart,
          end: editEnd
        };
      }
      return block;
    });

    setSchedule(updatedSchedule);
    setEditingCell(null);
    
    // We auto-save to firestore when they click outside/save
    saveToFirestore(updatedSchedule);
  };

  const handleDeleteCell = () => {
    if (!editingCell) return;
    const updatedSchedule = schedule.filter(b => b.id !== editingCell);
    setSchedule(updatedSchedule);
    setEditingCell(null);
    saveToFirestore(updatedSchedule);
  };

  const handleEmptyCellClick = (day: number, period: number) => {
    if (!isAdmin) return;
    const newBlockId = `D${day}-P${period}-${Date.now()}`;
    setEditingCell(newBlockId);
    setEditSubject('');
    setEditStart('');
    setEditEnd('');
    const newBlock: ScheduleBlock = {
      id: newBlockId,
      day,
      period,
      start: '',
      end: '',
      subject: '',
      isBreak: period === 4
    };
    setSchedule([...schedule, newBlock]);
  };

  const saveToFirestore = async (blocksToSave: ScheduleBlock[]) => {
    setSaving(true);
    try {
      await setDoc(doc(db, 'schedules', selectedCourse), {
        blocks: blocksToSave,
        updatedAt: Date.now(),
        updatedBy: user.email
      });
    } catch (error) {
      console.error("Error saving schedule:", error);
      alert("Error al guardar el horario.");
    } finally {
      setSaving(false);
    }
  };

  const days = [1, 2, 3, 4, 5];
  const periods = [1, 2, 3, 4, 5, 6, 7, 8]; // 4 is Break, 8 is optional 7th class

  if (loading) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center h-full">
        <Loader2 className="w-10 h-10 animate-spin text-indigo-600 mb-4" />
        <p className="text-slate-500">Cargando horario...</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-slate-50/50 p-6 rounded-2xl border border-slate-200 overflow-hidden">
      
      <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-6 gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-indigo-100 rounded-lg">
            <Clock className="w-6 h-6 text-indigo-600" />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-slate-800">Horarios de Clases</h2>
            <p className="text-sm text-slate-500">Asignación automática y editable</p>
          </div>
        </div>
        
        <div className="flex items-center gap-3">
          <label className="text-sm font-medium text-slate-600">Curso:</label>
          <select
            value={selectedCourse}
            onChange={(e) => setSelectedCourse(e.target.value)}
            className="px-4 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none text-slate-700 bg-white shadow-sm font-medium"
          >
            {coursesList.map(c => (
              <option key={c} value={c}>Grado {c}</option>
            ))}
          </select>
          <button
            onClick={() => setShowSlideModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white font-extrabold rounded-xl shadow-md transition-all hover:scale-105 active:scale-95 text-xs sm:text-sm shrink-0 cursor-pointer"
            title="Abrir diapositivas del horario en pantalla completa"
          >
            <Tv className="w-4 h-4 text-purple-200" />
            <span>Slide Pantalla Completa</span>
          </button>

          {isAdmin && (
            <button 
              onClick={() => setShowManageCourses(true)}
              className="text-xs px-3 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-lg font-medium transition-colors"
            >
              Gestionar
            </button>
          )}
        </div>
      </div>

      {/* Manage Courses Modal */}
      {showManageCourses && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl w-full max-w-sm shadow-xl flex flex-col p-6">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-xl font-bold text-slate-900">Gestionar Cursos</h3>
              <button onClick={() => setShowManageCourses(false)} className="text-slate-400 hover:text-slate-600"><AlertCircle className="hidden"/> <span className="text-2xl leading-none">&times;</span></button>
            </div>
            
            <div className="flex gap-2 mb-4">
              <input
                type="text"
                value={newCourseName}
                onChange={(e) => setNewCourseName(e.target.value)}
                placeholder="Nuevo curso (ej: 12A)"
                className="flex-1 px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none text-sm"
              />
              <button
                onClick={handleAddCourse}
                className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 text-sm font-medium"
              >
                Añadir
              </button>
            </div>

            <div className="max-h-[300px] overflow-y-auto border border-slate-100 rounded-lg bg-slate-50">
              {coursesList.map(c => (
                <div key={c} className="flex justify-between items-center px-4 py-2 border-b border-slate-100 last:border-0 hover:bg-slate-100">
                  <span className="font-medium text-slate-700">Grado {c}</span>
                  <button onClick={() => handleDeleteCourse(c)} className="text-red-500 hover:text-red-700 text-sm font-medium px-2 py-1">
                    Eliminar
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {!isAdmin && (
        <div className="mb-4 flex items-center gap-2 text-sm text-amber-700 bg-amber-50 px-4 py-3 rounded-lg border border-amber-200">
          <AlertCircle className="w-5 h-5 shrink-0" />
          <span>Modo lectura: Solo los administradores pueden editar los horarios.</span>
        </div>
      )}

      {saving && (
        <div className="fixed bottom-6 right-6 bg-slate-800 text-white px-4 py-2 rounded-lg shadow-lg flex items-center gap-2 text-sm z-50">
          <Loader2 className="w-4 h-4 animate-spin" />
          Guardando cambios...
        </div>
      )}

      <div className="flex-1 overflow-auto bg-white rounded-xl shadow-sm border border-slate-200">
        <table className="w-full min-w-[800px] text-left border-collapse">
          <thead>
            <tr>
              <th className="sticky top-0 left-0 z-20 bg-slate-100 p-4 border-b border-r border-slate-200 font-bold text-slate-700 w-48 shadow-sm">
                Bloque Horario
              </th>
              {days.map((day) => (
                <th key={day} className="sticky top-0 z-10 bg-slate-50 p-4 border-b border-r border-slate-200 font-bold text-slate-700 text-center shadow-sm">
                  Jornada {day}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {periods.map(periodNum => {
              // Get the blocks for this period across all days
              const periodBlocks = schedule.filter(b => b.period === periodNum);
              
              // Skip period 8 if there are no blocks at all for it
              if (periodNum === 8 && periodBlocks.length === 0) return null;

              // Use the first block's time as the row header time (assuming they are usually the same)
              const firstBlock = periodBlocks[0];
              const rowStart = firstBlock?.start || '';
              const rowEnd = firstBlock?.end || '';
              const isBreakRow = periodNum === 4;

              return (
                <tr key={periodNum} className={isBreakRow ? 'bg-amber-50/30' : 'hover:bg-slate-50'}>
                  <td className={`p-3 border-b border-r border-slate-200 align-middle ${isBreakRow ? 'bg-amber-50/50' : 'bg-slate-50'} sticky left-0 z-10 font-medium text-slate-600 text-sm`}>
                    <div className="flex flex-col items-center text-center">
                      <span className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">
                        {isBreakRow ? 'Descanso' : `Hora ${periodNum > 4 ? periodNum - 1 : periodNum}`}
                      </span>
                      <span className="bg-white px-2 py-1 rounded shadow-sm border border-slate-100">
                        {rowStart} - {rowEnd}
                      </span>
                    </div>
                  </td>
                  
                  {days.map((dayNum) => {
                    const block = periodBlocks.find(b => b.day === dayNum);

                    if (!block) {
                      return (
                        <td 
                          key={dayNum} 
                          className={`p-3 border-b border-r border-slate-200 text-center align-middle transition-colors ${isAdmin ? 'hover:bg-slate-100 cursor-pointer' : ''}`}
                          onClick={() => isAdmin && handleEmptyCellClick(dayNum, periodNum)}
                        >
                          <span className="text-slate-300 font-medium">+</span>
                        </td>
                      );
                    }

                    const isEditing = editingCell === block.id;

                    return (
                      <td 
                        key={dayNum} 
                        className={`p-2 border-b border-r border-slate-200 align-top transition-colors relative group
                          ${isEditing ? 'bg-indigo-50 ring-2 ring-indigo-500 ring-inset' : ''}
                          ${isAdmin && !isEditing ? 'hover:bg-indigo-50/50 cursor-pointer' : ''}
                          ${block.isBreak ? 'bg-amber-50/30' : ''}
                        `}
                        onClick={() => !isEditing && handleCellClick(block)}
                      >
                        {isEditing ? (
                          <div className="flex flex-col gap-2 p-1">
                            <input
                              type="text"
                              value={editSubject}
                              onChange={(e) => setEditSubject(e.target.value)}
                              placeholder="Asignatura"
                              className="w-full px-2 py-1 text-sm border border-indigo-300 rounded focus:outline-none focus:border-indigo-500 font-bold text-center"
                              autoFocus
                              onKeyDown={(e) => e.key === 'Enter' && handleSaveCell()}
                            />
                            <div className="flex gap-1">
                              <input
                                type="text"
                                value={editStart}
                                onChange={(e) => setEditStart(e.target.value)}
                                placeholder="Inicio"
                                className="w-1/2 px-1 py-1 text-xs border border-indigo-200 rounded focus:outline-none text-center"
                                onKeyDown={(e) => e.key === 'Enter' && handleSaveCell()}
                              />
                              <input
                                type="text"
                                value={editEnd}
                                onChange={(e) => setEditEnd(e.target.value)}
                                placeholder="Fin"
                                className="w-1/2 px-1 py-1 text-xs border border-indigo-200 rounded focus:outline-none text-center"
                                onKeyDown={(e) => e.key === 'Enter' && handleSaveCell()}
                              />
                            </div>
                            <div className="flex justify-between mt-1 items-center">
                              <button 
                                onClick={(e) => { e.stopPropagation(); handleDeleteCell(); }}
                                className="text-red-500 hover:text-red-700 p-1"
                                title="Eliminar materia"
                              >
                                <AlertCircle className="w-4 h-4 hidden" /> <span className="text-xs font-bold underline">Borrar</span>
                              </button>
                              <button 
                                onClick={(e) => { e.stopPropagation(); handleSaveCell(); }}
                                className="bg-indigo-600 text-white px-2 py-1 rounded hover:bg-indigo-700 text-xs flex items-center gap-1"
                              >
                                <Save className="w-3 h-3" /> Guardar
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div className="flex flex-col items-center justify-center h-full min-h-[60px] p-2 rounded-lg">
                            <span className={`font-bold text-sm text-center ${block.isBreak ? 'text-amber-700' : 'text-slate-800'}`}>
                              {block.subject}
                            </span>
                            
                            {isAdmin && (
                              <div className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                <Edit2 className="w-3 h-3 text-indigo-400" />
                              </div>
                            )}
                          </div>
                        )}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Fullscreen Slide Presentation Modal */}
      <SchedulePreviewModal
        isOpen={showSlideModal}
        onClose={() => setShowSlideModal(false)}
        initialCourse={selectedCourse}
        customSchedule={allCoursesSlots}
        title="Horario Institucional"
      />
    </div>
  );
}
