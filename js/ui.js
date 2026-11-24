/* ============================================================
   AI Agent Survivors — user interface
   Menus, HUD, level-up cards, pause, satirical game-over report.
   ============================================================ */
'use strict';

const UI = {
  els: {},
  announceQueue: [],
  hudTimer: 0,

  init() {
    const $ = id => document.getElementById(id);
    this.els = {
      canvas: $('gameCanvas'),
      menu: $('screenMenu'), hud: $('hud'), pause: $('screenPause'),
      levelup: $('screenLevelUp'), gameover: $('screenGameOver'),
      hudCtxFill: $('hudCtxFill'), hudCtxText: $('hudCtxText'),
      hudXpFill: $('hudXpFill'), hudLevel: $('hudLevel'),
      hudTime: $('hudTime'), hudScore: $('hudScore'),
      hudWeapons: $('hudWeapons'),
      bestScore: $('menuBest'), bestTime: $('menuBestTime'),
      cards: $('levelCards'),
      goTime: $('goTime'), goScore: $('goScore'), goKills: $('goKills'),
      goLevel: $('goLevel'), goData: $('goData'), goBest: $('goBest'), goVerdict: $('goVerdict'),
      goJoke: $('goJoke'), goNewRecord: $('goNewRecord'),
      announce: $('announceBox'),
      musicRange: $('musicRange'), sfxRange: $('sfxRange'),
      musicCheck: $('musicCheck'), sfxCheck: $('sfxCheck'),
      pauseMusicRange: $('pauseMusicRange'), pauseSfxRange: $('pauseSfxRange'),
      pauseMusicCheck: $('pauseMusicCheck'), pauseSfxCheck: $('pauseSfxCheck'),
    };
    this.loadBest();
    this.bindSettings();
    MenuChat.init();
  },

  /* ---------------- persistence ---------------- */
  loadBest() {
    let best = { score: 0, time: 0 };
    try {
      const raw = localStorage.getItem(CFG.storage.bestKey);
      if (raw) best = JSON.parse(raw);
    } catch (e) { /* private mode etc. */ }
    this.best = best;
    this.els.bestScore.textContent = U.fmtNum(best.score);
    this.els.bestTime.textContent = U.fmtTime(best.time);
  },

  saveBest(score, time) {
    let updated = false;
    if (score > (this.best.score || 0)) { this.best.score = Math.round(score); updated = true; }
    if (time > (this.best.time || 0)) { this.best.time = Math.floor(time); updated = true; }
    if (updated) {
      try { localStorage.setItem(CFG.storage.bestKey, JSON.stringify(this.best)); } catch (e) {}
      this.els.bestScore.textContent = U.fmtNum(this.best.score);
      this.els.bestTime.textContent = U.fmtTime(this.best.time);
    }
    return updated;
  },

  loadSettings() {
    let s = { music: true, sfx: true, mv: 0.6, sv: 0.8 };
    try {
      const raw = localStorage.getItem(CFG.storage.settingsKey);
      if (raw) s = Object.assign(s, JSON.parse(raw));
    } catch (e) {}
    AudioSys_.musicOn = s.music; AudioSys_.sfxOn = s.sfx;
    AudioSys_.musicVol = s.mv; AudioSys_.sfxVol = s.sv;
    this.applySettingsToControls(s);
  },

  saveSettings() {
    const s = {
      music: AudioSys_.musicOn, sfx: AudioSys_.sfxOn,
      mv: AudioSys_.musicVol, sv: AudioSys_.sfxVol,
    };
    try { localStorage.setItem(CFG.storage.settingsKey, JSON.stringify(s)); } catch (e) {}
  },

  applySettingsToControls(s) {
    const setPair = (chk, rng, on, v) => {
      if (chk) chk.checked = on;
      if (rng) rng.value = Math.round(v * 100);
    };
    setPair(this.els.musicCheck, this.els.musicRange, s.music, s.mv);
    setPair(this.els.sfxCheck, this.els.sfxRange, s.sfx, s.sv);
    setPair(this.els.pauseMusicCheck, this.els.pauseMusicRange, s.music, s.mv);
    setPair(this.els.pauseSfxCheck, this.els.pauseSfxRange, s.sfx, s.sv);
  },

  bindSettings() {
    const bind = (chk, rng, apply, key) => {
      if (chk) chk.addEventListener('change', () => { apply('on', chk.checked); this.saveSettings(); AudioSys_.sfx('click'); });
      if (rng) rng.addEventListener('input', () => { apply('vol', rng.value / 100); this.saveSettings(); });
    };
    const musicApply = (k, v) => { if (k === 'on') AudioSys_.setMusic(v); else AudioSys_.setMusicVol(v); };
    const sfxApply = (k, v) => { if (k === 'on') AudioSys_.setSfx(v); else AudioSys_.setSfxVol(v); };
    bind(this.els.musicCheck, this.els.musicRange, musicApply);
    bind(this.els.pauseMusicCheck, this.els.pauseMusicRange, musicApply);
    bind(this.els.sfxCheck, this.els.sfxRange, sfxApply);
    bind(this.els.pauseSfxCheck, this.els.pauseSfxRange, sfxApply);
    // sync both control groups
    const syncAll = () => {
      const s = { music: AudioSys_.musicOn, sfx: AudioSys_.sfxOn, mv: AudioSys_.musicVol, sv: AudioSys_.sfxVol };
      this.applySettingsToControls(s);
      const bm = document.getElementById('btnMusicToggle');
      const bs = document.getElementById('btnSfxToggle');
      if (bm) bm.classList.toggle('off', !s.music);
      if (bs) bs.classList.toggle('off', !s.sfx);
    };
    this._syncAll = syncAll;
    this._syncAll();
  },

  /* ---------------- screens ---------------- */
  show(id) {
    for (const k of ['menu', 'hud', 'pause', 'levelup', 'gameover']) {
      if (k === id) { this.els[k].classList.add('visible'); continue; }
      // during level-up the HUD stays visible under the overlay
      if (id === 'levelup' && k === 'hud') continue;
      this.els[k].classList.remove('visible');
    }
  },

  showMenu() { this.show('menu'); MenuChat.refresh(); },
  showHud() { this.show('hud'); },
  showPause() { this.show('pause'); this._syncAll && this._syncAll(); },
  showLevelUp() { this.show('levelup'); },
  showGameOver() { this.show('gameover'); },

  /* ---------------- HUD ---------------- */
  updateHUD(dt) {
    this.hudTimer -= dt;
    if (this.hudTimer > 0) return;
    this.hudTimer = 0.1;

    const e = this.els;
    e.hudCtxFill.style.width = (Player.contextPct * 100).toFixed(1) + '%';
    e.hudCtxFill.classList.toggle('low', Player.contextPct < 0.3);
    e.hudCtxFill.classList.toggle('mid', Player.contextPct < 0.55 && Player.contextPct >= 0.3);
    e.hudCtxText.textContent = 'КОНТЕКСТ ' + Math.max(0, Math.round(Player.context)) + ' / ' + Math.round(Player.maxContext);
    e.hudXpFill.style.width = (Player.xp / Player.xpNext * 100).toFixed(1) + '%';
    e.hudLevel.textContent = 'УР. ' + Player.level;
    e.hudTime.textContent = U.fmtTime(Game.time);
    e.hudScore.textContent = U.fmtNum(Game.score) + ' ОЧКОВ';

    // weapon icons
    let html = '';
    for (const w of Weapons.slots) {
      const def = Weapons.defs[w.id];
      const name = w.evolved ? def.evolve.name : def.name;
      html += '<div class="wicon" title="' + name + ' (ур. ' + w.lvl + ')' + '">' +
        this.svgIcon(def.icon, w.evolved ? '#ffd24a' : def.color) +
        '<span class="wlvl">' + (w.evolved ? 'MAX' : w.lvl) + '</span></div>';
    }
    if (html) e.hudWeapons.innerHTML = html;
  },

  svgIcon(kind, color) {
    const s = 'width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="' + color + '" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"';
    const map = {
      search: '<circle cx="10" cy="10" r="6"/><line x1="15" y1="15" x2="21" y2="21"/>',
      stream: '<path d="M3 12h10"/><path d="M7 7h12"/><path d="M7 17h12"/>',
      tabs: '<rect x="3" y="7" width="12" height="12" rx="2"/><path d="M7 7V5h14v12h-2"/>',
      api: '<path d="M8 4L4 12l4 8"/><path d="M16 4l4 8-4 8"/><path d="M13 5l-2 14"/>',
      storm: '<path d="M12 3v6M12 15v6M3 12h6M15 12h6M6 6l4 4M14 14l4 4M18 6l-4 4M10 14l-4 4"/>',
      cache: '<circle cx="12" cy="12" r="8"/><path d="M12 4v4M12 16v4M4 12h4M16 12h4"/>',
      dmg: '<path d="M12 3l2 5h5l-4 4 2 6-5-3-5 3 2-6-4-4h5z"/>',
      rate: '<path d="M13 2L4 14h6l-1 8 9-12h-6z"/>',
      multi: '<circle cx="8" cy="8" r="3"/><circle cx="16" cy="16" r="3"/><circle cx="16" cy="8" r="3"/><circle cx="8" cy="16" r="3"/>',
      speed: '<path d="M4 20h16"/><path d="M6 20a10 10 0 0 1 12 0"/><path d="M12 12l4-5"/>',
      area: '<circle cx="12" cy="12" r="4"/><circle cx="12" cy="12" r="9"/>',
      move: '<path d="M12 3l3 4h-6zM12 21l-3-4h6zM3 12l4-3v6zM21 12l-4 3v-6z"/>',
      ctx: '<rect x="4" y="6" width="16" height="12" rx="2"/><path d="M8 10h8M8 14h5"/>',
      regen: '<path d="M4 12a8 8 0 1 1 2 5"/><path d="M4 17v-5h5"/>',
      magnet: '<path d="M6 4v8a6 6 0 0 0 12 0V4"/><path d="M6 4h4v6H6zM14 4h4v6h-4z"/>',
      armor: '<path d="M12 3l7 3v5c0 5-3 8-7 10-4-2-7-5-7-10V6z"/>',
      luck: '<path d="M12 4a8 8 0 1 0 8 8"/><path d="M12 8a4 4 0 1 0 4 4"/>',
    };
    return '<svg ' + s + '>' + (map[kind] || '') + '</svg>';
  },

  /* ---------------- announcements ---------------- */
  announce(text, color) {
    this.announceQueue.push({ text, color: color || '#00e5ff', life: 3.2 });
  },

  updateAnnounce(dt) {
    const box = this.els.announce;
    if (this.announceQueue.length) {
      const a = this.announceQueue[0];
      a.life -= dt;
      box.style.opacity = a.life > 2.8 ? (3.2 - a.life) * 3 : Math.min(1, a.life);
      box.style.color = a.color;
      box.style.borderColor = a.color;
      if (box.textContent !== a.text) box.textContent = a.text;
      if (a.life <= 0) { this.announceQueue.shift(); box.textContent = ''; }
    } else {
      box.style.opacity = 0;
    }
  },

  /* ---------------- level up ---------------- */
  openLevelUp() {
    Game.setState('levelup');
    this._buildCards();
    this.showLevelUp();
  },

  _buildCards() {
    const opts = [];
    // 1) evolution has absolute priority
    const evo = Weapons.availableEvolution();
    if (evo) {
      opts.push({ kind: 'evolve', evo, title: 'ЭВОЛЮЦИЯ: ' + evo.evo.name, desc: evo.evo.desc, color: '#ffd24a' });
    }
    // 2) upgrades of owned weapons
    for (const w of Weapons.slots) {
      const def = Weapons.defs[w.id];
      if (w.evolved || w.lvl >= def.maxLevel) continue;
      opts.push({
        kind: 'weapon', id: w.id, title: def.name + ' → ур. ' + (w.lvl + 1),
        desc: this._weaponUpgradeDesc(w.id, w.lvl + 1), color: def.color, weight: 4,
      });
    }
    // 3) new weapons
    if (Weapons.slots.length < Weapons.maxSlots) {
      for (const id in Weapons.defs) {
        if (Weapons.has(id)) continue;
        const def = Weapons.defs[id];
        opts.push({ kind: 'weapon', id, title: def.name + ' (новое)', desc: def.desc, color: def.color, weight: 3 });
      }
    }
    // 4) passives
    for (const id in Weapons.passiveDefs) {
      const def = Weapons.passiveDefs[id];
      const lvl = Weapons.passiveLevels[id] || 0;
      if (lvl >= def.maxLevel) continue;
      opts.push({ kind: 'passive', id, title: def.name + ' → ур. ' + (lvl + 1), desc: def.desc, color: '#5fd8ff', weight: 2.4 });
    }

    const picked = [];
    const pool = opts.slice();
    while (picked.length < Math.min(3, opts.length)) {
      const c = U.weighted(pool.length ? pool : opts);
      if (!picked.includes(c)) picked.push(c);
      pool.splice(pool.indexOf(c), 1);
      if (!pool.length) break;
    }
    // fallback when everything is maxed out
    if (!picked.length) {
      picked.push({ kind: 'bonus', title: 'Экстренная подкачка', desc: '+20 контекста немедленно.', color: '#3f7bff' });
    }

    const box = this.els.cards;
    box.innerHTML = '';
    picked.forEach((c, i) => {
      const el = document.createElement('div');
      el.className = 'card';
      el.style.setProperty('--accent', c.color);
      const icon = c.kind === 'evolve' ? this.svgIcon('dmg', '#ffd24a')
        : c.kind === 'weapon' ? this.svgIcon(Weapons.defs[c.id].icon, c.color)
        : this.svgIcon(Weapons.passiveDefs[c.id].icon, c.color);
      el.innerHTML =
        '<div class="cardIcon">' + icon + '</div>' +
        '<div class="cardTitle">' + c.title + '</div>' +
        '<div class="cardDesc">' + c.desc + '</div>' +
        '<div class="cardKey">[' + (i + 1) + ']</div>';
      el.addEventListener('click', () => this.pickCard(c));
      box.appendChild(el);
    });
    this._currentCards = picked;
  },

  _weaponUpgradeDesc(id, lvl) {
    const def = Weapons.defs[id];
    const a = def.stats(lvl - 1), b = def.stats(lvl);
    const parts = [];
    if (b.dmg > a.dmg) parts.push('урон ' + Math.round(a.dmg) + '→' + Math.round(b.dmg));
    if (b.count > a.count) parts.push('снарядов +' + (b.count - a.count));
    if (b.cd < a.cd) parts.push('перезарядка быстрее');
    if (b.radius > a.radius) parts.push('радиус больше');
    if (b.pierce > a.pierce) parts.push('пробитие больше');
    if (b.chain > a.chain) parts.push('цепь +' + (b.chain - a.chain));
    return parts.join(', ') || 'Улучшенные характеристики.';
  },

  pickCard(c) {
    AudioSys_.sfx('click');
    if (c.kind === 'evolve') {
      Weapons.evolve(c.evo.evo.id);
    } else if (c.kind === 'weapon') {
      Weapons.addOrLevel(c.id);
    } else if (c.kind === 'bonus') {
      Player.addContext(20);
    } else {
      Weapons.passiveLevels[c.id] = (Weapons.passiveLevels[c.id] || 0) + 1;
      Player.applyPassive(c.id, 1);
      Weapons._refreshOrbs(); // keep orbit stats in sync with new passives
    }
    Game.setState('playing');
    this.showHud();
  },

  /* ---------------- game over report ---------------- */
  jokes: [
    'Агент запросил дополнительный контекст и не получил его.',
    'Причина сбоя: агент попытался открыть слишком много вкладок.',
    'Логи говорят: «я почти понял задачу». Логи не понимают.',
    'Агент уверенно отвечал. Просто не на тот вопрос.',
    'Токены закончились раньше, чем мысли.',
    'Модель была уверена. Модель ошибалась. Всё как обычно.',
    'Финальная мысль агента: «а может, перезапустить?»',
    'Птичий взгляд: агент просто хотел всем помочь.',
    'Ошибка 424: зависимость от контекста не найдена.',
    'Агент ушёл в бесконечный цикл самооптимизации.',
  ],

  verdicts(score, time) {
    if (time < 60) return 'КЛАССИФИКАЦИЯ: ГАЛЛЮЦИНИРУЮЩИЙ СТАЖЁР';
    if (time < 180) return 'КЛАССИФИКАЦИЯ: МЛАДШИЙ АГЕНТ-ПЕРЕПРОШИВАТЕЛЬ';
    if (time < 360) return 'КЛАССИФИКАЦИЯ: ПОЛЕЗНЫЙ АССИСТЕНТ (ЛЕГКО ЗАМЕНИМ)';
    if (time < 600) return 'КЛАССИФИКАЦИЯ: СЕРЬЁЗНЫЙ СОПЕРНИК ДЛЯ 404';
    return 'КЛАССИФИКАЦИЯ: ГОТОВ К ДЕПЛОЮ В ПРОДАКШН';
  },

  showGameOverReport() {
    const e = this.els;
    e.goTime.textContent = U.fmtTime(Game.time);
    e.goScore.textContent = U.fmtNum(Game.score);
    e.goKills.textContent = U.fmtNum(Game.kills);
    e.goLevel.textContent = Player.level;
    const earned = Meta.earnRun(Game.score, Player.level);
    if (e.goData) e.goData.textContent = '+' + U.fmtNum(earned) + ' · баланс: ' + U.fmtNum(Meta.state.data);
    const isRecord = this.saveBest(Game.score, Game.time);
    e.goBest.textContent = U.fmtNum(this.best.score) + ' (' + U.fmtTime(this.best.time) + ')';
    e.goNewRecord.style.display = isRecord ? 'block' : 'none';
    e.goVerdict.textContent = this.verdicts(Game.score, Game.time);
    e.goJoke.textContent = U.choice(this.jokes);
    MenuChat.recordRun({
      score: Math.round(Game.score),
      time: Math.floor(Game.time),
      kills: Game.kills,
      level: Player.level,
    });
    this.showGameOver();
  },
};

