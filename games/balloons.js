// 게임 1: 숫자 풍선 — 식의 답이 적힌 풍선을 터뜨리기
import { setStarsIfBetter } from "../shared/score.js";
import { playGood, playBad, playPop, playFanfare } from "../shared/audio.js";
import { burstConfetti } from "../shared/celebrate.js";

const ROUNDS = 5;
const BALLOON_COLORS = ["#ff8a4c", "#6cb6ff", "#ff9ec7", "#88e0a0", "#b58cff", "#ffd166"];

export function mountGame(container, { gameId, onStarsChange, backToMenu }) {
  let round = 0;
  let correct = 0;
  let mistakes = 0;
  let cleanup = () => {};

  const wrap = document.createElement("div");
  wrap.style.width = "100%";
  wrap.innerHTML = `
    <div class="equation" id="eq">…</div>
    <div class="balloon-stage" id="stage"></div>
    <div class="msg" id="msg"></div>
  `;
  container.appendChild(wrap);

  const stage = wrap.querySelector("#stage");
  const eqEl = wrap.querySelector("#eq");
  const msgEl = wrap.querySelector("#msg");

  function nextRound() {
    cleanup();
    if (round >= ROUNDS) {
      finish();
      return;
    }
    round += 1;
    const a = randInt(1, 9);
    const b = randInt(1, 9);
    const op = Math.random() < 0.5 || a < b ? "+" : "-";
    const answer = op === "+" ? a + b : a - b;
    eqEl.textContent = `${a} ${op} ${b} = ?`;
    msgEl.textContent = "";
    msgEl.className = "msg";

    const choices = makeChoices(answer, 4);
    spawnBalloons(choices, answer);
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

  function spawnBalloons(choices, answer) {
    const stageRect = stage.getBoundingClientRect();
    const W = stageRect.width;
    const balloons = [];
    const lanes = choices.length;
    const laneW = W / lanes;

    choices.forEach((val, i) => {
      const b = document.createElement("div");
      b.className = "balloon";
      b.textContent = val;
      b.style.background = BALLOON_COLORS[(i + Math.floor(Math.random() * 6)) % BALLOON_COLORS.length];
      const left = laneW * i + (laneW - 96) / 2 + (Math.random() - 0.5) * 16;
      b.style.left = `${left}px`;
      const dur = 7 + Math.random() * 3;
      b.style.animationDuration = `${dur}s`;
      b.style.animationDelay = `${i * 0.4}s`;
      b.addEventListener("click", () => onPick(val, answer, b));
      stage.appendChild(b);
      balloons.push(b);
    });

    cleanup = () => {
      balloons.forEach((b) => b.remove());
    };

    // 시간 초과: 가장 늦은 풍선 + 여유
    const timeout = setTimeout(() => {
      if (round <= ROUNDS) {
        msgEl.textContent = "다시 해보자!";
        msgEl.className = "msg bad";
        mistakes += 1;
        nextRound();
      }
    }, 12000);
    const prevCleanup = cleanup;
    cleanup = () => { clearTimeout(timeout); prevCleanup(); };
  }

  function onPick(val, answer, el) {
    if (val === answer) {
      playPop();
      el.classList.add("pop");
      correct += 1;
      msgEl.textContent = "잘했어! 🎉";
      msgEl.className = "msg good";
      playGood();
      setTimeout(nextRound, 700);
    } else {
      playBad();
      el.classList.add("shake");
      mistakes += 1;
      setTimeout(() => el.classList.remove("shake"), 400);
    }
  }

  function finish() {
    eqEl.textContent = "🎉 끝!";
    stage.innerHTML = "";
    const stars = mistakes === 0 ? 3 : mistakes <= 2 ? 2 : 1;
    msgEl.innerHTML = `별 <b>${"⭐".repeat(stars)}</b> 획득!`;
    msgEl.className = "msg good";
    if (setStarsIfBetter(gameId, stars)) onStarsChange();
    playFanfare();
    burstConfetti();
    setTimeout(() => {
      const btn = document.createElement("button");
      btn.className = "btn";
      btn.textContent = "또 할래";
      btn.style.marginTop = "16px";
      btn.addEventListener("click", () => { container.innerHTML = ""; mountGame(container, { gameId, onStarsChange, backToMenu }); });
      wrap.appendChild(btn);
    }, 600);
  }

  nextRound();
}

function randInt(a, b) { return a + Math.floor(Math.random() * (b - a + 1)); }
function shuffle(a) { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }
