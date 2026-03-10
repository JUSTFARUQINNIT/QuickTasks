import { initializeApp, cert } from 'firebase-admin/app'
import { getAuth } from 'firebase-admin/auth'
import { getFirestore } from 'firebase-admin/firestore'

const serviceAccountJson = process.env.FIREBASE_SERVICE_ACCOUNT

if (!serviceAccountJson) {
  throw new Error('FIREBASE_SERVICE_ACCOUNT env var is required for Firebase Admin')
}

const app = initializeApp({
  credential: cert(JSON.parse(serviceAccountJson)),
})

export const adminAuth = getAuth(app)
export const adminDb = getFirestore(app)