"use strict";

/* =========================================================
   みつけてゲーム！  game.js
   - 外部ライブラリなし（HTML/CSS/JSのみ）
   - 効果音は Web Audio API でその場で生成（音声ファイル不要）
   - 1画面の中から お題のものを探す。
     はずれの物体（デコイ）を画面いっぱいに密集させて紛れさせる。
   ========================================================= */

/* ---------- さがしものの絵文字（名前つき） ---------- */
const ITEMS = [
  { e: "🍎", n: "りんご" }, { e: "🍌", n: "バナナ" }, { e: "🍓", n: "いちご" },
  { e: "🍇", n: "ぶどう" }, { e: "🍉", n: "すいか" }, { e: "🍊", n: "みかん" },
  { e: "🍒", n: "さくらんぼ" }, { e: "🍑", n: "もも" }, { e: "🍍", n: "パイナップル" },
  { e: "🥝", n: "キウイ" }, { e: "🍆", n: "なす" }, { e: "🥕", n: "にんじん" },
  { e: "🌽", n: "とうもろこし" }, { e: "🍄", n: "きのこ" }, { e: "🌻", n: "ひまわり" },
  { e: "🌸", n: "さくら" }, { e: "🌷", n: "チューリップ" }, { e: "🐶", n: "いぬ" },
  { e: "🐱", n: "ねこ" }, { e: "🐰", n: "うさぎ" }, { e: "🐻", n: "くま" },
  { e: "🐼", n: "パンダ" }, { e: "🐸", n: "かえる" }, { e: "🐵", n: "さる" },
  { e: "🦊", n: "きつね" }, { e: "🐷", n: "ぶた" }, { e: "🐧", n: "ペンギン" },
  { e: "🐔", n: "にわとり" }, { e: "🦉", n: "ふくろう" }, { e: "🐢", n: "かめ" },
  { e: "🐠", n: "さかな" }, { e: "🐙", n: "たこ" }, { e: "🦀", n: "かに" },
  { e: "🦋", n: "ちょうちょ" }, { e: "🐝", n: "はち" }, { e: "🐞", n: "てんとうむし" },
  { e: "⭐", n: "ほし" }, { e: "🌙", n: "つき" }, { e: "☀️", n: "たいよう" },
  { e: "⚽", n: "サッカーボール" }, { e: "🏀", n: "バスケットボール" }, { e: "🎈", n: "ふうせん" },
  { e: "🎁", n: "プレゼント" }, { e: "🎀", n: "リボン" }, { e: "🚗", n: "くるま" },
  { e: "🚀", n: "ロケット" }, { e: "✈️", n: "ひこうき" }, { e: "🚲", n: "じてんしゃ" },
  { e: "⏰", n: "とけい" }, { e: "🔑", n: "かぎ" }, { e: "💎", n: "ダイヤ" },
  { e: "👑", n: "おうかん" }, { e: "🍩", n: "ドーナツ" }, { e: "🍪", n: "クッキー" },
  { e: "🍰", n: "ケーキ" }, { e: "🍦", n: "ソフトクリーム" }, { e: "🍭", n: "あめ" },
  { e: "🍫", n: "チョコ" }, { e: "🧁", n: "カップケーキ" }, { e: "🍕", n: "ピザ" }
];

/* ---------- 難易度設定 ----------
   total   = 画面に置く物体の総数（デコイ＋ターゲット）
   targets = 探すものの数
   size    = 絵文字の大きさ(vmin)
   jitter  = 配置のばらつき（大きいほど重なって紛れる）
   ----------------------------------------------------- */
const DIFFICULTY = {
  easy:   { time: 60,  targets: 4, total: 55,  size: 5.6, jitter: 0.50, rotate: 6,  opacity: 1.0 },
  normal: { time: 85,  targets: 6, total: 120, size: 3.9, jitter: 0.70, rotate: 16, opacity: 0.95 },
  hard:   { time: 120, targets: 8, total: 230, size: 2.8, jitter: 1.00, rotate: 30, opacity: 0.85 }
};

/* ---------- ゲーム状態 ---------- */
const state = {
  diff: "easy",
  score: 0,
  combo: 0,
  timeLeft: 0,
  timerId: null,
  targets: [],
  foundTotal: 0,
  targetTotal: 0,
  running: false
};

/* ---------- DOM ---------- */
const $ = (id) => document.getElementById(id);
const field = $("field");
const hud = $("hud");
const promptBar = $("prompt-bar");
const startScreen = $("start-screen");
const resultScreen = $("result-screen");

/* =========================================================
   サウンド（Web Audio API）
   ========================================================= */
let audioCtx = null;
function getCtx() {
  if (!audioCtx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (AC) audioCtx = new AC();
  }
  return audioCtx;
}
function beep(freq, dur, type = "sine", vol = 0.2, delay = 0) {
  const ctx = getCtx();
  if (!ctx) return;
  const t0 = ctx.currentTime + delay;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t0);
  gain.gain.setValueAtTime(0, t0);
  gain.gain.linearRampToValueAtTime(vol, t0 + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  osc.connect(gain).connect(ctx.destination);
  osc.start(t0);
  osc.stop(t0 + dur + 0.02);
}
const sound = {
  correct() { beep(880, 0.12, "triangle", 0.25); beep(1320, 0.16, "triangle", 0.22, 0.08); },
  wrong()   { beep(160, 0.22, "sawtooth", 0.18); },
  clear()   { [523, 659, 784, 1046].forEach((f, i) => beep(f, 0.25, "triangle", 0.25, i * 0.13)); },
  over()    { [392, 330, 262].forEach((f, i) => beep(f, 0.3, "sine", 0.22, i * 0.18)); },
  tick()    { beep(700, 0.05, "square", 0.12); }
};

/* =========================================================
   ユーティリティ
   ========================================================= */
function shuffle(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
const rand = (min, max) => min + Math.random() * (max - min);
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

/* =========================================================
   ボード生成
   ========================================================= */
function buildBoard() {
  const cfg = DIFFICULTY[state.diff];
  field.innerHTML = "";

  // ターゲットを選ぶ（重複しない絵文字）
  const pool = shuffle(ITEMS);
  const targets = pool.slice(0, cfg.targets);
  const decoyPool = pool.slice(cfg.targets);

  // デコイ（はずれ）を total になるまで並べる。
  // 種類を超える分は同じ絵文字をくり返して、よりごちゃごちゃに紛れさせる。
  const decoyCount = Math.max(0, cfg.total - cfg.targets);
  const decoyBag = shuffle(decoyPool);
  const decoys = [];
  for (let i = 0; i < decoyCount; i++) decoys.push(decoyBag[i % decoyBag.length]);

  // 配置セルを用意（画面を格子に分割し、ばらつきで重ねる）
  const n = cfg.total;
  const aspect = field.clientWidth / Math.max(field.clientHeight, 1);
  const cols = Math.max(1, Math.round(Math.sqrt(n * aspect)));
  const rows = Math.max(1, Math.ceil(n / cols));
  const cells = [];
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) cells.push({ r, c });
  const order = shuffle(cells);
  const cw = 100 / cols, ch = 100 / rows;

  let idx = 0;
  const placeAt = (it, isTarget) => {
    const cell = order[idx % order.length];
    idx++;
    let left = cw * (cell.c + 0.5) + (Math.random() - 0.5) * cw * cfg.jitter * 2;
    let top = ch * (cell.r + 0.5) + (Math.random() - 0.5) * ch * cfg.jitter * 2;
    left = clamp(left, 5, 95);
    top = clamp(top, 6, 94);

    const el = document.createElement("div");
    el.className = "obj";
    el.textContent = it.e;
    el.style.left = left + "%";
    el.style.top = top + "%";
    el.style.fontSize = (cfg.size + rand(-0.25, 0.25)) + "vmin";
    const rot = cfg.rotate ? rand(-cfg.rotate, cfg.rotate) : 0;
    el.style.setProperty("--rot", rot + "deg");
    if (cfg.opacity < 1) el.style.opacity = rand(cfg.opacity, 1).toFixed(2);
    el.dataset.emoji = it.e;
    el.dataset.target = isTarget ? "1" : "0";
    el.addEventListener("pointerdown", onObjectClick);
    field.appendChild(el);
  };

  // 先にデコイを配置 → あとからターゲット（ターゲットが上に来て、
  // 密集しても完全に隠れず必ず見つけられる＝フェア）
  shuffle(decoys).forEach((it) => placeAt(it, false));
  shuffle(targets).forEach((it) => placeAt(it, true));

  state.targets = targets.map((it) => ({ ...it, found: false }));
  state.targetTotal = targets.length;
  state.foundTotal = 0;
  renderRemaining();
}

/* =========================================================
   クリック処理
   ========================================================= */
function onObjectClick(ev) {
  if (!state.running) return;
  const el = ev.currentTarget;
  const emoji = el.dataset.emoji;
  const target = state.targets.find((t) => !t.found && t.e === emoji);

  if (target) {
    target.found = true;
    state.foundTotal++;
    state.combo++;
    const gained = 100 + (state.combo - 1) * 20;
    state.score += gained;

    el.classList.add("correct");
    showScorePop(el, "+" + gained);
    sound.correct();
    updateHud();
    renderRemaining();

    if (state.foundTotal >= state.targetTotal) endGame(true);
  } else {
    // 不正解（ペナルティ：時間-3秒）
    state.combo = 0;
    state.timeLeft = Math.max(0, state.timeLeft - 3);
    el.classList.remove("wrong");
    void el.offsetWidth;
    el.classList.add("wrong");
    setTimeout(() => el.classList.remove("wrong"), 400);
    field.classList.add("flash-bad");
    setTimeout(() => field.classList.remove("flash-bad"), 400);
    sound.wrong();
    updateHud();
    if (state.timeLeft <= 0) endGame(false);
  }
}

