// ============================================================
// PÁGINA: WhatsApp — Chat / Colaboradores / Parceiros
// ARQUIVO: src/pages/whatsapp.tsx
// ============================================================

import { useEffect, useMemo, useState } from "react";

import {
  collection,
  doc,
  onSnapshot,
  orderBy,
  query,
  Timestamp,
  updateDoc,
} from "firebase/firestore";

import {
  CheckCircle2,
  Clock3,
  Image as ImageIcon,
  MapPin,
  MessageCircle,
  Pencil,
  Search,
  Send,
  UserPlus,
  Building2,
  Phone,
  X,
  Save,
  Users,
  Handshake,
} from "lucide-react";

import { db } from "../services/firebase/firebase";

// ============================================================
// TIPOS
// ============================================================

type ValorData = Timestamp | Date | string | unknown;

type Mensagem = {
  papel?: "cliente" | "assistente" | string;
  texto?: string;
  tipo?: string;
  em?: ValorData;

  url?: string;
  mediaUrl?: string;
  imagemUrl?: string;
  fotoUrl?: string;
  imageUrl?: string;
  media?: string;
  imagem?: string;
  foto?: string;
};

type ParceiroConversa = {
  nomeEmpresa?: string;
  nomeResponsavel?: string;
  cidadeRegiao?: string;
  volumeDiario?: string;
  telefoneContato?: string;
  enviadoParaEquipe?: boolean;
};

type Conversa = {
  id: string;
  numero?: string;
  nome?: string;
  mensagens?: Mensagem[];

  atendimentoHumano?: boolean;
  atendimentoHumanoEm?: ValorData;

  ultimoCodigo?: string;

  parceiro?: ParceiroConversa;
  modo?: string;

  criadoEm?: ValorData;
  atualizadoEm?: ValorData;

  [key: string]: unknown;
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

  regiaoNome?: string;

  telefone?: string;
  telefoneContato?: string;

  cpf?: string;
  pix?: string;
  banco?: string;
  favorecido?: string;

  criadoEm?: ValorData;
  atualizadoEm?: ValorData;

  [key: string]: unknown;
};

type SolicitacaoParceiro = {
  id: string;

  nomeEmpresa?: string;
  nomeResponsavel?: string;
  cidadeRegiao?: string;
  volumeDiario?: string;
  telefoneContato?: string;

  numeroWhatsApp?: string;
  status?: string;
  origem?: string;

  criadoEm?: ValorData;
  atualizadoEm?: ValorData;

  [key: string]: unknown;
};

type Aba = "chat" | "colaboradores" | "parceiros";

// ============================================================
// FUNÇÕES
// ============================================================

function converterData(valor?: ValorData): Date | null {
  if (!valor) return null;

  try {
    if (valor instanceof Timestamp) {
      return valor.toDate();
    }

    if (valor instanceof Date) {
      return valor;
    }

    if (
      typeof valor === "object" &&
      valor !== null &&
      "toDate" in valor &&
      typeof (valor as { toDate?: unknown }).toDate === "function"
    ) {
      return (
        valor as {
          toDate: () => Date;
        }
      ).toDate();
    }

    const data = new Date(String(valor));

    if (Number.isNaN(data.getTime())) {
      return null;
    }

    return data;
  } catch {
    return null;
  }
}

