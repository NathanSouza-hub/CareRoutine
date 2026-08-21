# Perfis compartilhados, atribuição e tempo real — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Permitir que uma equipe de 4 a 7 cuidadores use a mesma conta do Lory's Care, cada um se
identificando por um perfil (estilo Netflix, sem senha), com todo registro de ação mostrando quem
fez e quando, e com atualização instantânea entre as telas de todos os cuidadores.

**Architecture:** Nova tabela `caregiver_profiles` (perfis sem senha, presos à conta/`users`
existente). Uma coluna `author_profile_id` (nullable, `ON DELETE SET NULL`) é adicionada às
tabelas que representam uma ação pontual de um cuidador (`vital_signs`,
`medication_administrations`, `routine_completions`, `events`, `nursing_notes`). O perfil ativo é
guardado no `localStorage` do navegador e enviado em todo request via header `X-Profile-Id`; um
middleware novo (`attach-profile`) valida esse header contra a conta autenticada e expõe
`request.profileId` aos controllers, do mesmo jeito que `require-auth` já expõe `request.userId`.
Tempo real é feito com Server-Sent Events: um módulo em memória (`change-bus`) mantém as conexões
abertas por conta e cada controller publica um evento curto (`{resource, action}`) após cada
escrita bem-sucedida; o navegador escuta via `EventSource` e apenas re-executa a função `load*()`
já existente daquela tela.

**Tech Stack:** Node.js + Express + `pg` (backend, já em uso); HTML/CSS/JS puro, sem framework
(frontend, já em uso); Server-Sent Events nativas (`EventSource`), sem biblioteca nova.

**Spec:** `docs/superpowers/specs/2026-08-21-perfis-compartilhados-design.md`

## Global Constraints

- Sem senha/PIN por perfil — a troca de perfil é só uma escolha visual, sem chamada de
  autenticação (do spec, seção 1).
- `author_profile_id` é nullable em toda tabela — nunca bloqueia um registro por falta de perfil
  selecionado (do spec, seção 2 e "decisões em aberto").
- `medications` e `routines` (tabelas de plano/tratamento) **não** recebem `author_profile_id`
  nesta fase — só as tabelas de execução/ação (do spec, seção 2).
- Tempo real via Server-Sent Events, não WebSocket (do spec, seção 3).
- `changeBus.publish` é sempre por `userId` (conta), nunca por `profileId` — todo cuidador da
  mesma conta recebe todo evento (do spec, seção 3, "Escopo do broadcast").
- Todo código novo segue os padrões já existentes no repositório: `repository → service →
  controller → routes` compostos em `backend/src/app.js`; testes com `node:test` e mocks de
  repository (ver `backend/test/routines-service.test.js` como referência); frontend sem build
  step, um arquivo `.js` por tela carregado via `<script>`.

---

## Task 1: `change-bus.js` — barramento de eventos em memória

**Files:**
- Create: `backend/src/realtime/change-bus.js`
- Test: `backend/test/change-bus.test.js`

**Interfaces:**
- Produces: `createChangeBus()` retornando `{ publish(userId, event), subscribe(userId, res),
  unsubscribe(userId, res) }`. `userId` é convertido para `String` internamente. `event` é
  qualquer objeto serializável (`{ resource: string, action: string }`). `res` é qualquer objeto
  com um método `write(chunk)` (na prática, um `http.ServerResponse`, mas o teste usa um stub).

- [ ] **Step 1: Escrever o teste**

Criar `backend/test/change-bus.test.js`:

```javascript
const assert = require("node:assert/strict");
const { describe, it } = require("node:test");
const createChangeBus = require("../src/realtime/change-bus");

function fakeResponse() {
  const writes = [];
  return { writes, write: (chunk) => writes.push(chunk) };
}

describe("change bus", () => {
  it("entrega o evento para quem assinou a mesma conta", () => {
    const bus = createChangeBus();
    const res = fakeResponse();
    bus.subscribe("9", res);
    bus.publish("9", { resource: "vitals", action: "created" });
    assert.equal(res.writes.length, 1);
    assert.match(res.writes[0], /"resource":"vitals"/);
    assert.match(res.writes[0], /^data: /);
  });

  it("nao entrega para uma conta diferente", () => {
    const bus = createChangeBus();
    const res = fakeResponse();
    bus.subscribe("9", res);
    bus.publish("10", { resource: "vitals", action: "created" });
    assert.equal(res.writes.length, 0);
  });

  it("para de entregar depois do unsubscribe", () => {
    const bus = createChangeBus();
    const res = fakeResponse();
    bus.subscribe("9", res);
    bus.unsubscribe("9", res);
    bus.publish("9", { resource: "vitals", action: "created" });
    assert.equal(res.writes.length, 0);
  });

  it("entrega para varios assinantes da mesma conta", () => {
    const bus = createChangeBus();
    const resA = fakeResponse();
    const resB = fakeResponse();
    bus.subscribe("9", resA);
    bus.subscribe("9", resB);
    bus.publish("9", { resource: "medications", action: "updated" });
    assert.equal(resA.writes.length, 1);
    assert.equal(resB.writes.length, 1);
  });

  it("publish sem assinantes nao lanca erro", () => {
    const bus = createChangeBus();
    assert.doesNotThrow(() => bus.publish("999", { resource: "vitals", action: "created" }));
  });
});
```

- [ ] **Step 2: Rodar o teste e confirmar que falha**

Run: `cd backend && node --test test/change-bus.test.js`
Expected: FAIL — `Cannot find module '../src/realtime/change-bus'`

- [ ] **Step 3: Implementar `change-bus.js`**

Criar `backend/src/realtime/change-bus.js`:

```javascript
function createChangeBus() {
  const subscribers = new Map();

  function subscribe(userId, res) {
    const key = String(userId);
    if (!subscribers.has(key)) subscribers.set(key, new Set());
    subscribers.get(key).add(res);
  }

  function unsubscribe(userId, res) {
    const key = String(userId);
    const set = subscribers.get(key);
    if (!set) return;
    set.delete(res);
    if (set.size === 0) subscribers.delete(key);
  }

  function publish(userId, event) {
    const set = subscribers.get(String(userId));
    if (!set) return;
    const payload = `data: ${JSON.stringify(event)}\n\n`;
    for (const res of set) res.write(payload);
  }

  return Object.freeze({ publish, subscribe, unsubscribe });
}

module.exports = createChangeBus;
```

- [ ] **Step 4: Rodar o teste e confirmar que passa**

Run: `cd backend && node --test test/change-bus.test.js`
Expected: PASS — 5 testes.

- [ ] **Step 5: Commit**

```bash
git add backend/src/realtime/change-bus.js backend/test/change-bus.test.js
git commit -m "feat: adiciona barramento de eventos em memoria para tempo real"
```

---

## Task 2: Rota SSE `/api/stream`

**Files:**
- Modify: `backend/src/app.js`

**Interfaces:**
- Consumes: `createChangeBus()` (Task 1), `authService.verifyToken(token)` (já existe em
  `backend/src/services/auth-service.js:103`, lança `AuthenticationError` se inválido).
- Produces: instância `changeBus` exportada do módulo (`module.exports.changeBus`, além do
  `app` que já é exportado) — as próximas tasks importam `changeBus` de `./app` para chamar
  `.publish(...)` dentro dos controllers.

- [ ] **Step 1: Adicionar a rota e expor `changeBus`**

Em `backend/src/app.js`, adicionar o `require` no topo (junto dos outros):

```javascript
const createChangeBus = require("./realtime/change-bus");
```

Depois da linha `const app = express();`, adicionar:

```javascript
const changeBus = createChangeBus();
```

Antes de `app.get("/health", ...)`, adicionar a rota:

```javascript
app.get("/api/stream", (request, response) => {
  let userId;
  try {
    ({ userId } = authService.verifyToken(request.query.token));
  } catch (error) {
    response.status(401).end();
    return;
  }

  response.set({
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    Connection: "keep-alive",
  });
  response.flushHeaders();
  response.write("retry: 3000\n\n");

  changeBus.subscribe(userId, response);
  request.on("close", () => changeBus.unsubscribe(userId, response));
});
```

No final do arquivo, trocar `module.exports = app;` por:

```javascript
module.exports = app;
module.exports.changeBus = changeBus;
```

- [ ] **Step 2: Testar manualmente**

Run (dois terminais):
```bash
cd backend && npm run dev
```
Em outro terminal, com um token válido obtido via login:
```bash
curl -N "http://localhost:3000/api/stream?token=SEU_TOKEN_AQUI"
```
Expected: a conexão fica aberta (não retorna), sem erro. `Ctrl+C` encerra sem travar o servidor.

- [ ] **Step 3: Rodar a suíte de testes existente para garantir que nada quebrou**

Run: `cd backend && npm test`
Expected: PASS — todos os testes que já existiam continuam passando (a rota nova não tem teste
automatizado próprio porque depende de uma conexão HTTP de streaming; a verificação manual do
Step 2 é suficiente aqui).

- [ ] **Step 4: Commit**

```bash
git add backend/src/app.js
git commit -m "feat: adiciona rota SSE /api/stream para atualizacao em tempo real"
```

---

## Task 3: Migration da tabela `caregiver_profiles`

**Files:**
- Create: `backend/database/migrations/015_create_caregiver_profiles.sql`

- [ ] **Step 1: Escrever a migration**

```sql
SET client_encoding TO 'UTF8';

BEGIN;

CREATE TABLE caregiver_profiles (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name VARCHAR(80) NOT NULL,
  avatar_color VARCHAR(20) NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_caregiver_profiles_user_id ON caregiver_profiles (user_id);

COMMIT;
```

- [ ] **Step 2: Aplicar a migration no banco local**

Run (ajuste usuário/senha conforme `backend/.env`):
```bash
cd backend && PGPASSWORD=$DB_PASSWORD psql -h localhost -p 5432 -U careroutine_app -d careroutine -f database/migrations/015_create_caregiver_profiles.sql
```
Expected: `BEGIN` / `CREATE TABLE` / `CREATE INDEX` / `COMMIT`, sem erro.

- [ ] **Step 3: Confirmar a estrutura da tabela**

Run: `PGPASSWORD=$DB_PASSWORD psql -h localhost -p 5432 -U careroutine_app -d careroutine -c "\d caregiver_profiles"`
Expected: lista as colunas `id, user_id, name, avatar_color, is_active, created_at, updated_at`.

- [ ] **Step 4: Commit**

```bash
git add backend/database/migrations/015_create_caregiver_profiles.sql
git commit -m "feat: adiciona tabela caregiver_profiles"
```

---

## Task 4: Erros de domínio de `caregiver-profiles`

**Files:**
- Create: `backend/src/errors/caregiver-profile-validation-error.js`
- Create: `backend/src/errors/caregiver-profile-not-found-error.js`

**Interfaces:**
- Produces: `CaregiverProfileValidationError` (construtor `(details)`, `.message`, `.details`),
  `CaregiverProfileNotFoundError` (construtor `(message?)`, `.message`) — mesmo formato de
  `backend/src/errors/medication-validation-error.js` e
  `backend/src/errors/medication-not-found-error.js`.

- [ ] **Step 1: Criar os dois arquivos de erro**

`backend/src/errors/caregiver-profile-validation-error.js`:

```javascript
class CaregiverProfileValidationError extends Error {
  constructor(details) {
    super("Dados do cuidador inválidos");
    this.name = "CaregiverProfileValidationError";
    this.details = details;
  }
}

module.exports = CaregiverProfileValidationError;
```

`backend/src/errors/caregiver-profile-not-found-error.js`:

```javascript
class CaregiverProfileNotFoundError extends Error {
  constructor(message = "Cuidador não encontrado") {
    super(message);
    this.name = "CaregiverProfileNotFoundError";
  }
}

module.exports = CaregiverProfileNotFoundError;
```

- [ ] **Step 2: Confirmar que os módulos carregam sem erro**

Run: `cd backend && node -e "require('./src/errors/caregiver-profile-validation-error'); require('./src/errors/caregiver-profile-not-found-error'); console.log('ok')"`
Expected: imprime `ok`.

- [ ] **Step 3: Commit**

```bash
git add backend/src/errors/caregiver-profile-validation-error.js backend/src/errors/caregiver-profile-not-found-error.js
git commit -m "feat: adiciona erros de dominio de caregiver-profiles"
```

---

## Task 5: `caregiver-profiles-repository.js`

**Files:**
- Create: `backend/src/repositories/caregiver-profiles-repository.js`

**Interfaces:**
- Produces: `{ create(profile), getAll(userId), update(id, profile, userId), remove(id, userId),
  belongsToUser(profileId, userId) }`. `profile` é `{ name, avatarColor, userId? }`.
  `belongsToUser` é usado pelo middleware `attach-profile` (Task 8) e retorna `boolean`.

- [ ] **Step 1: Implementar o repository**

```javascript
const pool = require("../config/database");

const PUBLIC_FIELDS = `id, name, avatar_color AS "avatarColor", is_active AS "isActive"`;

async function getAll(userId) {
  const result = await pool.query(
    `SELECT ${PUBLIC_FIELDS} FROM caregiver_profiles
     WHERE user_id = $1 ORDER BY is_active DESC, name`,
    [userId],
  );
  return result.rows;
}

async function create(profile) {
  const result = await pool.query(
    `INSERT INTO caregiver_profiles (name, avatar_color, user_id)
     VALUES ($1, $2, $3) RETURNING ${PUBLIC_FIELDS}`,
    [profile.name, profile.avatarColor, profile.userId],
  );
  return result.rows[0];
}

async function update(id, profile, userId) {
  const result = await pool.query(
    `UPDATE caregiver_profiles SET name = $1, avatar_color = $2, is_active = $3,
       updated_at = CURRENT_TIMESTAMP
     WHERE id = $4 AND user_id = $5 RETURNING ${PUBLIC_FIELDS}`,
    [profile.name, profile.avatarColor, profile.isActive, id, userId],
  );
  return result.rows[0] ?? null;
}

async function remove(id, userId) {
  const result = await pool.query(
    "DELETE FROM caregiver_profiles WHERE id = $1 AND user_id = $2 RETURNING id",
    [id, userId],
  );
  return result.rowCount > 0;
}

async function belongsToUser(profileId, userId) {
  const result = await pool.query(
    "SELECT 1 FROM caregiver_profiles WHERE id = $1 AND user_id = $2",
    [profileId, userId],
  );
  return result.rowCount > 0;
}

module.exports = Object.freeze({ belongsToUser, create, getAll, remove, update });
```

- [ ] **Step 2: Confirmar que o módulo carrega sem erro**

Run: `cd backend && node -e "require('./src/repositories/caregiver-profiles-repository'); console.log('ok')"`
Expected: imprime `ok`.

- [ ] **Step 3: Commit**

```bash
git add backend/src/repositories/caregiver-profiles-repository.js
git commit -m "feat: adiciona repository de caregiver-profiles"
```

---

## Task 6: `caregiver-profiles-service.js` + testes

