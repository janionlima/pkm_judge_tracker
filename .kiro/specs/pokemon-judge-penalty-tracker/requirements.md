# Requirements Document

## Introduction

O **Pokémon Judge Penalty Tracker** é uma aplicação web client-side, otimizada para dispositivos móveis, destinada a juízes de torneios oficiais Pokémon (Organized Play). A aplicação é utilizada ao longo de todo o torneio para registrar penalidades aplicadas a cada rodada e, ao final do evento, permite gerar e compartilhar um relatório (Tournament Penalty Summary) por canais sociais como WhatsApp, Telegram ou e-mail.

A aplicação encapsula as regras de negócio do *Play! Pokémon Penalty Guidelines* (§3, §4, §5, §6) e do *Tournament Rules Handbook* (cap. 7), incluindo o conjunto fechado de penalidades, as penalidades iniciais recomendadas por categoria e severidade, e o escalonamento por reincidência. Como a aplicação é usada durante eventos ao vivo — potencialmente sem conexão de rede estável — a persistência dos dados ocorre localmente no dispositivo, garantindo que o juiz possa registrar penalidades do início ao fim do torneio e gerar o relatório mesmo offline.

## Glossary

- **Juiz (Judge)**: Usuário da aplicação, responsável por registrar penalidades durante o torneio.
- **Judge ID**: Identificador oficial do juiz no Organized Play (Player ID do juiz). Usado como "Judge Player ID" no relatório.
- **Player ID**: Identificador oficial de um jogador/competidor no Organized Play. Identifica o jogador infrator e o organizador.
- **Torneio (Tournament)**: Evento competitivo cadastrado na aplicação, composto por rodadas e penalidades.
- **ID de Cadastro (Record ID)**: Identificador único de registro do torneio na base local da aplicação, gerado automaticamente. É uso interno (chave da tabela) e **não** aparece no relatório.
- **Número de Sancionamento (Sanctioning Number)**: Identificador oficial do torneio junto à Play! Pokémon, informado pelo juiz no formato `XX-XX-XXXXXX`. É este o valor usado como **Tournament ID** no relatório.
- **Tournament ID**: Rótulo do Número de Sancionamento quando usado no relatório (coluna `Tournament ID` e assunto do envio). Equivale ao Número de Sancionamento, não ao ID de Cadastro.
- **Organizador (Organizer)**: Entidade responsável pela realização do torneio, identificada pelo seu Player ID (id do organizador).
- **Rodada (Round)**: Unidade de divisão do torneio à qual as penalidades estão associadas. Pertence a exatamente um torneio.
- **Penalidade (Penalty)**: Registro de uma sanção aplicada a um jogador em uma rodada, pertencente ao conjunto fechado de penalidades.
- **Conjunto Fechado de Penalidades**: Lista ordenada por severidade crescente — Caution, Warning, Double Prize Loss, Quadruple Prize Loss, Game Loss, Match Loss, Disqualification.
- **Base Infraction (Categoria de Infração)**: Classificação da infração conforme §5 (ex.: Procedural Error, Tardiness, Cheating).
- **Severidade (Severity)**: Nível da infração — Minor, Major ou Severe. Nem toda categoria admite todos os níveis.
- **Penalidade Inicial Recomendada (Recommended Starting Penalty)**: Penalidade sugerida por padrão para uma combinação (categoria, severidade), conforme §5.
- **Game State (Estado de Jogo)**: Situação atual da partida (cartas, prêmios, posições) relevante na análise de Gameplay Errors.
- **Escalonamento por Reincidência (Recurrence Escalation)**: Elevação da penalidade recomendada por existência de penalidade anterior da mesma categoria para o mesmo jogador no torneio (§4.4.2).
- **Reincidência (Recurrence)**: Ocorrência de nova penalidade da mesma categoria aplicada ao mesmo jogador, dentro do mesmo torneio.
- **Reportável (Reportable)**: Propriedade de uma penalidade que indica se ela deve constar no relatório. Caution não é reportável; Warning e penalidades superiores são reportáveis.
- **Tournament Penalty Summary (Resumo de Penalidades do Torneio)**: Relatório em formato CSV, conforme §6.1, contendo uma linha por penalidade reportável emitida.
- **Head Judge / Assistant Head Judge**: Juiz principal ou assistente que confirma penalidades superiores a Warning (cap. 7 do Handbook).
- **Aplicação / Sistema (System)**: O Pokémon Judge Penalty Tracker.

