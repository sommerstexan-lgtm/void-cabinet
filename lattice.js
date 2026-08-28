(() => {
  const gridEl = document.getElementById("grid");
  const padEl = document.getElementById("pad");
  const timeEl = document.getElementById("time");
  const msgEl = document.getElementById("msg");
  const diffLabel = document.getElementById("diffLabel");
  const pencilBtn = document.getElementById("pencil");

  let puzzle, solution, given, notes, sel = 0, pencil = false, ticks = 0, timer, won = false;

  function shuffle(a) {
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  function ok(board, i, n) {
    const r = (i / 9) | 0, c = i % 9;
    for (let k = 0; k < 9; k++) {
      if (board[r * 9 + k] === n) return false;
      if (board[k * 9 + c] === n) return false;
    }
    const br = Math.floor(r / 3) * 3, bc = Math.floor(c / 3) * 3;
    for (let y = 0; y < 3; y++) for (let x = 0; x < 3; x++) {
      if (board[(br + y) * 9 + bc + x] === n) return false;
    }
    return true;
  }

  function fill(board) {
    const i = board.indexOf(0);
    if (i < 0) return true;
    for (const n of shuffle([1,2,3,4,5,6,7,8,9])) {
      if (ok(board, i, n)) {
        board[i] = n;
        if (fill(board)) return true;
        board[i] = 0;
      }
    }
    return false;
  }

  function solutions(board, limit = 2) {
    let count = 0;
    const walk = (b) => {
      if (count >= limit) return;
      const i = b.indexOf(0);
      if (i < 0) { count += 1; return; }
      for (let n = 1; n <= 9; n++) {
        if (ok(b, i, n)) {
          b[i] = n;
          walk(b);
          b[i] = 0;
          if (count >= limit) return;
        }
      }
    };
    walk(board.slice());
    return count;
  }

  function generate(holes) {
    const board = Array(81).fill(0);
    fill(board);
    const solved = board.slice();
    const order = shuffle([...Array(81).keys()]);
    let removed = 0;
    for (const i of order) {
      if (removed >= holes) break;
      const keep = board[i];
      board[i] = 0;
      if (holes > 40 && solutions(board, 2) !== 1) board[i] = keep;
      else removed += 1;
    }
    return { puzzle: board, solution: solved };
  }

  function start(level) {
    const holes = level === "easy" ? 36 : level === "med" ? 46 : 54;
    diffLabel.textContent = level === "easy" ? "Easy" : level === "med" ? "Medium" : "Hard";
    msgEl.textContent = "Building a unique grid…";
    setTimeout(() => {
      const g = generate(holes);
      puzzle = g.puzzle.slice();
      solution = g.solution;
      given = g.puzzle.map((n) => n !== 0);
      notes = Array.from({ length: 81 }, () => new Set());
      sel = puzzle.findIndex((n, i) => !given[i]);
      if (sel < 0) sel = 0;
      won = false;
      ticks = 0;
      clearInterval(timer);
      timer = setInterval(() => {
        if (won) return;
        ticks += 1;
        timeEl.textContent = (ticks / 60 | 0) + ":" + String(ticks % 60).padStart(2, "0");
      }, 1000);
      render();
      msgEl.textContent = "Fill 1–9 so every row, column, and box is unique.";
    }, 20);
  }

  function conflicts(i) {
    const n = puzzle[i];
    if (!n) return false;
    const r = (i / 9) | 0, c = i % 9;
    for (let k = 0; k < 9; k++) {
      const a = r * 9 + k, b = k * 9 + c;
      if (a !== i && puzzle[a] === n) return true;
      if (b !== i && puzzle[b] === n) return true;
    }
    const br = Math.floor(r / 3) * 3, bc = Math.floor(c / 3) * 3;
    for (let y = 0; y < 3; y++) for (let x = 0; x < 3; x++) {
      const j = (br + y) * 9 + bc + x;
      if (j !== i && puzzle[j] === n) return true;
    }
    return false;
  }

  function render() {
    const focus = puzzle[sel];
    gridEl.innerHTML = puzzle.map((n, i) => {
      const r = (i / 9) | 0;
      const cls = [
        "cell",
        given[i] ? "given" : "",
        i === sel ? "sel" : "",
        focus && n === focus ? "same" : "",
        conflicts(i) ? "bad" : "",
        r === 2 || r === 5 ? "boxb" : ""
      ].join(" ");
      const note = !n && notes[i].size
        ? `<div class="notes">${[1,2,3,4,5,6,7,8,9].map((k) => `<span>${notes[i].has(k) ? k : ""}</span>`).join("")}</div>`
        : "";
      return `<div class="${cls}" data-i="${i}">${n || ""}${note}</div>`;
    }).join("");
    gridEl.querySelectorAll(".cell").forEach((el) => {
      el.addEventListener("click", () => { sel = +el.dataset.i; render(); });
    });
  }

  function put(n) {
    if (won || given[sel]) return;
    if (pencil) {
      if (!puzzle[sel]) {
        if (notes[sel].has(n)) notes[sel].delete(n);
        else notes[sel].add(n);
      }
    } else {
      puzzle[sel] = puzzle[sel] === n ? 0 : n;
      notes[sel].clear();
      if (puzzle.every((v, i) => v === solution[i])) {
        won = true;
        msgEl.textContent = "Lattice complete.";
      }
    }
    render();
  }

  padEl.innerHTML = [1,2,3,4,5,6,7,8,9].map((n) => `<button type="button" data-n="${n}">${n}</button>`).join("") +
    `<button type="button" data-n="0">✕</button>`;
  padEl.addEventListener("click", (e) => {
    const n = e.target.dataset.n;
    if (n == null) return;
    if (n === "0") {
      if (!given[sel]) { puzzle[sel] = 0; notes[sel].clear(); render(); }
      return;
    }
    put(+n);
  });

  window.addEventListener("keydown", (e) => {
    if (e.key === "ArrowLeft") sel = (sel + 80) % 81;
    else if (e.key === "ArrowRight") sel = (sel + 1) % 81;
    else if (e.key === "ArrowUp") sel = (sel + 72) % 81;
    else if (e.key === "ArrowDown") sel = (sel + 9) % 81;
    else if (e.key === "p" || e.key === "P") togglePencil();
    else if (e.key >= "1" && e.key <= "9") put(+e.key);
    else if (e.key === "Backspace" || e.key === "Delete" || e.key === "0") {
      if (!given[sel]) { puzzle[sel] = 0; notes[sel].clear(); }
    } else return;
    e.preventDefault();
    render();
  });

  function togglePencil() {
    pencil = !pencil;
    pencilBtn.textContent = pencil ? "Pencil on" : "Pencil off";
  }
  pencilBtn.addEventListener("click", togglePencil);
  document.getElementById("easy").addEventListener("click", () => start("easy"));
  document.getElementById("med").addEventListener("click", () => start("med"));
  document.getElementById("hard").addEventListener("click", () => start("hard"));
  document.getElementById("hint").addEventListener("click", () => {
    if (won) return;
    const empty = puzzle.map((n, i) => n ? -1 : i).filter((i) => i >= 0);
    if (!empty.length) return;
    const i = empty[Math.floor(Math.random() * empty.length)];
    puzzle[i] = solution[i];
    notes[i].clear();
    sel = i;
    msgEl.textContent = "Hint filled r" + (((i / 9) | 0) + 1) + " c" + ((i % 9) + 1) + ".";
    render();
  });

  start("easy");
})();
