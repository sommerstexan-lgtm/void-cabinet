(() => {
  const canvas = document.getElementById("c");
  const ctx = canvas.getContext("2d");
  const overlay = document.getElementById("overlay");
  const startBtn = document.getElementById("startBtn");
  const scoreVal = document.getElementById("scoreVal");
  const livesVal = document.getElementById("livesVal");
  const waveEl = document.getElementById("wave");
  const hiscoreEl = document.getElementById("hiscore");
  const muteBtn = document.getElementById("mute");

  const HS_KEY = "void-pilot-hs";
  let highScore = Number(localStorage.getItem(HS_KEY) || 0);
  hiscoreEl.textContent = highScore ? `BEST SIGNAL  ${highScore}` : "NO SIGNAL RECORDED";

  let W = 0, H = 0, dpr = 1;
  function resize() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    W = window.innerWidth;
    H = window.innerHeight;
    canvas.width = Math.floor(W * dpr);
    canvas.height = Math.floor(H * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  window.addEventListener("resize", resize);
  resize();

  // ---------- audio ----------
  let audioOn = true;
  let actx = null;
  function ensureAudio() {
    if (!actx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (AC) actx = new AC();
    }
    if (actx && actx.state === "suspended") actx.resume();
  }
  function beep(freq, dur, type = "square", vol = 0.06, slide = 0) {
    if (!audioOn || !actx) return;
    const o = actx.createOscillator();
    const g = actx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, actx.currentTime);
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(40, freq + slide), actx.currentTime + dur);
    g.gain.setValueAtTime(vol, actx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.0001, actx.currentTime + dur);
    o.connect(g); g.connect(actx.destination);
    o.start();
    o.stop(actx.currentTime + dur + 0.02);
  }
  function noiseBurst(dur = 0.18, vol = 0.08) {
    if (!audioOn || !actx) return;
    const n = actx.createBuffer(1, actx.sampleRate * dur, actx.sampleRate);
    const d = n.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / d.length);
    const src = actx.createBufferSource();
    const g = actx.createGain();
    const f = actx.createBiquadFilter();
    f.type = "lowpass";
    f.frequency.value = 900;
    src.buffer = n;
    g.gain.value = vol;
    src.connect(f); f.connect(g); g.connect(actx.destination);
    src.start();
  }

  muteBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    audioOn = !audioOn;
    muteBtn.textContent = audioOn ? "SND ON" : "SND OFF";
    if (audioOn) ensureAudio();
  });

  // ---------- input ----------
  const keys = Object.create(null);
  let pointerX = null;
  let pointerDown = false;
  let wantShoot = false;

  window.addEventListener("keydown", (e) => {
    keys[e.code] = true;
    if (["Space", "ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(e.code)) e.preventDefault();
    if (e.code === "Space") wantShoot = true;
    if (state === "menu" && (e.code === "Space" || e.code === "Enter")) startGame();
    if (state === "dead" && (e.code === "Space" || e.code === "Enter")) startGame();
  });
  window.addEventListener("keyup", (e) => { keys[e.code] = false; });

  function setPointer(clientX) {
    pointerX = clientX;
  }
  canvas.addEventListener("pointerdown", (e) => {
    pointerDown = true;
    wantShoot = true;
    setPointer(e.clientX);
    canvas.setPointerCapture(e.pointerId);
  });
  canvas.addEventListener("pointermove", (e) => {
    if (pointerDown || e.pointerType === "mouse") setPointer(e.clientX);
  });
  window.addEventListener("pointerup", () => { pointerDown = false; });

  // ---------- entities ----------
  const stars = [];
  const bullets = [];
  const eBullets = [];
  const enemies = [];
  const particles = [];
  const pickups = [];

  function seedStars() {
    stars.length = 0;
    const n = Math.floor((W * H) / 2800);
    for (let i = 0; i < n; i++) {
      stars.push({
        x: Math.random() * W,
        y: Math.random() * H,
        z: Math.random() * 3 + 0.3,
        tw: Math.random() * Math.PI * 2
      });
    }
  }
  seedStars();
  window.addEventListener("resize", seedStars);

  const player = {
    x: 0, y: 0, w: 28, h: 36,
    vx: 0, lives: 3, cool: 0,
    weapon: 1, invuln: 0, shield: 0, engine: 0
  };

  let state = "menu";
  let score = 0;
  let wave = 1;
  let spawnAcc = 0;
  let waveTimer = 0;
  let shake = 0;
  let t = 0;
  let last = performance.now();

  function resetPlayer() {
    player.x = W / 2;
    player.y = H - 78;
    player.vx = 0;
    player.lives = 3;
    player.cool = 0;
    player.weapon = 1;
    player.invuln = 1.2;
    player.shield = 0;
    player.engine = 0;
  }

  function startGame() {
    ensureAudio();
    beep(220, 0.08, "sawtooth", 0.05);
    beep(440, 0.16, "sawtooth", 0.04);
    state = "play";
    score = 0;
    wave = 1;
    spawnAcc = 0;
    waveTimer = 0;
    shake = 0;
    bullets.length = 0;
    eBullets.length = 0;
    enemies.length = 0;
    particles.length = 0;
    pickups.length = 0;
    resetPlayer();
    overlay.classList.add("hidden");
    overlay.innerHTML = "";
    updateHud();
  }

  startBtn.addEventListener("click", startGame);

  function updateHud() {
    scoreVal.textContent = String(score);
    livesVal.textContent = "■".repeat(Math.max(0, player.lives)) + "□".repeat(Math.max(0, 3 - player.lives));
    waveEl.textContent = `WAVE ${wave}`;
  }

  function addScore(n) {
    score += n;
    if (score > highScore) {
      highScore = score;
      localStorage.setItem(HS_KEY, String(highScore));
    }
    updateHud();
  }

  function burst(x, y, color, n = 18, speed = 220) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const s = Math.random() * speed;
      particles.push({
        x, y,
        vx: Math.cos(a) * s,
        vy: Math.sin(a) * s,
        life: 0.4 + Math.random() * 0.5,
        max: 0.9,
        r: 1.5 + Math.random() * 2.5,
        color
      });
    }
  }

  function spawnEnemy() {
    const r = Math.random();
    let type = "scout";
    if (wave >= 2 && r < 0.28) type = "fighter";
    if (wave >= 3 && r < 0.16) type = "tank";
    if (r > 0.82) type = "rock";

    const stats = {
      scout:   { hp: 1, w: 22, h: 22, speed: 90 + wave * 12, score: 25, color: "#5cffd2" },
      fighter: { hp: 2, w: 26, h: 26, speed: 70 + wave * 8, score: 50, color: "#ff6ad5" },
      tank:    { hp: 5 + Math.floor(wave / 2), w: 40, h: 32, speed: 40 + wave * 4, score: 120, color: "#ffb347" },
      rock:    { hp: 3, w: 28 + Math.random() * 18, h: 28, speed: 50 + Math.random() * 40, score: 40, color: "#9aa4c7" }
    }[type];

    enemies.push({
      type,
      x: 30 + Math.random() * (W - 60),
      y: -40,
      ...stats,
      h: stats.h || stats.w,
      vx: (Math.random() - 0.5) * 40,
      cool: 0.6 + Math.random(),
      phase: Math.random() * Math.PI * 2
    });
  }

  function firePlayer() {
    if (player.cool > 0) return;
    player.cool = player.weapon >= 3 ? 0.12 : player.weapon === 2 ? 0.16 : 0.2;
    const shots = player.weapon === 1 ? [0] : player.weapon === 2 ? [-0.12, 0.12] : [-0.22, 0, 0.22];
    for (const ang of shots) {
      bullets.push({
        x: player.x + Math.sin(ang) * 8,
        y: player.y - 18,
        vx: Math.sin(ang) * 420,
        vy: -720,
        r: 3
      });
    }
    beep(660 + player.weapon * 40, 0.06, "square", 0.045, 180);
  }

  function hitPlayer() {
    if (player.invuln > 0) return;
    if (player.shield > 0) {
      player.shield = 0;
      player.invuln = 0.8;
      burst(player.x, player.y, "#66e0ff", 22, 260);
      beep(180, 0.12, "sawtooth", 0.06, -80);
      return;
    }
    player.lives -= 1;
    player.invuln = 1.6;
    shake = 14;
    burst(player.x, player.y, "#ff4d6d", 28, 300);
    noiseBurst(0.22, 0.1);
    updateHud();
    if (player.lives <= 0) gameOver();
  }

  function gameOver() {
    state = "dead";
    noiseBurst(0.35, 0.12);
    overlay.classList.remove("hidden");
    overlay.innerHTML = `
      <div class="tag">SIGNAL LOST</div>
      <h1>DOWNED</h1>
      <div class="hint">Score ${score} · Wave ${wave}<br/>Best ${highScore}</div>
      <button id="againBtn" type="button">RELAUNCH</button>
      <div id="hiscore">Chrome menu → Install VOID PILOT for offline sorties</div>
    `;
    document.getElementById("againBtn").addEventListener("click", startGame);
  }

  function circleHit(ax, ay, ar, bx, by, br) {
    const dx = ax - bx, dy = ay - by;
    return dx * dx + dy * dy < (ar + br) * (ar + br);
  }

  function rectHit(ax, ay, aw, ah, bx, by, bw, bh) {
    return Math.abs(ax - bx) < (aw + bw) / 2 && Math.abs(ay - by) < (ah + bh) / 2;
  }

  // ---------- draw helpers ----------
  function glowPath(draw, color, blur = 18) {
    ctx.save();
    ctx.shadowColor = color;
    ctx.shadowBlur = blur;
    ctx.strokeStyle = color;
    ctx.fillStyle = color;
    draw();
    ctx.restore();
  }

  function drawShip(x, y, flicker) {
    const pulse = 0.85 + Math.sin(t * 18) * 0.15;
    ctx.save();
    ctx.translate(x, y);
    if (flicker) ctx.globalAlpha = 0.35 + (Math.sin(t * 40) > 0 ? 0.65 : 0.15);

    glowPath(() => {
      ctx.beginPath();
      ctx.moveTo(0, -20);
      ctx.lineTo(12, 14);
      ctx.lineTo(0, 8);
      ctx.lineTo(-12, 14);
      ctx.closePath();
      ctx.fillStyle = "#08101c";
      ctx.fill();
      ctx.lineWidth = 2;
      ctx.strokeStyle = "#6cf0ff";
      ctx.stroke();
    }, "#6cf0ff", 16);

    ctx.beginPath();
    ctx.moveTo(-6, 12);
    ctx.lineTo(0, 8);
    ctx.lineTo(6, 12);
    ctx.strokeStyle = "#d46bff";
    ctx.shadowColor = "#d46bff";
    ctx.shadowBlur = 10;
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // engine
    const flame = 10 + Math.sin(t * 40) * 5 + player.engine * 8;
    ctx.beginPath();
    ctx.moveTo(-4, 12);
    ctx.lineTo(0, 12 + flame);
    ctx.lineTo(4, 12);
    ctx.fillStyle = `rgba(80, 220, 255, ${0.55 * pulse})`;
    ctx.shadowColor = "#3cf";
    ctx.shadowBlur = 16;
    ctx.fill();

    if (player.shield > 0) {
      ctx.beginPath();
      ctx.arc(0, 0, 26 + Math.sin(t * 8) * 2, 0, Math.PI * 2);
      ctx.strokeStyle = "rgba(140, 240, 255, 0.55)";
      ctx.shadowColor = "#8ef";
      ctx.shadowBlur = 18;
      ctx.lineWidth = 2;
      ctx.stroke();
    }
    ctx.restore();
  }

  function drawEnemy(e) {
    ctx.save();
    ctx.translate(e.x, e.y);
    ctx.rotate(Math.sin(e.phase) * 0.15);
    const c = e.color;
    if (e.type === "rock") {
      glowPath(() => {
        ctx.beginPath();
        for (let i = 0; i < 7; i++) {
          const a = (i / 7) * Math.PI * 2;
          const r = e.w * 0.45 * (0.75 + ((i * 3) % 5) * 0.06);
          const px = Math.cos(a) * r, py = Math.sin(a) * r;
          i ? ctx.lineTo(px, py) : ctx.moveTo(px, py);
        }
        ctx.closePath();
        ctx.fillStyle = "#141824";
        ctx.fill();
        ctx.strokeStyle = c;
        ctx.lineWidth = 1.6;
        ctx.stroke();
      }, c, 10);
    } else if (e.type === "tank") {
      glowPath(() => {
        ctx.beginPath();
        ctx.moveTo(0, 16);
        ctx.lineTo(18, -8);
        ctx.lineTo(8, -14);
        ctx.lineTo(-8, -14);
        ctx.lineTo(-18, -8);
        ctx.closePath();
        ctx.fillStyle = "#1a1010";
        ctx.fill();
        ctx.strokeStyle = c;
        ctx.lineWidth = 2;
        ctx.stroke();
      }, c, 12);
    } else {
      glowPath(() => {
        ctx.beginPath();
        ctx.moveTo(0, 14);
        ctx.lineTo(10, -10);
        ctx.lineTo(0, -4);
        ctx.lineTo(-10, -10);
        ctx.closePath();
        ctx.fillStyle = "#100818";
        ctx.fill();
        ctx.strokeStyle = c;
        ctx.lineWidth = 1.8;
        ctx.stroke();
      }, c, 12);
    }
    ctx.restore();
  }

  // ---------- loop ----------
  function update(dt) {
    t += dt;
    if (shake > 0) shake = Math.max(0, shake - dt * 28);

    // stars
    for (const s of stars) {
      s.y += (20 + s.z * 55 + wave * 4) * dt;
      s.tw += dt * 3;
      if (s.y > H + 4) { s.y = -4; s.x = Math.random() * W; }
    }

    if (state !== "play") return;

    waveTimer += dt;
    if (waveTimer > 22) {
      waveTimer = 0;
      wave += 1;
      updateHud();
      beep(520, 0.1, "triangle", 0.05);
      beep(780, 0.18, "triangle", 0.05);
    }

    // player move
    let ax = 0;
    if (keys.ArrowLeft || keys.KeyA) ax -= 1;
    if (keys.ArrowRight || keys.KeyD) ax += 1;
    if (pointerX != null && (pointerDown || !ax)) {
      const target = pointerX;
      const diff = target - player.x;
      ax = Math.max(-1, Math.min(1, diff / 90));
      if (Math.abs(diff) < 6) player.x = target;
    }
    player.vx += ax * 2400 * dt;
    player.vx *= Math.pow(0.0018, dt);
    player.x += player.vx * dt;
    player.x = Math.max(22, Math.min(W - 22, player.x));
    player.y = H - 78;
    player.engine = Math.min(1, Math.abs(ax) + (keys.ArrowUp || keys.KeyW ? 1 : 0));
    player.cool = Math.max(0, player.cool - dt);
    player.invuln = Math.max(0, player.invuln - dt);
    player.shield = Math.max(0, player.shield - dt);

    if (keys.Space || pointerDown || wantShoot) firePlayer();
    wantShoot = false;

    // spawn
    spawnAcc += dt;
    const rate = Math.max(0.28, 1.15 - wave * 0.08);
    if (spawnAcc > rate) {
      spawnAcc = 0;
      spawnEnemy();
      if (wave > 4 && Math.random() < 0.25) spawnEnemy();
    }

    // bullets
    for (let i = bullets.length - 1; i >= 0; i--) {
      const b = bullets[i];
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      if (b.y < -20) bullets.splice(i, 1);
    }
    for (let i = eBullets.length - 1; i >= 0; i--) {
      const b = eBullets[i];
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      if (b.y > H + 20 || b.x < -20 || b.x > W + 20) eBullets.splice(i, 1);
      else if (circleHit(b.x, b.y, 3, player.x, player.y, 14)) {
        eBullets.splice(i, 1);
        hitPlayer();
      }
    }

    // enemies
    for (let i = enemies.length - 1; i >= 0; i--) {
      const e = enemies[i];
      e.phase += dt * 3;
      e.x += Math.sin(e.phase) * (e.type === "scout" ? 90 : 40) * dt + e.vx * dt;
      e.y += e.speed * dt;
      if (e.x < 16) { e.x = 16; e.vx = Math.abs(e.vx); }
      if (e.x > W - 16) { e.x = W - 16; e.vx = -Math.abs(e.vx); }

      if (e.type === "fighter" || (e.type === "tank" && wave >= 3)) {
        e.cool -= dt;
        if (e.cool <= 0 && e.y > 20 && e.y < H * 0.7) {
          e.cool = e.type === "tank" ? 1.4 : 1.8 - Math.min(0.8, wave * 0.06);
          const ang = Math.atan2(player.y - e.y, player.x - e.x);
          const spd = 220 + wave * 12;
          eBullets.push({ x: e.x, y: e.y + 8, vx: Math.cos(ang) * spd, vy: Math.sin(ang) * spd });
          beep(220, 0.05, "sawtooth", 0.03);
        }
      }

      // collide player
      if (rectHit(e.x, e.y, e.w * 0.8, e.h * 0.8, player.x, player.y, 22, 28)) {
        enemies.splice(i, 1);
        burst(e.x, e.y, e.color, 16, 200);
        hitPlayer();
        continue;
      }

      // bullets vs enemy
      let dead = false;
      for (let j = bullets.length - 1; j >= 0; j--) {
        const b = bullets[j];
        if (circleHit(b.x, b.y, 4, e.x, e.y, e.w * 0.42)) {
          bullets.splice(j, 1);
          e.hp -= 1;
          burst(b.x, b.y, e.color, 6, 120);
          if (e.hp <= 0) {
            addScore(e.score);
            burst(e.x, e.y, e.color, 22, 280);
            noiseBurst(0.12, 0.06);
            shake = Math.max(shake, e.type === "tank" ? 10 : 5);
            if (Math.random() < 0.16) {
              const kinds = ["weapon", "shield", "life"];
              pickups.push({
                x: e.x, y: e.y,
                kind: player.lives < 3 && Math.random() < 0.25 ? "life" : kinds[Math.floor(Math.random() * 2)],
                vy: 50, phase: 0
              });
            }
            enemies.splice(i, 1);
            dead = true;
          }
          break;
        }
      }
      if (dead) continue;
      if (e.y > H + 40) enemies.splice(i, 1);
    }

    // pickups
    for (let i = pickups.length - 1; i >= 0; i--) {
      const p = pickups[i];
      p.y += p.vy * dt;
      p.phase += dt * 5;
      if (circleHit(p.x, p.y, 12, player.x, player.y, 18)) {
        if (p.kind === "weapon") player.weapon = Math.min(3, player.weapon + 1);
        if (p.kind === "shield") player.shield = 6;
        if (p.kind === "life" && player.lives < 3) { player.lives += 1; updateHud(); }
        addScore(30);
        burst(p.x, p.y, "#fff38a", 14, 180);
        beep(880, 0.12, "triangle", 0.05, 200);
        pickups.splice(i, 1);
      } else if (p.y > H + 20) pickups.splice(i, 1);
    }

    // particles
    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vx *= 0.92;
      p.vy *= 0.92;
      p.life -= dt;
      if (p.life <= 0) particles.splice(i, 1);
    }
  }

  function draw() {
    ctx.fillStyle = "#03040c";
    ctx.fillRect(0, 0, W, H);

    ctx.save();
    if (shake > 0) {
      ctx.translate((Math.random() - 0.5) * shake, (Math.random() - 0.5) * shake);
    }

    // vignette stars
    for (const s of stars) {
      const a = 0.25 + s.z * 0.25 + Math.sin(s.tw) * 0.15;
      ctx.fillStyle = `rgba(210, 235, 255, ${a})`;
      ctx.fillRect(s.x, s.y, s.z < 1.2 ? 1 : 1.8, s.z < 1.2 ? 1 : 1.8);
    }

    // scanlines-ish horizon glow
    const g = ctx.createLinearGradient(0, H * 0.55, 0, H);
    g.addColorStop(0, "rgba(0,0,0,0)");
    g.addColorStop(1, "rgba(20, 0, 50, 0.28)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);

    for (const p of particles) {
      ctx.globalAlpha = Math.max(0, p.life / p.max);
      ctx.fillStyle = p.color;
      ctx.shadowColor = p.color;
      ctx.shadowBlur = 8;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    ctx.shadowBlur = 0;

    for (const b of bullets) {
      ctx.save();
      ctx.shadowColor = "#7af6ff";
      ctx.shadowBlur = 12;
      ctx.fillStyle = "#d6ffff";
      ctx.fillRect(b.x - 1.5, b.y - 8, 3, 12);
      ctx.restore();
    }
    for (const b of eBullets) {
      ctx.save();
      ctx.shadowColor = "#ff4fa3";
      ctx.shadowBlur = 10;
      ctx.fillStyle = "#ffb3dc";
      ctx.beginPath();
      ctx.arc(b.x, b.y, 3, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    for (const e of enemies) drawEnemy(e);

    for (const p of pickups) {
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.phase);
      const col = p.kind === "weapon" ? "#ffd24a" : p.kind === "shield" ? "#6cf0ff" : "#7dff9a";
      ctx.shadowColor = col;
      ctx.shadowBlur = 14;
      ctx.strokeStyle = col;
      ctx.lineWidth = 2;
      ctx.strokeRect(-7, -7, 14, 14);
      ctx.restore();
    }

    if (state === "play" || state === "dead") {
      drawShip(player.x, player.y, player.invuln > 0);
    }

    ctx.restore();
  }

  function frame(now) {
    const dt = Math.min(0.033, (now - last) / 1000);
    last = now;
    update(dt);
    draw();
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
})();
