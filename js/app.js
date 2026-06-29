/**
 * Main application controller.
 */
(function () {
  const FACE_INFO = {
    U: { name: 'Up', color: '#ffffff' },
    D: { name: 'Down', color: '#ffd500' },
    F: { name: 'Front', color: '#009b48' },
    R: { name: 'Right', color: '#b71234' },
    L: { name: 'Left', color: '#ff5800' },
    B: { name: 'Back', color: '#0046ad' },
  };

  let facelets = CubeState.SOLVED;
  let solution = '';
  let solutionMoves = [];
  let playing = false;
  let playAborted = false;
  let currentStep = 0;

  const faceImages = {};
  const faceUploadEls = {};

  const cube3d = new RubiksCube3D(document.getElementById('cube-canvas'));
  // Force a resize after layout settles so the canvas fills the container
  requestAnimationFrame(() => cube3d._resize());

  const els = {
    overlay: document.getElementById('solver-overlay'),
    overlayText: document.getElementById('overlay-text'),
    status: document.getElementById('status-message'),
    solutionMoves: document.getElementById('solution-moves'),
    moveCount: document.getElementById('move-count'),
    btnSolve: document.getElementById('btn-solve'),
    btnPlay: document.getElementById('btn-play'),
    btnStep: document.getElementById('btn-step'),
    btnStop: document.getElementById('btn-stop'),
    btnResetCube: document.getElementById('btn-reset-cube'),
    btnScramble:  document.getElementById('btn-scramble'),
    btnResetView: document.getElementById('btn-reset-view'),
    btnFlipView:  document.getElementById('btn-flip-view'),
    btnParseImages: document.getElementById('btn-parse-images'),
    speedRange: document.getElementById('speed-range'),
    faceUploads: document.getElementById('face-uploads'),
    cubeNet: document.getElementById('cube-net'),
  };

  function showStatus(message, type = 'info') {
    els.status.textContent = message;
    els.status.className = `alert alert-${type} mt-3 mb-0`;
    els.status.classList.remove('d-none');
  }

  function hideStatus() {
    els.status.classList.add('d-none');
  }

  function showOverlay(text) {
    els.overlayText.textContent = text;
    els.overlay.classList.remove('d-none');
  }

  function hideOverlay() {
    els.overlay.classList.add('d-none');
  }

  function setFacelets(next) {
    facelets = next;
    cube3d.setState(facelets);
    updateNetUI();
    clearSolution();
  }

  async function setFaceletsAsync(next) {
    facelets = next;
    if (next !== CubeState.SOLVED && !CubeSolver.isReady()) {
      showOverlay('Initializing solver for 3D preview…');
      await CubeSolver.init();
      hideOverlay();
    }
    cube3d.setState(facelets);
    updateNetUI();
    clearSolution();
  }

  function clearSolution() {
    solution = '';
    solutionMoves = [];
    currentStep = 0;
    els.solutionMoves.innerHTML = 'Upload images or edit colors, then click <strong>Solve Cube</strong>.';
    els.moveCount.textContent = '0 moves';
    els.btnPlay.disabled = true;
    els.btnStep.disabled = true;
    els.btnStop.disabled = true;
  }

  function renderSolutionMoves() {
    if (!solutionMoves.length) {
      els.solutionMoves.innerHTML = '<span class="text-muted">Already solved — no moves needed!</span>';
      return;
    }
    els.solutionMoves.innerHTML = solutionMoves
      .map((m, i) => `<span class="move" data-idx="${i}">${m}</span>`)
      .join(' ');
    els.solutionMoves.querySelectorAll('.move').forEach((el) => {
      el.addEventListener('click', () => highlightMove(parseInt(el.dataset.idx, 10)));
    });
  }

  function highlightMove(idx) {
    els.solutionMoves.querySelectorAll('.move').forEach((el, i) => {
      el.classList.toggle('active', i === idx);
      el.classList.toggle('done', i < idx);
    });
  }

  function getAnimDuration() {
    const speed = parseInt(els.speedRange.value, 10);
    return Math.round(550 - speed * 45);
  }

  function buildFaceUploads() {
    els.faceUploads.innerHTML = '';
    for (const face of CubeState.FACES) {
      const info = FACE_INFO[face];
      const col = document.createElement('div');
      col.className = 'col-4';
      col.innerHTML = `
        <div class="face-upload-card" data-face="${face}">
          <input type="file" accept="image/*" data-face="${face}" id="face-input-${face}">
          <i class="bi bi-cloud-upload upload-icon"></i>
          <div class="face-name">
            <span class="face-color" style="background:${info.color}"></span>${face} — ${info.name}
          </div>
          <div class="preview">Click to upload</div>
        </div>`;
      els.faceUploads.appendChild(col);

      const card = col.querySelector('.face-upload-card');
      const input = col.querySelector('input[type="file"]');
      faceUploadEls[face] = card;

      // Ensure clicking anywhere on the card triggers the file picker
      card.addEventListener('click', (e) => {
        if (e.target !== input) input.click();
      });

      input.addEventListener('change', async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        try {
          const img = await ImageParser.loadImageFromFile(file);
          faceImages[face] = img;
          card.classList.add('has-image');
          card.querySelector('.upload-icon').style.display = 'none';
          card.querySelector('.preview').innerHTML = `<img src="${img.src}" alt="${face} face">`;
        } catch {
          showStatus(`Could not load image for face ${face}.`, 'danger');
        }
      });
    }
  }

  function buildNetEditor() {
    els.cubeNet.innerHTML = '';
    const gridItems = [];

    for (let r = 0; r < 3; r++) {
      for (let c = 0; c < 4; c++) {
        gridItems.push(null);
      }
    }

    for (const layout of CubeState.NET_LAYOUT) {
      const faceEl = document.createElement('div');
      faceEl.className = 'net-face';
      faceEl.style.gridRow = layout.gridRow + 1;
      faceEl.style.gridColumn = layout.gridCol + 1;

      const label = document.createElement('div');
      label.className = 'face-label';
      label.textContent = layout.face;
      faceEl.appendChild(label);

      layout.stickers.forEach((idx) => {
        const sticker = document.createElement('div');
        sticker.className = 'net-sticker';
        sticker.dataset.index = idx;
        if (CubeState.isCenter(idx)) sticker.classList.add('center');
        sticker.style.background = CubeState.COLOR_HEX[facelets[idx]];
        sticker.addEventListener('click', () => onStickerClick(idx, sticker));
        faceEl.appendChild(sticker);
      });

      els.cubeNet.appendChild(faceEl);
    }
  }

  function updateNetUI() {
    els.cubeNet.querySelectorAll('.net-sticker').forEach((el) => {
      const idx = parseInt(el.dataset.index, 10);
      el.style.background = CubeState.COLOR_HEX[facelets[idx]];
    });
  }

  function onStickerClick(index, el) {
    if (CubeState.isCenter(index)) return;
    const next = CubeState.nextColor(facelets[index]);
    facelets = facelets.substring(0, index) + next + facelets.substring(index + 1);
    el.style.background = CubeState.COLOR_HEX[next];
    cube3d.setState(facelets);
    clearSolution();
    hideStatus();
  }

  async function parseAllImages() {
    const missing = CubeState.FACES.filter((f) => !faceImages[f]);
    if (missing.length) {
      showStatus(`Please upload images for: ${missing.join(', ')}`, 'warning');
      return;
    }

    try {
      const faceColors = {};
      for (const face of CubeState.FACES) {
        faceColors[face] = ImageParser.parseFaceImage(faceImages[face], face);
      }
      const next = ImageParser.buildFaceletString(faceColors);
      await setFaceletsAsync(next);
      showStatus('Colors detected from images. Review the net editor if anything looks wrong.', 'success');
    } catch (err) {
      showStatus(err.message, 'danger');
    }
  }

  async function solveCube() {
    hideStatus();
    showOverlay('Validating cube…');
    els.btnSolve.disabled = true;

    try {
      CubeState.validate(facelets);
    } catch (err) {
      hideOverlay();
      els.btnSolve.disabled = false;
      showStatus(err.message, 'danger');
      return;
    }

    showOverlay('Initializing solver…');
    try {
      await CubeSolver.init((msg) => {
        els.overlayText.textContent = msg;
      });
    } catch (err) {
      hideOverlay();
      els.btnSolve.disabled = false;
      showStatus('Failed to initialize solver.', 'danger');
      return;
    }

    showOverlay('Finding shortest solution…');
    await new Promise((r) => setTimeout(r, 30));

    try {
      const result = CubeSolver.solve(facelets);
      solution = result.solution;
      solutionMoves = CubeState.parseMoves(solution);
      els.moveCount.textContent = `${result.moveCount} move${result.moveCount === 1 ? '' : 's'}`;
      renderSolutionMoves();
      els.btnPlay.disabled = result.moveCount === 0;
      els.btnStep.disabled = result.moveCount === 0;

      if (result.moveCount === 0) {
        showStatus('Cube is already solved!', 'success');
      } else {
        showStatus(`Solution found in ${result.moveCount} moves (Kociemba two-phase).`, 'success');
      }
    } catch (err) {
      showStatus(err.message, 'danger');
    } finally {
      hideOverlay();
      els.btnSolve.disabled = false;
    }
  }

  async function playSolution() {
    if (!solutionMoves.length || playing) return;
    playing = true;
    playAborted = false;
    els.btnPlay.disabled = true;
    els.btnStep.disabled = true;
    els.btnStop.disabled = false;

    if (currentStep > 0) {
      cube3d.setState(facelets);
      currentStep = 0;
    }

    for (let i = 0; i < solutionMoves.length; i++) {
      if (playAborted) break;
      currentStep = i;
      highlightMove(i);
      await cube3d.animateMove(solutionMoves[i], getAnimDuration());
      highlightMove(i + 1);
    }

    playing = false;
    els.btnPlay.disabled = false;
    els.btnStep.disabled = false;
    els.btnStop.disabled = true;
    if (!playAborted) {
      showStatus('Solution animation complete!', 'success');
    }
  }

  async function stepSolution() {
    if (!solutionMoves.length || playing || cube3d.isAnimating()) return;
    if (currentStep >= solutionMoves.length) {
      cube3d.setState(facelets);
      currentStep = 0;
    }
    highlightMove(currentStep);
    await cube3d.animateMove(solutionMoves[currentStep], getAnimDuration());
    currentStep++;
    highlightMove(currentStep);
  }

  function stopPlayback() {
    playAborted = true;
    playing = false;
    els.btnStop.disabled = true;
    els.btnPlay.disabled = !solutionMoves.length;
    els.btnStep.disabled = !solutionMoves.length;
  }

  async function scrambleCube() {
    showOverlay('Scrambling…');
    try {
      await CubeSolver.init();
      const scrambled = CubeSolver.scramble();
      await setFaceletsAsync(scrambled);
      showStatus('Cube scrambled! Click Solve to find the solution.', 'info');
    } catch (err) {
      showStatus(err.message, 'danger');
    } finally {
      hideOverlay();
    }
  }

  function resetCube() {
    setFacelets(CubeState.SOLVED);
    hideStatus();
    showStatus('Cube reset to solved state.', 'info');
  }

  // Event listeners
  els.btnSolve.addEventListener('click', solveCube);
  els.btnPlay.addEventListener('click', playSolution);
  els.btnStep.addEventListener('click', stepSolution);
  els.btnStop.addEventListener('click', stopPlayback);
  els.btnResetCube.addEventListener('click', resetCube);
  els.btnScramble.addEventListener('click', scrambleCube);
  els.btnResetView.addEventListener('click', () => cube3d.resetView());
  els.btnFlipView.addEventListener('click',  () => cube3d.flipView());
  els.btnParseImages.addEventListener('click', parseAllImages);

  // Pre-init solver in background
  buildFaceUploads();
  buildNetEditor();
  CubeSolver.init().catch(() => {});

  showOverlay('Loading 3D viewer…');
  setTimeout(hideOverlay, 400);
})();
