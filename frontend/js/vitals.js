const currentDateElement = document.querySelector("#current-date");
const vitalsForm = document.querySelector("#vitals-form");
const dateInput = document.querySelector("#date");
const timeInput = document.querySelector("#time");
const shiftInput = document.querySelector("#shift");
const formMessage = document.querySelector("#form-message");
const submitButton = document.querySelector("#submit-button");
const cancelEditButton = document.querySelector("#cancel-edit-button");
const historyBody = document.querySelector("#vitals-history");
const historyTableWrapper = document.querySelector("#history-table-wrapper");
const emptyHistory = document.querySelector("#empty-history");
const recordsCount = document.querySelector("#records-count");
const filtersForm = document.querySelector("#history-filters");
const clearFiltersButton = document.querySelector("#clear-filters-button");

let editingRecordId = null;
let records = [];

function selectShiftFromHour(hour) {
  if (hour >= 6 && hour < 12) return "Manhã";
  if (hour >= 12 && hour < 18) return "Tarde";
  if (hour >= 18) return "Noite";
  return "Madrugada";
}

function fillCurrentDateTime() {
  const now = new Date();
  dateInput.value = [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, "0"),
    String(now.getDate()).padStart(2, "0"),
  ].join("-");
  timeInput.value = [
    String(now.getHours()).padStart(2, "0"),
    String(now.getMinutes()).padStart(2, "0"),
  ].join(":");
  shiftInput.value = selectShiftFromHour(now.getHours());
}

function formatDateTime(date, time) {
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(`${date}T${time}:00`));
}

function createCell(value) {
  const cell = document.createElement("td");
  cell.textContent = value || "—";
  return cell;
}

function getFilteredRecords() {
  const filters = Object.fromEntries(new FormData(filtersForm).entries());

  return records
    .filter((record) => !filters.startDate || record.date >= filters.startDate)
    .filter((record) => !filters.endDate || record.date <= filters.endDate)
    .filter((record) => !filters.shift || record.shift === filters.shift)
    .sort((first, second) =>
      `${second.date}T${second.time}`.localeCompare(`${first.date}T${first.time}`),
    );
}

function createActionsCell(recordId) {
  const cell = document.createElement("td");
  const actions = document.createElement("div");
  actions.className = "table-actions";

  const editButton = document.createElement("button");
  editButton.type = "button";
  editButton.className = "table-action";
  editButton.dataset.action = "edit";
  editButton.dataset.id = recordId;
  editButton.textContent = "Editar";

  const deleteButton = document.createElement("button");
  deleteButton.type = "button";
  deleteButton.className = "table-action table-action--danger";
  deleteButton.dataset.action = "delete";
  deleteButton.dataset.id = recordId;
  deleteButton.textContent = "Excluir";

  actions.append(editButton, deleteButton);
  cell.append(actions);
  return cell;
}

function renderHistory() {
  const filteredRecords = getFilteredRecords();

  historyBody.replaceChildren();
  recordsCount.textContent = `${filteredRecords.length} de ${records.length} ${records.length === 1 ? "registro" : "registros"}`;
  emptyHistory.textContent = records.length
    ? "Nenhum registro corresponde aos filtros selecionados."
    : "Nenhum sinal vital foi registrado.";
  emptyHistory.hidden = filteredRecords.length > 0;
  historyTableWrapper.hidden = filteredRecords.length === 0;

  filteredRecords.forEach((record) => {
    const row = document.createElement("tr");
    row.append(
      createCell(formatDateTime(record.date, record.time)),
      createCell(record.shift),
      createCell(record.bloodPressure),
      createCell(record.heartRate ? `${record.heartRate} bpm` : "—"),
      createCell(record.oxygenSaturation ? `${record.oxygenSaturation}%` : "—"),
      createCell(record.temperature ? `${record.temperature} °C` : "—"),
      createCell(record.bloodGlucose ? `${record.bloodGlucose} mg/dL` : "—"),
      createCell(record.notes),
      createActionsCell(record.id),
    );
    historyBody.append(row);
  });
}

function finishEditing(message = "") {
  editingRecordId = null;
  vitalsForm.reset();
  fillCurrentDateTime();
  submitButton.textContent = "Registrar sinais vitais";
  cancelEditButton.hidden = true;
  formMessage.textContent = message;
}

function startEditing(recordId) {
  const record = records.find((item) => item.id === recordId);
  if (!record) return;

  editingRecordId = recordId;
  Object.entries(record).forEach(([fieldName, value]) => {
    const field = vitalsForm.elements.namedItem(fieldName);
    if (field) field.value = value;
  });

  submitButton.textContent = "Salvar alterações";
  cancelEditButton.hidden = false;
  formMessage.textContent = "Editando um registro existente.";
  vitalsForm.scrollIntoView({ behavior: "smooth", block: "start" });
}

vitalsForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const record = Object.fromEntries(new FormData(vitalsForm).entries());
  submitButton.disabled = true;
  formMessage.textContent = "Salvando...";

  try {
    if (editingRecordId) {
      await VitalsRepository.update(editingRecordId, record);
      finishEditing("Registro atualizado com sucesso.");
    } else {
      await VitalsRepository.create(record);
      finishEditing("Sinais vitais registrados com sucesso.");
    }

    records = await VitalsRepository.getAll();
    renderHistory();
  } catch (error) {
    formMessage.textContent = error.message;
  } finally {
    submitButton.disabled = false;
  }
});

cancelEditButton.addEventListener("click", () => finishEditing());
filtersForm.addEventListener("input", renderHistory);

clearFiltersButton.addEventListener("click", () => {
  filtersForm.reset();
  renderHistory();
});

historyBody.addEventListener("click", async (event) => {
  const actionButton = event.target.closest("[data-action]");
  if (!actionButton) return;

  const { action, id } = actionButton.dataset;

  if (action === "edit") {
    startEditing(id);
    return;
  }

  if (action === "delete" && window.confirm("Deseja excluir este registro?")) {
    try {
      await VitalsRepository.remove(id);
      records = records.filter((record) => record.id !== id);
      if (editingRecordId === id) finishEditing();
      renderHistory();
    } catch (error) {
      formMessage.textContent = error.message;
    }
  }
});

async function loadHistory() {
  try {
    records = await VitalsRepository.getAll();
    renderHistory();
  } catch (error) {
    emptyHistory.textContent =
      "Não foi possível carregar o histórico. Verifique se a API está ativa.";
    emptyHistory.hidden = false;
    historyTableWrapper.hidden = true;
    formMessage.textContent = error.message;
  }
}

currentDateElement.textContent = new Intl.DateTimeFormat("pt-BR", {
  dateStyle: "full",
}).format(new Date());

fillCurrentDateTime();
loadHistory();
