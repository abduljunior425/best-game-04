// shots.js — stages real gameplay states for screenshots.
// ?shot=start shows the title, ?shot=play a mid-delve fight, ?shot=clear the
// victory screen and ?shot=end the game-over screen. Every state is reached
// by driving the real game with the autopilot — no faked screens.

import { PHASE_TITLE } from './game.js';
import { carefulStep, recklessStep, playUntil } from './autopilot.js';

export function stageShot(game, shot) {
  if (shot === 'start') {
    game.phase = PHASE_TITLE;
    return { turns: 0 };
  }
  if (shot === 'play') {
    // A lively mid-game: ~45 careful turns, usually floor 2 with kills, gold
    // and a full log — the frame that shows the loop at its best.
    const turns = playUntil(game, carefulStep, (g) => g.turn >= 45 || g.phase !== 'play', 200);
    return { turns };
  }
  if (shot === 'clear') {
    const turns = playUntil(game, carefulStep, (g) => g.phase === 'win', 4000);
    return { turns };
  }
  if (shot === 'end') {
    const turns = playUntil(game, recklessStep, (g) => g.phase === 'lose', 4000);
    return { turns };
  }
  return { turns: 0 };
}
