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
import { collection, doc, getDoc, getDocs } from "firebase/firestore";

import PageHeader from "../components/ui/PageHeader";
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


// ===== SLA POR EMPRESA (MERCADO LIVRE / SHOPEE) =====
// MESMA LOGICA DA OPERACAO: a faixa de horario e definida pela ULTIMA
// movimentacao ENTREGUE do historico do pacote.
function dataHistoricoSla(valor: any): number | null {
  if (valor?.toDate instanceof Function) {
    const data = valor.toDate();
    return data instanceof Date ? data.getTime() : null;
  }

  const timestamp = timestampMs(valor);
  if (Number.isFinite(timestamp)) return timestamp;

  if (typeof valor === "string") {
    const parsed = Date.parse(valor);
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
}

function movimentosEntregaSla(pacote: any) {
  const fonte = pacote?.historico;
  const itens = Array.isArray(fonte)
    ? fonte
    : fonte && typeof fonte === "object"
      ? Object.values(fonte)
      : [];

  return itens
    .filter(
      (item): item is Record<string, any> =>
        Boolean(item) &&
        typeof item === "object" &&
        !Array.isArray(item)
    )
    .map(item => ({
      data: dataHistoricoSla(item.dataHora),
      status: String(item.status || "").trim().toUpperCase(),
    }))
    .filter(
      (item): item is { data: number; status: string } =>
        item.data !== null && item.status === "ENTREGUE"
    )
    .sort((a, b) => a.data - b.data);
}

function textoEmpresaSla(pacote: any) {
  return [
    pacote?.empresa,
    pacote?.tipo,
    pacote?.transportadora,
    pacote?.origem,
  ]
    .filter(Boolean)
    .join(" ")
    .toUpperCase()
    .replace(/\s+/g, " ");
}

function isMercadoLivreSla(pacote: any) {
  const texto = textoEmpresaSla(pacote);

  return (
    /MERCADO[\s_-]*LIVRE/.test(texto) ||
    texto.includes("MELI")
  );
}

function isShopeeSla(pacote: any) {
  return textoEmpresaSla(pacote).includes("SHOPEE");
}

function normalizarFinanceiro(valor: any) {
  return String(valor ?? "").trim().toLowerCase();
}

function dataFinanceiro(valor: any): Date | null {
  if (!valor) return null;

  if (valor instanceof Date) {
    return Number.isNaN(valor.getTime()) ? null : valor;
  }

  if (typeof valor?.toDate === "function") {
    const d = valor.toDate();
    return Number.isNaN(d.getTime()) ? null : d;
  }

  if (typeof valor?.seconds === "number") {
    const d = new Date(
      valor.seconds * 1000 +
        Math.floor((valor.nanoseconds || 0) / 1000000)
    );
    return Number.isNaN(d.getTime()) ? null : d;
  }

  const d = new Date(valor);
  return Number.isNaN(d.getTime()) ? null : d;
}

function statusPacoteFinanceiro(pacote: any) {
  return String(
    pacote.status ||
      pacote.situacao ||
      pacote.statusEntrega ||
      ""
  )
    .trim()
    .toUpperCase();
}

function dataPacoteEmpresaFinanceiro(pacote: any): Date | null {
  const historico = Array.isArray(pacote.historico)
    ? pacote.historico
    : [];

  // Mesma regra do Financeiro: a primeira entrada COLETADO é a data real.
  const coletaHistorico = historico.find(
    (item: any) =>
      String(item?.status || "").trim().toUpperCase() === "COLETADO"
  );

  if (coletaHistorico) {
    return dataFinanceiro(
      coletaHistorico.dataHora ||
        coletaHistorico.data ||
        coletaHistorico.timestamp
    );
  }

  // Compatibilidade do Financeiro para registros antigos sem histórico.
  if (statusPacoteFinanceiro(pacote) === "COLETADO") {
    return dataFinanceiro(pacote.data);
  }

  return null;
}

function dentroPeriodoFinanceiro(
  valor: Date | null,
  inicio: Date,
  fim: Date
) {
  if (!valor) return false;

  const tempo = valor.getTime();
  return tempo >= inicio.getTime() && tempo <= fim.getTime();
}

function pacotePertenceEmpresaFinanceiro(
  pacote: any,
  empresa: any
) {
  const valoresPacote = [
    pacote.empresaId,
    pacote.empresa,
    pacote.pasta,
    pacote.coletaId,
    pacote.coleta,
  ]
    .filter(Boolean)
    .map(normalizarFinanceiro);

  const valoresEmpresa = [
    empresa.id,
    empresa.nome,
    empresa.razaoSocial,
  ]
    .filter(Boolean)
    .map(normalizarFinanceiro);

  if (valoresPacote.some((valor: string) => valoresEmpresa.includes(valor))) {
    return true;
  }

  const pastasEmpresa = Array.isArray(empresa.pastas)
    ? empresa.pastas.filter(Boolean).map(normalizarFinanceiro)
    : [];

  return Boolean(
    pastasEmpresa.length &&
      valoresPacote.some((valor: string) => pastasEmpresa.includes(valor))
  );
}

function empresaDaColetaFinanceiro(pacote: any, coletas: any[]) {
  const chave = String(
    pacote.empresaId ||
      pacote.empresa ||
      pacote.pasta ||
      pacote.coletaId ||
      pacote.coleta ||
      ""
  );

  const coleta = coletas.find(
    item =>
      normalizarFinanceiro(item.id) === normalizarFinanceiro(chave) ||
      normalizarFinanceiro(item.nome) === normalizarFinanceiro(chave)
  );

  const transportadora = pacote.transportadora || coleta?.transportadora;
  const transportadoraObjeto =
    transportadora && typeof transportadora === "object"
      ? transportadora
      : null;

  return {
    transportadoraId: String(
      pacote.transportadoraId ||
        coleta?.transportadoraId ||
        transportadoraObjeto?.id ||
        (typeof transportadora === "string" ? transportadora : "") ||
        "sem_transportadora"
    ),
    transportadoraNome: String(
      pacote.transportadoraNome ||
        coleta?.transportadoraNome ||
        transportadoraObjeto?.nome ||
        (typeof transportadora === "string" ? transportadora : "") ||
        "Sem Transportadora"
    ),
  };
}

function transportadoraDaEmpresaFinanceiro(
  empresa: any,
  coletas: any[],
  pacotes: any[]
) {
  const pastas = Array.isArray(empresa.pastas)
    ? empresa.pastas.map(normalizarFinanceiro)
    : [];

  const coletasEmpresa = coletas.filter(coleta => {
    const ids = [
      coleta.id,
      coleta.nome,
      coleta.pasta,
      coleta.pastaId,
    ]
      .filter(Boolean)
      .map(normalizarFinanceiro);

    return ids.some((id: string) => pastas.includes(id));
  });

  const pacoteEmpresa = pacotes.find(pacote =>
    pacotePertenceEmpresaFinanceiro(pacote, empresa)
  );

  const fontes = [
    empresa,
    ...coletasEmpresa,
    ...(pacoteEmpresa
      ? [empresaDaColetaFinanceiro(pacoteEmpresa, coletas)]
      : []),
  ];

  for (const fonte of fontes) {
    const transportadora = fonte?.transportadora;
    const transportadoraObjeto =
      transportadora && typeof transportadora === "object"
        ? transportadora
        : null;

    const id = String(
      fonte?.transportadoraId ||
        transportadoraObjeto?.id ||
        (typeof transportadora === "string" ? transportadora : "") ||
        ""
    ).trim();

    const nome = String(
      fonte?.transportadoraNome ||
        transportadoraObjeto?.nome ||
        (typeof transportadora === "string" ? transportadora : "") ||
        ""
    ).trim();

    if (id || nome) {
      return {
        id: id || nome,
        nome: nome || id,
      };
    }
  }

  return {
    id: "sem_transportadora",
    nome: "Sem Transportadora",
  };
}

// CIRCULO DE PORCENTAGEM DO SLA
function CirculoPercentualSla({
  percentual,
  cor,
  legenda,
  quantidade,
  total,
}: {
  percentual: number;
  cor: string;
  legenda: string;
  quantidade: number;
  total: number;
}) {
  const raio = 34;
  const circunferencia = 2 * Math.PI * raio;
  const preenchido = (Math.min(percentual, 100) / 100) * circunferencia;

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: "8px",
        minWidth: "110px",
        flex: "1",
      }}
    >
      <div style={{ position: "relative", width: "86px", height: "86px" }}>
        <svg width="86" height="86">
          <circle
            cx="43"
            cy="43"
            r={raio}
            fill="none"
            stroke="#eef1f5"
            strokeWidth="9"
          />
          <circle
            cx="43"
            cy="43"
            r={raio}
            fill="none"
            stroke={cor}
            strokeWidth="9"
            strokeLinecap="round"
            strokeDasharray={`${preenchido} ${circunferencia}`}
            transform="rotate(-90 43 43)"
            style={{ transition: "stroke-dasharray .5s ease" }}
          />
        </svg>

        <div
          style={{
            position: "absolute",
            inset: "0",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontWeight: 800,
            fontSize: "15px",
          }}
        >
          {percentual}%
        </div>
      </div>

      <div style={{ textAlign: "center" }}>
        <div style={{ fontSize: "11px", fontWeight: 800 }}>{legenda}</div>

        <div style={{ fontSize: "11px", color: "#667085" }}>
          {quantidade} de {total}
        </div>
      </div>
    </div>
  );
}

