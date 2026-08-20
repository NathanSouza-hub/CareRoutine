const { Router } = require("express");
const authRateLimit = require("../middleware/auth-rate-limit");

function createAuthRouter(controller, requireAuth) {
  const router = Router();
  router.post("/signup", authRateLimit, controller.signUp);
  router.post("/login", authRateLimit, controller.logIn);
  router.get("/profile", requireAuth, controller.getProfile);
  router.put("/profile", requireAuth, controller.updateProfile);
  router.put("/profile/password", requireAuth, controller.changePassword);
  router.put("/profile/avatar", requireAuth, controller.updateAvatar);
  return router;
}

module.exports = createAuthRouter;
