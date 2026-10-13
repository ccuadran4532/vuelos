// App Vuelos — mismo diseño que la versión en Claude, con datos desde el cerebro (Apps Script).

const $=id=>document.getElementById(id);
const CLP=n=>'$'+Math.round(n).toLocaleString('es-CL');
const DOW=['dom','lun','mar','mié','jue','vie','sáb'];
const DOWL=['Domingo','Lunes','Martes','Miércoles','Jueves','Viernes','Sábado'];
const NAC=new Set(['ARI','IQQ','CJC','ANF','CPO','LSC','CCP','ZCO','ZAL','PMC','BBA','PUQ','IPC','PNT','ZOS','MHC','ZPC']);
const TILE={'SKY':'var(--indigo)','JetSMART':'var(--orange)','LATAM':'var(--red)'};
const CHEV='<svg class="chev" viewBox="0 0 8 13" aria-hidden="true"><path d="M1 1l5.5 5.5L1 12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>';
const TITLES={buscar:'Buscar',hoy:'Ofertas',comparar:'Comparar',mis:'Destinos',promos:'Promos'};
const AP={MDZ:'Mendoza',MVD:'Montevideo',GRU:'São Paulo',FLN:'Florianópolis',GIG:'Río de Janeiro',SCL:'Santiago'};
let OFERTAS=[],MIS=[],TARIFAS={},filtro='todo',tab='buscar',detId=null;
const esc=s=>String(s??'').replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
// Pasajeros (se recuerdan en el teléfono). Los niños pagan tarifa de adulto en estas aerolíneas, salvo promociones puntuales.
let PAX=(()=>{try{return JSON.parse(localStorage.getItem('pax'))||{a:2,n:0}}catch(e){return{a:2,n:0}}})();
const NP=()=>PAX.a+PAX.n;
const paxTxt=()=>`${PAX.a} ${PAX.a===1?'adulto':'adultos'}${PAX.n?` y ${PAX.n} ${PAX.n===1?'niño':'niños'}`:''}`;
const total2=o=>(o.tipo==='ida'?o.precio*2:o.precio)*NP();
const conPax=(link)=>String(link||'').replace(/([?&](?:ADT|adt)=)\d+/,'$1'+PAX.a).replace(/([?&](?:CHD|chd)=)\d+/,'$1'+PAX.n);
const ppRT=o=>o.tipo==='ida'?o.precio*2:o.precio;
const dd=s=>new Date(s+'T12:00:00Z');
const fdate=s=>{if(!s)return'';const d=dd(s);return `${DOW[d.getUTCDay()]} ${d.getUTCDate()}/${d.getUTCMonth()+1}`};

// ---------- navegación
function go(v){tab=v;detId=null;
  document.querySelectorAll('.tabbar button').forEach(x=>x.dataset.v===v?x.setAttribute('aria-current','page'):x.removeAttribute('aria-current'));
  Object.keys(TITLES).forEach(k=>$('v-'+k).hidden=k!==v);$('v-det').hidden=true;$('v-ajustes').hidden=true;$('backBtn').hidden=true;$('navt').textContent=TITLES[v];
  try{localStorage.setItem('tab',v)}catch(e){}window.scrollTo(0,0)}
document.querySelectorAll('.tabbar button').forEach(b=>b.onclick=()=>go(b.dataset.v));
$('backBtn').onclick=()=>{history.state&&history.state.det?history.back():go(tab)};
window.addEventListener('popstate',()=>{if(detId)go(tab)});
{let t=null;try{t=localStorage.getItem('tab')}catch(e){}go(t&&TITLES[t]?t:'buscar')}
$('fil').querySelectorAll('button').forEach(b=>b.onclick=()=>{filtro=b.dataset.f;$('fil').querySelectorAll('button').forEach(x=>x.setAttribute('aria-pressed',x===b));drawOfertas()});
function bindOpen(root){root.querySelectorAll('[data-open]').forEach(b=>b.onclick=()=>openDet(b.dataset.open))}

