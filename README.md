# 🧊 Cube Solver — 3×3 Rubik's Cube

> Browser-based Rubik's Cube solver. Upload face photos → get a near-optimal solution → watch it animate in 3D. No server, no build step — pure HTML/CSS/JS.

---

## 🗂️ Project Structure

```
Cube Solver/
├── index.html          ← App shell (Bootstrap layout)
├── css/style.css       ← Dark theme, animations
├── js/
│   ├── app.js          ← Main controller (events, state)
│   ├── cube3d.js       ← Three.js 3D viewer + camera
│   ├── cubeState.js    ← Facelet string + validation
│   ├── imageParser.js  ← Photo → color detection (HSV)
│   └── solver.js       ← Kociemba solver wrapper
└── lib/
    ├── cube.js         ← cubejs: cube model + move engine
    ├── solve.js        ← cubejs: Kociemba two-phase solver
    └── three.min.js    ← Three.js r128 (bundled locally*)
```

> **\*Why local?** Three.js r150+ removed the global IIFE build — `three@0.164.1/build/three.min.js` returns HTTP 404. r128 ships the `window.THREE` global we need.

---

## 🧠 Core Logic

### 1 — Cube State (54-char string)

The entire cube is one string of 54 characters in `U R F D L B` face order (9 chars each):

```
UUUUUUUUU RRRRRRRRR FFFFFFFFF DDDDDDDDD LLLLLLLLL BBBBBBBBB
```

Each letter maps to a color: `U`=White, `R`=Red, `F`=Green, `D`=Yellow, `L`=Orange, `B`=Blue. This format is what the cubejs solver takes as input and returns as output.

---

### 2 — Photo Color Detection (`imageParser.js`)

```
Photo → resize to 300×300 → divide into 3×3 grid → sample center of each cell → classify
```

Uses **HSV** (not RGB) because white and yellow are nearly identical in RGB under bright light:

```
White  → low Saturation (s < 0.2) + high Value (v > 0.75)
Yellow → Hue 20°–45°,   high Saturation
Green  → Hue 45°–160°,  high Saturation
Blue   → Hue 160°–260°, high Saturation
Red    → Hue 340°–20°,  high Saturation
Orange → Hue 260°–340°, high Saturation
```

The center sticker (index 4 of each 3×3 block) is **always forced** to the expected face letter — the user already aligned the cube to it.

---

### 3 — Validation (`cubeState.js`)

Before solving, four checks run in order:
1. String must be exactly **54 chars**
2. Each color must appear exactly **9 times**
3. Position 4 of each 9-char block must be **that face's color** (center)
4. **Round-trip test**: convert string → internal cube model → back to string. If it changes, the state is physically impossible (twisted corner, flipped edge, swapped centers)

---

### 4 — Kociemba Two-Phase Algorithm (`lib/solve.js`)

Finds solutions in ≤ 20 moves for any valid cube.

**Phase 1** — reduce the cube into a simpler subgroup using any move, tracking:
- `twist` — corner orientation (2,187 states)
- `flip` — edge orientation (2,048 states)
- `FRtoBR` — which 4 edges are in the middle slice (495 states)

**Phase 2** — solve within that subgroup using only `U`, `D`, `R2`, `L2`, `F2`, `B2`.

Both phases use **IDA\* with pruning tables** — precomputed lookup tables that give a lower bound on remaining moves, letting the search prune dead branches instantly. Tables are built **once on first use** (~3–5 s), then reused.

```javascript
// Try quick depths first, fallback to full search
for (let depth = 1; depth <= 4; depth++) {
  const s = cube.solve(depth);
  if (s) { solution = s; break; }
}
if (!solution) solution = cube.solve(22);
```

---

### 5 — 3D Rendering (`cube3d.js` + Three.js)

**26 cubie objects** (3×3×3 minus the invisible center core). Each cubie:
- **Core**: black `MeshStandardMaterial` box
- **Stickers**: thin `PlaneGeometry` quads placed 0.001 units above each face

Grid positions are tracked as `(gx, gy, gz)` where each is −1, 0, or +1. The `FACELET_MAP` maps each of the 54 string indices to a `(x, y, z, direction)`, so coloring a sticker means: find the cubie → figure out which local face points in that world direction → set `material.color`.

**Layer turn animation** — reparent affected cubies into a temporary `Group`, rotate it over the animation duration with ease-in-out easing, then reparent cubies back and update their grid coordinates.

---

### 6 — Camera & Flip View (`cube3d.js`)

Camera uses **spherical coordinates** `(θ, φ, radius)`:

```
x = radius · sin(φ) · sin(θ)    ← drag left/right changes θ
y = radius · cos(φ)              ← drag up/down changes φ
z = radius · sin(φ) · cos(θ)    ← scroll changes radius
```

**Flip** mirrors the camera: `φ → (π − φ)` and `θ → (θ + π)`, animated over 600 ms with cubic ease-in-out so the cube smoothly rolls upside-down to reveal the bottom face.

---

## 🚀 Running Locally

Open with any static server (direct `file://` breaks `getImageData` canvas reads):

```bash
python -m http.server 8000   # Python
npx serve .                  # Node
# VS Code → right-click index.html → Open with Live Server
```

---

## 📖 Usage

1. Upload a photo for each of the 6 faces (U / R / F / D / L / B)
2. Click **Detect Colors** — or manually paint stickers in the Color Editor tab
3. Click **Solve Cube** — solution appears as move chips (e.g. `R U R' F2`)
4. Click **Play** to animate, **Step** for one move at a time, adjust **Speed** slider

---

## 🛠️ Tech Stack

| | |
|---|---|
| **Three.js r128** | 3D scene, WebGL, geometry, lighting |
| **cubejs** | Cube model, move engine, Kociemba solver |
| **Bootstrap 5** | Layout, tabs, responsive grid |
| **Vanilla CSS** | Dark theme, animations, design tokens |
| **Bootstrap Icons** | All UI icons |

---

*No frameworks, no bundlers, no backend — just open and run.*
