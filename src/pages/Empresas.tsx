// ARQUIVO: src/pages/Empresas.tsx

import {
  type FormEvent,
  useEffect,
  useMemo,
  useState,
  type CSSProperties,
} from "react";
import {
  addDoc,
  collection,
  doc,
  onSnapshot,
  serverTimestamp,
  setDoc,
  updateDoc,
} from "firebase/firestore";
import {
  createUserWithEmailAndPassword,
  getAuth,
  onAuthStateChanged,
} from "firebase/auth";
import { deleteApp, initializeApp } from "firebase/app";
import {
  MapContainer,
  Marker,
  Popup,
  TileLayer,
  useMap,
} from "react-leaflet";
import L from "leaflet";
import {
  ArrowLeft,
  Building2,
  ChevronRight,
  Map,
  Package,
  Search,
  Truck,
  UserX,
  X,
} from "lucide-react";
import { db, auth } from "../services/firebase/firebase";
import PageHeader from "../components/ui/PageHeader";
import pinML from "../assets/pin_ml.png";
import pinShopee from "../assets/pin_shopee.png";
import pinAvulso from "../assets/pin_avulso.png";

const LIMITE_PASTAS = 30;

type Status =
  | "COLETADO"
  | "ROTA"
  | "ENTREGUE"
  | "AUSENTE"
  | "DEVOLVIDO";

type Filtro = "hoje" | "ontem" | "ultimos7" | "personalizado";

type TelaAberta =
  | "STATUS"
  | "ATENCAO"
  | "MAPA"
  | null;

type Empresa = {
  id: string;
  nome?: string;
  valorML?: number;
  valorShopee?: number;
  valorAvulso?: number;
  sistema?: string;
  login?: string;
  senha?: string;
  observacoes?: string;
  pastas?: string[];
};

type Usuario = {
  id: string;
  uid?: string;
  email?: string;
  nome?: string;
  tipo?: string;
  empresaId?: string;
  empresaNome?: string;
  empresa?: string;
};

type Codigo = {
  id: string;
  codigo?: string;
  empresa?: string;
  status?: string;
  tipo?: string;
  usuario?: string;
  usuarioFinalizacao?: string;
  data?: any;
  dataHoraBaixa?: any;
  latitudeEntrega?: number | string;
  longitudeEntrega?: number | string;
  latitude?: number | string;
  longitude?: number | string;

  nome?: string;
  documento?: string;
  endereco?: string;
  fotoEntrega?: string;
  fotoEntregue?: string;
  foto?: string;
  imagem?: string;
  comprovanteFoto?: string;
  fotoDevolucao?: string;
  [key: string]: any;
};

const STATUS: {
  key: Status;
  label: string;
  color: string;
}[] = [
  { key: "COLETADO", label: "Coletados", color: "#c9a227" },
  { key: "ROTA", label: "Em rota", color: "#2196f3" },
  { key: "ENTREGUE", label: "Entregues", color: "#22c55e" },
  { key: "AUSENTE", label: "Ausentes", color: "#f97316" },
  { key: "DEVOLVIDO", label: "Devolvidos", color: "#6b7280" },
];

const thStyle: CSSProperties = {
  padding: "13px 14px",
  textAlign: "left",
  fontSize: 12,
  color: "#64748b",
  fontWeight: 800,
  whiteSpace: "nowrap",
  borderBottom: "1px solid #e5e7eb",
};

const tdStyle: CSSProperties = {
  padding: "14px",
  color: "#334155",
  borderBottom: "1px solid #f1f5f9",
  verticalAlign: "middle",
};

function corStatus(status: string = "") {
  const valor = String(status).toUpperCase().trim();

  if (valor === "ENTREGUE") return "#22c55e";
  if (valor === "AUSENTE") return "#f97316";
  if (valor === "ROTA") return "#2196f3";
  if (valor === "COLETADO") return "#c9a227";
  if (valor === "DEVOLVIDO") return "#6b7280";

  return "#94a3b8";
}

function Info({
  titulo,
  valor,
}: {
  titulo: string;
  valor: string | number | null | undefined;
}) {
  return (
    <div
      style={{
        padding: 12,
        background: "#f8fafc",
        border: "1px solid #e5e7eb",
        borderRadius: 12,
        minWidth: 0,
      }}
    >
      <small
        style={{
          display: "block",
          fontSize: 10,
          fontWeight: 800,
          letterSpacing: ".08em",
          color: "#64748b",
          marginBottom: 5,
        }}
      >
        {titulo}
      </small>

      <strong
        style={{
          display: "block",
          color: "#17202d",
          fontSize: 14,
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
        }}
        title={String(valor ?? "-")}
      >
        {valor ?? "-"}
      </strong>
    </div>
  );
}

function dataFirebase(value: any): Date | null {
  if (!value) return null;

  if (typeof value.toDate === "function") {
    return value.toDate();
  }

  const date = new Date(value);

  return Number.isNaN(date.getTime())
    ? null
    : date;
}

function formatarData(value: any) {
  const data = dataFirebase(value);

  return data
    ? data.toLocaleString("pt-BR")
    : "-";
}

function normalizarTipo(tipo: string = "") {
  const valor = String(tipo)
    .toUpperCase()
    .trim();

  if (
    valor.includes("MERCADO") ||
    valor === "ML" ||
    valor === "MERCADO_LIVRE"
  ) {
    return "MERCADO LIVRE";
  }

  if (valor.includes("SHOPEE")) {
    return "SHOPEE";
  }

  return "AVULSO";
}

function getLat(pacote: Codigo) {
  const valor =
    pacote.latitudeEntrega ??
    pacote.latitude ??
    null;

  if (
    valor === null ||
    valor === undefined
  ) {
    return null;
  }

  const numero = Number(valor);

  return Number.isFinite(numero)
    ? numero
    : null;
}

function getLng(pacote: Codigo) {
  const valor =
    pacote.longitudeEntrega ??
    pacote.longitude ??
    null;

  if (
    valor === null ||
    valor === undefined
  ) {
    return null;
  }

  const numero = Number(valor);

  return Number.isFinite(numero)
    ? numero
    : null;
}

function criarIconeMapa(pacote: Codigo) {
  const tipo = normalizarTipo(pacote.tipo);

  let src = pinAvulso;

  if (
    tipo === "MERCADO LIVRE" ||
    tipo.includes("MERCADO")
  ) {
    src = pinML;
  } else if (
    tipo === "SHOPEE" ||
    tipo.includes("SHOPEE")
  ) {
    src = pinShopee;
  }

  return L.icon({
    iconUrl: src,
    iconSize: [42, 42],
    iconAnchor: [21, 42],
    popupAnchor: [0, -38],
    className: "aguia-custom-pin",
  });
}

function AjustarMapaEmpresa({
  pontos,
}: {
  pontos: {
    pacote: Codigo;
    lat: number;
    lng: number;
  }[];
}) {
  const map = useMap();

  useEffect(() => {
    if (!pontos.length) return;

    if (pontos.length === 1) {
      map.flyTo(
        [pontos[0].lat, pontos[0].lng],
        16,
        { duration: 0.7 }
      );
      return;
    }

    const bounds = L.latLngBounds(
      pontos.map((ponto) =>
        [ponto.lat, ponto.lng] as [number, number]
      )
    );

    map.flyToBounds(bounds.pad(0.12), {
      maxZoom: 17,
      padding: [40, 40],
      duration: 0.7,
    });
  }, [map, pontos]);

  return null;
}

