class PatientValidationError extends Error {
  constructor(details) {
    super("Dados do paciente inválidos");
    this.name = "PatientValidationError";
    this.details = details;
  }
}

module.exports = PatientValidationError;
