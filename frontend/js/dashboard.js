const message = document.querySelector("#dashboard-message");
const todayList = document.querySelector("#today-list");
const todayEmpty = document.querySelector("#today-empty");
const vitalsList = document.querySelector("#vitals-today-list");
const vitalsEmpty = document.querySelector("#vitals-today-empty");
const tasksDate = document.querySelector("#tasks-date");
const dashboardTitle = document.querySelector("#dashboard-title");
const tabButtons = document.querySelectorAll("[data-tab]");
const tabAgenda = document.querySelector("#tab-agenda");
const tabVitais = document.querySelector("#tab-vitais");
const notifications = document.querySelector("#notifications");
const notificationsButton = document.querySelector("#notifications-button");
const notificationsBadge = document.querySelector("#notifications-badge");
const notificationsPanel = document.querySelector("#notifications-panel");
const notificationsEmpty = document.querySelector("#notifications-empty");
const notificationsList = document.querySelector("#notifications-list");

let patientId = null;

function localDate() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

const today = localDate();
let selectedDate = today;

function showTab(name) {
  tabAgenda.hidden = name !== "agenda";
  tabVitais.hidden = name !== "vitais";
  tabButtons.forEach((btn) => btn.classList.toggle("tab-button--active", btn.dataset.tab === name));
}

function taskRow(item) {
  const row = document.createElement("li");
  row.className = `today-item${item.status !== "pending" ? " today-item--done" : ""}`;

  const time = document.createElement("span");
  time.className = "today-item__time";
  time.textContent = item.time;

  const info = document.createElement("div");
  info.className = "today-item__info";
  const title = document.createElement("p");
  title.className = "today-item__title";
  title.textContent = item.isFixed ? `📌 ${item.title}` : item.title;
  const subtitle = document.createElement("p");
  subtitle.className = "today-item__subtitle";
  subtitle.textContent = item.subtitle;
  info.append(title, subtitle);

  const actions = document.createElement("div");
  actions.className = "today-item__actions";
  [
    { label: "✅", title: item.doneLabel, action: item.doneStatus, doneClass: "table-action--done" },
    { label: "❌", title: item.skipLabel, action: item.skipStatus, doneClass: "table-action--skipped" },
  ].forEach(({ label, title: actionTitle, action, doneClass }) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = `table-action table-action--icon${item.status === action ? ` ${doneClass}` : ""}`;
    button.textContent = label;
    button.title = actionTitle;
    button.setAttribute("aria-label", actionTitle);
    button.dataset.kind = item.kind;
    button.dataset.id = item.id;
    button.dataset.action = action;
    if (item.medicationId) button.dataset.medicationId = item.medicationId;
    actions.append(button);
  });

  row.append(time, info, actions);
  return row;
}

function vitalRow(record) {
  const row = document.createElement("li");
  row.className = "today-item";

  const time = document.createElement("span");
  time.className = "today-item__time";
  time.textContent = record.time;

  const info = document.createElement("div");
  info.className = "today-item__info";
  const title = document.createElement("p");
  title.className = "today-item__title";
  title.textContent = [
    record.bloodPressure && `PA ${record.bloodPressure}`,
    record.heartRate && `FC ${record.heartRate} bpm`,
    record.oxygenSaturation && `Sat ${record.oxygenSaturation}%`,
    record.temperature && `Temp ${record.temperature} °C`,
    record.bloodGlucose && `Glicemia ${record.bloodGlucose} mg/dL`,
  ].filter(Boolean).join(" · ") || "Sem medições registradas";
  info.append(title);

  row.append(time, info);
  return row;
}

async function loadTasks() {
  const [activities, doses, dailyEvents] = await Promise.all([
    RoutinesRepository.getDaily(selectedDate, patientId),
    MedicationsRepository.getDaily(selectedDate, patientId),
    EventsRepository.getDaily(selectedDate, patientId),
  ]);

  const items = [
    ...activities.map((activity) => ({
      time: activity.time,
      kind: "routine",
      id: activity.id,
      title: activity.title,
      subtitle: `Atividade · ${activity.category}`,
      status: activity.status,
      isFixed: activity.isFixed,
      doneLabel: "Concluir",
      doneStatus: "completed",
      skipLabel: "Não realizada",
      skipStatus: "skipped",
    })),
    ...doses.map((dose) => ({
      time: dose.time,
      kind: "medication",
      id: dose.scheduleId,
      medicationId: dose.medicationId,
      title: dose.name,
      subtitle: `Medicamento · ${dose.dosage}`,
      status: dose.status,
      doneLabel: "Administrado",
      doneStatus: "taken",
      skipLabel: "Ignorado",
      skipStatus: "skipped",
    })),
    ...dailyEvents.map((eventItem) => ({
      time: eventItem.time,
      kind: "event",
      id: eventItem.id,
      title: eventItem.title,
      subtitle: `Evento${eventItem.category ? ` · ${eventItem.category}` : ""}`,
      status: eventItem.status,
      doneLabel: "Concluir",
      doneStatus: "completed",
      skipLabel: "Não realizado",
      skipStatus: "skipped",
    })),
  ].sort((first, second) => first.time.localeCompare(second.time) || first.title.localeCompare(second.title));

  todayEmpty.textContent = selectedDate === today ? "Nenhuma tarefa programada para hoje." : "Nenhuma tarefa programada para esta data.";
  todayList.replaceChildren();
  todayEmpty.hidden = items.length > 0;
  items.forEach((item) => todayList.append(taskRow(item)));
}

