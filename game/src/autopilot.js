// autopilot.js — a deterministic greedy player for Glimmerdeep.
// Used by shots.js to stage real gameplay for screenshots, and by the Node
// simulation harness to prove the game is winnable and losable. It only uses
// the game's public actions, exactly as a human player would.

import { isWalkable, TILE_STAIRS, FLOOR_W } from './dungeon.js';
import { manhattan } from './combat.js';

// Breadth-first path from the player to the nearest tile matching `goal`.
// Enemy tiles count as walkable (stepping on one attacks). Returns the first
// step {dx, dy} or null when no path exists.
function bfsStep(game, goal) {
  const level = game.level;
  const start = { x: game.player.x, y: game.player.y };
  const key = (x, y) => `${x},${y}`;
  const prev = new Map();
  const queue = [start];
  prev.set(key(start.x, start.y), null);
  let found = null;
  while (queue.length) {
    const cur = queue.shift();
    if (goal(cur.x, cur.y) && !(cur.x === start.x && cur.y === start.y)) {
      found = cur;
      break;
    }
    for (const [dx, dy] of [[0, -1], [0, 1], [-1, 0], [1, 0]]) {
      const nx = cur.x + dx;
      const ny = cur.y + dy;
      if (!isWalkable(level, nx, ny)) continue;
      if (prev.has(key(nx, ny))) continue;
      prev.set(key(nx, ny), cur);
      queue.push({ x: nx, y: ny });
    }
  }
  if (!found) return null;
  let cur = found;
  while (prev.get(key(cur.x, cur.y)) && !(prev.get(key(cur.x, cur.y)).x === start.x && prev.get(key(cur.x, cur.y)).y === start.y)) {
    cur = prev.get(key(cur.x, cur.y));
  }
  return { dx: cur.x - start.x, dy: cur.y - start.y };
}

// Dijkstra path that prefers quiet tiles: stepping next to a monster costs
// extra, stepping on one costs a lot, so the careful player sneaks around
// fights instead of walking through them. Tiles the player just left cost
// extra too, which breaks the back-and-forth loops a greedy re-plan can fall
// into as monsters move. Returns the first step or null.
const recentTrails = new WeakMap();
function trailFor(game) {
  let trail = recentTrails.get(game);
  if (!trail) {
    trail = [];
    recentTrails.set(game, trail);
  }
  return trail;
}

function sneakStep(game, goal) {
  const level = game.level;
  const start = { x: game.player.x, y: game.player.y };
  const key = (x, y) => `${x},${y}`;
  const trail = trailFor(game);
  trail.push(key(start.x, start.y));
  if (trail.length > 8) trail.shift();
  const recent = new Set(trail);
  const dist = new Map([[key(start.x, start.y), 0]]);
  const prev = new Map([[key(start.x, start.y), null]]);
  const open = [start];
  let found = null;
  while (open.length) {
    // Cheapest node first (small maps: linear scan is fine).
    let bi = 0;
    for (let i = 1; i < open.length; i++) {
      if (dist.get(key(open[i].x, open[i].y)) < dist.get(key(open[bi].x, open[bi].y))) bi = i;
    }
    const cur = open.splice(bi, 1)[0];
    if (goal(cur.x, cur.y) && !(cur.x === start.x && cur.y === start.y)) {
      found = cur;
      break;
    }
    for (const [dx, dy] of [[0, -1], [0, 1], [-1, 0], [1, 0]]) {
      const nx = cur.x + dx;
      const ny = cur.y + dy;
      if (!isWalkable(level, nx, ny)) continue;
      let cost = 1;
      if (recent.has(key(nx, ny))) cost += 20;
      const foe = game.enemyAt(nx, ny);
      if (foe) cost += 40;
      else {
        for (const [ax, ay] of [[0, -1], [0, 1], [-1, 0], [1, 0]]) {
          if (game.enemyAt(nx + ax, ny + ay)) {
            cost += 6;
            break;
          }
        }
      }
      const nd = dist.get(key(cur.x, cur.y)) + cost;
      if (dist.has(key(nx, ny)) && dist.get(key(nx, ny)) <= nd) continue;
      dist.set(key(nx, ny), nd);
      prev.set(key(nx, ny), cur);
      open.push({ x: nx, y: ny });
    }
  }
  if (!found) return null;
  let cur = found;
  while (prev.get(key(cur.x, cur.y)) && !(prev.get(key(cur.x, cur.y)).x === start.x && prev.get(key(cur.x, cur.y)).y === start.y)) {
    cur = prev.get(key(cur.x, cur.y));
  }
  return { dx: cur.x - start.x, dy: cur.y - start.y };
}

