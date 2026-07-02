
window.initStockOpnameView = async function() {
  soCanvas = document.getElementById("soCanvas");
  if (!soCanvas) return;
  soCtx = soCanvas.getContext("2d");

  initSoFilters();
  initSoSearch();
  initSoReload();
  initSoCanvasInteraction();
  renderSoSaldoKemarinUI();
  requestAnimationFrame(() => {
    requestAnimationFrame(resizeSoCanvas);
  });

  window.addEventListener("resize", resizeSoCanvas);

  const wrap = document.getElementById("soTableWrap");
  if (wrap && window.ResizeObserver) {
    const ro = new ResizeObserver(() => {
      requestAnimationFrame(resizeSoCanvas);
    });
    ro.observe(wrap);
  }

  await loadSoData();

  document.getElementById("soInputBtn")?.addEventListener("click", async () => {
    openSoPopup("soPopupMainOverlay");
    await renderSoPopupForm("main");
  });
  document.getElementById("soInputBtn2")?.addEventListener("click", async () => {
    openSoPopup("soPopupPlusOverlay");
    await renderSoPopupForm("plus");
  });

  initSoPopupBehavior("soPopupMainOverlay", "soPopupMainBox", "soPopupMainClose");
  initSoPopupBehavior("soPopupPlusOverlay", "soPopupPlusBox", "soPopupPlusClose");
  initSoPopupBehavior("soPopupSaldoKemarinOverlay", "soPopupSaldoKemarinBox", "soPopupSaldoKemarinClose");

  document.getElementById("soInputSaldoKemarinBtn")?.addEventListener("click", async () => {
    openSoPopup("soPopupSaldoKemarinOverlay");
    await renderSoSaldoKemarinForm();
  });
  await loadSoSaldoKemarinDisplay();
};

function openSoPopup(overlayId) {
  const overlay = document.getElementById(overlayId);
  if (!overlay) return;
  overlay.style.display = "block";
  requestAnimationFrame(() => overlay.classList.add("show"));
}

function closeSoPopup(overlayId) {
  const overlay = document.getElementById(overlayId);
  if (!overlay) return;
  overlay.classList.remove("show");
  setTimeout(() => { overlay.style.display = "none"; }, 280);
}
async function renderSoPopupForm(mode) {
  const bodyId = mode === "main" ? "soPopupMainBody" : "soPopupPlusBody";
  const body = document.getElementById(bodyId);
  if (!body) return;

  body.innerHTML = `<div class="dh-ringkasan-empty">Memuat...</div>`;

  let kokiList = [];
  try {
    // ambil dari usersCache yang sudah di-load (sama seperti kurir/hunter/sales)
    if (!window.usersCache?.length) {
      window.usersCache = await window.idb.getUsers();
    }
    kokiList = (window.usersCache || [])
      .filter(u => u.role === "produksi")
      .map(u => u.nama)
      .filter(Boolean);
  } catch (err) {
    console.error("❌ fetch koki:", err);
  }

  const gridGroup = (label, fieldKey) => `
    <div class="so-form-group">
      <div class="so-form-label">${label}</div>
      <div class="so-form-grid">
        ${SO_VARIAN.map(v => `
          <input type="number" min="0" class="so-input-varian" data-field="${fieldKey}" data-varian="${v}" placeholder="${v}">
        `).join("")}
      </div>
    </div>`;

  if (mode === "main") {
    body.innerHTML = `
      <div class="so-form-group">
        <div class="so-form-label">Tanggal</div>
        <input type="date" class="so-form-input" id="soTanggalEntry" value="${new Date().toISOString().slice(0,10)}">
      </div>

      <div class="so-form-group">
        <div class="so-form-label">Koki</div>
        <div class="so-select-wrap">
          <button type="button" class="so-select-btn" id="soKokiBtn">
            <span id="soKokiLabel">Pilih koki</span>
            <i class="fa-solid fa-chevron-down"></i>
          </button>
          <div class="so-select-dropdown" id="soKokiDropdown">
            ${kokiList.map(k => `<div class="so-select-option" data-val="${k}">${k}</div>`).join("")}
            <div class="so-select-option" data-val="lainnya">Lainnya</div>
          </div>
        </div>
        <input type="text" class="so-form-input" id="soKokiManual" placeholder="Tulis nama koki" style="display:none">
      </div>

      <div class="so-form-group">
        <div class="so-form-label">Loyang Original</div>
        <input type="number" min="0" class="so-form-input" id="soLoyangOriginal" placeholder="Jumlah loyang">
      </div>

      <div class="so-form-group">
        <div class="so-form-label">Loyang Matcha</div>
        <input type="number" min="0" class="so-form-input" id="soLoyangMatcha" placeholder="Jumlah loyang matcha">
      </div>

      ${gridGroup("Produksi", "produksi")}
      ${gridGroup("Reject", "reject")}

      <div class="so-form-group">
        <div class="so-form-label">Tanggal Expired</div>
        <input type="date" class="so-form-input" id="soTanggalExpired" readonly>
      </div>`;

    // dropdown koki behavior
    const kokiBtn   = document.getElementById("soKokiBtn");
    const kokiLabel = document.getElementById("soKokiLabel");
    const kokiDD    = document.getElementById("soKokiDropdown");
    const kokiManual = document.getElementById("soKokiManual");

    kokiBtn?.addEventListener("click", e => {
      e.stopPropagation();
      kokiDD.classList.toggle("show");
    });
    kokiDD?.querySelectorAll(".so-select-option").forEach(opt => {
      opt.addEventListener("click", () => {
        kokiLabel.textContent = opt.textContent;
        kokiDD.classList.remove("show");
        const isOther = opt.dataset.val === "lainnya";
        kokiManual.style.display = isOther ? "block" : "none";
      });
    });
    document.addEventListener("click", () => kokiDD?.classList.remove("show"));

    // auto hitung tanggal expired dari setting kantorCabang.target.expired
    const tglEntry = document.getElementById("soTanggalEntry");
    const tglExpired = document.getElementById("soTanggalExpired");
    const kantorCabang = await window.idb.getKantorCabang();
    const expiredDays = Number(kantorCabang?.target?.expired) || 0;
    const updateExpired = () => {
      if (!tglEntry?.value) return;
      const d = new Date(tglEntry.value + "T00:00:00");
      d.setDate(d.getDate() + expiredDays);
      tglExpired.value = d.toISOString().slice(0,10);
    };

    // preview data existing sesuai tanggal
    const loadPreviewMain = async () => {
      if (!tglEntry?.value) return;
      const adminUid = window.auth?.currentUser?.uid;
      try {
        const snap = await window.getDoc(window.doc(window.db, "users", adminUid, "stockOpname", tglEntry.value));
        const existing = snap.exists() ? snap.data() : {};

        // koki
        if (existing.koki) {
          const isInList = kokiList.includes(existing.koki);
          kokiLabel.textContent = existing.koki;
          if (!isInList) {
            kokiManual.style.display = "block";
            kokiManual.value = existing.koki;
          } else {
            kokiManual.style.display = "none";
          }
        } else {
          kokiLabel.textContent = "Pilih koki";
          kokiManual.style.display = "none";
          kokiManual.value = "";
        }

        document.getElementById("soLoyangOriginal").value = existing.jumlahLoyang || "";
        document.getElementById("soLoyangMatcha").value = existing.jumlahLoyangMatcha || "";

        // isi grid produksi & reject
        document.querySelectorAll('.so-input-varian[data-field="produksi"]').forEach(inp => {
          inp.value = existing.produksi?.[inp.dataset.varian] || "";
        });
        document.querySelectorAll('.so-input-varian[data-field="reject"]').forEach(inp => {
          inp.value = existing.reject?.[inp.dataset.varian] || "";
        });

        // expired — pakai existing kalau ada, kalau tidak hitung otomatis
        if (existing.tanggalExpired) {
          tglExpired.value = existing.tanggalExpired;
        } else {
          updateExpired();
        }
      } catch (err) {
        console.error("❌ loadPreviewMain:", err);
        updateExpired();
      }
    };

    tglEntry?.addEventListener("change", loadPreviewMain);
    await loadPreviewMain();

  } else {
    body.innerHTML = `
      <div class="so-form-group">
        <div class="so-form-label">Tanggal</div>
        <input type="date" class="so-form-input" id="soPlusTanggalEntry" value="${new Date().toISOString().slice(0,10)}">
      </div>

      <div class="so-form-group">
        <div class="so-form-label">Koki</div>
        <input type="text" class="so-form-input" id="soPlusKoki" readonly placeholder="-">
      </div>

      ${gridGroup("Rusak Freezer", "rusakFreezer")}
      ${gridGroup("Basi Freezer", "basiFreezer")}
      ${gridGroup("Promosi", "promosi")}
      ${gridGroup("Barang Hilang", "barangHilang")}`;

    const tglEntry = document.getElementById("soPlusTanggalEntry");
    const kokiField = document.getElementById("soPlusKoki");

    const loadPreviewPlus = async () => {
      if (!tglEntry?.value) return;
      soLastPlusTanggal = tglEntry.value;
      const adminUid = window.auth?.currentUser?.uid;
      try {
        const snap = await window.getDoc(window.doc(window.db, "users", adminUid, "stockOpname", tglEntry.value));
        const existing = snap.exists() ? snap.data() : {};

        kokiField.value = existing.koki || "";

        document.querySelectorAll('.so-input-varian[data-field="rusakFreezer"]').forEach(inp => {
          inp.value = existing.rusakFreezer?.[inp.dataset.varian] || "";
        });
        document.querySelectorAll('.so-input-varian[data-field="basiFreezer"]').forEach(inp => {
          inp.value = existing.basiFreezer?.[inp.dataset.varian] || "";
        });
        document.querySelectorAll('.so-input-varian[data-field="promosi"]').forEach(inp => {
          inp.value = existing.promosi?.[inp.dataset.varian] || "";
        });
        document.querySelectorAll('.so-input-varian[data-field="barangHilang"]').forEach(inp => {
          inp.value = existing.barangHilang?.[inp.dataset.varian] || "";
        });
      } catch (err) {
        console.error("❌ loadPreviewPlus:", err);
      }
    };

    tglEntry?.addEventListener("change", loadPreviewPlus);
    await loadPreviewPlus();
  }

  body.insertAdjacentHTML("beforeend", `
    <div style="margin-top:8px">
      <button class="so-popup-save-btn" id="soPopupSaveBtn-${mode}">Simpan</button>
    </div>`);

  document.getElementById(`soPopupSaveBtn-${mode}`)?.addEventListener("click", () => simpanSoData(mode));
}

