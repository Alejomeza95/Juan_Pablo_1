import { COURSES, ScheduleBlock, generateDefaultSchedule } from '../data/schedules';
import { getTeacherForSubject, Teacher, TEACHERS } from '../data/generatorData';

export type RequiredClass = {
  id: string;
  groupId: string;
  subject: string;
  teacher: Teacher | null;
  weeklyHours: number;
};

export function getRequiredClasses(): RequiredClass[] {
  const reqs: RequiredClass[] = [];

  for (const course of COURSES) {
    const blocks = generateDefaultSchedule(course);
    
    const subjectCounts: Record<string, number> = {};
    for (const block of blocks) {
      if (block.isBreak || !block.subject) continue;
      subjectCounts[block.subject] = (subjectCounts[block.subject] || 0) + 1;
    }

    for (const [subject, hours] of Object.entries(subjectCounts)) {
      const teacher = getTeacherForSubject(subject, course);
      reqs.push({
        id: `${course}-${subject}`,
        groupId: course,
        subject,
        teacher,
        weeklyHours: hours
      });
    }
  }

  return reqs;
}

export type EngineSlot = {
  day: number;
  period: number;
  groupId: string;
  subject: string;
  teacherId: string | null;
  locked?: boolean;
};

// Teacher Unavailability rule: a teacher is unavailable at a specific day/period
export type TeacherUnavailability = {
  teacherId: string;
  day: number; // 1 to 5 (Lunes a Viernes)
  period: number; // 1 to 8
  reason?: string;
};

// Blocked slot rule: a group (or entire school) cannot have academic classes at this slot
export type BlockedSlot = {
  id?: string;
  groupId?: string; // If undefined, applies to all groups
  day: number; // 1 to 5
  period: number; // 1 to 8
  reason: string;
};

// Default blocked slots across the institution (Break periods, institutional meetings)
export const DEFAULT_BLOCKED_SLOTS: BlockedSlot[] = [
  // Period 4 is break across all days for all groups
  { day: 1, period: 4, reason: 'Descanso institucional' },
  { day: 2, period: 4, reason: 'Descanso institucional' },
  { day: 3, period: 4, reason: 'Descanso institucional' },
  { day: 4, period: 4, reason: 'Descanso institucional' },
  { day: 5, period: 4, reason: 'Descanso institucional' },
];

// Default teacher availability restrictions
export const DEFAULT_TEACHER_UNAVAILABILITY: TeacherUnavailability[] = [];

// Conflict types for auditing
export type ConflictType = 
  | 'teacher_overlap'         // Docente asignado a 2+ grupos a la misma hora
  | 'group_overlap'           // Grupo con 2+ materias a la misma hora
  | 'workload_deficit'        // Faltan horas de la materia
  | 'workload_excess'         // Exceso de horas de la materia
  | 'teacher_unavailability'  // Docente asignado en horario no disponible
  | 'blocked_slot'            // Asignación en descanso o franja bloqueada
  | 'invalid_period'          // Periodo fuera del horario válido para el grado o salida viernes
  | 'max_daily_subject_hours' // Más de dos horas de la misma asignatura en un día
  | 'non_consecutive_hours'   // Horas de la misma asignatura cortadas/no consecutivas
  | 'empty_gap_hour'          // Hora vacía / hueco en la jornada (excepto descanso)
  | 'parity_block_structure'; // Horas pares en bloques de 2h; impares en bloques de 2h y 1 de 1h

export type ScheduleConflict = {
  id: string;
  type: ConflictType;
  severity: 'error' | 'warning';
  title: string;
  description: string;
  day?: number;
  period?: number;
  groupId?: string;
  teacherId?: string | null;
  teacherName?: string;
  subject?: string;
};

export type ValidationOptions = {
  teacherUnavailability?: TeacherUnavailability[];
  blockedSlots?: BlockedSlot[];
  requiredClasses?: RequiredClass[];
  ignoreBreaks?: boolean;
};

