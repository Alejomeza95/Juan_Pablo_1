import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";
import { initializeFirestore } from "firebase/firestore";
import { getAnalytics } from "firebase/analytics";

const firebaseConfig = {
  apiKey: "AIzaSyBNQ57qVXsA0tBNsie2BM_lgjIpomrbTQo",
  authDomain: "juan-pablo-1-a4d13.firebaseapp.com",
  projectId: "juan-pablo-1-a4d13",
  storageBucket: "juan-pablo-1-a4d13.firebasestorage.app",
  messagingSenderId: "745953673391",
  appId: "1:745953673391:web:c683ecb32787c7b86cd45a",
  measurementId: "G-XHWMTKLSMP"
};

export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
// Use experimentalForceLongPolling to ensure reliable connectivity inside sandboxed iframes & web proxies
export const db = initializeFirestore(app, {
  experimentalForceLongPolling: true,
});
export const googleProvider = new GoogleAuthProvider();

// Initialize analytics only in browser environments if needed
export const analytics = typeof window !== "undefined" ? getAnalytics(app) : null;

export const ADMIN_EMAIL = "diegoalejandro.narvaezmeza95@gmail.com";
export const SECONDARY_ADMIN_EMAIL = "quino1981@gmail.com";
export const SUPERADMIN_EMAILS = [
  "diegoalejandro.narvaezmeza95@gmail.com",
  "quino1981@gmail.com"
];

export function isSuperAdminEmail(email?: string | null): boolean {
  if (!email) return false;
  const clean = email.trim().toLowerCase();
  return SUPERADMIN_EMAILS.some(admin => admin.toLowerCase() === clean);
}

