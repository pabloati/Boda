// Tiny QR code encoder for the editor's "Ver en mi móvil" (no library, no CDN).
// Byte mode (UTF-8), error correction M (L if the text does not fit), versions 1 to 10
// (up to 213 bytes at M, 271 at L): plenty for a preview link.
// Follows ISO/IEC 18004 the way Project Nayuki's reference encoder does.
//   QR.matrix(text)        → { size, version, ecl, mask, dark(x, y) }
//   QR.svg(text, px, fg)   → '<svg …>' string, quiet zone included
(function () {
  'use strict';
  const MAXV = 10;
  // per version 1..10: error-correction codewords per block, number of blocks
  const ECC = { L: [7, 10, 15, 20, 26, 18, 20, 24, 30, 18], M: [10, 16, 26, 18, 24, 16, 18, 22, 22, 26] };
  const BLOCKS = { L: [1, 1, 1, 1, 1, 2, 2, 2, 2, 4], M: [1, 1, 1, 2, 2, 4, 4, 4, 5, 5] };
  const FORMAT = { L: 1, M: 0 };

  function rawModules(v) {
    let r = (16 * v + 128) * v + 64;
    if (v >= 2) { const n = Math.floor(v / 7) + 2; r -= (25 * n - 10) * n - 55; if (v >= 7) r -= 36; }
    return r;
  }
  const dataCodewords = (v, e) => Math.floor(rawModules(v) / 8) - ECC[e][v - 1] * BLOCKS[e][v - 1];

  // ---------- Reed-Solomon over GF(256), polynomial 0x11D ----------
  function mul(x, y) { let z = 0; for (let i = 7; i >= 0; i--) { z = (z << 1) ^ ((z >>> 7) * 0x11D); z ^= ((y >>> i) & 1) * x; } return z & 0xFF; }
  function divisor(d) {
    const r = new Array(d).fill(0); r[d - 1] = 1; let root = 1;
    for (let i = 0; i < d; i++) { for (let j = 0; j < d; j++) { r[j] = mul(r[j], root); if (j + 1 < d) r[j] ^= r[j + 1]; } root = mul(root, 2); }
    return r;
  }
  function remainder(data, div) {
    const r = div.map(() => 0);
    data.forEach(b => { const f = b ^ r.shift(); r.push(0); div.forEach((c, i) => { r[i] ^= mul(c, f); }); });
    return r;
  }

  // ---------- data: mode, length, bytes, padding, blocks + ECC, interleaving ----------
  function codewords(bytes, v, e) {
    const bits = [], put = (val, n) => { for (let i = n - 1; i >= 0; i--) bits.push((val >>> i) & 1); };
    put(4, 4); put(bytes.length, v < 10 ? 8 : 16); bytes.forEach(b => put(b, 8));
    const cap = dataCodewords(v, e) * 8;
    put(0, Math.min(4, cap - bits.length));
    put(0, (8 - bits.length % 8) % 8);
    for (let pad = 0xEC; bits.length < cap; pad ^= 0xEC ^ 0x11) put(pad, 8);
    const data = []; for (let i = 0; i < bits.length; i += 8) data.push(parseInt(bits.slice(i, i + 8).join(''), 2));
    const nb = BLOCKS[e][v - 1], el = ECC[e][v - 1], raw = Math.floor(rawModules(v) / 8);
    const nShort = nb - raw % nb, shortLen = Math.floor(raw / nb), div = divisor(el), blocks = [];
    for (let i = 0, k = 0; i < nb; i++) {
      const dat = data.slice(k, k + shortLen - el + (i < nShort ? 0 : 1)); k += dat.length;
      const ecc = remainder(dat, div);
      if (i < nShort) dat.push(0);
      blocks.push(dat.concat(ecc));
    }
    const out = [];
    for (let i = 0; i < blocks[0].length; i++) blocks.forEach((b, j) => { if (i !== shortLen - el || j >= nShort) out.push(b[i]); });
    return out;
  }

  // ---------- the symbol ----------
  const MASKS = [
    (x, y) => (x + y) % 2 === 0, (x, y) => y % 2 === 0, (x) => x % 3 === 0, (x, y) => (x + y) % 3 === 0,
    (x, y) => (Math.floor(x / 3) + Math.floor(y / 2)) % 2 === 0, (x, y) => x * y % 2 + x * y % 3 === 0,
    (x, y) => (x * y % 2 + x * y % 3) % 2 === 0, (x, y) => ((x + y) % 2 + x * y % 3) % 2 === 0,
  ];
  function alignPos(v, size) {
    if (v === 1) return [];
    const n = Math.floor(v / 7) + 2, step = Math.ceil((v * 4 + 4) / (n * 2 - 2)) * 2, r = [6];
    for (let p = size - 7; r.length < n; p -= step) r.splice(1, 0, p);
    return r;
  }
  function build(cw, v, e, mask) {
    const size = v * 4 + 17, m = [], fn = [];
    for (let y = 0; y < size; y++) { m.push(new Array(size).fill(false)); fn.push(new Array(size).fill(false)); }
    const set = (x, y, d) => { m[y][x] = d; fn[y][x] = true; };
    for (let i = 0; i < size; i++) { set(6, i, i % 2 === 0); set(i, 6, i % 2 === 0); }
    [[3, 3], [size - 4, 3], [3, size - 4]].forEach(([cx, cy]) => {
      for (let dy = -4; dy <= 4; dy++) for (let dx = -4; dx <= 4; dx++) {
        const d = Math.max(Math.abs(dx), Math.abs(dy)), x = cx + dx, y = cy + dy;
        if (x >= 0 && x < size && y >= 0 && y < size) set(x, y, d !== 2 && d !== 4);
      }
    });
    const al = alignPos(v, size), last = al.length - 1;
    al.forEach((ax, i) => al.forEach((ay, j) => {
      if ((i === 0 && j === 0) || (i === 0 && j === last) || (i === last && j === 0)) return;
      for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) set(ax + dx, ay + dy, Math.max(Math.abs(dx), Math.abs(dy)) !== 1);
    }));
    // format bits (error level + mask), BCH(15,5)
    const fd = FORMAT[e] << 3 | mask; let rem = fd;
    for (let i = 0; i < 10; i++) rem = (rem << 1) ^ ((rem >>> 9) * 0x537);
    const fb = (fd << 10 | rem) ^ 0x5412, bit = i => ((fb >>> i) & 1) === 1;
    for (let i = 0; i <= 5; i++) set(8, i, bit(i));
    set(8, 7, bit(6)); set(8, 8, bit(7)); set(7, 8, bit(8));
    for (let i = 9; i < 15; i++) set(14 - i, 8, bit(i));
    for (let i = 0; i < 8; i++) set(size - 1 - i, 8, bit(i));
    for (let i = 8; i < 15; i++) set(8, size - 15 + i, bit(i));
    set(8, size - 8, true);
    // version bits, BCH(18,6), from version 7
    if (v >= 7) {
      let r = v; for (let i = 0; i < 12; i++) r = (r << 1) ^ ((r >>> 11) * 0x1F25);
      const vb = v << 12 | r;
      for (let i = 0; i < 18; i++) { const d = ((vb >>> i) & 1) === 1, a = size - 11 + i % 3, b = Math.floor(i / 3); set(a, b, d); set(b, a, d); }
    }
    // data, zigzag in two-module columns from the bottom right, then the mask
    let k = 0;
    for (let right = size - 1; right >= 1; right -= 2) {
      if (right === 6) right = 5;
      for (let vert = 0; vert < size; vert++) for (let j = 0; j < 2; j++) {
        const x = right - j, up = ((right + 1) & 2) === 0, y = up ? size - 1 - vert : vert;
        if (!fn[y][x] && k < cw.length * 8) { m[y][x] = ((cw[k >>> 3] >>> (7 - (k & 7))) & 1) === 1; k++; }
      }
    }
    for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) if (!fn[y][x] && MASKS[mask](x, y)) m[y][x] = !m[y][x];
    return m;
  }
  // penalty score (lower reads better): runs, 2×2 blocks, finder look-alikes, dark/light balance
  function penalty(m) {
    const n = m.length, lines = [];
    for (let i = 0; i < n; i++) { let r = '', c = ''; for (let j = 0; j < n; j++) { r += m[i][j] ? 1 : 0; c += m[j][i] ? 1 : 0; } lines.push(r, c); }
    let p = 0, dark = 0;
    lines.forEach(l => {
      (l.match(/0{5,}|1{5,}/g) || []).forEach(s => { p += s.length - 2; });
      const q = '0000' + l + '0000';
      for (let i = q.indexOf('1011101'); i >= 0; i = q.indexOf('1011101', i + 1)) if (q.substr(i - 4, 4) === '0000' || q.substr(i + 7, 4) === '0000') p += 40;
    });
    for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
      if (m[y][x]) dark++;
      if (x < n - 1 && y < n - 1 && m[y][x] === m[y][x + 1] && m[y][x] === m[y + 1][x] && m[y][x] === m[y + 1][x + 1]) p += 3;
    }
    return p + Math.max(0, Math.ceil(Math.abs(dark * 20 - n * n * 10) / (n * n)) - 1) * 10;
  }

  // opt (tests only): { ecl: 'L' | 'M', mask: 0..7 } forces the level or the mask
  function matrix(text, opt) {
    opt = opt || {};
    const bytes = [...new TextEncoder().encode(String(text))];
    for (const e of opt.ecl ? [opt.ecl] : ['M', 'L']) for (let v = 1; v <= MAXV; v++) {
      if (4 + (v < 10 ? 8 : 16) + bytes.length * 8 > dataCodewords(v, e) * 8) continue;
      const cw = codewords(bytes, v, e);
      let best = null, bp = Infinity, bm = 0;
      for (let k = 0; k < 8; k++) {
        if (opt.mask != null && k !== opt.mask) continue;
        const m = build(cw, v, e, k), p = penalty(m);
        if (p < bp) { bp = p; best = m; bm = k; }
      }
      return { size: best.length, version: v, ecl: e, mask: bm, dark: (x, y) => best[y][x] };
    }
    throw new Error('Texto demasiado largo para el QR');
  }
  // one path, one unit per module, 4 modules of quiet zone
  function svg(text, px, fg) {
    const q = matrix(text), n = q.size + 8, d = [];
    for (let y = 0; y < q.size; y++) for (let x = 0; x < q.size; x++) if (q.dark(x, y)) d.push(`M${x + 4} ${y + 4}h1v1h-1z`);
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${n} ${n}" width="${px || n * 4}" height="${px || n * 4}" shape-rendering="crispEdges" role="img" aria-label="Código QR"><rect width="${n}" height="${n}" fill="#fff"/><path fill="${fg || '#000'}" d="${d.join('')}"/></svg>`;
  }
  window.QR = { matrix, svg };
})();
