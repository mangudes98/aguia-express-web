// ============================================================
// PÁGINA: WhatsApp — Painel de Atendimento Águia Express
// ARQUIVO: src/pages/whatsapp.tsx
// ============================================================

import { useEffect, useMemo, useState } from "react";

import {
  collection,
  onSnapshot,
  orderBy,
  query,
  Timestamp,
} from "firebase/firestore";

import {
  MessageCircle,
  Send,
  Search,
  UserPlus,
  X,
  Camera,
  Phone,
  FileText,
  MapPin,
  CreditCard,
  Building2,
  CheckCircle2,
  Clock,
} from "lucide-react";

import { db } from "../services/firebase/firebase";

// ============================================================
// TIPOS
// ============================================================

type Mensagem = {
  papel: "cliente" | "assistente";
  texto?: string;
  tipo?: string;

  // Suporte para fotos/mídias
  url?: string;
  mediaUrl?: string;
  imagemUrl?: string;
  fotoUrl?: string;
  imageUrl?: string;
  media?: string;
  imagem?: string;
  foto?: string;

  em?: Timestamp | Date | string;
};

type Conversa = {
  id: string;
  numero: string;
  nome?: string;
  mensagens?: Mensagem[];
  atendimentoHumano?: boolean;
  ultimoCodigo?: string;
  atualizadoEm?: Timestamp | Date | string;
};

type CadastroEntregador = {
  id: string;

  status?: string;
  origem?: string;
  numeroWhatsApp?: string;

  nomeCompleto?: string;

  cep?: string;
  rua?: string;
  numero?: string;
  telefone?: string;
  telefoneContato?: string;

  cpf?: string;
  pix?: string;
  banco?: string;
  favorecido?: string;

  criadoEm?: Timestamp | Date | string;
  atualizadoEm?: Timestamp | Date | string;

  // Suporte a possíveis campos de foto
  foto?: string;
  fotoUrl?: string;
  imagem?: string;
  imagemUrl?: string;
  fotoPerfil?: string;
  fotoDocumento?: string;
  documentoFoto?: string;

  [key: string]: unknown;
};

// ============================================================
// DATA
// ============================================================

function formatarData(
  valor?: Timestamp | Date | string | unknown
) {
  if (!valor) return "";

  try {
    let data: Date;

    if (valor instanceof Timestamp) {
      data = valor.toDate();
    } else if (valor instanceof Date) {
      data = valor;
    } else if (
      typeof valor === "object" &&
      valor !== null &&
      "toDate" in valor &&
      typeof (valor as { toDate?: unknown }).toDate === "function"
    ) {
      data = (
        valor as {
          toDate: () => Date;
        }
      ).toDate();
    } else {
      data = new Date(String(valor));
    }

    if (Number.isNaN(data.getTime())) {
      return "";
    }

    return data.toLocaleString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "";
  }
}

// ============================================================
// TELEFONE
// ============================================================

function formatarNumero(numero: string) {
  const n = String(numero || "").replace(/\D/g, "");

  if (n.length === 13) {
    return `+${n.slice(0, 2)} (${n.slice(2, 4)}) ${n.slice(
      4,
      9
    )}-${n.slice(9)}`;
  }

  if (n.length === 11) {
    return `(${n.slice(0, 2)}) ${n.slice(2, 7)}-${n.slice(
      7
    )}`;
  }

  return numero;
}

// ============================================================
// TEXTO
// ============================================================

function textoSeguro(valor: unknown) {
  if (
    valor === undefined ||
    valor === null ||
    typeof valor === "object"
  ) {
    return "";
  }

  return String(valor).trim();
}

// ============================================================
// DETECTAR URL DE FOTO
// ============================================================

