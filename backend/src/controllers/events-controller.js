const EventNotFoundError = require("../errors/event-not-found-error");
const EventValidationError = require("../errors/event-validation-error");

function handle(error, response, next) {
  if (error instanceof EventValidationError) response.status(400).json({ error: error.message, details: error.details });
  else if (error instanceof EventNotFoundError) response.status(404).json({ error: error.message });
  else next(error);
}

function createEventsController(service) {
  const action = (callback) => async (request, response, next) => {
    try { await callback(request, response); } catch (error) { handle(error, response, next); }
  };
  return Object.freeze({
    getAll: action(async (request, response) => response.json({
      data: await service.getAll(request.query.patientId, request.userId, {
        start: request.query.start,
        end: request.query.end,
      }),
    })),
    create: action(async (request, response) => response.status(201).json({ data: await service.create(request.body, request.userId) })),
    update: action(async (request, response) => { await service.update(request.params.id, request.body, request.userId); response.status(204).send(); }),
    remove: action(async (request, response) => { await service.remove(request.params.id, request.userId); response.status(204).send(); }),
    getDaily: action(async (request, response) => response.json({ data: await service.getDaily(request.query.date, request.query.patientId, request.userId) })),
    getUpcoming: action(async (request, response) => response.json({
      data: await service.getUpcoming(request.query.patientId, request.userId, request.query.days || "3"),
    })),
    setStatus: action(async (request, response) => response.json({ data: await service.setStatus(request.params.id, request.body, request.userId) })),
  });
}

module.exports = createEventsController;
