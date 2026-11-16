// Visual-only effects: tracers, muzzle flash, impact sparks, explosion light.
// No simulation here — combat/bots decide hits, fx only shows them.
import * as THREE from 'three';

const MAX_TRACERS = 24;

export function createFx(scene) {
  const fx = {
    scene,
    tracers: [], // {line, t}
    sparks: [],  // {points, t, vel}
    flashLight: new THREE.PointLight(0xffc861, 0, 9, 2),
    boomLight: new THREE.PointLight(0xff7722, 0, 22, 1.6),
    vignette: 0,
  };
  scene.add(fx.flashLight, fx.boomLight);
  return fx;
}

const _v = new THREE.Vector3();
export function spawnTracer(fx, from, to, color = 0xffd27a) {
  const g = new THREE.BufferGeometry().setFromPoints([from.clone(), to.clone()]);
  const line = new THREE.Line(g, new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.9 }));
  fx.scene.add(line);
  fx.tracers.push({ line, t: 0.09 });
  if (fx.tracers.length > MAX_TRACERS) {
    const old = fx.tracers.shift();
    fx.scene.remove(old.line); old.line.geometry.dispose(); old.line.material.dispose();
  }
}

export function spawnImpact(fx, pos, normal) {
  const n = 8;
  const posArr = new Float32Array(n * 3);
  const vel = [];
  for (let i = 0; i < n; i++) {
    posArr[i * 3] = pos.x; posArr[i * 3 + 1] = pos.y; posArr[i * 3 + 2] = pos.z;
    vel.push(new THREE.Vector3(
      (Math.random() - 0.5) * 3 + normal.x * 2,
      Math.random() * 2.5 + 0.5,
      (Math.random() - 0.5) * 3 + normal.z * 2,
    ));
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(posArr, 3));
  const pts = new THREE.Points(g, new THREE.PointsMaterial({ color: 0xffc861, size: 0.07 }));
  fx.scene.add(pts);
  fx.sparks.push({ pts, t: 0.35, vel });
}

export function muzzleFlash(fx, pos) {
  fx.flashLight.position.copy(pos);
  fx.flashLight.intensity = 14;
}

export function explosionFx(fx, pos) {
  fx.boomLight.position.copy(pos);
  fx.boomLight.intensity = 60;
  spawnImpact(fx, pos, _v.set(0, 1, 0));
  spawnImpact(fx, pos, _v.set(0, 1, 0));
}

export function updateFx(fx, dt) {
  for (let i = fx.tracers.length - 1; i >= 0; i--) {
    const tr = fx.tracers[i];
    tr.t -= dt;
    tr.line.material.opacity = Math.max(0, tr.t / 0.09) * 0.9;
    if (tr.t <= 0) { fx.scene.remove(tr.line); tr.line.geometry.dispose(); tr.line.material.dispose(); fx.tracers.splice(i, 1); }
  }
  for (let i = fx.sparks.length - 1; i >= 0; i--) {
    const s = fx.sparks[i];
    s.t -= dt;
    const arr = s.pts.geometry.attributes.position.array;
    for (let j = 0; j < s.vel.length; j++) {
      arr[j * 3] += s.vel[j].x * dt;
      arr[j * 3 + 1] += s.vel[j].y * dt;
      arr[j * 3 + 2] += s.vel[j].z * dt;
      s.vel[j].y -= 9 * dt;
    }
    s.pts.geometry.attributes.position.needsUpdate = true;
    s.pts.material.opacity = Math.max(0, s.t / 0.35);
    s.pts.material.transparent = true;
    if (s.t <= 0) { fx.scene.remove(s.pts); s.pts.geometry.dispose(); s.pts.material.dispose(); fx.sparks.splice(i, 1); }
  }
  fx.flashLight.intensity = Math.max(0, fx.flashLight.intensity - dt * 160);
  fx.boomLight.intensity = Math.max(0, fx.boomLight.intensity - dt * 90);
}
