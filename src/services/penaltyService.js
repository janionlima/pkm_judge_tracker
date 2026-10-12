/*
 * PenaltyService — registro de penalidades (Requisitos 4, 5, 6, 7).
 * Principal ponto de integração com o domínio (rules.js): toda recomendação,
 * filtro de severidade e escalonamento delega a rules.js (sem regra duplicada).
 */

import {
  severitiesForCategory,
  recommendedPenalty,
  suggestEscalation,
  isValidCategory,
  isValidSeverity,
  isValidPenalty,
  isValidCombination,
  requiresHeadJudgeConfirmation,
} from "../domain/rules.js";
import { ok, err, validationError, isNonEmpty, lengthOf } from "./result.js";
import { uid } from "./ids.js";

const DESC_MIN = 1;
const DESC_MAX = 1000;
const CONFIRMER_ROLES = ["head_judge", "assistant_head_judge"];

export class PenaltyService {
  /**
   * @param {{load:Function, save:Function}} storage
   * @param {() => number} [clock]
   */
  constructor(storage, clock = () => Date.now()) {
    this._storage = storage;
    this._clock = clock;
  }

  /* Severidades válidas para a categoria (Req 4.5) — delega ao domínio. */
  severityOptions(categoryId) {
    return severitiesForCategory(categoryId);
  }

  /* Penalidade recomendada para (categoria, severidade) (Req 4.9, 5.*). */
  recommendedFor(categoryId, severityId) {
    return recommendedPenalty(categoryId, severityId);
  }

  /*
   * Avalia reincidência (Req 6): conta penalidades anteriores da MESMA categoria
   * e MESMO playerId no MESMO torneio, e consulta suggestEscalation().
   * @returns {{base,suggested,escalated,priorCount}}
   */
  evaluateEscalation({ tournamentId, playerId, categoryId, severityId }) {
    const priorCount = this.countPrior({ tournamentId, playerId, categoryId });
    return suggestEscalation(categoryId, severityId, priorCount);
  }

  /* Contagem escopada (Req 6.1): categoria + playerId + torneio. */
  countPrior({ tournamentId, playerId, categoryId }) {
    const state = this._storage.load();
    const pid = (playerId || "").trim();
    return state.penalties.filter(
      (p) =>
        p.tournamentId === tournamentId &&
        p.categoryId === categoryId &&
        p.playerId === pid
    ).length;
  }

  /*
   * Persiste a penalidade (Req 4, 7). Valida campos obrigatórios, combinação
   * (categoria, severidade), conjunto fechado da penalidade e confirmação do
   * Head Judge para penalidades acima de Warning.
   */
  record(input) {
    const errors = this._validate(input);
    if (errors.length > 0) return err(errors);

    const state = this._storage.load();
    const round = state.rounds.find((r) => r.id === input.roundId);
    if (!round) {
      return err(validationError("roundId", "Rodada não encontrada.", "notFound"));
    }

    const penalty = {
      id: uid(),
      roundId: round.id,
      tournamentId: round.tournamentId,
      categoryId: input.categoryId,
      severityId: input.severityId,
      penaltyId: input.penaltyId,
      playerId: input.playerId.trim(),
      description: input.description,
      confirmerRole: requiresHeadJudgeConfirmation(input.penaltyId)
        ? input.confirmerRole
        : null,
      createdAt: this._clock(),
    };
    state.penalties.push(penalty);
    this._storage.save(state);
    return ok(penalty);
  }

  /* Remove uma penalidade pelo id. */
  remove(penaltyId) {
    const state = this._storage.load();
    const before = state.penalties.length;
    state.penalties = state.penalties.filter((p) => p.id !== penaltyId);
    if (state.penalties.length !== before) this._storage.save(state);
    return ok(undefined);
  }

  _validate(input) {
    const errors = [];
    const data = input || {};

    // Categoria
    if (!isNonEmpty(data.categoryId)) {
      errors.push(validationError("categoryId", "Selecione a categoria.", "required"));
    } else if (!isValidCategory(data.categoryId)) {
      errors.push(validationError("categoryId", "Categoria inválida.", "invalid"));
    }

    // Player ID
    if (!isNonEmpty(data.playerId)) {
      errors.push(validationError("playerId", "Informe o Player ID do infrator.", "required"));
    }

    // Severidade
    if (!isNonEmpty(data.severityId)) {
      errors.push(validationError("severityId", "Selecione a severidade.", "required"));
    } else if (!isValidSeverity(data.severityId)) {
      errors.push(validationError("severityId", "Severidade inválida.", "invalid"));
    }

    // Penalidade (conjunto fechado)
    if (!isNonEmpty(data.penaltyId)) {
      errors.push(validationError("penaltyId", "Selecione a penalidade.", "required"));
    } else if (!isValidPenalty(data.penaltyId)) {
      errors.push(validationError("penaltyId", "Penalidade inválida.", "invalid"));
    }

    // Descrição 1–1000
    if (!isNonEmpty(data.description)) {
      errors.push(validationError("description", "Descreva a situação.", "required"));
    } else if (lengthOf(data.description) < DESC_MIN || lengthOf(data.description) > DESC_MAX) {
      errors.push(
        validationError("description", `Descrição deve ter de ${DESC_MIN} a ${DESC_MAX} caracteres.`, "length")
      );
    }

    // Combinação (categoria, severidade) válida em §5 (Req 4.8).
    if (
      isValidCategory(data.categoryId) &&
      isValidSeverity(data.severityId) &&
      !isValidCombination(data.categoryId, data.severityId)
    ) {
      errors.push(
        validationError("severityId", "Combinação de categoria e severidade inválida.", "combination")
      );
    }

    // Confirmação do Head/Assistant Head Judge acima de Warning (Req 7.1, 7.2).
    if (isValidPenalty(data.penaltyId) && requiresHeadJudgeConfirmation(data.penaltyId)) {
      if (!CONFIRMER_ROLES.includes(data.confirmerRole)) {
        errors.push(
          validationError(
            "confirmerRole",
            "Confirmação por Head Judge ou Assistant Head Judge é obrigatória.",
            "required"
          )
        );
      }
    }

    return errors;
  }
}
