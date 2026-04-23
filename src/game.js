'use strict';

// Max ants allowed on screen at once. Extra spawns wait in the queue.
// Keeps late-wave swarms from turning into frame drops on weaker machines.
const MAX_ACTIVE_ANTS = 120;

// ============================================================
// Game — top-level orchestration: state, main loop, input, UI wiring.
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

    this.credits = 100;
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

    this.wave = 0;
    this.waveMax = WAVES.length;
    this.waveState = 'prep';
    this.waveTimer = 4;
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

    // Click outside popup & canvas → close
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
    if (p.y < HUD_H) return;
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

  // ==================== placement & upgrades ====================
  tryPlaceBasic(gx, gy) {
    const def = TOWER_DEFS.basic;
    if (this.credits < def.cost) { this.flashCreditError(); return; }
    if (!this.testPlacement(gx, gy)) { this.flashBlockedError(gx, gy); return; }

    this.credits -= def.cost;
    const t = new Tower(gx, gy, 'basic');
    this.towers.push(t);
    this.grid[gy][gx] = CELL.TOWER;
    for (const a of this.ants) a.pathDirty = true;
    this.updateHUD();
    this.spawnPlacePuff(t.x, t.y, def.color);
    this.placementCell = null;
    this.hidePopup();
  }

  testPlacement(gx, gy) {
    // Towers no longer block pathing — ants pass through. Only check cell is empty.
    return inBounds(gx, gy) && this.grid[gy]?.[gx] === CELL.EMPTY;
  }

  getBuffAt(x, y) {
    let dmg = 1, rate = 1;
    for (const t of this.towers) {
      if (!t.def.support) continue;
      const r2 = t.rangePx * t.rangePx;
      if (dist2(t.x, t.y, x, y) > r2) continue;
      dmg += t.def.buffDmg || 0;
      rate += t.def.buffRate || 0;
    }
    return { dmg, rate };
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

  // ==================== wave logic ====================
  startWave() {
    if (this.wave >= WAVES.length) return;
    this.wave++;
    // Exponential HP scaling: +8% per wave baseline, with an additional
    // +2.5% per wave compounding after wave 30 so late-game ants pile up HP fast.
    // w1 = 1x, w10 ≈ 2.0x, w30 ≈ 9.3x, w40 ≈ 25.7x, w50 ≈ 71.2x, w60 ≈ 196.8x, w70 ≈ 543x.
    const w = this.wave;
    let mul = Math.pow(1.08, w - 1);
    if (w > 30) mul *= Math.pow(1.025, w - 30);
    this.waveHpMul = mul;
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
      if (this.waveTimer <= 0) this.startWave();
    } else if (this.waveState === 'spawning') {
      this.spawnTimer -= dt;
      while (this.spawnTimer <= 0 && this.spawnQueue.length > 0) {
        // Stop spawning while the field is saturated; resume once kills free up room.
        if (this.ants.length >= MAX_ACTIVE_ANTS) {
          if (this.spawnTimer < 0) this.spawnTimer = 0;
          break;
        }
        const next = this.spawnQueue.shift();
        this.ants.push(new Ant(this, next.kind, this.waveHpMul));
        this.spawnTimer += next.delay;
      }
      if (this.spawnQueue.length === 0) this.waveState = 'clearing';
    } else if (this.waveState === 'clearing') {
      if (this.ants.length === 0) {
        if (this.wave >= WAVES.length) {
          this.triggerVictory();
        } else {
          this.waveState = 'prep';
          this.waveTimer = 4;
          this.credits += 8 + this.wave * 2;
          this.updateHUD();
        }
      }
    }
  }

  // ==================== events ====================
  onAntKilled(ant) {
    this.credits += Math.round(ant.reward);
    this.stats.kills++;
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
      const tier = ant.bossTier;
      const r = tier === 'mega' ? 72 : tier === 'big' ? 42 : 28;
      const color = tier === 'mega' ? '#ffc800' : tier === 'big' ? '#ff4040' : '#ff60d0';
      this.explode(ant.x, ant.y, r, color);
      this.shake = Math.max(this.shake, tier === 'mega' ? 40 : tier === 'big' ? 22 : 14);
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

  // ==================== effects ====================
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

  // ==================== main loop ====================
  tick = (now) => {
    const dtRaw = Math.min(0.05, (now - this.last) / 1000);
    this.last = now;
    const dt = this.paused || !this.started ? 0 : dtRaw * this.speed;

    if (!this.gameOver && dt > 0) {
      this.stats.time += dt;
      this.waveUpdate(dt);
      // Reset per-frame slow tracker before ice/flame auras re-apply it.
      for (const a of this.ants) a._frameSlowFactor = 1;
      for (const t of this.towers) t.update(dt, this);
      for (const a of this.ants) a.update(dt);
      for (const p of this.projectiles) p.update(dt, this);
      for (const p of this.particles) p.update(dt);

      if (this.removeAnts.length) {
        const dead = new Set(this.removeAnts);
        this.ants = this.ants.filter(a => !dead.has(a));
        this.removeAnts.length = 0;
      }
      this.projectiles = this.projectiles.filter(p => !p.dead);
      this.particles = this.particles.filter(p => !p.dead);

      this.shake *= Math.pow(0.001, dt);
      if (this.shake < 0.05) this.shake = 0;
      this.updateHUD();
    }

    this.render();
    requestAnimationFrame(this.tick);
  }

  // ==================== rendering ====================
  render() {
    const ctx = this.ctx;
    ctx.save();
    ctx.fillStyle = '#cfd6e4';
    ctx.fillRect(0, 0, W, H);

    this.drawGrid();
    this.drawNest();
    this.drawCakes();
    this.drawPlacementIndicator();

    for (const t of this.towers) {
      const selected = t === this.selectedTower;
      const hov = this.hoverCell && this.hoverCell.gx === t.gx && this.hoverCell.gy === t.gy;
      t.draw(ctx, selected, hov);
    }
    for (const a of this.ants) a.draw(ctx);
    for (const p of this.projectiles) p.draw(ctx);
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
    const x = 1 * GRID.CELL;
    const y = 0 * GRID.CELL + HUD_H;
    const s = 2 * GRID.CELL;
    const cx = x + s/2, cy = y + s/2;
    const rOuter = s * 0.55;
    const rInner = s * 0.35;

    const g1 = ctx.createRadialGradient(cx, cy, rInner, cx, cy, rOuter + 8);
    g1.addColorStop(0, '#2a1a10');
    g1.addColorStop(1, '#0a0604');
    ctx.fillStyle = g1;
    ctx.beginPath(); ctx.arc(cx, cy, rOuter + 8, 0, Math.PI*2); ctx.fill();

    const g2 = ctx.createRadialGradient(cx, cy - 4, 4, cx, cy, rInner);
    g2.addColorStop(0, '#1a0f08');
    g2.addColorStop(1, '#000');
    ctx.fillStyle = g2;
    ctx.beginPath(); ctx.arc(cx, cy, rInner, 0, Math.PI*2); ctx.fill();

    ctx.strokeStyle = 'rgba(255,180,120,0.15)';
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(cx, cy, rInner + 2, Math.PI*0.2, Math.PI*0.8); ctx.stroke();

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
      ctx.save();
      ctx.globalAlpha = 0.4;
      ctx.fillStyle = '#000';
      ctx.beginPath(); ctx.ellipse(x, y + 14, 15, 4, 0, 0, Math.PI*2); ctx.fill();
      ctx.restore();

      ctx.save();
      ctx.translate(x, y);
      ctx.fillStyle = COLORS.cakeBase;
      roundRect(ctx, -13, -6, 26, 18, 3); ctx.fill();
      ctx.fillStyle = COLORS.cakeTop;
      roundRect(ctx, -13, -10, 26, 6, 3); ctx.fill();
      ctx.beginPath();
      ctx.moveTo(-8, -4); ctx.quadraticCurveTo(-5, 1, -2, -4);
      ctx.moveTo(4, -4); ctx.quadraticCurveTo(7, 2, 10, -4);
      ctx.fill();
      ctx.fillStyle = COLORS.cakeShadow;
      ctx.fillRect(-13, 10, 26, 2);
      ctx.fillStyle = COLORS.cakeCherry;
      ctx.beginPath(); ctx.arc(0, -12, 2.4, 0, Math.PI*2); ctx.fill();
      ctx.fillStyle = '#fff';
      ctx.beginPath(); ctx.arc(-0.8, -12.8, 0.7, 0, Math.PI*2); ctx.fill();
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
    ctx.fillStyle = color;
    ctx.globalAlpha = 0.18 * pulse;
    ctx.fillRect(x + 2, y + 2, GRID.CELL - 4, GRID.CELL - 4);
    ctx.globalAlpha = 0.9;
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.setLineDash([6, 4]);
    ctx.lineDashOffset = -performance.now() / 80;
    ctx.strokeRect(x + 3, y + 3, GRID.CELL - 6, GRID.CELL - 6);
    ctx.setLineDash([]);
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
    const avail = this.cakes.filter(c => !c.taken && !c.lost);
    if (!avail.length) return;
    const nest = NEST_CELLS[0];
    let shortest = null;
    for (const c of avail) {
      const p = findPath(this.grid, nest[0], nest[1], c.gx, c.gy);
      if (p && (!shortest || p.length < shortest.length)) shortest = p;
    }
    if (!shortest) return;
    const ctx = this.ctx;
    ctx.save();
    ctx.strokeStyle = 'rgba(60, 74, 120, 0.09)';
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

  // ==================== HUD + popups ====================
  updateHUD() {
    document.getElementById('credits-text').textContent = this.credits;
    document.getElementById('wave-text').textContent = Math.max(1, this.wave);
    document.getElementById('wave-max').textContent = this.waveMax;
    document.getElementById('cakes-text').textContent = this.cakesLeft;

    const fill = document.getElementById('wave-bar-fill');
    const label = document.getElementById('wave-status-label');
    if (this.waveState === 'prep') {
      const pct = clamp((4 - this.waveTimer) / 4, 0, 1) * 100;
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

    document.getElementById('speed-text').textContent = this.speed + 'x';
    document.getElementById('btn-pause').classList.toggle('active', this.paused);
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
    // On mobile the popup is docked (fixed) on the right side via CSS — skip
    // the tower-relative pixel positioning so it doesn't fight the stylesheet.
    if (document.documentElement.classList.contains('is-mobile')) {
      popup.style.left = '';
      popup.style.top = '';
      return;
    }
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
    const body = document.getElementById('popup-body');
    const d = tower.def;

    const upgrades = UPGRADES[tower.defKey];
    const statsHtml = (() => {
      if (d.bank) {
        return `<div class="tower-stats">
          <div class="tower-stat"><div class="stat-label">초당 생산</div><div class="stat-value">+${d.bankRate}</div></div>
        </div>`;
      }
      if (d.support) {
        return `<div class="tower-stats">
          <div class="tower-stat"><div class="stat-label">데미지 증폭</div><div class="stat-value">+${Math.round(d.buffDmg*100)}%</div></div>
          <div class="tower-stat"><div class="stat-label">연사 증폭</div><div class="stat-value">+${Math.round(d.buffRate*100)}%</div></div>
          <div class="tower-stat"><div class="stat-label">사거리</div><div class="stat-value">${d.range.toFixed(1)}</div></div>
        </div>`;
      }
      if (d.aura) {
        const slowCell = d.slowFactor < 1
          ? `<div class="tower-stat"><div class="stat-label">둔화</div><div class="stat-value">${Math.round((1-d.slowFactor)*100)}%</div></div>`
          : '';
        return `<div class="tower-stats">
          <div class="tower-stat"><div class="stat-label">초당 딜</div><div class="stat-value">${d.damage}</div></div>
          <div class="tower-stat"><div class="stat-label">사거리</div><div class="stat-value">${d.range.toFixed(1)}</div></div>
          ${slowCell}
        </div>`;
      }
      return `<div class="tower-stats">
        <div class="tower-stat"><div class="stat-label">데미지</div><div class="stat-value">${d.damage}${d.shots ? '×'+d.shots : ''}</div></div>
        <div class="tower-stat"><div class="stat-label">사거리</div><div class="stat-value">${d.range.toFixed(1)}</div></div>
        <div class="tower-stat"><div class="stat-label">연사</div><div class="stat-value">${d.fireRate.toFixed(1)}</div></div>
      </div>`;
    })();

    let upgradeHtml = '';
    if (upgrades.length) {
      // ≤3 options → single flex row. ≥4 → 3-column grid that wraps downward.
      const rowClass = upgrades.length >= 4 ? 'upgrade-row row-grid' : 'upgrade-row';
      upgradeHtml = `<div class="${rowClass}">`;
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

    this.positionPopupAt({ x: tower.x, y: tower.y });

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
    document.getElementById('overlay').classList.remove('hidden');
  }

  // ==================== controls ====================
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
  window._game = game; // debug hook
});
