// ARQUIVO: src/services/empresas.ts
import { addDoc, collection, doc, getDocs, limit, orderBy, query, Timestamp, updateDoc } from "firebase/firestore";
import { db } from "../lib/firebase";
import { Empresa } from "../types";

const ref = collection(db, "empresas");

export async function listarEmpresas(): Promise<Empresa[]> {
  try {
    const snap = await getDocs(query(ref, orderBy("nome"), limit(500)));
    return snap.docs.map(d => ({ id: d.id, ...d.data() } as Empresa));
  } catch {
    const snap = await getDocs(query(ref, limit(500)));
    return snap.docs.map(d => ({ id: d.id, ...d.data() } as Empresa));
  }
}

export async function criarEmpresa(data: Omit<Empresa, "id">) {
  return addDoc(ref, { ...data, criadaEm: Timestamp.now() });
}

export async function atualizarEmpresa(id: string, data: Partial<Empresa>) {
  await updateDoc(doc(db, "empresas", id), data);
}
