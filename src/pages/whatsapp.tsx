// ============================================================
// PÁGINA: WhatsApp + Cadastro Pendente
// ARQUIVO: src/pages/whatsapp.tsx
// ============================================================

import { useEffect, useMemo, useState } from "react";

import {
  collection,
  onSnapshot,
  orderBy,
  query,
  Timestamp,
  updateDoc,
  doc,
} from "firebase/firestore";

import {
  MessageCircle,
  Send,
  Search,
  UserPlus,
  MapPin,
  Save,
  CheckCircle2,
  Clock,
  Phone,
  X,
  Image as ImageIcon,
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

  // NOVO
  regiaoEscolhida?: string;

  criadoEm?: Timestamp | Date | string;
  atualizadoEm?: Timestamp | Date | string;

  [key: string]: unknown;
};

// ============================================================
// REGIÕES
// EDITE ESTA LISTA QUANDO QUISER
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
// DATA
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
// FOTOS
// ============================================================

function obterFotosMensagem(
  mensagem: Mensagem
): string[] {
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
  // ----------------------------------------------------------
  // ABA
  // ----------------------------------------------------------

  const [aba, setAba] = useState<
    "whatsapp" | "cadastro"
  >("whatsapp");

  // ----------------------------------------------------------
  // WHATSAPP
  // ----------------------------------------------------------

  const [conversas, setConversas] = useState<
    Conversa[]
  >([]);

  const [selecionada, setSelecionada] =
    useState<Conversa | null>(null);

  const [busca, setBusca] = useState("");
  const [texto, setTexto] = useState("");
  const [enviando, setEnviando] =
    useState(false);

  // ----------------------------------------------------------
  // CADASTROS
  // ----------------------------------------------------------

  const [cadastros, setCadastros] =
    useState<CadastroEntregador[]>([]);

  const [
    cadastroSelecionado,
    setCadastroSelecionado,
  ] =
    useState<CadastroEntregador | null>(null);

  const [buscaCadastro, setBuscaCadastro] =
    useState("");

  const [editando, setEditando] =
    useState<CadastroEntregador | null>(null);

  const [salvando, setSalvando] =
    useState(false);

  const [mensagem, setMensagem] =
    useState("");

  const [fotoAberta, setFotoAberta] =
    useState<string | null>(null);

  // ============================================================
  // CARREGAR WHATSAPP
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
          "Erro WhatsApp:",
          error
        );
      }
    );
  }, []);

  // ============================================================
  // CARREGAR CADASTROS
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

        // Mostra somente cadastros ainda pendentes
        const pendentes = lista.filter(
          (item) => {
            const status = String(
              item.status || ""
            ).toUpperCase();

            return (
              status === "PENDENTE" ||
              status === "EM_ANDAMENTO"
            );
          }
        );

        setCadastros(pendentes);

        setCadastroSelecionado(
          (atual) => {
            if (!atual) {
              return pendentes[0] || null;
            }

            return (
              pendentes.find(
                (item) =>
                  item.id === atual.id
              ) ||
              pendentes[0] ||
              null
            );
          }
        );
      },
      (error) => {
        console.error(
          "Erro cadastros:",
          error
        );
      }
    );
  }, []);

  // ============================================================
  // FILTRO WHATSAPP
  // ============================================================

  const conversasFiltradas = useMemo(() => {
    const termo =
      busca.trim().toLowerCase();

    if (!termo) return conversas;

    return conversas.filter(
      (conversa) => {
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
      }
    );
  }, [conversas, busca]);

  // ============================================================
  // FILTRO CADASTROS
  // ============================================================

  const cadastrosFiltrados =
    useMemo(() => {
      const termo =
        buscaCadastro
          .trim()
          .toLowerCase();

      if (!termo) return cadastros;

      return cadastros.filter(
        (cadastro) =>
          String(
            cadastro.nomeCompleto || ""
          )
            .toLowerCase()
            .includes(termo) ||
          String(
            cadastro.numeroWhatsApp || ""
          )
            .toLowerCase()
            .includes(termo) ||
          String(
            cadastro.cpf || ""
          )
            .toLowerCase()
            .includes(termo)
      );
    }, [cadastros, buscaCadastro]);

  // ============================================================
  // EDITAR CADASTRO
  // ============================================================

  function iniciarEdicao(
    cadastro: CadastroEntregador
  ) {
    setEditando({
      ...cadastro,
    });
  }

  // ============================================================
  // ALTERAR CAMPO
  // ============================================================

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

  // ============================================================
  // SALVAR CADASTRO
  // ============================================================

  async function salvarCadastro() {
    if (!editando) return;

    setSalvando(true);
    setMensagem("");

    try {
      const referencia = doc(
        db,
        "candidatos_entregadores",
        editando.id
      );

      await updateDoc(
        referencia,
        {
          nomeCompleto:
            editando.nomeCompleto || "",

          cep: editando.cep || "",
          rua: editando.rua || "",
          numero: editando.numero || "",

          telefone:
            editando.telefone || "",

          telefoneContato:
            editando.telefoneContato ||
            "",

          cpf: editando.cpf || "",
          pix: editando.pix || "",
          banco: editando.banco || "",

          favorecido:
            editando.favorecido || "",

          // NOVO CAMPO
          regiaoEscolhida:
            editando.regiaoEscolhida ||
            "",

          atualizadoEm:
            Timestamp.now(),
        }
      );

      const atualizado = {
        ...editando,
        atualizadoEm:
          Timestamp.now(),
      };

      setCadastroSelecionado(
        atualizado
      );

      setEditando(null);

      setMensagem(
        "Cadastro atualizado com sucesso."
      );

      setTimeout(
        () => setMensagem(""),
        3000
      );
    } catch (error) {
      console.error(
        "Erro ao salvar cadastro:",
        error
      );

      setMensagem(
        "Não foi possível salvar o cadastro."
      );
    } finally {
      setSalvando(false);
    }
  }

  // ============================================================
  // ENVIAR WHATSAPP
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
        "Erro envio:",
        error
      );
    } finally {
      setEnviando(false);
    }
  }

  // ============================================================
  // INTERFACE
  // ============================================================

  return (
    <div className="whatsapp-page-wrapper">

      <style>{`

        * {
          box-sizing: border-box;
        }

        .whatsapp-page-wrapper {
          width: 100%;
          height: calc(100vh - 132px);

          display: flex;
          flex-direction: column;

          gap: 14px;

          overflow: hidden;
        }

        /* ======================================================
           ABAS
        ====================================================== */

        .top-tabs {
          flex-shrink: 0;

          height: 48px;

          display: flex;

          background: #ffffff;

          border: 1px solid #eaecf0;

          border-radius: 12px;

          padding: 4px;
        }

        .top-tab {
          flex: 1;

          border: 0;

          border-radius: 9px;

          background: transparent;

          color: #667085;

          font-size: 12px;

          font-weight: 800;

          cursor: pointer;
        }

        .top-tab:hover {
          background: #f9fafb;
        }

        .top-tab.active {
          background: #111827;

          color: #ffffff;
        }

        .pendente-count {
          display: inline-flex;

          min-width: 20px;
          height: 20px;

          align-items: center;
          justify-content: center;

          margin-left: 7px;

          border-radius: 20px;

          background: #c9a227;

          color: #ffffff;

          font-size: 9px;
        }

        /* ======================================================
           ÁREA PRINCIPAL
        ====================================================== */

        .main-panel {
          flex: 1;

          min-height: 0;

          display: flex;

          overflow: hidden;

          border: 1px solid #eaecf0;

          border-radius: 16px;

          background: #ffffff;
        }

        /* ======================================================
           LISTA
        ====================================================== */

        .left-list {
          width: 350px;
          min-width: 350px;

          display: flex;
          flex-direction: column;

          min-height: 0;

          border-right: 1px solid #eaecf0;
        }

        .list-header {
          padding: 18px;

          flex-shrink: 0;

          border-bottom: 1px solid #eaecf0;
        }

        .list-title {
          display: flex;

          align-items: center;

          gap: 10px;
        }

        .list-title-icon {
          width: 40px;
          height: 40px;

          display: flex;

          align-items: center;
          justify-content: center;

          border-radius: 11px;

          background: #111827;

          color: #ffffff;
        }

        .list-title strong {
          display: block;

          color: #101828;

          font-size: 14px;

          font-weight: 800;
        }

        .list-title span {
          display: block;

          margin-top: 3px;

          color: #98a2b3;

          font-size: 9px;
        }

        .search-box {
          position: relative;

          margin-top: 15px;
        }

        .search-box svg {
          position: absolute;

          left: 12px;
          top: 11px;

          color: #98a2b3;
        }

        .search-box input {
          width: 100%;
          height: 38px;

          padding: 0 10px 0 36px;

          border: 1px solid #eaecf0;

          border-radius: 9px;

          outline: none;

          background: #f9fafb;

          font-size: 11px;
        }

        .list-content {
          flex: 1;

          min-height: 0;

          overflow-y: auto;
        }

        /* ======================================================
           ITEM
        ====================================================== */

        .list-item {
          width: 100%;

          padding: 13px;

          display: flex;

          gap: 10px;

          align-items: center;

          border: 0;

          border-bottom: 1px solid #f2f4f7;

          background: #ffffff;

          text-align: left;

          cursor: pointer;
        }

        .list-item:hover {
          background: #f9fafb;
        }

        .list-item.selected {
          background: #f2f4f7;

          box-shadow:
            inset 3px 0 #c9a227;
        }

        .avatar {
          width: 40px;
          height: 40px;

          min-width: 40px;

          display: flex;

          align-items: center;
          justify-content: center;

          border-radius: 50%;

          background: #111827;

          color: #ffffff;

          font-size: 13px;

          font-weight: 800;
        }

        .item-info {
          min-width: 0;

          flex: 1;
        }

        .item-name {
          overflow: hidden;

          color: #101828;

          font-size: 11px;

          font-weight: 800;

          white-space: nowrap;

          text-overflow: ellipsis;
        }

        .item-number {
          margin-top: 4px;

          color: #98a2b3;

          font-size: 9px;
        }

        .item-status {
          display: inline-flex;

          align-items: center;

          gap: 4px;

          margin-top: 6px;

          padding: 3px 6px;

          border-radius: 20px;

          background: #fff7ed;

          color: #c2410c;

          font-size: 8px;

          font-weight: 800;
        }

        .empty {
          padding: 40px 20px;

          text-align: center;

          color: #98a2b3;

          font-size: 11px;
        }

        /* ======================================================
           CHAT / DETALHE
        ====================================================== */

        .right-panel {
          flex: 1;

          min-width: 0;
          min-height: 0;

          display: flex;

          flex-direction: column;

          overflow: hidden;
        }

        .right-header {
          min-height: 70px;

          padding: 14px 18px;

          display: flex;

          align-items: center;

          justify-content: space-between;

          gap: 15px;

          flex-shrink: 0;

          border-bottom: 1px solid #eaecf0;

          background: #ffffff;
        }

        .right-user {
          display: flex;

          align-items: center;

          gap: 10px;

          min-width: 0;
        }

        .right-user-info {
          min-width: 0;
        }

        .right-user-info strong {
          display: block;

          color: #101828;

          font-size: 14px;

          font-weight: 800;
        }

        .right-user-info span {
          display: block;

          margin-top: 3px;

          color: #98a2b3;

          font-size: 9px;
        }

        .edit-button {
          display: inline-flex;

          align-items: center;

          gap: 6px;

          height: 34px;

          padding: 0 12px;

          border: 0;

          border-radius: 8px;

          background: #111827;

          color: #ffffff;

          font-size: 10px;

          font-weight: 800;

          cursor: pointer;
        }

        /* ======================================================
           WHATSAPP
        ====================================================== */

        .messages {
          flex: 1;

          min-height: 0;

          overflow-y: auto;

          padding: 20px;

          background: #f5f6f8;
        }

        .messages-inner {
          max-width: 900px;

          margin: auto;

          display: flex;

          flex-direction: column;

          gap: 9px;
        }

        .message-row {
          display: flex;
        }

        .message-row.client {
          justify-content: flex-start;
        }

        .message-row.assistant {
          justify-content: flex-end;
        }

        .message {
          max-width: 70%;

          padding: 10px 13px;

          border-radius: 13px;

          font-size: 11px;

          line-height: 1.6;

          overflow-wrap: anywhere;
        }

        .message.client {
          background: #ffffff;

          color: #344054;

          border-top-left-radius: 4px;
        }

        .message.assistant {
          background: #111827;

          color: #ffffff;

          border-top-right-radius: 4px;
        }

        .message-text {
          white-space: pre-wrap;
        }

        .message-image {
          display: block;

          max-width: 320px;

          max-height: 350px;

          margin-top: 7px;

          border-radius: 9px;

          object-fit: contain;

          cursor: pointer;
        }

        .message-time {
          margin-top: 4px;

          text-align: right;

          color: #98a2b3;

          font-size: 7px;
        }

        .compose {
          flex-shrink: 0;

          padding: 11px 15px;

          display: flex;

          gap: 8px;

          border-top: 1px solid #eaecf0;

          background: #ffffff;
        }

        .compose textarea {
          flex: 1;

          min-width: 0;

          min-height: 42px;

          max-height: 100px;

          resize: none;

          padding: 11px;

          border: 1px solid #eaecf0;

          border-radius: 10px;

          outline: none;

          font-family: inherit;

          font-size: 11px;
        }

        .send-button {
          width: 43px;
          height: 43px;

          border: 0;

          border-radius: 10px;

          background: #111827;

          color: #ffffff;

          cursor: pointer;
        }

        /* ======================================================
           CADASTRO
        ====================================================== */

        .cadastro-body {
          flex: 1;

          min-height: 0;

          overflow-y: auto;

          padding: 22px;

          background: #f5f6f8;
        }

        .cadastro-grid {
          display: grid;

          grid-template-columns:
            repeat(
              2,
              minmax(0, 1fr)
            );

          gap: 12px;

          max-width: 1000px;

          margin: auto;
        }

        .field {
          display: flex;

          flex-direction: column;

          gap: 5px;
        }

        .field.full {
          grid-column: 1 / -1;
        }

        .field label {
          color: #667085;

          font-size: 9px;

          font-weight: 800;

          text-transform: uppercase;
        }

        .field input,
        .field select {
          width: 100%;

          height: 40px;

          padding: 0 11px;

          border: 1px solid #eaecf0;

          border-radius: 9px;

          outline: none;

          background: #ffffff;

          color: #101828;

          font-family: inherit;

          font-size: 11px;
        }

        .field input:focus,
        .field select:focus {
          border-color: #c9a227;
        }

        .save-area {
          max-width: 1000px;

          margin: 16px auto 0;

          display: flex;

          align-items: center;

          justify-content: space-between;

          gap: 10px;
        }

        .save-button {
          height: 40px;

          padding: 0 18px;

          display: inline-flex;

          align-items: center;

          gap: 7px;

          border: 0;

          border-radius: 9px;

          background: #111827;

          color: #ffffff;

          font-size: 10px;

          font-weight: 800;

          cursor: pointer;
        }

        .save-button:disabled {
          opacity: .5;

          cursor: not-allowed;
        }

        .success-message {
          color: #15803d;

          font-size: 10px;

          font-weight: 700;
        }

        .region-card {
          grid-column: 1 / -1;

          padding: 14px;

          border: 1px solid #eadca7;

          border-radius: 10px;

          background: #fffdf4;
        }

        .region-card-title {
          display: flex;

          align-items: center;

          gap: 7px;

          margin-bottom: 8px;

          color: #7a5f00;

          font-size: 10px;

          font-weight: 800;
        }

        /* ======================================================
           FOTO
        ====================================================== */

        .foto-modal {
          position: fixed;

          z-index: 9999;

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

        .foto-close {
          position: fixed;

          top: 20px;
          right: 20px;

          width: 40px;
          height: 40px;

          border: 0;

          border-radius: 50%;

          background: #ffffff;

          cursor: pointer;
        }

        /* ======================================================
           MOBILE
        ====================================================== */

        @media (max-width: 800px) {

          .left-list {
            width: 290px;
            min-width: 290px;
          }

          .cadastro-grid {
            grid-template-columns: 1fr;
          }

          .field.full,
          .region-card {
            grid-column: auto;
          }

        }

        @media (max-width: 600px) {

          .left-list {
            width: 85px;
            min-width: 85px;
          }

          .list-header {
            padding: 10px;
          }

          .list-title {
            justify-content: center;
          }

          .list-title > div:last-child,
          .search-box,
          .item-info {
            display: none;
          }

          .list-item {
            justify-content: center;
          }

          .right-header {
            padding: 10px;
          }

          .messages {
            padding: 10px;
          }

          .message {
            max-width: 88%;
          }

          .cadastro-body {
            padding: 12px;
          }

        }

      `}</style>

      {/* ========================================================
          ABAS
      ======================================================== */}

      <div className="top-tabs">

        <button
          type="button"
          className={`top-tab ${
            aba === "whatsapp"
              ? "active"
              : ""
          }`}
          onClick={() =>
            setAba("whatsapp")
          }
        >
          <MessageCircle
            size={14}
            style={{
              verticalAlign: "middle",
              marginRight: 6,
            }}
          />

          WHATSAPP
        </button>

        <button
          type="button"
          className={`top-tab ${
            aba === "cadastro"
              ? "active"
              : ""
          }`}
          onClick={() =>
            setAba("cadastro")
          }
        >
          <UserPlus
            size={14}
            style={{
              verticalAlign: "middle",
              marginRight: 6,
            }}
          />

          CADASTRO PENDENTE

          {cadastros.length > 0 && (
            <span className="pendente-count">
              {cadastros.length}
            </span>
          )}

        </button>

      </div>

      {/* ========================================================
          WHATSAPP
      ======================================================== */}

      {aba === "whatsapp" && (

        <div className="main-panel">

          <aside className="left-list">

            <div className="list-header">

              <div className="list-title">

                <div className="list-title-icon">
                  <MessageCircle size={20} />
                </div>

                <div>
                  <strong>
                    WhatsApp
                  </strong>

                  <span>
                    Atendimento Águia Express
                  </span>
                </div>

              </div>

              <div className="search-box">

                <Search size={15} />

                <input
                  value={busca}
                  onChange={(e) =>
                    setBusca(
                      e.target.value
                    )
                  }
                  placeholder="Pesquisar..."
                />

              </div>

            </div>

            <div className="list-content">

              {conversasFiltradas.length ===
              0 ? (

                <div className="empty">
                  Nenhuma conversa encontrada.
                </div>

              ) : (

                conversasFiltradas.map(
                  (conversa) => {

                    const ultima =
                      conversa
                        .mensagens?.[
                        conversa
                          .mensagens
                          .length - 1
                      ];

                    return (

                      <button
                        key={conversa.id}
                        type="button"
                        className={`list-item ${
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

                        <div className="avatar">
                          {(conversa.nome ||
                            "C")
                            .charAt(0)
                            .toUpperCase()}
                        </div>

                        <div className="item-info">

                          <div className="item-name">
                            {conversa.nome ||
                              "Cliente"}
                          </div>

                          <div className="item-number">
                            {formatarNumero(
                              conversa.numero
                            )}
                          </div>

                          <div
                            style={{
                              marginTop: 5,
                              color: "#667085",
                              fontSize: 9,
                              overflow: "hidden",
                              whiteSpace: "nowrap",
                              textOverflow:
                                "ellipsis",
                            }}
                          >
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

          <section className="right-panel">

            {!selecionada ? (

              <div className="empty">
                Selecione uma conversa.
              </div>

            ) : (

              <>

                <header className="right-header">

                  <div className="right-user">

                    <div className="avatar">
                      {(selecionada.nome ||
                        "C")
                        .charAt(0)
                        .toUpperCase()}
                    </div>

                    <div className="right-user-info">

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

                <div className="messages">

                  <div className="messages-inner">

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
                            className={`message-row ${
                              item.papel
                            }`}
                          >

                            <div
                              className={`message ${
                                item.papel
                              }`}
                            >

                              {item.texto && (

                                <div className="message-text">
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
                                    className="message-image"
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

                                  <div>
                                    <ImageIcon
                                      size={15}
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

                              <div className="message-time">
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

                <div className="compose">

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
                    className="send-button"
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
          CADASTRO PENDENTE
      ======================================================== */}

      {aba === "cadastro" && (

        <div className="main-panel">

          {/* LISTA */}

          <aside className="left-list">

            <div className="list-header">

              <div className="list-title">

                <div className="list-title-icon">
                  <UserPlus size={20} />
                </div>

                <div>
                  <strong>
                    Cadastros
                  </strong>

                  <span>
                    Pendentes de análise
                  </span>
                </div>

              </div>

              <div className="search-box">

                <Search size={15} />

                <input
                  value={buscaCadastro}
                  onChange={(e) =>
                    setBuscaCadastro(
                      e.target.value
                    )
                  }
                  placeholder="Pesquisar..."
                />

              </div>

            </div>

            <div className="list-content">

              {cadastrosFiltrados.length ===
              0 ? (

                <div className="empty">
                  Nenhum cadastro pendente.
                </div>

              ) : (

                cadastrosFiltrados.map(
                  (cadastro) => (

                    <button
                      key={cadastro.id}
                      type="button"
                      className={`list-item ${
                        cadastroSelecionado?.id ===
                        cadastro.id
                          ? "selected"
                          : ""
                      }`}
                      onClick={() => {
                        setCadastroSelecionado(
                          cadastro
                        );

                        setEditando(null);
                      }}
                    >

                      <div className="avatar">
                        {(
                          cadastro.nomeCompleto ||
                          "E"
                        )
                          .charAt(0)
                          .toUpperCase()}
                      </div>

                      <div className="item-info">

                        <div className="item-name">
                          {cadastro.nomeCompleto ||
                            "Cadastro em andamento"}
                        </div>

                        <div className="item-number">
                          {formatarNumero(
                            cadastro.numeroWhatsApp ||
                              ""
                          )}
                        </div>

                        <div className="item-status">

                          <Clock
                            size={9}
                          />

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

          {/* DADOS */}

          <section className="right-panel">

            {!cadastroSelecionado ? (

              <div className="empty">
                Selecione um cadastro.
              </div>

            ) : (

              <>

                <header className="right-header">

                  <div className="right-user">

                    <div className="avatar">
                      {(
                        cadastroSelecionado
                          .nomeCompleto ||
                        "E"
                      )
                        .charAt(0)
                        .toUpperCase()}
                    </div>

                    <div className="right-user-info">

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
                      className="edit-button"
                      onClick={() =>
                        iniciarEdicao(
                          cadastroSelecionado
                        )
                      }
                    >
                      EDITAR CADASTRO
                    </button>

                  )}

                </header>

                <div className="cadastro-body">

                  {editando ? (

                    <>

                      <div className="cadastro-grid">

                        <div className="field full">

                          <label>
                            Nome completo
                          </label>

                          <input
                            value={
                              editando.nomeCompleto ||
                              ""
                            }
                            onChange={(e) =>
                              alterarCampo(
                                "nomeCompleto",
                                e.target.value
                              )
                            }
                          />

                        </div>

                        <div className="field">

                          <label>
                            WhatsApp
                          </label>

                          <input
                            value={
                              editando.numeroWhatsApp ||
                              ""
                            }
                            disabled
                          />

                        </div>

                        <div className="field">

                          <label>
                            Telefone
                          </label>

                          <input
                            value={
                              editando.telefone ||
                              ""
                            }
                            onChange={(e) =>
                              alterarCampo(
                                "telefone",
                                e.target.value
                              )
                            }
                          />

                        </div>

                        <div className="field">

                          <label>
                            Telefone para contato
                          </label>

                          <input
                            value={
                              editando.telefoneContato ||
                              ""
                            }
                            onChange={(e) =>
                              alterarCampo(
                                "telefoneContato",
                                e.target.value
                              )
                            }
                          />

                        </div>

                        <div className="field">

                          <label>
                            CPF
                          </label>

                          <input
                            value={
                              editando.cpf || ""
                            }
                            onChange={(e) =>
                              alterarCampo(
                                "cpf",
                                e.target.value
                              )
                            }
                          />

                        </div>

                        <div className="field">

                          <label>
                            CEP
                          </label>

                          <input
                            value={
                              editando.cep || ""
                            }
                            onChange={(e) =>
                              alterarCampo(
                                "cep",
                                e.target.value
                              )
                            }
                          />

                        </div>

                        <div className="field">

                          <label>
                            Rua
                          </label>

                          <input
                            value={
                              editando.rua || ""
                            }
                            onChange={(e) =>
                              alterarCampo(
                                "rua",
                                e.target.value
                              )
                            }
                          />

                        </div>

                        <div className="field">

                          <label>
                            Número
                          </label>

                          <input
                            value={
                              editando.numero || ""
                            }
                            onChange={(e) =>
                              alterarCampo(
                                "numero",
                                e.target.value
                              )
                            }
                          />

                        </div>

                        {/* REGIÃO */}

                        <div className="region-card">

                          <div className="region-card-title">

                            <MapPin size={14} />

                            REGIÃO ESCOLHIDA

                          </div>

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
                            style={{
                              width: "100%",
                              height: 40,
                              border:
                                "1px solid #eadca7",
                              borderRadius: 9,
                              padding:
                                "0 10px",
                              background:
                                "#ffffff",
                              outline: "none",
                            }}
                          >

                            <option value="">
                              Selecione a região
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

                        </div>

                        <div className="field">

                          <label>
                            Chave Pix
                          </label>

                          <input
                            value={
                              editando.pix || ""
                            }
                            onChange={(e) =>
                              alterarCampo(
                                "pix",
                                e.target.value
                              )
                            }
                          />

                        </div>

                        <div className="field">

                          <label>
                            Banco
                          </label>

                          <input
                            value={
                              editando.banco || ""
                            }
                            onChange={(e) =>
                              alterarCampo(
                                "banco",
                                e.target.value
                              )
                            }
                          />

                        </div>

                        <div className="field full">

                          <label>
                            Nome do favorecido
                          </label>

                          <input
                            value={
                              editando.favorecido ||
                              ""
                            }
                            onChange={(e) =>
                              alterarCampo(
                                "favorecido",
                                e.target.value
                              )
                            }
                          />

                        </div>

                      </div>

                      <div className="save-area">

                        <div>

                          {mensagem && (
                            <span className="success-message">
                              {mensagem}
                            </span>
                          )}

                        </div>

                        <button
                          type="button"
                          className="save-button"
                          disabled={salvando}
                          onClick={
                            salvarCadastro
                          }
                        >

                          <Save size={15} />

                          {salvando
                            ? "SALVANDO..."
                            : "SALVAR ALTERAÇÕES"}

                        </button>

                      </div>

                    </>

                  ) : (

                    <div className="cadastro-grid">

                      <div className="field full">

                        <label>
                          Nome completo
                        </label>

                        <input
                          value={
                            cadastroSelecionado.nomeCompleto ||
                            ""
                          }
                          readOnly
                        />

                      </div>

                      <div className="field">

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

                      <div className="field">

                        <label>
                          Telefone
                        </label>

                        <input
                          value={
                            cadastroSelecionado.telefone ||
                            ""
                          }
                          readOnly
                        />

                      </div>

                      <div className="field">

                        <label>
                          Telefone para contato
                        </label>

                        <input
                          value={
                            cadastroSelecionado.telefoneContato ||
                            ""
                          }
                          readOnly
                        />

                      </div>

                      <div className="field">

                        <label>
                          CPF
                        </label>

                        <input
                          value={
                            cadastroSelecionado.cpf ||
                            ""
                          }
                          readOnly
                        />

                      </div>

                      <div className="field">

                        <label>
                          CEP
                        </label>

                        <input
                          value={
                            cadastroSelecionado.cep ||
                            ""
                          }
                          readOnly
                        />

                      </div>

                      <div className="field">

                        <label>
                          Rua
                        </label>

                        <input
                          value={
                            cadastroSelecionado.rua ||
                            ""
                          }
                          readOnly
                        />

                      </div>

                      <div className="field">

                        <label>
                          Número
                        </label>

                        <input
                          value={
                            cadastroSelecionado.numero ||
                            ""
                          }
                          readOnly
                        />

                      </div>

                      <div className="region-card">

                        <div className="region-card-title">

                          <MapPin size={14} />

                          REGIÃO ESCOLHIDA

                        </div>

                        <strong
                          style={{
                            color: "#101828",
                            fontSize: 13,
                          }}
                        >
                          {cadastroSelecionado.regiaoEscolhida ||
                            "Ainda não escolhida"}
                        </strong>

                      </div>

                      <div className="field">

                        <label>
                          Chave Pix
                        </label>

                        <input
                          value={
                            cadastroSelecionado.pix ||
                            ""
                          }
                          readOnly
                        />

                      </div>

                      <div className="field">

                        <label>
                          Banco
                        </label>

                        <input
                          value={
                            cadastroSelecionado.banco ||
                            ""
                          }
                          readOnly
                        />

                      </div>

                      <div className="field full">

                        <label>
                          Nome do favorecido
                        </label>

                        <input
                          value={
                            cadastroSelecionado.favorecido ||
                            ""
                          }
                          readOnly
                        />

                      </div>

                      <div className="field">

                        <label>
                          Status
                        </label>

                        <input
                          value={
                            cadastroSelecionado.status ||
                            ""
                          }
                          readOnly
                        />

                      </div>

                      <div className="field">

                        <label>
                          Atualizado em
                        </label>

                        <input
                          value={formatarData(
                            cadastroSelecionado.atualizadoEm
                          )}
                          readOnly
                        />

                      </div>

                    </div>

                  )}

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
          className="foto-modal"
          onClick={() =>
            setFotoAberta(null)
          }
        >

          <button
            type="button"
            className="foto-close"
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