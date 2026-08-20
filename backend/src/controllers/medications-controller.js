const MedicationNotFoundError = require("../errors/medication-not-found-error");
const MedicationValidationError = require("../errors/medication-validation-error");

function handle(error, response, next) {
  if (error instanceof MedicationValidationError) {
    response.status(400).json({ error: error.message, details: error.details });
  } else if (error instanceof MedicationNotFoundError) {
    response.status(404).json({ error: error.message });
  } else {
    next(error);
  }
}

function createMedicationsController(service) {
  const action = (callback) => async (request, response, next) => {
    try { await callback(request, response); } catch (error) { handle(error, response, next); }
  };

  return Object.freeze({
    getAll: action(async (request, response) => response.json({ data: await service.getAll(request.query.patientId, request.userId) })),
    create: action(async (request, response) => response.status(201).json({ data: await service.create(request.body, request.userId) })),
    update: action(async (request, response) => {
      await service.update(request.params.id, request.body, request.userId);
      response.status(204).send();
    }),
    remove: action(async (request, response) => {
      await service.remove(request.params.id, request.userId);
      response.status(204).send();
    }),
    getDaily: action(async (request, response) => response.json({ data: await service.getDaily(request.query.date, request.query.patientId, request.userId) })),
    setAdministration: action(async (request, response) => response.json({
      data: await service.setAdministration(
        request.params.id,
        request.params.scheduleId,
        request.body,
        request.userId,
      ),
    })),
  });
}

module.exports = createMedicationsController;
