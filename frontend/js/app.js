const currentDateElement = document.querySelector("#current-date");
const feedbackElement = document.querySelector("#feedback");
const moduleButtons = document.querySelectorAll("[data-module]");

const today = new Intl.DateTimeFormat("pt-BR", {
  dateStyle: "full",
}).format(new Date());

currentDateElement.textContent = today;

moduleButtons.forEach((button) => {
  button.addEventListener("click", () => {
    const moduleName = button.dataset.module;
    feedbackElement.textContent =
      `O módulo ${moduleName} será desenvolvido em uma próxima etapa.`;
  });
});
