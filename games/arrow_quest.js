// 게임 4 (v2): 별 모으기 — 손가락으로 별을 모두 거치는 경로를 한 번에 그리고
// 출발 버튼 누르면 토끼가 그 경로를 따라 달려감 (벡터 = 단위 이동의 합)
import { setStarsIfBetter } from "../shared/score.js";
import { playGood, playBad, playFanfare, playClick } from "../shared/audio.js";
import { burstConfetti } from "../shared/celebrate.js";

const GRID = 5;
const CELL = 64;
const ROUNDS = 4;

export function mountGame(container, { gameId, onStarsChange, backToMenu }) {
  let round = 0;
  let mistakes = 0;
  let alive = true;

  const wrap = document.createElement("div");
  wrap.style.cssText = "width:100%;display:flex;flex-direction:column;align-items:center;gap:12px";
  wrap.innerHTML = `
    <div class="msg" id="msg">손가락으로 별을 모두 지나는 길을 그어!</div>
    <canvas id="cv" width="${GRID*CELL}" height="${GRID*CELL}"
            style="background:#fff7e6;border-radius:18px;box-shadow:var(--shadow);max-width:100%;height:auto;touch-action:none;cursor:crosshair"></canvas>
    <div style="display:flex;gap:10px;flex-wrap:wrap;justify-content:center">
      <button class="btn small secondary" id="reset-btn">다시 그리기</button>
      <button class="btn" id="go-btn">출발!</button>
    </div>
    <div class="msg" id="msg2"></div>
  `;
  container.appendChild(wrap);

  const cv = wrap.querySelector("#cv");
  const ctx = cv.getContext("2d");
  const msgEl = wrap.querySelector("#msg");
  const msg2El = wrap.querySelector("#msg2");
  const resetBtn = wrap.querySelector("#reset-btn");
  const goBtn = wrap.querySelector("#go-btn");

  let path = [];
  let stars = [];
  let start = { x: 0, y: GRID - 1 };
  let isDragging = false;
  let isAnimating = false;
  let animProgress = 0;
  let lastT = performance.now();

  function startRound() {
    if (round >= ROUNDS) { finish(); return; }
    round += 1;
    isAnimating = false;
    animProgress = 0;
    msgEl.textContent = `${round} / ${ROUNDS} — 별을 모두 지나는 길을 그어!`;
    msgEl.className = "msg";
    msg2El.textContent = "";
    msg2El.className = "msg";

    start = { x: 0, y: GRID - 1 };
    path = [start];

    stars = [];
    const starCount = 1 + Math.min(round, 3);
    while (stars.length < starCount) {
      const x = Math.floor(Math.random() * GRID);
      const y = Math.floor(Math.random() * GRID);
      if ((x === start.x && y === start.y) || stars.some((s) => s.x === x && s.y === y)) continue;
      stars.push({ x, y });
    }
  }

  function getCell(e) {
    const rect = cv.getBoundingClientRect();
    const sx = cv.width / rect.width;
    const sy = cv.height / rect.height;
    const cx = (e.clientX - rect.left) * sx;
    const cy = (e.clientY - rect.top) * sy;
    return { x: Math.floor(cx / CELL), y: Math.floor(cy / CELL) };
  }
  const adj = (a, b) => Math.abs(a.x - b.x) + Math.abs(a.y - b.y) === 1;
  const inPath = (c) => path.some((p) => p.x === c.x && p.y === c.y);

  cv.addEventListener("pointerdown", (e) => {
    if (isAnimating) return;
    cv.setPointerCapture(e.pointerId);
    const cell = getCell(e);
    // 새로 그리기 시작
    path = [start];
    isDragging = true;
    playClick();
    // 첫 칸이 시작칸 옆이면 바로 추가
    if (adj(start, cell)) path.push(cell);
  });
  cv.addEventListener("pointermove", (e) => {
    if (!isDragging || isAnimating) return;
    const cell = getCell(e);
    if (cell.x < 0 || cell.x >= GRID || cell.y < 0 || cell.y >= GRID) return;
    const last = path[path.length - 1];
    if (cell.x === last.x && cell.y === last.y) return;
    // 백트랙
    if (path.length >= 2) {
      const prev = path[path.length - 2];
      if (cell.x === prev.x && cell.y === prev.y) {
        path.pop();
        return;
      }
    }
    if (adj(last, cell) && !inPath(cell)) {
      path.push(cell);
      if (stars.some((s) => s.x === cell.x && s.y === cell.y)) playGood();
      else playClick();
    }
  });
  const endDrag = () => { isDragging = false; };
  cv.addEventListener("pointerup", endDrag);
  cv.addEventListener("pointercancel", endDrag);

  resetBtn.addEventListener("click", () => {
    if (isAnimating) return;
    path = [start];
    msg2El.textContent = "";
    msg2El.className = "msg";
  });

  goBtn.addEventListener("click", () => {
    if (isAnimating) return;
    if (path.length < 2) {
      playBad();
      msg2El.textContent = "길을 먼저 그어!";
      msg2El.className = "msg bad";
      return;
    }
    const allStars = stars.every((s) => path.some((p) => p.x === s.x && p.y === s.y));
    if (!allStars) {
      playBad();
      msg2El.textContent = "별을 다 못 지났어! 더 그어!";
      msg2El.className = "msg bad";
      mistakes += 1;
      cv.classList.add("shake");
      setTimeout(() => cv.classList.remove("shake"), 400);
      return;
    }
    isAnimating = true;
    animProgress = 0;
    msg2El.textContent = "";
  });

  function tick(now) {
    if (!alive) return;
    const dt = Math.min(0.05, (now - lastT) / 1000);
    lastT = now;
    if (isAnimating) {
      animProgress += dt * 6; // 6 cells/sec
      if (animProgress >= path.length - 1) {
        msg2El.textContent = "도착! 🎉";
        msg2El.className = "msg good";
        playFanfare();
        burstConfetti(40);
        isAnimating = false;
        setTimeout(startRound, 1100);
      }
    }
    draw();
    requestAnimationFrame(tick);
  }

  function draw() {
    ctx.clearRect(0, 0, cv.width, cv.height);
    // grid
    ctx.strokeStyle = "#eadcb8";
    ctx.lineWidth = 1;
    for (let i = 0; i <= GRID; i++) {
      ctx.beginPath(); ctx.moveTo(i*CELL, 0); ctx.lineTo(i*CELL, GRID*CELL); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(0, i*CELL); ctx.lineTo(GRID*CELL, i*CELL); ctx.stroke();
    }
    // path line
    if (path.length > 1) {
      ctx.strokeStyle = "#ff8a4c";
      ctx.lineWidth = 10;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.beginPath();
      for (let i = 0; i < path.length; i++) {
        const x = path[i].x*CELL + CELL/2;
        const y = path[i].y*CELL + CELL/2;
        if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      }
      ctx.stroke();
    }
    // path dots
    for (let i = 1; i < path.length; i++) {
      ctx.fillStyle = "#ff8a4c";
      ctx.beginPath();
      ctx.arc(path[i].x*CELL + CELL/2, path[i].y*CELL + CELL/2, 6, 0, Math.PI*2);
      ctx.fill();
    }
    // stars
    for (const s of stars) {
      const onPath = path.some((p) => p.x === s.x && p.y === s.y);
      drawEmoji(onPath ? "✨" : "⭐", s.x, s.y);
    }
    // rabbit
    if (isAnimating) {
      const i = Math.floor(animProgress);
      const f = animProgress - i;
      const a = path[Math.min(i, path.length-1)];
      const b = path[Math.min(i+1, path.length-1)];
      const x = (a.x + (b.x - a.x) * f) * CELL + CELL/2;
      const y = (a.y + (b.y - a.y) * f) * CELL + CELL/2;
      drawEmojiAt("🐰", x, y);
    } else {
      drawEmoji("🐰", start.x, start.y);
    }
  }
  function drawEmoji(ch, x, y) { drawEmojiAt(ch, x*CELL + CELL/2, y*CELL + CELL/2); }
  function drawEmojiAt(ch, px, py) {
    ctx.font = "44px serif";
    ctx.textAlign = "center"; ctx.textBaseline = "middle";
    ctx.fillText(ch, px, py + 2);
  }

  function finish() {
    cv.style.display = "none";
    resetBtn.style.display = "none";
    goBtn.style.display = "none";
    msgEl.textContent = "🎉 끝!";
    const stars = mistakes === 0 ? 3 : mistakes <= 2 ? 2 : 1;
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

  const obs = new MutationObserver(() => { if (!document.body.contains(cv)) { alive = false; obs.disconnect(); } });
  obs.observe(document.body, { childList: true, subtree: true });

  startRound();
  requestAnimationFrame(tick);
}
