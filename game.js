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
    swingFlash: 0,
    particles: [],
    player: { x: 0.5, y: 0.82 },
    opponent: { x: 0.5, y: 0.24, targetX: 0.5, swing: 0 },
    ball: createBall(),
  };

  const stars = Array.from({ length: 28 }, (_, i) => ({
    xSeed: i * 137.5,
    ySeed: i * 91.7,
    r: i % 3 === 0 ? 1.15 : 0.7,
  }));

  bestValue.textContent = String(state.best);

  function createBall() {
    return {
      x: 0.5,
      y: 0.24,
      size: 0.025,
      vx: 0,
      vy: 0.24,
      active: false,
      direction: 'toPlayer',
      targetX: 0.5,
      targetY: 0.82,
      flightT: 0,
    };
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
  }

  function rand(min, max) {
    return min + Math.random() * (max - min);
  }

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  function setMessage(text) {
    message.textContent = text;
  }

  function updateHud() {
    scoreValue.textContent = String(state.score);
    streakValue.textContent = String(state.streak);
    bestValue.textContent = String(state.best);
  }

  function resetPositions() {
    state.player.x = 0.5;
    state.player.y = 0.82;
    state.opponent.x = 0.5;
    state.opponent.targetX = 0.5;
  }

  function startGame() {
    state.running = true;
    state.score = 0;
    state.streak = 0;
    state.power = 0;
    state.particles = [];
    resetPositions();
    updateHud();
    serveBall(true);
    setMessage('Move to the ball. Hold click or space, then release to hit.');
    startButton.textContent = 'Restart';
  }

  function serveBall(firstServe = false) {
    const ball = state.ball;
    const startX = clamp(state.opponent.x + rand(-0.04, 0.04), 0.18, 0.82);
    const targetX = rand(0.18, 0.82);
    ball.x = startX;
    ball.y = 0.25;
    ball.targetX = targetX;
    ball.targetY = rand(0.68, 0.9);
    ball.vx = (targetX - startX) * (firstServe ? 0.58 : rand(0.68, 0.92));
    ball.vy = firstServe ? 0.28 : rand(0.3, 0.4);
    ball.size = 0.02;
    ball.active = true;
    ball.direction = 'toPlayer';
    ball.flightT = 0;
  }

  function chargePower(now) {
    if (!state.charging) {
      state.power = Math.max(0, state.power - 0.028);
      return;
    }
    const elapsed = now - state.chargeStart;
    state.power = clamp(elapsed / 760, 0, 1);
  }

  function beginCharge() {
    if (!state.running || state.charging) return;
    state.charging = true;
    state.chargeStart = performance.now();
  }

  function releaseHit() {
    if (!state.running || !state.charging) return;
    state.charging = false;
    state.swingFlash = 1;
    tryHitBall();
  }

  function tryHitBall() {
    const ball = state.ball;
    if (!ball.active || ball.direction !== 'toPlayer') {
      setMessage('Wait for the ball to come back to your side.');
      return;
    }

    const dx = Math.abs(ball.x - state.player.x);
    const dy = Math.abs(ball.y - state.player.y);
    const inZone = ball.y > 0.62 && ball.y < 0.95 && dx < 0.16 && dy < 0.19;

    if (!inZone) {
      state.streak = 0;
      updateHud();
      setMessage('Missed. Move the paddle closer before releasing.');
      addParticles(state.player.x, state.player.y, '#ff5b77', 10);
      return;
    }

    const power = state.power;
    state.power = 0;

    if (power < 0.22) {
      state.streak = 0;
      updateHud();
      setMessage('Too soft. That one dropped into the net.');
      addParticles(ball.x, ball.y, '#ff5b77', 14);
      setTimeout(() => state.running && serveBall(), 420);
      return;
    }

    if (power > 0.92) {
      state.streak = 0;
      updateHud();
      setMessage('Too much power. You sent it long.');
      ball.direction = 'out';
      ball.vx = ball.x < 0.5 ? -0.32 : 0.32;
      ball.vy = -0.38;
      addParticles(ball.x, ball.y, '#ffea52', 16);
      setTimeout(() => state.running && serveBall(), 620);
      return;
    }

    const sweet = power >= 0.4 && power <= 0.78;
    const targetX = clamp(state.player.x + rand(-0.24, 0.24), 0.18, 0.82);
    ball.targetX = targetX;
    ball.targetY = rand(0.2, 0.31);
    ball.vx = (targetX - ball.x) * (sweet ? 0.86 : 0.68);
    ball.vy = sweet ? -0.42 : -0.34;
    ball.direction = 'toOpponent';
    ball.flightT = 0;
    state.opponent.targetX = targetX;
    state.score += sweet ? 2 : 1;
    state.streak += 1;
    state.best = Math.max(state.best, state.streak);
    localStorage.setItem('take5PickleballBest', String(state.best));
    updateHud();
    addParticles(ball.x, ball.y, sweet ? '#59ff9a' : '#ffea52', sweet ? 20 : 13);
    setMessage(sweet ? 'Clean return. The bot is chasing it.' : 'Return cleared. Get ready.');
  }

  function opponentReturn() {
    const ball = state.ball;
    const missChance = state.streak > 8 ? 0.08 : 0.02;

    if (Math.random() < missChance) {
      state.score += 1;
      updateHud();
      setMessage('Bot missed. Free point.');
      addParticles(ball.x, ball.y, '#59ff9a', 16);
      setTimeout(() => state.running && serveBall(), 520);
      return;
    }

    const targetX = rand(0.16, 0.84);
    ball.x = clamp(ball.x, 0.12, 0.88);
    ball.y = clamp(ball.y, 0.2, 0.32);
    ball.targetX = targetX;
    ball.targetY = rand(0.68, 0.92);
    ball.vx = (targetX - ball.x) * rand(0.72, 0.96);
    ball.vy = rand(0.32, 0.43);
    ball.direction = 'toPlayer';
    ball.flightT = 0;
    state.opponent.swing = 1;
    addParticles(ball.x, ball.y, '#59ff9a', 12);
    setMessage('Bot returned it. Move and charge your shot.');
  }

  function addParticles(x, y, color, count) {
    for (let i = 0; i < count; i += 1) {
      state.particles.push({
        x,
        y,
        vx: rand(-0.32, 0.32),
        vy: rand(-0.4, 0.16),
        life: rand(0.28, 0.68),
        maxLife: rand(0.28, 0.68),
        color,
        size: rand(2, 4.5),
      });
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
    const speed = 1.35;
    let ax = 0;
    let ay = 0;
    if (state.keys.has('ArrowLeft') || state.keys.has('a')) ax -= 1;
    if (state.keys.has('ArrowRight') || state.keys.has('d')) ax += 1;
    if (state.keys.has('ArrowUp') || state.keys.has('w')) ay -= 1;
    if (state.keys.has('ArrowDown') || state.keys.has('s')) ay += 1;

    if (ax || ay) {
      const len = Math.hypot(ax, ay) || 1;
      state.player.x = clamp(state.player.x + (ax / len) * speed * dt, 0.08, 0.92);
      state.player.y = clamp(state.player.y + (ay / len) * speed * dt, 0.58, 0.95);
    }

    state.swingFlash = Math.max(0, state.swingFlash - dt * 5.5);
  }

  function updateOpponent(dt) {
    const bot = state.opponent;
    const speed = 1.25;
    const target = state.ball.direction === 'toOpponent' ? state.ball.x : bot.targetX;
    bot.x += clamp(target - bot.x, -speed * dt, speed * dt);
    bot.x = clamp(bot.x, 0.14, 0.86);
    bot.swing = Math.max(0, bot.swing - dt * 5);
  }

  function updateBall(dt) {
    const ball = state.ball;
    if (!state.running || !ball.active) return;

    ball.flightT += dt;
    ball.x += ball.vx * dt;
    ball.y += ball.vy * dt;

    if (ball.direction === 'toPlayer') {
      const t = clamp((ball.y - 0.24) / 0.72, 0, 1);
      ball.size = 0.018 + t * 0.058;
      if (ball.y > 0.99) {
        state.streak = 0;
        updateHud();
        setMessage('Ball got past you. Reset and track the next one.');
        addParticles(clamp(ball.x, 0.08, 0.92), 0.92, '#ff5b77', 16);
        setTimeout(() => state.running && serveBall(), 520);
      }
      return;
    }

    if (ball.direction === 'toOpponent') {
      const t = clamp((0.9 - ball.y) / 0.68, 0, 1);
      ball.size = 0.018 + (1 - t) * 0.05;
      state.opponent.targetX = ball.x;
      if (ball.y <= 0.28) {
        const botReach = Math.abs(ball.x - state.opponent.x);
        if (botReach < 0.18) {
          opponentReturn();
        } else {
          state.score += 1;
          updateHud();
          setMessage('Bot could not reach it. Nice placement.');
          addParticles(ball.x, ball.y, '#59ff9a', 14);
          setTimeout(() => state.running && serveBall(), 540);
        }
      }
      return;
    }

    if (ball.direction === 'out') {
      ball.size = Math.max(0.014, ball.size - dt * 0.03);
    }
  }

  function courtPoint(x, y) {
    const center = state.width / 2;
    const topY = state.height * 0.08;
    const bottomY = state.height * 0.96;
    const progress = clamp(y, 0, 1);
    const perspective = Math.pow(progress, 0.92);
    const halfTop = state.width * 0.26;
    const halfBottom = state.width * 0.48;
    const half = halfTop + (halfBottom - halfTop) * perspective;
    const px = center + (x - 0.5) * half * 2;
    const py = topY + progress * (bottomY - topY);
    return { x: px, y: py, half, progress };
  }

  function drawCourt() {
    const topLeft = courtPoint(0, 0.08);
    const topRight = courtPoint(1, 0.08);
    const bottomLeft = courtPoint(0, 1);
    const bottomRight = courtPoint(1, 1);
    const netA1 = courtPoint(0.02, 0.42);
    const netA2 = courtPoint(0.98, 0.42);
    const netB1 = courtPoint(0.02, 0.495);
    const netB2 = courtPoint(0.98, 0.495);
    const lowerCenterA = courtPoint(0.5, 0.495);
    const lowerCenterB = courtPoint(0.5, 1);

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
    ctx.shadowBlur = 3;
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

  function drawBall() {
    const ball = state.ball;
    if (!ball.active) return;
    const p = courtPoint(ball.x, ball.y);
    const radius = Math.max(7, state.width * ball.size);

    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.shadowColor = 'rgba(255, 234, 82, 0.62)';
    ctx.shadowBlur = 24;
    const gradient = ctx.createRadialGradient(-radius * 0.25, -radius * 0.35, radius * 0.2, 0, 0, radius);
    gradient.addColorStop(0, '#fff7a5');
    gradient.addColorStop(0.42, '#ffea52');
    gradient.addColorStop(1, '#b79200');
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(0, 0, radius, 0, Math.PI * 2);
    ctx.fill();

    ctx.shadowBlur = 0;
    ctx.strokeStyle = 'rgba(4, 5, 3, 0.22)';
    ctx.lineWidth = Math.max(1, radius * 0.08);
    ctx.beginPath();
    ctx.arc(0, 0, radius * 0.62, -0.8, 0.8);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(0, 0, radius * 0.62, Math.PI - 0.8, Math.PI + 0.8);
    ctx.stroke();
    ctx.restore();
  }

  function drawPaddle(x, y, scale, rotation, swing, isPlayer) {
    const p = courtPoint(x, y);
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate(rotation - swing * 0.26);
    ctx.shadowColor = `rgba(89, 255, 154, ${0.2 + swing * 0.3})`;
    ctx.shadowBlur = 20 + swing * 16;

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

    const paddleGradient = ctx.createLinearGradient(-54 * scale, -78 * scale, 54 * scale, 40 * scale);
    paddleGradient.addColorStop(0, isPlayer ? '#1d3529' : '#264a36');
    paddleGradient.addColorStop(0.52, isPlayer ? '#59ff9a' : '#72c179');
    paddleGradient.addColorStop(1, '#0f1a15');
    ctx.fillStyle = paddleGradient;
    ctx.beginPath();
    ctx.ellipse(0, -60 * scale, 46 * scale, 58 * scale, 0.12, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(239, 255, 248, 0.62)';
    ctx.lineWidth = 2.2;
    ctx.stroke();

    ctx.shadowBlur = 0;
    ctx.fillStyle = 'rgba(2, 6, 4, 0.24)';
    for (let lineY = -88; lineY <= -45; lineY += 17) {
      ctx.beginPath();
      ctx.ellipse(0, lineY * scale, 28 * scale, 3 * scale, 0.12, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  function drawParticles() {
    ctx.save();
    state.particles.forEach((particle) => {
      const p = courtPoint(particle.x, particle.y);
      const alpha = clamp(particle.life / particle.maxLife, 0, 1);
      ctx.globalAlpha = alpha;
      ctx.fillStyle = particle.color;
      ctx.shadowColor = particle.color;
      ctx.shadowBlur = 10;
      ctx.beginPath();
      ctx.arc(p.x, p.y, particle.size, 0, Math.PI * 2);
      ctx.fill();
    });
    ctx.restore();
  }

  function drawHitZone() {
    const p = courtPoint(state.player.x, state.player.y);
    ctx.save();
    ctx.globalAlpha = 0.1 + state.power * 0.28;
    ctx.strokeStyle = state.power > 0.92 ? '#ff5b77' : state.power > 0.4 ? '#59ff9a' : '#ffea52';
    ctx.lineWidth = 2;
    ctx.shadowColor = ctx.strokeStyle;
    ctx.shadowBlur = 14;
    ctx.beginPath();
    ctx.ellipse(p.x, p.y - 48, 80, 58, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }

  function drawBackground() {
    ctx.clearRect(0, 0, state.width, state.height);
    const gradient = ctx.createLinearGradient(0, 0, 0, state.height);
    gradient.addColorStop(0, '#030504');
    gradient.addColorStop(0.55, '#06100c');
    gradient.addColorStop(1, '#020302');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, state.width, state.height);

    ctx.save();
    ctx.globalAlpha = 0.18;
    ctx.fillStyle = '#eafff4';
    stars.forEach((star) => {
      const x = star.xSeed % state.width;
      const y = star.ySeed % (state.height * 0.55);
      ctx.beginPath();
      ctx.arc(x, y, star.r, 0, Math.PI * 2);
      ctx.fill();
    });
    ctx.restore();
  }

  function draw() {
    drawBackground();
    drawCourt();
    drawPaddle(state.opponent.x, state.opponent.y, clamp(state.width / 1450, 0.34, 0.54), 0.15, state.opponent.swing, false);
    drawHitZone();
    drawBall();
    drawParticles();
    drawPaddle(state.player.x, state.player.y, clamp(state.width / 950, 0.68, 1.12), (state.player.x - 0.5) * 0.45, state.swingFlash, true);
  }

  function frame(now) {
    const dt = Math.min(0.026, (now - state.lastTime) / 1000 || 0.016);
    state.lastTime = now;
    chargePower(now);
    updatePlayer(dt);
    updateOpponent(dt);
    updateBall(dt);
    updateParticles(dt);
    powerFill.style.width = `${Math.round(state.power * 100)}%`;
    draw();
    requestAnimationFrame(frame);
  }

  function pointerToPaddle(event) {
    const rect = canvas.getBoundingClientRect();
    const x = clamp((event.clientX - rect.left) / rect.width, 0.08, 0.92);
    const y = clamp((event.clientY - rect.top) / rect.height, 0.58, 0.95);
    state.player.x = x;
    state.player.y = y;
  }

  startButton.addEventListener('click', startGame);
  message.addEventListener('click', () => {
    if (!state.running) startGame();
  });

  canvas.addEventListener('pointermove', (event) => {
    pointerToPaddle(event);
  });

  canvas.addEventListener('pointerdown', (event) => {
    pointerToPaddle(event);
    canvas.setPointerCapture?.(event.pointerId);
    beginCharge();
  });

  canvas.addEventListener('pointerup', (event) => {
    pointerToPaddle(event);
    releaseHit();
  });

  canvas.addEventListener('pointercancel', releaseHit);

  window.addEventListener('keydown', (event) => {
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' '].includes(event.key)) {
      event.preventDefault();
    }
    if (event.key === ' ') {
      beginCharge();
      return;
    }
    state.keys.add(event.key);
  });

  window.addEventListener('keyup', (event) => {
    if (event.key === ' ') {
      releaseHit();
      return;
    }
    state.keys.delete(event.key);
  });

  searchForm.addEventListener('submit', (event) => {
    event.preventDefault();
    const raw = searchInput.value.trim();
    const query = raw || 'pickleball courts near me';
    const url = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
    window.open(url, '_blank', 'noopener,noreferrer');
  });

  window.addEventListener('resize', resize);
  resize();
  draw();
  requestAnimationFrame(frame);
})();
