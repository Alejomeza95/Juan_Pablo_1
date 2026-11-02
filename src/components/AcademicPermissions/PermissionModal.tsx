import React, { useState } from 'react';
import { 
  X, 
  FileText, 
  Upload, 
  Calendar, 
  Clock, 
  CheckCircle2, 
  AlertCircle, 
  FileCheck2, 
  Trash2, 
  Save, 
  Loader2 
} from 'lucide-react';
import { StudentRecord, AcademicPermissionRecord } from '../../types';
import { saveAcademicPermission } from '../../utils/academicPermissionsService';

interface PermissionModalProps {
  student: StudentRecord;
  courseName: string;
  schoolYear: number;
  initialDate?: string;
  existingPermission?: AcademicPermissionRecord | null;
  currentUserEmail: string;
  onClose: () => void;
  onSaved: (permission: AcademicPermissionRecord) => void;
}

const COMMON_REASONS = [
  'Cita Médica / Odontológica',
  'Calamidad Doméstica Familiar',
  'Representación Deportiva Institucional',
  'Representación Cultural / Artística',
  'Diligencia Personal / Familiar Inaplazable',
  'Incapacidad Médica Transitoria',
  'Trámite de Documento de Identidad'
];

export function PermissionModal({
  student,
  courseName,
  schoolYear,
  initialDate = new Date().toISOString().split('T')[0],
  existingPermission,
  currentUserEmail,
  onClose,
  onSaved
}: PermissionModalProps) {
  const [fecha, setFecha] = useState<string>(existingPermission?.fecha || initialDate);
  const [tipoRango, setTipoRango] = useState<'dia_completo' | 'rango_horas'>(
    existingPermission?.tipoRango || 'dia_completo'
  );
  const [horaInicio, setHoraInicio] = useState<string>(existingPermission?.horaInicio || '07:30');
  const [horaFin, setHoraFin] = useState<string>(existingPermission?.horaFin || '10:30');
  const [motivo, setMotivo] = useState<string>(existingPermission?.motivo || '');
  const [observaciones, setObservaciones] = useState<string>(existingPermission?.observaciones || '');
  const [estado, setEstado] = useState<'aprobado' | 'pendiente' | 'rechazado'>(
    existingPermission?.estado || 'aprobado'
  );

  // PDF File handling
  const [archivoPdfNombre, setArchivoPdfNombre] = useState<string | undefined>(
    existingPermission?.archivoPdfNombre
  );
  const [archivoPdfBase64, setArchivoPdfBase64] = useState<string | undefined>(
    existingPermission?.archivoPdfBase64
  );
  const [archivoTamano, setArchivoTamano] = useState<string | undefined>(
    existingPermission?.archivoTamano
  );

  const [isSaving, setIsSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.type !== 'application/pdf') {
      setErrorMsg("El archivo debe ser un documento en formato PDF.");
      return;
    }

    if (file.size > 8 * 1024 * 1024) { // Max 8MB
      setErrorMsg("El archivo excede el tamaño máximo permitido (8MB).");
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      setArchivoPdfBase64(reader.result as string);
      setArchivoPdfNombre(file.name);
      const sizeKb = (file.size / 1024).toFixed(1);
      setArchivoTamano(`${sizeKb} KB`);
      setErrorMsg(null);
    };
    reader.onerror = () => {
      setErrorMsg("Error al leer el archivo PDF.");
    };
    reader.readAsDataURL(file);
  };

  const handleRemoveFile = () => {
    setArchivoPdfNombre(undefined);
    setArchivoPdfBase64(undefined);
    setArchivoTamano(undefined);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (!motivo.trim()) {
      setErrorMsg("Por favor ingresa o selecciona el motivo del permiso académico.");
      return;
    }

    if (!fecha) {
      setErrorMsg("Por favor selecciona la fecha del permiso.");
      return;
    }

    if (tipoRango === 'rango_horas' && (!horaInicio || !horaFin)) {
      setErrorMsg("Por favor especifica tanto la hora de inicio como la de fin.");
      return;
    }

    setIsSaving(true);
    try {
      const result = await saveAcademicPermission({
        id: existingPermission?.id,
        year: schoolYear,
        anioEscolarId: student.anioEscolarId || `year_${schoolYear}`,
        cursoId: student.cursoId,
        cursoNombre: courseName,
        studentId: student.id,
        codigo: student.codigo,
        nombres: student.nombres,
        apellidos: student.apellidos,
        nombreCompleto: student.nombreCompleto,
        fecha,
        tipoRango,
        horaInicio: tipoRango === 'rango_horas' ? horaInicio : undefined,
        horaFin: tipoRango === 'rango_horas' ? horaFin : undefined,
        motivo: motivo.trim(),
        archivoPdfNombre,
        archivoPdfBase64,
        archivoTamano,
        estado,
        observaciones: observaciones.trim(),
        registradoPor: currentUserEmail || 'Coordinación'
      });

      onSaved(result.permission);
      onClose();
    } catch (err: any) {
      console.error("Error al guardar permiso:", err);
      setErrorMsg(err.message || "Error al procesar el permiso académico.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-2.5 sm:p-4">
      <div className="bg-white rounded-2xl max-w-xl w-full shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[95vh] sm:max-h-[92vh]">
        {/* Header */}
        <div className="px-4 sm:px-6 py-3.5 sm:py-4 bg-purple-700 text-white flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-purple-800 rounded-xl shrink-0">
              <FileCheck2 className="w-5 h-5 text-amber-300" />
            </div>
            <div>
              <h3 className="font-black text-sm">
                {existingPermission ? 'Modificar Permiso Académico' : 'Registrar Permiso Académico'}
              </h3>
              <p className="text-xs text-purple-200 truncate max-w-[220px] sm:max-w-none">
                {student.nombreCompleto} ({student.codigo}) • {courseName}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-purple-200 hover:text-white rounded-lg hover:bg-purple-800 transition-colors shrink-0"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-4 sm:p-6 overflow-y-auto space-y-4 text-xs">
          {errorMsg && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Fecha y Rango Horario */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="font-bold text-slate-700 flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5 text-purple-600" />
                <span>Fecha del Permiso *</span>
              </label>
              <input
                type="date"
                value={fecha}
                onChange={(e) => setFecha(e.target.value)}
                required
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-purple-500"
              />
            </div>

            <div className="space-y-1.5">
              <label className="font-bold text-slate-700 flex items-center gap-1">
                <Clock className="w-3.5 h-3.5 text-purple-600" />
                <span>Modalidad del Permiso *</span>
              </label>
              <div className="grid grid-cols-2 gap-1.5">
                <button
                  type="button"
                  onClick={() => setTipoRango('dia_completo')}
                  className={`py-2 px-2 rounded-xl text-center font-bold border transition-all ${
                    tipoRango === 'dia_completo'
                      ? 'bg-purple-600 text-white border-purple-600 shadow-2xs'
                      : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  Día Completo
                </button>
                <button
                  type="button"
                  onClick={() => setTipoRango('rango_horas')}
                  className={`py-2 px-2 rounded-xl text-center font-bold border transition-all ${
                    tipoRango === 'rango_horas'
                      ? 'bg-purple-600 text-white border-purple-600 shadow-2xs'
                      : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  Por Horas
                </button>
              </div>
            </div>
          </div>

          {/* Rango de Horas (si aplica) */}
          {tipoRango === 'rango_horas' && (
            <div className="p-3 bg-purple-50/60 border border-purple-100 rounded-xl grid grid-cols-2 gap-3 animate-in fade-in">
              <div className="space-y-1">
                <label className="text-[11px] font-bold text-purple-900">Hora de Inicio *</label>
                <input
                  type="time"
                  value={horaInicio}
                  onChange={(e) => setHoraInicio(e.target.value)}
                  className="w-full px-2.5 py-1.5 bg-white border border-purple-200 rounded-lg font-bold text-purple-950 focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[11px] font-bold text-purple-900">Hora de Fin *</label>
                <input
                  type="time"
                  value={horaFin}
                  onChange={(e) => setHoraFin(e.target.value)}
                  className="w-full px-2.5 py-1.5 bg-white border border-purple-200 rounded-lg font-bold text-purple-950 focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
              </div>
            </div>
          )}

          {/* Motivo */}
          <div className="space-y-1.5">
            <label className="font-bold text-slate-700 flex items-center justify-between">
              <span>Motivo / Justificación *</span>
              <span className="text-[10px] text-slate-400 font-normal">Sustento oficial</span>
            </label>
            <textarea
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              placeholder="Describe el motivo por el cual se autoriza el permiso..."
              rows={2}
              required
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 font-medium focus:outline-none focus:ring-2 focus:ring-purple-500"
            />

            {/* Opciones rápidas */}
            <div className="flex flex-wrap gap-1.5 pt-1">
              {COMMON_REASONS.map(r => (
                <button
                  key={r}
                  type="button"
                  onClick={() => setMotivo(r)}
                  className="px-2 py-0.5 bg-slate-100 hover:bg-purple-100 hover:text-purple-800 text-slate-600 rounded-md text-[10px] font-medium border border-slate-200 transition-colors"
                >
                  {r}
                </button>
              ))}
            </div>
          </div>

          {/* Subir Soporte PDF */}
          <div className="space-y-1.5">
            <label className="font-bold text-slate-700 flex items-center justify-between">
              <span>Documento de Soporte / Evidencia (PDF)</span>
              <span className="text-[10px] text-slate-400 font-normal">Opcional</span>
            </label>

            {archivoPdfNombre ? (
              <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <FileText className="w-5 h-5 text-emerald-600 shrink-0" />
                  <div>
                    <span className="font-bold text-emerald-900 block truncate max-w-xs">{archivoPdfNombre}</span>
                    <span className="text-[10px] text-emerald-700">{archivoTamano || 'PDF adjunto'}</span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handleRemoveFile}
                  className="p-1 text-rose-500 hover:text-rose-700 hover:bg-rose-100 rounded-lg transition-colors"
                  title="Quitar archivo"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <label className="flex flex-col items-center justify-center p-4 border-2 border-dashed border-slate-200 hover:border-purple-400 rounded-xl cursor-pointer bg-slate-50 hover:bg-purple-50/50 transition-colors">
                <Upload className="w-5 h-5 text-slate-400 mb-1" />
                <span className="font-bold text-slate-700 text-xs">Cargar archivo PDF de soporte</span>
                <span className="text-[10px] text-slate-400">Certificado médico, carta de acudiente o autorización (máx. 8MB)</span>
                <input
                  type="file"
                  accept="application/pdf"
                  onChange={handleFileUpload}
                  className="hidden"
                />
              </label>
            )}
          </div>

          {/* Estado del Permiso */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
            <div className="space-y-1.5">
              <label className="font-bold text-slate-700">Estado de Autorización</label>
              <select
                value={estado}
                onChange={(e) => setEstado(e.target.value as any)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-bold text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-purple-500"
              >
                <option value="aprobado">Aprobado / Autorizado</option>
                <option value="pendiente">Pendiente de Aprobación</option>
                <option value="rechazado">Rechazado</option>
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="font-bold text-slate-700">Observaciones Adicionales</label>
              <input
                type="text"
                value={observaciones}
                onChange={(e) => setObservaciones(e.target.value)}
                placeholder="Notas de coordinación..."
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-purple-500"
              />
            </div>
          </div>

          {/* Footer Actions */}
          <div className="pt-4 border-t border-slate-100 flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              disabled={isSaving}
              className="w-full sm:w-auto px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl transition-colors text-center"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className="w-full sm:w-auto flex items-center justify-center gap-1.5 px-5 py-2.5 bg-purple-700 hover:bg-purple-800 text-white font-bold rounded-xl shadow-xs transition-all hover:scale-102 active:scale-98 disabled:opacity-50"
            >
              {isSaving ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin shrink-0" />
                  <span>Guardando Permiso...</span>
                </>
              ) : (
                <>
                  <Save className="w-4 h-4 shrink-0" />
                  <span>Guardar Permiso</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
