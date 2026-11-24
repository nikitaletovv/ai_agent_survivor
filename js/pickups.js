/* ============================================================
   AI Agent Survivors — data pickups (information sources)
   Rarity tiers give different XP / context restoration / score.
   ============================================================ */
'use strict';

const Pickups = {
  list: [],
  magnetPulse: 0,

  init() { this.list = []; },

  /* Drop table weights scale with elapsed time for rarer sources. */
  // role определяет значок под источником:
  // зелёный плюс = восстанавливает контекст, жёлтый ромб = даёт опыт, оба значка = и то и другое
  types: [
    { id: 'snippet', name: 'Сниппет', xp: 0.5, ctx: 0.6, score: 2, weight: 42, r: 9, color: '#39ff88', role: 'heal' },
    { id: 'result', name: 'Результат поиска', xp: 2, ctx: 0.3, score: 3, weight: 26, r: 10, color: '#5fd8ff', role: 'xp' },
    { id: 'page', name: 'Веб-страница', xp: 6, ctx: 1.0, score: 6, weight: 16, r: 12, color: '#00e5ff', role: 'xp' },
    { id: 'api', name: 'Ответ API', xp: 9, ctx: 1.2, score: 9, weight: 9, r: 12, color: '#a55bff', role: 'xp' },
    { id: 'doc', name: 'Документ PDF', xp: 18, ctx: 4.5, score: 22, weight: 4, r: 14, color: '#e8f6ff', role: 'both' },
    { id: 'plugin', name: 'Плагин', xp: 34, ctx: 2.0, score: 40, weight: 2, r: 15, color: '#ffd24a', role: 'xp' },
    { id: 'vial', name: 'Контейнер контекста', xp: 2, ctx: 18, score: 26, weight: 1, r: 14, color: '#3f7bff', role: 'heal' },
  ],

  /** Choose a pickup type by weighted rarity. */
  rollType(luck) {
    return U.weighted(this.types);
  },

  spawn(x, y, typeId) {
    if (this.list.length > 600) this.list.shift();
    const def = typeId ? this.types.find(t => t.id === typeId) : this.rollType(0);
    // keep loot off building footprints so it never spawns somewhere unreachable
    for (let i = 0; i < 8; i++) {
      const near = World.collidersNear(x, y, 30);
      let inside = false;
      for (const b of near) {
        if (x > b.x - 16 && x < b.x + b.w + 16 && y > b.y - 16 && y < b.y + b.h + 16) { inside = true; break; }
      }
      if (!inside) break;
      x += U.rand(-150, 150);
      y += U.rand(-150, 150);
    }
    this.list.push({ def, x, y, t: U.rand(0, U.TAU), pull: 0, dead: false, born: Game.time });
  },

  spawnFromEnemy(e) {
    // «КДЕКС»: пока лимит сеанса активен, новые данные не выпадают —
    // собирать можно только уже выпавшее. Лут самого босса выпадает всегда:
    // убить его и значит сбросить лимит
    if (Enemies.limitActive && !e.boss) return;
    const luck = Player.luck || 0;
    let type;
    if (e.boss) type = Math.random() < 0.5 ? 'plugin' : 'vial';
    else if (e.elite) type = U.weighted([
    { w: 26, id: 'api' }, { w: 24, id: 'doc' }, { w: 20, id: 'plugin' }, { w: 18, id: 'vial' }, { w: 12, id: 'magnet' },
    ]).id;
    else type = null; // standard roll
    if (type) {
      if (type === 'magnet') this.spawnMagnet(e.x, e.y);
      else this.spawn(e.x, e.y, type);
      if (e.boss) { for (let i = 0; i < 6; i++) this.spawn(e.x + U.rand(-60, 60), e.y + U.rand(-60, 60), 'page'); }
      return;
    }
    const chance = 0.5 + luck * 0.04;
    if (Math.random() < chance) {
      const big = Math.random() < 0.04 + luck * 0.01;
      this.spawn(e.x + U.rand(-6, 6), e.y + U.rand(-6, 6), big ? (Math.random() < 0.6 ? 'doc' : 'api') : null);
    }
  },

  spawnMagnet(x, y) {
    this.list.push({ def: { id: 'magnet', name: 'Магнетрон данных', xp: 0, ctx: 4, score: 10, r: 13, color: '#ff9a1f' }, x, y, t: 0, pull: 0, dead: false, born: Game.time, magnet: true });
  },

  update(dt) {
    const px = Player.x, py = Player.y;
    const baseR = Player.pickRadius;
    for (const p of this.list) {
      p.t += dt * 3;
      // данные НЕ притягиваются сами — за ними нужно возвращаться,
      // иначе бег в одну сторону делал бы расход контекста бессмысленным
      const d = U.dist(p.x, p.y, px, py);
      const R = p.magnet ? baseR : baseR;
      if (d < R + 30) p.pull = Math.min(1, p.pull + dt * 3.4);
      if (p.pull > 0 || d < R) {
        const sp = 120 + p.pull * 460;
        const dx = px - p.x, dy = py - p.y;
        const l = Math.hypot(dx, dy) || 1;
        p.x += dx / l * sp * dt;
        p.y += dy / l * sp * dt;
      }
      if (d < 20) this.collect(p);
    }
    this.list = this.list.filter(p => !p.dead);
  },

  collect(p) {
    if (p.dead) return;
    p.dead = true;
    if (p.magnet) {
      AudioSys_.sfx('pickupRare');
      for (const q of this.list) {
        if (q !== p && !q.dead && !q.magnet) { q.pull = 1; }
      }
      Particles.shock(p.x, p.y, '#ff9a1f', 160, 0.5);
      UI.announce('МАГНИТ ДАННЫХ', '#ff9a1f');
    }
    Player.addContext(p.def.ctx);
    Player.addXP(p.def.xp);
    Game.addScore(p.def.score);
    AudioSys_.sfx(p.def.xp >= 20 ? 'pickupRare' : 'pickup');
    Particles.spark(p.x, p.y, p.def.color, { n: 5, speed: 130, life: 0.35 });
    if (p.def.xp >= 8) Particles.text(p.x, p.y - 10, '+' + p.def.xp + ' XP', p.def.color, 12);
  },

  draw(ctx, x0, y0, vw, vh, t) {
    for (const p of this.list) {
      if (p.x < x0 - 40 || p.x > x0 + vw + 40 || p.y < y0 - 40 || p.y > y0 + vh + 40) continue;
      const bob = Math.sin(p.t) * 3;
      const y = p.y + bob;
      const c = p.def.color;
      ctx.save();
      // ground glow
      ctx.globalCompositeOperation = 'lighter';
      const g = ctx.createRadialGradient(p.x, y, 0, p.x, y, 22);
      g.addColorStop(0, c);
      g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.globalAlpha = 0.5;
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(p.x, y, 22, 0, U.TAU); ctx.fill();
      ctx.restore();

      ctx.save();
      ctx.translate(p.x, y);
      ctx.strokeStyle = c;
      ctx.fillStyle = c;
      ctx.lineWidth = 2;
      const r = p.def.r;
      switch (p.def.id) {
        case 'snippet': // small triangle
          ctx.beginPath();
          ctx.moveTo(0, -r); ctx.lineTo(r * 0.85, r * 0.7); ctx.lineTo(-r * 0.85, r * 0.7);
          ctx.closePath(); ctx.fill();
          break;
        case 'result': // circle with lens handle
          ctx.beginPath(); ctx.arc(-2, 0, r * 0.55, 0, U.TAU); ctx.stroke();
          ctx.beginPath(); ctx.moveTo(r * 0.28, r * 0.28); ctx.lineTo(r, r); ctx.stroke();
          break;
        case 'page': // little page
          ctx.fillStyle = 'rgba(8,20,34,0.9)';
          ctx.fillRect(-r * 0.6, -r, r * 1.2, r * 2);
          ctx.strokeRect(-r * 0.6, -r, r * 1.2, r * 2);
          ctx.beginPath();
          for (let i = 0; i < 3; i++) { ctx.moveTo(-r * 0.35, -r * 0.45 + i * r * 0.55); ctx.lineTo(r * 0.35, -r * 0.45 + i * r * 0.55); }
          ctx.stroke();
          break;
        case 'api': // curly braces
          ctx.font = 'bold 15px monospace';
          ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
          ctx.fillText('{ }', 0, 1);
          break;
        case 'doc': // document with folded corner
          ctx.fillStyle = 'rgba(16,26,40,0.95)';
          ctx.beginPath();
          ctx.moveTo(-r * 0.55, -r); ctx.lineTo(r * 0.25, -r);
          ctx.lineTo(r * 0.55, -r * 0.6); ctx.lineTo(r * 0.55, r);
          ctx.lineTo(-r * 0.55, r); ctx.closePath();
          ctx.fill(); ctx.stroke();
          ctx.beginPath();
          for (let i = 0; i < 3; i++) { ctx.moveTo(-r * 0.3, -r * 0.35 + i * r * 0.55); ctx.lineTo(r * 0.3, -r * 0.35 + i * r * 0.55); }
          ctx.stroke();
          break;
        case 'plugin': // gear-ish module
          ctx.fillStyle = 'rgba(30,24,6,0.9)';
          ctx.beginPath();
          for (let i = 0; i < 8; i++) {
            const a = i / 8 * U.TAU;
            const rr = i % 2 ? r * 0.62 : r;
            const x = Math.cos(a) * rr, yy = Math.sin(a) * rr;
            i ? ctx.lineTo(x, yy) : ctx.moveTo(x, yy);
          }
          ctx.closePath(); ctx.fill(); ctx.stroke();
          ctx.fillStyle = '#221a02';
          ctx.beginPath(); ctx.arc(0, 0, r * 0.3, 0, U.TAU); ctx.fill();
          break;
        case 'vial': // context container
          ctx.fillStyle = 'rgba(8,18,40,0.9)';
          ctx.beginPath();
          ctx.rect(-r * 0.45, -r, r * 0.9, r * 2);
          ctx.fill(); ctx.stroke();
          ctx.fillStyle = 'rgba(90,160,255,0.8)';
          ctx.fillRect(-r * 0.3, -r * 0.2 + Math.sin(t * 4) * 2, r * 0.6, r * 1.0);
          break;
        case 'magnet': // pulsing magnet
          const s2 = 1 + 0.2 * Math.sin(t * 6);
          ctx.scale(s2, s2);
          ctx.beginPath(); ctx.arc(0, 0, r, 0, U.TAU); ctx.stroke();
          ctx.beginPath(); ctx.arc(0, 0, r * 0.45, 0, U.TAU); ctx.stroke();
          break;
      }
      // role badges so heal vs xp is readable at a glance
      const role = p.magnet ? 'heal' : (p.def.role || 'both');
      if (role === 'heal' || role === 'both') this._badgePlus(ctx, role === 'both' ? -8 : 0, r + 9);
      if (role === 'xp' || role === 'both') this._badgeDiamond(ctx, role === 'both' ? 8 : 0, r + 9);
      ctx.restore();
    }
  },

  _badgePlus(ctx, x, y) {
    ctx.lineCap = 'round';
    ctx.strokeStyle = 'rgba(0,0,0,0.85)'; ctx.lineWidth = 7;
    ctx.beginPath(); ctx.moveTo(x - 5, y); ctx.lineTo(x + 5, y); ctx.moveTo(x, y - 5); ctx.lineTo(x, y + 5); ctx.stroke();
    ctx.strokeStyle = '#39ff88'; ctx.lineWidth = 3.2;
    ctx.beginPath(); ctx.moveTo(x - 5, y); ctx.lineTo(x + 5, y); ctx.moveTo(x, y - 5); ctx.lineTo(x, y + 5); ctx.stroke();
    ctx.lineCap = 'butt';
  },

  _badgeDiamond(ctx, x, y) {
    ctx.fillStyle = 'rgba(0,0,0,0.85)';
    ctx.beginPath();
    ctx.moveTo(x, y - 6.5); ctx.lineTo(x + 5, y); ctx.lineTo(x, y + 6.5); ctx.lineTo(x - 5, y);
    ctx.closePath(); ctx.fill();
    ctx.strokeStyle = '#ffd24a'; ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x, y - 6.5); ctx.lineTo(x + 5, y); ctx.lineTo(x, y + 6.5); ctx.lineTo(x - 5, y);
    ctx.closePath(); ctx.stroke();
  },

  clear() { this.list = []; },
};
