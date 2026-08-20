const assert = require("node:assert/strict");
const { describe, it } = require("node:test");
const PatientNotFoundError = require("../src/errors/patient-not-found-error");
const PatientValidationError = require("../src/errors/patient-validation-error");
const createPatientsService = require("../src/services/patients-service");

function validPatient(overrides = {}) {
  return { fullName: "Maria da Silva", birthDate: "1945-03-12", sex: "Feminino", ...overrides };
}

describe("patients service", () => {
  it("normaliza e cadastra um paciente", async () => {
    let received;
    const service = createPatientsService({ async create(data) { received = data; return "3"; } });
    assert.deepEqual(await service.create(validPatient()), { id: "3" });
    assert.equal(received.fullName, "Maria da Silva");
    assert.equal(received.allergies, null);
    assert.equal(received.isActive, true);
  });

  it("rejeita cadastro sem nome", async () => {
    const service = createPatientsService({ create: async () => assert.fail() });
    await assert.rejects(service.create(validPatient({ fullName: "  " })), PatientValidationError);
  });

  it("rejeita data de nascimento futura", async () => {
    const service = createPatientsService({ create: async () => assert.fail() });
    await assert.rejects(service.create(validPatient({ birthDate: "2999-01-01" })), PatientValidationError);
  });

  it("rejeita opção inválida de mobilidade", async () => {
    const service = createPatientsService({ create: async () => assert.fail() });
    await assert.rejects(service.create(validPatient({ mobility: "Voando" })), PatientValidationError);
  });

  it("informa quando o paciente não existe ao atualizar", async () => {
    const service = createPatientsService({ update: async () => false });
    await assert.rejects(service.update("9", validPatient()), PatientNotFoundError);
  });

  it("busca um paciente pelo id", async () => {
    const patient = { id: "1", fullName: "Maria da Silva" };
    const service = createPatientsService({ getById: async () => patient });
    assert.equal(await service.getById("1"), patient);
  });

  it("informa quando o paciente não existe ao buscar", async () => {
    const service = createPatientsService({ getById: async () => null });
    await assert.rejects(service.getById("9"), PatientNotFoundError);
  });
});