async function simpanSoData(mode) {
  const btn = document.getElementById(`soPopupSaveBtn-${mode}`);
  if (!btn) return;
  btn.disabled = true;
  btn.textContent = "Menyimpan...";

  try {
    const adminUid = window.auth?.currentUser?.uid;
    let tanggal;

    const buildVarianObj = fieldKey => {
      const obj = {};
      document.querySelectorAll(`.so-input-varian[data-field="${fieldKey}"]`).forEach(inp => {
        const val = Number(inp.value);
        if (!isNaN(val) && val > 0) obj[inp.dataset.varian] = val;
      });
      return obj;
    };

    let payload = {};

    if (mode === "main") {
      tanggal = document.getElementById("soTanggalEntry")?.value;
      if (!tanggal) { window.showToast("Pilih tanggal dulu", "error"); btn.disabled=false; btn.textContent="Simpan"; return; }

      const kokiLabel = document.getElementById("soKokiLabel")?.textContent || "";
      const kokiManual = document.getElementById("soKokiManual")?.value?.trim() || "";
      const koki = kokiLabel === "Lainnya" ? kokiManual : kokiLabel;

      payload = {
        koki,
        jumlahLoyang: Number(document.getElementById("soLoyangOriginal")?.value) || 0,
        jumlahLoyangMatcha: Number(document.getElementById("soLoyangMatcha")?.value) || 0,
        tanggalExpired: document.getElementById("soTanggalExpired")?.value || "",
        produksi: buildVarianObj("produksi"),
        reject: buildVarianObj("reject"),
      };
    } else {
      // mode plus — pakai tanggal yang sama dengan yang terakhir dipilih di main, fallback hari ini
      tanggal = soLastPlusTanggal || new Date().toISOString().slice(0,10);
      payload = {
        rusakFreezer: buildVarianObj("rusakFreezer"),
        basiFreezer: buildVarianObj("basiFreezer"),
        promosi: buildVarianObj("promosi"),
        barangHilang: buildVarianObj("barangHilang"),
      };
    }

    const ref = window.doc(window.db, "users", adminUid, "stockOpname", tanggal);
    await window.setDoc(ref, {
      createdBy: adminUid,
      tanggal,
      updatedAt: window.serverTimestamp(),
      ...payload,
    }, { merge: true });

    window.showToast("Berhasil disimpan", "success");
    closeSoPopup(mode === "main" ? "soPopupMainOverlay" : "soPopupPlusOverlay");
    await loadSoData(true);
  } catch (err) {
    console.error("❌ simpanSoData:", err);
    window.showToast("Gagal menyimpan", "error");
  } finally {
    btn.disabled = false;
    btn.textContent = "Simpan";
  }
}
function initSoPopupBehavior(overlayId, boxId, closeBtnId) {
  const overlay = document.getElementById(overlayId);
  const box     = document.getElementById(boxId);
  if (!overlay || !box) return;

  document.getElementById(closeBtnId)?.addEventListener("click", () => closeSoPopup(overlayId));

  // klik luar (overlay) menutup
  overlay.addEventListener("click", e => {
    if (e.target === overlay) closeSoPopup(overlayId);
  });

  // swipe down mobile
  if (window.innerWidth <= 768) {
    let startY = 0, curY = 0, dragging = false;
    box.addEventListener("touchstart", e => {
      startY = curY = e.touches[0].clientY;
      dragging = true;
      box.style.transition = "none";
    }, { passive: true });
    box.addEventListener("touchmove", e => {
      if (!dragging) return;
      curY = e.touches[0].clientY;
      const dy = curY - startY;
      if (dy < 0) return;
      box.style.transform = `translateY(${dy}px)`;
    }, { passive: true });
    box.addEventListener("touchend", () => {
      dragging = false;
      box.style.transition = "transform .28s cubic-bezier(.32,1,.23,1)";
      if (curY - startY > 100) {
        box.style.transform = "translateY(100%)";
        setTimeout(() => {
          closeSoPopup(overlayId);
          box.style.transform = "";
          box.style.transition = "";
        }, 280);
      } else {
        box.style.transform = "";
      }
    });
  }
}
/* ── STOCK OPNAME VIEW (canvas table) ── */
let soBulan = new Date().getMonth();
let soTahun = new Date().getFullYear();
let soSearchQuery = "";

