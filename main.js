// 진입점 — 시작 화면 → 게임 루프 → 종료 화면
import { startGame } from "./game.js";
import { initAudio } from "./shared/audio.js";
import { mountConfettiCanvas } from "./shared/celebrate.js";
import { getStars } from "./shared/score.js";

const app = document.getElementById("app");

function renderStart() {
  app.innerHTML = "";
  const wrap = document.createElement("div");
  wrap.className = "start-screen";
  const best = getStars("hangul-puzzle");
  wrap.innerHTML = `
    <div class="icon">🧩</div>
    <h1>한글 단어 퍼즐</h1>
    <div class="sub">자모를 끌어다 놓아 단어를 완성해봐!</div>
    <button class="btn" id="start-btn" style="font-size:28px;min-width:200px">시작하기</button>
    <div class="stars-display">${best ? "최고 기록: " + "⭐".repeat(best) : "&nbsp;"}</div>
  `;
  app.appendChild(wrap);

  document.getElementById("start-btn").addEventListener("click", () => {
    initAudio();
    startGame(app, { backToStart: renderStart });
  });
}

mountConfettiCanvas();
renderStart();
