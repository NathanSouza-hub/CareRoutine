const assert = require("node:assert/strict");
const { describe, it } = require("node:test");
const ValidationError = require("../src/errors/validation-error");
const createVitalsController = require("../src/controllers/vitals-controller");

function createResponse() {
  return {
    statusCode: null,
    body: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(body) {
      this.body = body;
      return this;
    },
  };
}

describe("vitals controller", () => {
  it("retorna 201 com o registro criado", async () => {
    const record = { id: "1" };
    const controller = createVitalsController({ create: async () => record });
    const response = createResponse();

    await controller.create({ body: {} }, response, assert.fail);

    assert.equal(response.statusCode, 201);
    assert.deepEqual(response.body, { data: record });
  });

  it("retorna 400 para erro de validação", async () => {
    const validationError = new ValidationError({ date: "Data inválida" });
    const controller = createVitalsController({
      create: async () => {
        throw validationError;
      },
    });
    const response = createResponse();

    await controller.create({ body: {} }, response, assert.fail);

    assert.equal(response.statusCode, 400);
    assert.deepEqual(response.body, {
      error: validationError.message,
      details: validationError.details,
    });
  });

  it("encaminha erros inesperados ao middleware", async () => {
    const unexpectedError = new Error("Falha no banco");
    const controller = createVitalsController({
      create: async () => {
        throw unexpectedError;
      },
    });
    const response = createResponse();
    let forwardedError;

    await controller.create({ body: {} }, response, (error) => {
      forwardedError = error;
    });

    assert.equal(forwardedError, unexpectedError);
    assert.equal(response.statusCode, null);
  });
});