**Files:**
- Create: `backend/src/services/caregiver-profiles-service.js`
- Test: `backend/test/caregiver-profiles-service.test.js`

**Interfaces:**
- Consumes: repository de Task 5 (`create, getAll, remove, update`, injetado por parâmetro,
  mesmo padrão de `createRoutinesService(repository)`).
- Produces: `createCaregiverProfilesService(repository)` retornando `{ create(input, userId),
  getAll(userId), update(id, input, userId), remove(id, userId) }`. `create`/`update` lançam
  `CaregiverProfileValidationError`; `update`/`remove` lançam `CaregiverProfileNotFoundError`
  quando o id não pertence à conta.

- [ ] **Step 1: Escrever os testes**

Criar `backend/test/caregiver-profiles-service.test.js`, seguindo o padrão de
`backend/test/routines-service.test.js`:

```javascript
const assert = require("node:assert/strict");
const { describe, it } = require("node:test");
const CaregiverProfileNotFoundError = require("../src/errors/caregiver-profile-not-found-error");
const CaregiverProfileValidationError = require("../src/errors/caregiver-profile-validation-error");
const createCaregiverProfilesService = require("../src/services/caregiver-profiles-service");

function validProfile(overrides = {}) {
  return { name: "Maria", avatarColor: "#176B87", ...overrides };
}

describe("caregiver profiles service", () => {
  it("normaliza e cadastra um cuidador", async () => {
    let received;
    const service = createCaregiverProfilesService({
      async create(data) { received = data; return { id: "1", ...data }; },
    });
    const result = await service.create(validProfile(), "9");
    assert.equal(received.name, "Maria");
    assert.equal(received.userId, "9");
    assert.equal(result.id, "1");
  });

  it("rejeita nome vazio", async () => {
    const service = createCaregiverProfilesService({ create: async () => assert.fail() });
    await assert.rejects(
      service.create(validProfile({ name: "" }), "9"),
      CaregiverProfileValidationError,
    );
  });

  it("rejeita nome maior que 80 caracteres", async () => {
    const service = createCaregiverProfilesService({ create: async () => assert.fail() });
    await assert.rejects(
      service.create(validProfile({ name: "a".repeat(81) }), "9"),
      CaregiverProfileValidationError,
    );
  });

  it("rejeita cor de avatar vazia", async () => {
    const service = createCaregiverProfilesService({ create: async () => assert.fail() });
    await assert.rejects(
      service.create(validProfile({ avatarColor: "" }), "9"),
      CaregiverProfileValidationError,
    );
  });

  it("lista os cuidadores da conta", async () => {
    const profiles = [{ id: "1", name: "Maria" }];
    const service = createCaregiverProfilesService({ getAll: async () => profiles });
    assert.equal(await service.getAll("9"), profiles);
  });

  it("atualiza um cuidador existente", async () => {
    let receivedId;
    const service = createCaregiverProfilesService({
      async update(id) { receivedId = id; return { id, name: "Maria" }; },
    });
    await service.update("3", validProfile(), "9");
    assert.equal(receivedId, "3");
  });

  it("informa quando o cuidador nao existe ao atualizar", async () => {
    const service = createCaregiverProfilesService({ update: async () => null });
    await assert.rejects(service.update("99", validProfile(), "9"), CaregiverProfileNotFoundError);
  });

  it("informa quando o cuidador nao existe ao remover", async () => {
    const service = createCaregiverProfilesService({ remove: async () => false });
    await assert.rejects(service.remove("99", "9"), CaregiverProfileNotFoundError);
  });
});
```

- [ ] **Step 2: Rodar os testes e confirmar que falham**

Run: `cd backend && node --test test/caregiver-profiles-service.test.js`
Expected: FAIL — `Cannot find module '../src/services/caregiver-profiles-service'`

- [ ] **Step 3: Implementar o service**

```javascript
const CaregiverProfileNotFoundError = require("../errors/caregiver-profile-not-found-error");
const CaregiverProfileValidationError = require("../errors/caregiver-profile-validation-error");

function validateId(value, field = "id") {
  if (!/^\d+$/.test(String(value ?? "")) || value === "0") {
    throw new CaregiverProfileValidationError({ [field]: "Identificador inválido" });
  }
}

function validateProfile(input, editing = false) {
  const details = {};
  const name = typeof input.name === "string" ? input.name.trim() : "";
  const avatarColor = typeof input.avatarColor === "string" ? input.avatarColor.trim() : "";

  if (!name || name.length > 80) details.name = "Informe um nome com até 80 caracteres";
  if (!avatarColor) details.avatarColor = "Escolha uma cor de avatar";
  if (Object.keys(details).length) throw new CaregiverProfileValidationError(details);

  return { name, avatarColor, isActive: editing ? input.isActive !== false : true };
}

function createCaregiverProfilesService(repository) {
  async function create(input, userId) {
    const profile = validateProfile(input ?? {});
    return repository.create({ ...profile, userId });
  }

  async function getAll(userId) {
    return repository.getAll(userId);
  }

  async function update(id, input, userId) {
    validateId(id);
    const updated = await repository.update(id, validateProfile(input ?? {}, true), userId);
    if (!updated) throw new CaregiverProfileNotFoundError();
    return updated;
  }

  async function remove(id, userId) {
    validateId(id);
    if (!(await repository.remove(id, userId))) throw new CaregiverProfileNotFoundError();
  }

  return Object.freeze({ create, getAll, remove, update });
}

module.exports = createCaregiverProfilesService;
```

- [ ] **Step 4: Rodar os testes e confirmar que passam**

Run: `cd backend && node --test test/caregiver-profiles-service.test.js`
Expected: PASS — 8 testes.

- [ ] **Step 5: Commit**

```bash
git add backend/src/services/caregiver-profiles-service.js backend/test/caregiver-profiles-service.test.js
git commit -m "feat: adiciona service de caregiver-profiles"
```

---

## Task 7: Controller, rotas e wiring de `caregiver-profiles`

**Files:**
- Create: `backend/src/controllers/caregiver-profiles-controller.js`
- Create: `backend/src/routes/caregiver-profiles-routes.js`
- Modify: `backend/src/app.js`

**Interfaces:**
- Consumes: service de Task 6; `changeBus` exportado de `./app.js` (Task 2) — **atenção**: como
  `app.js` agora exporta `changeBus` mas o próprio `app.js` é quem monta os controllers, o
  `changeBus` é criado e usado dentro do mesmo arquivo (não há import circular: os controllers
  recebem `changeBus` como parâmetro, não fazem `require("../app")`).
- Produces: rotas `GET/POST /api/caregiver-profiles`, `PUT/DELETE
  /api/caregiver-profiles/:id`, todas atrás de `requireAuth`.

- [ ] **Step 1: Implementar o controller**

`backend/src/controllers/caregiver-profiles-controller.js`:

```javascript
const CaregiverProfileNotFoundError = require("../errors/caregiver-profile-not-found-error");
const CaregiverProfileValidationError = require("../errors/caregiver-profile-validation-error");

function handle(error, response, next) {
  if (error instanceof CaregiverProfileValidationError) response.status(400).json({ error: error.message, details: error.details });
  else if (error instanceof CaregiverProfileNotFoundError) response.status(404).json({ error: error.message });
  else next(error);
}

function createCaregiverProfilesController(service, changeBus) {
  const action = (callback) => async (request, response, next) => {
    try { await callback(request, response); } catch (error) { handle(error, response, next); }
  };
  return Object.freeze({
    getAll: action(async (request, response) => response.json({ data: await service.getAll(request.userId) })),
    create: action(async (request, response) => {
      const data = await service.create(request.body, request.userId);
      changeBus.publish(request.userId, { resource: "caregiver-profiles", action: "created" });
      response.status(201).json({ data });
    }),
    update: action(async (request, response) => {
      const data = await service.update(request.params.id, request.body, request.userId);
      changeBus.publish(request.userId, { resource: "caregiver-profiles", action: "updated" });
      response.json({ data });
    }),
    remove: action(async (request, response) => {
      await service.remove(request.params.id, request.userId);
      changeBus.publish(request.userId, { resource: "caregiver-profiles", action: "removed" });
      response.status(204).send();
    }),
  });
}

module.exports = createCaregiverProfilesController;
```

- [ ] **Step 2: Implementar as rotas**

`backend/src/routes/caregiver-profiles-routes.js`:

```javascript
const { Router } = require("express");

function createCaregiverProfilesRouter(controller) {
  const router = Router();
  router.get("/", controller.getAll);
  router.post("/", controller.create);
  router.put("/:id", controller.update);
  router.delete("/:id", controller.remove);
  return router;
}

module.exports = createCaregiverProfilesRouter;
```

- [ ] **Step 3: Conectar em `app.js`**

Adicionar os `require`s no topo de `backend/src/app.js` (junto dos outros):

```javascript
const createCaregiverProfilesController = require("./controllers/caregiver-profiles-controller");
const caregiverProfilesRepository = require("./repositories/caregiver-profiles-repository");
const createCaregiverProfilesRouter = require("./routes/caregiver-profiles-routes");
const createCaregiverProfilesService = require("./services/caregiver-profiles-service");
```

Depois do bloco de `nursingNotesService`/`nursingNotesController`/`app.use("/api/nursing-notes", ...)`, adicionar:

```javascript
const caregiverProfilesService = createCaregiverProfilesService(caregiverProfilesRepository);
const caregiverProfilesController = createCaregiverProfilesController(caregiverProfilesService, changeBus);
app.use("/api/caregiver-profiles", requireAuth, createCaregiverProfilesRouter(caregiverProfilesController));
```

(Isso deve ficar **depois** da linha `const changeBus = createChangeBus();` adicionada na Task 2.)

- [ ] **Step 4: Testar manualmente**

Run: `cd backend && npm run dev`, depois em outro terminal (com token válido):
```bash
curl -X POST http://localhost:3000/api/caregiver-profiles \
  -H "Authorization: Bearer SEU_TOKEN" -H "Content-Type: application/json" \
  -d '{"name":"Maria","avatarColor":"#176B87"}'
curl http://localhost:3000/api/caregiver-profiles -H "Authorization: Bearer SEU_TOKEN"
```
Expected: primeiro comando retorna `201` com `{"data":{"id":"1","name":"Maria",...}}`; segundo
retorna `200` com a lista contendo esse registro.

- [ ] **Step 5: Rodar a suíte completa**

Run: `cd backend && npm test`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add backend/src/controllers/caregiver-profiles-controller.js backend/src/routes/caregiver-profiles-routes.js backend/src/app.js
git commit -m "feat: expoe API de caregiver-profiles"
```

---

## Task 8: Middleware `attach-profile`

**Files:**
- Create: `backend/src/middleware/attach-profile.js`
- Test: `backend/test/attach-profile.test.js`
- Modify: `backend/src/app.js`

**Interfaces:**
- Consumes: `caregiverProfilesRepository.belongsToUser(profileId, userId)` (Task 5).
- Produces: `createAttachProfile(caregiverProfilesRepository)` retornando um middleware Express
  que define `request.profileId` como `string` (id validado) ou `null` (header ausente). Se o
  header vier preenchido mas não pertencer à conta, responde `400` e não chama `next()`.
  Middleware Express real recebe `(request, response, next)`, mas para testar sem subir um
  servidor HTTP inteiro os testes chamam a função diretamente com objetos `request`/`response`
  simulados — mesmo estilo usado para outros middlewares neste repositório (ver
  `backend/src/middleware/require-auth.js`, que não tem teste próprio hoje; este é o primeiro
  middleware do projeto a ganhar um teste dedicado, então o padrão é nosso a definir e deve
  seguir o mesmo estilo dos testes de service: mocks simples, sem framework de teste HTTP).

- [ ] **Step 1: Escrever o teste**

`backend/test/attach-profile.test.js`:

```javascript
const assert = require("node:assert/strict");
const { describe, it } = require("node:test");
const createAttachProfile = require("../src/middleware/attach-profile");

function fakeResponse() {
  const response = { statusCode: null, body: null };
  response.status = (code) => { response.statusCode = code; return response; };
  response.json = (body) => { response.body = body; return response; };
  return response;
}

describe("attach profile middleware", () => {
  it("define profileId como null quando o header nao vem", async () => {
    const attachProfile = createAttachProfile({ belongsToUser: async () => assert.fail() });
    const request = { headers: {}, userId: "9" };
    let calledNext = false;
    await attachProfile(request, fakeResponse(), () => { calledNext = true; });
    assert.equal(request.profileId, null);
    assert.ok(calledNext);
  });

  it("define profileId quando o header pertence a conta", async () => {
    const attachProfile = createAttachProfile({ belongsToUser: async () => true });
    const request = { headers: { "x-profile-id": "3" }, userId: "9" };
    let calledNext = false;
    await attachProfile(request, fakeResponse(), () => { calledNext = true; });
    assert.equal(request.profileId, "3");
    assert.ok(calledNext);
  });

  it("rejeita com 400 quando o perfil nao pertence a conta", async () => {
    const attachProfile = createAttachProfile({ belongsToUser: async () => false });
    const request = { headers: { "x-profile-id": "3" }, userId: "9" };
    const response = fakeResponse();
    let calledNext = false;
    await attachProfile(request, response, () => { calledNext = true; });
    assert.equal(response.statusCode, 400);
    assert.equal(calledNext, false);
  });

  it("rejeita com 400 quando o header nao e numerico", async () => {
    const attachProfile = createAttachProfile({ belongsToUser: async () => assert.fail() });
    const request = { headers: { "x-profile-id": "abc" }, userId: "9" };
    const response = fakeResponse();
    await attachProfile(request, response, () => assert.fail());
    assert.equal(response.statusCode, 400);
  });
});
```

- [ ] **Step 2: Rodar o teste e confirmar que falha**

Run: `cd backend && node --test test/attach-profile.test.js`
Expected: FAIL — `Cannot find module '../src/middleware/attach-profile'`

- [ ] **Step 3: Implementar o middleware**

`backend/src/middleware/attach-profile.js`:

```javascript
function createAttachProfile(caregiverProfilesRepository) {
  return async function attachProfile(request, response, next) {
    try {
      const header = request.headers["x-profile-id"];
      if (!header) {
        request.profileId = null;
        return next();
      }
      if (!/^\d+$/.test(header)) {
        return response.status(400).json({ error: "Perfil inválido" });
      }
      if (!(await caregiverProfilesRepository.belongsToUser(header, request.userId))) {
        return response.status(400).json({ error: "Perfil inválido" });
      }
      request.profileId = header;
      next();
    } catch (error) {
      next(error);
    }
  };
}

