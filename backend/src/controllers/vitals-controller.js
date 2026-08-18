const ValidationError = require("../errors/validation-error");

function createVitalsController(vitalsService) {
  async function create(request, response, next) {
    try {
      const vitalSigns = await vitalsService.create(request.body);
      response.status(201).json({ data: vitalSigns });
    } catch (error) {
      if (error instanceof ValidationError) {
        response.status(400).json({
          error: error.message,
          details: error.details,
        });
        return;
      }

      next(error);
    }
  }

  return Object.freeze({ create });
}

module.exports = createVitalsController;
