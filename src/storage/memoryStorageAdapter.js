/*
 * Adaptador de armazenamento em memória, usado em testes (injeção).
 * Clona na leitura e na escrita para garantir isolamento estrutural — útil
 * para a Property 1 (round-trip) e para evitar vazamento de referências.
 */

import {
  emptyState,
  isValidState,
  normalizeState,
  cloneState,
} from "./appState.js";
import {
  StorageCorruptedError,
  StorageQuotaError,
  StorageWriteError,
} from "./errors.js";

export class MemoryStorageAdapter {
  /**
   * @param {object|null} initial  Estado inicial (opcional).
   * @param {object} [opts]
   * @param {boolean} [opts.failWrite]  Lança StorageWriteError ao gravar.
   * @param {boolean} [opts.failQuota]  Lança StorageQuotaError ao gravar.
   * @param {boolean} [opts.corrupted]  Faz load() tratar como corrompido.
   */
  constructor(initial = null, opts = {}) {
    this._raw = initial ? JSON.stringify(initial) : null;
    this._opts = opts;
  }

  isAvailable() {
    return true;
  }

  load() {
    if (this._opts.corrupted) {
      // Simula conteúdo presente porém ilegível (Req 10.6).
      throw new StorageCorruptedError();
    }
    if (this._raw == null) return emptyState();
    let parsed;
    try {
      parsed = JSON.parse(this._raw);
    } catch (err) {
      throw new StorageCorruptedError(undefined, { cause: err });
    }
    if (!isValidState(parsed)) {
      const normalized = normalizeState(parsed);
      if (!isValidState(normalized)) throw new StorageCorruptedError();
      return normalized;
    }
    return cloneState(parsed);
  }

  save(state) {
    // Permite aos testes injetar falhas de escrita/quota.
    if (this._opts.failQuota) throw new StorageQuotaError();
    if (this._opts.failWrite) throw new StorageWriteError();
    this._raw = JSON.stringify(normalizeState(state));
  }
}
