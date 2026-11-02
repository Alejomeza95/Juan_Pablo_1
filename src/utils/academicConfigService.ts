import { 
  collection, 
  doc, 
  getDocs, 
  setDoc, 
  updateDoc, 
  deleteDoc, 
  writeBatch
} from 'firebase/firestore';
import { db, auth, ADMIN_EMAIL } from '../firebase';
import { 
  TeacherRecord, 
  SchoolGroupRecord, 
  SubjectRecord, 
  TeachingAssignmentRecord, 
  AcademicConfigSettings, 
  TeacherAssignmentItem,
  AcademicYearConfigRecord,
  EducationalLevelConfig,
  EducationalLevelKey,
  GradeConfigItem
} from '../types';
import { TEACHERS, ASSIGNMENTS } from '../data/generatorData';

export const GRADES_LIST = [
  { grade: 6, name: 'Sexto' },
  { grade: 7, name: 'Séptimo' },
  { grade: 8, name: 'Octavo' },
  { grade: 9, name: 'Noveno' },
  { grade: 10, name: 'Décimo' },
  { grade: 11, name: 'Undécimo' },
];

export interface GradeDefinition {
  id: string;
  grade: number;
  name: string;
  shortName: string;
  levelKey: EducationalLevelKey;
  levelName: string;
}

export const ALL_STANDARD_GRADES: GradeDefinition[] = [
  { id: 'prejardin', grade: -2, name: 'Pre-Jardín', shortName: 'PJ', levelKey: 'preescolar', levelName: 'Educación Preescolar' },
  { id: 'jardin', grade: -1, name: 'Jardín', shortName: 'J', levelKey: 'preescolar', levelName: 'Educación Preescolar' },
  { id: 'transicion', grade: 0, name: 'Transición (0°)', shortName: '0°', levelKey: 'preescolar', levelName: 'Educación Preescolar' },
  { id: '1', grade: 1, name: 'Primero (1°)', shortName: '1°', levelKey: 'primaria', levelName: 'Básica Primaria' },
  { id: '2', grade: 2, name: 'Segundo (2°)', shortName: '2°', levelKey: 'primaria', levelName: 'Básica Primaria' },
  { id: '3', grade: 3, name: 'Tercero (3°)', shortName: '3°', levelKey: 'primaria', levelName: 'Básica Primaria' },
  { id: '4', grade: 4, name: 'Cuarto (4°)', shortName: '4°', levelKey: 'primaria', levelName: 'Básica Primaria' },
  { id: '5', grade: 5, name: 'Quinto (5°)', shortName: '5°', levelKey: 'primaria', levelName: 'Básica Primaria' },
  { id: '6', grade: 6, name: 'Sexto (6°)', shortName: '6°', levelKey: 'secundaria', levelName: 'Básica Secundaria' },
  { id: '7', grade: 7, name: 'Séptimo (7°)', shortName: '7°', levelKey: 'secundaria', levelName: 'Básica Secundaria' },
  { id: '8', grade: 8, name: 'Octavo (8°)', shortName: '8°', levelKey: 'secundaria', levelName: 'Básica Secundaria' },
  { id: '9', grade: 9, name: 'Noveno (9°)', shortName: '9°', levelKey: 'secundaria', levelName: 'Básica Secundaria' },
  { id: '10', grade: 10, name: 'Décimo (10°)', shortName: '10°', levelKey: 'media', levelName: 'Educación Media' },
  { id: '11', grade: 11, name: 'Undécimo (11°)', shortName: '11°', levelKey: 'media', levelName: 'Educación Media' },
];

export const DEFAULT_SECTIONS = ['A', 'B', 'C', 'D', 'E', 'F'];

export const STANDARD_SUBJECTS = [
  'Matemáticas',
  'Español',
  'Inglés',
  'Biología',
  'Química',
  'Física',
  'Sociales',
  'Filosofía',
  'Religión',
  'Ética',
  'Educación Física',
  'Artes',
  'Informática',
  'Contabilidad',
  'Economía',
  'Legislación',
  'Secretariado',
  'Análisis de Datos',
  'Ciencias Naturales'
];

export const LOCAL_STORAGE_KEYS = {
  teachers: 'jp1_academic_teachers',
  groups: 'jp1_academic_groups',
  assignments: 'jp1_academic_assignments',
  config: 'jp1_academic_config',
  subjects: 'jp1_academic_subjects',
  schoolYear: 'jp1_school_year_config'
};

/**
 * Retrieve all available subjects (standard + stored + active)
 */
