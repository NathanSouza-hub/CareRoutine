const PatientNotFoundError = require("../errors/patient-not-found-error");
const PatientValidationError = require("../errors/patient-validation-error");

const SEX_OPTIONS = new Set(["Feminino", "Masculino", "Outro"]);
const MOBILITY_OPTIONS = new Set(["Independente", "Com auxílio", "Cadeirante", "Acamado"]);

const OPTIONAL_TEXT_FIELDS = [
  ["sex", 20], ["cpf", 20], ["healthCardNumber", 40], ["healthInsurance", 120], ["phone", 30], ["address", 255],
  ["emergencyContactName", 120], ["emergencyContactRelationship", 60], ["emergencyContactPhone", 30],
  ["responsibleName", 120], ["responsiblePhone", 30],
  ["bloodType", 5], ["allergies", 500], ["chronicConditions", 1000], ["surgicalHistory", 1000],
  ["mobility", 30], ["dietaryRestrictions", 500], ["currentMedicationsNotes", 1000],
  ["doctorName", 120], ["doctorSpecialty", 120], ["doctorPhone", 30], ["carePlanNotes", 1000],
];

function isDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number);
  const parsed = new Date(Date.UTC(year, month - 1, day));
  return parsed.getUTCFullYear() === year && parsed.getUTCMonth() === month - 1 && parsed.getUTCDate() === day;
}

function validateId(value, field = "id") {
  if (!/^\d+$/.test(value) || value === "0") {
    throw new PatientValidationError({ [field]: "Identificador inválido" });
  }
}

function validatePatient(input, editing = false) {
  const details = {};
  const fullName = typeof input.fullName === "string" ? input.fullName.trim() : "";
  const birthDate = typeof input.birthDate === "string" ? input.birthDate : "";

  if (!fullName || fullName.length > 150) details.fullName = "Informe um nome com até 150 caracteres";
  if (!isDate(birthDate)) details.birthDate = "Informe uma data de nascimento válida";
  else if (birthDate > new Date().toISOString().slice(0, 10)) details.birthDate = "A data de nascimento não pode ser futura";

  const patient = { fullName, birthDate };

  for (const [field, maxLength] of OPTIONAL_TEXT_FIELDS) {
    const value = typeof input[field] === "string" ? input[field].trim() : "";
    if (value.length > maxLength) details[field] = `Use no máximo ${maxLength} caracteres`;
    patient[field] = value || null;
  }

  if (patient.sex && !SEX_OPTIONS.has(patient.sex)) details.sex = "Selecione uma opção válida";
  if (patient.mobility && !MOBILITY_OPTIONS.has(patient.mobility)) details.mobility = "Selecione uma opção válida";

  if (Object.keys(details).length) throw new PatientValidationError(details);

  patient.isActive = editing ? input.isActive !== false : true;
  return patient;
}

function createPatientsService(repository) {
  async function getAll(userId) { return repository.getAll(userId); }

  async function getById(id, userId) {
    validateId(id);
    const patient = await repository.getById(id, userId);
    if (!patient) throw new PatientNotFoundError();
    return patient;
  }

  async function create(input, userId) {
    return { id: await repository.create(validatePatient(input ?? {}), userId) };
  }

  async function update(id, input, userId) {
    validateId(id);
    if (!(await repository.update(id, validatePatient(input ?? {}, true), userId))) throw new PatientNotFoundError();
  }

  async function remove(id, userId) {
    validateId(id);
    if (!(await repository.remove(id, userId))) throw new PatientNotFoundError();
  }

  return Object.freeze({ create, getAll, getById, remove, update });
}

module.exports = createPatientsService;
