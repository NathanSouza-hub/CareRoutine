(() => {
  const STORAGE_KEY = "loreroutine:sidebarCollapsed";
  const appShell = document.querySelector(".app-shell");
  const button = document.querySelector("#sidebar-toggle-button");
  if (!appShell || !button) return;

  function apply(collapsed) {
    appShell.classList.toggle("app-shell--sidebar-collapsed", collapsed);
  }

  apply(localStorage.getItem(STORAGE_KEY) === "true");

  button.addEventListener("click", () => {
    const collapsed = !appShell.classList.contains("app-shell--sidebar-collapsed");
    apply(collapsed);
    localStorage.setItem(STORAGE_KEY, String(collapsed));
  });
})();
