/*
 * ProfileService — perfil singleton do juiz (Requisitos 1.1–1.7).
 *
 * Validações:
 *  - firstName, lastName, judgeId, dateOfBirth obrigatórios (não-vazios) (1.2)
 *  - dateOfBirth <= data atual do dispositivo e data válida (1.3)
 *  - firstName/lastName <= 50; judgeId <= 20 (1.4)
 * Em erro: não persiste e retorna a lista de campos inválidos (a view preserva
 * o que foi digitado).
 */

import {
  ok,
  err,
  validationError,
  isNonEmpty,
  lengthOf,
  isValidIsoDate,
  isoDateNotAfter,
  todayIso,
} from "./result.js";

const MAX_NAME = 50;
const MAX_JUDGE_ID = 20;

export class ProfileService {
  /**
   * @param {{load:Function, save:Function}} storage  StorageAdapter injetado.
   * @param {() => Date} [now]  Fonte de tempo (injetável para testes).
   */
  constructor(storage, now = () => new Date()) {
    this._storage = storage;
    this._now = now;
  }

  /* Retorna o perfil salvo ou null (Req 1.6). */
  getProfile() {
    const state = this._storage.load();
    return state.profile || null;
  }

  /*
   * Valida e persiste o perfil (cria ou substitui — Req 1.1, 1.5).
   * @returns {{ok:true,value:Profile}|{ok:false,errors:ValidationError[]}}
   */
  saveProfile(input) {
    const errors = this._validate(input);
    if (errors.length > 0) return err(errors);

    const profile = {
      firstName: input.firstName.trim(),
      lastName: input.lastName.trim(),
      judgeId: input.judgeId.trim(),
      dateOfBirth: input.dateOfBirth,
    };

    const state = this._storage.load();
    state.profile = profile;
    this._storage.save(state); // pode lançar StorageWriteError/StorageQuotaError
    return ok(profile);
  }

  _validate(input) {
    const errors = [];
    const data = input || {};

    if (!isNonEmpty(data.firstName)) {
      errors.push(validationError("firstName", "Informe o primeiro nome.", "required"));
    } else if (lengthOf(data.firstName) > MAX_NAME) {
      errors.push(
        validationError("firstName", `Primeiro nome deve ter no máximo ${MAX_NAME} caracteres.`, "maxLength")
      );
    }

    if (!isNonEmpty(data.lastName)) {
      errors.push(validationError("lastName", "Informe o último nome.", "required"));
    } else if (lengthOf(data.lastName) > MAX_NAME) {
      errors.push(
        validationError("lastName", `Último nome deve ter no máximo ${MAX_NAME} caracteres.`, "maxLength")
      );
    }

    if (!isNonEmpty(data.judgeId)) {
      errors.push(validationError("judgeId", "Informe o Judge ID.", "required"));
    } else if (lengthOf(data.judgeId) > MAX_JUDGE_ID) {
      errors.push(
        validationError("judgeId", `Judge ID deve ter no máximo ${MAX_JUDGE_ID} caracteres.`, "maxLength")
      );
    }

    if (!isNonEmpty(data.dateOfBirth)) {
      errors.push(validationError("dateOfBirth", "Informe a data de nascimento.", "required"));
    } else if (!isValidIsoDate(data.dateOfBirth)) {
      errors.push(validationError("dateOfBirth", "Data de nascimento inválida.", "invalidDate"));
    } else if (!isoDateNotAfter(data.dateOfBirth, todayIso(this._now()))) {
      errors.push(
        validationError("dateOfBirth", "Data de nascimento não pode ser futura.", "future")
      );
    }

    return errors;
  }
}
