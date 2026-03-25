/**
 * generatePDF — matches the reference receipt design.
 * Updated: uses invoice.document_type in the top-left header label.
 */

import type { Invoice, Business } from '@/types/invoice';
import { jsPDF } from 'jspdf';

const DARK_GREY = [55,  58,  64]  as const;
const BROWN     = [92,  61,  46]  as const;
const GOLD      = [212, 175, 90]  as const;
const WHITE     = [255, 255, 255] as const;
const LIGHT_GREY= [245, 245, 245] as const;
const TEXT_DARK = [30,  30,  30]  as const;
const TEXT_MED  = [80,  80,  80]  as const;

function drawGoldAccent(doc: jsPDF, pageW: number) {
  doc.setFillColor(...GOLD);
  doc.triangle(pageW - 60, 0, pageW, 0, pageW, 45, 'F');
  doc.triangle(pageW - 30, 40, pageW, 20, pageW, 65, 'F');
}

function drawHeaderLogo(doc: jsPDF, x: number, y: number) {
  doc.setDrawColor(...WHITE);
  doc.setLineWidth(1.5);
  doc.line(x, y + 8, x + 10, y);
  doc.line(x + 10, y, x + 20, y + 8);
  doc.line(x, y + 8, x, y + 18);
  doc.line(x + 20, y + 8, x + 20, y + 18);
  doc.line(x, y + 18, x + 20, y + 18);
  doc.rect(x + 7, y + 12, 6, 6);
}

function wrapText(doc: jsPDF, text: string, maxWidth: number): string[] {
  const words = text.split(' ');
  const lines: string[] = [];
  let current = '';
  for (const word of words) {
    const test = current ? `${current} ${word}` : word;
    if (doc.getTextWidth(test) > maxWidth && current) { lines.push(current); current = word; }
    else current = test;
  }
  if (current) lines.push(current);
  return lines;
}

function formatDate(dateStr: string): string {
  return new Date(dateStr)
    .toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' })
    .toUpperCase();
}

function rm(val: number): string {
  return `RM${val % 1 === 0 ? val : val.toFixed(2)}`;
}

