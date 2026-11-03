"use strict";

const VIEW_TITLE = {
  checker: "Number Checker",
  predictor: "Final Number Predictor",
  analysis: "Number Analysis",
  buddies: "Number Buddies",
  history: "Draw History",
  powerball: "Powerball Trends",
  hot: "Hot Numbers",
  overdue: "Overdue Numbers",
};

const NAV = [
  { id: "checker", label: "Number Checker", icon: "check", bg: "#e7eef8", fg: "#1a2744" },
  { id: "predictor", label: "Final Number Predictor", icon: "target", bg: "#f4ead6", fg: "#8a5a12" },
  { id: "analysis", label: "Number Analysis", icon: "bars", bg: "#e7eef8", fg: "#1a2744" },
  { id: "buddies", label: "Number Buddies", icon: "buddies", bg: "#f8edd9", fg: "#8a5a12" },
  { id: "history", label: "Draw History", icon: "list", bg: "#efe6d8", fg: "#5c4033" },
  { id: "powerball", label: "Powerball Trends", icon: "ball", bg: "#fdecea", fg: "#b42318" },
  { id: "hot", label: "Hot Numbers", icon: "flame", bg: "#fff1e4", fg: "#c2410c" },
  { id: "overdue", label: "Overdue Numbers", icon: "clock", bg: "#eee8f6", fg: "#5b4b8a" },
];

const TIERS = [
  { id: "j", label: "5 + Powerball", prize: "Jackpot", match: 5, pb: true, dollars: 0 },
  { id: "m5", label: "Match 5", prize: "$1,000,000", match: 5, pb: false, dollars: 1000000 },
  { id: "m4p", label: "Match 4 + Powerball", prize: "$50,000", match: 4, pb: true, dollars: 50000 },
  { id: "m4", label: "Match 4", prize: "$100", match: 4, pb: false, dollars: 100 },
  { id: "m3p", label: "Match 3 + Powerball", prize: "$100", match: 3, pb: true, dollars: 100 },
  { id: "m3", label: "Match 3", prize: "$7", match: 3, pb: false, dollars: 7 },
  { id: "m2p", label: "Match 2 + Powerball", prize: "$7", match: 2, pb: true, dollars: 7 },
  { id: "m1p", label: "Match 1 + Powerball", prize: "$4", match: 1, pb: true, dollars: 4 },
  { id: "m0p", label: "Powerball only", prize: "$4", match: 0, pb: true, dollars: 4 },
];

const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const MONTHS_SHORT = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

if (!window.POWERBALL_DRAWS || !window.POWERBALL_DRAWS.length) {
  document.getElementById("main").textContent = "Draw history did not load.";
  throw new Error("missing draws");
}

const DRAWS = window.POWERBALL_DRAWS.map((row) => ({
  date: row[0],
  w: [row[1], row[2], row[3], row[4], row[5]],
  pb: row[6],
  mult: row[7],
}));

const whiteCount = Array(70).fill(0);
const pbCount = Array(27).fill(0);
const lastWhite = Array(70).fill(-1);
const lastPb = Array(27).fill(-1);
const recentWhite = { 30: Array(70).fill(0), 100: Array(70).fill(0) };
const recentPb = { 30: Array(27).fill(0), 100: Array(27).fill(0) };
const PAIRS = Array.from({ length: 70 }, () => new Uint16Array(70));
const oddHist = Array(6).fill(0);
const highHist = Array(6).fill(0);
let sumAll = 0;

function addPair(a, b) {
  if (a < b) PAIRS[a][b] += 1;
  else PAIRS[b][a] += 1;
}

function pairCount(a, b) {
  return a < b ? PAIRS[a][b] : PAIRS[b][a];
}

DRAWS.forEach((d, i) => {
  let odd = 0;
  let high = 0;
  let sum = 0;
  for (let a = 0; a < 5; a += 1) {
    const n = d.w[a];
    whiteCount[n] += 1;
    if (lastWhite[n] < 0) lastWhite[n] = i;
    if (i < 30) recentWhite[30][n] += 1;
    if (i < 100) recentWhite[100][n] += 1;
    if (n % 2 === 1) odd += 1;
    if (n >= 35) high += 1;
    sum += n;
    for (let b = a + 1; b < 5; b += 1) addPair(n, d.w[b]);
  }
  pbCount[d.pb] += 1;
  if (lastPb[d.pb] < 0) lastPb[d.pb] = i;
  if (i < 30) recentPb[30][d.pb] += 1;
  if (i < 100) recentPb[100][d.pb] += 1;
  d.sum = sum;
  d.odd = odd;
  d.high = high;
  sumAll += sum;
  oddHist[odd] += 1;
  highHist[high] += 1;
});

const avgSum = sumAll / DRAWS.length;
let sumSq = 0;
DRAWS.forEach((d) => {
  const x = d.sum - avgSum;
  sumSq += x * x;
});
const sdSum = Math.sqrt(sumSq / DRAWS.length);
const PAIR_MEAN = (DRAWS.length * 10) / ((69 * 68) / 2);
const LATEST = DRAWS[0];
const OLDEST = DRAWS[DRAWS.length - 1];
const EXPECT_WHITE = (DRAWS.length * 5) / 69;
const EXPECT_PB = DRAWS.length / 26;

function comb(n, k) {
  let r = 1;
  for (let i = 1; i <= k; i += 1) r = (r * (n - k + i)) / i;
  return Math.round(r);
}
const ODDS = comb(69, 5) * 26;

const state = {
  whites: new Set(),
  digits: [],
  pb: null,
  view: "checker",
  checkGame: "powerball",
  predictGame: "powerball",
  predictLines: [],
  predictSetCount: 5,
  patternMode: "single",
  patternSeed: 2,
  patternSeeds: [],
  patternGenerated: false,
  predictDraftMain: [],
  predictDraftBonus: null,
  predictFocus: null,
  predictShift: 0,
  predictResult: null,
  checked: false,
  window: "all",
  historyDays: "120",
  buddy: 1,
  historyQuery: "",
  historyShown: 40,
};

(function pickDefaultBuddy() {
  let best = 1;
  for (let n = 2; n <= 69; n += 1) {
    if (whiteCount[n] > whiteCount[best]) best = n;
  }
  state.buddy = best;
})();

function selectedWhites() {
  return [...state.whites].sort((a, b) => a - b);
}

function parts(iso) {
  const [y, m, d] = iso.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  return { y, m, d, wd: WEEKDAYS[dt.getUTCDay()] };
}

function longDate(iso) {
  const p = parts(iso);
  return `${p.wd}, ${MONTHS[p.m - 1]} ${p.d}, ${p.y}`;
}

function shortDate(iso) {
  const p = parts(iso);
  return `${MONTHS_SHORT[p.m - 1]} ${p.d}, ${p.y}`;
}

function commas(n) {
  return Math.round(n).toLocaleString("en-US");
}

function money(n) {
  return n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
}

