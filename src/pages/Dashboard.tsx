// ARQUIVO: src/pages/Dashboard.tsx

import { useEffect, useMemo, useState } from "react";
import {
  CalendarDays,
  CheckCircle2,
  Package,
  Route,
  AlertTriangle,
  RotateCcw,
  RefreshCw,
  LockKeyhole,
} from "lucide-react";
import { onAuthStateChanged } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";

import PageHeader from "../components/ui/PageHeader";
import StatusBadge from "../components/ui/StatusBadge";
import { listarPacotes, nomeTipo, timestampMs } from "../services/pacotes";
import { Pacote, StatusPacote } from "../types";
import { auth, db } from "../services/firebase/firebase";

// DATA LOCAL YYYY-MM-DD
const day = (d: Date) => {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const date = String(d.getDate()).padStart(2, "0");

  return `${year}-${month}-${date}`;
};

// SEMPRE RETORNA O DIA ANTERIOR
const getYesterday = () => {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return day(d);
};

export default function Dashboard() {
  const yesterday = getYesterday();

  const [all, setAll] = useState<Pacote[]>([]);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState("");

  // PERMISSÃO
  const [checkingAccess, setCheckingAccess] = useState(true);
  const [allowed, setAllowed] = useState(false);

  // AO ABRIR: SEMPRE DIA ANTERIOR
  const [ini, setIni] = useState(yesterday);
  const [fim, setFim] = useState(yesterday);

  // VERIFICA SE É ADMIN
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async user => {
      if (!user) {
        setAllowed(false);
        setCheckingAccess(false);
        return;
      }

      try {
        // PRIMEIRA TENTATIVA: DOCUMENTO COM UID
        let userDoc = await getDoc(doc(db, "usuarios", user.uid));

        // SEGUNDA TENTATIVA: DOCUMENTO COM EMAIL
        if (!userDoc.exists() && user.email) {
          userDoc = await getDoc(
            doc(db, "usuarios", user.email.toLowerCase())
          );
        }

        if (!userDoc.exists()) {
          setAllowed(false);
          setCheckingAccess(false);
          return;
        }

        const userData = userDoc.data();

        // APENAS ADMIN
        setAllowed(userData?.tipo === "admin");
      } catch (error) {
        console.error("Erro ao verificar permissão:", error);
        setAllowed(false);
      } finally {
        setCheckingAccess(false);
      }
    });

    return () => unsubscribe();
  }, []);

  async function load() {
    setLoading(true);

    try {
      const dados = await listarPacotes();

      setAll(dados);
      setErro("");
    } catch (e) {
      console.error(e);
      setErro("Erro ao carregar dados do Firebase.");
    } finally {
      setLoading(false);
    }
  }

  // CARREGA APENAS SE FOR ADMIN
  useEffect(() => {
    if (allowed) {
      load();
    }
  }, [allowed]);

  // FILTRO POR DATA
  const pacotes = useMemo(() => {
    const inicio = new Date(`${ini}T00:00:00`).getTime();
    const final = new Date(`${fim}T23:59:59.999`).getTime();

    return all.filter(p => {
      const dataPacote = timestampMs(p.data);

      return dataPacote >= inicio && dataPacote <= final;
    });
  }, [all, ini, fim]);

  const count = (status: StatusPacote) =>
    pacotes.filter(p => p.status === status).length;

  const total = pacotes.length;

  const cards = [
    ["Pacotes", total, Package, "blue"],
    ["Entregues", count("ENTREGUE"), CheckCircle2, "green"],
    ["Em rota", count("ROTA"), Route, "orange"],
    ["Ausentes", count("AUSENTE"), AlertTriangle, "red"],
    ["Devolvidos", count("DEVOLVIDO"), RotateCcw, "purple"],
  ] as const;

  const pct = (n: number) =>
    total ? Math.round((n * 100) / total) : 0;

  const ult = [...pacotes]
    .sort(
      (a, b) =>
        timestampMs(b.data) - timestampMs(a.data)
    )
    .slice(0, 12);

  // CARREGANDO PERMISSÃO
  if (checkingAccess) {
    return (
      <div>
        <PageHeader
          title="Central Operacional"
          subtitle="Verificando permissão de acesso..."
        />

        <section
          className="card"
          style={{
            minHeight: "300px",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontWeight: 600,
          }}
        >
          Verificando acesso...
        </section>
      </div>
    );
  }

  // BLOQUEIO PARA NÃO ADMIN
  if (!allowed) {
    return (
      <div>
        <PageHeader
          title="Acesso restrito"
          subtitle="Área exclusiva para administradores."
        />

        <section
          className="card"
          style={{
            minHeight: "320px",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: "16px",
            textAlign: "center",
            padding: "30px",
          }}
        >
          <div
            style={{
              width: "64px",
              height: "64px",
              borderRadius: "18px",
              display: "grid",
              placeItems: "center",
              background: "#fff0f0",
              color: "#d92d20",
            }}
          >
            <LockKeyhole size={30} />
          </div>

          <div>
            <h2 style={{ margin: 0 }}>
              Acesso permitido somente para administradores
            </h2>

            <p
              style={{
                marginTop: "10px",
                color: "#667085",
              }}
            >
              Você não possui permissão para acessar a Central
              Operacional.
            </p>
          </div>
        </section>
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title="Central Operacional"
        subtitle="Visão administrativa da Águia Express"
        action={
          <button
            className="secondary"
            onClick={load}
            disabled={loading}
          >
            <RefreshCw size={15} />
            Atualizar
          </button>
        }
      />

      {/* FILTRO */}
      <section className="card premium-filter">
        <div>
          <b>
            <CalendarDays size={17} />
            Período analisado
          </b>

          <span>
            Ao abrir: dia anterior automaticamente
          </span>
        </div>

        <label>
          De
          <input
            type="date"
            value={ini}
            onChange={e => setIni(e.target.value)}
          />
        </label>

        <label>
          Até
          <input
            type="date"
            value={fim}
            onChange={e => setFim(e.target.value)}
          />
        </label>

        <button
          className="secondary"
          onClick={() => {
            const ontem = getYesterday();

            setIni(ontem);
            setFim(ontem);
          }}
        >
          Dia anterior
        </button>

        <button
          className="secondary"
          onClick={() => {
            const hoje = new Date();
            const seteDias = new Date();

            seteDias.setDate(hoje.getDate() - 6);

            setIni(day(seteDias));
            setFim(day(hoje));
          }}
        >
          Últimos 7 dias
        </button>
      </section>

      {erro && (
        <div className="error-box">
          {erro}
        </div>
      )}

      {/* CARDS */}
      <div className="stat-grid">
        {cards.map(([label, value, Icon, color]) => (
          <div
            className="stat-card premium-stat"
            key={label}
          >
            <div className={`stat-icon ${color}`}>
              <Icon size={21} />
            </div>

            <span>{label}</span>

            <strong>
              {loading ? "..." : value}
            </strong>

            <small>
              {pct(Number(value))}% do período
            </small>
          </div>
        ))}
      </div>

      {/* PERFORMANCE */}
      <div className="grid-2">
        <section className="card">
          <div className="card-title">
            <div>
              <h3>Performance do período</h3>
              <p>
                Finalização e situação operacional
              </p>
            </div>
          </div>

          {[
            [
              "Entregues",
              count("ENTREGUE"),
              "green",
            ],
            [
              "Em rota",
              count("ROTA"),
              "blue",
            ],
            [
              "Ausentes",
              count("AUSENTE"),
              "red",
            ],
            [
              "Devolvidos",
              count("DEVOLVIDO"),
              "orange",
            ],
          ].map(([label, value, color]) => (
            <div
              className="metric"
              key={String(label)}
            >
              <div>
                <span>{label}</span>

                <b>
                  {pct(Number(value))}% · {value}
                </b>
              </div>

              <div className="progress">
                <i
                  className={`bar ${color}`}
                  style={{
                    width: `${pct(Number(value))}%`,
                  }}
                />
              </div>
            </div>
          ))}
        </section>

        {/* TIPOS */}
        <section className="card">
          <div className="card-title">
            <div>
              <h3>Mix de operação</h3>
              <p>
                Tipos reais do controle_codigos
              </p>
            </div>
          </div>

          {[
            "MERCADO_LIVRE",
            "SHOPEE",
            "AVULSO",
          ].map(tipo => (
            <div
              className="simple-row"
              key={tipo}
            >
              <span>{nomeTipo(tipo)}</span>

              <b>
                {
                  pacotes.filter(
                    p => p.tipo === tipo
                  ).length
                }
              </b>
            </div>
          ))}
        </section>
      </div>

      {/* ÚLTIMOS REGISTROS */}
      <section className="card">
        <div className="card-title">
          <div>
            <h3>Últimos registros</h3>

            <p>
              {ini} até {fim}
            </p>
          </div>
        </div>

        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Código</th>
                <th>Empresa</th>
                <th>Tipo</th>
                <th>Responsável</th>
                <th>Status</th>
              </tr>
            </thead>

            <tbody>
              {ult.length > 0 ? (
                ult.map(p => (
                  <tr key={p.id}>
                    <td>
                      <b>{p.codigo}</b>
                    </td>

                    <td>
                      {p.empresa || "—"}
                    </td>

                    <td>
                      {nomeTipo(p.tipo)}
                    </td>

                    <td>
                      {p.usuarioNome?.trim() ||
                        p.usuarioFinalizacao ||
                        p.usuario ||
                        "—"}
                    </td>

                    <td>
                      <StatusBadge
                        status={p.status}
                      />
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td
                    colSpan={5}
                    style={{
                      textAlign: "center",
                      padding: "30px",
                      color: "#667085",
                    }}
                  >
                    Nenhum registro encontrado no período.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}