## Requirements

### Requisito 1: Gerenciamento do Perfil do Juiz

**User Story:** Como juiz, quero cadastrar e manter meu perfil, para que minhas informações identifiquem corretamente os relatórios que gero.

#### Acceptance Criteria

1. WHEN o Juiz confirma o cadastro do perfil com primeiro nome, sobrenome, Judge ID e data de nascimento preenchidos, THE Sistema SHALL registrar os quatro campos no armazenamento local do dispositivo.
2. IF o Juiz tenta salvar o perfil com primeiro nome, sobrenome, Judge ID ou data de nascimento ausente ou contendo apenas espaços em branco, THEN THE Sistema SHALL rejeitar o salvamento, preservar os dados já informados e exibir uma mensagem indicando qual campo está faltante.
3. IF o Juiz informa uma data de nascimento posterior à data atual do dispositivo, THEN THE Sistema SHALL rejeitar o salvamento, preservar os dados informados e exibir uma mensagem indicando data de nascimento inválida.
4. IF o Juiz informa primeiro nome ou sobrenome com mais de 50 caracteres, ou Judge ID com mais de 20 caracteres, THEN THE Sistema SHALL rejeitar o salvamento, preservar os dados informados e exibir uma mensagem indicando o campo que excedeu o limite de caracteres.
5. WHEN o Juiz edita e confirma a alteração de um perfil previamente salvo, THE Sistema SHALL substituir os dados anteriores pelos novos valores no armazenamento local do dispositivo.
6. WHEN o Juiz acessa a aplicação e existe um perfil salvo no armazenamento local do dispositivo, THE Sistema SHALL carregar o primeiro nome, sobrenome, Judge ID e data de nascimento do perfil e exibi-los nos campos correspondentes.
7. WHEN o Sistema gera um relatório, THE Sistema SHALL preencher o campo "Judge Player ID" do relatório com o valor do Judge ID do perfil salvo.

### Requisito 2: Gerenciamento de Torneios (CRUD)

**User Story:** Como juiz, quero criar e gerenciar torneios, para que eu possa organizar as penalidades por evento.

#### Acceptance Criteria

1. WHEN o Juiz cria um torneio informando descrição, data de realização, número de sancionamento e id do organizador, THE Sistema SHALL registrar o torneio com um ID de cadastro único gerado automaticamente para uso interno.
2. THE Sistema SHALL exigir que o número de sancionamento siga o formato `XX-XX-XXXXXX`, onde cada `X` é um caractere alfanumérico (regex `^[A-Za-z0-9]{2}-[A-Za-z0-9]{2}-[A-Za-z0-9]{6}$`), e SHALL rejeitar a criação com mensagem específica quando o valor informado não casar com esse formato.
3. THE Sistema SHALL limitar a descrição do torneio a um mínimo de 1 e um máximo de 200 caracteres.
4. THE Sistema SHALL gerar o ID de cadastro como identificador opaco de uso interno, sem exigência de formato específico, e SHALL NOT exibi-lo no relatório.
5. IF o Juiz tenta criar um torneio com a descrição, a data de realização, o número de sancionamento ou o id do organizador ausente ou vazio, THEN THE Sistema SHALL rejeitar a criação, preservar os dados já informados e exibir uma mensagem indicando qual campo está faltando.
6. IF o Juiz informa uma data de realização em formato inválido ou inexistente, THEN THE Sistema SHALL rejeitar a criação e exibir uma mensagem indicando que a data de realização é inválida.
7. THE Sistema SHALL exibir a lista de torneios cadastrados, apresentando ao menos o número de sancionamento, a descrição e a data de realização de cada torneio.
8. WHEN o Juiz seleciona um torneio da lista, THE Sistema SHALL exibir os detalhes do torneio e suas rodadas em até 2 segundos.
9. THE Sistema SHALL permitir que o Juiz edite a descrição, a data de realização, o número de sancionamento e o id do organizador de um torneio existente, aplicando as mesmas regras de validação da criação.
10. WHEN o Juiz confirma a edição de um torneio existente, THE Sistema SHALL persistir as alterações e manter inalterado o ID de cadastro.
11. WHEN o Juiz solicita a exclusão de um torneio, THE Sistema SHALL solicitar confirmação explícita antes de remover o torneio e todas as rodadas e penalidades associadas.
12. IF o Juiz cancela a confirmação de exclusão, THEN THE Sistema SHALL preservar o torneio e todas as rodadas e penalidades associadas sem nenhuma alteração.
13. THE Sistema SHALL garantir que o ID de cadastro de cada torneio seja distinto dos IDs de cadastro dos demais torneios armazenados no dispositivo.
14. IF o Juiz tenta criar um torneio cujo ID de cadastro gerado já existe no dispositivo, THEN THE Sistema SHALL gerar um novo ID de cadastro até que seja distinto dos demais antes de concluir o registro.