function esc(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

function agoLabel(gap) {
  if (gap === 0) return "Latest drawing";
  if (gap === 1) return "1 draw ago";
  return `${commas(gap)} draws ago`;
}

function ball(n, kind, size, extra) {
  const cls = ["ball", kind, size];
  if (extra) cls.push(extra);
  return `<span class="${cls.join(" ")}">${n}</span>`;
}

function ballsRow(whites, pb, size) {
  const w = whites.map((n) => ball(n, "w", size)).join("");
  const p = pb ? ball(pb, "p", size) : `<span class="ball p ${size} empty"></span>`;
  return `<span class="slots">${w}${p}</span>`;
}

function tagHTML(tag) {
  return `<span class="tag ${tag.toLowerCase()}">${tag}</span>`;
}

function pace(n, pool) {
  const isPb = pool === "pb";
  const count = isPb ? pbCount[n] : whiteCount[n];
  const gap = isPb ? lastPb[n] : lastWhite[n];
  const recent = isPb ? recentPb[100][n] : recentWhite[100][n];
  const expectedRecent = isPb ? 100 / 26 : (100 * 5) / 69;
  const typicalGap = DRAWS.length / count;
  let tag = "Typical";
  if (gap > typicalGap * 1.6) tag = "Overdue";
  else if (recent >= expectedRecent * 1.45) tag = "Hot";
  else if (recent <= expectedRecent * 0.5) tag = "Cold";
  return {
    count,
    gap,
    recent,
    typicalGap,
    tag,
    expected: isPb ? EXPECT_PB : EXPECT_WHITE,
  };
}

function ranked(arr, max, k) {
  const nums = [];
  for (let n = 1; n <= max; n += 1) nums.push(n);
  nums.sort((a, b) => arr[b] - arr[a] || a - b);
  return nums.slice(0, k);
}

function sampleRange(min, max, k) {
  const arr = [];
  for (let n = min; n <= max; n += 1) arr.push(n);
  for (let i = arr.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    const tmp = arr[i];
    arr[i] = arr[j];
    arr[j] = tmp;
  }
  return arr.slice(0, k).sort((a, b) => a - b);
}

function sample(max, k) {
  const arr = Array.from({ length: max }, (_, i) => i + 1);
  for (let i = arr.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    const tmp = arr[i];
    arr[i] = arr[j];
    arr[j] = tmp;
  }
  return arr.slice(0, k).sort((a, b) => a - b);
}

function tierFor(match, pbHit) {
  return TIERS.find((t) => t.match === match && t.pb === pbHit) || null;
}

function analyzeLine(whites, pb, draws = DRAWS) {
  const set = new Set(whites);
  const counts = {};
  TIERS.forEach((t) => { counts[t.id] = 0; });
  const closest = [];
  draws.forEach((d) => {
    let match = 0;
    for (let i = 0; i < 5; i += 1) if (set.has(d.w[i])) match += 1;
    const pbHit = d.pb === pb;
    const tier = tierFor(match, pbHit);
    if (tier) counts[tier.id] += 1;
    const score = match * 2 + (pbHit ? 1 : 0);
    if (score > 0) closest.push({ d, match, pbHit, score, tier });
  });
  closest.sort((a, b) => b.score - a.score || (a.d.date < b.d.date ? 1 : -1));
  return { counts, closest: closest.slice(0, 6) };
}

function matchLabel(match, pbHit) {
  if (match === 0 && pbHit) return "Powerball only";
  if (match === 0) return "No match";
  const white = match === 1 ? "1 white" : `${match} white`;
  return pbHit ? `${white} + Powerball` : white;
}

function icon(name) {
  const common = 'width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"';
  const paths = {
    bars: `<svg ${common}><path d="M4 19V10M12 19V5M20 19v-7"/></svg>`,
    buddies: `<svg ${common}><circle cx="9" cy="12" r="4"/><circle cx="15" cy="12" r="4"/></svg>`,
    list: `<svg ${common}><path d="M8 6h13M8 12h13M8 18h13"/><path d="M3.5 6h.01M3.5 12h.01M3.5 18h.01"/></svg>`,
    ball: `<svg ${common}><circle cx="12" cy="12" r="8"/><path d="M12 4c2.2 2.4 2.2 13.2 0 16M4 12h16"/></svg>`,
    flame: `<svg ${common}><path d="M12 3s5 4.2 5 9a5 5 0 1 1-10 0c0-2 1.1-3.2 2.1-4.2 0 2.2 1.2 3.2 2.2 3.2C11.3 8 12 5.2 12 3z"/></svg>`,
    clock: `<svg ${common}><circle cx="12" cy="12" r="8"/><path d="M12 8v5l3 2"/></svg>`,
    target: `<svg ${common}><circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="3"/><path d="M12 2v2M12 20v2M2 12h2M20 12h2"/></svg>`,
    check: `<svg ${common}><circle cx="12" cy="12" r="8"/><path d="M8.5 12.5l2.2 2.2 4.8-5.2"/></svg>`,
  };
  return paths[name];
}

function checkerGame() {
  return PREDICT_GAMES.find((g) => g.id === state.checkGame) || PREDICT_GAMES[0];
}

function lineComplete() {
  const game = checkerGame();
  if (game.ordered) return state.digits.length === game.mainCount;
  if (state.whites.size !== game.mainCount) return false;
  if (game.bonusMax && state.pb == null) return false;
  return true;
}

function predictionSeed() {
  const game = checkerGame();
  return game.ordered ? state.digits[0] : selectedWhites()[0];
}

function hintText() {
  const game = checkerGame();
  const noun = game.ordered ? "digit" : "number";
  const nouns = game.ordered ? "digits" : "numbers";
  const have = game.ordered ? state.digits.length : state.whites.size;
  const need = game.mainCount - have;
  const bonusNeed = game.bonusMax > 0 && state.pb == null;
  if (!have) return `Choose 1 ${noun} to predict, or fill a full line to check it.`;
  if (lineComplete()) return `Ready to check this line and predict from ${predictionSeed()}.`;
  if (need > 0 && bonusNeed) {
    return `${have} selected. Add ${need} more ${need === 1 ? noun : nouns} and a ${game.bonusLabel}, or predict from what you have.`;
  }
  if (need > 0) return `${have} selected. Add ${need} more ${need === 1 ? noun : nouns}, or predict from what you have.`;
  if (bonusNeed) return `Choose a ${game.bonusLabel}, or predict from the numbers you have.`;
  return `Ready to predict from ${predictionSeed()}.`;
}

function refreshNote() {
  const info = window.LOTTERY_UPDATE;
  if (!info) return "";
  if (info.added > 0) {
    const bits = info.games.filter((game) => game.added).map((game) => {
      const noun = game.added === 1 ? "drawing" : "drawings";
      return `${commas(game.added)} new ${game.label} ${noun}`;
    });
    return `<div class="muted">${esc(bits.join(", "))} added from New York Lottery.</div>`;
  }
  if (!info.ok) return `<div class="muted">Showing saved drawings. Live results could not be checked.</div>`;
  return `<div class="muted">New York Lottery data checked. No newer drawings.</div>`;
}

function latestHTML() {
  if (state.view === "predictor") return latestForGame(predictGame());
  if (state.view === "checker" && state.checkGame !== "powerball") return latestForGame(checkerGame());
  const balls = LATEST.w.map((n) => ball(n, "w", "sm")).join("") + ball(LATEST.pb, "p", "sm");
  return `
    <div>
      <div class="kicker">Latest drawing</div>
      <div class="when">${longDate(LATEST.date)}</div>
      ${refreshNote()}
    </div>
    <div class="slots">${balls}</div>
    ${LATEST.mult ? `<div class="pp">Power Play ${LATEST.mult}×</div>` : ""}
  `;
}

function numberButtons(min, max, pick) {
  let html = "";
  for (let n = min; n <= max; n += 1) {
    html += `<button type="button" class="num" data-pick="${pick}" data-n="${n}" aria-pressed="false">${n}</button>`;
  }
  return html;
}

function buttons(max, pick) {
  return numberButtons(1, max, pick);
}

function lineBanner() {
  if (!state.whites.size && !state.pb) return "";
  return `<div class="mini-line"><span>Your line</span>${ballsRow(selectedWhites(), state.pb, "sm")}<button type="button" class="load" data-view="checker">Edit line</button></div>`;
}

function selectionReport() {
  if (!state.whites.size && !state.pb) return "";
  const rows = selectedWhites().map((n) => {
    const p = pace(n, "w");
    return `<div class="rank">${ball(n, "w", "sm")}${tagHTML(p.tag)}<span class="meta">${commas(p.count)} times · ${agoLabel(p.gap)}</span></div>`;
  }).join("");
  const pb = state.pb ? (() => {
    const p = pace(state.pb, "pb");
    return `<div class="rank">${ball(state.pb, "p", "sm")}${tagHTML(p.tag)}<span class="meta">${commas(p.count)} times · ${agoLabel(p.gap)}</span></div>`;
  })() : "";
  return `<div class="subcard"><h3>Your selected numbers</h3>${rows}${pb}</div>`;
}

function renderCrumb() {
  const title = VIEW_TITLE[state.view];
  const section = state.view === "predictor"
    ? predictGame().label
    : state.view === "checker"
      ? checkerGame().label
      : "Powerball";
  const sectionView = state.view === "predictor" ? "predictor" : "checker";
  document.getElementById("crumbs").innerHTML = `
    <button type="button" data-view="checker">Home</button>
    <span class="sep">›</span>
    <button type="button" data-view="checker">Lottery Tools</button>
    <span class="sep">›</span>
    <button type="button" data-view="${sectionView}">${esc(section)} Tools</button>
    <span class="sep">›</span>
    <span class="current">${esc(title)}</span>
  `;
}

function gameMenuHTML(selectId, game) {
  const tick = `<svg class="tick" viewBox="0 0 20 20" aria-hidden="true"><path d="M4.5 10.5 8 14l7.5-8" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
  const options = PREDICT_GAMES.map((g) => {
    const on = g.id === game.id;
    return `<li role="none"><button type="button" class="game-option${on ? " on" : ""}" role="option" data-game-pick="${selectId}" data-game-id="${g.id}" aria-selected="${on ? "true" : "false"}">${esc(g.label)}${on ? tick : ""}</button></li>`;
  }).join("");
  return `<div class="game-menu" data-game-menu="${selectId}">
    <button type="button" class="game-select" id="${selectId}" data-game-toggle="${selectId}" aria-haspopup="listbox" aria-expanded="false" aria-controls="${selectId}-list" aria-labelledby="${selectId}-label ${selectId}-value">
      <span id="${selectId}-value">${esc(game.label)}</span>
      <svg class="chev" viewBox="0 0 20 20" aria-hidden="true"><path d="M5 7.5 10 12.5 15 7.5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>
    </button>
    <ul class="game-list" id="${selectId}-list" role="listbox" aria-labelledby="${selectId}-label" hidden>${options}</ul>
  </div>`;
}

function closeGameMenus() {
  document.querySelectorAll("[data-game-menu]").forEach((menu) => {
    const btn = menu.querySelector(".game-select");
    const list = menu.querySelector(".game-list");
    if (btn) btn.setAttribute("aria-expanded", "false");
    if (list) {
      list.hidden = true;
      list.classList.remove("up");
    }
  });
}

function placeGameMenu(menu) {
  const list = menu.querySelector(".game-list");
  if (!list) return;
  list.classList.remove("up");
  const rect = list.getBoundingClientRect();
  const roomAbove = menu.getBoundingClientRect().top;
  if (rect.bottom > window.innerHeight - 8 && roomAbove > rect.height + 8) list.classList.add("up");
}

function toggleGameMenu(id, fromKeyboard) {
  const menu = document.querySelector(`[data-game-menu="${id}"]`);
  if (!menu) return;
  const btn = menu.querySelector(".game-select");
  const list = menu.querySelector(".game-list");
  const open = btn.getAttribute("aria-expanded") === "true";
  closeGameMenus();
  if (open) {
    btn.focus();
    return;
  }
  btn.setAttribute("aria-expanded", "true");
  list.hidden = false;
  placeGameMenu(menu);
  if (!fromKeyboard) return;
  const current = list.querySelector("[aria-selected='true']") || list.querySelector("[role='option']");
  if (current) current.focus();
}

function chooseGame(which, id) {
  closeGameMenus();
  if (which === "check-game") {
    if (id !== state.checkGame) setCheckGame(id);
  } else if (which === "predict-game" && id !== state.predictGame) {
    state.predictGame = id;
    state.predictLines = [];
    state.patternGenerated = false;
    state.patternSeeds = [];
    state.patternSeed = predictGame().mainMin;
    state.predictDraftMain = [];
    state.predictDraftBonus = null;
    state.predictFocus = null;
    state.predictShift = 0;
    state.predictResult = null;
    renderCrumb();
    refreshLatest();
    renderView("predictor");
  }
  const btn = document.getElementById(which);
  if (btn) btn.focus();
}

function renderChecker() {
  const game = checkerGame();
  const draws = historyDraws(game);
  const span = draws.length
    ? `${commas(draws.length)} drawings from ${shortDate(draws[draws.length - 1].date)} to ${shortDate(draws[0].date)}.`
    : "Draw history for this game did not load.";
  const noun = game.ordered ? "digits" : "numbers";
  const stepCheck = game.bonusMax ? 3 : 2;
  const pick = game.ordered ? "d" : "w";
  const bonusCard = game.bonusMax ? `
      <section class="card">
        <div class="step-head">
          <span class="step-no">2</span>
          <h2>Choose A ${esc(game.bonusLabel)}</h2>
          <span class="count" id="pb-count">None yet</span>
        </div>
        <p class="help">Select 1 ${esc(game.bonusLabel)} from 1 to ${game.bonusMax}.</p>
        <div class="num-grid" id="pb-grid">${numberButtons(1, game.bonusMax, "p")}</div>
      </section>` : "";
  return `
      <section class="card">
        <div class="step-head">
          <span class="step-no">1</span>
          <h2>Choose Your Numbers</h2>
          <span class="count" id="white-count">0 of ${game.mainCount}</span>
        </div>
        <div class="game-field">
          <label id="check-game-label" for="check-game">Lottery</label>
          ${gameMenuHTML("check-game", game)}
        </div>
        ${historyWindowHTML()}
        <p class="muted">${esc(game.blurb)} ${esc(span)}</p>
        <div class="seed">Fill from history
          <button type="button" data-strategy="hot" title="Most drawn in this history">Hot</button>
          <button type="button" data-strategy="overdue" title="Longest current wait">Overdue</button>
          <button type="button" data-strategy="balanced" title="Spread across the number range">Balanced</button>
          <button type="button" data-strategy="random" title="A random line">Random</button>
        </div>
        <p class="help">Select ${game.mainCount} ${noun} from ${game.mainMin} to ${game.mainMax}${game.ordered ? ". Order matters, and a digit can repeat." : "."}</p>
        <div class="num-grid${game.ordered ? " digits" : ""}" id="white-grid">${numberButtons(game.mainMin, game.mainMax, pick)}</div>
      </section>
      ${bonusCard}
      <section class="card">
        <div class="step-head">
          <span class="step-no">${stepCheck}</span>
          <h2>Check And Predict</h2>
        </div>
        <div class="slot-row spread" id="slots"></div>
        <p class="hint" id="hint"></p>
        <div class="check-wrap">
          <button type="button" class="check" id="check-btn" data-action="check" disabled>Predict from history →</button>
        </div>
        <div class="reset-wrap">
          <button type="button" class="reset" data-action="reset">Reset Numbers</button>
        </div>
      </section>
      <section class="card" id="results" hidden></section>`;
}

function build() {
  document.getElementById("latest").innerHTML = latestHTML();
  document.getElementById("side").innerHTML = `<nav class="side-card" aria-label="Lottery tools">${NAV.map((item) => `
    <button type="button" class="side-link" data-view="${item.id}">
      <span class="ico" style="background:${item.bg};color:${item.fg}">${icon(item.icon)}</span>
      ${item.label}
    </button>`).join("")}</nav>`;

  const views = ["predictor", "analysis", "buddies", "history", "powerball", "hot", "overdue"]
    .map((id) => `<div class="view" data-view="${id}" id="view-${id}" hidden></div>`)
    .join("");

  document.getElementById("main").innerHTML = `
    <h1 class="sr-only">Lottery number tools</h1>
    <div class="view" data-view="checker" id="view-checker">${renderChecker()}</div>
    ${views}
  `;
  updateUI();
}

function updateUI() {
  const game = checkerGame();
  const slots = document.getElementById("slots");
  const check = document.getElementById("check-btn");
  if (!slots || !check) return;
  if (game.ordered) {
    const full = state.digits.length >= game.mainCount;
    document.querySelectorAll("[data-pick='d']").forEach((btn) => {
      const n = +btn.dataset.n;
      const on = state.digits.includes(n);
      btn.classList.toggle("on", on);
      btn.setAttribute("aria-pressed", on ? "true" : "false");
      btn.disabled = full;
    });
    const chosen = state.digits.map((n, i) => (
      `<button type="button" class="ball w lg" data-remove="d" data-n="${i}" aria-label="Remove digit ${n}">${n}</button>`
    )).join("");
    const empty = Array.from({ length: game.mainCount - state.digits.length }, () => `<span class="ball w lg empty"></span>`).join("");
    slots.innerHTML = chosen + empty;
  } else {
    const full = state.whites.size >= game.mainCount;
    document.querySelectorAll("[data-pick='w']").forEach((btn) => {
      const n = +btn.dataset.n;
      const on = state.whites.has(n);
      btn.classList.toggle("on", on);
      btn.setAttribute("aria-pressed", on ? "true" : "false");
      btn.disabled = full && !on;
    });
    document.querySelectorAll("[data-pick='p']").forEach((btn) => {
      const on = state.pb === +btn.dataset.n;
      btn.classList.toggle("on", on);
      btn.setAttribute("aria-pressed", on ? "true" : "false");
    });
    const whites = selectedWhites();
    const whiteSlots = Array.from({ length: game.mainCount }, (_, i) => (
      whites[i]
        ? `<button type="button" class="ball w lg" data-remove="w" data-n="${whites[i]}" aria-label="Remove ${whites[i]}">${whites[i]}</button>`
        : `<span class="ball w lg empty"></span>`
    )).join("");
    const pbSlot = game.bonusMax
      ? (state.pb != null
        ? `<button type="button" class="ball p lg" data-remove="p" data-n="${state.pb}" aria-label="Remove ${game.bonusLabel} ${state.pb}">${state.pb}</button>`
        : `<span class="ball p lg empty"></span>`)
      : "";
    slots.innerHTML = whiteSlots + pbSlot;
  }
  const have = game.ordered ? state.digits.length : state.whites.size;
  const ready = have > 0;
  check.disabled = !ready;
  check.classList.toggle("ready", ready);
  check.textContent = lineComplete() ? "Check and predict →" : "Predict from history →";
  const hint = document.getElementById("hint");
  if (hint) hint.textContent = hintText();
  const whiteCountEl = document.getElementById("white-count");
  if (whiteCountEl) whiteCountEl.textContent = `${have} of ${game.mainCount}`;
  const pbCount = document.getElementById("pb-count");
  if (pbCount) pbCount.textContent = state.pb != null ? "Chosen" : "None yet";
}

function clearResults() {
  state.checked = false;
  const el = document.getElementById("results");
  if (!el) return;
  el.hidden = true;
  el.innerHTML = "";
}

function toggleWhite(n) {
  const max = checkerGame().mainCount;
  if (state.whites.has(n)) state.whites.delete(n);
  else if (state.whites.size < max) state.whites.add(n);
  else return;
  clearResults();
  updateUI();
}

function toggleDigit(n) {
  if (state.digits.length >= checkerGame().mainCount) return;
  state.digits.push(n);
  clearResults();
  updateUI();
}

function togglePb(n) {
  state.pb = state.pb === n ? null : n;
  clearResults();
  updateUI();
}

function removePick(kind, n) {
  if (kind === "d") state.digits.splice(n, 1);
  else if (kind === "w") state.whites.delete(n);
  else state.pb = null;
  clearResults();
  updateUI();
}

function resetLine() {
  state.whites.clear();
  state.digits = [];
  state.pb = null;
  clearResults();
  updateUI();
}

function rankRange(game, score) {
  const list = [];
  for (let n = game.mainMin; n <= game.mainMax; n += 1) list.push(n);
  list.sort((a, b) => score(b) - score(a) || a - b);
  return list;
}

function positionColumns(draws, count) {
  const cols = Array.from({ length: count }, () => Array(10).fill(0));
  const last = Array.from({ length: count }, () => Array(10).fill(-1));
  draws.forEach((d, i) => {
    d.main.forEach((digit, p) => {
      if (p >= count) return;
      cols[p][digit] += 1;
      if (last[p][digit] < 0) last[p][digit] = i;
    });
  });
  return { cols, last };
}

function applyGameStrategy(kind) {
  const game = checkerGame();
  const draws = historyDraws(game);
  if (game.ordered) {
    const stats = positionColumns(draws, game.mainCount);
    state.digits = stats.cols.map((col, i) => {
      if (kind === "random") return Math.floor(Math.random() * 10);
      if (kind === "overdue") {
        let best = 0;
        let bestGap = -1;
        for (let d = 0; d <= 9; d += 1) {
          const gap = stats.last[i][d] < 0 ? draws.length : stats.last[i][d];
          if (gap > bestGap) {
            bestGap = gap;
            best = d;
          }
        }
        return best;
      }
      const order = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9].sort((a, b) => col[b] - col[a] || a - b);
      return kind === "balanced" ? order[1] : order[0];
    });
    state.whites = new Set();
    state.pb = null;
  } else {
    const freq = new Map();
    const last = new Map();
    const bonusFreq = new Map();
    const bonusLast = new Map();
    draws.forEach((d, i) => {
      new Set(d.main).forEach((n) => {
        freq.set(n, (freq.get(n) || 0) + 1);
        if (!last.has(n)) last.set(n, i);
      });
      if (d.bonus != null) {
        bonusFreq.set(d.bonus, (bonusFreq.get(d.bonus) || 0) + 1);
        if (!bonusLast.has(d.bonus)) bonusLast.set(d.bonus, i);
      }
    });
    let mains;
    if (kind === "random") mains = sampleRange(game.mainMin, game.mainMax, game.mainCount);
    else if (kind === "overdue") {
      mains = rankRange(game, (n) => (last.has(n) ? last.get(n) : draws.length)).slice(0, game.mainCount);
    } else if (kind === "balanced") {
      const span = game.mainMax - game.mainMin + 1;
      const size = Math.ceil(span / game.mainCount);
      mains = [];
      for (let i = 0; i < game.mainCount; i += 1) {
        const start = game.mainMin + i * size;
        const end = Math.min(game.mainMax, start + size - 1);
        let best = start;
        for (let n = start; n <= end; n += 1) {
          if ((freq.get(n) || 0) > (freq.get(best) || 0)) best = n;
        }
        if (!mains.includes(best)) mains.push(best);
      }
      rankRange(game, (n) => freq.get(n) || 0).forEach((n) => {
        if (mains.length < game.mainCount && !mains.includes(n)) mains.push(n);
      });
    } else {
      mains = rankRange(game, (n) => freq.get(n) || 0).slice(0, game.mainCount);
    }
    state.whites = new Set(mains.slice(0, game.mainCount));
    state.digits = [];
    if (!game.bonusMax) state.pb = null;
    else if (kind === "random") state.pb = 1 + Math.floor(Math.random() * game.bonusMax);
    else if (kind === "overdue") {
      let best = 1;
      let bestGap = -1;
      for (let n = 1; n <= game.bonusMax; n += 1) {
        const gap = bonusLast.has(n) ? bonusLast.get(n) : draws.length;
        if (gap > bestGap) {
          bestGap = gap;
          best = n;
        }
      }
      state.pb = best;
    } else {
      let best = 1;
      let bestCount = -1;
      for (let n = 1; n <= game.bonusMax; n += 1) {
        const count = bonusFreq.get(n) || 0;
        if (count > bestCount) {
          bestCount = count;
          best = n;
        }
      }
      state.pb = best;
    }
  }
  updateUI();
  onCheck();
}

function applyStrategy(kind) {
  applyGameStrategy(kind);
}

function weakestNumber(draws = DRAWS) {
  const ws = selectedWhites();
  let worst = ws[0];
  let worstScore = Infinity;
  ws.forEach((n) => {
    const score = ws.reduce((s, o) => (o === n ? s : s + drawPairCount(draws, n, o)), 0);
    if (score < worstScore) {
      worstScore = score;
      worst = n;
    }
  });
  return worst;
}

function swapNumber(n) {
  if (state.whites.has(n)) return;
  const weak = weakestNumber(historyDraws(checkerGame()));
  state.whites.delete(weak);
  state.whites.add(n);
  updateUI();
  onCheck();
}

function markedBalls(draw, main, bonus, ordered) {
  if (ordered) {
    return draw.main.map((n, i) => ball(n, "w", "sm", n === main[i] ? "hit" : "")).join("");
  }
  const set = new Set(main);
  const whites = draw.main.map((n) => ball(n, "w", "sm", set.has(n) ? "hit" : "")).join("");
  const extra = draw.bonus != null ? ball(draw.bonus, "p", "sm", draw.bonus === bonus ? "hit" : "") : "";
  return whites + extra;
}

function genericResultsHTML() {
  const game = checkerGame();
  const main = game.ordered ? state.digits.slice() : selectedWhites();
  const bonus = game.bonusMax ? state.pb : null;
  const draws = historyDraws(game);
  const scored = [];
  draws.forEach((d) => {
    if (game.ordered) {
      let pos = 0;
      main.forEach((n, i) => { if (d.main[i] === n) pos += 1; });
      if (!pos) return;
      const exact = pos === main.length;
      scored.push({
        d,
        score: pos,
        exact,
        label: exact ? "Exact match" : `${pos} of ${main.length} digits`,
        short: exact ? "Exact" : `${pos}/${main.length}`,
      });
      return;
    }
    const set = new Set(d.main);
    let match = 0;
    main.forEach((n) => { if (set.has(n)) match += 1; });
    const bonusHit = bonus != null && d.bonus === bonus;
    if (!match && !bonusHit) return;
    const exact = match === main.length && (bonus == null || bonusHit);
    let label = `${match} of ${main.length}`;
    if (game.bonusMax && bonusHit) label += ` + ${game.bonusLabel}`;
    if (exact) label = game.bonusMax ? `All numbers + ${game.bonusLabel}` : "Exact match";
    scored.push({
      d,
      score: match * 2 + (bonusHit ? 1 : 0),
      exact,
      label,
      short: exact ? "Exact" : (bonusHit ? `${match}+` : `${match}/${main.length}`),
    });
  });
  scored.sort((a, b) => b.score - a.score || (a.d.date < b.d.date ? 1 : -1));
  const exact = scored.filter((row) => row.exact).length;
  const best = scored[0];
  const banner = exact
    ? `This line matches ${exact === 1 ? "1 drawing" : `${commas(exact)} drawings`} exactly.`
    : best
      ? `No exact match in ${commas(draws.length)} drawings. The closest result is ${best.label}.`
      : `This line shares no numbers with these ${commas(draws.length)} drawings.`;
  const close = scored.slice(0, 6).map((row) => `
    <article class="draw">
      <div>
        <div>${longDate(row.d.date)}</div>
        ${row.d.session ? `<div class="muted">${esc(row.d.session)}</div>` : ""}
        <div><span class="badge">${esc(row.label)}</span></div>
      </div>
      <div class="slots">${markedBalls(row.d, main, bonus, game.ordered)}</div>
    </article>`).join("");
  const yours = main.map((n) => ball(n, "w", "lg")).join("") + (bonus != null ? ball(bonus, "p", "lg") : "");
  const range = draws.length ? `${shortDate(draws[draws.length - 1].date)} – ${shortDate(draws[0].date)}` : "";
  return `
    <div class="step-head"><h2>How this line has done</h2></div>
    <p class="muted">${esc(game.label)} · ${commas(draws.length)} drawings${range ? ` · ${range}` : ""}</p>
    <div class="slot-row spread">${yours}</div>
    <div class="banner ${exact ? "hit" : ""}">${banner}</div>
    <div class="stats">
      <div class="stat"><b>${commas(draws.length)}</b><span>Drawings checked</span></div>
      <div class="stat"><b>${commas(exact)}</b><span>Exact matches</span></div>
      <div class="stat"><b>${best ? esc(best.short) : "—"}</b><span>Closest</span></div>
      <div class="stat"><b>${commas(scored.length)}</b><span>Drawings with overlap</span></div>
    </div>
    <h3>Closest drawings</h3>
    ${close || `<p class="muted">No drawing shares a number with this line.</p>`}
    <p class="note">Past counts do not change the chance of the next drawing.</p>
  `;
}

function predictionBlock() {
  const seed = predictionSeed();
  if (seed == null) return "";
  return renderPredictResult(predictFromHistory(checkerGame(), seed, null, historyDraws(checkerGame())));
}

function onCheck(skipScroll) {
  const game = checkerGame();
  const have = game.ordered ? state.digits.length : state.whites.size;
  if (!have) return;
  state.checked = true;
  const el = document.getElementById("results");
  const report = lineComplete() ? (game.id === "powerball" ? resultsHTML() : genericResultsHTML()) : "";
  el.hidden = false;
  el.innerHTML = report + predictionBlock();
  if (!skipScroll) el.scrollIntoView({ behavior: "smooth", block: "start" });
}

function resultsHTML() {
  const whites = selectedWhites();
  const pb = state.pb;
  const draws = historyDraws(checkerGame());
  const report = analyzeLine(whites, pb, draws);
  const pairCounts = new Map();
  const oddHist = Array(6).fill(0);
  const highHist = Array(6).fill(0);
  let sumTotal = 0;
  draws.forEach((draw) => {
    let odd = 0;
    let high = 0;
    let sum = 0;
    draw.w.forEach((n) => {
      sum += n;
      if (n % 2 === 1) odd += 1;
      if (n >= 35) high += 1;
    });
    sumTotal += sum;
    oddHist[odd] += 1;
    highHist[high] += 1;
    for (let i = 0; i < draw.w.length; i += 1) {
      for (let j = i + 1; j < draw.w.length; j += 1) {
        const key = `${Math.min(draw.w[i], draw.w[j])}:${Math.max(draw.w[i], draw.w[j])}`;
        pairCounts.set(key, (pairCounts.get(key) || 0) + 1);
      }
    }
  });
  const avgSumForWindow = draws.length ? sumTotal / draws.length : 0;
  let sumVariance = 0;
  draws.forEach((draw) => {
    const drawSum = draw.w.reduce((total, n) => total + n, 0);
    sumVariance += (drawSum - avgSumForWindow) ** 2;
  });
  const sdSumForWindow = draws.length ? Math.sqrt(sumVariance / draws.length) : 0;
  const wins = TIERS.reduce((s, t) => s + report.counts[t.id], 0);
  const jackpots = report.counts.j;
  let dollars = 0;
  TIERS.forEach((t) => { if (t.dollars) dollars += t.dollars * report.counts[t.id]; });
  let banner = `If this line had been played on every drawing, it would have won a base prize ${wins === 1 ? "1 time" : `${commas(wins)} times`}.`;
  if (jackpots) {
    banner = `This line matches the jackpot on ${jackpots === 1 ? "1 drawing" : `${jackpots} drawings`} in this set.`;
  } else if (!wins) {
    banner = `This line has not hit a prize tier in these ${commas(draws.length)} drawings.`;
  }

  const odd = whites.filter((n) => n % 2 === 1).length;
  const high = whites.filter((n) => n >= 35).length;
  const sum = whites.reduce((s, n) => s + n, 0);
  const sumWord = Math.abs(sum - avgSumForWindow) < sdSumForWindow * 0.35
    ? "close to the average winning sum"
    : (sum < avgSumForWindow ? "below the average winning sum" : "above the average winning sum");

  const rows = TIERS.map((t) => {
    const count = report.counts[t.id];
    return `<tr class="${count ? "won" : ""}"><td>${t.label}</td><td>${t.prize}</td><td class="right">${commas(count)}</td></tr>`;
  }).join("");

  const numberRows = whites.map((n) => numberRow(n, "w", draws)).join("") + numberRow(pb, "pb", draws);

  const pairs = [];
  for (let i = 0; i < whites.length; i += 1) {
    for (let j = i + 1; j < whites.length; j += 1) {
      const key = `${Math.min(whites[i], whites[j])}:${Math.max(whites[i], whites[j])}`;
      pairs.push({ a: whites[i], b: whites[j], c: pairCounts.get(key) || 0 });
    }
  }
  pairs.sort((a, b) => b.c - a.c);
  const pairHTML = pairs.slice(0, 4).map((p) => `
    <div class="pair">${ball(p.a, "w", "sm")}${ball(p.b, "w", "sm")}
      <span class="meta">together in ${commas(p.c)} drawings</span>
    </div>`).join("");

  const weak = weakestNumber(draws);
  const comps = companionPicks(weak, 5, draws);
  const compHTML = comps.map((c) => `
    <button type="button" class="ball w sm" data-swap="${c.n}" title="Replace ${weak} with ${c.n}">${c.n}</button>
  `).join("");

  const closeHTML = report.closest.length ? report.closest.map((item) => `
    <div class="draw">
      <div>
        <div>${shortDate(item.d.date)}</div>
        <span class="badge">${matchLabel(item.match, item.pbHit)}</span>
      </div>
      <div class="slots">${item.d.w.map((n) => ball(n, "w", "sm", state.whites.has(n) ? "hit" : "")).join("")}${ball(item.d.pb, "p", "sm", item.d.pb === pb ? "hit" : "")}</div>
      <button type="button" class="load" data-load="${item.d.date}">Use this line</button>
    </div>`).join("") : `<p class="muted">No drawing shares a number with this line.</p>`;

  return `
    <div class="step-head"><h2>How this line has done</h2></div>
    <p class="muted">${commas(draws.length)} drawings${draws.length ? ` · ${shortDate(draws[draws.length - 1].date)} – ${shortDate(draws[0].date)}` : " in this date range"}</p>
    <div class="slot-row">${ballsRow(whites, pb, "lg")}</div>
    <div class="banner ${wins ? "hit" : ""}">${banner}</div>
    <div class="stats">
      <div class="stat"><b>${commas(report.counts.j)}</b><span>Jackpot matches</span></div>
      <div class="stat"><b>${commas(wins)}</b><span>Prize-tier hits</span></div>
      <div class="stat"><b>${money(dollars)}</b><span>Base prizes</span></div>
      <div class="stat"><b>${sum}</b><span>White-ball sum</span></div>
    </div>
    <p>${draws.length ? `This white-ball sum, ${sum}, is ${sumWord} of ${avgSumForWindow.toFixed(0)}. ${odd} odd and ${5 - odd} even appeared in ${((oddHist[odd] / draws.length) * 100).toFixed(1)}% of drawings. ${high} high ${high === 1 ? "number" : "numbers"} (35–69) appeared in ${((highHist[high] / draws.length) * 100).toFixed(1)}% of drawings.` : "No drawings are available in this date range."}</p>
    <h3>Prize check</h3>
    <div class="table-wrap">
      <table>
        <thead><tr><th>Result</th><th>Base prize</th><th class="right">Times</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
    </div>
    <p class="note">Base prizes assume the line was entered on every drawing. Power Play is not applied. Jackpot amounts are left out of the dollar total because the jackpot changes every drawing.</p>
    <h3>Numbers in this line</h3>
    <div class="table-wrap">
      <table>
        <thead><tr><th>Number</th><th class="right">Drawn</th><th class="right">Vs usual</th><th>Last seen</th><th>Pace</th></tr></thead>
        <tbody>${numberRows}</tbody>
      </table>
    </div>
    <h3>How these numbers travel together</h3>
    <p class="muted">A typical pair shows up in the same drawing about ${(draws.length * 10 / ((69 * 68) / 2)).toFixed(1)} times in this range.</p>
    ${pairHTML}
    <h3>Often drawn with the rest of this line</h3>
    <p>${weak} is the least connected number here. These have appeared more often beside the other four. Choose one to replace ${weak}.</p>
    <div class="slots">${compHTML}</div>
    <h3>Closest drawings</h3>
    ${closeHTML}
    <p class="note">The chance of this exact combination on the next drawing is 1 in ${commas(ODDS)}. Past counts do not carry forward.</p>
  `;
}

function numberRow(n, pool, draws) {
  const isPb = pool === "pb";
  let count = 0;
  let gap = -1;
  draws.forEach((draw, i) => {
    if ((isPb ? draw.pb === n : draw.w.includes(n))) {
      count += 1;
      if (gap < 0) gap = i;
    }
  });
  const expected = draws.length * (isPb ? 1 / 26 : 5 / 69);
  const diff = count - expected;
  const sign = diff > 0 ? "+" : "";
  const last = gap < 0 ? "—" : shortDate(draws[gap].date);
  const typicalGap = count ? draws.length / count : Infinity;
  const tag = gap >= 0 && gap > typicalGap * 1.6 ? "Overdue" : (count > expected * 1.45 ? "Hot" : (count < expected * 0.5 ? "Cold" : "Typical"));
  const kind = pool === "pb" ? "p" : "w";
  return `<tr>
    <td>${ball(n, kind, "sm")}</td>
    <td class="right">${commas(count)}</td>
    <td class="right">${sign}${diff.toFixed(1)}</td>
    <td>${last}<div class="muted">${gap < 0 ? "" : agoLabel(gap)}</div></td>
    <td>${tagHTML(tag)}</td>
  </tr>`;
}

function drawPairCount(draws, first, second) {
  return draws.reduce((count, draw) => count + (draw.w.includes(first) && draw.w.includes(second) ? 1 : 0), 0);
}

function companionPicks(weak, k, draws) {
  const others = selectedWhites().filter((n) => n !== weak);
  const list = [];
  for (let n = 1; n <= 69; n += 1) {
    if (state.whites.has(n)) continue;
    const score = others.reduce((s, o) => s + drawPairCount(draws, n, o), 0);
    list.push({ n, score });
  }
  list.sort((a, b) => b.score - a.score || a.n - b.n);
  return list.slice(0, k);
}

function windowCounts() {
  if (state.window === "30") return { arr: recentWhite[30], n: Math.min(30, DRAWS.length) };
  if (state.window === "100") return { arr: recentWhite[100], n: Math.min(100, DRAWS.length) };
  return { arr: whiteCount, n: DRAWS.length };
}

function heatStyle(t) {
  const from = [244, 236, 220];
  const to = [26, 39, 68];
  const c = from.map((v, i) => Math.round(v + (to[i] - v) * t));
  const color = t > 0.62 ? "#fff" : "#1c1915";
  return `background:rgb(${c.join(",")});color:${color}`;
}

const PREDICT_GAMES = [
  {
    id: "powerball",
    label: "Powerball",
    blurb: "5 numbers from 1 to 69, then a Powerball from 1 to 26.",
    mainMin: 1,
    mainMax: 69,
    mainCount: 5,
    bonusMax: 26,
    bonusLabel: "Powerball",
    ordered: false,
    session: false,
  },
  {
    id: "megamillions",
    label: "Mega Millions",
    blurb: "5 numbers from 1 to 70, then a Mega Ball from 1 to 24. History uses the current matrix, starting April 8, 2025.",
    mainMin: 1,
    mainMax: 70,
    mainCount: 5,
    bonusMax: 24,
    bonusLabel: "Mega Ball",
    ordered: false,
    session: false,
  },
  {
    id: "millionaire",
    label: "Millionaire for Life",
    blurb: "5 numbers from 1 to 58, then a Millionaire Ball from 1 to 5.",
    mainMin: 1,
    mainMax: 58,
    mainCount: 5,
    bonusMax: 5,
    bonusLabel: "Millionaire Ball",
    ordered: false,
    session: false,
  },
  {
    id: "take5",
    label: "Take 5",
    blurb: "5 numbers from 1 to 39. Midday and evening drawings are both included.",
    mainMin: 1,
    mainMax: 39,
    mainCount: 5,
    bonusMax: 0,
    bonusLabel: "",
    ordered: false,
    session: true,
  },
  {
    id: "win4",
    label: "Win 4",
    blurb: "4 digits from 0 to 9, in order. A digit can repeat. Midday and evening drawings are both included.",
    mainMin: 0,
    mainMax: 9,
    mainCount: 4,
    bonusMax: 0,
    bonusLabel: "",
    ordered: true,
    session: true,
  },
  {
    id: "numbers",
    label: "Numbers",
    blurb: "3 digits from 0 to 9, in order. A digit can repeat. Midday and evening drawings are both included.",
    mainMin: 0,
    mainMax: 9,
    mainCount: 3,
    bonusMax: 0,
    bonusLabel: "",
    ordered: true,
    session: true,
  },
  {
    id: "pick10",
    label: "Pick 10",
    blurb: "A play is 10 numbers from 1 to 80. Each drawing has 20 numbers, and the line keeps the 10 that have traveled with your number.",
    mainMin: 1,
    mainMax: 80,
    mainCount: 10,
    bonusMax: 0,
    bonusLabel: "",
    ordered: false,
    session: false,
  },
];

const ORDINALS = ["1st", "2nd", "3rd", "4th"];
const drawCache = Object.create(null);

function predictGame() {
  return PREDICT_GAMES.find((g) => g.id === state.predictGame) || PREDICT_GAMES[0];
}

function gameDraws(game) {
  if (drawCache[game.id]) return drawCache[game.id];
  let list;
  if (game.id === "powerball") {
    list = DRAWS.map((d) => ({ date: d.date, session: "", main: d.w.slice(), bonus: d.pb }));
  } else {
    const rows = (window.GAME_DRAWS && window.GAME_DRAWS[game.id]) || [];
    list = rows.map((row) => {
      if (game.bonusMax) {
        return {
          date: row[0],
          session: "",
          main: row.slice(1, 1 + game.mainCount),
          bonus: row[1 + game.mainCount],
        };
      }
      if (game.session) return { date: row[0], session: row[1], main: row.slice(2), bonus: null };
      return { date: row[0], session: "", main: row.slice(1), bonus: null };
    });
  }
  drawCache[game.id] = list;
  return list;
}

function historyDraws(game) {
  const draws = gameDraws(game);
  if (state.historyDays === "all") return draws;
  const days = Number(state.historyDays);
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);
  const cutoff = new Date(today);
  cutoff.setUTCDate(cutoff.getUTCDate() - days + 1);
  const startDate = cutoff.toISOString().slice(0, 10);
  const endDate = today.toISOString().slice(0, 10);
  return draws.filter((draw) => draw.date >= startDate && draw.date <= endDate);
}

function historyWindowHTML() {
  const options = [
    ["30", "30 days"],
    ["60", "60 days"],
    ["90", "90 days"],
    ["120", "120 days"],
    ["all", "All history"],
  ];
  return `<div class="history-filter">
    <span class="kicker">History window</span>
    <div class="seg history-window-options" role="group" aria-label="History date range">${options.map(([days, label]) => `
      <button type="button" data-history-days="${days}" class="${state.historyDays === days ? "on" : ""}" aria-pressed="${state.historyDays === days}">${label}</button>`).join("")}
    </div>
  </div>`;
}

function drawWhen(d) {
  return d.session ? `${shortDate(d.date)} · ${d.session}` : shortDate(d.date);
}

function latestForGame(game) {
  const draws = gameDraws(game);
  const d = draws[0];
  if (!d) {
    return `<div><div class="kicker">${esc(game.label)}</div><div class="when">History did not load</div></div>`;
  }
  const balls = d.main.map((n) => ball(n, "w", "sm")).join("") + (d.bonus != null ? ball(d.bonus, "p", "sm") : "");
  const session = d.session ? ` · ${esc(d.session)}` : "";
  return `
    <div>
      <div class="kicker">Latest ${esc(game.label)} drawing</div>
      <div class="when">${longDate(d.date)}${session}</div>
      ${refreshNote()}
    </div>
    <div class="slots">${balls}</div>
  `;
}

function refreshLatest() {
  const el = document.getElementById("latest");
  if (el) el.innerHTML = latestHTML();
}

function takeTop(map, k, ban, min, max) {
  const list = [];
  for (let n = min; n <= max; n += 1) {
    if (!ban.has(n)) list.push(n);
  }
  list.sort((a, b) => (map.get(b) || 0) - (map.get(a) || 0) || a - b);
  return list.slice(0, k);
}

function lineSignature(main, bonus) {
  return `${main.join(",")}|${bonus == null ? "" : bonus}`;
}

const LATEST_WINDOWS = [25, 40, 60, 90, 120];

function latestWindowSize() {
  return LATEST_WINDOWS[state.predictShift % LATEST_WINDOWS.length];
}

function bumpPredictShift() {
  state.predictShift = (state.predictShift + 1) % LATEST_WINDOWS.length;
}

function predictFromHistory(game, seed, recentCount, sourceDraws) {
  const draws = sourceDraws || gameDraws(game);
  const withSeed = draws.filter((d) => d.main.includes(seed));
  const freq = new Map();
  const last = new Map();
  const bonusFreq = new Map();
  const bonusWith = new Map();
  draws.forEach((d, i) => {
    const seen = new Set();
    d.main.forEach((n) => {
      if (seen.has(n)) return;
      seen.add(n);
      freq.set(n, (freq.get(n) || 0) + 1);
      if (!last.has(n)) last.set(n, i);
    });
    if (d.bonus != null) {
      bonusFreq.set(d.bonus, (bonusFreq.get(d.bonus) || 0) + 1);
    }
  });
  const pair = new Map();
  withSeed.forEach((d) => {
    d.main.forEach((n) => {
      if (n !== seed) pair.set(n, (pair.get(n) || 0) + 1);
    });
    if (d.bonus != null) bonusWith.set(d.bonus, (bonusWith.get(d.bonus) || 0) + 1);
  });
  const recentLimit = recentCount || 40;
  const recent = withSeed.slice(0, recentLimit);
  const pairRecent = new Map();
  recent.forEach((d) => {
    d.main.forEach((n) => {
      if (n !== seed) pairRecent.set(n, (pairRecent.get(n) || 0) + 1);
    });
  });

  function gapOf(n) {
    return last.has(n) ? last.get(n) : draws.length;
  }

  function modeBonus(source) {
    if (!game.bonusMax) return null;
    const counts = new Map();
    source.forEach((d) => {
      if (d.bonus != null) counts.set(d.bonus, (counts.get(d.bonus) || 0) + 1);
    });
    let best = 1;
    for (let n = 1; n <= game.bonusMax; n += 1) {
      const c1 = counts.get(n) || 0;
      const c2 = counts.get(best) || 0;
      if (c1 > c2) best = n;
      else if (c1 === c2) {
        const p1 = bonusWith.get(n) || 0;
        const p2 = bonusWith.get(best) || 0;
        if (p1 > p2 || (p1 === p2 && (bonusFreq.get(n) || 0) > (bonusFreq.get(best) || 0)) || (p1 === p2 && (bonusFreq.get(n) || 0) === (bonusFreq.get(best) || 0) && n < best)) {
          best = n;
        }
      }
    }
    return best;
  }

  function fillSet(preferred) {
    const line = [];
    const seen = new Set();
    preferred.forEach((n) => {
      if (seen.has(n) || n == null) return;
      seen.add(n);
      line.push(n);
    });
    if (!seen.has(seed)) {
      line.unshift(seed);
      seen.add(seed);
    }
    if (line.length < game.mainCount) {
      takeTop(freq, game.mainCount, seen, game.mainMin, game.mainMax).forEach((n) => {
        if (line.length < game.mainCount) {
          seen.add(n);
          line.push(n);
        }
      });
    }
    return line.slice(0, game.mainCount).sort((a, b) => a - b);
  }

  function lineFromDraw(draw, label) {
    if (game.ordered) {
      const main = draw.main.slice(0, game.mainCount);
      if (!main.includes(seed)) main[main.length - 1] = seed;
      return { label, detail: drawWhen(draw), main, bonus: null };
    }
    const others = draw.main.filter((n) => n !== seed);
    others.sort((a, b) => (freq.get(b) || 0) - (freq.get(a) || 0) || a - b);
    const preferred = draw.main.length === game.mainCount && draw.main.includes(seed)
      ? draw.main
      : [seed, ...others];
    return {
      label,
      detail: drawWhen(draw),
      main: fillSet(preferred),
      bonus: draw.bonus != null ? draw.bonus : modeBonus(withSeed),
    };
  }

  function columnCounts(source) {
    const cols = Array.from({ length: game.mainCount }, () => Array(10).fill(0));
    source.forEach((d) => {
      d.main.forEach((digit, i) => {
        if (i < game.mainCount) cols[i][digit] += 1;
      });
    });
    return cols;
  }

  function modeLine(cols) {
    return cols.map((col) => {
      let best = 0;
      let bestC = -1;
      for (let d = 0; d <= 9; d += 1) {
        if (col[d] > bestC) {
          best = d;
          bestC = col[d];
        }
      }
      return best;
    });
  }

  function seedPosition(source) {
    const cols = columnCounts(source.length ? source : draws);
    let pos = 0;
    let best = -1;
    cols.forEach((col, i) => {
      if (col[seed] > best) {
        best = col[seed];
        pos = i;
      }
    });
    return pos;
  }

  let candidates;
  if (game.ordered) {
    const allCols = columnCounts(draws);
    const hitSource = withSeed.length ? withSeed : draws;
    const hitCols = columnCounts(hitSource);
    const latest = hitSource[0];
    const pos = seedPosition(hitSource);
    const beside = draws.filter((d) => d.main[pos] === seed);
    const besideLine = modeLine(columnCounts(beside.length ? beside : hitSource));
    besideLine[pos] = seed;
    const usual = modeLine(allCols);
    if (!usual.includes(seed)) usual[seedPosition(draws)] = seed;
    const whenHit = modeLine(hitCols);
    if (!whenHit.includes(seed)) whenHit[pos] = seed;
    let repeated = latest.main.slice();
    let repeatedCount = 0;
    const tally = new Map();
    hitSource.forEach((d) => {
      const key = d.main.join(",");
      const next = (tally.get(key) || 0) + 1;
      tally.set(key, next);
      if (next > repeatedCount) {
        repeatedCount = next;
        repeated = d.main.slice();
      }
    });
    candidates = [
      { label: "Usual position", detail: "The usual digit in each spot, with your digit kept where it lands most.", main: usual, bonus: null },
      { label: "Draws with your digit", detail: "The usual digit in each spot when your digit was drawn.", main: whenHit, bonus: null },
      { label: "Latest hit", detail: drawWhen(latest), main: latest.main.slice(), bonus: null },
      { label: "Most repeated line", detail: repeatedCount > 1 ? `This exact line has been drawn ${repeatedCount} times.` : "No exact line repeated, so this is the newest drawing with your digit.", main: repeated, bonus: null },
      { label: "Beside your digit", detail: `Digits that show up when yours is in the ${ORDINALS[pos]} spot.`, main: besideLine, bonus: null },
    ];
  } else {
    const companionMap = pair.size ? pair : freq;
    const companions = fillSet([seed, ...takeTop(companionMap, game.mainCount - 1, new Set([seed]), game.mainMin, game.mainMax)]);
    const recentMap = pairRecent.size ? pairRecent : companionMap;
    const recentLine = fillSet([seed, ...takeTop(recentMap, game.mainCount - 1, new Set([seed]), game.mainMin, game.mainMax)]);
    let bestDraw = null;
    let bestScore = -1;
    const scored = withSeed.length ? withSeed : draws;
    scored.forEach((d) => {
      let score = 0;
      d.main.forEach((n) => {
        if (n !== seed) score += freq.get(n) || 0;
      });
      if (d.bonus != null) score += (bonusFreq.get(d.bonus) || 0) * game.mainCount;
      if (score > bestScore) {
        bestScore = score;
        bestDraw = d;
      }
    });
    const overduePool = [];
    for (let n = game.mainMin; n <= game.mainMax; n += 1) {
      if (n !== seed && (!withSeed.length || pair.get(n) > 0)) overduePool.push(n);
    }
    overduePool.sort((a, b) => gapOf(b) - gapOf(a) || (pair.get(b) || 0) - (pair.get(a) || 0) || a - b);
    const overdue = fillSet([seed, ...overduePool.slice(0, game.mainCount - 1)]);
    let overdueBonus = modeBonus(withSeed);
    if (game.bonusMax) {
      let bestGap = -1;
      const bonusPool = [];
      for (let n = 1; n <= game.bonusMax; n += 1) {
        if (!withSeed.length || bonusWith.get(n) > 0) bonusPool.push(n);
      }
      (bonusPool.length ? bonusPool : [overdueBonus]).forEach((n) => {
        const gap = bonusFreq.has(n) ? (function bonusGap(num) {
          let found = draws.length;
          for (let i = 0; i < draws.length; i += 1) {
            if (draws[i].bonus === num) return i;
          }
          return found;
        }(n)) : draws.length;
        if (gap > bestGap || (gap === bestGap && n < overdueBonus)) {
          bestGap = gap;
          overdueBonus = n;
        }
      });
    }
    const chainSource = recentCount != null ? draws.slice(0, recentLimit) : draws;
    const sets = chainSource.map((d) => new Set(d.main));
    const chain = [seed];
    while (chain.length < game.mainCount) {
      let best = null;
      let bestChain = -1;
      for (let n = game.mainMin; n <= game.mainMax; n += 1) {
        if (chain.includes(n)) continue;
        let score = 0;
        sets.forEach((set) => {
          if (!set.has(n)) return;
          chain.forEach((c) => {
            if (set.has(c)) score += 1;
          });
        });
        if (score > bestChain || (score === bestChain && (best == null || n < best))) {
          best = n;
          bestChain = score;
        }
      }
      if (best == null) break;
      chain.push(best);
    }
    const chainLine = fillSet(chain);
    function bonusForMain(main) {
      if (!game.bonusMax) return null;
      const scores = new Map();
      draws.forEach((d) => {
        if (d.bonus == null) return;
        let hit = 0;
        const set = new Set(d.main);
        main.forEach((n) => {
          if (set.has(n)) hit += 1;
        });
        if (hit > 0) scores.set(d.bonus, (scores.get(d.bonus) || 0) + hit);
      });
      if (!scores.size) return modeBonus(withSeed.length ? withSeed : draws);
      let best = null;
      let bestS = -1;
      scores.forEach((s, n) => {
        if (best == null || s > bestS || (s === bestS && n < best)) {
          best = n;
          bestS = s;
        }
      });
      return best;
    }
    const strongest = bestDraw
      ? lineFromDraw(bestDraw, "Strongest past drawing")
      : { label: "Strongest past drawing", detail: "No drawing was available.", main: companions, bonus: modeBonus(draws) };
    if (bestDraw) {
      strongest.detail = bestDraw.main.length === game.mainCount
        ? drawWhen(bestDraw)
        : `${drawWhen(bestDraw)} · your number plus the most common companions in that drawing`;
    }
    candidates = [
      {
        label: "Usual companions",
        detail: withSeed.length ? `Numbers most often drawn with ${seed}.` : "Your number is not in this history, so this uses the most drawn numbers.",
        main: companions,
        bonus: modeBonus(withSeed.length ? withSeed : draws),
      },
      {
        label: "Recent companions",
        detail: recent.length ? `Most often with ${seed} in the latest ${recent.length} drawings that included it.` : "Not enough recent hits, so this follows the full history.",
        main: recentLine,
        bonus: modeBonus(recent.length ? recent : draws),
      },
      strongest,
      {
        label: "Longest current waits",
        detail: `Companions of ${seed} with the longest current wait.`,
        main: overdue,
        bonus: game.bonusMax ? overdueBonus : null,
      },
      {
        label: "Number chain",
        detail: recentCount != null
          ? `Built from the latest ${commas(recentLimit)} drawings by adding the number that shared a drawing most often.`
          : `Built by adding the number that has most often shared a drawing with the line so far.`,
        main: chainLine,
        bonus: bonusForMain(chainLine),
      },
    ];
  }

  const pool = withSeed.length ? withSeed : draws;
  const used = new Set();
  let cursor = 0;
  const unique = candidates.map((c) => {
    let current = { label: c.label, detail: c.detail, main: c.main.slice(), bonus: c.bonus == null ? null : c.bonus };
    let spins = 0;
    while (pool.length && used.has(lineSignature(current.main, current.bonus)) && spins < pool.length) {
      const draw = pool[cursor];
      cursor = (cursor + 1) % pool.length;
      spins += 1;
      current = lineFromDraw(draw, c.label);
      current.detail = `${drawWhen(draw)}. Used so this result stays different from the others.`;
    }
    used.add(lineSignature(current.main, current.bonus));
    return current;
  });

  let first;
  let finalPick;
  if (game.ordered) {
    const cols = Array.from({ length: game.mainCount }, () => Array(10).fill(0));
    unique.forEach((c) => {
      c.main.forEach((digit, i) => {
        if (i < game.mainCount) cols[i][digit] += 1;
      });
    });
    first = modeLine(cols);
    let seedPos = 0;
    let seedHits = -1;
    cols.forEach((col, i) => {
      if (col[seed] > seedHits) {
        seedHits = col[seed];
        seedPos = i;
      }
    });
    if (!first.includes(seed)) first[seedPos] = seed;
    const pairs = [];
    cols.forEach((col, i) => {
      for (let d = 0; d <= 9; d += 1) pairs.push({ pos: i, digit: d, hits: col[d] });
    });
    pairs.sort((a, b) => b.hits - a.hits || (a.digit === seed) - (b.digit === seed) || a.pos - b.pos || a.digit - b.digit);
    const top = pairs[0];
    finalPick = {
      n: top.digit,
      hits: top.hits,
      of: unique.length,
      pos: top.pos,
      kind: "w",
      text: `${top.digit} is the most confident digit. It is the ${ORDINALS[top.pos]} digit in ${top.hits} of the 5 results.`,
    };
  } else {
    const votes = new Map();
    unique.forEach((c) => {
      c.main.forEach((n) => {
        if (n !== seed) votes.set(n, (votes.get(n) || 0) + 1);
      });
    });
    const ranked = [...votes.keys()].sort((a, b) => (votes.get(b) || 0) - (votes.get(a) || 0) || (pair.get(b) || 0) - (pair.get(a) || 0) || a - b);
    first = fillSet([seed, ...ranked]);
    if (game.bonusMax) {
      const bVotes = new Map();
      unique.forEach((c) => {
        if (c.bonus != null) bVotes.set(c.bonus, (bVotes.get(c.bonus) || 0) + 1);
      });
      let best = 1;
      let bestHits = -1;
      for (let n = 1; n <= game.bonusMax; n += 1) {
        const hits = bVotes.get(n) || 0;
        const bestWith = bonusWith.get(best) || 0;
        const withN = bonusWith.get(n) || 0;
        if (
          hits > bestHits
          || (hits === bestHits && withN > bestWith)
          || (hits === bestHits && withN === bestWith && (bonusFreq.get(n) || 0) > (bonusFreq.get(best) || 0))
          || (hits === bestHits && withN === bestWith && (bonusFreq.get(n) || 0) === (bonusFreq.get(best) || 0) && n < best)
        ) {
          best = n;
          bestHits = hits;
        }
      }
      const text = bestHits > 1
        ? `${game.bonusLabel} ${best} is the most confident final number. It is the final number in ${bestHits} of the 5 results.`
        : `${game.bonusLabel} ${best} is the most confident final number. The 5 results did not share one final number, so this is the ${game.bonusLabel} drawn most often with ${seed}.`;
      finalPick = { n: best, hits: Math.max(bestHits, 0), of: unique.length, kind: "p", text };
    } else {
      const top = ranked[0];
      const hits = top == null ? 0 : votes.get(top) || 0;
      const n = top == null ? seed : top;
      finalPick = {
        n,
        hits,
        of: unique.length,
        kind: "w",
        text: `${n} is the most confident number. It appears in ${hits} of the 5 results.`,
      };
    }
  }

  if (recentCount != null && !game.ordered && first) {
    const latest = draws.slice(0, recentLimit);
    const heat = new Map();
    latest.forEach((d) => {
      if (!d.main.includes(seed)) return;
      d.main.forEach((n) => {
        if (n !== seed) heat.set(n, (heat.get(n) || 0) + 1);
      });
    });
    const incoming = [...heat.keys()]
      .sort((a, b) => (heat.get(b) - heat.get(a)) || a - b)
      .find((n) => !first.includes(n));
    if (incoming != null) {
      let weak = null;
      let weakScore = Infinity;
      first.forEach((n) => {
        if (n === seed) return;
        const score = (pair.get(n) || 0) * 1000 + (heat.get(n) || 0);
        if (score < weakScore) {
          weak = n;
          weakScore = score;
        }
      });
      if (weak != null) first = first.map((n) => (n === weak ? incoming : n)).sort((a, b) => a - b);
    }
    if (game.bonusMax && state.predictShift % 2 === 1) {
      const bonusHeat = new Map();
      latest.forEach((d) => {
        if (d.bonus == null || !d.main.includes(seed)) return;
        bonusHeat.set(d.bonus, (bonusHeat.get(d.bonus) || 0) + 1);
      });
      let nudged = null;
      let best = -1;
      bonusHeat.forEach((count, n) => {
        if (count > best || (count === best && (nudged == null || n < nudged))) {
          best = count;
          nudged = n;
        }
      });
      if (nudged != null && nudged !== finalPick.n) {
        finalPick = {
          n: nudged,
          hits: best,
          of: latest.length,
          kind: "p",
          text: `${game.bonusLabel} ${nudged} leads in the latest ${commas(recentLimit)} drawings that included ${seed}.`,
        };
      }
    }
  }

  const basis = withSeed.length
    ? `Read from ${commas(withSeed.length)} drawings that included ${seed}, out of ${commas(draws.length)} ${game.label} drawings.${recentCount != null ? ` One number follows the latest ${commas(recentLimit)} drawings, so another look can shift slightly.` : ""}`
    : `${seed} does not appear in the loaded ${game.label} history. Your number is still kept, and the five results use the overall patterns.`;

  return {
    gameId: game.id,
    seed,
    ordered: game.ordered,
    bonusMax: game.bonusMax,
    mainCount: game.mainCount,
    basis,
    candidates: unique,
    first,
    final: finalPick,
  };
}

function predictSetLabel(game) {
  if (game.bonusMax) return `${game.mainCount} numbers and 1 ${game.bonusLabel}`;
  if (game.ordered) return `${game.mainCount} digits in order`;
  return `${game.mainCount} numbers`;
}

function linesKey(lines) {
  return lines.map((line) => `${line.main.join("-")}:${line.bonus == null ? "" : line.bonus}`).join("|");
}

function draftComplete(game) {
  if (state.predictDraftMain.length !== game.mainCount) return false;
  if (game.bonusMax && state.predictDraftBonus == null) return false;
  return true;
}


function renderPredictResult(result) {
  const game = PREDICT_GAMES.find((g) => g.id === result.gameId) || predictGame();
  const head = game.mainCount === 5 ? "First five numbers" : "Predicted numbers";
  const rows = result.candidates.map((c, i) => {
    const balls = c.main.map((n, idx) => {
      let chosen = "";
      if (game.ordered) chosen = idx === result.final.pos && n === result.final.n ? "chosen" : "";
      else if (!game.bonusMax && n === result.final.n) chosen = "chosen";
      return ball(n, "w", "sm", chosen);
    }).join("");
    const bonus = c.bonus != null
      ? ball(c.bonus, "p", "sm", game.bonusMax && c.bonus === result.final.n ? "chosen" : "")
      : "";
    return `<div class="result-line">
      <span class="method">${i + 1}. ${esc(c.label)}</span>
      <span class="slots">${balls}${bonus}</span>
      <span class="muted">${esc(c.detail)}</span>
    </div>`;
  }).join("");
  const first = result.first.map((n, idx) => {
    let chosen = "";
    if (game.ordered) chosen = idx === result.final.pos && n === result.final.n ? "chosen" : "";
    else if (!game.bonusMax && n === result.final.n) chosen = "chosen";
    return ball(n, "w", "lg", chosen);
  }).join("");
  const width = result.final.of ? Math.max(8, Math.round((result.final.hits / result.final.of) * 100)) : 8;
  return `
    <h3>Five results from history</h3>
    <p class="muted">${esc(result.basis)}</p>
    ${rows}
    <h3>${head}</h3>
    <div class="slot-row spread">${first}</div>
    <div class="final-wrap">
      <div class="kicker">Final number</div>
      <div class="slot-row spread">${ball(result.final.n, result.final.kind, "lg", "final")}</div>
      <div class="conf" aria-hidden="true"><span style="width:${width}%"></span></div>
      <p>${esc(result.final.text)}</p>
    </div>
    <p class="note predict-note">These lines repeat patterns from past drawings. A past pattern does not change the chance of the next drawing.</p>
  `;
}

function renderSetBalls(line, size) {
  const whites = line.main.map((n) => ball(n, "w", size)).join("");
  const bonus = line.bonus != null ? ball(line.bonus, "p", size) : "";
  return whites + bonus;
}

function draftMainButtons(game) {
  const full = state.predictDraftMain.length >= game.mainCount;
  let html = "";
  for (let n = game.mainMin; n <= game.mainMax; n += 1) {
    const on = !game.ordered && state.predictDraftMain.includes(n);
    const locked = !game.ordered && full && !on;
    html += `<button type="button" class="num${on ? " on" : ""}" data-draft="w" data-n="${n}" aria-pressed="${on ? "true" : "false"}"${locked ? " disabled" : ""}>${n}</button>`;
  }
  return html;
}

function usedPredictBonuses() {
  const used = new Set();
  state.predictLines.forEach((line) => {
    if (line.bonus != null) used.add(line.bonus);
  });
  return used;
}

function draftBonusButtons(game) {
  const used = usedPredictBonuses();
  let html = "";
  for (let n = 1; n <= game.bonusMax; n += 1) {
    const on = state.predictDraftBonus === n;
    const taken = used.has(n);
    html += `<button type="button" class="num${on ? " on" : ""}" data-draft="p" data-n="${n}" aria-pressed="${on ? "true" : "false"}"${taken ? " disabled" : ""}>${n}</button>`;
  }
  return html;
}

function predictRowsHTML(game) {
  if (!state.predictLines.length) return `<p class="muted" id="predict-rows">Your sets will stack here, one under another.</p>`;
  const rows = state.predictLines.map((line, i) => `<div class="result-line">
      <span class="method">${line.patternSeed != null && state.patternMode === "multiple" ? `Anchor ${line.patternSeed}` : `Set ${i + 1}`}</span>
      <span class="slots">${renderSetBalls(line, "sm")}</span>
      ${line.patternDetail ? `<span class="muted">${esc(line.patternDetail)}</span>` : ""}
      <button type="button" class="load" data-predict-remove="${i}">Remove</button>
    </div>`).join("");
  return `<div id="predict-rows">${rows}</div>`;
}

function patternBuilderHTML(game) {
  if (game.ordered) return "";
  const numbers = Array.from({ length: game.mainMax - game.mainMin + 1 }, (_, i) => game.mainMin + i);
  const selected = new Set(state.patternSeeds);
  const seedButtons = numbers.map((n) => {
    const on = selected.has(n);
    const locked = state.patternSeeds.length >= 10 && !on;
    return `<button type="button" class="num${on ? " on" : ""}" data-pattern-seed="${n}" aria-pressed="${on}"${locked ? " disabled" : ""}>${n}</button>`;
  }).join("");
  const modeButtons = [
    ["single", "One anchor"],
    ["multiple", "Multiple anchors"],
  ].map(([mode, label]) => `<button type="button" data-pattern-mode="${mode}" class="${state.patternMode === mode ? "on" : ""}" aria-pressed="${state.patternMode === mode}">${label}</button>`).join("");
  const anchorControl = state.patternMode === "single"
    ? `<label>Anchor number
        <select id="pattern-seed">${numbers.map((n) => `<option value="${n}"${n === state.patternSeed ? " selected" : ""}>${n}</option>`).join("")}</select>
      </label>`
    : `<p class="help">Choose up to 10 different numbers. Each selected number gets one best line, chosen from the candidate count above.</p>
      <div class="num-grid pattern-seed-grid" id="pattern-seed-grid">${seedButtons}</div>`;
  const ready = state.patternMode === "single" || state.patternSeeds.length > 0;
  const status = state.patternGenerated
    ? state.patternMode === "single"
      ? `Generated ${state.predictLines.length} candidate sets for ${state.patternSeed} from ${commas(historyDraws(game).length)} drawings.`
      : `Selected the best of ${state.predictSetCount} candidate sets for each of ${state.patternSeeds.length} anchors.`
    : state.patternMode === "single"
      ? `The selected anchor will lead each of ${state.predictSetCount} candidate sets.`
      : `${state.patternSeeds.length} anchors selected. Select up to 10.`;
  return `<div class="pattern-builder">
    <h3>Build pattern-based sets</h3>
    <div class="seg pattern-mode" role="group" aria-label="Pattern mode">${modeButtons}</div>
    <p class="muted">Use the selected date range to rank number pairings and Powerballs. Historical patterns do not change the odds of a future draw.</p>
    <div class="pattern-controls">
      ${anchorControl}
      <label>${state.patternMode === "single" ? "Number of candidate sets" : "Candidates per anchor"}
        <select id="predict-set-count">${Array.from({ length: 6 }, (_, i) => i + 5).map((count) => `<option value="${count}"${count === state.predictSetCount ? " selected" : ""}>${count} sets</option>`).join("")}</select>
      </label>
    </div>
    <button type="button" class="more" data-action="pattern-generate"${ready ? "" : " disabled"}>${state.patternMode === "single" ? `Generate ${state.predictSetCount} candidate sets` : `Generate best set for ${state.patternSeeds.length} anchors`}</button>
    <p class="muted pattern-status" id="pattern-status" aria-live="polite">${status}</p>
  </div>`;
}

function pairKey(a, b) {
  return a < b ? `${a}:${b}` : `${b}:${a}`;
}

function generatePatternSets(game, count, seed) {
  const draws = historyDraws(game);
  if (!draws.length) return [];

  const frequency = new Map();
  const pairs = new Map();
  const bonusFrequency = new Map();
  draws.forEach((draw) => {
    draw.main.forEach((n) => frequency.set(n, (frequency.get(n) || 0) + 1));
    if (draw.bonus != null) bonusFrequency.set(draw.bonus, (bonusFrequency.get(draw.bonus) || 0) + 1);
    for (let i = 0; i < draw.main.length; i += 1) {
      for (let j = i + 1; j < draw.main.length; j += 1) {
        const key = pairKey(draw.main[i], draw.main[j]);
        pairs.set(key, (pairs.get(key) || 0) + 1);
      }
    }
  });

  const companions = [];
  for (let n = game.mainMin; n <= game.mainMax; n += 1) {
    if (n !== seed) companions.push(n);
  }
  companions.sort((a, b) => (
    (pairs.get(pairKey(seed, b)) || 0) - (pairs.get(pairKey(seed, a)) || 0)
    || (frequency.get(b) || 0) - (frequency.get(a) || 0)
    || a - b
  ));

  return Array.from({ length: count }, (_, index) => {
    const branch = companions[index % companions.length];
    const main = [seed];
    if (branch != null && main.length < game.mainCount) main.push(branch);

    while (main.length < game.mainCount) {
      let best = null;
      let bestPair = -1;
      let bestFrequency = -1;
      for (let n = game.mainMin; n <= game.mainMax; n += 1) {
        if (main.includes(n)) continue;
        const pairScore = pairs.get(pairKey(main[main.length - 1], n)) || 0;
        const seen = frequency.get(n) || 0;
        if (pairScore > bestPair || (pairScore === bestPair && seen > bestFrequency) || (pairScore === bestPair && seen === bestFrequency && (best == null || n < best))) {
          best = n;
          bestPair = pairScore;
          bestFrequency = seen;
        }
      }
      if (best == null) break;
      main.push(best);
    }

    let bonus = null;
    let bonusScore = 0;
    if (game.bonusMax) {
      const scores = new Map();
      draws.forEach((draw) => {
        if (draw.bonus == null) return;
        const overlap = draw.main.reduce((total, n) => total + (main.includes(n) ? 1 : 0), 0);
        if (overlap) scores.set(draw.bonus, (scores.get(draw.bonus) || 0) + overlap);
      });
      for (let n = 1; n <= game.bonusMax; n += 1) {
        const score = scores.get(n) || 0;
        if (bonus == null || score > bonusScore || (score === bonusScore && (bonusFrequency.get(n) || 0) > (bonusFrequency.get(bonus) || 0)) || (score === bonusScore && (bonusFrequency.get(n) || 0) === (bonusFrequency.get(bonus) || 0) && n < bonus)) {
          bonus = n;
          bonusScore = score;
        }
      }
    }

    let pairTotal = 0;
    let frequencyTotal = 0;
    for (let i = 0; i < main.length; i += 1) {
      frequencyTotal += frequency.get(main[i]) || 0;
      for (let j = i + 1; j < main.length; j += 1) {
        pairTotal += pairs.get(pairKey(main[i], main[j])) || 0;
      }
    }
    const orderedMain = main.slice().sort((a, b) => a - b);
    const bonusDetail = game.bonusMax
      ? ` · ${game.bonusLabel} ${bonus} on ${commas(bonusScore)} matched-number hits`
      : "";
    const patternDetail = `${seed} → ${branch}${bonusDetail}`;
    return {
      main: orderedMain,
      bonus,
      patternSeed: seed,
      patternScore: { pairTotal, frequencyTotal },
      patternDetail,
    };
  });
}

function generateBestPatternSets(game, seeds, candidateCount) {
  return seeds.map((seed) => {
    const candidates = generatePatternSets(game, candidateCount, seed);
    candidates.sort((a, b) => (
      b.patternScore.pairTotal - a.patternScore.pairTotal
      || b.patternScore.frequencyTotal - a.patternScore.frequencyTotal
      || (a.bonus || 0) - (b.bonus || 0)
    ));
    const best = candidates[0];
    return best ? {
      ...best,
      patternDetail: `Best of ${candidateCount} for ${seed} · ${best.patternDetail}`,
    } : null;
  }).filter(Boolean);
}

function predictLineTarget() {
  return state.patternMode === "multiple" ? state.patternSeeds.length : state.predictSetCount;
}

function predictFromSets(game, lines) {
  const draws = historyDraws(game);
  const drawSets = draws.map((d) => new Set(d.main));
  let main;
  let bonus = null;
  let detail;

  if (game.ordered) {
    const freq = Array.from({ length: game.mainCount }, () => Array(10).fill(0));
    const latestFreq = Array.from({ length: game.mainCount }, () => Array(10).fill(0));
    draws.forEach((d, i) => d.main.forEach((digit, pos) => {
      freq[pos][digit] += 1;
      if (i < latestWindowSize()) latestFreq[pos][digit] += 1;
    }));
    main = [];
    const notes = [];
    for (let i = 0; i < game.mainCount; i += 1) {
      const votes = new Map();
      lines.forEach((line) => votes.set(line.main[i], (votes.get(line.main[i]) || 0) + 1));
      const ranked = [...votes.keys()].sort((a, b) => (votes.get(b) - votes.get(a)) || (latestFreq[i][b] - latestFreq[i][a]) || (freq[i][b] - freq[i][a]) || a - b);
      const digit = ranked[0];
      main.push(digit);
      notes.push(`${ORDINALS[i]} digit ${digit} is in ${votes.get(digit)} of your ${lines.length} sets and in ${commas(freq[i][digit])} drawings`);
    }
    detail = `${notes.join(". ")}.`;
  } else {
    const votes = new Map();
    lines.forEach((line) => line.main.forEach((n) => votes.set(n, (votes.get(n) || 0) + 1)));
    const freq = new Map();
    const latestFreq = new Map();
    const latestBonus = new Map();
    const latestCut = latestWindowSize();
    draws.forEach((d, i) => {
      d.main.forEach((n) => {
        freq.set(n, (freq.get(n) || 0) + 1);
        if (i < latestCut) latestFreq.set(n, (latestFreq.get(n) || 0) + 1);
      });
      if (i < latestCut && d.bonus != null) latestBonus.set(d.bonus, (latestBonus.get(d.bonus) || 0) + 1);
    });
    const pool = [...votes.keys()];
    const chosen = [];
    while (chosen.length < game.mainCount && chosen.length < pool.length) {
      let best = null;
      let bestVotes = -1;
      let bestTogether = -1;
      let bestRecent = -1;
      let bestFreq = -1;
      pool.forEach((n) => {
        if (chosen.includes(n)) return;
        const vote = votes.get(n) || 0;
        const seen = freq.get(n) || 0;
        const recent = latestFreq.get(n) || 0;
        let together = 0;
        if (chosen.length) {
          drawSets.forEach((set) => {
            if (!set.has(n)) return;
            for (let c = 0; c < chosen.length; c += 1) {
              if (!set.has(chosen[c])) return;
            }
            together += 1;
          });
        }
        if (
          best == null
          || vote > bestVotes
          || (vote === bestVotes && together > bestTogether)
          || (vote === bestVotes && together === bestTogether && recent > bestRecent)
          || (vote === bestVotes && together === bestTogether && recent === bestRecent && seen > bestFreq)
          || (vote === bestVotes && together === bestTogether && recent === bestRecent && seen === bestFreq && n < best)
        ) {
          best = n;
          bestVotes = vote;
          bestTogether = together;
          bestRecent = recent;
          bestFreq = seen;
        }
      });
      chosen.push(best);
    }
    if (chosen.length < game.mainCount) {
      const rest = [];
      for (let n = game.mainMin; n <= game.mainMax; n += 1) {
        if (!chosen.includes(n)) rest.push(n);
      }
      rest.sort((a, b) => (freq.get(b) || 0) - (freq.get(a) || 0) || a - b);
      while (chosen.length < game.mainCount && rest.length) chosen.push(rest.shift());
    }
    main = chosen.slice().sort((a, b) => a - b);
    const notes = main.map((n) => `${n} is in ${votes.get(n) || 0} of your ${lines.length} sets and in ${commas(freq.get(n) || 0)} drawings`);
    if (game.bonusMax) {
      const bVotes = new Map();
      lines.forEach((line) => {
        if (line.bonus != null) bVotes.set(line.bonus, (bVotes.get(line.bonus) || 0) + 1);
      });
      const bFreq = new Map();
      const withMain = new Map();
      const want = new Set(main);
      draws.forEach((d) => {
        if (d.bonus == null) return;
        bFreq.set(d.bonus, (bFreq.get(d.bonus) || 0) + 1);
        let overlap = 0;
        d.main.forEach((n) => { if (want.has(n)) overlap += 1; });
        if (overlap) withMain.set(d.bonus, (withMain.get(d.bonus) || 0) + overlap);
      });
      const bonuses = [...bVotes.keys()].sort((a, b) => (
        (bVotes.get(b) - bVotes.get(a))
        || ((latestBonus.get(b) || 0) - (latestBonus.get(a) || 0))
        || ((withMain.get(b) || 0) - (withMain.get(a) || 0))
        || ((bFreq.get(b) || 0) - (bFreq.get(a) || 0))
        || a - b
      ));
      bonus = bonuses[0];
      notes.push(`${game.bonusLabel} ${bonus} is in ${bVotes.get(bonus)} of your ${lines.length} sets and in ${commas(bFreq.get(bonus) || 0)} drawings`);
    }
    detail = `${notes.join(". ")}. A tie follows the latest ${commas(latestCut)} drawings, so running this again can shift a close number.`;
  }

  return {
    gameId: game.id,
    linesKey: linesKey(lines),
    setCount: lines.length,
    main,
    bonus,
    detail,
  };
}

const historyBySeed = Object.create(null);

function historyForSeed(game, seed) {
  const recentCount = latestWindowSize();
  const key = `${game.id}:${seed}:${recentCount}:${state.historyDays}`;
  if (!historyBySeed[key]) historyBySeed[key] = predictFromHistory(game, seed, recentCount, historyDraws(game));
  return historyBySeed[key];
}

function numberProbabilityHTML(game) {
  const n = state.predictFocus;
  if (n == null) return "";
  const noun = game.ordered ? "Digit" : "Number";
  return `
    <section class="card">
      <div class="step-head">
        ${ball(n, "w", "sm")}
        <h2>${noun} ${n}</h2>
      </div>
      ${renderPredictResult(historyForSeed(game, n))}
    </section>
  `;
}

function renderSetResult(result) {
  const game = PREDICT_GAMES.find((g) => g.id === result.gameId) || predictGame();
  const whites = result.main.map((n) => ball(n, "w", "lg")).join("");
  const bonus = result.bonus != null ? ball(result.bonus, "p", "lg", "final") : "";
  return `
    <h3>Most probable result</h3>
    <p class="muted">One complete ${esc(game.label)} line, read from your ${result.setCount} sets and the drawing history.</p>
    <div class="final-wrap">
      <div class="kicker">Complete result</div>
      <div class="slot-row spread">${whites}${bonus}</div>
      <p>${esc(result.detail)}</p>
    </div>
    <p class="note predict-note">These numbers are the ones your sets repeat, with past drawings used to break a tie. A past pattern does not change the chance of the next drawing.</p>
  `;
}

function renderPredictor() {
  const game = predictGame();
  const draws = historyDraws(game);
  const span = draws.length
    ? `${commas(draws.length)} drawings from ${shortDate(draws[draws.length - 1].date)} to ${shortDate(draws[0].date)}.`
    : "Draw history for this game did not load.";
  const target = predictLineTarget();
  const building = state.patternMode === "single" && state.predictLines.length < target;
  const showSaved = state.predictResult
    && state.predictResult.gameId === game.id
    && state.predictResult.linesKey === linesKey(state.predictLines);
  const picker = state.patternMode === "multiple"
    ? `<p class="muted">Generate one best line per selected anchor, then predict from those winning lines.</p>`
    : building ? `
      <h3>Set ${state.predictLines.length + 1} of ${state.predictSetCount}</h3>
      <p class="help">Select ${game.mainCount} ${game.ordered ? "digits" : "numbers"} from ${game.mainMin} to ${game.mainMax}${game.ordered ? ". Order matters, and a digit can repeat." : ""}${game.bonusMax ? `, then 1 ${esc(game.bonusLabel)}.` : (game.ordered ? "" : ".")}</p>
      <div class="num-grid${game.ordered ? " digits" : ""}" id="predict-grid">${draftMainButtons(game)}</div>
      ${game.bonusMax ? `<h3>${esc(game.bonusLabel)}</h3><p class="help">Select 1 ${esc(game.bonusLabel)} from 1 to ${game.bonusMax}. A ${esc(game.bonusLabel)} already used in a set stays unavailable.</p><div class="num-grid" id="predict-bonus">${draftBonusButtons(game)}</div>` : ""}
      <div class="slot-row spread" id="predict-draft"></div>
      <p class="hint" id="predict-hint"></p>
      <div class="check-wrap">
        <button type="button" class="check" id="predict-add" data-action="predict-add" disabled>Add set ${state.predictLines.length + 1} →</button>
      </div>` : state.predictLines.length === target
        ? `<p class="muted">All ${state.predictSetCount} sets are in. Remove a set to replace it.</p>`
        : `<p class="muted">You have ${state.predictLines.length} sets. Remove ${state.predictLines.length - state.predictSetCount} to match the selected set count.</p>`;
  return `
    <section class="card">
      <div class="step-head">
        <span class="step-no">1</span>
        <h2>Final Number Predictor</h2>
        <span class="count" id="predict-count">${state.predictLines.length} of ${target}</span>
      </div>
      <p class="lead">${state.patternMode === "multiple"
        ? `Choose up to 10 anchors. The strongest candidate line for each becomes an input to the final prediction.`
        : `Enter ${state.predictSetCount} sets. Each set is ${esc(predictSetLabel(game))}. The sets stack one under another. One complete result is then chosen from those sets and the drawing history.`}</p>
      <div class="game-field">
        <label id="predict-game-label" for="predict-game">Lottery</label>
        ${gameMenuHTML("predict-game", game)}
      </div>
      ${historyWindowHTML()}
      ${patternBuilderHTML(game)}
      <p class="muted">${esc(game.blurb)} ${esc(span)}</p>
      ${picker}
      <h3>Your sets</h3>
      ${predictRowsHTML(game)}
      <div class="check-wrap">
        <button type="button" class="check" id="predict-btn" data-action="predict"${target > 0 && state.predictLines.length === target ? "" : " disabled"}>${state.patternMode === "multiple" ? "Predict from winning anchor lines →" : "Predict most probable result →"}</button>
      </div>
    </section>
    <section class="card" id="predict-out"${showSaved ? "" : " hidden"}>${showSaved ? renderSetResult(state.predictResult) : ""}</section>
    <div id="predict-probs"></div>
  `;
}

function syncPredict() {
  const game = predictGame();
  const full = state.predictDraftMain.length >= game.mainCount;
  document.querySelectorAll("[data-draft='w']").forEach((btn) => {
    const n = +btn.dataset.n;
    const on = !game.ordered && state.predictDraftMain.includes(n);
    btn.classList.toggle("on", on);
    btn.setAttribute("aria-pressed", on ? "true" : "false");
    btn.disabled = !game.ordered && full && !on;
  });
  const usedBonus = usedPredictBonuses();
  document.querySelectorAll("[data-draft='p']").forEach((btn) => {
    const n = +btn.dataset.n;
    const on = state.predictDraftBonus === n;
    btn.classList.toggle("on", on);
    btn.setAttribute("aria-pressed", on ? "true" : "false");
    btn.disabled = usedBonus.has(n);
  });
  const draft = document.getElementById("predict-draft");
  if (draft) {
    const shown = game.ordered ? state.predictDraftMain : state.predictDraftMain.slice().sort((a, b) => a - b);
    const balls = game.ordered
      ? state.predictDraftMain.map((n, i) => `<button type="button" class="num on" data-draft-remove="${i}">${n} ×</button>`).join("")
      : shown.map((n) => ball(n, "w", "sm")).join("");
    const bonus = state.predictDraftBonus != null ? ball(state.predictDraftBonus, "p", "sm") : "";
    draft.innerHTML = balls || bonus ? `${balls}${bonus}` : "";
  }
  const hint = document.getElementById("predict-hint");
  if (hint) {
    const needMain = game.mainCount - state.predictDraftMain.length;
    if (needMain > 0) {
      hint.textContent = `Select ${needMain} more ${game.ordered ? "digit" : "number"}${needMain === 1 ? "" : "s"}.`;
    } else if (game.bonusMax && state.predictDraftBonus == null) {
      hint.textContent = `Select 1 ${game.bonusLabel}.`;
    } else {
      hint.textContent = `Set ${state.predictLines.length + 1} is ready to add.`;
    }
  }
  const add = document.getElementById("predict-add");
  if (add) {
    const ready = draftComplete(game);
    add.disabled = !ready;
    add.classList.toggle("ready", ready);
  }
  const count = document.getElementById("predict-count");
  if (count) count.textContent = `${state.predictLines.length} of ${predictLineTarget()}`;
  const btn = document.getElementById("predict-btn");
  if (btn) {
    const ready = predictLineTarget() > 0 && state.predictLines.length === predictLineTarget();
    btn.disabled = !ready;
    btn.classList.toggle("ready", ready);
  }
  const probs = document.getElementById("predict-probs");
  if (probs) probs.innerHTML = numberProbabilityHTML(game);
}

function toggleDraftMain(n) {
  const game = predictGame();
  if (state.predictLines.length >= state.predictSetCount) return;
  if (game.ordered) {
    if (state.predictDraftMain.length >= game.mainCount) return;
    state.predictDraftMain.push(n);
    state.predictFocus = n;
    bumpPredictShift();
  } else {
    const at = state.predictDraftMain.indexOf(n);
    if (at >= 0) {
      state.predictDraftMain.splice(at, 1);
      if (state.predictFocus === n) {
        state.predictFocus = state.predictDraftMain.length
          ? state.predictDraftMain[state.predictDraftMain.length - 1]
          : null;
      }
    } else if (state.predictDraftMain.length < game.mainCount) {
      state.predictDraftMain.push(n);
      state.predictFocus = n;
      bumpPredictShift();
    }
  }
  syncPredict();
}

function selectDraftBonus(n) {
  if (state.predictLines.length >= state.predictSetCount) return;
  if (usedPredictBonuses().has(n)) return;
  state.predictDraftBonus = state.predictDraftBonus === n ? null : n;
  syncPredict();
}

function removeDraftDigit(index) {
  if (index < 0 || index >= state.predictDraftMain.length) return;
  const removed = state.predictDraftMain[index];
  state.predictDraftMain.splice(index, 1);
  if (state.predictFocus === removed && !state.predictDraftMain.includes(removed)) {
    state.predictFocus = state.predictDraftMain.length
      ? state.predictDraftMain[state.predictDraftMain.length - 1]
      : null;
  }
  syncPredict();
}

function addPredictSet() {
  const game = predictGame();
  if (state.predictLines.length >= state.predictSetCount || !draftComplete(game)) return;
  const main = game.ordered ? state.predictDraftMain.slice() : state.predictDraftMain.slice().sort((a, b) => a - b);
  state.predictLines.push({ main, bonus: game.bonusMax ? state.predictDraftBonus : null });
  state.patternGenerated = false;
  state.predictDraftMain = [];
  state.predictDraftBonus = null;
  state.predictResult = null;
  renderView("predictor");
}

function removePredictLine(index) {
  if (index < 0 || index >= state.predictLines.length) return;
  state.predictLines.splice(index, 1);
  state.patternGenerated = false;
  state.predictResult = null;
  renderView("predictor");
}

function onPredict() {
  if (!predictLineTarget() || state.predictLines.length !== predictLineTarget()) return;
  const game = predictGame();
  bumpPredictShift();
  state.predictResult = predictFromSets(game, state.predictLines);
  const out = document.getElementById("predict-out");
  if (out) {
    out.hidden = false;
    out.innerHTML = renderSetResult(state.predictResult);
  }
  const btn = document.getElementById("predict-btn");
  if (btn) {
    btn.classList.remove("pulse");
    void btn.offsetWidth;
    btn.classList.add("pulse");
  }
}

function renderAnalysis() {
  const { arr, n } = windowCounts();
  let min = Infinity;
  let max = -Infinity;
  for (let i = 1; i <= 69; i += 1) {
    if (arr[i] < min) min = arr[i];
    if (arr[i] > max) max = arr[i];
  }
  const expected = state.window === "all" ? EXPECT_WHITE : (n * 5) / 69;
  let cells = "";
  for (let i = 1; i <= 69; i += 1) {
    const t = max === min ? 0.5 : (arr[i] - min) / (max - min);
    const mine = state.whites.has(i) ? " mine" : "";
    cells += `<button type="button" class="heat-cell${mine}" data-open-buddy="${i}" style="${heatStyle(t)}" title="${i} drawn ${arr[i]} times">${i}</button>`;
  }
  const hot = ranked(arr, 69, 8).map((num) => `<div class="rank">${ball(num, "w", "sm")}<span class="meta">${arr[num]} times</span></div>`).join("");
  const coldNums = ranked(arr.map((v, idx) => (idx === 0 ? 0 : max - v)), 69, 8);
  const cold = coldNums.map((num) => `<div class="rank">${ball(num, "w", "sm")}<span class="meta">${arr[num]} times</span></div>`).join("");
  const seg = (key, label) => `<button type="button" data-window="${key}" class="${state.window === key ? "on" : ""}">${label}</button>`;
  return pageCard(
    "Number Analysis",
    `How often each white-ball number has been drawn. In a fair drawing, each number is expected about ${expected.toFixed(1)} times in this window of ${commas(n)} drawings. Darker green means drawn more often. A gold ring marks a number in your line.`,
    `${selectionReport()}
    <div class="seg" role="group" aria-label="Draw window">${seg("all", "All drawings")}${seg("100", "Last 100")}${seg("30", "Last 30")}</div>
    <div class="heat">${cells}</div>
    <div class="legend"><span class="swatch"></span> Fewer draws <span style="margin-left:auto">More draws</span></div>
    <div class="split cols-2">
      <div><h3>Drawn most</h3>${hot}</div>
      <div><h3>Drawn least</h3>${cold}</div>
    </div>`
  );
}

function topCompanions(n, k) {
  const list = [];
  for (let m = 1; m <= 69; m += 1) {
    if (m !== n) list.push({ n: m, c: pairCount(n, m) });
  }
  list.sort((a, b) => b.c - a.c || a.n - b.n);
  return list.slice(0, k);
}

function renderBuddies() {
  let grid = "";
  for (let n = 1; n <= 69; n += 1) {
    grid += `<button type="button" data-buddy="${n}" class="${n === state.buddy ? "on" : ""}" aria-pressed="${n === state.buddy}">${n}</button>`;
  }
  const comps = topCompanions(state.buddy, 10);
  const maxC = comps[0] ? comps[0].c : 1;
  const bars = comps.map((c) => `
    <div class="rank">
      ${ball(c.n, "w", "sm")}
      <div class="bar"><span style="width:${Math.max(4, (c.c / maxC) * 100)}%"></span></div>
      <span class="meta">${c.c}</span>
    </div>`).join("");
  let inside = "";
  const ws = selectedWhites();
  if (ws.length >= 2) {
    const pairs = [];
    for (let i = 0; i < ws.length; i += 1) {
      for (let j = i + 1; j < ws.length; j += 1) {
        pairs.push({ a: ws[i], b: ws[j], c: pairCount(ws[i], ws[j]) });
      }
    }
    pairs.sort((a, b) => b.c - a.c);
    inside = `<h3>Pairs inside your line</h3>${pairs.map((p) => `
      <div class="pair">${ball(p.a, "w", "sm")}${ball(p.b, "w", "sm")}<span class="meta">${p.c} drawings</span></div>
    `).join("")}`;
  }
  return pageCard(
    "Number Buddies",
    `Numbers that have shared a drawing. A typical pair appears together about ${PAIR_MEAN.toFixed(1)} times since ${shortDate(OLDEST.date)}. Pick a number to see its usual companions.`,
    `${lineBanner()}
    <div class="buddy-grid">${grid}</div>
    <h3>${state.buddy} has been drawn ${commas(whiteCount[state.buddy])} times</h3>
    <p class="muted">Companions, most shared drawings first.</p>
    ${bars}
    ${inside}`
  );
}

function drawMatchesQuery(d, q) {
  const s = q.trim().toLowerCase();
  if (!s) return true;
  if (d.date.includes(s)) return true;
  if (shortDate(d.date).toLowerCase().includes(s)) return true;
  if (longDate(d.date).toLowerCase().includes(s)) return true;
  const n = Number(s);
  if (Number.isInteger(n) && (d.w.includes(n) || d.pb === n)) return true;
  return false;
}

function renderHistory() {
  return pageCard(
    "Draw History",
    `Every Powerball drawing in the current matrix, newest first. ${commas(DRAWS.length)} drawings from ${shortDate(OLDEST.date)} to ${shortDate(LATEST.date)}.`,
    `${lineBanner()}
    <input class="search" id="hist-q" type="search" placeholder="Search by date or number" value="${esc(state.historyQuery)}" aria-label="Search drawings">
    <div id="history-list"></div>
    <p class="muted" id="history-meta"></p>
    <button type="button" class="more" id="history-more" data-more="history">Show more drawings</button>`
  );
}

function fillHistory() {
  const list = document.getElementById("history-list");
  if (!list) return;
  const filtered = DRAWS.filter((d) => drawMatchesQuery(d, state.historyQuery));
  const shown = filtered.slice(0, state.historyShown);
  const complete = state.whites.size === 5 && state.pb;
  list.innerHTML = shown.length ? shown.map((d) => {
    let badge = "";
    if (complete) {
      let match = 0;
      d.w.forEach((n) => { if (state.whites.has(n)) match += 1; });
      const pbHit = d.pb === state.pb;
      if (match >= 2 || pbHit) badge = `<div><span class="badge">${matchLabel(match, pbHit)}</span></div>`;
    }
    const balls = d.w.map((n) => ball(n, "w", "sm", state.whites.has(n) ? "hit" : "")).join("")
      + ball(d.pb, "p", "sm", state.pb === d.pb ? "hit" : "");
    return `<article class="draw">
      <div>
        <div>${longDate(d.date)}</div>
        ${d.mult ? `<div class="muted">Power Play ${d.mult}×</div>` : ""}
        ${badge}
      </div>
      <div class="slots">${balls}</div>
      <button type="button" class="load" data-load="${d.date}">Use this line</button>
    </article>`;
  }).join("") : `<p>No drawings match that search.</p>`;
  const meta = document.getElementById("history-meta");
  meta.textContent = filtered.length
    ? `Showing ${commas(shown.length)} of ${commas(filtered.length)} drawings`
    : "";
  const more = document.getElementById("history-more");
  more.hidden = shown.length >= filtered.length;
}

function renderPowerball() {
  const max = Math.max(...pbCount.slice(1));
  let rows = "";
  for (let n = 1; n <= 26; n += 1) {
    const mine = state.pb === n ? " mine" : "";
    rows += `<div class="pb-row${mine}">${ball(n, "p", "sm")}<div class="bar blue"><span style="width:${(pbCount[n] / max) * 100}%"></span></div><span class="meta">${pbCount[n]}</span></div>`;
  }
  const overdue = ranked(lastPb, 26, 5).map((n) => {
    const typical = DRAWS.length / pbCount[n];
    return `<div class="rank">${ball(n, "p", "sm")}<span>${agoLabel(lastPb[n])}</span><span class="meta">usual gap ${typical.toFixed(0)}</span></div>`;
  }).join("");
  const recent = DRAWS.slice(0, 18).map((d) => `<span title="${longDate(d.date)}">${ball(d.pb, "p", "sm")}</span>`).join("");
  return pageCard(
    "Powerball Trends",
    `The Powerball is drawn from 1 to 26. Each number is expected about ${EXPECT_PB.toFixed(1)} times across these ${commas(DRAWS.length)} drawings.`,
    `${selectionReport()}
    <h3>All-time counts</h3>
    ${rows}
    <h3>Longest current waits</h3>
    ${overdue}
    <h3>Recent Powerballs</h3>
    <p class="muted">Newest first.</p>
    <div class="slots">${recent}</div>`
  );
}

function renderHot() {
  const columns = [
    { title: "Last 30 drawings", arr: recentWhite[30], expect: (Math.min(30, DRAWS.length) * 5) / 69 },
    { title: "Last 100 drawings", arr: recentWhite[100], expect: (Math.min(100, DRAWS.length) * 5) / 69 },
    { title: "All drawings", arr: whiteCount, expect: EXPECT_WHITE },
  ].map((col) => {
    const list = ranked(col.arr, 69, 10).map((n) => {
      const mine = state.whites.has(n) ? " mine" : "";
      return `<div class="rank${mine}">${ball(n, "w", "sm")}<span class="meta">${col.arr[n]} times</span></div>`;
    }).join("");
    return `<div><h3>${col.title}</h3><p class="muted">Expected about ${col.expect.toFixed(1)} times.</p>${list}</div>`;
  }).join("");
  return pageCard(
    "Hot Numbers",
    "Numbers drawn more often than others in each window. A hot run in past drawings does not carry into the next one.",
    `${selectionReport()}<div class="split">${columns}</div>`
  );
}

function renderOverdue() {
  const list = ranked(lastWhite, 69, 15).map((n) => {
    const typical = DRAWS.length / whiteCount[n];
    const mine = state.whites.has(n) ? " mine" : "";
    const ratio = lastWhite[n] / typical;
    return `<div class="rank${mine}">
      ${ball(n, "w", "sm")}
      <div><div>${agoLabel(lastWhite[n])}</div><div class="muted">Last ${shortDate(DRAWS[lastWhite[n]].date)} · usual gap ${typical.toFixed(0)} · ${ratio.toFixed(1)}×</div></div>
    </div>`;
  }).join("");
  const pbList = ranked(lastPb, 26, 8).map((n) => {
    const typical = DRAWS.length / pbCount[n];
    const mine = state.pb === n ? " mine" : "";
    return `<div class="rank${mine}">${ball(n, "p", "sm")}<span>${agoLabel(lastPb[n])}</span><span class="meta">usual ${typical.toFixed(0)}</span></div>`;
  }).join("");
  return pageCard(
    "Overdue Numbers",
    "Numbers with the longest current wait. A long gap does not make the next drawing more likely to include that number. Every remaining number has the same chance on the next draw.",
    `${selectionReport()}
    <div class="split cols-2">
      <div><h3>White balls</h3>${list}</div>
      <div><h3>Powerball</h3>${pbList}</div>
    </div>`
  );
}

function pageCard(title, lead, body) {
  return `<section class="card"><div class="step-head"><h2>${title}</h2></div><p class="lead">${lead}</p>${body}</section>`;
}

function renderView(id) {
  const root = document.getElementById(`view-${id}`);
  if (!root) return;
  if (id === "analysis") root.innerHTML = renderAnalysis();
  else if (id === "buddies") root.innerHTML = renderBuddies();
  else if (id === "history") {
    root.innerHTML = renderHistory();
    const input = document.getElementById("hist-q");
    if (input) input.value = state.historyQuery;
    fillHistory();
  } else if (id === "predictor") {
    root.innerHTML = renderPredictor();
    syncPredict();
  } else if (id === "powerball") root.innerHTML = renderPowerball();
  else if (id === "hot") root.innerHTML = renderHot();
  else if (id === "overdue") root.innerHTML = renderOverdue();
}

let viewLock = false;

function setView(id, opts) {
  const options = opts || {};
  if (!VIEW_TITLE[id]) id = "checker";
  if (viewLock) return;
  viewLock = true;
  try {
    state.view = id;
    document.querySelectorAll(".view").forEach((v) => {
      v.hidden = v.dataset.view !== id;
    });
    document.querySelectorAll(".side-link").forEach((b) => {
      const on = b.dataset.view === id;
      b.classList.toggle("active", on);
      if (on) b.setAttribute("aria-current", "page");
      else b.removeAttribute("aria-current");
    });
    renderCrumb();
    refreshLatest();
    if (id !== "checker") renderView(id);
    const want = id === "checker" ? "" : `#${id}`;
    if (options.push !== false && location.hash !== want) {
      history.pushState(null, "", want || `${location.pathname}${location.search}`);
    }
    if (options.scroll !== false) window.scrollTo({ top: 0, behavior: "smooth" });
  } finally {
    viewLock = false;
  }
}