// ---------- celdas
function spark(h){if(!h||h.length<2)return'';const v=h.map(x=>x.p),mn=Math.min(...v),mx=Math.max(...v),r=mx-mn||1;
  const pts=v.map((p,i)=>`${(i/(v.length-1)*52+2).toFixed(1)},${(16-(p-mn)/r*13).toFixed(1)}`);const l=pts[pts.length-1].split(',');
  return `<svg class="spark" viewBox="0 0 56 18" aria-hidden="true"><polyline points="${pts.join(' ')}" fill="none" stroke="var(--label3)" stroke-width="1.5" stroke-linejoin="round"/><circle cx="${l[0]}" cy="${l[1]}" r="2.5" fill="var(--tint)"/></svg>`}
function trend(o){const h=o.hist||[];if(h.length<2)return'<span class="badge b-blue">Nueva</span>';
  const a=h[h.length-2].p,b=h[h.length-1].p;if(b<a)return`<span class="badge b-green">Bajó ${Math.round((a-b)/a*100)}%</span>`;if(b>a)return'<span class="badge b-red">Subió</span>';return''}
function cellOferta(o,showDest=true){const w=MIS.find(m=>m.iata===o.iata),hit=w&&w.max&&ppRT(o)<=w.max;
  return `<button type="button" class="cell ic" data-open="${esc(o.id)}">
    <span class="tile" style="background:${TILE[o.aerolinea]||'var(--teal)'}">${esc((o.aerolinea||'?').slice(0,2).toUpperCase())}</span>
    <span class="body"><span class="title">${esc(showDest?o.destino:o.aerolinea)}</span>
      <span class="detail" style="display:block">${showDest?esc(o.aerolinea)+' · ':''}${o.tipo==='ida'?'precio por tramo':'ida y vuelta'}${o.ida?` · ${fdate(o.ida)}${o.vuelta?' → '+fdate(o.vuelta):''}${o.fechasSugeridas?' (sugeridas)':''}`:''}</span>
      <span>${trend(o)}${hit?'<span class="badge b-green">Bajo tu precio</span>':''}${o.promo?`<span class="badge b-orange">${esc(o.promo)}</span>`:''}</span></span>
    <span class="right"><b class="mono">${showDest?CLP(total2(o)):CLP(ppRT(o))}</b><span class="mono">${showDest?CLP(o.precio)+' c/u':'por persona i/v'}</span>${showDest?spark(o.hist):''}</span>${CHEV}</button>`}

function drawOfertas(){
  let L=OFERTAS.slice();
  if(filtro==='nacional')L=L.filter(o=>NAC.has(o.iata));
  if(filtro==='internacional')L=L.filter(o=>!NAC.has(o.iata));
  if(filtro==='baja')L=L.filter(o=>{const h=o.hist||[];return h.length>1&&h[h.length-1].p<h[h.length-2].p});
  L.sort((a,b)=>total2(a)-total2(b));
  $('lista').innerHTML=L.length?L.map(o=>cellOferta(o)).join(''):'<div class="empty">No hay ofertas con este filtro.</div>';bindOpen($('lista'))}

function drawComp(){
  const by={};OFERTAS.forEach(o=>(by[o.iata]=by[o.iata]||[]).push(o));
  const groups=Object.values(by).map(g=>g.sort((a,b)=>ppRT(a)-ppRT(b))).sort((a,b)=>ppRT(a[0])-ppRT(b[0]));
  $('comp').innerHTML=groups.length?groups.map(g=>`<div class="group"><div class="ghead">${esc(g[0].destino)} · ${g.length} ${g.length>1?'aerolíneas':'aerolínea'}</div><div class="list">${g.map(o=>cellOferta(o,false)).join('')}</div>${g.length>1?`<div class="gfoot">Diferencia entre la más barata y la más cara: ${CLP(ppRT(g[g.length-1])-ppRT(g[0]))} por persona.</div>`:''}</div>`).join(''):'<div class="empty">Sin ofertas para comparar.</div>';
  bindOpen($('comp'))}

