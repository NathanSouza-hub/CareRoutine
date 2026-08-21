const CaregiverProfileNotFoundError = require("../errors/caregiver-profile-not-found-error");
const CaregiverProfileValidationError = require("../errors/caregiver-profile-validation-error");

function validateId(value, field = "id") {
  if (!/^\d+$/.test(String(value ?? "")) || value === "0") {
    throw new CaregiverProfileValidationError({ [field]: "Identificador inválido" });
  }
}

function validateProfile(input, editing = false) {
  const details = {};
  const name = typeof input.name === "string" ? input.name.trim() : "";
  const avatarColor = typeof input.avatarColor === "string" ? input.avatarColor.trim() : "";

  if (!name || name.length > 80) details.name = "Informe um nome com até 80 caracteres";
  if (!avatarColor) details.avatarColor = "Escolha uma cor de avatar";
  if (Object.keys(details).length) throw new CaregiverProfileValidationError(details);

  return { name, avatarColor, isActive: editing ? input.isActive !== false : true };
}

function createCaregiverProfilesService(repository) {
  async function create(input, userId) {
    const profile = validateProfile(input ?? {});
    return repository.create({ ...profile, userId });
  }

  async function getAll(userId) {
    return repository.getAll(userId);
  }

  async function update(id, input, userId) {
    validateId(id);
    const updated = await repository.update(id, validateProfile(input ?? {}, true), userId);
    if (!updated) throw new CaregiverProfileNotFoundError();
    return updated;
  }

  async function remove(id, userId) {
    validateId(id);
    if (!(await repository.remove(id, userId))) throw new CaregiverProfileNotFoundError();
  }

  return Object.freeze({ create, getAll, remove, update });
}

module.exports = createCaregiverProfilesService;
