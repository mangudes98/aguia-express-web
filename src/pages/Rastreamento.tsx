// ARQUIVO: src/pages/Rastreamento.tsx

import React, { useState } from "react";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  query,
  where,
} from "firebase/firestore";
import { db } from "../services/firebase/firebase";

import {
  AlertCircle,
  Camera,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Copy,
  ExternalLink,
  FileCheck2,
  History,
  MapPin,
  Package,
  Search,
  ShieldCheck,
  Truck,
  User,
  X,
} from "lucide-react";

type Entrega = Record<string, any>;

type Endereco = {
  rua: string;
  numero: string;
  bairro: string;
  cidade: string;
  estado: string;
  cep: string;
};

const GOLD = "#c9a227";

function valor(
  data: Entrega,
  campos: string[],
  padrao = "—"
) {
  for (const campo of campos) {
    const v = data?.[campo];

    if (
      v !== undefined &&
      v !== null &&
      String(v).trim() !== ""
    ) {
      return v;
    }
  }

  return padrao;
}

function formatarData(data: any) {
  if (!data) return "—";

  try {
    if (typeof data?.toDate === "function") {
      return data.toDate().toLocaleString("pt-BR");
    }

    if (data instanceof Date) {
      return data.toLocaleString("pt-BR");
    }

    if (typeof data === "number") {
      return new Date(data).toLocaleString("pt-BR");
    }

    const convertido = new Date(data);

    if (!isNaN(convertido.getTime())) {
      return convertido.toLocaleString("pt-BR");
    }

    return String(data);
  } catch {
    return String(data);
  }
}

function normalizarCodigo(codigo: string) {
  return codigo.trim().toUpperCase();
}

function statusInfo(status: string) {
  const s = status.toUpperCase();

  if (s === "ENTREGUE") {
    return {
      titulo: "Entrega realizada",
      descricao:
        "Esta encomenda foi entregue com sucesso.",
      cor: "#15803d",
      fundo: "#ecfdf3",
      borda: "#bbf7d0",
      icone: <CheckCircle2 size={25} />,
    };
  }

  if (s === "AUSENTE") {
    return {
      titulo: "Entrega não realizada",
      descricao:
        "Foi registrada uma ocorrência nesta entrega.",
      cor: "#c2410c",
      fundo: "#fff7ed",
      borda: "#fed7aa",
      icone: <AlertCircle size={25} />,
    };
  }

  if (s === "ROTA") {
    return {
      titulo: "Em rota de entrega",
      descricao:
        "A encomenda está em processo de entrega.",
      cor: "#2563eb",
      fundo: "#eff6ff",
      borda: "#bfdbfe",
      icone: <Truck size={25} />,
    };
  }

  return {
    titulo:
      status || "Rastreamento localizado",
    descricao:
      "Encontramos informações desta encomenda.",
    cor: "#64748b",
    fundo: "#f8fafc",
    borda: "#e2e8f0",
    icone: <Package size={25} />,
  };
}

/**
 * ============================================================
 * BUSCA AUTOMÁTICA DE ENDEREÇO PELAS COORDENADAS
 * ============================================================
 *
 * Firebase:
 *
 * latitudeEntrega
 * longitudeEntrega
 *
 * ↓
 *
 * Nominatim / OpenStreetMap
 *
 * ↓
 *
 * rua
 * numero
 * bairro
 * cidade
 * estado
 * CEP
 *
 * Os dados que já existem no Firebase SEMPRE têm prioridade.
 */

async function buscarEnderecoPorCoordenadas(
  latitude: number,
  longitude: number
): Promise<Endereco | null> {
  try {
    const url =
      "https://nominatim.openstreetmap.org/reverse" +
      `?lat=${encodeURIComponent(latitude)}` +
      `&lon=${encodeURIComponent(longitude)}` +
      "&format=json" +
      "&addressdetails=1" +
      "&accept-language=pt-BR";

    const resposta = await fetch(url, {
      headers: {
        Accept: "application/json",
      },
    });

    if (!resposta.ok) {
      return null;
    }

    const dados = await resposta.json();

    const address = dados?.address;

    if (!address) {
      return null;
    }

    return {
      rua:
        address.road ||
        address.pedestrian ||
        address.residential ||
        address.street ||
        "",

      numero:
        address.house_number ||
        "",

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

      estado:
        address.state ||
        "",

      cep:
        address.postcode ||
        "",
    };
  } catch (error) {
    console.error(
      "Erro ao buscar endereço pelas coordenadas:",
      error
    );

    return null;
  }
}

/**
 * Pega o endereço existente e só completa
 * aquilo que estiver vazio.
 */