function setCheckGame(id) {
  state.checkGame = PREDICT_GAMES.some((g) => g.id === id) ? id : "powerball";
  state.whites = new Set();
  state.digits = [];
  state.pb = null;
  state.checked = false;
  const root = document.getElementById("view-checker");
  if (root) root.innerHTML = renderChecker();
  updateUI();
  renderCrumb();
  refreshLatest();
}

function loadDraw(date) {
  const d = DRAWS.find((x) => x.date === date);
  if (!d) return;
  state.checkGame = "powerball";
  state.whites = new Set(d.w);
  state.digits = [];
  state.pb = d.pb;
  const root = document.getElementById("view-checker");
  if (root) root.innerHTML = renderChecker();
  updateUI();
  setView("checker", { scroll: false });
  onCheck();
}

function onGameMenuKey(e) {
  const menu = e.target.closest("[data-game-menu]");
  if (e.key === "Escape") {
    if (!menu) return;
    const btn = menu.querySelector(".game-select");
    closeGameMenus();
    if (btn) btn.focus();
    return;
  }
  if (!menu || (e.key !== "ArrowDown" && e.key !== "ArrowUp" && e.key !== "Home" && e.key !== "End")) return;
  const list = menu.querySelector(".game-list");
  const btn = menu.querySelector(".game-select");
  if (!list || list.hidden) {
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      toggleGameMenu(menu.dataset.gameMenu, true);
    }
    return;
  }
  const items = [...list.querySelectorAll("[role='option']")];
  if (!items.length) return;
  const i = items.indexOf(document.activeElement);
  let next = i;
  if (e.key === "ArrowDown") next = i < 0 ? 0 : Math.min(items.length - 1, i + 1);
  else if (e.key === "ArrowUp") next = i < 0 ? items.length - 1 : Math.max(0, i - 1);
  else if (e.key === "Home") next = 0;
  else next = items.length - 1;
  e.preventDefault();
  items[next].focus();
  if (btn) btn.setAttribute("aria-expanded", "true");
}

