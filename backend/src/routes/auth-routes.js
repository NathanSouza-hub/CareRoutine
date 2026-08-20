const { Router } = require("express");

function createAuthRouter(controller) {
  const router = Router();
  router.post("/signup", controller.signUp);
  router.post("/login", controller.logIn);
  return router;
}

module.exports = createAuthRouter;
