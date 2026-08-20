class EventNotFoundError extends Error {
  constructor(message = "Evento não encontrado") {
    super(message);
    this.name = "EventNotFoundError";
  }
}

module.exports = EventNotFoundError;
