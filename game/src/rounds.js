// Round + match flow, economy, buy menu purchases, plant/defuse timing.
import { CFG, pushEvent } from './state.js';
import { WEAPONS, WEAPON_ORDER, GRENADE_PRICE } from './weapons.js';
import { resetPlayer } from './player.js';
import { resetBotsForRound } from './bots.js';

export function startMatch(S) {
  S.score = { sable: 0, rust: 0 };
  S.round = 1;
  S.money = CFG.START_MONEY;
  S.matchWinner = null;
  S.player.owned = { vandal: true };
  S.player.weapon = 'vandal';
  S.player.grenades = 0;
  startRound(S);
}

export function startRound(S) {
  S.phase = 'buy';
  S.buyTimer = CFG.BUY_TIME;
  S.roundTimer = CFG.ROUND_TIME;
  S.roundWinner = null;
  S.roundReason = '';
  S.roundEndT = 0;
  S.bomb = { state: 'carried', site: null, x: 0, z: 0, timer: CFG.BOMB_TIME, beepT: 0, defuseT: 0, defuser: null };
  const spawn = S.spawns.sable[S.rng.int(0, S.spawns.sable.length - 1)];
  resetPlayer(S, spawn);
  S.player.hasSpike = true;
  resetBotsForRound(S);
  S.banner = `ROUND ${S.round} — BUY PHASE (B)`;
  S.bannerT = 3;
}

function endRound(S, winner, reason, audio) {
  if (S.phase === 'roundEnd' || S.phase === 'matchEnd') return;
  S.roundWinner = winner;
  S.roundReason = reason;
  S.score[winner] += 1;
  const won = winner === 'sable';
  S.money += won ? CFG.WIN_MONEY : CFG.LOSS_MONEY;
  S.phase = 'roundEnd';
  S.roundEndT = 4.5;
  pushEvent(S, `${won ? 'SABLE' : 'RUST'} wins the round — ${reason}`, won ? 'kill' : 'death');
  if (won) audio.win(); else audio.lose();
}

function checkMatchEnd(S) {
  if (S.score.sable >= CFG.WIN_ROUNDS || S.score.rust >= CFG.WIN_ROUNDS || S.round >= CFG.MAX_ROUNDS) {
    S.phase = 'matchEnd';
    S.matchWinner = S.score.sable === S.score.rust ? 'DRAW'
      : S.score.sable > S.score.rust ? 'sable' : 'rust';
    S.banner = S.matchWinner === 'DRAW' ? 'MATCH DRAW' : S.matchWinner === 'sable' ? 'SABLE WINS THE MATCH' : 'RUST WINS THE MATCH';
    S.bannerT = 999;
    return true;
  }
  return false;
}

export function updateRounds(S, dt, audio, inp) {
  const p = S.player;
  if (S.phase === 'buy') {
    S.buyTimer -= dt;
    if (S.buyTimer <= 0) {
      S.phase = 'play';
      S.banner = 'PLANT THE SPIKE — SITE A OR B';
      S.bannerT = 3;
    }
  } else if (S.phase === 'play') {
    S.roundTimer -= dt;
    // Planting: hold E inside a site while carrying the spike.
    if (p.alive && S.bomb.state === 'carried' && inp.keys.has('KeyE')) {
      let inSite = null;
      for (const [name, site] of Object.entries(S.sites)) {
        if (Math.hypot(p.x - site.x, p.z - site.z) < site.r) { inSite = name; break; }
      }
      if (inSite) {
        p.plantT += dt;
        p.plantSite = inSite;
        if (Math.floor(p.plantT * 4) !== Math.floor((p.plantT - dt) * 4)) audio.beep();
        if (p.plantT >= CFG.PLANT_TIME) {
          S.bomb.state = 'planted';
          S.bomb.site = inSite;
          S.bomb.x = S.sites[inSite].x;
          S.bomb.z = S.sites[inSite].z;
          S.bomb.timer = CFG.BOMB_TIME;
          S.bomb.beepT = 0;
          p.hasSpike = false;
          p.plantT = 0;
          S.money += CFG.PLANT_MONEY;
          pushEvent(S, `SPIKE PLANTED at Site ${inSite} (+$${CFG.PLANT_MONEY})`, 'kill');
          audio.plant();
          S.banner = `SPIKE PLANTED — SITE ${inSite}`;
          S.bannerT = 3;
        }
      } else { p.plantT = 0; p.plantSite = null; }
    } else { p.plantT = 0; p.plantSite = null; }

    // Bomb countdown.
    if (S.bomb.state === 'planted') {
      S.bomb.timer -= dt;
      S.bomb.beepT -= dt;
      if (S.bomb.beepT <= 0) {
        audio.beep();
        S.bomb.beepT = Math.max(0.25, S.bomb.timer / CFG.BOMB_TIME * 1.0);
      }
      if (S.bomb.timer <= 0) {
        S.bomb.state = 'exploded';
        endRound(S, 'sable', 'SPIKE DETONATED', audio);
        return;
      }
    }
    if (S.bomb.state === 'defused') {
      S.money = Math.max(0, S.money); // defuse money goes to the team; player keeps round loss
      endRound(S, 'rust', `SPIKE DEFUSED by ${S.bomb.defuser ?? 'RUST'}`, audio);
      return;
    }
    // Elimination / timeout.
    const sableAlive = (p.alive ? 1 : 0) + S.bots.filter(b => b.alive && b.team === 'sable').length;
    const rustAlive = S.bots.filter(b => b.alive && b.team === 'rust').length;
    if (rustAlive === 0) { endRound(S, 'sable', 'RUST ELIMINATED', audio); return; }
    if (sableAlive === 0) { endRound(S, 'rust', 'SABLE ELIMINATED', audio); return; }
    if (S.roundTimer <= 0) {
      if (S.bomb.state === 'planted') { /* bomb timer decides */ }
      else endRound(S, 'rust', 'TIME EXPIRED — SPIKE NOT PLANTED', audio);
      return;
    }
  } else if (S.phase === 'roundEnd') {
    S.roundEndT -= dt;
    if (S.roundEndT <= 0) {
      if (checkMatchEnd(S)) return;
      S.round += 1;
      startRound(S);
    }
  }
}

// Buy menu purchases (buy phase only).
export function buyWeapon(S, key, audio) {
  if (S.phase !== 'buy') return false;
  const p = S.player;
  if (key === 'grenade') {
    if (S.money < GRENADE_PRICE) { audio.denied(); return false; }
    S.money -= GRENADE_PRICE;
    p.grenades += 1;
    audio.buy();
    return true;
  }
  const w = WEAPONS[key];
  if (!w) return false;
  if (p.owned[key]) { switchWeapon(S, key, audio); return true; }
  if (S.money < w.price) { audio.denied(); return false; }
  S.money -= w.price;
  p.owned[key] = true;
  switchWeapon(S, key, audio);
  audio.buy();
  return true;
}

export function switchWeapon(S, key, audio) {
  const p = S.player;
  if (!p.owned[key] || p.weapon === key) return;
  const w = WEAPONS[key];
  p.weapon = key;
  p.mag = w.mag;
  p.reserve = w.reserve;
  p.reloading = false;
  p.scoped = false;
  if (audio) audio.dry();
}

export function cycleWeapon(S, dir, audio) {
  const owned = WEAPON_ORDER.filter(k => S.player.owned[k]);
  if (owned.length < 2) return;
  const i = owned.indexOf(S.player.weapon);
  switchWeapon(S, owned[(i + dir + owned.length) % owned.length], audio);
}
