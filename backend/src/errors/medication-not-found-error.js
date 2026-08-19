class MedicationNotFoundError extends Error {
  constructor(message = "Medicamento não encontrado") {
    super(message);
    this.name = "MedicationNotFoundError";
  }
}

module.exports = MedicationNotFoundError;