// ---------- detalle
function openDet(id){const o=OFERTAS.find(x=>x.id===id);if(!o)return;detId=id;
  Object.keys(TITLES).forEach(k=>$('v-'+k).hidden=true);$('v-det').hidden=false;$('v-ajustes').hidden=true;$('backBtn').hidden=false;$('navt').textContent=o.destino;
  try{history.pushState({det:1},'')}catch(e){}
  drawDet(o);window.scrollTo(0,0)}
function calendario(o){
  const cal=(o.cal||[]).filter(c=>c.p>0);if(!cal.length)return'';
  const ps=cal.map(c=>c.p).sort((a,b)=>a-b),lo=ps[Math.floor(ps.length*.25)],hi=ps[Math.floor(ps.length*.75)];
  const first=dd(cal[0].d),lead=(first.getUTCDay()+6)%7;
  const cells=[...Array(lead)].map(()=>'<div class="d x"></div>').concat(cal.map(c=>{const d=dd(c.d);
    return `<div class="d ${c.p<=lo?'lo':c.p>=hi?'hi':''} ${c.d===o.ida?'sel':''}"><span class="n">${d.getUTCDate()}/${d.getUTCMonth()+1}</span><span class="p">${Math.round(c.p/1000)}k</span></div>`}));
  // promedio por día de la semana
  const s={},n={};cal.forEach(c=>{const w=dd(c.d).getUTCDay();s[w]=(s[w]||0)+c.p;n[w]=(n[w]||0)+1});
  const order=[1,2,3,4,5,6,0].filter(w=>n[w]);const avg=w=>s[w]/n[w];const mx=Math.max(...order.map(avg));const best=order.reduce((a,b)=>avg(a)<=avg(b)?a:b);
  const cheapest=cal.reduce((a,b)=>a.p<=b.p?a:b);
  const tw=[2,3].filter(w=>n[w]).map(avg),twOK=tw.length&&Math.min(...tw)<=Math.min(...order.map(avg))*1.1;
  return `<div class="group"><div class="ghead">Calendario de precios · salida</div><div class="list">
    <div class="cal">${['L','M','M','J','V','S','D'].map(h=>`<div class="h">${h}</div>`).join('')}${cells.join('')}</div></div>
    <div class="gfoot">${esc(o.calNota||'')} Verde = 25% más barato. Rojo = 25% más caro. El borde azul marca la fecha de la oferta. Día más barato: <b>${fdate(cheapest.d)} a ${CLP(cheapest.p)}</b>.</div></div>
  <div class="group"><div class="ghead">¿Martes y miércoles son más baratos?</div><div class="list"><div class="wk">
    ${order.map(w=>`<div class="r ${w===best?'best':''}"><span>${DOW[w]}</span><span class="bar"><i style="width:${(avg(w)/mx*100).toFixed(0)}%"></i></span><span class="v">${CLP(avg(w))}</span></div>`).join('')}
  </div></div><div class="gfoot">Promedio por día de salida en esta ruta. ${twOK?'Aquí sí: martes o miércoles están entre los más baratos.':`En esta ruta no: el día más barato en promedio es el <b>${DOWL[best].toLowerCase()}</b>.`}</div></div>`}
