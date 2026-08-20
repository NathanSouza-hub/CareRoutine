const currentDateElement = document.querySelector("#current-date");
const vitalsForm = document.querySelector("#vitals-form");
const dateInput = document.querySelector("#date");
const timeInput = document.querySelector("#time");
const shiftInput = document.querySelector("#shift");
const formMessage = document.querySelector("#form-message");
const submitButton = document.querySelector("#submit-button");

let patientId = null;

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

vitalsForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!patientId) {
    formMessage.textContent = "Cadastre um paciente em \"Paciente\" para começar.";
    return;
  }

  const record = { ...Object.fromEntries(new FormData(vitalsForm).entries()), patientId };
  submitButton.disabled = true;
  formMessage.textContent = "Salvando...";

  try {
    await VitalsRepository.create(record);
    vitalsForm.reset();
    fillCurrentDateTime();
    formMessage.textContent = "Sinais vitais registrados com sucesso.";
  } catch (error) {
    formMessage.textContent = error.message;
  } finally {
    submitButton.disabled = false;
  }
});

currentDateElement.textContent = new Intl.DateTimeFormat("pt-BR", { dateStyle: "full" }).format(new Date());
fillCurrentDateTime();

PatientContext.ready().then((id) => {
  patientId = id;
  if (!patientId) {
    formMessage.textContent = "Cadastre um paciente em \"Paciente\" para começar.";
    submitButton.disabled = true;
  }
});
