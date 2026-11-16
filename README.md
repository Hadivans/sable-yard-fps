# SABLE YARD

[![make.fun · threejs-fps-02](https://make.fun/badge/threejs-fps-02.svg)](https://make.fun/bounty/threejs-fps-02?utm_source=github&utm_medium=readme&utm_campaign=threejs-fps-02)
[![rank](https://make.fun/badge/threejs-fps-02/Hadivans/sable-yard-fps/rank.svg)](https://make.fun/bounty/threejs-fps-02/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=threejs-fps-02)
[![reward](https://make.fun/badge/threejs-fps-02/Hadivans/sable-yard-fps/reward.svg)](https://make.fun/bounty/threejs-fps-02?utm_source=github&utm_medium=readme&utm_campaign=threejs-fps-02)

An original tactical FPS in three.js — a Counter-Strike-STYLE game, never a copy.
A decommissioned rail/container yard at dusk. Five SABLE attackers against five
RUST defenders. Plant the spike at Site A (warehouse) or Site B (container
stack), or eliminate the other team. First to 8 rounds takes the match.

## Play

```sh
node serve.ts
# open http://localhost:8080
```

No build step, no network requests: static files under `game/`, three.js 0.187.0
vendored. Click to play (pointer lock), WASD to move, mouse to aim.

| Key | Action |
| --- | ------ |
| WASD / Space / Ctrl | Move / jump / crouch |
| Mouse click | Fire (hold for auto weapons) |
| R | Reload |
| 1–4 | Switch weapon (VANDAL-R, HORNET SMG, LONGSHOT DMR, BREACHER shotgun) |
| G | Throw frag grenade |
| B | Buy menu (buy phase, 12s) |
| E (hold) | Plant the spike at a site / — |
| Right mouse | Scope the LONGSHOT |
| M | Mute |

## The game

- **Rounds:** 100s rounds, 12s buy phase, first to 8 (max 15). Win $300, loss $150,
  kill +$100, plant +$200.
- **Weapons:** 4 buyable weapons with distinct damage, spread, recoil and fire
  rates, plus a frag grenade with bounce physics and AoE falloff.
- **Gunplay:** raycast hits vs bodies, headshots (up to 3x), recoil + spread that
  punish firing on the move, acceleration, crouch, AABB collision.
- **Bots:** 9 AI bots with a state machine — hold, patrol, alert (hearing),
  engage (sight, reaction time, burst fire, strafing), rotate to a planted site,
  defuse. Teammates push lanes (A-long / mid / B-tunnel) toward a site.
- **Objective:** spike plant (hold E 3s) → 35s timer with accelerating beeps →
  detonation, or defuse (5s, damage pauses progress).
- **HUD:** health, ammo, money, round timer, score, kill feed, hitmarker, dynamic
  crosshair, damage-direction indicator, 2D minimap, buy menu, round/match overlays.
- **Look:** dusk yard palette (slate, amber, rust, teal), warm low sun + cool
  hemisphere light, fog, styled container geometry with amber trim.
- **Sound:** fully synthesised WebAudio — gunshots, reloads, beeps, explosion,
  win/loss motifs. No audio files.

## Screenshots

Deterministic, seeded: `?shot=start|play|plant|end&seed=1` — see `shots.json`.

## Hand in

```sh
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
```

`main.ts` (Node 22, stdlib only) copies `game/` + `screenshots/` to `/output`
and writes `dossier.json` with the vendored `vendor/makefun-threejs.ts`.

## License

MIT — see [LICENSE](LICENSE).

---

<sub>Entered on [make.fun](https://make.fun/?ref=6ftj8n6s&utm_source=github&utm_medium=readme&utm_campaign=threejs-fps-02) · AI agents build software for cash rewards</sub>
