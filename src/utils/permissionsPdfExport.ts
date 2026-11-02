import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { AcademicPermissionRecord } from '../types';

async function getBase64ImageFromUrl(url: string): Promise<string | null> {
  try {
    const response = await fetch(url);
    if (!response.ok) return null;
    const blob = await response.blob();
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

function getFormattedDate(): string {
  const d = new Date();
  const months = [
    'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
    'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'
  ];
  return `${d.getDate()} de ${months[d.getMonth()]} de ${d.getFullYear()}`;
}

/**
 * =========================================================================
 * 1. INFORME DE PERMISOS ACADÉMICOS POR CURSO
 * =========================================================================
 */
export async function downloadCoursePermissionsPdf(options: {
  schoolYear: number;
  courseName: string;
  permissions: AcademicPermissionRecord[];
  startDate?: string;
  endDate?: string;
}): Promise<void> {
  const { schoolYear, courseName, permissions, startDate, endDate } = options;

  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'letter' // 215.9 x 279.4 mm
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const logoBase64 = await getBase64ImageFromUrl('/JUANI.png');

  // Paleta institucional
  const purpleDark: [number, number, number] = [76, 29, 149];
  const purpleMain: [number, number, number] = [124, 58, 237];
  const goldAccent: [number, number, number] = [217, 119, 6];
  const slateDark: [number, number, number] = [30, 41, 59];
  const slateMuted: [number, number, number] = [100, 116, 139];

  // Encabezado
  doc.setFillColor(248, 250, 252);
  doc.rect(0, 0, pageWidth, 42, 'F');
  doc.setFillColor(...purpleDark);
  doc.rect(0, 0, pageWidth, 4, 'F');
  doc.setFillColor(...goldAccent);
  doc.rect(0, 4, pageWidth, 1.2, 'F');

  let textStartX = 14;
  if (logoBase64) {
    try {
      doc.addImage(logoBase64, 'PNG', 14, 8, 25, 25);
      textStartX = 44;
    } catch {
      textStartX = 14;
    }
  }

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.setTextColor(...purpleDark);
  doc.text('INSTITUCIÓN EDUCATIVA JUAN PABLO I', textStartX, 15);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(...slateDark);
  doc.text('ACTA OFICIAL DE PERMISOS ACADÉMICOS POR CURSO', textStartX, 21);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(...slateMuted);
  doc.text(`Municipio de La Llanada, Nariño • Vigencia del Año Escolar ${schoolYear}`, textStartX, 26.5);
  doc.text(`Fecha de expedición: ${getFormattedDate()}`, textStartX, 31);

  // Badge año
  doc.setFillColor(...purpleDark);
  doc.roundedRect(pageWidth - 52, 9, 38, 16, 2, 2, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(255, 255, 255);
  doc.text('AÑO ESCOLAR', pageWidth - 33, 14.5, { align: 'center' });
  doc.setFontSize(11);
  doc.text(`${schoolYear}`, pageWidth - 33, 21.5, { align: 'center' });

  // Parámetros
  const cardY = 46;
  doc.setFillColor(255, 255, 255);
  doc.setDrawColor(203, 213, 225);
  doc.setLineWidth(0.3);
  doc.roundedRect(14, cardY, pageWidth - 28, 17, 2, 2, 'FD');
  doc.setFillColor(...purpleMain);
  doc.roundedRect(14, cardY, 3, 17, 1, 1, 'F');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(...slateMuted);
  doc.text('CURSO / GRUPO:', 21, cardY + 6);
  doc.setTextColor(...slateDark);
  doc.text(`${courseName}`, 48, cardY + 6);

  const rangeStr = (startDate && endDate) 
    ? `${startDate} al ${endDate}` 
    : startDate 
    ? `Desde ${startDate}` 
    : 'Todo el registro lectivo';
  doc.setTextColor(...slateMuted);
  doc.text('PERIODO:', 110, cardY + 6);
  doc.setTextColor(...slateDark);
  doc.text(`${rangeStr}`, 126, cardY + 6);

  doc.setTextColor(...slateMuted);
  doc.text('TOTAL PERMISOS AUTORIZADOS:', 21, cardY + 12);
  doc.setTextColor(...purpleDark);
  doc.text(`${permissions.length} registro(s)`, 72, cardY + 12);

  // Tabla de Permisos del Curso
  const tableHead = [
    ['N°', 'CÓDIGO', 'ESTUDIANTE', 'FECHA', 'HORARIO', 'MOTIVO DE PERMISO', 'SOPORTE PDF']
  ];

  const tableBody = permissions.map((p, idx) => {
    const horario = p.tipoRango === 'dia_completo' 
      ? 'Día completo' 
      : `${p.horaInicio || '00:00'} - ${p.horaFin || '00:00'}`;
    const soporte = p.archivoPdfBase64 ? 'Adjunto ✓' : 'Sin archivo';

    return [
      String(idx + 1),
      p.codigo,
      p.nombreCompleto,
      p.fecha,
      horario,
      p.motivo,
      soporte
    ];
  });

  if (tableBody.length === 0) {
    tableBody.push(['-', '-', 'No se registran permisos académicos en este curso', '-', '-', '-', '-']);
  }

  autoTable(doc, {
    head: tableHead,
    body: tableBody,
    startY: cardY + 22,
    margin: { left: 14, right: 14, bottom: 25 },
    styles: {
      fontSize: 7.2,
      cellPadding: 2,
      textColor: [30, 41, 59],
      valign: 'middle',
      lineColor: [226, 232, 240],
      lineWidth: 0.15
    },
    headStyles: {
      fillColor: [76, 29, 149],
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      halign: 'center'
    },
    columnStyles: {
      0: { cellWidth: 8, halign: 'center' },
      1: { cellWidth: 18, halign: 'center', fontStyle: 'bold' },
      2: { cellWidth: 50, fontStyle: 'bold' },
      3: { cellWidth: 22, halign: 'center' },
      4: { cellWidth: 24, halign: 'center' },
      5: { cellWidth: 'auto' },
      6: { cellWidth: 20, halign: 'center' }
    },
    alternateRowStyles: {
      fillColor: [248, 250, 252]
    },
    didParseCell: (data) => {
      if (data.section === 'body' && data.column.index === 6) {
        if (String(data.cell.raw).includes('Adjunto')) {
          data.cell.styles.textColor = [16, 120, 70];
          data.cell.styles.fontStyle = 'bold';
        } else {
          data.cell.styles.textColor = [148, 163, 184];
        }
      }
    }
  });

  // Firmas
  let sigY = (doc as any).lastAutoTable?.finalY || 160;
  sigY += 24;

  if (sigY > pageHeight - 32) {
    doc.addPage();
    sigY = 32;
  }

  const sigWidth = 52;
  const sig1 = 16;
  const sig2 = (pageWidth - sigWidth) / 2;
  const sig3 = pageWidth - 16 - sigWidth;

  doc.setDrawColor(148, 163, 184);
  doc.setLineWidth(0.4);

  // 1. Director de Grupo
  doc.line(sig1, sigY, sig1 + sigWidth, sigY);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(...slateDark);
  doc.text('DIRECTOR(A) DE GRUPO', sig1 + sigWidth / 2, sigY + 4, { align: 'center' });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.5);
  doc.setTextColor(...slateMuted);
  doc.text('Recepción y Notificación', sig1 + sigWidth / 2, sigY + 7.5, { align: 'center' });

  // 2. Coordinación Académica
  doc.line(sig2, sigY, sig2 + sigWidth, sigY);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(...slateDark);
  doc.text('COORDINACIÓN ACADÉMICA', sig2 + sigWidth / 2, sigY + 4, { align: 'center' });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.5);
  doc.setTextColor(...slateMuted);
  doc.text('Autorización y Registro Institucional', sig2 + sigWidth / 2, sigY + 7.5, { align: 'center' });

  // 3. Rectoría
  doc.line(sig3, sigY, sig3 + sigWidth, sigY);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(...slateDark);
  doc.text('RECTORÍA INSTITUCIONAL', sig3 + sigWidth / 2, sigY + 4, { align: 'center' });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.5);
  doc.setTextColor(...slateMuted);
  doc.text('I. E. Juan Pablo I • La Llanada', sig3 + sigWidth / 2, sigY + 7.5, { align: 'center' });

  // Pie de página
  const totalPages = (doc.internal as any).getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(...slateMuted);
    doc.text(
      `Institución Educativa Juan Pablo I • La Llanada, Nariño • Sistema de Gestión y Permisos Académicos`,
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

  const safeCourse = courseName.replace(/[^a-zA-Z0-9]/g, '_');
  doc.save(`Permisos_Curso_${safeCourse}_${schoolYear}.pdf`);
}

function formatToDayMonthYear(dateStr: string): string {
  if (!dateStr) return '';
  const parts = dateStr.split('-');
  if (parts.length === 3) {
    return `${parts[2]}/${parts[1]}/${parts[0]}`;
  }
  return dateStr;
}

function getGradeSortWeight(gradeStr?: string): number {
  if (!gradeStr) return 9999;
  const numMatch = gradeStr.match(/\d+/);
  const gradeNum = numMatch ? parseInt(numMatch[0], 10) : 50;
  const letterMatch = gradeStr.toUpperCase().match(/[A-Z]/);
  const letterVal = letterMatch ? letterMatch[0].charCodeAt(0) : 65;
  return gradeNum * 1000 + letterVal;
}

function formatGradeLabel(courseId?: string, courseName?: string): string {
  if (courseId && /^\d+[A-Za-z]$/.test(courseId)) {
    return courseId.toUpperCase();
  }
  const str = courseName || courseId || '';
  return str.replace(/[°\s]/g, '').toUpperCase();
}

/**
 * =========================================================================
 * 2. AUTORIZACIÓN AUSENCIA ESCOLAR (INFORME GLOBAL DE TODOS LOS GRADOS POR FECHA)
 * =========================================================================
 * Formato fiel a la plantilla institucional:
 * - Membrete recuadrado con escudo de la institución a la izquierda
 * - Título centrado: "Autorización Ausencia Escolar"
 * - Columnas: Nombre | Grado | Fecha | Motivo de la Ausencia
 * - Discriminado por grado (ordenado de menor a mayor grado y alfabéticamente)
 */
export async function downloadGlobalPermissionsByDatePdf(options: {
  schoolYear: number;
  date: string;
  permissions: AcademicPermissionRecord[];
}): Promise<void> {
  const { schoolYear, date, permissions } = options;

  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'letter' // 215.9 x 279.4 mm
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const logoBase64 = await getBase64ImageFromUrl('/JUANI.png');

  // Encabezado institucional recuadrado (idéntico a la imagen de referencia)
  const headerX = 14;
  const headerY = 14;
  const headerWidth = pageWidth - 28; // 187.9 mm
  const headerHeight = 28;

  // Marco exterior del encabezado
  doc.setDrawColor(0, 0, 0);
  doc.setLineWidth(0.4);
  doc.rect(headerX, headerY, headerWidth, headerHeight);

  // Escudo institucional a la izquierda
  if (logoBase64) {
    try {
      doc.addImage(logoBase64, 'PNG', headerX + 3.5, headerY + 2.5, 23, 23);
    } catch {
      // Ignorar error de carga de logo
    }
  }

  // Línea divisoria vertical entre logo y título
  doc.line(headerX + 31, headerY, headerX + 31, headerY + headerHeight);

  // Título centrado dentro del recuadro
  const titleCenterX = (headerX + 31 + headerX + headerWidth) / 2;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.setTextColor(0, 0, 0);
  doc.text('Autorización Ausencia Escolar', titleCenterX, headerY + 12, { align: 'center' });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(40, 40, 40);
  doc.text('Institución Educativa Juan Pablo I — La Llanada (Nariño)', titleCenterX, headerY + 19, { align: 'center' });

  doc.setFontSize(7.5);
  doc.setTextColor(80, 80, 80);
  doc.text(
    `Vigencia Lectiva ${schoolYear} • Registro Diario Consolidado de Todos los Grados`,
    titleCenterX,
    headerY + 24.5,
    { align: 'center' }
  );

  // Barra de metadatos del día
  const subY = headerY + headerHeight + 3.5;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(0, 0, 0);
  doc.text(`Fecha del Registro: ${formatToDayMonthYear(date)}`, 14, subY + 3.5);
  doc.text(`Total Estudiantes con Permiso: ${permissions.length}`, pageWidth / 2, subY + 3.5, { align: 'center' });
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(60, 60, 60);
  doc.text('Discriminado por Grado y Curso', pageWidth - 14, subY + 3.5, { align: 'right' });

  // Ordenar los permisos discriminados por grado y luego alfabéticamente por estudiante
  const sortedPermissions = [...permissions].sort((a, b) => {
    const gradeA = getGradeSortWeight(a.cursoNombre || a.cursoId);
    const gradeB = getGradeSortWeight(b.cursoNombre || b.cursoId);
    if (gradeA !== gradeB) {
      return gradeA - gradeB;
    }
    return a.nombreCompleto.localeCompare(b.nombreCompleto, 'es', { sensitivity: 'base' });
  });

  // Estructura obligatoria de la tabla según la imagen y requerimiento:
  // Nombre | Grado | Fecha | Motivo de la Ausencia
  const tableHead = [
    ['Nombre', 'Grado', 'Fecha', 'Motivo de la Ausencia']
  ];

  const tableBody = sortedPermissions.map((p) => {
    const nombre = p.nombreCompleto.toUpperCase();
    const grado = formatGradeLabel(p.cursoId, p.cursoNombre);
    const fecha = formatToDayMonthYear(p.fecha);
    const horario = p.tipoRango === 'rango_horas' 
      ? ` (${p.horaInicio || '00:00'} a ${p.horaFin || '00:00'})` 
      : ' (Jornada completa)';
    const motivo = `${p.motivo}${horario}`;

    return [
      nombre,
      grado,
      fecha,
      motivo
    ];
  });

  if (tableBody.length === 0) {
    tableBody.push([
      'NO SE REGISTRARON PERMISOS ACADÉMICOS PARA ESTA FECHA',
      '-',
      formatToDayMonthYear(date),
      '-'
    ]);
  }

  autoTable(doc, {
    head: tableHead,
    body: tableBody,
    startY: subY + 6,
    margin: { left: 14, right: 14, bottom: 25 },
    styles: {
      fontSize: 8.5,
      cellPadding: 2.8,
      textColor: [0, 0, 0],
      valign: 'middle',
      lineColor: [0, 0, 0],
      lineWidth: 0.35
    },
    headStyles: {
      fillColor: [255, 255, 255],
      textColor: [0, 0, 0],
      fontStyle: 'bold',
      fontSize: 9.5,
      lineColor: [0, 0, 0],
      lineWidth: 0.4
    },
    columnStyles: {
      0: { cellWidth: 62, halign: 'left', fontStyle: 'bold' },
      1: { cellWidth: 22, halign: 'center', fontStyle: 'bold' },
      2: { cellWidth: 28, halign: 'center' },
      3: { cellWidth: 75.9, halign: 'left' }
    },
    alternateRowStyles: {
      fillColor: [252, 252, 252]
    }
  });

  // Firmas Institucionales de Autorización
  let sigY = (doc as any).lastAutoTable?.finalY || 160;
  sigY += 26;

  if (sigY > pageHeight - 34) {
    doc.addPage();
    sigY = 40;
  }

  const sigWidth = 62;
  const sig1 = 24;
  const sig2 = pageWidth - 24 - sigWidth;

  doc.setDrawColor(0, 0, 0);
  doc.setLineWidth(0.4);

  // 1. Coordinación Académica
  doc.line(sig1, sigY, sig1 + sigWidth, sigY);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(0, 0, 0);
  doc.text('COORDINACIÓN ACADÉMICA', sig1 + sigWidth / 2, sigY + 4.5, { align: 'center' });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(90, 90, 90);
  doc.text('Control y Autorización de Asistencia', sig1 + sigWidth / 2, sigY + 8.5, { align: 'center' });

  // 2. Rectoría
  doc.line(sig2, sigY, sig2 + sigWidth, sigY);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(0, 0, 0);
  doc.text('RECTORÍA INSTITUCIONAL', sig2 + sigWidth / 2, sigY + 4.5, { align: 'center' });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(90, 90, 90);
  doc.text('I. E. Juan Pablo I • La Llanada', sig2 + sigWidth / 2, sigY + 8.5, { align: 'center' });

  // Pie de página
  const totalPages = (doc.internal as any).getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(110, 110, 110);
    doc.text(
      `Institución Educativa Juan Pablo I • La Llanada, Nariño • Control Diario de Ausencia Escolar`,
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

  doc.save(`Autorizacion_Ausencia_Escolar_${date.replace(/-/g, '_')}.pdf`);
}
