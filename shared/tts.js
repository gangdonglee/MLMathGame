// 한국어 TTS (Web Speech API). 모바일 사파리에서 가끔 안 됨 — 핵심 기능 X, 보조용
let ready = false;
let voiceKo = null;

function loadVoice() {
  if (!("speechSynthesis" in window)) return;
  const voices = speechSynthesis.getVoices();
  voiceKo = voices.find((v) => v.lang && v.lang.startsWith("ko"));
  ready = true;
}

if (typeof window !== "undefined" && "speechSynthesis" in window) {
  loadVoice();
  speechSynthesis.addEventListener?.("voiceschanged", loadVoice);
}

export function speak(text) {
  if (!("speechSynthesis" in window)) return;
  try {
    speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = "ko-KR";
    if (voiceKo) u.voice = voiceKo;
    u.rate = 0.85;
    u.pitch = 1.1;
    u.volume = 1.0;
    speechSynthesis.speak(u);
  } catch {}
}

export function isAvailable() {
  return "speechSynthesis" in window;
}
