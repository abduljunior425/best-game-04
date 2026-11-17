// combat.js — damage rolls and enemy turns for Glimmerdeep.
// Pure functions over plain state: no DOM, no canvas, so the same code runs
// in the browser and in a Node simulation harness.

import { isWalkable } from './dungeon.js';

// Damage of one hit: base attack plus a small deterministic swing.
export function rollDamage(rng, atk) {
  return atk + rng.int(0, 1);
}

export function manhattan(ax, ay, bx, by) {
  return Math.abs(ax - bx) + Math.abs(ay - by);
}

// One enemy's move. It chases the player when close, wanders when far, and
// attacks when adjacent. Returns 'attack' | 'move' | 'wait' plus details.
export function enemyStep(rng, level, enemy, player, occupied) {
  const dist = manhattan(enemy.x, enemy.y, player.x, player.y);
  if (dist === 1) {
    const dmg = rollDamage(rng, enemy.atk);
    player.hp -= dmg;
    return { action: 'attack', damage: dmg, from: enemy };
  }
  // Chase inside a radius of 6, else wander one step.
  const moves = [
    { x: 0, y: -1 },
    { x: 0, y: 1 },
    { x: -1, y: 0 },
    { x: 1, y: 0 },
  ];
  let options = [];
  if (dist <= 6) {
    let best = dist;
    for (const m of moves) {
      const nx = enemy.x + m.x;
      const ny = enemy.y + m.y;
      if (!isWalkable(level, nx, ny)) continue;
      if (occupied(nx, ny)) continue;
      const d = manhattan(nx, ny, player.x, player.y);
      if (d < best) {
        best = d;
        options = [{ x: nx, y: ny }];
      } else if (d === best && options.length === 0) {
        options = [{ x: nx, y: ny }];
      }
    }
    // No strictly-better step: sidestep along the chase instead of freezing.
    if (options.length === 0) {
      for (const m of moves) {
        const nx = enemy.x + m.x;
        const ny = enemy.y + m.y;
        if (!isWalkable(level, nx, ny)) continue;
        if (occupied(nx, ny)) continue;
        if (manhattan(nx, ny, player.x, player.y) <= dist) options.push({ x: nx, y: ny });
      }
    }
  } else {
    for (const m of moves) {
      const nx = enemy.x + m.x;
      const ny = enemy.y + m.y;
      if (!isWalkable(level, nx, ny)) continue;
      if (occupied(nx, ny)) continue;
      options.push({ x: nx, y: ny });
    }
  }
  if (options.length === 0) return { action: 'wait', from: enemy };
  const step = options[Math.floor(rng.float() * options.length)];
  enemy.x = step.x;
  enemy.y = step.y;
  return { action: 'move', from: enemy };
}
