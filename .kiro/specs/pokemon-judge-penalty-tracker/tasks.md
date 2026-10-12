# Implementation Plan

- [x] 1. Preparar o projeto (Vite + Vitest + fast-check) e a estrutura de pastas
  - Inicializar `package.json` com scripts `dev`, `build`, `preview` (Vite) e `test`, `test:run` (Vitest).
  - Adicionar dependências de desenvolvimento: `vite`, `vitest`, `fast-check`, `jsdom`.
  - Configurar `vite.config.js` com `base: './'` (para servir de arquivos estáticos) e `test.environment` apropriado (`node` por padrão; `jsdom` nos testes que tocam DOM/localStorage).
  - Criar a estrutura: `src/domain/`, `src/services/`, `src/storage/`, `src/ui/`, `src/platform/`, `test/`.
  - _Requirements: 10.4, 10.7_

- [x] 2. Consolidar a camada de domínio (`rules.js`) e cobri-la com testes de propriedade
- [x] 2.1 Mover e revisar o módulo de domínio
  - Mover `js/rules.js` para `src/domain/rules.js` sem reimplementar regras; manter `PENALTIES` (com `reportable`), `PENALTY_RANK`, `SEVERITIES`, `CATEGORIES`, `recommendedPenalty()`, `severitiesForCategory()`, `suggestEscalation()`, `penaltyLabel()`, `severityLabel()`, `categoryLabel()`.
  - Garantir que `PENALTIES` marca somente `caution` como `reportable:false` e os demais como `reportable:true`.
  - _Requirements: 4.2, 4.3, 4.4, 5.1, 5.2, 5.3, 5.4, 5.5, 5.6, 5.7, 5.8, 5.9, 5.10, 5.11, 6.3, 6.4, 6.5, 6.6_

- [x] 2.2 Testes de propriedade do domínio
  - Property 10 (severidades oferecidas = severidades válidas da categoria; VG/GO/Pace só Minor/Severe) enumerando `CATEGORIES`.
  - Property 11 (toda combinação válida tem penalidade recomendada no conjunto fechado).
  - Property 14 (escalonamento eleva um nível por prévio, teto Disqualification; n=0 não sinaliza).
  - Property 15 (Cheating nunca escala).
  - Testes por exemplo dos valores exatos da tabela §5.1–§5.11 (ex.: `cheating→disqualification`, `tardiness/severe→match_loss`).
  - Usar `fc.assert(..., { numRuns: 100 })` e comentário de rastreabilidade por propriedade.
  - _Requirements: 4.5, 5.1-5.11, 6.3, 6.4, 6.5, 6.6_

- [x] 3. Implementar a camada de persistência (StorageAdapter) com estado-raiz versionado
- [x] 3.1 Definir erros e o contrato do adaptador
  - Criar `src/storage/errors.js` com `StorageWriteError`, `StorageQuotaError`, `StorageCorruptedError`.
  - Criar `src/storage/storageAdapter.js` definindo o contrato (`load()`, `save(state)`, `isAvailable()`) e a forma do `AppState` (`schemaVersion:1`, `profile`, `tournaments[]`, `rounds[]`, `penalties[]`).
  - _Requirements: 10.1, 10.2, 10.3, 10.6_

- [x] 3.2 Implementar `MemoryStorageAdapter` e `LocalStorageAdapter`
  - `MemoryStorageAdapter`: estado em memória, usado nos testes (clona na leitura/escrita para round-trip estrutural).
  - `LocalStorageAdapter`: chave raiz `pjpt.appState` + `pjpt.schemaVersion`; gravação atômica (serializa o AppState inteiro); mapeia `QuotaExceededError`→`StorageQuotaError` e outras falhas→`StorageWriteError`; `load()` tolerante a falhas (parse/schema inválido → estado vazio sem sobrescrever a chave, sinalizando corrupção).
  - _Requirements: 10.1, 10.2, 10.3, 10.5, 10.6_