export function getStoredSubjects(): string[] {
  const set = new Set<string>(STANDARD_SUBJECTS);
  
  if (typeof window !== 'undefined') {
    try {
      const raw = localStorage.getItem(LOCAL_STORAGE_KEYS.subjects);
      if (raw) {
        const custom: string[] = JSON.parse(raw);
        custom.forEach(s => {
          if (s && s.trim()) set.add(s.trim());
        });
      }

      // Also gather subjects from assignments
      const rawAsg = localStorage.getItem(LOCAL_STORAGE_KEYS.assignments);
      if (rawAsg) {
        const asgs: TeachingAssignmentRecord[] = JSON.parse(rawAsg);
        asgs.forEach(a => {
          if (a.subjectName && a.subjectName.trim()) set.add(a.subjectName.trim());
        });
      }
    } catch (e) {
      // fallback to standard
    }
  }

  return Array.from(set).sort((a, b) => a.localeCompare(b, 'es', { sensitivity: 'base' }));
}

/**
 * Save a new custom subject to available subjects
 */
export function addCustomSubject(subjectName: string): string[] {
  const trimmed = subjectName.trim();
  if (!trimmed) return getStoredSubjects();

  const current = getStoredSubjects();
  if (!current.some(s => s.toLowerCase() === trimmed.toLowerCase())) {
    const updated = [...current, trimmed].sort((a, b) => a.localeCompare(b, 'es', { sensitivity: 'base' }));
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem(LOCAL_STORAGE_KEYS.subjects, JSON.stringify(updated));
        notifyLocalAcademicUpdate();
      } catch (e) {
        console.warn("Error storing subject:", e);
      }
    }
    return updated;
  }
  return current;
}

/**
 * Check if an error is a Firebase permission error
 */
export function isPermissionError(error: any): boolean {
  if (!error) return false;
  const code = error?.code || '';
  const msg = error?.message || String(error);
  return (
    code === 'permission-denied' ||
    msg.includes('Missing or insufficient permissions') ||
    msg.includes('permission-denied') ||
    msg.includes('insufficient permissions')
  );
}

/**
 * Notify components of a local academic data change
 */
export function notifyLocalAcademicUpdate() {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('jp1_academic_data_updated'));
  }
}

/**
 * Generate standard baseline data for Colegio Juan Pablo I
 */
export function getBaselineAcademicData(): {
  teachers: TeacherRecord[];
  groups: SchoolGroupRecord[];
  assignments: TeachingAssignmentRecord[];
  config: AcademicConfigSettings;
} {
  const now = Date.now();

  // 1. Initial Groups: 6A, 6B, 7A, 7B, 8A, 8B, 9A, 9B, 9C, 10A, 10B, 11A, 11B, 11C
  const initialGroupsRaw: Array<{ grade: number; section: string }> = [
    { grade: 6, section: 'A' }, { grade: 6, section: 'B' },
    { grade: 7, section: 'A' }, { grade: 7, section: 'B' },
    { grade: 8, section: 'A' }, { grade: 8, section: 'B' },
    { grade: 9, section: 'A' }, { grade: 9, section: 'B' }, { grade: 9, section: 'C' },
    { grade: 10, section: 'A' }, { grade: 10, section: 'B' },
    { grade: 11, section: 'A' }, { grade: 11, section: 'B' }, { grade: 11, section: 'C' }
  ];

  const groups: SchoolGroupRecord[] = initialGroupsRaw.map(g => {
    const gradeObj = GRADES_LIST.find(item => item.grade === g.grade);
    return {
      id: `${g.grade}${g.section}`,
      grade: g.grade,
      gradeName: gradeObj?.name || `Grado ${g.grade}`,
      section: g.section,
      displayName: `${g.grade}°${g.section}`,
      active: true,
      createdAt: now,
      updatedAt: now
    };
  });

  // 2. Teachers from institutional roster
  const teachers: TeacherRecord[] = TEACHERS.map((t, idx) => ({
    id: t.id,
    fullName: t.name,
    internalCode: `DOC-${String(idx + 1).padStart(2, '0')}`,
    status: 'activo',
    createdAt: now,
    updatedAt: now
  }));

  // 3. Assignments
  const assignments: TeachingAssignmentRecord[] = [];
  let assignCount = 0;
  ASSIGNMENTS.forEach(a => {
    let hoursPerGroup = 3;
    if (['Matemáticas', 'Español'].includes(a.subject)) hoursPerGroup = 4;
    else if (['Inglés', 'Biología', 'Sociales'].includes(a.subject)) hoursPerGroup = 3;
    else if (['Química', 'Física', 'Filosofía'].includes(a.subject)) hoursPerGroup = 2;
    else if (['Ética', 'Religión', 'Informática', 'Artes'].includes(a.subject)) hoursPerGroup = 1;
    else if (['Educación Física'].includes(a.subject)) hoursPerGroup = 2;

    a.groups.forEach(grp => {
      assignCount++;
      assignments.push({
        id: `asg-${assignCount}`,
        teacherId: a.teacherId,
        subjectName: a.subject,
        groupId: grp,
        weeklyHours: hoursPerGroup,
        createdAt: now,
        updatedAt: now
      });
    });
  });

  // 4. Default config
  const config: AcademicConfigSettings = {
    maxWeeklyHours: 24,
    availableSections: DEFAULT_SECTIONS,
    updatedAt: now
  };

  return { teachers, groups, assignments, config };
}

