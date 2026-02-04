
const CONFIG = {
  SPREADSHEET_ID: "1sIzswZnMkyRPJejAsE_ylSKzAF0RmFiACP4jYtz-AE0",
  API_BASE: "https://script.google.com/macros/s/AKfycbz-Td3cnbMkGRVW4kFXvlvD58O6yygQ-U2aJ7vHSkxAFrAsR5j7QhMFt0xrGg4gZQLb/exec",
  SHEET_MAIN: "BÜTÜN OYUNLAR",
  SHEET_FIGURAN: "FİGÜRAN LİSTESİ",
  SHEET_NOTIFS: "BİLDİRİMLER",


  // Ana veri (genelde: "BÜTÜN OYUNLAR")
  GID: "1233566992",

  // Apps Script'in oluşturduğu LOG sayfasının gid'sini buraya yaz (URL'den kopyala: ...?gid=XXXX)
  LOG_GID: "",

  sheetUrl(gid=this.GID){ return `https://docs.google.com/spreadsheets/d/${this.SPREADSHEET_ID}/edit?gid=${gid}`; },
  gvizUrl(gid=this.GID){ return `https://docs.google.com/spreadsheets/d/${this.SPREADSHEET_ID}/gviz/tq?gid=${gid}&tqx=out:json&_=${Date.now()}`; },
  csvUrl(gid=this.GID){  return `https://docs.google.com/spreadsheets/d/${this.SPREADSHEET_ID}/export?format=csv&gid=${gid}&_=${Date.now()}`; },
};

function isMobile(){
  return window.matchMedia && window.matchMedia("(max-width: 980px)").matches;
}

// Filtre eşleşmeleri: boşluk / büyük-küçük harf / görünmez karakter farklarını tolere et
function normKey(s){
  return String(s||"")
    .trim()
    .toLowerCase()
    .normalize("NFKC")
    .replace(/\s+/g, " ");
}

function openMobileModal(html){
  if(!isMobile()) return;
  els.mobileContent.innerHTML = html;
  els.mobileOverlay.classList.remove("hidden");
  els.mobileModal.classList.remove("hidden");
  els.mobileOverlay.setAttribute("aria-hidden","false");
  document.body.style.overflow="hidden";
}
function closeMobileModal(){
  els.mobileOverlay.classList.add("hidden");
  els.mobileModal.classList.add("hidden");
  els.mobileOverlay.setAttribute("aria-hidden","true");
  document.body.style.overflow="";
}

const el = (id)=>document.getElementById(id);
const els = {
  themeBtn: el("themeBtn"),
  status: el("status"),
  sheetBtn: el("sheetBtn"),
  reloadBtn: el("reloadBtn"),
  notifBtn: el("notifBtn"),
  notifPanel: el("notifPanel"),
  notifCount: el("notifCount"),
  notifList: el("notifList"),
  notifRefresh: el("notifRefresh"),
  notifClose: el("notifClose"),

  tabPanel: el("tabPanel"),
  tabDistribution: el("tabDistribution"),
  tabIntersection: el("tabIntersection"),
  tabFiguran: el("tabFiguran"),
  tabCharts: el("tabCharts"),

  viewPanel: el("viewPanel"),
  viewDistribution: el("viewDistribution"),
  viewIntersection: el("viewIntersection"),
  viewFiguran: el("viewFiguran"),
  viewCharts: el("viewCharts"),

  q: el("q"),
  category: el("category"),
  clearBtn: el("clearBtn"),
  list: el("list"),
  hint: el("hint"),
  details: el("details"),
  copyBtn: el("copyBtn"),

  btnPlays: el("btnPlays"),
  btnPeople: el("btnPeople"),

  dq: el("dq"),
  dClear: el("dClear"),
  distributionBox: el("distributionBox"),

  p1: el("p1"),
  p2: el("p2"),
  swapBtn: el("swapBtn"),
  intersectionBox: el("intersectionBox"),

  fq: el("fq"),
  fClear: el("fClear"),
  figuranBox: el("figuranBox"),
  figDownloadAllBtn: el("figDownloadAllBtn"),
  figDownloadFilteredBtn: el("figDownloadFilteredBtn"),

  chartTabRoles: el("chartTabRoles"),
  chartTabCats: el("chartTabCats"),
  chartTitle: el("chartTitle"),
  chartMain: el("chartMain"),

  drawer: el("chartDrawer"),
  drawerTitle: el("drawerTitle"),
  drawerSub: el("drawerSub"),
  drawerClose: el("drawerClose"),
  drawerSearch: el("drawerSearch"),
  drawerList: el("drawerList"),

  kpiPlays: el("kpiPlays"),
  kpiPeople: el("kpiPeople"),
  kpiRows: el("kpiRows"),
  kpiFiguran: el("kpiFiguran"),
};
els.sheetBtn.href = CONFIG.sheetUrl();

let rawRows = [];
let rows = [];
let plays = [];
let people = [];
let playsList = [];
let activeMode = "plays";
let activeId = null;
let selectedItem = null;

let distribution = [];
let figuran = [];
let retiredSet = new Set();
let activePlayFilter = null; // mobilde: oyundan kişilere geçince filtre

let chartMode = "roles"; // roles | cats
let chartHits = []; // clickable regions
let drawerData = [];

/* ---------- Theme toggle ---------- */
function applyTheme(theme){
  document.documentElement.setAttribute("data-theme", theme);
  localStorage.setItem("idt_theme", theme);
}
(function initTheme(){
  const saved = localStorage.getItem("idt_theme");
  if(saved === "dark" || saved === "light") applyTheme(saved);
  else applyTheme(window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
})();
els.themeBtn.addEventListener("click", ()=>{
  const cur = document.documentElement.getAttribute("data-theme") || "light";
  applyTheme(cur === "dark" ? "light" : "dark");
  if(rows.length && els.viewCharts.style.display!=="none"){ drawChart(); }
});

/* ---------- helpers ---------- */
function setStatus(text, tone="") {
  els.status.textContent = text;
  els.status.style.borderColor = "";
  els.status.style.background = "";
  els.status.style.color = "var(--muted)";
  if (tone === "ok") {
    els.status.style.borderColor = "color-mix(in srgb, var(--good) 25%, var(--line) 75%)";
    els.status.style.background = "color-mix(in srgb, var(--good) 10%, var(--card) 90%)";
    els.status.style.color = "var(--good)";
  } else if (tone === "bad") {
    els.status.style.borderColor = "color-mix(in srgb, var(--bad) 25%, var(--line) 75%)";
    els.status.style.background = "color-mix(in srgb, var(--bad) 10%, var(--card) 90%)";
    els.status.style.color = "var(--bad)";
  } else if (tone === "warn") {
    els.status.style.borderColor = "color-mix(in srgb, var(--warn) 25%, var(--line) 75%)";
    els.status.style.background = "color-mix(in srgb, var(--warn) 10%, var(--card) 90%)";
    els.status.style.color = "var(--warn)";
  } else {
    els.status.style.borderColor = "var(--line)";
    els.status.style.background = "var(--card)";
  }
}
function escapeHtml(s) {
  return (s ?? "").toString()
    .replaceAll("&","&amp;")
    .replaceAll("<","&lt;")
    .replaceAll(">","&gt;")
    .replaceAll('"',"&quot;")
    .replaceAll("'","&#039;");
}

function personTag(name){
  const n=(name||"").toString().trim();
  return (n && retiredSet && retiredSet.has(n)) ? `<span class="tag retired">Kurumdan Emekli Sanatçı</span>` : "";
}

function normalizeHeader(h){ return (h||"").trim().toLowerCase().replace(/\s+/g," "); }
function cssVar(name){ return getComputedStyle(document.documentElement).getPropertyValue(name).trim(); }

/* ---------- load from Google ---------- */
function parseGviz(text){
  const m = text.match(/setResponse\((.*)\);?\s*$/s);
  if(!m) throw new Error("GViz formatı okunamadı.");
  return JSON.parse(m[1]);
}
function buildFromGviz(obj){
  const table = obj?.table;
  const cols = (table?.cols||[]).map(c=>(c.label||"").trim());
  const dataRows = (table?.rows||[]).map(r=>(r.c||[]).map(cell => (cell?.v ?? "")));

  const hn = cols.map(normalizeHeader);
  const need = ["oyun adı","kategori","görev","kişi"];
  if(!need.every(n=>hn.includes(n))) throw new Error("Başlıklar farklı: Oyun Adı / Kategori / Görev / Kişi");

  const idx = { play: hn.indexOf("oyun adı"), cat: hn.indexOf("kategori"), role: hn.indexOf("görev"), person: hn.indexOf("kişi") };
  const out=[];
  for(const r of dataRows){
    const play=(r[idx.play]??"").toString().trim();
    const category=(r[idx.cat]??"").toString().trim();
    const role=(r[idx.role]??"").toString().trim();
    const person=(r[idx.person]??"").toString().trim();
    if(!play && !person && !role && !category) continue;
    if(!play) continue;
    out.push({play, category, role, person});
  }
  return out;
}
function csvToRows(csvText){
  const rows=[]; let cur="", inQ=false; let row=[];
  for(let i=0;i<csvText.length;i++){
    const ch=csvText[i], next=csvText[i+1];
    if(ch === '"' && inQ && next === '"'){ cur+='"'; i++; }
    else if(ch === '"'){ inQ=!inQ; }
    else if(ch === ',' && !inQ){ row.push(cur); cur=""; }
    else if((ch === '\n' || ch === '\r') && !inQ){
      if(ch === '\r' && next === '\n') i++;
      row.push(cur); cur="";
      if(row.some(v=>v!=="")) rows.push(row);
      row=[];
    } else cur+=ch;
  }
  row.push(cur);
  if(row.some(v=>v!=="")) rows.push(row);
  return rows;
}
function buildFromCsv(raw){
  const need=["oyun adı","kategori","görev","kişi"];
  let headerIdx=-1;
  for(let i=0;i<Math.min(raw.length,30);i++){
    const hdr=raw[i].map(normalizeHeader);
    if(need.every(n=>hdr.includes(n))){ headerIdx=i; break; }
  }
  if(headerIdx===-1) throw new Error("Başlık satırı bulunamadı. (CSV)");
  const header=raw[headerIdx].map(x=>(x||"").trim());
  const hn=header.map(normalizeHeader);
  const idx={ play: hn.indexOf("oyun adı"), cat: hn.indexOf("kategori"), role: hn.indexOf("görev"), person: hn.indexOf("kişi") };

  const out=[];
  for(let i=headerIdx+1;i<raw.length;i++){
    const r=raw[i];
    const play=(r[idx.play]||"").trim();
    const category=(r[idx.cat]||"").trim();
    const role=(r[idx.role]||"").trim();
    const person=(r[idx.person]||"").trim();
    if(!play && !person && !role && !category) continue;
    if(!play) continue;
    out.push({play, category, role, person});
  }
  return out;
}

function jsonp(url, timeoutMs=20000){
  return new Promise((resolve, reject)=>{
    const cb = "idt_cb_" + Math.random().toString(36).slice(2);
    const s = document.createElement("script");
    let done=false;
    const t = setTimeout(()=>{
      if(done) return;
      done=true;
      cleanup();
      reject(new Error("JSONP zaman aşımı"));
    }, timeoutMs);

    function cleanup(){
      clearTimeout(t);
      try{ delete window[cb]; }catch{}
      if(s && s.parentNode) s.parentNode.removeChild(s);
    }

    window[cb] = (data)=>{
      if(done) return;
      done=true;
      cleanup();
      resolve(data);
    };

    const sep = url.includes("?") ? "&" : "?";
    s.src = url + sep + "callback=" + cb + "&_=" + Date.now();
    s.onerror = ()=>{
      if(done) return;
      done=true;
      cleanup();
      reject(new Error("JSONP yüklenemedi"));
    };
    document.body.appendChild(s);
  });
}

async function tryLoadApiJsonp(){
  if(!CONFIG.API_BASE) throw new Error("API_BASE tanımlı değil");
  const url = `${CONFIG.API_BASE}?sheet=${encodeURIComponent(CONFIG.SHEET_MAIN)}`;
  const data = await jsonp(url);
  if(!data || data.ok !== true || !Array.isArray(data.rows)) throw new Error("API veri formatı beklenmedik");
  // API -> ham satırlar
  return data.rows.map(r=>({
    play: String(r["Oyun Adı"] ?? r["Oyun Adi"] ?? r["Oyun"] ?? "").trim(),
    category: String(r["Kategori"] ?? "").trim(),
    role: String(r["Görev"] ?? r["Gorev"] ?? "").trim(),
    person: String(r["Kişi"] ?? r["Kisi"] ?? "").trim(),
  })).filter(x=>x.play && x.person);
}

async function tryLoadGviz(){
  const res = await fetch(CONFIG.gvizUrl(), {cache:"no-store"});
  if(!res.ok) throw new Error(`GViz indirilemedi (${res.status}).`);
  const txt = await res.text();
  return buildFromGviz(parseGviz(txt));
}
async function tryLoadCsv(){
  const res = await fetch(CONFIG.csvUrl(), {cache:"no-store"});
  if(!res.ok) throw new Error(`CSV indirilemedi (${res.status}).`);
  const csv = await res.text();
  return buildFromCsv(csvToRows(csv));
}

/* ---------- split general ---------- */
function splitPeopleGeneral(cell){
  const s = (cell||"").toString().trim();
  if(!s) return [];
  const normalized = s
    .replace(/\r?\n/g, " | ")
    .replace(/;/g, " | ")
    .replace(/\s*\/\s*/g, " | ")
    .replace(/\s*,\s*/g, " | ")
    .replace(/\s+\bve\b\s+/gi, " | ");
  const parts = normalized.split("|").map(x=>x.trim()).filter(Boolean);
  const uniq=[]; const seen=new Set();
  for(const p of parts){
    const key=p.toLowerCase();
    if(!seen.has(key)){ seen.add(key); uniq.push(p); }
  }
  return uniq.length ? uniq : [s];
}
function expandRowsByPeople(data){
  const out=[];
  for(const r of data){
    const people = splitPeopleGeneral(r.person);
    if(!people.length){ out.push({...r, person:""}); continue; }
    for(const p of people){ out.push({...r, person:p}); }
  }
  return out;
}

/* ---------- Apps Script compatible figuran extraction ---------- */
function splitPeopleTokensApps(text){
  const cleaned = (text||"").toString().replace(/\r/g, "\n").trim();
  return cleaned.split(/[\n,;]+/g).map(s=>s.trim()).filter(Boolean);
}
function hasFiguranTag(token){
  return /\(\s*fig[üu]ran\s*\)/i.test((token||"").toString());
}
function stripFiguranTag(token){
  return (token||"").toString().replace(/\(\s*fig[üu]ran\s*\)/ig, "").replace(/^"+|"+$/g, "").trim();
}
function computeRetiredSetFromRaw(){
  const set = new Set();
  for(const r of rawRows){
    const kategoriRaw = (r.category||"").trim().toLowerCase();
    if(/kurumdan\s*emekl/i.test(kategoriRaw) && r.person){
      const tokens = splitPeopleTokensApps((r.person||"").trim());
      for(const t of tokens){
        const name = stripFiguranTag(t);
        if(name) set.add(name);
      }
    }
  }
  return set;
}

function computeFiguranFromRaw(){
  // Apps Script ile aynı mantık:
  // - Kategori "Kurumdan Emekli Sanatçı" ise: kişi(ler)i direkt al
  // - Kategori figüran ise:
  //   - tek kişi: al
  //   - çok kişi: sadece (Figüran) etiketlileri al
  const map = new Map();

  for(const r of rawRows){
    const oyun = (r.play||"").trim();
    const kategoriRaw = (r.category||"").trim();
    const gorevRaw = (r.role||"").trim();
    const kisiRaw = (r.person||"").trim();
    if(!kisiRaw) continue;

    const kategoriLower = kategoriRaw.toLowerCase();
    const isRetiredArtist = /kurumdan\s*emekl/i.test(kategoriLower);
    const isFiguranCategory = /fig[üu]ran/i.test(kategoriLower);
    if(!isRetiredArtist && !isFiguranCategory) continue;

    const tokens = splitPeopleTokensApps(kisiRaw);
    if(!tokens.length) continue;

    let selectedPeople = [];
    if(isRetiredArtist){
      selectedPeople = tokens.map(stripFiguranTag).filter(Boolean);
    }else{
      if(tokens.length === 1){
        selectedPeople = [stripFiguranTag(tokens[0])].filter(Boolean);
      }else{
        selectedPeople = tokens.filter(hasFiguranTag).map(stripFiguranTag).filter(Boolean);
      }
    }
    if(!selectedPeople.length) continue;

    for(const kisi of selectedPeople){
      if(!map.has(kisi)) map.set(kisi, {games:new Set(), roles:new Set(), cats:new Set(), rows:0});
      const obj = map.get(kisi);
      obj.cats.add(isRetiredArtist ? "Kurumdan Emekli Sanatçı" : "Figüran");
      if(oyun) obj.games.add(oyun);
      if(gorevRaw) obj.roles.add(gorevRaw);
      obj.rows += 1;
    }
  }

  const out = [...map.entries()].map(([person, obj])=>({
    person,
    cats:[...obj.cats].sort((a,b)=>a.localeCompare(b,"tr")),
    plays:[...obj.games].sort((a,b)=>a.localeCompare(b,"tr")),
    roles:[...obj.roles].sort((a,b)=>a.localeCompare(b,"tr")),
    rows: obj.rows
  }));
  out.sort((a,b)=>a.person.localeCompare(b.person,"tr"));
  return out;
}


/* ---------- notifications (LOG) ---------- */
function parseLogFromGviz(obj){
  const table = obj?.table;
  const cols = (table?.cols||[]).map(c=>(c.label||"").trim());
  const dataRows = (table?.rows||[]).map(r=>(r.c||[]).map(cell => (cell?.v ?? "")));
  // Beklenen başlıklar (Apps Script): Tarih/Saat, İşlem, Kişi, ...
  // Farklılık olursa yine de ilk 3 sütunu baz alırız.
  const out = [];
  for(const r of dataRows){
    const when = (r[0] ?? "").toString();
    const action = (r[1] ?? "").toString();
    const person = (r[2] ?? "").toString();
    const beforeCat = (r[3] ?? "").toString();
    const afterCat  = (r[4] ?? "").toString();
    const beforeRole= (r[5] ?? "").toString();
    const afterRole = (r[6] ?? "").toString();
    const beforePlay= (r[7] ?? "").toString();
    const afterPlay = (r[8] ?? "").toString();
    if(!when && !action && !person) continue;
    out.push({when, action, person, beforeCat, afterCat, beforeRole, afterRole, beforePlay, afterPlay});
  }
  // yeni -> eski
  return out.reverse();
}


async function loadNotifications(){
  if(!els.notifPanel) return;

  // BİLDİRİMLER sheet'i yoksa / boşsa kibarca göster
  try{
    const url = `${CONFIG.API_BASE}?sheet=${encodeURIComponent(CONFIG.SHEET_NOTIFS)}`;
    const data = await jsonp(url);
    if(!data || data.ok !== true || !Array.isArray(data.rows)){
      els.notifList.innerHTML = `<div class="empty">🔔 Bildirimler okunamadı.</div>`;
      els.notifCount.textContent = "";
    els.notifCount.classList.add("hidden");
      return;
    }

    // Beklenen kolonlar: Tarih, Tür, Başlık, Mesaj, Oyun, Kişi, Okundu
    const rows = data.rows.map(r=>({
      ts: String(r["Tarih"] ?? r["Tarih/Saat"] ?? r["Tarih Saat"] ?? "").trim(),
      type: String(r["Tür"] ?? r["Tur"] ?? "🔔").trim() || "🔔",
      title: String(r["Başlık"] ?? r["Baslik"] ?? "").trim(),
      msg: String(r["Mesaj"] ?? r["Açıklama"] ?? r["Aciklama"] ?? "").trim(),
      play: String(r["Oyun"] ?? "").trim(),
      person: String(r["Kişi"] ?? r["Kisi"] ?? "").trim(),
      read: String(r["Okundu"] ?? "").trim()
    })).filter(x=>x.ts || x.title || x.msg);

    // newest first (basit)
    rows.reverse();

    // local okundu (site tarafı): imza üzerinden
    const seen = JSON.parse(localStorage.getItem("idt_seen_notifs") || "{}");
    const norm = (x)=> (x||"").toString().slice(0,120);
    rows.forEach(n=>{
      const key = `${norm(n.ts)}|${norm(n.type)}|${norm(n.title)}|${norm(n.msg)}|${norm(n.play)}|${norm(n.person)}`;
      n._key = key;
      n._seen = !!seen[key];
    });

    const unread = rows.filter(n=>!n._seen).length;
    if(unread){
      els.notifCount.classList.remove("hidden");
      els.notifCount.textContent = String(unread);
    } else {
      els.notifCount.textContent = "";
      els.notifCount.classList.add("hidden");
    }

    if(!rows.length){

      els.notifList.innerHTML = `<div class="empty">🔔 Bildirim yok.</div>`;
      return;
    }

    els.notifList.innerHTML = rows.map(n=>{
      const meta = [n.play, n.person].filter(Boolean).join(" • ");
      const who = meta ? `<div class="notif-meta">${escapeHtml(meta)}</div>` : "";
      const title = n.title ? `<div class="notif-title">${escapeHtml(n.title)}</div>` : "";
      const msg = n.msg ? `<div class="notif-msg">${escapeHtml(n.msg)}</div>` : "";
      const ts  = n.ts ? `<div class="notif-ts">${escapeHtml(n.ts)}</div>` : "";
      const cls = n._seen ? "notif-bubble seen" : "notif-bubble";
      return `<div class="${cls}" data-key="${escapeHtml(n._key)}">
        <div class="notif-type">${escapeHtml(n.type)}</div>
        <div class="notif-body">
          ${title}${msg}${who}${ts}
        </div>
      </div>`;
    }).join("");

    // tıkla → okundu yap
    els.notifList.querySelectorAll(".notif-bubble").forEach(el=>{
      el.addEventListener("click", ()=>{
        const key = el.getAttribute("data-key");
        if(!key) return;
        const seen2 = JSON.parse(localStorage.getItem("idt_seen_notifs") || "{}");
        seen2[key]=true;
        localStorage.setItem("idt_seen_notifs", JSON.stringify(seen2));
        el.classList.add("seen");
        // badge güncelle
        const left = Array.from(els.notifList.querySelectorAll(".notif-bubble")).filter(x=>!x.classList.contains("seen")).length;
        if(left){ els.notifCount.classList.remove("hidden"); els.notifCount.textContent=String(left); } else { els.notifCount.textContent=""; els.notifCount.classList.add("hidden"); }
      });
    });

  }catch(err){
    console.error(err);
    els.notifList.innerHTML = `<div class="empty">🔔 Bildirimler yüklenemedi. (API/JSONP)
<br><span class="small muted">Not: Apps Script doGet içinde JSONP (callback) açık olmalı.</span></div>`;
    els.notifCount.textContent = "";
    els.notifCount.classList.add("hidden");
  }
}

/* ---------- transforms ---------- */
function groupByPlay(data){
  const map=new Map();
  for(const r of data){ if(!map.has(r.play)) map.set(r.play,[]); map.get(r.play).push(r); }
  const out=[...map.entries()].map(([playName, items])=>{
    const cats=[...new Set(items.map(x=>x.category).filter(Boolean))].sort((a,b)=>a.localeCompare(b,"tr"));
    const persons=[...new Set(items.map(x=>x.person).filter(Boolean))].sort((a,b)=>a.localeCompare(b,"tr"));
    return { id:`play:${playName}`, title: playName, cats, count: persons.length, rows: items };
  });
  out.sort((a,b)=>a.title.localeCompare(b.title,"tr"));
  return out;
}
function groupByPerson(data){
  const map=new Map();
  for(const r of data){
    if(!r.person) continue;
    if(!map.has(r.person)) map.set(r.person,[]);
    map.get(r.person).push(r);
  }
  const out=[...map.entries()].map(([personName, items])=>{
    const cats=[...new Set(items.map(x=>x.category).filter(Boolean))].sort((a,b)=>a.localeCompare(b,"tr"));
    const roles=[...new Set(items.map(x=>x.role).filter(Boolean))].sort((a,b)=>a.localeCompare(b,"tr"));
    const plays=[...new Set(items.map(x=>x.play).filter(Boolean))].sort((a,b)=>a.localeCompare(b,"tr"));
    return { id:`person:${personName}`, title: personName, cats, roles, plays, count: plays.length, rows: items };
  });
  out.sort((a,b)=>a.title.localeCompare(b.title,"tr"));
  return out;
}
function uniqCategories(data){
  const cats=[...new Set(data.map(x=>x.category).filter(Boolean))];
  cats.sort((a,b)=>a.localeCompare(b,"tr"));
  return cats;
}
function chipTone(cat){
  const t=(cat||"").toLowerCase();
  if(t.includes("figüran") || t.includes("figuran")) return "warn";
  if(t.includes("yönetim") || t.includes("yonetim")) return "good";
  if(t.includes("oyuncu")) return "bad";
  return "";
}
function applyFilters(list){
  const q=els.q.value.trim().toLowerCase();
  const cat="";
return list.filter(it=>{
    const hay = (activeMode==="plays")
      ? (it.title+" "+it.cats.join(" ")+" "+it.rows.map(r=>`${r.person} ${r.role}`).join(" ")).toLowerCase()
      : (it.title+" "+it.cats.join(" ")+" "+(it.roles||[]).join(" ")+" "+(it.plays||[]).join(" ")).toLowerCase();
    if(activeMode==="people" && activePlayFilter){
      const playKey = normKey(activePlayFilter);
      if(!((it.plays||[]).some(p=>normKey(p)===playKey))) return false;
    }
    if(q && !hay.includes(q)) return false;
    if(cat){
      const cats=(it.cats||[]).map(x=>x.toLowerCase());
      if(!cats.some(x=>x.includes(cat))) return false;
    }
    return true;
  });
}

/* ---------- UI render ---------- */
function renderList(){
  const source = (activeMode==="plays") ? plays : people;
  const filtered = applyFilters(source);

  els.list.innerHTML="";
  if(!filtered.length){
    els.list.innerHTML = `<div class="empty">Sonuç yok 😅</div>`;
    els.hint.textContent = "";
    return;
  }

  for(const it of filtered){
    const isActive = it.id===activeId;
    const meta = (activeMode==="plays")
      ? `${it.count} kişi • ${it.rows.length} satır`
      : `${it.count} oyun • ${it.rows.length} satır`;

    const chips = (it.cats||[]).slice(0,6).map(c=>`<span class="chip ${chipTone(c)}">${escapeHtml(c)}</span>`).join("");
    const more = (it.cats||[]).length>6 ? `<span class="chip">+${it.cats.length-6}</span>` : "";
    const retiredTag = (activeMode==="people" && retiredSet.has(it.title)) ? `<span class="tag retired">Kurumdan Emekli Sanatçı</span>` : "";

    const div=document.createElement("div");
    div.className="item";
    if(isActive) div.style.borderColor="color-mix(in srgb, var(--accent) 35%, var(--line) 65%)";
    div.innerHTML = `
      <div class="t">
        <div>
          <div class="name">${escapeHtml(it.title)}${retiredTag}</div>
          <div class="meta">${escapeHtml(meta)}</div>
        </div>
        <div style="color:var(--muted);font-size:12px">▶</div>
      </div>
      <div class="chips">${chips}${more}</div>
    `;
    div.addEventListener("click", ()=>{
      activeId=it.id;
      selectedItem = it;
      renderList();
      renderDetails(it);

      if(isMobile() && activeMode==="plays"){
        // Mobilde oyun seçince: oyun filtresi ile Kişiler listesine geç
        activePlayFilter = it.title;
        activeMode="people";
        els.btnPeople.classList.add("active");
        els.btnPlays.classList.remove("active");

        // Filtreli kişi listesi
        renderList();

        setStatus(`📌 Oyun seçildi: ${activePlayFilter} • Kişiler listesi`, "ok");

        // Geri tuşu ile tekrar Oyunlar'a dönsün
        history.pushState({mode:"people", play:activePlayFilter}, "");
        window.scrollTo({top:0, behavior:"smooth"});
      }

    });
    els.list.appendChild(div);
  }


  if(isMobile() && activeMode==="people" && activePlayFilter){
    els.hint.innerHTML = `<div class="mobile-breadcrumb"><button class="btn sm" id="btnBackPlays">← Oyunlar</button><span class="mb-text">${escapeHtml(activePlayFilter)} ekibi • ${filtered.length} kişi</span></div>`;
    setTimeout(()=>{
      const b=document.getElementById("btnBackPlays");
      if(b) b.onclick=()=>{ activePlayFilter=""; setActiveMode("plays"); render(); };
    },0);
  } else {
    els.hint.textContent = `Gösterilen: ${filtered.length} / ${source.length}`;
  }


function renderDetails(it){
  if(!it){ els.details.innerHTML = `<div class="empty">Soldan bir oyun veya kişi seç.</div>`; return; }

  if(activeMode==="plays"){
    const rowsSorted=[...it.rows].sort((a,b)=>
      (a.category||"").localeCompare(b.category||"","tr") ||
      (a.role||"").localeCompare(b.role||"","tr") ||
      (a.person||"").localeCompare(b.person||"","tr")
    );
    els.details.innerHTML = `
      <h3 class="title">${escapeHtml(it.title)}${personTag(it.title)}</h3>
      <p class="subtitle">${it.count} kişi • ${it.rows.length} satır</p>
      <table class="table" id="detailTable">
        <thead><tr><th>Kategori</th><th>Görev</th><th>Kişi</th></tr></thead>
        <tbody>
          ${rowsSorted.map(r=>`<tr><td>${escapeHtml(r.category)}</td><td>${escapeHtml(r.role)}</td><td>${escapeHtml(r.person)}${personTag(r.person)}</td></tr>`).join("")}
        </tbody>
      </table>
    `;
  } else {
    const byPlay=new Map();
    for(const r of it.rows){ if(!byPlay.has(r.play)) byPlay.set(r.play,[]); byPlay.get(r.play).push(r); }
    const blocks=[...byPlay.entries()].sort((a,b)=>a[0].localeCompare(b[0],"tr"));
    els.details.innerHTML = `
      <h3 class="title">${escapeHtml(it.title)}${personTag(it.title)}</h3>
      <p class="subtitle">${it.count} oyun • ${it.rows.length} satır</p>
      <div id="detailTable">
      ${blocks.map(([p, rs])=>{
        const rs2=[...rs].sort((a,b)=>(a.category||"").localeCompare(b.category||"","tr") || (a.role||"").localeCompare(b.role||"","tr"));
        return `
          <div style="margin:12px 0 10px">
            <div style="font-weight:850;margin:0 0 8px">${escapeHtml(p)}</div>
            <table class="table">
              <thead><tr><th>Kategori</th><th>Görev</th></tr></thead>
              <tbody>${rs2.map(r=>`<tr><td>${escapeHtml(r.category)}</td><td>${escapeHtml(r.role)}</td></tr>`).join("")}</tbody>
            </table>
          </div>
        `;
      }).join("")}
      </div>
    `;
  }
}

/* ---------- Copy as Excel-friendly (TSV) ---------- */
function toTSVFromSelected(){
  if(!selectedItem) return "";
  if(activeMode==="plays"){
    const rowsSorted=[...selectedItem.rows].sort((a,b)=>
      (a.category||"").localeCompare(b.category||"","tr") ||
      (a.role||"").localeCompare(b.role||"","tr") ||
      (a.person||"").localeCompare(b.person||"","tr")
    );
    const lines=[["Kategori","Görev","Kişi"].join("\t")];
    for(const r of rowsSorted){
      lines.push([r.category||"", r.role||"", r.person||""].join("\t"));
    }
    return lines.join("\n");
  } else {
    const rs=[...selectedItem.rows].sort((a,b)=>
      (a.play||"").localeCompare(b.play||"","tr") ||
      (a.category||"").localeCompare(b.category||"","tr") ||
      (a.role||"").localeCompare(b.role||"","tr")
    );
    const lines=[["Oyun","Kategori","Görev"].join("\t")];
    for(const r of rs){
      lines.push([r.play||"", r.category||"", r.role||""].join("\t"));
    }
    return lines.join("\n");
  }
}

/* ---------- charts ---------- */
function roundRect(ctx, x, y, w, h, r){
  const rr = Math.min(r, w/2, h/2);
  ctx.beginPath();
  ctx.moveTo(x+rr, y);
  ctx.arcTo(x+w, y, x+w, y+h, rr);
  ctx.arcTo(x+w, y+h, x, y+h, rr);
  ctx.arcTo(x, y+h, x, y, rr);
  ctx.arcTo(x, y, x+w, y, rr);
  ctx.closePath();
}
function drawBars(canvas, items, topN){
  const ctx = canvas.getContext("2d");
  const dpr = window.devicePixelRatio || 1;
  const cssW = canvas.clientWidth || 900;
  const cssH = canvas.clientHeight || 340;
  canvas.width = Math.floor(cssW * dpr);
  canvas.height = Math.floor(cssH * dpr);
  ctx.setTransform(dpr,0,0,dpr,0,0);

  const data = items.slice(0, topN);

  const card = cssVar("--card");
  const grid = cssVar("--line");
  const text = cssVar("--text");
  const muted = cssVar("--muted");
  const accent = cssVar("--accent");

  chartHits = [];

  ctx.clearRect(0,0,cssW,cssH);
  ctx.fillStyle = card;
  roundRect(ctx, 0, 0, cssW, cssH, 14);
  ctx.fill();

  ctx.strokeStyle = grid;
  ctx.lineWidth = 1;
  const padL=18, padR=14, padT=16, padB=74;
  const w=cssW-padL-padR;
  const h=cssH-padT-padB;

  for(let i=0;i<=4;i++){
    const y=padT + (h*(i/4));
    ctx.beginPath(); ctx.moveTo(padL,y); ctx.lineTo(padL+w,y); ctx.stroke();
  }

  const maxV = Math.max(...data.map(d=>d.v), 1);
  const barW = w / Math.max(data.length,1);

  for(let i=0;i<data.length;i++){
    const d=data[i];
    const bh = (d.v/maxV)*h;
    const x = padL + i*barW + 6;
    const y = padT + (h-bh);
    const bw = Math.max(barW-12, 14);

    ctx.fillStyle = accent;
    ctx.globalAlpha = 0.78;
    roundRect(ctx, x, y, bw, bh, 12);
    ctx.fill();
    ctx.globalAlpha = 1;

    ctx.fillStyle = text;
    ctx.font = "12px system-ui";
    ctx.fillText(String(d.v), x+2, y-6);

    ctx.save();
    ctx.fillStyle = muted;
    ctx.font = "12px system-ui";
    const label = d.k.length>26 ? d.k.slice(0,26)+"…" : d.k;
    // etiketleri yatay yaz (mobilde okunur)
    const yLabel = padT + h + 18;
    ctx.textAlign = "center";
    ctx.fillText(label, x + barW/2, yLabel);
    ctx.restore();

    chartHits.push({type:"bar", key:d.k, x, y, w:bw, h:bh});
  }
}
function drawDoughnut(canvas, items, topN, legendTitle){
  const ctx = canvas.getContext("2d");
  const dpr = window.devicePixelRatio || 1;
  const cssW = canvas.clientWidth || 900;
  const cssH = canvas.clientHeight || 340;
  canvas.width = Math.floor(cssW * dpr);
  canvas.height = Math.floor(cssH * dpr);
  ctx.setTransform(dpr,0,0,dpr,0,0);

  // Top N + Diğer (okunabilirlik)
  const sorted = items.slice().sort((a,b)=>b.v-a.v);
  const top = sorted.slice(0, topN);
  const rest = sorted.slice(topN);
  if(rest.length){
    const other = rest.reduce((s,x)=>s+x.v,0);
    top.push({k:"Diğer", v:other});
  }
  const data = top;
  const total = data.reduce((s,x)=>s+x.v,0) || 1;

  const card = cssVar("--card");
  const line = cssVar("--line");
  const text = cssVar("--text");
  const muted = cssVar("--muted");

  const palette = [
    cssVar("--accent"), cssVar("--accent2"),
    "#2E7D32","#1565C0","#6A1B9A","#EF6C00",
    "#00838F","#C2185B","#5D4037","#455A64",
    "#9E9D24","#AD1457"
  ];

  chartHits = [];

  ctx.clearRect(0,0,cssW,cssH);
  ctx.fillStyle = card;
  roundRect(ctx, 0, 0, cssW, cssH, 14);
  ctx.fill();

  const isM = isMobile();
  const cx = isM ? cssW*0.50 : cssW*0.34;
  const cy = cssH*0.52;
  const rOuter = Math.min(cssW, cssH)*(isM ? 0.28 : 0.32);
  const rInner = rOuter*0.60;

  let start = -Math.PI/2;
  for(let i=0;i<data.length;i++){
    const d=data[i];
    const ang = (d.v/total) * Math.PI*2;
    const end = start + ang;

    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.arc(cx, cy, rOuter, start, end);
    ctx.closePath();
    ctx.fillStyle = colorFor(label);
    ctx.globalAlpha = 0.92;
    ctx.fill();
    ctx.globalAlpha = 1;

    chartHits.push({type:"wedge", key:d.k, cx, cy, rOuter, rInner, start, end});
    start = end;
  }

  // inner hole
  ctx.beginPath();
  ctx.arc(cx, cy, rInner, 0, Math.PI*2);
  ctx.fillStyle = card;
  ctx.fill();

  // center total
  ctx.fillStyle = muted;
  ctx.font = "12px system-ui";
  ctx.textAlign="center";
  ctx.fillText("Toplam", cx, cy-6);
  ctx.fillStyle = text;
  ctx.font = "18px system-ui";
  ctx.fillText(String(total), cx, cy+18);
  ctx.textAlign="left";

  // legend
  const lx = isM ? 16 : cssW*0.62;
  let ly = isM ? (cy + rOuter + 20) : 24;

  ctx.fillStyle = text;
  ctx.font = "13px system-ui";
  ctx.fillText(legendTitle || "Dağılım", lx, ly);
  ly += 10;

  ctx.font = "12px system-ui";
  const maxLegend = isM ? 10 : data.length;
  for(let i=0;i<Math.min(data.length, maxLegend);i++){
    const d=data[i];
    ly += 18;
    ctx.fillStyle = colorFor(label);
    roundRect(ctx, lx, ly-11, 10, 10, 3);
    ctx.fill();
    ctx.fillStyle = muted;
    const label = d.k.length>28 ? d.k.slice(0,28)+"…" : d.k;
    ctx.fillText(`${label}  (${d.v})`, lx+16, ly-2);
  }
  if(isM && data.length>maxLegend){
    ly += 16;
    ctx.fillStyle = muted;
    ctx.fillText(`+${data.length-maxLegend} kategori daha (tıkla: listede gör)`, lx, ly);
  }

  ctx.strokeStyle = line;
  ctx.strokeRect(0.5,0.5,cssW-1,cssH-1);
}
function drawChart(){
  if(!rows.length) return;
  if(chartMode==="roles"){
    const counts=new Map();
    for(const r of rows){
      const k=((r.role||"Bilinmiyor").trim() || "Bilinmiyor");
      if(!counts.has(k)) counts.set(k, new Set());
      counts.get(k).add((r.person||"").trim());
    }
    const items=[...counts.entries()].map(([k,set])=>({k,v:set.size})).sort((a,b)=>b.v-a.v);
    els.chartTitle.textContent = "Görevlere Göre Dağılım";
    drawDoughnut(els.chartMain, items, (isMobile()?10:14), "Top Görevler");
  }else{
    const counts=new Map();
    for(const r of rows){
      const k=((r.category||"Bilinmiyor").trim() || "Bilinmiyor");
      if(!counts.has(k)) counts.set(k, new Set());
      counts.get(k).add((r.person||"").trim());
    }
    const items=[...counts.entries()].map(([k,set])=>({k,v:set.size})).sort((a,b)=>b.v-a.v);
    els.chartTitle.textContent = "Kategori Dağılımı";
    drawDoughnut(els.chartMain, items, (isMobile()?10:14), "Top Kategoriler");
  }
}

/* ---------- chart drawer ---------- */
function openDrawer(title, subtitle, items){
  els.drawerTitle.textContent = title;
  els.drawerSub.textContent = subtitle;
  drawerData = items.slice();
  els.drawerSearch.value = "";
  renderDrawerList();
  els.drawer.classList.remove("hidden");
}
function closeDrawer(){
  els.drawer.classList.add("hidden");
  drawerData = [];
  els.drawerList.innerHTML = "";
}
els.drawerClose.addEventListener("click", closeDrawer);
els.drawerSearch.addEventListener("input", renderDrawerList);

function renderDrawerList(){
  const q = els.drawerSearch.value.trim().toLowerCase();
  const filtered = drawerData.filter(x=>{
    if(!q) return true;
    return (x.person+" "+(x.plays||[]).join(" ")).toLowerCase().includes(q);
  });

  if(!filtered.length){
    els.drawerList.innerHTML = `<div class="empty">Sonuç yok.</div>`;
    return;
  }
  els.drawerList.innerHTML = filtered.slice(0,250).map(x=>`
    <div class="miniItem">
      <b>${escapeHtml(x.person)}</b>
      <div class="small">${escapeHtml((x.plays||[]).slice(0,10).join(" • "))}${(x.plays||[]).length>10 ? " • …" : ""}</div>
    </div>
  `).join("");
}

function hitTestChart(evt){
  const rect = els.chartMain.getBoundingClientRect();
  const x = evt.clientX - rect.left;
  const y = evt.clientY - rect.top;

  for(const h of chartHits){
    if(h.type==="bar"){
      if(x>=h.x && x<=h.x+h.w && y>=h.y && y<=h.y+h.h) return h;
    }else if(h.type==="wedge"){
      const dx=x-h.cx, dy=y-h.cy;
      const rr=Math.sqrt(dx*dx+dy*dy);
      if(rr < h.rInner || rr > h.rOuter) continue;
      let ang=Math.atan2(dy,dx);
      if(ang< -Math.PI/2) ang += Math.PI*2;
      let s=h.start, e=h.end;
      while(ang < s) ang += Math.PI*2;
      if(ang >= s && ang <= e) return h;
    }
  }
  return null;
}

els.chartMain.addEventListener("click", (evt)=>{
  const h = hitTestChart(evt);
  if(!h) return;
  const key = h.key;

  const map=new Map();
  for(const r of rows){
    const match = (chartMode==="roles") ? ((r.role||"").trim()===key) : ((r.category||"").trim()===key);
    if(match && r.person){
      if(!map.has(r.person)) map.set(r.person, new Set());
      map.get(r.person).add(r.play);
    }
  }
  const items=[...map.entries()].map(([person, s])=>({person, plays:[...s].sort((a,b)=>a.localeCompare(b,"tr"))}));
  items.sort((a,b)=>b.plays.length-a.plays.length || a.person.localeCompare(b.person,"tr"));
  openDrawer(`${chartMode==="roles" ? "Görev" : "Kategori"}: ${key}`, `${items.length} kişi`, items);
});

/* ---------- distribution ---------- */
function computeDistribution(){
  const map=new Map();
  for(const r of rows){
    if(!r.person) continue;
    const p=r.person.trim(); if(!p) continue;
    if(!map.has(p)) map.set(p, {plays:new Set(), roles:new Set()});
    map.get(p).plays.add(r.play);
    if(r.role) map.get(p).roles.add(r.role);
  }
  const out=[];
  for(const [person, v] of map.entries()){
    const plays=[...v.plays].sort((a,b)=>a.localeCompare(b,"tr"));
    if(plays.length<=1) continue;
    out.push({person, plays, roles:[...v.roles].sort((a,b)=>a.localeCompare(b,"tr"))});
  }
  out.sort((a,b)=>b.plays.length-a.plays.length || a.person.localeCompare(b.person,"tr"));
  return out;
}
function renderDistribution(){
  const q=els.dq.value.trim().toLowerCase();
  const filtered = distribution.filter(d=>{
    if(!q) return true;
    const hay=(d.person+" "+d.plays.join(" ")+" "+d.roles.join(" ")).toLowerCase();
    return hay.includes(q);
  });

  if(!filtered.length){
    els.distributionBox.innerHTML = `<div class="empty">Kayıt yok (veya filtre çok dar).</div>`;
    return;
  }
  els.distributionBox.innerHTML = `
    <table class="table">
      <thead><tr><th>Kişi</th><th>Oyun Sayısı</th><th>Oyunlar</th><th>Görevler</th></tr></thead>
      <tbody>
        ${filtered.map(d=>`
          <tr>
            <td><b>${escapeHtml(d.person)}</b></td>
            <td>${d.plays.length}</td>
            <td>${escapeHtml(d.plays.join(" • "))}</td>
            <td>${escapeHtml(d.roles.join(", "))}</td>
          </tr>
        `).join("")}
      </tbody>
    </table>
    <div class="small" style="margin-top:10px">Toplam: ${filtered.length} kişi</div>
  `;
}

/* ---------- figuran render ---------- */
function renderFiguran(){
  const q=els.fq.value.trim().toLowerCase();
  const filtered = figuran.filter(f=>{
    if(!q) return true;
    const hay=(f.person+" "+(f.cats||[]).join(" ")+" "+f.plays.join(" ")+" "+f.roles.join(" ")).toLowerCase();
    return hay.includes(q);
  });

  if(!filtered.length){
    els.figuranBox.innerHTML = `<div class="empty">Figüran / Kurumdan Emekli Sanatçı bulunamadı.</div>`;
    return;
  }

  els.figuranBox.innerHTML = `
    <table class="table">
      <thead><tr><th>#</th><th>Kişi</th><th>Kategori</th><th>Oyunlar</th><th>Görevler</th></tr></thead>
      <tbody>
        ${filtered.map((f, idx)=>`
          <tr>
            <td>${idx+1}</td>
            <td><b>${escapeHtml(f.person)}</b></td>
            <td>${escapeHtml((f.cats||[]).join(", "))}</td>
            <td>${escapeHtml(f.plays.join(" • "))}</td>
            <td>${escapeHtml(f.roles.join(", "))}</td>
          </tr>
        `).join("")}
      </tbody>
    </table>
    <div class="small" style="margin-top:10px">Toplam: ${filtered.length} kişi</div>
  `;
}

/* ---------- intersection ---------- */
function renderPlayOptions(){
  const opts = playsList.map(p=>`<option value="${escapeHtml(p)}">${escapeHtml(p)}</option>`).join("");
  els.p1.innerHTML = opts;
  els.p2.innerHTML = opts;
  if(playsList.length){
    els.p1.value = playsList[0];
    els.p2.value = playsList.length>1 ? playsList[1] : playsList[0];
  }
}
function computeIntersection(playA, playB){
  const mapA=new Map();
  const mapB=new Map();
  for(const r of rows){
    if(!r.person) continue;
    if(r.play===playA){
      if(!mapA.has(r.person)) mapA.set(r.person, []);
      mapA.get(r.person).push(r);
    } else if(r.play===playB){
      if(!mapB.has(r.person)) mapB.set(r.person, []);
      mapB.get(r.person).push(r);
    }
  }
  const common=[];
  for(const [person, ra] of mapA.entries()){
    if(!mapB.has(person)) continue;
    const rb = mapB.get(person);
    const rolesA=[...new Set(ra.map(x=>x.role).filter(Boolean))].sort((a,b)=>a.localeCompare(b,"tr"));
    const rolesB=[...new Set(rb.map(x=>x.role).filter(Boolean))].sort((a,b)=>a.localeCompare(b,"tr"));
    const catsA=[...new Set(ra.map(x=>x.category).filter(Boolean))].sort((a,b)=>a.localeCompare(b,"tr"));
    const catsB=[...new Set(rb.map(x=>x.category).filter(Boolean))].sort((a,b)=>a.localeCompare(b,"tr"));
    common.push({person, rolesA, rolesB, catsA, catsB});
  }
  common.sort((a,b)=>a.person.localeCompare(b.person,"tr"));
  return common;
}
function renderIntersection(){
  const a = els.p1.value;
  const b = els.p2.value;
  if(!a || !b){
    els.intersectionBox.innerHTML = `<div class="empty">Oyun seç.</div>`;
    return;
  }
  if(a===b){
    els.intersectionBox.innerHTML = `<div class="empty">İki farklı oyun seçersen ortak personeli gösterebilirim 🙂</div>`;
    return;
  }
  const common = computeIntersection(a,b);
  if(!common.length){
    els.intersectionBox.innerHTML = `<div class="empty"><b>${escapeHtml(a)}</b> ile <b>${escapeHtml(b)}</b> arasında ortak personel yok.</div>`;
    return;
  }
  els.intersectionBox.innerHTML = `
    <div class="small" style="margin-bottom:10px"><b>${escapeHtml(a)}</b> ∩ <b>${escapeHtml(b)}</b> → <b>${common.length}</b> kişi</div>
    <table class="table">
      <thead><tr><th>Kişi</th><th>${escapeHtml(a)} (Kategori / Görev)</th><th>${escapeHtml(b)} (Kategori / Görev)</th></tr></thead>
      <tbody>
        ${common.map(c=>`
          <tr>
            <td><b>${escapeHtml(c.person)}</b></td>
            <td>${escapeHtml(c.catsA.join(", "))}<br><span class="small">${escapeHtml(c.rolesA.join(", "))}</span></td>
            <td>${escapeHtml(c.catsB.join(", "))}<br><span class="small">${escapeHtml(c.rolesB.join(", "))}</span></td>
          </tr>
        `).join("")}
      </tbody>
    </table>
  `;
}

/* ---------- navigation ---------- */
function setActiveTab(which){
  const tabs=[["tabPanel","viewPanel"],["tabDistribution","viewDistribution"],["tabIntersection","viewIntersection"],["tabFiguran","viewFiguran"],["tabCharts","viewCharts"]];
  for(const [t,v] of tabs){
    el(t).classList.remove("active");
    el(v).style.display="none";
  }
  el("tab"+which).classList.add("active");
  el("view"+which).style.display="block";
  if(which==="Charts" && rows.length){
    closeDrawer();
    drawChart();
  }
}

els.tabPanel.addEventListener("click", ()=>setActiveTab("Panel"));
els.tabDistribution.addEventListener("click", ()=>setActiveTab("Distribution"));
els.tabIntersection.addEventListener("click", ()=>setActiveTab("Intersection"));
els.tabFiguran.addEventListener("click", ()=>setActiveTab("Figuran"));
els.tabCharts.addEventListener("click", ()=>setActiveTab("Charts"));

/* ---------- events ---------- */
els.reloadBtn.addEventListener("click", ()=>load(false));

// Bildirimler (LOG)
els.notifBtn && els.notifBtn.addEventListener("click", async ()=>{
  els.notifPanel.classList.toggle("hidden");
  if(!els.notifPanel.classList.contains("hidden")){
    await loadNotifications();
    // panel açılınca "görüldü" say (sayaç sıfırlansın)
    localStorage.setItem("idt_log_seen_ts", String(Date.now()));
    els.notifCount.classList.add("hidden");
  }
});
els.notifClose && els.notifClose.addEventListener("click", ()=>els.notifPanel.classList.add("hidden"));
els.notifRefresh && els.notifRefresh.addEventListener("click", loadNotifications);

els.clearBtn.addEventListener("click", ()=>{ els.q.value="";
renderList(); });

els.q.addEventListener("input", ()=>renderList());
els.btnPlays.addEventListener("click", ()=>{
  activeMode="plays";
  activePlayFilter = null;
  els.btnPlays.classList.add("active"); els.btnPeople.classList.remove("active");
  activeId=null; selectedItem=null;
  renderList(); renderDetails(null);
});
els.btnPeople.addEventListener("click", ()=>{
  activeMode="people";
  activePlayFilter = null;
  els.btnPeople.classList.add("active"); els.btnPlays.classList.remove("active");
  activeId=null; selectedItem=null;
  renderList(); renderDetails(null);
});


// Mobil: oyundan kişilere geçişte geri tuşu Oyunlar'a döndürsün
window.addEventListener("popstate", ()=>{
  if(activePlayFilter){
    activePlayFilter = null;
    activeMode = "plays";
    els.btnPlays.classList.add("active"); 
    els.btnPeople.classList.remove("active");
    activeId=null; selectedItem=null;
    renderList(); 
    renderDetails(null);
    setStatus("↩️ Oyunlar listesine dönüldü", "ok");
  }
});
els.copyBtn.addEventListener("click", async ()=>{
  const tsv = toTSVFromSelected();
  if(!tsv){ setStatus("⚠️ Önce bir öğe seç", "warn"); return; }
  try{
    await navigator.clipboard.writeText(tsv);
    setStatus("📋 Excel formatında kopyalandı", "ok");
    setTimeout(()=>setStatus("✅ Hazır", "ok"), 1000);
  }catch{ alert("Kopyalama engellendi."); }
});

function downloadText(filename, text){
  // Mobil/Safari uyumu için: önce Blob dene, gerekirse data: URI fallback
  const ua = navigator.userAgent || "";
  const isIOS = /iPad|iPhone|iPod/.test(ua);
  const useDataUrl = isIOS; // iOS Safari'de Blob+download sık sık sorun çıkarıyor
  try{
    const a = document.createElement("a");
    a.style.display = "none";
    if(useDataUrl){
      a.href = "data:text/tab-separated-values;charset=utf-8," + encodeURIComponent(text);
    }else{
      const blob = new Blob([text], {type:"text/tab-separated-values;charset=utf-8"});
      a.href = URL.createObjectURL(blob);
    }
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    setTimeout(()=>{ try{ if(!useDataUrl) URL.revokeObjectURL(a.href); }catch{} a.remove(); }, 100);
  }catch(e){
    // Son çare: yeni sekmede aç
    try{ window.open("data:text/plain;charset=utf-8," + encodeURIComponent(text), "_blank"); }catch{}
  }
}
function safeFileName(s){
  return String(s||"").trim().replace(/[\\\/:*?"<>|]+/g,"-").slice(0,80) || "liste";
}

function toFiguranTSV(figList){
  const out = [["Kişi","Kategori","Görevler","Oyunlar"]];
  (figList||[]).forEach(f=>{
    out.push([
      f.person,
      (f.cats||[]).join(", "),
      (f.roles||[]).join(", "),
      (f.plays||[]).join(" • ")
    ]);
  });
  return out.map(line=>line.map(v=>String(v??"").replace(/\t/g," ")).join("\t")).join("\n");
}
function toFiguranTSVFromSelected(){
  if(!selectedItem) return "";
  const rows = selectedItem.rows || [];
  const isFig = (r)=>{
    const cat = norm(r.category);
    const role = norm(r.role);
    return cat.includes("figuran") || role.includes("figuran");
  };
  const out = [["Oyun","Kişi","Görev","Kategori"]];
  rows.filter(isFig).forEach(r=>{
    out.push([r.play, r.person, r.role, r.category]);
  });
  // Excel için TSV
  return out.map(line=>line.map(v=>String(v??"").replace(/\t/g," ")).join("\t")).join("\n");
}

els.downloadBtn && els.downloadBtn.addEventListener("click", ()=>{
  const tsv = toTSVFromSelected();
  if(!tsv){ setStatus("⚠️ Önce bir öğe seç", "warn"); return; }
  downloadText(`${safeFileName(selectedItem.title||"liste")}.tsv`, tsv);
  toast("İndiriliyor…");
});

els.figuranBtn && els.figuranBtn.addEventListener("click", ()=>{
  const tsv = toFiguranTSVFromSelected();
  if(!tsv || tsv.split("\n").length<=1){
    setStatus("⚠️ Bu seçimde figüran bulunamadı.", "warn");
    return;
  }
  downloadText(`${safeFileName(selectedItem.title||"figuran")}-figuran.tsv`, tsv);
  toast("Figüran listesi indiriliyor…");
});


// Figüranlar sekmesinden indirme
els.figDownloadAllBtn && els.figDownloadAllBtn.addEventListener("click", ()=>{
  if(!figuran || !figuran.length){ setStatus("⚠️ Figüran verisi yok.", "warn"); return; }
  const tsv = toFiguranTSV(figuran);
  downloadText("figuran-listesi.tsv", tsv);
  toast("Figüran listesi indiriliyor…");
});
els.figDownloadFilteredBtn && els.figDownloadFilteredBtn.addEventListener("click", ()=>{
  const q=els.fq.value.trim().toLowerCase();
  const filtered = (figuran||[]).filter(f=>{
    if(!q) return true;
    const hay=(f.person+" "+(f.cats||[]).join(" ")+" "+f.plays.join(" ")+" "+f.roles.join(" ")).toLowerCase();
    return hay.includes(q);
  });
  if(!filtered.length){ setStatus("⚠️ Filtre sonucu yok.", "warn"); return; }
  const tsv = toFiguranTSV(filtered);
  downloadText("figuran-listesi-filtreli.tsv", tsv);
  toast("Filtreli figüran listesi indiriliyor…");
});
els.dq.addEventListener("input", renderDistribution);
els.dClear.addEventListener("click", ()=>{ els.dq.value=""; renderDistribution(); });

els.fq.addEventListener("input", renderFiguran);
els.fClear.addEventListener("click", ()=>{ els.fq.value=""; renderFiguran(); });

els.p1.addEventListener("change", renderIntersection);
els.p2.addEventListener("change", renderIntersection);
els.swapBtn.addEventListener("click", ()=>{
  const a=els.p1.value; els.p1.value=els.p2.value; els.p2.value=a;
  renderIntersection();
});

els.chartTabRoles.addEventListener("click", ()=>{
  chartMode="roles";
  els.chartTabRoles.classList.add("active");
  els.chartTabCats.classList.remove("active");
  closeDrawer();
  drawChart();
});
els.chartTabCats.addEventListener("click", ()=>{
  chartMode="cats";
  els.chartTabCats.classList.add("active");
  els.chartTabRoles.classList.remove("active");
  closeDrawer();
  drawChart();
});

window.addEventListener("resize", ()=>{
  if(rows.length && els.viewCharts.style.display!=="none"){ drawChart(); }
});

/* ---------- KPIs ---------- */
function renderKpis(){
  els.kpiPlays.textContent = String(plays.length || 0);
  const uniqPeople = new Set(rows.map(r=>r.person).filter(Boolean));
  els.kpiPeople.textContent = String(uniqPeople.size);
  els.kpiRows.textContent = String(rawRows.length);
  els.kpiFiguran.textContent = String(figuran.length || 0);
}

/* ---------- main load ---------- */
async function load(isAuto=false){
  if(!isAuto) setStatus("⏳ Yükleniyor…");
  activeId=null; selectedItem=null;
  try{
    try{ rawRows = await tryLoadApiJsonp(); }
    catch(e1){
      try{ rawRows = await tryLoadGviz(); }
      catch(e2){ rawRows = await tryLoadCsv(); }
    }

    rows = expandRowsByPeople(rawRows);
    plays = groupByPlay(rows);
    people = groupByPerson(rows);
    playsList = plays.map(p=>p.title);


    renderList();
    renderDetails(null);

    distribution = computeDistribution();
    renderDistribution();

    retiredSet = computeRetiredSetFromRaw();
    retiredSet = computeRetiredSetFromRaw();
    figuran = computeFiguranFromRaw();
    renderFiguran();

    renderPlayOptions();
    renderIntersection();

    renderKpis();

    const when = new Date().toLocaleTimeString("tr-TR",{hour:"2-digit",minute:"2-digit"});
    setStatus(`✅ Hazır • ${when}`, "ok");

    // Bildirimleri (BİLDİRİMLER) yükle
    loadNotifications();
  }catch(err){
    console.error(err);
    setStatus("⛔ Veri çekilemedi", "bad");
    els.list.innerHTML = `<div class="empty" style="text-align:left;white-space:pre-wrap">
<b>Veri çekilemedi.</b>

1) Sheet paylaşımı: Paylaş → “Bağlantıya sahip herkes: Görüntüleyebilir”
2) Netlify / GitHub Pages’da genelde sorunsuz çalışır.

Hata: ${escapeHtml(err.message || String(err))}
</div>`;
    els.details.innerHTML = `<div class="empty">Önce veri gelsin 🙂</div>`;
    els.distributionBox.innerHTML = `<div class="empty">Veri yok.</div>`;
    els.figuranBox.innerHTML = `<div class="empty">Veri yok.</div>`;
    els.intersectionBox.innerHTML = `<div class="empty">Veri yok.</div>`;
  }
}

load(false);
