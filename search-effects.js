(() => {
  const input = document.getElementById('courtSearchInput');
  if (!input) return;

  const phrases = [
    'Search for a pickleball game near you',
    'Find pickleball courts near you',
    'Search open play near you',
    'Find local pickleball lessons'
  ];

  let phraseIndex = 0;
  let letterIndex = 0;
  let deleting = false;
  let lastRun = 0;
  let pauseUntil = 0;

  function tick(now) {
    if (document.activeElement === input || input.value.length > 0) {
      requestAnimationFrame(tick);
      return;
    }

    if (now < pauseUntil) {
      requestAnimationFrame(tick);
      return;
    }

    const delay = deleting ? 38 : 62;
    if (now - lastRun < delay) {
      requestAnimationFrame(tick);
      return;
    }

    lastRun = now;
    const phrase = phrases[phraseIndex];

    if (!deleting) {
      letterIndex += 1;
      input.placeholder = phrase.slice(0, letterIndex);
      if (letterIndex >= phrase.length) {
        pauseUntil = now + 5000;
        deleting = true;
      }
    } else {
      letterIndex -= 1;
      input.placeholder = phrase.slice(0, Math.max(0, letterIndex));
      if (letterIndex <= 0) {
        deleting = false;
        phraseIndex = (phraseIndex + 1) % phrases.length;
        pauseUntil = now + 450;
      }
    }

    requestAnimationFrame(tick);
  }

  input.placeholder = '';
  requestAnimationFrame(tick);
})();
