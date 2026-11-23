(() => {
  const button = document.querySelector('#want');
  const label = document.querySelector('#want-label');
  const count = document.querySelector('#want-count');
  const description = document.querySelector('#want-total');
  const status = document.querySelector('#want-status');
  const reduce = matchMedia('(prefers-reduced-motion: reduce)');
  const format = new Intl.NumberFormat();
  const local = ['localhost', '127.0.0.1', '[::1]'].includes(location.hostname);
  const endpoint = window.wantCounterSocket || (local ? `ws://${location.host}/api/want` : '');
  let socket, retry, pulse, labelPress, countPress, pressPointer;
  let delay = 1000, total = null;

  function animatePress() {
    pulse?.cancel();
    labelPress?.cancel();
    countPress?.cancel();
    const restingInk = getComputedStyle(count).fillOpacity;
    if (reduce.matches) {
      countPress = count.animate([{ fillOpacity: .56 }, { fillOpacity: restingInk }],
        { duration: 140 });
    } else {
      const timing = { duration: 200, easing: 'cubic-bezier(.2, .7, .25, 1)' };
      labelPress = label.animate([{ transform: 'scale(.82)' }, { transform: 'none' }], timing);
      countPress = count.animate([
        { transform: 'scale(1.12)', fillOpacity: .56 },
        { transform: 'none', fillOpacity: restingInk },
      ], timing);
    }
  }

  function releasePress() {
    if (pressPointer === undefined) return;
    pressPointer = undefined;
    if (labelPress?.playState === 'paused') labelPress.play();
    if (countPress?.playState === 'paused') countPress.play();
  }

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
        // Leave room for the count to grow within the button when pressed.
        const maxWidth = 140;
        if (width > maxWidth) {
          const fontSize = parseFloat(getComputedStyle(count).fontSize);
          count.style.fontSize = `${fontSize * maxWidth / width}px`;
        }
        pulse?.cancel();
        if (total !== null && !reduce.matches && pressPointer === undefined && countPress?.playState !== 'running') {
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

  button.addEventListener('pointerdown', (e) => {
    if (e.button !== 0 || pressPointer !== undefined || button.getAttribute('aria-disabled') === 'true') return;
    pressPointer = e.pointerId;
    animatePress();
    // Hold the first frame until release, including when the reveal captures the touch.
    if (!reduce.matches) labelPress.pause();
    countPress.pause();
  });
  for (const type of ['pointerup', 'pointercancel', 'lostpointercapture']) {
    addEventListener(type, (e) => { if (e.pointerId === pressPointer) releasePress(); }, true);
  }
  addEventListener('blur', releasePress);

  button.addEventListener('click', () => {
    if (button.getAttribute('aria-disabled') === 'false' && socket.readyState === WebSocket.OPEN) {
      socket.send('click');
      animatePress();
    }
  });

  reduce.addEventListener('change', () => {
    if (!reduce.matches) return;
    pulse?.cancel();
    labelPress?.cancel();
    countPress?.cancel();
  });

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
