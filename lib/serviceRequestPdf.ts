// The Additional Services Request as a PDF (Download on the request page): the same details as the
// page (lib/serviceRequestForm.ts), with the Zemen Bank logo and signature lines.

import fs from 'fs';
import path from 'path';
import { PdfDocument, PdfImage, Rgb, decodePng } from '@/lib/pdf';
import {
  ServiceRequestCustomer, serviceRequestSections, serviceRequestServices, serviceRequestNotifications,
  serviceRequestStatus, formatFormDate,
} from '@/lib/serviceRequestForm';

const BLUE: Rgb = [30, 64, 175];
const DARK: Rgb = [15, 23, 42];
const GRAY: Rgb = [100, 116, 139];
const BAND: Rgb = [241, 245, 249];
const RULE: Rgb = [203, 213, 225];
const GREEN: Rgb = [21, 128, 61];
const AMBER: Rgb = [180, 83, 9];
const RED: Rgb = [185, 28, 28];

let logo: PdfImage | null | undefined;
function zemenLogo(): PdfImage | null {
  if (logo === undefined) {
    try {
      logo = decodePng(fs.readFileSync(path.join(process.cwd(), 'public', 'zblogo.png')));
    } catch (error) {
      console.warn('[ServiceRequestPdf] Logo not loaded:', (error as Error).message);
      logo = null;
    }
  }
  return logo;
}

// Ethiopic text cannot be printed with the PDF fonts: keep the Latin part, if any
const ETHIOPIC = /[ሀ-᎟ⶀ-⷟꬀-꬯]+/g;
function latin(value: string): string {
  if (value.search(ETHIOPIC) < 0) return value;
  const rest = value.replace(ETHIOPIC, '').replace(/\s+/g, ' ').trim();
  return /[A-Za-z0-9]/.test(rest) ? rest : '(in Amharic, see the request online)';
}

