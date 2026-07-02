window.initLaporanView = async function() {
  await loadLapKurirList();
  initKeuanganModal();
  initTargetModal();
  window.onLaporanReload = async function() {
    await loadLapKurirList();
  };

  document.getElementById("topbarBackBtn")?.addEventListener("click", () => {
    document.getElementById("lapDetailWrapper")?.classList.remove("show");
    document.getElementById("topbarBackBtn").style.display = "none";
    lapActiveKurirUid = null;
    loadLapKurirList();
  });
};

let lapActiveKurirUid = null;

async function loadLapKurirList() {
  const listEl = document.getElementById("lapKurirList");
  if (!listEl) return;

  listEl.innerHTML = [1,2,3].map(() => `
    <div class="lap-kurir-item" style="pointer-events:none">
      <div class="lap-kurir-avatar sk" style="background:none"></div>
      <div class="lap-kurir-info">
        <div class="sk" style="height:13px;width:100px;margin-bottom:6px;border-radius:6px"></div>
        <div class="sk" style="height:11px;width:60px;border-radius:6px"></div>
      </div>
    </div>`).join("");
  if (!window.usersCache?.length) {
    window.usersCache = await window.idb.getUsers();
  }
  const users = (await window.idb.getUsers())
    .filter(u => u.role === "kurir");

  renderLapKurirList(users);
}

function renderLapKurirList(users = []) {
  const listEl = document.getElementById("lapKurirList");
  if (!listEl) return;

  if (!users.length) {
    listEl.innerHTML = `<div class="lap-empty-msg">Belum ada kurir.</div>`;
    return;
  }

  listEl.innerHTML = users.map(u => {
    const nama    = u.nama || "Tanpa Nama";
    const inisial = nama.trim().charAt(0).toUpperCase();
    const avatar  = u.foto
      ? `<img src="${esc(u.foto)}" alt="${esc(nama)}">`
      : inisial;
    return `
      <div class="lap-kurir-item ${lapActiveKurirUid === u.uid ? "active" : ""}" data-uid="${esc(u.uid)}">
        <div class="lap-kurir-avatar">${avatar}</div>
        <div class="lap-kurir-info">
          <div class="lap-kurir-nama">${esc(nama)}</div>
          <div class="lap-kurir-role">${esc(u.role || "-")}</div>
        </div>
        <i class="fa-solid fa-chevron-right lap-kurir-arrow"></i>
      </div>`;
  }).join("");

  listEl.querySelectorAll(".lap-kurir-item").forEach(item => {
    item.addEventListener("click", () => {
      listEl.querySelectorAll(".lap-kurir-item").forEach(x => x.classList.remove("active"));
      item.classList.add("active");
      const uid  = item.dataset.uid;
      const user = users.find(u => u.uid === uid);
      selectLapKurir(user);
    });
  });
}

