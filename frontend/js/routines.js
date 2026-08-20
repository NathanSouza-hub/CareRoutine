const form = document.querySelector("#routine-form");
const message = document.querySelector("#form-message");
const submitButton = document.querySelector("#submit-button");
const cancelButton = document.querySelector("#cancel-button");
const activeField = document.querySelector("#active-field");
const routinesBody = document.querySelector("#routines-body");
const routinesWrapper = document.querySelector("#routines-wrapper");
const emptyRoutines = document.querySelector("#empty-routines");
const routinesCount = document.querySelector("#routines-count");
const tabButtons = document.querySelectorAll("[data-tab]");
const tabNova = document.querySelector("#tab-nova");
const tabCadastradas = document.querySelector("#tab-cadastradas");
let routines = [];
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

function formData() {
  const data = Object.fromEntries(new FormData(form).entries());
  return { ...data, patientId, isActive: form.elements.isActive.checked };
}

function cell(value) { const element = document.createElement("td"); element.textContent = value || "—"; return element; }
function button(label, action, id, className = "table-action") {
  const element = document.createElement("button"); element.type = "button"; element.textContent = label;
  element.className = className; element.dataset.action = action; element.dataset.id = id; return element;
}

function renderRoutines() {
  routinesBody.replaceChildren();
  routinesCount.textContent = `${routines.length} ${routines.length === 1 ? "rotina" : "rotinas"}`;
  emptyRoutines.hidden = routines.length > 0; routinesWrapper.hidden = routines.length === 0;
  routines.forEach((item) => {
    const row = document.createElement("tr");
    const actions = cell(""); actions.append(button("Editar", "edit", item.id), button("Excluir", "delete", item.id, "table-action table-action--danger"));
    row.append(cell(item.title), cell(item.category), cell(item.time), cell(item.startDate), cell(item.isActive ? "Ativa" : "Inativa"), actions);
    routinesBody.append(row);
  });
}

async function loadRoutines() { routines = await RoutinesRepository.getAll(patientId); renderRoutines(); }

function finishEditing(text = "") {
  editingId = null; form.reset(); form.elements.startDate.value = localDate(); form.elements.isActive.checked = true;
  activeField.hidden = true; cancelButton.hidden = true; submitButton.textContent = "Cadastrar atividade"; message.textContent = text;
}

form.addEventListener("submit", async (event) => {
  event.preventDefault(); submitButton.disabled = true; message.textContent = "Salvando...";
  try {
    const wasEditing = Boolean(editingId);
    if (wasEditing) await RoutinesRepository.update(editingId, formData()); else await RoutinesRepository.create(formData());
    finishEditing(wasEditing ? "Atividade atualizada." : "Atividade cadastrada.");
    await loadRoutines();
    showTab("cadastradas");
  } catch (error) { message.textContent = error.message; } finally { submitButton.disabled = false; }
});

routinesBody.addEventListener("click", async (event) => {
  const target = event.target.closest("[data-action]"); if (!target) return;
  const item = routines.find((entry) => String(entry.id) === target.dataset.id);
  if (target.dataset.action === "edit" && item) {
    editingId = String(item.id); form.elements.title.value = item.title; form.elements.category.value = item.category;
    form.elements.time.value = item.time; form.elements.startDate.value = item.startDate;
    form.elements.notes.value = item.notes || ""; form.elements.isActive.checked = item.isActive;
    activeField.hidden = false; cancelButton.hidden = false; submitButton.textContent = "Salvar alterações";
    showTab("nova");
  }
  if (target.dataset.action === "delete" && window.confirm("Excluir esta rotina e seu histórico?")) {
    try { await RoutinesRepository.remove(target.dataset.id); await loadRoutines(); }
    catch (error) { message.textContent = error.message; }
  }
});

cancelButton.addEventListener("click", () => { finishEditing(); showTab("cadastradas"); });
tabButtons.forEach((btn) => btn.addEventListener("click", () => showTab(btn.dataset.tab)));
document.querySelector("#current-date").textContent = new Intl.DateTimeFormat("pt-BR", { dateStyle: "full" }).format(new Date());
form.elements.startDate.value = localDate();
showTab("nova");

PatientContext.ready().then((id) => {
  patientId = id;
  if (!patientId) {
    message.textContent = "Cadastre um paciente em \"Paciente\" para começar.";
    submitButton.disabled = true;
    return;
  }
  loadRoutines().catch((error) => { message.textContent = `${error.message}. Verifique se a API está ativa.`; });
});
