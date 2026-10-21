// A small PDF writer for the printable forms (no PDF library on the server): A4 pages, Helvetica
// text, lines, boxes and PNG images. Coordinates are in points from the top-left corner.
// Text is WinAnsi (Latin): characters outside it, such as Ethiopic, print as '?'.

import zlib from 'zlib';

export type Rgb = [number, number, number]; // 0-255

// Helvetica and Helvetica-Bold glyph widths (1/1000 em) for the characters 32-126
const HELVETICA = [
  278, 278, 355, 556, 556, 889, 667, 191, 333, 333, 389, 584, 278, 333, 278, 278, 556, 556, 556, 556, 556, 556,
  556, 556, 556, 556, 278, 278, 584, 584, 584, 556, 1015, 667, 667, 722, 722, 667, 611, 778, 722, 278, 500, 667,
  556, 833, 722, 778, 667, 778, 722, 667, 611, 722, 667, 944, 667, 667, 611, 278, 278, 278, 469, 556, 333, 556,
  556, 500, 556, 556, 278, 556, 556, 222, 222, 500, 222, 833, 556, 556, 556, 556, 333, 500, 278, 556, 500, 722,
  500, 500, 500, 334, 260, 334, 584,
];
const HELVETICA_BOLD = [
  278, 333, 474, 556, 556, 889, 722, 238, 333, 333, 389, 584, 278, 333, 278, 278, 556, 556, 556, 556, 556, 556,
  556, 556, 556, 556, 333, 333, 584, 584, 584, 611, 975, 722, 722, 722, 722, 667, 611, 778, 722, 278, 556, 722,
  611, 833, 722, 778, 667, 778, 722, 667, 611, 722, 667, 944, 667, 667, 611, 333, 278, 333, 584, 556, 333, 556,
  611, 556, 611, 556, 333, 611, 611, 278, 278, 556, 278, 889, 611, 611, 611, 611, 389, 556, 333, 611, 556, 778,
  556, 556, 500, 389, 280, 389, 584,
];

// Characters WinAnsi has outside Latin-1, by their code there
const WIN_ANSI_EXTRA: Record<string, number> = {
  '€': 0x80, '‚': 0x82, '„': 0x84, '…': 0x85, '‘': 0x91, '’': 0x92, '“': 0x93, '”': 0x94, '•': 0x95, '–': 0x96, '—': 0x97, '™': 0x99,
};

/** The text as WinAnsi codes */
function winAnsi(text: string): number[] {
  return Array.from(text.normalize('NFC')).map(ch => {
    const code = ch.codePointAt(0) || 63;
    if (code >= 32 && code <= 126) return code;
    if (WIN_ANSI_EXTRA[ch]) return WIN_ANSI_EXTRA[ch];
    if (code >= 0xa0 && code <= 0xff) return code;
    if (ch === '\t' || ch === '\n') return 32;
    return 63; // '?'
  });
}

function glyphWidth(code: number, bold: boolean): number {
  if (code >= 32 && code <= 126) return (bold ? HELVETICA_BOLD : HELVETICA)[code - 32];
  if (code === 0x96) return 556;
  if (code === 0x97) return 1000;
  if (code === 0x95 || code === 0xb7) return bold ? 350 : 278;
  return 556;
}

export interface PdfImage {
  width: number;
  height: number;
  rgb: Buffer;    // deflated 8-bit RGB
  alpha?: Buffer; // deflated 8-bit alpha, when the image has transparency
}