- [x] 3.3 Testes da persistência
  - Property 1 (round-trip `save`→`load` estruturalmente igual) com `MemoryStorageAdapter` e gerador de `AppState`.
  - Testes por exemplo com stubs que lançam `StorageWriteError` e `StorageQuotaError`; conteúdo corrompido no boot não sobrescreve a chave original (via jsdom + `localStorage`).
  - Teste de paridade `LocalStorageAdapter` (jsdom) vs `MemoryStorageAdapter`.
  - _Requirements: 10.2, 10.3, 10.5, 10.6_

- [x] 4. Implementar o `ProfileService`
  - `getProfile()` e `saveProfile(input)` retornando `Result<Profile, ValidationError[]>`.
  - Validar: campos obrigatórios não-vazios; `firstName`/`lastName` ≤ 50; `judgeId` ≤ 20; `dateOfBirth` ≤ data atual do dispositivo; em erro não persiste e retorna campos inválidos.
  - Persistir via `StorageAdapter`; `getProfile()` restaura do estado carregado.
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7_

- [x] 4.1 Testes do `ProfileService`
  - Property 2 (campos obrigatórios vazios/espaços rejeitam e preservam) — recorte de perfil.
  - Property 3 (limites de comprimento nome ≤50, judgeId ≤20) — recorte de perfil.
  - Property 4 (data de nascimento futura inválida).
  - Teste por exemplo de restauração no boot (Req 1.6).
  - _Requirements: 1.2, 1.3, 1.4, 1.6_

- [x] 5. Implementar o `TournamentService` (CRUD + geração de ID)
  - `generateTournamentId()` no formato `XX-XX-XXXXXX` alfanumérico; `create()` regenera enquanto colidir com ids existentes.
  - `create(input)`/`update(id, input)` validando: `description` 1–200; `sanctioningNumber` 1–50; `organizerId` e `eventDate` obrigatórios; data válida; `update` mantém o `id`.
  - `list()` retornando ao menos id, descrição e data; `get(id)`.
  - `delete(id, confirmed)` em cascata (remove rodadas e penalidades) quando confirmado; sem alteração quando cancelado.
  - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7, 2.8, 2.9, 2.10, 2.11, 2.12, 2.13, 2.14_

- [x] 5.1 Testes do `TournamentService`
  - Property 5 (formato do Tournament ID — regex `^[A-Za-z0-9]{2}-[A-Za-z0-9]{2}-[A-Za-z0-9]{6}$`).
  - Property 6 (unicidade dos ids em sequência de criações, com regeneração em colisão — forçar colisão com gerador mockado).
  - Property 7 (edição preserva o id).
  - Property 8 (exclusão em cascata com confirmação; cancelado não altera) — parte torneio.
  - Property 2 e Property 3 no recorte de torneio (obrigatórios; descrição 1–200, sancionamento 1–50).
  - _Requirements: 2.2, 2.3, 2.4, 2.5, 2.10, 2.11, 2.12, 2.13, 2.14_

- [x] 6. Implementar o `RoundService`
  - `addRound(tournamentId)`: `number = max(number das rodadas do torneio) + 1`, ou 1 se não houver.
  - `listByTournament(tournamentId)` ordenado crescentemente por `number`.
  - `getPenalties(roundId)`; `deleteRound(roundId, confirmed)` removendo penalidades em cascata quando confirmado.
  - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7, 3.8, 3.9, 3.10_

- [x] 6.1 Testes do `RoundService`
  - Property 9 (adicionar k rodadas gera números 1..k e a listagem é crescente).
  - Property 8 (exclusão de rodada em cascata com/sem confirmação) — parte rodada.
  - Testes por exemplo de "sem rodadas"/"sem penalidades" (dados que a UI usará — Req 3.5, 3.7).
  - _Requirements: 3.2, 3.3, 3.4, 3.9, 3.10_

