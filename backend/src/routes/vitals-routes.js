const { Router } = require("express");

function createVitalsRouter(vitalsController) {
  const router = Router();

  router.post("/", vitalsController.create);

  return router;
}

module.exports = createVitalsRouter;
