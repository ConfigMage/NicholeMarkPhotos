/**
 * Minimal, dependency-free QR Code encoder (byte mode, versions 1-40).
 *
 * Exists so `generate.mjs` can be run with plain `node` and no `npm install` —
 * these PDFs need to be regeneratable years from now, on any laptop, without a
 * package registry being reachable.
 *
 * Implements ISO/IEC 18004: Reed-Solomon error correction, the eight data
 * masks with the standard penalty scoring, and BCH-coded format/version info.
 * Output is a boolean matrix: `matrix[y][x] === true` means a dark module.
 */

/** Error-correction levels, with their format-info bit patterns. */
export const ECC = {
  LOW: { ordinal: 0, formatBits: 1 },
  MEDIUM: { ordinal: 1, formatBits: 0 },
  QUARTILE: { ordinal: 2, formatBits: 3 },
  HIGH: { ordinal: 3, formatBits: 2 },
};

// Error-correction codewords per block, indexed [ecc.ordinal][version].
const ECC_CODEWORDS_PER_BLOCK = [
  // Version: 0 (unused), 1, 2, ...
  [-1, 7, 10, 15, 20, 26, 18, 20, 24, 30, 18, 20, 24, 26, 30, 22, 24, 28, 30, 28, 28, 28, 28, 30, 30, 26, 28, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30], // Low
  [-1, 10, 16, 26, 18, 24, 16, 18, 22, 22, 26, 30, 22, 22, 24, 24, 28, 28, 26, 26, 26, 26, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28], // Medium
  [-1, 13, 22, 18, 26, 18, 24, 18, 22, 20, 24, 28, 26, 24, 20, 30, 24, 28, 28, 26, 30, 28, 30, 30, 30, 30, 28, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30], // Quartile
  [-1, 17, 28, 22, 16, 22, 28, 26, 26, 24, 28, 24, 28, 22, 24, 24, 30, 28, 28, 26, 28, 30, 24, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30], // High
];

// Number of error-correction blocks, indexed [ecc.ordinal][version].
const NUM_ECC_BLOCKS = [
  [-1, 1, 1, 1, 1, 1, 2, 2, 2, 2, 4, 4, 4, 4, 4, 6, 6, 6, 6, 7, 8, 8, 9, 9, 10, 12, 12, 12, 13, 14, 15, 16, 17, 18, 19, 19, 20, 21, 22, 24, 25], // Low
  [-1, 1, 1, 1, 2, 2, 4, 4, 4, 5, 5, 5, 8, 9, 9, 10, 10, 11, 13, 14, 16, 17, 17, 18, 20, 21, 23, 25, 26, 28, 29, 31, 33, 35, 37, 38, 40, 43, 45, 47, 49], // Medium
  [-1, 1, 1, 2, 2, 4, 4, 6, 6, 8, 8, 8, 10, 12, 16, 12, 17, 16, 18, 21, 20, 23, 23, 25, 27, 29, 34, 34, 35, 38, 40, 43, 45, 48, 51, 53, 56, 59, 62, 65, 68], // Quartile
  [-1, 1, 1, 2, 4, 4, 4, 5, 6, 8, 8, 11, 11, 16, 16, 18, 16, 19, 21, 25, 25, 25, 34, 30, 32, 35, 37, 40, 42, 45, 48, 51, 55, 60, 65, 70, 75, 80, 85, 93, 97], // High
];

const MIN_VERSION = 1;
const MAX_VERSION = 40;

/** Total number of data+ECC modules for a version, before format/version info. */
function rawDataModules(version) {
  let result = (16 * version + 128) * version + 64;
  if (version >= 2) {
    const numAlign = Math.floor(version / 7) + 2;
    result -= (25 * numAlign - 10) * numAlign - 55;
    if (version >= 7) result -= 36;
  }
  return result;
}

/** Number of 8-bit data codewords (excluding ECC) available at this version/level. */
function dataCodewords(version, ecc) {
  return (
    Math.floor(rawDataModules(version) / 8) -
    ECC_CODEWORDS_PER_BLOCK[ecc.ordinal][version] *
      NUM_ECC_BLOCKS[ecc.ordinal][version]
  );
}