module.exports = createAttachProfile;
```

- [ ] **Step 4: Rodar o teste e confirmar que passa**

Run: `cd backend && node --test test/attach-profile.test.js`
Expected: PASS — 4 testes.

- [ ] **Step 5: Conectar em `app.js` nas 5 rotas que precisam de atribuição**

Em `backend/src/app.js`, adicionar o `require`:

```javascript
const createAttachProfile = require("./middleware/attach-profile");
```

Depois da linha `const requireAuth = createRequireAuth(authService);`, adicionar:

```javascript
const attachProfile = createAttachProfile(caregiverProfilesRepository);
```

(Isso precisa vir **depois** do `require("./repositories/caregiver-profiles-repository")` já
adicionado na Task 7 — mova o require de `caregiverProfilesRepository` para o topo do arquivo,
junto dos demais, se ainda não estiver lá.)

Trocar as 5 linhas de `app.use` das rotas que recebem atribuição, adicionando `attachProfile`
depois de `requireAuth`:

```javascript
app.use("/api/vitals", requireAuth, attachProfile, createVitalsRouter(vitalsController));
app.use("/api/medications", requireAuth, attachProfile, createMedicationsRouter(medicationsController));
app.use("/api/routines", requireAuth, attachProfile, createRoutinesRouter(routinesController));
app.use("/api/events", requireAuth, attachProfile, createEventsRouter(eventsController));
app.use("/api/nursing-notes", requireAuth, attachProfile, createNursingNotesRouter(nursingNotesController));
```

`/api/patients` e `/api/caregiver-profiles` **não** recebem `attachProfile` (não têm ação
atribuível nesta fase).

- [ ] **Step 6: Rodar a suíte completa**

Run: `cd backend && npm test`
Expected: PASS — os testes de controller/service existentes não usam `request.profileId`, então
continuam passando sem alteração.

- [ ] **Step 7: Commit**

```bash
git add backend/src/middleware/attach-profile.js backend/test/attach-profile.test.js backend/src/app.js
git commit -m "feat: adiciona middleware attach-profile para atribuicao de autoria"
```

---

## Task 9: Atribuição em sinais vitais

**Files:**
- Create: `backend/database/migrations/016_add_author_profile_id_to_vital_signs.sql`
- Modify: `backend/src/repositories/vitals-repository.js`
- Modify: `backend/src/services/vitals-service.js`
- Modify: `backend/src/controllers/vitals-controller.js`
- Test: `backend/test/vitals-service.test.js`, `backend/test/vitals-controller.test.js`

**Interfaces:**
- Consumes: `request.profileId` (Task 8), `changeBus` (Task 2).
- Produces: `vitalsService.create(input, userId, profileId)` — assinatura ganha o 3º parâmetro;
  `update`/`getAll`/`remove` mantêm a assinatura atual (autoria não é reatribuída na edição).
  Toda linha retornada por `getAll` passa a incluir `authorProfileId` e `authorProfileName`
  (nullable).

- [ ] **Step 1: Migration**

```sql
SET client_encoding TO 'UTF8';

BEGIN;

ALTER TABLE vital_signs ADD COLUMN author_profile_id BIGINT REFERENCES caregiver_profiles(id) ON DELETE SET NULL;

COMMIT;
```

Aplicar: `cd backend && PGPASSWORD=$DB_PASSWORD psql -h localhost -p 5432 -U careroutine_app -d careroutine -f database/migrations/016_add_author_profile_id_to_vital_signs.sql`

- [ ] **Step 2: Escrever o teste de service (adicionar ao arquivo existente)**

Em `backend/test/vitals-service.test.js`, adicionar (dentro do `describe` existente, olhando o
teste `"valida, transforma e envia os dados ao repositório"` como referência de estilo):

```javascript
  it("inclui o profileId de quem fez a medicao", async () => {
    let received;
    const service = createVitalsService({
      patientBelongsToUser: async () => true,
      async create(data) { received = data; return { id: "1", ...data }; },
    });
    await service.create(validVitalSigns(), "9", "3");
    assert.equal(received.authorProfileId, "3");
  });

  it("aceita profileId nulo", async () => {
    let received;
    const service = createVitalsService({
      patientBelongsToUser: async () => true,
      async create(data) { received = data; return { id: "1", ...data }; },
    });
    await service.create(validVitalSigns(), "9", null);
    assert.equal(received.authorProfileId, null);
  });
```

(`validVitalSigns()` é a função auxiliar já existente no topo do arquivo — se o nome for
diferente, usar o mesmo helper que os outros testes de `create` já usam nesse arquivo.)

- [ ] **Step 3: Rodar e confirmar que falha**

Run: `cd backend && node --test test/vitals-service.test.js`
Expected: FAIL — `received.authorProfileId` é `undefined`.

- [ ] **Step 4: Atualizar o repository**

Em `backend/src/repositories/vitals-repository.js`, trocar `RETURNING_FIELDS` para incluir a
nova coluna e o nome do perfil (via `LEFT JOIN`), e ajustar `getAll`/`create` para usar o join:

```javascript
const RETURNING_FIELDS = `
  id,
  measured_at AS "measuredAt",
  shift,
  systolic_pressure AS "systolicPressure",
  diastolic_pressure AS "diastolicPressure",
  heart_rate AS "heartRate",
  oxygen_saturation AS "oxygenSaturation",
  temperature::FLOAT AS temperature,
  blood_glucose AS "bloodGlucose",
  notes,
  author_profile_id AS "authorProfileId",
  created_at AS "createdAt",
  updated_at AS "updatedAt"
`;
```

Trocar a função `getAll` inteira por (adiciona o `LEFT JOIN` só aqui, pois é a única consulta
usada para listar/exibir histórico):

```javascript
async function getAll(patientId, userId) {
  const result = await pool.query(`
    SELECT v.id, v.measured_at AS "measuredAt", v.shift,
      v.systolic_pressure AS "systolicPressure", v.diastolic_pressure AS "diastolicPressure",
      v.heart_rate AS "heartRate", v.oxygen_saturation AS "oxygenSaturation",
      v.temperature::FLOAT AS temperature, v.blood_glucose AS "bloodGlucose", v.notes,
      v.author_profile_id AS "authorProfileId", cp.name AS "authorProfileName",
      v.created_at AS "createdAt", v.updated_at AS "updatedAt"
    FROM vital_signs v
    LEFT JOIN caregiver_profiles cp ON cp.id = v.author_profile_id
    WHERE v.patient_id = $1 AND v.patient_id IN (SELECT id FROM patients WHERE user_id = $2)
    ORDER BY v.measured_at DESC
  `, [patientId, userId]);

  return result.rows;
}
```

Na função `create`, adicionar a coluna ao `INSERT`:

```javascript
async function create(vitalSigns) {
  const query = `
    INSERT INTO vital_signs (
      measured_at, shift, systolic_pressure, diastolic_pressure, heart_rate,
      oxygen_saturation, temperature, blood_glucose, notes, patient_id, author_profile_id
    )
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
    RETURNING ${RETURNING_FIELDS}
  `;
  const values = [
    vitalSigns.measuredAt, vitalSigns.shift, vitalSigns.systolicPressure,
    vitalSigns.diastolicPressure, vitalSigns.heartRate, vitalSigns.oxygenSaturation,
    vitalSigns.temperature, vitalSigns.bloodGlucose, vitalSigns.notes,
    vitalSigns.patientId, vitalSigns.authorProfileId,
  ];

  const result = await pool.query(query, values);
  return result.rows[0];
}
```

`update` **não muda** — continua sem tocar em `author_profile_id`, preservando a autoria
original.

- [ ] **Step 5: Atualizar o service**

Em `backend/src/services/vitals-service.js`, dentro de `validateAndMap`, adicionar
`authorProfileId` ao objeto retornado (só quando não é edição):

```javascript
  return {
    measuredAt: `${date}T${time}:00`,
    shift,
    systolicPressure: pressureMatch ? Number(pressureMatch[1]) : null,
    diastolicPressure: pressureMatch ? Number(pressureMatch[2]) : null,
    heartRate,
    oxygenSaturation,
    temperature,
    bloodGlucose,
    notes: notes || null,
    patientId,
  };
```

vira (adicionar como parâmetro extra da função e no retorno):

```javascript
function validateAndMap(input, editing = false) {
  // ... (corpo inalterado até o final) ...

  return {
    measuredAt: `${date}T${time}:00`,
    shift,
    systolicPressure: pressureMatch ? Number(pressureMatch[1]) : null,
    diastolicPressure: pressureMatch ? Number(pressureMatch[2]) : null,
    heartRate,
    oxygenSaturation,
    temperature,
    bloodGlucose,
    notes: notes || null,
    patientId,
  };
}
```

(o objeto de validação continua igual — `authorProfileId` não é validado a partir do `input`,
vem de fora, então é adicionado depois de chamar `validateAndMap`). Trocar a função `create`:

```javascript
  async function create(input, userId, profileId) {
    const vitalSigns = { ...validateAndMap(input ?? {}), authorProfileId: profileId ?? null };
    if (!(await repository.patientBelongsToUser(vitalSigns.patientId, userId))) {
      throw new ValidationError({ patientId: "Paciente não encontrado" });
    }
    return repository.create(vitalSigns);
  }
```

- [ ] **Step 6: Rodar o teste de service e confirmar que passa**

Run: `cd backend && node --test test/vitals-service.test.js`
Expected: PASS.

- [ ] **Step 7: Atualizar o controller para passar `profileId` e publicar no `changeBus`**

`backend/src/controllers/vitals-controller.js` passa a receber `changeBus` como segundo
parâmetro da factory:

```javascript
function createVitalsController(vitalsService, changeBus) {
  async function create(request, response, next) {
    try {
      const vitalSigns = await vitalsService.create(request.body, request.userId, request.profileId);
      changeBus.publish(request.userId, { resource: "vitals", action: "created" });
      response.status(201).json({ data: vitalSigns });
    } catch (error) {
      if (!handleKnownError(error, response)) next(error);
    }
  }

  async function getAll(request, response, next) {
    try {
      const vitalSigns = await vitalsService.getAll(request.query.patientId, request.userId);
      response.status(200).json({ data: vitalSigns });
    } catch (error) {
      if (!handleKnownError(error, response)) next(error);
    }
  }

  async function update(request, response, next) {
    try {
      const vitalSigns = await vitalsService.update(request.params.id, request.body, request.userId);
      changeBus.publish(request.userId, { resource: "vitals", action: "updated" });
      response.status(200).json({ data: vitalSigns });
    } catch (error) {
      if (!handleKnownError(error, response)) next(error);
    }
  }

  async function remove(request, response, next) {
    try {
      await vitalsService.remove(request.params.id, request.userId);
      changeBus.publish(request.userId, { resource: "vitals", action: "removed" });
      response.status(204).send();
    } catch (error) {
      if (!handleKnownError(error, response)) next(error);
    }
  }

  return Object.freeze({ create, getAll, remove, update });
}

module.exports = createVitalsController;
```

Atualizar `backend/test/vitals-controller.test.js`: todo `createVitalsController(vitalsService)`
existente passa a precisar de um segundo argumento fake, ex.: `createVitalsController(vitalsService,
{ publish: () => {} })`. Ajustar cada chamada no arquivo de teste.

Em `backend/src/app.js`, trocar a linha `const vitalsController =
createVitalsController(vitalsService);` por:

```javascript
const vitalsController = createVitalsController(vitalsService, changeBus);
```

(mover a criação de `vitalsController`/`app.use("/api/vitals", ...)` para **depois** da linha
`const changeBus = createChangeBus();`, se ainda vier antes no arquivo.)

- [ ] **Step 8: Rodar a suíte completa**

Run: `cd backend && npm test`
Expected: PASS.

- [ ] **Step 9: Commit**

```bash
git add backend/database/migrations/016_add_author_profile_id_to_vital_signs.sql backend/src/repositories/vitals-repository.js backend/src/services/vitals-service.js backend/src/controllers/vitals-controller.js backend/test/vitals-service.test.js backend/test/vitals-controller.test.js backend/src/app.js
git commit -m "feat: atribui autoria e tempo real aos sinais vitais"
```

---

## Task 10: Atribuição em doses de medicamento

**Files:**
- Create: `backend/database/migrations/017_add_author_profile_id_to_medication_administrations.sql`
- Modify: `backend/src/repositories/medications-repository.js`
- Modify: `backend/src/services/medications-service.js`
- Modify: `backend/src/controllers/medications-controller.js`
- Test: `backend/test/medications-service.test.js`

**Interfaces:**
- Produces: `medicationsService.setAdministration(medicationId, scheduleId, input, userId,
  profileId)` — ganha o 5º parâmetro. `getDaily` passa a retornar `authorProfileId` +
  `authorProfileName` (quem administrou) em cada dose.

- [ ] **Step 1: Migration**

```sql
SET client_encoding TO 'UTF8';

BEGIN;

ALTER TABLE medication_administrations ADD COLUMN author_profile_id BIGINT REFERENCES caregiver_profiles(id) ON DELETE SET NULL;

COMMIT;
```

Aplicar: `cd backend && PGPASSWORD=$DB_PASSWORD psql -h localhost -p 5432 -U careroutine_app -d careroutine -f database/migrations/017_add_author_profile_id_to_medication_administrations.sql`

- [ ] **Step 2: Escrever o teste de service**

Em `backend/test/medications-service.test.js`, adicionar:

```javascript
  it("inclui o profileId de quem administrou a dose", async () => {
    let received;
    const service = createMedicationsService({
      scheduleBelongsToMedication: async () => true,
      async setAdministration(data) { received = data; return { id: "1" }; },
    });
    await service.setAdministration("3", "5", { date: "2026-08-18", status: "taken" }, "9", "4");
    assert.equal(received.authorProfileId, "4");
  });
