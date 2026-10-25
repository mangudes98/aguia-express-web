export type CompanyInvoiceData = {
  companyName: string;
  periodStart: Date;
  periodEnd: Date;
  issuedAt: Date;
  marketCount: number;
  shopeeCount: number;
  adHocCount: number;
  marketRate: number;
  shopeeRate: number;
  adHocRate: number;
  totalToPay: number;
};

const escapeHtml = (value: string) =>
  value.replace(/[&<>"']/g, character => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  })[character]!);

export function buildCompanyInvoiceHtml(invoice: CompanyInvoiceData): string {
  const counts = [invoice.marketCount, invoice.shopeeCount, invoice.adHocCount];
  const amounts = [
    invoice.marketRate, invoice.shopeeRate, invoice.adHocRate, invoice.totalToPay,
  ];
  if (
    !invoice.companyName.trim() ||
    [invoice.periodStart, invoice.periodEnd, invoice.issuedAt].some(
      date => !(date instanceof Date) || !Number.isFinite(date.getTime())
    ) ||
    invoice.periodEnd < invoice.periodStart ||
    counts.some(count => !Number.isSafeInteger(count) || count < 0) ||
    amounts.some(amount => !Number.isFinite(amount) || amount < 0)
  ) {
    throw new Error("Os dados da cobrança são inválidos.");
  }

  const rows = [
    { name: "Mercado Livre", count: invoice.marketCount, rate: invoice.marketRate },
    { name: "Shopee", count: invoice.shopeeCount, rate: invoice.shopeeRate },
    { name: "Avulso", count: invoice.adHocCount, rate: invoice.adHocRate },
  ];
  const total = rows.reduce((sum, row) => sum + row.count * row.rate, 0);
  if (!Number.isFinite(total) || Math.abs(total - invoice.totalToPay) > 0.005) {
    throw new Error(
      "O total da cobrança difere do fechamento. Atualize os dados antes de baixar."
    );
  }

  const date = new Intl.DateTimeFormat("pt-BR");
  const money = new Intl.NumberFormat("pt-BR", {
    style: "currency", currency: "BRL",
  });
  const unitPrice = new Intl.NumberFormat("pt-BR", {
    style: "currency", currency: "BRL", maximumFractionDigits: 4,
  });
  const number = new Intl.NumberFormat("pt-BR");
  const company = escapeHtml(invoice.companyName);
  const fileDate = (value: Date) => [
    value.getFullYear(),
    String(value.getMonth() + 1).padStart(2, "0"),
    String(value.getDate()).padStart(2, "0"),
  ].join("-");
  const companySlug = invoice.companyName.normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "_").slice(0, 60);
  const title = `Fatura_${companySlug}_${fileDate(invoice.periodStart)}_${fileDate(invoice.periodEnd)}`;

  // Não serializar o objeto do fechamento: somente a projeção pública acima.
  return `<!doctype html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'">
  <title>${escapeHtml(title)}</title>
  <style>
    @page { size: A4; margin: 16mm; }
    * { box-sizing: border-box; }
    body { margin: 0; color: #18212e; background: #fff;
      font: 12px/1.5 Arial, sans-serif; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    main { max-width: 760px; margin: 0 auto; }
    header { border-bottom: 2px solid #a87500; padding-bottom: 18px; margin-bottom: 24px; }
    .brand { font-size: 26px; font-weight: 800; color: #a87500; margin: 0; }
    h1 { font-size: 18px; margin: 4px 0 0; }
    h2 { font-size: 18px; margin: 0 0 8px; overflow-wrap: anywhere; }
    p { margin: 5px 0; }
    table { width: 100%; border-collapse: collapse; margin: 24px 0 14px; }
    th, td { border: 1px solid #d8dee5; padding: 11px 9px; text-align: right; }
    th { background: #a87500; color: #fff; }
    th:first-child, td:first-child { text-align: left; }
    tr { break-inside: avoid; }
    .total { border: 1px solid #a87500; background: #fff7e2; padding: 18px;
      margin: 24px 0; break-inside: avoid; }
    .total strong { display: block; font-size: 28px; margin-top: 6px; }
    @media screen {
      body { background: #eef0f3; padding: 24px; }
      main { background: #fff; padding: 32px; box-shadow: 0 4px 20px #0001; }
      .instructions { max-width: 760px; margin: 0 auto 16px; }
    }
    @media print { .instructions { display: none; } }
  </style>
</head>
<body>
  <p class="instructions">Na janela de impressão, escolha <b>Salvar como PDF</b>. Se necessário, use Ctrl+P ou ⌘+P para abrir novamente.</p>
  <main>
    <header><p class="brand">ÁGUIA EXPRESS</p><h1>FATURA DE COLETAS</h1></header>
    <section>
      <h2>${company}</h2>
      <p>Período: ${date.format(invoice.periodStart)} até ${date.format(invoice.periodEnd)}</p>
      <p>Emissão: ${date.format(invoice.issuedAt)} ${invoice.issuedAt.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}</p>
    </section>
    <table>
      <thead><tr><th scope="col">Tipo de pacote</th><th scope="col">Quantidade</th><th scope="col">Valor unitário</th><th scope="col">Subtotal</th></tr></thead>
      <tbody>${rows.map(row => `<tr><td>${row.name}</td><td>${number.format(row.count)}</td><td>${unitPrice.format(row.rate)}</td><td>${money.format(row.count * row.rate)}</td></tr>`).join("")}</tbody>
    </table>
    <p><b>Total de pacotes coletados: ${number.format(counts.reduce((sum, count) => sum + count, 0))}</b></p>
    <section class="total">TOTAL A PAGAR PELA EMPRESA<strong>${money.format(invoice.totalToPay)}</strong></section>
  </main>
</body>
</html>`;
}

export function printCompanyInvoice(invoice: CompanyInvoiceData): void {
  const html = buildCompanyInvoiceHtml(invoice);
  const preview = window.open("", "_blank");
  if (!preview) {
    throw new Error("Permita a abertura de janelas para salvar a cobrança em PDF.");
  }
  preview.opener = null;
  preview.document.open();
  preview.document.write(html);
  preview.document.close();

  const print = () => {
    if (preview.closed) return;
    preview.focus();
    preview.print();
  };
  if (preview.document.readyState === "complete") print();
  else preview.addEventListener("load", print, { once: true });
}
