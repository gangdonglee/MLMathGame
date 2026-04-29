// 게임별 최고 별 점수 저장 (localStorage)
const KEY = "math-game-stars-v1";

function readAll() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return {};
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

function writeAll(obj) {
  try { localStorage.setItem(KEY, JSON.stringify(obj)); } catch {}
}

export function getStars(gameId) {
  return readAll()[gameId] || 0;
}

export function setStarsIfBetter(gameId, stars) {
  const all = readAll();
  if ((all[gameId] || 0) < stars) {
    all[gameId] = stars;
    writeAll(all);
    return true;
  }
  return false;
}

export function resetAll() {
  writeAll({});
}