### Requisito 3: Gerenciamento de Rodadas

**User Story:** Como juiz, quero adicionar rodadas a um torneio, para que eu possa associar cada penalidade à rodada em que foi aplicada.

#### Acceptance Criteria

1. WHEN o Juiz acessa um torneio, THE Sistema SHALL exibir a opção de adicionar uma rodada a esse torneio.
2. WHEN o Juiz adiciona uma rodada a um torneio sem rodadas existentes, THE Sistema SHALL associar a rodada ao torneio acessado e atribuir a ela o número sequencial 1.
3. WHEN o Juiz adiciona uma rodada a um torneio que já possui rodadas, THE Sistema SHALL associar a rodada ao torneio acessado e atribuir a ela um número sequencial igual ao maior número de rodada existente nesse torneio acrescido de 1.
4. WHEN o Juiz acessa um torneio, THE Sistema SHALL exibir a lista de rodadas pertencentes a esse torneio ordenada de forma crescente pelo número sequencial da rodada.
5. IF o torneio acessado não possui rodadas, THEN THE Sistema SHALL exibir uma indicação de que não há rodadas cadastradas.
6. WHEN o Juiz seleciona uma rodada, THE Sistema SHALL exibir as penalidades registradas nessa rodada.
7. IF a rodada selecionada não possui penalidades registradas, THEN THE Sistema SHALL exibir uma indicação de que não há penalidades registradas nessa rodada.
8. WHEN o Juiz solicita a exclusão de uma rodada, THE Sistema SHALL solicitar confirmação explícita antes de remover a rodada.
9. WHEN o Juiz confirma a exclusão de uma rodada, THE Sistema SHALL remover a rodada e todas as penalidades associadas a ela.
10. IF o Juiz cancela a confirmação de exclusão de uma rodada, THEN THE Sistema SHALL preservar a rodada e todas as penalidades associadas a ela.

### Requisito 4: Registro de Penalidades

**User Story:** Como juiz, quero registrar uma penalidade em uma rodada, para que a infração do jogador fique documentada.

#### Acceptance Criteria

1. WHEN o Juiz salva uma penalidade válida em uma rodada, THE Sistema SHALL persistir a categoria da penalidade, o Player ID do jogador infrator, a penalidade aplicada, a descrição da situação e a severidade.
2. THE Sistema SHALL restringir o campo de penalidade aplicada ao conjunto fechado de 7 valores: Caution, Warning, Double Prize Loss, Quadruple Prize Loss, Game Loss, Match Loss, Disqualification.
3. THE Sistema SHALL restringir o campo de categoria ao conjunto fechado de categorias definidas em §5: Procedural Error, Tardiness, Unsporting Conduct, Cheating, Gameplay Error (TCG), Gameplay Error (VG), Gameplay Error (GO), Legality Check — TCG Deck, Legality Check — VG Team, Legality Check — GO Team, Pace of Play.
4. THE Sistema SHALL restringir o campo de severidade ao conjunto fechado de 3 valores: Minor, Major ou Severe.
5. WHEN o Juiz seleciona uma categoria, THE Sistema SHALL exibir como selecionáveis apenas os níveis de severidade válidos para essa categoria conforme §5, oferecendo somente Minor e Severe para as categorias Gameplay Error (VG), Gameplay Error (GO) e Pace of Play.
6. THE Sistema SHALL exigir que o campo de descrição da situação contenha entre 1 e 1000 caracteres.
7. IF o Juiz tenta salvar uma penalidade na qual qualquer um dos campos categoria, Player ID do jogador infrator, penalidade aplicada, descrição da situação ou severidade esteja ausente ou vazio, THEN THE Sistema SHALL rejeitar o salvamento, preservar os valores já informados sem persistir o registro e exibir uma mensagem indicando o campo faltante.
8. IF o Juiz tenta salvar uma combinação de categoria e severidade não prevista em §5, THEN THE Sistema SHALL rejeitar o salvamento, preservar os valores já informados sem persistir o registro e exibir uma mensagem indicando que a combinação de categoria e severidade é inválida.
9. WHEN o Juiz seleciona uma combinação de categoria e severidade válida conforme §5, THE Sistema SHALL preencher o campo de penalidade aplicada com a penalidade inicial recomendada correspondente, mantendo esse campo editável para seleção de outro valor do conjunto fechado.

