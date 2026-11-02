import { format, addDays } from 'date-fns';

export interface Holiday {
  date: string; // YYYY-MM-DD
  name: string;
}

// Calcula el Domingo de Pascua para un año dado (Algoritmo de Computus)
function getEasterSunday(year: number): Date {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  
  return new Date(year, month - 1, day);
}

// Mueve una fecha al próximo lunes si no es lunes (Ley Emiliani)
function nextMonday(date: Date): Date {
  const day = date.getDay();
  if (day === 1) return date; // Ya es lunes
  
  const daysToAdd = day === 0 ? 1 : 8 - day;
  return addDays(date, daysToAdd);
}

export function getColombianHolidays(year: number): Holiday[] {
  const holidays: { date: Date; name: string }[] = [];
  const easter = getEasterSunday(year);

  // --- Festivos Fijos ---
  holidays.push({ date: new Date(year, 0, 1), name: 'Año Nuevo' });
  holidays.push({ date: new Date(year, 4, 1), name: 'Día del Trabajo' });
  holidays.push({ date: new Date(year, 6, 20), name: 'Grito de Independencia' });
  holidays.push({ date: new Date(year, 7, 7), name: 'Batalla de Boyacá' });
  holidays.push({ date: new Date(year, 11, 8), name: 'Inmaculada Concepción' });
  holidays.push({ date: new Date(year, 11, 25), name: 'Navidad' });

  // --- Festivos Fijos trasladables al lunes (Ley Emiliani) ---
  holidays.push({ date: nextMonday(new Date(year, 0, 6)), name: 'Día de los Reyes Magos' });
  holidays.push({ date: nextMonday(new Date(year, 2, 19)), name: 'Día de San José' });
  holidays.push({ date: nextMonday(new Date(year, 5, 29)), name: 'San Pedro y San Pablo' });
  holidays.push({ date: nextMonday(new Date(year, 7, 15)), name: 'Asunción de la Virgen' });
  holidays.push({ date: nextMonday(new Date(year, 9, 12)), name: 'Día de la Raza' });
  holidays.push({ date: nextMonday(new Date(year, 10, 1)), name: 'Todos los Santos' });
  holidays.push({ date: nextMonday(new Date(year, 10, 11)), name: 'Independencia de Cartagena' });

  // --- Festivos relativos a la Pascua ---
  holidays.push({ date: addDays(easter, -3), name: 'Jueves Santo' });
  holidays.push({ date: addDays(easter, -2), name: 'Viernes Santo' });
  holidays.push({ date: addDays(easter, 43), name: 'Ascensión de Jesús' }); // Jueves -> +43 Lunes
  holidays.push({ date: addDays(easter, 64), name: 'Corpus Christi' });     // Jueves -> +64 Lunes
  holidays.push({ date: addDays(easter, 71), name: 'Sagrado Corazón' });    // Viernes -> +71 Lunes

  // Ordenar y formatear a YYYY-MM-DD
  return holidays
    .sort((a, b) => a.date.getTime() - b.date.getTime())
    .map(h => ({
      date: format(h.date, 'yyyy-MM-dd'),
      name: h.name
    }));
}
