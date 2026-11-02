import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import { AcademicEvent, EventType } from '../types';
import { getColombianHolidays } from './colombianHolidays';

export type PdfExportOptions = {
  includeHolidays?: boolean;
  selectedYear?: number;
  monthFilter?: number | null; // 0-11, or null for all year
  filterType?: EventType | 'all';
};

const eventTypeConfig: Record<EventType, { label: string; color: [number, number, number]; textColor: [number, number, number]; bg: [number, number, number] }> = {
  exam: {
    label: 'Evaluación / Examen',
    color: [124, 58, 237], // Purple
    textColor: [91, 33, 182],
    bg: [243, 232, 255]
  },
  assignment: {
    label: 'Entrega / Tarea',
    color: [217, 119, 6], // Amber
    textColor: [146, 64, 14],
    bg: [254, 243, 199]
  },
  event: {
    label: 'Evento Institucional',
    color: [37, 99, 235], // Blue
    textColor: [30, 64, 175],
    bg: [224, 231, 255]
  },
  holiday: {
    label: 'Festivo / Vacaciones',
    color: [220, 38, 38], // Red
    textColor: [153, 27, 27],
    bg: [254, 226, 226]
  }
};

/**
 * Loads an image from a URL and converts it to base64 DataURL
 */
async function getBase64ImageFromUrl(imageUrl: string): Promise<string | null> {
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
    console.warn('Could not load logo for PDF:', e);
    return null;
  }
}

/**
 * Generates and downloads a beautifully formatted PDF of the Academic Agenda.
 */
