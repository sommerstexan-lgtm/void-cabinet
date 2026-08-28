(() => {
  const SUITS = [
    { id: "S", glyph: "♠", red: false },
    { id: "H", glyph: "♥", red: true },
    { id: "D", glyph: "♦", red: true },
    { id: "C", glyph: "♣", red: false }
  ];
  const RANKS = ["A","2","3","4","5","6","7","8","9","10","J","Q","K"];

  const boardEl = document.getElementById("board");
  const movesEl = document.getElementById("moves");
  const timeEl = document.getElementById("time");
  const scoreEl = document.getElementById("score");
  const msgEl = document.getElementById("msg");

  let drawCount = 3;
  let state, history, timer, ticks, dragging;

  function mulberry(seed) {
    let s = seed | 0;
    return () => {
      s = (s + 0x6D2B79F5) | 0;
      let t = Math.imul(s ^ (s >>> 15), 1 | s);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function deck(rng) {
    const d = [];
    for (const s of SUITS) for (let r = 0; r < 13; r++) d.push({ suit: s.id, rank: r, face: true, id: s.id + r });
    for (let i = d.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      [d[i], d[j]] = [d[j], d[i]];
    }
    return d;
  }

  function deal(seed) {
    const rng = mulberry(seed);
    const d = deck(rng);
    const tableau = Array.from({ length: 7 }, () => []);
    for (let col = 0; col < 7; col++) {
      for (let n = 0; n <= col; n++) {
        const c = d.pop();
        c.face = n === col;
        tableau[col].push(c);
      }
    }
    state = {
      seed,
      stock: d.map((c) => ({ ...c, face: false })),
      waste: [],
      foundations: [[], [], [], []],
      tableau,
      moves: 0,
      score: 0,
      won: false
    };
    history = [];
    ticks = 0;
    snapshot();
    render();
    restartTimer();
  }

  function snapshot() {
    history.push(JSON.parse(JSON.stringify({ ...state, _t: ticks })));
    if (history.length > 80) history.shift();
  }

  function restartTimer() {
    clearInterval(timer);
    timer = setInterval(() => {
      if (state.won) return;
      ticks += 1;
      timeEl.textContent = fmt(ticks);
    }, 1000);
  }

  function fmt(s) {
    const m = Math.floor(s / 60);
    return m + ":" + String(s % 60).padStart(2, "0");
  }

  function suitOf(c) { return SUITS.find((s) => s.id === c.suit); }
  function isRed(c) { return suitOf(c).red; }

  function canOnTableau(moving, target) {
    if (!target) return moving.rank === 12;
    return isRed(moving) !== isRed(target) && moving.rank === target.rank - 1;
  }

  function canOnFound(card, pile) {
    if (!pile.length) return card.rank === 0;
    const top = pile[pile.length - 1];
    return top.suit === card.suit && card.rank === top.rank + 1;
  }

  function drawStock() {
    if (state.won) return;
    snapshot();
    if (!state.stock.length) {
      state.stock = state.waste.reverse().map((c) => ({ ...c, face: false }));
      state.waste = [];
      state.moves += 1;
      render();
      return;
    }
    for (let i = 0; i < drawCount && state.stock.length; i++) {
      const c = state.stock.pop();
      c.face = true;
      state.waste.push(c);
    }
    state.moves += 1;
    render();
  }

  function tryMove(cards, from) {
    if (!cards.length) return false;
    const head = cards[0];
    for (let i = 0; i < 4; i++) {
      if (cards.length === 1 && canOnFound(head, state.foundations[i])) {
        pull(from, cards.length);
        state.foundations[i].push(head);
        afterMove(10);
        return true;
      }
    }
    for (let i = 0; i < 7; i++) {
      if (from.type === "tab" && from.i === i) continue;
      const pile = state.tableau[i];
      const top = pile[pile.length - 1];
      if (canOnTableau(head, top || null)) {
        pull(from, cards.length);
        pile.push(...cards);
        afterMove(cards.length > 1 ? 5 : 5);
        return true;
      }
    }
    return false;
  }

  function pull(from, n) {
    if (from.type === "waste") state.waste.pop();
    else if (from.type === "found") state.foundations[from.i].pop();
    else {
      const pile = state.tableau[from.i];
      pile.splice(pile.length - n, n);
      if (pile.length && !pile[pile.length - 1].face) {
        pile[pile.length - 1].face = true;
        state.score += 5;
      }
    }
  }

  function afterMove(pts) {
    state.moves += 1;
    state.score += pts;
    checkWin();
    render();
  }

  function checkWin() {
    if (state.foundations.every((p) => p.length === 13)) {
      state.won = true;
      msgEl.textContent = "Cleared. The foundations are full.";
      const best = Number(localStorage.getItem("vc-klondike-best") || 0);
      if (state.score > best) localStorage.setItem("vc-klondike-best", String(state.score));
    }
  }

  function cardLabel(c) {
    const s = suitOf(c);
    const names = ["Ace","2","3","4","5","6","7","8","9","10","Jack","Queen","King"];
    const suits = { S: "Spades", H: "Hearts", D: "Diamonds", C: "Clubs" };
    return {
      short: RANKS[c.rank] + " " + s.glyph,
      long: names[c.rank] + " of " + suits[c.suit],
      red: s.red
    };
  }

  function showPeek(c) {
    const peek = document.getElementById("peek");
    if (!peek) return;
    if (!c || !c.face) {
      peek.textContent = "Click a face-up card — its name will show here large.";
      peek.classList.remove("red");
      return;
    }
    const lab = cardLabel(c);
    peek.textContent = lab.long + "   " + lab.short;
    peek.classList.toggle("red", lab.red);
  }

  function cardHtml(c, extra = "") {
    const s = suitOf(c);
    if (!c.face) return `<div class="card back" data-id="${c.id}" ${extra}></div>`;
    return `<div class="card ${s.red ? "red" : ""}" data-id="${c.id}" ${extra}>
      <div class="r"><span>${RANKS[c.rank]}</span><span>${s.glyph}</span></div>
    </div>`;
  }

  function render() {
    movesEl.textContent = state.moves;
    scoreEl.textContent = state.score;
    timeEl.textContent = fmt(ticks);

    const found = state.foundations.map((p, i) => {
      const top = p[p.length - 1];
      return `<div class="pile found" data-drop="found:${i}">${
        top ? cardHtml(top, `draggable="true" data-from="found:${i}"`) : `<div class="empty-hint">A</div>`
      }</div>`;
    }).join("");

    const stock = `<div class="pile stock-wrap" id="stockPile">${
      state.stock.length ? `<div class="card back"></div>` : `<div class="empty-hint">↺</div>`
    }</div>`;
    const wasteTop = state.waste[state.waste.length - 1];
    const waste = `<div class="pile waste-wrap">${
      wasteTop ? cardHtml(wasteTop, `draggable="true" data-from="waste:0"`) : ""
    }</div>`;

    const tabs = state.tableau.map((pile, i) => {
      const cards = pile.map((c, idx) => {
        const faceDrag = c.face ? `draggable="true" data-from="tab:${i}:${idx}"` : "";
        return cardHtml(c, `style="top:${idx * 40}px;z-index:${idx}" ${faceDrag} data-idx="${idx}"`);
      }).join("");
      return `<div class="pile tableau" data-drop="tab:${i}" style="min-height:${Math.max(160, 120 + pile.length * 40)}px">${cards}</div>`;
    }).join("");

    boardEl.innerHTML = `<div id="toprow">${stock}${waste}<div></div>${found}</div>${tabs}`;
    bind();
  }

  function stackFrom(fromAttr) {
    const [type, i, idx] = fromAttr.split(":");
    if (type === "waste") return { cards: [state.waste[state.waste.length - 1]], from: { type, i: 0 } };
    if (type === "found") return { cards: [state.foundations[+i][state.foundations[+i].length - 1]], from: { type, i: +i } };
    const pile = state.tableau[+i];
    const start = +idx;
    if (!pile[start].face) return { cards: [], from: { type, i: +i } };
    return { cards: pile.slice(start), from: { type: "tab", i: +i } };
  }

  function bind() {
    document.getElementById("stockPile").addEventListener("click", drawStock);
    boardEl.querySelectorAll(".card[draggable]").forEach((el) => {
      el.addEventListener("dblclick", () => {
        const pack = stackFrom(el.dataset.from);
        if (pack.cards.length === 1) {
          snapshot();
          if (!tryMove(pack.cards, pack.from)) history.pop();
        }
      });
      el.addEventListener("click", (ev) => {
        if (ev.detail === 2) return;
        if (dragging) return;
        const pack = stackFrom(el.dataset.from);
        if (pack.cards[0]) showPeek(pack.cards[0]);
        snapshot();
        if (!tryMove(pack.cards, pack.from)) history.pop();
      });
      el.addEventListener("dragstart", (ev) => {
        dragging = stackFrom(el.dataset.from);
        ev.dataTransfer.setData("text/plain", el.dataset.from);
      });
      el.addEventListener("dragend", () => { dragging = null; });
    });
    boardEl.querySelectorAll("[data-drop]").forEach((el) => {
      el.addEventListener("dragover", (ev) => { ev.preventDefault(); el.classList.add("over"); });
      el.addEventListener("dragleave", () => el.classList.remove("over"));
      el.addEventListener("drop", (ev) => {
        ev.preventDefault();
        el.classList.remove("over");
        const fromAttr = ev.dataTransfer.getData("text/plain");
        const pack = stackFrom(fromAttr);
        const [dtype, di] = el.dataset.drop.split(":");
        snapshot();
        const head = pack.cards[0];
        let ok = false;
        if (dtype === "found" && pack.cards.length === 1 && canOnFound(head, state.foundations[+di])) {
          pull(pack.from, 1);
          state.foundations[+di].push(head);
          afterMove(10);
          ok = true;
        } else if (dtype === "tab") {
          const pile = state.tableau[+di];
          if (canOnTableau(head, pile[pile.length - 1] || null)) {
            pull(pack.from, pack.cards.length);
            pile.push(...pack.cards);
            afterMove(5);
            ok = true;
          }
        }
        if (!ok) history.pop();
      });
    });
  }

  document.getElementById("undo").addEventListener("click", () => {
    if (history.length < 2 || state.won) return;
    history.pop();
    const prev = history[history.length - 1];
    ticks = prev._t || ticks;
    state = JSON.parse(JSON.stringify(prev));
    delete state._t;
    render();
  });
  document.getElementById("new").addEventListener("click", () => {
    msgEl.textContent = "New deal.";
    deal((Math.random() * 1e9) | 0);
  });
  document.getElementById("daily").addEventListener("click", () => {
    const d = new Date();
    const seed = d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate();
    msgEl.textContent = "Daily deal " + d.toISOString().slice(0, 10);
    deal(seed);
  });
  document.getElementById("drawMode").addEventListener("click", (e) => {
    drawCount = drawCount === 3 ? 1 : 3;
    e.target.textContent = drawCount === 3 ? "Draw 3" : "Draw 1";
    deal(state.seed);
  });

  deal((Math.random() * 1e9) | 0);
})();
