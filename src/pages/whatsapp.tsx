// ============================================================
// PÁGINA: WhatsApp + Cadastro Pendente
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
  Save,
  Search,
  Send,
  UserPlus,
  X,
} from "lucide-react";

import { db } from "../services/firebase/firebase";

// ============================================================
// TIPOS
// ============================================================

type Mensagem = {
  papel: "cliente" | "assistente";
  texto?: string;
  tipo?: string;
  em?: Timestamp | Date | string;

  url?: string;
  mediaUrl?: string;
  imagemUrl?: string;
  fotoUrl?: string;
  imageUrl?: string;
  media?: string;
  imagem?: string;
  foto?: string;
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

  regiaoEscolhida?: string;

  criadoEm?: Timestamp | Date | string;
  atualizadoEm?: Timestamp | Date | string;

  [key: string]: unknown;
};

// ============================================================
// REGIÕES
// ============================================================

const REGIOES = [
  "Barueri",
  "Jandira",
  "Itapevi",
  "Osasco",
  "Carapicuíba",
  "Santana de Parnaíba",
  "Alphaville",
];

// ============================================================
// FUNÇÕES
// ============================================================

function formatarData(valor?: unknown) {
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
      typeof (valor as any).toDate === "function"
    ) {
      data = (valor as any).toDate();
    } else {
      data = new Date(String(valor));
    }

    if (Number.isNaN(data.getTime())) return "";

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

function formatarNumero(numero: string) {
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

  return numero;
}

function obterFotosMensagem(mensagem: Mensagem) {
  const fotos: string[] = [];

  const campos = [
    mensagem.url,
    mensagem.mediaUrl,
    mensagem.imagemUrl,
    mensagem.fotoUrl,
    mensagem.imageUrl,
    mensagem.media,
    mensagem.imagem,
    mensagem.foto,
  ];

  campos.forEach((valor) => {
    if (
      typeof valor === "string" &&
      /^https?:\/\//i.test(valor)
    ) {
      fotos.push(valor);
    }
  });

  return [...new Set(fotos)];
}

// ============================================================
// COMPONENTE
// ============================================================

