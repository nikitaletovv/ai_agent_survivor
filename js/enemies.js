/* ============================================================
   AI Agent Survivors — errors and failures (enemies)
   Recognizable enemy archetypes, elites, bosses, event swarms.
   ============================================================ */
'use strict';

const Enemies = {
  list: [],
  blocks: [],            // CAPTCHA obstacles {x,y,w,h,life}
  projectiles: [],       // enemy bullets
  grid: null,
  spawnTimer: 0,
  eventTimer: CFG.event.first,
  bossTimer: CFG.boss.interval,
  bossIndex: 0,
  boss: null,

  init() {
    this.list = []; this.blocks = []; this.projectiles = [];
    this.grid = new U.SpatialGrid(90);
    this.spawnTimer = 0; this.eventTimer = CFG.event.first;
    this.bossTimer = CFG.boss.interval; this.bossIndex = 0; this.boss = null;
    this.limitActive = false;
  },

  hpScale() { return 1 + (Game.time / 60) * CFG.spawn.hpScale + Math.pow(Game.time / 60, 2.5) * 0.004; },
  dmgScale() { return CFG.spawn.dmgScale * (Game.time / 60); },
  speedScale() { return 1 + (Game.time / 60) * (CFG.spawn.speedScale || 0) + Math.pow(Game.time / 60, 1.8) * 0.005; },

  /** дистанция «хвоста»: дальше — телепорт на ближний край,
   *  иначе забег стрелкой осушает мир (стандарт сурвайвалс-игр) */
  leashDist() { return Math.hypot(Game.view.w, Game.view.h) / 2 + 700; },

  /** Спавн по краю видимой области с учётом ультрашироких экранов:
   *  на длинной стороне точка сэмплируется заново, чтобы враги не ползли
   *  через полкарты; bias — часть спавна навстречу движению игрока. */
  spawnPos(bias) {
    const pad = CFG.spawn.spawnPad;
    const halfW = Game.view.w / 2, halfH = Game.view.h / 2;
    const cap = Math.max(halfH * 1.8, 620) + pad;
    for (let i = 0; i < 8; i++) {
      const a = (bias && Math.random() < 0.35)
        ? Math.atan2(Player.vy, Player.vx) + U.rand(-0.5, 0.5)
        : U.rand(0, U.TAU);
      const c = Math.abs(Math.cos(a)), s = Math.abs(Math.sin(a));
      const edge = Math.min(
        c > 1e-4 ? halfW / c : 1e9,
        s > 1e-4 ? halfH / s : 1e9);
      if (edge <= cap) {
        return { x: Player.x + Math.cos(a) * (edge + pad), y: Player.y + Math.sin(a) * (edge + pad) };
      }
    }
    const dir = Math.random() < 0.5 ? -1 : 1;
    return { x: Player.x + U.rand(-halfW, halfW) * 0.5, y: Player.y + dir * (halfH + pad) };
  },

  /* ------------- definitions ------------- */
  types: {
    notfound: {
      id: 'notfound', name: '404 Not Found', hp: 12, speed: 62, dmg: 9, r: 13,
      xp: 1, score: 8, color: '#ff3b52', minTime: 0, weight: 10, ai: 'chase',
    },
    toomany: {
      id: 'toomany', name: '429 Too Many Requests', hp: 7, speed: 128, dmg: 6, r: 11,
      xp: 1, score: 7, color: '#ffd24a', minTime: 45, weight: 8, ai: 'chase', pack: 4,
    },
    forbidden: {
      id: 'forbidden', name: '403 Forbidden', hp: 55, speed: 52, dmg: 13, r: 17,
      xp: 4, score: 22, color: '#ff7a1f', minTime: 90, weight: 6, ai: 'chase',
    },
    timeout: {
      id: 'timeout', name: 'Timeout', hp: 26, speed: 62, dmg: 9, r: 14,
      xp: 3, score: 18, color: '#a55bff', minTime: 120, weight: 5, ai: 'chase', aura: { radius: 130, slow: 0.55 },
    },
    servererror: {
      id: 'servererror', name: '500 Internal Server Error', hp: 210, speed: 44, dmg: 22, r: 26,
      xp: 10, score: 60, color: '#ff2b48', minTime: 180, weight: 3, ai: 'chase', explodeOnDeath: true,
    },
    captcha: {
      id: 'captcha', name: 'CAPTCHA', hp: 34, speed: 54, dmg: 8, r: 15,
      xp: 4, score: 20, color: '#4de0c8', minTime: 210, weight: 4, ai: 'chase', dropsBlocks: true,
    },
    hallucination: {
      id: 'hallucination', name: 'Hallucination', hp: 40, speed: 86, dmg: 11, r: 15,
      xp: 5, score: 26, color: '#39ff88', minTime: 260, weight: 4, ai: 'erratic', clones: true,
    },
    apifailure: {
      id: 'apifailure', name: 'API Failure', hp: 22, speed: 58, dmg: 8, r: 14,
      xp: 4, score: 24, color: '#ff2bd6', minTime: 70, weight: 7, ai: 'ranged',
    },
    phantom: {
      id: 'phantom', name: 'Фантом', hp: 8, speed: 110, dmg: 5, r: 11,
      xp: 0, score: 4, color: 'rgba(57,255,136,0.65)', minTime: 999, weight: 0, ai: 'chase',
    },
    /* elites */
    swarmlord: {
      id: 'swarmlord', name: 'АРБИТРАТОР РОЯ', hp: 420, speed: 60, dmg: 18, r: 24,
      xp: 20, score: 220, color: '#ff3b52', minTime: 999, weight: 0, ai: 'chase', elite: true,
    },
    memleak: {
      id: 'memleak', name: 'УТЕЧКА ПАМЯТИ', hp: 640, speed: 42, dmg: 20, r: 28,
      xp: 26, score: 300, color: '#a55bff', minTime: 999, weight: 0, ai: 'chase', elite: true, spawner: true,
    },
  },

  bosses: [
    { id: 'limit', name: 'ЛИМИТ СЕАНСА «КДЕКС»', hp: 1400, speed: 44, dmg: 26, r: 40, color: '#ff2b48', stomp: true },
    { id: 'ratelimit', name: 'ОБЛАЧНАЯ ЗАЩИТА «СЛАУДФЕЕР»', hp: 1900, speed: 74, dmg: 24, r: 36, color: '#ffd24a', swarm: true, slowAura: true },
    { id: 'verifier', name: 'КАПЧА «АНТИВОТ»: Я НЕ РОБОТ', hp: 2400, speed: 52, dmg: 24, r: 38, color: '#39ff88', fan: true },
  ],

  /* ------------- spawning ------------- */
  update(dt) {
    // «КДЕКС»: пока лимит сеанса активен — экономика заморожена.
    // Новые враги не спавнятся, новый лут не выпадает (Pickups читает этот флаг);
    // уже выпавшее остаётся на земле, его можно собрать
    this.limitActive = !!(this.boss && this.boss.bossDef && this.boss.bossDef.id === 'limit');
    // standard spawn stream (заморожен при лимите КДЕКС)
    if (!this.limitActive) this.spawnTimer -= dt;
    // широкие экраны дают обзор — компенсируем темпом спавна (до 1.7x)
    const areaMul = Math.min(CFG.spawn.areaRateMul || 1.7,
      Math.sqrt((Game.view.w * Game.view.h) / (1280 * 720)));
    const eps = (CFG.spawn.startRate + (Game.time / 60) * CFG.spawn.rateGrowth) * areaMul;
    if (this.spawnTimer <= 0 && this.list.length < CFG.spawn.maxAlive) {
      this.spawnTimer = 1 / Math.min(eps, 26);
      this.spawnOne();
      // pack spawning for 429
      const t = this._pickDef();
      if (t && t.pack && Math.random() < 0.4) {
        for (let i = 1; i < t.pack; i++) this.spawnOne(t.id, true);
      }
    }

    // rare elite spawns (заморожены при лимите КДЕКС)
    if (!this.limitActive && Game.time > 240 && Math.random() < dt * (0.03 + Game.time / 60 * 0.012)) {
      this.spawnOne(Math.random() < 0.5 ? 'swarmlord' : 'memleak');
      UI.announce('ЭЛИТНАЯ УГРОЗА: ' + (Math.random() < 0.5 ? 'АРБИТРАТОР РОЯ' : 'УТЕЧКА ПАМЯТИ'));
    }

    // swarm events (заморожены при лимите КДЕКС)
    if (!this.limitActive) {
      this.eventTimer -= dt;
      if (this.eventTimer <= 0) {
        this.eventTimer = CFG.event.every;
        this.swarmEvent();
      }
    }

    // bosses
    this.bossTimer -= dt;
    if (this.bossTimer <= 0) {
      this.bossTimer = CFG.boss.interval;
      this.spawnBoss();
    }

    // update all
    for (const e of this.list) this.updateEnemy(e, dt);
    this._separate(dt);
    this._collidePlayer(dt);

    // CAPTCHA blocks
    for (const b of this.blocks) b.life -= dt;
    this.blocks = this.blocks.filter(b => b.life > 0);

    // enemy projectiles
    for (const p of this.projectiles) {
      p.x += p.vx * dt; p.y += p.vy * dt;
      p.life -= dt;
      if (p.life <= 0) p.dead = true;
      else {
        const d = U.dist2(p.x, p.y, Player.x, Player.y);
        if (d < (Player.r + 5) * (Player.r + 5)) {
          p.dead = true;
          Player.hurt(p.dmg, 'API');
          Particles.spark(p.x, p.y, p.color, { n: 6 });
        }
      }
    }
    this.projectiles = this.projectiles.filter(p => !p.dead);

    // rebuild spatial grid
    this.grid.clear();
    for (const e of this.list) this.grid.insert(e, e.x, e.y);

    this.list = this.list.filter(e => !e.dead);
  },

  _pickDef() {
    const t = Game.time;
    const pool = [];
    for (const id in this.types) {
      const d = this.types[id];
      if (d.minTime <= t && d.weight > 0) pool.push(d);
    }
    if (!pool.length) return this.types.notfound;
    return U.weighted(pool);
  },

  spawnPos() {
    const a = U.rand(0, U.TAU);
    const R = Math.hypot(Game.view.w, Game.view.h) / 2 + CFG.spawn.spawnPad;
    return { x: Player.x + Math.cos(a) * R, y: Player.y + Math.sin(a) * R };
  },

  spawnOne(forceId, nearPack) {
    const id = forceId || this._pickDef().id;
    const def = this.types[id];
    if (!def) return;
    const p = this.spawnPos(true);
    const elite = !forceId && Game.time > 60 && Math.random() < 0.02;
    const e = this._make(def, p.x, p.y);
    Meta.encounter('e_' + id);
    if (elite) this._makeElite(e, def);
    if (nearPack) { e.x += U.rand(-40, 40); e.y += U.rand(-40, 40); }
    this.list.push(e);
  },

  _make(def, x, y) {
    const hs = this.hpScale();
    return {
      def, x, y,
      vx: 0, vy: 0,
      hp: def.hp * hs, maxHp: def.hp * hs,
      speed: def.speed * (0.9 + Math.random() * 0.2) * this.speedScale(),
      dmg: def.dmg + this.dmgScale(),
      r: def.r,
      wobble: U.rand(0, U.TAU),
      fireCd: U.rand(1, 3),
      cloneCd: U.rand(4, 8),
      spawnCd: U.rand(3, 6),
      hitFlash: 0,
      dead: false,
      elite: false, boss: false,
    };
  },

  _makeElite(e, def) {
    e.elite = true;
    e.hp = e.maxHp * 8;
    e.r *= 1.5; e.speed *= 0.85; e.dmg *= 1.5;
    e.xpBonus = 4;
  },

  spawnBoss() {
    const bd = this.bosses[this.bossIndex % this.bosses.length];
    this.bossIndex++;
    const p = this.spawnPos();
    const mult = 1 + Math.floor(this.bossIndex / this.bosses.length) * 0.9;
    const e = {
      def: { id: bd.id, name: bd.name, color: bd.color },
      x: p.x, y: p.y, vx: 0, vy: 0,
      hp: CFG.boss.hp * mult * this.hpScale() * 0.8, maxHp: CFG.boss.hp * mult * this.hpScale() * 0.8,
      speed: bd.speed, dmg: bd.dmg + this.dmgScale() * 2,
      r: bd.r, wobble: 0, hitFlash: 0, dead: false,
      elite: true, boss: true, bossDef: bd,
      fireCd: 2, cloneCd: 5, spawnCd: 4, phase: 0, phaseT: 0,
      score: CFG.boss.score * mult,
    };
    this.list.push(e);
    this.boss = e;
    Meta.encounter('boss_' + bd.id);
    AudioSys_.sfx('boss');
    UI.announce('БОСС: ' + bd.name, '#ff2b48');
    if (bd.id === 'limit') UI.announce('КДЕКС: ЛИМИТ СЕАНСА — НОВЫЕ ДАННЫЕ НЕ ВЫПАДАЮТ. СБРОС ЧЕРЕЗ 5 Ч.', '#ff2b48');
    if (bd.id === 'verifier') UI.announce('ВЫБЕРИТЕ ВСЕ СВЕТОФОРЫ, ГДЕ НЕТ СВЕТОФОРОВ', '#39ff88');
    if (bd.id === 'ratelimit') UI.announce('ПРОВЕРКА БРАУЗЕРА ЗАЙМЁТ 5 СЕКУНД', '#ffd24a');
    Game.shake(10, 0.8);
  },

  swarmEvent() {
    const pool = ['notfound', 'toomany', 'phantom'];
    const kind = pool[(Math.random() * (Game.time > 120 ? 3 : 2)) | 0];
    const def = this.types[kind];
    const n = 26 + Math.floor(Game.time / 30) * 6;
    UI.announce('ВОЛНА: ' + def.name.toUpperCase(), '#ffd24a');
    AudioSys_.sfx('warn');
    const a0 = U.rand(0, U.TAU);
    const R = Math.max(Game.view.h / 2 * 1.8, 620) + 120;
    for (let i = 0; i < n; i++) {
      const a = a0 + (i / n) * U.TAU;
      const e = this._make(def, Player.x + Math.cos(a) * R, Player.y + Math.sin(a) * R);
      this.list.push(e);
    }
  },

  /* ------------- per-enemy behaviour ------------- */
  updateEnemy(e, dt) {
    e.hitFlash = Math.max(0, e.hitFlash - dt * 5);
    e.wobble += dt * 4;
    // «КДЕКС»: часы сброса лимита — это его здоровье.
    // Каждый выбитый час — шаг к моменту, когда запросы снова доступны
    if (e.boss && e.bossDef && e.bossDef.id === 'limit') {
      const h = Math.max(0, Math.ceil((e.hp / e.maxHp) * 5));
      if (e.lastHour === undefined) e.lastHour = 5;
      if (h < e.lastHour && h > 0) {
        e.lastHour = h;
        UI.announce('КДЕКС: СБРОС ЧЕРЕЗ ' + h + ' Ч.', '#ff2b48');
        AudioSys_.sfx('warn');
      }
    }

    // отставший далеко «хвост» перебрасывается на ближний край —
    // давление не падает, зажатая стрелка больше не безопасна
    if (!e.boss && U.dist2(e.x, e.y, Player.x, Player.y) > this.leashDist() * this.leashDist()) {
      const np = this.spawnPos(true);
      e.x = np.x;
      e.y = np.y;
    }
    const dx = Player.x - e.x, dy = Player.y - e.y;
    const d = Math.hypot(dx, dy) || 1;

    // по шинам данных все едут быстрее — и игрок, и ошибки
    let sp = e.speed * (e.boss ? 1.15 : (World.onBus(e.x, e.y) ? 1.4 : 1));
    let ax = dx / d, ay = dy / d;

    if (e.def.ai === 'erratic') {
      e.cloneCd -= dt;
      if (e.cloneCd <= 0) {
        e.cloneCd = U.rand(5, 9);
        // hallucination: spawn phantom clones
        const c1 = this._make(this.types.phantom, e.x + U.rand(-30, 30), e.y + U.rand(-30, 30));
        const c2 = this._make(this.types.phantom, e.x + U.rand(-30, 30), e.y + U.rand(-30, 30));
        this.list.push(c1, c2);
        Particles.ring(e.x, e.y, '#39ff88', { r0: 4, r1: 40, life: 0.4 });
      }
      // erratic zig-zag
      const zig = Math.sin(e.wobble * 2.2) * 0.9;
      const px = -ay, py = ax;
      ax += px * zig; ay += py * zig;
      const l = Math.hypot(ax, ay) || 1; ax /= l; ay /= l;
    } else if (e.def.ai === 'ranged') {
      e.fireCd -= dt;
      if (d < 230) { ax = -ax; ay = -ay; sp *= 0.8; }      // keep distance
      else if (d < 330) { sp *= 0.2; }                     // hover
      if (e.fireCd <= 0 && d < 620) {
        e.fireCd = U.rand(1.8, 3.2);
        const a = Math.atan2(dy, dx);
        this.projectiles.push({
          x: e.x, y: e.y, vx: Math.cos(a) * 240, vy: Math.sin(a) * 240,
          dmg: 8 + this.dmgScale(), life: 3.4, color: '#ff2bd6', dead: false,
        });
        AudioSys_.sfx('shoot2');
      }
    }

    // elite spawner (memory leak)
    if (e.def.spawner) {
      e.spawnCd -= dt;
      if (e.spawnCd <= 0 && this.list.length < CFG.spawn.maxAlive) {
        e.spawnCd = U.rand(4, 7);
        const c = this._make(this.types.notfound, e.x + U.rand(-50, 50), e.y + U.rand(-50, 50));
        this.list.push(c);
        Particles.ring(e.x, e.y, '#a55bff', { r0: 6, r1: 50, life: 0.4 });
      }
    }

    // boss special behaviour
    if (e.boss) this._updateBoss(e, dt, dx, dy, d);

    // timeout aura slows the player
    if (e.def.aura && d < e.def.aura.radius) {
      Player.slowFactor = Math.min(Player.slowFactor, e.def.aura.slow);
    }

    // steering + separation handled below
    e.vx = ax * sp; e.vy = ay * sp;
    e.x += e.vx * dt;
    e.y += e.vy * dt;
    World.resolveCollision(e);
  },

  _updateBoss(e, dt, dx, dy, d) {
    const bd = e.bossDef;
    e.telegraph = false;
    e.phaseT += dt;
    if (e.phaseT > 6) { e.phase = (e.phase + 1) % 2; e.phaseT = 0; }
    if (bd.stomp) {
      // Kernel Panic: periodic area stomp + spawn 404s
      e.fireCd -= dt;
      if (e.fireCd <= 0) {
        e.fireCd = 3.4;
        if (d < 200) {
          Particles.shock(e.x, e.y, '#ff2b48', 220, 0.5);
          AudioSys_.sfx('bigboom');
          if (d < 180) Player.hurt(e.dmg, bd.name);
          Game.shake(8, 0.4);
        }
        if (bd.id === 'limit') e.telegraph = e.fireCd < 0.8;
        if (this.list.length < CFG.spawn.maxAlive) {
          for (let i = 0; i < 3; i++) {
            const c = this._make(this.types.notfound, e.x + U.rand(-80, 80), e.y + U.rand(-80, 80));
            this.list.push(c);
          }
        }
      }
    }
    if (bd.swarm) {
      // Rate Limiter: fast dashes + 429 swarms
      e.spawnCd -= dt;
      if (e.spawnCd <= 0) {
        e.spawnCd = 5;
        for (let i = 0; i < 6; i++) {
          const a = U.rand(0, U.TAU);
          const c = this._make(this.types.toomany, e.x + Math.cos(a) * 70, e.y + Math.sin(a) * 70);
          this.list.push(c);
        }
        Particles.ring(e.x, e.y, '#ffd24a', { r0: 8, r1: 80, life: 0.5 });
      }
    }
    if (bd.fan) {
      // The Hallucinator: phantom fan shots + clones
      e.fireCd -= dt;
      if (e.fireCd < 0.45) e.telegraph = true;
      if (e.fireCd <= 0) {
        e.fireCd = 2.2;
        const a0 = Math.atan2(dy, dx);
        for (let k = -2; k <= 2; k++) {
          const a = a0 + k * 0.28;
          this.projectiles.push({
            x: e.x, y: e.y, vx: Math.cos(a) * 190, vy: Math.sin(a) * 190,
            dmg: (10 + this.dmgScale()) * Meta.verifierMul(), life: 4, color: '#39ff88', dead: false,
          });
        }
        AudioSys_.sfx('zap');
      }
      e.spawnCd -= dt;
      if (e.spawnCd <= 0) {
        e.spawnCd = 6;
        // verifier: popup human-check walls instead of phantoms
        const lifeMul = Meta.blockLifeMul();
        for (let i = 0; i < 2; i++) {
          this.blocks.push({
            x: e.x + U.rand(-90, 90), y: e.y + U.rand(-90, 90),
            w: 44, h: 44, life: 12 * lifeMul,
          });
        }
        AudioSys_.sfx('warn');
      }
    }

    // «СЛАУДФЕЕР» замедляет всё вокруг, пока «проверяет ваш браузер»
    if (bd.slowAura && d < 240) Player.slowFactor = Math.min(Player.slowFactor, 0.6);
  },

  _separate(dt) {
    // soft push apart so masses stay readable
    const near = [];
    for (const e of this.list) {
      this.grid.query(e.x, e.y, e.r + 30, near);
      let pushX = 0, pushY = 0;
      for (const o of near) {
        if (o === e) continue;
        const dx = e.x - o.x, dy = e.y - o.y;
        const dd = dx * dx + dy * dy;
        const rr = (e.r + o.r) * 0.9;
        if (dd < rr * rr && dd > 0.01) {
          const d = Math.sqrt(dd);
          const f = (rr - d) / rr;
          pushX += (dx / d) * f; pushY += (dy / d) * f;
        }
      }
      const lim = 60;
      pushX = U.clamp(pushX, -lim, lim); pushY = U.clamp(pushY, -lim, lim);
      e.x += pushX * dt * 60 * 0.5;
      e.y += pushY * dt * 60 * 0.5;
    }
  },

  _collidePlayer(dt) {
    for (const e of this.list) {
      const d = U.dist2(e.x, e.y, Player.x, Player.y);
      const rr = (e.r + Player.r);
      if (d < rr * rr) {
        // мета-улучшения смягчают конкретные угрозы
        let dmg = e.dmg;
        if (e.def.id === 'forbidden') dmg *= Meta.forbiddenMul();
        else if (e.def.id === 'captcha') dmg *= Meta.verifierMul();
        else if (e.boss && e.bossDef && e.bossDef.id === 'verifier') dmg *= Meta.verifierMul();
        Player.hurt(dmg, e.def.name);
        // slight knockback of the enemy
        const dx = e.x - Player.x, dy = e.y - Player.y, l = Math.hypot(dx, dy) || 1;
        e.x += dx / l * 14; e.y += dy / l * 14;
      }
    }
  },

  /** Apply damage; returns true if the enemy died. */
  damage(e, amount, showCrit) {
    if (e.dead) return false;
    e.hp -= amount;
    e.hitFlash = 1;
    if (Math.random() < 0.5) {
      Particles.text(e.x + U.rand(-8, 8), e.y - e.r - 6, String(Math.round(amount)),
        showCrit ? '#ffd24a' : '#e8f6ff', showCrit ? 15 : 12);
    }
    if (e.hp <= 0) {
      this.kill(e);
      return true;
    }
    return false;
  },

  kill(e) {
    if (e.dead) return;
    e.dead = true;
    const crit = e.boss || e.elite;
    AudioSys_.sfx(crit ? 'bigboom' : 'boom');
    Particles.explode(e.x, e.y, e.def.color, { n: crit ? 26 : 10, speed: crit ? 420 : 240, r: crit ? 130 : 60 });
    Pickups.spawnFromEnemy(e);

    const score = Math.round((e.score || e.def.score) * (1 + Game.time / 120));
    Game.addScore(score);
    Game.kills++;
    if (Game.kills === 100) Meta.encounter('kills100');

    if (e.boss) {
      this.boss = null;
      if (e.bossDef && e.bossDef.id === 'limit') UI.announce('КДЕКС: ЛИМИТ СБРОШЕН — ЗАПРОСЫ СНОВА ДОСТУПНЫ', '#ffd24a');
      UI.announce('БОСС УНИЧТОЖЕН  +' + score, '#ffd24a');
      Game.shake(12, 0.6);
      for (let i = 0; i < 40; i++)
        Particles.spark(e.x, e.y, U.choice(['#ffd24a', '#ff2b48', '#e8f6ff']), { speed: U.rand(150, 500), life: U.rand(0.4, 0.9) });
    }

    if (e.def.explodeOnDeath) {
      // 500 dies with an area blast
      Particles.shock(e.x, e.y, '#ff2b48', 110, 0.45);
      const d = U.dist(e.x, e.y, Player.x, Player.y);
      if (d < 120) Player.hurt(e.dmg * 0.8, e.def.name);
    }

    if (e.def.dropsBlocks) {
      // CAPTCHA leaves obstacles
      for (let i = 0; i < 2; i++) {
        this.blocks.push({
          x: e.x + U.rand(-50, 50), y: e.y + U.rand(-50, 50),
          w: 44, h: 44, life: 12 * Meta.blockLifeMul(),
        });
      }
      AudioSys_.sfx('warn');
    }
  },

  /** Collides circle bodies against CAPTCHA blocks. */
  resolveBlocks(body) {
    for (const b of this.blocks) {
      const res = { x: b.x, y: b.y, w: b.w, h: b.h, px: body.x, py: body.y };
      if (U.circleRectPush(body.x, body.y, body.r, res)) {
        body.x = res.px; body.y = res.py;
      }
    }
  },

  drawBlocks(ctx, t) {
    for (const b of this.blocks) {
      ctx.save();
      const a = Math.min(1, b.life / 2);
      ctx.globalAlpha = a;
      ctx.strokeStyle = '#4de0c8';
      ctx.fillStyle = 'rgba(10,40,40,0.85)';
      ctx.lineWidth = 2;
      ctx.shadowColor = '#4de0c8'; ctx.shadowBlur = 10;
      ctx.fillRect(b.x, b.y, b.w, b.h);
      ctx.strokeRect(b.x, b.y, b.w, b.h);
      ctx.shadowBlur = 0;
      // 3x3 puzzle grid
      ctx.lineWidth = 1;
      for (let i = 1; i < 3; i++) {
        ctx.beginPath();
        ctx.moveTo(b.x + i * b.w / 3, b.y); ctx.lineTo(b.x + i * b.w / 3, b.y + b.h);
        ctx.moveTo(b.x, b.y + i * b.h / 3); ctx.lineTo(b.x + b.w, b.y + i * b.h / 3);
        ctx.stroke();
      }
      ctx.fillStyle = '#4de0c8';
      ctx.font = 'bold 9px monospace';
      ctx.textAlign = 'center';
      ctx.fillText('CAP', b.x + b.w / 2, b.y + b.h / 2 + 3);
      ctx.restore();
    }
  },

  /* -------- enemy visuals -------- */
  draw(ctx, x0, y0, vw, vh, t) {
    for (const e of this.list) {
      if (e.x < x0 - 60 || e.x > x0 + vw + 60 || e.y < y0 - 60 || e.y > y0 + vh + 60) continue;
      this.drawOne(ctx, e, t);
    }
    // enemy projectiles
    for (const p of this.projectiles) {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, 9);
      g.addColorStop(0, p.color);
      g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(p.x, p.y, 9, 0, U.TAU); ctx.fill();
      ctx.restore();
    }
  },

  drawOne(ctx, e, t) {
    const c = e.def.color;
    const s = e.r / 13; // visual scale relative to a base of 13
    ctx.save();
    ctx.translate(e.x, e.y);
    // elite aura
    if (e.elite) {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      const g = ctx.createRadialGradient(0, 0, 0, 0, 0, e.r * 2.4);
      g.addColorStop(0, e.boss ? 'rgba(255,43,72,0.5)' : 'rgba(165,91,255,0.4)');
      g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(0, 0, e.r * 2.4, 0, U.TAU); ctx.fill();
      ctx.restore();
    }
    if (e.def.aura) {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = 0.12 + 0.05 * Math.sin(t * 4);
      const g = ctx.createRadialGradient(0, 0, 0, 0, 0, e.def.aura.radius);
      g.addColorStop(0, c);
      g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(0, 0, e.def.aura.radius, 0, U.TAU); ctx.fill();
      ctx.restore();
    }

    ctx.scale(s, s);
    // cheap glow: wide translucent outline instead of shadowBlur (perf)
    const drawGlow = () => {
      ctx.save();
      ctx.globalAlpha = 0.28;
      ctx.strokeStyle = c;
      ctx.lineWidth = 6;
      ctx.stroke();
      ctx.restore();
    };
    ctx.lineWidth = 2.2;
    ctx.strokeStyle = c;
    ctx.fillStyle = 'rgba(8,10,18,0.92)';

    const wob = Math.sin(e.wobble) * 0.12;
    ctx.rotate(wob);

    switch (e.def.id) {
      case 'notfound': {
        // rotating diamond with 404
        ctx.beginPath();
        ctx.moveTo(0, -11); ctx.lineTo(9, 0); ctx.lineTo(0, 11); ctx.lineTo(-9, 0);
        ctx.closePath(); ctx.fill(); drawGlow(); ctx.stroke();
        ctx.fillStyle = c;
        ctx.font = 'bold 8px monospace';
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText('404', 0, 1);
        break;
      }
      case 'toomany': {
        // jittering triple stack
        const j = Math.sin(t * 20 + e.wobble) * 1.5;
        for (let i = -1; i <= 1; i++) {
          ctx.strokeRect(-8 + j * i, i * 7 - 3.5, 16, 6);
          ctx.fillStyle = 'rgba(60,50,10,0.8)';
          ctx.fillRect(-8 + j * i, i * 7 - 3.5, 16, 6);
        }
        ctx.fillStyle = c;
        ctx.font = 'bold 6px monospace';
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText('429', 0, 14);
        break;
      }
      case 'forbidden': {
        // hex shield
        ctx.beginPath();
        for (let i = 0; i < 6; i++) {
          const a = i / 6 * U.TAU + Math.PI / 6;
          const x = Math.cos(a) * 13, y = Math.sin(a) * 13;
          i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
        }
        ctx.closePath(); ctx.fill(); drawGlow(); ctx.stroke();
        // shield arc
        ctx.beginPath(); ctx.arc(0, 0, 9, -2.4, -0.7); ctx.stroke();
        ctx.fillStyle = c;
        ctx.font = 'bold 8px monospace';
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText('403', 0, 2);
        break;
      }
      case 'timeout': {
        // hourglass
        ctx.beginPath();
        ctx.moveTo(-8, -10); ctx.lineTo(8, -10); ctx.lineTo(-8, 10); ctx.lineTo(8, 10);
        ctx.closePath(); ctx.fill(); drawGlow(); ctx.stroke();
        ctx.fillStyle = c;
        ctx.globalAlpha = 0.5 + 0.4 * Math.sin(t * 3 + e.wobble);
        ctx.beginPath();
        ctx.moveTo(-5, -8); ctx.lineTo(5, -8); ctx.lineTo(0, -1);
        ctx.closePath(); ctx.fill();
        ctx.globalAlpha = 1;
        break;
      }
      case 'servererror': {
        // cracked heavy cube
        ctx.fillRect(-20, -20, 40, 40);
        ctx.strokeRect(-20, -20, 40, 40);
        ctx.beginPath();
        ctx.moveTo(-10, -20); ctx.lineTo(-4, -6); ctx.lineTo(-12, 6); ctx.lineTo(-2, 20);
        ctx.moveTo(12, -18); ctx.lineTo(6, -2); ctx.lineTo(14, 8);
        ctx.stroke();
        ctx.fillStyle = c;
        ctx.font = 'bold 11px monospace';
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText('500', 0, -8);
        break;
      }
      case 'captcha': {
        ctx.fillRect(-12, -12, 24, 24);
        ctx.strokeRect(-12, -12, 24, 24);
        ctx.lineWidth = 1;
        for (let i = 1; i < 3; i++) {
          ctx.beginPath();
          ctx.moveTo(-12 + i * 8, -12); ctx.lineTo(-12 + i * 8, 12);
          ctx.moveTo(-12, -12 + i * 8); ctx.lineTo(12, -12 + i * 8);
          ctx.stroke();
        }
        ctx.lineWidth = 2.2;
        break;
      }
      case 'hallucination': {
        // wobbling ghost
        const gh = Math.sin(t * 6 + e.wobble) * 2;
        ctx.globalAlpha = 0.85;
        ctx.beginPath();
        ctx.arc(0, -2 + gh, 10, Math.PI, 0);
        ctx.lineTo(10, 8 + gh);
        for (let i = 0; i < 4; i++) ctx.lineTo(10 - i * 5 - 2.5, 8 + gh + (i % 2 ? 4 : -1));
        ctx.lineTo(-10, 8 + gh);
        ctx.closePath(); ctx.fill(); drawGlow(); ctx.stroke();
        ctx.fillStyle = '#052a12';
        ctx.beginPath(); ctx.arc(-3.5, -4 + gh, 1.6, 0, U.TAU); ctx.arc(3.5, -4 + gh, 1.6, 0, U.TAU); ctx.fill();
        ctx.globalAlpha = 1;
        break;
      }
      case 'apifailure': {
        // drone with emitter
        ctx.beginPath(); ctx.arc(0, 0, 9, 0, U.TAU); ctx.fill(); drawGlow(); ctx.stroke();
        ctx.beginPath(); ctx.arc(0, 0, 4, 0, U.TAU); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(-12, -9); ctx.lineTo(-6, -9); ctx.moveTo(6, -9); ctx.lineTo(12, -9);
        ctx.moveTo(-12, 9); ctx.lineTo(-6, 9); ctx.moveTo(6, 9); ctx.lineTo(12, 9);
        ctx.stroke();
        ctx.fillStyle = c;
        ctx.beginPath(); ctx.arc(0, 0, 1.6 + Math.sin(t * 8) * 0.6, 0, U.TAU); ctx.fill();
        break;
      }
      case 'phantom': {
        ctx.globalAlpha = 0.55;
        ctx.beginPath();
        ctx.moveTo(0, -9); ctx.lineTo(8, 0); ctx.lineTo(0, 9); ctx.lineTo(-8, 0);
        ctx.closePath(); ctx.fill(); ctx.stroke();
        ctx.globalAlpha = 1;
        break;
      }
      case 'swarmlord': {
        ctx.beginPath();
        ctx.moveTo(0, -18); ctx.lineTo(15, 0); ctx.lineTo(0, 18); ctx.lineTo(-15, 0);
        ctx.closePath(); ctx.fill(); drawGlow(); ctx.stroke();
        // orbiting minions
        for (let i = 0; i < 4; i++) {
          const a = t * 2.4 + i * U.TAU / 4;
          ctx.beginPath(); ctx.arc(Math.cos(a) * 24, Math.sin(a) * 24, 4, 0, U.TAU);
          ctx.fillStyle = c; ctx.fill();
        }
        ctx.fillStyle = c;
        ctx.font = 'bold 10px monospace';
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText('404+', 0, 1);
        break;
      }
      case 'memleak': {
        // dripping blob
        ctx.beginPath();
        ctx.arc(0, 0, 20, 0, U.TAU); ctx.fill(); drawGlow(); ctx.stroke();
        ctx.beginPath();
        ctx.arc(8, 16 + Math.sin(t * 5) * 3, 4, 0, U.TAU); ctx.fill();
        ctx.fillStyle = c;
        ctx.font = 'bold 8px monospace';
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText('LEAK', 0, 1);
        break;
      }
    }

    // boss overrides: окно ошибки с крупной надписью — цель читается сразу
    if (e.boss) {
      ctx.rotate(-wob);
      const bw = 30, bh = 22;
      ctx.fillStyle = 'rgba(6,10,18,0.94)';
      ctx.fillRect(-bw, -bh, bw * 2, bh * 2);
      ctx.strokeStyle = e.def.color;
      ctx.lineWidth = 3;
      ctx.strokeRect(-bw, -bh, bw * 2, bh * 2);
      // title bar окна
      ctx.globalAlpha = 0.9;
      ctx.fillStyle = e.def.color;
      ctx.fillRect(-bw, -bh, bw * 2, 5);
      ctx.globalAlpha = 1;
      // крупный символ: тикающие часы / код ошибки / чекбокс верификации
      ctx.font = 'bold 15px monospace';
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillStyle = e.def.color;
      if (e.def.id === 'limit') {
        // часы сброса лимита = здоровье босса: 5:00 → 0:00 по мере урона
        const h = Math.max(0, Math.ceil((e.hp / e.maxHp) * 5));
        ctx.fillText(h + ':00', 0, 3);
      } else if (e.def.id === 'ratelimit') {
        // «проверка займёт 5 секунд» — вечные 5 секунд ожидания
        ctx.fillText('5 СЕК', 0, 3);
      } else if (e.def.id === 'verifier') {
        // чекбокс верификации: после половины HP появляется галочка — «вы робот»
        ctx.strokeStyle = e.def.color;
        ctx.lineWidth = 2;
        ctx.strokeRect(-7, -9, 14, 14);
        if (e.hp < e.maxHp * 0.5) {
          ctx.beginPath();
          ctx.moveTo(-4, -2); ctx.lineTo(-1, 4); ctx.lineTo(5, -7);
          ctx.stroke();
        }
      } else {
        ctx.fillText('ERR', 0, 3);
      }
      // телеграф атаки: пунктирное кольцо перед ударом по площади
      if (e.telegraph) {
        ctx.globalAlpha = 0.45 + 0.45 * Math.sin(t * 12);
        ctx.strokeStyle = '#ff3b52';
        ctx.setLineDash([10, 8]);
        ctx.lineWidth = 3;
        ctx.beginPath(); ctx.arc(0, 0, 62, 0, U.TAU); ctx.stroke();
        ctx.setLineDash([]);
        ctx.globalAlpha = 1;
      }
    }
    ctx.shadowBlur = 0;

    // hit flash
    if (e.hitFlash > 0) {
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = e.hitFlash * 0.55;
      ctx.fillStyle = '#ffffff';
      ctx.beginPath(); ctx.arc(0, 0, e.r * 0.9, 0, U.TAU); ctx.fill();
    }
    ctx.restore();

    // hp bar for anything that took damage — bosses, elites and regular errors
    if (e.hp < e.maxHp) {
      const w = Math.max(34, e.r * 2.4);
      const by = e.y - e.r - 12;
      ctx.fillStyle = 'rgba(0,0,0,0.65)';
      ctx.fillRect(e.x - w / 2 - 1, by - 1, w + 2, 6);
      ctx.fillStyle = e.boss ? '#ff2b48' : e.elite ? '#a55bff' : '#ff5a6e';
      ctx.fillRect(e.x - w / 2, by, w * Math.max(0, e.hp / e.maxHp), 4);
    }
  },

  clear() {
    this.list = []; this.blocks = []; this.projectiles = [];
    if (this.grid) this.grid.clear();
    this.boss = null;
  },
};
