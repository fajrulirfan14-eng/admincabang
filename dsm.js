import { auth, db } from "./index.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import {
  getDoc, doc, deleteDoc, updateDoc, addDoc, setDoc,
  collection, collectionGroup,
  query, where, getDocs, orderBy,
  serverTimestamp, deleteField
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

/* ── STATE ─────────────────────────────────── */
let currentUser  = null;
let idCabang     = "";
let allData      = [];
let filteredData = [];
let editDocId    = null;
let deleteDocId  = null;
let varianList   = [];
let selectedKurirId = null;
let kurirList       = [];
let customerList    = [];
let selectedHari    = "Senin";
let selectedPeriode = 1;
let selectedBulan   = new Date().getMonth();
let selectedTahun   = new Date().getFullYear();
let mingguKe        = 1;
let totalMinggu     = 1;
let selectedTanggal = null;
let analisaFilter = new Set();

const DSM_STATE_KEY = "dsmPageState";

function saveDsmPageState() {
  localStorage.setItem(DSM_STATE_KEY, JSON.stringify({
    selectedKurirId,
    selectedHari,
    selectedBulan,
    selectedTahun,
    mingguKe
  }));
}

function loadDsmPageState() {
  try {
    const raw = localStorage.getItem(DSM_STATE_KEY);
    if (!raw) return;
    const s = JSON.parse(raw);
    if (s.selectedKurirId) selectedKurirId = s.selectedKurirId;
    if (s.selectedHari)    selectedHari    = s.selectedHari;
    if (s.selectedBulan != null) selectedBulan = Number(s.selectedBulan);
    if (s.selectedTahun != null) selectedTahun = Number(s.selectedTahun);
    if (s.mingguKe      != null) mingguKe      = Number(s.mingguKe);
  } catch (e) {
    console.warn("Gagal load DSM state:", e);
  }
}

/* ── AUTH ──────────────────────────────────── */
function logout() { window.location.href = "login.html"; }

onAuthStateChanged(auth, async user => {
  if (!user) { console.log("❌ Tidak ada user"); logout(); return; }
  try {
    const snap = await getDoc(doc(db, "users", user.uid));
    if (!snap.exists()) { console.log("❌ Dokumen user tidak ada"); logout(); return; }
    const data = snap.data();
    console.log("✅ Role user:", data.role);
    if (data.role !== "adminCabang") { console.log("❌ Role bukan adminCabang:", data.role); logout(); return; }

    currentUser = user;
    idCabang    = data.idCabang || "";

    // Nama cabang
    let namaCabang = "-";
    if (idCabang) {
      try {
        const cSnap = await getDoc(doc(db, "kantorCabang", idCabang));
        if (cSnap.exists()) namaCabang = cSnap.data().namaCabang || "-";
      } catch (_) {}
    }
    setText("cabangAdmin", namaCabang);

    // Avatar
    const nama    = data.nama || "Admin";
    const inisial = nama.trim().charAt(0).toUpperCase();
    setText("avatarInitialHeader", inisial);
    if (data.foto) {
      const img = document.getElementById("fotoAdmin");
      if (img) {
        img.src    = data.foto;
        img.onload = () => {
          img.style.display = "block";
          const av = document.getElementById("avatarInitialHeader");
          if (av) av.style.display = "none";
        };
      }
    }

    hide("skeletonLoader");
    show("dsmPage");

    startClock();
    await loadVarian();
    renderThead();
    await loadKurir();
    loadDsmPageState(); // restore state sebelum initEvents
    initEvents();

    // kalau ada kurir tersimpan, langsung load customer & render
    if (selectedKurirId) {
      const kurirNama = kurirList.find(u => u.uid === selectedKurirId)?.nama || "Kurir";
      setText("kurirSelectLabel", kurirNama);
      showTableLoading();
      await loadCustomerByKurir(selectedKurirId);
      await applyFilter();
    } else {
      renderEmpty(2 + GROUPS.length * (varianList.length || 1) + 1);
    }

  } catch (err) {
    console.error("Auth error:", err);
    logout();
  }
});
/* ── LOAD CUSTOMER FROM INDEXEDDB ──────────── */
async function loadCustomerByKurir(kurirId) {
  return new Promise(resolve => {
    try {
      // buka dulu tanpa version biar dapat version terbaru
      const checkReq = indexedDB.open("customerDB");
      checkReq.onsuccess = e => {
        const existingDB     = e.target.result;
        const currentVersion = existingDB.version;
        const needsUpgrade   = !existingDB.objectStoreNames.contains("customer");
        existingDB.close();

        const targetVersion = needsUpgrade ? currentVersion + 1 : currentVersion;
        const req = indexedDB.open("customerDB", targetVersion);

        req.onupgradeneeded = ev => {
          const dbUp = ev.target.result;
          if (!dbUp.objectStoreNames.contains("customer")) {
            dbUp.createObjectStore("customer", { keyPath: "id" });
          }
        };

        req.onsuccess = () => {
          try {
            const idb = req.result;
            const tx  = idb.transaction("customer", "readonly");
            const st  = tx.objectStore("customer");
            const all = st.getAll();
            all.onsuccess = () => {
              // simpan semua customer kurir, filter hari dilakukan di applyFilter
            customerList = all.result.filter(c =>
              c.pemilik === kurirId
            );
            console.log("Customer ditemukan:", customerList.length, "untuk kurir:", kurirId);
              resolve(customerList);
            };
            all.onerror = () => resolve([]);
          } catch (e) { resolve([]); }
        };
        req.onerror = () => resolve([]);
      };
      checkReq.onerror = () => resolve([]);
    } catch (e) { resolve([]); }
  });
}
/* ── LOAD KURIR FROM INDEXEDDB ─────────────── */
async function loadKurir() {
  return new Promise(resolve => {
    try {
      const req = indexedDB.open("laporanDistribusiDB");
      req.onsuccess = () => {
        try {
          const idb = req.result;
          const tx  = idb.transaction("users", "readonly");
          const st  = tx.objectStore("users");
          const all = st.getAll();
          all.onsuccess = () => {
            kurirList = all.result.filter(u =>
              ["kurir","sales","hunter"].includes(u.role) && u.status === true
            );
            resolve(kurirList);
          };
          all.onerror = () => resolve([]);
        } catch (e) { resolve([]); }
      };
      req.onerror = () => resolve([]);
    } catch (e) { resolve([]); }
  });
}

function renderKurirDropdown() {
  const dd = document.getElementById("kurirDropdown");
  if (!dd) return;

  if (!kurirList.length) {
    dd.innerHTML = `<div class="kurir-dropdown-empty">Belum ada kurir.<br>Reload data dulu.</div>`;
    return;
  }

  dd.innerHTML = kurirList.map(u => {
    const nama    = u.nama || "Tanpa Nama";
    const inisial = nama.trim().charAt(0).toUpperCase();
    const foto    = u.foto || "";
    const avatar  = foto
      ? `<div class="kurir-option-avatar"><img src="${esc(foto)}" alt="${esc(nama)}"></div>`
      : `<div class="kurir-option-avatar">${esc(inisial)}</div>`;
    const isActive = selectedKurirId === u.uid;
    return `
      <div class="kurir-option ${isActive ? "active" : ""}" data-uid="${esc(u.uid)}">
        ${avatar}
        <div class="kurir-option-info">
          <div class="kurir-option-nama">${esc(nama)}</div>
          <div class="kurir-option-role">${esc(u.role || "-")}</div>
        </div>
      </div>`;
  }).join("");
}
/* ── LOAD VARIAN FROM INDEXEDDB ────────────── */
async function loadVarian() {
  return new Promise(resolve => {
    try {
      const req = indexedDB.open("laporanDistribusiDB");
      req.onsuccess = () => {
        try {
          const idb = req.result;
          const tx  = idb.transaction("users", "readonly");
          const st  = tx.objectStore("users");
          const all = st.getAll();
          all.onsuccess = () => {
            const user = all.result.find(u =>
              u.role === "adminCabang" && Array.isArray(u.varian)
            );
            if (user?.varian) {
              varianList = user.varian
                .filter(v => {
                  const key = Object.keys(v)[0];
                  return key && v[key]?.isAktif === true;
                })
                .map(v => Object.keys(v)[0]);
            }
            resolve(varianList);
          };
          all.onerror = () => resolve([]);
        } catch (e) { resolve([]); }
      };
      req.onerror = () => resolve([]);
    } catch (e) { resolve([]); }
  });
}
/* ── INDEXEDDB DATA HARIAN ─────────────────── */
const STORE_DATA_HARIAN = "dataHarian";

