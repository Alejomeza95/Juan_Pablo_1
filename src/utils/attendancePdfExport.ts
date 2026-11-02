import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { 
  StudentRecord, 
  AttendanceSessionRecord, 
  AusentismoConfig,
  StudentStatsSummary 
} from '../types';
import { calculateAttendanceMetrics, DEFAULT_AUSENTISMO_CONFIG } from './attendanceService';

export interface AttendancePdfExportOptions {
  schoolYear: number;
  courseName: string;
  subjectName?: string;
  teacherName?: string;
  startDate?: string;
  endDate?: string;
  students: StudentRecord[];
  sessions: AttendanceSessionRecord[];
  config?: AusentismoConfig;
  reportType?: 'matrix' | 'executive' | 'complete';
  cellFormat?: 'full' | 'short'; // 'full' = 'Presente'/'Ausente', 'short' = 'Pres.'/'Aus.'
}

/**
 * Carga una imagen institucional desde URL y la convierte a Base64 para jsPDF
 */
async function getBase64ImageFromUrl(url: string): Promise<string | null> {
  try {
    const response = await fetch(url);
    if (!response.ok) return null;
    const blob = await response.blob();
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        resolve(reader.result as string);
      };
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

function formatSessionDateHeader(fecha: string, index: number): string {
  try {
    const parts = fecha.split('-');
    if (parts.length === 3) {
      const [y, m, d] = parts;
      return `S${index + 1}\n${d}/${m}/${y.slice(2)}`;
    }
  } catch {}
  return `S${index + 1}\n${fecha}`;
}

/**
 * =========================================================================
 * 1. GENERADOR DE SÁBANA / MATRIZ DE ASISTENCIA POR FECHAS (APAYSADO)
 * =========================================================================
 * Muestra el registro exacto de cada fecha con "Presente" / "Ausente"
 */
async function generateAttendanceMatrixDoc(options: AttendancePdfExportOptions): Promise<jsPDF> {
  const {
    schoolYear,
    courseName,
    subjectName = 'Todas las asignaturas',
    teacherName = 'Todos los docentes',
    startDate,
    endDate,
    students,
    sessions,
    config = DEFAULT_AUSENTISMO_CONFIG,
    cellFormat = 'full'
  } = options;

  const doc = new jsPDF({
    orientation: 'landscape',
    unit: 'mm',
    format: 'letter' // 279.4 x 215.9 mm
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

  // Ordenar estudiantes alfabéticamente por apellidos
  const sortedStudents = [...students].sort((a, b) => 
    a.apellidos.localeCompare(b.apellidos, 'es', { sensitivity: 'base' })
  );

  // Ordenar sesiones cronológicamente por fecha
  const sortedSessions = [...sessions].sort((a, b) => a.fecha.localeCompare(b.fecha));

  // Función para dibujar encabezado en cualquier página de matriz
  const renderMatrixHeader = (pageNum: number, totalBatches: number, batchIndex: number) => {
    // Fondo superior
    doc.setFillColor(248, 250, 252);
    doc.rect(0, 0, pageWidth, 38, 'F');

    // Rayas decorativas
    doc.setFillColor(...purpleDark);
    doc.rect(0, 0, pageWidth, 3.5, 'F');
    doc.setFillColor(...goldAccent);
    doc.rect(0, 3.5, pageWidth, 1.2, 'F');

    // Escudo institucional
    let textStartX = 12;
    if (logoBase64) {
      try {
        doc.addImage(logoBase64, 'PNG', 12, 6, 23, 23);
        textStartX = 39;
      } catch {
        textStartX = 12;
      }
    }

    // Títulos institucionales
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.setTextColor(...purpleDark);
    doc.text('INSTITUCIÓN EDUCATIVA JUAN PABLO I', textStartX, 13);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9.5);
    doc.setTextColor(...slateDark);
    doc.text('SÁBANA DE ASISTENCIA Y CONTROL DETALLADO DE AUSENTISMO POR FECHAS', textStartX, 18.5);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(...slateMuted);
    const batchNotice = totalBatches > 1 ? ` • Parte ${batchIndex + 1} de ${totalBatches}` : '';
    doc.text(
      `Municipio de La Llanada, Nariño • Vigencia del Año Escolar ${schoolYear}${batchNotice} • Expedido: ${getFormattedDate()}`,
      textStartX,
      23.5
    );

    // Badge derecha
    doc.setFillColor(...purpleDark);
    doc.roundedRect(pageWidth - 48, 7, 36, 14, 1.5, 1.5, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7);
    doc.setTextColor(255, 255, 255);
    doc.text('AÑO ESCOLAR', pageWidth - 30, 11.5, { align: 'center' });
    doc.setFontSize(10);
    doc.text(`${schoolYear}`, pageWidth - 30, 18, { align: 'center' });

    // Fila de Parámetros y Filtros
    const cardY = 27;
    doc.setFillColor(255, 255, 255);
    doc.setDrawColor(203, 213, 225);
    doc.setLineWidth(0.2);
    doc.roundedRect(12, cardY, pageWidth - 24, 10, 1.5, 1.5, 'FD');

    // Acento izquierdo
    doc.setFillColor(...purpleMain);
    doc.roundedRect(12, cardY, 2.5, 10, 0.8, 0.8, 'F');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7);
    doc.setTextColor(...slateMuted);
    doc.text('CURSO / GRUPO:', 17, cardY + 6.5);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...slateDark);
    doc.text(`${courseName}`, 38, cardY + 6.5);

    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...slateMuted);
    doc.text('ASIGNATURA:', 75, cardY + 6.5);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...slateDark);
    doc.text(`${subjectName}`, 94, cardY + 6.5);

    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...slateMuted);
    doc.text('DOCENTE:', 145, cardY + 6.5);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...slateDark);
    doc.text(`${teacherName}`, 160, cardY + 6.5);

    const dateRangeStr = (startDate && endDate) 
      ? `${startDate} al ${endDate}` 
      : startDate 
      ? `Desde ${startDate}` 
      : 'Periodo completo';
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...slateMuted);
    doc.text('PERIODO:', 210, cardY + 6.5);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...slateDark);
    doc.text(`${dateRangeStr} (${sortedSessions.length} sesiones)`, 224, cardY + 6.5);
  };

  // Si no hay sesiones registradas aún
  if (sortedSessions.length === 0) {
    renderMatrixHeader(1, 1, 0);

    const emptyHead = [['N°', 'CÓDIGO', 'APELLIDOS Y NOMBRES', 'ESTADO']];
    const emptyBody = sortedStudents.map((st, i) => [
      String(i + 1),
      st.codigo,
      st.nombreCompleto,
      'Sin sesiones registradas en el periodo seleccionado'
    ]);

    autoTable(doc, {
      head: emptyHead,
      body: emptyBody.length > 0 ? emptyBody : [['-', '-', 'No hay estudiantes matriculados', '-']],
      startY: 40,
      margin: { left: 12, right: 12, bottom: 20 },
      styles: { fontSize: 7.5, cellPadding: 2.5 }
    });

    return doc;
  }

  // Dividir sesiones en lotes de hasta 10 por tabla para evitar texto apretado
  const SESSIONS_PER_BATCH = 10;
  const sessionBatches: AttendanceSessionRecord[][] = [];
  for (let i = 0; i < sortedSessions.length; i += SESSIONS_PER_BATCH) {
    sessionBatches.push(sortedSessions.slice(i, i + SESSIONS_PER_BATCH));
  }

  sessionBatches.forEach((batch, bIdx) => {
    if (bIdx > 0) {
      doc.addPage();
    }

    renderMatrixHeader(bIdx + 1, sessionBatches.length, bIdx);

    // Construcción de Cabeceras
    const batchOffset = bIdx * SESSIONS_PER_BATCH;
    const sessionColHeaders = batch.map((s, idx) => 
      formatSessionDateHeader(s.fecha, batchOffset + idx)
    );

    const tableHeaders = [
      'N°',
      'CÓDIGO',
      'APELLIDOS Y NOMBRES',
      ...sessionColHeaders,
      'ASIST.',
      'AUS.',
      '% ASIST.'
    ];

    // Construcción de Filas por Estudiante
    const tableBody = sortedStudents.map((st, stIdx) => {
      // Contadores globales para el estudiante en toda la vigencia o filtro
      let totalAsist = 0;
      let totalAus = 0;

      sortedSessions.forEach(s => {
        const mark = s.registros ? s.registros[st.id] : undefined;
        if (mark === 'asistio') totalAsist++;
        else if (mark === 'no_asistio') totalAus++;
      });

      const totalExpected = totalAsist + totalAus;
      const pct = totalExpected > 0 ? Math.round((totalAsist / totalExpected) * 100) : 100;

      // Valores para las columnas de fechas del lote actual
      const sessionValues = batch.map(s => {
        const mark = s.registros ? s.registros[st.id] : undefined;
        if (mark === 'asistio') {
          return cellFormat === 'short' ? 'Pres.' : 'Presente';
        } else if (mark === 'no_asistio') {
          return cellFormat === 'short' ? 'Aus.' : 'Ausente';
        }
        return '-';
      });

      return [
        String(stIdx + 1),
        st.codigo,
        st.nombreCompleto,
        ...sessionValues,
        String(totalAsist),
        String(totalAus),
        `${pct}%`
      ];
    });

    // Fila de resumen de pie de tabla (Totales de asistentes y ausentes por sesión)
    const presentesRow: string[] = ['', '', 'TOTAL PRESENTES'];
    const ausentesRow: string[] = ['', '', 'TOTAL AUSENTES'];
    const pctSessionRow: string[] = ['', '', '% ASISTENCIA SESIÓN'];

    let batchTotalAsist = 0;
    let batchTotalAus = 0;

    batch.forEach(s => {
      let pCount = 0;
      let aCount = 0;
      sortedStudents.forEach(st => {
        const mark = s.registros ? s.registros[st.id] : undefined;
        if (mark === 'asistio') pCount++;
        else if (mark === 'no_asistio') aCount++;
      });

      batchTotalAsist += pCount;
      batchTotalAus += aCount;
      presentesRow.push(String(pCount));
      ausentesRow.push(String(aCount));

      const sTotal = pCount + aCount;
      const sPct = sTotal > 0 ? Math.round((pCount / sTotal) * 100) : 100;
      pctSessionRow.push(`${sPct}%`);
    });

    // Totales de cierre en el pie
    presentesRow.push(String(batchTotalAsist), '', '');
    ausentesRow.push('', String(batchTotalAus), '');
    const grandTotal = batchTotalAsist + batchTotalAus;
    const grandPct = grandTotal > 0 ? Math.round((batchTotalAsist / grandTotal) * 100) : 100;
    pctSessionRow.push('', '', `${grandPct}%`);

    const fullBody = [...tableBody, presentesRow, ausentesRow, pctSessionRow];

    // Configuración de anchos de columnas adaptables
    const numDateCols = batch.length;
    // Anchos fijos básicos
    const colStyles: Record<number, any> = {
      0: { cellWidth: 8, halign: 'center' }, // N°
      1: { cellWidth: 16, halign: 'center', fontStyle: 'bold' }, // CÓDIGO
      2: { cellWidth: 50, fontStyle: 'bold' } // APELLIDOS Y NOMBRES
    };

    // Columnas de fechas intermedias
    const dateColStartIndex = 3;
    const dateColEndIndex = dateColStartIndex + numDateCols - 1;

    for (let c = dateColStartIndex; c <= dateColEndIndex; c++) {
      colStyles[c] = {
        cellWidth: 'auto',
        halign: 'center'
      };
    }

    // Columnas finales de totales
    const asistColIdx = dateColEndIndex + 1;
    const ausColIdx = asistColIdx + 1;
    const pctColIdx = ausColIdx + 1;

    colStyles[asistColIdx] = { cellWidth: 14, halign: 'center', fontStyle: 'bold' };
    colStyles[ausColIdx] = { cellWidth: 14, halign: 'center', fontStyle: 'bold' };
    colStyles[pctColIdx] = { cellWidth: 15, halign: 'center', fontStyle: 'bold' };

    autoTable(doc, {
      head: [tableHeaders],
      body: fullBody,
      startY: 40,
      margin: { left: 12, right: 12, bottom: 26 },
      styles: {
        fontSize: 6.8,
        cellPadding: 1.5,
        textColor: [30, 41, 59],
        valign: 'middle',
        lineColor: [203, 213, 225],
        lineWidth: 0.15
      },
      headStyles: {
        fillColor: [76, 29, 149],
        textColor: [255, 255, 255],
        fontStyle: 'bold',
        halign: 'center',
        valign: 'middle',
        cellPadding: 2
      },
      columnStyles: colStyles,
      alternateRowStyles: {
        fillColor: [248, 250, 252]
      },
      didParseCell: (data) => {
        const raw = String(data.cell.raw || '').trim();
        const rowIdx = data.row.index;
        const colIdx = data.column.index;
        const isSummaryRow = rowIdx >= tableBody.length;

        // Estilos para filas de totales al pie de la tabla
        if (isSummaryRow) {
          data.cell.styles.fillColor = [241, 245, 249];
          data.cell.styles.fontStyle = 'bold';
          if (colIdx === 2) {
            data.cell.styles.halign = 'right';
            data.cell.styles.textColor = [76, 29, 149];
          }
          return;
        }

        // Resaltar registros de fecha: Presente / Ausente
        if (colIdx >= dateColStartIndex && colIdx <= dateColEndIndex) {
          if (raw === 'Presente' || raw === 'Pres.') {
            // Fondo verde menta suave con texto verde oscuro institucional
            data.cell.styles.fillColor = [220, 252, 231]; // emerald-100
            data.cell.styles.textColor = [22, 101, 52];   // emerald-800
            data.cell.styles.fontStyle = 'bold';
          } else if (raw === 'Ausente' || raw === 'Aus.') {
            // Fondo rojo suave con texto rojo oscuro institucional
            data.cell.styles.fillColor = [254, 226, 226]; // rose-100
            data.cell.styles.textColor = [185, 28, 28];   // rose-700
            data.cell.styles.fontStyle = 'bold';
          } else if (raw === '-') {
            data.cell.styles.textColor = [148, 163, 184];
          }
        }

        // Columnas de totales finales por estudiante
        if (colIdx === asistColIdx) {
          data.cell.styles.textColor = [22, 101, 52];
        } else if (colIdx === ausColIdx) {
          const ausVal = parseInt(raw, 10) || 0;
          if (ausVal > 0) {
            data.cell.styles.textColor = [185, 28, 28];
          }
        } else if (colIdx === pctColIdx) {
          const pctVal = parseInt(raw.replace('%', ''), 10) || 0;
          if (pctVal < 80) {
            data.cell.styles.textColor = [185, 28, 28];
          } else if (pctVal < 90) {
            data.cell.styles.textColor = [180, 83, 9];
          } else {
            data.cell.styles.textColor = [22, 101, 52];
          }
        }
      }
    });

    // Convenciones y Firmas (en la última página o si hay espacio)
    let finalTableY = (doc as any).lastAutoTable?.finalY || 140;

    // Si queda poco espacio para convenciones y firmas, agregar página
    if (finalTableY > pageHeight - 38) {
      doc.addPage();
      renderMatrixHeader(bIdx + 1, sessionBatches.length, bIdx);
      finalTableY = 40;
    }

    // Convenciones
    const legendY = finalTableY + 4;
    doc.setFillColor(248, 250, 252);
    doc.setDrawColor(226, 232, 240);
    doc.setLineWidth(0.2);
    doc.roundedRect(12, legendY, pageWidth - 24, 7, 1, 1, 'FD');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(6.5);
    doc.setTextColor(...purpleDark);
    doc.text('CONVENCIONES:', 16, legendY + 4.5);

    // Badge Presente
    doc.setFillColor(220, 252, 231);
    doc.roundedRect(42, legendY + 1.8, 14, 3.5, 0.5, 0.5, 'F');
    doc.setTextColor(22, 101, 52);
    doc.text('Presente', 49, legendY + 4.3, { align: 'center' });
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...slateDark);
    doc.text('Asistencia efectiva', 58, legendY + 4.5);

    // Badge Ausente
    doc.setFont('helvetica', 'bold');
    doc.setFillColor(254, 226, 226);
    doc.roundedRect(88, legendY + 1.8, 14, 3.5, 0.5, 0.5, 'F');
    doc.setTextColor(185, 28, 28);
    doc.text('Ausente', 95, legendY + 4.3, { align: 'center' });
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...slateDark);
    doc.text('Inasistencia registrada', 104, legendY + 4.5);

    // Badge Sin registro
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(100, 116, 139);
    doc.text('- :', 140, legendY + 4.5);
    doc.setFont('helvetica', 'normal');
    doc.text('Sin registro o ingreso posterior', 145, legendY + 4.5);

    // Sección de Firmas
    let sigY = legendY + 16;
    if (sigY > pageHeight - 16) {
      doc.addPage();
      sigY = 30;
    }

    const sigWidth = 60;
    const sig1 = 20;
    const sig2 = (pageWidth - sigWidth) / 2;
    const sig3 = pageWidth - 20 - sigWidth;

    doc.setDrawColor(148, 163, 184);
    doc.setLineWidth(0.35);

    // Firma 1: Docente
    doc.line(sig1, sigY, sig1 + sigWidth, sigY);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7);
    doc.setTextColor(...slateDark);
    doc.text('DOCENTE / TITULAR', sig1 + sigWidth / 2, sigY + 3.5, { align: 'center' });
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6);
    doc.setTextColor(...slateMuted);
    doc.text('Registro y Verificación de Asistencia', sig1 + sigWidth / 2, sigY + 6.5, { align: 'center' });

    // Firma 2: Coordinación
    doc.line(sig2, sigY, sig2 + sigWidth, sigY);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7);
    doc.setTextColor(...slateDark);
    doc.text('COORDINACIÓN ACADÉMICA', sig2 + sigWidth / 2, sigY + 3.5, { align: 'center' });
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6);
    doc.setTextColor(...slateMuted);
    doc.text('Validación y Seguimiento Escolar', sig2 + sigWidth / 2, sigY + 6.5, { align: 'center' });

    // Firma 3: Rectoría
    doc.line(sig3, sigY, sig3 + sigWidth, sigY);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7);
    doc.setTextColor(...slateDark);
    doc.text('RECTORÍA INSTITUCIONAL', sig3 + sigWidth / 2, sigY + 3.5, { align: 'center' });
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6);
    doc.setTextColor(...slateMuted);
    doc.text('I. E. Juan Pablo I • La Llanada', sig3 + sigWidth / 2, sigY + 6.5, { align: 'center' });
  });

  // Pie de página en todas las páginas
  const totalPages = (doc.internal as any).getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.5);
    doc.setTextColor(...slateMuted);
    doc.text(
      `Institución Educativa Juan Pablo I • La Llanada, Nariño • Sábana de Control de Asistencia y Ausentismo`,
      12,
      pageHeight - 6
    );
    doc.text(
      `Página ${i} de ${totalPages}`,
      pageWidth - 12,
      pageHeight - 6,
      { align: 'right' }
    );
  }

  return doc;
}

