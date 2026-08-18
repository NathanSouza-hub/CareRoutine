class ValidationError extends Error {
  constructor(details) {
    super("Dados de sinais vitais inválidos");
    this.name = "ValidationError";
    this.details = details;
  }
}

module.exports = ValidationError;