async function openCustomerDB() {
  return new Promise((resolve, reject) => {
    const checkReq = indexedDB.open("customerDB");
    checkReq.onsuccess = e => {
      const existing      = e.target.result;
      const curVersion    = existing.version;
      const needsUpgrade  = !existing.objectStoreNames.contains(STORE_DATA_HARIAN);
      existing.close();

      const targetVersion = needsUpgrade ? curVersion + 1 : curVersion;
      const req = indexedDB.open("customerDB", targetVersion);

      req.onupgradeneeded = ev => {
        const db = ev.target.result;
        if (!db.objectStoreNames.contains(STORE_DATA_HARIAN)) {
          // keyPath: pemilik_tanggal supaya tidak saling timpa
          db.createObjectStore(STORE_DATA_HARIAN, { keyPath: "id" });
          console.log("🗄️ Store dataHarian dibuat");
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror   = () => reject(req.error);
    };
    checkReq.onerror = () => reject(checkReq.error);
  });
}

async function saveDataHarian(pemilik, tanggal, data) {
  try {
    const db    = await openCustomerDB();
    const id    = `${pemilik}_${tanggal}`;
    const tx    = db.transaction(STORE_DATA_HARIAN, "readwrite");
    const store = tx.objectStore(STORE_DATA_HARIAN);
    store.put({ id, pemilik, tanggal, data, updatedAt: Date.now() });
    await new Promise((res, rej) => {
      tx.oncomplete = res;
      tx.onerror    = () => rej(tx.error);
    });
    console.log("✅ dataHarian tersimpan:", id);
  } catch (e) {
    console.error("Gagal simpan dataHarian:", e);
  }
}

async function getDataHarian(pemilik, tanggal) {
  try {
    const db  = await openCustomerDB();
    const id  = `${pemilik}_${tanggal}`;
    return new Promise((resolve, reject) => {
      const tx  = db.transaction(STORE_DATA_HARIAN, "readonly");
      const req = tx.objectStore(STORE_DATA_HARIAN).get(id);
      req.onsuccess = () => resolve(req.result || null);
      req.onerror   = () => reject(req.error);
    });
  } catch (e) { return null; }
}
async function reloadDataHarianCustomer(pemilik, customerId, tanggal) {
  const q = query(
    collectionGroup(db, "dataHarian"),
    where("idCabang",   "==", idCabang),
    where("pemilik",    "==", pemilik),
    where("tanggal",    "==", tanggal),
    where("customerId", "==", customerId)
  );

  const snap = await getDocs(q);

  if (snap.empty) {
    console.log("Tidak ada dataHarian untuk customer:", customerId);
    return;
  }

  // ambil cache existing dulu supaya tidak timpa customer lain
  const existing = await getDataHarian(pemilik, tanggal);
  const dataMap  = existing?.data || {};

  // update hanya customer ini
  snap.forEach(docSnap => {
    const d = docSnap.data();
    dataMap[customerId] = { ...d, _docId: docSnap.id };
  });

  await saveDataHarian(pemilik, tanggal, dataMap);
  console.log(`✅ dataHarian customer ${customerId} diperbarui: ${tanggal}`);
}
async function reloadDataHarian(pemilik, tanggal) {
  const q = query(
    collectionGroup(db, "dataHarian"),
    where("idCabang", "==", idCabang),
    where("pemilik",  "==", pemilik),
    where("tanggal",  "==", tanggal)
  );

  const snap = await getDocs(q);
  const result = {};

  snap.forEach(docSnap => {
    const d = docSnap.data();
    // key pakai idCustomer — field yang menyimpan uid customer
    const customerId = d.idCustomer || "";
    if (customerId) result[customerId] = { ...d, _docId: docSnap.id };
  });

  await saveDataHarian(pemilik, tanggal, result);
  console.log(`📦 dataHarian disimpan: ${pemilik}_${tanggal}, ${snap.size} dokumen`);
  return result;
}
/* ── LAPORAN ADMIN ─────────────────────────── */
let laporanAdminCache = null; // cache per tanggal
async function loadLaporanMarketing(tanggal, kurirId) {
  try {
    if (!currentUser?.uid || !kurirId) return {};

    const q = query(
      collectionGroup(db, "laporanMarketing"),
      where("createdBy",   "==", currentUser.uid),
      where("tanggal",     "==", tanggal),
      where("idMarketing", "==", kurirId)
    );

    const snap = await getDocs(q);
    if (snap.empty) return {};

    const data = snap.docs[0].data();
    return data;
  } catch (e) {
    console.error("Gagal load laporanMarketing:", e);
    return {};
  }
}

function getRekapOrder(laporanMarketing) {
  return laporanMarketing?.order || {};
}
/* ── KALKULASI MINGGU ──────────────────────── */
function hitungMingguDalamBulan(hari, bulan, tahun) {
  // kembalikan array tanggal dari hari tertentu dalam bulan/tahun
  const namaHari = ["Minggu","Senin","Selasa","Rabu","Kamis","Jumat","Sabtu"];
  const targetDay = namaHari.indexOf(hari);
  const tanggalList = [];
  const totalHari = new Date(tahun, bulan + 1, 0).getDate();

  for (let d = 1; d <= totalHari; d++) {
    const date = new Date(tahun, bulan, d);
    if (date.getDay() === targetDay) {
      tanggalList.push(new Date(tahun, bulan, d));
    }
  }
  return tanggalList; // misal [Date(Senin1), Date(Senin2), ...]
}

function formatTanggal(date) {
  const d = String(date.getDate()).padStart(2,"0");
  const m = String(date.getMonth() + 1).padStart(2,"0");
  const y = date.getFullYear();
  return `${y}-${m}-${d}`; // format YYYY-MM-DD
}

function updatePaginationMinggu() {
  const tanggalList = hitungMingguDalamBulan(selectedHari, selectedBulan, selectedTahun);
  totalMinggu = tanggalList.length;

  if (mingguKe > totalMinggu) mingguKe = totalMinggu;
  if (mingguKe < 1) mingguKe = 1;

  selectedTanggal = tanggalList[mingguKe - 1] || null;

  const bulanNama = ["Jan","Feb","Mar","Apr","Mei","Jun","Jul","Agt","Sep","Okt","Nov","Des"];
  const label = selectedTanggal
    ? `${selectedHari}, ${selectedTanggal.getDate()} ${bulanNama[selectedBulan]} ${selectedTahun} (Minggu ke-${mingguKe})`
    : "—";

  setText("pageInfo", label);
  document.getElementById("btnPrev").disabled = mingguKe <= 1;
  document.getElementById("btnNext").disabled = mingguKe >= totalMinggu;
}

function initFilterTahun() {
  const sel  = document.getElementById("filterTahun");
  if (!sel) return;
  const now  = new Date().getFullYear();
  let html   = "";
  for (let y = now - 2; y <= now + 1; y++) {
    html += `<option value="${y}" ${y === now ? "selected" : ""}>${y}</option>`;
  }
  sel.innerHTML = html;
}

function syncFilterUI() {
  // set dropdown hari ke selectedHari
  const sh = document.getElementById("filterHari");
  if (sh) sh.value = selectedHari;
  // set bulan
  const sb = document.getElementById("filterBulan");
  if (sb) sb.value = String(selectedBulan);
  // set tahun
  const st = document.getElementById("filterTahun");
  if (st) st.value = String(selectedTahun);
}

/* ── RENDER THEAD DINAMIS ──────────────────── */
const REKAP_GROUPS = [
  { key: "order",   label: "Order",    varian: true  },
  { key: "fee",     label: "Fee",      varian: true  },
  { key: "disable", label: "Disable",  varian: true  },
  { key: "output",  label: "Output",   varian: true  },
  { key: "saldo",   label: "Saldo",    varian: true  },
  { key: "pay",     label: "Pay",      varian: true  },
  { key: "customer", label: "Customer", varian: false,
    sub: ["Tutup","Pending","Putus","Expired"] },
  { key: "omset",    label: "Omset",    varian: false,
    sub: [], colspan: 5, rowspan: 2 },
];
const GROUPS = [
  { key: "kemarin",    label: "Data Kemarin",  cls: "grp-kemarin"   },
  { key: "return",     label: "Return",        cls: "grp-return"    },
  { key: "expired",    label: "Expired",       cls: "grp-expired"   },
  { key: "konsinyasi", label: "Konsinyasi",    cls: "grp-konsinyasi"},
  { key: "cash",       label: "Cash",          cls: "grp-cash"      },
  { key: "lainnya",    label: "Lainnya",       cls: "grp-lainnya"   },
  { key: "bayar",      label: "Bayar",         cls: "grp-bayar"     },
  { key: "closing",    label: "Closing",       cls: "grp-closing"   },
];

function renderThead() {
  const vLen = varianList.length || 1;

  const groupHeaders = GROUPS.map(g =>
    `<th colspan="${vLen}" class="${g.cls}">${g.label}</th>`
  ).join("");

  const row1 = `
    <tr>
      <th rowspan="2">No.</th>
      <th rowspan="2" style="text-align:left;min-width:140px">Nama Customer</th>
      ${groupHeaders}
      <th rowspan="2">Aksi</th>
    </tr>`;

  const subCols = varianList.length
    ? varianList.map(v => `<th>${v}</th>`).join("")
    : `<th>-</th>`;

  const row2 = `<tr>${subCols.repeat(GROUPS.length)}</tr>`;

  document.querySelector("#dsmTable thead").innerHTML = row1 + row2;
}

/* ── INDEXEDDB DSM ─────────────────────────── */
const DB_NAME_DSM   = "dsmDB";
const DB_VERSION_DSM = 1;
const STORE_DSM     = "dsmData";

function openDsmDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME_DSM, DB_VERSION_DSM);
    req.onupgradeneeded = e => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains(STORE_DSM)) {
        db.createObjectStore(STORE_DSM, { keyPath: "id" });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror   = () => reject(req.error);
  });
}

async function getDsmData(kurirId, tanggal) {
  try {
    const db = await openDsmDB();
    return new Promise((resolve, reject) => {
      const tx  = db.transaction(STORE_DSM, "readonly");
      const st  = tx.objectStore(STORE_DSM);
      const all = st.getAll();
      all.onsuccess = () => {
        // filter by kurirId + tanggal, id format: kurirId_customerId_tanggal
        const data = all.result.filter(d =>
          d.kurirId === kurirId && d.tanggal === tanggal
        );
        resolve(data);
      };
      all.onerror = () => resolve([]);
    });
  } catch (e) { return []; }
}

async function saveDsmCell(kurirId, customerId, tanggal, groupKey, varianKey, value) {
  try {
    const db     = await openDsmDB();
    const id     = `${kurirId}_${customerId}_${tanggal}`;
    const tx     = db.transaction(STORE_DSM, "readwrite");
    const st     = tx.objectStore(STORE_DSM);
    const getReq = st.get(id);
    getReq.onsuccess = () => {
      const existing = getReq.result || {
        id, kurirId, customerId, tanggal,
        ...Object.fromEntries(GROUPS.map(g => [g.key, {}]))
      };
      if (!existing[groupKey]) existing[groupKey] = {};
      existing[groupKey][varianKey] = Number(value) || 0;
      existing.updatedAt = Date.now();
      st.put(existing);
    };
  } catch (e) {
    console.error("Gagal simpan DSM:", e);
    showToast("Gagal menyimpan", "error");
  }
}

// popup tambah tidak dipakai di DSM — customer dari IndexedDB
function simpanData() {
  closePopup("popupOverlay");
  showToast("Customer diambil otomatis dari data kurir", "success");
}

async function hapusData() {
  if (!deleteDocId) return;
  const btn = document.getElementById("btnHapusKonfirm");
  btn.disabled    = true;
  btn.textContent = "Menghapus...";
  try {
    const db  = await openDsmDB();
    const tx  = db.transaction(STORE_DSM, "readwrite");
    tx.objectStore(STORE_DSM).delete(deleteDocId);
    await new Promise((res, rej) => {
      tx.oncomplete = res;
      tx.onerror    = () => rej(tx.error);
    });
    showToast("Data dihapus", "success");
    closePopup("confirmOverlay");
    await applyFilter();
  } catch (err) {
    console.error(err);
    showToast("Gagal menghapus", "error");
  } finally {
    btn.disabled    = false;
    btn.textContent = "Hapus";
  }
}

async function simpanCell(kurirId, customerId, tanggal, groupKey, varianKey, value) {
  await saveDsmCell(kurirId, customerId, tanggal, groupKey, varianKey, value);
}

/* ── FILTER & RENDER ───────────────────────── */
// simpan dataHarianMap di scope module supaya bisa diakses renderTable
let _dataHarianMap = {};

async function applyFilter() {
  const q       = val("searchInput").toLowerCase();
  const colSpan = 2 + GROUPS.length * (varianList.length || 1) + 1;

  updatePaginationMinggu();

  if (!selectedKurirId) {
    filteredData = [];
    renderEmpty(colSpan);
    return;
  }

  if (!selectedTanggal) {
    filteredData = [];
    renderEmpty(colSpan);
    return;
  }

  // tampilkan loading dulu
  showTableLoading();

  const tanggalStr = formatTanggal(selectedTanggal);

  // load laporanMarketing untuk tanggal + kurir ini
  const laporanAdmin = await loadLaporanMarketing(tanggalStr, selectedKurirId);

  // ambil data DSM tersimpan untuk kurir + tanggal ini
  const dsmData = await getDsmData(selectedKurirId, tanggalStr);

  // ambil dataHarian dari IndexedDB kalau ada
  const dataHarianCache = await getDataHarian(selectedKurirId, tanggalStr);
  _dataHarianMap        = dataHarianCache?.data || {};
  const dataHarianMap   = _dataHarianMap;

  filteredData = customerList
    .filter(c => {
      const matchQ    = !q || (c.namaCustomer || "").toLowerCase().includes(q);
      const matchHari = c.hari === selectedHari;
      return matchQ && matchHari;
    })
    .map(c => {
      const cId       = c.id || c.uid;
      const saved     = dsmData.find(d => d.customerId === cId);
      const harianDoc = dataHarianMap[cId] || {};

      // mapping dataHarian ke format GROUPS per varian
      const groupData = {};

      GROUPS.forEach(g => {
        groupData[g.key] = {};
        varianList.forEach(v => {
          let val = 0;

          if (g.key === "kemarin") {
            // prioritas: dataHarian → fallback ke field dataKemarin di customer
            const fromHarian   = harianDoc?.dataKemarin?.[v]?.qty;
            const fromCustomer = c.dataKemarin?.[v]?.qty;
            val = fromHarian ?? fromCustomer ?? 0;

          } else if (g.key === "return") {
            val = harianDoc?.return?.[v] ?? 0;

          } else if (g.key === "expired") {
            val = harianDoc?.expired?.[v] ?? 0;

          } else if (g.key === "konsinyasi") {
            val = harianDoc?.konsinyasi?.[v] ?? 0;

          } else if (g.key === "cash") {
            val = harianDoc?.cash?.[v] ?? 0;

          } else if (g.key === "lainnya") {
            val = harianDoc?.lainnya?.[v] ?? 0;

          } else if (g.key === "bayar") {
            // bayar mapping ke pay
            val = harianDoc?.pay?.[v] ?? 0;

          } else if (g.key === "closing") {
            val = harianDoc?.closing?.[v] ?? 0;
          }

          // kalau ada data manual dari dsmDB, prioritaskan
          const manualVal = saved?.[g.key]?.[v];
          groupData[g.key][v] = manualVal !== undefined ? manualVal : val;
        });
      });

      return {
        customerId: cId,
        kurirId:    selectedKurirId,
        tanggal:    tanggalStr,
        nama:       c.namaCustomer || "-",
        alamat:     c.alamat       || "",
        _harian:    harianDoc,
        ...groupData
      };
    });

  renderTable();
  renderRekap(laporanAdmin, dataHarianMap);
  requestAnimationFrame(() => syncFootColWidths());
  renderAnalisa();
}

