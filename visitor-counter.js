(() => {
  const todayEl = document.getElementById('visitorsToday');
  const lifetimeEl = document.getElementById('visitorsLifetime');
  if (!todayEl || !lifetimeEl) return;

  const SUPABASE_URL = 'https://ziqwbbthwfhjitcagzmn.supabase.co';
  const SUPABASE_KEY = 'sb_publishable_EwQBz4m7EvN1HQhVhed9Vw_vMN0WEqF';
  const STORAGE_KEY = 'take5VisitorId';

  function createVisitorId() {
    if (window.crypto && typeof window.crypto.randomUUID === 'function') {
      return window.crypto.randomUUID();
    }
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (char) => {
      const value = Math.random() * 16 | 0;
      const id = char === 'x' ? value : (value & 0x3 | 0x8);
      return id.toString(16);
    });
  }

  function getVisitorId() {
    let id = localStorage.getItem(STORAGE_KEY);
    if (!id) {
      id = createVisitorId();
      localStorage.setItem(STORAGE_KEY, id);
    }
    return id;
  }

  function formatNumber(value) {
    const number = Number(value || 0);
    return number.toLocaleString('en-US');
  }

  async function callCounter(functionName, body) {
    const response = await fetch(`${SUPABASE_URL}/rest/v1/rpc/${functionName}`, {
      method: 'POST',
      headers: {
        apikey: SUPABASE_KEY,
        Authorization: `Bearer ${SUPABASE_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(body || {})
    });

    if (!response.ok) throw new Error('Counter request failed');
    return response.json();
  }

  async function updateCounter() {
    try {
      const visitorId = getVisitorId();
      const counts = await callCounter('take5_track_visit', { p_visitor_id: visitorId });
      todayEl.textContent = formatNumber(counts.today);
      lifetimeEl.textContent = formatNumber(counts.lifetime);
    } catch (error) {
      try {
        const counts = await callCounter('take5_get_counts');
        todayEl.textContent = formatNumber(counts.today);
        lifetimeEl.textContent = formatNumber(counts.lifetime);
      } catch {
        todayEl.textContent = '—';
        lifetimeEl.textContent = '—';
      }
    }
  }

  updateCounter();
  setInterval(updateCounter, 60000);
})();