export type ScheduleValidationResult = {
  valid: boolean;
  totalClasses: number;
  totalRequiredHours: number;
  assignedHours: number;
  compliancePercentage: number;
  
  // Categorized conflicts
  teacherConflicts: ScheduleConflict[];
  groupConflicts: ScheduleConflict[];
  workloadConflicts: ScheduleConflict[];
  availabilityConflicts: ScheduleConflict[];
  blockedSlotConflicts: ScheduleConflict[];
  pedagogicalConflicts: ScheduleConflict[]; // Reglas pedagógicas institucionales
  
  // Unified list
  allConflicts: ScheduleConflict[];
  
  metrics: {
    errorCount: number;
    warningCount: number;
    teacherConflictCount: number;
    groupConflictCount: number;
    workloadConflictCount: number;
    availabilityConflictCount: number;
    blockedSlotConflictCount: number;
    pedagogicalConflictCount: number;
    maxDailyConflictCount: number;
    consecutiveConflictCount: number;
    emptyHourConflictCount: number;
    parityBlockConflictCount: number;
  };
};

/**
 * Returns valid periods for a group (excluding institutional break in period 4).
 * Regla institucional:
 * - Grados 10 y 11: de lunes a jueves salen a las 2:15 p. m. (periodo 8).
 * - Grados 10 y 11: los VIERNES (día 5) salen a la 1:30 p. m. (periodo 7, SIN periodo 8).
 * - Grados 6 a 9: salen siempre a la 1:30 p. m. (periodo 7, SIN periodo 8).
 */
export function getValidPeriods(groupId: string, day?: number): number[] {
  const isUpperGrade = groupId.startsWith('10') || groupId.startsWith('11');
  const basePeriods = [1, 2, 3, 5, 6, 7]; // Periodos 1, 2, 3, [4 Descanso], 5, 6, 7 (salida 1:30 p. m.)
  
  if (isUpperGrade) {
    // Viernes (día 5): Grados 10 y 11 salen a la 1:30 p. m., NO tienen periodo 8
    if (day === 5) {
      return basePeriods;
    }
    // De resto (Lunes a Jueves, días 1 a 4): salen a las 2:15 p. m. (periodo 8)
    if (day === undefined || (day >= 1 && day <= 4)) {
      return [...basePeriods, 8];
    }
  }
  return basePeriods;
}

/**
 * Centralized validateSchedule function.
 * Acts as the SINGLE SOURCE OF TRUTH for schedule verification in the whole app.
 * Verifies:
 *  1. Teacher overlaps (no teacher in multiple classrooms simultaneously)
 *  2. Group overlaps (no group with multiple classes simultaneously)
 *  3. Curricular workload intensity (matches exact required weekly hours per subject & group)
 *  4. Teacher availability (respects teacher-specific unavailability windows)
 *  5. Blocked hours (respects institutional breaks and blocked periods per grade)
 */