/**
 * Extract flat list of all grades configured in the school year
 */
export function getActiveYearGradesList(yearConfig?: AcademicYearConfigRecord): GradeConfigItem[] {
  const config = yearConfig || getStoredSchoolYearConfig();
  const list: GradeConfigItem[] = [];
  if (Array.isArray(config?.levels)) {
    config.levels.forEach(level => {
      if (Array.isArray(level.grades)) {
        level.grades.forEach(grade => {
          list.push(grade);
        });
      }
    });
  }
  return list;
}

/**
 * Generate SchoolGroupRecord array from the courses/grades in AcademicYearConfigRecord
 */
export function generateGroupsFromYearConfig(
  yearConfig: AcademicYearConfigRecord,
  existingGroups?: SchoolGroupRecord[]
): SchoolGroupRecord[] {
  const now = Date.now();
  const existingMap = new Map<string, SchoolGroupRecord>(
    (existingGroups || []).map(g => [g.id, g])
  );

  const updatedGroups: SchoolGroupRecord[] = [];

  if (Array.isArray(yearConfig?.levels)) {
    yearConfig.levels.forEach(level => {
      if (Array.isArray(level.grades)) {
        level.grades.forEach(grade => {
          if (!grade.selected) return;
          const count = Math.max(1, grade.groupsCount || 1);
          const sections = (Array.isArray(grade.sections) && grade.sections.length >= count)
            ? grade.sections.slice(0, count)
            : DEFAULT_SECTIONS.slice(0, count);

          sections.forEach(section => {
            const gradeNum = grade.gradeNumber !== undefined ? grade.gradeNumber : (parseInt(grade.id, 10) || 0);
            const groupId = gradeNum >= 0 ? `${gradeNum}${section}` : `${grade.id}_${section}`;
            const prefix = grade.shortName ? grade.shortName : (gradeNum >= 0 ? `${gradeNum}°` : grade.name);
            const displayName = `${prefix}${section}`;
            const existing = existingMap.get(groupId);

            updatedGroups.push({
              id: groupId,
              grade: gradeNum,
              gradeName: grade.name,
              section,
              displayName,
              active: true,
              createdAt: existing?.createdAt || now,
              updatedAt: now,
            });
          });
        });
      }
    });
  }

  return updatedGroups;
}

/**
 * Retrieve local cached academic data, reconciling groups with active Año Escolar
 */
export function getLocalAcademicData(): {
  teachers: TeacherRecord[];
  groups: SchoolGroupRecord[];
  assignments: TeachingAssignmentRecord[];
  config: AcademicConfigSettings;
} {
  if (typeof window === 'undefined') {
    return getBaselineAcademicData();
  }

  try {
    const rawTeachers = localStorage.getItem(LOCAL_STORAGE_KEYS.teachers);
    const rawGroups = localStorage.getItem(LOCAL_STORAGE_KEYS.groups);
    const rawAssignments = localStorage.getItem(LOCAL_STORAGE_KEYS.assignments);
    const rawConfig = localStorage.getItem(LOCAL_STORAGE_KEYS.config);

    if (!rawTeachers || !rawAssignments) {
      const baseline = getBaselineAcademicData();
      saveLocalAcademicData(baseline);
      return baseline;
    }

    const yearConfig = getStoredSchoolYearConfig();
    let currentGroups: SchoolGroupRecord[] = [];
    if (rawGroups) {
      try {
        currentGroups = JSON.parse(rawGroups);
      } catch (e) {
        currentGroups = [];
      }
    }

    // Always ensure all selected courses/groups from active school year configuration exist
    const expectedYearGroups = generateGroupsFromYearConfig(yearConfig, currentGroups);

    // If local groups is empty or missing groups from the school year, synchronize
    const currentMap = new Map(currentGroups.map(g => [g.id, g]));
    let needsUpdate = currentGroups.length === 0;
    if (!needsUpdate) {
      for (const yg of expectedYearGroups) {
        if (!currentMap.has(yg.id)) {
          needsUpdate = true;
          break;
        }
      }
    }

    if (needsUpdate && expectedYearGroups.length > 0) {
      currentGroups = expectedYearGroups;
      try {
        localStorage.setItem(LOCAL_STORAGE_KEYS.groups, JSON.stringify(currentGroups));
      } catch (e) {
        // local storage error ignored
      }
    }

    return {
      teachers: JSON.parse(rawTeachers) as TeacherRecord[],
      groups: currentGroups.length > 0 ? currentGroups : expectedYearGroups,
      assignments: JSON.parse(rawAssignments) as TeachingAssignmentRecord[],
      config: rawConfig ? (JSON.parse(rawConfig) as AcademicConfigSettings) : {
        maxWeeklyHours: 24,
        availableSections: DEFAULT_SECTIONS,
        updatedAt: Date.now()
      }
    };
  } catch (e) {
    const baseline = getBaselineAcademicData();
    return baseline;
  }
}

