const assert = require("node:assert/strict");
const { describe, it } = require("node:test");
const ValidationError = require("../src/errors/validation-error");
const createVitalsService = require("../src/services/vitals-service");

function validInput(overrides = {}) {
  return {
    date: "2026-08-18",
    time: "17:07",
    shift: "Tarde",
    bloodPressure: "120/80",
    heartRate: "72",
    oxygenSaturation: "98",
    temperature: "36.5",
    bloodGlucose: "95",
    notes: "Após o repouso",
    ...overrides,
  };
}

describe("vitals service", () => {
  it("valida, transforma e envia os dados ao repositório", async () => {
    let receivedData;
    const repository = {
      async create(data) {
        receivedData = data;
        return { id: "1", ...data };
      },
    };
    const service = createVitalsService(repository);

    const result = await service.create(validInput());

    assert.deepEqual(receivedData, {
      measuredAt: "2026-08-18T17:07:00",
      shift: "Tarde",
      systolicPressure: 120,
      diastolicPressure: 80,
      heartRate: 72,
      oxygenSaturation: 98,
      temperature: 36.5,
      bloodGlucose: 95,
      notes: "Após o repouso",
    });
    assert.equal(result.id, "1");
  });

  it("converte glicemia e observações vazias para null", async () => {
    let receivedData;
    const service = createVitalsService({
      async create(data) {
        receivedData = data;
        return data;
      },
    });

    await service.create(validInput({ bloodGlucose: "", notes: "  " }));

    assert.equal(receivedData.bloodGlucose, null);
    assert.equal(receivedData.notes, null);
  });

  it("rejeita campos obrigatórios e formatos inválidos", async () => {
    const service = createVitalsService({ create: async () => assert.fail() });

    await assert.rejects(
      service.create(
        validInput({
          date: "2026-02-30",
          time: "25:00",
          shift: "",
          bloodPressure: "120-80",
          heartRate: "0",
          oxygenSaturation: "101",
          temperature: "29",
        }),
      ),
      (error) => {
        assert.ok(error instanceof ValidationError);
        assert.deepEqual(Object.keys(error.details).sort(), [
          "bloodPressure",
          "date",
          "heartRate",
          "oxygenSaturation",
          "shift",
          "temperature",
          "time",
        ]);
        return true;
      },
    );
  });
});
