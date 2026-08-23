// ARQUIVO: src/pages/PacoteDetalhe.tsx
import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import PageHeader from "../components/ui/PageHeader";
import StatusBadge from "../components/ui/StatusBadge";
import { atualizarStatus, buscarPacote, formatarData, nomeStatus, nomeTipo } from "../services/pacotes";
import { Pacote, StatusPacote } from "../types";

export default function PacoteDetalhe() {
  const { id = "" } = useParams();
  const [p, setP] = useState<Pacote | null>(null);
  const [busy, setBusy] = useState(false);

  async function load() { setP(await buscarPacote(id)); }
  useEffect(() => { load(); }, [id]);

  async function mudarStatus(status: StatusPacote) {
    if (!p) return;
    setBusy(true);
    try {
      await atualizarStatus(p.id, status);
      await load();
    } finally { setBusy(false); }
  }

  if (!p) return <div className="empty">Carregando pacote...</div>;

  return <div>
    <PageHeader title={`Pacote ${p.codigo}`} subtitle="Documento real de controle_codigos"
      action={<Link className="secondary" to="/pacotes">Voltar</Link>}
    />

    <div className="detail-grid">
      <section className="card detail-card">
        <div className="card-title"><h3>Informações</h3><StatusBadge status={p.status}/></div>
        {[
          ["Código", p.codigo],
          ["Empresa", p.empresa],
          ["Tipo", nomeTipo(p.tipo)],
          ["Usuário atual", p.usuario],
          ["Usuário anterior", p.usuarioAnterior],
          ["Usuário finalização", p.usuarioFinalizacao],
          ["Data", formatarData(p.data)],
          ["Data devolução", formatarData(p.dataDevolucao)],
          ["Recebedor", p.nomeRecebedor],
          ["Documento", p.documentoRecebedor],
          ["Observação", p.observacao],
          ["Confirmado", p.confirmado ? "Sim" : "Não"],
          ["Subiu", p.subiu ? "Sim" : "Não"],
          ["Erro", p.erro ? "Sim" : "Não"],
        ].map(([label, value]) => <div className="detail-row" key={label}><span>{label}</span><b>{value || "-"}</b></div>)}

        {p.fotoDevolucao && <a className="primary" href={p.fotoDevolucao} target="_blank" rel="noreferrer">Abrir foto da devolução</a>}
      </section>

      <section className="card">
        <div className="card-title"><div><h3>Alterar status</h3><p>Use somente quando autorizado pela operação.</p></div></div>
        <div className="action-grid">
          {(["COLETADO","ROTA","ENTREGUE","AUSENTE","DEVOLVIDO"] as StatusPacote[]).map(s =>
            <button key={s} className="secondary" disabled={busy || p.status === s} onClick={() => mudarStatus(s)}>
              {nomeStatus(s)}
            </button>
          )}
        </div>

        <div className="card-title" style={{marginTop: 28}}><div><h3>Histórico</h3><p>Array historico salvo no documento.</p></div></div>
        <div className="timeline">
          {p.historico?.map((h, i) => <div className="timeline-item" key={i}>
            <div className="timeline-dot"/>
            <div><b>{nomeStatus(String(h.status).toUpperCase() as StatusPacote) || h.status}</b><span>{formatarData(h.dataHora)}</span></div>
          </div>)}
          {!p.historico?.length && <div className="empty">Sem histórico registrado.</div>}
        </div>
      </section>
    </div>
  </div>;
}
