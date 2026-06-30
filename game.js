"use strict";

/* =========================================================
   みつけてゲーム！  game.js
   - 外部ライブラリなし（HTML/CSS/JSのみ）
   - 効果音は Web Audio API でその場で生成（音声ファイル不要）
   - 表(おもて)ステージ 1〜10。クリアで次が解放。
   - 表を全クリアすると「裏(うら)ステージ 1〜10」が解放。
     裏は すべての物体が 動きまわる。
   - 進み具合は端末に保存。
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

/* ---------- 設定 ---------- */
const STAGE_COUNT = 10;
const HINT_AFTER = 40;
const SAVE_KEY = "mitsukete_progress_v2";

/* 表ステージの難易度（進むほど難しく） */
function frontConfig(stage) {
  const t = (stage - 1) / (STAGE_COUNT - 1);
  const targets = Math.round(4 + t * 8);        // 4 〜 12
  const total   = Math.round(30 + t * 240);     // 30 〜 270
  const size    = +(6.2 - t * 3.6).toFixed(2);  // 6.2 〜 2.6
  const jitter  = +(0.30 + t * 0.70).toFixed(2);// 0.30 〜 1.00
  const rotate  = Math.round(t * 34);
  const opacity = +(1 - t * 0.18).toFixed(2);
  const time    = Math.round(30 + targets * 6 + total * 0.05);
  return { targets, total, size, jitter, rotate, opacity, time, moving: false, speed: 0 };
}

/* 裏ステージ：数は少なめだが すべて動く */
function backConfig(stage) {
  const t = (stage - 1) / (STAGE_COUNT - 1);
  const targets = Math.round(4 + t * 8);          // 4 〜 12
  const total   = Math.round(22 + t * 98);        // 22 〜 120
  const size    = +(6.0 - t * 3.2).toFixed(2);    // 6.0 〜 2.8
  const jitter  = +(0.25 + t * 0.55).toFixed(2);
  const rotate  = Math.round(t * 30);
  const opacity = +(1 - t * 0.15).toFixed(2);
  const speed   = +(0.06 + t * 0.30).toFixed(3);  // 1フレームあたりの移動量(%)
  const time    = Math.round(45 + targets * 7 + total * 0.06); // 動くぶん 多め
  return { targets, total, size, jitter, rotate, opacity, time, moving: true, speed };
}

function getConfig(world, stage) {
  return world === "back" ? backConfig(stage) : frontConfig(stage);
}

/* ---------- ゲーム状態 ---------- */
const state = {
  world: "front",        // 今あそんでいる世界
  selectWorld: "front",  // 選択画面で表示中のタブ
  stage: 1,
  score: 0,
  combo: 0,
  timeLeft: 0,
  timerId: null,
  targets: [],
  foundTotal: 0,
  targetTotal: 0,
  hintSec: 0,
  hintActive: false,
  running: false,
  moving: false,
  movers: [],
  progress: {
    front: { unlocked: 1, cleared: [] },
    back:  { unlocked: 1, cleared: [] },
    backOpen: false
  }
};
const wp = (world) => state.progress[world];

/* ---------- 保存・読み込み ---------- */
function loadProgress() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return;
    const p = JSON.parse(raw);
    const norm = (o) => ({
      unlocked: Math.min(STAGE_COUNT, Math.max(1, (o && o.unlocked) || 1)),
      cleared: o && Array.isArray(o.cleared) ? o.cleared.filter((n) => n >= 1 && n <= STAGE_COUNT) : []
    });
    if (p.front || p.back) {
      state.progress.front = norm(p.front);
      state.progress.back = norm(p.back);
      state.progress.backOpen = !!p.backOpen || state.progress.front.cleared.includes(STAGE_COUNT);
    } else {
      state.progress.front = norm(p);
      state.progress.backOpen = state.progress.front.cleared.includes(STAGE_COUNT);
    }
  } catch (_) {}
}
function saveProgress() {
  try { localStorage.setItem(SAVE_KEY, JSON.stringify(state.progress)); } catch (_) {}
}

