// 게임 2 (v3): 도형 친구 — 두더지잡기. 정답 모양만 빠르게 콕!
// (분류 = 본질[모양]만 보고 우연[색·크기] 무시. 시간 압박으로 액션화)
import { setStarsIfBetter } from "../shared/score.js";
import { playGood, playBad, playFanfare, playPop } from "../shared/audio.js";
import { burstConfetti } from "../shared/celebrate.js";

const SHAPE_KINDS = ["circle", "square", "triangle", "star"];
const COLORS = ["#ff8a4c", "#6cb6ff", "#ff9ec7", "#88e0a0", "#b58cff", "#ffd166"];
const ROUNDS = 3;
const HITS_NEEDED = 6;

function shapeSvg(kind, color, size = 60) {
  const c = color, s = size;
  switch (kind) {
    case "circle":   return `<svg viewBox="0 0 100 100" width="${s}" height="${s}"><circle cx="50" cy="50" r="42" fill="${c}"/></svg>`;
    case "square":   return `<svg viewBox="0 0 100 100" width="${s}" height="${s}"><rect x="12" y="12" width="76" height="76" rx="10" fill="${c}"/></svg>`;
    case "triangle": return `<svg viewBox="0 0 100 100" width="${s}" height="${s}"><polygon points="50,10 92,88 8,88" fill="${c}"/></svg>`;
    case "star":     return `<svg viewBox="0 0 100 100" width="${s}" height="${s}"><polygon points="50,8 61,38 94,40 67,60 78,92 50,72 22,92 33,60 6,40 39,38" fill="${c}"/></svg>`;
  }
}

export function mountGame(container, { gameId, onStarsChange, backToMenu }) {
  let round = 0;
  let mistakes = 0;
  let alive = true;
  let target = null;
  let hits = 0;
  let spawnTimer = null;
  let activeShapes = [];

  const wrap = document.createElement("div");
  wrap.style.cssText = "width:100%;display:flex;flex-direction:column;align-items:center;gap:12px";
  wrap.innerHTML = `
    <div class="msg" id="msg">이 모양만 콕!</div>
    <div id="target-display" style="display:flex;align-items:center;gap:10px;font-size:18px;color:var(--ink-soft)">
      <span>이거:</span><div id="target-shape"></div><span id="hits-counter">0 / ${HITS_NEEDED}</span>
    </div>
    <div id="play-area" style="position:relative;width:100%;max-width:420px;height:400px;background:#fff7e6;border-radius:18px;box-shadow:var(--shadow);overflow:hidden;touch-action:manipulation"></div>
    <div class="msg" id="msg2"></div>
  `;
  container.appendChild(wrap);

  const playArea = wrap.querySelector("#play-area");
  const targetShape = wrap.querySelector("#target-shape");
  const hitsCounter = wrap.querySelector("#hits-counter");
  const msgEl = wrap.querySelector("#msg");
  const msg2El = wrap.querySelector("#msg2");

  function startRound() {
    if (round >= ROUNDS) { finish(); return; }
    round += 1;
    target = SHAPE_KINDS[Math.floor(Math.random() * SHAPE_KINDS.length)];
    targetShape.innerHTML = shapeSvg(target, "#3a2f1e", 40);
    msgEl.textContent = `${round} / ${ROUNDS} — 이 모양만 ${HITS_NEEDED}개!`;
    msgEl.className = "msg";
    msg2El.textContent = "";
    msg2El.className = "msg";
    hits = 0;
    hitsCounter.textContent = `0 / ${HITS_NEEDED}`;
    clearShapes();
    scheduleSpawn();
  }

  function clearShapes() {
    if (spawnTimer) { clearTimeout(spawnTimer); spawnTimer = null; }
    activeShapes.forEach((s) => s.el.remove());
    activeShapes = [];
  }

  function scheduleSpawn() {
    if (!alive) return;
    spawnShape();
    // 라운드 진행할수록 더 빠르게
    const delay = 700 - round * 100 + Math.random() * 400;
    spawnTimer = setTimeout(scheduleSpawn, delay);
  }

  function spawnShape() {
    if (!alive) return;
    const isTarget = Math.random() < 0.5;
    const kind = isTarget ? target : pickOther(target);
    const color = COLORS[Math.floor(Math.random() * COLORS.length)];
    const size = 50 + Math.floor(Math.random() * 25);
    const areaRect = playArea.getBoundingClientRect();
    const W = areaRect.width || 400;
    const H = areaRect.height || 400;
    const x = Math.random() * (W - size - 10) + 5;
    const y = Math.random() * (H - size - 10) + 5;

    const el = document.createElement("div");
    el.style.cssText = `position:absolute;left:${x}px;top:${y}px;width:${size}px;height:${size}px;cursor:pointer;transform:scale(0);transition:transform 0.15s ease-out;user-select:none;touch-action:manipulation`;
    el.innerHTML = shapeSvg(kind, color, size);
    const item = { el, isTarget };

    el.addEventListener("pointerdown", (e) => {
      e.stopPropagation();
      if (!item.alive) return;
      item.alive = false;
      if (isTarget) {
        playPop(); playGood();
        hits += 1;
        hitsCounter.textContent = `${hits} / ${HITS_NEEDED}`;
        el.style.transform = "scale(1.4)";
        el.style.opacity = "0";
        setTimeout(() => el.remove(), 200);
        if (hits >= HITS_NEEDED) {
          msg2El.textContent = "잘했어! 🎉";
          msg2El.className = "msg good";
          playFanfare();
          burstConfetti(40);
          clearShapes();
          setTimeout(startRound, 900);
        }
      } else {
        playBad();
        mistakes += 1;
        el.style.transform = "scale(0.8)";
        el.style.background = "rgba(255,80,80,0.3)";
        el.style.borderRadius = "50%";
        setTimeout(() => el.remove(), 250);
      }
    });

    item.alive = true;
    playArea.appendChild(el);
    requestAnimationFrame(() => { el.style.transform = "scale(1)"; });
    activeShapes.push(item);

    // 자동 사라짐
    const lifetime = Math.max(900, 1800 - round * 200);
    setTimeout(() => {
      if (!item.alive) return;
      item.alive = false;
      el.style.transform = "scale(0)";
      setTimeout(() => el.remove(), 200);
    }, lifetime);
  }

  function finish() {
    clearShapes();
    msgEl.textContent = "🎉 끝!";
    targetShape.innerHTML = "";
    hitsCounter.textContent = "";
    const stars = mistakes <= 2 ? 3 : mistakes <= 5 ? 2 : 1;
    msg2El.innerHTML = `별 <b>${"⭐".repeat(stars)}</b> 획득!`;
    msg2El.className = "msg good";
    if (setStarsIfBetter(gameId, stars)) onStarsChange();
    burstConfetti();
    const btn = document.createElement("button");
    btn.className = "btn";
    btn.textContent = "또 할래";
    btn.addEventListener("click", () => { container.innerHTML = ""; mountGame(container, { gameId, onStarsChange, backToMenu }); });
    wrap.appendChild(btn);
  }

  const obs = new MutationObserver(() => { if (!document.body.contains(playArea)) { alive = false; clearShapes(); obs.disconnect(); } });
  obs.observe(document.body, { childList: true, subtree: true });

  startRound();
}

function pickOther(kind) {
  const opts = SHAPE_KINDS.filter((s) => s !== kind);
  return opts[Math.floor(Math.random() * opts.length)];
}
