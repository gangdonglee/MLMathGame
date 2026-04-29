// 게임 5 (v3): 공 굴리기 — 슬링샷으로 공 발사. 포물선으로 날아간 공이
// 언덕에 떨어져 굴러서 골짜기에 안착. 가장 깊은 골짜기 (큰 별) 에 멈추면 클리어
// (그래디언트 = 공이 자연스럽게 가장 낮은 곳을 찾음. 슬링샷으로 액션화)
import { setStarsIfBetter } from "../shared/score.js";
import { playGood, playBad, playFanfare, playPop, playClick } from "../shared/audio.js";
import { burstConfetti } from "../shared/celebrate.js";

const W = 560;
const H = 360;
const ROUNDS = 3;
const G = 1100;          // 중력 (px/s²)
const FRICTION = 0.7;    // 굴러갈 때 마찰
const POWER = 6;
const MAX_PULL = 110;
const SLING_X = 60;
const SLING_Y = H - 80;
const BASE_LINE = 100;
const PEBBLE_R = 12;

export function mountGame(container, { gameId, onStarsChange, backToMenu }) {
  let round = 0;
  let mistakes = 0;
  let alive = true;
  let lastT = performance.now();

  const wrap = document.createElement("div");
  wrap.style.cssText = "width:100%;display:flex;flex-direction:column;align-items:center;gap:10px";
  wrap.innerHTML = `
    <div class="msg" id="msg">새총으로 공 발사! 가장 깊은 골짜기 (큰 별) 에 안착시켜!</div>
    <canvas id="cv" width="${W}" height="${H}"
            style="background:linear-gradient(#bee5ff,#fff7e6);border-radius:18px;box-shadow:var(--shadow);max-width:100%;height:auto;touch-action:none;cursor:grab"></canvas>
    <div class="msg" id="msg2"></div>
  `;
  container.appendChild(wrap);

  const cv = wrap.querySelector("#cv");
  const ctx = cv.getContext("2d");
  const msgEl = wrap.querySelector("#msg");
  const msg2El = wrap.querySelector("#msg2");

  let curve, valleys, deepestIdx;
  let ball = null; // {x,y,vx,vy,mode:'fly'|'roll'|'stopped', stopTime}
  let aiming = null;
  let won = false;
  let attempts = 0;

  function startRound() {
    if (round >= ROUNDS) { finish(); return; }
    round += 1;
    won = false;
    ball = null;
    aiming = null;
    attempts = 0;
    msgEl.textContent = `${round} / ${ROUNDS} — 새총 당겼다 놓아!`;
    msgEl.className = "msg";
    msg2El.textContent = "";
    msg2El.className = "msg";
    ({ curve, valleys, deepestIdx } = makeTerrain(round));
  }

  function makeTerrain(level) {
    const numValleys = level; // 1, 2, 3
    const valleys = [];
    for (let i = 0; i < numValleys; i++) {
      const cx = W * (0.30 + 0.55 * (i + 0.5) / numValleys + (Math.random() - 0.5) * 0.04);
      const sigma = 50 + Math.random() * 18;
      const depth = 60 + Math.random() * 25;
      valleys.push({ cx, sigma, depth });
    }
    let deepestIdx = 0;
    for (let i = 1; i < valleys.length; i++) {
      if (valleys[i].depth > valleys[deepestIdx].depth) deepestIdx = i;
    }
    valleys[deepestIdx].depth += 40;

    const curve = new Array(W);
    for (let x = 0; x < W; x++) {
      let dip = 0;
      for (const v of valleys) {
        const d = (x - v.cx) / v.sigma;
        dip += v.depth * Math.exp(-0.5 * d * d);
      }
      curve[x] = Math.min(H - 12, BASE_LINE + dip);
    }
    return { curve, valleys, deepestIdx };
  }

  function slopeAt(x) {
    const xi = Math.max(1, Math.min(W - 2, Math.round(x)));
    return (curve[xi + 1] - curve[xi - 1]) / 2;
  }

  function getCanvasCoords(e) {
    const rect = cv.getBoundingClientRect();
    const sx = cv.width / rect.width;
    const sy = cv.height / rect.height;
    return { x: (e.clientX - rect.left) * sx, y: (e.clientY - rect.top) * sy };
  }

  cv.addEventListener("pointerdown", (e) => {
    if (won) return;
    if (ball && ball.mode !== "stopped") return;
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
    ball = {
      x: SLING_X,
      y: SLING_Y - 26,
      vx: -aiming.dx * POWER,
      vy: -aiming.dy * POWER,
      mode: "fly",
      stopTime: 0,
    };
    aiming = null;
    attempts += 1;
    playClick();
  }
  cv.addEventListener("pointerup", release);
  cv.addEventListener("pointercancel", () => { aiming = null; cv.style.cursor = "grab"; });

  function tick(now) {
    if (!alive) return;
    const dt = Math.min(0.03, (now - lastT) / 1000);
    lastT = now;

    if (ball && !won) {
      if (ball.mode === "fly") {
        ball.vy += G * dt;
        ball.x += ball.vx * dt;
        ball.y += ball.vy * dt;
        // 지면 충돌
        if (ball.x >= 0 && ball.x < W) {
          const ground = curve[Math.round(ball.x)];
          if (ball.y + PEBBLE_R >= ground) {
            ball.y = ground - PEBBLE_R;
            // 1차원 굴러가기로 변환: 표면 접선 방향 속도 = vx (수평 성분 위주)
            // 충돌 손실 30%
            const slope = slopeAt(ball.x);
            const tangentSpeed = (ball.vx + ball.vy * slope) * 0.7;
            ball.vx = tangentSpeed;
            ball.vy = 0;
            ball.mode = "roll";
            playPop();
          }
        }
        // 화면 밖
        if (ball.y > H + 50 || ball.x < -30 || ball.x > W + 30) {
          ball = null;
          msg2El.textContent = "다시 쏴봐!";
          msg2El.className = "msg";
          mistakes += 1;
        }
      } else if (ball.mode === "roll") {
        const slope = slopeAt(ball.x);
        const ax = G * slope; // tilt = 0
        ball.vx += ax * dt;
        ball.vx *= Math.exp(-FRICTION * dt);
        ball.x += ball.vx * dt;
        ball.x = clamp(ball.x, 12, W - 12);
        ball.y = curve[Math.round(ball.x)] - PEBBLE_R;
        // 정지 판정
        if (Math.abs(ball.vx) < 8) {
          ball.stopTime += dt;
          if (ball.stopTime > 0.5) {
            ball.mode = "stopped";
            // 어느 골짜기에 멈췄나
            const target = valleys[deepestIdx].cx;
            if (Math.abs(ball.x - target) < 35) {
              won = true;
              playGood(); playFanfare();
              msg2El.textContent = "큰 별 자리 도착! 🎉";
              msg2El.className = "msg good";
              burstConfetti(50);
              setTimeout(startRound, 1300);
            } else {
              playBad();
              mistakes += 1;
              msg2El.textContent = "다른 자리야! 다시 쏴봐!";
              msg2El.className = "msg bad";
              // 1초 후 공 사라지고 다시 슬링샷 가능
              setTimeout(() => { if (!won) { ball = null; } }, 900);
            }
          }
        } else {
          ball.stopTime = 0;
        }
      }
    }

    draw();
    requestAnimationFrame(tick);
  }

  function draw() {
    ctx.clearRect(0, 0, W, H);
    // 땅
    ctx.fillStyle = "#88c19a";
    ctx.beginPath();
    ctx.moveTo(0, H);
    for (let x = 0; x < W; x++) ctx.lineTo(x, curve[x]);
    ctx.lineTo(W, H);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = "#3a6b3f";
    ctx.lineWidth = 3;
    ctx.beginPath();
    for (let x = 0; x < W; x++) {
      if (x === 0) ctx.moveTo(x, curve[x]); else ctx.lineTo(x, curve[x]);
    }
    ctx.stroke();
    // 별
    valleys.forEach((v, i) => {
      const isTarget = i === deepestIdx;
      drawStar(v.cx, curve[Math.round(v.cx)] - 22, isTarget ? 16 : 9, isTarget ? "#ffd166" : "#c8c8c8", isTarget ? "#c98a16" : "#888");
    });

    // 새총
    ctx.strokeStyle = "#7a4f1a";
    ctx.lineWidth = 9;
    ctx.lineCap = "round";
    const armY = SLING_Y - 40;
    ctx.beginPath(); ctx.moveTo(SLING_X - 22, armY - 22); ctx.lineTo(SLING_X, SLING_Y); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(SLING_X + 22, armY - 22); ctx.lineTo(SLING_X, SLING_Y); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(SLING_X, SLING_Y); ctx.lineTo(SLING_X, curve[Math.min(W-1, Math.round(SLING_X))]); ctx.stroke();

    // 고무줄/돌
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
      ctx.fillStyle = "#ff5a5f";
      ctx.beginPath(); ctx.arc(px, py, PEBBLE_R, 0, Math.PI*2); ctx.fill();
      ctx.strokeStyle = "#3a2f1e"; ctx.lineWidth = 2; ctx.stroke();
    } else if (!ball || ball.mode === "stopped") {
      // 정지 슬링샷
      ctx.strokeStyle = "#3a2f1e";
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(SLING_X - 22, armY - 22);
      ctx.lineTo(SLING_X, SLING_Y - 26);
      ctx.lineTo(SLING_X + 22, armY - 22);
      ctx.stroke();
      ctx.fillStyle = "#ff5a5f";
      ctx.beginPath(); ctx.arc(SLING_X, SLING_Y - 26, PEBBLE_R, 0, Math.PI*2); ctx.fill();
    }

    // 날아/굴러가는 공
    if (ball) {
      ctx.fillStyle = "#ff5a5f";
      ctx.beginPath(); ctx.arc(ball.x, ball.y, PEBBLE_R, 0, Math.PI*2); ctx.fill();
      ctx.strokeStyle = "#3a2f1e"; ctx.lineWidth = 2; ctx.stroke();
      // 눈
      ctx.fillStyle = "white";
      ctx.beginPath(); ctx.arc(ball.x - 3, ball.y - 2, 2.5, 0, Math.PI*2); ctx.fill();
      ctx.beginPath(); ctx.arc(ball.x + 3, ball.y - 2, 2.5, 0, Math.PI*2); ctx.fill();
      ctx.fillStyle = "black";
      ctx.beginPath(); ctx.arc(ball.x - 3, ball.y - 2, 1.2, 0, Math.PI*2); ctx.fill();
      ctx.beginPath(); ctx.arc(ball.x + 3, ball.y - 2, 1.2, 0, Math.PI*2); ctx.fill();
    }
  }

  function drawStar(cx, cy, size, fill, stroke) {
    ctx.beginPath();
    for (let i = 0; i < 10; i++) {
      const a = (Math.PI * 2 * i) / 10 - Math.PI / 2;
      const r = i % 2 === 0 ? size : size * 0.45;
      const x = cx + Math.cos(a) * r;
      const y = cy + Math.sin(a) * r;
      if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.closePath();
    ctx.fillStyle = fill;
    ctx.fill();
    ctx.strokeStyle = stroke;
    ctx.lineWidth = 2;
    ctx.stroke();
  }

  function finish() {
    cv.style.display = "none";
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
