/* File output: clipboard, CSV, XLSX and PDF. The heavy libraries are imported
   lazily so they never sit in the first chunk. */

import type { ManifestBand } from './selectors';
import { longDate } from './dates';
import { COMPANY } from '../lib/config';

export function download(name: string, data: BlobPart, mime = 'text/csv;charset=utf-8'): void {
  const blob = data instanceof Blob ? data : new Blob([data], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export async function copyText(text: string): Promise<boolean> {
  if (navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      return false;
    }
  }
  return false;
}

/**
 * Copy an image to the system clipboard so it can be pasted straight into
 * WhatsApp Web. The Clipboard API only accepts PNG for images, so a JPEG (what
 * the media bucket actually stores) is redrawn through a canvas first — every
 * evergreen browser that implements `ClipboardItem` also implements canvas
 * `toBlob('image/png')`, so this never has to fall back further than that.
 */
export async function copyImage(url: string): Promise<boolean> {
  if (!navigator.clipboard?.write || typeof ClipboardItem === 'undefined') return false;
  try {
    const res = await fetch(url);
    const blob = await res.blob();
    const png = blob.type === 'image/png' ? blob : await toPng(blob);
    await navigator.clipboard.write([new ClipboardItem({ 'image/png': png })]);
    return true;
  } catch {
    return false;
  }
}

function toPng(blob: Blob): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(blob);
    img.onload = () => {
      URL.revokeObjectURL(url);
      const canvas = document.createElement('canvas');
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      const ctx = canvas.getContext('2d');
      if (!ctx) { reject(new Error('canvas unavailable')); return; }
      ctx.drawImage(img, 0, 0);
      canvas.toBlob(b => (b ? resolve(b) : reject(new Error('encode failed'))), 'image/png');
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('image failed to load')); };
    img.src = url;
  });
}

const csvCell = (c: unknown): string =>
  '"' + String(c ?? '').replace(/"/g, '""') + '"';

export const toCsv = (rows: unknown[][]): string =>
  rows.map(r => r.map(csvCell).join(',')).join('\n');

/* ── manifests ──────────────────────────────────────────────────────────── */
const MANIFEST_HEAD = [
  'Group', 'Tour', 'Option', 'Tour time', 'Ticket time', 'Note', 'Guide', 'Guide phone',
  'No', 'Reference', 'Name', 'Age', 'Role', 'Phone', 'Language',
];

export function manifestCsv(bands: ManifestBand[]): string {
  const lines: unknown[][] = [MANIFEST_HEAD];
  for (const g of bands) {
    for (const r of g.rows) {
      lines.push([
        g.no, g.tour, `${g.tg} ${g.tgTitle}`, g.time, g.ticketTime, g.notes, g.guide, g.guidePhone,
        r.no, r.ref, r.name, r.age, r.role, r.phone, r.lang,
      ]);
    }
  }
  return toCsv(lines);
}

export function manifestText(bands: ManifestBand[], date: string): string {
  const head = `${COMPANY} — manifest ${longDate(date)}`;
  if (!bands.length) return `${head}\nNo grouped departures.`;
  return (
    head + '\n\n' +
    bands
      .map(g =>
        `GRP ${g.no} · ${g.tour} (${g.tg}) · tour ${g.time}`
        + `${g.ticketTime ? ` · ticket time ${g.ticketTime}` : ''}`
        + ` · ${g.guide} ${g.guidePhone} · ${g.fill}\n`
        + `${g.notes ? `  Note: ${g.notes}\n` : ''}` +
        g.rows
          .map(r => `  ${r.no}. ${r.name} (${r.age})${r.phone ? ` · ${r.phone}` : ''}`)
          .join('\n'),
      )
      .join('\n\n')
  );
}

async function newPdf(orientation: 'p' | 'l' = 'p') {
  const { jsPDF } = await import('jspdf');
  const autoTable = (await import('jspdf-autotable')).default;
  const doc = new jsPDF({ orientation, unit: 'pt', format: 'a4' });
  return { doc, autoTable };
}

const BRAND: [number, number, number] = [11, 18, 32];
const ACCENT: [number, number, number] = [253, 151, 7];

export async function manifestPdf(bands: ManifestBand[], date: string): Promise<Blob> {
  const { doc, autoTable } = await newPdf('p');
  const W = doc.internal.pageSize.getWidth();

  doc.setFillColor(...BRAND);
  doc.rect(0, 0, W, 58, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(15);
  doc.text('SOLE', 40, 27);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(190, 197, 208);
  doc.text(`${COMPANY} · daily manifest`, 40, 42);
  doc.setTextColor(...ACCENT);
  doc.setFontSize(10);
  doc.text(longDate(date), W - 40, 34, { align: 'right' });

  let y = 78;

  if (!bands.length) {
    doc.setTextColor(120, 128, 140);
    doc.setFontSize(11);
    doc.text('No grouped departures for this day.', 40, y);
    return doc.output('blob');
  }

  const W_CONTENT = W - 80;

  for (const g of bands) {
    /* A solid navy band, matching the screen. The previous version set the
       group line in grey on white, which survives a laptop screen and washes
       out completely on a phone — which is where the guides actually read it. */
    doc.setFillColor(...BRAND);
    doc.rect(40, y - 12, W_CONTENT, 34, 'F');

    doc.setTextColor(...ACCENT);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.text(`GRP ${g.no}`, 48, y);

    doc.setTextColor(255, 255, 255);
    doc.setFontSize(11);
    doc.text(`${g.tour}`, 90, y);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(214, 220, 230);
    doc.text(`${g.tg} · ${g.tgTitle}`, 48, y + 13);

    // Times and guide on the right, where the eye lands last.
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9.5);
    const when = `${g.ticketTime ? `ticket time ${g.ticketTime}   ` : ''}tour ${g.time}`;
    doc.text(when, W - 48, y, { align: 'right' });

    doc.setFont('helvetica', 'normal');
    doc.setTextColor(253, 180, 78);
    doc.text(
      `${g.guide}${g.guidePhone ? `  ${g.guidePhone}` : ''}   ${g.fill}`,
      W - 48, y + 13, { align: 'right' },
    );

    let tableTop = y + 30;

    /* The operator's note for this group, in a warm band the eye cannot skip. */
    if (g.notes) {
      const lines = doc.splitTextToSize(`Note: ${g.notes}`, W_CONTENT - 16) as string[];
      const noteH = 8 + lines.length * 11;
      doc.setFillColor(253, 243, 227);
      doc.rect(40, tableTop, W_CONTENT, noteH, 'F');
      doc.setDrawColor(240, 219, 179);
      doc.rect(40, tableTop, W_CONTENT, noteH, 'S');
      doc.setTextColor(122, 71, 6);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9);
      doc.text(lines, 48, tableTop + 13);
      tableTop += noteH;
    }

    autoTable(doc, {
      startY: tableTop,
      head: [['#', 'Name', 'Age', 'Role', 'Reference', 'Phone', 'Lang']],
      body: g.rows.map(r => [r.no, r.name, r.age, r.role, r.ref, r.phone, r.lang]),
      theme: 'grid',
      // Near-black body text and a navy header row: on a phone the old grey
      // -on-pale-grey combination was the hardest thing on the page to read.
      styles: { fontSize: 9, cellPadding: 5, lineColor: [206, 213, 223], textColor: [20, 27, 40] },
      headStyles: { fillColor: [31, 41, 61], textColor: [255, 255, 255], fontStyle: 'bold' },
      alternateRowStyles: { fillColor: [240, 244, 249] },
      columnStyles: {
        0: { cellWidth: 26 }, 2: { cellWidth: 40 }, 3: { cellWidth: 48 },
        4: { fontStyle: 'bold' }, 6: { cellWidth: 36 },
      },
      margin: { left: 40, right: 40 },
    });

    y = (doc as any).lastAutoTable.finalY + 32;
    if (y > doc.internal.pageSize.getHeight() - 90) {
      doc.addPage();
      y = 56;
    }
  }

  return doc.output('blob');
}

