# Pokémon Judge Penalty Tracker

Aplicação web mobile-first para juízes registrarem penalidades em torneios
Play! Pokémon e gerarem o *Tournament Penalty Summary* (CSV, §6.1) ao final do
evento. Funciona offline (dados em `localStorage`); a rede só é usada no
compartilhamento final (WhatsApp / Telegram / e-mail).

As regras de negócio derivam do *Play! Pokémon Penalty Guidelines* (§3, §4.4.2,
§5, §6.1) e do *Tournament Rules Handbook* (cap. 7).

## Scripts

```
npm install     # instala dependências
npm run dev      # servidor de desenvolvimento (Vite), acessível na rede local
npm run build    # build de produção em dist/
npm run preview  # pré-visualiza o build
npm test         # testes em watch (Vitest)
npm run test:run # executa a suíte uma vez (CI)
```

## Notas de ambiente (Windows)

Esta máquina tem uma particularidade na instalação do Node que pode fazer o
`npm install` deixar o toolchain incompleto:

1. **Postinstall do esbuild bloqueado.** O npm não executa automaticamente o
   `postinstall` do `esbuild` (allowlist de scripts). Sem ele, o binário nativo
   não é baixado e o Vite/Vitest falha. Rode manualmente após o install:

   ```powershell
   node node_modules/esbuild/install.js
   ```

2. **Node fora do PATH em processos filhos.** Se `node` não for reconhecido ao
   rodar scripts (ex.: o próprio postinstall do esbuild), garanta o diretório do
   Node no PATH da sessão antes de chamar o npm:

   ```powershell
   $env:Path = "C:\Program Files\nodejs;" + $env:Path
   ```

3. **Execution Policy do PowerShell.** Se `npm` (via `npm.ps1`) for bloqueado,
   use `npm.cmd` explicitamente.

Verificação rápida de que o toolchain está íntegro:

```powershell
node -e "console.log('esbuild', require('esbuild').version)"
npm run test:run
```

## Estrutura

```
index.html             # entrada do Vite
manifest.webmanifest   # PWA (instalável, standalone, retrato)
icon.svg               # ícone (Pokébola)
src/
  domain/     # regras puras (rules.js) — conjunto fechado, categorias, escalonamento
  storage/    # StorageAdapter (local/memory), estado-raiz versionado, erros
  services/   # serviços de aplicação (profile, tournament, round, penalty,
              #   report, share) + result/ids/validação
  ui/         # app shell, roteador e views mobile (vanilla JS + ES Modules)
test/         # Vitest + fast-check (testes de propriedade e por exemplo)
```

## PWA e operação offline

- A aplicação é **offline-first para os dados**: perfil, torneios, rodadas e
  penalidades vivem em `localStorage`; nenhuma leitura/escrita de dados depende
  de rede. É possível cadastrar e gerar o CSV totalmente offline.
- A rede só é usada no **passo final de compartilhamento** (Web Share API ou
  deep links `wa.me`/`t.me`/`mailto:`), e há sempre o fallback de **download do
  CSV**.
- O `manifest.webmanifest` torna a app instalável (standalone, retrato). Não há
  *service worker* de cache de assets: o escopo da spec cobre operação offline
  da lógica e dos dados, não o carregamento inicial sem rede. Adicionar um SW é
  uma evolução possível (ex.: `vite-plugin-pwa`) sem impacto na arquitetura.
