// SABLE YARD — one state object. Every module reads/writes this store only.
import { Rng } from './rng.js';

export const CFG = {
  WIN_ROUNDS: 8, MAX_ROUNDS: 15,
  ROUND_TIME: 100, BUY_TIME: 12,
  PLANT_TIME: 3, DEFUSE_TIME: 5, BOMB_TIME: 35,
  START_MONEY: 800, WIN_MONEY: 300, LOSS_MONEY: 150,
  KILL_MONEY: 100, PLANT_MONEY: 200, DEFUSE_MONEY: 200,
  MAP_X: 20, MAP_Z: 16, EYE: 1.62, CROUCH_EYE: 1.05,
  PLAYER_HP: 100, BOT_HP: 100,
};

export function createState(seed = 1) {
  return {
    seed, rng: new Rng(seed),
    time: 0, tick: 0,
    phase: 'menu', // menu | buy | play | roundEnd | matchEnd
    round: 1,
    score: { sable: 0, rust: 0 },
    roundTimer: CFG.BUY_TIME, buyTimer: CFG.BUY_TIME,
    money: CFG.START_MONEY,
    roundWinner: null, roundReason: '', matchWinner: null,
    // Player (feet position; eye = y + EYE)
    player: {
      x: 0, y: 0, z: 13, vx: 0, vz: 0, vy: 0,
      yaw: 0, pitch: 0, hp: CFG.PLAYER_HP, alive: true,
      crouch: false, onGround: true, speed: 0,
      weapon: 'vandal', owned: { vandal: true },
      mag: 30, reserve: 90, grenades: 0,
      reloading: false, reloadT: 0, fireT: 0, bloom: 0, recoil: 0,
      hasSpike: true, plantT: 0, plantSite: null,
      damageFlash: 0, damageDir: 0, kills: 0, deaths: 0,
      scoped: false, lastShotT: -9, stepT: 0,
    },
    bots: [],           // bot objects (see bots.js)
    bomb: { state: 'carried', site: null, x: 0, z: 0, timer: 0, beepT: 0, defuseT: 0, defuser: null },
    events: [],        // kill feed: {text, t, cls}
    noises: [],        // {x, z, r, t} — gunshots / footsteps bots can hear
    grenades: [],      // {x,y,z,vx,vy,vz,t,bounced}
    colliders: [],     // {x0,z0,x1,z1,y0,y1}
    worldMeshes: [],   // solid meshes (bullet impact raycast)
    hitMeshes: [],     // bot body/head meshes (userData: {bot, part})
    sites: { A: { x: -14, z: -10, r: 3.6 }, B: { x: 14, z: -10, r: 3.6 } },
    spawns: { sable: [], rust: [] },
    waypoints: { A: [], B: [], mid: [], lanes: {} },
    scene: null, camera: null, renderer: null,
    shotMode: null, shotDone: false,
    banner: '', bannerT: 0, // centre objective banner
    buyOpen: false,
  };
}

export function pushEvent(S, text, cls = '') {
  S.events.push({ text, t: S.time, cls });
  if (S.events.length > 8) S.events.shift();
}

export function pushNoise(S, x, z, r) {
  S.noises.push({ x, z, r, t: S.time });
  if (S.noises.length > 24) S.noises.shift();
}
