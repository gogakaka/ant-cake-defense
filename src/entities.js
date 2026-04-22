'use strict';

// ============================================================
// Ant — seeks a cake, carries it back to the nest.
// ============================================================
class Ant {
  constructor(game, kind, waveHpMul) {
    this.game = game;
    this.kind = kind;
    const k = ANT_KINDS[kind];
    const extra = 1 + (game.wave - 1) * (k.perWaveHp || 0);
    this.maxHp = Math.round(k.hp * waveHpMul * extra);
    this.hp = this.maxHp;
    this.speed = k.speed * (1 + (game.wave - 1) * 0.015);
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
    this.targetCake = null;
    this.carrying = null;
    this.path = null;
    this.pathIdx = 0;
    this.pathDirty = true;
    this.legPhase = Math.random() * Math.PI * 2;
    this.dead = false;
    this.slow = 0;
    this.flashHit = 0;
  }

  pickTarget() {
    // nearest unclaimed cake; fall back to any not-taken cake
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
      // return to nearest nest cell
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
      this.pathDirty = true;
      return;
    }
    this.legPhase += dt * 14;

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
      if (this.targetCake && !this.targetCake.taken) {
        this.targetCake.taken = true;
        this.targetCake.claimed = false;
        this.carrying = this.targetCake;
        this.state = 'returning';
        this.pathDirty = true;
      } else {
        this.targetCake = null;
        this.pathDirty = true;
      }
    } else {
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

    // boss aura
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

    // antennae
    ctx.strokeStyle = this.color;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(this.r * 0.9, -2); ctx.lineTo(this.r * 1.8, -5);
    ctx.moveTo(this.r * 0.9,  2); ctx.lineTo(this.r * 1.8,  5);
    ctx.stroke();

    // boss crown
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
      ctx.fillStyle = gemCol;
      ctx.shadowColor = gemCol;
      ctx.shadowBlur = 8;
      ctx.beginPath(); ctx.arc(hx, 0, 2.6, 0, Math.PI*2); ctx.fill();
      ctx.shadowBlur = 0;
    }

    // carrying cake
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

    // HP bar (wider for bosses)
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

// ============================================================
// Projectile — bullet or missile; homes onto its target
// ============================================================
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

// ============================================================
// Particle — one-shot visual effect (sparks, muzzle flash, explosions)
// ============================================================
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

// ============================================================
// Tower — targets ants in range, fires shots / beams / explosives
// ============================================================
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
    // prioritize ants carrying cake, then closest
    let best = null, bestScore = -Infinity;
    const r2 = this.rangePx * this.rangePx;
    for (const a of game.ants) {
      if (a.dead) continue;
      const d2 = dist2(this.x, this.y, a.x, a.y);
      if (d2 > r2) continue;
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
    // range ring
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

    ctx.save();
    ctx.translate(this.x, this.y);
    const scale = 1 + this.placeAnim * 0.6;
    ctx.scale(scale, scale);

    // power aura for L4/L5
    if (d.level >= 4) {
      const pulse = 0.7 + Math.sin(performance.now() / 320) * 0.3;
      ctx.save();
      ctx.globalAlpha = (d.level === 5 ? 0.28 : 0.18) * pulse;
      ctx.fillStyle = d.color;
      ctx.beginPath();
      ctx.arc(0, 0, d.level === 5 ? 28 : 24, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

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

    // turret (per-path body)
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
      ctx.fillStyle = '#2a1f14';
      ctx.fillRect(8, -6, 6, 3);
      ctx.fillRect(8,  3, 6, 3);
    } else if (d.path === 'dual') {
      roundRect(ctx, -5, -9, 20, 5, 2); ctx.fill();
      roundRect(ctx, -5,  4, 20, 5, 2); ctx.fill();
    } else {
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
      const mx = (seg.a.x + seg.b.x)/2 + rand(-4, 4);
      const my = (seg.a.y + seg.b.y)/2 + rand(-4, 4);
      ctx.quadraticCurveTo(mx, my, seg.b.x, seg.b.y);
      ctx.stroke();
      ctx.restore();
    }
  }
}

// ============================================================
// Cake — one of 8 pieces ants try to steal
// ============================================================
class Cake {
  constructor(gx, gy, idx) {
    this.gx = gx; this.gy = gy;
    this.idx = idx;
    const w = gridToWorld(gx, gy);
    this.wx = w.x; this.wy = w.y;
    this.taken = false;   // being carried
    this.claimed = false; // soft reserve by an ant's target
    this.lost = false;    // delivered to nest, gone forever
    this.bobPhase = Math.random() * Math.PI * 2;
  }
}