function formatarData(valor?: ValorData) {
  const data = converterData(valor);

  if (!data) return "";

  return data.toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatarHora(valor?: ValorData) {
  const data = converterData(valor);

  if (!data) return "";

  return data.toLocaleTimeString("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatarNumero(numero?: string) {
  const n = String(numero || "").replace(/\D/g, "");

  if (n.length === 13) {
    return `+${n.slice(0, 2)} (${n.slice(2, 4)}) ${n.slice(
      4,
      9
    )}-${n.slice(9)}`;
  }

  if (n.length === 11) {
    return `(${n.slice(0, 2)}) ${n.slice(2, 7)}-${n.slice(7)}`;
  }

  return numero || "";
}

function valorTexto(valor: unknown) {
  if (valor === undefined || valor === null) {
    return "";
  }

  if (typeof valor === "object") {
    return "";
  }

  return String(valor);
}

function obterUrlImagem(mensagem: Mensagem) {
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

  const url = possiveis.find(
    (item) =>
      typeof item === "string" &&
      /^https?:\/\//i.test(item)
  );

  return url || "";
}

function statusClasse(status?: string) {
  const s = String(status || "").toUpperCase();

  if (
    s === "APROVADO" ||
    s === "ATIVO" ||
    s === "CONCLUIDO" ||
    s === "CONCLUÍDO"
  ) {
    return "success";
  }

  if (
    s === "PENDENTE" ||
    s === "EM_ANDAMENTO" ||
    s === "EM ANDAMENTO"
  ) {
    return "warning";
  }

  if (
    s === "RECUSADO" ||
    s === "CANCELADO" ||
    s === "CANCELADA"
  ) {
    return "danger";
  }

  return "neutral";
}

// ============================================================
// COMPONENTE
// ============================================================

export default function WhatsApp() {
  // ==========================================================
  // ABA
  // ==========================================================

  const [aba, setAba] = useState<Aba>("chat");

  // ==========================================================
  // CHAT
  // ==========================================================

  const [conversas, setConversas] = useState<Conversa[]>([]);
  const [selecionada, setSelecionada] =
    useState<Conversa | null>(null);

  const [buscaChat, setBuscaChat] = useState("");
  const [texto, setTexto] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [erroChat, setErroChat] = useState("");

  // ==========================================================
  // COLABORADORES
  // ==========================================================

  const [colaboradores, setColaboradores] =
    useState<CadastroEntregador[]>([]);

  const [colaboradorSelecionado, setColaboradorSelecionado] =
    useState<CadastroEntregador | null>(null);

  const [buscaColaborador, setBuscaColaborador] =
    useState("");

  const [editandoColaborador, setEditandoColaborador] =
    useState<CadastroEntregador | null>(null);

  const [salvandoColaborador, setSalvandoColaborador] =
    useState(false);

  const [mensagemColaborador, setMensagemColaborador] =
    useState("");

  // ==========================================================
  // PARCEIROS
  // ==========================================================

  const [parceiros, setParceiros] =
    useState<SolicitacaoParceiro[]>([]);

  const [parceiroSelecionado, setParceiroSelecionado] =
    useState<SolicitacaoParceiro | null>(null);

  const [buscaParceiro, setBuscaParceiro] =
    useState("");

  // ==========================================================
  // FIREBASE — CHAT
  // ==========================================================

  useEffect(() => {
    const referencia = collection(
      db,
      "whatsapp_conversas"
    );

    const consulta = query(
      referencia,
      orderBy("atualizadoEm", "desc")
    );

    return onSnapshot(
      consulta,
      (snapshot) => {
        const lista: Conversa[] =
          snapshot.docs.map((item) => ({
            id: item.id,
            ...(item.data() as Omit<
              Conversa,
              "id"
            >),
          }));

        setConversas(lista);

        setSelecionada((atual) => {
          if (!atual) {
            return lista[0] || null;
          }

          return (
            lista.find(
              (item) => item.id === atual.id
            ) ||
            lista[0] ||
            null
          );
        });
      },
      (error) => {
        console.error(
          "Erro ao carregar WhatsApp:",
          error
        );

        setErroChat(
          "Não foi possível carregar as conversas."
        );
      }
    );
  }, []);

  // ==========================================================
  // FIREBASE — COLABORADORES
  // ==========================================================

  useEffect(() => {
    const referencia = collection(
      db,
      "candidatos_entregadores"
    );

    const consulta = query(
      referencia,
      orderBy("atualizadoEm", "desc")
    );

    return onSnapshot(
      consulta,
      (snapshot) => {
        const lista: CadastroEntregador[] =
          snapshot.docs.map((item) => ({
            id: item.id,
            ...(item.data() as Omit<
              CadastroEntregador,
              "id"
            >),
          }));

        setColaboradores(lista);

        setColaboradorSelecionado((atual) => {
          if (!atual) {
            return lista[0] || null;
          }

          return (
            lista.find(
              (item) => item.id === atual.id
            ) ||
            lista[0] ||
            null
          );
        });
      },
      (error) => {
        console.error(
          "Erro colaboradores:",
          error
        );
      }
    );
  }, []);

  // ==========================================================
  // FIREBASE — PARCEIROS
  // ==========================================================

  useEffect(() => {
    const referencia = collection(
      db,
      "solicitacoes_parceiros"
    );

    const consulta = query(
      referencia,
      orderBy("criadoEm", "desc")
    );

    return onSnapshot(
      consulta,
      (snapshot) => {
        const lista: SolicitacaoParceiro[] =
          snapshot.docs.map((item) => ({
            id: item.id,
            ...(item.data() as Omit<
              SolicitacaoParceiro,
              "id"
            >),
          }));

        setParceiros(lista);

        setParceiroSelecionado((atual) => {
          if (!atual) {
            return lista[0] || null;
          }

          return (
            lista.find(
              (item) => item.id === atual.id
            ) ||
            lista[0] ||
            null
          );
        });
      },
      (error) => {
        console.error(
          "Erro parceiros:",
          error
        );
      }
    );
  }, []);

  // ==========================================================
  // FILTRO — CHAT
  // ==========================================================

  const conversasFiltradas = useMemo(() => {
    const termo =
      buscaChat.trim().toLowerCase();

    if (!termo) {
      return conversas;
    }

    return conversas.filter((conversa) => {
      const nome =
        String(
          conversa.nome || ""
        ).toLowerCase();

      const numero =
        String(
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
    });
  }, [conversas, buscaChat]);

  // ==========================================================
  // FILTRO — COLABORADORES
  // ==========================================================

  const colaboradoresFiltrados =
    useMemo(() => {
      const termo =
        buscaColaborador
          .trim()
          .toLowerCase();

      if (!termo) {
        return colaboradores;
      }

      return colaboradores.filter(
        (item) => {
          return [
            item.nomeCompleto,
            item.numeroWhatsApp,
            item.telefone,
            item.cpf,
            item.regiaoNome,
            item.pix,
          ].some((valor) =>
            String(valor || "")
              .toLowerCase()
              .includes(termo)
          );
        }
      );
    }, [
      colaboradores,
      buscaColaborador,
    ]);

  // ==========================================================
  // FILTRO — PARCEIROS
  // ==========================================================

  const parceirosFiltrados =
    useMemo(() => {
      const termo =
        buscaParceiro
          .trim()
          .toLowerCase();

      if (!termo) {
        return parceiros;
      }

      return parceiros.filter(
        (item) => {
          return [
            item.nomeEmpresa,
            item.nomeResponsavel,
            item.cidadeRegiao,
            item.volumeDiario,
            item.telefoneContato,
            item.numeroWhatsApp,
            item.status,
          ].some((valor) =>
            String(valor || "")
              .toLowerCase()
              .includes(termo)
          );
        }
      );
    }, [
      parceiros,
      buscaParceiro,
    ]);

  // ==========================================================
  // ENVIAR MENSAGEM
  // ==========================================================

  async function enviarMensagem() {
    if (
      !selecionada ||
      !texto.trim() ||
      enviando
    ) {
      return;
    }

    setEnviando(true);
    setErroChat("");

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
            "Erro ao enviar mensagem."
        );
      }

      setTexto("");
    } catch (error) {
      console.error(
        "Erro ao enviar mensagem:",
        error
      );

      setErroChat(
        error instanceof Error
          ? error.message
          : "Erro ao enviar mensagem."
      );
    } finally {
      setEnviando(false);
    }
  }

  // ==========================================================
  // EDITAR COLABORADOR
  // ==========================================================

  function iniciarEdicaoColaborador(
    colaborador: CadastroEntregador
  ) {
    setEditandoColaborador({
      ...colaborador,
    });

    setMensagemColaborador("");
  }

  function alterarCampoColaborador(
    campo: string,
    valor: string
  ) {
    setEditandoColaborador(
      (atual) => {
        if (!atual) {
          return null;
        }

        return {
          ...atual,
          [campo]: valor,
        };
      }
    );
  }

  async function salvarColaborador() {
    if (!editandoColaborador) {
      return;
    }

    setSalvandoColaborador(true);
    setMensagemColaborador("");

    try {
      const referencia = doc(
        db,
        "candidatos_entregadores",
        editandoColaborador.id
      );

      await updateDoc(
        referencia,
        {
          nomeCompleto:
            editandoColaborador.nomeCompleto ||
            "",

          cep:
            editandoColaborador.cep ||
            "",

          rua:
            editandoColaborador.rua ||
            "",

          numero:
            editandoColaborador.numero ||
            "",

          regiaoNome:
            editandoColaborador.regiaoNome ||
            "",

          telefone:
            editandoColaborador.telefone ||
            "",

          telefoneContato:
            editandoColaborador.telefoneContato ||
            "",

          cpf:
            editandoColaborador.cpf ||
            "",

          pix:
            editandoColaborador.pix ||
            "",

          banco:
            editandoColaborador.banco ||
            "",

          favorecido:
            editandoColaborador.favorecido ||
            "",

          atualizadoEm:
            Timestamp.now(),
        }
      );

      setColaboradorSelecionado({
        ...editandoColaborador,
        atualizadoEm:
          Timestamp.now(),
      });

      setEditandoColaborador(null);

      setMensagemColaborador(
        "Alterações salvas com sucesso."
      );
    } catch (error) {
      console.error(
        "Erro ao salvar colaborador:",
        error
      );

      setMensagemColaborador(
        "Erro ao salvar alterações."
      );
    } finally {
      setSalvandoColaborador(false);
    }
  }

  // ==========================================================
  // RENDER
  // ==========================================================

  return (
    <div className="aguia-whatsapp-page">

      <style>{`

        * {
          box-sizing: border-box;
        }

        .aguia-whatsapp-page {
          width: 100%;
          height: calc(100vh - 132px);
          min-height: 0;

          display: flex;
          flex-direction: column;

          gap: 12px;

          overflow: hidden;
        }

        /* =====================================================
           TABS
        ===================================================== */

        .aw-tabs {
          height: 48px;
          min-height: 48px;

          display: flex;
          align-items: center;

          gap: 4px;

          padding: 4px;

          background: #ffffff;

          border: 1px solid #eaecf0;
          border-radius: 12px;
        }

        .aw-tab {
          height: 38px;

          padding: 0 18px;

          display: flex;
          align-items: center;
          justify-content: center;

          gap: 8px;

          border: 0;
          border-radius: 9px;

          background: transparent;

          color: #667085;

          font-family: inherit;
          font-size: 12px;
          font-weight: 700;

          cursor: pointer;

          transition: .15s ease;
        }

        .aw-tab:hover {
          background: #f9fafb;
          color: #101828;
        }

        .aw-tab.active {
          background: #111827;
          color: #ffffff;
        }

        .aw-tab-count {
          min-width: 20px;
          height: 20px;

          padding: 0 6px;

          display: flex;
          align-items: center;
          justify-content: center;

          border-radius: 20px;

          background: #f2f4f7;
          color: #667085;

          font-size: 9px;
          font-weight: 800;
        }

        .aw-tab.active .aw-tab-count {
          background: #ffffff;
          color: #111827;
        }

        /* =====================================================
           CHAT
        ===================================================== */

        .aw-chat {
          flex: 1;
          min-height: 0;

          display: flex;

          overflow: hidden;

          background: #ffffff;

          border: 1px solid #eaecf0;
          border-radius: 12px;
        }

        .aw-chat-list {
          width: 320px;
          min-width: 320px;

          display: flex;
          flex-direction: column;

          border-right: 1px solid #eaecf0;
        }

        .aw-chat-list-header {
          padding: 16px;

          border-bottom: 1px solid #eaecf0;
        }

        .aw-chat-title {
          display: flex;
          align-items: center;

          gap: 10px;

          margin-bottom: 13px;
        }

        .aw-chat-title-icon {
          width: 36px;
          height: 36px;

          display: flex;
          align-items: center;
          justify-content: center;

          border-radius: 10px;

          background: #111827;
          color: #ffffff;
        }

        .aw-chat-title strong {
          display: block;

          color: #101828;

          font-size: 15px;
          font-weight: 800;
        }

        .aw-chat-title span {
          display: block;

          margin-top: 2px;

          color: #98a2b3;

          font-size: 10px;
        }

        .aw-search {
          position: relative;
        }

        .aw-search svg {
          position: absolute;

          left: 11px;
          top: 10px;

          color: #98a2b3;
        }

        .aw-search input {
          width: 100%;
          height: 36px;

          padding: 0 10px 0 34px;

          border: 1px solid #eaecf0;
          border-radius: 9px;

          outline: none;

          background: #f9fafb;

          color: #101828;

          font-family: inherit;
          font-size: 11px;
        }

        .aw-search input:focus {
          border-color: #c9a227;
          background: #ffffff;
        }

        .aw-chat-list-items {
          flex: 1;
          min-height: 0;

          overflow-y: auto;
        }

        .aw-conversation {
          width: 100%;

          padding: 12px;

          display: flex;
          align-items: center;

          gap: 10px;

          border: 0;
          border-bottom: 1px solid #f2f4f7;

          background: #ffffff;

          text-align: left;

          cursor: pointer;
        }

        .aw-conversation:hover {
          background: #f9fafb;
        }

        .aw-conversation.active {
          background: #f2f4f7;

          box-shadow:
            inset 3px 0 0 #c9a227;
        }

        .aw-avatar {
          width: 38px;
          height: 38px;
          min-width: 38px;

          display: flex;
          align-items: center;
          justify-content: center;

          border-radius: 50%;

          background: #f2f4f7;
          color: #475467;
        }

        .aw-conversation-info {
          min-width: 0;
          flex: 1;
        }

        .aw-conversation-top {
          display: flex;
          justify-content: space-between;
          gap: 8px;
        }

        .aw-conversation-name {
          min-width: 0;

          overflow: hidden;

          color: #101828;

          font-size: 12px;
          font-weight: 800;

          white-space: nowrap;
          text-overflow: ellipsis;
        }

        .aw-conversation-time {
          flex-shrink: 0;

          color: #98a2b3;

          font-size: 8px;
        }

        .aw-conversation-number {
          margin-top: 2px;

          color: #98a2b3;

          font-size: 9px;
        }

        .aw-conversation-last {
          margin-top: 4px;

          overflow: hidden;

          color: #667085;

          font-size: 9px;

          white-space: nowrap;
          text-overflow: ellipsis;
        }

        .aw-human {
          display: inline-flex;

          margin-top: 5px;

          padding: 2px 6px;

          border-radius: 20px;

          background: #ecfdf3;
          color: #15803d;

          font-size: 7px;
          font-weight: 800;
        }

        /* =====================================================
           CHAT AREA
        ===================================================== */

        .aw-chat-area {
          flex: 1;
          min-width: 0;

          display: flex;
          flex-direction: column;

          overflow: hidden;
        }

        .aw-chat-header {
          min-height: 66px;

          padding: 12px 16px;

          display: flex;
          align-items: center;
          justify-content: space-between;

          gap: 12px;

          border-bottom: 1px solid #eaecf0;
        }

        .aw-chat-user {
          min-width: 0;

          display: flex;
          align-items: center;

          gap: 10px;
        }

        .aw-chat-user-avatar {
          width: 38px;
          height: 38px;

          display: flex;
          align-items: center;
          justify-content: center;

          flex-shrink: 0;

          border-radius: 50%;

          background: #111827;
          color: #ffffff;
        }

        .aw-chat-user-info {
          min-width: 0;
        }

        .aw-chat-user-info strong {
          display: block;

          overflow: hidden;

          color: #101828;

          font-size: 13px;
          font-weight: 800;

          white-space: nowrap;
          text-overflow: ellipsis;
        }

        .aw-chat-user-info span {
          display: block;

          margin-top: 2px;

          color: #98a2b3;

          font-size: 9px;
        }

        .aw-online {
          display: flex;
          align-items: center;

          gap: 5px;

          padding: 5px 8px;

          border-radius: 20px;

          background: #ecfdf3;
          color: #15803d;

          font-size: 8px;
          font-weight: 800;
        }

        .aw-online-dot {
          width: 5px;
          height: 5px;

          border-radius: 50%;

          background: #22c55e;
        }

        .aw-messages {
          flex: 1;
          min-height: 0;

          overflow-y: auto;

          padding: 20px;

          background: #f5f6f8;
        }

        .aw-messages-inner {
          max-width: 900px;

          margin: 0 auto;

          display: flex;
          flex-direction: column;

          gap: 8px;
        }

        .aw-message-row {
          display: flex;
          width: 100%;
        }

        .aw-message-row.client {
          justify-content: flex-start;
        }

        .aw-message-row.assistant {
          justify-content: flex-end;
        }

        .aw-message {
          max-width: 72%;

          padding: 9px 12px;

          border-radius: 13px;

          box-shadow:
            0 1px 2px rgba(16,24,40,.05);
        }

        .aw-message.client {
          background: #ffffff;
          color: #344054;

          border-top-left-radius: 4px;
        }

        .aw-message.assistant {
          background: #111827;
          color: #ffffff;

          border-top-right-radius: 4px;
        }

        .aw-message-text {
          white-space: pre-wrap;
          word-break: break-word;

          font-size: 11px;
          line-height: 1.55;
        }

        .aw-message-image {
          display: block;

          max-width: 280px;
          max-height: 350px;

          margin-bottom: 6px;

          border-radius: 9px;

          object-fit: contain;

          cursor: pointer;
        }

        .aw-message-time {
          margin-top: 4px;

          color: #98a2b3;

          font-size: 7px;

          text-align: right;
        }

        .aw-message.assistant
        .aw-message-time {
          color: #cbd5e1;
        }

        .aw-compose {
          min-height: 62px;

          padding: 10px;

          display: flex;
          align-items: flex-end;

          gap: 8px;

          border-top: 1px solid #eaecf0;

          background: #ffffff;
        }

        .aw-compose textarea {
          flex: 1;

          min-height: 42px;
          max-height: 110px;

          padding: 11px 12px;

          resize: none;

          border: 1px solid #eaecf0;
          border-radius: 10px;

          outline: none;

          background: #f9fafb;

          color: #101828;

          font-family: inherit;
          font-size: 11px;
        }

        .aw-compose textarea:focus {
          border-color: #c9a227;
          background: #ffffff;
        }

        .aw-send {
          width: 42px;
          height: 42px;

          display: flex;
          align-items: center;
          justify-content: center;

          flex-shrink: 0;

          border: 0;
          border-radius: 10px;

          background: #111827;
          color: #ffffff;

          cursor: pointer;
        }

        .aw-send:hover {
          opacity: .9;
        }

        .aw-send:disabled {
          opacity: .45;
          cursor: not-allowed;
        }

        .aw-error {
          padding: 7px 12px;

          color: #b42318;

          background: #fef3f2;

          border-top: 1px solid #fecdca;

          font-size: 9px;
        }

        /* =====================================================
           CADASTROS
        ===================================================== */

        .aw-register {
          flex: 1;
          min-height: 0;

          display: flex;

          overflow: hidden;

          background: #ffffff;

          border: 1px solid #eaecf0;
          border-radius: 12px;
        }

        .aw-register-list {
          width: 350px;
          min-width: 350px;

          display: flex;
          flex-direction: column;

          border-right: 1px solid #eaecf0;
        }

        .aw-register-list-header {
          padding: 16px;

          border-bottom: 1px solid #eaecf0;
        }

        .aw-register-title {
          display: flex;
          align-items: center;

          gap: 10px;

          margin-bottom: 13px;
        }

        .aw-register-icon {
          width: 36px;
          height: 36px;

          display: flex;
          align-items: center;
          justify-content: center;

          border-radius: 10px;

          background: #111827;
          color: #ffffff;
        }

        .aw-register-title strong {
          display: block;

          color: #101828;

          font-size: 15px;
          font-weight: 800;
        }

        .aw-register-title span {
          display: block;

          margin-top: 2px;

          color: #98a2b3;

          font-size: 10px;
        }

        .aw-register-items {
          flex: 1;
          min-height: 0;

          overflow-y: auto;
        }

        .aw-register-item {
          width: 100%;

          padding: 13px;

          display: flex;
          align-items: center;

          gap: 10px;

          border: 0;
          border-bottom: 1px solid #f2f4f7;

          background: #ffffff;

          text-align: left;

          cursor: pointer;
        }

        .aw-register-item:hover {
          background: #f9fafb;
        }

        .aw-register-item.active {
          background: #f2f4f7;

          box-shadow:
            inset 3px 0 0 #c9a227;
        }

        .aw-register-avatar {
          width: 40px;
          height: 40px;
          min-width: 40px;

          display: flex;
          align-items: center;
          justify-content: center;

          border-radius: 50%;

          background: #f2f4f7;
          color: #475467;
        }

        .aw-register-item-info {
          min-width: 0;
          flex: 1;
        }

        .aw-register-item-name {
          overflow: hidden;

          color: #101828;

          font-size: 11px;
          font-weight: 800;

          white-space: nowrap;
          text-overflow: ellipsis;
        }

        .aw-register-item-sub {
          margin-top: 3px;

          color: #98a2b3;

          font-size: 9px;

          overflow: hidden;
          white-space: nowrap;
          text-overflow: ellipsis;
        }

        .aw-details {
          flex: 1;
          min-width: 0;

          overflow-y: auto;

          padding: 24px;
        }

        .aw-details-header {
          display: flex;
          align-items: center;
          justify-content: space-between;

          gap: 15px;

          margin-bottom: 22px;
        }

        .aw-details-person {
          display: flex;
          align-items: center;

          gap: 12px;

          min-width: 0;
        }

        .aw-details-avatar {
          width: 52px;
          height: 52px;
          min-width: 52px;

          display: flex;
          align-items: center;
          justify-content: center;

          border-radius: 14px;

          background: #111827;
          color: #ffffff;
        }

        .aw-details-person strong {
          display: block;

          color: #101828;

          font-size: 16px;
          font-weight: 800;
        }

        .aw-details-person span {
          display: block;

          margin-top: 3px;

          color: #98a2b3;

          font-size: 10px;
        }

        .aw-edit-button {
          height: 36px;

          padding: 0 12px;

          display: flex;
          align-items: center;

          gap: 6px;

          border: 1px solid #eaecf0;
          border-radius: 9px;

          background: #ffffff;

          color: #344054;

          font-family: inherit;
          font-size: 10px;
          font-weight: 700;

          cursor: pointer;
        }

        .aw-edit-button:hover {
          background: #f9fafb;
        }

        .aw-detail-grid {
          display: grid;

          grid-template-columns:
            repeat(2, minmax(0, 1fr));

          gap: 10px;
        }

        .aw-detail-card {
          padding: 13px;

          border: 1px solid #eaecf0;
          border-radius: 10px;

          background: #ffffff;
        }

        .aw-detail-label {
          display: flex;
          align-items: center;

          gap: 5px;

          margin-bottom: 5px;

          color: #98a2b3;

          font-size: 8px;
          font-weight: 800;

          text-transform: uppercase;
        }

        .aw-detail-value {
          color: #101828;

          font-size: 11px;
          font-weight: 700;

          word-break: break-word;
        }

        .aw-status {
          display: inline-flex;
          align-items: center;

          padding: 4px 8px;

          border-radius: 20px;

          font-size: 8px;
          font-weight: 800;
        }

        .aw-status.success {
          background: #ecfdf3;
          color: #15803d;
        }

        .aw-status.warning {
          background: #fffaeb;
          color: #b54708;
        }

        .aw-status.danger {
          background: #fef3f2;
          color: #b42318;
        }

        .aw-status.neutral {
          background: #f2f4f7;
          color: #475467;
        }

        /* =====================================================
           MODAL EDIÇÃO
        ===================================================== */

        .aw-modal-overlay {
          position: fixed;

          inset: 0;

          z-index: 9999;

          display: flex;
          align-items: center;
          justify-content: center;

          padding: 20px;

          background: rgba(16,24,40,.45);
        }

        .aw-modal {
          width: min(760px, 100%);
          max-height: 90vh;

          display: flex;
          flex-direction: column;

          overflow: hidden;

          background: #ffffff;

          border-radius: 14px;

          box-shadow:
            0 20px 50px rgba(16,24,40,.18);
        }

        .aw-modal-header {
          padding: 16px 18px;

          display: flex;
          align-items: center;
          justify-content: space-between;

          border-bottom: 1px solid #eaecf0;
        }

        .aw-modal-header strong {
          color: #101828;

          font-size: 14px;
          font-weight: 800;
        }

        .aw-close {
          width: 30px;
          height: 30px;

          display: flex;
          align-items: center;
          justify-content: center;

          border: 0;
          border-radius: 8px;

          background: #f2f4f7;

          color: #667085;

          cursor: pointer;
        }

        .aw-modal-body {
          padding: 18px;

          overflow-y: auto;
        }

        .aw-form-grid {
          display: grid;

          grid-template-columns:
            repeat(2, minmax(0, 1fr));

          gap: 12px;
        }

        .aw-field {
          display: flex;
          flex-direction: column;

          gap: 5px;
        }

        .aw-field.full {
          grid-column: 1 / -1;
        }

        .aw-field label {
          color: #475467;

          font-size: 9px;
          font-weight: 800;
        }

        .aw-field input {
          width: 100%;
          height: 38px;

          padding: 0 10px;

          border: 1px solid #eaecf0;
          border-radius: 8px;

          outline: none;

          color: #101828;

          font-family: inherit;
          font-size: 10px;
        }

        .aw-field input:focus {
          border-color: #c9a227;
        }

        .aw-modal-footer {
          padding: 12px 18px;

          display: flex;
          align-items: center;
          justify-content: space-between;

          gap: 10px;

          border-top: 1px solid #eaecf0;
        }

        .aw-save {
          height: 36px;

          padding: 0 14px;

          display: flex;
          align-items: center;

          gap: 7px;

          border: 0;
          border-radius: 9px;

          background: #111827;
          color: #ffffff;

          font-family: inherit;
          font-size: 10px;
          font-weight: 800;

          cursor: pointer;
        }

        .aw-save:disabled {
          opacity: .5;
          cursor: not-allowed;
        }

        .aw-success-message {
          color: #15803d;

          font-size: 9px;
          font-weight: 700;
        }

        /* =====================================================
           VAZIO
        ===================================================== */

        .aw-empty {
          flex: 1;

          display: flex;
          align-items: center;
          justify-content: center;

          text-align: center;

          color: #98a2b3;

          font-size: 11px;
        }

        .aw-empty svg {
          display: block;

          margin: 0 auto 8px;
        }

        /* =====================================================
           RESPONSIVO
        ===================================================== */

        @media (max-width: 900px) {

          .aw-chat-list,
          .aw-register-list {
            width: 280px;
            min-width: 280px;
          }

          .aw-message {
            max-width: 82%;
          }

          .aw-detail-grid {
            grid-template-columns: 1fr;
          }
        }

        @media (max-width: 650px) {

          .aw-tabs {
            overflow-x: auto;
          }

          .aw-tab {
            padding: 0 12px;
            flex-shrink: 0;
          }

          .aw-chat-list,
          .aw-register-list {
            width: 85px;
            min-width: 85px;
          }

          .aw-chat-list-header,
          .aw-register-list-header {
            padding: 10px;
          }

          .aw-chat-title strong,
          .aw-chat-title span,
          .aw-search,
          .aw-register-title strong,
          .aw-register-title span {
            display: none;
          }

          .aw-chat-title,
          .aw-register-title {
            justify-content: center;
          }

          .aw-conversation,
          .aw-register-item {
            justify-content: center;
            padding: 10px 5px;
          }

          .aw-conversation-info,
          .aw-register-item-info {
            display: none;
          }

          .aw-chat-header {
            padding: 10px 12px;
          }

          .aw-online {
            display: none;
          }

          .aw-messages {
            padding: 12px;
          }

          .aw-message {
            max-width: 88%;
          }

          .aw-compose {
            padding: 8px;
          }

          .aw-details {
            padding: 14px;
          }

          .aw-details-header {
            align-items: flex-start;
          }

          .aw-details-person strong {
            font-size: 13px;
          }

          .aw-form-grid {
            grid-template-columns: 1fr;
          }

          .aw-field.full {
            grid-column: auto;
          }
        }

      `}</style>

      {/* ========================================================
          ABAS
      ======================================================== */}

      <div className="aw-tabs">

        <button
          className={
            aba === "chat"
              ? "aw-tab active"
              : "aw-tab"
          }
          onClick={() =>
            setAba("chat")
          }
        >
          <MessageCircle size={15} />
          Chat

          <span className="aw-tab-count">
            {conversas.length}
          </span>
        </button>

        <button
          className={
            aba === "colaboradores"
              ? "aw-tab active"
              : "aw-tab"
          }
          onClick={() =>
            setAba("colaboradores")
          }
        >
          <Users size={15} />
          Colaboradores

          <span className="aw-tab-count">
            {colaboradores.length}
          </span>
        </button>

        <button
          className={
            aba === "parceiros"
              ? "aw-tab active"
              : "aw-tab"
          }
          onClick={() =>
            setAba("parceiros")
          }
        >
          <Handshake size={15} />
          Parceiros

          <span className="aw-tab-count">
            {parceiros.length}
          </span>
        </button>

      </div>

      {/* ========================================================
          CHAT
      ======================================================== */}

      {aba === "chat" && (
        <div className="aw-chat">

          {/* LISTA */}

          <aside className="aw-chat-list">

            <div className="aw-chat-list-header">

              <div className="aw-chat-title">

                <div className="aw-chat-title-icon">
                  <MessageCircle size={19} />
                </div>

                <div>
                  <strong>Chat</strong>
                  <span>
                    Atendimento Águia Express
                  </span>
                </div>

              </div>

              <div className="aw-search">

                <Search size={14} />

                <input
                  value={buscaChat}
                  onChange={(event) =>
                    setBuscaChat(
                      event.target.value
                    )
                  }
                  placeholder="Pesquisar conversa..."
                />

              </div>

            </div>

            <div className="aw-chat-list-items">

              {conversasFiltradas.length === 0 ? (
                <div className="aw-empty">
                  <div>
                    <MessageCircle
                      size={25}
                    />
                    Nenhuma conversa encontrada.
                  </div>
                </div>
              ) : (
                conversasFiltradas.map(
                  (conversa) => {

                    const ultima =
                      conversa.mensagens?.[
                        conversa.mensagens.length - 1
                      ];

                    return (
                      <button
                        key={conversa.id}
                        className={
                          selecionada?.id ===
                          conversa.id
                            ? "aw-conversation active"
                            : "aw-conversation"
                        }
                        onClick={() =>
                          setSelecionada(
                            conversa
                          )
                        }
                      >

                        <div className="aw-avatar">
                          <MessageCircle
                            size={17}
                          />
                        </div>

                        <div className="aw-conversation-info">

                          <div className="aw-conversation-top">

                            <span className="aw-conversation-name">
                              {conversa.nome ||
                                "Cliente"}
                            </span>

                            <span className="aw-conversation-time">
                              {formatarHora(
                                conversa.atualizadoEm
                              )}
                            </span>

                          </div>

                          <div className="aw-conversation-number">
                            {formatarNumero(
                              conversa.numero
                            )}
                          </div>

                          <div className="aw-conversation-last">
                            {ultima?.texto ||
                              "Sem mensagens"}
                          </div>

                          {conversa.atendimentoHumano && (
                            <span className="aw-human">
                              Atendimento humano
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

          {/* CHAT */}

          <section className="aw-chat-area">

            {!selecionada ? (
              <div className="aw-empty">
                <div>
                  <MessageCircle
                    size={35}
                  />
                  Selecione uma conversa.
                </div>
              </div>
            ) : (
              <>
                <header className="aw-chat-header">

                  <div className="aw-chat-user">

                    <div className="aw-chat-user-avatar">
                      <MessageCircle
                        size={18}
                      />
                    </div>

                    <div className="aw-chat-user-info">

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

                  <div className="aw-online">

                    <span className="aw-online-dot" />

                    WhatsApp conectado

                  </div>

                </header>

                <div className="aw-messages">

                  <div className="aw-messages-inner">

                    {(selecionada.mensagens ||
                      []).map(
                      (mensagem, index) => {

                        const ehAssistente =
                          mensagem.papel ===
                          "assistente";

                        const imagem =
                          obterUrlImagem(
                            mensagem
                          );

                        return (
                          <div
                            key={`${selecionada.id}-${index}`}
                            className={
                              ehAssistente
                                ? "aw-message-row assistant"
                                : "aw-message-row client"
                            }
                          >

                            <div
                              className={
                                ehAssistente
                                  ? "aw-message assistant"
                                  : "aw-message client"
                              }
                            >

                              {imagem && (
                                <img
                                  src={imagem}
                                  alt="Imagem enviada pelo WhatsApp"
                                  className="aw-message-image"
                                  onClick={() =>
                                    window.open(
                                      imagem,
                                      "_blank",
                                      "noopener,noreferrer"
                                    )
                                  }
                                />
                              )}

                              {mensagem.texto && (
                                <div className="aw-message-text">
                                  {mensagem.texto}
                                </div>
                              )}

                              {!mensagem.texto &&
                                !imagem && (
                                  <div className="aw-message-text">
                                    {mensagem.tipo ||
                                      "Mensagem"}
                                  </div>
                                )}

                              <div className="aw-message-time">
                                {formatarHora(
                                  mensagem.em
                                )}
                              </div>

                            </div>

                          </div>
                        );
                      }
                    )}

                  </div>

                </div>

                {erroChat && (
                  <div className="aw-error">
                    {erroChat}
                  </div>
                )}

                <div className="aw-compose">

                  <textarea
                    value={texto}
                    onChange={(event) =>
                      setTexto(
                        event.target.value
                      )
                    }
                    onKeyDown={(event) => {
                      if (
                        event.key === "Enter" &&
                        !event.shiftKey
                      ) {
                        event.preventDefault();
                        enviarMensagem();
                      }
                    }}
                    placeholder="Digite uma mensagem..."
                  />

                  <button
                    className="aw-send"
                    disabled={
                      enviando ||
                      !texto.trim()
                    }
                    onClick={
                      enviarMensagem
                    }
                  >
                    <Send size={17} />
                  </button>

                </div>
              </>
            )}

          </section>

        </div>
      )}

      {/* ========================================================
          COLABORADORES
      ======================================================== */}

      {aba === "colaboradores" && (
        <div className="aw-register">

          <aside className="aw-register-list">

            <div className="aw-register-list-header">

              <div className="aw-register-title">

                <div className="aw-register-icon">
                  <UserPlus size={18} />
                </div>

                <div>
                  <strong>
                    Colaboradores
                  </strong>

                  <span>
                    Cadastros recebidos pelo WhatsApp
                  </span>
                </div>

              </div>

              <div className="aw-search">

                <Search size={14} />

                <input
                  value={buscaColaborador}
                  onChange={(event) =>
                    setBuscaColaborador(
                      event.target.value
                    )
                  }
                  placeholder="Pesquisar..."
                />

              </div>

            </div>

            <div className="aw-register-items">

              {colaboradoresFiltrados.length ===
              0 ? (
                <div className="aw-empty">
                  <div>
                    <UserPlus size={25} />
                    Nenhum colaborador encontrado.
                  </div>
                </div>
              ) : (
                colaboradoresFiltrados.map(
                  (colaborador) => (
                    <button
                      key={colaborador.id}
                      className={
                        colaboradorSelecionado?.id ===
                        colaborador.id
                          ? "aw-register-item active"
                          : "aw-register-item"
                      }
                      onClick={() =>
                        setColaboradorSelecionado(
                          colaborador
                        )
                      }
                    >

                      <div className="aw-register-avatar">
                        <UserPlus size={17} />
                      </div>

                      <div className="aw-register-item-info">

                        <div className="aw-register-item-name">
                          {colaborador.nomeCompleto ||
                            "Sem nome"}
                        </div>

                        <div className="aw-register-item-sub">
                          {colaborador.regiaoNome ||
                            colaborador.telefone ||
                            "Cadastro"}
                        </div>

                      </div>

                    </button>
                  )
                )
              )}

            </div>

          </aside>

          <section className="aw-details">

            {!colaboradorSelecionado ? (
              <div className="aw-empty">
                <div>
                  <UserPlus size={35} />
                  Selecione um colaborador.
                </div>
              </div>
            ) : (
              <>

                <div className="aw-details-header">

                  <div className="aw-details-person">

                    <div className="aw-details-avatar">
                      <UserPlus size={23} />
                    </div>

                    <div>

                      <strong>
                        {colaboradorSelecionado.nomeCompleto ||
                          "Sem nome"}
                      </strong>

                      <span>
                        {colaboradorSelecionado.numeroWhatsApp ||
                          colaboradorSelecionado.telefone ||
                          "Sem telefone"}
                      </span>

                    </div>

                  </div>

                  <button
                    className="aw-edit-button"
                    onClick={() =>
                      iniciarEdicaoColaborador(
                        colaboradorSelecionado
                      )
                    }
                  >
                    <Pencil size={13} />
                    Editar cadastro
                  </button>

                </div>

                <div className="aw-detail-grid">

                  <div className="aw-detail-card">
                    <div className="aw-detail-label">
                      <UserPlus size={11} />
                      Nome completo
                    </div>
                    <div className="aw-detail-value">
                      {colaboradorSelecionado.nomeCompleto ||
                        "—"}
                    </div>
                  </div>

                  <div className="aw-detail-card">
                    <div className="aw-detail-label">
                      <Phone size={11} />
                      Telefone
                    </div>
                    <div className="aw-detail-value">
                      {colaboradorSelecionado.telefone ||
                        colaboradorSelecionado.telefoneContato ||
                        "—"}
                    </div>
                  </div>

                  <div className="aw-detail-card">
                    <div className="aw-detail-label">
                      CEP
                    </div>
                    <div className="aw-detail-value">
                      {colaboradorSelecionado.cep ||
                        "—"}
                    </div>
                  </div>

                  <div className="aw-detail-card">
                    <div className="aw-detail-label">
                      Número
                    </div>
                    <div className="aw-detail-value">
                      {colaboradorSelecionado.numero ||
                        "—"}
                    </div>
                  </div>

                  <div className="aw-detail-card">
                    <div className="aw-detail-label">
                      <MapPin size={11} />
                      Região
                    </div>
                    <div className="aw-detail-value">
                      {colaboradorSelecionado.regiaoNome ||
                        "—"}
                    </div>
                  </div>

                  <div className="aw-detail-card">
                    <div className="aw-detail-label">
                      CPF
                    </div>
                    <div className="aw-detail-value">
                      {colaboradorSelecionado.cpf ||
                        "—"}
                    </div>
                  </div>

                  <div className="aw-detail-card">
                    <div className="aw-detail-label">
                      Chave Pix
                    </div>
                    <div className="aw-detail-value">
                      {colaboradorSelecionado.pix ||
                        "—"}
                    </div>
                  </div>

                  <div className="aw-detail-card">
                    <div className="aw-detail-label">
                      Banco
                    </div>
                    <div className="aw-detail-value">
                      {colaboradorSelecionado.banco ||
                        "—"}
                    </div>
                  </div>

                  <div className="aw-detail-card">
                    <div className="aw-detail-label">
                      Favorecido
                    </div>
                    <div className="aw-detail-value">
                      {colaboradorSelecionado.favorecido ||
                        "—"}
                    </div>
                  </div>

                  <div className="aw-detail-card">
                    <div className="aw-detail-label">
                      Status
                    </div>

                    <div>
                      <span
                        className={`aw-status ${statusClasse(
                          colaboradorSelecionado.status
                        )}`}
                      >
                        {colaboradorSelecionado.status ||
                          "CADASTRO"}
                      </span>
                    </div>
                  </div>

                  <div className="aw-detail-card">
                    <div className="aw-detail-label">
                      Origem
                    </div>

                    <div className="aw-detail-value">
                      {colaboradorSelecionado.origem ||
                        "WHATSAPP"}
                    </div>
                  </div>

                  <div className="aw-detail-card">
                    <div className="aw-detail-label">
                      Cadastro
                    </div>

                    <div className="aw-detail-value">
                      {formatarData(
                        colaboradorSelecionado.criadoEm
                      ) || "—"}
                    </div>
                  </div>

                </div>

              </>
            )}

          </section>

        </div>
      )}

      {/* ========================================================
          PARCEIROS
      ======================================================== */}

      {aba === "parceiros" && (
        <div className="aw-register">

          <aside className="aw-register-list">

            <div className="aw-register-list-header">

              <div className="aw-register-title">

                <div className="aw-register-icon">
                  <Building2 size={18} />
                </div>

                <div>
                  <strong>
                    Parceiros
                  </strong>

                  <span>
                    Solicitações recebidas pelo WhatsApp
                  </span>
                </div>

              </div>

              <div className="aw-search">

                <Search size={14} />

                <input
                  value={buscaParceiro}
                  onChange={(event) =>
                    setBuscaParceiro(
                      event.target.value
                    )
                  }
                  placeholder="Pesquisar..."
                />

              </div>

            </div>

            <div className="aw-register-items">

              {parceirosFiltrados.length ===
              0 ? (
                <div className="aw-empty">
                  <div>
                    <Building2 size={25} />
                    Nenhum parceiro encontrado.
                  </div>
                </div>
              ) : (
                parceirosFiltrados.map(
                  (parceiro) => (
                    <button
                      key={parceiro.id}
                      className={
                        parceiroSelecionado?.id ===
                        parceiro.id
                          ? "aw-register-item active"
                          : "aw-register-item"
                      }
                      onClick={() =>
                        setParceiroSelecionado(
                          parceiro
                        )
                      }
                    >

                      <div className="aw-register-avatar">
                        <Building2 size={17} />
                      </div>

                      <div className="aw-register-item-info">

                        <div className="aw-register-item-name">
                          {parceiro.nomeEmpresa ||
                            "Empresa"}
                        </div>

                        <div className="aw-register-item-sub">
                          {parceiro.nomeResponsavel ||
                            parceiro.cidadeRegiao ||
                            "Solicitação"}
                        </div>

                      </div>

                    </button>
                  )
                )
              )}

            </div>

          </aside>

          <section className="aw-details">

            {!parceiroSelecionado ? (
              <div className="aw-empty">
                <div>
                  <Building2 size={35} />
                  Selecione um parceiro.
                </div>
              </div>
            ) : (
              <>

                <div className="aw-details-header">

                  <div className="aw-details-person">

                    <div className="aw-details-avatar">
                      <Building2 size={23} />
                    </div>

                    <div>

                      <strong>
                        {parceiroSelecionado.nomeEmpresa ||
                          "Empresa"}
                      </strong>

                      <span>
                        {parceiroSelecionado.nomeResponsavel ||
                          "Responsável não informado"}
                      </span>

                    </div>

                  </div>

                  <span
                    className={`aw-status ${statusClasse(
                      parceiroSelecionado.status
                    )}`}
                  >
                    {parceiroSelecionado.status ||
                      "PENDENTE"}
                  </span>

                </div>

                <div className="aw-detail-grid">

                  <div className="aw-detail-card">
                    <div className="aw-detail-label">
                      <Building2 size={11} />
                      Nome da empresa
                    </div>

                    <div className="aw-detail-value">
                      {parceiroSelecionado.nomeEmpresa ||
                        "—"}
                    </div>
                  </div>

                  <div className="aw-detail-card">
                    <div className="aw-detail-label">
                      <UserPlus size={11} />
                      Nome do responsável
                    </div>

                    <div className="aw-detail-value">
                      {parceiroSelecionado.nomeResponsavel ||
                        "—"}
                    </div>
                  </div>

                  <div className="aw-detail-card">
                    <div className="aw-detail-label">
                      <MapPin size={11} />
                      Cidade / Região
                    </div>

                    <div className="aw-detail-value">
                      {parceiroSelecionado.cidadeRegiao ||
                        "—"}
                    </div>
                  </div>

                  <div className="aw-detail-card">
                    <div className="aw-detail-label">
                      Volume diário
                    </div>

                    <div className="aw-detail-value">
                      {parceiroSelecionado.volumeDiario ||
                        "—"}
                    </div>
                  </div>

                  <div className="aw-detail-card">
                    <div className="aw-detail-label">
                      <Phone size={11} />
                      Telefone para contato
                    </div>

                    <div className="aw-detail-value">
                      {parceiroSelecionado.telefoneContato ||
                        "—"}
                    </div>
                  </div>

                  <div className="aw-detail-card">
                    <div className="aw-detail-label">
                      WhatsApp
                    </div>

                    <div className="aw-detail-value">
                      {formatarNumero(
                        parceiroSelecionado.numeroWhatsApp
                      ) || "—"}
                    </div>
                  </div>

                  <div className="aw-detail-card">
                    <div className="aw-detail-label">
                      Origem
                    </div>

                    <div className="aw-detail-value">
                      {parceiroSelecionado.origem ||
                        "WHATSAPP"}
                    </div>
                  </div>

                  <div className="aw-detail-card">
                    <div className="aw-detail-label">
                      Solicitação criada
                    </div>

                    <div className="aw-detail-value">
                      {formatarData(
                        parceiroSelecionado.criadoEm
                      ) || "—"}
                    </div>
                  </div>

                  <div className="aw-detail-card">
                    <div className="aw-detail-label">
                      Status
                    </div>

                    <div>
                      <span
                        className={`aw-status ${statusClasse(
                          parceiroSelecionado.status
                        )}`}
                      >
                        {parceiroSelecionado.status ||
                          "PENDENTE"}
                      </span>
                    </div>
                  </div>

                </div>

              </>
            )}

          </section>

        </div>
      )}

      {/* ========================================================
          MODAL — EDITAR COLABORADOR
      ======================================================== */}

      {editandoColaborador && (
        <div
          className="aw-modal-overlay"
          onMouseDown={(event) => {
            if (
              event.target ===
              event.currentTarget
            ) {
              setEditandoColaborador(null);
            }
          }}
        >

          <div className="aw-modal">

            <div className="aw-modal-header">

              <strong>
                Editar cadastro do colaborador
              </strong>

              <button
                className="aw-close"
                onClick={() =>
                  setEditandoColaborador(null)
                }
              >
                <X size={15} />
              </button>

            </div>

            <div className="aw-modal-body">

              <div className="aw-form-grid">

                <div className="aw-field full">
                  <label>
                    Nome completo
                  </label>

                  <input
                    value={
                      editandoColaborador.nomeCompleto ||
                      ""
                    }
                    onChange={(event) =>
                      alterarCampoColaborador(
                        "nomeCompleto",
                        event.target.value
                      )
                    }
                  />
                </div>

                <div className="aw-field">
                  <label>
                    CEP
                  </label>

                  <input
                    value={
                      editandoColaborador.cep ||
                      ""
                    }
                    onChange={(event) =>
                      alterarCampoColaborador(
                        "cep",
                        event.target.value
                      )
                    }
                  />
                </div>

                <div className="aw-field">
                  <label>
                    Número
                  </label>

                  <input
                    value={
                      editandoColaborador.numero ||
                      ""
                    }
                    onChange={(event) =>
                      alterarCampoColaborador(
                        "numero",
                        event.target.value
                      )
                    }
                  />
                </div>

                <div className="aw-field full">
                  <label>
                    Rua
                  </label>

                  <input
                    value={
                      editandoColaborador.rua ||
                      ""
                    }
                    onChange={(event) =>
                      alterarCampoColaborador(
                        "rua",
                        event.target.value
                      )
                    }
                  />
                </div>

                <div className="aw-field">
                  <label>
                    Região
                  </label>

                  <input
                    value={
                      editandoColaborador.regiaoNome ||
                      ""
                    }
                    onChange={(event) =>
                      alterarCampoColaborador(
                        "regiaoNome",
                        event.target.value
                      )
                    }
                  />
                </div>

                <div className="aw-field">
                  <label>
                    Telefone
                  </label>

                  <input
                    value={
                      editandoColaborador.telefone ||
                      ""
                    }
                    onChange={(event) =>
                      alterarCampoColaborador(
                        "telefone",
                        event.target.value
                      )
                    }
                  />
                </div>

                <div className="aw-field">
                  <label>
                    CPF
                  </label>

                  <input
                    value={
                      editandoColaborador.cpf ||
                      ""
                    }
                    onChange={(event) =>
                      alterarCampoColaborador(
                        "cpf",
                        event.target.value
                      )
                    }
                  />
                </div>

                <div className="aw-field">
                  <label>
                    Chave Pix
                  </label>

                  <input
                    value={
                      editandoColaborador.pix ||
                      ""
                    }
                    onChange={(event) =>
                      alterarCampoColaborador(
                        "pix",
                        event.target.value
                      )
                    }
                  />
                </div>

                <div className="aw-field">
                  <label>
                    Banco
                  </label>

                  <input
                    value={
                      editandoColaborador.banco ||
                      ""
                    }
                    onChange={(event) =>
                      alterarCampoColaborador(
                        "banco",
                        event.target.value
                      )
                    }
                  />
                </div>

                <div className="aw-field">
                  <label>
                    Nome do favorecido
                  </label>

                  <input
                    value={
                      editandoColaborador.favorecido ||
                      ""
                    }
                    onChange={(event) =>
                      alterarCampoColaborador(
                        "favorecido",
                        event.target.value
                      )
                    }
                  />
                </div>

              </div>

            </div>

            <div className="aw-modal-footer">

              <div className="aw-success-message">
                {mensagemColaborador}
              </div>

              <button
                className="aw-save"
                disabled={
                  salvandoColaborador
                }
                onClick={
                  salvarColaborador
                }
              >
                <Save size={14} />

                {salvandoColaborador
                  ? "Salvando..."
                  : "Salvar alterações"}
              </button>

            </div>

          </div>

        </div>
      )}

    </div>
  );
}