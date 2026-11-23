(() => {
  const button = document.querySelector('#want');
  const count = document.querySelector('#want-count');
  const description = document.querySelector('#want-total');
  const status = document.querySelector('#want-status');
  const reduce = matchMedia('(prefers-reduced-motion: reduce)');
  const format = new Intl.NumberFormat();
  const local = ['localhost', '127.0.0.1', '[::1]'].includes(location.hostname);
  const endpoint = window.wantCounterSocket || (local ? `ws://${location.host}/api/want` : '');
  let socket, retry, pulse;
  let delay = 1000, total = null;

  function setStatus(text, ready = false) {
    status.textContent = text;
    button.setAttribute('aria-disabled', String(!ready));
  }

  function connect() {
    setStatus(total === null ? 'connecting' : 'reconnecting');
    const connection = new WebSocket(endpoint);
    socket = connection;
    connection.addEventListener('message', ({ data }) => {
      if (socket !== connection || !/^\d+$/.test(data)) return;
      const next = Number(data);
      if (!Number.isSafeInteger(next) || (total !== null && next < total)) return;
      if (next !== total) {
        count.textContent = format.format(next);
        description.textContent = count.textContent + (next === 1 ? ' click' : ' clicks');
        count.style.fontSize = '';
        const width = count.getComputedTextLength();
        if (width > 148) {
          const fontSize = parseFloat(getComputedStyle(count).fontSize);
          count.style.fontSize = `${fontSize * 148 / width}px`;
        }
        pulse?.cancel();
        if (total !== null && !reduce.matches) {
          pulse = count.animate([{ opacity: .45 }, { opacity: 1 }], { duration: 180, easing: 'ease-out' });
        }
        total = next;
      }
      delay = 1000;
      if (button.getAttribute('aria-disabled') === 'true') setStatus('live', true);
    });
    connection.addEventListener('close', () => {
      if (socket !== connection) return;
      setStatus('reconnecting');
      retry = setTimeout(connect, delay);
      delay = Math.min(delay * 2, 15000);
    });
  }

  button.addEventListener('click', () => {
    if (button.getAttribute('aria-disabled') === 'false' && socket.readyState === WebSocket.OPEN) {
      socket.send('click');
    }
  });

  reduce.addEventListener('change', () => { if (reduce.matches) pulse?.cancel(); });

  if (!endpoint) {
    setStatus('counter offline');
    return;
  }
  addEventListener('pagehide', () => {
    clearTimeout(retry);
    const connection = socket;
    socket = undefined;
    connection?.close();
  });
  addEventListener('pageshow', ({ persisted }) => { if (persisted) connect(); });
  connect();
})();