export async function downloadAgendaPdf(
  rawEvents: AcademicEvent[],
  options: PdfExportOptions = {}
): Promise<void> {
  const {
    includeHolidays = true,
    selectedYear = new Date().getFullYear(),
    monthFilter = null,
    filterType = 'all'
  } = options;

  // 1. Gather all events (academic + holidays if requested)
  let allEvents: AcademicEvent[] = [...rawEvents];

  if (includeHolidays) {
    const holidays = getColombianHolidays(selectedYear);
    const holidayEvents: AcademicEvent[] = holidays.map(h => ({
      id: `holiday-${h.date}`,
      title: h.name,
      description: 'Festivo Nacional de Colombia',
      date: h.date,
      type: 'holiday',
      isAllDay: true,
      createdBy: 'Sistema',
      createdAt: 0
    }));
    allEvents = [...allEvents, ...holidayEvents];
  }

  // 2. Filter by month or type if specified
  if (monthFilter !== null) {
    allEvents = allEvents.filter(e => {
      try {
        const d = parseISO(e.date);
        return d.getFullYear() === selectedYear && d.getMonth() === monthFilter;
      } catch {
        return false;
      }
    });
  } else if (selectedYear) {
    allEvents = allEvents.filter(e => {
      try {
        const d = parseISO(e.date);
        return d.getFullYear() === selectedYear;
      } catch {
        return true;
      }
    });
  }

  if (filterType !== 'all') {
    allEvents = allEvents.filter(e => e.type === filterType);
  }

  // 3. Sort strictly chronologically
  allEvents.sort((a, b) => {
    if (a.date !== b.date) {
      return a.date.localeCompare(b.date);
    }
    // If same date, all day events first, then by startTime
    if (a.isAllDay && !b.isAllDay) return -1;
    if (!a.isAllDay && b.isAllDay) return 1;
    const timeA = a.startTime || '00:00';
    const timeB = b.startTime || '00:00';
    return timeA.localeCompare(timeB);
  });

  // 4. Initialize jsPDF (Portrait, A4, mm)
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4'
  });

  const pageWidth = doc.internal.pageSize.getWidth(); // 210mm
  const pageHeight = doc.internal.pageSize.getHeight(); // 297mm

  // Load Logo
  const logoBase64 = await getBase64ImageFromUrl('/JUANI.png');

  // Colors
  const primaryColor = [30, 41, 59]; // Slate 800
  const indigoColor = [67, 56, 202]; // Indigo 700
  const accentGold = [217, 119, 6];

  // Header Banner Background
  doc.setFillColor(248, 250, 252); // soft slate 50
  doc.rect(0, 0, pageWidth, 42, 'F');

  // Decorative top colored bar
  doc.setFillColor(indigoColor[0], indigoColor[1], indigoColor[2]);
  doc.rect(0, 0, pageWidth, 4, 'F');

  // Thin gold sub-stripe
  doc.setFillColor(accentGold[0], accentGold[1], accentGold[2]);
  doc.rect(0, 4, pageWidth, 1, 'F');

  // Embed Logo on top left if available
  let textStartX = 14;
  if (logoBase64) {
    try {
      doc.addImage(logoBase64, 'PNG', 14, 8, 24, 24);
      textStartX = 42;
    } catch {
      textStartX = 14;
    }
  }

  // Header Titles
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
  doc.text('INSTITUCIÓN EDUCATIVA JUAN PABLO I', textStartX, 15);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(indigoColor[0], indigoColor[1], indigoColor[2]);
  doc.text('AGENDA Y CALENDARIO ACADÉMICO OFICIAL', textStartX, 21);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(100, 116, 139); // Slate 500

  const subtitlePeriod = monthFilter !== null
    ? `${format(new Date(selectedYear, monthFilter, 1), 'MMMM yyyy', { locale: es }).toUpperCase()}`
    : `AÑO ESCOLAR ${selectedYear}`;
  
  doc.text(`Período: ${subtitlePeriod}  |  Cronograma Oficial de Actividades`, textStartX, 27);
  doc.text(`Fecha de emisión: ${format(new Date(), "d 'de' MMMM 'de' yyyy, h:mm a", { locale: es })}`, textStartX, 32);

  // Status badge on the top right
  const badgeWidth = 48;
  const badgeX = pageWidth - badgeWidth - 14;
  doc.setFillColor(238, 242, 255); // Indigo 50
  doc.roundedRect(badgeX, 12, badgeWidth, 18, 2, 2, 'F');
  doc.setDrawColor(199, 210, 254);
  doc.roundedRect(badgeX, 12, badgeWidth, 18, 2, 2, 'S');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(indigoColor[0], indigoColor[1], indigoColor[2]);
  doc.text('TOTAL REGISTROS', badgeX + (badgeWidth / 2), 18, { align: 'center' });

  doc.setFontSize(12);
  doc.text(`${allEvents.length} Eventos`, badgeX + (badgeWidth / 2), 26, { align: 'center' });

  // Divider line
  doc.setDrawColor(226, 232, 240);
  doc.line(14, 42, pageWidth - 14, 42);

  // Summary Category Pills on page 1
  const examCount = allEvents.filter(e => e.type === 'exam').length;
  const assignCount = allEvents.filter(e => e.type === 'assignment').length;
  const eventCount = allEvents.filter(e => e.type === 'event').length;
  const holidayCount = allEvents.filter(e => e.type === 'holiday').length;

  const pillY = 47;
  const pillHeight = 7;
  const marginX = 14;
  const availableWidth = pageWidth - (marginX * 2);
  const colWidth = availableWidth / 4;

  const summaryItems = [
    { label: 'Exámenes', count: examCount, color: [124, 58, 237], bg: [243, 232, 255] },
    { label: 'Entregas', count: assignCount, color: [217, 119, 6], bg: [254, 243, 199] },
    { label: 'Institucionales', count: eventCount, color: [37, 99, 235], bg: [224, 231, 255] },
    { label: 'Festivos', count: holidayCount, color: [220, 38, 38], bg: [254, 226, 226] }
  ];

  summaryItems.forEach((item, index) => {
    const x = marginX + (index * colWidth);
    doc.setFillColor(item.bg[0], item.bg[1], item.bg[2]);
    doc.roundedRect(x, pillY, colWidth - 3, pillHeight, 1.5, 1.5, 'F');
    
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.setTextColor(item.color[0], item.color[1], item.color[2]);
    doc.text(`${item.label}: ${item.count}`, x + ((colWidth - 3) / 2), pillY + 4.8, { align: 'center' });
  });

  // Table Data Preparation
  const tableData = allEvents.map((event) => {
    let formattedDate = event.date;
    let dayOfWeek = '';
    try {
      const parsedDate = parseISO(event.date);
      formattedDate = format(parsedDate, "d 'de' MMM, yyyy", { locale: es });
      dayOfWeek = format(parsedDate, 'EEEE', { locale: es });
      dayOfWeek = dayOfWeek.charAt(0).toUpperCase() + dayOfWeek.slice(1);
    } catch {
      // fallback
    }

    let timeString = 'Todo el día';
    if (!event.isAllDay && (event.startTime || event.endTime)) {
      timeString = `${event.startTime || '--:--'} a ${event.endTime || '--:--'}`;
    }

    const typeConfig = eventTypeConfig[event.type] || eventTypeConfig.event;

    return [
      `${dayOfWeek}\n${formattedDate}`,
      timeString,
      typeConfig.label,
      event.title,
      event.description || 'Sin descripción adicional'
    ];
  });

  // Generate Table with autoTable
  autoTable(doc, {
    startY: 58,
    head: [['Fecha', 'Horario', 'Categoría', 'Título del Evento', 'Detalles / Observaciones']],
    body: tableData,
    theme: 'striped',
    margin: { top: 46, right: 14, bottom: 20, left: 14 },
    styles: {
      font: 'helvetica',
      fontSize: 8,
      cellPadding: 3,
      overflow: 'linebreak',
      valign: 'middle',
      textColor: [51, 65, 85]
    },
    headStyles: {
      fillColor: [30, 41, 59], // Navy slate
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 8.5,
      halign: 'left',
      cellPadding: 3.5
    },
    alternateRowStyles: {
      fillColor: [248, 250, 252] // Slate 50
    },
    columnStyles: {
      0: { cellWidth: 32, fontStyle: 'bold' }, // Fecha
      1: { cellWidth: 26, halign: 'center' },  // Horario
      2: { cellWidth: 34 },                    // Categoría
      3: { cellWidth: 42, fontStyle: 'bold' }, // Título
      4: { cellWidth: 'auto' }                 // Detalles
    },
    didDrawCell: (data) => {
      // Highlight Category column with custom color text
      if (data.section === 'body' && data.column.index === 2) {
        const rowEvent = allEvents[data.row.index];
        if (rowEvent) {
          const cfg = eventTypeConfig[rowEvent.type];
          if (cfg) {
            doc.setTextColor(cfg.textColor[0], cfg.textColor[1], cfg.textColor[2]);
          }
        }
      }
    },
    didDrawPage: (data) => {
      // Header repeated only on subsequent pages
      if (data.pageNumber > 1) {
        doc.setFillColor(248, 250, 252);
        doc.rect(0, 0, pageWidth, 18, 'F');

        doc.setFillColor(indigoColor[0], indigoColor[1], indigoColor[2]);
        doc.rect(0, 0, pageWidth, 2, 'F');

        doc.setFont('helvetica', 'bold');
        doc.setFontSize(8);
        doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
        doc.text('I.E. JUAN PABLO I - CALENDARIO ACADÉMICO', 14, 11);

        doc.setFont('helvetica', 'normal');
        doc.setFontSize(7.5);
        doc.setTextColor(100, 116, 139);
        doc.text(`Período: ${subtitlePeriod}`, pageWidth - 14, 11, { align: 'right' });

        doc.setDrawColor(226, 232, 240);
        doc.line(14, 18, pageWidth - 14, 18);
      }

      // Footer on all pages
      const totalPagesExp = '{total_pages_count_string}';
      const footerY = pageHeight - 10;

      doc.setDrawColor(226, 232, 240);
      doc.line(14, footerY - 4, pageWidth - 14, footerY - 4);

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7.5);
      doc.setTextColor(148, 163, 184); // Slate 400

      doc.text(
        'Institución Educativa Juan Pablo I • Documento Oficial de Agenda Escolar',
        14,
        footerY
      );

      const pageStr = `Página ${data.pageNumber} de ${totalPagesExp}`;
      doc.text(pageStr, pageWidth - 14, footerY, { align: 'right' });
    }
  });

  // Calculate total pages for footer placeholder replacement
  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(148, 163, 184);
    
    // Replace placeholder
    const pageString = `Página ${i} de ${totalPages}`;
    doc.setFillColor(255, 255, 255);
    doc.rect(pageWidth - 38, pageHeight - 12, 38, 5, 'F');
    doc.text(pageString, pageWidth - 14, pageHeight - 10, { align: 'right' });
  }

  // File Name
  const cleanPeriod = subtitlePeriod.replace(/\s+/g, '_');
  const fileName = `Agenda_Academica_Juan_Pablo_I_${cleanPeriod}.pdf`;

  // Download PDF
  doc.save(fileName);
}
