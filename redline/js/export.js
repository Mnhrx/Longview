/* Redline export: a designed Excel workbook and a PDF service record.
   Works on a plain data snapshot (built by exportData() in app.js), so the same code
   runs in the app and anywhere else. The libraries (ExcelJS, jsPDF) load only when you export. */
const REXPORT = (() => {
  const INK = '161219', PANEL = '2A2330', CREAM = 'F6EBDD', ORANGE = 'FF6A2B', MUTED = '8A7F90';
  const ST = { over: ['Overdue', 'FF3B3B', 'FFFFFF'], soon: ['Due soon', 'FFB020', '1A0E07'], ok: ['Good', '45E0A2', '0B2A1D'], unset: ['Not set', 'D9D2DE', '4A4150'] };
  const sgd = v => v == null || isNaN(v) ? '' : Math.round(v * 100) / 100;
  const d8 = s => s ? new Date(s + (String(s).length === 10 ? 'T12:00' : '')) : null;
  const fmt = (v, dp = 0) => v == null || isNaN(v) ? '—' : Number(v).toLocaleString('en-SG', { minimumFractionDigits: dp, maximumFractionDigits: dp });
  const fdate = s => s ? new Date(s + (String(s).length === 10 ? 'T12:00' : '')).toLocaleDateString('en-SG', { day: 'numeric', month: 'short', year: 'numeric' }) : '—';

  /* ---------------- Excel ---------------- */
  async function xlsx(ExcelJS, D) {
    const wb = new ExcelJS.Workbook(); wb.creator = 'Redline'; wb.created = new Date();
    const font = (o = {}) => ({ name: 'Calibri', size: 11, color: { argb: 'FF' + (o.c || '222222') }, bold: !!o.b, ...o.x });
    const fill = c => ({ type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF' + c } });
    const thin = { style: 'thin', color: { argb: 'FFE6E0EA' } };

    // a sheet with the Redline banner, a header row and the data; money and dates formatted, totals as live formulas
    function table(name, cols, rows, o = {}) {
      const ws = wb.addWorksheet(name, { views: [{ state: 'frozen', ySplit: 4, showGridLines: false }], properties: { tabColor: { argb: 'FF' + (o.tab || ORANGE) } } });
      ws.columns = cols.map(c => ({ key: c.k, width: c.w || 14 }));
      const last = String.fromCharCode(64 + cols.length);
      ws.mergeCells(`A1:${last}1`); const t = ws.getCell('A1'); t.value = `${name.toUpperCase()}  ·  ${D.bike.name || 'My bike'}`;
      t.font = font({ c: 'FFFFFF', b: true, x: { size: 16 } }); t.fill = fill(INK); t.alignment = { vertical: 'middle', indent: 1 }; ws.getRow(1).height = 32;
      ws.mergeCells(`A2:${last}2`); const s = ws.getCell('A2'); s.value = o.sub || `${[D.bike.model, D.bike.plate].filter(Boolean).join(' · ')}  ·  exported ${fdate(D.today)}`;
      s.font = font({ c: 'CFC6D6', x: { size: 10 } }); s.fill = fill(INK); s.alignment = { indent: 1 }; ws.getRow(2).height = 18;
      ws.getRow(3).height = 8;
      const h = ws.getRow(4); cols.forEach((c, i) => { const cell = h.getCell(i + 1); cell.value = c.h; cell.font = font({ c: 'FFFFFF', b: true, x: { size: 10 } }); cell.fill = fill(PANEL); cell.alignment = { vertical: 'middle', horizontal: c.num ? 'right' : 'left', wrapText: true, indent: 1 }; });
      h.height = 24;
      rows.forEach((r, ri) => {
        const row = ws.addRow(cols.map(c => r[c.k])); row.height = Math.max(20, ...cols.filter(c => c.wrap).map(c => Math.ceil(String(r[c.k] || '').length / ((c.w || 14) * 1.05)) * 15 + 5));
        cols.forEach((c, i) => { const cell = row.getCell(i + 1); cell.font = font(); cell.border = { bottom: thin }; cell.alignment = { vertical: 'middle', horizontal: c.num ? 'right' : 'left', wrapText: !!c.wrap, indent: 1 };
          if (ri % 2) cell.fill = fill('FAF7FB');
          if (c.money) cell.numFmt = '"S$"#,##0.00'; else if (c.fmt) cell.numFmt = c.fmt; else if (c.date) cell.numFmt = 'd mmm yyyy';
          if (c.status && r._st) { const [, bg, fg] = ST[r._st]; cell.fill = fill(bg); cell.font = font({ c: fg, b: true }); cell.alignment = { horizontal: 'center', vertical: 'middle' }; }
          if (c.swatch && r._col) { cell.font = font({ b: true }); cell.border = { left: { style: 'thick', color: { argb: 'FF' + r._col } }, bottom: thin }; } });
      });
      if (o.total && rows.length) {
        const row = ws.addRow([]), first = 5, lastRow = 4 + rows.length; row.height = 24;
        cols.forEach((c, i) => { const cell = row.getCell(i + 1); cell.fill = fill(CREAM); cell.font = font({ b: true }); cell.border = { top: { style: 'medium', color: { argb: 'FF' + INK } } };
          const L = String.fromCharCode(65 + i);
          if (i === 0) cell.value = 'Total';
          if (o.total.includes(c.k)) { cell.value = { formula: `SUM(${L}${first}:${L}${lastRow})` }; cell.numFmt = c.money ? '"S$"#,##0.00' : c.fmt || '#,##0.0'; cell.alignment = { horizontal: 'right' }; } });
      }
      if (rows.length) ws.autoFilter = { from: { row: 4, column: 1 }, to: { row: 4 + rows.length, column: cols.length } };
      ws.pageSetup = { orientation: 'landscape', fitToPage: true, fitToWidth: 1, fitToHeight: 0, paperSize: 9, margins: { left: .4, right: .4, top: .5, bottom: .5, header: .2, footer: .2 } };
      ws.headerFooter.oddFooter = '&L&8Redline&R&8Page &P of &N';
      return ws;
    }

    /* Summary: the headline numbers and where the money goes */
    const ws = wb.addWorksheet('Summary', { views: [{ showGridLines: false }], properties: { tabColor: { argb: 'FF' + INK } } });
    ws.columns = [{ width: 3 }, { width: 30 }, { width: 18 }, { width: 14 }, { width: 3 }, { width: 30 }, { width: 18 }];
    ws.mergeCells('A1:G1'); const T = ws.getCell('A1'); T.value = 'REDLINE'; T.font = font({ c: ORANGE, b: true, x: { size: 11 } }); T.fill = fill(INK); T.alignment = { indent: 1, vertical: 'bottom' }; ws.getRow(1).height = 22;
    ws.mergeCells('A2:G2'); const N = ws.getCell('A2'); N.value = D.bike.name || 'My bike'; N.font = font({ c: 'FFFFFF', b: true, x: { size: 26 } }); N.fill = fill(INK); N.alignment = { indent: 1, vertical: 'middle' }; ws.getRow(2).height = 42;
    ws.mergeCells('A3:G3'); const M = ws.getCell('A3'); M.value = `${[D.bike.model, D.bike.plate].filter(Boolean).join('  ·  ')}${D.bike.model || D.bike.plate ? '  ·  ' : ''}Exported ${fdate(D.today)}`; M.font = font({ c: 'CFC6D6' }); M.fill = fill(INK); M.alignment = { indent: 1 }; ws.getRow(3).height = 22;
    const kpis = [['Odometer', D.odo != null ? `${fmt(D.odo)} km` : '—'], ['Spent this year', `S$${fmt(D.costs.year.total, 0)}`], ['Spent all time', `S$${fmt(D.costs.all.total, 0)}`], ['Cost per km (all-in)', D.costs.all.cpk ? `S$${fmt(D.costs.all.cpk, 2)}` : '—'], ['Rides logged', `${D.rides.length} · ${fmt(D.rideKm)} km`], ['Services logged', String(D.services.length)]];
    let r = 5; ws.getRow(4).height = 10;
    for (let i = 0; i < kpis.length; i += 2) {
      [[2, 3, kpis[i]], [6, 7, kpis[i + 1]]].forEach(([a, b, k]) => { if (!k) return;
        ws.mergeCells(r, a, r, b); const lab = ws.getCell(r, a); lab.value = k[0].toUpperCase(); lab.font = font({ c: MUTED, b: true, x: { size: 9 } }); lab.fill = fill('F4F0F6');
        ws.mergeCells(r + 1, a, r + 1, b); const val = ws.getCell(r + 1, a); val.value = k[1]; val.font = font({ c: INK, b: true, x: { size: 20 } }); val.fill = fill('F4F0F6'); });
      ws.getRow(r).height = 18; ws.getRow(r + 1).height = 32; ws.getRow(r + 2).height = 8; r += 3;
    }
    const sec = (row, text) => { ws.mergeCells(row, 2, row, 4); const c = ws.getCell(row, 2); c.value = text; c.font = font({ c: INK, b: true, x: { size: 14 } }); c.border = { bottom: { style: 'medium', color: { argb: 'FF' + ORANGE } } }; ws.getRow(row).height = 26; };
    sec(r, 'Where the money goes'); r++;
    [['Category', 'This year (S$)', '%']].concat(D.costs.cats.map(c => [c.label, sgd(c.year), D.costs.year.total ? c.year / D.costs.year.total : 0])).forEach((row, i) => {
      row.forEach((v, j) => { const cell = ws.getCell(r, 2 + j); cell.value = v; cell.font = font({ b: i === 0, c: i === 0 ? 'FFFFFF' : '222222', x: { size: i ? 11 : 10 } }); if (i === 0) cell.fill = fill(PANEL); else cell.border = { bottom: thin };
        if (i && j === 1) cell.numFmt = '"S$"#,##0.00'; if (i && j === 2) cell.numFmt = '0%'; if (j) cell.alignment = { horizontal: 'right' };
        if (i && j === 0) cell.border = { left: { style: 'thick', color: { argb: 'FF' + D.costs.cats[i - 1].col } }, bottom: thin }; });
      ws.getRow(r).height = 20; r++; });
    const tot = ws.getCell(r, 2); tot.value = 'Total'; tot.font = font({ b: true }); const tv = ws.getCell(r, 3); tv.value = { formula: `SUM(C${r - D.costs.cats.length}:C${r - 1})` }; tv.numFmt = '"S$"#,##0.00'; tv.font = font({ b: true }); tv.alignment = { horizontal: 'right' };
    [2, 3, 4].forEach(j => { ws.getCell(r, j).fill = fill(CREAM); ws.getCell(r, j).border = { top: { style: 'medium', color: { argb: 'FF' + INK } } }; }); ws.getRow(r).height = 22;
    // maintenance at a glance, to the right
    let m = 5 + Math.ceil(kpis.length / 2) * 3; ws.mergeCells(m, 6, m, 7); const mh = ws.getCell(m, 6); mh.value = 'Maintenance'; mh.font = font({ c: INK, b: true, x: { size: 14 } }); mh.border = { bottom: { style: 'medium', color: { argb: 'FF' + ORANGE } } }; ws.getRow(m).height = 26; m++;
    ['over', 'soon', 'ok', 'unset'].forEach(k => { const n = D.items.filter(x => x._st === k).length; const a = ws.getCell(m, 6), b = ws.getCell(m, 7); a.value = ST[k][0]; b.value = n; a.font = font({ b: true, c: ST[k][2] }); a.fill = fill(ST[k][1]); b.font = font({ b: true, x: { size: 13 } }); b.alignment = { horizontal: 'right' }; b.border = { bottom: thin }; ws.getRow(m).height = 22; m++; });
    D.items.filter(x => x._st === 'over' || x._st === 'soon').slice(0, 6).forEach(x => { const a = ws.getCell(m, 6), b = ws.getCell(m, 7); a.value = x.name; b.value = x.left; a.font = font({ x: { size: 10 } }); b.font = font({ c: x._st === 'over' ? 'D92020' : 'B06E00', b: true, x: { size: 10 } }); b.alignment = { horizontal: 'right' }; m++; });
    ws.pageSetup = { orientation: 'portrait', fitToPage: true, fitToWidth: 1, paperSize: 9 };

    table('Maintenance', [{ k: 'name', h: 'Item', w: 26, wrap: 1 }, { k: 'everyKm', h: 'Every (km)', w: 12, num: 1, fmt: '#,##0' }, { k: 'everyMo', h: 'Every (months)', w: 12, num: 1 }, { k: 'lastOdo', h: 'Last done (km)', w: 14, num: 1, fmt: '#,##0' }, { k: 'lastDate', h: 'Last done', w: 14, date: 1 }, { k: 'nextOdo', h: 'Next due (km)', w: 14, num: 1, fmt: '#,##0' }, { k: 'nextDate', h: 'Next due', w: 14, date: 1 }, { k: 'left', h: 'Left', w: 16 }, { k: 'status', h: 'Status', w: 12, status: 1 }, { k: 'lastCost', h: 'Last cost', w: 12, num: 1, money: 1 }],
      D.items.map(x => ({ ...x, lastDate: d8(x.lastDate), nextDate: d8(x.nextDate), status: ST[x._st][0] })), { tab: 'FFB020', sub: 'Intervals are typical figures, so check your owner’s manual. “Left” goes negative once something is overdue.' });
    table('Service history', [{ k: 'date', h: 'Date', w: 14, date: 1 }, { k: 'odo', h: 'Odometer (km)', w: 14, num: 1, fmt: '#,##0' }, { k: 'work', h: 'Work done', w: 40, wrap: 1 }, { k: 'shop', h: 'Workshop', w: 20 }, { k: 'cost', h: 'Cost', w: 12, num: 1, money: 1 }, { k: 'notes', h: 'Parts & notes', w: 34, wrap: 1 }],
      D.services.map(x => ({ ...x, date: d8(x.date) })), { total: ['cost'], tab: 'FF3B3B' });
    table('Costs', [{ k: 'date', h: 'Date', w: 14, date: 1 }, { k: 'cat', h: 'Category', w: 20, swatch: 1 }, { k: 'label', h: 'What', w: 38, wrap: 1 }, { k: 'paid', h: 'Paid', w: 12, num: 1, fmt: '#,##0.00' }, { k: 'cur', h: 'Currency', w: 10 }, { k: 'sgd', h: 'In S$', w: 12, num: 1, money: 1 }],
      D.ledger.map(x => ({ ...x, date: d8(x.date), sgd: sgd(x.sgd) })), { total: ['sgd'], tab: '45E0A2', sub: 'Every fill-up, service and expense. Ringgit is converted at the rate on the day you paid.' });
    // by month × category, so it charts nicely
    const mws = table('By month', [{ k: 'month', h: 'Month', w: 14 }, ...D.costs.cats.map(c => ({ k: c.key, h: c.label, w: 14, num: 1, money: 1 })), { k: 'total', h: 'Total', w: 14, num: 1, money: 1 }],
      D.costs.months.map(mo => ({ month: mo.label, ...Object.fromEntries(D.costs.cats.map(c => [c.key, sgd(mo.by[c.key] || 0)])), total: sgd(mo.total) })), { total: [...D.costs.cats.map(c => c.key), 'total'], tab: '5AB8FF' });
    mws.getRow(4).eachCell((cell, i) => { const c = D.costs.cats[i - 2]; if (c) cell.border = { bottom: { style: 'thick', color: { argb: 'FF' + c.col } } }; });
    table('Fuel', [{ k: 'date', h: 'Date', w: 14, date: 1 }, { k: 'odo', h: 'Odometer (km)', w: 14, num: 1, fmt: '#,##0' }, { k: 'litres', h: 'Litres', w: 10, num: 1, fmt: '0.00' }, { k: 'paid', h: 'Paid', w: 11, num: 1, fmt: '#,##0.00' }, { k: 'cur', h: 'Currency', w: 10 }, { k: 'sgd', h: 'In S$', w: 12, num: 1, money: 1 }, { k: 'perL', h: 'S$ / litre', w: 11, num: 1, fmt: '0.00' }, { k: 'station', h: 'Station', w: 14 }, { k: 'full', h: 'Full tank', w: 10 }, { k: 'kpl', h: 'km/L', w: 9, num: 1, fmt: '0.0' }],
      D.fuel.map(x => ({ ...x, date: d8(x.date), sgd: sgd(x.sgd) })), { total: ['litres', 'sgd'], tab: 'FFB020' });
    table('Rides', [{ k: 'date', h: 'Date', w: 14, date: 1 }, { k: 'time', h: 'Start', w: 9 }, { k: 'title', h: 'Ride', w: 30, wrap: 1 }, { k: 'mins', h: 'Minutes', w: 10, num: 1 }, { k: 'km', h: 'km', w: 10, num: 1, fmt: '#,##0.0' }, { k: 'source', h: 'Route', w: 14 }, { k: 'mood', h: 'Mood', w: 12 }, { k: 'note', h: 'Notes', w: 34, wrap: 1 }],
      D.rides.map(x => ({ ...x, date: d8(x.date) })), { total: ['mins', 'km'], tab: '5AB8FF' });
    table('Renewals', [{ k: 'name', h: 'Renewal', w: 24 }, { k: 'date', h: 'Expires', w: 14, date: 1 }, { k: 'left', h: 'Left', w: 16 }, { k: 'status', h: 'Status', w: 12, status: 1 }, { k: 'cost', h: 'Last paid', w: 12, num: 1, money: 1 }],
      D.renewals.map(x => ({ ...x, date: d8(x.date), status: ST[x._st][0] })), { tab: 'FF8FB1' });
    return wb.xlsx.writeBuffer();
  }

  /* ---------------- PDF service record ---------------- */
  function pdf(jsPDF, D) {
    const doc = new jsPDF({ unit: 'mm', format: 'a4' }), W = 210, L = 14, R = W - 14;
    const rgb = h => [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
    const at = (o) => doc.autoTable(Object.assign({ rowPageBreak: 'avoid', margin: { left: L, right: 14, top: 22, bottom: 16 }, theme: 'plain', styles: { font: 'helvetica', fontSize: 8.6, cellPadding: { top: 2.2, bottom: 2.2, left: 2.4, right: 2.4 }, textColor: [34, 30, 38], lineColor: [233, 227, 237], lineWidth: { bottom: .2 } },
      headStyles: { fillColor: rgb(PANEL), textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 8 }, alternateRowStyles: { fillColor: [250, 247, 251] } }, o));
    // cover band
    doc.setFillColor(...rgb(INK)); doc.rect(0, 0, W, 58, 'F');
    doc.setFillColor(...rgb(ORANGE)); doc.rect(0, 58, W, 1.6, 'F');
    doc.setTextColor(...rgb(ORANGE)); doc.setFont('helvetica', 'bold'); doc.setFontSize(9); doc.text('REDLINE  ·  SERVICE RECORD', L, 16, { charSpace: .6 });
    doc.setTextColor(255, 255, 255); doc.setFontSize(28); doc.text(D.bike.name || 'My bike', L, 31);
    doc.setFont('helvetica', 'normal'); doc.setFontSize(11); doc.setTextColor(207, 198, 214); doc.text([D.bike.model, D.bike.plate, D.bike.build].filter(Boolean).join('   ·   '), L, 40);
    doc.setFontSize(8.5); doc.text(`Exported ${fdate(D.today)}`, L, 49);
    if (D.odo != null) { doc.setFont('helvetica', 'bold'); doc.setFontSize(9); doc.setTextColor(...rgb(ORANGE)); doc.text('ODOMETER', R, 16, { align: 'right', charSpace: .6 }); doc.setTextColor(255, 255, 255); doc.setFontSize(26); doc.text(`${fmt(D.odo)}`, R - 9, 31, { align: 'right' }); doc.setFontSize(10); doc.text('km', R, 31, { align: 'right' }); }
    // KPI tiles
    const tiles = [['Services logged', String(D.services.length)], ['Spent on servicing', `S$${fmt(D.costs.all.by.service || 0, 0)}`], ['All-in this year', `S$${fmt(D.costs.year.total, 0)}`], ['Cost per km', D.costs.all.cpk ? `S$${fmt(D.costs.all.cpk, 2)}` : '—']];
    const tw = (R - L - 9) / 4; tiles.forEach(([l, v], i) => { const x = L + i * (tw + 3); doc.setFillColor(244, 240, 246); doc.roundedRect(x, 66, tw, 22, 2.5, 2.5, 'F');
      doc.setFont('helvetica', 'bold'); doc.setFontSize(6.8); doc.setTextColor(...rgb(MUTED)); doc.text(l.toUpperCase(), x + 4, 72.5, { charSpace: .3 }); doc.setFontSize(15); doc.setTextColor(...rgb(INK)); doc.text(v, x + 4, 83); });
    let y = 98;
    const head = (t, sub, need = 40) => { if (y + need > 278) { doc.addPage(); y = 24; } doc.setFont('helvetica', 'bold'); doc.setFontSize(13); doc.setTextColor(...rgb(INK)); doc.text(t, L, y); doc.setDrawColor(...rgb(ORANGE)); doc.setLineWidth(.8); doc.line(L, y + 2, L + 14, y + 2);
      if (sub) { doc.setFont('helvetica', 'normal'); doc.setFontSize(7.8); doc.setTextColor(...rgb(MUTED)); doc.text(sub, R, y, { align: 'right' }); } y += 5; };
    // maintenance status with coloured pills
    head('Maintenance status', 'Intervals are typical; check your owner’s manual');
    at({ startY: y, head: [['Item', 'Every', 'Last done', 'Next due', 'Left', 'Status']],
      body: D.items.map(x => [x.name, [x.everyKm ? fmt(x.everyKm) + ' km' : '', x.everyMo ? x.everyMo + ' mo' : ''].filter(Boolean).join(' / ') || '—', [x.lastOdo != null ? fmt(x.lastOdo) + ' km' : '', x.lastDate ? fdate(x.lastDate) : ''].filter(Boolean).join('\n') || '—', [x.nextOdo != null ? fmt(x.nextOdo) + ' km' : '', x.nextDate ? fdate(x.nextDate) : ''].filter(Boolean).join('\n') || '—', x.left || '—', ST[x._st][0]]),
      columnStyles: { 0: { fontStyle: 'bold', cellWidth: 46 }, 5: { halign: 'center', cellWidth: 22 } },
      didDrawCell: c => { if (c.section === 'body' && c.column.index === 5) { const lab = String((c.row.raw || [])[5] || ''), st = Object.keys(ST).find(k => ST[k][0] === lab) || 'unset', [, bg, fg] = ST[st]; const pw = 18, ph = 5.4, px = c.cell.x + (c.cell.width - pw) / 2, py = c.cell.y + (c.cell.height - ph) / 2;
        doc.setFillColor(...rgb(bg)); doc.roundedRect(px, py, pw, ph, 2.7, 2.7, 'F'); doc.setTextColor(...rgb(fg)); doc.setFont('helvetica', 'bold'); doc.setFontSize(6.8); doc.text(ST[st][0].toUpperCase(), px + pw / 2, py + 3.8, { align: 'center' }); } },
      willDrawCell: c => { if (c.section === 'body' && c.column.index === 5) c.cell.text = ['']; } });
    y = doc.lastAutoTable.finalY + 12;
    head('Service history', `${D.services.length} services · S$${fmt(D.costs.all.by.service || 0, 2)}`);
    at({ startY: y, head: [['Date', 'Odometer', 'Work done', 'Workshop', 'Cost']],
      body: D.services.length ? D.services.map(x => [fdate(x.date), fmt(x.odo) + ' km', x.work + (x.notes ? `\n${x.notes}` : ''), x.shop || '—', x.cost ? 'S$' + fmt(x.cost, 2) : '—']) : [['—', '', 'No services logged yet', '', '']],
      columnStyles: { 0: { cellWidth: 25 }, 1: { cellWidth: 24, halign: 'right' }, 4: { halign: 'right', cellWidth: 22, fontStyle: 'bold' } }, headStyles: { fillColor: rgb(PANEL), textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 8 } });
    y = doc.lastAutoTable.finalY + 12;
    // costs by category with colour bars
    head('Running costs', `This year · S$${fmt(D.costs.year.total, 2)}`, 30 + D.costs.cats.length * 7);
    const cats = D.costs.cats.filter(c => c.year > 0 || c.all > 0), mx = Math.max(1, ...cats.map(c => c.year));
    at({ startY: y, head: [['Category', '', 'This year', 'All time']], body: cats.map(c => [c.label, '', 'S$' + fmt(c.year, 2), 'S$' + fmt(c.all, 2)]),
      foot: [['Total', '', 'S$' + fmt(D.costs.year.total, 2), 'S$' + fmt(D.costs.all.total, 2)]], footStyles: { fillColor: rgb(CREAM), textColor: rgb(INK), fontStyle: 'bold' },
      columnStyles: { 0: { cellWidth: 46, fontStyle: 'bold' }, 1: { cellWidth: 70 }, 2: { halign: 'right' }, 3: { halign: 'right' } },
      didDrawCell: c => { if (c.section === 'body') { const k = cats.find(x => x.label === (c.row.raw || [])[0]); if (!k) return; if (c.column.index === 0) { doc.setFillColor(...rgb(k.col)); doc.rect(c.cell.x, c.cell.y + 1.2, 1.2, c.cell.height - 2.4, 'F'); }
        if (c.column.index === 1 && k.year > 0) { doc.setFillColor(...rgb(k.col)); doc.roundedRect(c.cell.x + 2, c.cell.y + c.cell.height / 2 - 1.6, Math.max(1.5, (c.cell.width - 4) * k.year / mx), 3.2, 1.6, 1.6, 'F'); } } } });
    y = doc.lastAutoTable.finalY + 12;
    head('Renewals', '', 22 + D.renewals.length * 8);
    at({ startY: y, head: [['Renewal', 'Expires', 'Left', 'Last paid']], body: D.renewals.map(x => [x.name, x.date ? fdate(x.date) : '—', x.left || '—', x.cost ? 'S$' + fmt(x.cost, 2) : '—']), columnStyles: { 0: { fontStyle: 'bold' }, 3: { halign: 'right' } } });
    // footer on every page
    const n = doc.getNumberOfPages();
    for (let i = 1; i <= n; i++) { doc.setPage(i); doc.setFont('helvetica', 'normal'); doc.setFontSize(7.5); doc.setTextColor(...rgb(MUTED));
      doc.text(`${D.bike.name || 'My bike'}${D.bike.plate ? ' · ' + D.bike.plate : ''} · service record`, L, 290); doc.text(`Redline · page ${i} of ${n}`, R, 290, { align: 'right' });
      if (i > 1) { doc.setFillColor(...rgb(INK)); doc.rect(0, 0, W, 12, 'F'); doc.setTextColor(255, 255, 255); doc.setFont('helvetica', 'bold'); doc.setFontSize(8.5); doc.text(`${D.bike.name || 'My bike'}  ·  SERVICE RECORD`, L, 7.8); } }
    return doc;
  }
  return { xlsx, pdf, ST };
})();
if (typeof module !== 'undefined') module.exports = REXPORT;