export default function WhatsApp() {
  const [aba, setAba] =
    useState<"whatsapp" | "cadastro">("whatsapp");

  // ----------------------------------------------------------
  // WHATSAPP
  // ----------------------------------------------------------

  const [conversas, setConversas] = useState<Conversa[]>([]);
  const [selecionada, setSelecionada] =
    useState<Conversa | null>(null);

  const [busca, setBusca] = useState("");
  const [texto, setTexto] = useState("");
  const [enviando, setEnviando] = useState(false);

  // ----------------------------------------------------------
  // CADASTROS
  // ----------------------------------------------------------

  const [cadastros, setCadastros] = useState<
    CadastroEntregador[]
  >([]);

  const [cadastroSelecionado, setCadastroSelecionado] =
    useState<CadastroEntregador | null>(null);

  const [buscaCadastro, setBuscaCadastro] = useState("");

  const [editando, setEditando] =
    useState<CadastroEntregador | null>(null);

  const [salvando, setSalvando] = useState(false);
  const [mensagemSalvar, setMensagemSalvar] =
    useState("");

  const [fotoAberta, setFotoAberta] =
    useState<string | null>(null);

  // ==========================================================
  // FIREBASE — WHATSAPP
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
            ...(item.data() as Omit<Conversa, "id">),
          }));

        setConversas(lista);

        setSelecionada((atual) => {
          if (!atual) return lista[0] || null;

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
        console.error("Erro WhatsApp:", error);
      }
    );
  }, []);

  // ==========================================================
  // FIREBASE — CADASTROS
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

        const pendentes = lista.filter((item) => {
          const status = String(
            item.status || ""
          ).toUpperCase();

          return (
            status === "PENDENTE" ||
            status === "EM_ANDAMENTO"
          );
        });

        setCadastros(pendentes);

        setCadastroSelecionado((atual) => {
          if (!atual) return pendentes[0] || null;

          return (
            pendentes.find(
              (item) => item.id === atual.id
            ) ||
            pendentes[0] ||
            null
          );
        });
      },
      (error) => {
        console.error("Erro cadastros:", error);
      }
    );
  }, []);

  // ==========================================================
  // FILTROS
  // ==========================================================

  const conversasFiltradas = useMemo(() => {
    const termo = busca.trim().toLowerCase();

    if (!termo) return conversas;

    return conversas.filter((conversa) => {
      const nome = String(
        conversa.nome || ""
      ).toLowerCase();

      const numero = String(
        conversa.numero || ""
      ).toLowerCase();

      const ultima =
        conversa.mensagens?.[
          conversa.mensagens.length - 1
        ]?.texto?.toLowerCase() || "";

      return (
        nome.includes(termo) ||
        numero.includes(termo) ||
        ultima.includes(termo)
      );
    });
  }, [conversas, busca]);

  const cadastrosFiltrados = useMemo(() => {
    const termo =
      buscaCadastro.trim().toLowerCase();

    if (!termo) return cadastros;

    return cadastros.filter((cadastro) => {
      return (
        String(cadastro.nomeCompleto || "")
          .toLowerCase()
          .includes(termo) ||
        String(cadastro.numeroWhatsApp || "")
          .toLowerCase()
          .includes(termo) ||
        String(cadastro.cpf || "")
          .toLowerCase()
          .includes(termo) ||
        String(cadastro.regiaoEscolhida || "")
          .toLowerCase()
          .includes(termo)
      );
    });
  }, [cadastros, buscaCadastro]);

  // ==========================================================
  // EDIÇÃO
  // ==========================================================

  function iniciarEdicao(
    cadastro: CadastroEntregador
  ) {
    setEditando({ ...cadastro });
    setMensagemSalvar("");
  }

  function alterarCampo(
    campo: string,
    valor: string
  ) {
    setEditando((atual) => {
      if (!atual) return null;

      return {
        ...atual,
        [campo]: valor,
      };
    });
  }

  // ==========================================================
  // SALVAR
  // ==========================================================

  async function salvarCadastro() {
    if (!editando) return;

    setSalvando(true);
    setMensagemSalvar("");

    try {
      const referencia = doc(
        db,
        "candidatos_entregadores",
        editando.id
      );

      await updateDoc(referencia, {
        nomeCompleto:
          editando.nomeCompleto || "",

        cep: editando.cep || "",
        rua: editando.rua || "",
        numero: editando.numero || "",

        telefone:
          editando.telefone || "",

        telefoneContato:
          editando.telefoneContato || "",

        cpf: editando.cpf || "",
        pix: editando.pix || "",
        banco: editando.banco || "",

        favorecido:
          editando.favorecido || "",

        regiaoEscolhida:
          editando.regiaoEscolhida || "",

        atualizadoEm: Timestamp.now(),
      });

      setCadastroSelecionado({
        ...editando,
        atualizadoEm: Timestamp.now(),
      });

      setEditando(null);

      setMensagemSalvar(
        "Alterações salvas com sucesso."
      );
    } catch (error) {
      console.error(error);

      setMensagemSalvar(
        "Erro ao salvar alterações."
      );
    } finally {
      setSalvando(false);
    }
  }

  // ==========================================================
  // ENVIAR
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
      console.error(error);
    } finally {
      setEnviando(false);
    }
  }

  // ==========================================================
  // LAYOUT
  // ==========================================================

  return (
    <div className="aguia-whatsapp">

      <style>{`

        /* ======================================================
           BASE
        ====================================================== */

        .aguia-whatsapp {
          width: 100%;
          height: calc(100vh - 132px);

          display: flex;
          flex-direction: column;

          gap: 12px;

          overflow: hidden;
        }

        /* ======================================================
           TABS
        ====================================================== */

        .aw-tabs {
          height: 46px;

          flex-shrink: 0;

          display: flex;
          align-items: center;

          padding: 4px;

          background: #fff;

          border: 1px solid #eaecf0;
          border-radius: 11px;
        }

        .aw-tab {
          height: 36px;

          padding: 0 18px;

          display: flex;
          align-items: center;
          justify-content: center;

          gap: 7px;

          border: 0;
          border-radius: 8px;

          background: transparent;

          color: #667085;

          font-size: 10px;
          font-weight: 800;

          cursor: pointer;
        }

        .aw-tab.active {
          background: #111827;

          color: #fff;
        }

        .aw-count {
          min-width: 18px;
          height: 18px;

          display: inline-flex;
          align-items: center;
          justify-content: center;

          padding: 0 5px;

          border-radius: 20px;

          background: #c9a227;

          color: #fff;

          font-size: 8px;
        }

        /* ======================================================
           PAINEL
        ====================================================== */

        .aw-panel {
          flex: 1;

          min-height: 0;

          display: flex;

          overflow: hidden;

          background: #fff;

          border: 1px solid #eaecf0;
          border-radius: 15px;
        }

        /* ======================================================
           SIDEBAR
        ====================================================== */

        .aw-sidebar {
          width: 330px;
          min-width: 330px;

          display: flex;
          flex-direction: column;

          min-height: 0;

          background: #fff;

          border-right: 1px solid #eaecf0;
        }

        .aw-sidebar-header {
          padding: 17px;

          flex-shrink: 0;

          border-bottom: 1px solid #eaecf0;
        }

        .aw-heading {
          display: flex;
          align-items: center;

          gap: 10px;
        }

        .aw-heading-icon {
          width: 38px;
          height: 38px;

          display: flex;
          align-items: center;
          justify-content: center;

          flex-shrink: 0;

          border-radius: 10px;

          background: #111827;

          color: #fff;
        }

        .aw-heading-text {
          min-width: 0;
        }

        .aw-heading-text strong {
          display: block;

          color: #101828;

          font-size: 13px;
          font-weight: 800;
        }

        .aw-heading-text span {
          display: block;

          margin-top: 3px;

          color: #98a2b3;

          font-size: 9px;
        }

        .aw-search {
          position: relative;

          margin-top: 14px;
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

          border-radius: 8px;

          outline: none;

          background: #f9fafb;

          color: #101828;

          font-family: inherit;

          font-size: 10px;
        }

        .aw-search input:focus {
          border-color: #c9a227;

          background: #fff;
        }

        /* ======================================================
           LISTA
        ====================================================== */

        .aw-list {
          flex: 1;

          min-height: 0;

          overflow-y: auto;

          scrollbar-width: thin;
        }

        .aw-list-item {
          width: 100%;

          min-height: 68px;

          padding: 11px 13px;

          display: flex;
          align-items: center;

          gap: 10px;

          border: 0;
          border-bottom: 1px solid #f2f4f7;

          background: #fff;

          text-align: left;

          cursor: pointer;
        }

        .aw-list-item:hover {
          background: #f9fafb;
        }

        .aw-list-item.active {
          background: #f2f4f7;

          box-shadow:
            inset 3px 0 #c9a227;
        }

        .aw-avatar {
          width: 39px;
          height: 39px;

          min-width: 39px;

          display: flex;
          align-items: center;
          justify-content: center;

          border-radius: 50%;

          background: #111827;

          color: #fff;

          font-size: 12px;
          font-weight: 800;
        }

        .aw-list-info {
          min-width: 0;

          flex: 1;
        }

        .aw-list-top {
          display: flex;

          justify-content: space-between;

          gap: 8px;
        }

        .aw-list-name {
          min-width: 0;

          overflow: hidden;

          color: #101828;

          font-size: 11px;
          font-weight: 800;

          white-space: nowrap;

          text-overflow: ellipsis;
        }

        .aw-list-time {
          flex-shrink: 0;

          color: #98a2b3;

          font-size: 8px;
        }

        .aw-list-sub {
          margin-top: 4px;

          overflow: hidden;

          color: #98a2b3;

          font-size: 8px;

          white-space: nowrap;

          text-overflow: ellipsis;
        }

        .aw-status {
          display: inline-flex;

          align-items: center;

          gap: 4px;

          margin-top: 5px;

          padding: 3px 6px;

          border-radius: 20px;

          background: #fff7ed;

          color: #c2410c;

          font-size: 7px;

          font-weight: 800;
        }

        /* ======================================================
           CONTEÚDO DIREITO
        ====================================================== */

        .aw-content {
          flex: 1;

          min-width: 0;
          min-height: 0;

          display: flex;
          flex-direction: column;

          overflow: hidden;
        }

        .aw-content-header {
          min-height: 68px;

          flex-shrink: 0;

          padding: 12px 18px;

          display: flex;
          align-items: center;
          justify-content: space-between;

          gap: 15px;

          background: #fff;

          border-bottom: 1px solid #eaecf0;
        }

        .aw-user {
          min-width: 0;

          display: flex;
          align-items: center;

          gap: 10px;
        }

        .aw-user-info {
          min-width: 0;
        }

        .aw-user-info strong {
          display: block;

          color: #101828;

          font-size: 13px;

          font-weight: 800;
        }

        .aw-user-info span {
          display: block;

          margin-top: 3px;

          color: #98a2b3;

          font-size: 8px;
        }

        .aw-edit {
          height: 32px;

          padding: 0 11px;

          display: inline-flex;
          align-items: center;

          gap: 6px;

          border: 0;

          border-radius: 8px;

          background: #111827;

          color: #fff;

          font-size: 8px;

          font-weight: 800;

          cursor: pointer;
        }

        /* ======================================================
           CHAT
        ====================================================== */

        .aw-messages {
          flex: 1;

          min-height: 0;

          overflow-y: auto;

          padding: 20px;

          background: #f5f6f8;
        }

        .aw-messages-inner {
          width: 100%;

          max-width: 900px;

          margin: 0 auto;

          display: flex;

          flex-direction: column;

          gap: 8px;
        }

        .aw-message-row {
          display: flex;
        }

        .aw-message-row.cliente {
          justify-content: flex-start;
        }

        .aw-message-row.assistente {
          justify-content: flex-end;
        }

        .aw-message {
          max-width: 68%;

          padding: 9px 12px;

          border-radius: 12px;

          box-shadow:
            0 1px 2px
            rgba(16,24,40,.04);

          overflow-wrap: anywhere;
        }

        .aw-message.cliente {
          background: #fff;

          color: #344054;

          border-top-left-radius: 4px;
        }

        .aw-message.assistente {
          background: #111827;

          color: #fff;

          border-top-right-radius: 4px;
        }

        .aw-message-text {
          white-space: pre-wrap;

          font-size: 11px;

          line-height: 1.55;
        }

        .aw-message-time {
          margin-top: 4px;

          color: #98a2b3;

          font-size: 7px;

          text-align: right;
        }

        .aw-message-image {
          display: block;

          max-width: 280px;
          max-height: 330px;

          margin-top: 6px;

          border-radius: 8px;

          object-fit: contain;

          cursor: pointer;
        }

        /* ======================================================
           COMPOSITOR
        ====================================================== */

        .aw-compose {
          min-height: 64px;

          flex-shrink: 0;

          padding: 10px 15px;

          display: flex;
          align-items: flex-end;

          gap: 8px;

          background: #fff;

          border-top: 1px solid #eaecf0;
        }

        .aw-compose textarea {
          flex: 1;

          min-width: 0;

          height: 42px;

          max-height: 100px;

          resize: none;

          padding: 11px 12px;

          border: 1px solid #eaecf0;

          border-radius: 9px;

          outline: none;

          background: #f9fafb;

          font-family: inherit;

          font-size: 10px;
        }

        .aw-compose textarea:focus {
          border-color: #c9a227;

          background: #fff;
        }

        .aw-send {
          width: 42px;
          height: 42px;

          display: flex;
          align-items: center;
          justify-content: center;

          flex-shrink: 0;

          border: 0;

          border-radius: 9px;

          background: #111827;

          color: #fff;

          cursor: pointer;
        }

        .aw-send:disabled {
          opacity: .4;

          cursor: not-allowed;
        }

        /* ======================================================
           CADASTRO
        ====================================================== */

        .aw-cadastro {
          flex: 1;

          min-height: 0;

          overflow-y: auto;

          padding: 22px;

          background: #f5f6f8;
        }

        .aw-cadastro-inner {
          max-width: 980px;

          margin: 0 auto;
        }

        .aw-section {
          margin-bottom: 18px;
        }

        .aw-section-title {
          margin-bottom: 9px;

          color: #344054;

          font-size: 9px;

          font-weight: 800;

          letter-spacing: .04em;

          text-transform: uppercase;
        }

        .aw-fields {
          display: grid;

          grid-template-columns:
            repeat(
              2,
              minmax(0, 1fr)
            );

          gap: 10px;
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
          color: #667085;

          font-size: 8px;

          font-weight: 800;

          text-transform: uppercase;
        }

        .aw-field input,
        .aw-field select {
          width: 100%;

          height: 38px;

          padding: 0 10px;

          border: 1px solid #e4e7ec;

          border-radius: 8px;

          outline: none;

          background: #fff;

          color: #101828;

          font-family: inherit;

          font-size: 10px;
        }

        .aw-field input:focus,
        .aw-field select:focus {
          border-color: #c9a227;
        }

        .aw-field input[readonly] {
          background: #fafafa;

          color: #475467;
        }

        .aw-region {
          grid-column: 1 / -1;

          padding: 13px;

          border: 1px solid #eadca7;

          border-radius: 9px;

          background: #fffdf4;
        }

        .aw-region-title {
          display: flex;
          align-items: center;

          gap: 6px;

          margin-bottom: 8px;

          color: #806600;

          font-size: 9px;

          font-weight: 800;
        }

        .aw-save-bar {
          margin-top: 14px;

          display: flex;
          align-items: center;
          justify-content: space-between;

          gap: 10px;
        }

        .aw-success {
          color: #15803d;

          font-size: 9px;

          font-weight: 700;
        }

        .aw-save {
          height: 38px;

          padding: 0 15px;

          display: inline-flex;
          align-items: center;

          gap: 6px;

          border: 0;

          border-radius: 8px;

          background: #111827;

          color: #fff;

          font-size: 9px;

          font-weight: 800;

          cursor: pointer;
        }

        .aw-save:disabled {
          opacity: .5;

          cursor: not-allowed;
        }

        /* ======================================================
           EMPTY
        ====================================================== */

        .aw-empty {
          flex: 1;

          display: flex;

          align-items: center;
          justify-content: center;

          color: #98a2b3;

          font-size: 11px;

          text-align: center;
        }

        /* ======================================================
           FOTO
        ====================================================== */

        .aw-photo-modal {
          position: fixed;

          inset: 0;

          z-index: 9999;

          display: flex;

          align-items: center;
          justify-content: center;

          padding: 20px;

          background: rgba(0,0,0,.82);

          cursor: pointer;
        }

        .aw-photo-modal img {
          max-width: 94vw;

          max-height: 90vh;

          object-fit: contain;

          border-radius: 9px;
        }

        .aw-photo-close {
          position: fixed;

          top: 18px;
          right: 18px;

          width: 38px;
          height: 38px;

          display: flex;
          align-items: center;
          justify-content: center;

          border: 0;

          border-radius: 50%;

          background: #fff;

          cursor: pointer;
        }

        /* ======================================================
           RESPONSIVO
        ====================================================== */

        @media (max-width: 800px) {

          .aw-sidebar {
            width: 280px;
            min-width: 280px;
          }

          .aw-fields {
            grid-template-columns: 1fr;
          }

          .aw-field.full,
          .aw-region {
            grid-column: auto;
          }

        }

        @media (max-width: 600px) {

          .aw-tab {
            flex: 1;

            padding: 0 8px;

            font-size: 9px;
          }

          .aw-sidebar {
            width: 78px;
            min-width: 78px;
          }

          .aw-sidebar-header {
            padding: 10px;
          }

          .aw-heading {
            justify-content: center;
          }

          .aw-heading-text,
          .aw-search,
          .aw-list-sub,
          .aw-list-time,
          .aw-status {
            display: none;
          }

          .aw-list-item {
            justify-content: center;

            padding: 11px 5px;
          }

          .aw-content-header {
            padding: 10px;
          }

          .aw-edit {
            width: 32px;

            padding: 0;

            justify-content: center;

            font-size: 0;
          }

          .aw-messages {
            padding: 10px;
          }

          .aw-message {
            max-width: 88%;
          }

          .aw-cadastro {
            padding: 12px;
          }

        }

      `}</style>

      {/* ========================================================
          ABAS
      ======================================================== */}

      <div className="aw-tabs">

        <button
          type="button"
          className={`aw-tab ${
            aba === "whatsapp"
              ? "active"
              : ""
          }`}
          onClick={() =>
            setAba("whatsapp")
          }
        >
          <MessageCircle size={14} />

          WhatsApp
        </button>

        <button
          type="button"
          className={`aw-tab ${
            aba === "cadastro"
              ? "active"
              : ""
          }`}
          onClick={() =>
            setAba("cadastro")
          }
        >
          <UserPlus size={14} />

          Cadastro pendente

          {cadastros.length > 0 && (
            <span className="aw-count">
              {cadastros.length}
            </span>
          )}
        </button>

      </div>

      {/* ========================================================
          WHATSAPP
      ======================================================== */}

      {aba === "whatsapp" && (

        <div className="aw-panel">

          <aside className="aw-sidebar">

            <div className="aw-sidebar-header">

              <div className="aw-heading">

                <div className="aw-heading-icon">
                  <MessageCircle size={19} />
                </div>

                <div className="aw-heading-text">

                  <strong>
                    WhatsApp
                  </strong>

                  <span>
                    Atendimento Águia Express
                  </span>

                </div>

              </div>

              <div className="aw-search">

                <Search size={14} />

                <input
                  value={busca}
                  onChange={(e) =>
                    setBusca(e.target.value)
                  }
                  placeholder="Pesquisar conversa..."
                />

              </div>

            </div>

            <div className="aw-list">

              {conversasFiltradas.length ===
              0 ? (

                <div className="aw-empty">
                  Nenhuma conversa encontrada.
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
                        type="button"
                        className={`aw-list-item ${
                          selecionada?.id ===
                          conversa.id
                            ? "active"
                            : ""
                        }`}
                        onClick={() =>
                          setSelecionada(
                            conversa
                          )
                        }
                      >

                        <div className="aw-avatar">

                          {(conversa.nome ||
                            "C")
                            .charAt(0)
                            .toUpperCase()}

                        </div>

                        <div className="aw-list-info">

                          <div className="aw-list-top">

                            <span className="aw-list-name">
                              {conversa.nome ||
                                "Cliente"}
                            </span>

                            <span className="aw-list-time">
                              {formatarData(
                                ultima?.em
                              )}
                            </span>

                          </div>

                          <div className="aw-list-sub">
                            {formatarNumero(
                              conversa.numero
                            )}
                          </div>

                          <div className="aw-list-sub">
                            {ultima?.texto ||
                              "Nova mensagem"}
                          </div>

                        </div>

                      </button>

                    );
                  }
                )

              )}

            </div>

          </aside>

          <section className="aw-content">

            {!selecionada ? (

              <div className="aw-empty">
                Selecione uma conversa.
              </div>

            ) : (

              <>

                <header className="aw-content-header">

                  <div className="aw-user">

                    <div className="aw-avatar">
                      {(selecionada.nome ||
                        "C")
                        .charAt(0)
                        .toUpperCase()}
                    </div>

                    <div className="aw-user-info">

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

                </header>

                <div className="aw-messages">

                  <div className="aw-messages-inner">

                    {(
                      selecionada.mensagens ||
                      []
                    ).map(
                      (
                        item,
                        index
                      ) => {

                        const fotos =
                          obterFotosMensagem(
                            item
                          );

                        return (

                          <div
                            key={index}
                            className={`aw-message-row ${
                              item.papel
                            }`}
                          >

                            <div
                              className={`aw-message ${
                                item.papel
                              }`}
                            >

                              {item.texto && (

                                <div className="aw-message-text">
                                  {item.texto}
                                </div>

                              )}

                              {fotos.map(
                                (
                                  foto,
                                  fotoIndex
                                ) => (

                                  <img
                                    key={
                                      fotoIndex
                                    }
                                    src={foto}
                                    alt="Imagem recebida"
                                    className="aw-message-image"
                                    onClick={() =>
                                      setFotoAberta(
                                        foto
                                      )
                                    }
                                  />

                                )
                              )}

                              {!item.texto &&
                                fotos.length ===
                                  0 && (

                                  <div className="aw-message-text">

                                    <ImageIcon
                                      size={13}
                                      style={{
                                        verticalAlign:
                                          "middle",
                                        marginRight:
                                          5,
                                      }}
                                    />

                                    Mídia recebida

                                  </div>

                                )}

                              <div className="aw-message-time">
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

                <div className="aw-compose">

                  <textarea
                    value={texto}
                    onChange={(e) =>
                      setTexto(
                        e.target.value
                      )
                    }
                    onKeyDown={(e) => {

                      if (
                        e.key === "Enter" &&
                        !e.shiftKey
                      ) {
                        e.preventDefault();

                        enviarMensagem();
                      }

                    }}
                    placeholder="Digite uma mensagem..."
                  />

                  <button
                    type="button"
                    className="aw-send"
                    disabled={
                      enviando ||
                      !texto.trim()
                    }
                    onClick={
                      enviarMensagem
                    }
                  >
                    <Send size={16} />
                  </button>

                </div>

              </>

            )}

          </section>

        </div>

      )}

      {/* ========================================================
          CADASTROS
      ======================================================== */}

      {aba === "cadastro" && (

        <div className="aw-panel">

          <aside className="aw-sidebar">

            <div className="aw-sidebar-header">

              <div className="aw-heading">

                <div className="aw-heading-icon">
                  <UserPlus size={19} />
                </div>

                <div className="aw-heading-text">

                  <strong>
                    Cadastros
                  </strong>

                  <span>
                    Entregadores pendentes
                  </span>

                </div>

              </div>

              <div className="aw-search">

                <Search size={14} />

                <input
                  value={buscaCadastro}
                  onChange={(e) =>
                    setBuscaCadastro(
                      e.target.value
                    )
                  }
                  placeholder="Pesquisar entregador..."
                />

              </div>

            </div>

            <div className="aw-list">

              {cadastrosFiltrados.length ===
              0 ? (

                <div className="aw-empty">
                  Nenhum cadastro pendente.
                </div>

              ) : (

                cadastrosFiltrados.map(
                  (cadastro) => (

                    <button
                      key={cadastro.id}
                      type="button"
                      className={`aw-list-item ${
                        cadastroSelecionado?.id ===
                        cadastro.id
                          ? "active"
                          : ""
                      }`}
                      onClick={() => {
                        setCadastroSelecionado(
                          cadastro
                        );

                        setEditando(null);
                      }}
                    >

                      <div className="aw-avatar">

                        {(
                          cadastro.nomeCompleto ||
                          "E"
                        )
                          .charAt(0)
                          .toUpperCase()}

                      </div>

                      <div className="aw-list-info">

                        <div className="aw-list-name">

                          {cadastro.nomeCompleto ||
                            "Cadastro em andamento"}

                        </div>

                        <div className="aw-list-sub">

                          {formatarNumero(
                            cadastro.numeroWhatsApp ||
                              ""
                          )}

                        </div>

                        <div className="aw-status">

                          <Clock3 size={8} />

                          {String(
                            cadastro.status ||
                              "PENDENTE"
                          ).replace(
                            "_",
                            " "
                          )}

                        </div>

                      </div>

                    </button>

                  )
                )

              )}

            </div>

          </aside>

          <section className="aw-content">

            {!cadastroSelecionado ? (

              <div className="aw-empty">
                <div>
                  <UserPlus
                    size={35}
                    style={{
                      display: "block",
                      margin: "0 auto 8px",
                    }}
                  />

                  Selecione um cadastro.
                </div>
              </div>

            ) : (

              <>

                <header className="aw-content-header">

                  <div className="aw-user">

                    <div className="aw-avatar">
                      {(
                        cadastroSelecionado
                          .nomeCompleto ||
                        "E"
                      )
                        .charAt(0)
                        .toUpperCase()}
                    </div>

                    <div className="aw-user-info">

                      <strong>
                        {cadastroSelecionado.nomeCompleto ||
                          "Cadastro de entregador"}
                      </strong>

                      <span>
                        {formatarNumero(
                          cadastroSelecionado.numeroWhatsApp ||
                            ""
                        )}
                      </span>

                    </div>

                  </div>

                  {!editando && (

                    <button
                      type="button"
                      className="aw-edit"
                      onClick={() =>
                        iniciarEdicao(
                          cadastroSelecionado
                        )
                      }
                    >

                      <Pencil size={13} />

                      EDITAR CADASTRO

                    </button>

                  )}

                </header>

                <div className="aw-cadastro">

                  <div className="aw-cadastro-inner">

                    {/* DADOS PESSOAIS */}

                    <div className="aw-section">

                      <div className="aw-section-title">
                        Dados pessoais
                      </div>

                      <div className="aw-fields">

                        <div className="aw-field full">

                          <label>
                            Nome completo
                          </label>

                          <input
                            value={
                              editando
                                ? editando.nomeCompleto ||
                                  ""
                                : cadastroSelecionado.nomeCompleto ||
                                  ""
                            }
                            readOnly={!editando}
                            onChange={(e) =>
                              alterarCampo(
                                "nomeCompleto",
                                e.target.value
                              )
                            }
                          />

                        </div>

                        <div className="aw-field">

                          <label>
                            WhatsApp
                          </label>

                          <input
                            value={formatarNumero(
                              cadastroSelecionado.numeroWhatsApp ||
                                ""
                            )}
                            readOnly
                          />

                        </div>

                        <div className="aw-field">

                          <label>
                            CPF
                          </label>

                          <input
                            value={
                              editando
                                ? editando.cpf ||
                                  ""
                                : cadastroSelecionado.cpf ||
                                  ""
                            }
                            readOnly={!editando}
                            onChange={(e) =>
                              alterarCampo(
                                "cpf",
                                e.target.value
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
                              editando
                                ? editando.telefone ||
                                  ""
                                : cadastroSelecionado.telefone ||
                                  ""
                            }
                            readOnly={!editando}
                            onChange={(e) =>
                              alterarCampo(
                                "telefone",
                                e.target.value
                              )
                            }
                          />

                        </div>

                        <div className="aw-field">

                          <label>
                            Telefone para contato
                          </label>

                          <input
                            value={
                              editando
                                ? editando.telefoneContato ||
                                  ""
                                : cadastroSelecionado.telefoneContato ||
                                  ""
                            }
                            readOnly={!editando}
                            onChange={(e) =>
                              alterarCampo(
                                "telefoneContato",
                                e.target.value
                              )
                            }
                          />

                        </div>

                      </div>

                    </div>

                    {/* ENDEREÇO */}

                    <div className="aw-section">

                      <div className="aw-section-title">
                        Endereço
                      </div>

                      <div className="aw-fields">

                        <div className="aw-field">

                          <label>
                            CEP
                          </label>

                          <input
                            value={
                              editando
                                ? editando.cep || ""
                                : cadastroSelecionado.cep ||
                                  ""
                            }
                            readOnly={!editando}
                            onChange={(e) =>
                              alterarCampo(
                                "cep",
                                e.target.value
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
                              editando
                                ? editando.numero ||
                                  ""
                                : cadastroSelecionado.numero ||
                                  ""
                            }
                            readOnly={!editando}
                            onChange={(e) =>
                              alterarCampo(
                                "numero",
                                e.target.value
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
                              editando
                                ? editando.rua || ""
                                : cadastroSelecionado.rua ||
                                  ""
                            }
                            readOnly={!editando}
                            onChange={(e) =>
                              alterarCampo(
                                "rua",
                                e.target.value
                              )
                            }
                          />

                        </div>

                        {/* REGIÃO */}

                        <div className="aw-region">

                          <div className="aw-region-title">

                            <MapPin size={13} />

                            Região escolhida

                          </div>

                          {editando ? (

                            <select
                              value={
                                editando.regiaoEscolhida ||
                                ""
                              }
                              onChange={(e) =>
                                alterarCampo(
                                  "regiaoEscolhida",
                                  e.target.value
                                )
                              }
                            >

                              <option value="">
                                Selecione uma região
                              </option>

                              {REGIOES.map(
                                (regiao) => (

                                  <option
                                    key={regiao}
                                    value={regiao}
                                  >
                                    {regiao}
                                  </option>

                                )
                              )}

                            </select>

                          ) : (

                            <input
                              value={
                                cadastroSelecionado.regiaoEscolhida ||
                                "Ainda não escolhida"
                              }
                              readOnly
                            />

                          )}

                        </div>

                      </div>

                    </div>

                    {/* PAGAMENTO */}

                    <div className="aw-section">

                      <div className="aw-section-title">
                        Dados de pagamento
                      </div>

                      <div className="aw-fields">

                        <div className="aw-field">

                          <label>
                            Chave Pix
                          </label>

                          <input
                            value={
                              editando
                                ? editando.pix || ""
                                : cadastroSelecionado.pix ||
                                  ""
                            }
                            readOnly={!editando}
                            onChange={(e) =>
                              alterarCampo(
                                "pix",
                                e.target.value
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
                              editando
                                ? editando.banco || ""
                                : cadastroSelecionado.banco ||
                                  ""
                            }
                            readOnly={!editando}
                            onChange={(e) =>
                              alterarCampo(
                                "banco",
                                e.target.value
                              )
                            }
                          />

                        </div>

                        <div className="aw-field full">

                          <label>
                            Favorecido
                          </label>

                          <input
                            value={
                              editando
                                ? editando.favorecido ||
                                  ""
                                : cadastroSelecionado.favorecido ||
                                  ""
                            }
                            readOnly={!editando}
                            onChange={(e) =>
                              alterarCampo(
                                "favorecido",
                                e.target.value
                              )
                            }
                          />

                        </div>

                      </div>

                    </div>

                    {/* SALVAR */}

                    {editando && (

                      <div className="aw-save-bar">

                        <span className="aw-success">
                          {mensagemSalvar}
                        </span>

                        <button
                          type="button"
                          className="aw-save"
                          disabled={salvando}
                          onClick={
                            salvarCadastro
                          }
                        >

                          <Save size={13} />

                          {salvando
                            ? "SALVANDO..."
                            : "SALVAR ALTERAÇÕES"}

                        </button>

                      </div>

                    )}

                  </div>

                </div>

              </>

            )}

          </section>

        </div>

      )}

      {/* ========================================================
          FOTO
      ======================================================== */}

      {fotoAberta && (

        <div
          className="aw-photo-modal"
          onClick={() =>
            setFotoAberta(null)
          }
        >

          <button
            type="button"
            className="aw-photo-close"
            onClick={(e) => {
              e.stopPropagation();

              setFotoAberta(null);
            }}
          >
            <X size={18} />
          </button>

          <img
            src={fotoAberta}
            alt="Imagem"
            onClick={(e) =>
              e.stopPropagation()
            }
          />

        </div>

      )}

    </div>
  );
}