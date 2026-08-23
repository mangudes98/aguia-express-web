// ============================================================
// ARQUIVO: src/services/firebase.ts
// FUNÇÃO: Configuração central do Firebase.
// UTILIZA:
// - Firebase Authentication
// - Cloud Firestore
// ============================================================

import { initializeApp } from 'firebase/app'

import {
  getAuth,
} from 'firebase/auth'

import {
  getFirestore,
} from 'firebase/firestore'


// ============================================================
// CONFIGURAÇÃO DO FIREBASE
// Os valores são carregados do arquivo .env.local
// ============================================================

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,

  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,

  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,

  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,

  messagingSenderId:
    import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,

  appId: import.meta.env.VITE_FIREBASE_APP_ID,
}


// ============================================================
// INICIALIZAÇÃO
// ============================================================

const app = initializeApp(firebaseConfig)


// ============================================================
// AUTHENTICATION
// ============================================================

export const auth = getAuth(app)


// ============================================================
// FIRESTORE
// ============================================================

export const db = getFirestore(app)


// ============================================================
// EXPORTAÇÃO DO APP
// ============================================================

export default app