function renderTable() {
  const tbody   = document.getElementById("dsmTableBody");
  const total   = filteredData.length;
  const colSpan = 2 + GROUPS.length * (varianList.length || 1) + 1;

  if (!total) { renderEmpty(colSpan); return; }

  // hitung sum
  const sums = {};
  GROUPS.forEach(g => {
    sums[g.key] = {};
    (varianList.length ? varianList : ["-"]).forEach(v => {
      sums[g.key][v] = filteredData.reduce((acc, d) =>
        acc + (Number(d[g.key]?.[v]) || 0), 0
      );
    });
  });

  const rows = filteredData.map((d, i) => {
    const customer     = customerList.find(c => c.id === d.customerId || c.namaCustomer === d.nama);
    const namaCustomer = customer?.namaCustomer || d.nama || "-";

    // hitung varian yang beda kemarin vs konsinyasi untuk baris ini saja
    const varianBedaBaris = new Set(
      (varianList.length ? varianList : ["-"]).filter(v => {
        const nilaiKemarin    = Number(d.kemarin?.[v])    || 0;
        const nilaiKonsinyasi = Number(d.konsinyasi?.[v]) || 0;
        return nilaiKemarin !== nilaiKonsinyasi;
      })
    );

    const cells = GROUPS.map(g =>
      (varianList.length ? varianList : ["-"]).map(v => {
        const val_      = d[g.key]?.[v] ?? 0;
        const isBeda    = (g.key === "kemarin" || g.key === "konsinyasi") && varianBedaBaris.has(v);
        const highlight = isBeda ? " cell-beda" : "";
        return `<td class="cell-${g.key}${highlight}"><div class="cell-value">${val_ === 0 ? "" : val_}</div></td>`;
      }).join("")
    ).join("");

    const isInaktif  = customer?.status === false;
    const harianDoc_ = _dataHarianMap[d.customerId] || {};
    const statusKet  = harianDoc_?.keterangan?.status?.toLowerCase() || "";
    const badgeMap   = { tutup: "Tutup", pending: "Pending", putus: "Putus" };
    const badgeLabel = badgeMap[statusKet] || "";
    const fotoKeterangan = harianDoc_?.keterangan?.foto || customer?.foto || "";
    const badgeHtml  = badgeLabel
      ? `<span class="status-badge status-badge-${statusKet}"
           data-customer-id="${d.customerId}"
           data-foto="${esc(fotoKeterangan)}"
           data-nama="${esc(namaCustomer)}"
         >${badgeLabel}</span>`
      : "";

    return `
      <tr class="${isInaktif ? "row-inaktif" : ""}">
        <td>${i + 1}</td>
        <td class="td-nama">
          <div class="nama-customer-wrap">
            <div class="nama-customer">${esc(namaCustomer)}</div>
            ${badgeHtml}
          </div>
          ${customer?.alamat ? `<div class="nama-customer-sub">${esc(customer.alamat)}</div>` : ""}
          ${isInaktif ? `<div class="nama-customer-badge">Nonaktif</div>` : ""}
        </td>
        ${cells}
        <td>
          <button
            class="aksi-btn reload-row"
            title="Reload data customer ini"
            data-customer-id="${d.customerId}"
            data-kurir-id="${d.kurirId}"
            data-tanggal="${d.tanggal}"
            data-nama="${esc(namaCustomer)}"
          >
            <svg viewBox="0 0 24 24"><path d="M21 12a9 9 0 1 1-2.64-6.36"/><path d="M21 3v6h-6"/></svg>
          </button>
        </td>
      </tr>`;
  }).join("");

  const sumCells = GROUPS.map(g =>
    (varianList.length ? varianList : ["-"]).map(v => {
      const s = sums[g.key][v];
      return `<td class="sum-cell cell-${g.key}">${s === 0 ? "" : s}</td>`;
    }).join("")
  ).join("");

  const sumRow = `
    <tr class="sum-row">
      <td colspan="2" class="sum-label">Total</td>
      ${sumCells}
      <td></td>
    </tr>`;

  // baris rekap kosong placeholder (nanti diisi data)
  const rekapCells = REKAP_GROUPS.map(g =>
    (varianList.length ? varianList : ["-"]).map(v =>
      `<td class="rekap-cell rekap-${g.key}"><div class="cell-value">—</div></td>`
    ).join("")
  ).join("");

  const rekapRow = `
    <tr class="rekap-row">
        ${rekapCells}
        <td></td>
      </tr>`;

  tbody.innerHTML = rows + sumRow;

  // render rekap ke tfoot
  const tfoot = document.getElementById("dsmTfoot");
  if (tfoot) {
    const vLen = varianList.length || 1;

    const rekapHeaders = REKAP_GROUPS.map(r => {
      const span = r.varian
        ? vLen
        : (r.colspan || r.sub?.length || 1);
      return `<th colspan="${span}" class="grp-rekap grp-rekap-${r.key}">${r.label}</th>`;
    }).join("");

    const rekapSubCols = REKAP_GROUPS.map(r => {
      if (r.varian) {
        return (varianList.length ? varianList : ["-"])
          .map(v => `<th class="rekap-sub rekap-sub-${r.key}">${v}</th>`).join("");
      }
      if (r.colspan) {
        // kalau rowspan=2 berarti merge ke baris nilai, tidak perlu sub header
        if (r.rowspan) return "";
        return `<th class="rekap-sub rekap-sub-${r.key}" colspan="${r.colspan}">${r.sub?.[0] || ""}</th>`;
      }
      return (r.sub || [])
        .map(s => `<th class="rekap-sub rekap-sub-${r.key}">${s}</th>`).join("");
    }).join("");

    const rekapCells = REKAP_GROUPS.map(g => {
      if (g.varian) {
        return (varianList.length ? varianList : ["-"]).map(v =>
          `<td class="rekap-cell rekap-cell-${g.key}"><div class="cell-value"></div></td>`
        ).join("");
      }
      if (g.colspan) {
        const rowspan = g.rowspan ? ` rowspan="${g.rowspan}"` : "";
        return `<td class="rekap-cell rekap-cell-${g.key}" colspan="${g.colspan}"${rowspan}>
          <div class="cell-value rekap-omset">Rp 0</div>
        </td>`;
      }
      return (g.sub || []).map(s =>
        `<td class="rekap-cell rekap-cell-${g.key}"><div class="cell-value"></div></td>`
      ).join("");
    }).join("");

    // pisahkan omset dari rekapCells — ditaruh di baris sub
    const rekapCellsNoOmset = REKAP_GROUPS.filter(g => !g.rowspan).map(g => {
      if (g.varian) {
        return (varianList.length ? varianList : ["-"]).map(v =>
          `<td class="rekap-cell rekap-cell-${g.key}"><div class="cell-value"></div></td>`
        ).join("");
      }
      return (g.sub || []).map(() =>
        `<td class="rekap-cell rekap-cell-${g.key}"><div class="cell-value"></div></td>`
      ).join("");
    }).join("");

    const omsetGroup = REKAP_GROUPS.find(g => g.rowspan);
    const omsetSubCell = omsetGroup
      ? `<td class="rekap-cell rekap-cell-omset" colspan="${omsetGroup.colspan || 5}" rowspan="2">
          <div class="cell-value rekap-omset">Rp 0</div>
        </td>`
      : "";

    tfoot.innerHTML = `
      <tr class="thead-rekap-row">
        <th rowspan="3" colspan="2" class="rekap-label-th">Rekapitulasi</th>
        ${rekapHeaders}
        <th rowspan="3"></th>
      </tr>
      <tr class="thead-rekap-sub">
        ${rekapSubCols}
        ${omsetSubCell}
      </tr>
      <tr class="rekap-row">
        ${rekapCellsNoOmset}
      </tr>`;
  }
}

function renderEmpty(colSpan = 20) {
  document.getElementById("dsmTableBody").innerHTML = `
    <tr>
      <td colspan="${colSpan}" class="table-empty">
        <div class="empty-state">
          <svg viewBox="0 0 24 24"><path d="M9 17H5a2 2 0 0 0-2 2"/><path d="M14 7h5a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2h-5"/><rect x="3" y="3" width="11" height="11" rx="2"/></svg>
          <span>Tidak ada data</span>
        </div>
      </td>
    </tr>`;
}

function showTableLoading() {
  const colSpan = 2 + GROUPS.length * (varianList.length || 1) + 1;
  document.getElementById("dsmTableBody").innerHTML = `
    <tr class="loading-row">
      <td colspan="${colSpan}">
        <div class="loading-spinner"></div><br>Memuat data...
      </td>
    </tr>`;
}

function updateInfo(total = 0) {
  setText("pageInfo", total ? `${total} customer — ${selectedHari}` : "0 customer");
}

/* ── POPUP ─────────────────────────────────── */
function openPopupTambah() {
  editDocId = null;
  setText("popupTitle", "Tambah Customer");
  setVal("fieldNama", "");
  setVal("fieldCatatan", "");
  openPopup("popupOverlay");
}

function openPopupEdit(id) {
  // di DSM tidak ada edit manual, hapus saja
  showToast("Edit tidak tersedia, data dari IndexedDB customer", "error");
}

function openPopupHapus(id) {
  deleteDocId = id;
  openPopup("confirmOverlay");
}
function openPopupCatatan(customerId, pesanAwal = "") {
  const overlay = document.getElementById("catatanOverlay");
  const input   = document.getElementById("catatanInput");
  const btn     = document.getElementById("btnKirimCatatan");
  if (!overlay || !input || !btn) return;

  input.value       = pesanAwal;
  btn.dataset.customerId = customerId;
  overlay.classList.add("show");
  setTimeout(() => input.focus(), 200);
}
function openPopupFoto(foto, nama, fotoCustomer = "") {
  const overlay = document.getElementById("fotoOverlay");
  if (!overlay) return;

  const body = overlay.querySelector(".popup-body");
  if (!body) return;

  const renderFotoBox = (src, label) => `
    <div class="foto-box">
      <div class="foto-box-label">${label}</div>
      ${src
        ? `<img src="${src}" class="foto-box-img" alt="${label}">`
        : `<div class="foto-no-img">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
              <rect x="3" y="3" width="18" height="18" rx="2"/>
              <circle cx="8.5" cy="8.5" r="1.5"/>
              <polyline points="21 15 16 10 5 21"/>
            </svg>
            <span>Tidak ada foto</span>
          </div>`
      }
    </div>`;

  body.innerHTML = `
    <div class="foto-compare-wrap">
      ${renderFotoBox(fotoCustomer, "Foto Customer")}
      ${renderFotoBox(foto, "Foto Keterangan")}
    </div>`;

  const label = document.getElementById("fotoPreviewNama");
  if (label) label.textContent = nama || "—";

  overlay.classList.add("show");
}
function openPopup(id)  { document.getElementById(id)?.classList.add("show"); }
function closePopup(id) { document.getElementById(id)?.classList.remove("show"); }

