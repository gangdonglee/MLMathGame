// 게임 2: 도형 친구 — 가운데 도형과 같은 모양 모두 고르기 (색·크기는 달라도 됨)
import { setStarsIfBetter } from "../shared/score.js";
import { playGood, playBad, playFanfare, playClick } from "../shared/audio.js";
import { burstConfetti } from "../shared/celebrate.js";

const SHAPES = ["circle", "square", "triangle", "star"];
const COLORS = ["#ff8a4c", "#6cb6ff", "#ff9ec7", "#88e0a0", "#b58cff", "#ffd166"];
const ROUNDS = 4;

function shapeSvg(kind, color) {
  const c = color;
  switch (kind) {
    case "circle":   return `<svg class="shape-svg" viewBox="0 0 100 100"><circle cx="50" cy="50" r="42" fill="${c}"/></svg>`;
    case "square":   return `<svg class="shape-svg" viewBox="0 0 100 100"><rect x="12" y="12" width="76" height="76" rx="10" fill="${c}"/></svg>`;
    case "triangle": return `<svg class="shape-svg" viewBox="0 0 100 100"><polygon points="50,10 92,88 8,88" fill="${c}"/></svg>`;
    case "star":     return `<svg class="shape-svg" viewBox="0 0 100 100"><polygon points="50,8 61,38 94,40 67,60 78,92 50,72 22,92 33,60 6,40 39,38" fill="${c}"/></svg>`;
  }
}

export function mountGame(container, { gameId, onStarsChange, backToMenu }) {
  let round = 0;
  let mistakes = 0;

  const wrap = document.createElement("div");
  wrap.style.width = "100%";
  wrap.innerHTML = `
    <div class="msg" id="prompt">같은 모양 모두 골라줘!</div>
    <div id="target" style="display:flex;justify-content:center;margin:14px 0"></div>
    <div class="shape-stage" id="grid" style="margin: 0 auto;"></div>
    <div class="msg" id="msg"></div>
    <button class="btn" id="next" style="display:none;margin-top:14px">다음</button>
  `;
  container.appendChild(wrap);

  const targetEl = wrap.querySelector("#target");
  const gridEl = wrap.querySelector("#grid");
  const msgEl = wrap.querySelector("#msg");
  const nextBtn = wrap.querySelector("#next");
  nextBtn.addEventListener("click", nextRound);

  function nextRound() {
    if (round >= ROUNDS) { finish(); return; }
    round += 1;
    msgEl.textContent = "";
    msgEl.className = "msg";
    nextBtn.style.display = "none";

    const targetKind = SHAPES[Math.floor(Math.random() * SHAPES.length)];
    const targetColor = COLORS[Math.floor(Math.random() * COLORS.length)];
    targetEl.innerHTML = `<div class="target-shape">${shapeSvg(targetKind, targetColor)}</div>`;

    const cells = [];
    const targetCount = 2 + Math.floor(Math.random() * 2); // 2~3개
    for (let i = 0; i < 6; i++) {
      const isTarget = i < targetCount;
      const kind = isTarget ? targetKind : pickOther(targetKind);
      const color = COLORS[Math.floor(Math.random() * COLORS.length)];
      cells.push({ kind, color, isTarget, picked: false });
    }
    shuffle(cells);

    gridEl.innerHTML = "";
    cells.forEach((cell, i) => {
      const el = document.createElement("button");
      el.className = "shape-cell";
      el.innerHTML = shapeSvg(cell.kind, cell.color);
      el.addEventListener("click", () => {
        if (cell.picked) return;
        playClick();
        if (cell.isTarget) {
          cell.picked = true;
          el.classList.add("picked");
          playGood();
          checkRoundDone();
        } else {
          mistakes += 1;
          el.classList.add("shake");
          playBad();
          setTimeout(() => el.classList.remove("shake"), 400);
        }
      });
      gridEl.appendChild(el);
    });

    function checkRoundDone() {
      const remaining = cells.filter((c) => c.isTarget && !c.picked).length;
      if (remaining === 0) {
        msgEl.textContent = "모두 찾았다! 👏";
        msgEl.className = "msg good";
        nextBtn.style.display = "inline-flex";
      }
    }
  }

  function finish() {
    targetEl.innerHTML = "🎉";
    gridEl.innerHTML = "";
    const stars = mistakes === 0 ? 3 : mistakes <= 2 ? 2 : 1;
    msgEl.innerHTML = `별 <b>${"⭐".repeat(stars)}</b> 획득!`;
    msgEl.className = "msg good";
    if (setStarsIfBetter(gameId, stars)) onStarsChange();
    playFanfare();
    burstConfetti();
    nextBtn.textContent = "또 할래";
    nextBtn.style.display = "inline-flex";
    nextBtn.onclick = () => { container.innerHTML = ""; mountGame(container, { gameId, onStarsChange, backToMenu }); };
  }

  nextRound();
}

function pickOther(kind) {
  const opts = SHAPES.filter((s) => s !== kind);
  return opts[Math.floor(Math.random() * opts.length)];
}
function shuffle(a) { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }
