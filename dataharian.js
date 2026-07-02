window.initDataharianView = async function() {
  await loadDhKurirList();

  window.onDataharianReload = async function() {
    const reloadBtn = document.getElementById("topbarReload");
    const icon      = reloadBtn?.querySelector("i");
    if (icon) icon.classList.add("fa-spin");
    if (reloadBtn) reloadBtn.disabled = true;
    try { await loadDhKurirList(); } catch {}
    if (icon) icon.classList.remove("fa-spin");
    if (reloadBtn) reloadBtn.disabled = false;
  };

  document.getElementById("topbarBackBtn")?.addEventListener("click", () => {
    document.getElementById("dhDetailWrapper")?.classList.remove("show");
    document.getElementById("topbarBackBtn").style.display = "none";
    activeKurirUid  = null;
    activeKurirUser = null;
    loadDhKurirList();
  });
};

let activeKurirUid  = null;
let activeKurirUser = null;

/* ── LOAD KURIR LIST ── */
async function loadDhKurirList() {
  const listEl = document.getElementById("dhKurirList");
  if (!listEl) return;

  listEl.innerHTML = [1,2,3].map(() => `
    <div class="dh-kurir-item" style="pointer-events:none">
      <div class="dh-kurir-avatar sk" style="background:none"></div>
      <div class="dh-kurir-info">
        <div class="sk" style="height:13px;width:100px;margin-bottom:6px;border-radius:6px"></div>
        <div class="sk" style="height:11px;width:60px;border-radius:6px"></div>
      </div>
    </div>`).join("");

  let users = await window.idb.getUsers();
  users = users.filter(u => ["kurir","sales","hunter"].includes(u.role));
  window.usersCache = await window.idb.getUsers();
  renderDhKurirList(users);
}

/* ── RENDER KURIR LIST ── */
function renderDhKurirList(users = []) {
  const listEl = document.getElementById("dhKurirList");
  if (!listEl) return;

  if (!users.length) {
    listEl.innerHTML = `<div class="dh-empty-msg">Belum ada data.<br>Reload dari Home dulu.</div>`;
    return;
  }

  listEl.innerHTML = users.map(u => {
    const nama    = u.nama || "Tanpa Nama";
    const inisial = nama.trim().charAt(0).toUpperCase();
    const avatar  = u.foto
      ? `<img src="${esc(u.foto)}" alt="${esc(nama)}">`
      : inisial;
    return `
      <div class="dh-kurir-item ${activeKurirUid === u.uid ? "active" : ""}" data-uid="${esc(u.uid)}">
        <div class="dh-kurir-avatar">${avatar}</div>
        <div class="dh-kurir-info">
          <div class="dh-kurir-nama">${esc(nama)}</div>
          <div class="dh-kurir-role">${esc(u.role || "-")}</div>
        </div>
        <i class="fa-solid fa-chevron-right dh-kurir-arrow"></i>
      </div>`;
  }).join("");

  listEl.querySelectorAll(".dh-kurir-item").forEach(item => {
    item.addEventListener("click", () => {
      listEl.querySelectorAll(".dh-kurir-item").forEach(x => x.classList.remove("active"));
      item.classList.add("active");
      const uid  = item.dataset.uid;
      const user = users.find(u => u.uid === uid);
      selectDhKurir(user);
    });

    let pressTimer = null;
    item.addEventListener("pointerdown", () => {
      pressTimer = setTimeout(() => {
        const uid  = item.dataset.uid;
        const user = users.find(u => u.uid === uid);
        if (user) openCatatanKurir(user);
      }, 600);
    });
    item.addEventListener("pointerup",     () => clearTimeout(pressTimer));
    item.addEventListener("pointercancel", () => clearTimeout(pressTimer));
    item.addEventListener("pointermove",   () => clearTimeout(pressTimer));
  });
}

/* ── SELECT KURIR ── */
async function selectDhKurir(user) {
  if (!user) return;
  activeKurirUid  = user.uid;
  activeKurirUser = user;

  const empty   = document.getElementById("dhDetailEmpty");
  const content = document.getElementById("dhDetailContent");
  const wrapper = document.getElementById("dhDetailWrapper");

  if (empty)   empty.style.display   = "none";
  if (content) content.style.display = "flex";
  if (wrapper) wrapper.classList.add("show");

  if (window.innerWidth <= 768) {
    const backBtn = document.getElementById("topbarBackBtn");
    if (backBtn) backBtn.style.display = "flex";
  }

  const nama    = user.nama || "Tanpa Nama";
  const inisial = nama.trim().charAt(0).toUpperCase();

  const avatarEl = document.getElementById("dhDetailAvatar");
  if (avatarEl) avatarEl.innerHTML = user.foto
    ? `<img src="${esc(user.foto)}" alt="${esc(nama)}">`
    : inisial;

  const namaEl = document.getElementById("dhDetailNama");
  if (namaEl) namaEl.textContent = nama;

  const roleEl = document.getElementById("dhDetailRole");
  if (roleEl) roleEl.textContent = user.role || "-";

  const dateEl = document.getElementById("dhDetailDate");
  if (dateEl && !dateEl.value) dateEl.value = getTanggalLocal();

  await renderDhForm();
  await renderDhRingkasan();

  const reloadBtn = document.getElementById("dhReloadBtn");
  if (reloadBtn) {
    reloadBtn.onclick = async () => {
      reloadBtn.classList.add("spinning");
      reloadBtn.disabled = true;
      const tanggal = document.getElementById("dhDetailDate")?.value || getTanggalLocal();
      await window.idb.clearDataHarian(activeKurirUid, tanggal);
      await renderDhRingkasan(true);
      reloadBtn.classList.remove("spinning");
      reloadBtn.disabled = false;
    };
  }

  // guard: hapus listener lama pakai clone
  const dateInput = document.getElementById("dhDetailDate");
  if (dateInput) {
    const newDate = dateInput.cloneNode(true);
    dateInput.parentNode.replaceChild(newDate, dateInput);
    newDate.addEventListener("change", async () => {
      await renderDhForm();
      await renderDhRingkasan();
    });
  }
}

