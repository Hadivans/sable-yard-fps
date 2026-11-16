// SABLE YARD map — decommissioned rail/container yard at dusk, 40m x 32m.
// Attackers spawn south (z=+13), defenders north (z=-13). Site A = warehouse NW,
// Site B = container stack NE. Lanes: A-long (west), mid (centre), B-tunnel (east).
import * as THREE from 'three';
import { PALN } from './palette.js';

const mats = new Map();
function mat(color) {
  if (!mats.has(color)) mats.set(color, new THREE.MeshStandardMaterial({ color, roughness: 0.92, metalness: 0.08 }));
  return mats.get(color);
}

// Add a solid box: mesh + AABB collider + world raycast mesh.
export function box(S, scene, cx, cz, w, d, h, color, y0 = 0, trim = false) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat(color));
  m.position.set(cx, y0 + h / 2, cz);
  m.castShadow = true; m.receiveShadow = true;
  scene.add(m);
  S.worldMeshes.push(m);
  S.colliders.push({ x0: cx - w / 2, z0: cz - d / 2, x1: cx + w / 2, z1: cz + d / 2, y0, y1: y0 + h });
  if (trim) { // thin amber edge strip on top, own-art trim
    const t = new THREE.Mesh(new THREE.BoxGeometry(w + 0.06, 0.07, d + 0.06), mat(PALN.accent));
    t.position.set(cx, y0 + h + 0.035, cz);
    scene.add(t);
  }
  return m;
}

function cyl(S, scene, cx, cz, r, h, color) {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, h, 12), mat(color));
  m.position.set(cx, h / 2, cz);
  m.castShadow = true; m.receiveShadow = true;
  scene.add(m);
  S.worldMeshes.push(m);
  S.colliders.push({ x0: cx - r, z0: cz - r, x1: cx + r, z1: cz + r, y0: 0, y1: h });
  return m;
}