export function validateSchedule(
  schedule: EngineSlot[],
  options?: ValidationOptions
): ScheduleValidationResult {
  const teacherUnavailability = options?.teacherUnavailability ?? DEFAULT_TEACHER_UNAVAILABILITY;
  const blockedSlots = options?.blockedSlots ?? DEFAULT_BLOCKED_SLOTS;
  const requiredClasses = options?.requiredClasses ?? getRequiredClasses();

  const teacherConflicts: ScheduleConflict[] = [];
  const groupConflicts: ScheduleConflict[] = [];
  const workloadConflicts: ScheduleConflict[] = [];
  const availabilityConflicts: ScheduleConflict[] = [];
  const blockedSlotConflicts: ScheduleConflict[] = [];

  // Helper to get teacher name
  const getTeacherName = (tId: string | null | undefined): string => {
    if (!tId) return 'Sin docente';
    const found = TEACHERS.find(t => t.id === tId);
    return found ? found.name : tId;
  };

  // Build lookup maps for efficient conflict detection
  const teacherSlotMap = new Map<string, EngineSlot[]>(); // `${teacherId}-${day}-${period}`
  const groupSlotMap = new Map<string, EngineSlot[]>();   // `${groupId}-${day}-${period}`
  const unavailSet = new Map<string, string>();           // `${teacherId}-${day}-${period}` -> reason

  teacherUnavailability.forEach(u => {
    unavailSet.set(`${u.teacherId}-${u.day}-${u.period}`, u.reason || 'Horario no disponible');
  });

  // Filter out pure break blocks if present in the raw input
  const academicSlots = schedule.filter(s => s.subject && s.subject !== 'Descanso');

  // 1. Check Group Overlaps, Teacher Overlaps, Teacher Availability & Blocked Slots
  academicSlots.forEach((slot, index) => {
    const gKey = `${slot.groupId}-${slot.day}-${slot.period}`;
    if (!groupSlotMap.has(gKey)) groupSlotMap.set(gKey, []);
    groupSlotMap.get(gKey)!.push(slot);

    if (slot.teacherId) {
      const tKey = `${slot.teacherId}-${slot.day}-${slot.period}`;
      if (!teacherSlotMap.has(tKey)) teacherSlotMap.set(tKey, []);
      teacherSlotMap.get(tKey)!.push(slot);

      // 4. Check Teacher Availability
      if (unavailSet.has(tKey)) {
        const reason = unavailSet.get(tKey);
        const tName = getTeacherName(slot.teacherId);
        availabilityConflicts.push({
          id: `unavail-${slot.teacherId}-${slot.day}-${slot.period}-${index}`,
          type: 'teacher_unavailability',
          severity: 'error',
          title: `Indisponibilidad de ${tName}`,
          description: `El docente ${tName} está asignado al grupo ${slot.groupId} (${slot.subject}) en Día ${slot.day}, Hora ${slot.period}, pero no tiene disponibilidad (${reason}).`,
          day: slot.day,
          period: slot.period,
          groupId: slot.groupId,
          teacherId: slot.teacherId,
          teacherName: tName,
          subject: slot.subject
        });
      }
    }

    // 5. Check Blocked Hours
    // (a) Universal institutional break check (period 4)
    if (slot.period === 4) {
      blockedSlotConflicts.push({
        id: `blocked-break-${slot.groupId}-${slot.day}-${slot.period}-${index}`,
        type: 'blocked_slot',
        severity: 'error',
        title: `Clase en franja de descanso (${slot.groupId})`,
        description: `Se asignó ${slot.subject} en la Hora 4 (Periodo de Descanso Institucional) en el Día ${slot.day}.`,
        day: slot.day,
        period: slot.period,
        groupId: slot.groupId,
        teacherId: slot.teacherId,
        teacherName: getTeacherName(slot.teacherId),
        subject: slot.subject
      });
    }

    // (b) Group grade valid period check (e.g. 6A-9C do not have period 8, and 10/11 do not have period 8 on Friday)
    const validPeriods = getValidPeriods(slot.groupId, slot.day);
    if (!validPeriods.includes(slot.period) && slot.period !== 4) {
      const isFriday1011 = (slot.groupId.startsWith('10') || slot.groupId.startsWith('11')) && slot.day === 5 && slot.period === 8;
      const conflict: ScheduleConflict = {
        id: `invalid-period-${slot.groupId}-${slot.day}-${slot.period}-${index}`,
        type: 'invalid_period',
        severity: 'error',
        title: isFriday1011 
          ? `Salida viernes 1:30 p. m. violada (${slot.groupId})` 
          : `Periodo no autorizado para ${slot.groupId}`,
        description: isFriday1011
          ? `Los estudiantes de grado 10.° y 11.° salen los viernes a la 1:30 p. m. No se permite programar la Hora 8 el Día 5 (Viernes) para ${slot.groupId}.`
          : `El grupo ${slot.groupId} no tiene habilitada la Hora ${slot.period} en su jornada académica regular el Día ${slot.day}.`,
        day: slot.day,
        period: slot.period,
        groupId: slot.groupId,
        teacherId: slot.teacherId,
        teacherName: getTeacherName(slot.teacherId),
        subject: slot.subject
      };
      blockedSlotConflicts.push(conflict);
    }

    // (c) Custom institutional blocked slots
    const isCustomBlocked = blockedSlots.some(b => 
      b.day === slot.day && 
      b.period === slot.period && 
      (!b.groupId || b.groupId === slot.groupId) &&
      b.period !== 4 // Avoid double-reporting period 4
    );
    if (isCustomBlocked) {
      const match = blockedSlots.find(b => 
        b.day === slot.day && 
        b.period === slot.period && 
        (!b.groupId || b.groupId === slot.groupId)
      );
      blockedSlotConflicts.push({
        id: `blocked-custom-${slot.groupId}-${slot.day}-${slot.period}-${index}`,
        type: 'blocked_slot',
        severity: 'error',
        title: `Hora bloqueada (${slot.groupId})`,
        description: `El Día ${slot.day}, Hora ${slot.period} está bloqueado por "${match?.reason || 'Restricción institucional'}".`,
        day: slot.day,
        period: slot.period,
        groupId: slot.groupId,
        teacherId: slot.teacherId,
        teacherName: getTeacherName(slot.teacherId),
        subject: slot.subject
      });
    }
  });

  // Process Group Overlaps
  groupSlotMap.forEach((slots, key) => {
    if (slots.length > 1) {
      const first = slots[0];
      const subjects = slots.map(s => s.subject).join(' y ');
      groupConflicts.push({
        id: `group-overlap-${key}`,
        type: 'group_overlap',
        severity: 'error',
        title: `Cruce en el grupo ${first.groupId}`,
        description: `El grupo ${first.groupId} tiene ${slots.length} clases asignadas simultáneamente el Día ${first.day}, Hora ${first.period} (${subjects}).`,
        day: first.day,
        period: first.period,
        groupId: first.groupId,
        subject: subjects
      });
    }
  });

  // Process Teacher Overlaps
  teacherSlotMap.forEach((slots, key) => {
    if (slots.length > 1) {
      const first = slots[0];
      const tName = getTeacherName(first.teacherId);
      const groups = slots.map(s => `${s.groupId} (${s.subject})`).join(' y ');
      teacherConflicts.push({
        id: `teacher-overlap-${key}`,
        type: 'teacher_overlap',
        severity: 'error',
        title: `Cruce docente: ${tName}`,
        description: `El docente ${tName} tiene asignación simultánea con los grupos: ${groups} en el Día ${first.day}, Hora ${first.period}.`,
        day: first.day,
        period: first.period,
        teacherId: first.teacherId,
        teacherName: tName
      });
    }
  });

  // 3. Check Curricular Workload Intensity (missing or excess hours)
  let totalRequiredHours = 0;
  let properlyAssignedHours = 0;

  requiredClasses.forEach((req) => {
    totalRequiredHours += req.weeklyHours;
    const assignedCount = academicSlots.filter(
      s => s.groupId === req.groupId && s.subject === req.subject
    ).length;

    properlyAssignedHours += Math.min(assignedCount, req.weeklyHours);

    const tName = req.teacher ? req.teacher.name : (getTeacherForSubject(req.subject, req.groupId)?.name || 'Sin docente');

    if (assignedCount < req.weeklyHours) {
      const deficit = req.weeklyHours - assignedCount;
      workloadConflicts.push({
        id: `deficit-${req.groupId}-${req.subject}`,
        type: 'workload_deficit',
        severity: 'error',
        title: `Faltan horas: ${req.subject} (${req.groupId})`,
        description: `Faltan ${deficit} hora(s) de ${req.subject} en ${req.groupId}. Requiere ${req.weeklyHours}h semanales, pero solo tiene ${assignedCount}h programadas. Docente asignado: ${tName}.`,
        groupId: req.groupId,
        subject: req.subject,
        teacherId: req.teacher ? req.teacher.id : null,
        teacherName: tName
      });
    } else if (assignedCount > req.weeklyHours) {
      const excess = assignedCount - req.weeklyHours;
      workloadConflicts.push({
        id: `excess-${req.groupId}-${req.subject}`,
        type: 'workload_excess',
        severity: 'warning',
        title: `Exceso de horas: ${req.subject} (${req.groupId})`,
        description: `El grupo ${req.groupId} tiene ${excess} hora(s) de más en ${req.subject}. Requiere ${req.weeklyHours}h semanales, pero se programaron ${assignedCount}h.`,
        groupId: req.groupId,
        subject: req.subject,
        teacherId: req.teacher ? req.teacher.id : null,
        teacherName: tName
      });
    }
  });

  // Check for any subject assigned to a group that was not even in the curriculum requirements
  const groupSubjectPairs = new Set(requiredClasses.map(r => `${r.groupId}__${r.subject}`));
  academicSlots.forEach((slot, index) => {
    const pair = `${slot.groupId}__${slot.subject}`;
    if (!groupSubjectPairs.has(pair)) {
      workloadConflicts.push({
        id: `unplanned-${slot.groupId}-${slot.subject}-${index}`,
        type: 'workload_excess',
        severity: 'warning',
        title: `Materia no planeada: ${slot.subject} en ${slot.groupId}`,
        description: `La materia ${slot.subject} asignada a ${slot.groupId} (Día ${slot.day}, Hora ${slot.period}) no figura en el plan de estudios del grupo.`,
        day: slot.day,
        period: slot.period,
        groupId: slot.groupId,
        subject: slot.subject,
        teacherId: slot.teacherId,
        teacherName: getTeacherName(slot.teacherId)
      });
    }
  });

  // 6. Pedagogical Institutional Rules:
  // (a) Grade 10 & 11 Friday exit at 1:30 pm (Hora 8 on Friday is strictly forbidden)
  // (b) Max 2 hours per subject per day for any course
  // (c) Two-hour classes of the same subject must be consecutive (cannot be cut/separated)
  // (d) No empty hours in the course's regular school day (except break in period 4)
  const pedagogicalConflicts: ScheduleConflict[] = [];

  let maxDailyCount = 0;
  let consecutiveCount = 0;
  let emptyHourCount = 0;
  let parityBlockCount = 0;

  for (const course of COURSES) {
    for (let day = 1; day <= 5; day++) {
      const validPeriods = getValidPeriods(course, day);
      const dayCourseSlots = academicSlots.filter(s => s.groupId === course && s.day === day);

      // (d) Check for empty hours (no class assigned to a required academic period)
      validPeriods.forEach(p => {
        const isAssigned = dayCourseSlots.some(s => s.period === p);
        if (!isAssigned) {
          emptyHourCount++;
          pedagogicalConflicts.push({
            id: `empty-hour-${course}-${day}-${p}`,
            type: 'empty_gap_hour',
            severity: 'error',
            title: `Hora vacía en ${course}`,
            description: `El grupo ${course} tiene la Hora ${p > 4 ? p - 1 : p} (Periodo ${p}) sin clase el Día ${day}. A excepción del descanso institucional (Hora 4), los estudiantes no pueden tener horas vacías en su jornada.`,
            day,
            period: p,
            groupId: course
          });
        }
      });

      // Group by subject on this day for course
      const subjectSlotsMap = new Map<string, EngineSlot[]>();
      dayCourseSlots.forEach(s => {
        if (!subjectSlotsMap.has(s.subject)) subjectSlotsMap.set(s.subject, []);
        subjectSlotsMap.get(s.subject)!.push(s);
      });

      subjectSlotsMap.forEach((slots, subject) => {
        // (b) Max 2 hours per subject per day
        if (slots.length > 2) {
          maxDailyCount++;
          pedagogicalConflicts.push({
            id: `max-hours-${course}-${day}-${subject}`,
            type: 'max_daily_subject_hours',
            severity: 'error',
            title: `Más de 2 horas de ${subject} en ${course}`,
            description: `El grupo ${course} tiene ${slots.length} horas de ${subject} el Día ${day}. La regla institucional prohíbe tener más de dos horas de la misma asignatura en un día.`,
            day,
            groupId: course,
            subject
          });
        }

        // (c) Two-hour classes must be consecutive (cannot be cut/separated)
        if (slots.length >= 2) {
          const sortedPeriods = slots.map(s => s.period).sort((a, b) => a - b);
          for (let i = 0; i < sortedPeriods.length - 1; i++) {
            const p1 = sortedPeriods[i];
            const p2 = sortedPeriods[i + 1];
            const idx1 = validPeriods.indexOf(p1);
            const idx2 = validPeriods.indexOf(p2);

            // If not consecutive in the course's academic periods of that day
            if (idx1 !== -1 && idx2 !== -1 && idx2 !== idx1 + 1) {
              consecutiveCount++;
              pedagogicalConflicts.push({
                id: `non-consecutive-${course}-${day}-${subject}-${p1}-${p2}`,
                type: 'non_consecutive_hours',
                severity: 'error',
                title: `Horas cortadas de ${subject} en ${course}`,
                description: `Las horas de ${subject} en ${course} el Día ${day} no son seguidas (se asignaron en Periodo ${p1} y Periodo ${p2}). Deben ser horas seguidas y no se pueden cortar.`,
                day,
                period: p1,
                groupId: course,
                subject
              });
            }
          }
        }
      });
    }

    // (e) Parity block structure:
    // Materias con intensidad par (ej. 4h, 2h, 6h) deben verse en bloques de 2 horas (0 horas de 1h).
    // Materias con intensidad impar (ej. 3h, 5h, 1h) deben verse en bloques de 2 horas y exactamente una de 1 hora.
    const courseAcademicSlots = academicSlots.filter(s => s.groupId === course);
    const subjectWeeklyTotals = new Map<string, number>();
    courseAcademicSlots.forEach(s => {
      subjectWeeklyTotals.set(s.subject, (subjectWeeklyTotals.get(s.subject) || 0) + 1);
    });

    subjectWeeklyTotals.forEach((weeklyTotal, subject) => {
      let daysWith1h = 0;
      for (let d = 1; d <= 5; d++) {
        const countOnDay = courseAcademicSlots.filter(s => s.subject === subject && s.day === d).length;
        if (countOnDay === 1) daysWith1h++;
      }

      const isEven = weeklyTotal % 2 === 0;
      if (isEven && daysWith1h > 0) {
        parityBlockCount++;
        pedagogicalConflicts.push({
          id: `parity-even-${course}-${subject}`,
          type: 'parity_block_structure',
          severity: 'error',
          title: `Bloque no permitido de 1h en materia par: ${subject} (${course})`,
          description: `${subject} tiene ${weeklyTotal} horas semanales (intensidad par) en ${course} y debe impartirse exclusivamente en bloques de 2 horas. Se detectaron ${daysWith1h} día(s) con sesiones aisladas de 1 hora.`,
          groupId: course,
          subject
        });
      } else if (!isEven && daysWith1h > 1) {
        parityBlockCount++;
        pedagogicalConflicts.push({
          id: `parity-odd-${course}-${subject}`,
          type: 'parity_block_structure',
          severity: 'error',
          title: `Distribución incorrecta en materia impar: ${subject} (${course})`,
          description: `${subject} tiene ${weeklyTotal} horas semanales (intensidad impar) en ${course} y debe impartirse en bloques de 2 horas más una sola clase de 1 hora. Se detectaron ${daysWith1h} clases fragmentadas de 1 hora.`,
          groupId: course,
          subject
        });
      }
    });
  }

  // Combine all conflicts
  const allConflicts = [
    ...teacherConflicts,
    ...groupConflicts,
    ...availabilityConflicts,
    ...blockedSlotConflicts,
    ...workloadConflicts,
    ...pedagogicalConflicts
  ];

  const errorCount = allConflicts.filter(c => c.severity === 'error').length;
  const warningCount = allConflicts.filter(c => c.severity === 'warning').length;

  const compliancePercentage = totalRequiredHours > 0
    ? Math.round((properlyAssignedHours / totalRequiredHours) * 100)
    : 100;

  return {
    valid: errorCount === 0,
    totalClasses: academicSlots.length,
    totalRequiredHours,
    assignedHours: properlyAssignedHours,
    compliancePercentage,
    
    teacherConflicts,
    groupConflicts,
    workloadConflicts,
    availabilityConflicts,
    blockedSlotConflicts,
    pedagogicalConflicts,
    allConflicts,

    metrics: {
      errorCount,
      warningCount,
      teacherConflictCount: teacherConflicts.length,
      groupConflictCount: groupConflicts.length,
      workloadConflictCount: workloadConflicts.length,
      availabilityConflictCount: availabilityConflicts.length,
      blockedSlotConflictCount: blockedSlotConflicts.length,
      pedagogicalConflictCount: pedagogicalConflicts.length,
      maxDailyConflictCount: maxDailyCount,
      consecutiveConflictCount: consecutiveCount,
      emptyHourConflictCount: emptyHourCount,
      parityBlockConflictCount: parityBlockCount,
    }
  };
}

