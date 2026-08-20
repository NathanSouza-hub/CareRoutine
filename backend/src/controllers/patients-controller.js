const PatientNotFoundError = require("../errors/patient-not-found-error");
const PatientValidationError = require("../errors/patient-validation-error");

function handle(error, response, next) {
  if (error instanceof PatientValidationError) response.status(400).json({ error: error.message, details: error.details });
  else if (error instanceof PatientNotFoundError) response.status(404).json({ error: error.message });
  else next(error);
}

function createPatientsController(service) {
  const action = (callback) => async (request, response, next) => {
    try { await callback(request, response); } catch (error) { handle(error, response, next); }
  };
  return Object.freeze({
    getAll: action(async (request, response) => response.json({ data: await service.getAll() })),
    getById: action(async (request, response) => response.json({ data: await service.getById(request.params.id) })),
    create: action(async (request, response) => response.status(201).json({ data: await service.create(request.body) })),
    update: action(async (request, response) => { await service.update(request.params.id, request.body); response.status(204).send(); }),
    remove: action(async (request, response) => { await service.remove(request.params.id); response.status(204).send(); }),
  });
}

module.exports = createPatientsController;
