/*
 * ShareService — compartilhamento multicanal do relatório (Requisitos 9.1–9.7).
 *
 * Estratégia em cascata: Web Share API quando disponível; senão deep links
 * (wa.me / t.me) e mailto:; download de CSV como fallback universal.
 *
 * As dependências de plataforma são injetadas (env) para permitir testes sem
 * DOM/navegador real.
 */

/* Ambiente padrão sobre o browser real. */
function defaultEnv() {
  return {
    hasWebShare:
      typeof navigator !== "undefined" && typeof navigator.share === "function",
    canShareFiles: (files) =>
      typeof navigator !== "undefined" &&
      typeof navigator.canShare === "function" &&
      navigator.canShare({ files }),
    webShare: (data) => navigator.share(data),
    openUrl: (url) =>
      typeof window !== "undefined"
        ? window.open(url, "_blank", "noopener")
        : undefined,
    setLocation: (url) => {
      if (typeof window !== "undefined") window.location.href = url;
    },
    downloadBlob: (blob, filename) => {
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    },
    makeBlob: (parts, type) => new Blob(parts, { type }),
  };
}

export const CHANNELS = ["whatsapp", "telegram", "email"];

export class ShareService {
  /** @param {object} [env]  Injeção das dependências de plataforma. */
  constructor(env) {
    this._env = { ...defaultEnv(), ...(env || {}) };
  }

  /*
   * Canais disponíveis (Req 9.1). WhatsApp/Telegram usam deep links (sempre
   * ofertáveis onde há abertura de URL); e-mail depende de mailto.
   */
  availableChannels() {
    return [...CHANNELS];
  }

  /* Nome do arquivo CSV baseado no Tournament ID. */
  csvFileName(subject, tournamentId) {
    const id = (tournamentId || "sem-id").replace(/[^\w-]/g, "_");
    return `Penalty_Report_${id}.csv`;
  }

  /*
   * Compartilha o relatório pelo canal escolhido.
   * @param {"whatsapp"|"telegram"|"email"} channel
   * @param {{tournamentId:string, subject:string, csv:string}} payload
   * @returns {Promise<{ok:boolean, method:string, message?:string}>}
   */
  async share(channel, payload) {
    const { subject, csv, tournamentId } = payload;

    if (channel === "email") {
      // Assunto é obrigatório e deve ter o formato correto (Req 9.4, 9.5).
      if (!subject || !subject.startsWith("Penalty Report: ")) {
        return {
          ok: false,
          method: "none",
          message: "Falha ao gerar o assunto do e-mail.",
        };
      }
      const url =
        "mailto:?subject=" +
        encodeURIComponent(subject) +
        "&body=" +
        encodeURIComponent(csv);
      this._env.setLocation(url);
      return { ok: true, method: "mailto" };
    }

    const text = `${subject}\n\n${csv}`;

    // Preferência pela Web Share API nativa (melhor no mobile).
    if (this._env.hasWebShare) {
      try {
        await this._env.webShare({ title: subject, text });
        return { ok: true, method: "web-share" };
      } catch (e) {
        if (e && e.name === "AbortError") {
          return { ok: true, method: "web-share-cancelled" };
        }
        // Cai para deep link.
      }
    }

    if (channel === "whatsapp") {
      this._env.openUrl("https://wa.me/?text=" + encodeURIComponent(text));
      return { ok: true, method: "deep-link" };
    }
    if (channel === "telegram") {
      this._env.openUrl(
        "https://t.me/share/url?url=" +
          encodeURIComponent(" ") +
          "&text=" +
          encodeURIComponent(text)
      );
      return { ok: true, method: "deep-link" };
    }

    return {
      ok: false,
      method: "none",
      message: "Canal de compartilhamento indisponível.",
    };
  }

  /* Download do CSV como fallback universal (Req 9.6, 9.7). */
  downloadCsv(payload) {
    const { csv, subject, tournamentId } = payload;
    // BOM UTF-8 para o Excel reconhecer acentuação.
    const blob = this._env.makeBlob(["\ufeff" + csv], "text/csv;charset=utf-8;");
    this._env.downloadBlob(blob, this.csvFileName(subject, tournamentId));
    return { ok: true, method: "download" };
  }
}
