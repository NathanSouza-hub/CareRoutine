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
