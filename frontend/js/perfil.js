const tabButtons = document.querySelectorAll("[data-tab]");
const tabSections = {
  cadastro: document.querySelector("#tab-cadastro"),
  senha: document.querySelector("#tab-senha"),
  info: document.querySelector("#tab-info"),
  foto: document.querySelector("#tab-foto"),
};

const profileForm = document.querySelector("#profile-form");
const profileMessage = document.querySelector("#profile-message");
const passwordForm = document.querySelector("#password-form");
const passwordMessage = document.querySelector("#password-message");
const infoForm = document.querySelector("#info-form");
const infoMessage = document.querySelector("#info-message");
const avatarInput = document.querySelector("#avatar-input");
const avatarPreview = document.querySelector("#avatar-preview");
const avatarMessage = document.querySelector("#avatar-message");
const removeAvatarButton = document.querySelector("#remove-avatar-button");

function showTab(name) {
  Object.entries(tabSections).forEach(([key, section]) => { section.hidden = key !== name; });
  tabButtons.forEach((btn) => btn.classList.toggle("tab-button--active", btn.dataset.tab === name));
}

tabButtons.forEach((btn) => btn.addEventListener("click", () => showTab(btn.dataset.tab)));

function renderAvatarPreview(dataUrl) {
  avatarPreview.replaceChildren();
  if (dataUrl) {
    const img = document.createElement("img");
    img.src = dataUrl;
    img.alt = "";
    avatarPreview.append(img);
  } else {
    avatarPreview.textContent = "Sem foto";
  }
}

function resizeImage(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Não foi possível ler o arquivo"));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error("Arquivo de imagem inválido"));
      img.onload = () => {
        const maxSize = 320;
        const scale = Math.min(1, maxSize / Math.max(img.width, img.height));
        const canvas = document.createElement("canvas");
        canvas.width = Math.round(img.width * scale);
        canvas.height = Math.round(img.height * scale);
        canvas.getContext("2d").drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL("image/jpeg", 0.85));
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}

async function loadProfile() {
  const profile = await AuthRepository.getProfile();
  profileForm.elements.name.value = profile.name;
  profileForm.elements.email.value = profile.email;
  infoForm.elements.phone.value = profile.phone || "";
  AuthContext.setAvatar(profile.avatarData || null);
  renderAvatarPreview(profile.avatarData || null);
}

profileForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const submitButton = document.querySelector("#profile-submit");
  submitButton.disabled = true;
  profileMessage.textContent = "Salvando...";
  try {
    const data = Object.fromEntries(new FormData(profileForm).entries());
    const updated = await AuthRepository.updateProfile(data);
    AuthContext.setUserName(updated.name);
    location.reload();
  } catch (error) {
    profileMessage.textContent = error.message;
    submitButton.disabled = false;
  }
});

passwordForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const data = Object.fromEntries(new FormData(passwordForm).entries());
  if (data.newPassword !== data.confirmNewPassword) {
    passwordMessage.textContent = "As senhas não coincidem.";
    return;
  }
  const submitButton = document.querySelector("#password-submit");
  submitButton.disabled = true;
  passwordMessage.textContent = "Salvando...";
  try {
    await AuthRepository.changePassword(data);
    passwordForm.reset();
    passwordMessage.textContent = "Senha atualizada.";
  } catch (error) {
    passwordMessage.textContent = error.message;
  } finally {
    submitButton.disabled = false;
  }
});

infoForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const submitButton = document.querySelector("#info-submit");
  submitButton.disabled = true;
  infoMessage.textContent = "Salvando...";
  try {
    await AuthRepository.updateProfile(Object.fromEntries(new FormData(infoForm).entries()));
    infoMessage.textContent = "Informações atualizadas.";
  } catch (error) {
    infoMessage.textContent = error.message;
  } finally {
    submitButton.disabled = false;
  }
});

avatarInput.addEventListener("change", async () => {
  const file = avatarInput.files[0];
  if (!file) return;
  avatarMessage.textContent = "Enviando foto...";
  try {
    const dataUrl = await resizeImage(file);
    renderAvatarPreview(dataUrl);
    await AuthRepository.updateAvatar(dataUrl);
    AuthContext.setAvatar(dataUrl);
    avatarMessage.textContent = "Foto atualizada.";
  } catch (error) {
    avatarMessage.textContent = error.message;
  } finally {
    avatarInput.value = "";
  }
});

removeAvatarButton.addEventListener("click", async () => {
  avatarMessage.textContent = "Removendo foto...";
  try {
    await AuthRepository.updateAvatar(null);
    AuthContext.setAvatar(null);
    renderAvatarPreview(null);
    avatarMessage.textContent = "Foto removida.";
  } catch (error) {
    avatarMessage.textContent = error.message;
  }
});

document.querySelector("#current-date").textContent = new Intl.DateTimeFormat("pt-BR", { dateStyle: "full" }).format(new Date());

const initialTab = new URLSearchParams(location.search).get("tab");
showTab(tabSections[initialTab] ? initialTab : "cadastro");

loadProfile().catch((error) => { profileMessage.textContent = `${error.message}. Verifique se a API está ativa.`; });
