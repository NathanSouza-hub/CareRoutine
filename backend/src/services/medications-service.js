const MedicationNotFoundError = require("../errors/medication-not-found-error");
const MedicationValidationError = require("../errors/medication-validation-error");

function isDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number);
  const parsed = new Date(Date.UTC(year, month - 1, day));
  return parsed.getUTCFullYear() === year && parsed.getUTCMonth() === month - 1 && parsed.getUTCDate() === day;
}

function validateId(value, field = "id") {
  if (!/^\d+$/.test(value) || value === "0") {
    throw new MedicationValidationError({ [field]: "Identificador inválido" });
  }
}

function validateMedication(input, editing = false) {
  const details = {};
  const name = typeof input.name === "string" ? input.name.trim() : "";
  const dosage = typeof input.dosage === "string" ? input.dosage.trim() : "";
  const instructions = typeof input.instructions === "string" ? input.instructions.trim() : "";
  const startDate = typeof input.startDate === "string" ? input.startDate : "";
  const endDate = typeof input.endDate === "string" && input.endDate ? input.endDate : null;
  const times = Array.isArray(input.times)
    ? [...new Set(input.times.map((time) => String(time).trim()))].sort()
    : [];
  const patientId = input.patientId;

  if (!name || name.length > 120) details.name = "Informe um nome com até 120 caracteres";
  if (!dosage || dosage.length > 80) details.dosage = "Informe uma dosagem com até 80 caracteres";
  if (instructions.length > 500) details.instructions = "Use no máximo 500 caracteres";
  if (!isDate(startDate)) details.startDate = "Informe uma data inicial válida";
  if (endDate && !isDate(endDate)) details.endDate = "Informe uma data final válida";
  if (endDate && isDate(startDate) && endDate < startDate) {
    details.endDate = "A data final não pode ser anterior à inicial";
  }
  if (!times.length || times.some((time) => !/^([01]\d|2[0-3]):[0-5]\d$/.test(time))) {
    details.times = "Informe ao menos um horário válido";
  }
  if (!editing && !/^\d+$/.test(String(patientId ?? ""))) details.patientId = "Selecione um paciente";

  if (Object.keys(details).length) throw new MedicationValidationError(details);

  return {
    name,
    dosage,
    instructions: instructions || null,
    startDate,
    endDate,
    times,
    patientId,
    isActive: editing ? input.isActive !== false : true,
  };
}

function createMedicationsService(repository) {
  async function getAll(patientId) {
    validateId(patientId, "patientId");
    return repository.getAll(patientId);
  }

  async function create(input) {
    const medication = validateMedication(input ?? {});
    const id = await repository.create(medication);
    return { id };
  }

  async function update(id, input) {
    validateId(id);
    const updated = await repository.update(id, validateMedication(input ?? {}, true));
    if (!updated) throw new MedicationNotFoundError();
  }

  async function remove(id) {
    validateId(id);
    if (!(await repository.remove(id))) throw new MedicationNotFoundError();
  }

  async function getDaily(date, patientId) {
    if (!isDate(date)) throw new MedicationValidationError({ date: "Informe uma data válida" });
    validateId(patientId, "patientId");
    return repository.getDaily(date, patientId);
  }

  async function setAdministration(medicationId, scheduleId, input) {
    validateId(medicationId, "medicationId");
    validateId(scheduleId, "scheduleId");
    const details = {};
    const date = typeof input.date === "string" ? input.date : "";
    const status = input.status;
    const notes = typeof input.notes === "string" ? input.notes.trim() : "";
    if (!isDate(date)) details.date = "Informe uma data válida";
    if (!new Set(["taken", "skipped"]).has(status)) details.status = "Status inválido";
    if (notes.length > 500) details.notes = "Use no máximo 500 caracteres";
    if (Object.keys(details).length) throw new MedicationValidationError(details);
    if (!(await repository.scheduleBelongsToMedication(medicationId, scheduleId))) {
      throw new MedicationNotFoundError("Horário do medicamento não encontrado");
    }
    return repository.setAdministration({
      scheduleId,
      date,
      status,
      administeredAt: status === "taken" ? new Date() : null,
      notes: notes || null,
    });
  }

  return Object.freeze({ create, getAll, getDaily, remove, setAdministration, update });
}

module.exports = createMedicationsService;
