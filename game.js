(() => {
'use strict';

// ============================================================
// Constants
// ============================================================
const GRID = { COLS: 36, ROWS: 19, CELL: 40 };
const HUD_H = 80;
const W = GRID.COLS * GRID.CELL;       // 1440
const H = GRID.ROWS * GRID.CELL + HUD_H; // 840

const CELL = {
  EMPTY: 0,
  NEST: 1,
  CAKE: 2,
  TOWER: 3,
};

const NEST_CELLS = [[1,0],[2,0],[1,1],[2,1]];
const NEST_SPAWN = { gx: 1.5, gy: 0.5 };

const CAKE_POSITIONS = [
  [30, 15], [31, 15], [32, 15], [33, 15],
  [30, 16], [31, 16], [32, 16], [33, 16],
];

const COLORS = {
  gridLine: 'rgba(148, 163, 220, 0.05)',
  gridEven: '#171a30',
  gridOdd: '#181b34',
  nestRing: '#5a3c20',
  nestPit: '#1a0f08',
  cakeBase: '#f4c2c2',
  cakeTop: '#fff5f0',
  cakeShadow: '#b08080',
  cakeCherry: '#d94a4a',
  antBody: '#2a1a0f',
  antAccent: '#6b3f1f',
  pathPreview: 'rgba(255, 255, 255, 0.06)',
  rangeOk: 'rgba(94, 230, 168, 0.18)',
  rangeOkBorder: 'rgba(94, 230, 168, 0.6)',
  rangeBad: 'rgba(255, 107, 107, 0.18)',
  rangeBadBorder: 'rgba(255, 107, 107, 0.6)',
};

const TOWER_DEFS = {
  basic: {
    key: 'basic', name: '기본 타워', icon: '◆', color: '#7aa2ff',
    cost: 50, damage: 8, range: 2.6, fireRate: 1.4, projSpeed: 620,
    desc: '균형 잡힌 기본 공격.', path: 'base', level: 1,
  },
  laser2: {
    key: 'laser2', name: '레이저 Lv.2', icon: '⚡', color: '#ff7aa0',
    cost: 100, damage: 4, range: 3.0, fireRate: 6.0,
    path: 'laser', beam: true, level: 2,
    desc: '빠른 연사 레이저 빔.'
  },
  missile2: {
    key: 'missile2', name: '미사일 Lv.2', icon: '🚀', color: '#ffa452',
    cost: 100, damage: 18, range: 3.4, fireRate: 0.75, projSpeed: 380,
    splash: 0.9, path: 'missile', level: 2,
    desc: '폭발로 여러 개미 타격.'
  },
  dual2: {
    key: 'dual2', name: '2중탄 Lv.2', icon: '✦', color: '#5ee6a8',
    cost: 100, damage: 7, shots: 2, range: 2.8, fireRate: 1.8, projSpeed: 640,
    path: 'dual', level: 2,
    desc: '동시에 두 발씩 발사.'
  },
  laser3: {
    key: 'laser3', name: '플라즈마 Lv.3', icon: '⚡', color: '#ff4080',
    cost: 200, damage: 9, range: 3.4, fireRate: 7.5,
    path: 'laser', beam: true, chain: 2, level: 3,
    desc: '전격이 인접한 적 2마리에게 전이.'
  },
  missile3: {
    key: 'missile3', name: '핵탄두 Lv.3', icon: '💥', color: '#ff7a2a',
    cost: 200, damage: 45, range: 3.8, fireRate: 0.5, projSpeed: 340,
    splash: 1.7, path: 'missile', level: 3,
    desc: '거대한 폭발 반경.'
  },
  dual3: {
    key: 'dual3', name: '트리플 Lv.3', icon: '✧', color: '#3eb88a',
    cost: 200, damage: 10, shots: 3, range: 3.2, fireRate: 2.2, projSpeed: 680,
    path: 'dual', level: 3,
    desc: '세 발 동시 발사.'
  },
};

// Upgrade map: which defs a tower can evolve into
const UPGRADES = {
  basic:   ['laser2', 'missile2', 'dual2'],
  laser2:  ['laser3'],
  missile2:['missile3'],
  dual2:   ['dual3'],
  laser3:  [],
  missile3:[],
  dual3:   [],
};

const ANT_KINDS = {
  basic:    { hp: 14,  speed: 55, reward: 5,   r: 7,  color: '#2a1a0f', perWaveHp: 0.07 },
  fast:     { hp:  9,  speed: 92, reward: 6,   r: 6,  color: '#3a2014', perWaveHp: 0.03 },
  tank:     { hp: 46,  speed: 36, reward: 14,  r: 10, color: '#1a0a05', perWaveHp: 0.02 },
  elite:    { hp: 90,  speed: 48, reward: 28,  r: 9,  color: '#4d1f0a', perWaveHp: 0.02 },
  bossMini: { hp: 320, speed: 30, reward: 90,  r: 15, color: '#2d0a2a', perWaveHp: 0, isBoss: true, tier: 'mini' },
  bossBig:  { hp: 780, speed: 22, reward: 260, r: 20, color: '#3d0810', perWaveHp: 0, isBoss: true, tier: 'big' },
};

// Wave composition: list of { kind, count, gap }
const WAVES = [
  // 1-5: intro
  [{kind:'basic', count:6,  gap:1.1}],
  [{kind:'basic', count:8,  gap:1.0}, {kind:'fast', count:2, gap:0.7}],
  [{kind:'basic', count:10, gap:0.9}, {kind:'fast', count:4, gap:0.6}],
  [{kind:'basic', count:12, gap:0.8}, {kind:'fast', count:5, gap:0.55}],
  [{kind:'basic', count:10, gap:0.7}, {kind:'fast', count:6, gap:0.5}, {kind:'tank', count:1, gap:1.2}],
  // 6-10: tanks enter the mix
  [{kind:'basic', count:12, gap:0.6}, {kind:'fast', count:8,  gap:0.45}, {kind:'tank', count:2, gap:1.1}],
  [{kind:'fast',  count:14, gap:0.4}, {kind:'tank', count:3,  gap:1.0}],
  [{kind:'basic', count:14, gap:0.55},{kind:'tank', count:5,  gap:0.9}],
  [{kind:'basic', count:16, gap:0.5}, {kind:'fast', count:10, gap:0.4}, {kind:'tank', count:4, gap:0.9}],
  [{kind:'fast',  count:18, gap:0.35},{kind:'tank', count:5,  gap:0.9}, {kind:'elite', count:1, gap:1.3}, {kind:'bossMini', count:1, gap:3.0}],
  // 11-15: elites appear
  [{kind:'basic', count:18, gap:0.4}, {kind:'fast', count:10, gap:0.35},{kind:'tank', count:6, gap:0.8}],
  [{kind:'tank',  count:10, gap:0.7}, {kind:'fast', count:12, gap:0.35}],
  [{kind:'basic', count:22, gap:0.35},{kind:'tank', count:6,  gap:0.7}, {kind:'elite', count:2, gap:1.2}],
  [{kind:'fast',  count:22, gap:0.3}, {kind:'elite',count:3,  gap:1.0}],
  [{kind:'basic', count:20, gap:0.35},{kind:'tank', count:10, gap:0.6}, {kind:'elite', count:3, gap:1.0}, {kind:'bossMini', count:2, gap:2.5}],
  // 16-20: pressure builds
  [{kind:'tank',  count:14, gap:0.55},{kind:'fast', count:14, gap:0.3}],
  [{kind:'basic', count:26, gap:0.3}, {kind:'tank', count:8,  gap:0.55},{kind:'elite', count:4, gap:1.0}],
  [{kind:'fast',  count:30, gap:0.25},{kind:'tank', count:10, gap:0.5}, {kind:'elite', count:4, gap:0.9}],
  [{kind:'tank',  count:16, gap:0.5}, {kind:'elite',count:6,  gap:0.9}],
  [{kind:'basic', count:30, gap:0.25},{kind:'fast', count:20, gap:0.25},{kind:'elite', count:6, gap:0.8}, {kind:'bossMini', count:3, gap:2.0}],
  // 21-25: heavy pressure
  [{kind:'fast',  count:36, gap:0.22},{kind:'tank', count:12, gap:0.5}, {kind:'elite', count:6, gap:0.8}],
  [{kind:'tank',  count:20, gap:0.45},{kind:'elite',count:8,  gap:0.8}],
  [{kind:'basic', count:36, gap:0.2}, {kind:'tank', count:14, gap:0.45},{kind:'elite', count:8, gap:0.75}],
  [{kind:'fast',  count:40, gap:0.2}, {kind:'tank', count:16, gap:0.4}, {kind:'elite', count:9, gap:0.7}],
  [{kind:'basic', count:30, gap:0.2}, {kind:'fast', count:25, gap:0.22},{kind:'tank', count:15, gap:0.4},{kind:'elite', count:8, gap:0.7}, {kind:'bossBig', count:1, gap:3.0}, {kind:'bossMini', count:1, gap:2.0}],
  // 26-30: swarm
  [{kind:'tank',  count:25, gap:0.4}, {kind:'elite',count:12, gap:0.7}],
  [{kind:'fast',  count:50, gap:0.16},{kind:'tank', count:18, gap:0.4}, {kind:'elite', count:12, gap:0.65}],
  [{kind:'basic', count:45, gap:0.15},{kind:'tank', count:20, gap:0.4}, {kind:'elite', count:14, gap:0.65}],
  [{kind:'fast',  count:55, gap:0.14},{kind:'tank', count:22, gap:0.38},{kind:'elite', count:14, gap:0.65}],
  [{kind:'tank',  count:30, gap:0.35},{kind:'elite',count:18, gap:0.6}, {kind:'bossBig', count:2, gap:2.5}],
  // 31-35: brutal
  [{kind:'basic', count:60, gap:0.12},{kind:'fast', count:40, gap:0.14},{kind:'elite', count:18, gap:0.6}],
  [{kind:'fast',  count:70, gap:0.12},{kind:'tank', count:28, gap:0.35},{kind:'elite', count:18, gap:0.6}],
  [{kind:'tank',  count:40, gap:0.3}, {kind:'elite',count:22, gap:0.55}],
  [{kind:'basic', count:70, gap:0.1}, {kind:'fast', count:50, gap:0.12},{kind:'elite', count:22, gap:0.55}],
  [{kind:'elite', count:30, gap:0.5}, {kind:'bossBig', count:3, gap:2.0}],
  // 36-40: final storm
  [{kind:'tank',  count:45, gap:0.28},{kind:'elite',count:28, gap:0.5}],
  [{kind:'fast',  count:90, gap:0.08},{kind:'elite',count:28, gap:0.5}],
  [{kind:'basic', count:80, gap:0.08},{kind:'fast', count:50, gap:0.1}, {kind:'tank', count:35, gap:0.25},{kind:'elite', count:28, gap:0.5}],
  [{kind:'elite', count:45, gap:0.45},{kind:'tank', count:40, gap:0.22}],
  [{kind:'basic', count:60, gap:0.08},{kind:'fast', count:60, gap:0.08},{kind:'tank', count:45, gap:0.22},{kind:'elite', count:40, gap:0.4}, {kind:'bossBig', count:5, gap:1.8}],
];

// ============================================================
// Utility
// ============================================================
const rand = (a, b) => a + Math.random() * (b - a);
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const dist2 = (ax, ay, bx, by) => { const dx=ax-bx, dy=ay-by; return dx*dx+dy*dy; };
const dist  = (ax, ay, bx, by) => Math.hypot(ax-bx, ay-by);
const lerp = (a, b, t) => a + (b - a) * t;
function lerpAngle(a, b, t) {
  let d = b - a;
  while (d > Math.PI) d -= 2 * Math.PI;
  while (d < -Math.PI) d += 2 * Math.PI;
  return a + d * t;
}

function gridToWorld(gx, gy) {
  return { x: gx * GRID.CELL + GRID.CELL / 2, y: gy * GRID.CELL + GRID.CELL / 2 + HUD_H };
}
function worldToGrid(x, y) {
  return { gx: Math.floor(x / GRID.CELL), gy: Math.floor((y - HUD_H) / GRID.CELL) };
}
function cellKey(gx, gy) { return gx + ',' + gy; }
function inBounds(gx, gy) {
  return gx >= 0 && gy >= 0 && gx < GRID.COLS && gy < GRID.ROWS;
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

// ============================================================
// A* pathfinding on the grid
// ============================================================
// A simple binary min-heap for A*.
class MinHeap {
  constructor() { this.a = []; }
  push(node) {
    this.a.push(node);
    let i = this.a.length - 1;
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (this.a[p].f <= this.a[i].f) break;
      [this.a[p], this.a[i]] = [this.a[i], this.a[p]];
      i = p;
    }
  }
  pop() {
    const top = this.a[0];
    const last = this.a.pop();
    if (this.a.length > 0) {
      this.a[0] = last;
      let i = 0;
      const n = this.a.length;
      while (true) {
        const l = 2*i+1, r = 2*i+2;
        let s = i;
        if (l < n && this.a[l].f < this.a[s].f) s = l;
        if (r < n && this.a[r].f < this.a[s].f) s = r;
        if (s === i) break;
        [this.a[s], this.a[i]] = [this.a[i], this.a[s]];
        i = s;
      }
    }
    return top;
  }
  get size() { return this.a.length; }
}

function findPath(grid, sx, sy, tx, ty) {
  // grid: 2D array of CELL.*; treat TOWER as blocked; everything else walkable.
  if (!inBounds(sx, sy) || !inBounds(tx, ty)) return null;
  if (grid[ty][tx] === CELL.TOWER) return null;

  const open = new MinHeap();
  const gScore = new Map();
  const parent = new Map();
  const startKey = cellKey(sx, sy);
  gScore.set(startKey, 0);
  open.push({ x: sx, y: sy, g: 0, f: Math.abs(sx-tx) + Math.abs(sy-ty) });

  const closed = new Set();
  const dirs = [[1,0],[-1,0],[0,1],[0,-1]];

  while (open.size > 0) {
    const cur = open.pop();
    const ck = cellKey(cur.x, cur.y);
    if (closed.has(ck)) continue;
    closed.add(ck);

    if (cur.x === tx && cur.y === ty) {
      // reconstruct
      const path = [];
      let k = ck;
      while (k) {
        const [px, py] = k.split(',').map(Number);
        path.push({ gx: px, gy: py });
        k = parent.get(k);
      }
      path.reverse();
      return path;
    }

    for (const [dx, dy] of dirs) {
      const nx = cur.x + dx, ny = cur.y + dy;
      if (!inBounds(nx, ny)) continue;
      if (grid[ny][nx] === CELL.TOWER) continue;
      const nk = cellKey(nx, ny);
      if (closed.has(nk)) continue;
      const tentative = cur.g + 1;
      if (tentative < (gScore.get(nk) ?? Infinity)) {
        gScore.set(nk, tentative);
        parent.set(nk, ck);
        const h = Math.abs(nx - tx) + Math.abs(ny - ty);
        open.push({ x: nx, y: ny, g: tentative, f: tentative + h });
      }
    }
  }
  return null;
}

// ============================================================
// Entities
// ============================================================
class Ant {
  constructor(game, kind, waveHpMul) {
    this.game = game;
    this.kind = kind;
    const k = ANT_KINDS[kind];
    const extra = 1 + (game.wave - 1) * (k.perWaveHp || 0);
    this.maxHp = Math.round(k.hp * waveHpMul * extra);
    this.hp = this.maxHp;
    this.speed = k.speed * (1 + (game.wave - 1) * 0.01);
    this.reward = k.reward;
    this.r = k.r;
    this.color = k.color;
    this.isBoss = !!k.isBoss;
    this.bossTier = k.tier || null;
    // spawn near nest center with small randomness
    const sp = gridToWorld(NEST_SPAWN.gx, NEST_SPAWN.gy);
    this.x = sp.x + rand(-8, 8);
    this.y = sp.y + rand(-8, 8);
    this.state = 'seeking';  // seeking -> returning
    this.targetCake = null;  // Cake instance
    this.carrying = null;    // Cake instance while carrying
    this.path = null;
    this.pathIdx = 0;
    this.pathDirty = true;
    this.legPhase = Math.random() * Math.PI * 2;
    this.dead = false;
    this.slow = 0;           // time remaining under slow effect
    this.flashHit = 0;
  }

  pickTarget() {
    // pick nearest available cake that no other ant has yet claimed
    const avail = this.game.cakes.filter(c => !c.taken && !c.claimed);
    const pool = avail.length ? avail : this.game.cakes.filter(c => !c.taken);
    if (pool.length === 0) return null;
    let best = null, bd = Infinity;
    for (const c of pool) {
      const d = dist2(this.x, this.y, c.wx, c.wy);
      if (d < bd) { bd = d; best = c; }
    }
    return best;
  }

  ensurePath() {
    if (!this.pathDirty && this.path) return;
    const sg = worldToGrid(this.x, this.y);
    sg.gx = clamp(sg.gx, 0, GRID.COLS-1);
    sg.gy = clamp(sg.gy, 0, GRID.ROWS-1);

    if (this.state === 'seeking') {
      if (!this.targetCake || this.targetCake.taken) {
        if (this.targetCake) this.targetCake.claimed = false;
        this.targetCake = this.pickTarget();
        if (this.targetCake) this.targetCake.claimed = true;
      }
      if (!this.targetCake) { this.path = null; return; }
      const p = findPath(this.game.grid, sg.gx, sg.gy, this.targetCake.gx, this.targetCake.gy);
      this.path = p; this.pathIdx = 1;
    } else {
      // returning to nest - pick nearest nest cell
      let best = null, bd = Infinity;
      for (const [nx, ny] of NEST_CELLS) {
        const d = Math.abs(sg.gx - nx) + Math.abs(sg.gy - ny);
        if (d < bd) { bd = d; best = [nx, ny]; }
      }
      const p = findPath(this.game.grid, sg.gx, sg.gy, best[0], best[1]);
      this.path = p; this.pathIdx = 1;
    }
    this.pathDirty = false;
  }

  update(dt) {
    if (this.dead) return;
    this.ensurePath();
    if (!this.path || this.pathIdx >= this.path.length) {
      // no path (e.g., blocked) - still try to wait
      this.pathDirty = true;
      return;
    }
    this.legPhase += dt * 14;

    // move toward next waypoint
    const wp = this.path[this.pathIdx];
    const tgt = gridToWorld(wp.gx, wp.gy);
    const dx = tgt.x - this.x, dy = tgt.y - this.y;
    const d = Math.hypot(dx, dy);
    let spd = this.speed;
    if (this.carrying) spd *= 0.75;
    if (this.slow > 0) { spd *= 0.55; this.slow -= dt; }
    const step = spd * dt;

    if (d <= step) {
      this.x = tgt.x; this.y = tgt.y;
      this.pathIdx++;
      if (this.pathIdx >= this.path.length) this.onArrive();
    } else {
      this.x += dx / d * step;
      this.y += dy / d * step;
    }

    this.flashHit = Math.max(0, this.flashHit - dt * 6);
  }

  onArrive() {
    if (this.state === 'seeking') {
      // pick up cake if still available
      if (this.targetCake && !this.targetCake.taken) {
        this.targetCake.taken = true;
        this.targetCake.claimed = false;
        this.carrying = this.targetCake;
        this.state = 'returning';
        this.pathDirty = true;
      } else {
        // cake already taken; pick another
        this.targetCake = null;
        this.pathDirty = true;
      }
    } else {
      // reached nest with cake
      if (this.carrying) {
        this.carrying.lost = true;
        this.game.onCakeLost();
      }
      this.dead = true;
      this.game.removeAnts.push(this);
    }
  }

  damage(amount, game) {
    if (this.dead) return;
    this.hp -= amount;
    this.flashHit = 1;
    game.spawnHitParticles(this.x, this.y);
    if (this.hp <= 0) {
      this.dead = true;
      game.onAntKilled(this);
    }
  }

  draw(ctx) {
    if (this.dead) return;

    // boss aura (world coords, before body)
    if (this.isBoss) {
      const pulse = 0.7 + Math.sin(performance.now() / 220 + this.legPhase) * 0.3;
      const auraCol = this.bossTier === 'big' ? '#ff3838' : '#d040b0';
      ctx.save();
      ctx.globalAlpha = 0.22 * pulse;
      ctx.fillStyle = auraCol;
      ctx.beginPath(); ctx.arc(this.x, this.y, this.r * 1.9, 0, Math.PI*2); ctx.fill();
      ctx.globalAlpha = 0.5 * pulse;
      ctx.strokeStyle = auraCol;
      ctx.lineWidth = 2;
      ctx.shadowColor = auraCol;
      ctx.shadowBlur = 12;
      ctx.beginPath(); ctx.arc(this.x, this.y, this.r * 1.55, 0, Math.PI*2); ctx.stroke();
      ctx.restore();
    }

    // shadow
    ctx.save();
    ctx.globalAlpha = 0.35;
    ctx.fillStyle = '#000';
    ctx.beginPath();
    ctx.ellipse(this.x, this.y + this.r, this.r * 0.9, this.r * 0.35, 0, 0, Math.PI*2);
    ctx.fill();
    ctx.restore();

    // direction from path
    let angle = 0;
    if (this.path && this.pathIdx < this.path.length) {
      const wp = this.path[this.pathIdx];
      const tgt = gridToWorld(wp.gx, wp.gy);
      angle = Math.atan2(tgt.y - this.y, tgt.x - this.x);
    }

    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.rotate(angle);

    // legs
    ctx.strokeStyle = this.color;
    ctx.lineWidth = 1.2;
    ctx.lineCap = 'round';
    const legs = 3;
    for (let i = 0; i < legs; i++) {
      const t = (i - 1) * 3;
      const sway = Math.sin(this.legPhase + i * 1.2) * 3;
      ctx.beginPath();
      ctx.moveTo(t, 0);
      ctx.lineTo(t + 1, -this.r - 2 - sway);
      ctx.moveTo(t, 0);
      ctx.lineTo(t + 1,  this.r + 2 + sway);
      ctx.stroke();
    }

    // body (3 segments)
    ctx.fillStyle = this.flashHit > 0 ? '#ffcccc' : this.color;
    ctx.beginPath(); ctx.arc(-this.r * 0.9, 0, this.r * 0.55, 0, Math.PI*2); ctx.fill();
    ctx.beginPath(); ctx.arc(0, 0, this.r * 0.75, 0, Math.PI*2); ctx.fill();
    ctx.beginPath(); ctx.arc(this.r * 0.85, 0, this.r * 0.5, 0, Math.PI*2); ctx.fill();

    // head antenna
    ctx.strokeStyle = this.color;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(this.r * 0.9, -2); ctx.lineTo(this.r * 1.8, -5);
    ctx.moveTo(this.r * 0.9,  2); ctx.lineTo(this.r * 1.8,  5);
    ctx.stroke();

    // boss crown on head
    if (this.isBoss) {
      const hx = this.r * 0.85;
      const crownCol = this.bossTier === 'big' ? '#ffc857' : '#f080ff';
      const gemCol   = this.bossTier === 'big' ? '#ff4040' : '#ff60ff';
      const spikes = this.bossTier === 'big' ? 5 : 3;
      ctx.fillStyle = crownCol;
      ctx.strokeStyle = '#1a0f08';
      ctx.lineWidth = 0.8;
      for (let i = 0; i < spikes; i++) {
        const t = spikes === 1 ? 0 : (i / (spikes - 1));
        const ang = -Math.PI * 0.5 + (t - 0.5) * Math.PI * 0.7;
        const ox = hx + Math.cos(ang) * this.r * 0.55;
        const oy = Math.sin(ang) * this.r * 0.55;
        ctx.beginPath(); ctx.arc(ox, oy, 1.6, 0, Math.PI*2); ctx.fill(); ctx.stroke();
      }
      // gem on top of head
      ctx.fillStyle = gemCol;
      ctx.shadowColor = gemCol;
      ctx.shadowBlur = 8;
      ctx.beginPath(); ctx.arc(hx, 0, 2.6, 0, Math.PI*2); ctx.fill();
      ctx.shadowBlur = 0;
    }

    // carrying: draw mini cake on top
    if (this.carrying) {
      ctx.rotate(-angle);
      ctx.fillStyle = COLORS.cakeBase;
      roundRect(ctx, -6, -14, 12, 9, 2); ctx.fill();
      ctx.fillStyle = COLORS.cakeTop;
      roundRect(ctx, -6, -14, 12, 3, 1.5); ctx.fill();
      ctx.fillStyle = COLORS.cakeCherry;
      ctx.beginPath(); ctx.arc(0, -13, 1.4, 0, Math.PI*2); ctx.fill();
    }

    ctx.restore();

    // hp bar (larger on boss)
    if (this.hp < this.maxHp || this.isBoss) {
      const bw = this.isBoss ? (this.bossTier === 'big' ? 56 : 42) : 22;
      const bh = this.isBoss ? 5 : 3;
      ctx.fillStyle = 'rgba(0,0,0,0.55)';
      ctx.fillRect(this.x - bw/2 - 1, this.y - this.r - 10, bw + 2, bh + 2);
      const t = clamp(this.hp / this.maxHp, 0, 1);
      ctx.fillStyle = t > 0.5 ? '#5ee6a8' : t > 0.25 ? '#ffc857' : '#ff6b6b';
      ctx.fillRect(this.x - bw/2, this.y - this.r - 9, bw * t, bh);
    }
  }
}

class Projectile {
  constructor(x, y, target, damage, speed, opts = {}) {
    this.x = x; this.y = y;
    this.target = target;
    this.damage = damage;
    this.speed = speed;
    this.splash = opts.splash || 0;
    this.color = opts.color || '#fff';
    this.dead = false;
    this.trail = [];
    this.life = 3.0;
  }
  update(dt, game) {
    if (this.dead) return;
    this.life -= dt;
    if (this.life <= 0) { this.dead = true; return; }
    if (!this.target || this.target.dead) {
      // fizzle at current position if splash
      if (this.splash > 0) this.explode(game);
      this.dead = true; return;
    }
    const dx = this.target.x - this.x, dy = this.target.y - this.y;
    const d = Math.hypot(dx, dy);
    const step = this.speed * dt;
    if (d <= step) {
      if (this.splash > 0) {
        this.x = this.target.x; this.y = this.target.y;
        this.explode(game);
      } else {
        this.target.damage(this.damage, game);
      }
      this.dead = true;
    } else {
      this.trail.push({ x: this.x, y: this.y });
      if (this.trail.length > 6) this.trail.shift();
      this.x += dx / d * step;
      this.y += dy / d * step;
    }
  }
  explode(game) {
    const r = this.splash;
    const r2 = r * r;
    for (const ant of game.ants) {
      if (ant.dead) continue;
      const d2 = dist2(ant.x, ant.y, this.x, this.y);
      if (d2 <= r2) {
        const falloff = 1 - Math.sqrt(d2) / r * 0.4;
        ant.damage(this.damage * falloff, game);
      }
    }
    game.explode(this.x, this.y, r, this.color);
  }
  draw(ctx) {
    if (this.splash > 0) {
      // missile
      ctx.save();
      for (let i = 0; i < this.trail.length; i++) {
        const p = this.trail[i];
        ctx.globalAlpha = (i / this.trail.length) * 0.4;
        ctx.fillStyle = this.color;
        ctx.beginPath(); ctx.arc(p.x, p.y, 2 + i*0.3, 0, Math.PI*2); ctx.fill();
      }
      ctx.globalAlpha = 1;
      ctx.fillStyle = this.color;
      ctx.shadowColor = this.color;
      ctx.shadowBlur = 10;
      ctx.beginPath(); ctx.arc(this.x, this.y, 4, 0, Math.PI*2); ctx.fill();
      ctx.restore();
    } else {
      ctx.save();
      ctx.fillStyle = this.color;
      ctx.shadowColor = this.color;
      ctx.shadowBlur = 8;
      ctx.beginPath(); ctx.arc(this.x, this.y, 3, 0, Math.PI*2); ctx.fill();
      ctx.restore();
    }
  }
}

class Particle {
  constructor(x, y, opts = {}) {
    this.x = x; this.y = y;
    const a = opts.angle ?? rand(0, Math.PI*2);
    const s = opts.speed ?? rand(40, 160);
    this.vx = Math.cos(a) * s;
    this.vy = Math.sin(a) * s;
    this.life = opts.life ?? rand(0.3, 0.7);
    this.maxLife = this.life;
    this.color = opts.color ?? '#fff';
    this.size = opts.size ?? rand(1.5, 3);
    this.gravity = opts.gravity ?? 0;
    this.fade = opts.fade ?? 1;
  }
  update(dt) {
    this.life -= dt;
    this.x += this.vx * dt;
    this.y += this.vy * dt;
    this.vx *= 0.92; this.vy *= 0.92;
    this.vy += this.gravity * dt;
  }
  get dead() { return this.life <= 0; }
  draw(ctx) {
    const a = clamp(this.life / this.maxLife, 0, 1);
    ctx.save();
    ctx.globalAlpha = a * this.fade;
    ctx.fillStyle = this.color;
    ctx.beginPath(); ctx.arc(this.x, this.y, this.size, 0, Math.PI*2); ctx.fill();
    ctx.restore();
  }
}

class Tower {
  constructor(gx, gy, defKey) {
    this.gx = gx; this.gy = gy;
    const w = gridToWorld(gx, gy);
    this.x = w.x; this.y = w.y;
    this.defKey = defKey;
    this.def = TOWER_DEFS[defKey];
    this.totalInvested = this.def.cost;
    this.cooldown = 0;
    this.aim = 0;
    this.flash = 0;
    this.beamTarget = null;
    this.beamTimer = 0;
    this.chainSegments = [];
    this.placeAnim = 1;
  }
  get rangePx() { return this.def.range * GRID.CELL; }

  findTarget(game) {
    // prioritize returning ants (carrying cake), then lowest path distance
    let best = null, bestScore = -Infinity;
    const r2 = this.rangePx * this.rangePx;
    for (const a of game.ants) {
      if (a.dead) continue;
      const d2 = dist2(this.x, this.y, a.x, a.y);
      if (d2 > r2) continue;
      // score: carrying worth a lot, closer = better
      let score = -Math.sqrt(d2);
      if (a.carrying) score += 500;
      if (score > bestScore) { bestScore = score; best = a; }
    }
    return best;
  }

  update(dt, game) {
    this.cooldown = Math.max(0, this.cooldown - dt);
    this.flash = Math.max(0, this.flash - dt * 6);
    this.beamTimer = Math.max(0, this.beamTimer - dt);
    this.placeAnim = Math.max(0, this.placeAnim - dt * 3);

    const target = this.findTarget(game);
    if (!target) { this.beamTarget = null; this.chainSegments = []; return; }

    const desiredAim = Math.atan2(target.y - this.y, target.x - this.x);
    this.aim = lerpAngle(this.aim, desiredAim, clamp(dt * 14, 0, 1));

    if (this.cooldown <= 0) {
      this.fire(game, target);
      this.cooldown = 1 / this.def.fireRate;
      this.flash = 1;
    }
  }

  fire(game, target) {
    const d = this.def;
    if (d.beam) {
      target.damage(d.damage, game);
      this.beamTarget = target;
      this.beamTimer = 0.08;
      this.chainSegments = [];
      if (d.chain) {
        let last = target;
        const chained = new Set([target]);
        const cr2 = (1.8 * GRID.CELL) ** 2;
        for (let i = 0; i < d.chain; i++) {
          let next = null, nd = Infinity;
          for (const a of game.ants) {
            if (a.dead || chained.has(a)) continue;
            const dd = dist2(last.x, last.y, a.x, a.y);
            if (dd < cr2 && dd < nd) { next = a; nd = dd; }
          }
          if (!next) break;
          next.damage(d.damage * 0.7, game);
          this.chainSegments.push({ a: last, b: next });
          chained.add(next);
          last = next;
        }
      }
    } else if (d.splash) {
      game.projectiles.push(new Projectile(this.x, this.y, target, d.damage, d.projSpeed, {
        splash: d.splash * GRID.CELL, color: d.color,
      }));
    } else {
      const shots = d.shots || 1;
      for (let i = 0; i < shots; i++) {
        const off = shots === 1 ? 0 : ((i - (shots-1)/2) * 8);
        const nx = Math.cos(this.aim + Math.PI/2);
        const ny = Math.sin(this.aim + Math.PI/2);
        game.projectiles.push(new Projectile(
          this.x + nx * off, this.y + ny * off, target, d.damage, d.projSpeed, { color: d.color }
        ));
      }
    }
    // muzzle particles
    for (let i = 0; i < 4; i++) {
      game.particles.push(new Particle(
        this.x + Math.cos(this.aim) * 14,
        this.y + Math.sin(this.aim) * 14,
        { angle: this.aim + rand(-0.4, 0.4), speed: rand(60, 140), life: 0.2, color: d.color, size: rand(1, 2.5) }
      ));
    }
  }

  draw(ctx, selected, hovered) {
    const d = this.def;
    // range ring when selected/hovered
    if (selected || hovered) {
      ctx.save();
      ctx.strokeStyle = d.color + 'aa';
      ctx.fillStyle = d.color + '18';
      ctx.lineWidth = 1.5;
      ctx.setLineDash([4, 4]);
      ctx.beginPath(); ctx.arc(this.x, this.y, this.rangePx, 0, Math.PI*2);
      ctx.fill(); ctx.stroke();
      ctx.restore();
    }
    // base
    ctx.save();
    ctx.translate(this.x, this.y);
    const scale = 1 + this.placeAnim * 0.6;
    ctx.scale(scale, scale);

    // base plate
    ctx.shadowColor = 'rgba(0,0,0,0.5)';
    ctx.shadowBlur = 6;
    ctx.fillStyle = '#1b1f38';
    ctx.strokeStyle = d.color;
    ctx.lineWidth = 1.6;
    roundRect(ctx, -17, -17, 34, 34, 7);
    ctx.fill(); ctx.stroke();
    ctx.shadowBlur = 0;

    // level pips
    ctx.fillStyle = d.color;
    for (let i = 0; i < d.level; i++) {
      ctx.fillRect(-13 + i * 5, -14, 3, 3);
    }

    // turret rotation
    ctx.rotate(this.aim);
    if (this.flash > 0) {
      ctx.shadowColor = d.color;
      ctx.shadowBlur = 14 * this.flash;
    }
    ctx.fillStyle = d.color;

    if (d.path === 'laser') {
      roundRect(ctx, -7, -6, 22, 12, 3); ctx.fill();
      ctx.fillStyle = '#fff';
      ctx.fillRect(12, -2, 5, 4);
    } else if (d.path === 'missile') {
      roundRect(ctx, -8, -9, 20, 18, 3); ctx.fill();
      // tubes
      ctx.fillStyle = '#2a1f14';
      ctx.fillRect(8, -6, 6, 3);
      ctx.fillRect(8,  3, 6, 3);
    } else if (d.path === 'dual') {
      roundRect(ctx, -5, -9, 20, 5, 2); ctx.fill();
      roundRect(ctx, -5,  4, 20, 5, 2); ctx.fill();
    } else {
      // basic
      roundRect(ctx, -6, -5, 20, 10, 3); ctx.fill();
    }
    ctx.restore();

    // beam
    if (this.beamTarget && this.beamTimer > 0 && !this.beamTarget.dead) {
      ctx.save();
      const a = this.beamTimer / 0.08;
      ctx.globalAlpha = a;
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 3;
      ctx.shadowColor = d.color;
      ctx.shadowBlur = 14;
      ctx.beginPath();
      ctx.moveTo(this.x, this.y);
      ctx.lineTo(this.beamTarget.x, this.beamTarget.y);
      ctx.stroke();
      ctx.globalAlpha = a * 0.8;
      ctx.strokeStyle = d.color;
      ctx.lineWidth = 6;
      ctx.stroke();
      ctx.restore();
    }
    // chain
    for (const seg of this.chainSegments) {
      if (seg.a.dead || seg.b.dead) continue;
      ctx.save();
      ctx.globalAlpha = clamp(this.beamTimer / 0.08, 0, 1);
      ctx.strokeStyle = d.color;
      ctx.lineWidth = 2.5;
      ctx.shadowColor = d.color;
      ctx.shadowBlur = 10;
      ctx.beginPath();
      ctx.moveTo(seg.a.x, seg.a.y);
      // slight jitter
      const mx = (seg.a.x + seg.b.x)/2 + rand(-4, 4);
      const my = (seg.a.y + seg.b.y)/2 + rand(-4, 4);
      ctx.quadraticCurveTo(mx, my, seg.b.x, seg.b.y);
      ctx.stroke();
      ctx.restore();
    }
  }
}

class Cake {
  constructor(gx, gy, idx) {
    this.gx = gx; this.gy = gy;
    this.idx = idx;
    const w = gridToWorld(gx, gy);
    this.wx = w.x; this.wy = w.y;
    this.taken = false;   // an ant is carrying or has taken it
    this.claimed = false; // an ant has set it as target (soft reserve)
    this.lost = false;    // ant delivered to nest
    this.bobPhase = Math.random() * Math.PI * 2;
  }
}

// ============================================================
// Main Game
// ============================================================
class Game {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.reset();
    this.bind();
    this.last = performance.now();
    this.speed = 1;
    this.paused = false;
    this.started = false;
    requestAnimationFrame(this.tick);
  }

  reset() {
    this.grid = Array.from({length: GRID.ROWS}, () => Array(GRID.COLS).fill(CELL.EMPTY));
    for (const [x,y] of NEST_CELLS) this.grid[y][x] = CELL.NEST;
    this.cakes = CAKE_POSITIONS.map(([x,y], i) => {
      this.grid[y][x] = CELL.CAKE;
      return new Cake(x, y, i);
    });

    this.credits = 150;
    this.cakesLeft = this.cakes.length;
    this.towers = [];
    this.ants = [];
    this.projectiles = [];
    this.particles = [];
    this.removeAnts = [];
    this.selectedTower = null;
    this.placementCell = null;
    this.hoverCell = null;
    this.shake = 0;

    this.wave = 0;           // 0 before first wave starts
    this.waveMax = WAVES.length;
    this.waveState = 'prep'; // 'prep' | 'spawning' | 'clearing'
    this.waveTimer = 5;      // prep timer
    this.spawnQueue = [];
    this.spawnTimer = 0;
    this.waveHpMul = 1;

    this.stats = { kills: 0, cakesLost: 0, time: 0 };
    this.gameOver = false;
    this.victory = false;
  }

  bind() {
    const c = this.canvas;
    c.addEventListener('mousemove', this.onMouseMove);
    c.addEventListener('mousedown', this.onMouseDown);
    c.addEventListener('contextmenu', e => e.preventDefault());
    window.addEventListener('keydown', this.onKeyDown);

    // UI buttons
    document.getElementById('btn-pause').addEventListener('click', () => this.togglePause());
    document.getElementById('btn-speed').addEventListener('click', () => this.cycleSpeed());
    document.getElementById('btn-restart').addEventListener('click', () => this.restart());
    document.getElementById('overlay-restart').addEventListener('click', () => this.restart());
    document.getElementById('start-btn').addEventListener('click', () => this.startGame());
    document.getElementById('popup').addEventListener('mousedown', e => e.stopPropagation());
    document.getElementById('popup-close').addEventListener('click', () => {
      this.selectedTower = null;
      this.placementCell = null;
      this.hidePopup();
    });

    // Clicking anywhere outside the popup or canvas also closes it.
    document.addEventListener('mousedown', (e) => {
      const popup = document.getElementById('popup');
      if (popup.classList.contains('hidden')) return;
      if (popup.contains(e.target)) return;
      if (this.canvas.contains(e.target)) return;
      this.selectedTower = null;
      this.placementCell = null;
      this.hidePopup();
    });
  }

  startGame() {
    document.getElementById('start-screen').classList.add('hidden');
    this.started = true;
  }

  restart() {
    this.reset();
    this.hidePopup();
    document.getElementById('overlay').classList.add('hidden');
    this.updateHUD();
    this.started = true;
  }

  canvasPos(e) {
    const rect = this.canvas.getBoundingClientRect();
    const sx = this.canvas.width / rect.width;
    const sy = this.canvas.height / rect.height;
    return { x: (e.clientX - rect.left) * sx, y: (e.clientY - rect.top) * sy };
  }

  onMouseMove = (e) => {
    const p = this.canvasPos(e);
    const g = worldToGrid(p.x, p.y);
    this.hoverCell = (inBounds(g.gx, g.gy) && p.y > HUD_H) ? g : null;
  }

  onMouseDown = (e) => {
    if (!this.started || this.gameOver) return;
    if (e.button !== 0) return;
    const p = this.canvasPos(e);
    if (p.y < HUD_H) return; // don't intercept HUD clicks via canvas
    const g = worldToGrid(p.x, p.y);
    if (!inBounds(g.gx, g.gy)) return;

    const tower = this.towerAt(g.gx, g.gy);
    if (tower) {
      this.selectedTower = tower;
      this.placementCell = null;
      this.showTowerPopup(tower);
      return;
    }
    this.selectedTower = null;
    if (this.grid[g.gy][g.gx] === CELL.EMPTY) {
      this.showPlacementPopup(g.gx, g.gy);
    } else {
      this.placementCell = null;
      this.hidePopup();
    }
  }

  onKeyDown = (e) => {
    if (e.code === 'Space') { e.preventDefault(); this.togglePause(); }
    else if (e.key === 'f' || e.key === 'F') this.cycleSpeed();
    else if (e.key === 'Escape') { this.selectedTower = null; this.placementCell = null; this.hidePopup(); }
    else if (e.key === 'r' || e.key === 'R') this.restart();
  }

  towerAt(gx, gy) { return this.towers.find(t => t.gx === gx && t.gy === gy); }

  tryPlaceBasic(gx, gy) {
    const def = TOWER_DEFS.basic;
    if (this.credits < def.cost) { this.flashCreditError(); return; }
    // simulate block: ensure all ants still have a path (and nest->cake reachable)
    if (!this.testPlacement(gx, gy)) { this.flashBlockedError(gx, gy); return; }

    this.credits -= def.cost;
    const t = new Tower(gx, gy, 'basic');
    this.towers.push(t);
    this.grid[gy][gx] = CELL.TOWER;
    // invalidate all paths
    for (const a of this.ants) a.pathDirty = true;
    this.updateHUD();
    this.spawnPlacePuff(t.x, t.y, def.color);
    // close placement popup on success
    this.placementCell = null;
    this.hidePopup();
  }

  testPlacement(gx, gy) {
    // temporarily mark tower cell blocked
    const prev = this.grid[gy][gx];
    this.grid[gy][gx] = CELL.TOWER;
    let ok = true;
    // reachability: nest -> each not-taken cake, and cake -> nest
    const nest = NEST_CELLS[0];
    for (const cake of this.cakes) {
      if (cake.taken) continue;
      const p1 = findPath(this.grid, nest[0], nest[1], cake.gx, cake.gy);
      if (!p1) { ok = false; break; }
    }
    if (ok) {
      // also each live ant must still reach their goal
      for (const ant of this.ants) {
        if (ant.dead) continue;
        const sg = worldToGrid(ant.x, ant.y);
        sg.gx = clamp(sg.gx, 0, GRID.COLS-1);
        sg.gy = clamp(sg.gy, 0, GRID.ROWS-1);
        if (sg.gx === gx && sg.gy === gy) { ok = false; break; }
        let target;
        if (ant.state === 'seeking') {
          const c = ant.targetCake && !ant.targetCake.taken ? ant.targetCake : this.cakes.find(c => !c.taken);
          if (!c) continue;
          target = [c.gx, c.gy];
        } else {
          target = NEST_CELLS[0];
        }
        const p = findPath(this.grid, sg.gx, sg.gy, target[0], target[1]);
        if (!p) { ok = false; break; }
      }
    }
    this.grid[gy][gx] = prev;
    return ok;
  }

  tryUpgrade(tower, toKey) {
    const def = TOWER_DEFS[toKey];
    if (!def) return;
    if (this.credits < def.cost) { this.flashCreditError(); return; }
    this.credits -= def.cost;
    tower.defKey = toKey;
    tower.def = def;
    tower.totalInvested += def.cost;
    tower.placeAnim = 0.6;
    this.updateHUD();
    this.spawnPlacePuff(tower.x, tower.y, def.color);
    this.showTowerPopup(tower);
  }

  sellTower(tower) {
    const refund = Math.round(tower.totalInvested * 0.6);
    this.credits += refund;
    this.grid[tower.gy][tower.gx] = CELL.EMPTY;
    this.towers = this.towers.filter(t => t !== tower);
    for (const a of this.ants) a.pathDirty = true;
    this.selectedTower = null;
    this.spawnPlacePuff(tower.x, tower.y, '#ff6b6b');
    this.hidePopup();
    this.updateHUD();
  }

  // ========================== wave logic ==========================
  startWave() {
    if (this.wave >= WAVES.length) return;
    this.wave++;
    // Piecewise HP scaling: gentle early, steep after wave 20.
    const w = this.wave;
    this.waveHpMul = w <= 20
      ? 1 + (w - 1) * 0.15
      : 1 + 19 * 0.15 + (w - 20) * 0.28;
    this.spawnQueue = [];
    for (const group of WAVES[this.wave - 1]) {
      for (let i = 0; i < group.count; i++) {
        this.spawnQueue.push({ kind: group.kind, delay: group.gap });
      }
    }
    this.spawnTimer = 0.3;
    this.waveState = 'spawning';
  }

  waveUpdate(dt) {
    if (this.waveState === 'prep') {
      this.waveTimer -= dt;
      if (this.waveTimer <= 0) {
        this.startWave();
      }
    } else if (this.waveState === 'spawning') {
      this.spawnTimer -= dt;
      while (this.spawnTimer <= 0 && this.spawnQueue.length > 0) {
        const next = this.spawnQueue.shift();
        this.ants.push(new Ant(this, next.kind, this.waveHpMul));
        this.spawnTimer += next.delay;
      }
      if (this.spawnQueue.length === 0) {
        this.waveState = 'clearing';
      }
    } else if (this.waveState === 'clearing') {
      if (this.ants.length === 0) {
        if (this.wave >= WAVES.length) {
          this.triggerVictory();
        } else {
          this.waveState = 'prep';
          this.waveTimer = 6;
          // small bonus
          this.credits += 20 + this.wave * 5;
          this.updateHUD();
        }
      }
    }
  }

  // ========================== events ==========================
  onAntKilled(ant) {
    this.credits += Math.round(ant.reward);
    this.stats.kills++;
    // if it was carrying, the cake returns
    if (ant.carrying && !ant.carrying.lost) {
      ant.carrying.taken = false;
      ant.carrying.claimed = false;
      this.spawnCakeReturnPuff(ant.carrying.wx, ant.carrying.wy);
    }
    if (ant.targetCake && ant.targetCake.claimed && ant.targetCake !== ant.carrying) {
      ant.targetCake.claimed = false;
    }
    this.removeAnts.push(ant);
    if (ant.isBoss) {
      const big = ant.bossTier === 'big';
      this.explode(ant.x, ant.y, big ? 42 : 28, big ? '#ff4040' : '#ff60d0');
      this.shake = Math.max(this.shake, big ? 22 : 14);
    } else {
      this.explode(ant.x, ant.y, 14, '#ffaa66');
    }
    this.updateHUD();
  }

  onCakeLost() {
    this.stats.cakesLost++;
    this.cakesLeft--;
    this.shake = Math.max(this.shake, 10);
    this.updateHUD();
    if (this.cakesLeft <= 0) this.triggerGameOver();
  }

  triggerGameOver() {
    if (this.gameOver) return;
    this.gameOver = true;
    this.showOverlay(false);
  }
  triggerVictory() {
    if (this.gameOver) return;
    this.gameOver = true;
    this.victory = true;
    this.showOverlay(true);
  }

  // ========================== effects ==========================
  spawnHitParticles(x, y) {
    for (let i = 0; i < 5; i++) {
      this.particles.push(new Particle(x, y, { color: '#ffd59a', size: rand(1, 2), life: 0.25 }));
    }
  }
  explode(x, y, r, color) {
    this.shake = Math.max(this.shake, clamp(r / 4, 1, 14));
    for (let i = 0; i < 14; i++) {
      this.particles.push(new Particle(x, y, {
        speed: rand(80, 240), life: rand(0.35, 0.7),
        color, size: rand(1.5, 3.5), fade: 1,
      }));
    }
    // ring
    for (let i = 0; i < 8; i++) {
      this.particles.push(new Particle(x, y, {
        angle: (i / 8) * Math.PI * 2, speed: r * 3,
        life: 0.35, color: '#fff', size: 2, fade: 0.8,
      }));
    }
  }
  spawnPlacePuff(x, y, color) {
    for (let i = 0; i < 12; i++) {
      this.particles.push(new Particle(x, y, {
        angle: (i / 12) * Math.PI * 2, speed: rand(40, 100),
        life: 0.4, color, size: rand(1.5, 3),
      }));
    }
  }
  spawnCakeReturnPuff(x, y) {
    for (let i = 0; i < 10; i++) {
      this.particles.push(new Particle(x, y, {
        angle: (i / 10) * Math.PI * 2, speed: 60,
        life: 0.5, color: COLORS.cakeBase, size: 2.5,
      }));
    }
  }
  flashCreditError() {
    const el = document.getElementById('hud-credits');
    el.animate([
      { transform: 'translateX(0)' },
      { transform: 'translateX(-6px)' },
      { transform: 'translateX(6px)' },
      { transform: 'translateX(0)' },
    ], { duration: 260 });
  }
  flashBlockedError(gx, gy) {
    const w = gridToWorld(gx, gy);
    for (let i = 0; i < 10; i++) {
      this.particles.push(new Particle(w.x, w.y, { color: '#ff6b6b', life: 0.5, size: rand(2, 3) }));
    }
  }

  // ========================== main loop ==========================
  tick = (now) => {
    const dtRaw = Math.min(0.05, (now - this.last) / 1000);
    this.last = now;
    const dt = this.paused || !this.started ? 0 : dtRaw * this.speed;

    if (!this.gameOver && dt > 0) {
      this.stats.time += dt;
      this.waveUpdate(dt);
      for (const t of this.towers) t.update(dt, this);
      for (const a of this.ants) a.update(dt);
      for (const p of this.projectiles) p.update(dt, this);
      for (const p of this.particles) p.update(dt);

      // cleanup
      if (this.removeAnts.length) {
        const dead = new Set(this.removeAnts);
        this.ants = this.ants.filter(a => !dead.has(a));
        this.removeAnts.length = 0;
      }
      this.projectiles = this.projectiles.filter(p => !p.dead);
      this.particles = this.particles.filter(p => !p.dead);

      this.shake *= Math.pow(0.001, dt); // decay fast
      if (this.shake < 0.05) this.shake = 0;
      this.updateHUD();
    }

    this.render();
    requestAnimationFrame(this.tick);
  }

  // ========================== rendering ==========================
  render() {
    const ctx = this.ctx;
    ctx.save();
    // clear
    ctx.fillStyle = '#0f1122';
    ctx.fillRect(0, 0, W, H);

    // shake
    if (this.shake > 0) {
      ctx.translate(rand(-this.shake, this.shake) * 0.5, rand(-this.shake, this.shake) * 0.5);
    }

    this.drawGrid();
    this.drawNest();
    this.drawCakes();
    this.drawPlacementIndicator();

    // path preview: draw a faint path from nest to nearest cake
    if (this.started && !this.gameOver) this.drawGuidePath();

    // towers
    for (const t of this.towers) {
      const selected = t === this.selectedTower;
      const hov = this.hoverCell && this.hoverCell.gx === t.gx && this.hoverCell.gy === t.gy;
      t.draw(ctx, selected, hov);
    }
    // ants
    for (const a of this.ants) a.draw(ctx);
    // projectiles
    for (const p of this.projectiles) p.draw(ctx);
    // particles (top)
    for (const p of this.particles) p.draw(ctx);

    ctx.restore();
  }

  drawGrid() {
    const ctx = this.ctx;
    for (let y = 0; y < GRID.ROWS; y++) {
      for (let x = 0; x < GRID.COLS; x++) {
        ctx.fillStyle = (x + y) % 2 === 0 ? COLORS.gridEven : COLORS.gridOdd;
        ctx.fillRect(x * GRID.CELL, y * GRID.CELL + HUD_H, GRID.CELL, GRID.CELL);
      }
    }
    // subtle lines
    ctx.strokeStyle = COLORS.gridLine;
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let x = 0; x <= GRID.COLS; x++) {
      ctx.moveTo(x * GRID.CELL, HUD_H);
      ctx.lineTo(x * GRID.CELL, H);
    }
    for (let y = 0; y <= GRID.ROWS; y++) {
      ctx.moveTo(0, y * GRID.CELL + HUD_H);
      ctx.lineTo(W, y * GRID.CELL + HUD_H);
    }
    ctx.stroke();
  }

  drawNest() {
    const ctx = this.ctx;
    // nest occupies 2x2 cells top-left
    const x = 1 * GRID.CELL;
    const y = 0 * GRID.CELL + HUD_H;
    const s = 2 * GRID.CELL;

    // earth rim
    const cx = x + s/2, cy = y + s/2;
    const rOuter = s * 0.55;
    const rInner = s * 0.35;
    // outer mound
    const g1 = ctx.createRadialGradient(cx, cy, rInner, cx, cy, rOuter + 8);
    g1.addColorStop(0, '#2a1a10');
    g1.addColorStop(1, '#0a0604');
    ctx.fillStyle = g1;
    ctx.beginPath(); ctx.arc(cx, cy, rOuter + 8, 0, Math.PI*2); ctx.fill();
    // hole
    const g2 = ctx.createRadialGradient(cx, cy - 4, 4, cx, cy, rInner);
    g2.addColorStop(0, '#1a0f08');
    g2.addColorStop(1, '#000');
    ctx.fillStyle = g2;
    ctx.beginPath(); ctx.arc(cx, cy, rInner, 0, Math.PI*2); ctx.fill();
    // highlight ring
    ctx.strokeStyle = 'rgba(255,180,120,0.15)';
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(cx, cy, rInner + 2, Math.PI*0.2, Math.PI*0.8); ctx.stroke();

    // pebbles
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2 + 0.5;
      const r = rOuter + 2;
      const px = cx + Math.cos(a) * r;
      const py = cy + Math.sin(a) * r;
      ctx.fillStyle = '#3a2a1c';
      ctx.beginPath(); ctx.arc(px, py, 2 + (i % 2), 0, Math.PI*2); ctx.fill();
    }
  }

  drawCakes() {
    const ctx = this.ctx;
    const t = performance.now() / 1000;
    for (const cake of this.cakes) {
      if (cake.lost) continue;
      if (cake.taken) continue;
      const bob = Math.sin(t * 2 + cake.bobPhase) * 1.5;
      const x = cake.wx, y = cake.wy + bob;
      // plate shadow
      ctx.save();
      ctx.globalAlpha = 0.4;
      ctx.fillStyle = '#000';
      ctx.beginPath(); ctx.ellipse(x, y + 14, 15, 4, 0, 0, Math.PI*2); ctx.fill();
      ctx.restore();

      // cake base (triangle-ish slice)
      ctx.save();
      ctx.translate(x, y);
      // body
      ctx.fillStyle = COLORS.cakeBase;
      roundRect(ctx, -13, -6, 26, 18, 3); ctx.fill();
      // top frosting
      ctx.fillStyle = COLORS.cakeTop;
      roundRect(ctx, -13, -10, 26, 6, 3); ctx.fill();
      // drip
      ctx.beginPath();
      ctx.moveTo(-8, -4); ctx.quadraticCurveTo(-5, 1, -2, -4);
      ctx.moveTo(4, -4); ctx.quadraticCurveTo(7, 2, 10, -4);
      ctx.fill();
      // shadow line
      ctx.fillStyle = COLORS.cakeShadow;
      ctx.fillRect(-13, 10, 26, 2);
      // cherry
      ctx.fillStyle = COLORS.cakeCherry;
      ctx.beginPath(); ctx.arc(0, -12, 2.4, 0, Math.PI*2); ctx.fill();
      ctx.fillStyle = '#fff';
      ctx.beginPath(); ctx.arc(-0.8, -12.8, 0.7, 0, Math.PI*2); ctx.fill();
      ctx.restore();
    }
  }

  drawHoverPreview() {
    const h = this.hoverCell;
    if (!h || this.gameOver || !this.started) return;
    const cell = this.grid[h.gy][h.gx];
    const ctx = this.ctx;
    const x = h.gx * GRID.CELL, y = h.gy * GRID.CELL + HUD_H;

    if (cell === CELL.EMPTY) {
      const canAfford = this.credits >= TOWER_DEFS.basic.cost;
      const canPath = this.testPlacement(h.gx, h.gy);
      const ok = canAfford && canPath;
      ctx.save();
      ctx.fillStyle = ok ? COLORS.rangeOk : COLORS.rangeBad;
      ctx.strokeStyle = ok ? COLORS.rangeOkBorder : COLORS.rangeBadBorder;
      ctx.lineWidth = 1.5;
      ctx.fillRect(x+2, y+2, GRID.CELL-4, GRID.CELL-4);
      ctx.strokeRect(x+2.5, y+2.5, GRID.CELL-5, GRID.CELL-5);

      // show ghost range
      if (ok) {
        const cx = x + GRID.CELL/2, cy = y + GRID.CELL/2;
        ctx.setLineDash([4, 4]);
        ctx.beginPath();
        ctx.arc(cx, cy, TOWER_DEFS.basic.range * GRID.CELL, 0, Math.PI*2);
        ctx.stroke();
      }
      ctx.restore();
    }
  }

  drawPlacementIndicator() {
    if (!this.placementCell) return;
    const { gx, gy } = this.placementCell;
    const ctx = this.ctx;
    const x = gx * GRID.CELL, y = gy * GRID.CELL + HUD_H;
    const cx = x + GRID.CELL / 2, cy = y + GRID.CELL / 2;
    const canPath = this.testPlacement(gx, gy);
    const canAfford = this.credits >= TOWER_DEFS.basic.cost;
    const ok = canPath && canAfford;
    const color = ok ? '#5ee6a8' : '#ff6b6b';
    const pulse = 0.6 + Math.sin(performance.now() / 160) * 0.4;

    ctx.save();
    // pulsing filled square
    ctx.fillStyle = color;
    ctx.globalAlpha = 0.18 * pulse;
    ctx.fillRect(x + 2, y + 2, GRID.CELL - 4, GRID.CELL - 4);
    // bright border
    ctx.globalAlpha = 0.9;
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.setLineDash([6, 4]);
    ctx.lineDashOffset = -performance.now() / 80;
    ctx.strokeRect(x + 3, y + 3, GRID.CELL - 6, GRID.CELL - 6);
    ctx.setLineDash([]);
    // range ring preview
    if (ok) {
      ctx.globalAlpha = 0.5;
      ctx.lineWidth = 1.5;
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.arc(cx, cy, TOWER_DEFS.basic.range * GRID.CELL, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.restore();
  }

  drawGuidePath() {
    // faint preview of nest->nearest available cake path (so player sees the route)
    const avail = this.cakes.filter(c => !c.taken && !c.lost);
    if (!avail.length) return;
    const nest = NEST_CELLS[0];
    // pick a representative path (shortest)
    let shortest = null;
    for (const c of avail) {
      const p = findPath(this.grid, nest[0], nest[1], c.gx, c.gy);
      if (p && (!shortest || p.length < shortest.length)) shortest = p;
    }
    if (!shortest) return;
    const ctx = this.ctx;
    ctx.save();
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.055)';
    ctx.lineWidth = 14;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();
    shortest.forEach((p, i) => {
      const w = gridToWorld(p.gx, p.gy);
      if (i === 0) ctx.moveTo(w.x, w.y); else ctx.lineTo(w.x, w.y);
    });
    ctx.stroke();
    ctx.restore();
  }

  // ========================== HUD + popups ==========================
  updateHUD() {
    document.getElementById('credits-text').textContent = this.credits;
    document.getElementById('wave-text').textContent = Math.max(1, this.wave);
    document.getElementById('wave-max').textContent = this.waveMax;
    document.getElementById('cakes-text').textContent = this.cakesLeft;

    // wave bar: prep countdown or spawn progress
    const fill = document.getElementById('wave-bar-fill');
    const label = document.getElementById('wave-status-label');
    if (this.waveState === 'prep') {
      const pct = clamp((6 - this.waveTimer) / 6, 0, 1) * 100;
      fill.style.width = pct + '%';
      fill.classList.remove('active');
      label.textContent = `다음 웨이브까지 ${this.waveTimer.toFixed(1)}초`;
    } else if (this.waveState === 'spawning') {
      const totalInWave = WAVES[this.wave-1].reduce((s, g) => s + g.count, 0);
      const left = this.spawnQueue.length + this.ants.length;
      const pct = clamp(1 - left / totalInWave, 0, 1) * 100;
      fill.style.width = pct + '%';
      fill.classList.add('active');
      label.textContent = `웨이브 ${this.wave} 진행 중`;
    } else {
      fill.style.width = '100%';
      fill.classList.add('active');
      label.textContent = `웨이브 ${this.wave} 정리 중`;
    }

    // speed button label
    document.getElementById('speed-text').textContent = this.speed + 'x';
    // pause icon swap
    const pauseBtn = document.getElementById('btn-pause');
    pauseBtn.classList.toggle('active', this.paused);
  }

  showPlacementPopup(gx, gy) {
    this.placementCell = { gx, gy };
    const def = TOWER_DEFS.basic;
    const afford = this.credits >= def.cost;
    const canPath = this.testPlacement(gx, gy);
    const ok = afford && canPath;
    const reason = !afford ? '크레딧 부족' : !canPath ? '경로가 막혀요' : '';

    const body = document.getElementById('popup-body');
    body.innerHTML = `
      <div class="popup-title">이 칸에 타워를 설치할까요?</div>
      <button class="upgrade-btn" data-build ${ok ? '' : 'disabled'} style="width:100%;border-color:${ok ? 'var(--accent)' : 'var(--panel-border)'}">
        <div class="u-title"><span class="u-icon" style="color:${def.color}">${def.icon}</span>${def.name}</div>
        <div class="u-desc">${def.desc}${reason ? ` <span style="color:var(--red)">· ${reason}</span>` : ''}</div>
        <div class="u-cost"><span class="coin"></span>${def.cost}</div>
      </button>
      <div class="rule" style="margin:10px 0 0;font-size:11px;text-align:center;padding:6px;">
        기본 타워 설치 후 타워를 클릭해 진화시킬 수 있어요.
      </div>
    `;

    this.positionPopupAt(gridToWorld(gx, gy));

    const btn = body.querySelector('[data-build]');
    if (btn) {
      btn.addEventListener('click', (ev) => {
        ev.stopPropagation();
        this.tryPlaceBasic(gx, gy);
      });
    }
  }

  positionPopupAt(world) {
    const popup = document.getElementById('popup');
    popup.classList.remove('hidden');
    requestAnimationFrame(() => {
      const rect = this.canvas.getBoundingClientRect();
      const stage = document.getElementById('stage').getBoundingClientRect();
      const sx = rect.width / this.canvas.width;
      const sy = rect.height / this.canvas.height;
      const px = world.x * sx;
      const py = world.y * sy;
      const pr = popup.getBoundingClientRect();
      let left = px - pr.width / 2;
      let top = py + 30;
      left = clamp(left, 8, stage.width - pr.width - 8);
      top = clamp(top, 90, stage.height - pr.height - 8);
      popup.style.left = left + 'px';
      popup.style.top = top + 'px';
    });
  }

  showTowerPopup(tower) {
    const popup = document.getElementById('popup');
    const body = document.getElementById('popup-body');
    const d = tower.def;

    const upgrades = UPGRADES[tower.defKey];
    const statsHtml = `
      <div class="tower-stats">
        <div class="tower-stat"><div class="stat-label">데미지</div><div class="stat-value">${d.damage}${d.shots ? '×'+d.shots : ''}</div></div>
        <div class="tower-stat"><div class="stat-label">사거리</div><div class="stat-value">${d.range.toFixed(1)}</div></div>
        <div class="tower-stat"><div class="stat-label">연사</div><div class="stat-value">${d.fireRate.toFixed(1)}</div></div>
      </div>`;

    let upgradeHtml = '';
    if (upgrades.length) {
      upgradeHtml = '<div class="upgrade-row">';
      for (const upKey of upgrades) {
        const up = TOWER_DEFS[upKey];
        const afford = this.credits >= up.cost;
        const pathClass = up.path;
        upgradeHtml += `
          <button class="upgrade-btn ${pathClass}" data-upgrade="${upKey}" ${afford ? '' : 'disabled'}>
            <div class="u-title"><span class="u-icon" style="color:${up.color}">${up.icon}</span>${up.name}</div>
            <div class="u-desc">${up.desc}</div>
            <div class="u-cost"><span class="coin"></span>${up.cost}</div>
          </button>`;
      }
      upgradeHtml += '</div>';
    } else {
      upgradeHtml = `<div class="rule" style="margin:0;text-align:center;">최종 티어에 도달했습니다.</div>`;
    }

    const sellValue = Math.round(tower.totalInvested * 0.6);

    body.innerHTML = `
      <div class="tower-info">
        <div class="tower-badge" style="color:${d.color}">${d.icon}</div>
        <div>
          <div class="popup-title" style="margin:0">${d.name}</div>
          <div class="u-desc" style="color:var(--text-dim);font-size:11px">${d.desc}</div>
        </div>
      </div>
      ${statsHtml}
      ${upgradeHtml}
      <button class="sell-btn" data-sell>철거 (+${sellValue})</button>
    `;

    // position popup above tower
    const rect = this.canvas.getBoundingClientRect();
    const stage = document.getElementById('stage').getBoundingClientRect();
    const sx = rect.width / this.canvas.width;
    const sy = rect.height / this.canvas.height;
    const px = (tower.x * sx) + (rect.left - stage.left);
    const py = (tower.y * sy) + (rect.top - stage.top);
    popup.classList.remove('hidden');
    // measure after render
    requestAnimationFrame(() => {
      const pr = popup.getBoundingClientRect();
      let left = px - pr.width / 2;
      let top = py + 30;
      left = clamp(left, 8, stage.width - pr.width - 8);
      top  = clamp(top, 90, stage.height - pr.height - 8);
      popup.style.left = left + 'px';
      popup.style.top = top + 'px';
    });

    body.querySelectorAll('[data-upgrade]').forEach(btn => {
      btn.addEventListener('click', (ev) => {
        ev.stopPropagation();
        this.tryUpgrade(tower, btn.getAttribute('data-upgrade'));
      });
    });
    body.querySelector('[data-sell]').addEventListener('click', (ev) => {
      ev.stopPropagation();
      this.sellTower(tower);
    });
  }

  hidePopup() {
    document.getElementById('popup').classList.add('hidden');
  }

  showOverlay(victory) {
    const overlay = document.getElementById('overlay');
    const title = document.getElementById('overlay-title');
    const sub = document.getElementById('overlay-sub');
    const stats = document.getElementById('overlay-stats');
    if (victory) {
      title.textContent = '🎂 승리!';
      title.style.background = 'linear-gradient(90deg,#ffc857,#5ee6a8)';
      title.style.webkitBackgroundClip = 'text';
      title.style.backgroundClip = 'text';
      sub.textContent = '모든 웨이브를 막아냈습니다. 완벽한 방어였어요.';
    } else {
      title.textContent = '게임 오버';
      title.style.background = 'linear-gradient(90deg,#ff6b6b,#ffa452)';
      title.style.webkitBackgroundClip = 'text';
      title.style.backgroundClip = 'text';
      sub.textContent = '개미들이 케이크를 전부 가져갔습니다.';
    }
    const minutes = Math.floor(this.stats.time / 60);
    const seconds = Math.floor(this.stats.time % 60).toString().padStart(2, '0');
    stats.innerHTML = `
      <div class="stat"><div class="k">웨이브</div><div class="v">${this.wave}</div></div>
      <div class="stat"><div class="k">처치</div><div class="v">${this.stats.kills}</div></div>
      <div class="stat"><div class="k">남은 케이크</div><div class="v">${this.cakesLeft}</div></div>
      <div class="stat"><div class="k">시간</div><div class="v">${minutes}:${seconds}</div></div>
    `;
    overlay.classList.remove('hidden');
  }

  // ========================== controls ==========================
  togglePause() {
    this.paused = !this.paused;
    const btn = document.getElementById('btn-pause');
    btn.classList.toggle('active', this.paused);
    btn.innerHTML = this.paused
      ? '<svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor"><path d="M7 5 L19 12 L7 19 Z"/></svg>'
      : '<svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor"><rect x="6" y="5" width="4" height="14" rx="1"/><rect x="14" y="5" width="4" height="14" rx="1"/></svg>';
  }
  cycleSpeed() {
    this.speed = this.speed === 1 ? 2 : this.speed === 2 ? 3 : 1;
    this.updateHUD();
  }
}

// ============================================================
// Boot
// ============================================================
window.addEventListener('DOMContentLoaded', () => {
  const canvas = document.getElementById('game');
  const game = new Game(canvas);
  // expose for debugging
  window._game = game;
});

})();
