import { useEffect, useMemo, useState } from "react";
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
} from "lucide-react";

type UnknownRecord = Record<string, unknown>;
type Tab = "chat" | "colaboradores" | "parceiros";
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
  messages: NormalizedMessage[];
  activities: ToolActivity[];
  turns: unknown[];
};

type RegisterItem = {
  id: string;
  title: string;
  subtitle: string;
  status?: string;
  details: Array<[string, string]>;
};

type ApiPayload = {
  conversations: Conversation[];
  colaboradores: RegisterItem[];
  parceiros: RegisterItem[];
};

type PageCursor = {
  value: string;
  parameter: "before" | "after" | "cursor" | "url";
};

const CONVERSATION_TURNS_ENDPOINT = "/insights/conversations/turns";

const palette = {
  ink: "#18211f",
  muted: "#71807b",
  line: "#dce6e1",
  canvas: "#f4f8f5",
  card: "#ffffff",
  forest: "#16483a",
  green: "#2f8f68",
  paleGreen: "#e6f4ec",
  yellow: "#f1c75b",
  paleYellow: "#fff7dc",
  red: "#b44d4d",
  paleRed: "#fdf0ef",
};

const css = `
  :root {
    color-scheme: light;
    font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    background: ${palette.canvas};
    color: ${palette.ink};
  }
  * { box-sizing: border-box; }
  body { margin: 0; min-width: 320px; background: ${palette.canvas}; }
  button, input, textarea { font: inherit; }
  button { cursor: pointer; }
  .wa-page { min-height: 100vh; padding: 28px clamp(16px, 3vw, 42px) 34px; }
  .wa-wrap { width: min(1480px, 100%); margin: 0 auto; }
  .wa-hero { display: flex; align-items: flex-start; justify-content: space-between; gap: 24px; margin-bottom: 24px; }
  .wa-kicker { display: flex; align-items: center; gap: 9px; color: ${palette.green}; font-size: 11px; font-weight: 800; letter-spacing: .11em; text-transform: uppercase; }
  .wa-kicker-dot { width: 7px; height: 7px; border-radius: 50%; background: ${palette.green}; box-shadow: 0 0 0 4px ${palette.paleGreen}; }
  .wa-title { margin: 10px 0 5px; color: ${palette.ink}; font-size: clamp(28px, 4vw, 42px); line-height: 1.05; letter-spacing: -.05em; }
  .wa-subtitle { margin: 0; color: ${palette.muted}; font-size: 14px; }
  .wa-metrics { display: grid; grid-template-columns: repeat(4, minmax(112px, 1fr)); gap: 10px; }
  .wa-metric { min-width: 118px; padding: 13px 15px; border: 1px solid ${palette.line}; border-radius: 14px; background: rgba(255,255,255,.82); box-shadow: 0 8px 24px rgba(28, 61, 48, .04); }
  .wa-metric-label { display: block; color: ${palette.muted}; font-size: 10px; font-weight: 700; letter-spacing: .04em; text-transform: uppercase; }
  .wa-metric-value { display: block; margin-top: 7px; color: ${palette.ink}; font-size: 20px; font-weight: 800; letter-spacing: -.04em; }
  .wa-metric-value.small { font-size: 13px; letter-spacing: -.01em; }
  .wa-tabs { display: flex; align-items: center; gap: 4px; width: fit-content; padding: 4px; margin-bottom: 14px; border: 1px solid ${palette.line}; border-radius: 13px; background: rgba(255,255,255,.82); }
  .wa-tab { display: inline-flex; align-items: center; gap: 8px; height: 36px; padding: 0 15px; border: 0; border-radius: 9px; color: ${palette.muted}; background: transparent; font-size: 11px; font-weight: 800; transition: .18s ease; }
  .wa-tab:hover { color: ${palette.ink}; background: #eef5f0; }
  .wa-tab.active { color: #fff; background: ${palette.forest}; box-shadow: 0 4px 10px rgba(22,72,58,.18); }
  .wa-tab-count { display: inline-grid; place-items: center; min-width: 19px; height: 19px; padding: 0 5px; border-radius: 20px; color: ${palette.muted}; background: #edf3ef; font-size: 9px; }
  .wa-tab.active .wa-tab-count { color: ${palette.forest}; background: #fff; }
  .wa-surface { min-height: 620px; overflow: hidden; border: 1px solid ${palette.line}; border-radius: 18px; background: ${palette.card}; box-shadow: 0 18px 50px rgba(32, 73, 57, .07); }
  .wa-chat { display: grid; grid-template-columns: 332px minmax(0, 1fr); min-height: 620px; }
  .wa-list { min-width: 0; border-right: 1px solid ${palette.line}; background: #fbfdfb; }
  .wa-list-head { padding: 20px 18px 16px; border-bottom: 1px solid ${palette.line}; }
  .wa-section-heading { display: flex; align-items: center; justify-content: space-between; gap: 10px; margin-bottom: 15px; }
  .wa-section-heading h2 { margin: 0; font-size: 16px; letter-spacing: -.03em; }
  .wa-section-heading p { margin: 3px 0 0; color: ${palette.muted}; font-size: 11px; }
  .wa-icon-button { display: inline-grid; place-items: center; width: 30px; height: 30px; border: 1px solid ${palette.line}; border-radius: 9px; color: ${palette.muted}; background: #fff; }
  .wa-icon-button:hover { color: ${palette.forest}; border-color: #b9d4c5; background: ${palette.paleGreen}; }
  .wa-search { position: relative; }
  .wa-search svg { position: absolute; top: 11px; left: 11px; color: #98a9a1; }
  .wa-search input { width: 100%; height: 36px; padding: 0 12px 0 34px; border: 1px solid ${palette.line}; border-radius: 10px; outline: none; color: ${palette.ink}; background: #fff; font-size: 11px; }
  .wa-search input:focus { border-color: ${palette.green}; box-shadow: 0 0 0 3px rgba(47,143,104,.1); }
  .wa-list-body { max-height: 550px; overflow: auto; }
  .wa-conversation { display: flex; align-items: flex-start; gap: 11px; width: 100%; padding: 15px 16px; border: 0; border-bottom: 1px solid #edf3ef; text-align: left; background: transparent; transition: .18s ease; }
  .wa-conversation:hover { background: #f1f8f3; }
  .wa-conversation.active { background: ${palette.paleGreen}; box-shadow: inset 3px 0 ${palette.green}; }
  .wa-avatar { display: inline-grid; flex: 0 0 37px; place-items: center; width: 37px; height: 37px; border-radius: 50%; color: ${palette.forest}; background: #dceee4; font-size: 13px; font-weight: 800; }
  .wa-conversation-main { min-width: 0; flex: 1; }
  .wa-conversation-top { display: flex; align-items: baseline; justify-content: space-between; gap: 8px; }
  .wa-name { overflow: hidden; color: ${palette.ink}; font-size: 12px; font-weight: 800; white-space: nowrap; text-overflow: ellipsis; }
  .wa-time { flex: 0 0 auto; color: #8a9b93; font-size: 9px; }
  .wa-phone { margin-top: 3px; color: ${palette.muted}; font-size: 10px; }
  .wa-preview { overflow: hidden; margin-top: 7px; color: #63746c; font-size: 10px; line-height: 1.35; white-space: nowrap; text-overflow: ellipsis; }
  .wa-list-meta { display: flex; align-items: center; gap: 7px; margin-top: 8px; }
  .wa-pill { display: inline-flex; align-items: center; gap: 4px; padding: 3px 7px; border-radius: 20px; font-size: 9px; font-weight: 800; }
  .wa-pill.ai { color: #276e52; background: #dff3e8; }
  .wa-pill.human { color: #8b6715; background: ${palette.paleYellow}; }
  .wa-unread { display: inline-grid; place-items: center; min-width: 18px; height: 18px; padding: 0 5px; border-radius: 20px; color: #fff; background: ${palette.green}; font-size: 9px; font-weight: 800; }
  .wa-chat-main { display: flex; min-width: 0; flex-direction: column; background: #fff; }
  .wa-chat-head { display: flex; align-items: center; justify-content: space-between; gap: 16px; padding: 17px 22px; border-bottom: 1px solid ${palette.line}; }
  .wa-person { display: flex; align-items: center; gap: 11px; min-width: 0; }
  .wa-person-avatar { display: inline-grid; flex: 0 0 40px; place-items: center; width: 40px; height: 40px; border-radius: 12px; color: #fff; background: ${palette.forest}; }
  .wa-person h2 { overflow: hidden; margin: 0; font-size: 15px; letter-spacing: -.03em; white-space: nowrap; text-overflow: ellipsis; }
  .wa-person p { margin: 4px 0 0; color: ${palette.muted}; font-size: 10px; }
  .wa-automation { display: flex; align-items: center; gap: 7px; padding: 8px 10px; border: 1px solid #cde5d6; border-radius: 10px; color: #2c7656; background: #f2fbf5; font-size: 10px; font-weight: 800; }
  .wa-automation.human { border-color: #efdca9; color: #8b6715; background: #fffbef; }
  .wa-automation-dot { width: 7px; height: 7px; border-radius: 50%; background: currentColor; }
  .wa-head-actions { display: flex; align-items: center; gap: 8px; }
  .wa-takeover { height: 31px; padding: 0 10px; border: 0; border-radius: 8px; color: #fff; background: ${palette.forest}; font-size: 10px; font-weight: 800; }
  .wa-takeover:hover { background: #24674f; }
  .wa-takeover:disabled { cursor: wait; opacity: .6; }
  .wa-messages { flex: 1; min-height: 0; max-height: 510px; overflow: auto; padding: 22px clamp(16px, 4vw, 48px); background: linear-gradient(135deg, #f8fbf8 0%, #f2f7f3 100%); }
  .wa-thread { width: min(780px, 100%); margin: 0 auto; }
  .wa-date { display: flex; align-items: center; gap: 9px; margin: 3px 0 16px; color: #82938a; font-size: 9px; font-weight: 800; letter-spacing: .09em; text-transform: uppercase; }
  .wa-date:before, .wa-date:after { content: ""; height: 1px; flex: 1; background: ${palette.line}; }
  .wa-message-row { display: flex; margin: 8px 0; }
  .wa-message-row.client { justify-content: flex-start; }
  .wa-message-row.assistant { justify-content: flex-end; }
  .wa-bubble { max-width: min(75%, 520px); padding: 11px 13px 9px; border: 1px solid ${palette.line}; border-radius: 14px; background: #fff; box-shadow: 0 3px 12px rgba(35,69,53,.04); }
  .wa-bubble.assistant { border-color: ${palette.forest}; color: #fff; background: ${palette.forest}; border-bottom-right-radius: 4px; }
  .wa-bubble.client { border-bottom-left-radius: 4px; }
  .wa-role { display: flex; align-items: center; gap: 6px; margin-bottom: 6px; color: #84938c; font-size: 9px; font-weight: 800; }
  .wa-bubble.assistant .wa-role { color: #a6d2bb; }
  .wa-message-text { white-space: pre-wrap; word-break: break-word; font-size: 12px; line-height: 1.55; }
  .wa-message-time { margin-top: 6px; color: #91a29a; font-size: 9px; text-align: right; }
  .wa-bubble.assistant .wa-message-time { color: #acd1bd; }
  .wa-message-image { display: block; max-width: 260px; max-height: 230px; margin-bottom: 8px; border-radius: 9px; cursor: zoom-in; object-fit: contain; }
  .wa-activity { margin: 13px auto; border: 1px solid #e5e7d6; border-radius: 12px; color: #6e704f; background: rgba(255,255,255,.7); font-size: 10px; }
  .wa-activity summary { display: flex; align-items: center; gap: 7px; padding: 10px 12px; cursor: pointer; list-style: none; font-weight: 800; }
  .wa-activity summary::-webkit-details-marker { display: none; }
  .wa-activity-body { padding: 0 12px 11px 34px; color: #747766; line-height: 1.5; white-space: pre-wrap; word-break: break-word; }
  .wa-activity-label { display: block; margin-top: 5px; color: #9a9b7d; font-size: 9px; font-weight: 800; text-transform: uppercase; }
  .wa-activity-status { margin-left: auto; color: #82938a; font-size: 9px; text-transform: uppercase; }
  .wa-compose { display: flex; align-items: flex-end; gap: 9px; padding: 12px 16px; border-top: 1px solid ${palette.line}; background: #fff; }
  .wa-compose textarea { min-height: 41px; max-height: 100px; resize: vertical; flex: 1; padding: 11px 12px; border: 1px solid ${palette.line}; border-radius: 10px; outline: none; color: ${palette.ink}; background: #fbfdfb; font-size: 11px; }
  .wa-compose textarea:focus { border-color: ${palette.green}; box-shadow: 0 0 0 3px rgba(47,143,104,.1); }
  .wa-send { display: inline-grid; place-items: center; width: 41px; height: 41px; border: 0; border-radius: 10px; color: #fff; background: ${palette.forest}; }
  .wa-send:hover { background: #24674f; }
  .wa-send:disabled { cursor: not-allowed; opacity: .4; }
  .wa-compose-note { padding: 0 16px 11px; color: #8b9992; background: #fff; font-size: 9px; }
  .wa-empty, .wa-loading { display: grid; place-items: center; min-height: 270px; padding: 28px; color: ${palette.muted}; text-align: center; }
  .wa-empty-icon { display: inline-grid; place-items: center; width: 46px; height: 46px; margin: 0 auto 12px; border-radius: 15px; color: ${palette.green}; background: ${palette.paleGreen}; }
  .wa-empty strong { display: block; color: ${palette.ink}; font-size: 13px; }
  .wa-empty p { max-width: 340px; margin: 6px auto 0; font-size: 11px; line-height: 1.5; }
  .wa-alert { display: flex; align-items: center; gap: 8px; margin: 0 0 12px; padding: 10px 12px; border: 1px solid #f2d3d0; border-radius: 10px; color: ${palette.red}; background: ${palette.paleRed}; font-size: 11px; }
  .wa-register { display: grid; grid-template-columns: 340px minmax(0, 1fr); min-height: 620px; }
  .wa-register-list { border-right: 1px solid ${palette.line}; background: #fbfdfb; }
  .wa-register-header { padding: 20px 18px 16px; border-bottom: 1px solid ${palette.line}; }
  .wa-register-items { max-height: 550px; overflow: auto; }
  .wa-register-item { display: flex; align-items: center; gap: 11px; width: 100%; padding: 14px 17px; border: 0; border-bottom: 1px solid #edf3ef; text-align: left; background: transparent; }
  .wa-register-item:hover, .wa-register-item.active { background: ${palette.paleGreen}; }
  .wa-register-item.active { box-shadow: inset 3px 0 ${palette.green}; }
  .wa-register-avatar { display: inline-grid; place-items: center; flex: 0 0 35px; width: 35px; height: 35px; border-radius: 10px; color: ${palette.forest}; background: #dceee4; }
  .wa-register-title { overflow: hidden; color: ${palette.ink}; font-size: 12px; font-weight: 800; white-space: nowrap; text-overflow: ellipsis; }
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
  .wa-detail-value { margin-top: 7px; color: ${palette.ink}; font-size: 12px; word-break: break-word; }
  .wa-modal-backdrop { position: fixed; z-index: 10; inset: 0; display: grid; place-items: center; padding: 20px; background: rgba(18,37,30,.7); }
  .wa-modal { position: relative; max-width: min(900px, 95vw); max-height: 90vh; }
  .wa-modal img { display: block; max-width: 100%; max-height: 84vh; border-radius: 12px; }
  .wa-modal-close { position: absolute; top: -12px; right: -12px; display: grid; place-items: center; width: 30px; height: 30px; border: 0; border-radius: 50%; color: #fff; background: ${palette.ink}; }
  @media (max-width: 950px) {
    .wa-hero { flex-direction: column; }
    .wa-metrics { width: 100%; }
    .wa-chat, .wa-register { grid-template-columns: 285px minmax(0, 1fr); }
    .wa-bubble { max-width: 84%; }
  }
  @media (max-width: 680px) {
    .wa-page { padding: 20px 12px 22px; }
    .wa-metrics { grid-template-columns: repeat(2, 1fr); }
    .wa-metric { min-width: 0; }
    .wa-tabs { width: 100%; overflow: auto; }
    .wa-tab { flex: 1 0 auto; justify-content: center; padding: 0 11px; }
    .wa-surface { min-height: 0; }
    .wa-chat, .wa-register { display: block; min-height: 0; }
    .wa-list, .wa-register-list { border-right: 0; border-bottom: 1px solid ${palette.line}; }
    .wa-list-body, .wa-register-items { max-height: 260px; }
    .wa-chat-main { min-height: 570px; }
    .wa-chat-head { align-items: flex-start; flex-direction: column; }
    .wa-head-actions { width: 100%; justify-content: space-between; }
    .wa-messages { max-height: none; }
    .wa-register-detail { min-height: 380px; }
    .wa-detail-grid { grid-template-columns: 1fr; }
  }
`;

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
    const milliseconds = value < 10_000_000_000 ? value * 1000 : value;
    const date = new Date(milliseconds);
    return Number.isNaN(date.getTime()) ? null : date;
  }
  if (typeof value === "object") {
    const item = record(value);
    if (typeof item.toDate === "function") return dateValue((item.toDate as () => unknown)());
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
  if (!value) return "Sem data";
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

function mediaUrl(item: UnknownRecord): string {
  const candidate = firstText(item.url, item.mediaUrl, item.imagemUrl, item.imageUrl, item.fotoUrl, item.media, item.imagem, item.foto);
  return /^https?:\/\//i.test(candidate) ? candidate : "";
}

function roleFor(item: UnknownRecord): Role {
  const role = firstText(item.papel, item.role, item.sender, item.origem, item.author).toLowerCase();
  return ["assistente", "assistant", "ia", "bot", "meta", "agent", "llm"].some((value) => role.includes(value)) ? "assistente" : "cliente";
}

function messageFrom(
  raw: unknown,
  index: number,
  forcedRole?: Role,
  options?: Partial<Pick<NormalizedMessage, "source" | "turnId" | "messageId" | "at" | "sequence">>,
): NormalizedMessage | null {
  const item = record(raw);
  const preview = record(item.content);
  const directValue = typeof raw === "string" || typeof raw === "number" ? String(raw) : "";
  const contentValue = typeof item.content === "string" || typeof item.content === "number" ? String(item.content) : "";
  const value = firstText(directValue, item.texto, item.text, item.message, item.body, item.llm_output_preview, item.llmOutputPreview, contentValue, preview.text, preview.value);
  const image = mediaUrl(item);
  if (!value && !image) return null;
  const at = options?.at ?? dateValue(item.em ?? item.timestamp ?? item.createdAt ?? item.created_at);
  return {
    id: firstText(item.id, item.messageId, item.message_id, options?.messageId, `message-${index}`),
    messageId: options?.messageId || firstText(item.message_id, item.messageId) || undefined,
    turnId: options?.turnId,
    role: forcedRole || roleFor(item),
    text: value,
    at,
    imageUrl: image || undefined,
    type: firstText(item.tipo, item.type, item.mimeType) || undefined,
    human: firstText(item.origem, item.source).toLowerCase() === "humano",
    source: options?.source || "firestore",
    sequence: options?.sequence ?? index,
  };
}

function toolFrom(
  raw: unknown,
  index: number,
  options?: Partial<Pick<ToolActivity, "source" | "turnId" | "at" | "sequence">>,
): ToolActivity | null {
  const item = record(raw);
  const name = firstText(item.tool_name, item.toolName, item.name, item.ferramenta);
  const input = text(item.tool_input ?? item.toolInput ?? item.entrada);
  const output = text(item.tool_output ?? item.toolOutput ?? item.resultado);
  if (!name && !input && !output) return null;
  return {
    id: firstText(item.id, item.step_id, `activity-${index}`),
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

function normalizeConversation(raw: unknown, index: number): Conversation {
  const item = record(raw);
  const messages: NormalizedMessage[] = [];
  const activities: ToolActivity[] = [];
  const rawMessages = item.mensagens ?? item.messages;
  if (Array.isArray(rawMessages)) rawMessages.forEach((value, messageIndex) => {
    const message = messageFrom(value, messageIndex);
    if (message) messages.push(message);
  });
  const rawSteps = item.steps;
  if (Array.isArray(rawSteps)) rawSteps.forEach((step, stepIndex) => {
    const activity = toolFrom(step, stepIndex);
    if (activity) activities.push(activity);
  });
  const updatedAt = dateValue(item.atualizadoEm ?? item.updatedAt ?? item.lastMessageAt ?? item.timestamp) ||
    messages.reduce<Date | null>((latest, message) => !latest || (message.at && message.at > latest) ? message.at : latest, null);
  const unreadValue = item.naoLidas ?? item.unreadCount ?? item.unread;
  const unread = typeof unreadValue === "boolean" ? (unreadValue ? 1 : 0) : Number(unreadValue) || 0;
  return {
    id: firstText(item.id, item.numero, item.phone, item.conversation_id, `conversation-${index}`),
    name: firstText(item.nome, item.name, item.customerName) || "Cliente",
    phone: firstText(item.numero, item.phone, item.user_phone_number, item.telefone),
    bsuid: firstText(item.bsuid, item.user_bsuid, item.business_scoped_user_id) || undefined,
    status: firstText(item.status, item.conversationStatus) || "Ativa",
    updatedAt,
    unread,
    human: item.atendimentoHumano === true || firstText(item.modo, item.mode).toLowerCase() === "humano",
    messages,
    activities,
    turns: Array.isArray(item.turns) ? item.turns : Array.isArray(item.turnos) ? item.turnos : [],
  };
}

function normalizeRegister(raw: unknown, kind: "colaborador" | "parceiro", index: number): RegisterItem {
  const item = record(raw);
  const isPartner = kind === "parceiro";
  const title = firstText(isPartner ? item.nomeEmpresa : item.nomeCompleto, item.nome, item.name) || (isPartner ? "Empresa" : "Colaborador");
  const subtitle = firstText(isPartner ? item.nomeResponsavel : item.regiaoNome, item.numeroWhatsApp, item.telefone, item.cidadeRegiao) || "Cadastro";
  const details = Object.entries(item)
    .filter(([key, value]) => !["id", "mensagens"].includes(key) && (typeof value === "string" || typeof value === "number" || typeof value === "boolean"))
    .slice(0, 12)
    .map(([key, value]) => [key, String(value)] as [string, string]);
  return { id: firstText(item.id, item.numero, `register-${kind}-${index}`), title, subtitle, status: text(item.status) || undefined, details };
}

function initials(name: string): string {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join("").toUpperCase() || "C";
}

function dedupeMessages(messages: NormalizedMessage[]): NormalizedMessage[] {
  const seen = new Set<string>();
  return messages.filter((message) => {
    const fallback = `${message.turnId || ""}|${message.at?.getTime() || 0}|${message.text}|${message.imageUrl || ""}`;
    const key = message.messageId ? `message:${message.messageId}:${message.role}` : `fallback:${message.role}:${fallback}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function dedupeActivities(activities: ToolActivity[]): ToolActivity[] {
  const seen = new Set<string>();
  return activities.filter((activity) => {
    const fallback = `${activity.turnId || ""}|${activity.at?.getTime() || 0}|${activity.name}|${activity.input || ""}|${activity.output || ""}`;
    const key = activity.turnId && activity.id ? `step:${activity.turnId}:${activity.id}` : `fallback:${fallback}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function turnList(value: unknown): unknown[] {
  if (Array.isArray(value)) return value;
  const root = record(value);
  if (Array.isArray(root.turns)) return root.turns;
  if (Array.isArray(root.data)) return root.data;
  if (Array.isArray(root.results)) return root.results;
  return [];
}

function cursorFrom(value: unknown): PageCursor | null {
  if (typeof value === "string") return { value, parameter: "url" };
  if (!value || typeof value !== "object") return null;
  const item = record(value);
  if (text(item.url)) return { value: text(item.url), parameter: "url" };
  if (text(item.before)) return { value: text(item.before), parameter: "before" };
  if (text(item.after)) return { value: text(item.after), parameter: "after" };
  if (text(item.cursor)) return { value: text(item.cursor), parameter: "cursor" };
  if (text(item.next)) return cursorFrom(item.next);
  return null;
}

function nextCursor(value: unknown): PageCursor | null {
  const root = record(value);
  const paging = record(root.paging);
  return cursorFrom(root.next) || cursorFrom(paging.next) || cursorFrom(root.pagination && record(root.pagination).next);
}

function queryWithCursor(base: URLSearchParams, cursor: PageCursor | null): URLSearchParams {
  if (!cursor) return base;
  if (cursor.parameter !== "url") {
    base.set(cursor.parameter, cursor.value);
    return base;
  }
  try {
    const parsed = new URL(cursor.value, window.location.origin);
    parsed.searchParams.forEach((value, key) => base.set(key, value));
  } catch {
    base.set("before", cursor.value);
  }
  return base;
}

async function loadConversationTurns(phone: string, bsuid?: string): Promise<unknown[]> {
  const normalizedPhone = normalizePhone(phone);
  if (!normalizedPhone && !bsuid) return [];
  const turns: unknown[] = [];
  const cursors = new Set<string>();
  let cursor: PageCursor | null = null;
  const limit = 100;

  while (true) {
    const params = new URLSearchParams({ limit: String(limit) });
    if (normalizedPhone) params.set("user_phone_number", normalizedPhone);
    if (bsuid) params.set("bsuid", bsuid);
    const requestParams = queryWithCursor(params, cursor);
    const response = await fetch(`${CONVERSATION_TURNS_ENDPOINT}?${requestParams.toString()}`, { headers: { Accept: "application/json" } });
    if (!response.ok) throw new Error(`Conversation Turns respondeu ${response.status}.`);
    const payload = await response.json() as unknown;
    turns.push(...turnList(payload));
    const next = nextCursor(payload);
    if (!next || cursors.has(`${next.parameter}:${next.value}`)) break;
    cursors.add(`${next.parameter}:${next.value}`);
    cursor = next;
  }
  return turns;
}

function turnTimeline(turns: unknown[]): TimelineItem[] {
  const items: TimelineItem[] = [];
  turns.forEach((rawTurn, turnIndex) => {
    const turn = record(rawTurn);
    const turnId = firstText(turn.turn_id, turn.turnId) || undefined;
    const messageId = firstText(turn.message_id, turn.messageId) || undefined;
    const turnAt = dateValue(turn.timestamp ?? turn.created_at ?? turn.createdAt);
    const clientRaw = turn.user_message ?? turn.userMessage ?? turn.client_message ?? turn.customer_message ?? turn.mensagem_cliente;
    const client = clientRaw !== undefined ? messageFrom(clientRaw, turnIndex, "cliente", {
      source: "meta",
      turnId,
      messageId,
      at: turnAt,
      sequence: turnIndex * 1000 - 1,
    }) : null;
    if (client) items.push({ kind: "message", id: `meta-client-${turnId || turnIndex}`, at: client.at, sequence: client.sequence, message: client });

    const assistantRaw = turn.assistant_message ?? turn.assistantMessage ?? turn.response ?? turn.mensagem_assistente;
    if (assistantRaw !== undefined && !Array.isArray(assistantRaw)) {
      const assistant = messageFrom(assistantRaw, turnIndex, "assistente", {
        source: "meta",
        turnId,
        messageId: firstText(record(assistantRaw).message_id, record(assistantRaw).messageId) || messageId,
        at: turnAt,
        sequence: turnIndex * 1000,
      });
      if (assistant) items.push({ kind: "message", id: `meta-assistant-${turnId || turnIndex}`, at: assistant.at, sequence: assistant.sequence, message: assistant });
    }

    const steps = Array.isArray(turn.steps) ? turn.steps : [];
    steps.forEach((rawStep, stepIndex) => {
      const step = record(rawStep);
      const kind = firstText(step.type, step.kind, step.step_type).toUpperCase();
      const stepAt = dateValue(step.timestamp ?? step.created_at ?? step.createdAt) || turnAt;
      if (kind.includes("TOOL") || step.tool_name || step.toolName) {
        const activity = toolFrom(step, stepIndex, { source: "meta", turnId, at: stepAt, sequence: turnIndex * 1000 + stepIndex });
        if (activity) items.push({ kind: "activity", id: `meta-tool-${turnId || turnIndex}-${stepIndex}`, at: activity.at, sequence: activity.sequence, activity });
      }
      if ((kind.includes("LLM") || step.llm_output_preview || step.llmOutputPreview) && firstText(step.llm_output_preview, step.llmOutputPreview)) {
        const message = messageFrom(step, stepIndex, "assistente", {
          source: "meta",
          turnId,
          messageId: firstText(step.message_id, step.messageId) || undefined,
          at: stepAt,
          sequence: turnIndex * 1000 + stepIndex,
        });
        if (message) items.push({ kind: "message", id: `meta-llm-${turnId || turnIndex}-${stepIndex}`, at: message.at, sequence: message.sequence, message });
      }
    });
  });
  return items;
}

function consolidate(selected: Conversation, turns: unknown[]): TimelineItem[] {
  const firestoreMessages = dedupeMessages(selected.messages);
  const firestoreActivities = dedupeActivities(selected.activities);
  const metaItems = turnTimeline(turns);
  const messages = dedupeMessages([...firestoreMessages, ...metaItems.filter((item): item is Extract<TimelineItem, { kind: "message" }> => item.kind === "message").map((item) => item.message)]);
  const activities = dedupeActivities([...firestoreActivities, ...metaItems.filter((item): item is Extract<TimelineItem, { kind: "activity" }> => item.kind === "activity").map((item) => item.activity)]);
  const merged: TimelineItem[] = [
    ...messages.map((message) => ({ kind: "message" as const, id: message.id, at: message.at, sequence: message.sequence, message })),
    ...activities.map((activity) => ({ kind: "activity" as const, id: activity.id, at: activity.at, sequence: activity.sequence, activity })),
  ];
  return merged.sort((a, b) => {
    const at = (a.at?.getTime() || 0) - (b.at?.getTime() || 0);
    return at || a.sequence - b.sequence;
  });
}

function emptyState(icon: ReactNode, title: string, description: string) {
  return <div className="wa-empty"><div className="wa-empty-icon">{icon}</div><strong>{title}</strong><p>{description}</p></div>;
}

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
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [changingMode, setChangingMode] = useState(false);
  const [image, setImage] = useState("");
  const [turns, setTurns] = useState<unknown[]>([]);
  const [turnsLoading, setTurnsLoading] = useState(false);
  const [turnsError, setTurnsError] = useState("");

  const selected = conversations.find((conversation) => conversation.id === selectedId) || conversations[0] || null;
  const filtered = useMemo(() => {
    const term = queryText.trim().toLowerCase();
    if (!term) return conversations;
    return conversations.filter((conversation) => [
      conversation.name,
      conversation.phone,
      ...conversation.messages.map((item) => item.text),
    ].join(" ").toLowerCase().includes(term));
  }, [conversations, queryText]);

  useEffect(() => {
    if (selected && selected.id !== selectedId) setSelectedId(selected.id);
  }, [selected, selectedId]);

  useEffect(() => {
    let cancelled = false;
    if (!selected) {
      setTurns([]);
      return;
    }
    setTurnsLoading(true);
    setTurnsError("");
    setTurns(selected.turns);
    void loadConversationTurns(selected.phone, selected.bsuid)
      .then((result) => { if (!cancelled) setTurns(result.length ? result : selected.turns); })
      .catch((reason: unknown) => {
        if (!cancelled) {
          console.error("Erro ao carregar Conversation Turns:", reason);
          setTurns(selected.turns);
          setTurnsError("O histórico do Meta Business Agent não pôde ser carregado agora.");
        }
      })
      .finally(() => { if (!cancelled) setTurnsLoading(false); });
    return () => { cancelled = true; };
  }, [selected?.id, selected?.phone, selected?.bsuid]);

  async function toggleHuman() {
    if (!selected || changingMode) return;
    setChangingMode(true);
    try {
      await fetch("/api/whatsapp/control", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ numero: selected.phone, acao: selected.human ? "ia" : "humano" }),
      });
    } finally {
      setChangingMode(false);
      onRefresh();
    }
  }

  async function sendMessage() {
    if (!selected || !message.trim() || sending || !selected.human) return;
    setSending(true);
    try {
      const response = await fetch("/api/whatsapp/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ numero: selected.phone, mensagem: message.trim() }),
      });
      if (response.ok) setMessage("");
    } finally {
      setSending(false);
      onRefresh();
    }
  }

  const timeline = useMemo(() => selected ? consolidate(selected, turns) : [], [selected, turns]);
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

  return (
    <>
      {(error || turnsError) && <div className="wa-alert"><AlertCircle size={15} />{error || turnsError}</div>}
      <div className="wa-surface wa-chat">
        <aside className="wa-list">
          <div className="wa-list-head">
            <div className="wa-section-heading">
              <div><h2>Conversas</h2><p>Atendimento Águia Express</p></div>
              <button className="wa-icon-button" title="Atualizar conversas" onClick={onRefresh}><RefreshCw size={14} /></button>
            </div>
            <div className="wa-search"><Search size={14} /><input value={queryText} onChange={(event) => setQueryText(event.target.value)} placeholder="Pesquisar conversa..." /></div>
          </div>
          <div className="wa-list-body">
            {loading ? <div className="wa-loading"><LoaderCircle size={20} /></div> : filtered.length === 0 ? emptyState(<MessageCircle size={20} />, "Nenhuma conversa encontrada", "As conversas disponibilizadas pelo atendimento aparecerão aqui.") : filtered.map((conversation) => {
              const last = conversation.messages[conversation.messages.length - 1];
              return <button key={conversation.id} className={`wa-conversation ${selected?.id === conversation.id ? "active" : ""}`} onClick={() => setSelectedId(conversation.id)}>
                <div className="wa-avatar">{initials(conversation.name)}</div>
                <div className="wa-conversation-main">
                  <div className="wa-conversation-top"><span className="wa-name">{conversation.name}</span><span className="wa-time">{formatRelativeDate(conversation.updatedAt)}</span></div>
                  <div className="wa-phone">{formatPhone(conversation.phone) || "Telefone não informado"}</div>
                  <div className="wa-preview">{last?.text || "Sem mensagens de texto"}</div>
                  <div className="wa-list-meta"><span className={`wa-pill ${conversation.human ? "human" : "ai"}`}>{conversation.human ? "Atendimento humano" : "IA ativa"}</span>{conversation.unread > 0 && <span className="wa-unread">{conversation.unread}</span>}</div>
                </div>
              </button>;
            })}
          </div>
        </aside>
        <section className="wa-chat-main">
          {!selected ? emptyState(<MessageCircle size={21} />, "Selecione uma conversa", "Escolha um cliente na lista para acompanhar o histórico do atendimento.") : <>
            <header className="wa-chat-head">
              <div className="wa-person"><div className="wa-person-avatar"><UserRound size={19} /></div><div><h2>{selected.name}</h2><p>{formatPhone(selected.phone) || "Telefone não informado"} · Meta Business Agent</p></div></div>
              <div className="wa-head-actions"><div className={`wa-automation ${selected.human ? "human" : ""}`}><span className="wa-automation-dot" />{selected.human ? "Atendimento humano" : "Meta Business Agent"}</div><button className="wa-takeover" disabled={changingMode} onClick={toggleHuman}>{changingMode ? "Atualizando..." : selected.human ? "Devolver à IA" : "Assumir atendimento"}</button></div>
            </header>
            <div className="wa-messages"><div className="wa-thread">
              {turnsLoading && <div className="wa-loading"><LoaderCircle size={20} /></div>}
              {!turnsLoading && groupedTimeline.length === 0 && emptyState(<MessageCircle size={20} />, "Sem mensagens disponíveis", "O histórico desta conversa ainda não foi consolidado.")}
              {!turnsLoading && groupedTimeline.map((group) => <div key={group.date}>
                <div className="wa-date">{group.date}</div>
                {group.items.map((item) => item.kind === "message" ? <div key={item.id} className={`wa-message-row ${item.message.role}`}>
                  <div className={`wa-bubble ${item.message.role}`}>
                    <div className="wa-role">{item.message.role === "assistente" ? <><Bot size={11} />{item.message.human ? "Atendimento humano" : "Meta Business Agent"}</> : <><UserRound size={11} />Cliente</>}</div>
                    {item.message.imageUrl && <img className="wa-message-image" src={item.message.imageUrl} alt="Imagem enviada na conversa" onClick={() => setImage(item.message.imageUrl || "")} />}
                    {item.message.text && <div className="wa-message-text">{item.message.text}</div>}
                    <div className="wa-message-time">{formatTime(item.message.at)}</div>
                  </div>
                </div> : <details className="wa-activity" key={item.id}>
                  <summary><Wrench size={13} /> Atividade da IA: {item.activity.name}<span className="wa-activity-status">{item.activity.status || ""}</span><ChevronDown size={13} /></summary>
                  <div className="wa-activity-body">{item.activity.input && <><span className="wa-activity-label">Entrada</span>{item.activity.input}</>}{item.activity.output && <><span className="wa-activity-label">Resultado</span>{item.activity.output}</>}</div>
                </details>)}
              </div>)}
            </div></div>
            {selected.human ? <div className="wa-compose"><textarea value={message} onChange={(event) => setMessage(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); void sendMessage(); } }} placeholder="Digite uma mensagem..." /><button className="wa-send" disabled={!message.trim() || sending} onClick={() => void sendMessage()}>{sending ? <LoaderCircle size={16} /> : <Send size={16} />}</button></div> : <div className="wa-compose-note">Assuma o atendimento para enviar uma mensagem manual pelo site.</div>}
          </>}
        </section>
      </div>
      {image && <div className="wa-modal-backdrop" onClick={() => setImage("")}><div className="wa-modal"><button className="wa-modal-close" onClick={() => setImage("")}><X size={16} /></button><img src={image} alt="Imagem ampliada da conversa" /></div></div>}
    </>
  );
}

