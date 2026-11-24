/* ============================================================
   AI Agent Survivors — math / helpers
   ============================================================ */
'use strict';

const U = {
  TAU: Math.PI * 2,

  clamp(v, a, b) { return v < a ? a : (v > b ? b : v); },
  lerp(a, b, t) { return a + (b - a) * t; },

  rand(a, b) { return a + Math.random() * (b - a); },
  randi(a, b) { return Math.floor(a + Math.random() * (b - a + 1)); },
  choice(arr) { return arr[(Math.random() * arr.length) | 0]; },

  dist(ax, ay, bx, by) { const dx = ax - bx, dy = ay - by; return Math.hypot(dx, dy); },
  dist2(ax, ay, bx, by) { const dx = ax - bx, dy = ay - by; return dx * dx + dy * dy; },

  angle(ax, ay, bx, by) { return Math.atan2(by - ay, bx - ax); },

  /** Weighted pick from [{weight, ...}] */
  weighted(items) {
    let total = 0;
    for (const it of items) total += it.weight;
    let r = Math.random() * total;
    for (const it of items) { r -= it.weight; if (r <= 0) return it; }
    return items[items.length - 1];
  },

  /** Deterministic RNG (mulberry32) */
  mulberry32(seed) {
    let a = seed >>> 0;
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  },

  hash2(x, y) {
    let h = (x * 374761393 + y * 668265263) | 0;
    h = (h ^ (h >>> 13)) | 0;
    h = Math.imul(h, 1274126177);
    return (h ^ (h >>> 16)) >>> 0;
  },

  fmtTime(sec) {
    sec = Math.max(0, Math.floor(sec));
    const m = Math.floor(sec / 60), s = sec % 60;
    return (m < 10 ? '0' : '') + m + ':' + (s < 10 ? '0' : '') + s;
  },

  fmtNum(n) {
    if (n >= 1e6) return (n / 1e6).toFixed(1) + 'M';
    if (n >= 1e4) return Math.round(n / 1e3) + 'K';
    return Math.round(n).toLocaleString('ru-RU');
  },

  /** Object pool */
  Pool: class {
    constructor(factory) {
      this.factory = factory;
      this.items = [];
      this.active = [];
    }
    get() {
      const it = this.items.pop() || this.factory();
      it.dead = false;
      this.active.push(it);
      return it;
    }
    release(it) { this.active = this.active.filter(a => a !== it); this.items.push(it); }
    sweep() {
      let w = 0;
      for (let i = 0; i < this.active.length; i++) {
        const it = this.active[i];
        if (!it.dead) this.active[w++] = it;
        else this.items.push(it);
      }
      this.active.length = w;
    }
  },

  /** Grid hash for fast proximity queries */
  SpatialGrid: class {
    constructor(cell) { this.cell = cell; this.map = new Map(); }
    clear() { this.map.clear(); }
    _key(cx, cy) { return cx * 100000 + cy; }
    insert(obj, x, y) {
      const c = this.cell;
      const k = this._key(Math.floor(x / c), Math.floor(y / c));
      let arr = this.map.get(k);
      if (!arr) { arr = []; this.map.set(k, arr); }
      arr.push(obj);
    }
    query(x, y, r, out) {
      out.length = 0;
      const c = this.cell;
      const x0 = Math.floor((x - r) / c), x1 = Math.floor((x + r) / c);
      const y0 = Math.floor((y - r) / c), y1 = Math.floor((y + r) / c);
      for (let cx = x0; cx <= x1; cx++)
        for (let cy = y0; cy <= y1; cy++) {
          const arr = this.map.get(this._key(cx, cy));
          if (arr) for (let i = 0; i < arr.length; i++) out.push(arr[i]);
        }
      return out;
    }
  },

  /** Push a circle out of an axis-aligned rect (returns true if pushed) */
  circleRectPush(px, py, r, rect) {
    const rx = rect.x, ry = rect.y, rw = rect.w, rh = rect.h;
    const cx = U.clamp(px, rx, rx + rw);
    const cy = U.clamp(py, ry, ry + rh);
    let dx = px - cx, dy = py - cy;
    const d2 = dx * dx + dy * dy;
    if (d2 > r * r) return false;
    if (d2 === 0) { // center inside rect: push along nearest face
      const left = px - rx, right = rx + rw - px, top = py - ry, bot = ry + rh - py;
      const m = Math.min(left, right, top, bot);
      if (m === left) px = rx - r; else if (m === right) px = rx + rw + r;
      else if (m === top) py = ry - r; else py = ry + rh + r;
      rect.px = px; rect.py = py;
      return true;
    }
    const d = Math.sqrt(d2);
    px = cx + (dx / d) * r;
    py = cy + (dy / d) * r;
    rect.px = px; rect.py = py;
    return true;
  },
};
