// GSTInvoice — Printable GST Invoice Modal (Indian format)
// Supports CGST + SGST breakdown (intra-state), amount in words, standard TAX INVOICE header

import React from 'react';

export interface GSTInvoiceItem {
  description: string;
  hsn?: string;
  qty: number;
  unit: string;
  rate: number;
  gstPct: number;
  amount: number;
}

export interface GSTInvoiceProps {
  storeName: string;
  storeGSTIN?: string;
  storeAddress?: string;
  storePhone?: string;
  invoiceNumber: string;
  invoiceDate: string;
  customerName: string;
  customerGSTIN?: string;
  customerAddress?: string;
  items: GSTInvoiceItem[];
  paymentMode?: string;
  notes?: string;
  onClose: () => void;
}

// Convert number to words (Indian numbering)
function numToWords(n: number): string {
  const a = [
    '', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine',
    'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen',
    'Seventeen', 'Eighteen', 'Nineteen',
  ];
  const b = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

  function inWords(num: number): string {
    if (num < 20) return a[num];
    if (num < 100) return b[Math.floor(num / 10)] + (num % 10 ? ' ' + a[num % 10] : '');
    if (num < 1000) return a[Math.floor(num / 100)] + ' Hundred' + (num % 100 ? ' ' + inWords(num % 100) : '');
    if (num < 100000) return inWords(Math.floor(num / 1000)) + ' Thousand' + (num % 1000 ? ' ' + inWords(num % 1000) : '');
    if (num < 10000000) return inWords(Math.floor(num / 100000)) + ' Lakh' + (num % 100000 ? ' ' + inWords(num % 100000) : '');
    return inWords(Math.floor(num / 10000000)) + ' Crore' + (num % 10000000 ? ' ' + inWords(num % 10000000) : '');
  }

  const rupees = Math.floor(n);
  const paise = Math.round((n - rupees) * 100);
  let words = 'Rupees ' + (rupees === 0 ? 'Zero' : inWords(rupees));
  if (paise > 0) words += ' and ' + inWords(paise) + ' Paise';
  return words + ' Only';
}

