const message = document.querySelector("#dashboard-message");
const todayList = document.querySelector("#today-list");
const todayEmpty = document.querySelector("#today-empty");
const vitalsList = document.querySelector("#vitals-today-list");
const vitalsEmpty = document.querySelector("#vitals-today-empty");

let patientId = null;

const routineStatusLabels = { pending: "Pendente", completed: "Concluída", skipped: "Não realizada" };
const doseStatusLabels = { pending: "Pendente", taken: "Administrado", skipped: "Ignorado" };

function localDate() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

const today = localDate();

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
  title.textContent = item.title;
  const subtitle = document.createElement("p");
  subtitle.className = "today-item__subtitle";
  subtitle.textContent = item.subtitle;
  info.append(title, subtitle);

  const status = document.createElement("span");
  status.className = "today-item__status";
  status.textContent = item.statusLabel;

  const actions = document.createElement("div");
  actions.className = "today-item__actions";
  [
    { label: item.doneLabel, action: item.doneStatus },
    { label: item.skipLabel, action: item.skipStatus },
  ].forEach(({ label, action }) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "table-action";
    button.textContent = label;
    button.dataset.kind = item.kind;
    button.dataset.id = item.id;
    button.dataset.action = action;
    if (item.medicationId) button.dataset.medicationId = item.medicationId;
    actions.append(button);
  });

  row.append(time, info, status, actions);
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
  const [activities, doses] = await Promise.all([
    RoutinesRepository.getDaily(today, patientId),
    MedicationsRepository.getDaily(today, patientId),
  ]);

  const items = [
    ...activities.map((activity) => ({
      time: activity.time,
      kind: "routine",
      id: activity.id,
      title: activity.title,
      subtitle: `Rotina · ${activity.category}`,
      status: activity.status,
      statusLabel: routineStatusLabels[activity.status],
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
      statusLabel: doseStatusLabels[dose.status],
      doneLabel: "Administrado",
      doneStatus: "taken",
      skipLabel: "Ignorado",
      skipStatus: "skipped",
    })),
  ].sort((first, second) => first.time.localeCompare(second.time) || first.title.localeCompare(second.title));

  todayList.replaceChildren();
  todayEmpty.hidden = items.length > 0;
  items.forEach((item) => todayList.append(taskRow(item)));
}

async function loadVitals() {
  const records = await VitalsRepository.getAll(patientId);
  const todayRecords = records.filter((record) => record.date === today).sort((a, b) => a.time.localeCompare(b.time));
  vitalsList.replaceChildren();
  vitalsEmpty.hidden = todayRecords.length > 0;
  todayRecords.forEach((record) => vitalsList.append(vitalRow(record)));
}

todayList.addEventListener("click", async (event) => {
  const target = event.target.closest("[data-action]");
  if (!target) return;
  try {
    if (target.dataset.kind === "routine") {
      await RoutinesRepository.setCompletion(target.dataset.id, { date: today, status: target.dataset.action });
    } else {
      await MedicationsRepository.setAdministration(target.dataset.medicationId, target.dataset.id, { date: today, status: target.dataset.action });
    }
    await loadTasks();
  } catch (error) {
    message.textContent = error.message;
  }
});

document.querySelector("#current-date").textContent = new Intl.DateTimeFormat("pt-BR", { dateStyle: "full" }).format(new Date());

PatientContext.ready().then((id) => {
  patientId = id;
  if (!patientId) {
    message.textContent = "Cadastre um paciente em \"Paciente\" para começar.";
    todayEmpty.hidden = false;
    vitalsEmpty.hidden = false;
    return;
  }
  Promise.all([loadTasks(), loadVitals()]).catch((error) => { message.textContent = `${error.message}. Verifique se a API está ativa.`; });
});
