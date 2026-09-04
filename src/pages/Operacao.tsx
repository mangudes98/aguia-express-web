// ARQUIVO: src/pages/Operacao.tsx

import { useEffect, useMemo, useState } from "react";
import {
  collection,
  doc,
  getDocs,
  onSnapshot,
  query,
  updateDoc,
  where,
} from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";
import {
  AlertTriangle,
  Building2,
  Camera,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  ClipboardCheck,
  History,
  List,
  MapPin,
  Package,
  QrCode,
  Search,
  SlidersHorizontal,
  Truck,
  User,
  UserX,
  Users,
  X,
} from "lucide-react";
import { QRCodeSVG } from "qrcode.react";

import PageHeader from "../components/ui/PageHeader";
import StatusBadge from "../components/ui/StatusBadge";
import {
  listarPacotes,
  nomeTipo,
  timestampMs,
} from "../services/pacotes";
import { auth, db } from "../services/firebase/firebase";
import { StatusPacote } from "../types";

type Visualizacao = "KANBAN" | "QR" | "USUARIOS";

const cols: [StatusPacote, string, string][] = [
  ["COLETADO", "Coletados", "#c9a227"],
  ["ROTA", "Em rota", "#2196f3"],
  ["ENTREGUE", "Entregues", "#16a34a"],
  ["AUSENTE", "Ausentes", "#ef4444"],
  ["DEVOLVIDO", "Devoluções", "#6b7280"],
];

const STATUS_FILTRO: {
  status: StatusPacote;
  label: string;
  color: string;
}[] = [
  { status: "COLETADO", label: "COLETADO", color: "#c9a227" },
  { status: "ROTA", label: "ROTA", color: "#2196f3" },
  { status: "ENTREGUE", label: "ENTREGUE", color: "#16a34a" },
  { status: "AUSENTE", label: "AUSENTE", color: "#ef4444" },
  { status: "DEVOLVIDO", label: "DEVOLVIDO", color: "#6b7280" },
];

const iso = (d: Date) => d.toISOString().slice(0, 10);

const OPERACAO_CSS = `
.operacao-premium{min-height:100vh;background:linear-gradient(135deg,#f8fafc 0%,#eef2f7 52%,#fffdf5 100%);padding:8px 0 40px;color:#17202d}
.operacao-premium .card{border:1px solid #e3e8ef;border-radius:18px;box-shadow:0 12px 30px rgba(25,42,65,.07);background:rgba(255,255,255,.94)}
.operacao-premium .kanban{align-items:start;gap:16px}
.operacao-premium .kanban-col{border:1px solid #e3e8ef;border-radius:17px;background:rgba(248,250,252,.86);padding:12px;box-shadow:0 8px 24px rgba(25,42,65,.05)}
.operacao-premium .kanban-head{padding:5px 3px 13px;border-bottom:1px solid #e3e8ef;text-transform:uppercase;letter-spacing:.06em}
.operacao-premium .kanban-item{background:#fff!important;border:1px solid #e6eaf0;border-left-width:4px!important;border-radius:13px!important;box-shadow:0 5px 14px rgba(25,42,65,.05);transition:transform .18s ease,box-shadow .18s ease}
.operacao-premium .kanban-item:hover{transform:translateY(-2px);box-shadow:0 10px 22px rgba(25,42,65,.1)}
.operacao-premium button{transition:transform .18s ease,box-shadow .18s ease}
.operacao-premium button:hover:not(:disabled){transform:translateY(-1px);box-shadow:0 6px 16px rgba(25,42,65,.1)}
.operacao-premium .qr-present{background:#fff;border:1px solid #e5e7eb;border-radius:20px;padding:16px;box-shadow:0 10px 28px rgba(25,42,65,.1)}
.comprovante-operacao-linha{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));border-bottom:1px solid #edf0f3}
.comprovante-operacao-linha:last-child{border-bottom:0}
.comprovante-operacao-secao{min-width:0;padding:12px 14px;border-right:1px solid #edf0f3}
.comprovante-operacao-secao:last-child{border-right:0}
.comprovante-operacao-titulo{display:flex;align-items:center;gap:7px;margin-bottom:10px;color:#1f2937;font-size:13px;font-weight:900}
.comprovante-operacao-titulo svg{color:#c9a227}
.comprovante-operacao-info{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:6px}
.comprovante-operacao-endereco{padding:12px 14px}
.comprovante-operacao-endereco .info-item{margin-top:6px;padding:9px 10px;border:1px solid #e5e7eb;border-radius:9px;background:#f8fafc}
.comprovante-operacao-endereco .info-label{margin-bottom:3px;color:#94a3b8;font-size:10px;font-weight:800}
.comprovante-operacao-endereco .info-valor{color:#1f2937;font-size:12px;font-weight:700;line-height:1.35;word-break:break-word}
.comprovante-operacao-endereco-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:6px}
.comprovante-operacao-endereco-completo{grid-column:1/-1}
.comprovante-operacao-endereco-carregando{margin:4px 0 6px;padding:7px 9px;border:1px solid #e5e7eb;border-radius:8px;background:#f8fafc;color:#64748b;font-size:11px}
.comprovante-operacao-mapa{display:inline-flex;align-items:center;gap:5px;margin-top:8px;color:#2563eb;font-size:11px;font-weight:800;text-decoration:none}
.comprovante-operacao-historico{position:relative;display:block;height:122px;overflow:hidden}
.comprovante-operacao-trilha{position:absolute;left:0;top:0;width:100%;height:100%;overflow:visible;pointer-events:none}
.comprovante-operacao-historico-item{position:absolute;display:flex;flex-direction:column;align-items:center;gap:4px;padding:0;transform:translateX(-50%);white-space:nowrap}
.comprovante-operacao-historico-ponto{position:relative;top:auto;left:auto;width:11px;height:11px;border-radius:50%;border:2px solid #fff;flex:0 0 auto;z-index:1}
.comprovante-operacao-historico-status{color:#1f2937;font-size:12px;font-weight:800}
.comprovante-operacao-historico-data{margin-top:2px;color:#94a3b8;font-size:10px}
.comprovante-operacao-fotos{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:6px}
.comprovante-operacao-foto{width:100%;height:130px;object-fit:cover;border:1px solid #e5e7eb;border-radius:8px;background:#f8fafc}
.comprovante-operacao-secao .sem-foto{min-height:92px;padding:10px;font-size:11px}
.operacao-modal-foto{position:fixed;inset:0;z-index:10001;display:flex;align-items:center;justify-content:center;padding:30px;background:rgba(15,23,42,.84)}
.operacao-modal-foto img{max-width:min(1100px,92vw);max-height:88vh;object-fit:contain;border-radius:10px;box-shadow:0 25px 80px rgba(0,0,0,.4)}
.operacao-modal-foto-fechar,.operacao-modal-foto-seta{position:fixed;width:46px;height:46px;display:flex;align-items:center;justify-content:center;border:0;border-radius:50%;background:rgba(255,255,255,.14);color:#fff;cursor:pointer}
.operacao-modal-foto-fechar{top:20px;right:22px}
.operacao-modal-foto-seta.esquerda{left:22px}
.operacao-modal-foto-seta.direita{right:22px}
@media(max-width:700px){.comprovante-operacao-linha{grid-template-columns:1fr}.comprovante-operacao-secao{border-right:0;border-bottom:1px solid #edf0f3}.comprovante-operacao-secao:last-child{border-bottom:0}.comprovante-operacao-info,.comprovante-operacao-endereco-grid{grid-template-columns:1fr}}
@media(max-width:850px){.operacao-premium{padding:0 0 28px}.operacao-premium .kanban{overflow-x:auto}.operacao-premium .kanban-col{min-width:245px}}
`;

