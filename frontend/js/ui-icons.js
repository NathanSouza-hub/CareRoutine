(() => {
  const NAV_ICONS = {
    "index.html": "home",
    "pacientes.html": "user",
    "sinais-vitais.html": "heartPulse",
    "medicamentos.html": "pill",
    "atividades.html": "clipboardList",
    "anotacoes-enfermagem.html": "notebookPen",
    "agenda.html": "calendarDays",
    "historico.html": "history",
  };

  function fillIcon(selector, name) {
    document.querySelectorAll(selector).forEach((el) => { el.innerHTML = ICONS[name] || ""; });
  }

  fillIcon(".brand__icon", "heart");
  fillIcon(".sidebar-bottom-card__icon", "heart");
  fillIcon(".footer-heart", "heart");
  fillIcon(".notifications__bell-icon", "bell");

  document.querySelectorAll("[data-icon]").forEach((el) => {
    el.innerHTML = ICONS[el.dataset.icon] || "";
  });

  const toggleButton = document.querySelector("#sidebar-toggle-button");
  if (toggleButton) toggleButton.innerHTML = ICONS.menu;

  document.querySelectorAll(".nav-link").forEach((link) => {
    const iconName = NAV_ICONS[link.getAttribute("href")];
    if (!iconName) return;
    const label = link.textContent.trim();
    link.innerHTML = `${icon(iconName)}<span class="nav-link__label">${label}</span>`;
  });

  function initials(name) {
    if (!name) return "?";
    const parts = name.trim().split(/\s+/);
    const first = parts[0][0] || "";
    const last = parts.length > 1 ? parts[parts.length - 1][0] : "";
    return (first + last).toUpperCase();
  }

  const avatarEl = document.querySelector("#sidebar-user-avatar");
  const nameEl = document.querySelector("#sidebar-user-name");
  if (avatarEl && nameEl && window.AuthContext) {
    const userName = AuthContext.getUserName();
    nameEl.textContent = userName;
    const avatar = AuthContext.getAvatar();
    if (avatar) {
      avatarEl.innerHTML = "";
      const img = document.createElement("img");
      img.src = avatar;
      img.alt = "";
      avatarEl.append(img);
    } else {
      avatarEl.textContent = initials(userName);
    }
  }
})();