/* ── RENDER FORM INPUT ── */
async function renderDhForm() {
  const formPanel = document.getElementById("dhFormBody")?.closest(".dh-form-panel");
  const formBody  = document.getElementById("dhFormBody");
  if (!formBody) return;

  document.querySelectorAll(".dh-simpan-wrap").forEach(el => el.remove());

  const tanggal = document.getElementById("dhDetailDate")?.value || getTanggalLocal();
  let existing  = {};
  try {
    const snap = await window.getDoc(
      window.doc(window.db, "users", activeKurirUid, "laporanMarketing", tanggal)
    );
    if (snap.exists()) existing = snap.data();
  } catch {}

  const admin  = (window.usersCache || []).find(u => u.role === "adminCabang");
  const varian = (admin?.varian || [])
    .filter(v => { const k = Object.keys(v)[0]; return k && v[k]?.isAktif; })
    .map(v => Object.keys(v)[0]);

  if (!varian.length) {
    formBody.innerHTML = `<div class="dh-ringkasan-empty">Varian tidak ditemukan</div>`;
    return;
  }

  const rows = [
    { key: "order",      label: "Order" },
    { key: "fee",        label: "Fee" },
    { key: "offflavor",  label: "Off Flavor" },
    { key: "sisabarang", label: "Sisa Barang" },
  ];

  const inputRows = rows.map(r => `
    <div class="dh-form-row">
      <div class="dh-form-label">${r.label}</div>
      <div class="dh-form-inputs">
        ${varian.map(v => `
          <input type="number" min="0" class="dh-form-input"
            data-type="${r.key}" data-varian="${esc(v)}" placeholder="${esc(v)}">`
        ).join("")}
      </div>
    </div>`).join("");

  const closingRow = `
    <div class="dh-form-row dh-form-row-closing">
      <div class="dh-form-label dh-form-label-closing">Closing</div>
      <div class="dh-form-inputs">
        ${varian.map(v => `
          <div class="dh-form-closing" data-varian="${esc(v)}" title="${esc(v)}">0</div>`
        ).join("")}
      </div>
    </div>`;

  const pembayaranRow = `
    <div class="dh-form-row">
      <div class="dh-form-label">Pembayaran</div>
      <div class="dh-form-inputs dh-inputs-bayar">
        <input type="text" inputmode="numeric" class="dh-form-input dh-input-bayar"
          data-type="pembayaran" placeholder="0">
      </div>
    </div>
    <div class="dh-tagihan-wrap">
      <div class="dh-tagihan-row">
        <span class="dh-tagihan-label">Total Tagihan</span>
        <span class="dh-tagihan-value" id="dhTagihanValue">Rp 0</span>
      </div>
      <div class="dh-tagihan-ket" id="dhTagihanKet"></div>
    </div>
    <div class="dh-harga-wrap">
      <div class="dh-harga-title">Keterangan Harga Varian</div>
      ${varian.map(v => {
        const harga = activeKurirUser?.varian?.find(item => Object.keys(item)[0] === v)?.[v]?.hargaProduksi || 0;
        return `<div class="dh-harga-row">
          <span class="dh-harga-key">${esc(v)}</span>
          <span class="dh-harga-val">Rp ${Number(harga).toLocaleString("id-ID")}</span>
        </div>`;
      }).join("")}
    </div>`;

  formBody.innerHTML = inputRows + closingRow + pembayaranRow;

  formBody.closest(".dh-form-panel").insertAdjacentHTML("beforeend", `
    <div class="dh-simpan-wrap">
      <button class="dh-simpan-btn" id="dhSimpanBtn">Simpan</button>
    </div>`);

  // isi dari existing
  const fieldMap = { order:"order", fee:"fee", offflavor:"offFlavor", sisabarang:"sisaBarang" };
  Object.entries(fieldMap).forEach(([type, fsField]) => {
    const data = existing[fsField] || {};
    Object.entries(data).forEach(([v, val]) => {
      const input = formBody.querySelector(`.dh-form-input[data-type="${type}"][data-varian="${v}"]`);
      if (input && val) input.value = val;
    });
  });
  const bayar = existing?.pembayaran?.nota?.bayar || 0;
  const bayarInput = formBody.querySelector(".dh-input-bayar");
  if (bayarInput && bayar) bayarInput.value = Number(bayar).toLocaleString("id-ID");

  formBody.querySelectorAll(".dh-form-input:not(.dh-input-bayar)").forEach(input => {
    input.addEventListener("input", hitungClosing);
  });
  hitungClosing();

  formBody.querySelector(".dh-input-bayar")?.addEventListener("input", e => {
    const angka = e.target.value.replace(/\D/g, "");
    e.target.value = angka ? Number(angka).toLocaleString("id-ID") : "";
    hitungTagihan();
  });

  document.getElementById("dhSimpanBtn")?.addEventListener("click", async () => {
    const btn     = document.getElementById("dhSimpanBtn");
    const tanggal = document.getElementById("dhDetailDate")?.value;
    if (!tanggal) { window.showToast("Pilih tanggal dulu", "error"); return; }

    btn.disabled    = true;
    btn.textContent = "Menyimpan...";

    try {
      const adminUid  = window.auth?.currentUser?.uid;
      const adminSnap = await window.getDoc(window.doc(window.db, "users", adminUid));
      const idCabang  = adminSnap.exists() ? (adminSnap.data().idCabang || "") : "";

      const hasil = {};
      document.querySelectorAll(".dh-form-input:not(.dh-input-bayar)").forEach(input => {
        const type   = input.dataset.type;
        const varian = input.dataset.varian;
        const val    = Number(input.value) || 0;
        if (!hasil[type]) hasil[type] = {};
        if (val > 0) hasil[type][varian] = val;
      });

      const bayarRaw = document.querySelector(".dh-input-bayar")?.value || "";
      const bayar    = Number(bayarRaw.replace(/\./g, "")) || 0;

      const closingData = {};
      document.querySelectorAll(".dh-form-closing").forEach(el => {
        const v = el.dataset.varian;
        const c = Number(el.textContent) || 0;
        if (c !== 0) closingData[v] = c;
      });

      const hargaMap = {};
      (activeKurirUser?.varian || []).forEach(v => {
        const key = Object.keys(v)[0];
        if (key) hargaMap[key] = Number(v[key]?.hargaProduksi) || 0;
      });
      let totalTagihan = 0;
      Object.entries(closingData).forEach(([k, c]) => { totalTagihan += c * (hargaMap[k] || 0); });
      const selisih = bayar - totalTagihan;
      const status  = selisih === 0 ? "Lunas" : selisih < 0 ? "Kurang" : "Lebih";

      const laporanRef = window.doc(window.db, "users", activeKurirUid, "laporanMarketing", tanggal);
      await window.setDoc(laporanRef, {
        createdBy:   adminUid,
        idMarketing: activeKurirUid,
        idCabang, tanggal,
        order:      hasil.order      || {},
        fee:        hasil.fee        || {},
        offFlavor:  hasil.offflavor  || {},
        sisaBarang: hasil.sisabarang || {},
        pembayaran: {
          closing: { ...closingData, createdAt: window.serverTimestamp() },
          nota: { bayar, keterangan: selisih, status }
        },
        updatedAt: window.serverTimestamp()
      }, { merge: true });
      // update bawaBarang di users — semua varian termasuk yang 0
      const admin = (window.usersCache || []).find(u => u.role === "adminCabang");
      const semuaVarian = (admin?.varian || [])
        .filter(v => { const k = Object.keys(v)[0]; return k && v[k]?.isAktif; })
        .map(v => Object.keys(v)[0]);
      const bawaBarangArr = semuaVarian.map(k => ({
        [k]: { bawa: Number(hasil.order?.[k]) || 0 }
      }));
      await window.setDoc(
        window.doc(window.db, "users", activeKurirUid),
        {
          bawaBarang: bawaBarangArr,
          bawaBarangUpdate: window.serverTimestamp()
        },
        { merge: true }
      );
      // update IDB dengan nota
      try {
        const existingDh = await window.idb.getDataHarian(activeKurirUid, tanggal);
        if (existingDh) {
          await window.idb.saveDataHarian(activeKurirUid, tanggal, {
            ...existingDh,
            nota: { bayar, keterangan: selisih, status }
          });
        }
      } catch {}
      // mirror ke laporanAdmin
      try {
        const kurirNama = activeKurirUser?.nama || "";
        const laporanAdminRef = window.doc(window.db, "users", adminUid, "laporanAdmin", tanggal);
        await window.setDoc(laporanAdminRef, {
          [activeKurirUid]: {
            nama:       kurirNama,
            order:      hasil.order      || {},
            fee:        hasil.fee        || {},
            offFlavor:  hasil.offflavor  || {},
            sisaBarang: hasil.sisabarang || {},
            pembayaran: {
              closing: closingData,
              nota: { bayar, keterangan: selisih, status }
            },
            createdBy: adminUid
          }
        }, { merge: true });
      } catch (err) {
        console.error("❌ mirror laporanAdmin:", err);
      }
      window.showToast("Berhasil disimpan", "success");
    } catch (err) {
      console.error("❌ simpan dataharian:", err);
      window.showToast("Gagal menyimpan", "error");
    } finally {
      btn.disabled    = false;
      btn.textContent = "Simpan";
    }
  });
}

