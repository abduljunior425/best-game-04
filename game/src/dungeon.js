// dungeon.js — procedural floor generation for Glimmerdeep.
// A floor is a grid of walls and floors carved from a few rectangular rooms
// joined by corridors. Generation is pure: same (seed, floor) in, same map out.

export const TILE_WALL = 0;
export const TILE_FLOOR = 1;
export const TILE_STAIRS = 2;

export const FLOOR_W = 26;
export const FLOOR_H = 18;

// Enemy kinds, keyed by floor depth. Stats scale with the floor number.
export const ENEMY_KINDS = {
  mite: { name: 'Cave Mite', hp: 3, atk: 1, xp: 8, gold: 3, glyph: 'm', color: '#9fb4c7' },
  wisp: { name: 'Gloom Wisp', hp: 5, atk: 2, xp: 12, gold: 5, glyph: 'w', color: '#b78cff' },
  brute: { name: 'Stone Brute', hp: 9, atk: 3, xp: 20, gold: 8, glyph: 'B', color: '#e08a4c' },
  warden: { name: 'Gloomwarden', hp: 36, atk: 4, xp: 0, gold: 60, glyph: 'W', color: '#ff5d6c' },
};

function roomTable(rng, floor) {
  // Which enemies may appear on this floor, with weights.
  if (floor === 1) return [['mite', 3], ['wisp', 1]];
  if (floor === 2) return [['mite', 2], ['wisp', 2], ['brute', 1]];
  if (floor === 3) return [['mite', 1], ['wisp', 2], ['brute', 2]];
  if (floor === 4) return [['wisp', 2], ['brute', 3]];
  return [['brute', 3], ['wisp', 2]];
}

function weightedPick(rng, table) {
  let total = 0;
  for (const [, w] of table) total += w;
  let roll = rng.float() * total;
  for (const [kind, w] of table) {
    roll -= w;
    if (roll <= 0) return kind;
  }
  return table[table.length - 1][0];
}

export function generateFloor(rng, floor, isLast) {
  const tiles = new Uint8Array(FLOOR_W * FLOOR_H); // all wall
  const rooms = [];
  const roomCount = rng.int(5, 7);

  for (let tries = 0; tries < 60 && rooms.length < roomCount; tries++) {
    const w = rng.int(4, 7);
    const h = rng.int(3, 5);
    const x = rng.int(1, FLOOR_W - w - 1);
    const y = rng.int(1, FLOOR_H - h - 1);
    let overlap = false;
    for (const r of rooms) {
      if (x < r.x + r.w + 1 && x + w + 1 > r.x && y < r.y + r.h + 1 && y + h + 1 > r.y) {
        overlap = true;
        break;
      }
    }
    if (overlap) continue;
    rooms.push({ x, y, w, h });
    for (let yy = y; yy < y + h; yy++) {
      for (let xx = x; xx < x + w; xx++) tiles[yy * FLOOR_W + xx] = TILE_FLOOR;
    }
  }

  // Corridors join rooms in the order they were carved.
  for (let i = 1; i < rooms.length; i++) {
    const a = rooms[i - 1];
    const b = rooms[i];
    let cx = a.x + Math.floor(a.w / 2);
    let cy = a.y + Math.floor(a.h / 2);
    const tx = b.x + Math.floor(b.w / 2);
    const ty = b.y + Math.floor(b.h / 2);
    while (cx !== tx) {
      tiles[cy * FLOOR_W + cx] = TILE_FLOOR;
      cx += Math.sign(tx - cx);
    }
    while (cy !== ty) {
      tiles[cy * FLOOR_W + cx] = TILE_FLOOR;
      cy += Math.sign(ty - cy);
    }
    tiles[cy * FLOOR_W + cx] = TILE_FLOOR;
  }

  const at = (x, y) => tiles[y * FLOOR_W + x];
  const freeTiles = [];
  for (let y = 1; y < FLOOR_H - 1; y++) {
    for (let x = 1; x < FLOOR_W - 1; x++) {
      if (at(x, y) === TILE_FLOOR) freeTiles.push({ x, y });
    }
  }
  rng.shuffle(freeTiles);

  const spawn = freeTiles.pop();
  const stairs = isLast ? null : freeTiles.pop();
  if (stairs) tiles[stairs.y * FLOOR_W + stairs.x] = TILE_STAIRS;

  // Pickups: gold coins, hearts, lantern oil, potions.
  const items = [];
  const itemCount = rng.int(6, 9);
  for (let i = 0; i < itemCount && freeTiles.length; i++) {
    const t = freeTiles.pop();
    const roll = rng.float();
    const kind = roll < 0.45 ? 'gold' : roll < 0.62 ? 'heart' : roll < 0.75 ? 'oil' : 'potion';
    items.push({ kind, x: t.x, y: t.y, value: kind === 'gold' ? rng.int(3, 9) : 0 });
  }

  // Enemies, spread over the floor, never on the spawn tile.
  const enemies = [];
  const table = roomTable(rng, floor);
  const enemyCount = isLast ? 4 : 3 + floor;
  for (let i = 0; i < enemyCount && freeTiles.length; i++) {
    const t = freeTiles.pop();
    const kind = weightedPick(rng, table);
    const base = ENEMY_KINDS[kind];
    enemies.push({
      kind,
      name: base.name,
      glyph: base.glyph,
      color: base.color,
      x: t.x,
      y: t.y,
      hp: base.hp + (floor - 1),
      maxHp: base.hp + (floor - 1),
      atk: base.atk + Math.floor((floor - 1) / 2),
      xp: base.xp,
      gold: base.gold,
    });
  }
  if (isLast && freeTiles.length) {
    const t = freeTiles.pop();
    const base = ENEMY_KINDS.warden;
    enemies.push({
      kind: 'warden',
      name: base.name,
      glyph: base.glyph,
      color: base.color,
      x: t.x,
      y: t.y,
      hp: base.hp,
      maxHp: base.hp,
      atk: base.atk,
      xp: 0,
      gold: base.gold,
    });
  }

  return { floor, tiles, rooms, spawn, stairs, items, enemies };
}

export function tileAt(level, x, y) {
  if (x < 0 || y < 0 || x >= FLOOR_W || y >= FLOOR_H) return TILE_WALL;
  return level.tiles[y * FLOOR_W + x];
}

export function isWalkable(level, x, y) {
  const t = tileAt(level, x, y);
  return t === TILE_FLOOR || t === TILE_STAIRS;
}
