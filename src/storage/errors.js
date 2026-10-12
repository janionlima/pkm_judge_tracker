/*
 * Erros normalizados da camada de persistência (design: Error Handling).
 * As camadas superiores reagem a esses tipos sem conhecer o mecanismo concreto
 * de armazenamento.
 */

/* Falha genérica de escrita no armazenamento (Req 10.2). */
export class StorageWriteError extends Error {
  constructor(message = "Falha ao gravar no armazenamento local.", options) {
    super(message, options);
    this.name = "StorageWriteError";
  }
}

/* Armazenamento sem espaço disponível (Req 10.3). */
export class StorageQuotaError extends Error {
  constructor(message = "Sem espaço no armazenamento local.", options) {
    super(message, options);
    this.name = "StorageQuotaError";
  }
}

/*
 * Conteúdo existente não pôde ser interpretado (JSON inválido ou esquema
 * incompatível). Carrega o estado bruto para eventual recuperação (Req 10.6).
 */
export class StorageCorruptedError extends Error {
  constructor(message = "Dados do armazenamento local corrompidos.", options) {
    super(message, options);
    this.name = "StorageCorruptedError";
  }
}