// varian default — nanti diganti dinamis dari data kantorCabang
const SO_VARIAN = ["CB", "BB", "BK", "MC"];

// kelompok kolom per varian, dengan warna masing-masing group
const SO_GROUPS = [
  { key: "target",   label: "Target",        color: "#1a5fb4" },
  { key: "produksi", label: "Input",         color: "#2d6b2d" },
  { key: "output",   label: "Output",        color: "#b05c00" },
  { key: "reject",   label: "Reject",        color: "#b02020" },
  { key: "fee",      label: "Fee",           color: "#6123a8" },
  { key: "rusak",    label: "Rusak Freezer", color: "#c05020" },
  { key: "basi",     label: "Basi Freezer",  color: "#8a4a00" },
  { key: "promosi",  label: "Promosi",       color: "#1a7080" },
  { key: "flavor",   label: "Off Flavor",    color: "#7a4a9a" },
  { key: "hilang",   label: "Barang Hilang", color: "#a03050" },
  { key: "saldo",    label: "Saldo",         color: "#2d6b2d" },
];

// kolom statis (bukan per varian)
const SO_STATIC_COLUMNS = [
  { key: "tanggal", label: "Tanggal", width: 135 },
  { key: "expired", label: "Expired", width: 135 },
  { key: "koki",    label: "Koki",    width: 130 },
  { key: "Original",  label: "Original",  width: 60 },
  { key: "Matcha", label: "Matcha", width: 60 },
];

// build SO_COLUMNS dinamis: static + per group per varian
function buildSoColumns() {
  const cols = [...SO_STATIC_COLUMNS];
  SO_GROUPS.forEach(g => {
    SO_VARIAN.forEach(v => {
      cols.push({ key: `${g.key}_${v}`, label: v, width: 40, group: g.key, groupLabel: g.label, groupColor: g.color });
    });
  });
  return cols;
}
let SO_COLUMNS = buildSoColumns();

let soData = []; // array of row objects, diisi nanti dari fetch

let soScrollX = 0, soScrollY = 0;
let soHoverRow = -1;
let soLastPlusTanggal = null;
let soCanvas, soCtx;
const SO_ROW_HEIGHT = 32;
const SO_HEADER_HEIGHT_GROUP = 30;
const SO_HEADER_HEIGHT_SUB   = 28;
const SO_HEADER_HEIGHT = SO_HEADER_HEIGHT_GROUP + SO_HEADER_HEIGHT_SUB;

function resizeSoCanvas() {
  if (!soCanvas) return;
  const wrap = document.getElementById("soTableWrap");
  if (!wrap) return;
  const dpr = window.devicePixelRatio || 1;
  const rect = wrap.getBoundingClientRect();
  soCanvas.width  = rect.width * dpr;
  soCanvas.height = rect.height * dpr;
  soCanvas.style.width  = rect.width + "px";
  soCanvas.style.height = rect.height + "px";
  soCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
  drawSoTable();
}

/* ── FILTER ── */
function initSoFilters() {
  document.getElementById("soBulanBtn")?.addEventListener("click", e => {
    e.stopPropagation();
    const dd = document.getElementById("soBulanDropdown");
    dd.style.display = dd.style.display === "none" ? "block" : "none";
    document.getElementById("soTahunDropdown").style.display = "none";
  });
  document.querySelectorAll("#soBulanDropdown .peta-filter-option").forEach(opt => {
    opt.addEventListener("click", e => {
      e.stopPropagation();
      const bulanNama = ["Januari","Februari","Maret","April","Mei","Juni","Juli","Agustus","September","Oktober","November","Desember"];
      soBulan = Number(opt.dataset.bulan);
      document.getElementById("soBulanLabel").textContent = bulanNama[soBulan];
      document.querySelectorAll("#soBulanDropdown .peta-filter-option").forEach(o => o.classList.remove("selected"));
      opt.classList.add("selected");
      document.getElementById("soBulanDropdown").style.display = "none";
      loadSoData();
      loadSoSaldoKemarinDisplay();
    });
  });

  document.getElementById("soTahunBtn")?.addEventListener("click", e => {
    e.stopPropagation();
    const dd = document.getElementById("soTahunDropdown");
    dd.style.display = dd.style.display === "none" ? "block" : "none";
    document.getElementById("soBulanDropdown").style.display = "none";
  });
  renderSoTahunDropdown();

  document.addEventListener("click", () => {
    document.getElementById("soBulanDropdown").style.display = "none";
    document.getElementById("soTahunDropdown").style.display = "none";
  });
}

