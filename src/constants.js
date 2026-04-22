'use strict';

// ============================================================
// Grid & layout
// ============================================================
const GRID = { COLS: 40, ROWS: 20, CELL: 40 };
const HUD_H = 80;
const W = GRID.COLS * GRID.CELL;       // 1600
const H = GRID.ROWS * GRID.CELL + HUD_H; // 880

const CELL = {
  EMPTY: 0,
  NEST: 1,
  CAKE: 2,
  TOWER: 3,
};

const NEST_CELLS = [[1,0],[2,0],[1,1],[2,1]];
const NEST_SPAWN = { gx: 1.5, gy: 0.5 };

const CAKE_POSITIONS = [
  [34, 16], [35, 16], [36, 16], [37, 16],
  [34, 17], [35, 17], [36, 17], [37, 17],
];

// ============================================================
// Palette (canvas-side)
// ============================================================
const COLORS = {
  gridLine: 'rgba(180, 195, 240, 0.08)',
  gridEven: '#272c50',
  gridOdd: '#2a2f55',
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

// ============================================================
// Towers (13 definitions across 5 tiers, 3 evolution paths)
// ============================================================
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
  laser4: {
    key: 'laser4', name: '스톰 Lv.4', icon: '⚡', color: '#ff1f78',
    cost: 400, damage: 12, range: 3.8, fireRate: 8.5,
    path: 'laser', beam: true, chain: 3, level: 4,
    desc: '연쇄 번개가 3마리까지 전이.'
  },
  missile4: {
    key: 'missile4', name: '시즈 Lv.4', icon: '☄', color: '#ff7520',
    cost: 400, damage: 85, range: 4.2, fireRate: 0.45, projSpeed: 320,
    splash: 2.2, path: 'missile', level: 4,
    desc: '거대한 포탄으로 광역 폭격.'
  },
  dual4: {
    key: 'dual4', name: '쿼드 Lv.4', icon: '✴', color: '#22c078',
    cost: 400, damage: 13, shots: 4, range: 3.6, fireRate: 2.6, projSpeed: 700,
    path: 'dual', level: 4,
    desc: '네 발 동시 사격.'
  },
  laser5: {
    key: 'laser5', name: '보이드 Lv.5', icon: '✦', color: '#d040ff',
    cost: 700, damage: 22, range: 4.2, fireRate: 10,
    path: 'laser', beam: true, chain: 5, level: 5,
    desc: '공간을 가르는 궁극의 레이저 · 5마리 연쇄.'
  },
  missile5: {
    key: 'missile5', name: '오비탈 Lv.5', icon: '☢', color: '#ff5010',
    cost: 700, damage: 170, range: 4.6, fireRate: 0.45, projSpeed: 300,
    splash: 3.0, path: 'missile', level: 5,
    desc: '궤도에서 낙하하는 초대형 폭발.'
  },
  dual5: {
    key: 'dual5', name: '바라지 Lv.5', icon: '❋', color: '#00d096',
    cost: 700, damage: 18, shots: 5, range: 4.0, fireRate: 3.0, projSpeed: 720,
    path: 'dual', level: 5,
    desc: '다섯 발 초고속 연사.'
  },
};

// Upgrade map: which defs a tower can evolve into
const UPGRADES = {
  basic:    ['laser2', 'missile2', 'dual2'],
  laser2:   ['laser3'],   laser3:   ['laser4'],   laser4:   ['laser5'],   laser5:   [],
  missile2: ['missile3'], missile3: ['missile4'], missile4: ['missile5'], missile5: [],
  dual2:    ['dual3'],    dual3:    ['dual4'],    dual4:    ['dual5'],    dual5:    [],
};

// ============================================================
// Ant kinds (base stats; scale by wave via ensureHp & speed)
// ============================================================
const ANT_KINDS = {
  basic:    { hp: 14,  speed: 55, reward: 6,   r: 7,  color: '#2a1a0f', perWaveHp: 0.03 },
  fast:     { hp:  9,  speed: 92, reward: 7,   r: 6,  color: '#3a2014', perWaveHp: 0.03 },
  tank:     { hp: 46,  speed: 36, reward: 18,  r: 10, color: '#1a0a05', perWaveHp: 0.02 },
  elite:    { hp: 90,  speed: 48, reward: 36,  r: 9,  color: '#4d1f0a', perWaveHp: 0.02 },
  bossMini: { hp: 320, speed: 30, reward: 120, r: 15, color: '#2d0a2a', perWaveHp: 0, isBoss: true, tier: 'mini' },
  bossBig:  { hp: 780, speed: 22, reward: 360, r: 20, color: '#3d0810', perWaveHp: 0, isBoss: true, tier: 'big' },
};

