/* Primer Acto | Cuotas y Asistencia — lógica pura (sin DOM) */
(function (root) {
  'use strict';

  function newState() {
    return {
      v: 1,
      settings: { fee: 500, place: '', time: '18:30', weekday: 5, confirm: true, showInactive: false },
      members: [],
      sessions: {},   // { 'YYYY-MM-DD': { status:'realizada'|'suspendida', fee:500, marks:{ memberId:'pago'|'debe'|'ausente' } } }
      payments: []    // { id, memberId, date, amount, method, note, allocs:[{date, amount}] }
    };
  }

  var uid = function () { return Date.now().toString(36) + Math.random().toString(36).slice(2, 8); };

  function pad(n) { return (n < 10 ? '0' : '') + n; }
  function ymd(d) { return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }
  function parseYmd(s) { var p = s.split('-'); return new Date(+p[0], +p[1] - 1, +p[2]); }

  function nextSessionDate(state, today) {
    var d = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    var wd = state.settings.weekday;
    while (d.getDay() !== wd) d.setDate(d.getDate() + 1);
    return ymd(d);
  }

  function ensureSession(state, date) {
    if (!state.sessions[date]) state.sessions[date] = { status: 'realizada', fee: state.settings.fee, marks: {} };
    return state.sessions[date];
  }

  function memberById(state, id) { return state.members.filter(function (m) { return m.id === id; })[0]; }

  function addMember(state, first, last, joinDate) {
    first = (first || '').trim(); last = (last || '').trim();
    if (!first) return { ok: false, error: 'Falta el nombre.' };
    var m = { id: uid(), first: first, last: last, active: true, joinDate: joinDate };
    state.members.push(m);
    return { ok: true, member: m };
  }

  /* Integrantes que aparecen en una sesión: activos que ya se habían incorporado,
     más cualquiera (aunque esté inactivo) que ya tenga una marca guardada. */
  function roster(state, date) {
    var s = state.sessions[date];
    return state.members.filter(function (m) {
      if (s && s.marks[m.id]) return true;
      return m.active && m.joinDate <= date;
    }).sort(byName);
  }
  function byName(a, b) { return (a.first + ' ' + a.last).localeCompare(b.first + ' ' + b.last, 'es'); }

  function allocatedTo(state, memberId, date) {
    var t = 0;
    state.payments.forEach(function (p) {
      if (p.memberId !== memberId) return;
      p.allocs.forEach(function (a) { if (a.date === date) t += a.amount; });
    });
    return t;
  }

  /* Cuota que genera (member, sesión): 0 si suspendida, ausente o sin marcar. */
  function charge(session, memberId) {
    if (!session || session.status === 'suspendida') return 0;
    var mk = session.marks[memberId];
    return (mk === 'pago' || mk === 'debe') ? session.fee : 0;
  }

  /* Deudas de una persona: una por cada sesión realizada marcada "debe". */
  function debtsOf(state, memberId) {
    var out = [];
    Object.keys(state.sessions).sort().forEach(function (date) {
      var s = state.sessions[date];
      if (s.status === 'suspendida' || s.marks[memberId] !== 'debe') return;
      var paid = Math.min(allocatedTo(state, memberId, date), s.fee);
      out.push({ date: date, fee: s.fee, paid: paid, balance: s.fee - paid });
    });
    return out;
  }
  function balanceOf(state, memberId) {
    return debtsOf(state, memberId).reduce(function (t, d) { return t + d.balance; }, 0);
  }
  function totalDebt(state) {
    return state.members.reduce(function (t, m) { return t + balanceOf(state, m.id); }, 0);
  }

  function hasAllocs(state, memberId, date) { return allocatedTo(state, memberId, date) > 0; }

  function setMark(state, date, memberId, mark) {
    var s = ensureSession(state, date);
    if (s.status === 'suspendida') return { ok: false, error: 'La sesión está suspendida.' };
    var prev = s.marks[memberId];
    if (prev === 'debe' && mark !== 'debe' && hasAllocs(state, memberId, date))
      return { ok: false, error: 'Esa deuda ya tiene abonos registrados. Elimina primero el abono desde Pagos.' };
    if (mark === prev) delete s.marks[memberId]; // un segundo toque desmarca
    else s.marks[memberId] = mark;
    return { ok: true };
  }

  function setStatus(state, date, status) {
    var s = ensureSession(state, date);
    if (status === 'suspendida') {
      var blocked = Object.keys(s.marks).some(function (id) { return hasAllocs(state, id, date); });
      if (blocked) return { ok: false, error: 'Hay abonos asociados a esta sesión. Elimínalos antes de suspenderla.' };
    }
    s.status = status;
    return { ok: true };
  }

  /* Registrar pago/abono. target: 'oldest' (más antiguas primero) o una fecha concreta. */
  function addPayment(state, o) {
    var amount = Math.round(Number(o.amount));
    if (!o.memberId || !memberById(state, o.memberId)) return { ok: false, error: 'Elige un integrante.' };
    if (!(amount > 0)) return { ok: false, error: 'El monto debe ser mayor a $0.' };
    if (!o.date) return { ok: false, error: 'Falta la fecha del pago.' };
    var debts = debtsOf(state, o.memberId).filter(function (d) { return d.balance > 0; });
    if (o.target && o.target !== 'oldest') debts = debts.filter(function (d) { return d.date === o.target; });
    var total = debts.reduce(function (t, d) { return t + d.balance; }, 0);
    if (total === 0) return { ok: false, error: 'No hay deuda pendiente para aplicar este pago.' };
    if (amount > total) return { ok: false, error: 'El monto supera la deuda pendiente (' + total + ').' };
    var left = amount, allocs = [];
    for (var i = 0; i < debts.length && left > 0; i++) {
      var a = Math.min(left, debts[i].balance);
      allocs.push({ date: debts[i].date, amount: a });
      left -= a;
    }
    var p = { id: uid(), memberId: o.memberId, date: o.date, amount: amount,
      method: o.method || 'efectivo', note: o.note || '', allocs: allocs };
    state.payments.push(p);
    return { ok: true, payment: p };
  }

  function deletePayment(state, id) {
    state.payments = state.payments.filter(function (p) { return p.id !== id; });
  }

  /* Estadísticas de una sesión. Dinero recaudado y deuda se mantienen separados. */
  function sessionStats(state, date) {
    var s = state.sessions[date];
    var list = roster(state, date);
    var st = { activos: list.length, pagaron: 0, deben: 0, ausentes: 0, sinMarcar: 0, suspendida: false,
      cuotasCobradas: 0, abonos: 0, recaudado: 0, pendienteSesion: 0 };
    if (s && s.status === 'suspendida') st.suspendida = true;
    list.forEach(function (m) {
      var mk = s && s.marks[m.id];
      if (st.suspendida) return;
      if (mk === 'pago') st.pagaron++;
      else if (mk === 'debe') { st.deben++; st.pendienteSesion += Math.max(0, s.fee - allocatedTo(state, m.id, date)); }
      else if (mk === 'ausente') st.ausentes++;
      else st.sinMarcar++;
    });
    st.cuotasCobradas = st.suspendida ? 0 : st.pagaron * (s ? s.fee : state.settings.fee);
    state.payments.forEach(function (p) { if (p.date === date) st.abonos += p.amount; });
    st.recaudado = st.cuotasCobradas + st.abonos;
    return st;
  }

  function monthCollected(state, ym) {
    var t = 0;
    Object.keys(state.sessions).forEach(function (d) {
      var s = state.sessions[d];
      if (d.slice(0, 7) !== ym || s.status === 'suspendida') return;
      Object.keys(s.marks).forEach(function (id) { if (s.marks[id] === 'pago') t += s.fee; });
    });
    state.payments.forEach(function (p) { if (p.date.slice(0, 7) === ym) t += p.amount; });
    return t;
  }

  function weekStart(date) { // lunes de la semana
    var d = parseYmd(date), dow = (d.getDay() + 6) % 7;
    d.setDate(d.getDate() - dow); return ymd(d);
  }
  function collectedByWeek(state, ym) {
    var map = {};
    function add(date, v) { var w = weekStart(date); map[w] = (map[w] || 0) + v; }
    Object.keys(state.sessions).forEach(function (d) {
      var s = state.sessions[d];
      if (s.status === 'suspendida' || (ym && d.slice(0, 7) !== ym)) return;
      Object.keys(s.marks).forEach(function (id) { if (s.marks[id] === 'pago') add(d, s.fee); });
    });
    state.payments.forEach(function (p) { if (!ym || p.date.slice(0, 7) === ym) add(p.date, p.amount); });
    return Object.keys(map).sort().map(function (w) { return { week: w, total: map[w] }; });
  }

  function memberHistory(state, memberId) {
    var rows = [];
    Object.keys(state.sessions).sort().reverse().forEach(function (date) {
      var s = state.sessions[date];
      var mk = s.marks[memberId];
      if (s.status === 'suspendida') { rows.push({ date: date, kind: 'suspendida', amount: 0 }); return; }
      if (!mk) return;
      rows.push({ date: date, kind: mk, amount: mk === 'ausente' ? 0 : s.fee });
    });
    return rows;
  }
  function absences(state, memberId) {
    return Object.keys(state.sessions).filter(function (d) {
      var s = state.sessions[d]; return s.status !== 'suspendida' && s.marks[memberId] === 'ausente';
    }).length;
  }

  /* CSV (separador ; y BOM, compatible con Excel en configuración regional chilena) */
  function csvCell(v) { v = String(v == null ? '' : v); return /[";\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v; }
  function toCsv(rows) { return '\ufeff' + rows.map(function (r) { return r.map(csvCell).join(';'); }).join('\r\n'); }
  function parseCsv(text) {
    text = text.replace(/^\ufeff/, '');
    var first = text.split(/\r?\n/)[0] || '';
    var sep = (first.split(';').length >= first.split(',').length) ? ';' : ',';
    var rows = [], row = [], cur = '', q = false;
    for (var i = 0; i < text.length; i++) {
      var c = text[i];
      if (q) { if (c === '"') { if (text[i + 1] === '"') { cur += '"'; i++; } else q = false; } else cur += c; }
      else if (c === '"') q = true;
      else if (c === sep) { row.push(cur); cur = ''; }
      else if (c === '\n' || c === '\r') { if (c === '\r' && text[i + 1] === '\n') i++; row.push(cur); rows.push(row); row = []; cur = ''; }
      else cur += c;
    }
    if (cur !== '' || row.length) { row.push(cur); rows.push(row); }
    return rows.filter(function (r) { return r.some(function (x) { return x.trim() !== ''; }); });
  }

  function exportMembersCsv(state) {
    var rows = [['Nombre', 'Apellido', 'Activo', 'Fecha de incorporación']];
    state.members.slice().sort(byName).forEach(function (m) { rows.push([m.first, m.last, m.active ? 'Sí' : 'No', m.joinDate]); });
    return toCsv(rows);
  }
  function importMembersCsv(state, text, today) {
    var rows = parseCsv(text), added = 0, skipped = 0;
    if (rows.length && /nombre/i.test(rows[0][0])) rows.shift();
    rows.forEach(function (r) {
      var first = (r[0] || '').trim(), last = (r[1] || '').trim();
      if (!first) return;
      var dup = state.members.some(function (m) { return m.first.toLowerCase() === first.toLowerCase() && m.last.toLowerCase() === last.toLowerCase(); });
      if (dup) { skipped++; return; }
      var active = !/^(no|0|inactivo|false)$/i.test((r[2] || '').trim());
      var join = /^\d{4}-\d{2}-\d{2}$/.test((r[3] || '').trim()) ? r[3].trim() : today;
      var res = addMember(state, first, last, join); res.member.active = active; added++;
    });
    return { added: added, skipped: skipped };
  }

  var METHODS = { efectivo: 'Efectivo', transferencia: 'Transferencia', otro: 'Otro' };
  function exportReportCsv(state) {
    var rows = [['Tipo', 'Fecha', 'Integrante', 'Estado / Medio', 'Monto', 'Detalle']];
    var name = function (id) { var m = memberById(state, id); return m ? (m.first + ' ' + m.last).trim() : '(eliminado)'; };
    Object.keys(state.sessions).sort().forEach(function (d) {
      var s = state.sessions[d];
      if (s.status === 'suspendida') { rows.push(['Sesión', d, 'Todos', 'Suspendida', 0, '']); return; }
      Object.keys(s.marks).forEach(function (id) {
        var mk = s.marks[id];
        rows.push(['Sesión', d, name(id), { pago: 'Pagó', debe: 'Debe', ausente: 'Ausente' }[mk], mk === 'ausente' ? 0 : s.fee,
          mk === 'debe' ? 'Saldo pendiente: ' + Math.max(0, s.fee - allocatedTo(state, id, d)) : '']);
      });
    });
    state.payments.slice().sort(function (a, b) { return a.date < b.date ? -1 : 1; }).forEach(function (p) {
      rows.push(['Abono', p.date, name(p.memberId), METHODS[p.method] || p.method, p.amount,
        (p.allocs.map(function (a) { return a.date + ': ' + a.amount; }).join(' | ')) + (p.note ? ' — ' + p.note : '')]);
    });
    rows.push([]);
    rows.push(['Deuda pendiente total', '', '', '', totalDebt(state), '']);
    return toCsv(rows);
  }

  function clp(n) { return '$' + Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.'); }

  var api = { newState: newState, uid: uid, ymd: ymd, parseYmd: parseYmd, nextSessionDate: nextSessionDate, ensureSession: ensureSession,
    memberById: memberById, addMember: addMember, roster: roster, byName: byName, allocatedTo: allocatedTo, charge: charge,
    debtsOf: debtsOf, balanceOf: balanceOf, totalDebt: totalDebt, setMark: setMark, setStatus: setStatus, addPayment: addPayment,
    deletePayment: deletePayment, sessionStats: sessionStats, monthCollected: monthCollected, collectedByWeek: collectedByWeek,
    memberHistory: memberHistory, absences: absences, toCsv: toCsv, parseCsv: parseCsv, exportMembersCsv: exportMembersCsv,
    importMembersCsv: importMembersCsv, exportReportCsv: exportReportCsv, clp: clp, METHODS: METHODS };

  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.PA = api;
})(typeof window !== 'undefined' ? window : globalThis);