function obterFotosMensagem(
  mensagem: Mensagem
): string[] {
  const fotos: string[] = [];

  const possiveis = [
    mensagem.url,
    mensagem.mediaUrl,
    mensagem.imagemUrl,
    mensagem.fotoUrl,
    mensagem.imageUrl,
    mensagem.media,
    mensagem.imagem,
    mensagem.foto,
  ];

  for (const valor of possiveis) {
    if (typeof valor === "string") {
      const url = valor.trim();

      if (
        url &&
        (/^https?:\/\//i.test(url) ||
          url.startsWith("data:image/"))
      ) {
        fotos.push(url);
      }
    }
  }

  // Caso a URL esteja diretamente no texto
  const texto = String(mensagem.texto || "");

  const urls = texto.match(
    /https?:\/\/[^\s<>"']+/gi
  );

  if (urls) {
    for (const url of urls) {
      if (
        /\.(jpg|jpeg|png|gif|webp)(\?.*)?$/i.test(
          url
        )
      ) {
        fotos.push(url);
      }
    }
  }

  return [...new Set(fotos)];
}

// ============================================================
// FOTOS DO CADASTRO
// ============================================================

function obterFotosCadastro(
  cadastro: CadastroEntregador
): string[] {
  const fotos: string[] = [];

  const possiveis = [
    cadastro.foto,
    cadastro.fotoUrl,
    cadastro.imagem,
    cadastro.imagemUrl,
    cadastro.fotoPerfil,
    cadastro.fotoDocumento,
    cadastro.documentoFoto,
  ];

  for (const valor of possiveis) {
    if (typeof valor === "string") {
      const url = valor.trim();

      if (
        url &&
        (/^https?:\/\//i.test(url) ||
          url.startsWith("data:image/"))
      ) {
        fotos.push(url);
      }
    }
  }

  return [...new Set(fotos)];
}

// ============================================================
// COMPONENTE PRINCIPAL
// ============================================================

export default function WhatsApp() {
  const [conversas, setConversas] = useState<
    Conversa[]
  >([]);

  const [selecionada, setSelecionada] =
    useState<Conversa | null>(null);

  const [
    cadastros,
    setCadastros,
  ] = useState<CadastroEntregador[]>([]);

  const [
    cadastroSelecionado,
    setCadastroSelecionado,
  ] =
    useState<CadastroEntregador | null>(null);

  const [busca, setBusca] = useState("");
  const [
    buscaCadastro,
    setBuscaCadastro,
  ] = useState("");

  const [texto, setTexto] = useState("");
  const [enviando, setEnviando] =
    useState(false);

  const [erro, setErro] = useState("");

  const [
    fotoAberta,
    setFotoAberta,
  ] = useState<string | null>(null);

  // ============================================================
  // CARREGAR CONVERSAS
  // ============================================================

  useEffect(() => {
    const referencia = collection(
      db,
      "whatsapp_conversas"
    );

    const consulta = query(
      referencia,
      orderBy("atualizadoEm", "desc")
    );

    const cancelar = onSnapshot(
      consulta,
      (snapshot) => {
        const lista: Conversa[] =
          snapshot.docs.map(
            (documento) => ({
              id: documento.id,
              ...(documento.data() as Omit<
                Conversa,
                "id"
              >),
            })
          );

        setConversas(lista);

        setSelecionada((atual) => {
          if (!atual) {
            return lista[0] || null;
          }

          return (
            lista.find(
              (item) =>
                item.id === atual.id
            ) ||
            lista[0] ||
            null
          );
        });
      },
      (error) => {
        console.error(
          "Erro ao carregar conversas:",
          error
        );

        setErro(
          "Não foi possível carregar as conversas."
        );
      }
    );

    return () => cancelar();
  }, []);

  // ============================================================
  // CARREGAR CADASTROS DOS ENTREGADORES
  // ============================================================

  useEffect(() => {
    const referencia = collection(
      db,
      "candidatos_entregadores"
    );

    const consulta = query(
      referencia,
      orderBy("atualizadoEm", "desc")
    );

    const cancelar = onSnapshot(
      consulta,
      (snapshot) => {
        const lista: CadastroEntregador[] =
          snapshot.docs.map(
            (documento) => ({
              id: documento.id,
              ...(documento.data() as Omit<
                CadastroEntregador,
                "id"
              >),
            })
          );

        setCadastros(lista);

        setCadastroSelecionado(
          (atual) => {
            if (!atual) {
              return lista[0] || null;
            }

            return (
              lista.find(
                (item) =>
                  item.id === atual.id
              ) ||
              lista[0] ||
              null
            );
          }
        );
      },
      (error) => {
        console.error(
          "Erro ao carregar cadastros:",
          error
        );
      }
    );

    return () => cancelar();
  }, []);

  // ============================================================
  // FILTRO DAS CONVERSAS
  // ============================================================

  const conversasFiltradas = useMemo(() => {
    const termo =
      busca.trim().toLowerCase();

    if (!termo) {
      return conversas;
    }

    return conversas.filter(
      (conversa) => {
        const nome = String(
          conversa.nome || ""
        ).toLowerCase();

        const numero = String(
          conversa.numero || ""
        ).toLowerCase();

        const ultimaMensagem =
          conversa.mensagens?.[
            conversa.mensagens.length - 1
          ]?.texto?.toLowerCase() || "";

        return (
          nome.includes(termo) ||
          numero.includes(termo) ||
          ultimaMensagem.includes(termo)
        );
      }
    );
  }, [conversas, busca]);

  // ============================================================
  // FILTRO DOS CADASTROS
  // ============================================================

  const cadastrosFiltrados = useMemo(() => {
    const termo =
      buscaCadastro.trim().toLowerCase();

    if (!termo) {
      return cadastros;
    }

    return cadastros.filter(
      (cadastro) => {
        return [
          cadastro.nomeCompleto,
          cadastro.numeroWhatsApp,
          cadastro.telefone,
          cadastro.telefoneContato,
          cadastro.cpf,
          cadastro.status,
          cadastro.cidade,
        ]
          .map((valor) =>
            String(valor || "").toLowerCase()
          )
          .some((valor) =>
            valor.includes(termo)
          );
      }
    );
  }, [cadastros, buscaCadastro]);

  // ============================================================
  // ENVIAR MENSAGEM
  // ============================================================

  async function enviarMensagem() {
    if (
      !selecionada ||
      !texto.trim() ||
      enviando
    ) {
      return;
    }

    setEnviando(true);
    setErro("");

    try {
      const resposta = await fetch(
        "/api/whatsapp/send",
        {
          method: "POST",
          headers: {
            "Content-Type":
              "application/json",
          },
          body: JSON.stringify({
            numero:
              selecionada.numero,
            mensagem:
              texto.trim(),
          }),
        }
      );

      const dados =
        await resposta
          .json()
          .catch(() => ({}));

      if (!resposta.ok) {
        throw new Error(
          dados?.error ||
            "Não foi possível enviar a mensagem."
        );
      }

      setTexto("");
    } catch (error) {
      console.error(
        "Erro ao enviar mensagem:",
        error
      );

      setErro(
        error instanceof Error
          ? error.message
          : "Erro ao enviar mensagem."
      );
    } finally {
      setEnviando(false);
    }
  }

  // ============================================================
  // INTERFACE
  // ============================================================

  return (
    <div className="whatsapp-wrapper">

      <style>{`

        * {
          box-sizing: border-box;
        }

        /* ======================================================
           WRAPPER
        ====================================================== */

        .whatsapp-wrapper {
          width: 100%;
          height: calc(100vh - 132px);
          min-height: 0;

          display: flex;
          flex-direction: column;

          gap: 14px;

          overflow: hidden;
        }

        /* ======================================================
           CADASTROS
        ====================================================== */

        .cadastros-container {
          flex-shrink: 0;

          width: 100%;

          background: #ffffff;

          border: 1px solid #eaecf0;
          border-radius: 16px;

          overflow: hidden;
        }

        .cadastros-header {
          min-height: 70px;

          padding: 14px 18px;

          display: flex;
          align-items: center;
          justify-content: space-between;

          gap: 15px;

          border-bottom: 1px solid #eaecf0;
        }

        .cadastros-title {
          display: flex;
          align-items: center;
          gap: 10px;

          min-width: 0;
        }

        .cadastros-icon {
          width: 40px;
          height: 40px;

          display: flex;
          align-items: center;
          justify-content: center;

          flex-shrink: 0;

          border-radius: 11px;

          background: #111827;
          color: #ffffff;
        }

        .cadastros-title strong {
          display: block;

          color: #101828;

          font-size: 14px;
          font-weight: 800;
        }

        .cadastros-title span {
          display: block;

          margin-top: 3px;

          color: #98a2b3;

          font-size: 10px;
        }

        .cadastros-search {
          width: 280px;
          max-width: 100%;

          position: relative;
        }

        .cadastros-search svg {
          position: absolute;

          left: 12px;
          top: 11px;

          color: #98a2b3;
        }

        .cadastros-search input {
          width: 100%;
          height: 38px;

          padding: 0 12px 0 36px;

          border: 1px solid #eaecf0;
          border-radius: 9px;

          outline: none;

          background: #f9fafb;
          color: #101828;

          font-size: 11px;
        }

        .cadastros-list {
          display: flex;

          gap: 10px;

          padding: 12px 14px;

          overflow-x: auto;
          overflow-y: hidden;

          scrollbar-width: thin;
        }

        .cadastro-card {
          min-width: 210px;

          padding: 12px;

          border: 1px solid #eaecf0;
          border-radius: 11px;

          background: #ffffff;

          cursor: pointer;

          text-align: left;
        }

        .cadastro-card:hover {
          background: #f9fafb;
        }

        .cadastro-card.selected {
          border-color: #c9a227;

          box-shadow:
            0 0 0 1px #c9a227;
        }

        .cadastro-card-top {
          display: flex;
          align-items: center;
          gap: 9px;
        }

        .cadastro-avatar {
          width: 36px;
          height: 36px;

          display: flex;
          align-items: center;
          justify-content: center;

          flex-shrink: 0;

          border-radius: 50%;

          background: #111827;
          color: #ffffff;

          font-size: 12px;
          font-weight: 800;
        }

        .cadastro-card-name {
          min-width: 0;
          flex: 1;
        }

        .cadastro-card-name strong {
          display: block;

          overflow: hidden;

          color: #101828;

          font-size: 11px;
          font-weight: 800;

          white-space: nowrap;
          text-overflow: ellipsis;
        }

        .cadastro-card-name span {
          display: block;

          margin-top: 3px;

          color: #98a2b3;

          font-size: 9px;
        }

        .cadastro-status {
          display: inline-flex;

          align-items: center;

          gap: 4px;

          margin-top: 9px;

          padding: 4px 7px;

          border-radius: 20px;

          background: #ecfdf3;
          color: #15803d;

          font-size: 8px;
          font-weight: 800;
        }

        .cadastro-status.andamento {
          background: #fff7ed;
          color: #c2410c;
        }

        .cadastro-status-dot {
          width: 5px;
          height: 5px;

          border-radius: 50%;

          background: currentColor;
        }

        .cadastros-empty {
          padding: 22px;

          color: #98a2b3;

          font-size: 11px;

          text-align: center;
        }

        /* ======================================================
           DETALHE CADASTRO
        ====================================================== */

        .cadastro-detalhe {
          position: fixed;

          z-index: 1000;

          inset: 0;

          display: flex;
          align-items: center;
          justify-content: center;

          padding: 25px;

          background: rgba(15, 23, 42, .55);
        }

        .cadastro-detalhe-card {
          width: min(900px, 100%);

          max-height: 90vh;

          overflow-y: auto;

          background: #ffffff;

          border-radius: 16px;

          box-shadow:
            0 20px 60px rgba(0,0,0,.25);
        }

        .cadastro-detalhe-header {
          position: sticky;
          top: 0;
          z-index: 2;

          min-height: 68px;

          padding: 14px 18px;

          display: flex;
          align-items: center;
          justify-content: space-between;

          background: #ffffff;

          border-bottom: 1px solid #eaecf0;
        }

        .cadastro-detalhe-header strong {
          color: #101828;
          font-size: 15px;
          font-weight: 800;
        }

        .cadastro-fechar {
          width: 34px;
          height: 34px;

          display: grid;
          place-items: center;

          border: 1px solid #eaecf0;
          border-radius: 9px;

          background: #f9fafb;

          cursor: pointer;
        }

        .cadastro-detalhe-body {
          padding: 18px;
        }

        .cadastro-info-grid {
          display: grid;

          grid-template-columns:
            repeat(
              auto-fit,
              minmax(180px, 1fr)
            );

          gap: 10px;
        }

        .cadastro-info {
          padding: 11px;

          border: 1px solid #eaecf0;

          border-radius: 9px;

          background: #ffffff;
        }

        .cadastro-info small {
          display: block;

          color: #98a2b3;

          font-size: 8px;
          font-weight: 800;
          letter-spacing: .05em;
        }

        .cadastro-info strong {
          display: block;

          margin-top: 4px;

          color: #101828;

          font-size: 11px;

          word-break: break-word;
        }

        .cadastro-secao {
          margin-top: 18px;
        }

        .cadastro-secao-title {
          display: flex;
          align-items: center;

          gap: 7px;

          margin-bottom: 9px;

          color: #344054;

          font-size: 10px;
          font-weight: 800;
        }

        .cadastro-fotos {
          display: grid;

          grid-template-columns:
            repeat(
              auto-fit,
              minmax(180px, 1fr)
            );

          gap: 10px;
        }

        .cadastro-foto {
          width: 100%;
          height: 220px;

          object-fit: contain;

          background: #f8fafc;

          border: 1px solid #eaecf0;

          border-radius: 10px;

          cursor: pointer;
        }

        /* ======================================================
           WHATSAPP
        ====================================================== */

        .whatsapp-page {
          width: 100%;
          min-height: 0;

          flex: 1;

          display: flex;

          overflow: hidden;

          background: #f5f6f8;

          border: 1px solid #eaecf0;
          border-radius: 16px;
        }

        /* ======================================================
           SIDEBAR
        ====================================================== */

        .whatsapp-sidebar {
          width: 350px;
          min-width: 350px;

          height: 100%;

          display: flex;
          flex-direction: column;

          min-height: 0;

          overflow: hidden;

          background: #ffffff;

          border-right: 1px solid #eaecf0;
        }

        .whatsapp-sidebar-header {
          flex-shrink: 0;

          padding: 20px;

          border-bottom: 1px solid #eaecf0;
        }

        .whatsapp-title {
          display: flex;
          align-items: center;

          gap: 12px;
        }

        .whatsapp-title-icon {
          width: 42px;
          height: 42px;

          display: flex;
          align-items: center;
          justify-content: center;

          flex-shrink: 0;

          border-radius: 12px;

          background: #111827;
          color: #ffffff;
        }

        .whatsapp-title h1 {
          margin: 0;

          color: #101828;

          font-size: 18px;
          font-weight: 800;
        }

        .whatsapp-title p {
          margin: 4px 0 0;

          color: #98a2b3;

          font-size: 11px;
        }

        .whatsapp-search {
          position: relative;

          margin-top: 18px;
        }

        .whatsapp-search svg {
          position: absolute;

          left: 12px;
          top: 11px;

          color: #98a2b3;

          pointer-events: none;
        }

        .whatsapp-search input {
          width: 100%;
          height: 40px;

          padding: 0 12px 0 38px;

          border: 1px solid #eaecf0;
          border-radius: 10px;

          outline: none;

          background: #f9fafb;
          color: #101828;

          font-size: 12px;
        }

        .whatsapp-search input:focus {
          border-color: #c9a227;
          background: #ffffff;
        }

        /* ======================================================
           CONVERSAS
        ====================================================== */

        .whatsapp-conversations {
          flex: 1;

          min-height: 0;

          overflow-y: auto;
          overflow-x: hidden;

          scrollbar-width: thin;
        }

        .whatsapp-conversation {
          width: 100%;

          padding: 14px;

          display: flex;
          align-items: flex-start;

          gap: 12px;

          border: 0;
          border-bottom: 1px solid #f2f4f7;

          background: #ffffff;

          text-align: left;

          cursor: pointer;
        }

        .whatsapp-conversation:hover {
          background: #f9fafb;
        }

        .whatsapp-conversation.selected {
          background: #f2f4f7;

          box-shadow:
            inset 3px 0 0 #c9a227;
        }

        .whatsapp-avatar {
          width: 42px;
          height: 42px;

          min-width: 42px;

          display: flex;
          align-items: center;
          justify-content: center;

          border-radius: 50%;

          background: #111827;
          color: #ffffff;

          font-size: 14px;
          font-weight: 800;
        }

        .whatsapp-conversation-content {
          min-width: 0;
          flex: 1;
        }

        .whatsapp-conversation-top {
          display: flex;
          align-items: center;
          justify-content: space-between;

          gap: 8px;
        }

        .whatsapp-name {
          min-width: 0;

          overflow: hidden;

          color: #101828;

          font-size: 12px;
          font-weight: 800;

          white-space: nowrap;
          text-overflow: ellipsis;
        }

        .whatsapp-time {
          flex-shrink: 0;

          color: #98a2b3;

          font-size: 9px;
        }

        .whatsapp-number {
          margin-top: 3px;

          color: #98a2b3;

          font-size: 9px;
        }

        .whatsapp-last-message {
          margin-top: 6px;

          overflow: hidden;

          color: #667085;

          font-size: 11px;

          white-space: nowrap;
          text-overflow: ellipsis;
        }

        .whatsapp-human {
          display: inline-block;

          margin-top: 7px;

          padding: 3px 6px;

          border-radius: 5px;

          background: #fff7ed;
          color: #c2410c;

          font-size: 8px;
          font-weight: 800;
        }

        .whatsapp-empty-list {
          padding: 50px 25px;

          text-align: center;

          color: #98a2b3;

          font-size: 12px;
        }

        /* ======================================================
           CHAT
        ====================================================== */

        .whatsapp-chat {
          min-width: 0;
          min-height: 0;

          flex: 1;

          height: 100%;

          display: flex;
          flex-direction: column;

          overflow: hidden;
        }

        .whatsapp-chat-header {
          min-height: 72px;

          padding: 14px 20px;

          display: flex;
          align-items: center;
          justify-content: space-between;

          gap: 15px;

          flex-shrink: 0;

          background: #ffffff;

          border-bottom: 1px solid #eaecf0;
        }

        .whatsapp-chat-user {
          min-width: 0;

          display: flex;
          align-items: center;

          gap: 12px;
        }

        .whatsapp-chat-user-info {
          min-width: 0;
        }

        .whatsapp-chat-user-info strong {
          display: block;

          overflow: hidden;

          color: #101828;

          font-size: 14px;
          font-weight: 800;

          white-space: nowrap;
          text-overflow: ellipsis;
        }

        .whatsapp-chat-user-info span {
          display: block;

          margin-top: 3px;

          color: #98a2b3;

          font-size: 10px;
        }

        .whatsapp-status {
          display: flex;
          align-items: center;

          gap: 6px;

          flex-shrink: 0;

          padding: 6px 9px;

          border-radius: 20px;

          background: #ecfdf3;

          color: #15803d;

          font-size: 9px;
          font-weight: 800;
        }

        .whatsapp-status-dot {
          width: 6px;
          height: 6px;

          border-radius: 50%;

          background: #22c55e;
        }

        /* ======================================================
           MENSAGENS
        ====================================================== */

        .whatsapp-messages {
          flex: 1;

          min-height: 0;

          overflow-y: auto;
          overflow-x: hidden;

          padding: 24px;

          background: #f5f6f8;

          scrollbar-width: thin;
        }

        .whatsapp-messages-inner {
          width: 100%;

          max-width: 900px;

          margin: 0 auto;

          display: flex;
          flex-direction: column;

          gap: 10px;
        }

        .whatsapp-message-row {
          width: 100%;

          display: flex;
        }

        .whatsapp-message-row.client {
          justify-content: flex-start;
        }

        .whatsapp-message-row.assistant {
          justify-content: flex-end;
        }

        .whatsapp-message {
          max-width: 70%;

          padding: 10px 13px;

          border-radius: 14px;

          box-shadow:
            0 1px 3px
            rgba(16, 24, 40, .06);

          overflow-wrap: anywhere;
        }

        .whatsapp-message.client {
          border-top-left-radius: 4px;

          background: #ffffff;

          color: #344054;
        }

        .whatsapp-message.assistant {
          border-top-right-radius: 4px;

          background: #111827;

          color: #ffffff;
        }

        .whatsapp-message-text {
          white-space: pre-wrap;

          word-break: break-word;

          font-size: 12px;

          line-height: 1.6;
        }

        .whatsapp-message-time {
          margin-top: 4px;

          color: #98a2b3;

          font-size: 8px;

          text-align: right;
        }

        .whatsapp-message-photo {
          width: 100%;

          max-width: 320px;
          max-height: 360px;

          margin-top: 8px;

          display: block;

          object-fit: contain;

          border-radius: 9px;

          cursor: pointer;

          background: #f8fafc;
        }

        /* ======================================================
           COMPOSITOR
        ====================================================== */

        .whatsapp-compose {
          box-sizing: border-box;

          padding: 12px 18px;

          flex-shrink: 0;

          background: #ffffff;

          border-top: 1px solid #eaecf0;
        }

        .whatsapp-compose-inner {
          width: 100%;

          max-width: 900px;

          margin: 0 auto;

          display: flex;
          align-items: flex-end;

          gap: 10px;
        }

        .whatsapp-compose textarea {
          width: 100%;

          flex: 1;

          min-width: 0;

          min-height: 45px;
          max-height: 120px;

          resize: none;

          padding: 12px 14px;

          border: 1px solid #eaecf0;
          border-radius: 12px;

          outline: none;

          background: #f9fafb;
          color: #101828;

          font-family: inherit;
          font-size: 12px;
        }

        .whatsapp-compose textarea:focus {
          border-color: #c9a227;

          background: #ffffff;
        }

        .whatsapp-send {
          width: 45px;
          height: 45px;

          min-width: 45px;

          display: flex;
          align-items: center;
          justify-content: center;

          border: 0;
          border-radius: 12px;

          background: #111827;

          color: #ffffff;

          cursor: pointer;
        }

        .whatsapp-send:hover {
          background: #000000;
        }

        .whatsapp-send:disabled {
          opacity: .4;

          cursor: not-allowed;
        }

        /* ======================================================
           ERRO
        ====================================================== */

        .whatsapp-error {
          padding: 9px 18px;

          flex-shrink: 0;

          background: #fef2f2;

          border-top: 1px solid #fecaca;

          color: #b91c1c;

          font-size: 11px;
        }

        /* ======================================================
           SEM CONVERSA
        ====================================================== */

        .whatsapp-no-chat {
          flex: 1;

          min-height: 0;

          display: flex;
          align-items: center;
          justify-content: center;

          text-align: center;

          color: #98a2b3;

          font-size: 12px;
        }

        .whatsapp-no-chat svg {
          display: block;

          margin: 0 auto 10px;
        }

        /* ======================================================
           MODAL FOTO
        ====================================================== */

        .foto-modal {
          position: fixed;

          z-index: 3000;

          inset: 0;

          display: flex;
          align-items: center;
          justify-content: center;

          padding: 20px;

          background: rgba(0,0,0,.82);

          cursor: pointer;
        }

        .foto-modal img {
          max-width: 95vw;
          max-height: 90vh;

          object-fit: contain;

          border-radius: 10px;
        }

        .foto-modal-close {
          position: fixed;

          top: 20px;
          right: 20px;

          width: 40px;
          height: 40px;

          display: grid;
          place-items: center;

          border: 0;
          border-radius: 50%;

          background: #ffffff;

          color: #111827;

          cursor: pointer;
        }

        /* ======================================================
           RESPONSIVO
        ====================================================== */

        @media (max-width: 900px) {

          .whatsapp-sidebar {
            width: 300px;
            min-width: 300px;
          }

          .whatsapp-message {
            max-width: 82%;
          }

          .whatsapp-status {
            display: none;
          }

        }

        @media (max-width: 650px) {

          .whatsapp-wrapper {
            height: calc(100vh - 110px);
          }

          .cadastros-header {
            align-items: flex-start;

            flex-direction: column;
          }

          .cadastros-search {
            width: 100%;
          }

          .whatsapp-sidebar {
            width: 85px;
            min-width: 85px;
          }

          .whatsapp-sidebar-header {
            padding: 12px;
          }

          .whatsapp-title {
            justify-content: center;
          }

          .whatsapp-title h1,
          .whatsapp-title p,
          .whatsapp-search,
          .whatsapp-number,
          .whatsapp-last-message,
          .whatsapp-human,
          .whatsapp-time {
            display: none;
          }

          .whatsapp-conversation {
            justify-content: center;

            padding: 12px 5px;
          }

          .whatsapp-conversation-content {
            display: none;
          }

          .whatsapp-chat-header {
            padding: 12px;
          }

          .whatsapp-messages {
            padding: 12px;
          }

          .whatsapp-message {
            max-width: 88%;
          }

          .whatsapp-compose {
            padding: 10px;
          }

          .whatsapp-compose textarea {
            min-height: 42px;
          }

          .whatsapp-send {
            width: 42px;
            height: 42px;
            min-width: 42px;
          }

          .cadastro-detalhe {
            padding: 10px;
          }

        }

      `}</style>

      {/* ========================================================
          CADASTROS DOS ENTREGADORES
      ======================================================== */}

      <section className="cadastros-container">

        <div className="cadastros-header">

          <div className="cadastros-title">

            <div className="cadastros-icon">
              <UserPlus size={20} />
            </div>

            <div>
              <strong>
                CADASTROS DE ENTREGADORES
              </strong>

              <span>
                Dados coletados pela IA no WhatsApp
              </span>
            </div>

          </div>

          <div className="cadastros-search">

            <Search size={15} />

            <input
              type="text"
              value={buscaCadastro}
              onChange={(event) =>
                setBuscaCadastro(
                  event.target.value
                )
              }
              placeholder="Pesquisar entregador..."
            />

          </div>

        </div>

        <div className="cadastros-list">

          {cadastrosFiltrados.length === 0 ? (

            <div className="cadastros-empty">
              Nenhum cadastro de entregador encontrado.
            </div>

          ) : (

            cadastrosFiltrados.map(
              (cadastro) => {

                const nome =
                  cadastro.nomeCompleto ||
                  "Cadastro em andamento";

                const status =
                  String(
                    cadastro.status || ""
                  ).toUpperCase();

                const andamento =
                  status === "EM_ANDAMENTO";

                return (
                  <button
                    key={cadastro.id}
                    type="button"
                    className={`cadastro-card ${
                      cadastroSelecionado?.id ===
                      cadastro.id
                        ? "selected"
                        : ""
                    }`}
                    onClick={() =>
                      setCadastroSelecionado(
                        cadastro
                      )
                    }
                  >

                    <div className="cadastro-card-top">

                      <div className="cadastro-avatar">
                        {nome
                          .charAt(0)
                          .toUpperCase()}
                      </div>

                      <div className="cadastro-card-name">

                        <strong>
                          {nome}
                        </strong>

                        <span>
                          {formatarNumero(
                            cadastro.numeroWhatsApp ||
                              cadastro.telefone ||
                              ""
                          )}
                        </span>

                      </div>

                    </div>

                    <div
                      className={`cadastro-status ${
                        andamento
                          ? "andamento"
                          : ""
                      }`}
                    >

                      {andamento ? (
                        <Clock size={9} />
                      ) : (
                        <CheckCircle2
                          size={9}
                        />
                      )}

                      {status ||
                        "SEM STATUS"}

                    </div>

                  </button>
                );
              }
            )

          )}

        </div>

      </section>

      {/* ========================================================
          WHATSAPP
      ======================================================== */}

      <div className="whatsapp-page">

        {/* ======================================================
            LISTA DE CONVERSAS
        ====================================================== */}

        <aside className="whatsapp-sidebar">

          <div className="whatsapp-sidebar-header">

            <div className="whatsapp-title">

              <div className="whatsapp-title-icon">
                <MessageCircle size={21} />
              </div>

              <div>

                <h1>
                  WhatsApp
                </h1>

                <p>
                  Atendimento Águia Express
                </p>

              </div>

            </div>

            <div className="whatsapp-search">

              <Search size={16} />

              <input
                type="text"
                value={busca}
                onChange={(event) =>
                  setBusca(
                    event.target.value
                  )
                }
                placeholder="Pesquisar conversa..."
              />

            </div>

          </div>

          <div className="whatsapp-conversations">

            {conversasFiltradas.length === 0 ? (

              <div className="whatsapp-empty-list">
                Nenhuma conversa encontrada.
              </div>

            ) : (

              conversasFiltradas.map(
                (conversa) => {

                  const ultimaMensagem =
                    conversa.mensagens?.[
                      conversa
                        .mensagens
                        .length - 1
                    ];

                  return (
                    <button
                      key={conversa.id}
                      type="button"
                      className={`whatsapp-conversation ${
                        selecionada?.id ===
                        conversa.id
                          ? "selected"
                          : ""
                      }`}
                      onClick={() =>
                        setSelecionada(
                          conversa
                        )
                      }
                    >

                      <div className="whatsapp-avatar">

                        {(conversa.nome ||
                          "C")
                          .charAt(0)
                          .toUpperCase()}

                      </div>

                      <div className="whatsapp-conversation-content">

                        <div className="whatsapp-conversation-top">

                          <span className="whatsapp-name">
                            {conversa.nome ||
                              "Cliente"}
                          </span>

                          <span className="whatsapp-time">
                            {formatarData(
                              ultimaMensagem?.em
                            )}
                          </span>

                        </div>

                        <div className="whatsapp-number">
                          {formatarNumero(
                            conversa.numero
                          )}
                        </div>

                        <div className="whatsapp-last-message">

                          {ultimaMensagem?.texto ||
                            "Nova conversa"}

                        </div>

                        {conversa.atendimentoHumano && (
                          <span className="whatsapp-human">
                            ATENDIMENTO HUMANO
                          </span>
                        )}

                      </div>

                    </button>
                  );
                }
              )

            )}

          </div>

        </aside>

        {/* ======================================================
            CHAT
        ====================================================== */}

        <section className="whatsapp-chat">

          {!selecionada ? (

            <div className="whatsapp-no-chat">

              <div>

                <MessageCircle size={42} />

                <div>
                  Selecione uma conversa
                </div>

              </div>

            </div>

          ) : (

            <>

              {/* CABEÇALHO */}

              <header className="whatsapp-chat-header">

                <div className="whatsapp-chat-user">

                  <div className="whatsapp-avatar">

                    {(selecionada.nome ||
                      "C")
                      .charAt(0)
                      .toUpperCase()}

                  </div>

                  <div className="whatsapp-chat-user-info">

                    <strong>
                      {selecionada.nome ||
                        "Cliente"}
                    </strong>

                    <span>
                      {formatarNumero(
                        selecionada.numero
                      )}
                    </span>

                  </div>

                </div>

                <div className="whatsapp-status">

                  <span className="whatsapp-status-dot" />

                  WhatsApp conectado

                </div>

              </header>

              {/* MENSAGENS */}

              <div className="whatsapp-messages">

                <div className="whatsapp-messages-inner">

                  {(
                    selecionada.mensagens ||
                    []
                  ).map(
                    (
                      item,
                      index
                    ) => {

                      const cliente =
                        item.papel ===
                        "cliente";

                      const fotos =
                        obterFotosMensagem(
                          item
                        );

                      return (
                        <div
                          key={`${index}-${item.texto || "foto"}`}
                          className={`whatsapp-message-row ${
                            cliente
                              ? "client"
                              : "assistant"
                          }`}
                        >

                          <div
                            className={`whatsapp-message ${
                              cliente
                                ? "client"
                                : "assistant"
                            }`}
                          >

                            {item.texto && (
                              <div className="whatsapp-message-text">
                                {item.texto}
                              </div>
                            )}

                            {fotos.map(
                              (
                                foto,
                                fotoIndex
                              ) => (

                                <img
                                  key={`${foto}-${fotoIndex}`}
                                  src={foto}
                                  alt="Imagem enviada pelo WhatsApp"
                                  className="whatsapp-message-photo"
                                  loading="lazy"
                                  onClick={() =>
                                    setFotoAberta(
                                      foto
                                    )
                                  }
                                  onError={(
                                    event
                                  ) => {
                                    (
                                      event.currentTarget as HTMLImageElement
                                    ).style.display =
                                      "none";
                                  }}
                                />

                              )
                            )}

                            {item.tipo &&
                              !item.texto &&
                              fotos.length ===
                                0 && (
                                <div className="whatsapp-message-text">
                                  📎 Mídia recebida
                                </div>
                              )}

                            <div className="whatsapp-message-time">
                              {formatarData(
                                item.em
                              )}
                            </div>

                          </div>

                        </div>
                      );
                    }
                  )}

                </div>

              </div>

              {/* ERRO */}

              {erro && (
                <div className="whatsapp-error">
                  {erro}
                </div>
              )}

              {/* COMPOSITOR */}

              <div className="whatsapp-compose">

                <div className="whatsapp-compose-inner">

                  <textarea
                    value={texto}
                    onChange={(event) =>
                      setTexto(
                        event.target.value
                      )
                    }
                    onKeyDown={(event) => {

                      if (
                        event.key ===
                          "Enter" &&
                        !event.shiftKey
                      ) {
                        event.preventDefault();

                        enviarMensagem();
                      }

                    }}
                    placeholder="Digite uma mensagem..."
                  />

                  <button
                    type="button"
                    className="whatsapp-send"
                    onClick={
                      enviarMensagem
                    }
                    disabled={
                      enviando ||
                      !texto.trim()
                    }
                    title="Enviar mensagem"
                  >

                    <Send size={18} />

                  </button>

                </div>

              </div>

            </>

          )}

        </section>

      </div>

      {/* ========================================================
          DETALHE DO CADASTRO
      ======================================================== */}

      {cadastroSelecionado && (

        <div
          className="cadastro-detalhe"
          onClick={() =>
            setCadastroSelecionado(null)
          }
        >

          <div
            className="cadastro-detalhe-card"
            onClick={(event) =>
              event.stopPropagation()
            }
          >

            <header className="cadastro-detalhe-header">

              <div>

                <strong>
                  {cadastroSelecionado.nomeCompleto ||
                    "Cadastro de entregador"}
                </strong>

                <div
                  style={{
                    marginTop: 3,
                    color: "#98a2b3",
                    fontSize: 9,
                  }}
                >
                  Dados coletados pela IA
                </div>

              </div>

              <button
                type="button"
                className="cadastro-fechar"
                onClick={() =>
                  setCadastroSelecionado(
                    null
                  )
                }
              >

                <X size={17} />

              </button>

            </header>

            <div className="cadastro-detalhe-body">

              {/* DADOS PRINCIPAIS */}

              <div className="cadastro-info-grid">

                <div className="cadastro-info">

                  <small>
                    STATUS
                  </small>

                  <strong>
                    {textoSeguro(
                      cadastroSelecionado.status
                    ) ||
                      "—"}
                  </strong>

                </div>

                <div className="cadastro-info">

                  <small>
                    ORIGEM
                  </small>

                  <strong>
                    {textoSeguro(
                      cadastroSelecionado.origem
                    ) ||
                      "WHATSAPP"}
                  </strong>

                </div>

                <div className="cadastro-info">

                  <small>
                    NOME COMPLETO
                  </small>

                  <strong>
                    {textoSeguro(
                      cadastroSelecionado.nomeCompleto
                    ) ||
                      "—"}
                  </strong>

                </div>

                <div className="cadastro-info">

                  <small>
                    WHATSAPP
                  </small>

                  <strong>
                    {formatarNumero(
                      cadastroSelecionado.numeroWhatsApp ||
                        ""
                    ) ||
                      "—"}
                  </strong>

                </div>

                <div className="cadastro-info">

                  <small>
                    TELEFONE
                  </small>

                  <strong>
                    {textoSeguro(
                      cadastroSelecionado.telefone
                    ) ||
                      "—"}
                  </strong>

                </div>

                <div className="cadastro-info">

                  <small>
                    TELEFONE PARA CONTATO
                  </small>

                  <strong>
                    {textoSeguro(
                      cadastroSelecionado.telefoneContato
                    ) ||
                      "—"}
                  </strong>

                </div>

                <div className="cadastro-info">

                  <small>
                    CPF
                  </small>

                  <strong>
                    {textoSeguro(
                      cadastroSelecionado.cpf
                    ) ||
                      "—"}
                  </strong>

                </div>

              </div>

              {/* ENDEREÇO */}

              <div className="cadastro-secao">

                <div className="cadastro-secao-title">

                  <MapPin size={14} />

                  ENDEREÇO

                </div>

                <div className="cadastro-info-grid">

                  <div className="cadastro-info">

                    <small>
                      CEP
                    </small>

                    <strong>
                      {textoSeguro(
                        cadastroSelecionado.cep
                      ) ||
                        "—"}
                    </strong>

                  </div>

                  <div className="cadastro-info">

                    <small>
                      RUA
                    </small>

                    <strong>
                      {textoSeguro(
                        cadastroSelecionado.rua
                      ) ||
                        "—"}
                    </strong>

                  </div>

                  <div className="cadastro-info">

                    <small>
                      NÚMERO
                    </small>

                    <strong>
                      {textoSeguro(
                        cadastroSelecionado.numero
                      ) ||
                        "—"}
                    </strong>

                  </div>

                </div>

              </div>

              {/* DADOS BANCÁRIOS */}

              <div className="cadastro-secao">

                <div className="cadastro-secao-title">

                  <CreditCard size={14} />

                  DADOS PARA PAGAMENTO

                </div>

                <div className="cadastro-info-grid">

                  <div className="cadastro-info">

                    <small>
                      CHAVE PIX
                    </small>

                    <strong>
                      {textoSeguro(
                        cadastroSelecionado.pix
                      ) ||
                        "—"}
                    </strong>

                  </div>

                  <div className="cadastro-info">

                    <small>
                      BANCO
                    </small>

                    <strong>
                      {textoSeguro(
                        cadastroSelecionado.banco
                      ) ||
                        "—"}
                    </strong>

                  </div>

                  <div className="cadastro-info">

                    <small>
                      FAVORECIDO
                    </small>

                    <strong>
                      {textoSeguro(
                        cadastroSelecionado.favorecido
                      ) ||
                        "—"}
                    </strong>

                  </div>

                </div>

              </div>

              {/* DATAS */}

              <div className="cadastro-secao">

                <div className="cadastro-secao-title">

                  <Clock size={14} />

                  CONTROLE

                </div>

                <div className="cadastro-info-grid">

                  <div className="cadastro-info">

                    <small>
                      CRIADO EM
                    </small>

                    <strong>
                      {formatarData(
                        cadastroSelecionado.criadoEm
                      ) ||
                        "—"}
                    </strong>

                  </div>

                  <div className="cadastro-info">

                    <small>
                      ATUALIZADO EM
                    </small>

                    <strong>
                      {formatarData(
                        cadastroSelecionado.atualizadoEm
                      ) ||
                        "—"}
                    </strong>

                  </div>

                </div>

              </div>

              {/* FOTOS */}

              {(() => {

                const fotos =
                  obterFotosCadastro(
                    cadastroSelecionado
                  );

                if (
                  fotos.length === 0
                ) {
                  return null;
                }

                return (
                  <div className="cadastro-secao">

                    <div className="cadastro-secao-title">

                      <Camera size={14} />

                      FOTOS DO CADASTRO

                    </div>

                    <div className="cadastro-fotos">

                      {fotos.map(
                        (
                          foto,
                          index
                        ) => (

                          <img
                            key={`${foto}-${index}`}
                            src={foto}
                            alt={`Foto do cadastro ${
                              index + 1
                            }`}
                            className="cadastro-foto"
                            loading="lazy"
                            onClick={() =>
                              setFotoAberta(
                                foto
                              )
                            }
                            onError={(
                              event
                            ) => {
                              (
                                event.currentTarget as HTMLImageElement
                              ).style.display =
                                "none";
                            }}
                          />

                        )
                      )}

                    </div>

                  </div>
                );

              })()}

            </div>

          </div>

        </div>

      )}

      {/* ========================================================
          MODAL DA FOTO
      ======================================================== */}

      {fotoAberta && (

        <div
          className="foto-modal"
          onClick={() =>
            setFotoAberta(null)
          }
        >

          <button
            type="button"
            className="foto-modal-close"
            onClick={(event) => {
              event.stopPropagation();

              setFotoAberta(null);
            }}
          >

            <X size={20} />

          </button>

          <img
            src={fotoAberta}
            alt="Visualização da imagem"
            onClick={(event) =>
              event.stopPropagation()
            }
          />

        </div>

      )}

    </div>
  );
}