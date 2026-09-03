// ARQUIVO: src/pages/Mapa.tsx

import { useEffect, useMemo, useState } from "react";
import {
  MapContainer,
  Marker,
  Popup,
  TileLayer,
  useMap,
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
} from "lucide-react";

import PageHeader from "../components/ui/PageHeader";
import { doc, getDoc } from "firebase/firestore";
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

        // MESMA REGRA DO DASHBOARD:
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

  return { checkingAccess, allowed };
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
// TELA MAPA
// ======================================================

export default function Mapa() {
  const { checkingAccess, allowed } = usePermission();

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

  // ====================================================
  // CARREGAR FIREBASE
  // ====================================================

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
        subtitle="Visualização das entregas e localizações."
      />

      {/* FILTROS */}

      <div className="map-toolbar">
        <div className="map-filter-title">
          <Filter size={16} />

          <span>
            Filtros do mapa
          </span>
        </div>

        {/* USUÁRIO - SOMENTE ATIVOS NO PERÍODO */}

        <select
          value={usuario}
          onChange={e =>
            setUsuario(
              e.target.value
            )
          }
        >
          <option value="TODOS">
            Todos os usuários ativos
          </option>

          {usuariosAtivos.map(u => (
            <option
              key={u}
              value={u}
            >
              {nomeUsuario(
                u,
                nomes
              )}
            </option>
          ))}
        </select>

        {/* TIPO */}

        <select
          value={tipo}
          onChange={e =>
            setTipo(
              e.target.value
            )
          }
        >
          <option value="TODOS">
            Todos os tipos
          </option>

          <option value="MERCADO_LIVRE">
            Mercado Livre
          </option>

          <option value="SHOPEE">
            Shopee
          </option>

          <option value="AVULSO">
            Avulso
          </option>
        </select>

        {/* STATUS */}

        <select
          value={status}
          onChange={e =>
            setStatus(
              e.target.value
            )
          }
        >
          <option value="TODOS">
            Todos os status
          </option>

          {(
            [
              "COLETADO",
              "ROTA",
              "ENTREGUE",
              "AUSENTE",
              "DEVOLVIDO",
            ] as StatusPacote[]
          ).map(s => (
            <option
              key={s}
              value={s}
            >
              {nomeStatus(s)}
            </option>
          ))}
        </select>

        {/* PERÍODO */}

        <select
          value={periodo}
          onChange={e =>
            alterarPeriodo(
              e.target.value
            )
          }
        >
          <option value="DIA_ANTERIOR">
            Dia anterior
          </option>

          <option value="HOJE">
            Hoje
          </option>

          <option value="7_DIAS">
            Últimos 7 dias
          </option>

          <option value="30_DIAS">
            Últimos 30 dias
          </option>

          <option value="PERSONALIZADO">
            Personalizado
          </option>

          <option value="TODOS">
            Todo período
          </option>
        </select>

        {/* DATA PERSONALIZADA */}

        {periodo ===
          "PERSONALIZADO" && (
          <>
            <label className="map-date">
              De

              <input
                type="date"
                value={ini}
                onChange={e =>
                  setIni(
                    e.target.value
                  )
                }
              />
            </label>

            <label className="map-date">
              Até

              <input
                type="date"
                value={fim}
                onChange={e =>
                  setFim(
                    e.target.value
                  )
                }
              />
            </label>
          </>
        )}

        {/* ATUALIZAR */}

        <button
          className="secondary map-reload"
          onClick={carregar}
          disabled={loading}
        >
          <RefreshCw
            size={15}
            className={
              loading
                ? "spin"
                : ""
            }
          />

          Atualizar
        </button>
      </div>

      {/* RESUMO */}

      <div className="map-summary">
        <div>
          <MapPinned size={17} />

          <b>
            {pontos.length}
          </b>

          <span>
            pontos exibidos
          </span>
        </div>

        <div>
          <Users size={17} />

          <b>
            {usuariosAtivos.length}
          </b>

          <span>
            usuários ativos no período
          </span>
        </div>

        <div>
          <Package size={17} />

          <b>
            {semCoordenadas}
          </b>

          <span>
            coordenadas inválidas
          </span>
        </div>
      </div>

      {/* MAPA */}

      <div className="map-layout">
        {/* PAINEL DE USUÁRIOS */}

        <aside className="map-users-panel">
          <div className="map-panel-head">
            <b>
              Usuários ativos
            </b>

            <span>
              {usuariosAtivos.length}
            </span>
          </div>

          <button
            className={`map-user-row ${
              usuario === "TODOS"
                ? "active"
                : ""
            }`}
            onClick={() =>
              setUsuario("TODOS")
            }
          >
            <span className="map-user-dot all" />

            <span>
              Todos
            </span>

            <b>
              {pontos.length}
            </b>
          </button>

          {usuariosAtivos.map(u => {
            const total =
              pontos.filter(
                p =>
                  p.usuarioMapa === u
              ).length;

            return (
              <button
                key={u}
                className={`map-user-row ${
                  usuario === u
                    ? "active"
                    : ""
                }`}
                onClick={() =>
                  setUsuario(u)
                }
              >
                <span
                  className="map-user-dot"
                  style={{
                    background:
                      corUsuario(
                        u,
                        usuariosAtivos
                      ),
                  }}
                />

                <span title={u}>
                  {nomeUsuario(
                    u,
                    nomes
                  )}
                </span>

                <b>
                  {total}
                </b>
              </button>
            );
          })}

          <div className="map-legend">
            <b>
              Legenda dos pacotes
            </b>

            <span>
              <i className="legend-ml">
                ML
              </i>

              Mercado Livre
            </span>

            <span>
              <i className="legend-shopee">
                S
              </i>

              Shopee
            </span>

            <span>
              <i className="legend-avulso">
                A
              </i>

              Avulso
            </span>
          </div>
        </aside>

        {/* MAPA */}

        <div className="map-card">
          <MapContainer
            center={[
              -23.511,
              -46.876,
            ]}
            zoom={12}
            style={{
              height: "100%",
              width: "100%",
            }}
          >
            {/* =================================================
                MAPA CLARO SEM COLORAÇÃO
                RUAS E AVENIDAS EM CINZA
                FUNDO BRANCO/CINZA
            ================================================= */}

            <TileLayer
              attribution="&copy; OpenStreetMap contributors &copy; CARTO"
              url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png?key=cb1_2sk6_1_9337bda9074165b27049c045"
              subdomains="abcd"
              maxZoom={20}
            />

            {/* FOCA SEMPRE NAS ENTREGAS */}

            <AjustarMapa
              points={pontos}
            />

            {/* PONTOS */}

            {pontos.map(p => (
              <Marker
                key={p.id}
                position={[
                  p.lat,
                  p.lng,
                ]}
                icon={criarIcone(p)}
              >
                <Popup>
                  <div className="map-popup">
                    <b>
                      {p.codigo}
                    </b>

                    <span>
                      {nomeTipo(
                        String(p.tipo)
                      )}
                    </span>

                    <span>
                      {nomeStatus(
                        p.status
                      )}
                    </span>

                    <hr />

                    <span>
                      <strong>
                        Usuário:
                      </strong>{" "}

                      {nomeUsuario(
                        p.usuarioMapa,
                        nomes,
                        (p as any)
                          .usuarioNome
                      )}
                    </span>

                    <span>
                      <strong>
                        Empresa:
                      </strong>{" "}

                      {p.empresa || "-"}
                    </span>

                    <span>
                      <strong>
                        Baixa:
                      </strong>{" "}

                      {formatarData(
                        (p as any)
                          .dataHoraBaixa ||
                          p.data
                      )}
                    </span>

                    {/* LOCAL DA ENTREGA */}

                    <span>
                      <strong>
                        Local:
                      </strong>{" "}

                      {pegarEndereco(p)}
                    </span>
                  </div>
                </Popup>
              </Marker>
            ))}
          </MapContainer>

          {/* SEM RESULTADOS */}

          {!loading &&
            !pontos.length && (
              <div className="map-empty">
                <LocateFixed size={15} />

                Nenhuma entrega encontrada
                para o período e filtros
                selecionados.
              </div>
            )}

          {/* CARREGANDO */}

          {loading && (
            <div className="map-loading">
              Carregando pontos do Firebase...
            </div>
          )}

          {/* ERRO */}

          {erro && (
            <div className="map-error">
              {erro}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}