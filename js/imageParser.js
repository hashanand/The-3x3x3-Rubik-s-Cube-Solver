/**
 * Extract cube colors from uploaded face images.
 * Uses HSV-based classification for better color accuracy.
 */
const ImageParser = (() => {
  const REFERENCE = {
    U: { r: 255, g: 255, b: 255 },  // White
    R: { r: 183, g: 18,  b: 52  },  // Red
    F: { r: 0,   g: 155, b: 72  },  // Green
    D: { r: 255, g: 213, b: 0   },  // Yellow
    L: { r: 255, g: 88,  b: 0   },  // Orange
    B: { r: 0,   g: 70,  b: 173 },  // Blue
  };

  /** Convert RGB [0-255] to HSV [h:0-360, s:0-1, v:0-1] */
  function rgbToHsv(r, g, b) {
    r /= 255; g /= 255; b /= 255;
    const max = Math.max(r, g, b), min = Math.min(r, g, b);
    const d = max - min;
    let h = 0, s = max === 0 ? 0 : d / max, v = max;
    if (d !== 0) {
      if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
      else if (max === g) h = ((b - r) / d + 2) / 6;
      else h = ((r - g) / d + 4) / 6;
    }
    return { h: h * 360, s, v };
  }

  /**
   * Classify an RGB color into one of the 6 face letters.
   * HSV-based approach handles lighting variations better than pure RGB distance.
   */
  function classifyColor(rgb) {
    const { r, g, b } = rgb;
    const { h, s, v } = rgbToHsv(r, g, b);

    // White: high brightness, low saturation
    if (s < 0.2 && v > 0.75) return 'U';

    // For saturated colors use hue ranges
    if (s >= 0.2) {
      if (h >= 20  && h < 45)  return 'D';  // Yellow
      if (h >= 45  && h < 160) return 'F';  // Green
      if (h >= 160 && h < 260) return 'B';  // Blue
      if (h >= 340 || h < 20)  return 'R';  // Red
      if (h >= 260 && h < 340) {
        // Orange vs Red by hue + saturation
        if (h >= 285) return 'R'; // more magenta/red
        return 'L'; // Orange
      }
    }

    // Fallback: Euclidean distance in RGB
    let best = 'U', bestDist = Infinity;
    for (const [letter, ref] of Object.entries(REFERENCE)) {
      const dr = r - ref.r, dg = g - ref.g, db = b - ref.b;
      const dist = dr*dr + dg*dg + db*db;
      if (dist < bestDist) { bestDist = dist; best = letter; }
    }
    return best;
  }

  /**
   * Parse a single face image into 9 color letters (row-major).
   * @param {HTMLImageElement|HTMLCanvasElement} source
   * @param {string} expectedFace - center face letter (U/R/F/D/L/B)
   */
  function parseFaceImage(source, expectedFace) {
    const canvas = document.createElement('canvas');
    const size = 300;
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    ctx.drawImage(source, 0, 0, size, size);

    const colors = [];
    const margin = size * 0.08;
    const cell = (size - 2 * margin) / 3;

    for (let row = 0; row < 3; row++) {
      for (let col = 0; col < 3; col++) {
        const cx = margin + col * cell + cell / 2;
        const cy = margin + row * cell + cell / 2;
        const sampleSize = Math.max(4, Math.round(cell * 0.32));
        const rgb = averageColor(ctx, cx - sampleSize / 2, cy - sampleSize / 2, sampleSize, sampleSize);
        colors.push(classifyColor(rgb));
      }
    }

    // Always trust the center (it's what the user aligned)
    colors[4] = expectedFace;
    return colors;
  }

  function averageColor(ctx, x, y, w, h) {
    x = Math.max(0, Math.round(x));
    y = Math.max(0, Math.round(y));
    w = Math.max(1, Math.round(w));
    h = Math.max(1, Math.round(h));
    const data = ctx.getImageData(x, y, w, h).data;
    let r = 0, g = 0, b = 0, n = 0;
    for (let i = 0; i < data.length; i += 4) {
      if (data[i + 3] < 128) continue;
      r += data[i];
      g += data[i + 1];
      b += data[i + 2];
      n++;
    }
    if (n === 0) return { r: 128, g: 128, b: 128 };
    return { r: r / n, g: g / n, b: b / n };
  }

  /**
   * Build full 54-char facelet string from 6 face arrays (9 chars each).
   * @param {Object<string, string[]>} faceColors - keys U,R,F,D,L,B
   */
  function buildFaceletString(faceColors) {
    let result = '';
    for (const face of CubeState.FACES) {
      const arr = faceColors[face];
      if (!arr || arr.length !== 9) {
        throw new Error(`Face ${face} needs exactly 9 detected colors.`);
      }
      result += arr.join('');
    }
    return result;
  }

  function loadImageFromFile(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = reject;
        img.src = reader.result;
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  return { parseFaceImage, buildFaceletString, loadImageFromFile, REFERENCE, classifyColor, rgbToHsv };
})();
