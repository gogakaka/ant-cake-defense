'use strict';

// ============================================================
// A* pathfinding on the grid
// ============================================================
// Binary min-heap optimized for A*'s open set.
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

// 4-connected A* on a CELL.* grid. TOWER blocks; everything else walks.
function findPath(grid, sx, sy, tx, ty) {
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
