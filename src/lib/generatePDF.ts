import type { Invoice, Business } from '@/types/invoice';
import { jsPDF } from 'jspdf';

const BROWN     = [92,  61,  46]  as const;
const WHITE     = [255, 255, 255] as const;
const LIGHT_GREY= [245, 245, 245] as const;
const TEXT_DARK = [30,  30,  30]  as const;
const TEXT_MED  = [80,  80,  80]  as const;

function wrapText(doc: jsPDF, text: string, maxWidth: number): string[] {
  if (!text) return [];
  const segments = text.split('\n');
  const allLines: string[] = [];
  
  for (const segment of segments) {
    if (segment.trim() === '') {
      allLines.push('');
      continue;
    }
    const words = segment.split(' ');
    let currentLine = '';
    for (const word of words) {
      const testLine = currentLine ? `${currentLine} ${word}` : word;
      if (doc.getTextWidth(testLine) > maxWidth && currentLine) {
        allLines.push(currentLine);
        currentLine = word;
      } else {
        currentLine = testLine;
      }
    }
    if (currentLine) allLines.push(currentLine);
  }
  return allLines;
}

function formatDate(dateStr: string): string {
  return new Date(dateStr)
    .toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' })
    .toUpperCase();
}

function rm(val: number): string {
  return `RM ${val.toFixed(2)}`;
}

export function generatePDF(invoice: Invoice, business: Business): void {
  const doc   = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' });
  const pageW = doc.internal.pageSize.getWidth();
  const mL = 18, mR = pageW - 18;

  let y = 24;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  const docTypeLabel = invoice.document_type.toUpperCase();
  const labelW = doc.getTextWidth(docTypeLabel) + 8;
  const labelH = 8;
  doc.setFillColor(...TEXT_DARK);
  doc.roundedRect(mL, y, labelW, labelH, 2, 2, 'F');
  doc.setTextColor(...WHITE);
  doc.text(docTypeLabel, mL + 4, y + 5.5);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(22);
  doc.setTextColor(...TEXT_DARK);
  doc.text(business.name.toUpperCase(), mR, y + 6, { align: 'right' });

  y += 12;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(...TEXT_DARK);
  doc.text(`INVOICE NUMBER: ${invoice.invoice_number}`, mL, y);
  y += 5;
  doc.text(`DATE: ${formatDate(invoice.invoice_date)}`, mL, y);

  doc.setFontSize(9);
  doc.setTextColor(...TEXT_MED);
  let bizY = 24 + 11;
  const locLines = wrapText(doc, business.location, 75);
  for (const line of locLines) { doc.text(line, mR, bizY, { align: 'right' }); bizY += 4.5; }
  doc.text(business.phone, mR, bizY, { align: 'right' });

  y = Math.max(y + 12, bizY + 12);

  doc.setFont('helvetica', 'bold'); doc.setFontSize(13); doc.setTextColor(...TEXT_DARK);
  doc.text('BILL TO', mL, y); y += 6;
  doc.setFont('helvetica', 'normal'); doc.setFontSize(10);
  const customerLines = wrapText(doc, invoice.customer_name, 80);
  for (const line of customerLines) { doc.text(line, mL, y); y += 5; }
  if (invoice.customer_phone) { doc.text(invoice.customer_phone, mL, y); y += 5; }
  if (invoice.customer_email) { doc.text(invoice.customer_email, mL, y); y += 5; }
  y += 8;

  doc.setFont('helvetica', 'bold'); doc.setFontSize(11); doc.setTextColor(...TEXT_DARK);
  doc.text('DESCRIPTION', mL, y); y += 6;
  if (invoice.description) {
    doc.setFont('helvetica', 'normal'); doc.setFontSize(10); doc.setTextColor(...TEXT_MED);
    const descLines = wrapText(doc, invoice.description, pageW - mL * 2);
    for (const line of descLines) { doc.text(line, mL, y); y += 5; }
  }
  y += 8;

  const cItem = mL, cProp = mL + 12, cNight = mL + 90, cPrice = mL + 120, cTotal = mR - 2;
  const tW = mR - mL, rowH = 10;

  doc.setFillColor(...BROWN);
  doc.rect(mL, y, tW, rowH, 'F');
  doc.setFont('helvetica', 'bold'); doc.setFontSize(8.5); doc.setTextColor(...WHITE);
  const hY = y + 6.5;
  doc.text('No.', cItem + 2, hY);
  doc.text('ITEM', cProp + 2, hY);
  doc.text('QTY', cNight, hY, { align: 'center' });
  doc.text('PRICE (RM)', cPrice, hY, { align: 'center' });
  doc.text('TOTAL', cTotal, hY, { align: 'right' });
  y += rowH;

  doc.setFont('helvetica', 'normal'); doc.setFontSize(10);
  invoice.items.forEach((item, idx) => {
    if (idx % 2 === 0) { doc.setFillColor(...LIGHT_GREY); doc.rect(mL, y, tW, rowH, 'F'); }
    else { doc.setFillColor(...WHITE); doc.rect(mL, y, tW, rowH, 'F'); }
    doc.setTextColor(...TEXT_DARK);
    const rY = y + 6.5;
    doc.text(`${idx + 1}.`, cItem + 2, rY);
    doc.text(item.item_name.toUpperCase(), cProp + 2, rY);
    doc.text(String(item.quantity), cNight, rY, { align: 'center' });
    doc.text(item.price.toFixed(2), cPrice, rY, { align: 'center' });
    doc.text(item.total.toFixed(2), cTotal, rY, { align: 'right' });
    y += rowH;
  });
  y += 6;

  const sumLX = cPrice + 5, sumVX = mR - 2;
  doc.setFont('helvetica', 'bold'); doc.setFontSize(10); doc.setTextColor(...TEXT_MED);
  doc.text('Sub Total', sumLX, y, { align: 'right' });
  doc.setFont('helvetica', 'normal');
  doc.text(rm(invoice.subtotal), sumVX, y, { align: 'right' }); y += 6;
  
  doc.setFont('helvetica', 'bold');
  doc.text('Discount', sumLX, y, { align: 'right' });
  doc.setFont('helvetica', 'normal');
  doc.text(rm(invoice.discount), sumVX, y, { align: 'right' }); y += 8;

  const tbW = 90, tbX = mR - tbW, tbH = 14;
  doc.setFillColor(...LIGHT_GREY);
  doc.setDrawColor(220, 220, 220);
  doc.roundedRect(tbX, y, tbW, tbH, 3, 3, 'FD');
  doc.setFont('helvetica', 'bold'); doc.setFontSize(12); doc.setTextColor(...TEXT_DARK);
  doc.text('TOTAL', tbX + 6, y + 9);
  doc.setFontSize(14);
  doc.text(rm(invoice.total), mR - 6, y + 9.5, { align: 'right' });
  y += tbH + 16;

  doc.setFont('helvetica', 'bold'); doc.setFontSize(11); doc.setTextColor(...TEXT_DARK);
  doc.text('PAYMENT INFORMATION', mL, y); y += 6;
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

  doc.setFont('helvetica', 'bold'); doc.setFontSize(11); doc.setTextColor(...TEXT_DARK);
  doc.text('TERM AND CONDITIONS', mL, y); y += 6;
  doc.setFont('helvetica', 'normal'); doc.setFontSize(9.5); doc.setTextColor(...TEXT_MED);
  const termsLines = wrapText(doc, business.terms || '', pageW - mL * 2);
  for (const line of termsLines) {
    doc.text(line, mL, y); y += 5;
  }

  doc.save(`${invoice.invoice_number}.pdf`);
}
