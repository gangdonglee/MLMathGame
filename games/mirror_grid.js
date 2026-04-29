// 게임 7: 거울 색칠 격자 — 왼쪽 패턴을 변환(좌우/상하/회전)으로 오른쪽 격자 만들기 (행렬/대칭)
import { setStarsIfBetter } from "../shared/score.js";
import { playGood, playBad, playFanfare } from "../shared/audio.js";
import { burstConfetti } from "../shared/celebrate.js";

const N = 4;
const ROUNDS = 4;
const TRANSFORMS = [
  { id: "flipH",  label: "좌우 거울", fn: (g) => g.map((row) => [...row].reverse()) },
  { id: "flipV",  label: "상하 거울", fn: (g) => [...g].reverse().map((r) => [...r]) },
  { id: "rot90",  label: "오른쪽 90°", fn: (g) => {
      const out = Array.from({ length: N }, () => Array(N).fill(0));
      for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) out[x][N - 1 - y] = g[y][x];
      return out;
  }},
  { id: "rot180", label: "180°",       fn: (g) => g.map((r) => [...r]).reverse().map((r) => r.reverse()) },
];

export function mountGame(container, { gameId, onStarsChange, backToMenu }) {
  let round = 0;
  let mistakes = 0;

  const wrap = document.createElement("div");
  wrap.className = "mg-stage";
  wrap.style.width = "100%";
  wrap.innerHTML = `
    <div class="msg" id="msg">왼쪽을 어떻게 바꾸면 오른쪽처럼 될까?</div>
    <div class="mg-boards">
      <div class="mg-board" id="src"></div>
      <div class="mg-arrow">➜</div>
      <div class="mg-board" id="tgt"></div>
    </div>
    <div class="mg-options" id="opts"></div>
    <div class="msg" id="msg2"></div>
  `;
  container.appendChild(wrap);

  const srcEl = wrap.querySelector("#src");
  const tgtEl = wrap.querySelector("#tgt");
  const optsEl = wrap.querySelector("#opts");
  const msgEl = wrap.querySelector("#msg");
  const msg2El = wrap.querySelector("#msg2");

  let src, target, correctId;

  function startRound() {
    if (round >= ROUNDS) { finish(); return; }
    round += 1;
    msg2El.textContent = "";
    msg2El.className = "msg";

    // 비대칭 패턴 만들기 (변환별로 결과가 달라야 함)
    src = randomAsymmetric();
    const t = TRANSFORMS[Math.floor(Math.random() * TRANSFORMS.length)];
    correctId = t.id;
    target = t.fn(src);

    renderBoard(srcEl, src, false);
    renderBoard(tgtEl, target, true);

    optsEl.innerHTML = "";
    TRANSFORMS.forEach((opt) => {
      const btn = document.createElement("button");
      btn.className = "mg-option";
      btn.textContent = opt.label;
      btn.addEventListener("click", () => {
        if (opt.id === correctId) {
          playGood();
          msg2El.textContent = "맞았어! 🎉";
          msg2El.className = "msg good";
          [...optsEl.children].forEach((b) => b.disabled = true);
          setTimeout(startRound, 900);
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

  function renderBoard(el, grid, isTarget) {
    el.style.gridTemplateColumns = `repeat(${N}, 36px)`;
    el.innerHTML = "";
    for (let y = 0; y < N; y++) {
      for (let x = 0; x < N; x++) {
        const c = document.createElement("div");
        c.className = "mg-cell" + (grid[y][x] ? " on" : "") + (isTarget ? " target" : "");
        el.appendChild(c);
      }
    }
  }

  function randomAsymmetric() {
    // 대칭이면 변환 후가 똑같아져 정답을 구분 못 함 → 비대칭이 될 때까지 재시도
    for (let attempt = 0; attempt < 50; attempt++) {
      const g = Array.from({ length: N }, () => Array.from({ length: N }, () => Math.random() < 0.45 ? 1 : 0));
      const all = TRANSFORMS.map((t) => JSON.stringify(t.fn(g)));
      const set = new Set(all);
      set.add(JSON.stringify(g));
      if (set.size === TRANSFORMS.length + 1 || set.size >= TRANSFORMS.length) return g;
    }
    return [
      [1,0,0,0],
      [1,1,0,0],
      [1,0,0,0],
      [0,0,0,1],
    ];
  }

  function finish() {
    srcEl.innerHTML = ""; tgtEl.innerHTML = ""; optsEl.innerHTML = "";
    msgEl.textContent = "🎉 끝!";
    const stars = mistakes === 0 ? 3 : mistakes <= 2 ? 2 : 1;
    msg2El.innerHTML = `별 <b>${"⭐".repeat(stars)}</b> 획득!`;
    msg2El.className = "msg good";
    if (setStarsIfBetter(gameId, stars)) onStarsChange();
    playFanfare();
    burstConfetti();
    const btn = document.createElement("button");
    btn.className = "btn";
    btn.textContent = "또 할래";
    btn.addEventListener("click", () => { container.innerHTML = ""; mountGame(container, { gameId, onStarsChange, backToMenu }); });
    wrap.appendChild(btn);
  }

  startRound();
}
