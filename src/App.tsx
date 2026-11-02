import React, { useEffect, useState, useMemo, FormEvent } from "react";
import { onAuthStateChanged, signInWithPopup, signOut } from "firebase/auth";
import { auth, googleProvider, ADMIN_EMAIL, SUPERADMIN_EMAILS } from "./firebase";
import { Dashboard } from "./components/Dashboard";
import { UserProfileModal } from "./components/Profile/UserProfileModal";
import { SystemUserRecord, AppSessionUser } from "./types";
import { 
  subscribeToSystemUsers, 
  evaluateUserPermissions,
  authenticateUserByCredentials,
  getStoredCustomSession,
  setStoredCustomSession,
  clearStoredCustomSession
} from "./utils/systemUsersService";
import { 
  LogOut, 
  LayoutDashboard, 
  Folder, 
  GraduationCap, 
  ChevronLeft, 
  ChevronRight, 
  Menu, 
  Calendar, 
  CalendarRange, 
  ClipboardCheck, 
  FileCheck2, 
  Users,
  ShieldCheck,
  ShieldAlert,
  Lock,
  X,
  KeyRound,
  Eye,
  EyeOff,
  User as UserIcon,
  LogIn,
  AlertCircle,
  Loader2
} from "lucide-react";

export type AppView = 'dashboard' | 'documents' | 'agenda' | 'generator' | 'schoolYear' | 'attendance' | 'academicPermissions' | 'users';