function adjacentFoe(game) {
  for (const [dx, dy] of [[0, -1], [0, 1], [-1, 0], [1, 0]]) {
    const foe = game.enemyAt(game.player.x + dx, game.player.y + dy);
    if (foe) return { dx, dy };
  }
  return null;
}

// One turn of the careful autopilot: heal when hurt, flee when cornered and
// out of potions, fight adjacent foes, otherwise walk to the stairs (or to
// the Gloomwarden on the last floor).
export function carefulStep(game) {
  const p = game.player;
  if (p.potions > 0 && p.hp <= p.maxHp * 0.5) return { action: 'potion' };
  const foe = adjacentFoe(game);
  if (foe) {
    const killable = foe.hp <= p.atk + 1;
    const lethal = foe.atk + 1 >= p.hp;
    if (lethal && !killable && p.potions === 0) {
      // Flee: step to the free tile farthest from the nearest enemy,
      // preferring steps that also close in on the stairs.
      const stairs = game.level.stairs;
      let bestStep = null;
      let bestScore = -Infinity;
      for (const [dx, dy] of [[0, -1], [0, 1], [-1, 0], [1, 0]]) {
        const nx = p.x + dx;
        const ny = p.y + dy;
        if (!isWalkable(game.level, nx, ny)) continue;
        if (game.enemyAt(nx, ny)) continue;
        let nearest = Infinity;
        for (const e of game.level.enemies) {
          nearest = Math.min(nearest, manhattan(nx, ny, e.x, e.y));
        }
        const toStairs = stairs ? manhattan(nx, ny, stairs.x, stairs.y) : 0;
        const score = nearest * 3 - toStairs;
        if (score > bestScore) {
          bestScore = score;
          bestStep = { dx, dy };
        }
      }
      if (bestStep) return { action: 'move', ...bestStep };
    }
    return { action: 'move', dx: foe.dx, dy: foe.dy };
  }
  // Hurt and safe: rest a turn to mend before pressing on.
  const foeNear = game.level.enemies.some((e) => manhattan(e.x, e.y, p.x, p.y) <= 2);
  if (p.hp < p.maxHp * 0.5 && !foeNear) return { action: 'wait' };
  const warden = game.level.enemies.find((e) => e.kind === 'warden');
  if (warden) {
    const step = sneakStep(game, (x, y) => x === warden.x && y === warden.y);
    if (step) return { action: 'move', ...step };
  }
  const step = sneakStep(game, (x, y) => {
    const t = game.level.tiles[y * FLOOR_W + x];
    return t === TILE_STAIRS;
  });
  if (step) return { action: 'move', ...step };
  return { action: 'wait' };
}

// One turn of the reckless autopilot: never heals, hunts the nearest enemy,
// walks into danger. Used to stage a real loss.
export function recklessStep(game) {
  const foe = adjacentFoe(game);
  if (foe) return { action: 'move', dx: foe.dx, dy: foe.dy };
  let nearest = null;
  let best = Infinity;
  for (const e of game.level.enemies) {
    const d = manhattan(e.x, e.y, game.player.x, game.player.y);
    if (d < best) {
      best = d;
      nearest = e;
    }
  }
  if (nearest) {
    const step = bfsStep(game, (x, y) => x === nearest.x && y === nearest.y);
    if (step) return { action: 'move', ...step };
  }
  const step = bfsStep(game, (x, y) => game.level.tiles[y * FLOOR_W + x] === TILE_STAIRS);
  if (step) return { action: 'move', ...step };
  return { action: 'wait' };
}

// Drive the game with a step function until `done(game)` or maxTurns.
// Returns the number of turns played.
export function playUntil(game, stepFn, done, maxTurns = 4000) {
  let turns = 0;
  while (!done(game) && turns < maxTurns) {
    const step = stepFn(game);
    if (step.action === 'potion') game.drinkPotion();
    else if (step.action === 'move') game.movePlayer(step.dx, step.dy);
    else game.waitTurn();
    turns++;
  }
  return turns;
}
