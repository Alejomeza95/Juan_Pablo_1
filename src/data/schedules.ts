import { AcademicEvent } from "../types";

export type ScheduleBlock = {
  id: string;
  day: number; // 1 to 5 (Jornada 1 to 5)
  period: number; // 1 to 8 (4 is Break)
  start: string;
  end: string;
  subject: string;
  isBreak: boolean;
};

const defaultTimes = [
  { p: 1, start: '7:30 a. m.', end: '8:25 a. m.', isBreak: false },
  { p: 2, start: '8:25 a. m.', end: '9:20 a. m.', isBreak: false },
  { p: 3, start: '9:20 a. m.', end: '10:15 a. m.', isBreak: false },
  { p: 4, start: '10:15 a. m.', end: '10:45 a. m.', isBreak: true, defaultSubject: 'Descanso' },
  { p: 5, start: '10:45 a. m.', end: '11:40 a. m.', isBreak: false },
  { p: 6, start: '11:40 a. m.', end: '12:35 p. m.', isBreak: false },
  { p: 7, start: '12:35 p. m.', end: '1:30 p. m.', isBreak: false },
  { p: 8, start: '1:30 p. m.', end: '2:25 p. m.', isBreak: false },
];

const rawData: Record<string, string[][]> = {
  "6A": [
    ["Artes", "Artes", "Informática", "Informática", "Sociales", "Sociales"],
    ["Sociales", "Sociales", "Español", "Español", "Matemáticas", "Matemáticas"],
    ["Religión", "Biología", "Biología", "Ética", "Matemáticas", "Matemáticas"],
    ["Inglés", "Inglés", "Español", "Español", "Biología", "Biología"],
    ["Matemáticas", "Matemáticas", "Español", "Español", "Educación Física", "Educación Física"]
  ],
  "6B": [
    ["Matemáticas", "Matemáticas", "Español", "Español", "Informática", "Informática"],
    ["Español", "Español", "Educación Física", "Educación Física", "Biología", "Biología"],
    ["Sociales", "Sociales", "Español", "Español", "Inglés", "Inglés"],
    ["Matemáticas", "Matemáticas", "Religión", "Ética", "Artes", "Artes"],
    ["Biología", "Biología", "Matemáticas", "Matemáticas", "Sociales", "Sociales"]
  ],
  "7A": [
    ["Español", "Español", "Matemáticas", "Matemáticas", "Religión", "Ética"],
    ["Español", "Español", "Matemáticas", "Biología", "Biología", "Inglés"],
    ["Matemáticas", "Matemáticas", "Educación Física", "Educación Física", "Sociales", "Sociales"],
    ["Español", "Español", "Informática", "Informática", "Sociales", "Sociales"],
    ["Artes", "Artes", "Inglés", "Inglés", "Biología", "Biología"]
  ],
  "7B": [
    ["Biología", "Biología", "Artes", "Artes", "Español", "Español"],
    ["Matemáticas", "Biología", "Biología", "Inglés", "Español", "Español"],
    ["Español", "Español", "Ética", "Inglés", "Inglés", "Religión"],
    ["Sociales", "Sociales", "Educación Física", "Educación Física", "Matemáticas", "Matemáticas"],
    ["Informática", "Informática", "Sociales", "Sociales", "Matemáticas", "Matemáticas"]
  ],
  "8A": [
    ["Ética", "Religión", "Español", "Español", "Matemáticas", "Inglés"],
    ["Inglés", "Inglés", "Sociales", "Sociales", "Matemáticas", "Matemáticas"],
    ["Biología", "Biología", "Matemáticas", "Matemáticas", "Español", "Español"],
    ["Artes", "Artes", "Español", "Español", "Informática", "Informática"],
    ["Educación Física", "Educación Física", "Biología", "Biología", "Sociales", "Sociales"]
  ],
  "8B": [
    ["Español", "Español", "Inglés", "Matemáticas", "Biología", "Biología"],
    ["Informática", "Informática", "Artes", "Artes", "Sociales", "Sociales"],
    ["Español", "Español", "Religión", "Ética", "Sociales", "Sociales"],
    ["Educación Física", "Educación Física", "Biología", "Biología", "Matemáticas", "Matemáticas"],
    ["Matemáticas", "Matemáticas", "Español", "Español", "Inglés", "Inglés"]
  ],
  "9A": [
    ["Español", "Español", "Biología", "Biología", "Matemáticas", "Matemáticas"],
    ["Español", "Español", "Matemáticas", "Matemáticas", "Sociales", "Sociales"],
    ["Artes", "Artes", "Sociales", "Sociales", "Informática", "Informática"],
    ["Biología", "Biología", "Inglés", "Inglés", "Matemáticas", "Religión"],
    ["Español", "Español", "Educación Física", "Educación Física", "Inglés", "Ética"]
  ],
  "9B": [
    ["Informática", "Informática", "Matemáticas", "Matemáticas", "Inglés", "Inglés"],
    ["Educación Física", "Educación Física", "Inglés", "Ética", "Español", "Español"],
    ["Sociales", "Sociales", "Artes", "Artes", "Matemáticas", "Matemáticas"],
    ["Religión", "Matemáticas", "Biología", "Biología", "Español", "Español"],
    ["Sociales", "Sociales", "Español", "Español", "Biología", "Biología"]
  ],
  "9C": [
    ["Inglés", "Religión", "Sociales", "Sociales", "Español", "Español"],
    ["Artes", "Artes", "Ética", "Biología", "Biología", "Matemáticas"],
    ["Educación Física", "Educación Física", "Biología", "Biología", "Español", "Español"],
    ["Español", "Español", "Matemáticas", "Matemáticas", "Sociales", "Sociales"],
    ["Inglés", "Inglés", "Matemáticas", "Matemáticas", "Informática", "Informática"]
  ],
  "10A": [
    ["Inglés", "Inglés", "Química", "Química", "Educación Física", "Educación Física", "Contabilidad"],
    ["Física", "Física", "Contabilidad", "Contabilidad", "Filosofía", "Filosofía", "Español"],
    ["Matemáticas", "Economía", "Análisis de Datos", "Secretariado", "Secretariado", "Artes", "Ética"],
    ["Sociales", "Contabilidad", "Contabilidad", "Español", "Español", "Química", "Religión"],
    ["Contabilidad", "Contabilidad", "Informática", "Informática", "Matemáticas", "Matemáticas"]
  ],
  "10B": [
    ["Matemáticas", "Matemáticas", "Contabilidad", "Sociales", "Español", "Español", "Religión"],
    ["Contabilidad", "Contabilidad", "Informática", "Informática", "Educación Física", "Educación Física", "Matemáticas"],
    ["Inglés", "Inglés", "Contabilidad", "Contabilidad", "Química", "Química", "Economía"],
    ["Física", "Física", "Análisis de Datos", "Contabilidad", "Contabilidad", "Español", "Química"],
    ["Filosofía", "Filosofía", "Secretariado", "Secretariado", "Ética", "Artes"]
  ],
  "11A": [
    ["Química", "Matemáticas", "Matemáticas", "Contabilidad", "Contabilidad", "Física", "Análisis de Datos"],
    ["Sociales", "Química", "Química", "Contabilidad", "Contabilidad", "Religión", "Ética"],
    ["Informática", "Informática", "Español", "Español", "Matemáticas", "Legislación", "Artes"],
    ["Inglés", "Inglés", "Física", "Física", "Educación Física", "Educación Física", "Contabilidad"],
    ["Contabilidad", "Contabilidad", "Español", "Economía", "Filosofía", "Filosofía"]
  ],
  "11B": [
    ["Sociales", "Contabilidad", "Contabilidad", "Economía", "Química", "Química", "Física"],
    ["Matemáticas", "Matemáticas", "Español", "Inglés", "Inglés", "Contabilidad", "Química"],
    ["Español", "Español", "Contabilidad", "Contabilidad", "Educación Física", "Educación Física", "Análisis de Datos"],
    ["Informática", "Informática", "Matemáticas", "Contabilidad", "Contabilidad", "Ética", "Religión"],
    ["Filosofía", "Filosofía", "Física", "Física", "Artes", "Legislación"]
  ],
  "11C": [
    ["Educación Física", "Educación Física", "Física", "Física", "Economía", "Español", "Contabilidad"],
    ["Contabilidad", "Contabilidad", "Análisis de Datos", "Filosofía", "Filosofía", "Artes", "Religión"],
    ["Contabilidad", "Contabilidad", "Informática", "Informática", "Física", "Química", "Ética"],
    ["Matemáticas", "Español", "Español", "Sociales", "Inglés", "Inglés", "Legislación"],
    ["Química", "Química", "Matemáticas", "Matemáticas", "Contabilidad", "Contabilidad"]
  ]
};

