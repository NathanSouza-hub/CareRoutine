const RoutinesRepository = (() => {
  const API_URL = "http://localhost:3000/api/routines";
  async function request(url, options = {}) {
    const response = await fetch(url, { headers: { "Content-Type": "application/json" }, ...options });
    if (!response.ok) {
      const body = await response.json().catch(() => ({}));
      throw new Error(body.details ? Object.values(body.details)[0] : body.error || "Falha ao acessar a API");
    }
    if (response.status === 204) return null;
    return response.json();
  }
  async function getAll() { return (await request(API_URL)).data; }
  async function create(data) { return request(API_URL, { method: "POST", body: JSON.stringify(data) }); }
  async function update(id, data) { return request(`${API_URL}/${id}`, { method: "PUT", body: JSON.stringify(data) }); }
  async function remove(id) { return request(`${API_URL}/${id}`, { method: "DELETE" }); }
  async function getDaily(date) { return (await request(`${API_URL}/daily?date=${encodeURIComponent(date)}`)).data; }
  async function setCompletion(id, data) { return request(`${API_URL}/${id}/completion`, { method: "PATCH", body: JSON.stringify(data) }); }
  return Object.freeze({ create, getAll, getDaily, remove, setCompletion, update });
})();