// ============================================================
// Wave composition: list of { kind, count, gap }
// ============================================================
const WAVES = [
  // 1-5: intro (more ants, pressure earlier)
  [{kind:'basic', count:10, gap:0.9}],
  [{kind:'basic', count:14, gap:0.8}, {kind:'fast', count:3, gap:0.6}],
  [{kind:'basic', count:16, gap:0.7}, {kind:'fast', count:6, gap:0.5}],
  [{kind:'basic', count:18, gap:0.65},{kind:'fast', count:8, gap:0.45}],
  [{kind:'basic', count:16, gap:0.55},{kind:'fast', count:10, gap:0.4}, {kind:'tank', count:2, gap:1.0}],
  // 6-10: tanks in force
  [{kind:'basic', count:20, gap:0.5}, {kind:'fast', count:14, gap:0.35},{kind:'tank', count:4, gap:0.95}],
  [{kind:'fast',  count:24, gap:0.3}, {kind:'tank', count:6, gap:0.9}],
  [{kind:'basic', count:22, gap:0.45},{kind:'tank', count:9, gap:0.8}],
  [{kind:'basic', count:26, gap:0.4}, {kind:'fast', count:18, gap:0.32},{kind:'tank', count:7, gap:0.75}],
  [{kind:'fast',  count:30, gap:0.28},{kind:'tank', count:9, gap:0.75},{kind:'elite', count:2, gap:1.1},  {kind:'bossMini', count:1, gap:2.8}],
  // 11-15: elites common
  [{kind:'basic', count:30, gap:0.32},{kind:'fast', count:18, gap:0.3}, {kind:'tank', count:10, gap:0.7}],
  [{kind:'tank',  count:18, gap:0.55},{kind:'fast', count:22, gap:0.28}],
  [{kind:'basic', count:36, gap:0.28},{kind:'tank', count:12, gap:0.55},{kind:'elite', count:4, gap:0.95}],
  [{kind:'fast',  count:40, gap:0.22},{kind:'elite',count:5, gap:0.9}],
  [{kind:'basic', count:34, gap:0.28},{kind:'tank', count:18, gap:0.5}, {kind:'elite', count:5, gap:0.9},  {kind:'bossMini', count:2, gap:2.2}],
  // 16-20: pressure builds
  [{kind:'tank',  count:24, gap:0.45},{kind:'fast', count:26, gap:0.24}],
  [{kind:'basic', count:44, gap:0.22},{kind:'tank', count:16, gap:0.45},{kind:'elite', count:8, gap:0.85}],
  [{kind:'fast',  count:52, gap:0.2}, {kind:'tank', count:20, gap:0.4}, {kind:'elite', count:8, gap:0.75}],
  [{kind:'tank',  count:30, gap:0.4}, {kind:'elite',count:12, gap:0.75}],
  [{kind:'basic', count:50, gap:0.18},{kind:'fast', count:36, gap:0.2}, {kind:'elite', count:10, gap:0.7}, {kind:'bossMini', count:3, gap:1.7}],
  // 21-25: heavy pressure
  [{kind:'fast',  count:60, gap:0.18},{kind:'tank', count:22, gap:0.4}, {kind:'elite', count:10, gap:0.7}],
  [{kind:'tank',  count:36, gap:0.36},{kind:'elite',count:15, gap:0.65}],
  [{kind:'basic', count:60, gap:0.16},{kind:'tank', count:26, gap:0.36},{kind:'elite', count:14, gap:0.65}],
  [{kind:'fast',  count:68, gap:0.16},{kind:'tank', count:28, gap:0.32},{kind:'elite', count:16, gap:0.6}],
  [{kind:'basic', count:52, gap:0.16},{kind:'fast', count:44, gap:0.18},{kind:'tank', count:26, gap:0.32},{kind:'elite', count:14, gap:0.6},  {kind:'bossBig', count:1, gap:2.6}, {kind:'bossMini', count:2, gap:1.7}],
  // 26-30: swarm
  [{kind:'tank',  count:46, gap:0.32},{kind:'elite',count:22, gap:0.6}],
  [{kind:'fast',  count:85, gap:0.12},{kind:'tank', count:32, gap:0.32},{kind:'elite', count:22, gap:0.55}],
  [{kind:'basic', count:80, gap:0.11},{kind:'tank', count:34, gap:0.32},{kind:'elite', count:24, gap:0.55}],
  [{kind:'fast',  count:95, gap:0.1}, {kind:'tank', count:40, gap:0.3}, {kind:'elite', count:24, gap:0.55}],
  [{kind:'tank',  count:55, gap:0.28},{kind:'elite',count:34, gap:0.5}, {kind:'bossBig', count:2, gap:2.4}, {kind:'bossMini', count:2, gap:1.6}],
  // 31-35: brutal
  [{kind:'basic', count:110,gap:0.09},{kind:'fast', count:72, gap:0.1}, {kind:'elite', count:32, gap:0.5}],
  [{kind:'fast',  count:120,gap:0.09},{kind:'tank', count:50, gap:0.28},{kind:'elite', count:32, gap:0.5}],
  [{kind:'tank',  count:72, gap:0.24},{kind:'elite',count:40, gap:0.45}],
  [{kind:'basic', count:120,gap:0.08},{kind:'fast', count:85, gap:0.09},{kind:'elite', count:40, gap:0.45}],
  [{kind:'elite', count:55, gap:0.4}, {kind:'bossBig',count:3, gap:2.2},{kind:'bossMini', count:3, gap:1.5}],
  // 36-40: final storm
  [{kind:'tank',  count:80, gap:0.22},{kind:'elite',count:52, gap:0.42}],
  [{kind:'fast',  count:160,gap:0.065},{kind:'elite',count:50, gap:0.42}],
  [{kind:'basic', count:150,gap:0.065},{kind:'fast', count:90, gap:0.08},{kind:'tank', count:62, gap:0.2}, {kind:'elite', count:52, gap:0.42}],
  [{kind:'elite', count:80, gap:0.38},{kind:'tank', count:72, gap:0.18},{kind:'bossMini', count:4, gap:1.5}],
  [{kind:'basic', count:110,gap:0.065},{kind:'fast', count:110,gap:0.065},{kind:'tank', count:80, gap:0.18},{kind:'elite', count:72, gap:0.36},{kind:'bossBig', count:8, gap:1.3}],
];
