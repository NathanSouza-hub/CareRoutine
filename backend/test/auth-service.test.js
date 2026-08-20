const assert = require("node:assert/strict");
const bcrypt = require("bcryptjs");
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
      const created = { id: String(nextId++), phone: null, avatarData: null, ...user };
      users.push(created);
      return { id: created.id, name: created.name, email: created.email, phone: created.phone, avatarData: created.avatarData };
    },
    async getById(id) {
      const user = users.find((entry) => entry.id === String(id));
      if (!user) return null;
      return { id: user.id, name: user.name, email: user.email, phone: user.phone, avatarData: user.avatarData };
    },
    async getPasswordHash(id) {
      const user = users.find((entry) => entry.id === String(id));
      return user ? { passwordHash: user.passwordHash } : null;
    },
    async updateProfile(id, profile) {
      const user = users.find((entry) => entry.id === String(id));
      Object.assign(user, profile);
      return { id: user.id, name: user.name, email: user.email, phone: user.phone, avatarData: user.avatarData };
    },
    async updatePassword(id, passwordHash) {
      const user = users.find((entry) => entry.id === String(id));
      user.passwordHash = passwordHash;
    },
    async updateAvatar(id, avatarData) {
      const user = users.find((entry) => entry.id === String(id));
      user.avatarData = avatarData;
      return { id: user.id, name: user.name, email: user.email, phone: user.phone, avatarData: user.avatarData };
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

  it("atualiza nome, e-mail e telefone do perfil", async () => {
    const repository = createFakeRepository();
    const service = createAuthService(repository);
    const { user } = await service.signUp({ name: "Ana", email: "ana@example.com", password: "senha1234" });
    const updated = await service.updateProfile(user.id, { name: "Ana Souza", email: "ana@example.com", phone: "11999998888" });
    assert.equal(updated.name, "Ana Souza");
    assert.equal(updated.phone, "11999998888");
  });

  it("mantém campos não enviados ao atualizar apenas o telefone", async () => {
    const repository = createFakeRepository();
    const service = createAuthService(repository);
    const { user } = await service.signUp({ name: "Ana", email: "ana@example.com", password: "senha1234" });
    const updated = await service.updateProfile(user.id, { phone: "11999998888" });
    assert.equal(updated.name, "Ana");
    assert.equal(updated.email, "ana@example.com");
    assert.equal(updated.phone, "11999998888");
  });

  it("rejeita e-mail de perfil já usado por outro usuário", async () => {
    const repository = createFakeRepository();
    const service = createAuthService(repository);
    await service.signUp({ name: "Ana", email: "ana@example.com", password: "senha1234" });
    const { user } = await service.signUp({ name: "Bia", email: "bia@example.com", password: "senha1234" });
    await assert.rejects(service.updateProfile(user.id, { email: "ana@example.com" }), AuthValidationError);
  });

  it("troca a senha quando a senha atual está correta", async () => {
    const repository = createFakeRepository();
    const service = createAuthService(repository);
    const { user } = await service.signUp({ name: "Ana", email: "ana@example.com", password: "senha1234" });
    await service.changePassword(user.id, { currentPassword: "senha1234", newPassword: "novasenha123" });
    const stored = await repository.getPasswordHash(user.id);
    assert.ok(await bcrypt.compare("novasenha123", stored.passwordHash));
  });

  it("rejeita troca de senha com senha atual incorreta", async () => {
    const repository = createFakeRepository();
    const service = createAuthService(repository);
    const { user } = await service.signUp({ name: "Ana", email: "ana@example.com", password: "senha1234" });
    await assert.rejects(
      service.changePassword(user.id, { currentPassword: "errada123", newPassword: "novasenha123" }),
      AuthenticationError,
    );
  });

  it("atualiza a foto de perfil com uma imagem válida", async () => {
    const repository = createFakeRepository();
    const service = createAuthService(repository);
    const { user } = await service.signUp({ name: "Ana", email: "ana@example.com", password: "senha1234" });
    const avatarData = "data:image/png;base64,aGVsbG8=";
    const updated = await service.updateAvatar(user.id, avatarData);
    assert.equal(updated.avatarData, avatarData);
  });

  it("remove a foto de perfil quando enviado null", async () => {
    const repository = createFakeRepository();
    const service = createAuthService(repository);
    const { user } = await service.signUp({ name: "Ana", email: "ana@example.com", password: "senha1234" });
    await service.updateAvatar(user.id, "data:image/png;base64,aGVsbG8=");
    const updated = await service.updateAvatar(user.id, null);
    assert.equal(updated.avatarData, null);
  });

  it("rejeita foto de perfil em formato inválido", async () => {
    const repository = createFakeRepository();
    const service = createAuthService(repository);
    const { user } = await service.signUp({ name: "Ana", email: "ana@example.com", password: "senha1234" });
    await assert.rejects(service.updateAvatar(user.id, "nao-e-uma-imagem"), AuthValidationError);
  });
});
