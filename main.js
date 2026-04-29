// 메인 라우터: 메뉴 ↔ 게임 전환
import { getStars } from "./shared/score.js";
import { initAudio } from "./shared/audio.js";
import { mountConfettiCanvas } from "./shared/celebrate.js";

const GAMES = [
  { id: "balloons",    emoji: "🎈", name: "숫자 풍선",    loader: () => import("./games/balloons.js") },
  { id: "shapes",      emoji: "🔺", name: "도형 친구",    loader: () => import("./games/shapes.js") },
  { id: "pattern",     emoji: "🟦", name: "다음에 올 건?", loader: () => import("./games/pattern.js") },
  { id: "arrow_quest", emoji: "⭐", name: "별 모으기",    loader: () => import("./games/arrow_quest.js") },
  { id: "ball_valley", emoji: "⛰️", name: "공 굴리기",    loader: () => import("./games/ball_valley.js") },
  { id: "candy_jar",   emoji: "🍬", name: "사탕 뽑기",    loader: () => import("./games/candy_jar.js") },
  { id: "mirror_grid", emoji: "🪞", name: "거울 격자",    loader: () => import("./games/mirror_grid.js") },
];

const app = document.getElementById("app");

function starString(n) {
  if (!n) return "";
  return "⭐".repeat(Math.min(3, n));
}

function renderMenu() {
  app.innerHTML = "";
  const header = document.createElement("div");
  header.className = "menu-header";
  header.innerHTML = `
    <h1>수학놀이</h1>
    <div class="sub">놀면서 똑똑해지자!</div>
  `;
  app.appendChild(header);

  const grid = document.createElement("div");
  grid.className = "menu-grid";
  for (const g of GAMES) {
    const card = document.createElement("button");
    card.className = "game-card";
    card.style.background = pastelFor(g.id);
    card.innerHTML = `
      <span class="emoji">${g.emoji}</span>
      <span class="name">${g.name}</span>
      <span class="stars">${starString(getStars(g.id))}</span>
    `;
    card.addEventListener("click", () => loadGame(g));
    grid.appendChild(card);
  }
  app.appendChild(grid);
}

const PALETTE = ["#ffe7c2", "#ffd6e0", "#d6ecff", "#e2f7d3", "#f0e0ff", "#ffeec2", "#ffd9c2"];
function pastelFor(id) {
  let h = 0;
  for (const ch of id) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return PALETTE[h % PALETTE.length];
}

async function loadGame(g) {
  initAudio(); // 첫 사용자 클릭 후에야 오디오 컨텍스트 활성화 가능
  app.innerHTML = `<div class="center" style="padding:40px"><div class="msg">잠시만요…</div></div>`;
  try {
    const mod = await g.loader();
    app.innerHTML = "";
    const screen = document.createElement("div");
    screen.className = "game-screen";

    const bar = document.createElement("div");
    bar.className = "bar";
    bar.innerHTML = `
      <button class="btn small secondary" id="back-btn">← 메뉴</button>
      <div class="title">${g.emoji} ${g.name}</div>
      <div class="stars" id="game-stars">${starString(getStars(g.id))}</div>
    `;
    screen.appendChild(bar);

    const body = document.createElement("div");
    body.className = "game-body";
    screen.appendChild(body);

    app.appendChild(screen);

    bar.querySelector("#back-btn").addEventListener("click", renderMenu);

    mod.mountGame(body, {
      gameId: g.id,
      onStarsChange: () => {
        bar.querySelector("#game-stars").textContent = starString(getStars(g.id));
      },
      backToMenu: renderMenu,
    });
  } catch (err) {
    console.error(err);
    app.innerHTML = `
      <div class="center" style="padding:40px">
        <div class="msg bad">앗, 게임을 못 불러왔어요</div>
        <button class="btn" id="retry">다시 메뉴로</button>
      </div>`;
    document.getElementById("retry").addEventListener("click", renderMenu);
  }
}

mountConfettiCanvas();
renderMenu();
