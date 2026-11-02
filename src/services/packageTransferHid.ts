export type ScannedCode = {
  code: string;
  fields: Record<string, string>;
  raw: string;
};

function normalizeScannerText(value: string) {
  let normalized = value
    .replace(/ˆÇ/g, ":")
    .replace(/ˆ,/g, ",")
    .replace(/ˋ/g, "{")
    .replace(/ˆ/g, '"')
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .trim();

  if (normalized.endsWith("{")) {
    normalized = `${normalized.slice(0, -1)}}`;
  }

  normalized = normalized.replace(
    /([{,]\s*)([A-Za-z_][A-Za-z0-9_-]*)\s*:/g,
    '$1"$2":',
  );
  normalized = normalized.replace(
    /:\s*([A-Za-z0-9._-]+)\s*(?=[,}])/g,
    (match, value: string) =>
      /^(true|false|null|-?\d+(?:\.\d+)?)$/i.test(value)
        ? `:${value}`
        : `:${JSON.stringify(value)}`,
  );
  return normalized;
}

function fieldsFromText(raw: string): Record<string, string> {
  const normalized = normalizeScannerText(raw);
  try {
    const parsed = JSON.parse(normalized);
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      return Object.fromEntries(
        Object.entries(parsed).map(([key, value]) => [
          key.toLowerCase(),
          value == null ? "" : String(value),
        ]),
      );
    }
  } catch {
    // O leitor HID pode alterar aspas, acentos e separadores do JSON.
  }

  const fields: Record<string, string> = {};
  const fieldPattern =
    /(?:^|[,{;\s])["']?([A-Za-z_][A-Za-z0-9_]*)["']?\s*(?:[:=])\s*["']?([^,"'}\s]+)["']?/g;
  for (const match of normalized.matchAll(fieldPattern)) {
    fields[match[1].toLowerCase()] = match[2];
  }
  return fields;
}

/**
 * Normaliza os formatos lidos pelo scanner da coleta antes de consultar
 * controle_codigos: Mercado Livre (JSON), VAPT, sorter e códigos simples.
 */
export function extractScannedCode(rawValue: string): ScannedCode | null {
  const raw = rawValue;
  const parseValue = rawValue.trim();
  if (!parseValue) return null;
  const fields = fieldsFromText(parseValue);
  const id = fields.id?.trim();
  const senderId = fields.sender_id?.trim();
  const service = fields.service_name?.trim().toUpperCase();

  if (
    id &&
    senderId &&
    Object.prototype.hasOwnProperty.call(fields, "hash_code") &&
    Object.prototype.hasOwnProperty.call(fields, "security_digit")
  ) {
    return { code: id, fields, raw };
  }
  if (
    service === "VAPT_EXPRESS" ||
    (fields.external_grouper_code && fields.logistical_flow_start)
  ) {
    const code =
      fields.external_grouper_code ||
      fields.external_code ||
      fields.tag_code;
    if (code) return { code: code.trim(), fields, raw };
  }
  if (fields.sorter_code && fields.external_order_id) {
    return { code: fields.sorter_code.trim(), fields, raw };
  }
  if (fields.external_grouper_code) {
    return {
      code: fields.external_grouper_code.trim(),
      fields,
      raw,
    };
  }
  if (fields.sorter_code) {
    return { code: fields.sorter_code.trim(), fields, raw };
  }
  if (id) return { code: id, fields, raw };
  return { code: raw, fields, raw };
}