/* ── EVENTS ────────────────────────────────── */
let _cellTimer = null;
function syncFootColWidths() {
  const mainTable = document.getElementById("dsmTable");
  const footTable = document.getElementById("dsmFootTable");
  if (!mainTable || !footTable) return;

  // ambil lebar dari tbody row pertama — paling akurat
  const firstRow = mainTable.querySelector("tbody tr:first-child");
  if (!firstRow) return;

  const cells = firstRow.querySelectorAll("td");
  if (!cells.length) return;

  const widths = [...cells].map(td => td.getBoundingClientRect().width);

  let cg = footTable.querySelector("colgroup");
  if (!cg) { cg = document.createElement("colgroup"); footTable.prepend(cg); }
  cg.innerHTML = widths.map(w => `<col style="width:${w}px;min-width:${w}px;max-width:${w}px">`).join("");
}
/* ── DRAG SCROLL HORIZONTAL TABLE ──────────── */
function setupTableDragScroll() {
  const wrap = document.querySelector(".table-main-wrap");
  if (!wrap) return;

  // sync scroll horizontal tfoot ikut tbody
  const footWrap = document.querySelector(".table-foot-wrap");
  if (footWrap) {
    wrap.addEventListener("scroll", () => {
      footWrap.scrollLeft = wrap.scrollLeft;
    });
  }
  // sync lebar kolom foot dengan tabel utama
  syncFootColWidths();

  let isDown   = false;
  let startX   = 0;
  let scrollL  = 0;
  let moved    = false;

  wrap.addEventListener("mousedown", e => {
    // hanya left click, bukan di button
    if (e.button !== 0 || e.target.closest("button")) return;
    isDown  = true;
    moved   = false;
    startX  = e.pageX - wrap.offsetLeft;
    scrollL = wrap.scrollLeft;
    wrap.style.cursor = "grabbing";
    wrap.style.userSelect = "none";
  });

  document.addEventListener("mousemove", e => {
    if (!isDown) return;
    const x    = e.pageX - wrap.offsetLeft;
    const walk = x - startX;
    if (Math.abs(walk) > 5) moved = true;
    wrap.scrollLeft = scrollL - walk;
  });

  document.addEventListener("mouseup", () => {
    if (!isDown) return;
    isDown = false;
    wrap.style.cursor = "";
    wrap.style.userSelect = "";
  });

  // touch drag juga
  let touchStartX  = 0;
  let touchScrollL = 0;

  wrap.addEventListener("touchstart", e => {
    touchStartX  = e.touches[0].pageX;
    touchScrollL = wrap.scrollLeft;
  }, { passive: true });

  wrap.addEventListener("touchmove", e => {
    const dx = touchStartX - e.touches[0].pageX;
    wrap.scrollLeft = touchScrollL + dx;
  }, { passive: true });
}
function initEvents() {
  // Init filter dropdown
  initFilterTahun();

  // set default hari ke hari ini hanya jika belum ada state tersimpan
  const hariNama = ["Minggu","Senin","Selasa","Rabu","Kamis","Jumat","Sabtu"];
  if (!localStorage.getItem(DSM_STATE_KEY)) {
    selectedHari  = hariNama[new Date().getDay()];
    selectedBulan = new Date().getMonth();
    selectedTahun = new Date().getFullYear();
    mingguKe      = 1;
  }
  syncFilterUI();

  // Event filter hari
  document.getElementById("filterHari")?.addEventListener("change", async e => {
    selectedHari = e.target.value;
    mingguKe = 1;
    saveDsmPageState();
    await applyFilter();
  });

  // Event filter bulan
  document.getElementById("filterBulan")?.addEventListener("change", async e => {
    selectedBulan = Number(e.target.value);
    mingguKe = 1;
    saveDsmPageState();
    await applyFilter();
  });

  // Event filter tahun
  document.getElementById("filterTahun")?.addEventListener("change", async e => {
    selectedTahun = Number(e.target.value);
    mingguKe = 1;
    saveDsmPageState();
    await applyFilter();
  });

  // Pagination prev/next minggu
  document.getElementById("btnPrev")?.addEventListener("click", async () => {
    if (mingguKe > 1) { mingguKe--; saveDsmPageState(); await applyFilter(); }
  });
  document.getElementById("btnNext")?.addEventListener("click", async () => {
    if (mingguKe < totalMinggu) { mingguKe++; saveDsmPageState(); await applyFilter(); }
  });
  document.getElementById("btnReload")?.addEventListener("click", async () => {
    if (!selectedKurirId) { showToast("Pilih kurir dulu", "error"); return; }
    if (!selectedTanggal) { showToast("Pilih tanggal dulu", "error"); return; }

    const btn = document.getElementById("btnReload");
    btn.disabled = true;
    showTableLoading();

    try {
      // query kantorCabang dan simpan ke IndexedDB
      await syncKantorCabang();
      // query dataHarian
      await reloadDataHarian(selectedKurirId, formatTanggal(selectedTanggal));
      await applyFilter();
      showToast("Data berhasil dimuat", "success");
    } catch (e) {
      console.error(e);
      showToast("Gagal reload data", "error");
    } finally {
      btn.disabled = false;
    }
  });
  // toggle dropdown periode analisa
  document.getElementById("btnAnalisaPeriode")?.addEventListener("click", e => {
    e.stopPropagation();
    document.getElementById("analisaPeriodeWrap")?.classList.toggle("open");
  });

  // pilih periode
  document.getElementById("analisaPeriodeDropdown")?.addEventListener("click", async e => {
    const opt = e.target.closest(".analisa-periode-option");
    if (!opt) return;
    selectedPeriode = Number(opt.dataset.periode);
    const label = opt.querySelector(".analisa-periode-nama").textContent;
    setText("analisaPeriodeLabel", label);
    document.querySelectorAll(".analisa-periode-option").forEach(o =>
      o.classList.toggle("active", o.dataset.periode === String(selectedPeriode))
    );
    document.getElementById("analisaPeriodeWrap")?.classList.remove("open");
    await renderAnalisa();
  });

  // tutup dropdown kalau klik luar
  document.addEventListener("click", e => {
    if (!e.target.closest("#analisaPeriodeWrap")) {
      document.getElementById("analisaPeriodeWrap")?.classList.remove("open");
    }
  });
  document.querySelector(".at-filter-wrap")?.addEventListener("click", async e => {
    const chip = e.target.closest(".at-filter-chip");
    if (!chip) return;
    const f = chip.dataset.filter;

    if (f === "default") {
      analisaFilter.clear();
      document.querySelectorAll(".at-filter-chip").forEach(c => c.classList.remove("at-filter-active"));
      chip.classList.add("at-filter-active");
    } else {
      document.querySelector('.at-filter-chip[data-filter="default"]')?.classList.remove("at-filter-active");
      if (analisaFilter.has(f)) {
        analisaFilter.delete(f);
        chip.classList.remove("at-filter-active");
      } else {
        analisaFilter.add(f);
        chip.classList.add("at-filter-active");
      }
      if (analisaFilter.size === 0) {
        analisaFilter.clear();
        document.querySelector('.at-filter-chip[data-filter="default"]')?.classList.add("at-filter-active");
      }
    }
    await renderAnalisa();
  });
  document.getElementById("btnExport")?.addEventListener("click", exportExcel);
  document.getElementById("searchInput")?.addEventListener("input", () => applyFilter());
  document.getElementById("btnSimpan")?.addEventListener("click", simpanData);
  document.getElementById("popupClose")?.addEventListener("click", () => closePopup("popupOverlay"));
  document.getElementById("confirmClose")?.addEventListener("click", () => closePopup("confirmOverlay"));
  document.getElementById("btnBatal")?.addEventListener("click", () => closePopup("confirmOverlay"));
  document.getElementById("btnHapusKonfirm")?.addEventListener("click", hapusData);

  document.getElementById("popupOverlay")?.addEventListener("click", e => {
    if (e.target === e.currentTarget) closePopup("popupOverlay");
  });
  document.getElementById("confirmOverlay")?.addEventListener("click", e => {
    if (e.target === e.currentTarget) closePopup("confirmOverlay");
  });
  // Delegasi: klik tombol catatan di analisa
  document.getElementById("analisaGroups")?.addEventListener("click", e => {
    const btn = e.target.closest(".catatan-head-btn");
    if (!btn) return;
    openPopupCatatan(btn.dataset.customerId, btn.dataset.pesan || "");
  });
  // Delegasi: klik badge status
  document.getElementById("dsmTableBody")?.addEventListener("click", e => {
    const badge = e.target.closest(".status-badge");
    if (!badge) return;
    const foto         = badge.dataset.foto;
    const nama         = badge.dataset.nama;
    const customerId   = badge.dataset.customerId;
    const customer     = customerList.find(c => (c.id || c.uid) === customerId);
    const fotoCustomer = customer?.foto || "";
    openPopupFoto(foto, nama, fotoCustomer);
  });
  // Delegasi: reload per baris
  document.getElementById("dsmTableBody")?.addEventListener("click", async e => {
    const reloadBtn = e.target.closest(".reload-row");
    if (!reloadBtn) return;

    const customerId = reloadBtn.dataset.customerId;
    const kurirId    = reloadBtn.dataset.kurirId;
    const tanggal    = reloadBtn.dataset.tanggal;
    const nama       = reloadBtn.dataset.nama;

    reloadBtn.disabled = true;
    reloadBtn.classList.add("spinning");

    try {
      await reloadDataHarianCustomer(kurirId, customerId, tanggal);
      await applyFilter();
      showToast(`✓ ${nama} diperbarui`, "success");
    } catch (err) {
      console.error(err);
      showToast("Gagal reload", "error");
    } finally {
      reloadBtn.disabled = false;
      reloadBtn.classList.remove("spinning");
    }
  });

  // Kurir dropdown toggle
  document.getElementById("btnPilihKurir")?.addEventListener("click", e => {
    e.stopPropagation();
    const wrap = document.getElementById("kurirSelectWrap");
    const isOpen = wrap.classList.contains("open");
    if (!isOpen) renderKurirDropdown();
    wrap.classList.toggle("open");
  });

  // Pilih kurir
  document.getElementById("kurirDropdown")?.addEventListener("click", async e => {
    const opt = e.target.closest(".kurir-option");
    if (!opt) return;
    selectedKurirId = opt.dataset.uid;
    const nama = kurirList.find(u => u.uid === selectedKurirId)?.nama || "Kurir";
    setText("kurirSelectLabel", nama);
    document.getElementById("kurirSelectWrap").classList.remove("open");
    saveDsmPageState();

    // load customer milik kurir ini
    showTableLoading();
    await loadCustomerByKurir(selectedKurirId);
    await applyFilter();
  });

  // Tutup dropdown kalau klik di luar
  document.addEventListener("click", e => {
    if (!e.target.closest("#kurirSelectWrap")) {
      document.getElementById("kurirSelectWrap")?.classList.remove("open");
    }
  });

  setupSwipe("popupBox",   "popupOverlay");
  setupSwipe("confirmBox", "confirmOverlay");
  setupDrag("popupBox",    "popupHandle");
  setupTableDragScroll();
  // Notifikasi analisa
  document.getElementById("btnNotifAnalisa")?.addEventListener("click", () => {
    // isi otomatis pesan
    setVal("notifAnalisaJudul", "Evaluasi");
    setVal("notifAnalisaPesan", buildPesanNotif());
    openPopup("notifAnalisaOverlay");
  });
  // Tab kirim/history
  document.getElementById("notifTabKirim")?.addEventListener("click", () => {
    document.getElementById("notifAnalisaForm").style.display    = "";
    document.getElementById("notifAnalisaHistory").style.display = "none";
    document.getElementById("notifTabKirim").classList.add("active");
    document.getElementById("notifTabHistory").classList.remove("active");
  });

  document.getElementById("notifTabHistory")?.addEventListener("click", () => {
    document.getElementById("notifAnalisaForm").style.display    = "none";
    document.getElementById("notifAnalisaHistory").style.display = "";
    document.getElementById("notifTabKirim").classList.remove("active");
    document.getElementById("notifTabHistory").classList.add("active");
    loadNotifAnalisaHistory();
  });
  document.getElementById("notifAnalisaClose")?.addEventListener("click", () =>
    closePopup("notifAnalisaOverlay")
  );
  document.getElementById("notifAnalisaOverlay")?.addEventListener("click", e => {
    if (e.target === e.currentTarget) closePopup("notifAnalisaOverlay");
  });

  document.getElementById("btnKirimNotifAnalisa")?.addEventListener("click", async () => {
    const btn   = document.getElementById("btnKirimNotifAnalisa");
    const judul = val("notifAnalisaJudul").trim();
    const pesan = val("notifAnalisaPesan").trim();

    if (!judul || !pesan) { showToast("Judul dan pesan wajib diisi", "error"); return; }

    btn.disabled    = true;
    btn.textContent = "Mengirim...";

    const ok = await kirimNotifEvaluasi(judul, pesan);
    if (ok) {
      showToast("Notifikasi terkirim", "success");
      closePopup("notifAnalisaOverlay");
      // reset ke tab kirim
      document.getElementById("notifAnalisaForm").style.display    = "";
      document.getElementById("notifAnalisaHistory").style.display = "none";
      document.getElementById("notifTabKirim")?.classList.add("active");
      document.getElementById("notifTabHistory")?.classList.remove("active");
    } else {
      showToast("Gagal mengirim", "error");
    }

    btn.disabled    = false;
    btn.innerHTML   = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" style="width:14px;height:14px"><path d="M3.478 2.404a.75.75 0 0 0-.926.941l2.432 7.905H13.5a.75.75 0 0 1 0 1.5H4.984l-2.432 7.905a.75.75 0 0 0 .926.94 60.519 60.519 0 0 0 18.445-8.986.75.75 0 0 0 0-1.218A60.517 60.517 0 0 0 3.478 2.404Z" /></svg> Kirim Notifikasi`;
  });
  document.getElementById("fotoClose")?.addEventListener("click", () =>
    closePopup("fotoOverlay")
  );
  document.getElementById("fotoOverlay")?.addEventListener("click", e => {
    if (e.target === e.currentTarget) closePopup("fotoOverlay");
  });
  setupSwipe("fotoBox", "fotoOverlay");
  setupDrag("fotoBox", "fotoHandle");
  setupSwipe("catatanBox", "catatanOverlay");
  setupDrag("catatanBox",  "catatanHandle");
  setupSwipe("notifAnalisaBox", "notifAnalisaOverlay");
  setupDrag("notifAnalisaBox",  "notifAnalisaHandle");

  document.getElementById("catatanClose")?.addEventListener("click", () =>
    closePopup("catatanOverlay")
  );
  document.getElementById("catatanOverlay")?.addEventListener("click", e => {
    if (e.target === e.currentTarget) closePopup("catatanOverlay");
  });

  document.getElementById("btnKirimCatatan")?.addEventListener("click", async () => {
    const btn        = document.getElementById("btnKirimCatatan");
    const customerId = btn.dataset.customerId;
    const pesan      = document.getElementById("catatanInput")?.value.trim();

    btn.disabled    = true;
    btn.textContent = "Mengirim...";

    const ok = pesan
      ? await simpanEvaluasi(customerId, pesan)
      : await hapusEvaluasi(customerId);
    if (ok) {
      const c = customerList.find(x => (x.id || x.uid) === customerId);
      if (c) c.evaluasi = pesan ? {
        pesan,
        updatedAt: Date.now(),
        updatedBy: currentUser.uid,
        readAt: null,
        readBy: null
      } : null;

      // tutup popup
      closePopup("catatanOverlay");
      showToast("Evaluasi terkirim", "success");

      // simpan state accordion yang terbuka
      const openGroups = [...document.querySelectorAll(".analisa-group.open")]
        .map(el => el.querySelector(".analisa-group-head span")?.textContent?.trim());

      // render ulang
      await renderAnalisa();

      // restore accordion yang tadi terbuka
      document.querySelectorAll(".analisa-group").forEach(el => {
        const label = el.querySelector(".analisa-group-head span")?.textContent?.trim();
        if (openGroups.includes(label)) el.classList.add("open");
      });

    } else {
      showToast("Gagal mengirim", "error");
    }

    btn.disabled    = false;
    btn.textContent = "Kirim Evaluasi";
  });
}

