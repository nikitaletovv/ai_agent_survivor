/* ============================================================
   AI Agent Survivors — the hero: a cartoonish AI assistant bot.
   Health = context window. Spent only on errors.
   ============================================================ */
'use strict';

const Player = {
  x: 0, y: 0, vx: 0, vy: 0,
  r: 16,
  dir: 1,
  lookX: 1, lookY: 0,
  animT: 0,
  moving: false,

  context: 100, maxContext: 100,
  metaRegen: 0,
  iframes: 0,
  hurtFlash: 0,
  slowFactor: 1,

  level: 1, xp: 0, xpNext: 12,

  // passives
  dmgMul: 1,
  fireMul: 1,
  moveMul: 1,
  magnetMul: 1,
  areaMul: 1,
  projSpeedMul: 1,
  ctxRegenLvl: 0,
  armor: 0,
  luck: 0,
  projCountMul: 0,

  get pickRadius() { return CFG.player.pickRadius * this.magnetMul; },
  get contextPct() { return this.context / this.maxContext; },

  reset() {
    this.x = 0; this.y = 0; this.vx = 0; this.vy = 0;
    this.maxContext = CFG.player.maxContext;
    this.context = this.maxContext;
    this.metaRegen = 0;
    this.iframes = 0; this.hurtFlash = 0; this.slowFactor = 1;
    this.level = 1; this.xp = 0;
    this.xpNext = this._nextXp();
    this.dmgMul = 1; this.fireMul = 1; this.moveMul = 1; this.magnetMul = 1;
    this.areaMul = 1; this.projSpeedMul = 1; this.ctxRegenLvl = 0;
    this.armor = 0; this.luck = 0; this.projCountMul = 0;
    this.dir = 1;
  },

  _nextXp() {
    const l = this.level;
    return Math.round(CFG.xp.base * Math.pow(CFG.xp.growth, l - 1)) + CFG.xp.linear * (l - 1);
  },

  addContext(v) {
    this.context = Math.min(this.maxContext, this.context + v);
  },

  addXP(v) {
    this.xp += v;
    let leveled = false;
    while (this.xp >= this.xpNext) {
      this.xp -= this.xpNext;
      this.level++;
      this.xpNext = this._nextXp();
      leveled = true;
    }
    if (leveled) {
      AudioSys_.sfx('levelup');
      Game.addScore(CFG.score.levelBonus);
      UI.openLevelUp();
      Particles.shock(this.x, this.y, CFG.palette.cyan, 130, 0.6);
      for (let i = 0; i < 18; i++)
        Particles.spark(this.x, this.y, CFG.palette.cyan, { speed: U.rand(120, 300), life: 0.6 });
    }
  },

  applyPassive(id, levels) {
    switch (id) {
      case 'damage': this.dmgMul += 0.18 * levels; break;
      case 'fireRate': this.fireMul += 0.14 * levels; break;
      case 'moveSpeed': this.moveMul += 0.10 * levels; break;
      case 'magnet': this.magnetMul += 0.35 * levels; break;
      case 'area': this.areaMul += 0.16 * levels; break;
      case 'projSpeed': this.projSpeedMul += 0.14 * levels; break;
      case 'context': this.maxContext += 22; this.context += 22; break;
      case 'contextRegen': this.ctxRegenLvl += levels; break;
      case 'armor': this.armor += 2.2 * levels; this.armorLvl += levels; break;
      case 'luck': this.luck += 1; break;
      case 'projCount': this.projCountMul += 0.5; break;
    }
  },

  hurt(amount, sourceName) {
    if (this.iframes > 0 || Game.state !== 'playing') return;
    const dmg = Math.max(1, amount - this.armor);
    this.context -= dmg;
    this.iframes = CFG.player.iframes;
    this.hurtFlash = 1;
    AudioSys_.sfx('hurt');
    Game.shake(7, 0.3);
    Particles.explode(this.x, this.y, '#ff3b52', { n: 8, speed: 200, r: 46 });
    Particles.text(this.x, this.y - 26, '-' + Math.round(dmg), '#ff3b52', 15);
    if (this.context <= 0) {
      this.context = 0;
      Game.gameOver();
    }
  },

  update(dt) {
    const keys = Input.keys;
    let dx = 0, dy = 0;
    if (keys['KeyW'] || keys['ArrowUp']) dy -= 1;
    if (keys['KeyS'] || keys['ArrowDown']) dy += 1;
    if (keys['KeyA'] || keys['ArrowLeft']) dx -= 1;
    if (keys['KeyD'] || keys['ArrowRight']) dx += 1;

    this.moving = dx !== 0 || dy !== 0;
    if (this.moving) {
      const l = Math.hypot(dx, dy);
      dx /= l; dy /= l;
      // шины данных ускоряют всех — и игрока тоже
      const sp = CFG.player.speed * this.moveMul * this.slowFactor * (World.onBus(this.x, this.y) ? 1.45 : 1);
      this.vx = dx * sp; this.vy = dy * sp;
      if (dx !== 0) this.dir = dx > 0 ? 1 : -1;
      this.lookX = U.lerp(this.lookX, dx, 0.15);
      this.lookY = U.lerp(this.lookY, dy, 0.15);
    } else {
      this.vx *= 0.6; this.vy *= 0.6;
    }

    this.x += this.vx * dt;
    this.y += this.vy * dt;

    // world and CAPTCHA collisions
    World.resolveCollision(this);
    Enemies.resolveBlocks(this);

    // timers
    this.animT += this.moving ? dt * 9 : dt * 2;
    this.iframes = Math.max(0, this.iframes - dt);
    this.hurtFlash = Math.max(0, this.hurtFlash - dt * 2.5);
    this.slowFactor = 1;

    // постоянного расхода контекста больше нет: тратится только от ошибок.
    // «Context Cache» и подписка «Безлимит Плюс» медленно восстанавливают его
    const regen = 0.35 * this.ctxRegenLvl + this.metaRegen;
    if (regen > 0) this.addContext(regen * dt);

    // movement trail
    if (this.moving && Math.random() < 0.5)
      Particles.trail(this.x + U.rand(-6, 6), this.y + U.rand(-2, 8), 'rgba(0,220,255,0.6)', 4, 0.35);
  },

  draw(ctx, t) {
    const blink = this.iframes > 0 && Math.floor(t * 14) % 2 === 0;
    ctx.save();
    ctx.translate(this.x, this.y);
    if (blink) ctx.globalAlpha = 0.4;

    // ground glow
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    const g = ctx.createRadialGradient(0, 4, 0, 0, 4, 34);
    g.addColorStop(0, 'rgba(0,220,255,0.35)');
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(0, 4, 34, 0, U.TAU); ctx.fill();
    ctx.restore();

    const bob = Math.sin(this.animT) * 2;
    const lean = this.moving ? U.clamp(this.vx / 600, -0.2, 0.2) : 0;
    ctx.rotate(lean);
    ctx.translate(0, bob * 0.4);

    const C = CFG.player.colors;

    // legs (little hover pads)
    const legPh = Math.sin(this.animT * 2) * 4;
    ctx.strokeStyle = C.accents;
    ctx.lineWidth = 3;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(-6, 10); ctx.lineTo(-7, 16 + legPh * 0.3);
    ctx.moveTo(6, 10); ctx.lineTo(7, 16 - legPh * 0.3);
    ctx.stroke();

    // body capsule
    ctx.fillStyle = C.body;
    ctx.strokeStyle = C.edge;
    ctx.lineWidth = 2.4;
    ctx.shadowColor = C.glow; ctx.shadowBlur = 12;
    roundRectPath(ctx, -12, -6, 24, 20, 8);
    ctx.fill(); ctx.stroke();
    ctx.shadowBlur = 0;

    // chest indicator: context bar on the bot
    const pct = this.contextPct;
    ctx.fillStyle = 'rgba(4,14,24,0.9)';
    ctx.fillRect(-8, -1, 16, 4);
    ctx.fillStyle = pct > 0.35 ? '#2fd6ff' : (pct > 0.15 ? '#ffd24a' : '#ff3b52');
    ctx.fillRect(-8, -1, 16 * pct, 4);

    // head: rounded chip with visor
    ctx.fillStyle = '#0d3550';
    ctx.strokeStyle = C.edge;
    ctx.shadowColor = C.glow; ctx.shadowBlur = 14;
    roundRectPath(ctx, -13, -26, 26, 20, 9);
    ctx.fill(); ctx.stroke();
    ctx.shadowBlur = 0;

    // visor / eye looks toward movement
    const ex = U.clamp(this.lookX * 4, -4, 4) + this.dir * 1.5;
    const ey = -16 + U.clamp(this.lookY * 3, -2.5, 2.5);
    ctx.fillStyle = '#05121d';
    roundRectPath(ctx, -9, -21, 18, 10, 5);
    ctx.fill();
    const pulse = 0.75 + 0.25 * Math.sin(t * 5);
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    const eg = ctx.createRadialGradient(ex, ey, 0, ex, ey, 6);
    eg.addColorStop(0, 'rgba(190,250,255,' + pulse + ')');
    eg.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = eg;
    ctx.beginPath(); ctx.arc(ex, ey, 6, 0, U.TAU); ctx.fill();
    ctx.restore();
    ctx.fillStyle = C.eye;
    ctx.beginPath(); ctx.arc(ex, ey, 2.2, 0, U.TAU); ctx.fill();

    // antenna with blinking beacon
    ctx.strokeStyle = C.accents;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, -26); ctx.lineTo(4 * this.dir, -34);
    ctx.stroke();
    const bl = Math.sin(t * 4) > 0;
    if (bl) {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.fillStyle = '#2fd6ff';
      ctx.beginPath(); ctx.arc(4 * this.dir, -35, 3, 0, U.TAU); ctx.fill();
      ctx.restore();
    }

    // ears / side modules
    ctx.fillStyle = '#0d3550';
    ctx.strokeStyle = C.edge;
    ctx.lineWidth = 2;
    ctx.fillRect(-17, -18, 4, 8); ctx.strokeRect(-17, -18, 4, 8);
    ctx.fillRect(13, -18, 4, 8); ctx.strokeRect(13, -18, 4, 8);

    // hurt flash
    if (this.hurtFlash > 0) {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = this.hurtFlash * 0.5;
      ctx.fillStyle = '#ff3b52';
      roundRectPath(ctx, -13, -26, 26, 40, 9);
      ctx.fill();
      ctx.restore();
    }
    ctx.restore();
  },
};

function roundRectPath(ctx, x, y, w, h, r) {
  r = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}