export function serviceRequestPdf(c: ServiceRequestCustomer, { printedBy }: { printedBy: string }): Buffer {
  const doc = new PdfDocument({ title: `Additional Services Request ${c.customerId}`, author: 'Zemen Bank' });
  const M = 48;
  const W = doc.width - 2 * M;
  const BOTTOM = doc.height - 64;
  const VALUE_X = 92; // value column, from the start of its label
  let y = M;
  const ensure = (height: number) => {
    if (y + height > BOTTOM) { doc.addPage(); y = M; }
  };
  const band = (title: string) => {
    ensure(48);
    doc.rect(M, y, W, 18, { fill: BAND });
    doc.text(M + 8, y + 12.5, title, { size: 10, bold: true, color: BLUE });
    y += 31;
  };

  // Header: logo, bank, title; application ID and when it was printed
  const img = zemenLogo();
  const logoHeight = 48;
  const titleX = img ? M + (logoHeight * img.width) / img.height + 12 : M;
  if (img) doc.image(img, M, y, (logoHeight * img.width) / img.height, logoHeight);
  doc.text(titleX, y + 20, 'ZEMEN BANK', { size: 16, bold: true, color: BLUE });
  doc.text(titleX, y + 39, 'Additional Services Request', { size: 12.5, bold: true, color: DARK });
  doc.text(M + W, y + 12, 'Application ID', { size: 8, color: GRAY, align: 'right' });
  doc.text(M + W, y + 26, c.customerId, { size: 11, bold: true, color: DARK, align: 'right' });
  doc.text(M + W, y + 40, `Printed ${formatFormDate(new Date())}`, { size: 8, color: GRAY, align: 'right' });
  doc.text(M + W, y + 51, `by ${latin(printedBy)}`, { size: 8, color: GRAY, align: 'right' });
  y += 62;
  doc.line(M, y, M + W, y, { width: 1.5, color: BLUE });
  y += 20;
  const status = serviceRequestStatus(c);
  doc.text(M, y, 'Request status:', { size: 10, color: GRAY });
  doc.text(M + doc.textWidth('Request status: ', 10), y, status, { size: 10, bold: true, color: status === 'Completed' ? GREEN : AMBER });
  y += 18;

  // Customer, address and account details, two to a line
  const COL = W / 2;
  for (const section of serviceRequestSections(c, { amharic: false })) {
    band(section.title);
    for (let i = 0; i < section.rows.length; i += 2) {
      const pair = section.rows.slice(i, i + 2).map(row => ({ row, lines: doc.wrap(latin(row.value), COL - VALUE_X - 8, 10) }));
      const height = Math.max(...pair.map(p => p.lines.length)) * 13 + 5;
      ensure(height);
      pair.forEach(({ row, lines }, j) => {
        const x = M + 8 + j * COL;
        doc.text(x, y, row.label, { size: 8.5, color: GRAY });
        lines.forEach((line, k) => doc.text(x + VALUE_X, y + k * 13, line, { size: 10, color: DARK }));
      });
      y += height;
    }
    y += 4;
  }

  // Requested services
  band('Requested services');
  const COLS = [M + 8, M + 168, M + 348];
  const widths = [COLS[1] - COLS[0] - 10, COLS[2] - COLS[1] - 10, M + W - COLS[2] - 8];
  doc.text(COLS[0], y, 'Service', { size: 8.5, bold: true, color: GRAY });
  doc.text(COLS[1], y, 'Terms and conditions', { size: 8.5, bold: true, color: GRAY });
  doc.text(COLS[2], y, 'Status', { size: 8.5, bold: true, color: GRAY });
  y += 6;
  doc.line(M, y, M + W, y, { color: RULE });
  y += 13;
  for (const s of serviceRequestServices(c)) {
    const cells = [
      doc.wrap(latin(s.name), widths[0], 10, true),
      doc.wrap(s.terms, widths[1], 9),
      doc.wrap(latin(s.status), widths[2], 9),
    ];
    const height = Math.max(...cells.map(l => l.length)) * 12 + 8;
    ensure(height);
    cells[0].forEach((line, i) => doc.text(COLS[0], y + i * 12, line, { size: 10, bold: true, color: DARK }));
    cells[1].forEach((line, i) => doc.text(COLS[1], y + i * 12, line, { size: 9, color: s.termsMissing ? RED : DARK }));
    cells[2].forEach((line, i) => doc.text(COLS[2], y + i * 12, line, { size: 9, color: s.done ? GREEN : AMBER }));
    y += height - 6;
    doc.line(M, y, M + W, y, { color: RULE });
    y += 14;
  }
  y += 4;

  // SMS already sent about the services
  const notifications = serviceRequestNotifications(c);
  if (notifications.length) {
    band('SMS sent to the customer');
    for (const n of notifications) {
      const lines = doc.wrap(latin(n), W - 16, 9);
      ensure(lines.length * 12 + 2);
      lines.forEach((line, i) => doc.text(M + 8, y + i * 12, line, { size: 9, color: DARK }));
      y += lines.length * 12 + 2;
    }
    y += 6;
  }

  // Signatures
  ensure(120);
  band('Signatures');
  const half = (W - 24) / 2;
  const signature = (x: number, title: string, name: string) => {
    doc.text(x, y, title, { size: 10, bold: true, color: DARK });
    [['Name', name], ['Signature', ''], ['Date', '']].forEach(([label, value], i) => {
      const lineY = y + 28 + i * 26;
      doc.text(x, lineY, label, { size: 9, color: GRAY });
      if (value) doc.text(x + 58, lineY - 2, latin(value), { size: 10, color: DARK });
      doc.line(x + 56, lineY + 2, x + half, lineY + 2, { color: GRAY });
    });
  };
  signature(M + 8, 'Customer', c.fullName);
  signature(M + 16 + half, 'Personal Banker', '');
  y += 100;

  // Footer on every page
  for (let i = 0; i < doc.pageCount; i++) {
    doc.usePage(i);
    const fy = doc.height - 40;
    doc.line(M, fy - 12, M + W, fy - 12, { color: RULE });
    doc.text(M, fy, `Zemen Bank · Additional Services Request · ${c.customerId}`, { size: 8, color: GRAY });
    doc.text(M + W, fy, `Page ${i + 1} of ${doc.pageCount}`, { size: 8, color: GRAY, align: 'right' });
  }
  return doc.toBuffer();
}
