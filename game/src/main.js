// main.js — bootstrap for Glimmerdeep.
// Wires the canvas, the game state, input, sound and the render loop, and
// stages screenshot scenes when ?shot= is present.

import { Game, PHASE_TITLE, PHASE_WIN, PHASE_LOSE } from './game.js';
import { draw, VIEW_W, VIEW_H } from './render.js';
import { SoundBank } from './audio.js';
import { bindInput } from './input.js';
import { stageShot } from './shots.js';

const params = new URLSearchParams(window.location.search);
const seed = Number(params.get('seed') || 1) || 1;
const shot = params.get('shot') || '';

const canvas = document.getElementById('game');
canvas.width = VIEW_W;
canvas.height = VIEW_H;
const ctx = canvas.getContext('2d');

const game = new Game(seed);
const sounds = new SoundBank();
const fx = { hurtAt: 0, hurtUntil: 0 };

const input = bindInput(game, sounds, (action) => {
  if (action === 'start' || action === 'restart') sounds.stairs();
  if (action === 'move') {
    const last = game.lastEvents[0];
    if (last && last.type === 'kill') sounds.hit();
    else if (last && last.type === 'hurt') sounds.hurt();
    else sounds.step();
  }
  if (action === 'potion') sounds.heal();
});

canvas.addEventListener('click', (event) => input.handleClick(event));

// Watch for damage so the renderer can flash the screen.
let lastHp = game.player.hp;
let lastPhase = game.phase;
function watchDamage(now) {
  if (game.player.hp < lastHp) {
    fx.hurtAt = now;
    fx.hurtUntil = now + 350;
    sounds.hurt();
  }
  lastHp = game.player.hp;
  if (game.phase !== lastPhase) {
    if (game.phase === PHASE_WIN) sounds.win();
    if (game.phase === PHASE_LOSE) sounds.lose();
    lastPhase = game.phase;
  }
}

let shotDone = false;
if (shot) {
  // Staged from the live 'play' phase: the autopilot drives real turns.
  const result = stageShot(game, shot);
  window.__shot = { name: shot, seed, ...result, snapshot: game.snapshot() };
  shotDone = true;
} else {
  // Start on the title screen; a fresh run begins when the player starts.
  game.phase = PHASE_TITLE;
}

window.__game = game;
window.__shotDone = shotDone;

function frame(now) {
  watchDamage(now);
  draw(ctx, game, now, fx);
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
