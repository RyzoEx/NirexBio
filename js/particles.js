/**
 * Ambient Cyber Dust & Glow Particles
 */
class ParticleBackground {
  constructor(canvasId) {
    this.canvas = document.getElementById(canvasId);
    if (!this.canvas) return;

    this.ctx = this.canvas.getContext("2d");
    this.particles = [];
    this.count = 45;
    this.width = 0;
    this.height = 0;

    this.init();
  }

  init() {
    this.resize();
    window.addEventListener("resize", () => this.resize());

    // Create particles
    for (let i = 0; i < this.count; i++) {
      this.particles.push({
        x: Math.random() * this.width,
        y: Math.random() * this.height,
        size: Math.random() * 2.2 + 0.6,
        speedX: (Math.random() - 0.5) * 0.4,
        speedY: -Math.random() * 0.7 - 0.2, // drifting upwards
        opacity: Math.random() * 0.6 + 0.2,
        color: Math.random() > 0.4 ? "rgba(168, 85, 247, " : "rgba(56, 189, 248, ", // purple or cyan
        pulsing: Math.random() * 0.02 + 0.005,
        pulseDir: 1
      });
    }

    this.animate();
  }

  resize() {
    this.width = this.canvas.width = window.innerWidth;
    this.height = this.canvas.height = window.innerHeight;
  }

  animate() {
    this.ctx.clearRect(0, 0, this.width, this.height);

    for (let p of this.particles) {
      p.x += p.speedX;
      p.y += p.speedY;

      // Pulse opacity
      p.opacity += p.pulsing * p.pulseDir;
      if (p.opacity > 0.8) {
        p.pulseDir = -1;
      } else if (p.opacity < 0.2) {
        p.pulseDir = 1;
      }

      // Wrap around edges
      if (p.y < 0) {
        p.y = this.height + 10;
        p.x = Math.random() * this.width;
      }
      if (p.x < 0) p.x = this.width;
      if (p.x > this.width) p.x = 0;

      // Draw particle
      this.ctx.beginPath();
      this.ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      this.ctx.fillStyle = p.color + p.opacity + ")";
      this.ctx.shadowBlur = 10;
      this.ctx.shadowColor = p.color + "0.8)";
      this.ctx.fill();
    }

    requestAnimationFrame(this.animate.bind(this));
  }
}

window.ParticleBackground = ParticleBackground;
