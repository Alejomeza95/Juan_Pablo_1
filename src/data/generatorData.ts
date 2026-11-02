export type Teacher = {
  id: string;
  name: string;
};

export type Assignment = {
  teacherId: string;
  subject: string;
  groups: string[];
};

export const TEACHERS: Teacher[] = [
  { id: 't1', name: 'CLAUDIA SÁNCHEZ' },
  { id: 't2', name: 'EDNA OTERO' },
  { id: 't3', name: 'HUGO CHÁVEZ R.' },
  { id: 't4', name: 'FRANCISCO S.' },
  { id: 't5', name: 'DUVÁN NARVÁEZ' },
  { id: 't6', name: 'ELIER ORDOÑEZ' },
  { id: 't7', name: 'GLORIA PATRICIA MARTÍNEZ GÓMEZ' },
  { id: 't8', name: 'DANNER ÁLVAREZ' },
  { id: 't9', name: 'ADONIS QUIÑÓNEZ' },
  { id: 't10', name: 'MIRTHA BASTIDAS' },
  { id: 't11', name: 'HUGO GOYES' },
  { id: 't12', name: 'LIUS A. GÓMEZ' },
  { id: 't13', name: 'HARLEY OJEDA' },
  { id: 't14', name: 'JAIVER ARTEAGA' },
  { id: 't15', name: 'EINAR CASTRO' },
  { id: 't16', name: 'JHULIZA PÉREZ' },
  { id: 't17', name: 'DANILO MORA' },
  { id: 't18', name: 'IVONN ACOSTA' },
  { id: 't19', name: 'ANGIE BUESAQUILLO' },
  { id: 't20', name: 'STÉPHANY OLIVA' },
];