/* ---------- DOM ---------- */
const $ = (id) => document.getElementById(id);
const field = $("field");
const hud = $("hud");
const promptBar = $("prompt-bar");
const startScreen = $("start-screen");
const stageSelectScreen = $("stage-select-screen");
const stageClearScreen = $("stage-clear-screen");
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
  win()     { [523, 659, 784, 1046, 1318, 1568].forEach((f, i) => beep(f, 0.3, "triangle", 0.26, i * 0.14)); },
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
   ステージ選択画面（表/裏タブつき）
   ========================================================= */
function updateTabs() {
  const open = state.progress.backOpen;
  const tabFront = $("tab-front");
  const tabBack = $("tab-back");
  tabBack.disabled = !open;
  tabBack.textContent = open ? "うら ✨" : "うら 🔒";
  tabBack.classList.toggle("back-open", open);
  tabFront.classList.toggle("selected", state.selectWorld === "front");
  tabBack.classList.toggle("selected", state.selectWorld === "back");
}

function renderStageSelect() {
  updateTabs();
  const world = state.selectWorld;
  const p = wp(world);
  const grid = $("stage-grid");
  grid.innerHTML = "";
  for (let s = 1; s <= STAGE_COUNT; s++) {
    const btn = document.createElement("button");
    btn.className = "stage-cell";
    const unlocked = s <= p.unlocked;
    const cleared = p.cleared.includes(s);
    if (!unlocked) {
      btn.classList.add("locked");
      btn.disabled = true;
      btn.textContent = "🔒";
    } else {
      if (world === "back") btn.classList.add("back");
      btn.innerHTML = '<span class="cell-num">' + s + "</span>" +
        (cleared ? '<span class="cell-star">⭐</span>' : "");
      if (cleared) btn.classList.add("cleared");
      btn.addEventListener("click", () => {
        getCtx();
        state.world = world;
        state.stage = s;
        startStage();
      });
    }
    grid.appendChild(btn);
  }
}

function goToSelect() {
  stopPlay();
  startScreen.classList.add("hidden");
  stageClearScreen.classList.add("hidden");
  resultScreen.classList.add("hidden");
  stageSelectScreen.classList.remove("hidden");
  renderStageSelect();
}

/* =========================================================
   うごき（裏ステージ）
   ========================================================= */
let rafId = null;
let lastTs = 0;
function startMotion() {
  cancelAnimationFrame(rafId);
  lastTs = 0;
  const step = (ts) => {
    if (!state.running || !state.moving) return;
    if (!lastTs) lastTs = ts;
    let dt = (ts - lastTs) / 16.67;
    lastTs = ts;
    if (dt > 3) dt = 3;            // タブ復帰などの大きな飛びを抑える
    for (const m of state.movers) {
      m.x += m.vx * dt;
      m.y += m.vy * dt;
      if (m.x < 4) { m.x = 4; m.vx = Math.abs(m.vx); }
      else if (m.x > 96) { m.x = 96; m.vx = -Math.abs(m.vx); }
      if (m.y < 5) { m.y = 5; m.vy = Math.abs(m.vy); }
      else if (m.y > 95) { m.y = 95; m.vy = -Math.abs(m.vy); }
      m.el.style.left = m.x + "%";
      m.el.style.top = m.y + "%";
    }
    rafId = requestAnimationFrame(step);
  };
  rafId = requestAnimationFrame(step);
}
function stopMotion() {
  cancelAnimationFrame(rafId);
  state.moving = false;
  state.movers = [];
}

/* =========================================================
   ボード生成
   ========================================================= */
