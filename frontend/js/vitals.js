const currentDateElement = document.querySelector("#current-date");
const vitalsForm = document.querySelector("#vitals-form");
const dateInput = document.querySelector("#date");
const timeInput = document.querySelector("#time");
const shiftInput = document.querySelector("#shift");
const formMessage = document.querySelector("#form-message");

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

if (currentHour >= 6 && currentHour < 12) {
  shiftInput.value = "Manhã";
} else if (currentHour >= 12 && currentHour < 18) {
  shiftInput.value = "Tarde";
} else if (currentHour >= 18) {
  shiftInput.value = "Noite";
} else {
  shiftInput.value = "Madrugada";
}

vitalsForm.addEventListener("submit", (event) => {
  event.preventDefault();
  formMessage.textContent =
    "Dados validados. O armazenamento será implementado na próxima etapa.";
});