/**
 * Persist full or partial data to localStorage
 */
export function saveLocalAcademicData(data: {
  teachers?: TeacherRecord[];
  groups?: SchoolGroupRecord[];
  assignments?: TeachingAssignmentRecord[];
  config?: AcademicConfigSettings;
}) {
  if (typeof window === 'undefined') return;
  try {
    if (data.teachers) {
      localStorage.setItem(LOCAL_STORAGE_KEYS.teachers, JSON.stringify(data.teachers));
    }
    if (data.groups) {
      localStorage.setItem(LOCAL_STORAGE_KEYS.groups, JSON.stringify(data.groups));
    }
    if (data.assignments) {
      localStorage.setItem(LOCAL_STORAGE_KEYS.assignments, JSON.stringify(data.assignments));
    }
    if (data.config) {
      localStorage.setItem(LOCAL_STORAGE_KEYS.config, JSON.stringify(data.config));
    }
  } catch (e) {
    console.warn("Error saving to localStorage:", e);
  }
}

/**
 * Seed initial school data if collections are empty in Firestore and ensure localStorage is primed
 */
export async function seedInitialAcademicDataIfEmpty(): Promise<boolean> {
  // Always prime local storage first
  const baseline = getLocalAcademicData();

  // If user is not authenticated or not admin, stay in local mode silently
  if (!auth.currentUser || auth.currentUser.email !== ADMIN_EMAIL) {
    return true;
  }

  try {
    const teachersSnap = await getDocs(collection(db, 'teachers'));
    if (!teachersSnap.empty) {
      return false; // Already populated in cloud
    }

    const batch = writeBatch(db);
    const now = Date.now();

    // 1. Groups
    baseline.groups.forEach(g => {
      const groupRef = doc(db, 'schoolGroups', g.id);
      batch.set(groupRef, g);
    });

    // 2. Subjects
    STANDARD_SUBJECTS.forEach((subName, idx) => {
      const id = `sub-${idx + 1}`;
      const subRef = doc(db, 'subjects', id);
      batch.set(subRef, {
        id,
        name: subName,
        active: true,
        createdAt: now,
        updatedAt: now
      } as SubjectRecord);
    });

    // 3. Teachers
    baseline.teachers.forEach(t => {
      const tRef = doc(db, 'teachers', t.id);
      batch.set(tRef, t);
    });

    // 4. Assignments
    baseline.assignments.forEach(a => {
      const asgRef = doc(db, 'teachingAssignments', a.id);
      batch.set(asgRef, a);
    });

    // 5. Config settings
    const configRef = doc(db, 'academicConfig', 'general');
    batch.set(configRef, baseline.config);

    await batch.commit();
    return true;
  } catch (error: any) {
    if (isPermissionError(error)) {
      console.warn("Firestore academic collections permissions pending. Baseline active in local storage.");
    } else {
      console.warn("Notice: Firestore seeding check non-fatal notice:", error?.message || error);
    }
    return false;
  }
}

/**
 * Teachers CRUD: Saves teacher and assignments both locally and to Firestore
 */