### Requisito 5: Penalidade Inicial Recomendada por Categoria e Severidade

**User Story:** Como juiz, quero que o sistema sugira a penalidade inicial correta para cada infração, para que eu aplique as sanções de forma consistente com as diretrizes.

#### Acceptance Criteria

1. WHERE a categoria é Procedural Error, THE Sistema SHALL recomendar Caution para Minor, Warning para Major e Game Loss para Severe.
2. WHERE a categoria é Tardiness, THE Sistema SHALL recomendar Warning para Minor, Game Loss para Major e Match Loss para Severe.
3. WHERE a categoria é Unsporting Conduct, THE Sistema SHALL recomendar Warning para Minor, Match Loss para Major e Disqualification para Severe.
4. WHERE a categoria é Cheating, THE Sistema SHALL recomendar Disqualification para toda severidade.
5. WHERE a categoria é Gameplay Error (TCG), THE Sistema SHALL recomendar Warning para Minor, Double Prize Loss para Major e Game Loss para Severe.
6. WHERE a categoria é Gameplay Error (VG), THE Sistema SHALL oferecer apenas Minor e Severe, recomendando Warning para Minor e Game Loss para Severe.
7. WHERE a categoria é Gameplay Error (GO), THE Sistema SHALL oferecer apenas Minor e Severe, recomendando Warning para Minor e Game Loss para Severe.
8. WHERE a categoria é Legality Check — TCG Deck, THE Sistema SHALL recomendar Warning para Minor, Game Loss para Major e Disqualification para Severe.
9. WHERE a categoria é Legality Check — VG Team, THE Sistema SHALL recomendar Warning para Minor, Game Loss para Major e Disqualification para Severe.
10. WHERE a categoria é Legality Check — GO Team, THE Sistema SHALL recomendar Warning para Minor, Game Loss para Major e Disqualification para Severe.
11. WHERE a categoria é Pace of Play, THE Sistema SHALL oferecer apenas Minor e Severe, recomendando Warning para Minor e Double Prize Loss para Severe.

### Requisito 6: Detecção de Reincidência e Sugestão de Escalonamento

**User Story:** Como juiz, quero ser avisado quando um jogador reincidir na mesma categoria de infração, para que eu possa escalonar a penalidade conforme as diretrizes.

#### Acceptance Criteria

1. WHEN o Juiz aplica uma penalidade a um jogador, THE Sistema SHALL contar as penalidades anteriormente registradas que possuam a mesma categoria e o mesmo Player ID infrator dentro do mesmo torneio.
2. WHERE a categoria pertence ao conjunto que admite escalonamento (todas as categorias exceto Cheating) AND a contagem de penalidades anteriores da mesma categoria para o mesmo Player ID no mesmo torneio é maior ou igual a 1, THE Sistema SHALL exibir uma sugestão de escalonamento por reincidência ao Juiz.
3. WHEN o Sistema exibe uma sugestão de escalonamento, THE Sistema SHALL elevar a penalidade recomendada em exatamente um nível no conjunto fechado ordenado por severidade crescente (Caution, Warning, Double Prize Loss, Quadruple Prize Loss, Game Loss, Match Loss, Disqualification) para cada penalidade anterior da mesma categoria do mesmo Player ID no mesmo torneio.
4. IF o nível resultante do escalonamento ultrapassaria Disqualification, THEN THE Sistema SHALL limitar a penalidade recomendada a Disqualification.
5. WHERE a categoria é Cheating, THE Sistema SHALL manter Disqualification como penalidade recomendada sem aplicar escalonamento por reincidência, independentemente da contagem de penalidades anteriores.
6. IF a contagem de penalidades anteriores da mesma categoria para o mesmo Player ID no mesmo torneio é igual a 0, THEN THE Sistema SHALL manter a penalidade inicial recomendada e SHALL NOT exibir sugestão de escalonamento.
7. WHEN o Sistema exibe uma sugestão de escalonamento, THE Sistema SHALL permitir que o Juiz selecione aceitar a penalidade escalonada ou manter a penalidade inicial recomendada, aplicando a opção selecionada à penalidade final registrada.

