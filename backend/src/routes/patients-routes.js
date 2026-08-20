const { Router } = require("express");

function createPatientsRouter(controller) {
  const router = Router();
  router.get("/", controller.getAll);
  router.get("/:id", controller.getById);
  router.post("/", controller.create);
  router.put("/:id", controller.update);
  router.delete("/:id", controller.remove);
  return router;
}

module.exports = createPatientsRouter;