/* ── HITUNG TAGIHAN ── */
function hitungTagihan() {
  const tagihanEl = document.getElementById("dhTagihanValue");
  const ketEl     = document.getElementById("dhTagihanKet");
  if (!tagihanEl || !ketEl) return;

  const hargaMap = {};
  (activeKurirUser?.varian || []).forEach(v => {
    const key = Object.keys(v)[0];
    if (key) hargaMap[key] = Number(v[key]?.hargaProduksi) || 0;
  });

  let totalTagihan = 0;
  document.querySelectorAll(".dh-form-closing").forEach(el => {
    totalTagihan += (Number(el.textContent) || 0) * (hargaMap[el.dataset.varian] || 0);
  });

  tagihanEl.textContent = "Rp " + totalTagihan.toLocaleString("id-ID");

  const bayar   = Number((document.querySelector(".dh-input-bayar")?.value || "").replace(/\./g, "")) || 0;
  const selisih = bayar - totalTagihan;

  if (bayar === 0) {
    ketEl.textContent = ""; ketEl.className = "dh-tagihan-ket";
  } else if (selisih === 0) {
    ketEl.textContent = "Lunas"; ketEl.className = "dh-tagihan-ket dh-ket-lunas";
  } else if (selisih < 0) {
    ketEl.textContent = `Kurang Rp ${Math.abs(selisih).toLocaleString("id-ID")}`;
    ketEl.className = "dh-tagihan-ket dh-ket-kurang";
  } else {
    ketEl.textContent = `Lebih Rp ${selisih.toLocaleString("id-ID")}`;
    ketEl.className = "dh-tagihan-ket dh-ket-lebih";
  }
}

