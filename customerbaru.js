import { auth, db } from "./index.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import {
  collection, collectionGroup, query, where, getDocs, getDoc, doc, updateDoc, serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

/* ── STATE ─────────────────────────────────────────────── */
let currentUser   = null;
let idCabang      = "";
let customerBaru  = [];   // dari collection customerBaruHunter
let kurirList     = [];   // dari IndexedDB
let customerKurir = {};   // { uid: [{ lat, lng, ... }] } untuk hitung centroid
let selectedItem  = null;
let filterActive  = "all";
let searchKeyword = "";

const DB_NAME    = "laporanDistribusiDB";
const STORE_USERS = "users";

/* ── AUTH ──────────────────────────────────────────────── */
onAuthStateChanged(auth, async user => {
  if (!user) { window.location.href = "login.html"; return; }
  try {
    const snap = await getDoc(doc(db, "users", user.uid));
    if (!snap.exists()) { window.location.href = "login.html"; return; }
    const data = snap.data();
    if (data.role !== "adminCabang") { window.location.href = "login.html"; return; }
    currentUser = user;
    idCabang    = data.idCabang || "";
    await loadKurirFromIDB();
    await loadCustomerBaru();
    initEvents();
  } catch (err) {
    console.error("Auth error:", err);
  }
});

/* ── LOAD KURIR FROM INDEXEDDB ─────────────────────────── */
async function loadKurirFromIDB() {
  return new Promise(resolve => {
    try {
      const req = indexedDB.open(DB_NAME);
      req.onsuccess = () => {
        try {
          const idb = req.result;
          const tx  = idb.transaction(STORE_USERS, "readonly");
          const all = tx.objectStore(STORE_USERS).getAll();
          all.onsuccess = () => {
            kurirList = all.result.filter(u =>
              ["kurir","sales","hunter"].includes(u.role) && u.status === true
            );
            resolve();
          };
          all.onerror = () => resolve();
        } catch { resolve(); }
      };
      req.onerror = () => resolve();
    } catch { resolve(); }
  });
}

/* ── INDEXEDDB CUSTOMER BARU ───────────────────────────── */
const DB_NAME_CUSTOMER = "customerDB";
const STORE_CUSTOMER_BARU = "customerBaru";

function openCustomerBaruDB() {
  return new Promise((resolve, reject) => {
    const checkReq = indexedDB.open(DB_NAME_CUSTOMER);
    checkReq.onsuccess = e => {
      const existing     = e.target.result;
      const curVersion   = existing.version;
      const needsUpgrade = !existing.objectStoreNames.contains(STORE_CUSTOMER_BARU);
      existing.close();

      const targetVersion = needsUpgrade ? curVersion + 1 : curVersion;
      const req = indexedDB.open(DB_NAME_CUSTOMER, targetVersion);

      req.onupgradeneeded = ev => {
        const db = ev.target.result;
        if (!db.objectStoreNames.contains(STORE_CUSTOMER_BARU)) {
          db.createObjectStore(STORE_CUSTOMER_BARU, { keyPath: "id" });
          console.log("✅ Store customerBaru dibuat");
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror   = () => reject(req.error);
    };
    checkReq.onerror = () => reject(checkReq.error);
  });
}

async function clearCustomerBaruDB() {
  try {
    const db = await openCustomerBaruDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_CUSTOMER_BARU, "readwrite");
      tx.objectStore(STORE_CUSTOMER_BARU).clear();
      tx.oncomplete = () => { console.log("🗑️ customerBaru IDB dibersihkan"); resolve(); };
      tx.onerror    = () => reject(tx.error);
    });
  } catch (e) {
    console.error("Gagal clear customerBaru IDB:", e);
  }
}

async function saveCustomerBaruDB(data) {
  try {
    const db = await openCustomerBaruDB();
    return new Promise((resolve, reject) => {
      const tx    = db.transaction(STORE_CUSTOMER_BARU, "readwrite");
      const store = tx.objectStore(STORE_CUSTOMER_BARU);
      data.forEach(item => store.put(item));
      tx.oncomplete = () => { console.log(`💾 customerBaru tersimpan: ${data.length} dokumen`); resolve(); };
      tx.onerror    = () => reject(tx.error);
    });
  } catch (e) {
    console.error("Gagal simpan customerBaru IDB:", e);
  }
}

async function getCustomerBaruDB() {
  try {
    const db = await openCustomerBaruDB();
    return new Promise((resolve, reject) => {
      const tx  = db.transaction(STORE_CUSTOMER_BARU, "readonly");
      const req = tx.objectStore(STORE_CUSTOMER_BARU).getAll();
      req.onsuccess = () => { console.log(`📦 customerBaru IDB: ${req.result.length} dokumen`); resolve(req.result); };
      req.onerror   = () => reject(req.error);
    });
  } catch (e) {
    console.error("Gagal get customerBaru IDB:", e);
    return [];
  }
}

/* ── LOAD CUSTOMER BARU FROM FIRESTORE ─────────────────── */
async function loadCustomerBaru(forceReload = false) {
  console.log("loadCustomerBaru dipanggil, idCabang:", idCabang, "forceReload:", forceReload);
  if (!idCabang) {
    console.warn("❌ idCabang kosong, abort");
    return;
  }
  setListLoading();

  if (!forceReload) {
    // coba dari IDB dulu
    const cached = await getCustomerBaruDB();
    if (cached.length > 0) {
      console.log("⚡ customerBaru dari IDB");
      customerBaru = cached;
      updateStats();
      renderList();
      return;
    }
  }

  // reload dari Firestore
  console.log("🔄 Reload customerBaru dari Firestore...");
  try {
    const q    = query(
      collectionGroup(db, "customerBaruHunter"),
      where("idCabang", "==", idCabang)
    );
    const snap = await getDocs(q);
    const data = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    console.log(`✅ Firestore: ${data.length} customerBaru ditemukan`);

    // hapus IDB lama lalu simpan baru
    await clearCustomerBaruDB();
    await saveCustomerBaruDB(data);

    customerBaru = data;
    updateStats();
    renderList();
  } catch (err) {
    console.error("❌ Gagal load customerBaru:", err);
    showToast("Gagal memuat data", "error");
    renderList();
  }
}

/* ── LOAD CUSTOMER EXISTING PER KURIR ─────────────────── */
async function loadCustomerKurir(kurirUid) {
  if (customerKurir[kurirUid]) return customerKurir[kurirUid];
  try {
    const q    = query(
      collection(db, "customer"),
      where("idCabang", "==", idCabang),
      where("pemilik",  "==", kurirUid)
    );
    const snap = await getDocs(q);
    const list = snap.docs
      .map(d => d.data())
      .filter(c => c.lat && c.lng);
    customerKurir[kurirUid] = list;
    return list;
  } catch (err) {
    console.error("Gagal load customer kurir:", err);
    return [];
  }
}

/* ── HITUNG CENTROID ───────────────────────────────────── */
function hitungCentroid(customers) {
  if (!customers.length) return null;
  const lat = customers.reduce((a, c) => a + Number(c.lat), 0) / customers.length;
  const lng = customers.reduce((a, c) => a + Number(c.lng), 0) / customers.length;
  return { lat, lng };
}

/* ── HITUNG JARAK (km, Haversine) ─────────────────────── */
function hitungJarak(lat1, lng1, lat2, lng2) {
  const R  = 6371;
  const dL = (lat2 - lat1) * Math.PI / 180;
  const dN = (lng2 - lng1) * Math.PI / 180;
  const a  = Math.sin(dL/2)**2 + Math.cos(lat1*Math.PI/180) * Math.cos(lat2*Math.PI/180) * Math.sin(dN/2)**2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
}

/* ── RENDER LIST ───────────────────────────────────────── */
function getFiltered() {
  return customerBaru.filter(c => {
    const matchSearch = !searchKeyword ||
      (c.namaCustomer || c.nama || "").toLowerCase().includes(searchKeyword) ||
      (c.alamat || "").toLowerCase().includes(searchKeyword);
    const isAssigned  = !!(c.pemilik && c.hari);
    const matchFilter = filterActive === "all" ||
      (filterActive === "assigned"   &&  isAssigned) ||
      (filterActive === "unassigned" && !isAssigned);
    return matchSearch && matchFilter;
  });
}

function renderList() {
  const el   = document.getElementById("cbList");
  const data = getFiltered();

  if (!data.length) {
    el.innerHTML = `
      <div class="cb-placeholder">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
          <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
          <circle cx="9" cy="7" r="4"/>
          <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
          <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
        </svg>
        <div class="cb-placeholder-title">${customerBaru.length ? "Tidak ada hasil" : "Belum ada customer baru"}</div>
        <div class="cb-placeholder-sub">${customerBaru.length ? "Coba ubah filter atau kata kunci" : "Klik reload untuk memuat data"}</div>
      </div>`;
    return;
  }

  el.innerHTML = data.map(c => {
    const nama       = c.namaCustomer || c.nama || "Tanpa Nama";
    const inisial    = nama.trim().charAt(0).toUpperCase();
    const alamat     = c.alamat || "—";
    const isAssigned = !!(c.pemilik && c.hari);
    const badgeCls   = isAssigned ? "cb-badge-assigned" : "cb-badge-unassigned";
    const badgeLabel = isAssigned ? "Sudah Assign" : "Belum Assign";
    const hunterNama = getKurirNama(c.createdBy) || "Hunter";
    const avatar     = c.foto
      ? `<img src="${esc(c.foto)}" alt="${esc(nama)}">`
      : inisial;

    return `
      <div class="cb-item ${selectedItem?.id === c.id ? "cb-item-active" : ""}" data-id="${c.id}">
        <div class="cb-item-avatar">${avatar}</div>
        <div class="cb-item-info">
          <div class="cb-item-nama">${esc(nama)}</div>
          <div class="cb-item-meta">${esc(alamat)} · ${esc(hunterNama)}</div>
        </div>
        <div class="cb-item-right">
          <span class="cb-badge ${badgeCls}">${badgeLabel}</span>
          ${c.hari ? `<span class="cb-item-jarak">${esc(c.hari)}</span>` : ""}
        </div>
      </div>`;
  }).join("");

  // event klik item
  el.querySelectorAll(".cb-item").forEach(item => {
    item.addEventListener("click", () => {
      const id = item.dataset.id;
      const c  = customerBaru.find(x => x.id === id);
      if (!c) return;
      selectItem(c);
    });
  });
}

/* ── SELECT ITEM ───────────────────────────────────────── */
async function selectItem(c) {
  selectedItem = c;
  renderList(); // update active state

  // update aside header
  const nama       = c.namaCustomer || c.nama || "Tanpa Nama";
  const isAssigned = !!(c.pemilik && c.hari);
  setText("cbAsideTitle",    "Detail Customer");
  setText("cbAsideSubtitle", nama);
  const badge = document.getElementById("cbAsideBadge");
  if (badge) {
    badge.className = `cb-badge ${isAssigned ? "cb-badge-assigned" : "cb-badge-unassigned"}`;
    badge.textContent = isAssigned ? "Sudah Assign" : "Belum Assign";
  }

  // tampilkan detail
  show("cbAsideDetail");
  hide("cbAsidePlaceholder");

  // isi info
  setText("detailNama",      nama);
  setText("detailAlamat",    c.alamat      || "—");
  setText("detailHp",        c.noHp || c.hp || "—");
  setText("detailHunter",    getKurirNama(c.createdBy) || "—");
  setText("detailKoordinat", c.lat && c.lng ? `${Number(c.lat).toFixed(5)}, ${Number(c.lng).toFixed(5)}` : "—");

  // tanggal
  if (c.createdAt?.seconds) {
    const d = new Date(c.createdAt.seconds * 1000);
    const bn = ["Jan","Feb","Mar","Apr","Mei","Jun","Jul","Agt","Sep","Okt","Nov","Des"];
    const hn = ["Min","Sen","Sel","Rab","Kam","Jum","Sab"];
    setText("detailTanggal", `${hn[d.getDay()]}, ${d.getDate()} ${bn[d.getMonth()]} ${d.getFullYear()}`);
  } else {
    setText("detailTanggal", "—");
  }

  // pre-fill form assign kalau sudah ada
  if (c.pemilik) {
    const kurirNama = getKurirNama(c.pemilik);
    setText("cbKurirText", kurirNama || "Sudah dipilih");
    document.getElementById("cbKurirUid").value = c.pemilik;
  } else {
    setText("cbKurirText", "Pilih kurir...");
    document.getElementById("cbKurirUid").value = "";
  }
  if (c.hari) {
    setText("cbHariText", c.hari);
  } else {
    setText("cbHariText", "Pilih hari...");
  }

  updateAssignBtn();

  // hitung rekomendasi kurir
  await renderRekomenKurir(c);
}

