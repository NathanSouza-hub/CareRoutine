class RoutineNotFoundError extends Error {
  constructor(message = "Rotina não encontrada") {
    super(message);
    this.name = "RoutineNotFoundError";
  }
}

module.exports = RoutineNotFoundError;