async function completarEndereco(
  dados: Entrega
): Promise<Endereco> {
  const endereco: Endereco = {
    rua: String(
      valor(
        dados,
        ["rua"],
        ""
      )
    ),

    numero: String(
      valor(
        dados,
        ["numero"],
        ""
      )
    ),

    bairro: String(
      valor(
        dados,
        ["bairro"],
        ""
      )
    ),

    cidade: String(
      valor(
        dados,
        ["cidade"],
        ""
      )
    ),

    estado: String(
      valor(
        dados,
        ["estado"],
        ""
      )
    ),

    cep: String(
      valor(
        dados,
        ["cep"],
        ""
      )
    ),
  };

  /*
   * Verifica se existe algum campo faltando.
   */
  const precisaCompletar =
    !endereco.rua ||
    !endereco.numero ||
    !endereco.bairro ||
    !endereco.cidade ||
    !endereco.estado ||
    !endereco.cep;

  if (!precisaCompletar) {
    return endereco;
  }

  /*
   * Pega as coordenadas salvas na entrega.
   */
  const latitudeRaw =
    dados?.latitudeEntrega ??
    dados?.latitude ??
    dados?.lat;

  const longitudeRaw =
    dados?.longitudeEntrega ??
    dados?.longitude ??
    dados?.lng;

  if (
    latitudeRaw === undefined ||
    latitudeRaw === null ||
    longitudeRaw === undefined ||
    longitudeRaw === null
  ) {
    return endereco;
  }

  const latitude =
    Number(latitudeRaw);

  const longitude =
    Number(longitudeRaw);

  if (
    !Number.isFinite(latitude) ||
    !Number.isFinite(longitude)
  ) {
    return endereco;
  }

  /*
   * Busca endereço através das coordenadas.
   */
  const encontrado =
    await buscarEnderecoPorCoordenadas(
      latitude,
      longitude
    );

  if (!encontrado) {
    return endereco;
  }

  /*
   * SOMENTE completa campos vazios.
   */
  return {
    rua:
      endereco.rua ||
      encontrado.rua,

    numero:
      endereco.numero ||
      encontrado.numero,

    bairro:
      endereco.bairro ||
      encontrado.bairro,

    cidade:
      endereco.cidade ||
      encontrado.cidade,

    estado:
      endereco.estado ||
      encontrado.estado,

    cep:
      endereco.cep ||
      encontrado.cep,
  };
}

