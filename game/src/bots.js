// Bot AI: perception (sight 40m / ~100 deg FOV, hearing 25m), state machine
// (hold / patrol / alert / engage / rotate / defuse), lane pushes, cover strafes.
import * as THREE from 'three';
import { PALN } from './palette.js';
import { CFG, pushNoise } from './state.js';
import { collideMove, segmentBlocked } from './world.js';
import { damageBot, damagePlayer } from './combat.js';
import { spawnTracer } from './fx.js';

const NAMES_SABLE = ['SABLE-2', 'SABLE-3', 'SABLE-4', 'SABLE-5'];
const NAMES_RUST = ['RUST-1', 'RUST-2', 'RUST-3', 'RUST-4', 'RUST-5'];
const EYE_Y = 1.5;

function makeBotMesh(scene, S, bot) {
  const teamColor = bot.team === 'rust' ? PALN.enemy : PALN.teammate;
  const g = new THREE.Group();
  const bodyMat = new THREE.MeshStandardMaterial({ color: teamColor, roughness: 0.85 });
  const darkMat = new THREE.MeshStandardMaterial({ color: 0x1c2029, roughness: 0.9 });
  const legs = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.7, 0.28), darkMat);
  legs.position.y = 0.35;
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.56, 0.72, 0.34), bodyMat);
  body.position.y = 1.06;
  body.castShadow = true;
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.32, 0.32), darkMat);
  head.position.y = 1.6;
  head.castShadow = true;
  const visor = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.08, 0.05),
    new THREE.MeshStandardMaterial({ color: 0xf2a541, emissive: 0x664411 }));
  visor.position.set(0, 1.62, -0.17);
  const gun = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.1, 0.62), darkMat);
  gun.position.set(0.2, 1.25, -0.35);
  const marker = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.1, 0.1),
    new THREE.MeshBasicMaterial({ color: teamColor }));
  marker.position.y = 1.95;
  g.add(legs, body, head, visor, gun, marker);
  g.position.set(bot.x, 0, bot.z);
  scene.add(g);
  body.userData = { bot, part: 'body' };
  head.userData = { bot, part: 'head' };
  S.hitMeshes.push(body, head);
  bot.mesh = g;
  bot.bodyMesh = body;
  bot.headMesh = head;
}

export function createBots(S, scene) {
  S.bots = [];
  for (let i = 0; i < 4; i++) {
    S.bots.push({ id: i, name: NAMES_SABLE[i], team: 'sable', x: 0, y: 0, z: 13, yaw: 0, hp: CFG.BOT_HP, alive: true, state: 'push', wpIndex: 0, lane: 'mid', site: 'A', target: null, reactT: 0, shotT: 0, burstLeft: 0, burstT: 0, strafeDir: 1, strafeT: 0, lastSeenT: -9, seenX: 0, seenZ: 0, noiseX: 0, noiseZ: 0, alertT: 0, holdT: 0, defuseT: 0, clearT: 0, percT: i * 0.04, deadT: 0, lastHitT: -9, speed: 3.6, mesh: null });
  }
  for (let i = 0; i < 5; i++) {
    S.bots.push({ id: 4 + i, name: NAMES_RUST[i], team: 'rust', x: 0, y: 0, z: -13, yaw: Math.PI, hp: CFG.BOT_HP, alive: true, state: 'hold', wpIndex: i % 3, lane: null, site: i < 3 ? 'A' : 'B', target: null, reactT: 0, shotT: 0, burstLeft: 0, burstT: 0, strafeDir: 1, strafeT: 0, lastSeenT: -9, seenX: 0, seenZ: 0, noiseX: 0, noiseZ: 0, alertT: 0, holdT: 0, defuseT: 0, clearT: 0, percT: i * 0.04, deadT: 0, lastHitT: -9, speed: 3.4, mesh: null });
  }
  for (const b of S.bots) makeBotMesh(scene, S, b);
}

export function resetBotsForRound(S) {
  const lanes = ['along', 'mid', 'btunnel', 'mid'];
  let si = 0, ri = 0;
  for (const b of S.bots) {
    b.hp = CFG.BOT_HP; b.alive = true; b.deadT = 0;
    b.target = null; b.reactT = 0; b.shotT = 0; b.burstLeft = 0;
    b.defuseT = 0; b.clearT = 0; b.alertT = 0; b.lastSeenT = -9;
    b.mesh.rotation.set(0, 0, 0);
    b.mesh.position.y = 0;
    b.mesh.visible = true;
    if (b.team === 'sable') {
      const sp = S.spawns.sable[si++];
      b.x = sp[0]; b.z = sp[1]; b.yaw = 0;
      b.lane = lanes[b.id];
      b.site = b.lane === 'along' ? 'A' : b.lane === 'btunnel' ? 'B' : (S.rng.chance(0.5) ? 'A' : 'B');
      b.state = 'push'; b.wpIndex = 0;
    } else {
      const sp = S.spawns.rust[ri++];
      b.x = sp[0]; b.z = sp[1];
      b.site = b.id < 7 ? 'A' : 'B';
      b.state = 'hold';
      b.wpIndex = (b.id - 4) % 3;
      b.yaw = Math.PI + S.rng.range(-0.4, 0.4);
    }
    b.mesh.position.set(b.x, 0, b.z);
    b.mesh.rotation.y = b.yaw;
  }
}