/** Row/column centres of the alignment patterns for a version. */
function alignmentPatternPositions(version) {
  if (version === 1) return [];
  const numAlign = Math.floor(version / 7) + 2;
  const step =
    version === 32
      ? 26
      : Math.floor((version * 4 + numAlign * 2 + 1) / (numAlign * 2 - 2)) * 2;
  const result = [6];
  for (let pos = version * 4 + 10; result.length < numAlign; pos -= step) {
    result.splice(1, 0, pos);
  }
  return result;
}

/* ---------------------------------------------------------------- GF(256) */

// Exp/log tables for GF(2^8) with the QR primitive polynomial x^8+x^4+x^3+x^2+1.
const GF_EXP = new Uint8Array(512);
const GF_LOG = new Uint8Array(256);
{
  let x = 1;
  for (let i = 0; i < 255; i++) {
    GF_EXP[i] = x;
    GF_LOG[x] = i;
    x <<= 1;
    if (x & 0x100) x ^= 0x11d;
  }
  for (let i = 255; i < 512; i++) GF_EXP[i] = GF_EXP[i - 255];
}

function gfMul(a, b) {
  if (a === 0 || b === 0) return 0;
  return GF_EXP[GF_LOG[a] + GF_LOG[b]];
}

/** Generator polynomial for `degree` error-correction codewords. */
function rsGeneratorPoly(degree) {
  let poly = [1];
  for (let i = 0; i < degree; i++) {
    const next = new Array(poly.length + 1).fill(0);
    for (let j = 0; j < poly.length; j++) {
      next[j] ^= poly[j];
      next[j + 1] ^= gfMul(poly[j], GF_EXP[i]);
    }
    poly = next;
  }
  return poly;
}

/** Reed-Solomon remainder for one block of data codewords. */
function rsRemainder(data, degree) {
  const gen = rsGeneratorPoly(degree);
  const remainder = new Uint8Array(degree);
  for (const byte of data) {
    const factor = byte ^ remainder[0];
    remainder.copyWithin(0, 1);
    remainder[degree - 1] = 0;
    for (let i = 0; i < degree; i++) {
      remainder[i] ^= gfMul(gen[i + 1], factor);
    }
  }
  return remainder;
}

/* ------------------------------------------------------------- Bit buffer */

class BitBuffer {
  constructor() {
    this.bits = [];
  }
  append(value, length) {
    for (let i = length - 1; i >= 0; i--) {
      this.bits.push((value >>> i) & 1);
    }
  }
  get length() {
    return this.bits.length;
  }
}

/* ------------------------------------------------------------- Encoding */

/** UTF-8 bytes for a string — QR byte mode is byte-oriented, not char-oriented. */
function utf8Bytes(text) {
  return Array.from(new TextEncoder().encode(text));
}

/** Smallest version that fits `byteCount` bytes at this ECC level. */
function chooseVersion(byteCount, ecc, minVersion) {
  for (let version = Math.max(MIN_VERSION, minVersion); version <= MAX_VERSION; version++) {
    const countBits = version < 10 ? 8 : 16;
    const capacityBits = dataCodewords(version, ecc) * 8;
    if (4 + countBits + byteCount * 8 <= capacityBits) return version;
  }
  throw new Error(`Data too long for a QR code: ${byteCount} bytes`);
}

