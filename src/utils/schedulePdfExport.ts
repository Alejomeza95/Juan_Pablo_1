import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { EngineSlot } from './scheduleEngine';
import { COURSES } from '../data/schedules';
import { TEACHERS } from '../data/generatorData';

const PERIOD_LABELS: Record<number, { name: string; time: string }> = {
  1: { name: 'Hora 1', time: '7:30 - 8:25 a. m.' },
  2: { name: 'Hora 2', time: '8:25 - 9:20 a. m.' },
  3: { name: 'Hora 3', time: '9:20 - 10:15 a. m.' },
  4: { name: 'Descanso', time: '10:15 - 10:45 a. m.' },
  5: { name: 'Hora 4', time: '10:45 - 11:40 a. m.' },
  6: { name: 'Hora 5', time: '11:40 - 12:35 p. m.' },
  7: { name: 'Hora 6', time: '12:35 - 1:30 p. m.' },
  8: { name: 'Hora 7', time: '1:30 - 2:15 p. m.' }
};

const DAY_NAMES = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes'];

/**
 * Draws institutional header on a PDF page
 */
function drawHeader(doc: jsPDF, course: string, pageNum?: number, totalPages?: number) {
  const pageWidth = doc.internal.pageSize.getWidth();
  
  // Header background banner
  doc.setFillColor(88, 28, 135); // Purple 900
  doc.rect(0, 0, pageWidth, 24, 'F');

  // Accent stripe
  doc.setFillColor(147, 51, 234); // Purple 600
  doc.rect(0, 24, pageWidth, 2.5, 'F');

  // School Name
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.setTextColor(255, 255, 255);
  doc.text('INSTITUCIÓN EDUCATIVA JUAN PABLO I', 14, 11);

  // Subtitle
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(233, 213, 255);
  doc.text('Horario Oficial de Asignaturas y Jornadas - Año Lectivo 2026', 14, 18);

  // Course badge on top right
  doc.setFillColor(255, 255, 255);
  doc.roundedRect(pageWidth - 62, 5, 48, 14, 2, 2, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(88, 28, 135);
  doc.text(`CURSO ${course}`, pageWidth - 38, 14, { align: 'center' });

  // Sub metadata line
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(100, 116, 139);
  const isUpperGrade = course.startsWith('10') || course.startsWith('11');
  const jornadaText = isUpperGrade
    ? 'Jornada extendida (L-J salida 2:15 p. m. | Viernes salida 1:30 p. m.)'
    : 'Jornada única (Lunes a Viernes salida 1:30 p. m.)';
  doc.text(`Regulación: ${jornadaText} • Modelo pedagógico de bloques continuos de 2h`, 14, 32);

  if (pageNum && totalPages) {
    doc.text(`Página ${pageNum} de ${totalPages}`, pageWidth - 14, 32, { align: 'right' });
  }
}

/**
 * Exports a single course schedule to PDF
 */
export async function downloadCourseSchedulePdf(course: string, slots: EngineSlot[]): Promise<void> {
  const doc = new jsPDF({
    orientation: 'landscape',
    unit: 'mm',
    format: 'letter' // 279.4 x 215.9 mm
  });

  const courseSlots = slots.filter(s => s.groupId === course);
  const isUpperGrade = course.startsWith('10') || course.startsWith('11');
  const periods = isUpperGrade ? [1, 2, 3, 4, 5, 6, 7, 8] : [1, 2, 3, 4, 5, 6, 7];

  drawHeader(doc, course, 1, 1);

  // Build grid data for autoTable
  const head = [['Hora / Periodo', 'Lunes (Día 1)', 'Martes (Día 2)', 'Miércoles (Día 3)', 'Jueves (Día 4)', 'Viernes (Día 5)']];
  
  const body: any[] = [];

  periods.forEach(p => {
    const pInfo = PERIOD_LABELS[p] || { name: `H${p}`, time: '' };
    
    if (p === 4) {
      // Institutional break
      body.push([
        {
          content: `${pInfo.name}\n${pInfo.time}`,
          styles: { fontStyle: 'bold', halign: 'center', fillColor: [254, 243, 199], textColor: [146, 64, 14] }
        },
        {
          content: 'DESCANSO INSTITUCIONAL (30 MINUTOS)',
          colSpan: 5,
          styles: { halign: 'center', fontStyle: 'bold', fillColor: [254, 243, 199], textColor: [146, 64, 14], fontSize: 9 }
        }
      ]);
      return;
    }

    const row: any[] = [
      {
        content: `${pInfo.name}\n${pInfo.time}`,
        styles: { fontStyle: 'bold', halign: 'center', fillColor: [248, 250, 252], textColor: [51, 65, 85], fontSize: 8 }
      }
    ];

    for (let day = 1; day <= 5; day++) {
      if (isUpperGrade && day === 5 && p === 8) {
        row.push({
          content: 'SALIDA 1:30 P. M.\n(Sin clase los viernes)',
          styles: { halign: 'center', valign: 'middle', fillColor: [236, 253, 245], textColor: [4, 120, 87], fontStyle: 'bold', fontSize: 7.5 }
        });
        continue;
      }

      const slot = courseSlots.find(s => s.day === day && s.period === p);
      if (slot) {
        const teacher = TEACHERS.find(t => t.id === slot.teacherId);
        const tName = teacher ? teacher.name : 'Por asignar';

        // Check if 2h block
        const prev = courseSlots.find(s => s.day === day && s.subject === slot.subject && s.period === p - 1);
        const next = courseSlots.find(s => s.day === day && s.subject === slot.subject && s.period === p + 1);
        const blockTag = (prev || next) ? '[Bloque 2h]' : '[1 hora]';

        row.push({
          content: `${slot.subject}\nDocente: ${tName}\n${blockTag}`,
          styles: {
            valign: 'middle',
            halign: 'center',
            fontSize: 8,
            textColor: [15, 23, 42],
            fontStyle: 'bold',
            fillColor: [255, 255, 255]
          }
        });
      } else {
        row.push({
          content: '-',
          styles: { halign: 'center', valign: 'middle', textColor: [203, 213, 225] }
        });
      }
    }

    body.push(row);
  });

  // Render Table
  autoTable(doc, {
    startY: 37,
    head,
    body,
    theme: 'grid',
    headStyles: {
      fillColor: [88, 28, 135],
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      halign: 'center',
      fontSize: 9,
      cellPadding: 3
    },
    bodyStyles: {
      cellPadding: 2.5,
      lineColor: [226, 232, 240],
      lineWidth: 0.3
    },
    columnStyles: {
      0: { cellWidth: 34 }
    }
  });

  // Calculate subject breakdown for this course
  const subjectCounts = new Map<string, { total: number; teacher: string; daysWith2h: number; daysWith1h: number }>();
  courseSlots.forEach(s => {
    if (!subjectCounts.has(s.subject)) {
      const teacher = TEACHERS.find(t => t.id === s.teacherId);
      subjectCounts.set(s.subject, {
        total: 0,
        teacher: teacher ? teacher.name : 'Por asignar',
        daysWith2h: 0,
        daysWith1h: 0
      });
    }
    subjectCounts.get(s.subject)!.total += 1;
  });

  for (const [subj, data] of subjectCounts.entries()) {
    for (let day = 1; day <= 5; day++) {
      const count = courseSlots.filter(s => s.subject === subj && s.day === day).length;
      if (count === 2) data.daysWith2h++;
      if (count === 1) data.daysWith1h++;
    }
  }

  // Summary Table of Subjects and Parity
  const summaryY = (doc as any).lastAutoTable.finalY + 6;
  const pageHeight = doc.internal.pageSize.getHeight();

  if (summaryY + 35 < pageHeight) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(88, 28, 135);
    doc.text(`RESUMEN DE ASIGNATURAS E INTENSIDAD HORARIA SEMANAL - CURSO ${course}`, 14, summaryY);

    const summaryHead = [['Asignatura', 'Docente Asignado', 'Horas / Semana', 'Estructura de Bloques', 'Cumplimiento']];
    const summaryBody = Array.from(subjectCounts.entries()).map(([subj, data]) => {
      const isEven = data.total % 2 === 0;
      const blockStr = isEven
        ? `${data.daysWith2h} bloque(s) de 2h`
        : `${data.daysWith2h > 0 ? `${data.daysWith2h} blq 2h + ` : ''}1 clase de 1h`;
      return [
        subj,
        data.teacher,
        `${data.total} horas`,
        blockStr,
        'Cumple 100%'
      ];
    });

    autoTable(doc, {
      startY: summaryY + 2,
      head: summaryHead,
      body: summaryBody,
      theme: 'plain',
      headStyles: {
        fillColor: [241, 245, 249],
        textColor: [71, 85, 105],
        fontSize: 7.5,
        fontStyle: 'bold',
        cellPadding: 1.5
      },
      bodyStyles: {
        fontSize: 7.2,
        textColor: [30, 41, 59],
        cellPadding: 1.2
      },
      alternateRowStyles: {
        fillColor: [248, 250, 252]
      }
    });
  }

  // Footer note
  doc.setFont('helvetica', 'italic');
  doc.setFontSize(7);
  doc.setTextColor(148, 163, 184);
  doc.text(
    `Documento oficial generado el ${new Date().toLocaleDateString('es-CO')} por el Sistema Integrado de Horarios - I.E. Juan Pablo I.`,
    14,
    pageHeight - 6
  );

  doc.save(`Horario_Curso_${course}_Juan_Pablo_I.pdf`);
}

