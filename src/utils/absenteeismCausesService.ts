import { 
  StudentRecord, 
  AttendanceSessionRecord, 
  AcademicPermissionRecord, 
  AusentismoConfig,
  StudentAbsenteeismWithCauses,
  AbsenteeismCauseStat
} from '../types';

export const CAUSE_CATEGORIES = {
  SALUD: 'Salud / Cita Médica',
  CALAMIDAD: 'Calamidad Familiar / Doméstica',
  TRAMITE: 'Diligencia Personal / Trámite',
  REPRESENTACION: 'Representación Deportiva / Institucional',
  TRANSPORTE: 'Fuerza Mayor / Transporte / Clima',
  OTRAS: 'Otras Causas Justificadas',
  INJUSTIFICADA: 'Inasistencia Injustificada (Sin Permiso)'
} as const;

export const CAUSE_COLORS: Record<string, { color: string; badgeBg: string; textColor: string; icon: string }> = {
  [CAUSE_CATEGORIES.SALUD]: {
    color: '#0284c7', // Sky 600
    badgeBg: 'bg-sky-50 border-sky-200',
    textColor: 'text-sky-800',
    icon: 'Stethoscope'
  },
  [CAUSE_CATEGORIES.CALAMIDAD]: {
    color: '#d97706', // Amber 600
    badgeBg: 'bg-amber-50 border-amber-200',
    textColor: 'text-amber-800',
    icon: 'Home'
  },
  [CAUSE_CATEGORIES.TRAMITE]: {
    color: '#7c3aed', // Purple 600
    badgeBg: 'bg-purple-50 border-purple-200',
    textColor: 'text-purple-800',
    icon: 'FileText'
  },
  [CAUSE_CATEGORIES.REPRESENTACION]: {
    color: '#059669', // Emerald 600
    badgeBg: 'bg-emerald-50 border-emerald-200',
    textColor: 'text-emerald-800',
    icon: 'Trophy'
  },
  [CAUSE_CATEGORIES.TRANSPORTE]: {
    color: '#0891b2', // Cyan 600
    badgeBg: 'bg-cyan-50 border-cyan-200',
    textColor: 'text-cyan-800',
    icon: 'Car'
  },
  [CAUSE_CATEGORIES.OTRAS]: {
    color: '#475569', // Slate 600
    badgeBg: 'bg-slate-50 border-slate-200',
    textColor: 'text-slate-800',
    icon: 'CheckCircle'
  },
  [CAUSE_CATEGORIES.INJUSTIFICADA]: {
    color: '#e11d48', // Rose 600
    badgeBg: 'bg-rose-50 border-rose-200',
    textColor: 'text-rose-800',
    icon: 'AlertTriangle'
  }
};

/**
 * Clasifica de forma inteligente el texto del motivo en una categoría institucional estándar
 */
export function categorizePermissionCause(motivo: string): string {
  if (!motivo) return CAUSE_CATEGORIES.OTRAS;
  const m = motivo.toLowerCase();

  // 1. Salud / Citas médicas
  if (
    m.includes('médic') || m.includes('medic') || m.includes('salud') || 
    m.includes('odontol') || m.includes('enferm') || m.includes('hospital') || 
    m.includes('incapacidad') || m.includes('terapia') || m.includes('optometr') || 
    m.includes('laboratorio') || m.includes('vacuna') || m.includes('psicol') || 
    m.includes('pediatr') || m.includes('urgencia') || m.includes('dolor') ||
    m.includes('fiebre') || m.includes('gripe') || m.includes('cirug')
  ) {
    return CAUSE_CATEGORIES.SALUD;
  }

  // 2. Calamidad doméstica / familiar
  if (
    m.includes('calamidad') || m.includes('familiar') || m.includes('duelo') || 
    m.includes('luto') || m.includes('fallec') || m.includes('emergencia familiar') || 
    m.includes('sepelio') || m.includes('entierro') || m.includes('doméstic') ||
    m.includes('cuidado') || m.includes('abuela') || m.includes('madre') || m.includes('padre')
  ) {
    return CAUSE_CATEGORIES.CALAMIDAD;
  }

  // 3. Trámite personal o legal
  if (
    m.includes('trámite') || m.includes('tramite') || m.includes('diligencia') || 
    m.includes('registradur') || m.includes('cédula') || m.includes('cedula') || 
    m.includes('tarjeta de identidad') || m.includes('documento') || m.includes('notar') || 
    m.includes('juzgad') || m.includes('pasaporte') || m.includes('visa') || m.includes('banc')
  ) {
    return CAUSE_CATEGORIES.TRAMITE;
  }

  // 4. Representación institucional o deportiva
  if (
    m.includes('deport') || m.includes('futbol') || m.includes('fútbol') || 
    m.includes('intercolegial') || m.includes('torneo') || m.includes('olimpiad') || 
    m.includes('concurso') || m.includes('banda') || m.includes('danza') || 
    m.includes('artístic') || m.includes('musical') || m.includes('represent') ||
    m.includes('evento institucional') || m.includes('selección')
  ) {
    return CAUSE_CATEGORIES.REPRESENTACION;
  }

  // 5. Transporte, clima o fuerza mayor
  if (
    m.includes('transporte') || m.includes('lluvia') || m.includes('vía') || 
    m.includes('derrumb') || m.includes('desplazamiento') || m.includes('inundación') || 
    m.includes('paro') || m.includes('bloqueo')
  ) {
    return CAUSE_CATEGORIES.TRANSPORTE;
  }

  return CAUSE_CATEGORIES.OTRAS;
}

