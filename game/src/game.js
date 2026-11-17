// game.js — the Glimmerdeep game state machine.
// One Game owns the player, the current floor, the log and the score. Every
// rule lives here: moving, bumping to attack, pickups, stairs, levelling,
// winning on floor 5 and losing at 0 HP. Input and rendering stay outside.

import { Rng } from './rng.js';
import { generateFloor, tileAt, TILE_STAIRS, TILE_WALL } from './dungeon.js';
import { enemyStep, rollDamage, manhattan } from './combat.js';

export const MAX_FLOOR = 5;
export const XP_PER_LEVEL = 25;
export const START_HP = 24;
export const START_LIGHT = 5;

export const PHASE_TITLE = 'title';
export const PHASE_PLAY = 'play';
export const PHASE_WIN = 'win';
export const PHASE_LOSE = 'lose';

export class Game {
  constructor(seed = 1) {
    this.seed = seed;
    this.rng = new Rng(seed);
    this.phase = PHASE_TITLE;
    this.floor = 1;
    this.turn = 0;
    this.kills = 0;
    this.gold = 0;
    this.score = 0;
    this.log = [];
    this.player = null;
    this.level = null;
    this.message = '';
    this.lastEvents = [];
    this.startRun();
  }

  startRun() {
    this.phase = PHASE_PLAY;
    this.floor = 1;
    this.turn = 0;
    this.kills = 0;
    this.gold = 0;
    this.score = 0;
    this.log = [];
    this.player = {
      x: 0,
      y: 0,
      hp: START_HP,
      maxHp: START_HP,
      atk: 5,
      level: 1,
      xp: 0,
      potions: 1,
      light: START_LIGHT,
      oil: 0,
    };
    this.loadFloor(1);
    this.say('You enter Glimmerdeep, lantern in hand. Find the stairs down.');
  }

  loadFloor(floor) {
    this.level = generateFloor(this.rng, floor, floor === MAX_FLOOR);
    this.player.x = this.level.spawn.x;
    this.player.y = this.level.spawn.y;
    if (floor > 1) this.say(`Floor ${floor}. The dark grows thicker.`);
  }

  say(text) {
    this.log.unshift(text);
    if (this.log.length > 5) this.log.length = 5;
  }

  enemyAt(x, y) {
    return this.level.enemies.find((e) => e.x === x && e.y === y) || null;
  }

  // Try to move the player by (dx, dy). A bump attacks instead of moving.
  // Returns false when the move was illegal (wall); true otherwise, and an
  // enemy turn always follows a legal player action.
  movePlayer(dx, dy) {
    if (this.phase !== PHASE_PLAY) return false;
    const nx = this.player.x + dx;
    const ny = this.player.y + dy;
    if (tileAt(this.level, nx, ny) === TILE_WALL) {
      this.message = 'A cold stone wall.';
      return false;
    }
    const foe = this.enemyAt(nx, ny);
    this.lastEvents = [];
    if (foe) {
      const dmg = rollDamage(this.rng, this.player.atk);
      foe.hp -= dmg;
      this.lastEvents.push({ type: 'hit', x: nx, y: ny, damage: dmg });
      this.say(`You strike the ${foe.name} for ${dmg}.`);
      if (foe.hp <= 0) this.killEnemy(foe);
    } else {
      this.player.x = nx;
      this.player.y = ny;
      this.collectPickup();
      if (tileAt(this.level, nx, ny) === TILE_STAIRS) {
        this.descend();
        return true;
      }
    }
    this.endPlayerTurn();
    return true;
  }

  killEnemy(foe) {
    this.level.enemies = this.level.enemies.filter((e) => e !== foe);
    this.kills += 1;
    this.gold += foe.gold;
    this.score += 10 + foe.gold;
    this.player.xp += foe.xp;
    this.say(`The ${foe.name} falls! +${foe.gold} gold, +${foe.xp} xp.`);
    this.lastEvents.push({ type: 'kill', x: foe.x, y: foe.y });
    if (foe.kind === 'warden') {
      this.winRun();
      return;
    }
    if (this.player.xp >= this.player.level * XP_PER_LEVEL) this.levelUp();
  }

  levelUp() {
    this.player.level += 1;
    this.player.xp -= (this.player.level - 1) * XP_PER_LEVEL;
    this.player.maxHp += 5;
    this.player.hp = Math.min(this.player.maxHp, this.player.hp + 5);
    this.player.atk += 2;
    this.say(`Level ${this.player.level}! +5 max HP, +2 attack.`);
    this.lastEvents.push({ type: 'levelup' });
  }