- [x] 7. Implementar o `PenaltyService` (integra `rules.js`, reincidência e confirmação)
- [x] 7.1 Opções de severidade, recomendação e avaliação de escalonamento
  - `severityOptions(categoryId)` → `severitiesForCategory`.
  - `recommendedFor(categoryId, severityId)` → `recommendedPenalty`.
  - `evaluateEscalation({tournamentId, playerId, categoryId, severityId})`: conta prévios (mesma categoria + mesmo playerId + mesmo torneio) e chama `suggestEscalation`, retornando `{base, suggested, escalated, priorCount}`.
  - _Requirements: 4.5, 4.9, 6.1, 6.2, 6.3, 6.4, 6.5, 6.6, 6.7_

- [x] 7.2 Registro da penalidade com validações e confirmação do Head Judge
  - `record(input)` validando: campos obrigatórios (categoria, playerId, penalidade, descrição, severidade); descrição 1–1000; combinação (categoria, severidade) válida em §5; penalidade dentro do conjunto fechado.
  - Confirmação: penalidades com `PENALTY_RANK[penaltyId] > PENALTY_RANK["warning"]` exigem `confirmerRole` (`head_judge`|`assistant_head_judge`); ausência rejeita; Caution/Warning não exigem; papel é persistido quando presente.
  - Persistir com `createdAt` numérico para ordem cronológica; `tournamentId` desnormalizado.
  - _Requirements: 4.1, 4.6, 4.7, 4.8, 7.1, 7.2, 7.3, 7.4_

- [x] 7.3 Testes do `PenaltyService`
  - Property 12 (combinação categoria/severidade inválida rejeita e preserva).
  - Property 13 (contagem de reincidência escopada a categoria + playerId + torneio).
  - Property 16 (confirmação obrigatória acima de Warning; persiste papel; Caution/Warning sem confirmação).
  - Property 2 e Property 3 no recorte de penalidade (obrigatórios; descrição 1–1000).
  - _Requirements: 4.6, 4.7, 4.8, 6.1, 7.1, 7.2, 7.3, 7.4_

- [x] 8. Implementar o `ReportService` (CSV §6.1)
  - `generateCsv(tournamentId)`: cabeçalho fixo e ordenado; incluir só reportáveis (exclui todas as Caution); mapear colunas (`Tournament ID`=id do torneio, `Round of Issue`=número da rodada, `Judge Player ID`=Judge ID do perfil, `Competitor's Player ID`=playerId, `Category`/`Severity`/`Penalty`=rótulos de `rules.js`, `Notes`=descrição ou vazio).
  - Ordenar linhas por `Round of Issue` asc e, dentro da rodada, por `createdAt`.
  - Escape CSV (vírgula/aspas/quebra → aspas duplas + duplicação de aspas internas).
  - Sem reportáveis → só cabeçalho + `reportableCount=0`.
  - `emailSubject(tournamentId)` → `Penalty Report: <id>`.
  - _Requirements: 8.1, 8.2, 8.3, 8.4, 8.5, 8.6, 8.7, 8.8_

- [x] 8.1 Testes do `ReportService`
  - Property 17 (cabeçalho exato).
  - Property 18 (nº de linhas = penalidades não-Caution; nenhuma Caution; sem reportáveis → só cabeçalho).
  - Property 19 (mapeamento de colunas, inclusive Judge Player ID do perfil — valida Req 1.7).
  - Property 20 (ordenação por rodada + cronológica).
  - Property 21 (round-trip de escape de CSV com parser de referência).
  - Property 22 (assunto `Penalty Report: <id>`).
  - _Requirements: 8.1-8.8, 1.7_

- [x] 9. Implementar o `ShareService` (multicanal + fallback de download)
  - `availableChannels()` por feature-detection.
  - `share(channel, payload)`: Web Share API quando disponível; senão deep links `wa.me`/`t.me` e `mailto:` (assunto `Penalty Report: <id>`).
  - Falha ao montar assunto → mensagem e relatório permanece disponível.
  - Canal indisponível → mensagem + oferta de download.
  - `downloadCsv(payload)` via `Blob` + `<a download>` (com BOM UTF-8).
  - _Requirements: 9.1, 9.2, 9.3, 9.4, 9.5, 9.6, 9.7_