/* ── HITUNG CLOSING ── */
function hitungClosing() {
  document.querySelectorAll(".dh-form-closing").forEach(el => {
    const v = el.dataset.varian;
    const get = type => Number(
      document.querySelector(`.dh-form-input[data-type="${type}"][data-varian="${v}"]`)?.value || 0
    );
    el.textContent = get("order") - get("fee") - get("offflavor") - get("sisabarang") || "0";
  });
  hitungTagihan();
}

/* ── RENDER RINGKASAN ── */
async function renderDhRingkasan(forceReload = false) {
  const body = document.getElementById("dhRingkasanBody");
  if (!body) return;

  body.innerHTML = `<div class="dh-ringkasan-empty">Memuat...</div>`;

  const tanggal  = document.getElementById("dhDetailDate")?.value || getTanggalLocal();
  const uidKurir = activeKurirUid;

  let data = await window.idb.getDataHarian(uidKurir, tanggal);

  if (forceReload) {
    data = await fetchDataHarian(uidKurir, tanggal);
    if (data) await window.idb.saveDataHarian(uidKurir, tanggal, data);
  }

  if (!data) {
    body.innerHTML = `<div class="dh-ringkasan-empty">Belum ada data</div>`;
    return;
  }

  renderRingkasanUI(body, data);
}

