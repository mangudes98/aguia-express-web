// ARQUIVO: src/pages/Coleta.tsx

import { useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import {
  AlertTriangle,
  LockKeyhole,
  ArrowLeft,
  ChevronRight,
  Copy,
  Edit3,
  Folder,
  FolderPlus,
  LayoutGrid,
  List,
  MoreVertical,
  Package,
  QrCode,
  RefreshCw,
  Search,
  Send,
  Truck,
  Upload,
  X,
  Trash2,
} from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  writeBatch,
} from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";
import { db, auth } from "../services/firebase/firebase";
import { extractScannedCode } from "../services/packageTransferHid";

const EMPTY = "__sem_transportadora__";

type Code = Record<string, any> & { id: string };
type Pasta = Record<string, any> & { id: string };
type PendingCollectionCode = {
  id: string;
  type: string;
  raw: string;
};

function decodeRouteSegment(segment?: string): string {
  if (!segment) return "";
  try {
    return decodeURIComponent(segment);
  } catch {
    return segment;
  }
}

function coletaPath(pastaId: string, suffix = ""): string {
  return `/coletas/${encodeURIComponent(pastaId)}${suffix}`;
}

const COLETA_CSS = `
.coleta-shell{
  --gold:#a87500;
  --gold-soft:#fff6d8;
  --line:#e3e8ef;
  --muted:#667085;
  min-height:100vh;
  color:#17202d;
  background:linear-gradient(145deg,#f9fafc,#eef2f7);
  padding:34px clamp(18px,4vw,64px);
  font-family:Inter,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif
}
.coleta-shell *{box-sizing:border-box}
.coleta-shell button,.coleta-shell input,.coleta-shell select{font:inherit}
.coleta-shell button{cursor:pointer}
.coleta-shell .page-header{
  max-width:1380px;margin:0 auto 30px;display:flex;align-items:flex-end;
  justify-content:space-between;gap:22px;border-bottom:1px solid #dfe4eb;padding-bottom:24px
}
.coleta-shell .page-header h1{
  font-size:clamp(25px,3vw,38px);line-height:1.05;letter-spacing:-.04em;
  margin:0;font-weight:780;color:#17202d
}
.coleta-shell .page-header p{color:var(--muted);margin:10px 0 0;font-size:14px}
.coleta-shell .header-actions{
  display:flex;align-items:center;justify-content:flex-end;flex-wrap:wrap;gap:10px
}
.coleta-shell .primary,.coleta-shell .secondary,.coleta-shell .danger,
.coleta-shell .success,.coleta-shell .info{
  border:1px solid transparent;border-radius:11px;min-height:40px;padding:0 14px;
  display:inline-flex;align-items:center;justify-content:center;gap:8px;
  font-size:13px;font-weight:700;transition:.2s ease
}
.coleta-shell .primary{
  background:#c89818;color:#17120a;box-shadow:0 7px 20px rgba(201,162,39,.18)
}
.coleta-shell .primary:hover{background:#e0b835;transform:translateY(-1px)}
.coleta-shell .secondary{
  background:#fff;border-color:#dce2e9;color:#344054
}
.coleta-shell .secondary:hover{background:#f9fafb;border-color:#c89818}
.coleta-shell .danger{
  background:#fff0f0;border-color:#ffbcbc;color:#d92d20
}
.coleta-shell .success{
  background:#ecfdf3;border-color:#abefc6;color:#067647
}
.coleta-shell .info{
  background:#eff8ff;border-color:#b2ddff;color:#175cd3
}
.coleta-shell .card{
  background:#fff;border:1px solid #e2e7ee;border-radius:18px;
  box-shadow:0 10px 28px rgba(38,53,73,.08)
}
.coleta-shell .inline-form{
  max-width:1380px;margin:0 auto 24px;padding:14px;display:flex;gap:10px;align-items:center
}
.coleta-shell input,.coleta-shell select{
  height:42px;border-radius:10px;border:1px solid #dce2e9;background:#fff;
  color:#17202d;padding:0 13px;outline:none
}
.coleta-shell input:focus,.coleta-shell select:focus{
  border-color:#c89818;box-shadow:0 0 0 3px rgba(201,162,39,.12)
}
.coleta-shell .inline-form input{flex:1}
.coleta-shell .collection-group,.coleta-shell .type-grid,.coleta-shell .code-grid{
  max-width:1380px;margin:0 auto 28px
}
.coleta-shell .section-heading{
  display:flex;align-items:center;gap:9px;margin:25px 0 12px;
  color:#a87500;font-size:11px;letter-spacing:.16em
}
.coleta-shell .section-heading>span{
  width:4px;height:16px;border-radius:5px;background:#c89818
}
.coleta-shell .section-heading small{
  margin-left:auto;color:var(--muted);letter-spacing:0;font-size:12px;font-weight:500
}
.coleta-shell .collection-grid{
  display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:12px
}
.coleta-shell .collection-card,.coleta-shell .type-card{
  width:100%;text-align:left;color:#17202d;background:#fff;border:1px solid #e2e7ee;
  border-radius:16px;padding:17px;display:flex;align-items:center;gap:14px;
  transition:.22s ease;box-shadow:0 10px 28px rgba(38,53,73,.08)
}
.coleta-shell .collection-card:hover,.coleta-shell .type-card:hover{
  transform:translateY(-3px);border-color:#d2a62d;box-shadow:0 16px 35px rgba(38,53,73,.13)
}
.coleta-shell .collection-card>svg,.coleta-shell .type-card>svg{color:#667085;margin-left:auto}
.coleta-shell .icon-box{
  width:46px;height:46px;border-radius:13px;background:#f2f4f7;display:grid;place-items:center;flex:none
}
.coleta-shell .icon-box.gold{color:#a87500;background:#fff6d8}
.coleta-shell .card-copy,.coleta-shell .type-card>span:nth-child(2){
  display:flex;flex-direction:column;gap:6px;min-width:0
}
.coleta-shell .card-copy b,.coleta-shell .type-card b{
  font-size:14px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis
}
.coleta-shell .card-copy small,.coleta-shell .type-card small{
  display:flex;align-items:center;gap:5px;color:var(--muted);font-size:12px
}
.coleta-shell .carrier-card{
  max-width:1380px;margin:0 auto 13px;padding:18px;display:flex;align-items:center;gap:14px;color:#a87500
}
.coleta-shell .carrier-card>div{display:flex;flex-direction:column;gap:5px;flex:1}
.coleta-shell .carrier-card small{color:var(--muted);font-size:10px;letter-spacing:.14em}
.coleta-shell .carrier-card b{color:#17202d;font-size:14px}
.coleta-shell .carrier-card select{min-width:220px}
.coleta-shell .stat-strip{
  max-width:1380px;margin:0 auto 24px;padding:15px 18px;border:1px solid #f0d99a;
  border-radius:13px;background:#fffaf0;color:#8a6200;font-size:13px
}
.coleta-shell .stat-strip b{display:flex;gap:9px;align-items:center}
.coleta-shell .type-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:14px}
.coleta-shell .type-card{min-height:102px}
.coleta-shell .type-card.yellow{--type:#b54708}
.coleta-shell .type-card.orange{--type:#dc6803}
.coleta-shell .type-card.blue{--type:#1570ef}
.coleta-shell .type-card .icon-box{
  color:var(--type);background:color-mix(in srgb,var(--type) 10%,white)
}
.coleta-shell .type-card:hover{
  border-color:color-mix(in srgb,var(--type) 60%,white)
}
.coleta-shell .menu{position:relative}
.coleta-shell .menu-pop{
  position:absolute;right:0;top:48px;z-index:5;width:190px;padding:7px;
  background:#fff;border:1px solid #e2e7ee;border-radius:12px;
  box-shadow:0 18px 45px rgba(16,24,40,.15)
}
.coleta-shell .menu-pop button{
  display:flex;align-items:center;gap:9px;width:100%;padding:10px;border:0;
  background:transparent;color:#344054;border-radius:8px;text-align:left;font-size:12px
}
.coleta-shell .menu-pop button:hover{background:#f2f4f7}
.coleta-shell .danger-text{color:#d92d20!important}
.coleta-shell .empty{
  max-width:1380px;min-height:230px;margin:32px auto;padding:35px;display:flex;
  align-items:center;justify-content:center;flex-direction:column;gap:12px;
  color:var(--muted);text-align:center
}
.coleta-shell .empty svg{color:#98a2b3}
.coleta-shell .scanner-layout{
  max-width:1380px;margin:0 auto;display:grid;
  grid-template-columns:minmax(0,1.35fr) minmax(340px,.65fr);gap:22px;align-items:start
}
.coleta-shell .scanner-box{
  min-height:400px;position:relative;overflow:hidden;padding:30px;
  border-radius:22px;background:linear-gradient(145deg,#111827,#202b3a);
  border:1px solid #d3a52b;box-shadow:0 20px 50px rgba(38,53,73,.18);
  display:flex;flex-direction:column;align-items:center;justify-content:center;
  text-align:center;color:#fff
}
.coleta-shell .hid-scanner-icon{
  width:88px;height:88px;border-radius:24px;margin-bottom:20px;
  display:grid;place-items:center;color:#d3a52b;background:#d3a52b18;
  border:1px solid #d3a52b66
}
.coleta-shell .hid-scanner-title{font-size:23px;font-weight:800}
.coleta-shell .hid-scanner-copy{
  max-width:410px;margin:10px 0 20px;color:#d0d5dd;font-size:14px;line-height:1.55
}
.coleta-shell .hid-scanner-state{
  display:inline-flex;align-items:center;gap:9px;padding:10px 14px;
  border:1px solid #ffffff25;border-radius:999px;background:#ffffff0d;
  font-size:12px;color:#f2f4f7
}
.coleta-shell .hid-scanner-state:before{
  content:"";width:9px;height:9px;border-radius:50%;background:#12b76a;
  box-shadow:0 0 0 4px #12b76a22
}
.coleta-shell .hid-input{
  position:fixed!important;left:-10000px!important;top:0!important;width:1px!important;
  height:1px!important;opacity:0!important;pointer-events:none!important
}
.coleta-shell .scanner-manual{padding:22px}
.coleta-shell .scanner-manual h3{margin:0 0 15px;font-size:17px}
.coleta-shell .scanner-manual .inline-form{padding:0;margin:0;display:flex}
.coleta-shell .feedback{
  padding:10px 12px;background:#fff6d8;color:#8a6200;border-radius:9px;font-size:12px
}
.coleta-shell .scan-list{max-height:330px;overflow:auto;margin:18px 0}
.coleta-shell .scan-list>div{
  display:flex;align-items:center;justify-content:space-between;gap:10px;
  padding:11px 0;border-bottom:1px solid #eaecf0;font-size:12px
}
.coleta-shell .scan-list>div>span{
  display:flex;align-items:center;gap:8px;min-width:0
}
.coleta-shell .scan-list small{
  display:block;color:var(--muted);margin-left:4px
}
.coleta-shell .icon-button{border:0;background:transparent;color:#d92d20}
.coleta-shell .full{width:100%}
.coleta-shell .last-scan{
  max-width:1380px;margin:12px auto;color:var(--muted);font-size:12px
}
.coleta-shell .last-scan b{color:#a87500}
.coleta-shell .search{
  display:flex;align-items:center;gap:8px;background:#fff;border:1px solid #dce2e9;
  border-radius:11px;padding:0 12px;height:40px
}
.coleta-shell .search input{
  height:38px;border:0;padding:0;background:transparent;min-width:180px
}
.coleta-shell .code-grid{
  display:grid;grid-template-columns:repeat(auto-fill,minmax(290px,1fr));gap:15px
}
.coleta-shell .code-card{
  position:relative;padding:15px;background:#fff;border:1px solid #e2e7ee;
  border-radius:17px;display:grid;grid-template-columns:116px 1fr;gap:14px;
  transition:.2s;box-shadow:0 10px 28px rgba(38,53,73,.08)
}
.coleta-shell .code-card:hover,.coleta-shell .code-card.selected{
  border-color:#d2a62d;box-shadow:0 16px 35px rgba(38,53,73,.13)
}
.coleta-shell .qr-wrap{
  width:116px;height:116px;padding:7px;background:#fff;border-radius:10px;
  grid-row:span 2;display:flex;align-items:center;justify-content:center
}

/* O STATUS MARCA APENAS O CONTORNO; O QR E O FUNDO PERMANECEM BRANCOS. */
.coleta-shell .qr-wrap.error{
  background:#fff!important;
  box-shadow:inset 0 0 0 5px #f97316
}
.coleta-shell .qr-wrap.cancelled{
  background:#fff!important;
  box-shadow:inset 0 0 0 5px #ef4444
}
.coleta-shell .qr-wrap.uploaded{
  background:#fff!important;
  box-shadow:inset 0 0 0 5px #439cf7
}
.coleta-shell .qr-wrap svg{
  display:block;
  background:transparent!important
}

.coleta-shell .code-copy{
  display:flex;flex-direction:column;gap:7px;padding-top:4px;min-width:0
}
.coleta-shell .code-copy b{
  font-size:13px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap
}
.coleta-shell .code-copy small{color:var(--muted);font-size:11px}
.coleta-shell .code-card>input{
  position:absolute;right:14px;top:15px;accent-color:#c89818
}
.coleta-shell .badge{
  width:max-content;padding:4px 8px;border-radius:20px;font-style:normal;
  font-size:10px;font-weight:800
}
.coleta-shell .badge.error{color:#d92d20;background:#fff0f0}
.coleta-shell .badge.cancelled{color:#d92d20;background:#fff0f0}
.coleta-shell .badge.warning{color:#c2410c;background:#fff7ed}
.coleta-shell .badge.info{color:#175cd3;background:#eff8ff}
.coleta-shell .code-card .action-row{grid-column:1/-1}
.coleta-shell .action-row{display:flex;flex-wrap:wrap;gap:8px}
.coleta-shell .action-row button{
  min-height:34px;padding:0 10px;font-size:11px
}
.coleta-shell .action-row button.error-status{
  border:1px solid #ea580c;background:#f97316;color:#fff
}
.coleta-shell .action-row button.cancelled-status{
  border:1px solid #dc2626;background:#ef4444;color:#fff
}
.coleta-shell .viewer{
  max-width:780px;margin:34px auto;padding:32px;display:flex;align-items:center;
  flex-direction:column;gap:17px;text-align:center;background:#fff
}
.coleta-shell .viewer .counter{
  color:#a87500;font-size:13px;font-weight:800
}
.coleta-shell .viewer h2{
  margin:0;font-size:20px;color:#17202d
}
.coleta-shell .viewer-nav{display:flex;gap:10px;margin-top:8px}
.coleta-shell .viewer .action-row{justify-content:center}
.coleta-shell .viewer .action-row button{min-height:38px}
.coleta-shell .viewer-keyboard-help{margin:0;color:var(--muted);font-size:12px}
.coleta-shell .viewer-keyboard-help kbd{
  padding:2px 6px;border:1px solid #d0d5dd;border-radius:5px;
  background:#f9fafb;color:#344054;font:inherit;font-weight:700
}

/* QR DA VISUALIZAÇÃO */
.coleta-shell .qr-present{
  padding:22px;border:1px solid #e4e8ee;border-radius:18px;background:#fff;
  box-shadow:0 8px 22px rgba(38,53,73,.10);
  display:flex;align-items:center;justify-content:center;overflow:hidden
}

/* ERRO = CONTORNO LARANJA, SEM PINTAR O FUNDO OU O QR. */
.coleta-shell .viewer .qr-present.error{
  background:#fff!important;
  border:5px solid #f97316!important
}

/* CANCELADO = CONTORNO VERMELHO. */
.coleta-shell .viewer .qr-present.cancelled{
  background:#fff!important;
  border:5px solid #ef4444!important
}

/* SUBIU = CONTORNO AZUL, SEM PINTAR O FUNDO OU O QR. */
.coleta-shell .viewer .qr-present.uploaded{
  background:#fff!important;
  border:5px solid #439cf7!important
}

/* RISCOS DO QR SEMPRE PRETOS */
.coleta-shell .viewer .qr-present svg{
  display:block;
  background:transparent!important
}

@media(max-width:900px){
  .coleta-shell{padding:24px 16px}
  .coleta-shell .page-header{align-items:flex-start;flex-direction:column}
  .coleta-shell .header-actions{width:100%;justify-content:flex-start}
  .coleta-shell .type-grid{grid-template-columns:1fr}
  .coleta-shell .scanner-layout{grid-template-columns:1fr}
  .coleta-shell .scanner-box{min-height:360px;height:52vh}
}
@media(max-width:560px){
  .coleta-shell .header-actions>*{flex:1}
  .coleta-shell .header-actions .search{flex-basis:100%}
  .coleta-shell .collection-grid{grid-template-columns:1fr}
  .coleta-shell .inline-form{flex-wrap:wrap}
  .coleta-shell .inline-form input{flex-basis:100%}
  .coleta-shell .carrier-card{align-items:flex-start;flex-wrap:wrap}
  .coleta-shell .carrier-card select{width:100%;min-width:0}
  .coleta-shell .code-grid{grid-template-columns:1fr}
  .coleta-shell .viewer{padding:22px 14px}
  .coleta-shell .scanner-manual .inline-form{display:block}
  .coleta-shell .scanner-manual .inline-form button{
    width:100%;margin-top:9px
  }
}
`;

