import React, { useState, useEffect, useRef } from 'react';
import { User } from 'firebase/auth';
import { 
  Users, 
  Upload, 
  FileSpreadsheet, 
  Check, 
  AlertTriangle, 
  Search, 
  Edit2, 
  UserX, 
  UserCheck, 
  Trash2, 
  Plus, 
  RefreshCw, 
  Loader2, 
  X, 
  Download,
  AlertCircle,
  HelpCircle,
  CheckCircle2,
  Calendar,
  Layers
} from 'lucide-react';
import { 
  StudentRecord, 
  SchoolGroupRecord, 
  AcademicYearConfigRecord,
  ExcelParsedStudent,
  ExcelImportSummary
} from '../../types';
import { 
  getStudentsByCourse, 
  saveStudentsBatch, 
  updateStudentRecord, 
  toggleStudentActiveStatus, 
  deleteStudentRecord, 
  parseStudentsExcelFile 
} from '../../utils/attendanceService';
import { ADMIN_EMAIL } from '../../firebase';

interface StudentsManagementTabProps {
  user: User;
  schoolYear: number;
  yearConfig: AcademicYearConfigRecord;
  availableGroups: SchoolGroupRecord[];
  selectedGroupId: string;
  onSelectGroup: (groupId: string) => void;
}

