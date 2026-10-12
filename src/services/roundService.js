/*
 * RoundService — rodadas de um torneio (Requisitos 3.1–3.10).
 *
 *  - addRound: number = max(number das rodadas do torneio) + 1, ou 1 (3.2, 3.3)
 *  - listByTournament: ordenado crescentemente por number (3.4)
 *  - getPenalties(roundId): penalidades da rodada (3.6, 3.7)
 *  - deleteRound(confirmed): remove rodada + penalidades em cascata (3.8–3.10)
 */

import { ok, err, validationError } from "./result.js";
import { uid } from "./ids.js";

export class RoundService {
  /**
   * @param {{load:Function, save:Function}} storage
   * @param {() => number} [clock]
   */
  constructor(storage, clock = () => Date.now()) {
    this._storage = storage;
    this._clock = clock;
  }

  listByTournament(tournamentId) {
    const state = this._storage.load();
    return state.rounds
      .filter((r) => r.tournamentId === tournamentId)
      .sort((a, b) => a.number - b.number);
  }

  getRound(roundId) {
    const state = this._storage.load();
    return state.rounds.find((r) => r.id === roundId) || null;
  }

  getPenalties(roundId) {
    const state = this._storage.load();
    return state.penalties
      .filter((p) => p.roundId === roundId)
      .sort((a, b) => a.createdAt - b.createdAt);
  }

  addRound(tournamentId) {
    const state = this._storage.load();
    const exists = state.tournaments.some((t) => t.id === tournamentId);
    if (!exists) {
      return err(validationError("tournamentId", "Torneio não encontrado.", "notFound"));
    }
    const roundsOfT = state.rounds.filter((r) => r.tournamentId === tournamentId);
    const nextNumber =
      roundsOfT.reduce((max, r) => Math.max(max, r.number), 0) + 1;
    const round = {
      id: uid(),
      tournamentId,
      number: nextNumber,
      createdAt: this._clock(),
    };
    state.rounds.push(round);
    this._storage.save(state);
    return ok(round);
  }

  /* confirmed=false não altera (3.10); true remove rodada + penalidades (3.9). */
  deleteRound(roundId, confirmed) {
    if (!confirmed) return ok(undefined);
    const state = this._storage.load();
    const exists = state.rounds.some((r) => r.id === roundId);
    if (!exists) return ok(undefined);

    state.rounds = state.rounds.filter((r) => r.id !== roundId);
    state.penalties = state.penalties.filter((p) => p.roundId !== roundId);
    this._storage.save(state);
    return ok(undefined);
  }
}
