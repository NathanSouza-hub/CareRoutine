const assert = require("node:assert/strict");
const { describe, it } = require("node:test");
const RoutineNotFoundError = require("../src/errors/routine-not-found-error");
const RoutineValidationError = require("../src/errors/routine-validation-error");
const createRoutinesService = require("../src/services/routines-service");

function validRoutine(overrides = {}) {
  return { title: "Caminhada", category: "Atividade física", time: "09:00", notes: "Levar água", startDate: "2026-08-20", endDate: "", patientId: "1", ...overrides };
}

describe("routines service", () => {
  it("normaliza e cadastra uma rotina diária", async () => {
    let received;
    const service = createRoutinesService({
      patientBelongsToUser: async () => true,
      async create(data) { received = data; return "4"; },
    });
    assert.deepEqual(await service.create(validRoutine(), "9"), { id: "4" });
    assert.equal(received.endDate, null);
    assert.equal(received.isActive, true);
  });

  it("rejeita cadastro para paciente de outro usuário", async () => {
    const service = createRoutinesService({
      patientBelongsToUser: async () => false,
      create: async () => assert.fail(),
    });
    await assert.rejects(service.create(validRoutine(), "9"), RoutineValidationError);
  });

  it("rejeita horário inválido", async () => {
    const service = createRoutinesService({ create: async () => assert.fail() });
    await assert.rejects(service.create(validRoutine({ time: "25:00" })), RoutineValidationError);
  });

  it("rejeita período invertido", async () => {
    const service = createRoutinesService({ create: async () => assert.fail() });
    await assert.rejects(service.create(validRoutine({ endDate: "2026-08-19" })), RoutineValidationError);
  });

  it("informa quando a rotina não existe", async () => {
    const service = createRoutinesService({ update: async () => false });
    await assert.rejects(service.update("9", validRoutine()), RoutineNotFoundError);
  });

  it("lista atividades de uma data válida", async () => {
    const items = [{ id: "1" }];
    const service = createRoutinesService({ getDaily: async () => items });
    assert.equal(await service.getDaily("2026-08-20", "1"), items);
    await assert.rejects(service.getDaily("20/08/2026", "1"), RoutineValidationError);
  });

  it("registra uma atividade concluída", async () => {
    let received;
    const service = createRoutinesService({
      existsOnDate: async () => true,
      async setCompletion(data) { received = data; return { id: "2" }; },
    });
    await service.setCompletion("1", { date: "2026-08-20", status: "completed" });
    assert.ok(received.completedAt instanceof Date);
  });

  it("rejeita conclusão fora do período da rotina", async () => {
    const service = createRoutinesService({ existsOnDate: async () => false });
    await assert.rejects(service.setCompletion("1", { date: "2026-08-20", status: "skipped" }), RoutineNotFoundError);
  });
});