- [x] 9.1 Testes do `ShareService`
  - Mockar `navigator.share`, `navigator.canShare`, `window.open`, `location.href`.
  - Verificar: canais por feature-detection; chamada do Web Share quando disponível; URLs `wa.me`/`t.me` e `mailto:` corretos no fallback; download (Blob + `<a download>`) quando indisponível; mensagem + manutenção do relatório quando o assunto falha.
  - _Requirements: 9.1, 9.2, 9.3, 9.4, 9.5, 9.6, 9.7_

- [x] 10. Construir a camada de UI mobile (vanilla JS + ES Modules)
- [x] 10.1 Shell, roteamento por hash e utilitários de UI (toast, bottom sheet, validação visual)
  - App shell responsivo (coluna única 320–767px, sem rolagem horizontal), appbar com voltar, FAB de ação primária.
  - Roteador por hash e injeção dos serviços (com `LocalStorageAdapter`).
  - _Requirements: 11.1, 11.2, 11.5_

- [x] 10.2 `ProfileView` (onboarding/edição) ligada ao `ProfileService`
  - Formulário com validação inline que preserva o que foi digitado; exige perfil antes do restante do app.
  - _Requirements: 1.1-1.6, 11.2_

- [x] 10.3 `TournamentListView` e `TournamentDetailView` (+ rodadas) ligadas aos serviços
  - Lista com id, descrição e data; detalhe com dados do torneio e lista de rodadas ordenada; adicionar/excluir rodada com confirmação; indicação de vazio.
  - _Requirements: 2.7, 2.8, 2.11, 2.12, 3.1, 3.4, 3.5, 3.8, 3.9, 3.10_

- [x] 10.4 `TournamentFormView` (criar/editar/excluir) com validação
  - Campos descrição, data, número de sancionamento, id do organizador; validação conforme serviço; confirmação de exclusão.
  - _Requirements: 2.1, 2.3, 2.4, 2.5, 2.6, 2.9, 2.10, 2.11, 2.12_

- [x] 10.5 `RoundDetailView` e `PenaltyFormView` (seletores, recomendação, escalonamento, confirmação)
  - Categoria/severidade/penalidade como `<select>` de valores predefinidos (sem texto livre); severidades filtradas pela categoria; prefill da recomendada (editável).
  - Exibir sugestão de escalonamento quando `escalated` e permitir aceitar/manter; exigir papel confirmador quando penalidade > Warning.
  - Listar/remover penalidades da rodada; validação inline preservando entradas.
  - _Requirements: 4.1, 4.5, 4.7, 4.8, 4.9, 6.2, 6.7, 7.1, 7.2, 7.3, 7.4, 11.3, 11.4_

- [x] 10.6 `ReportShareView` ligada a `ReportService` e `ShareService`
  - Pré-visualização do resumo; aviso quando não há reportáveis; botões WhatsApp/Telegram/e-mail; download de CSV; mensagens de indisponibilidade.
  - _Requirements: 8.8, 9.1, 9.6, 9.7_

- [x] 11. Integrar PWA e artefatos estáticos
  - `index.html`, `manifest.webmanifest`, ícone; `theme-color`; viewport mobile; garantir operação offline da lógica (sem dependência de rede nas views de dados).
  - _Requirements: 10.4, 10.7, 11.1_

- [x] 12. Limpeza e verificação final
  - Remover arquivos iniciais que não se encaixam na nova arquitetura (`js/*`, `css/*`, artefatos antigos) após migração.
  - Rodar `npm run test:run` (todas as propriedades com `numRuns ≥ 100`) e `npm run build`; corrigir falhas.
  - _Requirements: todos_
