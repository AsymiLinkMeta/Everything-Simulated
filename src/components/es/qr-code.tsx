import { useEffect, useRef, useCallback } from "react";

const EC_L = 1;

function generateQR(text: string): boolean[][] {
  const data = encodeText(text);
  const version = getVersion(data.length);
  const size = version * 4 + 17;
  const modules: boolean[][] = Array.from({ length: size }, () => Array(size).fill(false));
  const reserved: boolean[][] = Array.from({ length: size }, () => Array(size).fill(false));

  placeFinderPatterns(modules, reserved, size);
  placeAlignmentPatterns(modules, reserved, version, size);
  placeTimingPatterns(modules, reserved, size);
  reserveFormatArea(reserved, size);
  if (version >= 7) reserveVersionArea(reserved, size);

  const ecData = addErrorCorrection(data, version);
  placeBits(modules, reserved, ecData, size);

  const best = applyBestMask(modules, reserved, size);
  placeFormatInfo(best, size, 0);
  return best;
}

function encodeText(text: string): number[] {
  const bytes: number[] = [];
  for (let i = 0; i < text.length; i++) {
    const c = text.charCodeAt(i);
    if (c < 0x80) bytes.push(c);
    else if (c < 0x800) { bytes.push(0xc0 | (c >> 6)); bytes.push(0x80 | (c & 0x3f)); }
    else { bytes.push(0xe0 | (c >> 12)); bytes.push(0x80 | ((c >> 6) & 0x3f)); bytes.push(0x80 | (c & 0x3f)); }
  }
  const mode = 0b0100;
  const bits: number[] = [];
  pushBits(bits, mode, 4);
  const version = getVersion(bytes.length);
  const ccLen = version <= 9 ? 8 : 16;
  pushBits(bits, bytes.length, ccLen);
  for (const b of bytes) pushBits(bits, b, 8);
  pushBits(bits, 0, 4);
  while (bits.length % 8 !== 0) bits.push(0);
  const cap = DATA_CAPACITIES[version - 1];
  const pads = [0xec, 0x11];
  let pi = 0;
  while (bits.length < cap * 8) {
    pushBits(bits, pads[pi % 2], 8);
    pi++;
  }
  const result: number[] = [];
  for (let i = 0; i < bits.length; i += 8) {
    let v = 0;
    for (let j = 0; j < 8; j++) v = (v << 1) | (bits[i + j] || 0);
    result.push(v);
  }
  return result;
}

function pushBits(arr: number[], val: number, len: number) {
  for (let i = len - 1; i >= 0; i--) arr.push((val >> i) & 1);
}

const DATA_CAPACITIES = [19, 34, 55, 80, 108, 136, 156, 194, 232, 274, 324, 370, 428, 461, 523, 589, 647, 721, 795, 861, 932, 1006, 1094, 1174, 1276, 1370, 1468, 1531, 1631, 1735, 1843, 1955, 2071, 2191, 2306, 2434, 2566, 2702, 2812, 2956];

function getVersion(byteCount: number): number {
  for (let v = 1; v <= 40; v++) {
    const ccLen = v <= 9 ? 8 : 16;
    const overhead = Math.ceil((4 + ccLen + byteCount * 8 + 4) / 8);
    if (overhead <= DATA_CAPACITIES[v - 1]) return v;
  }
  return 40;
}

function placeFinderPatterns(m: boolean[][], r: boolean[][], s: number) {
  const positions = [[0, 0], [s - 7, 0], [0, s - 7]];
  for (const [row, col] of positions) {
    for (let dr = -1; dr <= 7; dr++) {
      for (let dc = -1; dc <= 7; dc++) {
        const rr = row + dr, cc = col + dc;
        if (rr < 0 || rr >= s || cc < 0 || cc >= s) continue;
        r[rr][cc] = true;
        const inOuter = dr === 0 || dr === 6 || dc === 0 || dc === 6;
        const inInner = dr >= 2 && dr <= 4 && dc >= 2 && dc <= 4;
        m[rr][cc] = (dr >= 0 && dr <= 6 && dc >= 0 && dc <= 6) && (inOuter || inInner);
      }
    }
  }
}

