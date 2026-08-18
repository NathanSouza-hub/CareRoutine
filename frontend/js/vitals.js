const currentDateElement = document.querySelector("#current-date");
const vitalsForm = document.querySelector("#vitals-form");
const dateInput = document.querySelector("#date");
const timeInput = document.querySelector("#time");
const shiftInput = document.querySelector("#shift");
const formMessage = document.querySelector("#form-message");
const historyBody = document.querySelector("#vitals-history");
const historyTableWrapper = document.querySelector("#history-table-wrapper");
const emptyHistory = document.querySelector("#empty-history");
const recordsCount = document.querySelector("#records-count");

const STORAGE_KEY = "careRoutine:vitals";

const now = new Date();

currentDateElement.textContent = new Intl.DateTimeFormat("pt-BR", {
  dateStyle: "full",
}).format(now);

dateInput.value = [
  now.getFullYear(),
  String(now.getMonth() + 1).padStart(2, "0"),
  String(now.getDate()).padStart(2, "0"),
].join("-");

timeInput.value = [
  String(now.getHours()).padStart(2, "0"),
  String(now.getMinutes()).padStart(2, "0"),
].join(":");

const currentHour = now.getHours();

function selectShiftFromHour(hour) {
  if (hour >= 6 && hour < 12) {
    return "Manhã";
  }

  if (hour >= 12 && hour < 18) {
    return "Tarde";
  }

  if (hour >= 18) {
    return "Noite";
  }

  return "Madrugada";
}

shiftInput.value = selectShiftFromHour(currentHour);

function getRecords() {
  const storedRecords = localStorage.getItem(STORAGE_KEY);

  if (!storedRecords) {
    return [];
  }

  try {
    const records = JSON.parse(storedRecords);
    return Array.isArray(records) ? records : [];
  } catch {
    return [];
  }
}

function formatDateTime(date, time) {
  const dateTime = new Date(`${date}T${time}:00`);

  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(dateTime);
}

function createCell(value) {
  const cell = document.createElement("td");
  cell.textContent = value || "—";
  return cell;
}

function renderHistory() {
  const records = getRecords().sort((first, second) => {
    const firstDateTime = `${first.date}T${first.time}`;
    const secondDateTime = `${second.date}T${second.time}`;
    return secondDateTime.localeCompare(firstDateTime);
  });

  historyBody.replaceChildren();
  recordsCount.textContent = `${records.length} ${records.length === 1 ? "registro" : "registros"}`;
  emptyHistory.hidden = records.length > 0;
  historyTableWrapper.hidden = records.length === 0;

  records.forEach((record) => {
    const row = document.createElement("tr");

    row.append(
      createCell(formatDateTime(record.date, record.time)),
      createCell(record.shift),
      createCell(record.bloodPressure),
      createCell(`${record.heartRate} bpm`),
      createCell(`${record.oxygenSaturation}%`),
      createCell(`${record.temperature} °C`),
      createCell(record.bloodGlucose ? `${record.bloodGlucose} mg/dL` : "—"),
      createCell(record.notes),
    );

    historyBody.append(row);
  });
}

vitalsForm.addEventListener("submit", (event) => {
  event.preventDefault();

  const formData = new FormData(vitalsForm);
  const record = Object.fromEntries(formData.entries());
  const records = getRecords();

  records.push(record);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(records));

  formMessage.textContent = "Sinais vitais registrados com sucesso.";
  vitalsForm.reset();

  const submissionTime = new Date();
  dateInput.value = [
    submissionTime.getFullYear(),
    String(submissionTime.getMonth() + 1).padStart(2, "0"),
    String(submissionTime.getDate()).padStart(2, "0"),
  ].join("-");
  timeInput.value = [
    String(submissionTime.getHours()).padStart(2, "0"),
    String(submissionTime.getMinutes()).padStart(2, "0"),
  ].join(":");
  shiftInput.value = selectShiftFromHour(submissionTime.getHours());

  renderHistory();
});

renderHistory();