function drawDet(o){
  const t=TARIFAS[o.aerolinea]||{};
  const others=OFERTAS.filter(x=>x.iata===o.iata&&x.id!==o.id).sort((a,b)=>ppRT(a)-ppRT(b));
  const enFecha=(o.cal||[]).find(c=>c.d===o.ida);
  const crowd=o.ida&&dd(o.ida).getUTCDay()===5||o.vuelta&&dd(o.vuelta).getUTCDay()===0;
  const vuelos=(o.vuelos||[]).map(v=>`<div class="flight ${v.tipo==='Directo'?'direct':''}"><div><div class="tm mono">${esc(v.sale)}</div><div class="ap">SCL</div></div>
    <div class="mid">${esc(v.dur)}<div class="line"><i></i></div>${esc(v.tipo)}</div><div style="text-align:right"><div class="tm mono">${esc(v.llega)}</div><div class="ap">${esc(o.iata)}</div></div>
    ${v.opera?`<div class="ap" style="grid-column:1/-1">Operado por ${esc(v.opera)}</div>`:''}</div>`).join('');
  $('v-det').innerHTML=`
  <div class="hero">
    <span class="k">${esc(o.aerolinea)}${o.promo?' · '+esc(o.promo):''}</span>
    <div class="big">${esc(o.destino)}</div>
    <div class="detail" style="color:var(--label2)">Santiago → ${esc(o.destino)} · ${o.tipo==='ida'?(o.tasas?'precio por tramo, tasas incluidas':'tarifa solo ida, sin tasas'):'ida y vuelta, precio final'}</div>
    <dl class="kv" style="margin:10px 0 0">
      <dt>Por persona${o.tipo==='ida'?' (un tramo)':''}</dt><dd class="mono">${CLP(o.precio)}</dd>
      <dt>Total ${NP()} ${NP()===1?'persona':'personas'} ida y vuelta</dt><dd class="mono" style="font-size:18px">${CLP(total2(o))}</dd>
      ${o.ida?`<dt>${o.fechasSugeridas?'Fechas sugeridas (la oferta no trae fechas)':'Fechas de la oferta'}</dt><dd>${fdate(o.ida)}${o.vuelta?' → '+fdate(o.vuelta):''}</dd>`:''}
      ${enFecha?`<dt>Ida ese día (calendario)</dt><dd class="mono">${CLP(enFecha.p)} c/u</dd>`:''}
    </dl>
    <div>${trend(o)}${crowd?'<span class="badge b-red">Viernes o domingo: más lleno</span>':''}</div>
  </div>
  ${vuelos?`<div class="group"><div class="ghead">Horarios · ida</div><div class="list">${vuelos}</div><div class="gfoot">Vuelos de la fecha de ida de la oferta.</div></div>`:`<div class="group"><div class="ghead">Horarios</div><div class="list"><div class="note">${o.aerolinea==='JetSMART'?'JetSMART no muestra horarios a la lectura automática. Los verás al comprar.':'Sin horarios disponibles todavía.'}</div></div></div>`}
  ${calendario(o)||`<div class="group"><div class="ghead">Calendario de precios</div><div class="list"><div class="note">Sin calendario para esta aerolínea todavía. SKY sí lo entrega; JetSMART y LATAM bloquean la lectura automática.</div></div></div>`}
  <div class="group"><div class="ghead">Equipaje y condiciones</div><div class="list">
    <div class="note">${esc(t.incluye||'Sin datos.')}</div>
    ${t.extras&&t.extras.length?`<div class="tw"><table class="bag"><thead><tr><th>Extra por persona y tramo</th><th>Con el pasaje</th><th>Después</th><th>Aeropuerto</th></tr></thead><tbody>${t.extras.map(e=>`<tr><td>${esc(e.item)}</td><td class="mono">${esc(e.compra)}</td><td class="mono">${esc(e.despues)}</td><td class="mono">${esc(e.aeropuerto)}</td></tr>`).join('')}</tbody></table></div>`:''}
    ${t.cambios?`<div class="note"><b>Cambios:</b> ${esc(t.cambios)}</div>`:''}
    ${t.consejo?`<div class="note" style="color:var(--tint)">${esc(t.consejo)}</div>`:''}
  </div>${t.fuente?`<div class="gfoot">Fuente: ${esc(t.fuente)}.</div>`:''}</div>
  ${o.aerolinea==='JetSMART'&&TARIFAS.JetSMART?`<div class="group"><div class="ghead">Costo real para ${NP()} con maleta de mano</div><div class="list"><div class="note">Pasajes ${CLP(total2(o))} + maleta de mano (${NP()*2} tramos × $12.900) ${CLP(NP()*2*12900)} = <b class="mono">${CLP(total2(o)+NP()*2*12900)}</b>.</div></div></div>`:''}
  <div class="group"><div class="ghead">Otras aerolíneas a ${esc(o.destino)}</div><div class="list">${others.length?others.map(x=>cellOferta(x,false)).join(''):'<div class="note">Hoy no hay otra aerolínea con oferta publicada a este destino. LATAM no se puede leer de forma automática.</div>'}</div></div>
  ${(o.hist||[]).length>1?`<div class="group"><div class="ghead">Historial de precio</div><div class="list"><div class="note">${o.hist.map(h=>`${fdate(h.f)}: <b class="mono">${CLP(h.p)}</b>`).join(' · ')}</div></div></div>`:''}
  <div class="buy">
    ${o.link?`<a class="btn" href="${esc(conPax(o.link))}" target="_blank" rel="noopener noreferrer">Comprar en ${esc(o.aerolinea)}</a>`:''}
    <div class="gfoot">Comprar es lo único que pasa en el sitio de la aerolínea, porque el pago se hace allí. Para no dejar rastro, mantén presionado el botón y elige "Abrir en pestaña de incógnito" (Chrome) o "Abrir en modo secreto" (Samsung Internet).</div>
  </div>`;
  bindOpen($('v-det'))}