const ALIGNMENT_POSITIONS: number[][] = [[], [], [6, 18], [6, 22], [6, 26], [6, 30], [6, 34], [6, 22, 38], [6, 24, 42], [6, 26, 46], [6, 28, 50], [6, 30, 54], [6, 32, 58], [6, 34, 62], [6, 26, 46, 66], [6, 26, 48, 70], [6, 26, 50, 74], [6, 30, 54, 78], [6, 30, 56, 82], [6, 30, 58, 86], [6, 34, 62, 90], [6, 28, 50, 72, 94], [6, 26, 50, 74, 98], [6, 30, 54, 78, 102], [6, 28, 54, 80, 106], [6, 32, 58, 84, 110], [6, 30, 58, 86, 114], [6, 34, 62, 90, 118], [6, 26, 50, 74, 98, 122], [6, 30, 54, 78, 102, 126], [6, 26, 52, 78, 104, 130], [6, 30, 56, 82, 108, 134], [6, 34, 60, 86, 112, 138], [6, 30, 58, 86, 114, 142], [6, 34, 62, 90, 118, 146], [6, 30, 54, 78, 102, 126, 150], [6, 24, 50, 76, 102, 128, 154], [6, 28, 54, 80, 106, 132, 158], [6, 32, 58, 84, 110, 136, 162], [6, 26, 54, 82, 110, 138, 166], [6, 30, 58, 86, 114, 142, 170]];

function placeAlignmentPatterns(m: boolean[][], r: boolean[][], v: number, s: number) {
  if (v < 2) return;
  const pos = ALIGNMENT_POSITIONS[v];
  for (const row of pos) {
    for (const col of pos) {
      if (r[row][col]) continue;
      for (let dr = -2; dr <= 2; dr++) {
        for (let dc = -2; dc <= 2; dc++) {
          const rr = row + dr, cc = col + dc;
          if (rr < 0 || rr >= s || cc < 0 || cc >= s) continue;
          r[rr][cc] = true;
          m[rr][cc] = Math.abs(dr) === 2 || Math.abs(dc) === 2 || (dr === 0 && dc === 0);
        }
      }
    }
  }
}

function placeTimingPatterns(m: boolean[][], r: boolean[][], s: number) {
  for (let i = 8; i < s - 8; i++) {
    r[6][i] = true; m[6][i] = i % 2 === 0;
    r[i][6] = true; m[i][6] = i % 2 === 0;
  }
}

function reserveFormatArea(r: boolean[][], s: number) {
  for (let i = 0; i < 9; i++) { if (i < s) r[8][i] = true; if (i < s) r[i][8] = true; }
  for (let i = 0; i < 8; i++) { r[8][s - 1 - i] = true; r[s - 1 - i][8] = true; }
  r[s - 8][8] = true;
}

function reserveVersionArea(r: boolean[][], s: number) {
  for (let i = 0; i < 6; i++) for (let j = 0; j < 3; j++) {
    r[i][s - 11 + j] = true;
    r[s - 11 + j][i] = true;
  }
}

const EC_CODEWORDS_PER_BLOCK: number[][] = [];
const NUM_BLOCKS: number[][] = [];

function initECTables() {
  if (EC_CODEWORDS_PER_BLOCK.length) return;
  const ecpb = [7, 10, 15, 20, 26, 18, 20, 24, 30, 18, 20, 24, 26, 30, 22, 24, 28, 30, 28, 28, 28, 28, 30, 30, 26, 28, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30];
  const nb = [1, 1, 1, 1, 1, 2, 2, 2, 2, 4, 4, 4, 4, 4, 4, 4, 5, 6, 6, 7, 8, 8, 9, 9, 10, 12, 12, 12, 13, 14, 15, 16, 17, 18, 19, 19, 20, 21, 22, 24];
  for (let i = 0; i < 40; i++) {
    EC_CODEWORDS_PER_BLOCK.push([ecpb[i]]);
    NUM_BLOCKS.push([nb[i]]);
  }
}

function addErrorCorrection(data: number[], version: number): number[] {
  initECTables();
  const ecPerBlock = EC_CODEWORDS_PER_BLOCK[version - 1][0];
  const numBlocks = NUM_BLOCKS[version - 1][0];
  const totalData = DATA_CAPACITIES[version - 1];
  const shortBlockLen = Math.floor(totalData / numBlocks);
  const longBlocks = totalData % numBlocks;
  const shortBlocks = numBlocks - longBlocks;

  const dataBlocks: number[][] = [];
  const ecBlocks: number[][] = [];
  let offset = 0;
  for (let i = 0; i < numBlocks; i++) {
    const len = i < shortBlocks ? shortBlockLen : shortBlockLen + 1;
    const block = data.slice(offset, offset + len);
    while (block.length < len) block.push(0);
    offset += len;
    dataBlocks.push(block);
    ecBlocks.push(reedSolomonEncode(block, ecPerBlock));
  }

  const result: number[] = [];
  const maxDataLen = shortBlockLen + 1;
  for (let i = 0; i < maxDataLen; i++) {
    for (let j = 0; j < numBlocks; j++) {
      if (i < dataBlocks[j].length) result.push(dataBlocks[j][i]);
    }
  }
  for (let i = 0; i < ecPerBlock; i++) {
    for (let j = 0; j < numBlocks; j++) {
      result.push(ecBlocks[j][i]);
    }
  }
  return result;
}

