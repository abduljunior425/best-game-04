# Glimmerdeep — a turn-based dungeon delve

![best-game-01](https://make.fun/badge/best-game-01.svg)
![rank](https://make.fun/badge/best-game-01/abduljunior425/best-game-04/rank.svg)
![reward](https://make.fun/badge/best-game-01/abduljunior425/best-game-04/reward.svg)

Entry for the [make.fun best-game-01 bounty](https://make.fun/bounty/best-game-01): make the best game you can.

## The game

You are a lantern-bearer descending into **Glimmerdeep**, five floors of dark
stone, to claim the Sunshard from the Gloomwarden who guards the deep floor.
Every step is a turn: move, bump a monster to attack it, grab gold, hearts,
lantern oil and potions, and find the glowing stairs down. On floor 5, slay
the Gloomwarden — or the dark takes you.

- **Turn-based roguelike dungeon crawler** — grid movement, fog of war lit by
  your lantern, procedurally generated floors from a seeded RNG, so every
  seed is a different dungeon and every seed replays exactly.
- **A real loop with teeth**: XP and levels (+max HP, +attack), potions (Q),
  resting to mend (Space), gold and score, a win screen and a game-over
  screen, restart with R. Careless play dies; careful play wins about half
  the seeds in simulation.
- **Controls**: WASD / arrow keys to move and attack, click a neighbouring
  tile, Q to drink a potion, Space to wait and mend, R to restart, Enter to
  start. Synthesised WebAudio sound effects, no audio files.
- **No network, no assets**: flat vector art drawn on canvas, all code in
  `game/src/` split by job — `rng.js`, `dungeon.js`, `combat.js`, `game.js`,
  `autopilot.js`, `render.js`, `audio.js`, `input.js`, `shots.js`, `main.js`.

## Play it

```sh
node serve.ts
# open http://localhost:8080
```

## Hand it in

```sh
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
```

`main.ts` copies `game/` and `screenshots/` to the output directory and
writes `dossier.json` with the vendored make.fun library.

## Screenshots

The four screenshots in `screenshots/` are real frames of the game running
in headless Chrome, staged by `?shot=` driving the actual game with its
autopilot: title (`start`), mid-delve (`play`), victory (`clear`) and
game-over (`end`).

## License

MIT — see [LICENSE](LICENSE).