/* ── RENDER REKOMENDASI KURIR ──────────────────────────── */
async function renderRekomenKurir(c) {
  const el = document.getElementById("cbRekomenList");
  if (!el) return;
  if (!c.lat || !c.lng) {
    el.innerHTML = `<div class="cb-rekomen-loading">Koordinat tidak tersedia</div>`;
    return;
  }
  el.innerHTML = `<div class="cb-rekomen-loading">Menghitung jarak...</div>`;

  const kurirAktif = kurirList.filter(u => ["kurir","sales"].includes(u.role));
  const results    = [];

  for (const kurir of kurirAktif) {
    const cList    = await loadCustomerKurir(kurir.uid);
    const centroid = hitungCentroid(cList);
    const jarak    = centroid
      ? hitungJarak(Number(c.lat), Number(c.lng), centroid.lat, centroid.lng)
      : null;
    results.push({ kurir, jarak, jumlahCustomer: cList.length });
  }

  // sort jarak terdekat, null di akhir
  results.sort((a, b) => {
    if (a.jarak === null) return 1;
    if (b.jarak === null) return -1;
    return a.jarak - b.jarak;
  });

  const top = results.slice(0, 5);

  if (!top.length) {
    el.innerHTML = `<div class="cb-rekomen-loading">Tidak ada kurir tersedia</div>`;
    return;
  }

  el.innerHTML = top.map((r, i) => {
    const rankCls   = i === 0 ? "cb-rekomen-rank-1" : i === 1 ? "cb-rekomen-rank-2" : i === 2 ? "cb-rekomen-rank-3" : "";
    const jarakText = r.jarak !== null ? `${r.jarak.toFixed(1)} km` : "Belum ada data";
    const nama      = r.kurir.nama || "Tanpa Nama";
    const inisial   = nama.trim().charAt(0).toUpperCase();
    const isSelected = document.getElementById("cbKurirUid")?.value === r.kurir.uid;

    return `
      <div class="cb-rekomen-item ${isSelected ? "cb-rekomen-selected" : ""}" data-uid="${esc(r.kurir.uid)}" data-nama="${esc(nama)}">
        <div class="cb-rekomen-rank ${rankCls}">${i + 1}</div>
        <div class="cb-rekomen-info">
          <div class="cb-rekomen-nama">${esc(nama)}</div>
          <div class="cb-rekomen-meta">${r.jumlahCustomer} customer · ${esc(r.kurir.role || "-")}</div>
        </div>
        <div class="cb-rekomen-jarak">${jarakText}</div>
      </div>`;
  }).join("");

  // klik rekomen → set kurir di form
  el.querySelectorAll(".cb-rekomen-item").forEach(item => {
    item.addEventListener("click", () => {
      const uid  = item.dataset.uid;
      const nama = item.dataset.nama;
      setText("cbKurirText", nama);
      document.getElementById("cbKurirUid").value = uid;
      el.querySelectorAll(".cb-rekomen-item").forEach(x => x.classList.remove("cb-rekomen-selected"));
      item.classList.add("cb-rekomen-selected");
      updateAssignBtn();
    });
  });
}

