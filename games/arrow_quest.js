// 게임 4 (v3): 별 모으기 — 손가락 위치 = 캐릭터 위치. 시간 안에 별 모두 모으기
// (벡터 = 위치 = 손끝의 누적 이동. 직접 조종 + 시간 압박으로 액션화)
import { setStarsIfBetter } from "../shared/score.js";
import { playGood, playBad, playFanfare, playPop } from "../shared/audio.js";
import { burstConfetti } from "../shared/celebrate.js";

const W = 360;
const H = 360;
const ROUNDS = 4;
const CHAR_R = 20;
const STAR_R = 18;

export function mountGame(container, { gameId, onStarsChange, backToMenu }) {
  let round = 0;
  let mistakes = 0;
  let alive = true;
  let lastT = performance.now();

  const wrap = document.createElement("div");
  wrap.style.cssText = "width:100%;display:flex;flex-direction:column;align-items:center;gap:12px";
  wrap.innerHTML = `
    <div class="msg" id="msg">손가락으로 토끼를 움직여 별을 모두 모아!</div>
    <canvas id="cv" width="${W}" height="${H}"
            style="background:linear-gradient(#bee5ff,#fff7e6);border-radius:18px;box-shadow:var(--shadow);max-width:100%;height:auto;touch-action:none;cursor:grab"></canvas>
    <div id="time-bar" style="width:100%;max-width:${W}px;height:14px;background:#eee;border-radius:7px;overflow:hidden">
      <div id="time-fill" style="height:100%;background:var(--good);width:100%;transition:width 0.1s linear"></div>
    </div>
    <div class="msg" id="msg2"></div>
  `;
  container.appendChild(wrap);

  const cv = wrap.querySelector("#cv");
  const ctx = cv.getContext("2d");
  const timeFill = wrap.querySelector("#time-fill");
  const msgEl = wrap.querySelector("#msg");
  const msg2El = wrap.querySelector("#msg2");

  let charX = W / 2, charY = H / 2;
  let stars = [];
  let timeLimit = 0;
  let timeLeft = 0;
  let won = false;

  function startRound() {
    if (round >= ROUNDS) { finish(); return; }
    round += 1;
    won = false;
    msgEl.textContent = `${round} / ${ROUNDS} — 별 모두 모아!`;
    msgEl.className = "msg";
    msg2El.textContent = "";
    msg2El.className = "msg";

    const starCount = 2 + Math.min(round, 4);
    timeLimit = 4 + starCount * 1.2; // 시간은 별 수에 비례
    timeLeft = timeLimit;

    charX = W / 2; charY = H - 40;

    stars = [];
    while (stars.length < starCount) {
      const x = 30 + Math.random() * (W - 60);
      const y = 30 + Math.random() * (H - 80);
      if (Math.hypot(x - charX, y - charY) < STAR_R + CHAR_R + 10) continue;
      if (stars.some((s) => Math.hypot(x - s.x, y - s.y) < STAR_R * 3)) continue;
      stars.push({ x, y, collected: false });
    }
  }

  function getCanvasCoords(e) {
    const rect = cv.getBoundingClientRect();
    const sx = cv.width / rect.width;
    const sy = cv.height / rect.height;
    return { x: (e.clientX - rect.left) * sx, y: (e.clientY - rect.top) * sy };
  }

  cv.addEventListener("pointerdown", (e) => {
    if (won) return;
    cv.setPointerCapture(e.pointerId);
    const c = getCanvasCoords(e);
    charX = c.x; charY = c.y;
    cv.style.cursor = "grabbing";
  });
  cv.addEventListener("pointermove", (e) => {
    if (e.buttons === 0 && e.pointerType === "mouse") return;
    const c = getCanvasCoords(e);
    charX = c.x; charY = c.y;
  });
  cv.addEventListener("pointerup", () => { cv.style.cursor = "grab"; });
  cv.addEventListener("pointercancel", () => { cv.style.cursor = "grab"; });

  function tick(now) {
    if (!alive) return;
    const dt = Math.min(0.04, (now - lastT) / 1000);
    lastT = now;

    if (!won) {
      timeLeft -= dt;
      // 별 충돌
      for (const s of stars) {
        if (!s.collected && Math.hypot(charX - s.x, charY - s.y) < CHAR_R + STAR_R) {
          s.collected = true;
          playPop(); playGood();
        }
      }
      const remaining = stars.filter((s) => !s.collected).length;
      if (remaining === 0) {
        won = true;
        msg2El.textContent = "다 모았다! 🎉";
        msg2El.className = "msg good";
        playFanfare();
        burstConfetti(40);
        setTimeout(startRound, 1100);
      } else if (timeLeft <= 0) {
        // 시간 초과 → 그 라운드 mistakes++ 하고 다시
        mistakes += 1;
        msg2El.textContent = "다시!";
        msg2El.className = "msg bad";
        playBad();
        round -= 1;
        setTimeout(startRound, 1100);
        won = true; // 일시 중지
      }
      timeFill.style.width = (Math.max(0, timeLeft / timeLimit) * 100) + "%";
      timeFill.style.background = timeLeft / timeLimit < 0.3 ? "var(--bad)" : "var(--good)";
    }

    draw();
    requestAnimationFrame(tick);
  }

  function draw() {
    ctx.clearRect(0, 0, W, H);
    // 별
    for (const s of stars) {
      if (s.collected) continue;
      drawStar(s.x, s.y, STAR_R, "#ffd166", "#c98a16");
      // 끌어당기는 듯한 펄스
      ctx.strokeStyle = "rgba(255,209,102,0.5)";
      ctx.lineWidth = 2;
      const pulse = STAR_R + 4 + Math.sin(performance.now() / 200 + s.x) * 3;
      ctx.beginPath(); ctx.arc(s.x, s.y, pulse, 0, Math.PI*2); ctx.stroke();
    }
    // 토끼
    ctx.font = "44px serif";
    ctx.textAlign = "center"; ctx.textBaseline = "middle";
    ctx.fillText("🐰", charX, charY + 2);
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
    timeFill.parentElement.style.display = "none";
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
