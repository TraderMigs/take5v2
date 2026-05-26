(() => {
  const canvas = document.getElementById('gameCanvas');
  const stage = document.getElementById('gameStage');
  const ctx = canvas.getContext('2d');
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
    paddle: { x: 0.5, y: 0.82, vx: 0, vy: 0 },
    ball: createBall(),
  };

  bestValue.textContent = String(state.best);

  function createBall() {
    return {
      x: 0.5,
      y: 0.22,
      z: 0,
      size: 0.025,
      speed: 0.18,
      drift: 0,
      targetX: 0.5,
      active: false,
      returning: false,
      spin: 0,
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

  function startGame() {
    state.running = true;
    state.score = 0;
    state.streak = 0;
    state.power = 0;
    state.particles = [];
    state.paddle.x = 0.5;
    state.paddle.y = 0.82;
    updateHud();
    serveBall(true);
    setMessage('Track the ball. Hold click or space to charge. Release inside the hit zone.');
    startButton.textContent = 'Restart';
  }

  function serveBall(firstServe = false) {
    const ball = state.ball;
    ball.x = rand(0.42, 0.58);
    ball.y = 0.22;
    ball.z = 0;
    ball.size = 0.018;
    ball.speed = firstServe ? 0.16 : rand(0.17, 0.24);
    ball.drift = rand(-0.08, 0.08);
    ball.targetX = rand(0.22, 0.78);
    ball.active = true;
    ball.returning = false;
    ball.spin = rand(-0.03, 0.03);
  }

  function chargePower(now) {
    if (!state.charging) {
      state.power = Math.max(0, state.power - 0.018);
      return;
    }
    const elapsed = now - state.chargeStart;
    const pulse = (Math.sin(elapsed / 115) + 1) / 2;
    state.power = clamp(elapsed / 900 + pulse * 0.08, 0, 1);
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
    if (!ball.active || ball.returning) {
      setMessage('Swing timing matters. Wait for the ball to come in.');
      return;
    }

    const dx = Math.abs(ball.x - state.paddle.x);
    const dy = Math.abs(ball.y - state.paddle.y);
    const inZone = ball.y > 0.62 && ball.y < 0.94 && dx < 0.15 && dy < 0.18;

    if (!inZone) {
      state.streak = 0;
      updateHud();
      setMessage('Missed swing. Get closer to the ball before releasing.');
      addParticles(state.paddle.x, state.paddle.y, '#ff5b77', 12);
      return;
    }

    const power = state.power;
    state.power = 0;

    if (power < 0.26) {
      state.streak = 0;
      updateHud();
      setMessage('Too soft. The ball died into the net.');
      ball.returning = true;
      ball.speed = -0.09;
      addParticles(ball.x, ball.y, '#ff5b77', 16);
      return;
    }

    if (power > 0.88) {
      state.streak = 0;
      updateHud();
      setMessage('Too much power. You launched it out.');
      ball.returning = true;
      ball.speed = -0.32;
      ball.drift = ball.x < 0.5 ? -0.16 : 0.16;
      addParticles(ball.x, ball.y, '#ffea52', 18);
      return;
    }

    const sweet = power >= 0.46 && power <= 0.76;
    const points = sweet ? 2 : 1;
    state.score += points;
    state.streak += 1;
    state.best = Math.max(state.best, state.streak);
    localStorage.setItem('take5PickleballBest', String(state.best));
    updateHud();

    ball.returning = true;
    ball.speed = -rand(0.18, 0.28) * (sweet ? 1.08 : 0.94);
    ball.drift = (ball.x - 0.5) * rand(0.08, 0.18) + rand(-0.035, 0.035);
    addParticles(ball.x, ball.y, sweet ? '#59ff9a' : '#ffea52', sweet ? 28 : 18);
    setMessage(sweet ? 'Clean return. Sweet spot.' : 'Return cleared. Keep the streak alive.');
  }

  function addParticles(x, y, color, count) {
    for (let i = 0; i < count; i += 1) {
      state.particles.push({
        x,
        y,
        vx: rand(-0.35, 0.35),
        vy: rand(-0.45, 0.2),
        life: rand(0.35, 0.85),
        maxLife: rand(0.35, 0.85),
        color,
        size: rand(2, 5),
      });
    }
  }

  function updateParticles(dt) {
    state.particles = state.particles.filter((p) => {
      p.life -= dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy += 0.55 * dt;
      return p.life > 0;
    });
  }

  function updatePaddle(dt) {
    const speed = 0.82;
    let ax = 0;
    let ay = 0;
    if (state.keys.has('ArrowLeft') || state.keys.has('a')) ax -= 1;
    if (state.keys.has('ArrowRight') || state.keys.has('d')) ax += 1;
    if (state.keys.has('ArrowUp') || state.keys.has('w')) ay -= 1;
    if (state.keys.has('ArrowDown') || state.keys.has('s')) ay += 1;

    if (ax || ay) {
      const len = Math.hypot(ax, ay) || 1;
      state.paddle.x = clamp(state.paddle.x + (ax / len) * speed * dt, 0.1, 0.9);
      state.paddle.y = clamp(state.paddle.y + (ay / len) * speed * dt, 0.58, 0.95);
    }

    state.swingFlash = Math.max(0, state.swingFlash - dt * 4.5);
  }

  function updateBall(dt) {
    const ball = state.ball;
    if (!state.running || !ball.active) return;

    if (!ball.returning) {
      ball.y += ball.speed * dt;
      const t = clamp((ball.y - 0.22) / 0.72, 0, 1);
      ball.x += (ball.targetX - ball.x) * 0.9 * dt + ball.drift * dt * t;
      ball.size = 0.018 + t * 0.055;

      if (ball.y > 0.98) {
        state.streak = 0;
        updateHud();
        setMessage('Ball got past you. Reset and track the next one.');
        addParticles(ball.x, 0.92, '#ff5b77', 20);
        serveBall();
      }
      return;
    }

    ball.y += ball.speed * dt;
    ball.x += ball.drift * dt;
    const away = clamp((0.96 - ball.y) / 0.78, 0, 1);
    ball.size = 0.018 + (1 - away) * 0.055;

    if (ball.y < 0.22) {
      serveBall();
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

    ctx.shadowColor = 'rgba(235, 255, 248, 0.28)';
    ctx.shadowBlur = 8;
    ctx.strokeStyle = 'rgba(235, 255, 248, 0.48)';
    ctx.lineWidth = 3;

    ctx.beginPath();
    ctx.moveTo(topLeft.x, topLeft.y);
    ctx.lineTo(topRight.x, topRight.y);
    ctx.lineTo(bottomRight.x, bottomRight.y);
    ctx.lineTo(bottomLeft.x, bottomLeft.y);
    ctx.closePath();
    ctx.stroke();

    ctx.globalAlpha = 0.28;
    ctx.lineWidth = 2;
    ctx.shadowBlur = 4;
    ctx.beginPath();
    ctx.moveTo(lowerCenterA.x, lowerCenterA.y);
    ctx.lineTo(lowerCenterB.x, lowerCenterB.y);
    ctx.stroke();

    ctx.globalAlpha = 1;
    ctx.shadowColor = 'rgba(89, 255, 154, 0.72)';
    ctx.shadowBlur = 13;
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

  function drawOpponentPaddle() {
    const ball = state.ball;
    const p = courtPoint(clamp(ball.x + 0.08, 0.32, 0.68), 0.23);
    const scale = clamp(state.width / 1450, 0.34, 0.56);

    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate(0.15);
    ctx.globalAlpha = 0.95;
    ctx.shadowColor = 'rgba(89, 255, 154, 0.22)';
    ctx.shadowBlur = 14;

    const paddleGradient = ctx.createLinearGradient(-36 * scale, -46 * scale, 36 * scale, 36 * scale);
    paddleGradient.addColorStop(0, '#264a36');
    paddleGradient.addColorStop(0.56, '#72c179');
    paddleGradient.addColorStop(1, '#102015');
    ctx.fillStyle = paddleGradient;
    ctx.strokeStyle = 'rgba(239, 255, 248, 0.52)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.ellipse(0, -32 * scale, 42 * scale, 50 * scale, 0.08, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    ctx.shadowBlur = 0;
    ctx.fillStyle = '#1b1714';
    ctx.strokeStyle = 'rgba(239, 255, 248, 0.22)';
    ctx.beginPath();
    ctx.roundRect(-12 * scale, 7 * scale, 24 * scale, 34 * scale, 9 * scale);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#10100f';
    ctx.beginPath();
    ctx.roundRect(-5 * scale, -4 * scale, 10 * scale, 32 * scale, 5 * scale);
    ctx.fill();
    ctx.restore();
  }

  function drawPaddleHand() {
    const p = courtPoint(state.paddle.x, state.paddle.y);
    const scale = clamp(state.width / 950, 0.68, 1.12);
    const flash = state.swingFlash;

    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate((state.paddle.x - 0.5) * 0.45 - flash * 0.28);

    ctx.shadowColor = `rgba(89, 255, 154, ${0.24 + flash * 0.3})`;
    ctx.shadowBlur = 26 + flash * 18;
    ctx.fillStyle = '#1b1714';
    ctx.strokeStyle = 'rgba(239, 255, 248, 0.16)';
    ctx.lineWidth = 2;

    ctx.beginPath();
    ctx.roundRect(-20 * scale, 28 * scale, 42 * scale, 54 * scale, 18 * scale);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#10100f';
    ctx.beginPath();
    ctx.roundRect(-8 * scale, -6 * scale, 16 * scale, 54 * scale, 8 * scale);
    ctx.fill();

    const paddleGradient = ctx.createLinearGradient(-58 * scale, -82 * scale, 58 * scale, 44 * scale);
    paddleGradient.addColorStop(0, '#1d3529');
    paddleGradient.addColorStop(0.52, '#59ff9a');
    paddleGradient.addColorStop(1, '#0f1a15');
    ctx.fillStyle = paddleGradient;
    ctx.beginPath();
    ctx.ellipse(0, -64 * scale, 50 * scale, 62 * scale, 0.12, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(239, 255, 248, 0.7)';
    ctx.lineWidth = 2.5;
    ctx.stroke();

    ctx.shadowBlur = 0;
    ctx.fillStyle = 'rgba(2, 6, 4, 0.24)';
    for (let y = -94; y <= -42; y += 18) {
      ctx.beginPath();
      ctx.ellipse(0, y * scale, 31 * scale, 3.5 * scale, 0.12, 0, Math.PI * 2);
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
      ctx.shadowBlur = 12;
      ctx.beginPath();
      ctx.arc(p.x, p.y, particle.size, 0, Math.PI * 2);
      ctx.fill();
    });
    ctx.restore();
  }

  function drawHitZone() {
    const p = courtPoint(state.paddle.x, state.paddle.y);
    ctx.save();
    ctx.globalAlpha = 0.12 + state.power * 0.25;
    ctx.strokeStyle = state.power > 0.88 ? '#ff5b77' : state.power > 0.45 ? '#59ff9a' : '#ffea52';
    ctx.lineWidth = 2;
    ctx.shadowColor = ctx.strokeStyle;
    ctx.shadowBlur = 16;
    ctx.beginPath();
    ctx.ellipse(p.x, p.y - 48, 76, 54, 0, 0, Math.PI * 2);
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
    ctx.globalAlpha = 0.25;
    ctx.fillStyle = '#eafff4';
    for (let i = 0; i < 42; i += 1) {
      const x = ((i * 137.5) % state.width);
      const y = ((i * 91.7) % (state.height * 0.55));
      ctx.beginPath();
      ctx.arc(x, y, i % 3 === 0 ? 1.2 : 0.7, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  function draw() {
    drawBackground();
    drawCourt();
    drawOpponentPaddle();
    drawHitZone();
    drawBall();
    drawParticles();
    drawPaddleHand();
  }

  function frame(now) {
    const dt = Math.min(0.033, (now - state.lastTime) / 1000 || 0.016);
    state.lastTime = now;
    chargePower(now);
    updatePaddle(dt);
    updateBall(dt);
    updateParticles(dt);
    powerFill.style.width = `${Math.round(state.power * 100)}%`;
    draw();
    requestAnimationFrame(frame);
  }

  function pointerToPaddle(event) {
    const rect = canvas.getBoundingClientRect();
    const x = clamp((event.clientX - rect.left) / rect.width, 0.1, 0.9);
    const y = clamp((event.clientY - rect.top) / rect.height, 0.58, 0.95);
    state.paddle.x = x;
    state.paddle.y = y;
  }

  startButton.addEventListener('click', startGame);

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