```

- [ ] **Step 3: Rodar e confirmar que falha**

Run: `cd backend && node --test test/medications-service.test.js`
Expected: FAIL — `received.authorProfileId` é `undefined`.

- [ ] **Step 4: Atualizar o repository**

Em `backend/src/repositories/medications-repository.js`, na função `getDaily`, adicionar o join
e o campo:

```javascript
async function getDaily(date, patientId, userId) {
  const result = await pool.query(
    `SELECT
       m.id AS "medicationId", m.name, m.dosage, m.instructions,
       s.id AS "scheduleId", to_char(s.scheduled_time, 'HH24:MI') AS time,
       COALESCE(a.status, 'pending') AS status,
       a.administered_at AS "administeredAt", a.notes,
       a.author_profile_id AS "authorProfileId", cp.name AS "authorProfileName"
     FROM medications m
     JOIN medication_schedules s ON s.medication_id = m.id AND s.is_active = TRUE
     LEFT JOIN medication_administrations a
       ON a.schedule_id = s.id AND a.scheduled_date = $1
     LEFT JOIN caregiver_profiles cp ON cp.id = a.author_profile_id
     WHERE m.is_active = TRUE
       AND m.start_date <= $1
       AND (m.end_date IS NULL OR m.end_date >= $1)
       AND m.patient_id = $2
       AND m.patient_id IN (SELECT id FROM patients WHERE user_id = $3)
     ORDER BY s.scheduled_time, m.name`,
    [date, patientId, userId],
  );
  return result.rows;
}
```

Na função `setAdministration`, adicionar a coluna:

```javascript
async function setAdministration(data) {
  const result = await pool.query(
    `INSERT INTO medication_administrations
       (schedule_id, scheduled_date, status, administered_at, notes, author_profile_id)
     VALUES ($1, $2, $3, $4, $5, $6)
     ON CONFLICT (schedule_id, scheduled_date) DO UPDATE SET
       status = EXCLUDED.status,
       administered_at = EXCLUDED.administered_at,
       notes = EXCLUDED.notes,
       author_profile_id = EXCLUDED.author_profile_id,
       updated_at = CURRENT_TIMESTAMP
     RETURNING id, status, administered_at AS "administeredAt", notes, author_profile_id AS "authorProfileId"`,
    [data.scheduleId, data.date, data.status, data.administeredAt, data.notes, data.authorProfileId],
  );
  return result.rows[0];
}
```

- [ ] **Step 5: Atualizar o service**

Em `backend/src/services/medications-service.js`, trocar `setAdministration`:

```javascript
  async function setAdministration(medicationId, scheduleId, input, userId, profileId) {
    validateId(medicationId, "medicationId");
    validateId(scheduleId, "scheduleId");
    const details = {};
    const date = typeof input.date === "string" ? input.date : "";
    const status = input.status;
    const notes = typeof input.notes === "string" ? input.notes.trim() : "";
    if (!isDate(date)) details.date = "Informe uma data válida";
    if (!new Set(["taken", "skipped"]).has(status)) details.status = "Status inválido";
    if (notes.length > 500) details.notes = "Use no máximo 500 caracteres";
    if (Object.keys(details).length) throw new MedicationValidationError(details);
    if (!(await repository.scheduleBelongsToMedication(medicationId, scheduleId, userId))) {
      throw new MedicationNotFoundError("Horário do medicamento não encontrado");
    }
    return repository.setAdministration({
      scheduleId,
      date,
      status,
      administeredAt: status === "taken" ? new Date() : null,
      notes: notes || null,
      authorProfileId: profileId ?? null,
    });
  }
```

- [ ] **Step 6: Rodar o teste de service e confirmar que passa**

Run: `cd backend && node --test test/medications-service.test.js`
Expected: PASS.

- [ ] **Step 7: Atualizar o controller (publica no `changeBus` em todas as mutações)**

`backend/src/controllers/medications-controller.js` ganha `changeBus` na factory:

```javascript
function createMedicationsController(service, changeBus) {
  const action = (callback) => async (request, response, next) => {
    try { await callback(request, response); } catch (error) { handle(error, response, next); }
  };

  return Object.freeze({
    getAll: action(async (request, response) => response.json({ data: await service.getAll(request.query.patientId, request.userId) })),
    create: action(async (request, response) => {
      const data = await service.create(request.body, request.userId);
      changeBus.publish(request.userId, { resource: "medications", action: "created" });
      response.status(201).json({ data });
    }),
    update: action(async (request, response) => {
      await service.update(request.params.id, request.body, request.userId);
      changeBus.publish(request.userId, { resource: "medications", action: "updated" });
      response.status(204).send();
    }),
    remove: action(async (request, response) => {
      await service.remove(request.params.id, request.userId);
      changeBus.publish(request.userId, { resource: "medications", action: "removed" });
      response.status(204).send();
    }),
    getDaily: action(async (request, response) => response.json({ data: await service.getDaily(request.query.date, request.query.patientId, request.userId) })),
    setAdministration: action(async (request, response) => {
      const data = await service.setAdministration(request.params.id, request.params.scheduleId, request.body, request.userId, request.profileId);
      changeBus.publish(request.userId, { resource: "medications", action: "administration-updated" });
      response.json({ data });
    }),
  });
}

module.exports = createMedicationsController;
```

Nota: este controller ainda não tinha arquivo de teste próprio (`medications-controller.test.js`
não existe hoje — só `medications-service.test.js`), então não há suíte de controller a ajustar
aqui, diferente da Task 9.

Em `backend/src/app.js`, trocar:

```javascript
const medicationsController = createMedicationsController(medicationsService, changeBus);
```

- [ ] **Step 8: Rodar a suíte completa**

Run: `cd backend && npm test`
Expected: PASS.

- [ ] **Step 9: Commit**

```bash
git add backend/database/migrations/017_add_author_profile_id_to_medication_administrations.sql backend/src/repositories/medications-repository.js backend/src/services/medications-service.js backend/src/controllers/medications-controller.js backend/test/medications-service.test.js backend/src/app.js
git commit -m "feat: atribui autoria e tempo real as doses de medicamento"
```

---

## Task 11: Atribuição em conclusão de atividades

**Files:**
- Create: `backend/database/migrations/018_add_author_profile_id_to_routine_completions.sql`
- Modify: `backend/src/repositories/routines-repository.js`
- Modify: `backend/src/services/routines-service.js`
- Modify: `backend/src/controllers/routines-controller.js`
- Test: `backend/test/routines-service.test.js`

**Interfaces:**
- Produces: `routinesService.setCompletion(id, input, userId, profileId)` — ganha o 4º
  parâmetro. `getDaily` retorna `authorProfileId` + `authorProfileName` (quem concluiu/marcou).

- [ ] **Step 1: Migration**

```sql
SET client_encoding TO 'UTF8';

BEGIN;

ALTER TABLE routine_completions ADD COLUMN author_profile_id BIGINT REFERENCES caregiver_profiles(id) ON DELETE SET NULL;

COMMIT;
```

Aplicar: `cd backend && PGPASSWORD=$DB_PASSWORD psql -h localhost -p 5432 -U careroutine_app -d careroutine -f database/migrations/018_add_author_profile_id_to_routine_completions.sql`

- [ ] **Step 2: Escrever o teste de service**

Em `backend/test/routines-service.test.js`, adicionar:

```javascript
  it("inclui o profileId de quem concluiu a atividade", async () => {
    let received;
    const service = createRoutinesService({
      existsOnDate: async () => true,
      async setCompletion(data) { received = data; return { id: "1" }; },
    });
    await service.setCompletion("3", { date: "2026-08-18", status: "completed" }, "9", "4");
    assert.equal(received.authorProfileId, "4");
  });
```

- [ ] **Step 3: Rodar e confirmar que falha**

Run: `cd backend && node --test test/routines-service.test.js`
Expected: FAIL — `received.authorProfileId` é `undefined`.

- [ ] **Step 4: Atualizar o repository**

Em `backend/src/repositories/routines-repository.js`, na função `getDaily`:

```javascript
async function getDaily(date, patientId, userId) {
  const result = await pool.query(
    `SELECT r.id, r.title, r.category, to_char(r.scheduled_time, 'HH24:MI') AS time,
      r.notes, r.is_fixed AS "isFixed", COALESCE(c.status, 'pending') AS status, c.completed_at AS "completedAt",
      c.author_profile_id AS "authorProfileId", cp.name AS "authorProfileName"
     FROM routines r
     LEFT JOIN routine_completions c ON c.routine_id = r.id AND c.scheduled_date = $1
     LEFT JOIN caregiver_profiles cp ON cp.id = c.author_profile_id
     WHERE r.is_active = TRUE AND r.start_date <= $1
       AND r.patient_id = $2
       AND r.patient_id IN (SELECT id FROM patients WHERE user_id = $3)
     ORDER BY r.scheduled_time, r.title`,
    [date, patientId, userId],
  );
  return result.rows;
}
```

Na função `setCompletion`:

```javascript
async function setCompletion(data) {
  const result = await pool.query(
    `INSERT INTO routine_completions (routine_id, scheduled_date, status, completed_at, author_profile_id)
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (routine_id, scheduled_date) DO UPDATE SET status = EXCLUDED.status,
       completed_at = EXCLUDED.completed_at, author_profile_id = EXCLUDED.author_profile_id,
       updated_at = CURRENT_TIMESTAMP
     RETURNING id, status, completed_at AS "completedAt", author_profile_id AS "authorProfileId"`,
    [data.routineId, data.date, data.status, data.completedAt, data.authorProfileId],
  );
  return result.rows[0];
}
```

- [ ] **Step 5: Atualizar o service**

Em `backend/src/services/routines-service.js`, trocar `setCompletion`:

```javascript
  async function setCompletion(id, input, userId, profileId) {
    validateId(id);
    const details = {};
    const date = typeof input.date === "string" ? input.date : "";
    const status = input.status;
    if (!isDate(date)) details.date = "Informe uma data válida";
    if (!new Set(["completed", "skipped"]).has(status)) details.status = "Status inválido";
    if (Object.keys(details).length) throw new RoutineValidationError(details);
    if (!(await repository.existsOnDate(id, date, userId))) throw new RoutineNotFoundError("Atividade não encontrada nesta data");
    return repository.setCompletion({
      routineId: id, date, status,
      completedAt: status === "completed" ? new Date() : null,
      authorProfileId: profileId ?? null,
    });
  }
```

- [ ] **Step 6: Rodar o teste de service e confirmar que passa**

Run: `cd backend && node --test test/routines-service.test.js`
Expected: PASS.

- [ ] **Step 7: Atualizar o controller**

`backend/src/controllers/routines-controller.js` ganha `changeBus`:

```javascript
function createRoutinesController(service, changeBus) {
  const action = (callback) => async (request, response, next) => {
    try { await callback(request, response); } catch (error) { handle(error, response, next); }
  };
  return Object.freeze({
    getAll: action(async (request, response) => response.json({ data: await service.getAll(request.query.patientId, request.userId) })),
    create: action(async (request, response) => {
      const data = await service.create(request.body, request.userId);
      changeBus.publish(request.userId, { resource: "routines", action: "created" });
      response.status(201).json({ data });
    }),
    update: action(async (request, response) => {
      await service.update(request.params.id, request.body, request.userId);
      changeBus.publish(request.userId, { resource: "routines", action: "updated" });
      response.status(204).send();
    }),
    remove: action(async (request, response) => {
      await service.remove(request.params.id, request.userId);
      changeBus.publish(request.userId, { resource: "routines", action: "removed" });
      response.status(204).send();
    }),
    getDaily: action(async (request, response) => response.json({ data: await service.getDaily(request.query.date, request.query.patientId, request.userId) })),
    setCompletion: action(async (request, response) => {
      const data = await service.setCompletion(request.params.id, request.body, request.userId, request.profileId);
      changeBus.publish(request.userId, { resource: "routines", action: "completion-updated" });
      response.json({ data });
    }),
  });
}

module.exports = createRoutinesController;
```

Em `backend/src/app.js`, trocar:

```javascript
const routinesController = createRoutinesController(routinesService, changeBus);
```

- [ ] **Step 8: Rodar a suíte completa**

Run: `cd backend && npm test`
Expected: PASS.

- [ ] **Step 9: Commit**

```bash
git add backend/database/migrations/018_add_author_profile_id_to_routine_completions.sql backend/src/repositories/routines-repository.js backend/src/services/routines-service.js backend/src/controllers/routines-controller.js backend/test/routines-service.test.js backend/src/app.js
git commit -m "feat: atribui autoria e tempo real a conclusao de atividades"
```

---

## Task 12: Atribuição em eventos da agenda

**Files:**
- Create: `backend/database/migrations/019_add_profile_ids_to_events.sql`
- Modify: `backend/src/repositories/events-repository.js`
- Modify: `backend/src/services/events-service.js`
- Modify: `backend/src/controllers/events-controller.js`
- Test: `backend/test/events-service.test.js`

**Interfaces:**
- Produces: `eventsService.create(input, userId, profileId)` e `setStatus(id, input, userId,
  profileId)` ganham o parâmetro de perfil. `getAll`/`getDaily` retornam `authorProfileId` +
  `authorProfileName` (quem criou) e `completedByProfileId` + `completedByProfileName` (quem
  marcou o status mais recente).

- [ ] **Step 1: Migration**

```sql
SET client_encoding TO 'UTF8';

BEGIN;

ALTER TABLE events ADD COLUMN author_profile_id BIGINT REFERENCES caregiver_profiles(id) ON DELETE SET NULL;
ALTER TABLE events ADD COLUMN completed_by_profile_id BIGINT REFERENCES caregiver_profiles(id) ON DELETE SET NULL;

COMMIT;
```

Aplicar: `cd backend && PGPASSWORD=$DB_PASSWORD psql -h localhost -p 5432 -U careroutine_app -d careroutine -f database/migrations/019_add_profile_ids_to_events.sql`

- [ ] **Step 2: Escrever os testes de service**

Em `backend/test/events-service.test.js`, adicionar:

```javascript
  it("inclui o profileId de quem criou o evento", async () => {
    let received;
    const service = createEventsService({
      patientBelongsToUser: async () => true,
      async create(data) { received = data; return { id: "1" }; },
    });
    await service.create(validEvent(), "9", "4");
    assert.equal(received.authorProfileId, "4");
  });

  it("inclui o profileId de quem marcou o status", async () => {
    let receivedProfileId;
    const service = createEventsService({
      async setStatus(id, status, userId, profileId) { receivedProfileId = profileId; return { id }; },
    });
    await service.setStatus("3", { status: "completed" }, "9", "4");
    assert.equal(receivedProfileId, "4");
  });
```

(`validEvent()` é o helper já existente no topo do arquivo — usar o mesmo nome que os demais
testes de `create` já usam.)

- [ ] **Step 3: Rodar e confirmar que falham**

Run: `cd backend && node --test test/events-service.test.js`
Expected: FAIL.

- [ ] **Step 4: Atualizar o repository**

Em `backend/src/repositories/events-repository.js`, `getAll`:

```javascript
async function getAll(patientId, userId, { start, end } = {}) {
  const result = await pool.query(`
    SELECT e.id, e.title, e.category, to_char(e.event_date, 'YYYY-MM-DD') AS "eventDate",
      to_char(e.event_time, 'HH24:MI') AS "eventTime", e.notes, e.status,
      e.completed_at AS "completedAt",
      e.author_profile_id AS "authorProfileId", author.name AS "authorProfileName",
      e.completed_by_profile_id AS "completedByProfileId", completer.name AS "completedByProfileName"
    FROM events e
    LEFT JOIN caregiver_profiles author ON author.id = e.author_profile_id
    LEFT JOIN caregiver_profiles completer ON completer.id = e.completed_by_profile_id
    WHERE e.patient_id = $1 AND e.patient_id IN (SELECT id FROM patients WHERE user_id = $2)
      AND ($3::date IS NULL OR e.event_date >= $3)
      AND ($4::date IS NULL OR e.event_date <= $4)
    ORDER BY e.event_date, e.event_time, e.title`,
    [patientId, userId, start || null, end || null]);
  return result.rows;
}
```

`create`:

```javascript
async function create(event) {
  const result = await pool.query(
    `INSERT INTO events (title, category, event_date, event_time, notes, patient_id, author_profile_id)
     VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id`,
    [event.title, event.category, event.eventDate, event.eventTime, event.notes, event.patientId, event.authorProfileId],
  );
  return result.rows[0].id;
}
```

`getDaily`:

```javascript
async function getDaily(date, patientId, userId) {
  const result = await pool.query(
    `SELECT e.id, e.title, e.category, to_char(e.event_time, 'HH24:MI') AS time, e.notes, e.status,
       e.completed_by_profile_id AS "completedByProfileId", cp.name AS "completedByProfileName"
     FROM events e
     LEFT JOIN caregiver_profiles cp ON cp.id = e.completed_by_profile_id
     WHERE e.event_date = $1 AND e.patient_id = $2
       AND e.patient_id IN (SELECT id FROM patients WHERE user_id = $3)
     ORDER BY e.event_time, e.title`,
    [date, patientId, userId],
  );
  return result.rows;
}
```

`setStatus`:

```javascript
async function setStatus(id, status, userId, profileId) {
  const result = await pool.query(
    `UPDATE events SET status = $1, completed_at = $2, completed_by_profile_id = $3, updated_at = CURRENT_TIMESTAMP
     WHERE id = $4 AND patient_id IN (SELECT id FROM patients WHERE user_id = $5)
     RETURNING id, status, completed_at AS "completedAt", completed_by_profile_id AS "completedByProfileId"`,
    [status, status === "completed" ? new Date() : null, profileId, id, userId],
  );
  return result.rows[0];
}
```

- [ ] **Step 5: Atualizar o service**

Em `backend/src/services/events-service.js`:

```javascript
  async function create(input, userId, profileId) {
    const event = { ...validateEvent(input ?? {}), authorProfileId: profileId ?? null };
    if (!(await repository.patientBelongsToUser(event.patientId, userId))) {
      throw new EventValidationError({ patientId: "Paciente não encontrado" });
    }
    return { id: await repository.create(event) };
  }
