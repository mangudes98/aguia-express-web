/**
 * WhatsApp — Painel de atendimento Águia Express
 *
 * Tempo real:
 *  - Lista de conversas: onSnapshot em "whatsapp_conversas"
 *  - Mensagens da conversa aberta: onSnapshot na subcoleção "whatsapp_conversas/{numero}/mensagens"
 *    (é nessa subcoleção que as functions gravam cliente e assistente)
 *  - Histórico do agente da Meta (Conversation Turns): carregado ao abrir a conversa
 *    pelo proxy server-side, sem expor o token da Meta.
 *
 * Coloque este arquivo em src/pages/whatsapp.tsx (ou onde já ficava o antigo).
 * Ajuste apenas o bloco ENDPOINTS e o caminho do import do firebase, se necessário.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import { collection, onSnapshot, query } from "firebase/firestore";
import { db } from "../services/firebase/firebase";
import {
  AlertCircle,
  Bot,
  Building2,
  ChevronDown,
  LoaderCircle,
  MessageCircle,
  RefreshCw,
  Search,
  Send,
  UserRound,
  UsersRound,
  Wrench,
  X,
  Settings2,
  Plus,
  Trash2,
} from "lucide-react";

/* ============================================================
 * CONFIGURAÇÃO
 * ============================================================ */

const ENDPOINTS = {
  /** URL da function whatsappSend */
  send: "/api/whatsapp/send",
  /** URL da function whatsappControl */
  control: "/api/whatsapp/control",
  /** Proxy server-side para configurações, conhecimento, skills e testes. */
  agent: "/api/whatsapp/meta-agent/admin",
  /**
   * Proxy (seu backend) para GET {entity_id}/insights/conversations/turns da Meta.
   * O backend acrescenta Authorization e X-API-Version antes de consultar a Meta.
   */
  metaTurns: "/api/whatsapp/meta-turns",
};

const COLECOES = {
  conversas: "whatsapp_conversas",
  mensagens: "mensagens",
  colaboradores: "candidatos_entregadores",
  parceiros: "solicitacoes_parceiros",
};

const palette = {
  ink: "#18211f",
  muted: "#71807b",
  line: "#dce6e1",
  canvas: "#f4f8f5",
  card: "#ffffff",
  forest: "#16483a",
  green: "#2f8f68",
  paleGreen: "#e6f4ec",
  paleYellow: "#fff7dc",
  red: "#b44d4d",
  paleRed: "#fdf0ef",
};

/* ============================================================
 * TIPOS
 * ============================================================ */

type UnknownRecord = Record<string, unknown>;
type Tab = "chat" | "agent" | "colaboradores" | "parceiros";
type Role = "cliente" | "assistente";

type NormalizedMessage = {
  id: string;
  messageId?: string;
  turnId?: string;
  role: Role;
  text: string;
  at: Date | null;
  imageUrl?: string;
  type?: string;
  human?: boolean;
  source: "firestore" | "meta";
  sequence: number;
};

type ToolActivity = {
  id: string;
  turnId?: string;
  name: string;
  input?: string;
  output?: string;
  status?: string;
  at: Date | null;
  source: "firestore" | "meta";
  sequence: number;
};

type TimelineItem =
  | { kind: "message"; id: string; at: Date | null; sequence: number; message: NormalizedMessage }
  | { kind: "activity"; id: string; at: Date | null; sequence: number; activity: ToolActivity };

type Conversation = {
  id: string;
  name: string;
  phone: string;
  bsuid?: string;
  status: string;
  updatedAt: Date | null;
  unread: number;
  human: boolean;
  lastText: string;
  messages: NormalizedMessage[];
  activities: ToolActivity[];
};

type RegisterItem = {
  id: string;
  title: string;
  subtitle: string;
  status?: string;
  details: Array<[string, string]>;
};

/* ============================================================
 * ESTILOS
 * ============================================================ */