export function buildWorld(scene, S) {
  scene.background = new THREE.Color(PALN.canvas);
  scene.fog = new THREE.Fog(PALN.fog, 28, 85);

  // Lights: warm low sun + cool slate hemisphere.
  const sun = new THREE.DirectionalLight(PALN.sun, 2.9);
  sun.position.set(-18, 14, 10);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.left = -26; sun.shadow.camera.right = 26;
  sun.shadow.camera.top = 26; sun.shadow.camera.bottom = -26;
  scene.add(sun);
  scene.add(new THREE.HemisphereLight(0x8fa3c7, 0x2a2118, 1.15));
  const fill = new THREE.DirectionalLight(0x5a6f9e, 0.5);
  fill.position.set(15, 20, -12);
  scene.add(fill);

  // Ground: asphalt slabs with painted lane lines.
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(44, 36), mat(PALN.ground));
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  scene.add(ground);
  S.worldMeshes.push(ground);
  for (let i = -3; i <= 3; i++) { // faint yard grid lines
    const line = new THREE.Mesh(new THREE.BoxGeometry(40, 0.02, 0.12), mat(PALN.groundLine));
    line.position.set(0, 0.01, i * 4.5);
    scene.add(line);
  }
  // Amber centre line down mid lane.
  const mid = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.02, 26), mat(PALN.accent));
  mid.position.set(0, 0.015, 0);
  scene.add(mid);

  // Boundary walls.
  box(S, scene, 0, -16.6, 42, 1.2, 4.2, PALN.wall);
  box(S, scene, 0, 16.6, 42, 1.2, 4.2, PALN.wall);
  box(S, scene, -20.6, 0, 1.2, 34, 4.2, PALN.wall);
  box(S, scene, 20.6, 0, 1.2, 34, 4.2, PALN.wall);

  // --- Site A: warehouse, NW. Walled yard, entrances south + east. ---
  box(S, scene, -14, -14.6, 12, 1, 3.6, PALN.wall);            // north wall
  box(S, scene, -19.4, -10, 1, 9, 3.6, PALN.wall);             // west wall
  box(S, scene, -17.5, -5.4, 5, 1, 3.6, PALN.wall);            // south wall (west part, gap east)
  box(S, scene, -8.6, -12.5, 1, 4.5, 3.6, PALN.wall);          // east wall (north part, gap south)
  const roofA = new THREE.Mesh(new THREE.BoxGeometry(11.4, 0.25, 9.4), mat(PALN.roof));
  roofA.position.set(-14, 3.7, -10);
  scene.add(roofA);
  box(S, scene, -16.5, -12, 1.2, 1.2, 3.2, PALN.wall);         // pillar
  box(S, scene, -11.5, -8, 1.2, 1.2, 3.2, PALN.wall);          // pillar
  box(S, scene, -16, -8.5, 3, 1.6, 1.3, PALN.crate, 0, true);  // crate cover
  box(S, scene, -12, -12.5, 2.4, 1.4, 1.3, PALN.crate, 0, true);
  // Site A marker: amber floor plate.
  const plateA = new THREE.Mesh(new THREE.CylinderGeometry(2.2, 2.2, 0.06, 24), mat(PALN.accent));
  plateA.position.set(-14, 0.03, -10);
  scene.add(plateA);

  // --- Site B: container stack, NE. ---
  box(S, scene, 14, -13.5, 6.2, 2.4, 2.6, PALN.containerA, 0, true);
  box(S, scene, 14, -13.5, 6.2, 2.4, 2.6, PALN.containerB, 2.6); // stacked
  box(S, scene, 17.8, -9.5, 2.4, 5, 2.6, PALN.containerC, 0, true);
  box(S, scene, 10.4, -9, 2.4, 4.4, 2.6, PALN.containerB, 0, true);
  box(S, scene, 14, -6.6, 5, 1.8, 1.3, PALN.crate, 0, true);
  const plateB = new THREE.Mesh(new THREE.CylinderGeometry(2.2, 2.2, 0.06, 24), mat(PALN.accent));
  plateB.position.set(14, 0.03, -10);
  scene.add(plateB);

  // --- Mid lane: crates + raised platform block. ---
  box(S, scene, -2.5, 1, 3, 1.8, 1.3, PALN.crate, 0, true);
  box(S, scene, 2.5, -1.5, 2.4, 1.6, 1.3, PALN.crate, 0, true);
  box(S, scene, 0, 4.5, 4.5, 3, 1.1, PALN.containerC, 0, true); // platform block
  box(S, scene, -4.5, -4.5, 1.8, 1.8, 2.6, PALN.containerA, 0, true);
  box(S, scene, 4.5, 5.5, 1.8, 1.8, 2.6, PALN.containerB, 0, true);

  // --- A-long (west lane) cover. ---
  box(S, scene, -17.5, 4, 2.4, 5, 2.6, PALN.containerB, 0, true);
  box(S, scene, -17.5, -2, 2.4, 3.4, 2.6, PALN.containerA, 0, true);
  box(S, scene, -15, 9, 2, 1.6, 1.3, PALN.crate, 0, true);

  // --- B-tunnel (east corridor): two walls + roof slab. ---
  box(S, scene, 15.2, 4, 1, 12, 3.4, PALN.wall);
  box(S, scene, 19.4, 4, 1, 12, 3.4, PALN.wall);
  const roofB = new THREE.Mesh(new THREE.BoxGeometry(5.4, 0.25, 12), mat(PALN.roof));
  roofB.position.set(17.3, 3.5, 4);
  scene.add(roofB);
  box(S, scene, 17.3, 8.5, 2, 1.6, 1.3, PALN.crate, 0, true);

  // --- Scattered props: barrels, crates, rail sleepers. ---
  cyl(S, scene, -8, 2, 0.55, 1.1, PALN.barrel);
  cyl(S, scene, -7, 2.6, 0.55, 1.1, PALN.barrel);
  cyl(S, scene, 8, -3, 0.55, 1.1, PALN.barrel);
  cyl(S, scene, 11, 6, 0.55, 1.1, PALN.barrel);
  cyl(S, scene, -12, 11, 0.55, 1.1, PALN.barrel);
  box(S, scene, -9, 11, 2, 1.6, 1.3, PALN.crate, 0, true);
  box(S, scene, 9, 11, 2, 1.6, 1.3, PALN.crate, 0, true);
  box(S, scene, 6, -6.5, 3, 1.6, 1.3, PALN.crate, 0, true);
  box(S, scene, -6, -6, 2.4, 1.6, 1.3, PALN.crate, 0, true);
  // Rail tracks: two dark steel strips across the yard (visual, no collider).
  for (const z of [-1.2, 1.2]) {
    const rail = new THREE.Mesh(new THREE.BoxGeometry(40, 0.05, 0.18), mat(0x11131a));
    rail.position.set(0, 0.02, z);
    scene.add(rail);
  }
  // Dusk sky props: distant crane silhouettes (outside the wall, visual only).
  for (const [x, z, h] of [[-26, -8, 16], [26, 6, 14], [-24, 10, 12]]) {
    const crane = new THREE.Mesh(new THREE.BoxGeometry(1.2, h, 1.2), mat(0x141824));
    crane.position.set(x, h / 2, z);
    scene.add(crane);
    const arm = new THREE.Mesh(new THREE.BoxGeometry(10, 0.8, 0.8), mat(0x141824));
    arm.position.set(x + 4, h - 1, z);
    scene.add(arm);
  }

  // Spawns and waypoints.
  S.spawns.sable = [[-6, 13], [-3, 14], [0, 13], [3, 14], [6, 13]];
  S.spawns.rust = [[-16, -13], [-8, -14], [0, -13], [8, -14], [16, -13]];
  S.waypoints.A = [[-16, -12], [-12, -12], [-16, -7.5], [-12, -8], [-14, -10]];
  S.waypoints.B = [[12, -12], [16, -12], [12, -7.5], [16, -7.5], [14, -10]];
  S.waypoints.mid = [[-2, 6], [2, -2], [0, -6], [-4, -2]];
  S.waypoints.lanes = {
    along: [[-16, 12], [-17, 6], [-17, 0], [-15, -4], [-14, -8]],
    mid: [[0, 12], [0, 6], [0, 0], [0, -6], [0, -10]],
    btunnel: [[17, 12], [17, 6], [17, 0], [16, -4], [14, -8]],
  };
}