/* ── FETCH DATA HARIAN ── */
async function fetchDataHarian(uidKurir, tanggal) {
  try {
    const idCabang = window.currentUser?.idCabang || "";
    if (!idCabang) return null;
    const hasil = {
      fee: {}, disable: {}, closing: {}, expired: {}, pay: {}, saldoBarang: {},
      penjualanLangsung: {},
      kunjungan: 0,
      pembayaran: { bayarKonsumen: 0, bayarProduksi: 0 },
      keterangan: { pending: 0, tutup: 0, putus: 0 },
      customerNew: 0, customerLama: 0, customerTambahan: 0
    };

    const snap = await window.getDocs(window.query(
      window.collectionGroup(window.db, "dataHarian"),
      window.where("idCabang", "==", idCabang),
      window.where("pemilik",  "==", uidKurir),
      window.where("tanggal",  "==", tanggal)
    ));

    hasil.kunjungan = snap.size;

    snap.forEach(docSnap => {
      const d = docSnap.data();
      ["fee","disable","closing","expired","pay"].forEach(f => {
        if (!d[f] || typeof d[f] !== "object") return;
        Object.entries(d[f]).forEach(([k, v]) => {
          hasil[f][k] = (hasil[f][k] || 0) + (Number(v) || 0);
        });
      });
      if (d.pembayaran) {
        hasil.pembayaran.bayarKonsumen += Number(d.pembayaran?.bayarKonsumen) || 0;
        hasil.pembayaran.bayarProduksi += Number(d.pembayaran?.bayarProduksi) || 0;
      }
      const status = d?.keterangan?.status?.trim()?.toLowerCase();
      if (status === "pending") hasil.keterangan.pending++;
      else if (status === "tutup") hasil.keterangan.tutup++;
      else if (status === "putus") hasil.keterangan.putus++;
    });

    // query penjualanLangsung — tambahkan ke pay dan omset
    try {
      const snapPL = await window.getDocs(window.query(
        window.collectionGroup(window.db, "penjualanLangsung"),
        window.where("idCabang", "==", idCabang),
        window.where("pemilik",  "==", uidKurir),
        window.where("tanggal",  "==", tanggal)
      ));
      snapPL.forEach(docSnap => {
        const d = docSnap.data();
        if (d.pay && typeof d.pay === "object") {
          Object.entries(d.pay).forEach(([k, v]) => {
            hasil.pay[k] = (hasil.pay[k] || 0) + (Number(v) || 0);
          });
        }
        if (d.closing && typeof d.closing === "object") {
          Object.entries(d.closing).forEach(([k, v]) => {
            hasil.closing[k] = (hasil.closing[k] || 0) + (Number(v) || 0);
          });
        }
        if (d.pay && typeof d.pay === "object") {
          Object.entries(d.pay).forEach(([k, v]) => {
            hasil.penjualanLangsung[k] = (hasil.penjualanLangsung[k] || 0) + (Number(v) || 0);
          });
        }
        if (d.pembayaran) {
          hasil.pembayaran.bayarKonsumen += Number(d.pembayaran?.bayarKonsumen) || 0;
        }
      });
    } catch (err) { console.warn("❌ query penjualanLangsung:", err.message); }

    try {
      const lmSnap = await window.getDoc(
        window.doc(window.db, "users", uidKurir, "laporanMarketing", tanggal)
      );
      const order = lmSnap.exists() ? (lmSnap.data().order || {}) : {};
      const allKeys = new Set([
        ...Object.keys(order),
        ...Object.keys(hasil.closing),
        ...Object.keys(hasil.fee),
        ...Object.keys(hasil.disable),
        ...Object.keys(hasil.penjualanLangsung)
      ]);
      allKeys.forEach(k => {
        hasil.saldoBarang[k] =
          (Number(order[k]) || 0) -
          (Number(hasil.closing[k]) || 0) -
          (Number(hasil.fee[k]) || 0) -
          (Number(hasil.disable[k]) || 0);
      });
    } catch {}

    // query customer
    try {
      const hariNama  = ["Minggu","Senin","Selasa","Rabu","Kamis","Jumat","Sabtu"];
      const hariFilter = hariNama[new Date(tanggal + "T00:00:00").getDay()];
      const startDate  = new Date(tanggal + "T00:00:00");
      const endDate    = new Date(startDate); endDate.setDate(endDate.getDate() + 1);
      const startTs    = window.Timestamp?.fromDate?.(startDate);
      const endTs      = window.Timestamp?.fromDate?.(endDate);

      if (startTs && endTs) {
        // customer baru
        const cnSnap = await window.getDocs(window.query(
          window.collection(window.db, "customer"),
          window.where("idCabang", "==", idCabang),
          window.where("pemilik",  "==", uidKurir),
          window.where("createdBy","==", uidKurir),
          window.where("acc",      "==", true),
          window.where("createdAt",">=", startTs),
          window.where("createdAt","<",  endTs)
        ));
        hasil.customerNew = cnSnap.size;

        // customer lama
        const clSnap = await window.getDocs(window.query(
          window.collection(window.db, "customer"),
          window.where("idCabang", "==", idCabang),
          window.where("pemilik",  "==", uidKurir),
          window.where("hari",     "==", hariFilter),
          window.where("isNew",    "==", false)
        ));
        hasil.customerLama = clSnap.docs.filter(d => !("acc" in d.data())).length;

        // customer tambahan
        const ctSnap = await window.getDocs(window.query(
          window.collection(window.db, "customer"),
          window.where("idCabang", "==", idCabang),
          window.where("pemilik",  "==", uidKurir),
          window.where("hari",     "==", hariFilter),
          window.where("isNew",    "==", true)
        ));
        hasil.customerTambahan = ctSnap.docs.filter(d => !("acc" in d.data())).length;
      }
    } catch (err) { console.warn("❌ query customer:", err.message); }

    return hasil;
  } catch (err) {
    console.error("❌ fetchDataHarian:", err);
    return null;
  }
}

/* ── RENDER RINGKASAN UI ── */
function renderRingkasanUI(body, data) {
  const varian = (activeKurirUser?.varian || [])
    .filter(v => { const k = Object.keys(v)[0]; return k && v[k]?.isAktif; })
    .map(v => Object.keys(v)[0]);

  const renderRow = (label, obj, cls) => `
    <div class="dh-ring-row-wrap">
      <div class="dh-ring-row-label">${label}</div>
      <div class="dh-ring-row-vals">
        ${varian.map(v => `
          <div class="dh-ring-val-box ${cls}">
            <div class="dh-ring-val-key">${esc(v)}</div>
            <div class="dh-ring-val-num">${Number(obj[v] || 0).toLocaleString("id-ID")}</div>
          </div>`).join("")}
      </div>
    </div>`;

  body.innerHTML = `
    <div class="dh-ring-omset-card">
      <span class="dh-ring-omset-label">Total Omset</span>
      <span class="dh-ring-omset-val">Rp ${Number(data.pembayaran?.bayarKonsumen || 0).toLocaleString("id-ID")}</span>
    </div>
    ${renderRow("Closing",      data.closing,     "ring-closing")}
    ${renderRow("Fee",          data.fee,         "ring-fee")}
    ${renderRow("Disable",      data.disable,     "ring-disable")}
    ${renderRow("Expired",      data.expired,     "ring-expired")}
    ${renderRow("Pay",          data.pay,         "ring-pay")}
    ${renderRow("Penjualan Langsung", data.penjualanLangsung || {}, "ring-pl")}
    ${renderRow("Saldo Barang", data.saldoBarang, "ring-saldo")}
    <div class="dh-ring-row-wrap">
      <div class="dh-ring-row-label">Customer</div>
      <div class="dh-ring-row-vals">
        <div class="dh-ring-val-box ring-customer"><div class="dh-ring-val-key">Lama</div><div class="dh-ring-val-num">${data.customerLama || 0}</div></div>
        <div class="dh-ring-val-box ring-customer"><div class="dh-ring-val-key">Tambahan</div><div class="dh-ring-val-num">${data.customerTambahan || 0}</div></div>
        <div class="dh-ring-val-box ring-customer"><div class="dh-ring-val-key">Baru</div><div class="dh-ring-val-num">${data.customerNew || 0}</div></div>
        <div class="dh-ring-val-box ring-customer"><div class="dh-ring-val-key">Kunjungan</div><div class="dh-ring-val-num">${data.kunjungan || 0}</div></div>
      </div>
    </div>
    <div class="dh-ring-row-wrap">
      <div class="dh-ring-row-label">Keterangan</div>
      <div class="dh-ring-row-vals">
        <div class="dh-ring-val-box ring-ket"><div class="dh-ring-val-key">Tutup</div><div class="dh-ring-val-num">${data.keterangan?.tutup || 0}</div></div>
        <div class="dh-ring-val-box ring-ket"><div class="dh-ring-val-key">Pending</div><div class="dh-ring-val-num">${data.keterangan?.pending || 0}</div></div>
        <div class="dh-ring-val-box ring-ket"><div class="dh-ring-val-key">Putus</div><div class="dh-ring-val-num">${data.keterangan?.putus || 0}</div></div>
      </div>
    </div>`;
}
/* ── TABEL REKAP STATE ── */
const BULAN_NAMA = ["Januari","Februari","Maret","April","Mei","Juni","Juli","Agustus","September","Oktober","November","Desember"];
let tabelBulan  = new Date().getMonth();
let tabelTahun  = new Date().getFullYear();
let tabelFilter = localStorage.getItem("dhTabelFilter") || "semua";

