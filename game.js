(() => {
  const canvas = document.getElementById('gameCanvas');
  const stage = document.getElementById('gameStage');
  const ctx = canvas.getContext('2d', { alpha: false });
  const startButton = document.getElementById('startButton');
  const message = document.getElementById('gameMessage');
  const scoreValue = document.getElementById('scoreValue');
  const streakValue = document.getElementById('streakValue');
  const bestValue = document.getElementById('bestValue');
  const powerFill = document.getElementById('powerFill');
  const searchForm = document.getElementById('courtSearch');
  const searchInput = document.getElementById('courtSearchInput');

  const NET_TOP = 0.42;
  const NET_BOTTOM = 0.495;
  const PLAYER_MIN_Y = 0.58;
  const PLAYER_MAX_Y = 0.95;
  const BOT_Y = 0.24;

  const state = {
    running: false,
    score: 0,
    streak: 0,
    best: Number(localStorage.getItem('take5PickleballBest') || 0),
    width: 0,
    height: 0,
    dpr: 1,
    lastTime: 0,
    keys: new Set(),
    charging: false,
    chargeStart: 0,
    power: 0,
    playerSwing: 0,
    botSwing: 0,
    freeze: 0,
    particles: [],
    player: { x: 0.5, y: 0.82 },
    bot: { x: 0.5, targetX: 0.5 },
    ball: { x: 0.5, y: BOT_Y, vx: 0, vy: 0, size: 0.02, active: false, direction: 'idle', pop: 0, trail: [] },
  };

  const stars = Array.from({ length: 22 }, (_, i) => ({ x: i * 137.5, y: i * 91.7, r: i % 3 ? 0.65 : 1.1 }));
  bestValue.textContent = String(state.best);

  function rand(min, max) { return min + Math.random() * (max - min); }
  function clamp(v, min, max) { return Math.max(min, Math.min(max, v)); }
  function setMessage(text) { message.textContent = text; }
  function updateHud() {
    scoreValue.textContent = String(state.score);
    streakValue.textContent = String(state.streak);
    bestValue.textContent = String(state.best);
  }

  function courtPoint(x, y) {
    const center = state.width / 2;
    const topY = state.height * 0.08;
    const bottomY = state.height * 0.96;
    const p = clamp(y, 0, 1);
    const half = state.width * 0.26 + (state.width * 0.48 - state.width * 0.26) * Math.pow(p, 0.92);
    return { x: center + (x - 0.5) * half * 2, y: topY + p * (bottomY - topY), half };
  }

  function courtXFromScreen(screenX, courtY) {
    const rect = canvas.getBoundingClientRect();
    const localX = screenX - rect.left;
    const mid = courtPoint(0.5, courtY);
    return clamp(0.5 + (localX - mid.x) / (mid.half * 2), 0.05, 0.95);
  }

  function placeSearchBar() {
    const upperLeft = courtPoint(0.13, NET_TOP);
    const upperRight = courtPoint(0.87, NET_TOP);
    const upperMid = courtPoint(0.5, NET_TOP);
    const lowerMid = courtPoint(0.5, NET_BOTTOM);
    const laneCenter = (upperMid.y + lowerMid.y) / 2;
    const laneHeight = Math.max(28, Math.abs(lowerMid.y - upperMid.y) - 8);
    const width = Math.min(Math.max(330, (upperRight.x - upperLeft.x) * 0.55), 470);
    searchForm.style.setProperty('--net-search-left', `${state.width / 2}px`);
    searchForm.style.setProperty('--net-search-top', `${laneCenter}px`);
    searchForm.style.setProperty('--net-search-width', `${width}px`);
    searchForm.style.setProperty('--net-search-height', `${Math.min(38, laneHeight)}px`);
  }

  function resize() {
    const rect = stage.getBoundingClientRect();
    state.dpr = Math.min(window.devicePixelRatio || 1, 2);
    state.width = Math.max(320, rect.width);
    state.height = Math.max(420, rect.height);
    canvas.width = Math.floor(state.width * state.dpr);
    canvas.height = Math.floor(state.height * state.dpr);
    canvas.style.width = `${state.width}px`;
    canvas.style.height = `${state.height}px`;
    ctx.setTransform(state.dpr, 0, 0, state.dpr, 0, 0);
    placeSearchBar();
  }

  function resetPositions() {
    state.player.x = 0.5;
    state.player.y = 0.82;
    state.bot.x = 0.5;
    state.bot.targetX = 0.5;
    state.power = 0;
    state.charging = false;
  }

  function startGame() {
    state.running = true;
    state.score = 0;
    state.streak = 0;
    state.particles = [];
    resetPositions();
    updateHud();
    serveBall(true);
    startButton.textContent = 'Restart';
    setMessage('Move to the ball. Hold click or space, then release to hit.');
  }

  function serveBall(first = false) {
    const b = state.ball;
    const startX = clamp(state.bot.x + rand(-0.06, 0.06), 0.18, 0.82);
    const targetX = rand(0.16, 0.84);
    b.x = startX;
    b.y = BOT_Y + 0.03;
    b.vx = (targetX - startX) * (first ? 0.7 : rand(0.82, 1.06));
    b.vy = first ? 0.34 : rand(0.36, 0.48);
    b.size = 0.02;
    b.active = true;
    b.direction = 'toPlayer';
    b.pop = 0;
    b.trail = [];
  }

  function endRally(text, playerWon) {
    state.charging = false;
    state.power = 0;
    if (playerWon) state.score += 1;
    else state.streak = 0;
    setMessage(text);
    updateHud();
    setTimeout(() => state.running && serveBall(), 650);
  }

  function chargePower(now) {
    if (!state.charging) {
      state.power = Math.max(0, state.power - 0.035);
      return;
    }
    state.power = clamp((now - state.chargeStart) / 720, 0, 1);
  }

  function beginCharge() {
    if (!state.running || state.charging) return;
    state.charging = true;
    state.chargeStart = performance.now();
  }

  function releaseHit() {
    if (!state.running || !state.charging) return;
    state.charging = false;
    state.playerSwing = 1;
    tryHitBall();
  }

  function playerContactDistance() {
    const ball = courtPoint(state.ball.x, state.ball.y);
    const paddle = courtPoint(state.player.x, state.player.y);
    return Math.hypot(ball.x - paddle.x, ball.y - (paddle.y - 58));
  }

  function tryHitBall() {
    const b = state.ball;
    if (!b.active || b.direction !== 'toPlayer') {
      setMessage('Wait for the ball to come back to your side.');
      return;
    }

    const inZone = b.y > 0.56 && b.y < 0.98 && playerContactDistance() < Math.max(92, state.width * 0.08);
    if (!inZone) {
      pop(state.player.x, state.player.y, '#ff5b77', 9);
      setMessage('Missed. Move closer and release when the ball reaches your paddle.');
      return;
    }

    const power = state.power;
    state.power = 0;
    if (power < 0.2) {
      b.direction = 'dead';
      pop(b.x, b.y, '#ff5b77', 16);
      endRally('Too soft. That one dropped into the net.', false);
      return;
    }
    if (power > 0.93) {
      b.direction = 'out';
      b.vx = b.x < 0.5 ? -0.38 : 0.38;
      b.vy = -0.44;
      pop(b.x, b.y, '#ffea52', 18);
      endRally('Too much power. You sent it long.', false);
      return;
    }

    const sweet = power >= 0.38 && power <= 0.78;
    const spread = sweet ? 0.3 : 0.18;
    const targetX = clamp(state.player.x + rand(-spread, spread), 0.12, 0.88);
    b.vx = (targetX - b.x) * (sweet ? 1.12 : 0.9);
    b.vy = sweet ? -0.58 : -0.48;
    b.direction = 'toBot';
    b.pop = 1;
    state.freeze = 0.045;
    state.bot.targetX = targetX;
    state.streak += 1;
    state.best = Math.max(state.best, state.streak);
    localStorage.setItem('take5PickleballBest', String(state.best));
    updateHud();
    pop(b.x, b.y, sweet ? '#59ff9a' : '#ffea52', sweet ? 26 : 17);
    setMessage(sweet ? 'Pop. Clean return. The bot is chasing it.' : 'Return cleared. Get ready.');
  }

  function botReturn() {
    const b = state.ball;
    const reach = Math.abs(b.x - state.bot.x);
    const miss = reach > 0.15 || Math.random() < (state.streak >= 7 ? 0.08 : 0.025);
    if (miss) {
      pop(b.x, b.y, '#59ff9a', 18);
      endRally('Bot missed. Point for you.', true);
      return;
    }
    const targetX = rand(0.14, 0.86);
    b.x = clamp(b.x, 0.1, 0.9);
    b.y = BOT_Y + 0.02;
    b.vx = (targetX - b.x) * rand(0.9, 1.16);
    b.vy = rand(0.38, 0.5);
    b.direction = 'toPlayer';
    b.pop = 1;
    state.botSwing = 1;
    state.freeze = 0.035;
    pop(b.x, b.y, '#59ff9a', 14);
    setMessage('Bot returned it. Move, charge, and release on contact.');
  }

  function pop(x, y, color, count) {
    for (let i = 0; i < count; i++) {
      state.particles.push({ x, y, vx: rand(-0.34, 0.34), vy: rand(-0.42, 0.16), life: rand(0.28, 0.7), max: 0.7, color, size: rand(2, 4.5) });
    }
  }

  function updateParticles(dt) {
    state.particles = state.particles.filter((p) => {
      p.life -= dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy += 0.45 * dt;
      return p.life > 0;
    });
  }

  function updatePlayer(dt) {
    const speed = 1.5;
    let ax = 0;
    let ay = 0;
    if (state.keys.has('ArrowLeft') || state.keys.has('a')) ax -= 1;
    if (state.keys.has('ArrowRight') || state.keys.has('d')) ax += 1;
    if (state.keys.has('ArrowUp') || state.keys.has('w')) ay -= 1;
    if (state.keys.has('ArrowDown') || state.keys.has('s')) ay += 1;
    if (ax || ay) {
      const len = Math.hypot(ax, ay) || 1;
      state.player.x = clamp(state.player.x + (ax / len) * speed * dt, 0.06, 0.94);
      state.player.y = clamp(state.player.y + (ay / len) * speed * dt, PLAYER_MIN_Y, PLAYER_MAX_Y);
    }
    state.playerSwing = Math.max(0, state.playerSwing - dt * 6.5);
  }

  function updateBot(dt) {
    const target = state.ball.direction === 'toBot' ? state.ball.x : state.bot.targetX;
    const speed = state.ball.direction === 'toBot' ? 1.85 : 0.9;
    state.bot.x += clamp(target - state.bot.x, -speed * dt, speed * dt);
    state.bot.x = clamp(state.bot.x, 0.12, 0.88);
    state.botSwing = Math.max(0, state.botSwing - dt * 5.5);
  }

  function updateBall(dt) {
    const b = state.ball;
    if (!state.running || !b.active) return;
    if (state.freeze > 0) {
      state.freeze -= dt;
      return;
    }
    b.trail.push({ x: b.x, y: b.y, life: 0.16 });
    b.trail = b.trail.filter((t) => ((t.life -= dt) > 0)).slice(-7);
    b.x += b.vx * dt;
    b.y += b.vy * dt;
    b.pop = Math.max(0, b.pop - dt * 5);
    if (b.direction === 'toPlayer') {
      const t = clamp((b.y - 0.24) / 0.72, 0, 1);
      b.size = 0.018 + t * 0.058;
      if (b.y > 1) endRally('Ball got past you. Track the next one.', false);
    } else if (b.direction === 'toBot') {
      const t = clamp((0.92 - b.y) / 0.7, 0, 1);
      b.size = 0.018 + (1 - t) * 0.05;
      state.bot.targetX = b.x;
      if (b.y <= BOT_Y + 0.035) botReturn();
    }
  }

  function drawCourt() {
    const topLeft = courtPoint(0, 0.08), topRight = courtPoint(1, 0.08), bottomLeft = courtPoint(0, 1), bottomRight = courtPoint(1, 1);
    const netA1 = courtPoint(0.02, NET_TOP), netA2 = courtPoint(0.98, NET_TOP), netB1 = courtPoint(0.02, NET_BOTTOM), netB2 = courtPoint(0.98, NET_BOTTOM);
    const lowerCenterA = courtPoint(0.5, NET_BOTTOM), lowerCenterB = courtPoint(0.5, 1);
    ctx.save();
    ctx.lineCap = 'square';
    ctx.lineJoin = 'miter';
    ctx.shadowColor = 'rgba(235, 255, 248, 0.24)';
    ctx.shadowBlur = 7;
    ctx.strokeStyle = 'rgba(235, 255, 248, 0.46)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(topLeft.x, topLeft.y);
    ctx.lineTo(topRight.x, topRight.y);
    ctx.lineTo(bottomRight.x, bottomRight.y);
    ctx.lineTo(bottomLeft.x, bottomLeft.y);
    ctx.closePath();
    ctx.stroke();
    ctx.globalAlpha = 0.22;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(lowerCenterA.x, lowerCenterA.y);
    ctx.lineTo(lowerCenterB.x, lowerCenterB.y);
    ctx.stroke();
    ctx.globalAlpha = 1;
    ctx.shadowColor = 'rgba(89, 255, 154, 0.68)';
    ctx.shadowBlur = 12;
    ctx.strokeStyle = 'rgba(89, 255, 154, 0.9)';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(netA1.x, netA1.y);
    ctx.lineTo(netA2.x, netA2.y);
    ctx.moveTo(netB1.x, netB1.y);
    ctx.lineTo(netB2.x, netB2.y);
    ctx.stroke();
    ctx.restore();
  }

  function drawBackground() {
    ctx.clearRect(0, 0, state.width, state.height);
    const g = ctx.createLinearGradient(0, 0, 0, state.height);
    g.addColorStop(0, '#030504');
    g.addColorStop(0.55, '#06100c');
    g.addColorStop(1, '#020302');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, state.width, state.height);
    ctx.save();
    ctx.globalAlpha = 0.16;
    ctx.fillStyle = '#eafff4';
    stars.forEach((s) => { ctx.beginPath(); ctx.arc(s.x % state.width, s.y % (state.height * 0.55), s.r, 0, Math.PI * 2); ctx.fill(); });
    ctx.restore();
  }

  function drawBallTrail() {
    ctx.save();
    state.ball.trail.forEach((t) => {
      const p = courtPoint(t.x, t.y);
      ctx.globalAlpha = clamp(t.life / 0.16, 0, 1) * 0.28;
      ctx.fillStyle = '#ffea52';
      ctx.shadowColor = 'rgba(255, 234, 82, 0.48)';
      ctx.shadowBlur = 12;
      ctx.beginPath();
      ctx.arc(p.x, p.y, 7, 0, Math.PI * 2);
      ctx.fill();
    });
    ctx.restore();
  }

  function drawBall() {
    const b = state.ball;
    if (!b.active) return;
    const p = courtPoint(b.x, b.y);
    const r = Math.max(7, state.width * b.size) * (1 + b.pop * 0.28);
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.shadowColor = 'rgba(255, 234, 82, 0.7)';
    ctx.shadowBlur = 26;
    const g = ctx.createRadialGradient(-r * 0.25, -r * 0.35, r * 0.2, 0, 0, r);
    g.addColorStop(0, '#fff7a5');
    g.addColorStop(0.42, '#ffea52');
    g.addColorStop(1, '#b79200');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.strokeStyle = 'rgba(4, 5, 3, 0.22)';
    ctx.lineWidth = Math.max(1, r * 0.08);
    ctx.beginPath();
    ctx.arc(0, 0, r * 0.62, -0.8, 0.8);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(0, 0, r * 0.62, Math.PI - 0.8, Math.PI + 0.8);
    ctx.stroke();
    ctx.restore();
  }

  function drawPaddle(x, y, scale, rotation, swing, player) {
    const p = courtPoint(x, y);
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate(rotation - swing * 0.32);
    ctx.shadowColor = `rgba(89, 255, 154, ${0.2 + swing * 0.35})`;
    ctx.shadowBlur = 20 + swing * 18;
    ctx.fillStyle = '#1b1714';
    ctx.strokeStyle = 'rgba(239, 255, 248, 0.16)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect(-18 * scale, 26 * scale, 38 * scale, 50 * scale, 16 * scale);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#10100f';
    ctx.beginPath();
    ctx.roundRect(-7 * scale, -4 * scale, 14 * scale, 50 * scale, 8 * scale);
    ctx.fill();
    const g = ctx.createLinearGradient(-54 * scale, -78 * scale, 54 * scale, 40 * scale);
    g.addColorStop(0, player ? '#1d3529' : '#264a36');
    g.addColorStop(0.52, player ? '#59ff9a' : '#72c179');
    g.addColorStop(1, '#0f1a15');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.ellipse(0, -60 * scale, 46 * scale, 58 * scale, 0.12, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(239, 255, 248, 0.62)';
    ctx.lineWidth = 2.2;
    ctx.stroke();
    ctx.shadowBlur = 0;
    ctx.fillStyle = 'rgba(2, 6, 4, 0.24)';
    for (let lineY = -88; lineY <= -45; lineY += 17) { ctx.beginPath(); ctx.ellipse(0, lineY * scale, 28 * scale, 3 * scale, 0.12, 0, Math.PI * 2); ctx.fill(); }
    ctx.restore();
  }

  function drawHitZone() {
    const p = courtPoint(state.player.x, state.player.y);
    ctx.save();
    ctx.globalAlpha = 0.1 + state.power * 0.3;
    ctx.strokeStyle = state.power > 0.93 ? '#ff5b77' : state.power > 0.38 ? '#59ff9a' : '#ffea52';
    ctx.lineWidth = 2;
    ctx.shadowColor = ctx.strokeStyle;
    ctx.shadowBlur = 14;
    ctx.beginPath();
    ctx.ellipse(p.x, p.y - 58, 86, 62, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }

  function drawParticles() {
    ctx.save();
    state.particles.forEach((q) => {
      const p = courtPoint(q.x, q.y);
      ctx.globalAlpha = clamp(q.life / q.max, 0, 1);
      ctx.fillStyle = q.color;
      ctx.shadowColor = q.color;
      ctx.shadowBlur = 10;
      ctx.beginPath();
      ctx.arc(p.x, p.y, q.size, 0, Math.PI * 2);
      ctx.fill();
    });
    ctx.restore();
  }

  function draw() {
    drawBackground();
    drawCourt();
    drawPaddle(state.bot.x, BOT_Y, clamp(state.width / 1450, 0.34, 0.54), 0.15, state.botSwing, false);
    drawHitZone();
    drawBallTrail();
    drawBall();
    drawParticles();
    drawPaddle(state.player.x, state.player.y, clamp(state.width / 950, 0.68, 1.12), (state.player.x - 0.5) * 0.45, state.playerSwing, true);
  }

  function frame(now) {
    const dt = Math.min(0.026, (now - state.lastTime) / 1000 || 0.016);
    state.lastTime = now;
    chargePower(now);
    updatePlayer(dt);
    updateBot(dt);
    updateBall(dt);
    updateParticles(dt);
    powerFill.style.width = `${Math.round(state.power * 100)}%`;
    draw();
    requestAnimationFrame(frame);
  }

  function pointerToPaddle(event) {
    const rect = canvas.getBoundingClientRect();
    const y = clamp((event.clientY - rect.top) / rect.height, PLAYER_MIN_Y, PLAYER_MAX_Y);
    state.player.x = courtXFromScreen(event.clientX, y);
    state.player.y = y;
  }

  startButton.addEventListener('click', startGame);
  message.addEventListener('click', () => { if (!state.running) startGame(); });
  canvas.addEventListener('pointermove', pointerToPaddle);
  canvas.addEventListener('pointerdown', (event) => { pointerToPaddle(event); canvas.setPointerCapture?.(event.pointerId); beginCharge(); });
  canvas.addEventListener('pointerup', (event) => { pointerToPaddle(event); releaseHit(); });
  canvas.addEventListener('pointercancel', releaseHit);
  window.addEventListener('keydown', (event) => {
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' '].includes(event.key)) event.preventDefault();
    if (event.key === ' ') beginCharge();
    else state.keys.add(event.key);
  });
  window.addEventListener('keyup', (event) => {
    if (event.key === ' ') releaseHit();
    else state.keys.delete(event.key);
  });
  searchForm.addEventListener('submit', (event) => {
    event.preventDefault();
    const query = searchInput.value.trim() || 'pickleball courts near me';
    window.open(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`, '_blank', 'noopener,noreferrer');
  });
  window.addEventListener('resize', resize);
  resize();
  draw();
  requestAnimationFrame(frame);
})();
