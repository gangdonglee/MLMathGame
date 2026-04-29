// 게임 1 (v2): 새총 풍선 — 새총을 당겼다 놓아 정답 풍선을 맞히기
// 풍선은 천천히 떠다니고, 돌은 중력 받음 (조준 + 던지기)
import { setStarsIfBetter } from "../shared/score.js";
import { playGood, playBad, playFanfare, playPop, playClick } from "../shared/audio.js";
import { burstConfetti } from "../shared/celebrate.js";

const W = 480;
const H = 480;
const ROUNDS = 5;
const G = 700;            // 돌에 작용하는 중력 (px/s²)
const SLING_X = W / 2;
const SLING_Y = H - 60;
const PEBBLE_R = 9;
const BALLOON_R = 36;
const POWER = 7;          // 드래그 거리 → 발사 속도 배수
const MAX_PULL = 110;
const BALLOON_COLORS = ["#ff8a4c", "#6cb6ff", "#ff9ec7", "#88e0a0", "#b58cff", "#ffd166"];

export function mountGame(container, { gameId, onStarsChange, backToMenu }) {
  let round = 0;
  let mistakes = 0;
  let alive = true;
  let lastT = performance.now();

  const wrap = document.createElement("div");
  wrap.style.cssText = "width:100%;display:flex;flex-direction:column;align-items:center;gap:10px";
  wrap.innerHTML = `
    <div class="equation" id="eq" style="font-size:42px;text-align:center">…</div>
    <canvas id="cv" width="${W}" height="${H}"
            style="background:linear-gradient(#bee5ff,#fff7e6);border-radius:18px;box-shadow:var(--shadow);max-width:100%;height:auto;touch-action:none;cursor:grab"></canvas>
    <div class="time-bar" style="width:100%;max-width:${W}px;height:14px;background:#eee;border-radius:7px;overflow:hidden">
      <div id="time-fill" style="height:100%;background:var(--good);width:100%;transition:width 0.1s linear"></div>
    </div>
    <div class="msg" id="msg">새총을 당겼다 놓아 정답 풍선을 맞혀!</div>
  `;
  container.appendChild(wrap);

  const cv = wrap.querySelector("#cv");
  const ctx = cv.getContext("2d");
  const eqEl = wrap.querySelector("#eq");
  const msgEl = wrap.querySelector("#msg");
  const timeFill = wrap.querySelector("#time-fill");

  const TIME_LIMIT = 12; // 식 1개당 12초
  let balloons = [];
  let answer = 0;
  let pebble = null;
  let aiming = null; // { startX, startY, dx, dy }
  let won = false;
  let timeLeft = TIME_LIMIT;
  let timedOut = false;

  function startRound() {
    if (round >= ROUNDS) { finish(); return; }
    round += 1;
    won = false;
    pebble = null;
    aiming = null;
    timeLeft = TIME_LIMIT;
    timedOut = false;

    const a = randInt(1, 9);
    const b = randInt(1, 9);
    const op = Math.random() < 0.5 || a < b ? "+" : "-";
    answer = op === "+" ? a + b : a - b;
    eqEl.textContent = `${a} ${op} ${b} = ?`;
    msgEl.textContent = "새총을 아래로 당겼다 놓아!";
    msgEl.className = "msg";

    balloons = [];
    const choices = makeChoices(answer, 4);
    choices.forEach((val, i) => {
      const x = (W * (i + 0.5)) / choices.length + (Math.random() - 0.5) * 30;
      const y = 60 + Math.random() * 100;
      balloons.push({
        x, y,
        vx: (Math.random() - 0.5) * 25,
        vy: (Math.random() - 0.5) * 8,
        val,
        color: BALLOON_COLORS[(i + Math.floor(Math.random() * 6)) % BALLOON_COLORS.length],
      });
    });
  }

  function getCanvasCoords(e) {
    const rect = cv.getBoundingClientRect();
    const sx = cv.width / rect.width;
    const sy = cv.height / rect.height;
    return { x: (e.clientX - rect.left) * sx, y: (e.clientY - rect.top) * sy };
  }

  cv.addEventListener("pointerdown", (e) => {
    if (won || pebble) return;
    cv.setPointerCapture(e.pointerId);
    const c = getCanvasCoords(e);
    aiming = { startX: c.x, startY: c.y, dx: 0, dy: 0 };
    cv.style.cursor = "grabbing";
  });
  cv.addEventListener("pointermove", (e) => {
    if (!aiming) return;
    const c = getCanvasCoords(e);
    aiming.dx = clamp(c.x - aiming.startX, -MAX_PULL, MAX_PULL);
    aiming.dy = clamp(c.y - aiming.startY, -20, MAX_PULL);
  });
  function releaseAim() {
    if (!aiming) return;
    cv.style.cursor = "grab";
    // 너무 살짝이면 발사 X
    if (Math.hypot(aiming.dx, aiming.dy) < 12) {
      aiming = null;
      return;
    }
    pebble = {
      x: SLING_X,
      y: SLING_Y - 26,
      vx: -aiming.dx * POWER,
      vy: -aiming.dy * POWER,
    };
    aiming = null;
    playClick();
  }
  cv.addEventListener("pointerup", releaseAim);
  cv.addEventListener("pointercancel", () => { aiming = null; cv.style.cursor = "grab"; });

  function tick(now) {
    if (!alive) return;
    const dt = Math.min(0.04, (now - lastT) / 1000);
    lastT = now;

    // 시간 차감
    if (!won && !timedOut) {
      timeLeft -= dt;
      timeFill.style.width = (Math.max(0, timeLeft / TIME_LIMIT) * 100) + "%";
      timeFill.style.background = timeLeft / TIME_LIMIT < 0.3 ? "var(--bad)" : "var(--good)";
      if (timeLeft <= 0) {
        timedOut = true;
        mistakes += 1;
        playBad();
        msgEl.textContent = "시간 초과! 다시!";
        msgEl.className = "msg bad";
        round -= 1;
        setTimeout(startRound, 1000);
      }
    }

    // 풍선 떠다니기
    for (const b of balloons) {
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      if (b.x < 30) { b.x = 30; b.vx = -b.vx; }
      if (b.x > W - 30) { b.x = W - 30; b.vx = -b.vx; }
      if (b.y < 50) { b.y = 50; b.vy = -b.vy; }
      if (b.y > H - 200) { b.y = H - 200; b.vy = -Math.abs(b.vy); }
    }

    // 돌
    if (pebble) {
      pebble.vy += G * dt;
      pebble.x += pebble.vx * dt;
      pebble.y += pebble.vy * dt;
      // 충돌
      for (const b of balloons) {
        if (Math.hypot(pebble.x - b.x, pebble.y - b.y) < BALLOON_R + PEBBLE_R) {
          if (b.val === answer) {
            won = true;
            playPop(); playGood(); playFanfare();
            burstConfetti(40);
            msgEl.textContent = "맞았어! 🎉";
            msgEl.className = "msg good";
            balloons = balloons.filter((x) => x !== b);
            pebble = null;
            setTimeout(startRound, 1100);
          } else {
            playPop(); playBad();
            msgEl.textContent = "다른 풍선이야!";
            msgEl.className = "msg bad";
            mistakes += 1;
            balloons = balloons.filter((x) => x !== b);
            pebble = null;
            // 정답 풍선이 사라지면 안 됨
            if (!balloons.some((x) => x.val === answer)) {
              balloons.push({
                x: 80 + Math.random() * (W - 160),
                y: 60 + Math.random() * 80,
                vx: (Math.random() - 0.5) * 25,
                vy: (Math.random() - 0.5) * 8,
                val: answer,
                color: BALLOON_COLORS[Math.floor(Math.random() * BALLOON_COLORS.length)],
              });
            }
          }
          break;
        }
      }
      if (pebble && (pebble.y > H + 30 || pebble.x < -30 || pebble.x > W + 30)) pebble = null;
    }

    draw();
    requestAnimationFrame(tick);
  }

  function draw() {
    ctx.clearRect(0, 0, W, H);
    // 땅
    ctx.fillStyle = "#88c19a";
    ctx.fillRect(0, H - 40, W, 40);

    // 풍선
    for (const b of balloons) {
      ctx.strokeStyle = "rgba(0,0,0,0.3)";
      ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(b.x, b.y + BALLOON_R); ctx.lineTo(b.x, b.y + BALLOON_R + 30); ctx.stroke();
      ctx.fillStyle = b.color;
      ctx.beginPath();
      ctx.ellipse(b.x, b.y, BALLOON_R, BALLOON_R * 1.15, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "rgba(255,255,255,0.4)";
      ctx.beginPath(); ctx.ellipse(b.x - 12, b.y - 14, 8, 12, -0.3, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = "white";
      ctx.font = "bold 30px sans-serif";
      ctx.textAlign = "center"; ctx.textBaseline = "middle";
      ctx.fillText(b.val, b.x, b.y);
    }

    // 새총
    const armY = SLING_Y - 40;
    ctx.strokeStyle = "#7a4f1a";
    ctx.lineWidth = 9;
    ctx.lineCap = "round";
    ctx.beginPath(); ctx.moveTo(SLING_X - 22, armY - 22); ctx.lineTo(SLING_X, SLING_Y); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(SLING_X + 22, armY - 22); ctx.lineTo(SLING_X, SLING_Y); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(SLING_X, SLING_Y); ctx.lineTo(SLING_X, H - 40); ctx.stroke();

    // 고무줄 + 돌 (조준 중)
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
      ctx.fillStyle = "#5a4a30";
      ctx.beginPath(); ctx.arc(px, py, PEBBLE_R, 0, Math.PI * 2); ctx.fill();
      // 조준선 (희미하게)
      ctx.strokeStyle = "rgba(255,255,255,0.4)";
      ctx.lineWidth = 2;
      ctx.setLineDash([4, 6]);
      ctx.beginPath(); ctx.moveTo(px, py); ctx.lineTo(SLING_X - aiming.dx, SLING_Y - 26 - aiming.dy); ctx.stroke();
      ctx.setLineDash([]);
    } else if (!pebble) {
      // 정지 상태
      ctx.strokeStyle = "#3a2f1e";
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(SLING_X - 22, armY - 22);
      ctx.lineTo(SLING_X, SLING_Y - 26);
      ctx.lineTo(SLING_X + 22, armY - 22);
      ctx.stroke();
      ctx.fillStyle = "#5a4a30";
      ctx.beginPath(); ctx.arc(SLING_X, SLING_Y - 26, PEBBLE_R, 0, Math.PI * 2); ctx.fill();
    }

    // 날아가는 돌
    if (pebble) {
      ctx.fillStyle = "#5a4a30";
      ctx.beginPath(); ctx.arc(pebble.x, pebble.y, PEBBLE_R, 0, Math.PI * 2); ctx.fill();
    }
  }

  function finish() {
    cv.style.display = "none";
    eqEl.textContent = "🎉 끝!";
    const stars = mistakes === 0 ? 3 : mistakes <= 2 ? 2 : 1;
    msgEl.innerHTML = `별 <b>${"⭐".repeat(stars)}</b> 획득!`;
    msgEl.className = "msg good";
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

function makeChoices(answer, n) {
  const set = new Set([answer]);
  while (set.size < n) {
    const off = randInt(-3, 3);
    const v = answer + off;
    if (v >= 0 && v <= 18) set.add(v);
  }
  return shuffle([...set]);
}
function randInt(a, b) { return a + Math.floor(Math.random() * (b - a + 1)); }
function shuffle(a) { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i+1)); [a[i],a[j]]=[a[j],a[i]]; } return a; }
function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }
