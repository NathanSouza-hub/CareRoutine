class EventValidationError extends Error {
  constructor(details) {
    super("Dados do evento inválidos");
    this.name = "EventValidationError";
    this.details = details;
  }
}

module.exports = EventValidationError;
