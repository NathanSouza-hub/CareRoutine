class NotFoundError extends Error {
  constructor() {
    super("Registro de sinais vitais não encontrado");
    this.name = "NotFoundError";
  }
}

module.exports = NotFoundError;
