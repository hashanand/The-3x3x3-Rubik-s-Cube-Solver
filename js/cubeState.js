/**
 * Cube state utilities — facelet string in cubejs URFDLB order.
 */
const CubeState = (() => {
  const FACES = ['U', 'R', 'F', 'D', 'L', 'B'];
  const SOLVED = 'UUUUUUUUURRRRRRRRRFFFFFFFFFDDDDDDDDDLLLLLLLLLBBBBBBBBB';

  const COLOR_HEX = {
    U: '#ffffff',
    R: '#b71234',
    F: '#009b48',
    D: '#ffd500',
    L: '#ff5800',
    B: '#0046ad',
  };

  const COLOR_NAMES = {
    U: 'White (Up)',
    R: 'Red (Right)',
    F: 'Green (Front)',
    D: 'Yellow (Down)',
    L: 'Orange (Left)',
    B: 'Blue (Back)',
  };

  /** Map each facelet index → { x, y, z, dir } for 3D sticker placement */
  const FACELET_MAP = buildFaceletMap();

  function buildFaceletMap() {
    const map = [];

    // U (0-8): view from +Y, row 0 = back (z=-1)
    for (let r = 0; r < 3; r++) {
      for (let c = 0; c < 3; c++) {
        map.push({ x: c - 1, y: 1, z: r - 1, dir: 'U' });
      }
    }
    // R (9-17): view from +X, col 0 = back (z=-1)
    for (let r = 0; r < 3; r++) {
      for (let c = 0; c < 3; c++) {
        map.push({ x: 1, y: 1 - r, z: c - 1, dir: 'R' });
      }
    }
    // F (18-26): view from +Z
    for (let r = 0; r < 3; r++) {
      for (let c = 0; c < 3; c++) {
        map.push({ x: c - 1, y: 1 - r, z: 1, dir: 'F' });
      }
    }
    // D (27-35): view from -Y, row 0 = front (z=1)
    for (let r = 0; r < 3; r++) {
      for (let c = 0; c < 3; c++) {
        map.push({ x: c - 1, y: -1, z: 1 - r, dir: 'D' });
      }
    }
    // L (36-44): view from -X
    for (let r = 0; r < 3; r++) {
      for (let c = 0; c < 3; c++) {
        map.push({ x: -1, y: 1 - r, z: 1 - c, dir: 'L' });
      }
    }
    // B (45-53): view from -Z, col 0 = right (x=1)
    for (let r = 0; r < 3; r++) {
      for (let c = 0; c < 3; c++) {
        map.push({ x: 1 - c, y: 1 - r, z: -1, dir: 'B' });
      }
    }

    return map;
  }

  /** Net layout: { face, row, col, index } for the 2D unfolded editor */
  const NET_LAYOUT = [
    { face: 'U', gridRow: 0, gridCol: 1, stickers: range(0, 8) },
    { face: 'L', gridRow: 1, gridCol: 0, stickers: range(36, 44) },
    { face: 'F', gridRow: 1, gridCol: 1, stickers: range(18, 26) },
    { face: 'R', gridRow: 1, gridCol: 2, stickers: range(9, 17) },
    { face: 'B', gridRow: 1, gridCol: 3, stickers: range(45, 53) },
    { face: 'D', gridRow: 2, gridCol: 1, stickers: range(27, 35) },
  ];

  function range(a, b) {
    const arr = [];
    for (let i = a; i <= b; i++) arr.push(i);
    return arr;
  }

  function isCenter(index) {
    return index % 9 === 4;
  }

  function getFace(index) {
    return FACES[Math.floor(index / 9)];
  }

  function validate(facelets) {
    if (!facelets || facelets.length !== 54) {
      throw new Error('Cube state must be exactly 54 characters.');
    }

    const counts = {};
    for (const ch of facelets) {
      if (!COLOR_HEX[ch]) {
        throw new Error(`Invalid color "${ch}" at position ${facelets.indexOf(ch)}.`);
      }
      counts[ch] = (counts[ch] || 0) + 1;
    }

    for (const f of FACES) {
      if (counts[f] !== 9) {
        throw new Error(`Expected 9 "${f}" stickers, found ${counts[f] || 0}.`);
      }
      if (facelets[9 * FACES.indexOf(f) + 4] !== f) {
        throw new Error(`Center of ${f} face must be ${f}.`);
      }
    }

    const cube = Cube.fromString(facelets);
    const roundTrip = cube.asString();
    if (roundTrip !== facelets) {
      throw new Error(
        'This cube state is physically impossible (wrong parity, twisted edge, or swapped centers). ' +
        'Double-check your colors.'
      );
    }

    return true;
  }

  function applyMove(facelets, move) {
    const cube = Cube.fromString(facelets);
    cube.move(move);
    return cube.asString();
  }

  function parseMoves(solution) {
    if (!solution || !solution.trim()) return [];
    return solution.trim().split(/\s+/).filter(Boolean);
  }

  function nextColor(current) {
    const idx = FACES.indexOf(current);
    return FACES[(idx + 1) % 6];
  }

  return {
    FACES,
    SOLVED,
    COLOR_HEX,
    COLOR_NAMES,
    FACELET_MAP,
    NET_LAYOUT,
    isCenter,
    getFace,
    validate,
    applyMove,
    parseMoves,
    nextColor,
  };
})();