```

```javascript
  async function setStatus(id, input, userId, profileId) {
    validateId(id);
    const status = input.status;
    if (!new Set(["completed", "skipped"]).has(status)) throw new EventValidationError({ status: "Status inválido" });
    const result = await repository.setStatus(id, status, userId, profileId ?? null);
    if (!result) throw new EventNotFoundError();
    return result;
  }
```

- [ ] **Step 6: Rodar o teste de service e confirmar que passa**

Run: `cd backend && node --test test/events-service.test.js`
Expected: PASS.

- [ ] **Step 7: Atualizar o controller**

`backend/src/controllers/events-controller.js` ganha `changeBus`:

```javascript
function createEventsController(service, changeBus) {
  const action = (callback) => async (request, response, next) => {
    try { await callback(request, response); } catch (error) { handle(error, response, next); }
  };
  return Object.freeze({
    getAll: action(async (request, response) => response.json({
      data: await service.getAll(request.query.patientId, request.userId, {
        start: request.query.start,
        end: request.query.end,
      }),
    })),
    create: action(async (request, response) => {
      const data = await service.create(request.body, request.userId, request.profileId);
      changeBus.publish(request.userId, { resource: "events", action: "created" });
      response.status(201).json({ data });
    }),
    update: action(async (request, response) => {
      await service.update(request.params.id, request.body, request.userId);
      changeBus.publish(request.userId, { resource: "events", action: "updated" });
      response.status(204).send();
    }),
    remove: action(async (request, response) => {
      await service.remove(request.params.id, request.userId);
      changeBus.publish(request.userId, { resource: "events", action: "removed" });
      response.status(204).send();
    }),
    getDaily: action(async (request, response) => response.json({ data: await service.getDaily(request.query.date, request.query.patientId, request.userId) })),
    getUpcoming: action(async (request, response) => response.json({
      data: await service.getUpcoming(request.query.patientId, request.userId, request.query.days || "3"),
    })),
    setStatus: action(async (request, response) => {
      const data = await service.setStatus(request.params.id, request.body, request.userId, request.profileId);
      changeBus.publish(request.userId, { resource: "events", action: "status-updated" });
      response.json({ data });
    }),
  });
}

module.exports = createEventsController;
```

Em `backend/src/app.js`, trocar:

```javascript
const eventsController = createEventsController(eventsService, changeBus);
```

- [ ] **Step 8: Rodar a suíte completa**

Run: `cd backend && npm test`
Expected: PASS.

- [ ] **Step 9: Commit**

```bash
git add backend/database/migrations/019_add_profile_ids_to_events.sql backend/src/repositories/events-repository.js backend/src/services/events-service.js backend/src/controllers/events-controller.js backend/test/events-service.test.js backend/src/app.js
git commit -m "feat: atribui autoria e tempo real aos eventos da agenda"
```

---

## Task 13: Atribuição em anotações de enfermagem (remove o campo manual)

**Files:**
- Create: `backend/database/migrations/020_add_author_profile_id_to_nursing_notes.sql`
- Modify: `backend/src/repositories/nursing-notes-repository.js`
- Modify: `backend/src/services/nursing-notes-service.js`
- Modify: `backend/src/controllers/nursing-notes-controller.js`
- Test: `backend/test/nursing-notes-service.test.js`

**Interfaces:**
- Produces: `nursingNotesService.create(input, userId, profileId)` — ganha o 3º parâmetro, e
  **deixa de exigir/aceitar `authorName` no `input`**. `getAll` retorna `authorProfileId` +
  `authorProfileName` (perfil, para notas novas) além do já existente `authorName` (texto livre,
  mantido só como retrocompatibilidade de exibição para as notas antigas).

- [ ] **Step 1: Migration**

```sql
SET client_encoding TO 'UTF8';

BEGIN;

ALTER TABLE nursing_notes ADD COLUMN author_profile_id BIGINT REFERENCES caregiver_profiles(id) ON DELETE SET NULL;
ALTER TABLE nursing_notes ALTER COLUMN author_name DROP NOT NULL;

COMMIT;
```

Aplicar: `cd backend && PGPASSWORD=$DB_PASSWORD psql -h localhost -p 5432 -U careroutine_app -d careroutine -f database/migrations/020_add_author_profile_id_to_nursing_notes.sql`

- [ ] **Step 2: Escrever o teste de service**

Em `backend/test/nursing-notes-service.test.js`, adicionar (e revisar o teste existente
`"rejeita cuidador não informado"` — ver Step 5):

```javascript
  it("grava o profileId de quem fez a anotacao", async () => {
    let received;
    const service = createNursingNotesService({
      patientBelongsToUser: async () => true,
      async create(data) { received = data; return "7"; },
    });
    await service.create(validNote(), "9", "4");
    assert.equal(received.authorProfileId, "4");
  });
```

(`validNote()` é o helper existente no topo do arquivo — usar o mesmo nome já usado pelos
outros testes de `create` desse arquivo.)

- [ ] **Step 3: Rodar e confirmar que falha**

Run: `cd backend && node --test test/nursing-notes-service.test.js`
Expected: FAIL — `received.authorProfileId` é `undefined`.

- [ ] **Step 4: Atualizar o repository**

Em `backend/src/repositories/nursing-notes-repository.js`, trocar `RETURNING_FIELDS` e `getAll`:

```javascript
const RETURNING_FIELDS = `
  id,
  to_char(note_date, 'YYYY-MM-DD') AS "noteDate",
  to_char(note_time, 'HH24:MI') AS "noteTime",
  shift,
  author_name AS "authorName",
  author_profile_id AS "authorProfileId",
  note_text AS "noteText",
  is_highlighted AS "isHighlighted",
  created_at AS "createdAt",
  updated_at AS "updatedAt"
`;

async function getAll(patientId, userId, { date, shift } = {}) {
  const result = await pool.query(`
    SELECT n.id, to_char(n.note_date, 'YYYY-MM-DD') AS "noteDate",
      to_char(n.note_time, 'HH24:MI') AS "noteTime", n.shift,
      n.author_name AS "authorName", n.author_profile_id AS "authorProfileId",
      cp.name AS "authorProfileName", n.note_text AS "noteText",
      n.is_highlighted AS "isHighlighted", n.created_at AS "createdAt", n.updated_at AS "updatedAt"
    FROM nursing_notes n
    LEFT JOIN caregiver_profiles cp ON cp.id = n.author_profile_id
    WHERE n.patient_id = $1 AND n.patient_id IN (SELECT id FROM patients WHERE user_id = $2)
      AND ($3::date IS NULL OR n.note_date = $3)
      AND ($4::varchar IS NULL OR n.shift = $4)
    ORDER BY n.note_date DESC, n.note_time DESC`,
    [patientId, userId, date, shift]);
  return result.rows;
}
```

`create`:

```javascript
async function create(note) {
  const result = await pool.query(
    `INSERT INTO nursing_notes (note_date, note_time, shift, author_name, author_profile_id, note_text, is_highlighted, patient_id)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id`,
    [note.noteDate, note.noteTime, note.shift, note.authorName, note.authorProfileId, note.noteText, note.isHighlighted, note.patientId],
  );
  return result.rows[0].id;
}
```

`update` **não muda** (continua sem tocar `author_profile_id`/`author_name`, preservando a
autoria original mesmo quando outro cuidador edita a nota).

- [ ] **Step 5: Atualizar o service — remove a exigência de `authorName`**

Em `backend/src/services/nursing-notes-service.js`, dentro de `validateNote`, remover as linhas
de `authorName`:

```javascript
function validateNote(input, editing = false) {
  const details = {};
  const noteDate = typeof input.noteDate === "string" ? input.noteDate : "";
  const noteTime = typeof input.noteTime === "string" ? input.noteTime.trim() : "";
  const shift = typeof input.shift === "string" ? input.shift.trim() : "";
  const noteText = typeof input.noteText === "string" ? input.noteText.trim() : "";
  const patientId = input.patientId;

  if (!isDate(noteDate)) details.noteDate = "Informe uma data válida";
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(noteTime)) details.noteTime = "Informe um horário válido";
  if (!VALID_SHIFTS.has(shift)) details.shift = "Informe um turno válido";
  if (!noteText || noteText.length > 2000) details.noteText = "Informe o texto da evolução com até 2000 caracteres";
  if (!editing && !/^\d+$/.test(String(patientId ?? ""))) details.patientId = "Selecione um paciente";
  if (Object.keys(details).length) throw new NursingNoteValidationError(details);

  return { noteDate, noteTime, shift, noteText, patientId, isHighlighted: Boolean(input.isHighlighted) };
}
```

Trocar `create`:

```javascript
  async function create(input, userId, profileId) {
    const note = { ...validateNote(input ?? {}), authorName: null, authorProfileId: profileId ?? null };
    if (!(await repository.patientBelongsToUser(note.patientId, userId))) {
      throw new NursingNoteValidationError({ patientId: "Paciente não encontrado" });
    }
    return { id: await repository.create(note) };
  }
```

`update` continua chamando só `validateNote(input ?? {}, true)` sem `authorProfileId` (a
assinatura de `repository.update(id, note, userId)` não muda porque `note` nunca inclui
`authorProfileId`/`authorName` — o `UPDATE` no repository não altera essas colunas, então não
precisam estar no objeto passado; **conferir** que `repository.update` (não alterado nesta task)
continua funcionando com um objeto sem essas duas chaves, já que a query de `UPDATE` referencia
`note.authorName`/`note.author_profile_id`... **atenção**: a query de `update` atual em
`nursing-notes-repository.js` tem `author_name = $4` no `SET` — como o objeto `note` do `update`
não vai mais ter `authorName`, isso gravaria `NULL` sobre o nome já existente. Para evitar isso,
ajustar a query de `update` no repository para **não** incluir `author_name`/`author_profile_id`
no `SET`:

```javascript
async function update(id, note, userId) {
  const result = await pool.query(
    `UPDATE nursing_notes SET note_date = $1, note_time = $2, shift = $3,
      note_text = $4, is_highlighted = $5, updated_at = CURRENT_TIMESTAMP
     WHERE id = $6 AND patient_id IN (SELECT id FROM patients WHERE user_id = $7) RETURNING id`,
    [note.noteDate, note.noteTime, note.shift, note.noteText, note.isHighlighted, id, userId],
  );
  return result.rowCount > 0;
}
```

(Essa mudança faz parte do Step 4 — inclua-a lá junto das outras alterações do repository.)

- [ ] **Step 6: Rodar o teste de service e confirmar que passa**

Run: `cd backend && node --test test/nursing-notes-service.test.js`
Expected: PASS. **Atenção**: o teste existente `"rejeita cuidador não informado"` vai falhar
porque `authorName` não é mais validado — remova esse teste do arquivo (a asserção que ele
verificava não existe mais no sistema; o cuidador agora vem do perfil logado, não de um campo
digitado).

- [ ] **Step 7: Atualizar o controller**

`backend/src/controllers/nursing-notes-controller.js` ganha `changeBus`:

```javascript
function createNursingNotesController(service, changeBus) {
  const action = (callback) => async (request, response, next) => {
    try { await callback(request, response); } catch (error) { handle(error, response, next); }
  };
  return Object.freeze({
    getAll: action(async (request, response) => response.json({
      data: await service.getAll(request.query.patientId, request.userId, {
        date: request.query.date,
        shift: request.query.shift,
      }),
    })),
    create: action(async (request, response) => {
      const data = await service.create(request.body, request.userId, request.profileId);
      changeBus.publish(request.userId, { resource: "nursing-notes", action: "created" });
      response.status(201).json({ data });
    }),
    update: action(async (request, response) => {
      await service.update(request.params.id, request.body, request.userId);
      changeBus.publish(request.userId, { resource: "nursing-notes", action: "updated" });
      response.status(204).send();
    }),
    remove: action(async (request, response) => {
      await service.remove(request.params.id, request.userId);
      changeBus.publish(request.userId, { resource: "nursing-notes", action: "removed" });
      response.status(204).send();
    }),
  });
}