/** An 8-bit, non-interlaced RGB or RGBA PNG ready to embed; null for any other kind */
export function decodePng(png: Buffer): PdfImage | null {
  if (png.length < 33 || png.readUInt32BE(0) !== 0x89504e47) return null;
  let width = 0, height = 0, bitDepth = 0, colorType = 0, interlace = 0;
  const idat: Buffer[] = [];
  for (let at = 8; at + 8 <= png.length;) {
    const length = png.readUInt32BE(at);
    const type = png.toString('latin1', at + 4, at + 8);
    const data = png.subarray(at + 8, at + 8 + length);
    if (type === 'IHDR') {
      width = data.readUInt32BE(0); height = data.readUInt32BE(4);
      bitDepth = data[8]; colorType = data[9]; interlace = data[12];
    } else if (type === 'IDAT') {
      idat.push(data);
    } else if (type === 'IEND') {
      break;
    }
    at += 12 + length;
  }
  if (!width || !height || bitDepth !== 8 || interlace !== 0 || (colorType !== 2 && colorType !== 6)) return null;

  const channels = colorType === 6 ? 4 : 3;
  const stride = width * channels;
  const raw = zlib.inflateSync(Buffer.concat(idat));
  const pixels = Buffer.alloc(stride * height);
  // Undo the PNG row filters (None, Sub, Up, Average, Paeth)
  for (let y = 0; y < height; y++) {
    const filter = raw[y * (stride + 1)];
    const src = y * (stride + 1) + 1;
    const row = y * stride;
    for (let x = 0; x < stride; x++) {
      const a = x >= channels ? pixels[row + x - channels] : 0;
      const b = y > 0 ? pixels[row - stride + x] : 0;
      const c = x >= channels && y > 0 ? pixels[row - stride + x - channels] : 0;
      let predictor = 0;
      if (filter === 1) predictor = a;
      else if (filter === 2) predictor = b;
      else if (filter === 3) predictor = (a + b) >> 1;
      else if (filter === 4) {
        const p = a + b - c, pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c);
        predictor = pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
      }
      pixels[row + x] = (raw[src + x] + predictor) & 0xff;
    }
  }
  if (channels === 3) return { width, height, rgb: zlib.deflateSync(pixels) };

  const rgb = Buffer.alloc(width * height * 3);
  const alpha = Buffer.alloc(width * height);
  for (let i = 0; i < width * height; i++) {
    rgb[i * 3] = pixels[i * 4]; rgb[i * 3 + 1] = pixels[i * 4 + 1]; rgb[i * 3 + 2] = pixels[i * 4 + 2];
    alpha[i] = pixels[i * 4 + 3];
  }
  return { width, height, rgb: zlib.deflateSync(rgb), alpha: zlib.deflateSync(alpha) };
}

const num = (n: number) => (Math.round(n * 100) / 100).toString();
const color = (c: Rgb) => c.map(v => num(v / 255)).join(' ');

export interface TextOptions { size?: number; bold?: boolean; color?: Rgb; align?: 'left' | 'right' | 'center' }

export class PdfDocument {
  readonly width = 595.28;  // A4
  readonly height = 841.89;
  private pages: string[][] = [];
  private current = 0;
  private images: PdfImage[] = [];

  constructor(private info: { title?: string; author?: string } = {}) {
    this.addPage();
  }

  get pageCount() { return this.pages.length; }

  addPage() {
    this.pages.push([]);
    this.current = this.pages.length - 1;
  }

  /** Draw on an earlier page (0-based), e.g. footers once the page count is known */
  usePage(index: number) {
    this.current = index;
  }

  private draw(op: string) {
    this.pages[this.current].push(op);
  }

  textWidth(text: string, size: number, bold = false): number {
    return winAnsi(text).reduce((w, code) => w + glyphWidth(code, bold), 0) * size / 1000;
  }

  /** The text broken into lines no wider than maxWidth (long words are cut) */
  wrap(text: string, maxWidth: number, size: number, bold = false): string[] {
    const lines: string[] = [];
    for (const paragraph of String(text).split('\n')) {
      let line = '';
      for (const word of paragraph.split(/\s+/).filter(Boolean)) {
        const candidate = line ? `${line} ${word}` : word;
        if (this.textWidth(candidate, size, bold) <= maxWidth) { line = candidate; continue; }
        if (line) lines.push(line);
        line = word;
        while (this.textWidth(line, size, bold) > maxWidth && line.length > 1) {
          let cut = line.length - 1;
          while (cut > 1 && this.textWidth(line.slice(0, cut), size, bold) > maxWidth) cut--;
          lines.push(line.slice(0, cut));
          line = line.slice(cut);
        }
      }
      lines.push(line);
    }
    return lines;
  }

  /** Text with its baseline at y */
  text(x: number, y: number, text: string, { size = 10, bold = false, color: c = [0, 0, 0], align = 'left' }: TextOptions = {}) {
    const width = this.textWidth(text, size, bold);
    const left = align === 'right' ? x - width : align === 'center' ? x - width / 2 : x;
    const bytes = winAnsi(text).map(code => {
      const ch = String.fromCharCode(code);
      return ch === '(' || ch === ')' || ch === '\\' ? `\\${ch}` : ch;
    }).join('');
    this.draw(`BT /${bold ? 'F2' : 'F1'} ${num(size)} Tf ${color(c)} rg ${num(left)} ${num(this.height - y)} Td (${bytes}) Tj ET`);
  }

  line(x1: number, y1: number, x2: number, y2: number, { width = 0.5, color: c = [0, 0, 0] as Rgb } = {}) {
    this.draw(`${num(width)} w ${color(c)} RG ${num(x1)} ${num(this.height - y1)} m ${num(x2)} ${num(this.height - y2)} l S`);
  }