function buildInvoiceHTML(props: GSTInvoiceProps): string {
  const {
    storeName, storeGSTIN, storeAddress, storePhone,
    invoiceNumber, invoiceDate, customerName, customerGSTIN, customerAddress,
    items, paymentMode, notes,
  } = props;

  const subtotal = items.reduce((s, i) => s + i.amount, 0);
  // Group by GST percent for CGST/SGST breakdown
  const gstMap: Record<number, { taxable: number; cgst: number; sgst: number }> = {};
  for (const item of items) {
    const taxable = item.amount / (1 + item.gstPct / 100);
    const gstAmt = item.amount - taxable;
    if (!gstMap[item.gstPct]) gstMap[item.gstPct] = { taxable: 0, cgst: 0, sgst: 0 };
    gstMap[item.gstPct].taxable += taxable;
    gstMap[item.gstPct].cgst += gstAmt / 2;
    gstMap[item.gstPct].sgst += gstAmt / 2;
  }
  const totalTaxable = Object.values(gstMap).reduce((s, g) => s + g.taxable, 0);
  const totalCGST = Object.values(gstMap).reduce((s, g) => s + g.cgst, 0);
  const totalSGST = Object.values(gstMap).reduce((s, g) => s + g.sgst, 0);
  const grandTotal = subtotal;
  const amountInWords = numToWords(Math.round(grandTotal * 100) / 100);

  const gstRows = Object.entries(gstMap)
    .filter(([pct]) => Number(pct) > 0)
    .map(([pct, g]) => `
      <tr>
        <td>${pct}%</td>
        <td style="text-align:right">₹${g.taxable.toFixed(2)}</td>
        <td style="text-align:right">₹${g.cgst.toFixed(2)}</td>
        <td style="text-align:right">₹${g.sgst.toFixed(2)}</td>
        <td style="text-align:right">₹${(g.cgst + g.sgst).toFixed(2)}</td>
      </tr>
    `).join('');

  const itemRows = items.map((item, idx) => `
    <tr>
      <td style="text-align:center">${idx + 1}</td>
      <td>${item.description}</td>
      <td style="text-align:center">${item.hsn || '-'}</td>
      <td style="text-align:center">${item.qty}</td>
      <td style="text-align:center">${item.unit}</td>
      <td style="text-align:right">₹${item.rate.toFixed(2)}</td>
      <td style="text-align:center">${item.gstPct > 0 ? item.gstPct + '%' : '0%'}</td>
      <td style="text-align:right">₹${item.amount.toFixed(2)}</td>
    </tr>
  `).join('');

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<title>Tax Invoice — ${invoiceNumber}</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: Arial, sans-serif; font-size: 11px; color: #000; background: #fff; padding: 18px; }
  .invoice-box { max-width: 800px; margin: auto; border: 1.5px solid #000; }
  .header { text-align: center; padding: 10px; border-bottom: 1.5px solid #000; }
  .header h1 { font-size: 18px; font-weight: bold; letter-spacing: 2px; }
  .header h2 { font-size: 14px; font-weight: bold; margin-top: 3px; }
  .header p  { font-size: 11px; margin-top: 2px; }
  .two-col { display: grid; grid-template-columns: 1fr 1fr; border-bottom: 1px solid #000; }
  .two-col .box { padding: 8px 10px; }
  .two-col .box:first-child { border-right: 1px solid #000; }
  .inv-meta { display: grid; grid-template-columns: 1fr 1fr; border-bottom: 1px solid #000; font-size: 11px; }
  .inv-meta .cell { padding: 6px 10px; }
  .inv-meta .cell:first-child { border-right: 1px solid #000; }
  table { width: 100%; border-collapse: collapse; }
  th, td { border: 1px solid #000; padding: 5px 7px; font-size: 10.5px; }
  th { background: #f0f0f0; font-weight: bold; text-align: center; }
  .items-table { border: none; }
  .items-table th, .items-table td { border: 1px solid #000; }
  .total-section { border-top: 1.5px solid #000; }
  .amount-words { padding: 7px 10px; border-bottom: 1px solid #000; font-style: italic; font-size: 10.5px; }
  .tax-section { border-top: 1px solid #000; padding: 8px 10px; }
  .signatures { display: grid; grid-template-columns: 1fr 1fr; border-top: 1.5px solid #000; }
  .signatures .sig { padding: 12px 10px; min-height: 60px; }
  .signatures .sig:first-child { border-right: 1px solid #000; }
  .declaration { padding: 7px 10px; border-top: 1px solid #000; font-size: 9px; color: #333; }
  .label { font-weight: bold; font-size: 10px; color: #444; }
  @media print {
    body { padding: 0; }
    .no-print { display: none !important; }
    @page { margin: 10mm; }
  }
</style>
</head>
<body>
<div class="invoice-box">
  <!-- Header -->
  <div class="header">
    <h1>TAX INVOICE</h1>
    <h2>${storeName}</h2>
    ${storeAddress ? `<p>${storeAddress}</p>` : ''}
    ${storePhone ? `<p>Phone: ${storePhone}</p>` : ''}
    ${storeGSTIN ? `<p><b>GSTIN:</b> ${storeGSTIN}</p>` : ''}
  </div>

  <!-- Invoice meta + Buyer -->
  <div class="two-col">
    <div class="box">
      <div class="label">Bill To / Buyer</div>
      <p style="font-weight:bold;margin-top:3px;font-size:12px">${customerName}</p>
      ${customerAddress ? `<p style="margin-top:2px">${customerAddress}</p>` : ''}
      ${customerGSTIN ? `<p style="margin-top:2px"><b>GSTIN:</b> ${customerGSTIN}</p>` : ''}
    </div>
    <div class="box">
      <table style="width:100%;border:none">
        <tr><td style="border:none;padding:2px 0" class="label">Invoice No.</td><td style="border:none;padding:2px 0"><b>${invoiceNumber}</b></td></tr>
        <tr><td style="border:none;padding:2px 0" class="label">Date</td><td style="border:none;padding:2px 0">${invoiceDate}</td></tr>
        ${paymentMode ? `<tr><td style="border:none;padding:2px 0" class="label">Payment Mode</td><td style="border:none;padding:2px 0">${paymentMode}</td></tr>` : ''}
        <tr><td style="border:none;padding:2px 0" class="label">Place of Supply</td><td style="border:none;padding:2px 0">Intra-State</td></tr>
      </table>
    </div>
  </div>

  <!-- Items Table -->
  <table class="items-table">
    <thead>
      <tr>
        <th style="width:4%">#</th>
        <th style="width:30%">Description</th>
        <th style="width:9%">HSN/SAC</th>
        <th style="width:7%">Qty</th>
        <th style="width:6%">Unit</th>
        <th style="width:11%">Rate</th>
        <th style="width:7%">GST%</th>
        <th style="width:13%">Amount</th>
      </tr>
    </thead>
    <tbody>
      ${itemRows}
      <tr>
        <td colspan="7" style="text-align:right;font-weight:bold">Subtotal</td>
        <td style="text-align:right;font-weight:bold">₹${subtotal.toFixed(2)}</td>
      </tr>
    </tbody>
  </table>

  <!-- Amount in Words -->
  <div class="amount-words">
    <b>Amount in Words:</b> ${amountInWords}
  </div>

  <!-- GST Breakdown -->
  ${gstRows ? `
  <div class="tax-section">
    <b style="font-size:10.5px">Tax Summary (CGST + SGST — Intra-State)</b>
    <table style="margin-top:5px">
      <thead>
        <tr>
          <th>GST Rate</th>
          <th style="text-align:right">Taxable Amount</th>
          <th style="text-align:right">CGST</th>
          <th style="text-align:right">SGST</th>
          <th style="text-align:right">Total Tax</th>
        </tr>
      </thead>
      <tbody>
        ${gstRows}
        <tr style="font-weight:bold">
          <td>Total</td>
          <td style="text-align:right">₹${totalTaxable.toFixed(2)}</td>
          <td style="text-align:right">₹${totalCGST.toFixed(2)}</td>
          <td style="text-align:right">₹${totalSGST.toFixed(2)}</td>
          <td style="text-align:right">₹${(totalCGST + totalSGST).toFixed(2)}</td>
        </tr>
      </tbody>
    </table>
  </div>
  ` : ''}

  <!-- Grand Total -->
  <div style="padding:7px 10px;border-top:1px solid #000;display:flex;justify-content:flex-end;align-items:center;gap:20px;background:#f9f9f9">
    <span style="font-size:13px;font-weight:bold">GRAND TOTAL:</span>
    <span style="font-size:15px;font-weight:bold">₹${grandTotal.toFixed(2)}</span>
  </div>

  ${notes ? `<div style="padding:6px 10px;border-top:1px solid #000;font-size:10px"><b>Notes:</b> ${notes}</div>` : ''}

  <!-- Signatures -->
  <div class="signatures">
    <div class="sig">
      <p class="label">Customer's Signature</p>
      <p style="margin-top:30px;font-size:9px;color:#555">Received goods/services in good condition</p>
    </div>
    <div class="sig" style="text-align:right">
      <p class="label">Authorised Signatory</p>
      <p style="margin-top:3px;font-weight:bold;font-size:10px">${storeName}</p>
      <p style="margin-top:30px;font-size:9px;color:#555">For ${storeName}</p>
    </div>
  </div>

  <!-- Declaration -->
  <div class="declaration">
    We declare that this invoice shows the actual price of the goods/services described and that all particulars are true and correct.
    This is a computer-generated invoice and does not require a physical signature.
  </div>
</div>

<div class="no-print" style="text-align:center;margin-top:16px">
  <button onclick="window.print()" style="background:#16a34a;color:#fff;border:none;padding:10px 28px;font-size:14px;border-radius:6px;cursor:pointer;margin-right:8px">🖨 Print Invoice</button>
  <button onclick="window.close()" style="background:#6b7280;color:#fff;border:none;padding:10px 22px;font-size:14px;border-radius:6px;cursor:pointer">Close</button>
</div>
</body>
</html>`;
}

export function GSTInvoice(props: GSTInvoiceProps) {
  const openPrint = () => {
    const html = buildInvoiceHTML(props);
    const win = window.open('', '_blank');
    if (!win) { alert('Please allow pop-ups to print the invoice.'); return; }
    win.document.write(html);
    win.document.close();
  };

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
        <div className="flex items-center justify-between p-5 border-b">
          <div>
            <h2 className="text-lg font-bold text-gray-800">GST Invoice</h2>
            <p className="text-xs text-gray-500 mt-0.5">{props.invoiceNumber} · {props.invoiceDate}</p>
          </div>
          <button onClick={props.onClose} className="p-2 rounded-lg hover:bg-gray-100 text-gray-400">
            <span className="text-xl leading-none">&times;</span>
          </button>
        </div>
        <div className="p-5 space-y-3 text-sm">
          <div className="flex justify-between text-gray-600">
            <span>Store</span><span className="font-medium text-gray-800">{props.storeName}</span>
          </div>
          <div className="flex justify-between text-gray-600">
            <span>Customer</span><span className="font-medium text-gray-800">{props.customerName}</span>
          </div>
          <div className="flex justify-between text-gray-600">
            <span>Items</span><span className="font-medium text-gray-800">{props.items.length}</span>
          </div>
          <div className="flex justify-between text-gray-600">
            <span>Total</span>
            <span className="font-bold text-gray-900">₹{props.items.reduce((s, i) => s + i.amount, 0).toFixed(2)}</span>
          </div>
        </div>
        <div className="flex gap-3 p-5 border-t">
          <button onClick={props.onClose} className="flex-1 border rounded-xl py-2.5 text-sm text-gray-600 hover:bg-gray-50">Cancel</button>
          <button onClick={openPrint} className="flex-1 bg-green-600 text-white rounded-xl py-2.5 text-sm font-semibold hover:bg-green-700">
            Print Invoice
          </button>
        </div>
      </div>
    </div>
  );
}
