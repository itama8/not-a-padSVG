const SVG = 'http://www.w3.org/2000/svg';

// Artwork and interaction remain owned by the host; this only switches treatment.
export function setCounterTreatment(button, diverted) {
  let message = button.querySelector('[data-counter-message]');
  if (!message) {
    message = document.createElementNS(SVG, 'g');
    message.setAttribute('data-counter-message', '');
    message.setAttribute('fill', '#c52d35');
    message.setAttribute('text-anchor', 'middle');
    message.setAttribute('font-family', 'ui-monospace, monospace');
    message.setAttribute('font-size', '14');
    for (const [line, y] of [['nice try,', 22], ['thanks a lot :)', 148]]) {
      const text = document.createElementNS(SVG, 'text');
      text.setAttribute('x', '110');
      text.setAttribute('y', y);
      text.textContent = line;
      message.append(text);
    }
    button.querySelector('svg').append(message);
  }
  message.style.display = diverted ? '' : 'none';
  button.querySelector('#want-label').style.display = diverted ? 'none' : '';
  button.querySelector('#want-count').style.fill = diverted ? '#c52d35' : '';
  button.dataset.diverted = String(diverted);
  button.setAttribute('aria-label', diverted ? 'nice try, thanks a lot :)' : 'I WANT THIS');
}
