import { auth, db } from "./index.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import {
  getDoc, doc,
  collection, collectionGroup,
  query, where, getDocs
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
let selectedBulan   = new Date().getMonth();
let selectedTahun   = new Date().getFullYear();
let mingguKe        = 1;
let totalMinggu     = 1;
let selectedTanggal = null;

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
  if (!user) { logout(); return; }
  try {
    const snap = await getDoc(doc(db, "users", user.uid));
    if (!snap.exists()) { logout(); return; }
    const data = snap.data();
    if (data.role !== "adminCabang") { logout(); return; }

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
              c.pemilik === kurirId && c.status === true
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
    // gabungkan semua doc dataHarian per customer
    const customerId = d.customerId || docSnap.id;
    result[customerId] = { ...d, _docId: docSnap.id };
  });

  await saveDataHarian(pemilik, tanggal, result);
  console.log(`📦 dataHarian disimpan: ${pemilik}_${tanggal}, ${snap.size} dokumen`);
  return result;
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
      <th rowspan="2">#</th>
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

  // ambil data DSM tersimpan untuk kurir + tanggal ini
  const dsmData = await getDsmData(selectedKurirId, tanggalStr);

  // ambil dataHarian dari IndexedDB kalau ada
  const dataHarianCache = await getDataHarian(selectedKurirId, tanggalStr);
  const dataHarianMap   = dataHarianCache?.data || {};

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
            // dataKemarin[varian].qty
            val = harianDoc?.dataKemarin?.[v]?.qty ?? 0;

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
}

function renderTable() {
  const tbody   = document.getElementById("dsmTableBody");
  const total   = filteredData.length;
  const colSpan = 2 + GROUPS.length * (varianList.length || 1) + 1;

  if (!total) {
    renderEmpty(colSpan);
    return;
  }

  tbody.innerHTML = filteredData.map((d, i) => {
    // cari nama customer dari customerList berdasar customerId atau nama
    const customer = customerList.find(c =>
      c.id === d.customerId || c.namaCustomer === d.nama
    );
    const namaCustomer = customer?.namaCustomer || d.nama || "-";

    const cells = GROUPS.map(g =>
      (varianList.length ? varianList : ["-"]).map(v => {
        const val_ = d[g.key]?.[v] ?? 0;
        return `<td>
          <input
            class="cell-input"
            type="number"
            min="0"
            value="${val_ === 0 ? "" : val_}"
            data-kurir-id="${d.kurirId}"
            data-customer-id="${d.customerId}"
            data-tanggal="${d.tanggal}"
            data-group="${g.key}"
            data-varian="${v}"
          >
        </td>`;
      }).join("")
    ).join("");

    return `
      <tr>
        <td>${i + 1}</td>
        <td class="td-nama">
          <div class="nama-customer">${esc(namaCustomer)}</div>
          ${customer?.alamat
            ? `<div class="nama-customer-sub">${esc(customer.alamat)}</div>`
            : ""}
        </td>
        ${cells}
        <td>
          <div class="aksi-wrap">
            <button class="aksi-btn edit" title="Edit" data-id="${d.id}">
              <svg viewBox="0 0 24 24"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
            </button>
            <button class="aksi-btn hapus" title="Hapus" data-id="${d.id}">
              <svg viewBox="0 0 24 24"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4h6v2"/></svg>
            </button>
          </div>
        </td>
      </tr>`;
  }).join("");
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

function openPopup(id)  { document.getElementById(id)?.classList.add("show"); }
function closePopup(id) { document.getElementById(id)?.classList.remove("show"); }

/* ── EVENTS ────────────────────────────────── */
let _cellTimer = null;

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
    if (!selectedKurirId) {
      showToast("Pilih kurir dulu", "error");
      return;
    }
    if (!selectedTanggal) {
      showToast("Pilih tanggal dulu", "error");
      return;
    }
    const btn = document.getElementById("btnReload");
    btn.disabled = true;
    showTableLoading();
    try {
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

  // Delegasi: aksi edit/hapus + input cell
  document.getElementById("dsmTableBody")?.addEventListener("click", e => {
    const editBtn  = e.target.closest(".aksi-btn.edit");
    const hapusBtn = e.target.closest(".aksi-btn.hapus");
    if (editBtn)  openPopupEdit(editBtn.dataset.id);
    if (hapusBtn) openPopupHapus(hapusBtn.dataset.id);
  });

  // Input cell — simpan ke IndexedDB dengan debounce 800ms
  document.getElementById("dsmTableBody")?.addEventListener("input", e => {
    const inp = e.target.closest(".cell-input");
    if (!inp) return;
    clearTimeout(_cellTimer);
    _cellTimer = setTimeout(() => {
      simpanCell(
        inp.dataset.kurirId,
        inp.dataset.customerId,
        inp.dataset.tanggal,
        inp.dataset.group,
        inp.dataset.varian,
        inp.value
      );
    }, 800);
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
    box.style.transform = `translateY(${dy}px)`;
  }, { passive: true });

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

/* ── HELPERS ───────────────────────────────── */
function esc(str) {
  return String(str).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");
}
function val(id)       { return document.getElementById(id)?.value ?? ""; }
function setVal(id, v) { const el = document.getElementById(id); if (el) el.value = v; }
function setText(id,v) { const el = document.getElementById(id); if (el) el.textContent = v; }
function show(id)      { const el = document.getElementById(id); if (el) el.style.display = ""; }
function hide(id)      { const el = document.getElementById(id); if (el) el.style.display = "none"; }
