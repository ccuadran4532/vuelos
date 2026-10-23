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
  let B = { maleta: 'no', modo: 'rt', origen: { iata: 'SCL', ciudad: 'Santiago', aeropuerto: 'Arturo Merino Benítez', pais: 'Chile', cc: 'CL' }, destino: null, ida: null, vuelta: null, a: 2, n: 0, b: 0, clase: 'turista' };
  try { Object.assign(B, JSON.parse(localStorage.getItem('busqueda') || '{}')); } catch (e) {}
  if (B.ida && B.ida < hoyIso()) { B.ida = null; B.vuelta = null; }
  const guardar = () => { try { localStorage.setItem('busqueda', JSON.stringify(B)); } catch (e) {} };
  let AEROS = null, PAISES = [], PAIS_DE = {}, RES = null, SEL = 0, FILTRO = 'todos', FRANJA = 'todas', ELIGIENDO = 'destino';
  const ORI = () => B.origen || { iata: 'SCL', ciudad: 'Santiago', pais: 'Chile', cc: 'CL' };

  // ---------- pantallas internas
  const PANT = ['home', 'pais', 'ciudad', 'fechas', 'personas', 'res'];
  function ver(p) {
    PANT.forEach(x => $('bs-' + x).hidden = x !== p);
    $('bs-explorar').hidden = p !== 'explorar';
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
    return p.join(', ') + ' · ' + { turista: 'Turista', premium: 'Premium', ejecutiva: 'Ejecutiva' }[B.clase] + (B.maleta === 'mano' ? ' · maleta de mano' : B.maleta === 'bodega' ? ' · maleta en bodega' : '');
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
    $('bsBuscar').disabled = false;
    $('bsMsg').textContent = listo ? '' : (!B.destino ? 'Falta elegir el destino.' : 'Faltan las fechas: toca Buscar y te abro el calendario.');
    pintarRecientes();
  }
  function cambiarModo(m) { B.modo = m; if (m === 'ow') B.vuelta = null; guardar(); pintarHome(); pintarMeses(); }
  ['bsModo', 'bsModo2'].forEach(id => $(id).querySelectorAll('button').forEach(b => b.onclick = () => cambiarModo(b.dataset.m)));
  $('bsDestino').onclick = () => { ELIGIENDO = 'destino'; $('bsPaisTitulo').textContent = '¿A qué país?'; ver('pais'); cargarPaises(); };
  $('bsOrigen').onclick = () => { ELIGIENDO = 'origen'; $('bsPaisTitulo').textContent = '¿Desde qué país?'; ver('pais'); cargarPaises(); };
  $('bsInvertir').onclick = () => { if (!B.destino) return; const o = ORI(); B.origen = B.destino; B.destino = o; guardar(); pintarHome(); };
  $('bsFechas').onclick = () => { ver('fechas'); pintarMeses(); };
  $('bsPersonas').onclick = () => { ver('personas'); pintarPersonas(); };
  // Si falta algo, el botón lleva directo a completarlo (antes quedaba apagado y parecía que no hacía nada).
  $('bsBuscar').onclick = () => {
    if (!B.destino) { $('bsDestino').click(); return; }
    if (!B.ida || (B.modo === 'rt' && !B.vuelta)) { $('bsFechas').click(); return; }
    buscar();
  };

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
    if (!conf.url || !conf.key) { $('gearBtn').click(); $('cfgMsg').innerHTML = '<span class="err">Falta tu clave: escríbela aquí una vez (está en tu PC, en Vuelos-App\privado\CLAVE.txt) y toca Guardar y probar.</span>'; return; }
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
      RES = j; FILTRO = 'todos'; FRANJA = 'todas';
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
    const hora = v => +String(v.sale).slice(0, 2);
    const FR = { manana: h => h >= 5 && h < 12, tarde: h => h >= 12 && h < 19, noche: h => h >= 19 || h < 5 };
    if (FRANJA !== 'todas') vuelos = vuelos.filter(v => FR[FRANJA](hora(v)));
    if (FILTRO === 'rapido') vuelos.sort((a, b) => minutos(a.duracion) - minutos(b.duracion));
    const masRapido = (f.vuelos || []).filter(v => v.directo).sort((a, b) => a.precio - b.precio)[0];
    const bebeTxt = B.b ? ` + ${B.b} ${B.b === 1 ? 'bebé' : 'bebés'} (cobro de bebé en brazos: lo confirma la aerolínea al comprar, suele ser cerca del 10% de la tarifa más tasas)` : '';
    $('bsResCuerpo').innerHTML = `
      <div class="glass" style="border-radius:24px;padding:14px 8px 8px">
        <div style="display:flex;justify-content:space-between;padding:0 10px 8px"><b>Precio por día de salida</b><span class="gfoot" style="padding:0">por persona${RES.vuelta ? ', ida y vuelta' : ''}</span></div>
        <div class="barras" id="bsBarras">${barras}</div>
        <div class="gfoot" style="padding:8px 10px 2px">Verde = más barato. ${RES.vuelta ? `La vuelta es siempre ${noches()} noches después.` : ''} ${RES.desdeMemoria ? 'Búsqueda de hace menos de 30 min (no se repitió).' : ''}</div>
      </div>
      ${dosIdasCard(f, P)}
      ${consejo(f)}
      ${grafico(f, P)}
      ${comparacionKayak(f, P)}
      ${f.aviso ? `<div class="hero" style="border-color:rgba(125,240,176,.6)"><p>📈 <b>Google Flights:</b> ${esc(f.aviso.replace(/CLP\s?([\d,]+)/, (m, n) => CLP(+n.replace(/,/g, ''))))}</p></div>` : ''}
      ${notasDestino(B.destino.cc).map(t => `<div class="hero" style="border-color:rgba(255,210,122,.6)"><span class="k" style="color:var(--warn)">Costo aparte del destino</span><p>${esc(t)}</p></div>`).join('')}
      <div class="chips" id="bsFiltros">
        ${[['todos', 'Todos'], ['directos', 'Directos'], ['sinextra', 'Sin costos extra'], ['rapido', 'Más rápido']].map(([k, t]) => `<button type="button" data-f="${k}" aria-pressed="${FILTRO === k}">${t}</button>`).join('')}
      </div>
      <div class="chips" id="bsFranjas" aria-label="Hora de salida">
        ${[['todas', 'Cualquier hora'], ['manana', '🌅 Mañana 5–12'], ['tarde', '☀️ Tarde 12–19'], ['noche', '🌙 Noche 19–5']].map(([k, t]) => `<button type="button" data-fr="${k}" aria-pressed="${FRANJA === k}">${t}</button>`).join('')}
      </div>
      <div class="gfoot">${fCorta(f.ida)}${f.vuelta ? ' – ' + fCorta(f.vuelta) : ''} · ${vuelos.length} ${vuelos.length === 1 ? "vuelo" : "vuelos"} · <b style="color:#fff">total final para ${P} ${P === 1 ? 'persona' : 'personas'}</b>, con tasas e impuestos${bebeTxt}.</div>
      ${vuelos.length ? vuelos.map((v, i) => tarjeta(v, i === 0 && FILTRO === 'todos', v === masRapido, P) + (/latam/i.test(v.aerolinea) ? bloqueMillas(v, f, i) : '')).join('') : '<div class="empty glass" style="border-radius:24px">No hay vuelos con estos filtros para esta fecha. Prueba otra hora u otro día en las barras de arriba.</div>'}
      ${f.link ? `<a class="btn plain" href="${esc(f.link)}" target="_blank" rel="noopener noreferrer">Ver en Google Flights</a>` : ''}
      ${agencias(f)}
      <div class="gfoot">Precios de Google Flights para 1 adulto multiplicados por ${P}, con tasas de embarque e impuestos obligatorios. Google muestra el precio más bajo publicado; a veces viene de una agencia. Por eso el botón te lleva siempre al <b>sitio oficial de la aerolínea</b>, sin intermediarios ni comisiones: ahí confirmas el precio final antes de pagar. En Google Flights, elige siempre la opción "Reservar con la aerolínea".</div>`;
    if ($('bsSeguir')) $('bsSeguir').onclick = () => seguir(f);
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
    $('bsFranjas').querySelectorAll('[data-fr]').forEach(b => b.onclick = () => { FRANJA = b.dataset.fr; pintarRes(); });
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
  // ---------- qué incluye cada tarifa (fuentes oficiales; donde no hay dato confirmado, se dice)
  const SUDAMERICA = ['AR', 'BO', 'BR', 'CL', 'CO', 'EC', 'GY', 'PY', 'PE', 'SR', 'UY', 'VE'];
  const S = 'Sí', N = 'No', P = 'Se paga aparte';
  const GUIA = {
    LATAM: dest => ({
      cols: SUDAMERICA.includes(dest) && dest !== 'BR' ? ['Basic', 'Light', 'Standard', 'Full'] : ['Light', 'Standard', 'Full'],
      filas: SUDAMERICA.includes(dest) && dest !== 'BR'
        ? [['Bolso bajo el asiento', S, S, S, S], ['Equipaje de mano 12 kg', P, S, S, S], ['Maleta en bodega 23 kg', P, P, S, S], ['Elegir asiento', P, P, P, 'Sí (estándar)']]
        : [['Bolso bajo el asiento', S, S, S], ['Equipaje de mano 12 kg', S, S, S], ['Maleta en bodega 23 kg', P, '1 pieza', '1 pieza'], ['Elegir asiento', P, P, 'Sí (estándar)']],
      nota: SUDAMERICA.includes(dest) && dest !== 'BR' ? 'Dentro de Sudamérica la tarifa más barata (Basic) no trae equipaje de mano: confírmalo en la pantalla de tarifas.' : 'Tabla oficial de LATAM para vuelos fuera de Sudamérica. Premium Economy y Business traen mano de 16 kg y bodega incluida.',
      fuente: 'latamairlines.com, centro de ayuda (tarifas internacionales)'
    }),
    SKY: () => ({
      cols: ['Basic', 'Light', 'Standard', 'Max', 'Max Flex'],
      filas: [['Bolso bajo el asiento (25×35×45)', S, S, S, S, S], ['Equipaje de mano 10 kg', N, S, N, S, S], ['Maleta en bodega 23 kg', N, N, S, S, S], ['Asiento estándar', N, N, S, S, S], ['Cambios y devolución', N, N, N, N, 'Sí, 100%']],
      nota: 'Ojo: Standard trae bodega pero NO equipaje de mano; Light es al revés.',
      fuente: 'tarifas SKY 2026 (skyairline.com), revisadas el 31 ago 2026'
    }),
    JetSMART: () => ({
      cols: ['Tarifa base', 'Agregar al comprar'],
      filas: [['Bolso o mochila chica (10 kg, 45×35×25)', S, '—'], ['Equipaje de mano', P, 'desde $12.900 por tramo'], ['Maleta en bodega', P, 'desde $13.000 por tramo'], ['Elegir asiento', P, 'según vuelo']],
      nota: 'Compra la maleta junto con el pasaje: en el aeropuerto cuesta más del doble.',
      fuente: 'jetsmart.com/cl/es/opcionales'
    }),
    Iberia: () => ({
      cols: ['Básica', 'Óptima', 'Confort', 'Flexible'],
      filas: [['Elegir asiento', P, 'Gratis 24 h antes', S, S], ['Maleta en bodega', 'Revisar al comprar', 'Revisar al comprar', S, S], ['Cambios', N, 'Con cargo', 'Con cargo', 'Sin límite + reembolso']],
      nota: 'Iberia recomienda Confort si llevas maleta: suele salir más barato que Básica + maleta.',
      fuente: 'iberia.com/clases-tarifas/turista'
    })
  };
  function guiaTarifa(aer, destCC) {
    const nombre = (aer || '').replace(/Jet · SMART/g, 'JetSMART').split(/[·,]/)[0].trim();
    const clave = Object.keys(GUIA).find(k => nombre.toLowerCase().startsWith(k.toLowerCase()));
    if (!clave) {
      return `<details class="guia"><summary>🧳 ¿Qué incluye? Maletas y asientos</summary><div class="gtxt">
        En la mayoría de las aerolíneas, la tarifa más barata ("Basic" o "Light") <b>no incluye maleta en bodega ni elegir asiento</b>, y las tarifas siguientes sí traen la maleta de 23 kg.
        Al comprar en ${esc(nombre || 'la aerolínea')}, mira la tabla de tarifas y compara: a veces la tarifa siguiente cuesta lo mismo que la básica más una maleta.</div></details>`;
    }
    const g = GUIA[clave](destCC);
    return `<details class="guia"><summary>🧳 ¿Qué incluye cada tarifa de ${clave}?</summary>
      <div class="tw"><table class="bag"><thead><tr><th></th>${g.cols.map(c => `<th>${c}</th>`).join('')}</tr></thead>
      <tbody>${g.filas.map(f => `<tr><td>${f[0]}</td>${f.slice(1).map(v => `<td class="${v === S || /^Sí|pieza|Gratis|Sin límite/.test(v) ? 'si' : v === N || v === P ? 'no' : ''}">${v}</td>`).join('')}</tr>`).join('')}</tbody></table></div>
      <div class="gtxt">${g.nota}<br><span style="color:var(--label3)">Fuente: ${g.fuente}. Confírmalo siempre en la pantalla de tarifas antes de pagar.</span></div></details>`;
  }
  // ---------- comparación con Kayak (segunda fuente)
  function tramoKayak(t, titulo) {
    if (!t) return '';
    const esc2 = t.escalas.length ? t.escalas.map((x, i) => x + (t.esperas[i] ? ' (' + t.esperas[i].replace('h ', ' h ').replace(/m$/, ' min') + ')' : '')).join(', ') : '';
    return `<div class="ktramo"><span class="kt">${titulo}</span><b>${esc(t.sale)} → ${esc(t.llega)}${t.masDias ? '<sup>+' + t.masDias + '</sup>' : ''}</b>
      <span>${esc(t.duracion || '')} · ${t.directo ? 'directo' : esc(t.paradas) + (esc2 ? ': ' + esc(esc2) : '')}</span></div>`;
  }
  function comparacionKayak(f, P) {
    const K = f.kayak;
    if (!RES.fechas.some(x => x.kayak)) return '';
    if (!K) return `<div class="gfoot">La comparación con Kayak se hace para la fecha que pediste (${fCorta(RES.ida)}). Toca esa barra para verla.</div>`;
    if (!K.ok) return `<div class="hero"><span class="k">Comparación con Kayak</span><p>Kayak no respondió esta vez. Puedes revisarlo a mano: <a class="tintlink" href="${esc(K.link)}" target="_blank" rel="noopener noreferrer">abrir Kayak ↗</a></p></div>`;
    const gmin = f.min || Infinity;
    const masBaratos = K.vuelos.filter(v => v.precio < gmin * 0.99);
    if (!masBaratos.length) {
      return `<div class="hero" style="border-color:rgba(125,240,176,.6)"><span class="k" style="color:var(--ok)">✓ Comparado con Kayak</span><p>Kayak no encontró nada más barato. Su precio más bajo es ${CLP(K.min)} por persona; aquí tienes ${CLP(gmin)}.</p></div>`;
    }
    const gmejor = (f.vuelos || [])[0];
    const gdur = gmejor ? minutos(gmejor.duracion) : 0;
    const tarjetas = masBaratos.slice(0, 3).map(v => {
      const dur = minutos(v.ida.duracion || '') + (v.vuelta ? minutos(v.vuelta.duracion || '') : 0);
      const ex = extras({ escalas: [...v.ida.escalas, ...(v.vuelta ? v.vuelta.escalas : [])], directo: v.ida.directo && (!v.vuelta || v.vuelta.directo), escalaTexto: [...v.ida.esperas, ...(v.vuelta ? v.vuelta.esperas : [])].join(' '), cambioAeropuerto: v.ida.cambioAeropuerto || (v.vuelta && v.vuelta.cambioAeropuerto) }, B.destino.cc);
      const masHoras = gdur && v.ida.duracion ? Math.round((minutos(v.ida.duracion) - gdur) / 60) : 0;
      return `<div class="kcard">
        <div class="top"><b>${esc(v.aerolinea)}</b><span class="aer">${esc(v.tarifa || '')}</span></div>
        ${tramoKayak(v.ida, 'Ida')}${tramoKayak(v.vuelta, 'Vuelta')}
        ${masHoras >= 2 ? `<div class="extra ojo"><span>⏱</span><span>La ida dura ${masHoras} h más que la opción más barata de Google.</span></div>` : ''}
        ${ex.filter(x => x[0] !== 'ok').map(([k, t]) => `<div class="extra ojo"><span>⚠</span><span>${esc(t)}</span></div>`).join('')}
        <div class="vprecio"><span class="pp">${CLP(v.precio)} por persona<br>${CLP(gmin - v.precio)} menos que aquí</span><span class="tot"><b>${CLP(v.precio * P)}</b><span>total ${P} ${P === 1 ? 'persona' : 'personas'}</span></span></div>
      </div>`;
    }).join('');
    return `<div class="hero" style="border-color:rgba(255,210,122,.65)"><span class="k" style="color:var(--warn)">Kayak encontró más barato</span>
      <p>Hasta <b>${CLP(gmin - masBaratos[0].precio)} menos por persona</b>. Antes de decidir, mira lo que cambia: más escalas u horas, y el precio puede venir de una agencia (con cargos o cambios más difíciles).</p></div>
      ${tarjetas}
      <a class="btn plain" href="${esc(K.link)}" target="_blank" rel="noopener noreferrer">Ver estas opciones en Kayak ↗</a>
      <div class="gfoot">En Kayak, antes de pagar, elige si puedes la opción que dice el nombre de la aerolínea (venta directa) y no una agencia.</div>`;
  }
  // ---------- agencias: botones con la búsqueda ya rellenada (bloquean la lectura automática)
  function agencias(f) {
    const o = ORI().iata, d = B.destino.iata, ida = f.ida, vta = f.vuelta, A = B.a, N = B.n, BB = B.b;
    const plataforma = dom => vta ? `https://www.${dom}/shop/flights/results/roundtrip/${o}/${d}/${ida}/${vta}/${A}/${N}/${BB}`
                                    : `https://www.${dom}/shop/flights/results/oneway/${o}/${d}/${ida}/${A}/${N}/${BB}`;
    const edreams = `https://www.edreams.com/travel/#results/type=${vta ? 'R' : 'O'};dep=${ida};from=${o};to=${d};${vta ? 'ret=' + vta + ';' : ''}collectionmethod=false;airlinescodes=false;internalSearch=true;adults=${A};children=${N};infants=${BB}`;
    const L = [
      ['Despegar', plataforma('despegar.cl'), 'búsqueda lista'],
      ['Viajes Falabella', plataforma('viajesfalabella.cl'), 'búsqueda lista'],
      ['eDreams', edreams, 'búsqueda lista · precios en euros'],
      ['Mytrip', 'https://cl.mytrip.com/', 'ingresa la ruta y fechas']
    ];
    return `<div class="group"><div class="ghead">Revisar también en agencias</div>
      <div class="agencias">${L.map(([n, u, t]) => `<a class="ag glass" href="${esc(u)}" target="_blank" rel="noopener noreferrer"><b>${n} ↗</b><small>${t}</small></a>`).join('')}</div>
      <div class="gfoot">Las agencias cobran cargo de gestión y bloquean la lectura automática, por eso se abren aparte. Compara su <b>total final</b> (con cargos) contra el de la aerolínea antes de pagar.</div></div>`;
  }
  // ---------- seguir precios y "¿compro o espero?"
  let SEGUIDOS = [];
  const idSeg = (f) => [ORI().iata, B.destino.iata, f.ida, f.vuelta || '', B.clase].join('_');
  function consejo(f) {
    const seg = SEGUIDOS.find(x => x.id === idSeg(f));
    const dias = Math.round((D(f.ida) - D(hoyIso())) / 864e5);
    let nivel, titulo, razon;
    if (seg && seg.recomendacion) ({ nivel, titulo, razon } = seg.recomendacion);
    else if (/bajos/i.test(f.aviso || '')) { nivel = 'comprar'; titulo = 'Buen momento para comprar'; razon = 'Google dice que el precio está más bajo de lo habitual para esta ruta.'; }
    else if (dias <= 21) { nivel = 'comprar'; titulo = 'Compra pronto'; razon = `Faltan ${dias} días: a esta altura los precios casi siempre suben.`; }
    else if (/altos/i.test(f.aviso || '')) { nivel = 'esperar'; titulo = 'Puedes esperar'; razon = 'Google dice que el precio está más alto de lo habitual. Síguelo y te aviso si baja.'; }
    else { nivel = 'esperar'; titulo = 'Precio normal'; razon = `Faltan ${dias} días. Síguelo y te aviso si baja; con unos días de historial te digo si conviene esperar.`; }
    const hist = seg && seg.hist && seg.hist.length > 1 ? `<div class="gfoot" style="padding:0">Historial: ${seg.hist.slice(-6).map(e => fCorta(e.f) + ' ' + CLP(e.p)).join(' · ')}</div>` : '';
    return `<div class="hero consejo ${nivel}"><span class="k">${nivel === 'comprar' ? '🟢' : '🟡'} ¿Compro ahora o espero?</span><p><b>${esc(titulo)}.</b> ${esc(razon)}</p>${hist}
      ${seg ? `<div class="gfoot" style="padding:0">🔔 Siguiendo este precio (se revisa a las 8:00 y 20:00).</div>` : `<button type="button" class="btn plain" id="bsSeguir" style="padding:11px;font-size:15px">🔔 Seguir este precio</button>`}</div>`;
  }
  async function seguir(f) {
    const btn = $('bsSeguir'); if (btn) { btn.disabled = true; btn.textContent = 'Guardando…'; }
    try {
      await enviar({ accion: 'seguir', busqueda: { origen: ORI().iata, destino: B.destino.iata, ciudad: B.destino.ciudad, ida: f.ida, vuelta: f.vuelta || '', a: B.a, n: B.n, b: B.b, clase: B.clase,
        precio: f.min, aerolinea: (f.vuelos && f.vuelos[0] && f.vuelos[0].aerolinea) || '', aviso: f.aviso || '' } });
      pintarRes();
    } catch (e) { if (btn) { btn.disabled = false; btn.textContent = 'No se pudo guardar. Reintentar'; } }
  }
  window.vuelosSeguidos = lista => { SEGUIDOS = lista || []; pintarSeguidos(); };
  function pintarSeguidos() {
    const cont = $('seguidos'); if (!cont) return;
    const hoy = hoyIso();
    const L = SEGUIDOS.filter(x => x.ida >= hoy);
    if (!L.length) { cont.innerHTML = '<div class="empty glass" style="border-radius:20px">Aún no sigues ninguna búsqueda. Busca un vuelo y toca <b>🔔 Seguir este precio</b>.</div>'; return; }
    cont.innerHTML = L.map(x => {
      const h = x.hist || [], ult = h[h.length - 1], prev = h[h.length - 2];
      const P = (x.a || 1) + (x.n || 0);
      const tend = !prev ? '' : ult.p < prev.p ? `<span class="badge b-green">▼ ${CLP(prev.p - ult.p)}</span>` : ult.p > prev.p ? `<span class="badge b-red">▲ ${CLP(ult.p - prev.p)}</span>` : '<span class="badge b-blue">= igual</span>';
      const r = x.recomendacion || { nivel: 'esperar', titulo: 'Siguiendo el precio', razon: '' };
      const vals = h.map(e => e.p), mn = Math.min(...vals), mx = Math.max(...vals);
      const spark = h.length > 1 ? `<svg class="spark" viewBox="0 0 80 22" aria-hidden="true" style="width:80px;height:22px"><polyline fill="none" stroke="var(--tint)" stroke-width="2" points="${h.map((e, i) => (i / (h.length - 1) * 76 + 2).toFixed(1) + ',' + (19 - (e.p - mn) / ((mx - mn) || 1) * 16).toFixed(1)).join(' ')}"/></svg>` : '';
      return `<div class="glass segcard">
        <div class="top"><b>${esc(x.origen)} → ${esc(x.destino)} · ${esc(x.ciudad || '')}</b><span class="aer">${fCorta(x.ida)}${x.vuelta ? ' → ' + fCorta(x.vuelta) : ''}</span></div>
        <div style="display:flex;align-items:flex-end;justify-content:space-between;gap:8px"><span><b style="font-size:22px">${ult ? CLP(ult.p) : '—'}</b> <span class="gfoot" style="padding:0">por persona</span><br>${tend}${ult ? `<span class="gfoot" style="padding:0"> total ${P}: ${CLP(ult.p * P)}</span>` : ''}</span>${spark}</div>
        <div class="consejo ${r.nivel}" style="font-size:13.5px"><b>${r.nivel === 'comprar' ? '🟢' : '🟡'} ${esc(r.titulo)}.</b> ${esc(r.razon || '')}</div>
        <div style="display:flex;gap:18px"><button type="button" class="tintlink" data-ver="${esc(x.id)}">Ver vuelos y comprar</button><button type="button" class="tintlink" style="color:var(--bad)" data-dejar="${esc(x.id)}">Dejar de seguir</button></div>
      </div>`;
    }).join('');
    cont.querySelectorAll('[data-ver]').forEach(btn => btn.onclick = () => {
      const x = SEGUIDOS.find(s => s.id === btn.dataset.ver); if (!x) return;
      const lug = iata => { const cc = PAIS_DE[iata]; const a = cc && AEROS ? (AEROS[cc] || []).find(z => z[0] === iata) : null; return { iata, ciudad: a ? a[1] : (iata === x.destino ? x.ciudad : iata), pais: cc ? nomPais(cc) : '', cc: cc || '' }; };
      window.vuelosIrABuscar({ origen: lug(x.origen), destino: lug(x.destino), ida: x.ida, vuelta: x.vuelta, modo: x.vuelta ? 'rt' : 'ow', a: x.a, n: x.n, b: x.b, clase: x.clase });
    });
    cont.querySelectorAll('[data-dejar]').forEach(btn => btn.onclick = async () => { btn.disabled = true; try { await enviar({ accion: 'dejarSeguir', id: btn.dataset.dejar }); } catch (e) { btn.disabled = false; } });
  }
  // ---------- gráfico: precio de este viaje en los últimos ~2 meses + eventos de descuento
  // Fechas oficiales (CCS y LATAM Pass). Las de 2027 son estimadas según los años anteriores.
  const EVENTOS = [
    { n: 'Revuelo LATAM', d: '2026-03-23', h: '2026-03-27' },
    { n: 'CyberDay', d: '2026-06-01', h: '2026-06-03' },
    { n: 'Travel Sale', d: '2026-08-31', h: '2026-09-02' },
    { n: 'CyberMonday', d: '2026-10-05', h: '2026-10-07' },
    { n: 'Black Friday', d: '2026-11-27', h: '2026-11-30' },
    { n: 'Revuelo LATAM', d: '2027-03-22', h: '2027-03-26', estimado: true },
    { n: 'CyberDay', d: '2027-05-31', h: '2027-06-02', estimado: true },
    { n: 'Travel Sale', d: '2027-08-30', h: '2027-09-01', estimado: true },
    { n: 'CyberMonday', d: '2027-10-04', h: '2027-10-06', estimado: true }
  ];
  function grafico(f, P) {
    const H = (f.historia || []).filter(x => x[1]);
    if (H.length < 5) return '';
    const hoy = hoyIso(), W = 320, A = 96, top = 16;
    const vals = H.map(x => x[1]), mn = Math.min(...vals, f.tipico ? f.tipico[0] : Infinity) * 0.92, mx = Math.max(...vals, f.tipico ? f.tipico[1] : 0);
    const y = v => top + A - (v - mn) / ((mx - mn) || 1) * A;
    const bw = W / H.length;
    const evDe = d => EVENTOS.find(e => d >= e.d && d <= e.h);
    let barras = '', bandas = '', etiquetas = '';
    H.forEach((x, i) => {
      const ev = evDe(x[0]), esHoy = i === H.length - 1;
      barras += `<rect x="${(i * bw + 0.5).toFixed(1)}" y="${y(x[1]).toFixed(1)}" width="${Math.max(bw - 1, 1).toFixed(1)}" height="${(top + A - y(x[1])).toFixed(1)}" rx="1" fill="${esHoy ? '#ffffff' : ev ? 'var(--tint)' : 'rgba(255,255,255,.38)'}"><title>${fCorta(x[0])}: ${CLP(x[1])}${ev ? ' · ' + ev.n : ''}</title></rect>`;
    });
    // bandas y nombres de eventos dentro del período
    EVENTOS.forEach(e => {
      const idx = H.map((x, i) => x[0] >= e.d && x[0] <= e.h ? i : -1).filter(i => i >= 0);
      if (!idx.length) return;
      const x0 = idx[0] * bw, x1 = (idx[idx.length - 1] + 1) * bw;
      bandas += `<rect x="${x0.toFixed(1)}" y="${top}" width="${(x1 - x0).toFixed(1)}" height="${A}" fill="rgba(255,201,139,.14)"/>`;
      etiquetas += `<text x="${((x0 + x1) / 2).toFixed(1)}" y="11" text-anchor="middle" font-size="9" font-weight="800" fill="var(--tint)">${e.n}</text>`;
    });
    const tip = f.tipico ? `<rect x="0" y="${y(f.tipico[1]).toFixed(1)}" width="${W}" height="${(y(f.tipico[0]) - y(f.tipico[1])).toFixed(1)}" fill="rgba(125,240,176,.10)"/>
      <line x1="0" x2="${W}" y1="${y(f.tipico[0]).toFixed(1)}" y2="${y(f.tipico[0]).toFixed(1)}" stroke="rgba(125,240,176,.5)" stroke-dasharray="3 3"/>` : '';
    // resumen: qué pasó en los eventos y cuál viene
    const actual = vals[vals.length - 1];
    const lineas = EVENTOS.map(e => {
      const en = H.filter(x => x[0] >= e.d && x[0] <= e.h).map(x => x[1]);
      if (!en.length) return '';
      const m = Math.min(...en), dif = actual - m;
      return `<li><b>${e.n}</b> (${fCorta(e.d)}–${fCorta(e.h)}): ${CLP(m)}${dif > 0 ? ` · <span style="color:var(--ok)">${Math.round(dif / actual * 100)}% más barato que hoy</span>` : dif < 0 ? ` · <span style="color:var(--warn)">más caro que hoy</span>` : ''}</li>`;
    }).filter(Boolean);
    const prox = EVENTOS.find(e => e.h >= hoy && e.d <= f.ida);
    const enEvento = EVENTOS.find(e => hoy >= e.d && hoy <= e.h);
    let consejoEv = '';
    if (enEvento) consejoEv = `🎉 <b>Hoy es ${enEvento.n}.</b> Compara este precio con lo que muestra el gráfico.`;
    else if (prox) {
      const dias = Math.round((D(prox.d) - D(hoy)) / 864e5);
      const ahorros = EVENTOS.map(e => { const en = H.filter(x => x[0] >= e.d && x[0] <= e.h).map(x => x[1]); return en.length ? actual - Math.min(...en) : null; }).filter(x => x !== null);
      const mejor = ahorros.length ? Math.max(...ahorros) : 0;
      consejoEv = `⏳ Próximo evento: <b>${prox.n}${prox.estimado ? ' (fecha estimada)' : ''}</b>, ${fCorta(prox.d)}–${fCorta(prox.h)}, en <b>${dias} días</b>, antes de tu viaje.` +
        (mejor > 0 ? ` En los eventos pasados este vuelo llegó a costar hasta <b>${CLP(mejor)} menos por persona</b> (${CLP(mejor * P)} para ${P}). Si se repite, podría valer la pena esperar; síguelo con 🔔 y te aviso.` : ' En los eventos pasados no bajó: esperar no asegura un mejor precio.');
    } else consejoEv = 'No hay otro evento de descuento antes de tu viaje.';
    return `<div class="glass graf">
      <div class="gt"><b>📊 Precio de este viaje: últimos ${H.length} días</b><span>${fCorta(H[0][0])} → hoy</span></div>
      <svg viewBox="0 0 ${W} ${top + A + 2}" width="100%" height="${top + A + 2}" role="img" aria-label="Gráfico de barras del precio diario de este viaje, con los eventos de descuento marcados" preserveAspectRatio="none">${tip}${bandas}${barras}${etiquetas}</svg>
      <div class="gl"><span><i style="background:var(--tint)"></i>evento de descuento</span><span><i style="background:#fff"></i>hoy ${CLP(actual)}</span>${f.tipico ? `<span><i style="background:rgba(125,240,176,.5)"></i>típico ${CLP(f.tipico[0])}–${CLP(f.tipico[1])}</span>` : ''}</div>
      ${lineas.length ? `<ul class="gev">${lineas.join('')}</ul>` : ''}
      <div class="gfoot" style="padding:0">${consejoEv}</div>
      <div class="gfoot" style="padding:0;color:var(--label3)">Datos de Google Flights: precio por persona de estas mismas fechas, día a día. Google guarda unos 2 meses; desde ahora la app guardará su propio historial de lo que sigas.</div>
    </div>`;
  }
  // ---------- 1) Explorar destinos
  const DESTINOS = [
    ['IPC', 'Isla de Pascua', 'Chile'], ['PUQ', 'Punta Arenas', 'Chile'], ['CJC', 'Calama (San Pedro)', 'Chile'], ['PMC', 'Puerto Montt', 'Chile'],
    ['LIM', 'Lima', 'Sudamérica'], ['CUZ', 'Cusco', 'Sudamérica'], ['EZE', 'Buenos Aires', 'Sudamérica'], ['MDZ', 'Mendoza', 'Sudamérica'], ['BRC', 'Bariloche', 'Sudamérica'],
    ['GRU', 'São Paulo', 'Sudamérica'], ['GIG', 'Río de Janeiro', 'Sudamérica'], ['FLN', 'Florianópolis', 'Sudamérica'], ['SSA', 'Salvador de Bahía', 'Sudamérica'],
    ['MVD', 'Montevideo', 'Sudamérica'], ['BOG', 'Bogotá', 'Sudamérica'], ['CTG', 'Cartagena', 'Sudamérica'], ['MDE', 'Medellín', 'Sudamérica'], ['UIO', 'Quito', 'Sudamérica'],
    ['MIA', 'Miami', 'Norteamérica'], ['MCO', 'Orlando', 'Norteamérica'], ['JFK', 'Nueva York', 'Norteamérica'], ['LAX', 'Los Ángeles', 'Norteamérica'], ['MEX', 'Ciudad de México', 'Norteamérica'], ['CUN', 'Cancún', 'Norteamérica'],
    ['PUJ', 'Punta Cana', 'Caribe'], ['PTY', 'Panamá', 'Caribe'], ['SJO', 'San José (Costa Rica)', 'Caribe'], ['HAV', 'La Habana', 'Caribe'],
    ['MAD', 'Madrid', 'Europa'], ['BCN', 'Barcelona', 'Europa'], ['LIS', 'Lisboa', 'Europa'], ['CDG', 'París', 'Europa'], ['FCO', 'Roma', 'Europa'], ['LHR', 'Londres', 'Europa'],
    ['SYD', 'Sídney', 'Oceanía'], ['AKL', 'Auckland', 'Oceanía']
  ];
  let EX_REGION = 'todos';
  function prepararExplorar() {
    const d = D(hoyIso()); let html = '';
    for (let k = 0; k < 12; k++) { const m = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + k, 1, 12)); html += `<option value="${iso(m).slice(0, 7)}">${MESES[m.getUTCMonth()][0].toUpperCase() + MESES[m.getUTCMonth()].slice(1)} ${m.getUTCFullYear()}</option>`; }
    $('exMes').innerHTML = html; if (!$('exMes').value) $('exMes').selectedIndex = 1;
  }
  $('exRegion').querySelectorAll('button').forEach(x => x.onclick = () => { EX_REGION = x.dataset.r; $('exRegion').querySelectorAll('button').forEach(y => y.setAttribute('aria-pressed', y === x)); });
  $('bsExplorarBtn').onclick = () => { prepararExplorar(); ver('explorar'); };
  $('exBuscar').onclick = async () => {
    if (!conf.url || !conf.key) { $('gearBtn').click(); return; }
    const [y, m] = $('exMes').value.split('-').map(Number), noches = +$('exNoches').value, presu = +$('exPresu').value || 0;
    // fecha: el primer martes del mes que esté a 14 días o más
    let d = new Date(Date.UTC(y, m - 1, 1, 12)); const min = new Date(D(hoyIso()).getTime() + 14 * 864e5);
    if (d < min) d = min;
    while (d.getUTCDay() !== 2) d = new Date(d.getTime() + 864e5);
    const ida = iso(d), vuelta = noches ? iso(new Date(d.getTime() + noches * 864e5)) : '';
    const lista = DESTINOS.filter(x => (EX_REGION === 'todos' || x[2] === EX_REGION) && x[0] !== ORI().iata);
    const P = B.a + B.n;
    $('exRes').innerHTML = `<div class="cargando glass" style="border-radius:24px"><svg class="avion" viewBox="0 0 24 24" fill="#ffc98b" aria-hidden="true"><path d="M21 16v-2l-8-5V3.5a1.5 1.5 0 0 0-3 0V9l-8 5v2l8-2.5V19l-2 1.5V22l3.5-1 3.5 1v-1.5L13 19v-5.5z"/></svg><b>Revisando ${lista.length} destinos…</b><span class="gfoot">Salida ${fCorta(ida)}${vuelta ? ', vuelta ' + fCorta(vuelta) : ', solo ida'}. Unos 15 segundos.</span></div>`;
    const tandas = []; for (let i = 0; i < lista.length; i += 8) tandas.push(lista.slice(i, i + 8));
    const res = [];
    await Promise.all(tandas.map(async t => {
      try {
        const q = new URLSearchParams({ clave: conf.key, accion: 'explorar', origen: ORI().iata, destinos: t.map(x => x[0]).join(','), ida, vuelta, clase: B.clase });
        const j = await (await fetch(conf.url + (conf.url.includes('?') ? '&' : '?') + q)).json();
        if (j.ok) res.push(...j.destinos);
      } catch (e) {}
    }));
    const info = Object.fromEntries(DESTINOS.map(x => [x[0], x]));
    const ok = res.filter(x => x.min).sort((p, q) => p.min - q.min);
    if (!ok.length) { $('exRes').innerHTML = '<div class="empty glass" style="border-radius:20px">No pude traer precios ahora. Inténtalo de nuevo en un momento.</div>'; return; }
    $('exRes').innerHTML = `<div class="gfoot">${ok.length} destinos · salida ${fCorta(ida)}${vuelta ? ' → ' + fCorta(vuelta) : ' (solo ida)'} · precio por persona con tasas · total para ${P}</div>` +
      ok.map(x => {
        const fuera = presu && x.min > presu, oferta = x.tipico && x.min < x.tipico[0];
        return `<button type="button" class="glass excard ${fuera ? 'fuera' : ''}" data-ex="${x.iata}">
          <span class="ext"><b>${esc(info[x.iata][1])}</b><small>${esc(info[x.iata][2])} · ${esc(x.aerolinea || '')}${x.directo ? ' · directo' : ''} · ${esc(x.duracion || '')}</small>
          ${oferta ? '<span class="badge b-green">🔥 bajo su precio normal</span>' : ''}${fuera ? '<span class="badge b-red">sobre tu máximo</span>' : ''}</span>
          <span class="exp"><b>${CLP(x.min)}</b><small>total ${CLP(x.min * P)}</small></span></button>`;
      }).join('') + '<div class="gfoot">Toca un destino para ver sus vuelos y fechas cercanas. Para ver todo el mes, pídeselo al Asistente.</div>';
    $('exRes').querySelectorAll('[data-ex]').forEach(x => x.onclick = () => {
      const i = info[x.dataset.ex], cc = PAIS_DE[i[0]] || '';
      window.vuelosIrABuscar({ origen: ORI(), destino: { iata: i[0], ciudad: i[1], pais: cc ? nomPais(cc) : i[2], cc }, ida, vuelta, modo: vuelta ? 'rt' : 'ow', a: B.a, n: B.n, b: B.b, clase: B.clase });
    });
  };

  // ---------- 2) dos pasajes solo ida
  function dosIdasCard(f, P) {
    const d = f.dosIdas; if (!d || !f.min) return '';
    const ahorro = f.min - d.total;
    const linea = (v, t) => `<div class="ktramo"><span class="kt">${t}</span><b>${esc(v.sale)} → ${esc(v.llega)}${v.masDias ? '<sup>+' + v.masDias + '</sup>' : ''}</b><span>${esc(v.aerolinea)} · ${esc(v.duracion)} · ${v.directo ? 'directo' : esc(v.paradas)} · ${CLP(v.precio)}</span></div>`;
    if (ahorro > f.min * 0.01) return `<div class="hero" style="border-color:rgba(125,240,176,.6)"><span class="k" style="color:var(--ok)">✂️ Dos pasajes solo ida: más barato</span>
      <p>Comprando la ida y la vuelta por separado pagas <b>${CLP(d.total)}</b> por persona: <b>${CLP(ahorro)} menos</b> (${CLP(ahorro * P)} para ${P}).</p>${linea(d.ida, 'Ida')}${linea(d.vuelta, 'Vuelta')}
      <div class="gfoot" style="padding:0">Ojo: son dos reservas separadas. Si la ida se atrasa o cambia, la aerolínea de la vuelta no responde.</div></div>`;
    return `<div class="gfoot">✓ Revisé dos pasajes solo ida (${CLP(d.total)} por persona): no conviene, el ida y vuelta es más barato.</div>`;
  }

  // ---------- 3) equipaje real
  function equipaje(v) {
    if (B.maleta === 'no') return '';
    const P = B.a + B.n, tramos = RES && RES.vuelta ? 2 : 1;
    const aer = (v.aerolinea || '').replace(/Jet · SMART/g, 'JetSMART').split(/[·,]/)[0].trim().toLowerCase();
    const sudam = ['AR', 'BO', 'BR', 'CL', 'CO', 'EC', 'PY', 'PE', 'UY', 'VE'].includes(B.destino.cc);
    let t;
    if (aer.startsWith('jetsmart')) { const c = B.maleta === 'mano' ? 12900 : 13000; t = `+ ${CLP(c * tramos * P)} en total (desde ${CLP(c)} por persona y tramo, comprándola junto con el pasaje). Total con maleta: <b>${CLP((v.precio + c * tramos) * P)}</b>.`; }
    else if (aer.startsWith('latam')) t = B.maleta === 'mano' ? (sudam ? 'En LATAM, la tarifa Basic no trae maleta de mano: elige Light o superior.' : 'Incluida: LATAM trae maleta de mano de 12 kg desde la tarifa Light.') : 'En LATAM, la maleta en bodega viene desde la tarifa Standard; en Light se paga aparte.';
    else if (aer.startsWith('sky')) t = B.maleta === 'mano' ? 'En SKY, la maleta de mano viene en Light, Max y Max Flex (no en Basic ni Standard).' : 'En SKY, la bodega viene en Standard, Max y Max Flex.';
    else t = 'Esta aerolínea no publica el precio de la maleta: revisa la tabla de tarifas antes de pagar.';
    return `<div class="extra" style="color:var(--label)"><span>🧳</span><span>${B.maleta === 'mano' ? 'Con maleta de mano' : 'Con maleta en bodega'}: ${t}</span></div>`;
  }
  $('bsMaleta').querySelectorAll('button').forEach(x => x.onclick = () => { B.maleta = x.dataset.m; guardar(); $('bsMaleta').querySelectorAll('button').forEach(y => y.setAttribute('aria-pressed', y === x)); pintarHome(); });
  $('bsMaleta').querySelectorAll('button').forEach(y => y.setAttribute('aria-pressed', y.dataset.m === B.maleta));

  // ---------- 5) Mis viajes
  let VIAJES = [];
  window.vuelosViajes = l => { VIAJES = l || []; pintarViajes(); };
  function pintarViajes() {
    const cont = $('viajes'); if (!cont) return;
    const hoy = hoyIso(), L = VIAJES.filter(x => x.fecha >= hoy);
    if (!L.length) { cont.innerHTML = '<div class="empty glass" style="border-radius:20px">No tienes vuelos guardados. Agrega uno abajo y te aviso del check-in y de su estado.</div>'; return; }
    cont.innerHTML = L.map(x => {
      const dias = Math.round((D(x.fecha) - D(hoy)) / 864e5);
      const cc = PAIS_DE[x.destino] || '';
      const docs = cc ? notasDestino(cc) : [];
      return `<div class="glass segcard">
        <div class="top"><b>${esc(x.numero)} · ${esc(x.origen || '')} → ${esc(x.destino || '')}</b><span class="aer">${fCorta(x.fecha)}${x.hora ? ' · ' + esc(x.hora) : ''}</span></div>
        <div><b style="font-size:20px">${dias === 0 ? '¡Hoy!' : dias === 1 ? 'Mañana' : 'En ' + dias + ' días'}</b>${dias <= 2 ? ' <span class="badge b-orange">check-in abierto o por abrir</span>' : ''}</div>
        ${docs.map(t => `<div class="extra ojo"><span>📄</span><span>${esc(t)}</span></div>`).join('')}
        <div class="extra" style="color:var(--label2)"><span>🛂</span><span>Pasaporte o carnet vigente. El check-in online suele abrir 24 a 48 horas antes en la app de la aerolínea.</span></div>
        <div id="est-${esc(x.id)}" class="gfoot" style="padding:0"></div>
        <div style="display:flex;gap:18px"><button type="button" class="tintlink" data-est="${esc(x.id)}">Ver estado del vuelo</button><button type="button" class="tintlink" style="color:var(--bad)" data-qv="${esc(x.id)}">Quitar</button></div>
      </div>`;
    }).join('');
    cont.querySelectorAll('[data-est]').forEach(btn => btn.onclick = async () => {
      const x = VIAJES.find(v => v.id === btn.dataset.est), out = $('est-' + x.id);
      out.textContent = 'Consultando…';
      try {
        const j = await (await fetch(conf.url + (conf.url.includes('?') ? '&' : '?') + new URLSearchParams({ clave: conf.key, accion: 'estadoVuelo', numero: x.numero, fecha: x.fecha }))).json();
        out.innerHTML = j.ok ? `<b style="color:#fff">${esc(j.estado)}</b>${j.atraso ? ' · ' + esc(j.atraso) : ''}${j.puerta ? ' · Puerta ' + esc(j.puerta) : ''}<br><span style="color:var(--label3)">${esc(j.nota)} Fuente: FlightAware.</span>` : 'No encontré información de ese vuelo.';
      } catch (e) { out.textContent = 'Sin conexión.'; }
    });
    cont.querySelectorAll('[data-qv]').forEach(btn => btn.onclick = async () => { btn.disabled = true; try { await enviar({ accion: 'quitarViaje', id: btn.dataset.qv }); } catch (e) { btn.disabled = false; } });
  }
  $('vjForm').addEventListener('submit', async e => {
    e.preventDefault();
    const viaje = { numero: $('vjNum').value, fecha: $('vjFecha').value, origen: $('vjOri').value, destino: $('vjDes').value, hora: $('vjHora').value };
    $('vjMsg').textContent = 'Guardando…';
    try { await enviar({ accion: 'agregarViaje', viaje }); $('vjMsg').textContent = 'Guardado. Te aviso 2 días antes y el día del vuelo.'; $('vjForm').reset(); }
    catch (err) { $('vjMsg').textContent = err.message === 'parametros' ? 'Revisa el número de vuelo (ej. LA500) y la fecha.' : 'No se pudo guardar.'; }
  });
  if (!AEROS) fetch('aeropuertos.json?v=1').then(r => r.json()).then(j => { AEROS = AEROS || j; Object.keys(AEROS).forEach(cc => AEROS[cc].forEach(z => PAIS_DE[z[0]] = cc)); pintarViajes(); }).catch(() => {});

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
      ${equipaje(v)}
      ${ex.map(([k, t]) => `<div class="extra ${k === 'ok' ? 'ok' : 'ojo'}"><span>${k === 'ok' ? '✓' : k === 'info' ? 'ℹ' : '⚠'}</span><span>${esc(t)}</span></div>`).join('')}
      <div class="vprecio"><span class="pp">${CLP(v.precio)} por persona<br>tasas incluidas · equipaje según tarifa</span><span class="tot"><b>${CLP(v.precio * P)}</b><span>total ${P} ${P === 1 ? 'persona' : 'personas'}</span></span></div>
      ${guiaTarifa(v.aerolinea, B.destino.cc)}
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