export default function Empresas() {
  const [empresas, setEmpresas] =
    useState<Empresa[]>([]);

  const [usuarios, setUsuarios] =
    useState<Usuario[]>([]);

  const [codigos, setCodigos] =
    useState<Codigo[]>([]);

  const [busca, setBusca] =
    useState("");

  const [
    empresaSelecionada,
    setEmpresaSelecionada,
  ] = useState<Empresa | null>(null);

  const [usuarioAtual, setUsuarioAtual] =
    useState<Usuario | null>(null);

  const [cadastroAberto, setCadastroAberto] =
    useState(false);

  const [empresaEditando, setEmpresaEditando] =
    useState<Empresa | null>(null);

  useEffect(() => {
    const unsubscribe = onSnapshot(
      collection(db, "empresas"),
      (snapshot) => {
        const lista = snapshot.docs.map(
          (item) => ({
            id: item.id,
            ...(item.data() as Omit<Empresa, "id">),
          })
        );

        setEmpresas(lista);
      }
    );

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const unsubscribe = onSnapshot(
      collection(db, "usuarios"),
      (snapshot) => {
        const lista = snapshot.docs.map(
          (item) => ({
            id: item.id,
            ...(item.data() as Omit<Usuario, "id">),
          })
        );

        setUsuarios(lista);

        const email =
          auth.currentUser?.email
            ?.trim()
            .toLowerCase();

        if (email) {
          setUsuarioAtual(
            lista.find(
              (item) =>
                item.id?.toLowerCase() === email ||
                item.uid === auth.currentUser?.uid ||
                item.email?.toLowerCase() === email
            ) || null
          );
        }
      }
    );

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(
      auth,
      (user) => {
        if (!user) {
          setUsuarioAtual(null);
          return;
        }

        const email = user.email?.trim().toLowerCase();

        setUsuarioAtual(() =>
          usuarios.find(
            (item) =>
              item.uid === user.uid ||
              item.id === user.uid ||
              (!!email &&
                (item.id?.toLowerCase() === email ||
                  item.email?.toLowerCase() === email))
          ) || null
        );
      }
    );

    return () => unsubscribe();
  }, [usuarios]);

  useEffect(() => {
    const unsubscribe = onSnapshot(
      collection(db, "controle_codigos"),
      (snapshot) => {
        const lista = snapshot.docs.map(
          (item) => ({
            id: item.id,
            ...(item.data() as Omit<Codigo, "id">),
          })
        );

        setCodigos(lista);
      }
    );

    return () => unsubscribe();
  }, []);

  const isAdmin =
    usuarioAtual?.tipo
      ?.toLowerCase()
      .trim() === "admin";

  const isContaEmpresa =
    usuarioAtual?.tipo
      ?.toLowerCase()
      .trim() === "empresa";

  useEffect(() => {
    if (!isAdmin) {
      setCadastroAberto(false);
      setEmpresaEditando(null);
    }
  }, [isAdmin]);

  const empresasVisiveis = useMemo(() => {
    if (isAdmin) return empresas;

    if (usuarioAtual?.empresaId) {
      return empresas.filter(
        (empresa) =>
          empresa.id === usuarioAtual.empresaId
      );
    }

    return [];
  }, [
    empresas,
    isAdmin,
    usuarioAtual,
  ]);

  const empresaDaConta = useMemo(() => {
    if (isAdmin || !usuarioAtual) {
      return null;
    }

    const empresaId = String(
      usuarioAtual.empresaId ||
        usuarioAtual.empresa ||
        ""
    ).trim();

    const empresaNome = String(
      usuarioAtual.empresaNome || ""
    ).trim().toLowerCase();

    return (
      empresas.find(
        (empresa) =>
          (!!empresaId && empresa.id === empresaId) ||
          (!!empresaNome &&
            String(empresa.nome || "")
              .trim()
              .toLowerCase() === empresaNome)
      ) || null
    );
  }, [
    empresas,
    isAdmin,
    usuarioAtual,
  ]);

  // CONTAS DE EMPRESA ENTRAM DIRETAMENTE NO PAINEL
  useEffect(() => {
    if (!isContaEmpresa || !empresaDaConta) {
      return;
    }

    setEmpresaSelecionada(empresaDaConta);
  }, [
    empresaDaConta,
    isContaEmpresa,
  ]);

  const empresasFiltradas = useMemo(() => {
    const texto =
      busca.trim().toLowerCase();

    if (!texto) {
      return empresasVisiveis;
    }

    return empresasVisiveis.filter(
      (empresa) =>
        `${empresa.nome || ""} ${empresa.id}`
          .toLowerCase()
          .includes(texto)
    );
  }, [
    empresasVisiveis,
    busca,
  ]);

  if (cadastroAberto && isAdmin) {
    return (
      <CadastroEmpresa
        key={empresaEditando?.id || "nova"}
        empresa={empresaEditando}
        usuarios={usuarios}
        onCancelar={() => {
          setCadastroAberto(false);
          setEmpresaEditando(null);
        }}
        onSalvo={() => {
          setCadastroAberto(false);
          setEmpresaEditando(null);
        }}
      />
    );
  }

  if (empresaSelecionada) {
    return (
      <PainelEmpresa
        empresa={empresaSelecionada}
        codigos={codigos}
        usuarios={usuarios}
        podeEditar={isAdmin}
        onVoltar={() =>
          setEmpresaSelecionada(null)
        }
        onEditar={() => {
          if (!isAdmin) return;
          setEmpresaEditando(empresaSelecionada);
          setEmpresaSelecionada(null);
          setCadastroAberto(true);
        }}
      />
    );
  }

  return (
    <div>
      <PageHeader
        title="Empresas"
        subtitle={`${empresasVisiveis.length} empresa(s)`}
      />

      <section className="card">
        <div
          style={{
            display: "flex",
            gap: 10,
            flexWrap: "wrap",
            alignItems: "center",
            marginBottom: 18,
          }}
        >
          <div
            className="search"
            style={{
              flex: "1 1 280px",
            }}
          >
            <Search size={17} />

            <input
              value={busca}
              onChange={(e) =>
                setBusca(e.target.value)
              }
              placeholder="Buscar empresa..."
            />
          </div>

          {isAdmin && (
            <button
              type="button"
              className="primary"
              onClick={() => {
                setEmpresaEditando(null);
                setCadastroAberto(true);
              }}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 8,
              }}
            >
              <Building2 size={17} />
              Nova empresa
            </button>
          )}

        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns:
              "repeat(auto-fit,minmax(250px,1fr))",
            gap: 12,
          }}
        >
          {empresasFiltradas.map(
            (empresa) => {
              const pastas =
                (empresa.pastas || []).slice(
                  0,
                  LIMITE_PASTAS
                );

              const total =
                codigos.filter((codigo) =>
                  pastas.includes(
                    String(codigo.empresa || "")
                  )
                ).length;

              return (
                <button
                  key={empresa.id}
                  type="button"
                  onClick={() =>
                    setEmpresaSelecionada(
                      empresa
                    )
                  }
                  style={{
                    width: "100%",
                    display: "flex",
                    alignItems: "center",
                    gap: 14,
                    padding: 16,
                    background: "#fff",
                    border:
                      "1px solid #e5e7eb",
                    borderRadius: 14,
                    cursor: "pointer",
                    textAlign: "left",
                  }}
                >
                  <Building2
                    color="#c9a227"
                    size={26}
                  />

                  <div
                    style={{
                      flex: 1,
                      minWidth: 0,
                    }}
                  >
                    <strong
                      style={{
                        color: "#111827",
                      }}
                    >
                      {empresa.nome ||
                        empresa.id}
                    </strong>

                    <div
                      style={{
                        color: "#6b7280",
                        fontSize: 13,
                        marginTop: 4,
                      }}
                    >
                      {pastas.length} pasta(s)
                      {" · "}
                      {total} pacote(s)
                    </div>
                  </div>

                  <ChevronRight
                    color="#9ca3af"
                  />
                </button>
              );
            }
          )}

          {!empresasFiltradas.length && (
            <div
              style={{
                padding: 35,
                textAlign: "center",
                color: "#6b7280",
              }}
            >
              Nenhuma empresa encontrada.
            </div>
          )}
        </div>
      </section>
    </div>
  );
}

type PastaCadastro = {
  id: string;
  nome?: string;
};

function valorInicialEmpresa(valor: number | undefined) {
  return typeof valor === "number"
    ? valor.toFixed(2)
    : "0.00";
}

function CampoCadastro({
  label,
  value,
  onChange,
  type = "text",
  required = false,
  placeholder,
  step,
  min,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  required?: boolean;
  placeholder?: string;
  step?: string;
  min?: string;
}) {
  return (
    <label
      style={{
        display: "grid",
        gap: 6,
        color: "#334155",
        fontSize: 13,
        fontWeight: 700,
      }}
    >
      {label}
      <input
        type={type}
        value={value}
        required={required}
        placeholder={placeholder}
        step={step}
        min={min}
        onChange={(event) =>
          onChange(event.target.value)
        }
        style={{
          width: "100%",
          boxSizing: "border-box",
          minHeight: 42,
          padding: "10px 12px",
          border: "1px solid #dbe2ea",
          borderRadius: 9,
          background: "#fff",
          color: "#17202d",
          fontSize: 14,
        }}
      />
    </label>
  );
}

