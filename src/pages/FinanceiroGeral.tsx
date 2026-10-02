// ARQUIVO: src/pages/Financeiro.tsx

import {
  useEffect,
  useMemo,
  useState,
  type CSSProperties,
} from "react";
import {
  Banknote,
  Building2,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  CircleDollarSign,
  Edit3,
  Clock3,
  Eye,
  EyeOff,
  Folder,
  History,
  LockKeyhole,
  Package,
  Plus,
  RefreshCw,
  Save,
  Search,
  Trash2,
  TrendingDown,
  TrendingUp,
  Truck,
  User,
  WalletCards,
  X,
  XCircle,
} from "lucide-react";
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  serverTimestamp,
  Timestamp,
  updateDoc,
} from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";

import PageHeader from "../components/ui/PageHeader";
import { db, auth } from "../services/firebase/firebase";
import {
  listarRepasses,
  listarUsuarios,
  nomePorEmail,
} from "../services/financeiro";
import { Repasse, Usuario } from "../types";

type AnyDoc = Record<string, any> & {
  id: string;
};

type ConfigGanhos = {
  [key: string]: any;
  ml?: any;
  valorML?: any;
  mercadoLivre?: any;
  valorMercadoLivre?: any;
  shopee?: any;
  valorShopee?: any;
  avulso?: any;
  valorAvulso?: any;
};

type Frequencia =
  | "FIXO"
  | "DIARIO"
  | "SEMANAL"
  | "QUINZENAL"
  | "MENSAL";

type Gasto = AnyDoc & {
  nome: string;
  icone: string;
  cor: string;
  valor: number;
  frequencia: Frequencia;
  transportadoraId: string;
  transportadoraNome: string;
  empresaId?: string;
  empresaNome?: string;
  ativo?: boolean;
  observacoes?: string;
};

type MetaPacote = AnyDoc & {
  transportadoraId: string;
  transportadoraNome?: string;
  ml?: any;
  shopee?: any;
  avulso?: any;
};

type ModoGeral = "RESUMO" | "VALORES";

type Aba = "REPASSES" | `TRANSPORTADORA:${string}`;

type ModoEmpresa =
  | "LISTA"
  | "DADOS"
  | "FECHAMENTO"
  | "HISTORICO";

type ModoPeriodo = "QUINZENA" | "LIVRE";

const GOLD = "#C9A227";

const campoStyle: CSSProperties = {
  width: "100%",
  padding: "12px 13px",
  border: "1px solid #dbe1e8",
  borderRadius: 10,
  outline: "none",
  boxSizing: "border-box",
  background: "#fff",
  color: "#17202d",
  fontSize: 14,
};

const frequencias: Array<{
  value: Frequencia;
  label: string;
}> = [
  { value: "FIXO", label: "Valor fixo no período" },
  { value: "DIARIO", label: "Valor por dia" },
  { value: "SEMANAL", label: "Valor por semana" },
  { value: "QUINZENAL", label: "Valor por quinzena" },
  { value: "MENSAL", label: "Valor por mês" },
];

const iconesGasto = [
  "💰",
  "⛽",
  "🚚",
  "🛞",
  "🔧",
  "🧰",
  "🛠️",
  "🚗",
  "🏢",
  "🏠",
  "📦",
  "📋",
  "🧾",
  "💳",
  "🏦",
  "📈",
  "📉",
  "💵",
  "🪙",
  "🧮",
  "📊",
  "🖥️",
  "💻",
  "📱",
  "☎️",
  "🌐",
  "⚡",
  "💡",
  "💧",
  "🔥",
  "🔌",
  "🧹",
  "🧼",
  "🗑️",
  "📣",
  "📢",
  "✉️",
  "👥",
  "👤",
  "🍽️",
  "☕",
  "🛒",
  "🚨",
  "🛡️",
  "⚖️",
  "🧑‍💼",
  "📅",
  "⏰",
  "✅",
];

const MESES = [
  "Janeiro",
  "Fevereiro",
  "Março",
  "Abril",
  "Maio",
  "Junho",
  "Julho",
  "Agosto",
  "Setembro",
  "Outubro",
  "Novembro",
  "Dezembro",
];

const br = (valor: number) =>
  Number(valor || 0).toLocaleString(
    "pt-BR",
    {
      style: "currency",
      currency: "BRL",
    }
  );

function n(valor: any) {
  if (typeof valor === "number") {
    return Number.isFinite(valor)
      ? valor
      : 0;
  }

  const texto = String(
    valor ?? ""
  )
    .trim()
    .replace(/\s/g, "");

  if (!texto) return 0;

  if (
    texto.includes(",") &&
    texto.includes(".")
  ) {
    const numero = Number(
      texto
        .replace(/\./g, "")
        .replace(",", ".")
    );

    return Number.isFinite(numero)
      ? numero
      : 0;
  }

  const numero = Number(
    texto.replace(",", ".")
  );

  return Number.isFinite(numero)
    ? numero
    : 0;
}

function inteiro(valor: any) {
  return Math.trunc(n(valor));
}

function estaPago(valor: any) {
  return (
    valor === true ||
    valor === "true" ||
    valor === 1
  );
}

function normalizar(valor: any) {
  return String(valor ?? "")
    .trim()
    .toLowerCase();
}

function data(valor: any): Date | null {
  if (!valor) return null;

  if (valor instanceof Date) {
    return Number.isNaN(
      valor.getTime()
    )
      ? null
      : valor;
  }

  if (
    typeof valor?.toDate ===
    "function"
  ) {
    const d = valor.toDate();

    return Number.isNaN(d.getTime())
      ? null
      : d;
  }

  if (
    typeof valor?.seconds ===
    "number"
  ) {
    const d = new Date(
      valor.seconds * 1000 +
        Math.floor(
          (valor.nanoseconds || 0) /
            1000000
        )
    );

    return Number.isNaN(d.getTime())
      ? null
      : d;
  }

  const d = new Date(valor);

  return Number.isNaN(d.getTime())
    ? null
    : d;
}

function dataTexto(valor: any) {
  const d = data(valor);

  return d
    ? d.toLocaleString("pt-BR")
    : "—";
}

function diaInicio(d: Date) {
  return new Date(
    d.getFullYear(),
    d.getMonth(),
    d.getDate(),
    0,
    0,
    0,
    0
  );
}

function diaFim(d: Date) {
  return new Date(
    d.getFullYear(),
    d.getMonth(),
    d.getDate(),
    23,
    59,
    59,
    999
  );
}

function dataParaInput(d: Date) {
  const ano = d.getFullYear();
  const mes = String(d.getMonth() + 1).padStart(2, "0");
  const dia = String(d.getDate()).padStart(2, "0");

  return `${ano}-${mes}-${dia}`;
}

function dataDoInput(valor: string, fim = false) {
  const partes = valor.split("-").map(Number);

  if (
    partes.length !== 3 ||
    partes.some((parte) => !Number.isFinite(parte))
  ) {
    return null;
  }

  const dataInformada = new Date(
    partes[0],
    partes[1] - 1,
    partes[2]
  );

  if (Number.isNaN(dataInformada.getTime())) {
    return null;
  }

  return fim ? diaFim(dataInformada) : diaInicio(dataInformada);
}

function dentroPeriodo(
  valor: Date | null,
  inicio: Date,
  fim: Date
) {
  if (!valor) return false;

  const tempo =
    valor.getTime();

  return (
    tempo >= inicio.getTime() &&
    tempo <= fim.getTime()
  );
}

function diasNoPeriodo(inicio: Date, fim: Date) {
  return (
    Math.floor(
      (diaInicio(fim).getTime() -
        diaInicio(inicio).getTime()) /
        86400000
    ) + 1
  );
}

function diasOperacionaisNoPeriodo(
  inicio: Date,
  fim: Date
) {
  let total = 0;
  const cursor = diaInicio(inicio);
  const limite = diaInicio(fim);

  while (cursor.getTime() <= limite.getTime()) {
    const diaSemana = cursor.getDay();

    if (diaSemana >= 1 && diaSemana <= 5) {
      total += 1;
    } else if (diaSemana === 6) {
      total += 0.5;
    }

    cursor.setDate(cursor.getDate() + 1);
  }

  return total;
}

function quantidadeCobrancas(
  frequencia: Frequencia,
  inicio: Date,
  fim: Date
) {
  const dias = diasNoPeriodo(inicio, fim);

  if (frequencia === "DIARIO") return dias;
  if (frequencia === "SEMANAL") return Math.ceil(dias / 7);
  if (frequencia === "QUINZENAL") return Math.ceil(dias / 15);

  if (frequencia === "MENSAL") {
    return (
      (fim.getFullYear() - inicio.getFullYear()) * 12 +
      fim.getMonth() -
      inicio.getMonth() +
      1
    );
  }

  return 1;
}

function gastoNoPeriodo(
  gasto: Gasto,
  inicio: Date,
  fim: Date
) {
  if (gasto.ativo === false) return 0;

  return (
    n(gasto.valor) *
    quantidadeCobrancas(
      gasto.frequencia || "FIXO",
      inicio,
      fim
    )
  );
}

function intervaloQuinzena(
  mes: number,
  ano: number,
  quinzena: string
) {
  if (quinzena === "01_15") {
    return {
      inicio: new Date(
        ano,
        mes - 1,
        1,
        0,
        0,
        0,
        0
      ),
      fim: new Date(
        ano,
        mes - 1,
        15,
        23,
        59,
        59,
        999
      ),
    };
  }

  const ultimoDia = new Date(
    ano,
    mes,
    0
  ).getDate();

  return {
    inicio: new Date(
      ano,
      mes - 1,
      16,
      0,
      0,
      0,
      0
    ),
    fim: new Date(
      ano,
      mes - 1,
      ultimoDia,
      23,
      59,
      59,
      999
    ),
  };
}

function intervaloMesFinanceiro(referencia: Date) {
  const inicio =
    referencia.getDate() >= 16
      ? new Date(
          referencia.getFullYear(),
          referencia.getMonth(),
          16,
          0,
          0,
          0,
          0
        )
      : new Date(
          referencia.getFullYear(),
          referencia.getMonth() - 1,
          16,
          0,
          0,
          0,
          0
        );

  return {
    inicio,
    fim: new Date(
      inicio.getFullYear(),
      inicio.getMonth() + 1,
      15,
      23,
      59,
      59,
      999
    ),
  };
}

function primeiraQuinzenaFinanceira(
  referencia: Date
) {
  const mes = intervaloMesFinanceiro(referencia);

  return {
    inicio: mes.inicio,
    fim: new Date(
      mes.inicio.getFullYear(),
      mes.inicio.getMonth() + 1,
      0,
      23,
      59,
      59,
      999
    ),
  };
}

function segundaQuinzenaFinanceira(
  referencia: Date
) {
  const mes = intervaloMesFinanceiro(referencia);

  return {
    inicio: new Date(
      mes.inicio.getFullYear(),
      mes.inicio.getMonth() + 1,
      1,
      0,
      0,
      0,
      0
    ),
    fim: mes.fim,
  };
}

function labelQuinzena(
  quinzena: string
) {
  return quinzena === "01_15"
    ? "01 ao 15"
    : "16 ao fim";
}

function ultimaQuinzenaFechada(
  hoje: Date
) {
  if (hoje.getDate() <= 15) {
    const mesAnterior =
      new Date(
        hoje.getFullYear(),
        hoje.getMonth() - 1,
        1
      );

    return {
      mes:
        mesAnterior.getMonth() + 1,
      ano:
        mesAnterior.getFullYear(),
      quinzena: "16_fim",
    };
  }

  return {
    mes: hoje.getMonth() + 1,
    ano: hoje.getFullYear(),
    quinzena: "01_15",
  };
}

function tipoPacote(tipo: any) {
  const valor = String(
    tipo ?? ""
  )
    .trim()
    .toUpperCase();

  if (
    valor.includes("MERCADO") ||
    valor === "ML" ||
    valor.includes("MELI")
  ) {
    return "MERCADO_LIVRE";
  }

  if (
    valor.includes("SHOPEE")
  ) {
    return "SHOPEE";
  }

  return "AVULSO";
}

function statusPacote(
  pacote: AnyDoc
) {
  return String(
    pacote.status ||
      pacote.situacao ||
      pacote.statusEntrega ||
      ""
  )
    .trim()
    .toUpperCase();
}

function usuarioPacote(
  pacote: AnyDoc
) {
  return normalizar(
    pacote.usuario ||
      pacote.usuarioFinalizacao ||
      pacote.usuarioId ||
      pacote.userId ||
      pacote.entregadorId ||
      pacote.motoristaId ||
      ""
  );
}

