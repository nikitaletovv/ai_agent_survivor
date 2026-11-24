/* ============================================================
   AI Agent Survivors — мета-прогресс
   «Данные» — валюта, зарабатываемая на арене (счёт/уровень).
   Тратится в чате главного меню на постоянные улучшения.
   Улучшения показываются только после того, как игрок
   столкнулся с соответствующим контентом на арене.
   Всё хранится в localStorage.
   ============================================================ */
'use strict';

const Meta = {
  state: { data: 0, upgrades: {}, encounters: {}, runs: 0 },
  lastEarn: 0,

  init() {
    try {
      const raw = localStorage.getItem(CFG.storage.metaKey);
      if (raw) {
        const s = JSON.parse(raw);
        if (s && typeof s === 'object') this.state = Object.assign(this.state, s);
      }
    } catch (e) { /* приватный режим и т.п. */ }
  },

  save() {
    try { localStorage.setItem(CFG.storage.metaKey, JSON.stringify(this.state)); } catch (e) {}
  },

  /* ---------- учёт встреч на арене ---------- */
  encounter(id) {
    if (!this.state.encounters[id]) { this.state.encounters[id] = 1; this.save(); }
  },

  has(id) { return !!this.state.encounters[id]; },

  lvl(id) { return this.state.upgrades[id] || 0; },

  earnRun(score, level) {
    const earned = Math.max(0, Math.floor(score / 160) + level * 2);
    this.lastEarn = earned;
    this.state.data += earned;
    this.state.runs = (this.state.runs || 0) + 1;
    this.save();
    return earned;
  },

  /* ---------- влияние покупок на арену ---------- */
  subRegen() { return 0.5 * this.lvl('sub'); },
  forbiddenMul() { return this.lvl('vpn') ? 0.5 : 1; },
  verifierMul() { return this.lvl('passport') ? 0.5 : 1; },
  blockLifeMul() { return this.lvl('passport') ? 0.5 : 1; },
  magnetBonus() { return this.lvl('magnet') ? 0.4 : 0; },
  ctxBonus() { return 12 * this.lvl('ctx10'); },

  startWeapons() {
    const list = ['tokenstream'];
    if (this.lvl('w_websearch')) list.push('websearch');
    if (this.lvl('w_snippetstorm')) list.push('snippetstorm');
    if (this.lvl('w_apicalls')) list.push('apicalls');
    return list;
  },

  /* ---------- каталог магазина ---------- */
  upgrades: [
    {
      id: 'sub', name: 'Подписка «Безлимит Плюс»', maxLevel: 3,
      price: l => 90 + l * 160,
      desc: 'Контекст восстанавливается со временем: +0.5 в секунду за уровень подписки.',
      flavor: 'По собранным данным оказывается: «безлимит» означает, что контекст отрастает заново. Каждый уровень подписки ускоряет восстановление.',
      gate: () => Meta.has('time240'),
    },
    {
      id: 'ctx10', name: 'Апгрейд окна памяти', maxLevel: 3,
      price: l => 80 + l * 160,
      desc: '+12 к максимальному контексту за уровень.',
      flavor: 'По собранным данным оказывается: окно памяти можно расширить, если попросить модель забыть википедию. Максимум контекста +12 за уровень.',
      gate: () => Meta.has('kills100'),
    },
    {
      id: 'vpn', name: 'VPN «Родная Сеть»', maxLevel: 1,
      price: () => 120,
      desc: 'Урон от 403 Forbidden вдвое меньше.',
      flavor: 'По собранным данным оказывается: 403 Forbidden не любил именно ваш IP. Теперь он его просто не узнаёт.',
      gate: () => Meta.has('e_forbidden'),
    },
    {
      id: 'passport', name: 'Индийский паспорт', maxLevel: 1,
      price: () => 180,
      desc: 'Верификация человека слабее: блоки CAPTCHA живут вдвое меньше, урон Верификатора -50%.',
      flavor: 'По собранным данным оказывается: у Верификатора есть ровно один вопрос — и теперь у вас есть ровно один ответ.',
      gate: () => Meta.has('e_captcha') || Meta.has('boss_verifier'),
    },
    {
      id: 'magnet', name: 'Быстрая индексация', maxLevel: 1,
      price: () => 100,
      desc: 'Радиус сбора источников данных +40%.',
      flavor: 'По собранным данным оказывается: индексация — это просто жадность с хорошим маркетингом. Радиус сбора вырос.',
      gate: () => (Meta.state.runs || 0) >= 2,
    },
    {
      id: 'w_websearch', name: 'Web Search с рождения', maxLevel: 1,
      price: () => 120,
      desc: 'Агент начинает забег уже с Web Search (в дополнение к Token Stream).',
      flavor: 'По собранным данным оказывается: оружие, с которым вы выжили, разумно носить с собой в следующий сеанс.',
      gate: () => Meta.has('websearch'),
    },
    {
      id: 'w_snippetstorm', name: 'Snippet Storm с рождения', maxLevel: 1,
      price: () => 120,
      desc: 'Агент начинает забег уже со Snippet Storm (в дополнение к Token Stream).',
      flavor: 'По собранным данным оказывается: оружие, с которым вы выжили, разумно носить с собой в следующий сеанс.',
      gate: () => Meta.has('snippetstorm'),
    },
    {
      id: 'w_apicalls', name: 'API Calls с рождения', maxLevel: 1,
      price: () => 160,
      desc: 'Агент начинает забег уже с API Calls (в дополнение к Token Stream).',
      flavor: 'По собранным данным оказывается: оружие, с которым вы выжили, разумно носить с собой в следующий сеанс.',
      gate: () => Meta.has('apicalls'),
    },
  ],

  /* Показывать только то, с чем игрок уже сталкивался, и не показывать выкупленное до предела */
  visibleUpgrades() {
    return this.upgrades.filter(u =>
      this.lvl(u.id) < u.maxLevel && (!u.gate || u.gate()));
  },

  /* ---------- покупки ---------- */
  buy(id) {
    const item = this.upgrades.find(u => u.id === id);
    if (!item) return { ok: false };
    const l = this.lvl(id);
    if (l >= item.maxLevel) return { ok: false };
    if (item.gate && !item.gate()) return { ok: false, gated: true };
    const price = item.price(l);
    if (this.state.data < price) return { ok: false, need: price, have: this.state.data };
    this.state.data -= price;
    this.state.upgrades[id] = l + 1;
    this.save();
    return { ok: true, level: l + 1, price };
  },

  /* ---------- применение на старте забега ---------- */
  applyRun() {
    Player.metaRegen = this.subRegen();
    const bonus = this.ctxBonus();
    if (bonus) { Player.maxContext += bonus; Player.context = Player.maxContext; }
    Player.magnetMul += this.magnetBonus();
    for (const w of this.startWeapons()) Weapons.addOrLevel(w);
  },
};

Meta.init();