function renderSoTahunDropdown() {
  const dd  = document.getElementById("soTahunDropdown");
  const now = new Date().getFullYear();
  const years = [now - 1, now, now + 1];
  dd.innerHTML = years.map(y =>
    `<div class="peta-filter-option ${y === soTahun ? "selected" : ""}" data-tahun="${y}">${y}</div>`
  ).join("");
  dd.querySelectorAll(".peta-filter-option").forEach(opt => {
    opt.addEventListener("click", e => {
      e.stopPropagation();
      soTahun = Number(opt.dataset.tahun);
      document.getElementById("soTahunLabel").textContent = soTahun;
      dd.querySelectorAll(".peta-filter-option").forEach(o => o.classList.remove("selected"));
      opt.classList.add("selected");
      dd.style.display = "none";
      loadSoData();
      loadSoSaldoKemarinDisplay();
    });
  });
}

/* ── SEARCH ── */
function initSoSearch() {
  document.getElementById("soSearchInput")?.addEventListener("input", e => {
    soSearchQuery = e.target.value.toLowerCase().trim();
    drawSoTable();
  });
}

/* ── RELOAD ── */
function initSoReload() {
  document.getElementById("soReloadBtn")?.addEventListener("click", async () => {
    const btn = document.getElementById("soReloadBtn");
    btn?.classList.add("spinning");
    await loadSoData(true);
    btn?.classList.remove("spinning");
  });
}

