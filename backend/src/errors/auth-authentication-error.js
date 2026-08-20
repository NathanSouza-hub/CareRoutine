class AuthenticationError extends Error {
  constructor(message = "Credenciais inválidas") {
    super(message);
    this.name = "AuthenticationError";
  }
}

module.exports = AuthenticationError;
