/* ============================================================
   AI Agent Survivors — automatic weapons and passives
   Six weapon families with 8 levels and evolved final forms.
   ============================================================ */
'use strict';

const Weapons = {
  slots: [],            // {id, lvl, cd, evolved, phase}
  maxSlots: 5,
  projectiles: [],
  orbs: [],             // orbiting browser tabs
  bolts: [],            // api lightning visuals
  novas: [],            // cache cleanup rings
  zones: [],            // persistent damage zones (evolutions)
  projPool: null,

  init() {
    this.slots = [];
    this.projectiles = [];
    this.orbs = []; this.bolts = []; this.novas = []; this.zones = [];
  },

  has(id) { return this.slots.some(s => s.id === id); },
  get(id) { return this.slots.find(s => s.id === id); },

  addOrLevel(id) {
    const ex = this.get(id);
    if (ex) { ex.lvl = Math.min(this.defs[id].maxLevel, ex.lvl + 1); Meta.encounter(id); return ex; }
    if (this.slots.length >= this.maxSlots) return null;
    const s = { id, lvl: 1, cd: 0.4, evolved: false, phase: 0, angle: 0 };
    this.slots.push(s);
    Meta.encounter(id);
    this._refreshOrbs();
    return s;
  },

  /* ------------- definitions ------------- */
  defs: {
    websearch: {
      name: 'Web Search', maxLevel: 8, icon: 'search', color: '#00e5ff',
      desc: 'Самонаводящиеся запросы в ближайшие ошибки. Автоматический залп каждые ~1.5 с.',
      stats(l) { return { dmg: 10 + l * 4, cd: 1.5 - l * 0.09, count: 1 + Math.floor(l / 2), speed: 420, r: 7, homing: 3.2 }; },
      evolve: { id: 'deepresearch', name: 'Deep Research', desc: 'Тяжёлые самонаводящиеся лучи, втрое больше урона.', color: '#00e5ff' },
    },
    tokenstream: {
      name: 'Token Stream', maxLevel: 8, icon: 'stream', color: '#5fd8ff',
      desc: 'Поток токенов в сторону ближайшей ошибки. Стреляет непрерывно, 3–4 снаряда в секунду.',
      stats(l) { return { dmg: 5 + l * 2, cd: 0.34 - l * 0.02, count: 1 + Math.floor(l / 3), speed: 640, r: 5, pierce: 1 + Math.floor(l / 3) }; },
      evolve: { id: 'contextoverflow', name: 'Context Overflow', desc: 'Непрерывный поток, пробивающий всё насквозь.', color: '#5fd8ff' },
    },
    browsertabs: {
      name: 'Browser Tabs', maxLevel: 8, icon: 'tabs', color: '#ff9a1f',
      desc: 'Вкладки постоянно кружат вокруг агента и бьют всё, что коснутся. Не требует перезарядки.',
      stats(l) { return { dmg: 7 + l * 3, count: 2 + Math.floor(l / 2), radius: 62 + l * 7, speed: 2.4 }; },
      evolve: { id: 'multiverse', name: 'Multiverse Browser', desc: 'Восемь гигантских вкладок, двойной урон.', color: '#ff9a1f' },
    },
    apicalls: {
      name: 'API Calls', maxLevel: 8, icon: 'api', color: '#a55bff',
      desc: 'Раз в ~3.5 с находит цель сама и бьёт цепной молнией по ещё 1–4 рядом стоящим.',
      stats(l) { return { dmg: 34 + l * 14, cd: 3.4 - l * 0.22, chain: 1 + Math.floor(l / 2), range: 300 + l * 12 }; },
      evolve: { id: 'gateway', name: 'Gateway', desc: 'Шлюз молний: частые удары и четыре цепи.', color: '#a55bff' },
    },
    snippetstorm: {
      name: 'Snippet Storm', maxLevel: 8, icon: 'storm', color: '#39ff88',
      desc: 'Каждые ~2.3 с выбрасывает веер осколков кода во все стороны, каждый пробивает 2+ цели.',
      stats(l) { return { dmg: 8 + l * 3, cd: 2.3 - l * 0.11, count: 4 + l, speed: 380, r: 5, pierce: 2 + Math.floor(l / 2) }; },
      evolve: { id: 'kaggle', name: 'Kaggle Storm', desc: 'Град осколков с глубоким пробитием.', color: '#39ff88' },
    },
    cachecleanup: {
      name: 'Cache Cleanup', maxLevel: 8, icon: 'cache', color: '#ffd24a',
      desc: 'Повторяющийся пульс урона вокруг агента каждые ~3 с: волна бьёт всех в радиусе и отталкивает. Не разовая — срабатывает автоматически.',
      stats(l) { return { dmg: 20 + l * 9, cd: 2.9 - l * 0.15, radius: 85 + l * 22, knock: 150 }; },
      evolve: { id: 'garbagecollector', name: 'Garbage Collector', desc: 'Постоянная зона вокруг агента: тикает каждые 0.5 с без перерывов.', color: '#ffd24a' },
    },
  },

  passiveDefs: {
    damage:      { name: 'Оптимизация модели', desc: '+12% урона за уровень', maxLevel: 5, icon: 'dmg' },
    fireRate:    { name: 'Разгон инференса', desc: '+11% скорости атаки за уровень', maxLevel: 5, icon: 'rate' },
    projCount:   { name: 'Параллельные вызовы', desc: '+1 снаряд за каждые 2 уровня (макс. 2)', maxLevel: 4, icon: 'multi' },
    projSpeed:   { name: 'Пропускная способность', desc: '+10% скорости снарядов', maxLevel: 5, icon: 'speed' },
    area:        { name: 'Расширение охвата', desc: '+12% радиуса атак', maxLevel: 5, icon: 'area' },
    moveSpeed:   { name: 'Оптимизация маршрутов', desc: '+7% скорости передвижения', maxLevel: 5, icon: 'move' },
    context:     { name: 'Расширенное окно', desc: '+22 к максимальному контексту', maxLevel: 5, icon: 'ctx' },
    contextRegen:{ name: 'Компрессия контекста', desc: 'Медленнее тратится контекст (-30% расхода за уровень)', maxLevel: 4, icon: 'regen' },
    magnet:      { name: 'Индексация данных', desc: '+28% радиуса сбора источников', maxLevel: 5, icon: 'magnet' },
    armor:       { name: 'Ретраи и защита', desc: '-2.2 урона от каждого удара', maxLevel: 5, icon: 'armor' },
    luck:        { name: 'Удача при выборке', desc: 'Чаще редкие источники, выше шанс дропа', maxLevel: 3, icon: 'luck' },
  },

  passiveLevels: {},

  /* ------------- update ------------- */
  update(dt) {
    const pm = Player.fireMul;

    for (const w of this.slots) {
      const def = this.defs[w.id];
      const st = def.stats(w.lvl);
      const cd = (st.cd || 1) / pm;
      w.cd -= dt;

      if (w.evolved) {
        this._updateEvolved(w, dt);
        continue;
      }

      if (w.cd <= 0) {
        w.cd = cd;
        this._fire(w, def, st);
      }
    }

    // orbiting tabs
    for (const o of this.orbs) {
      o.angle += o.speed * dt;
      o.x = Player.x + Math.cos(o.angle) * o.radius;
      o.y = Player.y + Math.sin(o.angle) * o.radius;
      // contact damage with per-enemy cooldown
      const near = Enemies.grid.query(o.x, o.y, o.r + 40, Weapons._tmp);
      for (const e of near) {
        if (e.tabCd && e.tabCd > Game.time) continue;
        if (U.dist2(o.x, o.y, e.x, e.y) < (o.r + e.r) * (o.r + e.r)) {
          const crit = Math.random() < 0.08 + Player.luck * 0.03;
          Enemies.damage(e, o.dmg * (crit ? 2 : 1), crit);
          e.tabCd = Game.time + 0.4;
          AudioSys_.sfx('hit');
        }
      }
    }

    // projectiles
    const near2 = [];
    for (const p of this.projectiles) {
      p.life -= dt;
      if (p.life <= 0) { p.dead = true; continue; }
      if (p.homing) {
        // steer toward nearest enemy
        if (!p.target || p.target.dead) {
          let best = null, bd = 1e9;
          for (const e of Enemies.list) {
            const d = U.dist2(p.x, p.y, e.x, e.y);
            if (d < bd && d < 520 * 520) { bd = d; best = e; }
          }
          p.target = best;
        }
        if (p.target) {
          const a = U.angle(p.x, p.y, p.target.x, p.target.y);
          const cur = Math.atan2(p.vy, p.vx);
          let da = a - cur;
          while (da > Math.PI) da -= U.TAU;
          while (da < -Math.PI) da += U.TAU;
          const na = cur + U.clamp(da, -p.homing * dt, p.homing * dt);
          const sp = Math.hypot(p.vx, p.vy);
          p.vx = Math.cos(na) * sp; p.vy = Math.sin(na) * sp;
        }
      }
      p.x += p.vx * dt; p.y += p.vy * dt;
      if (p.r >= 7 && Math.random() < 0.25) Particles.trail(p.x, p.y, p.color, p.r * 0.5, 0.25);

      // hit enemies via spatial grid
      Enemies.grid.query(p.x, p.y, p.r + 26, near2);
      for (const e of near2) {
        if (p.dead) break;
        if (p.hitSet && p.hitSet.has(e)) continue;
        if (U.dist2(p.x, p.y, e.x, e.y) < (p.r + e.r) * (p.r + e.r)) {
          const crit = Math.random() < 0.1 + Player.luck * 0.03;
          Enemies.damage(e, p.dmg * (crit ? 2 : 1), crit);
          AudioSys_.sfx('hit');
          Particles.spark(p.x, p.y, p.color, { n: 4, speed: 150 });
          if (p.pierce > 0) {
            p.pierce--;
            if (!p.hitSet) p.hitSet = new Set();
            p.hitSet.add(e);
          } else {
            p.dead = true;
          }
        }
      }
    }
    this.projectiles = this.projectiles.filter(p => !p.dead);
    if (this.projectiles.length > 500) this.projectiles.splice(0, this.projectiles.length - 500);

    // lightning visuals
    for (const b of this.bolts) b.life -= dt;
    this.bolts = this.bolts.filter(b => b.life > 0);

    // novas (visual)
    for (const n of this.novas) { n.life -= dt; n.r = n.r0 + (1 - n.life / n.maxLife) * n.r1; }
    this.novas = this.novas.filter(n => n.life > 0);

    // persistent zones (garbage collector)
    for (const z of this.zones) {
      z.x = Player.x; z.y = Player.y;
      z.tick -= dt;
      if (z.tick <= 0) {
        z.tick = z.rate;
        const near3 = Enemies.grid.query(z.x, z.y, z.radius, Weapons._tmp);
        for (const e of near3) {
          if (U.dist2(z.x, z.y, e.x, e.y) < (z.radius + e.r) * (z.radius + e.r))
            Enemies.damage(e, z.dmg, false);
        }
        Particles.ring(z.x, z.y, z.color, { r0: z.radius - 8, r1: z.radius, life: 0.4, width: 2 });
      }
    }
  },

  _tmp: [],

  _fire(w, def, st) {
    const count = Math.round(st.count + Player.projCountMul * st.count);
    switch (w.id) {
      case 'websearch': this._fireHoming(count, st, w); break;
      case 'tokenstream': this._fireStream(count, st, w); break;
      case 'snippetstorm': this._fireStorm(count, st, w); break;
      case 'apicalls': this._fireApi(st, w); break;
      case 'cachecleanup': this._fireNova(st, w); break;
      // browsertabs is continuous — no per-shot firing
      case 'browsertabs': break;
    }
  },

  _fireHoming(count, st, w) {
    // pick nearest enemies and fire homing bolts
    const cands = Enemies.list.slice()
      .sort((a, b) => U.dist2(a.x, a.y, Player.x, Player.y) - U.dist2(b.x, b.y, Player.x, Player.y))
      .slice(0, count * 2);
    for (let i = 0; i < count; i++) {
      const tgt = cands[(i * 2) % Math.max(1, cands.length)];
      let a;
      if (tgt) a = U.angle(Player.x, Player.y, tgt.x, tgt.y) + U.rand(-0.15, 0.15);
      else a = U.rand(0, U.TAU);
      this._spawnProj(Player.x, Player.y, a, st.speed, st.dmg * Player.dmgMul, st.r, st.homing, '#00e5ff', 0);
      AudioSys_.sfx('shoot', { freq: 620 });
    }
  },

  _fireStream(count, st, w) {
    // fires at the nearest enemy; falls back to facing direction
    let tgt = null, bd = 1e9;
    for (const e of Enemies.list) {
      const d = U.dist2(e.x, e.y, Player.x, Player.y);
      if (d < bd && d < 820 * 820) { bd = d; tgt = e; }
    }
    const a0 = tgt ? U.angle(Player.x, Player.y, tgt.x, tgt.y)
      : Math.atan2(Player.vy || Player.lookY, Player.vx || Player.lookX);
    for (let i = 0; i < count; i++) {
      const a = a0 + (count > 1 ? (i - (count - 1) / 2) * 0.12 : 0);
      this._spawnProj(Player.x, Player.y, a, st.speed * Player.projSpeedMul, st.dmg * Player.dmgMul, st.r, 0, '#5fd8ff', st.pierce);
    }
    AudioSys_.sfx('shoot', { freq: 420 });
  },

  _fireStorm(count, st, w) {
    for (let i = 0; i < count; i++) {
      const a = U.rand(0, U.TAU);
      this._spawnProj(Player.x, Player.y, a, st.speed * Player.projSpeedMul, st.dmg * Player.dmgMul, st.r, 0, '#39ff88', st.pierce);
    }
    AudioSys_.sfx('shoot2');
  },

  _fireApi(st, w) {
    // strike the nearest enemy in range, chain to others
    let target = null, bd = 1e9;
    for (const e of Enemies.list) {
      const d = U.dist2(e.x, e.y, Player.x, Player.y);
      if (d < st.range * st.range && d < bd) { bd = d; target = e; }
    }
    if (!target) { w.cd = 0.4; return; }
    const chainPts = [Player];
    let cur = target;
    const hit = new Set();
    for (let c = 0; c <= st.chain && cur; c++) {
      chainPts.push(cur);
      hit.add(cur);
      Enemies.damage(cur, st.dmg * Player.dmgMul, true);
      let next = null, nd = 1e9;
      for (const e of Enemies.list) {
        if (hit.has(e) || e.dead) continue;
        const d = U.dist2(e.x, e.y, cur.x, cur.y);
        if (d < 180 * 180 && d < nd) { nd = d; next = e; }
      }
      cur = next;
    }
    this.bolts.push({ pts: chainPts.map(p => ({ x: p.x, y: p.y })), life: 0.22, maxLife: 0.22, color: '#a55bff' });
    AudioSys_.sfx('zap');
    Particles.shock(target.x, target.y, '#a55bff', 60, 0.3);
  },

  _fireNova(st, w) {
    const R = st.radius * Player.areaMul;
    this.novas.push({ x: Player.x, y: Player.y, r: 0, r0: 10, r1: R, life: 0.45, maxLife: 0.45, color: '#ffd24a' });
    const near = Enemies.grid.query(Player.x, Player.y, R + 30, Weapons._tmp);
    for (const e of near) {
      const d = U.dist(Player.x, Player.y, e.x, e.y);
      if (d < R + e.r) {
        Enemies.damage(e, st.dmg * Player.dmgMul, false);
        // knockback
        const a = Math.atan2(e.y - Player.y, e.x - Player.x);
        e.x += Math.cos(a) * (st.knock / (e.boss ? 8 : e.elite ? 3 : 1)) / 12;
        e.y += Math.sin(a) * (st.knock / (e.boss ? 8 : e.elite ? 3 : 1)) / 12;
      }
    }
    AudioSys_.sfx('nova');
  },

  _refreshOrbs() {
    this.orbs = [];
    const w = this.get('browsertabs');
    if (!w) return;
    const st = this.defs.browsertabs.stats(w.lvl);
    const count = st.count + (w.evolved ? 2 : 0);
    const dmg = st.dmg * Player.dmgMul * (w.evolved ? 2.4 : 1);
    const radius = st.radius * Player.areaMul * (w.evolved ? 1.4 : 1);
    for (let i = 0; i < count; i++) {
      this.orbs.push({
        angle: i / count * U.TAU,
        radius, dmg,
        r: w.evolved ? 16 : 11,
        speed: st.speed * (w.evolved ? 1.3 : 1),
        x: Player.x, y: Player.y, color: '#ff9a1f', id: i,
      });
    }
  },

  _spawnProj(x, y, a, speed, dmg, r, homing, color, pierce) {
    if (this.projectiles.length > 480) return;
    this.projectiles.push({
      x, y,
      vx: Math.cos(a) * speed, vy: Math.sin(a) * speed,
      dmg, r: r * Player.areaMul, life: 2.2, homing,
      color, pierce: pierce || 0, dead: false, target: null, hitSet: null,
    });
  },

  /* ------------- evolutions ------------- */
  _updateEvolved(w, dt) {
    switch (w.evolvedId) {
      case 'deepresearch': {
        w.cd -= dt;
        if (w.cd <= 0) {
          w.cd = 0.9;
          const st = this.defs.websearch.stats(8);
          for (let i = 0; i < 3; i++) {
            const a = U.rand(0, U.TAU);
            this._spawnProj(Player.x, Player.y, a, 340, st.dmg * 3 * Player.dmgMul, 12, 4.5, '#00e5ff', 2);
          }
          AudioSys_.sfx('shoot2');
        }
        break;
      }
      case 'contextoverflow': {
        w.cd -= dt;
        if (w.cd <= 0) {
          w.cd = 0.12;
          const st = this.defs.tokenstream.stats(8);
          const a0 = Math.atan2(Player.vy || Player.lookY, Player.vx || Player.lookX);
          this._spawnProj(Player.x, Player.y, a0 + U.rand(-0.08, 0.08), 760 * Player.projSpeedMul, st.dmg * 2 * Player.dmgMul, 6, 0, '#b9f6ff', 99);
        }
        break;
      }
      case 'gateway': {
        w.cd -= dt;
        if (w.cd <= 0) {
          w.cd = 0.7;
          const st = this.defs.apicalls.stats(8);
          this._fireApi({ dmg: st.dmg * 1.6, chain: 4, range: st.range }, w);
        }
        break;
      }
      case 'kaggle': {
        w.cd -= dt;
        if (w.cd <= 0) {
          w.cd = 1.1;
          const st = this.defs.snippetstorm.stats(8);
          for (let i = 0; i < 14; i++)
            this._spawnProj(Player.x, Player.y, U.rand(0, U.TAU), 460 * Player.projSpeedMul, st.dmg * 2 * Player.dmgMul, 6, 0, '#39ff88', 5);
          AudioSys_.sfx('shoot2');
        }
        break;
      }
      case 'garbagecollector': {
        if (!this.zones.length) {
          const st = this.defs.cachecleanup.stats(8);
          this.zones.push({ x: Player.x, y: Player.y, radius: 110 * Player.areaMul, dmg: st.dmg * 0.6 * Player.dmgMul, rate: 0.5, tick: 0.5, color: '#ffd24a' });
        }
        break;
      }
      case 'multiverse': {
        // orb stats are applied once in evolve(); shared orbit update handles motion
        break;
      }
    }
  },

  /** returns evolved card def if any weapon is maxed and not yet evolved */
  availableEvolution() {
    for (const w of this.slots) {
      const def = this.defs[w.id];
      if (w.lvl >= def.maxLevel && !w.evolved) {
        return { w, def, evo: def.evolve };
      }
    }
    return null;
  },

  evolve(id) {
    const found = this.slots.find(s => this.defs[s.id].evolve.id === id);
    if (!found) return;
    found.evolved = true;
    found.evolvedId = id;
    AudioSys_.sfx('evolve');
    if (id === 'multiverse') this._refreshOrbs();
    Particles.shock(Player.x, Player.y, '#ffd24a', 200, 0.7);
    for (let i = 0; i < 40; i++)
      Particles.spark(Player.x, Player.y, U.choice(['#ffd24a', '#00e5ff', '#ff2bd6']), { speed: U.rand(160, 420), life: 0.8 });
  },

  draw(ctx, t) {
    // projectiles
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (const p of this.projectiles) {
      const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.r * 2.2);
      g.addColorStop(0, p.color);
      g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(p.x, p.y, p.r * 2.2, 0, U.TAU); ctx.fill();
      ctx.fillStyle = '#ffffff';
      ctx.beginPath(); ctx.arc(p.x, p.y, p.r * 0.5, 0, U.TAU); ctx.fill();
    }
    ctx.restore();

    // orbiting tabs
    for (const o of this.orbs) {
      ctx.save();
      ctx.translate(o.x, o.y);
      const pulse = 0.8 + 0.2 * Math.sin(t * 6 + o.id);
      ctx.strokeStyle = '#ff9a1f';
      ctx.fillStyle = 'rgba(30,18,4,0.85)';
      ctx.lineWidth = 2;
      ctx.shadowColor = '#ff9a1f'; ctx.shadowBlur = 12 * pulse;
      const w = o.r * 1.7, h = o.r * 1.3;
      ctx.fillRect(-w / 2, -h / 2, w, h);
      ctx.strokeRect(-w / 2, -h / 2, w, h);
      // tab header line
      ctx.fillStyle = '#ff9a1f';
      ctx.fillRect(-w / 2, -h / 2, w * 0.5, 3);
      // close cross
      ctx.beginPath();
      ctx.moveTo(w / 2 - 4, -h / 2 + 2); ctx.lineTo(w / 2 - 1, -h / 2 + 5);
      ctx.moveTo(w / 2 - 1, -h / 2 + 2); ctx.lineTo(w / 2 - 4, -h / 2 + 5);
      ctx.stroke();
      ctx.restore();
    }

    // lightning bolts
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (const b of this.bolts) {
      const a = b.life / b.maxLife;
      ctx.globalAlpha = a;
      ctx.strokeStyle = b.color;
      ctx.lineWidth = 3;
      ctx.shadowColor = b.color; ctx.shadowBlur = 14;
      ctx.beginPath();
      for (let i = 0; i < b.pts.length - 1; i++) {
        const p1 = b.pts[i], p2 = b.pts[i + 1];
        ctx.moveTo(p1.x, p1.y);
        // jagged segment
        const seg = 4;
        for (let s = 1; s <= seg; s++) {
          const tt = s / seg;
          const jx = U.lerp(p1.x, p2.x, tt) + (s < seg ? U.rand(-10, 10) : 0);
          const jy = U.lerp(p1.y, p2.y, tt) + (s < seg ? U.rand(-10, 10) : 0);
          ctx.lineTo(jx, jy);
        }
      }
      ctx.stroke();
      ctx.shadowBlur = 0;
    }
    ctx.restore();

    // novas
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (const n of this.novas) {
      const a = n.life / n.maxLife;
      ctx.globalAlpha = a * 0.9;
      ctx.strokeStyle = n.color;
      ctx.lineWidth = 6 * a + 1;
      ctx.shadowColor = n.color; ctx.shadowBlur = 16;
      ctx.beginPath(); ctx.arc(n.x, n.y, Math.max(1, n.r), 0, U.TAU); ctx.stroke();
      ctx.shadowBlur = 0;
    }
    ctx.restore();

    // zones
    for (const z of this.zones) {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = 0.16 + 0.06 * Math.sin(t * 5);
      const g = ctx.createRadialGradient(z.x, z.y, 0, z.x, z.y, z.radius);
      g.addColorStop(0, z.color);
      g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(z.x, z.y, z.radius, 0, U.TAU); ctx.fill();
      ctx.globalAlpha = 0.5;
      ctx.strokeStyle = z.color;
      ctx.setLineDash([10, 8]);
      ctx.lineDashOffset = -t * 40;
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(z.x, z.y, z.radius, 0, U.TAU); ctx.stroke();
      ctx.restore();
    }
  },

  clear() {
    this.slots = []; this.projectiles = []; this.orbs = [];
    this.bolts = []; this.novas = []; this.zones = [];
    this.passiveLevels = {};
  },
};