/* ── LOAD DATA ── */
async function loadSoData(forceReload = false) {
  renderSoEmpty("Memuat...");

  try {
    const adminUid = window.auth?.currentUser?.uid;
    const totalHari = new Date(soTahun, soBulan + 1, 0).getDate();

    // fetch semua dokumen stockOpname di bulan ini secara paralel
    const promises = [];
    for (let d = 1; d <= totalHari; d++) {
      const tglStr = `${soTahun}-${String(soBulan+1).padStart(2,"0")}-${String(d).padStart(2,"0")}`;
      promises.push(
        window.getDoc(window.doc(window.db, "users", adminUid, "stockOpname", tglStr))
          .then(snap => snap.exists() ? { id: tglStr, ...snap.data() } : null)
      );
    }
    const results = await Promise.all(promises);
    const dataByDate = {};
    results.forEach(r => { if (r) dataByDate[r.id] = r; });

    // ambil saldo bulan kemarin sebagai titik awal rantai saldo berjalan
    let saldoAwalMap = {};
    try {
      const saldoBulanKemarinKey = getBulanKemarinKey();
      const saldoSnap = await window.getDoc(
        window.doc(window.db, "users", adminUid, "saldoBulanKemarin", saldoBulanKemarinKey)
      );
      saldoAwalMap = saldoSnap.exists() ? (saldoSnap.data()?.saldo || {}) : {};
    } catch (err) {
      console.error("❌ load saldoBulanKemarin utk running balance:", err);
    }

    // fetch semua dokumen laporanAdmin di bulan ini secara paralel
    const laporanPromises = [];
    for (let d = 1; d <= totalHari; d++) {
      const tglStr = `${soTahun}-${String(soBulan+1).padStart(2,"0")}-${String(d).padStart(2,"0")}`;
      laporanPromises.push(
        window.getDoc(window.doc(window.db, "users", adminUid, "laporanAdmin", tglStr))
          .then(snap => snap.exists() ? { id: tglStr, ...snap.data() } : null)
      );
    }
    const laporanResults = await Promise.all(laporanPromises);
    const laporanByDate = {};
    laporanResults.forEach(r => { if (r) laporanByDate[r.id] = r; });

    // field top-level non-UID yang harus di-skip saat looping
    const LAPORAN_SKIP_KEYS = new Set(["tanggal", "createdBy"]);

    function aggregateLaporan(laporanDoc) {
      const agg = { output: {}, fee: {}, offFlavor: {} };
      if (!laporanDoc) return agg;
      Object.keys(laporanDoc).forEach(key => {
        if (LAPORAN_SKIP_KEYS.has(key)) return;
        const entry = laporanDoc[key];
        if (!entry || typeof entry !== "object") return;

        // output <- pembayaran.closing
        const closing = entry.pembayaran?.closing || {};
        Object.entries(closing).forEach(([varian, qty]) => {
          agg.output[varian] = (agg.output[varian] || 0) + (Number(qty) || 0);
        });

        // fee
        Object.entries(entry.fee || {}).forEach(([varian, qty]) => {
          agg.fee[varian] = (agg.fee[varian] || 0) + (Number(qty) || 0);
        });

        // offFlavor
        Object.entries(entry.offFlavor || {}).forEach(([varian, qty]) => {
          agg.offFlavor[varian] = (agg.offFlavor[varian] || 0) + (Number(qty) || 0);
        });
      });
      return agg;
    }

    soData = [];
    for (let d = 1; d <= totalHari; d++) {
      const dateObj = new Date(soTahun, soBulan, d);
      const tglStr  = `${soTahun}-${String(soBulan+1).padStart(2,"0")}-${String(d).padStart(2,"0")}`;
      const tglLabel = dateObj.toLocaleDateString("id-ID", { weekday:"long", day:"numeric", month:"long", year:"numeric" });
      const existing = dataByDate[tglStr] || {};
      const laporanAgg = aggregateLaporan(laporanByDate[tglStr]);

      const row = {
        tanggal: tglLabel,
        _tanggalRaw: tglStr,
        expired: existing.tanggalExpired || "",
        koki: existing.koki || "",
        loyang: existing.jumlahLoyang || 0,
        loyangMatcha: existing.jumlahLoyangMatcha || 0,
        Original: existing.jumlahLoyang || 0,
        Matcha: existing.jumlahLoyangMatcha || 0,
        _isWeekTotal: false,
        _dow: dateObj.getDay(),
      };

      // ── TARGET (rumus berantai CB -> BB -> BK -> MC) ──
      const targetMap = {};
      const loyangNormal = Number(existing.jumlahLoyang || 0);
      const inputCB = Number(existing.produksi?.CB || 0);
      const inputBB = Number(existing.produksi?.BB || 0);
      const inputBK = Number(existing.produksi?.BK || 0);
      const inputMC = Number(existing.produksi?.MC || 0);
      targetMap.CB = loyangNormal * 230;
      targetMap.BB = targetMap.CB - inputCB - inputBB;
      targetMap.BK = (targetMap.BB / 2) * 2.8;
      targetMap.MC = inputBK + inputMC - targetMap.BK;

      SO_GROUPS.forEach(g => {
        SO_VARIAN.forEach(v => {
          const key = `${g.key}_${v}`;
          if (g.key === "produksi") row[key] = existing.produksi?.[v] || 0;
          else if (g.key === "reject") row[key] = existing.reject?.[v] || 0;
          else if (g.key === "rusak") row[key] = existing.rusakFreezer?.[v] || 0;
          else if (g.key === "basi") row[key] = existing.basiFreezer?.[v] || 0;
          else if (g.key === "promosi") row[key] = existing.promosi?.[v] || 0;
          else if (g.key === "flavor") row[key] = laporanAgg.offFlavor[v] || 0;
          else if (g.key === "hilang") row[key] = existing.barangHilang?.[v] || 0;
          else if (g.key === "target") row[key] = Math.round(targetMap[v] || 0);
          else if (g.key === "output") row[key] = laporanAgg.output[v] || 0;
          else if (g.key === "fee") row[key] = laporanAgg.fee[v] || 0;
          else if (g.key === "saldo") row[key] = 0; // dihitung setelah semua baris terbentuk (running balance)
        });
      });

      soData.push(row);
      if (dateObj.getDay() === 0) soData.push(buildWeekTotalRow(soData));
    }
    // ── SALDO BERJALAN (running balance), mulai dari saldo bulan kemarin ──
    let prevSaldo = { ...saldoAwalMap };
    soData.forEach(row => {
      if (row._isWeekTotal) return; // total minggu dihitung terpisah di bawah
      SO_VARIAN.forEach(v => {
        const prev = Number(prevSaldo[v] || 0);
        const masuk = Number(row[`produksi_${v}`] || 0);
        const keluar =
          Number(row[`output_${v}`]  || 0) +
          Number(row[`fee_${v}`]     || 0) +
          Number(row[`reject_${v}`]  || 0) +
          Number(row[`rusak_${v}`]   || 0) +
          Number(row[`basi_${v}`]    || 0) +
          Number(row[`promosi_${v}`] || 0) +
          Number(row[`flavor_${v}`]  || 0) +
          Number(row[`hilang_${v}`]  || 0);
        const saldoHariIni = prev + masuk - keluar;
        row[`saldo_${v}`] = saldoHariIni;
        prevSaldo[v] = saldoHariIni;
      });
    });

    // Total Minggu untuk kolom saldo dihitung ulang setelah running balance selesai
    soData.forEach((row, idx) => {
      if (!row._isWeekTotal) return;
      let lastTotalIdx = -1;
      for (let i = idx - 1; i >= 0; i--) {
        if (soData[i]._isWeekTotal) { lastTotalIdx = i; break; }
      }
      const weekRows = soData.slice(lastTotalIdx + 1, idx);
      SO_VARIAN.forEach(v => {
        row[`saldo_${v}`] = weekRows.reduce((a, r) => a + (Number(r[`saldo_${v}`]) || 0), 0);
      });
    });

    if (soData.length && !soData[soData.length-1]._isWeekTotal) {
      soData.push(buildWeekTotalRow(soData));
    }

    if (!soData.length) {
      renderSoEmpty("Belum ada data untuk bulan ini");
      return;
    }
    hideSoEmpty();
    drawSoTable();
  } catch (err) {
    console.error("❌ loadSoData:", err);
    renderSoEmpty("Gagal memuat data");
  }
}
function buildWeekTotalRow(allRows) {
  // ambil baris sejak Total Minggu terakhir (atau dari awal)
  let lastTotalIdx = -1;
  for (let i = allRows.length - 1; i >= 0; i--) {
    if (allRows[i]._isWeekTotal) { lastTotalIdx = i; break; }
  }
  const weekRows = allRows.slice(lastTotalIdx + 1).filter(r => !r._isWeekTotal);

  const totalRow = { tanggal: "Total Minggu", expired: "", koki: "", _isWeekTotal: true };
  totalRow.loyang = weekRows.reduce((a,r) => a + (Number(r.loyang)||0), 0);
  totalRow.loyangMatcha = weekRows.reduce((a,r) => a + (Number(r.loyangMatcha)||0), 0);
  totalRow.Original = totalRow.loyang;
  totalRow.Matcha = totalRow.loyangMatcha;
  SO_GROUPS.forEach(g => {
    SO_VARIAN.forEach(v => {
      const key = `${g.key}_${v}`;
      totalRow[key] = weekRows.reduce((a,r) => a + (Number(r[key])||0), 0);
    });
  });
  return totalRow;
}

function renderSoEmpty(msg) {
  const el = document.getElementById("soEmpty");
  if (el) { el.textContent = msg; el.style.display = "flex"; }
}
function hideSoEmpty() {
  const el = document.getElementById("soEmpty");
  if (el) el.style.display = "none";
}

function renderSoSaldoKemarinUI() {
  const listEl = document.getElementById("soSaldoKemarinList");
  if (!listEl) return;
  listEl.innerHTML = SO_VARIAN.map(v => `
    <div class="so-saldo-kemarin-item">
      <span class="so-saldo-varian">${v}:</span>
      <span class="so-saldo-value" data-varian="${v}">-</span>
    </div>
  `).join("");
}
function getBulanKemarinKey() {
  const d = new Date(soTahun, soBulan, 1);
  d.setMonth(d.getMonth() - 1);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}
