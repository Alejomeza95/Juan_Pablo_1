import { 
  collection, 
  doc, 
  setDoc, 
  deleteDoc, 
  updateDoc,
  onSnapshot, 
  query, 
  orderBy,
  getDocs,
  getDoc
} from "firebase/firestore";
import { db, ADMIN_EMAIL, isSuperAdminEmail, SUPERADMIN_EMAILS } from "../firebase";
import { SystemUserRecord, SystemUserPermissions, AppSessionUser } from "../types";

export const AUTHORIZED_USERS_COLLECTION = "authorizedUsers";
const USERS_CACHE_KEY = "juanpablo_system_users_cache";
const CUSTOM_SESSION_KEY = "juanpablo_custom_session";

/**
 * Normaliza un nombre de usuario para ser usado como Document ID seguro en Firestore
 */
export function normalizeUsernameDocId(username: string): string {
  return username.trim().toLowerCase().replace(/[^a-zA-Z0-9_.-]/g, '_');
}

/**
 * Compatibilidad con identificadores por correo
 */
export function normalizeEmailDocId(email: string): string {
  return normalizeUsernameDocId(email);
}

/**
 * Permisos predeterminados para usuarios creados (Personal y Docentes):
 * - Acceso TOTAL a: Documentos, Asistencia Estudiantil, Agenda Académica, Configuración Académica, Año Escolar.
 * - SIN ACCESO a: Permisos Académicos y Gestión de Usuarios.
 */
export const DEFAULT_LIMITED_PERMISSIONS: SystemUserPermissions = {
  documents: true,
  attendance: true,
  agenda: true,
  academicConfig: true,
  schoolYear: true,
  academicPermissions: false, // ESTRICTAMENTE RESTRINGIDO
  absenteeismDashboard: true, // Dashboard de Ausentismo en Panel de Control
  manageUsers: false          // ESTRICTAMENTE RESTRINGIDO (Solo Admin Principal)
};

/**
 * Permisos completos del Superadministrador Principal
 */
export const SUPERADMIN_PERMISSIONS: SystemUserPermissions = {
  documents: true,
  attendance: true,
  agenda: true,
  academicConfig: true,
  schoolYear: true,
  academicPermissions: true,
  absenteeismDashboard: true,
  manageUsers: true
};

/**
 * Manejo de caché local de usuarios para autenticación instantánea y confiabilidad
 */
