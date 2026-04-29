// 게임 3: 다음에 올 건? — 반복 패턴의 다음 항 고르기
import { setStarsIfBetter } from "../shared/score.js";
import { playGood, playBad, playFanfare } from "../shared/audio.js";
import { burstConfetti } from "../shared/celebrate.js";

const SYMBOLS = ["🔴", "🔵", "🟡", "🟢", "🟣", "🟠"];
const ROUNDS = 5;

export function mountGame(container, { gameId, onStarsChange, backToMenu }) {
  let round = 0;
  let mistakes = 0;

  const wrap = document.createElement("div");
  wrap.style.width = "100%";
  wrap.innerHTML = `
    <div class="msg">다음에 올 건?</div>
    <div class="pattern-row" id="row" style="margin-top:14px"></div>
    <div class="pat-options" id="opts"></div>
    <div class="msg" id="msg" style="margin-top:14px"></div>
  `;
  container.appendChild(wrap);

  const rowEl = wrap.querySelector("#row");
  const optsEl = wrap.querySelector("#opts");
  const msgEl = wrap.querySelector("#msg");

  function nextRound() {
    if (round >= ROUNDS) { finish(); return; }
    round += 1;
    msgEl.textContent = "";
    msgEl.className = "msg";

    const { sequence, answer, distractors } = makePattern(round);
    rowEl.innerHTML = "";
    sequence.forEach((s) => {
      const cell = document.createElement("div");
      cell.className = "pat-cell";
      cell.textContent = s;
      rowEl.appendChild(cell);
    });
    const q = document.createElement("div");
    q.className = "pat-cell q";
    q.textContent = "?";
    rowEl.appendChild(q);

    const choices = shuffle([answer, ...distractors]);
    optsEl.innerHTML = "";
    choices.forEach((s) => {
      const btn = document.createElement("button");
      btn.className = "pat-cell";
      btn.style.cursor = "pointer";
      btn.style.border = "none";
      btn.style.fontFamily = "inherit";
      btn.textContent = s;
      btn.addEventListener("click", () => {
        if (s === answer) {
          playGood();
          q.textContent = s;
          q.classList.remove("q");
          msgEl.textContent = "맞았어! ✨";
          msgEl.className = "msg good";
          setTimeout(nextRound, 800);
        } else {
          playBad();
          btn.classList.add("shake");
          mistakes += 1;
          setTimeout(() => btn.classList.remove("shake"), 400);
        }
      });
      optsEl.appendChild(btn);
    });
  }

  function finish() {
    rowEl.innerHTML = "🎉";
    optsEl.innerHTML = "";
    const stars = mistakes === 0 ? 3 : mistakes <= 2 ? 2 : 1;
    msgEl.innerHTML = `별 <b>${"⭐".repeat(stars)}</b> 획득!`;
    msgEl.className = "msg good";
    if (setStarsIfBetter(gameId, stars)) onStarsChange();
    playFanfare();
    burstConfetti();
    const btn = document.createElement("button");
    btn.className = "btn";
    btn.textContent = "또 할래";
    btn.style.marginTop = "14px";
    btn.addEventListener("click", () => { container.innerHTML = ""; mountGame(container, { gameId, onStarsChange, backToMenu }); });
    wrap.appendChild(btn);
  }

  nextRound();
}

function makePattern(round) {
  // round 1~2: AB AB AB ?
  // round 3~4: ABC ABC ?
  // round 5: AABB AABB ?
  const pool = shuffle([...SYMBOLS]);
  let unit;
  if (round <= 2)      unit = [pool[0], pool[1]];
  else if (round <= 4) unit = [pool[0], pool[1], pool[2]];
  else                 unit = [pool[0], pool[0], pool[1], pool[1]];

  const reps = 2;
  const flat = [];
  for (let i = 0; i < reps; i++) flat.push(...unit);
  const visible = flat.slice(0, flat.length - 1);
  const answer = flat[flat.length - 1];

  const distractors = shuffle(pool.filter((s) => s !== answer)).slice(0, 2);
  return { sequence: visible, answer, distractors };
}
function shuffle(a) { a = [...a]; for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }
