const form = document.querySelector("#note-form");
const message = document.querySelector("#form-message");
const submitButton = document.querySelector("#submit-button");
const cancelButton = document.querySelector("#cancel-button");
const notesBody = document.querySelector("#notes-body");
const notesWrapper = document.querySelector("#notes-wrapper");
const emptyNotes = document.querySelector("#empty-notes");
const notesCount = document.querySelector("#notes-count");
const filtersForm = document.querySelector("#notes-filters");
const clearFiltersButton = document.querySelector("#clear-filters-button");
const tabButtons = document.querySelectorAll("[data-tab]");
const tabNova = document.querySelector("#tab-nova");
const tabCadastradas = document.querySelector("#tab-cadastradas");
let notes = [];
let editingId = null;
let patientId = null;

function showTab(name) {
  tabNova.hidden = name !== "nova";
  tabCadastradas.hidden = name !== "cadastradas";
  tabButtons.forEach((btn) => btn.classList.toggle("tab-button--active", btn.dataset.tab === name));
}

function localDate() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

function localTime() {
  const now = new Date();
  return `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
}

function shiftFromHour(hour) {
  if (hour >= 6 && hour < 12) return "Manhã";
  if (hour >= 12 && hour < 18) return "Tarde";
  if (hour >= 18) return "Noite";
  return "Madrugada";
}

function fillCurrentDateTime() {
  form.elements.noteDate.value = localDate();
  form.elements.noteTime.value = localTime();
  form.elements.shift.value = shiftFromHour(new Date().getHours());
}

function formData() {
  const data = Object.fromEntries(new FormData(form).entries());
  return { ...data, patientId, isHighlighted: form.elements.isHighlighted.checked };
}

function cell(value) { const element = document.createElement("td"); element.textContent = value || "—"; return element; }
function button(label, action, id, className = "table-action", title = "") {
  const element = document.createElement("button"); element.type = "button"; element.innerHTML = label;
  element.className = className; element.dataset.action = action; element.dataset.id = id;
  if (title) { element.title = title; element.setAttribute("aria-label", title); }
  return element;
}

function renderNotes() {
  notesBody.replaceChildren();
  notesCount.textContent = `${notes.length} ${notes.length === 1 ? "anotação" : "anotações"}`;
  emptyNotes.hidden = notes.length > 0; notesWrapper.hidden = notes.length === 0;
  notes.forEach((item) => {
    const row = document.createElement("tr");
    if (item.isHighlighted) row.className = "highlighted-row";
    const actions = cell("");
    actions.append(
      button(icon("pencil"), "edit", item.id, "table-action table-action--icon", "Editar"),
      button(item.isHighlighted ? "Remover grifo" : "Grifar", "toggle-highlight", item.id),
      button(icon("trash"), "delete", item.id, "table-action table-action--icon table-action--danger", "Excluir"),
    );
    const dateTime = new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(new Date(`${item.noteDate}T${item.noteTime}:00`));
    const textCell = cell(item.noteText);
    textCell.className = "table-cell--wrap";
    row.append(cell(dateTime), cell(item.shift), cell(item.authorName), textCell, actions);
    notesBody.append(row);
  });
}

async function loadNotes() {
  const filters = Object.fromEntries(new FormData(filtersForm).entries());
  notes = await NursingNotesRepository.getAll(patientId, filters);
  renderNotes();
}

function finishEditing(text = "") {
  editingId = null; form.reset(); fillCurrentDateTime();
  cancelButton.hidden = true; submitButton.textContent = "Registrar anotação"; message.textContent = text;
}

form.addEventListener("submit", async (event) => {
  event.preventDefault(); submitButton.disabled = true; message.textContent = "Salvando...";
  try {
    const wasEditing = Boolean(editingId);
    if (wasEditing) await NursingNotesRepository.update(editingId, formData()); else await NursingNotesRepository.create(formData());
    finishEditing(wasEditing ? "Anotação atualizada." : "Anotação registrada.");
    await loadNotes();
    showTab("cadastradas");
  } catch (error) { message.textContent = error.message; } finally { submitButton.disabled = false; }
});

notesBody.addEventListener("click", async (event) => {
  const target = event.target.closest("[data-action]"); if (!target) return;
  const item = notes.find((entry) => String(entry.id) === target.dataset.id);
  if (!item) return;

  if (target.dataset.action === "edit") {
    editingId = String(item.id);
    form.elements.noteDate.value = item.noteDate;
    form.elements.noteTime.value = item.noteTime;
    form.elements.shift.value = item.shift;
    form.elements.authorName.value = item.authorName;
    form.elements.noteText.value = item.noteText;
    form.elements.isHighlighted.checked = item.isHighlighted;
    cancelButton.hidden = false; submitButton.textContent = "Salvar alterações";
    message.textContent = "";
    showTab("nova");
  }

  if (target.dataset.action === "toggle-highlight") {
    try {
      await NursingNotesRepository.update(item.id, { ...item, isHighlighted: !item.isHighlighted, patientId });
      await loadNotes();
    } catch (error) { message.textContent = error.message; }
  }

  if (target.dataset.action === "delete" && window.confirm("Excluir esta anotação?")) {
    try {
      await NursingNotesRepository.remove(item.id);
      if (editingId === String(item.id)) finishEditing();
      await loadNotes();
    } catch (error) { message.textContent = error.message; }
  }
});

cancelButton.addEventListener("click", () => { finishEditing(); showTab("cadastradas"); });
filtersForm.addEventListener("input", () => loadNotes().catch((error) => { message.textContent = error.message; }));
clearFiltersButton.addEventListener("click", () => {
  filtersForm.reset();
  loadNotes().catch((error) => { message.textContent = error.message; });
});
tabButtons.forEach((btn) => btn.addEventListener("click", () => showTab(btn.dataset.tab)));
document.querySelector("#current-date").textContent = new Intl.DateTimeFormat("pt-BR", { dateStyle: "full" }).format(new Date());
fillCurrentDateTime();
showTab("nova");

PatientContext.ready().then((id) => {
  patientId = id;
  if (!patientId) {
    message.textContent = "Cadastre um paciente em \"Paciente\" para começar.";
    submitButton.disabled = true;
    return;
  }
  loadNotes().catch((error) => { message.textContent = `${error.message}. Verifique se a API está ativa.`; });
});
