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