function angleTo(b, x, z) { return Math.atan2(-(x - b.x), -(z - b.z)); }
function yawDiff(a, b) {
  let d = a - b;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return d;
}
function turnToward(b, targetYaw, dt, rate = 6) {
  const d = yawDiff(targetYaw, b.yaw);
  const step = Math.max(-rate * dt, Math.min(rate * dt, d));
  b.yaw += step;
}

function moveToward(S, b, tx, tz, dt, speed) {
  const dx = tx - b.x, dz = tz - b.z;
  const d = Math.hypot(dx, dz);
  if (d < 0.25) return true;
  const want = angleTo(b, tx, tz);
  turnToward(b, want, dt);
  const step = Math.min(d, speed * dt);
  const mx = (dx / d) * step, mz = (dz / d) * step;
  collideMove(S, b, mx, mz, 0.34, 0, 1.75);
  return d < 0.5;
}

function visibleEnemies(S, b) {
  const out = [];
  const cand = [];
  const p = S.player;
  if (b.team === 'rust' && p.alive) cand.push({ x: p.x, z: p.z, y: p.y, alive: true, isPlayer: true, hp: p.hp, speed: p.speed });
  for (const o of S.bots) {
    if (!o.alive || o.team === b.team) continue;
    cand.push(o);
  }
  for (const e of cand) {
    const d = Math.hypot(e.x - b.x, e.z - b.z);
    if (d > 40) continue;
    const want = angleTo(b, e.x, e.z);
    if (Math.abs(yawDiff(want, b.yaw)) > 0.95) continue; // ~109 deg FOV
    const ey = (e.y ?? 0) + 1.4;
    if (segmentBlocked(S, b.x, b.z, e.x, e.z, Math.min(EYE_Y, ey))) continue;
    out.push({ e, d });
  }
  out.sort((a, c) => a.d - c.d);
  return out;
}

function botShoot(S, b, target, fx, audio) {
  const d = Math.hypot(target.x - b.x, target.z - b.z);
  const muzzle = { x: b.x - Math.sin(b.yaw) * 0.4, y: 1.3, z: b.z - Math.cos(b.yaw) * 0.4 };
  const to = { x: target.x, y: (target.y ?? 0) + 1.3, z: target.z };
  spawnTracer(fx, new THREE.Vector3(muzzle.x, muzzle.y, muzzle.z), new THREE.Vector3(to.x, to.y, to.z), b.team === 'rust' ? 0xff8866 : 0x7ae0d4);
  audio.shot('vandal');
  pushNoise(S, b.x, b.z, 25);
  const moving = target.isPlayer ? target.speed > 2 : true;
  const pHit = 0.34 * Math.max(0.25, 1 - d / 60) * (moving ? 0.75 : 1) * 0.9;
  if (S.rng.chance(pHit)) {
    const head = S.rng.chance(0.08);
    const dmg = Math.round(S.rng.range(20, 34) * (head ? 2.5 : 1));
    if (target.isPlayer) damagePlayer(S, dmg, b.x, b.z, audio);
    else damageBot(S, target, dmg, head ? 'head' : 'body', false, fx, audio, b.name);
  }
}