function RegisterView({ items, type }: { items: RegisterItem[]; type: "colaboradores" | "parceiros" }) {
  const [queryText, setQueryText] = useState("");
  const [selectedId, setSelectedId] = useState("");
  const filtered = items.filter((item) => `${item.title} ${item.subtitle} ${item.status || ""}`.toLowerCase().includes(queryText.toLowerCase()));
  const selected = filtered.find((item) => item.id === selectedId) || filtered[0] || null;
  const partner = type === "parceiros";
  return <div className="wa-surface wa-register">
    <aside className="wa-register-list"><div className="wa-register-header"><div className="wa-section-heading"><div><h2>{partner ? "Parceiros" : "Colaboradores"}</h2><p>{partner ? "Solicitações recebidas pelo WhatsApp" : "Cadastros recebidos pelo WhatsApp"}</p></div></div><div className="wa-search"><Search size={14} /><input value={queryText} onChange={(event) => setQueryText(event.target.value)} placeholder="Pesquisar..." /></div></div><div className="wa-register-items">{filtered.length ? filtered.map((item) => <button key={item.id} className={`wa-register-item ${selected?.id === item.id ? "active" : ""}`} onClick={() => setSelectedId(item.id)}><div className="wa-register-avatar">{partner ? <Building2 size={16} /> : <UsersRound size={16} />}</div><div><div className="wa-register-title">{item.title}</div><div className="wa-register-subtitle">{item.subtitle}</div></div></button>) : emptyState(partner ? <Building2 size={20} /> : <UsersRound size={20} />, `Nenhum ${partner ? "parceiro" : "colaborador"} encontrado`, "Os dados disponibilizados pelo atendimento aparecerão aqui.")}</div></aside>
    <section className="wa-register-detail">{!selected ? emptyState(partner ? <Building2 size={22} /> : <UsersRound size={22} />, `Selecione ${partner ? "um parceiro" : "um colaborador"}`, "Escolha um cadastro na lista para visualizar os detalhes.") : <><div className="wa-detail-head"><div className="wa-detail-person"><div className="wa-detail-avatar">{partner ? <Building2 size={22} /> : <UsersRound size={22} />}</div><div><h2>{selected.title}</h2><p>{selected.subtitle}</p></div></div>{selected.status && <span className="wa-status">{selected.status}</span>}</div><div className="wa-detail-grid">{selected.details.map(([label, value]) => <div className="wa-detail-card" key={`${label}-${value}`}><div className="wa-detail-label">{label.replace(/([A-Z])/g, " $1")}</div><div className="wa-detail-value">{value || "—"}</div></div>)}</div></>}</section>
  </div>;
}