export function StudentsManagementTab({
  user,
  schoolYear,
  yearConfig,
  availableGroups,
  selectedGroupId,
  onSelectGroup
}: StudentsManagementTabProps) {
  // Todos los usuarios autorizados que acceden a Asistencia Estudiantil tienen permisos completos de gestión
  const isSuperAdmin = user.email?.toLowerCase() === ADMIN_EMAIL.toLowerCase();
  const isAdmin = true;
  const [students, setStudents] = useState<StudentRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterActiveOnly, setFilterActiveOnly] = useState(false);

  // Excel Modal State
  const [showImportModal, setShowImportModal] = useState(false);
  const [isProcessingFile, setIsProcessingFile] = useState(false);
  const [parsedRows, setParsedRows] = useState<ExcelParsedStudent[]>([]);
  const [importSummary, setImportSummary] = useState<ExcelImportSummary | null>(null);
  const [updateExisting, setUpdateExisting] = useState(true);
  const [selectedFileName, setSelectedFileName] = useState<string>('');
  const [isSavingBatch, setIsSavingBatch] = useState(false);
  const [importSuccessMsg, setImportSuccessMsg] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Manual Add / Edit Modal State
  const [editingStudent, setEditingStudent] = useState<StudentRecord | null>(null);
  const [showManualAddModal, setShowManualAddModal] = useState(false);
  const [studentForm, setStudentForm] = useState({
    codigo: '',
    apellidos: '',
    nombres: ''
  });
  const [formError, setFormError] = useState<string | null>(null);
  const [isSavingStudent, setIsSavingStudent] = useState(false);

  // Delete confirmation
  const [deletingStudent, setDeletingStudent] = useState<StudentRecord | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Load students when group or year changes
  const loadStudents = async () => {
    if (!selectedGroupId) return;
    setLoading(true);
    try {
      const data = await getStudentsByCourse(schoolYear, selectedGroupId);
      setStudents(data);
    } catch (e) {
      console.error("Error loading students:", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadStudents();
  }, [schoolYear, selectedGroupId]);

  // Handle Excel file selection
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setSelectedFileName(file.name);
    setIsProcessingFile(true);
    setImportSuccessMsg(null);

    try {
      const res = await parseStudentsExcelFile(file, students);
      setParsedRows(res.rows);
      setImportSummary(res.summary);
    } catch (err: any) {
      alert(`Error al procesar el archivo Excel: ${err.message || err}`);
      setParsedRows([]);
      setImportSummary(null);
    } finally {
      setIsProcessingFile(false);
    }
  };

  // Confirm import
  const handleConfirmImport = async () => {
    if (!selectedGroupId) {
      alert("Por favor selecciona un curso válido antes de importar.");
      return;
    }

    const validRows = parsedRows.filter(r => r.isValid);
    if (validRows.length === 0) {
      alert("No hay registros válidos para importar.");
      return;
    }

    setIsSavingBatch(true);
    try {
      const toSave = validRows.map(r => ({
        codigo: r.codigo,
        apellidos: r.apellidos,
        nombres: r.nombres,
        cursoId: selectedGroupId,
        anioEscolarId: yearConfig.id || `year_${schoolYear}`,
        year: schoolYear,
        activo: true
      }));

      const res = await saveStudentsBatch(toSave, { updateExisting });
      setImportSuccessMsg(`¡Importación exitosa! Se guardaron ${res.savedCount} estudiantes nuevos y se actualizaron ${res.updatedCount}.`);
      
      // Reload course students
      await loadStudents();

      setTimeout(() => {
        setShowImportModal(false);
        setParsedRows([]);
        setImportSummary(null);
        setSelectedFileName('');
        setImportSuccessMsg(null);
      }, 2000);
    } catch (err: any) {
      alert(`Error al guardar estudiantes: ${err.message || err}`);
    } finally {
      setIsSavingBatch(false);
    }
  };

  // Manual student save (new or edit)
  const handleSubmitStudentForm = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    const cod = studentForm.codigo.trim();
    const ape = studentForm.apellidos.trim();
    const nom = studentForm.nombres.trim();

    if (!cod) {
      setFormError("El código del estudiante es obligatorio.");
      return;
    }
    if (!ape) {
      setFormError("Los apellidos del estudiante son obligatorios.");
      return;
    }
    if (!nom) {
      setFormError("Los nombres del estudiante son obligatorios.");
      return;
    }

    setIsSavingStudent(true);
    try {
      if (editingStudent) {
        // Edit existing
        await updateStudentRecord({
          ...editingStudent,
          codigo: cod,
          apellidos: ape,
          nombres: nom
        });
        setEditingStudent(null);
      } else {
        // Add new
        await saveStudentsBatch([{
          codigo: cod,
          apellidos: ape,
          nombres: nom,
          cursoId: selectedGroupId,
          anioEscolarId: yearConfig.id || `year_${schoolYear}`,
          year: schoolYear,
          activo: true
        }], { updateExisting: true });
        setShowManualAddModal(false);
      }
      setStudentForm({ codigo: '', apellidos: '', nombres: '' });
      await loadStudents();
    } catch (err: any) {
      setFormError(err.message || 'Error al guardar el estudiante.');
    } finally {
      setIsSavingStudent(false);
    }
  };

  // Toggle active/inactive
  const handleToggleActive = async (st: StudentRecord) => {
    try {
      await toggleStudentActiveStatus(st.id, !st.activo);
      setStudents(prev => prev.map(item => item.id === st.id ? { ...item, activo: !st.activo } : item));
    } catch (e) {
      console.error("Error toggling status:", e);
    }
  };

  // Delete student
  const handleConfirmDelete = async () => {
    if (!deletingStudent) return;
    setIsDeleting(true);
    try {
      await deleteStudentRecord(deletingStudent.id);
      setStudents(prev => prev.filter(s => s.id !== deletingStudent.id));
      setDeletingStudent(null);
    } catch (err: any) {
      alert(`Error al eliminar estudiante: ${err.message || err}`);
    } finally {
      setIsDeleting(false);
    }
  };

  // Filtered list
  const filteredStudents = students.filter(st => {
    if (filterActiveOnly && !st.activo) return false;
    if (!searchTerm) return true;
    const term = searchTerm.toLowerCase();
    return (
      st.codigo.toLowerCase().includes(term) ||
      st.apellidos.toLowerCase().includes(term) ||
      st.nombres.toLowerCase().includes(term) ||
      st.nombreCompleto.toLowerCase().includes(term)
    );
  });

  const selectedGroupObj = availableGroups.find(g => g.id === selectedGroupId);
  const activeCount = students.filter(s => s.activo).length;
  const inactiveCount = students.length - activeCount;

  return (
    <div className="space-y-6">
      {/* Course Selector Bar & Actions */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2 px-3 py-2 bg-indigo-50 text-indigo-700 rounded-xl font-bold text-xs border border-indigo-100">
            <Calendar className="w-4 h-4 text-indigo-600" />
            <span>Año: {schoolYear}</span>
          </div>

          <div className="flex items-center gap-2">
            <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">
              Curso / Grupo:
            </label>
            <select
              value={selectedGroupId}
              onChange={(e) => onSelectGroup(e.target.value)}
              className="px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-purple-500"
            >
              {availableGroups.length === 0 ? (
                <option value="">No hay cursos registrados en Año Escolar</option>
              ) : (
                availableGroups.map(g => (
                  <option key={g.id} value={g.id}>
                    {g.displayName} ({g.gradeName})
                  </option>
                ))
              )}
            </select>
          </div>

          {selectedGroupObj && (
            <div className="flex items-center gap-2 text-xs">
              <span className="px-2.5 py-1 bg-emerald-50 text-emerald-700 font-bold rounded-lg border border-emerald-200">
                {activeCount} Activos
              </span>
              {inactiveCount > 0 && (
                <span className="px-2.5 py-1 bg-slate-100 text-slate-600 font-semibold rounded-lg border border-slate-200">
                  {inactiveCount} Inactivos
                </span>
              )}
            </div>
          )}
        </div>

        <div className="flex flex-wrap sm:flex-nowrap items-center gap-2 w-full lg:w-auto justify-stretch sm:justify-end">
          <button
            type="button"
            onClick={loadStudents}
            disabled={loading}
            className="p-2.5 text-slate-500 hover:text-slate-800 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors shrink-0"
            title="Recargar estudiantes"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-purple-600' : ''}`} />
          </button>

          {isAdmin && (
            <>
              <button
                type="button"
                onClick={() => {
                  setStudentForm({ codigo: '', apellidos: '', nombres: '' });
                  setEditingStudent(null);
                  setShowManualAddModal(true);
                }}
                disabled={!selectedGroupId}
                className="flex-1 sm:flex-initial flex items-center justify-center gap-1.5 px-3.5 py-2.5 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-xl text-xs font-bold transition-all shadow-2xs disabled:opacity-50"
              >
                <Plus className="w-4 h-4 text-purple-600 shrink-0" />
                <span className="whitespace-nowrap">Agregar Manual</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setParsedRows([]);
                  setImportSummary(null);
                  setSelectedFileName('');
                  setImportSuccessMsg(null);
                  setShowImportModal(true);
                }}
                disabled={!selectedGroupId}
                className="flex-1 sm:flex-initial flex items-center justify-center gap-2 px-4 py-2.5 bg-purple-700 hover:bg-purple-800 text-white rounded-xl text-xs font-bold transition-all shadow-xs hover:scale-102 active:scale-98 disabled:opacity-50"
              >
                <FileSpreadsheet className="w-4 h-4 shrink-0" />
                <span className="whitespace-nowrap">Importar desde Excel</span>
              </button>
            </>
          )}
        </div>
      </div>

      {/* Search and Filters Bar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Buscar por código, nombres o apellidos..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:outline-none focus:ring-2 focus:ring-purple-500 focus:bg-white"
          />
        </div>

        <div className="flex items-center gap-3 w-full sm:w-auto justify-end">
          <label className="flex items-center gap-2 text-xs font-medium text-slate-600 cursor-pointer">
            <input
              type="checkbox"
              checked={filterActiveOnly}
              onChange={(e) => setFilterActiveOnly(e.target.checked)}
              className="rounded text-purple-600 focus:ring-purple-500"
            />
            <span>Solo estudiantes activos</span>
          </label>
        </div>
      </div>

      {/* Students Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Users className="w-5 h-5 text-purple-600" />
            <h3 className="font-bold text-slate-900 text-base">
              Estudiantes Matriculados en {selectedGroupObj ? selectedGroupObj.displayName : 'Curso Seleccionado'}
            </h3>
          </div>
          <span className="text-xs font-bold text-slate-500">
            {filteredStudents.length} {filteredStudents.length === 1 ? 'estudiante' : 'estudiantes'}
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[600px] text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold uppercase tracking-wider">
                <th className="py-3 px-4 w-12 text-center">N°</th>
                <th className="py-3 px-4 w-28">Código</th>
                <th className="py-3 px-4">Apellidos</th>
                <th className="py-3 px-4">Nombres</th>
                <th className="py-3 px-4 w-28 text-center">Estado</th>
                <th className="py-3 px-4 w-28 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-slate-400">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <Loader2 className="w-6 h-6 animate-spin text-purple-600" />
                      <span>Cargando listado de estudiantes...</span>
                    </div>
                  </td>
                </tr>
              ) : filteredStudents.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-slate-400">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <Users className="w-8 h-8 text-slate-300" />
                      <p className="font-semibold text-slate-600 text-sm">
                        {students.length === 0 
                          ? 'Aún no hay estudiantes registrados en este curso'
                          : 'No se encontraron estudiantes que coincidan con la búsqueda'}
                      </p>
                      {students.length === 0 && isAdmin && (
                        <p className="text-xs text-slate-400 max-w-md">
                          Utiliza el botón <strong>«Importar desde Excel»</strong> para cargar la lista oficial desde la fila 8 (.xlsx) o registra uno individualmente.
                        </p>
                      )}
                    </div>
                  </td>
                </tr>
              ) : (
                filteredStudents.map((st, idx) => (
                  <tr key={st.id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="py-3 px-4 text-center font-bold text-slate-400">
                      {idx + 1}
                    </td>
                    <td className="py-3 px-4 font-mono font-bold text-slate-700">
                      {st.codigo}
                    </td>
                    <td className="py-3 px-4 font-bold text-slate-900 uppercase">
                      {st.apellidos}
                    </td>
                    <td className="py-3 px-4 font-medium text-slate-700">
                      {st.nombres}
                    </td>
                    <td className="py-3 px-4 text-center">
                      <button
                        type="button"
                        onClick={() => handleToggleActive(st)}
                        disabled={!isAdmin}
                        className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold transition-all ${
                          st.activo 
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100' 
                            : 'bg-slate-100 text-slate-500 border border-slate-200 hover:bg-slate-200'
                        } ${!isAdmin ? 'cursor-default' : ''}`}
                        title={isAdmin ? "Haz clic para cambiar estado activo/inactivo" : undefined}
                      >
                        {st.activo ? (
                          <>
                            <UserCheck className="w-3 h-3 text-emerald-600" />
                            <span>Activo</span>
                          </>
                        ) : (
                          <>
                            <UserX className="w-3 h-3 text-slate-400" />
                            <span>Inactivo</span>
                          </>
                        )}
                      </button>
                    </td>
                    <td className="py-3 px-4 text-right">
                      {isAdmin ? (
                        <div className="flex items-center justify-end gap-1">
                          <button
                            type="button"
                            onClick={() => {
                              setEditingStudent(st);
                              setStudentForm({
                                codigo: st.codigo,
                                apellidos: st.apellidos,
                                nombres: st.nombres
                              });
                              setFormError(null);
                            }}
                            className="p-1.5 text-slate-600 hover:text-purple-600 hover:bg-purple-50 rounded-lg transition-colors"
                            title="Editar estudiante"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => setDeletingStudent(st)}
                            className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                            title="Eliminar estudiante"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      ) : (
                        <span className="text-slate-400 text-xs italic">Solo lectura</span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* MODAL: IMPORTACIÓN DESDE EXCEL */}
      {showImportModal && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-4xl w-full max-h-[90vh] flex flex-col shadow-2xl border border-slate-200 overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-900 text-white">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-purple-600 rounded-xl text-white">
                  <FileSpreadsheet className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-base">
                    Importar Estudiantes desde Excel a {selectedGroupObj?.displayName || selectedGroupId}
                  </h3>
                  <p className="text-xs text-slate-300">
                    Lectura automática desde la <strong>Fila 8</strong> (Col A: Código, Col B: Apellidos, Col C: Nombres)
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowImportModal(false)}
                className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 flex-1 overflow-y-auto space-y-6">
              {/* Structure Explanation Box */}
              <div className="p-4 bg-indigo-50/70 border border-indigo-200 rounded-2xl text-xs text-indigo-900 space-y-2">
                <div className="flex items-center gap-2 font-bold text-indigo-950">
                  <HelpCircle className="w-4 h-4 text-indigo-600" />
                  <span>Estructura Requerida del Archivo Excel (.xlsx / .xls):</span>
                </div>
                <p className="text-indigo-800 leading-relaxed">
                  Las <strong>filas 1 a 7 no se importan</strong> porque contienen encabezados institucionales. El sistema procesará a partir de la <strong>Fila 8</strong> en adelante:
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 font-mono text-[11px] pt-1">
                  <div className="bg-white p-2 rounded-lg border border-indigo-200">
                    <strong className="text-purple-700">Columna A (A8):</strong> Código
                  </div>
                  <div className="bg-white p-2 rounded-lg border border-indigo-200">
                    <strong className="text-purple-700">Columna B (B8):</strong> Apellidos
                  </div>
                  <div className="bg-white p-2 rounded-lg border border-indigo-200">
                    <strong className="text-purple-700">Columna C (C8):</strong> Nombres
                  </div>
                </div>
              </div>

              {/* Upload Input Area */}
              <div className="border-2 border-dashed border-slate-300 hover:border-purple-500 rounded-2xl p-6 text-center transition-colors bg-slate-50/60">
                <input
                  type="file"
                  ref={fileInputRef}
                  accept=".xlsx, .xls"
                  onChange={handleFileChange}
                  className="hidden"
                  id="excelFileInput"
                />
                <label 
                  htmlFor="excelFileInput" 
                  className="cursor-pointer flex flex-col items-center justify-center gap-2"
                >
                  <div className="w-12 h-12 rounded-full bg-purple-100 text-purple-700 flex items-center justify-center shadow-xs">
                    <Upload className="w-6 h-6" />
                  </div>
                  <div className="space-y-0.5">
                    <span className="text-sm font-bold text-slate-800 block">
                      {selectedFileName ? selectedFileName : 'Haz clic para seleccionar el archivo Excel'}
                    </span>
                    <span className="text-xs text-slate-500">
                      Formatos soportados: Microsoft Excel (.xlsx, .xls)
                    </span>
                  </div>
                </label>
              </div>

              {isProcessingFile && (
                <div className="p-4 bg-slate-100 rounded-xl text-center flex items-center justify-center gap-2 text-xs font-bold text-purple-700">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Analizando filas a partir de la fila 8...</span>
                </div>
              )}

              {importSuccessMsg && (
                <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-800 text-xs font-bold flex items-center gap-2">
                  <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                  <span>{importSuccessMsg}</span>
                </div>
              )}

              {/* Import Diagnostics Summary */}
              {importSummary && (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 text-center text-xs">
                    <div className="p-3 bg-slate-100 rounded-xl border border-slate-200">
                      <span className="text-[10px] text-slate-500 uppercase font-bold block">Filas leídas</span>
                      <strong className="text-base text-slate-800">{importSummary.totalRowsAnalyzed}</strong>
                    </div>
                    <div className="p-3 bg-emerald-50 rounded-xl border border-emerald-200">
                      <span className="text-[10px] text-emerald-600 uppercase font-bold block">Nuevos</span>
                      <strong className="text-base text-emerald-700">{importSummary.importedCount}</strong>
                    </div>
                    <div className="p-3 bg-indigo-50 rounded-xl border border-indigo-200">
                      <span className="text-[10px] text-indigo-600 uppercase font-bold block">Ya en curso</span>
                      <strong className="text-base text-indigo-700">{importSummary.existingCount}</strong>
                    </div>
                    <div className="p-3 bg-amber-50 rounded-xl border border-amber-200">
                      <span className="text-[10px] text-amber-700 uppercase font-bold block">Duplicados</span>
                      <strong className="text-base text-amber-800">{importSummary.duplicateInFileCount}</strong>
                    </div>
                    <div className="p-3 bg-red-50 rounded-xl border border-red-200">
                      <span className="text-[10px] text-red-600 uppercase font-bold block">Con error</span>
                      <strong className="text-base text-red-700">{importSummary.errorCount}</strong>
                    </div>
                  </div>

                  {/* Overwrite or skip option */}
                  <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between text-xs">
                    <label className="flex items-center gap-2 font-medium text-slate-700 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={updateExisting}
                        onChange={(e) => setUpdateExisting(e.target.checked)}
                        className="rounded text-purple-600 focus:ring-purple-500"
                      />
                      <span>Actualizar nombres/apellidos de estudiantes que ya existen en este curso</span>
                    </label>
                  </div>

                  {/* Error messages if any */}
                  {importSummary.errors.length > 0 && (
                    <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-800 space-y-1 max-h-32 overflow-y-auto">
                      <span className="font-bold flex items-center gap-1">
                        <AlertTriangle className="w-3.5 h-3.5" />
                        Detalles de filas rechazadas:
                      </span>
                      {importSummary.errors.map((err, i) => (
                        <p key={i} className="text-[11px]">• {err}</p>
                      ))}
                    </div>
                  )}

                  {/* Table Preview */}
                  <div className="space-y-2">
                    <h4 className="font-bold text-xs text-slate-700 uppercase tracking-wider">
                      Vista Previa de Estudiantes Identificados ({parsedRows.length})
                    </h4>
                    <div className="border border-slate-200 rounded-xl overflow-hidden max-h-60 overflow-y-auto">
                      <table className="w-full text-left text-xs border-collapse">
                        <thead className="bg-slate-100 text-slate-600 sticky top-0 font-bold">
                          <tr>
                            <th className="p-2 w-16 text-center">Fila Excel</th>
                            <th className="p-2 w-28">Código</th>
                            <th className="p-2">Apellidos</th>
                            <th className="p-2">Nombres</th>
                            <th className="p-2 w-32 text-center">Estado</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {parsedRows.map((r, i) => (
                            <tr key={i} className={r.isValid ? 'hover:bg-slate-50' : 'bg-red-50/50'}>
                              <td className="p-2 text-center font-mono font-bold text-slate-500">{r.rowNumber}</td>
                              <td className="p-2 font-mono font-bold">
                                {r.codigo || <span className="text-red-500 italic">Vacío</span>}
                                {r.hasLeadingZeroWarning && (
                                  <span className="ml-1 text-[10px] text-amber-600 font-bold" title="Código numérico corto (posible omisión de ceros a la izquierda por Excel)">
                                    (!)
                                  </span>
                                )}
                              </td>
                              <td className="p-2 font-bold uppercase">{r.apellidos || <span className="text-red-500 italic">Falta</span>}</td>
                              <td className="p-2">{r.nombres || <span className="text-red-500 italic">Falta</span>}</td>
                              <td className="p-2 text-center">
                                {r.isValid ? (
                                  <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 rounded-md font-bold text-[10px]">
                                    Válido
                                  </span>
                                ) : (
                                  <span className="px-2 py-0.5 bg-red-100 text-red-800 rounded-md font-bold text-[10px]" title={r.error}>
                                    Rechazado
                                  </span>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="px-6 py-4 border-t border-slate-200 bg-slate-50 flex items-center justify-between">
              <button
                type="button"
                onClick={() => setShowImportModal(false)}
                className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 text-xs font-bold rounded-xl transition-colors"
              >
                Cancelar
              </button>

              <button
                type="button"
                onClick={handleConfirmImport}
                disabled={isSavingBatch || !parsedRows.some(r => r.isValid)}
                className="flex items-center gap-2 px-5 py-2.5 bg-purple-700 hover:bg-purple-800 text-white text-xs font-bold rounded-xl shadow-xs transition-all disabled:opacity-50"
              >
                {isSavingBatch ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Guardando en el Curso...</span>
                  </>
                ) : (
                  <>
                    <Check className="w-4 h-4" />
                    <span>Confirmar e Importar Estudiantes</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: REGISTRAR / EDITAR ESTUDIANTE MANUAL */}
      {(showManualAddModal || editingStudent) && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="font-bold text-base text-slate-900">
                {editingStudent ? 'Editar Datos del Estudiante' : `Registrar Estudiante en ${selectedGroupObj?.displayName || selectedGroupId}`}
              </h3>
              <button
                type="button"
                onClick={() => {
                  setShowManualAddModal(false);
                  setEditingStudent(null);
                }}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmitStudentForm} className="space-y-4">
              {formError && (
                <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-xl text-xs font-medium flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{formError}</span>
                </div>
              )}

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                  Código del Estudiante <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ej. 1001 o 0142"
                  value={studentForm.codigo}
                  onChange={(e) => setStudentForm(prev => ({ ...prev, codigo: e.target.value }))}
                  className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-mono focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                  Apellidos <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ej. Gómez Pérez"
                  value={studentForm.apellidos}
                  onChange={(e) => setStudentForm(prev => ({ ...prev, apellidos: e.target.value }))}
                  className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold uppercase focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                  Nombres <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ej. Ana María"
                  value={studentForm.nombres}
                  onChange={(e) => setStudentForm(prev => ({ ...prev, nombres: e.target.value }))}
                  className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => {
                    setShowManualAddModal(false);
                    setEditingStudent(null);
                  }}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSavingStudent}
                  className="flex items-center gap-1.5 px-4 py-2 bg-purple-700 hover:bg-purple-800 text-white text-xs font-bold rounded-xl shadow-xs transition-all disabled:opacity-50"
                >
                  {isSavingStudent ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                  <span>{editingStudent ? 'Actualizar Datos' : 'Guardar Estudiante'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: CONFIRMAR ELIMINACIÓN */}
      {deletingStudent && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center gap-3 text-red-600">
              <div className="p-3 bg-red-100 rounded-xl">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <div>
                <h4 className="font-bold text-base text-slate-900">¿Eliminar Estudiante?</h4>
                <p className="text-xs text-slate-500">Esta acción no se puede deshacer</p>
              </div>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed">
              Estás a punto de eliminar a <strong>{deletingStudent.nombreCompleto}</strong> (Código: {deletingStudent.codigo}) de {selectedGroupObj?.displayName || selectedGroupId}.
            </p>
            <p className="text-[11px] text-amber-700 bg-amber-50 p-2.5 rounded-xl border border-amber-200">
              Sugerencia: Si sólo deseas retirar al estudiante de la toma de asistencia activa sin perder su historial pasado, considera cambiar su estado a <strong>Inactivo</strong>.
            </p>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setDeletingStudent(null)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition-colors"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                disabled={isDeleting}
                className="flex items-center gap-1.5 px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-xs font-bold rounded-xl shadow-xs transition-colors disabled:opacity-50"
              >
                {isDeleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                <span>Eliminar Definitivamente</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
