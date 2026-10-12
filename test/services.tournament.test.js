import { describe, it, expect } from "vitest";
import fc from "fast-check";
import { TournamentService } from "../src/services/tournamentService.js";
import { MemoryStorageAdapter } from "../src/storage/memoryStorageAdapter.js";
import {
  generateRecordId,
  SANCTIONING_NUMBER_REGEX,
  isValidSanctioningNumber,
} from "../src/services/ids.js";

const RUNS = { numRuns: 100 };

function makeService(idGen) {
  return new TournamentService(new MemoryStorageAdapter(), idGen, () => 1000);
}

const validInput = {
  description: "Liga Local — Agosto",
  eventDate: "2026-08-01",
  sanctioningNumber: "AB-CD-123456",
  organizerId: "999",
};

const arbBlank = fc.stringOf(fc.constantFrom(" ", "\t", "\n"), { maxLength: 5 });

// Gerador de números de sancionamento válidos XX-XX-XXXXXX.
const alnum = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789".split("");
const arbAlnum = fc.constantFrom(...alnum);
const arbSanctioning = fc
  .tuple(
    fc.array(arbAlnum, { minLength: 2, maxLength: 2 }),
    fc.array(arbAlnum, { minLength: 2, maxLength: 2 }),
    fc.array(arbAlnum, { minLength: 6, maxLength: 6 })
  )
  .map(([a, b, c]) => `${a.join("")}-${b.join("")}-${c.join("")}`);

describe("TournamentService: criação e leitura", () => {
  it("cria torneio válido com ID de cadastro interno e createdAt", () => {
    const svc = makeService();
    const res = svc.create(validInput);
    expect(res.ok).toBe(true);
    expect(typeof res.value.id).toBe("string");
    expect(res.value.id.length).toBeGreaterThan(0);
    expect(res.value.sanctioningNumber).toBe("AB-CD-123456");
    expect(res.value.description).toBe("Liga Local — Agosto");
    expect(res.value.createdAt).toBe(1000);
  });

  it("list() devolve sancionamento, descrição e data", () => {
    const svc = makeService();
    svc.create(validInput);
    const list = svc.list();
    expect(list).toHaveLength(1);
    expect(list[0]).toMatchObject({
      description: validInput.description,
      eventDate: validInput.eventDate,
      sanctioningNumber: validInput.sanctioningNumber,
    });
  });
});

/*
 * Feature: pokemon-judge-penalty-tracker, Property 5: Para qualquer valor de
 * número de sancionamento informado, a criação é aceita se, e somente se, o
 * valor casar com o padrão XX-XX-XXXXXX. O ID de cadastro interno não tem
 * exigência de formato.
 */
describe("Property 5: validação do formato do número de sancionamento", () => {
  it("sanctioning válido (XX-XX-XXXXXX) é aceito", () => {
    fc.assert(
      fc.property(arbSanctioning, (sn) => {
        expect(isValidSanctioningNumber(sn)).toBe(true);
        const svc = makeService();
        const res = svc.create({ ...validInput, sanctioningNumber: sn });
        expect(res.ok).toBe(true);
      }),
      RUNS
    );
  });

  it("sanctioning fora do formato é rejeitado", () => {
    const invalids = ["SN-0001", "AB-CD-12345", "ABC-DE-123456", "ab_cd_123456", "AB-CD-12345G6", "", "AB-CD-1234567"];
    for (const sn of invalids) {
      const svc = makeService();
      const res = svc.create({ ...validInput, sanctioningNumber: sn });
      expect(res.ok, `esperava rejeitar '${sn}'`).toBe(false);
      expect(res.errors.some((e) => e.field === "sanctioningNumber")).toBe(true);
    }
  });

  it("ID de cadastro interno NÃO segue o formato XX-XX-XXXXXX", () => {
    const svc = makeService();
    const id = svc.create(validInput).value.id;
    expect(SANCTIONING_NUMBER_REGEX.test(id)).toBe(false);
  });
});

/*
 * Feature: pokemon-judge-penalty-tracker, Property 6: Para qualquer sequência de
 * criações, todos os IDs de cadastro resultantes são distintos; em colisão, um
 * novo é gerado.
 */