function dataEntrega(
  pacote: AnyDoc
): Date | null {
  const historico = Array.isArray(
    pacote.historico
  )
    ? pacote.historico
    : [];

  const entregueHistorico =
    [...historico]
      .reverse()
      .find((item: any) =>
        String(
          item?.status || ""
        )
          .trim()
          .toUpperCase() === "ENTREGUE"
      );

  return (
    data(
      entregueHistorico?.dataHora ||
        entregueHistorico?.data ||
        entregueHistorico?.timestamp
    ) ||
    data(
      pacote.dataHoraBaixa ||
        pacote.dataEntrega ||
        pacote.finalizadoEm ||
        pacote.dataHora ||
        pacote.updatedAt ||
        pacote.data
    )
  );
}

function dataPacoteEmpresa(
  pacote: AnyDoc
): Date | null {
  const historico = Array.isArray(pacote.historico)
    ? pacote.historico
    : [];

  // O campo "data" muda quando o pacote avança de status. A data
  // confiável da receita é a primeira entrada COLETADO do histórico.
  const coletaHistorico = historico.find(
    (item: any) =>
      String(item?.status || "").trim().toUpperCase() === "COLETADO"
  );

  if (coletaHistorico) {
    return data(
      coletaHistorico.dataHora ||
        coletaHistorico.data ||
        coletaHistorico.timestamp
    );
  }

  // Compatibilidade com documentos antigos sem histórico.
  if (statusPacote(pacote) === "COLETADO") {
    return data(pacote.data);
  }

  return null;
}

function dataRepasseFechamento(
  pacote: AnyDoc
): Date | null {
  // Mantém o mesmo critério do FechamentoEmpresaScreen:
  // status ENTREGUE + dataHora, com fallback para data.
  return data(pacote.dataHora) || data(pacote.data);
}

function periodoAnterior(
  inicio: Date,
  fim: Date
) {
  const duracao =
    fim.getTime() -
    inicio.getTime();

  const fimAnterior =
    new Date(
      inicio.getTime() - 1
    );

  const inicioAnterior =
    new Date(
      fimAnterior.getTime() -
        duracao
    );

  return {
    inicio: inicioAnterior,
    fim: fimAnterior,
  };
}

function valorEmpresa(
  empresa: AnyDoc,
  tipo: string
) {
  if (
    tipo === "MERCADO_LIVRE"
  ) {
    return n(
      empresa.valorML ||
        empresa.ml ||
        empresa.valorMercadoLivre
    );
  }

  if (tipo === "SHOPEE") {
    return n(
      empresa.valorShopee ||
        empresa.shopee
    );
  }

  return n(
    empresa.valorAvulso ||
      empresa.avulso
  );
}

function Linha({
  label,
  valor,
}: {
  label: string;
  valor: string | number;
}) {
  return (
    <div
      style={{
        display: "flex",
        justifyContent:
          "space-between",
        alignItems: "center",
        gap: 16,
        padding: "11px 0",
        borderBottom:
          "1px solid #e5e7eb",
      }}
    >
      <span
        style={{
          color: "#64748b",
          fontSize: 13,
        }}
      >
        {label}
      </span>

      <strong
        style={{
          color: "#17202d",
          textAlign: "right",
        }}
      >
        {valor}
      </strong>
    </div>
  );
}

function Mini({
  label,
  valor,
}: {
  label: string;
  valor: string;
}) {
  return (
    <div
      style={{
        padding: 10,
        borderRadius: 9,
        background: "#f8fafc",
        border:
          "1px solid #e5e7eb",
      }}
    >
      <small
        style={{
          display: "block",
          color: "#64748b",
          fontWeight: 700,
          fontSize: 10,
        }}
      >
        {label}
      </small>

      <b
        style={{
          display: "block",
          marginTop: 3,
          color: "#17202d",
        }}
      >
        {valor}
      </b>
    </div>
  );
}

function CardTipo({
  titulo,
  qtd,
  valor,
}: {
  titulo: string;
  qtd: number;
  valor: number;
}) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent:
          "space-between",
        gap: 12,
        padding: 13,
        borderRadius: 10,
        border:
          "1px solid #e5e7eb",
        marginBottom: 8,
      }}
    >
      <div>
        <b>{titulo}</b>

        <small
          style={{
            display: "block",
            color: "#64748b",
            marginTop: 3,
          }}
        >
          {qtd} pacote(s)
        </small>
      </div>

      <b>{br(valor)}</b>
    </div>
  );
}

function InfoCard({
  titulo,
  valor,
}: {
  titulo: string;
  valor: React.ReactNode;
}) {
  return (
    <div
      style={{
        padding: "14px 16px",
        border: "1px solid #e8edf3",
        borderRadius: 12,
        background: "linear-gradient(135deg,#fff 0%,#f8fafc 100%)",
      }}
    >
      <small
        style={{
          display: "block",
          color: "#64748b",
          fontSize: 10,
          fontWeight: 900,
          letterSpacing: ".07em",
          marginBottom: 7,
        }}
      >
        {titulo}
      </small>
      <strong style={{ color: "#17202d", fontSize: 16 }}>
        {valor}
      </strong>
    </div>
  );
}

function TituloSecao({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <h4
      style={{
        color: "#334155",
        fontSize: 12,
        letterSpacing: ".06em",
        margin: "22px 0 10px",
      }}
    >
      {children}
    </h4>
  );
}

function AbaBotao({
  ativo,
  texto,
  icon,
  onClick,
}: {
  ativo: boolean;
  texto: string;
  icon: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        border: ativo
          ? `1px solid ${GOLD}`
          : "1px solid #e5e7eb",
        background: ativo
          ? "#fffbeb"
          : "#fff",
        color: ativo
          ? "#92400e"
          : "#475569",
        borderRadius: 10,
        padding: "11px 16px",
        display: "inline-flex",
        alignItems: "center",
        gap: 8,
        fontWeight: 800,
        cursor: "pointer",
        maxWidth: "100%",
        minWidth: 0,
        boxSizing: "border-box",
        whiteSpace: "normal",
        overflowWrap: "anywhere",
      }}
    >
      {icon}
      {texto}
    </button>
  );
}

function QuinzenaBotao({
  ativo,
  texto,
  onClick,
}: {
  ativo: boolean;
  texto: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        flex: 1,
        padding: 12,
        borderRadius: 9,
        border: ativo
          ? `2px solid ${GOLD}`
          : "1px solid #d1d5db",
        background: ativo
          ? "#fffbeb"
          : "#fff",
        color: ativo
          ? "#92400e"
          : "#374151",
        cursor: "pointer",
        fontWeight: 800,
      }}
    >
      {texto}
    </button>
  );
}

function Comparativo({
  label,
  atual,
  anterior,
  atualTexto,
  anteriorTexto,
}: {
  label: string;
  atual: number;
  anterior: number;
  atualTexto: string;
  anteriorTexto: string;
}) {
  const percentual =
    anterior === 0
      ? atual === 0
        ? 0
        : 100
      : (
          ((atual - anterior) /
            Math.abs(anterior)) *
          100
        );

  const positivo =
    percentual >= 0;

  return (
    <div
      style={{
        padding: "12px 0",
        borderBottom:
          "1px solid #e5e7eb",
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent:
            "space-between",
          gap: 15,
          alignItems: "center",
        }}
      >
        <span
          style={{
            color: "#475569",
            fontSize: 13,
          }}
        >
          {label}
        </span>

        <span
          style={{
            color: positivo
              ? "#16a34a"
              : "#dc2626",
            fontWeight: 800,
            fontSize: 12,
            display: "flex",
            alignItems: "center",
            gap: 5,
          }}
        >
          {positivo ? (
            <TrendingUp size={15} />
          ) : (
            <TrendingDown size={15} />
          )}

          {percentual.toFixed(1)}%
        </span>
      </div>

      <div
        style={{
          display: "flex",
          justifyContent:
            "space-between",
          gap: 15,
          marginTop: 6,
          fontSize: 12,
        }}
      >
        <strong>
          {atualTexto}
        </strong>

        <span
          style={{
            color: "#94a3b8",
          }}
        >
          Anterior: {anteriorTexto}
        </span>
      </div>
    </div>
  );
}


// ===================================================================
// DISTRIBUIÇÃO INTEIRA DE PACOTES POR DIA
// Pesos: segunda a sexta = 1, sábado = 0,5, domingo = 0.
// A soma das quantidades inteiras distribuídas é sempre igual ao total.
// ===================================================================
function pesoDoDia(data: Date) {
  const dia = data.getDay();

  if (dia === 0) return 0;
  if (dia === 6) return 0.5;

  return 1;
}

function distribuirInteiroPorDias(
  total: number,
  inicio: Date,
  fim: Date
) {
  const dias: { data: Date; peso: number }[] = [];
  const cursor = new Date(
    inicio.getFullYear(),
    inicio.getMonth(),
    inicio.getDate()
  );
  const limite = new Date(
    fim.getFullYear(),
    fim.getMonth(),
    fim.getDate()
  );

  while (cursor.getTime() <= limite.getTime()) {
    dias.push({
      data: new Date(cursor),
      peso: pesoDoDia(cursor),
    });
    cursor.setDate(cursor.getDate() + 1);
  }

  const pesoTotal = dias.reduce(
    (soma, item) => soma + item.peso,
    0
  );
  const alvo = Math.max(0, Math.round(n(total)));
  const exatos = dias.map((item) =>
    pesoTotal > 0 ? (alvo * item.peso) / pesoTotal : 0
  );
  const partes = exatos.map((valor) => Math.floor(valor));

  let restante =
    alvo - partes.reduce((soma, parte) => soma + parte, 0);

  const ordem = exatos
    .map((valor, indice) => ({
      indice,
      resto: valor - Math.floor(valor),
      peso: dias[indice].peso,
    }))
    .filter((item) => item.peso > 0)
    .sort(
      (a, b) => b.resto - a.resto || b.peso - a.peso
    );

  let passo = 0;

  while (restante > 0 && ordem.length > 0) {
    partes[ordem[passo % ordem.length].indice] += 1;
    restante -= 1;
    passo += 1;
  }

  const porDiaSemana: Record<number, number[]> = {
    0: [], 1: [], 2: [], 3: [], 4: [], 5: [], 6: [],
  };

  dias.forEach((item, indice) => {
    porDiaSemana[item.data.getDay()].push(partes[indice]);
  });

  const media = (lista: number[]) =>
    lista.length > 0
      ? Math.round(
          lista.reduce((soma, valor) => soma + valor, 0) /
            lista.length
        )
      : 0;

  return {
    total: partes.reduce((soma, parte) => soma + parte, 0),
    porDia: partes,
    segunda: media(porDiaSemana[1]),
    terca: media(porDiaSemana[2]),
    quarta: media(porDiaSemana[3]),
    quinta: media(porDiaSemana[4]),
    sexta: media(porDiaSemana[5]),
    sabado: media(porDiaSemana[6]),
    domingo: 0,
  };
}

// Quantidades de pacotes e dias sempre inteiros.
function inteiroBR(valor: number) {
  return Math.round(n(valor)).toLocaleString("pt-BR", {
    maximumFractionDigits: 0,
  });
}