/* ── SWIPE TO CLOSE (mobile) ───────────────── */
function setupSwipe(boxId, overlayId) {
  const box = document.getElementById(boxId);
  if (!box) return;
  let startY = 0, curY = 0, dragging = false;

  box.addEventListener("touchstart", e => {
    if (window.innerWidth > 768) return;
    startY = e.touches[0].clientY; curY = startY; dragging = true;
    box.style.transition = "none";
  }, { passive: true });

  box.addEventListener("touchmove", e => {
    if (!dragging || window.innerWidth > 768) return;
    curY = e.touches[0].clientY;
    const dy = curY - startY;
    if (dy < 0) return;
    e.preventDefault();
    box.style.transform = `translateY(${dy}px)`;
  }, { passive: false });

  box.addEventListener("touchend", () => {
    if (!dragging || window.innerWidth > 768) return;
    dragging = false;
    box.style.transition = "";
    if (curY - startY > 100) {
      box.style.transform = "translateY(100%)";
      setTimeout(() => { closePopup(overlayId); box.style.transform = ""; }, 280);
    } else {
      box.style.transform = "";
    }
  });
}

/* ── DRAG POPUP DESKTOP ────────────────────── */
function setupDrag(boxId, handleId) {
  const box    = document.getElementById(boxId);
  const handle = document.getElementById(handleId);
  if (!box || !handle) return;
  let active = false, ox = 0, oy = 0;

  handle.addEventListener("mousedown", e => {
    if (window.innerWidth <= 768 || e.target.closest("button")) return;
    active = true;
    const r = box.getBoundingClientRect();
    box.style.cssText += ";position:fixed;margin:0;";
    box.style.left  = r.left + "px";
    box.style.top   = r.top  + "px";
    box.style.right = "auto";
    box.style.transform = "none";
    ox = e.clientX - r.left;
    oy = e.clientY - r.top;
    document.body.style.userSelect = "none";
  });

  document.addEventListener("mousemove", e => {
    if (!active) return;
    box.style.left = Math.max(0, Math.min(e.clientX - ox, window.innerWidth  - box.offsetWidth))  + "px";
    box.style.top  = Math.max(0, Math.min(e.clientY - oy, window.innerHeight - box.offsetHeight)) + "px";
  });

  document.addEventListener("mouseup", () => {
    active = false;
    document.body.style.userSelect = "";
  });
}

/* ── EXPORT EXCEL ──────────────────────────── */
function exportExcel() {
  if (!filteredData.length) { showToast("Tidak ada data untuk di-export", "error"); return; }

  const headers = ["No", "Nama Customer"];
  GROUPS.forEach(g => {
    (varianList.length ? varianList : ["-"]).forEach(v => {
      headers.push(`${g.label} - ${v}`);
    });
  });

  const rows = filteredData.map((d, i) => {
    const row = { No: i + 1, "Nama Customer": d.nama || "-" };
    GROUPS.forEach(g => {
      (varianList.length ? varianList : ["-"]).forEach(v => {
        row[`${g.label} - ${v}`] = d[g.key]?.[v] ?? 0;
      });
    });
    return row;
  });

  const ws = XLSX.utils.json_to_sheet(rows, { header: headers });
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "DSM");
  XLSX.writeFile(wb, `DSM_${new Date().toISOString().slice(0,10)}.xlsx`);
  showToast("Export berhasil", "success");
}

/* ── CLOCK ─────────────────────────────────── */
function startClock() {
  const hari = ["Minggu","Senin","Selasa","Rabu","Kamis","Jumat","Sabtu"];
  const bln  = ["Jan","Feb","Mar","Apr","Mei","Jun","Jul","Agt","Sep","Okt","Nov","Des"];
  function tick() {
    const now = new Date();
    setText("headerDate", `${hari[now.getDay()]}, ${now.getDate()} ${bln[now.getMonth()]} ${now.getFullYear()}`);
    setText("headerTime", now.toLocaleTimeString("id-ID", { hour:"2-digit", minute:"2-digit" }));
  }
  tick();
  setInterval(tick, 1000);
}

/* ── TOAST ─────────────────────────────────── */
let _toastTimer = null;
function showToast(msg, type = "") {
  let t = document.querySelector(".toast");
  if (!t) { t = document.createElement("div"); t.className = "toast"; document.body.appendChild(t); }
  t.textContent = msg;
  t.className   = `toast ${type}`;
  requestAnimationFrame(() => t.classList.add("show"));
  clearTimeout(_toastTimer);
  _toastTimer = setTimeout(() => t.classList.remove("show"), 2800);
}
/* ── LOAD TRIKOTOMI FROM INDEXEDDB ─────────── */
async function syncKantorCabang() {
  if (!idCabang) return;
  try {
    const snap = await getDoc(doc(db, "kantorCabang", idCabang));
    if (!snap.exists()) return;

    const data = snap.data();

    // simpan ke IndexedDB laporanDistribusiDB store kantorCabang
    const req = indexedDB.open("laporanDistribusiDB");
    await new Promise((resolve, reject) => {
      req.onsuccess = () => {
        try {
          const idb = req.result;
          if (!idb.objectStoreNames.contains("kantorCabang")) {
            resolve(); return;
          }
          const tx    = idb.transaction("kantorCabang", "readwrite");
          const store = tx.objectStore("kantorCabang");
          store.put({ ...data, id: idCabang });
          tx.oncomplete = () => resolve();
          tx.onerror    = () => reject(tx.error);
        } catch (e) { resolve(); }
      };
      req.onerror = () => reject(req.error);
    });

    console.log("✅ kantorCabang synced");
  } catch (e) {
    console.error("Gagal sync kantorCabang:", e);
  }
}
async function loadTrikotomi() {
  return new Promise(resolve => {
    try {
      const req = indexedDB.open("laporanDistribusiDB");
      req.onsuccess = () => {
        try {
          const idb = req.result;
          if (!idb.objectStoreNames.contains("kantorCabang")) {
            resolve(TRI_DEFAULT); return;
          }
          const tx  = idb.transaction("kantorCabang", "readonly");
          const st  = tx.objectStore("kantorCabang");
          const all = st.getAll();
          all.onsuccess = () => {
            const kantor    = all.result?.[0] || {};
            const trikotomi = kantor?.trikotomi || null;
            resolve(trikotomi ? { ...TRI_DEFAULT, ...trikotomi } : TRI_DEFAULT);
          };
          all.onerror = () => resolve(TRI_DEFAULT);
        } catch (e) { resolve(TRI_DEFAULT); }
      };
      req.onerror = () => resolve(TRI_DEFAULT);
    } catch (e) { resolve(TRI_DEFAULT); }
  });
}
/* ── EVALUASI CUSTOMER ─────────────────────── */
async function hapusEvaluasi(customerId) {
  try {
    await updateDoc(doc(db, "customer", customerId), {
      evaluasi: deleteField()
    });
    await updateCustomerEvaluasiIDB(customerId, null);
    return true;
  } catch (e) {
    console.error("Gagal hapus evaluasi:", e);
    return false;
  }
}
async function simpanEvaluasi(customerId, pesan) {
  try {

    const payload = {
      evaluasi: {
        pesan,
        updatedAt:  serverTimestamp(),
        updatedBy:  currentUser.uid,
        readAt:     null,
        readBy:     null,
      }
    };

    // simpan ke Firestore
    await updateDoc(doc(db, "customer", customerId), payload);

    // update IndexedDB store customer
    await updateCustomerEvaluasiIDB(customerId, {
      pesan,
      updatedAt: Date.now(),
      updatedBy: currentUser.uid,
      readAt:    null,
      readBy:    null,
    });

    return true;
  } catch (e) {
    console.error("Gagal simpan evaluasi:", e);
    return false;
  }
}

async function updateCustomerEvaluasiIDB(customerId, evaluasi) {
  return new Promise(resolve => {
    try {
      const checkReq = indexedDB.open("customerDB");
      checkReq.onsuccess = e => {
        const existing     = e.target.result;
        const curVersion   = existing.version;
        existing.close();
        const req = indexedDB.open("customerDB", curVersion);
        req.onsuccess = () => {
          try {
            const idb    = req.result;
            const tx     = idb.transaction("customer", "readwrite");
            const st     = tx.objectStore("customer");
            const getReq = st.get(customerId);
            getReq.onsuccess = () => {
              const existing = getReq.result;
              if (!existing) { resolve(); return; }
              if (evaluasi === null) {
                delete existing.evaluasi;
              } else {
                existing.evaluasi = evaluasi;
              }
              st.put(existing);
              tx.oncomplete = () => resolve();
            };
            getReq.onerror = () => resolve();
          } catch (e) { resolve(); }
        };
        req.onerror = () => resolve();
      };
      checkReq.onerror = () => resolve();
    } catch (e) { resolve(); }
  });
}

