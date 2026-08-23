// ============================================================
// ARQUIVO: src/services/authService.ts
// FUNÇÃO: Comunicação com Firebase Authentication.
// RESPONSÁVEL POR:
// - Login
// - Logout
// - Leitura do usuário autenticado
// ============================================================

import {
  signInWithEmailAndPassword,
  signOut,
  User,
} from 'firebase/auth'

import {
  auth,
} from './firebase/firebase'


// ============================================================
// LOGIN
// ============================================================

export async function fazerLogin(
  email: string,
  senha: string
): Promise<User> {

  const resultado =
    await signInWithEmailAndPassword(
      auth,
      email,
      senha
    )

  return resultado.user
}


// ============================================================
// LOGOUT
// ============================================================

export async function fazerLogout(): Promise<void> {

  await signOut(auth)
}


// ============================================================
// USUÁRIO ATUAL
// ============================================================

export function obterUsuarioAtual(): User | null {

  return auth.currentUser
}