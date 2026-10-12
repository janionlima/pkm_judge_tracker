/*
 * Regras de negócio derivadas do Play! Pokémon Penalty Guidelines
 * (LAST REVISION: September 1, 2026) e do Tournament Rules Handbook, cap. 7.
 *
 * Fontes:
 *  - Penalty Guidelines §3  (lista fechada de penalidades)
 *  - Penalty Guidelines §5  (base infractions, recommended starting penalties)
 *  - Penalty Guidelines §4.4.2 (Repeated Infractions / escalonamento)
 *  - Penalty Guidelines §6.1 (Tournament Penalty Summaries / formato CSV)
 */

/* Conjunto fechado de penalidades (§3). A ordem define a severidade crescente,
 * usada para o escalonamento por reincidência. */
export const PENALTIES = [
  { id: "caution", label: "Caution", reportable: false },
  { id: "warning", label: "Warning", reportable: true },
  { id: "double_prize_loss", label: "Double Prize Loss", reportable: true },
  { id: "quad_prize_loss", label: "Quadruple Prize Loss", reportable: true },
  { id: "game_loss", label: "Game Loss", reportable: true },
  { id: "match_loss", label: "Match Loss", reportable: true },
  { id: "disqualification", label: "Disqualification", reportable: true },
];

/* Índice de severidade para comparar/escalar penalidades. */
export const PENALTY_RANK = PENALTIES.reduce((acc, p, i) => {
  acc[p.id] = i;
  return acc;
}, {});

export function penaltyLabel(id) {
  const p = PENALTIES.find((x) => x.id === id);
  return p ? p.label : id;
}

/* True se o id pertence ao conjunto fechado de penalidades (§3). */
export function isValidPenalty(id) {
  return Object.prototype.hasOwnProperty.call(PENALTY_RANK, id);
}

/* Reportável no CSV (§6.1): toda penalidade exceto Caution. */
export function isReportablePenalty(id) {
  const p = PENALTIES.find((x) => x.id === id);
  return !!p && p.reportable;
}

/*
 * Confirmação do Head/Assistant Head Judge (Handbook cap. 7): exigida para
 * qualquer penalidade acima de Warning no conjunto ordenado por severidade.
 */
export function requiresHeadJudgeConfirmation(penaltyId) {
  if (!isValidPenalty(penaltyId)) return false;
  return PENALTY_RANK[penaltyId] > PENALTY_RANK["warning"];
}

/* Níveis de severidade da infração (§5). */
export const SEVERITIES = [
  { id: "minor", label: "Minor" },
  { id: "major", label: "Major" },
  { id: "severe", label: "Severe" },
];

export function severityLabel(id) {
  const s = SEVERITIES.find((x) => x.id === id);
  return s ? s.label : id;
}

/* True se o id é uma das três severidades (minor/major/severe). */
export function isValidSeverity(id) {
  return SEVERITIES.some((s) => s.id === id);
}

/*
 * Categorias de base infraction e as penalidades iniciais recomendadas por
 * severidade (§5). Cada categoria indica se admite escalonamento por
 * reincidência (Cheating não admite — §5.4).
 *
 * `recommended` mapeia severidade -> id de penalidade. Quando uma severidade
 * não se aplica a uma categoria, ela é omitida.
 */