const GF_EXP = new Uint8Array(512);
const GF_LOG = new Uint8Array(256);

function initGF() {
  if (GF_EXP[0] === 1) return;
  let x = 1;
  for (let i = 0; i < 255; i++) {
    GF_EXP[i] = x;
    GF_LOG[x] = i;
    x <<= 1;
    if (x >= 256) x ^= 0x11d;
  }
  for (let i = 255; i < 512; i++) GF_EXP[i] = GF_EXP[i - 255];
}

function reedSolomonEncode(data: number[], ecLen: number): number[] {
  initGF();
  const gen = rsGeneratorPoly(ecLen);
  const result = new Uint8Array(ecLen);
  for (const b of data) {
    const lead = b ^ result[0];
    for (let i = 0; i < ecLen - 1; i++) result[i] = result[i + 1];
    result[ecLen - 1] = 0;
    if (lead !== 0) {
      const logLead = GF_LOG[lead];
      for (let i = 0; i < ecLen; i++) result[i] ^= GF_EXP[logLead + GF_LOG[gen[i]]];
    }
  }
  return Array.from(result);
}

function rsGeneratorPoly(degree: number): number[] {
  initGF();
  let result = [1];
  for (let i = 0; i < degree; i++) {
    const next = new Array(result.length + 1).fill(0);
    const root = GF_EXP[i];
    for (let j = 0; j < result.length; j++) {
      next[j] ^= result[j];
      next[j + 1] ^= (result[j] === 0 ? 0 : GF_EXP[GF_LOG[result[j]] + GF_LOG[root]]);
    }
    result = next;
  }
  return result;
}

function placeBits(m: boolean[][], r: boolean[][], data: number[], s: number) {
  let bitIdx = 0;
  const totalBits = data.length * 8;
  let x = s - 1;
  let upward = true;

  while (x >= 0) {
    if (x === 6) x--;
    const rows = upward ? range(s - 1, -1) : range(0, s);
    for (const y of rows) {
      for (const dx of [0, -1]) {
        const cx = x + dx;
        if (cx < 0) continue;
        if (r[y][cx]) continue;
        if (bitIdx < totalBits) {
          const byteIdx = bitIdx >> 3;
          const bitPos = 7 - (bitIdx & 7);
          m[y][cx] = ((data[byteIdx] >> bitPos) & 1) === 1;
          bitIdx++;
        }
      }
    }
    x -= 2;
    upward = !upward;
  }
}

function range(start: number, end: number): number[] {
  const arr: number[] = [];
  if (start <= end) { for (let i = start; i < end; i++) arr.push(i); }
  else { for (let i = start; i >= end + 1; i--) arr.push(i); }
  return arr;
}

function applyBestMask(m: boolean[][], r: boolean[][], s: number): boolean[][] {
  let bestPenalty = Infinity;
  let best = m;
  for (let mask = 0; mask < 8; mask++) {
    const trial = m.map((row) => [...row]);
    for (let y = 0; y < s; y++) for (let x = 0; x < s; x++) {
      if (r[y][x]) continue;
      if (maskBit(mask, y, x)) trial[y][x] = !trial[y][x];
    }
    const pen = penalty(trial, s);
    if (pen < bestPenalty) { bestPenalty = pen; best = trial; }
  }
  return best;
}

function maskBit(mask: number, r: number, c: number): boolean {
  switch (mask) {
    case 0: return (r + c) % 2 === 0;
    case 1: return r % 2 === 0;
    case 2: return c % 3 === 0;
    case 3: return (r + c) % 3 === 0;
    case 4: return (Math.floor(r / 2) + Math.floor(c / 3)) % 2 === 0;
    case 5: return (r * c) % 2 + (r * c) % 3 === 0;
    case 6: return ((r * c) % 2 + (r * c) % 3) % 2 === 0;
    case 7: return ((r + c) % 2 + (r * c) % 3) % 2 === 0;
    default: return false;
  }
}

function penalty(m: boolean[][], s: number): number {
  let pen = 0;
  for (let y = 0; y < s; y++) {
    let run = 1;
    for (let x = 1; x < s; x++) { if (m[y][x] === m[y][x - 1]) { run++; if (run === 5) pen += 3; else if (run > 5) pen++; } else run = 1; }
  }
  for (let x = 0; x < s; x++) {
    let run = 1;
    for (let y = 1; y < s; y++) { if (m[y][x] === m[y - 1][x]) { run++; if (run === 5) pen += 3; else if (run > 5) pen++; } else run = 1; }
  }
  for (let y = 0; y < s - 1; y++) for (let x = 0; x < s - 1; x++) {
    const v = m[y][x]; if (v === m[y][x + 1] && v === m[y + 1][x] && v === m[y + 1][x + 1]) pen += 3;
  }
  let dark = 0;
  for (let y = 0; y < s; y++) for (let x = 0; x < s; x++) if (m[y][x]) dark++;
  const pct = (dark * 100) / (s * s);
  pen += Math.floor(Math.abs(pct - 50) / 5) * 10;
  return pen;
}

const FORMAT_BITS = [0x77c4, 0x72f3, 0x7daa, 0x789d, 0x662f, 0x6318, 0x6c41, 0x6976, 0x5412, 0x5125, 0x5e7c, 0x5b4b, 0x45f9, 0x40ce, 0x4f97, 0x4aa0, 0x355f, 0x3068, 0x3f31, 0x3a06, 0x24b4, 0x2183, 0x2eda, 0x2bed, 0x1689, 0x13be, 0x1ce7, 0x19d0, 0x0762, 0x0255, 0x0d0c, 0x083b];

function placeFormatInfo(m: boolean[][], s: number, mask: number) {
  const idx = EC_L * 8 + mask;
  const bits = FORMAT_BITS[idx] ?? 0;
  const fmtBits: boolean[] = [];
  for (let i = 14; i >= 0; i--) fmtBits.push(((bits >> i) & 1) === 1);

  const positions0 = [[0, 8], [1, 8], [2, 8], [3, 8], [4, 8], [5, 8], [7, 8], [8, 8], [8, 7], [8, 5], [8, 4], [8, 3], [8, 2], [8, 1], [8, 0]];
  for (let i = 0; i < 15; i++) m[positions0[i][0]][positions0[i][1]] = fmtBits[i];

  const positions1 = [[8, s - 1], [8, s - 2], [8, s - 3], [8, s - 4], [8, s - 5], [8, s - 6], [8, s - 7], [8, s - 8], [s - 7, 8], [s - 6, 8], [s - 5, 8], [s - 4, 8], [s - 3, 8], [s - 2, 8], [s - 1, 8]];
  for (let i = 0; i < 15; i++) m[positions1[i][0]][positions1[i][1]] = fmtBits[i];
  m[s - 8][8] = true;
}

export function QrCode({
  url,
  size = 160,
  className,
}: {
  url: string;
  size?: number;
  className?: string;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const modules = generateQR(url);
    const qrSize = modules.length;
    const margin = 2;
    const total = qrSize + margin * 2;
    const scale = size / total;

    canvas.width = size;
    canvas.height = size;
    ctx.clearRect(0, 0, size, size);

    for (let y = 0; y < qrSize; y++) {
      for (let x = 0; x < qrSize; x++) {
        if (modules[y][x]) {
          ctx.fillStyle = "rgba(255,255,255,0.93)";
          ctx.fillRect((x + margin) * scale, (y + margin) * scale, scale + 0.5, scale + 0.5);
        }
      }
    }
  }, [url, size]);

  const download = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const link = document.createElement("a");
    link.download = `qr-${url.split("/").pop() || "code"}.png`;
    link.href = canvas.toDataURL("image/png");
    link.click();
  }, [url]);

  return (
    <div className={className} style={{ display: "inline-flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
      <canvas ref={canvasRef} style={{ borderRadius: 8 }} />
      <button
        type="button"
        onClick={download}
        className="text-xs text-muted hover:text-paper"
        style={{ background: "none", border: "none", cursor: "pointer", textDecoration: "underline" }}
      >
        Download QR
      </button>
    </div>
  );
}
