// news-image-20261123 — "The World in One Day"
// A program that draws one newspaper-style image summing up the world news
// of Monday 23 November 2026 and writes it to /output/entry.png.
//
// Written fresh in this session. Node 22, standard library only, no network.
// The PNG encoder, the 5x7 bitmap font and every drawing routine below are
// original code written for this entry. Deterministic: two runs produce
// byte-identical output.

import { deflateSync } from "node:zlib";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const W = 1024;
const H = 1024;

// ---------------------------------------------------------------- palette
const PAPER = [246, 241, 231, 255];
const INK = [20, 20, 20, 255];
const WHITE = [255, 255, 255, 255];
const RED = [179, 39, 30, 255];
const BLUE = [29, 78, 137, 255];
const TEAL = [14, 124, 107, 255];
const GOLD = [201, 138, 27, 255];
const GREY = [90, 90, 90, 255];
const LIGHTGREY = [220, 214, 200, 255];
const YELLOW = [255, 214, 64, 255];
const GREEN = [46, 125, 50, 255];
const SKY = [135, 190, 230, 255];

// ---------------------------------------------------------------- canvas
const px = new Uint8Array(W * H * 4);

function setPixel(x: number, y: number, c: number[]): void {
  if (x < 0 || y < 0 || x >= W || y >= H) return;
  const i = (y * W + x) * 4;
  px[i] = c[0];
  px[i + 1] = c[1];
  px[i + 2] = c[2];
  px[i + 3] = c[3];
}

function fillRect(x: number, y: number, w: number, h: number, c: number[]): void {
  for (let j = y; j < y + h; j++) {
    for (let i = x; i < x + w; i++) setPixel(i, j, c);
  }
}

function rect(x: number, y: number, w: number, h: number, c: number[], t = 1): void {
  fillRect(x, y, w, t, c);
  fillRect(x, y + h - t, w, t, c);
  fillRect(x, y, t, h, c);
  fillRect(x + w - t, y, t, h, c);
}

function hline(x0: number, x1: number, y: number, c: number[], t = 1): void {
  fillRect(x0, y, x1 - x0, t, c);
}

function vline(x: number, y0: number, y1: number, c: number[], t = 1): void {
  fillRect(x, y0, t, y1 - y0, c);
}

// Bresenham line.
function line(x0: number, y0: number, x1: number, y1: number, c: number[], t = 1): void {
  const dx = Math.abs(x1 - x0);
  const dy = -Math.abs(y1 - y0);
  const sx = x0 < x1 ? 1 : -1;
  const sy = y0 < y1 ? 1 : -1;
  let err = dx + dy;
  let x = x0;
  let y = y0;
  for (;;) {
    if (t === 1) setPixel(x, y, c);
    else fillRect(x - ((t / 2) | 0), y - ((t / 2) | 0), t, t, c);
    if (x === x1 && y === y1) break;
    const e2 = 2 * err;
    if (e2 >= dy) {
      err += dy;
      x += sx;
    }
    if (e2 <= dx) {
      err += dx;
      y += sy;
    }
  }
}

function fillCircle(cx: number, cy: number, r: number, c: number[]): void {
  for (let y = -r; y <= r; y++) {
    const half = Math.floor(Math.sqrt(r * r - y * y));
    for (let x = -half; x <= half; x++) setPixel(cx + x, cy + y, c);
  }
}

function circle(cx: number, cy: number, r: number, c: number[], t = 1): void {
  let x = r;
  let y = 0;
  let err = 0;
  while (x >= y) {
    const pts: [number, number][] = [
      [cx + x, cy + y], [cx + y, cy + x], [cx - y, cy + x], [cx - x, cy + y],
      [cx - x, cy - y], [cx - y, cy - x], [cx + y, cy - x], [cx + x, cy - y],
    ];
    for (const [pxx, pyy] of pts) {
      if (t === 1) setPixel(pxx, pyy, c);
      else fillRect(pxx - ((t / 2) | 0), pyy - ((t / 2) | 0), t, t, c);
    }
    y += 1;
    err += 1 + 2 * y;
    if (2 * (err - x) + 1 > 0) {
      x -= 1;
      err += 1 - 2 * x;
    }
  }
}