export async function saveTeacherWithAssignments(
  teacherData: {
    id?: string;
    fullName: string;
    internalCode: string;
    status: 'activo' | 'inactivo';
  },
  assignments: TeacherAssignmentItem[]
): Promise<string> {
  const now = Date.now();
  const teacherId = teacherData.id || `t_${Date.now()}`;

  // 1. Update local storage first for instant feedback and offline reliability
  const currentLocal = getLocalAcademicData();
  const updatedTeacher: TeacherRecord = {
    id: teacherId,
    fullName: teacherData.fullName.trim(),
    internalCode: teacherData.internalCode.trim() || `DOC-${teacherId.slice(-4).toUpperCase()}`,
    status: teacherData.status,
    createdAt: teacherData.id 
      ? (currentLocal.teachers.find(t => t.id === teacherId)?.createdAt || now)
      : now,
    updatedAt: now,
  };

  const remainingTeachers = currentLocal.teachers.filter(t => t.id !== teacherId);
  const newTeachersList = [...remainingTeachers, updatedTeacher].sort((a, b) => a.fullName.localeCompare(b.fullName));

  // Filter out previous assignments for this teacher
  const otherAssignments = currentLocal.assignments.filter(a => a.teacherId !== teacherId);
  const newAssignmentRecords: TeachingAssignmentRecord[] = [];

  assignments.forEach((item, index) => {
    if (!item.subjectName || !item.groupId || item.weeklyHours <= 0) return;
    const assignId = `${teacherId}_asg_${index + 1}_${Date.now()}`;
    newAssignmentRecords.push({
      id: assignId,
      teacherId,
      subjectName: item.subjectName.trim(),
      groupId: item.groupId.trim(),
      weeklyHours: Number(item.weeklyHours),
      createdAt: now,
      updatedAt: now,
    });
  });

  const updatedAssignmentsList = [...otherAssignments, ...newAssignmentRecords];

  saveLocalAcademicData({
    teachers: newTeachersList,
    assignments: updatedAssignmentsList
  });
  notifyLocalAcademicUpdate();

  // 2. Sync to Firestore if authenticated
  if (auth.currentUser && auth.currentUser.email === ADMIN_EMAIL) {
    try {
      const batch = writeBatch(db);
      const teacherRef = doc(db, 'teachers', teacherId);
      batch.set(teacherRef, updatedTeacher, { merge: true });

      const existingAssignSnap = await getDocs(collection(db, 'teachingAssignments'));
      existingAssignSnap.forEach(snap => {
        const data = snap.data() as TeachingAssignmentRecord;
        if (data.teacherId === teacherId) {
          batch.delete(snap.ref);
        }
      });

      newAssignmentRecords.forEach(asg => {
        const asgRef = doc(db, 'teachingAssignments', asg.id);
        batch.set(asgRef, asg);
      });

      await batch.commit();
    } catch (error) {
      if (isPermissionError(error)) {
        console.warn("Firestore permissions pending for teachers. Saved to local storage.");
      } else {
        console.warn("Firestore sync notice for teacher:", error);
      }
    }
  }

  return teacherId;
}

/**
 * Delete a teacher and their assignments
 */
export async function deleteTeacher(teacherId: string): Promise<void> {
  // 1. Delete from local storage
  const currentLocal = getLocalAcademicData();
  const newTeachersList = currentLocal.teachers.filter(t => t.id !== teacherId);
  const newAssignmentsList = currentLocal.assignments.filter(a => a.teacherId !== teacherId);

  saveLocalAcademicData({
    teachers: newTeachersList,
    assignments: newAssignmentsList
  });
  notifyLocalAcademicUpdate();

  // 2. Sync to Firestore if authenticated
  if (auth.currentUser && auth.currentUser.email === ADMIN_EMAIL) {
    try {
      const batch = writeBatch(db);
      const teacherRef = doc(db, 'teachers', teacherId);
      batch.delete(teacherRef);

      const existingAssignSnap = await getDocs(collection(db, 'teachingAssignments'));
      existingAssignSnap.forEach(snap => {
        const data = snap.data() as TeachingAssignmentRecord;
        if (data.teacherId === teacherId) {
          batch.delete(snap.ref);
        }
      });

      await batch.commit();
    } catch (error) {
      if (isPermissionError(error)) {
        console.warn("Firestore permissions pending for teacher delete. Removed from local storage.");
      } else {
        console.warn("Firestore sync notice for teacher delete:", error);
      }
    }
  }
}

/**
 * School Groups Matrix Sync: Updates groups and keeps Año Escolar levels synchronized
 */
