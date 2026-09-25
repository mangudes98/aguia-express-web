// ARQUIVO: src/pages/Mapa.tsx

import { useEffect, useMemo, useState } from "react";
import {
  MapContainer,
  Marker,
  Popup,
  TileLayer,
  Polygon,
  useMap,
  useMapEvents,
} from "react-leaflet";
import L from "leaflet";
import {
  Filter,
  LocateFixed,
  MapPinned,
  RefreshCw,
  Users,
  Package,
  LockKeyhole,
  Plus,
  Pencil,
  Trash2,
  Check,
  X,
  Save,
  Palette,
  Map as MapIcon,
} from "lucide-react";

import PageHeader from "../components/ui/PageHeader";
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  serverTimestamp,
  updateDoc,
} from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";
import { db, auth } from "../services/firebase/firebase";

import {
  formatarData,
  listarPacotes,
  nomeStatus,
  nomeTipo,
  timestampMs,
} from "../services/pacotes";

import { Pacote, StatusPacote } from "../types";

import {
  carregarNomesUsuarios,
  nomeUsuario,
  UserNameMap,
} from "../services/usuarios";

import pinML from "../assets/pin_ml.png";
import pinShopee from "../assets/pin_shopee.png";
import pinAvulso from "../assets/pin_avulso.png";

type Ponto = Pacote & {
  lat: number;
  lng: number;
  usuarioMapa: string;
};

const CORES_USUARIO = [
  "#1769e0",
  "#7c3aed",
  "#0891b2",
  "#16a34a",
  "#ea580c",
  "#dc2626",
  "#db2777",
  "#ca8a04",
  "#0f766e",
  "#4f46e5",
];

// ======================================================
function usePermission() {
  const [checkingAccess, setCheckingAccess] = useState(true);
  const [allowed, setAllowed] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async user => {
      if (!user) {
        setAllowed(false);
        setIsAdmin(false);
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
          setIsAdmin(false);
          setCheckingAccess(false);
          return;
        }

        const userData = userDoc.data();

        const admin = String(userData?.tipo || "").toLowerCase() === "admin";
        setIsAdmin(admin);
        // Acesso ao mapa continua com a mesma regra existente.
        setAllowed(
          admin || userData?.permissoes?.finalizados === true
        );
      } catch (error) {
        console.error("Erro ao verificar permissão:", error);
        setAllowed(false);
        setIsAdmin(false);
      } finally {
        setCheckingAccess(false);
      }
    });

    return () => unsubscribe();
  }, []);

  return { checkingAccess, allowed, isAdmin };
}

// DATA LOCAL
// ======================================================

function dataLocal(d: Date) {
  const ano = d.getFullYear();
  const mes = String(d.getMonth() + 1).padStart(2, "0");
  const dia = String(d.getDate()).padStart(2, "0");

  return `${ano}-${mes}-${dia}`;
}

// ======================================================
// DIA ANTERIOR
// ======================================================

function getDiaAnterior() {
  const d = new Date();
  d.setHours(12, 0, 0, 0);
  d.setDate(d.getDate() - 1);

  return dataLocal(d);
}

// ======================================================
// COORDENADAS
// IGNORA:
// 0 / 0
// 000000 / 000000
// NULL
// UNDEFINED
// VALORES INVÁLIDOS
// ======================================================

function coordenadas(p: Pacote) {
  const dados = p as any;

  const latitudeOriginal =
    dados.latitudeEntrega ??
    dados.latitude ??
    dados.latEntrega ??
    dados.lat ??
    null;

  const longitudeOriginal =
    dados.longitudeEntrega ??
    dados.longitude ??
    dados.lngEntrega ??
    dados.lng ??
    null;

  if (
    latitudeOriginal === null ||
    latitudeOriginal === undefined ||
    longitudeOriginal === null ||
    longitudeOriginal === undefined
  ) {
    return null;
  }

  const lat = Number(latitudeOriginal);
  const lng = Number(longitudeOriginal);

  if (
    !Number.isFinite(lat) ||
    !Number.isFinite(lng)
  ) {
    return null;
  }

  // IGNORA QUALQUER ZERO
  if (
    Math.abs(lat) < 0.000001 ||
    Math.abs(lng) < 0.000001
  ) {
    return null;
  }

  if (
    lat < -90 ||
    lat > 90 ||
    lng < -180 ||
    lng > 180
  ) {
    return null;
  }

  return {
    lat,
    lng,
  };
}

// ======================================================
// USUÁRIO
// ======================================================

function usuarioEmailMapa(p: Pacote) {
  const dados = p as any;

  return String(
    dados.usuarioFinalizacao ||
      dados.usuarioEmail ||
      dados.usuario ||
      dados.emailUsuario ||
      ""
  ).trim();
}

// ======================================================
// COR USUÁRIO
// ======================================================

function corUsuario(
  usuario: string,
  usuarios: string[]
) {
  const index = Math.max(
    0,
    usuarios.indexOf(usuario)
  );

  return CORES_USUARIO[
    index % CORES_USUARIO.length
  ];
}

// ======================================================
// NORMALIZAR TIPO
// ======================================================

function normalizarTipo(tipo: unknown) {
  return String(tipo || "")
    .trim()
    .toUpperCase()
    .replace(/[\s-]+/g, "_");
}

// ======================================================
// ÍCONE
// ======================================================

