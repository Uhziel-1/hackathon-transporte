// dashboard_web/src/lib/firestoreClient.ts
import * as admin from 'firebase-admin';

// Initializes Firebase Admin and returns the Firestore client.
// Intentionally idempotent.
export function initFirestore() {
  try {
    const serviceAccountKey = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
    if (!serviceAccountKey) {
      console.error('[firestoreClient] FIREBASE_SERVICE_ACCOUNT_KEY not set');
      return null;
    }
    const serviceAccount = JSON.parse(serviceAccountKey);
    if (!admin.apps.length) {
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
      });
      console.log('[firestoreClient] Firebase Admin initialized');
    }
    return admin.firestore();
  } catch (err) {
    console.error('[firestoreClient] Error initializing Firebase Admin:', err);
    return null;
  }
}