const css = `
  .wa-page { min-height: 100vh; padding: 28px clamp(16px, 3vw, 42px) 34px; background: ${palette.canvas}; color: ${palette.ink};
    font-family: Inter, ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif; }
  .wa-page *, .wa-page *:before, .wa-page *:after { box-sizing: border-box; }
  .wa-page button, .wa-page input, .wa-page textarea { font: inherit; }
  .wa-page button { cursor: pointer; }
  .wa-wrap { width: min(1480px, 100%); margin: 0 auto; }
  .wa-hero { display: flex; align-items: flex-start; justify-content: space-between; gap: 24px; margin-bottom: 24px; flex-wrap: wrap; }
  .wa-kicker { display: flex; align-items: center; gap: 9px; color: ${palette.green}; font-size: 11px; font-weight: 800; letter-spacing: .11em; text-transform: uppercase; }
  .wa-kicker-dot { width: 7px; height: 7px; border-radius: 50%; background: ${palette.green}; box-shadow: 0 0 0 4px ${palette.paleGreen}; }
  .wa-title { margin: 10px 0 5px; font-size: clamp(26px, 4vw, 40px); line-height: 1.05; letter-spacing: -.05em; }
  .wa-subtitle { margin: 0; color: ${palette.muted}; font-size: 14px; }
  .wa-metrics { display: grid; grid-template-columns: repeat(4, minmax(112px, 1fr)); gap: 10px; }
  .wa-metric { padding: 13px 15px; border: 1px solid ${palette.line}; border-radius: 14px; background: rgba(255,255,255,.82); }
  .wa-metric-label { display: block; color: ${palette.muted}; font-size: 10px; font-weight: 700; letter-spacing: .04em; text-transform: uppercase; }
  .wa-metric-value { display: block; margin-top: 7px; font-size: 20px; font-weight: 800; letter-spacing: -.04em; }
  .wa-metric-value.small { font-size: 13px; }
  .wa-tabs { display: flex; align-items: center; gap: 4px; width: fit-content; padding: 4px; margin-bottom: 14px; border: 1px solid ${palette.line}; border-radius: 13px; background: rgba(255,255,255,.82); }
  .wa-tab { display: inline-flex; align-items: center; gap: 8px; height: 36px; padding: 0 15px; border: 0; border-radius: 9px; color: ${palette.muted}; background: transparent; font-size: 11px; font-weight: 800; }
  .wa-tab.active { color: #fff; background: ${palette.forest}; }
  .wa-tab-count { display: inline-grid; place-items: center; min-width: 19px; height: 19px; padding: 0 5px; border-radius: 20px; color: ${palette.muted}; background: #edf3ef; font-size: 9px; }
  .wa-tab.active .wa-tab-count { color: ${palette.forest}; background: #fff; }
  .wa-surface { overflow: hidden; border: 1px solid ${palette.line}; border-radius: 18px; background: ${palette.card}; }
  .wa-chat, .wa-register { display: grid; grid-template-columns: 332px minmax(0, 1fr); min-height: 620px; }
  .wa-list, .wa-register-list { min-width: 0; border-right: 1px solid ${palette.line}; background: #fbfdfb; }
  .wa-list-head, .wa-register-header { padding: 20px 18px 16px; border-bottom: 1px solid ${palette.line}; }
  .wa-section-heading { display: flex; align-items: center; justify-content: space-between; gap: 10px; margin-bottom: 15px; }
  .wa-section-heading h2 { margin: 0; font-size: 16px; letter-spacing: -.03em; }
  .wa-section-heading p { margin: 3px 0 0; color: ${palette.muted}; font-size: 11px; }
  .wa-icon-button { display: inline-grid; place-items: center; width: 30px; height: 30px; border: 1px solid ${palette.line}; border-radius: 9px; color: ${palette.muted}; background: #fff; }
  .wa-search { position: relative; }
  .wa-search svg { position: absolute; top: 11px; left: 11px; color: #98a9a1; }
  .wa-search input { width: 100%; height: 36px; padding: 0 12px 0 34px; border: 1px solid ${palette.line}; border-radius: 10px; outline: none; background: #fff; font-size: 11px; }
  .wa-list-body, .wa-register-items { max-height: 550px; overflow: auto; }
  .wa-conversation { display: flex; align-items: flex-start; gap: 11px; width: 100%; padding: 15px 16px; border: 0; border-bottom: 1px solid #edf3ef; text-align: left; background: transparent; }
  .wa-conversation:hover { background: #f1f8f3; }
  .wa-conversation.active { background: ${palette.paleGreen}; box-shadow: inset 3px 0 ${palette.green}; }
  .wa-avatar { display: inline-grid; flex: 0 0 37px; place-items: center; width: 37px; height: 37px; border-radius: 50%; color: ${palette.forest}; background: #dceee4; font-size: 13px; font-weight: 800; }
  .wa-conversation-main { min-width: 0; flex: 1; }
  .wa-conversation-top { display: flex; align-items: baseline; justify-content: space-between; gap: 8px; }
  .wa-name { overflow: hidden; font-size: 12px; font-weight: 800; white-space: nowrap; text-overflow: ellipsis; }
  .wa-time { flex: 0 0 auto; color: #8a9b93; font-size: 9px; }
  .wa-phone { margin-top: 3px; color: ${palette.muted}; font-size: 10px; }
  .wa-preview { overflow: hidden; margin-top: 7px; color: #63746c; font-size: 10px; white-space: nowrap; text-overflow: ellipsis; }
  .wa-list-meta { display: flex; align-items: center; gap: 7px; margin-top: 8px; }
  .wa-pill { display: inline-flex; align-items: center; gap: 4px; padding: 3px 7px; border-radius: 20px; font-size: 9px; font-weight: 800; }
  .wa-pill.ai { color: #276e52; background: #dff3e8; }
  .wa-pill.human { color: #8b6715; background: ${palette.paleYellow}; }
  .wa-unread { display: inline-grid; place-items: center; min-width: 18px; height: 18px; padding: 0 5px; border-radius: 20px; color: #fff; background: ${palette.green}; font-size: 9px; font-weight: 800; }
  .wa-chat-main { display: flex; min-width: 0; flex-direction: column; background: #fff; }
  .wa-chat-head { display: flex; align-items: center; justify-content: space-between; gap: 16px; padding: 17px 22px; border-bottom: 1px solid ${palette.line}; }
  .wa-person { display: flex; align-items: center; gap: 11px; min-width: 0; }
  .wa-person-avatar { display: inline-grid; flex: 0 0 40px; place-items: center; width: 40px; height: 40px; border-radius: 12px; color: #fff; background: ${palette.forest}; }
  .wa-person h2 { overflow: hidden; margin: 0; font-size: 15px; white-space: nowrap; text-overflow: ellipsis; }
  .wa-person p { margin: 4px 0 0; color: ${palette.muted}; font-size: 10px; }
  .wa-automation { display: flex; align-items: center; gap: 7px; padding: 8px 10px; border: 1px solid #cde5d6; border-radius: 10px; color: #2c7656; background: #f2fbf5; font-size: 10px; font-weight: 800; }
  .wa-automation.human { border-color: #efdca9; color: #8b6715; background: #fffbef; }
  .wa-automation-dot { width: 7px; height: 7px; border-radius: 50%; background: currentColor; }
  .wa-head-actions { display: flex; align-items: center; gap: 8px; }
  .wa-takeover { height: 31px; padding: 0 10px; border: 0; border-radius: 8px; color: #fff; background: ${palette.forest}; font-size: 10px; font-weight: 800; }
  .wa-takeover:disabled { cursor: wait; opacity: .6; }
  .wa-messages { flex: 1; min-height: 0; max-height: 510px; overflow: auto; padding: 22px clamp(16px, 4vw, 48px); background: linear-gradient(135deg, #f8fbf8 0%, #f2f7f3 100%); }
  .wa-thread { width: min(780px, 100%); margin: 0 auto; }
  .wa-date { display: flex; align-items: center; gap: 9px; margin: 3px 0 16px; color: #82938a; font-size: 9px; font-weight: 800; letter-spacing: .09em; text-transform: uppercase; }
  .wa-date:before, .wa-date:after { content: ""; height: 1px; flex: 1; background: ${palette.line}; }
  .wa-message-row { display: flex; margin: 8px 0; }
  .wa-message-row.cliente { justify-content: flex-start; }
  .wa-message-row.assistente { justify-content: flex-end; }
  .wa-bubble { max-width: min(75%, 520px); padding: 11px 13px 9px; border: 1px solid ${palette.line}; border-radius: 14px; background: #fff; }
  .wa-bubble.assistente { border-color: ${palette.forest}; color: #fff; background: ${palette.forest}; border-bottom-right-radius: 4px; }
  .wa-bubble.cliente { border-bottom-left-radius: 4px; }
  .wa-role { display: flex; align-items: center; gap: 6px; margin-bottom: 6px; color: #84938c; font-size: 9px; font-weight: 800; }
  .wa-bubble.assistente .wa-role { color: #a6d2bb; }
  .wa-message-text { white-space: pre-wrap; word-break: break-word; font-size: 12px; line-height: 1.55; }
  .wa-message-time { margin-top: 6px; color: #91a29a; font-size: 9px; text-align: right; }
  .wa-bubble.assistente .wa-message-time { color: #acd1bd; }
  .wa-message-image { display: block; max-width: 260px; max-height: 230px; margin-bottom: 8px; border-radius: 9px; cursor: zoom-in; object-fit: contain; }
  .wa-activity { margin: 13px auto; border: 1px solid #e5e7d6; border-radius: 12px; color: #6e704f; background: rgba(255,255,255,.7); font-size: 10px; }
  .wa-activity summary { display: flex; align-items: center; gap: 7px; padding: 10px 12px; cursor: pointer; list-style: none; font-weight: 800; }
  .wa-activity summary::-webkit-details-marker { display: none; }
  .wa-activity-body { padding: 0 12px 11px 34px; color: #747766; line-height: 1.5; white-space: pre-wrap; word-break: break-word; }
  .wa-activity-label { display: block; margin-top: 5px; color: #9a9b7d; font-size: 9px; font-weight: 800; text-transform: uppercase; }
  .wa-activity-status { margin-left: auto; color: #82938a; font-size: 9px; text-transform: uppercase; }
  .wa-compose { display: flex; align-items: flex-end; gap: 9px; padding: 12px 16px; border-top: 1px solid ${palette.line}; background: #fff; }
  .wa-compose textarea { min-height: 41px; max-height: 100px; resize: vertical; flex: 1; padding: 11px 12px; border: 1px solid ${palette.line}; border-radius: 10px; outline: none; background: #fbfdfb; font-size: 11px; }
  .wa-send { display: inline-grid; place-items: center; width: 41px; height: 41px; border: 0; border-radius: 10px; color: #fff; background: ${palette.forest}; }
  .wa-send:disabled { cursor: not-allowed; opacity: .4; }
  .wa-compose-note { padding: 0 16px 11px; color: #8b9992; background: #fff; font-size: 9px; }
  .wa-empty, .wa-loading { display: grid; place-items: center; min-height: 270px; padding: 28px; color: ${palette.muted}; text-align: center; }
  .wa-empty-icon { display: inline-grid; place-items: center; width: 46px; height: 46px; margin: 0 auto 12px; border-radius: 15px; color: ${palette.green}; background: ${palette.paleGreen}; }
  .wa-empty strong { display: block; color: ${palette.ink}; font-size: 13px; }
  .wa-empty p { max-width: 340px; margin: 6px auto 0; font-size: 11px; line-height: 1.5; }
  .wa-alert { display: flex; align-items: center; gap: 8px; margin: 0 0 12px; padding: 10px 12px; border: 1px solid #f2d3d0; border-radius: 10px; color: ${palette.red}; background: ${palette.paleRed}; font-size: 11px; }
  .wa-register-item { display: flex; align-items: center; gap: 11px; width: 100%; padding: 14px 17px; border: 0; border-bottom: 1px solid #edf3ef; text-align: left; background: transparent; }
  .wa-register-item.active { background: ${palette.paleGreen}; box-shadow: inset 3px 0 ${palette.green}; }
  .wa-register-avatar { display: inline-grid; place-items: center; flex: 0 0 35px; width: 35px; height: 35px; border-radius: 10px; color: ${palette.forest}; background: #dceee4; }
  .wa-register-title { overflow: hidden; font-size: 12px; font-weight: 800; white-space: nowrap; text-overflow: ellipsis; }
  .wa-register-subtitle { margin-top: 3px; color: ${palette.muted}; font-size: 10px; }
  .wa-register-detail { padding: 27px clamp(18px, 4vw, 45px); }
  .wa-detail-head { display: flex; align-items: center; justify-content: space-between; gap: 16px; padding-bottom: 22px; border-bottom: 1px solid ${palette.line}; }
  .wa-detail-person { display: flex; align-items: center; gap: 13px; }
  .wa-detail-avatar { display: inline-grid; place-items: center; width: 48px; height: 48px; border-radius: 15px; color: #fff; background: ${palette.forest}; }
  .wa-detail-head h2 { margin: 0; font-size: 20px; letter-spacing: -.04em; }
  .wa-detail-head p { margin: 5px 0 0; color: ${palette.muted}; font-size: 11px; }
  .wa-status { padding: 5px 9px; border-radius: 20px; color: #276e52; background: ${palette.paleGreen}; font-size: 9px; font-weight: 800; text-transform: uppercase; }
  .wa-detail-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 11px; margin-top: 23px; }
  .wa-detail-card { padding: 13px; border: 1px solid ${palette.line}; border-radius: 12px; background: #fbfdfb; }
  .wa-detail-label { color: ${palette.muted}; font-size: 9px; font-weight: 800; text-transform: uppercase; }
  .wa-detail-value { margin-top: 7px; font-size: 12px; word-break: break-word; }
  .wa-modal-backdrop { position: fixed; z-index: 10; inset: 0; display: grid; place-items: center; padding: 20px; background: rgba(18,37,30,.7); }
  .wa-modal { position: relative; max-width: min(900px, 95vw); }
  .wa-modal img { display: block; max-width: 100%; max-height: 84vh; border-radius: 12px; }
  .wa-modal-close { position: absolute; top: -12px; right: -12px; display: grid; place-items: center; width: 30px; height: 30px; border: 0; border-radius: 50%; color: #fff; background: ${palette.ink}; }
  .wa-agent { padding: clamp(18px, 4vw, 34px); }
  .wa-agent-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 18px; margin-bottom: 22px; }
  .wa-agent-head h2 { margin: 0; font-size: 21px; letter-spacing: -.04em; }
  .wa-agent-head p { max-width: 680px; margin: 6px 0 0; color: ${palette.muted}; font-size: 11px; line-height: 1.5; }
  .wa-agent-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 14px; }
  .wa-agent-card { padding: 17px; border: 1px solid ${palette.line}; border-radius: 14px; background: #fbfdfb; }
  .wa-agent-card.wide { grid-column: 1 / -1; }
  .wa-agent-card h3 { margin: 0 0 5px; font-size: 14px; letter-spacing: -.02em; }
  .wa-agent-card > p { margin: 0 0 14px; color: ${palette.muted}; font-size: 10px; line-height: 1.45; }
  .wa-agent-form { display: grid; gap: 9px; }
  .wa-agent-form.two { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .wa-agent-field { display: grid; gap: 5px; }
  .wa-agent-field label { color: ${palette.muted}; font-size: 9px; font-weight: 800; text-transform: uppercase; }
  .wa-agent-field input, .wa-agent-field select, .wa-agent-field textarea { width: 100%; padding: 9px 10px; border: 1px solid ${palette.line}; border-radius: 9px; outline: none; background: #fff; font-size: 11px; }
  .wa-agent-field textarea { min-height: 66px; resize: vertical; line-height: 1.45; }
  .wa-agent-check { display: flex; align-items: center; gap: 8px; min-height: 35px; color: ${palette.ink}; font-size: 11px; }
  .wa-agent-actions { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; margin-top: 12px; }
  .wa-agent-primary, .wa-agent-secondary, .wa-agent-danger { height: 31px; padding: 0 11px; border: 0; border-radius: 8px; font-size: 10px; font-weight: 800; }
  .wa-agent-primary { color: #fff; background: ${palette.forest}; }
  .wa-agent-secondary { border: 1px solid ${palette.line}; color: ${palette.forest}; background: #fff; }
  .wa-agent-danger { color: #9b4545; background: ${palette.paleRed}; }
  .wa-agent-primary:disabled, .wa-agent-secondary:disabled, .wa-agent-danger:disabled { cursor: wait; opacity: .55; }
  .wa-agent-list { display: grid; gap: 8px; margin-top: 12px; }
  .wa-agent-list-item { display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; padding: 11px; border: 1px solid ${palette.line}; border-radius: 10px; background: #fff; }
  .wa-agent-list-item strong { display: block; font-size: 11px; }
  .wa-agent-list-item p { margin: 4px 0 0; color: #66766e; font-size: 10px; line-height: 1.45; white-space: pre-wrap; }
  .wa-agent-result { margin-top: 12px; padding: 11px; border-radius: 9px; color: #276e52; background: ${palette.paleGreen}; font-size: 11px; line-height: 1.5; white-space: pre-wrap; }
  .wa-agent-note { margin-top: 10px; color: ${palette.muted}; font-size: 9px; line-height: 1.45; }
  @media (max-width: 950px) {
    .wa-hero { flex-direction: column; }
    .wa-metrics { width: 100%; }
    .wa-chat, .wa-register { grid-template-columns: 285px minmax(0, 1fr); }
    .wa-bubble { max-width: 84%; }
  }
  @media (max-width: 680px) {
    .wa-page { padding: 20px 12px 22px; }
    .wa-metrics { grid-template-columns: repeat(2, 1fr); }
    .wa-tabs { width: 100%; overflow: auto; }
    .wa-chat, .wa-register { display: block; min-height: 0; }
    .wa-list, .wa-register-list { border-right: 0; border-bottom: 1px solid ${palette.line}; }
    .wa-list-body, .wa-register-items { max-height: 260px; }
    .wa-chat-main { min-height: 540px; }
    .wa-chat-head { align-items: flex-start; flex-direction: column; }
    .wa-messages { max-height: none; }
    .wa-detail-grid { grid-template-columns: 1fr; }
    .wa-agent-grid, .wa-agent-form.two { grid-template-columns: 1fr; }
    .wa-agent-card.wide { grid-column: auto; }
  }
`;

