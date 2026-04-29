// Web Audio API 로 합성하는 효과음. 외부 파일 0개.
let ctx = null;
let muted = false;

export function initAudio() {
  if (ctx) return;
  try {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (AC) ctx = new AC();
  } catch {}
}

export function setMuted(v) { muted = !!v; }

function tone({ freq = 440, dur = 0.15, type = "sine", gain = 0.18, slideTo = null, delay = 0 } = {}) {
  if (!ctx || muted) return;
  const t0 = ctx.currentTime + delay;
  const osc = ctx.createOscillator();
  const g = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t0);
  if (slideTo != null) osc.frequency.exponentialRampToValueAtTime(slideTo, t0 + dur);
  g.gain.setValueAtTime(0, t0);
  g.gain.linearRampToValueAtTime(gain, t0 + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  osc.connect(g).connect(ctx.destination);
  osc.start(t0);
  osc.stop(t0 + dur + 0.05);
}

export function playGood() {
  tone({ freq: 660, dur: 0.12, type: "triangle" });
  tone({ freq: 990, dur: 0.16, type: "triangle", delay: 0.08 });
}

export function playBad() {
  tone({ freq: 220, dur: 0.18, type: "sawtooth", gain: 0.12, slideTo: 110 });
}

export function playPop() {
  tone({ freq: 800, dur: 0.08, type: "square", gain: 0.14, slideTo: 1600 });
}

export function playFanfare() {
  const notes = [523, 659, 784, 1046];
  notes.forEach((f, i) => tone({ freq: f, dur: 0.2, type: "triangle", delay: i * 0.12 }));
}

export function playClick() {
  tone({ freq: 500, dur: 0.05, type: "square", gain: 0.08 });
}
