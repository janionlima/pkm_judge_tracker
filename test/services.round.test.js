import { describe, it, expect } from "vitest";
import fc from "fast-check";
import { RoundService } from "../src/services/roundService.js";
import { TournamentService } from "../src/services/tournamentService.js";
import { MemoryStorageAdapter } from "../src/storage/memoryStorageAdapter.js";

const RUNS = { numRuns: 100 };

const validTournament = {
  description: "Liga",
  eventDate: "2026-08-01",
  sanctioningNumber: "AB-CD-123456",
  organizerId: "999",
};

function setup() {
  const storage = new MemoryStorageAdapter();
  let tick = 0;
  const tsvc = new TournamentService(storage, undefined, () => ++tick);
  const rsvc = new RoundService(storage, () => ++tick);
  const t = tsvc.create(validTournament).value;
  return { storage, rsvc, tsvc, t };
}

/*
 * Feature: pokemon-judge-penalty-tracker, Property 9: Para qualquer torneio ao
 * qual sejam adicionadas k rodadas em sequência, os números atribuídos são
 * exatamente 1, 2, …, k, e a listagem é ordenada crescentemente por número.
 */
describe("Property 9: numeração sequencial e contígua das rodadas", () => {
  it("k adições geram números 1..k e listagem crescente", () => {
    fc.assert(
      fc.property(fc.integer({ min: 1, max: 30 }), (k) => {
        const { rsvc, t } = setup();
        const assigned = [];
        for (let i = 0; i < k; i++) {
          assigned.push(rsvc.addRound(t.id).value.number);
        }
        expect(assigned).toEqual(Array.from({ length: k }, (_, i) => i + 1));
        const listed = rsvc.listByTournament(t.id).map((r) => r.number);
        expect(listed).toEqual(Array.from({ length: k }, (_, i) => i + 1));
      }),
      RUNS
    );
  });

  it("numeração é por torneio (não global)", () => {
    const storage = new MemoryStorageAdapter();
    let tick = 0;
    const tsvc = new TournamentService(storage, undefined, () => ++tick);
    const rsvc = new RoundService(storage, () => ++tick);
    const a = tsvc.create(validTournament).value;
    const b = tsvc.create(validTournament).value;
    rsvc.addRound(a.id);
    rsvc.addRound(a.id);
    const firstOfB = rsvc.addRound(b.id).value;
    expect(firstOfB.number).toBe(1);
  });
});

/*
 * Feature: pokemon-judge-penalty-tracker, Property 8: exclusão de rodada em
 * cascata com/sem confirmação. (parte rodada)
 */
describe("Property 8: exclusão de rodada em cascata e confirmação", () => {
  it("deleteRound(confirmed=true) remove rodada e penalidades; false não altera", () => {
    fc.assert(
      fc.property(fc.boolean(), (confirmed) => {
        const { storage, rsvc, t } = setup();
        const round = rsvc.addRound(t.id).value;
        const state = storage.load();
        state.penalties.push({
          id: "p1",
          roundId: round.id,
          tournamentId: t.id,
          categoryId: "cheating",
          severityId: "severe",
          penaltyId: "disqualification",
          playerId: "1",
          description: "x",
          confirmerRole: "head_judge",
          createdAt: 99,
        });
        storage.save(state);

        rsvc.deleteRound(round.id, confirmed);
        const after = storage.load();
        if (confirmed) {
          expect(after.rounds.filter((r) => r.id === round.id)).toHaveLength(0);
          expect(after.penalties.filter((p) => p.roundId === round.id)).toHaveLength(0);
        } else {
          expect(after.rounds.filter((r) => r.id === round.id)).toHaveLength(1);
          expect(after.penalties.filter((p) => p.roundId === round.id)).toHaveLength(1);
        }
      }),
      RUNS
    );
  });
});

describe("RoundService: estados vazios (dados para a UI — Req 3.5, 3.7)", () => {
  it("torneio sem rodadas -> lista vazia", () => {
    const { rsvc, t } = setup();
    expect(rsvc.listByTournament(t.id)).toEqual([]);
  });

  it("rodada sem penalidades -> lista vazia", () => {
    const { rsvc, t } = setup();
    const round = rsvc.addRound(t.id).value;
    expect(rsvc.getPenalties(round.id)).toEqual([]);
  });

  it("addRound em torneio inexistente retorna erro", () => {
    const { rsvc } = setup();
    const res = rsvc.addRound("nao-existe");
    expect(res.ok).toBe(false);
  });

  it("getPenalties retorna ordenado por createdAt", () => {
    const { storage, rsvc, t } = setup();
    const round = rsvc.addRound(t.id).value;
    const state = storage.load();
    state.penalties.push(
      { id: "b", roundId: round.id, tournamentId: t.id, categoryId: "cheating", severityId: "severe", penaltyId: "disqualification", playerId: "1", description: "", confirmerRole: "head_judge", createdAt: 20 },
      { id: "a", roundId: round.id, tournamentId: t.id, categoryId: "cheating", severityId: "severe", penaltyId: "disqualification", playerId: "1", description: "", confirmerRole: "head_judge", createdAt: 10 }
    );
    storage.save(state);
    const ids = rsvc.getPenalties(round.id).map((p) => p.id);
    expect(ids).toEqual(["a", "b"]);
  });
});
