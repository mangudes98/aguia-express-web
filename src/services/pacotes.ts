// ARQUIVO: src/services/pacotes.ts
import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  Timestamp,
  updateDoc,
} from "firebase/firestore";
import { db } from "../lib/firebase";
import { Pacote, StatusPacote } from "../types";

const COLLECTION = "controle_codigos";

const normalizarStatus = (value: unknown): StatusPacote => {
  const status = String(value ?? "").toUpperCase().trim();
  if (status === "COLETADO") return "COLETADO";
  if (status === "ROTA") return "ROTA";
  if (status === "ENTREGUE") return "ENTREGUE";
  if (status === "AUSENTE") return "AUSENTE";
  if (status === "DEVOLVIDO") return "DEVOLVIDO";
  return "ROTA";
};

const normalizarTipo = (value: unknown): string => {
  const tipo = String(value ?? "").toUpperCase().trim();
  if (tipo.includes("MERCADO")) return "MERCADO_LIVRE";
  if (tipo.includes("SHOPEE")) return "SHOPEE";
  if (tipo.includes("AVULSO")) return "AVULSO";
  return tipo || "AVULSO";
};

const numero = (value: unknown): number | null => {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
};

function normalizar(id: string, data: Record<string, any>): Pacote {
  const latitudeEntrega = numero(data.latitudeEntrega);
  const longitudeEntrega = numero(data.longitudeEntrega);
  const latitude = numero(data.latitude);
  const longitude = numero(data.longitude);

  return {
    id,
    codigo: String(data.codigo ?? id),
    confirmado: Boolean(data.confirmado),
    data: data.data,
    dataDevolucao: data.dataDevolucao,
    documentoRecebedor: String(data.documentoRecebedor ?? ""),
    empresa: String(data.empresa ?? ""),
    erro: Boolean(data.erro),
    fotoDevolucao: String(data.fotoDevolucao ?? ""),
    fotos: Array.isArray(data.fotos) ? data.fotos.map(String) : [],
    usuarioNome: String(data.usuarioNome ?? ""),
    bairro:String(data.bairro ?? ""), cidade:String(data.cidade ?? ""), cep:String(data.cep ?? ""), rua:String(data.rua ?? ""), numero:String(data.numero ?? ""), pastaColeta:String(data.pastaColeta ?? ""),
    historico: Array.isArray(data.historico) ? data.historico : [],
    nomeRecebedor: String(data.nomeRecebedor ?? ""),
    observacao: String(data.observacao ?? ""),
    raw: String(data.raw ?? ""),
    status: normalizarStatus(data.status),
    subiu: Boolean(data.subiu),
    tipo: normalizarTipo(data.tipo),
    usuario: data.usuario ?? null,
    usuarioAnterior: data.usuarioAnterior ?? null,
    usuarioFinalizacao: data.usuarioFinalizacao ?? null,
    visivelAte: data.visivelAte,
    latitude,
    longitude,
    latitudeEntrega,
    longitudeEntrega,
    dataHoraBaixa: data.dataHoraBaixa,
  };
}

export async function listarPacotes(): Promise<Pacote[]> {
  const snap = await getDocs(collection(db, COLLECTION));
  const items = snap.docs.map((d) => normalizar(d.id, d.data()));

  items.sort((a, b) => timestampMs(b.data) - timestampMs(a.data));
  return items;
}

export async function buscarPacote(id: string): Promise<Pacote | null> {
  const snap = await getDoc(doc(db, COLLECTION, id));
  if (!snap.exists()) return null;
  return normalizar(snap.id, snap.data());
}

export async function atualizarStatus(
  id: string,
  status: StatusPacote,
  extras: Record<string, unknown> = {}
) {
  await updateDoc(doc(db, COLLECTION, id), {
    status,
    atualizadoEm: Timestamp.now(),
    ...extras,
  });
}

export function timestampMs(value: unknown): number {
  if (!value) return 0;
  if (value instanceof Timestamp) return value.toMillis();
  if (typeof value === "object" && value !== null && "toMillis" in value) {
    const fn = (value as { toMillis?: () => number }).toMillis;
    if (typeof fn === "function") return fn();
  }
  if (value instanceof Date) return value.getTime();
  const parsed = new Date(String(value)).getTime();
  return Number.isFinite(parsed) ? parsed : 0;
}

export function formatarData(value: unknown): string {
  const ms = timestampMs(value);
  if (!ms) return "-";
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(ms));
}

export function nomeTipo(tipo: string): string {
  if (tipo === "MERCADO_LIVRE") return "Mercado Livre";
  if (tipo === "SHOPEE") return "Shopee";
  if (tipo === "AVULSO") return "Avulso";
  return tipo || "Avulso";
}

export function nomeStatus(status: StatusPacote): string {
  const map: Record<StatusPacote, string> = {
    COLETADO: "Coletado",
    ROTA: "Em rota",
    ENTREGUE: "Entregue",
    AUSENTE: "Ausente",
    DEVOLVIDO: "Devolvido",
  };
  return map[status];
}
