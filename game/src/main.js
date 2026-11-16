// SABLE YARD boot: renderer, fixed 60 Hz simulation apart from rendering,
// per-frame input edges, HUD sync, deterministic shot mode.
import * as THREE from 'three';
import { createState, CFG } from './state.js';
import { buildWorld } from './world.js';
import { createInput } from './input.js';
import { AudioSys } from './audio.js';
import { createViewModel, setViewWeapon, WEAPONS } from './weapons.js';
import { createFx, updateFx } from './fx.js';
import { updatePlayer } from './player.js';
import { tryFirePlayer, startReload, updateWeaponTimers, throwGrenade, updateGrenades } from './combat.js';
import { createBots, updateBots } from './bots.js';
import { startMatch, updateRounds, buyWeapon, switchWeapon, cycleWeapon } from './rounds.js';
import { createHud } from './hud.js';
import { applyShot, shotAction } from './shots.js';

const params = new URLSearchParams(location.search);
const shotName = params.get('shot');
const seed = Number(params.get('seed') || '1') || 1;

const S = createState(seed);
const canvas = document.getElementById('game');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setSize(innerWidth, innerHeight);
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(75, innerWidth / innerHeight, 0.05, 200);
camera.rotation.order = 'YXZ';
scene.add(camera);

S.scene = scene; S.camera = camera; S.renderer = renderer;
buildWorld(scene, S);
createBots(S, scene);

const audio = new AudioSys();
const fx = createFx(scene);
const vm = createViewModel(camera);
const inp = createInput(canvas, (locked) => {
  if (!locked && S.phase === 'play') { /* pointer lock lost: pause-safe, keep playing */ }
});

const hud = createHud(S, {
  onBuy: (key) => buyWeapon(S, key, audio),
  onStart: () => {
    audio.ensure();
    if (audio.ctx && audio.ctx.state === 'suspended') audio.ctx.resume();
    startMatch(S);
    setViewWeapon(vm, S.player.weapon);
    inp.requestLock();
  },
});

// Right mouse: scope (longshot only). Middle: nothing.
let rightDown = false;
canvas.addEventListener('contextmenu', (e) => e.preventDefault());
canvas.addEventListener('mousedown', (e) => { if (e.button === 2) rightDown = true; });
window.addEventListener('mouseup', (e) => { if (e.button === 2) rightDown = false; });
canvas.addEventListener('click', () => {
  if (S.phase === 'play' && !inp.locked && !S.shotMode) inp.requestLock();
});

addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
});

// One fixed simulation step (1/60 s). No rendering, no allocation in hot loops.
let prevMouseDown = false;
function step(dt) {
  S.time += dt;
  S.tick += 1;
  const p = S.player;
  // Scope: hold right mouse with the DMR.
  p.scoped = rightDown && p.weapon === 'longshot' && p.alive && !p.reloading;
  updatePlayer(S, inp, dt, audio);
  updateBots(S, dt, fx, audio);
  updateGrenades(S, fx, audio, dt);
  updateWeaponTimers(S, dt, audio);
  updateRounds(S, dt, audio, inp);
  updateFx(fx, dt);
  // Firing: hold for auto, fresh press for semi.
  const w = WEAPONS[p.weapon];
  if (inp.mouseDown && S.phase === 'play' && p.alive) {
    if (w.auto || !prevMouseDown) {
      if (tryFirePlayer(S, fx, audio, camera, vm)) vm.flashT = 1;
    }
  }
  prevMouseDown = inp.mouseDown;
  if (S.bannerT > 0 && S.phase !== 'menu') { /* banner decays in hud.update */ }
}

function syncCamera(dt) {
  const p = S.player;
  const targetEye = p.y + (p.crouch ? CFG.CROUCH_EYE : CFG.EYE);
  camera.position.set(p.x, targetEye, p.z);
  camera.rotation.set(p.pitch + p.recoil * 0.4, p.yaw, 0);
  const wantFov = p.scoped ? 30 : 75;
  if (Math.abs(camera.fov - wantFov) > 0.5) {
    camera.fov = wantFov;
    camera.updateProjectionMatrix();
  }
  vm.group.visible = !p.scoped;
  vm.flash.material.opacity = Math.max(0, vm.flashT);
  vm.flashT = Math.max(0, vm.flashT - dt * 8);
}

function handleEdgeKeys() {
  if (inp.wasPressed('KeyB') && S.phase === 'buy') S.buyOpen = !S.buyOpen;
  if (inp.wasPressed('KeyR')) {
    if (S.phase === 'matchEnd') { startMatch(S); setViewWeapon(vm, S.player.weapon); }
    else startReload(S, audio);
  }
  if (inp.wasPressed('KeyG')) throwGrenade(S, camera, audio);
  if (inp.wasPressed('KeyM')) audio.muted = !audio.muted;
  const digits = { Digit1: 'vandal', Digit2: 'hornet', Digit3: 'longshot', Digit4: 'breacher' };
  for (const [code, key] of Object.entries(digits)) {
    if (inp.wasPressed(code)) {
      if (S.phase === 'buy') buyWeapon(S, key, audio);
      else switchWeapon(S, key, audio);
      setViewWeapon(vm, S.player.weapon);
    }
  }
  if (inp.wasPressed('Digit5') && S.phase === 'buy') buyWeapon(S, 'grenade', audio);
  if (inp.wheel !== 0) {
    cycleWeapon(S, inp.wheel > 0 ? 1 : -1, audio);
    setViewWeapon(vm, S.player.weapon);
    inp.wheel = 0;
  }
  if (inp.wasPressed('Enter') && S.phase === 'menu') document.getElementById('start-btn')?.click();
  inp.clearPressed();
}

// --- Shot mode: deterministic, no input, freeze after the scripted frames. ---
let shotFrozen = false;
if (shotName) {
  const ctx = { scene, fx, audio, camera, vm };
  applyShot(S, ctx, shotName);
  setViewWeapon(vm, S.player.weapon);
  for (let i = 0; i < 90; i++) step(1 / 60);
  shotAction(S, ctx, shotName);
  for (let i = 0; i < 2; i++) step(1 / 60); // tracer + muzzle flash still visible
  syncCamera(0);
  renderer.render(scene, camera);
  renderer.render(scene, camera);
  hud.update(0);
  window.__shotReady = true;
  shotFrozen = true;
}

// --- Live loop. ---
let last = performance.now();
let acc = 0;
function frame(now) {
  requestAnimationFrame(frame);
  const dt = Math.min(0.1, (now - last) / 1000);
  last = now;
  if (shotFrozen) { renderer.render(scene, camera); return; }
  handleEdgeKeys();
  acc += dt;
  let n = 0;
  while (acc >= 1 / 60 && n < 5) { step(1 / 60); acc -= 1 / 60; n += 1; }
  if (n === 5) acc = 0;
  syncCamera(dt);
  hud.update(dt);
  renderer.render(scene, camera);
}
requestAnimationFrame(frame);
