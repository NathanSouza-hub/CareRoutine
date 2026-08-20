const RoutineNotFoundError = require("../errors/routine-not-found-error");
const RoutineValidationError = require("../errors/routine-validation-error");

function isDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number);
  const parsed = new Date(Date.UTC(year, month - 1, day));
  return parsed.getUTCFullYear() === year && parsed.getUTCMonth() === month - 1 && parsed.getUTCDate() === day;
}

function validateId(value) {
  if (!/^\d+$/.test(value) || value === "0") {
    throw new RoutineValidationError({ id: "Identificador inválido" });
  }
}

function validateRoutine(input, editing = false) {
  const details = {};
  const title = typeof input.title === "string" ? input.title.trim() : "";
  const category = typeof input.category === "string" ? input.category.trim() : "";
  const time = typeof input.time === "string" ? input.time.trim() : "";
  const notes = typeof input.notes === "string" ? input.notes.trim() : "";
  const startDate = typeof input.startDate === "string" ? input.startDate : "";
  const endDate = typeof input.endDate === "string" && input.endDate ? input.endDate : null;

  if (!title || title.length > 120) details.title = "Informe uma atividade com até 120 caracteres";
  if (!category || category.length > 40) details.category = "Informe uma categoria válida";
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(time)) details.time = "Informe um horário válido";
  if (notes.length > 500) details.notes = "Use no máximo 500 caracteres";
  if (!isDate(startDate)) details.startDate = "Informe uma data inicial válida";
  if (endDate && !isDate(endDate)) details.endDate = "Informe uma data final válida";
  if (endDate && isDate(startDate) && endDate < startDate) details.endDate = "A data final não pode ser anterior à inicial";
  if (Object.keys(details).length) throw new RoutineValidationError(details);

  return { title, category, time, notes: notes || null, startDate, endDate, isActive: editing ? input.isActive !== false : true };
}

function createRoutinesService(repository) {
  async function getAll() { return repository.getAll(); }
  async function create(input) { return { id: await repository.create(validateRoutine(input ?? {})) }; }
  async function update(id, input) {
    validateId(id);
    if (!(await repository.update(id, validateRoutine(input ?? {}, true)))) throw new RoutineNotFoundError();
  }
  async function remove(id) {
    validateId(id);
    if (!(await repository.remove(id))) throw new RoutineNotFoundError();
  }
  async function getDaily(date) {
    if (!isDate(date)) throw new RoutineValidationError({ date: "Informe uma data válida" });
    return repository.getDaily(date);
  }
  async function setCompletion(id, input) {
    validateId(id);
    const details = {};
    const date = typeof input.date === "string" ? input.date : "";
    const status = input.status;
    if (!isDate(date)) details.date = "Informe uma data válida";
    if (!new Set(["completed", "skipped"]).has(status)) details.status = "Status inválido";
    if (Object.keys(details).length) throw new RoutineValidationError(details);
    if (!(await repository.existsOnDate(id, date))) throw new RoutineNotFoundError("Atividade não encontrada nesta data");
    return repository.setCompletion({ routineId: id, date, status, completedAt: status === "completed" ? new Date() : null });
  }
  return Object.freeze({ create, getAll, getDaily, remove, setCompletion, update });
}

module.exports = createRoutinesService;
