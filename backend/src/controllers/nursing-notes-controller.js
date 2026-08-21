const NursingNoteNotFoundError = require("../errors/nursing-note-not-found-error");
const NursingNoteValidationError = require("../errors/nursing-note-validation-error");

function handle(error, response, next) {
  if (error instanceof NursingNoteValidationError) response.status(400).json({ error: error.message, details: error.details });
  else if (error instanceof NursingNoteNotFoundError) response.status(404).json({ error: error.message });
  else next(error);
}

function createNursingNotesController(service) {
  const action = (callback) => async (request, response, next) => {
    try { await callback(request, response); } catch (error) { handle(error, response, next); }
  };
  return Object.freeze({
    getAll: action(async (request, response) => response.json({
      data: await service.getAll(request.query.patientId, request.userId, {
        date: request.query.date,
        shift: request.query.shift,
      }),
    })),
    create: action(async (request, response) => response.status(201).json({ data: await service.create(request.body, request.userId) })),
    update: action(async (request, response) => { await service.update(request.params.id, request.body, request.userId); response.status(204).send(); }),
    remove: action(async (request, response) => { await service.remove(request.params.id, request.userId); response.status(204).send(); }),
  });
}

module.exports = createNursingNotesController;
