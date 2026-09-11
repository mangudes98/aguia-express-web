// ============================================================
// WHATSAPP — ENVIO DE MENSAGENS PELO SITE
// ARQUIVO: src/services/whatsapp/send.ts
// ============================================================

export async function enviarMensagemWhatsApp(
  numero: string,
  mensagem: string
) {
  const resposta = await fetch(
    "https://us-central1-gavioes-express.cloudfunctions.net/whatsappEnviarMensagem",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        numero,
        mensagem,
      }),
    }
  );

  const dados = await resposta.json().catch(() => ({}));

  if (!resposta.ok) {
    throw new Error(
      dados?.error || "Erro ao enviar mensagem pelo WhatsApp."
    );
  }

  return dados;
}