// Filled triangle by scanline.
function fillTriangle(x0: number, y0: number, x1: number, y1: number, x2: number, y2: number, c: number[]): void {
  const minY = Math.min(y0, y1, y2);
  const maxY = Math.max(y0, y1, y2);
  for (let y = minY; y <= maxY; y++) {
    const xs: number[] = [];
    const edges: [number, number, number, number][] = [[x0, y0, x1, y1], [x1, y1, x2, y2], [x2, y2, x0, y0]];
    for (const [ax, ay, bx, by] of edges) {
      if ((ay <= y && by > y) || (by <= y && ay > y)) {
        xs.push(Math.round(ax + ((y - ay) * (bx - ax)) / (by - ay)));
      }
    }
    if (xs.length >= 2) {
      const lo = Math.min(...xs);
      const hi = Math.max(...xs);
      for (let x = lo; x <= hi; x++) setPixel(x, y, c);
    }
  }
}

// ---------------------------------------------------------------- 5x7 font
// Each glyph is 7 rows of 5 bits, written as strings. Uppercase, lowercase,
// digits and the punctuation this image needs. Drawn fresh for this entry.
type Glyph = string[];
const FONT: Record<string, Glyph> = {
  A: ["01110", "10001", "10001", "11111", "10001", "10001", "10001"],
  B: ["11110", "10001", "10001", "11110", "10001", "10001", "11110"],
  C: ["01110", "10001", "10000", "10000", "10000", "10001", "01110"],
  D: ["11110", "10001", "10001", "10001", "10001", "10001", "11110"],
  E: ["11111", "10000", "10000", "11110", "10000", "10000", "11111"],
  F: ["11111", "10000", "10000", "11110", "10000", "10000", "10000"],
  G: ["01110", "10001", "10000", "10111", "10001", "10001", "01111"],
  H: ["10001", "10001", "10001", "11111", "10001", "10001", "10001"],
  I: ["01110", "00100", "00100", "00100", "00100", "00100", "01110"],
  J: ["00111", "00010", "00010", "00010", "00010", "10010", "01100"],
  K: ["10001", "10010", "10100", "11000", "10100", "10010", "10001"],
  L: ["10000", "10000", "10000", "10000", "10000", "10000", "11111"],
  M: ["10001", "11011", "10101", "10101", "10001", "10001", "10001"],
  N: ["10001", "11001", "10101", "10011", "10001", "10001", "10001"],
  O: ["01110", "10001", "10001", "10001", "10001", "10001", "01110"],
  P: ["11110", "10001", "10001", "11110", "10000", "10000", "10000"],
  Q: ["01110", "10001", "10001", "10001", "10101", "10010", "01101"],
  R: ["11110", "10001", "10001", "11110", "10100", "10010", "10001"],
  S: ["01111", "10000", "10000", "01110", "00001", "00001", "11110"],
  T: ["11111", "00100", "00100", "00100", "00100", "00100", "00100"],
  U: ["10001", "10001", "10001", "10001", "10001", "10001", "01110"],
  V: ["10001", "10001", "10001", "10001", "10001", "01010", "00100"],
  W: ["10001", "10001", "10001", "10101", "10101", "10101", "01010"],
  X: ["10001", "10001", "01010", "00100", "01010", "10001", "10001"],
  Y: ["10001", "10001", "01010", "00100", "00100", "00100", "00100"],
  Z: ["11111", "00001", "00010", "00100", "01000", "10000", "11111"],
  a: ["00000", "00000", "01110", "00001", "01111", "10001", "01111"],
  b: ["10000", "10000", "10110", "11001", "10001", "10001", "11110"],
  c: ["00000", "00000", "01110", "10001", "10000", "10001", "01110"],
  d: ["00001", "00001", "01101", "10011", "10001", "10001", "01111"],
  e: ["00000", "00000", "01110", "10001", "11111", "10000", "01110"],
  f: ["00110", "01001", "01000", "11110", "01000", "01000", "01000"],
  g: ["00000", "01111", "10001", "10001", "01111", "00001", "01110"],
  h: ["10000", "10000", "10110", "11001", "10001", "10001", "10001"],
  i: ["00100", "00000", "01100", "00100", "00100", "00100", "01110"],
  j: ["00010", "00000", "00010", "00010", "00010", "10010", "01100"],
  k: ["10000", "10000", "10010", "10100", "11000", "10100", "10010"],
  l: ["01100", "00100", "00100", "00100", "00100", "00100", "01110"],
  m: ["00000", "00000", "11010", "10101", "10101", "10101", "10101"],
  n: ["00000", "00000", "10110", "11001", "10001", "10001", "10001"],
  o: ["00000", "00000", "01110", "10001", "10001", "10001", "01110"],
  p: ["00000", "00000", "10110", "11001", "10001", "11110", "10000"],
  q: ["00000", "00000", "01101", "10011", "10001", "01111", "00001"],
  r: ["00000", "00000", "10110", "11001", "10000", "10000", "10000"],
  s: ["00000", "00000", "01111", "10000", "01110", "00001", "11110"],
  t: ["01000", "01000", "11100", "01000", "01000", "01001", "00110"],
  u: ["00000", "00000", "10001", "10001", "10001", "10011", "01101"],
  v: ["00000", "00000", "10001", "10001", "10001", "01010", "00100"],
  w: ["00000", "00000", "10001", "10101", "10101", "10101", "01010"],
  x: ["00000", "00000", "10001", "01010", "00100", "01010", "10001"],
  y: ["00000", "00000", "10001", "10001", "01111", "00001", "01110"],
  z: ["00000", "00000", "11111", "00010", "00100", "01000", "11111"],
  "0": ["01110", "10001", "10011", "10101", "11001", "10001", "01110"],
  "1": ["00100", "01100", "00100", "00100", "00100", "00100", "01110"],
  "2": ["01110", "10001", "00001", "00110", "01000", "10000", "11111"],
  "3": ["11111", "00010", "00100", "00010", "00001", "10001", "01110"],
  "4": ["00010", "00110", "01010", "10010", "11111", "00010", "00010"],
  "5": ["11111", "10000", "11110", "00001", "00001", "10001", "01110"],
  "6": ["00110", "01000", "10000", "11110", "10001", "10001", "01110"],
  "7": ["11111", "00001", "00010", "00100", "01000", "01000", "01000"],
  "8": ["01110", "10001", "10001", "01110", "10001", "10001", "01110"],
  "9": ["01110", "10001", "10001", "01111", "00001", "00010", "01100"],
  " ": ["00000", "00000", "00000", "00000", "00000", "00000", "00000"],
  ".": ["00000", "00000", "00000", "00000", "00000", "01100", "01100"],
  ",": ["00000", "00000", "00000", "00000", "01100", "00100", "01000"],
  "'": ["00100", "00100", "01000", "00000", "00000", "00000", "00000"],
  "-": ["00000", "00000", "00000", "01110", "00000", "00000", "00000"],
  ":": ["00000", "01100", "01100", "00000", "01100", "01100", "00000"],
  ";": ["00000", "01100", "01100", "00000", "01100", "00100", "01000"],
  "!": ["00100", "00100", "00100", "00100", "00100", "00000", "00100"],
  "?": ["01110", "10001", "00001", "00110", "00100", "00000", "00100"],
  "/": ["00001", "00010", "00010", "00100", "01000", "01000", "10000"],
  "(": ["00010", "00100", "01000", "01000", "01000", "00100", "00010"],
  ")": ["01000", "00100", "00010", "00010", "00010", "00100", "01000"],
  "&": ["01100", "10010", "10100", "01000", "10101", "10010", "01101"],
  "%": ["11001", "11010", "00010", "00100", "01000", "01011", "10011"],
  "+": ["00000", "00100", "00100", "11111", "00100", "00100", "00000"],
  '"': ["01010", "01010", "00000", "00000", "00000", "00000", "00000"],
  "=": ["00000", "00000", "11111", "00000", "11111", "00000", "00000"],
  "\u2022": ["00000", "00000", "01100", "01100", "01100", "00000", "00000"],
};

