import { describe, it, expect } from "vitest";
import fc from "fast-check";
import { MemoryStorageAdapter } from "../src/storage/memoryStorageAdapter.js";
import {
  StorageWriteError,
  StorageQuotaError,
  StorageCorruptedError,
} from "../src/storage/errors.js";
import { emptyState, SCHEMA_VERSION } from "../src/storage/appState.js";

const RUNS = { numRuns: 100 };

// Arbitrário de AppState válido (estrutura mínima, dados arbitrários).
const arbProfile = fc.option(
  fc.record({
    firstName: fc.string(),
    lastName: fc.string(),
    judgeId: fc.string(),
    dateOfBirth: fc.string(),
  }),
  { nil: null }
);

const arbTournament = fc.record({
  id: fc.string(),
  description: fc.string(),
  eventDate: fc.string(),
  sanctioningNumber: fc.string(),
  organizerId: fc.string(),
  createdAt: fc.integer({ min: 0 }),
});

const arbRound = fc.record({
  id: fc.string(),
  tournamentId: fc.string(),
  number: fc.integer({ min: 1 }),
  createdAt: fc.integer({ min: 0 }),
});

const arbPenalty = fc.record({
  id: fc.string(),
  roundId: fc.string(),
  tournamentId: fc.string(),
  categoryId: fc.string(),
  severityId: fc.string(),
  penaltyId: fc.string(),
  playerId: fc.string(),
  description: fc.string(),
  confirmerRole: fc.option(fc.string(), { nil: null }),
  createdAt: fc.integer({ min: 0 }),
});

const arbState = fc.record({
  schemaVersion: fc.constant(SCHEMA_VERSION),
  profile: arbProfile,
  tournaments: fc.array(arbTournament, { maxLength: 8 }),
  rounds: fc.array(arbRound, { maxLength: 12 }),
  penalties: fc.array(arbPenalty, { maxLength: 20 }),
});

/*
 * Feature: pokemon-judge-penalty-tracker, Property 1: Para qualquer AppState
 * válido, gravá-lo via save() e em seguida carregá-lo via load() produz um
 * estado estruturalmente igual ao original.
 */
describe("Property 1: round-trip de persistência do estado", () => {
  it("save -> load preserva o estado estruturalmente", () => {
    fc.assert(
      fc.property(arbState, (state) => {
        const adapter = new MemoryStorageAdapter();
        adapter.save(state);
        const loaded = adapter.load();
        expect(loaded).toEqual(state);
      }),
      RUNS
    );
  });
});

describe("MemoryStorageAdapter: estado vazio e erros", () => {
  it("load() sem dados retorna estado vazio canônico", () => {
    const adapter = new MemoryStorageAdapter();
    expect(adapter.load()).toEqual(emptyState());
  });

  it("save() lança StorageQuotaError quando configurado (Req 10.3)", () => {
    const adapter = new MemoryStorageAdapter(null, { failQuota: true });
    expect(() => adapter.save(emptyState())).toThrow(StorageQuotaError);
  });

  it("save() lança StorageWriteError quando configurado (Req 10.2)", () => {
    const adapter = new MemoryStorageAdapter(null, { failWrite: true });
    expect(() => adapter.save(emptyState())).toThrow(StorageWriteError);
  });

  it("load() lança StorageCorruptedError quando configurado (Req 10.6)", () => {
    const adapter = new MemoryStorageAdapter(null, { corrupted: true });
    expect(() => adapter.load()).toThrow(StorageCorruptedError);
  });
});
