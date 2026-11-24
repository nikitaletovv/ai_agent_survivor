/* ============================================================
   AI Agent Survivors — main game controller
   State machine, camera, input, game loop, menu backdrop.
   ============================================================ */
'use strict';

const Input = {
  keys: {},
  init() {
    window.addEventListener('keydown', e => {
      this.keys[e.code] = true;
      Game.onKeyDown(e.code);
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) e.preventDefault();
    });
    window.addEventListener('keyup', e => { this.keys[e.code] = false; });
    window.addEventListener('blur', () => { this.keys = {}; });
  },
};

const Game = {
  state: 'menu',       // menu | playing | paused | levelup | gameover
  canvas: null, ctx: null,
  view: { w: 1280, h: 720, dpr: 1 },
  time: 0,
  score: 0,
  kills: 0,
  shakeT: 0, shakeAmp: 0,
  camX: 0, camY: 0,
  lastFrame: 0,
  fps: 60,
  fpsSmooth: 60,
  menuT: 0,

  /* ---------------- bootstrap ---------------- */
  init() {
    this.canvas = document.getElementById('gameCanvas');
    this.ctx = this.canvas.getContext('2d');
    Particles.init();
    UI.init();
    UI.loadSettings();
    Input.init();
    this.bindButtons();
    this.resize();
    window.addEventListener('resize', () => this.resize());
    this.resetRun();
    this.setState('menu');
    UI.showMenu();
    requestAnimationFrame(t => this.loop(t));
  },

  bindButtons() {
    const on = (id, fn) => { const el = document.getElementById(id); if (el) el.addEventListener('click', fn); };
    // старт забега идёт через чат-меню (MenuChat.send → Game.startRun)
    on('btnPauseResume', () => this.togglePause());
    on('btnPauseRestart', () => this.startRun());
    on('btnPauseMenu', () => { this.setState('menu'); UI.showMenu(); AudioSys_.stopMusic(); });
    on('btnAgain', () => this.startRun());
    on('btnGoMenu', () => { this.setState('menu'); UI.showMenu(); AudioSys_.stopMusic(); });
    on('btnMusicToggle', () => { AudioSys_.setMusic(!AudioSys_.musicOn); UI._syncAll(); UI.saveSettings(); });
    on('btnSfxToggle', () => { AudioSys_.setSfx(!AudioSys_.sfxOn); UI._syncAll(); UI.saveSettings(); });
  },

  resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.view.w = window.innerWidth;
    this.view.h = window.innerHeight;
    this.canvas.width = this.view.w * dpr;
    this.canvas.height = this.view.h * dpr;
    this.canvas.style.width = this.view.w + 'px';
    this.canvas.style.height = this.view.h + 'px';
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.view.dpr = dpr;
  },

  /* ---------------- state ---------------- */
  setState(s) {
    this.state = s;
    document.body.classList.toggle('in-game', s === 'playing');
  },

  onKeyDown(code) {
    if (CFG.keys.pause.includes(code)) {
      if (this.state === 'playing') this.togglePause();
      else if (this.state === 'paused') this.togglePause();
    }
    if (this.state === 'levelup') {
      const idx = CFG.keys.cards.indexOf(code);
      if (idx >= 0 && UI._currentCards && UI._currentCards[idx]) UI.pickCard(UI._currentCards[idx]);
    }
    if (this.state === 'playing' && (code === 'KeyM')) {
      AudioSys_.setMusic(!AudioSys_.musicOn); UI._syncAll(); UI.saveSettings();
    }
  },

  togglePause() {
    if (this.state === 'playing') {
      this.setState('paused');
      UI.showPause();
    } else if (this.state === 'paused') {
      this.setState('playing');
      UI.showHud();
    }
  },

  startRun() {
    AudioSys_.resume();
    AudioSys_.startMusic();
    this.resetRun();
    this.setState('playing');
    UI.showHud();
    UI.announce('СОХРАНЯЙ КОНТЕКСТ КАК МОЖНО ДОЛЬШЕ', '#00e5ff');
    UI.announce('ЗЕЛЁНЫЙ ПЛЮС = КОНТЕКСТ · ЖЁЛТЫЙ РОМБ = ОПЫТ', '#ffd24a');
    UI.announce('ШИНЫ ДАННЫХ УСКОРЯЮТ ВСЕХ — ВКЛЮЧАЯ ОШИБКИ', '#7fd4ff');
  },

  resetRun() {
    this.time = 0; this.score = 0; this.kills = 0;
    this.camX = 0; this.camY = 0;
    Player.reset();
    World.init();
    Pickups.init();
    Weapons.init();
    Enemies.init();
    Particles.clear();
    // стартовые бонусы мета-прогресса: подписки, окно памяти, стартовое оружие
    Meta.applyRun();
    // starting scatter of data around spawn
    for (let i = 0; i < 26; i++)
      Pickups.spawn(U.rand(-600, 600), U.rand(-600, 600), Math.random() < 0.6 ? 'snippet' : 'result');
  },

  gameOver() {
    if (this.state === 'gameover') return;
    this.setState('gameover');
    AudioSys_.sfx('bigboom');
    Game.shake(14, 1);
    UI.showGameOverReport();
  },

  /* ---------------- helpers ---------------- */
  addScore(v) { this.score += v; },
  shake(amp, time) { this.shakeAmp = Math.max(this.shakeAmp, amp); this.shakeT = Math.max(this.shakeT, time); },

  /* ---------------- main loop ---------------- */
  loop(now) {
    requestAnimationFrame(t => this.loop(t));
    let dt = (now - this.lastFrame) / 1000;
    this.lastFrame = now;
    if (!isFinite(dt) || dt <= 0) return;
    dt = Math.min(dt, 0.05);
    this.fpsSmooth = U.lerp(this.fpsSmooth, 1 / dt, 0.05);
    Particles.setBudget(this.fpsSmooth < CFG.performance.lowFpsThreshold
      ? CFG.performance.lowFpsParticles : CFG.performance.maxParticles);

    if (this.state === 'playing') this.update(dt);
    else if (this.state === 'menu') { this.menuT += dt; }

    this.render(dt);
    if (this.state === 'playing' || this.state === 'levelup') UI.updateHUD(dt);
    UI.updateAnnounce(dt);
  },

  update(dt) {
    this.time += dt;
    if (this.time > 240 && !this._time240Done) { this._time240Done = true; Meta.encounter('time240'); }

    // camera follows with slight lookahead
    const tx = Player.x + Player.lookX * 40, ty = Player.y + Player.lookY * 40;
    this.camX = U.lerp(this.camX, tx, Math.min(1, dt * 5));
    this.camY = U.lerp(this.camY, ty, Math.min(1, dt * 5));

    World.update(dt, this.camX, this.camY);
    Player.update(dt);
    Enemies.update(dt);
    Weapons.update(dt);
    Pickups.update(dt);
    Particles.update(dt);

    this.addScore(CFG.score.perSecond * dt);
    this.shakeT = Math.max(0, this.shakeT - dt);
    if (this.shakeT <= 0) this.shakeAmp = 0;
  },

  /* ---------------- render ---------------- */
  render(dt) {
    const ctx = this.ctx;
    const vw = this.view.w, vh = this.view.h;
    const t = this.state === 'menu' ? this.menuT : this.time;

    if (this.state === 'menu') {
      // меню — это просто чат: без арены на фоне
      ctx.fillStyle = '#0e0f12';
      ctx.fillRect(0, 0, vw, vh);
      return;
    }

    // shake offset
    let sx = 0, sy = 0;
    if (this.shakeT > 0) {
      sx = U.rand(-1, 1) * this.shakeAmp;
      sy = U.rand(-1, 1) * this.shakeAmp;
    }
    const camX = this.camX + sx, camY = this.camY + sy;

    // all world-space layers share one camera transform
    ctx.save();
    ctx.translate(vw / 2 - camX, vh / 2 - camY);
    World.draw(ctx, camX, camY, vw, vh, t);
    Enemies.drawBlocks(ctx, t);
    Pickups.draw(ctx, camX - vw / 2, camY - vh / 2, vw, vh, t);
    Enemies.draw(ctx, camX - vw / 2, camY - vh / 2, vw, vh, t);
    Weapons.draw(ctx, t);
    Player.draw(ctx, t);
    Particles.draw(ctx);
    ctx.restore();

    // vignette for focus (screen space)
    const vg = ctx.createRadialGradient(vw / 2, vh / 2, Math.min(vw, vh) * 0.42, vw / 2, vh / 2, Math.max(vw, vh) * 0.72);
    vg.addColorStop(0, 'rgba(0,0,0,0)');
    vg.addColorStop(1, 'rgba(0,0,10,0.55)');
    ctx.fillStyle = vg;
    ctx.fillRect(0, 0, vw, vh);

    // hurt flash overlay
    if (Player.hurtFlash > 0) {
      ctx.fillStyle = 'rgba(255,40,70,' + (Player.hurtFlash * 0.22) + ')';
      ctx.fillRect(0, 0, vw, vh);
    }

    // low context warning
    if (Player.contextPct < 0.25 && this.state === 'playing') {
      ctx.save();
      const pulse = 0.5 + 0.5 * Math.sin(this.time * 6);
      ctx.globalAlpha = 0.25 * pulse;
      ctx.fillStyle = '#ff3b52';
      ctx.fillRect(0, 0, vw, vh);
      ctx.restore();
      if (!this._lowWarned || this.time - this._lowWarned > 6) {
        this._lowWarned = this.time;
        UI.announce('КОНТЕКСТ НА ИСХОДЕ. СОБИРАЙ ДАННЫЕ!', '#ff3b52');
      }
    }

    // boss HP bar
    if (Enemies.boss && !Enemies.boss.dead) {
      const b = Enemies.boss;
      const w = Math.min(560, vw * 0.5);
      const x = (vw - w) / 2, y = 70;
      ctx.fillStyle = 'rgba(4,8,16,0.8)';
      ctx.fillRect(x - 3, y - 3, w + 6, 22);
      ctx.strokeStyle = '#ff2b48';
      ctx.lineWidth = 2;
      ctx.strokeRect(x - 3, y - 3, w + 6, 22);
      ctx.fillStyle = '#ff2b48';
      ctx.fillRect(x, y, w * Math.max(0, b.hp / b.maxHp), 16);
      ctx.fillStyle = '#e8f6ff';
      ctx.font = 'bold 12px monospace';
      ctx.textAlign = 'center';
      ctx.fillText(b.def.name, vw / 2, y - 8);
    }
  },
};

window.addEventListener('DOMContentLoaded', () => Game.init());