/** Byte-mode bitstream -> padded, block-interleaved codeword sequence. */
function buildCodewords(bytes, version, ecc) {
  const capacityBits = dataCodewords(version, ecc) * 8;
  const buffer = new BitBuffer();
  buffer.append(0b0100, 4); // byte mode
  buffer.append(bytes.length, version < 10 ? 8 : 16);
  for (const byte of bytes) buffer.append(byte, 8);

  // Terminator, then pad to a byte boundary, then alternating pad bytes.
  buffer.append(0, Math.min(4, capacityBits - buffer.length));
  buffer.append(0, (8 - (buffer.length % 8)) % 8);
  for (let pad = 0xec; buffer.length < capacityBits; pad ^= 0xec ^ 0x11) {
    buffer.append(pad, 8);
  }

  const data = new Uint8Array(buffer.length / 8);
  buffer.bits.forEach((bit, i) => {
    if (bit) data[i >>> 3] |= 0x80 >>> (i & 7);
  });

  // Split into blocks, ECC each one, then interleave codewords across blocks.
  const numBlocks = NUM_ECC_BLOCKS[ecc.ordinal][version];
  const eccLen = ECC_CODEWORDS_PER_BLOCK[ecc.ordinal][version];
  const totalCodewords = Math.floor(rawDataModules(version) / 8);
  const shortBlockLen = Math.floor(totalCodewords / numBlocks) - eccLen;
  const numShortBlocks = numBlocks - (totalCodewords % numBlocks);

  const blocks = [];
  for (let i = 0, offset = 0; i < numBlocks; i++) {
    const len = shortBlockLen + (i < numShortBlocks ? 0 : 1);
    const dat = Array.from(data.slice(offset, offset + len));
    offset += len;
    blocks.push({ data: dat, ecc: Array.from(rsRemainder(dat, eccLen)) });
  }

  const result = [];
  for (let i = 0; i < shortBlockLen + 1; i++) {
    for (const block of blocks) {
      // Short blocks have no codeword at the final data index.
      if (i < block.data.length) result.push(block.data[i]);
    }
  }
  for (let i = 0; i < eccLen; i++) {
    for (const block of blocks) result.push(block.ecc[i]);
  }
  return result;
}

/* -------------------------------------------------------------- Drawing */

class Matrix {
  constructor(size) {
    this.size = size;
    this.modules = Array.from({ length: size }, () => new Array(size).fill(false));
    this.reserved = Array.from({ length: size }, () => new Array(size).fill(false));
  }
  set(x, y, dark, reserve = true) {
    this.modules[y][x] = dark;
    if (reserve) this.reserved[y][x] = true;
  }
}

function drawFinderPattern(m, cx, cy) {
  for (let dy = -4; dy <= 4; dy++) {
    for (let dx = -4; dx <= 4; dx++) {
      const x = cx + dx;
      const y = cy + dy;
      if (x < 0 || y < 0 || x >= m.size || y >= m.size) continue;
      const dist = Math.max(Math.abs(dx), Math.abs(dy));
      m.set(x, y, dist !== 2 && dist <= 3);
    }
  }
}

function drawAlignmentPattern(m, cx, cy) {
  for (let dy = -2; dy <= 2; dy++) {
    for (let dx = -2; dx <= 2; dx++) {
      m.set(cx + dx, cy + dy, Math.max(Math.abs(dx), Math.abs(dy)) !== 1);
    }
  }
}

function drawFunctionPatterns(m, version, ecc) {
  const size = m.size;

  // Timing patterns.
  for (let i = 0; i < size; i++) {
    m.set(6, i, i % 2 === 0);
    m.set(i, 6, i % 2 === 0);
  }

  // Three finders plus their separators.
  drawFinderPattern(m, 3, 3);
  drawFinderPattern(m, size - 4, 3);
  drawFinderPattern(m, 3, size - 4);

  // Alignment patterns, skipping the three finder corners.
  const positions = alignmentPatternPositions(version);
  const last = positions.length - 1;
  for (let i = 0; i < positions.length; i++) {
    for (let j = 0; j < positions.length; j++) {
      const corner =
        (i === 0 && j === 0) || (i === 0 && j === last) || (i === last && j === 0);
      if (!corner) drawAlignmentPattern(m, positions[i], positions[j]);
    }
  }

  // Reserve the format/version areas; real bits are written after masking.
  drawFormatBits(m, ecc, 0);
  drawVersionBits(m, version);
}

