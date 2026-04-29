// 게임 6: 사탕 뽑기 — 두 통 중 빨간 사탕이 더 많이 나오는 통 찾기 (확률 직관)
import { setStarsIfBetter } from "../shared/score.js";
import { playGood, playBad, playFanfare, playClick } from "../shared/audio.js";
import { burstConfetti } from "../shared/celebrate.js";

const ROUNDS = 3;
const DRAWS_PER_JAR = 10;

export function mountGame(container, { gameId, onStarsChange, backToMenu }) {
  let round = 0;
  let mistakes = 0;

  const wrap = document.createElement("div");
  wrap.style.width = "100%";
  wrap.style.display = "flex";
  wrap.style.flexDirection = "column";
  wrap.style.alignItems = "center";
  wrap.style.gap = "16px";
  wrap.innerHTML = `
    <div class="msg" id="msg">통을 눌러 사탕을 10번씩 뽑아봐. 빨간 사탕이 더 많이 나오는 통은?</div>
    <div class="jar-row" id="jars"></div>
    <div class="msg" id="msg2"></div>
  `;
  container.appendChild(wrap);

  const jarsEl = wrap.querySelector("#jars");
  const msgEl = wrap.querySelector("#msg");
  const msg2El = wrap.querySelector("#msg2");

  let jars; // [{redP, draws:[], el, picked}]
  let phase; // "draw" | "pick"

  function startRound() {
    if (round >= ROUNDS) { finish(); return; }
    round += 1;
    msgEl.textContent = `${round} / ${ROUNDS} 라운드 — 통을 눌러 10번 뽑아봐`;
    msg2El.textContent = "";
    msg2El.className = "msg";
    phase = "draw";

    // 두 통의 빨간 비율 차이를 충분히
    let p1 = 0.2 + Math.random() * 0.6;
    let p2 = 0.2 + Math.random() * 0.6;
    while (Math.abs(p1 - p2) < 0.25) {
      p2 = 0.2 + Math.random() * 0.6;
    }
    jars = [
      { redP: p1, draws: [], picked: false },
      { redP: p2, draws: [], picked: false },
    ];
    if (Math.random() < 0.5) jars.reverse();

    jarsEl.innerHTML = "";
    jars.forEach((j, i) => {
      const el = document.createElement("button");
      el.className = "jar";
      el.innerHTML = `
        <div class="lid"></div>
        <div class="draws"></div>
        <div class="name">통 ${i === 0 ? "A" : "B"}</div>
      `;
      el.addEventListener("click", () => onJarClick(j, el));
      jarsEl.appendChild(el);
      j.el = el;
    });
  }

  function onJarClick(j, el) {
    if (phase === "draw") {
      if (j.draws.length >= DRAWS_PER_JAR) {
        msg2El.textContent = "이미 10번 뽑았어. 다른 통도 해봐!";
        msg2El.className = "msg";
        return;
      }
      const isRed = Math.random() < j.redP;
      j.draws.push(isRed);
      playClick();
      renderDraws(j, el);
      if (jars.every((x) => x.draws.length >= DRAWS_PER_JAR)) {
        phase = "pick";
        msgEl.textContent = "다 뽑았다! 이제 어느 통이 빨간 사탕 더 많이 나왔는지 골라!";
      }
    } else if (phase === "pick") {
      phase = "wait"; // 대기 중 추가 클릭 차단
      // 정답 = 실제 더 많이 빨간 통 (관찰 빈도 기준)
      const counts = jars.map((x) => x.draws.filter(Boolean).length);
      const winnerIdx = counts[0] === counts[1] ? (jars[0].redP > jars[1].redP ? 0 : 1) : (counts[0] > counts[1] ? 0 : 1);
      const pickedIdx = jars.indexOf(j);
      jars.forEach((x) => x.el.classList.remove("picked"));
      el.classList.add("picked");
      if (pickedIdx === winnerIdx) {
        playGood();
        playFanfare();
        msg2El.textContent = "맞았어! 🎉";
        msg2El.className = "msg good";
        burstConfetti(40);
        setTimeout(startRound, 1200);
      } else {
        playBad();
        el.classList.add("shake");
        mistakes += 1;
        msg2El.textContent = "다른 통이었어! 다시 봐봐";
        msg2El.className = "msg bad";
        setTimeout(() => el.classList.remove("shake"), 400);
        // 정답 강조
        const winnerEl = jars[winnerIdx].el;
        winnerEl.classList.add("picked");
        setTimeout(startRound, 1600);
      }
    }
  }

  function renderDraws(j, el) {
    const drawsEl = el.querySelector(".draws");
    drawsEl.innerHTML = "";
    for (let i = 0; i < DRAWS_PER_JAR; i++) {
      const s = document.createElement("span");
      if (j.draws[i] === true) s.classList.add("red");
      else if (j.draws[i] === false) s.classList.add("blue");
      drawsEl.appendChild(s);
    }
  }

  function finish() {
    jarsEl.innerHTML = "";
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

  startRound();
}
