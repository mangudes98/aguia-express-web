// ARQUIVO: src/components/ui/Modal.tsx
import { ReactNode } from "react";
import { X } from "lucide-react";

export default function Modal({ open, title, onClose, children }: { open: boolean; title: string; onClose: () => void; children: ReactNode }) {
  if (!open) return null;
  return <div className="modal-backdrop" onMouseDown={e => e.currentTarget === e.target && onClose()}>
    <div className="modal">
      <div className="modal-head"><h2>{title}</h2><button onClick={onClose}><X size={18}/></button></div>
      {children}
    </div>
  </div>;
}
