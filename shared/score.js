// 별 점수 (localStorage)
const KEY = "hangul-puzzle-stars-v1";

function readAll() {
  try { return JSON.parse(localStorage.getItem(KEY) || "{}"); }
  catch { return {}; }
}
function writeAll(o) { try { localStorage.setItem(KEY, JSON.stringify(o)); } catch {} }

export function getStars(id = "default") { return readAll()[id] || 0; }
export function setStarsIfBetter(id = "default", stars) {
  const all = readAll();
  if ((all[id] || 0) < stars) {
    all[id] = stars;
    writeAll(all);
    return true;
  }
  return false;
}
