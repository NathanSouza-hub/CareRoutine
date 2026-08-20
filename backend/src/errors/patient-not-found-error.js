class PatientNotFoundError extends Error {
  constructor(message = "Paciente não encontrado") {
    super(message);
    this.name = "PatientNotFoundError";
  }
}

module.exports = PatientNotFoundError;