// ---------- estado, destinos
function hace(iso){if(!iso)return'';const m=Math.round((Date.now()-new Date(iso))/60000);if(m<1)return'recién';if(m<60)return'hace '+m+' min';const h=Math.round(m/60);if(h<24)return'hace '+h+' h';return'hace '+Math.round(h/24)+' d'}
let ALERTAS=[],REFRESCADO=null,ACTUALIZANDO=false;
function drawStamp(){$('stamp').textContent=ACTUALIZANDO?'Actualizando…':(REFRESCADO?'Precios '+hace(REFRESCADO):'')}
function drawAlertas(){
  const L=ALERTAS.slice(0,6);$('alertasG').hidden=!L.length;
  $('alertas').innerHTML=L.map(x=>`<details class="alerta"><summary class="cell"><span class="tile" style="background:${TILE[x.fuente]||(x.tipo==='noticia'?'var(--label3)':'var(--teal)')}">${x.tipo==='noticia'?'📰':esc((x.fuente||'?').slice(0,2).toUpperCase())}</span>
    <span class="body"><span class="title">${esc(x.titulo)}</span><span class="detail" style="display:block">${esc(x.fuente)} · ${hace(x.fecha)}${x.importante?' · <b style="color:var(--orange)">relámpago</b>':''}</span></span></summary>
    ${x.resumen?`<div class="note">${esc(x.resumen)}</div>`:''}</details>`).join('')}
function drawEstado(e){
  if(!e){$('stamp').textContent='Sin datos';$('resumen').textContent='Todavía no hay una revisión diaria.';$('eventos').innerHTML='<div class="empty">Sin eventos registrados.</div>';return}
  const d=new Date(e.actualizado);
  $('resumen').textContent=e.resumen||'';
  const col={'En curso':'b-green','Pasó':'b-red'};
  $('eventos').innerHTML=(e.eventos||[]).map(x=>`<div class="cell"><span class="body"><span class="title">${esc(x.nombre)}</span><span class="detail" style="display:block">${esc(x.fechas)}${x.nota?' · '+esc(x.nota):''}</span></span><span class="badge ${col[x.estado]||'b-orange'}" style="margin:0">${esc(x.estado)}</span></div>`).join('')||'<div class="empty">Sin eventos registrados.</div>'}
function drawMis(){
  if(!MIS.length){$('mis').innerHTML='<div class="empty">Aún no tienes destinos. Agrega el primero arriba, por ejemplo LIM.</div>';return}
  $('mis').innerHTML=MIS.map(m=>{const best=OFERTAS.filter(o=>o.iata===m.iata).sort((a,b)=>ppRT(a)-ppRT(b))[0];const pp=best?ppRT(best):null;const hit=best&&m.max&&pp<=m.max;
    return `<div class="cell ic"><span class="tile" style="background:${hit?'var(--green)':'var(--tint)'}">${esc(m.iata)}</span>
      <span class="body"><span class="title">${esc(m.nombre||m.iata)}</span>
      <span class="detail" style="display:block">${best?`Hoy ${CLP(pp)} por persona en ${esc(best.aerolinea)}`:'Sin oferta publicada hoy'}${m.max?` · máx. ${CLP(m.max)}`:''}</span>
      ${hit?'<span class="badge b-green">Bajo tu precio</span>':''}${m.nota?`<span class="detail" style="display:block;font-size:13px">${esc(m.nota)}</span>`:''}
      <span style="display:flex;gap:18px;margin-top:6px">${best?`<button type="button" class="tintlink" data-open="${esc(best.id)}">Ver detalle</button>`:''}<button type="button" class="tintlink" style="color:var(--red)" data-del="${esc(m.id)}">Quitar</button></span></span></div>`}).join('');
  bindOpen($('mis'));
  $('mis').querySelectorAll('[data-del]').forEach(b=>b.onclick=async()=>{b.disabled=true;
    try{await enviar({accion:'quitarDestino',iata:b.dataset.del})}catch(e){b.disabled=false;b.textContent='No se pudo quitar'}})}
$('addf').addEventListener('submit',async e=>{e.preventDefault();
  const iata=$('aIata').value.toUpperCase().trim();
  if(!/^[A-Z]{3}$/.test(iata)){$('addMsg').textContent='El código tiene 3 letras, por ejemplo LIM para Lima.';return}
  if(!conf.url||!conf.key){$('addMsg').textContent='Primero configura la conexión en Ajustes (⚙︎).';return}
  try{await enviar({accion:'agregarDestino',destino:{iata,nombre:$('aNom').value.trim()||iata,max:+$('aMax').value||null,pago:$('aPay').value}});
    $('addMsg').textContent=`${iata} agregado. Se revisa desde mañana.`;$('addf').reset()}catch(err){$('addMsg').textContent='No se pudo guardar: '+err.message}});

function redraw(){drawOfertas();drawComp();drawMis();if(detId){const o=OFERTAS.find(x=>x.id===detId);if(o)drawDet(o)}}

// ---------- conexión con el cerebro (Apps Script), igual que Gin Malcriado
const C=window.VUELOS_CONFIG||{};
const conf={
  get url(){try{return localStorage.getItem('api_url')||C.API_URL_DEFAULT||''}catch(e){return C.API_URL_DEFAULT||''}},
  set url(v){try{localStorage.setItem('api_url',(v||'').trim())}catch(e){}},
  get key(){try{return localStorage.getItem('api_key')||''}catch(e){return''}},
  set key(v){try{localStorage.setItem('api_key',(v||'').trim().toUpperCase())}catch(e){}}
};
function aplicar(datos,desdeCache){
  OFERTAS=(datos.ofertas||[]).map(o=>({...o,id:o.id||((o.aerolinea||'x').toLowerCase().slice(0,3)+'-'+o.iata)}));
  MIS=(datos.seguimiento||[]).map(m=>({...m,id:m.iata}));
  TARIFAS=datos.tarifas||{};ALERTAS=datos.alertas||[];REFRESCADO=datos.refrescado||(datos.estado&&datos.estado.actualizado)||null;drawAlertas();
  drawEstado(datos.estado||null);redraw();drawStamp();
  if(desdeCache)$('stamp').textContent='Sin conexión · '+hace(REFRESCADO);
}
async function cargar(){
  if(!conf.url||!conf.key){$('stamp').textContent='Sin configurar';$('resumen').textContent='Toca ⚙︎ arriba a la derecha y escribe el servidor y tu clave. Se hace una sola vez.';$('lista').innerHTML='<div class="empty">Falta configurar la conexión.</div>';return}
  try{
    const r=await fetch(conf.url+(conf.url.includes('?')?'&':'?')+'clave='+encodeURIComponent(conf.key)+'&t='+Date.now());
    const j=await r.json();
    if(!j.ok){$('stamp').textContent='Clave incorrecta';$('resumen').textContent='El servidor rechazó la clave. Revísala en Ajustes (⚙︎).';return}
    try{localStorage.setItem('datos',JSON.stringify(j.datos))}catch(e){}
    aplicar(j.datos,false);
    // Pide al servidor que traiga los precios de este momento (tarda unos segundos).
    ACTUALIZANDO=true;drawStamp();
    try{const r2=await fetch(conf.url+(conf.url.includes('?')?'&':'?')+'clave='+encodeURIComponent(conf.key)+'&refrescar=1&t='+Date.now());const j2=await r2.json();
      if(j2.ok){try{localStorage.setItem('datos',JSON.stringify(j2.datos))}catch(e){}ACTUALIZANDO=false;aplicar(j2.datos,false)}}
    finally{ACTUALIZANDO=false;drawStamp()}
  }catch(err){
    let c=null;try{c=JSON.parse(localStorage.getItem('datos')||'null')}catch(e){}
    if(c)aplicar(c,true);else{$('stamp').textContent='Sin conexión';$('lista').innerHTML='<div class="empty">No hay internet y todavía no hay datos guardados en el teléfono.</div>'}
  }
}
async function enviar(cuerpo){
  const r=await fetch(conf.url,{method:'POST',headers:{'Content-Type':'text/plain;charset=utf-8'},body:JSON.stringify({...cuerpo,clave:conf.key})});
  const j=await r.json();
  if(!j.ok)throw new Error(j.error==='clave'?'clave incorrecta':j.error||'error');
  try{localStorage.setItem('datos',JSON.stringify(j.datos))}catch(e){}
  aplicar(j.datos,false);return j;
}

