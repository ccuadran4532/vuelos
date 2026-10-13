// Buscador de Vuelos: país → ciudad → fechas → personas → calendario de precios y vuelos.
// Usa conf, $, CLP, esc y DOW de app.js. La búsqueda la hace el servidor (Apps Script) en Google Flights, sin cookies.
(function () {
  const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
  const MES3 = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
  const NOMBRE_PAIS = (() => { try { return new Intl.DisplayNames(['es'], { type: 'region' }); } catch (e) { return null; } })();
  const nomPais = cc => (NOMBRE_PAIS && NOMBRE_PAIS.of(cc)) || cc;
  const sinTilde = s => s.normalize('NFD').replace(/[̀-ͯ]/g, '');
  const iso = d => d.toISOString().slice(0, 10);
  const D = s => new Date(s + 'T12:00:00Z');
  const fCorta = s => { const d = D(s); return `${DOW[d.getUTCDay()]} ${d.getUTCDate()} ${MES3[d.getUTCMonth()]}`; };
  const hoyIso = () => { const d = new Date(); return new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate(), 12)).toISOString().slice(0, 10); };

  // ---------- estado (se recuerda en el teléfono)
  let B = { modo: 'rt', origen: { iata: 'SCL', ciudad: 'Santiago', aeropuerto: 'Arturo Merino Benítez', pais: 'Chile', cc: 'CL' }, destino: null, ida: null, vuelta: null, a: 2, n: 0, b: 0, clase: 'turista' };
  try { Object.assign(B, JSON.parse(localStorage.getItem('busqueda') || '{}')); } catch (e) {}
  if (B.ida && B.ida < hoyIso()) { B.ida = null; B.vuelta = null; }
  const guardar = () => { try { localStorage.setItem('busqueda', JSON.stringify(B)); } catch (e) {} };
  let AEROS = null, PAISES = [], PAIS_DE = {}, RES = null, SEL = 0, FILTRO = 'todos', ELIGIENDO = 'destino';
  const ORI = () => B.origen || { iata: 'SCL', ciudad: 'Santiago', pais: 'Chile', cc: 'CL' };

  // ---------- pantallas internas
  const PANT = ['home', 'pais', 'ciudad', 'fechas', 'personas', 'res'];
  function ver(p) {
    PANT.forEach(x => $('bs-' + x).hidden = x !== p);
    $('bsPieFechas').hidden = p !== 'fechas' || !B.ida;
    document.querySelector('.tabbar').hidden = p === 'fechas';
    window.scrollTo(0, 0);
    if (p === 'home') pintarHome();
  }
  document.querySelectorAll('#v-buscar [data-atras]').forEach(b => b.onclick = () => ver(b.dataset.atras));
  // Al tocar la pestaña Buscar estando dentro, volver al inicio del buscador.
  document.querySelector('.tabbar button[data-v="buscar"]').addEventListener('click', () => ver('home'));

  // ---------- inicio
  function txtPersonas() {
    const p = [`${B.a} ${B.a === 1 ? 'adulto' : 'adultos'}`];
    if (B.n) p.push(`${B.n} ${B.n === 1 ? 'niño' : 'niños'}`);
    if (B.b) p.push(`${B.b} ${B.b === 1 ? 'bebé' : 'bebés'}`);
    return p.join(', ') + ' · ' + { turista: 'Turista', premium: 'Premium', ejecutiva: 'Ejecutiva' }[B.clase];
  }
  function noches() { return B.ida && B.vuelta ? Math.round((D(B.vuelta) - D(B.ida)) / 864e5) : 0; }
  function pintarHome() {
    $('bsOrigenTxt').textContent = `${ORI().pais} · ${ORI().ciudad} ${ORI().iata}`;
    const d = $('bsDestinoTxt');
    d.textContent = B.destino ? `${B.destino.pais} · ${B.destino.ciudad} ${B.destino.iata}` : 'Elige país y ciudad';
    d.classList.toggle('vacio', !B.destino);
    const f = $('bsFechasTxt');
    f.textContent = !B.ida ? (B.modo === 'rt' ? 'Elige ida y vuelta' : 'Elige la fecha de ida')
      : B.modo === 'rt' ? (B.vuelta ? `${fCorta(B.ida)} → ${fCorta(B.vuelta)} · ${noches()} noches` : `${fCorta(B.ida)} → elige vuelta`) : `${fCorta(B.ida)} · solo ida`;
    f.classList.toggle('vacio', !B.ida);
    $('bsPersonasTxt').textContent = txtPersonas();
    ['bsModo', 'bsModo2'].forEach(id => $(id).querySelectorAll('button').forEach(b => b.setAttribute('aria-pressed', b.dataset.m === B.modo)));
    const listo = B.destino && B.ida && (B.modo === 'ow' || B.vuelta);
    $('bsBuscar').disabled = !listo;
    $('bsMsg').textContent = listo ? '' : 'Completa destino y fechas para buscar.';
    pintarRecientes();
  }
  function cambiarModo(m) { B.modo = m; if (m === 'ow') B.vuelta = null; guardar(); pintarHome(); pintarMeses(); }
  ['bsModo', 'bsModo2'].forEach(id => $(id).querySelectorAll('button').forEach(b => b.onclick = () => cambiarModo(b.dataset.m)));
  $('bsDestino').onclick = () => { ELIGIENDO = 'destino'; $('bsPaisTitulo').textContent = '¿A qué país?'; ver('pais'); cargarPaises(); };
  $('bsOrigen').onclick = () => { ELIGIENDO = 'origen'; $('bsPaisTitulo').textContent = '¿Desde qué país?'; ver('pais'); cargarPaises(); };
  $('bsInvertir').onclick = () => { if (!B.destino) return; const o = ORI(); B.origen = B.destino; B.destino = o; guardar(); pintarHome(); };
  $('bsFechas').onclick = () => { ver('fechas'); pintarMeses(); };
  $('bsPersonas').onclick = () => { ver('personas'); pintarPersonas(); };
  $('bsBuscar').onclick = () => buscar();

  // ---------- recientes
  function recientes() { try { return JSON.parse(localStorage.getItem('recientes') || '[]'); } catch (e) { return []; } }
  function pintarRecientes() {
    const L = recientes();
    $('bsRecG').hidden = !L.length;
    $('bsRec').innerHTML = L.map((r, i) => `<button type="button" class="reciente glass" data-i="${i}"><span class="r1">${esc((r.origen || ORI()).iata)} → ${esc(r.destino.iata)}</span><span class="r2">${esc(r.destino.ciudad)}</span><span class="r3">${esc(fCorta(r.ida))}${r.vuelta ? ' → ' + esc(fCorta(r.vuelta)) : ''}</span>${r.min ? `<span class="r3" style="color:var(--ok);font-weight:800">desde ${CLP(r.min)} c/u</span>` : ''}</button>`).join('');
    $('bsRec').querySelectorAll('[data-i]').forEach(b => b.onclick = () => {
      const r = L[+b.dataset.i];
      Object.assign(B, { origen: r.origen || ORI(), destino: r.destino, ida: r.ida < hoyIso() ? null : r.ida, vuelta: r.ida < hoyIso() ? null : r.vuelta, modo: r.vuelta ? 'rt' : 'ow' });
      guardar(); pintarHome();
      if (B.ida) buscar();
    });
  }

  // ---------- países (todos, A–Z)
  async function cargarPaises() {
    if (!AEROS) {
      try { AEROS = await (await fetch('aeropuertos.json')).json(); }
      catch (e) { $('bsPaises').innerHTML = '<div class="empty">No se pudo cargar la lista. Revisa tu conexión.</div>'; return; }
      PAISES = Object.keys(AEROS).filter(cc => cc !== 'CL' || AEROS[cc].length > 1).map(cc => ({ cc, nombre: nomPais(cc), n: AEROS[cc].length }))
        .sort((x, y) => x.nombre.localeCompare(y.nombre, 'es'));
      Object.keys(AEROS).forEach(cc => AEROS[cc].forEach(a => PAIS_DE[a[0]] = cc));
    }
    pintarPaises('');
    $('bsFiltro').value = '';
  }
  function pintarPaises(q) {
    const t = sinTilde(q.trim().toLowerCase());
    if (t.length >= 2) {
      // búsqueda: países que coinciden + ciudades/aeropuertos de cualquier país
      const ps = PAISES.filter(p => sinTilde(p.nombre.toLowerCase()).includes(t));
      const cs = [];
      for (const cc in AEROS) for (const a of AEROS[cc]) {
        if (a[0].toLowerCase() === t || sinTilde(a[1].toLowerCase()).includes(t)) cs.push({ cc, a });
        if (cs.length > 30) break;
      }
      $('bsPaises').innerHTML = (ps.length ? `<div class="letra">PAÍSES</div><div class="list">${ps.map(filaPais).join('')}</div>` : '') +
        (cs.length ? `<div class="letra">CIUDADES</div><div class="list">${cs.map(x => filaCiudad(x.a, x.cc, true)).join('')}</div>` : '') +
        (!ps.length && !cs.length ? '<div class="empty">No encontré ese país o ciudad.</div>' : '');
      $('bsIndice').innerHTML = '';
    } else {
      const grupos = {};
      PAISES.forEach(p => { const l = sinTilde(p.nombre[0]).toUpperCase(); (grupos[l] = grupos[l] || []).push(p); });
      const letras = Object.keys(grupos).sort();
      $('bsPaises').innerHTML = letras.map(l => `<div class="letra" id="bsL-${l}">${l}</div><div class="list">${grupos[l].map(filaPais).join('')}</div>`).join('');
      $('bsIndice').innerHTML = letras.map(l => `<button type="button" data-l="${l}" aria-label="Ir a ${l}">${l}</button>`).join('');
      $('bsIndice').querySelectorAll('[data-l]').forEach(b => b.onclick = () => { const e = $('bsL-' + b.dataset.l); if (e) e.scrollIntoView({ behavior: 'smooth', block: 'start' }); });
    }
    $('bsPaises').querySelectorAll('[data-cc]').forEach(b => b.onclick = () => abrirPais(b.dataset.cc));
    $('bsPaises').querySelectorAll('[data-iata]').forEach(b => b.onclick = () => elegirCiudad(b.dataset.iata, b.dataset.pais));
  }
  const filaPais = p => `<button type="button" class="pfila" data-cc="${p.cc}"><span class="cod">${p.cc}</span>${esc(p.nombre)}<span class="mas">${p.n} ${p.n === 1 ? 'aeropuerto' : 'aeropuertos'}</span></button>`;
  const filaCiudad = (a, cc, conPais) => `<button type="button" class="pfila" data-iata="${a[0]}" data-pais="${cc}"><span class="iata">${a[0]}</span><span class="t2">${esc(a[1])}${conPais ? ' · ' + esc(nomPais(cc)) : ''}<small>${esc(a[2])}</small></span></button>`;
  $('bsFiltro').addEventListener('input', e => pintarPaises(e.target.value));

  function abrirPais(cc) {
    $('bsPaisNom').textContent = nomPais(cc);
    const L = AEROS[cc] || [];
    $('bsPaisInfo').textContent = `${L.length} ${L.length === 1 ? 'aeropuerto' : 'aeropuertos'} con vuelos comerciales`;
    const grandes = L.filter(a => a[3]), otros = L.filter(a => !a[3]);
    $('bsCiudades').innerHTML = (grandes.length ? `<div class="letra" style="padding:12px 16px 2px">PRINCIPALES</div>${grandes.map(a => filaCiudad(a, cc)).join('')}` : '') +
      (otros.length ? `<div class="letra" style="padding:12px 16px 2px">OTROS</div>${otros.map(a => filaCiudad(a, cc)).join('')}` : '');
    $('bsCiudades').querySelectorAll('[data-iata]').forEach(b => b.onclick = () => elegirCiudad(b.dataset.iata, cc));
    ver('ciudad');
  }
  function elegirCiudad(iata, cc) {
    if (ELIGIENDO === 'destino' && iata === ORI().iata) { alertaMismo(); return; }
    if (ELIGIENDO === 'origen' && B.destino && iata === B.destino.iata) { alertaMismo(); return; }
    const a = (AEROS[cc] || []).find(x => x[0] === iata);
    const lugar = { iata, ciudad: a ? a[1] : iata, aeropuerto: a ? a[2] : '', pais: nomPais(cc), cc };
    if (ELIGIENDO === 'origen') { B.origen = lugar; guardar(); ver('home'); return; }
    B.destino = lugar;
    guardar();
    ver(B.ida ? 'home' : 'fechas'); if (!B.ida) pintarMeses();
  }

  function alertaMismo() { const e = document.createElement('div'); e.className = 'hero'; e.innerHTML = '<p>El origen y el destino no pueden ser el mismo aeropuerto.</p>'; const v = $('bs-ciudad').hidden ? $('bs-pais') : $('bs-ciudad'); v.prepend(e); setTimeout(() => e.remove(), 2500); }

  // ---------- fechas (como LATAM: se toca la ida y luego la vuelta)
  function pintarMeses() {
    const hoy = hoyIso(), base = D(hoy);
    let html = '';
    for (let k = 0; k < 13; k++) {
      const y = base.getUTCFullYear(), m = base.getUTCMonth() + k;
      const p = new Date(Date.UTC(y, m, 1, 12)), total = new Date(Date.UTC(y, m + 1, 0, 12)).getUTCDate();
      const lead = (p.getUTCDay() + 6) % 7;
      let dias = '';
      for (let i = 0; i < lead; i++) dias += '<span></span>';
      for (let n = 1; n <= total; n++) {
        const s = iso(new Date(Date.UTC(p.getUTCFullYear(), p.getUTCMonth(), n, 12)));
        let c = 'dia';
        if (B.modo === 'ow' && s === B.ida) c += ' solo';
        else {
          if (s === B.ida) c += ' ini';
          if (s === B.vuelta) c += ' fin';
          if (B.ida && B.vuelta && s > B.ida && s < B.vuelta) c += ' in';
          if (s === B.ida && !B.vuelta) c += ' fin';
        }
        if (s === hoy) c += ' hoy';
        dias += `<button type="button" class="${c}" data-d="${s}" ${s < hoy ? 'disabled' : ''} aria-label="${n} de ${MESES[p.getUTCMonth()]}">${n}</button>`;
      }
      html += `<div class="mesbox"><div class="mes">${MESES[p.getUTCMonth()][0].toUpperCase() + MESES[p.getUTCMonth()].slice(1)} ${p.getUTCFullYear()}</div><div class="dias"><span class="dow">L</span><span class="dow">M</span><span class="dow">M</span><span class="dow">J</span><span class="dow">V</span><span class="dow">S</span><span class="dow">D</span>${dias}</div></div>`;
    }
    $('bsMeses').innerHTML = html;
    $('bsMeses').querySelectorAll('[data-d]').forEach(b => b.onclick = () => tocarDia(b.dataset.d));
    $('bsIdaTxt').textContent = B.ida ? fCorta(B.ida) : 'Elige';
    $('bsVueltaTxt').textContent = B.modo === 'ow' ? '—' : (B.vuelta ? fCorta(B.vuelta) : 'Elige');
    $('bsCajaIda').classList.toggle('activa', !B.ida || B.modo === 'ow' || !!B.vuelta);
    $('bsCajaVuelta').classList.toggle('activa', B.modo === 'rt' && !!B.ida && !B.vuelta);
    $('bsCajaVuelta').style.opacity = B.modo === 'ow' ? .5 : 1;
    const listo = B.ida && (B.modo === 'ow' || B.vuelta);
    $('bsPieFechas').hidden = !$('bs-fechas').hidden ? !B.ida : true;
    $('bsFechasOk').disabled = !listo;
    if (B.modo === 'ow') { $('bsNoches').textContent = B.ida ? fCorta(B.ida) : ''; $('bsNochesNota').textContent = 'Solo ida'; }
    else if (B.vuelta) {
      const wi = D(B.ida).getUTCDay(), wv = D(B.vuelta).getUTCDay();
      $('bsNoches').textContent = `${noches()} ${noches() === 1 ? 'noche' : 'noches'}`;
      $('bsNochesNota').textContent = (wi === 5 || wv === 0) ? 'Ojo: viernes o domingo suelen ser más caros y llenos' : ([2, 3].includes(wi) ? 'Sale martes o miércoles: suele ser más barato' : 'Te mostraré también ±3 días');
    } else { $('bsNoches').textContent = 'Ahora toca la vuelta'; $('bsNochesNota').textContent = 'Ida: ' + fCorta(B.ida); }
  }
  function tocarDia(s) {
    if (B.modo === 'ow') B.ida = s;
    else if (!B.ida || B.vuelta || s <= B.ida) { B.ida = s; B.vuelta = null; }
    else B.vuelta = s;
    guardar(); pintarMeses();
  }
  $('bsFechasOk').onclick = () => ver('home');

  // ---------- personas
  function pintarPersonas() {
    $('bsA').textContent = B.a; $('bsN').textContent = B.n; $('bsB').textContent = B.b;
    document.querySelectorAll('#bs-personas [data-p]').forEach(b => {
      const k = b.dataset.p, d = +b.dataset.d, v = B[k] + d;
      b.disabled = (k === 'a' ? v < 1 : v < 0) || B.a + B.n + d > 9 && d > 0 && k !== 'b' || (k === 'b' && d > 0 && B.b >= B.a) || (k === 'a' && d < 0 && B.b > v);
    });
    $('bsClase').querySelectorAll('button').forEach(b => b.setAttribute('aria-pressed', b.dataset.c === B.clase));
  }
  document.querySelectorAll('#bs-personas [data-p]').forEach(b => b.onclick = () => { B[b.dataset.p] += +b.dataset.d; guardar(); pintarPersonas(); pintarHome(); });
  $('bsClase').querySelectorAll('button').forEach(b => b.onclick = () => { B.clase = b.dataset.c; guardar(); pintarPersonas(); pintarHome(); });

  // ---------- costos aparte por escala o destino (pasaporte chileno)
  const UE = ['AT', 'BE', 'BG', 'HR', 'CY', 'CZ', 'DK', 'EE', 'FI', 'FR', 'DE', 'GR', 'HU', 'IS', 'IT', 'LV', 'LI', 'LT', 'LU', 'MT', 'NL', 'NO', 'PL', 'PT', 'RO', 'SK', 'SI', 'ES', 'SE', 'CH'];
  function extras(v, destinoCC) {
    const P = B.a + B.n + B.b, out = [];
    const escalas = (v.escalas || []).map(x => ({ iata: x, cc: PAIS_DE[x] })).filter(x => x.cc && x.cc !== 'CL');
    const ccs = new Set(escalas.map(x => x.cc));
    const enEscala = cc => ccs.has(cc), alDestino = cc => destinoCC === cc;
    if (enEscala('US') && !alDestino('US')) out.push(['ojo', `Escala en EE.UU.: cada pasajero necesita ESTA (US$ 40 por persona, en esta.cbp.dhs.gov). Para ${P}: US$ ${40 * P}, se paga aparte.`]);
    if (enEscala('CA') && !alDestino('CA')) out.push(['ojo', `Escala en Canadá: cada pasajero necesita eTA (CAD 7 por persona, en canada.ca). Para ${P}: CAD ${7 * P}, se paga aparte.`]);
    if (enEscala('GB') && !alDestino('GB')) out.push(['ojo', `Escala en Reino Unido: si solo haces conexión sin salir del aeropuerto, confirma con la aerolínea si piden ETA (£16 por persona).`]);
    if (v.cambioAeropuerto) out.push(['ojo', 'La escala tiene cambio de aeropuerto: el traslado corre por tu cuenta y puede requerir pasar migración.']);
    const largas = (v.escalaTexto || '').match(/(\d+) h/);
    if (largas && +largas[1] >= 8) out.push(['ojo', `Escala larga (${largas[1]} h): revisa si necesitas hotel o permiso para salir del aeropuerto.`]);
    if (!out.some(x => x[0] === 'ojo')) out.unshift(['ok', v.directo ? 'Vuelo directo: sin costos extra por escala.' : `Escala${escalas.length ? ' en ' + escalas.map(x => x.iata).join(', ') : ''}: sin costos extra conocidos para pasajeros chilenos.`]);
    return out;
  }

  function notasDestino(cc) {
    const P = B.a + B.n + B.b, n = [];
    if (cc === 'US') n.push(`Para entrar a EE.UU. cada pasajero necesita ESTA: US$ 40 por persona (US$ ${40 * P} para ${P}), se paga aparte en esta.cbp.dhs.gov.`);
    if (cc === 'CA') n.push(`Para entrar a Canadá cada pasajero necesita eTA: CAD 7 por persona (CAD ${7 * P} para ${P}), se paga aparte en canada.ca.`);
    if (cc === 'GB') n.push(`Para entrar al Reino Unido cada pasajero necesita ETA: £16 por persona (£${16 * P} para ${P}), se paga aparte en gov.uk.`);
    if (UE.includes(cc)) n.push('Europa (Schengen): está anunciado el permiso ETIAS (€20 por persona) para chilenos. Revisa si ya está vigente antes de viajar.');
    return n;
  }

  // ---------- búsqueda y resultados
  async function buscar() {
    if (!conf.url || !conf.key) { $('bsMsg').textContent = 'Primero configura la conexión en Ajustes (⚙︎).'; return; }
    const q = { origen: ORI().iata, destino: B.destino.iata, ida: B.ida, vuelta: B.modo === 'rt' ? B.vuelta : '', clase: B.clase };
    ver('res');
    $('bsResRuta').textContent = `${ORI().iata} → ${B.destino.iata} · ${B.destino.ciudad}`;
    $('bsResInfo').textContent = `${fCorta(B.ida)}${q.vuelta ? ' – ' + fCorta(q.vuelta) + ' · ' + noches() + ' noches' : ' · solo ida'} · ${txtPersonas()}`;
    $('bsResCuerpo').innerHTML = `<div class="cargando glass" style="border-radius:24px"><svg class="avion" viewBox="0 0 24 24" fill="#ffc98b" aria-hidden="true"><path d="M21 16v-2l-8-5V3.5a1.5 1.5 0 0 0-3 0V9l-8 5v2l8-2.5V19l-2 1.5V22l3.5-1 3.5 1v-1.5L13 19v-5.5z"/></svg><b>Buscando en todas las aerolíneas…</b><span class="gfoot">Reviso tu fecha y 3 días antes y después. Tarda unos 20 segundos.</span></div>`;
    if (!AEROS) { try { AEROS = await (await fetch('aeropuertos.json')).json(); Object.keys(AEROS).forEach(cc => AEROS[cc].forEach(a => PAIS_DE[a[0]] = cc)); } catch (e) {} }
    try {
      const u = conf.url + (conf.url.includes('?') ? '&' : '?') + 'clave=' + encodeURIComponent(conf.key) + '&accion=buscar&flex=3&' + new URLSearchParams(q).toString();
      const j = await (await fetch(u)).json();
      if (!j.ok) throw new Error(j.error === 'clave' ? 'clave incorrecta' : (j.error || 'sin respuesta'));
      RES = j; FILTRO = 'todos';
      SEL = Math.max(0, RES.fechas.findIndex(f => f.ida === B.ida));
      const conPrecio = RES.fechas.filter(f => f.min);
      // guardar en recientes
      const min = conPrecio.length ? Math.min(...conPrecio.map(f => f.min)) : null;
      const L = recientes().filter(r => !(r.destino.iata === B.destino.iata && (r.origen || ORI()).iata === ORI().iata && r.ida === B.ida && (r.vuelta || '') === (q.vuelta || '')));
      L.unshift({ origen: ORI(), destino: B.destino, ida: B.ida, vuelta: q.vuelta, min });
      try { localStorage.setItem('recientes', JSON.stringify(L.slice(0, 8))); } catch (e) {}
      pintarRes();
    } catch (err) {
      $('bsResCuerpo').innerHTML = `<div class="hero"><span class="k">No se pudo buscar</span><p>${esc(err.message)}. Revisa tu conexión e inténtalo de nuevo.</p></div><button type="button" class="btn" id="bsReintentar">Reintentar</button>`;
      $('bsReintentar').onclick = buscar;
    }
  }

  function pintarRes() {
    const P = B.a + B.n, F = RES.fechas, f = F[SEL];
    const precios = F.filter(x => x.min).map(x => x.min);
    const mn = Math.min(...precios), mx = Math.max(...precios);
    const barras = F.map((x, i) => {
      const d = D(x.ida), alto = x.min ? 30 + Math.round((x.min - mn) / ((mx - mn) || 1) * 56) : 10;
      return `<button type="button" class="bdia ${i === SEL ? 'sel' : ''} ${x.min === mn ? 'barato' : ''}" data-i="${i}" aria-label="Salida ${fCorta(x.ida)}${x.min ? ', desde ' + CLP(x.min) : ', sin vuelos'}">
        <span class="bar" style="height:${alto}px;${x.min ? '' : 'opacity:.3'}"></span><span class="p">${x.min ? '$' + Math.round(x.min / 1000) + 'k' : '—'}</span><span class="n">${d.getUTCDate()}</span><span class="w">${DOW[d.getUTCDay()]}</span></button>`;
    }).join('');
    let vuelos = (f.vuelos || []).slice();
    if (FILTRO === 'directos') vuelos = vuelos.filter(v => v.directo);
    if (FILTRO === 'sinextra') vuelos = vuelos.filter(v => !extras(v, B.destino.cc).some(x => x[0] === 'ojo'));
    if (FILTRO === 'rapido') vuelos.sort((a, b) => minutos(a.duracion) - minutos(b.duracion));
    const masRapido = (f.vuelos || []).filter(v => v.directo).sort((a, b) => a.precio - b.precio)[0];
    const bebeTxt = B.b ? ` + ${B.b} ${B.b === 1 ? 'bebé' : 'bebés'} (cobro de bebé en brazos: lo confirma la aerolínea al comprar, suele ser cerca del 10% de la tarifa más tasas)` : '';
    $('bsResCuerpo').innerHTML = `
      <div class="glass" style="border-radius:24px;padding:14px 8px 8px">
        <div style="display:flex;justify-content:space-between;padding:0 10px 8px"><b>Precio por día de salida</b><span class="gfoot" style="padding:0">por persona${RES.vuelta ? ', ida y vuelta' : ''}</span></div>
        <div class="barras" id="bsBarras">${barras}</div>
        <div class="gfoot" style="padding:8px 10px 2px">Verde = más barato. ${RES.vuelta ? `La vuelta es siempre ${noches()} noches después.` : ''} ${RES.desdeMemoria ? 'Búsqueda de hace menos de 30 min (no se repitió).' : ''}</div>
      </div>
      ${f.aviso ? `<div class="hero" style="border-color:rgba(125,240,176,.6)"><p>📈 <b>Google Flights:</b> ${esc(f.aviso.replace(/CLP\s?([\d,]+)/, (m, n) => CLP(+n.replace(/,/g, ''))))}</p></div>` : ''}
      ${notasDestino(B.destino.cc).map(t => `<div class="hero" style="border-color:rgba(255,210,122,.6)"><span class="k" style="color:var(--warn)">Costo aparte del destino</span><p>${esc(t)}</p></div>`).join('')}
      <div class="chips" id="bsFiltros">
        ${[['todos', 'Todos'], ['directos', 'Directos'], ['sinextra', 'Sin costos extra'], ['rapido', 'Más rápido']].map(([k, t]) => `<button type="button" data-f="${k}" aria-pressed="${FILTRO === k}">${t}</button>`).join('')}
      </div>
      <div class="gfoot">${fCorta(f.ida)}${f.vuelta ? ' – ' + fCorta(f.vuelta) : ''} · ${vuelos.length} vuelos · <b style="color:#fff">total final para ${P} ${P === 1 ? 'persona' : 'personas'}</b>, con tasas e impuestos${bebeTxt}.</div>
      ${vuelos.length ? vuelos.map((v, i) => tarjeta(v, i === 0 && FILTRO === 'todos', v === masRapido, P) + (/latam/i.test(v.aerolinea) ? bloqueMillas(v, f, i) : '')).join('') : '<div class="empty glass" style="border-radius:24px">No hay vuelos con este filtro para esta fecha.</div>'}
      ${f.link ? `<a class="btn plain" href="${esc(f.link)}" target="_blank" rel="noopener noreferrer">Ver en Google Flights</a>` : ''}
      <div class="gfoot">Precios de Google Flights para 1 adulto multiplicados por ${P}, con tasas de embarque e impuestos obligatorios. Google muestra el precio más bajo publicado; a veces viene de una agencia. Por eso el botón te lleva siempre al <b>sitio oficial de la aerolínea</b>, sin intermediarios ni comisiones: ahí confirmas el precio final antes de pagar. En Google Flights, elige siempre la opción "Reservar con la aerolínea".</div>`;
    $('bsBarras').querySelectorAll('[data-i]').forEach(b => b.onclick = () => { SEL = +b.dataset.i; pintarRes(); });
    $('bsResCuerpo').querySelectorAll('[data-millas]').forEach(inp => inp.addEventListener('input', () => {
      const m = +inp.value, precio = +inp.dataset.precio;
      const out = $('bsResCuerpo').querySelector('[data-millas-out="' + inp.dataset.millas + '"]');
      if (!m) { out.textContent = 'Escribe las millas que te pide LATAM por persona.'; return; }
      const valor = precio / m;
      const veredicto = valor >= 10 ? '<b style="color:var(--ok)">Conviene usar millas.</b>'
        : valor >= 6 ? '<b style="color:var(--warn)">Da casi lo mismo: compara las tasas que cobra el canje.</b>'
        : '<b style="color:var(--bad)">Conviene pagar en dinero y guardar las millas.</b>';
      out.innerHTML = `Cada milla vale <b>${CLP(valor)}</b> en este vuelo (${CLP(precio)} ÷ ${m.toLocaleString('es-CL')} millas). ${veredicto} En el canje igual se pagan tasas en dinero.`;
    }));
    $('bsFiltros').querySelectorAll('[data-f]').forEach(b => b.onclick = () => { FILTRO = b.dataset.f; pintarRes(); });
  }
  // Sitios oficiales: para comprar sin agencias ni comisiones.
  const OFICIAL = [['LATAM','https://www.latamairlines.com/cl/es'],['Iberia','https://www.iberia.com/cl/'],['Air Canada','https://www.aircanada.com/cl/es/'],['Avianca','https://www.avianca.com/cl/es/'],
    ['American','https://www.aa.com/homePage.do?locale=es_CL'],['Delta','https://es.delta.com/'],['United','https://www.united.com/es/cl/'],['Copa','https://www.copaair.com/es-cl/'],
    ['Aerolíneas Argentinas','https://www.aerolineas.com.ar/'],['British Airways','https://www.britishairways.com/'],['Air France','https://wwws.airfrance.cl/'],['KLM','https://www.klm.cl/'],
    ['LEVEL','https://www.flylevel.com/'],['SKY','https://www.skyairline.com/es/chile'],['JetSMART','https://jetsmart.com/cl/es/'],['Air Europa','https://www.aireuropa.com/cl/es/'],
    ['Aeroméxico','https://aeromexico.com/es-cl'],['GOL','https://www.voegol.com.br/es'],['Azul','https://www.voeazul.com.br/'],['TAP','https://www.flytap.com/es-cl/'],
    ['Lufthansa','https://www.lufthansa.com/cl/es/'],['Turkish','https://www.turkishairlines.com/es-cl/'],['Emirates','https://www.emirates.com/cl/spanish/'],['Qatar','https://www.qatarairways.com/es-cl/'],
    ['Swiss','https://www.swiss.com/cl/es'],['ITA','https://www.ita-airways.com/es_cl'],['Qantas','https://www.qantas.com/'],['Air New Zealand','https://www.airnewzealand.com/'],['Arajet','https://www.arajet.com/es']];
  function oficial(aer) { const p = (aer || '').replace(/Jet · SMART/g, 'JetSMART').split(/[·,]/)[0].trim().toLowerCase(); const o = OFICIAL.find(([n]) => p.startsWith(n.toLowerCase())); return o ? { nombre: o[0], url: o[1] } : null; }
  // Millas LATAM Pass: LATAM solo muestra millas con la cuenta iniciada, así que abrimos su búsqueda de canje ya rellenada.
  function linkMillas(f) {
    const p = new URLSearchParams({ origin: ORI().iata, outbound: f.ida + 'T15:00:00.000Z', destination: B.destino.iata, adt: B.a, chd: B.n, inf: B.b,
      trip: f.vuelta ? 'RT' : 'OW', cabin: B.clase === 'ejecutiva' ? 'Business' : B.clase === 'premium' ? 'Premium Economy' : 'Economy', redemption: 'true', sort: 'RECOMMENDED' });
    if (f.vuelta) p.set('inbound', f.vuelta + 'T15:00:00.000Z');
    return 'https://www.latamairlines.com/cl/es/ofertas-vuelos?' + p.toString();
  }
  function bloqueMillas(v, f, i) {
    return `<div class="glass" style="border-radius:16px;padding:12px 14px;display:grid;gap:8px;border-color:rgba(255,201,139,.5);margin-top:-8px">
      <div style="font-size:13px;font-weight:800;color:var(--tint)">Millas LATAM Pass</div>
      <a class="btn plain" style="padding:10px;font-size:14px" href="${linkMillas(f)}" target="_blank" rel="noopener noreferrer">Ver precio en millas ↗</a>
      <label style="display:flex;align-items:center;gap:10px;font-size:13px;color:var(--label2)">Millas por persona
        <input type="number" inputmode="numeric" data-millas="${i}" data-precio="${v.precio}" placeholder="ej. 60000" style="flex:1;min-width:0;background:rgba(255,255,255,.12);border:1px solid var(--line);border-radius:10px;color:#fff;padding:8px;font:700 15px var(--font)"></label>
      <div class="gfoot" style="padding:0" data-millas-out="${i}">LATAM muestra las millas solo cuando ingresas con tu cuenta. Escribe aquí lo que te pida y te digo si conviene.</div>
    </div>`;
  }
  function minutos(s) { const h = (s.match(/(\d+) h/) || [])[1] || 0, m = (s.match(/(\d+) min/) || [])[1] || 0; return h * 60 + +m; }
  function tarjeta(v, mejor, rapido, P) {
    const ex = extras(v, B.destino.cc);
    const etiqueta = mejor ? '<span class="badge b-blue" style="margin:0;background:var(--tint);color:var(--tintInk)">Más barato</span>'
      : rapido ? '<span class="badge b-green" style="margin:0">Directo · mejor precio</span>'
      : `<span class="gfoot" style="padding:0">${esc(v.directo ? 'Directo' : v.paradas)}</span>`;
    return `<div class="vcard glass ${mejor ? 'mejor' : ''}">
      <div class="top">${etiqueta}<span class="aer">${esc(v.aerolinea)}</span></div>
      <div class="leg"><div><div class="t">${esc(v.sale)}</div><div class="c">${esc(ORI().iata)}</div></div>
        <div class="mid">${esc(v.duracion)}<span class="rule"></span>${esc(v.directo ? 'Directo' : (v.paradas + (v.escalaTexto ? ' · ' + v.escalaTexto : '')))}</div>
        <div style="text-align:right"><div class="t">${esc(v.llega)}${v.masDias ? `<sup style="font-size:11px">+${v.masDias}</sup>` : ''}</div><div class="c">${esc(B.destino.iata)}</div></div></div>
      ${ex.map(([k, t]) => `<div class="extra ${k === 'ok' ? 'ok' : 'ojo'}"><span>${k === 'ok' ? '✓' : k === 'info' ? 'ℹ' : '⚠'}</span><span>${esc(t)}</span></div>`).join('')}
      <div class="vprecio"><span class="pp">${CLP(v.precio)} por persona<br>tasas incluidas · equipaje según tarifa</span><span class="tot"><b>${CLP(v.precio * P)}</b><span>total ${P} ${P === 1 ? 'persona' : 'personas'}</span></span></div>
      ${(o => o ? `<a class="btn plain" style="padding:11px;font-size:15px" href="${o.url}" target="_blank" rel="noopener noreferrer">Comprar directo en ${esc(o.nombre)} ↗</a>` : '')(oficial(v.aerolinea))}
    </div>`;
  }

  // El asistente elige la fecha y trae al usuario aquí para ver los vuelos y comprar.
  window.vuelosIrABuscar = p => {
    Object.assign(B, { origen: p.origen, destino: p.destino, ida: p.ida, vuelta: p.vuelta || null, modo: p.modo, a: p.a, n: p.n, b: p.b, clase: p.clase });
    guardar();
    const btn = document.querySelector('.tabbar button[data-v="buscar"]'); if (btn) btn.click();
    pintarHome(); buscar();
  };
  $('bsBanner').onclick = () => window.vuelosPedirAlAsistente && window.vuelosPedirAlAsistente();
  pintarHome();
})();