export type GenerationResult = {
  valid: boolean;
  schedule: EngineSlot[];
  validation: ScheduleValidationResult;
  conflicts: string[];
  message: string;
};

export type CSPOptions = ValidationOptions & {
  randomize?: boolean;
  targetSwaps?: number;
};

/**
 * Applies valid stochastic swaps (2-hour paired blocks and 1-hour slots) within courses.
 * Every move is strictly verified through the single source of truth validateSchedule.
 * If a move violates ANY rule (teacher overlap, group overlap, max 2h/day,
 * non-consecutive hours, empty gaps, or Friday exit), it is immediately reverted.
 */
export function applyValidStochasticVariations(
  slots: EngineSlot[],
  validationOptions?: ValidationOptions,
  targetSwaps = 40
): { schedule: EngineSlot[], successfulMoves: number } {
  const current = slots.map(s => ({ ...s }));
  let successfulMoves = 0;

  for (let iter = 0; iter < 1500 && successfulMoves < targetSwaps; iter++) {
    const course = COURSES[Math.floor(Math.random() * COURSES.length)];
    const courseSlots = current.filter(s => s.groupId === course && !s.locked);
    if (courseSlots.length < 2) continue;

    // Mode 1: 2-hour paired block swap (70% probability)
    // Both hours of the subject move together, preserving continuity
    const pairs: { s1: EngineSlot, s2: EngineSlot }[] = [];
    for (const s of courseSlots) {
      const neighbor = courseSlots.find(n => n.day === s.day && n.subject === s.subject && n.period === s.period + 1);
      if (neighbor) {
        pairs.push({ s1: s, s2: neighbor });
      }
    }

    if (Math.random() < 0.7 && pairs.length >= 2) {
      const idxA = Math.floor(Math.random() * pairs.length);
      let idxB = Math.floor(Math.random() * pairs.length);
      if (idxA === idxB) idxB = (idxA + 1) % pairs.length;

      const pA = pairs[idxA];
      const pB = pairs[idxB];

      if (pA.s1.subject !== pB.s1.subject) {
        const d1 = pA.s1.day, per1 = pA.s1.period;
        const d2 = pA.s2.day, per2 = pA.s2.period;
        const d3 = pB.s1.day, per3 = pB.s1.period;
        const d4 = pB.s2.day, per4 = pB.s2.period;

        pA.s1.day = d3; pA.s1.period = per3;
        pA.s2.day = d4; pA.s2.period = per4;
        pB.s1.day = d1; pB.s1.period = per1;
        pB.s2.day = d2; pB.s2.period = per2;

        const val = validateSchedule(current, validationOptions);
        if (val.valid) {
          successfulMoves++;
          continue;
        } else {
          // Revert move
          pA.s1.day = d1; pA.s1.period = per1;
          pA.s2.day = d2; pA.s2.period = per2;
          pB.s1.day = d3; pB.s1.period = per3;
          pB.s2.day = d4; pB.s2.period = per4;
        }
      }
    }

    // Mode 2: 1-hour single session swap (25% probability)
    // Only swap isolated 1-hour sessions with other isolated 1-hour sessions, strictly preserving parity
    const singleSlots: EngineSlot[] = [];
    for (const s of courseSlots) {
      const sameDaySubj = courseSlots.filter(n => n.day === s.day && n.subject === s.subject);
      if (sameDaySubj.length === 1) {
        singleSlots.push(s);
      }
    }

    if (singleSlots.length >= 2) {
      const s1 = singleSlots[Math.floor(Math.random() * singleSlots.length)];
      const s2 = singleSlots[Math.floor(Math.random() * singleSlots.length)];
      if (s1 !== s2 && s1.subject !== s2.subject) {
        const d1 = s1.day, p1 = s1.period;
        const d2 = s2.day, p2 = s2.period;

        s1.day = d2; s1.period = p2;
        s2.day = d1; s2.period = p1;

        const val = validateSchedule(current, validationOptions);
        if (val.valid) {
          successfulMoves++;
        } else {
          // Revert move
          s1.day = d1; s1.period = p1;
          s2.day = d2; s2.period = p2;
        }
      }
    }
  }

  return { schedule: current, successfulMoves };
}

