class NursingNoteValidationError extends Error {
  constructor(details) {
    super("Dados da anotação inválidos");
    this.name = "NursingNoteValidationError";
    this.details = details;
  }
}

module.exports = NursingNoteValidationError;
