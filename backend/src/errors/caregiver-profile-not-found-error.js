class CaregiverProfileNotFoundError extends Error {
  constructor(message = "Cuidador não encontrado") {
    super(message);
    this.name = "CaregiverProfileNotFoundError";
  }
}

module.exports = CaregiverProfileNotFoundError;
