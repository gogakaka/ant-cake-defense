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
  gridLine: 'rgba(60, 74, 120, 0.12)',
  gridEven: '#dde3f0',
  gridOdd: '#e4e9f3',
  nestRing: '#5a3c20',
  nestPit: '#1a0f08',
  cakeBase: '#f4c2c2',
  cakeTop: '#fff5f0',
  cakeShadow: '#b08080',
  cakeCherry: '#d94a4a',
  antBody: '#2a1a0f',
  antAccent: '#6b3f1f',
  pathPreview: 'rgba(60, 74, 120, 0.06)',
  rangeOk: 'rgba(47, 174, 116, 0.18)',
  rangeOkBorder: 'rgba(47, 174, 116, 0.6)',
  rangeBad: 'rgba(224, 88, 90, 0.18)',
  rangeBadBorder: 'rgba(224, 88, 90, 0.6)',
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
  // Sniper path — long range, high damage, slow fire
  sniper2: {
    key: 'sniper2', name: '저격 Lv.2', icon: '◎', color: '#5ad4e0',
    cost: 100, damage: 28, range: 4.8, fireRate: 0.45, projSpeed: 1200,
    path: 'sniper', level: 2,
    desc: '장거리 단발 저격 · 긴 재장전.'
  },
  sniper3: {
    key: 'sniper3', name: '대물저격 Lv.3', icon: '◎', color: '#3d9cd8',
    cost: 200, damage: 70, range: 5.4, fireRate: 0.5, projSpeed: 1300,
    path: 'sniper', level: 3,
    desc: '더 먼 거리에서 정밀 사격.'
  },
  sniper4: {
    key: 'sniper4', name: '레일건 Lv.4', icon: '◎', color: '#1e63d0',
    cost: 400, damage: 150, range: 6.2, fireRate: 0.55, projSpeed: 1500,
    path: 'sniper', level: 4,
    desc: '전자기로 가속된 초고속 탄환.'
  },
  sniper5: {
    key: 'sniper5', name: '광자포 Lv.5', icon: '◎', color: '#7b2cff',
    cost: 700, damage: 320, range: 7.2, fireRate: 0.65, projSpeed: 1800,
    path: 'sniper', level: 5,
    desc: '맵 대각선 끝까지 닿는 광속 포격.'
  },
  // Ice path — passive AOE slow + weak tick damage. No projectiles.
  ice2: {
    key: 'ice2', name: '얼음 Lv.2', icon: '❄', color: '#a7d8ea',
    cost: 100, damage: 3, range: 2.6, fireRate: 0, projSpeed: 0,
    path: 'ice', level: 2, aura: true, slowFactor: 0.7,
    desc: '주변 적 30% 둔화 + 초당 약한 피해.'
  },
  ice3: {
    key: 'ice3', name: '서리 Lv.3', icon: '❄', color: '#68bde4',
    cost: 200, damage: 5, range: 2.9, fireRate: 0, projSpeed: 0,
    path: 'ice', level: 3, aura: true, slowFactor: 0.55,
    desc: '45% 둔화 + 지속 피해 증가.'
  },
  ice4: {
    key: 'ice4', name: '빙결 Lv.4', icon: '❄', color: '#3b9ade',
    cost: 400, damage: 8, range: 3.2, fireRate: 0, projSpeed: 0,
    path: 'ice', level: 4, aura: true, slowFactor: 0.4,
    desc: '60% 둔화 · 넓은 범위.'
  },
  ice5: {
    key: 'ice5', name: '절대영도 Lv.5', icon: '❄', color: '#1e6ed4',
    cost: 700, damage: 12, range: 3.7, fireRate: 0, projSpeed: 0,
    path: 'ice', level: 5, aura: true, slowFactor: 0.28,
    desc: '72% 둔화 · 얼어붙을 지경.'
  },
  // Aura path — support. No damage. Boosts nearby towers.
  aura2: {
    key: 'aura2', name: '지휘소 Lv.2', icon: '✺', color: '#ffdb66',
    cost: 100, damage: 0, range: 2.6, fireRate: 0,
    path: 'aura', level: 2, support: true, buffDmg: 0.12, buffRate: 0.12,
    desc: '주변 타워 데미지·연사 +12%.'
  },
  aura3: {
    key: 'aura3', name: '지휘본부 Lv.3', icon: '✺', color: '#ffc831',
    cost: 200, damage: 0, range: 2.9, fireRate: 0,
    path: 'aura', level: 3, support: true, buffDmg: 0.22, buffRate: 0.22,
    desc: '주변 타워 데미지·연사 +22%.'
  },
  aura4: {
    key: 'aura4', name: '전략기지 Lv.4', icon: '✺', color: '#f5a200',
    cost: 400, damage: 0, range: 3.2, fireRate: 0,
    path: 'aura', level: 4, support: true, buffDmg: 0.32, buffRate: 0.32,
    desc: '주변 타워 데미지·연사 +32%.'
  },
  aura5: {
    key: 'aura5', name: '최고사령부 Lv.5', icon: '✺', color: '#e67400',
    cost: 700, damage: 0, range: 3.5, fireRate: 0,
    path: 'aura', level: 5, support: true, buffDmg: 0.48, buffRate: 0.48,
    desc: '주변 타워 데미지·연사 +48%.'
  },
  // Flame path — very short range, very high tick damage, no slow.
  flame2: {
    key: 'flame2', name: '화염 Lv.2', icon: '🔥', color: '#ff8240',
    cost: 100, damage: 18, range: 1.8, fireRate: 0, projSpeed: 0,
    path: 'flame', level: 2, aura: true, slowFactor: 1,
    desc: '짧은 사거리 · 초당 강력한 피해.'
  },
  flame3: {
    key: 'flame3', name: '불꽃 Lv.3', icon: '🔥', color: '#ff5a16',
    cost: 200, damage: 36, range: 2.0, fireRate: 0, projSpeed: 0,
    path: 'flame', level: 3, aura: true, slowFactor: 1,
    desc: '더 뜨거운 화염.'
  },
  flame4: {
    key: 'flame4', name: '용광로 Lv.4', icon: '🔥', color: '#e03818',
    cost: 400, damage: 66, range: 2.2, fireRate: 0, projSpeed: 0,
    path: 'flame', level: 4, aura: true, slowFactor: 1,
    desc: '근거리 광역 섬멸.'
  },
  flame5: {
    key: 'flame5', name: '지옥불 Lv.5', icon: '🔥', color: '#b81018',
    cost: 700, damage: 120, range: 2.5, fireRate: 0, projSpeed: 0,
    path: 'flame', level: 5, aura: true, slowFactor: 1,
    desc: '지나가는 모든 것을 태움.'
  },
  // Bank path — no attack, passively generates credits.
  bank2: {
    key: 'bank2', name: '금광 Lv.2', icon: '💰', color: '#ffd860',
    cost: 100, damage: 0, range: 0, fireRate: 0,
    path: 'bank', level: 2, bank: true, bankRate: 1.0,
    desc: '초당 +1 크레딧 자동 생성.'
  },
  bank3: {
    key: 'bank3', name: '금고 Lv.3', icon: '💰', color: '#f5b200',
    cost: 200, damage: 0, range: 0, fireRate: 0,
    path: 'bank', level: 3, bank: true, bankRate: 2.5,
    desc: '초당 +2.5 크레딧.'
  },
  bank4: {
    key: 'bank4', name: '조폐국 Lv.4', icon: '💰', color: '#e08800',
    cost: 400, damage: 0, range: 0, fireRate: 0,
    path: 'bank', level: 4, bank: true, bankRate: 5.0,
    desc: '초당 +5 크레딧.'
  },
  bank5: {
    key: 'bank5', name: '왕립조폐국 Lv.5', icon: '💰', color: '#c06000',
    cost: 700, damage: 0, range: 0, fireRate: 0,
    path: 'bank', level: 5, bank: true, bankRate: 9.0,
    desc: '초당 +9 크레딧.'
  },
};

