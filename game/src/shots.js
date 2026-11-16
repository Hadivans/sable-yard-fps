// Deterministic screenshot sequences: ?shot=start|play|plant|end&seed=N.
// Each sets up a scripted scene from the seeded RNG; main.js runs fixed steps,
// fires the scripted action, renders twice, then sets window.__shotReady.
import * as THREE from 'three';
import { Rng } from './rng.js';
import { startMatch } from './rounds.js';
import { tryFirePlayer } from './combat.js';

function placeBot(b, x, z, yaw, state = 'hold') {
  b.x = x; b.z = z; b.yaw = yaw; b.state = state; b.alive = true; b.hp = 100;
  b.mesh.visible = true;
  b.mesh.rotation.set(0, yaw, 0);
  b.mesh.position.set(x, 0, z);
}

function killBot(b, x, z, yaw) {
  b.alive = false; b.hp = 0; b.deadT = 0; // stays visible through the shot's steps (< 2.5s fade)
  b.x = x; b.z = z;
  b.mesh.visible = true;
  b.mesh.position.set(x, 0.25, z);
  b.mesh.rotation.set(0, yaw, Math.PI / 2);
}

export function applyShot(S, ctx, name) {
  const { scene } = ctx;
  S.rng = new Rng(S.seed);
  S.shotMode = name;
  startMatch(S);
  const p = S.player;
  const sable = S.bots.filter(b => b.team === 'sable');
  const rust = S.bots.filter(b => b.team === 'rust');

  if (name === 'start') {
    // Buy phase at attacker spawn, looking down mid, teammates ahead.
    S.phase = 'buy';
    S.buyTimer = 11;
    S.buyOpen = true;
    p.x = 0; p.z = 13; p.yaw = 0; p.pitch = -0.02;
    placeBot(sable[0], -1.5, 8, 0, 'push');
    placeBot(sable[1], 2, 6.5, 0.15, 'push');
    placeBot(sable[2], -4, 9, -0.2, 'push');
    placeBot(rust[0], -14, -10, 0, 'hold');
    S.banner = '';
    S.bannerT = 0;
  } else if (name === 'play') {
    // Mid-firefight on A-long: enemy in sights, muzzle flash + hitmarker to come.
    S.phase = 'play';
    S.roundTimer = 82;
    p.x = -15.5; p.z = 4; p.yaw = 0.06; p.pitch = 0;
    placeBot(rust[0], -15.5, -3.5, Math.PI, 'engage');
    placeBot(rust[1], -12, -6, Math.PI * 0.9, 'hold');
    placeBot(sable[0], -14, 8, 0, 'push');
    S.banner = '';
    S.bannerT = 0;
  } else if (name === 'plant') {
    // Spike planted at Site A, beacon lit, defenders rotating in.
    S.phase = 'play';
    S.roundTimer = 61;
    S.bomb.state = 'planted';
    S.bomb.site = 'A';
    S.bomb.x = -14; S.bomb.z = -10;
    S.bomb.timer = 28;
    p.x = -11; p.z = -4; p.yaw = 0.72; p.pitch = -0.06;
    p.hasSpike = false;
    placeBot(rust[0], -13, -4.5, 2.6, 'rotate');
    placeBot(rust[1], -8.5, -8.5, 2.2, 'rotate');
    placeBot(rust[2], -16, -4, 2.8, 'rotate');
    placeBot(sable[0], -15, -6, 0.8, 'hold');
    const beacon = new THREE.PointLight(0xf2a541, 6, 14, 1.5);
    beacon.position.set(-14, 2.2, -10);
    scene.add(beacon);
    const spike = new THREE.Mesh(
      new THREE.BoxGeometry(0.5, 0.5, 0.5),
      new THREE.MeshStandardMaterial({ color: 0x1c2029, emissive: 0xf2a541, emissiveIntensity: 0.8 }),
    );
    spike.position.set(-14, 0.25, -10);
    scene.add(spike);
    S.banner = 'SPIKE PLANTED — SITE A';
    S.bannerT = 99;
  } else if (name === 'end') {
    // Round won: overlay up, score updated, enemies down at Site A.
    S.phase = 'roundEnd';
    S.score = { sable: 3, rust: 2 };
    S.round = 6;
    S.roundWinner = 'sable';
    S.roundReason = 'RUST ELIMINATED';
    S.roundEndT = 4.5;
    p.x = -8; p.z = 2; p.yaw = 0.8; p.pitch = -0.08;
    killBot(rust[0], -11, -1, 0.4);
    killBot(rust[1], -13, -1.5, -0.3);
    killBot(rust[2], -9.5, -2.5, 0.9);
    placeBot(rust[3], -17, -12, 0.5, 'hold');
    placeBot(sable[0], -7, -1, 0.7, 'hold');
    S.banner = '';
    S.bannerT = 0;
  }
}

// Scripted action right before the final renders (e.g. the shot in 2-play).
export function shotAction(S, ctx, name) {
  const { fx, audio, camera, vm } = ctx;
  if (name === 'play') {
    const p = S.player;
    const e = S.bots.find(b => b.team === 'rust' && b.alive);
    if (e) {
      // Aim at the enemy's chest and fire one round.
      const dx = e.x - p.x, dz = e.z - p.z;
      p.yaw = Math.atan2(-dx, -dz);
      p.pitch = -0.04;
      // Sync camera now so the raycast uses the aimed direction.
      camera.position.set(p.x, p.y + p.eyeY, p.z);
      camera.rotation.set(p.pitch, p.yaw, 0, 'YXZ');
      camera.updateMatrixWorld(true);
      if (tryFirePlayer(S, fx, audio, camera, vm)) vm.flashT = 1;
    }
  }
}