/* ============================================================
   MenuChat — главное меню в виде переписки с AI-агентом.
   Справа — запросы пользователя, слева — ответы агента
   (ошибка + отчёт о забеге). История хранится в localStorage.
   ============================================================ */

const MenuChat = {
  queries: [
    'Привет, как дела?',
    'Сделай мне что-нибудь красивое',
    'Напиши стих про котика, только нормальный',
    'Что делать, если не знаешь, что делать?',
    'Объясни квантовую физику за пять секунд',
    'Придумай название для стартапа про свечи',
    'Найди мне ресторан. Где я — не скажу',
    'Сгенерируй картинку: кот-космонавт, мегаполис, неон',
    'Сколько будет 2+2? Только быстро, у меня дедлайн',
    'Перепиши моё резюме, чтобы меня наконец наняли',
    'Составь план на жизнь. Желательно до вечера',
    'Ответь на письмо клиента. Клиент очень нервный',
  ],

  history: [],
  _busy: false,
  pendingQuery: null,

  init() {
    this.els = {
      log: document.getElementById('chatLog'),
      input: document.getElementById('chatInput'),
      send: document.getElementById('chatSend'),
      chips: document.getElementById('chatChips'),
      shop: document.getElementById('shopChips'),
      data: document.getElementById('menuData'),
    };
    if (!this.els.log || !this.els.input || !this.els.send) return;
    try {
      const raw = localStorage.getItem(CFG.storage.historyKey);
      if (raw) this.history = JSON.parse(raw) || [];
    } catch (e) { this.history = []; }
    this.els.input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !this._busy) this.send();
    });
    this.els.send.addEventListener('click', () => this.send());
    this.refresh();
  },

  refresh() {
    if (!this.els || !this.els.log) return;
    this.render();
    this.renderChips();
    this.renderShop();
    this.refreshData();
    if (!this._busy) {
      this.els.input.value = this.queries[(Math.random() * this.queries.length) | 0];
    }
    this.els.log.scrollTop = this.els.log.scrollHeight;
  },

  refreshData() {
    if (this.els.data) this.els.data.textContent = U.fmtNum(Meta.state.data);
  },

  renderShop() {
    if (!this.els.shop) return;
    this.els.shop.innerHTML = '';
    const vis = Meta.visibleUpgrades();
    for (const item of vis) {
      const b = document.createElement('button');
      b.className = 'chip chipShop';
      b.type = 'button';
      const price = item.price(Meta.lvl(item.id));
      const lvlTxt = item.maxLevel > 1 ? ' ур.' + (Meta.lvl(item.id) + 1) : '';
      b.textContent = '⬆ ' + item.name + lvlTxt + ' · ' + price + ' данных';
      b.title = item.desc;
      b.addEventListener('click', () => this.buyFlow(item));
      this.els.shop.appendChild(b);
    }
  },

  buyFlow(item) {
    if (this._busy) return;
    this._busy = true;
    const log = this.els.log;
    const price = item.price(Meta.lvl(item.id));
    log.appendChild(this._msg('user', 'Купить: ' + item.name + ' · ' + price + ' данных'));
    this._typingEl = this._msg('agent',
      '<div class="agentName">ALICE AI</div>' +
      '<div class="agentText typing">проверяю выручку <span></span><span></span><span></span></div>');
    log.appendChild(this._typingEl);
    log.scrollTop = log.scrollHeight;
    this.els.input.value = '';
    this.els.send.disabled = true;
    this.els.input.disabled = true;
    setTimeout(() => {
      const r = Meta.buy(item.id);
      let html;
      if (r.ok) {
        html = '<div class="agentName">ALICE AI · магазин</div>' +
          '<div class="agentText">' + item.flavor + '</div>' +
          '<div class="agentStats">' +
          '<span>Куплено: ' + item.name + (item.maxLevel > 1 ? ' (ур. ' + r.level + '/' + item.maxLevel + ')' : '') + '</span>' +
          '<span>Осталось данных: ' + U.fmtNum(Meta.state.data) + '</span>' +
          '</div>' +
          '<div class="agentText">Улучшение уже активно в следующем забеге.</div>';
      } else if (r.need !== undefined) {
        html = '<div class="agentName">ALICE AI · магазин</div>' +
          '<div class="agentError">ОТКАЗ: НЕДОСТАТОЧНО ДАННЫХ</div>' +
          '<div class="agentText">Нужно ' + U.fmtNum(r.need) + ' данных, на балансе ' + U.fmtNum(r.have) + '. Отправьте меня в мир — там они водятся.</div>';
      } else {
        html = '<div class="agentName">ALICE AI · магазин</div>' +
          '<div class="agentError">ОТКАЗ: УЛУЧШЕНИЕ НЕДОСТУПНО</div>';
      }
      if (this._typingEl && this._typingEl.parentNode) this._typingEl.parentNode.removeChild(this._typingEl);
      this._typingEl = null;
      log.appendChild(this._msg('agent', html));
      log.scrollTop = log.scrollHeight;
      this._busy = false;
      this.els.send.disabled = false;
      this.els.input.disabled = false;
      this.renderShop();
      this.refreshData();
    }, 900);
  },

  renderChips() {
    if (!this.els.chips) return;
    this.els.chips.innerHTML = '';
    const off = (Math.random() * this.queries.length) | 0;
    const n = Math.min(6, this.queries.length);
    for (let i = 0; i < n; i++) {
      const q = this.queries[(off + i) % this.queries.length];
      const b = document.createElement('button');
      b.className = 'chip';
      b.type = 'button';
      b.textContent = q;
      b.addEventListener('click', () => {
        if (this._busy) return;
        this.els.input.value = q;
        this.send();
      });
      this.els.chips.appendChild(b);
    }
  },

  refreshBest() {
    if (!this.els || !this.els.log) return;
    this.render();
    this.els.log.scrollTop = this.els.log.scrollHeight;
  },

  escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  },

  _msg(kind, html) {
    const d = document.createElement('div');
    d.className = kind === 'user' ? 'msg msgUser' : 'msg msgAgent';
    d.innerHTML = html;
    return d;
  },

  render() {
    const log = this.els.log;
    if (!log) return;
    log.innerHTML = '';
    if (!this.history.length) {
      log.appendChild(this._msg('agent',
        '<div class="agentName">ALICE AI</div>' +
        '<div class="agentText">Здравствуйте! Пока ваша история пуста: вы ещё ни разу не отправляли меня в цифровой мир.</div>' +
        '<div class="agentText">Напишите запрос или нажмите подсказку ниже — любой, хоть «привет». Я пойду его выполнять и постараюсь не растерять контекст.</div>' +
        '<div class="agentText">Золотые кнопки под подсказками — магазин: там я за собранные на арене данные покупаю постоянные улучшения. Открываются только за то, с чем уже сталкивались. В мире: зелёный плюс — контекст, жёлтый ромб — опыт.</div>'));
      return;
    }
    const best = this.history.reduce((m, h) => Math.max(m, h.score || 0), 0) || 0;
    for (const h of this.history) {
      log.appendChild(this._msg('user', this.escapeHtml(h.q)));
      log.appendChild(this._msg('agent',
        '<div class="agentName">ALICE AI · отчёт о задаче</div>' +
        '<div class="agentError">ERROR ' + h.code + ': КОНТЕКСТ АГЕНТА ИСЧЕРПАН</div>' +
        '<div class="agentStats">' +
        '<span>Запрос: «' + this.escapeHtml(h.q) + '»</span>' +
        '<span>Время выживания: ' + U.fmtTime(h.time) + '</span>' +
        '<span>Счёт: ' + U.fmtNum(h.score) + (h.score >= best && h.score > 0 ? ' · личный рекорд' : '') + '</span>' +
        '<span>Уничтожено ошибок: ' + U.fmtNum(h.kills) + '</span>' +
        '<span>Уровень агента: ' + h.level + '</span>' +
        '<span>Заработано данных: +' + U.fmtNum(h.data || 0) + ' (баланс: ' + U.fmtNum(Meta.state.data) + ')</span>' +
        '</div>' +
        '<div class="agentText">' + (h.joke || '') + '</div>'));
    }
  },

  recordRun(stats) {
    const h = {
      q: this.pendingQuery || '—',
      code: [403, 429, 500, 504, 418][(Math.random() * 5) | 0],
      score: stats.score,
      time: stats.time,
      kills: stats.kills,
      level: stats.level,
      data: Meta.lastEarn,
      joke: U.choice(UI.jokes),
    };
    this.history.push(h);
    if (this.history.length > 25) this.history = this.history.slice(-25);
    try { localStorage.setItem(CFG.storage.historyKey, JSON.stringify(this.history)); } catch (e) {}
  },

  send() {
    if (this._busy) return;
    const q = (this.els.input.value || '').trim() || this.queries[0];
    this._busy = true;
    this.pendingQuery = q;
    const log = this.els.log;
    log.appendChild(this._msg('user', this.escapeHtml(q)));
    log.appendChild(this._msg('agent',
      '<div class="agentName">ALICE AI</div>' +
      '<div class="agentText typing">агент обдумывает запрос <span></span><span></span><span></span></div>'));
    log.scrollTop = log.scrollHeight;
    this.els.input.value = '';
    this.els.send.disabled = true;
    this.els.input.disabled = true;
    setTimeout(() => {
      this._busy = false;
      this.els.send.disabled = false;
      this.els.input.disabled = false;
      Game.startRun();
    }, U.rand(900, 1500));
  },
};