describe("Property 6: unicidade dos IDs de cadastro (com regeneração em colisão)", () => {
  it("IDs distintos ao criar k torneios", () => {
    fc.assert(
      fc.property(fc.integer({ min: 1, max: 30 }), (k) => {
        const svc = makeService();
        const ids = new Set();
        for (let i = 0; i < k; i++) {
          ids.add(svc.create(validInput).value.id);
        }
        expect(ids.size).toBe(k);
      }),
      RUNS
    );
  });

  it("gerador que colide força regeneração até ser distinto", () => {
    const seq = ["rec-A", "rec-A", "rec-B"];
    let i = 0;
    const idGen = () => seq[Math.min(i++, seq.length - 1)];
    const svc = makeService(idGen);
    const a = svc.create(validInput);
    const b = svc.create(validInput);
    expect(a.value.id).toBe("rec-A");
    expect(b.value.id).toBe("rec-B"); // pulou a colisão
  });
});

/*
 * Feature: pokemon-judge-penalty-tracker, Property 7: edição preserva o ID de
 * cadastro.
 */
describe("Property 7: edição preserva o ID de cadastro", () => {
  it("update mantém id e createdAt", () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1, maxLength: 200 }).filter((s) => s.trim().length > 0),
        (newDesc) => {
          const svc = makeService();
          const created = svc.create(validInput).value;
          const res = svc.update(created.id, { ...validInput, description: newDesc });
          expect(res.ok).toBe(true);
          expect(res.value.id).toBe(created.id);
          expect(res.value.createdAt).toBe(created.createdAt);
          expect(res.value.description).toBe(newDesc.trim());
        }
      ),
      RUNS
    );
  });
});

/*
 * Feature: pokemon-judge-penalty-tracker, Property 8: exclusão em cascata com
 * confirmação; sem confirmação não altera. (parte torneio)
 */
describe("Property 8: exclusão em cascata e confirmação (torneio)", () => {
  it("delete(confirmed=true) remove torneio e dependências; false não altera", () => {
    fc.assert(
      fc.property(fc.boolean(), (confirmed) => {
        const storage = new MemoryStorageAdapter();
        const svc = new TournamentService(storage, undefined, () => 1);
        const t = svc.create(validInput).value;
        const state = storage.load();
        state.rounds.push({ id: "r1", tournamentId: t.id, number: 1, createdAt: 1 });
        state.penalties.push({
          id: "p1",
          roundId: "r1",
          tournamentId: t.id,
          categoryId: "cheating",
          severityId: "severe",
          penaltyId: "disqualification",
          playerId: "1",
          description: "x",
          confirmerRole: "head_judge",
          createdAt: 1,
        });
        storage.save(state);

        svc.delete(t.id, confirmed);
        const after = storage.load();
        if (confirmed) {
          expect(after.tournaments).toHaveLength(0);
          expect(after.rounds).toHaveLength(0);
          expect(after.penalties).toHaveLength(0);
        } else {
          expect(after.tournaments).toHaveLength(1);
          expect(after.rounds).toHaveLength(1);
          expect(after.penalties).toHaveLength(1);
        }
      }),
      RUNS
    );
  });
});

/*
 * Properties 2 e 3 no recorte de torneio.
 */
describe("Property 2 e 3: obrigatórios e limites (torneio)", () => {
  it("campo obrigatório em branco rejeita e não persiste", () => {
    fc.assert(
      fc.property(
        fc.constantFrom("description", "eventDate", "sanctioningNumber", "organizerId"),
        arbBlank,
        (field, blank) => {
          const storage = new MemoryStorageAdapter();
          const svc = new TournamentService(storage, undefined, () => 1);
          const res = svc.create({ ...validInput, [field]: blank });
          expect(res.ok).toBe(false);
          expect(res.errors.some((e) => e.field === field)).toBe(true);
          expect(storage.load().tournaments).toHaveLength(0);
        }
      ),
      RUNS
    );
  });

  it("description aceita sse 1..200 caracteres", () => {
    fc.assert(
      fc.property(fc.string({ minLength: 1, maxLength: 260 }).filter((s) => s.trim().length > 0), (desc) => {
        const svc = makeService();
        const res = svc.create({ ...validInput, description: desc });
        expect(res.ok).toBe(desc.length >= 1 && desc.length <= 200);
      }),
      RUNS
    );
  });

  it("eventDate inválida (2026-13-01) é rejeitada", () => {
    const svc = makeService();
    const res = svc.create({ ...validInput, eventDate: "2026-13-01" });
    expect(res.ok).toBe(false);
    expect(res.errors.some((e) => e.field === "eventDate")).toBe(true);
  });
});
