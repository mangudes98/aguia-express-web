// ============================================================
// ARQUIVO: src/models/user.ts
// FUNÇÃO: Modelo oficial de usuário do sistema.
// ESTE MODELO SERÁ UTILIZADO NO FIREBASE.
// ============================================================


// ============================================================
// TIPOS DE USUÁRIO
// ============================================================

export type TipoUsuario =
  | 'admin'
  | 'empresa'
  | 'operacao'


// ============================================================
// STATUS DO USUÁRIO
// ============================================================

export type StatusUsuario =
  | 'ativo'
  | 'inativo'


// ============================================================
// INTERFACE PRINCIPAL
// ============================================================

export interface UsuarioSistema {

  // UID oficial do Firebase Authentication
  id: string


  // Nome completo do usuário
  nome: string


  // E-mail utilizado para login
  email: string


  // Tipo de acesso
  tipo: TipoUsuario


  // Situação da conta
  status: StatusUsuario


  // ID da empresa vinculada.
  // Admin pode não possuir empresa.
  empresaId?: string | null


  // Data de criação
  criadoEm?: unknown


  // Data da última atualização
  atualizadoEm?: unknown
}