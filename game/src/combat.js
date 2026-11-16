// Shooting, damage, headshots, tracers, grenades. Hits are raycasts vs bot
// hit-meshes and world meshes; bot return fire is probability-based (see bots.js).
import * as THREE from 'three';
import { WEAPONS } from './weapons.js';
import { CFG, pushEvent, pushNoise } from './state.js';
import { spawnTracer, spawnImpact, muzzleFlash, explosionFx } from './fx.js';
import { muzzleWorldPos } from './weapons.js';

const ray = new THREE.Raycaster();
const _dir = new THREE.Vector3();
const _from = new THREE.Vector3();
const _muzzle = new THREE.Vector3();

function spreadDir(camera, spread, rng) {
  camera.getWorldDirection(_dir);
  const a = rng.range(0, Math.PI * 2), r = rng.range(0, 1) * spread;
  _dir.x += Math.cos(a) * r; _dir.y += Math.sin(a) * r * 0.6; _dir.z += Math.sin(a) * r;
  return _dir.normalize();
}

// Player fires one shot (called per trigger pull / auto-fire tick).
export function tryFirePlayer(S, fx, audio, camera, vm) {
  const p = S.player;
  if (!p.alive || p.reloading || S.phase !== 'play') return false;
  const w = WEAPONS[p.weapon];
  if (S.time - p.lastShotT < w.gap) return false;
  if (p.mag <= 0) { audio.dry(); p.lastShotT = S.time; startReload(S, audio); return false; }
  p.lastShotT = S.time;
  p.mag -= 1;
  p.bloom = Math.min(0.05, p.bloom + 0.004);
  p.recoil = Math.min(0.09, p.recoil + w.recoil);
  p.pitch += w.recoil * 0.55;
  p.yaw += (S.rng.next() - 0.5) * w.recoil * 0.5;
  const moveF = Math.min(1, p.speed / 5.4);
  const spread = w.spread + w.moveSpread * moveF + p.bloom;
  const muzzle = muzzleWorldPos(vm, camera, _muzzle).clone();
  muzzleFlash(fx, muzzle);
  audio.shot(p.weapon);
  pushNoise(S, p.x, p.z, 25);
  for (let i = 0; i < w.pellets; i++) {
    const dir = spreadDir(camera, spread, S.rng).clone();
    ray.set(camera.position, dir);
    ray.far = 80;
    const botHits = ray.intersectObjects(S.hitMeshes, false);
    const wallHits = ray.intersectObjects(S.worldMeshes, false);
    const bh = botHits[0], wh = wallHits[0];
    if (bh && (!wh || bh.distance < wh.distance)) {
      const { bot, part } = bh.object.userData;
      if (bot.alive) {
        const dmg = part === 'head' ? w.head : w.dmg;
        damageBot(S, bot, dmg, part, true, fx, audio);
        spawnTracer(fx, muzzle, bh.point.clone(), 0xffd27a);
        audio.hit(part === 'head');
        p.hitT = S.time;
      }
    } else if (wh) {
      spawnTracer(fx, muzzle, wh.point.clone(), 0xffd27a);
      spawnImpact(fx, wh.point.clone(), wh.face ? wh.face.normal.clone() : new THREE.Vector3(0, 1, 0));
    } else {
      spawnTracer(fx, muzzle, camera.position.clone().add(dir.clone().multiplyScalar(60)), 0xffd27a);
    }
  }
  return true;
}

export function startReload(S, audio) {
  const p = S.player;
  const w = WEAPONS[p.weapon];
  if (p.reloading || p.reserve <= 0 || p.mag >= w.mag) return;
  p.reloading = true;
  p.reloadT = w.reload;
  audio.reload();
}

export function updateWeaponTimers(S, dt, audio) {
  const p = S.player;
  p.fireT = Math.max(0, p.fireT - dt);
  p.bloom = Math.max(0, p.bloom - dt * 0.03);
  p.damageFlash = Math.max(0, p.damageFlash - dt * 1.6);
  if (p.reloading) {
    p.reloadT -= dt;
    if (p.reloadT <= 0) {
      const w = WEAPONS[p.weapon];
      const need = w.mag - p.mag;
      const take = Math.min(need, p.reserve);
      p.mag += take; p.reserve -= take;
      p.reloading = false;
    }
  }
}

