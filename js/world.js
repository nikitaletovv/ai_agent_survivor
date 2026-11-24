/* ============================================================
   AI Agent Survivors — the digital world (Tron-inspired)
   Endless procedural map built from deterministic chunks:
   neon grid, glowing trunk roads, pseudo-3D data towers.
   ============================================================ */
'use strict';

const World = {
  chunkSize: 900,
  roadEvery: 1800,
  roadWidth: 170,
  chunks: new Map(),
  _collidersOut: [],
  ambient: [],          // global floating data motes
  ambientT: 0,

  init() { this.chunks.clear(); this.ambient = []; for (let i = 0; i < 90; i++) this.ambient.push(this._mote()); },

  _mote() {
    return {
      x: U.rand(-2000, 2000), y: U.rand(-2000, 2000),
      vx: U.rand(-6, 6), vy: U.rand(4, 22),
      s: U.rand(1, 2.4), a: U.rand(0.15, 0.5),
      c: Math.random() < 0.8 ? CFG.palette.cyan : CFG.palette.magenta,
    };
  },

  key(cx, cy) { return cx + ':' + cy; },

  getChunk(cx, cy) {
    const k = this.key(cx, cy);
    let ch = this.chunks.get(k);
    if (!ch) {
      ch = this.genChunk(cx, cy);
      this.chunks.set(k, ch);
      // evict far chunks
      if (this.chunks.size > 60) {
        const pcx = Math.floor(Game.camX / this.chunkSize);
        const pcy = Math.floor(Game.camY / this.chunkSize);
        for (const [kk, v] of this.chunks) {
          const parts = kk.split(':');
          if (Math.abs(parts[0] - pcx) > 4 || Math.abs(parts[1] - pcy) > 4) this.chunks.delete(kk);
        }
      }
    }
    return ch;
  },

  genChunk(cx, cy) {
    const rng = U.mulberry32(U.hash2(cx, cy));
    const S = this.chunkSize;
    const x0 = cx * S, y0 = cy * S;
    const accents = [CFG.palette.cyan, CFG.palette.magenta, CFG.palette.orange, CFG.palette.blue, CFG.palette.purple];
    const ch = {
      cx, cy, x0, y0,
      accent: accents[(rng() * accents.length) | 0],
      buildings: [],     // {x,y,w,h,accent} — единственные «твёрдые» объекты
    };

    // buildings — avoid the trunk road corridors; fully inside the chunk so
    // neighbouring chunks can never overlap them; spaced from each other
    const onRoad = (ax, ay) => {
      const mx = ((ax % this.roadEvery) + this.roadEvery) % this.roadEvery;
      const my = ((ay % this.roadEvery) + this.roadEvery) % this.roadEvery;
      const w = this.roadWidth + 44;
      return mx < w || my < w;
    };

    const nBuild = 2 + (rng() * 3) | 0;
    const M = 60; // margin: building footprints never cross chunk borders
    for (let i = 0; i < nBuild; i++) {
      const w = 90 + rng() * 180, h = 90 + rng() * 180;
      const x = x0 + M + rng() * Math.max(1, S - 2 * M - w);
      const y = y0 + M + rng() * Math.max(1, S - 2 * M - h);
      if (onRoad(x + w / 2, y) || onRoad(x, y + h / 2)) continue;
      let clash = false;
      for (const b of ch.buildings) {
        if (x < b.x + b.w + 44 && x + w + 44 > b.x && y < b.y + b.h + 44 && y + h + 44 > b.y) { clash = true; break; }
      }
      if (clash) continue;
      ch.buildings.push({ x, y, w, h, tall: 24 + rng() * 90, accent: ch.accent });
    }
    return ch;
  },

  /** All building colliders near a point (reuses one buffer). */
  collidersNear(x, y, r) {
    const out = this._collidersOut;
    out.length = 0;
    const S = this.chunkSize;
    const c0x = Math.floor((x - r - 300) / S), c1x = Math.floor((x + r + 300) / S);
    const c0y = Math.floor((y - r - 300) / S), c1y = Math.floor((y + r + 300) / S);
    for (let cx = c0x; cx <= c1x; cx++)
      for (let cy = c0y; cy <= c1y; cy++) {
        const ch = this.getChunk(cx, cy);
        for (const b of ch.buildings) out.push(b);
      }
    return out;
  },
  /** Push a circular body out of nearby buildings. */
  resolveCollision(body) {
    const near = this.collidersNear(body.x, body.y, body.r + 260);
    for (const b of near) {
      const res = {};
      res.x = b.x; res.y = b.y; res.w = b.w; res.h = b.h; res.px = body.x; res.py = body.y;
      if (U.circleRectPush(body.x, body.y, body.r, res)) {
        // reflect: kill the velocity component into the wall
        const nx = res.px - body.x, ny = res.py - body.y;
        body.x = res.px; body.y = res.py;
        if (body.vx !== undefined) {
          const dot = body.vx * nx + body.vy * ny;
          if (dot < 0) { body.vx -= nx * dot / (nx * nx + ny * ny || 1); body.vy -= ny * dot / (nx * nx + ny * ny || 1); }
        }
      }
    }
  },

  update(dt, camX, camY) {
    this.ambientT += dt;
    for (const m of this.ambient) {
      m.x += m.vx * dt; m.y += m.vy * dt;
    }
    // recycle motes that wandered away
    if ((this.ambientT | 0) % 2 === 0) {
      for (const m of this.ambient) {
        if (Math.abs(m.x - camX) > 2200) m.x = camX + U.rand(-2000, 2000);
        if (Math.abs(m.y - camY) > 2200) m.y = camY + U.rand(-2000, 2000);
      }
    }
  },

  /* ================= RENDER ================= */
  draw(ctx, camX, camY, vw, vh, t) {
    const x0 = camX - vw / 2, y0 = camY - vh / 2;
    const x1 = camX + vw / 2, y1 = camY + vh / 2;

    // deep background
    ctx.fillStyle = CFG.palette.bg;
    ctx.fillRect(x0, y0, vw, vh);

    // subtle vertical ambience
    const grad = ctx.createRadialGradient(camX, camY, 0, camX, camY, Math.max(vw, vh) * 0.75);
    grad.addColorStop(0, 'rgba(20,60,110,0.10)');
    grad.addColorStop(1, 'rgba(4,6,14,0)');
    ctx.fillStyle = grad;
    ctx.fillRect(x0, y0, vw, vh);

    this._drawGrid(ctx, x0, y0, vw, vh, t);
    this._drawRoads(ctx, x0, y0, vw, vh, t);
    this._drawAmbient(ctx, camX, camY, vw, vh);
    this._drawChunks(ctx, x0, y0, vw, vh, t);
    this._drawMotes(ctx, camX, camY, vw, vh);
  },

  _drawGrid(ctx, x0, y0, vw, vh, t) {
    const step = 90;
    ctx.lineWidth = 1;
    ctx.strokeStyle = CFG.palette.grid;
    ctx.beginPath();
    const sx = Math.floor(x0 / step) * step, sy = Math.floor(y0 / step) * step;
    for (let x = sx; x <= x0 + vw; x += step) { ctx.moveTo(x, y0); ctx.lineTo(x, y0 + vh); }
    for (let y = sy; y <= y0 + vh; y += step) { ctx.moveTo(x0, y); ctx.lineTo(x0 + vw, y); }
    ctx.stroke();
  },

  _drawRoads(ctx, x0, y0, vw, vh, t) {
    ctx.save();
    this._drawBusBands(ctx, x0, y0, vw, vh, true);
    this._drawBusBands(ctx, x0, y0, vw, vh, false);
    this._drawBusHubs(ctx, x0, y0, vw, vh);
    ctx.restore();
  },

  /** Шина данных: широкое тёмное полотно с контактными кромками,
   *  двойной пунктирной магистралью и поперечными контактами.
   *  Полоса лежит от линии сетки: горизонтальные — вниз от ry,
   *  вертикальные — вправо от rx. Ровно та же зона, что в onBus(). */
  _drawBusBands(ctx, x0, y0, vw, vh, horiz) {
    const E = this.roadEvery, W = this.roadWidth;
    const x1 = x0 + vw, y1 = y0 + vh;
    const s0 = (horiz ? Math.floor(y0 / E) : Math.floor(x0 / E)) * E;
    const lim = (horiz ? y1 : x1) + E;
    for (let s = s0; s <= lim; s += E) {
      ctx.fillStyle = 'rgba(7,18,32,0.80)';
      if (horiz) ctx.fillRect(x0 - 10, s, vw + 20, W);
      else ctx.fillRect(s, y0 - 10, W, vh + 20);
      // яркие контактные кромки по обоим краям
      ctx.strokeStyle = 'rgba(0,225,255,0.70)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      if (horiz) {
        ctx.moveTo(x0 - 10, s + 1); ctx.lineTo(x1 + 10, s + 1);
        ctx.moveTo(x0 - 10, s + W - 1); ctx.lineTo(x1 + 10, s + W - 1);
      } else {
        ctx.moveTo(s + 1, y0 - 10); ctx.lineTo(s + 1, y1 + 10);
        ctx.moveTo(s + W - 1, y0 - 10); ctx.lineTo(s + W - 1, y1 + 10);
      }
      ctx.stroke();
      // двойная магистраль — статичный пунктир канала данных
      ctx.strokeStyle = 'rgba(90,235,255,0.45)';
      ctx.lineWidth = 2;
      ctx.setLineDash([26, 20]);
      ctx.beginPath();
      if (horiz) {
        ctx.moveTo(x0 - 10, s + W / 2 - 5); ctx.lineTo(x1 + 10, s + W / 2 - 5);
        ctx.moveTo(x0 - 10, s + W / 2 + 5); ctx.lineTo(x1 + 10, s + W / 2 + 5);
      } else {
        ctx.moveTo(s + W / 2 - 5, y0 - 10); ctx.lineTo(s + W / 2 - 5, y1 + 10);
        ctx.moveTo(s + W / 2 + 5, y0 - 10); ctx.lineTo(s + W / 2 + 5, y1 + 10);
      }
      ctx.stroke();
      ctx.setLineDash([]);
      // поперечные контакты (пины шины) каждые 120px — статичные
      ctx.strokeStyle = 'rgba(0,225,255,0.28)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      const p0 = (horiz ? Math.floor(x0 / 120) : Math.floor(y0 / 120)) * 120;
      const plim = (horiz ? x1 : y1) + 120;
      for (let p = p0; p <= plim; p += 120) {
        if (horiz) { ctx.moveTo(p, s + 4); ctx.lineTo(p, s + W - 4); }
        else { ctx.moveTo(s + 4, p); ctx.lineTo(s + W - 4, p); }
      }
      ctx.stroke();
    }
  },

  /** Узлы шины на пересечениях полос — яркие «хабы». */
  _drawBusHubs(ctx, x0, y0, vw, vh) {
    const E = this.roadEvery, W = this.roadWidth;
    const x1 = x0 + vw, y1 = y0 + vh;
    for (let rx = Math.floor(x0 / E) * E; rx <= x1 + E; rx += E)
      for (let ry = Math.floor(y0 / E) * E; ry <= y1 + E; ry += E) {
        const cx = rx + W / 2, cy = ry + W / 2;
        ctx.fillStyle = 'rgba(0,60,90,0.85)';
        ctx.fillRect(cx - 14, cy - 14, 28, 28);
        ctx.strokeStyle = 'rgba(120,245,255,0.85)';
        ctx.lineWidth = 2;
        ctx.strokeRect(cx - 14, cy - 14, 28, 28);
        ctx.fillStyle = 'rgba(160,250,255,0.9)';
        ctx.fillRect(cx - 4, cy - 4, 8, 8);
      }
  },

  _drawAmbient(ctx, camX, camY, vw, vh) {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (const m of this.ambient) {
      ctx.globalAlpha = m.a * (0.6 + 0.4 * Math.sin(this.ambientT * 2 + m.x));
      ctx.fillStyle = m.c;
      ctx.fillRect(m.x, m.y, m.s, m.s);
    }
    ctx.restore();
  },

  _drawMotes(ctx, camX, camY, vw, vh) {
    // nothing — reserved
  },

  /** Шина данных: зона ускорения строго совпадает с отрисованной полосой
   *  (шина лежит от линии сетки вниз/вправо), плюс 24px запаса. */
  onBus(x, y) {
    const E = this.roadEvery;
    const W = this.roadWidth + 24;
    const mx = ((x % E) + E) % E;
    const my = ((y % E) + E) % E;
    return mx < W || my < W;
  },

  /* buildings are the only solid structures: gather every visible one across
     chunks and depth-sort by foot y so nearer blocks always overlap farther */
  _drawChunks(ctx, x0, y0, vw, vh, t) {
    const S = this.chunkSize;
    const c0x = Math.floor(x0 / S) - 1, c1x = Math.floor((x0 + vw) / S) + 1;
    const c0y = Math.floor(y0 / S) - 1, c1y = Math.floor((y0 + vh) / S) + 1;
    if (!this._sortBuf) this._sortBuf = [];
    const sort = this._sortBuf;
    sort.length = 0;
    for (let cx = c0x; cx <= c1x; cx++)
      for (let cy = c0y; cy <= c1y; cy++) {
        const ch = this.getChunk(cx, cy);
        for (const b of ch.buildings) sort.push(b);
      }
    sort.sort((a, b) => (a.y + a.h) - (b.y + b.h));
    for (const b of sort) this._drawBuilding(ctx, b, t);
  },

  _drawBuilding(ctx, b, t) {
    const lift = b.tall;
    // ground shadow
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.fillRect(b.x + 6, b.y + 6, b.w, b.h);
    // side faces (extruded toward screen-down)
    ctx.fillStyle = '#071626';
    ctx.fillRect(b.x, b.y + lift * 0.28, b.w, b.h - lift * 0.28 + 6);
    // front face lighter
    ctx.fillStyle = '#0a1d30';
    ctx.fillRect(b.x, b.y + lift, b.w, Math.max(8, b.h - lift));
    // top face
    ctx.fillStyle = '#0e2740';
    ctx.fillRect(b.x, b.y, b.w, lift + 4);
    // neon edges
    ctx.strokeStyle = b.accent;
    ctx.lineWidth = 2;
    ctx.shadowColor = b.accent;
    ctx.shadowBlur = 10;
    ctx.strokeRect(b.x, b.y, b.w, lift + 4);
    ctx.strokeRect(b.x, b.y + lift, b.w, Math.max(8, b.h - lift));
    ctx.shadowBlur = 0;
    // стоечные рейки: горизонтальные щели + мигающие индикаторы
    const rows = Math.max(1, Math.floor((b.h - lift) / 18));
    const cols = Math.max(1, Math.floor(b.w / 34));
    for (let r = 0; r < rows; r++) {
      ctx.fillStyle = 'rgba(6,16,28,0.95)';
      ctx.fillRect(b.x + 6, b.y + lift + 6 + r * 18, b.w - 12, 6);
      for (let c = 0; c < cols; c++) {
        const seedv = U.hash2((b.x + c * 34) | 0, (b.y + r * 18 + lift) | 0);
        if (seedv % 7 < 3) {
          const flick = ((seedv >> 3) % 5) === (Math.floor(t * 1.2) % 5);
          ctx.fillStyle = flick ? 'rgba(120,255,170,0.9)' : 'rgba(40,200,140,0.4)';
          ctx.fillRect(b.x + 12 + c * 34, b.y + lift + 7 + r * 18, 5, 4);
        }
      }
    }
    // rooftop beacon
    const bl = 0.5 + 0.5 * Math.sin(t * 3 + b.x * 0.01);
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = bl;
    ctx.fillStyle = b.accent;
    ctx.beginPath(); ctx.arc(b.x + b.w / 2, b.y + 2, 3, 0, U.TAU); ctx.fill();
    ctx.restore();
  },
};