  collectPickup() {
    const idx = this.level.items.findIndex((i) => i.x === this.player.x && i.y === this.player.y);
    if (idx === -1) return;
    const item = this.level.items.splice(idx, 1)[0];
    if (item.kind === 'gold') {
      this.gold += item.value;
      this.score += item.value;
      this.say(`Picked up ${item.value} gold.`);
    } else if (item.kind === 'heart') {
      this.player.hp = Math.min(this.player.maxHp, this.player.hp + 8);
      this.say('A heart-mushroom. +8 HP.');
    } else if (item.kind === 'oil') {
      this.player.oil += 1;
      this.player.light = Math.min(8, this.player.light + 1);
      this.say('Lantern oil. Your light reaches further.');
    } else if (item.kind === 'potion') {
      this.player.potions += 1;
      this.say('A healing draught. Press Q to drink it.');
    }
    this.lastEvents.push({ type: 'pickup', kind: item.kind, x: item.x, y: item.y });
  }

  drinkPotion() {
    if (this.phase !== PHASE_PLAY) return false;
    if (this.player.potions <= 0) {
      this.message = 'No potions left.';
      return false;
    }
    if (this.player.hp >= this.player.maxHp) {
      this.message = 'Already at full health.';
      return false;
    }
    this.player.potions -= 1;
    this.player.hp = Math.min(this.player.maxHp, this.player.hp + 12);
    this.say('You drink the draught. +12 HP.');
    this.lastEvents = [{ type: 'heal' }];
    this.endPlayerTurn();
    return true;
  }

  waitTurn() {
    if (this.phase !== PHASE_PLAY) return false;
    this.lastEvents = [];
    // Catching your breath mends 1 HP — but only when nothing is next to you.
    const foeNear = this.level.enemies.some(
      (e) => manhattan(e.x, e.y, this.player.x, this.player.y) === 1,
    );
    if (!foeNear && this.player.hp < this.player.maxHp) {
      this.player.hp += 1;
      this.say('You catch your breath. +1 HP.');
    } else {
      this.say('You hold still and listen.');
    }
    this.endPlayerTurn();
    return true;
  }

  descend() {
    this.score += 100;
    if (this.floor >= MAX_FLOOR) return;
    this.floor += 1;
    this.loadFloor(this.floor);
    this.say(`You descend to floor ${this.floor} of ${MAX_FLOOR}.`);
  }

  endPlayerTurn() {
    this.turn += 1;
    this.message = '';
    const occupied = (x, y) =>
      (x === this.player.x && y === this.player.y) || this.level.enemies.some((e) => e.x === x && e.y === y);
    for (const enemy of [...this.level.enemies]) {
      if (this.phase !== PHASE_PLAY) break;
      const result = enemyStep(this.rng, this.level, enemy, this.player, occupied);
      if (result.action === 'attack') {
        this.say(`The ${enemy.name} hits you for ${result.damage}.`);
        this.lastEvents.push({ type: 'hurt', damage: result.damage });
      }
    }
    if (this.player.hp <= 0) {
      this.player.hp = 0;
      this.phase = PHASE_LOSE;
      this.say('The dark closes in. Your lantern gutters out.');
    }
  }

  winRun() {
    this.score += 500;
    this.phase = PHASE_WIN;
    this.say('The Gloomwarden crumbles. The Sunshard is yours!');
  }

  // Cells the lantern currently reveals (for fog of war rendering).
  visibleCells() {
    const r = this.player.light;
    const seen = new Set();
    for (let y = this.player.y - r; y <= this.player.y + r; y++) {
      for (let x = this.player.x - r; x <= this.player.x + r; x++) {
        if (manhattan(x, y, this.player.x, this.player.y) <= r) seen.add(`${x},${y}`);
      }
    }
    return seen;
  }

  snapshot() {
    return {
      phase: this.phase,
      floor: this.floor,
      turn: this.turn,
      kills: this.kills,
      gold: this.gold,
      score: this.score,
      hp: this.player.hp,
      maxHp: this.player.maxHp,
      level: this.player.level,
      xp: this.player.xp,
      potions: this.player.potions,
      light: this.player.light,
    };
  }
}