function CadastroEmpresa({
  empresa,
  usuarios,
  onCancelar,
  onSalvo,
}: {
  empresa: Empresa | null;
  usuarios: Usuario[];
  onCancelar: () => void;
  onSalvo: () => void;
}) {
  const [nome, setNome] = useState(
    empresa?.nome || ""
  );
  const [valorML, setValorML] = useState(
    valorInicialEmpresa(empresa?.valorML)
  );
  const [valorShopee, setValorShopee] = useState(
    valorInicialEmpresa(empresa?.valorShopee)
  );
  const [valorAvulso, setValorAvulso] = useState(
    valorInicialEmpresa(empresa?.valorAvulso)
  );
  const [sistema, setSistema] = useState(
    empresa?.sistema || ""
  );
  const [login, setLogin] = useState(
    empresa?.login || ""
  );
  const [senha, setSenha] = useState(
    empresa?.senha || ""
  );
  const [observacoes, setObservacoes] = useState(
    empresa?.observacoes || ""
  );
  const [pastas, setPastas] = useState<string[]>(
    empresa?.pastas || []
  );
  const [pastasDisponiveis, setPastasDisponiveis] =
    useState<PastaCadastro[]>([]);
  const [appLogin, setAppLogin] = useState("");
  const [appSenha, setAppSenha] = useState("");
  const [mostrarSenha, setMostrarSenha] =
    useState(false);
  const [mostrarSenhaApp, setMostrarSenhaApp] =
    useState(false);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState("");

  const usuarioVinculado = useMemo(
    () =>
      empresa
        ? usuarios.find(
            (usuario) =>
              usuario.empresaId === empresa.id
          ) || null
        : null,
    [empresa, usuarios]
  );

  useEffect(() => {
    const unsubscribe = onSnapshot(
      collection(db, "coletas"),
      (snapshot) => {
        setPastasDisponiveis(
          snapshot.docs
            .map((item) => ({
              id: item.id,
              ...(item.data() as Omit<
                PastaCadastro,
                "id"
              >),
            }))
            .sort((a, b) =>
              String(a.nome || a.id).localeCompare(
                String(b.nome || b.id)
              )
            )
        );
      },
      () => setPastasDisponiveis([])
    );

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!usuarioVinculado) return;

    setAppLogin(
      usuarioVinculado.email ||
        usuarioVinculado.id ||
        ""
    );
  }, [usuarioVinculado]);

  function alternarPasta(pastaId: string) {
    setPastas((atuais) =>
      atuais.includes(pastaId)
        ? atuais.filter((id) => id !== pastaId)
        : [...atuais, pastaId]
    );
  }

  async function criarOuSincronizarAcesso(
    empresaId: string,
    empresaNome: string
  ) {
    const email = appLogin.trim().toLowerCase();
    const senhaAcesso = appSenha.trim();

    if (!email) return;

    if (usuarioVinculado) {
      await updateDoc(
        doc(db, "usuarios", usuarioVinculado.id),
        {
          empresaNome,
          nome: empresaNome,
        }
      );
      return;
    }

    // O segundo app mantém a sessão do administrador ativa
    // enquanto o acesso da empresa é criado no Firebase Auth.
    if (!senhaAcesso) return;

    const appSecundario = initializeApp(
      auth.app.options,
      `cadastro-empresa-${Date.now()}`
    );

    try {
      const authSecundario = getAuth(
        appSecundario
      );
      const credencial =
        await createUserWithEmailAndPassword(
          authSecundario,
          email,
          senhaAcesso
        );

      await setDoc(doc(db, "usuarios", email), {
        email,
        uid: credencial.user.uid,
        nome: empresaNome,
        tipo: "empresa",
        empresaId,
        empresaNome,
        permissoes: {
          pacotes: true,
          dashboard: true,
        },
        dataCriacao: serverTimestamp(),
      });
    } finally {
      await deleteApp(appSecundario);
    }
  }

  async function salvar(event: FormEvent) {
    event.preventDefault();
    setErro("");

    const nomeEmpresa = nome.trim().toUpperCase();

    if (!nomeEmpresa) {
      setErro("Informe o nome da empresa.");
      return;
    }

    setSalvando(true);

    try {
      const dados = {
        nome: nomeEmpresa,
        valorML:
          Number(valorML.replace(",", ".")) || 0,
        valorShopee:
          Number(valorShopee.replace(",", ".")) || 0,
        valorAvulso:
          Number(valorAvulso.replace(",", ".")) || 0,
        sistema: sistema.trim(),
        login: login.trim(),
        senha,
        observacoes: observacoes.trim(),
        pastas,
        ativo: true,
      };

      let empresaId = empresa?.id || "";

      if (empresa) {
        await updateDoc(
          doc(db, "empresas", empresa.id),
          dados
        );
      } else {
        const referencia = await addDoc(
          collection(db, "empresas"),
          {
            ...dados,
            criadoEm: serverTimestamp(),
          }
        );
        empresaId = referencia.id;
      }

      await criarOuSincronizarAcesso(
        empresaId,
        nomeEmpresa
      );

      onSalvo();
    } catch (error) {
      const mensagem =
        error instanceof Error
          ? error.message
          : "Não foi possível salvar a empresa.";
      setErro(`Erro ao salvar: ${mensagem}`);
    } finally {
      setSalvando(false);
    }
  }

  return (
    <div>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 12,
          marginBottom: 18,
          flexWrap: "wrap",
        }}
      >
        <button
          type="button"
          className="secondary"
          onClick={onCancelar}
        >
          <ArrowLeft size={17} />
          Voltar
        </button>

        <div>
          <h2
            style={{
              margin: 0,
              color: "#111827",
            }}
          >
            {empresa
              ? "Editar empresa"
              : "Nova empresa"}
          </h2>
          <small style={{ color: "#6b7280" }}>
            Este cadastro é exclusivo para administradores.
          </small>
        </div>
      </div>

      <form onSubmit={salvar}>
        <section className="card">
          <h3
            style={{
              margin: "0 0 14px",
              color: "#9a7209",
              fontSize: 13,
              letterSpacing: ".06em",
            }}
          >
            🏢 IDENTIFICAÇÃO
          </h3>

          <CampoCadastro
            label="Nome da empresa"
            value={nome}
            onChange={setNome}
            required
            placeholder="Nome da empresa"
          />
        </section>

        <section
          className="card"
          style={{ marginTop: 16 }}
        >
          <h3
            style={{
              margin: "0 0 14px",
              color: "#9a7209",
              fontSize: 13,
              letterSpacing: ".06em",
            }}
          >
            💰 VALORES POR PACOTE
          </h3>

          <div
            style={{
              display: "grid",
              gridTemplateColumns:
                "repeat(auto-fit,minmax(190px,1fr))",
              gap: 12,
            }}
          >
            <CampoCadastro
              label="Mercado Livre (R$)"
              value={valorML}
              onChange={setValorML}
              type="number"
              step="0.01"
              min="0"
            />
            <CampoCadastro
              label="Shopee (R$)"
              value={valorShopee}
              onChange={setValorShopee}
              type="number"
              step="0.01"
              min="0"
            />
            <CampoCadastro
              label="Avulso (R$)"
              value={valorAvulso}
              onChange={setValorAvulso}
              type="number"
              step="0.01"
              min="0"
            />
          </div>
        </section>

        <section
          className="card"
          style={{ marginTop: 16 }}
        >
          <h3
            style={{
              margin: "0 0 8px",
              color: "#9a7209",
              fontSize: 13,
              letterSpacing: ".06em",
            }}
          >
            📁 PASTAS DA EMPRESA
          </h3>
          <p
            style={{
              margin: "0 0 14px",
              color: "#64748b",
              fontSize: 12,
            }}
          >
            Selecione as pastas (coletas) que pertencem
            a essa empresa.
          </p>

          <div
            style={{
              display: "grid",
              gap: 8,
            }}
          >
            {pastasDisponiveis.map((pasta) => {
              const selecionada = pastas.includes(
                pasta.id
              );

              return (
                <label
                  key={pasta.id}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    padding: "10px 12px",
                    borderRadius: 9,
                    border: `1px solid ${
                      selecionada
                        ? "#c9a227"
                        : "#e5e7eb"
                    }`,
                    background: selecionada
                      ? "#fffaf0"
                      : "#fff",
                    cursor: "pointer",
                  }}
                >
                  <input
                    type="checkbox"
                    checked={selecionada}
                    onChange={() =>
                      alternarPasta(pasta.id)
                    }
                  />
                  <span
                    style={{
                      color: "#17202d",
                      fontWeight: selecionada
                        ? 700
                        : 500,
                    }}
                  >
                    {pasta.nome || pasta.id}
                  </span>
                  <small
                    style={{
                      marginLeft: "auto",
                      color: "#94a3b8",
                    }}
                  >
                    ID: {pasta.id}
                  </small>
                </label>
              );
            })}

            {!pastasDisponiveis.length && (
              <div
                style={{
                  padding: 16,
                  color: "#64748b",
                  background: "#f8fafc",
                  borderRadius: 9,
                }}
              >
                Nenhuma pasta encontrada na coleção
                coletas.
              </div>
            )}
          </div>

          {pastas.length > 0 && (
            <small
              style={{
                display: "block",
                marginTop: 12,
                color: "#9a7209",
                fontWeight: 800,
              }}
            >
              {pastas.length} pasta(s)
              selecionada(s)
            </small>
          )}
        </section>

        <section
          className="card"
          style={{ marginTop: 16 }}
        >
          <h3
            style={{
              margin: "0 0 14px",
              color: "#9a7209",
              fontSize: 13,
              letterSpacing: ".06em",
            }}
          >
            🖥️ SISTEMA DE RASTREIO
          </h3>

          <div
            style={{
              display: "grid",
              gap: 12,
            }}
          >
            <CampoCadastro
              label="Sistema utilizado (ex: Tracken)"
              value={sistema}
              onChange={setSistema}
            />
            <CampoCadastro
              label="Login / e-mail do sistema"
              value={login}
              onChange={setLogin}
              type="email"
            />
            <label
              style={{
                display: "grid",
                gap: 6,
                color: "#334155",
                fontSize: 13,
                fontWeight: 700,
              }}
            >
              Senha do sistema
              <div
                style={{
                  display: "flex",
                  gap: 8,
                }}
              >
                <input
                  type={mostrarSenha ? "text" : "password"}
                  value={senha}
                  onChange={(event) =>
                    setSenha(event.target.value)
                  }
                  style={{
                    flex: 1,
                    minWidth: 0,
                    minHeight: 42,
                    boxSizing: "border-box",
                    padding: "10px 12px",
                    border: "1px solid #dbe2ea",
                    borderRadius: 9,
                    color: "#17202d",
                    background: "#fff",
                  }}
                />
                <button
                  type="button"
                  className="secondary"
                  onClick={() =>
                    setMostrarSenha((atual) => !atual)
                  }
                  aria-label={
                    mostrarSenha
                      ? "Ocultar senha"
                      : "Mostrar senha"
                  }
                >
                  {mostrarSenha ? "Ocultar" : "Ver"}
                </button>
              </div>
            </label>
          </div>
        </section>

        <section
          className="card"
          style={{ marginTop: 16 }}
        >
          <h3
            style={{
              margin: "0 0 8px",
              color: "#9a7209",
              fontSize: 13,
              letterSpacing: ".06em",
            }}
          >
            🔐 ACESSO DA EMPRESA AO APP
          </h3>
          <p
            style={{
              margin: "0 0 14px",
              color: "#64748b",
              fontSize: 12,
            }}
          >
            Crie um acesso próprio para a empresa
            acompanhar os pacotes dela no app.
          </p>

          {usuarioVinculado && (
            <div
              style={{
                marginBottom: 12,
                padding: 10,
                color: "#166534",
                background: "#f0fdf4",
                border: "1px solid #bbf7d0",
                borderRadius: 9,
                fontSize: 12,
                fontWeight: 700,
              }}
            >
              ✓ Login já criado:{" "}
              {usuarioVinculado.email ||
                usuarioVinculado.id}
            </div>
          )}

          <div
            style={{
              display: "grid",
              gridTemplateColumns:
                "repeat(auto-fit,minmax(220px,1fr))",
              gap: 12,
            }}
          >
            <CampoCadastro
              label="E-mail de acesso da empresa"
              value={appLogin}
              onChange={setAppLogin}
              type="email"
            />
            <label
              style={{
                display: "grid",
                gap: 6,
                color: "#334155",
                fontSize: 13,
                fontWeight: 700,
              }}
            >
              {usuarioVinculado
                ? "Senha (login já criado)"
                : "Senha de acesso da empresa"}
              <div
                style={{
                  display: "flex",
                  gap: 8,
                }}
              >
                <input
                  type={
                    mostrarSenhaApp
                      ? "text"
                      : "password"
                  }
                  value={appSenha}
                  onChange={(event) =>
                    setAppSenha(event.target.value)
                  }
                  disabled={!!usuarioVinculado}
                  style={{
                    flex: 1,
                    minWidth: 0,
                    minHeight: 42,
                    boxSizing: "border-box",
                    padding: "10px 12px",
                    border: "1px solid #dbe2ea",
                    borderRadius: 9,
                    color: "#17202d",
                    background: usuarioVinculado
                      ? "#f1f5f9"
                      : "#fff",
                  }}
                />
                <button
                  type="button"
                  className="secondary"
                  onClick={() =>
                    setMostrarSenhaApp(
                      (atual) => !atual
                    )
                  }
                  aria-label={
                    mostrarSenhaApp
                      ? "Ocultar senha"
                      : "Mostrar senha"
                  }
                >
                  {mostrarSenhaApp ? "Ocultar" : "Ver"}
                </button>
              </div>
            </label>
          </div>
        </section>

        <section
          className="card"
          style={{ marginTop: 16 }}
        >
          <h3
            style={{
              margin: "0 0 14px",
              color: "#9a7209",
              fontSize: 13,
              letterSpacing: ".06em",
            }}
          >
            📝 OBSERVAÇÕES
          </h3>
          <textarea
            value={observacoes}
            onChange={(event) =>
              setObservacoes(event.target.value)
            }
            rows={4}
            placeholder="Anotações livres..."
            style={{
              width: "100%",
              boxSizing: "border-box",
              resize: "vertical",
              padding: 12,
              border: "1px solid #dbe2ea",
              borderRadius: 9,
              color: "#17202d",
              background: "#fff",
              fontFamily: "inherit",
              fontSize: 14,
            }}
          />
        </section>

        {erro && (
          <div
            role="alert"
            style={{
              marginTop: 16,
              padding: 12,
              color: "#991b1b",
              background: "#fef2f2",
              border: "1px solid #fecaca",
              borderRadius: 9,
              fontSize: 13,
            }}
          >
            {erro}
          </div>
        )}

        <div
          style={{
            display: "flex",
            justifyContent: "flex-end",
            gap: 10,
            marginTop: 18,
            marginBottom: 30,
            flexWrap: "wrap",
          }}
        >
          <button
            type="button"
            className="secondary"
            onClick={onCancelar}
            disabled={salvando}
          >
            Cancelar
          </button>
          <button
            type="submit"
            className="primary"
            disabled={salvando}
          >
            {salvando
              ? "Salvando..."
              : empresa
                ? "Salvar alterações"
                : "Salvar empresa"}
          </button>
        </div>
      </form>
    </div>
  );
}