export interface SheetSpec {
  name: string;
  head: string[];
  rows: (string | number)[][];
}

/** Write one or more sheets to a real .xlsx workbook. */
export async function writeWorkbook(file: string, sheets: SheetSpec[]): Promise<void> {
  const XLSX = await import('xlsx');
  const wb = XLSX.utils.book_new();
  for (const s of sheets) {
    const ws = XLSX.utils.aoa_to_sheet([s.head, ...s.rows]);
    ws['!cols'] = s.head.map((h, i) => ({
      wch: Math.min(42, Math.max(h.length + 2, ...s.rows.map(r => String(r[i] ?? '').length + 2))),
    }));
    XLSX.utils.book_append_sheet(wb, ws, s.name.slice(0, 31));
  }
  const out = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
  download(file, new Blob([out], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  }));
}

export interface ReportSection {
  title: string;
  head: string[];
  rows: (string | number)[][];
}

/** Generic branded PDF used by the finance and bookings exports. */
export async function reportPdf(
  title: string, subtitle: string, sections: ReportSection[],
): Promise<Blob> {
  const { doc, autoTable } = await newPdf('l');
  const W = doc.internal.pageSize.getWidth();

  doc.setFillColor(...BRAND);
  doc.rect(0, 0, W, 58, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(15);
  doc.text('SOLE', 40, 27);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(190, 197, 208);
  doc.text(title, 40, 42);
  doc.setTextColor(...ACCENT);
  doc.setFontSize(10);
  doc.text(subtitle, W - 40, 34, { align: 'right' });

  let y = 78;
  for (const s of sections) {
    doc.setTextColor(...BRAND);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.text(s.title, 40, y);

    autoTable(doc, {
      startY: y + 10,
      head: [s.head],
      body: s.rows,
      theme: 'grid',
      styles: { fontSize: 8.5, cellPadding: 4, lineColor: [229, 232, 237], textColor: [40, 48, 62] },
      headStyles: { fillColor: [246, 247, 249], textColor: [90, 98, 112], fontStyle: 'bold' },
      alternateRowStyles: { fillColor: [250, 251, 252] },
      margin: { left: 40, right: 40 },
    });

    y = (doc as any).lastAutoTable.finalY + 24;
    if (y > doc.internal.pageSize.getHeight() - 80) {
      doc.addPage();
      y = 56;
    }
  }

  return doc.output('blob');
}
