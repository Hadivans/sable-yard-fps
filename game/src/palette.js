// SABLE YARD palette — dusk rail/container yard. Own colours, not the starter grey.
export const PAL = {
  canvas: '#1a1f2b',   // dusk slate sky / page background
  surface: '#232a38',  // panels, container steel
  hairline: '#3a4356',  // edges, trim
  ink: '#ece7db',      // warm off-white text
  muted: '#8b96a8',    // secondary text
  accent: '#f2a541',   // amber — sun, spike beacon, highlights
  enemy: '#c65a3c',    // rust — defenders
  teammate: '#4fa8a0', // teal — attackers
  ground: '#2b2f3a',   // yard asphalt
  groundLine: '#343a48',
  containerA: '#7a4a2e', // rusted container
  containerB: '#3e5a52', // green container
  containerC: '#5a5a66', // grey container
  crate: '#6b5636',    // wooden crate
  wall: '#3a3f4d',     // warehouse wall
  roof: '#232833',
  barrel: '#8a6d2f',
  sun: '#ffb347',
  fog: '#1a1f2b',
};
export const PALN = Object.fromEntries(
  Object.entries(PAL).map(([k, v]) => [k, parseInt(v.slice(1), 16)]),
);