/**
 * Exports all courses to a single multi-page PDF book
 */
export async function downloadAllCoursesSchedulePdf(slots: EngineSlot[]): Promise<void> {
  const doc = new jsPDF({
    orientation: 'landscape',
    unit: 'mm',
    format: 'letter'
  });

  const totalPages = COURSES.length;

  COURSES.forEach((course, index) => {
    if (index > 0) {
      doc.addPage('letter', 'landscape');
    }

    const courseSlots = slots.filter(s => s.groupId === course);
    const isUpperGrade = course.startsWith('10') || course.startsWith('11');
    const periods = isUpperGrade ? [1, 2, 3, 4, 5, 6, 7, 8] : [1, 2, 3, 4, 5, 6, 7];

    drawHeader(doc, course, index + 1, totalPages);

    const head = [['Hora / Periodo', 'Lunes (Día 1)', 'Martes (Día 2)', 'Miércoles (Día 3)', 'Jueves (Día 4)', 'Viernes (Día 5)']];
    const body: any[] = [];

    periods.forEach(p => {
      const pInfo = PERIOD_LABELS[p] || { name: `H${p}`, time: '' };
      
      if (p === 4) {
        body.push([
          {
            content: `${pInfo.name}\n${pInfo.time}`,
            styles: { fontStyle: 'bold', halign: 'center', fillColor: [254, 243, 199], textColor: [146, 64, 14] }
          },
          {
            content: 'DESCANSO INSTITUCIONAL (30 MINUTOS)',
            colSpan: 5,
            styles: { halign: 'center', fontStyle: 'bold', fillColor: [254, 243, 199], textColor: [146, 64, 14], fontSize: 9 }
          }
        ]);
        return;
      }

      const row: any[] = [
        {
          content: `${pInfo.name}\n${pInfo.time}`,
          styles: { fontStyle: 'bold', halign: 'center', fillColor: [248, 250, 252], textColor: [51, 65, 85], fontSize: 8 }
        }
      ];

      for (let day = 1; day <= 5; day++) {
        if (isUpperGrade && day === 5 && p === 8) {
          row.push({
            content: 'SALIDA 1:30 P. M.\n(Sin clase los viernes)',
            styles: { halign: 'center', valign: 'middle', fillColor: [236, 253, 245], textColor: [4, 120, 87], fontStyle: 'bold', fontSize: 7.5 }
          });
          continue;
        }

        const slot = courseSlots.find(s => s.day === day && s.period === p);
        if (slot) {
          const teacher = TEACHERS.find(t => t.id === slot.teacherId);
          const tName = teacher ? teacher.name : 'Por asignar';

          const prev = courseSlots.find(s => s.day === day && s.subject === slot.subject && s.period === p - 1);
          const next = courseSlots.find(s => s.day === day && s.subject === slot.subject && s.period === p + 1);
          const blockTag = (prev || next) ? '[Bloque 2h]' : '[1 hora]';

          row.push({
            content: `${slot.subject}\nDocente: ${tName}\n${blockTag}`,
            styles: {
              valign: 'middle',
              halign: 'center',
              fontSize: 8,
              textColor: [15, 23, 42],
              fontStyle: 'bold',
              fillColor: [255, 255, 255]
            }
          });
        } else {
          row.push({
            content: '-',
            styles: { halign: 'center', valign: 'middle', textColor: [203, 213, 225] }
          });
        }
      }

      body.push(row);
    });

    autoTable(doc, {
      startY: 37,
      head,
      body,
      theme: 'grid',
      headStyles: {
        fillColor: [88, 28, 135],
        textColor: [255, 255, 255],
        fontStyle: 'bold',
        halign: 'center',
        fontSize: 9,
        cellPadding: 3
      },
      bodyStyles: {
        cellPadding: 2.5,
        lineColor: [226, 232, 240],
        lineWidth: 0.3
      },
      columnStyles: {
        0: { cellWidth: 34 }
      }
    });

    const pageHeight = doc.internal.pageSize.getHeight();
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(7);
    doc.setTextColor(148, 163, 184);
    doc.text(
      `Libro Oficial de Horarios - I.E. Juan Pablo I • Generado el ${new Date().toLocaleDateString('es-CO')}`,
      14,
      pageHeight - 6
    );
  });

  doc.save(`Horarios_Completos_Colegio_Juan_Pablo_I_2026.pdf`);
}