// ---------- ajustes
$('gearBtn').onclick=()=>{detId=null;Object.keys(TITLES).forEach(k=>$('v-'+k).hidden=true);$('v-det').hidden=true;$('v-ajustes').hidden=false;
  $('backBtn').hidden=false;$('navt').textContent='Ajustes';$('cUrl').value=conf.url;$('cKey').value=conf.key;window.scrollTo(0,0)};
$('cfgf').addEventListener('submit',async e=>{e.preventDefault();
  conf.url=$('cUrl').value;conf.key=$('cKey').value;$('cfgMsg').textContent='Probando…';
  try{const r=await fetch(conf.url+(conf.url.includes('?')?'&':'?')+'ping=1&clave='+encodeURIComponent(conf.key));const j=await r.json();
    if(j.ok){$('cfgMsg').innerHTML='<span class="ok">Conectado. Ya puedes volver a Hoy.</span>';cargar()}
    else $('cfgMsg').innerHTML='<span class="err">El servidor respondió, pero la clave no coincide.</span>'}
  catch(err){$('cfgMsg').innerHTML='<span class="err">No se pudo conectar. Revisa la dirección del servidor.</span>'}});

function drawPax(){$('paxTxt').textContent=paxTxt();$('pA').textContent=PAX.a;$('pN').textContent=PAX.n;$('totalTxt').textContent=`Ofertas · total para ${NP()} ${NP()===1?'persona':'personas'}`}
function setPax(k,d){const v=PAX[k]+d;if(k==='a'&&(v<1||v+PAX.n>9))return;if(k==='n'&&(v<0||v+PAX.a>9))return;PAX[k]=v;try{localStorage.setItem('pax',JSON.stringify(PAX))}catch(e){}drawPax();redraw()}
$('paxBtn').onclick=()=>{$('paxBox').hidden=!$('paxBox').hidden};
document.querySelectorAll('[data-pax]').forEach(b=>b.onclick=()=>setPax(b.dataset.pax,+b.dataset.d));
drawPax();
drawMis();
// Cargar los últimos datos guardados al instante y luego los nuevos.
try{const c=JSON.parse(localStorage.getItem('datos')||'null');if(c)aplicar(c,false)}catch(e){}
cargar();
document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible')cargar()});
