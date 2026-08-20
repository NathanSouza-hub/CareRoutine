const EventNotFoundError = require("../errors/event-not-found-error");
const EventValidationError = require("../errors/event-validation-error");

function isDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number);
  const parsed = new Date(Date.UTC(year, month - 1, day));
  return parsed.getUTCFullYear() === year && parsed.getUTCMonth() === month - 1 && parsed.getUTCDate() === day;
}

function validateId(value, field = "id") {
  if (!/^\d+$/.test(String(value ?? "")) || value === "0") {
    throw new EventValidationError({ [field]: "Identificador inválido" });
  }
}

function validateEvent(input, editing = false) {
  const details = {};
  const title = typeof input.title === "string" ? input.title.trim() : "";
  const category = typeof input.category === "string" ? input.category.trim() : "";
  const eventTime = typeof input.eventTime === "string" ? input.eventTime.trim() : "";
  const notes = typeof input.notes === "string" ? input.notes.trim() : "";
  const eventDate = typeof input.eventDate === "string" ? input.eventDate : "";
  const patientId = input.patientId;

  if (!title || title.length > 120) details.title = "Informe um título com até 120 caracteres";
  if (category.length > 40) details.category = "Use no máximo 40 caracteres";
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(eventTime)) details.eventTime = "Informe um horário válido";
  if (notes.length > 500) details.notes = "Use no máximo 500 caracteres";
  if (!isDate(eventDate)) details.eventDate = "Informe uma data válida";
  if (!editing && !/^\d+$/.test(String(patientId ?? ""))) details.patientId = "Selecione um paciente";
  if (Object.keys(details).length) throw new EventValidationError(details);

  return { title, category: category || null, eventDate, eventTime, notes: notes || null, patientId };
}

function createEventsService(repository) {
  async function getAll(patientId, userId, range) {
    validateId(patientId, "patientId");
    return repository.getAll(patientId, userId, range);
  }
  async function create(input, userId) {
    const event = validateEvent(input ?? {});
    if (!(await repository.patientBelongsToUser(event.patientId, userId))) {
      throw new EventValidationError({ patientId: "Paciente não encontrado" });
    }
    return { id: await repository.create(event) };
  }
  async function update(id, input, userId) {
    validateId(id);
    if (!(await repository.update(id, validateEvent(input ?? {}, true), userId))) throw new EventNotFoundError();
  }
  async function remove(id, userId) {
    validateId(id);
    if (!(await repository.remove(id, userId))) throw new EventNotFoundError();
  }
  async function getDaily(date, patientId, userId) {
    if (!isDate(date)) throw new EventValidationError({ date: "Informe uma data válida" });
    validateId(patientId, "patientId");
    return repository.getDaily(date, patientId, userId);
  }
  async function getUpcoming(patientId, userId, days) {
    validateId(patientId, "patientId");
    const parsedDays = Number(days);
    if (!Number.isInteger(parsedDays) || parsedDays < 0 || parsedDays > 365) {
      throw new EventValidationError({ days: "Informe um número de dias válido" });
    }
    return repository.getUpcoming(patientId, userId, parsedDays);
  }
  async function setStatus(id, input, userId) {
    validateId(id);
    const status = input.status;
    if (!new Set(["completed", "skipped"]).has(status)) throw new EventValidationError({ status: "Status inválido" });
    const result = await repository.setStatus(id, status, userId);
    if (!result) throw new EventNotFoundError();
    return result;
  }
  return Object.freeze({ create, getAll, getDaily, getUpcoming, remove, setStatus, update });
}

module.exports = createEventsService;