export function generateScheduleCSP(
  lockedSlots: EngineSlot[] = [],
  options?: CSPOptions
): GenerationResult {
  const teacherUnavailability = options?.teacherUnavailability ?? DEFAULT_TEACHER_UNAVAILABILITY;
  const blockedSlots = options?.blockedSlots ?? DEFAULT_BLOCKED_SLOTS;
  const requiredClasses = options?.requiredClasses ?? getRequiredClasses();
  const shouldRandomize = options?.randomize ?? true;
  const targetSwaps = options?.targetSwaps ?? (25 + Math.floor(Math.random() * 25));

  // 1. Build the baseline institutional pedagogical schedule (440 slots)
  // This baseline naturally fulfills:
  // - Grados 10 y 11 salen los viernes a la 1:30 p. m. (periodo 7) y de lunes a jueves a las 2:15 p. m. (periodo 8)
  // - Grados 6 a 9 salen a la 1:30 p. m. todos los días
  // - Máximo 2 horas de la misma asignatura por día
  // - Las horas dobles son consecutivas e ininterrumpidas
  // - Cero horas vacías en la jornada (excepto descanso institucional en Periodo 4)
  // - 0 cruces de docentes y 0 cruces de grupo
  const baselineSlots: EngineSlot[] = [];
  for (const course of COURSES) {
    const blocks = generateDefaultSchedule(course);
    for (const b of blocks) {
      if (b.isBreak || !b.subject) continue;
      const teacher = getTeacherForSubject(b.subject, course);
      baselineSlots.push({
        day: b.day,
        period: b.period,
        groupId: course,
        subject: b.subject,
        teacherId: teacher ? teacher.id : null,
        locked: false
      });
    }
  }

  // 2. If lockedSlots are passed, overlay them
  let finalSlots = [...baselineSlots];
  if (lockedSlots.length > 0) {
    const lockedMap = new Map<string, EngineSlot>();
    lockedSlots.forEach(s => lockedMap.set(`${s.groupId}-${s.day}-${s.period}`, { ...s, locked: true }));

    finalSlots = finalSlots.map(s => {
      const key = `${s.groupId}-${s.day}-${s.period}`;
      return lockedMap.has(key) ? lockedMap.get(key)! : s;
    });

    // Add any locked slots that may not have been in the baseline
    lockedSlots.forEach(ls => {
      const key = `${ls.groupId}-${ls.day}-${ls.period}`;
      if (!finalSlots.some(s => `${s.groupId}-${s.day}-${s.period}` === key)) {
        finalSlots.push({ ...ls, locked: true });
      }
    });
  }

  // 3. Apply stochastic CSP variations if requested, strictly preserving 100% validity
  let movesCount = 0;
  if (shouldRandomize) {
    const randomized = applyValidStochasticVariations(
      finalSlots,
      { teacherUnavailability, blockedSlots, requiredClasses },
      targetSwaps
    );
    finalSlots = randomized.schedule;
    movesCount = randomized.successfulMoves;
  }

  // 4. Centralized validation single source of truth
  const validation = validateSchedule(finalSlots, options);

  const conflictSummaries = validation.allConflicts
    .filter(c => c.severity === 'error')
    .map(c => `${c.title}: ${c.description}`);

  let message = '';
  if (validation.valid) {
    message = `¡Horario generado con éxito! ${validation.totalClasses} horas asignadas con 0 cruces de docentes, 100% de intensidad curricular, horas dobles continuas y sin huecos. Se aplicaron ${movesCount} variaciones válidas respetando todas las reglas institucionales.`;
  } else {
    message = `Horario generado con observaciones: ${conflictSummaries.length} conflicto(s) detectado(s). Revisa la pestaña "Validar".`;
  }

  return {
    valid: validation.valid,
    schedule: finalSlots,
    validation,
    conflicts: conflictSummaries,
    message
  };
}
