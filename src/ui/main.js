/*
 * Ponto de entrada da UI. Monta o app shell, injeta os serviços sobre o
 * LocalStorageAdapter e registra as rotas.
 */

import "./styles.css";

import { LocalStorageAdapter } from "../storage/localStorageAdapter.js";
import { StorageCorruptedError } from "../storage/errors.js";
import { ProfileService } from "../services/profileService.js";
import { TournamentService } from "../services/tournamentService.js";
import { RoundService } from "../services/roundService.js";
import { PenaltyService } from "../services/penaltyService.js";
import { ReportService } from "../services/reportService.js";
import { ShareService } from "../services/shareService.js";

import { Router } from "./router.js";
import { el, toast, closeSheet } from "./dom.js";
import { createViews } from "./views.js";
import { APP_NAME, APP_VERSION } from "./about.js";

// ---------- App shell ----------
const root = document.getElementById("app");
root.innerHTML = `
  <header class="appbar" id="appbar">
    <button class="iconbtn back" id="backBtn" aria-label="Voltar">‹</button>
    <span class="logo-dot" aria-hidden="true"></span>
    <div class="appbar-titles">
      <span class="brand">${APP_NAME}</span>
      <span class="context" id="appContext"></span>
    </div>
    <button class="iconbtn" id="homeBtn" aria-label="Início" title="Início">⌂</button>
    <button class="iconbtn" id="aboutBtn" aria-label="Sobre" title="Sobre">ⓘ</button>
  </header>
  <main id="view" role="main"></main>
`;

const appbar = document.getElementById("appbar");
const appContext = document.getElementById("appContext");
const viewEl = document.getElementById("view");
document.getElementById("backBtn").addEventListener("click", () => history.back());
document.getElementById("homeBtn").addEventListener("click", () => router.go("#/tournaments"));
document.getElementById("aboutBtn").addEventListener("click", () => router.go("#/about"));

// ---------- Serviços ----------
const storage = new LocalStorageAdapter();

// Boot tolerante a falhas (Req 10.6): se o estado estiver corrompido, avisa e
// segue com estado vazio sem sobrescrever a chave original.
try {
  storage.load();
} catch (e) {
  if (e instanceof StorageCorruptedError) {
    setTimeout(
      () => toast("Dados locais não puderam ser restaurados. Iniciando vazio."),
      400
    );
  }
}

const services = {
  profile: new ProfileService(storage),
  tournament: new TournamentService(storage),
  round: new RoundService(storage),
  penalty: new PenaltyService(storage),
  report: new ReportService(storage),
  share: new ShareService(),
};

// ---------- Shell API passado às views ----------
const router = new Router();

const shell = {
  services,
  router,
  view: viewEl,
  setHeader(context, showBack) {
    // A marca ("Pkm Judge Penalty Tracker") é fixa; `context` é o nome da tela.
    appContext.textContent = context || "";
    appbar.classList.toggle("has-back", !!showBack);
  },
  go: (hash) => router.go(hash),
};

const views = createViews(shell);

// ---------- Rotas ----------
// Guard: exige perfil do juiz antes de qualquer outra tela.
function requireProfile(render) {
  return (params) => {
    if (!services.profile.getProfile()) {
      views.renderProfile();
      return;
    }
    render(params);
  };
}

router
  .onNavigate(() => closeSheet())
  .on("/judge", () => views.renderProfile())
  .on("/about", () => views.renderAbout())
  .on("/tournaments", requireProfile(() => views.renderTournamentList()))
  .on("/tournament/new", requireProfile(() => views.renderTournamentForm(null)))
  .on("/tournament/:id", requireProfile(({ id }) => views.renderTournamentDetail(id)))
  .on("/tournament/:id/edit", requireProfile(({ id }) => views.renderTournamentForm(id)))
  .on("/tournament/:id/report", requireProfile(({ id }) => views.renderReport(id)))
  .on(
    "/tournament/:id/round/:roundId",
    requireProfile(({ id, roundId }) => views.renderRoundDetail(id, roundId))
  )
  .fallback(() => {
    if (!services.profile.getProfile()) {
      views.renderProfile();
    } else {
      router.go("#/tournaments");
    }
  });

router.start();
