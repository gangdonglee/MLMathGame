// 게임 2 (v2): 도형 친구 — 섞여있는 도형들을 같은 모양 상자로 끌어다 넣기
// (분류 = 본질적 속성[모양]만 보고 우연적 속성[색]은 무시)
import { setStarsIfBetter } from "../shared/score.js";
import { playGood, playBad, playFanfare, playClick } from "../shared/audio.js";
import { burstConfetti } from "../shared/celebrate.js";

const SHAPE_KINDS = ["circle", "square", "triangle", "star"];
const COLORS = ["#ff8a4c", "#6cb6ff", "#ff9ec7", "#88e0a0", "#b58cff", "#ffd166"];
const ROUNDS = 4;

function shapeSvg(kind, color, size = 56) {
  const c = color;
  const s = size;
  switch (kind) {
    case "circle":   return `<svg viewBox="0 0 100 100" width="${s}" height="${s}"><circle cx="50" cy="50" r="42" fill="${c}"/></svg>`;
    case "square":   return `<svg viewBox="0 0 100 100" width="${s}" height="${s}"><rect x="12" y="12" width="76" height="76" rx="10" fill="${c}"/></svg>`;
    case "triangle": return `<svg viewBox="0 0 100 100" width="${s}" height="${s}"><polygon points="50,10 92,88 8,88" fill="${c}"/></svg>`;
    case "star":     return `<svg viewBox="0 0 100 100" width="${s}" height="${s}"><polygon points="50,8 61,38 94,40 67,60 78,92 50,72 22,92 33,60 6,40 39,38" fill="${c}"/></svg>`;
  }
}

export function mountGame(container, { gameId, onStarsChange, backToMenu }) {
  let round = 0;
  let mistakes = 0;

  const wrap = document.createElement("div");
  wrap.style.cssText = "width:100%;display:flex;flex-direction:column;align-items:center;gap:12px";
  wrap.innerHTML = `
    <div class="msg" id="msg">같은 모양 상자에 끌어다 놓아!</div>
    <div id="playground" style="position:relative;width:100%;max-width:440px;height:240px;background:#fff7e6;border-radius:18px;box-shadow:var(--shadow);overflow:hidden;touch-action:none"></div>
    <div id="bins" style="display:flex;gap:10px;flex-wrap:wrap;justify-content:center;width:100%;max-width:440px"></div>
    <div class="msg" id="msg2"></div>
  `;
  container.appendChild(wrap);

  const playgroundEl = wrap.querySelector("#playground");
  const binsEl = wrap.querySelector("#bins");
  const msgEl = wrap.querySelector("#msg");
  const msg2El = wrap.querySelector("#msg2");

  function startRound() {
    if (round >= ROUNDS) { finish(); return; }
    round += 1;
    msgEl.textContent = `${round} / ${ROUNDS} — 같은 모양 상자에 끌어다 놓아!`;
    msgEl.className = "msg";
    msg2El.textContent = "";
    msg2El.className = "msg";

    const kindCount = 2 + Math.min(round - 1, 2); // 2~4
    const kinds = shuffle([...SHAPE_KINDS]).slice(0, kindCount);

    binsEl.innerHTML = "";
    for (const kind of kinds) {
      const bin = document.createElement("div");
      bin.className = "sort-bin";
      bin.dataset.kind = kind;
      bin.innerHTML = `
        <div class="bin-icon">${shapeSvg(kind, "rgba(58,47,30,0.35)", 38)}</div>
        <div class="bin-label">상자</div>
      `;
      binsEl.appendChild(bin);
    }

    playgroundEl.innerHTML = "";
    let pieces = [];
    for (const kind of kinds) {
      const count = 1 + Math.floor(Math.random() * 2); // 1~2 each
      for (let i = 0; i < count; i++) {
        pieces.push({ kind, color: COLORS[Math.floor(Math.random() * COLORS.length)] });
      }
    }
    shuffle(pieces);

    let remaining = pieces.length;
    pieces.forEach((p, i) => {
      const el = document.createElement("div");
      el.className = "drag-shape";
      const left = 20 + (i % 5) * 78 + Math.random() * 8;
      const top = 20 + Math.floor(i / 5) * 90 + Math.random() * 8;
      el.style.cssText = `position:absolute;left:${left}px;top:${top}px;width:60px;height:60px;cursor:grab;touch-action:none;user-select:none`;
      el.innerHTML = shapeSvg(p.kind, p.color, 60);
      makeDraggable(el, p, () => {
        remaining--;
        if (remaining === 0) {
          msg2El.textContent = "다 분류했다! 👏";
          msg2El.className = "msg good";
          playFanfare();
          setTimeout(startRound, 900);
        }
      });
      playgroundEl.appendChild(el);
    });
  }

  function makeDraggable(el, piece, onSorted) {
    let startX = 0, startY = 0, origLeft = 0, origTop = 0, dragging = false;
    el.addEventListener("pointerdown", (e) => {
      el.setPointerCapture(e.pointerId);
      startX = e.clientX; startY = e.clientY;
      origLeft = parseFloat(el.style.left);
      origTop = parseFloat(el.style.top);
      dragging = true;
      el.style.cursor = "grabbing";
      el.style.zIndex = "100";
      playClick();
    });
    el.addEventListener("pointermove", (e) => {
      if (!dragging) return;
      el.style.left = (origLeft + (e.clientX - startX)) + "px";
      el.style.top = (origTop + (e.clientY - startY)) + "px";
    });
    el.addEventListener("pointerup", (e) => {
      if (!dragging) return;
      dragging = false;
      el.style.cursor = "grab";
      el.style.zIndex = "";
      const r = el.getBoundingClientRect();
      const cx = r.left + r.width / 2;
      const cy = r.top + r.height / 2;
      let dropBin = null;
      for (const bin of binsEl.querySelectorAll(".sort-bin")) {
        const br = bin.getBoundingClientRect();
        if (cx >= br.left && cx <= br.right && cy >= br.top && cy <= br.bottom) {
          dropBin = bin; break;
        }
      }
      if (dropBin && dropBin.dataset.kind === piece.kind) {
        playGood();
        dropBin.classList.add("hit");
        setTimeout(() => dropBin.classList.remove("hit"), 350);
        el.remove();
        onSorted();
      } else if (dropBin) {
        playBad();
        mistakes += 1;
        el.classList.add("shake");
        setTimeout(() => {
          el.classList.remove("shake");
          el.style.left = origLeft + "px";
          el.style.top = origTop + "px";
        }, 300);
      } else {
        // 박스 아닌 데에 떨어뜨림 → 원위치
        el.style.left = origLeft + "px";
        el.style.top = origTop + "px";
      }
    });
    el.addEventListener("pointercancel", () => {
      dragging = false;
      el.style.cursor = "grab";
      el.style.zIndex = "";
      el.style.left = origLeft + "px";
      el.style.top = origTop + "px";
    });
  }

  function finish() {
    playgroundEl.style.display = "none";
    binsEl.style.display = "none";
    msgEl.textContent = "🎉 끝!";
    const stars = mistakes === 0 ? 3 : mistakes <= 2 ? 2 : 1;
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

function shuffle(a) { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i+1)); [a[i],a[j]]=[a[j],a[i]]; } return a; }
