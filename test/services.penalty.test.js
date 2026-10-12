import { describe, it, expect } from "vitest";
import fc from "fast-check";
import { PenaltyService } from "../src/services/penaltyService.js";
import { RoundService } from "../src/services/roundService.js";
import { TournamentService } from "../src/services/tournamentService.js";
import { MemoryStorageAdapter } from "../src/storage/memoryStorageAdapter.js";
import {
  CATEGORIES,
  SEVERITIES,
  PENALTIES,
  PENALTY_RANK,
  recommendedPenalty,
  requiresHeadJudgeConfirmation,
} from "../src/domain/rules.js";

const RUNS = { numRuns: 100 };

function setup() {
  const storage = new MemoryStorageAdapter();
  let tick = 0;
  const tsvc = new TournamentService(storage, undefined, () => ++tick);
  const rsvc = new RoundService(storage, () => ++tick);
  const psvc = new PenaltyService(storage, () => ++tick);
  const t = tsvc.create({
    description: "Liga",
    eventDate: "2026-08-01",
    sanctioningNumber: "AB-CD-123456",
    organizerId: "999",
  }).value;
  const round = rsvc.addRound(t.id).value;
  return { storage, psvc, rsvc, t, round };
}

// Penalidade base válida (Caution: não exige confirmação).
function cautionInput(round, overrides = {}) {
  return {
    roundId: round.id,
    categoryId: "procedural_error",
    severityId: "minor",
    penaltyId: "caution",
    playerId: "100",
    description: "Entrou em área restrita.",
    ...overrides,
  };
}

const arbBlank = fc.stringOf(fc.constantFrom(" ", "\t", "\n"), { maxLength: 5 });

describe("PenaltyService: severidade/recomendação delegadas ao domínio", () => {
  it("severityOptions e recommendedFor refletem rules.js", () => {
    const { psvc } = setup();
    expect(psvc.severityOptions("pace_of_play").map((s) => s.id)).toEqual(["minor", "severe"]);
    expect(psvc.recommendedFor("cheating", "minor")).toBe("disqualification");
  });

  it("registra penalidade Caution válida (sem confirmação)", () => {
    const { psvc, round } = setup();
    const res = psvc.record(cautionInput(round));
    expect(res.ok).toBe(true);
    expect(res.value.tournamentId).toBeDefined();
    expect(res.value.confirmerRole).toBeNull();
  });
});

/*
 * Feature: pokemon-judge-penalty-tracker, Property 12: Para qualquer par
 * (categoria, severidade) sem penalidade recomendada em §5, o registro é
 * rejeitado, nada é persistido e os valores informados são preservados.
 */
describe("Property 12: combinação inválida é rejeitada", () => {
  it("categorias sem Major rejeitam severity=major", () => {
    const noMajor = ["gameplay_error_vg", "gameplay_error_go", "pace_of_play"];
    fc.assert(
      fc.property(fc.constantFrom(...noMajor), (categoryId) => {
        const { storage, psvc, round } = setup();
        const before = storage.load().penalties.length;
        const res = psvc.record(
          cautionInput(round, { categoryId, severityId: "major", penaltyId: "warning" })
        );
        expect(res.ok).toBe(false);
        expect(res.errors.some((e) => e.field === "severityId")).toBe(true);
        expect(storage.load().penalties.length).toBe(before);
      }),
      RUNS
    );
  });
});

/*
 * Feature: pokemon-judge-penalty-tracker, Property 13: a contagem de prévios
 * considera exatamente penalidades da mesma categoria, mesmo playerId e mesmo
 * torneio.
 */
