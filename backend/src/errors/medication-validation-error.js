class MedicationValidationError extends Error {
  constructor(details) {
    super("Dados do medicamento inválidos");
    this.name = "MedicationValidationError";
    this.details = details;
  }
}

module.exports = MedicationValidationError;