/* ── RENDER KURIR DROPDOWN ─────────────────────────────── */
function renderKurirDropdown() {
  const el = document.getElementById("cbKurirList");
  if (!el) return;
  const list = kurirList.filter(u => ["kurir","sales"].includes(u.role));
  el.innerHTML = list.map(u => {
    const nama = u.nama || "Tanpa Nama";
    return `<div class="cb-dropdown-item" data-uid="${esc(u.uid)}" data-nama="${esc(nama)}">${esc(nama)} <span style="color:var(--text-muted);font-size:11px">· ${esc(u.role)}</span></div>`;
  }).join("");
  el.querySelectorAll(".cb-dropdown-item").forEach(item => {
    item.addEventListener("click", () => {
      setText("cbKurirText", item.dataset.nama);
      document.getElementById("cbKurirUid").value = item.dataset.uid;
      document.getElementById("cbKurirDropdown").classList.remove("open");
      updateAssignBtn();
    });
  });
}

/* ── UPDATE ASSIGN BTN ─────────────────────────────────── */
function updateAssignBtn() {
  const btn       = document.getElementById("cbAssignBtn");
  const kurirUid  = document.getElementById("cbKurirUid")?.value;
  const hariText  = document.getElementById("cbHariText")?.textContent;
  const hariOk    = hariText && hariText !== "Pilih hari...";
  if (btn) btn.disabled = !(kurirUid && hariOk);
}

