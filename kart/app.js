(function(){
"use strict";
var DATA = window.HK_DATA || {};
DATA.farms = DATA.farms || []; DATA.ops = DATA.ops || [];
var GEO = window.HK_GEO;

var KOMMUNER = ["Lesja","Dovre","Skjåk","Lom","Vågå","Sel","Nord-Fron","Sør-Fron","Ringebu","Øyer","Gausdal","Lillehammer"];
var STEDER = [["Dombås",62.074,9.124],["Lesja",62.124,8.857],["Lesjaskog",62.230,8.370],["Bjorli",62.258,8.204],["Dovre",61.985,9.250],
  ["Otta",61.773,9.539],["Sjoa",61.680,9.540],["Vågåmo",61.874,9.097],["Lom",61.838,8.567],["Bismo",61.882,8.268],
  ["Kvam",61.665,9.698],["Vinstra",61.596,9.751],["Hundorp",61.557,9.925],["Ringebu",61.528,10.140],["Fåvang",61.454,10.188],
  ["Tretten",61.314,10.300],["Øyer",61.265,10.416],["Lillehammer",61.115,10.466],["Follebu",61.226,10.278]];
var OMRADER = [["Rondane",61.90,9.80],["Jotunheimen",61.58,8.45],["Dovrefjell",62.27,9.45]];

/* ---------- small helpers ---------- */
function h(tag, attrs){
  var el = document.createElement(tag), i, k;
  attrs = attrs || {};
  for (k in attrs){
    var v = attrs[k];
    if (v == null || v === false) continue;
    if (k === "class") el.className = v;
    else if (k === "text") el.textContent = v;
    else if (k.slice(0,2) === "on") el.addEventListener(k.slice(2), v);
    else if (v === true) el.setAttribute(k, "");
    else el.setAttribute(k, v);
  }
  for (i = 2; i < arguments.length; i++){
    var c = arguments[i];
    if (c == null || c === false) continue;
    if (Array.isArray(c)) c.forEach(function(x){ if (x) el.append(x); });
    else el.append(c);
  }
  return el;
}
function uid(p){ return p + Math.random().toString(36).slice(2,8) + Date.now().toString(36).slice(-3); }
function clone(o){ return JSON.parse(JSON.stringify(o)); }
var ss = {
  get: function(k){ try { return sessionStorage.getItem(k); } catch(e){ return null; } },
  set: function(k,v){ try { sessionStorage.setItem(k,v); } catch(e){} },
  del: function(k){ try { sessionStorage.removeItem(k); } catch(e){} }
};
function plural(n, one, many){ return n + " " + (n === 1 ? one : many); }
function fmtDate(iso){
  if (!iso) return "";
  var m = ["jan.","feb.","mars","april","mai","juni","juli","aug.","sep.","okt.","nov.","des."];
  var d = new Date(iso + "T12:00:00");
  return isNaN(d) ? "" : d.getDate() + ". " + m[d.getMonth()] + " " + d.getFullYear();
}
function today(){ var d = new Date(); return d.getFullYear() + "-" + String(d.getMonth()+1).padStart(2,"0") + "-" + String(d.getDate()).padStart(2,"0"); }
function norm(s){ return (s || "").toLocaleLowerCase("nb"); }
function blobUrl(id){ return "/historier/" + id + ".pdf"; }

function utm33(lat, lon){
  var a=6378137,f=1/298.257222101,k0=0.9996,e2=f*(2-f),ep2=e2/(1-e2),l0=15*Math.PI/180;
  var p=lat*Math.PI/180,l=lon*Math.PI/180,s=Math.sin(p),c=Math.cos(p),t=Math.tan(p);
  var N=a/Math.sqrt(1-e2*s*s),T=t*t,C=ep2*c*c,A=c*(l-l0);
  var M=a*((1-e2/4-3*e2*e2/64-5*e2*e2*e2/256)*p-(3*e2/8+3*e2*e2/32+45*e2*e2*e2/1024)*Math.sin(2*p)+(15*e2*e2/256+45*e2*e2*e2/1024)*Math.sin(4*p)-(35*e2*e2*e2/3072)*Math.sin(6*p));
  var E=500000+k0*N*(A+(1-T+C)*Math.pow(A,3)/6+(5-18*T+T*T+72*C-58*ep2)*Math.pow(A,5)/120);
  var Nn=k0*(M+N*t*(A*A/2+(5-T+9*C+4*C*C)*Math.pow(A,4)/24+(61-58*T+T*T+600*C-330*ep2)*Math.pow(A,6)/720));
  return [E, Nn];
}
function norgeskartUrl(lat, lon){
  var u = utm33(lat, lon);
  return "https://norgeskart.no/#!?project=norgeskart&layers=1002&zoom=13&lat=" + u[1].toFixed(0) + "&lon=" + u[0].toFixed(0) + "&markerLat=" + u[1].toFixed(0) + "&markerLon=" + u[0].toFixed(0);
}
function flyfotoUrl(lat, lon){ return "https://www.google.com/maps?q=" + lat.toFixed(5) + "," + lon.toFixed(5) + "&t=k"; }

function inRing(pt, ring){
  var x = pt[0], y = pt[1], inside = false;
  for (var i = 0, j = ring.length - 1; i < ring.length; j = i++){
    var xi = ring[i][0], yi = ring[i][1], xj = ring[j][0], yj = ring[j][1];
    if (((yi > y) !== (yj > y)) && (x < (xj - xi) * (y - yi) / (yj - yi) + xi)) inside = !inside;
  }
  return inside;
}
function kommuneAt(lat, lon){
  var pt = [lon, lat];
  for (var i = 0; i < GEO.dal.length; i++){
    var k = GEO.dal[i];
    for (var j = 0; j < k.c.length; j++){
      var po = k.c[j];
      if (po.length && inRing(pt, po[0])){
        var hole = false;
        for (var r = 1; r < po.length; r++) if (inRing(pt, po[r])) hole = true;
        if (!hole) return k.n;
      }
    }
  }
  return "";
}
function ringCentroid(ring){
  var A=0,cx=0,cy=0;
  for (var i=0,j=ring.length-1;i<ring.length;j=i++){
    var f=ring[j][0]*ring[i][1]-ring[i][0]*ring[j][1];
    A+=f; cx+=(ring[j][0]+ring[i][0])*f; cy+=(ring[j][1]+ring[i][1])*f;
  }
  A*=0.5; return {a:Math.abs(A), lon:cx/(6*A), lat:cy/(6*A)};
}
function parsePos(s){
  var m = (s || "").replace(/[°NØEnøe]/g, " ").match(/(-?\d+(?:[.,]\d+)?)\s*[,; ]\s*(-?\d+(?:[.,]\d+)?)/);
  if (!m) return null;
  var a = parseFloat(m[1].replace(",", ".")), b = parseFloat(m[2].replace(",", "."));
  if (a > 55 && a < 72 && b > 3 && b < 32) return [a, b];
  if (b > 55 && b < 72 && a > 3 && a < 32) return [b, a];
  return null;
}

/* ---------- state ---------- */
var state = { view: "list", farmId: null, q: "", draft: null, storyDraft: null, confirm: null, busy: false, msg: "", err: "" };
var canEdit = false, ART = null, ASSETS = null, DOWNLOADS = null;

function farmById(id){ return DATA.farms.find(function(f){ return f.id === id; }) || null; }

function applyOp(data, op){
  var i, f;
  if (op.type === "upsertFarm"){
    f = data.farms.find(function(x){ return x.id === op.farm.id; });
    if (f){ f.name = op.farm.name; f.lat = op.farm.lat; f.lon = op.farm.lon; f.kommune = op.farm.kommune; }
    else data.farms.push({ id: op.farm.id, name: op.farm.name, lat: op.farm.lat, lon: op.farm.lon, kommune: op.farm.kommune, stories: [] });
  } else if (op.type === "deleteFarm"){
    data.farms = data.farms.filter(function(x){ return x.id !== op.farmId; });
  } else if (op.type === "upsertStory"){
    f = data.farms.find(function(x){ return x.id === op.farmId; });
    if (!f) throw new Error("farm_missing");
    i = f.stories.findIndex(function(s){ return s.id === op.story.id; });
    if (i >= 0) f.stories[i] = op.story; else f.stories.push(op.story);
  } else if (op.type === "deleteStory"){
    f = data.farms.find(function(x){ return x.id === op.farmId; });
    if (f) f.stories = f.stories.filter(function(s){ return s.id !== op.storyId; });
  }
  return data;
}

async function commit(op, openFarmId){
  if (!ART){ setErr("Lagring er ikke tilgjengelig i denne visningen."); return; }
  op.opId = uid("o");
  var next;
  try { next = applyOp(clone(DATA), op); }
  catch(e){ setErr("Gården finnes ikke lenger. Den kan ha blitt slettet av noen andre."); return; }
  next.ops = (next.ops || []).concat(op.opId).slice(-40);
  ss.set("hk-pending", JSON.stringify(op));
  if (openFarmId) ss.set("hk-open", openFarmId); else ss.del("hk-open");
  state.busy = true; state.msg = "Lagrer kartet …"; render();
  try {
    await ART.publish(renderDoc(next));
    state.msg = "Lagret. Kartet lastes på nytt …"; render();
  } catch(e){
    state.busy = false; state.msg = "";
    var code = e && e.code;
    if (code === "conflict"){ state.msg = "Kartet ble nettopp endret av noen andre. Siden lastes på nytt, og du får lagre endringen din igjen."; render(); return; }
    ss.del("hk-pending");
    if (code === "not_writer" || code === "not_granted" || code === "capability_disabled" || code === "capability_removed"){
      canEdit = false; setErr("Du har bare lesetilgang. Eirik må dele kartet med deg som redaktør for at du skal kunne lagre.");
    } else if (code === "too_large") setErr("Kartet ble for stort til å lagres. Prøv å korte ned ingressen.");
    else if (code === "rate_limited") setErr("For mange lagringer på kort tid. Vent et minutt og prøv igjen.");
    else setErr("Lagringen feilet. Prøv igjen om litt.");
  }
}
function setErr(m){ state.err = m; render(); }

/* ---------- build shell ---------- */
var root = document.getElementById("root");
var qInput = h("input", { id: "q", type: "search", placeholder: "Søk etter gård eller historie", "aria-label": "Søk", autocomplete: "off" });
var statsEl = h("div", { class: "stats", "aria-live": "polite" });
var newBtn = h("button", { class: "btn primary", id: "newFarm", hidden: true, type: "button", onclick: startNewFarm, text: "+ Ny gård" });
var banner = h("div", { class: "banner", hidden: true, role: "status" });
var pbody = h("div", { class: "pbody", id: "pbody" });
var panel = h("aside", { class: "panel", id: "panel", "aria-label": "Historier" },
  h("button", { class: "sheet-handle", type: "button", "aria-label": "Vis eller skjul panelet", onclick: function(){ panel.classList.toggle("is-collapsed"); } }),
  pbody);
var mapEl = h("div", { id: "map" });
root.append(h("div", { class: "app" },
  h("header", { class: "top" },
    h("a", { class: "brand", href: "/" }, h("span", { class: "eyebrow", text: "Historia om Gudbrandsdalen" }), h("h1", { text: "Historiekart" })),
    h("div", { class: "search" }, qInput),
    h("div", { class: "spacer" }),
    statsEl, h("a", { class: "btn small", href: "/", text: "‹ Forsiden" }), newBtn),
  h("main", { class: "stage" }, mapEl, banner, panel)));

qInput.addEventListener("input", function(){ state.q = qInput.value; if (state.view !== "list"){ state.view = "list"; state.farmId = null; } render(); });

/* ---------- map ---------- */
var map = L.map(mapEl, { attributionControl: false, minZoom: 7.5, maxZoom: 13, zoomSnap: 0.5, maxBounds: [[59.8,5.5],[63.4,12.8]], maxBoundsViscosity: 0.6 });
L.control.attribution({ prefix: false, position: "bottomleft" }).addAttribution('Kart: &copy; <a href="https://www.kartverket.no" target="_blank" rel="noopener">Kartverket</a> (CC BY 4.0)').addTo(map);
/* Topografisk norgeskart (Kartverket), lagret som bilder per zoomnivå */
var TOPO = [{"z":7,"u":"topo/bc365219edf5d4f515fff962eda67b68.jpg","b":[[60.239811,5.625],[62.915233,14.0625]]},{"z":8,"u":"topo/5648ba4f7ea0a3c686ecc18f80f3e2c2.jpg","b":[[60.239811,5.625],[62.915233,12.65625]]},{"z":9,"u":"topo/0e850d289386d2f2be80a7e6d18bf0ef.jpg","b":[[60.586967,6.328125],[62.915233,11.953125]]},{"z":10,"u":"topo/3bffe94f28943b3cd33d828a05994421.jpg","b":[[60.586967,6.328125],[62.754726,11.953125]]},{"z":11,"u":"topo/c7b6be5d7b159b30f92a4c186f7c0fd3.jpg","b":[[61.438767,6.328125],[62.754726,9.140625]]},{"z":11,"u":"topo/f08db696833212bc2755a6b1ce4d8415.jpg","b":[[60.673179,6.328125],[61.438767,9.140625]]},{"z":11,"u":"topo/b238fd81326001013aed91b820e0ff3f.jpg","b":[[61.438767,9.140625],[62.754726,11.953125]]},{"z":11,"u":"topo/f7a9909f6169494c53826770c3c27fd0.jpg","b":[[60.673179,9.140625],[61.438767,11.953125]]}];
map.createPane("topo").style.zIndex = 250;
var topoLevels = {}, topoShown = null;
TOPO.forEach(function(t){
  var g = topoLevels[t.z] || (topoLevels[t.z] = L.layerGroup());
  var ov = L.imageOverlay(t.u, t.b, { pane: "topo", className: "topo", interactive: false });
  ov.on("load", function(){ document.body.classList.add("has-topo"); });
  g.addLayer(ov);
});
function updateTopo(){
  var lv = Math.min(11, Math.max(7, Math.ceil(map.getZoom() - 0.25)));
  if (topoShown === lv || !topoLevels[lv]) return;
  var prev = topoShown; topoShown = lv;
  topoLevels[lv].addTo(map);
  if (prev != null) setTimeout(function(){ if (topoShown !== prev) map.removeLayer(topoLevels[prev]); }, 700);
}
map.on("zoomend", updateTopo);
function ll(r){ return r.map(function(p){ return [p[1], p[0]]; }); }
GEO.nabo.forEach(function(k){ L.polygon(k.c.map(function(po){ return po.map(ll); }), { className: "k-nabo", interactive: false }).addTo(map); });
var dalBounds = L.latLngBounds([]);
GEO.dal.forEach(function(k){
  var poly = L.polygon(k.c.map(function(po){ return po.map(ll); }), { className: "k-dal", interactive: false }).addTo(map);
  dalBounds.extend(poly.getBounds());
  var best = null;
  k.c.forEach(function(po){ var c = ringCentroid(po[0]); if (!best || c.a > best.a) best = c; });
  if (best) L.marker([best.lat, best.lon], { interactive: false, keyboard: false, icon: L.divIcon({ className: "lbl lbl-k", html: "<span>" + k.n.toUpperCase() + "</span>", iconSize: [0,0] }) }).addTo(map);
});
GEO.sjo.forEach(function(s){ L.polygon(s.c.map(function(po){ return po.map(ll); }), { className: "sjo", interactive: false }).addTo(map); });
GEO.elv.forEach(function(l){ L.polyline(ll(l), { className: "elv", interactive: false }).addTo(map); });
(GEO.vei || []).forEach(function(l){ L.polyline(ll(l), { className: "vei-kant", interactive: false }).addTo(map); });
(GEO.vei || []).forEach(function(l){ L.polyline(ll(l), { className: "vei", interactive: false }).addTo(map); });
(GEO.vei || []).forEach(function(l){
  var picks = l.length > 40 ? [0.2, 0.5, 0.8] : [0.5];
  picks.forEach(function(t){ var p = l[Math.floor((l.length - 1) * t)];
    L.marker([p[1], p[0]], { interactive: false, keyboard: false, icon: L.divIcon({ className: "lbl lbl-vei", html: "<span>E6</span>", iconSize: [0,0] }) }).addTo(map); });
});
STEDER.forEach(function(s){ L.marker([s[1], s[2]], { interactive: false, keyboard: false, icon: L.divIcon({ className: "lbl lbl-s", html: "<span>" + s[0] + "</span>", iconSize: [0,0] }) }).addTo(map); });
OMRADER.forEach(function(s){ L.marker([s[1], s[2]], { interactive: false, keyboard: false, icon: L.divIcon({ className: "lbl lbl-o", html: "<span>" + s[0] + "</span>", iconSize: [0,0] }) }).addTo(map); });
function fitDal(){
  var narrow = window.innerWidth <= 720;
  map.fitBounds(dalBounds, narrow ? { paddingTopLeft: [10, 10], paddingBottomRight: [10, 90] } : { paddingTopLeft: [10, 10], paddingBottomRight: [400, 10] });
}
fitDal();
function zoomClass(){
  var z = map.getZoom(), c = mapEl.classList;
  c.toggle("z-lo", z < 9); c.toggle("z-hi", z >= 11.5);
}
map.on("zoomend", zoomClass); zoomClass(); updateTopo();

var pinLayer = L.layerGroup().addTo(map);
var markers = {};
var draftMarker = null;
function esc(s){ return String(s).replace(/[&<>"']/g, function(c){ return { "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;" }[c]; }); }
function pinIcon(f, sel){
  return L.divIcon({ className: "pin" + (sel ? " is-sel" : ""), iconSize: [28,28], iconAnchor: [3,25],
    html: '<span class="dot"></span><span class="n">' + f.stories.length + '</span><span class="pin-name">' + esc(f.name) + "</span>" });
}
function drawPins(){
  pinLayer.clearLayers(); markers = {};
  var editingId = state.view === "farmEdit" && state.draft ? state.draft.id : null;
  DATA.farms.forEach(function(f){
    if (f.id === editingId) return;
    var m = L.marker([f.lat, f.lon], { icon: pinIcon(f, f.id === state.farmId), title: f.name, riseOnHover: true, zIndexOffset: f.id === state.farmId ? 500 : 0 });
    m.on("click", function(){ if (state.view === "farmEdit") return; openFarm(f.id, true); });
    m.addTo(pinLayer); markers[f.id] = m;
  });
}
function setDraftMarker(){
  if (draftMarker){ map.removeLayer(draftMarker); draftMarker = null; }
  var d = state.view === "farmEdit" ? state.draft : null;
  if (!d || d.lat == null) return;
  draftMarker = L.marker([d.lat, d.lon], { draggable: true, zIndexOffset: 1000,
    icon: L.divIcon({ className: "pin draft", iconSize: [28,28], iconAnchor: [3,25], html: '<span class="dot"></span><span class="n">+</span>' }) }).addTo(map);
  draftMarker.on("dragend", function(){ var p = draftMarker.getLatLng(); placeDraft(p.lat, p.lng, false); });
}
function placeDraft(lat, lon, redraw){
  var d = state.draft; if (!d) return;
  d.lat = +lat.toFixed(5); d.lon = +lon.toFixed(5);
  var k = kommuneAt(d.lat, d.lon);
  if (k || !d.kommuneTouched) d.kommune = k;
  var pos = document.getElementById("f-pos"); if (pos) pos.value = d.lat.toFixed(5) + ", " + d.lon.toFixed(5);
  var ks = document.getElementById("f-kommune"); if (ks && !d.kommuneTouched) ks.value = d.kommune;
  document.body.classList.remove("picking");
  if (redraw !== false) setDraftMarker();
  renderBanner();
}
map.on("click", function(e){
  if (state.view === "farmEdit" && state.draft && !state.busy){ placeDraft(e.latlng.lat, e.latlng.lng); return; }
  if (isNarrow() && state.view === "list") panel.classList.add("is-collapsed");
});
function isNarrow(){ return window.innerWidth <= 720; }
/* Pan so the point lands in the part of the map the panel does not cover */
function panToVisible(lat, lon){
  var ll = L.latLng(lat, lon);
  if (!isNarrow()) { map.panTo(ll); return; }
  var cover = panel.classList.contains("is-collapsed") ? 0 : panel.offsetHeight;
  var pt = map.project(ll, map.getZoom()).add([0, cover / 2]);
  map.panTo(map.unproject(pt, map.getZoom()));
}
if (isNarrow()) panel.classList.add("is-collapsed");
pbody.addEventListener("click", function(e){
  if (panel.classList.contains("is-collapsed")){ panel.classList.remove("is-collapsed"); e.preventDefault(); e.stopPropagation(); }
}, true);

/* ---------- navigation ---------- */
function openFarm(id, pan){
  var f = farmById(id); if (!f) return;
  state.view = "farm"; state.farmId = id; state.confirm = null; state.err = "";
  panel.classList.remove("is-collapsed");
  try { if (location.hash !== "#" + id) location.hash = id; } catch(e){}
  render();
  if (pan) panToVisible(f.lat, f.lon);
}
function toList(){
  state.view = "list"; state.farmId = null; state.confirm = null; state.err = "";
  try { if (location.hash) history.replaceState(null, "", location.pathname + location.search); } catch(e){}
  render();
}
function startNewFarm(){
  if (state.busy) return;
  state.view = "farmEdit"; state.draft = { id: null, name: "", lat: null, lon: null, kommune: "" }; state.err = ""; state.confirm = null;
  panel.classList.remove("is-collapsed");
  document.body.classList.add("picking");
  render();
}
function editFarm(f){
  state.view = "farmEdit"; state.draft = { id: f.id, name: f.name, lat: f.lat, lon: f.lon, kommune: f.kommune || "" }; state.err = ""; state.confirm = null;
  render();
}
function editStory(f, s){
  state.view = "storyEdit"; state.farmId = f.id; state.err = "";
  state.storyDraft = s ? { id: s.id, title: s.title, summary: s.summary || "", pdf: s.pdf || null, added: s.added } : { id: null, title: "", summary: "", pdf: null };
  render();
}
window.addEventListener("hashchange", function(){
  var id = (location.hash || "").slice(1);
  if (id && farmById(id) && state.farmId !== id && state.view !== "farmEdit" && state.view !== "storyEdit") openFarm(id, true);
});

/* ---------- panel views ---------- */
function render(){
  var nF = DATA.farms.length, nS = DATA.farms.reduce(function(a, f){ return a + f.stories.length; }, 0);
  statsEl.textContent = plural(nF, "gård", "gårder") + " · " + plural(nS, "historie", "historier");
  newBtn.hidden = !canEdit || state.view === "farmEdit";
  pbody.replaceChildren();
  if (state.view === "farm") viewFarm();
  else if (state.view === "farmEdit") viewFarmEdit();
  else if (state.view === "storyEdit") viewStoryEdit();
  else viewList();
  drawPins(); setDraftMarker(); renderBanner();
}

function viewList(){
  var q = norm(state.q).trim();
  var farms = DATA.farms.map(function(f){
    if (!q) return { f: f, hits: [] };
    var nameHit = norm(f.name).indexOf(q) >= 0 || norm(f.kommune).indexOf(q) >= 0;
    var hits = f.stories.filter(function(s){ return norm(s.title).indexOf(q) >= 0 || norm(s.summary).indexOf(q) >= 0; });
    return (nameHit || hits.length) ? { f: f, hits: hits } : null;
  }).filter(Boolean);

  pbody.append(h("h2", { text: q ? "Søkeresultat" : "Gårder og steder" }));
  if (!DATA.farms.length){
    pbody.append(h("div", { class: "empty" },
      h("p", { text: "Ingen gårder er lagt inn ennå." }),
      canEdit ? h("p", { text: "Trykk «+ Ny gård» øverst, klikk der gården ligger i kartet, og gi den et navn. Deretter kan du legge til historier med PDF." })
              : h("p", { text: "Her kommer historiene fra Historia om Gudbrandsdalen, plassert på gårdene og stedene de handler om." })));
  } else if (!farms.length){
    pbody.append(h("div", { class: "empty" }, h("p", { text: "Fant ingen gårder eller historier som passer med «" + state.q + "»." })));
  } else {
    var order = KOMMUNER.concat([""]);
    order.forEach(function(k){
      var list = farms.filter(function(x){ return k ? x.f.kommune === k : KOMMUNER.indexOf(x.f.kommune) < 0; });
      if (!list.length) return;
      list.sort(function(a, b){ return a.f.name.localeCompare(b.f.name, "nb"); });
      pbody.append(h("div", { class: "group" },
        h("p", { class: "sec-title", text: k || "Utenfor dalen" }),
        list.map(function(x){
          return h("button", { class: "farm-row", type: "button", onclick: function(){ openFarm(x.f.id, true); } },
            h("span", null, h("b", { text: x.f.name }),
              x.hits.length ? h("span", { class: "hits", text: x.hits.map(function(s){ return s.title; }).join(" · ") }) : null),
            h("span", { class: "c", text: plural(x.f.stories.length, "historie", "historier") }));
        })));
    });
  }
  pbody.append(h("p", { class: "credit", text: "Bakgrunnskart og kommunegrenser © Kartverket (CC BY 4.0). Kartet viser ikke enkelttun i detalj; bruk «Vis i Norgeskart» ved hver gård for å se nærmere." }));
}

function viewFarm(){
  var f = farmById(state.farmId);
  if (!f){ toList(); return; }
  pbody.append(h("button", { class: "linkbtn", type: "button", onclick: toList, text: "‹ Alle gårder" }));
  pbody.append(h("div", { class: "stack tight" },
    h("h2", { text: f.name }),
    h("div", { class: "meta" },
      f.kommune ? h("span", { text: f.kommune + " kommune" }) : null,
      h("a", { href: norgeskartUrl(f.lat, f.lon), target: "_blank", rel: "noopener", text: "Vis i Norgeskart" }),
      h("a", { href: flyfotoUrl(f.lat, f.lon), target: "_blank", rel: "noopener", text: "Flyfoto" }))));
  if (state.err) pbody.append(h("p", { class: "err", text: state.err }));
  if (state.msg) pbody.append(h("p", { class: "status", text: state.msg }));

  if (!f.stories.length){
    pbody.append(h("div", { class: "empty" }, h("p", { text: canEdit ? "Ingen historier her ennå. Legg til den første." : "Ingen historier her ennå." })));
  } else {
    var wrap = h("div", { class: "stack" });
    f.stories.forEach(function(s){
      var c = state.confirm && state.confirm.storyId === s.id;
      wrap.append(h("article", { class: "story" },
        h("h3", { text: s.title }),
        s.summary ? h("p", { text: s.summary }) : null,
        h("div", { class: "row" },
          s.pdf ? h("button", { class: "btn primary small", type: "button", onclick: function(){ openReader(f, s); }, text: "Les historien" })
                : null,
          canEdit && !c ? h("button", { class: "btn small", type: "button", disabled: state.busy, onclick: function(){ editStory(f, s); }, text: "Endre" }) : null,
          canEdit && !c ? h("button", { class: "btn small danger", type: "button", disabled: state.busy, onclick: function(){ state.confirm = { storyId: s.id }; render(); }, text: "Slett" }) : null),
        c ? h("div", { class: "confirm" },
              h("p", { text: "Slette «" + s.title + "» fra kartet?" }),
              h("div", { class: "row" },
                h("button", { class: "btn small danger", type: "button", disabled: state.busy, onclick: function(){ commit({ type: "deleteStory", farmId: f.id, storyId: s.id }, f.id); }, text: "Slett historien" }),
                h("button", { class: "btn small", type: "button", onclick: function(){ state.confirm = null; render(); }, text: "Avbryt" }))) : null,
        s.added ? h("span", { class: "when", text: "Lagt inn " + fmtDate(s.added) }) : null));
    });
    pbody.append(wrap);
  }
  if (canEdit){
    pbody.append(h("div", { class: "row" },
      h("button", { class: "btn primary", type: "button", disabled: state.busy, onclick: function(){ editStory(f, null); }, text: "+ Legg til historie" }),
      h("button", { class: "btn", type: "button", disabled: state.busy, onclick: function(){ editFarm(f); }, text: "Endre gård" })));
  }
}

function viewFarmEdit(){
  var d = state.draft, isNew = !d.id;
  var opts = [h("option", { value: "", text: "Velg kommune" })].concat(KOMMUNER.map(function(k){ return h("option", { value: k, text: k }); }));
  var sel = h("select", { id: "f-kommune", onchange: function(){ d.kommune = sel.value; d.kommuneTouched = true; } }, opts);
  sel.value = d.kommune || "";
  var name = h("input", { type: "text", id: "f-name", value: d.name, maxlength: "80", placeholder: "For eksempel Bjølstad", oninput: function(){ d.name = name.value; } });
  var pos = h("input", { type: "text", id: "f-pos", value: d.lat != null ? d.lat.toFixed(5) + ", " + d.lon.toFixed(5) : "", placeholder: "61.77310, 9.53900",
    onchange: function(){ var p = parsePos(pos.value); if (p){ placeDraft(p[0], p[1]); panToVisible(p[0], p[1]); state.err = ""; } else { state.err = "Fant ikke koordinater i teksten. Skriv dem som 61.77310, 9.53900."; render(); } } });
  var form = h("form", { novalidate: true, onsubmit: function(e){
      e.preventDefault();
      d.name = name.value.trim();
      if (!d.name){ state.err = "Gården trenger et navn."; render(); return; }
      if (d.lat == null){ state.err = "Klikk i kartet der gården ligger, eller skriv inn koordinater."; render(); return; }
      var id = d.id || uid("g");
      commit({ type: "upsertFarm", farm: { id: id, name: d.name, lat: d.lat, lon: d.lon, kommune: sel.value || kommuneAt(d.lat, d.lon) } }, id);
    } },
    h("label", null, "Navn på gård eller sted", name),
    h("label", null, "Plassering", pos, h("span", { class: "hint", text: "Klikk i kartet, eller dra markøren. Du kan også lime inn koordinater fra Google Maps (høyreklikk på stedet der)." })),
    h("label", null, "Kommune", sel, h("span", { class: "hint", text: "Fylles ut automatisk når du plasserer gården." })),
    state.err ? h("p", { class: "err", text: state.err }) : null,
    state.msg ? h("p", { class: "status", text: state.msg }) : null,
    h("div", { class: "row" },
      h("button", { class: "btn primary", type: "submit", disabled: state.busy, text: isNew ? "Lagre gården" : "Lagre endringer" }),
      h("button", { class: "btn", type: "button", disabled: state.busy, onclick: function(){ document.body.classList.remove("picking"); state.draft = null; if (isNew) toList(); else openFarm(d.id, false); }, text: "Avbryt" })));
  pbody.append(h("h2", { text: isNew ? "Ny gård" : "Endre " + d.name }), form);
  if (!isNew){
    var f = farmById(d.id), c = state.confirm && state.confirm.farmId === d.id;
    pbody.append(c ? h("div", { class: "confirm" },
        h("p", { text: "Slette " + d.name + (f && f.stories.length ? " og " + plural(f.stories.length, "historie", "historier") : "") + " fra kartet?" }),
        h("div", { class: "row" },
          h("button", { class: "btn small danger", type: "button", disabled: state.busy, onclick: function(){ commit({ type: "deleteFarm", farmId: d.id }, null); }, text: "Slett gården" }),
          h("button", { class: "btn small", type: "button", onclick: function(){ state.confirm = null; render(); }, text: "Avbryt" })))
      : h("div", null, h("button", { class: "btn small danger", type: "button", disabled: state.busy, onclick: function(){ state.confirm = { farmId: d.id }; render(); }, text: "Slett gården" })));
  }
  if (isNew && d.lat == null) setTimeout(function(){ try { name.focus(); } catch(e){} }, 0);
}

function viewStoryEdit(){
  var f = farmById(state.farmId), d = state.storyDraft;
  if (!f){ toList(); return; }
  var isNew = !d.id;
  var title = h("input", { type: "text", id: "s-title", value: d.title, maxlength: "140", oninput: function(){ d.title = title.value; } });
  var summary = h("textarea", { id: "s-summary", maxlength: "5000", placeholder: "Skriv historien her, eller et par setninger om hva PDF-en handler om", oninput: function(){ d.summary = summary.value; } });
  summary.value = d.summary;
  var file = h("input", { type: "file", id: "s-pdf", accept: "application/pdf,.pdf" });
  var form = h("form", { novalidate: true, onsubmit: async function(e){
      e.preventDefault();
      d.title = title.value.trim(); d.summary = summary.value.trim();
      if (!d.title){ state.err = "Historien trenger en tittel."; render(); return; }
      if (!d.summary && !(file.files && file.files[0]) && !(d.pdf && !d.removePdf)){ state.err = "Skriv litt tekst eller velg en PDF, så det er noe å lese."; render(); return; }
      var picked = file.files && file.files[0];
      var pdf = d.removePdf ? null : d.pdf;
      if (picked){
        if (!/\.pdf$/i.test(picked.name) && picked.type !== "application/pdf"){ state.err = "Filen må være en PDF."; render(); return; }
        if (picked.size > 20 * 1024 * 1024){ state.err = "PDF-filen er større enn 20 MB. Lagre den med mindre bilder i Word og prøv igjen."; render(); return; }
        if (!ASSETS){ state.err = "Du har ikke tilgang til å laste opp filer her. Eirik må dele kartet med deg som redaktør."; render(); return; }
        state.busy = true; state.err = ""; state.msg = "Laster opp PDF …"; render();
        try {
          var blob = picked.type === "application/pdf" ? picked : new Blob([picked], { type: "application/pdf" });
          var up = await ASSETS.upload(blob);
          pdf = { id: up.id, name: picked.name, size: up.sizeBytes };
        } catch(err){
          state.busy = false; state.msg = "";
          var c = err && err.code;
          state.err = c === "too_large" ? "PDF-filen er for stor." : c === "unsupported_type" ? "Filen ble ikke godtatt som PDF." : c === "quota_exceeded" ? "Lagringsplassen for filer er full." : "Opplastingen feilet. Prøv igjen.";
          render(); return;
        }
      }
      commit({ type: "upsertStory", farmId: f.id, story: { id: d.id || uid("h"), title: d.title, summary: d.summary, pdf: pdf, added: d.added || today() } }, f.id);
    } },
    h("label", null, "Tittel", title),
    h("label", null, h("span", null, "Tekst ", h("span", { class: "hint", text: "(valgfritt)" })), summary),
    h("label", null, h("span", null, d.pdf ? "Bytt PDF " : "PDF med historien ", h("span", { class: "hint", text: "(valgfritt)" })), file,
      d.pdf ? (d.removePdf ? h("span", { class: "hint" }, "PDF-en fjernes når du lagrer. ", h("button", { class: "linkbtn", type: "button", onclick: function(){ d.removePdf = false; render(); }, text: "Angre" }))
        : h("span", { class: "hint" }, "Nå: " + (d.pdf.name || "PDF") + " · ", h("button", { class: "linkbtn", type: "button", onclick: function(){ d.removePdf = true; render(); }, text: "Fjern PDF" }))) : h("span", { class: "hint", text: "Har du skrevet historien i Word, lagre den som PDF og velg filen her. Du kan også legge den til senere." })),
    state.err ? h("p", { class: "err", text: state.err }) : null,
    state.msg ? h("p", { class: "status", text: state.msg }) : null,
    h("div", { class: "row" },
      h("button", { class: "btn primary", type: "submit", disabled: state.busy, text: isNew ? "Lagre historien" : "Lagre endringer" }),
      h("button", { class: "btn", type: "button", disabled: state.busy, onclick: function(){ state.storyDraft = null; openFarm(f.id, false); }, text: "Avbryt" })));
  pbody.append(h("p", { class: "sec-title", text: f.name }), h("h2", { text: isNew ? "Ny historie" : "Endre historie" }), form);
}


/* ---------- PDF reader (shows the story inside the page) ---------- */
var PDFJS_BASE = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/";
var pdfjsReady = null;
function loadScript(src){
  return new Promise(function(res, rej){ var el = document.createElement("script"); el.src = src; el.onload = res; el.onerror = function(){ rej(new Error("script")); }; document.head.appendChild(el); });
}
function loadPdfJs(){
  if (!pdfjsReady) pdfjsReady = loadScript(PDFJS_BASE + "pdf.worker.min.js").then(function(){ return loadScript(PDFJS_BASE + "pdf.min.js"); }).then(function(){
    var lib = window.pdfjsLib; if (!lib) throw new Error("pdfjs");
    lib.GlobalWorkerOptions.workerSrc = PDFJS_BASE + "pdf.worker.min.js";
    return lib;
  });
  pdfjsReady.catch(function(){ pdfjsReady = null; });
  return pdfjsReady;
}
var readerEl = null, readerJob = 0, readerReturn = null;
function closeReader(){
  if (!readerEl) return;
  readerJob++; readerEl.remove(); readerEl = null;
  document.removeEventListener("keydown", readerKey);
  if (readerReturn) try { readerReturn.focus(); } catch(e){}
}
function readerKey(e){ if (e.key === "Escape") closeReader(); }
async function openReader(f, s){
  closeReader();
  readerReturn = document.activeElement;
  var job = ++readerJob;
  var status = h("p", { class: "reader-status", role: "status", text: "Henter historien …" });
  var pages = h("div", { class: "reader-pages" });
  var saveBtn = h("a", { class: "btn small", href: blobUrl(s.pdf.id), download: s.pdf.name || (s.title + ".pdf"), text: "Last ned PDF" });
  var closeBtn = h("button", { class: "btn small", type: "button", "aria-label": "Lukk", onclick: closeReader, text: "Lukk" });
  readerEl = h("div", { class: "reader", role: "dialog", "aria-modal": "true", "aria-label": s.title, onclick: function(e){ if (e.target === readerEl) closeReader(); } },
    h("div", { class: "reader-box" },
      h("div", { class: "reader-head" },
        h("div", { class: "reader-title" }, h("span", { class: "sec-title", text: f.name }), h("h2", { text: s.title })),
        h("div", { class: "row" }, saveBtn, closeBtn)),
      h("div", { class: "reader-scroll" }, status, pages)));
  document.getElementById("root").append(readerEl);
  document.addEventListener("keydown", readerKey);
  closeBtn.focus();
  var bytes;
  try {
    var res = await fetch(blobUrl(s.pdf.id));
    if (!res.ok) throw new Error("http " + res.status);
    bytes = await res.arrayBuffer();
  } catch(e){ if (job === readerJob) status.textContent = "Fant ikke PDF-filen. Den kan ha blitt slettet, eller nettet er nede. Prøv igjen om litt."; return; }
  var lib;
  try { lib = await loadPdfJs(); } catch(e){ if (job === readerJob) status.textContent = "Klarte ikke å laste PDF-leseren. Sjekk nettforbindelsen og prøv igjen."; return; }
  try {
    var doc = await lib.getDocument({ data: new Uint8Array(bytes.slice(0)), isEvalSupported: false }).promise;
    if (job !== readerJob) return;
    status.textContent = doc.numPages === 1 ? "1 side" : doc.numPages + " sider";
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    for (var i = 1; i <= doc.numPages; i++){
      if (job !== readerJob) return;
      var page = await doc.getPage(i);
      var w = Math.max(280, pages.clientWidth || 700);
      var vp1 = page.getViewport({ scale: 1 });
      var vp = page.getViewport({ scale: (w / vp1.width) * dpr });
      var c = document.createElement("canvas");
      c.width = Math.floor(vp.width); c.height = Math.floor(vp.height);
      c.setAttribute("aria-label", "Side " + i + " av " + doc.numPages);
      pages.append(c);
      await page.render({ canvasContext: c.getContext("2d"), viewport: vp }).promise;
    }
  } catch(e){ if (job === readerJob) status.textContent = "PDF-filen kunne ikke vises. Prøv å lagre den på nytt fra Word som PDF."; }
}

/* ---------- banner (placing + unsaved changes) ---------- */
var pending = null;
function renderBanner(){
  banner.replaceChildren(); banner.classList.remove("warn");
  if (pending && canEdit){
    banner.classList.add("warn");
    banner.append(h("p", { text: "En endring ble ikke lagret fordi kartet ble endret samtidig." }),
      h("button", { class: "btn small primary", type: "button", disabled: state.busy, onclick: function(){ var op = pending; pending = null; delete op.opId; commit(op, ss.get("hk-open")); }, text: "Lagre på nytt" }),
      h("button", { class: "btn small", type: "button", onclick: function(){ pending = null; ss.del("hk-pending"); renderBanner(); }, text: "Forkast" }));
    banner.hidden = false; return;
  }
  if (state.view === "farmEdit" && state.draft && state.draft.lat == null){
    banner.append(h("p", { text: "Klikk i kartet der gården ligger." }));
    banner.hidden = false; return;
  }
  banner.hidden = true;
}

/* ---------- start ---------- */
(function restore(){
  var raw = ss.get("hk-pending");
  if (raw){
    try { var op = JSON.parse(raw); if (DATA.ops.indexOf(op.opId) >= 0) ss.del("hk-pending"); else pending = op; } catch(e){ ss.del("hk-pending"); }
  }
  var open = ss.get("hk-open"); ss.del("hk-open");
  var id = (location.hash || "").slice(1);
  if (!pending && open && farmById(open)) { openFarm(open, true); return; }
  if (id && farmById(id)) { openFarm(id, true); return; }
  render();
})();

(async function caps(){
  if (!window.claude || !window.claude.use) return;
  try {
    var r = await Promise.all([window.claude.use("artifact"), window.claude.use("user"), window.claude.use("assets"), window.claude.use("downloads")]);
    ART = r[0]; ASSETS = r[2]; DOWNLOADS = r[3];
    canEdit = !!(ART && r[1] && await r[1].canEdit());
  } catch(e){ canEdit = false; }
  if (!canEdit) pending = null;
  render();
})();
})();
