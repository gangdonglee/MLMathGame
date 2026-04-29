// 7살용 단어 풀. 레벨별로 난이도 조절.
// level 1: 1글자, 받침 없음, 기본 자모
// level 2: 2글자, 받침 없음, 기본 자모
// level 3: 1~2글자, 받침 등장 (단순 받침 위주)
// level 4: 2글자 + 쌍자음(ㄲㄸㅃㅆㅉ) 또는 받침 섞임
// level 5: 3글자 또는 복합 모음 (ㅘ ㅢ 등)

export const WORDS = [
  // ── Level 1: 1글자, 받침 없음 ───────────────
  { word: "코", emoji: "👃", level: 1 },
  { word: "비", emoji: "☔", level: 1 },
  { word: "해", emoji: "☀️", level: 1 },
  { word: "새", emoji: "🐦", level: 1 },
  { word: "개", emoji: "🐶", level: 1 },
  { word: "차", emoji: "🚗", level: 1 },
  { word: "배", emoji: "🍐", level: 1 },
  { word: "소", emoji: "🐄", level: 1 },

  // ── Level 2: 2글자, 받침 없음 ───────────────
  { word: "거미", emoji: "🕷️", level: 2 },
  { word: "나비", emoji: "🦋", level: 2 },
  { word: "오이", emoji: "🥒", level: 2 },
  { word: "우유", emoji: "🥛", level: 2 },
  { word: "다리", emoji: "🦵", level: 2 },
  { word: "포도", emoji: "🍇", level: 2 },
  { word: "두부", emoji: "🍢", level: 2 },
  { word: "지구", emoji: "🌏", level: 2 },

  // ── Level 3: 받침 등장 (1~2글자) ────────────
  { word: "곰", emoji: "🐻", level: 3 },
  { word: "산", emoji: "⛰️", level: 3 },
  { word: "별", emoji: "⭐", level: 3 },
  { word: "손", emoji: "✋", level: 3 },
  { word: "눈", emoji: "❄️", level: 3 },
  { word: "공", emoji: "⚽", level: 3 },
  { word: "달", emoji: "🌙", level: 3 },
  { word: "발", emoji: "🦶", level: 3 },
  { word: "책", emoji: "📚", level: 3 },

  // ── Level 4: 쌍자음 or 받침 + 2글자 ─────────
  { word: "토끼", emoji: "🐰", level: 4 },
  { word: "딸기", emoji: "🍓", level: 4 },
  { word: "꽃", emoji: "🌸", level: 4 },
  { word: "빵", emoji: "🍞", level: 4 },
  { word: "사람", emoji: "🧑", level: 4 },
  { word: "바람", emoji: "💨", level: 4 },

  // ── Level 5: 3글자 또는 복합 모음 ───────────
  { word: "사과", emoji: "🍎", level: 5 },
  { word: "호랑이", emoji: "🐯", level: 5 },
  { word: "자전거", emoji: "🚲", level: 5 },
  { word: "바나나", emoji: "🍌", level: 5 },
];

// 라운드별 단어 선택 (전체 10라운드, 레벨 분배)
// 1~2: level 1, 3~4: level 2, 5~6: level 3, 7~8: level 4, 9~10: level 5
export function pickRoundWords(totalRounds = 10) {
  const byLevel = { 1: [], 2: [], 3: [], 4: [], 5: [] };
  for (const w of WORDS) byLevel[w.level].push(w);
  for (const lv of Object.keys(byLevel)) shuffle(byLevel[lv]);

  // 레벨별 라운드 수 분배 (10 라운드 기준)
  const dist = { 1: 2, 2: 2, 3: 2, 4: 2, 5: 2 };
  const out = [];
  for (let lv = 1; lv <= 5; lv++) {
    const n = dist[lv];
    out.push(...byLevel[lv].slice(0, n));
  }
  return out.slice(0, totalRounds);
}

function shuffle(a) {
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
