// 게임 3 (v2): 다음에 올 건? — 보기에서 정답 도형을 빈 칸으로 끌어다 놓기
// (탭이 아니라 드래그 — 패턴 = 규칙을 채워 완성하는 행위)
import { setStarsIfBetter } from "../shared/score.js";
import { playGood, playBad, playFanfare, playClick } from "../shared/audio.js";
import { burstConfetti } from "../shared/celebrate.js";

const SYMBOLS = ["🔴", "🔵", "🟡", "🟢", "🟣", "🟠"];
const ROUNDS = 5;

export function mountGame(container, { gameId, onStarsChange, backToMenu }) {
  let round = 0;
  let mistakes = 0;

  const wrap = document.createElement("div");
  wrap.style.cssText = "width:100%;display:flex;flex-direction:column;align-items:center;gap:14px";
  wrap.innerHTML = `
    <div class="msg" id="msg">빈 칸에 들어갈 친구를 끌어다 놓아!</div>
    <div class="pattern-row" id="row" style="margin-top:6px"></div>
    <div style="font-size:14px;color:var(--ink-soft)">↓ 보기 ↓</div>
    <div id="opts-zone" style="display:flex;gap:14px;flex-wrap:wrap;justify-content:center;min-height:80px;touch-action:none"></div>
    <div class="msg" id="msg2"></div>
  `;
  container.appendChild(wrap);

  const rowEl = wrap.querySelector("#row");
  const optsEl = wrap.querySelector("#opts-zone");
  const msgEl = wrap.querySelector("#msg");
  const msg2El = wrap.querySelector("#msg2");

  let answer = "";
  let qCellEl = null;
  let roundDone = false;

  function startRound() {
    if (round >= ROUNDS) { finish(); return; }
    round += 1;
    msgEl.textContent = `${round} / ${ROUNDS} — 다음에 올 친구는?`;
    msgEl.className = "msg";
    msg2El.textContent = "";
    msg2El.className = "msg";
    roundDone = false;

    const { sequence, ans, distractors } = makePattern(round);
    answer = ans;

    rowEl.innerHTML = "";
    sequence.forEach((s) => {
      const cell = document.createElement("div");
      cell.className = "pat-cell";
      cell.textContent = s;
      rowEl.appendChild(cell);
    });
    qCellEl = document.createElement("div");
    qCellEl.className = "pat-cell q";
    qCellEl.textContent = "?";
    rowEl.appendChild(qCellEl);

    const choices = shuffle([ans, ...distractors]);
    optsEl.innerHTML = "";
    choices.forEach((s) => {
      const opt = document.createElement("div");
      opt.className = "pat-cell";
      opt.style.cssText = "cursor:grab;touch-action:none;user-select:none";
      opt.textContent = s;
      makeDraggable(opt, s);
      optsEl.appendChild(opt);
    });
  }

  function makeDraggable(el, sym) {
    let startX = 0, startY = 0, origLeft = 0, origTop = 0, dragging = false;
    el.addEventListener("pointerdown", (e) => {
      if (roundDone) return;
      el.setPointerCapture(e.pointerId);
      const r = el.getBoundingClientRect();
      // 절대 위치로 변환
      el.style.position = "fixed";
      el.style.left = r.left + "px";
      el.style.top = r.top + "px";
      el.style.zIndex = "100";
      origLeft = r.left;
      origTop = r.top;
      startX = e.clientX;
      startY = e.clientY;
      dragging = true;
      el.style.cursor = "grabbing";
      playClick();
    });
    el.addEventListener("pointermove", (e) => {
      if (!dragging) return;
      el.style.left = (origLeft + (e.clientX - startX)) + "px";
      el.style.top = (origTop + (e.clientY - startY)) + "px";
    });
    const release = () => {
      if (!dragging) return;
      dragging = false;
      el.style.cursor = "grab";
      // 빈 칸 위에 떨어졌나?
      const elR = el.getBoundingClientRect();
      const cx = elR.left + elR.width / 2;
      const cy = elR.top + elR.height / 2;
      const qR = qCellEl.getBoundingClientRect();
      const onQ = cx >= qR.left && cx <= qR.right && cy >= qR.top && cy <= qR.bottom;
      if (onQ) {
        if (sym === answer) {
          roundDone = true;
          playGood();
          qCellEl.textContent = sym;
          qCellEl.classList.remove("q");
          msg2El.textContent = "맞았어! ✨";
          msg2El.className = "msg good";
          el.remove();
          setTimeout(startRound, 800);
        } else {
          playBad();
          mistakes += 1;
          el.classList.add("shake");
          setTimeout(() => {
            el.classList.remove("shake");
            // 원위치
            el.style.position = "";
            el.style.left = "";
            el.style.top = "";
            el.style.zIndex = "";
          }, 300);
        }
      } else {
        // 원위치
        el.style.position = "";
        el.style.left = "";
        el.style.top = "";
        el.style.zIndex = "";
      }
    };
    el.addEventListener("pointerup", release);
    el.addEventListener("pointercancel", release);
  }

  function finish() {
    rowEl.innerHTML = "🎉";
    optsEl.innerHTML = "";
    msgEl.textContent = "끝!";
    const stars = mistakes === 0 ? 3 : mistakes <= 2 ? 2 : 1;
    msg2El.innerHTML = `별 <b>${"⭐".repeat(stars)}</b> 획득!`;
    msg2El.className = "msg good";
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

  startRound();
}

function makePattern(round) {
  const pool = shuffle([...SYMBOLS]);
  let unit;
  if (round <= 2)      unit = [pool[0], pool[1]];
  else if (round <= 4) unit = [pool[0], pool[1], pool[2]];
  else                 unit = [pool[0], pool[0], pool[1], pool[1]];
  const reps = 2;
  const flat = [];
  for (let i = 0; i < reps; i++) flat.push(...unit);
  const visible = flat.slice(0, flat.length - 1);
  const ans = flat[flat.length - 1];
  const distractors = shuffle(pool.filter((s) => s !== ans)).slice(0, 2);
  return { sequence: visible, ans, distractors };
}
function shuffle(a) { a = [...a]; for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i+1)); [a[i],a[j]]=[a[j],a[i]]; } return a; }