function hitungMingguKe(updatedAtMs, hari, bulan, tahun) {
  if (!updatedAtMs) return null;
  const tanggalList = hitungMingguDalamBulan(hari, bulan, tahun);
  const updatedDate = new Date(updatedAtMs);
  const updatedStr  = formatTanggal(updatedDate);
  const idx = tanggalList.findIndex(d => formatTanggal(d) === updatedStr);
  if (idx >= 0) return idx + 1;
  // cek bulan sebelumnya
  const bulanPrev = bulan === 0 ? 11 : bulan - 1;
  const tahunPrev = bulan === 0 ? tahun - 1 : tahun;
  const listPrev  = hitungMingguDalamBulan(hari, bulanPrev, tahunPrev);
  const idxPrev   = listPrev.findIndex(d => formatTanggal(d) === updatedStr);
  if (idxPrev >= 0) return `Bln lalu Mg${idxPrev + 1}`;
  // fallback tanggal saja
  return `${updatedDate.getDate()}/${updatedDate.getMonth() + 1}`;
}
/* ── ANALISA TRIKOTOMI ─────────────────────── */
const TRI_DEFAULT = {
  produktif:    { return: { min:0, max:1  }, expired: { min:0, max:0    } },
  stabil:       { return: { min:2, max:2  }, expired: { min:0, max:1    } },
  nonProduktif: { return: { min:3, max:9999 }, expired: { min:2, max:9999 } }
};

function triInRange(val, min, max) { return val >= min && val <= max; }

function triKlasifikasi(returnTotal, expiredTotal, tri = TRI_DEFAULT) {
  function getK(val, field) {
    if (triInRange(val, tri.produktif[field].min,    tri.produktif[field].max))    return 1;
    if (triInRange(val, tri.stabil[field].min,       tri.stabil[field].max))       return 2;
    if (triInRange(val, tri.nonProduktif[field].min, tri.nonProduktif[field].max)) return 3;
    return 0;
  }
  const worst = Math.max(getK(returnTotal, "return"), getK(expiredTotal, "expired"));
  return worst === 3 ? "red" : worst === 2 ? "yellow" : worst === 1 ? "green" : "grey";
}

