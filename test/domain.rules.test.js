import { describe, it, expect } from "vitest";
import fc from "fast-check";
import {
  PENALTIES,
  PENALTY_RANK,
  SEVERITIES,
  CATEGORIES,
  recommendedPenalty,
  severitiesForCategory,
  suggestEscalation,
  isValidPenalty,
} from "../src/domain/rules.js";

const RUNS = { numRuns: 100 };

const categoryIds = CATEGORIES.map((c) => c.id);
const severityIds = SEVERITIES.map((s) => s.id);
const penaltyIds = PENALTIES.map((p) => p.id);
const DQ_RANK = PENALTY_RANK["disqualification"];

// Arbitrários
const arbCategory = fc.constantFrom(...categoryIds);
const arbSeverity = fc.constantFrom(...severityIds);

/*
 * Feature: pokemon-judge-penalty-tracker, Property 10: Para qualquer categoria,
 * as severidades oferecidas como selecionáveis são exatamente aquelas que
 * possuem penalidade recomendada definida em §5; em particular, Gameplay Error
 * (VG), Gameplay Error (GO) e Pace of Play oferecem somente Minor e Severe.
 */
describe("Property 10: severidades oferecidas == severidades válidas da categoria", () => {
  it("para toda categoria, severitiesForCategory == severidades com recommended definido", () => {
    for (const cat of CATEGORIES) {
      const offered = severitiesForCategory(cat.id).map((s) => s.id);
      const expected = SEVERITIES.filter((s) => cat.recommended[s.id]).map((s) => s.id);
      expect(offered).toEqual(expected);
    }
  });

  it("VG, GO e Pace of Play oferecem exatamente [minor, severe]", () => {
    for (const id of ["gameplay_error_vg", "gameplay_error_go", "pace_of_play"]) {
      const offered = severitiesForCategory(id).map((s) => s.id);
      expect(offered).toEqual(["minor", "severe"]);
    }
  });
});

/*
 * Feature: pokemon-judge-penalty-tracker, Property 11: Para qualquer categoria e
 * qualquer severidade válida dessa categoria, a penalidade inicial recomendada
 * é um valor definido pertencente ao conjunto fechado de penalidades.
 */
describe("Property 11: toda combinação válida tem penalidade recomendada no conjunto fechado", () => {
  it("recommendedPenalty retorna um id de PENALTIES para toda severidade válida", () => {
    fc.assert(
      fc.property(arbCategory, (categoryId) => {
        const valid = severitiesForCategory(categoryId).map((s) => s.id);
        for (const sev of valid) {
          const rec = recommendedPenalty(categoryId, sev);
          expect(rec).not.toBeNull();
          expect(isValidPenalty(rec)).toBe(true);
        }
      }),
      RUNS
    );
  });
});

/*
 * Feature: pokemon-judge-penalty-tracker, Property 14: Para qualquer categoria
 * que admite escalonamento, severidade válida e contagem de prévios n >= 0, a
 * penalidade sugerida tem posto min(postoBase + n, posto(Disqualification)); o
 * resultado nunca ultrapassa Disqualification e, quando n = 0, mantém a
 * recomendada sem sinalizar escalonamento.
 */
describe("Property 14: escalonamento eleva um nível por prévio, teto Disqualification", () => {
  it("suggested rank == min(baseRank + n, DQ) para categorias que escalam", () => {
    const escalating = CATEGORIES.filter((c) => c.escalates).map((c) => c.id);
    fc.assert(
      fc.property(
        fc.constantFrom(...escalating),
        arbSeverity,
        fc.integer({ min: 0, max: 20 }),
        (categoryId, severityId, n) => {
          fc.pre(recommendedPenalty(categoryId, severityId) !== null);
          const base = recommendedPenalty(categoryId, severityId);
          const info = suggestEscalation(categoryId, severityId, n);
          const expectedRank = Math.min(PENALTY_RANK[base] + n, DQ_RANK);
          expect(PENALTY_RANK[info.suggested]).toBe(expectedRank);
          expect(PENALTY_RANK[info.suggested]).toBeLessThanOrEqual(DQ_RANK);
          if (n === 0) {
            expect(info.suggested).toBe(base);
            expect(info.escalated).toBe(false);
          }
        }
      ),
      RUNS
    );
  });

  it("contagem negativa é tratada como 0 (nenhum escalonamento)", () => {
    fc.assert(
      fc.property(fc.integer({ min: -20, max: -1 }), (neg) => {
        const info = suggestEscalation("procedural_error", "minor", neg);
        expect(info.priorCount).toBe(0);
        expect(info.escalated).toBe(false);
        expect(info.suggested).toBe(info.base);
      }),
      RUNS
    );
  });
});

/*
 * Feature: pokemon-judge-penalty-tracker, Property 15: Para qualquer severidade e
 * qualquer contagem de prévios, a categoria Cheating mantém Disqualification
 * como penalidade recomendada e não sinaliza escalonamento.
 */
describe("Property 15: Cheating nunca escala", () => {
  it("Cheating mantém disqualification e escalated=false para qualquer n", () => {
    fc.assert(
      fc.property(arbSeverity, fc.integer({ min: 0, max: 50 }), (severityId, n) => {
        const info = suggestEscalation("cheating", severityId, n);
        expect(info.base).toBe("disqualification");
        expect(info.suggested).toBe("disqualification");
        expect(info.escalated).toBe(false);
      }),
      RUNS
    );
  });
});

// Testes por exemplo da tabela §5.1–§5.11 (Requisitos 5.1–5.11).
describe("Tabela §5: valores exatos de penalidade recomendada", () => {
  const cases = [
    ["procedural_error", "minor", "caution"],
    ["procedural_error", "major", "warning"],
    ["procedural_error", "severe", "game_loss"],
    ["tardiness", "minor", "warning"],
    ["tardiness", "major", "game_loss"],
    ["tardiness", "severe", "match_loss"],
    ["unsporting_conduct", "minor", "warning"],
    ["unsporting_conduct", "major", "match_loss"],
    ["unsporting_conduct", "severe", "disqualification"],
    ["cheating", "minor", "disqualification"],
    ["cheating", "major", "disqualification"],
    ["cheating", "severe", "disqualification"],
    ["gameplay_error_tcg", "minor", "warning"],
    ["gameplay_error_tcg", "major", "double_prize_loss"],
    ["gameplay_error_tcg", "severe", "game_loss"],
    ["gameplay_error_vg", "minor", "warning"],
    ["gameplay_error_vg", "severe", "game_loss"],
    ["gameplay_error_go", "minor", "warning"],
    ["gameplay_error_go", "severe", "game_loss"],
    ["legality_check_tcg", "minor", "warning"],
    ["legality_check_tcg", "major", "game_loss"],
    ["legality_check_tcg", "severe", "disqualification"],
    ["legality_check_vg", "minor", "warning"],
    ["legality_check_vg", "major", "game_loss"],
    ["legality_check_vg", "severe", "disqualification"],
    ["legality_check_go", "minor", "warning"],
    ["legality_check_go", "major", "game_loss"],
    ["legality_check_go", "severe", "disqualification"],
    ["pace_of_play", "minor", "warning"],
    ["pace_of_play", "severe", "double_prize_loss"],
  ];
  it.each(cases)("%s / %s -> %s", (cat, sev, expected) => {
    expect(recommendedPenalty(cat, sev)).toBe(expected);
  });

  it("VG, GO e Pace of Play não têm Major", () => {
    for (const id of ["gameplay_error_vg", "gameplay_error_go", "pace_of_play"]) {
      expect(recommendedPenalty(id, "major")).toBeNull();
    }
  });
});
