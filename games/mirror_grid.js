// 게임 7 (v3): 거울 격자 — 변환 옵션을 골라 새총으로 스탬프를 발사한다.
// 발사된 스탬프는 변환된 패턴이 되어 타겟 보드에 찍힌다. 타겟과 일치 = 클리어.
// (행렬/대칭 = "어떤 변환을 적용할지" 의 직관 + 슬링샷의 액션)
import { setStarsIfBetter } from "../shared/score.js";
import { playGood, playBad, playFanfare, playClick, playPop } from "../shared/audio.js";
import { burstConfetti } from "../shared/celebrate.js";

const N = 4;
const CELL = 36;
const ROUNDS = 4;
const W = 480;
const H = 380;
const SLING_X = W / 2;
const SLING_Y = H - 60;
const POWER = 4.5;
const MAX_PULL = 110;
const G = 600;

const TRANSFORMS = [
  { id: "none",   label: "그대로",     fn: (g) => g.map((r) => [...r]) },
  { id: "flipH",  label: "좌우 거울",  fn: (g) => g.map((r) => [...r].reverse()) },
  { id: "flipV",  label: "상하 거울",  fn: (g) => [...g].reverse().map((r) => [...r]) },
  { id: "rot180", label: "반 바퀴",    fn: (g) => g.map((r) => [...r]).reverse().map((r) => r.reverse()) },
];

