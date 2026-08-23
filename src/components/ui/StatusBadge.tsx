// ARQUIVO: src/components/ui/StatusBadge.tsx
import { StatusPacote } from "../../types";
import { nomeStatus } from "../../services/pacotes";

export default function StatusBadge({ status }: { status: StatusPacote }) {
  return <span className={`badge status-${status.toLowerCase()}`}>{nomeStatus(status)}</span>;
}
