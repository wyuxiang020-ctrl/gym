// Editable master contours, traced by eye against D2 and unified across views.
// Units use the 600 × 600 character stage; animation deforms these local curves.
export const D_PATHS = {
  head: 'M -101 -24 C -94 -50 -75 -75 -49 -84 C -22 -95 22 -95 49 -84 C 75 -75 94 -50 101 -24 C 125 13 132 39 111 62 C 92 84 47 94 0 92 C -47 94 -92 84 -111 62 C -132 39 -125 13 -101 -24 Z',
  headProfile: 'M -79 -24 C -75 -50 -53 -75 -30 -84 C -3 -99 33 -92 58 -75 C 88 -51 102 -22 101 8 C 108 41 89 70 71 82 C 45 99 5 97 -22 88 C -62 80 -101 58 -111 39 C -136 7 -119 -2 -79 -24 Z',
  tuft: 'M -38 -85 Q -58 -90 -44 -95 L -28 -95 Q -53 -103 -35 -107 L -14 -101 Q -29 -120 -12 -113 Q 15 -101 14 -84',
  eyePatch: 'M -23 -30 C -10 -45 5 -47 17 -31 C 27 -16 30 5 22 10 C 4 16 -23 14 -30 7 C -39 0 -30 -15 -23 -30 Z',
  nose: 'M -13 1 Q -16 -7 -2 -8 Q 14 -9 16 -3 Q 17 4 2 10 Q -5 12 -13 1 Z',
  hatCrown: 'M -117 7 Q -76 -15 -32 -48 Q -7 -67 4 -64 Q 54 -45 117 7 Q 35 -15 -31 -6 Z',
  hatBand: 'M -94 -8 Q -1 -39 87 -9 L 103 2 Q 12 -22 -112 9 Z',
  leaf: 'M 0 0 Q 20 -33 39 -26 Q 31 -4 0 0 Z',
} as const
