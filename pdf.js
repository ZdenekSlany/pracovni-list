/* Pracovní list Fleetware – vytvoření PDF ve vzhledu papírového listu (pdf-lib). */
(function () {
  'use strict';

  function build(d, opts) {
    var PDFLib = window.PDFLib, rgb = PDFLib.rgb;
    var C = opts.config;
    var W = 595.28, H = 841.89, M = 30, CW = W - 2 * M, BOTTOM = H - 36;

    function hex(s) {
      var n = parseInt(s.slice(1), 16);
      return rgb(((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255);
    }
    var DARK = hex('#3d4250'), BLUE = hex('#1666b0'), INK = hex('#15181f'), GRAY = hex('#5b6170'),
      BORDER = hex('#c3c9d6'), SHADE = hex('#eef1f7'), WHITE = hex('#ffffff'), RED = hex('#b3261e'),
      REDSOFT = hex('#fdecea'), HEADSUB = hex('#c9cedb');

    return PDFLib.PDFDocument.create().then(function (doc) {
      doc.registerFontkit(window.fontkit);
      return Promise.all([
        doc.embedFont(opts.fonts.regular, { subset: true }),
        doc.embedFont(opts.fonts.bold, { subset: true })
      ]).then(function (f) { return draw(doc, f[0], f[1]); });
    });

    function draw(doc, fR, fB) {
      var page = null, y = 0;
      doc.setTitle('Pracovní list ' + d.zakazka);
      doc.setSubject('Pracovní list Fleetware');
      doc.setCreator('Mobilní pracovní list Fleetware');
      doc.setProducer('Mobilní pracovní list Fleetware');

      // ---- základní kreslení (souřadnice shora) ----
      function clean(s) {
        s = String(s == null ? '' : s);
        var out = '';
        for (var i = 0; i < s.length; i++) {
          var c = s.charCodeAt(i);
          out += (c < 32 || c === 127 || c === 0x2028 || c === 0x2029) ? ' ' : s[i];
        }
        return out.replace(/ +/g, ' ').trim();
      }
      function tw(s, f, z) { return f.widthOfTextAtSize(s, z); }
      function txt(s, x, yb, o) {
        if (!s) return;
        page.drawText(s, { x: x, y: H - yb, size: o.size, font: o.font || fR, color: o.color || INK });
      }
      function box(x, yt, w, hh, o) {
        var p = { x: x, y: H - yt - hh, width: w, height: hh };
        if (o.fill) p.color = o.fill;
        if (o.stroke) { p.borderColor = o.stroke; p.borderWidth = o.lw || 0.6; }
        page.drawRectangle(p);
      }
      function line(x1, y1, x2, y2, color, lw) {
        page.drawLine({ start: { x: x1, y: H - y1 }, end: { x: x2, y: H - y2 }, thickness: lw || 0.6, color: color });
      }
      function fit(s, f, size, maxW, min) {
        s = clean(s); min = min || 6.5;
        var z = size;
        while (z > min && tw(s, f, z) > maxW) z -= 0.5;
        if (tw(s, f, z) > maxW) {
          while (s.length > 1 && tw(s + '…', f, z) > maxW) s = s.slice(0, -1);
          s += '…';
        }
        return { s: s, z: z };
      }
      function fitTxt(s, x, yb, maxW, o) {
        var r = fit(s, o.font || fR, o.size, maxW, o.min);
        txt(r.s, o.center ? x + (maxW - tw(r.s, o.font || fR, r.z)) / 2 : x, yb, { font: o.font, size: r.z, color: o.color });
      }
      function wrap(s, f, z, maxW) {
        var out = [];
        String(s || '').replace(/\r/g, '').split('\n').forEach(function (par) {
          par = clean(par);
          if (!par) { out.push(''); return; }
          var cur = '';
          par.split(/\s+/).forEach(function (word) {
            while (tw(word, f, z) > maxW) {
              var k = word.length;
              while (k > 1 && tw(word.slice(0, k), f, z) > maxW) k--;
              if (cur) { out.push(cur); cur = ''; }
              out.push(word.slice(0, k));
              word = word.slice(k);
            }
            if (!word) return;
            var t = cur ? cur + ' ' + word : word;
            if (tw(t, f, z) > maxW) { out.push(cur); cur = word; } else cur = t;
          });
          if (cur) out.push(cur);
        });
        while (out.length && !out[out.length - 1]) out.pop();
        return out;
      }
      function spaced(s, xRight, yb, o) {
        var w = 0, i;
        for (i = 0; i < s.length; i++) w += tw(s[i], o.font, o.size) + o.tracking;
        var x = xRight - (w - o.tracking);
        for (i = 0; i < s.length; i++) { txt(s[i], x, yb, o); x += tw(s[i], o.font, o.size) + o.tracking; }
      }
      function checkbox(x, yt, size, checked, color) {
        box(x, yt, size, size, { fill: checked ? color : WHITE, stroke: checked ? color : GRAY, lw: 0.7 });
        if (checked) {
          line(x + size * 0.2, yt + size * 0.52, x + size * 0.42, yt + size * 0.76, WHITE, 1.1);
          line(x + size * 0.42, yt + size * 0.76, x + size * 0.82, yt + size * 0.24, WHITE, 1.1);
        }
      }

      // ---- stránky ----
      function newPage(first) {
        page = doc.addPage([W, H]);
        if (first) {
          box(0, 0, W, 52, { fill: DARK });
          box(0, 52, W, 4, { fill: BLUE });
          txt('fleetware', M, 35, { font: fR, size: 25, color: WHITE });
          spaced('PRACOVNÍ LIST', W - M, 28, { font: fB, size: 17, color: WHITE, tracking: 3 });
          spaced('MONTÁŽ · SERVIS · PROGRAMOVÁNÍ ZAŘÍZENÍ', W - M, 42, { font: fR, size: 6.5, color: HEADSUB, tracking: 0.8 });
          y = 68;
        } else {
          box(0, 0, W, 24, { fill: DARK });
          box(0, 24, W, 3, { fill: BLUE });
          txt('fleetware', M, 16.5, { font: fR, size: 12, color: WHITE });
          var t = fit('PRACOVNÍ LIST · zakázka ' + d.zakazka + ' · pokračování', fB, 8, CW - 90);
          txt(t.s, W - M - tw(t.s, fB, t.z), 15.5, { font: fB, size: t.z, color: WHITE });
          y = 40;
        }
      }
      function need(hh) { if (y + hh > BOTTOM) newPage(false); }

      function title(text, x, sub) {
        box(x, y, 3, 9, { fill: BLUE });
        txt(text, x + 8, y + 8, { font: fB, size: 8.5, color: BLUE });
        if (sub) txt(sub, x + 8 + tw(text, fB, 8.5) + 6, y + 8, { size: 7, color: GRAY });
        y += 13;
      }
      function cell(x, yt, w, hh, label, value) {
        box(x, yt, w, hh, { stroke: BORDER });
        txt(label, x + 4, yt + 8.5, { size: 5.5, color: GRAY });
        fitTxt(value, x + 4, yt + hh - 6.5, w - 8, { size: 9.5 });
      }
      function cellRow(hh, defs) {
        var x = M;
        defs.forEach(function (c) { var w = CW * c[0]; cell(x, y, w, hh, c[1], c[2]); x += w; });
        y += hh;
      }
      // Rámeček s víceřádkovým textem, při nedostatku místa pokračuje na další straně.
      function textBox(text, minH) {
        var lines = wrap(text, fR, 8.5, CW - 10), LH = 11;
        do {
          var room = Math.floor((BOTTOM - y - 8) / LH);
          if (room < 2) { newPage(false); room = Math.floor((BOTTOM - y - 8) / LH); }
          var part = lines.splice(0, room);
          var hh = Math.max(minH, part.length * LH + 8);
          box(M, y, CW, hh, { stroke: BORDER });
          part.forEach(function (l, i) { txt(l, M + 5, y + 11 + i * LH, { size: 8.5 }); });
          y += hh;
        } while (lines.length);
      }

      // =================== obsah ===================
      newPage(true);

      // Zakázka a činnost
      box(M, y, 82, 22, { fill: BLUE });
      txt('Zakázka číslo', M + 10, y + 14.5, { font: fB, size: 9, color: WHITE });
      box(M + 82, y, 100, 22, { stroke: BLUE, lw: 0.9 });
      fitTxt(d.zakazka, M + 88, y + 14.8, 90, { font: fB, size: 10.5 });
      (function () {
        var size = 7.5, gap = 6, cb = 8, widths = C.activities.map(function (a) { return cb + 3 + tw(a, fR, size); });
        var total = widths.reduce(function (s, w) { return s + w; }, 0) + gap * (widths.length - 1);
        var x = W - M - total;
        var lab = 'Prováděná činnost:';
        if (x - tw(lab, fB, size) - 6 > M + 186) txt(lab, x - tw(lab, fB, size) - 6, y + 14, { font: fB, size: size });
        C.activities.forEach(function (a, i) {
          checkbox(x, y + 7, cb, d.cinnost === a, BLUE);
          txt(a, x + cb + 3, y + 14, { font: d.cinnost === a ? fB : fR, size: size });
          x += widths[i] + gap;
        });
      })();
      y += 32;

      title('ZAŘÍZENÍ', M);
      cellRow(26, [[0.18, 'TYP ZAŘÍZENÍ', d.typ], [0.32, 'VÝROBNÍ ČÍSLO', d.vyrobniCislo], [0.25, 'ČÍSLO SÍTĚ', d.cisloSite], [0.25, 'AR ZAŘÍZENÍ', d.ar]]);
      cellRow(26, [[0.5, 'TELEFONNÍ ČÍSLO', d.telefon], [0.5, 'APN', d.apn]]);
      y += 8;

      title('ZÁKAZNÍK', M);
      cellRow(26, [[0.5, 'NÁZEV FIRMY', d.firma], [0.5, 'MÍSTO ZÁSAHU', d.misto]]);
      y += 8;

      title('VOZIDLO / OBJEKT', M);
      cellRow(26, [[0.5, 'VOZIDLO (ZNAČKA, TYP)', d.vozidlo], [0.25, 'SPZ', d.spz], [0.25, 'STAV KM', d.km]]);
      y += 6;

      // Převzetí vozidla
      (function () {
        var lines = wrap(d.zavady, fR, 8.5, CW - 10), LH = 10.5;
        var hh = Math.max(26, 13 + lines.length * LH + 4);
        need(14 + hh);
        box(M, y, CW, 14, { fill: SHADE, stroke: BORDER });
        txt('Vozidlo (objekt) bylo převzato ve stavu, který odpovídal stáří a způsobu používání vozidla:', M + 4, y + 9.8, { size: 7.5 });
        y += 14;
        box(M, y, CW, hh, { stroke: BORDER });
        txt('PŘÍPADNÉ ZÁVADY', M + 4, y + 8.5, { size: 5.5, color: GRAY });
        lines.forEach(function (l, i) { txt(l, M + 4, y + 20 + i * LH, { size: 8.5 }); });
        y += hh + 8;
      })();

      // Použitý materiál
      (function () {
        var RH = 13, cols = [22, CW * 0.44, 34, 0];
        cols[3] = CW - cols[0] - cols[1] - cols[2];
        var rows = Math.max(3, d.material.length);
        need(13 + RH * 3);
        title('POUŽITÝ MATERIÁL', M);
        var x = M, heads = ['#', 'NÁZEV', 'KS', 'POZNÁMKA / UMÍSTĚNÍ'];
        heads.forEach(function (t, i) {
          box(x, y, cols[i], RH, { fill: SHADE, stroke: BORDER });
          if (i === 0 || i === 2) txt(t, x + (cols[i] - tw(t, fB, 6)) / 2, y + 8.8, { font: fB, size: 6, color: GRAY });
          else txt(t, x + 5, y + 8.8, { font: fB, size: 6, color: GRAY });
          x += cols[i];
        });
        y += RH;
        for (var r = 0; r < rows; r++) {
          need(RH);
          var m = d.material[r];
          x = M;
          for (var c = 0; c < 4; c++) { box(x, y, cols[c], RH, { stroke: BORDER }); x += cols[c]; }
          fitTxt(String(r + 1), M, y + 9.2, cols[0], { size: 7.5, color: GRAY, center: true });
          if (m) {
            fitTxt(m.nazev, M + cols[0] + 5, y + 9.4, cols[1] - 10, { size: 8.5 });
            fitTxt(String(m.mnozstvi), M + cols[0] + cols[1], y + 9.4, cols[2], { size: 8.5, center: true });
            fitTxt(m.poznamka, M + cols[0] + cols[1] + cols[2] + 5, y + 9.4, cols[3] - 10, { size: 8.5 });
          }
          y += RH;
        }
        y += 8;
      })();

      // Popis práce
      need(13 + 30);
      title('POPIS PRÁCE', M);
      textBox(d.popis, 28);
      y += 8;

      // Periferie + poznámky (vlevo), výstupní kontrola (vpravo)
      (function () {
        var GAP = 12, colW = (CW - GAP) / 2, RH = 13;
        var noteLines = wrap(d.poznamky, fR, 8.5, colW - 10), LH = 11;
        var leftList = d.periferie.slice(0, 9), rightList = d.periferie.slice(9);
        var perRows = Math.max(leftList.length, rightList.length);
        var leftH = 13 + perRows * RH + 8 + 13 + Math.max(30, noteLines.length * LH + 8);
        var rightH = 13 + RH + d.kontrola.length * RH;
        var notesBelow = y + leftH > BOTTOM - 90 && leftH > rightH; // dlouhé poznámky jdou na celou šířku pod oba sloupce
        if (notesBelow) leftH = 13 + perRows * RH;
        need(Math.max(leftH, rightH));
        var y0 = y, xr = M + colW + GAP;

        title('NAPROGRAMOVÁNÍ A ZAPOJENÍ PERIFERIÍ', M);
        var subW = (colW - 6) / 2, labW = 40;
        [leftList, rightList].forEach(function (list, ci) {
          var x = M + ci * (subW + 6);
          for (var r = 0; r < perRows; r++) {
            var p = list[r];
            if (!p) continue;
            var yy = y + r * RH;
            box(x, yy, labW, RH, { fill: SHADE, stroke: BORDER });
            box(x + labW, yy, subW - labW, RH, { stroke: BORDER });
            txt(p.vstup + ' =', x + 4, yy + 9.2, { font: fB, size: 7 });
            fitTxt(p.hodnota, x + labW + 4, yy + 9.3, subW - labW - 8, { size: 8 });
          }
        });
        var leftBottom = y + perRows * RH;

        y = y0;
        title('VÝSTUPNÍ KONTROLA', xr);
        var cw2 = 30, cw1 = colW - 2 * cw2;
        box(xr, y, cw1, RH, { fill: SHADE, stroke: BORDER });
        box(xr + cw1, y, cw2, RH, { fill: SHADE, stroke: BORDER });
        box(xr + cw1 + cw2, y, cw2, RH, { fill: SHADE, stroke: BORDER });
        txt('KONTROLNÍ BOD', xr + 5, y + 8.8, { font: fB, size: 6, color: GRAY });
        txt('ANO', xr + cw1 + (cw2 - tw('ANO', fB, 6)) / 2, y + 8.8, { font: fB, size: 6, color: GRAY });
        txt('NE', xr + cw1 + cw2 + (cw2 - tw('NE', fB, 6)) / 2, y + 8.8, { font: fB, size: 6, color: GRAY });
        y += RH;
        d.kontrola.forEach(function (k) {
          var no = k.vysledek === 'NE';
          box(xr, y, cw1, RH, { fill: no ? REDSOFT : undefined, stroke: BORDER });
          box(xr + cw1, y, cw2, RH, { fill: no ? REDSOFT : undefined, stroke: BORDER });
          box(xr + cw1 + cw2, y, cw2, RH, { fill: no ? REDSOFT : undefined, stroke: BORDER });
          fitTxt(k.bod, xr + 5, y + 9.3, cw1 - 10, { size: 8, font: no ? fB : fR });
          checkbox(xr + cw1 + (cw2 - 7.5) / 2, y + 2.8, 7.5, k.vysledek === 'ANO', BLUE);
          checkbox(xr + cw1 + cw2 + (cw2 - 7.5) / 2, y + 2.8, 7.5, no, RED);
          y += RH;
        });
        var rightBottom = y;

        if (notesBelow) {
          y = Math.max(leftBottom, rightBottom) + 8;
          need(13 + 30);
          title('POZNÁMKY K ZÁSAHU', M, '(odlišnosti, problémy)');
          textBox(d.poznamky, 28);
        } else {
          y = leftBottom + 8;
          title('POZNÁMKY K ZÁSAHU', M, '(odlišnosti, problémy)');
          var hh = Math.max(30, noteLines.length * LH + 8, rightBottom - y);
          box(M, y, colW, hh, { stroke: BORDER });
          noteLines.forEach(function (l, i) { txt(l, M + 5, y + 11 + i * LH, { size: 8.5 }); });
          y = Math.max(y + hh, rightBottom);
        }
        y += 12;
      })();

      // Práci vykonal / Za zákazníka převzal
      (function () {
        var GAP = 12, colW = (CW - GAP) / 2, xr = M + colW + GAP, labW = 118, RH = 15;
        need(15 + 22 + 3 * RH);
        box(M, y, colW, 15, { fill: DARK });
        txt('Práci vykonal', M + 6, y + 10.3, { font: fB, size: 8, color: WHITE });
        box(xr, y, colW, 15, { fill: DARK });
        txt('Za zákazníka převzal', xr + 6, y + 10.3, { font: fB, size: 8, color: WHITE });
        y += 15;
        box(M, y, colW, 22, { stroke: BORDER });
        fitTxt(d.technik + (d.technikFirma ? ', ' + d.technikFirma : ''), M + 6, y + 14.5, colW - 12, { font: fB, size: 10 });
        box(xr, y, colW, 22, { stroke: BORDER });
        fitTxt(d.prevzal, xr + 6, y + 14.5, colW - 12, { font: fB, size: 10 });
        y += 22;
        [['DATUM', opts.fmtDate(d.datum)], ['ČAS OD – DO', d.casOd + ' – ' + d.casDo], ['DOPRAVNÍ NÁKLADY (KM)', d.dopravaKm]].forEach(function (r) {
          box(M, y, labW, RH, { fill: SHADE, stroke: BORDER });
          box(M + labW, y, colW - labW, RH, { stroke: BORDER });
          txt(r[0], M + 6, y + 10, { font: fB, size: 6.5, color: GRAY });
          fitTxt(r[1], M + labW + 6, y + 10.4, colW - labW - 12, { size: 9 });
          y += RH;
        });
      })();

      // Patička na všech stranách
      var pages = doc.getPages();
      var foot = 'ID listu: ' + d.id + '  ·  Odesláno: ' + opts.fmtDateTime(d.odeslano) + '  ·  Vytvořeno elektronicky';
      pages.forEach(function (p, i) {
        page = p;
        line(M, H - 27, W - M, H - 27, BORDER, 0.6);
        txt(foot, M, H - 17, { size: 6.5, color: GRAY });
        var pn = 'Strana ' + (i + 1) + '/' + pages.length;
        txt(pn, W - M - tw(pn, fR, 6.5), H - 17, { size: 6.5, color: GRAY });
      });

      return doc.save();
    }
  }

  window.PLPdf = { build: build };
})();
