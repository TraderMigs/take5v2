(() => {
  const form = document.getElementById('courtSearch');
  const input = document.getElementById('courtSearchInput');
  const locationButton = document.getElementById('useLocationButton');

  if (!form || !input) return;

  function cleanText(value) {
    return value.trim().replace(/\s+/g, ' ');
  }

  function buildPickleballQuery(value) {
    const raw = cleanText(value);
    if (!raw) return 'pickleball courts games clubs lessons near me';

    const lower = raw.toLowerCase();
    const alreadyPickleball = lower.includes('pickleball');
    const hasCourt = lower.includes('court') || lower.includes('courts');
    const hasLesson = lower.includes('lesson') || lower.includes('coach') || lower.includes('training');
    const hasTournament = lower.includes('tournament') || lower.includes('league') || lower.includes('event');
    const hasClub = lower.includes('club') || lower.includes('open play') || lower.includes('game') || lower.includes('games');

    if (alreadyPickleball) return raw;
    if (hasLesson) return `pickleball lessons coaches training in ${raw}`;
    if (hasTournament) return `pickleball tournaments leagues events in ${raw}`;
    if (hasClub) return `pickleball clubs open play games in ${raw}`;
    if (hasCourt) return `pickleball courts in ${raw}`;

    return `pickleball courts games clubs lessons in ${raw}`;
  }

  function openMaps(query) {
    const url = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
    window.open(url, '_blank', 'noopener,noreferrer');
  }

  form.addEventListener('submit', (event) => {
    event.preventDefault();
    event.stopImmediatePropagation();
    openMaps(buildPickleballQuery(input.value));
  }, true);

  if (locationButton) {
    locationButton.addEventListener('click', () => {
      if (!navigator.geolocation) {
        openMaps('pickleball courts games clubs lessons near me');
        return;
      }

      locationButton.classList.add('is-loading');
      locationButton.setAttribute('aria-label', 'Finding your location');

      navigator.geolocation.getCurrentPosition(
        (position) => {
          const { latitude, longitude } = position.coords;
          locationButton.classList.remove('is-loading');
          locationButton.setAttribute('aria-label', 'Use my location for pickleball search');
          openMaps(`pickleball courts games clubs lessons near ${latitude},${longitude}`);
        },
        () => {
          locationButton.classList.remove('is-loading');
          locationButton.setAttribute('aria-label', 'Use my location for pickleball search');
          openMaps(buildPickleballQuery(input.value));
        },
        {
          enableHighAccuracy: false,
          timeout: 7000,
          maximumAge: 300000
        }
      );
    });
  }
})();