/** 15-bit BCH format info, written twice. */
function drawFormatBits(m, ecc, mask) {
  const data = (ecc.formatBits << 3) | mask;
  let rem = data;
  for (let i = 0; i < 10; i++) rem = (rem << 1) ^ ((rem >>> 9) * 0x537);
  const bits = ((data << 10) | rem) ^ 0x5412;
  const size = m.size;

  const bit = (i) => ((bits >>> i) & 1) === 1;

  // Copy 1, around the top-left finder.
  for (let i = 0; i <= 5; i++) m.set(8, i, bit(i));
  m.set(8, 7, bit(6));
  m.set(8, 8, bit(7));
  m.set(7, 8, bit(8));
  for (let i = 9; i < 15; i++) m.set(14 - i, 8, bit(i));

  // Copy 2, split across the other two finders.
  for (let i = 0; i < 8; i++) m.set(size - 1 - i, 8, bit(i));
  for (let i = 8; i < 15; i++) m.set(8, size - 15 + i, bit(i));
  m.set(8, size - 8, true); // always-dark module
}

/** 18-bit BCH version info, only present from version 7 up. */
function drawVersionBits(m, version) {
  if (version < 7) return;
  let rem = version;
  for (let i = 0; i < 12; i++) rem = (rem << 1) ^ ((rem >>> 11) * 0x1f25);
  const bits = (version << 12) | rem;
  const size = m.size;
  for (let i = 0; i < 18; i++) {
    const dark = ((bits >>> i) & 1) === 1;
    const a = size - 11 + (i % 3);
    const b = Math.floor(i / 3);
    m.set(a, b, dark);
    m.set(b, a, dark);
  }
}

/** Zigzag codeword placement, right to left, skipping the vertical timing column. */
function drawCodewords(m, codewords) {
  const size = m.size;
  let i = 0;
  for (let right = size - 1; right >= 1; right -= 2) {
    if (right === 6) right = 5; // skip the timing column
    for (let vert = 0; vert < size; vert++) {
      for (let j = 0; j < 2; j++) {
        const x = right - j;
        const upward = ((right + 1) & 2) === 0;
        const y = upward ? size - 1 - vert : vert;
        if (m.reserved[y][x]) continue;
        const dark =
          i < codewords.length * 8 &&
          ((codewords[i >>> 3] >>> (7 - (i & 7))) & 1) === 1;
        m.modules[y][x] = dark;
        i++;
      }
    }
  }
}

const MASK_FUNCTIONS = [
  (x, y) => (x + y) % 2 === 0,
  (x, y) => y % 2 === 0,
  (x, y) => x % 3 === 0,
  (x, y) => (x + y) % 3 === 0,
  (x, y) => (Math.floor(x / 3) + Math.floor(y / 2)) % 2 === 0,
  (x, y) => ((x * y) % 2) + ((x * y) % 3) === 0,
  (x, y) => (((x * y) % 2) + ((x * y) % 3)) % 2 === 0,
  (x, y) => (((x + y) % 2) + ((x * y) % 3)) % 2 === 0,
];

function applyMask(m, mask) {
  const fn = MASK_FUNCTIONS[mask];
  for (let y = 0; y < m.size; y++) {
    for (let x = 0; x < m.size; x++) {
      if (!m.reserved[y][x] && fn(x, y)) m.modules[y][x] = !m.modules[y][x];
    }
  }
}

