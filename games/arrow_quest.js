// 게임 4: 별 모으기 — 화살표로 캐릭터 움직여 모든 별 줍기 (벡터 직관)
import { setStarsIfBetter } from "../shared/score.js";
import { playGood, playBad, playFanfare, playClick } from "../shared/audio.js";
import { burstConfetti } from "../shared/celebrate.js";

const GRID = 5;
const CELL = 64;
const ROUNDS = 4;

export function mountGame(container, { gameId, onStarsChange, backToMenu }) {
  let round = 0;
  let totalMoves = 0;
  let optimalMoves = 0;

  const wrap = document.createElement("div");
  wrap.className = "aq-stage";
  wrap.innerHTML = `
    <div class="msg" id="msg">별을 모두 모아줘! ⭐</div>
    <canvas id="board" width="${GRID * CELL}" height="${GRID * CELL}" style="background:#fff;border-radius:18px;box-shadow:var(--shadow)"></canvas>
    <div class="aq-pad">
      <div class="arrow spacer"></div>
      <button class="arrow" data-d="up">↑</button>
      <div class="arrow spacer"></div>
      <button class="arrow" data-d="left">←</button>
      <div class="arrow spacer"></div>
      <button class="arrow" data-d="right">→</button>
      <div class="arrow spacer"></div>
      <button class="arrow" data-d="down">↓</button>
      <div class="arrow spacer"></div>
    </div>
  `;
  container.appendChild(wrap);

  const canvas = wrap.querySelector("#board");
  const ctx = canvas.getContext("2d");
  const msgEl = wrap.querySelector("#msg");
  const buttons = wrap.querySelectorAll(".arrow[data-d]");
  buttons.forEach((b) => b.addEventListener("click", () => move(b.dataset.d)));

  let player, stars, won;

  function startRound() {
    if (round >= ROUNDS) { finish(); return; }
    round += 1;
    won = false;
    msgEl.textContent = `${round} / ${ROUNDS} 라운드`;
    msgEl.className = "msg";
    player = { x: 0, y: GRID - 1 };
    stars = [];
    const starCount = 1 + Math.min(round, 3); // 2,3,4,4
    while (stars.length < starCount) {
      const x = Math.floor(Math.random() * GRID);
      const y = Math.floor(Math.random() * GRID);
      if ((x === player.x && y === player.y) || stars.some((s) => s.x === x && s.y === y)) continue;
      stars.push({ x, y });
    }
    optimalMoves = stars.reduce((sum, s, i, arr) => {
      const prev = i === 0 ? player : arr[i - 1];
      return sum + Math.abs(s.x - prev.x) + Math.abs(s.y - prev.y);
    }, 0);
    draw();
  }

  function move(dir) {
    if (won) return;
    playClick();
    const d = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] }[dir];
    const nx = player.x + d[0];
    const ny = player.y + d[1];
    if (nx < 0 || nx >= GRID || ny < 0 || ny >= GRID) {
      playBad();
      canvas.classList.add("shake");
      setTimeout(() => canvas.classList.remove("shake"), 400);
      return;
    }
    player.x = nx; player.y = ny;
    totalMoves += 1;
    const idx = stars.findIndex((s) => s.x === nx && s.y === ny);
    if (idx >= 0) {
      stars.splice(idx, 1);
      playGood();
    }
    draw();
    if (stars.length === 0) {
      won = true;
      msgEl.textContent = "다 모았다! 🎉";
      msgEl.className = "msg good";
      playFanfare();
      burstConfetti(40);
      setTimeout(startRound, 1100);
    }
  }

  function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    // grid
    ctx.strokeStyle = "#eadcb8";
    ctx.lineWidth = 1;
    for (let i = 0; i <= GRID; i++) {
      ctx.beginPath(); ctx.moveTo(i * CELL, 0); ctx.lineTo(i * CELL, GRID * CELL); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(0, i * CELL); ctx.lineTo(GRID * CELL, i * CELL); ctx.stroke();
    }
    // stars
    for (const s of stars) {
      drawEmoji("⭐", s.x, s.y);
    }
    // player
    drawEmoji("🐰", player.x, player.y);
  }

  function drawEmoji(ch, x, y) {
    ctx.font = "44px serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(ch, x * CELL + CELL / 2, y * CELL + CELL / 2 + 2);
  }

  function finish() {
    canvas.style.display = "none";
    wrap.querySelector(".aq-pad").style.display = "none";
    // 별: 최소 이동수에 가까울수록 별 많이
    const ratio = optimalMoves > 0 ? totalMoves / Math.max(1, ROUNDS) : 1;
    // 더 단순히: 총 이동수가 너무 많으면 별 차감
    // optimal 누적 대비 1.0~1.3 → 3별, 1.3~1.7 → 2별, 그 외 → 1별
    // 누적 optimal 가 게임마다 다르니 단순 휴리스틱:
    const stars = totalMoves <= 14 ? 3 : totalMoves <= 22 ? 2 : 1;
    msgEl.innerHTML = `별 <b>${"⭐".repeat(stars)}</b> 획득!`;
    msgEl.className = "msg good";
    if (setStarsIfBetter(gameId, stars)) onStarsChange();
    burstConfetti();
    const btn = document.createElement("button");
    btn.className = "btn";
    btn.textContent = "또 할래";
    btn.style.marginTop = "14px";
    btn.addEventListener("click", () => { container.innerHTML = ""; mountGame(container, { gameId, onStarsChange, backToMenu }); });
    wrap.appendChild(btn);
  }

  // 키보드도 지원
  const keyHandler = (e) => {
    const map = { ArrowUp: "up", ArrowDown: "down", ArrowLeft: "left", ArrowRight: "right" };
    if (map[e.key]) { e.preventDefault(); move(map[e.key]); }
  };
  window.addEventListener("keydown", keyHandler);
  // cleanup on unmount: container 가 바뀌면 main.js 가 innerHTML="" 호출 → 우리는 키 핸들러만 남음
  // 간단히 MutationObserver 로 감지
  const obs = new MutationObserver(() => {
    if (!document.body.contains(canvas)) {
      window.removeEventListener("keydown", keyHandler);
      obs.disconnect();
    }
  });
  obs.observe(document.body, { childList: true, subtree: true });

  startRound();
}
