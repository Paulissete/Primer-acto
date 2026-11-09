/* Primer Acto | Cuotas y Asistencia — interfaz */
(function () {
  'use strict';
  var KEY = 'primerActo.v1', BAK = 'primerActo.bak';
  var $ = function (s) { return document.querySelector(s); };
  var clp = PA.clp;

  /* ================= almacenamiento ================= */
  function load() {
    try {
      var raw = localStorage.getItem(KEY);
      if (raw) return PA.normalize(JSON.parse(raw));
    } catch (e) {
      try { localStorage.setItem('primerActo.corrupt', localStorage.getItem(KEY) || ''); } catch (e2) {}
      try { var b = JSON.parse(localStorage.getItem(BAK) || 'null'); if (b && b.data) return PA.normalize(b.data); } catch (e3) {}
    }
    return PA.newState();
  }
  var S = load();
  var lastSaveOk = true;
  function save() {
    try {
      var today = PA.todayISO();
      var prev = localStorage.getItem(KEY);
      var bak = null; try { bak = JSON.parse(localStorage.getItem(BAK) || 'null'); } catch (e) {}
      if (prev && (!bak || bak.date !== today)) localStorage.setItem(BAK, JSON.stringify({ date: today, data: JSON.parse(prev) }));
      localStorage.setItem(KEY, JSON.stringify(S));
      lastSaveOk = true;
    } catch (e) { lastSaveOk = false; toast('⚠ No se pudo guardar. Exporta un respaldo.'); }
  }
  try { if (navigator.storage && navigator.storage.persist) navigator.storage.persist(); } catch (e) {}

  /* ================= estado de interfaz ================= */
  var today = PA.todayISO();
  var ui = {
    view: 'home', param: null, hist: [],
    date: PA.nextSessionDate(today, S.settings.weekday),
    q: '', sq: '', pq: '', filter: 'all', memTab: 'hist', susp: false, qp: null,
    rep: { mode: 'mes', ref: today, who: '' }
  };
  if (S.settings.rememberView) { try { var lv = localStorage.getItem('primerActo.view'); if (lv && ['home', 'members', 'session', 'reports'].indexOf(lv) >= 0) ui.view = lv; } catch (e) {} }

  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function mem(id) { return S.members.filter(function (m) { return m.id === id; })[0]; }
  var PAL = ['#F9D5C8', '#CFE3F0', '#FBE3A5', '#E3D3F0', '#CFE8D5', '#F6CFE0', '#D3E8E3'];
  function av(m) { var h = 0, n = m.id; for (var i = 0; i < n.length; i++) h = (h * 31 + n.charCodeAt(i)) >>> 0; return '<div class="avatar" style="background:' + PAL[h % PAL.length] + '">' + esc(PA.initials(m)) + '</div>'; }
  function toast(msg) { var t = $('#toast'); t.textContent = msg; t.hidden = false; clearTimeout(toast.t); toast.t = setTimeout(function () { t.hidden = true; }, 2300); }

  function go(view, param) { ui.hist.push({ view: ui.view, param: ui.param }); ui.view = view; ui.param = param || null; if (view === 'member') ui.memTab = 'hist'; if (view === 'pay') ui.pq = ''; render(); window.scrollTo(0, 0); }
  function back() { var h = ui.hist.pop(); if (h) { ui.view = h.view; ui.param = h.param; } else ui.view = 'home'; render(); }
  function tab(v) { ui.hist = []; ui.view = v; ui.param = null; ui.susp = false; ui.sq = ''; if (v === 'members') { ui.q = ''; } render(); window.scrollTo(0, 0); }

  /* ================= piezas visuales ================= */
  function top(title, o) {
    o = o || {};
    return '<div class="topbar">' + (o.back ? '<button class="iconbtn" data-act="back" aria-label="Volver">‹</button>' : '<div style="width:44px"></div>') +
      '<h1>' + esc(title) + (o.sub ? '<span class="sub">' + esc(o.sub) + '</span>' : '') + '</h1>' + (o.right || '<div style="width:44px"></div>') + '</div>';
  }
  function nav() {
    var items = [['home', '⌂', 'Inicio'], ['members', '☺', 'Integrantes'], ['session', '▦', 'Sesiones'], ['reports', '▥', 'Reportes']];
    var cur = { member: 'members', pay: 'home', debts: 'home', settings: 'home' }[ui.view] || ui.view;
    return '<div class="nav"><div class="in">' + items.map(function (i) { return '<button class="' + (cur === i[0] ? 'on' : '') + '" data-act="tab" data-v="' + i[0] + '"><span class="i">' + i[1] + '</span>' + i[2] + '</button>'; }).join('') + '</div></div>';
  }
  var MASKS = '<svg viewBox="0 0 64 48" aria-hidden="true"><ellipse cx="22" cy="24" rx="17" ry="20" fill="#7FBF93"/><ellipse cx="42" cy="26" rx="17" ry="20" fill="#F2A99A"/><circle cx="16" cy="20" r="2.4" fill="#25362c"/><circle cx="28" cy="20" r="2.4" fill="#25362c"/><path d="M14 31q8 8 16 0" stroke="#25362c" stroke-width="2.4" fill="none" stroke-linecap="round"/><circle cx="36" cy="22" r="2.4" fill="#25362c"/><circle cx="48" cy="22" r="2.4" fill="#25362c"/><path d="M36 36q6-6 12 0" stroke="#25362c" stroke-width="2.4" fill="none" stroke-linecap="round"/></svg>';
  function chipFor(k) { return k === 'paid' ? '<span class="chip g">✓ Pagó</span>' : k === 'owes' ? '<span class="chip a">! Debe</span>' : k === 'absent' ? '<span class="chip r">✕ Ausente</span>' : '<span class="chip n">Sin marcar</span>'; }

  /* ================= INICIO ================= */
  function debtRow(m, L) {
    var b = L[m.id].balance, n = L[m.id].debts.filter(function (x) { return x.balance > 0; }).length;
    return '<div class="item"><button class="row grow" style="text-align:left" data-act="member" data-id="' + m.id + '" data-tab="debts">' + av(m) + '<div class="grow"><div class="nm">' + esc(PA.fullName(m)) + '</div><div class="sb">' + n + ' semana' + (n === 1 ? '' : 's') + ' pendiente' + (n === 1 ? '' : 's') + '</div></div></button><button class="cobrar" data-act="quickPay" data-id="' + m.id + '">Cobrar ' + clp(b) + '</button></div>';
  }
  function vHome() {
    var d = ui.date, L = PA.ledger(S), sm = PA.sessionSummary(S, d, L);
    var pend = PA.totalPending(S, L), credit = PA.totalCredit(S, L);
    var debtors = S.members.filter(function (m) { return L[m.id] && L[m.id].balance > 0; }).sort(function (a, b) { return L[b.id].balance - L[a.id].balance; });
    var month = PA.collectedInMonth(S, d.slice(0, 7));
    var susp = sm.status === 'suspended';
    return '<div class="brand">' + MASKS + '<div class="logo">Primer Acto</div><small>Colectivo de Artes Escénicas &amp; Cultura</small></div>' +
      '<div style="text-align:right;margin-top:-34px;height:34px"><button class="iconbtn" style="display:inline-grid;font-size:20px" data-act="go" data-v="settings" aria-label="Configuración">⚙</button></div>' +
      '<button class="card row" style="width:100%;text-align:left" data-act="tab" data-v="session"><div class="tile" style="border:0;padding:0"><div class="ic a">▦</div></div><div class="grow"><div class="small">' + (d === today ? 'Sesión de hoy' : d > today ? 'Próxima sesión' : 'Sesión seleccionada') + '</div><b style="font-size:18px">' + PA.fmtLong(d).replace(/^./, function (c) { return c.toUpperCase(); }) + '</b><div class="small">' + esc(S.settings.time) + ' hrs · ' + esc(S.settings.place) + '</div>' +
      (susp ? '<span class="chip r" style="margin-top:6px">Sesión suspendida</span>' : '') + '</div><span class="chev">›</span></button>' +
      '<div class="bigrow"><button class="bigbtn" data-act="tab" data-v="session">▦ Controlar sesión</button><button class="bigbtn gold" data-act="go" data-v="pay">$ Registrar pago</button></div>' +
      '<div class="sec">Quién debe' + (debtors.length ? ' <span class="small">· toca “Cobrar” para registrar el pago</span>' : '') + '</div>' +
      (debtors.length ? '<div class="list">' + debtors.slice(0, 6).map(function (m) { return debtRow(m, L); }).join('') + '</div>' + (debtors.length > 6 ? '<button class="pill-btn" style="margin-top:10px" data-act="go" data-v="debts">Ver las ' + debtors.length + ' personas →</button>' : '') : '<div class="small center" style="padding:14px">Nadie debe nada 🎭</div>') +
      '<div class="grid2">' +
      tile('g', '☺', sm.active, 'Integrantes activos') + tile('g', '✓', sm.paid + sm.covered, 'Pagaron esta sesión') +
      tile('a', '!', sm.owes, 'Pendientes de pago') + tile('r', '✕', sm.absent, 'Ausentes esta sesión') + '</div>' +
      '<div class="card row"><div class="tile" style="border:0;padding:0"><div class="ic g">$</div></div><div class="grow"><div class="money">' + clp(sm.collected) + '</div><div class="small">Recaudado en la sesión' + (sm.abonos ? ' (incluye ' + clp(sm.abonos) + ' en pagos y abonos)' : '') + '</div></div></div>' +
      '<div class="grid2"><div class="card" style="margin:0"><div class="small">Deudas pendientes totales</div><b style="font-size:22px;color:' + (pend ? 'var(--amber-ink)' : 'var(--green-d)') + '">' + clp(pend) + '</b><div class="small">' + debtors.length + ' persona' + (debtors.length === 1 ? '' : 's') + ' · no es dinero recibido</div></div>' +
      '<div class="card" style="margin:0"><div class="small">Recaudado en ' + PA.MESES[+d.slice(5, 7) - 1] + '</div><b style="font-size:22px;color:var(--green-d)">' + clp(month) + '</b><div class="small">sólo pagos recibidos</div></div></div>' +
      (credit > 0 ? '<div class="small" style="margin:10px 2px 0">Pagos adelantados (saldo a favor): <b>' + clp(credit) + '</b> · ya recibido, cubre sesiones futuras.</div>' : '') +
      '<div class="sec">Accesos rápidos</div><div class="quick">' +
      qk('☺', 'Ver nómina', 'tab', 'members') + qk('▥', 'Ver historial', 'tab', 'reports') + qk('!', 'Revisar deudas', 'go', 'debts') + qk('⚙', 'Configuración', 'go', 'settings') + '</div>';
  }
  function tile(c, ic, n, label) { return '<div class="tile"><div class="ic ' + c + '">' + ic + '</div><div><b>' + n + '</b><span>' + label + '</span></div></div>'; }
  function qk(i, t, a, v) { return '<button data-act="' + a + '" data-v="' + v + '"><span class="qi">' + i + '</span>' + t + '</button>'; }

  /* ================= INTEGRANTES ================= */
  function memberList() {
    var L = PA.ledger(S), q = ui.q.trim().toLowerCase();
    var all = S.members.slice().sort(function (a, b) { return PA.fullName(a).localeCompare(PA.fullName(b), 'es'); });
    var list = all.filter(function (m) {
      if (ui.filter === 'act' && !m.active) return false;
      if (ui.filter === 'inact' && m.active) return false;
      return !q || PA.fullName(m).toLowerCase().indexOf(q) >= 0;
    });
    if (!list.length) return '<div class="center small">' + (S.members.length ? 'No hay integrantes que coincidan.' : 'Aún no hay integrantes. Toca “+” para agregar el primero o importa una nómina desde Configuración.') + '</div>';
    return '<div class="list">' + list.map(function (m) {
      var b = L[m.id] ? L[m.id].balance : 0;
      return '<button class="item" data-act="member" data-id="' + m.id + '">' + av(m) + '<div class="grow"><div class="nm">' + esc(PA.fullName(m)) + '</div><div class="sb">' + (m.active ? 'Activo' : 'Inactivo') + (b > 0 ? ' · <span style="color:var(--amber-ink);font-weight:700">Debe ' + clp(b) + '</span>' : '') + '</div></div><span class="chev">›</span></button>';
    }).join('') + '</div>';
  }
  function vMembers() {
    var n = S.members.length, a = S.members.filter(function (m) { return m.active; }).length;
    return top('Integrantes', { right: '<button class="iconbtn green" data-act="addMember" aria-label="Agregar">+</button>' }) +
      '<input type="search" id="q" data-in="search" placeholder="Buscar integrante…" value="' + esc(ui.q) + '" autocomplete="off">' +
      '<div class="chips">' + [['all', 'Todos (' + n + ')'], ['act', 'Activos (' + a + ')'], ['inact', 'Inactivos (' + (n - a) + ')']].map(function (c) { return '<button class="' + (ui.filter === c[0] ? 'on' : '') + '" data-act="filter" data-v="' + c[0] + '">' + c[1] + '</button>'; }).join('') + '</div>' +
      '<div id="mlist">' + memberList() + '</div>';
  }

  function vMember() {
    var m = mem(ui.param); if (!m) return top('Integrante', { back: 1 }) + '<div class="center small">No encontrado.</div>';
    var L = PA.ledger(S)[m.id], t = ui.memTab, body = '';
    if (t === 'hist') {
      var rows = Object.keys(S.sessions).sort().reverse().map(function (d) {
        var s = S.sessions[d];
        if (m.startDate && d < m.startDate) return '';
        if (s.status === 'suspended') return '<div class="tr"><div class="l">' + PA.fmtShort(d) + '</div><span class="chip n">Suspendida</span><span class="v">$0</span></div>';
        var k = s.marks[m.id]; if (!k && !PA.inRoster(S, m, d)) return '';
        var v = k === 'paid' ? clp(s.fee) : k === 'owes' ? (L.debts.filter(function (x) { return x.date === d; })[0].balance > 0 ? clp(L.debts.filter(function (x) { return x.date === d; })[0].balance) + ' pend.' : 'Saldada') : '$0';
        return '<div class="tr"><div class="l">' + PA.fmtShort(d) + '</div>' + chipFor(k) + '<span class="v">' + v + '</span></div>';
      }).join('');
      var abs = Object.keys(S.sessions).filter(function (d) { return S.sessions[d].status === 'done' && S.sessions[d].marks[m.id] === 'absent'; }).length;
      body = '<div class="sec">Últimas sesiones <span class="small">· ' + abs + ' ausencia' + (abs === 1 ? '' : 's') + '</span></div>' + (rows || '<div class="small center">Sin sesiones registradas todavía.</div>');
    } else if (t === 'debts') {
      var open = L.debts.filter(function (x) { return x.balance > 0; });
      var pays = S.payments.filter(function (p) { return p.memberId === m.id; }).sort(function (a, b) { return a.date < b.date ? 1 : -1; });
      body = '<div class="sec">Deuda pendiente: ' + clp(L.balance) + '</div>' +
        (open.map(function (x) { return '<div class="tr"><div class="l">Semana ' + PA.fmtShort(x.date) + '<small>' + (x.paid ? 'Abonado ' + clp(x.paid) + ' de ' + clp(x.amount) : 'Deuda ' + clp(x.amount)) + '</small></div><span class="chip a">' + clp(x.balance) + '</span></div>'; }).join('') || '<div class="small center">Sin deudas pendientes 🎭</div>') +
        (L.credit > 0 ? '<div class="notice info">Saldo a favor: <b>' + clp(L.credit) + '</b>. Es dinero ya recibido: cubre las próximas sesiones que marques con “Usa saldo”.</div>' : '') +
        '<div class="sec">Pagos y abonos recibidos</div>' +
        (pays.map(function (p) {
          var al = (L.allocs[p.id] || []).map(function (a) { return PA.fmtShort(a.date).slice(0, 6) + ' ' + clp(a.amount); }).join(', ');
          return '<div class="tr"><div class="l">' + PA.fmtShort(p.date) + ' · ' + esc(p.method) + '<small>' + (al ? 'Aplicado a: ' + al : '') + (p.amount - (L.allocs[p.id] || []).reduce(function (a, x) { return a + x.amount; }, 0) > 0 ? ' · A favor: ' + clp(p.amount - (L.allocs[p.id] || []).reduce(function (a, x) { return a + x.amount; }, 0)) : '') + (p.note ? ' · ' + esc(p.note) : '') + '</small></div><span class="v">' + clp(p.amount) + '</span><button class="small" style="color:var(--rose-ink);padding:6px" data-act="delPay" data-id="' + p.id + '">Anular</button></div>';
        }).join('') || '<div class="small center">Sin pagos ni abonos registrados.</div>');
    } else {
      body = '<div class="card" style="margin-top:6px"><div class="tr"><span>Nombre</span><b>' + esc(m.first) + '</b></div><div class="tr"><span>Apellido</span><b>' + esc(m.last || '—') + '</b></div><div class="tr"><span>Se incorpora desde</span><b>' + PA.fmtShort(m.startDate) + '</b></div>' +
        '<div class="tog"><span>Integrante activo</span><button class="sw ' + (m.active ? 'on' : '') + '" data-act="toggleActive" data-id="' + m.id + '" aria-label="Activo"></button></div>' +
        (m.inactiveSince ? '<div class="small" style="padding-top:8px">Inactivo desde ' + PA.fmtShort(m.inactiveSince) + '. Su historial y deudas se conservan.</div>' : '') + '</div>' +
        '<button class="bigbtn ghost" data-act="editMember" data-id="' + m.id + '">Editar datos</button>';
    }
    return top(PA.fullName(m), { back: 1 }) +
      '<div class="row" style="margin:4px 0 12px">' + av(m).replace('<div class="avatar" style="', '<div class="avatar" style="width:64px;height:64px;font-size:22px;') +
      '<div><span class="chip ' + (m.active ? 'g' : 'n') + '">' + (m.active ? '● Activo' : 'Inactivo') + '</span>' + (L.balance > 0 ? ' <span class="chip a">Debe ' + clp(L.balance) + '</span>' : '') + (L.credit > 0 ? ' <span class="chip g">A favor ' + clp(L.credit) + '</span>' : '') + '</div></div>' +
      '<div class="seg">' + [['hist', 'Historial'], ['debts', 'Deudas'], ['data', 'Datos']].map(function (c) { return '<button class="' + (t === c[0] ? 'on' : '') + '" data-act="memTab" data-v="' + c[0] + '">' + c[1] + '</button>'; }).join('') + '</div>' +
      body + '<button class="bigbtn gold" data-act="quickPay" data-id="' + m.id + '">$ ' + (L.balance > 0 ? 'Registrar pago' : 'Registrar pago adelantado') + '</button>';
  }

  /* ================= SESIÓN ================= */
  function sessionRows(L, ses, d) {
    var q = ui.sq.trim().toLowerCase();
    var r = PA.roster(S, d).filter(function (m) { return !q || PA.fullName(m).toLowerCase().indexOf(q) >= 0; });
    if (!r.length) return '<div class="center small">' + (q ? 'Nadie coincide con la búsqueda.' : 'No hay integrantes activos para esta fecha. Agrégalos en la sección “Integrantes”.') + '</div>';
    return r.map(function (m) {
      var k = ses && ses.marks[m.id], l = L[m.id];
      var dt = l.debts.filter(function (x) { return x.date === d; })[0];
      var covered = k === 'owes' && dt && dt.balance === 0;
      var prior = l.balance - (k === 'owes' && dt ? dt.balance : 0), info = '';
      if (covered) info += '<small class="ok">Cuota cubierta con saldo a favor ✓</small>';
      else if (k === 'owes' && dt && dt.paid > 0) info += '<small>Esta sesión: debe ' + clp(dt.balance) + ' (abonó ' + clp(dt.paid) + ')</small>';
      if (prior > 0) info += '<small>Debe antes: ' + clp(prior) + '</small>';
      if (l.credit > 0) info += '<small class="ok">Saldo a favor: ' + clp(l.credit) + '</small>';
      var lbl = (l.credit > 0 || covered) ? 'Usa saldo' : 'Debe';
      var btn = function (key, text, ic) { return '<button class="st ' + key + (k === key ? ' on' : '') + '" data-act="mark" data-id="' + m.id + '" data-v="' + key + '">' + ic + ' ' + text + '</button>'; };
      return '<div class="mrow">' + av(m) + '<button class="nm" data-act="quickPay" data-id="' + m.id + '">' + esc(PA.fullName(m)) + info + '</button>' + btn('paid', 'Pagó', '✓') + btn('owes', lbl, '!') + btn('absent', 'Ausente', '✕') + '</div>';
    }).join('');
  }
  function vSession() {
    var d = ui.date, ses = S.sessions[d], isSusp = ses && ses.status === 'suspended';
    var head = top('Sesión del ' + PA.DIAS[PA.weekday(d)], {
      sub: PA.fmtFull(d),
      right: '<label class="iconbtn" style="position:relative;cursor:pointer">▦<input type="date" data-in="sdate" value="' + d + '" style="position:absolute;inset:0;opacity:0;width:100%;height:100%;padding:0"></label>'
    }) + '<div class="row" style="justify-content:space-between;margin-bottom:4px"><button class="pill-btn" data-act="shiftDate" data-v="-7">‹ Semana anterior</button><button class="pill-btn" data-act="shiftDate" data-v="7">Siguiente ›</button></div>' +
      '<div class="seg"><button class="' + (!isSusp && !ui.susp ? 'on' : '') + '" data-act="sesDone">Sesión realizada</button><button class="' + (isSusp || ui.susp ? 'on rose' : '') + '" data-act="sesSusp">Suspender sesión</button></div>';
    if (isSusp || ui.susp) {
      return head + '<div class="center"><div style="font-size:64px">🗓️</div><h2>' + (isSusp ? 'Sesión suspendida' : '¿Suspender esta sesión?') + '</h2><p style="color:var(--muted)">No se cobrará la cuota semanal a ningún integrante en esta fecha.</p></div>' +
        '<div class="notice">Al suspender la sesión, todos los integrantes quedan exentos de pago para esta semana. Las deudas anteriores y los saldos a favor se mantienen.</div>' +
        (isSusp ? '<button class="bigbtn ghost" data-act="sesDone">Reactivar sesión</button>' : '<button class="bigbtn rose" data-act="confirmSusp">Confirmar suspensión</button>');
    }
    var L = PA.ledger(S), fee = ses ? ses.fee : S.settings.fee, sm = PA.sessionSummary(S, d, L);
    return head + '<div class="hint">Cuota: <b>' + clp(fee) + '</b>. Toca <b>Pagó</b>, <b>Debe</b> o <b>Ausente</b> (se guarda solo). Toca el <b>nombre</b> para registrar un pago o abono, también adelantado.</div>' +
      '<input type="search" data-in="sessionSearch" placeholder="Buscar integrante…" value="' + esc(ui.sq) + '" autocomplete="off" style="margin:8px 0 4px">' +
      '<div id="srows">' + sessionRows(L, ses, d) + '</div>' +
      '<div class="sumrow"><div class="g">Recaudado<b>' + clp(sm.collected) + '</b></div><div class="a">Pendiente<b>' + clp(sm.pendingSession) + '</b></div><div class="r">Ausentes<b>' + sm.absent + '</b></div></div>' +
      (sm.unmarked ? '<div class="small" style="text-align:center">Sin marcar: ' + sm.unmarked + ' (no generan cobro hasta marcarlos)</div>' : '') +
      '<button class="bigbtn" data-act="saveSession">Listo ✓</button>';
  }

  /* ================= PAGOS ================= */
  function payList() {
    var L = PA.ledger(S), q = ui.pq.trim().toLowerCase();
    var list = S.members.filter(function (m) { return (m.active || L[m.id].balance > 0 || L[m.id].credit > 0) && (!q || PA.fullName(m).toLowerCase().indexOf(q) >= 0); });
    list.sort(function (a, b) { var da = L[a.id].balance, db = L[b.id].balance; if ((da > 0) !== (db > 0)) return da > 0 ? -1 : 1; if (da !== db) return db - da; return PA.fullName(a).localeCompare(PA.fullName(b), 'es'); });
    if (!list.length) return '<div class="center small">' + (S.members.length ? 'Nadie coincide con la búsqueda.' : 'Aún no hay integrantes.') + '</div>';
    return '<div class="list">' + list.map(function (m) {
      var l = L[m.id], sub = l.balance > 0 ? '<span style="color:var(--amber-ink);font-weight:700">Debe ' + clp(l.balance) + '</span>' : l.credit > 0 ? '<span style="color:var(--green-d);font-weight:700">Saldo a favor ' + clp(l.credit) + '</span>' : 'Al día';
      return '<button class="item" data-act="quickPay" data-id="' + m.id + '">' + av(m) + '<div class="grow"><div class="nm">' + esc(PA.fullName(m)) + '</div><div class="sb">' + sub + '</div></div><span class="cobrar">$ Pago</span></button>';
    }).join('') + '</div>';
  }
  function vPay() {
    return top('Registrar pago', { back: 1 }) +
      '<div class="hint">Elige a la persona y escribe cuánto pagó: <b>puede ser más de una cuota</b>. Primero salda lo que debe y lo que sobre queda como <b>saldo a favor</b> para las próximas sesiones.</div>' +
      '<input type="search" data-in="paySearch" placeholder="Buscar integrante…" value="' + esc(ui.pq) + '" autocomplete="off" style="margin:8px 0 4px">' +
      '<div id="plist">' + payList() + '</div>';
  }

  /* ---- hoja rápida de pago (se usa desde Inicio, Sesiones, Integrantes y Registrar pago) ---- */
  var METHODS = ['Efectivo', 'Transferencia', 'Otro'];
  function openPay(id) {
    var l = PA.ledger(S)[id]; if (!l) return;
    ui.qp = { memberId: id, amount: String(l.balance > 0 ? l.balance : (S.settings.fee || '')), date: today, method: 'Efectivo', applyTo: 'oldest', note: '' };
    drawPay();
  }
  function drawPay() {
    var qp = ui.qp, m = mem(qp.memberId), l = PA.ledger(S)[m.id], fee = S.settings.fee;
    var open = l.debts.filter(function (x) { return x.balance > 0; });
    var chips = [];
    if (l.balance > 0) chips.push([l.balance, 'Toda la deuda · ' + clp(l.balance)]);
    if (fee > 0) [1, 2, 3, 4, 8].forEach(function (n) { var v = n * fee; if (v !== l.balance) chips.push([v, n + (n === 1 ? ' sesión' : ' sesiones') + ' · ' + clp(v)]); });
    var st = l.balance > 0 ? 'Debe ' + clp(l.balance) + ' (' + open.length + ' semana' + (open.length === 1 ? '' : 's') + ')' : l.credit > 0 ? 'Saldo a favor: ' + clp(l.credit) : 'Está al día';
    openModal('<div class="row">' + av(m) + '<div class="grow"><h2>' + esc(PA.fullName(m)) + '</h2><div class="small">' + st + '</div></div><button class="iconbtn" data-act="closeModal" aria-label="Cerrar">✕</button></div>' +
      '<label class="f">¿Cuánto pagó? (CLP)</label><div class="amt"><button data-act="qpStep" data-v="-1" aria-label="Menos">−</button><input id="qpAmount" data-in="qp" inputmode="numeric" pattern="[0-9]*" placeholder="0" value="' + esc(qp.amount) + '"><button data-act="qpStep" data-v="1" aria-label="Más">+</button></div>' +
      '<div class="chips2">' + chips.map(function (c) { return '<button class="qchip" data-act="qpAmt" data-v="' + c[0] + '">' + c[1] + '</button>'; }).join('') + '</div>' +
      '<div id="qpPrev" class="prev"></div>' +
      '<div class="seg" id="qpMethods">' + METHODS.map(function (x) { return '<button class="' + (qp.method === x ? 'on' : '') + '" data-act="qpMethod" data-v="' + x + '">' + x + '</button>'; }).join('') + '</div>' +
      '<details class="more"><summary>Más opciones (fecha, semana, nota)</summary>' +
      '<label class="f">Fecha del pago</label><input id="qpDate" data-in="qp" type="date" value="' + qp.date + '">' +
      '<label class="f">Aplicar a</label><select id="qpApply" data-in="qp"><option value="oldest">Deudas más antiguas primero (recomendado)</option>' + open.map(function (x) { return '<option value="' + x.date + '">Semana ' + PA.fmtShort(x.date) + ' — saldo ' + clp(x.balance) + '</option>'; }).join('') + '</select>' +
      '<label class="f">Observaciones (opcional)</label><textarea id="qpNote" data-in="qp" rows="2" placeholder="Ej: pagó 4 semanas"></textarea></details>' +
      '<button class="bigbtn" id="qpOk" data-act="qpSave">Registrar pago</button>');
    updatePrev();
  }
  function readQP() {
    if (!ui.qp || !$('#qpAmount')) return;
    ui.qp.amount = $('#qpAmount').value.replace(/[^0-9]/g, '');
    ui.qp.date = $('#qpDate').value || today; ui.qp.applyTo = $('#qpApply').value; ui.qp.note = $('#qpNote').value;
  }
  function updatePrev() {
    if (!ui.qp || !$('#qpPrev')) return;
    readQP();
    var qp = ui.qp, amt = parseInt(qp.amount, 10) || 0, fee = S.settings.fee, box = $('#qpPrev'), ok = $('#qpOk');
    [].forEach.call(document.querySelectorAll('.qchip'), function (b) { b.classList.toggle('on', +b.dataset.v === amt); });
    if (amt <= 0) { box.innerHTML = 'Escribe o elige un monto.'; box.className = 'prev'; ok.disabled = true; ok.textContent = 'Registrar pago'; return; }
    var pv = PA.previewPayment(S, { memberId: qp.memberId, amount: amt, date: qp.date, applyTo: qp.applyTo }), out = [];
    if (pv.toDebt > 0) out.push(pv.after.balance === 0 ? 'Se <b>salda toda la deuda</b> (' + clp(pv.toDebt) + ').' : 'Se abonan <b>' + clp(pv.toDebt) + '</b> a la deuda. <b>Sigue debiendo ' + clp(pv.after.balance) + '</b>.');
    if (pv.toCredit > 0) { var n = fee > 0 ? Math.floor(pv.after.credit / fee) : 0; out.push('<b>' + clp(pv.toCredit) + '</b> quedan como <b>saldo a favor</b>' + (n > 0 ? ' (alcanza para ' + n + (n === 1 ? ' sesión' : ' sesiones') + ' más)' : '') + '. Se usa en las próximas sesiones con el botón “Usa saldo”.'); }
    box.innerHTML = out.join('<br>'); box.className = 'prev ' + (pv.after.balance > 0 ? 'warn' : 'good');
    ok.disabled = false; ok.textContent = 'Registrar ' + clp(amt);
  }

  function vDebts() {
    var L = PA.ledger(S), list = S.members.filter(function (m) { return L[m.id].balance > 0; }).sort(function (a, b) { return L[b.id].balance - L[a.id].balance; });
    return top('Deudas pendientes', { back: 1 }) +
      '<div class="card"><div class="small">Total pendiente (no es dinero recibido)</div><div class="money" style="color:var(--amber-ink)">' + clp(PA.totalPending(S, L)) + '</div></div>' +
      (list.length ? '<div class="list">' + list.map(function (m) { return debtRow(m, L); }).join('') + '</div>' : '<div class="center small">No hay deudas pendientes. 🎭</div>');
  }

  /* ================= REPORTES ================= */
  function range() {
    var r = ui.rep;
    if (r.mode === 'tot') return { from: '', to: '9999-12-31', label: 'Todo el historial' };
    if (r.mode === 'sem') { var f = PA.mondayOf(r.ref); return { from: f, to: PA.addDays(f, 6), label: PA.fmtShort(f).slice(0, 6) + ' – ' + PA.fmtShort(PA.addDays(f, 6)) }; }
    var ym = r.ref.slice(0, 7); return { from: ym + '-01', to: ym + '-31', label: PA.monthLabel(ym) };
  }
  function vReports() {
    var rg = range(), who = ui.rep.who, L = PA.ledger(S);
    var mv = PA.movements(S).filter(function (x) { return x.date >= rg.from && x.date <= rg.to && (!who || x.memberId === who || (x.type === 'suspendida' && !who)); });
    var cash = PA.sum(mv.filter(PA.isCash));
    var debts = []; S.members.forEach(function (m) { if (who && m.id !== who) return; L[m.id].debts.forEach(function (x) { if (x.date >= rg.from && x.date <= rg.to) debts.push(x); }); });
    var pend = debts.reduce(function (a, x) { return a + x.balance; }, 0), pendN = debts.filter(function (x) { return x.balance > 0; }).length;
    var nPaid = mv.filter(function (x) { return x.type === 'pago_sesion'; }).length, nAbs = mv.filter(function (x) { return x.type === 'ausente'; }).length;
    var byDate = {}; mv.filter(PA.isCash).forEach(function (x) { byDate[x.date] = (byDate[x.date] || 0) + x.amount; });
    var ds = Object.keys(byDate).sort().slice(-8), mx = Math.max.apply(null, ds.map(function (k) { return byDate[k]; }).concat([1]));
    var bars = ds.length ? '<div class="bars">' + ds.map(function (k) { return '<div class="b">' + clp(byDate[k]) + '<i style="height:' + Math.max(2, Math.round(byDate[k] / mx * 100)) + 'px"></i></div>'; }).join('') + '</div><div class="barlbl">' + ds.map(function (k) { return '<span>' + PA.fmtShort(k).slice(0, 6) + '</span>'; }).join('') + '</div>' : '<div class="small center">Sin pagos en este período.</div>';
    var absBy = {}; mv.filter(function (x) { return x.type === 'ausente'; }).forEach(function (x) { absBy[x.memberId] = (absBy[x.memberId] || 0) + 1; });
    var absList = Object.keys(absBy).sort(function (a, b) { return absBy[b] - absBy[a]; }).map(function (id) { return '<div class="tr"><span>' + esc(PA.fullName(mem(id))) + '</span><span class="v">' + absBy[id] + '</span></div>'; }).join('');
    var sesDates = Object.keys(S.sessions).filter(function (d) { return d >= rg.from && d <= rg.to; }).sort().reverse();
    var sesList = sesDates.map(function (d) { var s = PA.sessionSummary(S, d); return '<div class="tr"><div class="l">' + PA.fmtShort(d) + '<small>' + (s.status === 'suspended' ? 'Suspendida' : s.paid + ' pagaron · ' + s.owes + ' deben · ' + s.absent + ' ausentes') + '</small></div><span class="v">' + (s.status === 'suspended' ? '—' : clp(s.collected)) + '</span></div>'; }).join('');
    var susp = sesDates.filter(function (d) { return S.sessions[d].status === 'suspended'; });
    var pays = mv.filter(function (x) { return x.type === 'abono'; }).map(function (x) { return '<div class="tr"><div class="l">' + PA.fmtShort(x.date) + ' · ' + esc(PA.fullName(mem(x.memberId))) + '<small>' + esc(x.method) + (x.note ? ' · ' + esc(x.note) : '') + '</small></div><span class="v">' + clp(x.amount) + '</span></div>'; }).join('');
    var step = ui.rep.mode === 'sem' ? 7 : 1;
    return top('Reportes') +
      '<div class="seg">' + [['sem', 'Semanal'], ['mes', 'Mensual'], ['tot', 'Total']].map(function (c) { return '<button class="' + (ui.rep.mode === c[0] ? 'on' : '') + '" data-act="repMode" data-v="' + c[0] + '">' + c[1] + '</button>'; }).join('') + '</div>' +
      (ui.rep.mode === 'tot' ? '' : '<div class="row" style="margin-bottom:10px"><button class="iconbtn" data-act="repShift" data-v="-1">‹</button><div class="grow" style="text-align:center;font-weight:700">' + rg.label + '</div><button class="iconbtn" data-act="repShift" data-v="1">›</button></div>') +
      '<select id="repWho" data-in="repWho"><option value="">Todos los participantes</option>' + S.members.slice().sort(function (a, b) { return PA.fullName(a).localeCompare(PA.fullName(b), 'es'); }).map(function (m) { return '<option value="' + m.id + '"' + (who === m.id ? ' selected' : '') + '>' + esc(PA.fullName(m)) + '</option>'; }).join('') + '</select>' +
      '<div class="grid2" style="margin-top:12px"><div class="tile"><div class="ic g">$</div><div><b style="font-size:20px">' + clp(cash) + '</b><span>Recaudado</span></div></div><div class="tile"><div class="ic a">!</div><div><b style="font-size:20px">' + clp(pend) + '</b><span>Pendiente</span></div></div>' +
      tile('g', '✓', nPaid, 'Pagaron') + tile('a', '!', pendN, 'Pendientes') + '</div><div class="grid2">' + tile('r', '✕', nAbs, 'Ausencias') + tile('n', '—', susp.length, 'Suspendidas') + '</div>' +
      '<div class="sec">Recaudación por fecha</div>' + bars +
      (absList ? '<div class="sec">Ausencias por participante</div>' + absList : '') +
      '<div class="sec">Historial de sesiones</div>' + (sesList || '<div class="small center">Sin sesiones en este período.</div>') +
      '<div class="sec">Pagos y abonos recibidos</div>' + (pays || '<div class="small center">Sin abonos en este período.</div>') +
      '<button class="bigbtn ghost" data-act="exportReport" style="margin-top:18px">⬇ Exportar reporte (CSV / Excel)</button>';
  }

  /* ================= CONFIGURACIÓN ================= */
  function vSettings() {
    var st = S.settings;
    var tog = function (k, lbl) { return '<div class="tog"><span>' + lbl + '</span><button class="sw ' + (st[k] ? 'on' : '') + '" data-act="setTog" data-v="' + k + '" aria-label="' + lbl + '"></button></div>'; };
    return top('Configuración', { back: 1 }) +
      '<div class="sec">Datos generales</div><label class="f">Monto de la cuota semanal (CLP)</label><input data-in="s:fee" inputmode="numeric" value="' + st.fee + '"><div class="small" style="margin-top:4px">Un cambio aplica sólo a sesiones nuevas; las ya registradas conservan su monto.</div>' +
      '<label class="f">Lugar del taller</label><input data-in="s:place" value="' + esc(st.place) + '">' +
      '<label class="f">Día habitual</label><select data-in="s:weekday">' + PA.DIAS.map(function (d, i) { return '<option value="' + i + '"' + (st.weekday === i ? ' selected' : '') + '>' + d.charAt(0).toUpperCase() + d.slice(1) + '</option>'; }).join('') + '</select>' +
      '<label class="f">Hora habitual</label><input type="time" data-in="s:time" value="' + esc(st.time) + '">' +
      '<div class="sec">Opciones</div>' + tog('rememberView', 'Recordar última vista') +
      '<div class="sec">Respaldo de datos</div>' +
      '<div class="notice info">Tus datos se guardan en este teléfono (almacenamiento local del navegador). Si borras los datos de Safari o desinstalas la app, se pierden. <b>Exporta un respaldo con frecuencia</b> y guárdalo en Archivos, iCloud o correo.</div>' +
      '<button class="bigbtn" data-act="exportJson">⬇ Respaldo completo (.json)</button>' +
      '<button class="bigbtn ghost" data-act="importJson">⬆ Restaurar respaldo (.json)</button>' +
      '<button class="bigbtn ghost" data-act="exportMembers">⬇ Exportar nómina (CSV / Excel)</button>' +
      '<button class="bigbtn ghost" data-act="importMembers">⬆ Importar nómina (CSV)</button>' +
      '<div class="small" style="margin-top:6px">Para importar desde Excel: Archivo → Guardar como → CSV. Columnas: Nombre; Apellido (opcional: Estado).</div>' +
      '<button class="bigbtn danger" data-act="wipe" style="margin-top:22px">Borrar todos los datos</button>' +
      '<div class="small center">Primer Acto · Cuotas y Asistencia v1.1</div>';
  }

  /* ================= render ================= */
  function render() {
    var v = ui.view, h = '';
    if (v === 'home') h = vHome(); else if (v === 'members') h = vMembers(); else if (v === 'member') h = vMember(); else if (v === 'session') h = vSession();
    else if (v === 'pay') h = vPay(); else if (v === 'debts') h = vDebts(); else if (v === 'reports') h = vReports(); else if (v === 'settings') h = vSettings();
    $('#app').innerHTML = h + nav();
    if (S.settings.rememberView && ['home', 'members', 'session', 'reports'].indexOf(v) >= 0) { try { localStorage.setItem('primerActo.view', v); } catch (e) {} }
  }

  /* ================= modales ================= */
  function openModal(html) { var m = $('#modal'); m.innerHTML = '<div class="sheet">' + html + '</div>'; m.hidden = false; }
  function closeModal() { var m = $('#modal'); m.hidden = true; m.innerHTML = ''; }
  function confirmBox(title, text, ok, cb, danger) {
    confirmBox.cb = cb;
    openModal('<h2>' + esc(title) + '</h2><p style="color:var(--muted)">' + text + '</p><button class="bigbtn ' + (danger ? 'rose' : '') + '" data-act="confirmOk">' + esc(ok) + '</button><button class="bigbtn ghost" data-act="closeModal">Cancelar</button>');
  }
  function memberForm(id) {
    var m = id ? mem(id) : null;
    openModal('<h2>' + (m ? 'Editar integrante' : 'Nuevo integrante') + '</h2><label class="f">Nombre</label><input id="mfFirst" value="' + esc(m ? m.first : '') + '" autocapitalize="words">' +
      '<label class="f">Apellido</label><input id="mfLast" value="' + esc(m ? m.last : '') + '" autocapitalize="words">' +
      '<label class="f">Se incorpora desde</label><input id="mfStart" type="date" value="' + (m ? m.startDate : today) + '"><div class="small" style="margin-top:4px">No se generan deudas por sesiones anteriores a esta fecha.</div>' +
      '<button class="bigbtn" data-act="saveMember" data-id="' + (id || '') + '">Guardar</button><button class="bigbtn ghost" data-act="closeModal">Cancelar</button>');
  }

  /* ================= archivos ================= */
  function sendFile(name, text, mime) {
    var blob = new Blob([text], { type: mime });
    try {
      var f = new File([blob], name, { type: mime });
      if (navigator.canShare && navigator.canShare({ files: [f] })) { navigator.share({ files: [f], title: name }).catch(function () {}); return; }
    } catch (e) {}
    var a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; document.body.appendChild(a); a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 1500);
  }
  function readFile(input, cb) {
    var f = input.files && input.files[0]; if (!f) return;
    var r = new FileReader(); r.onload = function () { cb(String(r.result)); input.value = ''; }; r.readAsText(f);
  }

  /* ================= acciones ================= */
  var A = {
    back: back,
    tab: function (d) { tab(d.v); },
    go: function (d) { go(d.v, d.id || null); },
    filter: function (d) { ui.filter = d.v; render(); },
    member: function (d) { go('member', d.id); if (d.tab) ui.memTab = d.tab; render(); },
    memTab: function (d) { ui.memTab = d.v; render(); },
    addMember: function () { memberForm(); },
    editMember: function (d) { memberForm(d.id); },
    saveMember: function (d) {
      var f = $('#mfFirst').value, l = $('#mfLast').value, s = $('#mfStart').value || today;
      if (d.id) { var m = mem(d.id); if (!f.trim()) return toast('Escribe el nombre.'); m.first = f.trim(); m.last = l.trim(); m.startDate = s; }
      else { var r = PA.addMember(S, f, l, s); if (r.error) return toast(r.error); }
      save(); closeModal(); render(); toast('Guardado ✓');
    },
    toggleActive: function (d) {
      var m = mem(d.id);
      if (m.active) confirmBox('¿Marcar como inactivo?', 'Dejará de generar cuotas nuevas. Su historial y sus deudas se conservan.', 'Marcar inactivo', function () { PA.setActive(S, m.id, false, today); save(); closeModal(); render(); });
      else { PA.setActive(S, m.id, true); save(); render(); }
    },
    closeModal: closeModal,
    confirmOk: function () { var cb = confirmBox.cb; confirmBox.cb = null; if (cb) cb(); },
    mark: function (d) {
      var r = PA.setMark(S, ui.date, d.id, d.v); if (r.error) return toast(r.error);
      save(); var y = window.scrollY; render(); window.scrollTo(0, y);
    },
    shiftDate: function (d) { ui.date = PA.addDays(ui.date, +d.v); ui.susp = false; render(); },
    sesDone: function () {
      var s = S.sessions[ui.date];
      ui.susp = false;
      if (s && s.status === 'suspended') confirmBox('¿Reactivar la sesión?', 'Volverá a ser una sesión realizada y se podrán marcar los estados otra vez.', 'Reactivar', function () { PA.setStatus(S, ui.date, 'done'); save(); closeModal(); render(); });
      else render();
    },
    sesSusp: function () { ui.susp = true; render(); },
    confirmSusp: function () { PA.setStatus(S, ui.date, 'suspended'); ui.susp = false; save(); render(); toast('Sesión suspendida: nadie genera cuota'); },
    saveSession: function () { PA.ensureSession(S, ui.date); save(); tab('home'); toast('Sesión guardada ✓'); },
    quickPay: function (d) { openPay(d.id); },
    qpStep: function (d) { readQP(); var fee = S.settings.fee || 500, cur = parseInt(ui.qp.amount, 10) || 0; $('#qpAmount').value = String(Math.max(0, cur + (+d.v) * fee)); updatePrev(); },
    qpAmt: function (d) { $('#qpAmount').value = d.v; updatePrev(); },
    qpMethod: function (d) { ui.qp.method = d.v; [].forEach.call(document.querySelectorAll('#qpMethods button'), function (b) { b.classList.toggle('on', b.dataset.v === d.v); }); },
    qpSave: function () {
      readQP(); var qp = ui.qp, amt = parseInt(qp.amount, 10) || 0;
      var pv = PA.previewPayment(S, { memberId: qp.memberId, amount: amt, date: qp.date, applyTo: qp.applyTo });
      var r = PA.addPayment(S, { memberId: qp.memberId, amount: amt, date: qp.date, method: qp.method, applyTo: qp.applyTo, note: qp.note });
      if (r.error) return toast(r.error);
      save(); closeModal(); ui.qp = null; render();
      toast('Pago de ' + clp(amt) + ' registrado ✓' + (pv && pv.after.credit > pv.before.credit ? ' · ' + clp(pv.after.credit) + ' a favor' : pv && pv.after.balance > 0 ? ' · sigue debiendo ' + clp(pv.after.balance) : ''));
    },
    delPay: function (d) { confirmBox('¿Anular este pago?', 'La deuda volverá a quedar pendiente por ese monto (o se descuenta del saldo a favor).', 'Anular pago', function () { PA.removePayment(S, d.id); save(); closeModal(); render(); }, true); },
    repMode: function (d) { ui.rep.mode = d.v; render(); },
    repShift: function (d) {
      var n = +d.v;
      if (ui.rep.mode === 'sem') ui.rep.ref = PA.addDays(ui.rep.ref, 7 * n);
      else ui.rep.ref = PA.addMonths(ui.rep.ref.slice(0, 7), n) + '-01';
      render();
    },
    exportReport: function () {
      var rg = range();
      sendFile('primer-acto-reporte-' + today + '.csv', PA.toCSV(PA.reportRows(S, { from: rg.from, to: rg.to, who: ui.rep.who })), 'text/csv');
    },
    exportMembers: function () {
      var L = PA.ledger(S), rows = [['Nombre', 'Apellido', 'Estado', 'Incorporación', 'Deuda pendiente CLP']];
      S.members.forEach(function (m) { rows.push([m.first, m.last, m.active ? 'Activo' : 'Inactivo', m.startDate, L[m.id].balance]); });
      sendFile('primer-acto-nomina-' + today + '.csv', PA.toCSV(rows), 'text/csv');
    },
    importMembers: function () { $('#fileCsv').click(); },
    exportJson: function () { sendFile('primer-acto-respaldo-' + today + '.json', JSON.stringify(S, null, 1), 'application/json'); },
    importJson: function () { $('#fileJson').click(); },
    setTog: function (d) { S.settings[d.v] = !S.settings[d.v]; save(); render(); },
    wipe: function () {
      openModal('<h2>Borrar todos los datos</h2><p style="color:var(--muted)">Se eliminarán integrantes, sesiones y pagos de este teléfono. Exporta un respaldo antes. Escribe <b>BORRAR</b> para confirmar.</p><input id="wipeTxt" autocapitalize="characters" autocomplete="off"><button class="bigbtn rose" data-act="wipeOk">Borrar todo</button><button class="bigbtn ghost" data-act="closeModal">Cancelar</button>');
    },
    wipeOk: function () {
      if ($('#wipeTxt').value.trim().toUpperCase() !== 'BORRAR') return toast('Escribe BORRAR para confirmar.');
      S = PA.newState(); save(); closeModal(); tab('home'); toast('Datos borrados');
    }
  };

  document.addEventListener('click', function (e) {
    var el = e.target.closest('[data-act]'); if (!el) return;
    var fn = A[el.dataset.act]; if (fn) { e.preventDefault(); fn(el.dataset, el); }
  });
  document.addEventListener('input', function (e) {
    var k = e.target.dataset && e.target.dataset.in; if (!k) return;
    if (k === 'search') { ui.q = e.target.value; $('#mlist').innerHTML = memberList(); }
    else if (k === 'sessionSearch') { ui.sq = e.target.value; var ss = S.sessions[ui.date]; $('#srows').innerHTML = sessionRows(PA.ledger(S), ss, ui.date); }
    else if (k === 'paySearch') { ui.pq = e.target.value; $('#plist').innerHTML = payList(); }
    else if (k === 'qp') { if (e.target.id === 'qpAmount') { var c = e.target.value.replace(/[^0-9]/g, ''); if (c !== e.target.value) e.target.value = c; } updatePrev(); }
    else if (k.indexOf('s:') === 0) {
      var f = k.slice(2), v = e.target.value;
      if (f === 'fee') { var n = parseInt(v.replace(/[^0-9]/g, ''), 10); if (!isNaN(n)) S.settings.fee = n; }
      else if (f === 'weekday') { S.settings.weekday = +v; ui.date = PA.nextSessionDate(today, +v); }
      else S.settings[f] = v;
      save();
    }
  });
  document.addEventListener('change', function (e) {
    var k = e.target.dataset && e.target.dataset.in; if (!k) return;
    if (k === 'sdate') { if (e.target.value) { ui.date = e.target.value; ui.susp = false; render(); } }
    else if (k === 'qp') { updatePrev(); }
    else if (k === 'repWho') { ui.rep.who = e.target.value; render(); }
    else if (k === 's:weekday') { render(); }
  });
  $('#fileCsv').addEventListener('change', function () {
    readFile(this, function (txt) { var r = PA.importMembers(S, txt, today); save(); render(); toast(r.added + ' integrante(s) importado(s)' + (r.skipped ? ', ' + r.skipped + ' ya existían' : '')); });
  });
  $('#fileJson').addEventListener('change', function () {
    readFile(this, function (txt) {
      try {
        var d = JSON.parse(txt); if (!d || !Array.isArray(d.members) || typeof d.sessions !== 'object') throw 0;
        confirmBox('¿Restaurar este respaldo?', 'Reemplazará todos los datos actuales (' + d.members.length + ' integrantes en el respaldo). Se conserva una copia automática de lo actual.', 'Restaurar', function () {
          try { localStorage.setItem(BAK, JSON.stringify({ date: today, data: S })); } catch (e) {}
          S = PA.normalize(d); save(); closeModal(); render(); toast('Respaldo restaurado ✓');
        });
      } catch (e) { toast('El archivo no es un respaldo válido.'); }
    });
  });

  if ('serviceWorker' in navigator && location.protocol.indexOf('http') === 0) navigator.serviceWorker.register('sw.js').catch(function () {});
  render();
})();
