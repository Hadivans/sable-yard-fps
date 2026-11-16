// Weapon definitions + first-person view models (boxes, own art).
import * as THREE from 'three';
import { PALN } from './palette.js';

export const WEAPONS = {
  vandal:   { name: 'VANDAL-R',  price: 0,   auto: true,  gap: 0.096, mag: 30, reserve: 90,  dmg: 34, head: 100, spread: 0.011, moveSpread: 0.022, recoil: 0.012, reload: 1.6, pellets: 1, color: 0x2e3440, accent: 0xf2a541 },
  hornet:   { name: 'HORNET SMG', price: 400, auto: true,  gap: 0.075, mag: 28, reserve: 112, dmg: 22, head: 66,  spread: 0.017, moveSpread: 0.026, recoil: 0.008, reload: 1.3, pellets: 1, color: 0x3a2e2e, accent: 0xc65a3c },
  longshot: { name: 'LONGSHOT DMR', price: 900, auto: false, gap: 0.9, mag: 10, reserve: 30, dmg: 80, head: 160, spread: 0.002, moveSpread: 0.012, recoil: 0.035, reload: 2.2, pellets: 1, color: 0x24303a, accent: 0x4fa8a0, scope: true },
  breacher: { name: 'BREACHER',  price: 600, auto: false, gap: 0.85, mag: 6,  reserve: 24,  dmg: 12, head: 30,  spread: 0.045, moveSpread: 0.05,  recoil: 0.045, reload: 2.4, pellets: 8, color: 0x3d2f1e, accent: 0xf2a541 },
};
export const WEAPON_ORDER = ['vandal', 'hornet', 'longshot', 'breacher'];
export const GRENADE_PRICE = 200;

// View model: a simple gun of boxes parented to the camera.
export function createViewModel(camera) {
  const group = new THREE.Group();
  const bodyMat = new THREE.MeshStandardMaterial({ color: 0x2e3440, roughness: 0.6, metalness: 0.4 });
  const accentMat = new THREE.MeshStandardMaterial({ color: 0xf2a541, roughness: 0.5, metalness: 0.3 });
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.14, 0.55), bodyMat);
  const barrel = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.05, 0.3), bodyMat);
  barrel.position.set(0, 0.03, -0.4);
  const grip = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.16, 0.09), bodyMat);
  grip.position.set(0, -0.13, 0.12);
  grip.rotation.x = 0.35;
  const sight = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.06, 0.12), accentMat);
  sight.position.set(0, 0.1, -0.1);
  const mag = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.14, 0.08), bodyMat);
  mag.position.set(0, -0.12, -0.05);
  const muzzle = new THREE.Object3D();
  muzzle.position.set(0, 0.03, -0.58);
  const flash = new THREE.Mesh(
    new THREE.ConeGeometry(0.09, 0.22, 8),
    new THREE.MeshBasicMaterial({ color: 0xffc861, transparent: true, opacity: 0 }),
  );
  flash.rotation.x = -Math.PI / 2;
  flash.position.copy(muzzle.position);
  flash.position.z -= 0.1;
  group.add(body, barrel, grip, sight, mag, muzzle, flash);
  group.position.set(0.28, -0.26, -0.5);
  camera.add(group);
  return { group, muzzle, flash, bodyMat, accentMat, flashT: 0 };
}

export function setViewWeapon(vm, name) {
  const w = WEAPONS[name];
  vm.bodyMat.color.setHex(w.color);
  vm.accentMat.color.setHex(w.accent);
  const scale = name === 'longshot' ? 1.25 : name === 'breacher' ? 1.1 : name === 'hornet' ? 0.85 : 1;
  vm.group.scale.setScalar(scale);
}

export function muzzleWorldPos(vm, camera, out) {
  vm.muzzle.getWorldPosition(out);
  return out;
}
