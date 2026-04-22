'use strict';

// ============================================================
// Math & helpers
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

// Grid ↔ world conversions (depend on GRID / HUD_H from constants.js)
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

// Canvas helper
function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}
