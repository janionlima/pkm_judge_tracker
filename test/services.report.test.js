import { describe, it, expect } from "vitest";
import fc from "fast-check";
import {
  ReportService,
  CSV_HEADERS,
  csvEscape,
} from "../src/services/reportService.js";
import { MemoryStorageAdapter } from "../src/storage/memoryStorageAdapter.js";
import {
  categoryLabel,
  severityLabel,
  penaltyLabel,
  CATEGORIES,
  PENALTIES,
} from "../src/domain/rules.js";

const RUNS = { numRuns: 100 };

const HEADER_LINE =
  "Tournament ID,Round of Issue,Judge Player ID,Competitor's Player ID,Category,Severity,Penalty,Notes";

/* Parser CSV de referência (RFC 4180) para o round-trip da Property 21. */
function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = "";
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += c;
      }
    } else if (c === '"') {
      inQuotes = true;
    } else if (c === ",") {
      row.push(field);
      field = "";
    } else if (c === "\r") {
      // ignora; o \n fecha a linha
    } else if (c === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else {
      field += c;
    }
  }
  row.push(field);
  rows.push(row);
  return rows;
}

// tId = ID de cadastro interno (chave de linkagem); sanctioning = Tournament ID
// do relatório (número de sancionamento, formato XX-XX-XXXXXX). São distintos
// de propósito para garantir que a coluna usa o sanctioning, não o id interno.
const REC_ID = "rec-internal-xyz";
const SANCTIONING = "AB-CD-123456";

/* Monta um estado com um torneio, perfil e penalidades fornecidas. */
function stateWith(
  penalties,
  { judgeId = "JUDGE1", tId = REC_ID, sanctioning = SANCTIONING, rounds } = {}
) {
  const defaultRounds = rounds || [
    { id: "r1", tournamentId: tId, number: 1, createdAt: 1 },
    { id: "r2", tournamentId: tId, number: 2, createdAt: 2 },
  ];
  return {
    schemaVersion: 1,
    profile: { firstName: "A", lastName: "B", judgeId, dateOfBirth: "1990-01-01" },
    tournaments: [
      {
        id: tId,
        description: "Liga",
        eventDate: "2026-08-01",
        sanctioningNumber: sanctioning,
        organizerId: "9",
        createdAt: 0,
      },
    ],
    rounds: defaultRounds,
    penalties,
  };
}

function pen(overrides) {
  return {
    id: Math.random().toString(36).slice(2),
    roundId: "r1",
    tournamentId: REC_ID,
    categoryId: "procedural_error",
    severityId: "severe",
    penaltyId: "game_loss",
    playerId: "100",
    description: "desc",
    confirmerRole: "head_judge",
    createdAt: 1,
    ...overrides,
  };
}

function svcWith(penalties, opts) {
  return new ReportService(new MemoryStorageAdapter(stateWith(penalties, opts)));
}

/*
 * Feature: pokemon-judge-penalty-tracker, Property 17: a primeira linha do CSV é
 * exatamente o cabeçalho fixo e ordenado.
 */
describe("Property 17: cabeçalho do CSV fixo e ordenado", () => {
  it("primeira linha == cabeçalho esperado", () => {
    fc.assert(
      fc.property(fc.array(fc.constant(pen()), { maxLength: 5 }), (penalties) => {
        const svc = svcWith(penalties.map((_, i) => pen({ id: "p" + i })));
        const { csv } = svc.generateCsv(REC_ID);
        expect(csv.split("\r\n")[0]).toBe(HEADER_LINE);
      }),
      RUNS
    );
    expect(CSV_HEADERS.join(",")).toBe(HEADER_LINE);
  });
});

/*
 * Feature: pokemon-judge-penalty-tracker, Property 18: o número de linhas de
 * dados == número de penalidades não-Caution; nenhuma Caution; sem reportáveis
 * -> apenas cabeçalho.
 */
describe("Property 18: só reportáveis, nenhuma Caution", () => {
  it("linhas de dados == penalidades não-Caution", () => {
    const penaltyIds = PENALTIES.map((p) => p.id);
    fc.assert(
      fc.property(
        fc.array(fc.constantFrom(...penaltyIds), { maxLength: 20 }),
        (ids) => {
          const penalties = ids.map((penaltyId, i) =>
            pen({ id: "p" + i, penaltyId, createdAt: i })
          );
          const svc = svcWith(penalties);
          const { csv, reportableCount } = svc.generateCsv(REC_ID);
          const dataLines = csv.split("\r\n").slice(1).filter((l) => l.length > 0);
          const expected = ids.filter((id) => id !== "caution").length;
          expect(reportableCount).toBe(expected);
          expect(dataLines.length).toBe(expected);
        }
      ),
      RUNS
    );
  });

  it("sem reportáveis -> apenas cabeçalho (Req 8.8)", () => {
    const svc = svcWith([pen({ penaltyId: "caution" })]);
    const { csv, reportableCount } = svc.generateCsv(REC_ID);
    expect(reportableCount).toBe(0);
    expect(csv).toBe(HEADER_LINE);
  });
});

/*
 * Feature: pokemon-judge-penalty-tracker, Property 19: mapeamento correto das
 * colunas (inclui Judge Player ID vindo do perfil — valida Req 1.7).
 */