export const CATEGORIES = [
  {
    id: "procedural_error",
    label: "Procedural Error",
    section: "5.1",
    escalates: true,
    recommended: { minor: "caution", major: "warning", severe: "game_loss" },
    note: "Impacta o andamento suave do torneio.",
  },
  {
    id: "tardiness",
    label: "Tardiness",
    section: "5.2",
    escalates: true,
    recommended: { minor: "warning", major: "game_loss", severe: "match_loss" },
    note: "Severe (>10 min): Match Loss + drop do competidor.",
  },
  {
    id: "unsporting_conduct",
    label: "Unsporting Conduct",
    section: "5.3",
    escalates: true,
    recommended: {
      minor: "warning",
      major: "match_loss",
      severe: "disqualification",
    },
    note: "Conduta inadequada de competidor ou espectador.",
  },
  {
    id: "cheating",
    label: "Cheating",
    section: "5.4",
    escalates: false,
    recommended: {
      minor: "disqualification",
      major: "disqualification",
      severe: "disqualification",
    },
    note: "Toda instância é severa e resulta em Disqualification. Sem escalonamento.",
  },
  {
    id: "gameplay_error_tcg",
    label: "Gameplay Error (TCG)",
    section: "5.5.1",
    escalates: true,
    recommended: {
      minor: "warning",
      major: "double_prize_loss",
      severe: "game_loss",
    },
    note: "Erros de jogo no Pokémon TCG. Buscar reversibilidade (§4.4.1).",
  },
  {
    id: "gameplay_error_vg",
    label: "Gameplay Error (VG)",
    section: "5.5.2",
    escalates: true,
    recommended: { minor: "warning", severe: "game_loss" },
    note: "Erros de jogo no videogame (sem nível Major definido).",
  },
  {
    id: "gameplay_error_go",
    label: "Gameplay Error (GO)",
    section: "5.5.3",
    escalates: true,
    recommended: { minor: "warning", severe: "game_loss" },
    note: "Erros de jogo no Pokémon GO (sem nível Major definido).",
  },
  {
    id: "legality_check_tcg",
    label: "Legality Check — TCG Deck",
    section: "5.6.1",
    escalates: true,
    recommended: {
      minor: "warning",
      major: "game_loss",
      severe: "disqualification",
    },
    note: "Problemas de legalidade do deck. Substituir a(s) carta(s) ofensora(s).",
  },
  {
    id: "legality_check_vg",
    label: "Legality Check — VG Team",
    section: "5.6.2",
    escalates: true,
    recommended: {
      minor: "warning",
      major: "game_loss",
      severe: "disqualification",
    },
    note: "Divergências entre a Battle Team e a team list.",
  },
  {
    id: "legality_check_go",
    label: "Legality Check — GO Team",
    section: "5.6.3",
    escalates: true,
    recommended: {
      minor: "warning",
      major: "game_loss",
      severe: "disqualification",
    },
    note: "Divergências entre a time e a team list.",
  },
  {
    id: "pace_of_play",
    label: "Pace of Play",
    section: "5.7",
    escalates: true,
    recommended: { minor: "warning", severe: "double_prize_loss" },
    note: "Ações que prejudicam o ritmo do jogo (sem nível Major definido).",
  },
];

export function getCategory(id) {
  return CATEGORIES.find((c) => c.id === id) || null;
}

export function categoryLabel(id) {
  const c = getCategory(id);
  return c ? c.label : id;
}

/* True se o id é uma das categorias de base infraction (§5). */
export function isValidCategory(id) {
  return !!getCategory(id);
}

/*
 * Severidades disponíveis para uma categoria — exatamente aquelas que possuem
 * penalidade recomendada em §5 (Property 10). Categoria desconhecida -> [].
 */
export function severitiesForCategory(categoryId) {
  const cat = getCategory(categoryId);
  if (!cat) return [];
  return SEVERITIES.filter((s) => cat.recommended[s.id]);
}

/*
 * Penalidade recomendada para (categoria, severidade), ou null quando a
 * combinação não é prevista em §5.
 */
export function recommendedPenalty(categoryId, severityId) {
  const cat = getCategory(categoryId);
  if (!cat) return null;
  return cat.recommended[severityId] || null;
}

/* True se (categoria, severidade) é uma combinação válida conforme §5. */
export function isValidCombination(categoryId, severityId) {
  return recommendedPenalty(categoryId, severityId) !== null;
}

/*
 * Escalonamento por reincidência (§4.4.2).
 *
 * Dada a penalidade recomendada e o número de penalidades ANTERIORES da mesma
 * categoria para o mesmo jogador, sugere elevar a penalidade um tier por
 * reincidência, respeitando o teto do conjunto fechado e o fato de que
 * Cheating não escala.
 *
 * Retorna { base, suggested, escalated, priorCount } onde base e suggested são
 * ids de penalidade.
 */
export function suggestEscalation(categoryId, severityId, priorCount) {
  const cat = getCategory(categoryId);
  const base = recommendedPenalty(categoryId, severityId);
  // Normaliza a contagem: nunca negativa, sempre inteira (Property 14, n >= 0).
  const prior = Math.max(0, Math.floor(Number(priorCount) || 0));
  if (!cat || !base) {
    return { base, suggested: base, escalated: false, priorCount: prior };
  }
  if (!cat.escalates || prior === 0) {
    return { base, suggested: base, escalated: false, priorCount: prior };
  }
  const maxRank = PENALTIES.length - 1;
  const baseRank = PENALTY_RANK[base];
  const suggestedRank = Math.min(baseRank + prior, maxRank);
  const suggestedId = PENALTIES[suggestedRank].id;
  return {
    base,
    suggested: suggestedId,
    escalated: suggestedRank > baseRank,
    priorCount: prior,
  };
}