// Upgrade map: which defs a tower can evolve into
const UPGRADES = {
  basic:    ['laser2', 'missile2', 'dual2', 'sniper2', 'ice2', 'flame2', 'aura2', 'bank2'],
  laser2:   ['laser3'],   laser3:   ['laser4'],   laser4:   ['laser5'],   laser5:   [],
  missile2: ['missile3'], missile3: ['missile4'], missile4: ['missile5'], missile5: [],
  dual2:    ['dual3'],    dual3:    ['dual4'],    dual4:    ['dual5'],    dual5:    [],
  sniper2:  ['sniper3'],  sniper3:  ['sniper4'],  sniper4:  ['sniper5'],  sniper5:  [],
  ice2:     ['ice3'],     ice3:     ['ice4'],     ice4:     ['ice5'],     ice5:     [],
  flame2:   ['flame3'],   flame3:   ['flame4'],   flame4:   ['flame5'],   flame5:   [],
  aura2:    ['aura3'],    aura3:    ['aura4'],    aura4:    ['aura5'],    aura5:    [],
  bank2:    ['bank3'],    bank3:    ['bank4'],    bank4:    ['bank5'],    bank5:    [],
};

// ============================================================
// Ant kinds (base stats; scale by wave via ensureHp & speed)
// ============================================================
const ANT_KINDS = {
  basic:    { hp: 14,  speed: 55, reward: 3,   r: 7,  color: '#2a1a0f', perWaveHp: 0.04 },
  fast:     { hp:  9,  speed: 92, reward: 3,   r: 6,  color: '#3a2014', perWaveHp: 0.03 },
  tank:     { hp: 46,  speed: 36, reward: 9,   r: 10, color: '#1a0a05', perWaveHp: 0.025 },
  elite:    { hp: 90,  speed: 48, reward: 18,  r: 9,  color: '#4d1f0a', perWaveHp: 0.025 },
  bossMini: { hp: 320, speed: 30, reward: 60,  r: 15, color: '#2d0a2a', perWaveHp: 0, isBoss: true, tier: 'mini' },
  bossBig:  { hp: 780, speed: 22, reward: 180, r: 20, color: '#3d0810', perWaveHp: 0, isBoss: true, tier: 'big' },
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
  // 41-50: beyond-limit
  [{kind:'tank',  count:60, gap:0.22},{kind:'elite',count:50, gap:0.4}, {kind:'bossMini',count:3, gap:1.5}],
  [{kind:'fast',  count:160,gap:0.06},{kind:'elite',count:55, gap:0.4}, {kind:'bossMini',count:4, gap:1.4}],
  [{kind:'basic', count:140,gap:0.06},{kind:'tank', count:70, gap:0.2}, {kind:'elite', count:60, gap:0.4}, {kind:'bossBig', count:2, gap:1.8}],
  [{kind:'tank',  count:90, gap:0.2}, {kind:'elite',count:80, gap:0.38},{kind:'bossBig', count:3, gap:1.6}],
  [{kind:'fast',  count:180,gap:0.055},{kind:'tank',count:80, gap:0.2}, {kind:'elite', count:80, gap:0.38},{kind:'bossBig', count:3, gap:1.5}, {kind:'bossMini',count:4, gap:1.3}],
  [{kind:'tank',  count:100,gap:0.18},{kind:'elite',count:90, gap:0.36},{kind:'bossBig', count:4, gap:1.4}],
  [{kind:'fast',  count:200,gap:0.05},{kind:'elite',count:95, gap:0.35},{kind:'bossBig', count:4, gap:1.4}],
  [{kind:'basic', count:150,gap:0.05},{kind:'fast', count:110,gap:0.06},{kind:'elite', count:100,gap:0.35},{kind:'bossBig', count:5, gap:1.3}],
  [{kind:'tank',  count:120,gap:0.16},{kind:'elite',count:120,gap:0.34},{kind:'bossBig', count:6, gap:1.3}],
  [{kind:'basic', count:140,gap:0.05},{kind:'fast', count:140,gap:0.05},{kind:'tank', count:100,gap:0.17},{kind:'elite', count:90, gap:0.32},{kind:'bossBig', count:10,gap:1.2}],
  // 51-60: relentless
  [{kind:'elite', count:130,gap:0.3}, {kind:'bossBig',count:5,gap:1.3}, {kind:'bossMini',count:6, gap:1.2}],
  [{kind:'tank',  count:130,gap:0.15},{kind:'elite',count:120,gap:0.3}, {kind:'bossBig', count:7, gap:1.2}],
  [{kind:'fast',  count:260,gap:0.045},{kind:'elite',count:140,gap:0.3},{kind:'bossBig', count:8, gap:1.2}],
  [{kind:'basic', count:220,gap:0.045},{kind:'tank',count:140,gap:0.15},{kind:'bossBig', count:8, gap:1.2}],
  [{kind:'fast',  count:280,gap:0.04},{kind:'tank', count:150,gap:0.14},{kind:'elite', count:140,gap:0.28},{kind:'bossBig', count:10,gap:1.15},{kind:'bossMini',count:6, gap:1.1}],
  [{kind:'tank',  count:160,gap:0.13},{kind:'elite',count:160,gap:0.28},{kind:'bossBig', count:10,gap:1.1}],
  [{kind:'basic', count:260,gap:0.04},{kind:'fast', count:200,gap:0.045},{kind:'bossBig', count:12,gap:1.1}],
  [{kind:'tank',  count:180,gap:0.12},{kind:'elite',count:180,gap:0.26},{kind:'bossBig', count:12,gap:1.1}],
  [{kind:'fast',  count:320,gap:0.04},{kind:'elite',count:200,gap:0.26},{kind:'bossBig', count:14,gap:1.05}],
  [{kind:'basic', count:240,gap:0.04},{kind:'fast', count:220,gap:0.04},{kind:'tank', count:200,gap:0.12},{kind:'elite', count:180,gap:0.25},{kind:'bossBig', count:16,gap:1.0}, {kind:'bossMini',count:10,gap:1.0}],
  // 61-70: apocalypse
  [{kind:'elite', count:220,gap:0.24},{kind:'bossBig', count:18,gap:1.0}],
  [{kind:'tank',  count:220,gap:0.11},{kind:'bossBig', count:22,gap:0.95}],
  [{kind:'fast',  count:400,gap:0.035},{kind:'elite',count:220,gap:0.22},{kind:'bossBig', count:20,gap:0.95}],
  [{kind:'basic', count:320,gap:0.035},{kind:'fast',count:260,gap:0.038},{kind:'tank', count:220,gap:0.11},{kind:'bossBig', count:22,gap:0.9}],
  [{kind:'tank',  count:260,gap:0.1}, {kind:'elite',count:260,gap:0.22},{kind:'bossBig', count:26,gap:0.9}],
  [{kind:'elite', count:320,gap:0.2}, {kind:'bossBig', count:28,gap:0.85}],
  [{kind:'fast',  count:500,gap:0.03},{kind:'elite',count:280,gap:0.2}, {kind:'bossBig', count:28,gap:0.85}],
  [{kind:'tank',  count:320,gap:0.1}, {kind:'elite',count:320,gap:0.2}, {kind:'bossBig', count:32,gap:0.8}],
  [{kind:'basic', count:420,gap:0.03},{kind:'fast', count:320,gap:0.035},{kind:'tank', count:280,gap:0.1}, {kind:'elite', count:280,gap:0.18},{kind:'bossBig', count:32,gap:0.8}],
  [{kind:'basic', count:300,gap:0.03},{kind:'fast', count:320,gap:0.03},{kind:'tank', count:280,gap:0.1}, {kind:'elite', count:280,gap:0.18},{kind:'bossBig', count:50,gap:0.75},{kind:'bossMini',count:20,gap:0.9}],
];