module.exports = createNursingNotesController;
```

Em `backend/src/app.js`, trocar:

```javascript
const nursingNotesController = createNursingNotesController(nursingNotesService, changeBus);
```

- [ ] **Step 8: Rodar a suíte completa**

Run: `cd backend && npm test`
Expected: PASS.

- [ ] **Step 9: Commit**

```bash
git add backend/database/migrations/020_add_author_profile_id_to_nursing_notes.sql backend/src/repositories/nursing-notes-repository.js backend/src/services/nursing-notes-service.js backend/src/controllers/nursing-notes-controller.js backend/test/nursing-notes-service.test.js backend/src/app.js
git commit -m "feat: atribui autoria via perfil nas anotacoes de enfermagem"
```

---

## Task 14: `caregiver-profiles-repository.js` no frontend

**Files:**
- Create: `frontend/js/caregiver-profiles-repository.js`

**Interfaces:**
- Produces: `CaregiverProfilesRepository` (IIFE global, mesmo padrão de
  `frontend/js/medications-repository.js`) com `{ getAll(), create(data), update(id, data),
  remove(id) }`.

- [ ] **Step 1: Implementar**

```javascript
const CaregiverProfilesRepository = (() => {
  const API_URL = "http://localhost:3000/api/caregiver-profiles";

  async function request(url, options = {}) {
    const response = await fetch(url, {
      ...options,
      headers: { "Content-Type": "application/json", ...AuthContext.authHeader(), ...options.headers },
    });
    if (response.status === 401) { AuthContext.logout(); throw new Error("Sessão expirada"); }
    if (!response.ok) {
      const body = await response.json().catch(() => ({}));
      throw new Error(body.details ? Object.values(body.details)[0] : body.error || "Falha ao acessar a API");
    }
    if (response.status === 204) return null;
    return response.json();
  }

  async function getAll() { return (await request(API_URL)).data; }
  async function create(data) { return (await request(API_URL, { method: "POST", body: JSON.stringify(data) })).data; }
  async function update(id, data) { return (await request(`${API_URL}/${id}`, { method: "PUT", body: JSON.stringify(data) })).data; }
  async function remove(id) { return request(`${API_URL}/${id}`, { method: "DELETE" }); }

  return Object.freeze({ create, getAll, remove, update });
})();
```

- [ ] **Step 2: Verificar sintaticamente**

Run: `node --check frontend/js/caregiver-profiles-repository.js`
Expected: sem saída (sem erro de sintaxe).

- [ ] **Step 3: Commit**

```bash
git add frontend/js/caregiver-profiles-repository.js
git commit -m "feat: adiciona repository frontend de caregiver-profiles"
```

---

## Task 15: `auth-context.js` — header `X-Profile-Id` e limpeza no logout

**Files:**
- Modify: `frontend/js/auth-context.js`

**Interfaces:**
- Consumes: chave `localStorage` `loreroutine:profileId` (escrita pelo módulo da Task 16,
  `caregiver-context.js` — `auth-context.js` só **lê** essa chave, não a gerencia, do mesmo jeito
  que hoje já lê/limpa `loreroutine:patientId` no `logout()` sem ser o dono desse dado).
- Produces: `AuthContext.authHeader()` passa a incluir `X-Profile-Id` quando houver perfil
  selecionado.

- [ ] **Step 1: Editar `authHeader()` e `logout()`**

Em `frontend/js/auth-context.js`, trocar:

```javascript
  function authHeader() {
    const token = getToken();
    return token ? { Authorization: `Bearer ${token}` } : {};
  }
```

por:

```javascript
  function authHeader() {
    const token = getToken();
    const headers = token ? { Authorization: `Bearer ${token}` } : {};
    const profileId = localStorage.getItem("loreroutine:profileId");
    if (profileId) headers["X-Profile-Id"] = profileId;
    return headers;
  }
```

E trocar:

```javascript
  function logout() {
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(USER_STORAGE_KEY);
    localStorage.removeItem(AVATAR_STORAGE_KEY);
    localStorage.removeItem("loreroutine:patientId");
    location.href = "login.html";
  }
```

por:

```javascript
  function logout() {
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(USER_STORAGE_KEY);
    localStorage.removeItem(AVATAR_STORAGE_KEY);
    localStorage.removeItem("loreroutine:patientId");
    localStorage.removeItem("loreroutine:profileId");
    localStorage.removeItem("loreroutine:profileName");
    localStorage.removeItem("loreroutine:profileColor");
    location.href = "login.html";
  }
```

- [ ] **Step 2: Verificar sintaticamente**

Run: `node --check frontend/js/auth-context.js`
Expected: sem saída.

- [ ] **Step 3: Commit**

```bash
git add frontend/js/auth-context.js
git commit -m "feat: envia X-Profile-Id nas requisicoes autenticadas"
```

---

## Task 16: `caregiver-context.js` — perfil ativo + porteiro de seleção

**Files:**
- Create: `frontend/js/caregiver-context.js`

**Interfaces:**
- Consumes: `AuthContext.authHeader()` / `AuthContext.getToken()` (para saber se a conta está
  logada), `CaregiverProfilesRepository.getAll()` (Task 14).
- Produces: `CaregiverContext` (IIFE global, mesmo padrão de `PatientContext`) com
  `{ getCurrentId(), getCurrentName(), getCurrentColor(), setCurrent(profile), clearCurrent(),
  ready() }`. `ready()` retorna uma Promise que resolve com o id do perfil ativo (ou `null`), e
  redireciona para `perfis.html` se a conta tiver perfis cadastrados mas nenhum estiver
  selecionado ainda — mesma ideia do redirecionamento de `AuthContext` para `login.html` quando
  não há token.

- [ ] **Step 1: Implementar**

```javascript
const CaregiverContext = (() => {
  const ID_KEY = "loreroutine:profileId";
  const NAME_KEY = "loreroutine:profileName";
  const COLOR_KEY = "loreroutine:profileColor";

  function getCurrentId() { return localStorage.getItem(ID_KEY) || null; }
  function getCurrentName() { return localStorage.getItem(NAME_KEY) || ""; }
  function getCurrentColor() { return localStorage.getItem(COLOR_KEY) || ""; }

  function setCurrent(profile) {
    localStorage.setItem(ID_KEY, profile.id);
    localStorage.setItem(NAME_KEY, profile.name);
    localStorage.setItem(COLOR_KEY, profile.avatarColor);
  }

  function clearCurrent() {
    localStorage.removeItem(ID_KEY);
    localStorage.removeItem(NAME_KEY);
    localStorage.removeItem(COLOR_KEY);
  }

  async function init() {
    if (!AuthContext.getToken()) return getCurrentId();
    if (getCurrentId()) return getCurrentId();
    if (location.pathname.endsWith("perfis.html")) return getCurrentId();

    let profiles;
    try {
      profiles = await CaregiverProfilesRepository.getAll();
    } catch (error) {
      return getCurrentId();
    }
    if (profiles.length > 0) {
      location.href = "perfis.html";
      return getCurrentId();
    }
    return getCurrentId();
  }

  const readyPromise = init();

  return Object.freeze({
    clearCurrent, getCurrentColor, getCurrentId, getCurrentName, setCurrent,
    ready: () => readyPromise,
  });
})();
```

- [ ] **Step 2: Verificar sintaticamente**

Run: `node --check frontend/js/caregiver-context.js`
Expected: sem saída.

- [ ] **Step 3: Commit**

```bash
git add frontend/js/caregiver-context.js
git commit -m "feat: adiciona contexto de perfil ativo com porteiro de selecao"
```

---

## Task 17: CSS do seletor de perfis (estilo Netflix)

**Files:**
- Modify: `frontend/css/styles.css`

**Interfaces:**
- Produces: classes `.profile-picker`, `.profile-grid`, `.profile-avatar`,
  `.profile-avatar__circle`, `.profile-avatar__name` usadas pela Task 18.

- [ ] **Step 1: Adicionar as classes no final de `styles.css`**

```css
.profile-picker {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 32px;
  padding: 32px;
  text-align: center;
}

.profile-grid {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 24px;
}

.profile-avatar {
  background: none;
  border: none;
  cursor: pointer;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
  padding: 8px;
  border-radius: var(--radius-sm);
}

.profile-avatar:hover .profile-avatar__circle,
.profile-avatar:focus-visible .profile-avatar__circle {
  outline: 3px solid var(--primary);
  outline-offset: 3px;
}

.profile-avatar__circle {
  width: 96px;
  height: 96px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #fff;
  font-size: 2rem;
  font-weight: 700;
}

.profile-avatar__name {
  color: var(--text);
  font-weight: 600;
}

.profile-color-picker {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
}

.profile-color-picker__swatch {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  border: 2px solid transparent;
  cursor: pointer;
}

.profile-color-picker__swatch--selected {
  border-color: var(--text);
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/css/styles.css
git commit -m "feat: adiciona estilos do seletor de perfis"
```

---

## Task 18: `perfis.html` + `js/perfis.js` — seletor estilo Netflix

**Files:**
- Create: `frontend/perfis.html`
- Create: `frontend/js/perfis.js`

**Interfaces:**
- Consumes: `CaregiverProfilesRepository.getAll()` (Task 14), `CaregiverContext.setCurrent()`
  (Task 16).
- Produces: página que lista os perfis como avatares clicáveis; ao clicar, salva o perfil ativo
  e navega para `index.html`.

- [ ] **Step 1: Criar `perfis.html`**

```html
<!DOCTYPE html>
<html lang="pt-BR">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <meta name="description" content="Escolha quem está usando o Lory's Care." />
    <title>Quem está cuidando? | Lory's Care</title>
    <link rel="stylesheet" href="css/styles.css" />
  </head>
  <body>
    <div class="profile-picker">
      <div>
        <a class="brand" href="index.html"><span class="brand__icon"></span>Lory's<span> Care</span></a>
        <h1>Quem está cuidando agora?</h1>
      </div>
      <div class="profile-grid" id="profile-grid"></div>
      <p class="empty-history" id="empty-profiles" hidden>Nenhum cuidador cadastrado ainda. Peça para o responsável da conta cadastrar em "Meu perfil".</p>
      <p class="form-message" id="message" aria-live="polite"></p>
    </div>

    <script src="js/icons.js"></script>
    <script src="js/auth-context.js"></script>
    <script src="js/caregiver-profiles-repository.js"></script>
    <script src="js/caregiver-context.js"></script>
    <script src="js/perfis.js"></script>
  </body>
</html>
```

- [ ] **Step 2: Criar `js/perfis.js`**

```javascript
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
```

- [ ] **Step 3: Testar manualmente**

Run: `cd frontend && npx http-server . -p 5500` (ou reaproveitar o servidor já em uso), acessar
`http://localhost:5500/perfis.html` logado. Cadastrar um perfil via `curl` (ou aguardar a Task
22, que dá uma UI para isso) e confirmar que o avatar aparece e que clicar leva para
`index.html` salvando `loreroutine:profileId` no `localStorage`.
Expected: grid mostra o(s) avatar(es); clique navega e persiste a seleção.

- [ ] **Step 4: Commit**

```bash
git add frontend/perfis.html frontend/js/perfis.js
git commit -m "feat: adiciona tela de selecao de perfil estilo Netflix"
```

---

## Task 19: Ligar `caregiver-context.js` em todas as páginas autenticadas

**Files:**
- Modify: `frontend/index.html`, `frontend/pacientes.html`, `frontend/sinais-vitais.html`,
  `frontend/medicamentos.html`, `frontend/atividades.html`,
  `frontend/anotacoes-enfermagem.html`, `frontend/agenda.html`, `frontend/perfil.html`,
  `frontend/cadastro.html` (conferir se esta também carrega `auth-context.js`; se não carregar,
  pular esse arquivo)

**Interfaces:**
- Consumes: nada novo — só adiciona os `<script>` das Tasks 14 e 16 em sequência, **depois** de
  `auth-context.js` e **antes** do script específico da página (`vitals.js`, `medications.js`
  etc.), porque esses scripts vão chamar `CaregiverContext` na Task 25-29.

- [ ] **Step 1: Adicionar os dois `<script>` em cada página**

Em cada um dos 8 arquivos HTML autenticados, localizar a linha:

```html
    <script src="js/auth-context.js"></script>
```

E adicionar logo depois dela (antes de `js/icons.js`, para já existir quando as demais telas
carregarem):

```html
    <script src="js/auth-context.js"></script>
    <script src="js/caregiver-profiles-repository.js"></script>
    <script src="js/caregiver-context.js"></script>
```

Fazer essa mesma edição, idêntica, nos 8 arquivos listados em **Files** acima.

- [ ] **Step 2: Testar manualmente**

Abrir `http://localhost:5500/index.html` sem `loreroutine:profileId` salvo, com pelo menos um
perfil cadastrado na conta.
Expected: a página redireciona sozinha para `perfis.html`. Depois de escolher um avatar, volta
para `index.html` e não redireciona mais (porque `loreroutine:profileId` já está salvo).

- [ ] **Step 3: Commit**

```bash
git add frontend/index.html frontend/pacientes.html frontend/sinais-vitais.html frontend/medicamentos.html frontend/atividades.html frontend/anotacoes-enfermagem.html frontend/agenda.html frontend/perfil.html
git commit -m "feat: conecta o porteiro de selecao de perfil em todas as telas"
```

---

## Task 20: Sidebar mostra o cuidador ativo + "Trocar cuidador"

**Files:**
- Modify: `frontend/js/ui-icons.js`

**Interfaces:**
- Consumes: `CaregiverContext.getCurrentName()` / `.getCurrentColor()` / `.clearCurrent()`
  (Task 16). Roda depois de `caregiver-context.js` estar carregado (garantido pela ordem de
  `<script>` da Task 19 — `ui-icons.js` já vem depois na lista de scripts de cada página).

- [ ] **Step 1: Editar o trecho final de `ui-icons.js`**

Trocar o bloco final do arquivo (a partir de `function initials(name) {`) por:

```javascript
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

  const roleEl = document.querySelector(".sidebar-user-card__role");
  if (roleEl && window.CaregiverContext) {
    const profileName = CaregiverContext.getCurrentName();
    roleEl.replaceChildren();
    const label = document.createElement("span");
    label.textContent = profileName || "Cuidador";
    roleEl.append(label);
    if (profileName) {
      const switchLink = document.createElement("button");
      switchLink.type = "button";
      switchLink.className = "sidebar-user-card__switch";
      switchLink.textContent = "Trocar";
      switchLink.addEventListener("click", () => {
        CaregiverContext.clearCurrent();
        location.href = "perfis.html";
      });
      roleEl.append(document.createTextNode(" · "), switchLink);
    }
  }
})();
```

(Isso substitui só a parte final do arquivo, a partir da definição de `initials`; o topo do
arquivo — `NAV_ICONS`, `fillIcon`, etc. — permanece inalterado.)

- [ ] **Step 2: Adicionar o estilo do botão "Trocar" em `frontend/css/styles.css`**

```css
.sidebar-user-card__switch {
  background: none;
  border: none;
  padding: 0;
  color: var(--primary);
  font-size: inherit;
  font-weight: 600;
  cursor: pointer;
  text-decoration: underline;
}
```

- [ ] **Step 3: Testar manualmente**

Com um perfil selecionado, recarregar qualquer tela autenticada.
Expected: abaixo do nome da conta na barra lateral aparece o nome do cuidador ativo + "· Trocar".
Clicar em "Trocar" leva para `perfis.html`.

- [ ] **Step 4: Commit**

```bash
git add frontend/js/ui-icons.js frontend/css/styles.css
git commit -m "feat: mostra cuidador ativo e opcao de trocar na barra lateral"
```

---

## Task 21: `account-menu.js` mostra o cuidador ativo

**Files:**
- Modify: `frontend/js/account-menu.js`

**Interfaces:**
- Consumes: `CaregiverContext.getCurrentName()` (Task 16).

- [ ] **Step 1: Editar a linha final do arquivo**

Trocar:

```javascript
  name.textContent = AuthContext.getUserName();
  renderAvatar();
})();
```

por:

```javascript
  name.textContent = AuthContext.getUserName();
  if (window.CaregiverContext && CaregiverContext.getCurrentName()) {
    const activeProfile = document.createElement("p");
    activeProfile.className = "account-menu__profile";
    activeProfile.textContent = `Cuidador ativo: ${CaregiverContext.getCurrentName()}`;
    name.after(activeProfile);
  }
  renderAvatar();
})();
```