function tipo(codigo: string) {
  if (codigo.toUpperCase().startsWith("BR")) return "SHOPEE";
  if (/^\d{11}$/.test(codigo)) return "MERCADO_LIVRE";
  return "AVULSO";
}

function mostrar(codigo: string) {
  try {
    return String(JSON.parse(codigo).external_grouper_code ?? codigo);
  } catch {
    return codigo;
  }
}

function data(v: any) {
  if (!v) return "-";
  const d = v?.toDate ? v.toDate() : new Date(v);
  return Number.isNaN(d.getTime()) ? "-" : d.toLocaleString("pt-BR");
}

function tipoLabel(t: string) {
  return ["MERCADO_LIVRE", "MERCADO LIVRE"].includes(
    t.trim().toUpperCase().replace(/\s+/g, " "),
  )
    ? "Mercado Livre"
    : t === "SHOPEE"
    ? "Shopee"
    : "Avulso";
}

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

        // EXATAMENTE A MESMA REGRA DO DASHBOARD:
        // SOMENTE ADMIN
        // PERMISSÃO DE ACESSO
setAllowed(
  userData?.tipo === "admin" ||
  userData?.permissoes?.coleta === true
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

export default function Coleta() {
  const { checkingAccess, allowed } = usePermission();
  const location = useLocation();
  const navigate = useNavigate();

  const parts = location.pathname.split("/").filter(Boolean);
  const pastaId = decodeRouteSegment(parts[1]);
  const routeSection = decodeRouteSegment(parts[2]);
  const tipoRoute =
    routeSection === "tipo" ? decodeRouteSegment(parts[3]) : undefined;

  // CARREGANDO PERMISSÃO
  if (checkingAccess) {
    return (
      <>
        <style>{COLETA_CSS}</style>

        <div>
          <header
            style={{
              padding: "22px 28px",
              borderBottom: "1px solid #eaecf0",
              background: "#fff",
            }}
          >
            <div>
              <b
                style={{
                  fontSize: "18px",
                  color: "#17202d",
                }}
              >
                Painel Águia Express
              </b>

              <small
                style={{
                  display: "block",
                  marginTop: "6px",
                  color: "#98a2b3",
                }}
              >
                Gestão operacional de entregas
              </small>
            </div>
          </header>

          <main style={{ padding: "28px" }}>
            <div
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
            </div>
          </main>
        </div>
      </>
    );
  }

  // BLOQUEIO PARA NÃO ADMIN
  // VISUAL NO MESMO PADRÃO DO DASHBOARD
  if (!allowed) {
    return (
      <>
        <style>{COLETA_CSS}</style>

        <div>
          <header
            style={{
              padding: "22px 28px",
              borderBottom: "1px solid #eaecf0",
              background: "#fff",
            }}
          >
            <div>
              <b
                style={{
                  fontSize: "18px",
                  color: "#17202d",
                }}
              >
                Painel Águia Express
              </b>

              <small
                style={{
                  display: "block",
                  marginTop: "6px",
                  color: "#98a2b3",
                }}
              >
                Gestão operacional de entregas
              </small>
            </div>
          </header>

          <main style={{ padding: "28px" }}>
            <div
              style={{
                marginBottom: "28px",
              }}
            >
              <h1
                style={{
                  margin: 0,
                  fontSize: "36px",
                  lineHeight: 1.1,
                  color: "#17202d",
                }}
              >
                Acesso restrito
              </h1>

              <p
                style={{
                  marginTop: "10px",
                  color: "#667085",
                }}
              >
                Área exclusiva para administradores.
              </p>
            </div>

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
                  Você não possui permissão para acessar Coleta.
                </p>
              </div>
            </section>
          </main>
        </div>
      </>
    );
  }

  let content: ReactNode;

  if (parts[2] === "scanner") {
    content = (
      <Scanner
        pastaId={pastaId}
        onClose={() => navigate(coletaPath(pastaId))}
      />
    );
  } else if (pastaId && tipoRoute) {
    content = <ListaTipo pastaId={pastaId} tipo={tipoRoute} />;
  } else if (pastaId) {
    content = <PastaDetail pastaId={pastaId} />;
  } else {
    content = <Pastas />;
  }

  return (
    <>
      <style>{COLETA_CSS}</style>
      <main className="coleta-shell">{content}</main>
    </>
  );
}

function Header({ title, subtitle, back = "/coletas", action }: any) {
  return (
    <div className="page-header">
      <div>
        <h1>{title}</h1>
        {subtitle && <p>{subtitle}</p>}
      </div>

      <div className="header-actions">
        {back && (
          <Link className="secondary" to={back}>
            <ArrowLeft size={16} /> Voltar
          </Link>
        )}
        {action}
      </div>
    </div>
  );
}

function Pastas() {
  const [items, setItems] = useState<Pasta[]>([]);
  const [transportadoras, setTransportadoras] = useState<Record<string, number>>({});
  const [newName, setNewName] = useState("");
  const [showNew, setShowNew] = useState(false);

  const navigate = useNavigate();

  useEffect(() => {
    return onSnapshot(
      query(collection(db, "coletas"), orderBy("data", "desc")),
      s => setItems(s.docs.map(x => ({ id: x.id, ...x.data() })))
    );
  }, []);

  useEffect(() => {
    return onSnapshot(
      query(
        collection(db, "controle_codigos"),
        where("status", "in", ["COLETADO", "CANCELADO"])
      ),
      s => {
        const counts: Record<string, number> = {};

        s.docs.forEach(x => {
          const id = x.data().empresa;
          if (id) counts[id] = (counts[id] || 0) + 1;
        });

        setTransportadoras(counts);
      }
    );
  }, []);

  const groups = useMemo(() => {
    const map: Record<string, Pasta[]> = {};

    items.forEach(p => {
      const key = p.transportadoraNome?.trim() || EMPTY;
      (map[key] ||= []).push(p);
    });

    return Object.entries(map).sort(([a], [b]) =>
      a === EMPTY ? 1 : b === EMPTY ? -1 : a.localeCompare(b)
    );
  }, [items]);

  async function create() {
    const name = newName.trim();
    if (!name) return;

    await setDoc(
      doc(db, "coletas", name.toLowerCase().replace(/\s+/g, "_")),
      {
        nome: name,
        data: serverTimestamp(),
      }
    );

    setNewName("");
    setShowNew(false);
  }

  return (
    <div>
      <Header
        title="Coleta"
        subtitle={`${items.length} empresas cadastradas.`}
        action={
          <>
            <button className="primary" onClick={() => setShowNew(true)}>
              <FolderPlus size={16} /> Nova empresa
            </button>

            <button
              className="secondary"
              onClick={() => window.location.reload()}
            >
              <RefreshCw size={16} /> Atualizar
            </button>
          </>
        }
      />

      {showNew && (
        <div className="card inline-form">
          <input
            autoFocus
            value={newName}
            onChange={e => setNewName(e.target.value)}
            placeholder="Nome da empresa"
            onKeyDown={e => e.key === "Enter" && create()}
          />

          <button className="primary" onClick={create}>
            Criar
          </button>

          <button
            className="secondary"
            onClick={() => setShowNew(false)}
          >
            Cancelar
          </button>
        </div>
      )}

      {!groups.length ? (
        <div className="card empty">
          <Folder size={34} />
          <span>Nenhuma empresa cadastrada.</span>
          <button
            className="secondary"
            onClick={() => setShowNew(true)}
          >
            Criar nova empresa
          </button>
        </div>
      ) : (
        groups.map(([group, list]) => (
          <section className="collection-group" key={group}>
            <div className="section-heading">
              <Truck size={16} />
              <b>
                {group === EMPTY
                  ? "SEM TRANSPORTADORA"
                  : group.toUpperCase()}
              </b>
              <small>
                {list.length} empresa{list.length !== 1 ? "s" : ""}
              </small>
            </div>

            <div className="collection-grid">
              {list.map(p => (
                <button
                  className="collection-card"
                  key={p.id}
                  onClick={() => navigate(coletaPath(p.id))}
                >
                  <span className="icon-box gold">
                    <Folder size={21} />
                  </span>

                  <span className="card-copy">
                    <b>{p.nome || p.id}</b>
                    <small>
                      <Package size={13} />
                      {transportadoras[p.id] || 0} pacote
                      {transportadoras[p.id] === 1 ? "" : "s"} coletado
                      {transportadoras[p.id] === 1 ? "" : "s"}
                    </small>
                  </span>

                  <ChevronRight size={19} />
                </button>
              ))}
            </div>
          </section>
        ))
      )}
    </div>
  );
}

function PastaDetail({ pastaId }: { pastaId: string }) {
  const navigate = useNavigate();

  const [pasta, setPasta] = useState<Pasta | null>(null);
  const [codes, setCodes] = useState<Code[]>([]);
  const [transportadoras, setTransportadoras] = useState<any[]>([]);
  const [menuOpen, setMenuOpen] = useState(false);
  const [renaming, setRenaming] = useState(false);
  const [name, setName] = useState("");

  useEffect(() => {
    return onSnapshot(doc(db, "coletas", pastaId), s => {
      const d = s.data();
      setPasta(d ? { id: s.id, ...d } : null);
      setName(d?.nome || "");
    });
  }, [pastaId]);

  useEffect(() => {
    return onSnapshot(
      query(
        collection(db, "controle_codigos"),
        where("empresa", "==", pastaId),
        where("status", "in", ["COLETADO", "CANCELADO"])
      ),
      s =>
        setCodes(
          s.docs.map<Code>(
            x => ({ id: x.id, ...x.data() }) as Code
          )
        )
    );
  }, [pastaId]);

  useEffect(() => {
    getDocs(
      query(
        collection(db, "transportadoras"),
        where("ativo", "==", true),
        orderBy("nome")
      )
    ).then(s =>
      setTransportadoras(
        s.docs.map(x => ({
          id: x.id,
          ...x.data(),
        }))
      )
    );
  }, []);

  if (!pasta) {
    return <div className="empty">Carregando empresa...</div>;
  }

  const counts = {
    MERCADO_LIVRE: 0,
    SHOPEE: 0,
    AVULSO: 0,
  };

  codes.forEach(c => {
    counts[tipo(c.codigo || c.id) as keyof typeof counts]++;
  });

  async function saveName() {
    if (name.trim()) {
      await updateDoc(doc(db, "coletas", pastaId), {
        nome: name.trim(),
      });
    }

    setRenaming(false);
  }

  async function deletePasta() {
    if (!confirm("Esta ação é irreversível. Deseja excluir esta empresa?")) {
      return;
    }

    await deleteDoc(doc(db, "coletas", pastaId));
    navigate("/coletas");
  }

  return (
    <div>
      <Header
        title={String(pasta.nome || pastaId).toUpperCase()}
        subtitle="Painel de coleta da empresa"
        action={
          <>
            <button
              className="secondary"
              onClick={() => navigate(coletaPath(pastaId, "/scanner"))}
            >
              <QrCode size={16} /> Escanear QR
            </button>

            <div className="menu">
              <button
                className="secondary"
                onClick={() => setMenuOpen(v => !v)}
              >
                <MoreVertical size={16} />
              </button>

              {menuOpen && (
                <div className="menu-pop">
                  <button
                    onClick={() => {
                      setRenaming(true);
                      setMenuOpen(false);
                    }}
                  >
                    <Edit3 size={14} /> Renomear
                  </button>

                  <button
                    className="danger-text"
                    onClick={deletePasta}
                  >
                    <Trash2 size={14} /> Excluir empresa
                  </button>
                </div>
              )}
            </div>
          </>
        }
      />

      {renaming && (
        <div className="card inline-form">
          <input
            value={name}
            onChange={e => setName(e.target.value)}
            onKeyDown={e => e.key === "Enter" && saveName()}
          />

          <button className="primary" onClick={saveName}>
            Salvar
          </button>

          <button
            className="secondary"
            onClick={() => setRenaming(false)}
          >
            Cancelar
          </button>
        </div>
      )}

      <div className="card carrier-card">
        <Truck size={21} />

        <div>
          <small>TRANSPORTADORA</small>
          <b>
            {pasta.transportadoraNome || "Selecionar transportadora"}
          </b>
        </div>

        <select
          value={pasta.transportadoraId || ""}
          onChange={async e => {
            const t = transportadoras.find(
              x => x.id === e.target.value
            );

            if (t) {
              await updateDoc(doc(db, "coletas", pastaId), {
                transportadoraId: t.id,
                transportadoraNome: t.nome,
              });
            }
          }}
        >
          <option value="">Selecionar...</option>

          {transportadoras.map(t => (
            <option key={t.id} value={t.id}>
              {t.nome}
            </option>
          ))}
        </select>
      </div>

      <div className="stat-strip">
        <b>
          <Package size={17} /> {codes.length} pacotes coletados
        </b>
      </div>

      <div className="section-heading">
        <span></span>
        <b>TIPOS DE COLETA</b>
      </div>

      <div className="type-grid">
        {[
          ["MERCADO_LIVRE", "Mercado Livre", "yellow"],
          ["SHOPEE", "Shopee", "orange"],
          ["AVULSO", "Avulso", "blue"],
        ].map(([t, label, color]) => (
          <button
            className={`type-card ${color}`}
            key={t}
            onClick={() =>
              navigate(coletaPath(pastaId, `/tipo/${encodeURIComponent(t)}`))
            }
          >
            <span className="icon-box">
              <Package size={21} />
            </span>

            <span>
              <b>{label}</b>
              <small>
                {counts[t as keyof typeof counts]} pacote
                {counts[t as keyof typeof counts] === 1 ? "" : "s"}
              </small>
            </span>

            <ChevronRight size={18} />
          </button>
        ))}
      </div>
    </div>
  );
}

function Scanner({
  pastaId,
  onClose,
}: {
  pastaId: string;
  onClose: () => void;
}) {
  const [raw, setRaw] = useState("");
  const [last, setLast] = useState("");
  const [codes, setCodes] = useState<PendingCollectionCode[]>([]);
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);
  const hidInput = useRef<HTMLInputElement>(null);
  const hidBuffer = useRef("");
  const hidTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const processing = useRef(new Set<string>());
  const codesRef = useRef(new Set<string>());

  useEffect(() => {
    const focusInput = () => hidInput.current?.focus();
    focusInput();
    const focusTimer = window.setTimeout(focusInput, 100);
    return () => {
      window.clearTimeout(focusTimer);
      if (hidTimer.current) clearTimeout(hidTimer.current);
    };
  }, []);

  async function save(input: string) {
    const scanned = extractScannedCode(input);
    const codigo = scanned?.code.toUpperCase().replace(/\s/g, "").trim() || "";
    if (!codigo) {
      setMessage("Não consegui extrair o código original. Bipe novamente.");
      return;
    }

    hidBuffer.current = "";
    setRaw("");
    if (hidInput.current) hidInput.current.value = "";

    if (codesRef.current.has(codigo) || processing.current.has(codigo)) {
      setMessage(`QR já lido: ${codigo}`);
      return;
    }

    processing.current.add(codigo);
    try {
      const existing = await getDoc(
        doc(db, "controle_codigos", codigo)
      ).catch(() => null);

      if (
        existing?.exists() &&
        existing.data()?.status !== "COLETADO"
      ) {
        setMessage(`QR já existe: ${codigo}`);
        return;
      }

      const fields = scanned?.fields ?? {};
      const declaredType = `${fields.tipo || ""} ${fields.type || ""} ${fields.service_name || ""}`.toUpperCase();
      const packageType =
        /MERCADO[_ ]?LIVRE/.test(declaredType) ||
        Boolean(fields.sender_id) ||
        /^\d{11}$/.test(codigo)
          ? "MERCADO LIVRE"
          : /SHOPEE/.test(declaredType) || /^BR[A-Z0-9]+$/i.test(codigo)
            ? "SHOPEE"
            : tipo(codigo);

      codesRef.current.add(codigo);
      setCodes(current => [
        { id: codigo, type: packageType, raw: scanned?.raw ?? input },
        ...current,
      ]);
      setLast(codigo);
      setMessage("QR lido. Confirme a coleta para gravar os pacotes.");
    } catch (error) {
      console.error("Falha ao validar pacote bipado:", error);
      setMessage(`Não foi possível verificar ${codigo}. Tente novamente.`);
    } finally {
      processing.current.delete(codigo);
      hidInput.current?.focus();
    }
  }

  async function confirmCollection() {
    if (!codes.length || saving) return;
    setSaving(true);
    const committed: string[] = [];
    try {
      for (let offset = 0; offset < codes.length; offset += 200) {
        const chunk = codes.slice(offset, offset + 200);
        const batch = writeBatch(db);
        for (const item of chunk) {
          batch.set(
            doc(db, "controle_codigos", item.id),
            {
              codigo: item.id,
              status: "COLETADO",
              usuario: auth.currentUser?.email,
              empresa: pastaId,
              tipo: item.type,
              raw: item.raw,
              erro: false,
              cancelado: false,
              subiu: false,
              data: serverTimestamp(),
              historico: [
                {
                  status: "COLETADO",
                  dataHora: new Date(),
                },
              ],
            },
            { merge: true },
          );
          batch.set(
            doc(db, "coletas", pastaId, "codigos", item.id),
            {
              codigo: item.id,
              data: serverTimestamp(),
            },
            { merge: true },
          );
        }
        await batch.commit();
        committed.push(...chunk.map(item => item.id));
        setCodes(current =>
          current.filter(item => !committed.includes(item.id)),
        );
      }

      setMessage("Coleta confirmada e gravada.");
      onClose();
    } catch (error) {
      console.error("Falha ao confirmar coleta:", error);
      setMessage(
        committed.length
          ? "Parte da coleta foi gravada. Os QR restantes continuam pendentes."
          : "Não foi possível gravar a coleta. Os QR continuam pendentes.",
      );
    } finally {
      setSaving(false);
    }
  }

  function onHidInput(value: string) {
    hidBuffer.current = value;
    setRaw(value);
    if (hidTimer.current) clearTimeout(hidTimer.current);

    const candidate = value.trim();
    const completeJson =
      candidate.startsWith("{") && candidate.endsWith("}");
    const completeHidJson =
      candidate.startsWith("ˋ") && candidate.endsWith("{");

    if (completeJson || completeHidJson) {
      void save(value);
      return;
    }

    hidTimer.current = setTimeout(() => {
      if (hidBuffer.current.trim() === candidate && candidate) {
        void save(candidate);
      }
    }, 90);
  }

  return (
    <div>
      <Header
        title="Scanner coleta"
        subtitle={`${codes.length} pacote${codes.length === 1 ? "" : "s"} lido${codes.length === 1 ? "" : "s"}`}
        back={coletaPath(pastaId)}
      />

      <div className="scanner-layout">
        <div
          className="scanner-box"
          onClick={() => hidInput.current?.focus()}
          role="status"
          aria-live="polite"
        >
          <div className="hid-scanner-icon"><QrCode size={42} /></div>
          <div className="hid-scanner-title">Leitor HID pronto</div>
          <p className="hid-scanner-copy">
            Bipe o QR original com a pistola. O sistema extrai o código correto
            — incluindo o ID do Mercado Livre quando o leitor envia o JSON.
          </p>
          <div className="hid-scanner-state">
            {message || "Aguardando leitura da pistola"}
          </div>
        </div>

        <div className="card scanner-manual">
          <h3>Pistola HID</h3>
          <p className="feedback">
            A leitura é capturada diretamente pelo teclado HID. Não é necessário
            abrir a câmera nem digitar o código manualmente.
          </p>
          {raw && (
            <p className="feedback" title={raw}>
              Leitura recebida; identificando o código do pacote…
            </p>
          )}
          <input
            ref={hidInput}
            className="hid-input"
            aria-label="Entrada da pistola HID"
            autoComplete="off"
            autoCapitalize="off"
            spellCheck={false}
            value={raw}
            onChange={event => onHidInput(event.target.value)}
            onKeyDown={event => {
              if (event.key === "Enter" || event.key === "Tab") {
                event.preventDefault();
                if (hidTimer.current) clearTimeout(hidTimer.current);
                const captured = hidBuffer.current;
                if (captured.trim()) void save(captured);
              }
            }}
            onBlur={() => window.setTimeout(() => hidInput.current?.focus(), 80)}
          />

          <div className="scan-list">
            {codes.map(item => (
              <div key={item.id}>
                <span>
                  <QrCode size={15} />
                  {item.id}
                  <small>{tipoLabel(item.type)}</small>
                </span>
                <small>PENDENTE</small>
              </div>
            ))}
          </div>

          <button
            className="primary full"
            onClick={() => void confirmCollection()}
            disabled={!codes.length || saving}
          >
            {saving
              ? "Gravando coleta..."
              : `Confirmar coleta${codes.length ? ` · ${codes.length}` : ""}`}
          </button>
        </div>
      </div>

      <p className="last-scan">
        {last && (
          <>
            Último: <b>{last}</b>
          </>
        )}
      </p>
    </div>
  );
}