function PainelEmpresa({
  empresa,
  codigos,
  usuarios,
  podeEditar,
  onVoltar,
  onEditar,
}: {
  empresa: Empresa;
  codigos: Codigo[];
  usuarios: Usuario[];
  podeEditar: boolean;
  onVoltar: () => void;
  onEditar: () => void;
}) {
  const [filtro, setFiltro] =
    useState<Filtro>("hoje");

  const [dataInicio, setDataInicio] =
    useState("");

  const [dataFim, setDataFim] =
    useState("");

  const [telaAberta, setTelaAberta] =
    useState<TelaAberta>(null);

  const [
    statusSelecionado,
    setStatusSelecionado,
  ] = useState<Status | null>(null);

  const [
    usuarioSelecionado,
    setUsuarioSelecionado,
  ] = useState<string | null>(null);

  const [
    pacoteComprovante,
    setPacoteComprovante,
  ] = useState<Codigo | null>(null);

  const pastas = useMemo(
    () =>
      (empresa.pastas || []).slice(
        0,
        LIMITE_PASTAS
      ),
    [empresa]
  );

  const periodo = useMemo(() => {
    const agora = new Date();

    if (filtro === "hoje") {
      const inicio = new Date(
        agora.getFullYear(),
        agora.getMonth(),
        agora.getDate(),
        0,
        0,
        0
      );

      const fim = new Date(
        agora.getFullYear(),
        agora.getMonth(),
        agora.getDate(),
        23,
        59,
        59,
        999
      );

      return { inicio, fim };
    }

    if (filtro === "ontem") {
      const ontem = new Date(agora);
      ontem.setDate(
        ontem.getDate() - 1
      );

      const inicio = new Date(
        ontem.getFullYear(),
        ontem.getMonth(),
        ontem.getDate(),
        0,
        0,
        0
      );

      const fim = new Date(
        ontem.getFullYear(),
        ontem.getMonth(),
        ontem.getDate(),
        23,
        59,
        59,
        999
      );

      return { inicio, fim };
    }

    if (filtro === "ultimos7") {
      const inicio = new Date();
      inicio.setDate(
        inicio.getDate() - 6
      );
      inicio.setHours(0, 0, 0, 0);

      const fim = new Date();
      fim.setHours(
        23,
        59,
        59,
        999
      );

      return { inicio, fim };
    }

    return {
      inicio: dataInicio
        ? new Date(
            `${dataInicio}T00:00:00`
          )
        : new Date(2000, 0, 1),

      fim: dataFim
        ? new Date(
            `${dataFim}T23:59:59`
          )
        : new Date(),
    };
  }, [
    filtro,
    dataInicio,
    dataFim,
  ]);

  const pacotes = useMemo(() => {
    return codigos.filter((codigo) => {
      if (
        !pastas.includes(
          String(codigo.empresa || "")
        )
      ) {
        return false;
      }

      const data =
        dataFirebase(
          codigo.dataHoraBaixa
        ) ||
        dataFirebase(codigo.data);

      if (!data) return false;

      return (
        data >= periodo.inicio &&
        data <= periodo.fim
      );
    });
  }, [
    codigos,
    pastas,
    periodo,
  ]);

  const contagem = useMemo(() => {
    const resultado: Record<
      Status,
      number
    > = {
      COLETADO: 0,
      ROTA: 0,
      ENTREGUE: 0,
      AUSENTE: 0,
      DEVOLVIDO: 0,
    };

    pacotes.forEach((pacote) => {
      const status = String(
        pacote.status || ""
      ).toUpperCase() as Status;

      if (status in resultado) {
        resultado[status]++;
      }
    });

    return resultado;
  }, [pacotes]);

  const porUsuario = useMemo(() => {
    const resultado: Record<
      string,
      {
        rota: number;
        ausente: number;
        pacotes: Codigo[];
      }
    > = {};

    pacotes.forEach((pacote) => {
      const status = String(
        pacote.status || ""
      ).toUpperCase();

      if (
        status !== "ROTA" &&
        status !== "AUSENTE"
      ) {
        return;
      }

      const usuario = String(
        pacote.usuarioFinalizacao ||
          pacote.usuario ||
          "SEM_USUARIO"
      );

      if (!resultado[usuario]) {
        resultado[usuario] = {
          rota: 0,
          ausente: 0,
          pacotes: [],
        };
      }

      if (status === "ROTA") {
        resultado[usuario].rota++;
      }

      if (status === "AUSENTE") {
        resultado[usuario].ausente++;
      }

      resultado[usuario].pacotes.push(
        pacote
      );
    });

    return Object.entries(resultado)
      .map(([usuario, dados]) => ({
        usuario,
        ...dados,
      }))
      .sort(
        (a, b) =>
          b.pacotes.length -
          a.pacotes.length
      );
  }, [pacotes]);

  const tipos = useMemo(() => {
    const resultado = {
      "MERCADO LIVRE": {
        total: 0,
        finalizado: 0,
      },
      SHOPEE: {
        total: 0,
        finalizado: 0,
      },
      AVULSO: {
        total: 0,
        finalizado: 0,
      },
    };

    pacotes.forEach((pacote) => {
      const tipo = normalizarTipo(
        pacote.tipo
      ) as keyof typeof resultado;

      resultado[tipo].total++;

      const status = String(
        pacote.status || ""
      ).toUpperCase();

      if (
        status === "ENTREGUE" ||
        status === "AUSENTE" ||
        status === "DEVOLVIDO"
      ) {
        resultado[tipo].finalizado++;
      }
    });

    return resultado;
  }, [pacotes]);

  const pacotesMapa = useMemo(
    () =>
      pacotes.filter(
        (pacote) =>
          getLat(pacote) !== null &&
          getLng(pacote) !== null
      ),
    [pacotes]
  );

  function nomeUsuario(id: string) {
    if (id === "SEM_USUARIO") {
      return "Sem usuário";
    }

    const usuario = usuarios.find(
      (item) => item.id === id
    );

    return usuario?.nome || id;
  }

  const pacotesStatus = useMemo(() => {
    if (!statusSelecionado) {
      return [];
    }

    return pacotes.filter(
      (pacote) =>
        String(
          pacote.status || ""
        ).toUpperCase() ===
        statusSelecionado
    );
  }, [
    pacotes,
    statusSelecionado,
  ]);

  const percentualEntregue =
    pacotes.length > 0
      ? Math.round(
          (contagem.ENTREGUE /
            pacotes.length) *
            100
        )
      : 0;

  return (
    <div>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 12,
          marginBottom: 18,
          flexWrap: "wrap",
        }}
      >
        <button
          type="button"
          className="secondary"
          onClick={onVoltar}
        >
          <ArrowLeft size={17} />
          Voltar
        </button>

        <div>
          <h2
            style={{
              margin: 0,
              color: "#111827",
            }}
          >
            {empresa.nome || empresa.id}
          </h2>

          <small
            style={{
              color: "#6b7280",
            }}
          >
            Painel da empresa
          </small>
        </div>

          {podeEditar && (
            <button
              type="button"
              className="primary"
              onClick={onEditar}
              style={{
                marginLeft: "auto",
              }}
            >
              Editar empresa
            </button>
          )}
      </div>

      <section
        className="card"
        style={{
          marginBottom: 16,
        }}
      >
        <div
          style={{
            display: "flex",
            gap: 10,
            flexWrap: "wrap",
            alignItems: "center",
          }}
        >
          {[
            ["hoje", "Hoje"],
            ["ontem", "Ontem"],
            ["ultimos7", "Últimos 7 dias"],
            ["personalizado", "Personalizado"],
          ].map(([key, label]) => (
            <button
              key={key}
              type="button"
              className={
                filtro === key
                  ? "primary"
                  : "secondary"
              }
              onClick={() =>
                setFiltro(
                  key as Filtro
                )
              }
            >
              {label}
            </button>
          ))}
        </div>

        {filtro === "personalizado" && (
          <div
            style={{
              display: "flex",
              gap: 10,
              flexWrap: "wrap",
              marginTop: 14,
            }}
          >
            <label>
              <small>Data inicial</small>
              <input
                type="date"
                value={dataInicio}
                onChange={(e) =>
                  setDataInicio(
                    e.target.value
                  )
                }
              />
            </label>

            <label>
              <small>Data final</small>
              <input
                type="date"
                value={dataFim}
                onChange={(e) =>
                  setDataFim(
                    e.target.value
                  )
                }
              />
            </label>
          </div>
        )}
      </section>

      <div
        style={{
          display: "grid",
          gridTemplateColumns:
            "repeat(auto-fit,minmax(150px,1fr))",
          gap: 12,
          marginBottom: 16,
        }}
      >
        <div
          className="card"
          style={{
            padding: 16,
          }}
        >
          <small
            style={{
              color: "#64748b",
            }}
          >
            TOTAL
          </small>

          <h2
            style={{
              margin: "8px 0 0",
            }}
          >
            {pacotes.length}
          </h2>
        </div>

        <div
          className="card"
          style={{
            padding: 16,
          }}
        >
          <small
            style={{
              color: "#64748b",
            }}
          >
            ENTREGUES
          </small>

          <h2
            style={{
              margin: "8px 0 0",
              color: "#16a34a",
            }}
          >
            {contagem.ENTREGUE}
          </h2>
        </div>

        <div
          className="card"
          style={{
            padding: 16,
          }}
        >
          <small
            style={{
              color: "#64748b",
            }}
          >
            % ENTREGUE
          </small>

          <h2
            style={{
              margin: "8px 0 0",
              color: "#2563eb",
            }}
          >
            {percentualEntregue}%
          </h2>
        </div>

        <div
          className="card"
          style={{
            padding: 16,
          }}
        >
          <small
            style={{
              color: "#64748b",
            }}
          >
            AUSENTES
          </small>

          <h2
            style={{
              margin: "8px 0 0",
              color: "#ea580c",
            }}
          >
            {contagem.AUSENTE}
          </h2>
        </div>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns:
            "repeat(auto-fit,minmax(170px,1fr))",
          gap: 12,
          marginBottom: 16,
        }}
      >
        {STATUS.map((item) => (
          <button
            key={item.key}
            type="button"
            onClick={() => {
              setStatusSelecionado(
                item.key
              );
              setTelaAberta("STATUS");
              setUsuarioSelecionado(null);
            }}
            style={{
              border:
                "1px solid #e5e7eb",
              background: "#fff",
              borderRadius: 14,
              padding: 16,
              cursor: "pointer",
              textAlign: "left",
              borderLeft: `5px solid ${item.color}`,
            }}
          >
            <small
              style={{
                color: "#64748b",
              }}
            >
              {item.label}
            </small>

            <strong
              style={{
                display: "block",
                fontSize: 25,
                marginTop: 6,
                color: item.color,
              }}
            >
              {contagem[item.key]}
            </strong>
          </button>
        ))}
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns:
            "repeat(auto-fit,minmax(220px,1fr))",
          gap: 12,
          marginBottom: 16,
        }}
      >
        {Object.entries(tipos).map(
          ([tipo, dados]) => (
            <div
              key={tipo}
              className="card"
              style={{
                padding: 16,
              }}
            >
              <strong
                style={{
                  color: "#111827",
                }}
              >
                {tipo}
              </strong>

              <div
                style={{
                  color: "#64748b",
                  fontSize: 13,
                  marginTop: 8,
                }}
              >
                Finalizado{" "}
                {dados.finalizado} de{" "}
                {dados.total}
              </div>

              <div
                style={{
                  marginTop: 10,
                  height: 7,
                  borderRadius: 10,
                  background: "#e5e7eb",
                  overflow: "hidden",
                }}
              >
                <div
                  style={{
                    width: `${
                      dados.total
                        ? (
                            dados.finalizado /
                            dados.total
                          ) *
                          100
                        : 0
                    }%`,
                    height: "100%",
                    background: "#c9a227",
                  }}
                />
              </div>
            </div>
          )
        )}
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns:
            "repeat(auto-fit,minmax(250px,1fr))",
          gap: 12,
        }}
      >
        <button
          type="button"
          onClick={() => {
            setTelaAberta(
              telaAberta === "ATENCAO"
                ? null
                : "ATENCAO"
            );
            setUsuarioSelecionado(null);
          }}
          style={{
            border:
              "1px solid #e5e7eb",
            background: "#fff",
            borderRadius: 14,
            padding: 18,
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            gap: 12,
            textAlign: "left",
          }}
        >
          <Truck
            size={24}
            color="#2563eb"
          />

          <div>
            <strong
              style={{
                color: "#111827",
              }}
            >
              Rota e ausentes
            </strong>

            <small
              style={{
                display: "block",
                color: "#6b7280",
                marginTop: 4,
              }}
            >
              Ver por entregador
            </small>
          </div>
        </button>

        <button
          type="button"
          onClick={() => {
            setTelaAberta(
              telaAberta === "MAPA"
                ? null
                : "MAPA"
            );
          }}
          style={{
            border:
              "1px solid #e5e7eb",
            background: "#fff",
            borderRadius: 14,
            padding: 18,
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            gap: 12,
            textAlign: "left",
          }}
        >
          <Map
            size={24}
            color="#16a34a"
          />

          <div>
            <strong
              style={{
                color: "#111827",
              }}
            >
              Mapa
            </strong>

            <small
              style={{
                display: "block",
                color: "#6b7280",
                marginTop: 4,
              }}
            >
              {pacotesMapa.length} pacote(s)
              com localização
            </small>
          </div>
        </button>
      </div>

      {telaAberta && (
        <section
          className="card"
          style={{
            marginTop: 16,
          }}
        >
          {telaAberta === "STATUS" &&
            statusSelecionado && (
              <>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent:
                      "space-between",
                    gap: 10,
                    flexWrap: "wrap",
                    marginBottom: 16,
                  }}
                >
                  <div>
                    <h3
                      style={{
                        margin: 0,
                        color: "#111827",
                      }}
                    >
                      {
                        STATUS.find(
                          (item) =>
                            item.key ===
                            statusSelecionado
                        )?.label
                      }
                    </h3>

                    <small
                      style={{
                        color: "#6b7280",
                      }}
                    >
                      {
                        pacotesStatus.length
                      } pacote(s)
                    </small>
                  </div>

                  <button
                    className="secondary"
                    onClick={() =>
                      setTelaAberta(null)
                    }
                  >
                    Fechar
                  </button>
                </div>

                <TabelaPacotes
                  pacotes={pacotesStatus}
                  usuarios={usuarios}
                  onAbrir={
                    setPacoteComprovante
                  }
                />
              </>
            )}

          {telaAberta === "ATENCAO" && (
            <>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent:
                    "space-between",
                  gap: 10,
                  flexWrap: "wrap",
                  marginBottom: 16,
                }}
              >
                <div>
                  <h3
                    style={{
                      margin: 0,
                      color: "#111827",
                    }}
                  >
                    Rota e ausentes
                  </h3>

                  <small
                    style={{
                      color: "#6b7280",
                    }}
                  >
                    Agrupado por entregador
                  </small>
                </div>

                <button
                  className="secondary"
                  onClick={() => {
                    setTelaAberta(null);
                    setUsuarioSelecionado(null);
                  }}
                >
                  Fechar
                </button>
              </div>

              {!usuarioSelecionado ? (
                <div
                  style={{
                    display: "grid",
                    gap: 10,
                  }}
                >
                  {porUsuario.map(
                    (item) => (
                      <button
                        key={item.usuario}
                        type="button"
                        onClick={() =>
                          setUsuarioSelecionado(
                            item.usuario
                          )
                        }
                        style={{
                          width: "100%",
                          display: "flex",
                          justifyContent:
                            "space-between",
                          alignItems:
                            "center",
                          gap: 12,
                          flexWrap: "wrap",
                          padding: 16,
                          background: "#fff",
                          border:
                            "1px solid #e5e7eb",
                          borderRadius: 12,
                          cursor: "pointer",
                          textAlign: "left",
                        }}
                      >
                        <div>
                          <strong
                            style={{
                              color: "#111827",
                            }}
                          >
                            {nomeUsuario(
                              item.usuario
                            )}
                          </strong>

                          <div
                            style={{
                              color: "#6b7280",
                              marginTop: 5,
                              fontSize: 13,
                            }}
                          >
                            {
                              item.pacotes
                                .length
                            }{" "}
                            pacote(s)
                          </div>
                        </div>

                        <div
                          style={{
                            display: "flex",
                            gap: 10,
                            flexWrap: "wrap",
                          }}
                        >
                          <span
                            style={{
                              background:
                                "#eff6ff",
                              color:
                                "#2563eb",
                              padding:
                                "6px 10px",
                              borderRadius: 8,
                              fontSize: 13,
                              fontWeight: 700,
                            }}
                          >
                            Rota: {item.rota}
                          </span>

                          <span
                            style={{
                              background:
                                "#fff7ed",
                              color:
                                "#ea580c",
                              padding:
                                "6px 10px",
                              borderRadius: 8,
                              fontSize: 13,
                              fontWeight: 700,
                            }}
                          >
                            Ausente:{" "}
                            {item.ausente}
                          </span>
                        </div>
                      </button>
                    )
                  )}

                  {!porUsuario.length && (
                    <div
                      style={{
                        padding: 30,
                        textAlign: "center",
                        color: "#6b7280",
                      }}
                    >
                      Nenhum pacote em rota ou
                      ausente.
                    </div>
                  )}
                </div>
              ) : (
                <>
                  <button
                    className="secondary"
                    onClick={() =>
                      setUsuarioSelecionado(
                        null
                      )
                    }
                    style={{
                      marginBottom: 16,
                    }}
                  >
                    <ArrowLeft size={16} />
                    Todos os entregadores
                  </button>

                  <TabelaPacotes
                    pacotes={
                      porUsuario.find(
                        (item) =>
                          item.usuario ===
                          usuarioSelecionado
                      )?.pacotes || []
                    }
                    usuarios={usuarios}
                    onAbrir={
                      setPacoteComprovante
                    }
                  />
                </>
              )}
            </>
          )}

          {telaAberta === "MAPA" && (
            <>
              <div
                style={{
                  display: "flex",
                  justifyContent:
                    "space-between",
                  alignItems: "center",
                  gap: 10,
                  marginBottom: 16,
                  flexWrap: "wrap",
                }}
              >
                <div>
                  <h3
                    style={{
                      margin: 0,
                    }}
                  >
                    Mapa dos pacotes
                  </h3>

                  <small
                    style={{
                      color: "#6b7280",
                    }}
                  >
                    Clique no marcador para ver
                    o comprovante.
                  </small>
                </div>

                <button
                  className="secondary"
                  onClick={() =>
                    setTelaAberta(null)
                  }
                >
                  Fechar
                </button>
              </div>

               <MapaInternoLeaflet
                pacotes={pacotesMapa}
                onAbrir={
                  setPacoteComprovante
                }
              />
            </>
          )}
        </section>
      )}

      {pacoteComprovante && (
        <Comprovante
          pacote={pacoteComprovante}
          usuarios={usuarios}
          onFechar={() =>
            setPacoteComprovante(null)
          }
        />
      )}
    </div>
  );
}