export default function Rastreamento() {
  const [codigo, setCodigo] =
    useState("");

  const [entrega, setEntrega] =
    useState<Entrega | null>(null);

  const [nomeEntregador, setNomeEntregador] =
    useState("Não informado");

  const [enderecoAutomatico, setEnderecoAutomatico] =
    useState<Endereco>({
      rua: "",
      numero: "",
      bairro: "",
      cidade: "",
      estado: "",
      cep: "",
    });

  const [buscandoEndereco, setBuscandoEndereco] =
    useState(false);

  const [carregando, setCarregando] =
    useState(false);

  const [erro, setErro] =
    useState("");

  const [pesquisou, setPesquisou] =
    useState(false);

  const [fotoSelecionada, setFotoSelecionada] =
    useState<string | null>(null);

  /**
   * Busca nome do entregador:
   *
   * controle_codigos.usuario
   *
   * ↓
   *
   * usuarios/{email}
   *
   * ↓
   *
   * nome
   */
  const buscarNomeEntregador =
    async (
      dadosEntrega: Entrega
    ) => {
      const email = String(
        dadosEntrega?.usuario || ""
      ).trim();

      if (!email) {
        setNomeEntregador(
          "Não informado"
        );

        return;
      }

      try {
        const usuarioRef =
          doc(
            db,
            "usuarios",
            email
          );

        const usuarioSnapshot =
          await getDoc(
            usuarioRef
          );

        if (
          usuarioSnapshot.exists()
        ) {
          const dadosUsuario =
            usuarioSnapshot.data();

          const nome =
            dadosUsuario?.nome ||
            dadosUsuario?.nomeCompleto ||
            dadosUsuario?.displayName;

          if (
            nome !== undefined &&
            nome !== null &&
            String(nome).trim() !== ""
          ) {
            setNomeEntregador(
              String(nome)
            );

            return;
          }
        }

        setNomeEntregador(
          "Não informado"
        );
      } catch (error) {
        console.error(
          "Erro ao buscar nome do entregador:",
          error
        );

        setNomeEntregador(
          "Não informado"
        );
      }
    };

  /**
   * Completa endereço usando lat/lng.
   */
  const carregarEndereco =
    async (
      dados: Entrega
    ) => {
      setBuscandoEndereco(true);

      try {
        const endereco =
          await completarEndereco(
            dados
          );

        setEnderecoAutomatico(
          endereco
        );
      } catch (error) {
        console.error(
          "Erro ao completar endereço:",
          error
        );
      } finally {
        setBuscandoEndereco(false);
      }
    };

  const processarEntrega =
    async (
      dados: Entrega
    ) => {
      setEntrega(dados);

      /*
       * Busca o nome do entregador.
       */
      await buscarNomeEntregador(
        dados
      );

      /*
       * Completa endereço através
       * das coordenadas caso necessário.
       */
      await carregarEndereco(
        dados
      );
    };

  const pesquisar = async () => {
    const codigoBusca =
      normalizarCodigo(codigo);

    if (!codigoBusca) {
      setErro(
        "Digite o código da encomenda."
      );

      setEntrega(null);

      setPesquisou(true);

      return;
    }

    setCarregando(true);
    setErro("");
    setEntrega(null);

    setNomeEntregador(
      "Não informado"
    );

    setEnderecoAutomatico({
      rua: "",
      numero: "",
      bairro: "",
      cidade: "",
      estado: "",
      cep: "",
    });

    setPesquisou(true);

    try {
      /*
       * Primeiro tenta pelo ID do documento.
       */
      const referencia =
        doc(
          db,
          "controle_codigos",
          codigoBusca
        );

      const snapshot =
        await getDoc(
          referencia
        );

      if (
        snapshot.exists()
      ) {
        const dados = {
          id: snapshot.id,
          ...snapshot.data(),
        };

        await processarEntrega(
          dados
        );

        return;
      }

      /*
       * Fallback para código dentro
       * do documento.
       */
      const camposCodigo = [
        "codigo",
        "codigoRastreio",
        "codigo_rastreio",
        "trackingCode",
      ];

      for (
        const campo
        of camposCodigo
      ) {
        try {
          const consulta =
            query(
              collection(
                db,
                "controle_codigos"
              ),
              where(
                campo,
                "==",
                codigoBusca
              ),
              limit(1)
            );

          const resultado =
            await getDocs(
              consulta
            );

          if (
            !resultado.empty
          ) {
            const encontrado =
              resultado.docs[0];

            const dados = {
              id: encontrado.id,
              ...encontrado.data(),
            };

            await processarEntrega(
              dados
            );

            return;
          }
        } catch {
          // Continua procurando.
        }
      }

      setErro(
        "Não encontramos nenhuma encomenda com esse código."
      );
    } catch (error) {
      console.error(
        "Erro ao consultar rastreamento:",
        error
      );

      setErro(
        "Não foi possível consultar o rastreamento. Tente novamente."
      );
    } finally {
      setCarregando(false);
    }
  };

  const limpar = () => {
    setCodigo("");
    setEntrega(null);

    setNomeEntregador(
      "Não informado"
    );

    setEnderecoAutomatico({
      rua: "",
      numero: "",
      bairro: "",
      cidade: "",
      estado: "",
      cep: "",
    });

    setErro("");
    setPesquisou(false);
  };

  const copiarCodigo =
    async () => {
      const codigoCopiar =
        String(
          valor(
            entrega || {},
            ["codigo"],
            codigo
          )
        );

      await navigator.clipboard?.writeText(
        codigoCopiar
      );
    };

  const fotos = entrega
    ? (() => {
        const lista: string[] =
          [];

        if (
          Array.isArray(
            entrega.fotos
          )
        ) {
          entrega.fotos.forEach(
            (foto: any) => {
              if (
                foto &&
                String(foto).trim() &&
                !lista.includes(
                  String(foto)
                )
              ) {
                lista.push(
                  String(foto)
                );
              }
            }
          );
        }

        const fotoUrl =
          entrega.fotoUrl;

        if (
          fotoUrl &&
          String(fotoUrl).trim() &&
          !lista.includes(
            String(fotoUrl)
          )
        ) {
          lista.push(
            String(fotoUrl)
          );
        }

        return lista;
      })()
    : [];

  const status =
    statusInfo(
      String(
        valor(
          entrega || {},
          [
            "status",
            "situacao",
          ],
          "—"
        )
      )
    );

  const codigoExibicao =
    String(
      valor(
        entrega || {},
        [
          "codigo",
          "codigoRastreio",
          "codigo_rastreio",
          "trackingCode",
        ],
        codigo
      )
    );

  const nomeRecebedor =
    String(
      valor(
        entrega || {},
        [
          "nomeRecebedor",
          "nome_recebedor",
          "recebedor",
        ]
      )
    );

  const documentoRecebedor =
    String(
      valor(
        entrega || {},
        [
          "documentoRecebedor",
          "documento",
          "cpfRecebedor",
        ]
      )
    );

  const empresa =
    String(
      valor(
        entrega || {},
        [
          "empresa",
          "empresaNome",
          "nomeEmpresa",
        ]
      )
    );

  const dataEntrega =
    valor(
      entrega || {},
      [
        "dataHoraBaixa",
        "dataHoraEntrega",
        "dataEntrega",
        "dataHora",
        "data",
      ]
    );

  const observacao =
    String(
      valor(
        entrega || {},
        [
          "observacao",
          "observação",
          "obs",
        ]
      )
    );

  /*
   * Endereço:
   *
   * 1º Firebase
   * 2º Coordenadas
   */
  const rua =
    String(
      enderecoAutomatico.rua ||
      valor(
        entrega || {},
        ["rua"],
        ""
      )
    );

  const numero =
    String(
      enderecoAutomatico.numero ||
      valor(
        entrega || {},
        ["numero"],
        ""
      )
    );

  const bairro =
    String(
      enderecoAutomatico.bairro ||
      valor(
        entrega || {},
        ["bairro"],
        ""
      )
    );

  const cidade =
    String(
      enderecoAutomatico.cidade ||
      valor(
        entrega || {},
        ["cidade"],
        ""
      )
    );

  const estado =
    String(
      enderecoAutomatico.estado ||
      valor(
        entrega || {},
        ["estado"],
        ""
      )
    );

  const cep =
    String(
      enderecoAutomatico.cep ||
      valor(
        entrega || {},
        ["cep"],
        ""
      )
    );

  const enderecoCompleto =
    String(
      valor(
        entrega || {},
        [
          "enderecoCompleto",
        ],
        ""
      )
    ) ||
    [
      rua,
      numero,
      bairro,
      cidade,
      estado,
      cep,
    ]
      .filter(Boolean)
      .join(", ");

  const latitude =
    valor(
      entrega || {},
      [
        "latitudeEntrega",
        "latitude",
        "lat",
      ],
      ""
    );

  const longitude =
    valor(
      entrega || {},
      [
        "longitudeEntrega",
        "longitude",
        "lng",
      ],
      ""
    );

  const historico =
    Array.isArray(
      entrega?.historico
    )
      ? entrega.historico
      : [];

  return (
    <div className="rastreamento-site">

      <style>{`

        * {
          box-sizing: border-box;
        }

        .rastreamento-site {
          min-height: 100vh;
          background:
            linear-gradient(
              180deg,
              #f8fafc 0%,
              #ffffff 45%,
              #f5f7fa 100%
            );
          color: #17202a;
           padding: 30px 22px 48px;
          font-family:
            Inter,
            -apple-system,
            BlinkMacSystemFont,
            "Segoe UI",
            sans-serif;
        }

        .rastreamento-wrapper {
          max-width: 1120px;
          margin: 0 auto;
        }

        .rastreamento-header {
          text-align: center;
           margin-bottom: 22px;
        }

        .logo-rastreamento {
          display: inline-flex;
          align-items: center;
          gap: 9px;
          margin-bottom: 13px;
          color: #1f2937;
          font-weight: 900;
          font-size: 17px;
        }

        .logo-rastreamento-icon {
          width: 38px;
          height: 38px;
          border-radius: 11px;
          display: flex;
          align-items: center;
          justify-content: center;
          background: ${GOLD};
          color: #111827;
        }

        .rastreamento-header h1 {
          margin: 0;
          color: #111827;
          font-size: 34px;
          font-weight: 850;
          letter-spacing: -.8px;
        }

        .rastreamento-header p {
          margin: 9px 0 0;
          color: #64748b;
          font-size: 15px;
        }

        .busca-container {
          background: #ffffff;
          border: 1px solid #e5e7eb;
          border-radius: 18px;
           padding: 16px;
          box-shadow:
            0 10px 35px rgba(15, 23, 42, .06);
           margin-bottom: 18px;
        }

        .busca-titulo {
          color: #374151;
          font-size: 13px;
          font-weight: 800;
          margin-bottom: 9px;
        }

        .busca-linha {
          display: flex;
          gap: 10px;
        }

        .input-rastreio {
          position: relative;
          flex: 1;
        }

        .input-rastreio svg {
          position: absolute;
          left: 16px;
          top: 50%;
          transform: translateY(-50%);
          color: #94a3b8;
        }

        .input-rastreio input {
          width: 100%;
          height: 54px;
          border: 1px solid #dbe1e8;
          background: #f8fafc;
          border-radius: 12px;
          padding: 0 16px 0 47px;
          color: #111827;
          outline: none;
          font-size: 14px;
          transition: .2s;
        }

        .input-rastreio input:focus {
          border-color: ${GOLD};
          background: #fff;
          box-shadow:
            0 0 0 3px rgba(201,162,39,.12);
        }

        .btn-rastrear {
          height: 54px;
          padding: 0 25px;
          border: none;
          border-radius: 12px;
          background: ${GOLD};
          color: #171717;
          font-weight: 850;
          cursor: pointer;
          display: flex;
          align-items: center;
          gap: 9px;
          transition: .2s;
          white-space: nowrap;
        }

        .btn-rastrear:hover {
          transform: translateY(-1px);
          box-shadow:
            0 7px 18px rgba(201,162,39,.22);
        }

        .btn-rastrear:disabled {
          opacity: .6;
          cursor: wait;
          transform: none;
        }

        .btn-limpar {
          width: 54px;
          height: 54px;
          border: 1px solid #dbe1e8;
          border-radius: 12px;
          background: #fff;
          color: #64748b;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .erro {
          margin-top: 13px;
          display: flex;
          align-items: center;
          gap: 9px;
          padding: 13px 15px;
          background: #fff1f2;
          color: #be123c;
          border: 1px solid #fecdd3;
          border-radius: 11px;
          font-size: 13px;
        }

        .resultado {
          animation: aparecer .28s ease;
        }

        @keyframes aparecer {
          from {
            opacity: 0;
            transform: translateY(8px);
          }

          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        .status-card {
          border-radius: 18px;
           padding: 15px 18px;
          display: flex;
          justify-content: space-between;
          align-items: center;
           gap: 14px;
           margin-bottom: 12px;
        }

        .status-conteudo {
          display: flex;
          align-items: center;
          gap: 14px;
        }

        .status-icone {
          width: 52px;
          height: 52px;
          border-radius: 14px;
          display: flex;
          align-items: center;
          justify-content: center;
          background: #ffffff;
          border: 1px solid;
          flex-shrink: 0;
        }

        .status-card h2 {
          margin: 0;
          font-size: 19px;
          color: #17202a;
        }

        .status-card p {
          margin: 4px 0 0;
          color: #64748b;
          font-size: 13px;
        }

        .status-badge {
          padding: 8px 13px;
          border-radius: 30px;
          background: #ffffff;
          border: 1px solid;
          font-size: 11px;
          font-weight: 900;
          letter-spacing: .5px;
        }

        .comprovante {
          background: #ffffff;
          border: 1px solid #e5e7eb;
          border-radius: 20px;
          overflow: hidden;
          box-shadow:
            0 14px 45px rgba(15,23,42,.07);
        }

        .comprovante-cabecalho {
           padding: 15px 18px;
          border-bottom: 1px solid #edf0f3;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 20px;
        }

        .marca {
          display: flex;
          align-items: center;
          gap: 11px;
        }

        .marca-icon {
          width: 43px;
          height: 43px;
          border-radius: 12px;
          display: flex;
          align-items: center;
          justify-content: center;
          background: ${GOLD};
          color: #111827;
        }

        .marca strong {
          display: block;
          color: #111827;
          font-size: 16px;
          font-weight: 900;
        }

        .marca span {
          display: block;
          color: #94a3b8;
          font-size: 11px;
          margin-top: 2px;
        }

        .comprovante-titulo {
          text-align: right;
        }

        .comprovante-titulo strong {
          display: block;
          color: #1f2937;
          font-size: 14px;
        }

        .comprovante-titulo span {
          color: #94a3b8;
          font-size: 11px;
        }

        .codigo-area {
           padding: 15px 18px;
          background: #fafbfc;
          border-bottom: 1px solid #edf0f3;
        }

        .codigo-label {
          color: #94a3b8;
          font-size: 10px;
          font-weight: 900;
          letter-spacing: 1px;
          text-transform: uppercase;
          margin-bottom: 6px;
        }

        .codigo-linha {
          display: flex;
          align-items: center;
          gap: 10px;
        }

        .codigo {
          color: #111827;
          font-size: 22px;
          font-weight: 900;
          font-family: monospace;
          word-break: break-all;
        }

        .btn-copiar {
          flex-shrink: 0;
          height: 32px;
          padding: 0 10px;
          display: flex;
          align-items: center;
          gap: 5px;
          border: 1px solid #e2e8f0;
          border-radius: 8px;
          background: #fff;
          color: #64748b;
          cursor: pointer;
          font-size: 11px;
          font-weight: 700;
        }

        .btn-copiar:hover {
          border-color: ${GOLD};
          color: #7c6415;
        }

        .duas-colunas {
          display: grid;
          grid-template-columns:
            repeat(2, minmax(0, 1fr));
          border-bottom: 1px solid #edf0f3;
        }

        .duas-colunas > .secao {
          border-bottom: none;
        }

        .duas-colunas > .secao:first-child {
          border-right: 1px solid #edf0f3;
        }

        .secao {
           padding: 15px 18px;
          border-bottom: 1px solid #edf0f3;
        }

        .duas-colunas .secao {
          border-bottom: none;
        }

        .titulo-secao {
          display: flex;
          align-items: center;
          gap: 8px;
          color: #1f2937;
          font-size: 14px;
          font-weight: 900;
           margin-bottom: 10px;
        }

        .titulo-secao svg {
          color: ${GOLD};
        }

        .info-grid {
          display: grid;
          grid-template-columns:
            repeat(2, minmax(0, 1fr));
           gap: 7px;
        }

        .info-item {
          min-width: 0;
           padding: 10px 11px;
          background: #f8fafc;
          border: 1px solid #edf0f3;
          border-radius: 11px;
        }

        .info-item.full {
          grid-column: 1 / -1;
        }

        .info-label {
          color: #94a3b8;
          font-size: 10px;
          font-weight: 850;
          letter-spacing: .5px;
          text-transform: uppercase;
          margin-bottom: 6px;
        }

        .info-valor {
          color: #1f2937;
          font-size: 13px;
          font-weight: 700;
          line-height: 1.45;
          word-break: break-word;
        }

        .localizacao {
           margin-top: 8px;
          display: flex;
          align-items: center;
          justify-content: space-between;
           gap: 10px;
           padding: 10px 11px;
          border: 1px solid #e5e7eb;
          border-radius: 11px;
          background: #fff;
        }

        .localizacao-info {
          display: flex;
          align-items: center;
          gap: 9px;
        }

        .localizacao-info svg {
          color: ${GOLD};
        }

        .localizacao-info span {
          color: #64748b;
          font-size: 12px;
        }

        .mapa-link {
          color: #2563eb;
          font-size: 12px;
          font-weight: 800;
          text-decoration: none;
          display: flex;
          align-items: center;
          gap: 5px;
          white-space: nowrap;
        }

        .fotos-grid {
          display: grid;
          grid-template-columns:
            repeat(2, 1fr);
           gap: 7px;
        }

        .foto {
          height: 170px;
          width: 100%;
          object-fit: cover;
          border-radius: 11px;
          border: 1px solid #e2e8f0;
          cursor: pointer;
          transition: .2s;
          background: #f1f5f9;
        }

        .foto:hover {
          transform: scale(1.015);
          box-shadow:
            0 8px 20px rgba(15,23,42,.12);
        }

        .sem-foto {
          min-height: 120px;
          border: 1px dashed #d7dde5;
          border-radius: 11px;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          color: #94a3b8;
          background: #fafbfc;
          font-size: 12px;
          text-align: center;
          padding: 15px;
        }

        .observacao {
          background: #fffbeb;
          border: 1px solid #fef3c7;
          border-radius: 11px;
          padding: 14px 15px;
          color: #713f12;
          font-size: 13px;
          line-height: 1.6;
        }

        .historico {
          display: flex;
          flex-direction: column;
        }

        .historico-item {
          position: relative;
          display: flex;
          gap: 13px;
           padding-bottom: 10px;
        }

        .historico-item:last-child {
          padding-bottom: 0;
        }

        .historico-linha {
          position: absolute;
          left: 7px;
          top: 17px;
          bottom: 0;
          width: 1px;
          background: #e2e8f0;
        }

        .historico-item:last-child
        .historico-linha {
          display: none;
        }

        .historico-ponto {
          width: 15px;
          height: 15px;
          margin-top: 2px;
          border-radius: 50%;
          background: ${GOLD};
          border: 3px solid #fff;
          box-shadow:
            0 0 0 1px #d8dee7;
          flex-shrink: 0;
          z-index: 1;
        }

        .historico-status {
          color: #1f2937;
          font-size: 13px;
          font-weight: 800;
        }

        .historico-data {
          color: #94a3b8;
          font-size: 11px;
          margin-top: 3px;
        }

        .endereco-carregando {
          display: flex;
          align-items: center;
          gap: 8px;
           margin-top: 8px;
           padding: 8px 11px;
          border-radius: 10px;
          background: #f8fafc;
          border: 1px solid #e5e7eb;
          color: #64748b;
          font-size: 11px;
        }

        .endereco-carregando::before {
          content: "";
          width: 13px;
          height: 13px;
          border: 2px solid #dbe1e8;
          border-top-color: ${GOLD};
          border-radius: 50%;
          animation: girar .7s linear infinite;
        }

        @keyframes girar {
          to {
            transform: rotate(360deg);
          }
        }

        .comprovante-footer {
           padding: 12px 18px;
          display: flex;
          align-items: center;
          gap: 8px;
          color: #94a3b8;
          font-size: 11px;
          background: #fafbfc;
        }

        .comprovante-footer svg {
          color: #16a34a;
        }

        .vazio {
          text-align: center;
          padding: 70px 20px;
          color: #64748b;
        }

        .vazio-icone {
          width: 70px;
          height: 70px;
          border-radius: 20px;
          background: #ffffff;
          border: 1px solid #e5e7eb;
          display: flex;
          align-items: center;
          justify-content: center;
          margin: 0 auto 16px;
          color: #94a3b8;
          box-shadow:
            0 8px 25px rgba(15,23,42,.05);
        }

        .vazio h2 {
          color: #334155;
          font-size: 18px;
          margin: 0 0 7px;
        }

        .vazio p {
          margin: 0;
          font-size: 13px;
        }

        .modal-foto {
          position: fixed;
          inset: 0;
          z-index: 9999;
          background: rgba(15,23,42,.82);
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 30px;
        }

        .modal-foto img {
          max-width: min(1100px, 92vw);
          max-height: 86vh;
          object-fit: contain;
          border-radius: 10px;
          box-shadow:
            0 25px 80px rgba(0,0,0,.35);
        }

        .modal-fechar,
        .modal-seta {
          position: fixed;
          width: 48px;
          height: 48px;
          border: none;
          border-radius: 50%;
          background: rgba(255,255,255,.12);
          color: #fff;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .modal-fechar {
          top: 22px;
          right: 22px;
        }

        .modal-seta {
          top: 50%;
          transform: translateY(-50%);
        }

        .modal-esquerda {
          left: 20px;
        }

        .modal-direita {
          right: 20px;
        }

        @media (max-width: 820px) {

          .duas-colunas {
            grid-template-columns: 1fr;
          }

          .duas-colunas > .secao:first-child {
            border-right: none;
            border-bottom: 1px solid #edf0f3;
          }

        }

        @media (max-width: 720px) {

          .rastreamento-site {
            padding: 25px 14px 50px;
          }

          .rastreamento-header h1 {
            font-size: 27px;
          }

          .busca-linha {
            flex-wrap: wrap;
          }

          .input-rastreio {
            flex-basis: 100%;
          }

          .btn-rastrear {
            flex: 1;
            justify-content: center;
          }

          .status-card {
            align-items: flex-start;
            flex-direction: column;
          }

          .status-badge {
            margin-left: 66px;
          }

          .comprovante-cabecalho {
            align-items: flex-start;
            flex-direction: column;
          }

          .comprovante-titulo {
            text-align: left;
          }

          .secao,
          .codigo-area,
          .comprovante-cabecalho {
            padding-left: 18px;
            padding-right: 18px;
          }

          .info-grid {
            grid-template-columns: 1fr;
          }

          .info-item.full {
            grid-column: auto;
          }

          .fotos-grid {
            grid-template-columns: repeat(2, 1fr);
          }

          .foto {
            height: 145px;
          }

          .codigo {
            font-size: 17px;
          }

          .localizacao {
            align-items: flex-start;
            flex-direction: column;
          }

          .mapa-link {
            margin-left: 26px;
          }

        }

      `}</style>

      <div className="rastreamento-wrapper">

        {/* CABEÇALHO */}

        <header className="rastreamento-header">

          <div className="logo-rastreamento">

            <div className="logo-rastreamento-icon">
              <Package size={21} />
            </div>

            Águia Express

          </div>

          <h1>
            Rastreamento de entrega
          </h1>

          <p>
            Consulte sua encomenda e veja o comprovante completo da entrega.
          </p>

        </header>

        {/* BUSCA */}

        <section className="busca-container">

          <div className="busca-titulo">
            Código de rastreio
          </div>

          <div className="busca-linha">

            <div className="input-rastreio">

              <Search size={19} />

              <input
                value={codigo}
                onChange={(e) =>
                  setCodigo(e.target.value)
                }
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    pesquisar();
                  }
                }}
                placeholder="Digite o código da encomenda"
                autoComplete="off"
              />

            </div>

            <button
              className="btn-rastrear"
              onClick={pesquisar}
              disabled={carregando}
            >

              <Search size={18} />

              {carregando
                ? "Consultando..."
                : "Rastrear"}

            </button>

            {pesquisou && (

              <button
                className="btn-limpar"
                onClick={limpar}
              >
                <X size={19} />
              </button>

            )}

          </div>

          {erro && (

            <div className="erro">

              <AlertCircle size={18} />

              {erro}

            </div>

          )}

        </section>

        {/* ESTADO INICIAL */}

        {!pesquisou && (

          <div className="vazio">

            <div className="vazio-icone">
              <Package size={30} />
            </div>

            <h2>
              Consulte sua encomenda
            </h2>

            <p>
              Digite o código de rastreio acima para consultar.
            </p>

          </div>

        )}

        {/* RESULTADO */}

        {entrega && (

          <main className="resultado">

            {/* STATUS */}

            <section
              className="status-card"
              style={{
                background:
                  status.fundo,
                border:
                  `1px solid ${status.borda}`,
              }}
            >

              <div className="status-conteudo">

                <div
                  className="status-icone"
                  style={{
                    color:
                      status.cor,
                    borderColor:
                      status.borda,
                  }}
                >
                  {status.icone}
                </div>

                <div>

                  <h2>
                    {status.titulo}
                  </h2>

                  <p>
                    {status.descricao}
                  </p>

                </div>

              </div>

              <div
                className="status-badge"
                style={{
                  color:
                    status.cor,
                  borderColor:
                    status.borda,
                }}
              >
                {String(
                  valor(
                    entrega,
                    [
                      "status",
                      "situacao",
                    ],
                    "—"
                  )
                )}
              </div>

            </section>

            {/* COMPROVANTE */}

            <section className="comprovante">

              {/* CABEÇALHO */}

              <div className="comprovante-cabecalho">

                <div className="marca">

                  <div className="marca-icon">
                    <FileCheck2 size={23} />
                  </div>

                  <div>

                    <strong>
                      Comprovante de entrega
                    </strong>

                    <span>
                      Águia Express • Documento eletrônico
                    </span>

                  </div>

                </div>

                <div className="comprovante-titulo">

                  <strong>
                    {String(
                      valor(
                        entrega,
                        [
                          "status",
                          "situacao",
                        ],
                        "RASTREAMENTO"
                      )
                    )}
                  </strong>

                  <span>
                    Registro oficial da encomenda
                  </span>

                </div>

              </div>

              {/* CÓDIGO */}

              <div className="codigo-area">

                <div className="codigo-label">
                  Código da encomenda
                </div>

                <div className="codigo-linha">

                  <div className="codigo">
                    {codigoExibicao}
                  </div>

                  <button
                    className="btn-copiar"
                    onClick={
                      copiarCodigo
                    }
                  >

                    <Copy size={13} />

                    Copiar

                  </button>

                </div>

              </div>

              {/* ==================================================
                  IDENTIFICAÇÃO | HISTÓRICO
                 ================================================== */}

              <div className="duas-colunas">

                {/* IDENTIFICAÇÃO */}

                <section className="secao">

                  <div className="titulo-secao">

                    <Package size={17} />

                    Identificação

                  </div>

                  <div className="info-grid">

                    <div className="info-item">

                      <div className="info-label">
                        Empresa
                      </div>

                      <div className="info-valor">
                        {empresa}
                      </div>

                    </div>

                    <div className="info-item">

                      <div className="info-label">
                        Data da entrega
                      </div>

                      <div className="info-valor">
                        {formatarData(
                          dataEntrega
                        )}
                      </div>

                    </div>

                    <div className="info-item">

                      <div className="info-label">
                        Entregador
                      </div>

                      <div className="info-valor">
                        {nomeEntregador}
                      </div>

                    </div>

                    <div className="info-item">

                      <div className="info-label">
                        Ordem da parada
                      </div>

                      <div className="info-valor">
                        {String(
                          valor(
                            entrega,
                            ["ordem"],
                            "—"
                          )
                        )}
                      </div>

                    </div>

                  </div>

                </section>

                {/* HISTÓRICO */}

                <section className="secao">

                  <div className="titulo-secao">

                    <History size={17} />

                    Histórico da encomenda

                  </div>

                  {historico.length >
                  0 ? (

                    <div className="historico">

                      {historico.map(
                        (
                          item: any,
                          index: number
                        ) => (

                          <div
                            className="historico-item"
                            key={index}
                          >

                            <div className="historico-linha" />

                            <div className="historico-ponto" />

                            <div>

                              <div className="historico-status">
                                {item?.status ||
                                  "Atualização"}
                              </div>

                              <div className="historico-data">
                                {formatarData(
                                  item?.dataHora
                                )}
                              </div>

                            </div>

                          </div>

                        )
                      )}

                    </div>

                  ) : (

                    <div className="sem-foto">

                      <History size={18} />

                      Nenhum histórico registrado.

                    </div>

                  )}

                </section>

              </div>

              {/* ==================================================
                  RECEBEDOR | COMPROVANTE FOTOGRÁFICO
                 ================================================== */}

              <div className="duas-colunas">

                {/* RECEBEDOR */}

                <section className="secao">

                  <div className="titulo-secao">

                    <User size={17} />

                    Recebedor

                  </div>

                  <div className="info-grid">

                    <div className="info-item">

                      <div className="info-label">
                        Nome
                      </div>

                      <div className="info-valor">
                        {nomeRecebedor}
                      </div>

                    </div>

                    <div className="info-item">

                      <div className="info-label">
                        Documento
                      </div>

                      <div className="info-valor">
                        {documentoRecebedor}
                      </div>

                    </div>

                  </div>

                  {observacao !==
                    "—" && (

                    <div
                      style={{
                        marginTop: 13,
                      }}
                    >

                      <div className="info-label">
                        Observação
                      </div>

                      <div className="observacao">
                        {observacao}
                      </div>

                    </div>

                  )}

                </section>

                {/* FOTOS */}

                <section className="secao">

                  <div className="titulo-secao">

                    <Camera size={17} />

                    Comprovante fotográfico

                  </div>

                  {fotos.length ===
                  0 ? (

                    <div className="sem-foto">

                      <Camera size={18} />

                      Nenhuma foto registrada para esta entrega.

                    </div>

                  ) : (

                    <div className="fotos-grid">

                      {fotos.map(
                        (
                          foto,
                          index
                        ) => (

                          <img
                            key={`${foto}-${index}`}
                            className="foto"
                            src={foto}
                            alt={
                              `Comprovante ${index + 1}`
                            }
                            onClick={() =>
                              setFotoSelecionada(
                                foto
                              )
                            }
                          />

                        )
                      )}

                    </div>

                  )}

                </section>

              </div>

              {/* ==================================================
                  ENDEREÇO
                 ================================================== */}

              <section className="secao">

                <div className="titulo-secao">

                  <MapPin size={17} />

                  Endereço da entrega

                </div>

                {buscandoEndereco && (

                  <div className="endereco-carregando">

                    Buscando automaticamente os dados do endereço pelas coordenadas da entrega...

                  </div>

                )}

                <div className="info-grid">

                  <div className="info-item full">

                    <div className="info-label">
                      Endereço completo
                    </div>

                    <div className="info-valor">

                      {enderecoCompleto ||
                        "Endereço não informado"}

                    </div>

                  </div>

                  <div className="info-item">

                    <div className="info-label">
                      Rua
                    </div>

                    <div className="info-valor">

                      {rua ||
                        "Não informado"}

                    </div>

                  </div>

                  <div className="info-item">

                    <div className="info-label">
                      Número
                    </div>

                    <div className="info-valor">

                      {numero ||
                        "Não informado"}

                    </div>

                  </div>

                  <div className="info-item">

                    <div className="info-label">
                      Bairro
                    </div>

                    <div className="info-valor">

                      {bairro ||
                        "Não informado"}

                    </div>

                  </div>

                  <div className="info-item">

                    <div className="info-label">
                      CEP
                    </div>

                    <div className="info-valor">

                      {cep ||
                        "Não informado"}

                    </div>

                  </div>

                  <div className="info-item">

                    <div className="info-label">
                      Cidade
                    </div>

                    <div className="info-valor">

                      {cidade ||
                        "Não informado"}

                    </div>

                  </div>

                  <div className="info-item">

                    <div className="info-label">
                      Estado
                    </div>

                    <div className="info-valor">

                      {estado ||
                        "Não informado"}

                    </div>

                  </div>

                </div>

                {latitude &&
                  longitude && (

                    <div className="localizacao">

                      <div className="localizacao-info">

                        <MapPin size={17} />

                        <span>

                          Localização registrada:
                          {" "}
                          {String(
                            latitude
                          )}
                          ,
                          {" "}
                          {String(
                            longitude
                          )}

                        </span>

                      </div>

                      <a
                        className="mapa-link"
                        href={
                          `https://www.google.com/maps?q=${latitude},${longitude}`
                        }
                        target="_blank"
                        rel="noreferrer"
                      >

                        Ver no mapa

                        <ExternalLink
                          size={13}
                        />

                      </a>

                    </div>

                  )}

              </section>

              {/* RODAPÉ */}

              <div className="comprovante-footer">

                <ShieldCheck size={15} />

                Informações registradas eletronicamente
                pelo sistema Águia Express.

              </div>

            </section>

          </main>

        )}

      </div>

      {/* MODAL DAS FOTOS */}

      {fotoSelecionada && (

        <div
          className="modal-foto"
          onClick={() =>
            setFotoSelecionada(
              null
            )
          }
        >

          <button
            className="modal-fechar"
            onClick={(e) => {

              e.stopPropagation();

              setFotoSelecionada(
                null
              );

            }}
          >

            <X size={22} />

          </button>

          {fotos.indexOf(
            fotoSelecionada
          ) > 0 && (

            <button
              className="modal-seta modal-esquerda"
              onClick={(e) => {

                e.stopPropagation();

                const atual =
                  fotos.indexOf(
                    fotoSelecionada
                  );

                setFotoSelecionada(
                  fotos[atual - 1]
                );

              }}
            >

              <ChevronLeft size={28} />

            </button>

          )}

          <img
            src={
              fotoSelecionada
            }
            alt="Comprovante ampliado"
            onClick={(e) =>
              e.stopPropagation()
            }
          />

          {fotos.indexOf(
            fotoSelecionada
          ) <
            fotos.length - 1 && (

            <button
              className="modal-seta modal-direita"
              onClick={(e) => {

                e.stopPropagation();

                const atual =
                  fotos.indexOf(
                    fotoSelecionada
                  );

                setFotoSelecionada(
                  fotos[atual + 1]
                );

              }}
            >

              <ChevronRight size={28} />

            </button>

          )}

        </div>

      )}

    </div>
  );
}