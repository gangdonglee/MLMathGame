// 게임 3 (v3): 다음에 올 건? — Simon 풍. 색깔 시퀀스를 보여주면 똑같이 따라하기
// (패턴 = 시간 순서 규칙. 시각+청각 시퀀스로 액션화)
import { setStarsIfBetter } from "../shared/score.js";
import { playGood, playBad, playFanfare } from "../shared/audio.js";
import { burstConfetti } from "../shared/celebrate.js";

const PADS = [
  { color: "#ff5a5f", lit: "#ffb0b3", freq: 261.63 }, // C4
  { color: "#5aa5ff", lit: "#b0d0ff", freq: 329.63 }, // E4
  { color: "#5acc77", lit: "#b0e6c0", freq: 392.00 }, // G4
  { color: "#ffce40", lit: "#ffe79c", freq: 523.25 }, // C5
];
const ROUNDS = 5; // sequence length: 2,3,4,5,6

let audioCtx = null;
function tone(freq, dur = 0.35) {
  try {
    if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    const t0 = audioCtx.currentTime;
    const osc = audioCtx.createOscillator();
    const g = audioCtx.createGain();
    osc.type = "triangle";
    osc.frequency.setValueAtTime(freq, t0);
    g.gain.setValueAtTime(0, t0);
    g.gain.linearRampToValueAtTime(0.18, t0 + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(g).connect(audioCtx.destination);
    osc.start(t0);
    osc.stop(t0 + dur + 0.05);
  } catch {}
}

export function mountGame(container, { gameId, onStarsChange, backToMenu }) {
  let round = 0;
  let mistakes = 0;
  let alive = true;
  let sequence = [];
  let userIndex = 0;
  let isShowing = false;
  let attemptCount = 0;

  const wrap = document.createElement("div");
  wrap.style.cssText = "width:100%;display:flex;flex-direction:column;align-items:center;gap:14px";
  wrap.innerHTML = `
    <div class="msg" id="msg">잘 보고 똑같이 눌러봐!</div>
    <div id="pad-grid" style="display:grid;grid-template-columns:repeat(2,140px);grid-template-rows:repeat(2,140px);gap:14px;touch-action:manipulation"></div>
    <div class="msg" id="msg2"></div>
  `;
  container.appendChild(wrap);

  const grid = wrap.querySelector("#pad-grid");
  const msgEl = wrap.querySelector("#msg");
  const msg2El = wrap.querySelector("#msg2");

  const padEls = PADS.map((p, i) => {
    const el = document.createElement("button");
    el.className = "simon-pad";
    el.style.cssText = `background:${p.color};border:none;border-radius:24px;box-shadow:var(--shadow);cursor:pointer;transition:background 0.1s ease, transform 0.05s ease;font-family:inherit;`;
    el.dataset.idx = i;
    el.addEventListener("pointerdown", () => onUserTap(i));
    grid.appendChild(el);
    return el;
  });

  function flashPad(i, dur = 380) {
    const el = padEls[i];
    el.style.background = PADS[i].lit;
    el.style.transform = "scale(0.95)";
    tone(PADS[i].freq, dur / 1000);
    setTimeout(() => {
      el.style.background = PADS[i].color;
      el.style.transform = "";
    }, dur);
  }

  function startRound() {
    if (round >= ROUNDS) { finish(); return; }
    round += 1;
    attemptCount = 0;
    const length = round + 1; // 2,3,4,5,6
    sequence = [];
    let last = -1;
    for (let i = 0; i < length; i++) {
      let n;
      do { n = Math.floor(Math.random() * 4); } while (n === last && Math.random() < 0.5);
      sequence.push(n);
      last = n;
    }
    msgEl.textContent = `${round} / ${ROUNDS} — 잘 봐!`;
    msgEl.className = "msg";
    msg2El.textContent = "";
    msg2El.className = "msg";
    setTimeout(showSequence, 600);
  }

  function showSequence() {
    isShowing = true;
    msgEl.textContent = "잘 봐!";
    let i = 0;
    const tick = () => {
      if (!alive) return;
      if (i >= sequence.length) {
        isShowing = false;
        userIndex = 0;
        msgEl.textContent = "이제 너 차례! 똑같이 눌러봐";
        return;
      }
      flashPad(sequence[i], 400);
      i++;
      setTimeout(tick, 600);
    };
    tick();
  }

  function onUserTap(i) {
    if (isShowing || !alive) return;
    flashPad(i, 200);
    if (i === sequence[userIndex]) {
      userIndex++;
      if (userIndex >= sequence.length) {
        playGood(); playFanfare();
        msg2El.textContent = "맞았어! 🎉";
        msg2El.className = "msg good";
        burstConfetti(30);
        setTimeout(startRound, 900);
      }
    } else {
      playBad();
      mistakes += 1;
      attemptCount += 1;
      userIndex = 0;
      msg2El.textContent = "앗! 다시 보여줄게";
      msg2El.className = "msg bad";
      setTimeout(showSequence, 1100);
    }
  }

  function finish() {
    grid.style.display = "none";
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

  const obs = new MutationObserver(() => { if (!document.body.contains(grid)) { alive = false; obs.disconnect(); } });
  obs.observe(document.body, { childList: true, subtree: true });

  startRound();
}

function playGoodLocal() {} // unused but kept for symmetry