/** Standard penalty score (rules 1-4) used to pick the least-noisy mask. */
function penaltyScore(m) {
  const size = m.size;
  const mod = m.modules;
  let penalty = 0;

  // Rule 1: runs of five or more same-coloured modules in a row or column.
  const scoreRun = (run) => (run >= 5 ? run - 2 : 0);
  for (let y = 0; y < size; y++) {
    let run = 1;
    for (let x = 1; x < size; x++) {
      if (mod[y][x] === mod[y][x - 1]) run++;
      else {
        penalty += scoreRun(run);
        run = 1;
      }
    }
    penalty += scoreRun(run);
  }
  for (let x = 0; x < size; x++) {
    let run = 1;
    for (let y = 1; y < size; y++) {
      if (mod[y][x] === mod[y - 1][x]) run++;
      else {
        penalty += scoreRun(run);
        run = 1;
      }
    }
    penalty += scoreRun(run);
  }

  // Rule 2: 2x2 blocks of one colour.
  for (let y = 0; y < size - 1; y++) {
    for (let x = 0; x < size - 1; x++) {
      const c = mod[y][x];
      if (c === mod[y][x + 1] && c === mod[y + 1][x] && c === mod[y + 1][x + 1]) {
        penalty += 3;
      }
    }
  }

  // Rule 3: the finder-like 1:1:3:1:1 sequence with a 4-module light run on
  // either side. Slide an 11-module window and match the two bit patterns
  // directly; a sequence with light on both sides legitimately scores twice.
  const PATTERN_A = 0b10111010000;
  const PATTERN_B = 0b00001011101;
  for (let a = 0; a < size; a++) {
    let rowBits = 0;
    let colBits = 0;
    for (let b = 0; b < size; b++) {
      rowBits = ((rowBits << 1) & 0x7ff) | (mod[a][b] ? 1 : 0);
      colBits = ((colBits << 1) & 0x7ff) | (mod[b][a] ? 1 : 0);
      if (b >= 10) {
        if (rowBits === PATTERN_A || rowBits === PATTERN_B) penalty += 40;
        if (colBits === PATTERN_A || colBits === PATTERN_B) penalty += 40;
      }
    }
  }

  // Rule 4: every 5% the dark-module ratio deviates from 50% costs 10 points.
  let dark = 0;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) if (mod[y][x]) dark++;
  }
  const total = size * size;
  const k = Math.floor(Math.abs(dark * 20 - total * 10) / total);
  penalty += k * 10;

  return penalty;
}

/**
 * Encode `text` as a QR matrix.
 *
 * @param {string} text
 * @param {{ ecc?: object, minVersion?: number }} [options]
 * @returns {{ size: number, version: number, mask: number, modules: boolean[][] }}
 */
export function encodeQr(text, options = {}) {
  const ecc = options.ecc ?? ECC.HIGH;
  const bytes = utf8Bytes(text);
  const version = chooseVersion(bytes.length, ecc, options.minVersion ?? MIN_VERSION);
  const codewords = buildCodewords(bytes, version, ecc);

  const matrix = new Matrix(version * 4 + 17);
  drawFunctionPatterns(matrix, version, ecc);
  drawCodewords(matrix, codewords);

  // Try all eight masks and keep the lowest-penalty one.
  let best = null;
  for (let mask = 0; mask < 8; mask++) {
    applyMask(matrix, mask);
    drawFormatBits(matrix, ecc, mask);
    const score = penaltyScore(matrix);
    if (best === null || score < best.score) {
      best = { mask, score, modules: matrix.modules.map((row) => row.slice()) };
    }
    applyMask(matrix, mask); // masking is an XOR, so re-applying undoes it
  }

  return { size: matrix.size, version, mask: best.mask, modules: best.modules };
}

/**
 * Render a QR matrix as an SVG string. Uses one `<path>` of square subpaths so
 * the result stays crisp vector art at any print size.
 *
 * @param {ReturnType<typeof encodeQr>} qr
 * @param {{ margin?: number, dark?: string, light?: string }} [options]
 */
export function qrToSvg(qr, options = {}) {
  const margin = options.margin ?? 4; // 4 modules is the spec's minimum quiet zone
  const dark = options.dark ?? "#000000";
  const light = options.light ?? "#ffffff";
  const dimension = qr.size + margin * 2;

  let path = "";
  for (let y = 0; y < qr.size; y++) {
    for (let x = 0; x < qr.size; x++) {
      if (qr.modules[y][x]) path += `M${x + margin} ${y + margin}h1v1h-1z`;
    }
  }

  return [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${dimension} ${dimension}"`,
    ` shape-rendering="crispEdges" role="img" aria-label="QR code">`,
    `<rect width="${dimension}" height="${dimension}" fill="${light}"/>`,
    `<path d="${path}" fill="${dark}"/>`,
    `</svg>`,
  ].join("");
}
