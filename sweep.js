(() => {
  const MODES = {
    beginner: { w: 9, h: 9, mines: 10 },
    inter: { w: 16, h: 16, mines: 40 },
    expert: { w: 30, h: 16, mines: 99 }
  };
  const gridEl = document.getElementById("grid");
  const leftEl = document.getElementById("left");
  const timeEl = document.getElementById("time");
  const msgEl = document.getElementById("msg");

  let cfg, board, open, flag, dead, won, started, ticks, timer, hover = 0;

  function idx(x, y) { return y * cfg.w + x; }
  function around(x, y, fn) {
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
      if (!dx && !dy) continue;
      const nx = x + dx, ny = y + dy;
      if (nx >= 0 && ny >= 0 && nx < cfg.w && ny < cfg.h) fn(nx, ny);
    }
  }

  function start(mode) {
    cfg = MODES[mode];
    board = Array(cfg.w * cfg.h).fill(0);
    open = Array(cfg.w * cfg.h).fill(false);
    flag = Array(cfg.w * cfg.h).fill(false);
    dead = won = started = false;
    ticks = 0;
    hover = 0;
    clearInterval(timer);
    timeEl.textContent = "0";
    leftEl.textContent = String(cfg.mines);
    msgEl.textContent = mode.toUpperCase() + " field ready.";
    render();
  }

  function plant(sx, sy) {
    let placed = 0;
    while (placed < cfg.mines) {
      const i = Math.floor(Math.random() * board.length);
      const x = i % cfg.w, y = (i / cfg.w) | 0;
      if (board[i] === -1) continue;
      if (Math.abs(x - sx) <= 1 && Math.abs(y - sy) <= 1) continue;
      board[i] = -1;
      placed += 1;
    }
    for (let y = 0; y < cfg.h; y++) for (let x = 0; x < cfg.w; x++) {
      const i = idx(x, y);
      if (board[i] === -1) continue;
      let n = 0;
      around(x, y, (nx, ny) => { if (board[idx(nx, ny)] === -1) n += 1; });
      board[i] = n;
    }
  }

  function flood(x, y) {
    const stack = [[x, y]];
    while (stack.length) {
      const [cx, cy] = stack.pop();
      const i = idx(cx, cy);
      if (open[i] || flag[i]) continue;
      open[i] = true;
      if (board[i] === 0) around(cx, cy, (nx, ny) => stack.push([nx, ny]));
    }
  }

  function reveal(x, y) {
    if (dead || won) return;
    const i = idx(x, y);
    if (flag[i] || open[i]) return;
    if (!started) {
      started = true;
      plant(x, y);
      timer = setInterval(() => { ticks += 1; timeEl.textContent = String(ticks); }, 1000);
    }
    if (board[i] === -1) {
      dead = true;
      open.forEach((_, k) => { if (board[k] === -1) open[k] = true; });
      msgEl.textContent = "Mine. Field lost.";
      render();
      return;
    }
    flood(x, y);
    checkWin();
    render();
  }

  function toggle(x, y) {
    if (dead || won) return;
    const i = idx(x, y);
    if (open[i]) return;
    flag[i] = !flag[i];
    leftEl.textContent = String(cfg.mines - flag.filter(Boolean).length);
    render();
  }

  function chord(x, y) {
    const i = idx(x, y);
    if (!open[i] || board[i] <= 0) return;
    let f = 0;
    around(x, y, (nx, ny) => { if (flag[idx(nx, ny)]) f += 1; });
    if (f !== board[i]) return;
    around(x, y, (nx, ny) => { if (!flag[idx(nx, ny)]) reveal(nx, ny); });
  }

  function checkWin() {
    const safe = board.reduce((n, v) => n + (v !== -1 ? 1 : 0), 0);
    const opened = open.reduce((n, v, i) => n + (v && board[i] !== -1 ? 1 : 0), 0);
    if (opened === safe) {
      won = true;
      flag = board.map((v) => v === -1);
      leftEl.textContent = "0";
      msgEl.textContent = "Clear in " + ticks + "s.";
      const key = "vc-sweep-" + cfg.mines;
      const best = Number(localStorage.getItem(key) || 0);
      if (!best || ticks < best) localStorage.setItem(key, String(ticks));
    }
  }

  function render() {
    gridEl.style.gridTemplateColumns = `repeat(${cfg.w}, 28px)`;
    gridEl.innerHTML = board.map((v, i) => {
      const x = i % cfg.w, y = (i / cfg.w) | 0;
      let cls = "c", text = "";
      if (flag[i] && !open[i]) { cls += " flag"; text = "▲"; }
      else if (open[i] && v === -1) { cls += " open mine"; text = "✱"; }
      else if (open[i]) { cls += " open" + (v ? " n" + v : ""); text = v || ""; }
      return `<div class="${cls}" data-x="${x}" data-y="${y}">${text}</div>`;
    }).join("");
  }

  gridEl.addEventListener("click", (e) => {
    const c = e.target.closest(".c");
    if (!c) return;
    reveal(+c.dataset.x, +c.dataset.y);
  });
  gridEl.addEventListener("contextmenu", (e) => {
    e.preventDefault();
    const c = e.target.closest(".c");
    if (!c) return;
    toggle(+c.dataset.x, +c.dataset.y);
  });
  gridEl.addEventListener("dblclick", (e) => {
    const c = e.target.closest(".c");
    if (!c) return;
    chord(+c.dataset.x, +c.dataset.y);
  });
  gridEl.addEventListener("pointermove", (e) => {
    const c = e.target.closest(".c");
    if (c) hover = idx(+c.dataset.x, +c.dataset.y);
  });
  window.addEventListener("keydown", (e) => {
    if (e.key === "f" || e.key === "F") {
      const x = hover % cfg.w, y = (hover / cfg.w) | 0;
      toggle(x, y);
    }
  });

  document.querySelectorAll("[data-mode]").forEach((b) => {
    b.addEventListener("click", () => start(b.dataset.mode));
  });
  start("beginner");
})();
