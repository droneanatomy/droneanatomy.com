import { describe, expect, it } from 'vitest';
import { CYCLOPS_LIFT, CYCLOPS_PUSHER } from './rotorPicks';

/* The Cyclops's rotor hubs, as measured from the node transforms in
   public/models/vtol.glb — four lift rotors on the booms and a two-blade
   pusher at the tail. The nose is -X. These are the coordinates the real
   picks run against at load time, so a pick that fails here fails there. */
const HUBS = [
  { name: 'lift FL', x: 0.92, y: -0.055, z: 0.5 },
  { name: 'lift FR', x: 0.92, y: -0.055, z: -0.5 },
  { name: 'lift AL', x: -0.62, y: -0.055, z: 0.5 },
  { name: 'lift AR', x: -0.62, y: -0.055, z: -0.5 },
  { name: 'pusher', x: 0.527, y: 0.1, z: 0 },
];

describe('Cyclops rotor picks', () => {
  it('selects exactly the pusher', () => {
    expect(HUBS.filter(CYCLOPS_PUSHER).map((h) => h.name)).toEqual(['pusher']);
  });

  it('selects exactly the four lift rotors', () => {
    expect(HUBS.filter(CYCLOPS_LIFT).map((h) => h.name)).toEqual(['lift FL', 'lift FR', 'lift AL', 'lift AR']);
  });

  /* A hub in both groups would be spun at two rates in the same frame,
     and the last writer would win silently. */
  it('never puts one hub in both groups', () => {
    expect(HUBS.filter((h) => CYCLOPS_PUSHER(h) && CYCLOPS_LIFT(h))).toEqual([]);
  });
});