export const COURSES = Object.keys(rawData);

export function generateDefaultSchedule(course: string): ScheduleBlock[] {
  const blocks: ScheduleBlock[] = [];
  const courseData = rawData[course];
  if (!courseData) return [];

  for (let day = 1; day <= 5; day++) {
    const daySubjects = courseData[day - 1]; // 0-indexed for array
    
    defaultTimes.forEach(time => {
      let subject = '';
      if (time.isBreak) {
        subject = time.defaultSubject || 'Descanso';
      } else {
        // Map period to subject index
        // periods: 1,2,3 (indices 0,1,2)
        // period 4 is break
        // periods: 5,6,7 (indices 3,4,5)
        // period 8 (index 6)
        let subjectIndex = -1;
        if (time.p <= 3) subjectIndex = time.p - 1;
        else if (time.p >= 5) subjectIndex = time.p - 2;

        if (subjectIndex >= 0 && subjectIndex < daySubjects.length) {
          subject = daySubjects[subjectIndex];
        }
      }

      // Only add period 8 if there is a subject for it, OR if it's 10th/11th grade they might want the block available
      if (time.p === 8 && !subject) return;

      blocks.push({
        id: `D${day}-P${time.p}`,
        day,
        period: time.p,
        start: time.start,
        end: time.end,
        subject,
        isBreak: time.isBreak
      });
    });
  }

  return blocks;
}
