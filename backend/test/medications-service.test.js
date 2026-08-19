const assert = require("node:assert/strict");
const { describe, it } = require("node:test");
const MedicationNotFoundError = require("../src/errors/medication-not-found-error");
const MedicationValidationError = require("../src/errors/medication-validation-error");
const createMedicationsService = require("../src/services/medications-service");

function validMedication(overrides = {}) {
  return {
    name: "Losartana",
    dosage: "50 mg",
    instructions: "Após a refeição",
    startDate: "2026-08-18",
    endDate: "",
    times: ["20:00", "08:00", "08:00"],
    ...overrides,
  };
}

describe("medications service", () => {
  it("normaliza e cadastra um tratamento recorrente", async () => {
    let received;
    const service = createMedicationsService({
      async create(data) { received = data; return "7"; },
    });

    const result = await service.create(validMedication());

    assert.deepEqual(received.times, ["08:00", "20:00"]);
    assert.equal(received.endDate, null);
    assert.equal(received.isActive, true);
    assert.deepEqual(result, { id: "7" });
  });

  it("rejeita tratamento sem horário", async () => {
    const service = createMedicationsService({ create: async () => assert.fail() });
    await assert.rejects(service.create(validMedication({ times: [] })), MedicationValidationError);
  });

  it("rejeita data final anterior à inicial", async () => {
    const service = createMedicationsService({ create: async () => assert.fail() });
    await assert.rejects(
      service.create(validMedication({ endDate: "2026-08-17" })),
      MedicationValidationError,
    );
  });

  it("atualiza um tratamento existente", async () => {
    let receivedId;
    const service = createMedicationsService({
      async update(id) { receivedId = id; return true; },
    });
    await service.update("3", { ...validMedication(), isActive: false });
    assert.equal(receivedId, "3");
  });

  it("informa quando o tratamento não existe", async () => {
    const service = createMedicationsService({ update: async () => false });
    await assert.rejects(service.update("99", validMedication()), MedicationNotFoundError);
  });

  it("lista somente a agenda da data válida", async () => {
    const doses = [{ scheduleId: "2" }];
    const service = createMedicationsService({ getDaily: async () => doses });
    assert.equal(await service.getDaily("2026-08-18"), doses);
    await assert.rejects(service.getDaily("18/08/2026"), MedicationValidationError);
  });

  it("registra uma dose tomada no horário pertencente ao medicamento", async () => {
    let received;
    const service = createMedicationsService({
      scheduleBelongsToMedication: async () => true,
      async setAdministration(data) { received = data; return { id: "1" }; },
    });

    await service.setAdministration("3", "5", {
      date: "2026-08-18",
      status: "taken",
      notes: "Sem intercorrências",
    });

    assert.equal(received.scheduleId, "5");
    assert.ok(received.administeredAt instanceof Date);
  });

  it("rejeita um horário que não pertence ao medicamento", async () => {
    const service = createMedicationsService({ scheduleBelongsToMedication: async () => false });
    await assert.rejects(
      service.setAdministration("3", "5", { date: "2026-08-18", status: "skipped" }),
      MedicationNotFoundError,
    );
  });
});