  rect(x: number, y: number, w: number, h: number, { fill, stroke, width = 0.5 }: { fill?: Rgb; stroke?: Rgb; width?: number } = {}) {
    const box = `${num(x)} ${num(this.height - y - h)} ${num(w)} ${num(h)} re`;
    if (fill && stroke) this.draw(`${num(width)} w ${color(fill)} rg ${color(stroke)} RG ${box} B`);
    else if (fill) this.draw(`${color(fill)} rg ${box} f`);
    else this.draw(`${num(width)} w ${color(stroke || [0, 0, 0])} RG ${box} S`);
  }

  /** The image with its top-left corner at (x, y) */
  image(img: PdfImage, x: number, y: number, w: number, h: number) {
    let index = this.images.indexOf(img);
    if (index < 0) index = this.images.push(img) - 1;
    this.draw(`q ${num(w)} 0 0 ${num(h)} ${num(x)} ${num(this.height - y - h)} cm /Im${index + 1} Do Q`);
  }

  toBuffer(): Buffer {
    const objects: Buffer[] = [];
    const add = (body: string | Buffer) => objects.push(typeof body === 'string' ? Buffer.from(body, 'latin1') : body);
    const stream = (dict: string, data: Buffer) =>
      Buffer.concat([Buffer.from(`<< ${dict} /Length ${data.length} >>\nstream\n`, 'latin1'), data, Buffer.from('\nendstream', 'latin1')]);

    // 1 catalog, 2 page tree, 3-4 fonts, 5 info, then images, then each page and its content
    const imageBase = 6;
    const imageIds: number[] = [];
    let next = imageBase;
    for (const img of this.images) {
      imageIds.push(next);
      next += img.alpha ? 2 : 1;
    }
    const pageIds = this.pages.map((_, i) => next + i * 2);

    add('<< /Type /Catalog /Pages 2 0 R >>');
    add(`<< /Type /Pages /Kids [${pageIds.map(id => `${id} 0 R`).join(' ')}] /Count ${pageIds.length} >>`);
    add('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>');
    add('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>');
    const pdfString = (s: string) => `(${s.replace(/[\\()]/g, m => `\\${m}`).replace(/[^\x20-\x7e]/g, '?')})`;
    const now = new Date().toISOString().replace(/[-:T]/g, '').slice(0, 14);
    add(`<< /Producer (Zemen Bank Onboarding) /CreationDate (D:${now}Z)${this.info.title ? ` /Title ${pdfString(this.info.title)}` : ''}${this.info.author ? ` /Author ${pdfString(this.info.author)}` : ''} >>`);
    this.images.forEach((img, i) => {
      const smask = img.alpha ? ` /SMask ${imageIds[i] + 1} 0 R` : '';
      add(stream(`/Type /XObject /Subtype /Image /Width ${img.width} /Height ${img.height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /FlateDecode${smask}`, img.rgb));
      if (img.alpha) add(stream(`/Type /XObject /Subtype /Image /Width ${img.width} /Height ${img.height} /ColorSpace /DeviceGray /BitsPerComponent 8 /Filter /FlateDecode`, img.alpha));
    });
    const xobjects = this.images.length
      ? ` /XObject << ${imageIds.map((id, i) => `/Im${i + 1} ${id} 0 R`).join(' ')} >>`
      : '';
    this.pages.forEach((ops, i) => {
      add(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${this.width} ${this.height}] /Resources << /Font << /F1 3 0 R /F2 4 0 R >>${xobjects} >> /Contents ${pageIds[i] + 1} 0 R >>`);
      add(stream('/Filter /FlateDecode', zlib.deflateSync(Buffer.from(ops.join('\n'), 'latin1'))));
    });

    const chunks: Buffer[] = [Buffer.from('%PDF-1.4\n%\xe2\xe3\xcf\xd3\n', 'latin1')];
    let offset = chunks[0].length;
    const offsets: number[] = [];
    objects.forEach((body, i) => {
      const chunk = Buffer.concat([Buffer.from(`${i + 1} 0 obj\n`, 'latin1'), body, Buffer.from('\nendobj\n', 'latin1')]);
      offsets.push(offset);
      offset += chunk.length;
      chunks.push(chunk);
    });
    const xref = [`xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`, ...offsets.map(o => `${String(o).padStart(10, '0')} 00000 n \n`)].join('');
    chunks.push(Buffer.from(`${xref}trailer\n<< /Size ${objects.length + 1} /Root 1 0 R /Info 5 0 R >>\nstartxref\n${offset}\n%%EOF\n`, 'latin1'));
    return Buffer.concat(chunks);
  }
}
