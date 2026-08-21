const assert = require("node:assert/strict");
const { describe, it } = require("node:test");
const CaregiverProfileNotFoundError = require("../src/errors/caregiver-profile-not-found-error");
const CaregiverProfileValidationError = require("../src/errors/caregiver-profile-validation-error");
const createCaregiverProfilesService = require("../src/services/caregiver-profiles-service");

function validProfile(overrides = {}) {
  return { name: "Maria", avatarColor: "#176B87", ...overrides };
}

describe("caregiver profiles service", () => {
  it("normaliza e cadastra um cuidador", async () => {
    let received;
    const service = createCaregiverProfilesService({
      async create(data) { received = data; return { id: "1", ...data }; },
    });
    const result = await service.create(validProfile(), "9");
    assert.equal(received.name, "Maria");
    assert.equal(received.userId, "9");
    assert.equal(result.id, "1");
  });

  it("rejeita nome vazio", async () => {
    const service = createCaregiverProfilesService({ create: async () => assert.fail() });
    await assert.rejects(
      service.create(validProfile({ name: "" }), "9"),
      CaregiverProfileValidationError,
    );
  });

  it("rejeita nome maior que 80 caracteres", async () => {
    const service = createCaregiverProfilesService({ create: async () => assert.fail() });
    await assert.rejects(
      service.create(validProfile({ name: "a".repeat(81) }), "9"),
      CaregiverProfileValidationError,
    );
  });

  it("rejeita cor de avatar vazia", async () => {
    const service = createCaregiverProfilesService({ create: async () => assert.fail() });
    await assert.rejects(
      service.create(validProfile({ avatarColor: "" }), "9"),
      CaregiverProfileValidationError,
    );
  });

  it("lista os cuidadores da conta", async () => {
    const profiles = [{ id: "1", name: "Maria" }];
    const service = createCaregiverProfilesService({ getAll: async () => profiles });
    assert.equal(await service.getAll("9"), profiles);
  });

  it("atualiza um cuidador existente", async () => {
    let receivedId;
    const service = createCaregiverProfilesService({
      async update(id) { receivedId = id; return { id, name: "Maria" }; },
    });
    await service.update("3", validProfile(), "9");
    assert.equal(receivedId, "3");
  });

  it("informa quando o cuidador nao existe ao atualizar", async () => {
    const service = createCaregiverProfilesService({ update: async () => null });
    await assert.rejects(service.update("99", validProfile(), "9"), CaregiverProfileNotFoundError);
  });

  it("informa quando o cuidador nao existe ao remover", async () => {
    const service = createCaregiverProfilesService({ remove: async () => false });
    await assert.rejects(service.remove("99", "9"), CaregiverProfileNotFoundError);
  });
});