function usePermission() {
  const [state, setState] = useState<
    "loading" | "ok" | "denied"
  >("loading");

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(
      auth,
      async (user) => {
        try {
          if (!user?.email) {
            setState("denied");
            return;
          }

          const email = user.email.trim().toLowerCase();

          const snap = await getDocs(
            query(
              collection(db, "usuarios"),
              where("__name__", "==", email)
            )
          );

          const u = snap.docs[0]?.data();

          setState(
            u?.tipo === "admin" ||
              u?.permissoes?.finalizados === true
              ? "ok"
              : "denied"
          );
        } catch (error) {
          console.error(
            "Erro ao verificar permissão da Operação:",
            error
          );
          setState("denied");
        }
      }
    );

    return () => unsubscribe();
  }, []);

  return state;
}

function usuarioId(p: any) {
  return String(
    p.usuarioFinalizacao ||
      p.usuario ||
      p.usuarioEntrega ||
      p.entregador ||
      p.emailUsuario ||
      p.userEmail ||
      p.usuarioEmail ||
      p.uidUsuario ||
      ""
  )
    .trim()
    .toLowerCase();
}

function nomeUsuario(
  p: any,
  usuariosMap: Record<string, string>
) {
  const id = usuarioId(p);

  const nomeDireto = String(
    p.nomeUsuario ||
      p.nomeEntregador ||
      p.usuarioNome ||
      p.entregadorNome ||
      ""
  ).trim();

  return (
    nomeDireto ||
    usuariosMap[id] ||
    id ||
    "Sem usuário"
  );
}

function codigoPacote(p: any) {
  const raw = p.raw;

  if (raw) {
    if (typeof raw === "object") {
      return String(
        raw.external_grouper_code ||
          raw.codigo ||
          raw.id ||
          p.codigo ||
          p.id ||
          "-"
      );
    }

    if (typeof raw === "string") {
      try {
        const json = JSON.parse(raw);

        return String(
          json.external_grouper_code ||
            json.codigo ||
            json.id ||
            p.codigo ||
            p.id ||
            "-"
        );
      } catch {
        return String(p.codigo || p.id || raw);
      }
    }
  }

  return String(p.codigo || p.id || "-");
}

function valorQr(p: any) {
  if (
    p.raw !== undefined &&
    p.raw !== null &&
    String(p.raw).trim() !== ""
  ) {
    return typeof p.raw === "string"
      ? p.raw
      : JSON.stringify(p.raw);
  }

  return String(p.codigo || p.id || "");
}

function corStatus(status: string) {
  switch (String(status || "").toUpperCase()) {
    case "ENTREGUE":
      return "#16a34a";
    case "AUSENTE":
      return "#ef4444";
    case "ROTA":
      return "#2196f3";
    case "COLETADO":
    case "COLETA":
      return "#c9a227";
    default:
      return "#6b7280";
  }
}

type EnderecoOperacao = {
  rua: string;
  numero: string;
  bairro: string;
  cidade: string;
  estado: string;
  cep: string;
};

function valorOperacao(
  dados: any,
  campos: string[],
  padrao = ""
) {
  for (const campo of campos) {
    const valor = dados?.[campo];

    if (
      valor !== undefined &&
      valor !== null &&
      String(valor).trim() !== ""
    ) {
      return valor;
    }
  }

  return padrao;
}

async function buscarEnderecoOperacao(
  latitude: number,
  longitude: number
): Promise<EnderecoOperacao | null> {
  try {
    const resposta = await fetch(
      "https://nominatim.openstreetmap.org/reverse" +
        `?lat=${encodeURIComponent(latitude)}` +
        `&lon=${encodeURIComponent(longitude)}` +
        "&format=json&addressdetails=1&accept-language=pt-BR",
      { headers: { Accept: "application/json" } }
    );

    if (!resposta.ok) return null;

    const address = (await resposta.json())?.address;
    if (!address) return null;

    return {
      rua:
        address.road ||
        address.pedestrian ||
        address.residential ||
        address.street ||
        "",
      numero: address.house_number || "",
      bairro:
        address.suburb ||
        address.neighbourhood ||
        address.city_district ||
        address.quarter ||
        "",
      cidade:
        address.city ||
        address.town ||
        address.municipality ||
        address.village ||
        "",
      estado: address.state || "",
      cep: address.postcode || "",
    };
  } catch (error) {
    console.error(
      "Erro ao buscar endereço da operação:",
      error
    );
    return null;
  }
}

async function completarEnderecoOperacao(
  dados: any
): Promise<EnderecoOperacao> {
  const endereco: EnderecoOperacao = {
    rua: String(
      valorOperacao(dados, ["rua", "logradouro", "street"])
    ),
    numero: String(
      valorOperacao(dados, ["numero", "number", "house_number"])
    ),
    bairro: String(
      valorOperacao(dados, [
        "bairro",
        "neighborhood",
        "suburb",
      ])
    ),
    cidade: String(
      valorOperacao(dados, [
        "cidade",
        "municipio",
        "city",
      ])
    ),
    estado: String(
      valorOperacao(dados, ["estado", "uf", "state"])
    ),
    cep: String(
      valorOperacao(dados, ["cep", "CEP", "postcode"])
    ),
  };

  const precisaCompletar =
    !endereco.rua ||
    !endereco.numero ||
    !endereco.bairro ||
    !endereco.cidade ||
    !endereco.estado ||
    !endereco.cep;

  if (!precisaCompletar) return endereco;

  const latitude = Number(
    dados?.latitudeEntrega ??
      dados?.latitude ??
      dados?.lat
  );
  const longitude = Number(
    dados?.longitudeEntrega ??
      dados?.longitude ??
      dados?.lng
  );

  if (
    !Number.isFinite(latitude) ||
    !Number.isFinite(longitude)
  ) {
    return endereco;
  }

  const encontrado = await buscarEnderecoOperacao(
    latitude,
    longitude
  );

  if (!encontrado) return endereco;

  return {
    rua: endereco.rua || encontrado.rua,
    numero: endereco.numero || encontrado.numero,
    bairro: endereco.bairro || encontrado.bairro,
    cidade: endereco.cidade || encontrado.cidade,
    estado: endereco.estado || encontrado.estado,
    cep: endereco.cep || encontrado.cep,
  };
}

function corHistoricoOperacao(status: string) {
  switch (
    String(status || "")
      .trim()
      .toUpperCase()
  ) {
    case "COLETADO":
    case "COLETA":
      return "#c9a227";
    case "ROTA":
      return "#2563eb";
    case "AUSENTE":
      return "#ef4444";
    case "ENTREGUE":
    case "DEVOLVIDO":
    case "DEVOLUÇÃO":
    case "DEVOLUCAO":
      return "#16a34a";
    default:
      return "#64748b";
  }
}

function pontoHistoricoOperacao(
  index: number,
  total: number
) {
  const ondulacao = [16, 52, 28, 66, 40, 58];
  const proporcao =
    total > 1 ? index / (total - 1) : 0;

  return {
    x: 18 + proporcao * 324,
    y: ondulacao[index % ondulacao.length],
  };
}

