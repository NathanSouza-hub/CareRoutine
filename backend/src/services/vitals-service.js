const ValidationError = require("../errors/validation-error");

const VALID_SHIFTS = new Set(["Manhã", "Tarde", "Noite", "Madrugada"]);

function isValidDate(value) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return false;

  const [, year, month, day] = match.map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));

  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
}

function parseNumber(value, field, details, { integer = false, min, max }) {
  const parsedValue = typeof value === "string" && value.trim() === "" ? NaN : Number(value);

  if (
    !Number.isFinite(parsedValue) ||
    (integer && !Number.isInteger(parsedValue)) ||
    parsedValue < min ||
    parsedValue > max
  ) {
    details[field] = `Deve ser um número entre ${min} e ${max}`;
  }

  return parsedValue;
}

function validateAndMap(input) {
  const details = {};
  const date = typeof input.date === "string" ? input.date.trim() : "";
  const time = typeof input.time === "string" ? input.time.trim() : "";
  const shift = typeof input.shift === "string" ? input.shift.trim() : "";
  const bloodPressure =
    typeof input.bloodPressure === "string" ? input.bloodPressure.trim() : "";

  if (!isValidDate(date)) details.date = "Informe uma data válida no formato AAAA-MM-DD";
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(time)) {
    details.time = "Informe um horário válido no formato HH:MM";
  }
  if (!VALID_SHIFTS.has(shift)) details.shift = "Informe um turno válido";

  const pressureMatch = /^(\d{2,3})\/(\d{2,3})$/.exec(bloodPressure);
  if (!pressureMatch) {
    details.bloodPressure = "Informe a pressão no formato 120/80";
  }

  const heartRate = parseNumber(input.heartRate, "heartRate", details, {
    integer: true,
    min: 1,
    max: 300,
  });
  const oxygenSaturation = parseNumber(
    input.oxygenSaturation,
    "oxygenSaturation",
    details,
    { integer: true, min: 1, max: 100 },
  );
  const temperature = parseNumber(input.temperature, "temperature", details, {
    min: 30,
    max: 45,
  });

  let bloodGlucose = null;
  if (input.bloodGlucose !== undefined && input.bloodGlucose !== null && input.bloodGlucose !== "") {
    bloodGlucose = parseNumber(input.bloodGlucose, "bloodGlucose", details, {
      integer: true,
      min: 1,
      max: 1000,
    });
  }

  const notes = typeof input.notes === "string" ? input.notes.trim() : "";
  if (notes.length > 500) details.notes = "Deve ter no máximo 500 caracteres";

  if (Object.keys(details).length > 0) throw new ValidationError(details);

  return {
    measuredAt: `${date}T${time}:00`,
    shift,
    systolicPressure: Number(pressureMatch[1]),
    diastolicPressure: Number(pressureMatch[2]),
    heartRate,
    oxygenSaturation,
    temperature,
    bloodGlucose,
    notes: notes || null,
  };
}

function createVitalsService(repository) {
  async function create(input) {
    return repository.create(validateAndMap(input ?? {}));
  }

  return Object.freeze({ create });
}

module.exports = createVitalsService;