describe("Property 19: mapeamento das colunas do CSV", () => {
  it("cada coluna reflete os dados da penalidade/perfil", () => {
    const svc = svcWith(
      [
        pen({
          id: "p1",
          roundId: "r2",
          categoryId: "tardiness",
          severityId: "severe",
          penaltyId: "match_loss",
          playerId: "555",
          description: "chegou 15 min atrasado",
        }),
      ],
      { judgeId: "JX" }
    );
    const rows = svc.buildRows(REC_ID);
    expect(rows[0]).toEqual([
      SANCTIONING, // Tournament ID = número de sancionamento, não o id interno
      2,
      "JX",
      "555",
      categoryLabel("tardiness"),
      severityLabel("severe"),
      penaltyLabel("match_loss"),
      "chegou 15 min atrasado",
    ]);
  });

  it("Notes vazio quando não há descrição", () => {
    const svc = svcWith([pen({ description: "" })]);
    const rows = svc.buildRows(REC_ID);
    expect(rows[0][7]).toBe("");
  });
});

/*
 * Feature: pokemon-judge-penalty-tracker, Property 20: linhas ordenadas por
 * Round of Issue asc e, dentro da rodada, por ordem cronológica de emissão.
 */
describe("Property 20: ordenação das linhas", () => {
  it("ordena por rodada e depois por createdAt", () => {
    fc.assert(
      fc.property(
        // createdAt únicos (via set + embaralhamento) para ordenação determinística.
        fc
          .uniqueArray(fc.integer({ min: 0, max: 100000 }), {
            minLength: 1,
            maxLength: 15,
          })
          .chain((times) =>
            fc.tuple(
              fc.constant(times),
              fc.array(fc.constantFrom("r1", "r2"), {
                minLength: times.length,
                maxLength: times.length,
              })
            )
          ),
        ([times, roundIds]) => {
          // Codifica o Player ID com o createdAt para poder reidentificar a
          // ordem exata nas linhas do CSV.
          const penalties = times.map((createdAt, i) =>
            pen({
              id: "p" + i,
              roundId: roundIds[i],
              createdAt,
              playerId: String(createdAt),
              penaltyId: "warning",
            })
          );
          const svc = svcWith(penalties);
          const rows = svc.buildRows(REC_ID);

          const roundNum = { r1: 1, r2: 2 };
          const expected = [...penalties]
            .sort((a, b) => {
              if (roundNum[a.roundId] !== roundNum[b.roundId])
                return roundNum[a.roundId] - roundNum[b.roundId];
              return a.createdAt - b.createdAt;
            })
            .map((p) => [roundNum[p.roundId], p.playerId]);

          // Linha: [tId, roundNumber, judgeId, playerId, ...]
          const actual = rows.map((r) => [r[1], r[3]]);
          expect(actual).toEqual(expected);
        }
      ),
      RUNS
    );
  });
});

/*
 * Feature: pokemon-judge-penalty-tracker, Property 21: round-trip de escape de
 * CSV — valores com vírgula/aspas/quebra de linha são recuperados exatamente
 * ao reparsear.
 */
describe("Property 21: escape de CSV round-trip", () => {
  it("reparsear recupera os valores originais", () => {
    const arbNasty = fc.string({ maxLength: 40 }); // inclui vírgulas, aspas, \n às vezes
    fc.assert(
      fc.property(
        fc.array(arbNasty, { minLength: 1, maxLength: 8 }),
        (fields) => {
          const line = fields.map(csvEscape).join(",");
          const parsed = parseCsv(line)[0];
          expect(parsed).toEqual(fields);
        }
      ),
      RUNS
    );
  });

  it("CSV completo com descrições problemáticas reparseia corretamente", () => {
    const svc = svcWith([
      pen({ id: "p1", roundId: "r1", createdAt: 1, penaltyId: "warning", description: 'ele disse "oi", e saiu' }),
      pen({ id: "p2", roundId: "r1", createdAt: 2, penaltyId: "game_loss", description: "linha1\nlinha2" }),
    ]);
    const { csv } = svc.generateCsv(REC_ID);
    const parsed = parseCsv(csv);
    expect(parsed[0]).toEqual(CSV_HEADERS);
    expect(parsed[1][7]).toBe('ele disse "oi", e saiu');
    expect(parsed[2][7]).toBe("linha1\nlinha2");
  });
});

// Gerador de números de sancionamento válidos para o assunto.
const _alnum = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789".split("");
const arbSanctioningStr = fc
  .tuple(
    fc.array(fc.constantFrom(..._alnum), { minLength: 2, maxLength: 2 }),
    fc.array(fc.constantFrom(..._alnum), { minLength: 2, maxLength: 2 }),
    fc.array(fc.constantFrom(..._alnum), { minLength: 6, maxLength: 6 })
  )
  .map(([a, b, c]) => `${a.join("")}-${b.join("")}-${c.join("")}`);

/*
 * Feature: pokemon-judge-penalty-tracker, Property 22: assunto do e-mail é
 * exatamente "Penalty Report: " seguido do Tournament ID (número de
 * sancionamento do torneio).
 */
describe("Property 22: formato do assunto de e-mail", () => {
  it("emailSubject == 'Penalty Report: <sanctioningNumber>'", () => {
    fc.assert(
      fc.property(arbSanctioningStr, (sanctioning) => {
        const svc = svcWith([], { sanctioning });
        expect(svc.emailSubject(REC_ID)).toBe(`Penalty Report: ${sanctioning}`);
      }),
      RUNS
    );
  });
});
