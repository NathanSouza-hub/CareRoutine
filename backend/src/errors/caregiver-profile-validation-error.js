class CaregiverProfileValidationError extends Error {
  constructor(details) {
    super("Dados do cuidador inválidos");
    this.name = "CaregiverProfileValidationError";
    this.details = details;
  }
}

module.exports = CaregiverProfileValidationError;