/**
 * Procesa y correlaciona de manera integral las inasistencias de cada estudiante con sus Permisos Académicos
 */
export function computeAbsenteeismWithCauses(
  students: StudentRecord[],
  sessions: AttendanceSessionRecord[],
  permissions: AcademicPermissionRecord[],
  config: AusentismoConfig
): {
  studentsWithCauses: StudentAbsenteeismWithCauses[];
  causeStats: AbsenteeismCauseStat[];
  totalSessions: number;
  totalAttendances: number;
  totalAbsences: number;
  totalJustified: number;
  totalUnjustified: number;
  justifiedPercentage: number;
  unjustifiedPercentage: number;
  attendanceRate: number;
  absenteeismRate: number;
} {
  const activeStudents = students.filter(s => s.activo !== false);

  // Mapa rápido de permisos válidos: clave `${studentId}_${fecha}` y `${codigo}_${fecha}`
  const permsMap = new Map<string, AcademicPermissionRecord>();
  const studentPermsListMap = new Map<string, AcademicPermissionRecord[]>();

  permissions.forEach(p => {
    if (p.estado !== 'rechazado') {
      const keyId = `${p.studentId}_${p.fecha}`;
      const keyCode = `${p.codigo}_${p.fecha}`;
      permsMap.set(keyId, p);
      permsMap.set(keyCode, p);

      const list1 = studentPermsListMap.get(p.studentId) || [];
      list1.push(p);
      studentPermsListMap.set(p.studentId, list1);

      if (p.codigo && p.codigo !== p.studentId) {
        const list2 = studentPermsListMap.get(p.codigo) || [];
        if (!list2.some(item => item.id === p.id)) {
          list2.push(p);
          studentPermsListMap.set(p.codigo, list2);
        }
      }
    }
  });

  // Métricas acumuladas
  let totalAttendances = 0;
  let totalAbsences = 0;
  let totalJustified = 0;
  let totalUnjustified = 0;

  // Mapa de causas globales para estadísticas
  const causeCountMap = new Map<string, number>();
  Object.values(CAUSE_CATEGORIES).forEach(c => causeCountMap.set(c, 0));

  const studentsWithCauses: StudentAbsenteeismWithCauses[] = activeStudents.map(st => {
    let studentSessionsCount = 0;
    let studentAsistencias = 0;
    let studentInasistencias = 0;
    let studentJustificadas = 0;
    let studentInjustificadas = 0;

    const studentPerms = studentPermsListMap.get(st.id) || studentPermsListMap.get(st.codigo) || [];

    const detalleSesionesAusentes: StudentAbsenteeismWithCauses['detalleSesionesAusentes'] = [];
    const studentCauseCounts = new Map<string, number>();

    sessions.forEach(sess => {
      const entry = sess.registrosDetalle.find(r => r.estudianteId === st.id || r.codigo === st.codigo);
      if (!entry) return;

      studentSessionsCount++;
      if (entry.estado === 'asistio') {
        studentAsistencias++;
        totalAttendances++;
      } else {
        studentInasistencias++;
        totalAbsences++;

        // Verificar si para esta fecha y estudiante existe un Permiso Académico registrado
        const perm = permsMap.get(`${st.id}_${sess.fecha}`) || permsMap.get(`${st.codigo}_${sess.fecha}`);
        const tienePermiso = Boolean(perm);

        if (tienePermiso && perm) {
          studentJustificadas++;
          totalJustified++;

          const cat = categorizePermissionCause(perm.motivo);
          studentCauseCounts.set(cat, (studentCauseCounts.get(cat) || 0) + 1);
          causeCountMap.set(cat, (causeCountMap.get(cat) || 0) + 1);
        } else {
          studentInjustificadas++;
          totalUnjustified++;
          causeCountMap.set(CAUSE_CATEGORIES.INJUSTIFICADA, (causeCountMap.get(CAUSE_CATEGORIES.INJUSTIFICADA) || 0) + 1);
        }

        detalleSesionesAusentes.push({
          sesionId: sess.id,
          fecha: sess.fecha,
          asignatura: sess.asignaturaNombre || sess.asignaturaId || 'Clase regular',
          docenteNombre: sess.docenteNombre,
          tienePermiso,
          permiso: perm
        });
      }
    });

    // Añadir causas de permisos adicionales del estudiante en el periodo si no coincidieron con una sesión registrada
    studentPerms.forEach(p => {
      const alreadyCountedInSession = detalleSesionesAusentes.some(d => d.fecha === p.fecha && d.tienePermiso);
      if (!alreadyCountedInSession) {
        const cat = categorizePermissionCause(p.motivo);
        studentCauseCounts.set(cat, (studentCauseCounts.get(cat) || 0) + 1);
      }
    });

    const pctAusentismo = studentSessionsCount > 0 ? Number(((studentInasistencias / studentSessionsCount) * 100).toFixed(1)) : 0;
    const pctAsistencia = studentSessionsCount > 0 ? Number(((studentAsistencias / studentSessionsCount) * 100).toFixed(1)) : 100;
    const pctJustificado = studentInasistencias > 0 ? Number(((studentJustificadas / studentInasistencias) * 100).toFixed(1)) : (studentPerms.length > 0 ? 100 : 0);

    let alertaNivel: 'verde' | 'amarillo' | 'rojo' = 'verde';
    if (pctAusentismo >= config.umbralRojo) {
      alertaNivel = 'rojo';
    } else if (pctAusentismo >= config.umbralVerde) {
      alertaNivel = 'amarillo';
    }

    const causasPrincipales = Array.from(studentCauseCounts.entries())
      .map(([causa, count]) => ({ causa, count }))
      .sort((a, b) => b.count - a.count);

    return {
      student: st,
      sesionesRegistradas: studentSessionsCount,
      asistencias: studentAsistencias,
      inasistencias: studentInasistencias,
      inasistenciasJustificadas: studentJustificadas,
      inasistenciasInjustificadas: studentInjustificadas,
      porcentajeAusentismo: pctAusentismo,
      porcentajeAsistencia: pctAsistencia,
      porcentajeJustificado: pctJustificado,
      alertaNivel,
      permisos: studentPerms,
      causasPrincipales,
      detalleSesionesAusentes: detalleSesionesAusentes.sort((a, b) => b.fecha.localeCompare(a.fecha))
    };
  });

  // Ordenar el ranking general de estudiantes por mayor número de inasistencias
  studentsWithCauses.sort((a, b) => {
    if (b.inasistencias !== a.inasistencias) {
      return b.inasistencias - a.inasistencias;
    }
    if (b.inasistenciasInjustificadas !== a.inasistenciasInjustificadas) {
      return b.inasistenciasInjustificadas - a.inasistenciasInjustificadas;
    }
    return a.student.apellidos.localeCompare(b.student.apellidos, 'es', { sensitivity: 'base' });
  });

  // Construir estadísticas de causas globales
  const totalReportedCauses = totalAbsences > 0 ? totalAbsences : 1;
  const causeStats: AbsenteeismCauseStat[] = Array.from(causeCountMap.entries())
    .map(([categoria, count]) => {
      const configStyle = CAUSE_COLORS[categoria] || CAUSE_COLORS[CAUSE_CATEGORIES.OTRAS];
      const porcentaje = Number(((count / totalReportedCauses) * 100).toFixed(1));
      return {
        categoria,
        count,
        porcentaje,
        color: configStyle.color,
        badgeBg: configStyle.badgeBg,
        textColor: configStyle.textColor,
        iconName: configStyle.icon
      };
    })
    .filter(item => item.count > 0 || item.categoria === CAUSE_CATEGORIES.INJUSTIFICADA)
    .sort((a, b) => b.count - a.count);

  const totalEvaluated = totalAttendances + totalAbsences;
  const justifiedPercentage = totalAbsences > 0 ? Number(((totalJustified / totalAbsences) * 100).toFixed(1)) : 0;
  const unjustifiedPercentage = totalAbsences > 0 ? Number(((totalUnjustified / totalAbsences) * 100).toFixed(1)) : 0;
  const attendanceRate = totalEvaluated > 0 ? Number(((totalAttendances / totalEvaluated) * 100).toFixed(1)) : 100;
  const absenteeismRate = totalEvaluated > 0 ? Number(((totalAbsences / totalEvaluated) * 100).toFixed(1)) : 0;

  return {
    studentsWithCauses,
    causeStats,
    totalSessions: sessions.length,
    totalAttendances,
    totalAbsences,
    totalJustified,
    totalUnjustified,
    justifiedPercentage,
    unjustifiedPercentage,
    attendanceRate,
    absenteeismRate
  };
}