type FiltroStatus = "todos" | "branco" | "azul" | "vermelho";

function compararPelaEntrada(a: Code, b: Code) {
  const timestamp = (value: any) => {
    if (value?.toMillis) return value.toMillis();
    if (value?.toDate) return value.toDate().getTime();

    const parsed = new Date(value).getTime();
    return Number.isNaN(parsed) ? null : parsed;
  };

  const dataA = timestamp(a.data);
  const dataB = timestamp(b.data);

  if (dataA !== null && dataB !== null && dataA !== dataB) {
    return dataA - dataB;
  }

  if (dataA !== null && dataB === null) return -1;
  if (dataA === null && dataB !== null) return 1;

  return a.id.localeCompare(b.id);
}

function fazParteDoFiltro(item: Code, filtro: FiltroStatus) {
  const erro = item.erro === true;
  const subiu = item.subiu === true;

  if (filtro === "branco") return !erro && !subiu;
  if (filtro === "azul") return subiu;
  if (filtro === "vermelho") return erro;
  return true;
}

function classeStatusQr(item: Code) {
  if (
    item.cancelado === true ||
    String(item.status || "").toUpperCase() === "CANCELADO"
  ) {
    return "cancelled";
  }
  if (item.erro === true) return "error";
  if (item.subiu === true) return "uploaded";
  return "";
}