export async function syncGroupsFromMatrix(
  matrix: Record<string | number, Record<string, boolean>>
): Promise<void> {
  const now = Date.now();
  const currentLocal = getLocalAcademicData();
  const existingMap = new Map<string, SchoolGroupRecord>(
    currentLocal.groups.map(g => [g.id, g])
  );

  const yearConfig = getStoredSchoolYearConfig();
  const updatedGroups: SchoolGroupRecord[] = [];

  // Update yearConfig level grades based on matrix
  const updatedLevels = yearConfig.levels.map(level => ({
    ...level,
    grades: level.grades.map(grade => {
      const gNum = grade.gradeNumber !== undefined ? grade.gradeNumber : (parseInt(grade.id, 10) || 0);
      const sectionObj = matrix[gNum] || matrix[grade.id] || {};
      const activeSections = Object.entries(sectionObj)
        .filter(([_, isChecked]) => Boolean(isChecked))
        .map(([section]) => section);

      activeSections.forEach(section => {
        const groupId = gNum >= 0 ? `${gNum}${section}` : `${grade.id}_${section}`;
        const prefix = grade.shortName ? grade.shortName : (gNum >= 0 ? `${gNum}°` : grade.name);
        const displayName = `${prefix}${section}`;
        const existing = existingMap.get(groupId);

        updatedGroups.push({
          id: groupId,
          grade: gNum,
          gradeName: grade.name,
          section,
          displayName,
          active: true,
          createdAt: existing?.createdAt || now,
          updatedAt: now,
        });
      });

      return {
        ...grade,
        selected: activeSections.length > 0,
        groupsCount: Math.max(1, activeSections.length),
        sections: activeSections.length > 0 ? activeSections : DEFAULT_SECTIONS.slice(0, 1)
      };
    })
  }));

  // Update Year config locally and sync
  const updatedYearConfig: AcademicYearConfigRecord = {
    ...yearConfig,
    levels: updatedLevels,
    updatedAt: now
  };

  if (typeof window !== 'undefined') {
    try {
      localStorage.setItem(LOCAL_STORAGE_KEYS.schoolYear, JSON.stringify(updatedYearConfig));
    } catch (e) {
      // ignore
    }
  }

  saveLocalAcademicData({ groups: updatedGroups });
  notifyLocalAcademicUpdate();

  // Sync to Firestore if authenticated admin
  if (auth.currentUser && auth.currentUser.email === ADMIN_EMAIL) {
    try {
      const batch = writeBatch(db);
      const existingSnap = await getDocs(collection(db, 'schoolGroups'));
      const remoteIds = new Set<string>();
      existingSnap.forEach(snap => remoteIds.add(snap.id));

      const updatedIds = new Set(updatedGroups.map(g => g.id));

      // Set new / updated
      updatedGroups.forEach(grp => {
        const ref = doc(db, 'schoolGroups', grp.id);
        batch.set(ref, grp);
      });

      // Delete removed
      remoteIds.forEach(id => {
        if (!updatedIds.has(id)) {
          const ref = doc(db, 'schoolGroups', id);
          batch.delete(ref);
        }
      });

      // Also sync year config to academicYears
      const yearDocRef = doc(db, 'academicYears', updatedYearConfig.id || `year_${updatedYearConfig.year}`);
      batch.set(yearDocRef, updatedYearConfig, { merge: true });

      await batch.commit();
    } catch (error) {
      if (isPermissionError(error)) {
        console.warn("Firestore permissions pending for schoolGroups. Saved to local storage.");
      } else {
        console.warn("Firestore sync notice for groups:", error);
      }
    }
  }
}

export async function deleteSchoolGroup(groupId: string): Promise<void> {
  const currentLocal = getLocalAcademicData();
  const updatedGroups = currentLocal.groups.filter(g => g.id !== groupId);
  saveLocalAcademicData({ groups: updatedGroups });
  notifyLocalAcademicUpdate();

  if (auth.currentUser && auth.currentUser.email === ADMIN_EMAIL) {
    try {
      const groupRef = doc(db, 'schoolGroups', groupId);
      await deleteDoc(groupRef);
    } catch (error) {
      if (!isPermissionError(error)) {
        console.warn("Firestore group delete notice:", error);
      }
    }
  }
}

export async function toggleSchoolGroupActive(groupId: string, active: boolean): Promise<void> {
  const currentLocal = getLocalAcademicData();
  const updatedGroups = currentLocal.groups.map(g => 
    g.id === groupId ? { ...g, active, updatedAt: Date.now() } : g
  );
  saveLocalAcademicData({ groups: updatedGroups });
  notifyLocalAcademicUpdate();

  if (auth.currentUser && auth.currentUser.email === ADMIN_EMAIL) {
    try {
      const groupRef = doc(db, 'schoolGroups', groupId);
      await updateDoc(groupRef, { active, updatedAt: Date.now() });
    } catch (error) {
      if (!isPermissionError(error)) {
        console.warn("Firestore group toggle notice:", error);
      }
    }
  }
}

/**
 * Settings CRUD
 */
export async function saveAcademicConfigSettings(settings: Partial<AcademicConfigSettings>): Promise<void> {
  const currentLocal = getLocalAcademicData();
  const updatedConfig: AcademicConfigSettings = {
    ...currentLocal.config,
    ...settings,
    updatedAt: Date.now()
  };
  saveLocalAcademicData({ config: updatedConfig });
  notifyLocalAcademicUpdate();

  if (auth.currentUser && auth.currentUser.email === ADMIN_EMAIL) {
    try {
      const configRef = doc(db, 'academicConfig', 'general');
      await setDoc(configRef, updatedConfig, { merge: true });
    } catch (error) {
      if (!isPermissionError(error)) {
        console.warn("Firestore config save notice:", error);
      }
    }
  }
}

// ==========================================
// Configuración de Año Escolar
// ==========================================

