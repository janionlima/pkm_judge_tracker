/*
 * Views da aplicação (vanilla JS). Cada função renderiza uma tela no container
 * principal e liga os eventos aos serviços. As views são "finas": validação e
 * regras vivem nos serviços; aqui só renderizamos estado e emitimos intenções.
 */

import {
  el,
  esc,
  clear,
  toast,
  openSheet,
  closeSheet,
  confirmSheet,
  applyErrors,
} from "./dom.js";
import { fmtDate } from "./format.js";
import { APP_NAME, APP_VERSION, AUTHOR, DISCLAIMER } from "./about.js";
import {
  CATEGORIES,
  SEVERITIES,
  PENALTIES,
  getCategory,
  categoryLabel,
  severityLabel,
  penaltyLabel,
  severitiesForCategory,
  requiresHeadJudgeConfirmation,
  isReportablePenalty,
  PENALTY_RANK,
} from "../domain/rules.js";

export function createViews(shell) {
  const { services, view } = shell;
  const go = shell.go;

  function render(node) {
    clear(view);
    if (Array.isArray(node)) node.forEach((n) => view.appendChild(n));
    else view.appendChild(node);
  }

  /* ---------------- Perfil (onboarding/edição) — Req 1 ---------------- */
  function renderProfile() {
    shell.setHeader("Cadastro do juiz", false);
    const j = services.profile.getProfile() || {};
    const form = el(`
      <form class="card" novalidate>
        <h2>Seus dados de juiz</h2>
        <p style="color:var(--muted);font-size:14px;margin-top:0">
          Esses dados identificam você no relatório de penalidades.
        </p>
        <div class="row-2">
          <div class="field" data-f="firstName">
            <label>Primeiro nome</label>
            <input name="firstName" autocomplete="given-name" maxlength="50" value="${esc(j.firstName || "")}" />
            <div class="error">Informe o primeiro nome.</div>
          </div>
          <div class="field" data-f="lastName">
            <label>Último nome</label>
            <input name="lastName" autocomplete="family-name" maxlength="50" value="${esc(j.lastName || "")}" />
            <div class="error">Informe o último nome.</div>
          </div>
        </div>
        <div class="field" data-f="judgeId">
          <label>Judge ID</label>
          <input name="judgeId" inputmode="numeric" maxlength="20" value="${esc(j.judgeId || "")}" />
          <div class="error">Informe seu Judge ID.</div>
        </div>
        <div class="field" data-f="dateOfBirth">
          <label>Data de nascimento</label>
          <input name="dateOfBirth" type="date" value="${esc(j.dateOfBirth || "")}" />
          <div class="error">Informe a data de nascimento.</div>
        </div>
        <button class="btn primary" type="submit">Salvar e continuar</button>
      </form>
    `);

    form.addEventListener("submit", (e) => {
      e.preventDefault();
      const data = Object.fromEntries(new FormData(form).entries());
      const res = services.profile.saveProfile(data);
      if (!res.ok) {
        const first = applyErrors(form, res.errors);
        if (first) first.querySelector("input")?.focus();
        return;
      }
      toast("Dados salvos");
      go("#/tournaments");
    });

    render(form);
  }

  /* ---------------- Lista de torneios — Req 2.7 ---------------- */
  function renderTournamentList() {
    shell.setHeader("Torneios", false);
    const list = services.tournament.list();

    const nodes = [];
    const header = el(`
      <div class="section-title">
        <h2>Meus torneios</h2>
        <button class="btn small ghost" data-act="profile">Perfil</button>
      </div>
    `);
    header.querySelector('[data-act="profile"]').addEventListener("click", () => go("#/judge"));
    nodes.push(header);

    if (list.length === 0) {
      nodes.push(
        el(`<div class="empty"><div class="big">🏆</div>
          <div>Nenhum torneio cadastrado.</div>
          <div class="sub" style="font-size:14px">Toque em "Novo torneio" para começar.</div></div>`)
      );
    } else {
      const ul = el('<ul class="list"></ul>');
      for (const t of list) {
        const li = el(`
          <li class="list-item">
            <div class="grow">
              <div class="title">${esc(t.description || "(sem descrição)")}</div>
              <div class="sub">${esc(t.sanctioningNumber || "sem nº")} • ${esc(fmtDate(t.eventDate))}</div>
            </div>
            <span class="chev">›</span>
          </li>
        `);
        li.addEventListener("click", () => go(`#/tournament/${t.id}`));
        ul.appendChild(li);
      }
      nodes.push(ul);
    }

    const fab = el('<button class="btn primary fab">+ Novo torneio</button>');
    fab.addEventListener("click", () => go("#/tournament/new"));
    nodes.push(fab);

    render(nodes);
  }

  /* ---------------- Form de torneio (criar/editar/excluir) — Req 2 ---------------- */
  function renderTournamentForm(id) {
    const editing = !!id;
    const t = editing ? services.tournament.get(id) : null;
    if (editing && !t) return go("#/tournaments");
    shell.setHeader(editing ? "Editar torneio" : "Novo torneio", true);

    const form = el(`
      <form class="card" novalidate>
        <div class="field" data-f="description">
          <label>Descrição</label>
          <input name="description" maxlength="200" value="${esc(t ? t.description : "")}" placeholder="Ex.: Liga Local — Agosto" />
          <div class="error">Informe a descrição.</div>
        </div>
        <div class="field" data-f="eventDate">
          <label>Data de realização</label>
          <input name="eventDate" type="date" value="${esc(t ? t.eventDate : "")}" />
          <div class="error">Informe a data.</div>
        </div>
        <div class="field" data-f="sanctioningNumber">
          <label>Número de sancionamento (Tournament ID)</label>
          <input name="sanctioningNumber" maxlength="12" autocapitalize="characters" value="${esc(t ? t.sanctioningNumber : "")}" placeholder="XX-XX-XXXXXX" />
          <div class="hint">Formato oficial Play! Pokémon: 2-2-6 caracteres alfanuméricos. Vai no relatório como Tournament ID.</div>
          <div class="error">Informe o número de sancionamento.</div>
        </div>
        <div class="field" data-f="organizerId">
          <label>ID do organizador</label>
          <input name="organizerId" value="${esc(t ? t.organizerId : "")}" placeholder="Player ID do organizador" />
          <div class="error">Informe o ID do organizador.</div>
        </div>
        <button class="btn primary" type="submit">${editing ? "Salvar alterações" : "Criar torneio"}</button>
        ${editing ? '<button class="btn danger ghost" type="button" data-act="del" style="margin-top:10px">Excluir torneio</button>' : ""}
      </form>
    `);

    form.addEventListener("submit", (e) => {
      e.preventDefault();
      const data = Object.fromEntries(new FormData(form).entries());
      const res = editing
        ? services.tournament.update(id, data)
        : services.tournament.create(data);
      if (!res.ok) {
        applyErrors(form, res.errors);
        return;
      }
      toast(editing ? "Torneio atualizado" : "Torneio criado");
      go(`#/tournament/${res.value.id}`);
    });

    const del = form.querySelector('[data-act="del"]');
    if (del) {
      del.addEventListener("click", () => {
        confirmSheet(
          "Excluir torneio?",
          "Remove todas as rodadas e penalidades. Esta ação não pode ser desfeita.",
          () => {
            services.tournament.delete(id, true);
            closeSheet();
            toast("Torneio excluído");
            go("#/tournaments");
          }
        );
      });
    }

    render(form);
  }

  /* ---------------- Detalhe do torneio (+ rodadas) — Req 2, 3 ---------------- */
  function renderTournamentDetail(id) {
    const t = services.tournament.get(id);
    if (!t) return go("#/tournaments");
    shell.setHeader(t.description || "Torneio", true);

    const rounds = services.round.listByTournament(id);
    const nodes = [];

    const info = el(`
      <div class="card">
        <div class="section-title" style="margin-top:0">
          <h2>Dados do torneio</h2>
          <button class="btn small ghost" data-act="edit">Editar</button>
        </div>
        <dl class="meta-grid">
          <dt>Nº de sancionamento</dt><dd>${esc(t.sanctioningNumber || "—")}</dd>
          <dt>Data</dt><dd>${esc(fmtDate(t.eventDate) || "—")}</dd>
          <dt>Organizador</dt><dd>${esc(t.organizerId || "—")}</dd>
        </dl>
        <p class="hint" style="color:var(--muted);font-size:12px;margin-top:8px">O número de sancionamento é o Tournament ID usado no relatório.</p>
      </div>
    `);
    info.querySelector('[data-act="edit"]').addEventListener("click", () => go(`#/tournament/${id}/edit`));
    nodes.push(info);

    const roundsHeader = el(`
      <div class="section-title"><h2>Rodadas</h2>
        <button class="btn small accent" data-act="add">+ Rodada</button>
      </div>
    `);
    roundsHeader.querySelector('[data-act="add"]').addEventListener("click", () => {
      const res = services.round.addRound(id);
      if (res.ok) {
        toast(`Rodada ${res.value.number} criada`);
        shell.router.resolve();
      }
    });
    nodes.push(roundsHeader);

    if (rounds.length === 0) {
      nodes.push(
        el(`<div class="empty"><div class="big">🎴</div><div>Nenhuma rodada ainda.</div>
        <div class="sub" style="font-size:14px">Adicione uma rodada para registrar penalidades.</div></div>`)
      );
    } else {
      const ul = el('<ul class="list"></ul>');
      for (const r of rounds) {
        const count = services.round.getPenalties(r.id).length;
        const li = el(`
          <li class="list-item">
            <div class="grow">
              <div class="title">Rodada ${r.number}</div>
              <div class="sub">${count} penalidade(s)</div>
            </div>
            <span class="chev">›</span>
          </li>
        `);
        li.addEventListener("click", () => go(`#/tournament/${id}/round/${r.id}`));
        ul.appendChild(li);
      }
      nodes.push(ul);
    }

    const reportBtn = el('<button class="btn primary fab">📄 Gerar relatório</button>');
    reportBtn.addEventListener("click", () => go(`#/tournament/${id}/report`));
    nodes.push(reportBtn);

    render(nodes);
  }

  /* ---------------- Detalhe da rodada (+ penalidades) — Req 3, 4 ---------------- */
  function renderRoundDetail(tournamentId, roundId) {
    const t = services.tournament.get(tournamentId);
    const round = services.round.getRound(roundId);
    if (!t || !round) return go(`#/tournament/${tournamentId}`);
    shell.setHeader(`Rodada ${round.number}`, true);

    const penalties = services.round.getPenalties(roundId);
    const nodes = [];

    const header = el(`
      <div class="section-title" style="margin-top:0">
        <h2>Penalidades</h2>
        <button class="btn small danger ghost" data-act="delRound">Excluir rodada</button>
      </div>
    `);
    header.querySelector('[data-act="delRound"]').addEventListener("click", () => {
      confirmSheet("Excluir rodada?", "As penalidades desta rodada serão removidas.", () => {
        services.round.deleteRound(roundId, true);
        closeSheet();
        toast("Rodada excluída");
        go(`#/tournament/${tournamentId}`);
      });
    });
    nodes.push(header);

    if (penalties.length === 0) {
      nodes.push(el(`<div class="empty"><div class="big">⚖️</div><div>Nenhuma penalidade registrada.</div></div>`));
    } else {
      for (const p of penalties) {
        const cat = getCategory(p.categoryId);
        const item = el(`
          <div class="pen">
            <div class="pen-head">
              <span class="pen-cat">${esc(categoryLabel(p.categoryId))}</span>
              <span class="badge ${esc(p.penaltyId)}">${esc(penaltyLabel(p.penaltyId))}</span>
            </div>
            <div class="pen-meta">Player ${esc(p.playerId)} • ${esc(severityLabel(p.severityId))}${cat ? " • §" + cat.section : ""}${p.confirmerRole ? " • confirmado" : ""}</div>
            ${p.description ? `<div class="pen-desc">${esc(p.description)}</div>` : ""}
            <div class="pen-actions">
              <button class="btn small danger ghost" data-act="del">Remover</button>
            </div>
          </div>
        `);
        item.querySelector('[data-act="del"]').addEventListener("click", () => {
          confirmSheet("Remover penalidade?", "", () => {
            // Remoção direta no estado via penalty service helper (reusa storage).
            deletePenalty(tournamentId, roundId, p.id);
            closeSheet();
            toast("Penalidade removida");
            shell.router.resolve();
          });
        });
        nodes.push(item);
      }
    }

    const fab = el('<button class="btn primary fab">+ Registrar penalidade</button>');
    fab.addEventListener("click", () => openPenaltyForm(tournamentId, roundId));
    nodes.push(fab);

    render(nodes);
  }

  // Remoção de penalidade: delega ao storage via um pequeno método do serviço.
  function deletePenalty(tournamentId, roundId, penaltyId) {
    services.penalty.remove(penaltyId);
  }

  /* ---------------- Form de penalidade (sheet) — Req 4, 5, 6, 7, 11.3 ---------------- */
  function openPenaltyForm(tournamentId, roundId) {
    const firstCat = CATEGORIES[0].id;
    const catOpts = CATEGORIES.map(
      (c) => `<option value="${c.id}">${esc(c.label)}</option>`
    ).join("");
    const penOpts = PENALTIES.map(
      (p) => `<option value="${p.id}">${esc(p.label)}</option>`
    ).join("");

    const sheet = openSheet(`
      <h3>Registrar penalidade</h3>
      <form id="penForm" novalidate>
        <div class="field" data-f="categoryId">
          <label>Categoria da penalidade</label>
          <select name="categoryId">${catOpts}</select>
        </div>
        <div class="field" data-f="playerId">
          <label>Player ID do jogador infrator</label>
          <input name="playerId" inputmode="numeric" />
          <div class="error">Informe o Player ID.</div>
        </div>
        <div class="field" data-f="severityId">
          <label>Severidade da infração</label>
          <select name="severityId"></select>
          <div class="error">Combinação de categoria e severidade inválida.</div>
        </div>
        <div id="recommendBox"></div>
        <div class="field" data-f="penaltyId">
          <label>Penalidade aplicada</label>
          <select name="penaltyId">${penOpts}</select>
          <div class="hint" id="catNote"></div>
        </div>
        <div class="field hidden" data-f="confirmerRole" id="confirmField">
          <label>Confirmação (Head/Assistant Head Judge)</label>
          <select name="confirmerRole">
            <option value="">— selecione —</option>
            <option value="head_judge">Head Judge</option>
            <option value="assistant_head_judge">Assistant Head Judge</option>
          </select>
          <div class="hint">Obrigatória para penalidades acima de Warning.</div>
          <div class="error">Confirmação obrigatória para esta penalidade.</div>
        </div>
        <div class="field" data-f="description">
          <label>Descrição da situação</label>
          <textarea name="description" maxlength="1000" placeholder="Descreva o que ocorreu."></textarea>
          <div class="error">Descreva a situação.</div>
        </div>
        <div class="btn-row">
          <button type="button" class="btn ghost" data-act="cancel">Cancelar</button>
          <button type="submit" class="btn primary">Salvar</button>
        </div>
      </form>
    `);

    const form = sheet.querySelector("#penForm");
    const catSel = form.querySelector('[name="categoryId"]');
    const sevSel = form.querySelector('[name="severityId"]');
    const penSel = form.querySelector('[name="penaltyId"]');
    const playerInput = form.querySelector('[name="playerId"]');
    const recommendBox = form.querySelector("#recommendBox");
    const catNote = form.querySelector("#catNote");
    const confirmField = form.querySelector("#confirmField");

    let penaltyTouched = false;
    penSel.addEventListener("change", () => {
      penaltyTouched = true;
      refreshConfirmVisibility();
    });

    function refreshSeverities() {
      const opts = severitiesForCategory(catSel.value);
      sevSel.innerHTML = opts
        .map((s) => `<option value="${s.id}">${esc(s.label)}</option>`)
        .join("");
    }

    function refreshConfirmVisibility() {
      const needs = requiresHeadJudgeConfirmation(penSel.value);
      confirmField.classList.toggle("hidden", !needs);
    }

    function refreshRecommendation() {
      const categoryId = catSel.value;
      const severityId = sevSel.value;
      const cat = getCategory(categoryId);
      const playerId = playerInput.value.trim();

      catNote.textContent = cat ? `${cat.note} (§${cat.section})` : "";

      const info = services.penalty.evaluateEscalation({
        tournamentId,
        playerId,
        categoryId,
        severityId,
      });

      let html = "";
      if (info.base) {
        html += `<div class="alert info"><div class="recommend">Penalidade recomendada:
          <span class="badge ${info.base}">${esc(penaltyLabel(info.base))}</span></div></div>`;
      }
      if (info.priorCount > 0 && cat && !cat.escalates) {
        html += `<div class="alert warn">⚠️ Este jogador já tem <strong>${info.priorCount}</strong> penalidade(s)
          de <strong>${esc(cat.label)}</strong>. Cheating não admite escalonamento (§5.4).</div>`;
      } else if (info.escalated) {
        html += `<div class="alert warn">⚠️ <strong>Reincidência:</strong> ${info.priorCount} penalidade(s)
          anterior(es) de <strong>${esc(cat.label)}</strong> para este jogador. Sugestão (§4.4.2):
          <span class="badge ${info.base}">${esc(penaltyLabel(info.base))}</span> →
          <span class="badge ${info.suggested}">${esc(penaltyLabel(info.suggested))}</span>.
          <div style="margin-top:10px"><button type="button" class="btn small primary" data-act="applyEsc">Aplicar elevação</button></div>
        </div>`;
      }
      recommendBox.innerHTML = html;

      if (!penaltyTouched && info.base) {
        penSel.value = info.suggested || info.base;
      }
      refreshConfirmVisibility();

      const applyBtn = recommendBox.querySelector('[data-act="applyEsc"]');
      if (applyBtn) {
        applyBtn.addEventListener("click", () => {
          penSel.value = info.suggested;
          penaltyTouched = true;
          refreshConfirmVisibility();
          toast("Penalidade elevada aplicada");
        });
      }
    }

    catSel.addEventListener("change", () => {
      refreshSeverities();
      refreshRecommendation();
    });
    sevSel.addEventListener("change", refreshRecommendation);
    playerInput.addEventListener("input", refreshRecommendation);

    refreshSeverities();
    refreshRecommendation();

    form.querySelector('[data-act="cancel"]').addEventListener("click", closeSheet);

    form.addEventListener("submit", (e) => {
      e.preventDefault();
      const data = Object.fromEntries(new FormData(form).entries());
      const res = services.penalty.record({ ...data, roundId });
      if (!res.ok) {
        applyErrors(form, res.errors);
        return;
      }
      closeSheet();
      toast("Penalidade registrada");
      shell.router.resolve();
    });
  }

  /* ---------------- Relatório / compartilhamento — Req 8, 9 ---------------- */
  function renderReport(tournamentId) {
    const t = services.tournament.get(tournamentId);
    if (!t) return go("#/tournaments");
    shell.setHeader("Relatório", true);

    const { csv, reportableCount } = services.report.generateCsv(tournamentId);
    const subject = services.report.emailSubject(t.id);
    const judge = services.profile.getProfile();
    const nodes = [];

    // Dados estruturados por rodada (apenas penalidades reportáveis = não-Caution),
    // para uma revisão legível em tela. O CSV (fonte de exportação) fica abaixo.
    const rounds = services.round
      .listByTournament(t.id)
      .map((r) => ({
        number: r.number,
        penalties: services.round
          .getPenalties(r.id)
          .filter((p) => isReportablePenalty(p.penaltyId)),
      }))
      .filter((r) => r.penalties.length > 0);

    // Contagem por tipo de penalidade (na ordem do conjunto fechado).
    const countByPenalty = {};
    for (const r of rounds) {
      for (const p of r.penalties) {
        countByPenalty[p.penaltyId] = (countByPenalty[p.penaltyId] || 0) + 1;
      }
    }
    const breakdown = PENALTIES.filter((p) => countByPenalty[p.id]).map(
      (p) =>
        `<span class="badge ${p.id}">${esc(p.label)}: ${countByPenalty[p.id]}</span>`
    );

    // Card de resumo (dados do torneio + totais).
    const summaryCard = el(`
      <div class="card">
        <h2>Tournament Penalty Summary</h2>
        <dl class="meta-grid" style="margin-bottom:12px">
          <dt>Torneio</dt><dd>${esc(t.description)}</dd>
          <dt>Tournament ID</dt><dd>${esc(t.sanctioningNumber)}</dd>
          <dt>Data</dt><dd>${esc(fmtDate(t.eventDate) || "—")}</dd>
          <dt>Juiz</dt><dd>${judge ? esc(`${judge.firstName} ${judge.lastName} (ID ${judge.judgeId})`) : "—"}</dd>
          <dt>Reportáveis</dt><dd><strong>${reportableCount}</strong></dd>
        </dl>
        ${
          reportableCount === 0
            ? '<div class="alert warn">Não há penalidades reportáveis neste torneio. Cautions não entram no relatório (§6.1).</div>'
            : `<div style="display:flex;gap:6px;flex-wrap:wrap">${breakdown.join("")}</div>`
        }
      </div>
    `);
    nodes.push(summaryCard);

    // Cards por rodada com as penalidades reportáveis em formato legível.
    for (const r of rounds) {
      const items = r.penalties
        .map((p) => {
          const cat = getCategory(p.categoryId);
          return `
            <div class="pen" style="margin-bottom:8px">
              <div class="pen-head">
                <span class="pen-cat">${esc(categoryLabel(p.categoryId))}</span>
                <span class="badge ${esc(p.penaltyId)}">${esc(penaltyLabel(p.penaltyId))}</span>
              </div>
              <div class="pen-meta">Player ${esc(p.playerId)} • ${esc(severityLabel(p.severityId))}${cat ? " • §" + cat.section : ""}${p.confirmerRole ? " • confirmado" : ""}</div>
              ${p.description ? `<div class="pen-desc">${esc(p.description)}</div>` : ""}
            </div>`;
        })
        .join("");
      nodes.push(
        el(`
          <div class="card">
            <div class="section-title" style="margin-top:0"><h2>Rodada ${r.number} — ${r.penalties.length} penalidade(s)</h2></div>
            ${items}
          </div>
        `)
      );
    }

    // CSV cru recolhido, para conferência do arquivo exato que será exportado.
    nodes.push(
      el(`
        <details class="card">
          <summary style="cursor:pointer;font-weight:600">Ver CSV (formato de exportação §6.1)</summary>
          <p class="hint" style="color:var(--muted);font-size:12px;margin:10px 0">
            Assunto do envio: <strong>${esc(subject)}</strong>
          </p>
          <pre class="report">${esc(csv)}</pre>
        </details>
      `)
    );

    const payload = { tournamentId: t.id, subject, csv };

    const shareCard = el(`
      <div class="card">
        <h2>Compartilhar</h2>
        <div class="btn-row" style="margin-bottom:10px">
          <button class="btn" data-ch="whatsapp">WhatsApp</button>
          <button class="btn" data-ch="telegram">Telegram</button>
          <button class="btn" data-ch="email">E-mail</button>
        </div>
        <button class="btn primary" data-act="download">⬇️ Baixar CSV</button>
        <p class="hint" style="color:var(--muted);font-size:12px;margin-top:10px">
          O CSV segue o formato oficial (§6.1) para submissão no portal da Play! Pokémon.
        </p>
      </div>
    `);

    shareCard.querySelectorAll("[data-ch]").forEach((btn) => {
      btn.addEventListener("click", async () => {
        const channel = btn.getAttribute("data-ch");
        const res = await services.share.share(channel, payload);
        if (!res.ok) {
          toast(res.message || "Canal indisponível. Baixe o CSV.");
        }
      });
    });
    shareCard.querySelector('[data-act="download"]').addEventListener("click", () => {
      services.share.downloadCsv(payload);
      toast("CSV gerado");
    });
    nodes.push(shareCard);

    render(nodes);
  }

  /* ---------------- Sobre ---------------- */
  function renderAbout() {
    shell.setHeader("Sobre", true);

    const card = el(`
      <div class="card about">
        <div class="about-head">
          <span class="logo-dot" aria-hidden="true"></span>
          <div>
            <div class="about-name">${esc(APP_NAME)}</div>
            <div class="about-version">Versão ${esc(APP_VERSION)}</div>
          </div>
        </div>

        <dl class="meta-grid" style="margin-top:14px">
          <dt>Desenvolvido por</dt><dd>${esc(AUTHOR.name)} (${esc(AUTHOR.handle)})</dd>
        </dl>

        <div class="btn-row" style="margin-top:14px">
          <a class="btn" href="${esc(AUTHOR.links.x)}" target="_blank" rel="noopener noreferrer">X ${esc(AUTHOR.handle)}</a>
          <a class="btn" href="${esc(AUTHOR.links.instagram)}" target="_blank" rel="noopener noreferrer">Instagram ${esc(AUTHOR.handle)}</a>
        </div>

        <div class="alert info" style="margin-top:16px">
          ${esc(DISCLAIMER)}
        </div>
      </div>
    `);
    render(card);
  }

  return {
    renderProfile,
    renderTournamentList,
    renderTournamentForm,
    renderTournamentDetail,
    renderRoundDetail,
    renderReport,
    renderAbout,
  };
}
