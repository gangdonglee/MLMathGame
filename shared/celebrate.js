// 색종이 confetti 캔버스. main.js 가 한 번 마운트하면 모든 게임이 burstConfetti() 호출 가능.
let canvas = null;
let ctx = null;
let particles = [];
let raf = null;

export function mountConfettiCanvas() {
  canvas = document.createElement("canvas");
  canvas.id = "confetti";
  document.body.appendChild(canvas);
  ctx = canvas.getContext("2d");
  resize();
  window.addEventListener("resize", resize);
}

function resize() {
  if (!canvas) return;
  const dpr = window.devicePixelRatio || 1;
  canvas.width = window.innerWidth * dpr;
  canvas.height = window.innerHeight * dpr;
  canvas.style.width = window.innerWidth + "px";
  canvas.style.height = window.innerHeight + "px";
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}

const COLORS = ["#ff8a4c", "#ffd166", "#6dd47e", "#6cb6ff", "#ff9ec7", "#b58cff"];

export function burstConfetti(count = 80) {
  if (!ctx) return;
  const W = window.innerWidth;
  for (let i = 0; i < count; i++) {
    particles.push({
      x: W / 2 + (Math.random() - 0.5) * 80,
      y: window.innerHeight * 0.45,
      vx: (Math.random() - 0.5) * 8,
      vy: -Math.random() * 10 - 4,
      g: 0.35,
      size: 6 + Math.random() * 6,
      rot: Math.random() * Math.PI,
      vr: (Math.random() - 0.5) * 0.3,
      color: COLORS[Math.floor(Math.random() * COLORS.length)],
      life: 80 + Math.random() * 40,
    });
  }
  if (!raf) loop();
}

function loop() {
  ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);
  particles = particles.filter((p) => p.life > 0 && p.y < window.innerHeight + 40);
  for (const p of particles) {
    p.vy += p.g;
    p.x += p.vx;
    p.y += p.vy;
    p.rot += p.vr;
    p.life -= 1;
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate(p.rot);
    ctx.fillStyle = p.color;
    ctx.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2);
    ctx.restore();
  }
  if (particles.length > 0) {
    raf = requestAnimationFrame(loop);
  } else {
    raf = null;
  }
}