async function selectLapKurir(user) {
  if (!user) return;
  lapActiveKurirUid = user.uid;

  const empty   = document.getElementById("lapDetailEmpty");
  const content = document.getElementById("lapDetailContent");
  const wrapper = document.getElementById("lapDetailWrapper");

  if (empty)   empty.style.display   = "none";
  if (content) content.style.display = "flex";
  if (wrapper) wrapper.classList.add("show");

  if (window.innerWidth <= 768) {
    const backBtn = document.getElementById("topbarBackBtn");
    if (backBtn) backBtn.style.display = "flex";
  }

  // isi header
  const nama    = user.nama || "Tanpa Nama";
  const inisial = nama.trim().charAt(0).toUpperCase();
  const avatarEl = document.getElementById("lapDetailAvatar");
  if (avatarEl) avatarEl.innerHTML = user.foto
    ? `<img src="${esc(user.foto)}" alt="${esc(nama)}">`
    : inisial;
  const namaEl = document.getElementById("lapDetailNama");
  if (namaEl) namaEl.textContent = nama;
  const roleEl = document.getElementById("lapDetailRole");
  if (roleEl) roleEl.textContent = user.role || "-";
  const dateEl = document.getElementById("lapDetailDate");
  if (dateEl && !dateEl.value) dateEl.value = getLapTanggalLocal();

  // date change
  const dateInput = document.getElementById("lapDetailDate");
  if (dateInput) {
    const newDate = dateInput.cloneNode(true);
    dateInput.parentNode.replaceChild(newDate, dateInput);
    newDate.addEventListener("change", async () => {
      await renderLapDetail(user, newDate.value);
    });
  }

  await renderLapDetail(user, document.getElementById("lapDetailDate")?.value || getLapTanggalLocal());
}
function esc(str) {
  return String(str)
    .replace(/&/g,"&amp;").replace(/</g,"&lt;")
    .replace(/>/g,"&gt;").replace(/"/g,"&quot;");
}
/* ── RENDER LAP DETAIL ── */
async function renderLapDetail(user, tanggal) {
  // reset frozen badge dulu apapun kondisinya
  document.getElementById("lapInfoFrozen")?.classList.remove("show");
  document.getElementById("lapKeuFrozen")?.classList.remove("show");
  window._lapIsFrozen = false;

  const data = await window.idb.getDataHarian(user.uid, tanggal);
  if (!data) {
    renderLapCards(null, user);
    return;
  }

  // reset dulu sebelum fetch
  document.getElementById("lapInfoFrozen")?.classList.remove("show");
  document.getElementById("lapKeuFrozen")?.classList.remove("show");
  window._lapIsFrozen = false;

  // ambil infoTarget dari Firestore jika sudah ada
  let frozenInfoTarget = null;
  try {
    const snap = await window.getDoc(
      window.doc(window.db, "users", user.uid, "laporanMarketing", tanggal)
    );
    if (snap.exists()) {
      const it = snap.data()?.distribusi?.infoTarget;
      if (it) {
        frozenInfoTarget = it;
        document.getElementById("lapInfoFrozen")?.classList.add("show");
      }
    }
  } catch {}

  renderLapCards(data, user, frozenInfoTarget);
}
function renderLapCards(data, user, frozenInfoTarget = null) {
  if (!data) {
    document.querySelectorAll(".lap-varian-val").forEach(el => el.textContent = "0");
    document.querySelectorAll(".lap-jumlah-val").forEach(el => el.textContent = "0");
    document.querySelectorAll(".lap-info-val").forEach(el => el.textContent = "0");
    document.querySelectorAll(".lap-keuangan-val").forEach(el => el.textContent = "Rp 0");
    window._lapCurrentData = null;
    window._lapCurrentUser = user;
    return;
  }

  const varian = (user.varian || [])
    .filter(v => { const k = Object.keys(v)[0]; return k && v[k]?.isAktif; })
    .map(v => Object.keys(v)[0]);
  const renderVarianGrid = (obj) => {
    if (!varian.length) return `<div class="lap-varian-item"><div class="lap-varian-key">-</div><div class="lap-varian-val">-</div></div>`;
    const src = data?.[obj] || {};
    return varian.map(v => `
      <div class="lap-varian-item">
        <div class="lap-varian-key">${esc(v)}</div>
        <div class="lap-varian-val">${Number(src[v] || 0)}</div>
      </div>`).join("");
  };

  const sumObj = (obj) => {
    const src = data?.[obj] || {};
    return varian.reduce((acc, v) => acc + (Number(src[v] || 0)), 0);
  };

  // closing
  const closingGrid = document.querySelector(".lap-report-card.closing .lap-varian-grid");
  const closingJml  = document.querySelector(".lap-report-card.closing .lap-jumlah-val");
  if (closingGrid) closingGrid.innerHTML = renderVarianGrid("closing");
  if (closingJml)  closingJml.textContent = sumObj("closing");

  // pay
  const payGrid = document.querySelector(".lap-report-card.pay .lap-varian-grid");
  const payJml  = document.querySelector(".lap-report-card.pay .lap-jumlah-val");
  if (payGrid) payGrid.innerHTML = renderVarianGrid("pay");
  if (payJml)  payJml.textContent = sumObj("pay");

  // expired
  const expiredGrid = document.querySelector(".lap-report-card.expired .lap-varian-grid");
  const expiredJml  = document.querySelector(".lap-report-card.expired .lap-jumlah-val");
  if (expiredGrid) expiredGrid.innerHTML = renderVarianGrid("expired");
  if (expiredJml)  expiredJml.textContent = sumObj("expired");

  // fee
  const feeGrid = document.querySelector(".lap-report-card.fee .lap-varian-grid");
  const feeJml  = document.querySelector(".lap-report-card.fee .lap-jumlah-val");
  if (feeGrid) feeGrid.innerHTML = renderVarianGrid("fee");
  if (feeJml)  feeJml.textContent = sumObj("fee");

  // disable
  const disableGrid = document.querySelector(".lap-report-card.disable .lap-varian-grid");
  const disableJml  = document.querySelector(".lap-report-card.disable .lap-jumlah-val");
  if (disableGrid) disableGrid.innerHTML = renderVarianGrid("disable");
  if (disableJml)  disableJml.textContent = sumObj("disable");

  // info target — pakai frozen dari Firestore jika ada, fallback ke IDB
  const cl  = frozenInfoTarget?.customerLama     ?? data?.customerLama     ?? 0;
  const ct  = frozenInfoTarget?.customerTambahan ?? data?.customerTambahan ?? 0;
  const cn  = frozenInfoTarget?.customerNew      ?? data?.customerNew      ?? 0;
  const jml = frozenInfoTarget?.jumlahCustomer   ?? (cl + ct + cn);
  const kun = frozenInfoTarget?.kunjungan        ?? data?.kunjungan        ?? 0;

  document.querySelector(".lap-report-card.target .lap-info-row:nth-child(2) .lap-info-val")
    && (document.querySelectorAll(".lap-report-card.target .lap-info-val")[0].textContent = cl);
  document.querySelectorAll(".lap-report-card.target .lap-info-val")[1]
    && (document.querySelectorAll(".lap-report-card.target .lap-info-val")[1].textContent = ct);
  document.querySelectorAll(".lap-report-card.target .lap-info-val")[2]
    && (document.querySelectorAll(".lap-report-card.target .lap-info-val")[2].textContent = cn);
  document.querySelectorAll(".lap-report-card.target .lap-info-val")[3]
    && (document.querySelectorAll(".lap-report-card.target .lap-info-val")[3].textContent = jml);

  // keuangan
  const omset = data?.pembayaran?.bayarKonsumen || 0;
  const omsetEl = document.querySelector(".lap-keuangan-item.omset .lap-keuangan-val");
  if (omsetEl) omsetEl.textContent = `Rp ${Number(omset).toLocaleString("id-ID")}`;

  // simpan state untuk popup
  window._lapCurrentData = data;
  window._lapCurrentUser = user;

  // kalkulasi bonus untuk card
  (async () => {
    const kantorCabang = await window.idb.getKantorCabang();
    const bonus        = kantorCabang?.bonus || {};
    const tgCust       = Number(bonus?.data?.targetCustomer) || 0;
    const keteranganTarget = kun - tgCust;
    const payData      = data?.pay     || {};
    const expiredData  = data?.expired || {};

    // bonus insentif
    let bonusInsentif = 0;
    if (keteranganTarget >= 0) bonusInsentif = Number(bonus?.data?.insentif) || 0;

    // bonus kunjungan
    let bonusKunjungan = 0;
    const cb    = bonus?.customer || {};
    const tgKun = Number(cb?.target)    || 0;
    const keli  = Number(cb?.kelipatan) || 1;
    const uang  = Number(cb?.uang)      || 0;
    if (kun > tgKun) {
      const kali = Math.floor((kun - tgKun - 1) / keli) + 1;
      bonusKunjungan = kali * uang;
    }

    // bonus pay
    let bonusPay = 0;
    const activeVarian = (user?.varian || [])
      .filter(v => { const k = Object.keys(v)[0]; return k && v[k]?.isAktif; });
    const sumExpired = activeVarian.reduce((acc, v) => {
      const k = Object.keys(v)[0]; return acc + (Number(expiredData[k]) || 0);
    }, 0);
    const ketentuan = Number(bonus?.ketentuan) || 0;
    if (sumExpired <= ketentuan) {
      const sumPay = activeVarian.reduce((acc, v) => {
        const k = Object.keys(v)[0]; return acc + (Number(payData[k]) || 0);
      }, 0);
      if (sumPay >= 180) {
        Object.values(bonus?.margin || {}).forEach(obj => {
          const min = Number(obj.minimal) || 0, max = Number(obj.maksimal) || 0, u = Number(obj.uang) || 0;
          if (sumPay >= min && sumPay <= max) bonusPay = u;
        });
      }
    }

    const totalBonus   = bonusKunjungan + bonusPay;
    const kasbon       = data?.distribusi?.keuangan?.kasbon || 0;
    const fmt          = v => `Rp ${v.toLocaleString("id-ID")}`;

    const bonusEl    = document.querySelector(".lap-keuangan-item.bonus .lap-keuangan-val");
    const insentifEl = document.querySelector(".lap-keuangan-item.insentif .lap-keuangan-val");
    const kasbonEl   = document.querySelector(".lap-keuangan-item.kasbon .lap-keuangan-val");
    if (bonusEl)    bonusEl.textContent    = fmt(totalBonus);
    if (insentifEl) insentifEl.textContent = fmt(bonusInsentif);
    if (kasbonEl)   kasbonEl.textContent   = fmt(kasbon);
  })();
}

function getLapTanggalLocal() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,"0")}-${String(now.getDate()).padStart(2,"0")}`;
}
/* ── MODAL EDIT KEUANGAN ── */
function initKeuanganModal() {
  const overlay = document.getElementById("lapKeuOverlay");
  const box     = document.getElementById("lapKeuBox");
  const header  = document.getElementById("lapKeuHeader");

  // format ribuan
  ["lapKeuOmset","lapKeuInsentif","lapKeuKasbon"].forEach(id => {
    document.getElementById(id)?.addEventListener("input", e => {
      const angka = e.target.value.replace(/\D/g, "");
      e.target.value = angka ? Number(angka).toLocaleString("id-ID") : "";
      hitungKeuangan();
      if (id === "lapKeuOmset") cekOmsetRef();
    });
  });

  // close
  document.getElementById("lapKeuClose")?.addEventListener("click", closeKeuModal);
  overlay?.addEventListener("click", e => { if (e.target === overlay) closeKeuModal(); });

  // desktop drag
  if (window.innerWidth > 768 && header) {
    let dragging = false, offX = 0, offY = 0;
    header.addEventListener("mousedown", e => {
      if (e.target.closest("button")) return;
      dragging = true;
      const rect = box.getBoundingClientRect();
      box.style.cssText += ";position:fixed;margin:0;";
      box.style.left = rect.left + "px";
      box.style.top  = rect.top  + "px";
      offX = e.clientX - rect.left;
      offY = e.clientY - rect.top;
      document.body.style.userSelect = "none";
    });
    document.addEventListener("mousemove", e => {
      if (!dragging) return;
      box.style.left = Math.max(0, Math.min(e.clientX - offX, window.innerWidth  - box.offsetWidth))  + "px";
      box.style.top  = Math.max(0, Math.min(e.clientY - offY, window.innerHeight - box.offsetHeight)) + "px";
    });
    document.addEventListener("mouseup", () => { dragging = false; document.body.style.userSelect = ""; });
  }

  // mobile swipe close
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
      box.style.transition = "transform .28s ease";
      if (curY - startY > 100) {
        box.style.transform = "translateY(100%)";
        setTimeout(() => { closeKeuModal(); box.style.transform = ""; box.style.transition = ""; }, 280);
      } else { box.style.transform = ""; }
    });
  }
}

async function openKeuModal(tanggal) {
  const overlay  = document.getElementById("lapKeuOverlay");
  const box      = document.getElementById("lapKeuBox");
  const subtitle = document.getElementById("lapKeuSubtitle");
  if (subtitle && tanggal) {
    subtitle.textContent = new Date(tanggal + "T00:00:00").toLocaleDateString("id-ID", {
      weekday: "long", day: "numeric", month: "long", year: "numeric"
    });
  }
  box.style.cssText = "";
  overlay?.classList.add("show");

  const data         = window._lapCurrentData;
  const user         = window._lapCurrentUser;
  const kantorCabang = await window.idb.getKantorCabang();
  const bonus        = kantorCabang?.bonus || {};

  // ambil infoTarget frozen dari Firestore jika ada
  let it = null;
  try {
    const snapIt = await window.getDoc(
      window.doc(window.db, "users", user.uid, "laporanMarketing", tanggal)
    );
    if (snapIt.exists()) it = snapIt.data()?.distribusi?.infoTarget || null;
  } catch {}

  const cl  = it?.customerLama     ?? data?.customerLama     ?? 0;
  const ct  = it?.customerTambahan ?? data?.customerTambahan ?? 0;
  const cn  = it?.customerNew      ?? data?.customerNew      ?? 0;
  const jml = it?.jumlahCustomer   ?? (cl + ct + cn);
  const kun = it?.kunjungan        ?? data?.kunjungan        ?? 0;
  const tgCust = Number(bonus?.data?.targetCustomer) || 0;
  const keteranganTarget = kun - tgCust;

  const payData     = data?.pay     || {};
  const expiredData = data?.expired || {};

  // bonus insentif
  let bonusInsentif = 0;
  if (keteranganTarget >= 0) bonusInsentif = Number(bonus?.data?.insentif) || 0;

  // bonus kunjungan
  let bonusKunjungan = 0;
  const cb     = bonus?.customer || {};
  const tgKun  = Number(cb?.target)    || 0;
  const keli   = Number(cb?.kelipatan) || 1;
  const uang   = Number(cb?.uang)      || 0;
  if (kun > tgKun) {
    const kali = Math.floor((kun - tgKun - 1) / keli) + 1;
    bonusKunjungan = kali * uang;
  }

  // bonus pay
  let bonusPay = 0;
  const activeVarian = (user?.varian || [])
    .filter(v => { const k = Object.keys(v)[0]; return k && v[k]?.isAktif; });
  const sumExpired = activeVarian.reduce((acc, v) => {
    const k = Object.keys(v)[0]; return acc + (Number(expiredData[k]) || 0);
  }, 0);
  const ketentuan = Number(bonus?.ketentuan) || 0;
  if (sumExpired <= ketentuan) {
    const sumPay = activeVarian.reduce((acc, v) => {
      const k = Object.keys(v)[0]; return acc + (Number(payData[k]) || 0);
    }, 0);
    if (sumPay >= 180) {
      Object.values(bonus?.margin || {}).forEach(obj => {
        const min = Number(obj.minimal) || 0, max = Number(obj.maksimal) || 0, u = Number(obj.uang) || 0;
        if (sumPay >= min && sumPay <= max) bonusPay = u;
      });
    }
  }
  // cek off target data — disable klaim insentif
  const kun2  = data?.kunjungan || 0;
  const cl2   = data?.customerLama     || 0;
  const ct2   = data?.customerTambahan || 0;
  const cn2   = data?.customerNew      || 0;
  const cJml2 = cl2 + ct2 + cn2;
  const ofTarget2 = kun2 - cJml2;
  const insentifInput = document.getElementById("lapKeuInsentif");
  const insentifNote  = document.getElementById("lapKeuInsentifNote");
  if (ofTarget2 < 0) {
    if (insentifInput) { insentifInput.disabled = true; insentifInput.value = ""; }
    if (insentifNote)  insentifNote.style.display = "flex";
  } else {
    if (insentifInput) insentifInput.disabled = false;
    if (insentifNote)  insentifNote.style.display = "none";
  }
  const omsetData = data?.pembayaran?.bayarKonsumen || 0;
  window._lapOmsetData = omsetData;
  const refEl = document.getElementById("lapKeuOmsetRef");
  if (refEl) refEl.textContent = `Omset by data: Rp ${omsetData.toLocaleString("id-ID")}`;
  window._lapBonusInsentif   = bonusInsentif;
  window._lapBonusKunjungan  = bonusKunjungan;
  window._lapBonusPay        = bonusPay;

  // load existing dari Firestore laporanMarketing
  try {
    const snap = await window.getDoc(
      window.doc(window.db, "users", user.uid, "laporanMarketing", tanggal)
    );
    const keuangan = snap.exists() ? (snap.data()?.distribusi?.keuangan || {}) : {};
    const isFrozen = snap.exists() && !!snap.data()?.distribusi?.infoTarget;
    document.getElementById("lapKeuFrozen")?.classList.toggle("show", isFrozen);
    window._lapIsFrozen = isFrozen;
    const setInput = (id, val) => {
      const el = document.getElementById(id);
      if (!el) return;
      el.value = val > 0 ? Number(val).toLocaleString("id-ID") : "";
    };
    setInput("lapKeuOmset",    keuangan.inputOmset    || 0);
    setInput("lapKeuInsentif", keuangan.klaimInsentif || 0);
    setInput("lapKeuKasbon",   keuangan.kasbon        || 0);
    cekOmsetRef();
  } catch {}
  hitungKeuangan();
}
function closeKeuModal() {
  document.getElementById("lapKeuOverlay")?.classList.remove("show");
}
function hitungKeuangan() {
  const parse = id => Number((document.getElementById(id)?.value || "").replace(/\./g, "")) || 0;
  const omset    = parse("lapKeuOmset");
  const insentif = parse("lapKeuInsentif");
  const kasbon   = parse("lapKeuKasbon");

  const bonusPay       = window._lapBonusPay       || 0;
  const bonusKunjungan = window._lapBonusKunjungan  || 0;
  const bonusInsentif  = window._lapBonusInsentif   || 0;
  const totalBonus     = bonusPay + bonusKunjungan + bonusInsentif;
  const total          = omset + totalBonus - kasbon;

  const fmt = v => `Rp ${v.toLocaleString("id-ID")}`;
  const set = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = fmt(val); };

  set("lapKeuBonusPay",       bonusPay);
  set("lapKeuBonusKunjungan", bonusKunjungan);
  set("lapKeuBonusInsentif",  bonusInsentif);
  set("lapKeuBonusTotal",     totalBonus);
}
function cekOmsetRef() {
  const refEl  = document.getElementById("lapKeuOmsetRef");
  if (!refEl) return;
  const input  = Number((document.getElementById("lapKeuOmset")?.value || "").replace(/\./g, "")) || 0;
  const omsetData = window._lapOmsetData || 0;
  refEl.classList.remove("match", "nomatch");
  if (input === 0) return;
  if (input === omsetData) refEl.classList.add("match");
  else refEl.classList.add("nomatch");
}
window.simpanKeuangan = simpanKeuangan;

async function simpanKeuangan() {
  const btn = document.getElementById("lapKeuSave");
  if (!btn) return;

  // cek omset
  const inputOmsetVal = Number((document.getElementById("lapKeuOmset")?.value || "").replace(/\./g, "")) || 0;
  if (!inputOmsetVal) {
    showPeringatan("Omset belum dicatat");
    return;
  }

  // konfirmasi freeze info target jika belum pernah simpan
  if (!window._lapIsFrozen) {
    const data = window._lapCurrentData;
    const it   = window._lapCurrentData;
    const cl   = it?.customerLama     || 0;
    const ct   = it?.customerTambahan || 0;
    const cn   = it?.customerNew      || 0;
    const jml  = cl + ct + cn;
    const kun  = it?.kunjungan        || 0;
    const oT   = kun - jml;

    const confirmed = await showKonfirmasiFrozen({ cl, ct, cn, jml, kun, oT });
    if (!confirmed) return;
  }

  btn.disabled    = true;
  btn.textContent = "Menyimpan...";
  try {
    const data         = window._lapCurrentData;
    const user         = window._lapCurrentUser;
    const kantorCabang = await window.idb.getKantorCabang();
    const adminUid     = window.auth?.currentUser?.uid;
    const tanggal      = document.getElementById("lapDetailDate")?.value || getLapTanggalLocal();

    const parse = id => Number((document.getElementById(id)?.value || "").replace(/\./g, "")) || 0;
    const inputOmset    = parse("lapKeuOmset");
    const klaimInsentif = parse("lapKeuInsentif");
    const kasbon        = parse("lapKeuKasbon");

    const bonusPay       = window._lapBonusPay       || 0;
    const bonusKunjungan = window._lapBonusKunjungan  || 0;
    const bonusInsentif  = window._lapBonusInsentif   || 0;
    const jumlahBonus    = bonusPay + bonusKunjungan + bonusInsentif;

    const omset      = data?.pembayaran?.bayarKonsumen || 0;
    const pay        = { ...data?.pay     || {} };
    const expired    = { ...data?.expired || {} };
    const kun        = data?.kunjungan  || 0;
    const cl         = data?.customerLama     || 0;
    const ct         = data?.customerTambahan || 0;
    const cn         = data?.customerNew      || 0;
    const cJml       = cl + ct + cn;
    const kTutup     = data?.keterangan?.tutup   || 0;
    const kPend      = data?.keterangan?.pending || 0;
    const kPutus     = data?.keterangan?.putus   || 0;
    const tgCust     = Number(kantorCabang?.bonus?.data?.targetCustomer) || 0;
    const oT         = kun - cJml;
    const kT         = kun - tgCust;
    const upahHarian = Number(kantorCabang?.upahHarian) || 0;

    // harga produksi per varian dari kurir
    const hargaMap = {};
    (user?.varian || []).forEach(v => {
      const k = Object.keys(v)[0];
      if (k) hargaMap[k] = Number(v[k]?.hargaProduksi) || 0;
    });
    // closing dari IDB
    const closingData = data?.closing || {};
    const jumlahUangClosing = Object.entries(closingData).reduce((acc, [k, v]) => acc + (Number(v) || 0) * (hargaMap[k] || 0), 0);
    const grossMargin = inputOmset - jumlahUangClosing;

    // hitung pay.margin dan expired.margin
    const hargaKonsumenMap = {};
    (user?.varian || []).forEach(v => {
      const k = Object.keys(v)[0];
      if (k) hargaKonsumenMap[k] = Number(v[k]?.hargaKonsumen) || 0;
    });
    let payMargin = 0;
    Object.entries(pay).forEach(([k, v]) => {
      payMargin += (Number(v) || 0) * ((hargaKonsumenMap[k] || 0) - (hargaMap[k] || 0));
    });
    let expiredMargin = 0;
    Object.entries(expired).forEach(([k, v]) => {
      expiredMargin += (Number(v) || 0) * (hargaMap[k] || 0);
    });
    pay.margin     = payMargin;
    expired.margin = expiredMargin;

    const potonganTargetData = oT < 0 ? (Number(kantorCabang?.bonus?.data?.insentif) || 0) : 0;

    const distribusi = {
      expired, pay,
      infoTarget: {
        kunjungan: kun, tutup: kTutup, pending: kPend, putus: kPutus,
        targetData: oT, targetCustomer: kT,
        customerLama: cl, customerTambahan: ct, customerNew: cn, jumlahCustomer: cJml,
        potongan: { potonganTargetData, potonganTargetCustomer: 0, jumlahPotongan: potonganTargetData }
      },
      keuangan: {
        omset, inputOmset, grossMargin,
        profitSekarang: grossMargin - jumlahBonus - upahHarian,
        profitKemarin:  payMargin - expiredMargin - jumlahBonus - upahHarian,
        klaimInsentif, kasbon,
        bonus: { bonusInsentif, bonusKunjungan, bonusPay, jumlahBonus }
      }
    };

    // 1. simpan ke laporanAdmin — update jika sudah ada, buat jika belum
    const laporanAdminRef = window.doc(window.db, "users", adminUid, "laporanAdmin", tanggal);
    const laporanAdminSnap = await window.getDoc(laporanAdminRef);
    if (laporanAdminSnap.exists()) {
      await window.updateDoc(laporanAdminRef, {
        tanggal,
        [`${user.uid}.distribusi`]: distribusi
      });
    } else {
      await window.setDoc(laporanAdminRef, {
        tanggal,
        [user.uid]: { distribusi }
      });
    }

    // 2. simpan ke laporanMarketing kurir
    await window.setDoc(
      window.doc(window.db, "users", user.uid, "laporanMarketing", tanggal),
      { distribusi },
      { merge: true }
    );

    // 3. update IDB dataHarian
    const existing = await window.idb.getDataHarian(user.uid, tanggal);
    if (existing) {
      await window.idb.saveDataHarian(user.uid, tanggal, {
        ...existing,
        pay, expired,
        kunjungan: kun,
        customerLama: cl, customerTambahan: ct, customerNew: cn,
        keterangan: { tutup: kTutup, pending: kPend, putus: kPutus },
        distribusi
      });
    }

    window.showToast("Berhasil disimpan", "success");
    closeKeuModal();
    // update card keuangan langsung
    const updatedData = await window.idb.getDataHarian(user.uid, tanggal);
    if (updatedData) renderLapCards(updatedData, user);
  } catch (err) {
    console.error("❌ simpanKeuangan:", err);
    window.showToast("Gagal menyimpan", "error");
  } finally {
    btn.disabled    = false;
    btn.textContent = "Simpan";
  }
}
function showKonfirmasiFrozen({ cl, ct, cn, jml, kun, oT }) {
  return new Promise(resolve => {
    const existing = document.getElementById("lapFrozenConfirmOverlay");
    if (existing) existing.remove();

    const el = document.createElement("div");
    el.id = "lapFrozenConfirmOverlay";
    el.className = "lap-frozen-overlay";
    el.innerHTML = `
      <div class="lap-frozen-box">
        <div class="lap-frozen-icon">🔒</div>
        <div class="lap-frozen-title">Info Target akan dibekukan setelah simpan</div>
        <div class="lap-frozen-desc">Pastikan data berikut sudah benar sebelum disimpan.</div>
        <div class="lap-frozen-data">
          <div class="lap-frozen-row"><span class="lap-frozen-row-label">Kunjungan</span><span class="lap-frozen-row-val">${kun}</span></div>
          <div class="lap-frozen-row"><span class="lap-frozen-row-label">Cust Lama</span><span class="lap-frozen-row-val">${cl}</span></div>
          <div class="lap-frozen-row"><span class="lap-frozen-row-label">Tambahan</span><span class="lap-frozen-row-val">${ct}</span></div>
          <div class="lap-frozen-row"><span class="lap-frozen-row-label">Baru</span><span class="lap-frozen-row-val">${cn}</span></div>
          <div class="lap-frozen-row"><span class="lap-frozen-row-label">Jumlah</span><span class="lap-frozen-row-val">${jml}</span></div>
          <div class="lap-frozen-row"><span class="lap-frozen-row-label">Target Data</span><span class="lap-frozen-row-val ${oT < 0 ? 'danger' : 'success'}">${oT}</span></div>
        </div>
        <div class="lap-frozen-footer">
          <button id="lapFrozenNo"  class="lap-frozen-btn-cancel">Periksa Lagi</button>
          <button id="lapFrozenYes" class="lap-frozen-btn-save">Ya, Simpan</button>
        </div>
      </div>`;
    document.body.appendChild(el);

    document.getElementById("lapFrozenYes").onclick = () => { el.remove(); resolve(true); };
    document.getElementById("lapFrozenNo").onclick  = () => { el.remove(); resolve(false); };
  });
}
function showPeringatan(pesan) {
  const existing = document.getElementById("lapPeringatanOverlay");
  if (existing) existing.remove();

  const el = document.createElement("div");
  el.id = "lapPeringatanOverlay";
  el.style.cssText = `position:fixed;inset:0;z-index:2000;background:rgba(0,0,0,0.4);
    display:flex;align-items:center;justify-content:center;`;
  el.innerHTML = `
    <div style="background:var(--bg-card);border-radius:16px;padding:24px;width:calc(100%-48px);
      max-width:320px;text-align:center;box-shadow:0 20px 48px rgba(0,0,0,0.2);">
      <div style="font-size:32px;margin-bottom:12px;">⚠️</div>
      <div style="font-size:14px;font-weight:700;color:var(--text-primary);margin-bottom:20px;">${pesan}</div>
      <button style="width:100%;height:40px;border:none;border-radius:10px;
        background:linear-gradient(135deg,var(--brand-primary),var(--brand-mid));
        color:#fff;font-family:'Poppins',sans-serif;font-size:13px;font-weight:700;cursor:pointer;"
        onclick="document.getElementById('lapPeringatanOverlay').remove()">Oke</button>
    </div>`;
  document.body.appendChild(el);
}
window.openKeuModal  = openKeuModal;
window.initKeuanganModal = initKeuanganModal;

/* ── MODAL INFO TARGET ── */
function initTargetModal() {
  const overlay = document.getElementById("lapTargetOverlay");
  const box     = document.getElementById("lapTargetBox");

  document.getElementById("lapTargetClose")?.addEventListener("click", () => overlay?.classList.remove("show"));
  overlay?.addEventListener("click", e => { if (e.target === overlay) overlay.classList.remove("show"); });

  // mobile swipe
  if (window.innerWidth <= 768) {
    let startY = 0, curY = 0, drag = false;
    box.addEventListener("touchstart", e => { startY = curY = e.touches[0].clientY; drag = true; box.style.transition = "none"; }, { passive: true });
    box.addEventListener("touchmove",  e => { if (!drag) return; curY = e.touches[0].clientY; const dy = curY - startY; if (dy < 0) return; box.style.transform = `translateY(${dy}px)`; }, { passive: true });
    box.addEventListener("touchend",   () => { drag = false; box.style.transition = "transform .28s ease"; if (curY - startY > 100) { box.style.transform = "translateY(100%)"; setTimeout(() => { overlay.classList.remove("show"); box.style.transform = ""; box.style.transition = ""; }, 280); } else { box.style.transform = ""; } });
  }
}
async function openTargetModal(tanggal) {
  const overlay  = document.getElementById("lapTargetOverlay");
  const subtitle = document.getElementById("lapTargetSubtitle");
  if (subtitle && tanggal) {
    subtitle.textContent = new Date(tanggal + "T00:00:00").toLocaleDateString("id-ID", {
      weekday: "long", day: "numeric", month: "long", year: "numeric"
    });
  }

  const data         = window._lapCurrentData;
  const kantorCabang = await window.idb.getKantorCabang();

  // ambil infoTarget dari Firestore jika ada, fallback ke IDB
  let it = null;
  try {
    const snap = await window.getDoc(
      window.doc(window.db, "users", window._lapCurrentUser?.uid, "laporanMarketing", tanggal)
    );
    if (snap.exists()) it = snap.data()?.distribusi?.infoTarget || null;
  } catch {}

  const cl  = it?.customerLama     ?? data?.customerLama     ?? 0;
  const ct  = it?.customerTambahan ?? data?.customerTambahan ?? 0;
  const cn  = it?.customerNew      ?? data?.customerNew      ?? 0;
  const jml = it?.jumlahCustomer   ?? (cl + ct + cn);
  const kun = it?.kunjungan        ?? data?.kunjungan        ?? 0;
  const tgCust = Number(kantorCabang?.bonus?.data?.targetCustomer) || 0;
  const ofTarget         = it?.targetData     ?? (kun - jml);
  const keteranganTarget = it?.targetCustomer ?? (kun - tgCust);

  const set = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
  set("lapTgtKunjungan", kun);
  set("lapTgtData",      ofTarget);
  set("lapTgtCustomer",  keteranganTarget);

  const tutup   = it?.tutup   ?? data?.keterangan?.tutup   ?? 0;
  const pending = it?.pending ?? data?.keterangan?.pending ?? 0;
  const putus   = it?.putus   ?? data?.keterangan?.putus   ?? 0;
  set("lapTgtTutup",   tutup);
  set("lapTgtPending", pending);
  set("lapTgtPutus",   putus);

  // potongan
  const bonusData = kantorCabang?.bonus?.data || {};
  const potongan  = kantorCabang?.potongan    || {};
  const upahHarian = Number(kantorCabang?.upahHarian) || 0;

  let potData     = 0;
  let potCustomer = 0;

  // potongan target data
  if (ofTarget < 0) {
    potData = Number(bonusData?.insentif) || 0;
  }

  // potongan target customer
  const setengahUpah  = potongan?.setengahUpah  || {};
  const kelipatanUpah = potongan?.kelipatanUpah || {};
  const batasPersen   = Number(setengahUpah?.batas)       || 0;
  const potonganPersen = Number(setengahUpah?.potonganUpah) || 0;
  const batasCustomer  = Number(kelipatanUpah?.batas)       || 0;
  let kenaRule = false;

  if (jml >= batasCustomer && batasPersen > 0) {
    const targetKunjungan = Math.floor(jml * (batasPersen / 100));
    if (kun <= targetKunjungan) {
      potCustomer = Math.floor(upahHarian * (potonganPersen / 100));
      kenaRule = true;
    }
  }
  if (!kenaRule) {
    const batas      = Number(kelipatanUpah?.batas)       || 0;
    const kelipatan  = Number(kelipatanUpah?.kelipatan)   || 1;
    const potUpah    = Number(kelipatanUpah?.potonganUpah) || 0;
    if (jml >= batas) {
      const selisih = batas - kun;
      if (selisih > 0) potCustomer = Math.ceil(selisih / kelipatan) * potUpah;
    }
  }

  const fmt = v => v > 0 ? `Rp ${v.toLocaleString("id-ID")}` : "-";
  set("lapTgtPotData",     fmt(potData));
  set("lapTgtPotCustomer", fmt(potCustomer));
  set("lapTgtPotTotal",    fmt(potData + potCustomer));

  overlay?.classList.add("show");
}

window.openTargetModal = openTargetModal;

/* ── TABEL DISTRIBUSI ── */
async function initLapTabel() {
  // isi dropdown kurir
  const list     = document.getElementById("lapTabelDropdownList");
  const trigger  = document.getElementById("lapTabelDropdownTrigger");
  const label    = document.getElementById("lapTabelDropdownLabel");
  const hidden   = document.getElementById("lapTabelFilterKurir");
  const dropdown = document.getElementById("lapTabelDropdown");

  if (list && list.children.length === 0) {
    let users = (window.usersCache || []).filter(u => ["kurir","sales","hunter"].includes(u.role));
    if (!users.length) {
      const all = await window.idb.getUsers();
      users = all.filter(u => ["kurir","sales","hunter"].includes(u.role));
    }

    if (!users.length) {
      list.innerHTML = `<div class="lap-tabel-dropdown-item-empty">Belum ada kurir</div>`;
    } else {
      list.innerHTML = users.map(u => `
        <div class="lap-tabel-dropdown-item" data-uid="${esc(u.uid)}" data-nama="${esc(u.nama || 'Tanpa Nama')}">
          ${esc(u.nama || 'Tanpa Nama')}
        </div>`).join("");

      list.querySelectorAll(".lap-tabel-dropdown-item").forEach(item => {
        item.addEventListener("click", () => {
          list.querySelectorAll(".lap-tabel-dropdown-item").forEach(x => x.classList.remove("active"));
          item.classList.add("active");
          if (label) label.textContent = item.dataset.nama;
          if (hidden) hidden.value = item.dataset.uid;
          dropdown?.classList.remove("open");
        });
      });
    }

    trigger?.addEventListener("click", e => { e.stopPropagation(); dropdown?.classList.toggle("open"); });
    document.addEventListener("click", e => {
      if (!dropdown?.contains(e.target)) dropdown?.classList.remove("open");
    });
  }

  // default tanggal
  const today = getLapTanggalLocal();
  const from  = document.getElementById("lapTabelDateFrom");
  const to    = document.getElementById("lapTabelDateTo");
  if (from && !from.value) {
    const d = new Date(today);
    d.setDate(1);
    from.value = d.toISOString().slice(0, 10);
  }
  if (to && !to.value) to.value = today;
  document.getElementById("lapTabelExportPng")?.addEventListener("click", () => {
    const nama = document.getElementById("lapTabelDropdownLabel")?.textContent || "kurir";
    window.exportTabelPNG("lapTabelScroll", `tabel_distribusi_${nama}`);
  });
  document.getElementById("lapTabelExportCsv")?.addEventListener("click", () => {
    const nama = document.getElementById("lapTabelDropdownLabel")?.textContent || "kurir";
    window.exportTabelCSV("lapTabelScroll", `tabel_distribusi_${nama}`);
  });
  document.getElementById("lapTabelClose")?.addEventListener("click", () => {
    document.getElementById("lapTabelWrapper")?.classList.remove("show");
    const bottomNav = document.getElementById("bottomNav");
    if (bottomNav) bottomNav.style.display = "";
  });

  document.getElementById("lapTabelApply")?.addEventListener("click", renderLapTabel);
}

async function renderLapTabel() {
  const scroll = document.getElementById("lapTabelScroll");
  if (!scroll) return;
  scroll.innerHTML = `<div class="dh-ringkasan-empty">Memuat...</div>`;

  const filterUid = document.getElementById("lapTabelFilterKurir")?.value || "";
  const dateFrom  = document.getElementById("lapTabelDateFrom")?.value || "";
  const dateTo    = document.getElementById("lapTabelDateTo")?.value   || "";

  if (!filterUid) { scroll.innerHTML = `<div class="dh-ringkasan-empty">Pilih kurir terlebih dahulu</div>`; return; }
  if (!dateFrom || !dateTo) { scroll.innerHTML = `<div class="dh-ringkasan-empty">Pilih tanggal terlebih dahulu</div>`; return; }

  const user = (window.usersCache || []).find(u => u.uid === filterUid);
  if (!user) return;

  const varian = (user.varian || [])
    .filter(v => { const k = Object.keys(v)[0]; return k && v[k]?.isAktif; })
    .map(v => Object.keys(v)[0]);
  const V = varian.length ? varian : ["CB","BB","BK","MC"];

  const tanggalList = [];
  let cur = new Date(dateFrom + "T00:00:00");
  const end = new Date(dateTo + "T00:00:00");
  while (cur <= end) { tanggalList.push(cur.toISOString().slice(0, 10)); cur.setDate(cur.getDate() + 1); }

  const hariNama = ["Minggu","Senin","Selasa","Rabu","Kamis","Jumat","Sabtu"];

  const COLS = [
    { key: "closing", label: "Closing", cls: "closing", hasJml: true },
    { key: "pay",     label: "Pay",     cls: "pay",     hasJml: true },
    { key: "expired", label: "Expired", cls: "expired", hasJml: true, hasPersen: true },
  ];

  const hargaMapTbl = {};
  (user?.varian || []).forEach(v => { const k = Object.keys(v)[0]; if (k) hargaMapTbl[k] = Number(v[k]?.hargaProduksi) || 0; });

  const CUST_COLS = ["Lama","Tambahan","Baru","Jumlah","Kunjungan","Tgt Data","Tgt Cust"];
  const KEU_COLS  = ["Omset","Input Omset","Bonus","Kasbon"];
  const PAY_COLS  = ["Tagihan","Bayar","Keterangan"];

  const th1 = `<tr>
    <th rowspan="2" style="position:sticky;left:0;z-index:5;background:var(--bg-card);min-width:120px;text-align:left;padding:7px 10px">Tanggal</th>
    ${COLS.map(c => { let span = V.length; if (c.hasJml) span++; if (c.hasPersen) span++; return `<th colspan="${span}" class="lap-dist-th-${c.cls}">${c.label}</th>`; }).join("")}
    <th colspan="${CUST_COLS.length}" class="lap-dist-th-customer">Customer</th>
    <th colspan="${KEU_COLS.length}"  class="lap-dist-th-keuangan">Keuangan</th>
    <th colspan="${PAY_COLS.length}"  class="lap-dist-th-closing">Pembayaran</th>
  </tr>`;
  const th2 = `<tr>
    ${COLS.map(c => {
      const vCols  = V.map(v => `<th class="lap-dist-th-${c.cls}" style="top:31px">${v}</th>`).join("");
      const jml    = c.hasJml    ? `<th class="lap-dist-th-${c.cls}" style="top:31px">JML</th>` : "";
      const persen = c.hasPersen ? `<th class="lap-dist-th-${c.cls}" style="top:31px">%</th>`   : "";
      return vCols + jml + persen;
    }).join("")}
    ${CUST_COLS.map(c => `<th class="lap-dist-th-customer" style="top:31px">${c}</th>`).join("")}
    ${KEU_COLS.map(c  => `<th class="lap-dist-th-keuangan" style="top:31px">${c}</th>`).join("")}
    ${PAY_COLS.map(c  => `<th class="lap-dist-th-closing"  style="top:31px">${c}</th>`).join("")}
  </tr>`;

  // inisialisasi sums
  const mkSums = () => { const s = {}; COLS.forEach(c => { s[c.key] = {}; V.forEach(v => { s[c.key][v] = 0; }); }); return s; };
  const mkCust = () => ({ Lama:0, Tambahan:0, Baru:0, Jumlah:0, Kunjungan:0 });
  const mkKeu  = () => ({ Omset:0, InputOmset:0, Bonus:0, Kasbon:0 });
  const mkPay  = () => ({ Tagihan:0, Bayar:0 });

  const grandSums = mkSums(), grandCust = mkCust(), grandKeu = mkKeu(), grandPay = mkPay();
  let   weekSums  = mkSums(), weekCust  = mkCust(), weekKeu  = mkKeu(), weekPay  = mkPay();
  let weekStart = null;

  const resetWeek = () => { weekSums = mkSums(); weekCust = mkCust(); weekKeu = mkKeu(); weekPay = mkPay(); };

  const buildSumRow = (sums, cust, keu, pay, label, cls = "lap-dist-tr-total") => {
    const sumCells = COLS.map(c => {
      const vCells = V.map(v => `<td class="lap-dist-col-${c.cls} lap-dist-td-sum">${sums[c.key]?.[v] || ""}</td>`).join("");
      const jmlVal = V.reduce((acc, v) => acc + (sums[c.key]?.[v] || 0), 0);
      const jml    = c.hasJml ? `<td class="lap-dist-col-${c.cls} lap-dist-td-sum">${jmlVal || ""}</td>` : "";
      if (c.hasPersen) {
        const sumPay = V.reduce((acc, v) => acc + (sums["pay"]?.[v] || 0), 0);
        const pct    = sumPay > 0 ? Math.round(jmlVal / sumPay * 100) : 0;
        return vCells + jml + `<td class="lap-dist-col-${c.cls} lap-dist-td-sum">${pct ? pct+"%" : ""}</td>`;
      }
      return vCells + jml;
    }).join("");
    return `<tr class="${cls}">
      <td class="lap-dist-td-sum" style="position:sticky;left:0;background:var(--bg-card);text-align:left;padding:6px 10px;white-space:nowrap;font-size:11px">${label}</td>
      ${sumCells}
      <td class="lap-dist-col-customer lap-dist-td-sum">${cust.Lama||""}</td>
      <td class="lap-dist-col-customer lap-dist-td-sum">${cust.Tambahan||""}</td>
      <td class="lap-dist-col-customer lap-dist-td-sum">${cust.Baru||""}</td>
      <td class="lap-dist-col-customer lap-dist-td-sum">${cust.Jumlah||""}</td>
      <td class="lap-dist-col-customer lap-dist-td-sum">${cust.Kunjungan||""}</td>
      <td class="lap-dist-col-customer lap-dist-td-sum"></td>
      <td class="lap-dist-col-customer lap-dist-td-sum"></td>
      <td class="lap-dist-col-keuangan lap-dist-td-sum">${keu.Omset      ? keu.Omset.toLocaleString("id-ID")      : ""}</td>
      <td class="lap-dist-col-keuangan lap-dist-td-sum">${keu.InputOmset ? keu.InputOmset.toLocaleString("id-ID") : ""}</td>
      <td class="lap-dist-col-keuangan lap-dist-td-sum">${keu.Bonus      ? keu.Bonus.toLocaleString("id-ID")      : ""}</td>
      <td class="lap-dist-col-keuangan lap-dist-td-sum">${keu.Kasbon     ? keu.Kasbon.toLocaleString("id-ID")     : ""}</td>
      <td class="lap-dist-col-closing  lap-dist-td-sum">${pay.Tagihan    ? pay.Tagihan.toLocaleString("id-ID")    : ""}</td>
      <td class="lap-dist-col-closing  lap-dist-td-sum">${pay.Bayar      ? pay.Bayar.toLocaleString("id-ID")      : ""}</td>
      <td class="lap-dist-col-closing  lap-dist-td-sum"></td>
    </tr>`;
  };

  // prefetch sales/hunter
  const salesHunterMap = {};
  if (user.role !== "kurir") {
    await Promise.all(tanggalList.map(async tgl => {
      try {
        const snap = await window.getDoc(window.doc(window.db, "users", user.uid, "laporanMarketing", tgl));
        if (snap.exists()) {
          const d = snap.data();
          salesHunterMap[tgl] = { closing: d?.pembayaran?.closing || {}, nota: d?.pembayaran?.nota || {} };
        }
      } catch {}
    }));
  }

  let tbodyHtml = "";

  for (const tgl of tanggalList) {
    const dayOfWeek = new Date(tgl + "T00:00:00").getDay();
    const hari      = hariNama[dayOfWeek];
    const label     = `${hari}, ${tgl}`;

    let data = null;
    if (user.role === "kurir") data = await window.idb.getDataHarian(user.uid, tgl);
    else data = salesHunterMap[tgl] || null;

    // cells per kolom
    const cells = COLS.map(c => {
      const src    = data?.[c.key] || {};
      const vCells = V.map(v => {
        const val = Number(src[v] || 0);
        grandSums[c.key][v] = (grandSums[c.key][v] || 0) + val;
        weekSums[c.key][v]  = (weekSums[c.key][v]  || 0) + val;
        return `<td class="lap-dist-col-${c.cls}">${val || ""}</td>`;
      }).join("");
      const jmlVal = V.reduce((acc, v) => acc + (Number(src[v] || 0)), 0);
      const jml    = c.hasJml ? `<td class="lap-dist-col-${c.cls}" style="font-weight:700">${jmlVal || ""}</td>` : "";
      if (c.hasPersen) {
        const sumPay = V.reduce((acc, v) => acc + (Number(data?.pay?.[v] || 0)), 0);
        const pct    = sumPay > 0 ? Math.round(jmlVal / sumPay * 100) : 0;
        return vCells + jml + `<td class="lap-dist-col-${c.cls}" style="font-weight:700">${pct ? pct+"%" : ""}</td>`;
      }
      return vCells + jml;
    }).join("");

    // data baris
    const cl         = data?.customerLama     || 0;
    const ct         = data?.customerTambahan || 0;
    const cn         = data?.customerNew      || 0;
    const jml        = cl + ct + cn;
    const kun        = data?.kunjungan        || 0;
    const tgtData    = data?.distribusi?.infoTarget?.targetData     ?? "";
    const tgtCust    = data?.distribusi?.infoTarget?.targetCustomer ?? "";
    const omset      = data?.pembayaran?.bayarKonsumen || 0;
    const inputOmset = data?.distribusi?.keuangan?.inputOmset || 0;
    const bonus      = data?.distribusi?.keuangan?.bonus?.jumlahBonus || 0;
    const kasbon     = data?.distribusi?.keuangan?.kasbon || 0;
    const closingRow = data?.closing || {};
    const tagihan    = Object.entries(closingRow).reduce((acc, [k, v]) => acc + (Number(v)||0) * (hargaMapTbl[k]||0), 0);
    const nota       = data?.nota || data?.pembayaran?.nota || {};
    const bayar      = nota?.bayar || 0;
    const ket        = nota?.keterangan || 0;
    const status     = nota?.status || "";
    let ketHtml = "", ketCls = "";
    if      (status.toLowerCase() === "lunas")  { ketHtml = "Lunas";                                          ketCls = "color:#3a9a62;font-weight:700"; }
    else if (status.toLowerCase() === "kurang") { ketHtml = `Kurang ${Math.abs(ket).toLocaleString("id-ID")}`; ketCls = "color:#d05050;font-weight:700"; }
    else if (status.toLowerCase() === "lebih")  { ketHtml = `Lebih ${ket.toLocaleString("id-ID")}`;            ketCls = "color:#7040c0;font-weight:700"; }

    // akumulasi grand
    grandCust.Lama += cl; grandCust.Tambahan += ct; grandCust.Baru += cn;
    grandCust.Jumlah += jml; grandCust.Kunjungan += kun;
    grandKeu.Omset += omset; grandKeu.InputOmset += inputOmset;
    grandKeu.Bonus += bonus; grandKeu.Kasbon += kasbon;
    grandPay.Tagihan += tagihan; grandPay.Bayar += bayar;

    // akumulasi weekly
    weekCust.Lama += cl; weekCust.Tambahan += ct; weekCust.Baru += cn;
    weekCust.Jumlah += jml; weekCust.Kunjungan += kun;
    weekKeu.Omset += omset; weekKeu.InputOmset += inputOmset;
    weekKeu.Bonus += bonus; weekKeu.Kasbon += kasbon;
    weekPay.Tagihan += tagihan; weekPay.Bayar += bayar;

    if (dayOfWeek === 1) weekStart = tgl;

    const omsetCls = inputOmset === 0 ? "" : inputOmset === omset ? "color:#3a9a62" : "color:#d05050";

    tbodyHtml += `<tr>
      <td style="position:sticky;left:0;background:var(--bg-card);font-size:11px;font-weight:600;white-space:nowrap;padding:6px 10px;border:1px solid var(--border-card)">${esc(label)}</td>
      ${cells}
      <td class="lap-dist-col-customer">${cl||""}</td>
      <td class="lap-dist-col-customer">${ct||""}</td>
      <td class="lap-dist-col-customer">${cn||""}</td>
      <td class="lap-dist-col-customer">${jml||""}</td>
      <td class="lap-dist-col-customer">${kun||""}</td>
      <td class="lap-dist-col-customer">${tgtData !== "" ? tgtData : ""}</td>
      <td class="lap-dist-col-customer">${tgtCust !== "" ? tgtCust : ""}</td>
      <td class="lap-dist-col-keuangan">${omset      ? omset.toLocaleString("id-ID")      : ""}</td>
      <td class="lap-dist-col-keuangan" style="${omsetCls}">${inputOmset ? inputOmset.toLocaleString("id-ID") : ""}</td>
      <td class="lap-dist-col-keuangan">${bonus      ? Number(bonus).toLocaleString("id-ID")  : ""}</td>
      <td class="lap-dist-col-keuangan">${kasbon     ? Number(kasbon).toLocaleString("id-ID") : ""}</td>
      <td class="lap-dist-col-closing">${tagihan     ? tagihan.toLocaleString("id-ID")  : ""}</td>
      <td class="lap-dist-col-closing">${bayar       ? bayar.toLocaleString("id-ID")    : ""}</td>
      <td class="lap-dist-col-closing" style="${ketCls}">${ketHtml}</td>
    </tr>`;

    // weekly total setelah Minggu
    if (dayOfWeek === 0 && weekStart) {
      tbodyHtml += buildSumRow(weekSums, weekCust, weekKeu, weekPay, "Total Minggu", "lap-dist-tr-week");
      resetWeek();
      weekStart = null;
    }
  }

  // sisa weekly jika tanggal terakhir bukan Minggu
  const lastDay = new Date(tanggalList[tanggalList.length - 1] + "T00:00:00").getDay();
  if (lastDay !== 0 && weekStart) {
    tbodyHtml += buildSumRow(weekSums, weekCust, weekKeu, weekPay, "Total Minggu", "lap-dist-tr-week");
  }

  const grandRow = buildSumRow(grandSums, grandCust, grandKeu, grandPay, "Grand Total", "lap-dist-tr-total");

  scroll.innerHTML = `
    <table class="lap-dist-table">
      <thead>${th1}${th2}</thead>
      <tbody>${tbodyHtml}${grandRow}</tbody>
    </table>`;
}

window.initLapTabel  = initLapTabel;
window.renderLapTabel = renderLapTabel;