/**
 * =========================================================================
 * 2. GENERADOR DE INFORME EJECUTIVO CONSOLIDADO (VERTICAL)
 * =========================================================================
 */
async function generateAttendanceExecutiveDoc(options: AttendancePdfExportOptions): Promise<jsPDF> {
  const {
    schoolYear,
    courseName,
    subjectName = 'Todas las asignaturas',
    teacherName = 'Todos los docentes',
    startDate,
    endDate,
    students,
    sessions,
    config = DEFAULT_AUSENTISMO_CONFIG
  } = options;

  const metrics = calculateAttendanceMetrics(students, sessions, config);

  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'letter' // 215.9 x 279.4 mm
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const logoBase64 = await getBase64ImageFromUrl('/JUANI.png');

  // Palette
  const purpleDark: [number, number, number] = [76, 29, 149];
  const purpleMain: [number, number, number] = [124, 58, 237];
  const goldAccent: [number, number, number] = [217, 119, 6];
  const slateDark: [number, number, number] = [30, 41, 59];
  const slateMuted: [number, number, number] = [100, 116, 139];

  // Header Banner
  doc.setFillColor(248, 250, 252);
  doc.rect(0, 0, pageWidth, 42, 'F');

  // Top stripes
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

  // Header titles
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.setTextColor(...purpleDark);
  doc.text('INSTITUCIÓN EDUCATIVA JUAN PABLO I', textStartX, 15);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(...slateDark);
  doc.text('INFORME OFICIAL DE ASISTENCIA Y AUSENTISMO ESTUDIANTIL', textStartX, 21);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(...slateMuted);
  doc.text(`Municipio de La Llanada, Nariño • Vigencia del Año Escolar ${schoolYear}`, textStartX, 26.5);
  doc.text(`Fecha de expedición: ${getFormattedDate()}`, textStartX, 31);

  // Badge Top Right
  doc.setFillColor(...purpleDark);
  doc.roundedRect(pageWidth - 52, 9, 38, 16, 2, 2, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(255, 255, 255);
  doc.text('AÑO ESCOLAR', pageWidth - 33, 14.5, { align: 'center' });
  doc.setFontSize(11);
  doc.text(`${schoolYear}`, pageWidth - 33, 21.5, { align: 'center' });

  // Filter Details Card Box
  const cardY = 46;
  doc.setFillColor(255, 255, 255);
  doc.setDrawColor(203, 213, 225);
  doc.setLineWidth(0.3);
  doc.roundedRect(14, cardY, pageWidth - 28, 22, 2, 2, 'FD');

  // Left accent line
  doc.setFillColor(...purpleMain);
  doc.roundedRect(14, cardY, 3, 22, 1, 1, 'F');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(...slateMuted);
  doc.text('PARÁMETROS DEL INFORME:', 21, cardY + 5.5);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(...slateDark);
  doc.text(`Curso / Grupo: `, 21, cardY + 11);
  doc.setFont('helvetica', 'bold');
  doc.text(`${courseName}`, 45, cardY + 11);

  doc.setFont('helvetica', 'normal');
  doc.text(`Asignatura: `, 21, cardY + 17);
  doc.setFont('helvetica', 'bold');
  doc.text(`${subjectName}`, 45, cardY + 17);

  const col2X = 110;
  doc.setFont('helvetica', 'normal');
  doc.text(`Docente: `, col2X, cardY + 11);
  doc.setFont('helvetica', 'bold');
  doc.text(`${teacherName}`, col2X + 18, cardY + 11);

  doc.setFont('helvetica', 'normal');
  const dateRangeStr = (startDate && endDate) 
    ? `${startDate} al ${endDate}` 
    : startDate 
    ? `Desde ${startDate}` 
    : 'Periodo completo registrado';
  doc.text(`Periodo evaluado: `, col2X, cardY + 17);
  doc.setFont('helvetica', 'bold');
  doc.text(`${dateRangeStr}`, col2X + 28, cardY + 17);

  // SECTION 1: Resumen Estadístico (KPI Blocks)
  const kpiY = cardY + 26;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(...purpleDark);
  doc.text('1. RESUMEN ESTADÍSTICO DE ASISTENCIA Y AUSENTISMO', 14, kpiY);

  const kpiBoxWidth = (pageWidth - 28 - 12) / 4; // 4 boxes
  const kpiBoxHeight = 16;
  const kpiBoxY = kpiY + 4;

  const kpis = [
    { title: 'ESTUDIANTES ACTIVOS', value: `${metrics.totalStudentsCount}`, subtitle: 'Matrícula curso', color: purpleMain },
    { title: 'SESIONES REGISTRADAS', value: `${metrics.sessionsCount}`, subtitle: 'Clases evaluadas', color: purpleDark },
    { title: 'ASISTENCIA GENERAL', value: `${metrics.porcentajeAsistencia}%`, subtitle: `${metrics.totalAsistencias} presencias`, color: [16, 120, 70] as [number, number, number] },
    { title: 'AUSENTISMO GENERAL', value: `${metrics.porcentajeAusentismo}%`, subtitle: `${metrics.totalInasistencias} ausencias`, color: (metrics.porcentajeAusentismo >= config.umbralRojo ? [185, 28, 28] : [217, 119, 6]) as [number, number, number] }
  ];

  kpis.forEach((kpi, idx) => {
    const bx = 14 + idx * (kpiBoxWidth + 4);
    doc.setFillColor(248, 250, 252);
    doc.setDrawColor(226, 232, 240);
    doc.setLineWidth(0.3);
    doc.roundedRect(bx, kpiBoxY, kpiBoxWidth, kpiBoxHeight, 1.5, 1.5, 'FD');

    // Colored top border
    doc.setFillColor(...kpi.color);
    doc.roundedRect(bx, kpiBoxY, kpiBoxWidth, 2, 0.8, 0.8, 'F');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(6.5);
    doc.setTextColor(...slateMuted);
    doc.text(kpi.title, bx + kpiBoxWidth / 2, kpiBoxY + 5.5, { align: 'center' });

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(...kpi.color);
    doc.text(kpi.value, bx + kpiBoxWidth / 2, kpiBoxY + 11.5, { align: 'center' });

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6);
    doc.setTextColor(...slateMuted);
    doc.text(kpi.subtitle, bx + kpiBoxWidth / 2, kpiBoxY + 14.5, { align: 'center' });
  });

  // SECTION 2: Análisis por Asignatura
  let sec2Y = kpiBoxY + kpiBoxHeight + 7;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(...purpleDark);
  doc.text('2. ANÁLISIS DE AUSENTISMO POR ASIGNATURA Y CASOS DE ATENCIÓN PRIORITARIA', 14, sec2Y);

  const subHead = [['ASIGNATURA', 'SESIONES', 'INASISTENCIAS', '% AUSENTISMO', 'NIVEL DE IMPACTO']];
  const subBody = metrics.subjectData.slice(0, 5).map(item => {
    let impacto = 'Normal (< 10%)';
    if (item.porcentajeAusentismo >= config.umbralRojo) impacto = 'Alto (>= 20%)';
    else if (item.porcentajeAusentismo >= config.umbralVerde) impacto = 'Moderado (10-20%)';

    return [
      item.asignatura,
      String(item.totalSesiones),
      String(item.totalInasistencias),
      `${item.porcentajeAusentismo}%`,
      impacto
    ];
  });

  if (subBody.length === 0) {
    subBody.push(['Sin registros en el periodo', '-', '-', '0%', 'Normal']);
  }

  autoTable(doc, {
    head: subHead,
    body: subBody,
    startY: sec2Y + 4,
    margin: { left: 14, right: 14, bottom: 20 },
    styles: {
      fontSize: 7.2,
      cellPadding: 2,
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
      0: { cellWidth: 55, fontStyle: 'bold' },
      1: { cellWidth: 25, halign: 'center' },
      2: { cellWidth: 30, halign: 'center' },
      3: { cellWidth: 30, halign: 'center', fontStyle: 'bold' },
      4: { cellWidth: 'auto', halign: 'center' }
    },
    alternateRowStyles: {
      fillColor: [248, 250, 252]
    }
  });

  // SECTION 3: Tabla de Seguimiento Individual
  let afterSubY = (doc as any).lastAutoTable?.finalY || (sec2Y + 35);
  afterSubY += 6;

  if (afterSubY > pageHeight - 50) {
    doc.addPage();
    afterSubY = 22;
  }

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(...purpleDark);
  doc.text('3. SEGUIMIENTO INDIVIDUAL DE ESTUDIANTES Y SEMÁFORO DE AUSENTISMO', 14, afterSubY);

  const studentHead = [
    ['N°', 'CÓDIGO', 'APELLIDOS Y NOMBRES', 'SESIONES', 'ASISTENCIAS', 'INASISTENCIAS', '% AUSENTISMO', 'ESTADO SEMÁFORO']
  ];

  const studentBody = metrics.studentSummaries.map((s, idx) => {
    let estadoLabel = 'Normal (Verde)';
    if (s.alertaNivel === 'rojo') estadoLabel = 'Alerta Alta (Rojo)';
    else if (s.alertaNivel === 'amarillo') estadoLabel = 'Atención (Amarillo)';

    return [
      String(idx + 1),
      s.student.codigo,
      s.student.nombreCompleto,
      String(s.sesionesRegistradas),
      String(s.asistencias),
      String(s.inasistencias),
      `${s.porcentajeAusentismo}%`,
      estadoLabel
    ];
  });

  if (studentBody.length === 0) {
    studentBody.push(['-', '-', 'No hay estudiantes registrados en este curso', '0', '0', '0', '0%', 'Normal']);
  }

  autoTable(doc, {
    head: studentHead,
    body: studentBody,
    startY: afterSubY + 4,
    margin: { left: 14, right: 14, bottom: 25 },
    styles: {
      fontSize: 7.2,
      cellPadding: 2,
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
      1: { cellWidth: 20, halign: 'center', fontStyle: 'bold' },
      2: { cellWidth: 55, fontStyle: 'bold' },
      3: { cellWidth: 18, halign: 'center' },
      4: { cellWidth: 20, halign: 'center' },
      5: { cellWidth: 20, halign: 'center' },
      6: { cellWidth: 22, halign: 'center', fontStyle: 'bold' },
      7: { cellWidth: 'auto', halign: 'center' }
    },
    alternateRowStyles: {
      fillColor: [248, 250, 252]
    },
    didParseCell: (data) => {
      if (data.section === 'body' && data.column.index === 7) {
        const text = String(data.cell.raw || '');
        if (text.includes('Rojo')) {
          data.cell.styles.textColor = [185, 28, 28];
          data.cell.styles.fontStyle = 'bold';
        } else if (text.includes('Amarillo')) {
          data.cell.styles.textColor = [180, 83, 9];
          data.cell.styles.fontStyle = 'bold';
        } else {
          data.cell.styles.textColor = [16, 120, 70];
        }
      }
    }
  });

  // SECTION 4: Observaciones Generales y Síntesis Descriptiva
  let afterTableY = (doc as any).lastAutoTable?.finalY || 160;
  let obsY = afterTableY + 6;

  if (obsY > pageHeight - 55) {
    doc.addPage();
    obsY = 22;
  }

  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(226, 232, 240);
  doc.setLineWidth(0.3);
  doc.roundedRect(14, obsY, pageWidth - 28, 22, 1.5, 1.5, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(...purpleDark);
  doc.text('4. OBSERVACIONES Y CONCLUSIONES INSTITUCIONALES:', 18, obsY + 5.5);

  const redCount = metrics.studentSummaries.filter(s => s.alertaNivel === 'rojo').length;
  const yellowCount = metrics.studentSummaries.filter(s => s.alertaNivel === 'amarillo').length;

  let observationText = `Durante el periodo evaluado en el ${courseName}, se registró un porcentaje global de asistencia del ${metrics.porcentajeAsistencia}% y un ausentismo del ${metrics.porcentajeAusentismo}%, sobre un total de ${metrics.sessionsCount} sesiones registradas (${metrics.totalEsperados} registros esperados). `;
  
  if (redCount > 0) {
    observationText += `Se identificaron ${redCount} estudiante(s) con nivel de ausentismo superior al umbral crítico institucional (${config.umbralRojo}%), requiriendo seguimiento prioritario por coordinación y orientación escolar. `;
  } else {
    observationText += `No se registran estudiantes en nivel de alerta crítica superior al umbral configurado. `;
  }

  if (yellowCount > 0) {
    observationText += `${yellowCount} estudiante(s) se ubican en rango preventivo moderado (${config.umbralVerde}% - ${config.umbralAmarillo}%).`;
  }

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.2);
  doc.setTextColor(...slateDark);
  const splitObs = doc.splitTextToSize(observationText, pageWidth - 36);
  doc.text(splitObs, 18, obsY + 10.5);

  // SECTION 5: Firmas y Responsables
  let sigY = obsY + 34;
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

  // 1. Docente / Director
  doc.line(sig1, sigY, sig1 + sigWidth, sigY);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(...slateDark);
  doc.text('DOCENTE / TITULAR', sig1 + sigWidth / 2, sigY + 4, { align: 'center' });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.5);
  doc.setTextColor(...slateMuted);
  doc.text('Registro y Verificación', sig1 + sigWidth / 2, sigY + 7.5, { align: 'center' });

  // 2. Coordinación Académica
  doc.line(sig2, sigY, sig2 + sigWidth, sigY);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(...slateDark);
  doc.text('COORDINACIÓN ACADÉMICA', sig2 + sigWidth / 2, sigY + 4, { align: 'center' });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.5);
  doc.setTextColor(...slateMuted);
  doc.text('Validación y Seguimiento', sig2 + sigWidth / 2, sigY + 7.5, { align: 'center' });

  // 3. Rectoría
  doc.line(sig3, sigY, sig3 + sigWidth, sigY);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(...slateDark);
  doc.text('RECTORÍA INSTITUCIONAL', sig3 + sigWidth / 2, sigY + 4, { align: 'center' });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.5);
  doc.setTextColor(...slateMuted);
  doc.text('I. E. Juan Pablo I', sig3 + sigWidth / 2, sigY + 7.5, { align: 'center' });

  // Footers on all pages
  const totalPages = (doc.internal as any).getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(...slateMuted);
    doc.text(
      `Institución Educativa Juan Pablo I • La Llanada, Nariño • Sistema de Gestión y Asistencia Estudiantil`,
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

  return doc;
}

/**
 * =========================================================================
 * 3. FUNCIÓN PRINCIPAL DE DESCARGA DE INFORMES EN PDF
 * =========================================================================
 */
export async function downloadAttendanceReportPdf(options: AttendancePdfExportOptions): Promise<void> {
  const {
    schoolYear,
    courseName,
    reportType = 'matrix' // Por defecto genera la sábana de control por fechas solicitada por el usuario
  } = options;

  let doc: jsPDF;

  if (reportType === 'executive') {
    doc = await generateAttendanceExecutiveDoc(options);
  } else {
    // 'matrix' o 'complete'
    doc = await generateAttendanceMatrixDoc(options);
  }

  const safeCourse = courseName.replace(/[^a-zA-Z0-9]/g, '_');
  const prefix = reportType === 'executive' ? 'Informe_Ejecutivo_Asistencia' : 'Sabana_Fechas_Asistencia';
  const safeFilename = `${prefix}_${safeCourse}_${schoolYear}.pdf`;
  doc.save(safeFilename);
}