async function renderSoSaldoKemarinForm() {
  const body = document.getElementById("soPopupSaldoKemarinBody");
  const dateEl = document.getElementById("soPopupSaldoKemarinDate");
  if (!body) return;

  const bulanKey = getBulanKemarinKey();
  const bulanNama = ["Januari","Februari","Maret","April","Mei","Juni","Juli","Agustus","September","Oktober","November","Desember"];
  const [ky, km] = bulanKey.split("-").map(Number);
  if (dateEl) dateEl.textContent = `${bulanNama[km-1]} ${ky}`;

  body.innerHTML = `<div class="dh-ringkasan-empty">Memuat...</div>`;

  let existingSaldo = {};
  try {
    const adminUid = window.auth?.currentUser?.uid;
    const snap = await window.getDoc(
      window.doc(window.db, "users", adminUid, "saldoBulanKemarin", bulanKey)
    );
    if (snap.exists()) existingSaldo = snap.data()?.saldo || {};
  } catch (err) {
    console.error("❌ renderSoSaldoKemarinForm:", err);
  }

  body.innerHTML = `
    <div class="so-form-group">
      <div class="so-form-label">Saldo (${bulanNama[km-1]} ${ky})</div>
      <div class="so-form-grid">
        ${SO_VARIAN.map(v => `
          <input type="number" min="0" class="so-input-varian" data-varian="${v}" placeholder="${v}" value="${existingSaldo[v] ?? ""}">
        `).join("")}
      </div>
    </div>
    <div style="margin-top:8px">
      <button class="so-popup-save-btn" id="soSaldoKemarinSaveBtn">Simpan</button>
    </div>
  `;

  document.getElementById("soSaldoKemarinSaveBtn")?.addEventListener("click", simpanSoSaldoKemarin);
}
async function simpanSoSaldoKemarin() {
  const btn = document.getElementById("soSaldoKemarinSaveBtn");
  if (!btn) return;
  btn.disabled = true;
  btn.textContent = "Menyimpan...";

  try {
    const adminUid = window.auth?.currentUser?.uid;
    const bulanKey = getBulanKemarinKey();

    const saldo = {};
    document.querySelectorAll('#soPopupSaldoKemarinBody .so-input-varian').forEach(inp => {
      const val = Number(inp.value);
      if (!isNaN(val) && val > 0) saldo[inp.dataset.varian] = val;
    });

    const ref = window.doc(window.db, "users", adminUid, "saldoBulanKemarin", bulanKey);
    await window.setDoc(ref, {
      bulan: bulanKey,
      saldo,
      updatedAt: window.serverTimestamp(),
    }, { merge: true });

    window.showToast("Saldo bulan kemarin tersimpan", "success");
    closeSoPopup("soPopupSaldoKemarinOverlay");
    await loadSoSaldoKemarinDisplay();
  } catch (err) {
    console.error("❌ simpanSoSaldoKemarin:", err);
    window.showToast("Gagal menyimpan", "error");
  } finally {
    btn.disabled = false;
    btn.textContent = "Simpan";
  }
}
async function loadSoSaldoKemarinDisplay() {
  const bulanKey = getBulanKemarinKey();
  try {
    const adminUid = window.auth?.currentUser?.uid;
    const snap = await window.getDoc(
      window.doc(window.db, "users", adminUid, "saldoBulanKemarin", bulanKey)
    );
    const saldo = snap.exists() ? (snap.data()?.saldo || {}) : {};
    SO_VARIAN.forEach(v => {
      const el = document.querySelector(`#soSaldoKemarinList .so-saldo-value[data-varian="${v}"]`);
      if (el) el.textContent = saldo[v] ?? "-";
    });
  } catch (err) {
    console.error("❌ loadSoSaldoKemarinDisplay:", err);
  }
}

