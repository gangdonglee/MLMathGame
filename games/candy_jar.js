// 게임 6 (v3): 사탕 뽑기 — 통을 손가락으로 누르고 있으면 사탕이 일정 간격으로
// 쏟아진다. 떼면 멈춤. 두 통 다 뽑은 뒤 빨간 사탕이 더 많이 나온 통을 콕!
// (v2 버그 fix: 캔버스 클론 안 함. 핸들러는 mountGame 시점에 한 번만 등록)
import { setStarsIfBetter } from "../shared/score.js";
import { playGood, playBad, playFanfare, playPop } from "../shared/audio.js";
import { burstConfetti } from "../shared/celebrate.js";

const ROUNDS = 3;
const POURS_PER_JAR = 8;
const POUR_INTERVAL = 380; // ms
const W = 360;
const H = 380;

export function mountGame(container, { gameId, onStarsChange, backToMenu }) {
  let round = 0;
  let mistakes = 0;
  let alive = true;
  let lastT = performance.now();
  let phase = "pour"; // 'pour' | 'pick' | 'wait'

  const wrap = document.createElement("div");
  wrap.style.cssText = "width:100%;display:flex;flex-direction:column;align-items:center;gap:12px";
  wrap.innerHTML = `
    <div class="msg" id="msg">통을 꾹 누르고 있으면 사탕이 떨어져!</div>
    <div style="display:flex;gap:18px;flex-wrap:wrap;justify-content:center">
      <canvas id="cvA" width="${W}" height="${H}"
              style="background:#fff7e6;border-radius:18px;box-shadow:var(--shadow);max-width:100%;height:auto;touch-action:none;cursor:pointer"></canvas>
      <canvas id="cvB" width="${W}" height="${H}"
              style="background:#fff7e6;border-radius:18px;box-shadow:var(--shadow);max-width:100%;height:auto;touch-action:none;cursor:pointer"></canvas>
    </div>
    <div class="msg" id="msg2"></div>
  `;
  container.appendChild(wrap);

  const msgEl = wrap.querySelector("#msg");
  const msg2El = wrap.querySelector("#msg2");
  const cvA = wrap.querySelector("#cvA");
  const cvB = wrap.querySelector("#cvB");
  const cvs = [cvA, cvB];
  const ctxs = [cvA.getContext("2d"), cvB.getContext("2d")];

  // jars 는 startRound 마다 새로 만들지만 cvs/ctxs 는 한 번만
  let jars = [];
  const isHolding = [false, false];
  const lastPourAt = [0, 0];
  const wobble = [0, 0]; // 시각 효과용

  function startRound() {
    if (round >= ROUNDS) { finish(); return; }
    round += 1;
    msgEl.textContent = `${round} / ${ROUNDS} — 두 통 다 ${POURS_PER_JAR}개씩 쏟자!`;
    msgEl.className = "msg";
    msg2El.textContent = "";
    msg2El.className = "msg";
    phase = "pour";

    let p1 = 0.2 + Math.random() * 0.6;
    let p2 = 0.2 + Math.random() * 0.6;
    while (Math.abs(p1 - p2) < 0.3) p2 = 0.2 + Math.random() * 0.6;
    const ps = [p1, p2];
    if (Math.random() < 0.5) ps.reverse();

    jars = ps.map((p, i) => ({
      redP: p,
      candies: [],
      pours: 0,
      label: i === 0 ? "A" : "B",
    }));
    isHolding[0] = isHolding[1] = false;
    wobble[0] = wobble[1] = 0;
  }

  // === 핸들러는 한 번만 등록 ===
  function setupHandlers(idx) {
    const cv = cvs[idx];
    cv.addEventListener("pointerdown", (e) => {
      cv.setPointerCapture(e.pointerId);
      if (phase === "pour") {
        isHolding[idx] = true;
      } else if (phase === "pick") {
        chooseJar(idx);
      }
    });
    const release = () => { isHolding[idx] = false; };
    cv.addEventListener("pointerup", release);
    cv.addEventListener("pointercancel", release);
    cv.addEventListener("lostpointercapture", release);
    cv.addEventListener("pointerleave", release);
  }
  setupHandlers(0);
  setupHandlers(1);

  function chooseJar(idx) {
    if (phase !== "pick") return;
    phase = "wait";
    const counts = jars.map((x) => x.candies.filter(Boolean).length);
    const winnerIdx = counts[0] === counts[1]
      ? (jars[0].redP > jars[1].redP ? 0 : 1)
      : (counts[0] > counts[1] ? 0 : 1);
    if (idx === winnerIdx) {
      playGood(); playFanfare();
      msg2El.textContent = "맞았어! 🎉";
      msg2El.className = "msg good";
      burstConfetti(40);
      setTimeout(startRound, 1300);
    } else {
      playBad();
      mistakes += 1;
      msg2El.textContent = "다른 통이었어!";
      msg2El.className = "msg bad";
      setTimeout(startRound, 1600);
    }
  }

  function tick(now) {
    if (!alive) return;
    const dt = Math.min(0.05, (now - lastT) / 1000);
    lastT = now;

    if (phase === "pour") {
      for (let i = 0; i < 2; i++) {
        const j = jars[i];
        if (!j) continue;
        if (isHolding[i] && j.pours < POURS_PER_JAR) {
          wobble[i] = Math.min(1, wobble[i] + dt * 4);
          if (now - lastPourAt[i] > POUR_INTERVAL) {
            const isRed = Math.random() < j.redP;
            j.candies.push(isRed);
            j.pours++;
            lastPourAt[i] = now;
            playPop();
          }
        } else {
          wobble[i] = Math.max(0, wobble[i] - dt * 6);
        }
      }
      if (jars.length === 2 && jars.every((j) => j.pours >= POURS_PER_JAR)) {
        phase = "pick";
        msgEl.textContent = "다 쏟았어! 빨간 사탕 더 많은 통을 콕!";
        msgEl.className = "msg good";
      }
    } else if (phase === "wait") {
      wobble[0] = Math.max(0, wobble[0] - dt * 6);
      wobble[1] = Math.max(0, wobble[1] - dt * 6);
    } else if (phase === "pick") {
      // pick 단계에선 작은 흔들림으로 클릭 가능 표시
      wobble[0] = 0.15 + Math.sin(now / 200) * 0.05;
      wobble[1] = 0.15 + Math.cos(now / 200) * 0.05;
    }

    for (let i = 0; i < 2; i++) drawJar(i);
    requestAnimationFrame(tick);
  }

  function drawJar(idx) {
    const ctx = ctxs[idx];
    const j = jars[idx];
    if (!j) return;
    ctx.clearRect(0, 0, W, H);

    // 통 (살짝 흔들림)
    ctx.save();
    const wob = Math.sin(performance.now() / 50 + idx * 1.7) * wobble[idx] * 6;
    ctx.translate(W / 2 + wob, H / 2 - 30);

    const jw = 130, jh = 180;
    // 입구
    ctx.fillStyle = "#9ec5e0";
    ctx.fillRect(-jw / 2 + 10, -jh / 2 - 16, jw - 20, 16);
    // 본체
    ctx.fillStyle = "rgba(140, 200, 230, 0.45)";
    ctx.beginPath();
    ctx.roundRect(-jw / 2, -jh / 2, jw, jh, 16);
    ctx.fill();
    ctx.strokeStyle = "#6699bb";
    ctx.lineWidth = 3;
    ctx.stroke();
    // 라벨
    ctx.fillStyle = "#3a2f1e";
    ctx.font = "bold 36px sans-serif";
    ctx.textAlign = "center"; ctx.textBaseline = "middle";
    ctx.fillText(j.label, 0, 0);

    // 안에 남은 사탕
    const remaining = POURS_PER_JAR - j.pours;
    for (let i = 0; i < remaining; i++) {
      const angle = (i / Math.max(remaining, 1)) * Math.PI * 2;
      const r = 25 + (i % 3) * 8;
      const cx = Math.cos(angle) * r * 0.6;
      const cy = 35 + Math.sin(angle) * r * 0.4;
      ctx.fillStyle = (i + j.label.charCodeAt(0)) % 2 === 0 ? "rgba(255,140,150,0.7)" : "rgba(140,180,255,0.7)";
      ctx.beginPath();
      ctx.arc(cx, cy, 8, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore();

    // 떨어진 사탕
    const baseY = H - 80;
    j.candies.forEach((isRed, i) => {
      const col = i % 5;
      const row = Math.floor(i / 5);
      const px = 30 + col * 40;
      const py = baseY + row * 30;
      ctx.fillStyle = isRed ? "#ff5a5f" : "#5aa5ff";
      ctx.beginPath();
      ctx.arc(px, py, 12, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = "#3a2f1e";
      ctx.lineWidth = 1.5;
      ctx.stroke();
    });

    // 진행 표시
    ctx.fillStyle = "#3a2f1e";
    ctx.font = "bold 18px sans-serif";
    ctx.textAlign = "left";
    ctx.fillText(`${j.pours} / ${POURS_PER_JAR}`, 12, 22);

    if (phase === "pick") {
      ctx.fillStyle = "rgba(255,209,102,0.6)";
      ctx.fillRect(0, 0, W, 6);
      ctx.fillRect(0, H - 6, W, 6);
      ctx.fillStyle = "#3a2f1e";
      ctx.font = "bold 18px sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("이 통? 콕!", W / 2, 22);
    }
  }

  function finish() {
    cvs.forEach((c) => c.style.display = "none");
    msgEl.textContent = "🎉 끝!";
    const stars = mistakes === 0 ? 3 : mistakes <= 1 ? 2 : 1;
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

  const obs = new MutationObserver(() => { if (!document.body.contains(cvA)) { alive = false; obs.disconnect(); } });
  obs.observe(document.body, { childList: true, subtree: true });

  startRound();
  requestAnimationFrame(tick);
}
