const assert = require("node:assert/strict");
const { before, describe, it } = require("node:test");
const AuthValidationError = require("../src/errors/auth-validation-error");
const AuthenticationError = require("../src/errors/auth-authentication-error");
const createAuthService = require("../src/services/auth-service");

before(() => {
  process.env.JWT_SECRET = "test-secret";
});

function createFakeRepository() {
  const users = [];
  let nextId = 1;
  return {
    async findByEmail(email) {
      return users.find((user) => user.email.toLowerCase() === email.toLowerCase()) ?? null;
    },
    async create(user) {
      const created = { id: String(nextId++), ...user };
      users.push(created);
      return { id: created.id, name: created.name, email: created.email };
    },
  };
}

describe("auth service", () => {
  it("cadastra um usuário e emite um token", async () => {
    const service = createAuthService(createFakeRepository());
    const result = await service.signUp({ name: "Ana", email: "ana@example.com", password: "senha1234" });
    assert.equal(result.user.name, "Ana");
    assert.equal(result.user.email, "ana@example.com");
    assert.equal(typeof result.token, "string");
    assert.equal(service.verifyToken(result.token).userId, result.user.id);
  });

  it("rejeita senha curta", async () => {
    const service = createAuthService(createFakeRepository());
    await assert.rejects(
      service.signUp({ name: "Ana", email: "ana@example.com", password: "123" }),
      AuthValidationError,
    );
  });

  it("rejeita e-mail já cadastrado", async () => {
    const repository = createFakeRepository();
    const service = createAuthService(repository);
    await service.signUp({ name: "Ana", email: "ana@example.com", password: "senha1234" });
    await assert.rejects(
      service.signUp({ name: "Outra", email: "ana@example.com", password: "outrasenha" }),
      AuthValidationError,
    );
  });

  it("faz login com credenciais válidas", async () => {
    const repository = createFakeRepository();
    const service = createAuthService(repository);
    await service.signUp({ name: "Ana", email: "ana@example.com", password: "senha1234" });
    const result = await service.logIn({ email: "ana@example.com", password: "senha1234" });
    assert.equal(result.user.email, "ana@example.com");
    assert.equal(typeof result.token, "string");
  });

  it("rejeita login com senha incorreta", async () => {
    const repository = createFakeRepository();
    const service = createAuthService(repository);
    await service.signUp({ name: "Ana", email: "ana@example.com", password: "senha1234" });
    await assert.rejects(
      service.logIn({ email: "ana@example.com", password: "errada123" }),
      AuthenticationError,
    );
  });

  it("rejeita login com e-mail inexistente", async () => {
    const service = createAuthService(createFakeRepository());
    await assert.rejects(
      service.logIn({ email: "ninguem@example.com", password: "senha1234" }),
      AuthenticationError,
    );
  });

  it("rejeita token inválido", async () => {
    const service = createAuthService(createFakeRepository());
    assert.throws(() => service.verifyToken("token-invalido"), AuthenticationError);
  });
});
