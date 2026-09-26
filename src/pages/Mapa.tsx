// ARQUIVO: src/pages/Mapa.tsx
// A tela conserva a origem e os filtros dos pacotes do Mapa original.

import { useEffect, useMemo, useState } from "react";
import {
  MapContainer,
  Marker,
  Popup,
  TileLayer,
  Polygon,
  Polyline,
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
  Eye,
  EyeOff,
  Map as MapIcon,
  Maximize2,
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

type PontoRegiao = [number, number];

type RegiaoMapa = {
  id: string;
  nome: string;
  cor: string;
  corBase?: string;
  /** Transparência da área: 0 (transparente) a 100 (sólida). */
  tom?: number;
  pontos: PontoRegiao[];
  ativa?: boolean;
  criadoPor?: string;
  criadoEm?: any;
  atualizadoEm?: any;
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

// ===========================================================================
// PALETA DAS REGIÕES — altere livremente as cores abaixo.
// A cor escolhida é usada no polígono, na legenda e no indicador central.
// ===========================================================================
const CORES_REGIAO = [
  "#1D4ED8",
  "#6D28D9",
  "#0E7490",
  "#15803D",
  "#C2410C",
  "#BE185D",
  "#115E59",
  "#A16207",
];

// Transparência da área da região: o campo `tom` vai de 0 (totalmente
// transparente) a 100 (cor sólida). É salvo no Firestore junto da região.
// Regiões antigas salvas com tom negativo (escurecer/clarear) voltam ao padrão.
const TOM_PADRAO = 50;

function normalizarTom(tom: unknown) {
  const n = Number(tom);
  return Number.isFinite(n) && n >= 0 && n <= 100 ? n : TOM_PADRAO;
}

function escaparHtml(texto: string) {
  return String(texto || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

const VERTEX_ICON = L.divIcon({
  className: "mapa-vertex-icon",
  html: '<span class="mapa-vertex-dot"></span>',
  iconSize: [20, 20],
  iconAnchor: [10, 10],
});

const MIDPOINT_ICON = L.divIcon({
  className: "mapa-midpoint-icon",
  html: '<span class="mapa-midpoint-plus">+</span>',
  iconSize: [22, 22],
  iconAnchor: [11, 11],
});

function usePermission() {
  const [checkingAccess, setCheckingAccess] = useState(true);
  const [allowed, setAllowed] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        setAllowed(false);
        setIsAdmin(false);
        setCheckingAccess(false);
        return;
      }

      try {
        let userDoc = await getDoc(doc(db, "usuarios", user.uid));

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
        setAllowed(admin || userData?.permissoes?.finalizados === true);
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

function dataLocal(d: Date) {
  const ano = d.getFullYear();
  const mes = String(d.getMonth() + 1).padStart(2, "0");
  const dia = String(d.getDate()).padStart(2, "0");
  return `${ano}-${mes}-${dia}`;
}

function getDiaAnterior() {
  const d = new Date();
  d.setHours(12, 0, 0, 0);
  d.setDate(d.getDate() - 1);
  return dataLocal(d);
}

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
    !Number.isFinite(lng) ||
    Math.abs(lat) < 0.000001 ||
    Math.abs(lng) < 0.000001 ||
    lat < -90 ||
    lat > 90 ||
    lng < -180 ||
    lng > 180
  ) {
    return null;
  }

  return { lat, lng };
}

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

function corUsuario(usuario: string, usuarios: string[]) {
  const index = Math.max(0, usuarios.indexOf(usuario));
  return CORES_USUARIO[index % CORES_USUARIO.length];
}

function normalizarTipo(tipo: unknown) {
  return String(tipo || "")
    .trim()
    .toUpperCase()
    .replace(/[\s-]+/g, "_");
}

function grupoTipoPacote(pacote: any): "MERCADO_LIVRE" | "SHOPEE" | "AVULSO" {
  const tipo = normalizarTipo(pacote?.tipo);
  if (tipo === "MERCADO_LIVRE" || tipo === "ML" || tipo.includes("MERCADO")) {
    return "MERCADO_LIVRE";
  }
  if (tipo === "SHOPEE" || tipo === "SH" || tipo.includes("SHOPEE")) {
    return "SHOPEE";
  }
  return "AVULSO";
}

function criarIcone(ponto: Ponto) {
  const grupo = grupoTipoPacote(ponto);
  let src = pinAvulso;
  if (grupo === "MERCADO_LIVRE") src = pinML;
  else if (grupo === "SHOPEE") src = pinShopee;

  return L.icon({
    iconUrl: src,
    iconSize: [30, 30],
    iconAnchor: [15, 28],
    popupAnchor: [0, -27],
    className: "aguia-custom-pin",
  });
}

function pararPropagacaoMapa(event: any) {
  if (event?.originalEvent) {
    L.DomEvent.stopPropagation(event.originalEvent);
    (event.originalEvent as any)._stopped = true;
  }
  ultimoCliqueCamadaMs = Date.now();
}

let ultimoCliqueCamadaMs = 0;

// Centro visual (centroide de área) do polígono da região.
function calcularCentroRegiao(pontos: PontoRegiao[]): PontoRegiao | null {
  if (!pontos.length) return null;
  if (pontos.length < 3) {
    const somaLat = pontos.reduce((soma, [lat]) => soma + lat, 0);
    const somaLng = pontos.reduce((soma, [, lng]) => soma + lng, 0);
    return [somaLat / pontos.length, somaLng / pontos.length];
  }

  let area = 0;
  let cx = 0;
  let cy = 0;

  for (let i = 0, j = pontos.length - 1; i < pontos.length; j = i++) {
    const [latI, lngI] = pontos[i];
    const [latJ, lngJ] = pontos[j];
    const cruz = lngJ * latI - lngI * latJ;
    area += cruz;
    cx += (lngJ + lngI) * cruz;
    cy += (latJ + latI) * cruz;
  }

  area *= 0.5;

  if (Math.abs(area) < 1e-12) {
    const somaLat = pontos.reduce((soma, [lat]) => soma + lat, 0);
    const somaLng = pontos.reduce((soma, [, lng]) => soma + lng, 0);
    return [somaLat / pontos.length, somaLng / pontos.length];
  }

  const centro: PontoRegiao = [cy / (6 * area), cx / (6 * area)];

  if (pontoDentroRegiao(centro[0], centro[1], pontos)) return centro;

  const lats = pontos.map(([lat]) => lat);
  const lngs = pontos.map(([, lng]) => lng);
  const alternativo: PontoRegiao = [
    (Math.min(...lats) + Math.max(...lats)) / 2,
    (Math.min(...lngs) + Math.max(...lngs)) / 2,
  ];
  return pontoDentroRegiao(alternativo[0], alternativo[1], pontos)
    ? alternativo
    : centro;
}

function AjustarMapa({
  points,
  regions,
}: {
  points: Ponto[];
  regions: RegiaoMapa[];
}) {
  const map = useMap();
  const assinatura = useMemo(
    () =>
      regions.length
        ? regions
            .map((r) =>
              `${r.id}:${r.pontos
                .map(([lat, lng]) => `${lat.toFixed(5)},${lng.toFixed(5)}`)
                .join(";")}`
            )
            .join("|")
        : points
            .map((p) => `${p.id}:${p.lat.toFixed(6)}:${p.lng.toFixed(6)}`)
            .join("|"),
    [points, regions]
  );

  useEffect(() => {
    // Prioridade 1: enquadrar TODAS as regiões cadastradas.
    const vertices = regions.flatMap((region) => region.pontos);
    if (vertices.length) {
      if (vertices.length === 1) {
        map.flyTo(vertices[0], 13, { duration: 0.65 });
        return;
      }
      map.flyToBounds(
        L.latLngBounds(vertices.map(([lat, lng]) => [lat, lng])).pad(0.08),
        { maxZoom: 14, padding: [70, 70], duration: 0.65 }
      );
      return;
    }

    // Prioridade 2 (sem regiões): comportamento original com os pacotes.
    if (!points.length) return;
    if (points.length === 1) {
      map.flyTo([points[0].lat, points[0].lng], 15, { duration: 0.65 });
      return;
    }
    const bounds = L.latLngBounds(
      points.map((p) => [p.lat, p.lng] as [number, number])
    );
    map.flyToBounds(bounds.pad(0.12), {
      maxZoom: 16,
      padding: [42, 42],
      duration: 0.65,
    });
  }, [map, assinatura, points, regions]);

  return null;
}

function MapaClique({
  ativo,
  onClique,
  onCliqueFora,
}: {
  ativo: boolean;
  onClique: (ponto: PontoRegiao) => void;
  onCliqueFora?: () => void;
}) {
  useMapEvents({
    click(event) {
      if (ativo) {
        onClique([event.latlng.lat, event.latlng.lng]);
        return;
      }
      if ((event.originalEvent as any)?._stopped) return;
      if (Date.now() - ultimoCliqueCamadaMs < 300) return;
      onCliqueFora?.();
    },
  });
  return null;
}

function ControleFocoMapa() {
  const map = useMap();

  useEffect(() => {
    const focar = (event: Event) => {
      const detail = (event as CustomEvent<{
        bounds?: L.LatLngBounds;
        center?: [number, number];
        zoom?: number;
      }>).detail;
      if (detail?.bounds?.isValid()) {
        map.flyToBounds(detail.bounds.pad(0.12), {
          maxZoom: 16,
          padding: [42, 42],
          duration: 0.65,
        });
      } else if (detail?.center) {
        map.flyTo(detail.center, detail.zoom || 15, { duration: 0.65 });
      }
    };

    window.addEventListener("mapa:focar", focar);
    return () => window.removeEventListener("mapa:focar", focar);
  }, [map]);

  return null;
}

function usuarioIdOperacao(p: any) {
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
  )
    .trim()
    .toLowerCase();
}

// As funções e regras abaixo reproduzem o cálculo usado por SlaOperacao
// em Operacao.tsx. A única diferença é que a lista recebida já está
// limitada aos pacotes geograficamente dentro da região selecionada.
type MovimentoSlaOperacao = {
  data: number;
  status: "COLETADO" | "ROTA" | "ENTREGUE" | "AUSENTE";
  usuario: string;
};

type DiaSlaOperacao = {
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

type SlaOperacao = {
  id: string;
  nome: string;
  dias: Record<string, DiaSlaOperacao>;
};

type ResumoSla = {
  total: number;
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
  sla: number;
  mediaPorDia: number;
  produtividade: string;
};

function dataHistoricoOperacao(valor: any) {
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

function movimentosSlaOperacao(pacote: any): MovimentoSlaOperacao[] {
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
    .map((item) => {
      const data = dataHistoricoOperacao(item.dataHora);
      const status = String(item.status || "")
        .trim()
        .toUpperCase();
      const usuario = String(
        item.usuario ||
          item.entregador ||
          item.motorista ||
          item.responsavel ||
          ""
      )
        .trim()
        .toLowerCase();

      return { data, status, usuario };
    })
    .filter(
      (item): item is MovimentoSlaOperacao =>
        item.data !== null &&
        (item.status === "COLETADO" ||
          item.status === "ROTA" ||
          item.status === "ENTREGUE" ||
          item.status === "AUSENTE")
    )
    .sort((a, b) => a.data - b.data);
}

function chaveDiaSlaOperacao(data: number) {
  const d = new Date(data);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(
    2,
    "0"
  )}-${String(d.getDate()).padStart(2, "0")}`;
}

function inicioDiaSlaOperacao(valor: string) {
  const [ano, mes, dia] = valor.split("-").map(Number);
  return new Date(ano, mes - 1, dia).getTime();
}

function isBaixaAutomaticaSlaOperacao(
  movimento: MovimentoSlaOperacao
) {
  const d = new Date(movimento.data);
  const minutos = d.getHours() * 60 + d.getMinutes();
  return (
    (movimento.status === "ENTREGUE" ||
      movimento.status === "AUSENTE") &&
    minutos >= 23 * 60 + 40
  );
}

function isMercadoLivreSlaOperacao(pacote: any) {
  // Os pacotes do Mapa gravam o tipo como "MERCADO_LIVRE" / "ML", por isso
  // underscores e hifens viram espaco antes da comparacao. Sem isso a
  // deteccao falhava e os horarios do Mercado Livre ficavam zerados.
  const texto = [
    pacote?.empresa,
    pacote?.tipo,
    pacote?.transportadora,
    pacote?.origem,
  ]
    .filter(Boolean)
    .join(" ")
    .toUpperCase()
    .replace(/[\s_\-.]+/g, " ")
    .trim();

  if (
    texto.includes("MERCADO LIVRE") ||
    texto.includes("MERCADOLIVRE") ||
    texto.includes("MELI")
  ) {
    return true;
  }

  // "ML" isolado (token), nunca dentro de outra palavra.
  if (texto.split(" ").includes("ML")) return true;

  // Mesma classificacao usada pelos pins do mapa.
  return grupoTipoPacote(pacote) === "MERCADO_LIVRE";
}

function valorProdutividadeSlaOperacao(
  primeira: number | null,
  ultima: number | null,
  finalizados: number
) {
  if (primeira === null || ultima === null || finalizados === 0) {
    return "-";
  }

  const horas = (ultima - primeira) / 3600000;
  return horas <= 0
    ? "-"
    : `${Math.round(finalizados / horas)}/h`;
}

function construirSlaOperacao(
  items: Pacote[],
  nomes: UserNameMap
): SlaOperacao[] {
  const mapa = new Map<string, SlaOperacao>();
  const obter = (id: string) => {
    if (!mapa.has(id)) {
      mapa.set(id, {
        id,
        nome: (nomes as Record<string, string>)[id] || id || "Sem usuário",
        dias: {},
      });
    }
    return mapa.get(id)!;
  };

  items.forEach((pacote) => {
    const movimentos = movimentosSlaOperacao(pacote);
    if (!movimentos.length) return;

    const idPacote = usuarioIdOperacao(pacote);
    const id =
      idPacote ||
      movimentos.find((movimento) => movimento.usuario)?.usuario ||
      "";
    if (!id) return;

    const porDia = new Map<string, MovimentoSlaOperacao[]>();
    movimentos.forEach((movimento) => {
      const chave = chaveDiaSlaOperacao(movimento.data);
      const lista = porDia.get(chave) || [];
      lista.push(movimento);
      porDia.set(chave, lista);
    });

    const score = obter(id);
    porDia.forEach((movimentosDoDia, chave) => {
      const rotas = movimentosDoDia.filter(
        (movimento) => movimento.status === "ROTA"
      );
      const baixas = movimentosDoDia.filter(
        (movimento) =>
          movimento.status === "ENTREGUE" ||
          movimento.status === "AUSENTE"
      );

      // COLETADO sozinho não cria um registro de SLA.
      if (!rotas.length && !baixas.length) return;

      const dia =
        score.dias[chave] ||
        (score.dias[chave] = {
          data: inicioDiaSlaOperacao(chave),
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

      const dataAnterior = new Date(inicioDiaSlaOperacao(chave));
      dataAnterior.setDate(dataAnterior.getDate() - 1);
      const chaveDiaAnterior = chaveDiaSlaOperacao(
        dataAnterior.getTime()
      );
      const ausenteNoDiaAnterior = movimentos.some(
        (movimento) =>
          chaveDiaSlaOperacao(movimento.data) === chaveDiaAnterior &&
          movimento.status === "AUSENTE"
      );
      const teveEntregueHoje = movimentosDoDia.some(
        (movimento) => movimento.status === "ENTREGUE"
      );

      if (
        ausenteNoDiaAnterior &&
        (rotas.length > 0 || teveEntregueHoje)
      ) {
        dia.retornos++;
      }

      if (rotas.length) {
        dia.rota++;
        dia.primeira =
          dia.primeira === null
            ? rotas[0].data
            : Math.min(dia.primeira, rotas[0].data);

        if (ausenteNoDiaAnterior) {
          dia.retornaramParaRota++;
        }
      }

      if (ausenteNoDiaAnterior && teveEntregueHoje) {
        dia.retornosPosteriormenteEntregues++;
      }

      const ultimaBaixa = baixas[baixas.length - 1];
      if (ultimaBaixa?.status === "ENTREGUE") {
        dia.entregues++;
      } else if (ultimaBaixa?.status === "AUSENTE") {
        dia.ausentes++;
      }

      // Baixas automáticas continuam nos demais cálculos, mas não definem
      // a última baixa real.
      const baixasParaUltima = baixas.filter(
        (movimento) => !isBaixaAutomaticaSlaOperacao(movimento)
      );
      if (baixasParaUltima.length) {
        const ultimaHumana =
          baixasParaUltima[baixasParaUltima.length - 1].data;
        dia.ultima =
          dia.ultima === null
            ? ultimaHumana
            : Math.max(dia.ultima, ultimaHumana);
      }

      if (isMercadoLivreSlaOperacao(pacote)) {
        const entregas = movimentosDoDia.filter(
          (movimento) => movimento.status === "ENTREGUE"
        );
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

function intervaloDiasSla(intervalo: { inicio: number; fim: number }) {
  const inicio =
    intervalo.inicio <= 0
      ? Number.NEGATIVE_INFINITY
      : (() => {
          const d = new Date(intervalo.inicio);
          return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
        })();
  const fim =
    intervalo.fim >= 8e15
      ? Number.POSITIVE_INFINITY
      : (() => {
          const d = new Date(intervalo.fim);
          return (
            new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime() +
            86400000 -
            1
          );
        })();
  return { inicio, fim };
}

function resumirSlaOperacao(
  items: Pacote[],
  nomes: UserNameMap,
  intervalo: { inicio: number; fim: number }
): ResumoSla {
  const { inicio, fim } = intervaloDiasSla(intervalo);
  const cards = construirSlaOperacao(items, nomes)
    .map((score) => {
      const dias = Object.values(score.dias)
        .filter((dia) => dia.data >= inicio && dia.data <= fim)
        .sort((a, b) => b.data - a.data);
      const total = dias.reduce((sum, dia) => sum + dia.pacotes, 0);
      const rota = dias.reduce((sum, dia) => sum + dia.rota, 0);
      const entregues = dias.reduce((sum, dia) => sum + dia.entregues, 0);
      const ausentes = dias.reduce((sum, dia) => sum + dia.ausentes, 0);
      const retornos = dias.reduce((sum, dia) => sum + dia.retornos, 0);
      const retornaramParaRota = dias.reduce(
        (sum, dia) => sum + dia.retornaramParaRota,
        0
      );
      const retornosPosteriormenteEntregues = dias.reduce(
        (sum, dia) => sum + dia.retornosPosteriormenteEntregues,
        0
      );
      const primeiras = dias
        .map((dia) => dia.primeira)
        .filter((valor): valor is number => valor !== null);
      const ultimas = dias
        .map((dia) => dia.ultima)
        .filter((valor): valor is number => valor !== null);
      const mlAte21 = dias.reduce((sum, dia) => sum + dia.mlAte21, 0);
      const mlEntre21e23 = dias.reduce(
        (sum, dia) => sum + dia.mlEntre21e23,
        0
      );
      const mlApos23 = dias.reduce((sum, dia) => sum + dia.mlApos23, 0);

      return {
        ...score,
        dias,
        total,
        rota,
        entregues,
        ausentes,
        retornos,
        retornaramParaRota,
        retornosPosteriormenteEntregues,
        primeira: primeiras.length ? Math.min(...primeiras) : null,
        ultima: ultimas.length ? Math.max(...ultimas) : null,
        mlAte21,
        mlEntre21e23,
        mlApos23,
      };
    })
    .filter((score) => score.total > 0);

  const total = cards.reduce((sum, score) => sum + score.total, 0);
  const rota = cards.reduce((sum, score) => sum + score.rota, 0);
  const entregues = cards.reduce((sum, score) => sum + score.entregues, 0);
  const ausentes = cards.reduce((sum, score) => sum + score.ausentes, 0);
  const finalizados = entregues + ausentes;
  const retornos = cards.reduce((sum, score) => sum + score.retornos, 0);
  const retornaramParaRota = cards.reduce(
    (sum, score) => sum + score.retornaramParaRota,
    0
  );
  const retornosPosteriormenteEntregues = cards.reduce(
    (sum, score) => sum + score.retornosPosteriormenteEntregues,
    0
  );
  const primeiras = cards
    .map((score) => score.primeira)
    .filter((valor): valor is number => valor !== null);
  const ultimas = cards
    .map((score) => score.ultima)
    .filter((valor): valor is number => valor !== null);
  const mlAte21 = cards.reduce((sum, score) => sum + score.mlAte21, 0);
  const mlEntre21e23 = cards.reduce(
    (sum, score) => sum + score.mlEntre21e23,
    0
  );
  const mlApos23 = cards.reduce((sum, score) => sum + score.mlApos23, 0);
  const primeira = primeiras.length ? Math.min(...primeiras) : null;
  const ultima = ultimas.length ? Math.max(...ultimas) : null;
  const numeroDias = new Set(
    cards.flatMap((score) => score.dias.map((dia) => dia.data))
  ).size;

  return {
    total,
    rota,
    entregues,
    ausentes,
    retornos,
    retornaramParaRota,
    retornosPosteriormenteEntregues,
    primeira,
    ultima,
    mlAte21,
    mlEntre21e23,
    mlApos23,
    sla: finalizados ? (entregues / finalizados) * 100 : 0,
    mediaPorDia: numeroDias ? total / numeroDias : 0,
    produtividade: valorProdutividadeSlaOperacao(
      primeira,
      ultima,
      finalizados
    ),
  };
}

function pontoDentroRegiao(
  lat: number,
  lng: number,
  pontos: PontoRegiao[]
) {
  if (pontos.length < 3) return false;
  let dentro = false;
  for (let i = 0, j = pontos.length - 1; i < pontos.length; j = i++) {
    const [yi, xi] = pontos[i];
    const [yj, xj] = pontos[j];
    const cruza =
      xi > lng !== xj > lng &&
      lat < ((yj - yi) * (lng - xi)) / (xj - xi) + yi;
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

function pontosMeio(pontos: PontoRegiao[]) {
  if (pontos.length < 2) return [];
  return pontos.map((ponto, index) => {
    const proximo = pontos[(index + 1) % pontos.length];
    return [
      (ponto[0] + proximo[0]) / 2,
      (ponto[1] + proximo[1]) / 2,
    ] as PontoRegiao;
  });
}

function codigoPacoteMapa(pacote: any) {
  const raw = pacote?.raw;
  if (raw && typeof raw === "object") {
    return String(
      raw.external_grouper_code ||
        raw.codigo ||
        raw.id ||
        pacote.codigo ||
        pacote.id ||
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
          pacote.codigo ||
          pacote.id ||
          "-"
      );
    } catch {
      return String(pacote.codigo || pacote.id || raw);
    }
  }
  return String(pacote?.codigo || pacote?.id || "-");
}

function obterEndereco(p: Ponto) {
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

function dataPacote(p: Pacote) {
  const dados = p as any;
  const valor = dados.dataHoraBaixa || dados.data;
  if (!valor) return "—";
  try {
    return formatarData(valor) || "—";
  } catch {
    const ms = timestampMs(valor);
    return Number.isFinite(ms) ? new Date(ms).toLocaleString("pt-BR") : "—";
  }
}

function formatarPercentual(valor: number) {
  return `${valor.toFixed(1).replace(".", ",")}%`;
}

function formatarNumeroBr(valor: number, decimais = 1) {
  return valor.toFixed(decimais).replace(".", ",");
}

const NOMES_DIA_SEMANA = [
  "Domingo",
  "Segunda-feira",
  "Terça-feira",
  "Quarta-feira",
  "Quinta-feira",
  "Sexta-feira",
  "Sábado",
];

type VolumeDia = {
  chave: string;
  data: number;
  rotulo: string;
  dataCurta: string;
  total: number;
};

// Volume diário real: um registro por dia com pacotes dentro do polígono.
function volumeDiarioRegiao(pacotes: Pacote[]): VolumeDia[] {
  const mapa = new Map<string, number>();

  pacotes.forEach((pacote) => {
    const dados = pacote as any;
    const referencia = timestampMs(dados.dataHoraBaixa || dados.data);
    if (!referencia) return;
    const chave = chaveDiaSlaOperacao(referencia);
    mapa.set(chave, (mapa.get(chave) || 0) + 1);
  });

  return Array.from(mapa.entries())
    .map(([chave, total]) => {
      const data = inicioDiaSlaOperacao(chave);
      const d = new Date(data);
      return {
        chave,
        data,
        total,
        rotulo: NOMES_DIA_SEMANA[d.getDay()],
        dataCurta: d.toLocaleDateString("pt-BR", {
          day: "2-digit",
          month: "2-digit",
        }),
      };
    })
    .sort((a, b) => a.data - b.data);
}

function distribuicaoTiposRegiao(pacotes: Pacote[]) {
  let mercadoLivre = 0;
  let shopee = 0;
  let avulso = 0;

  pacotes.forEach((pacote) => {
    const grupo = grupoTipoPacote(pacote);
    if (grupo === "MERCADO_LIVRE") mercadoLivre++;
    else if (grupo === "SHOPEE") shopee++;
    else avulso++;
  });

  return {
    mercadoLivre,
    shopee,
    avulso,
    total: mercadoLivre + shopee + avulso,
  };
}

function IndicadorRegiao({
  regiao,
  sla,
  pacotes,
  onSelecionar,
}: {
  regiao: RegiaoMapa;
  sla: number;
  pacotes: number;
  onSelecionar: () => void;
}) {
  const centro = useMemo(
    () => calcularCentroRegiao(regiao.pontos),
    [regiao.pontos]
  );

  const icone = useMemo(() => {
    if (!centro) return null;
    // Cartão compacto e legível: nome da região no topo, SLA e total de
    // pacotes em duas colunas separadas por divisória.
    return L.divIcon({
      className: "mapa-region-badge-icon",
      html: `
        <div class="mapa-region-badge" style="--mapa-region-color:${regiao.cor}" title="${escaparHtml(
          regiao.nome
        )} · SLA ${formatarPercentual(sla)} · ${pacotes.toLocaleString("pt-BR")} pacotes">
          <span class="mapa-region-badge-dot"></span>
          <b class="mapa-region-badge-value">${formatarPercentual(sla)}</b>
          <span class="mapa-region-badge-count">${pacotes.toLocaleString("pt-BR")}</span>
        </div>
      `,
      iconSize: [0, 0],
      iconAnchor: [0, 0],
    });
  }, [centro, regiao.cor, regiao.nome, sla, pacotes]);

  if (!centro || !icone) return null;

  return (
    <Marker
      position={centro}
      icon={icone}
      eventHandlers={{
        click: (event) => {
          pararPropagacaoMapa(event);
          onSelecionar();
        },
      }}
    />
  );
}

export default function Mapa() {
  const { checkingAccess, allowed, isAdmin } = usePermission();
  const [items, setItems] = useState<Pacote[]>([]);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState("");

  const [usuario, setUsuario] = useState("TODOS");
  const [tipo, setTipo] = useState("TODOS");
  const [status, setStatus] = useState("TODOS");
  const [periodo, setPeriodo] = useState("DIA_ANTERIOR");
  const [ini, setIni] = useState(getDiaAnterior());
  const [fim, setFim] = useState(getDiaAnterior());
  const [nomes, setNomes] = useState<UserNameMap>({});

  const [regioes, setRegioes] = useState<RegiaoMapa[]>([]);
  // Estado visual ativo/inativo: todas as regiões começam OFF ao abrir a
  // página e permanecem cadastradas no Firestore. Mantido somente em memória
  // enquanto a página estiver aberta.
  const [regioesAtivas, setRegioesAtivas] = useState<string[]>([]);
  // Filtro geral dos ícones de pacote: quando desligado, NENHUM pin aparece
  // no mapa (inclusive os que estão fora de qualquer região).
  const [iconesVisiveis, setIconesVisiveis] = useState(true);
  const [filtrosAbertos, setFiltrosAbertos] = useState(false);
  const [modoRegiao, setModoRegiao] = useState(false);
  const [desenhando, setDesenhando] = useState(false);
  const [pontosDesenho, setPontosDesenho] = useState<PontoRegiao[]>([]);
  const [regiaoEditando, setRegiaoEditando] =
    useState<RegiaoMapa | null>(null);
  const [regiaoSelecionada, setRegiaoSelecionada] =
    useState<RegiaoMapa | null>(null);
  const [nomeRegiao, setNomeRegiao] = useState("");
  const [corRegiao, setCorRegiao] = useState(CORES_REGIAO[0]);
  // Transparência da área (0 = totalmente transparente .. 100 = cor sólida).
  // Reutiliza o campo `tom` já existente no Firestore, salvo junto da região.
  const [tomRegiao, setTomRegiao] = useState(TOM_PADRAO);
  const corFinalRegiao = corRegiao;
  const [salvandoRegiao, setSalvandoRegiao] = useState(false);
  const [carregandoRegioes, setCarregandoRegioes] = useState(false);

  async function carregar() {
    setLoading(true);
    setErro("");
    try {
      const [pacotes, mapaNomes, brutos] = await Promise.all([
        listarPacotes(),
        carregarNomesUsuarios(),
        // Mesma fonte da tela Operação: o histórico completo (com horários
        // reais de ENTREGUE) vem direto de controle_codigos.
        getDocs(collection(db, "controle_codigos")).catch((e) => {
          console.error(e);
          return null;
        }),
      ]);
      const historicoPorId = new Map<string, any>();
      brutos?.docs.forEach((d) => {
        const dados = d.data() as any;
        if (dados?.historico) historicoPorId.set(d.id, dados.historico);
      });
      setItems(
        (pacotes as any[]).map((p) =>
          historicoPorId.has(p.id)
            ? { ...p, historico: historicoPorId.get(p.id) }
            : p
        ) as Pacote[]
      );
      setNomes(mapaNomes);
    } catch (error) {
      console.error(error);
      setErro("Não foi possível carregar os dados do mapa.");
    } finally {
      setLoading(false);
    }
  }

  async function carregarRegioes() {
    if (!allowed) return;
    setCarregandoRegioes(true);
    try {
      const snap = await getDocs(collection(db, "regioes_mapa"));
      const lista: RegiaoMapa[] = snap.docs
        .map((item) => {
          const data = item.data() as any;
          const pontos: PontoRegiao[] = Array.isArray(data.pontos)
            ? data.pontos
                .map(
                  (p: any) =>
                    [Number(p.lat), Number(p.lng)] as PontoRegiao
                )
                .filter(
                  ([lat, lng]) =>
                    Number.isFinite(lat) && Number.isFinite(lng)
                )
            : [];

          return {
            id: item.id,
            nome: String(data.nome || "Região sem nome"),
            cor: String(data.cor || CORES_REGIAO[0]),
            corBase: String(data.corBase || data.cor || CORES_REGIAO[0]),
            tom: normalizarTom(data.tom),
            pontos,
            ativa: data.ativa === true,
            criadoPor: data.criadoPor,
            criadoEm: data.criadoEm,
            atualizadoEm: data.atualizadoEm,
          };
        })
        .filter(
          (regiao) =>
            regiao.pontos.length >= 3 &&
            regiao.pontos.every(
              ([lat, lng]) => Number.isFinite(lat) && Number.isFinite(lng)
            )
        );
      setRegioes(lista);
      // As áreas ficam sempre visíveis; o olho controla só os ícones dos
      // pacotes da região. Ao carregar, os ícones de todas as regiões aparecem.
      setRegioesAtivas(lista.map((regiao) => regiao.id));
    } catch (error) {
      console.error("Erro ao carregar regiões:", error);
      setErro("Não foi possível carregar as regiões do mapa.");
    } finally {
      setCarregandoRegioes(false);
    }
  }

  useEffect(() => {
    if (!allowed) return;
    void carregar();
    void carregarRegioes();
  }, [allowed]);

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
      return { inicio: inicioOntem, fim: inicioHoje - 1 };
    }
    if (periodo === "HOJE") {
      return { inicio: inicioHoje, fim: agora.getTime() };
    }
    if (periodo === "7_DIAS") {
      return {
        inicio: new Date(
          hoje.getFullYear(),
          hoje.getMonth(),
          hoje.getDate() - 6
        ).getTime(),
        fim: agora.getTime(),
      };
    }
    if (periodo === "30_DIAS") {
      return {
        inicio: new Date(
          hoje.getFullYear(),
          hoje.getMonth(),
          hoje.getDate() - 29
        ).getTime(),
        fim: agora.getTime(),
      };
    }
    if (periodo === "PERSONALIZADO") {
      return {
        inicio: new Date(`${ini}T00:00:00`).getTime(),
        fim: new Date(`${fim}T23:59:59.999`).getTime(),
      };
    }
    return { inicio: 0, fim: Number.MAX_SAFE_INTEGER };
  }, [periodo, ini, fim]);

  const itemsPeriodo = useMemo(
    () =>
      items.filter((p) => {
        const dados = p as any;
        const dataRef = timestampMs(dados.dataHoraBaixa || dados.data);
        if (!dataRef) return false;
        return (
          dataRef >= intervaloFiltro.inicio &&
          dataRef <= intervaloFiltro.fim
        );
      }),
    [items, intervaloFiltro]
  );

  const usuariosAtivos = useMemo(
    () =>
      Array.from(
        new Set(itemsPeriodo.map(usuarioEmailMapa).filter(Boolean))
      ).sort((a, b) => a.localeCompare(b)),
    [itemsPeriodo]
  );

  useEffect(() => {
    if (usuario !== "TODOS" && !usuariosAtivos.includes(usuario)) {
      setUsuario("TODOS");
    }
  }, [usuario, usuariosAtivos]);

  const pontos = useMemo<Ponto[]>(() => {
    return itemsPeriodo
      .map((p) => {
        const c = coordenadas(p);
        if (!c) return null;
        return {
          ...p,
          ...c,
          usuarioMapa: usuarioEmailMapa(p),
        } as Ponto;
      })
      .filter((p): p is Ponto => p !== null)
      .filter((p) => {
        if (usuario !== "TODOS" && p.usuarioMapa !== usuario) return false;
        if (tipo !== "TODOS" && normalizarTipo(p.tipo) !== tipo) return false;
        if (status !== "TODOS" && p.status !== status) return false;
        return true;
      });
  }, [itemsPeriodo, usuario, tipo, status]);

  const semCoordenadas =
    itemsPeriodo.length -
    itemsPeriodo.filter((p) => coordenadas(p) !== null).length;

  // Áreas das regiões: sempre visíveis no mapa.
  const regioesVisiveis = regioes;

  // Ícones de pacotes: ocultos quando estão dentro de uma região com o olho
  // desligado. A área da região continua visível.
  const pontosExibidos = useMemo(() => {
    if (!iconesVisiveis) return [];
    const ocultas = regioes.filter(
      (regiao) => !regioesAtivas.includes(regiao.id)
    );
    if (!ocultas.length) return pontos;
    return pontos.filter(
      (p) =>
        !ocultas.some((regiao) =>
          pontoDentroRegiao(p.lat, p.lng, regiao.pontos)
        )
    );
  }, [pontos, regioes, regioesAtivas, iconesVisiveis]);

  const todosUsuariosNomes = useMemo(
    () => (Object.keys(nomes).length ? nomes : ({} as UserNameMap)),
    [nomes]
  );

  // Indicadores exibidos dentro dos polígonos das regiões ativas.
  const indicadoresRegioes = useMemo(
    () =>
      regioesVisiveis.map((regiao) => {
        const pacotesPeriodo = pacotesDaRegiao(regiao, itemsPeriodo);
        const pacotesCompletos = pacotesDaRegiao(regiao, items);
        const resumo = resumirSlaOperacao(
          pacotesCompletos,
          todosUsuariosNomes,
          intervaloFiltro
        );
        return {
          regiao,
          sla: resumo.sla,
          pacotes: pacotesPeriodo.length,
        };
      }),
    [regioesVisiveis, itemsPeriodo, items, todosUsuariosNomes, intervaloFiltro]
  );

  function alternarRegiaoAtiva(id: string) {
    setIconesVisiveis(true);
    setRegioesAtivas((atual) =>
      atual.includes(id)
        ? atual.filter((item) => item !== id)
        : [...atual, id]
    );
  }

  // Filtro geral: liga ou desliga TODOS os ícones de pacote do mapa,
  // inclusive os que estão fora das regiões desenhadas.
  function alternarTodasRegioes() {
    if (todosIconesLigados) {
      setIconesVisiveis(false);
      setRegioesAtivas([]);
      return;
    }
    setIconesVisiveis(true);
    setRegioesAtivas(regioes.map((regiao) => regiao.id));
  }

  function alterarPeriodo(valor: string) {
    setPeriodo(valor);
    const hoje = new Date();
    hoje.setHours(12, 0, 0, 0);

    if (valor === "DIA_ANTERIOR") {
      hoje.setDate(hoje.getDate() - 1);
      const ontem = dataLocal(hoje);
      setIni(ontem);
      setFim(ontem);
    } else if (valor === "HOJE") {
      const dataHoje = dataLocal(new Date());
      setIni(dataHoje);
      setFim(dataHoje);
    } else if (valor === "7_DIAS") {
      const inicio = new Date();
      inicio.setDate(inicio.getDate() - 6);
      setIni(dataLocal(inicio));
      setFim(dataLocal(new Date()));
    } else if (valor === "30_DIAS") {
      const inicio = new Date();
      inicio.setDate(inicio.getDate() - 29);
      setIni(dataLocal(inicio));
      setFim(dataLocal(new Date()));
    }
  }

  function iniciarNovaRegiao() {
    if (!isAdmin) return;
    setModoRegiao(true);
    setDesenhando(true);
    setPontosDesenho([]);
    setRegiaoEditando(null);
    setRegiaoSelecionada(null);
    setNomeRegiao("");
    setCorRegiao(CORES_REGIAO[regioes.length % CORES_REGIAO.length]);
    setTomRegiao(0);
    setErro("");
  }

  function cancelarEdicaoRegiao() {
    setModoRegiao(false);
    setDesenhando(false);
    setPontosDesenho([]);
    setRegiaoEditando(null);
    setNomeRegiao("");
  }

  function editarRegiao(regiao: RegiaoMapa) {
    if (!isAdmin) return;
    setModoRegiao(true);
    setDesenhando(false);
    setRegiaoEditando({
      ...regiao,
      pontos: regiao.pontos.map((p) => [...p] as PontoRegiao),
    });
    setPontosDesenho([]);
    setNomeRegiao(regiao.nome);
    setCorRegiao(regiao.corBase || regiao.cor);
    setTomRegiao(normalizarTom(regiao.tom));
    setRegiaoSelecionada(regiao);
    setErro("");
  }

  function adicionarPonto(ponto: PontoRegiao) {
    if (!isAdmin || !desenhando) return;
    setPontosDesenho((atual) => [...atual, ponto]);
    setErro("");
  }

  function finalizarDesenho() {
    if (pontosDesenho.length < 3) {
      setErro("Marque pelo menos 3 pontos para fechar a região.");
      return;
    }
    setErro("");
    setDesenhando(false);
  }

  function atualizarPontoNovo(index: number, ponto: PontoRegiao) {
    setPontosDesenho((atual) =>
      atual.map((p, i) => (i === index ? ponto : p))
    );
  }

  function removerPontoNovo(index: number) {
    setPontosDesenho((atual) => {
      if (atual.length <= 3) {
        setErro("A região precisa manter pelo menos 3 pontos.");
        return atual;
      }
      return atual.filter((_, i) => i !== index);
    });
  }

  function inserirVertice(
    indexApos: number,
    ponto: PontoRegiao,
    novo: boolean
  ) {
    if (novo) {
      setPontosDesenho((atual) => {
        const pontos = [...atual];
        pontos.splice(indexApos, 0, ponto);
        return pontos;
      });
      return;
    }
    setRegiaoEditando((atual) => {
      if (!atual) return atual;
      const pontos = [...atual.pontos];
      pontos.splice(indexApos, 0, ponto);
      return { ...atual, pontos };
    });
  }

  function removerVerticeEditando(index: number, novo: boolean) {
    if (novo) {
      removerPontoNovo(index);
      return;
    }
    setRegiaoEditando((atual) => {
      if (!atual || atual.pontos.length <= 3) {
        setErro("A região precisa manter pelo menos 3 pontos.");
        return atual;
      }
      return {
        ...atual,
        pontos: atual.pontos.filter((_, i) => i !== index),
      };
    });
  }

  function atualizarVertice(index: number, ponto: PontoRegiao, novo: boolean) {
    if (novo) {
      atualizarPontoNovo(index, ponto);
      return;
    }
    setRegiaoEditando((atual) => {
      if (!atual) return atual;
      const pontos = atual.pontos.map((p, i) => (i === index ? ponto : p));
      return { ...atual, pontos };
    });
  }

  async function salvarRegiao() {
    if (!isAdmin) return;

    const usuarioAutenticado = auth.currentUser;
    if (!usuarioAutenticado?.uid) {
      setErro("Sua sessão não está autenticada. Entre novamente para salvar regiões.");
      return;
    }

    const pontos = (regiaoEditando?.pontos || pontosDesenho).map(
      (p) => [Number(p[0]), Number(p[1])] as PontoRegiao
    );
    if (pontos.length < 3) {
      setErro("A região precisa de pelo menos 3 pontos.");
      return;
    }
    const pontosFirestore = pontos.map(([lat, lng]) => ({
      lat: Number(lat),
      lng: Number(lng),
    }));

    const nome = nomeRegiao.trim() || `Região ${regioes.length + 1}`;
    setSalvandoRegiao(true);
    setErro("");

    try {
      if (regiaoEditando) {
        if (!regiaoEditando.id) {
          throw new Error("A região não possui um ID válido do Firestore.");
        }

        await updateDoc(doc(db, "regioes_mapa", regiaoEditando.id), {
          nome,
          cor: corFinalRegiao,
          corBase: corRegiao,
          tom: tomRegiao,
          pontos: pontosFirestore,
          atualizadoEm: serverTimestamp(),
        });
        setRegioes((atual) =>
          atual.map((regiao) =>
            regiao.id === regiaoEditando.id
              ? {
                  ...regiao,
                  nome,
                  cor: corFinalRegiao,
                  corBase: corRegiao,
                  tom: tomRegiao,
                  pontos,
                }
              : regiao
          )
        );
      } else {
        const ref = await addDoc(collection(db, "regioes_mapa"), {
          nome,
          cor: corFinalRegiao,
          corBase: corRegiao,
          tom: tomRegiao,
          pontos: pontosFirestore,
          criadoPor: auth.currentUser?.uid || auth.currentUser?.email || "",
          criadoEm: serverTimestamp(),
          atualizadoEm: serverTimestamp(),
        });
        const novaRegiao: RegiaoMapa = {
          id: ref.id,
          nome,
          cor: corFinalRegiao,
          corBase: corRegiao,
          tom: tomRegiao,
          pontos,
        };
        setRegioes((atual) => [...atual, novaRegiao]);
        setRegioesAtivas((atual) => [...atual, ref.id]);
      }

      setRegiaoSelecionada(null);
      setModoRegiao(false);
      setDesenhando(false);
      setPontosDesenho([]);
      setRegiaoEditando(null);
      setNomeRegiao("");
    } catch (error) {
      console.error("Erro completo ao salvar região no Firestore:", error);

      const erroFirestore = error as {
        code?: unknown;
        message?: unknown;
      };
      const codigo = String(erroFirestore?.code || "erro-desconhecido");
      const mensagem =
        typeof erroFirestore?.message === "string"
          ? erroFirestore.message
          : String(error);
      const codigoNormalizado = codigo.toLowerCase();

      if (codigoNormalizado.includes("permission-denied")) {
        setErro(
          `O Firebase negou a gravação (permission-denied). Confira as regras da coleção regioes_mapa. Detalhe: ${mensagem}`
        );
      } else if (codigoNormalizado.includes("unauthenticated")) {
        setErro(
          `O Firebase não reconheceu a autenticação (unauthenticated). Entre novamente. Detalhe: ${mensagem}`
        );
      } else if (codigoNormalizado.includes("not-found")) {
        setErro(
          `O documento da região não foi encontrado (not-found). Detalhe: ${mensagem}`
        );
      } else if (codigoNormalizado.includes("unavailable")) {
        setErro(
          `O Firestore está indisponível no momento (unavailable). Tente novamente. Detalhe: ${mensagem}`
        );
      } else {
        setErro(
          `Falha ao salvar a região no Firestore. Código: ${codigo}. Detalhe: ${mensagem}`
        );
      }
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
      setRegioes((atual) => atual.filter((item) => item.id !== regiao.id));
      setRegioesAtivas((atual) => atual.filter((item) => item !== regiao.id));
    } catch (error) {
      console.error("Erro ao excluir região:", error);
      setErro("Não foi possível excluir a região.");
    }
  }

  // Volta ao enquadramento com TODAS as regiões cadastradas.
  function centralizarMapa() {
    const vertices = regioes.flatMap((regiao) => regiao.pontos);
    if (!vertices.length) {
      focarMapa();
      return;
    }
    const bounds = L.latLngBounds(
      vertices.map(([lat, lng]) => [lat, lng] as [number, number])
    );
    window.dispatchEvent(new CustomEvent("mapa:focar", { detail: { bounds } }));
  }

  function focarMapa() {
    const idSelecionada = regiaoSelecionada?.id;
    const alvoSelecionado = regioes.find(
      (regiao) => regiao.id === idSelecionada
    );
    if (alvoSelecionado) {
      const bounds = L.latLngBounds(
        alvoSelecionado.pontos.map(
          ([lat, lng]) => [lat, lng] as [number, number]
        )
      );
      window.dispatchEvent(
        new CustomEvent("mapa:focar", { detail: { bounds } })
      );
      return;
    }

    const verticesVisiveis = regioesVisiveis.flatMap(
      (regiao) => regiao.pontos
    );
    if (verticesVisiveis.length) {
      const bounds = L.latLngBounds(
        verticesVisiveis.map(([lat, lng]) => [lat, lng] as [number, number])
      );
      window.dispatchEvent(
        new CustomEvent("mapa:focar", { detail: { bounds } })
      );
    } else if (pontos.length > 1) {
      const bounds = L.latLngBounds(
        pontos.map((p) => [p.lat, p.lng] as [number, number])
      );
      window.dispatchEvent(
        new CustomEvent("mapa:focar", { detail: { bounds } })
      );
    } else if (pontos.length === 1) {
      window.dispatchEvent(
        new CustomEvent("mapa:focar", {
          detail: {
            center: [pontos[0].lat, pontos[0].lng],
            zoom: 15,
          },
        })
      );
    } else if (regioes[0]?.pontos.length) {
      const bounds = L.latLngBounds(
        regioes[0].pontos.map(
          ([lat, lng]) => [lat, lng] as [number, number]
        )
      );
      window.dispatchEvent(
        new CustomEvent("mapa:focar", { detail: { bounds } })
      );
    }
  }

  if (checkingAccess) {
    return (
      <div className="mapa-page">
        <style>{CSS_MAPA}</style>
        <PageHeader
          title="Mapa operacional"
          subtitle="Verificando permissão de acesso..."
        />
        <div className="mapa-state-card">Verificando acesso...</div>
      </div>
    );
  }

  if (!allowed) {
    return (
      <div className="mapa-page">
        <style>{CSS_MAPA}</style>
        <PageHeader
          title="Acesso restrito"
          subtitle="Área exclusiva para usuários autorizados."
        />
        <section className="mapa-state-card mapa-denied">
          <span className="mapa-denied-icon">
            <LockKeyhole size={28} />
          </span>
          <div>
            <h2>Acesso não autorizado</h2>
            <p>Você não possui permissão para acessar o Mapa operacional.</p>
          </div>
        </section>
      </div>
    );
  }

  const regiaoParaResumo = regiaoSelecionada;
  const todosPacotesDaRegiao = regiaoParaResumo
    ? pacotesDaRegiao(regiaoParaResumo, items)
    : [];
  const pacotesDaRegiaoSelecionada = regiaoParaResumo
    ? pacotesDaRegiao(regiaoParaResumo, itemsPeriodo)
    : [];
  const resumoRegiao = regiaoParaResumo
    ? resumirSlaOperacao(
        todosPacotesDaRegiao,
        todosUsuariosNomes,
        intervaloFiltro
      )
    : null;
  const volumeDiario = regiaoParaResumo
    ? volumeDiarioRegiao(pacotesDaRegiaoSelecionada)
    : [];
  const totalVolumeDiario = volumeDiario.reduce(
    (soma, dia) => soma + dia.total,
    0
  );
  const mediaVolumeDiario = volumeDiario.length
    ? totalVolumeDiario / volumeDiario.length
    : 0;
  const maiorVolumeDia = volumeDiario.reduce(
    (maior, dia) => Math.max(maior, dia.total),
    0
  );
  const distribuicaoTipos = distribuicaoTiposRegiao(
    pacotesDaRegiaoSelecionada
  );
  const entregadoresRegiao = regiaoParaResumo
    ? Array.from(
        new Set(
          pacotesDaRegiaoSelecionada
            .map(usuarioIdRegiao)
            .filter(Boolean)
        )
      ).sort((a, b) =>
        String(
          (nomes as Record<string, string>)[a] || nomeUsuario(a, nomes)
        ).localeCompare(
          String(
            (nomes as Record<string, string>)[b] || nomeUsuario(b, nomes)
          )
        )
      )
    : [];
  const todosIconesLigados =
    iconesVisiveis && regioesAtivas.length === regioes.length;
  const pontosAtuais = regiaoEditando?.pontos || pontosDesenho;
  const centroInicial: [number, number] =
    regioes.length && regioes[0].pontos.length
      ? calcularCentroRegiao(regioes[0].pontos) || regioes[0].pontos[0]
      : pontos.length
        ? [pontos[0].lat, pontos[0].lng]
        : [-14.235, -51.9253];
  const rotuloPeriodo =
    periodo === "PERSONALIZADO"
      ? `${ini} — ${fim}`
      : periodo === "HOJE"
        ? "Hoje"
        : periodo === "DIA_ANTERIOR"
          ? "Dia anterior"
          : periodo === "7_DIAS"
            ? "Últimos 7 dias"
            : periodo === "30_DIAS"
              ? "Últimos 30 dias"
              : "Todo período";

  return (
    <div className="mapa-page mapa-fullpage">
      <style>{CSS_MAPA}</style>
      {erro && (
        <div className="mapa-error" role="alert">
          <span>{erro}</span>
          <button
            type="button"
            onClick={() => setErro("")}
            aria-label="Fechar aviso"
          >
            <X size={15} />
          </button>
        </div>
      )}
      <main className="mapa-map-shell">
        <MapContainer
          center={centroInicial}
          zoom={regioes.length ? 12 : pontos.length ? 11 : 4}
          scrollWheelZoom
          className="mapa-leaflet"
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          <AjustarMapa points={pontos} regions={regioes} />
          <ControleFocoMapa />
          <MapaClique ativo={isAdmin && modoRegiao && desenhando} onClique={adicionarPonto} onCliqueFora={() => { if (!modoRegiao) setRegiaoSelecionada(null); }} />

          {regioesVisiveis.map((regiao) => {
            const sendoEditada =
              Boolean(regiaoEditando) && regiaoEditando?.id === regiao.id;
            if (sendoEditada) return null;
            return (
              <Polygon
                key={regiao.id}
                positions={regiao.pontos}
                pathOptions={{
                  color: regiao.cor,
                  fillColor: regiao.cor,
                  fillOpacity: Math.min(
                    1,
                    normalizarTom(regiao.tom) / 100 +
                      (regiaoSelecionada?.id === regiao.id ? 0.1 : 0)
                  ),
                  weight: regiaoSelecionada?.id === regiao.id ? 3 : 2,
                }}
                eventHandlers={{
                  click: (event) => {
                    if (!modoRegiao) {
                      pararPropagacaoMapa(event);
                      setRegiaoSelecionada(regiao);
                    }
                  },
                }}
              />
            );
          })}

          {!modoRegiao &&
            indicadoresRegioes.map(({ regiao, sla, pacotes: totalPacotes }) => (
              <IndicadorRegiao
                key={`indicador-${regiao.id}`}
                regiao={regiao}
                sla={sla}
                pacotes={totalPacotes}
                onSelecionar={() => setRegiaoSelecionada(regiao)}
              />
            ))}

          {isAdmin && modoRegiao && desenhando && pontosDesenho.length > 1 && (
            <Polyline
              positions={pontosDesenho}
              pathOptions={{
                color: corFinalRegiao,
                weight: 3,
                dashArray: "7 6",
              }}
            />
          )}

          {isAdmin && modoRegiao && !desenhando && pontosAtuais.length >= 3 && (
            <Polygon
              positions={pontosAtuais}
              pathOptions={{
                color: corFinalRegiao,
                fillColor: corFinalRegiao,
                fillOpacity: Math.min(1, tomRegiao / 100),
                weight: 3,
              }}
            />
          )}

          {isAdmin &&
            modoRegiao &&
            pontosAtuais.map(([lat, lng], index) => (
              <Marker
                key={`vertex-${index}-${lat}-${lng}`}
                position={[lat, lng]}
                icon={VERTEX_ICON}
                draggable
                eventHandlers={{
                  click: pararPropagacaoMapa,
                  contextmenu: (event) => {
                    pararPropagacaoMapa(event);
                    removerVerticeEditando(index, !regiaoEditando);
                  },
                  dragend: (event) => {
                    const position = (event.target as L.Marker).getLatLng();
                    atualizarVertice(
                      index,
                      [position.lat, position.lng],
                      !regiaoEditando
                    );
                  },
                }}
              />
            ))}

          {isAdmin &&
            modoRegiao &&
            pontosAtuais.length >= 3 &&
            !desenhando &&
            pontosMeio(pontosAtuais).map(([lat, lng], index) => (
              <Marker
                key={`mid-${index}-${lat}-${lng}`}
                position={[lat, lng]}
                icon={MIDPOINT_ICON}
                eventHandlers={{
                  click: (event) => {
                    pararPropagacaoMapa(event);
                    inserirVertice((index + 1) % pontosAtuais.length, [lat, lng], !regiaoEditando);
                  },
                }}
              />
            ))}

          {pontosExibidos.map((ponto) => (
            <Marker
              key={String(ponto.id || (ponto as any).codigo || `${ponto.lat}-${ponto.lng}`)}
              position={[ponto.lat, ponto.lng]}
              icon={criarIcone(ponto)}
              eventHandlers={{ click: pararPropagacaoMapa }}
            >
              <Popup className="mapa-package-popup">
                <div className="mapa-popup">
                  <div className="mapa-popup-heading">
                    <div>
                      <small>PACOTE</small>
                      <strong>{codigoPacoteMapa(ponto)}</strong>
                    </div>
                    <span
                      className={`mapa-popup-status status-${String(
                        ponto.status || ""
                      ).toLowerCase()}`}
                    >
                      {nomeStatus(ponto.status as StatusPacote)}
                    </span>
                  </div>
                  <div className="mapa-popup-grid">
                    <div>
                      <small>Tipo</small>
                      <strong>{nomeTipo(ponto.tipo)}</strong>
                    </div>
                    <div>
                      <small>Usuário</small>
                      <strong>
                        {nomeUsuario(ponto.usuarioMapa, nomes) ||
                          ponto.usuarioMapa ||
                          "Sem usuário"}
                      </strong>
                    </div>
                    <div>
                      <small>Empresa</small>
                      <strong>{(ponto as any).empresa || "—"}</strong>
                    </div>
                    <div>
                      <small>Data</small>
                      <strong>{dataPacote(ponto)}</strong>
                    </div>
                  </div>
                  <div className="mapa-popup-address">
                    <small>Endereço / localização</small>
                    <strong>{obterEndereco(ponto)}</strong>
                  </div>
                  <div className="mapa-popup-coordinates">
                    {ponto.lat.toFixed(6)}, {ponto.lng.toFixed(6)}
                  </div>
                </div>
              </Popup>
            </Marker>
          ))}
        </MapContainer>

        <div className="mapa-map-badge">
          <span className="mapa-live-dot" />
          {loading ? "Carregando entregas" : `${pontos.length} pontos exibidos`}
        </div>

        <button
          type="button"
          className="mapa-center-button"
          onClick={centralizarMapa}
          title="Centralizar mapa em todas as regiões"
          aria-label="Centralizar mapa"
        >
          <Maximize2 size={15} />
          Centralizar mapa
        </button>

        <button
          type="button"
          className="mapa-locate-button"
          onClick={focarMapa}
          title="Enquadrar pontos e regiões"
          aria-label="Enquadrar pontos e regiões"
        >
          <LocateFixed size={18} />
        </button>

        {modoRegiao && desenhando && (
          <div className="mapa-draw-hint">
            <MapIcon size={16} />
            <span>
              Clique no mapa para adicionar pontos
              <b>{pontosDesenho.length} vértice(s)</b>
            </span>
          </div>
        )}

        {loading && (
          <div className="mapa-loading-shade">
            <span className="mapa-loader" />
            Carregando mapa…
          </div>
        )}

        {regiaoSelecionada && !modoRegiao && resumoRegiao && (
          <aside className="mapa-region-panel">
            <header
              className="mapa-panel-header"
              style={{
                ["--mapa-region-color" as any]: regiaoSelecionada.cor,
              }}
            >
              <div className="mapa-panel-title">
                <small>REGIÃO</small>
                <h2>{regiaoSelecionada.nome}</h2>
                <div className="mapa-panel-sla">
                  <span>SLA</span>
                  <strong>{formatarPercentual(resumoRegiao.sla)}</strong>
                </div>
              </div>
              <div className="mapa-panel-actions">
                {isAdmin && (
                  <>
                    <button
                      type="button"
                      title="Editar região"
                      onClick={() => editarRegiao(regiaoSelecionada)}
                    >
                      <Pencil size={15} />
                    </button>
                    <button
                      type="button"
                      className="mapa-panel-action-danger"
                      title="Excluir região"
                      onClick={() => void excluirRegiao(regiaoSelecionada)}
                    >
                      <Trash2 size={15} />
                    </button>
                  </>
                )}
                <button
                  type="button"
                  title="Fechar painel"
                  onClick={() => setRegiaoSelecionada(null)}
                >
                  <X size={16} />
                </button>
              </div>
            </header>

            <div className="mapa-panel-period">
              <span>{rotuloPeriodo}</span>
              <span>{pacotesDaRegiaoSelecionada.length} pacotes na área</span>
            </div>

            <section className="mapa-panel-block">
              <div className="mapa-panel-cards">
                <div className="mapa-panel-card mapa-panel-card-sla">
                  <small>SLA</small>
                  <strong>{formatarPercentual(resumoRegiao.sla)}</strong>
                </div>
                <div className="mapa-panel-card">
                  <small>Total</small>
                  <strong>{resumoRegiao.total}</strong>
                </div>
                <div className="mapa-panel-card">
                  <small>Entregues</small>
                  <strong>{resumoRegiao.entregues}</strong>
                </div>
                <div className="mapa-panel-card">
                  <small>Ausentes</small>
                  <strong>{resumoRegiao.ausentes}</strong>
                </div>
                <div className="mapa-panel-card">
                  <small>Rota</small>
                  <strong>{resumoRegiao.rota}</strong>
                </div>
                <div className="mapa-panel-card">
                  <small>Retornos</small>
                  <strong>{resumoRegiao.retornos}</strong>
                </div>
              </div>
            </section>

            <section className="mapa-panel-block">
              <h3>Volume de pacotes</h3>
              {!volumeDiario.length ? (
                <p className="mapa-panel-empty">
                  Sem pacotes no período selecionado para esta área.
                </p>
              ) : (
                <>
                  <div className="mapa-volume-list">
                    {volumeDiario.map((dia) => (
                      <div className="mapa-volume-row" key={dia.chave}>
                        <span className="mapa-volume-day">
                          {dia.rotulo}
                          <i>{dia.dataCurta}</i>
                        </span>
                        <span className="mapa-volume-bar">
                          <i
                            style={{
                              width: `${
                                maiorVolumeDia
                                  ? Math.max(
                                      6,
                                      (dia.total / maiorVolumeDia) * 100
                                    )
                                  : 0
                              }%`,
                              background: regiaoSelecionada.cor,
                            }}
                          />
                        </span>
                        <b>{dia.total}</b>
                      </div>
                    ))}
                  </div>
                  <div className="mapa-panel-footnote">
                    <span>Média diária</span>
                    <strong>
                      {formatarNumeroBr(mediaVolumeDiario)} pacotes/dia
                    </strong>
                  </div>
                </>
              )}
            </section>

            <section className="mapa-panel-block">
              <h3>Distribuição de pacotes</h3>
              <div className="mapa-panel-rows">
                <div>
                  <span>Mercado Livre</span>
                  <b>{distribuicaoTipos.mercadoLivre}</b>
                </div>
                <div>
                  <span>Shopee</span>
                  <b>{distribuicaoTipos.shopee}</b>
                </div>
                <div>
                  <span>Avulso</span>
                  <b>{distribuicaoTipos.avulso}</b>
                </div>
                <div className="mapa-panel-row-total">
                  <span>Total</span>
                  <b>{distribuicaoTipos.total}</b>
                </div>
              </div>
            </section>

            <section className="mapa-panel-block">
              <h3>Horário das baixas</h3>
              <div className="mapa-panel-chips">
                <span>
                  Até 21h <b>{resumoRegiao.mlAte21}</b>
                </span>
                <span>
                  21h–23h <b>{resumoRegiao.mlEntre21e23}</b>
                </span>
                <span>
                  Após 23h <b>{resumoRegiao.mlApos23}</b>
                </span>
              </div>
              <div className="mapa-panel-rows mapa-panel-rows-compact">
                <div>
                  <span>Primeira baixa</span>
                  <b>
                    {resumoRegiao.primeira === null
                      ? "—"
                      : new Date(resumoRegiao.primeira).toLocaleTimeString(
                          "pt-BR",
                          { hour: "2-digit", minute: "2-digit" }
                        )}
                  </b>
                </div>
                <div>
                  <span>Última baixa</span>
                  <b>
                    {resumoRegiao.ultima === null
                      ? "—"
                      : new Date(resumoRegiao.ultima).toLocaleTimeString(
                          "pt-BR",
                          { hour: "2-digit", minute: "2-digit" }
                        )}
                  </b>
                </div>
                <div>
                  <span>Produtividade</span>
                  <b>{resumoRegiao.produtividade}</b>
                </div>
                <div>
                  <span>Média/dia (SLA)</span>
                  <b>{formatarNumeroBr(resumoRegiao.mediaPorDia)}</b>
                </div>
              </div>
            </section>

            <section className="mapa-panel-block">
              <h3>Retornos</h3>
              <div className="mapa-panel-rows">
                <div>
                  <span>Total de retornos</span>
                  <b>{resumoRegiao.retornos}</b>
                </div>
                <div>
                  <span>Voltaram à rota</span>
                  <b>{resumoRegiao.retornaramParaRota}</b>
                </div>
                <div>
                  <span>Entregues após retorno</span>
                  <b>{resumoRegiao.retornosPosteriormenteEntregues}</b>
                </div>
              </div>
            </section>

            <section className="mapa-panel-block mapa-panel-drivers">
              <div className="mapa-panel-block-heading">
                <h3>Entregadores</h3>
                <span>{entregadoresRegiao.length}</span>
              </div>
              {!entregadoresRegiao.length ? (
                <p className="mapa-panel-empty">
                  Nenhum entregador identificado pelos pacotes desta área.
                </p>
              ) : (
                <div className="mapa-driver-list">
                  {entregadoresRegiao.map((id) => {
                    const pacotesEntregadorNoPeriodo =
                      pacotesDaRegiaoSelecionada.filter(
                        (pacote) => usuarioIdRegiao(pacote) === id
                      );
                    const pacotesEntregador =
                      todosPacotesDaRegiao.filter(
                        (pacote) => usuarioIdRegiao(pacote) === id
                      );
                    const resumoEntregador = resumirSlaOperacao(
                      pacotesEntregador,
                      todosUsuariosNomes,
                      intervaloFiltro
                    );
                    const nome =
                      (nomes as Record<string, string>)[id] ||
                      nomeUsuario(id, nomes) ||
                      id;
                    return (
                      <article className="mapa-driver-card" key={id}>
                        <span
                          className="mapa-driver-avatar"
                          style={{
                            background: corUsuario(id, entregadoresRegiao),
                          }}
                        >
                          {String(nome).slice(0, 1).toUpperCase()}
                        </span>
                        <div className="mapa-driver-body">
                          <strong>{nome}</strong>
                          <div>
                            <span>
                              {pacotesEntregadorNoPeriodo.length} pacotes
                            </span>
                            <span>
                              SLA{" "}
                              <b>{formatarPercentual(resumoEntregador.sla)}</b>
                            </span>
                          </div>
                        </div>
                      </article>
                    );
                  })}
                </div>
              )}
            </section>
          </aside>
        )}

        {carregandoRegioes && (
          <div className="mapa-region-loading">Carregando regiões…</div>
        )}

        <button
          type="button"
          className={`mapa-drawer-toggle ${filtrosAbertos ? "open" : ""}`}
          onClick={() => setFiltrosAbertos((v) => !v)}
          aria-expanded={filtrosAbertos}
          title={filtrosAbertos ? "Fechar filtros" : "Abrir filtros"}
        >
          <Filter size={16} />
          <span>Filtros</span>
        </button>

        <aside className={`mapa-drawer ${filtrosAbertos ? "open" : ""}`} aria-hidden={!filtrosAbertos}>
          <div className="mapa-drawer-head">
            <strong>Filtros do mapa</strong>
            <button type="button" className="mapa-drawer-close" onClick={() => setFiltrosAbertos(false)} aria-label="Fechar filtros">
              <X size={16} />
            </button>
          </div>
          <div className="mapa-drawer-body">
      <section className="mapa-controls">

        <label className="mapa-field">
          <span>Usuário</span>
          <select
            value={usuario}
            onChange={(event) => setUsuario(event.target.value)}
          >
            <option value="TODOS">Todos os usuários</option>
            {usuariosAtivos.map((id) => (
              <option key={id} value={id}>
                {nomeUsuario(id, nomes)}
              </option>
            ))}
          </select>
        </label>

        <label className="mapa-field">
          <span>Tipo</span>
          <select
            value={tipo}
            onChange={(event) => setTipo(event.target.value)}
          >
            <option value="TODOS">Todos os tipos</option>
            <option value="MERCADO_LIVRE">Mercado Livre</option>
            <option value="SHOPEE">Shopee</option>
            <option value="AVULSO">Avulso</option>
          </select>
        </label>

        <label className="mapa-field">
          <span>Status</span>
          <select
            value={status}
            onChange={(event) => setStatus(event.target.value)}
          >
            <option value="TODOS">Todos os status</option>
            {(
              [
                "COLETADO",
                "ROTA",
                "ENTREGUE",
                "AUSENTE",
                "DEVOLVIDO",
              ] as StatusPacote[]
            ).map((item) => (
              <option key={item} value={item}>
                {nomeStatus(item)}
              </option>
            ))}
          </select>
        </label>

        <label className="mapa-field mapa-period-field">
          <span>Período</span>
          <select
            value={periodo}
            onChange={(event) => alterarPeriodo(event.target.value)}
          >
            <option value="HOJE">Hoje</option>
            <option value="DIA_ANTERIOR">Dia anterior</option>
            <option value="7_DIAS">Últimos 7 dias</option>
            <option value="30_DIAS">Últimos 30 dias</option>
            <option value="PERSONALIZADO">Personalizado</option>
            <option value="TODOS">Todo período</option>
          </select>
        </label>

        {periodo === "PERSONALIZADO" && (
          <>
            <label className="mapa-field mapa-date-field">
              <span>De</span>
              <input
                type="date"
                value={ini}
                onChange={(event) => setIni(event.target.value)}
              />
            </label>
            <label className="mapa-field mapa-date-field">
              <span>Até</span>
              <input
                type="date"
                value={fim}
                onChange={(event) => setFim(event.target.value)}
              />
            </label>
          </>
        )}

        <div className="mapa-control-actions">
          <button
            type="button"
            className="mapa-button mapa-button-light"
            onClick={() => void carregar()}
            disabled={loading}
            title="Atualizar pacotes"
          >
            <RefreshCw
              size={16}
              className={loading ? "mapa-spin" : ""}
            />
            Atualizar
          </button>
        </div>
      </section>
      {(regioes.length > 0 || pontos.length > 0) && (
        <section className="mapa-region-manager" aria-label="Regiões cadastradas">
          <div className="mapa-region-manager-heading">
            <strong>Regiões</strong>
            <small>
              {iconesVisiveis
                ? `ícones de ${regioesAtivas.length} de ${regioes.length} região(ões) no mapa`
                : "ícones ocultos no mapa"}
            </small>
          </div>
          <button
            type="button"
            className={`mapa-region-all-toggle ${todosIconesLigados ? "on" : ""}`}
            onClick={alternarTodasRegioes}
            title={
              todosIconesLigados
                ? "Ocultar todos os ícones do mapa"
                : "Mostrar todos os ícones do mapa"
            }
            aria-pressed={todosIconesLigados}
          >
            {todosIconesLigados ? <Eye size={14} /> : <EyeOff size={14} />}
            <span>
              {todosIconesLigados
                ? "Ocultar todos os ícones"
                : "Mostrar todos os ícones"}
            </span>
          </button>
          <div className="mapa-region-chips">
            {regioes.map((regiao) => {
              const ativa = regioesAtivas.includes(regiao.id);
              return (
                <div
                  key={regiao.id}
                  className={`mapa-region-chip ${ativa ? "on" : ""}`}
                  style={{ ["--mapa-region-color" as any]: regiao.cor }}
                >
                  <button
                    type="button"
                    className="mapa-region-chip-name"
                    onClick={() => setRegiaoSelecionada(regiao)}
                    title="Ver resumo da região"
                  >
                    <i />
                    <span>{regiao.nome}</span>
                  </button>
                  <button
                    type="button"
                    className="mapa-region-chip-toggle"
                    onClick={() => alternarRegiaoAtiva(regiao.id)}
                    title={ativa ? "Ocultar ícones da região" : "Mostrar ícones da região"}
                    aria-label={ativa ? "Ocultar ícones da região" : "Mostrar ícones da região"}
                    aria-pressed={ativa}
                  >
                    {ativa ? <Eye size={14} /> : <EyeOff size={14} />}
                  </button>
                </div>
              );
            })}
          </div>
        </section>
      )}
      <section className="mapa-overview" aria-label="Resumo do mapa">
        <div className="mapa-stat">
          <span className="mapa-stat-icon blue">
            <Package size={17} />
          </span>
          <div>
            <small>Pacotes no período</small>
            <strong>{itemsPeriodo.length.toLocaleString("pt-BR")}</strong>
          </div>
        </div>
        <div className="mapa-stat">
          <span className="mapa-stat-icon green">
            <MapPinned size={17} />
          </span>
          <div>
            <small>Pontos no mapa</small>
            <strong>{pontos.length.toLocaleString("pt-BR")}</strong>
          </div>
        </div>
        <div className="mapa-stat">
          <span className="mapa-stat-icon violet">
            <Users size={17} />
          </span>
          <div>
            <small>Entregadores ativos</small>
            <strong>{usuariosAtivos.length.toLocaleString("pt-BR")}</strong>
          </div>
        </div>
        <div className="mapa-overview-note">
          {semCoordenadas > 0
            ? `${semCoordenadas} pacote(s) sem coordenadas válidas`
            : loading
              ? "Atualizando pacotes…"
              : `${regioes.length} região(ões) salvas`}
        </div>
      </section>
          </div>
        </aside>

        {isAdmin && (
          <div className="mapa-corner-tools">
            <button
              type="button"
              className={`mapa-button ${
                modoRegiao ? "mapa-button-light" : "mapa-button-primary"
              }`}
              onClick={
                modoRegiao ? cancelarEdicaoRegiao : iniciarNovaRegiao
              }
              disabled={salvandoRegiao}
            >
              {modoRegiao ? <X size={16} /> : <Plus size={16} />}
              {modoRegiao ? "Sair da edição" : "Editar regiões"}
            </button>
      {isAdmin && modoRegiao && (
        <section className="mapa-editor">
          <div className="mapa-editor-copy">
            <span className="mapa-editor-icon">
              <MapIcon size={18} />
            </span>
            <div>
              <strong>
                {regiaoEditando ? "Editando região" : "Desenhar nova região"}
              </strong>
              <p>
                {desenhando
                  ? "Clique no mapa para adicionar vértices. Arraste os pontos para ajustar."
                  : "Arraste os vértices para ajustar o formato e salve as alterações."}
              </p>
            </div>
          </div>

          <div className="mapa-editor-actions">
            {desenhando && pontosDesenho.length > 0 && (
              <button
                type="button"
                className="mapa-button mapa-button-light"
                onClick={() =>
                  setPontosDesenho((atual) => atual.slice(0, -1))
                }
              >
                Desfazer ponto
              </button>
            )}
            {desenhando && pontosDesenho.length >= 3 && (
              <button
                type="button"
                className="mapa-button mapa-button-primary"
                onClick={finalizarDesenho}
              >
                <Check size={15} />
                Fechar região
              </button>
            )}
            {!desenhando && (
              <div className="mapa-editor-form">
                <label className="mapa-field mapa-region-name">
                  <span>Nome da região</span>
                  <input
                    value={nomeRegiao}
                    onChange={(event) => setNomeRegiao(event.target.value)}
                    placeholder={`Região ${regioes.length + 1}`}
                  />
                </label>
                <label className="mapa-color-field" title="Cor da região">
                  <Palette size={15} />
                  <input
                    type="color"
                    value={corRegiao}
                    onChange={(event) => setCorRegiao(event.target.value)}
                    aria-label="Cor da região"
                  />
                </label>
                <label className="mapa-tone-field" title="Transparência da área">
                  <span>Transparente</span>
                  <input
                    type="range"
                    min={0}
                    max={100}
                    step={5}
                    value={tomRegiao}
                    onChange={(event) => setTomRegiao(Number(event.target.value))}
                    aria-label="Transparência da área da região"
                  />
                  <span>Sólida</span>
                  <i style={{ background: corRegiao, opacity: tomRegiao / 100 }} />
                </label>
                <span className="mapa-vertex-count">
                  {pontosAtuais.length} vértices
                </span>
                <button
                  type="button"
                  className="mapa-button mapa-button-primary"
                  onClick={() => void salvarRegiao()}
                  disabled={salvandoRegiao || pontosAtuais.length < 3}
                >
                  <Save size={15} />
                  {salvandoRegiao ? "Salvando..." : "Salvar região"}
                </button>
              </div>
            )}
            <button
              type="button"
              className="mapa-button mapa-button-quiet"
              onClick={cancelarEdicaoRegiao}
              disabled={salvandoRegiao}
            >
              Cancelar
            </button>
          </div>
        </section>
      )}
          </div>
        )}
      </main>
    </div>
  );
}

const CSS_MAPA = `
  .mapa-page {
    --mapa-ink: #0f172a;
    --mapa-muted: #64748b;
    --mapa-border: #e2e8f0;
    --mapa-blue: #1d4ed8;
    --mapa-surface: #fff;
    --mapa-shadow: 0 1px 2px rgba(15,23,42,.04), 0 8px 24px -12px rgba(15,23,42,.14);
    color: var(--mapa-ink);
    min-width: 0;
    display: grid;
    gap: 14px;
    padding-bottom: 24px;
    letter-spacing: -.005em;
  }
  .mapa-page, .mapa-page * { box-sizing: border-box; }
  .mapa-controls {
    display: flex;
    align-items: flex-end;
    flex-wrap: wrap;
    gap: 12px;
    padding: 16px 18px;
    margin: 14px 0 0;
    border: 1px solid var(--mapa-border);
    border-radius: 18px;
    background: var(--mapa-surface);
    box-shadow: var(--mapa-shadow);
  }
  .mapa-controls-heading {
    display: flex;
    align-items: center;
    gap: 9px;
    min-width: 155px;
    margin-right: 2px;
    padding: 0 8px 4px 1px;
  }
  .mapa-controls-heading strong, .mapa-controls-heading small { display: block; }
  .mapa-controls-heading strong { font-size: 13px; font-weight: 700; }
  .mapa-controls-heading small { color: var(--mapa-muted); font-size: 11px; margin-top: 2px; }
  .mapa-filter-icon, .mapa-editor-icon {
    width: 34px; height: 34px; display: grid; place-items: center;
    color: var(--mapa-blue); background: #eff6ff; border-radius: 10px; flex: none;
  }
  .mapa-field { display: grid; gap: 5px; min-width: 132px; }
  .mapa-field > span { color: #667085; font-size: 10px; font-weight: 700; letter-spacing: .045em; text-transform: uppercase; }
  .mapa-field select, .mapa-field input {
    height: 37px; min-width: 0; width: 100%; padding: 0 10px;
    border: 1px solid #d0d5dd; border-radius: 8px; background: #fff;
    color: #344054; font: inherit; font-size: 12px; outline: none;
  }
  .mapa-field select:focus, .mapa-field input:focus { border-color: #84adff; box-shadow: 0 0 0 3px #eff6ff; }
  .mapa-period-field { min-width: 142px; }
  .mapa-date-field { min-width: 132px; }
  .mapa-control-actions { display: flex; flex-wrap: wrap; gap: 8px; margin-left: auto; }
  .mapa-button {
    min-height: 37px; display: inline-flex; align-items: center; justify-content: center;
    gap: 7px; padding: 0 12px; border: 1px solid transparent; border-radius: 9px;
    font: inherit; font-size: 12px; font-weight: 700; cursor: pointer; white-space: nowrap;
    transition: background .16s ease, border-color .16s ease, transform .16s ease;
  }
  .mapa-button:disabled { opacity: .55; cursor: not-allowed; }
  .mapa-button:not(:disabled):active { transform: translateY(1px); }
  .mapa-button-primary { background: #1769e0; color: white; box-shadow: 0 2px 5px rgba(23, 105, 224, .16); }
  .mapa-button-primary:hover:not(:disabled) { background: #0e57c5; }
  .mapa-button-light { border-color: #d0d5dd; color: #344054; background: #fff; }
  .mapa-button-light:hover:not(:disabled), .mapa-button-quiet:hover:not(:disabled) { background: #f8fafc; border-color: #98a2b3; }
  .mapa-button-quiet { color: #667085; background: transparent; border-color: transparent; }

  /* Gerenciamento discreto das regiões (fora do mapa) */
  .mapa-region-manager {
    display: flex; align-items: center; flex-wrap: wrap; gap: 12px;
    padding: 12px 16px; margin: 0; border: 1px solid var(--mapa-border);
    border-radius: 16px; background: #fff; box-shadow: var(--mapa-shadow);
  }
  .mapa-region-manager-heading strong { letter-spacing: -.01em; }
  .mapa-region-manager-heading { display: grid; min-width: 140px; }
  .mapa-region-manager-heading strong { font-size: 12px; }
  .mapa-region-manager-heading small { margin-top: 2px; color: var(--mapa-muted); font-size: 10px; }
  .mapa-region-chips { display: flex; flex-wrap: wrap; gap: 7px; }
  .mapa-region-chip {
    display: flex; align-items: center; gap: 2px; padding: 2px 3px 2px 2px;
    border: 1px solid #e4e7ec; border-radius: 999px; background: #f9fafb;
  }
  .mapa-region-chip.on { border-color: var(--mapa-region-color); background: #fff; }
  .mapa-region-chip-name {
    display: flex; align-items: center; gap: 6px; max-width: 170px; padding: 5px 8px;
    border: 0; border-radius: 999px; background: transparent; color: #344054;
    font: inherit; font-size: 11px; font-weight: 600; cursor: pointer;
  }
  .mapa-region-chip-name i { width: 9px; height: 9px; flex: none; border-radius: 3px; background: var(--mapa-region-color); opacity: .45; }
  .mapa-region-chip.on .mapa-region-chip-name i { opacity: 1; }
  .mapa-region-chip-name span { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .mapa-region-chip-toggle {
    width: 26px; height: 26px; display: grid; place-items: center; flex: none;
    border: 0; border-radius: 999px; color: #98a2b3; background: transparent; cursor: pointer;
  }
  .mapa-region-chip.on .mapa-region-chip-toggle { color: var(--mapa-region-color); }
  .mapa-region-chip-toggle:hover { background: #f2f4f7; }
  .mapa-region-all-toggle {
    display: inline-flex; align-items: center; gap: 6px; flex: none;
    height: 30px; padding: 0 11px; border: 1px solid #d0d5dd; border-radius: 999px;
    color: #667085; background: #fff; font: inherit; font-size: 11px; font-weight: 700;
    cursor: pointer; transition: background .16s ease, border-color .16s ease, color .16s ease;
  }
  .mapa-region-all-toggle:hover { background: #f8fafc; border-color: #98a2b3; }
  .mapa-region-all-toggle.on { border-color: #1769e0; color: #1769e0; background: #eff6ff; }

  .mapa-editor {
    display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 15px;
    padding: 12px 15px; margin: 0 0 10px; border: 1px solid #bfd5ff;
    border-radius: 13px; background: linear-gradient(105deg, #f5f9ff, #fff);
  }
  .mapa-editor-copy { display: flex; align-items: center; gap: 10px; }
  .mapa-editor-copy strong { display: block; font-size: 13px; }
  .mapa-editor-copy p { margin: 3px 0 0; color: var(--mapa-muted); font-size: 11px; }
  .mapa-editor-actions, .mapa-editor-form { display: flex; align-items: flex-end; flex-wrap: wrap; gap: 8px; }
  .mapa-region-name { min-width: 190px; }
  .mapa-color-field {
    height: 37px; display: flex; align-items: center; gap: 7px; padding: 0 8px;
    color: #667085; border: 1px solid #d0d5dd; border-radius: 8px; background: white;
  }
  .mapa-color-field input { width: 27px; height: 27px; padding: 0; border: 0; background: transparent; cursor: pointer; }
  .mapa-tone-field {
    display: flex; align-items: center; gap: 6px; height: 36px; padding: 0 9px;
    border: 1px solid #d0d5dd; border-radius: 8px; background: white;
    color: #667085; font-size: 10px; font-weight: 700;
  }
  .mapa-tone-field input { width: 96px; cursor: pointer; }
  .mapa-tone-field i { width: 18px; height: 18px; border-radius: 5px; border: 1px solid rgba(16,24,40,.15); }
  .mapa-center-button {
    position: absolute; z-index: 500; left: 50%; bottom: 18px; transform: translateX(-50%);
    display: inline-flex; align-items: center; gap: 6px; height: 34px; padding: 0 13px;
    border: 1px solid #d0d5dd; border-radius: 999px; background: rgba(255,255,255,.96);
    color: #344054; font: inherit; font-size: 12px; font-weight: 700; cursor: pointer;
    box-shadow: 0 4px 12px rgba(16,24,40,.14);
  }
  .mapa-center-button:hover { color: var(--mapa-blue); border-color: #84adff; }
  .mapa-vertex-count { align-self: center; color: #667085; font-size: 11px; white-space: nowrap; }
  .mapa-error {
    display: flex; justify-content: space-between; align-items: center; gap: 10px;
    margin: 0 0 10px; padding: 10px 12px; border: 1px solid #fecdca;
    border-radius: 10px; color: #b42318; background: #fff5f4; font-size: 12px;
  }
  .mapa-error button { display: grid; place-items: center; border: 0; background: transparent; color: inherit; cursor: pointer; }
  .mapa-overview {
    display: grid; align-items: center;
    grid-template-columns: repeat(3, minmax(160px, 1fr)) minmax(150px, auto);
    gap: 12px; padding: 14px 18px; margin: 0;
    border: 1px solid var(--mapa-border); border-radius: 16px; background: white;
    box-shadow: var(--mapa-shadow);
  }
  .mapa-stat {
    display: flex; align-items: center; gap: 11px; min-width: 0;
    padding: 4px 12px 4px 0; border-right: 1px solid #eef2f6;
  }
  .mapa-stat:last-of-type { border-right: 0; }
  .mapa-stat-icon { width: 32px; height: 32px; display: grid; place-items: center; border-radius: 9px; }
  .mapa-stat-icon.blue { color: #1769e0; background: #eff6ff; }
  .mapa-stat-icon.green { color: #15803d; background: #f0fdf4; }
  .mapa-stat-icon.violet { color: #7c3aed; background: #f5f3ff; }
  .mapa-stat small, .mapa-stat strong { display: block; }
  .mapa-stat small { color: var(--mapa-muted); font-size: 10px; font-weight: 700; letter-spacing: .05em; text-transform: uppercase; }
  .mapa-stat strong { margin-top: 3px; font-size: 20px; line-height: 1.05; letter-spacing: -.02em; }
  .mapa-overview-note {
    justify-self: end; padding: 7px 11px; border-radius: 999px;
    background: #f5f7fa; color: #64748b; font-size: 11px; font-weight: 600;
  }
  .mapa-map-shell {
    position: relative; isolation: isolate; width: 100%; height: min(76vh, 940px);
    min-height: 580px; overflow: hidden; border: 1px solid var(--mapa-border);
    border-radius: 20px; background: #edf2f7;
    box-shadow: 0 1px 2px rgba(15,23,42,.05), 0 24px 48px -24px rgba(15,23,42,.28);
  }
  .mapa-leaflet { width: 100%; height: 100%; z-index: 1; background: #e9eff5; }
  .mapa-map-badge {
    position: absolute; z-index: 500; top: 13px; left: 13px; display: flex; align-items: center; gap: 7px;
    padding: 8px 10px; border: 1px solid rgba(228,231,236,.9); border-radius: 999px;
    background: rgba(255,255,255,.95); box-shadow: 0 2px 8px rgba(16,24,40,.1);
    color: #344054; font-size: 11px; font-weight: 700; pointer-events: none;
  }
  .mapa-live-dot { width: 7px; height: 7px; border-radius: 50%; background: #12b76a; }
  .mapa-locate-button {
    position: absolute; z-index: 500; right: 13px; top: 13px; width: 39px; height: 39px;
    display: grid; place-items: center; color: #344054; border: 1px solid #e4e7ec;
    border-radius: 10px; background: rgba(255,255,255,.96); box-shadow: 0 2px 8px rgba(16,24,40,.1);
    cursor: pointer;
  }
  .mapa-locate-button:hover { color: var(--mapa-blue); background: white; }

  /* Indicador central da região — cartão compacto com nome, SLA e pacotes */
  .mapa-region-badge-icon { border: 0; background: transparent; overflow: visible; }
  .mapa-region-badge {
    position: absolute; left: 0; top: 0; transform: translate(-50%, -50%);
    display: inline-flex; align-items: center; gap: 5px; white-space: nowrap;
    padding: 3px 7px 3px 6px; border-radius: 999px;
    border: 1px solid color-mix(in srgb, var(--mapa-region-color) 45%, #d6dbe4);
    background: rgba(255,255,255,.88);
    box-shadow: 0 2px 8px rgba(16,24,40,.16);
    cursor: pointer; font-family: inherit; font-size: 11px; line-height: 1.2;
    -webkit-font-smoothing: antialiased; opacity: .92;
    transition: opacity .15s ease, box-shadow .15s ease;
  }
  .mapa-region-badge:hover { opacity: 1; box-shadow: 0 4px 14px rgba(16,24,40,.24); z-index: 10; }
  .mapa-region-badge-dot { width: 7px; height: 7px; border-radius: 50%; background: var(--mapa-region-color); flex: none; }
  .mapa-region-badge-name { max-width: 90px; overflow: hidden; text-overflow: ellipsis; color: #101828; font-weight: 700; }
  .mapa-region-badge-value { color: var(--mapa-region-color); font-weight: 800; }
  .mapa-region-badge-count { color: #475467; font-weight: 700; padding-left: 5px; border-left: 1px solid #e4e7ec; }

  .mapa-draw-hint {
    position: absolute; z-index: 500; top: 13px; left: 50%; transform: translateX(-50%);
    display: flex; align-items: center; gap: 9px; padding: 9px 12px;
    border: 1px solid #b2ccff; border-radius: 11px; color: #194185; background: rgba(239,246,255,.97);
    box-shadow: 0 3px 12px rgba(16,24,40,.12); font-size: 11px; pointer-events: none;
  }
  .mapa-draw-hint span, .mapa-draw-hint b { display: block; }
  .mapa-draw-hint b { margin-top: 2px; font-size: 10px; }
  .mapa-loading-shade {
    position: absolute; z-index: 450; inset: 0; display: flex; align-items: center; justify-content: center; gap: 9px;
    color: #344054; background: rgba(248,250,252,.58); backdrop-filter: blur(1px); font-size: 12px; pointer-events: none;
  }
  .mapa-loader { width: 18px; height: 18px; border: 2px solid #cbd5e1; border-top-color: #1769e0; border-radius: 50%; animation: mapa-spin .75s linear infinite; }
  .mapa-region-loading { position: absolute; z-index: 510; right: 62px; top: 17px; color: #667085; font-size: 11px; }

  /* Painel da região */
  .mapa-region-panel {
    position: absolute; z-index: 600; top: 12px; right: 12px; bottom: 12px;
    display: flex; flex-direction: column; gap: 12px; width: min(400px, calc(100% - 24px));
    overflow-y: auto; padding: 16px; border: 1px solid rgba(228,231,236,.95); border-radius: 16px;
    background: rgba(255,255,255,.985); box-shadow: 0 14px 40px rgba(16,24,40,.22);
  }
  .mapa-panel-header {
    display: flex; justify-content: space-between; align-items: flex-start; gap: 10px;
    padding: 12px; border: 1px solid #eaecf0; border-left: 4px solid var(--mapa-region-color);
    border-radius: 12px; background: #fbfcfe;
  }
  .mapa-panel-title { min-width: 0; }
  .mapa-panel-title small { display: block; color: #98a2b3; font-size: 9px; font-weight: 800; letter-spacing: .12em; }
  .mapa-panel-title h2 { margin: 3px 0 0; font-size: 17px; line-height: 1.2; overflow-wrap: anywhere; }
  .mapa-panel-sla { display: flex; align-items: baseline; gap: 6px; margin-top: 7px; }
  .mapa-panel-sla span { color: #667085; font-size: 9px; font-weight: 800; letter-spacing: .1em; }
  .mapa-panel-sla strong { color: var(--mapa-region-color); font-size: 19px; line-height: 1; }
  .mapa-panel-actions { display: flex; gap: 4px; flex: none; }
  .mapa-panel-actions button { width: 30px; height: 30px; display: grid; place-items: center; border: 1px solid #eaecf0; border-radius: 8px; color: #667085; background: white; cursor: pointer; }
  .mapa-panel-actions button:hover { color: #1769e0; border-color: #b2ccff; }
  .mapa-panel-actions .mapa-panel-action-danger:hover { color: #b42318; border-color: #fecdca; }
  .mapa-panel-period { display: flex; justify-content: space-between; gap: 8px; padding: 8px 10px; border-radius: 9px; color: #475467; background: #f8fafc; font-size: 10px; font-weight: 600; }
  .mapa-panel-block { display: grid; gap: 9px; }
  .mapa-panel-block h3 { margin: 0; color: #344054; font-size: 11px; font-weight: 800; letter-spacing: .03em; text-transform: uppercase; }
  .mapa-panel-block-heading { display: flex; align-items: center; justify-content: space-between; }
  .mapa-panel-block-heading > span { min-width: 21px; padding: 3px 7px; border-radius: 99px; color: #175cd3; background: #eff6ff; text-align: center; font-size: 10px; font-weight: 700; }
  .mapa-panel-cards { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 7px; }
  .mapa-panel-card { min-height: 58px; padding: 9px; border: 1px solid #eaecf0; border-radius: 10px; background: #fff; }
  .mapa-panel-card small, .mapa-panel-card strong { display: block; }
  .mapa-panel-card small { color: #667085; font-size: 9px; font-weight: 700; text-transform: uppercase; letter-spacing: .04em; }
  .mapa-panel-card strong { margin-top: 6px; color: #182230; font-size: 17px; line-height: 1; }
  .mapa-panel-card-sla { border-color: #c7d7fe; background: #f5f8ff; }
  .mapa-panel-card-sla strong { color: #175cd3; }
  .mapa-volume-list { display: grid; gap: 5px; }
  .mapa-volume-row { display: grid; grid-template-columns: 104px 1fr 30px; align-items: center; gap: 8px; }
  .mapa-volume-day { display: grid; color: #475467; font-size: 10px; font-weight: 600; }
  .mapa-volume-day i { color: #98a2b3; font-size: 9px; font-style: normal; }
  .mapa-volume-bar { height: 7px; border-radius: 99px; background: #f2f4f7; overflow: hidden; }
  .mapa-volume-bar i { display: block; height: 100%; border-radius: 99px; }
  .mapa-volume-row b { color: #182230; font-size: 11px; text-align: right; }
  .mapa-panel-footnote { display: flex; align-items: baseline; justify-content: space-between; gap: 8px; padding: 8px 10px; border-radius: 9px; background: #f8fafc; }
  .mapa-panel-footnote span { color: #667085; font-size: 10px; font-weight: 700; }
  .mapa-panel-footnote strong { color: #182230; font-size: 12px; }
  .mapa-panel-rows { display: grid; gap: 1px; border: 1px solid #eaecf0; border-radius: 10px; overflow: hidden; background: #eaecf0; }
  .mapa-panel-rows > div { display: flex; align-items: center; justify-content: space-between; gap: 10px; padding: 8px 10px; background: #fff; }
  .mapa-panel-rows span { color: #667085; font-size: 11px; }
  .mapa-panel-rows b { color: #182230; font-size: 12px; }
  .mapa-panel-rows-compact > div { padding: 7px 10px; }
  .mapa-panel-row-total { background: #f8fafc !important; }
  .mapa-panel-row-total span, .mapa-panel-row-total b { font-weight: 800; color: #182230; }
  .mapa-panel-chips { display: grid; grid-template-columns: repeat(3, minmax(0,1fr)); gap: 6px; }
  .mapa-panel-chips span { display: flex; justify-content: space-between; gap: 5px; padding: 8px; border: 1px solid #eaecf0; border-radius: 9px; color: #667085; font-size: 9px; }
  .mapa-panel-chips b { color: #182230; font-size: 11px; }
  .mapa-panel-empty { margin: 0; color: #667085; font-size: 11px; }
  .mapa-panel-drivers { min-height: 0; }
  .mapa-driver-list { display: grid; gap: 7px; }
  .mapa-driver-card { display: flex; align-items: center; gap: 9px; padding: 9px; border: 1px solid #eaecf0; border-radius: 10px; }
  .mapa-driver-avatar { width: 29px; height: 29px; display: grid; place-items: center; flex: none; border-radius: 9px; color: white; font-size: 12px; font-weight: 700; }
  .mapa-driver-body { min-width: 0; flex: 1; }
  .mapa-driver-body > strong { display: block; overflow: hidden; color: #344054; font-size: 11px; text-overflow: ellipsis; white-space: nowrap; }
  .mapa-driver-body > div { display: flex; gap: 13px; margin-top: 4px; color: #667085; font-size: 9px; }
  .mapa-driver-body b { color: #344054; }

  .mapa-popup { min-width: 245px; max-width: 300px; color: #182230; font-size: 12px; line-height: 1.4; }
  .mapa-popup-heading { display: flex; justify-content: space-between; align-items: flex-start; gap: 12px; padding-bottom: 10px; border-bottom: 1px solid #eaecf0; }
  .mapa-popup-heading small, .mapa-popup-heading strong, .mapa-popup-grid small, .mapa-popup-grid strong, .mapa-popup-address small, .mapa-popup-address strong { display: block; }
  .mapa-popup-heading small, .mapa-popup-grid small, .mapa-popup-address small { color: #667085; font-size: 9px; text-transform: uppercase; letter-spacing: .04em; }
  .mapa-popup-heading strong { margin-top: 2px; font-size: 14px; overflow-wrap: anywhere; }
  .mapa-popup-status { padding: 4px 6px; border-radius: 99px; color: #344054; background: #f2f4f7; font-size: 9px; font-weight: 700; white-space: nowrap; }
  .mapa-popup-status.status-entregue { color: #027a48; background: #ecfdf3; }
  .mapa-popup-status.status-ausente { color: #b42318; background: #fef3f2; }
  .mapa-popup-status.status-rota { color: #175cd3; background: #eff8ff; }
  .mapa-popup-grid { display: grid; grid-template-columns: repeat(2,minmax(0,1fr)); gap: 10px; padding: 10px 0; }
  .mapa-popup-grid strong, .mapa-popup-address strong { margin-top: 3px; color: #344054; font-size: 11px; overflow-wrap: anywhere; }
  .mapa-popup-address { padding-top: 8px; border-top: 1px solid #eaecf0; }
  .mapa-popup-coordinates { margin-top: 8px; color: #98a2b3; font-size: 9px; }
  .mapa-state-card { min-height: 250px; display: flex; align-items: center; justify-content: center; margin-top: 14px; padding: 24px; border: 1px solid #eaecf0; border-radius: 14px; background: white; color: #475467; font-size: 14px; }
  .mapa-denied { gap: 16px; text-align: left; }
  .mapa-denied-icon { width: 56px; height: 56px; display: grid; place-items: center; flex: none; border-radius: 15px; color: #b42318; background: #fef3f2; }
  .mapa-denied h2 { margin: 0; color: #182230; font-size: 18px; }
  .mapa-denied p { margin: 7px 0 0; color: #667085; font-size: 13px; }
  .mapa-vertex-icon, .mapa-midpoint-icon { border: 0; background: transparent; }
  .mapa-vertex-dot { display: block; width: 16px; height: 16px; margin: 2px; border: 3px solid white; border-radius: 50%; background: #1769e0; box-shadow: 0 1px 5px rgba(16,24,40,.45); cursor: grab; }
  .mapa-midpoint-plus { display: grid; place-items: center; width: 21px; height: 21px; border: 2px solid white; border-radius: 50%; color: white; background: #1769e0; box-shadow: 0 1px 5px rgba(16,24,40,.4); font: 700 15px/1 sans-serif; cursor: pointer; }
  .mapa-spin { animation: mapa-spin .8s linear infinite; }
  @keyframes mapa-spin { to { transform: rotate(360deg); } }
  @media (max-width: 1100px) {
    .mapa-controls-heading { min-width: 145px; }
    .mapa-controls { align-items: flex-end; }
    .mapa-control-actions { margin-left: 0; }
    .mapa-map-shell { height: 70vh; min-height: 520px; }
    .mapa-overview { grid-template-columns: repeat(2, minmax(0,1fr)); }
    .mapa-overview-note { grid-column: 1 / -1; justify-self: start; }
  }
  @media (max-width: 700px) {
    .mapa-controls { gap: 8px; padding: 11px; }
    .mapa-controls-heading { width: 100%; padding-bottom: 2px; }
    .mapa-field { flex: 1 1 calc(50% - 8px); min-width: 120px; }
    .mapa-control-actions { width: 100%; }
    .mapa-control-actions .mapa-button { flex: 1; }
    .mapa-overview { grid-template-columns: repeat(2, minmax(0,1fr)); gap: 10px; padding: 12px; }
    .mapa-stat { border-right: 0; padding-right: 0; }
    .mapa-overview-note { grid-column: 1 / -1; justify-self: start; }
    .mapa-region-manager { align-items: flex-start; }
    .mapa-map-shell { height: 68vh; min-height: 470px; border-radius: 12px; }
    .mapa-region-panel { top: auto; left: 8px; right: 8px; bottom: 8px; width: auto; max-height: 66%; padding: 12px; gap: 10px; }
    .mapa-draw-hint { top: 60px; width: max-content; max-width: calc(100% - 24px); }
    .mapa-editor { align-items: flex-start; }
    .mapa-editor-actions { width: 100%; }
    .mapa-editor-form { width: 100%; }
    .mapa-region-name { flex: 1; }
    .mapa-vertex-count { display: none; }
  }
  @media (max-width: 390px) {
    .mapa-panel-cards { grid-template-columns: repeat(2,minmax(0,1fr)); }
    .mapa-panel-chips { grid-template-columns: 1fr; }
    .mapa-volume-row { grid-template-columns: 88px 1fr 28px; }
    .mapa-region-panel { max-height: 72%; }
  }

  /* ===== Tela cheia + gaveta de filtros ===== */
  .mapa-page.mapa-fullpage { position: relative; padding: 0 !important; gap: 0 !important; max-width: none !important; }
  .mapa-fullpage .mapa-error { position: absolute; z-index: 900; top: 12px; left: 50%; transform: translateX(-50%); }
  .mapa-fullpage .mapa-map-shell { height: calc(100vh - 16px); min-height: 480px; border-radius: 0; border: 0; box-shadow: none; }
  .mapa-fullpage .leaflet-top.leaflet-left { top: 56px; }
  .mapa-fullpage .mapa-map-badge { top: auto; bottom: 18px; left: 13px; }
  .mapa-drawer-toggle {
    position: absolute; z-index: 700; top: 13px; left: 13px; display: inline-flex; align-items: center; gap: 7px;
    height: 38px; padding: 0 14px; border: 0; border-radius: 10px; background: #0f172a; color: #fff;
    font: inherit; font-size: 13px; font-weight: 700; cursor: pointer; box-shadow: 0 6px 18px rgba(15,23,42,.3);
    transition: left .3s ease, background .2s;
  }
  .mapa-drawer-toggle.open { left: 373px; background: #1d4ed8; }
  .mapa-drawer {
    position: absolute; z-index: 800; top: 0; left: 0; bottom: 0; width: 360px; max-width: calc(100% - 50px);
    display: flex; flex-direction: column; background: #fff; box-shadow: 12px 0 40px -12px rgba(15,23,42,.35);
    transform: translateX(-105%); transition: transform .3s ease;
  }
  .mapa-drawer.open { transform: translateX(0); }
  .mapa-drawer-head { display: flex; align-items: center; justify-content: space-between; padding: 16px 18px; border-bottom: 1px solid #e4e7ec; }
  .mapa-drawer-head strong { font-size: 15px; color: #0f172a; }
  .mapa-drawer-close { display: grid; place-items: center; width: 32px; height: 32px; border: 1px solid #e4e7ec; border-radius: 8px; background: #fff; color: #344054; cursor: pointer; }
  .mapa-drawer-body { flex: 1; overflow-y: auto; padding: 14px 16px 20px; display: flex; flex-direction: column; gap: 14px; }
  .mapa-drawer .mapa-controls, .mapa-drawer .mapa-region-manager, .mapa-drawer .mapa-overview {
    display: flex !important; flex-direction: column; align-items: stretch !important; gap: 10px;
    margin: 0; padding: 0; border: 0; box-shadow: none; background: transparent;
  }
  .mapa-drawer .mapa-field, .mapa-drawer .mapa-control-actions, .mapa-drawer .mapa-control-actions .mapa-button { width: 100%; flex: none; margin: 0; }
  .mapa-drawer .mapa-region-manager, .mapa-drawer .mapa-overview { padding-top: 14px; border-top: 1px solid #e4e7ec; }
  .mapa-drawer .mapa-region-chips { display: flex; flex-wrap: wrap; gap: 6px; }
  .mapa-drawer .mapa-stat { border: 0; padding: 0; }
  .mapa-drawer .mapa-overview-note { justify-self: auto; align-self: flex-start; }
  .mapa-corner-tools { position: absolute; z-index: 650; top: 62px; right: 13px; display: flex; flex-direction: column; align-items: flex-end; gap: 8px; max-width: calc(100% - 26px); }
  .mapa-corner-tools > .mapa-button { box-shadow: 0 6px 18px rgba(15,23,42,.25); }
  .mapa-corner-tools .mapa-editor { width: min(380px, calc(100vw - 40px)); margin: 0; flex-direction: column; align-items: stretch; background: #fff; border-radius: 14px; padding: 14px; box-shadow: 0 16px 40px -12px rgba(15,23,42,.4); }
  .mapa-corner-tools .mapa-editor-actions, .mapa-corner-tools .mapa-editor-form { flex-wrap: wrap; width: 100%; }
  .mapa-fullpage .mapa-draw-hint { top: 13px; }
  .mapa-corner-tools .mapa-editor { width: auto; max-width: min(340px, calc(100vw - 40px)); padding: 8px 10px; gap: 6px; border-radius: 12px; }
  .mapa-corner-tools .mapa-editor-copy { gap: 6px; }
  .mapa-corner-tools .mapa-editor-copy p, .mapa-corner-tools .mapa-editor-icon { display: none; }
  .mapa-corner-tools .mapa-editor-copy strong { font-size: 12px; }
  .mapa-corner-tools .mapa-editor-actions { gap: 6px; justify-content: flex-end; }
  .mapa-corner-tools .mapa-editor .mapa-button { height: 30px; padding: 0 10px; font-size: 12px; }
  .mapa-corner-tools .mapa-editor-form { gap: 6px; }
  .mapa-corner-tools .mapa-vertex-count { display: none; }
  @media (max-width: 700px) {
    .mapa-fullpage .mapa-map-shell { height: calc(100vh - 8px); border-radius: 0; }
    .mapa-drawer-toggle.open { left: auto; right: 13px; }
    .mapa-drawer { width: 100%; max-width: 100%; }
    .mapa-drawer-toggle.open { display: none; }
  }
`;
