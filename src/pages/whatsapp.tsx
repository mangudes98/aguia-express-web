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
} from "lucide-react";

import { db } from "../services/firebase/firebase";

type Mensagem = {
  papel: "cliente" | "assistente";
  texto: string;
  tipo?: string;
  em?: Timestamp | Date | string;
};

type Conversa = {
  id: string;
  numero: string;
  nome?: string;
  mensagens?: Mensagem[];
  atendimentoHumano?: boolean;
  ultimoCodigo?: string;
  atualizadoEm?: Timestamp;
};

function formatarData(valor?: Timestamp | Date | string) {
  if (!valor) return "";

  try {
    let data: Date;

    if (valor instanceof Timestamp) {
      data = valor.toDate();
    } else if (valor instanceof Date) {
      data = valor;
    } else {
      data = new Date(valor);
    }

    if (Number.isNaN(data.getTime())) {
      return "";
    }

    return data.toLocaleString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
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

export default function WhatsApp() {
  const [conversas, setConversas] = useState<Conversa[]>([]);
  const [selecionada, setSelecionada] =
    useState<Conversa | null>(null);

  const [busca, setBusca] = useState("");
  const [texto, setTexto] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState("");

  // ============================================================
  // CARREGAR CONVERSAS EM TEMPO REAL
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
        const lista: Conversa[] = snapshot.docs.map(
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
              (item) => item.id === atual.id
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
  // PESQUISA
  // ============================================================

  const conversasFiltradas = useMemo(() => {
    const termo = busca.trim().toLowerCase();

    if (!termo) {
      return conversas;
    }

    return conversas.filter((conversa) => {
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
    });
  }, [conversas, busca]);

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
            numero: selecionada.numero,
            mensagem: texto.trim(),
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
    <div className="whatsapp-page">

      <style>{`
        /* ======================================================
           CONTAINER
        ====================================================== */

        .whatsapp-page {
          width: 100%;
          height: 100%;
          min-height: 0;
          display: flex;
          overflow: hidden;
          background: #f5f6f8;
          border: 1px solid #eaecf0;
          border-radius: 16px;
        }

        /* ======================================================
           LISTA DE CONVERSAS
        ====================================================== */

        .whatsapp-sidebar {
          width: 350px;
          min-width: 350px;
          height: 100%;
          min-height: 0;
          display: flex;
          flex-direction: column;
          background: #ffffff;
          border-right: 1px solid #eaecf0;
        }

        .whatsapp-sidebar-header {
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

        /* ======================================================
           PESQUISA
        ====================================================== */

        .whatsapp-search {
          position: relative;
          margin-top: 18px;
        }

        .whatsapp-search svg {
          position: absolute;
          left: 12px;
          top: 11px;
          color: #98a2b3;
        }

        .whatsapp-search input {
          box-sizing: border-box;
          width: 100%;
          height: 40px;
          padding: 0 12px 0 38px;
          border: 1px solid #eaecf0;
          border-radius: 10px;
          outline: none;
          background: #f9fafb;
          color: #101828;
          font-family: inherit;
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
        }

        .whatsapp-conversation {
          box-sizing: border-box;
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
          box-shadow: inset 3px 0 0 #c9a227;
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
          box-sizing: border-box;
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

        /* ======================================================
           STATUS
        ====================================================== */

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
          padding: 24px;
          background: #f5f6f8;
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
          box-shadow: 0 1px 3px rgba(16, 24, 40, .06);
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
          box-sizing: border-box;
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

          .whatsapp-page {
            border-radius: 10px;
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
        }
      `}</style>

      {/* ========================================================
          LISTA DE CONVERSAS
      ======================================================== */}

      <aside className="whatsapp-sidebar">

        <div className="whatsapp-sidebar-header">

          <div className="whatsapp-title">

            <div className="whatsapp-title-icon">
              <MessageCircle size={21} />
            </div>

            <div>
              <h1>WhatsApp</h1>
              <p>Atendimento Águia Express</p>
            </div>

          </div>

          <div className="whatsapp-search">

            <Search size={16} />

            <input
              type="text"
              value={busca}
              onChange={(event) =>
                setBusca(event.target.value)
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

            conversasFiltradas.map((conversa) => {

              const ultimaMensagem =
                conversa.mensagens?.[
                  conversa.mensagens.length - 1
                ];

              return (
                <button
                  key={conversa.id}
                  type="button"
                  className={`whatsapp-conversation ${
                    selecionada?.id === conversa.id
                      ? "selected"
                      : ""
                  }`}
                  onClick={() =>
                    setSelecionada(conversa)
                  }
                >

                  <div className="whatsapp-avatar">
                    {(conversa.nome || "C")
                      .charAt(0)
                      .toUpperCase()}
                  </div>

                  <div className="whatsapp-conversation-content">

                    <div className="whatsapp-conversation-top">

                      <span className="whatsapp-name">
                        {conversa.nome || "Cliente"}
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
            })

          )}

        </div>

      </aside>

      {/* ========================================================
          CHAT
      ======================================================== */}

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
                  {(selecionada.nome || "C")
                    .charAt(0)
                    .toUpperCase()}
                </div>

                <div className="whatsapp-chat-user-info">

                  <strong>
                    {selecionada.nome || "Cliente"}
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

                {(selecionada.mensagens || []).map(
                  (item, index) => {

                    const cliente =
                      item.papel === "cliente";

                    return (
                      <div
                        key={`${index}-${item.texto}`}
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

                          <div className="whatsapp-message-text">
                            {item.texto}
                          </div>

                          <div className="whatsapp-message-time">
                            {formatarData(item.em)}
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

            {/* CAMPO DE RESPOSTA */}

            <div className="whatsapp-compose">

              <div className="whatsapp-compose-inner">

                <textarea
                  value={texto}
                  onChange={(event) =>
                    setTexto(event.target.value)
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
                  type="button"
                  className="whatsapp-send"
                  onClick={enviarMensagem}
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
  );
}