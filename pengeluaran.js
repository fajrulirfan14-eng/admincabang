const PENG_JENIS_COLOR = {
  variable: 1,
  fixed: 0.6,
  marginal: 0.3,
};

let pengData = [];
let pengFilterKategori = "semua";
let pengFilterJenis = "semua";
let pengSearchQuery = "";

const PENG_BULAN_NAMA = ["Januari","Februari","Maret","April","Mei","Juni","Juli","Agustus","September","Oktober","November","Desember"];
let pengPeriodeMode = "bulan"; // "bulan" | "custom"
let pengBulan = new Date().getMonth();
let pengTahun = new Date().getFullYear();
let pengCustomFrom = "";
let pengCustomTo = "";

function getPengTanggalHariIni() {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

window.initPengeluaranView = async function() {
  document.getElementById("pengInputTanggal").value = getPengTanggalHariIni();

  initPengFilters();
  initPengPeriodeFilter();
  initPengPopup();
  await loadPengData();
};

function getPengPeriodeRange() {
  if (pengPeriodeMode === "custom" && pengCustomFrom && pengCustomTo) {
    return { start: pengCustomFrom, end: pengCustomTo };
  }
  const start = `${pengTahun}-${String(pengBulan+1).padStart(2,"0")}-01`;
  const totalHari = new Date(pengTahun, pengBulan+1, 0).getDate();
  const end = `${pengTahun}-${String(pengBulan+1).padStart(2,"0")}-${String(totalHari).padStart(2,"0")}`;
  return { start, end };
}

function setupPengMiniSelect(btnId, ddId, labelId, options, currentVal, onSelect) {
  const btn = document.getElementById(btnId);
  const dd = document.getElementById(ddId);
  const label = document.getElementById(labelId);

  dd.innerHTML = options.map(o => `
    <div class="peng-mini-select-option ${o.value === currentVal ? "selected" : ""}" data-val="${o.value}">${o.text}</div>
  `).join("");

  const current = options.find(o => o.value === currentVal);
  if (current) label.textContent = current.text;

  btn.onclick = e => {
    e.stopPropagation();
    document.querySelectorAll(".peng-mini-select-dropdown.open").forEach(el => {
      if (el !== dd) el.classList.remove("open");
    });
    dd.classList.toggle("open");
  };

  dd.querySelectorAll(".peng-mini-select-option").forEach(opt => {
    opt.onclick = e => {
      e.stopPropagation();
      dd.querySelectorAll(".peng-mini-select-option").forEach(o => o.classList.remove("selected"));
      opt.classList.add("selected");
      label.textContent = opt.textContent;
      dd.classList.remove("open");
      onSelect(opt.dataset.val);
    };
  });
}

function initPengPeriodeFilter() {
  const btn = document.getElementById("pengPeriodeBtn");
  const dd = document.getElementById("pengPeriodeDropdown");
  const label = document.getElementById("pengPeriodeLabel");
  const bulanBox = document.getElementById("pengPeriodeBulanBox");
  const customBox = document.getElementById("pengPeriodeCustomBox");
  const inputFrom = document.getElementById("pengCustomFrom");
  const inputTo = document.getElementById("pengCustomTo");

  let selectedBulan = pengBulan;
  let selectedTahun = pengTahun;

  const bulanOptions = PENG_BULAN_NAMA.map((n,i) => ({ value: String(i), text: n }));
  setupPengMiniSelect("pengBulanMiniBtn", "pengBulanMiniDropdown", "pengBulanMiniLabel", bulanOptions, String(pengBulan), val => {
    selectedBulan = Number(val);
  });

  const nowY = new Date().getFullYear();
  const tahunOptions = [nowY-1, nowY, nowY+1].map(y => ({ value: String(y), text: String(y) }));
  setupPengMiniSelect("pengTahunMiniBtn", "pengTahunMiniDropdown", "pengTahunMiniLabel", tahunOptions, String(pengTahun), val => {
    selectedTahun = Number(val);
  });

  btn.onclick = e => { e.stopPropagation(); dd.classList.toggle("open"); };
  document.addEventListener("click", () => {
    dd.classList.remove("open");
    document.querySelectorAll(".peng-mini-select-dropdown.open").forEach(el => el.classList.remove("open"));
  });
  dd.addEventListener("click", e => e.stopPropagation());

  dd.querySelectorAll(".peng-periode-tab").forEach(tab => {
    tab.onclick = () => {
      dd.querySelectorAll(".peng-periode-tab").forEach(t => t.classList.remove("active"));
      tab.classList.add("active");
      const mode = tab.dataset.mode;
      bulanBox.style.display = mode === "bulan" ? "flex" : "none";
      customBox.style.display = mode === "custom" ? "flex" : "none";
    };
  });

  document.getElementById("pengPeriodeApply").onclick = async () => {
    const activeTab = dd.querySelector(".peng-periode-tab.active").dataset.mode;
    pengPeriodeMode = activeTab;

    if (activeTab === "bulan") {
      pengBulan = selectedBulan;
      pengTahun = selectedTahun;
      label.textContent = `${PENG_BULAN_NAMA[pengBulan]} ${pengTahun}`;
    } else {
      if (!inputFrom.value || !inputTo.value) {
        window.showToast?.("Pilih tanggal dari dan sampai", "error");
        return;
      }
      pengCustomFrom = inputFrom.value;
      pengCustomTo = inputTo.value;
      const fmt = d => new Date(d + "T00:00:00").toLocaleDateString("id-ID", { day:"numeric", month:"short" });
      label.textContent = `${fmt(pengCustomFrom)} - ${fmt(pengCustomTo)}`;
    }

    dd.classList.remove("open");
    await loadPengData();
  };
}

async function loadPengData() {
  const listEl = document.getElementById("pengList");
  if (listEl) listEl.innerHTML = `<div class="peng-empty">Memuat...</div>`;

  try {
    const adminUid = window.auth?.currentUser?.uid;
    if (!adminUid) return;

    const { start, end } = getPengPeriodeRange();

    const snap = await window.getDocs(
      window.query(
        window.collection(window.db, "users", adminUid, "pengeluaran"),
        window.where("tanggal", ">=", start),
        window.where("tanggal", "<=", end)
      )
    );
    const flat = [];
    snap.forEach(docSnap => {
      const data = docSnap.data();
      const tanggal = data.tanggal || docSnap.id;

      ["produksi", "distribusi"].forEach(kategori => {
        (data[kategori] || []).forEach((item, i) => {
          flat.push({
            id: `${docSnap.id}_${kategori}_${i}`,
            kategori,
            jenis: item.jenis,
            nama: item.nama,
            qty: item.qty,
            harga: item.harga,
            nominal: item.nominal,
            catatan: item.catatan,
            tanggal: item.waktu || `${tanggal}T00:00:00`,
          });
        });
      });
    });

    pengData = flat;
    renderPengSummary();
    renderPengList();
  } catch (err) {
    console.error("❌ loadPengData:", err);
    if (listEl) listEl.innerHTML = `<div class="peng-empty">Gagal memuat data</div>`;
  }
}

function fmtRupiah(n) {
  return "Rp" + Number(n || 0).toLocaleString("id-ID");
}

function renderPengSummary() {
  ["distribusi", "produksi"].forEach(kategori => {
    const items = pengData.filter(x => x.kategori === kategori);
    const byJenis = { variable: 0, fixed: 0, marginal: 0 };
    items.forEach(x => byJenis[x.jenis] += Number(x.nominal || 0));
    const total = byJenis.variable + byJenis.fixed + byJenis.marginal;

    const label = kategori === "distribusi" ? "Distribusi" : "Produksi";
    document.getElementById(`pengTotal${label}`).textContent = fmtRupiah(total);

    const barEl = document.getElementById(`pengBar${label}`);
    const legendEl = document.getElementById(`pengLegend${label}`);
    const accent = kategori === "distribusi" ? "#3f7a8c" : "#c9744f";

    if (total === 0) {
      barEl.innerHTML = `<span style="width:100%;background:rgba(0,0,0,0.06)"></span>`;
    } else {
      barEl.innerHTML = ["variable","fixed","marginal"].map(j => {
        const pct = (byJenis[j] / total) * 100;
        const alpha = PENG_JENIS_COLOR[j];
        return `<span style="width:${pct}%;background:${hexA(accent, alpha)}"></span>`;
      }).join("");
    }

    legendEl.innerHTML = ["variable","fixed","marginal"].map(j => `
      <div class="peng-legend-item">
        <span class="peng-legend-dot" style="background:${hexA(accent, PENG_JENIS_COLOR[j])}"></span>
        ${j.charAt(0).toUpperCase()+j.slice(1)}: ${fmtRupiah(byJenis[j])}
      </div>
    `).join("");
  });
}

function hexA(hex, alpha) {
  const r = parseInt(hex.slice(1,3),16), g = parseInt(hex.slice(3,5),16), b = parseInt(hex.slice(5,7),16);
  return `rgba(${r},${g},${b},${alpha})`;
}

function renderPengList() {
  const listEl = document.getElementById("pengList");
  const emptyEl = document.getElementById("pengEmpty");

  let filtered = [...pengData].sort((a,b) => new Date(b.tanggal) - new Date(a.tanggal));

  if (pengFilterKategori !== "semua") filtered = filtered.filter(x => x.kategori === pengFilterKategori);
  if (pengFilterJenis !== "semua") filtered = filtered.filter(x => x.jenis === pengFilterJenis);
  if (pengSearchQuery) filtered = filtered.filter(x => x.nama.toLowerCase().includes(pengSearchQuery));

  if (!filtered.length) {
    listEl.innerHTML = "";
    emptyEl.style.display = "block";
    return;
  }
  emptyEl.style.display = "none";

  listEl.innerHTML = filtered.map(x => {
    const tgl = new Date(x.tanggal);
    const tglStr = tgl.toLocaleDateString("id-ID", { day:"numeric", month:"long", year:"numeric" });
    const jamStr = tgl.toLocaleTimeString("id-ID", { hour:"2-digit", minute:"2-digit" });
    return `
      <div class="peng-item" data-kategori="${x.kategori}">
        <div class="peng-item-top">
          <div class="peng-item-badges">
            <span class="peng-badge-kategori">${x.kategori}</span>
            <span class="peng-badge-jenis">${x.jenis}</span>
          </div>
          <div class="peng-item-nominal">-${fmtRupiah(x.nominal)}</div>
        </div>
        <div class="peng-item-nama">${x.nama}</div>
        <div class="peng-item-meta">${tglStr}, ${jamStr}${x.qty ? ` · ${x.qty} × ${fmtRupiah(x.harga)}` : ""}</div>
        ${x.catatan ? `<div class="peng-item-catatan">"${x.catatan}"</div>` : ""}
      </div>
    `;
  }).join("");
}

function initPengFilters() {
  document.getElementById("pengSearchInput").oninput = function() {
    pengSearchQuery = this.value.toLowerCase().trim();
    renderPengList();
  };

  setupPengDropdown("pengKategoriBtn", "pengKategoriDropdown", "pengKategoriLabel", val => {
    pengFilterKategori = val;
    renderPengList();
  });

  setupPengDropdown("pengJenisBtn", "pengJenisDropdown", "pengJenisLabel", val => {
    pengFilterJenis = val;
    renderPengList();
  });
}

function setupPengDropdown(btnId, ddId, labelId, onSelect) {
  const btn = document.getElementById(btnId);
  const dd = document.getElementById(ddId);
  const label = document.getElementById(labelId);

  btn.onclick = e => { e.stopPropagation(); dd.classList.toggle("open"); };

  dd.querySelectorAll(".peng-filter-option").forEach(opt => {
    opt.onclick = () => {
      dd.querySelectorAll(".peng-filter-option").forEach(o => o.classList.remove("selected"));
      opt.classList.add("selected");
      label.textContent = opt.textContent;
      dd.classList.remove("open");
      onSelect(opt.dataset.val);
    };
  });

  document.addEventListener("click", () => dd.classList.remove("open"));
}

async function loadPengKantorItems(kategori, jenis) {
  if (jenis === "marginal") return [];
  try {
    if (!window.idb || typeof window.idb.getKantorCabang !== "function") {
      console.error("❌ loadPengKantorItems: window.idb.getKantorCabang tidak tersedia. Pastikan indexdb.js sudah di-load sebelum pengeluaran.js.");
      return [];
    }
    const kantorRaw = await window.idb.getKantorCabang();
    const kantorData = kantorRaw?.data || kantorRaw || {};
    const fieldName = kategori === "produksi" ? "pengeluaran" : "pengeluaranDistribusi";
    const src = kantorData?.[fieldName] || {};

    if (jenis === "fixed") {
      const list = Array.isArray(src.fix) ? src.fix : [];
      return list.map(nama => ({ nama, harga: "" }));
    }
    if (jenis === "variable") {
      const list = Array.isArray(src.variable) ? src.variable : [];
      return list.map(item => ({ nama: item.jenis || "-", harga: item.harga ?? "" }));
    }
    return [];
  } catch (err) {
    console.error("❌ loadPengKantorItems:", err);
    return [];
  }
}
function renderPengItemRow(nama, hargaSatuan, isPreset, existing) {
  if (isPreset) {
    if (existing) {
      const qty = Number(existing.qty) || 0;
      const hs = Number(existing.harga) || 0;
      return `
        <div class="peng-item-row peng-item-row-saved" data-preset="true" data-nama="${nama}" data-harga-satuan="${hs}">
          <div class="peng-item-nama-label">${nama} <span class="peng-item-saved-badge">Tersimpan</span></div>
          <input type="number" min="0" class="peng-item-qty-input" value="${qty}">
          <input type="number" min="0" class="peng-item-harga-input" value="${hs}">
          <div class="peng-item-total-label">${fmtRupiah(qty * hs)}</div>
        </div>
      `;
    }
    return `
      <div class="peng-item-row" data-preset="true" data-nama="${nama}" data-harga-satuan="${Number(hargaSatuan)||0}">
        <div class="peng-item-nama-label">${nama}</div>
        <input type="number" min="0" class="peng-item-qty-input" placeholder="0">
        <input type="number" min="0" class="peng-item-harga-input" value="${Number(hargaSatuan)||""}" placeholder="0">
        <div class="peng-item-total-label">Rp0</div>
      </div>
    `;
  }
  return `
    <div class="peng-item-row" data-preset="false">
      <input type="text" class="peng-item-nama-input" placeholder="Nama item">
      <input type="number" min="0" class="peng-item-qty-input" placeholder="0">
      <input type="number" min="0" class="peng-item-harga-input" placeholder="0">
      <div class="peng-item-total-label">Rp0</div>
      <button type="button" class="peng-item-remove-btn"><i class="fa-solid fa-xmark"></i></button>
    </div>
  `;
}
function attachPengRemoveHandlers() {
  document.querySelectorAll("#pengItemList .peng-item-remove-btn").forEach(btn => {
    btn.onclick = () => btn.closest(".peng-item-row").remove();
  });
}

function attachPengNominalListeners() {
  document.querySelectorAll("#pengItemList .peng-item-row").forEach(row => {
    const qtyInput = row.querySelector(".peng-item-qty-input");
    const hargaInput = row.querySelector(".peng-item-harga-input");
    const totalEl = row.querySelector(".peng-item-total-label");
    if (!qtyInput || !hargaInput || !totalEl) return;

    const updateTotal = () => {
      const qty = Number(qtyInput.value) || 0;
      const harga = Number(hargaInput.value) || 0;
      totalEl.textContent = fmtRupiah(qty * harga);
    };

    qtyInput.oninput = updateTotal;
    hargaInput.oninput = updateTotal;
    updateTotal();
  });
}
let pengExistingDocCache = { tanggal: null, data: null };

async function loadPengExistingDoc(tanggal) {
  if (pengExistingDocCache.tanggal === tanggal) {
    return pengExistingDocCache.data;
  }
  try {
    const adminUid = window.auth?.currentUser?.uid;
    if (!adminUid || !tanggal) return {};

    const ref = window.doc(window.db, "users", adminUid, "pengeluaran", tanggal);
    const snap = await window.getDoc(ref);
    const data = snap.exists() ? snap.data() : {};

    pengExistingDocCache = { tanggal, data };
    return data;
  } catch (err) {
    console.error("❌ loadPengExistingDoc:", err);
    return {};
  }
}
async function loadPengExistingItems(kategori, jenis) {
  const tanggal = document.getElementById("pengInputTanggal")?.value;
  if (!tanggal) return [];
  const data = await loadPengExistingDoc(tanggal);
  const arr = data?.[kategori] || [];
  return arr.filter(item => item.jenis === jenis);
}
async function refreshPengItemList(kategori, jenis) {
  const listEl = document.getElementById("pengItemList");

  // fade out dulu sebelum ganti isi
  listEl.classList.remove("peng-item-anim");
  listEl.style.opacity = "0.4";
  listEl.style.transform = "translateY(4px)";
  listEl.style.transition = "opacity 0.15s ease, transform 0.15s ease";

  const [presets, existingItems] = await Promise.all([
    loadPengKantorItems(kategori, jenis),
    loadPengExistingItems(kategori, jenis),
  ]);

  const findExisting = nama => existingItems.find(e => e.nama === nama);

  let html = "";

  if (!presets.length && jenis === "marginal") {
    html += `<div class="peng-item-empty">Tambahkan item secara manual</div>`;
  } else if (!presets.length) {
    html += `<div class="peng-item-empty">Belum ada data item untuk kantor cabang ini</div>`;
  } else {
    html += presets.map(p => renderPengItemRow(p.nama, p.harga, true, findExisting(p.nama))).join("");
  }

  // item manual yang sudah tersimpan tapi bukan bagian dari preset kantor
  const presetNames = new Set(presets.map(p => p.nama));
  const manualExisting = existingItems.filter(e => !presetNames.has(e.nama));
  html += manualExisting.map(e => renderPengItemRow(e.nama, e.harga, true, e)).join("");

  listEl.innerHTML = html;
  attachPengRemoveHandlers();
  attachPengNominalListeners();

  // fade in
  requestAnimationFrame(() => {
    listEl.style.opacity = "1";
    listEl.style.transform = "translateY(0)";
  });
}
function initPengPopup() {
  const overlay = document.getElementById("pengPopupOverlay");
  const box = document.getElementById("pengPopupBox");

  let selectedKategori = "produksi";
  let selectedJenis = "variable";

  document.getElementById("pengAddBtn").onclick = () => {
    overlay.classList.add("show");
    refreshPengItemList(selectedKategori, selectedJenis);
  };
  document.getElementById("pengInputTanggal").onchange = () => {
    refreshPengItemList(selectedKategori, selectedJenis);
  };
  document.getElementById("pengPopupClose").onclick = closePengPopup;
  overlay.addEventListener("click", e => { if (e.target === overlay) closePengPopup(); });

  function closePengPopup() {
    overlay.classList.remove("show");
  }

  document.querySelectorAll("#pengToggleKategori .peng-toggle-btn").forEach(btn => {
    btn.onclick = () => {
      document.querySelectorAll("#pengToggleKategori .peng-toggle-btn").forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      selectedKategori = btn.dataset.val;
      refreshPengItemList(selectedKategori, selectedJenis);
    };
  });

  document.querySelectorAll("#pengToggleJenis .peng-toggle-btn").forEach(btn => {
    btn.onclick = () => {
      document.querySelectorAll("#pengToggleJenis .peng-toggle-btn").forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      selectedJenis = btn.dataset.val;
      refreshPengItemList(selectedKategori, selectedJenis);
    };
  });

  document.getElementById("pengAddItemBtn").onclick = () => {
    const listEl = document.getElementById("pengItemList");
    const emptyMsg = listEl.querySelector(".peng-item-empty");
    if (emptyMsg) emptyMsg.remove();
    listEl.insertAdjacentHTML("beforeend", renderPengItemRow("", "", false));
    attachPengRemoveHandlers();
    attachPengNominalListeners();
  };

  document.getElementById("pengSubmitBtn").onclick = () => {
    savePengSubmit(selectedKategori, selectedJenis);
  };

  // swipe close
  let startY = 0, curY = 0, dragging = false;
  box.addEventListener("touchstart", e => {
    if (box.scrollTop > 10) return;
    startY = curY = e.touches[0].clientY;
    dragging = true;
    box.style.transition = "none";
  }, { passive: true });
  box.addEventListener("touchmove", e => {
    if (!dragging) return;
    curY = e.touches[0].clientY;
    const d = curY - startY;
    if (d < 0) return;
    box.style.transform = `translateY(${d}px)`;
  }, { passive: true });
  box.addEventListener("touchend", () => {
    if (!dragging) return;
    dragging = false;
    const d = curY - startY;
    box.style.transition = "transform .28s ease";
    if (d > 120) { closePengPopup(); }
    box.style.transform = "";
  });
}
async function savePengSubmit(selectedKategori, selectedJenis) {
  const btn = document.getElementById("pengSubmitBtn");
  const tanggal = document.getElementById("pengInputTanggal").value;
  const catatan = document.getElementById("pengInputCatatan").value.trim();
  if (!tanggal) { window.showToast?.("Pilih tanggal dulu", "error"); return; }

  const rows = document.querySelectorAll("#pengItemList .peng-item-row");
  const newItems = [];

  rows.forEach((row, i) => {
    const isPreset = row.dataset.preset === "true";
    const nama = isPreset
      ? row.dataset.nama
      : row.querySelector(".peng-item-nama-input")?.value.trim();
    const qty = Number(row.querySelector(".peng-item-qty-input")?.value || 0);
    const harga = Number(row.querySelector(".peng-item-harga-input")?.value || 0);

    if (!nama || qty <= 0 || harga <= 0) return;

    newItems.push({
      jenis: selectedJenis,
      nama, qty, harga,
      nominal: qty * harga,
      catatan,
      waktu: new Date().toISOString(),
    });
  });

  if (!newItems.length) return;

  if (btn) { btn.disabled = true; btn.textContent = "Menyimpan..."; }

  try {
    const adminUid = window.auth?.currentUser?.uid;
    const idCabang = window.currentUser?.idCabang || window.kantorCabang?.id || "";
    if (!adminUid) throw new Error("User tidak terautentikasi");

    const ref = window.doc(window.db, "users", adminUid, "pengeluaran", tanggal);
    const snap = await window.getDoc(ref);
    const existing = snap.exists() ? snap.data() : {};

    const existingProduksi = Array.isArray(existing.produksi) ? existing.produksi : [];
    const existingDistribusi = Array.isArray(existing.distribusi) ? existing.distribusi : [];

    const payload = {
      tanggal,
      createdBy: adminUid,
      idCabang,
      updatedAt: window.serverTimestamp(),
    };

    if (selectedKategori === "produksi") {
      payload.produksi = [...existingProduksi, ...newItems];
    } else {
      payload.distribusi = [...existingDistribusi, ...newItems];
    }
    await window.setDoc(ref, payload, { merge: true });
    pengExistingDocCache = { tanggal: null, data: null };
    await loadPengData();
    document.getElementById("pengPopupOverlay")?.classList.remove("show");
    document.getElementById("pengInputCatatan").value = "";
    refreshPengItemList(selectedKategori, selectedJenis);
    window.showToast?.("Berhasil disimpan", "success");
  } catch (err) {
    console.error("❌ savePengSubmit:", err);
    window.showToast?.("Gagal menyimpan", "error");
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = "Simpan"; }
  }
}
