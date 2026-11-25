import { setCounterTreatment } from './ui/want-counter/treatment.js';

(() => {
  const button = document.querySelector('#want');
  const label = document.querySelector('#want-label');
  const underline = document.querySelector('#want-underline');
  const count = document.querySelector('#want-count');
  const description = document.querySelector('#want-total');
  const status = document.querySelector('#want-status');
  const reduce = matchMedia('(prefers-reduced-motion: reduce)');
  const format = new Intl.NumberFormat();
  const local = ['localhost', '127.0.0.1', '[::1]'].includes(location.hostname);
  const endpoint = window.wantCounterSocket || (local ? `ws://${location.host}/api/want` : '');
  const BATCH_MS = 250, MAX_BATCH = 100;
  const CATCH_UP_STEPS = 8, CATCH_UP_STEP_MS = 24;
  const labelOrbit = [
    [133, 136, -3], [68, 131, -7], [24, 80, -90], [72, 28, -6],
    [110, 20, 0], [152, 28, 7], [196, 80, 90], [153, 133, 6],
  ];
  const numberOrigins = [
    [-14, 0], [-10, -9], [0, -12], [10, -9],
    [14, 0], [10, 9], [0, 12], [-10, 9],
  ];
  const address = endpoint ? new URL(endpoint) : null;
  if (address) address.searchParams.set('client', crypto.randomUUID());
  let socket, retry, labelIndex = 0, numberIndex = -1;
  let arrivals = [];
  let delay = 1000, total = null, taps = 0, accepted = 0, sentThrough = null, batchTimer;
  let displayed = 0, catchUpSteps = 0, catchUpTimer;
  let diverted = false, lease, connecting = false;
  const sessionAddress = address ? new URL('/api/want/session', address) : null;
  if (sessionAddress) sessionAddress.protocol = address.protocol === 'wss:' ? 'https:' : 'http:';
  const sessionKey = 'want-session:' + sessionAddress?.origin;
  try { lease = JSON.parse(localStorage.getItem(sessionKey)); } catch (_) { /* Storage may be disabled. */ }
  setCounterTreatment(button, false);

  async function session() {
    if (lease?.token && lease.expires > Date.now() + 60_000) return lease.token;
    const response = await fetch(sessionAddress, { method: 'POST' });
    if (!response.ok) throw new Error('Session unavailable');
    lease = await response.json();
    if (typeof lease.token !== 'string' || !Number.isSafeInteger(lease.expires)) throw new Error('Invalid session');
    try { localStorage.setItem(sessionKey, JSON.stringify(lease)); } catch (_) { /* In-memory session still works. */ }
    // A new session has its own receipts. Resend only clicks not yet acknowledged.
    taps -= accepted;
    accepted = 0;
    return lease.token;
  }

  function nextPosition(previous, length) {
    if (previous < 0) return Math.floor(Math.random() * length);
    return (previous + 1 + Math.floor(Math.random() * (length - 1))) % length;
  }

  function animateUpdate() {
    if (!underline) return;
    arrivals.forEach(animation => animation.cancel());
    labelIndex = nextPosition(labelIndex, labelOrbit.length);
    const [x, y, angle] = labelOrbit[labelIndex];
    label.setAttribute('transform', `translate(${x} ${y}) rotate(${angle})`);
    if (reduce.matches || document.hidden) return;

    numberIndex = nextPosition(numberIndex, numberOrigins.length);
    const [dx, dy] = numberOrigins[numberIndex];
    const easing = 'cubic-bezier(.16, .75, .3, 1)';
    arrivals = [
      count.animate([
        { transform: `translate(${dx}px, ${dy}px)`, opacity: .1 },
        { transform: 'none', opacity: 1 },
      ], { duration: 240, easing }),
      label.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 160, easing }),
      underline.animate([
        { strokeDasharray: '1 1', strokeDashoffset: 1 },
        { strokeDasharray: '1 1', strokeDashoffset: 0 },
      ], { duration: 300, easing }),
    ];
  }

  function setStatus(text, ready = false) {
    if (status.textContent !== text) status.textContent = text;
    button.setAttribute('aria-disabled', String(!ready));
  }

  function renderTotal() {
    const text = (total === null ? '+' : '') + format.format(displayed);
    const previous = count.textContent;
    description.textContent = total === null ? `${format.format(displayed)} local clicks pending`
      : text + (diverted ? ' diverted clicks' : (displayed === 1 ? ' click' : ' clicks'));
    if (text === previous) return;
    count.textContent = text;
    if (text.length !== previous.length) {
      count.style.fontSize = '';
      const width = count.getComputedTextLength();
      // Leave space beside the widest total for the lettering and the entrance.
      const maxWidth = 142;
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

  async function connect() {
    if (connecting) return;
    connecting = true;
    setStatus(total === null ? 'connecting' : 'reconnecting', true);
    sentThrough = null;
    try {
      address.searchParams.set('session', await session());
    } catch (_) {
      connecting = false;
      setStatus('reconnecting', true);
      retry = setTimeout(connect, delay);
      delay = Math.min(delay * 2, 15000);
      return;
    }
    connecting = false;
    const connection = new WebSocket(address);
    let received = false;
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
      const nextDiverted = snapshot?.diverted === true;
      const switched = nextDiverted !== diverted;
      if (!Number.isSafeInteger(next) || !Number.isSafeInteger(acknowledged) ||
          next < 0 || acknowledged < accepted || acknowledged > taps ||
          (!switched && total !== null && next - total < acknowledged - accepted)) return;
      received = true;
      const reconnecting = sentThrough === null;
      const firstTotal = total === null;
      const remote = !firstTotal && next - total > acknowledged - accepted;
      diverted = nextDiverted;
      setCounterTreatment(button, diverted);
      total = next;
      accepted = acknowledged;
      sentThrough = Math.max(sentThrough ?? 0, accepted);
      if (firstTotal || switched) {
        clearTimeout(catchUpTimer);
        catchUpTimer = undefined;
        displayed = total + (taps - accepted);
        renderTotal();
      } else if (remote) {
        catchUpSteps = CATCH_UP_STEPS;
        if (catchUpTimer === undefined) catchUp();
        animateUpdate();
      }
      delay = 1000;
      setStatus(diverted ? 'nice try, thanks a lot :)' : 'live', true);
      if (reconnecting) flush(); else scheduleFlush();
    });
    connection.addEventListener('close', event => {
      // Refresh after an expired session or an IP change, including failed upgrades.
      if (!received || event.code === 1008) {
        lease = undefined;
        try { localStorage.removeItem(sessionKey); } catch (_) { /* Optional persistence. */ }
      }
      if (socket !== connection) return;
      clearTimeout(batchTimer);
      batchTimer = undefined;
      sentThrough = null;
      setStatus('reconnecting', true);
      retry = setTimeout(connect, delay);
      delay = Math.min(delay * 2, 15000);
    });
  }

  button.addEventListener('click', () => {
    if (button.getAttribute('aria-disabled') === 'true') return;
    taps++;
    displayed++;
    renderTotal();
    animateUpdate();
    scheduleFlush();
  });

  reduce.addEventListener('change', () => {
    if (!reduce.matches) return;
    arrivals.forEach(animation => animation.cancel());
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