/* ── ASSIGN KURIR ──────────────────────────────────────── */
async function doAssign() {
  if (!selectedItem) return;
  const kurirUid  = document.getElementById("cbKurirUid")?.value;
  const hari      = document.getElementById("cbHariText")?.textContent;
  const kurirNama = getKurirNama(kurirUid) || kurirUid;
  const nama      = selectedItem.namaCustomer || selectedItem.nama || "Customer";

  // buka konfirmasi
  setText("cbConfirmBody", `Assign "${nama}" ke ${kurirNama} hari ${hari}?`);
  document.getElementById("cbConfirmOverlay").classList.add("show");

  document.getElementById("cbConfirmOk").onclick = async () => {
    document.getElementById("cbConfirmOverlay").classList.remove("show");
    const btn = document.getElementById("cbAssignBtn");
    btn.disabled  = true;
    btn.innerHTML = `<span class="cb-spinner"></span> Menyimpan...`;

    try {
      await updateDoc(doc(db, "customerBaruHunter", selectedItem.id), {
        pemilik:   kurirUid,
        hari,
        assignedBy: currentUser.uid,
        assignedAt: serverTimestamp()
      });

      // update local cache
      const idx = customerBaru.findIndex(x => x.id === selectedItem.id);
      if (idx >= 0) {
        customerBaru[idx].pemilik = kurirUid;
        customerBaru[idx].hari    = hari;
        selectedItem = customerBaru[idx];
      }

      updateStats();
      renderList();
      showToast("Berhasil di-assign!", "success");

      // update badge aside
      const badge = document.getElementById("cbAsideBadge");
      if (badge) {
        badge.className   = "cb-badge cb-badge-assigned";
        badge.textContent = "Sudah Assign";
      }
    } catch (err) {
      console.error("Gagal assign:", err);
      showToast("Gagal assign", "error");
    } finally {
      btn.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg> Assign Kurir`;
      updateAssignBtn();
    }
  };
}

/* ── STATS ─────────────────────────────────────────────── */
function updateStats() {
  const total      = customerBaru.length;
  const assigned   = customerBaru.filter(c => !!(c.pemilik && c.hari)).length;
  const unassigned = total - assigned;
  setText("statTotal",      String(total));
  setText("statAssigned",   String(assigned));
  setText("statUnassigned", String(unassigned));
}

/* ── EVENTS ────────────────────────────────────────────── */
function initEvents() {
  // reload
  document.getElementById("reloadBtn")?.addEventListener("click", async () => {
    console.log("🔄 Manual reload dimulai...");
    customerKurir = {};
    await loadKurirFromIDB();
    await loadCustomerBaru(true); // force reload dari Firestore
    showToast("Data diperbarui", "success");
  });

  // search
  document.getElementById("cbSearchInput")?.addEventListener("input", e => {
    searchKeyword = e.target.value.toLowerCase().trim();
    renderList();
  });

  // filter chips
  document.querySelectorAll(".cb-chip").forEach(chip => {
    chip.addEventListener("click", () => {
      document.querySelectorAll(".cb-chip").forEach(c => c.classList.remove("cb-chip-active"));
      chip.classList.add("cb-chip-active");
      filterActive = chip.dataset.filter;
      renderList();
    });
  });

  // kurir dropdown
  document.getElementById("cbKurirBtn")?.addEventListener("click", e => {
    e.stopPropagation();
    renderKurirDropdown();
    document.getElementById("cbKurirDropdown").classList.toggle("open");
  });

  // hari dropdown
  document.getElementById("cbHariBtn")?.addEventListener("click", e => {
    e.stopPropagation();
    document.getElementById("cbHariDropdown").classList.toggle("open");
  });
  document.getElementById("cbHariList")?.addEventListener("click", e => {
    const item = e.target.closest(".cb-dropdown-item");
    if (!item) return;
    setText("cbHariText", item.dataset.value);
    document.getElementById("cbHariDropdown").classList.remove("open");
    updateAssignBtn();
  });

  // tutup dropdown klik luar
  document.addEventListener("click", () => {
    document.getElementById("cbKurirDropdown")?.classList.remove("open");
    document.getElementById("cbHariDropdown")?.classList.remove("open");
  });

  // assign button
  document.getElementById("cbAssignBtn")?.addEventListener("click", doAssign);

  // confirm batal
  document.getElementById("cbConfirmBatal")?.addEventListener("click", () => {
    document.getElementById("cbConfirmOverlay").classList.remove("show");
  });
  document.getElementById("cbConfirmOverlay")?.addEventListener("click", e => {
    if (e.target === e.currentTarget) e.currentTarget.classList.remove("show");
  });

  // visibility change — auto reload
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") {
      const last = Number(sessionStorage.getItem("cbLastActive") || 0);
      if (Date.now() - last > 10 * 60 * 1000) window.location.reload();
    } else {
      sessionStorage.setItem("cbLastActive", Date.now());
    }
  });
}

/* ── LOADING STATE ─────────────────────────────────────── */
function setListLoading() {
  document.getElementById("cbList").innerHTML = `
    <div class="cb-placeholder">
      <div class="cb-spinner" style="border-color:rgba(201,166,123,.3);border-top-color:var(--primary,#C9A67B);width:28px;height:28px"></div>
      <div class="cb-placeholder-title">Memuat data...</div>
    </div>`;
}

/* ── HELPERS ───────────────────────────────────────────── */
function getKurirNama(uid) {
  return kurirList.find(u => u.uid === uid)?.nama || "";
}
function esc(str) {
  return String(str).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");
}
function setText(id, val) { const el = document.getElementById(id); if (el) el.textContent = val; }
function show(id) { const el = document.getElementById(id); if (el) el.style.display = ""; }
function hide(id) { const el = document.getElementById(id); if (el) el.style.display = "none"; }

let _toastTimer = null;
function showToast(msg, type = "") {
  let t = document.getElementById("cbToast");
  if (!t) return;
  t.textContent = msg;
  t.className   = `cb-toast ${type}`;
  requestAnimationFrame(() => t.classList.add("show"));
  clearTimeout(_toastTimer);
  _toastTimer = setTimeout(() => t.classList.remove("show"), 2800);
}
