/* Where the Cyclops's propellers are, as measured off the model rather
   than guessed. Exported so FlightScene, FlyGame and the test all use the
   same predicate — three copies of a rule about geometry is three chances
   to disagree with the aircraft.

   Model coordinates, which is what loadCraft hands a pick: the nose is -X,
   the pusher sits on the centreline at the tail (+X, z about 0) and the
   four lift rotors sit off the booms at z = +/-0.5. */
export const CYCLOPS_PUSHER = (c: { x: number; z: number }) => Math.abs(c.z) < 0.25 && c.x > 0.4;
export const CYCLOPS_LIFT = (c: { x: number; z: number }) => Math.abs(c.z) > 0.25;