export function mountGame(container, { gameId, onStarsChange, backToMenu }) {
  let round = 0;
  let mistakes = 0;
  let alive = true;
  let lastT = performance.now();

  const wrap = document.createElement("div");
  wrap.style.cssText = "width:100%;display:flex;flex-direction:column;align-items:center;gap:10px";
  wrap.innerHTML = `
    <div class="msg" id="msg">변환을 골라 새총으로 발사! 타겟에 맞춰!</div>
    <div id="opts-row" style="display:flex;gap:8px;flex-wrap:wrap;justify-content:center"></div>
    <canvas id="cv" width="${W}" height="${H}"
            style="background:linear-gradient(#bee5ff,#fff7e6);border-radius:18px;box-shadow:var(--shadow);max-width:100%;height:auto;touch-action:none;cursor:grab"></canvas>
    <div class="time-bar" style="width:100%;max-width:${W}px;height:14px;background:#eee;border-radius:7px;overflow:hidden">
      <div id="time-fill" style="height:100%;background:var(--good);width:100%;transition:width 0.1s linear"></div>
    </div>
    <div class="msg" id="msg2"></div>
  `;
  container.appendChild(wrap);

  const cv = wrap.querySelector("#cv");
  const ctx = cv.getContext("2d");
  const optsRow = wrap.querySelector("#opts-row");
  const msgEl = wrap.querySelector("#msg");
  const msg2El = wrap.querySelector("#msg2");
  const timeFill = wrap.querySelector("#time-fill");

  const TIME_LIMIT = 20;
  let src;             // [N][N]
  let target;          // [N][N]
  let correctTransform; // id
  let chosenTransform = "none";
  let aiming = null;
  let stamp = null;     // {x,y,vx,vy,grid}
  let won = false;
  let optBtns = [];
  let timeLeft = TIME_LIMIT;
  let timedOut = false;

  function startRound() {
    if (round >= ROUNDS) { finish(); return; }
    round += 1;
    won = false;
    aiming = null;
    stamp = null;
    chosenTransform = "none";
    timeLeft = TIME_LIMIT;
    timedOut = false;
    msgEl.textContent = `${round} / ${ROUNDS} — 변환 고르고 발사!`;
    msgEl.className = "msg";
    msg2El.textContent = "";
    msg2El.className = "msg";

    src = randomAsymmetric();
    const t = TRANSFORMS[1 + Math.floor(Math.random() * (TRANSFORMS.length - 1))];
    correctTransform = t.id;
    target = t.fn(src);

    rebuildOpts();
  }

  function rebuildOpts() {
    optsRow.innerHTML = "";
    optBtns = TRANSFORMS.map((t) => {
      const btn = document.createElement("button");
      btn.className = "btn small secondary";
      btn.textContent = t.label;
      btn.dataset.id = t.id;
      btn.addEventListener("click", () => {
        if (stamp) return;
        chosenTransform = t.id;
        playClick();
        renderOpts();
      });
      optsRow.appendChild(btn);
      return btn;
    });
    renderOpts();
  }

  function renderOpts() {
    for (const b of optBtns) {
      b.style.outline = b.dataset.id === chosenTransform ? "3px solid var(--accent)" : "none";
    }
  }

  function getCanvasCoords(e) {
    const rect = cv.getBoundingClientRect();
    const sx = cv.width / rect.width;
    const sy = cv.height / rect.height;
    return { x: (e.clientX - rect.left) * sx, y: (e.clientY - rect.top) * sy };
  }

  cv.addEventListener("pointerdown", (e) => {
    if (won || stamp) return;
    cv.setPointerCapture(e.pointerId);
    const c = getCanvasCoords(e);
    aiming = { startX: c.x, startY: c.y, dx: 0, dy: 0 };
    cv.style.cursor = "grabbing";
  });
  cv.addEventListener("pointermove", (e) => {
    if (!aiming) return;
    const c = getCanvasCoords(e);
    aiming.dx = clamp(c.x - aiming.startX, -MAX_PULL, MAX_PULL);
    aiming.dy = clamp(c.y - aiming.startY, -10, MAX_PULL);
  });
  function release() {
    if (!aiming) return;
    cv.style.cursor = "grab";
    if (Math.hypot(aiming.dx, aiming.dy) < 12) { aiming = null; return; }
    const tFn = TRANSFORMS.find((x) => x.id === chosenTransform).fn;
    stamp = {
      x: SLING_X,
      y: SLING_Y - 26,
      vx: -aiming.dx * POWER,
      vy: -aiming.dy * POWER,
      grid: tFn(src),
    };
    aiming = null;
    playClick();
  }
  cv.addEventListener("pointerup", release);
  cv.addEventListener("pointercancel", () => { aiming = null; cv.style.cursor = "grab"; });

  // 타겟 박스 (위쪽에)
  const TARGET_BOX = { x: W/2 - (N*CELL)/2, y: 30, w: N*CELL, h: N*CELL };

  function tick(now) {
    if (!alive) return;
    const dt = Math.min(0.03, (now - lastT) / 1000);
    lastT = now;

    if (!won && !timedOut) {
      timeLeft -= dt;
      timeFill.style.width = (Math.max(0, timeLeft / TIME_LIMIT) * 100) + "%";
      timeFill.style.background = timeLeft / TIME_LIMIT < 0.3 ? "var(--bad)" : "var(--good)";
      if (timeLeft <= 0) {
        timedOut = true;
        mistakes += 1;
        playBad();
        msg2El.textContent = "시간 초과! 다시!";
        msg2El.className = "msg bad";
        round -= 1;
        setTimeout(startRound, 1100);
      }
    }

    if (stamp && !won) {
      stamp.vy += G * dt;
      stamp.x += stamp.vx * dt;
      stamp.y += stamp.vy * dt;

      // 타겟 박스에 닿았는지
      if (stamp.x >= TARGET_BOX.x && stamp.x <= TARGET_BOX.x + TARGET_BOX.w &&
          stamp.y >= TARGET_BOX.y && stamp.y <= TARGET_BOX.y + TARGET_BOX.h) {
        // 일치 검사
        const matches = JSON.stringify(stamp.grid) === JSON.stringify(target);
        if (matches) {
          won = true;
          playPop(); playGood(); playFanfare();
          msg2El.textContent = "딱 맞췄어! 🎉";
          msg2El.className = "msg good";
          burstConfetti(40);
          setTimeout(startRound, 1300);
        } else {
          playBad();
          mistakes += 1;
          msg2El.textContent = chosenTransform === correctTransform ? "조금 빗나갔어!" : "변환을 다시 골라봐!";
          msg2El.className = "msg bad";
        }
        stamp = null;
      } else if (stamp.y > H + 50 || stamp.x < -50 || stamp.x > W + 50) {
        // 빗나감
        msg2El.textContent = "다시 쏴봐!";
        msg2El.className = "msg";
        stamp = null;
      }
    }

    draw();
    requestAnimationFrame(tick);
  }

  function draw() {
    ctx.clearRect(0, 0, W, H);

    // 타겟 박스 (정답 패턴 윤곽)
    ctx.strokeStyle = "#3a2f1e";
    ctx.lineWidth = 3;
    ctx.setLineDash([6, 6]);
    ctx.strokeRect(TARGET_BOX.x, TARGET_BOX.y, TARGET_BOX.w, TARGET_BOX.h);
    ctx.setLineDash([]);
    drawGrid(target, TARGET_BOX.x, TARGET_BOX.y, "rgba(58,47,30,0.55)");
    ctx.fillStyle = "#3a2f1e";
    ctx.font = "bold 14px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("이 모양에 맞춰서 ▼", W/2, TARGET_BOX.y + N*CELL + 22);

    // 원본 (왼쪽 하단)
    const SRC_BOX = { x: 20, y: H - 30 - N*CELL };
    drawGrid(src, SRC_BOX.x, SRC_BOX.y, "#ff8a4c");
    ctx.fillStyle = "#3a2f1e";
    ctx.font = "bold 12px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("원본", SRC_BOX.x + N*CELL/2, SRC_BOX.y - 6);

    // 새총
    ctx.strokeStyle = "#7a4f1a";
    ctx.lineWidth = 9;
    ctx.lineCap = "round";
    const armY = SLING_Y - 40;
    ctx.beginPath(); ctx.moveTo(SLING_X - 22, armY - 22); ctx.lineTo(SLING_X, SLING_Y); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(SLING_X + 22, armY - 22); ctx.lineTo(SLING_X, SLING_Y); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(SLING_X, SLING_Y); ctx.lineTo(SLING_X, H - 8); ctx.stroke();

    // 고무줄/스탬프 미리보기
    if (aiming) {
      const px = SLING_X + aiming.dx;
      const py = SLING_Y - 26 + aiming.dy;
      ctx.strokeStyle = "#3a2f1e";
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(SLING_X - 22, armY - 22);
      ctx.lineTo(px, py);
      ctx.lineTo(SLING_X + 22, armY - 22);
      ctx.stroke();
      const tFn = TRANSFORMS.find((x) => x.id === chosenTransform).fn;
      const previewGrid = tFn(src);
      drawStampMini(previewGrid, px, py, 16);
    } else if (!stamp) {
      ctx.strokeStyle = "#3a2f1e";
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(SLING_X - 22, armY - 22);
      ctx.lineTo(SLING_X, SLING_Y - 26);
      ctx.lineTo(SLING_X + 22, armY - 22);
      ctx.stroke();
      const tFn = TRANSFORMS.find((x) => x.id === chosenTransform).fn;
      drawStampMini(tFn(src), SLING_X, SLING_Y - 26, 16);
    }

    // 날아가는 스탬프
    if (stamp) drawStampMini(stamp.grid, stamp.x, stamp.y, 18);
  }

  function drawGrid(grid, ox, oy, color) {
    ctx.strokeStyle = "rgba(58,47,30,0.15)";
    ctx.lineWidth = 1;
    for (let i = 0; i <= N; i++) {
      ctx.beginPath(); ctx.moveTo(ox + i*CELL, oy); ctx.lineTo(ox + i*CELL, oy + N*CELL); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(ox, oy + i*CELL); ctx.lineTo(ox + N*CELL, oy + i*CELL); ctx.stroke();
    }
    for (let y = 0; y < N; y++) {
      for (let x = 0; x < N; x++) {
        if (grid[y][x]) {
          ctx.fillStyle = color;
          ctx.fillRect(ox + x*CELL + 3, oy + y*CELL + 3, CELL - 6, CELL - 6);
        }
      }
    }
  }
  function drawStampMini(grid, cx, cy, size) {
    const cellSz = size / N;
    const ox = cx - size/2;
    const oy = cy - size/2;
    ctx.fillStyle = "rgba(255,255,255,0.85)";
    ctx.fillRect(ox - 2, oy - 2, size + 4, size + 4);
    for (let y = 0; y < N; y++) {
      for (let x = 0; x < N; x++) {
        if (grid[y][x]) {
          ctx.fillStyle = "#ff5a5f";
          ctx.fillRect(ox + x*cellSz + 0.5, oy + y*cellSz + 0.5, cellSz - 1, cellSz - 1);
        }
      }
    }
    ctx.strokeStyle = "#3a2f1e";
    ctx.lineWidth = 1.5;
    ctx.strokeRect(ox - 2, oy - 2, size + 4, size + 4);
  }

  function randomAsymmetric() {
    for (let attempt = 0; attempt < 30; attempt++) {
      const g = Array.from({ length: N }, () => Array.from({ length: N }, () => Math.random() < 0.45 ? 1 : 0));
      const variants = TRANSFORMS.map((t) => JSON.stringify(t.fn(g)));
      if (new Set(variants).size === TRANSFORMS.length) return g;
    }
    return [[1,0,0,0],[1,1,0,0],[1,0,0,0],[0,0,0,1]];
  }

  function finish() {
    cv.style.display = "none";
    optsRow.style.display = "none";
    msgEl.textContent = "🎉 끝!";
    const stars = mistakes <= 1 ? 3 : mistakes <= 4 ? 2 : 1;
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

function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }
