/*
 * ReportService — Tournament Penalty Summary em CSV (Requisitos 8.1–8.8, §6.1).
 *
 * Cabeçalho fixo e ordenado:
 *   Tournament ID, Round of Issue, Judge Player ID, Competitor's Player ID,
 *   Category, Severity, Penalty, Notes
 *
 * Reportável = toda penalidade cujo tipo não é Caution (§6.1 / Req 8.2, 8.3).
 */

import {
  categoryLabel,
  severityLabel,
  penaltyLabel,
  isReportablePenalty,
} from "../domain/rules.js";

export const CSV_HEADERS = [
  "Tournament ID",
  "Round of Issue",
  "Judge Player ID",
  "Competitor's Player ID",
  "Category",
  "Severity",
  "Penalty",
  "Notes",
];

/* Escape CSV (Req 8.6): envolve em aspas e duplica aspas internas quando o
 * valor contém vírgula, aspas duplas ou quebra de linha. */
export function csvEscape(value) {
  const s = value == null ? "" : String(value);
  if (/[",\r\n]/.test(s)) {
    return '"' + s.replace(/"/g, '""') + '"';
  }
  return s;
}

export class ReportService {
  /** @param {{load:Function}} storage */
  constructor(storage) {
    this._storage = storage;
  }

  /*
   * Assunto do envio: "Penalty Report: <sanctioningNumber>" (Req 8.7).
   * Recebe o ID de cadastro para localizar o torneio; usa o número de
   * sancionamento como Tournament ID. Para torneio inexistente, usa string
   * vazia (defensivo).
   */
  emailSubject(recordId) {
    const state = this._storage.load();
    const tournament = state.tournaments.find((t) => t.id === recordId);
    const tid = tournament ? tournament.sanctioningNumber : "";
    return `Penalty Report: ${tid}`;
  }

  /*
   * Linhas de dados (reportáveis), ordenadas por rodada e, dentro da rodada,
   * por ordem cronológica de emissão (createdAt) — Req 8.5. Cada linha é um
   * array de valores na ordem dos cabeçalhos. A coluna Tournament ID recebe o
   * número de sancionamento do torneio (não o ID de cadastro interno).
   */
  buildRows(recordId) {
    const state = this._storage.load();
    const tournament = state.tournaments.find((t) => t.id === recordId);
    if (!tournament) return [];
    const judgeId = state.profile ? state.profile.judgeId : "";
    const reportTournamentId = tournament.sanctioningNumber;

    // Mapa roundId -> number para a coluna "Round of Issue".
    const roundNumberById = new Map(
      state.rounds
        .filter((r) => r.tournamentId === recordId)
        .map((r) => [r.id, r.number])
    );

    return state.penalties
      .filter((p) => p.tournamentId === recordId)
      .filter((p) => isReportablePenalty(p.penaltyId)) // exclui Caution (8.2, 8.3)
      .sort((a, b) => {
        const ra = roundNumberById.get(a.roundId) ?? 0;
        const rb = roundNumberById.get(b.roundId) ?? 0;
        if (ra !== rb) return ra - rb; // por rodada asc
        return a.createdAt - b.createdAt; // cronológico dentro da rodada
      })
      .map((p) => [
        reportTournamentId,
        roundNumberById.get(p.roundId) ?? "",
        judgeId,
        p.playerId,
        categoryLabel(p.categoryId),
        severityLabel(p.severityId),
        penaltyLabel(p.penaltyId),
        p.description || "",
      ]);
  }

  /*
   * Gera o CSV completo. Retorna { csv, reportableCount }.
   * Sem reportáveis -> apenas a linha de cabeçalho (Req 8.8).
   */
  generateCsv(tournamentId) {
    const rows = this.buildRows(tournamentId);
    const lines = [CSV_HEADERS, ...rows].map((row) =>
      row.map(csvEscape).join(",")
    );
    return { csv: lines.join("\r\n"), reportableCount: rows.length };
  }
}
