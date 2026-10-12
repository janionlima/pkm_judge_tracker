/*
 * Roteador por hash minimalista. Registra padrões e despacha para handlers,
 * passando os parâmetros capturados.
 *
 * Padrões suportados (segmentos separados por "/"), com ":param":
 *   #/tournaments
 *   #/tournament/new
 *   #/tournament/:id
 *   #/tournament/:id/edit
 *   #/tournament/:id/report
 *   #/tournament/:id/round/:roundId
 */

export class Router {
  constructor() {
    this._routes = [];
    this._fallback = null;
    this._onNavigate = null;
  }

  on(pattern, handler) {
    const segments = pattern.split("/").filter(Boolean);
    this._routes.push({ segments, handler });
    return this;
  }

  fallback(handler) {
    this._fallback = handler;
    return this;
  }

  /* Chamado antes de cada resolução (ex.: fechar sheets). */
  onNavigate(fn) {
    this._onNavigate = fn;
    return this;
  }

  start() {
    window.addEventListener("hashchange", () => this.resolve());
    this.resolve();
  }

  go(hash) {
    if (window.location.hash === hash) this.resolve();
    else window.location.hash = hash;
  }

  _parts() {
    return window.location.hash.replace(/^#\/?/, "").split("/").filter(Boolean);
  }

  resolve() {
    if (this._onNavigate) this._onNavigate();
    const parts = this._parts();
    for (const route of this._routes) {
      const params = this._match(route.segments, parts);
      if (params) {
        route.handler(params);
        return;
      }
    }
    if (this._fallback) this._fallback();
  }

  _match(segments, parts) {
    if (segments.length !== parts.length) return null;
    const params = {};
    for (let i = 0; i < segments.length; i++) {
      const seg = segments[i];
      if (seg.startsWith(":")) {
        params[seg.slice(1)] = decodeURIComponent(parts[i]);
      } else if (seg !== parts[i]) {
        return null;
      }
    }
    return params;
  }
}