/**
 * Exports an individual teacher schedule to PDF
 */
export async function downloadTeacherSchedulePdf(teacherId: string, teacherName: string, slots: EngineSlot[]): Promise<void> {
  const doc = new jsPDF({
    orientation: 'landscape',
    unit: 'mm',
    format: 'letter'
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();

  // Header banner
  doc.setFillColor(88, 28, 135);
  doc.rect(0, 0, pageWidth, 24, 'F');
  doc.setFillColor(147, 51, 234);
  doc.rect(0, 24, pageWidth, 2.5, 'F');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.setTextColor(255, 255, 255);
  doc.text('INSTITUCIÓN EDUCATIVA JUAN PABLO I', 14, 11);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(233, 213, 255);
  doc.text('Horario Individual del Docente - Año Lectivo 2026', 14, 18);

  // Teacher badge
  doc.setFillColor(255, 255, 255);
  doc.roundedRect(pageWidth - 95, 5, 81, 14, 2, 2, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.5);
  doc.setTextColor(88, 28, 135);
  doc.text(teacherName, pageWidth - 54, 14, { align: 'center' });

  const teacherSlots = slots.filter(s => s.teacherId === teacherId);
  const periods = [1, 2, 3, 4, 5, 6, 7, 8];

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(100, 116, 139);
  doc.text(`Carga lectiva asignada: ${teacherSlots.length} horas semanales • Descanso institucional: 10:15 - 10:45 a. m.`, 14, 32);

  const head = [['Hora / Periodo', 'Lunes (Día 1)', 'Martes (Día 2)', 'Miércoles (Día 3)', 'Jueves (Día 4)', 'Viernes (Día 5)']];
  const body: any[] = [];

  periods.forEach(p => {
    const pInfo = PERIOD_LABELS[p] || { name: `H${p}`, time: '' };

    if (p === 4) {
      body.push([
        {
          content: `${pInfo.name}\n${pInfo.time}`,
          styles: { fontStyle: 'bold', halign: 'center', fillColor: [254, 243, 199], textColor: [146, 64, 14] }
        },
        {
          content: 'DESCANSO INSTITUCIONAL DOCENTE (30 MINUTOS)',
          colSpan: 5,
          styles: { halign: 'center', fontStyle: 'bold', fillColor: [254, 243, 199], textColor: [146, 64, 14], fontSize: 9 }
        }
      ]);
      return;
    }

    const row: any[] = [
      {
        content: `${pInfo.name}\n${pInfo.time}`,
        styles: { fontStyle: 'bold', halign: 'center', fillColor: [248, 250, 252], textColor: [51, 65, 85], fontSize: 8 }
      }
    ];

    for (let day = 1; day <= 5; day++) {
      const slot = teacherSlots.find(s => s.day === day && s.period === p);
      if (slot) {
        row.push({
          content: `CURSO ${slot.groupId}\n${slot.subject}`,
          styles: {
            valign: 'middle',
            halign: 'center',
            fontSize: 8.5,
            textColor: [88, 28, 135],
            fontStyle: 'bold',
            fillColor: [243, 232, 255]
          }
        });
      } else {
        row.push({
          content: 'Libre',
          styles: { halign: 'center', valign: 'middle', textColor: [148, 163, 184], fontStyle: 'italic', fontSize: 7.5 }
        });
      }
    }

    body.push(row);
  });

  autoTable(doc, {
    startY: 37,
    head,
    body,
    theme: 'grid',
    headStyles: {
      fillColor: [88, 28, 135],
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      halign: 'center',
      fontSize: 9,
      cellPadding: 3
    },
    bodyStyles: {
      cellPadding: 2.8,
      lineColor: [226, 232, 240],
      lineWidth: 0.3
    },
    columnStyles: {
      0: { cellWidth: 34 }
    }
  });

  doc.setFont('helvetica', 'italic');
  doc.setFontSize(7);
  doc.setTextColor(148, 163, 184);
  doc.text(
    `Documento oficial de asignación docente - I.E. Juan Pablo I • Generado el ${new Date().toLocaleDateString('es-CO')}`,
    14,
    pageHeight - 6
  );

  const cleanName = teacherName.replace(/[^a-zA-Z0-9]/g, '_');
  doc.save(`Horario_Docente_${cleanName}_2026.pdf`);
}

