/*
 * TournamentService — CRUD de torneios (Requisitos 2.1–2.14).
 *
 * Validações (create/update):
 *  - description obrigatória, 1–200 (2.3, 2.5)
 *  - sanctioningNumber obrigatório, 1–50 (2.4, 2.5)
 *  - organizerId obrigatório (2.5)
 *  - eventDate obrigatória e válida (2.5, 2.6)
 * Geração de id XX-XX-XXXXXX único (2.2, 2.13, 2.14); update preserva o id (2.10);
 * delete em cascata com confirmação (2.11, 2.12).
 */

import {
  ok,
  err,
  validationError,
  isNonEmpty,
  lengthOf,
  isValidIsoDate,
} from "./result.js";
import { generateRecordId, isValidSanctioningNumber } from "./ids.js";

const DESC_MIN = 1;
const DESC_MAX = 200;

export class TournamentService {
  /**
   * @param {{load:Function, save:Function}} storage
   * @param {() => string} [idGenerator]  Gerador do ID de cadastro (injetável p/ testes de colisão).
   * @param {() => number} [clock]  Fonte de createdAt (injetável).
   */
  constructor(storage, idGenerator = generateRecordId, clock = () => Date.now()) {
    this._storage = storage;
    this._genId = idGenerator;
    this._clock = clock;
  }

  /* Resumo para listagem: id, descrição e data (Req 2.7). */
  list() {
    const state = this._storage.load();
    return state.tournaments.map((t) => ({
      id: t.id,
      description: t.description,
      eventDate: t.eventDate,
      sanctioningNumber: t.sanctioningNumber,
    }));
  }

  get(id) {
    const state = this._storage.load();
    return state.tournaments.find((t) => t.id === id) || null;
  }

  create(input) {
    const errors = this._validate(input);
    if (errors.length > 0) return err(errors);

    const state = this._storage.load();
    const id = this._uniqueId(state.tournaments);
    const tournament = {
      id,
      description: input.description.trim(),
      eventDate: input.eventDate,
      sanctioningNumber: input.sanctioningNumber.trim(),
      organizerId: input.organizerId.trim(),
      createdAt: this._clock(),
    };
    state.tournaments.push(tournament);
    this._storage.save(state);
    return ok(tournament);
  }

  update(id, input) {
    const state = this._storage.load();
    const t = state.tournaments.find((x) => x.id === id);
    if (!t) return err(validationError("id", "Torneio não encontrado.", "notFound"));

    const errors = this._validate(input);
    if (errors.length > 0) return err(errors);

    // Preserva id e createdAt (Req 2.10).
    t.description = input.description.trim();
    t.eventDate = input.eventDate;
    t.sanctioningNumber = input.sanctioningNumber.trim();
    t.organizerId = input.organizerId.trim();
    this._storage.save(state);
    return ok(t);
  }

  /*
   * Exclui o torneio e, em cascata, suas rodadas e penalidades (Req 2.11).
   * confirmed=false não altera nada (Req 2.12).
   */
  delete(id, confirmed) {
    if (!confirmed) return ok(undefined);
    const state = this._storage.load();
    const exists = state.tournaments.some((t) => t.id === id);
    if (!exists) return ok(undefined);

    state.tournaments = state.tournaments.filter((t) => t.id !== id);
    state.rounds = state.rounds.filter((r) => r.tournamentId !== id);
    state.penalties = state.penalties.filter((p) => p.tournamentId !== id);
    this._storage.save(state);
    return ok(undefined);
  }

  /* Gera um id distinto dos existentes (regenera em colisão — Req 2.13, 2.14). */
  _uniqueId(existing) {
    const taken = new Set(existing.map((t) => t.id));
    let id = this._genId();
    while (taken.has(id)) {
      id = this._genId();
    }
    return id;
  }

  _validate(input) {
    const errors = [];
    const data = input || {};

    if (!isNonEmpty(data.description)) {
      errors.push(validationError("description", "Informe a descrição.", "required"));
    } else if (lengthOf(data.description) < DESC_MIN || lengthOf(data.description) > DESC_MAX) {
      errors.push(
        validationError("description", `Descrição deve ter de ${DESC_MIN} a ${DESC_MAX} caracteres.`, "length")
      );
    }

    if (!isNonEmpty(data.sanctioningNumber)) {
      errors.push(validationError("sanctioningNumber", "Informe o número de sancionamento.", "required"));
    } else if (!isValidSanctioningNumber(data.sanctioningNumber.trim())) {
      errors.push(
        validationError(
          "sanctioningNumber",
          "Número de sancionamento deve seguir o formato XX-XX-XXXXXX (alfanumérico).",
          "format"
        )
      );
    }

    if (!isNonEmpty(data.organizerId)) {
      errors.push(validationError("organizerId", "Informe o id do organizador.", "required"));
    }

    if (!isNonEmpty(data.eventDate)) {
      errors.push(validationError("eventDate", "Informe a data de realização.", "required"));
    } else if (!isValidIsoDate(data.eventDate)) {
      errors.push(validationError("eventDate", "Data de realização inválida.", "invalidDate"));
    }

    return errors;
  }
}
