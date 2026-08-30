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
  Clock3,
  Eye,
  EyeOff,
  Folder,
  History,
  LockKeyhole,
  Package,
  RefreshCw,
  Save,
  Search,
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
  doc,
  getDoc,
  getDocs,
  serverTimestamp,
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

type Aba = "REPASSES" | "EMPRESAS";

type ModoEmpresa =
  | "LISTA"
  | "DADOS"
  | "FECHAMENTO"
  | "HISTORICO";

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

function labelQuinzena(
  quinzena: string
) {
  return quinzena === "01_15"
    ? "01 ao 15"
    : "16 ao fim";
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
    pacote.usuarioFinalizacao ||
      pacote.usuarioId ||
      pacote.usuario ||
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
  return (
    data(
      pacote.dataColeta ||
        pacote.dataHoraColeta ||
        pacote.data ||
        pacote.createdAt
    ) || dataEntrega(pacote)
  );
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

export default function Financeiro() {
  const hoje = new Date();

  const [aba, setAba] =
    useState<Aba>("REPASSES");

  const [items, setItems] =
    useState<Repasse[]>([]);

  const [users, setUsers] =
    useState<Usuario[]>([]);

  const [pacotes, setPacotes] =
    useState<AnyDoc[]>([]);

  const [empresas, setEmpresas] =
    useState<AnyDoc[]>([]);

  const [coletas, setColetas] =
    useState<AnyDoc[]>([]);

  const [fechamentos, setFechamentos] =
    useState<AnyDoc[]>([]);

  const [configGanhos, setConfigGanhos] =
    useState<AnyDoc[]>([]);

  const [loading, setLoading] =
    useState(true);

  const [erro, setErro] =
    useState("");

  // PERMISSÃO
  const [checkingAccess, setCheckingAccess] =
    useState(true);

  const [allowed, setAllowed] =
    useState(false);

  const [busca, setBusca] =
    useState("");

  const [status, setStatus] =
    useState("TODOS");

  const [mes, setMes] =
    useState(hoje.getMonth() + 1);

  const [ano, setAno] =
    useState(hoje.getFullYear());

  const [quinzena, setQuinzena] =
    useState(
      hoje.getDate() <= 15
        ? "01_15"
        : "16_fim"
    );

  const [
    dataInicioFechamento,
    setDataInicioFechamento,
  ] = useState(
    new Date(
      hoje.getFullYear(),
      hoje.getMonth(),
      1
    )
  );

  const [
    dataFimFechamento,
    setDataFimFechamento,
  ] = useState(diaFim(hoje));

  const [
    empresaSelecionada,
    setEmpresaSelecionada,
  ] = useState<AnyDoc | null>(null);

  const [
    modoEmpresa,
    setModoEmpresa,
  ] = useState<ModoEmpresa>("LISTA");

  const [
    repasseAberto,
    setRepasseAberto,
  ] = useState<any | null>(null);

  const [
    confirmandoPagamento,
    setConfirmandoPagamento,
  ] = useState(false);

  const [
    confirmandoFechamento,
    setConfirmandoFechamento,
  ] = useState(false);

  const [
    historicoAberto,
    setHistoricoAberto,
  ] = useState<string | null>(null);

  const [
    salvandoEmpresa,
    setSalvandoEmpresa,
  ] = useState(false);

  const [
    mostrarSenha,
    setMostrarSenha,
  ] = useState(false);

  const [
    dadosEmpresa,
    setDadosEmpresa,
  ] = useState({
    nome: "",
    valorML: "",
    valorShopee: "",
    valorAvulso: "",
    sistema: "",
    login: "",
    senha: "",
    observacoes: "",
    pastas: [] as string[],
    ativo: true,
  });

  const intervaloRepasse = useMemo(
    () =>
      intervaloQuinzena(
        mes,
        ano,
        quinzena
      ),
    [mes, ano, quinzena]
  );

  const inicioRepasse =
    intervaloRepasse.inicio;

  const fimRepasse =
    intervaloRepasse.fim;

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
        repassesData,
        usuariosData,
        pacotesSnap,
        empresasSnap,
        coletasSnap,
        fechamentosSnap,
        ganhosSnap,
      ] = await Promise.all([
        listarRepasses().catch(() => []),
        listarUsuarios().catch(() => []),
        getDocs(
          collection(
            db,
            "controle_codigos"
          )
        ),
        getDocs(
          collection(db, "empresas")
        ).catch(() => ({
          docs: [],
        })),
        getDocs(
          collection(db, "coletas")
        ).catch(() => ({
          docs: [],
        })),
        getDocs(
          collection(
            db,
            "fechamentos_empresa"
          )
        ).catch(() => ({
          docs: [],
        })),
        getDocs(
          collection(
            db,
            "config_ganhos"
          )
        ).catch(() => ({
          docs: [],
        })),
      ]);

      setItems(repassesData || []);
      setUsers(usuariosData || []);

      setPacotes(
        pacotesSnap.docs.map(
          (item: any) => ({
            id: item.id,
            ...item.data(),
          })
        )
      );

      setEmpresas(
        empresasSnap.docs.map(
          (item: any) => ({
            id: item.id,
            ...item.data(),
          })
        )
      );

      setColetas(
        coletasSnap.docs.map(
          (item: any) => ({
            id: item.id,
            ...item.data(),
          })
        )
      );

      setFechamentos(
        fechamentosSnap.docs.map(
          (item: any) => ({
            id: item.id,
            ...item.data(),
          })
        )
      );

      setConfigGanhos(
        ganhosSnap.docs.map(
          (item: any) => ({
            id: item.id,
            ...item.data(),
          })
        )
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

  useEffect(() => {
    if (!empresaSelecionada) return;

    setDadosEmpresa({
      nome:
        empresaSelecionada.nome ||
        empresaSelecionada.razaoSocial ||
        "",
      valorML: String(empresaSelecionada.valorML ?? ""),
      valorShopee: String(empresaSelecionada.valorShopee ?? ""),
      valorAvulso: String(empresaSelecionada.valorAvulso ?? ""),
      sistema: empresaSelecionada.sistema || "",
      login: empresaSelecionada.login || "",
      senha: empresaSelecionada.senha || "",
      observacoes: empresaSelecionada.observacoes || "",
      pastas: Array.isArray(empresaSelecionada.pastas)
        ? empresaSelecionada.pastas.map((item: any) => String(item))
        : [],
      ativo: empresaSelecionada.ativo !== false,
    });
    setMostrarSenha(false);
  }, [empresaSelecionada?.id]);

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

    return {
      transportadoraId:
        String(
          pacote.transportadoraId ||
            coleta?.transportadoraId ||
            coleta?.transportadora ||
            "sem_transportadora"
        ),
      transportadoraNome:
        String(
          pacote.transportadoraNome ||
            coleta?.transportadoraNome ||
            coleta?.transportadora ||
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

  // Verifica diretamente empresa
  if (
    valoresPacote.some((valor) =>
      valoresEmpresa.includes(valor)
    )
  ) {
    return true;
  }

  // CORREÇÃO:
  // Verifica as pastas vinculadas à empresa
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

  function calcularRepasseUsuario(
    usuarioId: string
  ) {
    const usuario =
      usuarioEncontrado(usuarioId);

    const config =
      configUsuario(usuarioId);

    let qtdML = 0;
    let qtdShopee = 0;
    let qtdAvulso = 0;

    let totalML = 0;
    let totalShopee = 0;
    let totalAvulso = 0;

    const codigos =
      new Set<string>();

    const transportadoras =
      new Map<string, AnyDoc>();

    function garantirTransportadora(
      id: string,
      nome: string
    ) {
      if (
        !transportadoras.has(id)
      ) {
        transportadoras.set(
          id,
          {
            id,
            nome,
            quantidade: 0,
            valor: 0,
            qtdML: 0,
            qtdShopee: 0,
            qtdAvulso: 0,
            creditos: 0,
            debitos: 0,
            totalFinal: 0,
          }
        );
      }

      return transportadoras.get(
        id
      )!;
    }

    pacotes.forEach((pacote) => {
      const uid =
        usuarioEntrega(pacote);

      if (
        normalizar(uid) !==
        normalizar(usuarioId)
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
        dataEntrega(pacote);

      if (
        !dentroPeriodo(
          entrega,
          inicioRepasse,
          fimRepasse
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

      let valor = 0;

      if (
        tipo === "MERCADO_LIVRE"
      ) {
        valor = n(
          config.ml ||
            config.valorML ||
            config.mercadoLivre
        );

        qtdML += 1;
        totalML += valor;
      } else if (
        tipo === "SHOPEE"
      ) {
        valor = n(
          config.shopee ||
            config.valorShopee
        );

        qtdShopee += 1;
        totalShopee += valor;
      } else {
        valor = n(
          config.avulso ||
            config.valorAvulso
        );

        qtdAvulso += 1;
        totalAvulso += valor;
      }

      const dadosEmpresa =
        empresaDaColeta(pacote);

      const t =
        garantirTransportadora(
          dadosEmpresa.transportadoraId,
          dadosEmpresa.transportadoraNome
        );

      t.quantidade += 1;
      t.valor += valor;

      if (
        tipo === "MERCADO_LIVRE"
      ) {
        t.qtdML += 1;
      } else if (
        tipo === "SHOPEE"
      ) {
        t.qtdShopee += 1;
      } else {
        t.qtdAvulso += 1;
      }
    });

    const porTransportadora =
      Array.from(
        transportadoras.values()
      )
        .map((t) => ({
          ...t,
          totalFinal:
            n(t.valor) +
            n(t.creditos) -
            n(t.debitos),
        }))
        .sort(
          (a, b) =>
            n(b.totalFinal) -
            n(a.totalFinal)
        );

    const totalGeral =
      totalML +
      totalShopee +
      totalAvulso;

    return {
      usuarioId,

      nome:
        usuario?.nome ||
        usuario?.name ||
        usuario?.nomeCompleto ||
        nomePorEmail(
          usuarioId,
          users
        ) ||
        usuarioId,

      email:
        usuario?.email ||
        usuarioId,

      pix:
        usuario?.pix || "",

      banco:
        usuario?.banco || "",

      favorecido:
        usuario?.favorecido || "",

      qtdML,
      qtdShopee,
      qtdAvulso,

      totalML,
      totalShopee,
      totalAvulso,

      totalPacotes:
        qtdML +
        qtdShopee +
        qtdAvulso,

      creditos: 0,
      debitos: 0,

      porTransportadora,

      totalGeral,
    };
  }

  function repassePagoNoPeriodo(
    usuarioId: string
  ) {
    return items.find(
      (repasse: any) => {
        if (
          normalizar(
            repasse.usuarioId
          ) !==
          normalizar(usuarioId)
        ) {
          return false;
        }

        return (
          String(
            repasse.quinzena || ""
          ) === quinzena &&
          Number(repasse.mes) === mes &&
          Number(repasse.ano) === ano
        );
      }
    );
  }

  const usuariosComEntrega =
    useMemo(() => {
      const ids =
        new Set<string>();

      pacotes.forEach((pacote) => {
        if (
          statusPacote(pacote) !==
          "ENTREGUE"
        ) {
          return;
        }

        const entrega =
          dataEntrega(pacote);

        if (
          dentroPeriodo(
            entrega,
            inicioRepasse,
            fimRepasse
          )
        ) {
          const uid =
            usuarioEntrega(pacote);

          if (uid) {
            ids.add(uid);
          }
        }
      });

      return Array.from(ids);
    }, [
      pacotes,
      inicioRepasse,
      fimRepasse,
    ]);

  const repassesCalculados =
    useMemo(() => {
      return usuariosComEntrega.map(
        (usuarioId) => {
          const calculado =
            calcularRepasseUsuario(
              usuarioId
            );

          const pago =
            repassePagoNoPeriodo(
              usuarioId
            );

          return {
            ...calculado,
            pago: Boolean(pago),
            pagamento:
              pago || null,
          };
        }
      );
    }, [
      usuariosComEntrega,
      pacotes,
      configGanhos,
      coletas,
      items,
      mes,
      ano,
      quinzena,
    ]);

  const repassesFiltrados =
    useMemo(() => {
      const termo =
        busca.trim().toLowerCase();

      return repassesCalculados.filter(
        (repasse) => {
          const encontrou =
            !termo ||
            String(
              repasse.nome || ""
            )
              .toLowerCase()
              .includes(termo) ||
            String(
              repasse.email || ""
            )
              .toLowerCase()
              .includes(termo) ||
            String(
              repasse.usuarioId || ""
            )
              .toLowerCase()
              .includes(termo);

          const statusOk =
            status === "TODOS" ||
            (status === "PAGO"
              ? repasse.pago
              : !repasse.pago);

          return (
            encontrou &&
            statusOk
          );
        }
      );
    }, [
      repassesCalculados,
      busca,
      status,
    ]);

  const totaisRepasse =
    useMemo(() => {
      return repassesFiltrados.reduce(
        (acc, repasse) => {
          acc.geral +=
            n(repasse.totalGeral);

          acc.pago += repasse.pago
            ? n(repasse.totalGeral)
            : 0;

          acc.pendente += !repasse.pago
            ? n(repasse.totalGeral)
            : 0;

          acc.pacotes +=
            inteiro(
              repasse.totalPacotes
            );

          return acc;
        },
        {
          geral: 0,
          pago: 0,
          pendente: 0,
          pacotes: 0,
        }
      );
    }, [repassesFiltrados]);

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
        dataEntrega(pacote);

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

      totalRepasse +=
        valorUsuario(
          usuario,
          tipo
        );
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

      lucro:
        totalReceber -
        totalRepasse,
    };
  }

  const empresaCalculada =
    useMemo(() => {
      if (!empresaSelecionada) {
        return null;
      }

      return calcularEmpresa(
        empresaSelecionada,
        diaInicio(
          dataInicioFechamento
        ),
        diaFim(dataFimFechamento)
      );
    }, [
      empresaSelecionada,
      pacotes,
      users,
      configGanhos,
      dataInicioFechamento,
      dataFimFechamento,
    ]);

  const empresaAnterior =
    useMemo(() => {
      if (!empresaSelecionada) {
        return null;
      }

      const anterior =
        periodoAnterior(
          diaInicio(
            dataInicioFechamento
          ),
          diaFim(dataFimFechamento)
        );

      return calcularEmpresa(
        empresaSelecionada,
        anterior.inicio,
        anterior.fim
      );
    }, [
      empresaSelecionada,
      pacotes,
      users,
      configGanhos,
      dataInicioFechamento,
      dataFimFechamento,
    ]);

  const empresasFiltradas =
    useMemo(() => {
      const termo =
        busca.trim().toLowerCase();

      if (!termo) {
        return empresas;
      }

      return empresas.filter(
        (empresa) =>
          String(
            empresa.nome ||
              empresa.razaoSocial ||
              empresa.id
          )
            .toLowerCase()
            .includes(termo)
      );
    }, [
      empresas,
      busca,
    ]);

  const historicoEmpresa =
    useMemo(() => {
      if (!empresaSelecionada) {
        return [];
      }

      return fechamentos
        .filter(
          (fechamento) =>
            normalizar(
              fechamento.empresaId
            ) ===
              normalizar(
                empresaSelecionada.id
              )
        )
        .sort((a, b) => {
          const da =
            data(
              a.dataFechamento ||
                a.dataCriacao
            )?.getTime() || 0;

          const dbb =
            data(
              b.dataFechamento ||
                b.dataCriacao
            )?.getTime() || 0;

          return dbb - da;
        });
    }, [
      fechamentos,
      empresaSelecionada,
    ]);

  async function confirmarPagamento(
    dados: any
  ) {
    if (
      confirmandoPagamento ||
      dados.pago
    ) {
      return;
    }

    const confirmar =
      window.confirm(
        `Confirmar pagamento?\n\n${dados.nome}\n${br(
          dados.totalGeral
        )}`
      );

    if (!confirmar) return;

    setConfirmandoPagamento(true);

    try {
      const agora = new Date();

      await addDoc(
        collection(db, "repasses"),
        {
          usuarioId:
            dados.usuarioId,

          usuarioNome:
            dados.nome,

          quinzena,

          quinzenaLabel:
            labelQuinzena(
              quinzena
            ),

          mes,
          ano,

          dataInicio:
            inicioRepasse,

          dataFim:
            fimRepasse,

          dataPagamento:
            agora,

          horaPagamento:
            agora.toLocaleTimeString(
              "pt-BR"
            ),

          adminId:
            auth.currentUser?.uid ||
            "",

          adminEmail:
            auth.currentUser?.email ||
            "",

          dadosBancarios: {
            pix: dados.pix,
            banco: dados.banco,
            favorecido:
              dados.favorecido,
          },

          porTransportadora:
            dados.porTransportadora,

          mlTotal:
            dados.qtdML,

          shopeeTotal:
            dados.qtdShopee,

          avulsoTotal:
            dados.qtdAvulso,

          totalPacotes:
            dados.totalPacotes,

          creditos:
            dados.creditos,

          debitos:
            dados.debitos,

          totalGeral:
            dados.totalGeral,

          pago: true,

          dataCriacao:
            serverTimestamp(),
        }
      );

      setRepasseAberto(null);

      await load();

      alert(
        "Pagamento confirmado com sucesso!"
      );
    } catch (e) {
      console.error(e);

      alert(
        "Erro ao confirmar pagamento."
      );
    } finally {
      setConfirmandoPagamento(false);
    }
  }

  async function confirmarFechamento() {
    if (
      !empresaCalculada ||
      confirmandoFechamento
    ) {
      return;
    }

    const dados =
      empresaCalculada;

    const confirmar =
      window.confirm(
        `Confirmar fechamento?\n\nEmpresa: ${dados.empresaNome}\nPeríodo: ${dataInicioFechamento.toLocaleDateString(
          "pt-BR"
        )} até ${dataFimFechamento.toLocaleDateString(
          "pt-BR"
        )}\n\nA receber: ${br(
          dados.totalReceber
        )}\nRepasse: ${br(
          dados.totalRepasse
        )}\nLucro: ${br(
          dados.lucro
        )}`
      );

    if (!confirmar) return;

    setConfirmandoFechamento(true);

    try {
      const anterior =
        empresaAnterior;

      const agora = new Date();

      await addDoc(
        collection(
          db,
          "fechamentos_empresa"
        ),
        {
          empresaId:
            dados.empresaId,

          empresaNome:
            dados.empresaNome,

          periodoInicio:
            diaInicio(
              dataInicioFechamento
            ),

          periodoFim:
            diaFim(
              dataFimFechamento
            ),

          periodoLabel:
            `${dataInicioFechamento.toLocaleDateString(
              "pt-BR"
            )} até ${dataFimFechamento.toLocaleDateString(
              "pt-BR"
            )}`,

          qtdML:
            dados.qtdML,

          qtdShopee:
            dados.qtdShopee,

          qtdAvulso:
            dados.qtdAvulso,

          totalPacotes:
            dados.totalPacotes,

          valorML:
            dados.valorML,

          valorShopee:
            dados.valorShopee,

          valorAvulso:
            dados.valorAvulso,

          totalReceber:
            dados.totalReceber,

          totalRepasse:
            dados.totalRepasse,

          lucro:
            dados.lucro,

          prevQtdML:
            anterior?.qtdML || 0,

          prevQtdShopee:
            anterior?.qtdShopee || 0,

          prevQtdAvulso:
            anterior?.qtdAvulso || 0,

          prevTotalPacotes:
            anterior?.totalPacotes || 0,

          prevTotalReceber:
            anterior?.totalReceber || 0,

          prevTotalRepasse:
            anterior?.totalRepasse || 0,

          prevLucro:
            anterior?.lucro || 0,

          adminId:
            auth.currentUser?.uid ||
            "",

          adminEmail:
            auth.currentUser?.email ||
            "",

          dataFechamento:
            agora,

          dataCriacao:
            serverTimestamp(),
        }
      );

      await load();

      setModoEmpresa(
        "HISTORICO"
      );

      alert(
        "Fechamento salvo no histórico com sucesso!"
      );
    } catch (e) {
      console.error(e);

      alert(
        "Erro ao salvar fechamento."
      );
    } finally {
      setConfirmandoFechamento(false);
    }
  }

  function abrirEmpresa(
    empresa: AnyDoc,
    tela: ModoEmpresa = "DADOS"
  ) {
    setEmpresaSelecionada(empresa);
    setModoEmpresa(tela);
    setBusca("");
    setHistoricoAberto(null);
  }

  function atualizarCampoEmpresa(
    campo:
      | "nome"
      | "valorML"
      | "valorShopee"
      | "valorAvulso"
      | "sistema"
      | "login"
      | "senha"
      | "observacoes",
    valor: string
  ) {
    setDadosEmpresa((anterior) => ({
      ...anterior,
      [campo]: valor,
    }));
  }

  function alternarPasta(pastaId: string) {
    setDadosEmpresa((anterior) => {
      const existe = anterior.pastas.includes(pastaId);
      return {
        ...anterior,
        pastas: existe
          ? anterior.pastas.filter((item) => item !== pastaId)
          : [...anterior.pastas, pastaId],
      };
    });
  }

  async function salvarDadosEmpresa() {
    if (!empresaSelecionada) return;

    const nome = dadosEmpresa.nome.trim();
    if (!nome) {
      alert("Informe o nome da empresa.");
      return;
    }

    setSalvandoEmpresa(true);
    try {
      const dados = {
        nome: nome.toUpperCase(),
        valorML: n(dadosEmpresa.valorML),
        valorShopee: n(dadosEmpresa.valorShopee),
        valorAvulso: n(dadosEmpresa.valorAvulso),
        sistema: dadosEmpresa.sistema.trim(),
        login: dadosEmpresa.login.trim(),
        senha: dadosEmpresa.senha,
        observacoes: dadosEmpresa.observacoes.trim(),
        pastas: dadosEmpresa.pastas,
        ativo: dadosEmpresa.ativo,
        atualizadoEm: serverTimestamp(),
        atualizadoPor: auth.currentUser?.uid || "",
      };

      await updateDoc(
        doc(db, "empresas", empresaSelecionada.id),
        dados
      );

      const empresaAtualizada = {
        ...empresaSelecionada,
        ...dados,
      };

      setEmpresaSelecionada(empresaAtualizada);
      setEmpresas((lista) =>
        lista.map((empresa) =>
          empresa.id === empresaSelecionada.id
            ? empresaAtualizada
            : empresa
        )
      );
      alert("Dados da empresa atualizados com sucesso!");
    } catch (e) {
      console.error(e);
      alert("Erro ao salvar os dados da empresa.");
    } finally {
      setSalvandoEmpresa(false);
    }
  }

  function aplicarMesAtual() {
    const agora = new Date();

    setDataInicioFechamento(
      new Date(
        agora.getFullYear(),
        agora.getMonth(),
        1
      )
    );

    setDataFimFechamento(
      diaFim(agora)
    );
  }

  function aplicarHoje() {
    const agora = new Date();

    setDataInicioFechamento(
      diaInicio(agora)
    );

    setDataFimFechamento(
      diaFim(agora)
    );
  }

  function aplicarUltimos7() {
    const fim =
      diaFim(new Date());

    const inicio =
      diaInicio(
        new Date(
          fim.getFullYear(),
          fim.getMonth(),
          fim.getDate() - 6
        )
      );

    setDataInicioFechamento(inicio);
    setDataFimFechamento(fim);
  }

  // CARREGANDO PERMISSÃO
  if (checkingAccess) {
    return (
      <div>
        <PageHeader
          title="Financeiro"
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
              Você não possui permissão para acessar o Financeiro.
            </p>
          </div>
        </section>
      </div>
    );
  }

  return (
    <div
      style={{
        maxWidth: 1440,
        margin: "0 auto",
        paddingBottom: 32,
      }}
    >
      <PageHeader
        title="Financeiro"
        subtitle="Repasses, pagamentos e fechamento operacional"
        action={
          <button
            className="secondary"
            onClick={load}
          >
            <RefreshCw size={15} />
            Atualizar
          </button>
        }
      />

      {erro && (
        <div className="error-box">
          {erro}
        </div>
      )}

      <div
        style={{
          display: "flex",
          gap: 8,
          flexWrap: "wrap",
          marginBottom: 18,
          padding: 6,
          borderRadius: 14,
          background: "#f8fafc",
          border: "1px solid #edf1f5",
          width: "fit-content",
        }}
      >
        <AbaBotao
          ativo={aba === "REPASSES"}
          texto="REPASSES"
          icon={
            <WalletCards size={17} />
          }
          onClick={() => {
            setAba("REPASSES");
            setBusca("");
            setEmpresaSelecionada(null);
          }}
        />

        <AbaBotao
          ativo={aba === "EMPRESAS"}
          texto="EMPRESAS"
          icon={
            <Building2 size={17} />
          }
          onClick={() => {
            setAba("EMPRESAS");
            setBusca("");
            setEmpresaSelecionada(null);
            setModoEmpresa("LISTA");
          }}
        />
      </div>

      {loading && (
        <div
          className="card"
          style={{
            padding: 45,
            textAlign: "center",
          }}
        >
          Carregando financeiro...
        </div>
      )}

      {!loading &&
        aba === "REPASSES" && (
          <>
            <section className="card">
              <div
                style={{
                  padding: 16,
                  display: "grid",
                  gridTemplateColumns:
                    "repeat(auto-fit,minmax(180px,1fr))",
                  gap: 12,
                }}
              >
                <label>
                  <small>
                    MÊS
                  </small>

                  <select
                    value={mes}
                    onChange={(e) =>
                      setMes(
                        Number(e.target.value)
                      )
                    }
                    style={{
                      width: "100%",
                      marginTop: 5,
                    }}
                  >
                    {MESES.map(
                      (nome, index) => (
                        <option
                          key={nome}
                          value={index + 1}
                        >
                          {nome}
                        </option>
                      )
                    )}
                  </select>
                </label>

                <label>
                  <small>
                    ANO
                  </small>

                  <select
                    value={ano}
                    onChange={(e) =>
                      setAno(
                        Number(e.target.value)
                      )
                    }
                    style={{
                      width: "100%",
                      marginTop: 5,
                    }}
                  >
                    {[
                      hoje.getFullYear() - 1,
                      hoje.getFullYear(),
                      hoje.getFullYear() + 1,
                    ].map((item) => (
                      <option
                        key={item}
                        value={item}
                      >
                        {item}
                      </option>
                    ))}
                  </select>
                </label>

                <label>
                  <small>
                    STATUS
                  </small>

                  <select
                    value={status}
                    onChange={(e) =>
                      setStatus(
                        e.target.value
                      )
                    }
                    style={{
                      width: "100%",
                      marginTop: 5,
                    }}
                  >
                    <option value="TODOS">
                      Todos
                    </option>

                    <option value="PENDENTE">
                      Pendentes
                    </option>

                    <option value="PAGO">
                      Pagos
                    </option>
                  </select>
                </label>

                <div>
                  <small>
                    QUINZENA
                  </small>

                  <div
                    style={{
                      display: "flex",
                      gap: 8,
                      marginTop: 5,
                    }}
                  >
                    <QuinzenaBotao
                      ativo={
                        quinzena === "01_15"
                      }
                      texto="01 ao 15"
                      onClick={() =>
                        setQuinzena(
                          "01_15"
                        )
                      }
                    />

                    <QuinzenaBotao
                      ativo={
                        quinzena ===
                        "16_fim"
                      }
                      texto="16 ao fim"
                      onClick={() =>
                        setQuinzena(
                          "16_fim"
                        )
                      }
                    />
                  </div>
                </div>
              </div>
            </section>

            <div
              style={{
                display: "flex",
                gap: 12,
                flexWrap: "wrap",
                margin: "16px 0",
              }}
            >
              <div
                className="stat-card"
                style={{
                  flex: 1,
                  minWidth: 170,
                }}
              >
                <div className="stat-icon">
                  <Package />
                </div>

                <span>
                  Pacotes
                </span>

                <strong>
                  {totaisRepasse.pacotes}
                </strong>
              </div>

              <div
                className="stat-card"
                style={{
                  flex: 1,
                  minWidth: 170,
                }}
              >
                <div className="stat-icon blue">
                  <WalletCards />
                </div>

                <span>
                  Total
                </span>

                <strong>
                  {br(
                    totaisRepasse.geral
                  )}
                </strong>
              </div>

              <div
                className="stat-card"
                style={{
                  flex: 1,
                  minWidth: 170,
                }}
              >
                <div className="stat-icon green">
                  <CheckCircle2 />
                </div>

                <span>
                  Pago
                </span>

                <strong>
                  {br(
                    totaisRepasse.pago
                  )}
                </strong>
              </div>

              <div
                className="stat-card"
                style={{
                  flex: 1,
                  minWidth: 170,
                }}
              >
                <div className="stat-icon orange">
                  <Clock3 />
                </div>

                <span>
                  Pendente
                </span>

                <strong>
                  {br(
                    totaisRepasse.pendente
                  )}
                </strong>
              </div>
            </div>

            <section className="card">
              <div
                style={{
                  padding: 16,
                  borderBottom:
                    "1px solid #e5e7eb",
                  display: "flex",
                  gap: 12,
                  flexWrap: "wrap",
                  alignItems: "center",
                  justifyContent:
                    "space-between",
                }}
              >
                <div>
                  <h3
                    style={{
                      margin: 0,
                    }}
                  >
                    Repasses
                  </h3>

                  <small
                    style={{
                      color: "#64748b",
                    }}
                  >
                    {labelQuinzena(
                      quinzena
                    )}{" "}
                    •{" "}
                    {inicioRepasse.toLocaleDateString(
                      "pt-BR"
                    )}{" "}
                    até{" "}
                    {fimRepasse.toLocaleDateString(
                      "pt-BR"
                    )}
                  </small>
                </div>

                <div
                  className="search"
                  style={{
                    minWidth: 260,
                  }}
                >
                  <Search size={17} />

                  <input
                    value={busca}
                    onChange={(e) =>
                      setBusca(
                        e.target.value
                      )
                    }
                    placeholder="Buscar entregador..."
                  />
                </div>
              </div>

              <div
                style={{
                  padding: 16,
                  display: "grid",
                  gridTemplateColumns:
                    "repeat(auto-fit, minmax(280px, 1fr))",
                  gap: 14,
                }}
              >
                {repassesFiltrados.map(
                  (repasse) => (
                    <div
                      key={repasse.usuarioId}
                      onClick={() =>
                        setRepasseAberto(repasse)
                      }
                      role="button"
                      tabIndex={0}
                      onKeyDown={(e) => {
                        if (
                          e.key === "Enter" ||
                          e.key === " "
                        ) {
                          setRepasseAberto(repasse);
                        }
                      }}
                      style={{
                        cursor: "pointer",
                        border: "1px solid #e5e7eb",
                        borderRadius: 14,
                        padding: 16,
                        background:
                          "linear-gradient(135deg,#fff 0%,#fffbeb 100%)",
                        boxShadow:
                          "0 4px 12px rgba(15,23,42,.05)",
                        transition: "transform .15s ease",
                      }}
                    >
                      <div
                        style={{
                          display: "flex",
                          alignItems: "flex-start",
                          justifyContent: "space-between",
                          gap: 12,
                          marginBottom: 16,
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
                          <div
                            style={{
                              width: 38,
                              height: 38,
                              flexShrink: 0,
                              borderRadius: "50%",
                              background: "#fffbeb",
                              color: GOLD,
                              display: "grid",
                              placeItems: "center",
                              border: `1px solid ${GOLD}`,
                            }}
                          >
                            <User size={17} />
                          </div>

                          <div style={{ minWidth: 0 }}>
                            <b
                              style={{
                                display: "block",
                                overflow: "hidden",
                                textOverflow: "ellipsis",
                                whiteSpace: "nowrap",
                              }}
                            >
                              {repasse.nome}
                            </b>

                            <small
                              style={{
                                display: "block",
                                color: "#64748b",
                                marginTop: 3,
                                overflow: "hidden",
                                textOverflow: "ellipsis",
                                whiteSpace: "nowrap",
                              }}
                            >
                              {repasse.email || "E-mail não informado"}
                            </small>
                          </div>
                        </div>

                        <span
                          style={{
                            flexShrink: 0,
                            color: repasse.pago
                              ? "#15803d"
                              : "#b45309",
                            background: repasse.pago
                              ? "#dcfce7"
                              : "#fef3c7",
                            borderRadius: 20,
                            padding: "6px 9px",
                            fontSize: 10,
                            fontWeight: 800,
                          }}
                        >
                          {repasse.pago ? "PAGO" : "PENDENTE"}
                        </span>
                      </div>

                      <div
                        style={{
                          display: "grid",
                          gridTemplateColumns:
                            "repeat(4, minmax(0, 1fr))",
                          gap: 8,
                          marginBottom: 16,
                        }}
                      >
                        <Mini
                          label="PACOTES"
                          valor={String(repasse.totalPacotes)}
                        />
                        <Mini
                          label="ML"
                          valor={String(repasse.qtdML)}
                        />
                        <Mini
                          label="SHOPEE"
                          valor={String(repasse.qtdShopee)}
                        />
                        <Mini
                          label="AVULSO"
                          valor={String(repasse.qtdAvulso)}
                        />
                      </div>

                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                          gap: 10,
                          paddingTop: 13,
                          borderTop: "1px solid #e5e7eb",
                        }}
                      >
                        <span
                          style={{
                            color: "#64748b",
                            fontSize: 12,
                            fontWeight: 700,
                          }}
                        >
                          Total do repasse
                        </span>

                        <strong
                          style={{
                            color: "#92400e",
                            fontSize: 18,
                          }}
                        >
                          {br(repasse.totalGeral)}
                        </strong>
                      </div>
                    </div>
                  )
                )}

                {!repassesFiltrados.length && (
                  <div
                    style={{
                      gridColumn: "1 / -1",
                      padding: 40,
                      textAlign: "center",
                      color: "#64748b",
                    }}
                  >
                    Nenhum repasse encontrado.
                  </div>
                )}
              </div>
            </section>
          </>
        )}

      {!loading &&
        aba === "EMPRESAS" &&
        !empresaSelecionada && (
          <>
            <section className="card">
              <div
                style={{
                  padding: 16,
                  borderBottom:
                    "1px solid #e5e7eb",
                  display: "flex",
                  justifyContent:
                    "space-between",
                  gap: 12,
                  alignItems: "center",
                  flexWrap: "wrap",
                }}
              >
                <div>
                  <h3
                    style={{
                      margin: 0,
                    }}
                  >
                    Empresas
                  </h3>

                  <p
                    style={{
                      color: "#64748b",
                      margin:
                        "5px 0 0",
                    }}
                  >
                    Selecione uma empresa para acessar os dados, fechamento ou histórico.
                  </p>
                </div>

                <div
                  className="search"
                  style={{
                    minWidth: 260,
                  }}
                >
                  <Search size={17} />

                  <input
                    value={busca}
                    onChange={(e) =>
                      setBusca(
                        e.target.value
                      )
                    }
                    placeholder="Buscar empresa..."
                  />
                </div>
              </div>

              <div
                style={{
                  padding: 16,
                  display: "grid",
                  gridTemplateColumns:
                    "repeat(auto-fit,minmax(290px,1fr))",
                  gap: 14,
                }}
              >
                {empresasFiltradas.map(
                  (empresa) => (
                    <div
                      key={empresa.id}
                      style={{
                        border:
                          "1px solid #e5e7eb",
                        borderRadius: 12,
                        overflow:
                          "hidden",
                        background:
                          "#fff",
                      }}
                    >
                      <div
                        style={{
                          padding: 16,
                          display:
                            "flex",
                          alignItems:
                            "center",
                          gap: 12,
                        }}
                      >
                        <div
                          style={{
                            width: 44,
                            height: 44,
                            borderRadius: 10,
                            display:
                              "grid",
                            placeItems:
                              "center",
                            background:
                              "#fffbeb",
                            color: GOLD,
                          }}
                        >
                          <Building2 />
                        </div>

                        <div
                          style={{
                            minWidth: 0,
                            flex: 1,
                          }}
                        >
                          <b
                            style={{
                              display:
                                "block",
                              color:
                                "#17202d",
                            }}
                          >
                            {empresa.nome ||
                              empresa.razaoSocial ||
                              empresa.id}
                          </b>

                          <small
                            style={{
                              display:
                                "block",
                              color:
                                "#64748b",
                              marginTop: 4,
                            }}
                          >
                            ML{" "}
                            {br(
                              valorEmpresa(
                                empresa,
                                "MERCADO_LIVRE"
                              )
                            )}{" "}
                            • Shopee{" "}
                            {br(
                              valorEmpresa(
                                empresa,
                                "SHOPEE"
                              )
                            )}
                          </small>
                        </div>
                      </div>

                      <div
                        style={{
                          display:
                            "grid",
                          gridTemplateColumns:
                            "repeat(3,1fr)",
                          borderTop:
                            "1px solid #e5e7eb",
                        }}
                      >
                        <button
                          onClick={() =>
                            abrirEmpresa(
                              empresa,
                              "DADOS"
                            )
                          }
                          style={{
                            border: 0,
                            borderRight:
                              "1px solid #e5e7eb",
                            background:
                              "#fff",
                            padding: 12,
                            cursor:
                              "pointer",
                            color:
                              "#475569",
                            fontWeight: 800,
                          }}
                        >
                          Dados
                        </button>

                        <button
                          onClick={() =>
                            abrirEmpresa(
                              empresa,
                              "HISTORICO"
                            )
                          }
                          style={{
                            border: 0,
                            borderRight:
                              "1px solid #e5e7eb",
                            background:
                              "#fff",
                            padding: 12,
                            cursor:
                              "pointer",
                            color:
                              "#64748b",
                            fontWeight: 700,
                          }}
                        >
                          <History
                            size={15}
                            style={{
                              verticalAlign:
                                "middle",
                                marginRight: 5,
                              }}
                          />
                          Histórico
                        </button>

                        <button
                          onClick={() =>
                            abrirEmpresa(
                              empresa,
                              "FECHAMENTO"
                            )
                          }
                          style={{
                            border: 0,
                            background:
                              "#fff",
                            padding: 12,
                            cursor:
                              "pointer",
                            color: GOLD,
                            fontWeight: 900,
                          }}
                        >
                          Fechamento
                        </button>
                      </div>
                    </div>
                  )
                )}

                {!empresasFiltradas.length && (
                  <div
                    style={{
                      gridColumn:
                        "1 / -1",
                      padding: 40,
                      textAlign:
                        "center",
                      color:
                        "#64748b",
                    }}
                  >
                    Nenhuma empresa encontrada.
                  </div>
                )}
              </div>
            </section>
          </>
        )}

      {!loading &&
        aba === "EMPRESAS" &&
        empresaSelecionada && (
          <>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                flexWrap: "wrap",
                marginBottom: 16,
              }}
            >
              <button
                className="secondary"
                onClick={() => {
                  setEmpresaSelecionada(
                    null
                  );

                  setModoEmpresa(
                    "LISTA"
                  );

                  setHistoricoAberto(
                    null
                  );
                }}
              >
                ← Empresas
              </button>

              <div
                style={{
                  flex: 1,
                  minWidth: 220,
                }}
              >
                <h2
                  style={{
                    margin: 0,
                    color: "#17202d",
                  }}
                >
                  {empresaSelecionada.nome ||
                    empresaSelecionada.razaoSocial ||
                    empresaSelecionada.id}
                </h2>
              </div>

              <button
                onClick={() =>
                  setModoEmpresa(
                    "DADOS"
                  )
                }
                style={botaoModo(
                  modoEmpresa === "DADOS"
                )}
              >
                <Building2
                  size={16}
                />
                Dados da empresa
              </button>

              <button
                onClick={() =>
                  setModoEmpresa(
                    "FECHAMENTO"
                  )
                }
                style={botaoModo(
                  modoEmpresa ===
                    "FECHAMENTO"
                )}
              >
                <CircleDollarSign
                  size={16}
                />
                Fechamento
              </button>

              <button
                onClick={() =>
                  setModoEmpresa(
                    "HISTORICO"
                  )
                }
                style={botaoModo(
                  modoEmpresa ===
                    "HISTORICO"
                )}
              >
                <History size={16} />
                Histórico
              </button>
            </div>

            {modoEmpresa === "DADOS" && (
              <section className="card" style={{ padding: 22 }}>
                <div style={{ marginBottom: 24 }}>
                  <div style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 12,
                    marginBottom: 6,
                  }}>
                    <div style={{
                      width: 42,
                      height: 42,
                      borderRadius: 12,
                      display: "grid",
                      placeItems: "center",
                      background: "#fffbeb",
                      color: GOLD,
                    }}>
                      <Building2 size={22} />
                    </div>
                    <div>
                      <h3 style={{ margin: 0 }}>Dados da empresa</h3>
                      <p style={{ margin: "4px 0 0", color: "#64748b" }}>
                        Configure as informações usadas no sistema e no financeiro.
                      </p>
                    </div>
                  </div>
                </div>

                <div style={{
                  display: "grid",
                  gridTemplateColumns: "minmax(0,1.6fr) minmax(220px,1fr)",
                  gap: 16,
                  marginBottom: 24,
                }}>
                  <label>
                    <span className="field-label">NOME DA EMPRESA</span>
                    <input
                      value={dadosEmpresa.nome}
                      onChange={(e) => atualizarCampoEmpresa("nome", e.target.value)}
                      style={{ ...campoStyle, textTransform: "uppercase" }}
                      placeholder="Nome ou razão social"
                    />
                  </label>
                  <div>
                    <span className="field-label">STATUS DA EMPRESA</span>
                    <button
                      type="button"
                      onClick={() => setDadosEmpresa((anterior) => ({
                        ...anterior,
                        ativo: !anterior.ativo,
                      }))}
                      style={{
                        ...campoStyle,
                        cursor: "pointer",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        background: dadosEmpresa.ativo ? "#f0fdf4" : "#fef2f2",
                        color: dadosEmpresa.ativo ? "#15803d" : "#b91c1c",
                        fontWeight: 900,
                      }}
                    >
                      {dadosEmpresa.ativo ? "EMPRESA ATIVA" : "EMPRESA INATIVA"}
                      {dadosEmpresa.ativo ? <CheckCircle2 size={19} /> : <XCircle size={19} />}
                    </button>
                  </div>
                </div>

                <div style={{
                  padding: 18,
                  borderRadius: 14,
                  background: "#f8fafc",
                  border: "1px solid #edf1f5",
                  marginBottom: 24,
                }}>
                  <h4 style={{ margin: "0 0 14px", color: GOLD, fontSize: 12, letterSpacing: ".07em" }}>
                    VALORES POR PACOTE
                  </h4>
                  <div style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))",
                    gap: 14,
                  }}>
                    <label>
                      <span className="field-label">MERCADO LIVRE (R$)</span>
                      <input type="number" min="0" step="0.01" value={dadosEmpresa.valorML}
                        onChange={(e) => atualizarCampoEmpresa("valorML", e.target.value)}
                        style={campoStyle} />
                    </label>
                    <label>
                      <span className="field-label">SHOPEE (R$)</span>
                      <input type="number" min="0" step="0.01" value={dadosEmpresa.valorShopee}
                        onChange={(e) => atualizarCampoEmpresa("valorShopee", e.target.value)}
                        style={campoStyle} />
                    </label>
                    <label>
                      <span className="field-label">AVULSO (R$)</span>
                      <input type="number" min="0" step="0.01" value={dadosEmpresa.valorAvulso}
                        onChange={(e) => atualizarCampoEmpresa("valorAvulso", e.target.value)}
                        style={campoStyle} />
                    </label>
                  </div>
                  <div style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fit,minmax(170px,1fr))",
                    gap: 10,
                    marginTop: 14,
                  }}>
                    <InfoCard titulo="MERCADO LIVRE" valor={br(n(dadosEmpresa.valorML))} />
                    <InfoCard titulo="SHOPEE" valor={br(n(dadosEmpresa.valorShopee))} />
                    <InfoCard titulo="AVULSO" valor={br(n(dadosEmpresa.valorAvulso))} />
                  </div>
                </div>

                <div style={{ marginBottom: 24 }}>
                  <h4 style={{ margin: "0 0 6px", color: GOLD, fontSize: 12, letterSpacing: ".07em" }}>
                    PASTAS DA EMPRESA
                  </h4>
                  <p style={{ color: "#64748b", fontSize: 12, margin: "0 0 12px" }}>
                    Selecione as pastas de coleta que pertencem a esta empresa.
                  </p>
                  <div style={{
                    border: "1px solid #e5e7eb",
                    borderRadius: 12,
                    padding: 12,
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fit,minmax(230px,1fr))",
                    gap: 10,
                    maxHeight: 300,
                    overflowY: "auto",
                  }}>
                    {coletas.map((pasta) => {
                      const selecionada = dadosEmpresa.pastas.includes(pasta.id);
                      return (
                        <button key={pasta.id} type="button" onClick={() => alternarPasta(pasta.id)}
                          style={{
                            border: selecionada ? `1px solid ${GOLD}` : "1px solid #e5e7eb",
                            background: selecionada ? "#fffbeb" : "#fff",
                            borderRadius: 10,
                            padding: 12,
                            cursor: "pointer",
                            display: "flex",
                            alignItems: "center",
                            gap: 10,
                            textAlign: "left",
                          }}>
                          <Folder size={18} color={selecionada ? GOLD : "#94a3b8"} />
                          <span style={{ flex: 1, minWidth: 0 }}>
                            <b style={{ display: "block", color: "#17202d" }}>{pasta.nome || pasta.id}</b>
                            <small style={{ color: "#94a3b8" }}>{pasta.id}</small>
                          </span>
                          <b style={{ color: selecionada ? GOLD : "#cbd5e1", fontSize: 18 }}>
                            {selecionada ? "✓" : "○"}
                          </b>
                        </button>
                      );
                    })}
                    {!coletas.length && (
                      <div style={{ gridColumn: "1 / -1", padding: 22, textAlign: "center", color: "#64748b" }}>
                        Nenhuma pasta encontrada.
                      </div>
                    )}
                  </div>
                  <small style={{ display: "block", marginTop: 9, color: GOLD, fontWeight: 800 }}>
                    {dadosEmpresa.pastas.length} pasta(s) selecionada(s)
                  </small>
                </div>

                <div style={{ marginBottom: 24 }}>
                  <h4 style={{ margin: "0 0 12px", color: GOLD, fontSize: 12, letterSpacing: ".07em" }}>
                    ACESSO AO SISTEMA
                  </h4>
                  <div style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))",
                    gap: 14,
                  }}>
                    <label>
                      <span className="field-label">SISTEMA UTILIZADO</span>
                      <input value={dadosEmpresa.sistema}
                        onChange={(e) => atualizarCampoEmpresa("sistema", e.target.value)}
                        style={campoStyle} placeholder="Nome do sistema" />
                    </label>
                    <label>
                      <span className="field-label">LOGIN / E-MAIL</span>
                      <input value={dadosEmpresa.login}
                        onChange={(e) => atualizarCampoEmpresa("login", e.target.value)}
                        style={campoStyle} />
                    </label>
                    <label>
                      <span className="field-label">SENHA</span>
                      <div style={{ position: "relative" }}>
                        <input type={mostrarSenha ? "text" : "password"} value={dadosEmpresa.senha}
                          onChange={(e) => atualizarCampoEmpresa("senha", e.target.value)}
                          style={{ ...campoStyle, paddingRight: 44 }} />
                        <button type="button" onClick={() => setMostrarSenha((valor) => !valor)}
                          style={{
                            position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)",
                            border: 0, background: "transparent", cursor: "pointer", color: "#64748b",
                          }}>
                          {mostrarSenha ? <EyeOff size={18} /> : <Eye size={18} />}
                        </button>
                      </div>
                    </label>
                  </div>
                </div>

                <div style={{ marginBottom: 22 }}>
                  <h4 style={{ margin: "0 0 12px", color: GOLD, fontSize: 12, letterSpacing: ".07em" }}>
                    OBSERVAÇÕES
                  </h4>
                  <textarea value={dadosEmpresa.observacoes}
                    onChange={(e) => atualizarCampoEmpresa("observacoes", e.target.value)}
                    style={{ ...campoStyle, minHeight: 105, resize: "vertical", fontFamily: "inherit" }}
                    placeholder="Informações adicionais..." />
                </div>

                <div style={{
                  paddingTop: 16,
                  borderTop: "1px solid #e5e7eb",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  gap: 12,
                  flexWrap: "wrap",
                }}>
                  <small style={{ color: "#94a3b8" }}>ID: {empresaSelecionada.id}</small>
                  <button className="primary" onClick={salvarDadosEmpresa} disabled={salvandoEmpresa}>
                    <Save size={17} />
                    {salvandoEmpresa ? "Salvando..." : "Salvar dados da empresa"}
                  </button>
                </div>
              </section>
            )}

            {modoEmpresa ===
              "FECHAMENTO" &&
              empresaCalculada &&
              empresaAnterior && (
                <>
                  <section
                    className="card"
                    style={{
                      padding: 16,
                      marginBottom: 16,
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        gap: 8,
                        flexWrap: "wrap",
                        marginBottom: 14,
                      }}
                    >
                      <button
                        className="secondary"
                        onClick={
                          aplicarHoje
                        }
                      >
                        Hoje
                      </button>

                      <button
                        className="secondary"
                        onClick={
                          aplicarUltimos7
                        }
                      >
                        Últimos 7 dias
                      </button>

                      <button
                        className="secondary"
                        onClick={
                          aplicarMesAtual
                        }
                      >
                        Mês atual
                      </button>
                    </div>

                    <div
                      style={{
                        display: "grid",
                        gridTemplateColumns:
                          "repeat(auto-fit,minmax(220px,1fr))",
                        gap: 12,
                      }}
                    >
                      <label>
                        <small>
                          DATA INICIAL
                        </small>

                        <input
                          type="date"
                          value={
                            dataInicioFechamento
                              .toISOString()
                              .slice(0, 10)
                          }
                          onChange={(e) =>
                            setDataInicioFechamento(
                              new Date(
                                `${e.target.value}T00:00:00`
                              )
                            )
                          }
                          style={{
                            width: "100%",
                            marginTop: 5,
                          }}
                        />
                      </label>

                      <label>
                        <small>
                          DATA FINAL
                        </small>

                        <input
                          type="date"
                          value={
                            dataFimFechamento
                              .toISOString()
                              .slice(0, 10)
                          }
                          onChange={(e) =>
                            setDataFimFechamento(
                              new Date(
                                `${e.target.value}T23:59:59`
                              )
                            )
                          }
                          style={{
                            width: "100%",
                            marginTop: 5,
                          }}
                        />
                      </label>
                    </div>
                  </section>

                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns:
                        "repeat(auto-fit,minmax(190px,1fr))",
                      gap: 12,
                    }}
                  >
                    <div
                      className="stat-card"
                    >
                      <div className="stat-icon">
                        <Package />
                      </div>

                      <span>
                        Pacotes
                      </span>

                      <strong>
                        {
                          empresaCalculada.totalPacotes
                        }
                      </strong>
                    </div>

                    <div
                      className="stat-card"
                    >
                      <div className="stat-icon blue">
                        <CircleDollarSign />
                      </div>

                      <span>
                        A receber
                      </span>

                      <strong>
                        {br(
                          empresaCalculada.totalReceber
                        )}
                      </strong>
                    </div>

                    <div
                      className="stat-card"
                    >
                      <div className="stat-icon orange">
                        <Banknote />
                      </div>

                      <span>
                        Repasse
                      </span>

                      <strong>
                        {br(
                          empresaCalculada.totalRepasse
                        )}
                      </strong>
                    </div>

                    <div
                      className="stat-card"
                    >
                      <div className="stat-icon green">
                        <TrendingUp />
                      </div>

                      <span>
                        Lucro bruto
                      </span>

                      <strong>
                        {br(
                          empresaCalculada.lucro
                        )}
                      </strong>
                    </div>
                  </div>

                  <section
                    className="card"
                    style={{
                      padding: 18,
                      marginTop: 16,
                      maxWidth: 850,
                    }}
                  >
                    <TituloSecao>
                      PACOTES POR TIPO (FATURAMENTO)
                    </TituloSecao>

                    <CardTipo
                      titulo="Mercado Livre"
                      qtd={
                        empresaCalculada.qtdML
                      }
                      valor={
                        empresaCalculada.qtdML *
                        empresaCalculada.valorML
                      }
                    />

                    <CardTipo
                      titulo="Shopee"
                      qtd={
                        empresaCalculada.qtdShopee
                      }
                      valor={
                        empresaCalculada.qtdShopee *
                        empresaCalculada.valorShopee
                      }
                    />

                    <CardTipo
                      titulo="Avulso"
                      qtd={
                        empresaCalculada.qtdAvulso
                      }
                      valor={
                        empresaCalculada.qtdAvulso *
                        empresaCalculada.valorAvulso
                      }
                    />

                    <TituloSecao>
                      RESUMO FINANCEIRO
                    </TituloSecao>

                    <Linha
                      label="Total a receber da empresa"
                      valor={br(
                        empresaCalculada.totalReceber
                      )}
                    />

                    <small
                      style={{
                        color:
                          "#64748b",
                        display:
                          "block",
                        margin:
                          "8px 0 12px",
                      }}
                    >
                      Baseado nos pacotes da empresa dentro do período.
                    </small>

                    <Linha
                      label="Repasse aos entregadores"
                      valor={`− ${br(
                        empresaCalculada.totalRepasse
                      )}`}
                    />

                    <small
                      style={{
                        color:
                          "#64748b",
                        display:
                          "block",
                        margin:
                          "8px 0 12px",
                      }}
                    >
                      Baseado apenas nos pacotes entregues dentro do período.
                    </small>

                    <div
                      style={{
                        padding: 15,
                        borderRadius: 10,
                        border: `1px solid ${
                          empresaCalculada.lucro >=
                          0
                            ? "#86efac"
                            : "#fecaca"
                        }`,
                        background:
                          empresaCalculada.lucro >=
                          0
                            ? "#f0fdf4"
                            : "#fef2f2",
                        display:
                          "flex",
                        justifyContent:
                          "space-between",
                        gap: 15,
                      }}
                    >
                      <b>
                        LUCRO BRUTO
                      </b>

                      <b
                        style={{
                          color:
                            empresaCalculada.lucro >=
                            0
                              ? "#15803d"
                              : "#dc2626",
                          fontSize: 21,
                        }}
                      >
                        {br(
                          empresaCalculada.lucro
                        )}
                      </b>
                    </div>

                    <TituloSecao>
                      COMPARATIVO COM PERÍODO ANTERIOR
                    </TituloSecao>

                    <Comparativo
                      label="Pacotes"
                      atual={
                        empresaCalculada.totalPacotes
                      }
                      anterior={
                        empresaAnterior.totalPacotes
                      }
                      atualTexto={String(
                        empresaCalculada.totalPacotes
                      )}
                      anteriorTexto={String(
                        empresaAnterior.totalPacotes
                      )}
                    />

                    <Comparativo
                      label="Faturamento"
                      atual={
                        empresaCalculada.totalReceber
                      }
                      anterior={
                        empresaAnterior.totalReceber
                      }
                      atualTexto={br(
                        empresaCalculada.totalReceber
                      )}
                      anteriorTexto={br(
                        empresaAnterior.totalReceber
                      )}
                    />

                    <Comparativo
                      label="Repasse"
                      atual={
                        empresaCalculada.totalRepasse
                      }
                      anterior={
                        empresaAnterior.totalRepasse
                      }
                      atualTexto={br(
                        empresaCalculada.totalRepasse
                      )}
                      anteriorTexto={br(
                        empresaAnterior.totalRepasse
                      )}
                    />

                    <Comparativo
                      label="Lucro"
                      atual={
                        empresaCalculada.lucro
                      }
                      anterior={
                        empresaAnterior.lucro
                      }
                      atualTexto={br(
                        empresaCalculada.lucro
                      )}
                      anteriorTexto={br(
                        empresaAnterior.lucro
                      )}
                    />

                    <button
                      onClick={
                        confirmarFechamento
                      }
                      disabled={
                        confirmandoFechamento
                      }
                      style={{
                        width: "100%",
                        marginTop: 24,
                        height: 52,
                        border: 0,
                        borderRadius: 10,
                        background:
                          "#16a34a",
                        color: "#fff",
                        fontWeight: 900,
                        cursor:
                          confirmandoFechamento
                            ? "wait"
                            : "pointer",
                        opacity:
                          confirmandoFechamento
                            ? 0.7
                            : 1,
                      }}
                    >
                      {confirmandoFechamento
                        ? "SALVANDO..."
                        : "CONFIRMAR FECHAMENTO"}
                    </button>
                  </section>
                </>
              )}

            {modoEmpresa ===
              "HISTORICO" && (
              <section className="card">
                <div
                  style={{
                    padding: 16,
                    borderBottom:
                      "1px solid #e5e7eb",
                  }}
                >
                  <h3
                    style={{
                      margin: 0,
                    }}
                  >
                    Histórico de fechamentos
                  </h3>
                </div>

                <div
                  style={{
                    padding: 16,
                  }}
                >
                  {historicoEmpresa.map(
                    (h) => {
                      const aberto =
                        historicoAberto ===
                        h.id;

                      return (
                        <div
                          key={h.id}
                          style={{
                            border:
                              "1px solid #e5e7eb",
                            borderRadius: 10,
                            marginBottom: 10,
                            overflow:
                              "hidden",
                          }}
                        >
                          <button
                            onClick={() =>
                              setHistoricoAberto(
                                aberto
                                  ? null
                                  : h.id
                              )
                            }
                            style={{
                              width:
                                "100%",
                              border: 0,
                              background:
                                "#fff",
                              padding: 15,
                              cursor:
                                "pointer",
                              display:
                                "flex",
                              justifyContent:
                                "space-between",
                              gap: 14,
                              textAlign:
                                "left",
                            }}
                          >
                            <div>
                              <b>
                                {h.periodoLabel ||
                                  "Período não informado"}
                              </b>

                              <small
                                style={{
                                  display:
                                    "block",
                                  color:
                                    "#64748b",
                                  marginTop: 4,
                                }}
                              >
                                Fechado em{" "}
                                {dataTexto(
                                  h.dataFechamento ||
                                    h.dataCriacao
                                )}
                              </small>
                            </div>

                            <div
                              style={{
                                display:
                                  "flex",
                                alignItems:
                                  "center",
                                gap: 14,
                              }}
                            >
                              <b
                                style={{
                                  color:
                                    n(h.lucro) >=
                                    0
                                      ? "#15803d"
                                      : "#dc2626",
                                }}
                              >
                                {br(
                                  n(h.lucro)
                                )}
                              </b>

                              {aberto ? (
                                <ChevronUp />
                              ) : (
                                <ChevronDown />
                              )}
                            </div>
                          </button>

                          {aberto && (
                            <div
                              style={{
                                padding:
                                  "0 15px 15px",
                              }}
                            >
                              <Linha
                                label="Mercado Livre"
                                valor={String(
                                  inteiro(
                                    h.qtdML
                                  )
                                )}
                              />

                              <Linha
                                label="Shopee"
                                valor={String(
                                  inteiro(
                                    h.qtdShopee
                                  )
                                )}
                              />

                              <Linha
                                label="Avulso"
                                valor={String(
                                  inteiro(
                                    h.qtdAvulso
                                  )
                                )}
                              />

                              <Linha
                                label="Total de pacotes"
                                valor={String(
                                  inteiro(
                                    h.totalPacotes
                                  )
                                )}
                              />

                              <Linha
                                label="Total a receber"
                                valor={br(
                                  n(
                                    h.totalReceber
                                  )
                                )}
                              />

                              <Linha
                                label="Total repasse"
                                valor={br(
                                  n(
                                    h.totalRepasse
                                  )
                                )}
                              />

                              <Linha
                                label="Lucro"
                                valor={br(
                                  n(h.lucro)
                                )}
                              />

                              <Linha
                                label="Data do fechamento"
                                valor={dataTexto(
                                  h.dataFechamento ||
                                    h.dataCriacao
                                )}
                              />
                            </div>
                          )}
                        </div>
                      );
                    }
                  )}

                  {!historicoEmpresa.length && (
                    <div
                      style={{
                        padding: 40,
                        textAlign:
                          "center",
                        color:
                          "#64748b",
                      }}
                    >
                      Nenhum fechamento salvo para esta empresa.
                    </div>
                  )}
                </div>
              </section>
            )}
          </>
        )}

      {repasseAberto && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 9999,
            background:
              "rgba(15,23,42,.55)",
            padding: 18,
            display: "flex",
            alignItems: "center",
            justifyContent:
              "center",
          }}
          onClick={() =>
            setRepasseAberto(null)
          }
        >
          <div
            className="card"
            style={{
              width: "100%",
              maxWidth: 760,
              maxHeight: "90vh",
              overflowY: "auto",
              padding: 20,
            }}
            onClick={(e) =>
              e.stopPropagation()
            }
          >
            <div
              style={{
                display: "flex",
                justifyContent:
                  "space-between",
                gap: 15,
                alignItems:
                  "flex-start",
              }}
            >
              <div>
                <h2
                  style={{
                    margin:
                      "0 0 5px",
                    display:
                      "flex",
                    gap: 8,
                    alignItems:
                      "center",
                  }}
                >
                  <User size={22} />
                  {repasseAberto.nome}
                </h2>

                <p
                  style={{
                    color:
                      "#64748b",
                    margin: 0,
                  }}
                >
                  {labelQuinzena(
                    quinzena
                  )}{" "}
                  •{" "}
                  {inicioRepasse.toLocaleDateString(
                    "pt-BR"
                  )}{" "}
                  até{" "}
                  {fimRepasse.toLocaleDateString(
                    "pt-BR"
                  )}
                </p>
              </div>

              <button
                onClick={() =>
                  setRepasseAberto(
                    null
                  )
                }
                style={{
                  border: 0,
                  background:
                    "transparent",
                  cursor:
                    "pointer",
                }}
              >
                <X />
              </button>
            </div>

            <TituloSecao>
              DADOS BANCÁRIOS
            </TituloSecao>

            <div
              style={{
                border:
                  "1px solid #e5e7eb",
                borderRadius: 10,
                padding: 14,
              }}
            >
              <Linha
                label="PIX"
                valor={
                  repasseAberto.pix ||
                  "Não informado"
                }
              />

              <Linha
                label="Banco"
                valor={
                  repasseAberto.banco ||
                  "Não informado"
                }
              />

              <Linha
                label="Favorecido"
                valor={
                  repasseAberto.favorecido ||
                  "Não informado"
                }
              />
            </div>

            <TituloSecao>
              GANHOS POR TIPO
            </TituloSecao>

            <CardTipo
              titulo="Mercado Livre"
              qtd={
                repasseAberto.qtdML
              }
              valor={
                repasseAberto.totalML
              }
            />

            <CardTipo
              titulo="Shopee"
              qtd={
                repasseAberto.qtdShopee
              }
              valor={
                repasseAberto.totalShopee
              }
            />

            <CardTipo
              titulo="Avulso"
              qtd={
                repasseAberto.qtdAvulso
              }
              valor={
                repasseAberto.totalAvulso
              }
            />

            <TituloSecao>
              SEPARAÇÃO POR TRANSPORTADORA
            </TituloSecao>

            {repasseAberto
              .porTransportadora?.length ? (
              repasseAberto.porTransportadora.map(
                (
                  t: AnyDoc,
                  index: number
                ) => (
                  <div
                    key={
                      t.id ||
                      `${t.nome}-${index}`
                    }
                    style={{
                      border:
                        "1px solid #e5e7eb",
                      borderRadius: 11,
                      padding: 14,
                      marginBottom: 10,
                      background:
                        "#fff",
                    }}
                  >
                    <div
                      style={{
                        display:
                          "flex",
                        justifyContent:
                          "space-between",
                        gap: 12,
                        alignItems:
                          "center",
                        marginBottom: 10,
                      }}
                    >
                      <div>
                        <b
                          style={{
                            color:
                              "#17202d",
                          }}
                        >
                          {t.nome ||
                            "Sem Transportadora"}
                        </b>

                        <small
                          style={{
                            display:
                              "block",
                            color:
                              "#64748b",
                            marginTop: 3,
                          }}
                        >
                          {n(
                            t.quantidade
                          )} pacote(s)
                        </small>
                      </div>

                      <b
                        style={{
                          color:
                            "#92400e",
                          fontSize: 17,
                        }}
                      >
                        {br(
                          n(
                            t.totalFinal
                          )
                        )}
                      </b>
                    </div>

                    <Linha
                      label="Ganhos"
                      valor={br(
                        n(t.valor)
                      )}
                    />

                    <Linha
                      label="Créditos"
                      valor={`+ ${br(
                        n(t.creditos)
                      )}`}
                    />

                    <Linha
                      label="Débitos"
                      valor={`− ${br(
                        n(t.debitos)
                      )}`}
                    />

                    <Linha
                      label="TOTAL DA TRANSPORTADORA"
                      valor={br(
                        n(t.totalFinal)
                      )}
                    />

                    <div
                      style={{
                        display:
                          "grid",
                        gridTemplateColumns:
                          "repeat(3,1fr)",
                        gap: 8,
                        marginTop: 12,
                      }}
                    >
                      <Mini
                        label="ML"
                        valor={String(
                          n(t.qtdML)
                        )}
                      />

                      <Mini
                        label="SHOPEE"
                        valor={String(
                          n(t.qtdShopee)
                        )}
                      />

                      <Mini
                        label="AVULSO"
                        valor={String(
                          n(t.qtdAvulso)
                        )}
                      />
                    </div>
                  </div>
                )
              )
            ) : (
              <div
                style={{
                  padding: 18,
                  border:
                    "1px dashed #cbd5e1",
                  borderRadius: 10,
                  color:
                    "#64748b",
                  textAlign:
                    "center",
                }}
              >
                Nenhuma transportadora identificada neste repasse.
              </div>
            )}

            <TituloSecao>
              AJUSTES FINANCEIROS
            </TituloSecao>

            <Linha
              label="Créditos"
              valor={`+ ${br(
                n(
                  repasseAberto.creditos
                )
              )}`}
            />

            <Linha
              label="Débitos"
              valor={`− ${br(
                n(
                  repasseAberto.debitos
                )
              )}`}
            />

            <div
              style={{
                marginTop: 20,
                padding: 16,
                borderRadius: 10,
                border: `1px solid ${GOLD}`,
                background:
                  "#fffbeb",
                display: "flex",
                justifyContent:
                  "space-between",
                gap: 12,
              }}
            >
              <b>
                TOTAL GERAL
              </b>

              <b
                style={{
                  color:
                    "#92400e",
                  fontSize: 23,
                }}
              >
                {br(
                  repasseAberto.totalGeral
                )}
              </b>
            </div>

            {repasseAberto.pago ? (
              <div
                style={{
                  marginTop: 18,
                  padding: 14,
                  borderRadius: 9,
                  background:
                    "#dcfce7",
                  color:
                    "#166534",
                  fontWeight: 800,
                  textAlign:
                    "center",
                }}
              >
                <CheckCircle2
                  size={18}
                  style={{
                    verticalAlign:
                      "middle",
                    marginRight: 6,
                  }}
                />
                PAGAMENTO JÁ CONFIRMADO
              </div>
            ) : (
              <button
                onClick={() =>
                  confirmarPagamento(
                    repasseAberto
                  )
                }
                disabled={
                  confirmandoPagamento
                }
                style={{
                  width: "100%",
                  marginTop: 18,
                  padding: 15,
                  border: 0,
                  borderRadius: 10,
                  background:
                    "#16a34a",
                  color: "#fff",
                  cursor:
                    "pointer",
                  fontWeight: 900,
                  fontSize: 15,
                  opacity:
                    confirmandoPagamento
                      ? 0.7
                      : 1,
                }}
              >
                {confirmandoPagamento
                  ? "CONFIRMANDO..."
                  : "CONFIRMAR PAGAMENTO"}
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function botaoModo(
  ativo: boolean
): React.CSSProperties {
  return {
    border: ativo
      ? `1px solid ${GOLD}`
      : "1px solid #e5e7eb",
    background: ativo
      ? "#fffbeb"
      : "#fff",
    color: ativo
      ? "#92400e"
      : "#64748b",
    borderRadius: 9,
    padding: "10px 13px",
    cursor: "pointer",
    fontWeight: 800,
    display: "inline-flex",
    alignItems: "center",
    gap: 7,
  };
}