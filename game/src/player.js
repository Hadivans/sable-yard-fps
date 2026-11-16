// Player movement: acceleration, friction, crouch, jump, AABB collision.
import { CFG, pushNoise } from './state.js';
import { collideMove } from './world.js';

const EYE_STAND = CFG.EYE, EYE_CROUCH = CFG.CROUCH_EYE;

export function updatePlayer(S, inp, dt, audio) {
  const p = S.player;
  if (!p.alive || S.phase === 'menu' || S.phase === 'matchEnd') return;

  // Mouse look.
  const [mdx, mdy] = inp.consumeMouse();
  const sens = p.scoped ? 0.0009 : 0.0021;
  p.yaw -= mdx * sens;
  p.pitch -= mdy * sens;
  p.pitch = Math.max(-1.5, Math.min(1.5, p.pitch));
  // Recoil recovery.
  p.recoil = Math.max(0, p.recoil - dt * 0.06);

  // Crouch (hold Ctrl or C).
  const wantCrouch = inp.keys.has('ControlLeft') || inp.keys.has('KeyC');
  p.crouch = wantCrouch;

  // Wish direction from keys, relative to yaw.
  let ix = 0, iz = 0;
  if (inp.keys.has('KeyW')) iz += 1;
  if (inp.keys.has('KeyS')) iz -= 1;
  if (inp.keys.has('KeyD')) ix += 1;
  if (inp.keys.has('KeyA')) ix -= 1;
  const len = Math.hypot(ix, iz) || 1;
  ix /= len; iz /= len;
  const fx = -Math.sin(p.yaw), fz = -Math.cos(p.yaw); // forward (x,z)
  const rx = Math.cos(p.yaw), rz = -Math.sin(p.yaw); // right (x,z)
  const wx = fx * iz + rx * ix, wz = fz * iz + rz * ix;

  const maxSpeed = p.scoped ? 2.8 : p.crouch ? 3.3 : 5.4;
  const accel = p.onGround ? 42 : 12;
  p.vx += wx * accel * dt;
  p.vz += wz * accel * dt;
  // Friction on ground when no input.
  if (p.onGround && ix === 0 && iz === 0) {
    const f = Math.max(0, 1 - 10 * dt);
    p.vx *= f; p.vz *= f;
  }
  const sp = Math.hypot(p.vx, p.vz);
  if (sp > maxSpeed) { p.vx *= maxSpeed / sp; p.vz *= maxSpeed / sp; }
  p.speed = Math.hypot(p.vx, p.vz);

  const height = p.crouch ? 1.15 : 1.75;
  collideMove(S, p, p.vx * dt, p.vz * dt, 0.34, p.y, height);

  // Jump / gravity.
  if (inp.keys.has('Space') && p.onGround && !p.crouch) {
    p.vy = 5.6; p.onGround = false;
  }
  p.vy -= 15 * dt;
  p.y += p.vy * dt;
  if (p.y <= 0) { p.y = 0; p.vy = 0; p.onGround = true; }

  // Footsteps + noise for bots.
  if (p.onGround && p.speed > 2) {
    p.stepT -= dt * p.speed;
    if (p.stepT <= 0) {
      p.stepT = 2.2;
      audio.step();
      pushNoise(S, p.x, p.z, 8);
    }
  }
  p.eyeY = (p.crouch ? EYE_CROUCH : EYE_STAND);
}

export function resetPlayer(S, spawn) {
  const p = S.player;
  p.x = spawn[0]; p.z = spawn[1]; p.y = 0;
  p.vx = 0; p.vz = 0; p.vy = 0;
  p.yaw = 0; p.pitch = 0; // facing north (-z), toward the sites
  p.hp = CFG.PLAYER_HP; p.alive = true; p.crouch = false; p.onGround = true;
  p.reloading = false; p.reloadT = 0; p.fireT = 0; p.bloom = 0; p.recoil = 0;
  p.plantT = 0; p.plantSite = null; p.damageFlash = 0; p.scoped = false;
  p.mag = WEAPONS_MAG(p.weapon); p.reserve = WEAPONS_RESERVE(p.weapon);
}

function WEAPONS_MAG(name) { return { vandal: 30, hornet: 28, longshot: 10, breacher: 6 }[name] ?? 30; }
function WEAPONS_RESERVE(name) { return { vandal: 90, hornet: 112, longshot: 30, breacher: 24 }[name] ?? 90; }