export function getDefaultSchoolYearConfig(year: number = new Date().getFullYear()): AcademicYearConfigRecord {
  return {
    id: `year_${year}`,
    year: year,
    displayName: `Año Escolar ${year}`,
    status: 'activo',
    periodCount: 4,
    startDate: `${year}-01-20`,
    endDate: `${year}-11-28`,
    notes: 'Jornada Diurna Completa - Colegio Juan Pablo I',
    levels: [
      {
        key: 'preescolar',
        name: 'Educación Preescolar',
        subtitle: 'Grados iniciales y desarrollo infantil',
        description: 'Formación para la primera infancia reglamentada por el MEN',
        grades: [
          {
            id: 'pre-jardin',
            levelKey: 'preescolar',
            levelName: 'Educación Preescolar',
            gradeNumber: -1,
            name: 'Pre-Jardín',
            shortName: 'Pre-J',
            selected: false,
            groupsCount: 1,
            sections: ['A']
          },
          {
            id: 'jardin',
            levelKey: 'preescolar',
            levelName: 'Educación Preescolar',
            gradeNumber: 0,
            name: 'Jardín Infantil',
            shortName: 'Jardín',
            selected: false,
            groupsCount: 1,
            sections: ['A']
          },
          {
            id: 'transicion',
            levelKey: 'preescolar',
            levelName: 'Educación Preescolar',
            gradeNumber: 0,
            name: 'Transición (Grado 0°)',
            shortName: '0°',
            selected: true,
            groupsCount: 1,
            sections: ['A']
          }
        ]
      },
      {
        key: 'primaria',
        name: 'Básica Primaria',
        subtitle: 'Grados 1° a 5°',
        description: 'Ciclo de formación básica elemental',
        grades: [
          {
            id: '1',
            levelKey: 'primaria',
            levelName: 'Básica Primaria',
            gradeNumber: 1,
            name: 'Primero (1°)',
            shortName: '1°',
            selected: true,
            groupsCount: 2,
            sections: ['A', 'B']
          },
          {
            id: '2',
            levelKey: 'primaria',
            levelName: 'Básica Primaria',
            gradeNumber: 2,
            name: 'Segundo (2°)',
            shortName: '2°',
            selected: true,
            groupsCount: 2,
            sections: ['A', 'B']
          },
          {
            id: '3',
            levelKey: 'primaria',
            levelName: 'Básica Primaria',
            gradeNumber: 3,
            name: 'Tercero (3°)',
            shortName: '3°',
            selected: true,
            groupsCount: 2,
            sections: ['A', 'B']
          },
          {
            id: '4',
            levelKey: 'primaria',
            levelName: 'Básica Primaria',
            gradeNumber: 4,
            name: 'Cuarto (4°)',
            shortName: '4°',
            selected: true,
            groupsCount: 2,
            sections: ['A', 'B']
          },
          {
            id: '5',
            levelKey: 'primaria',
            levelName: 'Básica Primaria',
            gradeNumber: 5,
            name: 'Quinto (5°)',
            shortName: '5°',
            selected: true,
            groupsCount: 2,
            sections: ['A', 'B']
          }
        ]
      },
      {
        key: 'secundaria',
        name: 'Básica Secundaria',
        subtitle: 'Grados 6° a 9°',
        description: 'Ciclo formativo de educación secundaria obligatoria',
        grades: [
          {
            id: '6',
            levelKey: 'secundaria',
            levelName: 'Básica Secundaria',
            gradeNumber: 6,
            name: 'Sexto (6°)',
            shortName: '6°',
            selected: true,
            groupsCount: 4,
            sections: ['A', 'B', 'C', 'D']
          },
          {
            id: '7',
            levelKey: 'secundaria',
            levelName: 'Básica Secundaria',
            gradeNumber: 7,
            name: 'Séptimo (7°)',
            shortName: '7°',
            selected: true,
            groupsCount: 3,
            sections: ['A', 'B', 'C']
          },
          {
            id: '8',
            levelKey: 'secundaria',
            levelName: 'Básica Secundaria',
            gradeNumber: 8,
            name: 'Octavo (8°)',
            shortName: '8°',
            selected: true,
            groupsCount: 3,
            sections: ['A', 'B', 'C']
          },
          {
            id: '9',
            levelKey: 'secundaria',
            levelName: 'Básica Secundaria',
            gradeNumber: 9,
            name: 'Noveno (9°)',
            shortName: '9°',
            selected: true,
            groupsCount: 3,
            sections: ['A', 'B', 'C']
          }
        ]
      },
      {
        key: 'media',
        name: 'Educación Media',
        subtitle: 'Grados 10° y 11°',
        description: 'Ciclo vocacional, técnico y preparación para la educación superior',
        grades: [
          {
            id: '10',
            levelKey: 'media',
            levelName: 'Educación Media',
            gradeNumber: 10,
            name: 'Décimo (10°)',
            shortName: '10°',
            selected: true,
            groupsCount: 2,
            sections: ['A', 'B']
          },
          {
            id: '11',
            levelKey: 'media',
            levelName: 'Educación Media',
            gradeNumber: 11,
            name: 'Undécimo (11°)',
            shortName: '11°',
            selected: true,
            groupsCount: 2,
            sections: ['A', 'B']
          }
        ]
      }
    ],
    updatedAt: Date.now()
  };
}

