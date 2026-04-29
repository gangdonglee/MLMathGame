// 한글 자모 분해/조합 엔진
// 한글 글자 = 0xAC00 + (초성 idx * 21 * 28) + (중성 idx * 28) + 종성 idx
// 초성 19종, 중성 21종, 종성 28종 (인덱스 0 = 받침 없음)

export const CHO = ["ㄱ","ㄲ","ㄴ","ㄷ","ㄸ","ㄹ","ㅁ","ㅂ","ㅃ","ㅅ","ㅆ","ㅇ","ㅈ","ㅉ","ㅊ","ㅋ","ㅌ","ㅍ","ㅎ"];
export const JUNG = ["ㅏ","ㅐ","ㅑ","ㅒ","ㅓ","ㅔ","ㅕ","ㅖ","ㅗ","ㅘ","ㅙ","ㅚ","ㅛ","ㅜ","ㅝ","ㅞ","ㅟ","ㅠ","ㅡ","ㅢ","ㅣ"];
export const JONG = ["","ㄱ","ㄲ","ㄳ","ㄴ","ㄵ","ㄶ","ㄷ","ㄹ","ㄺ","ㄻ","ㄼ","ㄽ","ㄾ","ㄿ","ㅀ","ㅁ","ㅂ","ㅄ","ㅅ","ㅆ","ㅇ","ㅈ","ㅊ","ㅋ","ㅌ","ㅍ","ㅎ"];

const HANGUL_BASE = 0xAC00;
const HANGUL_LAST = 0xD7A3;

// 한 글자 → { cho, jung, jong } 또는 null (한글 아니면)
export function decompose(char) {
  const code = char.charCodeAt(0);
  if (code < HANGUL_BASE || code > HANGUL_LAST) return null;
  const offset = code - HANGUL_BASE;
  const choIdx = Math.floor(offset / (21 * 28));
  const jungIdx = Math.floor((offset % (21 * 28)) / 28);
  const jongIdx = offset % 28;
  return {
    cho: CHO[choIdx],
    jung: JUNG[jungIdx],
    jong: JONG[jongIdx], // "" 이면 받침 없음
  };
}

// 자모 → 한 글자
export function compose(cho, jung, jong = "") {
  const c = CHO.indexOf(cho);
  const j = JUNG.indexOf(jung);
  const jo = JONG.indexOf(jong || "");
  if (c < 0 || j < 0 || jo < 0) return null;
  return String.fromCharCode(HANGUL_BASE + c * 21 * 28 + j * 28 + jo);
}

// 단어 → 음절별 자모 배열
// "사과" → [{cho:"ㅅ",jung:"ㅏ",jong:""}, {cho:"ㄱ",jung:"ㅘ",jong:""}]
export function wordToSyllables(word) {
  return [...word].map((c) => decompose(c));
}

// 자모가 모음인지
export function isVowel(jamo) {
  return JUNG.includes(jamo);
}
// 자모가 자음인지 (cho 또는 단순 jong)
export function isConsonant(jamo) {
  return CHO.includes(jamo) || (JONG.includes(jamo) && jamo !== "");
}

// 단어에 필요한 모든 자모 (중복 포함)
export function neededJamos(word) {
  const out = [];
  for (const syl of wordToSyllables(word)) {
    if (!syl) continue;
    out.push(syl.cho, syl.jung);
    if (syl.jong) out.push(syl.jong);
  }
  return out;
}
