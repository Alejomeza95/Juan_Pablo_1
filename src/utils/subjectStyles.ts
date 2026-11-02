export interface SubjectStyle {
  bg: string;
  border: string;
  borderAccent: string;
  text: string;
  badgeBg: string;
  badgeText: string;
  dot: string;
  category: string;
}

const DEFAULT_STYLE: SubjectStyle = {
  bg: 'bg-slate-50 hover:bg-slate-100',
  border: 'border-slate-200',
  borderAccent: 'border-l-slate-400',
  text: 'text-slate-800',
  badgeBg: 'bg-slate-200',
  badgeText: 'text-slate-700',
  dot: 'bg-slate-400',
  category: 'General'
};

const SUBJECT_STYLES: Record<string, SubjectStyle> = {
  'Matemáticas': {
    bg: 'bg-blue-50/90 hover:bg-blue-100/90',
    border: 'border-blue-200',
    borderAccent: 'border-l-blue-600',
    text: 'text-blue-950',
    badgeBg: 'bg-blue-100',
    badgeText: 'text-blue-800',
    dot: 'bg-blue-600',
    category: 'Matemáticas'
  },
  'Física': {
    bg: 'bg-sky-50/90 hover:bg-sky-100/90',
    border: 'border-sky-200',
    borderAccent: 'border-l-sky-600',
    text: 'text-sky-950',
    badgeBg: 'bg-sky-100',
    badgeText: 'text-sky-800',
    dot: 'bg-sky-600',
    category: 'Ciencias Exactas'
  },
  'Español': {
    bg: 'bg-amber-50/90 hover:bg-amber-100/90',
    border: 'border-amber-200',
    borderAccent: 'border-l-amber-600',
    text: 'text-amber-950',
    badgeBg: 'bg-amber-100',
    badgeText: 'text-amber-800',
    dot: 'bg-amber-600',
    category: 'Humanidades'
  },
  'Biología': {
    bg: 'bg-emerald-50/90 hover:bg-emerald-100/90',
    border: 'border-emerald-200',
    borderAccent: 'border-l-emerald-600',
    text: 'text-emerald-950',
    badgeBg: 'bg-emerald-100',
    badgeText: 'text-emerald-800',
    dot: 'bg-emerald-600',
    category: 'Ciencias Naturales'
  },
  'Química': {
    bg: 'bg-teal-50/90 hover:bg-teal-100/90',
    border: 'border-teal-200',
    borderAccent: 'border-l-teal-600',
    text: 'text-teal-950',
    badgeBg: 'bg-teal-100',
    badgeText: 'text-teal-800',
    dot: 'bg-teal-600',
    category: 'Ciencias Naturales'
  },
  'Sociales': {
    bg: 'bg-violet-50/90 hover:bg-violet-100/90',
    border: 'border-violet-200',
    borderAccent: 'border-l-violet-600',
    text: 'text-violet-950',
    badgeBg: 'bg-violet-100',
    badgeText: 'text-violet-800',
    dot: 'bg-violet-600',
    category: 'Ciencias Sociales'
  },
  'Filosofía': {
    bg: 'bg-purple-50/90 hover:bg-purple-100/90',
    border: 'border-purple-200',
    borderAccent: 'border-l-purple-600',
    text: 'text-purple-950',
    badgeBg: 'bg-purple-100',
    badgeText: 'text-purple-800',
    dot: 'bg-purple-600',
    category: 'Filosofía'
  },
  'Inglés': {
    bg: 'bg-rose-50/90 hover:bg-rose-100/90',
    border: 'border-rose-200',
    borderAccent: 'border-l-rose-600',
    text: 'text-rose-950',
    badgeBg: 'bg-rose-100',
    badgeText: 'text-rose-800',
    dot: 'bg-rose-600',
    category: 'Idiomas'
  },
  'Educación Física': {
    bg: 'bg-lime-50/90 hover:bg-lime-100/90',
    border: 'border-lime-300',
    borderAccent: 'border-l-lime-600',
    text: 'text-lime-950',
    badgeBg: 'bg-lime-100',
    badgeText: 'text-lime-800',
    dot: 'bg-lime-600',
    category: 'Deportes'
  },
  'Artes': {
    bg: 'bg-pink-50/90 hover:bg-pink-100/90',
    border: 'border-pink-200',
    borderAccent: 'border-l-pink-600',
    text: 'text-pink-950',
    badgeBg: 'bg-pink-100',
    badgeText: 'text-pink-800',
    dot: 'bg-pink-600',
    category: 'Artes'
  },
  'Informática': {
    bg: 'bg-indigo-50/90 hover:bg-indigo-100/90',
    border: 'border-indigo-200',
    borderAccent: 'border-l-indigo-600',
    text: 'text-indigo-950',
    badgeBg: 'bg-indigo-100',
    badgeText: 'text-indigo-800',
    dot: 'bg-indigo-600',
    category: 'Tecnología'
  },
  'Análisis de Datos': {
    bg: 'bg-cyan-50/90 hover:bg-cyan-100/90',
    border: 'border-cyan-200',
    borderAccent: 'border-l-cyan-600',
    text: 'text-cyan-950',
    badgeBg: 'bg-cyan-100',
    badgeText: 'text-cyan-800',
    dot: 'bg-cyan-600',
    category: 'Tecnología'
  },
  'Religión': {
    bg: 'bg-emerald-50/70 hover:bg-emerald-100/70',
    border: 'border-emerald-200',
    borderAccent: 'border-l-emerald-500',
    text: 'text-emerald-900',
    badgeBg: 'bg-emerald-100',
    badgeText: 'text-emerald-800',
    dot: 'bg-emerald-500',
    category: 'Valores'
  },
  'Ética': {
    bg: 'bg-teal-50/70 hover:bg-teal-100/70',
    border: 'border-teal-200',
    borderAccent: 'border-l-teal-500',
    text: 'text-teal-900',
    badgeBg: 'bg-teal-100',
    badgeText: 'text-teal-800',
    dot: 'bg-teal-500',
    category: 'Valores'
  },
  'Economía': {
    bg: 'bg-orange-50/90 hover:bg-orange-100/90',
    border: 'border-orange-200',
    borderAccent: 'border-l-orange-600',
    text: 'text-orange-950',
    badgeBg: 'bg-orange-100',
    badgeText: 'text-orange-800',
    dot: 'bg-orange-600',
    category: 'Ciencias Económicas'
  },
  'Contabilidad': {
    bg: 'bg-slate-100/90 hover:bg-slate-200/90',
    border: 'border-slate-300',
    borderAccent: 'border-l-slate-700',
    text: 'text-slate-900',
    badgeBg: 'bg-slate-200',
    badgeText: 'text-slate-800',
    dot: 'bg-slate-700',
    category: 'Comercial'
  },
  'Secretariado': {
    bg: 'bg-stone-100/90 hover:bg-stone-200/90',
    border: 'border-stone-300',
    borderAccent: 'border-l-stone-700',
    text: 'text-stone-900',
    badgeBg: 'bg-stone-200',
    badgeText: 'text-stone-800',
    dot: 'bg-stone-700',
    category: 'Comercial'
  }
};

export function getSubjectStyle(subject: string): SubjectStyle {
  if (!subject) return DEFAULT_STYLE;
  return SUBJECT_STYLES[subject] || DEFAULT_STYLE;
}
