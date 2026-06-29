/**
 * Three.js 3×3×3 Rubik's cube with animated layer turns.
 */
class RubiksCube3D {
  constructor(container) {
    this.container = container;
    this.cubieSize = 0.95;
    this.gap = 0.05;
    this.spacing = this.cubieSize + this.gap;
    this.animating = false;
    this.facelets = CubeState.SOLVED;

    this._initScene();
    this._createCubies();
    this._applyFacelets(this.facelets);
    this._animate = this._animate.bind(this);
    requestAnimationFrame(this._animate);

    this._onResize = () => this._resize();
    window.addEventListener('resize', this._onResize);
  }

  _initScene() {
    const w = this.container.clientWidth  || 600;
    const h = this.container.clientHeight || 440;

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x0d1117);

    this.camera = new THREE.PerspectiveCamera(42, w / h, 0.1, 100);
    this.camera.position.set(5, 4, 6);
    this.camera.lookAt(0, 0, 0);

    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    this.renderer.setSize(w, h);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.container.appendChild(this.renderer.domElement);

    // Ambient
    this.scene.add(new THREE.AmbientLight(0xffffff, 0.45));

    // Key light (top-front-right)
    const dir1 = new THREE.DirectionalLight(0xffffff, 1.1);
    dir1.position.set(6, 10, 8);
    dir1.castShadow = true;
    this.scene.add(dir1);

    // Fill light (left-bottom-back)
    const dir2 = new THREE.DirectionalLight(0x8899ff, 0.4);
    dir2.position.set(-6, -4, -6);
    this.scene.add(dir2);

    // Rim light (top-back, purple tint)
    const dir3 = new THREE.DirectionalLight(0xaa88ff, 0.55);
    dir3.position.set(0, 8, -8);
    this.scene.add(dir3);

    // Subtle floor plane (reflection hint)
    const floorGeo = new THREE.PlaneGeometry(14, 14);
    const floorMat = new THREE.MeshStandardMaterial({
      color: 0x111827,
      roughness: 0.9,
      metalness: 0.1,
      transparent: true,
      opacity: 0.55,
    });
    const floor = new THREE.Mesh(floorGeo, floorMat);
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = -2.2;
    floor.receiveShadow = true;
    this.scene.add(floor);

    // Soft shadow blob under cube
    const blobGeo = new THREE.CircleGeometry(1.6, 32);
    const blobMat = new THREE.MeshBasicMaterial({
      color: 0x000000,
      transparent: true,
      opacity: 0.28,
    });
    const blob = new THREE.Mesh(blobGeo, blobMat);
    blob.rotation.x = -Math.PI / 2;
    blob.position.y = -2.18;
    this.scene.add(blob);

    this.cubeGroup = new THREE.Group();
    this.scene.add(this.cubeGroup);