export const ASSIGNMENTS: Assignment[] = [
  { teacherId: 't1', subject: 'Biología', groups: ['9A', '9B', '9C'] },
  { teacherId: 't1', subject: 'Química', groups: ['11A', '11B', '11C'] },
  { teacherId: 't1', subject: 'Ética', groups: ['10A'] },

  { teacherId: 't2', subject: 'Biología', groups: ['7A', '7B', '8A', '8B'] },
  { teacherId: 't2', subject: 'Química', groups: ['10A', '10B'] },

  { teacherId: 't3', subject: 'Sociales', groups: ['6A', '6B', '7A', '7B', '9A', '10B'] },
  { teacherId: 't3', subject: 'Ética', groups: ['8A'] },

  { teacherId: 't4', subject: 'Artes', groups: ['6A', '6B', '7A', '7B', '8A', '8B', '9A', '9B', '9C', '10A', '10B', '11A', '11B', '11C'] }, // Note: JHULIZA PÉREZ has Artes 11A. But Francisco has all others. Wait, user prompt said: "FRANCISCO S. - Artes: 6A, 6B, 7A, 7B, 8A, 8B, 9A, 9B, 9C, 10A, 10B, 11B, 11C", omitted 11A.

  { teacherId: 't5', subject: 'Informática', groups: ['6A'] },
  { teacherId: 't5', subject: 'Español', groups: ['10A', '11A', '11B', '11C'] },
  { teacherId: 't5', subject: 'Filosofía', groups: ['11A', '11B', '11C'] },
  { teacherId: 't5', subject: 'Religión', groups: ['10A', '10B'] },

  { teacherId: 't6', subject: 'Educación Física', groups: ['7A', '8A', '8B', '9A', '9B', '9C', '10A', '10B', '11A', '11B', '11C'] },

  { teacherId: 't7', subject: 'Religión', groups: ['6A', '6B'] },
  { teacherId: 't7', subject: 'Ética', groups: ['6A', '6B'] },
  { teacherId: 't7', subject: 'Español', groups: ['9A', '9B', '9C'] },

  { teacherId: 't8', subject: 'Educación Física', groups: ['6A', '6B', '7B'] },
  { teacherId: 't8', subject: 'Español', groups: ['7A', '7B'] },
  { teacherId: 't8', subject: 'Secretariado', groups: ['10A', '10B'] },

  { teacherId: 't9', subject: 'Inglés', groups: ['6B', '8A', '8B', '10A', '10B', '11A', '11B', '11C'] },
  { teacherId: 't9', subject: 'Informática', groups: ['7A', '7B'] },

  { teacherId: 't10', subject: 'Matemáticas', groups: ['6A', '6B', '7A', '7B'] },

  { teacherId: 't11', subject: 'Matemáticas', groups: ['9A', '9B', '9C', '10A', '10B'] },
  { teacherId: 't11', subject: 'Análisis de Datos', groups: ['10A'] },

  { teacherId: 't12', subject: 'Matemáticas', groups: ['8A', '8B', '11A', '11B', '11C'] },
  { teacherId: 't12', subject: 'Análisis de Datos', groups: ['11A', '11B', '11C'] },

  { teacherId: 't13', subject: 'Informática', groups: ['6B', '8A', '8B', '9A', '9B', '9C', '10A', '10B', '11A', '11B', '11C'] },

  { teacherId: 't14', subject: 'Contabilidad', groups: ['11A', '11B', '11C'] },
  { teacherId: 't14', subject: 'Análisis de Datos', groups: ['10B'] },

  { teacherId: 't15', subject: 'Biología', groups: ['6A', '6B'] },
  { teacherId: 't15', subject: 'Ética', groups: ['8B'] },
  { teacherId: 't15', subject: 'Física', groups: ['10A', '10B', '11A', '11B', '11C'] },

  { teacherId: 't16', subject: 'Español', groups: ['6A', '6B'] },
  { teacherId: 't16', subject: 'Religión', groups: ['7A', '7B', '9A', '9B', '9C'] },
  { teacherId: 't16', subject: 'Filosofía', groups: ['10A', '10B'] },
  { teacherId: 't16', subject: 'Artes', groups: ['11A'] },

  { teacherId: 't17', subject: 'Ética', groups: ['7A', '7B'] },
  { teacherId: 't17', subject: 'Sociales', groups: ['8A', '8B', '9B', '9C', '10A', '11A', '11B', '11C'] },

  { teacherId: 't18', subject: 'Contabilidad', groups: ['10A', '10B'] },
  { teacherId: 't18', subject: 'Economía', groups: ['10A', '10B', '11A', '11B', '11C'] },
  { teacherId: 't18', subject: 'Legislación', groups: ['11A', '11B', '11C'] },

  { teacherId: 't19', subject: 'Inglés', groups: ['6A', '7A', '7B', '8A', '9A', '9B', '9C'] },
  { teacherId: 't19', subject: 'Religión', groups: ['8A', '8B'] },
  { teacherId: 't19', subject: 'Ética', groups: ['11A', '11B', '11C'] },

  { teacherId: 't20', subject: 'Español', groups: ['8A', '8B', '10B'] },
  { teacherId: 't20', subject: 'Ética', groups: ['9A', '9B', '9C', '10B'] },
  { teacherId: 't20', subject: 'Religión', groups: ['11A', '11B', '11C'] },
];

// Dynamic runtime cache populated from Firestore
let runtimeTeachers: Teacher[] = [...TEACHERS];
let runtimeAssignments: Assignment[] = [...ASSIGNMENTS];

export function setRuntimeAcademicData(teachers: Teacher[], assignments: Assignment[]) {
  if (teachers && teachers.length > 0) {
    runtimeTeachers = teachers;
  }
  if (assignments && assignments.length > 0) {
    runtimeAssignments = assignments;
  }
}

export function getRuntimeTeachers(): Teacher[] {
  return runtimeTeachers;
}

export function getRuntimeAssignments(): Assignment[] {
  return runtimeAssignments;
}

export function getTeacherForSubject(subject: string, group: string): Teacher | null {
  const normSub = subject.trim().toLowerCase();
  const assignment = runtimeAssignments.find(a => 
    a.subject.trim().toLowerCase() === normSub && a.groups.includes(group)
  ) || ASSIGNMENTS.find(a => 
    a.subject.trim().toLowerCase() === normSub && a.groups.includes(group)
  );

  if (assignment) {
    return runtimeTeachers.find(t => t.id === assignment.teacherId) || 
           TEACHERS.find(t => t.id === assignment.teacherId) || null;
  }
  return null;
}

