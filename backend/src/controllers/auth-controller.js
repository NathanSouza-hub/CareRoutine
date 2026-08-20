const AuthValidationError = require("../errors/auth-validation-error");
const AuthenticationError = require("../errors/auth-authentication-error");

function handle(error, response, next) {
  if (error instanceof AuthValidationError) response.status(400).json({ error: error.message, details: error.details });
  else if (error instanceof AuthenticationError) response.status(401).json({ error: error.message });
  else next(error);
}

function createAuthController(service) {
  const action = (callback) => async (request, response, next) => {
    try { await callback(request, response); } catch (error) { handle(error, response, next); }
  };
  return Object.freeze({
    signUp: action(async (request, response) => response.status(201).json({ data: await service.signUp(request.body) })),
    logIn: action(async (request, response) => response.json({ data: await service.logIn(request.body) })),
  });
}

module.exports = createAuthController;
