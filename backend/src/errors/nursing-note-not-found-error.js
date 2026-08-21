class NursingNoteNotFoundError extends Error {
  constructor(message = "Anotação não encontrada") {
    super(message);
    this.name = "NursingNoteNotFoundError";
  }
}

module.exports = NursingNoteNotFoundError;
