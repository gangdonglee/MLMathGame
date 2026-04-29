// 게임 5: 공을 골짜기로 — 좌/우 버튼으로 공을 굴려 가장 깊은 골짜기로 (그래디언트 직관)
import { setStarsIfBetter } from "../shared/score.js";
import { playGood, playBad, playFanfare, playClick } from "../shared/audio.js";
import { burstConfetti } from "../shared/celebrate.js";

const W = 360;
const H = 240;
const ROUNDS = 3;

export function mountGame(container, { gameId, onStarsChange, backToMenu }) {
  let round = 0;
  let totalSteps = 0;

  const wrap = document.createElement("div");
  wrap.style.width = "100%";
  wrap.style.display = "flex";
  wrap.style.flexDirection = "column";
  wrap.style.alignItems = "center";
  wrap.style.gap = "14px";
  wrap.innerHTML = `
    <div class="msg" id="msg">화살표를 눌러 가장 깊은 곳으로!</div>
    <canvas id="cv" width="${W}" height="${H}" style="background:linear-gradient(#e8f4ff,#fff7e6);border-radius:18px;box-shadow:var(--shadow);max-width:100%;height:auto"></canvas>
    <div style="display:flex;gap:18px">
      <button class="btn" id="left">⬅</button>
      <button class="btn" id="right">➡</button>
    </div>
  `;
  container.appendChild(wrap);

  const cv = wrap.querySelector("#cv");
  const ctx = cv.getContext("2d");
  const msgEl = wrap.querySelector("#msg");

  let curve, ballX, valleyX, won;

  function startRound() {
    if (round >= ROUNDS) { finish(); return; }
    round += 1;
    won = false;
    msgEl.textContent = `${round} / ${ROUNDS} 라운드`;
    msgEl.className = "msg";
    // 1~3개의 골짜기를 만든 다음 가장 깊은 곳을 valleyX 로
    curve = makeCurve(round);
    valleyX = findValley(curve);
    // 시작 위치는 valleyX 와 떨어진 곳
    ballX = valleyX < W / 2 ? W * 0.85 : W * 0.15;
    draw();
  }

  function makeCurve(level) {
    // y(x) = base - sum of gaussians (작은 골짜기 여러 개)
    const peaks = [];
    const count = level === 1 ? 1 : level === 2 ? 2 : 3;
    for (let i = 0; i < count; i++) {
      peaks.push({
        cx: W * (0.2 + 0.6 * (i + 0.5) / count + (Math.random() - 0.5) * 0.1),
        sigma: 30 + Math.random() * 30,
        depth: 30 + Math.random() * 50,
      });
    }
    const ys = new Array(W);
    for (let x = 0; x < W; x++) {
      let dip = 0;
      for (const p of peaks) {
        const d = (x - p.cx) / p.sigma;
        dip += p.depth * Math.exp(-0.5 * d * d);
      }
      ys[x] = H - 40 - dip;
    }
    return ys;
  }

  function findValley(ys) {
    let bestX = 0;
    for (let x = 1; x < ys.length; x++) if (ys[x] > ys[bestX]) bestX = x;
    return bestX;
  }

  function slopeAt(x) {
    const xi = Math.max(1, Math.min(W - 2, Math.round(x)));
    return (curve[xi + 1] - curve[xi - 1]) / 2;
  }

  function move(dir) {
    if (won) return;
    playClick();
    const step = 18;
    ballX = Math.max(8, Math.min(W - 8, ballX + dir * step));
    totalSteps += 1;
    draw();
    if (Math.abs(ballX - valleyX) < 14) {
      won = true;
      msgEl.textContent = "골짜기 도착! 🎉";
      msgEl.className = "msg good";
      playFanfare();
      burstConfetti(40);
      setTimeout(startRound, 1100);
    } else {
      // 잘못된 방향(오르막)이면 살짝 부정 피드백
      const slope = slopeAt(ballX);
      // curve 값이 클수록 깊음. 우리가 +x 로 가면서 curve 가 줄면(=얕아지면) 잘못된 방향
      // 즉, dir 과 sign(slope) 가 같으면 내리막(좋음), 반대면 오르막(나쁨)
      if (Math.sign(slope) === Math.sign(-dir)) {
        // 오르막을 갔음
        playBad();
      } else {
        playGood();
      }
    }
  }

  wrap.querySelector("#left").addEventListener("click", () => move(-1));
  wrap.querySelector("#right").addEventListener("click", () => move(1));

  function draw() {
    ctx.clearRect(0, 0, W, H);
    // ground
    ctx.fillStyle = "#88c19a";
    ctx.beginPath();
    ctx.moveTo(0, H);
    for (let x = 0; x < W; x++) ctx.lineTo(x, curve[x]);
    ctx.lineTo(W, H);
    ctx.closePath();
    ctx.fill();
    // ground line
    ctx.strokeStyle = "#4f8c66";
    ctx.lineWidth = 3;
    ctx.beginPath();
    for (let x = 0; x < W; x++) {
      if (x === 0) ctx.moveTo(x, curve[x]); else ctx.lineTo(x, curve[x]);
    }
    ctx.stroke();
    // valley flag
    const fy = curve[valleyX];
    ctx.strokeStyle = "#3a2f1e";
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(valleyX, fy); ctx.lineTo(valleyX, fy - 32); ctx.stroke();
    ctx.fillStyle = "#ff8a4c";
    ctx.beginPath(); ctx.moveTo(valleyX, fy - 32); ctx.lineTo(valleyX + 16, fy - 26); ctx.lineTo(valleyX, fy - 20); ctx.closePath(); ctx.fill();
    // ball
    const by = curve[Math.round(ballX)] - 12;
    ctx.fillStyle = "#ff5a5f";
    ctx.beginPath(); ctx.arc(ballX, by, 12, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = "#3a2f1e"; ctx.lineWidth = 2; ctx.stroke();
    // slope hint arrow
    const slope = slopeAt(ballX);
    if (Math.abs(slope) > 0.05) {
      const dir = slope > 0 ? 1 : -1; // curve 값이 늘어나는 방향이 내리막
      ctx.fillStyle = "rgba(58,47,30,0.4)";
      ctx.font = "26px serif";
      ctx.textAlign = "center";
      ctx.fillText(dir > 0 ? "→" : "←", ballX + dir * 28, by - 24);
    }
  }

  function finish() {
    cv.style.display = "none";
    wrap.querySelector("div[style*='gap:18px']").style.display = "none";
    const stars = totalSteps <= 12 ? 3 : totalSteps <= 20 ? 2 : 1;
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

  startRound();
}
