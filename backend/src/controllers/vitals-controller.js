const ValidationError = require("../errors/validation-error");
const NotFoundError = require("../errors/not-found-error");

function handleKnownError(error, response) {
  if (error instanceof ValidationError) {
    response.status(400).json({ error: error.message, details: error.details });
    return true;
  }

  if (error instanceof NotFoundError) {
    response.status(404).json({ error: error.message });
    return true;
  }

  return false;
}

function createVitalsController(vitalsService) {
  async function create(request, response, next) {
    try {
      const vitalSigns = await vitalsService.create(request.body);
      response.status(201).json({ data: vitalSigns });
    } catch (error) {
      if (!handleKnownError(error, response)) next(error);
    }
  }

  async function getAll(request, response, next) {
    try {
      const vitalSigns = await vitalsService.getAll();
      response.status(200).json({ data: vitalSigns });
    } catch (error) {
      next(error);
    }
  }

  async function update(request, response, next) {
    try {
      const vitalSigns = await vitalsService.update(request.params.id, request.body);
      response.status(200).json({ data: vitalSigns });
    } catch (error) {
      if (!handleKnownError(error, response)) next(error);
    }
  }

  async function remove(request, response, next) {
    try {
      await vitalsService.remove(request.params.id);
      response.status(204).send();
    } catch (error) {
      if (!handleKnownError(error, response)) next(error);
    }
  }

  return Object.freeze({ create, getAll, remove, update });
}

module.exports = createVitalsController;
