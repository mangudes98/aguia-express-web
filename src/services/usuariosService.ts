// ============================================================
// ARQUIVO: src/services/usuariosService.ts
// FUNÇÃO: Comunicação da coleção "usuarios" com Firestore.
// RESPONSÁVEL POR:
// - Buscar usuário
// - Buscar todos os usuários
// - Atualizar usuário
// - Alterar status
// ============================================================

import {
  collection,
  doc,
  getDoc,
  getDocs,
  updateDoc,
} from 'firebase/firestore'

import {
  db,
} from './firebase/firebase'

import type {
  UsuarioSistema,
  StatusUsuario,
} from '../models/user'


// ============================================================
// NOME DA COLEÇÃO
// ============================================================

const COLECAO_USUARIOS = 'usuarios'


// ============================================================
// BUSCAR USUÁRIO PELO UID
// ============================================================

export async function buscarUsuario(
  uid: string
): Promise<UsuarioSistema | null> {

  const referencia = doc(
    db,
    COLECAO_USUARIOS,
    uid
  )

  const resultado =
    await getDoc(referencia)

  if (!resultado.exists()) {
    return null
  }

  return {
    id: resultado.id,
    ...resultado.data(),
  } as UsuarioSistema
}


// ============================================================
// BUSCAR TODOS OS USUÁRIOS
// ============================================================

export async function buscarUsuarios(): Promise<
  UsuarioSistema[]
> {

  const referencia =
    collection(
      db,
      COLECAO_USUARIOS
    )

  const resultado =
    await getDocs(referencia)

  return resultado.docs.map((documento) => {

    return {
      id: documento.id,
      ...documento.data(),
    } as UsuarioSistema

  })
}


// ============================================================
// ATUALIZAR USUÁRIO
// ============================================================

export async function atualizarUsuario(
  usuario: UsuarioSistema
): Promise<void> {

  const referencia = doc(
    db,
    COLECAO_USUARIOS,
    usuario.id
  )

  await updateDoc(
    referencia,
    {
      nome: usuario.nome,
      email: usuario.email,
      tipo: usuario.tipo,
      status: usuario.status,
      empresaId:
        usuario.empresaId ?? null,
    }
  )
}


// ============================================================
// ALTERAR STATUS
// ============================================================

export async function atualizarStatusUsuario(
  uid: string,
  status: StatusUsuario
): Promise<void> {

  const referencia = doc(
    db,
    COLECAO_USUARIOS,
    uid
  )

  await updateDoc(
    referencia,
    {
      status,
    }
  )
}