/*
 * Tipo Result compartilhado pelos serviços de aplicação.
 *
 *   ok(value)                      -> { ok: true, value }
 *   err([{ field, code, message }]) -> { ok: false, errors }
 *
 * Serviços retornam Result em vez de lançar para erros de validação: a view
 * preserva o que foi digitado e exibe mensagens por campo (design: Error Handling).
 */

export function ok(value) {
  return { ok: true, value };
}

export function err(errors) {
  return { ok: false, errors: Array.isArray(errors) ? errors : [errors] };
}

export function validationError(field, message, code = "invalid") {
  return { field, code, message };
}

/* ---------- Helpers de validação reutilizáveis ---------- */

/* True quando o valor é string e não é vazio após trim (campo obrigatório). */
export function isNonEmpty(value) {
  return typeof value === "string" && value.trim().length > 0;
}

/* Comprimento (em code units) de uma string, 0 para não-string. */
export function lengthOf(value) {
  return typeof value === "string" ? value.length : 0;
}

/*
 * True quando `value` é uma data no formato ISO yyyy-mm-dd e representa uma
 * data de calendário real (ex.: rejeita 2026-02-30).
 */
export function isValidIsoDate(value) {
  if (typeof value !== "string") return false;
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!m) return false;
  const year = Number(m[1]);
  const month = Number(m[2]);
  const day = Number(m[3]);
  if (month < 1 || month > 12 || day < 1 || day > 31) return false;
  const d = new Date(Date.UTC(year, month - 1, day));
  return (
    d.getUTCFullYear() === year &&
    d.getUTCMonth() === month - 1 &&
    d.getUTCDate() === day
  );
}

/* Compara duas datas ISO yyyy-mm-dd lexicograficamente (válido para o formato). */
export function isoDateNotAfter(value, referenceIso) {
  return value <= referenceIso;
}

/* Data atual do dispositivo como ISO yyyy-mm-dd (horário local). */
export function todayIso(now = new Date()) {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}