- [ ] **Step 2: Testar manualmente**

Abrir o menu da conta (ícone no topo) com um perfil selecionado.
Expected: aparece "Cuidador ativo: <nome>" logo abaixo do nome da conta.

- [ ] **Step 3: Commit**

```bash
git add frontend/js/account-menu.js
git commit -m "feat: mostra cuidador ativo no menu da conta"
```

---

## Task 22: Aba "Cuidadores" em Meu perfil (CRUD)

**Files:**
- Modify: `frontend/perfil.html`
- Modify: `frontend/js/perfil.js`

**Interfaces:**
- Consumes: `CaregiverProfilesRepository` (Task 14).

- [ ] **Step 1: Adicionar a aba e o painel em `perfil.html`**

Trocar a linha das abas:

```html
          <div class="tabs" role="tablist">
            <button class="tab-button" id="tab-button-cadastro" type="button" data-tab="cadastro">Editar cadastro</button>
            <button class="tab-button" id="tab-button-senha" type="button" data-tab="senha">Mudar senha</button>
            <button class="tab-button" id="tab-button-info" type="button" data-tab="info">Informações adicionais</button>
            <button class="tab-button" id="tab-button-foto" type="button" data-tab="foto">Foto</button>
          </div>
```

por:

```html
          <div class="tabs" role="tablist">
            <button class="tab-button" id="tab-button-cadastro" type="button" data-tab="cadastro">Editar cadastro</button>
            <button class="tab-button" id="tab-button-senha" type="button" data-tab="senha">Mudar senha</button>
            <button class="tab-button" id="tab-button-info" type="button" data-tab="info">Informações adicionais</button>
            <button class="tab-button" id="tab-button-foto" type="button" data-tab="foto">Foto</button>
            <button class="tab-button" id="tab-button-cuidadores" type="button" data-tab="cuidadores">Cuidadores</button>
          </div>
```

Adicionar, logo depois da `</section>` que fecha `#tab-foto` e antes de `</main>`:

```html
          <section class="form-panel" id="tab-cuidadores" aria-labelledby="cuidadores-title" hidden>
            <h2 id="cuidadores-title">Cuidadores</h2>
            <form id="caregiver-form">
              <div class="form-grid">
                <div class="form-field"><label for="caregiver-name">Nome</label><input id="caregiver-name" name="name" maxlength="80" required /></div>
                <div class="form-field form-field--full">
                  <label>Cor do avatar</label>
                  <div class="profile-color-picker" id="color-picker"></div>
                  <input type="hidden" id="caregiver-color" name="avatarColor" required />
                </div>
              </div>
              <div class="form-actions">
                <button class="primary-button" id="caregiver-submit" type="submit">Adicionar cuidador</button>
                <button class="secondary-button" id="caregiver-cancel" type="button" hidden>Cancelar edição</button>
                <p class="form-message" id="caregiver-message" aria-live="polite"></p>
              </div>
            </form>
            <div class="table-wrapper" id="caregivers-wrapper" hidden>
              <table><thead><tr><th>Nome</th><th>Situação</th><th>Ações</th></tr></thead><tbody id="caregivers-body"></tbody></table>
            </div>
            <p class="empty-history" id="empty-caregivers">Nenhum cuidador cadastrado.</p>
          </section>
```

No final do arquivo, adicionar o script (depois de `js/perfil.js`, já que este continua sendo o
arquivo principal — na verdade a lógica dos cuidadores entra dentro do próprio `perfil.js`, não
precisa de arquivo novo; ajustar só o `<script>` de repositório):

```html
    <script src="js/auth-context.js"></script>
    <script src="js/caregiver-profiles-repository.js"></script>
    <script src="js/caregiver-context.js"></script>
    <script src="js/icons.js"></script>
    <script src="js/ui-icons.js"></script>
    <script src="js/account-menu.js"></script>
    <script src="js/sidebar-toggle.js"></script>
    <script src="js/patient-context.js"></script>
    <script src="js/auth-repository.js"></script>
    <script src="js/perfil.js"></script>
```

- [ ] **Step 2: Adicionar a lógica em `perfil.js`**

No topo de `frontend/js/perfil.js`, no objeto `tabSections`, adicionar a nova aba:

```javascript
const tabSections = {
  cadastro: document.querySelector("#tab-cadastro"),
  senha: document.querySelector("#tab-senha"),
  info: document.querySelector("#tab-info"),
  foto: document.querySelector("#tab-foto"),
  cuidadores: document.querySelector("#tab-cuidadores"),
};
```

No final do arquivo, antes de `loadProfile().catch(...)`, adicionar:

```javascript
const AVATAR_COLORS = ["#176B87", "#4CAF78", "#C0562F", "#6F4E9C", "#A13F5C", "#2F8F9C", "#E0A526", "#3F6B4A"];
const caregiverForm = document.querySelector("#caregiver-form");
const caregiverMessage = document.querySelector("#caregiver-message");
const caregiverSubmit = document.querySelector("#caregiver-submit");
const caregiverCancel = document.querySelector("#caregiver-cancel");
const caregiverColorInput = document.querySelector("#caregiver-color");
const colorPicker = document.querySelector("#color-picker");
const caregiversBody = document.querySelector("#caregivers-body");
const caregiversWrapper = document.querySelector("#caregivers-wrapper");
const emptyCaregivers = document.querySelector("#empty-caregivers");
let caregivers = [];
let editingCaregiverId = null;

AVATAR_COLORS.forEach((color) => {
  const swatch = document.createElement("button");
  swatch.type = "button";
  swatch.className = "profile-color-picker__swatch";
  swatch.style.background = color;
  swatch.dataset.color = color;
  swatch.addEventListener("click", () => {
    caregiverColorInput.value = color;
    colorPicker.querySelectorAll(".profile-color-picker__swatch").forEach((el) => {
      el.classList.toggle("profile-color-picker__swatch--selected", el.dataset.color === color);
    });
  });
  colorPicker.append(swatch);
});

function caregiverCell(value) { const element = document.createElement("td"); element.textContent = value || "—"; return element; }

function renderCaregivers() {
  caregiversBody.replaceChildren();
  emptyCaregivers.hidden = caregivers.length > 0;
  caregiversWrapper.hidden = caregivers.length === 0;
  caregivers.forEach((item) => {
    const row = document.createElement("tr");
    const actions = document.createElement("td");
    const editButton = document.createElement("button");
    editButton.type = "button";
    editButton.className = "table-action table-action--icon";
    editButton.innerHTML = icon("pencil");
    editButton.title = "Editar";
    editButton.addEventListener("click", () => {
      editingCaregiverId = String(item.id);
      caregiverForm.elements.name.value = item.name;
      caregiverColorInput.value = item.avatarColor;
      colorPicker.querySelectorAll(".profile-color-picker__swatch").forEach((el) => {
        el.classList.toggle("profile-color-picker__swatch--selected", el.dataset.color === item.avatarColor);
      });
      caregiverCancel.hidden = false;
      caregiverSubmit.textContent = "Salvar alterações";
    });
    const deleteButton = document.createElement("button");
    deleteButton.type = "button";
    deleteButton.className = "table-action table-action--icon table-action--danger";
    deleteButton.innerHTML = icon("trash");
    deleteButton.title = "Excluir";
    deleteButton.addEventListener("click", async () => {
      if (!window.confirm("Remover este cuidador? O histórico de registros dele é mantido.")) return;
      try { await CaregiverProfilesRepository.remove(item.id); await loadCaregivers(); }
      catch (error) { caregiverMessage.textContent = error.message; }
    });
    actions.append(editButton, deleteButton);
    row.append(caregiverCell(item.name), caregiverCell(item.isActive ? "Ativo" : "Inativo"), actions);
    caregiversBody.append(row);
  });
}

async function loadCaregivers() {
  caregivers = await CaregiverProfilesRepository.getAll();
  renderCaregivers();
}

function finishCaregiverEditing(text = "") {
  editingCaregiverId = null;
  caregiverForm.reset();
  caregiverColorInput.value = "";
  colorPicker.querySelectorAll(".profile-color-picker__swatch").forEach((el) => el.classList.remove("profile-color-picker__swatch--selected"));
  caregiverCancel.hidden = true;
  caregiverSubmit.textContent = "Adicionar cuidador";
  caregiverMessage.textContent = text;
}

caregiverForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!caregiverColorInput.value) { caregiverMessage.textContent = "Escolha uma cor de avatar."; return; }
  caregiverSubmit.disabled = true;
  caregiverMessage.textContent = "Salvando...";
  try {
    const data = Object.fromEntries(new FormData(caregiverForm).entries());
    if (editingCaregiverId) await CaregiverProfilesRepository.update(editingCaregiverId, data);
    else await CaregiverProfilesRepository.create(data);
    finishCaregiverEditing(editingCaregiverId ? "Cuidador atualizado." : "Cuidador adicionado.");
    await loadCaregivers();
  } catch (error) {
    caregiverMessage.textContent = error.message;
  } finally {
    caregiverSubmit.disabled = false;
  }
});

caregiverCancel.addEventListener("click", () => finishCaregiverEditing());

loadCaregivers().catch((error) => { caregiverMessage.textContent = error.message; });
```

- [ ] **Step 3: Testar manualmente**

Acessar `perfil.html`, clicar na aba "Cuidadores", cadastrar 2-3 perfis com cores diferentes,
editar um, excluir outro.
Expected: lista atualiza corretamente após cada ação; os avatares cadastrados aparecem em
`perfis.html` (Task 18) na próxima vez que a seleção de perfil for exigida.

- [ ] **Step 4: Commit**

```bash
git add frontend/perfil.html frontend/js/perfil.js
git commit -m "feat: adiciona gestao de cuidadores em Meu perfil"
```

---

## Task 23: `js/live-updates.js` — cliente SSE

**Files:**
- Create: `frontend/js/live-updates.js`

**Interfaces:**
- Consumes: `AuthContext.getToken()`.
- Produces: `LiveUpdates.connect(onEvent)` — abre um `EventSource` autenticado e chama
  `onEvent({ resource, action })` a cada mensagem; retorna a instância do `EventSource` (ou
  `null` se não houver token).

- [ ] **Step 1: Implementar**

```javascript
const LiveUpdates = (() => {
  function connect(onEvent) {
    const token = AuthContext.getToken();
    if (!token) return null;
    const source = new EventSource(`http://localhost:3000/api/stream?token=${encodeURIComponent(token)}`);
    source.onmessage = (event) => {
      try {
        onEvent(JSON.parse(event.data));
      } catch (error) {
        // mensagem não é um evento válido; ignora
      }
    };
    return source;
  }

  return Object.freeze({ connect });
})();
```

- [ ] **Step 2: Verificar sintaticamente**

Run: `node --check frontend/js/live-updates.js`
Expected: sem saída.

- [ ] **Step 3: Commit**

```bash
git add frontend/js/live-updates.js
git commit -m "feat: adiciona cliente de atualizacao em tempo real via SSE"
```

---

## Task 24: Ligar `live-updates.js` nas telas com dado compartilhado

**Files:**
- Modify: `frontend/sinais-vitais.html`, `frontend/medicamentos.html`, `frontend/atividades.html`
  (não precisa — não tem lista ao vivo própria, só cadastro; **pular**), `frontend/agenda.html`,
  `frontend/anotacoes-enfermagem.html`, `frontend/index.html`
- Modify: `frontend/js/vitals.js`, `frontend/js/medications.js`, `frontend/js/agenda.js`,
  `frontend/js/nursing-notes.js`, `frontend/js/dashboard.js`

**Interfaces:**
- Consumes: `LiveUpdates.connect(onEvent)` (Task 23) e as funções `load*()` já existentes em
  cada arquivo (`loadHistory`, `loadTreatments`/`loadDaily`, `loadMonth`, `loadNotes`,
  `loadTasks`/`loadVitals`/`loadNotes`).

- [ ] **Step 1: Adicionar o script em cada página**

Em `frontend/sinais-vitais.html`, `frontend/medicamentos.html`, `frontend/agenda.html`,
`frontend/anotacoes-enfermagem.html`, `frontend/index.html`, localizar a linha
`<script src="js/patient-context.js"></script>` e adicionar logo depois:

```html
    <script src="js/patient-context.js"></script>
    <script src="js/live-updates.js"></script>
```

- [ ] **Step 2: Ligar em `vitals.js`**

No final de `frontend/js/vitals.js`, depois do bloco `PatientContext.ready().then(...)`,
adicionar:

```javascript
LiveUpdates.connect((event) => {
  if (event.resource === "vitals" && patientId) loadHistory();
});
```

- [ ] **Step 3: Ligar em `medications.js`**

No final de `frontend/js/medications.js`, depois do bloco `PatientContext.ready().then(...)`,
adicionar:

```javascript
LiveUpdates.connect((event) => {
  if (event.resource === "medications" && patientId) Promise.all([loadTreatments(), loadDaily()]);
});
```

- [ ] **Step 4: Ligar em `agenda.js`**

No final de `frontend/js/agenda.js`, depois do bloco `PatientContext.ready().then(...)`,
adicionar:

```javascript
LiveUpdates.connect((event) => {
  if (event.resource === "events" && patientId) loadMonth();
});
```

- [ ] **Step 5: Ligar em `nursing-notes.js`**

No final de `frontend/js/nursing-notes.js`, depois do bloco `PatientContext.ready().then(...)`,
adicionar:

```javascript
LiveUpdates.connect((event) => {
  if (event.resource === "nursing-notes" && patientId) loadNotes();
});
```

- [ ] **Step 6: Ligar em `dashboard.js`**

No final de `frontend/js/dashboard.js`, depois do bloco `PatientContext.ready().then(...)`,
adicionar:

```javascript
LiveUpdates.connect((event) => {
  if (!patientId) return;
  if (["routines", "medications", "events"].includes(event.resource)) loadTasks();
  if (event.resource === "vitals") loadVitals();
  if (event.resource === "nursing-notes") loadNotes();
});
```

- [ ] **Step 7: Testar manualmente com duas abas**

Abrir a mesma tela (ex.: `sinais-vitais.html`) em duas abas do navegador, ambas logadas na
mesma conta. Registrar um sinal vital numa aba.
Expected: a outra aba atualiza a tabela do Histórico sozinha, em poucos segundos, sem F5.

- [ ] **Step 8: Rodar a suíte de backend por garantia (nada mudou lá nesta task, mas confirma que nenhuma outra task ficou pendente)**

Run: `cd backend && npm test`
Expected: PASS.

- [ ] **Step 9: Commit**

```bash
git add frontend/sinais-vitais.html frontend/medicamentos.html frontend/agenda.html frontend/anotacoes-enfermagem.html frontend/index.html frontend/js/vitals.js frontend/js/medications.js frontend/js/agenda.js frontend/js/nursing-notes.js frontend/js/dashboard.js
git commit -m "feat: liga atualizacao em tempo real nas telas de sinais vitais, medicamentos, agenda, anotacoes e dashboard"
```

---

## Task 25: Anotações de enfermagem — remove o campo manual, mostra autor do perfil

**Files:**
- Modify: `frontend/anotacoes-enfermagem.html`
- Modify: `frontend/js/nursing-notes.js`

**Interfaces:**
- Consumes: `item.authorProfileName` / `item.authorName` retornados pela API (Task 13).

- [ ] **Step 1: Remover o campo "Cuidador" do formulário**

Em `frontend/anotacoes-enfermagem.html`, remover a linha:

```html
                <div class="form-field"><label for="author-name">Cuidador</label><input id="author-name" name="authorName" maxlength="120" placeholder="Nome de quem fez a evolução" required /></div>
