// ARQUIVO: src/services/usuarios.ts
import { collection, getDocs } from "firebase/firestore";
import { db } from "../lib/firebase";
import type { Usuario } from "../types";

export type UserNameMap = Record<string, string>;

export async function listarUsuarios(): Promise<Usuario[]> {
  const snap = await getDocs(collection(db, "usuarios"));
  return snap.docs.map((doc) => {
    const x = doc.data() as any;
    return {
      id: doc.id,
      email: String(x.email ?? doc.id),
      nome: String(x.nome ?? "").trim(),
      tipo: String(x.tipo ?? x.perfil ?? ""),
      banco: x.banco,
      pix: x.pix,
      favorecido: x.favorecido,
      ganhos: Number(x.ganhos ?? 0),
      permissoes: x.permissoes ?? {},
      empresaId: x.empresaId,
      ativo: x.ativo !== false,
      regiao: x.regiao,
      telefone: x.telefone,
    } as Usuario;
  });
}

export async function carregarNomesUsuarios(): Promise<UserNameMap> {
  const usuarios = await listarUsuarios();
  const mapa: UserNameMap = {};
  usuarios.forEach((u) => {
    const email = String(u.email ?? u.id).trim().toLowerCase();
    const nome = String(u.nome ?? "").trim();
    if (email && nome) mapa[email] = nome;
    if (u.id) mapa[String(u.id).trim().toLowerCase()] = nome || email;
  });
  return mapa;
}

export function nomeUsuario(
  email: string | undefined | null,
  nomes: UserNameMap,
  fallback?: string
) {
  const key = String(email ?? "").trim().toLowerCase();
  return nomes[key] || String(fallback ?? "").trim() || key || "SEM USUÁRIO";
}