/* ============================================================
 * HELPERS
 * ============================================================ */

function record(value: unknown): UnknownRecord {
  return value && typeof value === "object" ? (value as UnknownRecord) : {};
}

function text(value: unknown): string {
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") return String(value);
  if (value && typeof value === "object") {
    try {
      return JSON.stringify(value);
    } catch {
      return "";
    }
  }
  return "";
}

function firstText(...values: unknown[]): string {
  return values.map(text).find((value) => value.trim()) || "";
}

function dateValue(value: unknown): Date | null {
  if (!value) return null;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
  if (typeof value === "number") {
    const ms = value < 10_000_000_000 ? value * 1000 : value;
    const date = new Date(ms);
    return Number.isNaN(date.getTime()) ? null : date;
  }
  if (typeof value === "object") {
    const item = record(value);
    if (typeof item.toDate === "function") {
      try {
        return dateValue((item.toDate as () => unknown)());
      } catch {
        return null;
      }
    }
    if (typeof item.seconds === "number") return dateValue(item.seconds);
    if (typeof item._seconds === "number") return dateValue(item._seconds);
  }
  const date = new Date(String(value));
  return Number.isNaN(date.getTime()) ? null : date;
}

function formatTime(value: Date | null): string {
  return value ? value.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }) : "";
}

function formatDate(value: Date | null): string {
  return value ? value.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" }) : "";
}

function formatRelativeDate(value: Date | null): string {
  if (!value) return "—";
  const today = new Date();
  if (value.toDateString() === today.toDateString()) return formatTime(value);
  return value.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
}

function formatPhone(value: string): string {
  const digits = value.replace(/\D/g, "");
  if (digits.length === 13) return `+${digits.slice(0, 2)} (${digits.slice(2, 4)}) ${digits.slice(4, 9)}-${digits.slice(9)}`;
  if (digits.length === 12) return `+${digits.slice(0, 2)} (${digits.slice(2, 4)}) ${digits.slice(4, 8)}-${digits.slice(8)}`;
  if (digits.length === 11) return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
  return value;
}

function normalizePhone(value: string): string {
  const digits = value.replace(/\D/g, "");
  if ((digits.length === 10 || digits.length === 11) && !digits.startsWith("55")) return `55${digits}`;
  return digits;
}

function initials(name: string): string {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join("").toUpperCase() || "C";
}

function mediaUrl(item: UnknownRecord): string {
  const candidate = firstText(item.url, item.mediaUrl, item.imagemUrl, item.imageUrl, item.fotoUrl, item.media, item.imagem, item.foto);
  return /^https?:\/\//i.test(candidate) ? candidate : "";
}

function roleFor(item: UnknownRecord): Role {
  const role = firstText(
    item.papel,
    item.role,
    item.sender,
    item.author,
    item.direction,
    item.direcao,
    item.source,
    item.origem,
  ).toLowerCase();
  return ["assistente", "assistant", "ia", "bot", "meta", "agent", "llm", "outgoing", "sent", "human"].some((value) => role.includes(value))
    ? "assistente"
    : "cliente";
}

function messageFrom(
  raw: unknown,
  index: number,
  forcedRole?: Role,
  options?: Partial<Pick<NormalizedMessage, "source" | "turnId" | "messageId" | "at" | "sequence" | "id">>,
): NormalizedMessage | null {
  const item = record(raw);
  const preview = record(item.content);
  const direct = typeof raw === "string" || typeof raw === "number" ? String(raw) : "";
  const contentValue = typeof item.content === "string" || typeof item.content === "number" ? String(item.content) : "";
  const value = firstText(
    direct,
    item.texto,
    item.text,
    item.message,
    item.body,
    item.llm_output_preview,
    item.llmOutputPreview,
    contentValue,
    preview.text,
    preview.value,
  );
  const image = mediaUrl(item);
  if (!value && !image) return null;
  const at = options?.at ?? dateValue(item.em ?? item.timestamp ?? item.createdAt ?? item.created_at);
  return {
    id: options?.id || firstText(item.id, item.messageId, item.message_id) || `message-${index}`,
    messageId: options?.messageId || firstText(item.message_id, item.messageId) || undefined,
    turnId: options?.turnId,
    role: forcedRole || roleFor(item),
    text: value,
    at,
    imageUrl: image || undefined,
    type: firstText(item.tipo, item.type, item.mimeType) || undefined,
    human: firstText(item.origem, item.source).toLowerCase().includes("human"),
    source: options?.source || "firestore",
    sequence: options?.sequence ?? index,
  };
}

