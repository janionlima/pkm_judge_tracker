/*
 * Forma do estado-raiz (AppState) persistido como um único documento JSON.
 *
 * Modelo achatado (design: Data Models): torneios, rodadas e penalidades vivem
 * em arrays separados; rodadas referenciam `tournamentId` e penalidades
 * referenciam `roundId` + `tournamentId` (desnormalizado para consultas por
 * torneio — reincidência e CSV).
 *
 * type AppState = {
 *   schemaVersion: 1;
 *   profile: Profile | null;
 *   tournaments: Tournament[];
 *   rounds: Round[];
 *   penalties: Penalty[];
 * }
 */

export const SCHEMA_VERSION = 1;

/* Chaves de localStorage (design: Esquema de localStorage e versionamento). */
export const STATE_KEY = "pjpt.appState";
export const SCHEMA_VERSION_KEY = "pjpt.schemaVersion";

/* Estado inicial vazio e válido. */
export function emptyState() {
  return {
    schemaVersion: SCHEMA_VERSION,
    profile: null,
    tournaments: [],
    rounds: [],
    penalties: [],
  };
}

/*
 * Valida a forma mínima de um AppState desserializado. Usado no carregamento
 * para decidir entre aceitar o estado ou tratá-lo como corrompido (Req 10.6).
 */
export function isValidState(state) {
  return (
    !!state &&
    typeof state === "object" &&
    state.schemaVersion === SCHEMA_VERSION &&
    (state.profile === null || typeof state.profile === "object") &&
    Array.isArray(state.tournaments) &&
    Array.isArray(state.rounds) &&
    Array.isArray(state.penalties)
  );
}

/*
 * Normaliza um estado parcial/arbitrário para a forma canônica, preenchendo
 * campos ausentes. Mantém a imutabilidade (não altera o objeto recebido).
 */
export function normalizeState(state) {
  const base = emptyState();
  if (!state || typeof state !== "object") return base;
  return {
    schemaVersion: SCHEMA_VERSION,
    profile:
      state.profile && typeof state.profile === "object"
        ? state.profile
        : null,
    tournaments: Array.isArray(state.tournaments) ? state.tournaments : [],
    rounds: Array.isArray(state.rounds) ? state.rounds : [],
    penalties: Array.isArray(state.penalties) ? state.penalties : [],
  };
}

/* Cópia profunda simples (estado é JSON-serializável por construção). */
export function cloneState(state) {
  return JSON.parse(JSON.stringify(state));
}
