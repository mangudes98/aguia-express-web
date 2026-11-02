import { useEffect, useMemo, useRef, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
import {
  Timestamp,
  arrayUnion,
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  writeBatch,
} from "firebase/firestore";
import { QRCodeSVG } from "qrcode.react";
import {
  AlertTriangle,
  Check,
  Clipboard,
  LoaderCircle,
  Printer,
  QrCode,
  Search,
  ShieldAlert,
  Truck,
  UserRound,
  X,
} from "lucide-react";
import { auth, db } from "../services/firebase/firebase";
import labelTemplate from "../assets/package_label_template.png";
import {
  extractScannedCode,
  type ScannedCode,
} from "../services/packageTransferHid";

type Destination = { id: string; name: string };
type Folder = { id: string; name: string; companyName: string; data: any };
type ScannedPackage = {
  id: string;
  code: string;
  raw: string;
  type: string;
  status: string;
  data: Record<string, any>;
  order: number;
};
type ScreenMode = "transfer" | "create";
type PackageType = "MERCADO LIVRE" | "SHOPEE" | "MAGALU" | "AVULSO";

const packageTypes: PackageType[] = [
  "MERCADO LIVRE",
  "SHOPEE",
  "MAGALU",
  "AVULSO",
];

function labelType(value: unknown): PackageType | string {
  const type = String(value || "AVULSO").trim().toUpperCase();
  if (type === "MERCADO_LIVRE" || type === "MERCADO LIVRE") {
    return "MERCADO LIVRE";
  }
  if (type === "SHOPEE") return "SHOPEE";
  if (type === "MAGALU" || type === "MAGAZINE LUIZA") return "MAGALU";
  return type || "AVULSO";
}

function readableType(data: Record<string, any>, scan: ScannedCode) {
  if (data.tipo) return labelType(data.tipo);
  const rawType = labelType(scan.fields.tipo || scan.fields.type);
  if (rawType !== "AVULSO") return rawType;
  if (scan.fields.sender_id) return "MERCADO LIVRE";
  if (/^BR[A-Z0-9]+$/i.test(scan.code)) return "SHOPEE";
  return "AVULSO";
}

function canManagePackages(userData: Record<string, any>) {
  if (String(userData.tipo || "").toLowerCase() === "admin") return true;
  if (String(userData.tipo || "").toLowerCase() !== "operador") return false;

  const permissions = userData.permissoes || {};
  return (
    permissions.editarPacote === true ||
    permissions.editar_pacote === true ||
    permissions.operacao?.editar_pacote === true ||
    permissions.operacao?.editarPacote === true
  );
}

function formatStatus(status: string) {
  const normalized = status.toUpperCase();
  if (normalized === "CANCELADO") return "CANCELADO";
  if (normalized === "COLETADO") return "COLETADO";
  if (normalized === "ROTA") return "EM ROTA";
  if (normalized === "AUSENTE") return "AUSENTE";
  if (normalized === "ENTREGUE") return "ENTREGUE";
  return status || "SEM STATUS";
}

function playScanFeedback(success: boolean) {
  try {
    navigator.vibrate?.(success ? 45 : [50, 40, 50]);
    const context = new AudioContext();
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.frequency.value = success ? 880 : 280;
    gain.gain.value = 0.045;
    oscillator.connect(gain);
    gain.connect(context.destination);
    oscillator.start();
    oscillator.stop(context.currentTime + (success ? 0.09 : 0.16));
    oscillator.onended = () => void context.close();
  } catch {
    // A vibração e o som dependem do suporte do navegador/dispositivo.
  }
}

const styles = `
.package-manager{color:#172033}
.pm-head{display:flex;align-items:flex-start;justify-content:space-between;gap:18px;margin:4px 0 18px}
.pm-head h2{margin:0;font-size:22px;letter-spacing:-.03em}
.pm-head p{margin:7px 0 0;color:#667085;font-size:13px}
.pm-switch{display:flex;gap:8px;flex-wrap:wrap;margin-bottom:18px}
.pm-switch button,.pm-button{display:inline-flex;align-items:center;justify-content:center;gap:8px;border:1px solid #d8dee8;background:#fff;color:#263244;border-radius:10px;padding:10px 14px;font-weight:750;transition:transform .16s ease,box-shadow .16s ease,background .16s ease}
.pm-switch button:hover,.pm-button:hover{transform:translateY(-1px);box-shadow:0 5px 15px #14213d12}
.pm-switch button.active,.pm-button.primary{background:#111827;color:#fff;border-color:#111827}
.pm-button:disabled{opacity:.55;cursor:not-allowed;transform:none;box-shadow:none}
.pm-panel{background:#fff;border:1px solid #e6eaf0;border-radius:16px;padding:20px;box-shadow:0 10px 28px #14213d08}
.pm-field{display:flex;flex-direction:column;gap:7px;min-width:0}
.pm-field label{font-size:11px;color:#667085;font-weight:800;text-transform:uppercase;letter-spacing:.04em}
.pm-field input,.pm-field select,.pm-field textarea{width:100%;min-height:42px;border:1px solid #d8dee8;border-radius:9px;background:#fff;padding:10px 12px;color:#182230;outline:none}
.pm-field textarea{min-height:78px;resize:vertical}
.pm-field input:focus,.pm-field select:focus,.pm-field textarea:focus{border-color:#a87500;box-shadow:0 0 0 3px #a875001a}
.pm-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:14px}
.pm-span{grid-column:1/-1}
.pm-destinations{display:grid;gap:7px;max-height:240px;overflow:auto;margin-top:8px}
.pm-destination{width:100%;display:flex;align-items:center;justify-content:space-between;gap:10px;padding:11px 12px;border:1px solid #e6eaf0;border-radius:10px;background:#fff;text-align:left;color:#172033}
.pm-destination:hover{border-color:#a87500;background:#fffaf0}
.pm-destination small{display:block;color:#667085;margin-top:3px}
.pm-destination.selected{border-color:#138a52;background:#f1fbf5}
.pm-guide{display:flex;align-items:flex-start;gap:11px;padding:13px 14px;background:#f7f8fa;border:1px solid #e9edf2;border-radius:12px;color:#536174;font-size:13px;line-height:1.45}
.pm-guide svg{flex:0 0 auto;color:#a87500}
.pm-scan{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:14px;align-items:center;margin-top:14px;padding:16px;border:1px dashed #b9c1cf;border-radius:14px;background:#fafbfd}
.pm-scan strong{display:block;font-size:15px}
.pm-scan small{display:block;color:#667085;margin-top:4px}
.pm-count{min-width:78px;text-align:center;border-radius:12px;padding:9px 12px;background:#111827;color:#fff}
.pm-count b{display:block;font-size:24px;line-height:1.1}
.pm-count small{color:#d0d5dd}
.pm-message{margin-top:12px;padding:11px 13px;border-radius:10px;font-size:13px;font-weight:700;background:#eff8ff;color:#175cd3}
.pm-message.error{background:#fff3ed;color:#c2410c}
.pm-message.success{background:#ecfdf3;color:#067647}
.pm-blocked{display:flex;align-items:flex-start;justify-content:space-between;gap:12px;margin-top:12px;padding:14px;border:1px solid #fecaca;border-radius:12px;background:#fff6f6}
.pm-blocked strong{display:block;color:#b42318}
.pm-blocked p{margin:5px 0;color:#5c6676;font-size:13px}
.pm-list{display:grid;gap:9px;margin-top:16px}
.pm-package{display:grid;grid-template-columns:50px minmax(0,1fr) auto;gap:12px;align-items:center;border:1px solid #e6eaf0;border-radius:12px;padding:10px 12px}
.pm-package svg{max-width:48px;height:auto}
.pm-package strong{display:block;overflow-wrap:anywhere}
.pm-package small{display:block;margin-top:4px;color:#667085}
.pm-pill{padding:5px 8px;border-radius:999px;background:#eff8ff;color:#175cd3;font-size:10px;font-weight:800;white-space:nowrap}
.pm-actions{display:flex;justify-content:flex-end;gap:9px;flex-wrap:wrap;margin-top:18px}
.pm-empty{padding:24px;text-align:center;color:#667085;border:1px dashed #d7dee8;border-radius:12px}
.pm-label{position:relative;width:min(100%,340px);aspect-ratio:2/3;overflow:hidden;margin:18px auto 0;background:#fff;border:1px solid #d7dce4;border-radius:7px;box-shadow:0 12px 30px #15223820}
.pm-label-bg{position:absolute;inset:0;width:100%;height:100%;object-fit:fill}
.pm-label-value{position:absolute;overflow:hidden;white-space:pre-line;line-height:1.12;font-family:Arial,Helvetica,sans-serif;font-weight:800;color:#111;display:flex;align-items:center}
.pm-label-qr{position:absolute;left:30.47%;top:21.68%;width:39.06%;height:26.04%;display:grid;place-items:center;background:#fff;padding:.7%}
.pm-label-qr svg{width:100%;height:100%}
.pm-label-type{left:19.72%;top:16.08%;width:21.4%;height:3.2%;font-size:2.7mm}
.pm-label-id{left:70.9%;top:16.08%;width:23.8%;height:3.2%;font-size:2.7mm}
.pm-label-company{left:22.3%;top:53.25%;width:72.5%;height:4.4%;font-size:2.8mm}
.pm-label-address{left:22.3%;top:62.9%;width:72.5%;height:9.5%;font-size:2.65mm;align-items:flex-start}
.pm-label-recipient{left:20.5%;top:78%;width:74%;height:3.5%;font-size:2.75mm}
.pm-label-note{left:20.3%;top:84.4%;width:74%;height:7.2%;font-size:2.45mm;align-items:flex-start;font-weight:600}
.pm-warning{display:flex;gap:10px;align-items:flex-start;padding:12px 14px;margin-top:14px;border-radius:10px;background:#fffaeb;color:#93370d;font-size:12px;line-height:1.5}
.pm-label-print-target{position:relative}
.package-manager .spin{animation:pm-spin .8s linear infinite}
@keyframes pm-spin{to{transform:rotate(360deg)}}
@media(max-width:720px){.pm-grid{grid-template-columns:1fr}.pm-span{grid-column:auto}.pm-head{flex-direction:column}.pm-scan{grid-template-columns:1fr auto}.pm-panel{padding:15px}.pm-package{grid-template-columns:44px minmax(0,1fr)}.pm-package>.pm-pill{grid-column:2}}
@media print{
  @page{size:100mm 150mm;margin:0}
  html,body{width:100mm!important;height:150mm!important;margin:0!important;padding:0!important;background:#fff!important}
  body *{visibility:hidden!important}
  .pm-label,.pm-label *{visibility:visible!important}
  .pm-label{position:fixed!important;left:0!important;top:0!important;width:100mm!important;height:150mm!important;margin:0!important;border:0!important;border-radius:0!important;box-shadow:none!important;overflow:hidden!important;print-color-adjust:exact;-webkit-print-color-adjust:exact}
}
`;

export default function GerenciarPacotes() {
  const [mode, setMode] = useState<ScreenMode>("transfer");
  const [allowed, setAllowed] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);
  const [users, setUsers] = useState<Destination[]>([]);
  const [folders, setFolders] = useState<Folder[]>([]);
  const [destinationQuery, setDestinationQuery] = useState("");
  const [destination, setDestination] = useState<Destination | null>(null);
  const [packages, setPackages] = useState<ScannedPackage[]>([]);
  const [pendingCodes, setPendingCodes] = useState<string[]>([]);
  const [hidValue, setHidValue] = useState("");
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState<"info" | "error" | "success">("info");
  const [blocked, setBlocked] = useState<{
    code: string;
    raw: string;
    status: string;
  } | null>(null);
  const [savingTransfer, setSavingTransfer] = useState(false);
  const [savingQr, setSavingQr] = useState(false);
  const [label, setLabel] = useState<{
    code: string;
    type: string;
    company: string;
    address: string;
    recipient: string;
    note: string;
  } | null>(null);
  const [code, setCode] = useState("");
  const [packageType, setPackageType] = useState<PackageType>("AVULSO");
  const [folderId, setFolderId] = useState("");
  const [cep, setCep] = useState("");
  const [street, setStreet] = useState("");
  const [district, setDistrict] = useState("");
  const [number, setNumber] = useState("");
  const [city, setCity] = useState("");
  const [recipient, setRecipient] = useState("");
  const [note, setNote] = useState("");
  const [lookingUpCep, setLookingUpCep] = useState(false);

  const hidInput = useRef<HTMLInputElement>(null);
  const hidBuffer = useRef("");
  const hidTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const processing = useRef(new Set<string>());
  const packageOrder = useRef(0);
  const audioContext = useRef<AudioContext | null>(null);
  const printLabel = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let active = true;
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user?.email) {
        if (active) {
          setAllowed(false);
          setLoading(false);
        }
        return;
      }

      try {
        const userRef = doc(db, "usuarios", user.email.trim().toLowerCase());
        const userSnapshot = await getDoc(userRef);
        const userData = userSnapshot.exists() ? userSnapshot.data() : {};
        if (!active) return;
        const canManage = canManagePackages(userData);
        setAllowed(canManage);
        if (!canManage) {
          setLoading(false);
          return;
        }

        const [userSnapshotList, folderSnapshotList] = await Promise.all([
          getDocs(collection(db, "usuarios")),
          getDocs(collection(db, "coletas")),
        ]);
        if (!active) return;

        setUsers(
          userSnapshotList.docs
            .map((item) => {
              const data = item.data();
              return {
                id: item.id,
                name: String(data.nome || data.email || item.id),
              };
            })
            .sort((a, b) => a.name.localeCompare(b.name, "pt-BR")),
        );
        setFolders(
          folderSnapshotList.docs
            .map((item) => {
              const data = item.data();
              const name = String(data.nome || item.id);
              return {
                id: item.id,
                name,
                companyName: String(data.empresaNome || data.nomeEmpresa || name),
                data,
              };
            })
            .sort((a, b) => a.name.localeCompare(b.name, "pt-BR")),
        );
      } catch (error) {
        console.error("Falha ao carregar gerenciamento de pacotes:", error);
        if (active) {
          setAllowed(false);
          setMessage("Não foi possível carregar os dados de gerenciamento.");
          setMessageType("error");
        }
      } finally {
        if (active) setLoading(false);
      }
    });

    return () => {
      active = false;
      unsubscribe();
      if (hidTimer.current) clearTimeout(hidTimer.current);
      void audioContext.current?.close();
    };
  }, []);

  const filteredUsers = useMemo(() => {
    const search = destinationQuery.trim().toLocaleLowerCase("pt-BR");
    if (!search) return [];
    return users
      .filter(
        (user) =>
          user.name.toLocaleLowerCase("pt-BR").includes(search) ||
          user.id.toLocaleLowerCase("pt-BR").includes(search),
      )
      .slice(0, 20);
  }, [destinationQuery, users]);

  const selectedFolder = folders.find((folder) => folder.id === folderId);
  const isBusy = pendingCodes.length > 0 || savingTransfer;
  const scannedCount = packages.length;

  useEffect(() => {
    if (mode !== "transfer" || !destination || blocked) return;
    const handle = window.setTimeout(() => hidInput.current?.focus(), 30);
    return () => window.clearTimeout(handle);
  }, [destination, mode, blocked]);

  function setFeedback(text: string, type: "info" | "error" | "success" = "info") {
    setMessage(text);
    setMessageType(type);
  }

  function feedbackBeep(success: boolean) {
    try {
      navigator.vibrate?.(success ? 45 : [50, 40, 50]);
      const Context = window.AudioContext;
      if (!Context) return;
      const context = audioContext.current || new Context();
      audioContext.current = context;
      if (context.state === "suspended") void context.resume();
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      oscillator.frequency.value = success ? 880 : 280;
      gain.gain.value = 0.045;
      oscillator.connect(gain);
      gain.connect(context.destination);
      oscillator.start();
      oscillator.stop(context.currentTime + (success ? 0.09 : 0.16));
    } catch {
      playScanFeedback(success);
    }
  }

  async function addScannedPackage(
    raw: string,
    allowCancelled = false,
    skipBlockedCheck = false,
  ) {
    const scanned = extractScannedCode(raw);
    if (!scanned?.code) {
      feedbackBeep(false);
      setFeedback("Não consegui extrair o código lido. Tente bipar novamente.", "error");
      return;
    }
    const packageCode = scanned.code.trim();
    hidBuffer.current = "";
    setHidValue("");
    if (hidInput.current) hidInput.current.value = "";
    if (blocked && !skipBlockedCheck) {
      feedbackBeep(false);
      setFeedback("Resolva o pacote bloqueado antes de continuar a bipagem.", "error");
      return;
    }
    if (
      processing.current.has(packageCode) ||
      packages.some((item) => item.id === packageCode)
    ) {
      feedbackBeep(false);
      setFeedback(`O pacote ${packageCode} já foi bipado nesta transferência.`, "error");
      return;
    }

    processing.current.add(packageCode);
    setPendingCodes((current) => [...current, packageCode]);
    try {
      const snapshot = await getDoc(doc(db, "controle_codigos", packageCode));
      if (!snapshot.exists()) {
        feedbackBeep(false);
        setFeedback(`Pacote ${packageCode} não encontrado no sistema.`, "error");
        return;
      }

      const data = snapshot.data();
      const status = String(data.status || "").toUpperCase();
      if (data.erro === true || (status === "CANCELADO" && !allowCancelled)) {
        setBlocked({ code: packageCode, raw, status });
        feedbackBeep(false);
        setFeedback(
          status === "CANCELADO"
            ? `Pacote ${packageCode} está bloqueado como CANCELADO.`
            : `Pacote ${packageCode} está bloqueado com ERRO.`,
          "error",
        );
        return;
      }

      const allowedStatuses = ["COLETADO", "ROTA", "AUSENTE", "ENTREGUE"];
      if (!allowedStatuses.includes(status) && !(allowCancelled && status === "CANCELADO")) {
        feedbackBeep(false);
        setFeedback(
          `O pacote ${packageCode} está com status ${formatStatus(status)} e não pode ser transferido.`,
          "error",
        );
        return;
      }

      const savedRaw = typeof data.raw === "string" ? data.raw : "";
      const savedScan = savedRaw ? extractScannedCode(savedRaw) : null;
      const qrValue =
        savedScan?.code === packageCode && savedRaw ? savedRaw : raw;
      packageOrder.current += 1;
      setPackages((current) => [
        ...current,
        {
          id: packageCode,
          code: String(data.codigo || packageCode),
          raw: qrValue,
          type: readableType(data, scanned),
          status,
          data,
          order: packageOrder.current,
        },
      ]);
      feedbackBeep(true);
      setFeedback(`Pacote ${packageCode} reconhecido.`, "success");
    } catch (error) {
      console.error("Falha ao validar pacote bipado:", error);
      feedbackBeep(false);
      setFeedback(`Falha ao consultar o pacote ${packageCode}.`, "error");
    } finally {
      processing.current.delete(packageCode);
      setPendingCodes((current) => current.filter((item) => item !== packageCode));
      hidBuffer.current = "";
      if (hidInput.current) hidInput.current.value = "";
    }
  }

  function onHidInput(value: string) {
    hidBuffer.current = value;
    setHidValue(value);
    if (hidTimer.current) clearTimeout(hidTimer.current);
    const trimmed = value.trim();
    const isStructured = trimmed.startsWith("{") || trimmed.startsWith("ˋ");
    const isClosedJson = trimmed.endsWith("}");
    const isHidSpecialEnd = trimmed.startsWith("ˋ") && trimmed.endsWith("{");
    if ((isStructured && (isClosedJson || isHidSpecialEnd)) || !isStructured) {
      if (isStructured && !isClosedJson && !isHidSpecialEnd) return;
      if (isStructured) {
        void addScannedPackage(value);
      } else {
        hidTimer.current = setTimeout(() => {
          if (hidBuffer.current.trim() === trimmed) {
            void addScannedPackage(trimmed);
          }
        }, 120);
      }
    } else {
      const normalized = normalizeScannerText(value);
      if (normalized.startsWith("{") && normalized.endsWith("}")) {
        void addScannedPackage(value);
      }
    }
  }

  async function unlockAndContinue() {
    if (!blocked) return;
    const current = blocked;
    try {
      await updateDoc(doc(db, "controle_codigos", current.code), { erro: false });
      setBlocked(null);
      setFeedback(
        "Bloqueio de erro removido. O pacote continua na transferência.",
        "success",
      );
      await addScannedPackage(
        current.raw,
        current.status === "CANCELADO",
        true,
      );
    } catch (error) {
      console.error("Falha ao desbloquear pacote:", error);
      setFeedback("Não foi possível desbloquear o pacote.", "error");
    }
  }

  async function finishTransfer() {
    if (!destination || !packages.length || savingTransfer) return;
    if (
      !window.confirm(
        `Confirmar a transferência de ${packages.length} pacote(s) para ${destination.name}?`,
      )
    ) {
      return;
    }

    setSavingTransfer(true);
    const committedCodes: string[] = [];
    try {
      const operator = auth.currentUser?.email?.trim().toLowerCase() || "";
      const ordered = [...packages].sort((a, b) => a.order - b.order);
      for (let offset = 0; offset < ordered.length; offset += 200) {
        const chunk = ordered.slice(offset, offset + 200);
        const batch = writeBatch(db);
        const timestamp = Timestamp.now();
        for (const item of chunk) {
          const packageRef = doc(db, "controle_codigos", item.id);
          const delivered = item.status === "ENTREGUE";
          const statusNew = delivered ? item.status : "ROTA";
          const packageUpdate: Record<string, any> = {
            usuario: destination.id,
            usuarioNome: destination.name,
          };
          if (!delivered) {
            packageUpdate.status = "ROTA";
            packageUpdate.data = timestamp;
            packageUpdate.historico = arrayUnion({
              status: "ROTA",
              dataHora: timestamp,
            });
          }
          batch.update(packageRef, packageUpdate);

          const movementRef = doc(collection(db, "historico_movimentacoes"));
          batch.set(movementRef, {
            codigo: item.id,
            statusAnterior: item.status,
            statusNovo,
            usuarioAnterior: item.data.usuario || "",
            usuarioNovo: destination.id,
            alteradoPor: operator,
            data: timestamp,
            ...(delivered ? { tipo: "TRANSFERENCIA_USUARIO" } : {}),
          });
        }
        await batch.commit();
        committedCodes.push(...chunk.map((item) => item.id));
        setPackages((current) =>
          current.filter((item) => !committedCodes.includes(item.id)),
        );
      }

      setPackages([]);
      setDestination(null);
      setDestinationQuery("");
      setBlocked(null);
      setFeedback("Transferência concluída e registrada.", "success");
    } catch (error) {
      console.error("Falha ao concluir transferência:", error);
      setFeedback(
        committedCodes.length
          ? "Parte da transferência foi concluída. A lista mantém somente os pacotes que faltam."
          : "Não foi possível concluir a transferência. Os pacotes continuam na lista para tentar novamente.",
        "error",
      );
    } finally {
      setSavingTransfer(false);
    }
  }

  async function generateCode() {
    try {
      let candidate = "";
      do {
        candidate = `AE${Date.now().toString(36).toUpperCase()}`;
        const snapshot = await getDoc(doc(db, "controle_codigos", candidate));
        if (!snapshot.exists()) break;
        await new Promise((resolve) => window.setTimeout(resolve, 2));
      } while (true);
      setCode(candidate);
      setLabel(null);
      setFeedback("Código único gerado. Salve para cadastrar o pacote.", "success");
    } catch (error) {
      console.error("Falha ao gerar código único:", error);
      setFeedback("Não foi possível verificar a disponibilidade do código.", "error");
    }
  }

  async function lookupCep() {
    const digits = cep.replace(/\D/g, "");
    if (digits.length !== 8) {
      setFeedback("Informe um CEP com 8 números.", "error");
      return;
    }
    setLookingUpCep(true);
    try {
      const response = await fetch(`https://viacep.com.br/ws/${digits}/json/`);
      if (!response.ok) throw new Error("CEP indisponível");
      const result = await response.json();
      if (result.erro) {
        setFeedback("CEP não encontrado.", "error");
        return;
      }
      setStreet(result.logradouro || "");
      setDistrict(result.bairro || "");
      setCity(result.localidade || "");
      setFeedback("Endereço preenchido pelo CEP.", "success");
    } catch (error) {
      console.error("Falha ao consultar CEP:", error);
      setFeedback("Não foi possível consultar o CEP agora.", "error");
    } finally {
      setLookingUpCep(false);
    }
  }

  async function saveQr() {
    const packageCode = code.trim().toUpperCase();
    if (!packageCode) {
      setFeedback("Informe ou gere um código para o QR.", "error");
      return;
    }
    if (packageCode.includes("/") || packageCode.length > 140) {
      setFeedback("O código informado não é válido para o cadastro.", "error");
      return;
    }
    if (savingQr) return;

    setSavingQr(true);
    try {
      const packageRef = doc(db, "controle_codigos", packageCode);
      const existing = await getDoc(packageRef);
      if (existing.exists()) {
        setFeedback("Esse código já está cadastrado. Gere outro QR.", "error");
        return;
      }
      const now = Timestamp.now();
      const visibleUntil = Timestamp.fromDate(
        new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      );
      const address = [
        street.trim(),
        number.trim(),
        district.trim(),
        city.trim(),
        cep.trim(),
      ]
        .filter(Boolean)
        .join(", ");
      const companyName = selectedFolder?.companyName || selectedFolder?.name || "";
      const packageData = {
        codigo: packageCode,
        empresa: folderId,
        tipo: packageType,
        status: "COLETADO",
        usuario: "",
        usuarioFinalizacao: "",
        nomeRecebedor: recipient.trim(),
        documentoRecebedor: "",
        observacao: note.trim(),
        erro: false,
        subiu: false,
        data: now,
        raw: "",
        visivelAte: visibleUntil,
        historico: [{ status: "COLETADO", dataHora: now }],
        rua: street.trim(),
        numero: number.trim(),
        bairro: district.trim(),
        cidade: city.trim(),
        cep: cep.trim(),
        pastaColeta: folderId,
      };
      await setDoc(packageRef, packageData);
      setLabel({
        code: packageCode,
        type: packageType,
        company: companyName,
        address,
        recipient: recipient.trim(),
        note: note.trim(),
      });
      setFeedback("QR criado. A etiqueta já está pronta para imprimir.", "success");
    } catch (error) {
      console.error("Falha ao criar QR:", error);
      setFeedback("Não foi possível salvar o QR no sistema.", "error");
    } finally {
      setSavingQr(false);
    }
  }

  async function printPackageLabel() {
    const image = printLabel.current?.querySelector("img");
    if (image && !image.complete) {
      await new Promise<void>((resolve) => {
        image.addEventListener("load", () => resolve(), { once: true });
        image.addEventListener("error", () => resolve(), { once: true });
      });
    } else if (image && "decode" in image) {
      await image.decode().catch(() => undefined);
    }
    window.print();
  }

  const addressForLabel = [
    street.trim(),
    number.trim(),
    district.trim(),
    city.trim(),
    cep.trim(),
  ]
    .filter(Boolean)
    .join(", ");
  const labelCompany =
    label?.company ||
    selectedFolder?.companyName ||
    selectedFolder?.name ||
    "";
  const displayLabel = label || {
    code: code.trim().toUpperCase(),
    type: packageType,
    company: labelCompany,
    address: addressForLabel,
    recipient: recipient.trim(),
    note: note.trim(),
  };

  if (loading) {
    return (
      <div className="card" style={{ padding: 30, textAlign: "center" }}>
        <LoaderCircle size={20} className="spin" /> Carregando gerenciamento...
      </div>
    );
  }

  if (allowed !== true) {
    return (
      <div className="card" style={{ padding: 22 }}>
        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <ShieldAlert color="#b42318" />
          <strong>Acesso não autorizado</strong>
        </div>
        <p style={{ color: "#667085", marginBottom: 0 }}>
          Esta área é liberada somente para administradores e operadores com
          permissão de edição de pacotes.
        </p>
      </div>
    );
  }

  return (
    <section className="package-manager">
      <style>{styles}</style>
      <div className="pm-head">
        <div>
          <h2>Gerenciamento de pacotes</h2>
          <p>Transfira pacotes com leitor HID ou crie QR codes com etiqueta.</p>
        </div>
      </div>

      <div className="pm-switch" role="tablist" aria-label="Gerenciar pacotes">
        <button
          type="button"
          role="tab"
          aria-selected={mode === "transfer"}
          data-testid="package-management-transfer-tab"
          className={mode === "transfer" ? "active" : ""}
          onClick={() => setMode("transfer")}
        >
          <Truck size={17} /> Transferência HID
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={mode === "create"}
          data-testid="package-management-create-tab"
          className={mode === "create" ? "active" : ""}
          onClick={() => setMode("create")}
        >
          <QrCode size={17} /> Criar QR + etiqueta
        </button>
      </div>

      {mode === "transfer" ? (
        <div className="pm-panel">
          <div className="pm-guide">
            <Search size={19} />
            <div>
              <strong>Selecione o usuário de destino</strong>
              <div>
                Pesquise pelo nome ou ID e depois bipe os códigos com a pistola
                HID. Esta tela não abre a câmera.
              </div>
            </div>
          </div>

          {!destination ? (
            <div className="pm-field" style={{ marginTop: 16 }}>
              <label htmlFor="pm-destination-search">Usuário de destino</label>
              <input
                id="pm-destination-search"
                data-testid="package-transfer-user-search"
                value={destinationQuery}
                onChange={(event) => setDestinationQuery(event.target.value)}
                placeholder="Digite o nome ou ID do usuário"
                autoComplete="off"
              />
              {destinationQuery.trim() && (
                <div className="pm-destinations">
                  {filteredUsers.map((user) => (
                    <button
                      type="button"
                      className="pm-destination"
                      key={user.id}
                      onClick={() => {
                        setDestination(user);
                        setDestinationQuery("");
                        setPackages([]);
                        setBlocked(null);
                        setFeedback("");
                      }}
                    >
                      <span>
                        <strong>{user.name}</strong>
                        <small>{user.id}</small>
                      </span>
                      <UserRound size={17} />
                    </button>
                  ))}
                  {!filteredUsers.length && (
                    <div className="pm-empty">Nenhum usuário encontrado.</div>
                  )}
                </div>
              )}
            </div>
          ) : (
            <>
              <div
                style={{
                  marginTop: 16,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: 12,
                  padding: "12px 14px",
                  borderRadius: 12,
                  background: "#f1fbf5",
                  border: "1px solid #c8ead3",
                }}
              >
                <span>
                  <small style={{ display: "block", color: "#667085" }}>
                    DESTINO SELECIONADO
                  </small>
                  <strong>{destination.name}</strong>
                  <small style={{ display: "block", color: "#667085" }}>
                    {destination.id}
                  </small>
                </span>
                <button
                  type="button"
                  className="pm-button"
                  disabled={packages.length > 0 || isBusy}
                  onClick={() => {
                    setDestination(null);
                    setDestinationQuery("");
                    setMessage("");
                  }}
                >
                  Trocar usuário
                </button>
              </div>

              <div className="pm-scan">
                <div>
                  <strong>Leitor HID pronto para bipar</strong>
                  <small>
                    Mantenha o cursor nesta tela. Cada leitura consulta o código
                    completo no Firestore e identifica o código operacional.
                  </small>
                </div>
                <div className="pm-count" aria-label={`${scannedCount} pacotes bipados`}>
                  <b>{scannedCount}</b>
                  <small>BIPADOS</small>
                </div>
              </div>
              <input
                ref={hidInput}
                data-testid="package-transfer-hid-input"
                aria-label="Entrada do leitor de código HID"
                autoComplete="off"
                autoCapitalize="off"
                spellCheck={false}
                value={hidValue}
                onChange={(event) => onHidInput(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    const raw = hidBuffer.current;
                    if (hidTimer.current) clearTimeout(hidTimer.current);
                    if (raw.trim()) void addScannedPackage(raw);
                  }
                }}
                onBlur={() => {
                  if (!blocked && mode === "transfer") {
                    window.setTimeout(() => hidInput.current?.focus(), 80);
                  }
                }}
                style={{
                  position: "fixed",
                  left: -10000,
                  top: 0,
                  width: 1,
                  height: 1,
                  opacity: 0,
                  pointerEvents: "none",
                }}
              />

              {pendingCodes.length > 0 && (
                <div className="pm-message" role="status">
                  <LoaderCircle size={15} className="spin" /> Consultando{" "}
                  {pendingCodes.join(", ")}...
                </div>
              )}
              {message && (
                <div
                  className={`pm-message ${messageType}`}
                  role={messageType === "error" ? "alert" : "status"}
                >
                  {messageType === "error" ? (
                    <AlertTriangle size={15} />
                  ) : messageType === "success" ? (
                    <Check size={15} />
                  ) : null}{" "}
                  {message}
                </div>
              )}
              {blocked && (
                <div className="pm-blocked" role="alert">
                  <div>
                    <strong>
                      Pacote {blocked.code} bloqueado:{" "}
                      {blocked.status === "CANCELADO" ? "CANCELADO" : "ERRO"}
                    </strong>
                    <p>
                      Desbloqueie para liberar a entrada na transferência. O
                      status não é alterado nesta etapa.
                    </p>
                  </div>
                  <button
                    type="button"
                    className="pm-button primary"
                    onClick={() => void unlockAndContinue()}
                  >
                    Desbloquear pacote
                  </button>
                </div>
              )}

              <div className="pm-list" aria-live="polite">
                {packages
                  .slice()
                  .sort((a, b) => b.order - a.order)
                  .map((item) => (
                    <article className="pm-package" key={item.id}>
                      <QRCodeSVG
                        value={item.raw || item.code}
                        size={48}
                        level="M"
                        includeMargin
                      />
                      <span>
                        <strong>{item.code}</strong>
                        <small>
                          {item.type} · {formatStatus(item.status)}
                        </small>
                      </span>
                      <span className="pm-pill">LIDO</span>
                    </article>
                  ))}
                {!packages.length && !pendingCodes.length && (
                  <div className="pm-empty">
                    Nenhum pacote bipado nesta transferência.
                  </div>
                )}
              </div>

              <div className="pm-actions">
                <button
                  type="button"
                  className="pm-button"
                  disabled={!packages.length || isBusy}
                  onClick={() => {
                    setPackages([]);
                    setFeedback("Lista de bipagem limpa.");
                  }}
                >
                  <X size={16} /> Limpar lista
                </button>
                <button
                  type="button"
                  className="pm-button primary"
                  data-testid="package-transfer-finish"
                  disabled={!packages.length || isBusy || Boolean(blocked)}
                  onClick={() => void finishTransfer()}
                >
                  {savingTransfer ? (
                    <LoaderCircle size={16} className="spin" />
                  ) : (
                    <Check size={16} />
                  )}
                  Finalizar transferência
                </button>
              </div>
            </>
          )}
        </div>
      ) : (
        <div className="pm-panel">
          <div className="pm-guide">
            <QrCode size={19} />
            <div>
              <strong>Crie o código e imprima a etiqueta do pacote</strong>
              <div>
                O QR salvo usa o código do pacote e segue os mesmos campos de
                cadastro do aplicativo Operacional.
              </div>
            </div>
          </div>

          <div className="pm-grid" style={{ marginTop: 16 }}>
            <div className="pm-field">
              <label htmlFor="pm-code">Código do pacote</label>
              <input
                id="pm-code"
                data-testid="package-create-code"
                value={code}
                onChange={(event) => {
                  setCode(event.target.value.toUpperCase());
                  setLabel(null);
                }}
                placeholder="Gere um código ou digite"
              />
            </div>
            <div className="pm-field" style={{ justifyContent: "flex-end" }}>
              <label aria-hidden="true">&nbsp;</label>
              <button
                type="button"
                className="pm-button"
                onClick={() => void generateCode()}
              >
                <QrCode size={16} /> Gerar código único
              </button>
            </div>
            <div className="pm-field">
              <label htmlFor="pm-package-type">Tipo</label>
              <select
                id="pm-package-type"
                value={packageType}
                onChange={(event) => {
                  setPackageType(event.target.value as PackageType);
                }}
              >
                {packageTypes.map((type) => (
                  <option key={type} value={type}>
                    {type}
                  </option>
                ))}
              </select>
            </div>
            <div className="pm-field">
              <label htmlFor="pm-folder">Empresa / pasta de coleta</label>
              <select
                id="pm-folder"
                value={folderId}
                onChange={(event) => {
                  setFolderId(event.target.value);
                }}
              >
                <option value="">Sem pasta vinculada</option>
                {folders.map((folder) => (
                  <option key={folder.id} value={folder.id}>
                    {folder.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="pm-field">
              <label htmlFor="pm-cep">CEP</label>
              <div style={{ display: "flex", gap: 7 }}>
                <input
                  id="pm-cep"
                  value={cep}
                  onChange={(event) => {
                    setCep(event.target.value);
                  }}
                  inputMode="numeric"
                  placeholder="00000-000"
                />
                <button
                  type="button"
                  className="pm-button"
                  disabled={lookingUpCep}
                  onClick={() => void lookupCep()}
                  aria-label="Buscar endereço pelo CEP"
                >
                  {lookingUpCep ? (
                    <LoaderCircle size={16} className="spin" />
                  ) : (
                    <Search size={16} />
                  )}
                </button>
              </div>
            </div>
            <div className="pm-field">
              <label htmlFor="pm-street">Rua</label>
              <input
                id="pm-street"
                value={street}
                onChange={(event) => {
                  setStreet(event.target.value);
                }}
              />
            </div>
            <div className="pm-field">
              <label htmlFor="pm-district">Bairro</label>
              <input
                id="pm-district"
                value={district}
                onChange={(event) => {
                  setDistrict(event.target.value);
                }}
              />
            </div>
            <div className="pm-field">
              <label htmlFor="pm-number">Número</label>
              <input
                id="pm-number"
                value={number}
                onChange={(event) => {
                  setNumber(event.target.value);
                }}
              />
            </div>
            <div className="pm-field">
              <label htmlFor="pm-city">Cidade</label>
              <input
                id="pm-city"
                value={city}
                onChange={(event) => {
                  setCity(event.target.value);
                }}
              />
            </div>
            <div className="pm-field">
              <label htmlFor="pm-recipient">Recebedor</label>
              <input
                id="pm-recipient"
                value={recipient}
                onChange={(event) => {
                  setRecipient(event.target.value);
                }}
              />
            </div>
            <div className="pm-field pm-span">
              <label htmlFor="pm-note">Observação</label>
              <textarea
                id="pm-note"
                value={note}
                onChange={(event) => {
                  setNote(event.target.value);
                }}
              />
            </div>
          </div>

          {message && (
            <div className={`pm-message ${messageType}`} role="status">
              {messageType === "error" ? (
                <AlertTriangle size={15} />
              ) : messageType === "success" ? (
                <Check size={15} />
              ) : null}{" "}
              {message}
            </div>
          )}

          <div className="pm-actions">
            <button
              type="button"
              className="pm-button primary"
              data-testid="package-create-save"
              disabled={savingQr}
              onClick={() => void saveQr()}
            >
              {savingQr ? (
                <LoaderCircle size={16} className="spin" />
              ) : (
                <QrCode size={16} />
              )}
              Salvar QR
            </button>
          </div>

          {displayLabel.code && (
            <>
              {label && (
                <div className="pm-warning">
                  <Clipboard size={16} />
                  O QR foi gravado na coleção <strong>controle_codigos</strong>.
                  Confira a etiqueta antes de imprimir.
                </div>
              )}
              <div className="pm-label" ref={printLabel}>
                <img className="pm-label-bg" src={labelTemplate} alt="" />
                <div className="pm-label-value pm-label-type">
                  <span
                    style={{
                      fontSize: `${Math.max(
                        1.3,
                        Math.min(2.7, (2.7 * 14) / displayLabel.type.length),
                      )}mm`,
                    }}
                  >
                    {displayLabel.type}
                  </span>
                </div>
                <div className="pm-label-value pm-label-id">
                  <span
                    style={{
                      fontSize: `${Math.max(
                        1.2,
                        Math.min(2.7, (2.7 * 14) / displayLabel.code.length),
                      )}mm`,
                    }}
                  >
                    {displayLabel.code}
                  </span>
                </div>
                <div className="pm-label-qr">
                  <QRCodeSVG
                    value={displayLabel.code}
                    size={400}
                    level="H"
                    includeMargin
                  />
                </div>
                <div className="pm-label-value pm-label-company">
                  {displayLabel.company}
                </div>
                <div className="pm-label-value pm-label-address">
                  {displayLabel.address}
                </div>
                <div className="pm-label-value pm-label-recipient">
                  {displayLabel.recipient}
                </div>
                <div className="pm-label-value pm-label-note">
                  {displayLabel.note}
                </div>
              </div>
              {label && (
                <div className="pm-actions">
                  <button
                    type="button"
                    className="pm-button primary"
                    data-testid="package-label-print"
                    onClick={() => void printPackageLabel()}
                  >
                    <Printer size={16} /> Imprimir etiqueta
                  </button>
                </div>
              )}
            </>
          )}
          <div className="pm-warning">
            <AlertTriangle size={16} />
            A impressão segue o modelo térmico vertical de 100 × 150 mm. Ajuste
            a impressora para essa medida e escala de 100%.
          </div>
        </div>
      )}
    </section>
  );
}