function onGameMenuFocusOut(e) {
  const menu = e.target.closest("[data-game-menu]");
  if (!menu) return;
  requestAnimationFrame(() => {
    if (!menu.isConnected || menu.contains(document.activeElement)) return;
    closeGameMenus();
  });
}

function onClick(e) {
  if (!e.target.closest("[data-game-menu]")) closeGameMenus();
  const t = e.target.closest("[data-game-toggle], [data-game-pick], [data-action], button[data-view], [data-pick], [data-strategy], [data-remove], [data-predict-remove], [data-draft-remove], [data-draft], [data-swap], [data-window], [data-history-days], [data-pattern-mode], [data-pattern-seed], [data-buddy], [data-open-buddy], [data-load], [data-more]");
  if (!t) return;
  if (t.dataset.gameToggle) {
    e.preventDefault();
    toggleGameMenu(t.dataset.gameToggle, e.detail === 0);
    return;
  }
  if (t.dataset.gamePick) {
    e.preventDefault();
    chooseGame(t.dataset.gamePick, t.dataset.gameId);
    return;
  }
  if (t.dataset.historyDays) {
    const days = t.dataset.historyDays;
    if (days === state.historyDays) return;
    state.historyDays = days;
    if (state.view === "checker") {
      const wasChecked = state.checked;
      const root = document.getElementById("view-checker");
      if (root) root.innerHTML = renderChecker();
      updateUI();
      if (wasChecked) onCheck(true);
    } else if (state.view === "predictor") {
      const hadResult = Boolean(state.predictResult);
      if (state.patternGenerated) {
        state.predictLines = state.patternMode === "single"
          ? generatePatternSets(predictGame(), state.predictSetCount, state.patternSeed)
          : generateBestPatternSets(predictGame(), state.patternSeeds, state.predictSetCount);
      }
      state.predictResult = hadResult && state.predictLines.length === predictLineTarget()
        ? predictFromSets(predictGame(), state.predictLines)
        : null;
      renderView("predictor");
    }
    return;
  }
  if (t.dataset.patternMode) {
    if (state.patternMode === t.dataset.patternMode) return;
    state.patternMode = t.dataset.patternMode;
    state.predictLines = [];
    state.patternGenerated = false;
    state.predictResult = null;
    state.predictDraftMain = [];
    state.predictDraftBonus = null;
    renderView("predictor");
    return;
  }
  if (t.dataset.patternSeed != null) {
    const seed = Number(t.dataset.patternSeed);
    const index = state.patternSeeds.indexOf(seed);
    if (index >= 0) state.patternSeeds.splice(index, 1);
    else if (state.patternSeeds.length < 10) state.patternSeeds.push(seed);
    if (state.patternGenerated) {
      state.patternGenerated = false;
      state.predictLines = [];
      state.predictResult = null;
    }
    renderView("predictor");
    return;
  }
  if (t.dataset.action === "check") return onCheck();
  if (t.dataset.action === "pattern-generate") {
    if (state.patternMode === "multiple" && !state.patternSeeds.length) return;
    state.predictLines = state.patternMode === "single"
      ? generatePatternSets(predictGame(), state.predictSetCount, state.patternSeed)
      : generateBestPatternSets(predictGame(), state.patternSeeds, state.predictSetCount);
    if (!state.predictLines.length) {
      const status = document.getElementById("pattern-status");
      if (status) status.textContent = "No drawings are available in this date range.";
      return;
    }
    state.patternGenerated = true;
    state.predictDraftMain = [];
    state.predictDraftBonus = null;
    state.predictResult = null;
    renderView("predictor");
    return;
  }
  if (t.dataset.action === "predict-add") return addPredictSet();
  if (t.dataset.action === "predict") return onPredict();
  if (t.dataset.action === "reset") return resetLine();
  if (t.dataset.strategy) return applyStrategy(t.dataset.strategy);
  if (t.dataset.pick === "w") return toggleWhite(+t.dataset.n);
  if (t.dataset.pick === "d") return toggleDigit(+t.dataset.n);
  if (t.dataset.pick === "p") return togglePb(+t.dataset.n);
  if (t.dataset.remove) return removePick(t.dataset.remove, +t.dataset.n);
  if (t.dataset.swap) return swapNumber(+t.dataset.swap);
  if (t.dataset.window) {
    state.window = t.dataset.window;
    renderView("analysis");
    return;
  }
  if (t.dataset.buddy) {
    state.buddy = +t.dataset.buddy;
    renderView("buddies");
    return;
  }
  if (t.dataset.openBuddy) {
    state.buddy = +t.dataset.openBuddy;
    setView("buddies");
    return;
  }
  if (t.dataset.load) return loadDraw(t.dataset.load);
  if (t.dataset.more === "history") {
    state.historyShown += 40;
    fillHistory();
    return;
  }
  if (t.dataset.draftRemove != null && t.dataset.draftRemove !== "") return removeDraftDigit(+t.dataset.draftRemove);
  if (t.dataset.draft === "w") return toggleDraftMain(+t.dataset.n);
  if (t.dataset.draft === "p") return selectDraftBonus(+t.dataset.n);
  if (t.dataset.predictRemove != null && t.dataset.predictRemove !== "") return removePredictLine(+t.dataset.predictRemove);
  if (t.dataset.view) setView(t.dataset.view);
}

