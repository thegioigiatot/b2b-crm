import "server-only";
import { cert, getApps, initializeApp, type App } from "firebase-admin/app";
import { getAuth, type Auth } from "firebase-admin/auth";

// Firebase Admin chỉ khởi tạo khi có đủ biến môi trường service account.
// Thiếu -> trả null và app rơi về "đăng nhập demo" (chỉ ngoài production).
export const firebaseConfigured =
  !!process.env.FIREBASE_PROJECT_ID &&
  !!process.env.FIREBASE_CLIENT_EMAIL &&
  !!process.env.FIREBASE_PRIVATE_KEY;

let cached: { app: App; auth: Auth } | null = null;

export function firebaseAdmin() {
  if (!firebaseConfigured) return null;
  if (cached) return cached;
  const app =
    getApps()[0] ??
    initializeApp({
      credential: cert({
        projectId: process.env.FIREBASE_PROJECT_ID,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        privateKey: process.env.FIREBASE_PRIVATE_KEY!.replace(/\\n/g, "\n"),
      }),
    });
  cached = { app, auth: getAuth(app) };
  return cached;
}
