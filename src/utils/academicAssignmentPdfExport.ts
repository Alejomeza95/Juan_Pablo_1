import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { 
  TeacherRecord, 
  SchoolGroupRecord, 
  TeachingAssignmentRecord 
} from '../types';

/**
 * Loads an image from a URL and converts it to base64 DataURL
 */
async function getBase64ImageFromUrl(imageUrl: string): Promise<string | null> {
  if (typeof window === 'undefined') return null;
  try {
    const res = await fetch(imageUrl);
    const blob = await res.blob();
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        resolve(reader.result as string);
      };
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(blob);
    });
  } catch (e) {
    console.warn('Could not load logo for PDF export:', e);
    return null;
  }
}

/**
 * Helper to format current date in Spanish
 */
function getFormattedDate(): string {
  const now = new Date();
  const months = [
    'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
    'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'
  ];
  return `${now.getDate()} de ${months[now.getMonth()]} de ${now.getFullYear()}`;
}

export interface FullPdfExportOptions {
  teachers: TeacherRecord[];
  groups: SchoolGroupRecord[];
  assignments: TeachingAssignmentRecord[];
  maxWeeklyHours?: number;
  schoolYear?: number;
  issuedBy?: string;
}

export interface SingleTeacherPdfExportOptions {
  teacher: TeacherRecord;
  groups: SchoolGroupRecord[];
  assignments: TeachingAssignmentRecord[];
  maxWeeklyHours?: number;
  schoolYear?: number;
  issuedBy?: string;
}

/**
 * Generates and downloads the Complete Consolidated Academic Assignment PDF
 */