export default function WhatsApp() {
  const [tab, setTab] = useState<Tab>("chat");
  const [payload, setPayload] = useState<ApiPayload>({ conversations: [], colaboradores: [], parceiros: [] });
  const [conversationRecords, setConversationRecords] = useState<UnknownRecord[]>([]);
  const [subcollectionMessages, setSubcollectionMessages] = useState<Record<string, unknown[]>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const [refreshToken, setRefreshToken] = useState(0);

  useEffect(() => {
    const unsubscribe = onSnapshot(query(collection(db, "whatsapp_conversas")), (snapshot) => {
      setConversationRecords(snapshot.docs.map((item) => ({ ...item.data(), id: item.id })));
      setLastUpdate(new Date());
      setLoading(false);
      setError("");
    }, (snapshotError) => {
      console.error("Erro ao carregar WhatsApp:", snapshotError);
      setError("Não foi possível carregar as conversas agora.");
      setLoading(false);
    });
    return unsubscribe;
  }, [refreshToken]);

  useEffect(() => {
    const listeners = new Map<string, () => void>();
    conversationRecords.forEach((conversation) => {
      const id = firstText(conversation.id);
      if (!id) return;
      const reference = collection(db, "whatsapp_conversas", id, "mensagens");
      const unsubscribe = onSnapshot(reference, (snapshot) => {
        setSubcollectionMessages((current) => ({ ...current, [id]: snapshot.docs.map((item) => ({ ...item.data(), id: item.id })) }));
      }, (snapshotError) => {
        console.error(`Erro ao carregar mensagens da conversa ${id}:`, snapshotError);
      });
      listeners.set(id, unsubscribe);
    });
    return () => listeners.forEach((unsubscribe) => unsubscribe());
  }, [conversationRecords]);

  useEffect(() => {
    const unsubscribe = onSnapshot(collection(db, "candidatos_entregadores"), (snapshot) => {
      const colaboradores = snapshot.docs
        .map((item, index) => normalizeRegister({ ...item.data(), id: item.id }, "colaborador", index))
        .sort((a, b) => a.title.localeCompare(b.title));
      setPayload((current) => ({ ...current, colaboradores }));
    }, (snapshotError) => console.error("Erro ao carregar colaboradores:", snapshotError));
    return unsubscribe;
  }, []);

  useEffect(() => {
    const unsubscribe = onSnapshot(collection(db, "solicitacoes_parceiros"), (snapshot) => {
      const parceiros = snapshot.docs
        .map((item, index) => normalizeRegister({ ...item.data(), id: item.id }, "parceiro", index))
        .sort((a, b) => a.title.localeCompare(b.title));
      setPayload((current) => ({ ...current, parceiros }));
    }, (snapshotError) => console.error("Erro ao carregar parceiros:", snapshotError));
    return unsubscribe;
  }, []);

  const conversations = useMemo(() => conversationRecords.map((raw, index) => {
    const id = firstText(raw.id);
    const embeddedMessages = Array.isArray(raw.mensagens) ? raw.mensagens : Array.isArray(raw.messages) ? raw.messages : [];
    return normalizeConversation({ ...raw, mensagens: [...embeddedMessages, ...(subcollectionMessages[id] || [])] }, index);
  }).sort((a, b) => (b.updatedAt?.getTime() || 0) - (a.updatedAt?.getTime() || 0)), [conversationRecords, subcollectionMessages]);

  const active = conversations.filter((conversation) => !["encerrada", "fechada"].includes(conversation.status.toLowerCase())).length;
  const unread = conversations.reduce((total, conversation) => total + conversation.unread, 0);
  const latest = conversations.reduce<Date | null>((latestValue, conversation) => !latestValue || (conversation.updatedAt && conversation.updatedAt > latestValue) ? conversation.updatedAt : latestValue, lastUpdate);

  return <><style>{css}</style><main className="wa-page"><div className="wa-wrap">
    <header className="wa-hero"><div><div className="wa-kicker"><span className="wa-kicker-dot" /> Central de atendimento</div><h1 className="wa-title">WhatsApp</h1><p className="wa-subtitle">Atendimento Águia Express</p></div><div className="wa-metrics"><div className="wa-metric"><span className="wa-metric-label">Conversas</span><span className="wa-metric-value">{conversations.length}</span></div><div className="wa-metric"><span className="wa-metric-label">Ativas</span><span className="wa-metric-value">{active}</span></div><div className="wa-metric"><span className="wa-metric-label">Não lidas</span><span className="wa-metric-value">{unread}</span></div><div className="wa-metric"><span className="wa-metric-label">Última atualização</span><span className="wa-metric-value small">{latest ? formatTime(latest) : "Aguardando"}</span></div></div></header>
    <nav className="wa-tabs" aria-label="Áreas do atendimento"><button className={`wa-tab ${tab === "chat" ? "active" : ""}`} onClick={() => setTab("chat")}><MessageCircle size={14} /> Chat <span className="wa-tab-count">{conversations.length}</span></button><button className={`wa-tab ${tab === "colaboradores" ? "active" : ""}`} onClick={() => setTab("colaboradores")}><UsersRound size={14} /> Colaboradores <span className="wa-tab-count">{payload.colaboradores.length}</span></button><button className={`wa-tab ${tab === "parceiros" ? "active" : ""}`} onClick={() => setTab("parceiros")}><Building2 size={14} /> Parceiros <span className="wa-tab-count">{payload.parceiros.length}</span></button></nav>
    {tab === "chat" && <ChatView conversations={conversations} error={error} loading={loading} onRefresh={() => setRefreshToken((value) => value + 1)} />}
    {tab === "colaboradores" && <RegisterView items={payload.colaboradores} type="colaboradores" />}
    {tab === "parceiros" && <RegisterView items={payload.parceiros} type="parceiros" />}
  </div></main></>;
}