```

- [ ] **Step 2: Ajustar `nursing-notes.js`**

Em `frontend/js/nursing-notes.js`, na função `renderNotes`, trocar a linha que monta a célula
de autor:

```javascript
    row.append(cell(dateTime), cell(item.shift), cell(item.authorName), textCell, actions);
```

por:

```javascript
    row.append(cell(dateTime), cell(item.shift), cell(item.authorProfileName || item.authorName), textCell, actions);
```

Na função de edição (dentro do listener de `notesBody`), remover a linha:

```javascript
    form.elements.authorName.value = item.authorName;
```

(o campo não existe mais no formulário, então essa linha lançaria erro ao tentar acessar
`form.elements.authorName`).

- [ ] **Step 3: Testar manualmente**

Com um perfil ativo selecionado, registrar uma nova anotação.
Expected: o formulário não pede mais o nome; a linha nova na tabela mostra o nome do perfil
ativo na coluna "Cuidador". Anotações antigas (criadas antes desta mudança) continuam mostrando
o nome digitado na época.

- [ ] **Step 4: Commit**

```bash
git add frontend/anotacoes-enfermagem.html frontend/js/nursing-notes.js
git commit -m "feat: anotacoes de enfermagem usam o cuidador logado automaticamente"
```

---

## Task 26: Sinais vitais — coluna "Registrado por"

**Files:**
- Modify: `frontend/sinais-vitais.html`
- Modify: `frontend/js/vitals.js`

**Interfaces:**
- Consumes: `record.authorProfileName` retornado pela API (Task 9).

- [ ] **Step 1: Adicionar a coluna na tabela**

Em `frontend/sinais-vitais.html`, dentro de `<thead>` do histórico, trocar:

```html
                      <th scope="col">Observações</th>
                      <th scope="col">Ações</th>
```

por:

```html
                      <th scope="col">Observações</th>
                      <th scope="col">Registrado por</th>
                      <th scope="col">Ações</th>
```

- [ ] **Step 2: Atualizar `vitals-repository.js` para expor o campo**

Em `frontend/js/vitals-repository.js`, na função `toLocalRecord`, adicionar o campo:

```javascript
      notes: record.notes ?? "",
      authorProfileName: record.authorProfileName ?? "",
```

(inserir a nova linha logo depois de `notes: record.notes ?? "",`, mantendo o resto do objeto
igual.)

- [ ] **Step 3: Atualizar `renderHistory` em `vitals.js`**

Em `frontend/js/vitals.js`, na função `renderHistory`, trocar:

```javascript
    row.append(
      createCell(formatDateTime(record.date, record.time)),
      createCell(record.shift),
      createCell(record.bloodPressure),
      createCell(record.heartRate ? `${record.heartRate} bpm` : "—"),
      createCell(record.oxygenSaturation ? `${record.oxygenSaturation}%` : "—"),
      createCell(record.temperature ? `${record.temperature} °C` : "—"),
      createCell(record.bloodGlucose ? `${record.bloodGlucose} mg/dL` : "—"),
      createCell(record.notes),
      createActionsCell(record.id),
    );
```

por:

```javascript
    row.append(
      createCell(formatDateTime(record.date, record.time)),
      createCell(record.shift),
      createCell(record.bloodPressure),
      createCell(record.heartRate ? `${record.heartRate} bpm` : "—"),
      createCell(record.oxygenSaturation ? `${record.oxygenSaturation}%` : "—"),
      createCell(record.temperature ? `${record.temperature} °C` : "—"),
      createCell(record.bloodGlucose ? `${record.bloodGlucose} mg/dL` : "—"),
      createCell(record.notes),
      createCell(record.authorProfileName),
      createActionsCell(record.id),
    );
```

Como a coluna "Registrado por" agora é o 9º `<td>` da linha (e não mais o 8º "Observações"), o
seletor CSS `td:nth-child(8)` em `frontend/css/styles.css` (que hoje aplica `white-space: normal`
+ `overflow-wrap: anywhere` na coluna de Observações) precisa continuar apontando para
Observações, que **permanece** sendo o 8º `<td>` (a nova coluna entra depois dela, antes de
Ações) — **não precisa alterar o CSS**, só confirmar visualmente no Step 5 que o wrap continua
na coluna certa.

- [ ] **Step 4: Rodar os testes de backend por garantia**

Run: `cd backend && npm test`
Expected: PASS (esta task não muda backend, é só conferência).

- [ ] **Step 5: Testar manualmente**

Abrir "Sinais vitais" → "Histórico" com um perfil ativo selecionado e ao menos um registro
criado depois da Task 9.
Expected: a coluna "Registrado por" mostra o nome do cuidador; registros antigos (de antes da
migration) mostram "—".

- [ ] **Step 6: Commit**

```bash
git add frontend/sinais-vitais.html frontend/js/vitals-repository.js frontend/js/vitals.js
git commit -m "feat: mostra quem registrou cada sinal vital no historico"
```

---

## Task 27: Medicamentos — coluna "Registrado por" nas doses do dia

**Files:**
- Modify: `frontend/medicamentos.html`
- Modify: `frontend/js/medications.js`

**Interfaces:**
- Consumes: `dose.authorProfileName` retornado pela API (Task 10).

- [ ] **Step 1: Adicionar a coluna na tabela de Acompanhamento**

Em `frontend/medicamentos.html`, trocar:

```html
          <table><thead><tr><th>Horário</th><th>Medicamento</th><th>Dosagem</th><th>Status</th><th>Ações</th></tr></thead><tbody id="daily-body"></tbody></table>
```

por:

```html
          <table><thead><tr><th>Horário</th><th>Medicamento</th><th>Dosagem</th><th>Status</th><th>Registrado por</th><th>Ações</th></tr></thead><tbody id="daily-body"></tbody></table>
```

- [ ] **Step 2: Atualizar `loadDaily` em `medications.js`**

Em `frontend/js/medications.js`, na função `loadDaily`, trocar:

```javascript
    row.append(cell(dose.time), cell(dose.name), cell(dose.dosage), cell(labels[dose.status]), actions); dailyBody.append(row);
```

por:

```javascript
    row.append(cell(dose.time), cell(dose.name), cell(dose.dosage), cell(labels[dose.status]), cell(dose.authorProfileName), actions); dailyBody.append(row);
```

- [ ] **Step 3: Testar manualmente**

Com um perfil ativo, marcar uma dose como "Administrado" na aba Acompanhamento.
Expected: a linha passa a mostrar o nome do cuidador na coluna "Registrado por"; doses ainda
pendentes mostram "—".

- [ ] **Step 4: Commit**

```bash
git add frontend/medicamentos.html frontend/js/medications.js
git commit -m "feat: mostra quem administrou cada dose de medicamento"
```

---

## Task 28: Agenda — coluna "Registrado por" nos eventos do dia

**Files:**
- Modify: `frontend/agenda.html`
- Modify: `frontend/js/agenda.js`

**Interfaces:**
- Consumes: `item.completedByProfileName` retornado pela API (Task 12).

- [ ] **Step 1: Adicionar a coluna na tabela de eventos do dia**

Em `frontend/agenda.html`, trocar:

```html
            <div class="table-wrapper" id="daily-wrapper" hidden><table><thead><tr><th>Horário</th><th>Título</th><th>Categoria</th><th>Status</th><th>Ações</th></tr></thead><tbody id="daily-body"></tbody></table></div>
```

por:

```html
            <div class="table-wrapper" id="daily-wrapper" hidden><table><thead><tr><th>Horário</th><th>Título</th><th>Categoria</th><th>Status</th><th>Registrado por</th><th>Ações</th></tr></thead><tbody id="daily-body"></tbody></table></div>
```

- [ ] **Step 2: Atualizar `renderDaily` em `agenda.js`**

Em `frontend/js/agenda.js`, na função `renderDaily`, trocar:

```javascript
    row.append(cell(item.eventTime), cell(item.title), cell(item.category), cell(STATUS_LABELS[item.status]), actions);
```

por:

```javascript
    row.append(cell(item.eventTime), cell(item.title), cell(item.category), cell(STATUS_LABELS[item.status]), cell(item.completedByProfileName), actions);
```

Como `events.js` usa `EventsRepository.getAll` (não `getDaily`) para popular `events` (ver
`loadMonth`), confirmar que `frontend/js/events-repository.js` repassa o campo
`completedByProfileName` sem filtrar — como esse repository hoje faz `return
(await request(...)).data` diretamente (sem mapear campo a campo, diferente de
`vitals-repository.js`), o campo já vem pronto da API sem precisar de nenhuma edição nesse
arquivo.

- [ ] **Step 3: Testar manualmente**

Marcar um evento como concluído/não realizado no dia selecionado.
Expected: a coluna "Registrado por" mostra o nome do cuidador que marcou; eventos ainda
pendentes mostram "—".

- [ ] **Step 4: Commit**

```bash
git add frontend/agenda.html frontend/js/agenda.js
git commit -m "feat: mostra quem marcou o status de cada evento da agenda"
```

---

## Task 29: Dashboard — autor ao lado do título nas tarefas de hoje

**Files:**
- Modify: `frontend/js/dashboard.js`

**Interfaces:**
- Consumes: `activity.authorProfileName` (routines), `dose.authorProfileName` (medications),
  `eventItem.completedByProfileName` (events) — todos já retornados pelas Tasks 10-12.

- [ ] **Step 1: Repassar o autor para cada tipo de item em `loadTasks`**

Em `frontend/js/dashboard.js`, na função `loadTasks`, adicionar `authorName` em cada `.map`:

```javascript
  const items = [
    ...activities.map((activity) => ({
      time: activity.time,
      kind: "routine",
      id: activity.id,
      title: activity.title,
      subtitle: `Atividade · ${activity.category}`,
      status: activity.status,
      isFixed: activity.isFixed,
      authorName: activity.authorProfileName,
      doneLabel: "Concluir",
      doneStatus: "completed",
      skipLabel: "Não realizada",
      skipStatus: "skipped",
    })),
    ...doses.map((dose) => ({
      time: dose.time,
      kind: "medication",
      id: dose.scheduleId,
      medicationId: dose.medicationId,
      title: dose.name,
      subtitle: `Medicamento · ${dose.dosage}`,
      status: dose.status,
      authorName: dose.authorProfileName,
      doneLabel: "Administrado",
      doneStatus: "taken",
      skipLabel: "Ignorado",
      skipStatus: "skipped",
    })),
    ...dailyEvents.map((eventItem) => ({
      time: eventItem.time,
      kind: "event",
      id: eventItem.id,
      title: eventItem.title,
      subtitle: `Evento${eventItem.category ? ` · ${eventItem.category}` : ""}`,
      status: eventItem.status,
      authorName: eventItem.completedByProfileName,
      doneLabel: "Concluir",
      doneStatus: "completed",
      skipLabel: "Não realizado",
      skipStatus: "skipped",
    })),
  ].sort((first, second) => first.time.localeCompare(second.time) || first.title.localeCompare(second.title));
```

- [ ] **Step 2: Mostrar o autor ao lado do título em `taskRow`**

Em `frontend/js/dashboard.js`, na função `taskRow`, trocar:

```javascript
  const title = document.createElement("p");
  title.className = "today-item__title";
  if (item.isFixed) title.innerHTML = `${icon("pin")}${item.title}`;
  else title.textContent = item.title;
```

por:

```javascript
  const title = document.createElement("p");
  title.className = "today-item__title";
  const titleText = item.isFixed ? `${icon("pin")}${item.title}` : item.title;
  title.innerHTML = titleText;
  if (item.authorName) {
    const author = document.createElement("span");
    author.className = "today-item__author";
    author.textContent = ` · ${item.authorName}`;
    title.append(author);
  }
```

- [ ] **Step 3: Adicionar o estilo do autor**

Em `frontend/css/styles.css`, adicionar:

```css
.today-item__author {
  font-size: 0.82rem;
  font-weight: 500;
  color: var(--text-secondary);
}
```

- [ ] **Step 4: Testar manualmente**

Marcar uma atividade, uma dose e um evento como concluídos no Dashboard, com perfis diferentes
ativos em cada ação (trocar de cuidador entre uma marcação e outra).
Expected: cada linha da lista "Tarefas de hoje" mostra o nome do cuidador que concluiu, ao lado
do título (não centralizado). Itens ainda pendentes não mostram autor (porque ainda não têm
um).

- [ ] **Step 5: Commit**

```bash
git add frontend/js/dashboard.js frontend/css/styles.css
git commit -m "feat: mostra quem concluiu cada tarefa ao lado do titulo no dashboard"
```

---

## Verificação final

- [ ] **Step 1: Rodar toda a suíte de backend**

Run: `cd backend && npm test`
Expected: PASS — todos os testes (os que já existiam + os novos das Tasks 1, 6, 8-13).

- [ ] **Step 2: Fluxo manual completo, ponta a ponta**

Com o backend (`npm run dev`) e o frontend (`npx http-server frontend -p 5500`) rodando:

1. Login na conta.
2. Ir em "Meu perfil" → "Cuidadores" e cadastrar 2 cuidadores com cores diferentes.
3. Recarregar qualquer tela → deve redirecionar para `perfis.html`.
4. Escolher um avatar → cai no Dashboard, nome aparece na barra lateral com "· Trocar".
5. Registrar um sinal vital, uma anotação, marcar uma dose de remédio e um evento como
   concluído.
6. Conferir que cada registro/marcação mostra o nome desse cuidador no lugar certo (histórico
   de sinais vitais, tabela de anotações, doses do dia, dashboard).
7. Clicar em "Trocar", escolher o segundo cuidador, repetir uma ação (ex.: marcar outra dose).
8. Abrir a mesma tela em uma segunda aba (mesma conta, mesmo perfil ou perfil diferente) e
   confirmar que a ação do Step 7 aparece na segunda aba sem precisar recarregar.

Expected: todos os passos funcionam sem erros no console do navegador.

- [ ] **Step 3: Commit final (se sobrar algum ajuste do Step 2)**

```bash
git status
```
Se houver mudanças pendentes de ajustes encontrados no teste manual, revisar, testar de novo e
commitar normalmente seguindo o padrão das tasks anteriores.
