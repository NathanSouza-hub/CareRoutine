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