// Axis-separated AABB move: pos {x,z}, y = feet, height; returns nothing, mutates pos.
export function collideMove(S, pos, dx, dz, half, y, height) {
  const tryAxis = (nx, nz) => {
    for (const c of S.colliders) {
      if (y >= c.y1 || y + height <= c.y0) continue;
      if (nx + half > c.x0 && nx - half < c.x1 && nz + half > c.z0 && nz - half < c.z1) return false;
    }
    return true;
  };
  if (tryAxis(pos.x + dx, pos.z)) pos.x += dx;
  if (tryAxis(pos.x, pos.z + dz)) pos.z += dz;
  // Map bounds clamp.
  pos.x = Math.max(-19.4, Math.min(19.4, pos.x));
  pos.z = Math.max(-15.4, Math.min(15.4, pos.z));
}

// 2D segment vs colliders at eye height — line of sight blocked?
export function segmentBlocked(S, ax, az, bx, bz, eyeY) {
  const dx = bx - ax, dz = bz - az;
  for (const c of S.colliders) {
    if (eyeY <= c.y0 || eyeY >= c.y1) continue;
    // Slab test.
    let t0 = 0, t1 = 1;
    for (const [o, d, lo, hi] of [[ax, dx, c.x0, c.x1], [az, dz, c.z0, c.z1]]) {
      if (Math.abs(d) < 1e-9) { if (o < lo || o > hi) { t0 = 1; t1 = 0; break; } }
      else {
        let ta = (lo - o) / d, tb = (hi - o) / d;
        if (ta > tb) { const tmp = ta; ta = tb; tb = tmp; }
        t0 = Math.max(t0, ta); t1 = Math.min(t1, tb);
        if (t0 > t1) break;
      }
    }
    if (t0 <= t1 && t1 >= 0 && t0 <= 1) return true;
  }
  return false;
}
