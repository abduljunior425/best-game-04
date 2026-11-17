// render.js — all canvas drawing for Glimmerdeep.
// One draw() per frame: title, dungeon, HUD, win and lose screens. The art
// is flat vector shapes on canvas — no image assets, nothing to load.

import { TILE_WALL, TILE_STAIRS, FLOOR_W, FLOOR_H } from './dungeon.js';
import { PHASE_TITLE, PHASE_PLAY, PHASE_WIN, PHASE_LOSE, MAX_FLOOR, XP_PER_LEVEL } from './game.js';

export const TILE = 32;
export const MAP_W = FLOOR_W * TILE; // 832
export const MAP_H = FLOOR_H * TILE; // 576
export const SIDE_W = 256;
export const VIEW_W = MAP_W + SIDE_W; // 1088
export const VIEW_H = 640;

const PALETTE = {
  bg: '#0d0f1a',
  wall: '#2a2f45',
  wallTop: '#3a4060',
  floor: '#171a2b',
  floorAlt: '#1b1f33',
  stairs: '#ffd166',
  player: '#ffe066',
  gold: '#ffd166',
  heart: '#ff6b81',
  oil: '#7dd8ff',
  potion: '#9dff6e',
  text: '#e8e6df',
  dim: '#8a8fa8',
  panel: '#12142a',
  line: '#2e3352',
};

const ITEM_GLYPH = { gold: '●', heart: '♥', oil: '◆', potion: '♦' };
const ITEM_COLOR = { gold: PALETTE.gold, heart: PALETTE.heart, oil: PALETTE.oil, potion: PALETTE.potion };

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function drawBar(ctx, x, y, w, h, frac, color, bg) {
  ctx.fillStyle = bg;
  roundRect(ctx, x, y, w, h, 4);
  ctx.fill();
  if (frac > 0) {
    ctx.fillStyle = color;
    roundRect(ctx, x, y, Math.max(8, w * frac), h, 4);
    ctx.fill();
  }
}

function drawTitle(ctx, game) {
  ctx.fillStyle = PALETTE.bg;
  ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  // Lantern glow behind the title.
  const glow = ctx.createRadialGradient(VIEW_W / 2, 210, 10, VIEW_W / 2, 210, 320);
  glow.addColorStop(0, 'rgba(255, 214, 102, 0.28)');
  glow.addColorStop(1, 'rgba(255, 214, 102, 0)');
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, VIEW_W, VIEW_H);

  ctx.textAlign = 'center';
  ctx.fillStyle = PALETTE.stairs;
  ctx.font = '700 64px Georgia, serif';
  ctx.fillText('GLIMMERDEEP', VIEW_W / 2, 190);
  ctx.fillStyle = PALETTE.text;
  ctx.font = '20px Georgia, serif';
  ctx.fillText('A turn-based dungeon delve  ·  five floors  ·  one Sunshard', VIEW_W / 2, 232);

  ctx.font = '16px system-ui, sans-serif';
  ctx.fillStyle = PALETTE.dim;
  const lines = [
    'Move with WASD or arrow keys — or click a neighbouring tile.',
    'Bump into a monster to attack it. Grab gold, hearts, oil and potions.',
    'Find the glowing stairs to descend. On floor 5, slay the Gloomwarden.',
    'Press Q to drink a potion. Space waits a turn. R restarts any time.',
  ];
  lines.forEach((line, i) => ctx.fillText(line, VIEW_W / 2, 300 + i * 28));

  ctx.fillStyle = PALETTE.player;
  ctx.font = '700 22px system-ui, sans-serif';
  ctx.fillText('— Press ENTER or click to begin —', VIEW_W / 2, 470);
  ctx.fillStyle = PALETTE.dim;
  ctx.font = '14px system-ui, sans-serif';
  ctx.fillText('Seed ' + game.seed + '  ·  deterministic dungeon  ·  sound on first key press', VIEW_W / 2, 510);
}