export function updateBots(S, dt, fx, audio) {
  for (const b of S.bots) {
    if (!b.alive) {
      b.deadT += dt;
      if (b.deadT > 2.5) b.mesh.visible = false;
      continue;
    }
    // Perception (staggered 10 Hz).
    b.percT -= dt;
    if (b.percT <= 0) {
      b.percT = 0.15;
      const seen = visibleEnemies(S, b);
      if (seen.length) {
        b.target = seen[0].e;
        b.lastSeenT = S.time;
        b.seenX = seen[0].e.x; b.seenZ = seen[0].e.z;
        if (b.state !== 'engage') b.reactT = S.rng.range(0.35, 0.8);
        b.state = 'engage';
      } else if (b.state === 'engage') {
        if (S.time - b.lastSeenT > 1.2) { b.target = null; b.state = 'alert'; b.alertT = 1.2; b.noiseX = b.seenX; b.noiseZ = b.seenZ; }
      }
      // Hearing.
      if (b.state !== 'engage') {
        for (const n of S.noises) {
          if (S.time - n.t > 1.0) continue;
          if (Math.hypot(n.x - b.x, n.z - b.z) < n.r) {
            b.state = 'alert'; b.alertT = 1.5; b.noiseX = n.x; b.noiseZ = n.z;
            break;
          }
        }
      }
    }

    // State machine.
    if (b.state === 'engage' && b.target) {
      const t = b.target;
      const targetAlive = t.isPlayer ? S.player.alive : t.alive;
      if (!targetAlive) { b.target = null; b.state = 'alert'; b.alertT = 1.2; b.noiseX = b.seenX; b.noiseZ = b.seenZ; }
      else {
      turnToward(b, angleTo(b, t.x, t.z), dt, 8);
      // Strafe to cover.
      b.strafeT -= dt;
      if (b.strafeT <= 0) { b.strafeT = S.rng.range(0.7, 1.4); b.strafeDir *= -1; }
      const px = Math.cos(b.yaw) * b.strafeDir, pz = -Math.sin(b.yaw) * b.strafeDir;
      collideMove(S, b, px * 1.6 * dt, pz * 1.6 * dt, 0.34, 0, 1.75);
      // Fire in bursts after reaction.
      if (b.reactT > 0) { b.reactT -= dt; }
      else {
        b.shotT -= dt;
        if (b.burstLeft <= 0 && b.shotT <= 0) { b.burstLeft = S.rng.int(3, 5); b.shotT = 0; }
        if (b.burstLeft > 0 && b.shotT <= 0) {
          botShoot(S, b, t, fx, audio);
          b.burstLeft -= 1;
          b.shotT = 0.13;
          if (b.burstLeft <= 0) b.shotT = S.rng.range(0.6, 1.1);
        }
      }
      }
    } else if (b.state === 'alert') {
      turnToward(b, angleTo(b, b.noiseX, b.noiseZ), dt, 5);
      b.alertT -= dt;
      if (b.alertT <= 0) b.state = b.team === 'rust' ? 'patrol' : 'push';
    } else if (b.state === 'hold') {
      // Site hold: slow yaw sweep watching an approach.
      const wps = S.waypoints[b.site];
      b.holdT += dt;
      const sweep = Math.sin(b.holdT * 0.5) * 0.8;
      b.yaw += sweep * dt * 0.5;
      if (S.bomb.state === 'planted') { b.state = 'rotate'; }
      else if (b.holdT > 6) { b.holdT = 0; b.state = 'patrol'; b.wpIndex = (b.wpIndex + 1) % wps.length; }
    } else if (b.state === 'patrol') {
      const wps = S.waypoints[b.site];
      const wp = wps[b.wpIndex % wps.length];
      if (moveToward(S, b, wp[0], wp[1], dt, b.speed * 0.6)) {
        b.wpIndex = (b.wpIndex + 1) % wps.length;
        b.state = 'hold'; b.holdT = 0;
      }
      if (S.bomb.state === 'planted') b.state = 'rotate';
    } else if (b.state === 'rotate') {
      const site = S.bomb.site;
      if (!site) { b.state = 'hold'; }
      else {
        const wps = S.waypoints[site];
        const wp = wps[b.wpIndex % wps.length];
        if (moveToward(S, b, wp[0], wp[1], dt, b.speed)) {
          // Arrived: hold the site, or defuse if defender and site clear.
          b.state = 'hold';
        }
        // Defenders defuse when the site is clear of attackers.
        if (b.team === 'rust' && S.bomb.state === 'planted') {
          const near = Math.hypot(b.x - S.bomb.x, b.z - S.bomb.z);
          if (near < 2.6) {
            const anyAttackerNear = S.player.alive && Math.hypot(S.player.x - S.bomb.x, S.player.z - S.bomb.z) < 12;
            const anyMateNear = S.bots.some(o => o.alive && o.team === 'sable' && Math.hypot(o.x - S.bomb.x, o.z - S.bomb.z) < 12);
            if (!anyAttackerNear && !anyMateNear) {
              b.clearT += dt;
              if (b.clearT > 2) {
                b.state = 'defuse';
                b.defuseT = 0;
              }
            } else b.clearT = 0;
          }
        }
      }
    } else if (b.state === 'defuse') {
      if (S.bomb.state !== 'planted') { b.state = 'hold'; b.defuseT = 0; }
      else {
        const damaged = S.time - b.lastHitT < 0.5;
        if (!damaged) {
          b.defuseT += dt;
          S.bomb.defuseT = b.defuseT;
          S.bomb.defuser = b.name;
          if (b.defuseT >= CFG.DEFUSE_TIME) {
            S.bomb.state = 'defused';
            S.bomb.defuser = null;
          }
        }
      }
    } else if (b.state === 'push') {
      // Teammates push their lane toward the assigned site.
      const lane = S.waypoints.lanes[b.lane];
      const wp = lane[Math.min(b.wpIndex, lane.length - 1)];
      if (moveToward(S, b, wp[0], wp[1], dt, b.speed)) {
        b.wpIndex += 1;
        if (b.wpIndex >= lane.length) {
          b.state = 'hold';
          b.holdT = 0;
        }
      }
      if (S.bomb.state === 'planted') b.state = 'hold';
    }

    // Sync mesh.
    b.mesh.position.set(b.x, 0, b.z);
    b.mesh.rotation.y = b.yaw;
  }
}
