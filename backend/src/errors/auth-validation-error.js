class AuthValidationError extends Error {
  constructor(details) {
    super("Dados de cadastro inválidos");
    this.name = "AuthValidationError";
    this.details = details;
  }
}

module.exports = AuthValidationError;