export async function downloadFullAcademicAssignmentPdf(options: FullPdfExportOptions): Promise<void> {
  const {
    teachers,
    groups,
    assignments,
    maxWeeklyHours = 24,
    schoolYear = new Date().getFullYear(),
    issuedBy = 'Administración Institucional'
  } = options;

  // Initialize jsPDF in landscape format for wide consolidated tables
  const doc = new jsPDF({
    orientation: 'landscape',
    unit: 'mm',
    format: 'letter' // 279.4 x 215.9 mm
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const logoBase64 = await getBase64ImageFromUrl('/JUANI.png');

  // Colors
  const purpleDark: [number, number, number] = [76, 29, 149]; // Purple 900
  const goldAccent: [number, number, number] = [217, 119, 6]; // Amber 600
  const slateText: [number, number, number] = [30, 41, 59]; // Slate 800
  const slateMuted: [number, number, number] = [100, 116, 139]; // Slate 500

  // Header Banner
  doc.setFillColor(248, 250, 252);
  doc.rect(0, 0, pageWidth, 36, 'F');

  // Decorative top stripes
  doc.setFillColor(...purpleDark);
  doc.rect(0, 0, pageWidth, 3.5, 'F');
  doc.setFillColor(...goldAccent);
  doc.rect(0, 3.5, pageWidth, 1, 'F');

  // Logo
  let textStartX = 14;
  if (logoBase64) {
    try {
      doc.addImage(logoBase64, 'PNG', 14, 6.5, 22, 22);
      textStartX = 40;
    } catch {
      textStartX = 14;
    }
  }

  // Titles
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.setTextColor(...purpleDark);
  doc.text('INSTITUCIÓN EDUCATIVA JUAN PABLO I', textStartX, 13);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.5);
  doc.setTextColor(...slateText);
  doc.text(`CONSOLIDADO OFICIAL DE ASIGNACIÓN ACADÉMICA Y CARGA DOCENTE - AÑO LECTIVO ${schoolYear}`, textStartX, 19);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(...slateMuted);
  doc.text('Municipio de La Llanada, Departamento de Nariño • Código DANE y Registro Secretaría de Educación', textStartX, 24);
  doc.text(`Fecha de expedición: ${getFormattedDate()} • Expedido por: ${issuedBy}`, textStartX, 28.5);

  // Top right badge
  doc.setFillColor(...purpleDark);
  doc.roundedRect(pageWidth - 62, 7, 48, 18, 2, 2, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(255, 255, 255);
  doc.text('PLANTA DOCENTE', pageWidth - 38, 13.5, { align: 'center' });
  doc.setFontSize(10.5);
  doc.text(`${teachers.length} DOCENTES`, pageWidth - 38, 20.5, { align: 'center' });

  // Summary Metrics Bar
  const totalWeeklyHours = assignments.reduce((acc, curr) => acc + (Number(curr.weeklyHours) || 0), 0);
  const activeTeachersCount = teachers.filter(t => t.status === 'activo').length;
  const groupsMap = new Map<string, SchoolGroupRecord>(groups.map(g => [g.id, g]));

  const metricsY = 38;
  doc.setFillColor(241, 245, 249);
  doc.roundedRect(14, metricsY, pageWidth - 28, 9, 1.5, 1.5, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(...slateText);

  doc.text(`• Docentes Activos: ${activeTeachersCount} de ${teachers.length}`, 18, metricsY + 6);
  doc.text(`• Total Horas Asignadas: ${totalWeeklyHours} hrs / sem`, 80, metricsY + 6);
  doc.text(`• Total Grupos Atendidos: ${groups.length} cursos`, 150, metricsY + 6);
  doc.text(`• Carga Máx. Sugerida: ${maxWeeklyHours} hrs / sem`, 215, metricsY + 6);

  // Prepare table data
  const head = [
    ['N°', 'CÓDIGO', 'DOCENTE', 'ASIGNATURAS ORIENTADAS', 'GRADOS / GRUPOS Y HORAS', 'TOTAL HORAS', 'ESTADO']
  ];

  // Sort teachers alphabetically
  const sortedTeachers = [...teachers].sort((a, b) => a.fullName.localeCompare(b.fullName, 'es', { sensitivity: 'base' }));

  const body = sortedTeachers.map((t, index) => {
    const teacherAssignments = assignments.filter(a => a.teacherId === t.id);
    const subjects = Array.from(new Set(teacherAssignments.map(a => a.subjectName))).filter(Boolean);
    
    // Group breakdown: e.g. 6°A (4h), 6°B (4h), 9°A (2h)
    const groupBreakdowns = teacherAssignments.map(a => {
      const groupObj = groupsMap.get(a.groupId);
      const groupLabel = groupObj?.displayName || a.groupId;
      return `${groupLabel} (${a.weeklyHours}h)`;
    });

    const totalHours = teacherAssignments.reduce((acc, curr) => acc + (Number(curr.weeklyHours) || 0), 0);
    const isOverloaded = totalHours > maxWeeklyHours;

    return [
      String(index + 1),
      t.internalCode || `DOC-${String(index + 1).padStart(2, '0')}`,
      t.fullName,
      subjects.length > 0 ? subjects.join(', ') : 'Sin asignaturas',
      groupBreakdowns.length > 0 ? groupBreakdowns.join(' • ') : 'Sin grupos asignados',
      `${totalHours} hrs/sem${isOverloaded ? ' (!)' : ''}`,
      t.status === 'activo' ? 'Activo' : 'Inactivo'
    ];
  });

  // Render Table
  autoTable(doc, {
    head,
    body,
    startY: 50,
    margin: { left: 14, right: 14, bottom: 25 },
    styles: {
      fontSize: 7.5,
      cellPadding: 2.5,
      textColor: [30, 41, 59],
      valign: 'middle',
      lineColor: [226, 232, 240],
      lineWidth: 0.1
    },
    headStyles: {
      fillColor: [76, 29, 149],
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      halign: 'center'
    },
    columnStyles: {
      0: { cellWidth: 10, halign: 'center' },
      1: { cellWidth: 18, halign: 'center', fontStyle: 'bold' },
      2: { cellWidth: 55, fontStyle: 'bold' },
      3: { cellWidth: 55 },
      4: { cellWidth: 'auto' },
      5: { cellWidth: 24, halign: 'center', fontStyle: 'bold' },
      6: { cellWidth: 18, halign: 'center' }
    },
    alternateRowStyles: {
      fillColor: [248, 250, 252]
    },
    didParseCell: (data) => {
      if (data.section === 'body') {
        // Highlight status column
        if (data.column.index === 6) {
          const val = data.cell.raw as string;
          if (val === 'Activo') {
            data.cell.styles.textColor = [16, 120, 70];
            data.cell.styles.fontStyle = 'bold';
          } else {
            data.cell.styles.textColor = [150, 150, 150];
          }
        }
        // Highlight overloaded hours
        if (data.column.index === 5) {
          const val = data.cell.raw as string;
          if (val.includes('(!)')) {
            data.cell.styles.textColor = [185, 28, 28]; // red
          } else {
            data.cell.styles.textColor = [76, 29, 149];
          }
        }
      }
    },
    didDrawPage: (data) => {
      // Footer on every page
      const pageCount = (doc.internal as any).getNumberOfPages();
      const currentPage = data.pageNumber;

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7.5);
      doc.setTextColor(...slateMuted);
      doc.text(
        `Institución Educativa Juan Pablo I • Asignación Académica ${schoolYear} • Documento Oficial Institucional`,
        14,
        pageHeight - 8
      );
      doc.text(
        `Página ${currentPage} de ${pageCount}`,
        pageWidth - 14,
        pageHeight - 8,
        { align: 'right' }
      );
    }
  });

  // Signatures on last page
  const finalY = (doc as any).lastAutoTable?.finalY || 160;
  let signatureY = finalY + 14;

  // If near bottom of page, add a new page for signatures
  if (signatureY > pageHeight - 35) {
    doc.addPage();
    signatureY = 30;
  }

  // Draw Signatures section
  const colWidth = 70;
  const sig1X = 30;
  const sig2X = pageWidth - 30 - colWidth;

  doc.setDrawColor(148, 163, 184);
  doc.setLineWidth(0.4);

  // Line 1: Rector(a)
  doc.line(sig1X, signatureY, sig1X + colWidth, signatureY);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(...slateText);
  doc.text('RECTORÍA INSTITUCIONAL', sig1X + colWidth / 2, signatureY + 4.5, { align: 'center' });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(...slateMuted);
  doc.text('Institución Educativa Juan Pablo I', sig1X + colWidth / 2, signatureY + 8, { align: 'center' });

  // Line 2: Coordinador Académico
  doc.line(sig2X, signatureY, sig2X + colWidth, signatureY);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(...slateText);
  doc.text('COORDINACIÓN ACADÉMICA', sig2X + colWidth / 2, signatureY + 4.5, { align: 'center' });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(...slateMuted);
  doc.text('Validación y Distribución Horaria', sig2X + colWidth / 2, signatureY + 8, { align: 'center' });

  // Save the PDF
  const safeFilename = `Asignacion_Academica_Completa_Juan_Pablo_I_${schoolYear}.pdf`;
  doc.save(safeFilename);
}

/**
 * Generates and downloads the Official Individual Academic Assignment PDF for a specific teacher
 */
export async function downloadTeacherAssignmentPdf(options: SingleTeacherPdfExportOptions): Promise<void> {
  const {
    teacher,
    groups,
    assignments,
    maxWeeklyHours = 24,
    schoolYear = new Date().getFullYear(),
    issuedBy = 'Rectoría / Coordinación Académica'
  } = options;

  // Initialize jsPDF in portrait format for official individual certificate act
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'letter' // 215.9 x 279.4 mm
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const logoBase64 = await getBase64ImageFromUrl('/JUANI.png');

  // Colors
  const purpleDark: [number, number, number] = [76, 29, 149]; // Purple 900
  const purpleMain: [number, number, number] = [124, 58, 237]; // Purple 600
  const goldAccent: [number, number, number] = [217, 119, 6]; // Amber 600
  const slateText: [number, number, number] = [30, 41, 59]; // Slate 800
  const slateMuted: [number, number, number] = [100, 116, 139]; // Slate 500

  // Header Banner
  doc.setFillColor(248, 250, 252);
  doc.rect(0, 0, pageWidth, 42, 'F');

  // Decorative top stripes
  doc.setFillColor(...purpleDark);
  doc.rect(0, 0, pageWidth, 4, 'F');
  doc.setFillColor(...goldAccent);
  doc.rect(0, 4, pageWidth, 1.2, 'F');

  // Logo
  let textStartX = 14;
  if (logoBase64) {
    try {
      doc.addImage(logoBase64, 'PNG', 14, 8, 25, 25);
      textStartX = 44;
    } catch {
      textStartX = 14;
    }
  }

  // Titles
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.setTextColor(...purpleDark);
  doc.text('INSTITUCIÓN EDUCATIVA JUAN PABLO I', textStartX, 15);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(...slateText);
  doc.text('ACTA OFICIAL DE ASIGNACIÓN ACADÉMICA INDIVIDUAL', textStartX, 21);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(...slateMuted);
  doc.text(`Municipio de La Llanada, Nariño • Vigencia del Año Escolar ${schoolYear}`, textStartX, 26.5);
  doc.text(`Fecha de expedición: ${getFormattedDate()}`, textStartX, 31);

  // Status badge on top right
  doc.setFillColor(...purpleDark);
  doc.roundedRect(pageWidth - 52, 9, 38, 16, 2, 2, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(255, 255, 255);
  doc.text('AÑO ESCOLAR', pageWidth - 33, 14.5, { align: 'center' });
  doc.setFontSize(11);
  doc.text(`${schoolYear}`, pageWidth - 33, 21.5, { align: 'center' });

  // Teacher Info Card Box
  const teacherAssignments = assignments.filter(a => a.teacherId === teacher.id);
  const totalHours = teacherAssignments.reduce((acc, curr) => acc + (Number(curr.weeklyHours) || 0), 0);
  const isOverloaded = totalHours > maxWeeklyHours;
  const groupsMap = new Map<string, SchoolGroupRecord>(groups.map(g => [g.id, g]));

  const cardY = 46;
  doc.setFillColor(255, 255, 255);
  doc.setDrawColor(203, 213, 225);
  doc.setLineWidth(0.4);
  doc.roundedRect(14, cardY, pageWidth - 28, 30, 2, 2, 'FD');

  // Left accent border on card
  doc.setFillColor(...purpleMain);
  doc.roundedRect(14, cardY, 3, 30, 1, 1, 'F');

  // Card Content
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(...slateMuted);
  doc.text('DATOS DEL DOCENTE:', 21, cardY + 6.5);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.setTextColor(...purpleDark);
  doc.text(teacher.fullName.toUpperCase(), 21, cardY + 13);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(...slateText);
  doc.text(`Código interno institucional: `, 21, cardY + 19);
  doc.setFont('helvetica', 'bold');
  doc.text(teacher.internalCode || 'DOC-S/C', 63, cardY + 19);

  doc.setFont('helvetica', 'normal');
  doc.text(`Estado en planta: `, 21, cardY + 24.5);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(teacher.status === 'activo' ? 16 : 100, teacher.status === 'activo' ? 120 : 100, teacher.status === 'activo' ? 70 : 100);
  doc.text(teacher.status === 'activo' ? 'ACTIVO VINCULADO' : 'INACTIVO', 47, cardY + 24.5);

  // Right column of teacher card: Total hours highlight
  const rightBoxX = pageWidth - 65;
  doc.setFillColor(248, 250, 252);
  doc.roundedRect(rightBoxX, cardY + 4, 46, 22, 1.5, 1.5, 'F');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(...slateMuted);
  doc.text('INTENSIDAD SEMANAL', rightBoxX + 23, cardY + 9.5, { align: 'center' });

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.setTextColor(isOverloaded ? 185 : 76, isOverloaded ? 28 : 29, isOverloaded ? 28 : 149);
  doc.text(`${totalHours} HORAS`, rightBoxX + 23, cardY + 17, { align: 'center' });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(...slateMuted);
  doc.text(`Límite máx: ${maxWeeklyHours} h`, rightBoxX + 23, cardY + 22, { align: 'center' });

  // Group assignments by subject (discriminación por materia)
  interface SubjectGroupData {
    subjectName: string;
    items: typeof teacherAssignments;
    totalHours: number;
    groupList: string[];
  }

  const subjectMap = new Map<string, SubjectGroupData>();
  teacherAssignments.forEach(a => {
    const sName = (a.subjectName || 'Sin Asignatura').trim();
    if (!subjectMap.has(sName)) {
      subjectMap.set(sName, {
        subjectName: sName,
        items: [],
        totalHours: 0,
        groupList: []
      });
    }
    const data = subjectMap.get(sName)!;
    data.items.push(a);
    data.totalHours += Number(a.weeklyHours) || 0;
    const groupObj = groupsMap.get(a.groupId);
    const gLabel = groupObj?.displayName || a.groupId;
    data.groupList.push(`${gLabel} (${a.weeklyHours}h)`);
  });

  const subjectList = Array.from(subjectMap.values()).sort((a, b) => b.totalHours - a.totalHours);

  // Section title: Discriminación por materia
  const sectionY = cardY + 36;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(...purpleDark);
  doc.text('1. DISCRIMINACIÓN DE CARGA HORARIA POR MATERIA / ASIGNATURA', 14, sectionY);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(...slateMuted);
  doc.text('Distribución consolidada de asignaturas, grupos y horas semanales asignadas al docente:', 14, sectionY + 4.5);

  // Table 1: Discriminated by Subject
  const subjectHead = [
    ['N°', 'ASIGNATURA / MATERIA', 'GRUPOS ASIGNADOS Y HORAS', 'CURSOS', 'SUBTOTAL HORAS', '% CARGA']
  ];

  const subjectBody = subjectList.map((item, idx) => {
    const pct = totalHours > 0 ? Math.round((item.totalHours / totalHours) * 100) : 0;
    return [
      String(idx + 1),
      item.subjectName.toUpperCase(),
      item.groupList.join(' • '),
      `${item.items.length} curso${item.items.length > 1 ? 's' : ''}`,
      `${item.totalHours} hrs / sem`,
      `${pct}%`
    ];
  });

  if (subjectBody.length === 0) {
    subjectBody.push(['-', 'Sin asignaturas registradas', 'No hay cursos asignados', '0', '0 hrs', '0%']);
  }

  autoTable(doc, {
    head: subjectHead,
    body: subjectBody,
    startY: sectionY + 7,
    margin: { left: 14, right: 14, bottom: 20 },
    styles: {
      fontSize: 7.8,
      cellPadding: 2.5,
      textColor: [30, 41, 59],
      valign: 'middle',
      lineColor: [226, 232, 240],
      lineWidth: 0.1
    },
    headStyles: {
      fillColor: [76, 29, 149],
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      halign: 'center'
    },
    columnStyles: {
      0: { cellWidth: 10, halign: 'center' },
      1: { cellWidth: 46, fontStyle: 'bold' },
      2: { cellWidth: 'auto' },
      3: { cellWidth: 20, halign: 'center' },
      4: { cellWidth: 26, halign: 'center', fontStyle: 'bold' },
      5: { cellWidth: 18, halign: 'center' }
    },
    alternateRowStyles: {
      fillColor: [248, 250, 252]
    },
    foot: [
      ['', 'TOTAL GENERAL CARGA SEMANAL', `${teacherAssignments.length} asignaciones totales`, `${groups.length > 0 ? subjectList.reduce((acc, s) => acc + s.items.length, 0) : 0} clases`, `${totalHours} HORAS / SEM`, '100%']
    ],
    footStyles: {
      fillColor: [243, 232, 255],
      textColor: [76, 29, 149],
      fontStyle: 'bold',
      halign: 'center'
    }
  });

  // Table 2: Detailed itemized list of classes
  let afterTable1Y = (doc as any).lastAutoTable?.finalY || (sectionY + 40);

  if (afterTable1Y > pageHeight - 65) {
    doc.addPage();
    afterTable1Y = 20;
  } else {
    afterTable1Y += 6;
  }

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(...purpleDark);
  doc.text('2. DESGLOSE DETALLADO POR GRUPO ESCOLAR Y CICLO', 14, afterTable1Y);

  const detailHead = [
    ['ITEM', 'MATERIA', 'GRUPO ESCOLAR', 'GRADO / NIVEL', 'INTENSIDAD HORARIA']
  ];

  // Sort assignments by subjectName then group
  const sortedAssignments = [...teacherAssignments].sort((a, b) => {
    const sComp = a.subjectName.localeCompare(b.subjectName, 'es');
    if (sComp !== 0) return sComp;
    return a.groupId.localeCompare(b.groupId, 'es');
  });

  const detailBody = sortedAssignments.map((a, idx) => {
    const groupObj = groupsMap.get(a.groupId);
    const groupName = groupObj?.displayName || a.groupId;
    const gradeName = groupObj?.gradeName || (groupObj?.grade ? `Grado ${groupObj.grade}°` : 'Secundaria');

    return [
      String(idx + 1),
      a.subjectName,
      groupName,
      gradeName,
      `${a.weeklyHours} horas / semana`
    ];
  });

  if (detailBody.length === 0) {
    detailBody.push(['-', 'Sin asignaciones', '-', '-', '0 horas']);
  }

  autoTable(doc, {
    head: detailHead,
    body: detailBody,
    startY: afterTable1Y + 3.5,
    margin: { left: 14, right: 14, bottom: 20 },
    styles: {
      fontSize: 7.5,
      cellPadding: 2,
      textColor: [30, 41, 59],
      valign: 'middle',
      lineColor: [226, 232, 240],
      lineWidth: 0.1
    },
    headStyles: {
      fillColor: [100, 116, 139],
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      halign: 'center'
    },
    columnStyles: {
      0: { cellWidth: 12, halign: 'center' },
      1: { cellWidth: 50, fontStyle: 'bold' },
      2: { cellWidth: 35, halign: 'center', fontStyle: 'bold' },
      3: { cellWidth: 45 },
      4: { cellWidth: 'auto', halign: 'center', fontStyle: 'bold' }
    },
    alternateRowStyles: {
      fillColor: [248, 250, 252]
    }
  });

  // Commitments & Legal Text
  const tableFinalY = (doc as any).lastAutoTable?.finalY || (afterTable1Y + 30);
  let textY = tableFinalY + 6;

  // If near bottom of page, add page
  if (textY > pageHeight - 55) {
    doc.addPage();
    textY = 22;
  }

  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(226, 232, 240);
  doc.roundedRect(14, textY, pageWidth - 28, 20, 1.5, 1.5, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.8);
  doc.setTextColor(...purpleDark);
  doc.text('DECLARACIÓN Y COMPROMISO PEDAGÓGICO INSTITUCIONAL:', 18, textY + 5);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(...slateText);
  const legalText = `El docente manifiesta haber recibido a satisfacción la presente asignación académica para el Año Lectivo ${schoolYear}. Se compromete a preparar oportunamente las sesiones de clase, cumplir con la intensidad horaria estipulada, registrar el seguimiento pedagógico y actuar en estricta conformidad con el PEI, el Manual de Convivencia y el Sistema Institucional de Evaluación de Estudiantes (SIEE) de la I. E. Juan Pablo I.`;
  const splitLegal = doc.splitTextToSize(legalText, pageWidth - 36);
  doc.text(splitLegal, 18, textY + 9.5);

  // Signatures
  let sigY = textY + 32;
  if (sigY > pageHeight - 28) {
    doc.addPage();
    sigY = 32;
  }

  const sigWidth = 52;
  const sig1 = 16;
  const sig2 = (pageWidth - sigWidth) / 2;
  const sig3 = pageWidth - 16 - sigWidth;

  doc.setDrawColor(148, 163, 184);
  doc.setLineWidth(0.4);

  // 1. Docente
  doc.line(sig1, sigY, sig1 + sigWidth, sigY);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(...slateText);
  doc.text(teacher.fullName.toUpperCase(), sig1 + sigWidth / 2, sigY + 4, { align: 'center' });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.5);
  doc.setTextColor(...slateMuted);
  doc.text(`Docente Titular • C.C. ________________`, sig1 + sigWidth / 2, sigY + 7.5, { align: 'center' });

  // 2. Coordinación
  doc.line(sig2, sigY, sig2 + sigWidth, sigY);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(...slateText);
  doc.text('COORDINACIÓN ACADÉMICA', sig2 + sigWidth / 2, sigY + 4, { align: 'center' });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.5);
  doc.setTextColor(...slateMuted);
  doc.text('I. E. Juan Pablo I', sig2 + sigWidth / 2, sigY + 7.5, { align: 'center' });

  // 3. Rectoría
  doc.line(sig3, sigY, sig3 + sigWidth, sigY);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(...slateText);
  doc.text('RECTORÍA', sig3 + sigWidth / 2, sigY + 4, { align: 'center' });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.5);
  doc.setTextColor(...slateMuted);
  doc.text('Firma y Sello Oficial', sig3 + sigWidth / 2, sigY + 7.5, { align: 'center' });

  // Render footers across all pages
  const totalPages = (doc.internal as any).getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(...slateMuted);
    doc.text(
      `Institución Educativa Juan Pablo I • Municipio de La Llanada, Nariño • Documento Oficial de Asignación Docente`,
      14,
      pageHeight - 7
    );
    doc.text(
      `Página ${i} de ${totalPages}`,
      pageWidth - 14,
      pageHeight - 7,
      { align: 'right' }
    );
  }

  // Save the PDF
  const sanitizedName = teacher.fullName.replace(/[^a-zA-Z0-9áéíóúÁÉÍÓÚñÑ]/g, '_');
  const safeFilename = `Asignacion_Docente_${sanitizedName}_${schoolYear}.pdf`;
  doc.save(safeFilename);
}