function buildBoard() {
  const cfg = getConfig(state.world, state.stage);
  field.innerHTML = "";
  state.movers = [];

  const pool = shuffle(ITEMS);
  const targets = pool.slice(0, cfg.targets);
  const decoyPool = pool.slice(cfg.targets);

  const decoyCount = Math.max(0, cfg.total - cfg.targets);
  const decoyBag = shuffle(decoyPool);
  const decoys = [];
  for (let i = 0; i < decoyCount; i++) decoys.push(decoyBag[i % decoyBag.length]);

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

    if (cfg.moving) {
      const ang = rand(0, Math.PI * 2);
      const v = rand(0.5, 1) * cfg.speed;
      state.movers.push({ el, x: left, y: top, vx: Math.cos(ang) * v, vy: Math.sin(ang) * v });
    }
  };

  shuffle(decoys).forEach((it) => placeAt(it, false));
  shuffle(targets).forEach((it) => placeAt(it, true));

  state.targets = targets.map((it) => ({ ...it, found: false }));
  state.targetTotal = targets.length;
  state.foundTotal = 0;
  renderRemaining();

  state.moving = cfg.moving;
  if (cfg.moving) startMotion();
}

function setStageBackground(stage, world) {
  for (let i = 1; i <= STAGE_COUNT; i++) field.classList.remove("stage-bg-" + i);
  field.classList.add("stage-bg-" + stage);
  field.classList.toggle("ura", world === "back");
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

    // 見つけたものは うごきを止める
    state.movers = state.movers.filter((m) => m.el !== el);

    el.classList.add("correct");
    showScorePop(el, "+" + gained);
    sound.correct();
    state.hintSec = 0;
    clearHint();
    updateHud();
    renderRemaining();

    if (state.foundTotal >= state.targetTotal) stageComplete();
  } else {
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
    if (state.timeLeft <= 0) gameOver();
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
   お題・残りリスト
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
   ヒント（40秒みつからないと さがしものが光る）
   ========================================================= */
function activateHint() {
  const cur = state.targets.find((t) => !t.found);
  if (!cur) return;
  const els = Array.from(field.querySelectorAll('.obj[data-target="1"]'))
    .filter((el) => el.dataset.emoji === cur.e && !el.classList.contains("correct"));
  if (!els.length) return;
  els.forEach((el) => el.classList.add("hint-glow"));
  $("hint-msg").classList.remove("hidden");
  state.hintActive = true;
}
function clearHint() {
  field.querySelectorAll(".obj.hint-glow").forEach((el) => el.classList.remove("hint-glow"));
  $("hint-msg").classList.add("hidden");
  state.hintActive = false;
}

/* =========================================================
   HUD・タイマー
   ========================================================= */
function updateHud() {
  const tag = state.world === "back" ? "裏 " : "";
  $("stage").textContent = tag + state.stage + " / " + STAGE_COUNT;
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
    state.hintSec++;
    if (!state.hintActive && state.hintSec >= HINT_AFTER) activateHint();
    if (state.timeLeft <= 5 && state.timeLeft > 0) sound.tick();
    updateHud();
    if (state.timeLeft <= 0) gameOver();
  }, 1000);
}

/* =========================================================
   画面の出し入れ
   ========================================================= */
function showPlayUI() {
  startScreen.classList.add("hidden");
  stageSelectScreen.classList.add("hidden");
  stageClearScreen.classList.add("hidden");
  resultScreen.classList.add("hidden");
  hud.classList.remove("hidden");
  promptBar.classList.remove("hidden");
  field.classList.remove("hidden");
}
function hidePlayUI() {
  hud.classList.add("hidden");
  promptBar.classList.add("hidden");
  field.classList.add("hidden");
}
/* プレイを完全に止める（タイマー・うごき） */
function stopPlay() {
  state.running = false;
  clearInterval(state.timerId);
  stopMotion();
  hidePlayUI();
}

/* =========================================================
   ステージ進行
   ========================================================= */
function startStage() {
  state.score = 0;
  state.combo = 0;
  state.timeLeft = getConfig(state.world, state.stage).time;
  state.hintSec = 0;
  state.hintActive = false;
  state.running = true;

  showPlayUI();
  clearHint();
  setStageBackground(state.stage, state.world);
  buildBoard();
  updateHud();
  startTimer();
}