export function generatePDF(invoice: Invoice, business: Business): void {
  const doc   = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const mL = 18, mR = pageW - 18;

  // ── Dark header band ─────────────────────────────────────────
  doc.setFillColor(...DARK_GREY);
  doc.rect(0, 0, pageW, 30, 'F');
  drawGoldAccent(doc, pageW);
  drawHeaderLogo(doc, mL, 6);

  // ── RECEIPT / INVOICE / QUOTATION label (top-left, below header) ─
  let y = 42;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(22);
  doc.setTextColor(...TEXT_DARK);
  // Use the document_type from the invoice
  doc.text(invoice.document_type, mL, y);

  doc.setFont('courier', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(...TEXT_MED);
  y += 7;
  doc.text(`INVOICE NUMBER: ${invoice.invoice_number}`, mL, y);
  y += 5;
  doc.text(`DATE: ${formatDate(invoice.invoice_date)}`, mL, y);

  // ── Business name (right) ────────────────────────────────────
  const bizTop = 42;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(17);
  doc.setTextColor(...TEXT_DARK);
  doc.text(business.name.toUpperCase(), mR, bizTop, { align: 'right' });

  doc.setFont('courier', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(...TEXT_MED);
  const locLines = wrapText(doc, business.location, 75);
  let bizY = bizTop + 7;
  for (const line of locLines) { doc.text(line, mR, bizY, { align: 'right' }); bizY += 4.5; }
  doc.text(business.phone, mR, bizY, { align: 'right' });

  y = Math.max(y, bizY) + 10;

  // ── BILL TO ──────────────────────────────────────────────────
  doc.setFont('helvetica', 'bold'); doc.setFontSize(18); doc.setTextColor(...TEXT_DARK);
  doc.text('BILL TO:', mL, y); y += 8;
  doc.setFont('courier', 'normal'); doc.setFontSize(9.5); doc.setTextColor(...TEXT_MED);
  doc.text(invoice.customer_name, mL, y);
  if (invoice.customer_phone) { y += 5; doc.text(invoice.customer_phone, mL, y); }
  y += 14;

  // ── DESCRIPTION ──────────────────────────────────────────────
  doc.setFont('helvetica', 'bold'); doc.setFontSize(18); doc.setTextColor(...TEXT_DARK);
  doc.text('DESCRIPTION', mL, y); y += 8;
  if (invoice.description) {
    doc.setFont('courier', 'normal'); doc.setFontSize(9.5); doc.setTextColor(...TEXT_MED);
    for (const line of invoice.description.split('\n')) { doc.text(line, mL, y); y += 5; }
  }
  y += 10;

  // ── Items table ──────────────────────────────────────────────
  const cItem = mL, cProp = mL + 20, cNight = mL + 90, cPrice = mL + 120, cTotal = mL + 150;
  const tW = mR - mL, rowH = 10;

  doc.setFillColor(...BROWN);
  doc.rect(mL, y, tW, rowH, 'F');
  doc.setFont('helvetica', 'bold'); doc.setFontSize(8.5); doc.setTextColor(...WHITE);
  const hY = y + 6.5;
  doc.text('ITEM',     cItem + 2, hY);
  doc.text('PROPERTY', cProp + 2, hY);
  doc.text('NIGHT',    cNight,    hY, { align: 'center' });
  doc.text('PRICE',    cPrice,    hY, { align: 'center' });
  doc.text('TOTAL',    cTotal,    hY, { align: 'center' });
  y += rowH;

  doc.setFont('courier', 'normal'); doc.setFontSize(9.5);
  invoice.items.forEach((item, idx) => {
    if (idx % 2 === 0) { doc.setFillColor(...LIGHT_GREY); doc.rect(mL, y, tW, rowH, 'F'); }
    doc.setTextColor(...TEXT_DARK);
    const rY = y + 6.5;
    doc.text(`${idx + 1}.`,                       cItem + 2, rY);
    doc.text(item.item_name.toUpperCase(),         cProp + 2, rY);
    doc.text(String(item.quantity),                cNight,    rY, { align: 'center' });
    doc.text(`RM ${item.price.toFixed(2)}`,        cPrice,    rY, { align: 'center' });
    doc.text(rm(item.total),                       cTotal,    rY, { align: 'center' });
    y += rowH;
  });
  y += 8;

  // ── Summary ──────────────────────────────────────────────────
  const sumLX = cPrice, sumVX = mR;
  doc.setFont('courier', 'normal'); doc.setFontSize(10); doc.setTextColor(...TEXT_MED);
  doc.text('Sub Total:', sumLX, y, { align: 'right' }); doc.text(rm(invoice.subtotal), sumVX, y, { align: 'right' }); y += 6;
  doc.text('Discount:',  sumLX, y, { align: 'right' }); doc.text(rm(invoice.discount), sumVX, y, { align: 'right' }); y += 10;

  // Total box
  const tbW = 100, tbX = mR - tbW, tbH = 12;
  doc.setFillColor(...LIGHT_GREY); doc.setDrawColor(...TEXT_DARK); doc.setLineWidth(0.5);
  doc.rect(tbX, y, tbW, tbH, 'FD');
  doc.setFont('helvetica', 'bold'); doc.setFontSize(13); doc.setTextColor(...TEXT_DARK);
  doc.text(`TOTAL: ${rm(invoice.total)}`, tbX + tbW - 4, y + 8, { align: 'right' });
  y += tbH + 14;

  // ── Payment info ─────────────────────────────────────────────
  doc.setFont('helvetica', 'bold'); doc.setFontSize(11); doc.setTextColor(...TEXT_DARK);
  doc.text('PAYMENT INFORMATION:', mL, y); y += 6;
  doc.setFontSize(9.5); doc.setTextColor(...TEXT_MED);
  if (business.bank) {
    doc.setFont('helvetica', 'bold'); doc.text('Bank: ', mL, y);
    doc.setFont('helvetica', 'normal'); doc.text(business.bank, mL + doc.getTextWidth('Bank: '), y); y += 5;
  }
  if (business.account_name) {
    doc.setFont('helvetica', 'bold'); doc.text('Name: ', mL, y);
    doc.setFont('helvetica', 'normal'); doc.text(business.account_name, mL + doc.getTextWidth('Name: '), y); y += 5;
  }
  if (business.account_number) {
    doc.setFont('helvetica', 'bold'); doc.text('Account: ', mL, y);
    doc.setFont('helvetica', 'normal'); doc.text(business.account_number, mL + doc.getTextWidth('Account: '), y); y += 5;
  }
  y += 8;

  // ── Terms ────────────────────────────────────────────────────
  doc.setFont('helvetica', 'bold'); doc.setFontSize(11); doc.setTextColor(...TEXT_DARK);
  doc.text('TERM AND CONDITIONS:', mL, y); y += 6;
  doc.setFont('helvetica', 'normal'); doc.setFontSize(9.5); doc.setTextColor(...TEXT_MED);
  for (const line of wrapText(doc, business.terms || '', pageW - mL * 2)) {
    doc.text(line, mL, y); y += 5;
  }

  // ── Dark footer ───────────────────────────────────────────────
  const fH = 25, fY = pageH - fH;
  doc.setFillColor(...DARK_GREY); doc.rect(0, fY, pageW, fH, 'F');
  doc.setFillColor(...GOLD);
  doc.triangle(pageW - 50, pageH, pageW, fY + 5, pageW, pageH, 'F');
  doc.triangle(pageW - 25, pageH, pageW - 60, pageH, pageW, fY + 20, 'F');

  doc.save(`${invoice.invoice_number}.pdf`);
}
