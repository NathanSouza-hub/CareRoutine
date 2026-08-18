const { Router } = require("express");

function createVitalsRouter(vitalsController) {
  const router = Router();

  router.get("/", vitalsController.getAll);
  router.post("/", vitalsController.create);
  router.put("/:id", vitalsController.update);
  router.delete("/:id", vitalsController.remove);

  return router;
}

module.exports = createVitalsRouter;
