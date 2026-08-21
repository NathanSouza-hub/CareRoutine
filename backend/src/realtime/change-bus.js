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