function drawDungeon(ctx, game, now, fx) {
  const level = game.level;
  const player = game.player;
  const seen = game.visibleCells();

  for (let y = 0; y < FLOOR_H; y++) {
    for (let x = 0; x < FLOOR_W; x++) {
      const t = level.tiles[y * FLOOR_W + x];
      const px = x * TILE;
      const py = y * TILE;
      if (t === TILE_WALL) {
        ctx.fillStyle = PALETTE.wall;
        ctx.fillRect(px, py, TILE, TILE);
        ctx.fillStyle = PALETTE.wallTop;
        ctx.fillRect(px, py, TILE, 4);
        continue;
      }
      ctx.fillStyle = (x + y) % 2 === 0 ? PALETTE.floor : PALETTE.floorAlt;
      ctx.fillRect(px, py, TILE, TILE);
      if (t === TILE_STAIRS) {
        ctx.fillStyle = PALETTE.stairs;
        ctx.font = '700 22px system-ui, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('≡', px + TILE / 2, py + TILE / 2 + 1);
      }
    }
  }

  // Items.
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  for (const item of level.items) {
    ctx.fillStyle = ITEM_COLOR[item.kind];
    ctx.font = '700 18px system-ui, sans-serif';
    ctx.fillText(ITEM_GLYPH[item.kind], item.x * TILE + TILE / 2, item.y * TILE + TILE / 2 + 1);
  }

  // Enemies, with a little HP pip row under the hurt ones.
  for (const e of level.enemies) {
    const cx = e.x * TILE + TILE / 2;
    const cy = e.y * TILE + TILE / 2;
    ctx.fillStyle = e.color;
    ctx.beginPath();
    ctx.arc(cx, cy, 12, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#0d0f1a';
    ctx.font = '700 15px system-ui, sans-serif';
    ctx.fillText(e.glyph, cx, cy + 1);
    if (e.hp < e.maxHp) {
      drawBar(ctx, e.x * TILE + 4, e.y * TILE + TILE - 6, TILE - 8, 4, e.hp / e.maxHp, '#ff5d6c', '#00000088');
    }
  }

  // Player: a lantern-bearer, drawn as a warm circle with a face.
  const pcx = player.x * TILE + TILE / 2;
  const pcy = player.y * TILE + TILE / 2;
  const bob = Math.sin(now / 300) * 1.5;
  ctx.fillStyle = PALETTE.player;
  ctx.beginPath();
  ctx.arc(pcx, pcy + bob, 13, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#0d0f1a';
  ctx.font = '700 16px system-ui, sans-serif';
  ctx.fillText('@', pcx, pcy + bob + 1);

  // Fog of war: darken everything outside the lantern light.
  ctx.fillStyle = 'rgba(5, 6, 14, 0.74)';
  for (let y = 0; y < FLOOR_H; y++) {
    for (let x = 0; x < FLOOR_W; x++) {
      if (!seen.has(`${x},${y}`)) ctx.fillRect(x * TILE, y * TILE, TILE, TILE);
    }
  }
  // Soft lantern glow over the visible area.
  const glow = ctx.createRadialGradient(pcx, pcy, 20, pcx, pcy, player.light * TILE);
  glow.addColorStop(0, 'rgba(255, 214, 102, 0.10)');
  glow.addColorStop(1, 'rgba(255, 214, 102, 0)');
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, MAP_W, MAP_H);

  // Hurt flash.
  if (fx && now < fx.hurtUntil) {
    ctx.fillStyle = `rgba(255, 60, 80, ${0.22 * (1 - (now - fx.hurtAt) / 350)})`;
    ctx.fillRect(0, 0, MAP_W, MAP_H);
  }
}

function drawSide(ctx, game) {
  const x0 = MAP_W + 16;
  const w = SIDE_W - 32;
  const p = game.player;
  ctx.fillStyle = PALETTE.panel;
  ctx.fillRect(MAP_W, 0, SIDE_W, VIEW_H);
  ctx.fillStyle = PALETTE.line;
  ctx.fillRect(MAP_W, 0, 2, VIEW_H);

  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  let y = 44;
  ctx.fillStyle = PALETTE.stairs;
  ctx.font = '700 22px Georgia, serif';
  ctx.fillText('GLIMMERDEEP', x0, y);
  y += 30;
  ctx.fillStyle = PALETTE.text;
  ctx.font = '700 17px system-ui, sans-serif';
  ctx.fillText(`Floor ${game.floor} / ${MAX_FLOOR}`, x0, y);
  y += 12;
  ctx.fillStyle = PALETTE.dim;
  ctx.font = '14px system-ui, sans-serif';
  ctx.fillText(`Turn ${game.turn}   ·   Kills ${game.kills}`, x0, y);

  y += 34;
  ctx.fillStyle = PALETTE.text;
  ctx.font = '700 14px system-ui, sans-serif';
  ctx.fillText(`HP  ${p.hp} / ${p.maxHp}`, x0, y);
  y += 8;
  drawBar(ctx, x0, y, w, 12, p.hp / p.maxHp, p.hp > p.maxHp * 0.3 ? '#7dd87d' : '#ff5d6c', '#2a2f45');
  y += 30;
  ctx.fillText(`Level ${p.level}   ·   XP ${p.xp} / ${p.level * XP_PER_LEVEL}`, x0, y);
  y += 8;
  drawBar(ctx, x0, y, w, 8, p.xp / (p.level * XP_PER_LEVEL), '#b78cff', '#2a2f45');

  y += 34;
  ctx.font = '15px system-ui, sans-serif';
  ctx.fillStyle = PALETTE.gold;
  ctx.fillText(`●  Gold  ${game.gold}`, x0, y);
  y += 24;
  ctx.fillStyle = PALETTE.text;
  ctx.fillText(`⚔  Attack  ${p.atk}`, x0, y);
  y += 24;
  ctx.fillText(`♦  Potions  ${p.potions}  (Q)`, x0, y);
  y += 24;
  ctx.fillText(`◆  Light  ${p.light}  ·  oil ${p.oil}`, x0, y);
  y += 24;
  ctx.fillStyle = PALETTE.stairs;
  ctx.font = '700 16px system-ui, sans-serif';
  ctx.fillText(`Score  ${game.score}`, x0, y);

  y += 40;
  ctx.fillStyle = PALETTE.dim;
  ctx.font = '700 13px system-ui, sans-serif';
  ctx.fillText('— LOG —', x0, y);
  y += 20;
  ctx.font = '13px system-ui, sans-serif';
  ctx.fillStyle = PALETTE.text;
  for (const line of game.log) {
    wrapText(ctx, line, x0, y, w, 17);
    y += 34;
    if (y > VIEW_H - 90) break;
  }

  ctx.fillStyle = PALETTE.dim;
  ctx.font = '12px system-ui, sans-serif';
  ctx.fillText('WASD / arrows move · Q potion', x0, VIEW_H - 44);
  ctx.fillText('Space wait · R restart', x0, VIEW_H - 26);
}

function wrapText(ctx, text, x, y, maxW, lineH) {
  const words = text.split(' ');
  let line = '';
  let yy = y;
  for (const word of words) {
    const test = line ? line + ' ' + word : word;
    if (ctx.measureText(test).width > maxW && line) {
      ctx.fillText(line, x, yy);
      line = word;
      yy += lineH;
    } else {
      line = test;
    }
  }
  ctx.fillText(line, x, yy);
}

function drawEnd(ctx, game, won) {
  // Dim the map only; the sidebar HUD stays readable beside the verdict.
  ctx.fillStyle = 'rgba(5, 6, 14, 0.8)';
  ctx.fillRect(0, 0, MAP_W, VIEW_H);
  ctx.textAlign = 'center';
  ctx.fillStyle = won ? PALETTE.stairs : '#ff5d6c';
  ctx.font = '700 52px Georgia, serif';
  ctx.fillText(won ? 'THE SUNSHARD IS YOURS' : 'THE DARK TAKES YOU', MAP_W / 2, 250);
  ctx.fillStyle = PALETTE.text;
  ctx.font = '20px Georgia, serif';
  ctx.fillText(
    won
      ? 'The Gloomwarden falls. Dawn returns to Glimmerdeep.'
      : 'Your lantern gutters out on floor ' + game.floor + '.',
    MAP_W / 2,
    296,
  );
  ctx.font = '18px system-ui, sans-serif';
  ctx.fillStyle = PALETTE.dim;
  ctx.fillText(
    `Score ${game.score}  ·  Floor ${game.floor}  ·  ${game.kills} kills  ·  ${game.gold} gold  ·  ${game.turn} turns`,
    MAP_W / 2,
    340,
  );
  ctx.fillStyle = PALETTE.player;
  ctx.font = '700 20px system-ui, sans-serif';
  ctx.fillText('— Press R or click to delve again —', MAP_W / 2, 400);
}

export function draw(ctx, game, now, fx) {
  ctx.clearRect(0, 0, VIEW_W, VIEW_H);
  if (game.phase === PHASE_TITLE) {
    drawTitle(ctx, game);
    return;
  }
  drawDungeon(ctx, game, now, fx);
  drawSide(ctx, game);
  if (game.phase === PHASE_WIN) drawEnd(ctx, game, true);
  if (game.phase === PHASE_LOSE) drawEnd(ctx, game, false);
}