/* ── CANVAS DRAW ── */
function drawSoTable() {
  if (!soCtx || !soCanvas) return;
  const wrap = document.getElementById("soTableWrap");
  const rect = wrap.getBoundingClientRect();
  const W = rect.width, H = rect.height;

  soCtx.clearRect(0, 0, W, H);
  soCtx.fillStyle = "#ffffff";
  soCtx.fillRect(0, 0, W, H);
  soCtx.textBaseline = "middle";

  const filteredData = soSearchQuery
    ? soData.filter(r => (r.tanggal||"").toLowerCase().includes(soSearchQuery))
    : soData;

  const visibleRows = Math.ceil((H - SO_HEADER_HEIGHT) / SO_ROW_HEIGHT) + 1;
  const startRow = Math.floor(soScrollY / SO_ROW_HEIGHT);
  const totalRowY = H - SO_ROW_HEIGHT;

  const saldoCols = SO_COLUMNS.filter(c => c.group === "saldo");
  const saldoTotalWidth = saldoCols.reduce((a,c) => a + c.width, 0);
  const saldoStartX = W - saldoTotalWidth;

  // ── BODY ROWS (kolom normal, skip saldo) ──
  soCtx.font = "700 11px Poppins, sans-serif";
  for (let i = 0; i < visibleRows; i++) {
    const rowIndex = startRow + i;
    if (rowIndex >= filteredData.length) break;
    const row = filteredData[rowIndex];
    const y = SO_HEADER_HEIGHT + (rowIndex * SO_ROW_HEIGHT) - soScrollY;
    if (y + SO_ROW_HEIGHT < SO_HEADER_HEIGHT || y > totalRowY) continue;

    const isWeekTotal = row._isWeekTotal;
    let cx = -soScrollX;
    SO_COLUMNS.forEach(col => {
      if (col.group === "saldo") { cx += col.width; return; }
      if (cx + col.width > 0 && cx < W) {
        let bg;
        if (isWeekTotal) {
          bg = "#ffe9b3";
        } else if (soHoverRow === rowIndex) {
          bg = col.group ? hexToRgba(col.groupColor, 0.25) : "#e8e4d8";
        } else {
          bg = col.group ? hexToRgba(col.groupColor, 0.08) : (rowIndex % 2 === 0 ? "#ffffff" : "#f7f5f0");
        }
        soCtx.fillStyle = bg;
        soCtx.fillRect(cx, y, col.width, SO_ROW_HEIGHT);
        soCtx.strokeStyle = "rgba(0,0,0,0.12)";
        soCtx.strokeRect(cx, y, col.width, SO_ROW_HEIGHT);
        soCtx.fillStyle = isWeekTotal ? "#8a5a00" : (col.group ? col.groupColor : "#2b2b2b");
        soCtx.font = isWeekTotal ? "800 11px Poppins, sans-serif" : "700 11px Poppins, sans-serif";
        const rawVal = row[col.key];
        const val = (rawVal === 0 || rawVal === "" || rawVal == null) ? "" : rawVal;
        soCtx.textAlign = "center";
        soCtx.fillText(String(val), cx + col.width/2, y + SO_ROW_HEIGHT / 2);
        soCtx.textAlign = "left";
      }
      cx += col.width;
    });
  }
  

  // ── BODY ROWS — kolom saldo sticky di kanan ──
  if (saldoCols.length) {
    for (let i = 0; i < visibleRows; i++) {
      const rowIndex = startRow + i;
      if (rowIndex >= filteredData.length) break;
      const row = filteredData[rowIndex];
      const y = SO_HEADER_HEIGHT + (rowIndex * SO_ROW_HEIGHT) - soScrollY;
      if (y + SO_ROW_HEIGHT < SO_HEADER_HEIGHT || y > totalRowY) continue;

      let sx = saldoStartX;
      saldoCols.forEach(col => {
        soCtx.fillStyle = row._isWeekTotal ? "#cc8800" : col.groupColor;
        soCtx.fillRect(sx, y, col.width, SO_ROW_HEIGHT);
        soCtx.strokeStyle = "rgba(0,0,0,0.12)";
        soCtx.strokeRect(sx, y, col.width, SO_ROW_HEIGHT);
        soCtx.fillStyle = "#ffffff";
        const rawVal = row[col.key];
        const val = (rawVal === 0 || rawVal === "" || rawVal == null) ? "" : rawVal;
        soCtx.textAlign = "center";
        soCtx.fillText(String(val), sx + col.width/2, y + SO_ROW_HEIGHT / 2);
        soCtx.textAlign = "left";
        sx += col.width;
      });
    }
  }

  // ── TOTAL ROW (kolom normal, skip saldo) ──
  soCtx.fillStyle = "#222222";
  soCtx.fillRect(0, totalRowY, W, SO_ROW_HEIGHT);

  let tx = -soScrollX;
  const mergeWidth = SO_STATIC_COLUMNS[0].width + SO_STATIC_COLUMNS[1].width + SO_STATIC_COLUMNS[2].width;
  if (tx + mergeWidth > 0 && tx < W) {
    soCtx.strokeStyle = "rgba(255,255,255,0.2)";
    soCtx.strokeRect(tx, totalRowY, mergeWidth, SO_ROW_HEIGHT);
    soCtx.fillStyle = "#ffffff";
    soCtx.font = "700 11px Poppins, sans-serif";
    soCtx.textAlign = "center";
    soCtx.fillText("Total", tx + mergeWidth/2, totalRowY + SO_ROW_HEIGHT / 2);
    soCtx.textAlign = "left";
  }
  tx += mergeWidth;
  for (let ti = 3; ti < SO_COLUMNS.length; ti++) {
    const col = SO_COLUMNS[ti];
    if (col.group === "saldo") { tx += col.width; continue; }
    if (tx + col.width > 0 && tx < W) {
      let total = 0;
      filteredData.filter(r => !r._isWeekTotal).forEach(r => { total += Number(r[col.key]) || 0; });
      const bgColor = col.group ? col.groupColor : "#444444";
      soCtx.fillStyle = bgColor;
      soCtx.fillRect(tx, totalRowY, col.width, SO_ROW_HEIGHT);
      soCtx.strokeStyle = "rgba(255,255,255,0.2)";
      soCtx.strokeRect(tx, totalRowY, col.width, SO_ROW_HEIGHT);
      soCtx.fillStyle = "#ffffff";
      soCtx.font = "700 11px Poppins, sans-serif";
      soCtx.textAlign = "center";
      soCtx.fillText(String(total || ""), tx + col.width/2, totalRowY + SO_ROW_HEIGHT / 2);
      soCtx.textAlign = "left";
    }
    tx += col.width;
  }
  // ── TOTAL ROW — kolom saldo sticky di kanan ──
  if (saldoCols.length) {
    let stx = saldoStartX;
    saldoCols.forEach(col => {
      let total = 0;
      filteredData.filter(r => !r._isWeekTotal).forEach(r => { total += Number(r[col.key]) || 0; });
      soCtx.fillStyle = col.groupColor;
      soCtx.fillRect(stx, totalRowY, col.width, SO_ROW_HEIGHT);
      soCtx.strokeStyle = "rgba(255,255,255,0.2)";
      soCtx.strokeRect(stx, totalRowY, col.width, SO_ROW_HEIGHT);
      soCtx.fillStyle = "#ffffff";
      soCtx.font = "700 11px Poppins, sans-serif";
      soCtx.textAlign = "center";
      soCtx.fillText(String(total || ""), stx + col.width/2, totalRowY + SO_ROW_HEIGHT / 2);
      soCtx.textAlign = "left";
      stx += col.width;
    });
  }
  // ── HEADER ROW (group + static, skip saldo) ──
  let x = -soScrollX;
  let gi = 0;
  while (gi < SO_COLUMNS.length) {
    if (SO_COLUMNS[gi].group === "saldo") { x += SO_COLUMNS[gi].width; gi++; continue; }
    const col = SO_COLUMNS[gi];
    if (!col.group) {
      if (x + col.width > 0 && x < W) {
        soCtx.fillStyle = "#222222";
        soCtx.fillRect(x, 0, col.width, SO_HEADER_HEIGHT);
        soCtx.strokeStyle = "rgba(255,255,255,0.15)";
        soCtx.strokeRect(x, 0, col.width, SO_HEADER_HEIGHT);
        soCtx.fillStyle = "#ffffff";
        soCtx.font = "700 11px Poppins, sans-serif";
        soCtx.textAlign = "center";
        soCtx.fillText(col.label, x + col.width/2, SO_HEADER_HEIGHT / 2);
        soCtx.textAlign = "left";
      }
      x += col.width;
      gi++;
    } else {
      const groupKey = col.group;
      let groupWidth = 0;
      let j = gi;
      while (j < SO_COLUMNS.length && SO_COLUMNS[j].group === groupKey) {
        groupWidth += SO_COLUMNS[j].width; j++;
      }
      if (x + groupWidth > 0 && x < W) {
        soCtx.fillStyle = col.groupColor;
        soCtx.fillRect(x, 0, groupWidth, SO_HEADER_HEIGHT_GROUP);
        soCtx.strokeStyle = "rgba(255,255,255,0.2)";
        soCtx.strokeRect(x, 0, groupWidth, SO_HEADER_HEIGHT_GROUP);
        soCtx.fillStyle = "#ffffff";
        soCtx.font = "700 10px Poppins, sans-serif";
        soCtx.textAlign = "center";
        soCtx.fillText(col.groupLabel, x + groupWidth/2, SO_HEADER_HEIGHT_GROUP / 2);

        let sx = x;
        for (let k = gi; k < j; k++) {
          const subCol = SO_COLUMNS[k];
          soCtx.fillStyle = hexToRgba(col.groupColor, 0.85);
          soCtx.fillRect(sx, SO_HEADER_HEIGHT_GROUP, subCol.width, SO_HEADER_HEIGHT_SUB);
          soCtx.strokeStyle = "rgba(255,255,255,0.2)";
          soCtx.strokeRect(sx, SO_HEADER_HEIGHT_GROUP, subCol.width, SO_HEADER_HEIGHT_SUB);
          soCtx.fillStyle = "#ffffff";
          soCtx.fillText(subCol.label, sx + subCol.width/2, SO_HEADER_HEIGHT_GROUP + SO_HEADER_HEIGHT_SUB/2);
          sx += subCol.width;
        }
        soCtx.textAlign = "left";
      }
      x += groupWidth;
      gi = j;
    }
  }
  // ── HEADER — kolom saldo sticky di kanan ──
  if (saldoCols.length) {
    soCtx.fillStyle = saldoCols[0].groupColor;
    soCtx.fillRect(saldoStartX, 0, saldoTotalWidth, SO_HEADER_HEIGHT_GROUP);
    soCtx.strokeStyle = "rgba(255,255,255,0.2)";
    soCtx.strokeRect(saldoStartX, 0, saldoTotalWidth, SO_HEADER_HEIGHT_GROUP);
    soCtx.fillStyle = "#ffffff";
    soCtx.font = "700 10px Poppins, sans-serif";
    soCtx.textAlign = "center";
    soCtx.fillText(saldoCols[0].groupLabel, saldoStartX + saldoTotalWidth/2, SO_HEADER_HEIGHT_GROUP/2);

    let shx = saldoStartX;
    saldoCols.forEach(col => {
      soCtx.fillStyle = hexToRgba(col.groupColor, 0.85);
      soCtx.fillRect(shx, SO_HEADER_HEIGHT_GROUP, col.width, SO_HEADER_HEIGHT_SUB);
      soCtx.strokeStyle = "rgba(255,255,255,0.2)";
      soCtx.strokeRect(shx, SO_HEADER_HEIGHT_GROUP, col.width, SO_HEADER_HEIGHT_SUB);
      soCtx.fillStyle = "#ffffff";
      soCtx.fillText(col.label, shx + col.width/2, SO_HEADER_HEIGHT_GROUP + SO_HEADER_HEIGHT_SUB/2);
      shx += col.width;
    });
    soCtx.textAlign = "left";
  }
}