function initTabelRekap() {
  updateTabelPeriodLabel();
  restoreTabelFilter();
  renderTabelLaporan();

  // period btn
  document.getElementById("dhTabelPeriodBtn")?.addEventListener("click", () => {
    buildPeriodPopup();
    document.getElementById("dhPeriodOverlay")?.classList.add("show");
  });

  // close btn
  document.getElementById("dhTabelCloseBtn")?.addEventListener("click", () => {
    document.getElementById("dhTabelWrapper")?.classList.remove("show");
    const bottomNav = document.getElementById("bottomNav");
    if (bottomNav) bottomNav.style.display = "";
  });

  // period apply
  document.getElementById("dhPeriodApply")?.addEventListener("click", () => {
    document.getElementById("dhPeriodOverlay")?.classList.remove("show");
    updateTabelPeriodLabel();
    renderTabelLaporan();
  });

  // overlay close
  document.getElementById("dhPeriodOverlay")?.addEventListener("click", e => {
    if (e.target.id === "dhPeriodOverlay")
      document.getElementById("dhPeriodOverlay")?.classList.remove("show");
  });

  // filter chips
  document.querySelectorAll(".dh-tabel-chip").forEach(chip => {
    chip.addEventListener("click", () => {
      tabelFilter = chip.dataset.filter;
      localStorage.setItem("dhTabelFilter", tabelFilter);
      restoreTabelFilter();
      renderTabelLaporan();
    });
  });
}

function updateTabelPeriodLabel() {
  const el = document.getElementById("dhTabelPeriodLabel");
  if (el) el.textContent = `Laporan Harian ${BULAN_NAMA[tabelBulan]} ${tabelTahun}`;
}

function restoreTabelFilter() {
  document.querySelectorAll(".dh-tabel-chip").forEach(c => {
    c.classList.toggle("active", c.dataset.filter === tabelFilter);
  });
}

function buildPeriodPopup() {
  const bulanEl = document.getElementById("dhPeriodBulan");
  const tahunEl = document.getElementById("dhPeriodTahun");
  if (!bulanEl || !tahunEl) return;

  bulanEl.innerHTML = BULAN_NAMA.map((b, i) => `
    <div class="dh-period-opt ${i === tabelBulan ? "active" : ""}" data-bulan="${i}">${b.slice(0,3)}</div>
  `).join("");

  const curYear = new Date().getFullYear();
  tahunEl.innerHTML = [curYear-1, curYear, curYear+1].map(y => `
    <div class="dh-period-opt ${y === tabelTahun ? "active" : ""}" data-tahun="${y}">${y}</div>
  `).join("");

  bulanEl.querySelectorAll(".dh-period-opt").forEach(opt => {
    opt.addEventListener("click", () => {
      bulanEl.querySelectorAll(".dh-period-opt").forEach(o => o.classList.remove("active"));
      opt.classList.add("active");
      tabelBulan = Number(opt.dataset.bulan);
    });
  });

  tahunEl.querySelectorAll(".dh-period-opt").forEach(opt => {
    opt.addEventListener("click", () => {
      tahunEl.querySelectorAll(".dh-period-opt").forEach(o => o.classList.remove("active"));
      opt.classList.add("active");
      tabelTahun = Number(opt.dataset.tahun);
    });
  });
}