function stageComplete() {
  state.running = false;
  clearInterval(state.timerId);
  stopMotion();

  const bonus = state.timeLeft * 10;
  state.score += bonus;

  const p = wp(state.world);
  if (!p.cleared.includes(state.stage)) p.cleared.push(state.stage);
  if (state.stage < STAGE_COUNT) p.unlocked = Math.max(p.unlocked, state.stage + 1);
  // 表を全クリア → 裏を解放
  if (state.world === "front" && state.stage === STAGE_COUNT) state.progress.backOpen = true;
  saveProgress();

  if (state.stage >= STAGE_COUNT) { gameWin(); return; }

  sound.clear();
  setTimeout(() => {
    hidePlayUI();
    stageClearScreen.classList.remove("hidden");
    const tag = state.world === "back" ? "裏ステージ " : "ステージ ";
    $("stage-clear-title").textContent = "🎊 " + tag + state.stage + " クリア！";
    $("stage-clear-score").textContent = state.score;
    $("stage-clear-bonus").textContent = "+" + bonus;
    $("stage-clear-message").textContent =
      tag + (state.stage + 1) + " が あそべるように なったよ！";
  }, 500);
}

function continueStage() {
  if (state.stage < STAGE_COUNT) {
    state.stage++;
    startStage();
  } else {
    goToSelect();
  }
}

function replayStage() {
  startStage();
}

function gameWin() {
  sound.win();
  setTimeout(() => {
    hidePlayUI();
    resultScreen.classList.remove("hidden");
    if (state.world === "front") {
      $("result-title").textContent = "🏆 おもて ぜんぶ クリア！";
      $("result-message").textContent = "うらステージ が かいほうされた！ えらぶ画面で あそべるよ 👻";
    } else {
      $("result-title").textContent = "👑 うらも ぜんぶ クリア！";
      $("result-message").textContent = "かんぺき せいは！ ほんとうに すごい！ 🎉🎉";
    }
    $("result-score").textContent = state.score;
    $("result-stat2-label").textContent = "クリア";
    $("result-stat2").textContent = STAGE_COUNT + " / " + STAGE_COUNT;
  }, 600);
}

function gameOver() {
  state.running = false;
  clearInterval(state.timerId);
  stopMotion();
  sound.over();
  setTimeout(() => {
    hidePlayUI();
    resultScreen.classList.remove("hidden");
    $("result-title").textContent = "⏰ タイムアップ！";
    $("result-score").textContent = state.score;
    $("result-stat2-label").textContent = "ステージ";
    const tag = state.world === "back" ? "裏 " : "";
    $("result-stat2").textContent = tag + state.stage + " / " + STAGE_COUNT;
    $("result-message").textContent = "このステージを もういちど チャレンジ！ 🍀";
  }, 300);
}

/* =========================================================
   ボタン
   ========================================================= */
function goHome() {
  stopPlay();
  stageSelectScreen.classList.add("hidden");
  stageClearScreen.classList.add("hidden");
  resultScreen.classList.add("hidden");
  startScreen.classList.remove("hidden");
}

$("start-btn").addEventListener("click", () => { getCtx(); goToSelect(); });
$("select-back-btn").addEventListener("click", goHome);
$("tab-front").addEventListener("click", () => { state.selectWorld = "front"; renderStageSelect(); });
$("tab-back").addEventListener("click", () => {
  if (!state.progress.backOpen) return;
  state.selectWorld = "back";
  renderStageSelect();
});
$("next-stage-btn").addEventListener("click", continueStage);
$("stage-clear-select-btn").addEventListener("click", goToSelect);
$("retry-btn").addEventListener("click", replayStage);
$("home-btn").addEventListener("click", goToSelect);
$("quit-btn").addEventListener("click", () => {
  if (confirm("ゲームを やめて ステージせんたくに もどる？")) goToSelect();
});

/* ---------- 起動時 ---------- */
loadProgress();

/*
  ※ オブジェクトは「% 座標 + vmin サイズ」で配置しているため、
    画面サイズが変わっても自動で追従します（PC・スマホ対応）。
*/
