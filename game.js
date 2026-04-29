// 한글 자모 단어 퍼즐 게임 본체
// - 단어 그림(emoji) 표시
// - 글자 슬롯 (cho/jung/jong) 표시
// - 자모 트레이 (정답 + 함정)
// - 자모를 슬롯에 드래그 → 정답이면 박힘, 음절 완성 시 한 글자로 합쳐짐
// - 단어 완성 시 다음 라운드
import { wordToSyllables, isVowel, neededJamos, CHO, JUNG, JONG } from "./shared/jamo.js";
import { speak } from "./shared/tts.js";
import { playGood, playBad, playPop, playFanfare, playClick } from "./shared/audio.js";
import { burstConfetti } from "./shared/celebrate.js";
import { setStarsIfBetter } from "./shared/score.js";
import { pickRoundWords } from "./data/words.js";

const TOTAL_ROUNDS = 10;
const DISTRACTOR_BY_ROUND = [1, 1, 2, 2, 2, 2, 3, 3, 3, 3]; // 라운드 진행할수록 함정 +

export function startGame(app, { backToStart }) {
  let round = 0;
  let mistakes = 0;
  const words = pickRoundWords(TOTAL_ROUNDS);
  let state = null;

  function startRound() {
    if (round >= words.length) { finish(); return; }
    round += 1;
    const w = words[round - 1];
    const syllables = wordToSyllables(w.word);
    state = {
      word: w.word,
      emoji: w.emoji,
      syllables,
      filled: syllables.map(() => ({ cho: null, jung: null, jong: null })),
      complete: syllables.map(() => false),
    };
    render();
    setTimeout(() => speak(w.word), 350);
  }

  function render() {
    app.innerHTML = "";

    // 상단 바
    const bar = document.createElement("div");
    bar.className = "game-bar";
    bar.innerHTML = `
      <button class="btn small secondary" id="back-btn">← 처음</button>
      <div class="round-info">${round} / ${TOTAL_ROUNDS}</div>
      <div style="width:80px"></div>
    `;
    app.appendChild(bar);

    // 그림 + 발음
    const emojiArea = document.createElement("div");
    emojiArea.className = "emoji-area";
    emojiArea.innerHTML = `
      <div class="emoji">${state.emoji}</div>
      <button class="btn small secondary" id="speak-btn">🔊 발음 듣기</button>
    `;
    app.appendChild(emojiArea);

    // 음절 행
    const sylRow = document.createElement("div");
    sylRow.className = "syllable-row";
    state.syllables.forEach((s, i) => {
      const sylEl = document.createElement("div");
      sylEl.className = "syllable";
      sylEl.dataset.syl = i;
      sylEl.appendChild(buildSyllableSlots(i, s));
      sylRow.appendChild(sylEl);
    });
    app.appendChild(sylRow);

    // 메시지
    const msgEl = document.createElement("div");
    msgEl.className = "msg";
    msgEl.id = "msg";
    msgEl.textContent = "자모를 끌어다 놓아!";
    app.appendChild(msgEl);

    // 자모 트레이
    const tray = document.createElement("div");
    tray.className = "jamo-tray";
    tray.id = "tray";
    const trayJamos = makeTrayJamos(state.word, round);
    trayJamos.forEach((j) => {
      const el = document.createElement("div");
      el.className = "jamo";
      el.textContent = j;
      el.dataset.jamo = j;
      makeDraggable(el, j);
      tray.appendChild(el);
    });
    app.appendChild(tray);

    // 핸들러
    bar.querySelector("#back-btn").addEventListener("click", () => {
      if (confirm("처음 화면으로 돌아갈래?")) backToStart();
    });
    emojiArea.querySelector("#speak-btn").addEventListener("click", () => {
      playClick();
      speak(state.word);
    });
  }

  function buildSyllableSlots(sylIdx, syl) {
    // 슬롯을 가로로 배치 (cho - jung - jong)
    const wrap = document.createElement("div");
    wrap.className = "slots-row";
    ["cho", "jung", "jong"].forEach((pos) => {
      if (pos === "jong" && !syl.jong) return;
      const slot = document.createElement("div");
      slot.className = "slot";
      slot.dataset.syl = sylIdx;
      slot.dataset.pos = pos;
      slot.dataset.expected = syl[pos];
      slot.textContent = "";
      wrap.appendChild(slot);
    });
    return wrap;
  }

  function makeTrayJamos(word, roundNum) {
    const needed = neededJamos(word);
    const distractCount = DISTRACTOR_BY_ROUND[roundNum - 1] || 2;

    // 함정: 단어에 안 들어간 자모 중에서 랜덤하게
    // 모음/자음 비율 비슷하게
    const vowelsNeeded = needed.filter(isVowel).length;
    const consNeeded = needed.length - vowelsNeeded;
    const distractors = [];
    const usedSet = new Set(needed);
    const candidates = [];
    for (const c of CHO) if (!usedSet.has(c)) candidates.push(c);
    for (const v of JUNG) if (!usedSet.has(v)) candidates.push(v);
    shuffle(candidates);
    for (let i = 0; i < distractCount && i < candidates.length; i++) {
      distractors.push(candidates[i]);
    }

    return shuffle([...needed, ...distractors]);
  }

  function makeDraggable(el, jamo) {
    let dragging = false;
    let startClientX = 0, startClientY = 0;
    let origRect = null;

    el.addEventListener("pointerdown", (e) => {
      el.setPointerCapture(e.pointerId);
      origRect = el.getBoundingClientRect();
      el.style.position = "fixed";
      el.style.left = origRect.left + "px";
      el.style.top = origRect.top + "px";
      el.style.width = origRect.width + "px";
      el.style.height = origRect.height + "px";
      el.style.zIndex = "100";
      el.classList.add("dragging");
      startClientX = e.clientX;
      startClientY = e.clientY;
      dragging = true;
      playClick();
    });

    el.addEventListener("pointermove", (e) => {
      if (!dragging) return;
      el.style.left = (origRect.left + (e.clientX - startClientX)) + "px";
      el.style.top = (origRect.top + (e.clientY - startClientY)) + "px";
      highlightSlotUnder(e.clientX, e.clientY, jamo);
    });

    const release = (e) => {
      if (!dragging) return;
      dragging = false;
      el.classList.remove("dragging");
      const cursorX = e.clientX !== undefined ? e.clientX : 0;
      const cursorY = e.clientY !== undefined ? e.clientY : 0;
      const slot = findSlotAt(cursorX, cursorY);
      clearHighlights();
      if (slot) {
        if (jamo === slot.expected) {
          // 정답 — 이 자모 element 를 슬롯에 박음
          placeIntoSlot(el, slot, jamo);
        } else {
          // 오답
          mistakes += 1;
          playBad();
          el.classList.add("shake");
          setTimeout(() => {
            el.classList.remove("shake");
            returnToTray(el);
          }, 350);
          const slotEl = document.querySelector(`.slot[data-syl="${slot.syl}"][data-pos="${slot.pos}"]`);
          if (slotEl) {
            slotEl.classList.add("shake");
            setTimeout(() => slotEl.classList.remove("shake"), 350);
          }
        }
      } else {
        returnToTray(el);
      }
    };
    el.addEventListener("pointerup", release);
    el.addEventListener("pointercancel", () => {
      if (!dragging) return;
      dragging = false;
      el.classList.remove("dragging");
      clearHighlights();
      returnToTray(el);
    });
  }

  function returnToTray(el) {
    el.style.position = "";
    el.style.left = "";
    el.style.top = "";
    el.style.width = "";
    el.style.height = "";
    el.style.zIndex = "";
  }

  function placeIntoSlot(el, slot, jamo) {
    const slotEl = document.querySelector(`.slot[data-syl="${slot.syl}"][data-pos="${slot.pos}"]`);
    if (!slotEl) { returnToTray(el); return; }
    slotEl.textContent = jamo;
    slotEl.classList.add("filled");
    state.filled[slot.syl][slot.pos] = jamo;
    playGood();
    el.remove(); // 트레이에서 제거

    // 음절 완성 검사
    const syl = state.syllables[slot.syl];
    const filled = state.filled[slot.syl];
    const sylDone =
      filled.cho === syl.cho &&
      filled.jung === syl.jung &&
      (syl.jong ? filled.jong === syl.jong : true);

    if (sylDone && !state.complete[slot.syl]) {
      state.complete[slot.syl] = true;
      playPop();
      // 슬롯들을 합쳐 한 글자로
      const sylEl = document.querySelector(`.syllable[data-syl="${slot.syl}"]`);
      setTimeout(() => {
        if (!sylEl) return;
        sylEl.classList.add("complete");
        sylEl.innerHTML = `<div class="syllable-char">${state.word[slot.syl]}</div>`;
      }, 200);

      // 단어 완성?
      if (state.complete.every(Boolean)) {
        wordComplete();
      }
    }
  }

  function findSlotAt(x, y) {
    const slots = document.querySelectorAll(".slot:not(.filled)");
    for (const s of slots) {
      const r = s.getBoundingClientRect();
      if (x >= r.left && x <= r.right && y >= r.top && y <= r.bottom) {
        return {
          syl: parseInt(s.dataset.syl),
          pos: s.dataset.pos,
          expected: s.dataset.expected,
        };
      }
    }
    return null;
  }

  function highlightSlotUnder(x, y, jamo) {
    clearHighlights();
    const slots = document.querySelectorAll(".slot:not(.filled)");
    const isV = isVowel(jamo);
    for (const s of slots) {
      const r = s.getBoundingClientRect();
      if (x >= r.left && x <= r.right && y >= r.top && y <= r.bottom) {
        // 자음/모음 타입 일치하면 강조
        const slotIsVowel = s.dataset.pos === "jung";
        if (slotIsVowel === isV) {
          s.classList.add("hover");
        }
        return;
      }
    }
  }

  function clearHighlights() {
    document.querySelectorAll(".slot.hover").forEach((s) => s.classList.remove("hover"));
  }

  function wordComplete() {
    const msg = document.getElementById("msg");
    if (msg) {
      msg.textContent = `잘했어! 🎉 "${state.word}"`;
      msg.className = "msg good";
    }
    playFanfare();
    burstConfetti(60);
    setTimeout(() => speak(state.word), 200);
    setTimeout(startRound, 1800);
  }

  function finish() {
    const stars = mistakes <= 3 ? 3 : mistakes <= 8 ? 2 : 1;
    setStarsIfBetter("hangul-puzzle", stars);
    app.innerHTML = "";
    const end = document.createElement("div");
    end.className = "end";
    end.innerHTML = `
      <div class="big-emoji">🎉</div>
      <div class="msg good" style="font-size:32px">다 했다!</div>
      <div class="stars">${"⭐".repeat(stars)}</div>
      <div style="color:var(--ink-soft);font-size:18px">실수 ${mistakes}번</div>
      <button class="btn" id="again-btn" style="font-size:24px">또 할래</button>
      <button class="btn small secondary" id="home-btn">처음으로</button>
    `;
    app.appendChild(end);
    burstConfetti(100);
    document.getElementById("again-btn").addEventListener("click", () => startGame(app, { backToStart }));
    document.getElementById("home-btn").addEventListener("click", backToStart);
  }

  startRound();
}

function shuffle(a) {
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