### Requisito 7: Confirmação de Penalidades Superiores a Warning

**User Story:** Como juiz, quero registrar a confirmação de penalidades superiores a Warning, para que o processo reflita a supervisão do Head Judge conforme o Handbook.

#### Acceptance Criteria

1. WHERE a penalidade aplicada é uma das seguintes: Double Prize Loss, Quadruple Prize Loss, Game Loss, Match Loss ou Disqualification, THE Sistema SHALL exigir a indicação de confirmação por Head Judge ou Assistant Head Judge antes de concluir o registro da penalidade.
2. IF a penalidade aplicada é Double Prize Loss, Quadruple Prize Loss, Game Loss, Match Loss ou Disqualification AND a confirmação por Head Judge ou Assistant Head Judge não foi indicada, THEN THE Sistema SHALL rejeitar a conclusão do registro, preservar os dados já informados sem gravar a penalidade e exibir uma mensagem indicando que a confirmação por Head Judge ou Assistant Head Judge é obrigatória.
3. WHERE a penalidade aplicada é Caution ou Warning, THE Sistema SHALL concluir o registro sem exigir confirmação por Head Judge ou Assistant Head Judge.
4. WHEN uma penalidade superior a Warning é concluída com confirmação indicada, THE Sistema SHALL registrar o papel confirmador (Head Judge ou Assistant Head Judge) junto ao registro da penalidade.

### Requisito 8: Geração do Tournament Penalty Summary (CSV)

**User Story:** Como juiz, quero gerar o resumo de penalidades do torneio ao final do evento, para que eu possa reportá-lo conforme a §6.1.

#### Acceptance Criteria

1. WHEN o Juiz solicita a geração do relatório de um torneio, THE Sistema SHALL produzir um arquivo CSV cuja primeira linha contém exatamente os cabeçalhos, nesta ordem: `Tournament ID`, `Round of Issue`, `Judge Player ID`, `Competitor's Player ID`, `Category`, `Severity`, `Penalty`, `Notes`.
2. THE Sistema SHALL incluir no CSV exatamente uma linha para cada penalidade reportável emitida no torneio, considerando reportável toda penalidade registrada no torneio cujo tipo não seja Caution.
3. THE Sistema SHALL excluir do CSV todas as penalidades do tipo Caution, por não serem reportáveis conforme a §6.1.
4. WHEN o Sistema gera uma linha do CSV, THE Sistema SHALL preencher `Tournament ID` com o número de sancionamento do torneio, `Round of Issue` com o número inteiro da rodada em que a penalidade foi emitida, `Judge Player ID` com o Judge ID do perfil, `Competitor's Player ID` com o Player ID do jogador infrator, `Category` com a categoria, `Severity` com a severidade, `Penalty` com a penalidade aplicada e `Notes` com a descrição da situação, usando campo vazio quando não houver descrição.
5. WHEN o Sistema gera as linhas de dados do CSV, THE Sistema SHALL ordená-las de forma crescente pelo valor de `Round of Issue` e, para penalidades da mesma rodada, pela ordem cronológica de emissão.
6. WHEN um valor de campo contém vírgula, aspas duplas ou quebra de linha, THE Sistema SHALL escapá-lo envolvendo o valor em aspas duplas e duplicando cada aspa dupla interna, conforme as regras de formatação CSV.
7. WHEN o Sistema gera o relatório, THE Sistema SHALL definir o assunto do envio no formato `Penalty Report: XX-XX-XXXXXX`, onde `XX-XX-XXXXXX` é o Tournament ID.
8. IF o torneio não possui penalidades reportáveis, THEN THE Sistema SHALL gerar um CSV contendo apenas a linha de cabeçalhos e exibir ao Juiz uma mensagem indicando que não há penalidades reportáveis.

### Requisito 9: Compartilhamento Multicanal do Relatório

**User Story:** Como juiz, quero compartilhar o relatório por WhatsApp, Telegram ou e-mail, para que eu possa enviá-lo à organização ao final do torneio.

#### Acceptance Criteria

