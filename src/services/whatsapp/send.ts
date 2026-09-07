// ============================================================
// WHATSAPP — ENVIO DE MENSAGENS
// ARQUIVO: src/services/whatsapp/send.ts
// ============================================================

export async function enviarMensagemWhatsApp(
  numero: string,
  mensagem: string
) {
  const resposta = await fetch("/api/whatsapp/send", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      numero,
      mensagem,
    }),
  });

  const dados = await resposta.json().catch(() => ({}));

  if (!resposta.ok) {
    throw new Error(
      dados?.error || "Erro ao enviar mensagem pelo WhatsApp."
    );
  }

  return dados;
}