export default function Dashboard() {
  const yesterday = getYesterday();

  const [all, setAll] = useState<Pacote[]>([]);
  const [empresas, setEmpresas] = useState<any[]>([]);
  const [coletas, setColetas] = useState<any[]>([]);
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
        // ADMIN OU USUÁRIO COM PERMISSÃO DE FINALIZADOS
setAllowed(
  userData?.tipo === "admin" ||
  userData?.permissoes?.finalizados === true
);
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
      const [dados, empresasSnap, coletasSnap] = await Promise.all([
        listarPacotes(),
        getDocs(collection(db, "empresas")).catch(() => null),
        getDocs(collection(db, "coletas")).catch(() => null),
      ]);

      setAll(dados);
      setEmpresas(
        empresasSnap?.docs.map(item => ({
          id: item.id,
          ...item.data(),
        })) || []
      );
      setColetas(
        coletasSnap?.docs.map(item => ({
          id: item.id,
          ...item.data(),
        })) || []
      );
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

  const coletadosPorTransportadora = useMemo(() => {
    const inicio = new Date(`${ini}T00:00:00`);
    const final = new Date(`${fim}T23:59:59.999`);
    const porTransportadora = new Map<
      string,
      {
        id: string;
        nome: string;
        empresas: any[];
        total: number;
      }
    >();

    empresas.forEach(empresa => {
      const transportadora = transportadoraDaEmpresaFinanceiro(
        empresa,
        coletas,
        all
      );
      const chave =
        normalizarFinanceiro(
          transportadora.id || transportadora.nome
        ) || "sem_transportadora";
      const existente = porTransportadora.get(chave) || {
        id: transportadora.id,
        nome: transportadora.nome,
        empresas: [],
        total: 0,
      };

      existente.empresas.push(empresa);
      porTransportadora.set(chave, existente);
    });

    const codigosContados = new Set<string>();

    all.forEach(pacote => {
      const dataColeta = dataPacoteEmpresaFinanceiro(pacote);
      if (!dentroPeriodoFinanceiro(dataColeta, inicio, final)) return;

      const codigo = String(pacote.codigo || pacote.id);
      if (codigosContados.has(codigo)) return;

      for (const grupo of porTransportadora.values()) {
        const pertenceAoGrupo = grupo.empresas.some(empresa =>
          pacotePertenceEmpresaFinanceiro(pacote, empresa)
        );

        if (!pertenceAoGrupo) continue;

        grupo.total++;
        codigosContados.add(codigo);
        break;
      }
    });

    return Array.from(porTransportadora.values())
      .filter(item => item.total > 0)
      .map(({ nome, total }) => ({ transportadora: nome, total }))
      .sort(
        (a, b) =>
          b.total - a.total ||
          a.transportadora.localeCompare(b.transportadora, "pt-BR")
      );
  }, [all, empresas, coletas, ini, fim]);

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

  // SLA POR EMPRESA: MERCADO LIVRE E SHOPEE, SOMENTE PACOTES DO PERIODO DO FILTRO
  const slaEmpresas = useMemo(() => {
    const criar = () => ({
      total: 0,
      ate21: 0,
      entre21e23: 0,
      apos23: 0,
    });

    const mercadoLivre = criar();
    const shopee = criar();

    pacotes.forEach(p => {
      const entregas = movimentosEntregaSla(p);

      if (!entregas.length) return;

      const ultimaEntrega = entregas[entregas.length - 1];
      const d = new Date(ultimaEntrega.data);
      const minutos = d.getHours() * 60 + d.getMinutes();

      if (isMercadoLivreSla(p)) {
        mercadoLivre.total++;

        if (minutos <= 21 * 60) mercadoLivre.ate21++;
        else if (minutos <= 23 * 60) mercadoLivre.entre21e23++;
        else mercadoLivre.apos23++;
      } else if (isShopeeSla(p)) {
        shopee.total++;

        if (minutos <= 21 * 60) shopee.ate21++;
        else if (minutos <= 23 * 60) shopee.entre21e23++;
        else shopee.apos23++;
      }
    });

    const comPercentual = (e: {
      total: number;
      ate21: number;
      entre21e23: number;
      apos23: number;
    }) => ({
      ...e,
      pctAte21: e.total ? Math.round((e.ate21 * 100) / e.total) : 0,
      pctEntre21e23: e.total
        ? Math.round((e.entre21e23 * 100) / e.total)
        : 0,
      pctApos23: e.total ? Math.round((e.apos23 * 100) / e.total) : 0,
    });

    return {
      mercadoLivre: comPercentual(mercadoLivre),
      shopee: comPercentual(shopee),
    };
  }, [pacotes]);

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

      {/* SLA POR EMPRESA - CIRCULOS DE PORCENTAGEM */}
      <section className="card">
        <div className="card-title">
          <div>
            <h3>SLA por empresa</h3>
            <p>
              Entregas por faixa de horário · {ini} até {fim}
            </p>
          </div>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns:
              "repeat(auto-fit, minmax(300px, 1fr))",
            gap: "20px",
          }}
        >
          {(
            [
              ["Mercado Livre", slaEmpresas.mercadoLivre],
              ["Shopee", slaEmpresas.shopee],
            ] as const
          ).map(([nome, e]) => (
            <div
              key={nome}
              style={{
                border: "1px solid #eef1f5",
                borderRadius: "14px",
                padding: "18px",
                display: "flex",
                flexDirection: "column",
                gap: "16px",
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                }}
              >
                <b style={{ fontSize: "14px" }}>{nome}</b>

                <span
                  style={{
                    fontSize: "12px",
                    fontWeight: 700,
                    color: "#667085",
                  }}
                >
                  Total: {e.total}
                </span>
              </div>

              <div
                style={{
                  display: "flex",
                  flexWrap: "wrap",
                  gap: "10px",
                }}
              >
                <CirculoPercentualSla
                  percentual={e.pctAte21}
                  cor="#16a34a"
                  legenda="Até 21:00"
                  quantidade={e.ate21}
                  total={e.total}
                />

                <CirculoPercentualSla
                  percentual={e.pctEntre21e23}
                  cor="#f59e0b"
                  legenda="21:01–23:00"
                  quantidade={e.entre21e23}
                  total={e.total}
                />

                <CirculoPercentualSla
                  percentual={e.pctApos23}
                  cor="#ef4444"
                  legenda="Após 23:00"
                  quantidade={e.apos23}
                  total={e.total}
                />
              </div>
            </div>
          ))}
        </div>
      </section>

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

          <div
            style={{
              borderTop: "1px solid #eef1f5",
              margin: "16px 0 14px",
            }}
          />

          <div style={{ marginBottom: "8px" }}>
            <b style={{ fontSize: "13px" }}>
              Coletados por transportadora
            </b>
            <p
              style={{
                margin: "4px 0 0",
                fontSize: "12px",
                color: "#667085",
              }}
            >
              Data real da coleta · {ini} até {fim}
            </p>
          </div>

          {coletadosPorTransportadora.length > 0 ? (
            coletadosPorTransportadora.map(({ transportadora, total }) => (
              <div
                className="simple-row"
                key={transportadora}
              >
                <span>{transportadora}</span>
                <b>{total}</b>
              </div>
            ))
          ) : (
            <p
              style={{
                margin: "8px 0 0",
                color: "#667085",
                fontSize: "13px",
              }}
            >
              Nenhum pacote coletado no período.
            </p>
          )}
        </section>
      </div>
    </div>
  );
}