export default function Operacao() {
  const permission = usePermission();

  const [items, setItems] = useState<any[]>([]);
  const [usuariosMap, setUsuariosMap] = useState<
    Record<string, string>
  >({});
  const [loading, setLoading] = useState(true);

  const [ini, setIni] = useState(
    iso(new Date(Date.now() - 86400000))
  );
  const [fim, setFim] = useState(
    iso(new Date(Date.now() - 86400000))
  );

  const [busca, setBusca] = useState("");
  const [empresa, setEmpresa] = useState("TODAS");
  const [usuarioFiltro, setUsuarioFiltro] =
    useState("TODOS");
  const [tipoFiltro, setTipoFiltro] = useState("TODOS");
  const [statusFiltros, setStatusFiltros] =
    useState<StatusPacote[]>([]);
  const [filtrosAberto, setFiltrosAberto] =
    useState(true);

  const [visualizacao, setVisualizacao] =
    useState<Visualizacao>("KANBAN");

  const [indiceQr, setIndiceQr] = useState(0);
  const [salvando, setSalvando] =
    useState<string | null>(null);
  const [pacoteComprovante, setPacoteComprovante] =
    useState<any | null>(null);

  useEffect(() => {
    let cancelarPacotes: (() => void) | undefined;
    let cancelarUsuarios: (() => void) | undefined;

    async function iniciar() {
      try {
        const iniciais = await listarPacotes();
        setItems(iniciais as any[]);

        cancelarPacotes = onSnapshot(
          collection(db, "controle_codigos"),
          (snap) => {
            const lista = snap.docs.map((d) => ({
              id: d.id,
              ...d.data(),
            }));

            setItems(lista);
            setLoading(false);
          },
          (erro) => {
            console.error(erro);
            setLoading(false);
          }
        );

        cancelarUsuarios = onSnapshot(
          collection(db, "usuarios"),
          (snap) => {
            const mapa: Record<string, string> = {};

            snap.docs.forEach((d) => {
              const u: any = d.data();

              const nome = String(
                u.nome ||
                  u.name ||
                  u.nomeCompleto ||
                  ""
              ).trim();

              const email = String(u.email || "")
                .trim()
                .toLowerCase();

              const id = String(d.id || "")
                .trim()
                .toLowerCase();

              if (email && nome) mapa[email] = nome;
              if (id && nome) mapa[id] = nome;
            });

            setUsuariosMap(mapa);
          }
        );
      } catch (erro) {
        console.error(erro);
        setLoading(false);
      }
    }

    iniciar();

    return () => {
      cancelarPacotes?.();
      cancelarUsuarios?.();
    };
  }, []);

  const empresas = useMemo(() => {
    return Array.from(
      new Set(
        items
          .map((p) =>
            String(p.empresa || "").trim()
          )
          .filter(Boolean)
      )
    ).sort();
  }, [items]);

  const usuarios = useMemo(() => {
    const mapa = new Map<string, string>();

    items.forEach((p) => {
      const id = usuarioId(p);

      if (!id) return;

      mapa.set(
        id,
        nomeUsuario(p, usuariosMap)
      );
    });

    return Array.from(mapa.entries())
      .map(([id, nome]) => ({ id, nome }))
      .sort((a, b) =>
        a.nome.localeCompare(b.nome)
      );
  }, [items, usuariosMap]);

  const tipos = useMemo(() => {
    return Array.from(
      new Set(
        items
          .map((p) =>
            String(p.tipo || "").trim()
          )
          .filter(Boolean)
      )
    ).sort();
  }, [items]);

  const base = useMemo(() => {
    const buscaNormal = busca.trim().toLowerCase();

    const inicio = new Date(
      `${ini}T00:00:00`
    ).getTime();

    const fimData = new Date(
      `${fim}T23:59:59.999`
    ).getTime();

    return items.filter((p) => {
      const data = timestampMs(
        p.dataHoraBaixa ||
          p.dataHora ||
          p.data ||
          p.createdAt
      );

      if (
        Number.isFinite(data) &&
        (data < inicio || data > fimData)
      ) {
        return false;
      }

      if (
        empresa !== "TODAS" &&
        String(p.empresa || "") !== empresa
      ) {
        return false;
      }

      const idUsuario = usuarioId(p);

      if (
        usuarioFiltro !== "TODOS" &&
        idUsuario !== usuarioFiltro
      ) {
        return false;
      }

      if (
        tipoFiltro !== "TODOS" &&
        String(p.tipo || "") !== tipoFiltro
      ) {
        return false;
      }

      if (
        statusFiltros.length > 0 &&
        !statusFiltros.includes(p.status)
      ) {
        return false;
      }

      if (buscaNormal) {
        const texto = [
          codigoPacote(p),
          p.empresa,
          p.status,
          p.tipo,
          usuarioId(p),
          nomeUsuario(p, usuariosMap),
        ]
          .join(" ")
          .toLowerCase();

        if (!texto.includes(buscaNormal)) {
          return false;
        }
      }

      return true;
    });
  }, [
    items,
    ini,
    fim,
    busca,
    empresa,
    usuarioFiltro,
    tipoFiltro,
    statusFiltros,
    usuariosMap,
  ]);

  const resumoUsuarios = useMemo(() => {
    const mapa = new Map<
      string,
      {
        id: string;
        nome: string;
        total: number;
        entregue: number;
        ausente: number;
        rota: number;
        coletado: number;
        devolvido: number;
      }
    >();

    base.forEach((p) => {
      const id =
        usuarioId(p) || "__sem_usuario__";

      if (!mapa.has(id)) {
        mapa.set(id, {
          id,
          nome:
            id === "__sem_usuario__"
              ? "Sem usuário"
              : nomeUsuario(p, usuariosMap),
          total: 0,
          entregue: 0,
          ausente: 0,
          rota: 0,
          coletado: 0,
          devolvido: 0,
        });
      }

      const atual = mapa.get(id)!;

      atual.total++;

      switch (p.status) {
        case "ENTREGUE":
          atual.entregue++;
          break;
        case "AUSENTE":
          atual.ausente++;
          break;
        case "ROTA":
          atual.rota++;
          break;
        case "COLETADO":
          atual.coletado++;
          break;
        case "DEVOLVIDO":
          atual.devolvido++;
          break;
      }
    });

    return Array.from(mapa.values()).sort(
      (a, b) => b.total - a.total
    );
  }, [base, usuariosMap]);

  const pacoteQr = base[indiceQr];

  function toggleStatus(status: StatusPacote) {
    setStatusFiltros((atual) =>
      atual.includes(status)
        ? atual.filter((s) => s !== status)
        : [...atual, status]
    );

    setIndiceQr(0);
  }

  function limparFiltros() {
    setBusca("");
    setEmpresa("TODAS");
    setUsuarioFiltro("TODOS");
    setTipoFiltro("TODOS");
    setStatusFiltros([]);
    setIndiceQr(0);
  }

  async function marcarPacote(p: any) {
    if (
      p.status !== "ENTREGUE" &&
      p.status !== "AUSENTE"
    ) {
      return;
    }

    const id = String(
      p.id || p.codigo || ""
    ).trim();

    if (!id) {
      alert("Código do pacote não encontrado.");
      return;
    }

    try {
      setSalvando(id);

      await updateDoc(
        doc(db, "controle_codigos", id),
        {
          confirmado: p.confirmado !== true,
        }
      );
    } catch (erro) {
      console.error(
        "Erro ao marcar pacote:",
        erro
      );

      alert(
        "Não foi possível salvar a marcação. Verifique se o documento existe em controle_codigos."
      );
    } finally {
      setSalvando(null);
    }
  }

  useEffect(() => {
    if (visualizacao !== "QR") return;

    function teclado(e: KeyboardEvent) {
      const tag =
        (e.target as HTMLElement)?.tagName;

      if (
        tag === "INPUT" ||
        tag === "TEXTAREA" ||
        tag === "SELECT"
      ) {
        return;
      }

      if (
        e.key === "ArrowLeft" ||
        e.key === "ArrowUp"
      ) {
        e.preventDefault();

        setIndiceQr((i) =>
          Math.max(0, i - 1)
        );
      }

      if (
        e.key === "ArrowRight" ||
        e.key === "ArrowDown"
      ) {
        e.preventDefault();

        setIndiceQr((i) =>
          Math.min(
            base.length - 1,
            i + 1
          )
        );
      }
    }

    window.addEventListener(
      "keydown",
      teclado
    );

    return () =>
      window.removeEventListener(
        "keydown",
        teclado
      );
  }, [visualizacao, base.length]);

  if (permission === "loading") {
    return (
      <div
        style={{
          minHeight: 300,
          display: "grid",
          placeItems: "center",
          color: "#64748b",
          fontWeight: 700,
        }}
      >
        Verificando permissão...
      </div>
    );
  }

  if (permission === "denied") {
    return (
      <div
        style={{
          minHeight: 300,
          display: "grid",
          placeItems: "center",
        }}
      >
        <div
          style={{
            textAlign: "center",
            padding: 30,
            background: "#fff",
            border: "1px solid #fecaca",
            borderRadius: 16,
            color: "#991b1b",
          }}
        >
          <AlertTriangle
            size={32}
            style={{ marginBottom: 10 }}
          />

          <div style={{ fontWeight: 800 }}>
            Acesso não permitido
          </div>

          <div
            style={{
              marginTop: 6,
              fontSize: 13,
            }}
          >
            Você não tem permissão para acessar Operação.
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      <style>{OPERACAO_CSS}</style>

      <div className="operacao-premium">
        <PageHeader
          title="Operação"
          subtitle="Controle operacional dos pacotes."
        />

        <div
          className="card"
          style={{
            padding: 16,
            marginBottom: 16,
          }}
        >
          <div
            style={{
              display: "flex",
              gap: 10,
              flexWrap: "wrap",
            }}
          >
            <div
              style={{
                flex: "1 1 280px",
                display: "flex",
                alignItems: "center",
                gap: 8,
                border: "1px solid #d1d5db",
                borderRadius: 9,
                padding: "0 12px",
              }}
            >
              <Search size={18} />

              <input
                value={busca}
                onChange={(e) => {
                  setBusca(e.target.value);
                  setIndiceQr(0);
                }}
                placeholder="Buscar código, empresa, usuário..."
                style={{
                  border: 0,
                  outline: 0,
                  width: "100%",
                  padding: "12px 0",
                }}
              />
            </div>

            <button
              onClick={() =>
                setFiltrosAberto((v) => !v)
              }
              style={botao}
            >
              <SlidersHorizontal size={17} />
              FILTROS
            </button>

            <button
              onClick={limparFiltros}
              style={botao}
            >
              LIMPAR
            </button>
          </div>

          {filtrosAberto && (
            <div
              style={{
                marginTop: 16,
                paddingTop: 16,
                borderTop: "1px solid #e5e7eb",
              }}
            >
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns:
                    "repeat(auto-fit,minmax(180px,1fr))",
                  gap: 12,
                }}
              >
                <label>
                  <span style={labelStyle}>
                    DE
                  </span>

                  <input
                    type="date"
                    value={ini}
                    onChange={(e) => {
                      setIni(e.target.value);
                      setIndiceQr(0);
                    }}
                    style={{ width: "100%" }}
                  />
                </label>

                <label>
                  <span style={labelStyle}>
                    ATÉ
                  </span>

                  <input
                    type="date"
                    value={fim}
                    onChange={(e) => {
                      setFim(e.target.value);
                      setIndiceQr(0);
                    }}
                    style={{ width: "100%" }}
                  />
                </label>

                <label>
                  <span style={labelStyle}>
                    EMPRESA
                  </span>

                  <select
                    value={empresa}
                    onChange={(e) => {
                      setEmpresa(e.target.value);
                      setIndiceQr(0);
                    }}
                    style={{ width: "100%" }}
                  >
                    <option value="TODAS">
                      Todas
                    </option>

                    {empresas.map((item) => (
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
                  <span style={labelStyle}>
                    USUÁRIO
                  </span>

                  <select
                    value={usuarioFiltro}
                    onChange={(e) => {
                      setUsuarioFiltro(
                        e.target.value
                      );
                      setIndiceQr(0);
                    }}
                    style={{ width: "100%" }}
                  >
                    <option value="TODOS">
                      Todos
                    </option>

                    {usuarios.map((item) => (
                      <option
                        key={item.id}
                        value={item.id}
                      >
                        {item.nome}
                      </option>
                    ))}
                  </select>
                </label>

                <label>
                  <span style={labelStyle}>
                    TIPO
                  </span>

                  <select
                    value={tipoFiltro}
                    onChange={(e) => {
                      setTipoFiltro(
                        e.target.value
                      );
                      setIndiceQr(0);
                    }}
                    style={{ width: "100%" }}
                  >
                    <option value="TODOS">
                      Todos
                    </option>

                    {tipos.map((item) => (
                      <option
                        key={item}
                        value={item}
                      >
                        {nomeTipo(item)}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              <div
                style={{
                  marginTop: 16,
                  display: "flex",
                  gap: 8,
                  flexWrap: "wrap",
                }}
              >
                {STATUS_FILTRO.map((item) => {
                  const ativo =
                    statusFiltros.includes(
                      item.status
                    );

                  return (
                    <button
                      key={item.status}
                      onClick={() =>
                        toggleStatus(item.status)
                      }
                      style={{
                        border: `1px solid ${item.color}`,
                        background: ativo
                          ? item.color
                          : "#fff",
                        color: ativo
                          ? "#fff"
                          : item.color,
                        padding: "8px 12px",
                        borderRadius: 20,
                        fontWeight: 800,
                        cursor: "pointer",
                        fontSize: 11,
                      }}
                    >
                      {item.label}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        <div
          style={{
            display: "flex",
            gap: 10,
            flexWrap: "wrap",
            marginBottom: 16,
          }}
        >
          <button
            onClick={() =>
              setVisualizacao("KANBAN")
            }
            style={{
              ...botao,
              background:
                visualizacao === "KANBAN"
                  ? "#111827"
                  : "#fff",
              color:
                visualizacao === "KANBAN"
                  ? "#fff"
                  : "#111827",
            }}
          >
            <ClipboardCheck size={17} />
            KANBAN
          </button>

          <button
            onClick={() =>
              setVisualizacao("QR")
            }
            style={{
              ...botao,
              background:
                visualizacao === "QR"
                  ? "#111827"
                  : "#fff",
              color:
                visualizacao === "QR"
                  ? "#fff"
                  : "#111827",
            }}
          >
            <QrCode size={17} />
            LISTA QR
          </button>

          <button
            onClick={() =>
              setVisualizacao("USUARIOS")
            }
            style={{
              ...botao,
              background:
                visualizacao === "USUARIOS"
                  ? "#111827"
                  : "#fff",
              color:
                visualizacao === "USUARIOS"
                  ? "#fff"
                  : "#111827",
            }}
          >
            <Users size={17} />
            LISTA USUÁRIO
          </button>
        </div>

        {!loading &&
          visualizacao === "KANBAN" && (
            <div
              className="kanban"
              style={{
                display: "grid",
                gridTemplateColumns:
                  "repeat(5,minmax(240px,1fr))",
              }}
            >
              {cols.map(
                ([status, titulo, cor]) => {
                  const lista = base.filter(
                    (p) =>
                      p.status === status
                  );

                  return (
                    <section
                      className="kanban-col"
                      key={status}
                    >
                      <div
                        className="kanban-head"
                        style={{
                          display: "flex",
                          justifyContent:
                            "space-between",
                          alignItems: "center",
                        }}
                      >
                        <b>{titulo}</b>

                        <span
                          style={{
                            minWidth: 28,
                            height: 28,
                            display: "grid",
                            placeItems: "center",
                            borderRadius: "50%",
                            background: cor,
                            color: "#fff",
                            fontWeight: 800,
                          }}
                        >
                          {lista.length}
                        </span>
                      </div>

                      <div
                        style={{
                          display: "grid",
                          gap: 9,
                          marginTop: 12,
                        }}
                      >
                        {lista.map((p) => (
                          <div
                            className="kanban-item"
                            key={p.id}
                            style={{
                              padding: 12,
                              borderLeft: `4px solid ${cor}`,
                            }}
                          >
                            <b
                              style={{
                                display: "block",
                                wordBreak:
                                  "break-word",
                              }}
                            >
                              {codigoPacote(p)}
                            </b>

                            <div
                              style={{
                                fontSize: 11,
                                marginTop: 5,
                                color: "#6b7280",
                              }}
                            >
                              <Building2 size={12} />
                              {" "}
                              {p.empresa || "-"}
                            </div>

                            <div
                              style={{
                                fontSize: 11,
                                marginTop: 5,
                                color: "#6b7280",
                              }}
                            >
                              <User size={12} />
                              {" "}
                              {nomeUsuario(
                                p,
                                usuariosMap
                              )}
                            </div>

                            <div
                              style={{
                                marginTop: 8,
                              }}
                            >
                              <StatusBadge
                                status={p.status}
                              />
                            </div>
                          </div>
                        ))}

                        {!lista.length && (
                          <div
                            style={{
                              padding: 20,
                              color: "#9ca3af",
                              textAlign: "center",
                              fontSize: 12,
                            }}
                          >
                            Nenhum pacote.
                          </div>
                        )}
                      </div>
                    </section>
                  );
                }
              )}
            </div>
          )}

        {!loading &&
          visualizacao === "QR" && (
            <div
              style={{
                display: "grid",
                gridTemplateColumns:
                  "minmax(260px,360px) minmax(0,1fr)",
                gap: 10,
              }}
            >
              <div
                className="card"
                style={{
                  padding: 8,
                  maxHeight: "75vh",
                  overflowY: "auto",
                }}
              >
                {base.map((p, index) => (
                  <button
                    key={p.id}
                    onClick={() =>
                      setIndiceQr(index)
                    }
                    style={{
                      width: "100%",
                      textAlign: "left",
                      padding: 8,
                      marginBottom: 4,
                      borderRadius: 10,
                      border:
                        indiceQr === index
                          ? "2px solid #111827"
                          : "1px solid #e5e7eb",
                      background:
                        indiceQr === index
                          ? "#f8fafc"
                          : "#fff",
                      cursor: "pointer",
                    }}
                  >
                    <b
                      style={{
                        display: "block",
                        wordBreak: "break-word",
                      }}
                    >
                      {codigoPacote(p)}
                    </b>

                    <div
                      style={{
                        fontSize: 11,
                        marginTop: 5,
                        color: "#6b7280",
                      }}
                    >
                      {nomeUsuario(
                        p,
                        usuariosMap
                      )}
                    </div>

                    <div
                      style={{ marginTop: 4 }}
                    >
                      <StatusBadge
                        status={p.status}
                      />
                    </div>
                  </button>
                ))}

                {!base.length && (
                  <div
                    style={{
                      padding: 20,
                      textAlign: "center",
                      color: "#9ca3af",
                    }}
                  >
                    Nenhum pacote encontrado.
                  </div>
                )}
              </div>

              {pacoteQr ? (
                <div
                  className="card qr-present"
                  style={{ padding: 16 }}
                >
                  <div
                    style={{
                      display: "flex",
                      justifyContent:
                        "space-between",
                      alignItems: "center",
                      gap: 10,
                      flexWrap: "wrap",
                    }}
                  >
                    <div>
                      <div
                        style={{
                          color: "#6b7280",
                          fontSize: 12,
                        }}
                      >
                        PACOTE {indiceQr + 1} DE{" "}
                        {base.length}
                      </div>

                      <h2
                        style={{
                          margin: "5px 0",
                        }}
                      >
                        {codigoPacote(pacoteQr)}
                      </h2>
                    </div>

                    <StatusBadge
                      status={pacoteQr.status}
                    />
                  </div>

                  <div
                    style={{
                      display: "flex",
                      justifyContent: "center",
                      margin: "18px 0",
                      padding: 12,
                      borderRadius: 14,
                      background:
                        (pacoteQr.status ===
                          "ENTREGUE" ||
                          pacoteQr.status ===
                            "AUSENTE") &&
                        pacoteQr.confirmado
                          ? corStatus(
                              pacoteQr.status
                            )
                          : "#fff",
                    }}
                  >
                    <QRCodeSVG
                      value={valorQr(pacoteQr)}
                      size={250}
                      level="H"
                      includeMargin
                      bgColor={
                        pacoteQr.confirmado &&
                        (pacoteQr.status ===
                          "ENTREGUE" ||
                          pacoteQr.status ===
                            "AUSENTE")
                          ? corStatus(
                              pacoteQr.status
                            )
                          : "#fff"
                      }
                      fgColor="#111827"
                    />
                  </div>

                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns:
                        "repeat(auto-fit,minmax(180px,1fr))",
                      gap: 10,
                    }}
                  >
                    <Info
                      titulo="EMPRESA"
                      valor={
                        pacoteQr.empresa || "-"
                      }
                    />

                    <Info
                      titulo="USUÁRIO"
                      valor={nomeUsuario(
                        pacoteQr,
                        usuariosMap
                      )}
                    />

                    <Info
                      titulo="TIPO"
                      valor={nomeTipo(
                        pacoteQr.tipo
                      )}
                    />

                    <Info
                      titulo="STATUS"
                      valor={
                        pacoteQr.status || "-"
                      }
                    />
                  </div>

                  {(pacoteQr.status ===
                    "ENTREGUE" ||
                    pacoteQr.status ===
                      "AUSENTE") && (
                    <div
                      style={{
                        marginTop: 12,
                        padding: 12,
                        borderRadius: 12,
                        background:
                          pacoteQr.confirmado
                            ? pacoteQr.status ===
                              "ENTREGUE"
                              ? "#f0fdf4"
                              : "#fef2f2"
                            : "#f8fafc",
                        border:
                          pacoteQr.confirmado
                            ? `1px solid ${corStatus(
                                pacoteQr.status
                              )}`
                            : "1px solid #e5e7eb",
                      }}
                    >
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          justifyContent:
                            "space-between",
                          gap: 12,
                          flexWrap: "wrap",
                        }}
                      >
                        <div>
                          <strong>
                            {pacoteQr.confirmado
                              ? pacoteQr.status ===
                                "ENTREGUE"
                                ? "MARCAÇÃO ENTREGUE"
                                : "MARCAÇÃO AUSENTE"
                              : pacoteQr.status ===
                                "ENTREGUE"
                                ? "MARCAR ENTREGUE"
                                : "MARCAR AUSENTE"}
                          </strong>

                          <div
                            style={{
                              marginTop: 4,
                              color: "#6b7280",
                              fontSize: 12,
                            }}
                          >
                            Esta marcação apenas confirma
                            o pacote nesta tela.
                          </div>
                        </div>

                        <div
                          style={{
                            display: "flex",
                            gap: 8,
                            flexWrap: "wrap",
                            justifyContent: "flex-end",
                          }}
                        >
                          <button
                          onClick={() =>
                            marcarPacote(pacoteQr)
                          }
                          disabled={
                            salvando ===
                            String(
                              pacoteQr.id ||
                                pacoteQr.codigo ||
                                ""
                            )
                          }
                          style={{
                            border: 0,
                            borderRadius: 10,
                            padding: "11px 16px",
                            background:
                              pacoteQr.confirmado
                                ? corStatus(
                                    pacoteQr.status
                                  )
                                : "#111827",
                            color: "#fff",
                            fontWeight: 800,
                            cursor: "pointer",
                          }}
                        >
                          {salvando ===
                          String(
                            pacoteQr.id ||
                              pacoteQr.codigo ||
                              ""
                          )
                            ? "SALVANDO..."
                            : pacoteQr.confirmado
                              ? "DESMARCAR"
                              : "MARCAR"}
                          </button>

                          <button
                          type="button"
                          onClick={() =>
                            setPacoteComprovante(pacoteQr)
                          }
                          style={{
                            border: "1px solid #d1d5db",
                            borderRadius: 10,
                            padding: "11px 16px",
                            background: "#fff",
                            color: "#111827",
                            fontWeight: 800,
                            cursor: "pointer",
                          }}
                        >
                          ABRIR COMPROVANTE
                          </button>
                        </div>
                      </div>
                    </div>
                  )}

                  <div
                    style={{
                      display: "flex",
                      gap: 10,
                      marginTop: 20,
                      justifyContent:
                        "space-between",
                    }}
                  >
                    <button
                      onClick={() =>
                        setIndiceQr((i) =>
                          Math.max(0, i - 1)
                        )
                      }
                      disabled={indiceQr === 0}
                      style={botao}
                    >
                      <ChevronLeft size={18} />
                      ANTERIOR
                    </button>

                    <button
                      onClick={() =>
                        setIndiceQr((i) =>
                          Math.min(
                            base.length - 1,
                            i + 1
                          )
                        )
                      }
                      disabled={
                        indiceQr >= base.length - 1
                      }
                      style={botao}
                    >
                      PRÓXIMO
                      <ChevronRight size={18} />
                    </button>
                  </div>
                </div>
              ) : (
                <div className="card">
                  Nenhum pacote encontrado.
                </div>
              )}
            </div>
          )}

        {!loading &&
          visualizacao === "USUARIOS" && (
            <div>
              <div
                style={{
                  marginBottom: 16,
                  padding: 14,
                  background: "#eff6ff",
                  borderRadius: 10,
                  color: "#1e40af",
                  fontWeight: 700,
                }}
              >
                A quantidade abaixo respeita todos os
                filtros selecionados.
              </div>

              <div
                style={{
                  display: "grid",
                  gridTemplateColumns:
                    "repeat(auto-fit,minmax(280px,1fr))",
                  gap: 14,
                }}
              >
                {resumoUsuarios.map((u) => (
                  <div
                    className="card"
                    key={u.id}
                    style={{
                      padding: 18,
                      borderTop:
                        "4px solid #2563eb",
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        justifyContent:
                          "space-between",
                        gap: 12,
                        alignItems: "center",
                      }}
                    >
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 10,
                        }}
                      >
                        <div
                          style={{
                            width: 42,
                            height: 42,
                            borderRadius: "50%",
                            display: "grid",
                            placeItems: "center",
                            background: "#eff6ff",
                            color: "#2563eb",
                          }}
                        >
                          <User size={21} />
                        </div>

                        <div>
                          <strong
                            style={{
                              display: "block",
                              color: "#111827",
                            }}
                          >
                            {u.nome}
                          </strong>

                          {u.id !==
                            "__sem_usuario__" && (
                            <small
                              style={{
                                color: "#6b7280",
                              }}
                            >
                              {u.id}
                            </small>
                          )}
                        </div>
                      </div>

                      <div
                        style={{
                          minWidth: 58,
                          height: 58,
                          borderRadius: 12,
                          background: "#111827",
                          color: "#fff",
                          display: "grid",
                          placeItems: "center",
                          textAlign: "center",
                        }}
                      >
                        <div>
                          <strong
                            style={{
                              fontSize: 20,
                            }}
                          >
                            {u.total}
                          </strong>

                          <small
                            style={{
                              display: "block",
                              fontSize: 8,
                            }}
                          >
                            PACOTES
                          </small>
                        </div>
                      </div>
                    </div>

                    <div
                      style={{
                        display: "grid",
                        gridTemplateColumns:
                          "repeat(2,minmax(0,1fr))",
                        gap: 8,
                        marginTop: 16,
                      }}
                    >
                      <Contagem
                        label="ENTREGUE"
                        valor={u.entregue}
                        cor="#16a34a"
                      />

                      <Contagem
                        label="AUSENTE"
                        valor={u.ausente}
                        cor="#ef4444"
                      />

                      <Contagem
                        label="ROTA"
                        valor={u.rota}
                        cor="#2196f3"
                      />

                      <Contagem
                        label="COLETADO"
                        valor={u.coletado}
                        cor="#c9a227"
                      />

                      <Contagem
                        label="DEVOLVIDO"
                        valor={u.devolvido}
                        cor="#6b7280"
                      />
                    </div>
                  </div>
                ))}

                {!resumoUsuarios.length && (
                  <div className="card">
                    Nenhum usuário encontrado com os
                    filtros atuais.
                  </div>
                )}
              </div>
            </div>
          )}

        {loading && (
          <div
            className="card"
            style={{
              padding: 30,
              textAlign: "center",
              color: "#64748b",
            }}
          >
            Carregando operação...
          </div>
        )}

        {pacoteComprovante && (
          <ComprovanteOperacao
            pacote={pacoteComprovante}
            usuariosMap={usuariosMap}
            onFechar={() => setPacoteComprovante(null)}
          />
        )}
      </div>
    </>
  );
}

function ComprovanteOperacao({
  pacote,
  usuariosMap,
  onFechar,
}: {
  pacote: any;
  usuariosMap: Record<string, string>;
  onFechar: () => void;
}) {
  const dados = (() => {
    if (pacote.raw && typeof pacote.raw === "object") {
      return { ...pacote.raw, ...pacote };
    }

    if (typeof pacote.raw === "string") {
      try {
        return {
          ...JSON.parse(pacote.raw),
          ...pacote,
        };
      } catch {
        return pacote;
      }
    }

    return pacote;
  })();
  const enderecoInicial: EnderecoOperacao = {
    rua: String(
      valorOperacao(dados, ["rua", "logradouro", "street"])
    ),
    numero: String(
      valorOperacao(dados, ["numero", "number", "house_number"])
    ),
    bairro: String(
      valorOperacao(dados, [
        "bairro",
        "neighborhood",
        "suburb",
      ])
    ),
    cidade: String(
      valorOperacao(dados, ["cidade", "municipio", "city"])
    ),
    estado: String(
      valorOperacao(dados, ["estado", "uf", "state"])
    ),
    cep: String(
      valorOperacao(dados, ["cep", "CEP", "postcode"])
    ),
  };
  const [fotoSelecionada, setFotoSelecionada] =
    useState<string | null>(null);
  const [enderecoAutomatico, setEnderecoAutomatico] =
    useState<EnderecoOperacao>(enderecoInicial);
  const [buscandoEndereco, setBuscandoEndereco] =
    useState(false);
  const fotos = Array.from(
    new Set(
      [
        ...(Array.isArray(dados.fotos) ? dados.fotos : []),
        dados.fotoUrl,
        dados.fotoEntrega,
        dados.fotoEntregue,
        dados.foto,
        dados.imagem,
        dados.comprovanteFoto,
      ]
        .map((foto) => String(foto || "").trim())
        .filter(Boolean)
    )
  );
  const usuario = usuarioId(pacote);
  const entregador =
    dados.usuarioNome ||
    dados.nomeEntregador ||
    usuariosMap[usuario] ||
    usuario ||
    "-";

  useEffect(() => {
    let ativo = true;

    setBuscandoEndereco(true);
    completarEnderecoOperacao(dados)
      .then((endereco) => {
        if (ativo) setEnderecoAutomatico(endereco);
      })
      .finally(() => {
        if (ativo) setBuscandoEndereco(false);
      });

    return () => {
      ativo = false;
    };
  }, [pacote]);

  const historico = Array.isArray(dados.historico)
    ? dados.historico
    : [];
  const nomeRecebedor = String(
    dados.nomeRecebedor ||
      dados.nome_recebedor ||
      dados.recebedor ||
      dados.destinatario ||
      dados.nome ||
      "—"
  );
  const documentoRecebedor = String(
    dados.documentoRecebedor ||
      dados.documento ||
      dados.cpfRecebedor ||
      "—"
  );
  const observacao = String(
    dados.observacao ||
      dados.observação ||
      dados.obs ||
      "—"
  );
  const rua = enderecoAutomatico.rua;
  const numero = enderecoAutomatico.numero;
  const bairro = enderecoAutomatico.bairro;
  const cidade = enderecoAutomatico.cidade;
  const estado = enderecoAutomatico.estado;
  const cep = enderecoAutomatico.cep;
  const enderecoCompleto = [
    rua,
    numero,
    bairro,
    cidade,
    estado,
    cep,
  ]
    .filter(Boolean)
    .join(", ");
  const latitude = Number(
    dados?.latitudeEntrega ??
      dados?.latitude ??
      dados?.lat
  );
  const longitude = Number(
    dados?.longitudeEntrega ??
      dados?.longitude ??
      dados?.lng
  );
  const dataEntrega =
    dados.dataHoraBaixa ||
    dados.dataHoraEntrega ||
    dados.dataEntrega ||
    dados.dataHora ||
    dados.data;
  const formatarDataOperacao = (data: any) => {
    const milissegundos = timestampMs(data);
    return Number.isFinite(milissegundos)
      ? new Date(milissegundos).toLocaleString("pt-BR")
      : String(data || "—");
  };
  const alturaHistorico = historico.length ? 122 : 64;
  const pontosHistorico = historico.map(
    (_item: any, index: number) => ({
      ...pontoHistoricoOperacao(
        index,
        historico.length
      ),
    })
  );

  // Mantém o comprovante compacto e na mesma ordem do rastreamento.
  return (
    <div
      role="dialog"
      aria-modal="true"
      onClick={onFechar}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 10000,
        background: "rgba(15,23,42,.60)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 12,
      }}
    >
      <article
        onClick={(event) => event.stopPropagation()}
        style={{
          width: "min(96vw, 940px)",
          maxHeight: "94vh",
          overflowY: "auto",
          background: "#fff",
          borderRadius: 14,
          boxShadow: "0 25px 70px rgba(15,23,42,.35)",
        }}
      >
        <header
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: 10,
            padding: "12px 14px",
            borderBottom: "1px solid #edf0f3",
          }}
        >
          <div>
            <small
              style={{
                color: "#9a7209",
                fontWeight: 800,
                letterSpacing: ".08em",
              }}
            >
              COMPROVANTE DE ENTREGA
            </small>
            <h2
              style={{
                margin: "3px 0 0",
                color: "#17202d",
                fontSize: 18,
              }}
            >
              {codigoPacote(pacote)}
            </h2>
          </div>
          <button
            type="button"
            onClick={onFechar}
            aria-label="Fechar comprovante"
            style={{
              width: 32,
              height: 32,
              display: "grid",
              placeItems: "center",
              border: "1px solid #e2e8f0",
              borderRadius: 8,
              background: "#f8fafc",
              cursor: "pointer",
            }}
          >
            <X size={17} />
          </button>
        </header>

        <div className="comprovante-operacao-linha">
          <section className="comprovante-operacao-secao">
            <div className="comprovante-operacao-titulo">
              <Package size={16} />
              Identificação
            </div>
            <div className="comprovante-operacao-info">
              <Info
                titulo="STATUS"
                valor={String(pacote.status || "—")}
              />
              <Info
                titulo="TIPO"
                valor={nomeTipo(pacote.tipo)}
              />
              <Info
                titulo="EMPRESA"
                valor={String(pacote.empresa || "—")}
              />
              <Info
                titulo="ENTREGADOR"
                valor={entregador}
              />
              <Info
                titulo="DATA DA ENTREGA"
                valor={formatarDataOperacao(dataEntrega)}
              />
            </div>
          </section>

          <section className="comprovante-operacao-secao">
            <div className="comprovante-operacao-titulo">
              <History size={16} />
              Histórico da encomenda
            </div>
            {historico.length > 0 ? (
              <div
                className="comprovante-operacao-historico"
                style={{
                  minHeight: alturaHistorico,
                }}
              >
                <svg
                  className="comprovante-operacao-trilha"
                  viewBox={`0 0 360 ${alturaHistorico}`}
                  preserveAspectRatio="none"
                  aria-hidden="true"
                >
                  {pontosHistorico
                    .slice(0, -1)
                    .map(
                      (
                        ponto: { x: number; y: number },
                        index: number
                      ) => {
                      const proximo =
                        pontosHistorico[index + 1];
                      if (!proximo) return null;
                      const meioX =
                        (ponto.x + proximo.x) / 2;
                      const caminho =
                        `M ${ponto.x} ${ponto.y} ` +
                        `C ${meioX} ${ponto.y}, ` +
                        `${meioX} ${proximo.y}, ` +
                        `${proximo.x} ${proximo.y}`;

                      return (
                        <path
                          key={index}
                          d={caminho}
                          fill="none"
                          stroke={corHistoricoOperacao(
                            historico[index]?.status
                          )}
                          strokeWidth="3"
                          strokeLinecap="round"
                          opacity=".65"
                        />
                      );
                      }
                    )}
                </svg>
                {historico.map((item: any, index: number) => (
                  <div
                    className="comprovante-operacao-historico-item"
                    key={index}
                    style={{
                      left: `${(pontosHistorico[index].x / 360) * 100}%`,
                      top: pontosHistorico[index].y - 5,
                    }}
                  >
                    <span
                      className="comprovante-operacao-historico-ponto"
                      style={{
                        left: "auto",
                        background: corHistoricoOperacao(
                          item?.status
                        ),
                        boxShadow:
                          `0 0 0 3px ${corHistoricoOperacao(
                            item?.status
                          )}22`,
                      }}
                    />
                    <div>
                      <div
                        className="comprovante-operacao-historico-status"
                        style={{
                          color: corHistoricoOperacao(
                            item?.status
                          ),
                        }}
                      >
                        {item?.status || "Atualização"}
                      </div>
                      <div className="comprovante-operacao-historico-data">
                        {formatarDataOperacao(item?.dataHora)}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="sem-foto">
                <History size={17} />
                Nenhum histórico registrado.
              </div>
            )}
          </section>
        </div>

        <div className="comprovante-operacao-linha">
          <section className="comprovante-operacao-secao">
            <div className="comprovante-operacao-titulo">
              <User size={16} />
              Recebedor
            </div>
            <div className="comprovante-operacao-info">
              <Info titulo="NOME" valor={nomeRecebedor} />
              <Info
                titulo="DOCUMENTO"
                valor={documentoRecebedor}
              />
            </div>
            {observacao !== "—" && (
              <div
                style={{
                  marginTop: 6,
                  padding: "8px 10px",
                  border: "1px solid #fef3c7",
                  borderRadius: 8,
                  background: "#fffbeb",
                  color: "#713f12",
                  fontSize: 12,
                  lineHeight: 1.4,
                }}
              >
                {observacao}
              </div>
            )}
          </section>

          <section className="comprovante-operacao-secao">
            <div className="comprovante-operacao-titulo">
              <Camera size={16} />
              Comprovante fotográfico
            </div>
            {fotos.length > 0 ? (
              <div className="comprovante-operacao-fotos">
                {fotos.map((foto, index) => (
                  <img
                    key={`${foto}-${index}`}
                    className="comprovante-operacao-foto"
                    src={foto}
                    alt={`Comprovante ${index + 1}`}
                    onClick={() => setFotoSelecionada(foto)}
                    style={{ cursor: "zoom-in" }}
                  />
                ))}
              </div>
            ) : (
              <div className="sem-foto">
                <Camera size={17} />
                Nenhuma foto registrada.
              </div>
            )}
          </section>
        </div>

        <section className="comprovante-operacao-endereco">
          <div className="comprovante-operacao-titulo">
            <MapPin size={16} />
            Endereço da entrega
          </div>
          {buscandoEndereco && (
            <div className="comprovante-operacao-endereco-carregando">
              Buscando rua, número, bairro, cidade e CEP pelas coordenadas...
            </div>
          )}
          <div className="comprovante-operacao-endereco-grid">
            <div className="info-item comprovante-operacao-endereco-completo">
              <div className="info-label">ENDEREÇO COMPLETO</div>
              <div className="info-valor">
                {enderecoCompleto || "Endereço não informado"}
              </div>
            </div>
            <Info titulo="RUA" valor={rua || "Não informado"} />
            <Info titulo="NÚMERO" valor={numero || "Não informado"} />
            <Info titulo="BAIRRO" valor={bairro || "Não informado"} />
            <Info titulo="CIDADE" valor={cidade || "Não informado"} />
            <Info titulo="ESTADO" valor={estado || "Não informado"} />
            <Info titulo="CEP" valor={cep || "Não informado"} />
          </div>
          {Number.isFinite(latitude) &&
            Number.isFinite(longitude) && (
              <a
                className="comprovante-operacao-mapa"
                href={`https://www.google.com/maps?q=${latitude},${longitude}`}
                target="_blank"
                rel="noreferrer"
              >
                <MapPin size={14} />
                Ver localização no mapa
              </a>
            )}
        </section>
      </article>

      {fotoSelecionada && (
        <div
          className="operacao-modal-foto"
          onClick={() => setFotoSelecionada(null)}
        >
          <button
            type="button"
            className="operacao-modal-foto-fechar"
            onClick={(event) => {
              event.stopPropagation();
              setFotoSelecionada(null);
            }}
            aria-label="Fechar foto ampliada"
          >
            <X size={22} />
          </button>

          {fotos.indexOf(fotoSelecionada) > 0 && (
            <button
              type="button"
              className="operacao-modal-foto-seta esquerda"
              onClick={(event) => {
                event.stopPropagation();
                setFotoSelecionada(
                  fotos[fotos.indexOf(fotoSelecionada) - 1]
                );
              }}
              aria-label="Foto anterior"
            >
              <ChevronLeft size={28} />
            </button>
          )}

          <img
            src={fotoSelecionada}
            alt="Comprovante ampliado"
            onClick={(event) => event.stopPropagation()}
          />

          {fotos.indexOf(fotoSelecionada) <
            fotos.length - 1 && (
            <button
              type="button"
              className="operacao-modal-foto-seta direita"
              onClick={(event) => {
                event.stopPropagation();
                setFotoSelecionada(
                  fotos[fotos.indexOf(fotoSelecionada) + 1]
                );
              }}
              aria-label="Próxima foto"
            >
              <ChevronRight size={28} />
            </button>
          )}
        </div>
      )}
    </div>
  );

  /*
   * Layout anterior mantido apenas como referência durante a transição.
   */
  return (
    <div
      role="dialog"
      aria-modal="true"
      onClick={onFechar}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 10000,
        background: "rgba(15,23,42,.60)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 16,
      }}
    >
      <article
        onClick={(event) => event.stopPropagation()}
        style={{
          width: "min(96vw, 900px)",
          maxHeight: "94vh",
          overflowY: "auto",
          background: "#fff",
          borderRadius: 16,
          padding: 20,
          boxShadow: "0 25px 70px rgba(15,23,42,.35)",
        }}
      >
        <header
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: 12,
            marginBottom: 16,
          }}
        >
          <div>
            <small
              style={{
                color: "#9a7209",
                fontWeight: 800,
                letterSpacing: ".08em",
              }}
            >
              COMPROVANTE DE ENTREGA
            </small>
            <h2 style={{ margin: "4px 0 0", color: "#17202d" }}>
              {codigoPacote(pacote)}
            </h2>
          </div>
          <button
            type="button"
            onClick={onFechar}
            aria-label="Fechar comprovante"
            style={{
              width: 34,
              height: 34,
              display: "grid",
              placeItems: "center",
              border: "1px solid #e2e8f0",
              borderRadius: 8,
              background: "#f8fafc",
              cursor: "pointer",
            }}
          >
            <X size={18} />
          </button>
        </header>

        <div
          style={{
            display: "grid",
            gridTemplateColumns:
              fotos.length > 0
                ? "repeat(auto-fit,minmax(280px,1fr))"
                : "1fr",
            gap: 14,
          }}
        >
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(2,minmax(0,1fr))",
              gap: 8,
            }}
          >
            <Info titulo="STATUS" valor={String(pacote.status || "-")} />
            <Info titulo="TIPO" valor={nomeTipo(pacote.tipo)} />
            <Info titulo="EMPRESA" valor={String(pacote.empresa || "-")} />
            <Info titulo="ENTREGADOR" valor={entregador} />
            <Info
              titulo="RECEBEDOR"
              valor={String(
                dados.nomeRecebedor ||
                  dados.recebedor ||
                  dados.destinatario ||
                  dados.nome ||
                  "-"
              )}
            />
            <Info
              titulo="DOCUMENTO"
              valor={String(
                dados.documentoRecebedor ||
                  dados.documento ||
                  "-"
              )}
            />
            <div
              style={{
                gridColumn: "1 / -1",
                padding: 12,
                border: "1px solid #e5e7eb",
                borderRadius: 9,
              }}
            >
              <small style={{ color: "#64748b", fontWeight: 800 }}>
                OBSERVAÇÃO
              </small>
              <div style={{ marginTop: 5, whiteSpace: "pre-wrap" }}>
                {String(
                  dados.observacao ||
                    dados.observações ||
                    "-"
                )}
              </div>
            </div>
          </div>

          {fotos.length > 0 ? (
            <div>
              <small style={{ color: "#64748b", fontWeight: 800 }}>
                COMPROVANTE FOTOGRÁFICO
              </small>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns:
                    fotos.length === 1
                      ? "1fr"
                      : "repeat(2,minmax(0,1fr))",
                  gap: 8,
                  marginTop: 8,
                }}
              >
                {fotos.map((foto, index) => (
                  <img
                    key={`${foto}-${index}`}
                    src={foto}
                    alt={`Comprovante ${index + 1}`}
                    style={{
                      width: "100%",
                      maxHeight: 420,
                      objectFit: "contain",
                      border: "1px solid #e5e7eb",
                      borderRadius: 10,
                      background: "#f8fafc",
                    }}
                  />
                ))}
              </div>
            </div>
          ) : (
            <div
              style={{
                display: "grid",
                placeItems: "center",
                minHeight: 160,
                color: "#64748b",
                border: "1px dashed #cbd5e1",
                borderRadius: 10,
              }}
            >
              Nenhuma foto de comprovante encontrada.
            </div>
          )}
        </div>
      </article>
    </div>
  );

}

