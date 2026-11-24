/* ============================================================
   AI Agent Survivors — global configuration
   All tuning constants live here for easy balancing.
   ============================================================ */
'use strict';

const CFG = {
  world: {
    chunk: 900,            // chunk size in world units
    roadEvery: 1800,       // neon trunk roads spacing
    roadWidth: 170,
    edgeGlow: '#1b4a72',
  },

  player: {
    maxContext: 78,
    contextDrain: 0,      // пассивного расхода больше нет (потрачено только от ошибок)
    speed: 170,
    pickRadius: 74,        // base magnet radius
    iframes: 0.75,         // invulnerability after a hit
    contactDamage: 9,      // default enemy touch damage
    radius: 16,
    colors: {
      body: '#0b2a3a', edge: '#2fd6ff', glow: 'rgba(0,220,255,0.55)',
      eye: '#b9f6ff', accents: '#7ff0ff',
    },
  },

  xp: { base: 12, growth: 1.27, linear: 5 },

  spawn: {
    startRate: 3.6,        // enemies per second at t=0
    rateGrowth: 3.0,       // additional eps per minute
    maxAlive: 380,
    spawnPad: 90,          // spawn distance outside the viewport edge
    hpScale: 0.55,         // hp multiplier gained per minute (plus quadratic term)
    dmgScale: 0.3,         // extra touch damage per minute
    speedScale: 0.13,      // enemies get faster every minute — kiting decays (plus quadratic term)
    areaRateMul: 1.7,      // cap of viewport-area spawn compensation (ultrawide)
  },

  boss: {
    interval: 180,         // seconds between bosses
    hp: 1600,
    score: 1500,
  },

  event: { first: 40, every: 50 }, // swarm events

  score: {
    perKill: 1,            // multiplier
    perPickup: 2,
    perSecond: 2,
    boss: 1500,
    levelBonus: 120,
  },

  economy: {
    ctxRegenPickups: true, // pickups restore context
  },

  performance: {
    maxParticles: 700,
    lowFpsParticles: 320,
    lowFpsThreshold: 42,   // fps below which we reduce effects
  },

  palette: {
    cyan:   '#00e5ff',
    blue:   '#3f7bff',
    magenta:'#ff2bd6',
    orange: '#ff9a1f',
    red:    '#ff3b52',
    purple: '#a55bff',
    green:  '#39ff88',
    yellow: '#ffd24a',
    white:  '#e8f6ff',
    bg:     '#04060e',
    grid:   'rgba(38,86,140,0.20)',
  },

  keys: {
    pause: ['Escape', 'KeyP'],
    cards: ['Digit1', 'Digit2', 'Digit3'],
  },

  storage: { bestKey: 'aas_best_v1', settingsKey: 'aas_settings_v1', historyKey: 'aas_history_v1', metaKey: 'aas_meta_v1' },
};
