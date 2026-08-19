const form = document.querySelector("#medication-form");
const message = document.querySelector("#form-message");
const submitButton = document.querySelector("#submit-button");
const cancelButton = document.querySelector("#cancel-button");
const activeField = document.querySelector("#active-field");
const dailyDate = document.querySelector("#daily-date");
const dailyBody = document.querySelector("#daily-body");
const dailyWrapper = document.querySelector("#daily-wrapper");
const emptyDaily = document.querySelector("#empty-daily");
const treatmentsBody = document.querySelector("#treatments-body");
const treatmentsWrapper = document.querySelector("#treatments-wrapper");
const emptyTreatments = document.querySelector("#empty-treatments");
const treatmentsCount = document.querySelector("#treatments-count");
let treatments = [];
let editingId = null;

function localDate() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

function formData() {
  const data = Object.fromEntries(new FormData(form).entries());
  return { ...data, times: data.times.split(",").map((time) => time.trim()).filter(Boolean), isActive: form.elements.isActive.checked };
}

function cell(value) { const element = document.createElement("td"); element.textContent = value || "—"; return element; }
function button(label, action, id, className = "table-action") {
  const element = document.createElement("button"); element.type = "button"; element.textContent = label;
  element.className = className; element.dataset.action = action; element.dataset.id = id; return element;
}

function renderTreatments() {
  treatmentsBody.replaceChildren();
  treatmentsCount.textContent = `${treatments.length} ${treatments.length === 1 ? "tratamento" : "tratamentos"}`;
  emptyTreatments.hidden = treatments.length > 0; treatmentsWrapper.hidden = treatments.length === 0;
  treatments.forEach((item) => {
    const row = document.createElement("tr");
    const actions = cell(""); actions.append(button("Editar", "edit", item.id), button("Excluir", "delete", item.id, "table-action table-action--danger"));
    row.append(cell(item.name), cell(item.dosage), cell(item.schedules.map((s) => s.time).join(", ")), cell(`${item.startDate}${item.endDate ? ` a ${item.endDate}` : " em diante"}`), cell(item.isActive ? "Ativo" : "Inativo"), actions);
    treatmentsBody.append(row);
  });
}

async function loadTreatments() { treatments = await MedicationsRepository.getAll(); renderTreatments(); }

async function loadDaily() {
  const doses = await MedicationsRepository.getDaily(dailyDate.value);
  dailyBody.replaceChildren(); emptyDaily.hidden = doses.length > 0; dailyWrapper.hidden = doses.length === 0;
  const labels = { pending: "Pendente", taken: "Tomado", skipped: "Ignorado" };
  doses.forEach((dose) => {
    const row = document.createElement("tr"); const actions = cell("");
    actions.append(button("Tomado", "taken", dose.scheduleId), button("Ignorado", "skipped", dose.scheduleId));
    actions.dataset.medicationId = dose.medicationId;
    row.append(cell(dose.time), cell(dose.name), cell(dose.dosage), cell(labels[dose.status]), actions); dailyBody.append(row);
  });
}

function finishEditing(text = "") {
  editingId = null; form.reset(); form.elements.startDate.value = localDate(); form.elements.isActive.checked = true;
  activeField.hidden = true; cancelButton.hidden = true; submitButton.textContent = "Cadastrar tratamento"; message.textContent = text;
}

form.addEventListener("submit", async (event) => {
  event.preventDefault(); submitButton.disabled = true; message.textContent = "Salvando...";
  try {
    if (editingId) await MedicationsRepository.update(editingId, formData()); else await MedicationsRepository.create(formData());
    finishEditing(editingId ? "Tratamento atualizado." : "Tratamento cadastrado.");
    await Promise.all([loadTreatments(), loadDaily()]);
  } catch (error) { message.textContent = error.message; } finally { submitButton.disabled = false; }
});

treatmentsBody.addEventListener("click", async (event) => {
  const target = event.target.closest("[data-action]"); if (!target) return;
  const item = treatments.find((entry) => String(entry.id) === target.dataset.id);
  if (target.dataset.action === "edit" && item) {
    editingId = String(item.id); form.elements.name.value = item.name; form.elements.dosage.value = item.dosage;
    form.elements.times.value = item.schedules.map((s) => s.time).join(", "); form.elements.startDate.value = item.startDate;
    form.elements.endDate.value = item.endDate || ""; form.elements.instructions.value = item.instructions || "";
    form.elements.isActive.checked = item.isActive; activeField.hidden = false; cancelButton.hidden = false;
    submitButton.textContent = "Salvar alterações"; form.scrollIntoView({ behavior: "smooth" });
  }
  if (target.dataset.action === "delete" && window.confirm("Excluir este tratamento e seu histórico?")) {
    try { await MedicationsRepository.remove(target.dataset.id); await Promise.all([loadTreatments(), loadDaily()]); }
    catch (error) { message.textContent = error.message; }
  }
});

dailyBody.addEventListener("click", async (event) => {
  const target = event.target.closest("[data-action]"); if (!target) return;
  const medicationId = target.closest("td").dataset.medicationId;
  try {
    await MedicationsRepository.setAdministration(medicationId, target.dataset.id, { date: dailyDate.value, status: target.dataset.action });
    await loadDaily();
  } catch (error) { message.textContent = error.message; }
});

cancelButton.addEventListener("click", () => finishEditing());
dailyDate.addEventListener("change", () => loadDaily().catch((error) => { message.textContent = error.message; }));
document.querySelector("#current-date").textContent = new Intl.DateTimeFormat("pt-BR", { dateStyle: "full" }).format(new Date());
dailyDate.value = localDate(); form.elements.startDate.value = localDate();
Promise.all([loadTreatments(), loadDaily()]).catch((error) => { message.textContent = `${error.message}. Verifique se a API está ativa.`; });