function Info({
  titulo,
  valor,
}: {
  titulo: string;
  valor: string;
}) {
  return (
    <div
      style={{
        padding: "9px 10px",
        border: "1px solid #e5e7eb",
        borderRadius: 9,
      }}
    >
      <small
        style={{
          display: "block",
          color: "#9ca3af",
          fontWeight: 800,
          fontSize: 10,
        }}
      >
        {titulo}
      </small>

      <strong
        style={{
          display: "block",
          marginTop: 3,
          wordBreak: "break-word",
        }}
      >
        {valor}
      </strong>
    </div>
  );
}

function Contagem({
  label,
  valor,
  cor,
}: {
  label: string;
  valor: number;
  cor: string;
}) {
  return (
    <div
      style={{
        padding: 10,
        borderRadius: 8,
        background: "#f8fafc",
        borderLeft: `4px solid ${cor}`,
      }}
    >
      <small
        style={{
          display: "block",
          color: "#6b7280",
          fontSize: 10,
          fontWeight: 800,
        }}
      >
        {label}
      </small>

      <strong
        style={{
          fontSize: 20,
          color: "#111827",
        }}
      >
        {valor}
      </strong>
    </div>
  );
}

const labelStyle: React.CSSProperties = {
  display: "block",
  marginBottom: 6,
  fontSize: 11,
  fontWeight: 800,
  color: "#6b7280",
};

const botao: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 8,
  padding: "11px 15px",
  borderRadius: 9,
  border: "1px solid #d1d5db",
  background: "#fff",
  color: "#111827",
  fontWeight: 800,
  cursor: "pointer",
};