describe("Property 13: contagem de reincidência é escopada", () => {
  it("conta só mesma categoria + mesmo playerId + mesmo torneio", () => {
    fc.assert(
      fc.property(
        fc.record({
          sameCat: fc.integer({ min: 0, max: 5 }),
          otherCat: fc.integer({ min: 0, max: 5 }),
          otherPlayer: fc.integer({ min: 0, max: 5 }),
          otherTourney: fc.integer({ min: 0, max: 5 }),
        }),
        ({ sameCat, otherCat, otherPlayer, otherTourney }) => {
          const storage = new MemoryStorageAdapter();
          let tick = 0;
          const tsvc = new TournamentService(storage, undefined, () => ++tick);
          const rsvc = new RoundService(storage, () => ++tick);
          const psvc = new PenaltyService(storage, () => ++tick);
          const tA = tsvc.create({ description: "A", eventDate: "2026-08-01", sanctioningNumber: "AA-AA-000001", organizerId: "1" }).value;
          const tB = tsvc.create({ description: "B", eventDate: "2026-08-01", sanctioningNumber: "BB-BB-000002", organizerId: "1" }).value;
          const rA = rsvc.addRound(tA.id).value;
          const rB = rsvc.addRound(tB.id).value;

          const push = (round, categoryId, playerId) => {
            const st = storage.load();
            st.penalties.push({
              id: "x" + st.penalties.length,
              roundId: round.id,
              tournamentId: round.tournamentId,
              categoryId,
              severityId: "minor",
              penaltyId: "warning",
              playerId,
              description: "",
              confirmerRole: null,
              createdAt: ++tick,
            });
            storage.save(st);
          };

          for (let i = 0; i < sameCat; i++) push(rA, "tardiness", "P1");
          for (let i = 0; i < otherCat; i++) push(rA, "unsporting_conduct", "P1");
          for (let i = 0; i < otherPlayer; i++) push(rA, "tardiness", "P2");
          for (let i = 0; i < otherTourney; i++) push(rB, "tardiness", "P1");

          const count = psvc.countPrior({
            tournamentId: tA.id,
            playerId: "P1",
            categoryId: "tardiness",
          });
          expect(count).toBe(sameCat);
        }
      ),
      RUNS
    );
  });

  it("evaluateEscalation sinaliza escalonamento após 1 prévio (categoria que escala)", () => {
    const { storage, psvc, round, t } = setup();
    const st = storage.load();
    st.penalties.push({
      id: "prev",
      roundId: round.id,
      tournamentId: t.id,
      categoryId: "tardiness",
      severityId: "minor",
      penaltyId: "warning",
      playerId: "100",
      description: "",
      confirmerRole: null,
      createdAt: 50,
    });
    storage.save(st);
    const info = psvc.evaluateEscalation({
      tournamentId: t.id,
      playerId: "100",
      categoryId: "tardiness",
      severityId: "minor",
    });
    expect(info.priorCount).toBe(1);
    expect(info.escalated).toBe(true);
    expect(PENALTY_RANK[info.suggested]).toBe(PENALTY_RANK[info.base] + 1);
  });
});

/*
 * Feature: pokemon-judge-penalty-tracker, Property 16: confirmação obrigatória
 * acima de Warning; persiste o papel; Caution/Warning não exigem confirmação.
 */
describe("Property 16: confirmação do Head Judge acima de Warning", () => {
  it("penalidade > Warning sem confirmerRole é rejeitada; com é aceita e persistida", () => {
    const aboveWarning = PENALTIES.filter((p) => requiresHeadJudgeConfirmation(p.id)).map((p) => p.id);
    fc.assert(
      fc.property(
        fc.constantFrom(...aboveWarning),
        fc.constantFrom("head_judge", "assistant_head_judge"),
        (penaltyId, role) => {
          const { psvc, round } = setup();
          // Categoria/severidade que de fato recomenda essa penalidade não é
          // necessária aqui; usamos uma combinação válida e sobrescrevemos a
          // penalidade (campo editável — Req 4.9).
          const base = cautionInput(round, {
            categoryId: "unsporting_conduct",
            severityId: "severe",
            penaltyId,
          });

          const semConfirm = psvc.record({ ...base });
          expect(semConfirm.ok).toBe(false);
          expect(semConfirm.errors.some((e) => e.field === "confirmerRole")).toBe(true);

          const comConfirm = psvc.record({ ...base, confirmerRole: role });
          expect(comConfirm.ok).toBe(true);
          expect(comConfirm.value.confirmerRole).toBe(role);
        }
      ),
      RUNS
    );
  });

  it("Caution e Warning não exigem confirmação e gravam confirmerRole=null", () => {
    for (const penaltyId of ["caution", "warning"]) {
      const { psvc, round } = setup();
      const res = psvc.record(
        cautionInput(round, {
          categoryId: "procedural_error",
          severityId: penaltyId === "caution" ? "minor" : "major",
          penaltyId,
        })
      );
      expect(res.ok).toBe(true);
      expect(res.value.confirmerRole).toBeNull();
    }
  });
});

describe("Property 2 e 3: obrigatórios e limites (penalidade)", () => {
  it("campo obrigatório em branco rejeita e não persiste", () => {
    fc.assert(
      fc.property(
        fc.constantFrom("categoryId", "playerId", "severityId", "penaltyId", "description"),
        arbBlank,
        (field, blank) => {
          const { storage, psvc, round } = setup();
          const before = storage.load().penalties.length;
          const res = psvc.record(cautionInput(round, { [field]: blank }));
          expect(res.ok).toBe(false);
          expect(res.errors.some((e) => e.field === field)).toBe(true);
          expect(storage.load().penalties.length).toBe(before);
        }
      ),
      RUNS
    );
  });

  it("description aceita sse 1..1000 caracteres", () => {
    fc.assert(
      fc.property(fc.integer({ min: 1, max: 1200 }), (len) => {
        const { psvc, round } = setup();
        const desc = "a".repeat(len);
        const res = psvc.record(cautionInput(round, { description: desc }));
        expect(res.ok).toBe(len <= 1000);
      }),
      RUNS
    );
  });

  it("categoria/severidade/penalidade fora do conjunto fechado são rejeitadas", () => {
    const { psvc, round } = setup();
    expect(psvc.record(cautionInput(round, { categoryId: "inexistente" })).ok).toBe(false);
    expect(psvc.record(cautionInput(round, { severityId: "catastrofica" })).ok).toBe(false);
    expect(psvc.record(cautionInput(round, { penaltyId: "banimento" })).ok).toBe(false);
  });
});
