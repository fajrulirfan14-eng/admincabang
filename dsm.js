import { auth, db } from "./index.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import {
  collection, query, where,
  getDocs, getDoc, addDoc, setDoc, deleteDoc,
  doc, serverTimestamp, orderBy
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

/* ── STATE ─────────────────────────────────── */
let currentUser  = null;
let idCabang     = "";
let allData      = [];
let filteredData = [];
let editDocId    = null;
let deleteDocId  = null;
let varianList   = []; // ["CB","BB","BK","MC"]
const PER_PAGE   = 20;
let currentPage  = 1;

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
    await loadData();
    initEvents();

  } catch (err) {
    console.error("Auth error:", err);
    logout();
  }
});

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

/* ── FIRESTORE ─────────────────────────────── */
async function loadData() {
  showTableLoading();
  try {
    const q = query(
      collection(db, "dsm"),
      where("idCabang", "==", idCabang),
      orderBy("createdAt", "desc")
    );
    const snap = await getDocs(q);
    allData = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    applyFilter();
  } catch (err) {
    console.error("Gagal load DSM:", err);
    showToast("Gagal memuat data", "error");
    renderEmpty();
  }
}

async function simpanData() {
  const btn    = document.getElementById("btnSimpan");
  const nama   = val("fieldNama").trim();
  const catatan = val("fieldCatatan").trim();

  if (!nama) { showToast("Nama customer wajib diisi", "error"); return; }

  btn.disabled    = true;
  btn.textContent = "Menyimpan...";

  try {
    const payload = { nama, catatan, idCabang, updatedAt: serverTimestamp() };

    if (editDocId) {
      await setDoc(doc(db, "dsm", editDocId), payload, { merge: true });
      showToast("Data diperbarui", "success");
    } else {
      payload.createdAt = serverTimestamp();
      // init semua group varian dengan 0
      GROUPS.forEach(g => {
        payload[g.key] = {};
        varianList.forEach(v => { payload[g.key][v] = 0; });
      });
      await addDoc(collection(db, "dsm"), payload);
      showToast("Data ditambahkan", "success");
    }

    closePopup("popupOverlay");
    await loadData();
  } catch (err) {
    console.error(err);
    showToast("Gagal menyimpan", "error");
  } finally {
    btn.disabled    = false;
    btn.textContent = "Simpan";
  }
}

async function hapusData() {
  if (!deleteDocId) return;
  const btn = document.getElementById("btnHapusKonfirm");
  btn.disabled    = true;
  btn.textContent = "Menghapus...";
  try {
    await deleteDoc(doc(db, "dsm", deleteDocId));
    showToast("Data dihapus", "success");
    closePopup("confirmOverlay");
    await loadData();
  } catch (err) {
    console.error(err);
    showToast("Gagal menghapus", "error");
  } finally {
    btn.disabled    = false;
    btn.textContent = "Hapus";
  }
}

/* simpan nilai input cell langsung ke firestore */
async function simpanCell(docId, groupKey, varianKey, value) {
  try {
    await setDoc(
      doc(db, "dsm", docId),
      { [groupKey]: { [varianKey]: Number(value) || 0 }, updatedAt: serverTimestamp() },
      { merge: true }
    );
    // update cache lokal
    const idx = allData.findIndex(d => d.id === docId);
    if (idx >= 0) {
      if (!allData[idx][groupKey]) allData[idx][groupKey] = {};
      allData[idx][groupKey][varianKey] = Number(value) || 0;
    }
  } catch (err) {
    console.error("Gagal simpan cell:", err);
    showToast("Gagal menyimpan", "error");
  }
}

/* ── FILTER & RENDER ───────────────────────── */
function applyFilter() {
  const q = val("searchInput").toLowerCase();
  filteredData = q
    ? allData.filter(d => (d.nama || "").toLowerCase().includes(q))
    : [...allData];
  currentPage = 1;
  renderTable();
}

function renderTable() {
  const tbody = document.getElementById("dsmTableBody");
  const total = filteredData.length;
  const colSpan = 2 + GROUPS.length * (varianList.length || 1) + 1;

  if (!total) { renderEmpty(colSpan); updatePagination(0, 0); return; }

  const start = (currentPage - 1) * PER_PAGE;
  const end   = Math.min(start + PER_PAGE, total);
  const slice = filteredData.slice(start, end);

  tbody.innerHTML = slice.map((d, i) => {
    // render semua cell input per group per varian
    const cells = GROUPS.map(g =>
      (varianList.length ? varianList : ["-"]).map(v => {
        const val_ = d[g.key]?.[v] ?? 0;
        return `<td>
          <input
            class="cell-input"
            type="number"
            min="0"
            value="${val_}"
            data-id="${d.id}"
            data-group="${g.key}"
            data-varian="${v}"
          >
        </td>`;
      }).join("")
    ).join("");

    return `
      <tr>
        <td>${start + i + 1}</td>
        <td class="td-nama">${esc(d.nama || "-")}</td>
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

  updatePagination(start, end, total);
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
  document.getElementById("dsmTableBody").innerHTML = `
    <tr class="loading-row">
      <td colspan="20">
        <div class="loading-spinner"></div><br>Memuat data...
      </td>
    </tr>`;
}

function updatePagination(start, end, total = 0) {
  setText("pageInfo", total ? `${start + 1}–${end} dari ${total} data` : "0 data");
  document.getElementById("btnPrev").disabled = currentPage <= 1;
  document.getElementById("btnNext").disabled = end >= total;
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
  const d = allData.find(x => x.id === id);
  if (!d) return;
  editDocId = id;
  setText("popupTitle", "Edit Customer");
  setVal("fieldNama",    d.nama    || "");
  setVal("fieldCatatan", d.catatan || "");
  openPopup("popupOverlay");
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
  document.getElementById("btnTambah")?.addEventListener("click", openPopupTambah);
  document.getElementById("btnReload")?.addEventListener("click", async () => {
    await loadVarian();
    renderThead();
    await loadData();
  });
  document.getElementById("btnExport")?.addEventListener("click", exportExcel);
  document.getElementById("searchInput")?.addEventListener("input", applyFilter);

  document.getElementById("btnPrev")?.addEventListener("click", () => { currentPage--; renderTable(); });
  document.getElementById("btnNext")?.addEventListener("click", () => { currentPage++; renderTable(); });

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

  // Input cell — simpan ke firestore dengan debounce 800ms
  document.getElementById("dsmTableBody")?.addEventListener("input", e => {
    const inp = e.target.closest(".cell-input");
    if (!inp) return;
    clearTimeout(_cellTimer);
    _cellTimer = setTimeout(() => {
      simpanCell(inp.dataset.id, inp.dataset.group, inp.dataset.varian, inp.value);
    }, 800);
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
