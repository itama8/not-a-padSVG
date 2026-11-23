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
  const BATCH_MS = 250, MAX_BATCH = 100;
  const CATCH_UP_STEPS = 8, CATCH_UP_STEP_MS = 24;
  const address = endpoint ? new URL(endpoint) : null;
  if (address) address.searchParams.set('client', crypto.randomUUID());
  let socket, retry, labelPress, countPress, pressPointer;
  let delay = 1000, total = null, taps = 0, accepted = 0, sentThrough = null, batchTimer;
  let displayed = 0, catchUpSteps = 0, catchUpTimer;

  function animatePress() {
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
    if (status.textContent !== text) status.textContent = text;
    button.setAttribute('aria-disabled', String(!ready));
  }

  function renderTotal() {
    const text = (total === null ? '+' : '') + format.format(displayed);
    const previous = count.textContent;
    if (text === previous) return;
    count.textContent = text;
    description.textContent = total === null ? `${format.format(displayed)} local clicks pending`
      : text + (displayed === 1 ? ' click' : ' clicks');
    if (text.length !== previous.length) {
      count.style.fontSize = '';
      const width = count.getComputedTextLength();
      // Leave room for the count to grow within the button when pressed.
      const maxWidth = 140;
      if (width > maxWidth) {
        const fontSize = parseFloat(getComputedStyle(count).fontSize);
        count.style.fontSize = `${fontSize * maxWidth / width}px`;
      }
    }
  }

  function catchUp() {
    clearTimeout(catchUpTimer);
    catchUpTimer = undefined;
    const target = total + (taps - accepted);
    if (displayed >= target) return;
    const steps = reduce.matches || document.hidden ? 1 : catchUpSteps;
    displayed += Math.ceil((target - displayed) / Math.max(1, steps));
    catchUpSteps--;
    renderTotal();
    if (displayed < target) catchUpTimer = setTimeout(catchUp, CATCH_UP_STEP_MS);
  }

  // Send the cumulative number of taps so reconnects can safely retry any unacknowledged batch.
  function nextBatch() {
    return Math.min(taps, accepted + MAX_BATCH);
  }

  function flush() {
    clearTimeout(batchTimer);
    batchTimer = undefined;
    if (socket?.readyState !== WebSocket.OPEN || sentThrough === null) return;
    const through = nextBatch();
    if (through <= sentThrough) return;
    socket.send(String(through));
    sentThrough = through;
  }

  function scheduleFlush() {
    if (sentThrough !== null && nextBatch() > sentThrough && batchTimer === undefined) {
      batchTimer = setTimeout(flush, BATCH_MS);
    }
  }

  function connect() {
    setStatus(total === null ? 'connecting' : 'reconnecting', true);
    sentThrough = null;
    const connection = new WebSocket(address);
    socket = connection;
    connection.addEventListener('message', ({ data }) => {
      if (socket !== connection) return;
      let snapshot;
      try { snapshot = JSON.parse(data); } catch (_) { return; }
      if (Number.isSafeInteger(snapshot)) {
        setStatus('counter update required');
        return;
      }
      const next = snapshot?.total, acknowledged = snapshot?.accepted;
      if (!Number.isSafeInteger(next) || !Number.isSafeInteger(acknowledged) ||
          acknowledged < accepted || acknowledged > taps || next < acknowledged ||
          (total !== null && next - total < acknowledged - accepted)) return;
      const reconnecting = sentThrough === null;
      const firstTotal = total === null;
      const remote = !firstTotal && next - total > acknowledged - accepted;
      total = next;
      accepted = acknowledged;
      sentThrough = Math.max(sentThrough ?? 0, accepted);
      if (firstTotal) {
        displayed = total + (taps - accepted);
        renderTotal();
      } else if (remote) {
        catchUpSteps = CATCH_UP_STEPS;
        if (catchUpTimer === undefined) catchUp();
      }
      delay = 1000;
      setStatus('live', true);
      if (reconnecting) flush(); else scheduleFlush();
    });
    connection.addEventListener('close', () => {
      if (socket !== connection) return;
      clearTimeout(batchTimer);
      batchTimer = undefined;
      sentThrough = null;
      setStatus('reconnecting', true);
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
    if (button.getAttribute('aria-disabled') === 'true') return;
    taps++;
    displayed++;
    renderTotal();
    animatePress();
    scheduleFlush();
  });

  reduce.addEventListener('change', () => {
    if (!reduce.matches) return;
    labelPress?.cancel();
    countPress?.cancel();
    if (catchUpTimer !== undefined) catchUp();
  });

  if (!endpoint) {
    setStatus('counter offline');
    return;
  }
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) return;
    if (catchUpTimer !== undefined) catchUp();
    flush();
  });
  addEventListener('pagehide', () => {
    flush();
    clearTimeout(retry);
    const connection = socket;
    socket = undefined;
    connection?.close();
  });
  addEventListener('pageshow', ({ persisted }) => { if (persisted) connect(); });
  connect();
})();
