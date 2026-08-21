const profileGrid = document.querySelector("#profile-grid");
const emptyProfiles = document.querySelector("#empty-profiles");
const message = document.querySelector("#message");

function initials(name) {
  const parts = name.trim().split(/\s+/);
  const first = parts[0][0] || "";
  const last = parts.length > 1 ? parts[parts.length - 1][0] : "";
  return (first + last).toUpperCase();
}

function profileButton(profile) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "profile-avatar";

  const circle = document.createElement("span");
  circle.className = "profile-avatar__circle";
  circle.style.background = profile.avatarColor;
  circle.textContent = initials(profile.name);

  const name = document.createElement("span");
  name.className = "profile-avatar__name";
  name.textContent = profile.name;

  button.append(circle, name);
  button.addEventListener("click", () => {
    CaregiverContext.setCurrent(profile);
    location.href = "index.html";
  });
  return button;
}

async function loadProfiles() {
  try {
    const profiles = await CaregiverProfilesRepository.getAll();
    profileGrid.replaceChildren();
    emptyProfiles.hidden = profiles.length > 0;
    profiles.forEach((profile) => profileGrid.append(profileButton(profile)));
  } catch (error) {
    message.textContent = error.message;
  }
}

loadProfiles();
