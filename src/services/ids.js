/*
 * Geração e validação de identificadores.
 *
 * - generateRecordId(): ID de cadastro OPACO do torneio (uso interno; não vai
 *   ao relatório). Sem exigência de formato.
 * - uid(): identificador opaco para rodadas e penalidades.
 * - SANCTIONING_NUMBER_REGEX: padrão XX-XX-XXXXXX exigido do número de
 *   sancionamento (Tournament ID do relatório — Req 2.2 / Property 5).
 */

const ALPHANUM = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";

export const SANCTIONING_NUMBER_REGEX =
  /^[A-Za-z0-9]{2}-[A-Za-z0-9]{2}-[A-Za-z0-9]{6}$/;

export function isValidSanctioningNumber(value) {
  return typeof value === "string" && SANCTIONING_NUMBER_REGEX.test(value);
}

function randomInt(max) {
  // Usa crypto quando disponível (browser/node), com fallback para Math.random.
  const g = globalThis;
  if (g.crypto && typeof g.crypto.getRandomValues === "function") {
    const buf = new Uint32Array(1);
    g.crypto.getRandomValues(buf);
    return buf[0] % max;
  }
  return Math.floor(Math.random() * max);
}

function randomAlnum(n) {
  let out = "";
  for (let i = 0; i < n; i++) {
    out += ALPHANUM[randomInt(ALPHANUM.length)];
  }
  return out;
}

/* ID de cadastro opaco, único e sem formato público (uso interno). */
export function generateRecordId() {
  return `t_${Date.now().toString(36)}-${randomAlnum(10)}`;
}

export function uid() {
  const rand = randomAlnum(8);
  return `${Date.now().toString(36)}-${rand}`;
}
