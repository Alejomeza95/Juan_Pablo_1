import React, { useState, useEffect, useMemo } from 'react';
import { 
  Users, 
  UserPlus, 
  ShieldCheck, 
  ShieldAlert, 
  Search, 
  CheckCircle2, 
  XCircle, 
  Lock, 
  Unlock, 
  Edit2, 
  Trash2, 
  Mail, 
  Briefcase, 
  Sparkles, 
  AlertCircle, 
  RefreshCw, 
  Loader2, 
  X, 
  Save, 
  Check, 
  FileText, 
  ClipboardCheck, 
  Calendar, 
  GraduationCap, 
  CalendarRange, 
  FileCheck2,
  Info,
  KeyRound,
  Eye,
  EyeOff,
  Copy,
  FileSpreadsheet,
  UploadCloud,
  Download,
  BarChart3
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { SystemUserRecord, AppSessionUser, SystemUserPermissions } from '../../types';
import { ADMIN_EMAIL, isSuperAdminEmail, SUPERADMIN_EMAILS } from '../../firebase';
import { 
  subscribeToSystemUsers, 
  saveSystemUser, 
  updateSystemUserStatus, 
  deleteSystemUser,
  saveBatchSystemUsers 
} from '../../utils/systemUsersService';

interface UsersManagementMainProps {
  user: AppSessionUser | any;
  onNavigateView?: (view: string) => void;
}

export function UsersManagementMain({ user, onNavigateView }: UsersManagementMainProps) {
  const isSuperAdmin = isSuperAdminEmail(user.email);

  const [systemUsers, setSystemUsers] = useState<SystemUserRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<'all' | 'activo' | 'inactivo'>('all');

  // Password visibility map for table rows
  const [visiblePasswords, setVisiblePasswords] = useState<Record<string, boolean>>({});
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Modal State
  const [showModal, setShowModal] = useState(false);
  const [editingUser, setEditingUser] = useState<SystemUserRecord | null>(null);
  const [formUsername, setFormUsername] = useState('');
  const [formPassword, setFormPassword] = useState('');
  const [showFormPassword, setShowFormPassword] = useState(false);
  const [formFullName, setFormFullName] = useState('');
  const [formCargo, setFormCargo] = useState('Docente');
  const [formStatus, setFormStatus] = useState<'activo' | 'inactivo'>('activo');
  const [formEmail, setFormEmail] = useState('');
  const [formNotas, setFormNotas] = useState('');
  
  // Casillas de verificación de permisos por usuario
  const [formPermDocuments, setFormPermDocuments] = useState(true);
  const [formPermAttendance, setFormPermAttendance] = useState(true);
  const [formPermAgenda, setFormPermAgenda] = useState(true);
  const [formPermAcademicConfig, setFormPermAcademicConfig] = useState(true);
  const [formPermSchoolYear, setFormPermSchoolYear] = useState(true);
  const [formPermAcademicPermissions, setFormPermAcademicPermissions] = useState(false);
  const [formPermAbsenteeismDashboard, setFormPermAbsenteeismDashboard] = useState(true);

  const [isSaving, setIsSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [actionSuccessMsg, setActionSuccessMsg] = useState<string | null>(null);

  // Delete Confirmation State
  const [deletingUser, setDeletingUser] = useState<SystemUserRecord | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Excel Bulk Import State
  const [showExcelModal, setShowExcelModal] = useState(false);
  const [excelFile, setExcelFile] = useState<File | null>(null);
  const [excelParsedRows, setExcelParsedRows] = useState<Array<{
    rowNum: number;
    username: string;
    password: string;
    fullName: string;
    cargo: string;
    status: 'activo' | 'inactivo';
    isValid: boolean;
    error?: string;
  }>>([]);
  const [excelError, setExcelError] = useState<string | null>(null);
  const [isImportingExcel, setIsImportingExcel] = useState(false);
  const [isDraggingFile, setIsDraggingFile] = useState(false);

  // Permisos en lote que se aplicarán a los usuarios importados por Excel
  const [batchPermDocs, setBatchPermDocs] = useState(true);
  const [batchPermAttendance, setBatchPermAttendance] = useState(true);
  const [batchPermAgenda, setBatchPermAgenda] = useState(true);
  const [batchPermAcademicConfig, setBatchPermAcademicConfig] = useState(true);
  const [batchPermSchoolYear, setBatchPermSchoolYear] = useState(true);
  const [batchPermAcademicPermissions, setBatchPermAcademicPermissions] = useState(false);
  const [batchPermAbsenteeismDashboard, setBatchPermAbsenteeismDashboard] = useState(true);

  // Subscribe to users
  useEffect(() => {
    setLoading(true);
    const unsubscribe = subscribeToSystemUsers(
      (users) => {
        setSystemUsers(users);
        setLoading(false);
      },
      (error) => {
        console.error("Error al cargar usuarios autorizados:", error);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, []);

  const openCreateModal = () => {
    setEditingUser(null);
    setFormUsername('');
    setFormPassword('');
    setShowFormPassword(false);
    setFormFullName('');
    setFormCargo('Docente');
    setFormStatus('activo');
    setFormEmail('');
    setFormNotas('');
    // Permisos por defecto al crear
    setFormPermDocuments(true);
    setFormPermAttendance(true);
    setFormPermAgenda(true);
    setFormPermAcademicConfig(true);
    setFormPermSchoolYear(true);
    setFormPermAcademicPermissions(false);
    setFormPermAbsenteeismDashboard(true);
    setFormError(null);
    setShowModal(true);
  };

  const openEditModal = (u: SystemUserRecord) => {
    setEditingUser(u);
    setFormUsername(u.username);
    setFormPassword(u.password || '');
    setShowFormPassword(false);
    setFormFullName(u.fullName);
    setFormCargo(u.cargo);
    setFormStatus(u.status);
    setFormEmail(u.email || '');
    setFormNotas(u.notas || '');
    // Cargar permisos existentes del usuario
    setFormPermDocuments(u.permissions?.documents ?? true);
    setFormPermAttendance(u.permissions?.attendance ?? true);
    setFormPermAgenda(u.permissions?.agenda ?? true);
    setFormPermAcademicConfig(u.permissions?.academicConfig ?? true);
    setFormPermSchoolYear(u.permissions?.schoolYear ?? true);
    setFormPermAcademicPermissions(u.permissions?.academicPermissions ?? false);
    setFormPermAbsenteeismDashboard(u.permissions?.absenteeismDashboard ?? true);
    setFormError(null);
    setShowModal(true);
  };

  // Funciones de Importación Masiva desde Excel
  const openExcelImportModal = () => {
    setExcelFile(null);
    setExcelParsedRows([]);
    setExcelError(null);
    setIsImportingExcel(false);
    setBatchPermDocs(true);
    setBatchPermAttendance(true);
    setBatchPermAgenda(true);
    setBatchPermAcademicConfig(true);
    setBatchPermSchoolYear(true);
    setBatchPermAcademicPermissions(false);
    setBatchPermAbsenteeismDashboard(true);
    setShowExcelModal(true);
  };

  // Descargar plantilla Excel oficial
  const handleDownloadExcelTemplate = () => {
    try {
      const headers = [
        'Usuario (Desde A2)',
        'Contraseña (Desde B2)',
        'Nombre Completo (Opcional)',
        'Cargo (Opcional)'
      ];

      const sampleData = [
        headers,
        ['docente_martha', 'clave1234', 'Lic. Martha Gómez Gómez', 'Docente de Primaria'],
        ['prof_carlos', 'colegio2026', 'Carlos Alberto Pérez', 'Docente de Secundaria'],
        ['coordinacion1', 'coord2026', 'Javier Narváez', 'Coordinador Académico'],
        ['secretaria1', 'secr2026', 'Ana Sofía Rodríguez', 'Secretaría Académica']
      ];

      const ws = XLSX.utils.aoa_to_sheet(sampleData);
      
      // Auto-fit column widths
      ws['!cols'] = [
        { wch: 22 },
        { wch: 22 },
        { wch: 30 },
        { wch: 25 }
      ];

      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Usuarios_Sistema');
      XLSX.writeFile(wb, 'Plantilla_Usuarios_JuanPabloI.xlsx');
    } catch (err: any) {
      console.error('Error al generar plantilla Excel:', err);
      alert('Error al descargar plantilla: ' + (err.message || 'Error desconocido'));
    }
  };

  // Procesar archivo Excel cargado
  const processExcelFile = async (file: File) => {
    setExcelFile(file);
    setExcelError(null);
    setExcelParsedRows([]);

    try {
      const buffer = await file.arrayBuffer();
      const workbook = XLSX.read(buffer, { type: 'array' });
      const firstSheetName = workbook.SheetNames[0];

      if (!firstSheetName) {
        setExcelError('El archivo Excel no contiene hojas de datos.');
        return;
      }

      const worksheet = workbook.Sheets[firstSheetName];
      const rawData: any[][] = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: '' });

      if (rawData.length <= 1) {
        setExcelError('El archivo Excel no contiene filas de usuarios (debe haber datos desde la fila 2).');
        return;
      }

      const existingUsernames = new Set(systemUsers.map(u => u.username.toLowerCase()));
      const seenInFile = new Set<string>();
      const parsed: Array<{
        rowNum: number;
        username: string;
        password: string;
        fullName: string;
        cargo: string;
        status: 'activo' | 'inactivo';
        isValid: boolean;
        error?: string;
      }> = [];

      // Fila 1 (índice 0) son encabezados. Datos desde fila 2 (índice 1) en adelante:
      // Casilla A2 en adelante: Nombre de usuario
      // Columna B2 hacia abajo: Contraseñas
      for (let i = 1; i < rawData.length; i++) {
        const row = rawData[i];
        if (!row || row.length === 0) continue;

        const rawUser = String(row[0] ?? '').trim();
        const rawPass = String(row[1] ?? '').trim();
        const rawName = String(row[2] ?? '').trim();
        const rawCargo = String(row[3] ?? '').trim();

        // Omitir filas completamente vacías
        if (!rawUser && !rawPass) continue;

        const cleanUser = rawUser.toLowerCase().replace(/\s+/g, '');
        let isValid = true;
        let errorMsg = '';

        if (!cleanUser || cleanUser.length < 3) {
          isValid = false;
          errorMsg = 'Usuario debe tener mínimo 3 caracteres.';
        } else if (!/^[a-zA-Z0-9_.-]+$/.test(cleanUser)) {
          isValid = false;
          errorMsg = 'Caracteres inválidos en usuario (solo letras, números, puntos o guiones).';
        } else if (cleanUser === 'admin') {
          isValid = false;
          errorMsg = 'Usuario reservado «admin» no permitido.';
        } else if (!rawPass || rawPass.length < 4) {
          isValid = false;
          errorMsg = 'Contraseña debe tener mínimo 4 caracteres.';
        } else if (seenInFile.has(cleanUser)) {
          isValid = false;
          errorMsg = 'Usuario duplicado en el mismo archivo Excel.';
        }

        seenInFile.add(cleanUser);

        parsed.push({
          rowNum: i + 1, // Número de fila real de Excel (2, 3, 4...)
          username: cleanUser || rawUser,
          password: rawPass,
          fullName: rawName || cleanUser || `Usuario ${i + 1}`,
          cargo: rawCargo || 'Docente de Área',
          status: 'activo',
          isValid,
          error: errorMsg || (existingUsernames.has(cleanUser) ? 'Aviso: Sobrescribirá credenciales existentes' : undefined)
        });
      }

      if (parsed.length === 0) {
        setExcelError('No se encontraron filas con datos válidos en las columnas A y B.');
        return;
      }

      setExcelParsedRows(parsed);
    } catch (err: any) {
      console.error('Error al procesar archivo Excel:', err);
      setExcelError('Error al leer el archivo Excel: ' + (err.message || 'Formato no reconocido.'));
    }
  };

  const handleExcelDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDraggingFile(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const file = e.dataTransfer.files[0];
      processExcelFile(file);
    }
  };

  const handleExcelInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const file = e.target.files[0];
      processExcelFile(file);
    }
  };

  // Confirmar la importación masiva de usuarios a Firestore
  const handleConfirmExcelImport = async () => {
    const validRows = excelParsedRows.filter(r => r.isValid);
    if (validRows.length === 0) {
      setExcelError('No hay usuarios válidos para importar.');
      return;
    }

    setIsImportingExcel(true);
    setExcelError(null);

    try {
      const batchPermissions: SystemUserPermissions = {
        documents: batchPermDocs,
        attendance: batchPermAttendance,
        agenda: batchPermAgenda,
        academicConfig: batchPermAcademicConfig,
        schoolYear: batchPermSchoolYear,
        academicPermissions: batchPermAcademicPermissions,
        absenteeismDashboard: batchPermAbsenteeismDashboard,
        manageUsers: false
      };

      const usersToImport = validRows.map(r => ({
        username: r.username,
        password: r.password,
        fullName: r.fullName,
        cargo: r.cargo,
        status: r.status,
        permissions: batchPermissions
      }));

      const res = await saveBatchSystemUsers(
        usersToImport,
        user.email || user.username || ADMIN_EMAIL
      );

      if (res.errors.length > 0) {
        setActionSuccessMsg(
          `Importación finalizada: ${res.successCount} usuarios creados. ${res.errors.length} con advertencia.`
        );
      } else {
        setActionSuccessMsg(
          `¡Éxito! Se han importado masivamente ${res.successCount} usuarios a la base de datos con sus permisos asignados.`
        );
      }

      setShowExcelModal(false);
      setTimeout(() => setActionSuccessMsg(null), 5000);
    } catch (err: any) {
      console.error('Error al importar usuarios en lote:', err);
      setExcelError(err.message || 'Error durante la importación a la base de datos.');
    } finally {
      setIsImportingExcel(false);
    }
  };

  const togglePasswordVisibility = (userId: string) => {
    setVisiblePasswords(prev => ({
      ...prev,
      [userId]: !prev[userId]
    }));
  };

  const handleCopyCredentials = (u: SystemUserRecord) => {
    const textToCopy = `Credenciales Institución Educativa Juan Pablo I:\nUsuario: ${u.username}\nContraseña: ${u.password}`;
    navigator.clipboard.writeText(textToCopy);
    setCopiedId(u.id);
    setTimeout(() => setCopiedId(null), 2500);
  };

  const handleSaveUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    const userTrim = formUsername.trim().toLowerCase();
    const passTrim = formPassword.trim();

    if (!userTrim || userTrim.length < 3) {
      setFormError('El nombre de usuario debe tener mínimo 3 caracteres.');
      return;
    }

    if (!/^[a-zA-Z0-9_.-]+$/.test(userTrim)) {
      setFormError('El usuario solo puede tener letras, números, puntos (.), guiones (-) o guiones bajos (_).');
      return;
    }

    if (!passTrim || passTrim.length < 4) {
      setFormError('La contraseña debe tener mínimo 4 caracteres.');
      return;
    }

    if (userTrim === 'admin' || userTrim === ADMIN_EMAIL.toLowerCase()) {
      setFormError('El nombre de usuario reservado no se puede utilizar.');
      return;
    }

    setIsSaving(true);
    try {
      await saveSystemUser(
        {
          username: userTrim,
          password: passTrim,
          fullName: formFullName.trim() || userTrim,
          cargo: formCargo.trim() || 'Docente / Personal Institucional',
          status: formStatus,
          email: formEmail.trim().toLowerCase() || `${userTrim}@juanpablo.edu.co`,
          notas: formNotas.trim(),
          permissions: {
            documents: formPermDocuments,
            attendance: formPermAttendance,
            agenda: formPermAgenda,
            academicConfig: formPermAcademicConfig,
            schoolYear: formPermSchoolYear,
            academicPermissions: formPermAcademicPermissions,
            absenteeismDashboard: formPermAbsenteeismDashboard,
            manageUsers: false
          }
        },
        user.email || user.username || ADMIN_EMAIL
      );

      setActionSuccessMsg(
        editingUser 
          ? `Usuario «${userTrim}» actualizado correctamente con sus nuevas credenciales.` 
          : `Usuario «${userTrim}» creado con éxito. Ahora puede iniciar sesión con su Usuario y Contraseña.`
      );
      setShowModal(false);
      setTimeout(() => setActionSuccessMsg(null), 5000);
    } catch (err: any) {
      console.error("Error al guardar usuario:", err);
      setFormError(err.message || 'Error al guardar el usuario en la base de datos.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleToggleStatus = async (targetUser: SystemUserRecord) => {
    const nextStatus = targetUser.status === 'activo' ? 'inactivo' : 'activo';
    try {
      await updateSystemUserStatus(targetUser.id, nextStatus, user.email || ADMIN_EMAIL);
      setActionSuccessMsg(
        `Estado de ${targetUser.username} cambiado a ${nextStatus.toUpperCase()}.`
      );
      setTimeout(() => setActionSuccessMsg(null), 4000);
    } catch (err: any) {
      console.error("Error al cambiar estado:", err);
      setActionSuccessMsg(`Error: No se pudo cambiar el estado.`);
      setTimeout(() => setActionSuccessMsg(null), 4000);
    }
  };

  const handleDeleteUser = async () => {
    if (!deletingUser) return;
    setIsDeleting(true);
    try {
      await deleteSystemUser(deletingUser.id);
      setActionSuccessMsg(`Usuario ${deletingUser.username} eliminado correctamente.`);
      setDeletingUser(null);
      setTimeout(() => setActionSuccessMsg(null), 4000);
    } catch (err: any) {
      console.error("Error al eliminar usuario:", err);
      setActionSuccessMsg(`Error al eliminar usuario.`);
      setTimeout(() => setActionSuccessMsg(null), 4000);
    } finally {
      setIsDeleting(false);
    }
  };

  // Filtered users
  const filteredUsers = useMemo(() => {
    return systemUsers.filter((u) => {
      const matchSearch = 
        u.username.toLowerCase().includes(searchTerm.toLowerCase()) ||
        u.fullName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        u.cargo.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (u.email && u.email.toLowerCase().includes(searchTerm.toLowerCase()));
      
      const matchStatus = 
        filterStatus === 'all' ? true : u.status === filterStatus;

      return matchSearch && matchStatus;
    });
  }, [systemUsers, searchTerm, filterStatus]);

  const activeCount = useMemo(() => systemUsers.filter(u => u.status === 'activo').length, [systemUsers]);
  const inactiveCount = useMemo(() => systemUsers.filter(u => u.status === 'inactivo').length, [systemUsers]);

  if (!isSuperAdmin) {
    return (
      <div className="h-full flex items-center justify-center p-6 bg-slate-100">
        <div className="bg-white p-6 sm:p-8 rounded-2xl shadow-sm border border-slate-200 max-w-md w-full text-center space-y-4">
          <div className="w-14 h-14 bg-rose-50 text-rose-600 rounded-2xl flex items-center justify-center mx-auto">
            <ShieldAlert className="w-8 h-8" />
          </div>
          <h2 className="text-lg font-black text-slate-900 leading-tight">
            Acceso Exclusivo de Rectoría
          </h2>
          <p className="text-xs text-slate-600 leading-relaxed">
            El módulo de <strong>Gestión y Creación de Usuarios</strong> solo puede ser administrado por el Superadministrador Principal del Colegio (<span className="text-indigo-600 font-bold">{ADMIN_EMAIL}</span>).
          </p>
          {onNavigateView && (
            <button
              onClick={() => onNavigateView('attendance')}
              className="w-full py-2.5 px-4 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl transition-colors shadow-xs"
            >
              Ir a Asistencia Estudiantil
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col p-3 sm:p-6 lg:p-8 gap-4 sm:gap-6 overflow-y-auto">
      {/* Top Banner & Header */}
      <div className="bg-white rounded-2xl border border-slate-200 p-4 sm:p-6 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-full bg-indigo-50 border border-indigo-200 text-indigo-700 font-bold text-[11px] uppercase tracking-wider flex items-center gap-1">
              <ShieldCheck className="w-3.5 h-3.5" />
              Rectoría y Seguridad Institucional
            </span>
          </div>
          <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
            Gestión de Usuarios y Credenciales
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 font-medium max-w-3xl leading-relaxed">
            Crea cuentas institucionales con <strong>Usuario y Contraseña</strong> para docentes y personal administrativo. Estos usuarios tendrán acceso total a <strong>Documentos, Asistencia, Agenda, Configuración y Año Escolar</strong>, manteniendo <strong>bloqueados</strong> los Permisos Académicos. El inicio de sesión con Google queda <strong>exclusivamente reservado para el Administrador Principal</strong>.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 shrink-0">
          <button
            type="button"
            onClick={openExcelImportModal}
            className="flex items-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs sm:text-sm font-bold shadow-xs hover:shadow-emerald-100 transition-all hover:scale-102 active:scale-98"
            title="Importar usuarios y contraseñas masivas desde un archivo Excel"
          >
            <FileSpreadsheet className="w-4 h-4" />
            <span>Importar Usuarios Excel</span>
          </button>
          <button
            type="button"
            onClick={openCreateModal}
            className="flex items-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs sm:text-sm font-bold shadow-xs hover:shadow-indigo-100 transition-all hover:scale-102 active:scale-98"
          >
            <UserPlus className="w-4 h-4" />
            <span>Crear Nuevo Usuario</span>
          </button>
        </div>
      </div>

      {/* Success Notification Alert */}
      {actionSuccessMsg && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 p-3.5 rounded-xl text-xs font-semibold flex items-center justify-between shadow-2xs animate-in fade-in slide-in-from-top duration-300">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{actionSuccessMsg}</span>
          </div>
          <button 
            type="button" 
            onClick={() => setActionSuccessMsg(null)}
            className="text-emerald-600 hover:text-emerald-900 p-1"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Informative Security Card (Explicación de Autenticación) */}
      <div className="bg-gradient-to-r from-slate-900 to-indigo-950 text-white rounded-2xl p-4 sm:p-5 shadow-sm border border-slate-800 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="p-2.5 bg-white/10 rounded-xl text-indigo-300 shrink-0 mt-0.5">
            <KeyRound className="w-6 h-6" />
          </div>
          <div className="space-y-1">
            <h3 className="font-bold text-sm text-white flex items-center gap-2">
              <span>Autenticación por Usuario y Contraseña para el Personal</span>
              <span className="px-2 py-0.5 rounded-md bg-emerald-500/20 text-emerald-300 border border-emerald-400/30 text-[10px] font-mono">
                Sin necesidad de Correo
              </span>
            </h3>
            <p className="text-xs text-slate-300 max-w-2xl leading-relaxed">
              Los profesores no requieren cuentas de correo para ingresar. Solo asígnales un usuario (ej: <code className="text-amber-300 bg-white/10 px-1 py-0.5 rounded font-mono">docente1</code>) y una contraseña. Podrán ingresar de inmediato en el formulario de acceso institucional.
            </p>
          </div>
        </div>

        <div className="bg-white/10 rounded-xl p-3 border border-white/10 shrink-0 text-xs text-slate-200 max-w-xs space-y-1">
          <div className="font-bold text-amber-300 flex items-center gap-1.5 text-[11px] uppercase tracking-wider">
            <Lock className="w-3.5 h-3.5" />
            Google solo para Admin
          </div>
          <p className="text-[11px] text-slate-300">
            El botón de Google Sign-In está activo única y exclusivamente para: <br/>
            <strong className="text-white font-mono">{ADMIN_EMAIL}</strong>
          </p>
        </div>
      </div>

      {/* Users Search and Filters Bar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Buscar por usuario, nombre o cargo..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
          <span className="text-xs text-slate-500 font-bold">Estado:</span>
          <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl">
            <button
              type="button"
              onClick={() => setFilterStatus('all')}
              className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                filterStatus === 'all' ? 'bg-white text-indigo-700 shadow-2xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Todos ({systemUsers.length})
            </button>
            <button
              type="button"
              onClick={() => setFilterStatus('activo')}
              className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                filterStatus === 'activo' ? 'bg-white text-emerald-700 shadow-2xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Activos ({activeCount})
            </button>
            <button
              type="button"
              onClick={() => setFilterStatus('inactivo')}
              className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                filterStatus === 'inactivo' ? 'bg-white text-slate-700 shadow-2xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Inactivos ({inactiveCount})
            </button>
          </div>
        </div>
      </div>

      {/* Users Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="px-4 sm:px-6 py-4 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Users className="w-5 h-5 text-indigo-600" />
            <h3 className="font-bold text-slate-900 text-sm sm:text-base">
              Listado de Usuarios y Credenciales
            </h3>
          </div>
          <span className="text-xs font-bold text-slate-400">
            {filteredUsers.length} {filteredUsers.length === 1 ? 'usuario' : 'usuarios'}
          </span>
        </div>

        {loading ? (
          <div className="py-16 text-center text-slate-400 flex flex-col items-center justify-center gap-2">
            <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
            <span className="text-xs font-bold">Cargando usuarios autorizados...</span>
          </div>
        ) : filteredUsers.length === 0 ? (
          <div className="py-16 text-center text-slate-400 flex flex-col items-center justify-center gap-3 px-4">
            <div className="p-3 bg-indigo-50 text-indigo-600 rounded-full">
              <Users className="w-8 h-8 text-indigo-400" />
            </div>
            <div>
              <p className="font-bold text-sm text-slate-700">
                {searchTerm || filterStatus !== 'all' 
                  ? 'No se encontraron usuarios con los filtros aplicados' 
                  : 'Aún no has creado usuarios con permisos limitados'}
              </p>
              <p className="text-xs text-slate-400 mt-1 max-w-md mx-auto">
                Haz clic en el botón <strong>«Crear Nuevo Usuario»</strong> para asignar un usuario y contraseña a los docentes que podrán usar el sistema con acceso a Documentos, Asistencia, Agenda, Configuración y Año Escolar.
              </p>
            </div>
            {(!searchTerm && filterStatus === 'all') && (
              <button
                type="button"
                onClick={openCreateModal}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-all shadow-2xs flex items-center gap-1.5"
              >
                <UserPlus className="w-4 h-4" />
                <span>Crear Primer Usuario</span>
              </button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[800px] text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold uppercase tracking-wider text-[11px]">
                  <th className="py-3 px-4 w-12 text-center">N°</th>
                  <th className="py-3 px-4">Usuario (Login)</th>
                  <th className="py-3 px-4">Contraseña Asignada</th>
                  <th className="py-3 px-4">Nombre y Cargo</th>
                  <th className="py-3 px-4">Alcance de Permisos</th>
                  <th className="py-3 px-4 text-center w-28">Estado</th>
                  <th className="py-3 px-4 text-right w-28">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredUsers.map((u, idx) => {
                  const isPassVisible = Boolean(visiblePasswords[u.id]);
                  return (
                    <tr key={u.id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="py-3 px-4 text-center font-bold text-slate-400">
                        {idx + 1}
                      </td>

                      {/* Usuario */}
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold text-xs uppercase shrink-0">
                            {u.username.charAt(0) || u.fullName.charAt(0)}
                          </div>
                          <div>
                            <span className="font-mono font-bold text-indigo-700 text-xs px-2 py-0.5 bg-indigo-50 rounded-md border border-indigo-200 block max-w-fit">
                              @{u.username}
                            </span>
                            {u.notas && (
                              <span className="text-[10px] text-slate-400 block truncate max-w-[150px] mt-0.5">
                                {u.notas}
                              </span>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* Contraseña */}
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-bold text-slate-800 bg-slate-100 px-2.5 py-1 rounded-md border border-slate-200 tracking-wider">
                            {isPassVisible ? u.password : '••••••••'}
                          </span>
                          <button
                            type="button"
                            onClick={() => togglePasswordVisibility(u.id)}
                            className="p-1 text-slate-400 hover:text-slate-700 rounded-md hover:bg-slate-100 transition-colors"
                            title={isPassVisible ? "Ocultar contraseña" : "Ver contraseña"}
                          >
                            {isPassVisible ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                          </button>
                          <button
                            type="button"
                            onClick={() => handleCopyCredentials(u)}
                            className="p-1 text-slate-400 hover:text-indigo-600 rounded-md hover:bg-slate-100 transition-colors"
                            title="Copiar Usuario y Contraseña para entregar al docente"
                          >
                            {copiedId === u.id ? (
                              <Check className="w-3.5 h-3.5 text-emerald-600" />
                            ) : (
                              <Copy className="w-3.5 h-3.5" />
                            )}
                          </button>
                        </div>
                      </td>

                      {/* Nombre y Cargo */}
                      <td className="py-3 px-4">
                        <div>
                          <span className="font-bold text-slate-900 block">{u.fullName}</span>
                          <span className="text-[11px] text-slate-500 flex items-center gap-1 mt-0.5">
                            <Briefcase className="w-3 h-3 text-slate-400" />
                            {u.cargo}
                          </span>
                        </div>
                      </td>

                      {/* Alcance de Permisos */}
                      <td className="py-3 px-4">
                        <div className="flex flex-wrap items-center gap-1 max-w-xs">
                          {u.permissions?.documents && (
                            <span className="px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-bold">
                              ✓ Docs
                            </span>
                          )}
                          {u.permissions?.attendance && (
                            <span className="px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-bold">
                              ✓ Asistencia
                            </span>
                          )}
                          {u.permissions?.agenda && (
                            <span className="px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-bold">
                              ✓ Agenda
                            </span>
                          )}
                          {u.permissions?.academicConfig && (
                            <span className="px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-bold">
                              ✓ Config
                            </span>
                          )}
                          {u.permissions?.schoolYear && (
                            <span className="px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-bold">
                              ✓ Año Escolar
                            </span>
                          )}
                          {u.permissions?.academicPermissions ? (
                            <span className="px-2 py-0.5 rounded-md bg-indigo-50 text-indigo-700 border border-indigo-200 text-[10px] font-bold flex items-center gap-0.5">
                              ✓ Permisos
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-500 border border-slate-200 text-[10px] font-bold flex items-center gap-0.5">
                              <Lock className="w-2.5 h-2.5" /> Sin Permisos
                            </span>
                          )}
                          {u.permissions?.absenteeismDashboard && (
                            <span className="px-2 py-0.5 rounded-md bg-blue-50 text-blue-700 border border-blue-200 text-[10px] font-bold">
                              ✓ Ausentismo
                            </span>
                          )}
                          {!u.permissions?.documents && !u.permissions?.attendance && !u.permissions?.agenda && !u.permissions?.academicConfig && !u.permissions?.schoolYear && !u.permissions?.academicPermissions && !u.permissions?.absenteeismDashboard && (
                            <span className="px-2 py-0.5 rounded-md bg-rose-50 text-rose-700 border border-rose-200 text-[10px] font-bold">
                              Sin accesos
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Estado con botón de activación/desactivación instantánea */}
                      <td className="py-3 px-4 text-center">
                        <button
                          type="button"
                          onClick={() => handleToggleStatus(u)}
                          className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold transition-all shadow-2xs hover:scale-105 active:scale-95 cursor-pointer ${
                            u.status === 'activo'
                              ? 'bg-emerald-100 text-emerald-800 border border-emerald-300 hover:bg-emerald-200'
                              : 'bg-slate-200 text-slate-700 border border-slate-300 hover:bg-slate-300'
                          }`}
                          title={u.status === 'activo' ? "Clic para Desactivar cuenta" : "Clic para Activar cuenta"}
                        >
                          {u.status === 'activo' ? (
                            <>
                              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-700" />
                              <span>Activo</span>
                            </>
                          ) : (
                            <>
                              <XCircle className="w-3.5 h-3.5 text-slate-500" />
                              <span>Inactivo</span>
                            </>
                          )}
                        </button>
                      </td>

                      {/* Acciones */}
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            type="button"
                            onClick={() => handleToggleStatus(u)}
                            className={`p-1.5 rounded-lg transition-colors ${
                              u.status === 'activo'
                                ? 'text-slate-400 hover:text-amber-600 hover:bg-amber-50'
                                : 'text-slate-400 hover:text-emerald-600 hover:bg-emerald-50'
                            }`}
                            title={u.status === 'activo' ? "Desactivar usuario" : "Activar usuario"}
                          >
                            {u.status === 'activo' ? <Lock className="w-4 h-4" /> : <Unlock className="w-4 h-4" />}
                          </button>
                          <button
                            type="button"
                            onClick={() => openEditModal(u)}
                            className="p-1.5 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                            title="Editar usuario, credenciales y permisos"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => setDeletingUser(u)}
                            className="p-1.5 text-slate-500 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                            title="Eliminar usuario"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* MODAL CREAR / EDITAR USUARIO */}
      {showModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[95vh]">
            {/* Header */}
            <div className="px-4 sm:px-6 py-4 bg-indigo-700 text-white flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-indigo-800 rounded-xl shrink-0">
                  <UserPlus className="w-5 h-5 text-indigo-200" />
                </div>
                <div>
                  <h3 className="font-black text-sm sm:text-base">
                    {editingUser ? 'Editar Usuario y Contraseña' : 'Crear Usuario Institucional'}
                  </h3>
                  <p className="text-xs text-indigo-200">
                    Asignación de credenciales con acceso completo a los módulos educativos
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowModal(false)}
                className="p-1 text-indigo-200 hover:text-white rounded-lg hover:bg-indigo-800 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleSaveUser} className="p-4 sm:p-6 overflow-y-auto space-y-4 text-xs">
              {formError && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
                  <span>{formError}</span>
                </div>
              )}

              {/* Usuario y Contraseña en 2 columnas */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Nombre de Usuario */}
                <div className="space-y-1.5">
                  <label className="font-bold text-slate-700 flex items-center gap-1.5">
                    <KeyRound className="w-3.5 h-3.5 text-indigo-600" />
                    <span>Nombre de Usuario *</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={formUsername}
                    onChange={(e) => setFormUsername(e.target.value.toLowerCase().replace(/\s+/g, ''))}
                    disabled={Boolean(editingUser)}
                    placeholder="ejemplo: docente1, prof_martha"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-mono font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-60 disabled:bg-slate-100"
                  />
                  <p className="text-[10px] text-slate-400">
                    Sin espacios. Solo letras, números y guiones.
                  </p>
                </div>

                {/* Contraseña */}
                <div className="space-y-1.5">
                  <label className="font-bold text-slate-700 flex items-center justify-between">
                    <span className="flex items-center gap-1.5">
                      <Lock className="w-3.5 h-3.5 text-indigo-600" />
                      <span>Contraseña *</span>
                    </span>
                    <button
                      type="button"
                      onClick={() => setShowFormPassword(!showFormPassword)}
                      className="text-indigo-600 hover:text-indigo-800 font-semibold text-[11px] flex items-center gap-1"
                    >
                      {showFormPassword ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                      <span>{showFormPassword ? 'Ocultar' : 'Ver'}</span>
                    </button>
                  </label>
                  <input
                    type={showFormPassword ? 'text' : 'password'}
                    required
                    value={formPassword}
                    onChange={(e) => setFormPassword(e.target.value)}
                    placeholder="Ingresa la clave..."
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-mono font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                  <p className="text-[10px] text-slate-400">
                    Mínimo 4 caracteres.
                  </p>
                </div>
              </div>

              {/* Nombre Completo */}
              <div className="space-y-1.5">
                <label className="font-bold text-slate-700 flex items-center gap-1.5">
                  <Users className="w-3.5 h-3.5 text-indigo-600" />
                  <span>Nombres y Apellidos del Docente / Colaborador *</span>
                </label>
                <input
                  type="text"
                  required
                  value={formFullName}
                  onChange={(e) => setFormFullName(e.target.value)}
                  placeholder="ejemplo: Lic. Martha Gómez Gómez"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              {/* Cargo y Estado en 2 columnas */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="font-bold text-slate-700 flex items-center gap-1.5">
                    <Briefcase className="w-3.5 h-3.5 text-indigo-600" />
                    <span>Cargo Institucional *</span>
                  </label>
                  <select
                    value={formCargo}
                    onChange={(e) => setFormCargo(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="Docente">Docente de Área</option>
                    <option value="Director de Grupo">Director de Grupo</option>
                    <option value="Docente de Primaria">Docente de Primaria</option>
                    <option value="Docente de Secundaria">Docente de Secundaria</option>
                    <option value="Coordinador Académico">Coordinador Académico</option>
                    <option value="Coordinador de Convivencia">Coordinador de Convivencia</option>
                    <option value="Secretaría Académica">Secretaría Académica</option>
                    <option value="Personal Administrativo">Personal Administrativo</option>
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="font-bold text-slate-700 flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5 text-indigo-600" />
                    <span>Estado de la Cuenta *</span>
                  </label>
                  <select
                    value={formStatus}
                    onChange={(e) => setFormStatus(e.target.value as 'activo' | 'inactivo')}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="activo">Activo (Puede ingresar al sistema)</option>
                    <option value="inactivo">Inactivo (Acceso bloqueado)</option>
                  </select>
                </div>
              </div>

              {/* Notas opcionales */}
              <div className="space-y-1.5">
                <label className="font-bold text-slate-700">Notas u Observaciones (Opcional)</label>
                <input
                  type="text"
                  value={formNotas}
                  onChange={(e) => setFormNotas(e.target.value)}
                  placeholder="ejemplo: Asignado a grado 6A, sede central..."
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              {/* SELECCIÓN INTERACTIVA DE PERMISOS CON CASILLAS DE VERIFICACIÓN */}
              <div className="p-3.5 sm:p-4 bg-slate-50 border border-slate-200 rounded-2xl space-y-2.5">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div>
                    <span className="font-bold text-slate-900 block text-xs uppercase tracking-wider">
                      PERMISOS QUE SE APLICARÁN A ESTE USUARIO:
                    </span>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      Marca o desmarca las casillas para asignar el acceso a cada módulo del sistema:
                    </p>
                  </div>
                  <div className="flex items-center gap-1.5 self-start sm:self-auto shrink-0">
                    <button
                      type="button"
                      onClick={() => {
                        setFormPermDocuments(true);
                        setFormPermAttendance(true);
                        setFormPermAgenda(true);
                        setFormPermAcademicConfig(true);
                        setFormPermSchoolYear(true);
                        setFormPermAcademicPermissions(true);
                        setFormPermAbsenteeismDashboard(true);
                      }}
                      className="px-2 py-1 bg-white hover:bg-indigo-50 text-indigo-700 text-[10px] font-bold border border-slate-200 rounded-lg shadow-2xs transition-colors"
                    >
                      Marcar todos
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setFormPermDocuments(false);
                        setFormPermAttendance(false);
                        setFormPermAgenda(false);
                        setFormPermAcademicConfig(false);
                        setFormPermSchoolYear(false);
                        setFormPermAcademicPermissions(false);
                        setFormPermAbsenteeismDashboard(false);
                      }}
                      className="px-2 py-1 bg-white hover:bg-slate-100 text-slate-600 text-[10px] font-bold border border-slate-200 rounded-lg shadow-2xs transition-colors"
                    >
                      Desmarcar
                    </button>
                  </div>
                </div>

                {/* Las 7 casillas de verificación interactivas */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs pt-1">
                  {/* 1. Documentos Institucionales */}
                  <label className={`flex items-center gap-2.5 p-2.5 rounded-xl border cursor-pointer transition-all ${
                    formPermDocuments 
                      ? 'bg-emerald-50/70 border-emerald-300 text-emerald-950 font-bold shadow-2xs' 
                      : 'bg-white border-slate-200 text-slate-500 font-medium hover:bg-slate-100'
                  }`}>
                    <input
                      type="checkbox"
                      checked={formPermDocuments}
                      onChange={(e) => setFormPermDocuments(e.target.checked)}
                      className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500 border-slate-300 cursor-pointer shrink-0"
                    />
                    <div className="flex items-center gap-1.5 min-w-0">
                      {formPermDocuments ? <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0" /> : <X className="w-3.5 h-3.5 text-slate-400 shrink-0" />}
                      <span className="truncate">Documentos Institucionales (Total)</span>
                    </div>
                  </label>

                  {/* 2. Asistencia Estudiantil */}
                  <label className={`flex items-center gap-2.5 p-2.5 rounded-xl border cursor-pointer transition-all ${
                    formPermAttendance 
                      ? 'bg-emerald-50/70 border-emerald-300 text-emerald-950 font-bold shadow-2xs' 
                      : 'bg-white border-slate-200 text-slate-500 font-medium hover:bg-slate-100'
                  }`}>
                    <input
                      type="checkbox"
                      checked={formPermAttendance}
                      onChange={(e) => setFormPermAttendance(e.target.checked)}
                      className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500 border-slate-300 cursor-pointer shrink-0"
                    />
                    <div className="flex items-center gap-1.5 min-w-0">
                      {formPermAttendance ? <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0" /> : <X className="w-3.5 h-3.5 text-slate-400 shrink-0" />}
                      <span className="truncate">Asistencia Estudiantil (Total)</span>
                    </div>
                  </label>

                  {/* 3. Agenda Académica */}
                  <label className={`flex items-center gap-2.5 p-2.5 rounded-xl border cursor-pointer transition-all ${
                    formPermAgenda 
                      ? 'bg-emerald-50/70 border-emerald-300 text-emerald-950 font-bold shadow-2xs' 
                      : 'bg-white border-slate-200 text-slate-500 font-medium hover:bg-slate-100'
                  }`}>
                    <input
                      type="checkbox"
                      checked={formPermAgenda}
                      onChange={(e) => setFormPermAgenda(e.target.checked)}
                      className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500 border-slate-300 cursor-pointer shrink-0"
                    />
                    <div className="flex items-center gap-1.5 min-w-0">
                      {formPermAgenda ? <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0" /> : <X className="w-3.5 h-3.5 text-slate-400 shrink-0" />}
                      <span className="truncate">Agenda Académica (Total)</span>
                    </div>
                  </label>

                  {/* 4. Configuración Académica */}
                  <label className={`flex items-center gap-2.5 p-2.5 rounded-xl border cursor-pointer transition-all ${
                    formPermAcademicConfig 
                      ? 'bg-emerald-50/70 border-emerald-300 text-emerald-950 font-bold shadow-2xs' 
                      : 'bg-white border-slate-200 text-slate-500 font-medium hover:bg-slate-100'
                  }`}>
                    <input
                      type="checkbox"
                      checked={formPermAcademicConfig}
                      onChange={(e) => setFormPermAcademicConfig(e.target.checked)}
                      className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500 border-slate-300 cursor-pointer shrink-0"
                    />
                    <div className="flex items-center gap-1.5 min-w-0">
                      {formPermAcademicConfig ? <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0" /> : <X className="w-3.5 h-3.5 text-slate-400 shrink-0" />}
                      <span className="truncate">Configuración Académica (Total)</span>
                    </div>
                  </label>

                  {/* 5. Año Escolar */}
                  <label className={`flex items-center gap-2.5 p-2.5 rounded-xl border cursor-pointer transition-all ${
                    formPermSchoolYear 
                      ? 'bg-emerald-50/70 border-emerald-300 text-emerald-950 font-bold shadow-2xs' 
                      : 'bg-white border-slate-200 text-slate-500 font-medium hover:bg-slate-100'
                  }`}>
                    <input
                      type="checkbox"
                      checked={formPermSchoolYear}
                      onChange={(e) => setFormPermSchoolYear(e.target.checked)}
                      className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500 border-slate-300 cursor-pointer shrink-0"
                    />
                    <div className="flex items-center gap-1.5 min-w-0">
                      {formPermSchoolYear ? <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0" /> : <X className="w-3.5 h-3.5 text-slate-400 shrink-0" />}
                      <span className="truncate">Año Escolar (Total)</span>
                    </div>
                  </label>

                  {/* 6. Dashboard de Ausentismo (Panel de Control) */}
                  <label className={`flex items-center gap-2.5 p-2.5 rounded-xl border cursor-pointer transition-all ${
                    formPermAbsenteeismDashboard 
                      ? 'bg-blue-50/90 border-blue-300 text-blue-950 font-bold shadow-2xs' 
                      : 'bg-white border-slate-200 text-slate-500 font-medium hover:bg-slate-100'
                  }`}>
                    <input
                      type="checkbox"
                      checked={formPermAbsenteeismDashboard}
                      onChange={(e) => setFormPermAbsenteeismDashboard(e.target.checked)}
                      className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500 border-slate-300 cursor-pointer shrink-0"
                    />
                    <div className="flex items-center gap-1.5 min-w-0">
                      {formPermAbsenteeismDashboard ? (
                        <Check className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                      ) : (
                        <X className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      )}
                      <span className="truncate">Dashboard Ausentismo (Panel)</span>
                    </div>
                  </label>

                  {/* 7. Permisos Académicos */}
                  <label className={`flex items-center gap-2.5 p-2.5 rounded-xl border cursor-pointer transition-all sm:col-span-2 ${
                    formPermAcademicPermissions 
                      ? 'bg-indigo-50/90 border-indigo-300 text-indigo-950 font-bold shadow-2xs' 
                      : 'bg-white border-slate-200 text-slate-500 font-medium hover:bg-slate-100'
                  }`}>
                    <input
                      type="checkbox"
                      checked={formPermAcademicPermissions}
                      onChange={(e) => setFormPermAcademicPermissions(e.target.checked)}
                      className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 border-slate-300 cursor-pointer shrink-0"
                    />
                    <div className="flex items-center gap-1.5 min-w-0">
                      {formPermAcademicPermissions ? (
                        <Check className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                      ) : (
                        <X className="w-3.5 h-3.5 text-rose-500 shrink-0" />
                      )}
                      <span className={formPermAcademicPermissions ? "text-indigo-900 font-bold" : "text-rose-600 font-semibold"}>
                        Permisos Académicos {formPermAcademicPermissions ? "(Habilitado)" : "(BLOQUEADO)"}
                      </span>
                    </div>
                  </label>
                </div>
              </div>

              {/* Footer */}
              <div className="pt-3 border-t border-slate-100 flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  disabled={isSaving}
                  className="w-full sm:w-auto px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl transition-colors text-center"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="w-full sm:w-auto flex items-center justify-center gap-1.5 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl shadow-xs transition-all hover:scale-102 active:scale-98 disabled:opacity-50"
                >
                  {isSaving ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin shrink-0" />
                      <span>Guardando...</span>
                    </>
                  ) : (
                    <>
                      <Save className="w-4 h-4 shrink-0" />
                      <span>{editingUser ? 'Guardar Cambios' : 'Crear Usuario'}</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL IMPORTACIÓN MASIVA DESDE EXCEL */}
      {showExcelModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
          <div className="bg-white rounded-3xl max-w-3xl w-full shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[95vh] animate-in zoom-in-95 duration-200">
            {/* Header */}
            <div className="px-5 py-4 bg-gradient-to-r from-emerald-800 to-teal-800 text-white flex items-center justify-between shrink-0">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-white/10 rounded-2xl border border-white/10 shrink-0">
                  <FileSpreadsheet className="w-5 h-5 text-emerald-200" />
                </div>
                <div>
                  <h3 className="font-bold text-sm sm:text-base text-white flex items-center gap-2">
                    <span>Importación Masiva de Usuarios desde Excel</span>
                    <span className="px-2 py-0.5 rounded-full bg-emerald-500/30 text-emerald-100 border border-emerald-400/30 text-[10px] font-mono">
                      .XLSX / .CSV
                    </span>
                  </h3>
                  <p className="text-xs text-emerald-200">
                    Carga rápida por columnas: <strong>Casilla A2: Usuario</strong> • <strong>Columna B2: Contraseña</strong>
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowExcelModal(false)}
                className="p-1.5 text-emerald-200 hover:text-white rounded-xl hover:bg-white/10 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-4 sm:p-6 overflow-y-auto space-y-4 text-xs">
              {/* Instructions and Download Template Bar */}
              <div className="p-4 bg-emerald-50/70 border border-emerald-200 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="space-y-1">
                  <h4 className="font-bold text-emerald-950 text-xs sm:text-sm flex items-center gap-1.5">
                    <Info className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span>Estructura Requerida en tu Hoja de Excel:</span>
                  </h4>
                  <ul className="text-[11px] text-emerald-800 space-y-0.5 list-disc list-inside">
                    <li><strong>Fila 1:</strong> Encabezados de columnas (se ignoran automáticamente).</li>
                    <li><strong>Columna A (Desde A2):</strong> Nombre de usuario (ej: <code className="font-mono bg-white px-1 py-0.5 rounded text-emerald-900">docente1</code>).</li>
                    <li><strong>Columna B (Desde B2):</strong> Contraseña correspondiente (mínimo 4 caracteres).</li>
                    <li><strong>Columnas C y D (Opcionales):</strong> Nombre Completo y Cargo del docente.</li>
                  </ul>
                </div>
                <button
                  type="button"
                  onClick={handleDownloadExcelTemplate}
                  className="px-3.5 py-2.5 bg-white hover:bg-emerald-100 text-emerald-800 border border-emerald-300 rounded-xl font-bold text-xs flex items-center justify-center gap-2 shadow-2xs transition-all shrink-0 self-start sm:self-auto hover:scale-102"
                >
                  <Download className="w-4 h-4 text-emerald-600" />
                  <span>Descargar Plantilla Excel</span>
                </button>
              </div>

              {/* Upload Drag & Drop Box */}
              <div
                onDragOver={(e) => {
                  e.preventDefault();
                  setIsDraggingFile(true);
                }}
                onDragLeave={() => setIsDraggingFile(false)}
                onDrop={handleExcelDrop}
                className={`p-6 border-2 border-dashed rounded-2xl text-center transition-all ${
                  isDraggingFile
                    ? 'border-emerald-500 bg-emerald-50/60 ring-4 ring-emerald-100'
                    : 'border-slate-300 hover:border-emerald-400 bg-slate-50/60'
                }`}
              >
                <input
                  type="file"
                  id="excel-users-file-input"
                  accept=".xlsx, .xls, .csv"
                  onChange={handleExcelInputChange}
                  className="hidden"
                />
                <label
                  htmlFor="excel-users-file-input"
                  className="cursor-pointer flex flex-col items-center justify-center gap-2.5"
                >
                  <div className="w-12 h-12 rounded-2xl bg-emerald-100 text-emerald-700 flex items-center justify-center shadow-2xs">
                    <UploadCloud className="w-6 h-6" />
                  </div>
                  <div>
                    <p className="font-bold text-slate-800 text-sm">
                      {excelFile ? excelFile.name : 'Haz clic para seleccionar tu archivo Excel o arrástralo aquí'}
                    </p>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      Soporta libros de Excel (.xlsx, .xls) y archivos separados por comas (.csv)
                    </p>
                  </div>
                  <span className="px-3 py-1 bg-white border border-slate-200 rounded-lg text-emerald-700 font-bold text-xs shadow-2xs">
                    {excelFile ? 'Cambiar archivo' : 'Examinar archivos'}
                  </span>
                </label>
              </div>

              {/* Error Alert */}
              {excelError && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 flex items-center gap-2 font-medium">
                  <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
                  <span>{excelError}</span>
                </div>
              )}

              {/* Permisos a aplicar a los usuarios importados */}
              <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl space-y-2">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="font-bold text-slate-900 text-xs uppercase tracking-wider">
                      Permisos que se aplicarán a este lote de usuarios:
                    </h4>
                    <p className="text-[11px] text-slate-500">
                      Todos los usuarios importados recibirán los siguientes accesos en el sistema:
                    </p>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => {
                        setBatchPermDocs(true);
                        setBatchPermAttendance(true);
                        setBatchPermAgenda(true);
                        setBatchPermAcademicConfig(true);
                        setBatchPermSchoolYear(true);
                        setBatchPermAbsenteeismDashboard(true);
                        setBatchPermAcademicPermissions(true);
                      }}
                      className="px-2 py-0.5 bg-white text-indigo-700 border border-slate-200 rounded text-[10px] font-bold shadow-2xs"
                    >
                      Todos
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setBatchPermDocs(false);
                        setBatchPermAttendance(false);
                        setBatchPermAgenda(false);
                        setBatchPermAcademicConfig(false);
                        setBatchPermSchoolYear(false);
                        setBatchPermAbsenteeismDashboard(false);
                        setBatchPermAcademicPermissions(false);
                      }}
                      className="px-2 py-0.5 bg-white text-slate-600 border border-slate-200 rounded text-[10px] font-bold shadow-2xs"
                    >
                      Ninguno
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 pt-1 text-[11px]">
                  <label className="flex items-center gap-2 p-2 bg-white rounded-lg border border-slate-200 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={batchPermDocs}
                      onChange={(e) => setBatchPermDocs(e.target.checked)}
                      className="w-3.5 h-3.5 text-emerald-600 rounded"
                    />
                    <span className="font-medium">✓ Documentos</span>
                  </label>
                  <label className="flex items-center gap-2 p-2 bg-white rounded-lg border border-slate-200 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={batchPermAttendance}
                      onChange={(e) => setBatchPermAttendance(e.target.checked)}
                      className="w-3.5 h-3.5 text-emerald-600 rounded"
                    />
                    <span className="font-medium">✓ Asistencia</span>
                  </label>
                  <label className="flex items-center gap-2 p-2 bg-white rounded-lg border border-slate-200 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={batchPermAgenda}
                      onChange={(e) => setBatchPermAgenda(e.target.checked)}
                      className="w-3.5 h-3.5 text-emerald-600 rounded"
                    />
                    <span className="font-medium">✓ Agenda</span>
                  </label>
                  <label className="flex items-center gap-2 p-2 bg-white rounded-lg border border-slate-200 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={batchPermAcademicConfig}
                      onChange={(e) => setBatchPermAcademicConfig(e.target.checked)}
                      className="w-3.5 h-3.5 text-emerald-600 rounded"
                    />
                    <span className="font-medium">✓ Configuración</span>
                  </label>
                  <label className="flex items-center gap-2 p-2 bg-white rounded-lg border border-slate-200 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={batchPermSchoolYear}
                      onChange={(e) => setBatchPermSchoolYear(e.target.checked)}
                      className="w-3.5 h-3.5 text-emerald-600 rounded"
                    />
                    <span className="font-medium">✓ Año Escolar</span>
                  </label>
                  <label className="flex items-center gap-2 p-2 bg-white rounded-lg border border-slate-200 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={batchPermAbsenteeismDashboard}
                      onChange={(e) => setBatchPermAbsenteeismDashboard(e.target.checked)}
                      className="w-3.5 h-3.5 text-blue-600 rounded"
                    />
                    <span className="font-bold text-blue-900">✓ Dashboard Ausentismo</span>
                  </label>
                  <label className="flex items-center gap-2 p-2 bg-white rounded-lg border border-slate-200 cursor-pointer sm:col-span-3">
                    <input
                      type="checkbox"
                      checked={batchPermAcademicPermissions}
                      onChange={(e) => setBatchPermAcademicPermissions(e.target.checked)}
                      className="w-3.5 h-3.5 text-indigo-600 rounded"
                    />
                    <span className={batchPermAcademicPermissions ? "font-bold text-indigo-900" : "font-semibold text-rose-600"}>
                      Permisos Académicos {batchPermAcademicPermissions ? "(Habilitado)" : "(BLOQUEADO por defecto)"}
                    </span>
                  </label>
                </div>
              </div>

              {/* Preview Table of Rows */}
              {excelParsedRows.length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <h4 className="font-bold text-slate-900 flex items-center gap-2">
                      <span>Vista Previa de Usuarios ({excelParsedRows.length} filas detectadas)</span>
                    </h4>
                    <div className="flex items-center gap-2 text-[11px] font-bold">
                      <span className="text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                        {excelParsedRows.filter(r => r.isValid).length} Válidos
                      </span>
                      {excelParsedRows.some(r => !r.isValid) && (
                        <span className="text-rose-700 bg-rose-50 px-2 py-0.5 rounded border border-rose-200">
                          {excelParsedRows.filter(r => !r.isValid).length} Con error
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="border border-slate-200 rounded-xl overflow-hidden max-h-56 overflow-y-auto">
                    <table className="w-full text-left border-collapse text-[11px]">
                      <thead className="bg-slate-100 text-slate-600 font-bold sticky top-0 uppercase tracking-wider text-[10px]">
                        <tr>
                          <th className="py-2 px-3 w-12 text-center">Fila</th>
                          <th className="py-2 px-3">Usuario (Col. A)</th>
                          <th className="py-2 px-3">Contraseña (Col. B)</th>
                          <th className="py-2 px-3">Nombre Completo (Col. C)</th>
                          <th className="py-2 px-3">Cargo (Col. D)</th>
                          <th className="py-2 px-3 text-center">Estado</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 font-medium">
                        {excelParsedRows.map((r) => (
                          <tr key={r.rowNum} className={r.isValid ? "hover:bg-slate-50" : "bg-rose-50/50"}>
                            <td className="py-2 px-3 text-center text-slate-400 font-bold">{r.rowNum}</td>
                            <td className="py-2 px-3">
                              <span className="font-mono font-bold text-indigo-700 bg-indigo-50 px-1.5 py-0.5 rounded border border-indigo-200">
                                @{r.username}
                              </span>
                            </td>
                            <td className="py-2 px-3 font-mono text-slate-700">{r.password}</td>
                            <td className="py-2 px-3 text-slate-900 truncate max-w-[150px]">{r.fullName}</td>
                            <td className="py-2 px-3 text-slate-500 truncate max-w-[120px]">{r.cargo}</td>
                            <td className="py-2 px-3 text-center">
                              {r.isValid ? (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-bold">
                                  <Check className="w-3 h-3 text-emerald-600" />
                                  Listo
                                </span>
                              ) : (
                                <span 
                                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-rose-100 text-rose-800 text-[10px] font-bold cursor-help"
                                  title={r.error}
                                >
                                  <X className="w-3 h-3 text-rose-600" />
                                  {r.error || 'Inválido'}
                                </span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-4 bg-slate-50 border-t border-slate-200 flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-between gap-3 shrink-0">
              <span className="text-[11px] text-slate-500 text-center sm:text-left">
                {excelParsedRows.length > 0 
                  ? `${excelParsedRows.filter(r => r.isValid).length} de ${excelParsedRows.length} usuarios listos para ser guardados.`
                  : 'Sube un archivo para comenzar la validación.'}
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setShowExcelModal(false)}
                  disabled={isImportingExcel}
                  className="w-full sm:w-auto px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold rounded-xl text-xs transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleConfirmExcelImport}
                  disabled={isImportingExcel || excelParsedRows.filter(r => r.isValid).length === 0}
                  className="w-full sm:w-auto px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-xs shadow-xs transition-all flex items-center justify-center gap-2 disabled:opacity-50 hover:scale-102 active:scale-98"
                >
                  {isImportingExcel ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Guardando en la base de datos...</span>
                    </>
                  ) : (
                    <>
                      <FileSpreadsheet className="w-4 h-4" />
                      <span>
                        Importar {excelParsedRows.filter(r => r.isValid).length} Usuarios
                      </span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
