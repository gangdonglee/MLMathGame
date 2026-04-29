// 게임 6 (v2): 사탕 뽑기 — 통을 손가락으로 좌/우로 기울여 사탕을 쏟고
// 빨간 사탕이 더 많이 나오는 통을 골라 (확률 = 반복 시행의 빈도)
import { setStarsIfBetter } from "../shared/score.js";
import { playGood, playBad, playFanfare, playClick, playPop } from "../shared/audio.js";
import { burstConfetti } from "../shared/celebrate.js";

const ROUNDS = 3;
const POURS_PER_JAR = 8;
const TILT_THRESHOLD = 0.5;     // rad. 이 이상 기울여야 사탕 떨어짐
const POUR_INTERVAL = 350;      // ms. 기울여 있는 동안 사탕 1개씩 떨어지는 간격
const W = 360;
const H = 380;

export function mountGame(container, { gameId, onStarsChange, backToMenu }) {
  let round = 0;
  let mistakes = 0;
  let alive = true;
  let lastT = performance.now();

  const wrap = document.createElement("div");
  wrap.style.cssText = "width:100%;display:flex;flex-direction:column;align-items:center;gap:12px";
  wrap.innerHTML = `
    <div class="msg" id="msg">통을 좌우로 끌어서 기울여! 사탕이 떨어져!</div>
    <div style="display:flex;gap:18px;flex-wrap:wrap;justify-content:center">
      <canvas id="cvA" width="${W}" height="${H}"
              style="background:#fff7e6;border-radius:18px;box-shadow:var(--shadow);max-width:100%;height:auto;touch-action:none"></canvas>
      <canvas id="cvB" width="${W}" height="${H}"
              style="background:#fff7e6;border-radius:18px;box-shadow:var(--shadow);max-width:100%;height:auto;touch-action:none"></canvas>
    </div>
    <div class="msg" id="msg2"></div>
  `;
  container.appendChild(wrap);

  const msgEl = wrap.querySelector("#msg");
  const msg2El = wrap.querySelector("#msg2");
  const cvs = [wrap.querySelector("#cvA"), wrap.querySelector("#cvB")];

  let jars; // [{ canvas, ctx, redP, candies: [], pours, tilt, dragStart, label }]
  let phase; // "pour" | "pick" | "wait"

  function startRound() {
    if (round >= ROUNDS) { finish(); return; }
    round += 1;
    msgEl.textContent = `${round} / ${ROUNDS} — 통을 기울여 사탕 ${POURS_PER_JAR}개씩 쏟자`;
    msgEl.className = "msg";
    msg2El.textContent = "";
    msg2El.className = "msg";
    phase = "pour";

    // 두 통의 빨간 비율 차이를 충분히
    let p1 = 0.2 + Math.random() * 0.6;
    let p2 = 0.2 + Math.random() * 0.6;
    while (Math.abs(p1 - p2) < 0.3) p2 = 0.2 + Math.random() * 0.6;
    const pair = [p1, p2];
    if (Math.random() < 0.5) pair.reverse();

    jars = pair.map((p, i) => ({
      canvas: cvs[i],
      ctx: cvs[i].getContext("2d"),
      redP: p,
      candies: [],
      pours: 0,
      tilt: 0,
      dragStart: null,
      lastPourAt: 0,
      label: i === 0 ? "A" : "B",
    }));

    jars.forEach((j) => attachJarPointer(j));
  }

  function attachJarPointer(j) {
    // 기존 리스너 모두 제거하기 위해 캔버스를 클론으로 교체
    const newCv = j.canvas.cloneNode(true);
    j.canvas.parentNode.replaceChild(newCv, j.canvas);
    j.canvas = newCv;
    j.ctx = newCv.getContext("2d");

    newCv.addEventListener("pointerdown", (e) => {
      if (phase !== "pour" && phase !== "pick") return;
      newCv.setPointerCapture(e.pointerId);
      if (phase === "pick") {
        chooseJar(j);
        return;
      }
      j.dragStart = { x: e.clientX, tilt0: j.tilt };
      playClick();
    });
    newCv.addEventListener("pointermove", (e) => {
      if (!j.dragStart || phase !== "pour") return;
      const dx = e.clientX - j.dragStart.x;
      j.tilt = clamp(j.dragStart.tilt0 + dx * 0.006, -1.0, 1.0);
    });
    const end = () => { j.dragStart = null; };
    newCv.addEventListener("pointerup", end);
    newCv.addEventListener("pointercancel", end);
    newCv.addEventListener("lostpointercapture", end);
  }

  function chooseJar(j) {
    if (phase !== "pick") return;
    phase = "wait";
    const counts = jars.map((x) => x.candies.filter(Boolean).length);
    const winnerIdx = counts[0] === counts[1]
      ? (jars[0].redP > jars[1].redP ? 0 : 1)
      : (counts[0] > counts[1] ? 0 : 1);
    const pickedIdx = jars.indexOf(j);
    if (pickedIdx === winnerIdx) {
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
      for (const j of jars) {
        // 손 떼면 기울기 천천히 0 으로
        if (!j.dragStart && j.tilt !== 0) {
          j.tilt *= Math.exp(-3 * dt);
          if (Math.abs(j.tilt) < 0.02) j.tilt = 0;
        }
        // 충분히 기울여 있으면 일정 간격으로 사탕 떨어짐
        if (Math.abs(j.tilt) > TILT_THRESHOLD && j.pours < POURS_PER_JAR) {
          if (now - j.lastPourAt > POUR_INTERVAL) {
            const isRed = Math.random() < j.redP;
            j.candies.push(isRed);
            j.pours++;
            j.lastPourAt = now;
            playPop();
          }
        }
      }
      if (jars.every((j) => j.pours >= POURS_PER_JAR)) {
        phase = "pick";
        msgEl.textContent = "다 쏟았어! 빨간 사탕이 더 많은 통을 콕!";
        msgEl.className = "msg good";
      }
    }

    for (const j of jars) drawJar(j);
    requestAnimationFrame(tick);
  }

  function drawJar(j) {
    const ctx = j.ctx;
    ctx.clearRect(0, 0, W, H);

    // 통은 화면 중앙에서 회전
    ctx.save();
    ctx.translate(W / 2, H / 2 - 20);
    ctx.rotate(j.tilt);

    // 통 몸체
    const jw = 130, jh = 180;
    // 입구 (위에 좁은 부분)
    ctx.fillStyle = "#9ec5e0";
    ctx.fillRect(-jw / 2 + 10, -jh / 2 - 18, jw - 20, 18);
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
    ctx.font = "bold 28px sans-serif";
    ctx.textAlign = "center"; ctx.textBaseline = "middle";
    ctx.fillText(`통 ${j.label}`, 0, 0);

    // 통 안쪽에 남은 사탕 (POURS_PER_JAR 만큼 시각적으로)
    const remaining = POURS_PER_JAR - j.pours;
    for (let i = 0; i < remaining; i++) {
      const angle = (i / Math.max(remaining, 1)) * Math.PI * 2;
      const r = 25 + (i % 3) * 8;
      const cx = Math.cos(angle) * r * 0.6;
      const cy = 30 + Math.sin(angle) * r * 0.4;
      ctx.fillStyle = (i + j.label.charCodeAt(0)) % 2 === 0 ? "rgba(255,140,150,0.7)" : "rgba(140,180,255,0.7)";
      ctx.beginPath();
      ctx.arc(cx, cy, 7, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore();

    // 떨어진 사탕들 — 통 밖, 회전과 무관
    const baseY = H - 70;
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

    // 진행도 + 안내
    ctx.fillStyle = "#3a2f1e";
    ctx.font = "bold 18px sans-serif";
    ctx.textAlign = "left";
    ctx.fillText(`${j.pours} / ${POURS_PER_JAR}`, 12, 20);

    if (phase === "pick") {
      ctx.fillStyle = "rgba(255,209,102,0.7)";
      ctx.fillRect(0, 0, W, 4);
      ctx.fillRect(0, H - 4, W, 4);
      ctx.fillStyle = "#3a2f1e";
      ctx.textAlign = "center";
      ctx.fillText("이 통? 콕!", W / 2, 20);
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

  const obs = new MutationObserver(() => { if (!document.body.contains(cvs[0])) { alive = false; obs.disconnect(); } });
  obs.observe(document.body, { childList: true, subtree: true });

  startRound();
  requestAnimationFrame(tick);
}

function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }
