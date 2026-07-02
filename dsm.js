/* ── DSM VIEW ── */
let dsmSelectedKurir = null;
let dsmSelectedHari  = "Senin";
let dsmSelectedBulan = new Date().getMonth();
let dsmSelectedTahun = new Date().getFullYear();
let dsmMingguKe      = 1;
let dsmTotalMinggu   = 1;
let dsmCustomers     = [];
let dsmSearchQuery   = "";
const dsmDataCache   = {}; // cache memory: key = uid_tanggal

window.initDsmView = async function() {
  if (!window.idb) return;
  if (!window.usersCache?.length) {
    window.usersCache = await window.idb.getUsers();
  }

  initDsmFilters();
  initDsmSearch();
  initDsmReload();
  initDsmAnalisaPopup();
  renderDsmKurirDropdown();

  const prevBtn = document.getElementById("dsmPrevBtn");
  const nextBtn = document.getElementById("dsmNextBtn");
  if (prevBtn) {
    prevBtn.onclick = async () => {
      if (dsmMingguKe > 1) { dsmMingguKe--; saveDsmState(); await renderDsmTable(); }
    };
  }
  if (nextBtn) {
    nextBtn.onclick = async () => {
      if (dsmMingguKe < dsmTotalMinggu) { dsmMingguKe++; saveDsmState(); await renderDsmTable(); }
    };
  }

  const saved = localStorage.getItem("dsmState");
  if (saved) {
    try {
      const s = JSON.parse(saved);
      if (s.kurirUid)  dsmSelectedKurir = s.kurirUid;
      if (s.hari)      dsmSelectedHari  = s.hari;
      if (s.bulan != null) dsmSelectedBulan = s.bulan;
      if (s.tahun != null) dsmSelectedTahun = s.tahun;
      if (s.mingguKe)  dsmMingguKe      = s.mingguKe;
    } catch {}
  }

  const bulanNama = ["Januari","Februari","Maret","April","Mei","Juni","Juli","Agustus","September","Oktober","November","Desember"];
  document.getElementById("dsmHariLabel").textContent  = dsmSelectedHari;
  document.getElementById("dsmBulanLabel").textContent = bulanNama[dsmSelectedBulan];
  document.getElementById("dsmTahunLabel").textContent = dsmSelectedTahun;

  document.querySelectorAll("#dsmHariDropdown .peta-filter-option").forEach(o => {
    o.classList.toggle("selected", o.dataset.hari === dsmSelectedHari);
  });
  document.querySelectorAll("#dsmBulanDropdown .peta-filter-option").forEach(o => {
    o.classList.toggle("selected", Number(o.dataset.bulan) === dsmSelectedBulan);
  });

  renderDsmTahunDropdown();

  if (dsmSelectedKurir) {
    const kurir = (window.usersCache||[]).find(u => u.uid === dsmSelectedKurir);
    if (kurir) {
      document.getElementById("dsmKurirLabel").textContent = kurir.nama || "Kurir";
      await loadDsmTable();
    }
  }
};

function saveDsmState() {
  localStorage.setItem("dsmState", JSON.stringify({
    kurirUid: dsmSelectedKurir,
    hari:     dsmSelectedHari,
    bulan:    dsmSelectedBulan,
    tahun:    dsmSelectedTahun,
    mingguKe: dsmMingguKe,
  }));
}

/* ── CACHE-AWARE GET DATA ── */
async function getDsmDataCached(uid, tanggal) {
  const key = `${uid}_${tanggal}`;
  if (dsmDataCache[key]) return dsmDataCache[key];
  const data = await window.idb.getDsmData(uid, tanggal);
  dsmDataCache[key] = data;
  return data;
}

async function fetchDsmDataHarian(uidKurir, tanggal) {
  try {
    const kantorCabang = await window.idb.getKantorCabang();
    const idCabang     = kantorCabang?.id || "";

    const snapDH = await window.getDocs(window.query(
      window.collectionGroup(window.db, "dataHarian"),
      window.where("pemilik",  "==", uidKurir),
      window.where("tanggal",  "==", tanggal),
      window.where("idCabang", "==", idCabang)
    ));
    const customers = {};
    snapDH.forEach(d => {
      const data = d.data();
      const idCustomer = data.idCustomer || "";
      if (idCustomer) customers[idCustomer] = { ...data, _docId: d.id };
    });

    const snapPL = await window.getDocs(window.query(
      window.collectionGroup(window.db, "penjualanLangsung"),
      window.where("pemilik",  "==", uidKurir),
      window.where("tanggal",  "==", tanggal),
      window.where("idCabang", "==", idCabang)
    ));
    let penjualanLangsung = null;
    snapPL.forEach(d => { penjualanLangsung = { ...d.data(), _docId: d.id }; });

    const result = { customers, penjualanLangsung };
    await window.idb.saveDsmData(uidKurir, tanggal, result);
    dsmDataCache[`${uidKurir}_${tanggal}`] = result; // update cache
    return result;
  } catch (err) {
    console.error("❌ fetchDsmDataHarian:", err);
    return null;
  }
}

/* ── FILTER ── */
function initDsmFilters() {
  document.getElementById("dsmKurirBtn")?.addEventListener("click", e => {
    e.stopPropagation();
    const dd = document.getElementById("dsmKurirDropdown");
    const isOpen = dd.style.display !== "none";
    closeAllDsmDropdowns();
    dd.style.display = isOpen ? "none" : "block";
  });

  document.getElementById("dsmHariBtn")?.addEventListener("click", e => {
    e.stopPropagation();
    const dd = document.getElementById("dsmHariDropdown");
    const isOpen = dd.style.display !== "none";
    closeAllDsmDropdowns();
    dd.style.display = isOpen ? "none" : "block";
  });
  document.querySelectorAll("#dsmHariDropdown .peta-filter-option").forEach(opt => {
    opt.addEventListener("click", async e => {
      e.stopPropagation();
      dsmSelectedHari = opt.dataset.hari;
      dsmMingguKe = 1;
      document.getElementById("dsmHariLabel").textContent = dsmSelectedHari;
      document.querySelectorAll("#dsmHariDropdown .peta-filter-option").forEach(o => o.classList.remove("selected"));
      opt.classList.add("selected");
      document.getElementById("dsmHariDropdown").style.display = "none";
      saveDsmState();
      await loadDsmTable();
    });
  });

  document.getElementById("dsmBulanBtn")?.addEventListener("click", e => {
    e.stopPropagation();
    const dd = document.getElementById("dsmBulanDropdown");
    const isOpen = dd.style.display !== "none";
    closeAllDsmDropdowns();
    dd.style.display = isOpen ? "none" : "block";
  });
  document.querySelectorAll("#dsmBulanDropdown .peta-filter-option").forEach(opt => {
    opt.addEventListener("click", async e => {
      e.stopPropagation();
      const bulanNama = ["Januari","Februari","Maret","April","Mei","Juni","Juli","Agustus","September","Oktober","November","Desember"];
      dsmSelectedBulan = Number(opt.dataset.bulan);
      dsmMingguKe = 1;
      document.getElementById("dsmBulanLabel").textContent = bulanNama[dsmSelectedBulan];
      document.querySelectorAll("#dsmBulanDropdown .peta-filter-option").forEach(o => o.classList.remove("selected"));
      opt.classList.add("selected");
      document.getElementById("dsmBulanDropdown").style.display = "none";
      saveDsmState();
      await loadDsmTable();
    });
  });

  document.getElementById("dsmTahunBtn")?.addEventListener("click", e => {
    e.stopPropagation();
    const dd = document.getElementById("dsmTahunDropdown");
    const isOpen = dd.style.display !== "none";
    closeAllDsmDropdowns();
    dd.style.display = isOpen ? "none" : "block";
  });

  document.addEventListener("click", () => closeAllDsmDropdowns());
}

function closeAllDsmDropdowns() {
  ["dsmKurirDropdown","dsmHariDropdown","dsmBulanDropdown","dsmTahunDropdown"].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.style.display = "none";
  });
}

function renderDsmTahunDropdown() {
  const dd   = document.getElementById("dsmTahunDropdown");
  const now  = new Date().getFullYear();
  const years = [now - 1, now, now + 1];
  dd.innerHTML = years.map(y =>
    `<div class="peta-filter-option ${y === dsmSelectedTahun ? "selected" : ""}" data-tahun="${y}">${y}</div>`
  ).join("");
  dd.querySelectorAll(".peta-filter-option").forEach(opt => {
    opt.addEventListener("click", async e => {
      e.stopPropagation();
      dsmSelectedTahun = Number(opt.dataset.tahun);
      dsmMingguKe = 1;
      document.getElementById("dsmTahunLabel").textContent = dsmSelectedTahun;
      dd.querySelectorAll(".peta-filter-option").forEach(o => o.classList.remove("selected"));
      opt.classList.add("selected");
      dd.style.display = "none";
      saveDsmState();
      await loadDsmTable();
    });
  });
}

function renderDsmKurirDropdown() {
  const dd    = document.getElementById("dsmKurirDropdown");
  const kurir = (window.usersCache||[]).filter(u => u.role === "kurir");
  if (!kurir.length) {
    dd.innerHTML = `<div class="peta-filter-option" style="pointer-events:none;color:var(--text-muted)">Tidak ada kurir</div>`;
    return;
  }
  dd.innerHTML = kurir.map(u => `
    <div class="peta-filter-option ${dsmSelectedKurir === u.uid ? "selected" : ""}" data-uid="${u.uid}">
      ${u.nama || "Tanpa Nama"}
    </div>`).join("");
  dd.querySelectorAll(".peta-filter-option").forEach(opt => {
    opt.addEventListener("click", async e => {
      e.stopPropagation();
      dsmSelectedKurir = opt.dataset.uid;
      document.getElementById("dsmKurirLabel").textContent = opt.textContent.trim();
      dd.querySelectorAll(".peta-filter-option").forEach(o => o.classList.remove("selected"));
      opt.classList.add("selected");
      dd.style.display = "none";
      saveDsmState();
      await loadDsmTable();
    });
  });
}

/* ── SEARCH ── */
function initDsmSearch() {
  document.getElementById("dsmSearchInput")?.addEventListener("input", e => {
    dsmSearchQuery = e.target.value.toLowerCase().trim();
    renderDsmTable();
  });
}

/* ── RELOAD ── */
function initDsmReload() {
  document.getElementById("dsmReloadBtn")?.addEventListener("click", async () => {
    if (!dsmSelectedKurir) { window.showToast("Pilih kurir dulu", "error"); return; }
    const btn = document.getElementById("dsmReloadBtn");
    btn?.classList.add("spinning");

    const tanggalList = hitungMingguDalamBulan(dsmSelectedHari, dsmSelectedBulan, dsmSelectedTahun);
    const tanggal     = tanggalList[dsmMingguKe - 1];
    if (tanggal) {
      const tanggalStr = `${tanggal.getFullYear()}-${String(tanggal.getMonth()+1).padStart(2,"0")}-${String(tanggal.getDate()).padStart(2,"0")}`;
      window.showToast("Memuat data...", "");
      await fetchDsmDataHarian(dsmSelectedKurir, tanggalStr);
    }

    await loadDsmTable();
    btn?.classList.remove("spinning");
    window.showToast("Data diperbarui", "success");
  });
}

/* ── HITUNG MINGGU ── */
function hitungMingguDalamBulan(hari, bulan, tahun) {
  const namaHari  = ["Minggu","Senin","Selasa","Rabu","Kamis","Jumat","Sabtu"];
  const targetDay = namaHari.indexOf(hari);
  const totalHari = new Date(tahun, bulan + 1, 0).getDate();
  const tanggalList = [];
  for (let d = 1; d <= totalHari; d++) {
    const date = new Date(tahun, bulan, d);
    if (date.getDay() === targetDay) tanggalList.push(date);
  }
  return tanggalList;
}

/* ── LOAD TABLE ── */
async function loadDsmTable() {
  const wrap = document.getElementById("dsmTableWrap");
  if (!wrap) return;

  if (!dsmSelectedKurir) {
    wrap.innerHTML = `<div class="dh-ringkasan-empty">Pilih kurir terlebih dahulu</div>`;
    return;
  }

  wrap.innerHTML = `<div class="dh-ringkasan-empty">Memuat...</div>`;

  const custHari = await window.idb.getCustKurir(dsmSelectedKurir, dsmSelectedHari);
  dsmCustomers = custHari || [];

  const tanggalList  = hitungMingguDalamBulan(dsmSelectedHari, dsmSelectedBulan, dsmSelectedTahun);
  dsmTotalMinggu     = tanggalList.length;
  if (dsmMingguKe > dsmTotalMinggu) dsmMingguKe = 1;

  const tanggalAktif = tanggalList[dsmMingguKe - 1];
  const tglLabel = tanggalAktif
    ? tanggalAktif.toLocaleDateString("id-ID", { weekday:"long", day:"numeric", month:"long", year:"numeric" })
    : "-";
  document.getElementById("dsmPageInfo").textContent  = `Minggu ${dsmMingguKe} · ${tglLabel}`;
  document.getElementById("dsmPrevBtn").disabled = dsmMingguKe <= 1;
  document.getElementById("dsmNextBtn").disabled = dsmMingguKe >= dsmTotalMinggu;
  renderDsmTable();
}

/* ── COLOR CLASS MAP ── */
const DSM_GROUP_CLASS = {
  dataKemarin: "dsm-col-kemarin",
  return:      "dsm-col-return",
  expired:     "dsm-col-expired",
  konsinyasi:  "dsm-col-konsinyasi",
  cash:        "dsm-col-cash",
  lainnya:     "dsm-col-lainnya",
  pay:         "dsm-col-pay",
};
const DSM_REKAP_CLASS = ["dsm-rk-order","dsm-rk-fee","dsm-rk-disable","dsm-rk-output","dsm-rk-saldo","dsm-rk-pay"];

/* ── RENDER TABLE ── */
async function renderDsmTable() {
  const wrap = document.getElementById("dsmTableWrap");
  if (!wrap) return;

  const tanggalList = hitungMingguDalamBulan(dsmSelectedHari, dsmSelectedBulan, dsmSelectedTahun);
  const tanggal     = tanggalList[dsmMingguKe - 1];

  const tglLabel = tanggal
    ? tanggal.toLocaleDateString("id-ID", { weekday:"long", day:"numeric", month:"long", year:"numeric" })
    : "-";
  document.getElementById("dsmPageInfo").textContent = `Minggu ${dsmMingguKe} · ${tglLabel}`;
  document.getElementById("dsmPrevBtn").disabled = dsmMingguKe <= 1;
  document.getElementById("dsmNextBtn").disabled = dsmMingguKe >= dsmTotalMinggu;

  if (!tanggal) {
    wrap.innerHTML = `<div class="dh-ringkasan-empty">Tidak ada tanggal untuk minggu ini</div>`;
    return;
  }

  const customers = dsmSearchQuery
    ? dsmCustomers.filter(c => (c.namaCustomer||"").toLowerCase().includes(dsmSearchQuery))
    : dsmCustomers;

  if (!customers.length) {
    wrap.innerHTML = `<div class="dh-ringkasan-empty">Belum ada customer — Klik Reload untuk memuat</div>`;
    return;
  }

  const kurir      = (window.usersCache||[]).find(u => u.uid === dsmSelectedKurir);
  const varianList = (kurir?.varian || [])
    .filter(v => { const k = Object.keys(v)[0]; return k && v[k]?.isAktif; })
    .map(v => Object.keys(v)[0]);
  const V = varianList.length || 1;

  const rekapGroups2 = ["Order","Fee","Disable","Output","Saldo","Pay"];

  const GROUPS = [
    { key: "dataKemarin", label: "Data Kemarin", isQty: true },
    { key: "return",      label: "Return",        isQty: false },
    { key: "expired",     label: "Expired",       isQty: false },
    { key: "konsinyasi",  label: "Konsinyasi",   isQty: false },
    { key: "cash",        label: "Cash",          isQty: false },
    { key: "lainnya",     label: "Lainnya",       isQty: false },
    { key: "pay",         label: "Bayar",         isQty: false },
  ];

  const isMobile = window.innerWidth <= 768;
  const COL_NO   = 36;
  const COL_NAMA = 140;
  const COL_VAR  = 44;
  const COL_AKSI = 100;
  const stickyNo   = isMobile ? "" : `position:sticky;left:0;`;
  const stickyNama = isMobile ? "" : `position:sticky;left:${COL_NO}px;`;

  // ── HEADER TABEL UTAMA ──
  let thead = `<tr>
    <th rowspan="2" class="dsm-th-base" style="width:${COL_NO}px;${stickyNo}">No</th>
    <th rowspan="2" class="dsm-th-base" style="width:${COL_NAMA}px;text-align:left;${stickyNama}z-index:4">Nama</th>`;
  GROUPS.forEach(g => {
    thead += `<th colspan="${V}" class="dsm-th-group ${DSM_GROUP_CLASS[g.key]}">${g.label}</th>`;
  });
  thead += `<th rowspan="2" class="dsm-th-base" style="width:${COL_AKSI}px">Pembayaran</th></tr><tr>`;
  GROUPS.forEach(g => {
    varianList.forEach(v => {
      thead += `<th class="dsm-th-sub ${DSM_GROUP_CLASS[g.key]}" style="width:${COL_VAR}px">${v}</th>`;
    });
    if (!varianList.length) thead += `<th class="dsm-th-sub ${DSM_GROUP_CLASS[g.key]}" style="width:${COL_VAR}px">-</th>`;
  });
  thead += `</tr>`;

  // ── DATA HARIAN (pakai cache) ──
  const tanggalStr = `${tanggal.getFullYear()}-${String(tanggal.getMonth()+1).padStart(2,"0")}-${String(tanggal.getDate()).padStart(2,"0")}`;
  const dhRaw  = await getDsmDataCached(dsmSelectedKurir, tanggalStr);
  const dhMap  = dhRaw?.customers || {};
  const plData = dhRaw?.penjualanLangsung || null;

  const allRows = [...customers, { id: "__penjualan__", namaCustomer: "Penjualan Langsung", _isPenjualan: true, _plData: plData }];

  // ── BODY ──
  const tbodyParts = [];
  allRows.forEach((c, i) => {
    const dh = dhMap[c.id] || {};

    const varianBeda = new Set();
    if (!c._isPenjualan) {
      varianList.forEach(v => {
        const dk = Number(dh.dataKemarin?.[v]?.qty ?? c.dataKemarin?.[v]?.qty ?? 0);
        const kn = Number(dh.konsinyasi?.[v] ?? 0);
        if (dk !== kn) varianBeda.add(v);
      });
    }

    let allEmpty = true;
    if (!c._isPenjualan) {
      ["return","expired","konsinyasi","cash","lainnya"].forEach(gk => {
        const src = dh[gk] || {};
        varianList.forEach(v => { if (Number(src[v] ?? 0) !== 0) allEmpty = false; });
      });
    } else {
      allEmpty = false;
    }
    const namaCls = allEmpty ? "dsm-nama-empty" : "";

    const statusKet  = dh.keterangan?.status?.toLowerCase() || "";
    const badgeMap   = { tutup: "Tutup", pending: "Pending", putus: "Putus" };
    const badgeLabel = badgeMap[statusKet] || "";
    const badgeHtml  = badgeLabel ? `
      <span class="dsm-status-badge dsm-badge-${statusKet}"
        data-foto-customer="${esc(c.foto||"")}"
        data-foto-keterangan="${esc(dh.keterangan?.foto||"")}"
        data-nama="${esc(c.namaCustomer||"-")}">${badgeLabel}</span>` : "";

    let row = `<tr>
      <td class="dsm-td-base" style="width:${COL_NO}px;${stickyNo}">${i+1}</td>
      <td class="dsm-td-base dsm-td-nama ${namaCls}" style="text-align:left;${stickyNama}">${esc(c.namaCustomer||"-")}${badgeHtml}</td>`;

    GROUPS.forEach(g => {
      let src;
      if (c._isPenjualan) {
        const pl = c._plData || {};
        src = (g.key === "cash" || g.key === "closing") ? (pl.closing||{}) : g.key === "pay" ? (pl.pay||{}) : {};
      } else {
        src = dh[g.key] || c[g.key] || {};
      }
      varianList.forEach(v => {
        const val = g.isQty ? (src[v]?.qty ?? "") : (src[v] ?? "");
        const isHighlight = (g.key === "dataKemarin" || g.key === "konsinyasi") && varianBeda.has(v);
        const cls = isHighlight ? `${DSM_GROUP_CLASS[g.key]} dsm-highlight` : DSM_GROUP_CLASS[g.key];
        row += `<td class="${cls}" style="width:${COL_VAR}px">${(val === "" || val === 0) ? "" : val}</td>`;
      });
      if (!varianList.length) row += `<td class="${DSM_GROUP_CLASS[g.key]}" style="width:${COL_VAR}px"></td>`;
    });

    const bayarKonsumen = c._isPenjualan
      ? Number(c._plData?.pembayaran?.bayarKonsumen ?? 0)
      : Number(dh.pembayaran?.bayarKonsumen ?? 0);
    row += `<td class="dsm-td-base" style="width:${COL_AKSI}px">${bayarKonsumen > 0 ? bayarKonsumen.toLocaleString("id-ID") : ""}</td></tr>`;
    tbodyParts.push(row);
  });
  const tbody = tbodyParts.join("");

  // ── FOOTER TOTAL ──
  let tfoot = `<tr>
    <td colspan="2" class="dsm-td-total" style="${stickyNo}">Total</td>`;
  GROUPS.forEach(g => {
    varianList.forEach(v => {
      let total = 0;
      allRows.forEach(c => {
        let src;
        if (c._isPenjualan) {
          const pl = c._plData || {};
          src = (g.key === "cash" || g.key === "closing") ? (pl.closing||{}) : g.key === "pay" ? (pl.pay||{}) : {};
          total += Number(src[v] ?? 0) || 0;
        } else {
          const dh = dhMap[c.id] || {};
          src = dh[g.key] || c[g.key] || {};
          total += Number(g.isQty ? (src[v]?.qty ?? 0) : (src[v] ?? 0)) || 0;
        }
      });
      tfoot += `<td class="${DSM_GROUP_CLASS[g.key]} dsm-td-totalval" style="width:${COL_VAR}px">${total||""}</td>`;
    });
    if (!varianList.length) tfoot += `<td class="${DSM_GROUP_CLASS[g.key]}" style="width:${COL_VAR}px"></td>`;
  });
  let totalBayarKonsumen = 0;
  allRows.forEach(c => {
    if (c._isPenjualan) totalBayarKonsumen += Number(c._plData?.pembayaran?.bayarKonsumen ?? 0);
    else totalBayarKonsumen += Number((dhMap[c.id] || {}).pembayaran?.bayarKonsumen ?? 0);
  });
  tfoot += `<td class="dsm-td-total" style="width:${COL_AKSI}px">${totalBayarKonsumen.toLocaleString("id-ID")}</td></tr>`;

  // ── REKAP COLGROUP ──
  const REKAP_COL_NO   = 40;
  const REKAP_COL_NAMA = 150;
  const REKAP_COL_VAR  = 47.7;
  let colgroup = `<colgroup>
    <col style="width:${REKAP_COL_NO}px">
    <col style="width:${REKAP_COL_NAMA}px">`;
  rekapGroups2.forEach(() => {
    varianList.forEach(() => colgroup += `<col style="width:${REKAP_COL_VAR}px">`);
    if (!varianList.length) colgroup += `<col style="width:${REKAP_COL_VAR}px">`;
  });
  ["","","",""].forEach(() => colgroup += `<col style="width:50px">`);
  colgroup += `<col></colgroup>`;

  // ── REKAP HEADER ──
  let rekapThead = `<tr>
    <th class="dsm-th-base"></th>
    <th class="dsm-th-base" style="text-align:left">Rekap</th>`;
  rekapGroups2.forEach((g, gi) => {
    rekapThead += `<th colspan="${V}" class="dsm-th-group ${DSM_REKAP_CLASS[gi]}">${g}</th>`;
  });
  rekapThead += `<th colspan="4" class="dsm-th-group dsm-rk-customer">Customer</th>`;
  rekapThead += `<th class="dsm-th-group dsm-rk-omset" style="width:100%">Omset</th></tr>`;
  rekapThead += `<tr><th class="dsm-th-base"></th><th class="dsm-th-base"></th>`;
  rekapGroups2.forEach((g, gi) => {
    varianList.forEach(v => { rekapThead += `<th class="dsm-th-sub ${DSM_REKAP_CLASS[gi]}">${v}</th>`; });
    if (!varianList.length) rekapThead += `<th class="dsm-th-sub ${DSM_REKAP_CLASS[gi]}">-</th>`;
  });
  ["Tutup","Pending","Putus","Expired"].forEach(l => {
    rekapThead += `<th class="dsm-th-sub dsm-rk-customer">${l}</th>`;
  });
  rekapThead += `<th class="dsm-th-sub dsm-rk-omset">Rp</th></tr>`;

  // ── HITUNG NILAI REKAP ──
  const orderMap = {};
  varianList.forEach(v => { orderMap[v] = 0; });
  try {
    const snapLM = await window.getDoc(
      window.doc(window.db, "users", dsmSelectedKurir, "laporanMarketing", tanggalStr)
    );
    if (snapLM.exists()) {
      const lmData = snapLM.data();
      varianList.forEach(v => { orderMap[v] = Number(lmData.order?.[v] ?? 0); });
    }
  } catch (e) { console.error("❌ fetch laporanMarketing:", e); }

  const feeMap     = {};
  const disableMap = {};
  varianList.forEach(v => { feeMap[v] = 0; disableMap[v] = 0; });
  Object.values(dhMap).forEach(dh => {
    varianList.forEach(v => {
      feeMap[v]     += Number(dh.fee?.[v]     ?? 0);
      disableMap[v] += Number(dh.disable?.[v] ?? 0);
    });
  });

  const payMap = {};
  varianList.forEach(v => {
    let total = 0;
    allRows.forEach(c => {
      let src;
      if (c._isPenjualan) src = c._plData?.pay || {};
      else { const dh = dhMap[c.id] || {}; src = dh.pay || c.pay || {}; }
      total += Number(src[v] ?? 0) || 0;
    });
    payMap[v] = total;
  });

  let custTutup = 0, custPending = 0, custPutus = 0;
  Object.values(dhMap).forEach(dh => {
    const status = dh.keterangan?.status?.toLowerCase() || "";
    if (status === "tutup")   custTutup++;
    if (status === "pending") custPending++;
    if (status === "putus")   custPutus++;
  });

  let totalExpired = 0, totalPay = 0;
  varianList.forEach(v => {
    Object.values(dhMap).forEach(dh => {
      totalExpired += Number(dh.expired?.[v] ?? 0);
      totalPay     += Number(dh.pay?.[v]     ?? 0);
    });
  });
  const expiredPct = totalPay > 0 ? Math.round(totalExpired / totalPay * 100) : 0;

  let omset = 0;
  Object.values(dhMap).forEach(dh => { omset += Number(dh.pembayaran?.bayarKonsumen ?? 0); });
  if (plData?.pembayaran?.bayarKonsumen) omset += Number(plData.pembayaran.bayarKonsumen);
  const omsetStr = omset > 0 ? `Rp ${omset.toLocaleString("id-ID")}` : "—";

  const closingTotalMap = {};
  varianList.forEach(v => {
    let total = 0;
    Object.values(dhMap).forEach(dh => { total += Number(dh.closing?.[v] ?? 0); });
    if (plData?.closing?.[v]) total += Number(plData.closing[v]);
    closingTotalMap[v] = total;
  });
  const saldoMap  = {};
  const outputMap = {};
  varianList.forEach(v => {
    const order   = orderMap[v]   || 0;
    const closing = closingTotalMap[v] || 0;
    const fee     = feeMap[v]     || 0;
    const disable = disableMap[v] || 0;
    saldoMap[v]  = order - closing - fee - disable;
    outputMap[v] = order - saldoMap[v];
  });

  // ── REKAP BODY ──
  let rekapTbody = `<tr><td class="dsm-td-base"></td><td class="dsm-td-base" style="font-weight:700">Nilai</td>`;
  const rekapRow = (map, idx) => {
    let html = "";
    varianList.forEach(v => {
      const val = map[v] || 0;
      html += `<td class="${DSM_REKAP_CLASS[idx]}" style="font-weight:${val?'700':'400'}">${val||""}</td>`;
    });
    if (!varianList.length) html += `<td class="${DSM_REKAP_CLASS[idx]}">—</td>`;
    return html;
  };
  rekapTbody += rekapRow(orderMap, 0);
  rekapTbody += rekapRow(feeMap, 1);
  rekapTbody += rekapRow(disableMap, 2);
  rekapTbody += rekapRow(outputMap, 3);
  rekapTbody += rekapRow(saldoMap, 4);
  rekapTbody += rekapRow(payMap, 5);
  rekapTbody += `<td class="dsm-rk-customer" style="font-weight:${custTutup?'700':'400'}">${custTutup||""}</td>`;
  rekapTbody += `<td class="dsm-rk-customer" style="font-weight:${custPending?'700':'400'}">${custPending||""}</td>`;
  rekapTbody += `<td class="dsm-rk-customer" style="font-weight:${custPutus?'700':'400'}">${custPutus||""}</td>`;
  rekapTbody += `<td class="dsm-rk-customer" style="font-weight:${expiredPct?'700':'400'}">${expiredPct ? expiredPct+"%" : ""}</td>`;
  rekapTbody += `<td class="dsm-rk-omset" style="font-weight:700">${omsetStr}</td></tr>`;

  wrap.innerHTML = `
    <div class="dsm-table-inner">
      <table class="dsm-table" id="dsmMainTable">
        <colgroup>
          <col style="width:${COL_NO}px">
          <col style="width:${COL_NAMA}px">
          ${GROUPS.map(() => varianList.length ? varianList.map(()=>`<col style="width:${COL_VAR}px">`).join("") : `<col style="width:${COL_VAR}px">`).join("")}
          <col>
        </colgroup>
        <thead>${thead}</thead>
        <tbody>${tbody}</tbody>
        <tfoot>${tfoot}</tfoot>
      </table>
      <table class="dsm-table dsm-table-rekap">
        ${colgroup}
        <thead>${rekapThead}</thead>
        <tbody>${rekapTbody}</tbody>
      </table>
    </div>`;

  wrap.querySelectorAll(".dsm-status-badge").forEach(badge => {
    badge.addEventListener("click", e => {
      e.stopPropagation();
      showDsmFotoPopup(badge.dataset.nama, badge.dataset.fotoCustomer, badge.dataset.fotoKeterangan);
    });
  });

  initDsmDragScroll();
}

function showDsmFotoPopup(nama, fotoCustomer, fotoKeterangan) {
  document.getElementById("dsmFotoOverlay")?.remove();
  const el = document.createElement("div");
  el.id = "dsmFotoOverlay";
  el.className = "dsm-foto-overlay";
  el.innerHTML = `
    <div class="dsm-foto-box">
      <div class="dsm-foto-title">${esc(nama)}</div>
      <div class="dsm-foto-grid">
        <div class="dsm-foto-item">
          <div class="dsm-foto-item-label">Foto Customer</div>
          ${fotoCustomer ? `<img src="${esc(fotoCustomer)}" alt="">` : `<div class="dsm-foto-item-empty">Tidak ada</div>`}
        </div>
        <div class="dsm-foto-item">
          <div class="dsm-foto-item-label">Foto Keterangan</div>
          ${fotoKeterangan ? `<img src="${esc(fotoKeterangan)}" alt="">` : `<div class="dsm-foto-item-empty">Tidak ada</div>`}
        </div>
      </div>
      <button class="dsm-foto-close" id="dsmFotoCloseBtn">Tutup</button>
    </div>`;
  document.body.appendChild(el);
  document.getElementById("dsmFotoCloseBtn").onclick = () => el.remove();
  el.onclick = e => { if (e.target === el) el.remove(); };
}

