import React, { useState } from 'react';
import { 
  User, 
  KeyRound, 
  Lock, 
  Eye, 
  EyeOff, 
  CheckCircle2, 
  AlertCircle, 
  X, 
  ShieldCheck, 
  Briefcase, 
  Mail, 
  Save, 
  Loader2,
  Check,
  Sparkles
} from 'lucide-react';
import { AppSessionUser, SystemUserRecord, SystemUserPermissions } from '../../types';
import { isSuperAdminEmail, ADMIN_EMAIL } from '../../firebase';
import { changeUserPassword } from '../../utils/systemUsersService';

interface UserProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  user: AppSessionUser;
  permissions: SystemUserPermissions;
}

export function UserProfileModal({
  isOpen,
  onClose,
  user,
  permissions
}: UserProfileModalProps) {
  if (!isOpen) return null;

  const isSuperAdmin = isSuperAdminEmail(user.email);
  const isCustomUser = Boolean(user.isCustomAuth || user.username);

  // Form states
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  // Password visibility
  const [showCurrentPass, setShowCurrentPass] = useState(false);
  const [showNewPass, setShowNewPass] = useState(false);
  const [showConfirmPass, setShowConfirmPass] = useState(false);

  // Status
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);

    const trimmedCurrent = currentPassword.trim();
    const trimmedNew = newPassword.trim();
    const trimmedConfirm = confirmPassword.trim();

    if (!trimmedCurrent) {
      setErrorMsg('Debes ingresar tu contraseña actual.');
      return;
    }

    if (!trimmedNew || trimmedNew.length < 4) {
      setErrorMsg('La nueva contraseña debe tener como mínimo 4 caracteres.');
      return;
    }

    if (trimmedNew !== trimmedConfirm) {
      setErrorMsg('La nueva contraseña y su confirmación no coinciden.');
      return;
    }

    if (trimmedCurrent === trimmedNew) {
      setErrorMsg('La nueva contraseña no puede ser idéntica a la anterior.');
      return;
    }

    setIsSubmitting(true);
    try {
      const identifier = user.username || user.uid;
      const res = await changeUserPassword(identifier, trimmedCurrent, trimmedNew);

      if (!res.success) {
        setErrorMsg(res.error || 'Error al actualizar la contraseña.');
        setIsSubmitting(false);
        return;
      }

      setSuccessMsg('¡Tu contraseña se ha cambiado exitosamente!');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setTimeout(() => {
        setSuccessMsg(null);
      }, 5000);
    } catch (err: any) {
      console.error('Error changing password:', err);
      setErrorMsg(err.message || 'Error inesperado al cambiar la contraseña.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
      <div className="bg-white rounded-3xl max-w-lg w-full shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[92vh] animate-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="px-5 py-4 bg-gradient-to-r from-slate-900 via-indigo-950 to-indigo-900 text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-white/10 flex items-center justify-center text-indigo-300 border border-white/10 shadow-xs">
              <User className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-sm sm:text-base text-white flex items-center gap-2">
                <span>Mi Perfil Institucional</span>
                {isSuperAdmin && (
                  <span className="px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 text-[10px] font-mono border border-amber-400/30">
                    Superadmin
                  </span>
                )}
              </h3>
              <p className="text-xs text-indigo-200">
                Información de cuenta y cambio seguro de contraseña
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-300 hover:text-white rounded-xl hover:bg-white/10 transition-colors"
            title="Cerrar ventana"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content body */}
        <div className="p-5 sm:p-6 overflow-y-auto space-y-5 text-xs">
          
          {/* Tarjeta de Información de Usuario */}
          <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-3">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-indigo-600 text-white font-black text-base flex items-center justify-center uppercase shadow-xs shrink-0">
                {user.username ? user.username.charAt(0) : user.displayName?.charAt(0) || 'U'}
              </div>
              <div className="min-w-0 flex-1">
                <h4 className="font-bold text-sm text-slate-900 truncate">
                  {user.displayName || user.username || user.email}
                </h4>
                <div className="flex flex-wrap items-center gap-2 mt-0.5">
                  {user.username && (
                    <span className="font-mono font-bold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-200 text-[11px]">
                      @{user.username}
                    </span>
                  )}
                  <span className="text-slate-500 text-[11px] flex items-center gap-1">
                    <Briefcase className="w-3 h-3 text-slate-400" />
                    {isSuperAdmin ? 'Rectoría / Administrador Principal' : (user.cargo || 'Docente / Personal')}
                  </span>
                </div>
              </div>
            </div>

            {/* Email o Identificador */}
            <div className="pt-2 border-t border-slate-200/80 grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px]">
              <div className="flex items-center gap-1.5 text-slate-600">
                <Mail className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                <span className="truncate">{user.email || 'Sin correo asociado'}</span>
              </div>
              <div className="flex items-center gap-1.5 text-slate-600">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                <span>
                  {isCustomUser ? 'Acceso con Usuario y Contraseña' : 'Autenticación con Google'}
                </span>
              </div>
            </div>

            {/* Resumen de permisos asignados */}
            <div className="pt-2 border-t border-slate-200/80">
              <span className="text-[10px] uppercase font-bold text-slate-400 block mb-1">
                Tus Permisos en el Sistema:
              </span>
              <div className="flex flex-wrap gap-1">
                {permissions.documents && (
                  <span className="px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-bold">
                    ✓ Documentos
                  </span>
                )}
                {permissions.attendance && (
                  <span className="px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-bold">
                    ✓ Asistencia
                  </span>
                )}
                {permissions.agenda && (
                  <span className="px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-bold">
                    ✓ Agenda
                  </span>
                )}
                {permissions.academicConfig && (
                  <span className="px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-bold">
                    ✓ Configuración
                  </span>
                )}
                {permissions.schoolYear && (
                  <span className="px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-bold">
                    ✓ Año Escolar
                  </span>
                )}
                {permissions.academicPermissions && (
                  <span className="px-2 py-0.5 rounded-md bg-indigo-50 text-indigo-700 border border-indigo-200 text-[10px] font-bold">
                    ✓ Permisos Académicos
                  </span>
                )}
                {permissions.absenteeismDashboard && (
                  <span className="px-2 py-0.5 rounded-md bg-blue-50 text-blue-700 border border-blue-200 text-[10px] font-bold">
                    ✓ Dashboard Ausentismo
                  </span>
                )}
                {permissions.manageUsers && (
                  <span className="px-2 py-0.5 rounded-md bg-purple-50 text-purple-700 border border-purple-200 text-[10px] font-bold">
                    ✓ Gestión de Usuarios
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Sección de Cambio de Contraseña para usuarios de Usuario/Clave */}
          {isCustomUser ? (
            <div className="border border-slate-200 rounded-2xl p-4 sm:p-5 space-y-3.5 bg-white shadow-2xs">
              <div className="flex items-center gap-2 pb-2 border-b border-slate-100">
                <div className="p-1.5 bg-indigo-50 text-indigo-600 rounded-lg">
                  <KeyRound className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="font-bold text-slate-900 text-xs sm:text-sm">
                    Cambiar Mi Contraseña
                  </h4>
                  <p className="text-[11px] text-slate-500">
                    Actualiza tu clave de acceso. Se guardará de inmediato en el sistema.
                  </p>
                </div>
              </div>

              {/* Success Notification */}
              {successMsg && (
                <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-800 flex items-center gap-2 text-xs font-semibold animate-in fade-in duration-200">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>{successMsg}</span>
                </div>
              )}

              {/* Error Notification */}
              {errorMsg && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 flex items-center gap-2 text-xs font-semibold animate-in fade-in duration-200">
                  <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                  <span>{errorMsg}</span>
                </div>
              )}

              <form onSubmit={handlePasswordSubmit} className="space-y-3">
                {/* 1. Contraseña Actual */}
                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <label className="font-bold text-slate-700 flex items-center gap-1.5 text-xs">
                      <Lock className="w-3.5 h-3.5 text-slate-400" />
                      <span>Contraseña Actual *</span>
                    </label>
                    <button
                      type="button"
                      onClick={() => setShowCurrentPass(!showCurrentPass)}
                      className="text-[11px] font-semibold text-indigo-600 hover:text-indigo-800 flex items-center gap-1"
                    >
                      {showCurrentPass ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                      <span>{showCurrentPass ? 'Ocultar' : 'Ver'}</span>
                    </button>
                  </div>
                  <input
                    type={showCurrentPass ? 'text' : 'password'}
                    required
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    placeholder="Ingresa tu contraseña actual"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-mono text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white"
                  />
                </div>

                {/* 2. Nueva Contraseña */}
                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <label className="font-bold text-slate-700 flex items-center gap-1.5 text-xs">
                      <KeyRound className="w-3.5 h-3.5 text-indigo-600" />
                      <span>Nueva Contraseña *</span>
                    </label>
                    <button
                      type="button"
                      onClick={() => setShowNewPass(!showNewPass)}
                      className="text-[11px] font-semibold text-indigo-600 hover:text-indigo-800 flex items-center gap-1"
                    >
                      {showNewPass ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                      <span>{showNewPass ? 'Ocultar' : 'Ver'}</span>
                    </button>
                  </div>
                  <input
                    type={showNewPass ? 'text' : 'password'}
                    required
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Mínimo 4 caracteres"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-mono text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white"
                  />
                </div>

                {/* 3. Confirmar Nueva Contraseña */}
                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <label className="font-bold text-slate-700 flex items-center gap-1.5 text-xs">
                      <Check className="w-3.5 h-3.5 text-emerald-600" />
                      <span>Confirmar Nueva Contraseña *</span>
                    </label>
                    <button
                      type="button"
                      onClick={() => setShowConfirmPass(!showConfirmPass)}
                      className="text-[11px] font-semibold text-indigo-600 hover:text-indigo-800 flex items-center gap-1"
                    >
                      {showConfirmPass ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                      <span>{showConfirmPass ? 'Ocultar' : 'Ver'}</span>
                    </button>
                  </div>
                  <input
                    type={showConfirmPass ? 'text' : 'password'}
                    required
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Vuelve a escribir la nueva clave"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-mono text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white"
                  />
                </div>

                <div className="pt-2">
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="w-full py-2.5 px-4 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl shadow-xs transition-all flex items-center justify-center gap-2 hover:scale-101 active:scale-99 disabled:opacity-50 text-xs min-h-[42px]"
                  >
                    {isSubmitting ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>Actualizando contraseña...</span>
                      </>
                    ) : (
                      <>
                        <Save className="w-4 h-4" />
                        <span>Guardar Nueva Contraseña</span>
                      </>
                    )}
                  </button>
                </div>
              </form>
            </div>
          ) : (
            /* Cuenta Google Superadmin */
            <div className="p-4 bg-indigo-50/60 border border-indigo-200 rounded-2xl space-y-2">
              <div className="flex items-center gap-2 text-indigo-900 font-bold text-xs">
                <ShieldCheck className="w-4 h-4 text-indigo-600" />
                <span>Autenticación Gestionada por Google</span>
              </div>
              <p className="text-slate-600 text-xs leading-relaxed">
                Has iniciado sesión con tu cuenta de Google (<strong className="text-slate-900">{user.email}</strong>). La contraseña y la seguridad de acceso se gestionan directamente a través de tu cuenta de Google Workspace o Gmail.
              </p>
              <div className="p-2.5 bg-white rounded-xl border border-indigo-100 text-[11px] text-slate-500 flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-amber-500 shrink-0" />
                <span>Cuentas de Superadministrador con acceso total: <strong>diegoalejandro.narvaezmeza95@gmail.com</strong> y <strong>quino1981@gmail.com</strong></span>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between shrink-0">
          <span className="text-[11px] text-slate-400">
            I.E. Juan Pablo I • La Llanada
          </span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold rounded-xl transition-colors text-xs"
          >
            Cerrar
          </button>
        </div>

      </div>
    </div>
  );
}