function getCachedUsers(): SystemUserRecord[] {
  try {
    const raw = localStorage.getItem(USERS_CACHE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function setCachedUsers(users: SystemUserRecord[]) {
  try {
    localStorage.setItem(USERS_CACHE_KEY, JSON.stringify(users));
  } catch (e) {
    console.warn("No se pudo guardar la caché de usuarios:", e);
  }
}

/**
 * Manejo de la sesión activa de usuario/contraseña
 */
export function getStoredCustomSession(): AppSessionUser | null {
  try {
    const raw = localStorage.getItem(CUSTOM_SESSION_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function setStoredCustomSession(user: AppSessionUser): void {
  try {
    localStorage.setItem(CUSTOM_SESSION_KEY, JSON.stringify(user));
  } catch (e) {
    console.warn("No se pudo guardar la sesión local:", e);
  }
}

export function clearStoredCustomSession(): void {
  try {
    localStorage.removeItem(CUSTOM_SESSION_KEY);
  } catch (e) {
    console.warn("No se pudo limpiar la sesión local:", e);
  }
}

/**
 * Suscribe en tiempo real a la lista de usuarios autorizados
 */
export function subscribeToSystemUsers(
  onUpdate: (users: SystemUserRecord[]) => void,
  onError?: (err: any) => void
) {
  const usersRef = collection(db, AUTHORIZED_USERS_COLLECTION);
  const q = query(usersRef, orderBy("createdAt", "desc"));

  return onSnapshot(
    q,
    (snapshot) => {
      const users: SystemUserRecord[] = [];
      snapshot.forEach((docSnap) => {
        const data = docSnap.data();
        users.push({
          id: docSnap.id,
          username: data.username || docSnap.id,
          password: data.password || "",
          fullName: data.fullName || data.username || "Usuario",
          cargo: data.cargo || "Docente / Colaborador",
          email: data.email || `${data.username || docSnap.id}@juanpablo.edu.co`,
          role: data.role || 'usuario_limitado',
          status: data.status || 'activo',
          permissions: {
            documents: data.permissions?.documents ?? true,
            attendance: data.permissions?.attendance ?? true,
            agenda: data.permissions?.agenda ?? true,
            academicConfig: data.permissions?.academicConfig ?? true,
            schoolYear: data.permissions?.schoolYear ?? true,
            academicPermissions: data.permissions?.academicPermissions ?? false,
            absenteeismDashboard: data.permissions?.absenteeismDashboard ?? true,
            manageUsers: false
          },
          createdAt: data.createdAt || Date.now(),
          createdBy: data.createdBy || "Administrador",
          updatedAt: data.updatedAt || Date.now(),
          updatedBy: data.updatedBy,
          notas: data.notas || ""
        });
      });
      setCachedUsers(users);
      onUpdate(users);
    },
    (error) => {
      console.warn("Aviso al consultar usuarios en Firestore (usando caché local):", error);
      const cached = getCachedUsers();
      if (cached.length > 0) {
        onUpdate(cached);
      }
      if (onError) onError(error);
    }
  );
}

/**
 * Obtiene la lista de usuarios una sola vez
 */
export async function getSystemUsersOnce(): Promise<SystemUserRecord[]> {
  try {
    const snap = await getDocs(collection(db, AUTHORIZED_USERS_COLLECTION));
    const users: SystemUserRecord[] = [];
    snap.forEach((docSnap) => {
      const data = docSnap.data();
      users.push({
        id: docSnap.id,
        username: data.username || docSnap.id,
        password: data.password || "",
        fullName: data.fullName || data.username || "Usuario",
        cargo: data.cargo || "Docente / Colaborador",
        email: data.email || `${data.username || docSnap.id}@juanpablo.edu.co`,
        role: data.role || 'usuario_limitado',
        status: data.status || 'activo',
        permissions: {
          documents: data.permissions?.documents ?? true,
          attendance: data.permissions?.attendance ?? true,
          agenda: data.permissions?.agenda ?? true,
          academicConfig: data.permissions?.academicConfig ?? true,
          schoolYear: data.permissions?.schoolYear ?? true,
          academicPermissions: data.permissions?.academicPermissions ?? false,
          absenteeismDashboard: data.permissions?.absenteeismDashboard ?? true,
          manageUsers: false
        },
        createdAt: data.createdAt || Date.now(),
        createdBy: data.createdBy || "Administrador",
        updatedAt: data.updatedAt || Date.now(),
        notas: data.notas || ""
      });
    });
    setCachedUsers(users);
    return users;
  } catch (err) {
    console.warn("Error leyendo usuarios en Firestore, recurriendo a caché:", err);
    return getCachedUsers();
  }
}

/**
 * Crea o actualiza un usuario con Nombre de Usuario, Contraseña y Permisos Seleccionados
 */
export async function saveSystemUser(
  user: {
    username: string;
    password: string;
    fullName: string;
    cargo: string;
    status: 'activo' | 'inactivo';
    email?: string;
    notas?: string;
    permissions?: Partial<SystemUserPermissions>;
  },
  currentUserIdentifier: string
): Promise<SystemUserRecord> {
  const cleanUsername = user.username.trim().toLowerCase();
  const cleanPassword = user.password.trim();

  if (!cleanUsername || cleanUsername.length < 3) {
    throw new Error("El nombre de usuario debe tener al menos 3 caracteres.");
  }

  if (!/^[a-zA-Z0-9_.-]+$/.test(cleanUsername)) {
    throw new Error("El usuario solo puede contener letras, números, puntos (.), guiones (-) o guiones bajos (_), sin espacios.");
  }

  if (!cleanPassword || cleanPassword.length < 4) {
    throw new Error("La contraseña debe tener al menos 4 caracteres.");
  }

  if (cleanUsername === 'admin' || cleanUsername === normalizeUsernameDocId(ADMIN_EMAIL)) {
    throw new Error("El nombre de usuario reservado no está disponible.");
  }

  const docId = normalizeUsernameDocId(cleanUsername);
  const now = Date.now();

  const userRecord: SystemUserRecord = {
    id: docId,
    username: cleanUsername,
    password: cleanPassword,
    fullName: user.fullName.trim() || cleanUsername,
    cargo: user.cargo.trim() || "Docente / Personal Institucional",
    email: user.email?.trim().toLowerCase() || `${cleanUsername}@juanpablo.edu.co`,
    role: 'usuario_limitado',
    status: user.status,
    permissions: {
      documents: user.permissions?.documents ?? true,
      attendance: user.permissions?.attendance ?? true,
      agenda: user.permissions?.agenda ?? true,
      academicConfig: user.permissions?.academicConfig ?? true,
      schoolYear: user.permissions?.schoolYear ?? true,
      academicPermissions: user.permissions?.academicPermissions ?? false,
      absenteeismDashboard: user.permissions?.absenteeismDashboard ?? true,
      manageUsers: false
    },
    createdAt: now,
    createdBy: currentUserIdentifier || ADMIN_EMAIL,
    updatedAt: now,
    updatedBy: currentUserIdentifier || ADMIN_EMAIL,
    notas: user.notas?.trim() || ""
  };

  // Guardar en Firestore
  const userRef = doc(db, AUTHORIZED_USERS_COLLECTION, docId);
  await setDoc(userRef, userRecord, { merge: true });

  // Actualizar caché local
  const currentCached = getCachedUsers().filter(u => u.id !== docId);
  currentCached.unshift(userRecord);
  setCachedUsers(currentCached);

  return userRecord;
}

/**
 * Autentica un usuario con Usuario y Contraseña
 */
export async function authenticateUserByCredentials(
  usernameInput: string,
  passwordInput: string
): Promise<{ success: boolean; user?: SystemUserRecord; error?: string }> {
  const cleanUser = usernameInput.trim().toLowerCase();
  const cleanPass = passwordInput.trim();

  if (!cleanUser || !cleanPass) {
    return { success: false, error: "Por favor ingresa tanto el usuario como la contraseña." };
  }

  const docId = normalizeUsernameDocId(cleanUser);

  // 1. Intentar validar vía Firestore
  try {
    const docRef = doc(db, AUTHORIZED_USERS_COLLECTION, docId);
    const snap = await getDoc(docRef);

    if (snap.exists()) {
      const data = snap.data();
      const userRecord: SystemUserRecord = {
        id: snap.id,
        username: data.username || snap.id,
        password: data.password || "",
        fullName: data.fullName || data.username || "Usuario",
        cargo: data.cargo || "Docente / Colaborador",
        email: data.email || `${cleanUser}@juanpablo.edu.co`,
        role: data.role || 'usuario_limitado',
        status: data.status || 'activo',
        permissions: {
          documents: data.permissions?.documents ?? true,
          attendance: data.permissions?.attendance ?? true,
          agenda: data.permissions?.agenda ?? true,
          academicConfig: data.permissions?.academicConfig ?? true,
          schoolYear: data.permissions?.schoolYear ?? true,
          academicPermissions: data.permissions?.academicPermissions ?? false,
          absenteeismDashboard: data.permissions?.absenteeismDashboard ?? true,
          manageUsers: false
        },
        createdAt: data.createdAt || Date.now(),
        createdBy: data.createdBy || "Administrador",
        updatedAt: data.updatedAt || Date.now(),
        notas: data.notas || ""
      };

      if (userRecord.status !== 'activo') {
        return { 
          success: false, 
          error: "Este usuario se encuentra inactivo. Comunícate con la Rectoría o Administrador del sistema para reactivarlo." 
        };
      }

      if (userRecord.password !== cleanPass) {
        return { 
          success: false, 
          error: "Contraseña incorrecta. Verifica las mayúsculas y minúsculas o consulta al administrador." 
        };
      }

      return { success: true, user: userRecord };
    }
  } catch (err) {
    console.warn("Fallo temporal consultando Firestore para login, verificando caché local:", err);
  }

  // 2. Fallback a caché local (offline / modo resiliente)
  const cachedUsers = getCachedUsers();
  const matched = cachedUsers.find(
    (u) => u.username.toLowerCase() === cleanUser || u.id === docId
  );

  if (!matched) {
    return { 
      success: false, 
      error: "El usuario ingresado no existe en el sistema. Solicita a la Rectoría que cree tu usuario." 
    };
  }

  if (matched.status !== 'activo') {
    return { 
      success: false, 
      error: "Este usuario se encuentra inactivo. Comunícate con la Rectoría o Administrador del sistema." 
    };
  }

  if (matched.password !== cleanPass) {
    return { 
      success: false, 
      error: "Contraseña incorrecta. Verifica e intenta nuevamente." 
    };
  }

  return { success: true, user: matched };
}

/**
 * Actualiza el estado (activo/inactivo) de un usuario
 */
export async function updateSystemUserStatus(
  userId: string,
  newStatus: 'activo' | 'inactivo',
  currentUserIdentifier: string
): Promise<void> {
  const userRef = doc(db, AUTHORIZED_USERS_COLLECTION, userId);
  await setDoc(userRef, {
    status: newStatus,
    updatedAt: Date.now(),
    updatedBy: currentUserIdentifier
  }, { merge: true });

  const cached = getCachedUsers().map(u => u.id === userId ? { ...u, status: newStatus } : u);
  setCachedUsers(cached);
}

/**
 * Elimina un usuario de la base de datos
 */
export async function deleteSystemUser(userId: string): Promise<void> {
  const userRef = doc(db, AUTHORIZED_USERS_COLLECTION, userId);
  await deleteDoc(userRef);

  const cached = getCachedUsers().filter(u => u.id !== userId);
  setCachedUsers(cached);
}

/**
 * Permite a un usuario autenticado cambiar su contraseña desde su perfil
 */
export async function changeUserPassword(
  usernameOrId: string,
  currentPasswordInput: string,
  newPasswordInput: string
): Promise<{ success: boolean; error?: string }> {
  const cleanTarget = usernameOrId.trim().toLowerCase();
  const cleanCurrent = currentPasswordInput.trim();
  const cleanNew = newPasswordInput.trim();

  if (!cleanCurrent) {
    return { success: false, error: "Debes ingresar tu contraseña actual." };
  }

  if (!cleanNew || cleanNew.length < 4) {
    return { success: false, error: "La nueva contraseña debe tener mínimo 4 caracteres." };
  }

  if (cleanCurrent === cleanNew) {
    return { success: false, error: "La nueva contraseña no puede ser idéntica a la anterior." };
  }

  const docId = normalizeUsernameDocId(cleanTarget);

  // 1. Obtener registro de usuario actual
  let userRecord: SystemUserRecord | null = null;
  try {
    const userDocRef = doc(db, AUTHORIZED_USERS_COLLECTION, docId);
    const snap = await getDoc(userDocRef);
    if (snap.exists()) {
      const data = snap.data();
      userRecord = {
        id: snap.id,
        username: data.username || snap.id,
        password: data.password || "",
        fullName: data.fullName || data.username || "Usuario",
        cargo: data.cargo || "Docente / Colaborador",
        email: data.email || `${cleanTarget}@juanpablo.edu.co`,
        role: data.role || 'usuario_limitado',
        status: data.status || 'activo',
        permissions: data.permissions || DEFAULT_LIMITED_PERMISSIONS,
        createdAt: data.createdAt || Date.now(),
        createdBy: data.createdBy || "Administrador",
        updatedAt: data.updatedAt || Date.now(),
        notas: data.notas || ""
      };
    }
  } catch (e) {
    console.warn("Fallo temporal consultando Firestore para cambio de clave:", e);
  }

  // Fallback a caché local si Firestore no responde
  if (!userRecord) {
    const cached = getCachedUsers().find(u => u.id === docId || u.username.toLowerCase() === cleanTarget);
    if (cached) userRecord = cached;
  }

  if (!userRecord) {
    return { success: false, error: "No se encontró el registro de tu usuario en el sistema." };
  }

  if (userRecord.password !== cleanCurrent) {
    return { success: false, error: "La contraseña actual no es correcta. Verifica e intenta nuevamente." };
  }

  // 2. Actualizar contraseña en Firestore
  try {
    const userDocRef = doc(db, AUTHORIZED_USERS_COLLECTION, docId);
    await updateDoc(userDocRef, {
      password: cleanNew,
      updatedAt: Date.now(),
      updatedBy: userRecord.username
    });
  } catch (err: any) {
    console.warn("Aviso al guardar nueva contraseña en Firestore:", err);
  }

  // 3. Actualizar caché local
  const cachedUsers = getCachedUsers().map(u => {
    if (u.id === docId || u.username.toLowerCase() === cleanTarget) {
      return { ...u, password: cleanNew, updatedAt: Date.now() };
    }
    return u;
  });
  setCachedUsers(cachedUsers);

  return { success: true };
}

/**
 * Verifica el perfil y permisos efectivos de cualquier usuario conectado en el sistema
 */
export function evaluateUserPermissions(
  sessionUser: AppSessionUser | { email?: string | null; username?: string; isCustomAuth?: boolean } | null | undefined,
  systemUsers: SystemUserRecord[]
) {
  if (!sessionUser) {
    return {
      isSuperAdmin: false,
      isLimitedUser: false,
      isAuthorized: false,
      userRecord: null,
      permissions: {
        documents: false,
        attendance: false,
        agenda: false,
        academicConfig: false,
        schoolYear: false,
        academicPermissions: false,
        absenteeismDashboard: false,
        manageUsers: false
      }
    };
  }

  // 1. Superadministrador: Autenticado exclusivamente con Google mediante correos de Rectoría autorizados
  const isGoogleSuperAdmin = 
    !sessionUser.isCustomAuth && 
    Boolean(sessionUser.email) && 
    isSuperAdminEmail(sessionUser.email);

  if (isGoogleSuperAdmin) {
    const emailLower = sessionUser.email!.toLowerCase();
    const adminFullName = emailLower === 'quino1981@gmail.com'
      ? "Administrador Rectoría (quino1981@gmail.com)"
      : "Diego Alejandro Narváez Meza (Administrador Principal)";

    return {
      isSuperAdmin: true,
      isLimitedUser: false,
      isAuthorized: true,
      userRecord: {
        id: emailLower === 'quino1981@gmail.com' ? "superadmin_quino" : "superadmin",
        username: emailLower === 'quino1981@gmail.com' ? "admin_quino" : "admin_rectoria",
        password: "••••••••",
        email: sessionUser.email,
        fullName: adminFullName,
        cargo: "Administrador General del Sistema",
        role: 'superadmin' as const,
        status: 'activo' as const,
        permissions: SUPERADMIN_PERMISSIONS,
        createdAt: 0,
        createdBy: "Sistema",
        updatedAt: Date.now()
      },
      permissions: SUPERADMIN_PERMISSIONS
    };
  }

  // 2. Si ingresó con Google pero NO es el correo de Admin, rechazar Google
  if (!sessionUser.isCustomAuth && sessionUser.email) {
    return {
      isSuperAdmin: false,
      isLimitedUser: false,
      isAuthorized: false,
      userRecord: null,
      permissions: {
        documents: false,
        attendance: false,
        agenda: false,
        academicConfig: false,
        schoolYear: false,
        academicPermissions: false,
        absenteeismDashboard: false,
        manageUsers: false
      }
    };
  }

  // 3. Usuario autenticado con Usuario y Contraseña (Personal y Docentes)
  const targetUsername = sessionUser.username?.trim().toLowerCase() || normalizeUsernameDocId(sessionUser.email || '');

  // Buscar en la lista de usuarios
  let matchedUser = systemUsers.find(
    (u) => u.username.trim().toLowerCase() === targetUsername || u.id === targetUsername
  );

  // Si no está en Firestore sincrónico, buscar en la caché local
  if (!matchedUser) {
    const cached = getCachedUsers();
    matchedUser = cached.find(
      (u) => u.username.trim().toLowerCase() === targetUsername || u.id === targetUsername
    );
  }

  const isLimitedUser = Boolean(matchedUser && matchedUser.status === 'activo');

  if (isLimitedUser && matchedUser) {
    const p = matchedUser.permissions || DEFAULT_LIMITED_PERMISSIONS;
    return {
      isSuperAdmin: false,
      isLimitedUser: true,
      isAuthorized: true,
      userRecord: matchedUser,
      permissions: {
        documents: p.documents ?? true,
        attendance: p.attendance ?? true,
        agenda: p.agenda ?? true,
        academicConfig: p.academicConfig ?? true,
        schoolYear: p.schoolYear ?? true,
        academicPermissions: p.academicPermissions ?? false,
        absenteeismDashboard: p.absenteeismDashboard ?? true,
        manageUsers: false
      }
    };
  }

  // Usuario no autorizado o inactivo
  return {
    isSuperAdmin: false,
    isLimitedUser: false,
    isAuthorized: false,
    userRecord: null,
    permissions: {
      documents: false,
      attendance: false,
      agenda: false,
      academicConfig: false,
      schoolYear: false,
      academicPermissions: false,
      absenteeismDashboard: false,
      manageUsers: false
    }
  };
}

/**
 * Importación masiva de usuarios desde Excel a la base de datos
 */
export async function saveBatchSystemUsers(
  usersToImport: Array<{
    username: string;
    password: string;
    fullName?: string;
    cargo?: string;
    status?: 'activo' | 'inactivo';
    permissions: SystemUserPermissions;
  }>,
  currentUserIdentifier: string
): Promise<{ successCount: number; errors: string[] }> {
  let successCount = 0;
  const errors: string[] = [];

  for (let i = 0; i < usersToImport.length; i++) {
    const row = usersToImport[i];
    try {
      await saveSystemUser(
        {
          username: row.username,
          password: row.password,
          fullName: row.fullName || row.username,
          cargo: row.cargo || 'Docente de Área',
          status: row.status || 'activo',
          email: `${row.username.toLowerCase()}@juanpablo.edu.co`,
          permissions: row.permissions
        },
        currentUserIdentifier
      );
      successCount++;
    } catch (err: any) {
      errors.push(`Fila ${i + 2} (${row.username}): ${err.message || 'Error al guardar'}`);
    }
  }

  return { successCount, errors };
}