function initDsmDragScroll() {
  const wrap = document.getElementById("dsmTableWrap");
  if (!wrap || wrap._dragScrollInit) return;
  wrap._dragScrollInit = true;

  let isDown = false;
  let startX, scrollLeft;

  wrap.addEventListener("mousedown", e => {
    isDown = true;
    wrap.classList.add("dragging");
    startX = e.pageX - wrap.offsetLeft;
    scrollLeft = wrap.scrollLeft;
  });
  wrap.addEventListener("mouseleave", () => { isDown = false; wrap.classList.remove("dragging"); });
  wrap.addEventListener("mouseup",    () => { isDown = false; wrap.classList.remove("dragging"); });
  wrap.addEventListener("mousemove", e => {
    if (!isDown) return;
    e.preventDefault();
    const x = e.pageX - wrap.offsetLeft;
    wrap.scrollLeft = scrollLeft - (x - startX) * 1.5;
  });
}

function esc(str) {
  return String(str)
    .replace(/&/g,"&amp;").replace(/</g,"&lt;")
    .replace(/>/g,"&gt;").replace(/"/g,"&quot;");
}

/* ── TRIKOTOMI POPUP TRIGGER (logic ada di trikotomi.js) ── */
function initDsmAnalisaPopup() {
  document.getElementById("dsmAnalisaBtn")?.addEventListener("click", () => {
    if (!dsmSelectedKurir) { window.showToast("Pilih kurir dulu", "error"); return; }
    document.getElementById("dsmAnalisaOverlay")?.classList.add("show");
    window.renderDsmAnalisa?.();
  });

  document.getElementById("dsmAnalisaCloseBtn")?.addEventListener("click", () => {
    document.getElementById("dsmAnalisaOverlay")?.classList.remove("show");
  });
  document.getElementById("dsmAnalisaOverlay")?.addEventListener("click", e => {
    if (e.target.id === "dsmAnalisaOverlay") e.currentTarget.classList.remove("show");
  });

  document.querySelectorAll(".dsm-analisa-chip").forEach(chip => {
    chip.addEventListener("click", () => {
      document.querySelectorAll(".dsm-analisa-chip").forEach(c => c.classList.remove("active"));
      chip.classList.add("active");
      window.dsmAnalisaFilter = chip.dataset.filter;
      window.renderDsmAnalisa?.();
    });
  });

  document.getElementById("dsmAnalisaPeriodeBtn")?.addEventListener("click", e => {
    e.stopPropagation();
    document.getElementById("dsmAnalisaPeriodeDropdown").style.display =
      document.getElementById("dsmAnalisaPeriodeDropdown").style.display === "none" ? "block" : "none";
  });
  document.querySelectorAll("#dsmAnalisaPeriodeDropdown .peta-filter-option").forEach(opt => {
    opt.addEventListener("click", e => {
      e.stopPropagation();
      window.dsmAnalisaPeriode = Number(opt.dataset.periode);
      document.getElementById("dsmAnalisaPeriodeLabel").textContent = `T-${window.dsmAnalisaPeriode}`;
      document.querySelectorAll("#dsmAnalisaPeriodeDropdown .peta-filter-option").forEach(o => o.classList.remove("selected"));
      opt.classList.add("selected");
      document.getElementById("dsmAnalisaPeriodeDropdown").style.display = "none";
      window.renderDsmAnalisa?.();
    });
  });
}

// expose untuk trikotomi.js
window._dsmGetState = () => ({
  dsmSelectedKurir, dsmSelectedHari, dsmSelectedBulan, dsmSelectedTahun,
  dsmMingguKe, dsmCustomers
});
window._dsmGetDataCached = getDsmDataCached;
window._dsmHitungMinggu  = hitungMingguDalamBulan;