function onInput(e) {
  if (e.target.id !== "hist-q") return;
  state.historyQuery = e.target.value;
  state.historyShown = 40;
  fillHistory();
}

function onChange(e) {
  if (e.target.id === "pattern-seed") {
    state.patternSeed = Number(e.target.value);
    if (state.patternGenerated && state.patternMode === "single") {
      state.predictLines = generatePatternSets(predictGame(), state.predictSetCount, state.patternSeed);
      state.predictResult = null;
    }
    renderView("predictor");
    return;
  }
  if (e.target.id === "predict-set-count") {
    state.predictSetCount = Number(e.target.value);
    state.predictResult = null;
    if (state.patternGenerated) {
      state.predictLines = state.patternMode === "single"
        ? generatePatternSets(predictGame(), state.predictSetCount, state.patternSeed)
        : generateBestPatternSets(predictGame(), state.patternSeeds, state.predictSetCount);
    }
    renderView("predictor");
  }
}

const jackpotCheck = analyzeLine([11, 13, 14, 21, 65], 19);
if (jackpotCheck.counts.j < 1 || ODDS !== 292201338) {
  console.error("Powerball self-check failed", jackpotCheck.counts.j, ODDS);
}

build();
const start = location.hash.replace("#", "");
setView(VIEW_TITLE[start] ? start : "checker", { push: false, scroll: false });
document.body.addEventListener("click", onClick);
document.body.addEventListener("input", onInput);
document.body.addEventListener("change", onChange);
document.body.addEventListener("keydown", onGameMenuKey);
document.body.addEventListener("focusout", onGameMenuFocusOut);
window.addEventListener("hashchange", () => {
  const id = location.hash.replace("#", "");
  setView(VIEW_TITLE[id] ? id : "checker", { push: false });
});
window.addEventListener("popstate", () => {
  const id = location.hash.replace("#", "");
  setView(VIEW_TITLE[id] ? id : "checker", { push: false });
});
