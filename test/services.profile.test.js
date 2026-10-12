import { describe, it, expect } from "vitest";
import fc from "fast-check";
import { ProfileService } from "../src/services/profileService.js";
import { MemoryStorageAdapter } from "../src/storage/memoryStorageAdapter.js";

const RUNS = { numRuns: 100 };

// Relógio fixo para tornar a validação de data determinística.
const FIXED_NOW = () => new Date("2026-06-15T12:00:00Z");

function makeService(initial = null) {
  return new ProfileService(new MemoryStorageAdapter(initial), FIXED_NOW);
}

const validInput = {
  firstName: "Ana",
  lastName: "Souza",
  judgeId: "123456",
  dateOfBirth: "1990-05-10",
};

// Strings compostas só de espaços (para "ausente ou só espaços em branco").
const arbBlank = fc.stringOf(fc.constantFrom(" ", "\t", "\n"), { maxLength: 5 });

describe("ProfileService: salvar perfil válido e restaurar", () => {
  it("salva perfil válido e aplica trim", () => {
    const svc = makeService();
    const res = svc.saveProfile({
      firstName: "  Ana  ",
      lastName: " Souza ",
      judgeId: " 123456 ",
      dateOfBirth: "1990-05-10",
    });
    expect(res.ok).toBe(true);
    expect(res.value).toEqual(validInput);
  });

  it("getProfile() restaura o perfil persistido (Req 1.6)", () => {
    const svc = makeService();
    svc.saveProfile(validInput);
    expect(svc.getProfile()).toEqual(validInput);
  });

  it("getProfile() retorna null quando não há perfil", () => {
    expect(makeService().getProfile()).toBeNull();
  });

  it("salvar novamente substitui o perfil anterior (Req 1.5)", () => {
    const svc = makeService();
    svc.saveProfile(validInput);
    svc.saveProfile({ ...validInput, firstName: "Bia", judgeId: "999" });
    expect(svc.getProfile()).toMatchObject({ firstName: "Bia", judgeId: "999" });
  });
});

/*
 * Feature: pokemon-judge-penalty-tracker, Property 2: Para qualquer entidade em
 * que ao menos um campo obrigatório seja ausente ou composto apenas por espaços,
 * salvar é rejeitado, nada é persistido e os valores informados são preservados.
 * (recorte de perfil)
 */
describe("Property 2: campos obrigatórios vazios/espaços rejeitam e não persistem (perfil)", () => {
  it("campo obrigatório em branco rejeita e não persiste", () => {
    fc.assert(
      fc.property(
        fc.constantFrom("firstName", "lastName", "judgeId", "dateOfBirth"),
        arbBlank,
        (field, blank) => {
          const storage = new MemoryStorageAdapter();
          const svc = new ProfileService(storage, FIXED_NOW);
          const input = { ...validInput, [field]: blank };
          const res = svc.saveProfile(input);
          expect(res.ok).toBe(false);
          expect(res.errors.some((e) => e.field === field)).toBe(true);
          // Nada persistido.
          expect(storage.load().profile).toBeNull();
        }
      ),
      RUNS
    );
  });
});

/*
 * Feature: pokemon-judge-penalty-tracker, Property 3: Para qualquer valor de
 * campo com restrição de comprimento, a validação aceita se e somente se o
 * comprimento estiver dentro do intervalo permitido. (recorte de perfil:
 * firstName/lastName <= 50, judgeId <= 20)
 */
describe("Property 3: limites de comprimento (perfil)", () => {
  it("firstName aceito sse length <= 50", () => {
    fc.assert(
      fc.property(fc.string({ minLength: 1, maxLength: 120 }).filter((s) => s.trim().length > 0), (name) => {
        const svc = makeService();
        const res = svc.saveProfile({ ...validInput, firstName: name });
        expect(res.ok).toBe(name.length <= 50);
      }),
      RUNS
    );
  });

  it("judgeId aceito sse length <= 20", () => {
    fc.assert(
      fc.property(fc.string({ minLength: 1, maxLength: 60 }).filter((s) => s.trim().length > 0), (id) => {
        const svc = makeService();
        const res = svc.saveProfile({ ...validInput, judgeId: id });
        expect(res.ok).toBe(id.length <= 20);
      }),
      RUNS
    );
  });
});

/*
 * Feature: pokemon-judge-penalty-tracker, Property 4: Para qualquer data de
 * nascimento estritamente posterior à data atual do dispositivo, o salvamento
 * do perfil é rejeitado e os dados informados são preservados.
 */
describe("Property 4: data de nascimento futura é inválida", () => {
  it("dateOfBirth > hoje rejeita", () => {
    // hoje = 2026-06-15 (FIXED_NOW)
    fc.assert(
      fc.property(
        fc.date({ min: new Date("2026-06-16"), max: new Date("2099-12-31") }),
        (future) => {
          const iso = future.toISOString().slice(0, 10);
          const svc = makeService();
          const res = svc.saveProfile({ ...validInput, dateOfBirth: iso });
          expect(res.ok).toBe(false);
          expect(res.errors.some((e) => e.field === "dateOfBirth")).toBe(true);
        }
      ),
      RUNS
    );
  });

  it("dateOfBirth == hoje é aceita (não é futura)", () => {
    const svc = makeService();
    const res = svc.saveProfile({ ...validInput, dateOfBirth: "2026-06-15" });
    expect(res.ok).toBe(true);
  });

  it("data inexistente (2026-02-30) é rejeitada como inválida", () => {
    const svc = makeService();
    const res = svc.saveProfile({ ...validInput, dateOfBirth: "2026-02-30" });
    expect(res.ok).toBe(false);
    expect(res.errors.some((e) => e.field === "dateOfBirth")).toBe(true);
  });
});
