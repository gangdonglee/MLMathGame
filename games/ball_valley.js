// 게임 5 (v2): 공 굴리기 — 화면을 좌우로 드래그해 세상을 기울이고, 진짜 물리로
// 공을 굴려 가장 깊은 골짜기(큰 별)에 도착시키기. 그래디언트 직관 + 물리 인터랙션.
import { setStarsIfBetter } from "../shared/score.js";
import { playGood, playBad, playFanfare } from "../shared/audio.js";
import { burstConfetti } from "../shared/celebrate.js";

const W = 640;
const H = 300;
const ROUNDS = 3;
const G = 1400;          // 중력 가속도 (px/s²)
const FRICTION = 1.0;    // 지수 감쇠 계수 (per second). 너무 크면 얕은 골짜기 탈출 불가
const MAX_TILT = 0.45;   // 최대 기울임 (rad ≈ 26°)
const TILT_PER_PX = 0.003;
const TILT_RETURN = 4.0; // 손 뗀 후 수평 복귀 속도 (per second)
const BASE_LINE = 90;    // 평지일 때의 지면 윗선 (캔버스 y)

export function mountGame(container, { gameId, onStarsChange, backToMenu }) {
  let round = 0;
  let alive = true;
  let roundStart = 0;
  let totalElapsed = 0;

  const wrap = document.createElement("div");
  wrap.style.cssText = "width:100%;display:flex;flex-direction:column;align-items:center;gap:14px";
  wrap.innerHTML = `
    <div class="msg" id="msg">화면을 좌우로 끌어 세상을 기울여봐!</div>
    <div id="cv-wrap" style="width:100%;display:flex;justify-content:center;padding:40px 0;overflow:hidden">
      <canvas id="cv" width="${W}" height="${H}"
              style="background:linear-gradient(#bee5ff,#fff7e6);border-radius:18px;box-shadow:var(--shadow);max-width:100%;height:auto;touch-action:none;cursor:grab"></canvas>
    </div>
    <div class="msg" id="msg2"></div>
  `;
  container.appendChild(wrap);

  const cv = wrap.querySelector("#cv");
  const ctx = cv.getContext("2d");
  const msgEl = wrap.querySelector("#msg");
  const msg2El = wrap.querySelector("#msg2");

  let curve, valleys, deepestIdx;
  let ballX, ballV;
  let worldTilt = 0;
  let dragStart = null;
  let settledTime = 0;
  let won = false;
  let lastT = performance.now();

  function startRound() {
    if (round >= ROUNDS) { finish(); return; }
    round += 1;
    won = false;
    settledTime = 0;
    msgEl.textContent = `${round} / ${ROUNDS} — 큰 별 자리로!`;
    msgEl.className = "msg";
    msg2El.textContent = "";
    msg2El.className = "msg";

    const numValleys = round; // 1, 2, 3
    ({ curve, valleys, deepestIdx } = makeTerrain(numValleys));

    // 시작 위치: 가장 깊은 골짜기에서 멀리
    if (numValleys === 1) {
      ballX = valleys[0].cx > W / 2 ? 50 : W - 50;
    } else {
      const others = valleys.map((_, i) => i).filter((i) => i !== deepestIdx);
      const startIdx = others[Math.floor(Math.random() * others.length)];
      ballX = valleys[startIdx].cx;
    }
    ballV = 0;
    worldTilt = 0;
    cv.style.transform = "rotate(0rad)";
    roundStart = performance.now();
  }

  function makeTerrain(numValleys) {
    const valleys = [];
    for (let i = 0; i < numValleys; i++) {
      const cx = W * (0.18 + 0.64 * (i + 0.5) / numValleys + (Math.random() - 0.5) * 0.04);
      const sigma = 55 + Math.random() * 18;
      const depth = 45 + Math.random() * 18; // 얕음(탈출 가능) ~ 중간
      valleys.push({ cx, sigma, depth });
    }
    let deepestIdx = 0;
    for (let i = 1; i < valleys.length; i++) {
      if (valleys[i].depth > valleys[deepestIdx].depth) deepestIdx = i;
    }
    valleys[deepestIdx].depth += 35; // 확실히 더 깊게 (하지만 max tilt 로 탈출 가능 범위)

    // 캔버스 y는 아래로 증가 → 진짜 골짜기는 curve 값이 *커야* 한다.
    // 평지(BASE_LINE)에 가우시안 dip 을 더해 아래로 움푹 파인 모양을 만든다.
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

  // === Pointer 이벤트: 좌우 드래그로 worldTilt 조절 ===
  cv.addEventListener("pointerdown", (e) => {
    if (won) return;
    cv.setPointerCapture(e.pointerId);
    cv.style.cursor = "grabbing";
    dragStart = { clientX: e.clientX, tilt0: worldTilt };
  });
  cv.addEventListener("pointermove", (e) => {
    if (!dragStart) return;
    const dx = e.clientX - dragStart.clientX;
    const newTilt = dragStart.tilt0 + dx * TILT_PER_PX;
    worldTilt = clamp(newTilt, -MAX_TILT, MAX_TILT);
  });
  function endDrag() {
    dragStart = null;
    cv.style.cursor = "grab";
  }
  cv.addEventListener("pointerup", endDrag);
  cv.addEventListener("pointercancel", endDrag);
  cv.addEventListener("lostpointercapture", endDrag);

  // === 애니메이션 루프 ===
  function tick(now) {
    if (!alive) return;
    const dt = Math.min(0.04, (now - lastT) / 1000);
    lastT = now;

    if (!won) {
      // 손 뗀 동안에는 worldTilt 가 0 으로 자동 복귀 (미로 장난감처럼)
      if (!dragStart && worldTilt !== 0) {
        worldTilt *= Math.exp(-TILT_RETURN * dt);
        if (Math.abs(worldTilt) < 0.003) worldTilt = 0;
      }

      // 표면 위 공: 접선 방향 가속 = G * (sin(θ) + cos(θ) * slope_canvas)
      // 도출: 화면이 worldTilt 만큼 회전 → 캔버스 좌표계에서 중력 = (G sin θ, G cos θ)
      // 표면 접선 (+x 방향) 단위벡터 ≈ (1, slope) / sqrt(1+slope²) → 작은 경사 가정으로 단순화
      const slope = slopeAt(ballX);
      const ax = G * (Math.sin(worldTilt) + Math.cos(worldTilt) * slope);
      ballV += ax * dt;
      ballV *= Math.exp(-FRICTION * dt);
      ballX += ballV * dt;

      // 벽 충돌
      if (ballX < 10) { ballX = 10; ballV = -ballV * 0.3; }
      if (ballX > W - 10) { ballX = W - 10; ballV = -ballV * 0.3; }

      // 정착 감지: 큰 별 근처 + 거의 정지 (기울기 조건은 자동 복귀가 처리)
      const target = valleys[deepestIdx].cx;
      if (Math.abs(ballX - target) < 30 && Math.abs(ballV) < 25) {
        settledTime += dt;
        if (settledTime > 0.4) {
          won = true;
          totalElapsed += (performance.now() - roundStart) / 1000;
          msgEl.textContent = "딱! 도착! 🎉";
          msgEl.className = "msg good";
          playFanfare();
          burstConfetti(50);
          worldTilt = 0;
          setTimeout(startRound, 1300);
        }
      } else {
        settledTime = 0;
      }
    }

    cv.style.transform = `rotate(${worldTilt}rad)`;
    draw();
    requestAnimationFrame(tick);
  }

  function draw() {
    ctx.clearRect(0, 0, W, H);

    // 땅 (그라데이션 채우기)
    const grd = ctx.createLinearGradient(0, H * 0.4, 0, H);
    grd.addColorStop(0, "#a8db9c");
    grd.addColorStop(1, "#6fa86a");
    ctx.fillStyle = grd;
    ctx.beginPath();
    ctx.moveTo(0, H);
    for (let x = 0; x < W; x++) ctx.lineTo(x, curve[x]);
    ctx.lineTo(W, H);
    ctx.closePath();
    ctx.fill();

    // 능선 라인
    ctx.strokeStyle = "#3a6b3f";
    ctx.lineWidth = 3;
    ctx.beginPath();
    for (let x = 0; x < W; x++) {
      if (x === 0) ctx.moveTo(x, curve[x]); else ctx.lineTo(x, curve[x]);
    }
    ctx.stroke();

    // 별 (가장 깊은 = 큼+노랑, 나머지 = 작음+회색)
    valleys.forEach((v, i) => {
      const isTarget = i === deepestIdx;
      const cy = curve[Math.round(v.cx)] - 20;
      drawStar(v.cx, cy, isTarget ? 16 : 9, isTarget ? "#ffd166" : "#c8c8c8", isTarget ? "#c98a16" : "#888");
    });

    // 공
    const by = curve[Math.round(clamp(ballX, 1, W - 2))] - 14;
    // 그림자
    ctx.fillStyle = "rgba(0,0,0,0.18)";
    ctx.beginPath();
    ctx.ellipse(ballX, curve[Math.round(clamp(ballX, 1, W - 2))], 14, 4, 0, 0, Math.PI * 2);
    ctx.fill();
    // 본체
    const ballGrd = ctx.createRadialGradient(ballX - 4, by - 4, 2, ballX, by, 14);
    ballGrd.addColorStop(0, "#ff8a8e");
    ballGrd.addColorStop(1, "#e34a4f");
    ctx.fillStyle = ballGrd;
    ctx.beginPath();
    ctx.arc(ballX, by, 14, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "#3a2f1e";
    ctx.lineWidth = 2;
    ctx.stroke();
    // 눈
    ctx.fillStyle = "white";
    ctx.beginPath(); ctx.arc(ballX - 4, by - 3, 3, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(ballX + 4, by - 3, 3, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "black";
    // 눈동자가 진행 방향을 봄
    const eyeOffset = clamp(ballV * 0.005, -1.2, 1.2);
    ctx.beginPath(); ctx.arc(ballX - 4 + eyeOffset, by - 3, 1.5, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(ballX + 4 + eyeOffset, by - 3, 1.5, 0, Math.PI * 2); ctx.fill();
    // 입 (속도가 빠르면 신난 표정)
    ctx.strokeStyle = "#3a2f1e";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    if (Math.abs(ballV) > 80) {
      ctx.arc(ballX, by + 3, 2.5, 0, Math.PI);
    } else {
      ctx.moveTo(ballX - 2, by + 4);
      ctx.lineTo(ballX + 2, by + 4);
    }
    ctx.stroke();

    // 기울임 표시 (하단 좌우 화살표 게이지)
    if (Math.abs(worldTilt) > 0.02) {
      ctx.fillStyle = "rgba(58,47,30,0.45)";
      ctx.font = "20px sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      const ratio = worldTilt / MAX_TILT;
      const barW = 120;
      const barX = W / 2;
      const barY = 22;
      ctx.fillStyle = "rgba(255,255,255,0.6)";
      ctx.fillRect(barX - barW / 2, barY - 6, barW, 12);
      ctx.fillStyle = "#ff8a4c";
      const fill = (barW / 2) * Math.abs(ratio);
      if (ratio > 0) ctx.fillRect(barX, barY - 6, fill, 12);
      else ctx.fillRect(barX - fill, barY - 6, fill, 12);
      ctx.fillStyle = "#3a2f1e";
      ctx.fillRect(barX - 1, barY - 8, 2, 16);
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
    let stars;
    if (totalElapsed < 60) stars = 3;
    else if (totalElapsed < 150) stars = 2;
    else stars = 1;
    msg2El.innerHTML = `별 <b>${"⭐".repeat(stars)}</b> 획득! (총 ${totalElapsed.toFixed(1)}초)`;
    msg2El.className = "msg good";
    if (setStarsIfBetter(gameId, stars)) onStarsChange();
    burstConfetti();
    const btn = document.createElement("button");
    btn.className = "btn";
    btn.textContent = "또 할래";
    btn.addEventListener("click", () => { container.innerHTML = ""; mountGame(container, { gameId, onStarsChange, backToMenu }); });
    wrap.appendChild(btn);
  }

  // 언마운트 감지
  const obs = new MutationObserver(() => {
    if (!document.body.contains(cv)) { alive = false; obs.disconnect(); }
  });
  obs.observe(document.body, { childList: true, subtree: true });

  startRound();
  requestAnimationFrame(tick);
}

function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }
