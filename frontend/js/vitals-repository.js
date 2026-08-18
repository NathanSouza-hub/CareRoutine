const VitalsRepository = (() => {
  const STORAGE_KEY = "careRoutine:vitals";

  function createId() {
    return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  }

  function write(records) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
  }

  function getAll() {
    const storedRecords = localStorage.getItem(STORAGE_KEY);
    if (!storedRecords) return [];

    try {
      const parsedRecords = JSON.parse(storedRecords);
      if (!Array.isArray(parsedRecords)) return [];

      const migratedRecords = parsedRecords.map((record) => ({
        ...record,
        id: record.id || createId(),
      }));

      if (migratedRecords.some((record, index) => record.id !== parsedRecords[index].id)) {
        write(migratedRecords);
      }

      return migratedRecords;
    } catch {
      return [];
    }
  }

  function create(record) {
    const newRecord = { ...record, id: createId() };
    write([...getAll(), newRecord]);
    return newRecord;
  }

  function update(id, updatedRecord) {
    write(getAll().map((record) => (record.id === id ? { ...updatedRecord, id } : record)));
  }

  function remove(id) {
    write(getAll().filter((record) => record.id !== id));
  }

  function findById(id) {
    return getAll().find((record) => record.id === id);
  }

  return Object.freeze({ create, findById, getAll, remove, update });
})();