function toolFrom(
  raw: unknown,
  index: number,
  options?: Partial<Pick<ToolActivity, "source" | "turnId" | "at" | "sequence" | "id">>,
): ToolActivity | null {
  const item = record(raw);
  const name = firstText(item.tool_name, item.toolName, item.name, item.ferramenta);
  const input = text(item.tool_input ?? item.toolInput ?? item.entrada);
  const output = text(item.tool_output ?? item.toolOutput ?? item.resultado);
  if (!name && !input && !output) return null;
  return {
    id: options?.id || firstText(item.id, item.step_id) || `activity-${index}`,
    turnId: options?.turnId,
    name: name || "Ferramenta da IA",
    input: input || undefined,
    output: output || undefined,
    status: firstText(item.status, item.state) || undefined,
    at: options?.at ?? dateValue(item.timestamp ?? item.em ?? item.createdAt),
    source: options?.source || "firestore",
    sequence: options?.sequence ?? index,
  };
}

function dedupeMessages(messages: NormalizedMessage[]): NormalizedMessage[] {
  const seen = new Set<string>();
  return messages.filter((message) => {
    const fallback = `${message.at?.getTime() || 0}|${message.text.trim()}|${message.imageUrl || ""}`;
    const key = message.messageId ? `id:${message.messageId}:${message.role}` : `fb:${message.role}:${fallback}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function dedupeActivities(activities: ToolActivity[]): ToolActivity[] {
  const seen = new Set<string>();
  return activities.filter((activity) => {
    const key = `${activity.turnId || ""}|${activity.id}|${activity.name}|${activity.input || ""}|${activity.output || ""}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/* ------------------------- Firestore ------------------------- */

function conversationFrom(id: string, raw: unknown): Conversation {
  const item = record(raw);
  const inline: NormalizedMessage[] = [];
  const rawMessages = item.mensagens ?? item.messages;
  if (Array.isArray(rawMessages)) {
    rawMessages.forEach((value, index) => {
      const message = messageFrom(value, index, undefined, { id: `inline-${id}-${index}` });
      if (message) inline.push(message);
    });
  }
  const activities: ToolActivity[] = [];
  if (Array.isArray(item.steps)) {
    item.steps.forEach((step, index) => {
      const activity = toolFrom(step, index, { id: `step-${id}-${index}` });
      if (activity) activities.push(activity);
    });
  }
  const updatedAt =
    dateValue(item.atualizadoEm ?? item.updatedAt ?? item.lastMessageAt ?? item.timestamp) ||
    inline.reduce<Date | null>((latest, message) => (!latest || (message.at && message.at > latest) ? message.at : latest), null);
  const unreadValue = item.naoLidas ?? item.unreadCount ?? item.unread;
  const unread = typeof unreadValue === "boolean" ? (unreadValue ? 1 : 0) : Number(unreadValue) || 0;
  const phone = firstText(item.numero, item.phone, item.user_phone_number, item.telefone) || id;
  return {
    id,
    name: firstText(item.nome, item.name, item.customerName) || "Cliente",
    phone,
    bsuid: firstText(item.bsuid, item.from_user_id, item.user_bsuid, item.business_scoped_user_id) || undefined,
    status: firstText(item.status, item.modo) || "Ativa",
    updatedAt,
    unread,
    human: item.atendimentoHumano === true || firstText(item.modo, item.mode).toLowerCase() === "humano",
    lastText: firstText(item.ultimaMensagem) || inline[inline.length - 1]?.text || "",
    messages: dedupeMessages(inline),
    activities: dedupeActivities(activities),
  };
}

function registerFrom(id: string, raw: unknown, kind: "colaborador" | "parceiro"): RegisterItem {
  const item = record(raw);
  const isPartner = kind === "parceiro";
  const title =
    firstText(isPartner ? item.nomeEmpresa : item.nomeCompleto, item.nome, item.name) || (isPartner ? "Empresa" : "Colaborador");
  const subtitle =
    firstText(isPartner ? item.nomeResponsavel : item.regiaoNome, item.numeroWhatsApp, item.telefone, item.cidadeRegiao) || "Cadastro";
  const details = Object.entries(item)
    .filter(([key, value]) => key !== "id" && key !== "mensagens" && ["string", "number", "boolean"].includes(typeof value))
    .slice(0, 12)
    .map(([key, value]) => [key, String(value)] as [string, string]);
  return { id, title, subtitle, status: text(item.status) || undefined, details };
}

/* ---------------------- Meta: turns ---------------------- */

function turnList(value: unknown): unknown[] {
  if (Array.isArray(value)) return value;
  const root = record(value);
  if (Array.isArray(root.turns)) return root.turns;
  if (Array.isArray(root.data)) return root.data;
  if (Array.isArray(root.results)) return root.results;
  return [];
}

async function loadConversationTurns(phone: string, bsuid?: string): Promise<unknown[]> {
  if (!ENDPOINTS.metaTurns) return [];
  const identifier = bsuid || normalizePhone(phone);
  if (!identifier) return [];
  const params = new URLSearchParams({ user_phone_number: identifier, limit: "100" });
  const endpoints = [
    ENDPOINTS.metaTurns,
    "/api/metaAgentTurns",
  ].filter((endpoint, index, list) => endpoint && list.indexOf(endpoint) === index);
  let lastError = "";

  for (const endpoint of endpoints) {
    const separator = endpoint.includes("?") ? "&" : "?";
    const response = await fetch(`${endpoint}${separator}${params.toString()}`, {
      headers: { Accept: "application/json" },
    });
    const raw = await response.text();
    let payload: unknown = null;
    try {
      payload = raw ? JSON.parse(raw) : null;
    } catch {
      payload = raw;
    }

    if (response.ok) return turnList(payload);

    lastError =
      firstText(record(payload).mensagem, record(payload).message, payload) ||
      `Conversation Turns respondeu ${response.status}.`;
    if (response.status !== 404) break;
  }

  throw new Error(lastError || "Conversation Turns não está disponível.");
}

async function agentRequest(
  resource: string,
  method: "GET" | "POST" | "PUT" | "DELETE" = "GET",
  id?: string,
  data?: unknown,
): Promise<unknown> {
  const params = new URLSearchParams({ resource });
  if (id) params.set("id", id);
  const endpoints = [
    ENDPOINTS.agent,
    "/api/metaAgentAdmin",
    "/api/whatsapp/meta-agent/admin",
  ].filter((endpoint, index, list) => endpoint && list.indexOf(endpoint) === index);
  let lastError = "";

  for (const endpoint of endpoints) {
    const response = await fetch(`${endpoint}?${params.toString()}`, {
      method,
      headers: method === "GET" || method === "DELETE" ? undefined : { "Content-Type": "application/json" },
      body: method === "GET" || method === "DELETE" ? undefined : JSON.stringify({ data }),
    });
    const raw = await response.text();
    let payload: unknown = null;
    try {
      payload = raw ? JSON.parse(raw) : null;
    } catch {
      payload = raw;
    }

    if (response.ok) return payload;

    lastError =
      firstText(record(payload).mensagem, record(payload).message, payload) ||
      `Meta Agent respondeu ${response.status}.`;
    if (response.status !== 404) break;
  }

  throw new Error(lastError || "O endpoint administrativo do Meta Agent não está disponível.");
}

function payloadObject(value: unknown): UnknownRecord {
  if (Array.isArray(value)) return record(value[0]);
  const root = record(value);
  if (Array.isArray(root.data)) return record(root.data[0]);
  return Object.keys(root).length === 1 && root.data && typeof root.data === "object" ? record(root.data) : root;
}

function payloadList(value: unknown): UnknownRecord[] {
  if (Array.isArray(value)) return value.map(record);
  const root = record(value);
  if (Array.isArray(root.data)) return root.data.map(record);
  if (Array.isArray(root.results)) return root.results.map(record);
  if (Array.isArray(root.items)) return root.items.map(record);
  return [];
}

function turnTimeline(turns: unknown[]): TimelineItem[] {
  const items: TimelineItem[] = [];
  turns.forEach((rawTurn, turnIndex) => {
    const turn = record(rawTurn);
    const turnId = firstText(turn.turn_id, turn.turnId) || `turn-${turnIndex}`;
    const turnAt = dateValue(turn.timestamp ?? turn.start_timestamp_ms ?? turn.created_at ?? turn.createdAt);
    const base = turnIndex * 1000;

    const clientRaw = turn.user_message ?? turn.userMessage ?? turn.client_message ?? turn.mensagem_cliente;
    const client = clientRaw !== undefined ? messageFrom(clientRaw, turnIndex, "cliente", {
      source: "meta",
      turnId,
      id: `meta-client-${turnId}`,
      messageId: firstText(record(clientRaw).message_id, record(clientRaw).messageId, turn.message_id) || undefined,
      at: turnAt,
      sequence: base - 1,
    }) : null;
    if (client) items.push({ kind: "message", id: client.id, at: client.at, sequence: client.sequence, message: client });

    const assistantRaw = turn.assistant_message ?? turn.assistantMessage ?? turn.response ?? turn.mensagem_assistente;
    if (assistantRaw !== undefined && !Array.isArray(assistantRaw)) {
      const assistant = messageFrom(assistantRaw, turnIndex, "assistente", {
        source: "meta",
        turnId,
        id: `meta-assistant-${turnId}`,
        messageId: firstText(record(assistantRaw).message_id, record(assistantRaw).messageId) || undefined,
        at: turnAt,
        sequence: base,
      });
      if (assistant) items.push({ kind: "message", id: assistant.id, at: assistant.at, sequence: assistant.sequence, message: assistant });
    }

    const steps = Array.isArray(turn.steps) ? turn.steps : [];
    steps.forEach((rawStep, stepIndex) => {
      const step = record(rawStep);
      const kind = firstText(step.type, step.kind, step.step_type).toUpperCase();
      const stepAt = dateValue(step.timestamp ?? step.created_at ?? step.createdAt) || turnAt;
      if (kind.includes("TOOL") || step.tool_name || step.toolName) {
        const activity = toolFrom(step, stepIndex, {
          source: "meta",
          turnId,
          id: `meta-tool-${turnId}-${stepIndex}`,
          at: stepAt,
          sequence: base + stepIndex,
        });
        if (activity) items.push({ kind: "activity", id: activity.id, at: activity.at, sequence: activity.sequence, activity });
      }
      if (firstText(step.llm_output_preview, step.llmOutputPreview)) {
        const message = messageFrom(step, stepIndex, "assistente", {
          source: "meta",
          turnId,
          id: `meta-llm-${turnId}-${stepIndex}`,
          messageId: firstText(step.message_id, step.messageId) || undefined,
          at: stepAt,
          sequence: base + stepIndex,
        });
        if (message) items.push({ kind: "message", id: message.id, at: message.at, sequence: message.sequence, message });
      }
    });
  });
  return items;
}

function consolidate(
  liveMessages: NormalizedMessage[],
  inlineMessages: NormalizedMessage[],
  activities: ToolActivity[],
  metaItems: TimelineItem[],
): TimelineItem[] {
  const metaMessages = metaItems
    .filter((item): item is Extract<TimelineItem, { kind: "message" }> => item.kind === "message")
    .map((item) => item.message);
  const metaActivities = metaItems
    .filter((item): item is Extract<TimelineItem, { kind: "activity" }> => item.kind === "activity")
    .map((item) => item.activity);

  const messages = dedupeMessages([...liveMessages, ...inlineMessages, ...metaMessages]);
  const allActivities = dedupeActivities([...activities, ...metaActivities]);

  return [
    ...messages.map((message) => ({ kind: "message" as const, id: message.id, at: message.at, sequence: message.sequence, message })),
    ...allActivities.map((activity) => ({ kind: "activity" as const, id: activity.id, at: activity.at, sequence: activity.sequence, activity })),
  ].sort((a, b) => ((a.at?.getTime() || 0) - (b.at?.getTime() || 0)) || a.sequence - b.sequence);
}

function emptyState(icon: ReactNode, title: string, description: string) {
  return (
    <div className="wa-empty">
      <div>
        <div className="wa-empty-icon">{icon}</div>
        <strong>{title}</strong>
        <p>{description}</p>
      </div>
    </div>
  );
}

/* ============================================================
 * CHAT
 * ============================================================ */

function ChatView({
  conversations,
  error,
  loading,
  onRefresh,
}: {
  conversations: Conversation[];
  error: string;
  loading: boolean;
  onRefresh: () => void;
}) {
  const [queryText, setQueryText] = useState("");
  const [selectedId, setSelectedId] = useState("");
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState("");
  const [changingMode, setChangingMode] = useState(false);
  const [image, setImage] = useState("");
  const [liveMessages, setLiveMessages] = useState<NormalizedMessage[]>([]);
  const [metaItems, setMetaItems] = useState<TimelineItem[]>([]);
  const [metaLoading, setMetaLoading] = useState(false);
  const [metaError, setMetaError] = useState("");
  const messagesRef = useRef<HTMLDivElement | null>(null);

  const selected = useMemo(
    () => conversations.find((conversation) => conversation.id === selectedId) || conversations[0] || null,
    [conversations, selectedId],
  );

  const filtered = useMemo(() => {
    const term = queryText.trim().toLowerCase();
    if (!term) return conversations;
    return conversations.filter((conversation) =>
      [conversation.name, conversation.phone, conversation.lastText].join(" ").toLowerCase().includes(term),
    );
  }, [conversations, queryText]);

  const selectedKey = selected?.id ?? "";
  const selectedPhone = selected?.phone ?? "";
  const selectedBsuid = selected?.bsuid;

  /* Mensagens em tempo real da conversa aberta (subcoleção "mensagens") */
  useEffect(() => {
    setLiveMessages([]);
    if (!selectedKey) return;
    const unsubscribe = onSnapshot(
      query(collection(db, COLECOES.conversas, selectedKey, COLECOES.mensagens)),
      (snapshot) => {
        const items: NormalizedMessage[] = [];
        snapshot.docs.forEach((document, index) => {
          const message = messageFrom({ ...document.data(), id: document.id }, index, undefined, {
            id: `live-${document.id}`,
            messageId: firstText(record(document.data()).messageId, document.id) || undefined,
          });
          if (message) items.push(message);
        });
        items.sort((a, b) => (a.at?.getTime() || 0) - (b.at?.getTime() || 0));
        setLiveMessages(items.map((item, index) => ({ ...item, sequence: index })));
      },
      (snapshotError) => {
        console.error("Erro ao ouvir mensagens da conversa:", snapshotError);
        setLiveMessages([]);
      },
    );
    return unsubscribe;
  }, [selectedKey]);

  /* Histórico do agente da Meta (opcional) */
  useEffect(() => {
    let cancelled = false;
    setMetaItems([]);
    setMetaError("");
    if (!selectedKey || !ENDPOINTS.metaTurns) return;
    setMetaLoading(true);
    loadConversationTurns(selectedPhone, selectedBsuid)
      .then((turns) => {
        if (!cancelled) setMetaItems(turnTimeline(turns));
      })
      .catch((reason: unknown) => {
        if (cancelled) return;
        console.error("Erro ao carregar Conversation Turns:", reason);
        setMetaError("O histórico do agente da Meta não pôde ser carregado agora. As mensagens do Firestore continuam em tempo real.");
      })
      .finally(() => {
        if (!cancelled) setMetaLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [selectedKey, selectedPhone, selectedBsuid]);

  const timeline = useMemo(
    () => (selected ? consolidate(liveMessages, selected.messages, selected.activities, metaItems) : []),
    [selected, liveMessages, metaItems],
  );

  const groupedTimeline = useMemo(() => {
    const groups: Array<{ date: string; items: TimelineItem[] }> = [];
    timeline.forEach((item) => {
      const date = formatDate(item.at) || "Data não informada";
      const previous = groups[groups.length - 1];
      if (!previous || previous.date !== date) groups.push({ date, items: [item] });
      else previous.items.push(item);
    });
    return groups;
  }, [timeline]);

  /* Rola para a última mensagem */
  useEffect(() => {
    const node = messagesRef.current;
    if (node) node.scrollTop = node.scrollHeight;
  }, [timeline.length, selectedKey]);

  const toggleHuman = useCallback(async () => {
    if (!selected || changingMode) return;
    setChangingMode(true);
    setSendError("");
    try {
      const response = await fetch(ENDPOINTS.control, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ numero: selected.phone, acao: selected.human ? "ia" : "humano" }),
      });
      if (!response.ok) setSendError("Não foi possível alterar o modo de atendimento agora.");
    } catch (reason) {
      console.error("Erro ao alterar o modo de atendimento:", reason);
      setSendError("Não foi possível alterar o modo de atendimento agora.");
    } finally {
      setChangingMode(false);
    }
  }, [selected, changingMode]);

  const sendMessage = useCallback(async () => {
    if (!selected || !draft.trim() || sending || !selected.human) return;
    setSending(true);
    setSendError("");
    try {
      const response = await fetch(ENDPOINTS.send, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ numero: selected.phone, mensagem: draft.trim() }),
      });
      if (response.ok) setDraft("");
      else setSendError("A mensagem não foi enviada. Confirme se o atendimento está com você.");
    } catch (reason) {
      console.error("Erro ao enviar mensagem:", reason);
      setSendError("A mensagem não foi enviada. Tente novamente.");
    } finally {
      setSending(false);
    }
  }, [selected, draft, sending]);

  const alert = error || sendError || metaError;

  return (
    <>
      {alert && (
        <div className="wa-alert">
          <AlertCircle size={15} />
          {alert}
        </div>
      )}
      <div className="wa-surface wa-chat">
        <aside className="wa-list">
          <div className="wa-list-head">
            <div className="wa-section-heading">
              <div>
                <h2>Conversas</h2>
                <p>Atendimento Águia Express</p>
              </div>
              <button type="button" className="wa-icon-button" title="Atualizar" onClick={onRefresh}>
                <RefreshCw size={14} />
              </button>
            </div>
            <div className="wa-search">
              <Search size={14} />
              <input
                value={queryText}
                onChange={(event) => setQueryText(event.target.value)}
                placeholder="Pesquisar conversa..."
              />
            </div>
          </div>
          <div className="wa-list-body">
            {loading ? (
              <div className="wa-loading">
                <LoaderCircle size={20} />
              </div>
            ) : filtered.length === 0 ? (
              emptyState(<MessageCircle size={20} />, "Nenhuma conversa encontrada", "As conversas do WhatsApp aparecerão aqui em tempo real.")
            ) : (
              filtered.map((conversation) => (
                <button
                  type="button"
                  key={conversation.id}
                  className={`wa-conversation ${selected?.id === conversation.id ? "active" : ""}`}
                  onClick={() => setSelectedId(conversation.id)}
                >
                  <div className="wa-avatar">{initials(conversation.name)}</div>
                  <div className="wa-conversation-main">
                    <div className="wa-conversation-top">
                      <span className="wa-name">{conversation.name}</span>
                      <span className="wa-time">{formatRelativeDate(conversation.updatedAt)}</span>
                    </div>
                    <div className="wa-phone">{formatPhone(conversation.phone) || "Telefone não informado"}</div>
                    <div className="wa-preview">{conversation.lastText || "Sem mensagens de texto"}</div>
                    <div className="wa-list-meta">
                      <span className={`wa-pill ${conversation.human ? "human" : "ai"}`}>
                        {conversation.human ? "Atendimento humano" : "IA ativa"}
                      </span>
                      {conversation.unread > 0 && <span className="wa-unread">{conversation.unread}</span>}
                    </div>
                  </div>
                </button>
              ))
            )}
          </div>
        </aside>

        <section className="wa-chat-main">
          {!selected ? (
            emptyState(<MessageCircle size={21} />, "Selecione uma conversa", "Escolha um cliente na lista para acompanhar o atendimento.")
          ) : (
            <>
              <header className="wa-chat-head">
                <div className="wa-person">
                  <div className="wa-person-avatar">
                    <UserRound size={19} />
                  </div>
                  <div>
                    <h2>{selected.name}</h2>
                    <p>{formatPhone(selected.phone) || "Telefone não informado"} · Meta Business Agent</p>
                  </div>
                </div>
                <div className="wa-head-actions">
                  <div className={`wa-automation ${selected.human ? "human" : ""}`}>
                    <span className="wa-automation-dot" />
                    {selected.human ? "Atendimento humano" : "Meta Business Agent"}
                  </div>
                  <button type="button" className="wa-takeover" disabled={changingMode} onClick={() => void toggleHuman()}>
                    {changingMode ? "Atualizando..." : selected.human ? "Devolver à IA" : "Assumir atendimento"}
                  </button>
                </div>
              </header>

              <div className="wa-messages" ref={messagesRef}>
                <div className="wa-thread">
                  {metaLoading && groupedTimeline.length === 0 && (
                    <div className="wa-loading">
                      <LoaderCircle size={20} />
                    </div>
                  )}
                  {!metaLoading && groupedTimeline.length === 0 &&
                    emptyState(<MessageCircle size={20} />, "Sem mensagens ainda", "Assim que o cliente ou o agente falar, a mensagem aparece aqui.")}
                  {groupedTimeline.map((group) => (
                    <div key={group.date}>
                      <div className="wa-date">{group.date}</div>
                      {group.items.map((item) =>
                        item.kind === "message" ? (
                          <div key={item.id} className={`wa-message-row ${item.message.role}`}>
                            <div className={`wa-bubble ${item.message.role}`}>
                              <div className="wa-role">
                                {item.message.role === "assistente" ? (
                                  <>
                                    <Bot size={11} />
                                    {item.message.human ? "Atendimento humano" : "Meta Business Agent"}
                                  </>
                                ) : (
                                  <>
                                    <UserRound size={11} />
                                    Cliente
                                  </>
                                )}
                              </div>
                              {item.message.imageUrl && (
                                <img
                                  className="wa-message-image"
                                  src={item.message.imageUrl}
                                  alt="Imagem enviada na conversa"
                                  onClick={() => setImage(item.message.imageUrl || "")}
                                />
                              )}
                              {item.message.text && <div className="wa-message-text">{item.message.text}</div>}
                              <div className="wa-message-time">{formatTime(item.message.at)}</div>
                            </div>
                          </div>
                        ) : (
                          <details className="wa-activity" key={item.id}>
                            <summary>
                              <Wrench size={13} /> Atividade da IA: {item.activity.name}
                              <span className="wa-activity-status">{item.activity.status || ""}</span>
                              <ChevronDown size={13} />
                            </summary>
                            <div className="wa-activity-body">
                              {item.activity.input && (
                                <>
                                  <span className="wa-activity-label">Entrada</span>
                                  {item.activity.input}
                                </>
                              )}
                              {item.activity.output && (
                                <>
                                  <span className="wa-activity-label">Resultado</span>
                                  {item.activity.output}
                                </>
                              )}
                            </div>
                          </details>
                        ),
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {selected.human ? (
                <div className="wa-compose">
                  <textarea
                    value={draft}
                    onChange={(event) => setDraft(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" && !event.shiftKey) {
                        event.preventDefault();
                        void sendMessage();
                      }
                    }}
                    placeholder="Digite uma mensagem..."
                  />
                  <button type="button" className="wa-send" disabled={!draft.trim() || sending} onClick={() => void sendMessage()}>
                    {sending ? <LoaderCircle size={16} /> : <Send size={16} />}
                  </button>
                </div>
              ) : (
                <div className="wa-compose-note">Assuma o atendimento para enviar uma mensagem manual pelo site.</div>
              )}
            </>
          )}
        </section>
      </div>

      {image && (
        <div className="wa-modal-backdrop" onClick={() => setImage("")}>
          <div className="wa-modal">
            <button type="button" className="wa-modal-close" onClick={() => setImage("")}>
              <X size={16} />
            </button>
            <img src={image} alt="Imagem ampliada da conversa" />
          </div>
        </div>
      )}
    </>
  );
}

/* ============================================================
 * CADASTROS
 * ============================================================ */

function RegisterView({ items, type }: { items: RegisterItem[]; type: "colaboradores" | "parceiros" }) {
  const [queryText, setQueryText] = useState("");
  const [selectedId, setSelectedId] = useState("");
  const partner = type === "parceiros";
  const filtered = useMemo(() => {
    const term = queryText.trim().toLowerCase();
    if (!term) return items;
    return items.filter((item) => `${item.title} ${item.subtitle} ${item.status || ""}`.toLowerCase().includes(term));
  }, [items, queryText]);
  const selected = filtered.find((item) => item.id === selectedId) || filtered[0] || null;

  return (
    <div className="wa-surface wa-register">
      <aside className="wa-register-list">
        <div className="wa-register-header">
          <div className="wa-section-heading">
            <div>
              <h2>{partner ? "Parceiros" : "Colaboradores"}</h2>
              <p>Cadastros recebidos pelo WhatsApp</p>
            </div>
          </div>
          <div className="wa-search">
            <Search size={14} />
            <input value={queryText} onChange={(event) => setQueryText(event.target.value)} placeholder="Pesquisar..." />
          </div>
        </div>
        <div className="wa-register-items">
          {filtered.length ? (
            filtered.map((item) => (
              <button
                type="button"
                key={item.id}
                className={`wa-register-item ${selected?.id === item.id ? "active" : ""}`}
                onClick={() => setSelectedId(item.id)}
              >
                <div className="wa-register-avatar">{partner ? <Building2 size={16} /> : <UsersRound size={16} />}</div>
                <div>
                  <div className="wa-register-title">{item.title}</div>
                  <div className="wa-register-subtitle">{item.subtitle}</div>
                </div>
              </button>
            ))
          ) : (
            emptyState(
              partner ? <Building2 size={20} /> : <UsersRound size={20} />,
              `Nenhum ${partner ? "parceiro" : "colaborador"} encontrado`,
              "Os cadastros feitos pelo WhatsApp aparecem aqui.",
            )
          )}
        </div>
      </aside>
      <section className="wa-register-detail">
        {!selected ? (
          emptyState(
            partner ? <Building2 size={22} /> : <UsersRound size={22} />,
            `Selecione ${partner ? "um parceiro" : "um colaborador"}`,
            "Escolha um cadastro na lista para ver os detalhes.",
          )
        ) : (
          <>
            <div className="wa-detail-head">
              <div className="wa-detail-person">
                <div className="wa-detail-avatar">{partner ? <Building2 size={22} /> : <UsersRound size={22} />}</div>
                <div>
                  <h2>{selected.title}</h2>
                  <p>{selected.subtitle}</p>
                </div>
              </div>
              {selected.status && <span className="wa-status">{selected.status}</span>}
            </div>
            <div className="wa-detail-grid">
              {selected.details.map(([label, value]) => (
                <div className="wa-detail-card" key={`${label}-${value}`}>
                  <div className="wa-detail-label">{label.replace(/([A-Z])/g, " $1")}</div>
                  <div className="wa-detail-value">{value || "—"}</div>
                </div>
              ))}
            </div>
          </>
        )}
      </section>
    </div>
  );
}

/* ============================================================
 * CONTROLE DO META BUSINESS AGENT
 * ============================================================ */

function AgentView() {
  const [settings, setSettings] = useState<UnknownRecord>({});
  const [skills, setSkills] = useState<UnknownRecord[]>([]);
  const [faqs, setFaqs] = useState<UnknownRecord[]>([]);
  const [enabled, setEnabled] = useState(false);
  const [audience, setAudience] = useState("EVERYONE");
  const [handoffEnabled, setHandoffEnabled] = useState(true);
  const [handoffMessage, setHandoffMessage] = useState("");
  const [followupEnabled, setFollowupEnabled] = useState(false);
  const [followupSeconds, setFollowupSeconds] = useState("900");
  const [followupMessage, setFollowupMessage] = useState("");
  const [skillTitle, setSkillTitle] = useState("");
  const [skillDescription, setSkillDescription] = useState("");
  const [skillInstruction, setSkillInstruction] = useState("");
  const [faqQuestion, setFaqQuestion] = useState("");
  const [faqAnswer, setFaqAnswer] = useState("");
  const [testMessage, setTestMessage] = useState("");
  const [testResult, setTestResult] = useState("");
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState("");

  const loadAgent = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [settingsPayload, skillsPayload, faqPayload] = await Promise.all([
        agentRequest("settings"),
        agentRequest("skills"),
        agentRequest("faq"),
      ]);
      const nextSettings = payloadObject(settingsPayload);
      const handoff = record(nextSettings.handoff);
      const followup = record(nextSettings.followup);
      setSettings(nextSettings);
      setEnabled(nextSettings.enabled === true);
      setAudience(firstText(nextSettings.ai_audience) || "EVERYONE");
      setHandoffEnabled(handoff.enabled !== false);
      setHandoffMessage(firstText(handoff.message));
      setFollowupEnabled(followup.enabled === true);
      setFollowupSeconds(firstText(followup.followup_interval_in_seconds) || "900");
      setFollowupMessage(firstText(followup.message));
      setSkills(payloadList(skillsPayload));
      setFaqs(payloadList(faqPayload));
    } catch (reason) {
      console.error("Erro ao carregar a configuração do Meta Agent:", reason);
      setError(reason instanceof Error ? reason.message : "Não foi possível carregar a configuração do agente.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadAgent();
  }, [loadAgent]);

  const saveSettings = useCallback(async () => {
    setWorking(true);
    setError("");
    try {
      const payload = {
        enabled,
        ai_audience: audience,
        handoff: {
          enabled: handoffEnabled,
          message: handoffMessage,
          message_selection: "CUSTOM",
        },
        followup: {
          enabled: followupEnabled,
          followup_interval_in_seconds: Math.max(Number(followupSeconds) || 900, 60),
          message: followupMessage,
        },
      };
      const updated = payloadObject(await agentRequest("settings", "PUT", undefined, payload));
      setSettings(updated);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Não foi possível salvar as configurações.");
    } finally {
      setWorking(false);
    }
  }, [audience, enabled, followupEnabled, followupMessage, followupSeconds, handoffEnabled, handoffMessage]);

  const addSkill = useCallback(async () => {
    if (!skillTitle.trim() || !skillDescription.trim() || !skillInstruction.trim()) return;
    setWorking(true);
    setError("");
    try {
      await agentRequest("skills", "POST", undefined, {
        title: skillTitle.trim(),
        description: skillDescription.trim(),
        skill: skillInstruction.trim(),
      });
      setSkillTitle("");
      setSkillDescription("");
      setSkillInstruction("");
      setSkills(payloadList(await agentRequest("skills")));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Não foi possível criar a skill.");
    } finally {
      setWorking(false);
    }
  }, [skillDescription, skillInstruction, skillTitle]);

  const removeSkill = useCallback(async (item: UnknownRecord) => {
    const id = firstText(item.id, item.skill_id, item.skillId);
    if (!id) return;
    setWorking(true);
    try {
      await agentRequest("skills", "DELETE", id);
      setSkills((current) => current.filter((skill) => firstText(skill.id, skill.skill_id, skill.skillId) !== id));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Não foi possível excluir a skill.");
    } finally {
      setWorking(false);
    }
  }, []);

  const addFaq = useCallback(async () => {
    if (!faqQuestion.trim() || !faqAnswer.trim()) return;
    setWorking(true);
    setError("");
    try {
      await agentRequest("faq", "POST", undefined, {
        question: faqQuestion.trim(),
        answer: faqAnswer.trim(),
      });
      setFaqQuestion("");
      setFaqAnswer("");
      setFaqs(payloadList(await agentRequest("faq")));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Não foi possível criar o FAQ.");
    } finally {
      setWorking(false);
    }
  }, [faqAnswer, faqQuestion]);

  const removeFaq = useCallback(async (item: UnknownRecord) => {
    const id = firstText(item.id, item.faq_id, item.faqId);
    if (!id) return;
    setWorking(true);
    try {
      await agentRequest("faq", "DELETE", id);
      setFaqs((current) => current.filter((faq) => firstText(faq.id, faq.faq_id, faq.faqId) !== id));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Não foi possível excluir o FAQ.");
    } finally {
      setWorking(false);
    }
  }, []);

  const runTest = useCallback(async () => {
    if (!testMessage.trim()) return;
    setWorking(true);
    setTestResult("");
    setError("");
    try {
      const result = payloadObject(await agentRequest("test", "POST", undefined, { user_msg: testMessage.trim() }));
      setTestResult(firstText(result.agent_response, result.response) || JSON.stringify(result, null, 2));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Não foi possível executar o teste.");
    } finally {
      setWorking(false);
    }
  }, [testMessage]);

  return (
    <div className="wa-surface wa-agent">
      <div className="wa-agent-head">
        <div>
          <h2>Controle do Meta Business Agent</h2>
          <p>Configurações operacionais, comportamento, conhecimento e teste ficam no backend seguro. O navegador nunca recebe o token da Meta.</p>
        </div>
        <button type="button" className="wa-icon-button" title="Atualizar configuração" onClick={() => void loadAgent()} disabled={loading}>
          <RefreshCw size={14} />
        </button>
      </div>

      {error && <div className="wa-alert"><AlertCircle size={15} />{error}</div>}
      {loading ? (
        <div className="wa-loading"><LoaderCircle size={20} /></div>
      ) : (
        <div className="wa-agent-grid">
          <section className="wa-agent-card">
            <h3><Settings2 size={14} /> Configurações</h3>
            <p>Desativar o agente interrompe novas respostas automáticas. ALLOWLISTED_ONLY permite testar sem abrir o agente para todos.</p>
            <div className="wa-agent-form">
              <label className="wa-agent-check"><input type="checkbox" checked={enabled} onChange={(event) => setEnabled(event.target.checked)} /> Agente ativo</label>
              <div className="wa-agent-field">
                <label>Público</label>
                <select value={audience} onChange={(event) => setAudience(event.target.value)}>
                  <option value="EVERYONE">Todos</option>
                  <option value="ALLOWLISTED_ONLY">Somente allowlist</option>
                </select>
              </div>
              <label className="wa-agent-check"><input type="checkbox" checked={handoffEnabled} onChange={(event) => setHandoffEnabled(event.target.checked)} /> Handoff para humano</label>
              <div className="wa-agent-field"><label>Mensagem de handoff</label><textarea value={handoffMessage} onChange={(event) => setHandoffMessage(event.target.value)} /></div>
              <label className="wa-agent-check"><input type="checkbox" checked={followupEnabled} onChange={(event) => setFollowupEnabled(event.target.checked)} /> Follow-up automático</label>
              <div className="wa-agent-form two">
                <div className="wa-agent-field"><label>Intervalo (segundos)</label><input type="number" min="60" value={followupSeconds} onChange={(event) => setFollowupSeconds(event.target.value)} /></div>
                <div className="wa-agent-field"><label>Mensagem de follow-up</label><input value={followupMessage} onChange={(event) => setFollowupMessage(event.target.value)} /></div>
              </div>
            </div>
            <div className="wa-agent-actions"><button type="button" className="wa-agent-primary" disabled={working} onClick={() => void saveSettings()}>Salvar configurações</button></div>
            <div className="wa-agent-note">As configurações atuais foram carregadas de {Object.keys(settings).length ? "agent_config/settings" : "uma resposta vazia"}.</div>
          </section>

          <section className="wa-agent-card">
            <h3><Wrench size={14} /> Skills</h3>
            <p>Escreva condições claras em description e instruções ordenadas em skill. Evite duas skills conflitantes para o mesmo cenário.</p>
            <div className="wa-agent-form">
              <div className="wa-agent-field"><label>Título</label><input value={skillTitle} onChange={(event) => setSkillTitle(event.target.value)} placeholder="ex.: rastreamento de encomenda" /></div>
              <div className="wa-agent-field"><label>Quando se aplica</label><textarea value={skillDescription} onChange={(event) => setSkillDescription(event.target.value)} /></div>
              <div className="wa-agent-field"><label>O que o agente deve fazer</label><textarea value={skillInstruction} onChange={(event) => setSkillInstruction(event.target.value)} /></div>
            </div>
            <div className="wa-agent-actions"><button type="button" className="wa-agent-primary" disabled={working || !skillTitle.trim() || !skillDescription.trim() || !skillInstruction.trim()} onClick={() => void addSkill()}><Plus size={13} /> Adicionar skill</button></div>
            <div className="wa-agent-list">
              {skills.map((skill, index) => (
                <div className="wa-agent-list-item" key={firstText(skill.id, skill.skill_id) || `skill-${index}`}>
                  <div><strong>{firstText(skill.title, skill.name) || "Skill sem título"}</strong><p>{firstText(skill.description, skill.skill)}</p></div>
                  <button type="button" className="wa-agent-danger" disabled={working} title="Excluir skill" onClick={() => void removeSkill(skill)}><Trash2 size={13} /></button>
                </div>
              ))}
            </div>
          </section>

          <section className="wa-agent-card">
            <h3><MessageCircle size={14} /> FAQs</h3>
            <p>Respostas curtas e factuais para perguntas recorrentes dão ao agente uma fonte direta de conhecimento.</p>
            <div className="wa-agent-form">
              <div className="wa-agent-field"><label>Pergunta</label><input value={faqQuestion} onChange={(event) => setFaqQuestion(event.target.value)} /></div>
              <div className="wa-agent-field"><label>Resposta</label><textarea value={faqAnswer} onChange={(event) => setFaqAnswer(event.target.value)} /></div>
            </div>
            <div className="wa-agent-actions"><button type="button" className="wa-agent-primary" disabled={working || !faqQuestion.trim() || !faqAnswer.trim()} onClick={() => void addFaq()}><Plus size={13} /> Adicionar FAQ</button></div>
            <div className="wa-agent-list">
              {faqs.map((faq, index) => (
                <div className="wa-agent-list-item" key={firstText(faq.id, faq.faq_id) || `faq-${index}`}>
                  <div><strong>{firstText(faq.question) || "Pergunta sem texto"}</strong><p>{firstText(faq.answer)}</p></div>
                  <button type="button" className="wa-agent-danger" disabled={working} title="Excluir FAQ" onClick={() => void removeFaq(faq)}><Trash2 size={13} /></button>
                </div>
              ))}
            </div>
          </section>

          <section className="wa-agent-card">
            <h3><Bot size={14} /> Agent Test</h3>
            <p>Testa o pipeline completo, incluindo conhecimento, skills e conectores, sem enviar mensagem para um cliente real.</p>
            <div className="wa-agent-field"><label>Mensagem de teste</label><textarea value={testMessage} onChange={(event) => setTestMessage(event.target.value)} placeholder="ex.: Como faço para rastrear uma encomenda?" /></div>
            <div className="wa-agent-actions"><button type="button" className="wa-agent-primary" disabled={working || !testMessage.trim()} onClick={() => void runTest()}>Executar teste</button></div>
            {testResult && <div className="wa-agent-result">{testResult}</div>}
          </section>
        </div>
      )}
    </div>
  );
}

/* ============================================================
 * PÁGINA
 * ============================================================ */

export default function WhatsApp() {
  const [tab, setTab] = useState<Tab>("chat");
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [colaboradores, setColaboradores] = useState<RegisterItem[]>([]);
  const [parceiros, setParceiros] = useState<RegisterItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const [refreshToken, setRefreshToken] = useState(0);

  /* Conversas em tempo real */
  useEffect(() => {
    const unsubscribe = onSnapshot(
      query(collection(db, COLECOES.conversas)),
      (snapshot) => {
        const items = snapshot.docs
          .map((document) => conversationFrom(document.id, document.data()))
          .sort((a, b) => (b.updatedAt?.getTime() || 0) - (a.updatedAt?.getTime() || 0));
        setConversations(items);
        setLastUpdate(new Date());
        setLoading(false);
        setError("");
      },
      (snapshotError) => {
        console.error("Erro ao carregar as conversas:", snapshotError);
        setError("Não foi possível carregar as conversas agora.");
        setLoading(false);
      },
    );
    return unsubscribe;
  }, [refreshToken]);

  /* Cadastros em tempo real */
  useEffect(() => {
    const unsubscribeColaboradores = onSnapshot(
      query(collection(db, COLECOES.colaboradores)),
      (snapshot) => setColaboradores(snapshot.docs.map((document) => registerFrom(document.id, document.data(), "colaborador"))),
      (snapshotError) => console.error("Erro ao carregar colaboradores:", snapshotError),
    );
    const unsubscribeParceiros = onSnapshot(
      query(collection(db, COLECOES.parceiros)),
      (snapshot) => setParceiros(snapshot.docs.map((document) => registerFrom(document.id, document.data(), "parceiro"))),
      (snapshotError) => console.error("Erro ao carregar parceiros:", snapshotError),
    );
    return () => {
      unsubscribeColaboradores();
      unsubscribeParceiros();
    };
  }, [refreshToken]);

  const humanCount = conversations.filter((conversation) => conversation.human).length;

  return (
    <div className="wa-page">
      <style>{css}</style>
      <div className="wa-wrap">
        <header className="wa-hero">
          <div>
            <div className="wa-kicker">
              <span className="wa-kicker-dot" />
              Tempo real
            </div>
            <h1 className="wa-title">Atendimento WhatsApp</h1>
            <p className="wa-subtitle">Conversas do agente e dos clientes, atualizadas automaticamente.</p>
          </div>
          <div className="wa-metrics">
            <div className="wa-metric">
              <span className="wa-metric-label">Conversas</span>
              <span className="wa-metric-value">{conversations.length}</span>
            </div>
            <div className="wa-metric">
              <span className="wa-metric-label">Com humano</span>
              <span className="wa-metric-value">{humanCount}</span>
            </div>
            <div className="wa-metric">
              <span className="wa-metric-label">Cadastros</span>
              <span className="wa-metric-value">{colaboradores.length + parceiros.length}</span>
            </div>
            <div className="wa-metric">
              <span className="wa-metric-label">Atualizado</span>
              <span className="wa-metric-value small">{lastUpdate ? formatTime(lastUpdate) : "—"}</span>
            </div>
          </div>
        </header>

        <nav className="wa-tabs">
          <button type="button" className={`wa-tab ${tab === "chat" ? "active" : ""}`} onClick={() => setTab("chat")}>
            <MessageCircle size={13} /> Conversas <span className="wa-tab-count">{conversations.length}</span>
          </button>
          <button
            type="button"
            className={`wa-tab ${tab === "colaboradores" ? "active" : ""}`}
            onClick={() => setTab("colaboradores")}
          >
            <UsersRound size={13} /> Colaboradores <span className="wa-tab-count">{colaboradores.length}</span>
          </button>
          <button type="button" className={`wa-tab ${tab === "parceiros" ? "active" : ""}`} onClick={() => setTab("parceiros")}>
            <Building2 size={13} /> Parceiros <span className="wa-tab-count">{parceiros.length}</span>
          </button>
          <button type="button" className={`wa-tab ${tab === "agent" ? "active" : ""}`} onClick={() => setTab("agent")}>
            <Settings2 size={13} /> Agente
          </button>
        </nav>

        {tab === "chat" && (
          <ChatView
            conversations={conversations}
            error={error}
            loading={loading}
            onRefresh={() => setRefreshToken((value) => value + 1)}
          />
        )}
        {tab === "colaboradores" && <RegisterView items={colaboradores} type="colaboradores" />}
        {tab === "parceiros" && <RegisterView items={parceiros} type="parceiros" />}
        {tab === "agent" && <AgentView />}
      </div>
    </div>
  );
}
