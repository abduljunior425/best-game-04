// input.js — keyboard and mouse controls for Glimmerdeep.
// Translates raw events into game actions and hands sound cues back to the
// caller, so main.js stays a thin loop over state + render.

import { PHASE_TITLE, PHASE_WIN, PHASE_LOSE } from './game.js';

const KEY_MOVES = {
  ArrowUp: [0, -1],
  ArrowDown: [0, 1],
  ArrowLeft: [-1, 0],
  ArrowRight: [1, 0],
  w: [0, -1],
  a: [-1, 0],
  s: [0, 1],
  d: [1, 0],
  W: [0, -1],
  A: [-1, 0],
  S: [0, 1],
  D: [1, 0],
};

export function bindInput(game, sounds, onAction) {
  const TILE = 32;

  function handleKey(event) {
    const key = event.key;
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' '].includes(key)) {
      event.preventDefault();
    }
    sounds.unlock();
    if (key === 'r' || key === 'R') {
      game.startRun();
      onAction('restart');
      return;
    }
    if (game.phase === PHASE_TITLE) {
      if (key === 'Enter' || key === ' ') {
        game.phase = 'play';
        onAction('start');
      }
      return;
    }
    if (game.phase === PHASE_WIN || game.phase === PHASE_LOSE) {
      if (key === 'Enter' || key === ' ') {
        game.startRun();
        onAction('restart');
      }
      return;
    }
    if (KEY_MOVES[key]) {
      const [dx, dy] = KEY_MOVES[key];
      if (game.movePlayer(dx, dy)) onAction('move');
      return;
    }
    if (key === 'q' || key === 'Q') {
      if (game.drinkPotion()) onAction('potion');
      return;
    }
    if (key === ' ') {
      if (game.waitTurn()) onAction('wait');
    }
  }

  function handleClick(event) {
    sounds.unlock();
    const rect = event.target.getBoundingClientRect();
    const cx = event.clientX - rect.left;
    const cy = event.clientY - rect.top;
    if (game.phase === PHASE_TITLE) {
      game.phase = 'play';
      onAction('start');
      return;
    }
    if (game.phase === PHASE_WIN || game.phase === PHASE_LOSE) {
      game.startRun();
      onAction('restart');
      return;
    }
    const tx = Math.floor(cx / TILE);
    const ty = Math.floor(cy / TILE);
    const dx = tx - game.player.x;
    const dy = ty - game.player.y;
    if (Math.abs(dx) + Math.abs(dy) === 1) {
      if (game.movePlayer(dx, dy)) onAction('move');
    }
  }

  window.addEventListener('keydown', handleKey);
  return { handleClick };
}