function triTanggalReferensi() {
  const tanggalList = hitungMingguDalamBulan(selectedHari, selectedBulan, selectedTahun);

  function getTanggalMundur(mundur) {
    const targetMinggu = mingguKe - mundur;
    if (targetMinggu >= 1) return tanggalList[targetMinggu - 1] || null;

    const kurang    = Math.abs(targetMinggu) + 1;
    const bulanPrev = selectedBulan === 0 ? 11 : selectedBulan - 1;
    const tahunPrev = selectedBulan === 0 ? selectedTahun - 1 : selectedTahun;
    const listPrev  = hitungMingguDalamBulan(selectedHari, bulanPrev, tahunPrev);
    const idxPrev   = listPrev.length - kurang;
    return idxPrev >= 0 ? listPrev[idxPrev] : null;
  }

  if (selectedPeriode === 1) {
    // T-1: hanya 1 minggu sebelumnya
    const t = getTanggalMundur(1);
    return t ? [t] : [];
  }

  // T-2: kumpulkan T-1 dan T-2, rata-rata nanti di renderAnalisa
  const t1 = getTanggalMundur(1);
  const t2 = getTanggalMundur(2);
  return [t1, t2].filter(Boolean);
}
/* ── RENDER REKAP ──────────────────────────── */
function renderRekap(laporanAdmin = {}, dataHarianMap = {}) {
  const tfoot = document.getElementById("dsmTfoot");
  if (!tfoot) return;

  // ambil order per varian dari laporanMarketing
  const orderData = getRekapOrder(laporanAdmin);

  // update cell order di rekap-row
  const rekapCells = tfoot.querySelectorAll(".rekap-row .rekap-order .cell-value");

  // rebuild rekap row dengan nilai order
  const rekapRow = tfoot.querySelector(".rekap-row");
  if (!rekapRow) return;

  const vLen = varianList.length || 1;

  const rekapCellsHtml = REKAP_GROUPS.map(g => {
    if (g.key === "order") {
      return (varianList.length ? varianList : ["-"]).map(v => {
        const val_ = orderData?.[v] ?? 0;
        return `<td class="rekap-cell rekap-order">
          <div class="cell-value">${val_ === 0 ? "" : val_}</div>
        </td>`;
      }).join("");
    }

    if (g.key === "fee") {
      return (varianList.length ? varianList : ["-"]).map(v => {
        const total = filteredData.reduce((acc, d) => {
          const cId      = d.customerId;
          const harianDoc = dataHarianMap[cId] || {};
          return acc + (Number(harianDoc?.fee?.[v]) || 0);
        }, 0);
        return `<td class="rekap-cell rekap-fee">
          <div class="cell-value">${total === 0 ? "" : total}</div>
        </td>`;
      }).join("");
    }

    if (g.key === "disable") {
      return (varianList.length ? varianList : ["-"]).map(v => {
        const total = filteredData.reduce((acc, d) => {
          const cId       = d.customerId;
          const harianDoc = dataHarianMap[cId] || {};
          return acc + (Number(harianDoc?.disable?.[v]) || 0);
        }, 0);
        return `<td class="rekap-cell rekap-disable">
          <div class="cell-value">${total === 0 ? "" : total}</div>
        </td>`;
      }).join("");
    }

    if (g.key === "output") {
      return (varianList.length ? varianList : ["-"]).map(v => {
        const total = filteredData.reduce((acc, d) => {
          const cId       = d.customerId;
          const harianDoc = dataHarianMap[cId] || {};
          const closing   = Number(harianDoc?.closing?.[v])  || 0;
          const fee       = Number(harianDoc?.fee?.[v])      || 0;
          const disable   = Number(harianDoc?.disable?.[v])  || 0;
          return acc + closing + fee + disable;
        }, 0);
        return `<td class="rekap-cell rekap-output">
          <div class="cell-value">${total === 0 ? "" : total}</div>
        </td>`;
      }).join("");
    }

    if (g.key === "saldo") {
      return (varianList.length ? varianList : ["-"]).map(v => {
        const orderVal = Number(orderData?.[v]) || 0;
        const output   = filteredData.reduce((acc, d) => {
          const cId       = d.customerId;
          const harianDoc = dataHarianMap[cId] || {};
          const closing   = Number(harianDoc?.closing?.[v])  || 0;
          const fee       = Number(harianDoc?.fee?.[v])      || 0;
          const disable   = Number(harianDoc?.disable?.[v])  || 0;
          return acc + closing + fee + disable;
        }, 0);
        const saldo = orderVal - output;
        return `<td class="rekap-cell rekap-saldo">
          <div class="cell-value">${saldo === 0 ? "" : saldo}</div>
        </td>`;
      }).join("");
    }

    if (g.key === "pay") {
      return (varianList.length ? varianList : ["-"]).map(v => {
        const total = filteredData.reduce((acc, d) => {
          const cId       = d.customerId;
          const harianDoc = dataHarianMap[cId] || {};
          return acc + (Number(harianDoc?.pay?.[v]) || 0);
        }, 0);
        return `<td class="rekap-cell rekap-pay">
          <div class="cell-value">${total === 0 ? "" : total}</div>
        </td>`;
      }).join("");
    }

    // kolom lain masih placeholder
    if (g.varian) {
      return (varianList.length ? varianList : ["-"]).map(() =>
        `<td class="rekap-cell rekap-${g.key}"><div class="cell-value"></div></td>`
      ).join("");
    }
    if (g.key === "customer") {
      const statusList = ["Tutup", "Pending", "Putus", "Expired"];
      return statusList.map(s => {
        if (s === "Expired") {
          const totalExpired = filteredData.reduce((acc, d) => {
            const harianDoc = dataHarianMap[d.customerId] || {};
            return acc + Object.values(harianDoc?.expired || {})
              .reduce((a, v) => a + (Number(v) || 0), 0);
          }, 0);

          const totalPay = filteredData.reduce((acc, d) => {
            const harianDoc = dataHarianMap[d.customerId] || {};
            return acc + Object.values(harianDoc?.pay || {})
              .reduce((a, v) => a + (Number(v) || 0), 0);
          }, 0);

          const persen = totalPay > 0
            ? Math.floor((totalExpired / totalPay) * 100)
            : 0;

          return `<td class="rekap-cell rekap-customer">
            <div class="cell-value">${persen + "%"}</div>
          </td>`;
        }
        const count = filteredData.reduce((acc, d) => {
          const harianDoc = dataHarianMap[d.customerId] || {};
          const status    = harianDoc?.keterangan?.status || "";
          return acc + (status.toLowerCase() === s.toLowerCase() ? 1 : 0);
        }, 0);
        return `<td class="rekap-cell rekap-customer">
          <div class="cell-value">${count === 0 ? "" : count}</div>
        </td>`;
      }).join("");
    }

    if (g.key === "omset") {
        const totalOmset = filteredData.reduce((acc, d) => {
          const harianDoc = dataHarianMap[d.customerId] || {};
          return acc + (Number(harianDoc?.pembayaran?.bayarKonsumen) || 0);
        }, 0);

        const formatted = totalOmset.toLocaleString("id-ID", {
          style: "currency", currency: "IDR", minimumFractionDigits: 0
        });

        // update cell omset yang sudah dirender di baris sub
        setTimeout(() => {
          const omsetCell = tfoot?.querySelector(".rekap-cell-omset .cell-value");
          if (omsetCell) omsetCell.textContent = totalOmset === 0 ? "Rp 0" : formatted;
        }, 0);

        return ""; // tidak render di rekap-row
      }
    return (g.sub || []).map(() =>
      `<td class="rekap-cell rekap-${g.key}"><div class="cell-value"></div></td>`
    ).join("");
  }).join("");

  rekapRow.innerHTML = `${rekapCellsHtml}<td></td>`;
}
async function renderAnalisa() {
  const groupEl = document.getElementById("analisaGroups");
  if (!groupEl) return;

  const tri = await loadTrikotomi();

  if (!selectedKurirId || !selectedTanggal) {
    groupEl.innerHTML = `<div class="analisa-empty">Pilih kurir dan tanggal dulu</div>`;
    return;
  }

  groupEl.innerHTML = `<div class="analisa-empty">Memuat analisa...</div>`;

  const refDates = triTanggalReferensi();
  const bulanNama = ["Jan","Feb","Mar","Apr","Mei","Jun","Jul","Agt","Sep","Okt","Nov","Des"];

  if (!refDates.length) {
    groupEl.innerHTML = `<div class="analisa-empty">Tidak ada data minggu sebelumnya</div>`;
    setText("analisaGreen", "0"); setText("analisaYellow", "0");
    setText("analisaRed", "0");
    setText("analisaGrey", String(customerList.filter(c => c.hari === selectedHari).length));
    return;
  }

  // fetch semua data sekaligus
  const rawMap = {};
  for (const d of refDates) {
    const tStr  = formatTanggal(d);
    const cache = await getDataHarian(selectedKurirId, tStr);
    Object.entries(cache?.data || {}).forEach(([cid, doc]) => {
      if (!rawMap[cid]) rawMap[cid] = [];
      rawMap[cid].push({ ...doc, _tanggal: tStr });
    });
  }

  const latestMap = {};
  Object.entries(rawMap).forEach(([cid, docs]) => {
    if (selectedPeriode === 1 || docs.length === 1) {
      latestMap[cid] = docs[0];
    } else {
      const allVarian = new Set();
      docs.forEach(d => {
        Object.keys(d.return  || {}).forEach(v => allVarian.add(v));
        Object.keys(d.expired || {}).forEach(v => allVarian.add(v));
        Object.keys(d.closing || {}).forEach(v => allVarian.add(v));
      });
      const avg = {};
      allVarian.forEach(v => {
        avg[v] = {
          r:  Math.round(docs.map(d => Number(d.return?.[v]  || 0)).reduce((a,b) => a+b,0) / docs.length),
          e:  Math.round(docs.map(d => Number(d.expired?.[v] || 0)).reduce((a,b) => a+b,0) / docs.length),
          cl: Math.round(docs.map(d => Number(d.closing?.[v] || 0)).reduce((a,b) => a+b,0) / docs.length),
        };
      });
      const avgReturn = {}, avgExpired = {}, avgClosing = {};
      allVarian.forEach(v => { avgReturn[v] = avg[v].r; avgExpired[v] = avg[v].e; avgClosing[v] = avg[v].cl; });
      latestMap[cid] = { ...docs[docs.length-1], return: avgReturn, expired: avgExpired, closing: avgClosing };
    }
  });

  const allTanggal = hitungMingguDalamBulan(selectedHari, selectedBulan, selectedTahun).slice(0, mingguKe);

  // kelompokkan sesuai periode
  const semuaTanggalGroups = [];
  if (selectedPeriode === 1) {
    allTanggal.forEach(d => semuaTanggalGroups.push([d]));
  } else {
    for (let i = 0; i < allTanggal.length; i += 2) {
      semuaTanggalGroups.push(allTanggal.slice(i, i + 2));
    }
  }
  const semuaTanggal = allTanggal; // tetap pakai untuk fetch data
  const dataHarianPerTanggal = {};
  for (const d of semuaTanggal) {
    const tStr  = formatTanggal(d);
    const cache = await getDataHarian(selectedKurirId, tStr);
    dataHarianPerTanggal[tStr] = cache?.data || {};
  }

  const activeCustomers = customerList.filter(c => c.hari === selectedHari);

  const result = activeCustomers.map(c => {
    const cid      = c.id || c.uid;
    const dsm      = latestMap[cid] || null;
    const retTotal = dsm ? Object.values(dsm.return  || {}).reduce((a,v) => a + (Number(v)||0), 0) : 0;
    const expTotal = dsm ? Object.values(dsm.expired || {}).reduce((a,v) => a + (Number(v)||0), 0) : 0;
    const history  = semuaTanggal.map((d, idx) => {
      const tStr      = formatTanggal(d);
      const harianDoc = dataHarianPerTanggal[tStr]?.[cid] || null;
      const r  = harianDoc ? Object.values(harianDoc.return  || {}).reduce((a,v) => a+(Number(v)||0), 0) : null;
      const e  = harianDoc ? Object.values(harianDoc.expired || {}).reduce((a,v) => a+(Number(v)||0), 0) : null;
      const p  = harianDoc ? Object.values(harianDoc.pay     || {}).reduce((a,v) => a+(Number(v)||0), 0) : null;
      const cl = harianDoc ? Object.values(harianDoc.closing || {}).reduce((a,v) => a+(Number(v)||0), 0) : null;
      return { minggu: idx+1, tgl: d.getDate(), r, e, p, cl, status: harianDoc?.keterangan?.status || null, hasData: !!harianDoc };
    });
    // cek status minggu aktif
    const statusMingguAktif = history.find(h => h.minggu === mingguKe)?.status?.toLowerCase() || "";
    const isTutupOrPending  = statusMingguAktif === "tutup" || statusMingguAktif === "pending";

    let statusTrikotomi = dsm ? triKlasifikasi(retTotal, expTotal, tri) : "grey";

    // override: tutup/pending → stabil (kuning)
    if (isTutupOrPending && statusTrikotomi !== "red") {
      statusTrikotomi = "yellow";
    }

    return {
      nama:       c.namaCustomer || "-", customerId: cid,
      status:     statusTrikotomi,
      evaluasi:   c.evaluasi || null, history
    };
  });

  const green  = result.filter(x => x.status === "green");
  const yellow = result.filter(x => x.status === "yellow");
  const red    = result.filter(x => x.status === "red");
  const grey   = result.filter(x => x.status === "grey");

  setText("analisaGreen",  String(green.length));
  setText("analisaYellow", String(yellow.length));
  setText("analisaRed",    String(red.length));
  setText("analisaGrey",   String(grey.length));

  const refLabel = refDates.map(d => `${selectedHari} ${d.getDate()} ${bulanNama[d.getMonth()]} ${d.getFullYear()}`).join(", ");
  setText("analisaSubtitle", `Referensi: ${refLabel}`);

  // ── BUILD TABEL TUNGGAL ──
  // thead baris 1: Customer + per minggu (colspan 4) + % (colspan 3) + Evaluasi (colspan 8) + Status
  let th1 = `<th rowspan="2" class="at-th at-no">No.</th><th rowspan="2" class="at-th at-nama">Customer</th>`;
  semuaTanggalGroups.forEach((grp, gi) => {
    const mc       = `at-mg-${(gi % 5) + 1}`;
    const isActive = grp.some((d, i) => allTanggal.indexOf(d) + 1 === mingguKe);
    const idxFirst = gi * (selectedPeriode === 2 ? 2 : 1);
    const idxLast  = idxFirst + grp.length - 1;
    const label    = grp.length === 1
      ? `Mg${idxFirst + 1} · ${grp[0].getDate()} ${bulanNama[grp[0].getMonth()]}`
      : `Mg${idxFirst + 1}-${idxLast + 1} · ${grp[0].getDate()}-${grp[grp.length-1].getDate()} ${bulanNama[grp[0].getMonth()]}`;
    th1 += `<th colspan="4" class="at-th ${mc} ${isActive ? "at-active-head" : ""}">${label}</th>`;
    th1 += `<th colspan="3" class="at-th ${mc} at-persen-head">%</th>`;
  });
  th1 += `<th colspan="8" class="at-th at-eval-head">Evaluasi</th>`;
  th1 += `<th rowspan="2" class="at-th at-status-head">Status</th>`;

  let th2 = "";
  semuaTanggalGroups.forEach((grp, gi) => {
    const sc = `at-sub-${(gi % 5) + 1}`;
    th2 += `<th class="at-sub ${sc}">Return</th><th class="at-sub ${sc}">Expired</th><th class="at-sub ${sc}">Pay</th><th class="at-sub ${sc}">Ket</th>`;
    th2 += `<th class="at-sub ${sc} at-persen">R%</th><th class="at-sub ${sc} at-persen">E%</th><th class="at-sub ${sc} at-persen">P%</th>`;
  });
  th2 += `<th class="at-sub at-eval">Return</th><th class="at-sub at-eval">Expired</th><th class="at-sub at-eval">Pay</th>`;
  th2 += `<th class="at-sub at-eval">R%</th><th class="at-sub at-eval">E%</th><th class="at-sub at-eval">P%</th>`;
  th2 += `<th class="at-sub at-eval">Tutup</th><th class="at-sub at-eval">Pending</th>`;

  // tbody rows
  const statusOrder = ["green","yellow","red","grey"];
  let sortedResult = [...result].sort((a,b) => statusOrder.indexOf(a.status) - statusOrder.indexOf(b.status));

  // terapkan filter
  if (analisaFilter.size > 0) {
    sortedResult = sortedResult.filter(c => {
      if (analisaFilter.has("return")  && c.history.some(h => h.hasData && (h.r || 0) > 0)) return true;
      if (analisaFilter.has("expired") && c.history.some(h => h.hasData && (h.e || 0) > 0)) return true;
      if (analisaFilter.has("tutup")   && c.history.some(h => h.hasData && h.status?.toLowerCase() === "tutup")) return true;
      if (analisaFilter.has("pending") && c.history.some(h => h.hasData && h.status?.toLowerCase() === "pending")) return true;
      return false;
    });
  }

  const rows = sortedResult.map(c => {
    const evalR  = c.history.reduce((a,h) => a + (h.hasData ? (h.r  || 0) : 0), 0);
    const evalE  = c.history.reduce((a,h) => a + (h.hasData ? (h.e  || 0) : 0), 0);
    const evalP  = c.history.reduce((a,h) => a + (h.hasData ? (h.p  || 0) : 0), 0);
    const evalCl = c.history.reduce((a,h) => a + (h.hasData ? (h.cl || 0) : 0), 0);
    const evalRp = evalP  > 0 ? Math.floor((evalR/evalP)*100)  + "%" : "0%";
    const evalEp = evalP  > 0 ? Math.floor((evalE/evalP)*100)  + "%" : "0%";
    const evalPp = evalCl > 0 ? Math.floor((evalP/evalCl)*100) + "%" : "0%";
    const evalTP = c.history.filter(h => h.hasData && h.status?.toLowerCase() === "tutup").length;
    const evalPN = c.history.filter(h => h.hasData && h.status?.toLowerCase() === "pending").length;

    const statusCls = { green:"at-row-green", yellow:"at-row-yellow", red:"at-row-red", grey:"" }[c.status] || "";

    const bgCls = { green:"at-bg-green", yellow:"at-bg-yellow", red:"at-bg-red", grey:"" }[c.status] || "";
    const rowCls = bgCls;
    const rowNo = sortedResult.indexOf(c) + 1;
    let cells = `<td class="at-td at-no-cell">${rowNo}</td><td class="at-td at-nama-cell ${bgCls}">${esc(c.nama)}</td>`;

    // per group minggu
    semuaTanggalGroups.forEach((grp, gi) => {
      const isActive = grp.some(d => allTanggal.indexOf(d) + 1 === mingguKe);
      const ac       = isActive ? "at-active" : "";
      const mc       = `at-mg-${(gi % 5) + 1}`;

      // ambil history untuk semua tanggal di group ini
      const hDocs = grp.map(d => {
        const tStr = formatTanggal(d);
        return dataHarianPerTanggal[tStr]?.[c.customerId] || null;
      });

      const totalR  = hDocs.reduce((a, h) => a + (h ? Object.values(h.return  || {}).reduce((x,v) => x+(Number(v)||0), 0) : 0), 0);
      const totalE  = hDocs.reduce((a, h) => a + (h ? Object.values(h.expired || {}).reduce((x,v) => x+(Number(v)||0), 0) : 0), 0);
      const totalP  = hDocs.reduce((a, h) => a + (h ? Object.values(h.pay     || {}).reduce((x,v) => x+(Number(v)||0), 0) : 0), 0);
      const totalCl = hDocs.reduce((a, h) => a + (h ? Object.values(h.closing || {}).reduce((x,v) => x+(Number(v)||0), 0) : 0), 0);
      const hasData = hDocs.some(h => h !== null);

      // status: ambil dari tanggal terakhir di group
      const lastH  = hDocs[hDocs.length - 1];
      const status = lastH?.keterangan?.status || null;
      const stc    = status ? `at-ket-${status.toLowerCase()}` : "";

      const rp = totalP  > 0 ? Math.floor((totalR/totalP)*100)  + "%" : "—";
      const ep = totalP  > 0 ? Math.floor((totalE/totalP)*100)  + "%" : "—";
      const pp = totalCl > 0 ? Math.floor((totalP/totalCl)*100) + "%" : "—";

      if (!hasData) {
        cells += `<td class="at-td ${ac} ${mc}" colspan="4">—</td>`;
      } else {
        cells += `<td class="at-td ${ac} ${mc}">${totalR || "—"}</td>`;
        cells += `<td class="at-td ${ac} ${mc}">${totalE || "—"}</td>`;
        cells += `<td class="at-td ${ac} ${mc}">${totalP || "—"}</td>`;
        cells += `<td class="at-td ${ac} ${mc} ${stc}">${status || "—"}</td>`;
      }
      cells += `<td class="at-td at-persen-val ${ac}">${rp}</td>`;
      cells += `<td class="at-td at-persen-val ${ac}">${ep}</td>`;
      cells += `<td class="at-td at-persen-val ${ac}">${pp}</td>`;
    });

    // evaluasi
    cells += `<td class="at-td at-eval-val">${evalR || ""}</td>`;
    cells += `<td class="at-td at-eval-val">${evalE || ""}</td>`;
    cells += `<td class="at-td at-eval-val">${evalP || ""}</td>`;
    cells += `<td class="at-td at-eval-val">${evalRp}</td>`;
    cells += `<td class="at-td at-eval-val">${evalEp}</td>`;
    cells += `<td class="at-td at-eval-val">${evalPp}</td>`;
    cells += `<td class="at-td at-eval-val">${evalTP || ""}</td>`;
    cells += `<td class="at-td at-eval-val">${evalPN || ""}</td>`;

    // tanggal komentar terakhir
    let evalTgl = "";
    if (c.evaluasi?.updatedAt) {
      const d_  = new Date(c.evaluasi.updatedAt);
      const hn  = ["Min","Sen","Sel","Rab","Kam","Jum","Sab"];
      const bn_ = ["Jan","Feb","Mar","Apr","Mei","Jun","Jul","Agt","Sep","Okt","Nov","Des"];
      const mg  = hitungMingguKe(c.evaluasi.updatedAt, selectedHari, selectedBulan, selectedTahun);
      const mgLabel = (mg !== null && !String(mg).includes("/")) ? `Mg${mg} · ` : "";
      evalTgl = `${mgLabel}${hn[d_.getDay()]}, ${d_.getDate()} ${bn_[d_.getMonth()]} ${d_.getFullYear()}`;
    }

    const statusLabel = { green:"🟢", yellow:"🟡", red:"🔴", grey:"⚪" }[c.status] || "⚪";
    cells += `<td class="at-td at-status-cell">
      <div class="at-status-wrap">
        <span>${statusLabel}</span>
        <button class="catatan-head-btn at-catatan-btn" data-customer-id="${c.customerId}" data-pesan="${esc(c.evaluasi?.pesan || "")}">
          <svg viewBox="0 0 24 24" fill="currentColor" style="width:11px;height:11px"><path d="M3.478 2.404a.75.75 0 0 0-.926.941l2.432 7.905H13.5a.75.75 0 0 1 0 1.5H4.984l-2.432 7.905a.75.75 0 0 0 .926.94 60.519 60.519 0 0 0 18.445-8.986.75.75 0 0 0 0-1.218A60.517 60.517 0 0 0 3.478 2.404Z"/></svg>
        </button>
      </div>
      ${evalTgl
        ? `<div class="at-eval-tgl" title="${esc(c.evaluasi?.pesan || "")}"> ${evalTgl}</div>`
        : `<div class="at-eval-tgl at-eval-tgl-empty">Tidak ada</div>`
      }
    </td>`;

    return `<tr class="${rowCls}-row">${cells}</tr>`;
  }).join("");

  groupEl.innerHTML = `
    <div class="at-wrap">
      <table class="at-table">
        <thead>
          <tr>${th1}</tr>
          <tr>${th2}</tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    </div>`;

  // drag scroll
  const atWrap = groupEl.querySelector(".at-wrap");
  if (atWrap) {
    let dn = false, sx = 0, sl = 0;
    atWrap.addEventListener("mousedown", e => { if(e.button!==0||e.target.closest("button"))return; dn=true; sx=e.pageX-atWrap.offsetLeft; sl=atWrap.scrollLeft; atWrap.style.cursor="grabbing"; });
    document.addEventListener("mouseup", () => { dn=false; atWrap.style.cursor=""; });
    document.addEventListener("mousemove", e => { if(!dn)return; atWrap.scrollLeft=sl-(e.pageX-atWrap.offsetLeft-sx); });
    let tx=0, tl=0;
    atWrap.addEventListener("touchstart", e => { tx=e.touches[0].pageX; tl=atWrap.scrollLeft; }, {passive:true});
    atWrap.addEventListener("touchmove", e => { atWrap.scrollLeft=tl-(e.touches[0].pageX-tx); }, {passive:true});
  }
}
/* ── NOTIFIKASI EVALUASI ───────────────────── */
async function kirimNotifEvaluasi(judul, pesan) {
  try {

    // hanya kurir yang sedang dipilih
    const dibaca = {};
    if (selectedKurirId) dibaca[selectedKurirId] = false;

    const kurirNama = kurirList.find(u => u.uid === selectedKurirId)?.nama || "";
    await addDoc(collection(db, "notifikasi"), {
      createdBy: currentUser.uid,
      createdAt: serverTimestamp(),
      type:      "kurir",
      kategori:  "evaluasi",
      judul,
      pesan,
      foto:      "",
      dibaca,
      kurirId:   selectedKurirId || "",
      kurirNama,
      mingguKe,
      tanggal:   selectedTanggal ? formatTanggal(selectedTanggal) : "",
    });

    return true;
  } catch (e) {
    console.error("Gagal kirim notif:", e);
    return false;
  }
}
let _notifSelectMode  = false;
let _notifSelectedIds = new Set();
let _notifDocs        = [];