export default function FinanceiroGeral() {
  const hoje = new Date();

  const [users, setUsers] = useState<Usuario[]>([]);
  const [pacotes, setPacotes] = useState<AnyDoc[]>([]);
  const [empresas, setEmpresas] = useState<AnyDoc[]>([]);
  const [coletas, setColetas] = useState<AnyDoc[]>([]);
  const [configGanhos, setConfigGanhos] = useState<AnyDoc[]>([]);
  const [ganhos, setGanhos] = useState<AnyDoc[]>([]);
  const [gastos, setGastos] = useState<Gasto[]>([]);
  const [metasPacote, setMetasPacote] = useState<MetaPacote[]>([]);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState("");

  // PERMISSÃO
  const [checkingAccess, setCheckingAccess] = useState(true);
  const [allowed, setAllowed] = useState(false);

  const intervaloGeralInicial = intervaloMesFinanceiro(hoje);

  const [dataInicioGeral, setDataInicioGeral] = useState(
    dataParaInput(intervaloGeralInicial.inicio)
  );

  const [dataFimGeral, setDataFimGeral] = useState(
    dataParaInput(intervaloGeralInicial.fim)
  );

  const [
    filtroTransportadoraGeral,
    setFiltroTransportadoraGeral,
  ] = useState<string>("TODAS");

  const [modoGeral, setModoGeral] =
    useState<ModoGeral>("RESUMO");

  const [salvandoMeta, setSalvandoMeta] = useState(false);

  const [formMeta, setFormMeta] = useState({
    ml: "",
    shopee: "",
    avulso: "",
  });

  const [salvandoGasto, setSalvandoGasto] = useState(false);
  const [gastoAberto, setGastoAberto] = useState<Gasto | null>(null);
  const [modalGasto, setModalGasto] = useState(false);

  const [formGasto, setFormGasto] = useState({
    nome: "",
    icone: "💰",
    cor: GOLD,
    valor: "",
    frequencia: "FIXO" as Frequencia,
    empresaId: "TODAS",
    observacoes: "",
    ativo: true,
  });

  const intervaloGeral = useMemo(() => {
    const inicio = dataDoInput(dataInicioGeral);
    const fim = dataDoInput(dataFimGeral, true);

    if (inicio && fim && inicio.getTime() <= fim.getTime()) {
      return { inicio, fim };
    }

    return intervaloMesFinanceiro(new Date());
  }, [dataInicioGeral, dataFimGeral]);

  const inicioGeral = intervaloGeral.inicio;
  const fimGeral = intervaloGeral.fim;

  // VERIFICA SE É ADMIN
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(
      auth,
      async user => {
        if (!user) {
          setAllowed(false);
          setCheckingAccess(false);
          return;
        }

        try {
          // PRIMEIRA TENTATIVA: DOCUMENTO COM UID
          let userDoc = await getDoc(
            doc(db, "usuarios", user.uid)
          );

          // SEGUNDA TENTATIVA: DOCUMENTO COM EMAIL
          if (!userDoc.exists() && user.email) {
            userDoc = await getDoc(
              doc(
                db,
                "usuarios",
                user.email.toLowerCase()
              )
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
          console.error(
            "Erro ao verificar permissão:",
            error
          );
          setAllowed(false);
        } finally {
          setCheckingAccess(false);
        }
      }
    );

    return () => unsubscribe();
  }, []);

  async function load() {
    setLoading(true);
    setErro("");

    try {
      const [
        usuariosData,
        pacotesSnap,
        empresasSnap,
        coletasSnap,
        configGanhosSnap,
        ganhosSnap,
        gastosSnap,
        metasSnap,
      ] = await Promise.all([
        listarUsuarios().catch(() => []),
        getDocs(collection(db, "controle_codigos")),
        getDocs(collection(db, "empresas")).catch(() => ({ docs: [] })),
        getDocs(collection(db, "coletas")).catch(() => ({ docs: [] })),
        getDocs(collection(db, "config_ganhos")).catch(() => ({ docs: [] })),
        getDocs(collection(db, "ganhos")).catch(() => ({ docs: [] })),
        getDocs(collection(db, "gastos_financeiros")).catch(() => ({ docs: [] })),
        getDocs(collection(db, "metas_valor_pacote")).catch(() => ({ docs: [] })),
      ]);

      setUsers(usuariosData || []);

      setPacotes(
        pacotesSnap.docs.map((item: any) => ({
          id: item.id,
          ...item.data(),
        }))
      );

      setEmpresas(
        empresasSnap.docs.map((item: any) => ({
          id: item.id,
          ...item.data(),
        }))
      );

      setColetas(
        coletasSnap.docs.map((item: any) => ({
          id: item.id,
          ...item.data(),
        }))
      );

      setConfigGanhos(
        configGanhosSnap.docs.map((item: any) => ({
          id: item.id,
          ...item.data(),
        }))
      );

      setGanhos(
        ganhosSnap.docs.map((item: any) => ({
          id: item.id,
          ...item.data(),
        }))
      );

      setGastos(
        gastosSnap.docs.map((item: any) => ({
          id: item.id,
          ...item.data(),
        }))
      );

      setMetasPacote(
        metasSnap.docs.map((item: any) => ({
          id: item.id,
          ...item.data(),
        }))
      );
    } catch (e) {
      console.error(e);

      setErro(
        "Não foi possível carregar os dados do Firebase."
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (allowed) {
      load();
    }
  }, [allowed]);

  function usuarioEncontrado(
    id: string
  ) {
    const chave =
      normalizar(id);

    return users.find(
      (usuario: any) =>
        normalizar(
          usuario.id
        ) === chave ||
        normalizar(
          usuario.uid
        ) === chave ||
        normalizar(
          usuario.email
        ) === chave ||
        normalizar(
          usuario.usuario
        ) === chave
    ) as AnyDoc | undefined;
  }

  function configUsuario(
    usuarioId: string
  ): ConfigGanhos {
    const chave =
      normalizar(usuarioId);

    return (
      configGanhos.find(
        (config) =>
          normalizar(
            config.id
          ) === chave ||
          normalizar(
            config.usuarioId
          ) === chave ||
          normalizar(
            config.usuario
          ) === chave ||
          normalizar(
            config.uid
          ) === chave ||
          normalizar(
            config.email
          ) === chave
      ) || {}
    );
  }

  function valorUsuario(
    usuario: AnyDoc | undefined,
    tipo: string
  ) {
    const usuarioId =
      String(
        usuario?.id ||
          usuario?.uid ||
          usuario?.email ||
          ""
      );

    const config =
      configUsuario(usuarioId);

    if (
      tipo === "MERCADO_LIVRE"
    ) {
      return n(
        config.ml ||
          config.valorML ||
          config.mercadoLivre ||
          config.valorMercadoLivre
      );
    }

    if (tipo === "SHOPEE") {
      return n(
        config.shopee ||
          config.valorShopee
      );
    }

    return n(
      config.avulso ||
        config.valorAvulso
    );
  }

  function empresaDaColeta(
    pacote: AnyDoc
  ) {
    const chave =
      String(
        pacote.empresaId ||
          pacote.empresa ||
          pacote.pasta ||
          pacote.coletaId ||
          pacote.coleta ||
          ""
      );

    const coleta =
      coletas.find(
        (item) =>
          normalizar(item.id) ===
            normalizar(chave) ||
          normalizar(item.nome) ===
            normalizar(chave)
      );

    const transportadora =
      pacote.transportadora ||
      coleta?.transportadora;
    const transportadoraObjeto =
      transportadora &&
      typeof transportadora === "object"
        ? transportadora
        : null;

    return {
      transportadoraId:
        String(
          pacote.transportadoraId ||
            coleta?.transportadoraId ||
            transportadoraObjeto?.id ||
            (typeof transportadora === "string"
              ? transportadora
              : "") ||
            "sem_transportadora"
        ),
      transportadoraNome:
        String(
          pacote.transportadoraNome ||
            coleta?.transportadoraNome ||
            transportadoraObjeto?.nome ||
            (typeof transportadora === "string"
              ? transportadora
              : "") ||
            "Sem Transportadora"
        ),
    };
  }

  function usuarioEntrega(
    pacote: AnyDoc
  ) {
    return usuarioPacote(pacote);
  }

  function pacotePertenceEmpresa(
    pacote: AnyDoc,
    empresa: AnyDoc
  ) {
    const valoresPacote = [
      pacote.empresaId,
      pacote.empresa,
      pacote.pasta,
      pacote.coletaId,
      pacote.coleta,
    ]
      .filter(Boolean)
      .map(normalizar);

    const valoresEmpresa = [
      empresa.id,
      empresa.nome,
      empresa.razaoSocial,
    ]
      .filter(Boolean)
      .map(normalizar);

    if (
      valoresPacote.some((valor) =>
        valoresEmpresa.includes(valor)
      )
    ) {
      return true;
    }

    const pastasEmpresa = Array.isArray(
      empresa.pastas
    )
      ? empresa.pastas
          .filter(Boolean)
          .map(normalizar)
      : [];

    if (
      pastasEmpresa.length &&
      valoresPacote.some((valor) =>
        pastasEmpresa.includes(valor)
      )
    ) {
      return true;
    }

    return false;
  }
  function calcularEmpresa(
    empresa: AnyDoc,
    inicio: Date,
    fim: Date
  ) {
    let qtdML = 0;
    let qtdShopee = 0;
    let qtdAvulso = 0;

    const codigos =
      new Set<string>();

    pacotes.forEach((pacote) => {
      if (
        !pacotePertenceEmpresa(
          pacote,
          empresa
        )
      ) {
        return;
      }

       const dataPacote =
         dataPacoteEmpresa(pacote);

      if (
        !dentroPeriodo(
          dataPacote,
          inicio,
          fim
        )
      ) {
        return;
      }

      const codigo = String(
        pacote.codigo || pacote.id
      );

      if (codigos.has(codigo)) {
        return;
      }

      codigos.add(codigo);

      const tipo =
        tipoPacote(
          pacote.tipo ||
            pacote.plataforma
        );

      if (
        tipo === "MERCADO_LIVRE"
      ) {
        qtdML += 1;
      } else if (
        tipo === "SHOPEE"
      ) {
        qtdShopee += 1;
      } else {
        qtdAvulso += 1;
      }
    });

    const valorML =
      valorEmpresa(
        empresa,
        "MERCADO_LIVRE"
      );

    const valorShopee =
      valorEmpresa(
        empresa,
        "SHOPEE"
      );

    const valorAvulso =
      valorEmpresa(
        empresa,
        "AVULSO"
      );

    const totalReceber =
      qtdML * valorML +
      qtdShopee * valorShopee +
      qtdAvulso * valorAvulso;

    let totalRepasse = 0;
    let totalRepasseML = 0;
    let totalRepasseShopee = 0;
    let totalRepasseAvulso = 0;

    const codigosRepasse =
      new Set<string>();

    pacotes.forEach((pacote) => {
      if (
        !pacotePertenceEmpresa(
          pacote,
          empresa
        )
      ) {
        return;
      }

      if (
        statusPacote(pacote) !==
        "ENTREGUE"
      ) {
        return;
      }

       const entrega =
         dataRepasseFechamento(pacote);

      if (
        !dentroPeriodo(
          entrega,
          inicio,
          fim
        )
      ) {
        return;
      }

      const codigo = String(
        pacote.codigo || pacote.id
      );

      if (
        codigosRepasse.has(codigo)
      ) {
        return;
      }

      codigosRepasse.add(codigo);

      const usuarioId =
        usuarioEntrega(pacote);

      const usuario =
        usuarioEncontrado(usuarioId);

      const tipo =
        tipoPacote(
          pacote.tipo ||
            pacote.plataforma
        );

      const repasse =
        valorUsuario(
          usuario,
          tipo
        );

      totalRepasse += repasse;

      if (tipo === "MERCADO_LIVRE") {
        totalRepasseML += repasse;
      } else if (tipo === "SHOPEE") {
        totalRepasseShopee += repasse;
      } else {
        totalRepasseAvulso += repasse;
      }
    });

    return {
      empresa,
      empresaId: empresa.id,

      empresaNome:
        empresa.nome ||
        empresa.razaoSocial ||
        empresa.id,

      valorML,
      valorShopee,
      valorAvulso,

      qtdML,
      qtdShopee,
      qtdAvulso,

      totalPacotes:
        qtdML +
        qtdShopee +
        qtdAvulso,

      totalReceber,
      totalRepasse,
      totalRepasseML,
      totalRepasseShopee,
      totalRepasseAvulso,

      lucro:
        totalReceber -
        totalRepasse,
    };
  }
  function transportadoraDaEmpresa(empresa: AnyDoc) {
    const pastas = Array.isArray(empresa.pastas)
      ? empresa.pastas.map((item: any) => normalizar(item))
      : [];

    const coletasEmpresa = coletas.filter((coleta) => {
      const ids = [
        coleta.id,
        coleta.nome,
        coleta.pasta,
        coleta.pastaId,
      ]
        .filter(Boolean)
        .map(normalizar);

      return ids.some((id) => pastas.includes(id));
    });

    const pacoteEmpresa = pacotes.find((pacote) =>
      pacotePertenceEmpresa(pacote, empresa)
    );

    const fontes: any[] = [
      empresa,
      ...coletasEmpresa,
      ...(pacoteEmpresa ? [empresaDaColeta(pacoteEmpresa)] : []),
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
          (typeof transportadora === "string"
            ? transportadora
            : "") ||
          ""
      ).trim();

      const nome = String(
        fonte?.transportadoraNome ||
          transportadoraObjeto?.nome ||
          (typeof transportadora === "string"
            ? transportadora
            : "") ||
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

  function gastoPertenceTransportadora(
    gasto: Gasto,
    transportadoraId: string,
    transportadoraNome?: string
  ) {
    // Quando existe ID, ele é a chave única. O nome só é usado
    // para compatibilidade com registros antigos sem ID.
    if (gasto.transportadoraId) {
      return (
        normalizar(gasto.transportadoraId) ===
        normalizar(transportadoraId)
      );
    }

    const nomesAntigos = [
      (gasto as AnyDoc).transportadora,
      gasto.transportadoraNome,
    ]
      .filter(Boolean)
      .map(normalizar);

    return nomesAntigos.includes(normalizar(transportadoraNome));
  }

  function calcularGastosTransportadora(
    transportadoraId: string,
    transportadoraNome: string,
    inicio: Date,
    fim: Date
  ) {
    return gastos
      .filter((gasto) =>
        gastoPertenceTransportadora(
          gasto,
          transportadoraId,
          transportadoraNome
        )
      )
      .reduce(
        (total, gasto) =>
          total + gastoNoPeriodo(gasto, inicio, fim),
        0
      );
  }

  // Agrupamento de empresas por transportadora (sem dependência de repasses).
  const transportadorasResumo = useMemo(() => {
    const mapa = new Map<string, AnyDoc>();

    empresas.forEach((empresa) => {
      const transportadora = transportadoraDaEmpresa(empresa);
      const chave =
        normalizar(transportadora.id || transportadora.nome) ||
        "sem_transportadora";
      const existente =
        mapa.get(chave) || {
          id: transportadora.id,
          nome: transportadora.nome,
          empresas: [] as AnyDoc[],
        };

      existente.empresas.push({ empresa });
      mapa.set(chave, existente);
    });

    return Array.from(mapa.values()).sort((a, b) =>
      String(a.nome || "").localeCompare(
        String(b.nome || ""),
        "pt-BR"
      )
    );
  }, [empresas, coletas, pacotes]);

  function metaDaTransportadora(
    transportadoraId: string
  ) {
    const registro = metasPacote.find(
      (item) =>
        normalizar(item.transportadoraId) ===
        normalizar(transportadoraId)
    );

    return {
      ml: n(registro?.ml),
      shopee: n(registro?.shopee),
      avulso: n(registro?.avulso),
    };
  }
  const transportadorasDoGeral = useMemo(() => {
    if (filtroTransportadoraGeral === "TODAS") {
      return transportadorasResumo;
    }

    return transportadorasResumo.filter(
      (item) =>
        normalizar(item.id) ===
        normalizar(filtroTransportadoraGeral)
    );
  }, [
    transportadorasResumo,
    filtroTransportadoraGeral,
  ]);

  const gastosDoGeral = useMemo(() => {
    return gastos
      .filter((gasto) =>
        transportadorasDoGeral.some((transportadora) =>
          gastoPertenceTransportadora(
            gasto,
            transportadora.id,
            transportadora.nome
          )
        )
      )
      .sort((a, b) =>
        String(a.nome || "").localeCompare(
          String(b.nome || ""),
          "pt-BR"
        )
      );
  }, [gastos, transportadorasDoGeral]);

  const financeiroGeral = useMemo(() => {
    const base = {
      faturamentoBruto: 0,
      totalRepasse: 0,
      totalGastos: 0,
      totalPacotes: 0,
      qtdML: 0,
      qtdShopee: 0,
      qtdAvulso: 0,
      receitaML: 0,
      receitaShopee: 0,
      receitaAvulso: 0,
      repasseML: 0,
      repasseShopee: 0,
      repasseAvulso: 0,
      metaReceitaML: 0,
      metaReceitaShopee: 0,
      metaReceitaAvulso: 0,
      impactoML: 0,
      impactoShopee: 0,
      impactoAvulso: 0,
    };

    const totais = transportadorasDoGeral.reduce(
      (acc, transportadoraOriginal) => {
        const atual = transportadoraOriginal.empresas.reduce(
          (soma: AnyDoc, item: AnyDoc) => {
            const calculado = calcularEmpresa(
              item.empresa,
              inicioGeral,
              fimGeral
            );

            soma.qtdML += inteiro(calculado.qtdML);
            soma.qtdShopee += inteiro(calculado.qtdShopee);
            soma.qtdAvulso += inteiro(calculado.qtdAvulso);
            soma.totalPacotes += inteiro(calculado.totalPacotes);
            soma.totalReceita += n(calculado.totalReceber);
            soma.totalRepasse += n(calculado.totalRepasse);
            soma.receitaML +=
              calculado.qtdML * calculado.valorML;
            soma.receitaShopee +=
              calculado.qtdShopee * calculado.valorShopee;
            soma.receitaAvulso +=
              calculado.qtdAvulso * calculado.valorAvulso;
            soma.repasseML += n(calculado.totalRepasseML);
            soma.repasseShopee += n(calculado.totalRepasseShopee);
            soma.repasseAvulso += n(calculado.totalRepasseAvulso);

            return soma;
          },
          {
            qtdML: 0,
            qtdShopee: 0,
            qtdAvulso: 0,
            totalPacotes: 0,
            totalReceita: 0,
            totalRepasse: 0,
            receitaML: 0,
            receitaShopee: 0,
            receitaAvulso: 0,
            repasseML: 0,
            repasseShopee: 0,
            repasseAvulso: 0,
          }
        );
        const transportadora = {
          ...transportadoraOriginal,
          atual,
          gastosAtual: calcularGastosTransportadora(
            transportadoraOriginal.id,
            transportadoraOriginal.nome,
            inicioGeral,
            fimGeral
          ),
        };
        const meta = metaDaTransportadora(
          transportadora.id
        );

        const qtdML = inteiro(
          transportadora.atual.qtdML
        );
        const qtdShopee = inteiro(
          transportadora.atual.qtdShopee
        );
        const qtdAvulso = inteiro(
          transportadora.atual.qtdAvulso
        );

        const receitaML = n(
          transportadora.atual.receitaML
        );
        const receitaShopee = n(
          transportadora.atual.receitaShopee
        );
        const receitaAvulso = n(
          transportadora.atual.receitaAvulso
        );

        acc.faturamentoBruto += n(
          transportadora.atual.totalReceita
        );
        acc.totalRepasse += n(
          transportadora.atual.totalRepasse
        );
        acc.totalGastos += n(
          transportadora.gastosAtual
        );
        acc.totalPacotes += inteiro(
          transportadora.atual.totalPacotes
        );

        acc.qtdML += qtdML;
        acc.qtdShopee += qtdShopee;
        acc.qtdAvulso += qtdAvulso;

        acc.receitaML += receitaML;
        acc.receitaShopee += receitaShopee;
        acc.receitaAvulso += receitaAvulso;
        acc.repasseML += n(
          transportadora.atual.repasseML
        );
        acc.repasseShopee += n(
          transportadora.atual.repasseShopee
        );
        acc.repasseAvulso += n(
          transportadora.atual.repasseAvulso
        );

        acc.metaReceitaML += meta.ml * qtdML;
        acc.metaReceitaShopee +=
          meta.shopee * qtdShopee;
        acc.metaReceitaAvulso +=
          meta.avulso * qtdAvulso;

        acc.impactoML += Math.max(
          0,
          meta.ml * qtdML - receitaML
        );
        acc.impactoShopee += Math.max(
          0,
          meta.shopee * qtdShopee - receitaShopee
        );
        acc.impactoAvulso += Math.max(
          0,
          meta.avulso * qtdAvulso - receitaAvulso
        );

        return acc;
      },
      base
    );

    const diasOperacionais = diasOperacionaisNoPeriodo(
      inicioGeral,
      fimGeral
    );
    const diasPeriodo = diasOperacionais;
    const custoTotal =
      totais.totalRepasse + totais.totalGastos;
    const resultadoLiquido =
      totais.faturamentoBruto - custoTotal;
    const contribuicaoML =
      totais.receitaML - totais.repasseML;
    const contribuicaoShopee =
      totais.receitaShopee - totais.repasseShopee;
    const contribuicaoAvulso =
      totais.receitaAvulso - totais.repasseAvulso;
    const contribuicaoTotal =
      totais.faturamentoBruto - totais.totalRepasse;
    const contribuicaoMediaRealPorPacote =
      totais.totalPacotes > 0
        ? contribuicaoTotal / totais.totalPacotes
        : 0;
    const deficitAtual = Math.max(
      0,
      -resultadoLiquido
    );
    const pacotesExtrasNecessarios =
      deficitAtual > 0 &&
      contribuicaoMediaRealPorPacote > 0
        ? Math.ceil(
            deficitAtual /
              contribuicaoMediaRealPorPacote
          )
        : 0;
    const valorMedioRealPorPacote =
      totais.totalPacotes > 0
        ? totais.faturamentoBruto / totais.totalPacotes
        : 0;
    const pacotesNecessarios =
      valorMedioRealPorPacote > 0
        ? Math.ceil(
            custoTotal / valorMedioRealPorPacote
          )
        : 0;
    const pacotesFaltantes = Math.max(
      0,
      pacotesNecessarios - totais.totalPacotes
    );
    const mediaRealPorDia =
      diasPeriodo > 0
        ? Math.round(totais.totalPacotes / diasPeriodo)
        : 0;
    const necessarioPorDia =
      diasPeriodo > 0
        ? Math.round(pacotesNecessarios / diasPeriodo)
        : 0;
    const diferencaPorDia =
      mediaRealPorDia - necessarioPorDia;
    const percentualMeta =
      pacotesNecessarios === 0
        ? 100
        : Math.min(
            100,
            (totais.totalPacotes /
              pacotesNecessarios) *
              100
          );

    const composicaoReal = {
      ml:
        totais.totalPacotes > 0
          ? (totais.qtdML / totais.totalPacotes) * 100
          : 0,
      shopee:
        totais.totalPacotes > 0
          ? (totais.qtdShopee / totais.totalPacotes) * 100
          : 0,
      avulso:
        totais.totalPacotes > 0
          ? (totais.qtdAvulso / totais.totalPacotes) * 100
          : 0,
    };

    const valorRealML =
      totais.qtdML > 0
        ? totais.receitaML / totais.qtdML
        : 0;
    const valorRealShopee =
      totais.qtdShopee > 0
        ? totais.receitaShopee / totais.qtdShopee
        : 0;
    const valorRealAvulso =
      totais.qtdAvulso > 0
        ? totais.receitaAvulso / totais.qtdAvulso
        : 0;

    const repasseRealML =
      totais.qtdML > 0
        ? totais.repasseML / totais.qtdML
        : 0;
    const repasseRealShopee =
      totais.qtdShopee > 0
        ? totais.repasseShopee / totais.qtdShopee
        : 0;
    const repasseRealAvulso =
      totais.qtdAvulso > 0
        ? totais.repasseAvulso / totais.qtdAvulso
        : 0;

    function distribuirPorComposicao(
      total: number
    ) {
      if (
        total <= 0 ||
        totais.totalPacotes <= 0
      ) {
        return {
          ml: 0,
          shopee: 0,
          avulso: 0,
        };
      }

      const quantidades = [
        totais.qtdML,
        totais.qtdShopee,
        totais.qtdAvulso,
      ];
      const partesExatas = quantidades.map(
        (quantidade) =>
          (total * quantidade) /
          totais.totalPacotes
      );
      const partes = partesExatas.map(
        (parte) => Math.floor(parte)
      );
      let restante =
        total -
        partes.reduce(
          (soma, parte) => soma + parte,
          0
        );

      const ordemDosRestos = partesExatas
        .map((parte, indice) => ({
          indice,
          resto: parte - Math.floor(parte),
        }))
        .sort((a, b) => b.resto - a.resto);

      let indice = 0;
      while (
        restante > 0 &&
        ordemDosRestos.length > 0
      ) {
        partes[
          ordemDosRestos[
            indice % ordemDosRestos.length
          ].indice
        ] += 1;
        restante -= 1;
        indice += 1;
      }

      return {
        ml: partes[0],
        shopee: partes[1],
        avulso: partes[2],
      };
    }

    function montarModelo(
      titulo: string,
      totalPacotesModelo: number
    ) {
      const quantidades =
        distribuirPorComposicao(
          totalPacotesModelo
        );
      const faturamentoProjetado =
        quantidades.ml * valorRealML +
        quantidades.shopee * valorRealShopee +
        quantidades.avulso * valorRealAvulso;
      const repasseProjetado =
        quantidades.ml * repasseRealML +
        quantidades.shopee * repasseRealShopee +
        quantidades.avulso * repasseRealAvulso;
      const contribuicaoProjetada =
        faturamentoProjetado -
        repasseProjetado;
      const mediaPorDiaOperacional =
        diasPeriodo > 0
          ? Math.round(totalPacotesModelo / diasPeriodo)
          : 0;
      const distribuicaoInteira = distribuirInteiroPorDias(
        totalPacotesModelo,
        inicioGeral,
        fimGeral
      );
      const distribuicaoML = distribuirInteiroPorDias(
        quantidades.ml,
        inicioGeral,
        fimGeral
      );
      const distribuicaoShopee = distribuirInteiroPorDias(
        quantidades.shopee,
        inicioGeral,
        fimGeral
      );
      const distribuicaoAvulso = distribuirInteiroPorDias(
        quantidades.avulso,
        inicioGeral,
        fimGeral
      );
      const distribuicaoColeta = {
        segunda: distribuicaoInteira.segunda,
        terca: distribuicaoInteira.terca,
        quarta: distribuicaoInteira.quarta,
        quinta: distribuicaoInteira.quinta,
        sexta: distribuicaoInteira.sexta,
        sabado: distribuicaoInteira.sabado,
        domingo: 0,
      };
      const distribuicaoTiposPorDia = {
        ml: {
          semana: distribuicaoML.segunda,
          sabado: distribuicaoML.sabado,
        },
        shopee: {
          semana: distribuicaoShopee.segunda,
          sabado: distribuicaoShopee.sabado,
        },
        avulso: {
          semana: distribuicaoAvulso.segunda,
          sabado: distribuicaoAvulso.sabado,
        },
      };

      return {
        titulo,
        totalPacotes: totalPacotesModelo,
        ...quantidades,
        faturamentoProjetado,
        repasseProjetado,
        contribuicaoProjetada,
        diasOperacionais: diasOperacionais,
        mediaPorDiaOperacional,
        distribuicaoColeta,
        distribuicaoTiposPorDia,
        totalDistribuido: distribuicaoInteira.total,
        resultadoProjetado:
          resultadoLiquido +
          contribuicaoProjetada,
      };
    }

    // A margem dos modelos 2 e 3 acompanha o volume real da operação:
    // cada modelo acrescenta 25% do volume atual ao modelo anterior.
    const incrementoMargem =
      totais.totalPacotes > 0
        ? Math.max(
            1,
            Math.ceil(totais.totalPacotes * 0.25)
          )
        : 0;
    const volumeModelo1 =
      pacotesExtrasNecessarios;
    const volumeModelo2 =
      volumeModelo1 + incrementoMargem;
    const volumeModelo3 =
      volumeModelo2 + incrementoMargem;

    const modelosCrescimento = [
      montarModelo(
        "MODELO 1 — META MÍNIMA",
        volumeModelo1
      ),
      montarModelo(
        "MODELO 2 — META OPERACIONAL",
        volumeModelo2
      ),
      montarModelo(
        "MODELO 3 — META DE CRESCIMENTO",
        volumeModelo3
      ),
    ];

    function montarTipo(
      rotulo: string,
      quantidade: number,
      receita: number,
      metaReceita: number,
      impacto: number
    ) {
      const valorAtual =
        quantidade > 0 ? receita / quantidade : 0;
      const valorMeta =
        quantidade > 0
          ? metaReceita / quantidade
          : 0;
      const diferenca = Math.max(
        0,
        valorMeta - valorAtual
      );

      return {
        rotulo,
        quantidade,
        receita,
        valorAtual,
        valorMeta,
        diferenca,
        impacto,
        metaDefinida: valorMeta > 0,
        metaAtingida:
          valorMeta > 0 && valorAtual >= valorMeta,
      };
    }

    const tipos = [
      montarTipo(
        "MERCADO LIVRE",
        totais.qtdML,
        totais.receitaML,
        totais.metaReceitaML,
        totais.impactoML
      ),
      montarTipo(
        "SHOPEE",
        totais.qtdShopee,
        totais.receitaShopee,
        totais.metaReceitaShopee,
        totais.impactoShopee
      ),
      montarTipo(
        "AVULSO",
        totais.qtdAvulso,
        totais.receitaAvulso,
        totais.metaReceitaAvulso,
        totais.impactoAvulso
      ),
    ];

    return {
      ...totais,
      tipos,
      impactoTotal:
        totais.impactoML +
        totais.impactoShopee +
        totais.impactoAvulso,
      diasPeriodo,
      diasOperacionais,
      custoTotal,
      resultadoLiquido,
      contribuicaoML,
      contribuicaoShopee,
      contribuicaoAvulso,
      contribuicaoTotal,
      contribuicaoMediaRealPorPacote,
      deficitAtual,
      pacotesExtrasNecessarios,
      pacotesNecessariosParaMeta:
        totais.totalPacotes +
        pacotesExtrasNecessarios,
      composicaoReal,
      modelosCrescimento,
      valorMedioRealPorPacote,
      faturamentoNecessario: custoTotal,
      faltaParaEquilibrio: Math.max(
        0,
        custoTotal - totais.faturamentoBruto
      ),
      margemAcimaEquilibrio: resultadoLiquido,
      pacotesNecessarios,
      pacotesFaltantes,
      mediaRealPorDia,
      necessarioPorDia,
      diferencaPorDia,
      percentualMeta,
      metaAtingida:
        totais.faturamentoBruto >= custoTotal,
    };
  }, [
    transportadorasDoGeral,
    metasPacote,
    inicioGeral,
    fimGeral,
    pacotes,
    coletas,
    users,
    configGanhos,
    ganhos,
    gastos,
  ]);

  const fechamentoMensal = useMemo(() => {
    const mes = intervaloMesFinanceiro(inicioGeral);
    const mesmoDia = (a: Date, b: Date) =>
      diaInicio(a).getTime() === diaInicio(b).getTime();

    if (
      !mesmoDia(inicioGeral, mes.inicio) ||
      !mesmoDia(fimGeral, mes.fim)
    ) {
      return null;
    }

    function montarFechamento(inicio: Date, fim: Date) {
      const fechamento = {
        faturamentoBruto: 0,
        totalRepasse: 0,
        totalGastos: 0,
        totalPacotes: 0,
        qtdML: 0,
        qtdShopee: 0,
        qtdAvulso: 0,
        receitaML: 0,
        receitaShopee: 0,
        receitaAvulso: 0,
        repasseML: 0,
        repasseShopee: 0,
        repasseAvulso: 0,
      };

      transportadorasDoGeral.forEach((transportadora) => {
        transportadora.empresas.forEach((item: AnyDoc) => {
          const calculado = calcularEmpresa(
            item.empresa,
            inicio,
            fim
          );

          fechamento.qtdML += inteiro(calculado.qtdML);
          fechamento.qtdShopee += inteiro(calculado.qtdShopee);
          fechamento.qtdAvulso += inteiro(calculado.qtdAvulso);
          fechamento.totalPacotes += inteiro(
            calculado.totalPacotes
          );
          fechamento.receitaML +=
            calculado.qtdML * calculado.valorML;
          fechamento.receitaShopee +=
            calculado.qtdShopee * calculado.valorShopee;
          fechamento.receitaAvulso +=
            calculado.qtdAvulso * calculado.valorAvulso;
          fechamento.repasseML += n(
            calculado.totalRepasseML
          );
          fechamento.repasseShopee += n(
            calculado.totalRepasseShopee
          );
          fechamento.repasseAvulso += n(
            calculado.totalRepasseAvulso
          );
          fechamento.faturamentoBruto += n(
            calculado.totalReceber
          );
          fechamento.totalRepasse += n(
            calculado.totalRepasse
          );
        });

        fechamento.totalGastos +=
          calcularGastosTransportadora(
            transportadora.id,
            transportadora.nome,
            inicio,
            fim
          );
      });

      return {
        ...fechamento,
        resultadoLiquido:
          fechamento.faturamentoBruto -
          fechamento.totalRepasse -
          fechamento.totalGastos,
      };
    }

    const primeira = primeiraQuinzenaFinanceira(
      inicioGeral
    );
    const segunda = segundaQuinzenaFinanceira(
      inicioGeral
    );

    return {
      periodo: mes,
      primeira: {
        periodo: primeira,
        valores: montarFechamento(
          primeira.inicio,
          primeira.fim
        ),
      },
      segunda: {
        periodo: segunda,
        valores: montarFechamento(
          segunda.inicio,
          segunda.fim
        ),
      },
      total: {
        periodo: mes,
        valores: montarFechamento(
          mes.inicio,
          mes.fim
        ),
      },
    };
  }, [
    transportadorasDoGeral,
    inicioGeral,
    fimGeral,
    pacotes,
    coletas,
    users,
    configGanhos,
    ganhos,
    gastos,
  ]);

  const transportadoraDoGeral =
    filtroTransportadoraGeral === "TODAS"
      ? null
      : transportadorasDoGeral[0] || null;


  const transportadoraParaGasto = transportadoraDoGeral;

  function carregarFormMeta(transportadoraId: string) {
    if (transportadoraId === "TODAS") {
      setFormMeta({
        ml: "",
        shopee: "",
        avulso: "",
      });
      return;
    }

    const meta = metaDaTransportadora(transportadoraId);

    setFormMeta({
      ml: meta.ml ? String(meta.ml) : "",
      shopee: meta.shopee ? String(meta.shopee) : "",
      avulso: meta.avulso ? String(meta.avulso) : "",
    });
  }

  function aplicarPeriodoGeral(
    periodo: { inicio: Date; fim: Date }
  ) {
    setDataInicioGeral(dataParaInput(periodo.inicio));
    setDataFimGeral(dataParaInput(periodo.fim));
  }

  function referenciaPeriodoGeral() {
    return (
      dataDoInput(dataInicioGeral) ||
      new Date()
    );
  }

  function aplicarMesFinanceiroGeral() {
    aplicarPeriodoGeral(
      intervaloMesFinanceiro(
        referenciaPeriodoGeral()
      )
    );
  }

  function aplicarPrimeiraQuinzenaGeral() {
    aplicarPeriodoGeral(
      primeiraQuinzenaFinanceira(
        referenciaPeriodoGeral()
      )
    );
  }

  function aplicarSegundaQuinzenaGeral() {
    aplicarPeriodoGeral(
      segundaQuinzenaFinanceira(
        referenciaPeriodoGeral()
      )
    );
  }

  async function salvarMeta() {
    if (!transportadoraDoGeral) {
      alert(
        "Selecione uma transportadora para cadastrar os valores por pacote."
      );
      return;
    }

    setSalvandoMeta(true);

    try {
      const dados = {
        transportadoraId: transportadoraDoGeral.id,
        transportadoraNome: transportadoraDoGeral.nome,
        ml: n(formMeta.ml),
        shopee: n(formMeta.shopee),
        avulso: n(formMeta.avulso),
        atualizadoEm: serverTimestamp(),
        atualizadoPor: auth.currentUser?.uid || "",
      };

      const existente = metasPacote.find(
        (item) =>
          normalizar(item.transportadoraId) ===
          normalizar(transportadoraDoGeral.id)
      );

      if (existente) {
        await updateDoc(
          doc(db, "metas_valor_pacote", existente.id),
          dados
        );
      } else {
        await addDoc(
          collection(db, "metas_valor_pacote"),
          {
            ...dados,
            criadoEm: serverTimestamp(),
          }
        );
      }

      await load();
    } catch (error) {
      console.error(error);
      alert(
        "Não foi possível salvar os valores por pacote."
      );
    } finally {
      setSalvandoMeta(false);
    }
  }

  const empresasDaTransportadora = useMemo(() => {
    if (!transportadoraDoGeral) return [];

    return transportadoraDoGeral.empresas.map(
      (item: AnyDoc) => item.empresa
    );
  }, [transportadoraDoGeral]);

  function abrirNovoGasto() {
    setGastoAberto(null);
    setFormGasto({
      nome: "",
      icone: "💰",
      cor: GOLD,
      valor: "",
      frequencia: "FIXO",
      empresaId: "TODAS",
      observacoes: "",
      ativo: true,
    });
    setModalGasto(true);
  }

  function editarGasto(gasto: Gasto) {
    setGastoAberto(gasto);
    setFormGasto({
      nome: gasto.nome || "",
      icone: gasto.icone || "💰",
      cor: gasto.cor || GOLD,
      valor: String(gasto.valor ?? ""),
      frequencia: gasto.frequencia || "FIXO",
      empresaId: gasto.empresaId || "TODAS",
      observacoes: gasto.observacoes || "",
      ativo: gasto.ativo !== false,
    });
    setModalGasto(true);
  }

  async function salvarGasto() {
    if (!transportadoraParaGasto) return;

    const nome = formGasto.nome.trim();
    const valor = n(formGasto.valor);

    if (!nome) {
      alert("Informe o nome do gasto.");
      return;
    }

    if (valor <= 0) {
      alert("Informe um valor maior que zero.");
      return;
    }

    setSalvandoGasto(true);

    try {
      const empresaSelecionadaGasto =
        transportadoraParaGasto.empresas
          .map((item: AnyDoc) => item.empresa || item)
          .find(
            (empresa: AnyDoc) =>
              empresa.id === formGasto.empresaId
          );

      const dados = {
        nome,
        icone: formGasto.icone.trim() || "💰",
        cor: formGasto.cor || GOLD,
        valor,
        frequencia: formGasto.frequencia,
        // Estes dois campos garantem que o gasto fique separado
        // mesmo quando duas transportadoras possuem empresas com
        // nomes parecidos.
        transportadoraId: transportadoraParaGasto.id,
        transportadoraNome: transportadoraParaGasto.nome,
        empresaId:
          formGasto.empresaId === "TODAS"
            ? "TODAS"
            : formGasto.empresaId,
        empresaNome:
          formGasto.empresaId === "TODAS"
            ? "Todas as empresas"
            : empresaSelecionadaGasto?.nome ||
              empresaSelecionadaGasto?.razaoSocial ||
              formGasto.empresaId,
        observacoes: formGasto.observacoes.trim(),
        ativo: formGasto.ativo,
        atualizadoEm: serverTimestamp(),
        atualizadoPor: auth.currentUser?.uid || "",
      };

      if (gastoAberto) {
        await updateDoc(
          doc(db, "gastos_financeiros", gastoAberto.id),
          dados
        );
      } else {
        await addDoc(
          collection(db, "gastos_financeiros"),
          {
            ...dados,
            criadoEm: serverTimestamp(),
            criadoPor: auth.currentUser?.uid || "",
          }
        );
      }

      setModalGasto(false);
      setGastoAberto(null);
      await load();
    } catch (error) {
      console.error(error);
      alert("Não foi possível salvar o gasto.");
    } finally {
      setSalvandoGasto(false);
    }
  }

  async function removerGasto(gasto: Gasto) {
    const confirmar = window.confirm(
      `Excluir o gasto "${gasto.nome}"?`
    );

    if (!confirmar) return;

    try {
      await deleteDoc(
        doc(db, "gastos_financeiros", gasto.id)
      );
      await load();
    } catch (error) {
      console.error(error);
      alert("Não foi possível excluir o gasto.");
    }
  }

  if (checkingAccess) {
    return (
      <div className="card" style={{ padding: 24 }}>
        Verificando permissão...
      </div>
    );
  }

  if (!allowed) {
    return (
      <div className="card" style={{ padding: 24 }}>
        Acesso restrito ao administrador.
      </div>
    );
  }

  return (
    <div style={{ padding: 18 }}>
      {erro && (
        <div className="card" style={{ padding: 12, marginBottom: 12, color: "#dc2626" }}>
          {erro}
        </div>
      )}
      {loading && (
        <div className="card" style={{ padding: 12, marginBottom: 12 }}>
          Carregando dados...
        </div>
      )}


      <div
        style={{
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "space-between",
          gap: 14,
          marginBottom: 18,
        }}
      >
        <div>
          <h2 style={{ margin: 0, display: "flex", alignItems: "center", gap: 8 }}>
            <WalletCards color={GOLD} />
            Financeiro geral
          </h2>
          <p style={{ margin: "6px 0 0", color: "#64748b" }}>
            {transportadoraDoGeral
              ? transportadoraDoGeral.nome
              : "Todas as transportadoras"}{" "}
            • Período selecionado •{" "}
            {inicioGeral.toLocaleDateString("pt-BR")} até{" "}
            {fimGeral.toLocaleDateString("pt-BR")}
          </p>
        </div>
      </div>

            <div
              style={{
                display: "grid",
                gridTemplateColumns:
                  "repeat(auto-fit,minmax(min(100%,240px),1fr))",
                gap: 10,
                marginBottom: 16,
                minWidth: 0,
              }}
            >
              <label style={{ minWidth: 0 }}>
                <span className="field-label">
                  TRANSPORTADORA
                </span>
                <select
                  value={filtroTransportadoraGeral}
                  onChange={(event) => {
                    const valor = event.target.value;
                    setFiltroTransportadoraGeral(valor);
                    carregarFormMeta(valor);
                  }}
                  style={campoStyle}
                >
                  <option value="TODAS">TODAS</option>
                  {transportadorasResumo.map(
                    (transportadora) => (
                      <option
                        key={transportadora.id}
                        value={transportadora.id}
                      >
                        {transportadora.nome}
                      </option>
                    )
                  )}
                </select>
              </label>
            </div>

            <div
              style={{
                border: "1px solid #e5e7eb",
                borderRadius: 12,
                padding: 14,
                marginBottom: 16,
                background: "#f8fafc",
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: 10,
                  flexWrap: "wrap",
                  marginBottom: 10,
                }}
              >
                <div>
                  <strong>PERÍODO DO FINANCEIRO GERAL</strong>
                  <small
                    style={{
                      display: "block",
                      color: "#64748b",
                      marginTop: 3,
                    }}
                  >
                    Selecione uma faixa única. O padrão é o mês financeiro
                    vigente, do dia 16 ao dia 15.
                  </small>
                </div>
                <small
                  style={{
                    color: "#92400e",
                    fontWeight: 800,
                  }}
                >
                  {inicioGeral.toLocaleDateString("pt-BR")} →{" "}
                  {fimGeral.toLocaleDateString("pt-BR")}
                </small>
              </div>

              <div
                style={{
                  display: "flex",
                  gap: 8,
                  flexWrap: "wrap",
                  marginBottom: 10,
                }}
              >
                <button
                  type="button"
                  className="secondary"
                  onClick={aplicarMesFinanceiroGeral}
                >
                  MÊS FINANCEIRO
                </button>
                <button
                  type="button"
                  className="secondary"
                  onClick={aplicarPrimeiraQuinzenaGeral}
                >
                  1ª QUINZENA
                </button>
                <button
                  type="button"
                  className="secondary"
                  onClick={aplicarSegundaQuinzenaGeral}
                >
                  2ª QUINZENA
                </button>
              </div>

              <div
                style={{
                  display: "grid",
                  gridTemplateColumns:
                    "repeat(auto-fit,minmax(min(220px,100%),1fr))",
                  gap: 10,
                }}
              >
                <label style={{ minWidth: 0 }}>
                  <span className="field-label">DATA INICIAL</span>
                  <input
                    type="date"
                    value={dataInicioGeral}
                    onChange={(event) => {
                      setDataInicioGeral(event.target.value);
                    }}
                    style={campoStyle}
                  />
                </label>
                <label style={{ minWidth: 0 }}>
                  <span className="field-label">DATA FINAL</span>
                  <input
                    type="date"
                    value={dataFimGeral}
                    min={dataInicioGeral || undefined}
                    onChange={(event) => {
                      setDataFimGeral(event.target.value);
                    }}
                    style={campoStyle}
                  />
                </label>
              </div>
            </div>

            <div
              style={{
                display: "flex",
                gap: 8,
                flexWrap: "wrap",
                marginBottom: 18,
                minWidth: 0,
              }}
            >
              <button
                type="button"
                className={
                  modoGeral === "RESUMO"
                    ? "primary"
                    : "secondary"
                }
                onClick={() => setModoGeral("RESUMO")}
              >
                RESUMO
              </button>
              <button
                type="button"
                className={
                  modoGeral === "VALORES"
                    ? "primary"
                    : "secondary"
                }
                onClick={() => setModoGeral("VALORES")}
              >
                VALORES POR PACOTE
              </button>
            </div>

            {modoGeral === "RESUMO" && (
              <>
            <div
              style={{
                display: "grid",
                gridTemplateColumns:
                  "repeat(auto-fit,minmax(min(220px,100%),1fr))",
                gap: 10,
                marginBottom: 20,
              }}
            >
              <InfoCard
                titulo="FATURAMENTO BRUTO"
                valor={br(financeiroGeral.faturamentoBruto)}
              />
              <InfoCard
                titulo="TOTAL DE REPASSES"
                valor={br(financeiroGeral.totalRepasse)}
              />
              <InfoCard
                titulo="TOTAL DE GASTOS"
                valor={br(financeiroGeral.totalGastos)}
              />
              <InfoCard
                titulo="RESULTADO LÍQUIDO"
                valor={
                  <span
                    style={{
                      color:
                        financeiroGeral.resultadoLiquido >= 0
                          ? "#15803d"
                          : "#dc2626",
                    }}
                  >
                    {br(financeiroGeral.resultadoLiquido)}
                  </span>
                }
              />
              <InfoCard
                titulo="TOTAL DE PACOTES"
                valor={String(financeiroGeral.totalPacotes)}
              />
              <InfoCard
                titulo="VALOR MÉDIO REAL POR PACOTE"
                valor={br(financeiroGeral.valorMedioRealPorPacote)}
              />
            </div>

            {fechamentoMensal && (
              <>
                <TituloSecao>
                  FECHAMENTO DO MÊS FINANCEIRO
                </TituloSecao>
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns:
                      "repeat(auto-fit,minmax(min(260px,100%),1fr))",
                    gap: 12,
                    marginBottom: 20,
                  }}
                >
                  {[
                    {
                      titulo: "FECHAMENTO 1",
                      fechamento: fechamentoMensal.primeira,
                    },
                    {
                      titulo: "FECHAMENTO 2",
                      fechamento: fechamentoMensal.segunda,
                    },
                    {
                      titulo: "TOTAL DO MÊS",
                      fechamento: fechamentoMensal.total,
                    },
                  ].map(({ titulo, fechamento }) => (
                    <div
                      key={titulo}
                      style={{
                        border: "1px solid #e5e7eb",
                        borderRadius: 12,
                        padding: 14,
                        background:
                          titulo === "TOTAL DO MÊS"
                            ? "#fffbeb"
                            : "#fff",
                      }}
                    >
                      <strong
                        style={{
                          display: "block",
                          color: "#92400e",
                          marginBottom: 4,
                        }}
                      >
                        {titulo}
                      </strong>
                      <small
                        style={{
                          display: "block",
                          color: "#64748b",
                          marginBottom: 8,
                        }}
                      >
                        {fechamento.periodo.inicio.toLocaleDateString(
                          "pt-BR"
                        )}{" "}
                        →{" "}
                        {fechamento.periodo.fim.toLocaleDateString(
                          "pt-BR"
                        )}
                      </small>
                      <Linha
                        label="Pacotes"
                        valor={String(
                          fechamento.valores.totalPacotes
                        )}
                      />
                      <Linha
                        label="ML"
                        valor={String(fechamento.valores.qtdML)}
                      />
                      <Linha
                        label="Shopee"
                        valor={String(fechamento.valores.qtdShopee)}
                      />
                      <Linha
                        label="Avulso"
                        valor={String(fechamento.valores.qtdAvulso)}
                      />
                      <Linha
                        label="Faturamento"
                        valor={br(
                          fechamento.valores.faturamentoBruto
                        )}
                      />
                      <Linha
                        label="Repasses"
                        valor={br(
                          fechamento.valores.totalRepasse
                        )}
                      />
                      <Linha
                        label="Gastos"
                        valor={br(
                          fechamento.valores.totalGastos
                        )}
                      />
                      <Linha
                        label="Resultado"
                        valor={br(
                          fechamento.valores.resultadoLiquido
                        )}
                      />
                    </div>
                  ))}
                </div>
              </>
            )}

            <TituloSecao>
              META PARA NÃO FICAR NO VERMELHO
            </TituloSecao>

            <div
              style={{
                display: "grid",
                gridTemplateColumns:
                  "repeat(auto-fit,minmax(min(220px,100%),1fr))",
                gap: 10,
                marginBottom: 18,
              }}
            >
              <InfoCard
                titulo="FATURAMENTO NECESSÁRIO"
                valor={br(financeiroGeral.faturamentoNecessario)}
              />
              <InfoCard
                titulo="FATURAMENTO ATUAL"
                valor={br(financeiroGeral.faturamentoBruto)}
              />
              <InfoCard
                titulo="FALTA PARA O EQUILÍBRIO"
                valor={
                  <span
                    style={{
                      color: financeiroGeral.metaAtingida
                        ? "#15803d"
                        : "#b45309",
                    }}
                  >
                    {br(financeiroGeral.faltaParaEquilibrio)}
                  </span>
                }
              />
              <InfoCard
                titulo="MARGEM ACIMA DO EQUILÍBRIO"
                valor={
                  <span
                    style={{
                      color:
                        financeiroGeral.margemAcimaEquilibrio >= 0
                          ? "#15803d"
                          : "#dc2626",
                    }}
                  >
                    {br(financeiroGeral.margemAcimaEquilibrio)}
                  </span>
                }
              />
            </div>

            <div
              style={{
                padding: 14,
                borderRadius: 12,
                marginBottom: 18,
                background: financeiroGeral.metaAtingida
                  ? "#f0fdf4"
                  : "#fff7ed",
                border: `1px solid ${
                  financeiroGeral.metaAtingida
                    ? "#bbf7d0"
                    : "#fed7aa"
                }`,
                color: financeiroGeral.metaAtingida
                  ? "#166534"
                  : "#9a3412",
                fontWeight: 800,
              }}
            >
              {financeiroGeral.metaAtingida
                ? "Meta de equilíbrio atingida."
                : "Meta de equilíbrio ainda não atingida."}
            </div>

            <TituloSecao>
              CRESCIMENTO POR NOVOS CLIENTES
            </TituloSecao>

            <div
              style={{
                border: "1px solid #e5e7eb",
                borderRadius: 12,
                padding: 14,
                marginBottom: 18,
                background: "#fff",
              }}
            >
              <p
                style={{
                  margin: "0 0 14px",
                  color: "#64748b",
                  fontSize: 13,
                  lineHeight: 1.5,
                }}
              >
                Estimativa baseada na mistura real de Mercado Livre,
                Shopee e Avulso deste período. Os cenários aumentam o
                volume de pacotes, sem alterar os valores cobrados.
              </p>

               <div
                 style={{
                   display: "grid",
                   gridTemplateColumns:
                     "repeat(auto-fit,minmax(min(190px,100%),1fr))",
                   gap: 10,
                   marginBottom: 14,
                 }}
               >
                 <InfoCard
                   titulo="PACOTES ATUAIS"
                   valor={String(financeiroGeral.totalPacotes)}
                 />
                 <InfoCard
                   titulo="PACOTES NECESSÁRIOS PARA A META"
                   valor={String(
                     financeiroGeral.pacotesNecessariosParaMeta
                   )}
                 />
                 <InfoCard
                   titulo="PACOTES EXTRAS NECESSÁRIOS"
                   valor={
                     financeiroGeral.pacotesExtrasNecessarios > 0
                       ? String(financeiroGeral.pacotesExtrasNecessarios)
                       : "0"
                   }
                 />
                 <InfoCard
                   titulo="CONTRIBUIÇÃO MÉDIA/PACOTE"
                   valor={br(
                     financeiroGeral.contribuicaoMediaRealPorPacote
                   )}
                 />
                 <InfoCard
                   titulo="DÉFICIT ATUAL"
                   valor={br(financeiroGeral.deficitAtual)}
                 />
               </div>

               <TituloSecao>
                 COMPOSIÇÃO REAL DA OPERAÇÃO
               </TituloSecao>

               <div
                 style={{
                   display: "grid",
                   gridTemplateColumns:
                     "repeat(auto-fit,minmax(min(190px,100%),1fr))",
                   gap: 10,
                   marginBottom: 14,
                 }}
               >
                 <InfoCard
                   titulo="MERCADO LIVRE"
                   valor={`${financeiroGeral.composicaoReal.ml.toLocaleString(
                     "pt-BR",
                     {
                       minimumFractionDigits: 1,
                       maximumFractionDigits: 1,
                     }
                   )}% • ${financeiroGeral.qtdML} pacote(s)`}
                 />
                 <InfoCard
                   titulo="SHOPEE"
                   valor={`${financeiroGeral.composicaoReal.shopee.toLocaleString(
                     "pt-BR",
                     {
                       minimumFractionDigits: 1,
                       maximumFractionDigits: 1,
                     }
                   )}% • ${financeiroGeral.qtdShopee} pacote(s)`}
                 />
                 <InfoCard
                   titulo="AVULSO"
                   valor={`${financeiroGeral.composicaoReal.avulso.toLocaleString(
                     "pt-BR",
                     {
                       minimumFractionDigits: 1,
                       maximumFractionDigits: 1,
                     }
                   )}% • ${financeiroGeral.qtdAvulso} pacote(s)`}
                 />
               </div>

              <div
                style={{
                  padding: 13,
                  borderRadius: 10,
                  marginBottom: 14,
                  background:
                    financeiroGeral.deficitAtual > 0
                      ? "#fff7ed"
                      : "#f0fdf4",
                  border: `1px solid ${
                    financeiroGeral.deficitAtual > 0
                      ? "#fed7aa"
                      : "#bbf7d0"
                  }`,
                  color:
                    financeiroGeral.deficitAtual > 0
                      ? "#9a3412"
                      : "#166534",
                  fontWeight: 800,
                }}
              >
                {financeiroGeral.deficitAtual > 0
                  ? financeiroGeral.contribuicaoMediaRealPorPacote > 0
                    ? `Déficit de ${br(
                        financeiroGeral.deficitAtual
                      )}. São necessários ${String(
                        financeiroGeral.pacotesExtrasNecessarios
                      )} pacote(s) extra(s) no período.`
                    : "A contribuição média real por pacote não é positiva para cobrir o déficit."
                  : "NÃO HÁ DÉFICIT PARA COBRIR"}
              </div>

               <div
                 style={{
                   display: "grid",
                   gridTemplateColumns:
                     "repeat(auto-fit,minmax(min(245px,100%),1fr))",
                   gap: 12,
                 }}
               >
                 {financeiroGeral.modelosCrescimento.map(
                   (modelo) => (
                     <div
                       key={modelo.titulo}
                       style={{
                         border: "1px solid #e5e7eb",
                         borderRadius: 11,
                         padding: 14,
                         minWidth: 0,
                         background: "#f8fafc",
                       }}
                     >
                       <strong
                         style={{
                           display: "block",
                           color: "#92400e",
                           fontSize: 14,
                           marginBottom: 8,
                         }}
                       >
                         {modelo.titulo}
                       </strong>

                       <Linha
                         label="Mercado Livre"
                         valor={String(modelo.ml)}
                       />
                       <Linha
                         label="Shopee"
                         valor={String(modelo.shopee)}
                       />
                       <Linha
                         label="Avulso"
                         valor={String(modelo.avulso)}
                       />
                       <Linha
                         label="TOTAL"
                         valor={`${modelo.totalPacotes} pacote(s)`}
                       />
                       <Linha
                         label="Dias operacionais equivalentes"
                         valor={inteiroBR(modelo.diasOperacionais)}
                       />
                       <Linha
                         label="Segunda (100%)"
                         valor={`${inteiroBR(modelo.distribuicaoColeta.segunda)} pacote(s)/dia`}
                       />
                       <Linha
                         label="Terça (100%)"
                         valor={`${inteiroBR(modelo.distribuicaoColeta.terca)} pacote(s)/dia`}
                       />
                       <Linha
                         label="Quarta (100%)"
                         valor={`${inteiroBR(modelo.distribuicaoColeta.quarta)} pacote(s)/dia`}
                       />
                       <Linha
                         label="Quinta (100%)"
                         valor={`${inteiroBR(modelo.distribuicaoColeta.quinta)} pacote(s)/dia`}
                       />
                       <Linha
                         label="Sexta (100%)"
                         valor={`${inteiroBR(modelo.distribuicaoColeta.sexta)} pacote(s)/dia`}
                       />
                       <Linha
                         label="Sábado (50%)"
                         valor={`${inteiroBR(modelo.distribuicaoColeta.sabado)} pacote(s)`}
                       />
                       <Linha
                         label="Domingo (0%)"
                         valor="0 pacote(s)"
                       />
                       <Linha
                         label="Média necessária"
                         valor={`${inteiroBR(modelo.mediaPorDiaOperacional)} pacote(s)/dia operacional`}
                       />
                       <div
                         style={{
                           marginTop: 10,
                           padding: 10,
                           borderRadius: 9,
                           background: "#fff",
                           border: "1px solid #e5e7eb",
                         }}
                       >
                         <small
                           style={{
                             display: "block",
                             color: "#64748b",
                             fontWeight: 800,
                             marginBottom: 6,
                           }}
                         >
                           DISTRIBUIÇÃO MÉDIA POR DIA OPERACIONAL
                         </small>
                         <div
                           style={{
                             display: "grid",
                             gap: 4,
                             color: "#475569",
                             fontSize: 12,
                           }}
                         >
                           <span>
                             ML:{" "}
                             {inteiroBR(modelo.distribuicaoTiposPorDia.ml.semana)}{" "}
                             útil /{" "}
                             {inteiroBR(modelo.distribuicaoTiposPorDia.ml.sabado)}{" "}
                             sábado
                           </span>
                           <span>
                             Shopee:{" "}
                             {inteiroBR(modelo.distribuicaoTiposPorDia.shopee.semana)}{" "}
                             útil /{" "}
                             {inteiroBR(modelo.distribuicaoTiposPorDia.shopee.sabado)}{" "}
                             sábado
                           </span>
                           <span>
                             Avulso:{" "}
                             {inteiroBR(modelo.distribuicaoTiposPorDia.avulso.semana)}{" "}
                             útil /{" "}
                             {inteiroBR(modelo.distribuicaoTiposPorDia.avulso.sabado)}{" "}
                             sábado
                           </span>
                         </div>
                       </div>
                       <Linha
                         label="Faturamento projetado"
                         valor={br(modelo.faturamentoProjetado)}
                       />
                       <Linha
                         label="Repasse projetado"
                         valor={br(modelo.repasseProjetado)}
                       />
                       <Linha
                         label="Contribuição projetada"
                         valor={br(modelo.contribuicaoProjetada)}
                       />
                       <Linha
                         label="Resultado projetado"
                         valor={br(modelo.resultadoProjetado)}
                       />
                     </div>
                   )
                 )}
               </div>

              <small
                style={{
                  display: "block",
                  color: "#64748b",
                  marginTop: 12,
                }}
              >
                 Período considerado:{" "}
                 {inteiroBR(financeiroGeral.diasOperacionais)}{" "}
                 dia(s) operacionais equivalentes. Segunda a sexta vale
                 100%, sábado 50% e domingo 0%. Os modelos usam a composição
                 real do período e os valores médios atuais por tipo, sem
                 alterar preços ou regras de repasse. O Modelo 2 e o Modelo 3
                 acrescentam, cada um, 25% do volume atual ao modelo anterior.
              </small>
            </div>

            <TituloSecao>
              PACOTES/DIA
            </TituloSecao>

            <div
              style={{
                display: "grid",
                gridTemplateColumns:
                  "repeat(auto-fit,minmax(min(190px,100%),1fr))",
                gap: 10,
                marginBottom: 18,
              }}
            >
              <InfoCard
                titulo="MÉDIA REAL"
                valor={`${inteiroBR(financeiroGeral.mediaRealPorDia)} pacotes/dia`}
              />
              <InfoCard
                titulo="NECESSÁRIO"
                valor={`${inteiroBR(financeiroGeral.necessarioPorDia)} pacotes/dia`}
              />
              <InfoCard
                titulo="DIFERENÇA"
                valor={
                  <span
                    style={{
                      color:
                        financeiroGeral.diferencaPorDia >= 0
                          ? "#15803d"
                          : "#dc2626",
                    }}
                  >
                    {inteiroBR(financeiroGeral.diferencaPorDia)}{" "}
                    pacotes/dia
                  </span>
                }
              />
              <InfoCard
                titulo="PACOTES NECESSÁRIOS"
                valor={String(financeiroGeral.pacotesNecessarios)}
              />
              <InfoCard
                titulo="PACOTES FALTANTES"
                valor={String(financeiroGeral.pacotesFaltantes)}
              />
              <InfoCard
                titulo="META ATINGIDA"
                valor={`${financeiroGeral.percentualMeta.toLocaleString(
                  "pt-BR",
                  {
                    minimumFractionDigits: 0,
                    maximumFractionDigits: 1,
                  }
                )}%`}
              />
            </div>

            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 12,
                flexWrap: "wrap",
                borderBottom: "1px solid #e5e7eb",
                paddingBottom: 12,
                marginBottom: 14,
              }}
            >
              <div>
                <h3 style={{ margin: 0 }}>
                  Registros de gastos
                </h3>
                <small style={{ color: "#64748b" }}>
                  {transportadoraDoGeral
                    ? `Gastos de ${transportadoraDoGeral.nome} no período.`
                    : "Gastos somados de todas as transportadoras."}
                </small>
              </div>

              <button
                type="button"
                className="primary"
                disabled={!transportadoraParaGasto}
                onClick={abrirNovoGasto}
              >
                <Plus size={17} />
                Cadastrar gasto
              </button>
            </div>

            <div
              style={{
                display: "grid",
                gridTemplateColumns:
                  "repeat(auto-fit,minmax(min(280px,100%),1fr))",
                gap: 12,
              }}
            >
              {gastosDoGeral.map((gasto) => (
                <div
                  key={gasto.id}
                  style={{
                    border: "1px solid #e5e7eb",
                    borderRadius: 12,
                    padding: 14,
                    background:
                      gasto.ativo === false ? "#f8fafc" : "#fff",
                    opacity: gasto.ativo === false ? 0.65 : 1,
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      gap: 10,
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 9,
                        minWidth: 0,
                      }}
                    >
                      <span
                        style={{
                          width: 40,
                          height: 40,
                          display: "grid",
                          placeItems: "center",
                          borderRadius: 10,
                          background: `${gasto.cor || GOLD}20`,
                          fontSize: 23,
                        }}
                      >
                        {gasto.icone || "💰"}
                      </span>
                      <div style={{ minWidth: 0 }}>
                        <strong
                          style={{
                            display: "block",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                          }}
                        >
                          {gasto.nome}
                        </strong>
                        <small style={{ color: "#64748b" }}>
                          {gasto.empresaNome || "Todas as empresas"}
                        </small>
                      </div>
                    </div>

                    <div
                      style={{
                        display: "flex",
                        gap: 3,
                      }}
                    >
                      <button
                        type="button"
                        title="Editar gasto"
                        onClick={() => editarGasto(gasto)}
                        style={{
                          border: 0,
                          background: "transparent",
                          color: "#64748b",
                          cursor: "pointer",
                        }}
                      >
                        <Edit3 size={16} />
                      </button>
                      <button
                        type="button"
                        title="Excluir gasto"
                        onClick={() => removerGasto(gasto)}
                        style={{
                          border: 0,
                          background: "transparent",
                          color: "#dc2626",
                          cursor: "pointer",
                        }}
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>

                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "flex-end",
                      gap: 10,
                      borderTop: "1px solid #e5e7eb",
                      marginTop: 13,
                      paddingTop: 12,
                    }}
                  >
                    <div>
                      <small
                        style={{
                          display: "block",
                          color: "#64748b",
                        }}
                      >
                        {frequencias.find(
                          (item) => item.value === gasto.frequencia
                        )?.label || "Valor fixo no período"}
                      </small>
                      <strong
                        style={{
                          display: "block",
                          marginTop: 4,
                          color: gasto.cor || GOLD,
                          fontSize: 17,
                        }}
                      >
                        {br(n(gasto.valor))}
                      </strong>
                    </div>

                    <strong
                      style={{
                        textAlign: "right",
                        fontSize: 14,
                      }}
                    >
                      {br(
                        gastoNoPeriodo(
                          gasto,
                          inicioGeral,
                          fimGeral
                        )
                      )}
                      <small
                        style={{
                          display: "block",
                          color: "#64748b",
                          fontSize: 10,
                          fontWeight: 400,
                        }}
                      >
                        lançado no período
                      </small>
                    </strong>
                  </div>

                  {gasto.observacoes && (
                    <small
                      style={{
                        display: "block",
                        color: "#64748b",
                        borderTop: "1px solid #e5e7eb",
                        marginTop: 12,
                        paddingTop: 10,
                      }}
                    >
                      {gasto.observacoes}
                    </small>
                  )}
                </div>
              ))}

              {!gastosDoGeral.length && (
                <div
                  style={{
                    gridColumn: "1 / -1",
                    border: "1px dashed #cbd5e1",
                    borderRadius: 10,
                    padding: 32,
                    textAlign: "center",
                    color: "#64748b",
                  }}
                >
                  Nenhum registro de gasto cadastrado para este filtro.
                </div>
              )}
            </div>
              </>
            )}

            {modoGeral === "VALORES" && (
              <>
                <TituloSecao>
                  VALORES POR PACOTE (META)
                </TituloSecao>

                {!transportadoraDoGeral && (
                  <div
                    style={{
                      border: "1px dashed #cbd5e1",
                      borderRadius: 10,
                      padding: 16,
                      color: "#64748b",
                      marginBottom: 16,
                    }}
                  >
                    Selecione uma transportadora para cadastrar os
                    valores-meta. Com TODAS, a análise mostra o
                    consolidado dos valores já cadastrados.
                  </div>
                )}

                {transportadoraDoGeral && (
                  <>
                    <div
                      style={{
                        display: "grid",
                        gridTemplateColumns:
                          "repeat(auto-fit,minmax(min(100%,200px),1fr))",
                        gap: 12,
                        marginBottom: 12,
                        minWidth: 0,
                      }}
                    >
                      <label style={{ minWidth: 0 }}>
                        <span className="field-label">
                          MERCADO LIVRE
                        </span>
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={formMeta.ml}
                          onChange={(event) =>
                            setFormMeta((old) => ({
                              ...old,
                              ml: event.target.value,
                            }))
                          }
                          placeholder="0,00"
                          style={campoStyle}
                        />
                      </label>

                      <label style={{ minWidth: 0 }}>
                        <span className="field-label">
                          SHOPEE
                        </span>
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={formMeta.shopee}
                          onChange={(event) =>
                            setFormMeta((old) => ({
                              ...old,
                              shopee: event.target.value,
                            }))
                          }
                          placeholder="0,00"
                          style={campoStyle}
                        />
                      </label>

                      <label style={{ minWidth: 0 }}>
                        <span className="field-label">
                          AVULSO
                        </span>
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={formMeta.avulso}
                          onChange={(event) =>
                            setFormMeta((old) => ({
                              ...old,
                              avulso: event.target.value,
                            }))
                          }
                          placeholder="0,00"
                          style={campoStyle}
                        />
                      </label>
                    </div>

                    <button
                      type="button"
                      className="primary"
                      disabled={salvandoMeta}
                      onClick={salvarMeta}
                      style={{ marginBottom: 18 }}
                    >
                      <Save size={17} />
                      {salvandoMeta
                        ? "Salvando..."
                        : "Salvar valores"}
                    </button>
                  </>
                )}

                <TituloSecao>
                  ONDE PRECISA AUMENTAR O VALOR
                </TituloSecao>

                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns:
                      "repeat(auto-fit,minmax(min(100%,240px),1fr))",
                    gap: 12,
                    marginBottom: 18,
                    minWidth: 0,
                  }}
                >
                  {financeiroGeral.tipos.map((tipo) => (
                    <div
                      key={tipo.rotulo}
                      style={{
                        border: "1px solid #e5e7eb",
                        borderRadius: 12,
                        padding: 14,
                        minWidth: 0,
                        boxSizing: "border-box",
                        background: tipo.metaAtingida
                          ? "#f0fdf4"
                          : "#fff",
                      }}
                    >
                      <strong
                        style={{
                          display: "block",
                          fontSize: 12,
                          letterSpacing: 0.5,
                          color: "#64748b",
                          marginBottom: 8,
                        }}
                      >
                        {tipo.rotulo}
                      </strong>

                      <Linha
                        label="Quantidade real"
                        valor={String(tipo.quantidade)}
                      />
                      <Linha
                        label="Faturamento"
                        valor={br(tipo.receita)}
                      />
                      <Linha
                        label="Valor atual"
                        valor={br(tipo.valorAtual)}
                      />
                      <Linha
                        label="Valor meta"
                        valor={br(tipo.valorMeta)}
                      />
                      <Linha
                        label="Diferença"
                        valor={br(tipo.diferenca)}
                      />
                      <Linha
                        label="Impacto se atingir"
                        valor={br(tipo.impacto)}
                      />

                      <small
                        style={{
                          display: "block",
                          marginTop: 8,
                          fontWeight: 800,
                          color: !tipo.metaDefinida
                            ? "#64748b"
                            : tipo.metaAtingida
                            ? "#166534"
                            : "#9a3412",
                        }}
                      >
                        {!tipo.metaDefinida
                          ? "Valor-meta não cadastrado"
                          : tipo.metaAtingida
                          ? "META ATINGIDA"
                          : "Abaixo da meta"}
                      </small>
                    </div>
                  ))}
                </div>

                <div
                  style={{
                    padding: 14,
                    borderRadius: 12,
                    background: "#fffbeb",
                    border: `1px solid ${GOLD}`,
                    color: "#92400e",
                    fontWeight: 800,
                    marginBottom: 6,
                  }}
                >
                  IMPACTO SE ATINGIR A META:{" "}
                  {br(financeiroGeral.impactoTotal)}
                </div>
              </>
            )}      {modalGasto && transportadoraParaGasto && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 1000,
            background: "rgba(15,23,42,.5)",
            padding: 18,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
          onClick={() => setModalGasto(false)}
        >
          <div
            className="card"
            style={{
              width: "100%",
              maxWidth: 620,
              maxHeight: "92vh",
              overflowY: "auto",
              padding: 22,
            }}
            onClick={(event) => event.stopPropagation()}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 12,
                marginBottom: 20,
              }}
            >
              <div>
                <h2 style={{ margin: 0 }}>
                  {gastoAberto ? "Editar gasto" : "Novo gasto"}
                </h2>
                <small style={{ color: "#64748b" }}>
                  {transportadoraParaGasto.nome}
                </small>
              </div>

              <button
                type="button"
                onClick={() => setModalGasto(false)}
                style={{
                  border: 0,
                  background: "transparent",
                  cursor: "pointer",
                }}
              >
                <X />
              </button>
            </div>

            <div
              style={{
                display: "grid",
                gridTemplateColumns:
                  "repeat(auto-fit,minmax(min(100%,180px),1fr))",
                gap: 12,
              }}
            >
              <label>
                <span className="field-label">NOME DO GASTO</span>
                <input
                  value={formGasto.nome}
                  onChange={(event) =>
                    setFormGasto((old) => ({
                      ...old,
                      nome: event.target.value,
                    }))
                  }
                  placeholder="Ex.: Gasolina"
                  style={campoStyle}
                />
              </label>

              <label>
                <span className="field-label">ÍCONE</span>
                <input
                  value={formGasto.icone}
                  readOnly
                  placeholder="⛽"
                  style={{
                    ...campoStyle,
                    fontSize: 22,
                    textAlign: "center",
                  }}
                />
              </label>

              <label>
                <span className="field-label">COR</span>
                <input
                  type="color"
                  value={formGasto.cor}
                  onChange={(event) =>
                    setFormGasto((old) => ({
                      ...old,
                      cor: event.target.value,
                    }))
                  }
                  style={{
                    ...campoStyle,
                    height: 44,
                    padding: 4,
                  }}
                />
              </label>
            </div>

            <div
              style={{
                display: "grid",
                gridTemplateColumns:
                  "repeat(auto-fit,minmax(min(220px,100%),1fr))",
                gap: 12,
                marginTop: 14,
              }}
            >
              <label>
                <span className="field-label">VALOR</span>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={formGasto.valor}
                  onChange={(event) =>
                    setFormGasto((old) => ({
                      ...old,
                      valor: event.target.value,
                    }))
                  }
                  placeholder="100,00"
                  style={campoStyle}
                />
              </label>

              <label>
                <span className="field-label">FREQUÊNCIA</span>
                <select
                  value={formGasto.frequencia}
                  onChange={(event) =>
                    setFormGasto((old) => ({
                      ...old,
                      frequencia:
                        event.target.value as Frequencia,
                    }))
                  }
                  style={campoStyle}
                >
                  {frequencias.map((item) => (
                    <option key={item.value} value={item.value}>
                      {item.label}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <div style={{ marginTop: 14 }}>
              <span className="field-label">
                ESCOLHA O ÍCONE
              </span>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns:
                    "repeat(auto-fit,minmax(46px,1fr))",
                  gap: 6,
                  marginTop: 8,
                  padding: 10,
                  border: "1px solid #e5e7eb",
                  borderRadius: 10,
                  maxHeight: 170,
                  overflowY: "auto",
                  background: "#f8fafc",
                }}
              >
                {iconesGasto.map((icone) => (
                  <button
                    key={icone}
                    type="button"
                    title={`Usar ícone ${icone}`}
                    onClick={() =>
                      setFormGasto((old) => ({
                        ...old,
                        icone,
                      }))
                    }
                    style={{
                      height: 42,
                      border:
                        formGasto.icone === icone
                          ? `2px solid ${GOLD}`
                          : "1px solid #e5e7eb",
                      borderRadius: 8,
                      background:
                        formGasto.icone === icone
                          ? "#fffbeb"
                          : "#fff",
                      cursor: "pointer",
                      fontSize: 22,
                    }}
                  >
                    {icone}
                  </button>
                ))}
              </div>
            </div>

            <label
              style={{
                display: "block",
                marginTop: 14,
              }}
            >
              <span className="field-label">EMPRESA</span>
              <select
                value={formGasto.empresaId}
                onChange={(event) =>
                  setFormGasto((old) => ({
                    ...old,
                    empresaId: event.target.value,
                  }))
                }
                style={campoStyle}
              >
                <option value="TODAS">
                  Todas as empresas da transportadora
                </option>
                {transportadoraParaGasto.empresas.map((item: AnyDoc) => {
                  const empresa = item.empresa || item;

                  return (
                    <option key={empresa.id} value={empresa.id}>
                      {empresa.nome ||
                        empresa.razaoSocial ||
                        empresa.id}
                    </option>
                  );
                })}
              </select>
            </label>

            <label
              style={{
                display: "block",
                marginTop: 14,
              }}
            >
              <span className="field-label">OBSERVAÇÕES</span>
              <textarea
                value={formGasto.observacoes}
                onChange={(event) =>
                  setFormGasto((old) => ({
                    ...old,
                    observacoes: event.target.value,
                  }))
                }
                placeholder="Detalhes opcionais..."
                style={{
                  ...campoStyle,
                  minHeight: 80,
                  resize: "vertical",
                  fontFamily: "inherit",
                }}
              />
            </label>

            <label
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                marginTop: 14,
                color: formGasto.ativo ? "#15803d" : "#dc2626",
                fontWeight: 800,
              }}
            >
              <input
                type="checkbox"
                checked={formGasto.ativo}
                onChange={(event) =>
                  setFormGasto((old) => ({
                    ...old,
                    ativo: event.target.checked,
                  }))
                }
              />
              Gasto ativo
            </label>

            <div
              style={{
                display: "flex",
                justifyContent: "flex-end",
                gap: 10,
                borderTop: "1px solid #e5e7eb",
                marginTop: 22,
                paddingTop: 16,
              }}
            >
              <button
                type="button"
                className="secondary"
                onClick={() => setModalGasto(false)}
              >
                Cancelar
              </button>
              <button
                type="button"
                className="primary"
                onClick={salvarGasto}
                disabled={salvandoGasto}
              >
                <Save size={16} />
                {salvandoGasto ? "Salvando..." : "Salvar gasto"}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
