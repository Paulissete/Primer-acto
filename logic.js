/* Primer Acto | Cuotas y Asistencia — lógica pura (sin DOM), testeable en Node */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.PA = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var MESES = ['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre'];
  var DIAS = ['domingo','lunes','martes','miércoles','jueves','viernes','sábado'];

  /* ---------- fechas (ISO local YYYY-MM-DD) ---------- */
  function pad(n) { return (n < 10 ? '0' : '') + n; }
  function toISO(d) { return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }
  function parse(iso) { var p = iso.split('-'); return new Date(+p[0], +p[1] - 1, +p[2]); }
  function todayISO() { return toISO(new Date()); }
  function addDays(iso, n) { var d = parse(iso); d.setDate(d.getDate() + n); return toISO(d); }
  function weekday(iso) { return parse(iso).getDay(); }
  function fmtLong(iso) { var d = parse(iso); return DIAS[d.getDay()] + ' ' + d.getDate() + ' de ' + MESES[d.getMonth()]; }
  function fmtFull(iso) { var d = parse(iso); return d.getDate() + ' de ' + MESES[d.getMonth()] + ' de ' + d.getFullYear(); }
  function fmtShort(iso) { var d = parse(iso); return pad(d.getDate()) + ' ' + MESES[d.getMonth()].slice(0, 3) + ' ' + d.getFullYear(); }
  function monthLabel(ym) { var p = ym.split('-'); var m = MESES[+p[1] - 1]; return m.charAt(0).toUpperCase() + m.slice(1) + ' ' + p[0]; }
  function addMonths(ym, n) { var p = ym.split('-'); var d = new Date(+p[0], +p[1] - 1 + n, 1); return d.getFullYear() + '-' + pad(d.getMonth() + 1); }
  function mondayOf(iso) { var w = weekday(iso); return addDays(iso, -((w + 6) % 7)); }
  function nextSessionDate(from, wd) { var d = from; for (var i = 0; i < 7; i++) { if (weekday(d) === wd) return d; d = addDays(d, 1); } return from; }

  /* ---------- formato ---------- */
  function clp(n) {
    n = Math.round(+n || 0);
    var neg = n < 0; n = Math.abs(n);
    var s = String(n).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
    return (neg ? '-' : '') + '$' + s;
  }
  function uid() { return 'i' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }
  function initials(m) { return ((m.first || '').charAt(0) + (m.last || '').charAt(0)).toUpperCase() || '?'; }
  function fullName(m) { return (m.first + ' ' + (m.last || '')).trim(); }

  /* ---------- estado ---------- */
  function newState() {
    return {
      v: 1,
      settings: { fee: 500, place: 'Parroquia Niño Dios de Malloco', weekday: 5, time: '18:30', confirmSave: true, showInactive: false, rememberView: true },
      members: [],   // {id, first, last, active, startDate, inactiveSince}
      sessions: {},  // 'YYYY-MM-DD' -> {status:'done'|'suspended', fee, marks:{memberId:'paid'|'owes'|'absent'}}
      payments: []   // {id, memberId, date, amount, method, applyTo, note, createdAt}
    };
  }

  function addMember(S, first, last, startDate) {
    first = (first || '').trim(); last = (last || '').trim();
    if (!first) return { error: 'Escribe el nombre.' };
    var m = { id: uid(), first: first, last: last, active: true, startDate: startDate || todayISO(), inactiveSince: null };
    S.members.push(m);
    return { member: m };
  }
  function setActive(S, id, active, today) {
    var m = S.members.filter(function (x) { return x.id === id; })[0];
    if (!m) return;
    m.active = !!active;
    m.inactiveSince = active ? null : (today || todayISO());
  }

  function inRoster(S, m, date) {
    var ses = S.sessions[date];
    if (m.startDate && date < m.startDate) return false;           // no deudas anteriores a la incorporación
    if (ses && ses.marks && ses.marks[m.id]) return true;           // ya tiene registro en esa sesión
    if (m.active) return true;
    return !!(m.inactiveSince && date < m.inactiveSince);           // inactivo: sólo sesiones anteriores
  }
  function roster(S, date) {
    return S.members.filter(function (m) { return inRoster(S, m, date); })
      .sort(function (a, b) { return fullName(a).localeCompare(fullName(b), 'es'); });
  }

  function ensureSession(S, date) {
    if (!S.sessions[date]) S.sessions[date] = { status: 'done', fee: S.settings.fee, marks: {} };
    return S.sessions[date];
  }
  /* Marca idempotente: el estado se guarda por (sesión, persona); editar nunca suma cobros. */
  function setMark(S, date, id, mark) {
    var m = S.members.filter(function (x) { return x.id === id; })[0];
    if (!m || !inRoster(S, m, date)) return { error: 'La persona no pertenece a esa sesión.' };
    var ses = ensureSession(S, date);
    if (ses.status === 'suspended') return { error: 'La sesión está suspendida.' };
    if (ses.marks[id] === mark || !mark) delete ses.marks[id]; else ses.marks[id] = mark;
    return { ok: true };
  }
  function setStatus(S, date, status) {
    var ses = ensureSession(S, date);
    ses.status = status;           // las marcas se conservan, pero no cuentan mientras esté suspendida
  }

  /* ---------- libro de deudas y abonos (todo derivado => sin duplicados) ---------- */
  function ledger(S) {
    var out = {};
    var dates = Object.keys(S.sessions).sort();
    S.members.forEach(function (m) {
      var debts = [];
      dates.forEach(function (d) {
        var s = S.sessions[d];
        if (s.status === 'done' && s.marks[m.id] === 'owes') debts.push({ date: d, amount: s.fee, paid: 0, balance: s.fee });
      });
      var pays = S.payments.filter(function (p) { return p.memberId === m.id; }).sort(function (a, b) {
        return a.date < b.date ? -1 : a.date > b.date ? 1 : (a.createdAt || 0) - (b.createdAt || 0);
      });
      var credit = 0, allocs = {};
      pays.forEach(function (p) {
        var rem = p.amount, al = [];
        function apply(d) { var a = Math.min(rem, d.balance); if (a > 0) { d.paid += a; d.balance -= a; rem -= a; al.push({ date: d.date, amount: a }); } }
        if (p.applyTo && p.applyTo !== 'oldest') { var t = debts.filter(function (d) { return d.date === p.applyTo; })[0]; if (t) apply(t); }
        debts.forEach(function (d) { if (rem > 0) apply(d); });
        credit += rem; allocs[p.id] = al;
      });
      var bal = debts.reduce(function (a, d) { return a + d.balance; }, 0);
      out[m.id] = { debts: debts, balance: bal, credit: credit, allocs: allocs };
    });
    return out;
  }
  function totalPending(S, L) { L = L || ledger(S); return S.members.reduce(function (a, m) { return a + (L[m.id] ? L[m.id].balance : 0); }, 0); }

  /* Un pago puede ser mayor que la deuda: primero salda deudas (las más antiguas, o la semana elegida)
     y el resto queda como SALDO A FAVOR, que cubre automáticamente las próximas sesiones marcadas como "Debe / Usa saldo". */
  var MAX_PAGO = 1000000;
  function addPayment(S, p) {
    var L = ledger(S), l = L[p.memberId];
    var amount = Math.round(+p.amount);
    if (!l) return { error: 'Elige un integrante.' };
    if (!(amount > 0)) return { error: 'Ingresa un monto mayor a cero.' };
    if (amount > MAX_PAGO) return { error: 'El monto es demasiado alto. Revísalo.' };
    if (p.applyTo && p.applyTo !== 'oldest') {
      var d = l.debts.filter(function (x) { return x.date === p.applyTo; })[0];
      if (!d) return { error: 'Esa semana no existe como deuda.' };
    }
    var pay = { id: uid(), memberId: p.memberId, date: p.date || todayISO(), amount: amount, method: p.method || 'Efectivo', applyTo: p.applyTo || 'oldest', note: (p.note || '').trim(), createdAt: Date.now() };
    S.payments.push(pay);
    return { payment: pay };
  }
  /* Vista previa (no guarda nada): cómo quedaría la cuenta de la persona si se registra este pago. */
  function previewPayment(S, p) {
    var amount = Math.round(+p.amount) || 0;
    var before = ledger(S)[p.memberId];
    if (!before) return null;
    var fake = { settings: S.settings, members: S.members, sessions: S.sessions,
      payments: S.payments.concat([{ id: '_prev', memberId: p.memberId, date: p.date || todayISO(), amount: amount, applyTo: p.applyTo || 'oldest', createdAt: Date.now() + 1e9 }]) };
    var after = ledger(fake)[p.memberId];
    var settled = 0, weeksBefore = 0;
    before.debts.forEach(function (d, i) { if (d.balance > 0) { weeksBefore++; if (after.debts[i].balance === 0) settled++; } });
    return { amount: amount, before: { balance: before.balance, credit: before.credit }, after: { balance: after.balance, credit: after.credit }, settled: settled, weeksOpen: weeksBefore,
      toDebt: before.balance - after.balance, toCredit: after.credit - before.credit };
  }
  function totalCredit(S, L) { L = L || ledger(S); return S.members.reduce(function (a, m) { return a + (L[m.id] ? L[m.id].credit : 0); }, 0); }
  function removePayment(S, id) { S.payments = S.payments.filter(function (p) { return p.id !== id; }); }

  /* ---------- movimientos (base de reportes y exportación) ---------- */
  function movements(S) {
    var mv = [], byId = {};
    S.members.forEach(function (m) { byId[m.id] = m; });
    Object.keys(S.sessions).forEach(function (d) {
      var s = S.sessions[d];
      if (s.status === 'suspended') { mv.push({ date: d, type: 'suspendida', memberId: null, amount: 0 }); return; }
      Object.keys(s.marks).forEach(function (id) {
        if (!byId[id]) return;
        var k = s.marks[id];
        mv.push({ date: d, type: k === 'paid' ? 'pago_sesion' : k === 'owes' ? 'deuda' : 'ausente', memberId: id, amount: k === 'absent' ? 0 : s.fee, method: k === 'paid' ? 'Sesión' : '' });
      });
    });
    S.payments.forEach(function (p) { if (byId[p.memberId]) mv.push({ date: p.date, type: 'abono', memberId: p.memberId, amount: p.amount, method: p.method, note: p.note, applyTo: p.applyTo, id: p.id }); });
    return mv.sort(function (a, b) { return a.date < b.date ? 1 : a.date > b.date ? -1 : 0; });
  }
  function isCash(x) { return x.type === 'pago_sesion' || x.type === 'abono'; }
  function sum(arr) { return arr.reduce(function (a, x) { return a + x.amount; }, 0); }

  function sessionSummary(S, date, L) {
    var ses = S.sessions[date], r = roster(S, date);
    L = L || ledger(S);
    var res = { date: date, status: ses ? ses.status : 'pending', active: r.length, paid: 0, owes: 0, covered: 0, absent: 0, unmarked: 0, collected: 0, pendingSession: 0, abonos: 0 };
    if (ses && ses.status === 'suspended') return res;
    r.forEach(function (m) {
      var k = ses && ses.marks[m.id];
      if (k === 'paid') res.paid++;
      else if (k === 'owes') {
        var d = L[m.id] && L[m.id].debts.filter(function (x) { return x.date === date; })[0];
        if (d && d.balance === 0) res.covered++; else { res.owes++; res.pendingSession += d ? d.balance : 0; }
      }
      else if (k === 'absent') res.absent++; else res.unmarked++;
    });
    var fee = ses ? ses.fee : S.settings.fee;
    res.abonos = sum(S.payments.filter(function (p) { return p.date === date; }));
    res.collected = res.paid * fee + res.abonos;
    return res;
  }
  function collectedInMonth(S, ym) { return sum(movements(S).filter(function (x) { return isCash(x) && x.date.slice(0, 7) === ym; })); }
  function collectedOnDate(S, date) { return sum(movements(S).filter(function (x) { return isCash(x) && x.date === date; })); }

  /* ---------- CSV ---------- */
  function csvCell(v) { v = (v == null ? '' : String(v)); return /[";\n\r]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v; }
  function toCSV(rows) { return '\ufeff' + rows.map(function (r) { return r.map(csvCell).join(';'); }).join('\r\n'); }
  function parseCSV(text) {
    text = text.replace(/^\ufeff/, '');
    var first = text.split(/\r?\n/)[0] || '';
    var delim = (first.split(';').length > 1) ? ';' : (first.split('\t').length > 1 ? '\t' : ',');
    var rows = [], row = [], cell = '', q = false;
    for (var i = 0; i < text.length; i++) {
      var c = text[i];
      if (q) { if (c === '"') { if (text[i + 1] === '"') { cell += '"'; i++; } else q = false; } else cell += c; }
      else if (c === '"') q = true;
      else if (c === delim) { row.push(cell); cell = ''; }
      else if (c === '\n' || c === '\r') { if (c === '\r' && text[i + 1] === '\n') i++; row.push(cell); rows.push(row); row = []; cell = ''; }
      else cell += c;
    }
    if (cell !== '' || row.length) { row.push(cell); rows.push(row); }
    return rows.filter(function (r) { return r.some(function (x) { return x.trim() !== ''; }); });
  }
  /* Importa nómina: columnas "Nombre;Apellido" o una sola columna con nombre completo. No duplica personas. */
  function importMembers(S, text, today) {
    var rows = parseCSV(text), added = 0, skipped = 0;
    if (rows.length && /^(nombre|name|integrante|participante)/i.test(rows[0][0].trim())) rows.shift();
    var seen = {};
    S.members.forEach(function (m) { seen[fullName(m).toLowerCase()] = true; });
    rows.forEach(function (r) {
      var first = (r[0] || '').trim(), last = (r[1] || '').trim();
      if (!last && first.indexOf(' ') > 0) { var i = first.indexOf(' '); last = first.slice(i + 1).trim(); first = first.slice(0, i); }
      if (!first) return;
      var key = (first + ' ' + last).trim().toLowerCase();
      if (seen[key]) { skipped++; return; }
      var estado = (r[2] || '').trim().toLowerCase();
      var res = addMember(S, first, last, today);
      if (res.member && (estado === 'inactivo' || estado === 'inactiva')) setActive(S, res.member.id, false, today);
      seen[key] = true; added++;
    });
    return { added: added, skipped: skipped };
  }

  var TIPO = { pago_sesion: 'Pagó en sesión', deuda: 'Debe (deuda generada)', ausente: 'Ausente', suspendida: 'Sesión suspendida', abono: 'Pago / abono recibido' };
  function reportRows(S, filter) {
    filter = filter || {};
    var byId = {}; S.members.forEach(function (m) { byId[m.id] = m; });
    var rows = [['Fecha', 'Tipo', 'Participante', 'Monto CLP', 'Medio de pago', 'Se aplica a', 'Observaciones']];
    movements(S).slice().reverse().forEach(function (x) {
      if (filter.from && x.date < filter.from) return;
      if (filter.to && x.date > filter.to) return;
      if (filter.who && x.memberId !== filter.who) return;
      rows.push([x.date, TIPO[x.type], x.memberId ? fullName(byId[x.memberId]) : 'Todos', x.amount, x.method || '', x.applyTo ? (x.applyTo === 'oldest' ? 'Deudas más antiguas' : 'Semana ' + x.applyTo) : '', x.note || '']);
    });
    return rows;
  }

  /* ---------- carga / migración segura ---------- */
  function normalize(raw) {
    var base = newState();
    if (!raw || typeof raw !== 'object') return base;
    base.settings = Object.assign(base.settings, raw.settings || {});
    base.members = Array.isArray(raw.members) ? raw.members : [];
    base.sessions = raw.sessions && typeof raw.sessions === 'object' ? raw.sessions : {};
    base.payments = Array.isArray(raw.payments) ? raw.payments : [];
    return base;
  }

  return {
    MESES: MESES, DIAS: DIAS, pad: pad, toISO: toISO, parse: parse, todayISO: todayISO, addDays: addDays, weekday: weekday, fmtLong: fmtLong, fmtFull: fmtFull, fmtShort: fmtShort,
    monthLabel: monthLabel, addMonths: addMonths, mondayOf: mondayOf, nextSessionDate: nextSessionDate, clp: clp, uid: uid, initials: initials, fullName: fullName,
    newState: newState, addMember: addMember, setActive: setActive, inRoster: inRoster, roster: roster, ensureSession: ensureSession, setMark: setMark, setStatus: setStatus,
    ledger: ledger, totalPending: totalPending, totalCredit: totalCredit, previewPayment: previewPayment, addPayment: addPayment, removePayment: removePayment, movements: movements, isCash: isCash, sum: sum,
    sessionSummary: sessionSummary, collectedInMonth: collectedInMonth, collectedOnDate: collectedOnDate, toCSV: toCSV, parseCSV: parseCSV, importMembers: importMembers,
    reportRows: reportRows, normalize: normalize, TIPO: TIPO
  };
});