function criarIcone(ponto: Ponto) {
  const tipo = normalizarTipo(ponto.tipo);

  let src = pinAvulso;

  if (
    tipo === "MERCADO_LIVRE" ||
    tipo === "ML" ||
    tipo.includes("MERCADO")
  ) {
    src = pinML;
  } else if (
    tipo === "SHOPEE" ||
    tipo === "SH" ||
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

// ======================================================
// FOCA AUTOMATICAMENTE NAS ENTREGAS
// ======================================================

function AjustarMapa({
  points,
}: {
  points: Ponto[];
}) {
  const map = useMap();

  const assinatura = useMemo(
    () =>
      points
        .map(
          p =>
            `${p.id}:${p.lat.toFixed(6)}:${p.lng.toFixed(6)}`
        )
        .join("|"),
    [points]
  );

  useEffect(() => {
    if (!points.length) {
      return;
    }

    if (points.length === 1) {
      map.flyTo(
        [
          points[0].lat,
          points[0].lng,
        ],
        16,
        {
          duration: 0.7,
        }
      );

      return;
    }

    const bounds = L.latLngBounds(
      points.map(
        p =>
          [p.lat, p.lng] as [
            number,
            number
          ]
      )
    );

    map.flyToBounds(
      bounds.pad(0.12),
      {
        maxZoom: 17,
        padding: [40, 40],
        duration: 0.7,
      }
    );
  }, [map, assinatura]);

  return null;
}


// ======================================================
// REGIÕES DO MAPA
// ======================================================

type PontoRegiao = [number, number];

type RegiaoMapa = {
  id: string;
  nome: string;
  cor: string;
  entregadores: string[];
  pontos: PontoRegiao[];
  criadoPor?: string;
  criadoEm?: any;
  atualizadoEm?: any;
};

type MovimentoSlaRegiao = {
  data: number;
  status: "COLETADO" | "ROTA" | "ENTREGUE" | "AUSENTE";
  usuario: string;
};

type DiaSlaRegiao = {
  data: number;
  pacotes: number;
  rota: number;
  entregues: number;
  ausentes: number;
  retornos: number;
  retornaramParaRota: number;
  retornosPosteriormenteEntregues: number;
  primeira: number | null;
  ultima: number | null;
  mlAte21: number;
  mlEntre21e23: number;
  mlApos23: number;
};

type SlaRegiao = {
  id: string;
  nome: string;
  dias: Record<string, DiaSlaRegiao>;
};

function usuarioIdRegiao(p: any) {
  return String(
    p?.usuarioFinalizacao ||
      p?.usuario ||
      p?.usuarioEntrega ||
      p?.entregador ||
      p?.emailUsuario ||
      p?.userEmail ||
      p?.usuarioEmail ||
      p?.uidUsuario ||
      ""
  ).trim().toLowerCase();
}

function dataHistoricoRegiao(valor: any) {
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

function movimentosSlaRegiao(pacote: any): MovimentoSlaRegiao[] {
  const fonte = pacote?.historico;
  const itens = Array.isArray(fonte)
    ? fonte
    : fonte && typeof fonte === "object"
      ? Object.values(fonte)
      : [];

  return itens
    .filter((item): item is Record<string, any> =>
      Boolean(item) && typeof item === "object" && !Array.isArray(item)
    )
    .map((item) => ({
      data: dataHistoricoRegiao(item.dataHora),
      status: String(item.status || "").trim().toUpperCase(),
      usuario: String(
        item.usuario || item.entregador || item.motorista || item.responsavel || ""
      ).trim().toLowerCase(),
    }))
    .filter(
      (item): item is MovimentoSlaRegiao =>
        item.data !== null &&
        (item.status === "COLETADO" ||
          item.status === "ROTA" ||
          item.status === "ENTREGUE" ||
          item.status === "AUSENTE")
    )
    .sort((a, b) => a.data - b.data);
}

function chaveDiaSlaRegiao(data: number) {
  const d = new Date(data);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate()
  ).padStart(2, "0")}`;
}

function inicioDiaSlaRegiao(valor: string) {
  const [ano, mes, dia] = valor.split("-").map(Number);
  return new Date(ano, mes - 1, dia).getTime();
}

function isBaixaAutomaticaSlaRegiao(movimento: MovimentoSlaRegiao) {
  const d = new Date(movimento.data);
  const minutos = d.getHours() * 60 + d.getMinutes();
  return (
    (movimento.status === "ENTREGUE" || movimento.status === "AUSENTE") &&
    minutos >= 23 * 60 + 40
  );
}

function isMercadoLivreSlaRegiao(pacote: any) {
  const texto = [pacote?.empresa, pacote?.tipo, pacote?.transportadora, pacote?.origem]
    .filter(Boolean)
    .join(" ")
    .toUpperCase()
    .replace(/\s+/g, " ");
  return (
    texto.includes("MERCADO LIVRE") ||
    texto.includes("MERCADOLIVRE") ||
    texto.includes("MELI")
  );
}

function calcularSlaRegiao(items: any[], nomes: Record<string, string>) {
  const mapa = new Map<string, SlaRegiao>();
  const obter = (id: string) => {
    if (!mapa.has(id)) {
      mapa.set(id, { id, nome: nomes[id] || id || "Sem usuário", dias: {} });
    }
    return mapa.get(id)!;
  };

  items.forEach((pacote) => {
    const movimentos = movimentosSlaRegiao(pacote);
    if (!movimentos.length) return;

    const idPacote = usuarioIdRegiao(pacote);
    const id = idPacote || movimentos.find((m) => m.usuario)?.usuario || "";
    if (!id) return;

    const porDia = new Map<string, MovimentoSlaRegiao[]>();
    movimentos.forEach((movimento) => {
      const chave = chaveDiaSlaRegiao(movimento.data);
      const lista = porDia.get(chave) || [];
      lista.push(movimento);
      porDia.set(chave, lista);
    });

    const score = obter(id);
    porDia.forEach((movimentosDoDia, chave) => {
      const rotas = movimentosDoDia.filter((m) => m.status === "ROTA");
      const baixas = movimentosDoDia.filter(
        (m) => m.status === "ENTREGUE" || m.status === "AUSENTE"
      );
      if (!rotas.length && !baixas.length) return;

      const dia =
        score.dias[chave] ||
        (score.dias[chave] = {
          data: inicioDiaSlaRegiao(chave),
          pacotes: 0,
          rota: 0,
          entregues: 0,
          ausentes: 0,
          retornos: 0,
          retornaramParaRota: 0,
          retornosPosteriormenteEntregues: 0,
          primeira: null,
          ultima: null,
          mlAte21: 0,
          mlEntre21e23: 0,
          mlApos23: 0,
        });

      dia.pacotes++;

      const dataAnterior = new Date(inicioDiaSlaRegiao(chave));
      dataAnterior.setDate(dataAnterior.getDate() - 1);
      const chaveAnterior = chaveDiaSlaRegiao(dataAnterior.getTime());
      const ausenteNoDiaAnterior = movimentos.some(
        (m) => chaveDiaSlaRegiao(m.data) === chaveAnterior && m.status === "AUSENTE"
      );
      const teveEntregueHoje = movimentosDoDia.some((m) => m.status === "ENTREGUE");

      if (ausenteNoDiaAnterior && (rotas.length > 0 || teveEntregueHoje)) {
        dia.retornos++;
      }

      if (rotas.length) {
        dia.rota++;
        dia.primeira = dia.primeira === null ? rotas[0].data : Math.min(dia.primeira, rotas[0].data);
        if (ausenteNoDiaAnterior) dia.retornaramParaRota++;
      }

      if (ausenteNoDiaAnterior && teveEntregueHoje) {
        dia.retornosPosteriormenteEntregues++;
      }

      const ultimaBaixa = baixas[baixas.length - 1];
      if (ultimaBaixa?.status === "ENTREGUE") dia.entregues++;
      else if (ultimaBaixa?.status === "AUSENTE") dia.ausentes++;

      const baixasParaUltima = baixas.filter((m) => !isBaixaAutomaticaSlaRegiao(m));
      if (baixasParaUltima.length) {
        const ultimaHumana = baixasParaUltima[baixasParaUltima.length - 1].data;
        dia.ultima = dia.ultima === null ? ultimaHumana : Math.max(dia.ultima, ultimaHumana);
      }

      if (isMercadoLivreSlaRegiao(pacote)) {
        const entregas = movimentosDoDia.filter((m) => m.status === "ENTREGUE");
        const ultimaEntrega = entregas[entregas.length - 1];
        if (ultimaEntrega) {
          const d = new Date(ultimaEntrega.data);
          const minutos = d.getHours() * 60 + d.getMinutes();
          if (minutos <= 21 * 60) dia.mlAte21++;
          else if (minutos <= 23 * 60) dia.mlEntre21e23++;
          else dia.mlApos23++;
        }
      }
    });
  });

  return Array.from(mapa.values());
}

function consolidarSlaRegiao(dados: SlaRegiao[]) {
  const dias = dados.flatMap((item) => Object.values(item.dias));
  const total = dias.reduce((s, d) => s + d.pacotes, 0);
  const rota = dias.reduce((s, d) => s + d.rota, 0);
  const entregues = dias.reduce((s, d) => s + d.entregues, 0);
  const ausentes = dias.reduce((s, d) => s + d.ausentes, 0);
  const retornos = dias.reduce((s, d) => s + d.retornos, 0);
  const retornaramParaRota = dias.reduce((s, d) => s + d.retornaramParaRota, 0);
  const retornosPosteriormenteEntregues = dias.reduce((s, d) => s + d.retornosPosteriormenteEntregues, 0);
  const mlAte21 = dias.reduce((s, d) => s + d.mlAte21, 0);
  const mlEntre21e23 = dias.reduce((s, d) => s + d.mlEntre21e23, 0);
  const mlApos23 = dias.reduce((s, d) => s + d.mlApos23, 0);
  const primeira = dias.filter((d) => d.primeira !== null).reduce<number | null>((v, d) =>
    v === null ? d.primeira : Math.min(v, d.primeira!), null);
  const ultima = dias.filter((d) => d.ultima !== null).reduce<number | null>((v, d) =>
    v === null ? d.ultima : Math.max(v, d.ultima!), null);
  const sla = entregues + ausentes > 0 ? (entregues / (entregues + ausentes)) * 100 : 0;
  const mediaPorDia = dias.length ? total / dias.length : 0;
  const produtividade = primeira !== null && ultima !== null && ultima > primeira
    ? Math.round((entregues + ausentes) / ((ultima - primeira) / 3600000))
    : null;
  return {
    total, rota, entregues, ausentes, retornos, retornaramParaRota,
    retornosPosteriormenteEntregues, mlAte21, mlEntre21e23, mlApos23,
    sla, mediaPorDia, produtividade, dias: dias.length,
  };
}

function pontoDentroRegiao(lat: number, lng: number, pontos: PontoRegiao[]) {
  if (pontos.length < 3) return false;
  let dentro = false;
  for (let i = 0, j = pontos.length - 1; i < pontos.length; j = i++) {
    const [yi, xi] = pontos[i];
    const [yj, xj] = pontos[j];
    const cruza = xi > lng !== xj > lng && lat < ((yj - yi) * (lng - xi)) / (xj - xi) + yi;
    if (cruza) dentro = !dentro;
  }
  return dentro;
}

function pacotesDaRegiao(regiao: RegiaoMapa, pacotes: Pacote[]) {
  return pacotes.filter((p) => {
    const c = coordenadas(p);
    return c ? pontoDentroRegiao(c.lat, c.lng, regiao.pontos) : false;
  });
}

function MapaClique({
  ativo,
  onClique,
}: {
  ativo: boolean;
  onClique: (ponto: PontoRegiao) => void;
}) {
  useMapEvents({
    click(e) {
      if (ativo) onClique([e.latlng.lat, e.latlng.lng]);
    },
  });
  return null;
}

function nomeDataRegiao(valor: any) {
  const ms = dataHistoricoRegiao(valor);
  if (!ms) return "-";
  return new Date(ms).toLocaleDateString("pt-BR");
}

// ======================================================
// TELA MAPA
// ======================================================

export default function Mapa() {
  const { checkingAccess, allowed, isAdmin } = usePermission();

  const diaAnterior = getDiaAnterior();

  const [items, setItems] =
    useState<Pacote[]>([]);

  const [loading, setLoading] =
    useState(true);

  const [erro, setErro] =
    useState("");

  // FILTROS

  const [usuario, setUsuario] =
    useState("TODOS");

  const [tipo, setTipo] =
    useState("TODOS");

  const [status, setStatus] =
    useState("TODOS");

  // SEMPRE ABRE DIA ANTERIOR

  const [periodo, setPeriodo] =
    useState("DIA_ANTERIOR");

  const [ini, setIni] =
    useState(diaAnterior);

  const [fim, setFim] =
    useState(diaAnterior);

  const [nomes, setNomes] =
    useState<UserNameMap>({});

  const [regioes, setRegioes] = useState<RegiaoMapa[]>([]);
  const [modoRegiao, setModoRegiao] = useState(false);
  const [desenhando, setDesenhando] = useState(false);
  const [pontosDesenho, setPontosDesenho] = useState<PontoRegiao[]>([]);
  const [regiaoEditando, setRegiaoEditando] = useState<RegiaoMapa | null>(null);
  const [regiaoSelecionada, setRegiaoSelecionada] = useState<RegiaoMapa | null>(null);
  const [nomeRegiao, setNomeRegiao] = useState("");
  const [corRegiao, setCorRegiao] = useState("#1769e0");
  const [entregadoresRegiao, setEntregadoresRegiao] = useState<string[]>([]);
  const [salvandoRegiao, setSalvandoRegiao] = useState(false);
  const [carregandoRegioes, setCarregandoRegioes] = useState(false);


  // ====================================================
  // CARREGAR FIREBASE
  // ====================================================


  async function carregarRegioes() {
    if (!isAdmin) return;
    setCarregandoRegioes(true);
    try {
      const snap = await getDocs(collection(db, "regioes_mapa"));
      const lista: RegiaoMapa[] = snap.docs.map((item) => {
        const data = item.data() as any;
        return {
          id: item.id,
          nome: String(data.nome || "Região sem nome"),
          cor: String(data.cor || "#1769e0"),
          entregadores: Array.isArray(data.entregadores) ? data.entregadores.map(String) : [],
          pontos: Array.isArray(data.pontos)
            ? data.pontos.map((p: any) => [Number(p[0]), Number(p[1])] as PontoRegiao)
            : [],
          criadoPor: data.criadoPor,
          criadoEm: data.criadoEm,
          atualizadoEm: data.atualizadoEm,
        };
      }).filter((r) => r.pontos.length >= 3);
      setRegioes(lista);
    } catch (error) {
      console.error("Erro ao carregar regiões:", error);
      setErro("Não foi possível carregar as regiões do mapa.");
    } finally {
      setCarregandoRegioes(false);
    }
  }

  async function carregar() {
    setLoading(true);
    setErro("");

    try {
      const [
        pacotes,
        mapaNomes,
      ] = await Promise.all([
        listarPacotes(),
        carregarNomesUsuarios(),
      ]);

      setItems(pacotes);
      setNomes(mapaNomes);
    } catch (e) {
      console.error(e);

      setErro(
        "Não foi possível carregar os dados do mapa."
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (allowed) {
      carregar();
    }
  }, [allowed]);

  useEffect(() => {
    if (isAdmin) carregarRegioes();
  }, [isAdmin]);

  // ====================================================
  // CALCULAR PERÍODO
  // ====================================================

  const intervaloFiltro = useMemo(() => {
    const agora = new Date();

    const hoje = new Date(
      agora.getFullYear(),
      agora.getMonth(),
      agora.getDate()
    );

    const inicioHoje = hoje.getTime();

    const inicioOntem = new Date(
      hoje.getFullYear(),
      hoje.getMonth(),
      hoje.getDate() - 1
    ).getTime();

    if (periodo === "DIA_ANTERIOR") {
      return {
        inicio: inicioOntem,
        fim: inicioHoje - 1,
      };
    }

    if (periodo === "HOJE") {
      return {
        inicio: inicioHoje,
        fim: agora.getTime(),
      };
    }

    if (periodo === "7_DIAS") {
      const inicio7 = new Date(
        hoje.getFullYear(),
        hoje.getMonth(),
        hoje.getDate() - 6
      ).getTime();

      return {
        inicio: inicio7,
        fim: agora.getTime(),
      };
    }

    if (periodo === "30_DIAS") {
      const inicio30 = new Date(
        hoje.getFullYear(),
        hoje.getMonth(),
        hoje.getDate() - 29
      ).getTime();

      return {
        inicio: inicio30,
        fim: agora.getTime(),
      };
    }

    if (periodo === "PERSONALIZADO") {
      return {
        inicio: new Date(
          `${ini}T00:00:00`
        ).getTime(),

        fim: new Date(
          `${fim}T23:59:59.999`
        ).getTime(),
      };
    }

    return {
      inicio: 0,
      fim: Number.MAX_SAFE_INTEGER,
    };
  }, [periodo, ini, fim]);

  // ====================================================
  // ITENS DENTRO DA DATA FILTRADA
  // ISSO É USADO TAMBÉM PARA MOSTRAR
  // SOMENTE USUÁRIOS ATIVOS NO PERÍODO
  // ====================================================

  const itemsPeriodo = useMemo(() => {
    return items.filter(p => {
      const dados = p as any;

      const dataRef = timestampMs(
        dados.dataHoraBaixa ||
          dados.data
      );

      if (!dataRef) {
        return false;
      }

      return (
        dataRef >= intervaloFiltro.inicio &&
        dataRef <= intervaloFiltro.fim
      );
    });
  }, [items, intervaloFiltro]);

  // ====================================================
  // SOMENTE USUÁRIOS QUE TÊM PACOTES
  // NA DATA/PERÍODO SELECIONADO
  // ====================================================

  const usuariosAtivos = useMemo(() => {
    return Array.from(
      new Set(
        itemsPeriodo
          .map(usuarioEmailMapa)
          .filter(Boolean)
      )
    ).sort((a, b) =>
      a.localeCompare(b)
    );
  }, [itemsPeriodo]);

  const usuariosDisponiveis = useMemo(() => {
    const ids = new Set<string>(Object.keys(nomes));
    items.forEach((p) => {
      const id = usuarioEmailMapa(p);
      if (id) ids.add(id);
    });
    return Array.from(ids).filter(Boolean).sort((a, b) => a.localeCompare(b));
  }, [items, nomes]);

  // SE O USUÁRIO SELECIONADO DEIXAR DE TER
  // ATIVIDADE NO NOVO PERÍODO, VOLTA PARA TODOS

  useEffect(() => {
    if (
      usuario !== "TODOS" &&
      !usuariosAtivos.includes(usuario)
    ) {
      setUsuario("TODOS");
    }
  }, [usuario, usuariosAtivos]);

  // ====================================================
  // PONTOS FILTRADOS
  // ====================================================

  const pontos = useMemo<Ponto[]>(() => {
    return itemsPeriodo
      .map(p => {
        const c = coordenadas(p);

        if (!c) {
          return null;
        }

        return {
          ...p,
          ...c,
          usuarioMapa:
            usuarioEmailMapa(p),
        } as Ponto;
      })

      .filter(
        (p): p is Ponto =>
          p !== null
      )

      .filter(p => {
        // USUÁRIO

        if (
          usuario !== "TODOS" &&
          p.usuarioMapa !== usuario
        ) {
          return false;
        }

        // TIPO

        if (
          tipo !== "TODOS" &&
          normalizarTipo(p.tipo) !== tipo
        ) {
          return false;
        }

        // STATUS

        if (
          status !== "TODOS" &&
          p.status !== status
        ) {
          return false;
        }

        return true;
      });
  }, [
    itemsPeriodo,
    usuario,
    tipo,
    status,
  ]);

  // ====================================================
  // PACOTES SEM COORDENADAS VÁLIDAS
  // APENAS DENTRO DO PERÍODO
  // ====================================================

  const semCoordenadas =
    itemsPeriodo.length -
    itemsPeriodo.filter(
      p => coordenadas(p) !== null
    ).length;

  // ====================================================
  // ALTERAR PERÍODO
  // ====================================================

  function alterarPeriodo(
    valor: string
  ) {
    setPeriodo(valor);

    const hoje = new Date();
    hoje.setHours(12, 0, 0, 0);

    if (
      valor === "DIA_ANTERIOR"
    ) {
      hoje.setDate(
        hoje.getDate() - 1
      );

      const ontem =
        dataLocal(hoje);

      setIni(ontem);
      setFim(ontem);
    }

    if (valor === "HOJE") {
      const dataHoje =
        dataLocal(new Date());

      setIni(dataHoje);
      setFim(dataHoje);
    }

    if (
      valor === "7_DIAS"
    ) {
      const inicio =
        new Date();

      inicio.setDate(
        inicio.getDate() - 6
      );

      setIni(dataLocal(inicio));
      setFim(
        dataLocal(new Date())
      );
    }

    if (
      valor === "30_DIAS"
    ) {
      const inicio =
        new Date();

      inicio.setDate(
        inicio.getDate() - 29
      );

      setIni(dataLocal(inicio));
      setFim(
        dataLocal(new Date())
      );
    }
  }

  // ====================================================
  // ENDEREÇO NO POPUP
  // USA O ENDEREÇO JÁ SALVO NO PACOTE
  // ====================================================

  function pegarEndereco(
    p: Ponto
  ) {
    const dados = p as any;

    const campos = [
      "enderecoBaixa",
      "enderecoEntrega",
      "endereco",
      "localEntrega",
      "enderecoCompleto",
      "address",
      "logradouro",
      "rua",
      "local",
    ];

    for (const campo of campos) {
      const valor = dados[campo];

      if (
        valor !== null &&
        valor !== undefined &&
        String(valor).trim()
      ) {
        return String(valor).trim();
      }
    }

    return "Endereço da baixa não disponível";
  }


  function iniciarNovaRegiao() {
    if (!isAdmin) return;
    setModoRegiao(true);
    setDesenhando(true);
    setPontosDesenho([]);
    setRegiaoEditando(null);
    setRegiaoSelecionada(null);
    setNomeRegiao("");
    setCorRegiao("#1769e0");
    setEntregadoresRegiao([]);
  }

  function cancelarEdicaoRegiao() {
    setModoRegiao(false);
    setDesenhando(false);
    setPontosDesenho([]);
    setRegiaoEditando(null);
    setNomeRegiao("");
    setEntregadoresRegiao([]);
  }

  function editarRegiao(regiao: RegiaoMapa) {
    if (!isAdmin) return;
    setModoRegiao(true);
    setDesenhando(false);
    setRegiaoEditando({ ...regiao, pontos: regiao.pontos.map((p) => [...p] as PontoRegiao) });
    setPontosDesenho([]);
    setNomeRegiao(regiao.nome);
    setCorRegiao(regiao.cor);
    setEntregadoresRegiao([...regiao.entregadores]);
    setRegiaoSelecionada(regiao);
  }

  async function salvarRegiao() {
    if (!isAdmin) return;
    const pontos = regiaoEditando?.pontos || pontosDesenho;
    if (pontos.length < 3) {
      setErro("A região precisa de pelo menos 3 pontos.");
      return;
    }
    if (!nomeRegiao.trim()) {
      setErro("Informe o nome da região.");
      return;
    }
    setSalvandoRegiao(true);
    setErro("");
    try {
      const payload = {
        nome: nomeRegiao.trim(),
        cor: corRegiao,
        entregadores: entregadoresRegiao,
        pontos,
        atualizadoEm: serverTimestamp(),
      };
      if (regiaoEditando) {
        await updateDoc(doc(db, "regioes_mapa", regiaoEditando.id), payload);
      } else {
        const ref = await addDoc(collection(db, "regioes_mapa"), {
          ...payload,
          criadoPor: auth.currentUser?.uid || auth.currentUser?.email || "",
          criadoEm: serverTimestamp(),
        });
        payload.pontos = pontos;
        setRegiaoEditando({
          id: ref.id,
          nome: payload.nome,
          cor: payload.cor,
          entregadores: payload.entregadores,
          pontos: payload.pontos,
        });
      }
      await carregarRegioes();
      cancelarEdicaoRegiao();
    } catch (error) {
      console.error("Erro ao salvar região:", error);
      setErro("Não foi possível salvar a região.");
    } finally {
      setSalvandoRegiao(false);
    }
  }

  async function excluirRegiao(regiao: RegiaoMapa) {
    if (!isAdmin) return;
    if (!window.confirm(`Excluir a região "${regiao.nome}"?`)) return;
    try {
      await deleteDoc(doc(db, "regioes_mapa", regiao.id));
      if (regiaoSelecionada?.id === regiao.id) setRegiaoSelecionada(null);
      if (regiaoEditando?.id === regiao.id) cancelarEdicaoRegiao();
      await carregarRegioes();
    } catch (error) {
      console.error("Erro ao excluir região:", error);
      setErro("Não foi possível excluir a região.");
    }
  }

  function atualizarVertice(index: number, ponto: PontoRegiao) {
    setRegiaoEditando((atual) => {
      if (!atual) return atual;
      const pontos = atual.pontos.map((p, i) => i === index ? ponto : p);
      return { ...atual, pontos };
    });
  }

  const todasRegioesVisiveis = regioes;

  // ====================================================
  // CARREGANDO PERMISSÃO
  // MESMO PADRÃO DO DASHBOARD
  // ====================================================

  if (checkingAccess) {
    return (
      <div>
        <PageHeader
          title="Mapa operacional"
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
  // MESMO PADRÃO DO DASHBOARD
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
              Você não possui permissão para acessar o Mapa operacional.
            </p>
          </div>
        </section>
      </div>
    );
  }

  // RENDER
  // ====================================================

  return (
    <div>
      <PageHeader
        title="Mapa operacional"
        subtitle="Visualização das entregas, regiões e SLA."
      />

      <div className="map-toolbar">
        <div className="map-filter-title">
          <Filter size={16} />
          <span>Filtros do mapa</span>
        </div>

        <select value={usuario} onChange={(e) => setUsuario(e.target.value)}>
          <option value="TODOS">Todos os usuários ativos</option>
          {usuariosAtivos.map((u) => (
            <option key={u} value={u}>{nomeUsuario(u, nomes)}</option>
          ))}
        </select>

        <select value={tipo} onChange={(e) => setTipo(e.target.value)}>
          <option value="TODOS">Todos os tipos</option>
          <option value="MERCADO_LIVRE">Mercado Livre</option>
          <option value="SHOPEE">Shopee</option>
          <option value="AVULSO">Avulso</option>
        </select>

        <select value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="TODOS">Todos os status</option>
          {(["COLETADO", "ROTA", "ENTREGUE", "AUSENTE", "DEVOLVIDO"] as StatusPacote[]).map((s) => (
            <option key={s} value={s}>{nomeStatus(s)}</option>
          ))}
        </select>

        <select value={periodo} onChange={(e) => alterarPeriodo(e.target.value)}>
          <option value="DIA_ANTERIOR">Dia anterior</option>
          <option value="HOJE">Hoje</option>
          <option value="7_DIAS">Últimos 7 dias</option>
          <option value="30_DIAS">Últimos 30 dias</option>
          <option value="PERSONALIZADO">Personalizado</option>
          <option value="TODOS">Todo período</option>
        </select>

        {periodo === "PERSONALIZADO" && (
          <>
            <label className="map-date">De<input type="date" value={ini} onChange={(e) => setIni(e.target.value)} /></label>
            <label className="map-date">Até<input type="date" value={fim} onChange={(e) => setFim(e.target.value)} /></label>
          </>
        )}

        <button className="secondary map-reload" onClick={carregar} disabled={loading}>
          <RefreshCw size={15} className={loading ? "spin" : ""} /> Atualizar
        </button>

        {isAdmin && (
          <button
            className={modoRegiao ? "secondary" : "primary"}
            onClick={modoRegiao ? cancelarEdicaoRegiao : iniciarNovaRegiao}
            disabled={salvandoRegiao}
          >
            {modoRegiao ? <X size={15} /> : <Plus size={15} />}
            {modoRegiao ? "Sair da edição" : "Editar regiões"}
          </button>
        )}
      </div>

      {isAdmin && modoRegiao && (
        <div style={{ margin: "10px 0", padding: "12px 14px", borderRadius: 12, background: "#eef5ff", color: "#175cd3", fontSize: 13 }}>
          {desenhando
            ? `Modo desenho ativo: clique no mapa para adicionar os pontos da região. ${pontosDesenho.length} ponto(s).`
            : "Modo edição ativo: arraste os pontos da região para alterar o desenho."}
          {desenhando && pontosDesenho.length >= 3 && (
            <button className="secondary" style={{ marginLeft: 10 }} onClick={() => setDesenhando(false)}>
              <Check size={14} /> Fechar desenho
            </button>
          )}
        </div>
      )}

      <div className="map-summary">
        <div><MapPinned size={17} /><b>{pontos.length}</b><span>pontos exibidos</span></div>
        <div><Users size={17} /><b>{usuariosAtivos.length}</b><span>usuários ativos no período</span></div>
        <div><Package size={17} /><b>{semCoordenadas}</b><span>coordenadas inválidas</span></div>
        <div><MapIcon size={17} /><b>{regioes.length}</b><span>regiões salvas</span></div>
      </div>

      <div className="map-layout">
        <aside className="map-users-panel">
          <div className="map-panel-head"><b>Usuários ativos</b><span>{usuariosAtivos.length}</span></div>
          <button className={`map-user-row ${usuario === "TODOS" ? "active" : ""}`} onClick={() => setUsuario("TODOS")}>
            <span className="map-user-dot all" /><span>Todos</span><b>{pontos.length}</b>
          </button>
          {usuariosAtivos.map((u) => {
            const total = pontos.filter((p) => p.usuarioMapa === u).length;
            return (
              <button key={u} className={`map-user-row ${usuario === u ? "active" : ""}`} onClick={() => setUsuario(u)}>
                <span className="map-user-dot" style={{ background: corUsuario(u, usuariosAtivos) }} />
                <span title={u}>{nomeUsuario(u, nomes)}</span><b>{total}</b>
              </button>
            );
          })}
          <div className="map-legend">
            <b>Legenda dos pacotes</b>
            <span><i className="legend-ml">ML</i>Mercado Livre</span>
            <span><i className="legend-shopee">S</i>Shopee</span>
            <span><i className="legend-avulso">A</i>Avulso</span>
          </div>

          <div style={{ marginTop: 14, borderTop: "1px solid #eaecf0", paddingTop: 12 }}>
            <div className="map-panel-head"><b>Regiões</b><span>{regioes.length}</span></div>
            {carregandoRegioes && <div style={{ padding: 10, fontSize: 12, color: "#667085" }}>Carregando...</div>}
            {regioes.map((r) => (
              <button key={r.id} className="map-user-row" onClick={() => setRegiaoSelecionada(r)}>
                <span className="map-user-dot" style={{ background: r.cor }} />
                <span title={r.nome}>{r.nome}</span>
                <b>{pacotesDaRegiao(r, items).length}</b>
              </button>
            ))}
          </div>
        </aside>

        <div className="map-card">
          <MapContainer center={[-23.511, -46.876]} zoom={12} style={{ height: "100%", width: "100%" }}>
            <TileLayer
              attribution="&copy; OpenStreetMap contributors &copy; CARTO"
              url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png?key=cb1_2sk6_1_9337bda9074165b27049c045"
              subdomains="abcd"
              maxZoom={20}
            />

            <AjustarMapa points={pontos} />
            <MapaClique ativo={isAdmin && modoRegiao && desenhando} onClique={(ponto) => setPontosDesenho((atual) => [...atual, ponto])} />

            {todasRegioesVisiveis.map((r) => (
              <Polygon
                key={r.id}
                positions={r.pontos}
                pathOptions={{ color: r.cor, fillColor: r.cor, fillOpacity: 0.14, weight: 2 }}
                eventHandlers={{ click: () => setRegiaoSelecionada(r) }}
              />
            ))}

            {modoRegiao && desenhando && pontosDesenho.length >= 2 && (
              <Polygon positions={pontosDesenho} pathOptions={{ color: corRegiao, fillColor: corRegiao, fillOpacity: 0.12, dashArray: "6 6", weight: 2 }} />
            )}

            {modoRegiao && regiaoEditando && regiaoEditando.pontos.map((p, index) => (
              <Marker
                key={`${regiaoEditando.id}-vertice-${index}`}
                position={p}
                draggable
                eventHandlers={{ dragend: (event) => {
                  const marker = event.target as L.Marker;
                  const pos = marker.getLatLng();
                  atualizarVertice(index, [pos.lat, pos.lng]);
                }}}
                icon={L.divIcon({ className: "", html: `<div style="width:12px;height:12px;border-radius:50%;background:${corRegiao};border:2px solid #fff;box-shadow:0 1px 5px rgba(0,0,0,.35)"></div>`, iconSize: [16, 16], iconAnchor: [8, 8] })}
              />
            ))}

            {modoRegiao && desenhando && pontosDesenho.map((p, index) => (
              <Marker key={`desenho-${index}`} position={p} icon={L.divIcon({ className: "", html: `<div style="width:10px;height:10px;border-radius:50%;background:${corRegiao};border:2px solid #fff"></div>`, iconSize: [14, 14], iconAnchor: [7, 7] })} />
            ))}

            {pontos.map((p) => (
              <Marker key={p.id} position={[p.lat, p.lng]} icon={criarIcone(p)}>
                <Popup>
                  <div className="map-popup">
                    <b>{p.codigo}</b>
                    <span>{nomeTipo(String(p.tipo))}</span>
                    <span>{nomeStatus(p.status)}</span>
                    <hr />
                    <span><strong>Usuário:</strong> {nomeUsuario(p.usuarioMapa, nomes, (p as any).usuarioNome)}</span>
                    <span><strong>Empresa:</strong> {p.empresa || "-"}</span>
                    <span><strong>Baixa:</strong> {formatarData((p as any).dataHoraBaixa || p.data)}</span>
                    <span><strong>Local:</strong> {pegarEndereco(p)}</span>
                  </div>
                </Popup>
              </Marker>
            ))}
          </MapContainer>

          {!loading && !pontos.length && <div className="map-empty"><LocateFixed size={15} />Nenhuma entrega encontrada para o período e filtros selecionados.</div>}
          {loading && <div className="map-loading">Carregando pontos do Firebase...</div>}
          {erro && <div className="map-error">{erro}</div>}
        </div>
      </div>

      {isAdmin && modoRegiao && (
        <section className="card" style={{ marginTop: 14, padding: 16 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, marginBottom: 14 }}>
            <div>
              <h3 style={{ margin: 0 }}>{regiaoEditando ? "Editar região" : "Nova região"}</h3>
              <div style={{ fontSize: 12, color: "#667085", marginTop: 4 }}>Defina nome, cor e entregadores responsáveis.</div>
            </div>
            <button className="secondary" onClick={cancelarEdicaoRegiao}><X size={15} />Cancelar</button>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "minmax(220px, 1fr) 120px minmax(260px, 2fr)", gap: 12, alignItems: "end" }}>
            <label style={{ display: "grid", gap: 6, fontSize: 12, fontWeight: 600 }}>
              Nome da região
              <input value={nomeRegiao} onChange={(e) => setNomeRegiao(e.target.value)} placeholder="Ex.: Região A" />
            </label>
            <label style={{ display: "grid", gap: 6, fontSize: 12, fontWeight: 600 }}>
              <span><Palette size={13} style={{ verticalAlign: "middle" }} /> Cor</span>
              <input type="color" value={corRegiao} onChange={(e) => setCorRegiao(e.target.value)} style={{ width: "100%", height: 40, padding: 2 }} />
            </label>
            <div>
              <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 6 }}>Entregadores da região</div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 7, maxHeight: 100, overflowY: "auto" }}>
                {usuariosDisponiveis.map((u) => {
                  const marcado = entregadoresRegiao.includes(u);
                  return (
                    <button key={u} type="button" className={marcado ? "primary" : "secondary"} onClick={() => setEntregadoresRegiao((atual) => marcado ? atual.filter((x) => x !== u) : [...atual, u])} style={{ fontSize: 12 }}>
                      {marcado ? <Check size={13} /> : <Users size={13} />} {nomeUsuario(u, nomes)}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 14 }}>
            <span style={{ fontSize: 12, color: "#667085" }}>{(regiaoEditando?.pontos || pontosDesenho).length} pontos no desenho</span>
            <button className="primary" onClick={salvarRegiao} disabled={salvandoRegiao || (regiaoEditando?.pontos || pontosDesenho).length < 3}>
              <Save size={15} /> {salvandoRegiao ? "Salvando..." : "Salvar região"}
            </button>
          </div>
        </section>
      )}

      {regiaoSelecionada && !modoRegiao && (() => {
        const pacotesRegiao = pacotesDaRegiao(regiaoSelecionada, items);
        const slaDados = calcularSlaRegiao(pacotesRegiao, nomes as Record<string, string>);
        const resumo = consolidarSlaRegiao(slaDados);
        const entregadores = regiaoSelecionada.entregadores;
        return (
          <section className="card" style={{ marginTop: 14, padding: 16 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
              <div>
                <h3 style={{ margin: 0, display: "flex", alignItems: "center", gap: 8 }}><span style={{ width: 14, height: 14, borderRadius: "50%", background: regiaoSelecionada.cor }} />{regiaoSelecionada.nome}</h3>
                <div style={{ marginTop: 5, color: "#667085", fontSize: 12 }}>{pacotesRegiao.length} pacotes dentro da região.</div>
              </div>
              <div style={{ display: "flex", gap: 7 }}>
                {isAdmin && <button className="secondary" onClick={() => editarRegiao(regiaoSelecionada)}><Pencil size={14} />Editar</button>}
                {isAdmin && <button className="secondary" onClick={() => excluirRegiao(regiaoSelecionada)}><Trash2 size={14} />Excluir</button>}
                <button className="secondary" onClick={() => setRegiaoSelecionada(null)}><X size={14} /></button>
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(6, minmax(110px, 1fr))", gap: 10, marginTop: 14 }}>
              {[
                ["SLA", `${resumo.sla.toFixed(1).replace(".", ",")}%`],
                ["Pacotes", resumo.total],
                ["Média/dia", resumo.mediaPorDia.toFixed(1).replace(".", ",")],
                ["Entregues", resumo.entregues],
                ["Ausentes", resumo.ausentes],
                ["ROTA", resumo.rota],
                ["Retornos", resumo.retornos],
                ["Voltaram à rota", resumo.retornaramParaRota],
                ["Post. entregues", resumo.retornosPosteriormenteEntregues],
                ["ML até 21h", resumo.mlAte21],
                ["ML 21–23h", resumo.mlEntre21e23],
                ["ML após 23h", resumo.mlApos23],
              ].map(([label, valor]) => (
                <div key={String(label)} style={{ border: "1px solid #eaecf0", borderRadius: 10, padding: 10 }}>
                  <div style={{ fontSize: 11, color: "#667085" }}>{label}</div>
                  <b style={{ fontSize: 18 }}>{valor}</b>
                </div>
              ))}
            </div>

            <div style={{ marginTop: 16 }}>
              <h4 style={{ margin: "0 0 9px" }}>Entregadores da região</h4>
              {!entregadores.length && <div style={{ color: "#667085", fontSize: 13 }}>Nenhum entregador associado.</div>}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(230px, 1fr))", gap: 10 }}>
                {entregadores.map((id) => {
                  const pacotesEntregador = pacotesRegiao.filter((p) => usuarioIdRegiao(p) === id.toLowerCase());
                  const dados = calcularSlaRegiao(pacotesEntregador, nomes as Record<string, string>);
                  const r = consolidarSlaRegiao(dados);
                  return (
                    <div key={id} style={{ border: "1px solid #eaecf0", borderRadius: 12, padding: 12 }}>
                      <b>{nomeUsuario(id, nomes) || id}</b>
                      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 7, marginTop: 9, fontSize: 12 }}>
                        <span><strong>SLA:</strong> {r.sla.toFixed(1).replace(".", ",")}%</span>
                        <span><strong>Pacotes:</strong> {r.total}</span>
                        <span><strong>Entregues:</strong> {r.entregues}</span>
                        <span><strong>Ausentes:</strong> {r.ausentes}</span>
                        <span><strong>ROTA:</strong> {r.rota}</span>
                        <span><strong>Retornos:</strong> {r.retornos}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </section>
        );
      })()}
    </div>
  );
}
