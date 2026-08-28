(() => {
  const WORDS = new Set((window.CIPHER_WORDS || []).map((w) => w.toLowerCase()));
  const FREQ = "EEEEEEEEEEEAAAAAAAARRRRRRRIIIIIIIOOOOOOONNNNNNTTTTTLLLLSSSSUUUDDDGGGBBCCMMPPFFHHVVWWYYKJXQZ";
  const DIRS = [-1,0,1].flatMap((dy) => [-1,0,1].map((dx) => [dx, dy])).filter(([a,b]) => a || b);

  const gridEl = document.getElementById("grid");
  const curEl = document.getElementById("current");
  const foundEl = document.getElementById("found");
  const scoreEl = document.getElementById("score");
  const countEl = document.getElementById("count");
  const bestEl = document.getElementById("best");
  const msgEl = document.getElementById("msg");

  let cells = [], path = [], dragging = false, found, score;
  bestEl.textContent = localStorage.getItem("vc-cipher-best") || "0";

  function letter() { return FREQ[Math.floor(Math.random() * FREQ.length)]; }

  function neighbors(i) {
    const x = i % 5, y = (i / 5) | 0;
    const out = [];
    for (const [dx, dy] of DIRS) {
      const nx = x + dx, ny = y + dy;
      if (nx >= 0 && nx < 5 && ny >= 0 && ny < 5) out.push(ny * 5 + nx);
    }
    return out;
  }

  function allWords(board) {
    const hits = new Set();
    const walk = (i, used, s) => {
      if (s.length >= 3 && WORDS.has(s)) hits.add(s);
      if (s.length >= 8) return;
      for (const n of neighbors(i)) {
        if (used.has(n)) continue;
        used.add(n);
        walk(n, used, s + board[n]);
        used.delete(n);
      }
    };
    for (let i = 0; i < 25; i++) {
      const used = new Set([i]);
      walk(i, used, board[i]);
    }
    return hits;
  }

  function makeBoard() {
    let board, hidden;
    for (let attempt = 0; attempt < 40; attempt++) {
      board = Array.from({ length: 25 }, letter);
      hidden = allWords(board);
      if (hidden.size >= 12) break;
    }
    return { board, hidden };
  }

  function newGame() {
    const pack = makeBoard();
    cells = pack.board;
    window._hidden = pack.hidden;
    found = new Set();
    score = 0;
    path = [];
    renderGrid();
    update();
    msgEl.textContent = pack.hidden.size + " words hiding on this grid.";
  }

  function renderGrid() {
    gridEl.innerHTML = cells.map((ch, i) => `<div class="cell" data-i="${i}">${ch}</div>`).join("");
  }

  function wordOf(p) { return p.map((i) => cells[i]).join("").toLowerCase(); }

  function paint() {
    [...gridEl.children].forEach((el, i) => {
      el.classList.toggle("on", path.includes(i));
      el.classList.toggle("used", [...found].some((w) => false));
    });
    curEl.textContent = wordOf(path).toUpperCase();
  }

  function addCell(i) {
    if (path.includes(i)) {
      if (path.length > 1 && path[path.length - 2] === i) path.pop();
      return;
    }
    if (!path.length || neighbors(path[path.length - 1]).includes(i)) path.push(i);
  }

  function commit() {
    const w = wordOf(path);
    if (w.length >= 3 && WORDS.has(w)) {
      if (found.has(w)) msgEl.textContent = w.toUpperCase() + " already found.";
      else {
        found.add(w);
        const pts = w.length === 3 ? 10 : w.length === 4 ? 20 : w.length === 5 ? 40 : w.length * 15;
        score += pts;
        msgEl.textContent = w.toUpperCase() + "  +" + pts;
        const best = Number(localStorage.getItem("vc-cipher-best") || 0);
        if (score > best) {
          localStorage.setItem("vc-cipher-best", String(score));
          bestEl.textContent = String(score);
        }
      }
    } else if (w.length >= 3) msgEl.textContent = w.toUpperCase() + " is not in the list.";
    path = [];
    update();
  }

  function update() {
    scoreEl.textContent = score;
    countEl.textContent = found.size;
    foundEl.innerHTML = [...found].sort().map((w) => `<span>${w.toUpperCase()}</span>`).join("");
    paint();
  }

  function indexFromEvent(ev) {
    const el = document.elementFromPoint(ev.clientX, ev.clientY);
    if (!el || !el.dataset.i) return null;
    return +el.dataset.i;
  }

  gridEl.addEventListener("click", (ev) => {
    const cell = ev.target.closest(".cell");
    if (!cell) return;
    const i = +cell.dataset.i;
    if (path.includes(i)) {
      if (path[path.length - 1] === i) path.pop();
      else msgEl.textContent = "Use Back to remove letters.";
      paint();
      curEl.textContent = wordOf(path).toUpperCase();
      return;
    }
    if (!path.length || neighbors(path[path.length - 1]).includes(i)) {
      path.push(i);
      msgEl.textContent = wordOf(path).toUpperCase() || "Click the next touching letter.";
    } else {
      msgEl.textContent = "That letter does not touch the last one. Clear or Back.";
    }
    paint();
    curEl.textContent = wordOf(path).toUpperCase();
  });

  document.getElementById("submit").addEventListener("click", () => {
    if (path.length < 3) {
      msgEl.textContent = "Need at least 3 letters, then Submit.";
      return;
    }
    commit();
  });
  document.getElementById("back").addEventListener("click", () => {
    path.pop();
    paint();
    curEl.textContent = wordOf(path).toUpperCase();
  });
  document.getElementById("clear").addEventListener("click", () => {
    path = [];
    paint();
    curEl.textContent = "";
    msgEl.textContent = "Cleared. Click a starting letter.";
  });

  document.getElementById("new").addEventListener("click", newGame);
  newGame();
})();
