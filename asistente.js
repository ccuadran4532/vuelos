// Asistente: escribes o dictas "vuelo barato a Lima en marzo para 3 personas" y te muestro
// el calendario del mes con el precio de cada día y mi recomendación. Tú eliges el día y te llevo a Buscar para comprar.
// Entiende el texto con reglas (sin servicios pagados). Usa conf, $, CLP, esc y DOW de app.js.
(function () {
  const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
  const MES3 = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
  const NUM = { un: 1, uno: 1, una: 1, dos: 2, tres: 3, cuatro: 4, cinco: 5, seis: 6, siete: 7, ocho: 8, nueve: 9, diez: 10, once: 11, doce: 12, catorce: 14, quince: 15, veinte: 20, treinta: 30 };
  const norm = s => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[¿?¡!.,;]/g, ' ').replace(/\s+/g, ' ').trim();
  const n2 = t => NUM[t] !== undefined ? NUM[t] : parseInt(t, 10);
  const iso = d => d.toISOString().slice(0, 10);
  const D = s => new Date(s + 'T12:00:00Z');
  const sumar = (s, n) => iso(new Date(D(s).getTime() + n * 864e5));
  const hoyIso = () => { const d = new Date(); return iso(new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate(), 12))); };
  const fCorta = s => { const d = D(s); return `${DOW[d.getUTCDay()]} ${d.getUTCDate()} ${MES3[d.getUTCMonth()]}`; };
  const NOMBRE_PAIS = (() => { try { return new Intl.DisplayNames(['es'], { type: 'region' }); } catch (e) { return null; } })();
  const nomPais = cc => (NOMBRE_PAIS && NOMBRE_PAIS.of(cc)) || cc;

  // Nombres en español (y apodos) → aeropuerto principal
  const ALIAS = {
    'nueva york': 'JFK', 'new york': 'JFK', 'nyc': 'JFK', 'miami': 'MIA', 'orlando': 'MCO', 'disney': 'MCO', 'los angeles': 'LAX', 'san francisco': 'SFO', 'las vegas': 'LAS',
    'chicago': 'ORD', 'boston': 'BOS', 'houston': 'IAH', 'dallas': 'DFW', 'atlanta': 'ATL', 'washington': 'IAD', 'honolulu': 'HNL', 'hawai': 'HNL', 'toronto': 'YYZ', 'montreal': 'YUL', 'vancouver': 'YVR',
    'cancun': 'CUN', 'ciudad de mexico': 'MEX', 'mexico df': 'MEX', 'punta cana': 'PUJ', 'la habana': 'HAV', 'habana': 'HAV', 'panama': 'PTY', 'san jose de costa rica': 'SJO', 'costa rica': 'SJO',
    'cartagena': 'CTG', 'bogota': 'BOG', 'medellin': 'MDE', 'cali': 'CLO', 'lima': 'LIM', 'cusco': 'CUZ', 'cuzco': 'CUZ', 'quito': 'UIO', 'guayaquil': 'GYE', 'la paz': 'LPB', 'santa cruz': 'VVI',
    'buenos aires': 'EZE', 'mendoza': 'MDZ', 'bariloche': 'BRC', 'cordoba argentina': 'COR', 'ushuaia': 'USH', 'iguazu': 'IGU', 'foz de iguazu': 'IGU', 'montevideo': 'MVD', 'punta del este': 'PDP', 'asuncion': 'ASU',
    'sao paulo': 'GRU', 'san pablo': 'GRU', 'rio de janeiro': 'GIG', 'rio': 'GIG', 'florianopolis': 'FLN', 'floripa': 'FLN', 'salvador de bahia': 'SSA', 'recife': 'REC', 'natal': 'NAT', 'fortaleza': 'FOR', 'maceio': 'MCZ',
    'madrid': 'MAD', 'barcelona': 'BCN', 'sevilla': 'SVQ', 'malaga': 'AGP', 'valencia': 'VLC', 'bilbao': 'BIO', 'palma de mallorca': 'PMI', 'mallorca': 'PMI', 'ibiza': 'IBZ', 'tenerife': 'TFS', 'gran canaria': 'LPA',
    'lisboa': 'LIS', 'oporto': 'OPO', 'paris': 'CDG', 'londres': 'LHR', 'roma': 'FCO', 'milan': 'MXP', 'venecia': 'VCE', 'florencia': 'FLR', 'napoles': 'NAP', 'amsterdam': 'AMS', 'bruselas': 'BRU',
    'frankfurt': 'FRA', 'munich': 'MUC', 'berlin': 'BER', 'zurich': 'ZRH', 'ginebra': 'GVA', 'viena': 'VIE', 'praga': 'PRG', 'budapest': 'BUD', 'atenas': 'ATH', 'estambul': 'IST', 'dublin': 'DUB',
    'copenhague': 'CPH', 'estocolmo': 'ARN', 'oslo': 'OSL', 'helsinki': 'HEL', 'varsovia': 'WAW', 'dubai': 'DXB', 'doha': 'DOH', 'tel aviv': 'TLV', 'el cairo': 'CAI', 'marrakech': 'RAK',
    'tokio': 'HND', 'seul': 'ICN', 'pekin': 'PEK', 'shanghai': 'PVG', 'hong kong': 'HKG', 'bangkok': 'BKK', 'singapur': 'SIN', 'bali': 'DPS', 'sidney': 'SYD', 'sydney': 'SYD', 'melbourne': 'MEL', 'auckland': 'AKL',
    'isla de pascua': 'IPC', 'rapa nui': 'IPC', 'punta arenas': 'PUQ', 'puerto natales': 'PNT', 'puerto montt': 'PMC', 'calama': 'CJC', 'san pedro de atacama': 'CJC', 'antofagasta': 'ANF', 'iquique': 'IQQ', 'arica': 'ARI',
    'la serena': 'LSC', 'concepcion': 'CCP', 'temuco': 'ZCO', 'pucon': 'ZCO', 'valdivia': 'ZAL', 'osorno': 'ZOS', 'balmaceda': 'BBA', 'coyhaique': 'BBA', 'castro': 'MHC', 'chiloe': 'MHC', 'copiapo': 'CPO', 'santiago': 'SCL'
  };
  // País → aeropuerto principal cuando solo se dice el país
  const HUB = { ES: 'MAD', FR: 'CDG', IT: 'FCO', GB: 'LHR', PT: 'LIS', DE: 'FRA', NL: 'AMS', CH: 'ZRH', US: 'MIA', CA: 'YYZ', MX: 'CUN', BR: 'GRU', AR: 'EZE', PE: 'LIM', CO: 'BOG', EC: 'UIO', BO: 'VVI', UY: 'MVD', PY: 'ASU',
    CU: 'HAV', DO: 'PUJ', PA: 'PTY', CR: 'SJO', JP: 'HND', KR: 'ICN', CN: 'PEK', TH: 'BKK', AU: 'SYD', NZ: 'AKL', AE: 'DXB', TR: 'IST', GR: 'ATH', IE: 'DUB', AT: 'VIE', CZ: 'PRG', HU: 'BUD', MA: 'RAK', EG: 'CAI' };

  let AEROS = null, IDX = {}, CIUDADES = [];
  async function cargar() {
    if (AEROS) return;
    AEROS = await (await fetch('aeropuertos.json?v=1')).json();
    for (const cc in AEROS) for (const a of AEROS[cc]) {
      IDX[a[0]] = { iata: a[0], ciudad: a[1], aeropuerto: a[2], cc, pais: nomPais(cc) };
      const c = norm(a[1].replace(/\(.*\)/, ''));
      if (c.length >= 4 && a[3]) CIUDADES.push([c, a[0]]);
    }
    CIUDADES.sort((x, y) => y[0].length - x[0].length);
  }
  const lugar = iata => IDX[iata] || { iata, ciudad: iata, pais: '', cc: '' };

  function buscarLugar(t) {
    const conPalabra = k => new RegExp('(^| )' + k.replace(/ /g, ' ') + '( |$)').test(t);
    const claves = Object.keys(ALIAS).sort((a, b) => b.length - a.length);
    for (const k of claves) if (conPalabra(k)) return { iata: ALIAS[k], dicho: k };
    for (const [c, i] of CIUDADES) if (conPalabra(c)) return { iata: i, dicho: c };
    for (const cc in HUB) { const n = norm(nomPais(cc)); if (n && conPalabra(n)) return { iata: HUB[cc], dicho: n, soloPais: nomPais(cc) }; }
    return null;
  }

  // ---------- entender el pedido
  function entender(texto) {
    const t = ' ' + norm(texto) + ' ';
    const r = { modo: 'rt', noches: null, a: null, n: 0, b: 0, clase: 'turista', origen: null, destino: null, desde: null, dias: 31, notas: [] };
    // origen "desde X"
    let resto = t;
    const mo = t.match(/ desde ([a-z ]+?)(?= a | hacia | para | con | en | por | el | del | $)/);
    if (mo) { const o = buscarLugar(' ' + mo[1] + ' '); if (o) { r.origen = o.iata; resto = t.replace(mo[0], ' '); } }
    const d = buscarLugar(resto);
    if (d) { r.destino = d.iata; if (d.soloPais) r.notas.push(`Dijiste ${d.soloPais}: busco ${lugar(d.iata).ciudad} (${d.iata}). Si prefieres otra ciudad, dímela.`); }
    // tipo de viaje y clase
    if (/ (solo|sólo) ida | ida solamente | sin (regreso|vuelta) /.test(t)) r.modo = 'ow';
    if (/ (ejecutiva|business|primera clase) /.test(t)) r.clase = 'ejecutiva'; else if (/ premium /.test(t)) r.clase = 'premium';
    // personas
    const W = '(\\d+|un|uno|una|dos|tres|cuatro|cinco|seis|siete|ocho|nueve)';
    let m;
    if ((m = t.match(new RegExp(' ' + W + ' (adultos?|personas?|pasajeros?|pax) ')))) r.a = n2(m[1]);
    if ((m = t.match(new RegExp(' somos ' + W + ' ')))) r.a = n2(m[1]);
    if ((m = t.match(new RegExp(' para ' + W + ' ')))) r.a = r.a || n2(m[1]);
    if ((m = t.match(new RegExp(' ' + W + ' (ninos?|ninas?|hijos?) ')))) r.n = n2(m[1]);
    if ((m = t.match(new RegExp(' ' + W + ' (bebes?|guaguas?) ')))) r.b = n2(m[1]);
    if (/ (para mi|solo yo|voy solo|voy sola) /.test(t)) r.a = 1;
    if (r.a && / personas? /.test(t) && r.n) r.a = Math.max(1, r.a - r.n);
    // noches
    if ((m = t.match(new RegExp(' ' + W + ' (noches?|dias?) ')))) r.noches = n2(m[1]);
    if (/ una semana /.test(t)) r.noches = 7;
    if ((m = t.match(new RegExp(' ' + W + ' semanas ')))) r.noches = 7 * n2(m[1]);
    if (/ fin de semana /.test(t)) r.noches = 2;
    if (/ un mes /.test(t) && !/ en un mes /.test(t)) r.noches = 30;
    // fechas: "del 10 al 20 de marzo", "19 de enero", "en marzo", "marzo 2027"
    const hoy = hoyIso(), Y = +hoy.slice(0, 4), M = +hoy.slice(5, 7) - 1;
    const anio = mes => { const ya = t.match(new RegExp(MESES[mes] + ' (de )?(20\\d\\d)')); if (ya) return +ya[2]; return mes < M ? Y + 1 : Y; };
    const fecha = (dia, mes) => `${anio(mes)}-${String(mes + 1).padStart(2, '0')}-${String(dia).padStart(2, '0')}`;
    const rm = MESES.join('|');
    if ((m = t.match(new RegExp(' del? (\\d{1,2}) (de (' + rm + ') )?al? (\\d{1,2}) de (' + rm + ') ')))) {
      const m2 = MESES.indexOf(m[5]), m1 = m[3] ? MESES.indexOf(m[3]) : m2;
      const ini = fecha(+m[1], m1), fin = fecha(+m[4], m2);
      if (r.noches === null && r.modo === 'rt') { r.desde = ini; r.dias = 1; r.noches = Math.round((D(fin) - D(ini)) / 864e5); r.notas.push('Tomé esas fechas como ida y vuelta, y te muestro también los días cercanos.'); r.desde = sumar(ini, -7); r.dias = 15; }
      else { r.desde = ini; r.dias = Math.min(31, Math.round((D(fin) - D(ini)) / 864e5) + 1); }
    } else if ((m = t.match(new RegExp(' (\\d{1,2}) de (' + rm + ') ')))) {
      r.desde = sumar(fecha(+m[1], MESES.indexOf(m[2])), -7); r.dias = 15;
    } else if ((m = t.match(new RegExp(' (' + rm + ') ')))) {
      r.desde = fecha(1, MESES.indexOf(m[1])); r.dias = new Date(Date.UTC(+r.desde.slice(0, 4), MESES.indexOf(m[1]) + 1, 0)).getUTCDate();
    } else if (/ (proximo mes|mes que viene) /.test(t)) {
      const p = new Date(Date.UTC(Y, M + 1, 1, 12)); r.desde = iso(p); r.dias = new Date(Date.UTC(Y, M + 2, 0)).getUTCDate();
    }
    if (!r.desde) { r.desde = sumar(hoy, 14); r.dias = 31; r.notas.push('Como las fechas son flexibles, reviso los próximos 31 días a partir de dos semanas más.'); }
    if (r.desde < hoy) { r.dias -= Math.round((D(hoy) - D(r.desde)) / 864e5); r.desde = hoy; }
    if (r.modo === 'rt' && r.noches === null) { r.noches = 7; r.notas.push('Supuse 7 noches. Puedes cambiarlo abajo.'); }
    if (!r.a) { r.a = 2; r.notas.push('Supuse 2 adultos. Puedes cambiarlo abajo.'); }
    return r;
  }

  // ---------- chat
  let HIST = []; try { HIST = JSON.parse(localStorage.getItem('chat') || '[]'); } catch (e) {}
  let ULTIMO = null;
  const guardarHist = () => { try { localStorage.setItem('chat', JSON.stringify(HIST.slice(-30))); } catch (e) {} };
  function pintar() {
    $('chLista').innerHTML = HIST.map((m, i) => m.yo ? `<div class="msg yo">${esc(m.t)}</div>` : `<div class="msg bot">${m.h}</div>`).join('') || '';
    $('chVacio').hidden = HIST.length > 0;
    $('chLista').querySelectorAll('[data-dia]').forEach(b => b.onclick = () => elegirDia(b.dataset.dia, b.dataset.k));
    $('chLista').querySelectorAll('[data-cambio]').forEach(b => b.onclick = () => cambiar(b.dataset.k, b.dataset.cambio));
    $('chLista').querySelectorAll('[data-ir]').forEach(b => b.onclick = () => irABuscar(b.dataset.ir, b.dataset.k));
    setTimeout(() => window.scrollTo(0, document.body.scrollHeight), 50);
  }
  function bot(h) { HIST.push({ h }); guardarHist(); pintar(); }
  function yo(t) { HIST.push({ yo: true, t }); guardarHist(); pintar(); }

  async function enviar(texto) {
    texto = (texto || '').trim();
    if (!texto) return;
    yo(texto); $('chTexto').value = '';
    if (/^(borrar|limpiar|nuevo)( chat)?$/i.test(texto)) { HIST = []; guardarHist(); pintar(); return; }
    await cargar();
    const r = entender(texto);
    if (!r.destino) { bot('No entendí a qué ciudad quieres ir. Prueba así: <b>"vuelo barato a Lima en marzo para 3 personas"</b>.'); return; }
    if (r.origen === r.destino) { bot('El origen y el destino son la misma ciudad. ¿A dónde quieres ir?'); return; }
    buscarMes(r);
  }

  function resumen(r) {
    const o = lugar(r.origen || 'SCL'), d = lugar(r.destino);
    const pax = `${r.a} ${r.a === 1 ? 'adulto' : 'adultos'}${r.n ? `, ${r.n} ${r.n === 1 ? 'niño' : 'niños'}` : ''}${r.b ? `, ${r.b} ${r.b === 1 ? 'bebé' : 'bebés'}` : ''}`;
    return `<b>${esc(o.ciudad)} (${o.iata}) → ${esc(d.ciudad)} (${d.iata})</b>${d.pais ? ' · ' + esc(d.pais) : ''}<br>` +
      `Salidas del ${fCorta(r.desde)} al ${fCorta(sumar(r.desde, r.dias - 1))} · ${r.modo === 'ow' ? 'solo ida' : r.noches + ' noches'} · ${pax} · ${{ turista: 'Turista', premium: 'Premium', ejecutiva: 'Ejecutiva' }[r.clase]}`;
  }

  async function buscarMes(r) {
    if (!conf.url || !conf.key) { bot('Primero configura la conexión en Ajustes (⚙︎).'); return; }
    const k = 'r' + Date.now();
    bot(`Entendí:<br>${resumen(r)}${r.notas.length ? '<div class="nota">' + r.notas.map(esc).join('<br>') + '</div>' : ''}
      <div class="cargando-mini" id="chEspera"><svg class="avion" viewBox="0 0 24 24" fill="#ffc98b" aria-hidden="true"><path d="M21 16v-2l-8-5V3.5a1.5 1.5 0 0 0-3 0V9l-8 5v2l8-2.5V19l-2 1.5V22l3.5-1 3.5 1v-1.5L13 19v-5.5z"/></svg>
      <span>Buscando el precio de cada día en todas las aerolíneas… tarda 1 a 2 minutos. <b id="chSeg">0 s</b></span></div>`);
    const t0 = Date.now(); const reloj = setInterval(() => { const e = $('chSeg'); if (e) e.textContent = Math.round((Date.now() - t0) / 1000) + ' s'; }, 1000);
    try {
      const q = new URLSearchParams({ clave: conf.key, accion: 'mes', origen: r.origen || 'SCL', destino: r.destino, desde: r.desde, dias: r.dias, noches: r.modo === 'ow' ? '' : r.noches, clase: r.clase });
      const j = await (await fetch(conf.url + (conf.url.includes('?') ? '&' : '?') + q.toString())).json();
      clearInterval(reloj);
      if (!j.ok) throw new Error(j.error === 'clave' ? 'la clave no coincide' : (j.error || 'sin respuesta'));
      HIST.pop(); // reemplaza el mensaje de espera
      const busq = { r, j }; try { localStorage.setItem('chat-' + k, JSON.stringify(busq)); } catch (e) {}
      ULTIMO = { k, ...busq };
      bot(`Entendí:<br>${resumen(r)}${r.notas.length ? '<div class="nota">' + r.notas.map(esc).join('<br>') + '</div>' : ''}` + calendario(k, r, j));
    } catch (err) {
      clearInterval(reloj);
      HIST.pop();
      bot(`No pude terminar la búsqueda: ${esc(err.message)}. Inténtalo de nuevo en un momento.`);
    }
  }

  // Elijo el día más conveniente: el más barato, prefiriendo salir martes o miércoles y evitando salir viernes o volver domingo.
  function recomendar(r, dias) {
    const con = dias.filter(x => x.min);
    if (!con.length) return null;
    const min = Math.min(...con.map(x => x.min));
    const puntaje = x => {
      const wi = D(x.ida).getUTCDay(), wv = x.vuelta ? D(x.vuelta).getUTCDay() : null;
      let p = x.min / min;
      if (wi === 2 || wi === 3) p -= 0.02;
      if (wi === 5) p += 0.04;
      if (wv === 0) p += 0.04;
      if (x.directo) p -= 0.01;
      return p;
    };
    const mejor = con.slice().sort((a, b) => puntaje(a) - puntaje(b))[0];
    const iguales = con.filter(x => x.min <= min * 1.02).length;
    const razones = [];
    if (mejor.min === min) razones.push('es el precio más bajo del período');
    else razones.push(`cuesta solo ${CLP(mejor.min - min)} más que el día más barato`);
    const wi = D(mejor.ida).getUTCDay();
    if (wi === 2 || wi === 3) razones.push('sale ' + (wi === 2 ? 'martes' : 'miércoles') + ', día tranquilo');
    if (mejor.directo) razones.push('el más barato de ese día es directo');
    if (iguales > con.length * 0.6) razones.push(`ojo: ${iguales} de ${con.length} días tienen casi el mismo precio, así que puedes elegir el que te acomode`);
    return { mejor, min, texto: razones.join('; ') };
  }

  function calendario(k, r, j) {
    const dias = j.dias, P = r.a + r.n;
    const rec = recomendar(r, dias);
    if (!rec) return '<div class="nota">No encontré precios para esas fechas. Prueba con otro mes o con otra ciudad cercana.</div>';
    const con = dias.filter(x => x.min).map(x => x.min), mn = Math.min(...con), mx = Math.max(...con);
    const porMes = {};
    dias.forEach(x => { const key = x.ida.slice(0, 7); (porMes[key] = porMes[key] || []).push(x); });
    let html = '';
    for (const key in porMes) {
      const y = +key.slice(0, 4), mo = +key.slice(5, 7) - 1;
      const total = new Date(Date.UTC(y, mo + 1, 0)).getUTCDate(), lead = (new Date(Date.UTC(y, mo, 1, 12)).getUTCDay() + 6) % 7;
      const map = {}; porMes[key].forEach(x => map[x.ida] = x);
      let celdas = '';
      for (let i = 0; i < lead; i++) celdas += '<span></span>';
      for (let n = 1; n <= total; n++) {
        const s = `${key}-${String(n).padStart(2, '0')}`, x = map[s];
        if (!x) { celdas += `<span class="cdia fuera"><span class="n">${n}</span></span>`; continue; }
        const nivel = !x.min ? 'sin' : (x.min - mn) <= (mx - mn) * 0.2 ? 'bajo' : (x.min - mn) >= (mx - mn) * 0.75 && mx > mn ? 'alto' : 'medio';
        const esRec = x.ida === rec.mejor.ida;
        celdas += `<button type="button" class="cdia ${nivel} ${esRec ? 'rec' : ''}" data-dia="${x.ida}" data-k="${k}" aria-label="${fCorta(x.ida)}: ${x.min ? CLP(x.min) + ' por persona' : 'sin precio'}">
          <span class="n">${n}${esRec ? ' ★' : ''}</span><span class="p">${x.min ? Math.round(x.min / 1000) + 'k' : '—'}</span></button>`;
      }
      html += `<div class="cmes"><div class="ct">${MESES[mo][0].toUpperCase() + MESES[mo].slice(1)} ${y}</div><div class="cgrid"><span class="dw">L</span><span class="dw">M</span><span class="dw">M</span><span class="dw">J</span><span class="dw">V</span><span class="dw">S</span><span class="dw">D</span>${celdas}</div></div>`;
    }
    const m = rec.mejor;
    return `<div class="calbox">${html}
      <div class="leyenda"><span class="lg bajo"></span>barato <span class="lg medio"></span>normal <span class="lg alto"></span>caro · precio por persona${r.modo === 'ow' ? '' : ', ida y vuelta'}, con tasas</div></div>
      <div class="recom"><b>★ Te recomiendo salir el ${fCorta(m.ida)}${m.vuelta ? ' y volver el ' + fCorta(m.vuelta) : ''}</b><br>
      ${CLP(m.min)} por persona · <b>${CLP(m.min * P)}</b> total para ${P} ${P === 1 ? 'persona' : 'personas'}${m.aerolinea ? ' · ' + esc(m.aerolinea) : ''}${m.directo ? ' · directo' : ''}.<br>
      <span class="gfoot" style="padding:0">Por qué: ${esc(rec.texto)}.</span></div>
      <button type="button" class="btn" data-ir="${m.ida}" data-k="${k}">Ver vuelos del ${fCorta(m.ida)} y comprar</button>
      <div class="gfoot" style="padding:0">O toca cualquier día del calendario para elegirlo tú.${j.desdeMemoria ? ' (Búsqueda guardada de hace menos de 6 horas.)' : ''}</div>
      <div class="chips">${r.modo === 'ow' ? '' : [5, 7, 10, 14].filter(x => x !== r.noches).map(x => `<button type="button" data-cambio="${x}" data-k="${k}">${x} noches</button>`).join('')}
        <button type="button" data-cambio="pax" data-k="${k}">Cambiar personas</button></div>`;
  }

  function busqueda(k) { if (ULTIMO && ULTIMO.k === k) return ULTIMO; try { return { k, ...JSON.parse(localStorage.getItem('chat-' + k)) }; } catch (e) { return null; } }
  async function elegirDia(dia, k) {
    await cargar();
    const b = busqueda(k); if (!b) return;
    const x = b.j.dias.find(d => d.ida === dia); if (!x) return;
    const P = b.r.a + b.r.n;
    bot(`Elegiste el <b>${fCorta(dia)}</b>${x.vuelta ? ' → ' + fCorta(x.vuelta) : ''}: ${x.min ? `${CLP(x.min)} por persona · <b>${CLP(x.min * P)}</b> total` : 'sin precio ese día'}${x.aerolinea ? ' · ' + esc(x.aerolinea) : ''}.
      <button type="button" class="btn" style="margin-top:10px" data-ir="${dia}" data-k="${k}">Ver vuelos de ese día y comprar</button>`);
  }
  async function cambiar(k, que) {
    const b = busqueda(k); if (!b) return;
    await cargar();
    if (que === 'pax') { $('chTexto').value = `a ${lugar(b.r.destino).ciudad.toLowerCase()} para `; $('chTexto').focus(); return; }
    const r = { ...b.r, noches: +que, notas: [] };
    yo(`Mismo viaje, ${que} noches`);
    buscarMes(r);
  }
  async function irABuscar(dia, k) {
    const b = busqueda(k); if (!b) return;
    await cargar();
    const x = b.j.dias.find(d => d.ida === dia) || { ida: dia, vuelta: b.r.modo === 'ow' ? '' : sumar(dia, b.r.noches) };
    if (window.vuelosIrABuscar) window.vuelosIrABuscar({ origen: lugar(b.r.origen || 'SCL'), destino: lugar(b.r.destino), ida: x.ida, vuelta: x.vuelta, modo: b.r.modo, a: b.r.a, n: b.r.n, b: b.r.b, clase: b.r.clase });
  }

  // ---------- micrófono (dictado por voz del teléfono)
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  let rec = null, escuchando = false;
  $('chMic').onclick = () => {
    if (!SR) { $('chAyuda').textContent = 'Este teléfono no permite dictar aquí. Usa el micrófono 🎤 del teclado.'; $('chTexto').focus(); return; }
    if (escuchando) { rec && rec.stop(); return; }
    rec = new SR(); rec.lang = 'es-CL'; rec.interimResults = true; rec.maxAlternatives = 1;
    let final = '';
    rec.onresult = e => { let t = ''; for (const res of e.results) t += res[0].transcript; $('chTexto').value = t; if (e.results[e.results.length - 1].isFinal) final = t; };
    rec.onstart = () => { escuchando = true; $('chMic').classList.add('on'); $('chAyuda').textContent = 'Te escucho… habla y espera un segundo.'; };
    rec.onerror = e => { $('chAyuda').textContent = e.error === 'not-allowed' ? 'Falta permiso para el micrófono: acéptalo cuando el teléfono lo pida.' : 'No te escuché bien. Toca el micrófono y prueba otra vez.'; };
    rec.onend = () => { escuchando = false; $('chMic').classList.remove('on'); $('chAyuda').textContent = ''; if (final) enviar(final); };
    try { rec.start(); } catch (e) {}
  };
  $('chBarra').addEventListener('submit', e => { e.preventDefault(); enviar($('chTexto').value); });
  document.querySelectorAll('[data-ejemplo]').forEach(b => b.onclick = () => enviar(b.dataset.ejemplo));
  $('chBorrar').onclick = () => { HIST = []; guardarHist(); pintar(); };
  // Al entrar a la pestaña, mostrar la barra de escribir
  document.querySelectorAll('.tabbar button').forEach(b => b.addEventListener('click', () => { $('chBarra').hidden = b.dataset.v !== 'chat'; }));
  window.vuelosPedirAlAsistente = t => { const btn = document.querySelector('.tabbar button[data-v="chat"]'); if (btn) btn.click(); if (t) enviar(t); else $('chTexto').focus(); };
  window.vuelosEntender = async t => { await cargar(); return entender(t); };  // útil para revisar cómo entiende un pedido
  pintar();
})();