function showScorePop(el, text) {
  const pop = document.createElement("div");
  pop.className = "score-pop";
  pop.textContent = text;
  pop.style.left = el.style.left;
  pop.style.top = el.style.top;
  field.appendChild(pop);
  setTimeout(() => pop.remove(), 900);
}

/* =========================================================
   お題・残りリスト表示
   ========================================================= */
function renderRemaining() {
  const list = $("remaining-list");
  list.innerHTML = "";
  const current = state.targets.find((t) => !t.found);
  if (current) {
    $("prompt-emoji").textContent = current.e;
    $("prompt-name").textContent = current.n;
  }
  state.targets.forEach((t) => {
    const li = document.createElement("li");
    li.textContent = t.e;
    li.title = t.n;
    if (t.found) li.classList.add("found");
    else if (current && t.e === current.e) li.classList.add("current");
    list.appendChild(li);
  });
}

/* =========================================================
   HUD・タイマー
   ========================================================= */
function updateHud() {
  $("score").textContent = state.score;
  $("time").textContent = state.timeLeft;
  $("found-count").textContent = state.foundTotal + " / " + state.targetTotal;
  $("time").classList.toggle("warning", state.timeLeft <= 10);
}
function startTimer() {
  clearInterval(state.timerId);
  state.timerId = setInterval(() => {
    if (!state.running) return;
    state.timeLeft--;
    if (state.timeLeft <= 5 && state.timeLeft > 0) sound.tick();
    updateHud();
    if (state.timeLeft <= 0) endGame(false);
  }, 1000);
}

/* =========================================================
   開始・終了
   ========================================================= */
function startGame() {
  getCtx();
  const cfg = DIFFICULTY[state.diff];
  state.score = 0;
  state.combo = 0;
  state.timeLeft = cfg.time;
  state.running = true;

  startScreen.classList.add("hidden");
  resultScreen.classList.add("hidden");
  hud.classList.remove("hidden");
  promptBar.classList.remove("hidden");
  field.classList.remove("hidden");

  buildBoard();
  updateHud();
  startTimer();
}

function endGame(cleared) {
  state.running = false;
  clearInterval(state.timerId);

  let bonus = 0;
  if (cleared) {
    bonus = state.timeLeft * 10;
    state.score += bonus;
    sound.clear();
  } else {
    sound.over();
  }

  setTimeout(() => {
    hud.classList.add("hidden");
    promptBar.classList.add("hidden");
    field.classList.add("hidden");
    resultScreen.classList.remove("hidden");

    $("result-title").textContent = cleared ? "🎉 ぜんぶ みつけた！" : "⏰ タイムアップ！";
    $("result-score").textContent = state.score;
    $("result-found").textContent = state.foundTotal + " / " + state.targetTotal;

    let msg;
    if (cleared) msg = "クリア！ じかんボーナス +" + bonus + " てん 🌟";
    else if (state.foundTotal === 0) msg = "つぎは みつけられるよ！ がんばって 💪";
    else if (state.foundTotal >= state.targetTotal / 2) msg = "おしい！ あと " + (state.targetTotal - state.foundTotal) + "こ だったね 🔥";
    else msg = "もういちど チャレンジ！ 🍀";
    $("result-message").textContent = msg;
  }, cleared ? 600 : 300);
}

/* =========================================================
   画面遷移・ボタン
   ========================================================= */
function goHome() {
  state.running = false;
  clearInterval(state.timerId);
  hud.classList.add("hidden");
  promptBar.classList.add("hidden");
  field.classList.add("hidden");
  resultScreen.classList.add("hidden");
  startScreen.classList.remove("hidden");
}

document.querySelectorAll(".diff-btn").forEach((btn) => {
  btn.addEventListener("click", () => {
    state.diff = btn.dataset.diff;
    document.querySelectorAll(".diff-btn").forEach((b) => b.classList.remove("selected"));
    btn.classList.add("selected");
  });
});
$("start-btn").addEventListener("click", startGame);
$("retry-btn").addEventListener("click", startGame);
$("home-btn").addEventListener("click", goHome);
$("quit-btn").addEventListener("click", () => {
  if (confirm("ゲームを やめて タイトルに もどる？")) goHome();
});

/*
  ※ オブジェクトは「% 座標 + vmin サイズ」で配置しているため、
    画面サイズが変わっても自動で追従します（PC・スマホ対応）。
*/