function ListaTipo({
  pastaId,
  tipo: filter,
}: {
  pastaId: string;
  tipo: string;
}) {
  const [items, setItems] = useState<Code[]>([]);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<string[]>([]);
  const [visual, setVisual] = useState(false);
  const [index, setIndex] = useState(0);
  const [filtroStatus, setFiltroStatus] = useState<FiltroStatus>("todos");
  const codigoPendente = useRef<string | null>(null);
  const statusEmAtualizacao = useRef(false);

  useEffect(() => {
    return onSnapshot(
      query(
        collection(db, "controle_codigos"),
        where("empresa", "==", pastaId),
        where("status", "in", ["COLETADO", "CANCELADO"])
      ),
      s => {
        setItems(
          s.docs
            .map<Code>(
              x => ({ id: x.id, ...x.data() }) as Code
            )
            .filter(
              x => tipo(x.codigo || x.id) === filter
            )
            .sort(compararPelaEntrada)
        );
      }
    );
  }, [pastaId, filter]);

  const filtered = useMemo(() => {
    const term = search
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, "");

    return items.filter(x => {
      const codigo = String(x.id)
        .toUpperCase()
        .replace(/[^A-Z0-9]/g, "");

      if (term && !codigo.includes(term)) return false;
      return fazParteDoFiltro(x, filtroStatus);
    });
  }, [items, search, filtroStatus]);

  const numerosOriginais = useMemo(
    () => new Map(items.map((item, itemIndex) => [item.id, itemIndex + 1])),
    [items]
  );
  const totalOriginal = items.length;

  useEffect(() => {
    const pendente = codigoPendente.current;

    if (pendente) {
      const destino = filtered.findIndex(item => item.id === pendente);

      if (destino >= 0) {
        codigoPendente.current = null;
        setIndex(destino);
        return;
      }
    }

    setIndex(currentIndex => {
      if (!filtered.length) return 0;
      return Math.min(Math.max(currentIndex, 0), filtered.length - 1);
    });
  }, [filtered]);

  const current = filtered[index] || null;

  useEffect(() => {
    if (!visual) return;

    function handleViewerNavigation(event: KeyboardEvent) {
      const target = event.target as HTMLElement | null;
      const isEditing =
        target?.isContentEditable ||
        ["INPUT", "TEXTAREA", "SELECT"].includes(target?.tagName ?? "");
      if (
        isEditing ||
        event.altKey ||
        event.ctrlKey ||
        event.metaKey
      ) {
        return;
      }

      if (event.key === "ArrowLeft") {
        event.preventDefault();
        setIndex(currentIndex => Math.max(0, currentIndex - 1));
      } else if (event.key === "ArrowRight") {
        event.preventDefault();
        setIndex(currentIndex =>
          Math.min(filtered.length - 1, currentIndex + 1)
        );
      } else if (current) {
        const key = event.key.toLowerCase();
        const field: "erro" | "cancelado" | "subiu" | null =
          event.code === "Space" || event.key === " "
            ? "subiu"
            : key === "r"
              ? "erro"
              : key === "c"
                ? "cancelado"
                : null;

        if (field && !event.repeat) {
          event.preventDefault();
          void markCurrent(field);
        }
      }
    }

    window.addEventListener("keydown", handleViewerNavigation);
    return () => window.removeEventListener("keydown", handleViewerNavigation);
  }, [visual, filtered, index, current?.id, filtroStatus]);

  async function mark(
    id: string,
    field: "erro" | "cancelado" | "subiu"
  ) {
    if (!id) return;

    const updates =
      field === "cancelado"
        ? { cancelado: true, erro: true, subiu: false }
        : field === "erro"
          ? { cancelado: false, erro: true, subiu: false }
          : { status: "COLETADO", cancelado: false, erro: false, subiu: true };

    await updateDoc(doc(db, "controle_codigos", id), updates);

    setSelected(v => v.filter(x => x !== id));
  }

  async function markCurrent(
    field: "erro" | "cancelado" | "subiu"
  ) {
    if (!current || statusEmAtualizacao.current) return;
    statusEmAtualizacao.current = true;

    const proximo = filtered[index + 1];
    const anterior = filtered[index - 1];

    if (proximo) {
      codigoPendente.current = proximo.id;
    } else if (filtroStatus === "branco" && anterior) {
      codigoPendente.current = anterior.id;
    } else {
      codigoPendente.current = null;
    }

    try {
      await mark(current.id, field);
      setVisual(true);
    } catch {
      codigoPendente.current = null;
      alert("Não foi possível atualizar o status do pacote.");
    } finally {
      statusEmAtualizacao.current = false;
    }
  }

  async function transfer() {
    const dest = prompt("ID da pasta de destino");

    if (!dest) return;

    await Promise.all(
      selected.map(id =>
        updateDoc(doc(db, "controle_codigos", id), {
          empresa: dest,
        })
      )
    );

    setSelected([]);
  }

  async function copy(id: string) {
    try {
      await navigator.clipboard.writeText(id);
    } catch {
      const area = document.createElement("textarea");
      area.value = id;
      document.body.appendChild(area);
      area.select();
      document.execCommand("copy");
      area.remove();
    }

    alert("Código copiado");
  }

  function openVisual(code: Code) {
    const i = filtered.findIndex(x => x.id === code.id);

    setIndex(i >= 0 ? i : 0);
    setVisual(true);
  }

  return (
    <div>
      <Header
        title={tipoLabel(filter)}
        subtitle={`${filtered.length} pacotes nesta categoria`}
        back={coletaPath(pastaId)}
        action={
          <>
            <div className="search compact">
              <Search size={16} />

              <input
                value={search}
                onChange={e => {
                  setSearch(e.target.value);
                  setIndex(0);
                }}
                placeholder="Buscar código..."
              />
            </div>

            <select
              aria-label="Filtro por cor"
              value={filtroStatus}
              onChange={e => {
                setFiltroStatus(e.target.value as FiltroStatus);
                codigoPendente.current = null;
                setIndex(0);
              }}
            >
              <option value="todos">TODOS</option>
              <option value="branco">BRANCO</option>
              <option value="azul">AZUL</option>
              <option value="vermelho">VERMELHO</option>
            </select>

            <button
              className="secondary"
              onClick={() => {
                if (!visual) setIndex(0);
                setVisual(v => !v);
              }}
            >
              {visual ? <List size={16} /> : <LayoutGrid size={16} />}
              {visual ? "Lista" : "Visualizar"}
            </button>

            {selected.length > 0 && (
              <button
                className="secondary"
                onClick={transfer}
              >
                <Send size={16} /> Transferir
              </button>
            )}
          </>
        }
      />

      {visual ? (
        <div className="viewer card">
          {current ? (
            <>
              <span className="counter">
                {numerosOriginais.get(current.id) ?? "-"} / {totalOriginal}
              </span>

              <div
                className={`qr-present ${classeStatusQr(current)}`}
              >
                <QRCodeSVG
                  value={
                    current.raw ||
                    current.codigo ||
                    current.id
                  }
                  size={280}
                  level="H"
                  includeMargin
                  bgColor="transparent"
                  fgColor="#000000"
                />
              </div>

              <h2>
                {mostrar(current.codigo || current.id)}
              </h2>

              <div className="action-row">
                <button
                  className="secondary"
                  onClick={() =>
                    copy(current.codigo || current.id)
                  }
                >
                  <Copy size={15} /> COPIAR
                </button>

                <button
                  className="error-status"
                  onClick={() => markCurrent("erro")}
                >
                  ERRO
                </button>

                <button
                  className="cancelled-status"
                  onClick={() => markCurrent("cancelado")}
                >
                  CANCELADO
                </button>

                <button
                  className="info"
                  onClick={() => markCurrent("subiu")}
                >
                  <Upload size={15} /> SUBIU
                </button>
              </div>

              <p className="viewer-keyboard-help">
                Atalhos: <kbd>Espaço</kbd> Subiu · <kbd>R</kbd> Erro ·{" "}
                <kbd>C</kbd> Cancelado
              </p>

              <div className="viewer-nav">
                <button
                  className="secondary"
                  disabled={index <= 0}
                  onClick={() =>
                    setIndex(i => Math.max(0, i - 1))
                  }
                >
                  Anterior
                </button>

                <button
                  className="secondary"
                  disabled={
                    index >= filtered.length - 1
                  }
                  onClick={() =>
                    setIndex(i =>
                      Math.min(
                        filtered.length - 1,
                        i + 1
                      )
                    )
                  }
                >
                  Próximo
                </button>
              </div>
            </>
          ) : (
            <div className="empty">
              Nenhum pacote encontrado.
            </div>
          )}
        </div>
      ) : (
        <div className="code-grid">
          {filtered.map(c => (
            <article
              className={`code-card ${
                selected.includes(c.id)
                  ? "selected"
                  : ""
              }`}
              key={c.id}
              onClick={() => openVisual(c)}
            >
              <div
                className={`qr-wrap ${classeStatusQr(c)}`}
              >
                <QRCodeSVG
                  value={
                    c.raw ||
                    c.codigo ||
                    c.id
                  }
                  size={112}
                  level="H"
                  includeMargin
                  bgColor="transparent"
                  fgColor="#000000"
                />
              </div>

              <div className="code-copy">
                <small>Nº {numerosOriginais.get(c.id) ?? "-"}</small>

                <b>
                  {mostrar(c.codigo || c.id)}
                </b>

                <small>{data(c.data)}</small>

                {c.erro && (
                  <em
                    className={`badge ${
                      c.cancelado === true ||
                      String(c.status || "").toUpperCase() === "CANCELADO"
                        ? "cancelled"
                        : "warning"
                    }`}
                  >
                    {c.cancelado === true ||
                    String(c.status || "").toUpperCase() === "CANCELADO"
                      ? "CANCELADO"
                      : "ERRO"}
                  </em>
                )}

                {c.subiu && (
                  <em className="badge info">
                    SUBIU
                  </em>
                )}
              </div>

              <input
                type="checkbox"
                checked={selected.includes(c.id)}
                onClick={e => e.stopPropagation()}
                onChange={e =>
                  setSelected(v =>
                    e.target.checked
                      ? [...v, c.id]
                      : v.filter(x => x !== c.id)
                  )
                }
              />

              <div className="action-row">
                <button
                  className="error-status"
                  onClick={e => {
                    e.stopPropagation();
                    mark(c.id, "erro");
                  }}
                >
                  ERRO
                </button>

                <button
                  className="cancelled-status"
                  onClick={e => {
                    e.stopPropagation();
                    mark(c.id, "cancelado");
                  }}
                >
                  CANCELADO
                </button>

                <button
                  className="info"
                  onClick={e => {
                    e.stopPropagation();
                    mark(c.id, "subiu");
                  }}
                >
                  <Upload size={15} /> SUBIU
                </button>
              </div>
            </article>
          ))}

          {!filtered.length && (
            <div className="card empty">
              Nenhum pacote encontrado.
            </div>
          )}
        </div>
      )}
    </div>
  );
}