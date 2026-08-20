const currentDateElement = document.querySelector("#current-date");
const editForm = document.querySelector("#edit-form");
const editPanel = document.querySelector("#edit-panel");
const formMessage = document.querySelector("#form-message");
const submitButton = document.querySelector("#submit-button");
const cancelEditButton = document.querySelector("#cancel-edit-button");
const historyBody = document.querySelector("#vitals-history");
const historyTableWrapper = document.querySelector("#history-table-wrapper");
const emptyHistory = document.querySelector("#empty-history");
const recordsCount = document.querySelector("#records-count");
const filtersForm = document.querySelector("#history-filters");
const clearFiltersButton = document.querySelector("#clear-filters-button");
const printButton = document.querySelector("#print-button");

let editingRecordId = null;
let records = [];
let patientId = null;

function formatDateTime(date, time) {
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(new Date(`${date}T${time}:00`));
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
    .sort((first, second) => `${second.date}T${second.time}`.localeCompare(`${first.date}T${first.time}`));
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

function startEditing(recordId) {
  const record = records.find((item) => item.id === recordId);
  if (!record) return;

  editingRecordId = recordId;
  Object.entries(record).forEach(([fieldName, value]) => {
    const field = editForm.elements.namedItem(fieldName);
    if (field) field.value = value;
  });

  editPanel.hidden = false;
  formMessage.textContent = "";
  editForm.scrollIntoView({ behavior: "smooth", block: "start" });
}

function finishEditing() {
  editingRecordId = null;
  editForm.reset();
  editPanel.hidden = true;
  formMessage.textContent = "";
}

editForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const record = Object.fromEntries(new FormData(editForm).entries());
  submitButton.disabled = true;
  formMessage.textContent = "Salvando...";

  try {
    await VitalsRepository.update(editingRecordId, record);
    finishEditing();
    records = await VitalsRepository.getAll(patientId);
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

printButton.addEventListener("click", () => {
  const filters = Object.fromEntries(new FormData(filtersForm).entries());
  const params = new URLSearchParams({ patientId: patientId || "" });
  if (filters.startDate) params.set("startDate", filters.startDate);
  if (filters.endDate) params.set("endDate", filters.endDate);
  if (filters.shift) params.set("shift", filters.shift);
  window.open(`historico-impressao.html?${params.toString()}`, "_blank");
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
    records = await VitalsRepository.getAll(patientId);
    renderHistory();
  } catch (error) {
    emptyHistory.textContent = "Não foi possível carregar o histórico. Verifique se a API está ativa.";
    emptyHistory.hidden = false;
    historyTableWrapper.hidden = true;
  }
}

currentDateElement.textContent = new Intl.DateTimeFormat("pt-BR", { dateStyle: "full" }).format(new Date());

PatientContext.ready().then((id) => {
  patientId = id;
  if (!patientId) {
    emptyHistory.textContent = "Cadastre um paciente em \"Paciente\" para começar.";
    emptyHistory.hidden = false;
    return;
  }
  loadHistory();
});
