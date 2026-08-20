class RoutineValidationError extends Error {
  constructor(details) {
    super("Dados da rotina inválidos");
    this.name = "RoutineValidationError";
    this.details = details;
  }
}

module.exports = RoutineValidationError;