async function loadNotifAnalisaHistory() {
  const listEl = document.getElementById("notifAnalisaHistoryList");
  if (!listEl) return;
  _notifSelectMode  = false;
  _notifSelectedIds = new Set();
  listEl.innerHTML  = `<div class="notif-history-empty">Memuat...</div>`;

  try {
    const q    = query(
      collection(db, "notifikasi"),
      where("createdBy", "==", currentUser.uid),
      where("kategori",  "==", "evaluasi"),
      orderBy("createdAt", "desc")
    );
    const snap = await getDocs(q);

    if (snap.empty) {
      listEl.innerHTML = `<div class="notif-history-empty">Belum ada history evaluasi.</div>`;
      return;
    }

    _notifDocs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    renderNotifHistoryList(listEl);

  } catch (e) {
    console.error("Gagal load history notif:", e);
    listEl.innerHTML = `<div class="notif-history-empty">Gagal memuat history.</div>`;
  }
}
function renderNotifHistoryList(listEl) {
  const bn = ["Jan","Feb","Mar","Apr","Mei","Jun","Jul","Agt","Sep","Okt","Nov","Des"];

  // toolbar hapus
  const toolbarHtml = _notifSelectMode ? `
    <div class="notif-select-toolbar">
      <span class="notif-select-count">${_notifSelectedIds.size} dipilih</span>
      <div style="display:flex;gap:8px">
        <button class="btn" id="btnNotifCancelSelect">Batal</button>
        <button class="btn btn-danger" id="btnNotifHapus" ${_notifSelectedIds.size === 0 ? "disabled" : ""}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/>
            <path d="M10 11v6M14 11v6"/><path d="M9 6V4h6v2"/>
          </svg>
          Hapus
        </button>
      </div>
    </div>` : "";

  listEl.innerHTML = toolbarHtml + _notifDocs.map(data => {
    const ts          = data.createdAt?.seconds
      ? new Date(data.createdAt.seconds * 1000) : new Date();
    const tglStr      = `${ts.getDate()} ${bn[ts.getMonth()]} ${ts.getFullYear()}`;
    const jamStr      = ts.toLocaleTimeString("id-ID", { hour:"2-digit", minute:"2-digit" });
    const dibacaCount = Object.values(data.dibaca || {}).filter(v => v === true).length;
    const totalCount  = Object.keys(data.dibaca || {}).length;
    const isSelected  = _notifSelectedIds.has(data.id);

    return `
      <div class="notif-history-item ${_notifSelectMode ? "select-mode" : ""} ${isSelected ? "selected" : ""}"
        data-id="${data.id}">
        ${_notifSelectMode ? `
          <div class="notif-checkbox ${isSelected ? "checked" : ""}">
            ${isSelected ? `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>` : ""}
          </div>` : ""}
        <div class="notif-history-content">
          <div class="notif-history-top">
            <span class="notif-history-kurir">${esc(data.kurirNama || "—")}</span>
            <span class="notif-history-tgl">${tglStr} · ${jamStr}</span>
          </div>
          <div class="notif-history-mg">Mg ${data.mingguKe || "—"} · ${data.tanggal || "—"}</div>
          <div class="notif-history-pesan">${esc(data.pesan || "")}</div>
          <div class="notif-history-read">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" style="width:11px;height:11px">
              <polyline points="20 6 9 17 4 12"/>
            </svg>
            Dibaca ${dibacaCount}/${totalCount}
          </div>
        </div>
      </div>`;
  }).join("");

  // setup long press dan klik
  setupNotifLongPress(listEl);

  // event toolbar
  document.getElementById("btnNotifCancelSelect")?.addEventListener("click", () => {
    _notifSelectMode  = false;
    _notifSelectedIds = new Set();
    renderNotifHistoryList(listEl);
  });

  document.getElementById("btnNotifHapus")?.addEventListener("click", async () => {
    if (!_notifSelectedIds.size) return;
    const btn = document.getElementById("btnNotifHapus");
    btn.disabled    = true;
    btn.textContent = "Menghapus...";
    try {
      for (const id of _notifSelectedIds) {
        await deleteDoc(doc(db, "notifikasi", id));
      }
      _notifDocs        = _notifDocs.filter(d => !_notifSelectedIds.has(d.id));
      _notifSelectedIds = new Set();
      _notifSelectMode  = false;
      showToast(`Berhasil dihapus`, "success");
      renderNotifHistoryList(listEl);
    } catch (e) {
      console.error(e);
      showToast("Gagal menghapus", "error");
      btn.disabled    = false;
      btn.textContent = "Hapus";
    }
  });
}
function setupNotifLongPress(listEl) {
  let _lpTimer = null;
  let _lpMoved = false;

  listEl.addEventListener("pointerdown", e => {
    const item = e.target.closest(".notif-history-item");
    if (!item) return;
    _lpMoved = false;
    _lpTimer = setTimeout(() => {
      if (_lpMoved) return;
      if (!_notifSelectMode) {
        _notifSelectMode = true;
        _notifSelectedIds.add(item.dataset.id);
        renderNotifHistoryList(listEl);
        navigator.vibrate?.(40);
      }
    }, 500);
  });

  listEl.addEventListener("pointermove", () => { _lpMoved = true; clearTimeout(_lpTimer); });
  listEl.addEventListener("pointerup",   () => clearTimeout(_lpTimer));
  listEl.addEventListener("pointercancel", () => clearTimeout(_lpTimer));

  // klik biasa: jika select mode toggle pilih
  listEl.addEventListener("click", e => {
    if (!_notifSelectMode) return;
    const item = e.target.closest(".notif-history-item");
    if (!item) return;
    const id = item.dataset.id;
    if (_notifSelectedIds.has(id)) _notifSelectedIds.delete(id);
    else _notifSelectedIds.add(id);
    renderNotifHistoryList(listEl);
  });
}
function buildPesanNotif() {
  const now     = new Date();
  const hn      = ["Minggu","Senin","Selasa","Rabu","Kamis","Jumat","Sabtu"];
  const bn      = ["Jan","Feb","Mar","Apr","Mei","Jun","Jul","Agt","Sep","Okt","Nov","Des"];
  const mgLabel = mingguKe ? `Mg ${mingguKe}` : "";
  const tglLabel = selectedTanggal
    ? `${hn[selectedTanggal.getDay()]}, ${selectedTanggal.getDate()} ${bn[selectedTanggal.getMonth()]} ${selectedTanggal.getFullYear()}`
    : `${hn[now.getDay()]}, ${now.getDate()} ${bn[now.getMonth()]} ${now.getFullYear()}`;
  return `Evaluasi telah diperbarui ${mgLabel} / ${tglLabel}\nBuka aplikasi untuk melihat catatan evaluasi terbaru dari admin.`;
}
/* ── HELPERS ───────────────────────────────── */
function esc(str) {
  return String(str).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");
}
function val(id)       { return document.getElementById(id)?.value ?? ""; }
function setVal(id, v) { const el = document.getElementById(id); if (el) el.value = v; }
function setText(id,v) { const el = document.getElementById(id); if (el) el.textContent = v; }
function show(id)      { const el = document.getElementById(id); if (el) el.style.display = ""; }
function hide(id)      { const el = document.getElementById(id); if (el) el.style.display = "none"; }
