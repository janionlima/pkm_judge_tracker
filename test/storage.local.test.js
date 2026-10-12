// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from "vitest";
import { LocalStorageAdapter } from "../src/storage/localStorageAdapter.js";
import { MemoryStorageAdapter } from "../src/storage/memoryStorageAdapter.js";
import {
  StorageQuotaError,
  StorageWriteError,
  StorageCorruptedError,
} from "../src/storage/errors.js";
import {
  emptyState,
  STATE_KEY,
  SCHEMA_VERSION,
} from "../src/storage/appState.js";

function sampleState() {
  return {
    schemaVersion: SCHEMA_VERSION,
    profile: {
      firstName: "Ana",
      lastName: "Souza",
      judgeId: "123456",
      dateOfBirth: "1990-05-10",
    },
    tournaments: [
      {
        id: "AB-CD-123456",
        description: "Liga Local",
        eventDate: "2026-08-01",
        sanctioningNumber: "SN-001",
        organizerId: "999",
        createdAt: 1,
      },
    ],
    rounds: [{ id: "r1", tournamentId: "AB-CD-123456", number: 1, createdAt: 2 }],
    penalties: [
      {
        id: "p1",
        roundId: "r1",
        tournamentId: "AB-CD-123456",
        categoryId: "procedural_error",
        severityId: "minor",
        penaltyId: "caution",
        playerId: "555",
        description: "Entrou em área restrita",
        confirmerRole: null,
        createdAt: 3,
      },
    ],
  };
}

describe("LocalStorageAdapter (jsdom)", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("isAvailable() verdadeiro com localStorage do jsdom", () => {
    expect(new LocalStorageAdapter().isAvailable()).toBe(true);
  });

  it("round-trip real: save -> load preserva o estado (Req 10.5)", () => {
    const adapter = new LocalStorageAdapter();
    const state = sampleState();
    adapter.save(state);
    expect(adapter.load()).toEqual(state);
  });

  it("load() sem dados retorna estado vazio", () => {
    expect(new LocalStorageAdapter().load()).toEqual(emptyState());
  });

  it("paridade com MemoryStorageAdapter para o mesmo estado", () => {
    const state = sampleState();
    const local = new LocalStorageAdapter();
    const mem = new MemoryStorageAdapter();
    local.save(state);
    mem.save(state);
    expect(local.load()).toEqual(mem.load());
  });

  it("JSON inválido -> StorageCorruptedError sem sobrescrever a chave (Req 10.6)", () => {
    window.localStorage.setItem(STATE_KEY, "{nao-é-json");
    const adapter = new LocalStorageAdapter();
    expect(() => adapter.load()).toThrow(StorageCorruptedError);
    // Chave original permanece intacta para recuperação.
    expect(window.localStorage.getItem(STATE_KEY)).toBe("{nao-é-json");
  });

  it("esquema incompatível -> StorageCorruptedError sem sobrescrever (Req 10.6)", () => {
    const bad = JSON.stringify({ schemaVersion: 999, foo: "bar" });
    window.localStorage.setItem(STATE_KEY, bad);
    const adapter = new LocalStorageAdapter();
    expect(() => adapter.load()).toThrow(StorageCorruptedError);
    expect(window.localStorage.getItem(STATE_KEY)).toBe(bad);
  });
});

describe("LocalStorageAdapter com Storage injetado (erros de escrita)", () => {
  it("QuotaExceededError -> StorageQuotaError, sem sobrescrever valor existente (Req 10.3)", () => {
    let stored = "valor-anterior";
    const quotaStorage = {
      getItem: (k) => (k === STATE_KEY ? stored : null),
      setItem: () => {
        const e = new Error("quota");
        e.name = "QuotaExceededError";
        throw e;
      },
      removeItem: () => {},
    };
    const adapter = new LocalStorageAdapter(quotaStorage);
    expect(() => adapter.save(emptyState())).toThrow(StorageQuotaError);
    // setItem falhou antes de alterar o valor existente.
    expect(stored).toBe("valor-anterior");
  });

  it("falha genérica de escrita -> StorageWriteError (Req 10.2)", () => {
    const failingStorage = {
      getItem: () => null,
      setItem: () => {
        throw new Error("disco cheio de outra forma");
      },
      removeItem: () => {},
    };
    const adapter = new LocalStorageAdapter(failingStorage);
    expect(() => adapter.save(emptyState())).toThrow(StorageWriteError);
  });
});