function hexToRgba(hex, alpha) {
  const r = parseInt(hex.slice(1,3), 16);
  const g = parseInt(hex.slice(3,5), 16);
  const b = parseInt(hex.slice(5,7), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

/* ── CANVAS INTERACTION (drag scroll) ── */
function initSoCanvasInteraction() {
  let isDown = false, startX = 0, startY = 0, startScrollX = 0, startScrollY = 0;
  soCanvas.addEventListener("mousedown", e => {
    isDown = true;
    soCanvas.classList.add("dragging");
    startX = e.clientX; startY = e.clientY;
    startScrollX = soScrollX; startScrollY = soScrollY;
  });
  document.addEventListener("mouseup", () => { isDown = false; soCanvas?.classList.remove("dragging"); });
  document.addEventListener("mousemove", e => {
    if (isDown) {
      soScrollX = clampSoScrollX(startScrollX - (e.clientX - startX));
      soScrollY = clampSoScrollY(startScrollY - (e.clientY - startY));
      drawSoTable();
      return;
    }
    // hover detect
    const wrap = document.getElementById("soTableWrap");
    if (!wrap) return;
    const rect = wrap.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;
    if (mx < 0 || my < SO_HEADER_HEIGHT || my > rect.height - SO_ROW_HEIGHT || mx > rect.width) {
      if (soHoverRow !== -1) { soHoverRow = -1; drawSoTable(); }
      return;
    }
    const rowIndex = Math.floor((my - SO_HEADER_HEIGHT + soScrollY) / SO_ROW_HEIGHT);
    if (rowIndex !== soHoverRow) {
      soHoverRow = rowIndex;
      drawSoTable();
    }
  });
  soCanvas.addEventListener("mouseleave", () => {
    if (soHoverRow !== -1) { soHoverRow = -1; drawSoTable(); }
  });
  soCanvas.addEventListener("wheel", e => {
    e.preventDefault();
    soScrollY = clampSoScrollY(soScrollY + e.deltaY);
    soScrollX = clampSoScrollX(soScrollX + e.deltaX);
    drawSoTable();
  }, { passive: false });
  // touch support
  soCanvas.addEventListener("touchstart", e => {
    if (e.touches.length !== 1) return;
    isDown = true;
    startX = e.touches[0].clientX; startY = e.touches[0].clientY;
    startScrollX = soScrollX; startScrollY = soScrollY;
  }, { passive: true });
  soCanvas.addEventListener("touchmove", e => {
    if (!isDown || e.touches.length !== 1) return;
    e.preventDefault();
    soScrollX = clampSoScrollX(startScrollX - (e.touches[0].clientX - startX));
    soScrollY = clampSoScrollY(startScrollY - (e.touches[0].clientY - startY));
    drawSoTable();
  }, { passive: false });
  soCanvas.addEventListener("touchend", () => { isDown = false; });
  soCanvas.addEventListener("touchcancel", () => { isDown = false; });
}
function clampSoScrollX(val) {
  const wrap = document.getElementById("soTableWrap");
  if (!wrap) return Math.max(0, val);
  const W = wrap.getBoundingClientRect().width;
  const totalContentWidth = SO_COLUMNS.reduce((a, c) => a + c.width, 0);
  const maxScroll = Math.max(0, totalContentWidth - W);
  return Math.min(Math.max(0, val), maxScroll);
}
function clampSoScrollY(val) {
  const wrap = document.getElementById("soTableWrap");
  if (!wrap) return Math.max(0, val);
  const H = wrap.getBoundingClientRect().height;
  const filteredData = soSearchQuery
    ? soData.filter(r => (r.tanggal||"").toLowerCase().includes(soSearchQuery))
    : soData;
  const totalContentHeight = filteredData.length * SO_ROW_HEIGHT;
  const maxScroll = Math.max(0, totalContentHeight - (H - SO_HEADER_HEIGHT));
  return Math.min(Math.max(0, val), maxScroll);
}