const GLYPH_W = 5;
const GLYPH_H = 7;

function textWidth(s: string, scale: number): number {
  if (s.length === 0) return 0;
  return s.length * (GLYPH_W + 1) * scale - scale;
}

function drawChar(ch: string, x: number, y: number, scale: number, c: number[]): void {
  const g = FONT[ch] ?? FONT["?"];
  for (let r = 0; r < GLYPH_H; r++) {
    for (let col = 0; col < GLYPH_W; col++) {
      if (g[r][col] === "1") {
        fillRect(x + col * scale, y + r * scale, scale, scale, c);
      }
    }
  }
}

function drawText(s: string, x: number, y: number, scale: number, c: number[]): void {
  let cx = x;
  for (const ch of s) {
    drawChar(ch, cx, y, scale, c);
    cx += (GLYPH_W + 1) * scale;
  }
}

function drawTextCentered(s: string, cx: number, y: number, scale: number, c: number[]): void {
  drawText(s, cx - Math.floor(textWidth(s, scale) / 2), y, scale, c);
}

// Word-wrap plain text to lines that fit maxWidth pixels at the given scale.
function wrapText(s: string, maxWidth: number, scale: number): string[] {
  const words = s.split(" ");
  const lines: string[] = [];
  let cur = "";
  for (const w of words) {
    const trial = cur === "" ? w : cur + " " + w;
    if (textWidth(trial, scale) <= maxWidth) {
      cur = trial;
    } else {
      if (cur !== "") lines.push(cur);
      cur = w;
    }
  }
  if (cur !== "") lines.push(cur);
  return lines;
}

