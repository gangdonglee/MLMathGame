// 게임 7 (v2): 거울 격자 — 왼쪽 패턴을 변환(거울/회전)으로 어떻게 바꿔야 할지
// 옵션 고르는 게 아니라, 빈 격자에 손가락으로 직접 색칠해서 답을 만든다
import { setStarsIfBetter } from "../shared/score.js";
import { playGood, playBad, playFanfare, playClick } from "../shared/audio.js";
import { burstConfetti } from "../shared/celebrate.js";

const N = 4;
const CELL = 50;
const ROUNDS = 4;

const TRANSFORMS = [
  { id: "flipH",  label: "좌우 거울 🪞", fn: (g) => g.map((row) => [...row].reverse()) },
  { id: "flipV",  label: "상하 거울 🔃", fn: (g) => [...g].reverse().map((r) => [...r]) },
  { id: "rot180", label: "반 바퀴 ↻↻",   fn: (g) => g.map((r) => [...r]).reverse().map((r) => r.reverse()) },
];

export function mountGame(container, { gameId, onStarsChange, backToMenu }) {
  let round = 0;
  let mistakes = 0;
  let alive = true;

  const wrap = document.createElement("div");
  wrap.style.cssText = "width:100%;display:flex;flex-direction:column;align-items:center;gap:10px";
  wrap.innerHTML = `
    <div class="msg" id="msg">왼쪽 그림을 <b>?</b>처럼 만들면 어떻게 될까? 오른쪽에 직접 색칠!</div>
    <div id="rule" style="font-size:24px;font-weight:800"></div>
    <div style="display:flex;gap:14px;align-items:center;flex-wrap:wrap;justify-content:center">
      <canvas id="src" width="${N*CELL}" height="${N*CELL}"
              style="background:#fff;border-radius:14px;box-shadow:var(--shadow);touch-action:none"></canvas>
      <div style="font-size:30px">➜</div>
      <canvas id="tgt" width="${N*CELL}" height="${N*CELL}"
              style="background:#fff;border-radius:14px;box-shadow:var(--shadow);cursor:crosshair;touch-action:none"></canvas>
    </div>
    <div style="display:flex;gap:10px;flex-wrap:wrap;justify-content:center">
      <button class="btn small secondary" id="clear-btn">지우기</button>
      <button class="btn" id="check-btn">확인!</button>
    </div>
    <div class="msg" id="msg2"></div>
  `;
  container.appendChild(wrap);

  const srcCv = wrap.querySelector("#src");
  const tgtCv = wrap.querySelector("#tgt");
  const srcCtx = srcCv.getContext("2d");
  const tgtCtx = tgtCv.getContext("2d");
  const ruleEl = wrap.querySelector("#rule");
  const msgEl = wrap.querySelector("#msg");
  const msg2El = wrap.querySelector("#msg2");
  const clearBtn = wrap.querySelector("#clear-btn");
  const checkBtn = wrap.querySelector("#check-btn");

  let src;       // [N][N] 0/1
  let target;    // [N][N] 0/1 (정답)
  let user;      // [N][N] 0/1 (사용자가 그린 것)
  let paintMode = 1; // 0 또는 1 (drag 시작 칸의 반대 값)
  let isDragging = false;

  function startRound() {
    if (round >= ROUNDS) { finish(); return; }
    round += 1;
    msgEl.textContent = `${round} / ${ROUNDS} — 같은 모양이 되게 색칠!`;
    msgEl.className = "msg";
    msg2El.textContent = "";
    msg2El.className = "msg";

    const t = TRANSFORMS[Math.floor(Math.random() * TRANSFORMS.length)];
    ruleEl.textContent = t.label;
    src = randomAsymmetric();
    target = t.fn(src);
    user = Array.from({ length: N }, () => Array(N).fill(0));

    drawBoard(srcCtx, src, false);
    drawBoard(tgtCtx, user, true);
  }

  function drawBoard(ctx, grid, withGuide) {
    const w = N * CELL;
    ctx.clearRect(0, 0, w, w);
    // 격자
    ctx.strokeStyle = "#eadcb8";
    ctx.lineWidth = 1;
    for (let i = 0; i <= N; i++) {
      ctx.beginPath(); ctx.moveTo(i*CELL, 0); ctx.lineTo(i*CELL, w); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(0, i*CELL); ctx.lineTo(w, i*CELL); ctx.stroke();
    }
    // 칸 채우기
    for (let y = 0; y < N; y++) {
      for (let x = 0; x < N; x++) {
        if (grid[y][x]) {
          ctx.fillStyle = "#ff8a4c";
          ctx.fillRect(x*CELL + 4, y*CELL + 4, CELL - 8, CELL - 8);
        }
      }
    }
    if (withGuide) {
      ctx.strokeStyle = "rgba(58,47,30,0.2)";
      ctx.lineWidth = 1;
      ctx.setLineDash([3, 3]);
      ctx.strokeRect(2, 2, w - 4, w - 4);
      ctx.setLineDash([]);
    }
  }

  function getCell(e, cv) {
    const rect = cv.getBoundingClientRect();
    const sx = cv.width / rect.width;
    const sy = cv.height / rect.height;
    const cx = (e.clientX - rect.left) * sx;
    const cy = (e.clientY - rect.top) * sy;
    return { x: Math.floor(cx / CELL), y: Math.floor(cy / CELL) };
  }

  tgtCv.addEventListener("pointerdown", (e) => {
    tgtCv.setPointerCapture(e.pointerId);
    const c = getCell(e, tgtCv);
    if (c.x < 0 || c.x >= N || c.y < 0 || c.y >= N) return;
    paintMode = user[c.y][c.x] ? 0 : 1; // 클릭한 칸의 반대로 → 드래그 시 같은 동작 반복
    user[c.y][c.x] = paintMode;
    isDragging = true;
    playClick();
    drawBoard(tgtCtx, user, true);
  });
  tgtCv.addEventListener("pointermove", (e) => {
    if (!isDragging) return;
    const c = getCell(e, tgtCv);
    if (c.x < 0 || c.x >= N || c.y < 0 || c.y >= N) return;
    if (user[c.y][c.x] !== paintMode) {
      user[c.y][c.x] = paintMode;
      drawBoard(tgtCtx, user, true);
    }
  });
  const endDraw = () => { isDragging = false; };
  tgtCv.addEventListener("pointerup", endDraw);
  tgtCv.addEventListener("pointercancel", endDraw);

  clearBtn.addEventListener("click", () => {
    user = Array.from({ length: N }, () => Array(N).fill(0));
    drawBoard(tgtCtx, user, true);
    msg2El.textContent = "";
  });

  checkBtn.addEventListener("click", () => {
    let correct = true;
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
      if (user[y][x] !== target[y][x]) { correct = false; break; }
    }
    if (correct) {
      playGood(); playFanfare();
      msg2El.textContent = "맞았어! 🎉";
      msg2El.className = "msg good";
      burstConfetti(40);
      setTimeout(startRound, 1100);
    } else {
      playBad();
      mistakes += 1;
      msg2El.textContent = "조금 달라! 다시 봐봐";
      msg2El.className = "msg bad";
      tgtCv.classList.add("shake");
      setTimeout(() => tgtCv.classList.remove("shake"), 400);
    }
  });

  function randomAsymmetric() {
    for (let attempt = 0; attempt < 30; attempt++) {
      const g = Array.from({ length: N }, () => Array.from({ length: N }, () => Math.random() < 0.45 ? 1 : 0));
      const variants = TRANSFORMS.map((t) => JSON.stringify(t.fn(g)));
      variants.push(JSON.stringify(g));
      if (new Set(variants).size === TRANSFORMS.length + 1) return g;
    }
    return [[1,0,0,0],[1,1,0,0],[1,0,0,0],[0,0,0,1]];
  }

  function finish() {
    srcCv.style.display = "none";
    tgtCv.style.display = "none";
    clearBtn.style.display = "none";
    checkBtn.style.display = "none";
    ruleEl.textContent = "";
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

  const obs = new MutationObserver(() => { if (!document.body.contains(srcCv)) { alive = false; obs.disconnect(); } });
  obs.observe(document.body, { childList: true, subtree: true });

  startRound();
}