export default function App() {
  const [user, setUser] = useState<AppSessionUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [activeView, setActiveView] = useState<AppView>('dashboard');
  const [systemUsers, setSystemUsers] = useState<SystemUserRecord[]>([]);
  const [showProfileModal, setShowProfileModal] = useState(false);

  // Credential Login form state (Docentes y Personal)
  const [loginUsername, setLoginUsername] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loginSubmitting, setLoginSubmitting] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);

  useEffect(() => {
    // 1. Verificar si hay sesión local activa de usuario/contraseña
    const storedSession = getStoredCustomSession();
    if (storedSession) {
      setUser(storedSession);
      setLoading(false);
    }

    // 2. Suscribirse a Firebase Auth para el Administrador con Google
    const unsubscribeAuth = onAuthStateChanged(auth, (currentUser) => {
      if (currentUser) {
        // Sesión activa con Google (Admin o cuenta externa)
        const sessionUser: AppSessionUser = {
          uid: currentUser.uid,
          displayName: currentUser.displayName,
          email: currentUser.email,
          photoURL: currentUser.photoURL,
          isCustomAuth: false
        };
        setUser(sessionUser);
        clearStoredCustomSession();
      } else {
        // Si no hay Google auth y tampoco sesión personalizada en localStorage
        const customStillActive = getStoredCustomSession();
        if (!customStillActive) {
          setUser(null);
        }
      }
      setLoading(false);
    });

    // 3. Suscribirse a usuarios del sistema
    const unsubscribeUsers = subscribeToSystemUsers(
      (users) => {
        setSystemUsers(users);
      },
      (err) => {
        console.warn("Aviso al sincronizar usuarios del sistema:", err);
      }
    );

    return () => {
      unsubscribeAuth();
      unsubscribeUsers();
    };
  }, []);

  // Evaluador de roles y permisos institucionales
  const authInfo = useMemo(() => {
    return evaluateUserPermissions(user, systemUsers);
  }, [user, systemUsers]);

  const isSuperAdmin = authInfo.isSuperAdmin;
  const isAuthorized = authInfo.isAuthorized;
  const permissions = authInfo.permissions;

  // Redirección de seguridad si un usuario sin permiso intenta entrar por estado previo
  useEffect(() => {
    if (!permissions.documents && activeView === 'documents') {
      setActiveView('dashboard');
    }
    if (!permissions.attendance && activeView === 'attendance') {
      setActiveView('dashboard');
    }
    if (!permissions.academicPermissions && activeView === 'academicPermissions') {
      setActiveView(permissions.attendance ? 'attendance' : 'dashboard');
    }
    if (!permissions.agenda && activeView === 'agenda') {
      setActiveView('dashboard');
    }
    if (!permissions.academicConfig && activeView === 'generator') {
      setActiveView('dashboard');
    }
    if (!permissions.schoolYear && activeView === 'schoolYear') {
      setActiveView('dashboard');
    }
    if (!permissions.manageUsers && activeView === 'users') {
      setActiveView('dashboard');
    }
  }, [activeView, permissions]);

  // Inicio de sesión con Usuario y Contraseña (Docentes y Personal)
  const handleCredentialsLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError(null);
    setLoginSubmitting(true);

    try {
      const res = await authenticateUserByCredentials(loginUsername, loginPassword);
      if (!res.success || !res.user) {
        setLoginError(res.error || "Usuario o contraseña inválidos.");
        setLoginSubmitting(false);
        return;
      }

      const sessionUser: AppSessionUser = {
        uid: res.user.id,
        displayName: res.user.fullName,
        email: res.user.email || `${res.user.username}@juanpablo.edu.co`,
        username: res.user.username,
        cargo: res.user.cargo,
        role: res.user.role,
        isCustomAuth: true,
        photoURL: null
      };

      setStoredCustomSession(sessionUser);
      setUser(sessionUser);
      setActiveView('dashboard');
      setLoginUsername("");
      setLoginPassword("");
    } catch (err: any) {
      console.error("Error al iniciar sesión:", err);
      setLoginError(err.message || "Error al iniciar sesión en el sistema.");
    } finally {
      setLoginSubmitting(false);
    }
  };

  // Inicio de sesión con Google (Exclusivo Rectoría / Administrador Principal)
  const handleGoogleAdminLogin = async () => {
    setLoginError(null);
    setLoginSubmitting(true);
    try {
      clearStoredCustomSession();
      await signInWithPopup(auth, googleProvider);
    } catch (error: any) {
      console.error("Login con Google falló:", error);
      setLoginError("No se pudo completar el acceso con Google.");
    } finally {
      setLoginSubmitting(false);
    }
  };

  const handleLogout = async () => {
    try {
      clearStoredCustomSession();
      await signOut(auth);
      setUser(null);
      setIsMobileMenuOpen(false);
      setLoginError(null);
    } catch (error) {
      console.error("Logout failed:", error);
    }
  };

  const handleNavigate = (view: AppView) => {
    // Protección de navegación según permisos activos
    if (view === 'documents' && !permissions.documents) return;
    if (view === 'attendance' && !permissions.attendance) return;
    if (view === 'academicPermissions' && !permissions.academicPermissions) return;
    if (view === 'agenda' && !permissions.agenda) return;
    if (view === 'generator' && !permissions.academicConfig) return;
    if (view === 'schoolYear' && !permissions.schoolYear) return;
    if (view === 'users' && !permissions.manageUsers) return;

    setActiveView(view);
    setIsMobileMenuOpen(false);
  };

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-slate-100">
        <div className="flex flex-col items-center gap-3">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-indigo-600"></div>
          <span className="text-xs font-bold text-slate-500">Cargando sistema institucional...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-slate-100 font-sans text-slate-800 overflow-hidden">
      {/* Mobile Drawer Backdrop */}
      {user && isMobileMenuOpen && (
        <div 
          onClick={() => setIsMobileMenuOpen(false)}
          className="fixed inset-0 bg-slate-950/70 backdrop-blur-xs z-40 lg:hidden animate-in fade-in duration-200"
          aria-hidden="true"
        />
      )}

      {/* Mobile Off-canvas Navigation Drawer */}
      {user && (
        <aside className={`fixed inset-y-0 left-0 z-50 w-72 max-w-[85vw] bg-slate-900 flex flex-col lg:hidden transition-transform duration-300 shadow-2xl ${
          isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'
        }`}>
          {/* Mobile Drawer Header */}
          <div className="p-4 border-b border-slate-800 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-white rounded-xl flex shrink-0 items-center justify-center p-1 shadow-xs">
                <img src="/JUANI.png" alt="Logo" className="w-full h-full object-contain" />
              </div>
              <div className="flex flex-col whitespace-nowrap overflow-hidden">
                <span className="text-white font-bold text-sm tracking-tight">JUAN PABLO I</span>
                <span className="text-indigo-400 text-[10px] uppercase font-bold tracking-wider">Menú Principal</span>
              </div>
            </div>
            <button
              onClick={() => setIsMobileMenuOpen(false)}
              className="p-2 text-slate-400 hover:text-white rounded-xl hover:bg-slate-800 min-h-[44px] min-w-[44px] flex items-center justify-center"
              aria-label="Cerrar menú"
            >
              <X className="w-6 h-6" />
            </button>
          </div>

          {/* Navigation Links for Mobile Drawer */}
          <nav className="flex-1 px-3 py-3 overflow-y-auto">
            <ul className="space-y-1.5">
              <li>
                <button 
                  onClick={() => handleNavigate('dashboard')} 
                  className={`w-full flex items-center gap-3 px-3.5 py-3 rounded-xl text-sm font-semibold transition-colors min-h-[44px] ${
                    activeView === 'dashboard' ? 'bg-indigo-600 text-white shadow-xs' : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                  }`}
                >
                  <LayoutDashboard className="w-5 h-5 shrink-0" />
                  <span>Panel de Control</span>
                </button>
              </li>
              {permissions.documents && (
                <li>
                  <button 
                    onClick={() => handleNavigate('documents')} 
                    className={`w-full flex items-center gap-3 px-3.5 py-3 rounded-xl text-sm font-semibold transition-colors min-h-[44px] ${
                      activeView === 'documents' ? 'bg-indigo-600 text-white shadow-xs' : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                    }`}
                  >
                    <Folder className="w-5 h-5 shrink-0" />
                    <span>Documentos</span>
                  </button>
                </li>
              )}
              {permissions.attendance && (
                <li>
                  <button 
                    onClick={() => handleNavigate('attendance')} 
                    className={`w-full flex items-center gap-3 px-3.5 py-3 rounded-xl text-sm font-semibold transition-colors min-h-[44px] ${
                      activeView === 'attendance' ? 'bg-indigo-600 text-white shadow-xs' : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                    }`}
                  >
                    <ClipboardCheck className="w-5 h-5 shrink-0 text-amber-300" />
                    <span>Asistencia Estudiantil</span>
                  </button>
                </li>
              )}

              {/* Permisos Académicos: Habilitado según permisos configurados */}
              {permissions.academicPermissions && (
                <li>
                  <button 
                    onClick={() => handleNavigate('academicPermissions')} 
                    className={`w-full flex items-center gap-3 px-3.5 py-3 rounded-xl text-sm font-semibold transition-colors min-h-[44px] ${
                      activeView === 'academicPermissions' ? 'bg-indigo-600 text-white shadow-xs' : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                    }`}
                  >
                    <FileCheck2 className="w-5 h-5 shrink-0 text-amber-300" />
                    <span>Permisos Académicos</span>
                  </button>
                </li>
              )}

              {permissions.agenda && (
                <li>
                  <button 
                    onClick={() => handleNavigate('agenda')} 
                    className={`w-full flex items-center gap-3 px-3.5 py-3 rounded-xl text-sm font-semibold transition-colors min-h-[44px] ${
                      activeView === 'agenda' ? 'bg-indigo-600 text-white shadow-xs' : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                    }`}
                  >
                    <Calendar className="w-5 h-5 shrink-0" />
                    <span>Agenda Académica</span>
                  </button>
                </li>
              )}

              {/* Módulos Académicos con Acceso Completo para personal creado */}
              {permissions.academicConfig && (
                <li>
                  <button 
                    onClick={() => handleNavigate('generator')} 
                    className={`w-full flex items-center gap-3 px-3.5 py-3 rounded-xl text-sm font-semibold transition-colors min-h-[44px] ${
                      activeView === 'generator' ? 'bg-indigo-600 text-white shadow-xs' : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                    }`}
                  >
                    <GraduationCap className="w-5 h-5 shrink-0" />
                    <span>Configuración Académica</span>
                  </button>
                </li>
              )}

              {permissions.schoolYear && (
                <li>
                  <button 
                    onClick={() => handleNavigate('schoolYear')} 
                    className={`w-full flex items-center gap-3 px-3.5 py-3 rounded-xl text-sm font-semibold transition-colors min-h-[44px] ${
                      activeView === 'schoolYear' ? 'bg-indigo-600 text-white shadow-xs' : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                    }`}
                  >
                    <CalendarRange className="w-5 h-5 shrink-0" />
                    <span>Año Escolar</span>
                  </button>
                </li>
              )}

              {/* Gestión de Usuarios: Exclusivo Superadmin */}
              {permissions.manageUsers && (
                <>
                  <li className="pt-2 pb-1 px-3 text-[10px] font-bold uppercase tracking-wider text-slate-500">
                    Administración
                  </li>
                  <li>
                    <button 
                      onClick={() => handleNavigate('users')} 
                      className={`w-full flex items-center gap-3 px-3.5 py-3 rounded-xl text-sm font-semibold transition-colors min-h-[44px] ${
                        activeView === 'users' ? 'bg-indigo-600 text-white shadow-xs' : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                      }`}
                    >
                      <Users className="w-5 h-5 shrink-0 text-indigo-400" />
                      <span>Gestión de Usuarios</span>
                    </button>
                  </li>
                </>
              )}
            </ul>
          </nav>

          {/* User Profile in Mobile Drawer */}
          <div className="p-3 border-t border-slate-800 bg-slate-950/60">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-9 h-9 shrink-0 rounded-full bg-indigo-600 text-white font-bold flex items-center justify-center text-xs uppercase shadow-xs">
                {user.username ? user.username.charAt(0) : user.displayName?.charAt(0) || 'U'}
              </div>
              <div className="flex flex-col overflow-hidden flex-1">
                <span className="text-white text-xs font-semibold truncate">
                  {user.displayName || user.username || user.email}
                </span>
                <span className="text-slate-400 text-[10px] truncate">
                  {user.username ? `@${user.username}` : user.email}
                </span>
                <span className="text-[10px] text-indigo-300 font-bold mt-0.5">
                  {isSuperAdmin ? 'Superadministrador Principal' : (user.cargo || 'Personal Institucional')}
                </span>
              </div>
            </div>

            <button
              type="button"
              onClick={() => {
                setIsMobileMenuOpen(false);
                setShowProfileModal(true);
              }}
              className="w-full mb-2 py-2.5 px-3 bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold rounded-xl transition-colors flex items-center justify-center gap-2 min-h-[40px] border border-slate-700"
            >
              <KeyRound className="w-4 h-4 text-indigo-400" />
              <span>Mi Perfil / Cambiar Clave</span>
            </button>

            <button
              onClick={handleLogout}
              className="w-full py-2.5 px-3 bg-red-600/90 hover:bg-red-700 text-white text-xs font-bold rounded-xl transition-colors flex items-center justify-center gap-2 min-h-[40px]"
            >
              <LogOut className="w-4 h-4" />
              <span>Cerrar Sesión</span>
            </button>
          </div>

          {/* Programmer credit in Mobile Drawer */}
          <div className="px-3 py-2 border-t border-slate-800/80 bg-slate-950 text-center">
            <p className="text-[10px] text-slate-400 leading-tight">
              Programada por
            </p>
            <p className="text-[11px] font-semibold text-indigo-300 truncate" title="Diego Alejandro Narváez Meza">
              Diego Alejandro Narváez Meza
            </p>
          </div>
        </aside>
      )}

      {/* Desktop Sidebar */}
      {user && (
        <aside className={`${isSidebarCollapsed ? 'w-20' : 'w-64'} bg-slate-900 border-r border-slate-800 flex flex-col justify-between shrink-0 transition-all duration-300 relative z-20 hidden lg:flex`}>
          <button
            onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
            className="absolute -right-3 top-6 bg-slate-800 border border-slate-700 text-slate-400 hover:text-white rounded-full p-1 shadow-md z-30 transition-transform active:scale-95"
            title={isSidebarCollapsed ? "Expandir menú" : "Colapsar menú"}
          >
            {isSidebarCollapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
          </button>

          <div>
            <div className={`p-4 border-b border-slate-800 flex items-center ${isSidebarCollapsed ? 'justify-center' : 'gap-3'}`}>
              <div className="w-10 h-10 bg-white rounded-xl flex shrink-0 items-center justify-center p-1 shadow-xs">
                <img src="/JUANI.png" alt="Logo Institución Educativa Juan Pablo I" className="w-full h-full object-contain" />
              </div>
              {!isSidebarCollapsed && (
                <div className="flex flex-col whitespace-nowrap overflow-hidden">
                  <span className="text-white font-bold text-sm tracking-tight">JUAN PABLO I</span>
                  <span className="text-slate-400 text-xs truncate">La Llanada (Nariño)</span>
                </div>
              )}
            </div>
            
            <nav className="p-4">
              <ul className="space-y-2">
                <li>
                  <button onClick={() => setActiveView('dashboard')} className={`w-full flex items-center ${isSidebarCollapsed ? 'justify-center' : 'gap-3'} px-3 py-3 ${activeView === 'dashboard' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:bg-slate-800 hover:text-white'} rounded-lg text-sm font-medium transition-colors`} title="Panel de Control">
                    <LayoutDashboard className="w-5 h-5 shrink-0" />
                    {!isSidebarCollapsed && <span>Panel de Control</span>}
                  </button>
                </li>
                {permissions.documents && (
                  <li>
                    <button onClick={() => setActiveView('documents')} className={`w-full flex items-center ${isSidebarCollapsed ? 'justify-center' : 'gap-3'} px-3 py-3 ${activeView === 'documents' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:bg-slate-800 hover:text-white'} rounded-lg text-sm font-medium transition-colors`} title="Documentos">
                      <Folder className="w-5 h-5 shrink-0" />
                      {!isSidebarCollapsed && <span>Documentos</span>}
                    </button>
                  </li>
                )}
                {permissions.attendance && (
                  <li>
                    <button onClick={() => setActiveView('attendance')} className={`w-full flex items-center ${isSidebarCollapsed ? 'justify-center' : 'gap-3'} px-3 py-3 ${activeView === 'attendance' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:bg-slate-800 hover:text-white'} rounded-lg text-sm font-medium transition-colors`} title="Asistencia Estudiantil">
                      <ClipboardCheck className="w-5 h-5 shrink-0" />
                      {!isSidebarCollapsed && <span>Asistencia Estudiantil</span>}
                    </button>
                  </li>
                )}

                {/* Permisos Académicos: Habilitado según permisos configurados */}
                {permissions.academicPermissions && (
                  <li>
                    <button onClick={() => setActiveView('academicPermissions')} className={`w-full flex items-center ${isSidebarCollapsed ? 'justify-center' : 'gap-3'} px-3 py-3 ${activeView === 'academicPermissions' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:bg-slate-800 hover:text-white'} rounded-lg text-sm font-medium transition-colors`} title="Permisos Académicos">
                      <FileCheck2 className="w-5 h-5 shrink-0 text-amber-300" />
                      {!isSidebarCollapsed && <span>Permisos Académicos</span>}
                    </button>
                  </li>
                )}

                {permissions.agenda && (
                  <li>
                    <button onClick={() => setActiveView('agenda')} className={`w-full flex items-center ${isSidebarCollapsed ? 'justify-center' : 'gap-3'} px-3 py-3 ${activeView === 'agenda' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:bg-slate-800 hover:text-white'} rounded-lg text-sm font-medium transition-colors`} title="Agenda Académica">
                      <Calendar className="w-5 h-5 shrink-0" />
                      {!isSidebarCollapsed && <span>Agenda Académica</span>}
                    </button>
                  </li>
                )}

                {/* Configuración Académica: Habilitado para Superadmin y usuarios creados */}
                {permissions.academicConfig && (
                  <li>
                    <button onClick={() => setActiveView('generator')} className={`w-full flex items-center ${isSidebarCollapsed ? 'justify-center' : 'gap-3'} px-3 py-3 ${activeView === 'generator' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:bg-slate-800 hover:text-white'} rounded-lg text-sm font-medium transition-colors`} title="Configuración Académica">
                      <GraduationCap className="w-5 h-5 shrink-0" />
                      {!isSidebarCollapsed && <span>Configuración Académica</span>}
                    </button>
                  </li>
                )}

                {/* Año Escolar: Habilitado para Superadmin y usuarios creados */}
                {permissions.schoolYear && (
                  <li>
                    <button onClick={() => setActiveView('schoolYear')} className={`w-full flex items-center ${isSidebarCollapsed ? 'justify-center' : 'gap-3'} px-3 py-3 ${activeView === 'schoolYear' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:bg-slate-800 hover:text-white'} rounded-lg text-sm font-medium transition-colors`} title="Año Escolar">
                      <CalendarRange className="w-5 h-5 shrink-0" />
                      {!isSidebarCollapsed && <span>Año Escolar</span>}
                    </button>
                  </li>
                )}

                {/* Gestión de Usuarios: Exclusivo Superadmin */}
                {permissions.manageUsers && (
                  <>
                    <li className="pt-3 pb-1">
                      {!isSidebarCollapsed && (
                        <span className="px-3 text-[10px] font-bold uppercase tracking-wider text-slate-500 block">
                          Administración
                        </span>
                      )}
                    </li>
                    <li>
                      <button onClick={() => setActiveView('users')} className={`w-full flex items-center ${isSidebarCollapsed ? 'justify-center' : 'gap-3'} px-3 py-3 ${activeView === 'users' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:bg-slate-800 hover:text-white'} rounded-lg text-sm font-medium transition-colors`} title="Gestión de Usuarios">
                        <Users className="w-5 h-5 shrink-0 text-indigo-400" />
                        {!isSidebarCollapsed && <span>Gestión de Usuarios</span>}
                      </button>
                    </li>
                  </>
                )}
              </ul>
            </nav>
          </div>
          
          <div>
            <div className="p-4 border-t border-slate-800">
              <div className={`flex items-center ${isSidebarCollapsed ? 'justify-center' : 'gap-3'}`}>
                <div className="w-10 h-10 shrink-0 rounded-full bg-indigo-600 text-white font-bold flex items-center justify-center text-xs uppercase shadow-xs">
                  {user.username ? user.username.charAt(0) : user.displayName?.charAt(0) || 'U'}
                </div>
                {!isSidebarCollapsed && (
                  <div className="flex flex-col overflow-hidden">
                    <span className="text-white text-xs font-semibold truncate">
                      {user.displayName || user.username || user.email}
                    </span>
                    <span className="text-slate-500 text-[10px] truncate">
                      {user.username ? `@${user.username}` : user.email}
                    </span>
                    <span className="text-[10px] text-indigo-300 font-bold mt-0.5">
                      {isSuperAdmin ? 'Superadministrador Principal' : (user.cargo || 'Personal Institucional')}
                    </span>
                  </div>
                )}
              </div>
              {!isSidebarCollapsed ? (
                <button
                  type="button"
                  onClick={() => setShowProfileModal(true)}
                  className="mt-3 w-full py-1.5 px-2 bg-slate-800 hover:bg-slate-700 text-indigo-300 hover:text-white text-[11px] font-bold rounded-lg transition-colors flex items-center justify-center gap-1.5 border border-slate-700/80 shadow-2xs"
                >
                  <KeyRound className="w-3.5 h-3.5" />
                  <span>Mi Perfil / Cambiar Clave</span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => setShowProfileModal(true)}
                  className="mt-2 w-full py-1.5 flex items-center justify-center text-indigo-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
                  title="Mi Perfil / Cambiar Contraseña"
                >
                  <KeyRound className="w-4 h-4" />
                </button>
              )}
            </div>

            {/* Nota en el menú principal */}
            <div className="px-3 py-2.5 border-t border-slate-800/80 bg-slate-950/50">
              {!isSidebarCollapsed ? (
                <div className="text-center">
                  <p className="text-[10px] text-slate-400 font-normal leading-tight">
                    Programada por
                  </p>
                  <p className="text-[11px] font-semibold text-indigo-300 truncate" title="Diego Alejandro Narváez Meza">
                    Diego Alejandro Narváez Meza
                  </p>
                </div>
              ) : (
                <div 
                  className="text-center text-[10px] text-indigo-400 font-bold cursor-help py-0.5"
                  title="Programada por Diego Alejandro Narváez Meza"
                >
                  DANM
                </div>
              )}
            </div>
          </div>
        </aside>
      )}

      <main className="flex-1 flex flex-col min-w-0 relative">
        <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-3 sm:px-6 z-10 shrink-0">
          <div className="flex items-center gap-2 sm:gap-3 min-w-0">
            {user && (
              <button 
                type="button"
                onClick={() => setIsMobileMenuOpen(true)}
                className="lg:hidden p-2 -ml-1 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-xl min-h-[44px] min-w-[44px] flex items-center justify-center shrink-0"
                aria-label="Abrir menú de navegación"
              >
                <Menu className="w-6 h-6" />
              </button>
            )}
            <h1 className="text-base sm:text-xl font-bold text-slate-800 truncate">
              {activeView === 'attendance' 
                ? 'Asistencia Estudiantil' 
                : activeView === 'academicPermissions' 
                ? 'Permisos Académicos Institucionales' 
                : activeView === 'schoolYear' 
                ? 'Año Escolar y Horarios' 
                : activeView === 'generator' 
                ? 'Configuración Académica' 
                : activeView === 'agenda' 
                ? 'Agenda Académica' 
                : activeView === 'documents' 
                ? 'Gestión de Documentos Institucionales' 
                : activeView === 'users'
                ? 'Gestión de Usuarios y Credenciales'
                : 'Panel de Control Institucional'}
            </h1>
          </div>
          <div className="flex items-center gap-2 sm:gap-3 shrink-0">
            {user && (
              <>
                <span className="hidden xl:inline-block text-xs text-slate-400 font-medium">
                  Programada por <strong className="text-slate-700 font-semibold">Diego Alejandro Narváez Meza</strong>
                </span>
                <button
                  type="button"
                  onClick={() => setShowProfileModal(true)}
                  className="px-2.5 sm:px-3 py-1.5 sm:py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold rounded-xl transition-all flex items-center gap-1.5 min-h-[38px] border border-slate-200 shadow-2xs hover:scale-102 active:scale-98"
                  title="Mi Perfil Institucional y Cambiar Contraseña"
                >
                  <UserIcon className="w-4 h-4 text-indigo-600 shrink-0" />
                  <span className="hidden sm:inline">Mi Perfil</span>
                </button>
                <button
                  onClick={handleLogout}
                  className="px-2.5 sm:px-3.5 py-1.5 sm:py-2 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold rounded-xl shadow-xs transition-all flex items-center gap-1.5 min-h-[38px] hover:scale-102 active:scale-98"
                  title="Cerrar Sesión"
                >
                  <LogOut className="w-4 h-4 shrink-0" />
                  <span className="hidden sm:inline">Salir</span>
                </button>
              </>
            )}
          </div>
        </header>

        <div className="flex-1 overflow-auto pb-16 lg:pb-0">
          {!user ? (
            /* Pantalla de Inicio de Sesión Institucional */
            <div className="h-full flex flex-col items-center justify-center p-4 sm:p-6 bg-slate-100 overflow-y-auto">
              <div className="bg-white p-5 sm:p-8 rounded-3xl shadow-sm border border-slate-200 max-w-md w-full space-y-5 my-auto">
                {/* Logo y Encabezado */}
                <div className="text-center space-y-2">
                  <div className="w-20 h-20 sm:w-24 sm:h-24 mx-auto p-1 bg-white rounded-2xl shadow-xs border border-slate-100 flex items-center justify-center">
                    <img 
                      src="/JUANI.png" 
                      alt="Logo Institución Educativa Juan Pablo I" 
                      className="w-full h-full object-contain" 
                    />
                  </div>
                  <div>
                    <h2 className="text-lg sm:text-xl font-black text-slate-900 leading-tight">
                      Institución Educativa Juan Pablo I
                    </h2>
                    <p className="text-xs text-slate-500 font-medium mt-0.5">
                      Municipio de La Llanada (Nariño) • Sistema de Gestión
                    </p>
                  </div>
                </div>

                {/* Error Banner */}
                {loginError && (
                  <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-xs font-medium flex items-center gap-2 animate-in fade-in duration-200">
                    <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
                    <span>{loginError}</span>
                  </div>
                )}

                {/* Formulario Principal: Ingreso con Usuario y Contraseña (Docentes y Personal) */}
                <form onSubmit={handleCredentialsLogin} className="space-y-3.5">
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                      <UserIcon className="w-3.5 h-3.5 text-indigo-600" />
                      <span>Usuario Asignado</span>
                    </label>
                    <input
                      type="text"
                      required
                      value={loginUsername}
                      onChange={(e) => setLoginUsername(e.target.value)}
                      placeholder="ej: docente1, prof_martha"
                      autoComplete="username"
                      className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-all"
                    />
                  </div>

                  <div className="space-y-1">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                        <Lock className="w-3.5 h-3.5 text-indigo-600" />
                        <span>Contraseña</span>
                      </label>
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="text-[11px] font-semibold text-indigo-600 hover:text-indigo-800 flex items-center gap-1"
                      >
                        {showPassword ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                        <span>{showPassword ? 'Ocultar' : 'Ver'}</span>
                      </button>
                    </div>
                    <input
                      type={showPassword ? "text" : "password"}
                      required
                      value={loginPassword}
                      onChange={(e) => setLoginPassword(e.target.value)}
                      placeholder="••••••••"
                      autoComplete="current-password"
                      className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-all"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={loginSubmitting}
                    className="w-full py-2.5 px-4 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs sm:text-sm rounded-xl transition-all shadow-xs hover:shadow-indigo-100 flex items-center justify-center gap-2 disabled:opacity-50 min-h-[44px]"
                  >
                    {loginSubmitting ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>Verificando credenciales...</span>
                      </>
                    ) : (
                      <>
                        <LogIn className="w-4 h-4" />
                        <span>Iniciar Sesión en el Sistema</span>
                      </>
                    )}
                  </button>
                </form>

                {/* Separador */}
                <div className="relative flex items-center justify-center">
                  <div className="border-t border-slate-200 w-full"></div>
                  <span className="bg-white px-3 text-[11px] font-bold uppercase tracking-wider text-slate-400 shrink-0">
                    o Acceso de Rectoría
                  </span>
                </div>

                {/* Botón Google: Exclusivo Rectoría / Administrador Principal */}
                <div className="space-y-1.5">
                  <button
                    type="button"
                    onClick={handleGoogleAdminLogin}
                    disabled={loginSubmitting}
                    className="w-full flex items-center justify-center space-x-3 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 font-semibold py-2.5 px-4 rounded-xl transition-all duration-200 shadow-2xs min-h-[44px]"
                  >
                    <svg className="w-5 h-5 shrink-0" viewBox="0 0 24 24">
                      <path
                        fill="currentColor"
                        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                      />
                      <path
                        fill="#34A853"
                        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                      />
                      <path
                        fill="#FBBC05"
                        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                      />
                      <path
                        fill="#EA4335"
                        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                      />
                    </svg>
                    <span className="text-xs sm:text-sm font-bold text-slate-800">
                      Ingresar como Administrador (Google)
                    </span>
                  </button>
                  <p className="text-[10px] text-slate-400 text-center">
                    Exclusivo para la cuenta de Rectoría: <span className="font-mono text-slate-600">diegoalejandro.narvaezmeza95@gmail.com</span> o <span className="font-mono text-slate-600">quino1981@gmail.com</span>
                  </p>
                </div>

                {/* Créditos institucionales */}
                <div className="pt-3 border-t border-slate-100 text-center">
                  <p className="text-xs text-slate-500 font-medium">
                    Programada por <span className="font-bold text-indigo-700">Diego Alejandro Narváez Meza</span>
                  </p>
                </div>
              </div>

              {/* Nota complementaria al pie del login */}
              <p className="mt-4 text-xs text-slate-400 font-medium text-center">
                Institución Educativa Juan Pablo I • La Llanada, Nariño
              </p>
            </div>
          ) : !isAuthorized ? (
            /* Pantalla de advertencia si la cuenta Google no es la del Administrador */
            <div className="h-full flex flex-col items-center justify-center p-6 bg-slate-100">
              <div className="bg-white p-6 sm:p-8 rounded-2xl shadow-sm border border-slate-200 max-w-md w-full text-center space-y-4">
                <div className="w-16 h-16 bg-amber-50 text-amber-600 rounded-2xl flex items-center justify-center mx-auto shadow-2xs">
                  <ShieldAlert className="w-9 h-9" />
                </div>
                <div>
                  <h2 className="text-lg font-black text-slate-900 leading-tight">
                    Acceso con Google Exclusivo para Rectoría
                  </h2>
                  <p className="text-xs text-slate-600 mt-2 leading-relaxed">
                    Has iniciado sesión con <strong className="text-slate-900">{user.email}</strong>. El acceso mediante Google está reservado exclusivamente para la Rectoría y los Administradores Principales autorizados (<span className="text-indigo-600 font-bold">diegoalejandro.narvaezmeza95@gmail.com</span> y <span className="text-indigo-600 font-bold">quino1981@gmail.com</span>).
                  </p>
                  <p className="text-[11px] text-slate-500 mt-3 bg-slate-50 p-3 rounded-xl border border-slate-200 text-left">
                    <strong>¿Eres Docente o Personal Institucional?</strong><br/>
                    Por favor cierra sesión e ingresa usando tu <strong>Nombre de Usuario y Contraseña</strong> asignados por la administración del colegio.
                  </p>
                </div>
                <button
                  onClick={handleLogout}
                  className="w-full py-2.5 px-4 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl transition-colors shadow-xs"
                >
                  Volver al Inicio de Sesión
                </button>
              </div>
            </div>
          ) : (
            <Dashboard 
              user={user} 
              activeView={activeView} 
              onNavigateView={(v) => handleNavigate(v)}
              isAuthorized={isAuthorized}
              permissions={permissions}
            />
          )}
        </div>

        {/* Mobile Bottom Navigation Bar (Barra inferior móvil estilo APK) */}
        {user && isAuthorized && (
          <nav 
            className="lg:hidden fixed bottom-0 left-0 right-0 z-30 bg-white/95 backdrop-blur-md border-t border-slate-200 px-2 py-1.5 flex items-center justify-around shadow-lg"
            aria-label="Navegación móvil"
          >
            <button
              type="button"
              onClick={() => handleNavigate('dashboard')}
              className={`flex flex-col items-center justify-center py-1 px-2 min-h-[44px] min-w-[50px] rounded-xl transition-colors ${
                activeView === 'dashboard' ? 'text-indigo-600 font-bold' : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              <LayoutDashboard className="w-5 h-5" />
              <span className="text-[10px] mt-0.5">Panel</span>
            </button>
            <button
              type="button"
              onClick={() => handleNavigate('documents')}
              className={`flex flex-col items-center justify-center py-1 px-2 min-h-[44px] min-w-[50px] rounded-xl transition-colors ${
                activeView === 'documents' ? 'text-indigo-600 font-bold' : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              <Folder className="w-5 h-5" />
              <span className="text-[10px] mt-0.5">Docs</span>
            </button>
            <button
              type="button"
              onClick={() => handleNavigate('attendance')}
              className={`flex flex-col items-center justify-center py-1 px-2 min-h-[44px] min-w-[50px] rounded-xl transition-colors ${
                activeView === 'attendance' ? 'text-indigo-600 font-bold' : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              <ClipboardCheck className="w-5 h-5" />
              <span className="text-[10px] mt-0.5">Asistencia</span>
            </button>

            {/* Pestaña 4: Permisos si es superadmin; si es usuario limitado, acceso directo a Agenda */}
            {permissions.academicPermissions ? (
              <button
                type="button"
                onClick={() => handleNavigate('academicPermissions')}
                className={`flex flex-col items-center justify-center py-1 px-2 min-h-[44px] min-w-[50px] rounded-xl transition-colors ${
                  activeView === 'academicPermissions' ? 'text-indigo-600 font-bold' : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                <FileCheck2 className="w-5 h-5" />
                <span className="text-[10px] mt-0.5">Permisos</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={() => handleNavigate('agenda')}
                className={`flex flex-col items-center justify-center py-1 px-2 min-h-[44px] min-w-[50px] rounded-xl transition-colors ${
                  activeView === 'agenda' ? 'text-indigo-600 font-bold' : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                <Calendar className="w-5 h-5" />
                <span className="text-[10px] mt-0.5">Agenda</span>
              </button>
            )}

            <button
              type="button"
              onClick={() => setIsMobileMenuOpen(true)}
              className={`flex flex-col items-center justify-center py-1 px-2 min-h-[44px] min-w-[50px] rounded-xl transition-colors ${
                isMobileMenuOpen ? 'text-indigo-600 font-bold' : 'text-slate-500 hover:text-slate-800'
              }`}
              title="Más opciones de menú"
            >
              <Menu className="w-5 h-5" />
              <span className="text-[10px] mt-0.5">Más</span>
            </button>
          </nav>
        )}

        {/* Modal de Mi Perfil y Cambio de Contraseña */}
        {user && (
          <UserProfileModal
            isOpen={showProfileModal}
            onClose={() => setShowProfileModal(false)}
            user={user}
            permissions={permissions}
          />
        )}
      </main>
    </div>
  );
}