    this._initControls();
  }

  _initControls() {
    const canvas = this.renderer.domElement;
    let dragging = false;
    let prevX = 0, prevY = 0;
    this.spherical = { theta: Math.PI / 4, phi: Math.PI / 4, radius: 9 };
    this._flipping = false;
    this._updateCamera();

    // Mouse
    canvas.addEventListener('mousedown', (e) => {
      dragging = true;
      prevX = e.clientX;
      prevY = e.clientY;
    });
    window.addEventListener('mouseup', () => { dragging = false; });
    window.addEventListener('mousemove', (e) => {
      if (!dragging || this._flipping) return;
      const dx = e.clientX - prevX;
      const dy = e.clientY - prevY;
      prevX = e.clientX;
      prevY = e.clientY;
      this.spherical.theta -= dx * 0.008;
      this.spherical.phi = Math.max(0.15, Math.min(Math.PI - 0.15, this.spherical.phi + dy * 0.008));
      this._updateCamera();
    });
    canvas.addEventListener('wheel', (e) => {
      e.preventDefault();
      this.spherical.radius = Math.max(5, Math.min(14, this.spherical.radius + e.deltaY * 0.01));
      this._updateCamera();
    }, { passive: false });

    // Touch
    canvas.addEventListener('touchstart', (e) => {
      if (e.touches.length === 1) {
        dragging = true;
        prevX = e.touches[0].clientX;
        prevY = e.touches[0].clientY;
      }
    }, { passive: true });
    canvas.addEventListener('touchend', () => { dragging = false; }, { passive: true });
    canvas.addEventListener('touchmove', (e) => {
      if (!dragging || this._flipping || e.touches.length !== 1) return;
      const dx = e.touches[0].clientX - prevX;
      const dy = e.touches[0].clientY - prevY;
      prevX = e.touches[0].clientX;
      prevY = e.touches[0].clientY;
      this.spherical.theta -= dx * 0.008;
      this.spherical.phi = Math.max(0.15, Math.min(Math.PI - 0.15, this.spherical.phi + dy * 0.008));
      this._updateCamera();
    }, { passive: true });
  }

  _updateCamera() {
    const { theta, phi, radius } = this.spherical;
    this.camera.position.x = radius * Math.sin(phi) * Math.sin(theta);
    this.camera.position.y = radius * Math.cos(phi);
    this.camera.position.z = radius * Math.sin(phi) * Math.cos(theta);
    this.camera.lookAt(0, 0, 0);
  }

  resetView() {
    this.spherical = { theta: Math.PI / 4, phi: Math.PI / 4, radius: 9 };
    this._updateCamera();
  }

  /**
   * Smoothly flip the camera to a vertically inverted position.
   * Animates phi from its current value to (π - current phi), mirroring
   * the vertical angle so the cube appears upside-down.
   */
  flipView(duration = 600) {
    if (this._flipping) return;
    this._flipping = true;
    const startPhi   = this.spherical.phi;
    const targetPhi  = Math.PI - startPhi;
    const startTheta = this.spherical.theta;
    const targetTheta = startTheta + Math.PI; // also spin 180° horizontally for a full inversion
    const start = performance.now();

    const tick = (now) => {
      const raw = Math.min(1, (now - start) / duration);
      // Ease in-out cubic
      const t = raw < 0.5 ? 4 * raw * raw * raw : 1 - Math.pow(-2 * raw + 2, 3) / 2;
      this.spherical.phi   = startPhi   + (targetPhi   - startPhi)   * t;
      this.spherical.theta = startTheta + (targetTheta - startTheta) * t;
      this._updateCamera();
      if (raw < 1) {
        requestAnimationFrame(tick);
      } else {
        this._flipping = false;
      }
    };
    requestAnimationFrame(tick);
  }

  _resize() {
    const w = this.container.clientWidth;
    const h = this.container.clientHeight;
    if (w === 0 || h === 0) return;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
  }

  _createCubies() {
    this.cubies = [];
    const blackMat = new THREE.MeshStandardMaterial({ color: 0x0a0a0a, roughness: 0.7, metalness: 0.3 });

    for (let x = -1; x <= 1; x++) {
      for (let y = -1; y <= 1; y++) {
        for (let z = -1; z <= 1; z++) {
          if (x === 0 && y === 0 && z === 0) continue;

          const group = new THREE.Group();
          group.position.set(x * this.spacing, y * this.spacing, z * this.spacing);

          const geo = new THREE.BoxGeometry(this.cubieSize, this.cubieSize, this.cubieSize);
          const core = new THREE.Mesh(geo, blackMat);
          group.add(core);

          const half = this.cubieSize / 2;
          const stickerSize = this.cubieSize * 0.88;
          const stickerGeo = new THREE.PlaneGeometry(stickerSize, stickerSize);
          const stickers = {};

          const faces = [
            ['U', new THREE.Vector3(0, half + 0.001, 0), new THREE.Euler(-Math.PI / 2, 0, 0)],
            ['D', new THREE.Vector3(0, -half - 0.001, 0), new THREE.Euler(Math.PI / 2, 0, 0)],
            ['R', new THREE.Vector3(half + 0.001, 0, 0), new THREE.Euler(0, Math.PI / 2, 0)],
            ['L', new THREE.Vector3(-half - 0.001, 0, 0), new THREE.Euler(0, -Math.PI / 2, 0)],
            ['F', new THREE.Vector3(0, 0, half + 0.001), new THREE.Euler(0, 0, 0)],
            ['B', new THREE.Vector3(0, 0, -half - 0.001), new THREE.Euler(0, Math.PI, 0)],
          ];

          for (const [name, pos, rot] of faces) {
            const mat = new THREE.MeshStandardMaterial({ color: 0x222222, roughness: 0.25, metalness: 0.05 });
            const mesh = new THREE.Mesh(stickerGeo, mat);
            mesh.position.copy(pos);
            mesh.rotation.copy(rot);
            group.add(mesh);
            stickers[name] = mat;
          }

          group.userData = { gx: x, gy: y, gz: z, ix: x, iy: y, iz: z, stickers };
          this.cubeGroup.add(group);
          this.cubies.push(group);
        }
      }
    }
  }

  _worldDirVector(dir) {
    const map = {
      U: new THREE.Vector3(0, 1, 0),
      D: new THREE.Vector3(0, -1, 0),
      R: new THREE.Vector3(1, 0, 0),
      L: new THREE.Vector3(-1, 0, 0),
      F: new THREE.Vector3(0, 0, 1),
      B: new THREE.Vector3(0, 0, -1),
    };
    return map[dir];
  }

  _localFaceForWorldDir(cubie, worldDir) {
    const target = this._worldDirVector(worldDir);
    const dirs = ['U', 'D', 'R', 'L', 'F', 'B'];
    let best = 'U';
    let bestDot = -Infinity;
    for (const d of dirs) {
      const local = this._worldDirVector(d).clone().applyQuaternion(cubie.quaternion);
      const dot = local.dot(target);
      if (dot > bestDot) {
        bestDot = dot;
        best = d;
      }
    }
    return best;
  }

  _applyFacelets(facelets) {
    this.facelets = facelets;

    for (let i = 0; i < 54; i++) {
      const { x, y, z, dir } = CubeState.FACELET_MAP[i];
      const color = facelets[i];
      const hex = parseInt(CubeState.COLOR_HEX[color].replace('#', ''), 16);

      const cubie = this.cubies.find(
        (c) => c.userData.gx === x && c.userData.gy === y && c.userData.gz === z
      );
      if (!cubie) continue;
      const localFace = this._localFaceForWorldDir(cubie, dir);
      if (cubie.userData.stickers[localFace]) {
        cubie.userData.stickers[localFace].color.setHex(hex);
      }
    }
  }

  _resetToSolved() {
    for (const cubie of this.cubies) {
      const u = cubie.userData;
      u.gx = u.ix;
      u.gy = u.iy;
      u.gz = u.iz;
      cubie.position.set(u.gx * this.spacing, u.gy * this.spacing, u.gz * this.spacing);
      cubie.quaternion.identity();
      cubie.rotation.set(0, 0, 0);
    }
    this.facelets = CubeState.SOLVED;
    this._applyFacelets(this.facelets);
  }

  _inverseMove(move) {
    const face = move[0];
    if (move.length > 1 && move[1] === '2') return move;
    if (move.includes("'")) return face;
    return face + "'";
  }

  _applyMoveInstant(move) {
    const spec = this._moveSpec(move);
    if (!spec) return;
    const { axis, layer, sign, turns, move: moveStr } = spec;
    const axisVec = new THREE.Vector3(
      axis === 'x' ? 1 : 0,
      axis === 'y' ? 1 : 0,
      axis === 'z' ? 1 : 0
    );
    const totalAngle = (Math.PI / 2) * sign * (Math.abs(turns) === 2 ? 2 : turns);
    const q = new THREE.Quaternion().setFromAxisAngle(axisVec, totalAngle);
    const steps = Math.abs(turns) === 2 ? 2 : 1;
    const stepSign = sign > 0 ? 1 : -1;

    for (const cubie of this.cubies) {
      if (!this._inLayer(cubie, axis, layer)) continue;
      let { gx, gy, gz } = cubie.userData;
      for (let s = 0; s < steps; s++) {
        const next = this._rotateGrid(gx, gy, gz, axis, stepSign);
        gx = next.gx;
        gy = next.gy;
        gz = next.gz;
      }
      cubie.userData.gx = gx;
      cubie.userData.gy = gy;
      cubie.userData.gz = gz;
      cubie.quaternion.premultiply(q);
      cubie.position.set(gx * this.spacing, gy * this.spacing, gz * this.spacing);
    }
    this.facelets = CubeState.applyMove(this.facelets, moveStr);
  }

  setState(facelets) {
    this._resetToSolved();
    if (facelets === CubeState.SOLVED) return;

    const cube = Cube.fromString(facelets);
    if (cube.isSolved()) return;

    if (!CubeSolver.isReady()) {
      this._applyFacelets(facelets);
      return;
    }

    try {
      const { solution } = CubeSolver.solve(facelets);
      const moves = CubeState.parseMoves(solution);
      for (let i = moves.length - 1; i >= 0; i--) {
        this._applyMoveInstant(this._inverseMove(moves[i]));
      }
      this.facelets = facelets;
      this._applyFacelets(facelets);
    } catch (_) {
      this._applyFacelets(facelets);
    }
  }

  /** Move config: axis, layer filter, signed quarter-turns (+1 = clockwise from outside) */
  _moveSpec(move) {
    const face = move[0];
    let turns = 1;
    if (move.includes("'")) turns = -1;
    else if (move.includes('2')) turns = 2;

    const specs = {
      U: { axis: 'y', layer: 1, sign: -1 },
      D: { axis: 'y', layer: -1, sign: 1 },
      R: { axis: 'x', layer: 1, sign: -1 },
      L: { axis: 'x', layer: -1, sign: 1 },
      F: { axis: 'z', layer: 1, sign: -1 },
      B: { axis: 'z', layer: -1, sign: 1 },
    };

    const s = specs[face];
    if (!s) return null;
    return { ...s, turns, face, move };
  }

  _inLayer(cubie, axis, layer) {
    const u = cubie.userData;
    if (axis === 'x') return u.gx === layer;
    if (axis === 'y') return u.gy === layer;
    return u.gz === layer;
  }

  _rotateGrid(gx, gy, gz, axis, sign) {
    const s = sign > 0 ? 1 : -1;
    if (axis === 'x') {
      [gy, gz] = [s * gz, -s * gy];
    } else if (axis === 'y') {
      [gx, gz] = [-s * gz, s * gx];
    } else {
      [gx, gy] = [s * gy, -s * gx];
    }
    return { gx, gy, gz };
  }

  animateMove(move, duration = 300) {
    return new Promise((resolve) => {
      const spec = this._moveSpec(move);
      if (!spec) {
        resolve();
        return;
      }

      this.animating = true;
      const { axis, layer, sign, turns, move: moveStr } = spec;
      const axisVec = new THREE.Vector3(
        axis === 'x' ? 1 : 0,
        axis === 'y' ? 1 : 0,
        axis === 'z' ? 1 : 0
      );

      const layerGroup = new THREE.Group();
      this.cubeGroup.add(layerGroup);

      const affected = [];
      for (const cubie of this.cubies) {
        if (this._inLayer(cubie, axis, layer)) {
          affected.push(cubie);
          layerGroup.attach(cubie);
        }
      }

      const totalAngle = (Math.PI / 2) * sign * (Math.abs(turns) === 2 ? 2 : turns);
      const start = performance.now();

      const tick = (now) => {
        const t = Math.min(1, (now - start) / duration);
        const eased = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
        layerGroup.rotation.set(0, 0, 0);
        layerGroup.rotateOnWorldAxis(axisVec, totalAngle * eased);

        if (t < 1) {
          requestAnimationFrame(tick);
        } else {
          const q = new THREE.Quaternion().setFromAxisAngle(axisVec, totalAngle);
          const steps = Math.abs(turns) === 2 ? 2 : 1;
          const stepSign = sign > 0 ? 1 : -1;

          layerGroup.rotation.set(0, 0, 0);
          for (const cubie of affected) {
            let { gx, gy, gz } = cubie.userData;
            for (let s = 0; s < steps; s++) {
              const next = this._rotateGrid(gx, gy, gz, axis, stepSign);
              gx = next.gx;
              gy = next.gy;
              gz = next.gz;
            }
            cubie.userData.gx = gx;
            cubie.userData.gy = gy;
            cubie.userData.gz = gz;
            cubie.quaternion.premultiply(q);
            this.cubeGroup.attach(cubie);
            cubie.position.set(gx * this.spacing, gy * this.spacing, gz * this.spacing);
          }
          this.cubeGroup.remove(layerGroup);

          this.facelets = CubeState.applyMove(this.facelets, moveStr);
          this._applyFacelets(this.facelets);
          this.animating = false;
          resolve();
        }
      };

      requestAnimationFrame(tick);
    });
  }

  async animateMoves(moves, duration = 300, onStep) {
    for (let i = 0; i < moves.length; i++) {
      if (onStep) onStep(i, moves[i]);
      await this.animateMove(moves[i], duration);
    }
  }

  isAnimating() {
    return this.animating;
  }

  _animate() {
    requestAnimationFrame(this._animate);
    this.renderer.render(this.scene, this.camera);
  }

  dispose() {
    window.removeEventListener('resize', this._onResize);
    this.renderer.dispose();
    if (this.renderer.domElement.parentNode) {
      this.renderer.domElement.parentNode.removeChild(this.renderer.domElement);
    }
  }
}