async function renderTabelLaporan() {
  const scroll   = document.getElementById("dhTabelScroll");
  if (!scroll) return;

  scroll.innerHTML = `<div class="dh-ringkasan-empty">Memuat...</div>`;

  const adminUid = window.auth?.currentUser?.uid;
  const today    = getTanggalLocal();
  const totalHari = new Date(tabelTahun, tabelBulan + 1, 0).getDate();

  // ambil varian
  const admin  = (window.usersCache || []).find(u => u.role === "adminCabang");
  const varian = (admin?.varian || [])
    .filter(v => { const k = Object.keys(v)[0]; return k && v[k]?.isAktif; })
    .map(v => Object.keys(v)[0]);
  const V = varian.length ? varian : ["CB","BB","BK","MC"];

  // ambil semua kurir dari cache
  const allKurir = (window.usersCache || []).filter(u => ["kurir","sales","hunter"].includes(u.role));

  const COLS = [
      { key: "order",       label: "Order",       cls: "order",      src: u => u.order },
      { key: "fee",         label: "Fee",          cls: "fee",        src: u => u.fee },
      { key: "offFlavor",   label: "Off Flavor",   cls: "offFlavor",  src: u => u.offFlavor },
      { key: "sisaBarang",  label: "Sisa Barang",  cls: "sisaBarang", src: u => u.sisaBarang },
      { key: "closing",     label: "Closing",      cls: "closing",    src: u => u?.pembayaran?.closing },
    ];

  const hariNama = ["Minggu","Senin","Selasa","Rabu","Kamis","Jumat","Sabtu"];

  // build tanggal list
  let tanggalList = [];
  for (let tgl = 1; tgl <= totalHari; tgl++) {
    const tDoc    = `${tabelTahun}-${String(tabelBulan+1).padStart(2,"0")}-${String(tgl).padStart(2,"0")}`;
    const hari    = hariNama[new Date(tabelTahun, tabelBulan, tgl).getDay()];
    const label   = `${hari}, ${tgl} ${BULAN_NAMA[tabelBulan]} ${tabelTahun}`;
    if (tabelFilter === "aktif" && tDoc !== today) continue;
    tanggalList.push({ tDoc, tgl, hari, label });
  }

  // fetch semua tanggal dari Firestore
  const dataMap = {};
  await Promise.all(tanggalList.map(async ({ tDoc }) => {
    try {
      const snap = await window.getDoc(window.doc(window.db, "users", adminUid, "laporanAdmin", tDoc));
      dataMap[tDoc] = snap.exists() ? snap.data() : null;
    } catch { dataMap[tDoc] = null; }
  }));

  // filter tunggakan
  if (tabelFilter === "tunggakan") {
    tanggalList = tanggalList.filter(({ tDoc }) => {
      const data = dataMap[tDoc];
      if (!data) return false;
      return Object.values(data).some(v =>
        typeof v === "object" && v?.pembayaran?.nota?.status?.toLowerCase() === "kurang"
      );
    });
  }

  if (!tanggalList.length) {
    scroll.innerHTML = `<div class="dh-ringkasan-empty">Belum ada data</div>`;
    return;
  }

  // build thead — sticky
  const th1 = `<tr>
    <th class="dh-rekap-td-tgl" rowspan="2" style="writing-mode:horizontal-tb;transform:none;min-width:80px">Tanggal</th>
    <th rowspan="2" class="dh-rekap-td-nama">Nama</th>
    ${COLS.map(c => `<th colspan="${V.length + 1}" class="dh-rekap-th-grp-${c.cls}">${c.label}</th>`).join("")}
    <th rowspan="2">Bayar</th>
    <th rowspan="2">Status</th>
  </tr>`;
  const th2 = `<tr>${COLS.map(c => [...V.map(v => `<th>${v}</th>`), `<th style="background:var(--bg-card)!important">JML</th>`].join("")).join("")}</tr>`;

  // build tbody
  let tbodyHtml = "";

  for (const { tDoc, label } of tanggalList) {
    const data     = dataMap[tDoc];
    const kurirData = data
      ? allKurir.map(k => {
          const d = data[k.uid];
          return { uid: k.uid, nama: k.nama, ...(d || {}) };
        })
      : allKurir.map(k => ({ uid: k.uid, nama: k.nama }));

    const adaKurang = kurirData.some(u => u?.pembayaran?.nota?.status?.toLowerCase() === "kurang");
    const rowCls    = adaKurang ? "dh-rekap-block-kurang" : "";

    const sums = {};
    COLS.forEach(c => { sums[c.key] = {}; V.forEach(v => { sums[c.key][v] = 0; }); });
    let sumBayar = 0;

    const rowspan = kurirData.length + 1; // +1 untuk total

    const kurirRows = kurirData.map((u, idx) => {
      const cells = COLS.map(c => {
        const src = c.src(u) || {};
        let colSum = 0;
        const vCells = V.map(v => {
          const val = Number(src[v] || 0);
          sums[c.key][v] = (sums[c.key][v] || 0) + val;
          colSum += val;
          return `<td class="dh-rekap-col-${c.cls}">${val || ""}</td>`;
        }).join("");
        return vCells + `<td class="dh-rekap-col-${c.cls} dh-rekap-td-sum">${colSum || ""}</td>`;
      }).join("");

      const bayar  = Number(u?.pembayaran?.nota?.bayar || 0);
      const status = u?.pembayaran?.nota?.status || "-";
      const ket    = Number(u?.pembayaran?.nota?.keterangan || 0);
      sumBayar    += bayar;

      let ketHtml = status, ketCls = "";
      if (status.toLowerCase() === "lunas")  ketCls = "dh-rekap-lunas";
      if (status.toLowerCase() === "kurang") { ketHtml = `Kurang ${Math.abs(ket).toLocaleString("id-ID")}`; ketCls = "dh-rekap-kurang"; }
      if (status.toLowerCase() === "lebih")  { ketHtml = `Lebih ${ket.toLocaleString("id-ID")}`;           ketCls = "dh-rekap-lebih"; }

      const tglCell = idx === 0
        ? `<td class="dh-rekap-td-tgl" rowspan="${rowspan}">${esc(label)}</td>`
        : "";

      return `<tr class="${rowCls}">
        ${tglCell}
        <td class="dh-rekap-td-nama">${esc(u.nama)}</td>
        ${cells}
        <td>${bayar ? bayar.toLocaleString("id-ID") : ""}</td>
        <td class="${ketCls}">${ketHtml}</td>
      </tr>`;
    }).join("");

    const sumCells = COLS.map(c => {
      let total = 0;
      const vCells = V.map(v => {
        total += sums[c.key][v] || 0;
        return `<td class="dh-rekap-td-sum dh-rekap-col-${c.cls}">${sums[c.key][v] || ""}</td>`;
      }).join("");
      return vCells + `<td class="dh-rekap-td-sum dh-rekap-col-${c.cls}">${total || ""}</td>`;
    }).join("");

    const sumRow = `<tr class="${rowCls}">
      <td class="dh-rekap-td-nama dh-rekap-td-sum">Total</td>
      ${sumCells}
      <td class="dh-rekap-td-sum">${sumBayar ? sumBayar.toLocaleString("id-ID") : ""}</td>
      <td class="dh-rekap-td-sum">—</td>
    </tr>`;

    tbodyHtml += kurirRows + sumRow;
  }

  // hitung grand total semua tanggal
  const grandSums = {};
  COLS.forEach(c => { grandSums[c.key] = {}; V.forEach(v => { grandSums[c.key][v] = 0; }); });
  let grandBayar = 0;
  let grandKet   = 0;

  for (const { tDoc } of tanggalList) {
    const data = dataMap[tDoc];
    if (!data) continue;
    const kurirData = allKurir.map(k => ({ uid: k.uid, nama: k.nama, ...(data[k.uid] || {}) }));
    kurirData.forEach(u => {
      COLS.forEach(c => {
        const src = c.src(u) || {};
        V.forEach(v => { grandSums[c.key][v] = (grandSums[c.key][v] || 0) + (Number(src[v]) || 0); });
      });
      grandBayar += Number(u?.pembayaran?.nota?.bayar || 0);
      grandKet   += Number(u?.pembayaran?.nota?.keterangan || 0);
    });
  }

  const grandCells = COLS.map(c => {
    let total = 0;
    const vCells = V.map(v => {
      total += grandSums[c.key][v] || 0;
      return `<td class="dh-rekap-td-sum dh-rekap-col-${c.cls}">${grandSums[c.key][v] || ""}</td>`;
    }).join("");
    return vCells + `<td class="dh-rekap-td-sum dh-rekap-col-${c.cls}">${total || ""}</td>`;
  }).join("");

  const grandKetHtml = grandKet === 0 ? "Lunas"
    : grandKet < 0 ? `Kurang ${Math.abs(grandKet).toLocaleString("id-ID")}`
    : `Lebih ${grandKet.toLocaleString("id-ID")}`;
  const grandKetCls = grandKet === 0 ? "dh-rekap-lunas"
    : grandKet < 0 ? "dh-rekap-kurang" : "dh-rekap-lebih";

  const grandRow = `<tr style="border-top: 2px solid var(--brand-mid)">
    <td class="dh-rekap-td-tgl" style="writing-mode:horizontal-tb;transform:none;font-size:10px;font-weight:800;color:var(--brand-primary)">TOTAL</td>
    <td class="dh-rekap-td-nama dh-rekap-td-sum">Grand Total</td>
    ${grandCells}
    <td class="dh-rekap-td-sum">${grandBayar ? grandBayar.toLocaleString("id-ID") : ""}</td>
    <td class="dh-rekap-td-sum ${grandKetCls}">${grandKetHtml}</td>
  </tr>`;

  scroll.innerHTML = `
    <table class="dh-rekap-table">
      <thead>${th1}${th2}</thead>
      <tbody>${tbodyHtml}${grandRow}</tbody>
    </table>`;
}
window.downloadDataHarian = async function(uidKurir, tanggal) {
  try {
    const idCabang = window.currentUser?.idCabang || "";
    const snap = await window.getDocs(window.query(
      window.collectionGroup(window.db, "dataHarian"),
      window.where("idCabang", "==", idCabang),
      window.where("pemilik",  "==", uidKurir),
      window.where("tanggal",  "==", tanggal)
    ));
    const rows = [];
    snap.forEach(d => rows.push({ id: d.id, path: d.ref.path, ...d.data() }));
    const blob = new Blob([JSON.stringify(rows, null, 2)], { type: "application/json" });
    const a    = document.createElement("a");
    a.href     = URL.createObjectURL(blob);
    a.download = `dataHarian_${uidKurir}_${tanggal}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
    console.log("✅ Downloaded", rows.length, "docs");
  } catch (err) {
    console.error("❌ download:", err);
  }
};
window.initTabelRekap = initTabelRekap;
/* ── CATATAN KURIR ── */
function openCatatanKurir(user) {}

/* ── HELPERS ── */
function getTanggalLocal() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,"0")}-${String(now.getDate()).padStart(2,"0")}`;
}

function esc(str) {
  return String(str)
    .replace(/&/g,"&amp;").replace(/</g,"&lt;")
    .replace(/>/g,"&gt;").replace(/"/g,"&quot;");
}