async function loadVitals() {
  const records = await VitalsRepository.getAll(patientId);
  const dateRecords = records.filter((record) => record.date === selectedDate).sort((a, b) => a.time.localeCompare(b.time));
  vitalsEmpty.textContent = selectedDate === today ? "Nenhum sinal vital registrado hoje." : "Nenhum sinal vital registrado nesta data.";
  vitalsList.replaceChildren();
  vitalsEmpty.hidden = dateRecords.length > 0;
  dateRecords.forEach((record) => vitalsList.append(vitalRow(record)));
}

function daysUntilLabel(dateValue) {
  const diff = Math.round((new Date(`${dateValue}T00:00:00`) - new Date(`${today}T00:00:00`)) / 86400000);
  if (diff <= 0) return "Hoje";
  if (diff === 1) return "Amanhã";
  return `Em ${diff} dias`;
}

function notificationRow(item) {
  const row = document.createElement("li");
  row.className = "notifications__item";
  const title = document.createElement("p");
  title.className = "notifications__item-title";
  title.textContent = item.title;
  const when = document.createElement("p");
  when.className = "notifications__item-when";
  when.textContent = `${daysUntilLabel(item.eventDate)} · ${item.eventTime}`;
  row.append(title, when);
  return row;
}

async function loadNotifications() {
  const upcoming = await EventsRepository.getUpcoming(patientId, 3);
  notificationsList.replaceChildren();
  notificationsEmpty.hidden = upcoming.length > 0;
  notificationsBadge.hidden = upcoming.length === 0;
  if (upcoming.length) notificationsBadge.textContent = String(upcoming.length);
  upcoming.forEach((item) => notificationsList.append(notificationRow(item)));
}

notificationsButton.addEventListener("click", (event) => {
  event.stopPropagation();
  notificationsPanel.hidden = !notificationsPanel.hidden;
});

document.addEventListener("click", (event) => {
  if (!notificationsPanel.hidden && !notifications.contains(event.target)) notificationsPanel.hidden = true;
});

todayList.addEventListener("click", async (event) => {
  const target = event.target.closest("[data-action]");
  if (!target) return;
  try {
    if (target.dataset.kind === "routine") {
      await RoutinesRepository.setCompletion(target.dataset.id, { date: selectedDate, status: target.dataset.action });
    } else if (target.dataset.kind === "event") {
      await EventsRepository.setStatus(target.dataset.id, target.dataset.action);
    } else {
      await MedicationsRepository.setAdministration(target.dataset.medicationId, target.dataset.id, { date: selectedDate, status: target.dataset.action });
    }
    await loadTasks();
  } catch (error) {
    message.textContent = error.message;
  }
});

tasksDate.addEventListener("change", () => {
  selectedDate = tasksDate.value || today;
  Promise.all([loadTasks(), loadVitals()]).catch((error) => { message.textContent = error.message; });
});

tabButtons.forEach((btn) => btn.addEventListener("click", () => showTab(btn.dataset.tab)));
showTab("agenda");

dashboardTitle.textContent = `Olá, ${AuthContext.getUserName()}!`;
document.querySelector("#current-date").textContent = new Intl.DateTimeFormat("pt-BR", { dateStyle: "full" }).format(new Date());
tasksDate.value = today;

PatientContext.ready().then((id) => {
  patientId = id;
  if (!patientId) {
    message.textContent = "Cadastre um paciente em \"Paciente\" para começar.";
    todayEmpty.hidden = false;
    vitalsEmpty.hidden = false;
    notificationsButton.disabled = true;
    tasksDate.disabled = true;
    return;
  }
  Promise.all([loadTasks(), loadVitals(), loadNotifications()]).catch((error) => { message.textContent = `${error.message}. Verifique se a API está ativa.`; });
});
