/*
 * Adaptador sobre window.localStorage. Grava o AppState inteiro de uma vez
 * (gravação atômica da raiz) e trata quota, falha de escrita e corrupção.
 *
 * Requisitos: 10.1, 10.2, 10.3, 10.5, 10.6.
 */

import {
  SCHEMA_VERSION,
  STATE_KEY,
  SCHEMA_VERSION_KEY,
  emptyState,
  isValidState,
  normalizeState,
} from "./appState.js";
import {
  StorageCorruptedError,
  StorageQuotaError,
  StorageWriteError,
} from "./errors.js";

/* Detecta QuotaExceededError de forma robusta entre navegadores. */
function isQuotaError(err) {
  if (!err) return false;
  return (
    err.name === "QuotaExceededError" ||
    err.name === "NS_ERROR_DOM_QUOTA_REACHED" ||
    err.code === 22 ||
    err.code === 1014
  );
}

export class LocalStorageAdapter {
  /** @param {Storage} [storage]  Injetável para testes (default: window.localStorage). */
  constructor(storage) {
    this._storage =
      storage ||
      (typeof window !== "undefined" ? window.localStorage : undefined);
  }

  isAvailable() {
    try {
      const s = this._storage;
      if (!s) return false;
      const probe = "__pjpt_probe__";
      s.setItem(probe, "1");
      s.removeItem(probe);
      return true;
    } catch {
      return false;
    }
  }

  /*
   * Lê e desserializa o estado. Em conteúdo ausente -> estado vazio. Em JSON
   * inválido ou esquema incompatível -> lança StorageCorruptedError SEM
   * sobrescrever a chave original (Req 10.6); a camada superior inicia vazio.
   */
  load() {
    const s = this._storage;
    if (!s) return emptyState();

    const raw = s.getItem(STATE_KEY);
    if (raw == null) return emptyState();

    let parsed;
    try {
      parsed = JSON.parse(raw);
    } catch (err) {
      throw new StorageCorruptedError(undefined, { cause: err });
    }

    if (!isValidState(parsed)) {
      // Esquema desconhecido/incompatível: não sobrescreve, sinaliza corrupção.
      throw new StorageCorruptedError();
    }
    return parsed;
  }

  /*
   * Serializa o estado inteiro e grava atomicamente. Em quota -> StorageQuotaError
   * (nada é sobrescrito, pois setItem falha antes de alterar o valor existente);
   * outras falhas -> StorageWriteError.
   */
  save(state) {
    const s = this._storage;
    if (!s) throw new StorageWriteError("Armazenamento local indisponível.");

    const normalized = normalizeState(state);
    let serialized;
    try {
      serialized = JSON.stringify(normalized);
    } catch (err) {
      throw new StorageWriteError("Estado não serializável.", { cause: err });
    }

    try {
      s.setItem(STATE_KEY, serialized);
      s.setItem(SCHEMA_VERSION_KEY, String(SCHEMA_VERSION));
    } catch (err) {
      if (isQuotaError(err)) {
        throw new StorageQuotaError(undefined, { cause: err });
      }
      throw new StorageWriteError(undefined, { cause: err });
    }
  }
}
