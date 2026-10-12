import { describe, it, expect, vi } from "vitest";
import { ShareService, CHANNELS } from "../src/services/shareService.js";

function makeEnv(overrides = {}) {
  return {
    hasWebShare: false,
    canShareFiles: () => false,
    webShare: vi.fn(() => Promise.resolve()),
    openUrl: vi.fn(),
    setLocation: vi.fn(),
    downloadBlob: vi.fn(),
    makeBlob: (parts, type) => ({ parts, type }),
    ...overrides,
  };
}

const payload = {
  tournamentId: "AB-CD-123456",
  subject: "Penalty Report: AB-CD-123456",
  csv: "Tournament ID,Round of Issue\r\nAB-CD-123456,1",
};

describe("ShareService: canais disponíveis (Req 9.1)", () => {
  it("oferece whatsapp, telegram e email", () => {
    expect(new ShareService(makeEnv()).availableChannels()).toEqual(CHANNELS);
  });
});

describe("ShareService: Web Share API quando disponível", () => {
  it("usa navigator.share em vez de deep link (whatsapp)", async () => {
    const env = makeEnv({ hasWebShare: true });
    const svc = new ShareService(env);
    const res = await svc.share("whatsapp", payload);
    expect(res.ok).toBe(true);
    expect(res.method).toBe("web-share");
    expect(env.webShare).toHaveBeenCalledOnce();
    expect(env.openUrl).not.toHaveBeenCalled();
  });

  it("cancelamento (AbortError) é tratado como sucesso", async () => {
    const abort = Object.assign(new Error("cancel"), { name: "AbortError" });
    const env = makeEnv({ hasWebShare: true, webShare: vi.fn(() => Promise.reject(abort)) });
    const svc = new ShareService(env);
    const res = await svc.share("telegram", payload);
    expect(res.ok).toBe(true);
    expect(res.method).toBe("web-share-cancelled");
  });

  it("falha do Web Share cai para deep link", async () => {
    const env = makeEnv({ hasWebShare: true, webShare: vi.fn(() => Promise.reject(new Error("x"))) });
    const svc = new ShareService(env);
    const res = await svc.share("whatsapp", payload);
    expect(res.method).toBe("deep-link");
    expect(env.openUrl).toHaveBeenCalledOnce();
  });
});

describe("ShareService: deep links (fallback sem Web Share)", () => {
  it("WhatsApp usa wa.me com o texto (Req 9.2)", async () => {
    const env = makeEnv();
    const svc = new ShareService(env);
    await svc.share("whatsapp", payload);
    const url = env.openUrl.mock.calls[0][0];
    expect(url.startsWith("https://wa.me/?text=")).toBe(true);
    expect(decodeURIComponent(url)).toContain("Penalty Report: AB-CD-123456");
  });

  it("Telegram usa t.me/share/url com o texto (Req 9.3)", async () => {
    const env = makeEnv();
    const svc = new ShareService(env);
    await svc.share("telegram", payload);
    const url = env.openUrl.mock.calls[0][0];
    expect(url.startsWith("https://t.me/share/url?")).toBe(true);
    expect(decodeURIComponent(url)).toContain("Penalty Report: AB-CD-123456");
  });
});

describe("ShareService: e-mail (Req 9.4, 9.5)", () => {
  it("mailto com assunto no formato correto", async () => {
    const env = makeEnv();
    const svc = new ShareService(env);
    const res = await svc.share("email", payload);
    expect(res.ok).toBe(true);
    expect(res.method).toBe("mailto");
    const url = env.setLocation.mock.calls[0][0];
    expect(url.startsWith("mailto:?subject=")).toBe(true);
    expect(decodeURIComponent(url)).toContain("subject=Penalty Report: AB-CD-123456");
  });

  it("assunto fora do formato -> falha e relatório segue disponível (Req 9.5)", async () => {
    const env = makeEnv();
    const svc = new ShareService(env);
    const res = await svc.share("email", { ...payload, subject: "assunto errado" });
    expect(res.ok).toBe(false);
    expect(res.message).toMatch(/assunto/i);
    expect(env.setLocation).not.toHaveBeenCalled();
  });
});

describe("ShareService: download de CSV (Req 9.6, 9.7)", () => {
  it("cria blob com BOM e dispara download com nome baseado no id", () => {
    const env = makeEnv();
    const svc = new ShareService(env);
    const res = svc.downloadCsv(payload);
    expect(res.ok).toBe(true);
    expect(env.downloadBlob).toHaveBeenCalledOnce();
    const [blob, filename] = env.downloadBlob.mock.calls[0];
    expect(blob.parts[0].startsWith("\ufeff")).toBe(true);
    expect(filename).toBe("Penalty_Report_AB-CD-123456.csv");
  });
});
