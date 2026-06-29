/**
 * Kociemba two-phase solver wrapper (cubejs).
 */
const CubeSolver = (() => {
  let ready = false;
  let initPromise = null;

  function init(onProgress) {
    if (ready) return Promise.resolve();
    if (initPromise) return initPromise;

    initPromise = new Promise((resolve) => {
      if (onProgress) onProgress('Building solver tables (first time ~3–5 s)…');
      setTimeout(() => {
        Cube.initSolver();
        ready = true;
        if (onProgress) onProgress('Solver ready.');
        resolve();
      }, 50);
    });

    return initPromise;
  }

  function isReady() {
    return ready;
  }

  function solve(facelets) {
    CubeState.validate(facelets);

    const cube = Cube.fromString(facelets);
    if (cube.isSolved()) {
      return { solution: '', moveCount: 0 };
    }

    let solution = '';

    for (let depth = 1; depth <= 4; depth++) {
      try {
        const s = cube.solve(depth);
        if (s && s.trim()) {
          solution = s.trim();
          break;
        }
      } catch (_) {
        /* try next depth */
      }
    }

    if (!solution) {
      solution = cube.solve(22).trim();
    }

    const moves = CubeState.parseMoves(solution);
    return { solution, moveCount: moves.length };
  }

  function scramble() {
    const cube = Cube.random();
    return cube.asString();
  }

  return { init, isReady, solve, scramble };
})();
