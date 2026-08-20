const AuthContext = (() => {
  const STORAGE_KEY = "careroutine:token";
  const USER_STORAGE_KEY = "careroutine:userName";

  function getToken() {
    return localStorage.getItem(STORAGE_KEY) || null;
  }

  function getUserName() {
    return localStorage.getItem(USER_STORAGE_KEY) || "";
  }

  function setSession(token, userName) {
    localStorage.setItem(STORAGE_KEY, token);
    if (userName) localStorage.setItem(USER_STORAGE_KEY, userName);
  }

  function authHeader() {
    const token = getToken();
    return token ? { Authorization: `Bearer ${token}` } : {};
  }

  function logout() {
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(USER_STORAGE_KEY);
    localStorage.removeItem("careroutine:patientId");
    location.href = "login.html";
  }

  if (!getToken()) {
    location.href = "login.html";
  }

  document.addEventListener("DOMContentLoaded", () => {
    const userLabel = document.querySelector("#sidebar-user");
    if (userLabel) userLabel.textContent = getUserName();

    const logoutButton = document.querySelector("#logout-button");
    if (logoutButton) logoutButton.addEventListener("click", logout);
  });

  return Object.freeze({ authHeader, getToken, getUserName, logout, setSession });
})();