/**
 * Retrieve saved school year config from localStorage or defaults
 */
export function getStoredSchoolYearConfig(): AcademicYearConfigRecord {
  if (typeof window !== 'undefined') {
    try {
      const raw = localStorage.getItem(LOCAL_STORAGE_KEYS.schoolYear);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && Array.isArray(parsed.levels) && parsed.levels.length > 0) {
          return parsed;
        }
      }
    } catch (e) {
      console.warn("Error parsing stored school year config:", e);
    }
  }
  return getDefaultSchoolYearConfig(2026);
}

/**
 * Automatically synchronize school groups from the active academic year configuration.
 * When the administrator defines which grades exist and how many groups/sections they have
 * in "Año Escolar" (e.g. Sexto with A, B, C), this function generates the matching
 * school groups (6°A, 6°B, 6°C) and saves them both locally and to Firestore 'schoolGroups'.
 */
export async function syncGroupsFromYearConfig(yearConfig: AcademicYearConfigRecord): Promise<SchoolGroupRecord[]> {
  const currentLocal = getLocalAcademicData();
  const updatedGroups = generateGroupsFromYearConfig(yearConfig, currentLocal.groups);

  // 1. Instant local persistence and notify all components
  saveLocalAcademicData({ groups: updatedGroups });
  notifyLocalAcademicUpdate();

  // 2. Sync to Firestore if authenticated admin
  if (auth.currentUser && auth.currentUser.email === ADMIN_EMAIL) {
    try {
      const batch = writeBatch(db);
      const existingSnap = await getDocs(collection(db, 'schoolGroups'));
      const remoteIds = new Set<string>();
      existingSnap.forEach(snap => remoteIds.add(snap.id));

      const updatedIds = new Set(updatedGroups.map(g => g.id));

      // Create / update new groups
      updatedGroups.forEach(grp => {
        const ref = doc(db, 'schoolGroups', grp.id);
        batch.set(ref, grp, { merge: true });
      });

      // Remove obsolete groups that are no longer part of this school year
      remoteIds.forEach(id => {
        if (!updatedIds.has(id)) {
          const ref = doc(db, 'schoolGroups', id);
          batch.delete(ref);
        }
      });

      await batch.commit();
    } catch (error) {
      if (isPermissionError(error)) {
        console.warn("Firestore permissions pending for schoolGroups sync. Local storage active.");
      } else {
        console.warn("Firestore sync notice for year groups:", error);
      }
    }
  }

  return updatedGroups;
}

/**
 * Save school year configuration with dual persistence (localStorage + Firestore)
 * and automatically synchronizes the generated school groups into Configuración Académica.
 */
export async function saveStoredSchoolYearConfig(config: AcademicYearConfigRecord): Promise<SchoolGroupRecord[]> {
  const updated = {
    ...config,
    updatedAt: Date.now()
  };

  // 1. Instant local persistence of year config
  if (typeof window !== 'undefined') {
    try {
      localStorage.setItem(LOCAL_STORAGE_KEYS.schoolYear, JSON.stringify(updated));
    } catch (e) {
      console.warn("Error saving school year config to localStorage:", e);
    }
  }

  // 2. Synchronize school groups so that Configuración Académica (Docentes, Grupos, Asignaciones)
  // immediately receives and uses these exact school groups!
  const syncedGroups = await syncGroupsFromYearConfig(updated);

  // 3. Sync year config to Firestore if authenticated admin
  if (auth.currentUser && auth.currentUser.email === ADMIN_EMAIL) {
    try {
      const yearDocRef = doc(db, 'academicYears', updated.id || `year_${updated.year}`);
      await setDoc(yearDocRef, updated, { merge: true });

      // Also update general config indicator
      const configRef = doc(db, 'academicConfig', 'currentSchoolYear');
      await setDoc(configRef, { 
        currentYear: updated.year, 
        status: updated.status,
        updatedAt: Date.now() 
      }, { merge: true });
    } catch (error) {
      if (!isPermissionError(error)) {
        console.warn("Firestore school year save notice:", error);
      }
    }
  }

  return syncedGroups;
}