export function damageBot(S, bot, dmg, part, byPlayer, fx, audio, killerName) {
  if (!bot.alive) return;
  bot.hp -= dmg;
  bot.lastHitT = S.time;
  if (bot.hp <= 0) {
    bot.hp = 0; bot.alive = false; bot.deadT = 0;
    bot.mesh.rotation.z = bot.team === 'rust' ? Math.PI / 2 : -Math.PI / 2;
    bot.mesh.position.y = 0.25;
    const killer = byPlayer ? 'YOU' : (killerName ?? 'SABLE');
    pushEvent(S, `${killer} ▸ ${bot.name}${part === 'head' ? ' (HEADSHOT)' : ''}`, byPlayer ? 'kill' : '');
    if (byPlayer) {
      S.money += CFG.KILL_MONEY;
      S.player.kills += 1;
    }
    // Alert nearby enemies to the kill.
    pushNoise(S, bot.x, bot.z, 20);
  } else {
    // Getting shot makes the bot alert to the shooter's direction.
    if (bot.team === 'rust') {
      bot.state = 'alert';
      bot.alertT = 1.5;
      bot.noiseX = S.player.x; bot.noiseZ = S.player.z;
    }
  }
}

export function damagePlayer(S, dmg, fromX, fromZ, audio) {
  const p = S.player;
  if (!p.alive || S.shotMode) return; // deterministic shots: the camera never dies
  p.hp -= dmg;
  p.damageFlash = 1;
  const dx = fromX - p.x, dz = fromZ - p.z;
  const ang = Math.atan2(dx, dz); // world angle of attacker
  // Convert to screen-relative direction: 0 = ahead.
  let rel = ang - (p.yaw + Math.PI);
  while (rel > Math.PI) rel -= Math.PI * 2;
  while (rel < -Math.PI) rel += Math.PI * 2;
  p.damageDir = rel;
  audio.hurt();
  if (p.hp <= 0) {
    p.hp = 0; p.alive = false; p.deaths += 1;
    pushEvent(S, `YOU were eliminated`, 'death');
    if (S.bomb.state === 'carried') {
      S.bomb.state = 'lost';
      pushEvent(S, `Spike lost — elimination only now`, 'death');
    }
  }
}

// Grenade: thrown by the player (G), damages ENEMIES only (no friendly fire).
export function throwGrenade(S, camera, audio) {
  const p = S.player;
  if (!p.alive || p.grenades <= 0 || S.phase !== 'play') return false;
  p.grenades -= 1;
  camera.getWorldDirection(_dir);
  const g = {
    x: p.x, y: p.y + p.eyeY, z: p.z,
    vx: _dir.x * 16 + p.vx * 0.5, vy: _dir.y * 16 + 3.5, vz: _dir.z * 16 + p.vz * 0.5,
    t: 0, bounced: false, fuse: 1.6,
  };
  S.grenades.push(g);
  audio.dry();
  return true;
}

export function updateGrenades(S, fx, audio, dt) {
  for (let i = S.grenades.length - 1; i >= 0; i--) {
    const g = S.grenades[i];
    g.vy -= 12 * dt;
    let nx = g.x + g.vx * dt, ny = g.y + g.vy * dt, nz = g.z + g.vz * dt;
    // Ground bounce.
    if (ny < 0.12) { ny = 0.12; g.vy = Math.abs(g.vy) * 0.45; g.vx *= 0.7; g.vz *= 0.7; g.bounced = true; }
    // Wall bounce (point vs AABB).
    for (const c of S.colliders) {
      if (ny < c.y1 && ny + 0.1 > c.y0 && nx > c.x0 - 0.1 && nx < c.x1 + 0.1 && nz > c.z0 - 0.1 && nz < c.z1 + 0.1) {
        if (g.x <= c.x0 - 0.1 || g.x >= c.x1 + 0.1) { nx = g.x; g.vx *= -0.5; }
        else { nz = g.z; g.vz *= -0.5; }
        g.bounced = true;
      }
    }
    g.x = nx; g.y = ny; g.z = nz;
    if (g.bounced) g.fuse -= dt;
    if (g.fuse <= 0) {
      explodeGrenade(S, fx, audio, g);
      S.grenades.splice(i, 1);
    }
  }
}

function explodeGrenade(S, fx, audio, g) {
  _from.set(g.x, g.y, g.z);
  explosionFx(fx, _from);
  audio.explosion();
  pushNoise(S, g.x, g.z, 30);
  for (const bot of S.bots) {
    if (!bot.alive || bot.team !== 'rust') continue;
    const d = Math.hypot(bot.x - g.x, bot.z - g.z);
    if (d < 6) {
      const dmg = Math.max(12, Math.round(95 * (1 - d / 6)));
      damageBot(S, bot, dmg, 'body', true, fx, audio);
    }
  }
}
