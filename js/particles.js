/* ============================================================
   AI Agent Survivors — particle system (pooled)
   Effects: sparks, rings, shockwaves, floating text, trails.
   ============================================================ */
'use strict';

const Particles = {
  pool: null,
  budget: 700,

  init() {
    this.pool = new U.Pool(() => ({
      dead: false, x: 0, y: 0, vx: 0, vy: 0, life: 0, maxLife: 1,
      size: 3, color: '#fff', kind: 'spark', text: '', rot: 0, spin: 0,
      drag: 1, grav: 0, r: 0, grow: 0, ringR: 0, ringR2: 0,
    }));
  },

  setBudget(n) { this.budget = n; },

  count() { return this.pool ? this.pool.active.length : 0; },

  spark(x, y, color, opt) {
    if (this.count() >= this.budget) return;
    const p = this.pool.get();
    const o = opt || {};
    const sp = o.speed || U.rand(60, 240);
    const a = o.angle !== undefined ? o.angle + U.rand(-0.6, 0.6) : U.rand(0, U.TAU);
    p.kind = 'spark';
    p.x = x; p.y = y;
    p.vx = Math.cos(a) * sp; p.vy = Math.sin(a) * sp;
    p.maxLife = p.life = o.life || U.rand(0.25, 0.6);
    p.size = o.size || U.rand(1.5, 3.5);
    p.color = color;
    p.drag = o.drag || 2.2;
    p.grav = o.grav || 0;
  },

  ring(x, y, color, opt) {
    if (this.count() >= this.budget) return;
    const p = this.pool.get();
    const o = opt || {};
    p.kind = 'ring';
    p.x = x; p.y = y;
    p.ringR = o.r0 || 6;
    p.ringR2 = o.r1 || 60;
    p.maxLife = p.life = o.life || 0.4;
    p.color = color;
    p.size = o.width || 3;
  },

  text(x, y, str, color, size) {
    if (this.count() >= this.budget) return;
    const p = this.pool.get();
    p.kind = 'text';
    p.x = x; p.y = y;
    p.vy = -46; p.vx = U.rand(-14, 14);
    p.maxLife = p.life = 0.7;
    p.text = str; p.color = color; p.size = size || 13;
  },

  trail(x, y, color, size, life) {
    if (this.count() >= this.budget) return;
    const p = this.pool.get();
    p.kind = 'glow';
    p.x = x; p.y = y;
    p.vx = U.rand(-8, 8); p.vy = U.rand(-8, 8);
    p.maxLife = p.life = life || 0.4;
    p.size = size || 5;
    p.color = color;
  },

  shock(x, y, color, r1, life) {
    this.ring(x, y, color, { r0: 8, r1: r1 || 90, life: life || 0.45, width: 5 });
  },

  explode(x, y, color, opt) {
    const o = opt || {};
    const n = o.n || 14;
    for (let i = 0; i < n; i++) this.spark(x, y, color, { speed: U.rand(80, o.speed || 320), life: U.rand(0.3, 0.7), size: U.rand(2, 4.5) });
    this.ring(x, y, color, { r0: 4, r1: o.r || 70, life: 0.35, width: 3 });
  },

  update(dt) {
    if (!this.pool) return;
    for (const p of this.pool.active) {
      p.life -= dt;
      if (p.life <= 0) { p.dead = true; continue; }
      if (p.kind !== 'ring') {
        p.x += p.vx * dt; p.y += p.vy * dt;
        const d = Math.max(0, 1 - p.drag * dt);
        p.vx *= d; p.vy *= d;
        if (p.grav) p.vy += p.grav * dt;
      }
    }
    this.pool.sweep();
  },

  draw(ctx) {
    if (!this.pool) return;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (const p of this.pool.active) {
      const t = p.life / p.maxLife;
      if (p.kind === 'spark') {
        ctx.globalAlpha = t;
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size * (0.4 + 0.6 * t), 0, U.TAU);
        ctx.fill();
      } else if (p.kind === 'glow') {
        ctx.globalAlpha = t * 0.7;
        const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.size * 2.5);
        g.addColorStop(0, p.color);
        g.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size * 2.5, 0, U.TAU);
        ctx.fill();
      } else if (p.kind === 'ring') {
        const r = U.lerp(p.ringR, p.ringR2, 1 - t);
        ctx.globalAlpha = t * 0.9;
        ctx.strokeStyle = p.color;
        ctx.lineWidth = p.size * t;
        ctx.beginPath();
        ctx.arc(p.x, p.y, r, 0, U.TAU);
        ctx.stroke();
      } else if (p.kind === 'text') {
        ctx.globalAlpha = Math.min(1, t * 1.6);
        ctx.fillStyle = p.color;
        ctx.font = 'bold ' + p.size + 'px "Segoe UI", sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(p.text, p.x, p.y);
      }
    }
    ctx.restore();
  },

  clear() { if (this.pool) this.pool.active = []; },
};
