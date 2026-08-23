// ARQUIVO: src/pages/Inicio.tsx

import { useState } from "react";
import { Link } from "react-router-dom";

import {
  ArrowRight,
  BarChart3,
  Camera,
  Check,
  CheckCircle2,
  ChevronDown,
  CircleCheck,
  ExternalLink,
  FileCheck2,
  History,
  MapPin,
  Navigation,
  PackageCheck,
  Route,
  Search,
  ShieldCheck,
  Smartphone,
  Truck,
  X,
  Zap,
} from "lucide-react";

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

import logo from "../assets/logo.png";
import Icon from "../assets/icon.png";

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

    const d = new Date(data);

    if (!isNaN(d.getTime())) {
      return d.toLocaleString("pt-BR");
    }

    return String(data);
  } catch {
    return String(data);
  }
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
    };
  }

  return {
    titulo: status || "Rastreamento localizado",
    descricao:
      "Encontramos informações desta encomenda.",
    cor: "#64748b",
    fundo: "#f8fafc",
    borda: "#e2e8f0",
  };
}

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

    if (!resposta.ok) return null;

    const dados = await resposta.json();
    const address = dados?.address;

    if (!address) return null;

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
  } catch {
    return null;
  }
}

async function completarEndereco(
  dados: Entrega
): Promise<Endereco> {
  const endereco: Endereco = {
    rua: String(
      valor(dados, ["rua"], "")
    ),
    numero: String(
      valor(dados, ["numero"], "")
    ),
    bairro: String(
      valor(dados, ["bairro"], "")
    ),
    cidade: String(
      valor(dados, ["cidade"], "")
    ),
    estado: String(
      valor(dados, ["estado"], "")
    ),
    cep: String(
      valor(dados, ["cep"], "")
    ),
  };

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

  const latRaw =
    dados?.latitudeEntrega ??
    dados?.latitude ??
    dados?.lat ??
    dados?.localizacao?.latitude;

  const lngRaw =
    dados?.longitudeEntrega ??
    dados?.longitude ??
    dados?.lng ??
    dados?.localizacao?.longitude;

  const latitude =
    typeof latRaw === "object"
      ? Number(
          latRaw?.latitude ??
          latRaw?._latitude
        )
      : Number(latRaw);

  const longitude =
    typeof lngRaw === "object"
      ? Number(
          lngRaw?.longitude ??
          lngRaw?._longitude
        )
      : Number(lngRaw);

  if (
    !Number.isFinite(latitude) ||
    !Number.isFinite(longitude)
  ) {
    return endereco;
  }

  const encontrado =
    await buscarEnderecoPorCoordenadas(
      latitude,
      longitude
    );

  if (!encontrado) {
    return endereco;
  }

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

export default function Inicio() {
  const [codigo, setCodigo] = useState("");
  const [entrega, setEntrega] =
    useState<Entrega | null>(null);

  const [nomeEntregador, setNomeEntregador] =
    useState("Não informado");

  const [endereco, setEndereco] =
    useState<Endereco>({
      rua: "",
      numero: "",
      bairro: "",
      cidade: "",
      estado: "",
      cep: "",
    });

  const [buscando, setBuscando] =
    useState(false);

  const [erro, setErro] =
    useState("");

  const [fotoSelecionada, setFotoSelecionada] =
    useState<string | null>(null);

  const buscarNomeEntregador = async (
    dados: Entrega
  ) => {
    const email = String(
      dados?.usuario ||
      dados?.usuarioFinalizacao ||
      dados?.emailUsuario ||
      ""
    ).trim();

    if (!email) {
      setNomeEntregador(
        "Não informado"
      );
      return;
    }

    try {
      const referencia = doc(
        db,
        "usuarios",
        email
      );

      const snapshot =
        await getDoc(referencia);

      if (snapshot.exists()) {
        const usuario =
          snapshot.data();

        const nome =
          usuario?.nome ||
          usuario?.nomeCompleto ||
          usuario?.displayName;

        if (
          nome &&
          String(nome).trim()
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
    } catch {
      setNomeEntregador(
        "Não informado"
      );
    }
  };

  const processarEntrega = async (
    dados: Entrega
  ) => {
    setEntrega(dados);

    await buscarNomeEntregador(
      dados
    );

    const enderecoCompleto =
      await completarEndereco(
        dados
      );

    setEndereco(
      enderecoCompleto
    );
  };

  const pesquisarRastreio = async () => {
    const codigoBusca =
      codigo.trim().toUpperCase();

    if (!codigoBusca) {
      setErro(
        "Digite o código da encomenda."
      );
      setEntrega(null);
      return;
    }

    setBuscando(true);
    setErro("");
    setEntrega(null);
    setNomeEntregador(
      "Não informado"
    );

    try {
      const referencia = doc(
        db,
        "controle_codigos",
        codigoBusca
      );

      const snapshot =
        await getDoc(referencia);

      if (snapshot.exists()) {
        await processarEntrega({
          id: snapshot.id,
          ...snapshot.data(),
        });

        return;
      }

      const camposCodigo = [
        "codigo",
        "codigoRastreio",
        "codigo_rastreio",
        "trackingCode",
      ];

      for (
        const campo of camposCodigo
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

            await processarEntrega({
              id: encontrado.id,
              ...encontrado.data(),
            });

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
        "Erro no rastreamento:",
        error
      );

      setErro(
        "Não foi possível consultar o rastreamento."
      );
    } finally {
      setBuscando(false);
    }
  };

  const fotos = entrega
    ? (() => {
        const lista: string[] = [];

        if (
          Array.isArray(
            entrega.fotos
          )
        ) {
          entrega.fotos.forEach(
            (foto: any) => {
              if (
                foto &&
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

        if (
          entrega.fotoUrl &&
          !lista.includes(
            String(
              entrega.fotoUrl
            )
          )
        ) {
          lista.push(
            String(
              entrega.fotoUrl
            )
          );
        }

        return lista;
      })()
    : [];

  const status = statusInfo(
    String(
      valor(
        entrega || {},
        ["status", "situacao"],
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

  const historico =
    Array.isArray(
      entrega?.historico
    )
      ? entrega.historico
      : [];

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

  const enderecoTexto = [
    endereco.rua,
    endereco.numero,
    endereco.bairro,
    endereco.cidade,
    endereco.estado,
    endereco.cep,
  ]
    .filter(Boolean)
    .join(", ");

  const mapaDisponivel =
    Number.isFinite(
      Number(latitude)
    ) &&
    Number.isFinite(
      Number(longitude)
    );

  return (
    <div className="ae-site">

      <style>{`

        * {
          box-sizing: border-box;
        }

        html {
          scroll-behavior: smooth;
        }

        body {
          margin: 0;
          background: #f7f8fa;
        }

        .ae-site {
          min-height: 100vh;
          color: #101828;
          background:
            radial-gradient(
              circle at 80% 0%,
              rgba(201,162,39,.09),
              transparent 28%
            ),
            #f7f8fa;
          font-family:
            Inter,
            -apple-system,
            BlinkMacSystemFont,
            "Segoe UI",
            sans-serif;
          overflow-x: hidden;
        }

        .ae-wrap {
          width: min(
            1180px,
            calc(100% - 42px)
          );
          margin: 0 auto;
        }

        /* NAVBAR */

        .ae-nav {
          position: sticky;
          top: 0;
          z-index: 1000;
          min-height: 76px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 25px;
          padding: 0 30px;
          background: rgba(
            255,
            255,
            255,
            .92
          );
          backdrop-filter: blur(18px);
          border-bottom:
            1px solid rgba(
              15,
              23,
              42,
              .07
            );
        }

        .ae-brand {
          display: flex;
          align-items: center;
          gap: 10px;
          text-decoration: none;
          color: #111827;
        }

        /* icon.png — somente o ícone da Águia */
        .ae-brand img {
          width: 46px;
          height: 46px;
          object-fit: contain;
          border-radius: 7px;
          overflow: hidden;
        }

        .ae-brand span {
          display: flex;
          flex-direction: column;
          line-height: 1;
        }

        .ae-brand b {
          font-size: 17px;
          letter-spacing: 1.5px;
        }

        .ae-brand small {
          margin-top: 4px;
          color: #a38319;
          font-size: 8px;
          font-weight: 900;
          letter-spacing: 3px;
        }

        .ae-nav nav {
          display: flex;
          align-items: center;
          gap: 22px;
        }

        .ae-nav nav a {
          color: #475467;
          text-decoration: none;
          font-size: 12px;
          font-weight: 750;
          transition: .2s;
        }

        .ae-nav nav a:hover {
          color: #a38319;
        }

        .ae-login {
          height: 42px;
          padding: 0 17px;
          display: flex;
          align-items: center;
          border:
            1px solid #e4e7ec;
          border-radius: 10px;
          background: #fff;
          color: #344054;
          text-decoration: none;
          font-size: 12px;
          font-weight: 800;
          white-space: nowrap;
        }

        /* HERO */

        .ae-hero {
          position: relative;
          overflow: hidden;
          min-height: 660px;
          display: flex;
          align-items: center;
          background:
            linear-gradient(
              115deg,
              #07111f,
              #0d1b2b 52%,
              #111c28
            );
          color: white;
        }

        .ae-hero::before {
          content: "";
          position: absolute;
          width: 620px;
          height: 620px;
          right: -220px;
          top: -270px;
          border-radius: 50%;
          border:
            1px solid
            rgba(201,162,39,.20);
          box-shadow:
            0 0 0 70px
            rgba(201,162,39,.025),
            0 0 0 140px
            rgba(201,162,39,.018);
        }

        .ae-hero-grid {
          position: relative;
          z-index: 2;
          display: grid;
          grid-template-columns:
            1.05fr .95fr;
          align-items: center;
          gap: 65px;
          padding: 85px 0;
        }

        .ae-kicker {
          display: inline-flex;
          align-items: center;
          gap: 7px;
          color: #e5c958;
          font-size: 10px;
          font-weight: 900;
          letter-spacing: 2px;
        }

        .ae-kicker.blue {
          color: #a38319;
        }

        .ae-hero h1 {
          max-width: 690px;
          margin: 18px 0;
          font-size:
            clamp(
              43px,
              5vw,
              69px
            );
          line-height: 1.02;
          letter-spacing: -2.8px;
          font-weight: 850;
        }

        .ae-hero h1 strong {
          color: #d6b33a;
        }

        .ae-hero p {
          max-width: 620px;
          margin: 0;
          color: #b7c2d0;
          font-size: 16px;
          line-height: 1.75;
        }

        .ae-hero-actions {
          display: flex;
          flex-wrap: wrap;
          gap: 12px;
          margin-top: 30px;
        }

        .ae-btn {
          min-height: 49px;
          padding: 0 19px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          border-radius: 11px;
          text-decoration: none;
          font-size: 12px;
          font-weight: 850;
          transition: .2s;
          cursor: pointer;
        }

        .ae-btn.primary {
          background: #c9a227;
          color: #101828;
          border: none;
        }

        .ae-btn.ghost {
          color: white;
          background:
            rgba(255,255,255,.04);
          border:
            1px solid
            rgba(255,255,255,.16);
        }

        .ae-chips {
          display: flex;
          flex-wrap: wrap;
          gap: 9px;
          margin-top: 24px;
        }

        .ae-chips span {
          display: flex;
          align-items: center;
          gap: 6px;
          padding: 8px 11px;
          border-radius: 8px;
          background:
            rgba(255,255,255,.05);
          border:
            1px solid
            rgba(255,255,255,.08);
          color: #aeb8c5;
          font-size: 10px;
          font-weight: 700;
        }

        .ae-chips svg {
          width: 13px;
          color: #d6b33a;
        }

        .ae-hero-media {
          min-height: 450px;
          position: relative;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .ae-glow {
          position: absolute;
          width: 330px;
          height: 330px;
          border-radius: 50%;
          background:
            rgba(201,162,39,.12);
          filter: blur(45px);
        }

        /* LOGO PRINCIPAL MAIOR */

        .ae-main-logo {
          position: relative;
          z-index: 2;
          width: 390px;
          max-width: 88%;
          object-fit: contain;
          filter:
            drop-shadow(
              0 25px 55px
              rgba(0,0,0,.45)
            );
        }

        .ae-float-card {
          position: absolute;
          z-index: 4;
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 12px 14px;
          background:
            rgba(255,255,255,.08);
          border:
            1px solid
            rgba(255,255,255,.13);
          backdrop-filter: blur(15px);
          border-radius: 13px;
        }

        .ae-float-card.one {
          left: 0;
          top: 45px;
        }

        .ae-float-card.two {
          right: 0;
          bottom: 45px;
        }

        .ae-float-card img {
          width: 38px;
          height: 38px;
          object-fit: contain;
          border-radius: 11px;
          overflow: hidden;
        }

        .ae-float-card b {
          display: block;
          color: white;
          font-size: 11px;
        }

        .ae-float-card small {
          display: block;
          margin-top: 3px;
          color: #aeb8c5;
          font-size: 9px;
        }

        /* RASTREIO */

        .ae-rastreio {
          position: relative;
          z-index: 20;
          margin-top: -48px;
        }

        .ae-rastreio-box {
          padding: 30px;
          background: white;
          border:
            1px solid #e5e7eb;
          border-radius: 22px;
          box-shadow:
            0 25px 70px
            rgba(16,24,40,.13);
        }

        .ae-rastreio-title {
          display: flex;
          align-items: center;
          gap: 13px;
          margin-bottom: 20px;
        }

        .ae-rastreio-icon {
          width: 49px;
          height: 49px;
          border-radius: 13px;
          display: flex;
          align-items: center;
          justify-content: center;
          background: #fff9e6;
          color: #a38319;
        }

        .ae-rastreio-title h2 {
          margin: 0;
          color: #101828;
          font-size: 20px;
        }

        .ae-rastreio-title p {
          margin: 4px 0 0;
          color: #667085;
          font-size: 12px;
        }

        .ae-rastreio-form {
          display: flex;
          gap: 10px;
        }

        .ae-rastreio-input {
          position: relati/ve;
          flex: 1;
        }

        .ae-rastreio-input svg {
          position: absolute;
          left: 15px;
          top: 50%;
          transform:
            translateY(-50%);
          color: #98a2b3;
        }

        .ae-rastreio-input input {
          width: 100%;
          height: 53px;
          padding:
            0 15px 0 45px;
          border:
            1px solid #dfe3e8;
          border-radius: 11px;
          outline: none;
          background: #f8fafc;
          color: #101828;
          font-size: 14px;
        }

        .ae-rastreio-input input:focus {
          border-color: #c9a227;
          box-shadow:
            0 0 0 3px
            rgba(201,162,39,.10);
        }

        .ae-rastreio-submit {
          min-width: 150px;
          height: 53px;
          border: none;
          border-radius: 11px;
          background: #101828;
          color: white;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          cursor: pointer;
          font-size: 12px;
          font-weight: 850;
        }

        .ae-rastreio-submit:disabled {
          opacity: .6;
          cursor: wait;
        }

        .ae-rastreio-error {
          display: flex;
          align-items: center;
          gap: 8px;
          margin-top: 12px;
          padding: 12px 14px;
          border-radius: 10px;
          background: #fff1f2;
          border:
            1px solid #fecdd3;
          color: #be123c;
          font-size: 12px;
        }

        .ae-resultado {
          margin-top: 23px;
          padding-top: 23px;
          border-top:
            1px solid #edf0f3;
        }

        .ae-status {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 15px;
          padding: 16px;
          border-radius: 13px;
          border: 1px solid;
        }

        .ae-status-content {
          display: flex;
          align-items: center;
          gap: 12px;
        }

        .ae-status-content h3 {
          margin: 0;
          font-size: 16px;
          color: #17202a;
        }

        .ae-status-content p {
          margin: 4px 0 0;
          color: #64748b;
          font-size: 11px;
        }

        .ae-status-badge {
          padding: 7px 11px;
          border-radius: 20px;
          background: white;
          border: 1px solid;
          font-size: 10px;
          font-weight: 900;
        }

        /* COMPROVANTE */

        .ae-comprovante {
          margin-top: 15px;
          border:
            1px solid #e5e7eb;
          border-radius: 15px;
          overflow: hidden;
          background: white;
        }

        .ae-comprovante-head {
          padding: 17px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 15px;
          background: #fafbfc;
          border-bottom:
            1px solid #edf0f3;
        }

        .ae-comprovante-brand {
          display: flex;
          align-items: center;
          gap: 10px;
        }

        .ae-comprovante-brand-icon {
          width: 39px;
          height: 39px;
          border-radius: 10px;
          display: flex;
          align-items: center;
          justify-content: center;
          background: #c9a227;
          color: #111827;
        }

        .ae-comprovante-brand b {
          display: block;
          font-size: 13px;
        }

        .ae-comprovante-brand small {
          display: block;
          margin-top: 2px;
          color: #98a2b3;
          font-size: 9px;
        }

        .ae-comprovante-code {
          text-align: right;
        }

        .ae-comprovante-code small {
          display: block;
          color: #98a2b3;
          font-size: 9px;
        }

        .ae-comprovante-code strong {
          display: block;
          margin-top: 3px;
          color: #101828;
          font-family: monospace;
          font-size: 13px;
        }

        /* IDENTIFICAÇÃO + HISTÓRICO */

        .ae-primeira-linha {
          display: grid;
          grid-template-columns:
            1fr 1fr;
          border-bottom:
            1px solid #edf0f3;
        }

        .ae-bloco {
          padding: 19px;
          min-width: 0;
        }

        .ae-bloco + .ae-bloco {
          border-left:
            1px solid #edf0f3;
        }

        .ae-bloco-titulo {
          display: flex;
          align-items: center;
          gap: 7px;
          margin-bottom: 14px;
          color: #344054;
          font-size: 11px;
          font-weight: 850;
        }

        .ae-bloco-titulo svg {
          color: #a38319;
        }

        .ae-identificacao-grid {
          display: grid;
          grid-template-columns:
            repeat(2, 1fr);
          gap: 12px;
        }

        .ae-info-label {
          margin-bottom: 4px;
          color: #98a2b3;
          font-size: 8px;
          font-weight: 850;
          text-transform: uppercase;
          letter-spacing: .4px;
        }

        .ae-info-value {
          color: #344054;
          font-size: 11px;
          font-weight: 700;
          line-height: 1.5;
          word-break: break-word;
        }

        /* HISTÓRICO */

        .ae-historico-list {
          display: flex;
          flex-direction: column;
          gap: 9px;
        }

        .ae-historico-item {
          display: flex;
          align-items: center;
          gap: 9px;
        }

        .ae-historico-dot {
          width: 8px;
          height: 8px;
          flex-shrink: 0;
          border-radius: 50%;
          background: #c9a227;
        }

        .ae-historico-item b {
          color: #344054;
          font-size: 10px;
        }

        .ae-historico-item span {
          color: #98a2b3;
          margin-left: 5px;
          font-size: 8px;
        }

        .ae-sem-historico {
          padding: 12px;
          border:
            1px dashed #d7dde5;
          border-radius: 8px;
          color: #98a2b3;
          text-align: center;
          font-size: 10px;
        }

        /* ENDEREÇO */

        .ae-endereco-linha {
          padding: 17px 19px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 20px;
          border-bottom:
            1px solid #edf0f3;
          background: #fcfcfd;
        }

        .ae-endereco-conteudo {
          min-width: 0;
          display: flex;
          align-items: center;
          gap: 11px;
        }

        .ae-endereco-icone {
          width: 39px;
          height: 39px;
          flex-shrink: 0;
          border-radius: 10px;
          display: flex;
          align-items: center;
          justify-content: center;
          background: #fff9e6;
          color: #a38319;
        }

        .ae-endereco-texto {
          min-width: 0;
        }

        .ae-endereco-texto .ae-info-label {
          margin-bottom: 4px;
        }

        .ae-endereco-texto .ae-info-value {
          font-size: 11px;
        }

        .ae-mapa-btn {
          flex-shrink: 0;
          height: 40px;
          padding: 0 13px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 6px;
          border-radius: 9px;
          background: #101828;
          color: white;
          text-decoration: none;
          font-size: 10px;
          font-weight: 850;
          transition: .2s;
        }

        .ae-mapa-btn:hover {
          background: #1d2939;
          transform: translateY(-1px);
        }

        .ae-mapa-btn.disabled {
          background: #eaecf0;
          color: #98a2b3;
          cursor: default;
          pointer-events: none;
        }

        /* RECEBEDOR + FOTO */

        .ae-segunda-linha {
          display: grid;
          grid-template-columns:
            1fr 1fr;
        }

        .ae-recebedor-grid {
          display: grid;
          grid-template-columns:
            1fr 1fr;
          gap: 13px;
        }

        .ae-observacao {
          grid-column: 1 / -1;
          padding-top: 4px;
        }

        .ae-fotos-grid {
          display: grid;
          grid-template-columns:
            repeat(3, 1fr);
          gap: 8px;
        }

        .ae-foto {
          width: 100%;
          height: 105px;
          object-fit: cover;
          border-radius: 8px;
          border:
            1px solid #e5e7eb;
          cursor: pointer;
          transition: .2s;
        }

        .ae-foto:hover {
          transform: scale(1.02);
        }

        .ae-sem-foto {
          padding: 22px 10px;
          border:
            1px dashed #d7dde5;
          border-radius: 9px;
          color: #98a2b3;
          text-align: center;
          font-size: 10px;
        }

        .ae-coordenadas {
          padding: 12px 19px;
          display: flex;
          align-items: center;
          gap: 7px;
          border-top:
            1px solid #edf0f3;
          color: #98a2b3;
          font-size: 9px;
        }

        .ae-coordenadas svg {
          color: #c9a227;
        }

        /* SEÇÕES */

        .ae-section {
          padding: 95px 0;
          background: white;
        }

        .ae-two {
          display: grid;
          grid-template-columns:
            1fr 1fr;
          gap: 80px;
          align-items: center;
        }

        .ae-section h2 {
          margin: 12px 0 0;
          color: #101828;
          font-size:
            clamp(31px, 4vw, 46px);
          line-height: 1.08;
          letter-spacing: -1.7px;
        }

        .ae-section h2 strong {
          color: #a38319;
        }

        .ae-section p {
          color: #667085;
          line-height: 1.75;
          font-size: 14px;
        }

        .ae-text-link {
          color: #a38319;
          text-decoration: none;
          font-size: 12px;
          font-weight: 850;
        }

        /* DIFERENCIAIS */

        .ae-dark {
          background:
            linear-gradient(
              135deg,
              #07111f,
              #101c2b
            );
          color: white;
        }

        .ae-dark h2 {
          color: white;
        }

        .ae-feature-grid {
          display: grid;
          grid-template-columns:
            repeat(4, 1fr);
          gap: 13px;
          margin-top: 45px;
        }

        .ae-feature {
          min-height: 220px;
          padding: 25px;
          border:
            1px solid
            rgba(255,255,255,.08);
          background:
            rgba(255,255,255,.035);
          border-radius: 16px;
          transition: .25s;
        }

        .ae-feature:hover {
          transform: translateY(-4px);
          border-color:
            rgba(201,162,39,.35);
        }

        .ae-feature svg {
          color: #d6b33a;
        }

        .ae-feature h3 {
          margin: 24px 0 9px;
          color: white;
          font-size: 15px;
        }

        .ae-feature p {
          margin: 0;
          color: #98a2b3;
          font-size: 12px;
          line-height: 1.7;
        }

        .ae-center {
          max-width: 700px;
          margin: 0 auto;
          text-align: center;
        }

        .ae-center p {
          max-width: 560px;
          margin: 15px auto 0;
        }

        /* TIMELINE */

        .ae-timeline {
          display: grid;
          grid-template-columns:
            repeat(4, 1fr);
          gap: 15px;
          margin-top: 50px;
        }

        .ae-step {
          position: relative;
          padding: 28px 23px;
          border:
            1px solid #eaecf0;
          border-radius: 16px;
          background: white;
        }

        .ae-step i {
          position: absolute;
          top: 19px;
          right: 20px;
          color: #d0d5dd;
          font-size: 11px;
          font-weight: 900;
          font-style: normal;
        }

        .ae-step svg {
          color: #a38319;
          margin-bottom: 25px;
        }

        .ae-step h3 {
          margin: 0 0 8px;
          font-size: 14px;
        }

        .ae-step p {
          margin: 0;
          font-size: 11px;
          line-height: 1.7;
        }

        /* PREMIUM */

        .ae-premium {
          padding: 90px 0;
          background: #f7f8fa;
        }

        .ae-premium-head {
          max-width: 700px;
          margin: 0 auto;
          text-align: center;
        }

        .ae-premium-grid {
          display: grid;
          grid-template-columns:
            repeat(3, 1fr);
          gap: 15px;
          margin-top: 42px;
        }

        .ae-premium-card {
          padding: 26px;
          border:
            1px solid #e6e9ed;
          border-radius: 17px;
          background: white;
        }

        .ae-premium-icon {
          width: 45px;
          height: 45px;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 12px;
          background: #fff9e6;
          color: #a38319;
        }

        .ae-premium-card h3 {
          margin: 20px 0 8px;
          font-size: 15px;
        }

        .ae-premium-card p {
          margin: 0;
          font-size: 12px;
        }

        /* CTA */

        .ae-cta {
          padding: 80px 0;
          background:
            linear-gradient(
              115deg,
              #c9a227,
              #e1c458
            );
        }

        .ae-cta-inner {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 30px;
        }

        .ae-cta h2 {
          margin: 11px 0 10px;
          color: #111827;
          font-size:
            clamp(32px, 4vw, 48px);
          line-height: 1.05;
          letter-spacing: -1.7px;
        }

        .ae-cta p {
          margin: 0;
          color: #594500;
          font-size: 13px;
        }

        .ae-btn-dark {
          min-width: 180px;
          background: #111827;
          color: white;
        }

        /* FAQ */

        .ae-faq {
          background: white;
        }

        .ae-faq-inner {
          max-width: 850px;
        }

        .ae-faq details {
          padding: 21px 0;
          border-bottom:
            1px solid #eaecf0;
        }

        .ae-faq summary {
          list-style: none;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 20px;
          color: #344054;
          font-size: 13px;
          font-weight: 800;
        }

        .ae-faq summary::-webkit-details-marker {
          display: none;
        }

        .ae-faq details p {
          margin: 14px 0 0;
          font-size: 12px;
        }

        /* FOOTER */

        .ae-footer {
          padding: 35px 0;
          background: #07111f;
          color: white;
        }

        .ae-footer-inner {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 25px;
        }

        .ae-footer .ae-brand img {
          width: 52px;
          height: 52px;
          border-radius: 16px;
          overflow: hidden;
        }

        .ae-footer p {
          margin: 0;
          color: #98a2b3;
          font-size: 11px;
        }

        .ae-footer a {
          color: #d6b33a;
          font-size: 11px;
          font-weight: 800;
          text-decoration: none;
        }

        /* MODAL */

        .ae-modal {
          position: fixed;
          inset: 0;
          z-index: 9999;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 30px;
          background:
            rgba(7,17,31,.84);
        }

        .ae-modal img {
          max-width: 92vw;
          max-height: 86vh;
          object-fit: contain;
          border-radius: 10px;
        }

        .ae-modal-close {
          position: fixed;
          right: 20px;
          top: 20px;
          width: 46px;
          height: 46px;
          border: none;
          border-radius: 50%;
          background:
            rgba(255,255,255,.12);
          color: white;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        /* RESPONSIVO */

        @media(max-width:1050px) {

          .ae-nav nav {
            display: none;
          }

          .ae-hero-grid {
            grid-template-columns: 1fr;
          }

          .ae-feature-grid {
            grid-template-columns:
              repeat(2, 1fr);
          }

          .ae-timeline {
            grid-template-columns:
              repeat(2, 1fr);
          }

        }

        @media(max-width:760px) {

          .ae-nav {
            padding: 0 15px;
          }

          .ae-wrap {
            width:
              min(
                calc(100% - 28px),
                1180px
              );
          }

          .ae-hero-grid {
            padding: 65px 0 80px;
          }

          .ae-hero h1 {
            font-size: 43px;
            letter-spacing: -2px;
          }

          .ae-hero-media {
            min-height: 300px;
          }

          .ae-main-logo {
            width: 300px;
            max-width: 82%;
          }

          .ae-float-card.one {
            left: 0;
            top: 20px;
          }

          .ae-float-card.two {
            right: 0;
            bottom: 10px;
          }

          .ae-rastreio {
            margin-top: -28px;
          }

          .ae-rastreio-box {
            padding: 20px;
          }

          .ae-rastreio-form {
            flex-direction: column;
          }

          .ae-rastreio-submit {
            width: 100%;
          }

          .ae-status {
            align-items: flex-start;
            flex-direction: column;
          }

          .ae-primeira-linha,
          .ae-segunda-linha {
            grid-template-columns: 1fr;
          }

          .ae-bloco + .ae-bloco {
            border-left: none;
            border-top:
              1px solid #edf0f3;
          }

          .ae-identificacao-grid,
          .ae-recebedor-grid {
            grid-template-columns: 1fr;
          }

          .ae-endereco-linha {
            align-items: flex-start;
            flex-direction: column;
          }

          .ae-mapa-btn {
            width: 100%;
          }

          .ae-fotos-grid {
            grid-template-columns:
              repeat(2, 1fr);
          }

          .ae-two {
            grid-template-columns: 1fr;
            gap: 35px;
          }

          .ae-feature-grid,
          .ae-premium-grid {
            grid-template-columns: 1fr;
          }

          .ae-timeline {
            grid-template-columns: 1fr;
          }

          .ae-cta-inner {
            align-items: flex-start;
            flex-direction: column;
          }

          .ae-btn-dark {
            width: 100%;
          }

          .ae-footer-inner {
            align-items: flex-start;
            flex-direction: column;
          }

        }

      `}</style>

      {/* NAVBAR */}

      <header className="ae-nav">

        <Link
          to="/"
          className="ae-brand"
        >

          <img
            src={Icon}
            alt="Águia Express"
          />

          <span>
            <b>ÁGUIA</b>
            <small>EXPRESS</small>
          </span>

        </Link>

        <nav>

          <a href="#ecossistema">
            Ecossistema
          </a>

          <a href="#diferenciais">
            Diferenciais
          </a>

          <a href="#como-funciona">
            Como funciona
          </a>

          <a href="#abrangencia">
            Abrangência
          </a>

          <a href="#rastreio">
            Rastreio
          </a>

          <a href="#faq">
            Dúvidas
          </a>

        </nav>

        <Link
          to="/login"
          className="ae-login"
        >
          Área administrativa
        </Link>

      </header>

      {/* HERO */}

      <section className="ae-hero">

        <div className="ae-wrap ae-hero-grid">

          <div>

            <span className="ae-kicker">
              <Truck size={14} />
              LOGÍSTICA URBANA • SAME DAY
            </span>

            <h1>
              Entregas rápidas.
              <br />
              <strong>Controle total.</strong>
              <br />
              Confiança em cada rota.
            </h1>

            <p>
              A Águia Express conecta empresas,
              operações e clientes através de
              uma logística urbana inteligente,
              rastreável e preparada para o ritmo
              das entregas do mesmo dia.
            </p>

            <div className="ae-hero-actions">

              <a
                href="#rastreio"
                className="ae-btn primary"
              >
                <Search size={17} />
                Rastrear encomenda
              </a>

              <a
                href="#como-funciona"
                className="ae-btn ghost"
              >
                Conheça nossa operação
                <ArrowRight size={16} />
              </a>

            </div>

            <div className="ae-chips">

              <span>
                <Check />
                CEPs 064 · 065 · 066
              </span>

              <span>
                <Check />
                Tecnologia própria
              </span>

              <span>
                <Check />
                Entrega rastreável
              </span>

            </div>

          </div>

          <div className="ae-hero-media">

            <div className="ae-glow" />

            <img
              className="ae-main-logo"
              src={logo}
              alt="Águia Express"
            />

            <div className="ae-float-card one">

              <img
                src={Icon}
                alt="Águia Express"
              />

              <div>

                <b>
                  Águia Express
                </b>

                <small>
                  Operação conectada
                </small>

              </div>

            </div>

            <div className="ae-float-card two">

              <CheckCircle2
                size={27}
                color="#4ade80"
              />

              <div>

                <b>
                  Entrega rastreável
                </b>

                <small>
                  Histórico e comprovante digital
                </small>

              </div>

            </div>

          </div>

        </div>

      </section>

      {/* RASTREIO */}

      <section
        id="rastreio"
        className="ae-rastreio"
      >

        <div className="ae-wrap">

          <div className="ae-rastreio-box">

            <div className="ae-rastreio-title">

              <div className="ae-rastreio-icon">
                <Navigation size={23} />
              </div>

              <div>

                <h2>
                  Rastreie sua encomenda
                </h2>

                <p>
                  Digite o código e consulte sua entrega sem sair desta página.
                </p>

              </div>

            </div>

            <form
              className="ae-rastreio-form"
              onSubmit={(e) => {
                e.preventDefault();
                pesquisarRastreio();
              }}
            >

              <div className="ae-rastreio-input">

                <Search size={18} />

                <input
                  value={codigo}
                  onChange={(e) =>
                    setCodigo(
                      e.target.value
                    )
                  }
                  placeholder="Digite o código de rastreio"
                  autoComplete="off"
                />

              </div>

              <button
                type="submit"
                className="ae-rastreio-submit"
                disabled={buscando}
              >

                <Search size={17} />

                {buscando
                  ? "Consultando..."
                  : "Rastrear encomenda"}

              </button>

            </form>

            {erro && (

              <div className="ae-rastreio-error">

                <X size={17} />

                {erro}

              </div>

            )}

            {entrega && (

              <div className="ae-resultado">

                <div
                  className="ae-status"
                  style={{
                    background:
                      status.fundo,
                    borderColor:
                      status.borda,
                  }}
                >

                  <div className="ae-status-content">

                    <CheckCircle2
                      size={25}
                      color={status.cor}
                    />

                    <div>

                      <h3>
                        {status.titulo}
                      </h3>

                      <p>
                        {status.descricao}
                      </p>

                    </div>

                  </div>

                  <div
                    className="ae-status-badge"
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

                </div>

                <div className="ae-comprovante">

                  {/* CABEÇALHO */}

                  <div className="ae-comprovante-head">

                    <div className="ae-comprovante-brand">

                      <div className="ae-comprovante-brand-icon">
                        <FileCheck2 size={20} />
                      </div>

                      <div>

                        <b>
                          Comprovante de entrega
                        </b>

                        <small>
                          Águia Express
                        </small>

                      </div>

                    </div>

                    <div className="ae-comprovante-code">

                      <small>
                        CÓDIGO
                      </small>

                      <strong>
                        {codigoExibicao}
                      </strong>

                    </div>

                  </div>

                  {/* IDENTIFICAÇÃO + HISTÓRICO */}

                  <div className="ae-primeira-linha">

                    <div className="ae-bloco">

                      <div className="ae-bloco-titulo">
                        <FileCheck2 size={14} />
                        Identificação
                      </div>

                      <div className="ae-identificacao-grid">

                        <div>
                          <div className="ae-info-label">
                            Código
                          </div>

                          <div className="ae-info-value">
                            {codigoExibicao}
                          </div>
                        </div>

                        <div>
                          <div className="ae-info-label">
                            Empresa
                          </div>

                          <div className="ae-info-value">
                            {empresa}
                          </div>
                        </div>

                        <div>
                          <div className="ae-info-label">
                            Entregador
                          </div>

                          <div className="ae-info-value">
                            {nomeEntregador}
                          </div>
                        </div>

                        <div>
                          <div className="ae-info-label">
                            Data
                          </div>

                          <div className="ae-info-value">
                            {formatarData(
                              dataEntrega
                            )}
                          </div>
                        </div>

                      </div>

                    </div>

                    <div className="ae-bloco">

                      <div className="ae-bloco-titulo">
                        <History size={14} />
                        Histórico da encomenda
                      </div>

                      {historico.length > 0 ? (

                        <div className="ae-historico-list">

                          {historico.map(
                            (
                              item: any,
                              index: number
                            ) => (

                              <div
                                key={index}
                                className="ae-historico-item"
                              >

                                <div className="ae-historico-dot" />

                                <div>

                                  <b>
                                    {item?.status ||
                                      item?.situacao ||
                                      "Atualização"}
                                  </b>

                                  <span>
                                    {formatarData(
                                      item?.dataHora ||
                                      item?.data ||
                                      item?.timestamp
                                    )}
                                  </span>

                                </div>

                              </div>

                            )
                          )}

                        </div>

                      ) : (

                        <div className="ae-sem-historico">

                          <b>
                            {String(
                              valor(
                                entrega,
                                [
                                  "status",
                                  "situacao",
                                ],
                                "Sem histórico"
                              )
                            )}
                          </b>

                          <br />

                          Última atualização:
                          {" "}
                          {formatarData(
                            dataEntrega
                          )}

                        </div>

                      )}

                    </div>

                  </div>

                  {/* ENDEREÇO + MAPA */}

                  <div className="ae-endereco-linha">

                    <div className="ae-endereco-conteudo">

                      <div className="ae-endereco-icone">
                        <MapPin size={19} />
                      </div>

                      <div className="ae-endereco-texto">

                        <div className="ae-info-label">
                          Endereço da entrega
                        </div>

                        <div className="ae-info-value">

                          {enderecoTexto ||
                            String(
                              valor(
                                entrega,
                                [
                                  "enderecoCompleto",
                                  "endereco",
                                ],
                                "Endereço não informado"
                              )
                            )}

                        </div>

                      </div>

                    </div>

                    {mapaDisponivel ? (

                      <a
                        className="ae-mapa-btn"
                        href={
                          `https://www.google.com/maps?q=${latitude},${longitude}`
                        }
                        target="_blank"
                        rel="noreferrer"
                      >

                        <MapPin size={14} />

                        Abrir no mapa

                        <ExternalLink
                          size={11}
                        />

                      </a>

                    ) : (

                      <span className="ae-mapa-btn disabled">

                        <MapPin size={14} />

                        Localização indisponível

                      </span>

                    )}

                  </div>

                  {/* RECEBEDOR + FOTO */}

                  <div className="ae-segunda-linha">

                    <div className="ae-bloco">

                      <div className="ae-bloco-titulo">
                        <CheckCircle2 size={14} />
                        Recebedor
                      </div>

                      <div className="ae-recebedor-grid">

                        <div>

                          <div className="ae-info-label">
                            Nome
                          </div>

                          <div className="ae-info-value">
                            {nomeRecebedor}
                          </div>

                        </div>

                        <div>

                          <div className="ae-info-label">
                            Documento
                          </div>

                          <div className="ae-info-value">
                            {documentoRecebedor}
                          </div>

                        </div>

                        <div className="ae-observacao">

                          <div className="ae-info-label">
                            Observação
                          </div>

                          <div className="ae-info-value">
                            {observacao}
                          </div>

                        </div>

                      </div>

                    </div>

                    <div className="ae-bloco">

                      <div className="ae-bloco-titulo">
                        <Camera size={14} />
                        Comprovante fotográfico
                      </div>

                      {fotos.length > 0 ? (

                        <div className="ae-fotos-grid">

                          {fotos.map(
                            (
                              foto,
                              index
                            ) => (

                              <img
                                key={`${foto}-${index}`}
                                src={foto}
                                alt={`Comprovante ${index + 1}`}
                                className="ae-foto"
                                onClick={() =>
                                  setFotoSelecionada(
                                    foto
                                  )
                                }
                              />

                            )
                          )}

                        </div>

                      ) : (

                        <div className="ae-sem-foto">

                          Nenhum comprovante fotográfico registrado.

                        </div>

                      )}

                    </div>

                  </div>

                  {/* COORDENADAS */}

                  {latitude &&
                    longitude && (

                      <div className="ae-coordenadas">

                        <MapPin size={13} />

                        Localização registrada:
                        {" "}
                        {String(latitude)}
                        ,
                        {" "}
                        {String(longitude)}

                      </div>

                    )}

                </div>

              </div>

            )}

          </div>

        </div>

      </section>

      {/* ECOSSISTEMA */}

      <section
        id="ecossistema"
        className="ae-section"
      >

        <div className="ae-wrap ae-two">

          <div>

            <span className="ae-kicker blue">
              LOGÍSTICA INTELIGENTE
            </span>

            <h2>
              Mais que entrega:
              <br />
              <strong>
                uma operação conectada.
              </strong>
            </h2>

          </div>

          <div>

            <p>
              Da entrada do pacote até a
              confirmação final, nossa operação
              é organizada para oferecer
              velocidade, visibilidade e controle.
            </p>

            <p>
              Utilizamos tecnologia própria para
              registrar movimentações,
              responsável, localização e
              comprovantes.
            </p>

            <a
              href="#rastreio"
              className="ae-text-link"
            >
              Consulte uma entrega →
            </a>

          </div>

        </div>

      </section>

      {/* DIFERENCIAIS */}

      <section
        id="diferenciais"
        className="ae-section ae-dark"
      >

        <div className="ae-wrap">

          <span className="ae-kicker">
            POR QUE ÁGUIA EXPRESS?
          </span>

          <h2>
            Uma operação feita para o ritmo
            <br />
            de quem precisa entregar
            <strong> no mesmo dia.</strong>
          </h2>

          <div className="ae-feature-grid">

            <article className="ae-feature">
              <Zap />
              <h3>
                Agilidade operacional
              </h3>
              <p>
                Processos organizados para
                acelerar a saída e a conclusão
                das rotas.
              </p>
            </article>

            <article className="ae-feature">
              <Route />
              <h3>
                Rastreabilidade
              </h3>
              <p>
                Histórico completo das
                movimentações e acompanhamento
                da encomenda.
              </p>
            </article>

            <article className="ae-feature">
              <Smartphone />
              <h3>
                Tecnologia própria
              </h3>
              <p>
                Aplicativo próprio para controlar
                a operação do início ao fim.
              </p>
            </article>

            <article className="ae-feature">
              <ShieldCheck />
              <h3>
                Mais segurança
              </h3>
              <p>
                Registro de responsável,
                localização e comprovante
                digital da entrega.
              </p>
            </article>

          </div>

        </div>

      </section>

      {/* COMO FUNCIONA */}

      <section
        id="como-funciona"
        className="ae-section"
      >

        <div className="ae-wrap">

          <div className="ae-center">

            <span className="ae-kicker blue">
              COMO FUNCIONA
            </span>

            <h2>
              Do pacote à entrega,
              <br />
              <strong>
                tudo conectado.
              </strong>
            </h2>

            <p>
              Um fluxo operacional pensado para
              manter controle e velocidade em
              cada etapa.
            </p>

          </div>

          <div className="ae-timeline">

            <article className="ae-step">
              <i>01</i>
              <PackageCheck />
              <h3>
                Entrada e conferência
              </h3>
              <p>
                O pacote entra no sistema e
                passa pela organização operacional.
              </p>
            </article>

            <article className="ae-step">
              <i>02</i>
              <MapPin />
              <h3>
                Separação por região
              </h3>
              <p>
                Volumes são direcionados para
                facilitar a distribuição e as rotas.
              </p>
            </article>

            <article className="ae-step">
              <i>03</i>
              <Truck />
              <h3>
                Saída para entrega
              </h3>
              <p>
                Carros e motos seguem para as
                regiões atendidas.
              </p>
            </article>

            <article className="ae-step">
              <i>04</i>
              <Check />
              <h3>
                Confirmação final
              </h3>
              <p>
                Entrega registrada com dados e
                histórico no sistema.
              </p>
            </article>

          </div>

        </div>

      </section>

      {/* OPERAÇÃO CONECTADA */}

      <section
        className="ae-section"
        style={{
          background: "#f6f7f9",
        }}
      >

        <div className="ae-wrap ae-two">

          <div
            style={{
              minHeight: 410,
              borderRadius: 27,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              background:
                "radial-gradient(circle at 50% 35%, rgba(201,162,39,.28), transparent 28%), #091522",
              boxShadow:
                "0 30px 70px rgba(16,24,40,.17)",
              overflow: "hidden",
            }}
          >

            <img
              src={logo}
              alt="Águia Express"
              style={{
                width: 300,
                maxWidth: "80%",
                objectFit: "contain",
                marginBottom: 20,
              }}
            />

            <span
              style={{
                marginTop: 4,
                color: "#d6b33a",
                fontSize: 8,
                fontWeight: 800,
                letterSpacing: 2,
              }}
            >
              TECNOLOGIA A SERVIÇO DA OPERAÇÃO
            </span>

          </div>

          <div>

            <span className="ae-kicker blue">
              TECNOLOGIA E RASTREABILIDADE
            </span>

            <h2>
              Informação para acompanhar
              <br />
              <strong>
                cada entrega.
              </strong>
            </h2>

            <p>
              Nosso sistema próprio permite
              controlar a operação e registrar
              informações importantes em tempo real.
            </p>

          </div>

        </div>

      </section>

      {/* PREMIUM */}

      <section className="ae-premium">

        <div className="ae-wrap">

          <div className="ae-premium-head">

            <span className="ae-kicker blue">
              EXPERIÊNCIA ÁGUIA EXPRESS
            </span>

            <h2>
              Mais transparência.
              <br />
              <strong>
                Mais confiança.
              </strong>
            </h2>

            <p>
              Cada etapa foi pensada para
              transformar uma simples entrega
              em uma operação profissional,
              rastreável e confiável.
            </p>

          </div>

          <div className="ae-premium-grid">

            <article className="ae-premium-card">
              <div className="ae-premium-icon">
                <BarChart3 size={22} />
              </div>

              <h3>
                Visibilidade operacional
              </h3>

              <p>
                Acompanhe a evolução da encomenda
                e tenha mais clareza sobre cada etapa.
              </p>
            </article>

            <article className="ae-premium-card">
              <div className="ae-premium-icon">
                <Camera size={22} />
              </div>

              <h3>
                Comprovante digital
              </h3>

              <p>
                Registro fotográfico e informações
                da entrega disponíveis no rastreamento.
              </p>
            </article>

            <article className="ae-premium-card">
              <div className="ae-premium-icon">
                <CircleCheck size={22} />
              </div>

              <h3>
                Histórico completo
              </h3>

              <p>
                Mais segurança para empresas e
                clientes através de registros da operação.
              </p>
            </article>

          </div>

        </div>

      </section>

      {/* ABRANGÊNCIA */}

      <section
        id="abrangencia"
        className="ae-section"
      >

        <div className="ae-wrap">

          <span className="ae-kicker blue">
            ABRANGÊNCIA OPERACIONAL
          </span>

          <h2>
            Atuação focada para entregar
            <br />
            <strong>
              com mais controle.
            </strong>
          </h2>

          <div
            style={{
              display: "grid",
              gridTemplateColumns:
                "repeat(3, 1fr)",
              gap: 15,
              marginTop: 40,
            }}
          >

            {[
              ["CEP 064", "Barueri"],
              ["CEP 065", "Santana de Parnaiba"],
              ["CEP 066", "Jandira e Itapevi"],
            ].map(
              ([cep, regiao]) => (

                <div
                  key={cep}
                  style={{
                    padding: 27,
                    borderRadius: 16,
                    background: "#f8f9fb",
                    border:
                      "1px solid #eaecf0",
                  }}
                >

                  <b
                    style={{
                      color: GOLD,
                      fontSize: 27,
                    }}
                  >
                    {cep}
                  </b>

                  <span
                    style={{
                      display: "block",
                      marginTop: 6,
                      color: "#667085",
                      fontSize: 12,
                    }}
                  >
                    {regiao}
                  </span>

                </div>

              )
            )}

          </div>

        </div>

      </section>

      {/* CTA */}

      <section className="ae-cta">

        <div className="ae-wrap ae-cta-inner">

          <div>

            <span className="ae-kicker">
              VAMOS TRABALHAR JUNTOS
            </span>

            <h2>
              Uma logística mais ágil
              <br />
              começa com o parceiro certo.
            </h2>

            <p>
              Conheça a Águia Express e veja
              como podemos apoiar sua operação.
            </p>

          </div>

          <Link
            to="/login"
            className="ae-btn ae-btn-dark"
          >
            Área administrativa
            <ArrowRight size={17} />
          </Link>

        </div>

      </section>

      {/* FAQ */}

      <section
        id="faq"
        className="ae-section ae-faq"
      >

        <div className="ae-wrap ae-faq-inner">

          <span className="ae-kicker blue">
            DÚVIDAS FREQUENTES
          </span>

          <h2>
            Entenda nossa operação.
          </h2>

          <details>
            <summary>
              A Águia Express possui sistema próprio?
              <ChevronDown />
            </summary>

            <p>
              Sim. Utilizamos um sistema próprio
              para acompanhar etapas, movimentações
              e registros operacionais.
            </p>
          </details>

          <details>
            <summary>
              Como é registrada a entrega?
              <ChevronDown />
            </summary>

            <p>
              O sistema permite registrar informações
              como responsável pelo recebimento, foto
              e localização, conforme a operação.
            </p>
          </details>

          <details>
            <summary>
              Quais regiões são atendidas?
              <ChevronDown />
            </summary>

            <p>
              Nossa operação tem foco nos
              CEPs 064, 065 e 066.
            </p>
          </details>

          <details>
            <summary>
              Como posso rastrear uma encomenda?
              <ChevronDown />
            </summary>

            <p>
              Você pode utilizar diretamente a
              área de rastreamento desta página.
              Basta informar o código da encomenda.
            </p>

            <a
              href="#rastreio"
              className="ae-text-link"
            >
              Ir para rastreamento →
            </a>
          </details>

        </div>

      </section>

      {/* FOOTER */}

      <footer className="ae-footer">

        <div className="ae-wrap ae-footer-inner">

          <div className="ae-brand">

            <img
              src={Icon}
              alt="Águia Express"
            />

            <span>

              <b
                style={{
                  color: "white",
                }}
              >
                ÁGUIA
              </b>

              <small>
                EXPRESS
              </small>

            </span>

          </div>

          <p>
            Águia Express — Agilidade e
            confiança em cada entrega.
          </p>

          <a href="#rastreio">
            Rastrear encomenda
          </a>

        </div>

      </footer>

      {/* MODAL DA FOTO */}

      {fotoSelecionada && (

        <div
          className="ae-modal"
          onClick={() =>
            setFotoSelecionada(
              null
            )
          }
        >

          <button
            type="button"
            className="ae-modal-close"
            onClick={(e) => {
              e.stopPropagation();

              setFotoSelecionada(
                null
              );
            }}
          >
            <X size={22} />
          </button>

          <img
            src={fotoSelecionada}
            alt="Comprovante ampliado"
            onClick={(e) =>
              e.stopPropagation()
            }
          />

        </div>

      )}

    </div>
  );
}