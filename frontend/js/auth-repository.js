const AuthRepository = (() => {
  const API_URL = "http://localhost:3000/api/auth";

  async function request(path, data) {
    const response = await fetch(`${API_URL}/${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(body.details ? Object.values(body.details)[0] : body.error || "Falha ao acessar a API");
    }
    return body.data;
  }

  async function signUp(data) { return request("signup", data); }
  async function logIn(data) { return request("login", data); }

  return Object.freeze({ logIn, signUp });
})();