function TabelaPacotes({
  pacotes,
  usuarios,
  onAbrir,
}: {
  pacotes: Codigo[];
  usuarios: Usuario[];
  onAbrir?: (pacote: Codigo) => void;
}) {
  const [busca, setBusca] =
    useState("");

  const lista = useMemo(() => {
    const texto =
      busca.toLowerCase().trim();

    if (!texto) return pacotes;

    return pacotes.filter((pacote) =>
      [
        pacote.codigo,
        pacote.id,
        pacote.empresa,
        pacote.status,
        pacote.tipo,
        pacote.usuario,
        pacote.usuarioFinalizacao,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(texto)
    );
  }, [
    pacotes,
    busca,
  ]);

  function nomeUsuario(id: string) {
    if (!id) return "-";

    const usuario = usuarios.find(
      (item) => item.id === id
    );

    return usuario?.nome || id;
  }

  return (
    <div>
      <div
        className="search"
        style={{
          marginBottom: 18,
        }}
      >
        <Search size={18} />

        <input
          value={busca}
          onChange={(e) =>
            setBusca(e.target.value)
          }
          placeholder="Buscar código, status ou entregador..."
        />
      </div>

      <div
        style={{
          overflowX: "auto",
          border:
            "1px solid #e5e7eb",
          borderRadius: 12,
        }}
      >
        <table
          style={{
            width: "100%",
            minWidth: 850,
            borderCollapse: "collapse",
          }}
        >
          <thead>
            <tr
              style={{
                background: "#f9fafb",
              }}
            >
              <th style={thStyle}>
                Código
              </th>
              <th style={thStyle}>
                Pasta
              </th>
              <th style={thStyle}>
                Status
              </th>
              <th style={thStyle}>
                Tipo
              </th>
              <th style={thStyle}>
                Entregador
              </th>
              <th style={thStyle}>
                Data
              </th>
            </tr>
          </thead>

          <tbody>
            {lista.map((pacote) => {
              const usuario = String(
                pacote.usuarioFinalizacao ||
                  pacote.usuario ||
                  ""
              );

              return (
                <tr
                  key={pacote.id}
                  onClick={() =>
                    onAbrir?.(pacote)
                  }
                  style={{
                    cursor: onAbrir
                      ? "pointer"
                      : "default",
                  }}
                >
                  <td style={tdStyle}>
                    <strong>
                      {pacote.codigo ||
                        pacote.id}
                    </strong>
                  </td>

                  <td style={tdStyle}>
                    {pacote.empresa || "-"}
                  </td>

                  <td style={tdStyle}>
                    <span
                      style={{
                        color: corStatus(
                          String(
                            pacote.status || ""
                          )
                        ),
                        fontWeight: 800,
                      }}
                    >
                      {String(
                        pacote.status || "-"
                      ).toUpperCase()}
                    </span>
                  </td>

                  <td style={tdStyle}>
                    {normalizarTipo(
                      pacote.tipo
                    )}
                  </td>

                  <td style={tdStyle}>
                    {nomeUsuario(usuario)}
                  </td>

                  <td style={tdStyle}>
                    {formatarData(
                      pacote.dataHoraBaixa ||
                        pacote.data
                    )}
                  </td>
                </tr>
              );
            })}

            {!lista.length && (
              <tr>
                <td
                  colSpan={6}
                  style={{
                    padding: 30,
                    textAlign: "center",
                    color: "#6b7280",
                  }}
                >
                  Nenhum pacote encontrado.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function MapaInterno({
  pacotes,
  onAbrir,
  compacto = false,
}: {
  pacotes: Codigo[];
  onAbrir?: (pacote: Codigo) => void;
  compacto?: boolean;
}) {
  const [selecionado, setSelecionado] =
    useState<Codigo | null>(null);

  const pontos = pacotes
    .map((pacote) => ({
      pacote,
      lat: getLat(pacote),
      lng: getLng(pacote),
    }))
    .filter(
      (item) =>
        item.lat !== null &&
        item.lng !== null
    ) as {
    pacote: Codigo;
    lat: number;
    lng: number;
  }[];

  const centro = pontos.length
    ? {
        lat:
          pontos.reduce(
            (sum, item) =>
              sum + item.lat,
            0
          ) / pontos.length,
        lng:
          pontos.reduce(
            (sum, item) =>
              sum + item.lng,
            0
          ) / pontos.length,
      }
    : {
        lat: -15.78,
        lng: -47.93,
      };

  const delta =
    pontos.length > 1
      ? Math.max(
          Math.abs(
            Math.max(
              ...pontos.map(
                (item) => item.lat
              )
            ) -
              Math.min(
                ...pontos.map(
                  (item) => item.lat
                )
              )
          ),
          Math.abs(
            Math.max(
              ...pontos.map(
                (item) => item.lng
              )
            ) -
              Math.min(
                ...pontos.map(
                  (item) => item.lng
                )
              )
          ),
          0.03
        )
      : 0.08;

  const bbox =
    `${centro.lng - delta},` +
    `${centro.lat - delta},` +
    `${centro.lng + delta},` +
    `${centro.lat + delta}`;

  return (
    <div>
      <div
        style={{
          position: "relative",
          height: compacto ? 300 : 390,
          overflow: "hidden",
          borderRadius: 14,
          border:
            "1px solid #d1d5db",
          background: "#e8eef2",
        }}
      >
        <iframe
          title="Mapa dos pacotes"
          src={`https://www.openstreetmap.org/export/embed.html?bbox=${encodeURIComponent(
            bbox
          )}&layer=mapnik`}
          style={{
            width: "100%",
            height: "100%",
            border: 0,
          }}
          loading="lazy"
        />

        {pontos.map((item) => {
          const left =
            ((item.lng -
              (centro.lng - delta)) /
              (delta * 2)) *
            100;

          const top =
            (1 -
              (item.lat -
                (centro.lat - delta)) /
                (delta * 2)) *
            100;

          return (
            <button
              key={item.pacote.id}
              type="button"
              title={
                item.pacote.codigo ||
                item.pacote.id
              }
              onClick={() => {
                setSelecionado(
                  item.pacote
                );

                onAbrir?.(
                  item.pacote
                );
              }}
              style={{
                position: "absolute",
                left: `${Math.min(
                  96,
                  Math.max(4, left)
                )}%`,
                top: `${Math.min(
                  94,
                  Math.max(6, top)
                )}%`,
                transform:
                  "translate(-50%,-100%) rotate(-45deg)",
                width: 30,
                height: 30,
                borderRadius:
                  "50% 50% 50% 0",
                transformOrigin:
                  "center",
                border:
                  "3px solid #fff",
                background: corStatus(
                  item.pacote.status || ""
                ),
                boxShadow:
                  "0 3px 10px rgba(15,23,42,.35)",
                color: "#fff",
                display: "grid",
                placeItems: "center",
                cursor: "pointer",
              }}
            >
              <Package
                size={14}
                style={{
                  transform:
                    "rotate(45deg)",
                }}
              />
            </button>
          );
        })}

        {!pontos.length && (
          <div
            style={{
              position: "absolute",
              inset: 0,
              display: "grid",
              placeItems: "center",
              background:
                "rgba(255,255,255,.82)",
              color: "#64748b",
              padding: 20,
              textAlign: "center",
            }}
          >
            Nenhum pacote com localização
            disponível.
          </div>
        )}
      </div>

      {selecionado && (
        <div
          style={{
            marginTop: 16,
            padding: 14,
            background: "#f9fafb",
            borderRadius: 10,
          }}
        >
          Localização selecionada:{" "}
          <strong>
            {selecionado.codigo ||
              selecionado.id}
          </strong>
        </div>
      )}
    </div>
  );
}

function MapaInternoLeaflet({
  pacotes,
  onAbrir,
}: {
  pacotes: Codigo[];
  onAbrir?: (pacote: Codigo) => void;
}) {
  const pontos = useMemo(
    () =>
      pacotes
        .map((pacote) => {
          const lat = getLat(pacote);
          const lng = getLng(pacote);

          return lat !== null && lng !== null
            ? { pacote, lat, lng }
            : null;
        })
        .filter(
          (
            ponto
          ): ponto is {
            pacote: Codigo;
            lat: number;
            lng: number;
          } => ponto !== null
        ),
    [pacotes]
  );

  return (
    <div
      style={{
        position: "relative",
        height: 390,
        overflow: "hidden",
        borderRadius: 14,
        border: "1px solid #d1d5db",
        background: "#e8eef2",
      }}
    >
      <MapContainer
        center={[-23.511, -46.876]}
        zoom={12}
        style={{
          height: "100%",
          width: "100%",
        }}
      >
        <TileLayer
          attribution="&copy; OpenStreetMap contributors &copy; CARTO"
          url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png?key=cb1_2sk6_1_9337bda9074165b27049c045"
          subdomains="abcd"
          maxZoom={20}
        />

        <AjustarMapaEmpresa pontos={pontos} />

        {pontos.map((ponto) => (
          <Marker
            key={ponto.pacote.id}
            position={[ponto.lat, ponto.lng]}
            icon={criarIconeMapa(ponto.pacote)}
          >
            <Popup>
              <div
                style={{
                  display: "grid",
                  gap: 6,
                  minWidth: 180,
                }}
              >
                <strong>
                  {ponto.pacote.codigo ||
                    ponto.pacote.id}
                </strong>

                <span>
                  {normalizarTipo(ponto.pacote.tipo)}
                </span>

                <span
                  style={{
                    color: corStatus(
                      ponto.pacote.status
                    ),
                    fontWeight: 800,
                  }}
                >
                  {String(
                    ponto.pacote.status || "-"
                  ).toUpperCase()}
                </span>

                <span>
                  Empresa: {ponto.pacote.empresa || "-"}
                </span>

                <span>
                  Baixa:{" "}
                  {formatarData(
                    ponto.pacote.dataHoraBaixa ||
                      ponto.pacote.data
                  )}
                </span>

                {onAbrir && (
                  <button
                    type="button"
                    className="secondary"
                    onClick={() =>
                      onAbrir(ponto.pacote)
                    }
                  >
                    Ver comprovante
                  </button>
                )}
              </div>
            </Popup>
          </Marker>
        ))}
      </MapContainer>

      {!pontos.length && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            zIndex: 500,
            display: "grid",
            placeItems: "center",
            background: "rgba(255,255,255,.82)",
            color: "#64748b",
            padding: 20,
            textAlign: "center",
          }}
        >
          Nenhum pacote com localização disponível.
        </div>
      )}
    </div>
  );
}

function Comprovante({
  pacote,
  usuarios,
  onFechar,
}: {
  pacote: Codigo;
  usuarios: Usuario[];
  onFechar: () => void;
}) {
  const dados = pacote as any;
  const [fotoAberta, setFotoAberta] = useState<string | null>(null);

  const fotos: string[] = [];

  if (Array.isArray(dados.fotos)) {
    dados.fotos.forEach((foto: any) => {
      const url = String(foto || "").trim();
      if (url && !fotos.includes(url)) fotos.push(url);
    });
  }

  [
    dados.fotoUrl,
    dados.fotoEntrega,
    dados.fotoEntregue,
    dados.foto,
    dados.imagem,
    dados.comprovanteFoto,
  ].forEach((foto) => {
    const url = String(foto || "").trim();
    if (url && !fotos.includes(url)) fotos.push(url);
  });

  const usuarioId = String(
    dados.usuarioFinalizacao || dados.usuario || ""
  );

  const usuario = usuarios.find(
    (item) => item.id?.toLowerCase() === usuarioId.toLowerCase()
  );

  const entregador =
    dados.usuarioNome ||
    usuario?.nome ||
    usuarioId ||
    "-";

  const status = String(dados.status || "-").toUpperCase();

  const statusColor =
    status === "ENTREGUE"
      ? "#16a34a"
      : status === "AUSENTE"
        ? "#ea580c"
        : status === "ROTA"
          ? "#2563eb"
          : "#64748b";

  const recebedor =
    dados.nomeRecebedor ||
    dados.recebedor ||
    dados.destinatario ||
    dados.nome ||
    "-";

  const documento =
    dados.documentoRecebedor ||
    dados.documento ||
    "-";

  const observacao =
    dados.observacao ||
    dados.observações ||
    "-";

  const endereco = [
    dados.enderecoCompleto,
    !dados.enderecoCompleto
      ? [
          dados.rua,
          dados.numero,
          dados.bairro,
          dados.cidade,
          dados.estado,
        ]
          .filter(Boolean)
          .join(", ")
      : "",
  ]
    .filter(Boolean)
    .join("");

  const lat = getLat(pacote);
  const lng = getLng(pacote);

  return (
    <>
      <div
        role="dialog"
        aria-modal="true"
        onClick={onFechar}
        style={{
          position: "fixed",
          inset: 0,
          zIndex: 10000,
          background: "rgba(15,23,42,.60)",
          backdropFilter: "blur(6px)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: 10,
          overflow: "hidden",
        }}
      >
        <article
          onClick={(event) => event.stopPropagation()}
          style={{
            width: "min(98vw, 1100px)",
            maxHeight: "98vh",
            overflow: "hidden",
            background: "#ffffff",
            borderRadius: 16,
            boxShadow: "0 25px 70px rgba(15,23,42,.35)",
            border: "1px solid #e5e7eb",
            padding: 14,
            boxSizing: "border-box",
          }}
        >
          {/* CABEÇALHO */}
          <header
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "flex-start",
              gap: 10,
              borderBottom: "1px solid #e5e7eb",
              paddingBottom: 8,
              marginBottom: 10,
            }}
          >
            <div>
              <small
                style={{
                  color: "#9a7209",
                  fontWeight: 800,
                  letterSpacing: ".1em",
                  fontSize: 9,
                }}
              >
                COMPROVANTE DE ENTREGA
              </small>

              <h2
                style={{
                  margin: "3px 0 0",
                  color: "#17202d",
                  fontSize: 18,
                  wordBreak: "break-word",
                }}
              >
                {pacote.codigo || pacote.id}
              </h2>
            </div>

            <button
              type="button"
              onClick={onFechar}
              aria-label="Fechar comprovante"
              style={{
                width: 32,
                height: 32,
                flexShrink: 0,
                display: "grid",
                placeItems: "center",
                borderRadius: 8,
                border: "1px solid #e2e8f0",
                background: "#f8fafc",
                cursor: "pointer",
              }}
            >
              <X size={16} />
            </button>
          </header>

          {/* CORPO: DADOS ESQUERDA / FOTO DIREITA */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns:
                fotos.length > 0
                  ? "minmax(380px, 1fr) minmax(380px, 1fr)"
                  : "1fr",
              gap: 14,
              alignItems: "stretch",
            }}
          >
            {/* ESQUERDA - TODOS OS DADOS */}
            <div
              style={{
                minWidth: 0,
                display: "flex",
                flexDirection: "column",
                gap: 8,
              }}
            >
              {/* STATUS */}
              <div
                style={{
                  padding: "9px 10px",
                  borderRadius: 10,
                  background: "#f8fafc",
                  border: `1px solid ${statusColor}33`,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: 10,
                }}
              >
                <div>
                  <small
                    style={{
                      display: "block",
                      color: "#64748b",
                      fontSize: 8,
                      fontWeight: 800,
                      letterSpacing: ".08em",
                    }}
                  >
                    STATUS DA OPERAÇÃO
                  </small>

                  <strong
                    style={{
                      color: statusColor,
                      display: "block",
                      marginTop: 3,
                      fontSize: 15,
                    }}
                  >
                    {status}
                  </strong>
                </div>

                <span
                  style={{
                    background: `${statusColor}18`,
                    color: statusColor,
                    border: `1px solid ${statusColor}44`,
                    padding: "5px 10px",
                    borderRadius: 20,
                    fontSize: 10,
                    fontWeight: 800,
                  }}
                >
                  {status}
                </span>
              </div>

              {/* DADOS */}
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
                  gap: 6,
                }}
              >
                <Info titulo="TIPO" valor={normalizarTipo(pacote.tipo)} />
                <Info titulo="EMPRESA" valor={pacote.empresa || "-"} />
                <Info titulo="ENTREGADOR" valor={entregador} />

                <Info
                  titulo="DATA / HORA"
                  valor={formatarData(
                    dados.dataHoraBaixa ||
                      dados.dataHora ||
                      dados.data
                  )}
                />

                <Info titulo="RECEBEDOR" valor={recebedor} />
                <Info titulo="DOCUMENTO" valor={documento} />
              </div>

              {/* OBSERVAÇÃO */}
              <div
                style={{
                  padding: "8px 10px",
                  background: "#fafafa",
                  border: "1px solid #e5e7eb",
                  borderRadius: 9,
                }}
              >
                <small
                  style={{
                    display: "block",
                    color: "#64748b",
                    fontWeight: 800,
                    fontSize: 8,
                    letterSpacing: ".08em",
                    marginBottom: 3,
                  }}
                >
                  OBSERVAÇÃO
                </small>

                <div
                  style={{
                    color: "#17202d",
                    lineHeight: 1.3,
                    whiteSpace: "pre-wrap",
                    fontSize: 11,
                  }}
                >
                  {observacao}
                </div>
              </div>

              {/* LOCALIZAÇÃO */}
              {(endereco ||
                dados.cep ||
                lat !== null ||
                lng !== null) && (
                <div
                  style={{
                    background: "#f8fafc",
                    border: "1px solid #e5e7eb",
                    borderRadius: 9,
                    padding: "8px 10px",
                  }}
                >
                  <small
                    style={{
                      display: "block",
                      color: "#64748b",
                      fontWeight: 800,
                      fontSize: 8,
                      letterSpacing: ".08em",
                      marginBottom: 3,
                    }}
                  >
                    LOCALIZAÇÃO DA ENTREGA
                  </small>

                  {endereco && (
                    <div
                      style={{
                        color: "#17202d",
                        fontSize: 11,
                        lineHeight: 1.3,
                      }}
                    >
                      {endereco}
                    </div>
                  )}

                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      gap: 10,
                      marginTop: 4,
                      flexWrap: "wrap",
                    }}
                  >
                    {dados.cep && (
                      <span
                        style={{
                          color: "#64748b",
                          fontSize: 10,
                        }}
                      >
                        CEP: {dados.cep}
                      </span>
                    )}

                    {lat !== null && lng !== null && (
                      <span
                        style={{
                          color: "#64748b",
                          fontSize: 9,
                        }}
                      >
                        GPS: {lat.toFixed(5)}, {lng.toFixed(5)}
                      </span>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* DIREITA - FOTOS */}
            {fotos.length > 0 && (
              <div
                style={{
                  minWidth: 0,
                  display: "flex",
                  flexDirection: "column",
                }}
              >
                <small
                  style={{
                    display: "block",
                    color: "#64748b",
                    fontWeight: 800,
                    fontSize: 8,
                    letterSpacing: ".08em",
                    marginBottom: 6,
                  }}
                >
                  COMPROVANTE FOTOGRÁFICO
                </small>

                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns:
                      fotos.length === 1
                        ? "1fr"
                        : "repeat(2, minmax(0, 1fr))",
                    gap: 7,
                    flex: 1,
                  }}
                >
                  {fotos.map((foto, index) => (
                    <button
                      key={`${foto}-${index}`}
                      type="button"
                      onClick={() => setFotoAberta(foto)}
                      style={{
                        position: "relative",
                        border: "1px solid #e5e7eb",
                        borderRadius: 10,
                        padding: 0,
                        overflow: "hidden",
                        background: "#f8fafc",
                        cursor: "zoom-in",
                        minHeight:
                          fotos.length === 1 ? "420px" : "190px",
                      }}
                    >
                      <img
                        src={foto}
                        alt={`Comprovante ${index + 1}`}
                        style={{
                          width: "100%",
                          height: "100%",
                          maxHeight: fotos.length === 1 ? "600px" : "250px",
                          objectFit: "contain",
                          display: "block",
                        }}
                      />

                      <span
                        style={{
                          position: "absolute",
                          right: 7,
                          bottom: 7,
                          background: "rgba(15,23,42,.78)",
                          color: "#fff",
                          padding: "5px 8px",
                          borderRadius: 7,
                          fontSize: 10,
                          fontWeight: 800,
                        }}
                      >
                        CLIQUE PARA AMPLIAR
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </article>
      </div>

      {/* FOTO AMPLIADA */}
      {fotoAberta && (
        <div
          role="dialog"
          aria-modal="true"
          onClick={() => setFotoAberta(null)}
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 20000,
            background: "rgba(0,0,0,.88)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 20,
          }}
        >
          <button
            type="button"
            onClick={() => setFotoAberta(null)}
            style={{
              position: "absolute",
              top: 18,
              right: 18,
              width: 42,
              height: 42,
              borderRadius: 10,
              border: "1px solid rgba(255,255,255,.25)",
              background: "rgba(255,255,255,.12)",
              color: "#fff",
              display: "grid",
              placeItems: "center",
              cursor: "pointer",
              zIndex: 1,
            }}
          >
            <X size={22} />
          </button>

          <img
            src={fotoAberta}
            alt="Comprovante ampliado"
            onClick={(event) => event.stopPropagation()}
            style={{
              maxWidth: "96vw",
              maxHeight: "94vh",
              width: "auto",
              height: "auto",
              objectFit: "contain",
              borderRadius: 8,
              boxShadow: "0 20px 80px rgba(0,0,0,.5)",
              display: "block",
            }}
          />
        </div>
      )}
    </>
  );
}