1. WHEN o Juiz solicita o compartilhamento do relatório, THE Sistema SHALL exibir as opções WhatsApp, Telegram e e-mail em até 1 segundo.
2. WHEN o Juiz seleciona WhatsApp, THE Sistema SHALL iniciar o compartilhamento do relatório pelo WhatsApp incluindo o conteúdo do relatório na mensagem.
3. WHEN o Juiz seleciona Telegram, THE Sistema SHALL iniciar o compartilhamento do relatório pelo Telegram incluindo o conteúdo do relatório na mensagem.
4. WHEN o Juiz seleciona e-mail, THE Sistema SHALL iniciar o compartilhamento do relatório por e-mail com o assunto no formato `Penalty Report: XX-XX-XXXXXX`.
5. IF o assunto do e-mail não puder ser preenchido no formato `Penalty Report: XX-XX-XXXXXX`, THEN THE Sistema SHALL exibir uma mensagem indicando a falha na geração do assunto e manter o relatório disponível para novo compartilhamento.
6. IF o canal de compartilhamento selecionado não está disponível no dispositivo, THEN THE Sistema SHALL exibir uma mensagem indicando a indisponibilidade do canal e oferecer o download do arquivo CSV como alternativa.
7. WHEN o Juiz confirma o download do arquivo CSV, THE Sistema SHALL disponibilizar o arquivo CSV contendo os dados do relatório em até 3 segundos.

### Requisito 10: Persistência Local e Operação Offline

**User Story:** Como juiz, quero que os dados fiquem salvos no dispositivo, para que eu possa registrar penalidades durante todo o evento, inclusive sem conexão, e gerar o relatório ao final.

#### Acceptance Criteria

1. WHEN o Juiz cria ou altera perfil, torneio, rodada ou penalidade, THE Sistema SHALL persistir a alteração no armazenamento local do dispositivo em até 2 segundos após a confirmação da ação.
2. IF a persistência no armazenamento local falha, THEN THE Sistema SHALL manter os dados exibidos na tela inalterados e apresentar uma mensagem de erro indicando que a alteração não foi salva.
3. IF o armazenamento local atinge o limite de capacidade disponível ao tentar persistir uma alteração, THEN THE Sistema SHALL rejeitar a gravação, preservar os dados já armazenados e apresentar uma mensagem de erro indicando falta de espaço.
4. WHILE o dispositivo está sem conexão de rede, THE Sistema SHALL permitir o cadastro de torneios, a adição de rodadas e o registro de penalidades, persistindo cada operação no armazenamento local.
5. WHEN o Juiz reabre a aplicação, THE Sistema SHALL restaurar perfil, torneios, rodadas e penalidades a partir do armazenamento local, refletindo o estado idêntico ao da última alteração persistida.
6. IF os dados do armazenamento local estão ausentes ou corrompidos na reabertura da aplicação, THEN THE Sistema SHALL iniciar com um estado vazio e apresentar uma mensagem indicando que os dados não puderam ser restaurados, sem sobrescrever os dados originais.
7. WHILE o dispositivo está sem conexão de rede, THE Sistema SHALL permitir a geração do arquivo CSV do Tournament Penalty Summary utilizando os dados do armazenamento local.

### Requisito 11: Usabilidade Móvel

**User Story:** Como juiz, quero uma interface adequada ao celular, para que eu possa registrar penalidades rapidamente enquanto circulo pelo evento.

#### Acceptance Criteria

1. WHILE exibido em telas com largura entre 320 e 767 pixels CSS, THE Sistema SHALL apresentar o layout em coluna única sem gerar rolagem horizontal.
2. THE Sistema SHALL apresentar todos os controles interativos com área de toque de no mínimo 44 por 44 pixels CSS.
3. WHEN o Juiz aciona os campos de categoria, severidade e penalidade, THE Sistema SHALL apresentar cada campo como um seletor de valores predefinidos, sem aceitar entrada de texto livre.
4. IF o Juiz tentar inserir um valor fora da lista predefinida nos campos de categoria, severidade ou penalidade, THEN THE Sistema SHALL rejeitar a entrada, preservar a seleção anterior do campo e exibir uma indicação de que apenas valores predefinidos são aceitos.
5. THE Sistema SHALL manter os controles de ação primária visíveis e acionáveis sem exigir rolagem horizontal em telas com largura a partir de 320 pixels CSS.