// Draw wrapped text, return the y just below the last line.
function drawParagraph(s: string, x: number, y: number, maxWidth: number, scale: number, c: number[], leading = 4): number {
  const lines = wrapText(s, maxWidth, scale);
  let cy = y;
  for (const ln of lines) {
    drawText(ln, x, cy, scale, c);
    cy += GLYPH_H * scale + leading;
  }
  return cy;
}

// ---------------------------------------------------------------- PNG output
const CRC_TABLE: number[] = (() => {
  const t: number[] = [];
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t.push(c >>> 0);
  }
  return t;
})();

function crc32(buf: Buffer): number {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type: string, data: Buffer): Buffer {
  const out = Buffer.alloc(12 + data.length);
  out.writeUInt32BE(data.length, 0);
  out.write(type, 4, "ascii");
  data.copy(out, 8);
  const crc = crc32(Buffer.concat([Buffer.from(type, "ascii"), data]));
  out.writeUInt32BE(crc, 8 + data.length);
  return out;
}

function encodePNG(): Buffer {
  const raw = Buffer.alloc(H * (1 + W * 4));
  for (let y = 0; y < H; y++) {
    raw[y * (1 + W * 4)] = 0; // filter: none
    raw.set(px.subarray(y * W * 4, (y + 1) * W * 4), y * (1 + W * 4) + 1);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(W, 0);
  ihdr.writeUInt32BE(H, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // colour type RGBA
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;
  const idat = deflateSync(raw, { level: 9 });
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", idat),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

// ---------------------------------------------------------------- little icons
// Each icon is drawn inside a small box at (x, y) with a size in pixels.

function iconStar(cx: number, cy: number, r: number, c: number[]): void {
  // Five-pointed badge star.
  const pts: [number, number][] = [];
  for (let i = 0; i < 10; i++) {
    const ang = -Math.PI / 2 + (i * Math.PI) / 5;
    const rr = i % 2 === 0 ? r : Math.round(r * 0.45);
    pts.push([cx + Math.round(Math.cos(ang) * rr), cy + Math.round(Math.sin(ang) * rr)]);
  }
  for (let i = 0; i < 10; i++) {
    const [ax, ay] = pts[i];
    const [bx, by] = pts[(i + 1) % 10];
    line(cx, cy, ax, ay, c, 1);
    line(ax, ay, bx, by, c, 2);
  }
  fillCircle(cx, cy, Math.max(2, Math.round(r * 0.28)), c);
}

function iconRobot(x: number, y: number, s: number, c: number[]): void {
  // Robot head: square skull, antenna, two eyes, grille mouth.
  const w = s;
  const h = Math.round(s * 0.85);
  rect(x, y + Math.round(s * 0.2), w, h, c, 2);
  line(x + Math.floor(w / 2), y, x + Math.floor(w / 2), y + Math.round(s * 0.2), c, 2);
  fillCircle(x + Math.floor(w / 2), y, Math.max(2, Math.round(s * 0.08)), c);
  fillRect(x + Math.round(w * 0.2), y + Math.round(h * 0.45), Math.round(w * 0.16), Math.round(h * 0.18), c);
  fillRect(x + Math.round(w * 0.64), y + Math.round(h * 0.45), Math.round(w * 0.16), Math.round(h * 0.18), c);
  for (let i = 0; i < 3; i++) {
    fillRect(x + Math.round(w * 0.28) + i * Math.round(w * 0.16), y + Math.round(h * 0.78), Math.round(w * 0.08), Math.round(h * 0.1), c);
  }
}

function iconBuilding(x: number, y: number, s: number, c: number[]): void {
  // Apartment block with a crack and a broken corner.
  const w = Math.round(s * 0.8);
  const h = s;
  rect(x, y, w, h, c, 2);
  for (let r = 0; r < 3; r++) {
    for (let col = 0; col < 2; col++) {
      fillRect(x + 4 + col * Math.round(w * 0.45), y + 5 + r * Math.round(h * 0.3), Math.round(w * 0.22), Math.round(h * 0.14), c);
    }
  }
  line(x + Math.round(w * 0.55), y, x + Math.round(w * 0.4), y + Math.round(h * 0.35), c, 2);
  line(x + Math.round(w * 0.4), y + Math.round(h * 0.35), x + Math.round(w * 0.6), y + Math.round(h * 0.6), c, 2);
  line(x + Math.round(w * 0.6), y + Math.round(h * 0.6), x + Math.round(w * 0.45), y + h, c, 2);
}

function iconFlame(x: number, y: number, s: number, c: number[]): void {
  // Stylised flame: two stacked triangles plus a round base.
  const cx = x + Math.round(s / 2);
  fillTriangle(cx, y, x + Math.round(s * 0.15), y + Math.round(s * 0.55), x + Math.round(s * 0.85), y + Math.round(s * 0.55), c);
  fillTriangle(cx - Math.round(s * 0.1), y + Math.round(s * 0.35), x, y + s, x + s, y + s, c);
  fillCircle(cx, y + Math.round(s * 0.82), Math.round(s * 0.18), c);
}

function iconCap(x: number, y: number, s: number, c: number[]): void {
  // Graduation cap: diamond board, head band, tassel.
  const cx = x + Math.round(s / 2);
  const cy = y + Math.round(s * 0.32);
  fillTriangle(cx - Math.round(s * 0.5), cy, cx, cy - Math.round(s * 0.22), cx + Math.round(s * 0.5), cy, c);
  fillTriangle(cx - Math.round(s * 0.5), cy, cx, cy + Math.round(s * 0.22), cx + Math.round(s * 0.5), cy, c);
  fillRect(cx - Math.round(s * 0.28), cy + Math.round(s * 0.18), Math.round(s * 0.56), Math.round(s * 0.3), c);
  line(x + s - 2, cy, x + s - 2, y + Math.round(s * 0.85), c, 2);
  fillCircle(x + s - 2, y + Math.round(s * 0.9), 3, c);
}

function iconFlags(x: number, y: number, s: number): void {
  // Two small flags side by side: Nepal (crimson) and India (saffron/white/green).
  const fw = Math.round(s * 0.42);
  const fh = Math.round(s * 0.62);
  // Nepal flag: crimson field, blue border.
  rect(x, y, fw, fh, BLUE, 2);
  fillRect(x + 2, y + 2, fw - 4, fh - 4, RED);
  fillTriangle(x + 4, y + fh - 5, x + 4, y + 5, x + fw - 5, y + Math.round(fh * 0.55), WHITE);
  // India flag: three stripes.
  const ix = x + fw + 4;
  fillRect(ix, y, fw, Math.round(fh / 3), [255, 153, 51, 255]);
  fillRect(ix, y + Math.round(fh / 3), fw, Math.round(fh / 3), WHITE);
  fillRect(ix, y + Math.round((2 * fh) / 3), fw, fh - Math.round((2 * fh) / 3), GREEN);
  rect(ix, y, fw, fh, INK, 1);
  fillCircle(ix + Math.round(fw / 2), y + Math.round(fh / 2), Math.max(2, Math.round(fw * 0.14)), BLUE);
}

// ---------------------------------------------------------------- the stories
// All facts as reported on Monday 23 November 2026 (events of 23 Nov, or
// first reported that day). Sources: CNN, WSJ, Reuters, BBC, AFP, The Times,
// Le Monde, The Guardian.

interface Panel {
  kicker: string;
  color: number[];
  headline: string;
  body: string;
  icon: "star" | "robot" | "building" | "flame" | "cap" | "flags";
}

const PANELS: Panel[] = [
  {
    kicker: "MEXICO",
    color: RED,
    headline: "KINGPIN CAUGHT",
    body: "FBI most-wanted 'El Chapo Isidro' is seized in Sinaloa. Eleven die in gun battles.",
    icon: "star",
  },
  {
    kicker: "UNITED NATIONS",
    color: BLUE,
    headline: "ROBOT-WEAPONS TALKS GO ON",
    body: "Nations agree to keep negotiating limits on lethal autonomous weapons at the UN.",
    icon: "robot",
  },
  {
    kicker: "UKRAINE",
    color: TEAL,
    headline: "DRONE HITS FLATS NEAR KYIV",
    body: "A Russian drone hits a five-storey block in Dymer. Fourteen people are missing.",
    icon: "building",
  },
  {
    kicker: "INDONESIA",
    color: GOLD,
    headline: "FACTORY FIRE: 50 MISSING",
    body: "Seven bodies are found after a blaze at a candy factory. Dozens are still missing.",
    icon: "flame",
  },
  {
    kicker: "SOUTH KOREA",
    color: RED,
    headline: "MINISTER QUITS IN AI EXAM ROW",
    body: "The education minister resigns over AI cheating in national exams.",
    icon: "cap",
  },
  {
    kicker: "NEPAL - INDIA",
    color: BLUE,
    headline: "NEPAL PM MEETS MODI",
    body: "Nepal's PM Balendra Shah holds bilateral talks in Delhi on a two-day state visit to India.",
    icon: "flags",
  },
];

const LEAD_HEADLINE = "COP31 COLLAPSES";
const LEAD_SUB = "Longest climate summit in history ends with no deal";
const LEAD_BODY =
  "UN climate talks in Antalya collapse after two weeks, as a final text dropping fossil fuels is rejected by the EU.";

// ---------------------------------------------------------------- drawing
function drawEarth(cx: number, cy: number, r: number): void {
  // A cracked planet: blue sea, green land, white clouds, red crack.
  fillCircle(cx, cy, r, BLUE);
  circle(cx, cy, r, INK, 3);
  // Land masses (rough blobs made of overlapping circles).
  fillCircle(cx - Math.round(r * 0.42), cy - Math.round(r * 0.3), Math.round(r * 0.34), GREEN);
  fillCircle(cx - Math.round(r * 0.2), cy - Math.round(r * 0.42), Math.round(r * 0.24), GREEN);
  fillCircle(cx + Math.round(r * 0.38), cy + Math.round(r * 0.28), Math.round(r * 0.3), GREEN);
  fillCircle(cx + Math.round(r * 0.15), cy + Math.round(r * 0.45), Math.round(r * 0.2), GREEN);
  fillCircle(cx + Math.round(r * 0.5), cy - Math.round(r * 0.35), Math.round(r * 0.16), GREEN);
  // Clouds.
  fillCircle(cx - Math.round(r * 0.1), cy - Math.round(r * 0.05), Math.round(r * 0.16), WHITE);
  fillCircle(cx + Math.round(r * 0.05), cy - Math.round(r * 0.12), Math.round(r * 0.12), WHITE);
  fillCircle(cx + Math.round(r * 0.3), cy + Math.round(r * 0.05), Math.round(r * 0.1), WHITE);
  // The crack: a red zig-zag across the globe.
  line(cx - Math.round(r * 0.75), cy - Math.round(r * 0.55), cx - Math.round(r * 0.3), cy - Math.round(r * 0.1), RED, 4);
  line(cx - Math.round(r * 0.3), cy - Math.round(r * 0.1), cx - Math.round(r * 0.05), cy + Math.round(r * 0.3), RED, 4);
  line(cx - Math.round(r * 0.05), cy + Math.round(r * 0.3), cx + Math.round(r * 0.35), cy + Math.round(r * 0.05), RED, 4);
  line(cx + Math.round(r * 0.35), cy + Math.round(r * 0.05), cx + Math.round(r * 0.7), cy + Math.round(r * 0.5), RED, 4);
  // Small red warning dots at the crack ends.
  fillCircle(cx - Math.round(r * 0.75), cy - Math.round(r * 0.55), 5, RED);
  fillCircle(cx + Math.round(r * 0.7), cy + Math.round(r * 0.5), 5, RED);
}

function drawIcon(kind: Panel["icon"], x: number, y: number, s: number, c: number[]): void {
  if (kind === "star") iconStar(x + Math.round(s / 2), y + Math.round(s / 2), Math.round(s * 0.42), c);
  else if (kind === "robot") iconRobot(x, y, s, c);
  else if (kind === "building") iconBuilding(x, y, s, c);
  else if (kind === "flame") iconFlame(x, y, s, c);
  else if (kind === "cap") iconCap(x, y, s, c);
  else if (kind === "flags") iconFlags(x, y, s);
}

function drawPanel(p: Panel, x: number, y: number, w: number, h: number): void {
  fillRect(x, y, w, h, WHITE);
  rect(x, y, w, h, INK, 2);
  // Colour bar on top.
  fillRect(x + 2, y + 2, w - 4, 8, p.color);
  // Kicker.
  drawText(p.kicker, x + 14, y + 22, 2, p.color);
  // Icon at top right.
  drawIcon(p.icon, x + w - 48, y + 18, 30, p.color);
  // Headline, wrapped to two lines max, starting below the icon.
  const headLines = wrapText(p.headline, w - 28, 3);
  let cy = y + 58;
  for (const ln of headLines.slice(0, 2)) {
    drawText(ln, x + 14, cy, 3, INK);
    cy += GLYPH_H * 3 + 4;
  }
  // Thin rule under the headline.
  hline(x + 14, x + w - 14, cy + 2, LIGHTGREY, 2);
  // Body text.
  drawParagraph(p.body, x + 14, cy + 12, w - 28, 2, INK, 3);
}

function draw(): void {
  fillRect(0, 0, W, H, PAPER);

  // ---- masthead
  hline(16, W - 16, 14, INK, 3);
  drawTextCentered("THE WORLD IN ONE DAY", W / 2, 30, 6, INK);
  drawTextCentered("MONDAY, 23 NOVEMBER 2026", W / 2, 84, 4, RED);
  hline(16, W - 16, 128, INK, 3);
  hline(16, W - 16, 134, INK, 1);

  // ---- lead story: COP31
  const lx = 16;
  const ly = 146;
  const lw = W - 32;
  const lh = 278;
  fillRect(lx, ly, lw, lh, WHITE);
  rect(lx, ly, lw, lh, INK, 3);
  drawText("CLIMATE  •  ANTALYA, TURKEY", lx + 20, ly + 18, 2, RED);
  drawText(LEAD_HEADLINE, lx + 20, ly + 48, 6, INK);
  // Sub-headline wrapped inside the text column, clear of the globe.
  const subEnd = drawParagraph(LEAD_SUB, lx + 20, ly + 106, 600, 3, BLUE, 4);
  hline(lx + 20, lx + 620, subEnd + 8, LIGHTGREY, 2);
  const bodyEnd = drawParagraph(LEAD_BODY, lx + 20, subEnd + 20, 600, 2, INK, 5);
  drawText("First COP to fail since Copenhagen 2009.", lx + 20, bodyEnd + 10, 2, GREY);
  // Earth illustration on the right.
  drawEarth(868, 285, 92);
  drawTextCentered("NO DEAL", 868, 392, 2, RED);

  // ---- six story panels, 3 x 2
  const cols = [16, 352, 688];
  const rows = [436, 648];
  const pw = 320;
  const ph = 200;
  for (let i = 0; i < PANELS.length; i++) {
    drawPanel(PANELS[i], cols[i % 3], rows[Math.floor(i / 3)], pw, ph);
  }

  // ---- ticker
  const ty = 872;
  fillRect(16, ty, W - 32, 72, INK);
  drawText("ALSO TODAY:", 30, ty + 10, 2, YELLOW);
  drawParagraph(
    "India 720/9, a record, in the Wellington Test  •  Liverpool thrash 10-man Man Utd  •  24 killed in South Sudan  •  US presses Nvidia on China chips",
    30,
    ty + 34,
    W - 60,
    2,
    WHITE,
    3,
  );

  // ---- footer: sources
  drawTextCentered(
    "Sources: CNN - WSJ - Reuters - BBC - AFP - The Times - Le Monde - The Guardian",
    W / 2,
    960,
    2,
    GREY,
  );
  drawTextCentered("Drawn entirely in code. No photographs.", W / 2, 986, 2, GREY);
}

// ---------------------------------------------------------------- main
function main(): void {
  const outDir = process.env.MAKEFUN_OUTPUT_DIR ?? "/output";
  mkdirSync(outDir, { recursive: true });
  draw();
  const png = encodePNG();
  writeFileSync(join(outDir, "entry.png"), png);
  console.log(`wrote ${join(outDir, "entry.png")} (${png.length} bytes, ${W}x${H})`);
}

main();
