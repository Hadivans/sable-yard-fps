// DOM HUD: health/ammo/money/timer/score, kill feed, buy menu, overlays, minimap.
import { CFG } from './state.js';
import { WEAPONS, WEAPON_ORDER, GRENADE_PRICE } from './weapons.js';

function $(id) { return document.getElementById(id); }

export function createHud(S, cbs) {
  const els = {
    health: $('health-num'), healthBar: $('health-bar'), money: $('money'),
    ammoMag: $('ammo-mag'), ammoRes: $('ammo-res'), weapon: $('weapon-name'),
    nades: $('grenades'), timer: $('timer'), score: $('score'),
    round: $('round-label'), bomb: $('bomb-status'), feed: $('killfeed'),
    banner: $('banner'), cross: $('crosshair'), hit: $('hitmarker'),
    vig: $('damage-vignette'), dmgDir: $('damage-dir'),
    plant: $('plant-bar'), plantWrap: $('plant-wrap'),
    menu: $('menu-screen'), roundEnd: $('round-end'), matchEnd: $('match-end'),
    buy: $('buy-menu'), minimap: $('minimap'),
  };
  const mm = els.minimap.getContext('2d');

  // Build buy menu buttons.
  const list = $('buy-list');
  for (const key of WEAPON_ORDER) {
    const w = WEAPONS[key];
    const b = document.createElement('button');
    b.className = 'buy-item';
    b.dataset.key = key;
    b.innerHTML = `<b>${w.name}</b><span>$${w.price}</span><i>${w.dmg} dmg · ${w.mag} rnd</i>`;
    b.addEventListener('click', () => cbs.onBuy(key));
    list.appendChild(b);
  }
  const gb = document.createElement('button');
  gb.className = 'buy-item';
  gb.dataset.key = 'grenade';
  gb.innerHTML = `<b>FRAG GRENADE</b><span>$${GRENADE_PRICE}</span><i>throw with G</i>`;
  gb.addEventListener('click', () => cbs.onBuy('grenade'));
  list.appendChild(gb);

  $('start-btn').addEventListener('click', () => cbs.onStart());
  $('again-btn').addEventListener('click', () => cbs.onStart());

  const cache = {};
  function setText(el, key, val) {
    if (cache[key] !== val) { cache[key] = val; el.textContent = val; }
  }

  function drawMinimap() {
    const W = 200, H = 160, sx = W / 42, sz = H / 34;
    const X = (x) => (x + 21) * sx, Z = (z) => (z + 17) * sz;
    mm.fillStyle = '#141a26';
    mm.fillRect(0, 0, W, H);
    mm.fillStyle = '#3a4356';
    for (const c of S.colliders) {
      if (c.y1 < 1.5) continue;
      mm.fillRect(X(c.x0), Z(c.z0), (c.x1 - c.x0) * sx, (c.z1 - c.z0) * sz);
    }
    for (const [name, site] of Object.entries(S.sites)) {
      mm.strokeStyle = '#f2a541';
      mm.lineWidth = 1.5;
      mm.beginPath(); mm.arc(X(site.x), Z(site.z), site.r * sx, 0, Math.PI * 2); mm.stroke();
      mm.fillStyle = '#f2a541';
      mm.font = 'bold 11px sans-serif';
      mm.fillText(name, X(site.x) - 4, Z(site.z) + 4);
    }
    if (S.bomb.state === 'planted') {
      mm.fillStyle = '#ff5522';
      mm.beginPath(); mm.arc(X(S.bomb.x), Z(S.bomb.z), 5, 0, Math.PI * 2); mm.fill();
    }
    // Teammates.
    for (const b of S.bots) {
      if (!b.alive) continue;
      if (b.team === 'sable') {
        mm.fillStyle = '#4fa8a0';
        mm.beginPath(); mm.arc(X(b.x), Z(b.z), 3, 0, Math.PI * 2); mm.fill();
      } else if (S.time - b.lastSeenT < 4) {
        mm.fillStyle = '#c65a3c';
        mm.beginPath(); mm.arc(X(b.x), Z(b.z), 3, 0, Math.PI * 2); mm.fill();
      }
    }
    // Player arrow.
    const p = S.player;
    if (p.alive) {
      mm.save();
      mm.translate(X(p.x), Z(p.z));
      mm.rotate(Math.atan2(-Math.sin(p.yaw), -Math.cos(p.yaw)) + Math.PI / 2);
      mm.fillStyle = '#ece7db';
      mm.beginPath(); mm.moveTo(0, -6); mm.lineTo(4, 5); mm.lineTo(-4, 5); mm.closePath(); mm.fill();
      mm.restore();
    }
  }

  function update(dt) {
    const p = S.player;
    const w = WEAPONS[p.weapon];
    setText(els.health, 'hp', String(Math.max(0, Math.ceil(p.hp))));
    els.healthBar.style.width = `${Math.max(0, p.hp)}%`;
    els.healthBar.style.background = p.hp > 50 ? '#4fa8a0' : p.hp > 25 ? '#f2a541' : '#c65a3c';
    setText(els.money, 'money', `$${S.money}`);
    setText(els.ammoMag, 'mag', p.reloading ? '--' : String(p.mag));
    setText(els.ammoRes, 'res', String(p.reserve));
    setText(els.weapon, 'wname', w.name + (p.scoped ? ' [SCOPED]' : ''));
    setText(els.nades, 'nades', `FRAG x${p.grenades}`);
    const t = S.phase === 'buy' ? S.buyTimer : S.roundTimer;
    const mmss = `${Math.floor(Math.max(0, t) / 60)}:${String(Math.floor(Math.max(0, t) % 60)).padStart(2, '0')}`;
    setText(els.timer, 'timer', mmss);
    els.timer.style.color = t < 10 && S.phase === 'play' ? '#c65a3c' : '#ece7db';
    setText(els.score, 'score', `SABLE ${S.score.sable} — ${S.score.rust} RUST`);
    setText(els.round, 'round', `ROUND ${S.round}/${CFG.MAX_ROUNDS}`);
    let bombTxt = '';
    if (S.bomb.state === 'carried') bombTxt = p.hasSpike ? 'SPIKE: YOU CARRY IT — PLANT AT A OR B (HOLD E)' : 'SPIKE CARRIED';
    else if (S.bomb.state === 'planted') bombTxt = `SPIKE PLANTED SITE ${S.bomb.site} — ${Math.ceil(S.bomb.timer)}s${S.bomb.defuser ? ` — ${S.bomb.defuser} DEFUSING` : ''}`;
    else if (S.bomb.state === 'lost') bombTxt = 'SPIKE LOST — ELIMINATE RUST';
    else if (S.bomb.state === 'defused') bombTxt = 'SPIKE DEFUSED';
    else if (S.bomb.state === 'exploded') bombTxt = 'SPIKE DETONATED';
    setText(els.bomb, 'bomb', bombTxt);

    // Crosshair spread.
    const gap = 5 + p.bloom * 500 + Math.min(1, p.speed / 5.4) * 7 + p.recoil * 120;
    els.cross.style.setProperty('--gap', `${gap.toFixed(1)}px`);
    els.cross.style.opacity = p.scoped ? '0.25' : '1';
    els.hit.style.opacity = (S.time - (p.hitT ?? -9) < 0.15) ? '1' : '0';
    els.vig.style.opacity = String(p.damageFlash * 0.85);
    els.dmgDir.style.opacity = String(p.damageFlash);
    els.dmgDir.style.transform = `translate(-50%,-50%) rotate(${(-p.damageDir * 180 / Math.PI).toFixed(0)}deg)`;

    // Plant / defuse progress.
    if (p.plantT > 0) {
      els.plantWrap.style.display = 'block';
      els.plant.style.width = `${(p.plantT / CFG.PLANT_TIME) * 100}%`;
      setText($('plant-label'), 'plant', `PLANTING — SITE ${p.plantSite}`);
    } else if (S.bomb.defuser && S.bomb.state === 'planted') {
      els.plantWrap.style.display = 'block';
      els.plant.style.width = `${(S.bomb.defuseT / CFG.DEFUSE_TIME) * 100}%`;
      setText($('plant-label'), 'plant', `${S.bomb.defuser} IS DEFUSING`);
    } else {
      els.plantWrap.style.display = 'none';
    }

    // Kill feed (last 5, < 6s old).
    const recent = S.events.filter(e => S.time - e.t < 6).slice(-5);
    const feedHtml = recent.map(e => `<div class="${e.cls}">${e.text}</div>`).join('');
    if (cache.feed !== feedHtml) { cache.feed = feedHtml; els.feed.innerHTML = feedHtml; }

    // Banner.
    if (S.bannerT > 0) {
      S.bannerT -= dt;
      els.banner.style.opacity = String(Math.min(1, S.bannerT));
      setText(els.banner, 'banner', S.banner);
    } else els.banner.style.opacity = '0';

    // Overlays.
    els.menu.style.display = S.phase === 'menu' ? 'flex' : 'none';
    els.roundEnd.style.display = S.phase === 'roundEnd' ? 'flex' : 'none';
    if (S.phase === 'roundEnd') {
      setText($('round-end-title'), 'ret', S.roundWinner === 'sable' ? 'ROUND WON' : 'ROUND LOST');
      setText($('round-end-reason'), 'rer', S.roundReason);
      setText($('round-end-score'), 'res', `SABLE ${S.score.sable} — ${S.score.rust} RUST`);
    }
    els.matchEnd.style.display = S.phase === 'matchEnd' ? 'flex' : 'none';
    if (S.phase === 'matchEnd') {
      setText($('match-end-title'), 'met', S.matchWinner === 'sable' ? 'SABLE WINS THE MATCH' : S.matchWinner === 'rust' ? 'RUST WINS THE MATCH' : 'MATCH DRAW');
      setText($('match-end-score'), 'mes', `FINAL — SABLE ${S.score.sable} — ${S.score.rust} RUST`);
    }
    els.buy.style.display = S.buyOpen && S.phase === 'buy' ? 'block' : 'none';
    if (els.buy.style.display === 'block') {
      for (const b of list.children) {
        const key = b.dataset.key;
        const owned = key === 'grenade' ? p.grenades > 0 : !!p.owned[key];
        const price = key === 'grenade' ? GRENADE_PRICE : WEAPONS[key].price;
        b.classList.toggle('owned', owned);
        b.classList.toggle('cant', S.money < price && !owned);
        b.classList.toggle('current', p.weapon === key);
      }
      setText($('buy-money'), 'buymoney', `$${S.money} — buy phase ends in ${Math.ceil(Math.max(0, S.buyTimer))}s`);
    }

    drawMinimap();
  }

  return { update, els };
}
