// ── AKUN VIEW ──
let akunCabangData = [];
let activeAkunCabangId = null;
let activeAkunCabang = null;
window.bukaAkunCabang = function(cabangId) {
  window.showView("akun");
  setTimeout(() => {
    window.selectAkunCabang(cabangId);
  }, 100);
};
window.initAkunView = async function() {
  await loadAkunCabangList();
  initAkunBackBtn();
};

// ── LOAD LIST CABANG ──
async function loadAkunCabangList() {
  const list = document.getElementById("akunCabangList");
  if (!list) return;

  list.innerHTML = [1,2,3].map(() => `
    <div class="akun-sk-item">
      <div class="akun-sk akun-sk-foto"></div>
      <div class="akun-sk-info">
        <div class="akun-sk akun-sk-nama"></div>
        <div class="akun-sk akun-sk-pt"></div>
      </div>
    </div>
  `).join("");

  try {
    const snap = await window.getDocs(window.collection(window.db, "kantorCabang"));
    akunCabangData = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    renderAkunCabangList(akunCabangData);
  } catch(e) {
    list.innerHTML = `<div class="akun-empty-msg">Gagal memuat data.</div>`;
  }
}

// ── RENDER LIST CABANG ──
function renderAkunCabangList(data) {
  const list = document.getElementById("akunCabangList");
  if (!list) return;
  if (!data.length) {
    list.innerHTML = `<div class="akun-empty-msg">Belum ada cabang.</div>`;
    return;
  }
  list.innerHTML = data.map(c => `
    <div class="akun-cabang-item ${activeAkunCabangId === c.id ? 'active' : ''}" 
         data-id="${c.id}" onclick="selectAkunCabang('${c.id}')">
      ${c.fotoKantor
        ? `<img src="${c.fotoKantor}" class="akun-cabang-foto">`
        : `<div class="akun-cabang-foto-placeholder"><i class="fa-solid fa-building"></i></div>`
      }
      <div class="akun-cabang-info">
        <div class="akun-cabang-nama">${c.namaCabang || "-"}</div>
        <div class="akun-cabang-pt">${c.namaPt || "-"}</div>
      </div>
      <i class="fa-solid fa-chevron-right akun-cabang-arrow"></i>
    </div>
  `).join("");
}

// ── SELECT CABANG ──
window.selectAkunCabang = async function(id) {
  activeAkunCabangId = id;
  activeAkunCabang   = akunCabangData.find(c => c.id === id);
  if (!activeAkunCabang) return;

  document.querySelectorAll(".akun-cabang-item").forEach(el => {
    el.classList.toggle("active", el.dataset.id === id);
  });

  const empty   = document.getElementById("akunDetailEmpty");
  const content = document.getElementById("akunDetailContent");
  const wrapper = document.getElementById("akunDetailPanel")?.closest(".akun-detail-wrapper");

  if (empty)   empty.style.display   = "none";
  if (content) content.style.display = "flex";
  if (wrapper) wrapper.classList.add("show");

  if (window.innerWidth <= 768) {
    const backBtn = document.getElementById("topbarBackBtn");
    if (backBtn) { backBtn.style.display = "flex"; }
  }

  document.getElementById("akunDetailNama").textContent = activeAkunCabang.namaCabang || "-";
  document.getElementById("akunDetailPt").textContent   = activeAkunCabang.namaPt || "-";

  // Init tabs
  setAkunTab("adminCabang");
  initAkunTabs();
  initAkunAddBtn();
};

// ── TABS ──
function initAkunTabs() {
  document.querySelectorAll(".akun-tab").forEach(tab => {
    tab.onclick = () => setAkunTab(tab.dataset.tab);
  });
}
function setAkunTab(tabName) {
  document.querySelectorAll(".akun-tab").forEach(t => {
    t.classList.toggle("active", t.dataset.tab === tabName);
  });
  if (tabName === "adminCabang") loadAdminCabangTab();
  else loadMarketingTab(tabName);
}

// ── TAB ADMIN CABANG ──
async function loadAdminCabangTab() {
  const body = document.getElementById("akunTabBody");
  if (!body) return;
  body.innerHTML = `<div class="akun-empty-msg"><i class="fa-solid fa-spinner fa-spin"></i> Memuat...</div>`;

  try {
    const snap = await window.getDocs(
      window.query(
        window.collection(window.db, "users"),
        window.where("idCabang", "==", activeAkunCabangId),
        window.where("role", "==", "adminCabang")
      )
    );

    if (snap.empty) {
      body.innerHTML = `<div class="akun-empty-msg">Belum ada admin cabang.</div>`;
      return;
    }

    body.innerHTML = snap.docs.map(d => {
      const u = d.data();
      const initial = (u.nama || "?")[0].toUpperCase();
      return `
        <div class="akun-card ${u.status === false ? 'nonaktif' : ''}" onclick="openAkunDetail('${d.id}')">
          ${u.foto
            ? `<img src="${u.foto}" class="akun-card-foto">`
            : `<div class="akun-card-foto-placeholder">${initial}</div>`
          }
          <div class="akun-card-info">
            <div class="akun-card-nama">${u.nama || "-"}</div>
            <div class="akun-card-role">${u.role || "-"}</div>
            <div class="akun-card-email">${u.email || "-"}</div>
          </div>
          <span class="akun-card-status ${u.status === false ? 'nonaktif' : 'aktif'}">
            ${u.status === false ? 'Nonaktif' : 'Aktif'}
          </span>
        </div>
      `;
    }).join("");

  } catch(e) {
    body.innerHTML = `<div class="akun-empty-msg">Gagal memuat data.</div>`;
  }
}

// ── TAB MARKETING ──
async function loadMarketingTab(role) {
  const body = document.getElementById("akunTabBody");
  if (!body) return;
  body.innerHTML = `<div class="akun-empty-msg"><i class="fa-solid fa-spinner fa-spin"></i> Memuat...</div>`;

  try {
    const snap = await window.getDocs(
      window.query(
        window.collection(window.db, "users"),
        window.where("idCabang", "==", activeAkunCabangId),
        window.where("role", "==", role)
      )
    );

    if (snap.empty) {
      body.innerHTML = `<div class="akun-empty-msg">Belum ada akun marketing.</div>`;
      return;
    }

    // Sort: aktif dulu
    const sorted = snap.docs.sort((a, b) => {
      const aS = a.data().status !== false ? 1 : 0;
      const bS = b.data().status !== false ? 1 : 0;
      return bS - aS;
    });

    body.innerHTML = sorted.map(d => {
      const u = d.data();
      const initial = (u.nama || "?")[0].toUpperCase();
      return `
        <div class="akun-card ${u.status === false ? 'nonaktif' : ''}" onclick="openAkunDetail('${d.id}')">
          ${u.foto
            ? `<img src="${u.foto}" class="akun-card-foto">`
            : `<div class="akun-card-foto-placeholder">${initial}</div>`
          }
          <div class="akun-card-info">
            <div class="akun-card-nama">${u.nama || "-"}</div>
            <div class="akun-card-role">${u.role || "-"}</div>
            <div class="akun-card-email">${u.email || "-"}</div>
          </div>
          <span class="akun-card-status ${u.status === false ? 'nonaktif' : 'aktif'}">
            ${u.status === false ? 'Nonaktif' : 'Aktif'}
          </span>
        </div>
      `;
    }).join("");

  } catch(e) {
    body.innerHTML = `<div class="akun-empty-msg">Gagal memuat data.</div>`;
  }
}

// ── BACK BTN ──
function initAkunBackBtn() {
  document.getElementById("topbarBackBtn")?.addEventListener("click", () => {
    const wrapper = document.getElementById("akunDetailPanel")?.closest(".akun-detail-wrapper");
    if (wrapper) wrapper.classList.remove("show");
    document.getElementById("topbarBackBtn").style.display = "none";
    activeAkunCabangId = null;
    document.querySelectorAll(".akun-cabang-item").forEach(el => el.classList.remove("active"));
  });
}

// ── SECONDARY FIREBASE APP ──
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getAuth, createUserWithEmailAndPassword } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
const secondaryApp = initializeApp({
  apiKey: "AIzaSyCp32H2WeN3A4ZwwWeUWe3Qcjqh0mz_vvQ",
  authDomain: "teh-tarik-nusantara-26371.firebaseapp.com",
  projectId: "teh-tarik-nusantara-26371",
  storageBucket: "teh-tarik-nusantara-26371.firebasestorage.app",
  messagingSenderId: "354760960352",
  appId: "1:354760960352:web:7d6a6c07dace937a74d605",
}, "secondary");
const secondaryAuth = getAuth(secondaryApp);
// ── ADD BTN ──
function initAkunAddBtn() {
  document.getElementById("akunAddBtn").onclick = () => {
    const activeTab = document.querySelector(".akun-tab.active")?.dataset.tab;
    if (activeTab === "adminCabang") renderTambahAkun();
    else renderTambahMarketing(activeTab);
  };
}
// ── TAMBAH AKUN ADMIN CABANG ──
function renderTambahAkun() {
  document.getElementById("akunSheetOverlay")?.remove();
  document.getElementById("akunSheet")?.remove();

  const overlay = document.createElement("div");
  overlay.id = "akunSheetOverlay";
  overlay.className = "akun-sheet-overlay";
  document.body.appendChild(overlay);

  const sheet = document.createElement("div");
  sheet.id = "akunSheet";
  sheet.className = "akun-sheet";
  sheet.innerHTML = `
    <div class="akun-sheet-handle"></div>

    <div class="akun-sheet-header">
      <div class="akun-sheet-info">
        <div class="akun-sheet-nama">Tambah Admin Cabang</div>
        <div class="akun-sheet-role">${activeAkunCabang?.namaCabang || "-"}</div>
      </div>
      <button class="akun-sheet-close" id="akunSheetClose">
        <i class="fa-solid fa-xmark"></i>
      </button>
    </div>

    <div class="akun-sheet-body" id="akunSheetBody">

      <!-- FOTO -->
      <div class="tab-card">
        <div class="tab-section-title">Foto Profil</div>
        <div class="edit-foto-wrap" id="akunSheetFotoWrap" style="cursor:pointer;">
          <div class="edit-foto-empty"><i class="fa-solid fa-user"></i></div>
          <div class="edit-foto-overlay"><i class="fa-solid fa-camera"></i> Pilih Foto</div>
        </div>
        <input type="file" id="akunSheetFotoInput" accept="image/*" class="edit-foto-input">
      </div>

      <!-- DATA PRIBADI -->
      <div class="tab-card">
        <div class="tab-section-title">Data Pribadi</div>
        ${editAkunField("Nama", "akunAddNama", "")}
        ${editAkunField("NIK", "akunAddNik", "")}
        ${editAkunField("No Telpon", "akunAddNoTelpon", "")}
        ${editAkunField("Alamat", "akunAddAlamat", "", "textarea")}
        ${editAkunField("Motivasi", "akunAddMotivasi", "", "textarea")}
        <div class="edit-field">
          <div class="edit-field-label">Tanggal Lahir</div>
          <input id="akunAddTanggalLahir" type="date" class="edit-field-input">
        </div>
      </div>
      
      <!-- VARIAN -->
      <div class="tab-card" id="akunAddVarianCard">
        <div class="tab-section-title">Varian</div>
        <div id="akunAddVarianList">
          <div class="akun-empty-msg"><i class="fa-solid fa-spinner fa-spin"></i> Memuat varian...</div>
        </div>
        <button class="btn-tambah-row" id="akunAddTambahVarian">
          <i class="fa-solid fa-plus"></i> Tambah Varian
        </button>
      </div>

      <!-- AKUN -->
      <div class="tab-card">
        <div class="tab-section-title">Akun</div>
        ${editAkunField("Email", "akunAddEmail", "")}
        ${editAkunField("Password", "akunAddPassword", "", "password")}
      </div>

      <div id="akunSheetError" style="color:#dc2626;font-size:12px;text-align:center;min-height:16px;margin-top:4px;"></div>

    </div>

    <div class="akun-sheet-footer">
      <button class="btn-simpan" id="akunSheetSimpan" style="flex:1;">
        <i class="fa-solid fa-user-plus"></i> Buat Akun
      </button>
    </div>
  `;

  document.body.appendChild(sheet);
  requestAnimationFrame(() => {
    overlay.classList.add("show");
    sheet.classList.add("show");
  });

  let tempFotoBlob = null;

  const closeSheet = () => {
    overlay.classList.remove("show");
    sheet.classList.remove("show");
    setTimeout(() => { overlay.remove(); sheet.remove(); }, 350);
  };

  document.getElementById("akunSheetClose").onclick = closeSheet;

  // Swipe
  let startY = 0, dragging = false, currentDy = 0;
  sheet.addEventListener("touchstart", e => {
    if (window.innerWidth >= 769) return;
    const touchY = e.touches[0].clientY;
    const headerEl = sheet.querySelector(".akun-sheet-header");
    const headerBottom = headerEl.getBoundingClientRect().bottom;
    if (touchY > headerBottom) return;
    startY = touchY; currentDy = 0; dragging = true;
    sheet.style.willChange = "transform";
    sheet.style.transition = "none";
  }, { passive: true });
  sheet.addEventListener("touchmove", e => {
    if (!dragging) return;
    currentDy = e.touches[0].clientY - startY;
    if (currentDy < 0) currentDy = 0;
    const r = currentDy > 120 ? 120 + (currentDy - 120) * 0.25 : currentDy;
    sheet.style.transform = `translateY(${r}px)`;
  }, { passive: true });
  sheet.addEventListener("touchend", () => {
    if (!dragging) return;
    dragging = false; sheet.style.willChange = "";
    if (currentDy > 90) {
      sheet.style.transition = "transform 0.28s cubic-bezier(0.4,0,0.6,1)";
      sheet.style.transform = "translateY(110%)";
      overlay.style.transition = "opacity 0.28s ease";
      overlay.style.opacity = "0";
      setTimeout(() => { overlay.remove(); sheet.remove(); }, 300);
    } else {
      sheet.style.transition = "transform 0.22s cubic-bezier(0.2,0,0,1)";
      sheet.style.transform = "translateY(0)";
      setTimeout(() => { sheet.style.transition = ""; }, 220);
    }
  }, { passive: true });
  
  // Load varian dari kantorCabang
  let varianList = [];
  window.getDoc(window.doc(window.db, "kantorCabang", activeAkunCabangId)).then(snap => {
    const kantorData   = snap.data() || {};
    const varianKantor = kantorData.varian || {};
    const hargaKantor  = kantorData.harga  || {};

    varianList = Object.keys(varianKantor).map(kode => ({
      kode,
      nama:          varianKantor[kode],
      hargaKonsumen: hargaKantor[kode] || 0,
      hargaProduksi: 0,
      isAktif:       true,
    }));

    renderVarianList();
  });

  function renderVarianList() {
    const container = document.getElementById("akunAddVarianList");
    if (!container) return;

    container.innerHTML = varianList.map((v, i) => `
      <div class="akun-varian-row">
        <div class="akun-varian-header">
          <div style="display:flex;gap:8px;align-items:center;flex:1;">
            <input class="edit-field-input akun-add-varian-kode" style="width:60px;font-weight:700;" 
              value="${v.kode}" placeholder="Kode" data-index="${i}">
            <input class="edit-field-input akun-add-varian-nama" style="flex:1;" 
              value="${v.nama}" placeholder="Nama" data-index="${i}">
          </div>
          <div style="display:flex;align-items:center;gap:8px;">
            <label class="akun-varian-toggle">
              <input type="checkbox" class="akun-add-varian-aktif" data-index="${i}" ${v.isAktif ? 'checked' : ''}>
              <span class="akun-toggle-label">Aktif</span>
            </label>
            <button class="btn-hapus-row akun-add-hapus-varian" data-index="${i}">
              <i class="fa-solid fa-trash"></i>
            </button>
          </div>
        </div>
        <div class="akun-varian-fields">
          <div class="edit-field" style="flex:1;">
            <div class="edit-field-label">Harga Konsumen</div>
            <input class="edit-field-input akun-add-varian-konsumen" type="number" 
              value="${v.hargaKonsumen}" data-index="${i}">
          </div>
          <div class="edit-field" style="flex:1;">
            <div class="edit-field-label">Harga Produksi</div>
            <input class="edit-field-input akun-add-varian-produksi" type="number" 
              value="${v.hargaProduksi}" data-index="${i}">
          </div>
        </div>
      </div>
    `).join("");

    // Events
    container.querySelectorAll(".akun-add-varian-kode").forEach(el => {
      el.oninput = () => { varianList[parseInt(el.dataset.index)].kode = el.value.toUpperCase(); };
    });
    container.querySelectorAll(".akun-add-varian-nama").forEach(el => {
      el.oninput = () => { varianList[parseInt(el.dataset.index)].nama = el.value; };
    });
    container.querySelectorAll(".akun-add-varian-konsumen").forEach(el => {
      el.oninput = () => { varianList[parseInt(el.dataset.index)].hargaKonsumen = parseInt(el.value) || 0; };
    });
    container.querySelectorAll(".akun-add-varian-produksi").forEach(el => {
      el.oninput = () => { varianList[parseInt(el.dataset.index)].hargaProduksi = parseInt(el.value) || 0; };
    });
    container.querySelectorAll(".akun-add-varian-aktif").forEach(el => {
      el.onchange = () => { varianList[parseInt(el.dataset.index)].isAktif = el.checked; };
    });
    container.querySelectorAll(".akun-add-hapus-varian").forEach(el => {
      el.onclick = () => { varianList.splice(parseInt(el.dataset.index), 1); renderVarianList(); };
    });
  }

  document.getElementById("akunAddTambahVarian").onclick = () => {
    varianList.push({ kode: "", nama: "", hargaKonsumen: 0, hargaProduksi: 0, isAktif: true });
    renderVarianList();
  };
  // Enter pindah field
  const fields = [
    "akunAddNama", "akunAddNik", "akunAddNoTelpon",
    "akunAddAlamat", "akunAddMotivasi",
    "akunAddEmail", "akunAddPassword"
  ];
  fields.forEach((id, i) => {
    const el = document.getElementById(id);
    if (!el) return;
    el.addEventListener("keydown", e => {
      if (e.key !== "Enter") return;
      e.preventDefault();
      const next = document.getElementById(fields[i + 1]);
      if (next) next.focus();
      else document.getElementById("akunSheetSimpan")?.click();
    });
  });

  // Foto
  const fotoWrap  = document.getElementById("akunSheetFotoWrap");
  const fotoInput = document.getElementById("akunSheetFotoInput");
  fotoWrap.onclick = () => fotoInput.click();
  fotoInput.onchange = e => {
    const file = e.target.files[0];
    if (!file) return;
    window.openCropModal({ file, ratio: 1, outputSize: { w: 400, h: 400 }, onSave: blob => {
      tempFotoBlob = blob;
      const url = URL.createObjectURL(blob);
      fotoWrap.querySelector(".edit-foto-empty, .edit-foto-preview").outerHTML =
        `<img src="${url}" class="edit-foto-preview">`;
    }});
  };

  // Simpan
  document.getElementById("akunSheetSimpan").onclick = async () => {
    const btn   = document.getElementById("akunSheetSimpan");
    const errEl = document.getElementById("akunSheetError");
    errEl.textContent = "";

    const nama      = document.getElementById("akunAddNama").value.trim();
    const nik       = document.getElementById("akunAddNik").value.trim();
    const noTelpon  = document.getElementById("akunAddNoTelpon").value.trim();
    const alamat    = document.getElementById("akunAddAlamat").value.trim();
    const motivasi  = document.getElementById("akunAddMotivasi").value.trim();
    const tglRaw    = document.getElementById("akunAddTanggalLahir").value;
    const email     = document.getElementById("akunAddEmail").value.trim();
    const password  = document.getElementById("akunAddPassword").value;

    if (!nama)                        return errEl.textContent = "Nama wajib diisi";
    if (!nik)                         return errEl.textContent = "NIK wajib diisi";
    if (!noTelpon)                    return errEl.textContent = "No Telpon wajib diisi";
    if (!alamat)                      return errEl.textContent = "Alamat wajib diisi";
    if (!email)                       return errEl.textContent = "Email wajib diisi";
    if (!password || password.length < 6) return errEl.textContent = "Password min. 6 karakter";

    btn.disabled = true;
    btn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Membuat akun...`;

    try {
      // Konversi varian dari form ke format users
      const varianUsers = varianList.map(v => ({
        [v.kode]: {
          hargaKonsumen: v.hargaKonsumen,
          hargaProduksi: v.hargaProduksi,
          isAktif:       v.isAktif,
        }
      }));

      // Buat akun Auth via secondary app
      const cred   = await createUserWithEmailAndPassword(secondaryAuth, email, password);
      const newUid = cred.user.uid;

      // Upload foto
      let fotoUrl = "";
      if (tempFotoBlob) {
        btn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Kompres foto...`;
        const compressed = await window.compressImage(tempFotoBlob, 400, 0.78);
        btn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Upload foto 0%...`;
        const ref = window.storageRef(window.storage, `fotoUsers/${newUid}`);
        fotoUrl = await window.uploadWithProgress(ref, compressed, "image/jpeg", pct => {
          btn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Upload foto ${pct}%...`;
        });
      }

      btn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Menyimpan data...`;

      // Simpan ke Firestore
      await window.setDoc(window.doc(window.db, "users", newUid), {
        id:           newUid,
        nama,
        nik,
        noTelpon,
        alamat,
        motivasi,
        tanggalLahir: tglRaw ? new Date(tglRaw) : null,
        email,
        foto:         fotoUrl,
        role:         "adminCabang",
        idCabang:     activeAkunCabangId,
        kantorCabang: activeAkunCabang?.namaCabang || "",
        varian:       varianUsers,
        status:       true,
        createdBy:    newUid,
        createdAt:    window.serverTimestamp(),
      });

      // Logout secondary
      await secondaryAuth.signOut();

      btn.innerHTML = `<i class="fa-solid fa-check"></i> Berhasil!`;
      btn.classList.add("btn-simpan--success");

      setTimeout(() => {
        closeSheet();
        loadAdminCabangTab();
      }, 1000);

    } catch(e) {
      console.error(e);
      btn.disabled = false;
      btn.innerHTML = `<i class="fa-solid fa-user-plus"></i> Buat Akun`;
      if (e.code === "auth/email-already-in-use") {
        errEl.textContent = "Email sudah digunakan.";
      } else if (e.code === "auth/invalid-email") {
        errEl.textContent = "Format email tidak valid.";
      } else {
        errEl.textContent = "Gagal membuat akun, coba lagi.";
      }
    }
  };
}
// ── TAMBAH AKUN MARKETING ──
async function renderTambahMarketing(role) {
  document.getElementById("akunSheetOverlay")?.remove();
  document.getElementById("akunSheet")?.remove();

  // Ambil UID adminCabang aktif di cabang ini
  let createdBy = activeAkunCabangId;
  try {
    const adminSnap = await window.getDocs(
      window.query(
        window.collection(window.db, "users"),
        window.where("idCabang", "==", activeAkunCabangId),
        window.where("role", "==", "adminCabang"),
        window.where("status", "==", true)
      )
    );
    if (!adminSnap.empty) createdBy = adminSnap.docs[0].id;
  } catch(e) { console.error(e); }

  const overlay = document.createElement("div");
  overlay.id = "akunSheetOverlay";
  overlay.className = "akun-sheet-overlay";
  document.body.appendChild(overlay);

  const sheet = document.createElement("div");
  sheet.id = "akunSheet";
  sheet.className = "akun-sheet";
  sheet.innerHTML = `
    <div class="akun-sheet-handle"></div>
    <div class="akun-sheet-header">
      <div class="akun-sheet-info">
        <div class="akun-sheet-nama">Tambah ${role.charAt(0).toUpperCase() + role.slice(1)}</div>
        <div class="akun-sheet-role">${activeAkunCabang?.namaCabang || "-"}</div>
      </div>
      <button class="akun-sheet-close" id="akunSheetClose">
        <i class="fa-solid fa-xmark"></i>
      </button>
    </div>

    <div class="akun-sheet-body" id="akunSheetBody">

      <div class="tab-card">
        <div class="tab-section-title">Foto Profil</div>
        <div class="edit-foto-wrap" id="akunSheetFotoWrap" style="cursor:pointer;">
          <div class="edit-foto-empty"><i class="fa-solid fa-user"></i></div>
          <div class="edit-foto-overlay"><i class="fa-solid fa-camera"></i> Pilih Foto</div>
        </div>
        <input type="file" id="akunSheetFotoInput" accept="image/*" class="edit-foto-input">
      </div>

      <div class="tab-card">
        <div class="tab-section-title">Data Pribadi</div>
        ${editAkunField("Nama", "akunAddNama", "")}
        ${editAkunField("NIK", "akunAddNik", "")}
        ${editAkunField("No Telpon", "akunAddNoTelpon", "")}
        ${editAkunField("Alamat", "akunAddAlamat", "", "textarea")}
        ${editAkunField("Motivasi", "akunAddMotivasi", "", "textarea")}
        <div class="edit-field">
          <div class="edit-field-label">Tanggal Lahir</div>
          <input id="akunAddTanggalLahir" type="date" class="edit-field-input">
        </div>
      </div>

      <div class="tab-card">
        <div class="tab-section-title">Akun</div>
        ${editAkunField("Email", "akunAddEmail", "")}
        ${editAkunField("Password", "akunAddPassword", "", "password")}
      </div>

      <div class="tab-card" id="akunAddVarianCard">
        <div class="tab-section-title">Varian</div>
        <div id="akunAddVarianList">
          <div class="akun-empty-msg"><i class="fa-solid fa-spinner fa-spin"></i> Memuat varian...</div>
        </div>
        <button class="btn-tambah-row" id="akunAddTambahVarian">
          <i class="fa-solid fa-plus"></i> Tambah Varian
        </button>
      </div>

      <div id="akunSheetError" style="color:#dc2626;font-size:12px;text-align:center;min-height:16px;margin-top:4px;"></div>
    </div>

    <div class="akun-sheet-footer">
      <button class="btn-simpan" id="akunSheetSimpan" style="flex:1;">
        <i class="fa-solid fa-user-plus"></i> Buat Akun
      </button>
    </div>
  `;

  document.body.appendChild(sheet);
  requestAnimationFrame(() => { overlay.classList.add("show"); sheet.classList.add("show"); });

  let tempFotoBlob = null;

  const closeSheet = () => {
    overlay.classList.remove("show");
    sheet.classList.remove("show");
    setTimeout(() => { overlay.remove(); sheet.remove(); }, 350);
  };

  document.getElementById("akunSheetClose").onclick = closeSheet;

  // Swipe
  let startY = 0, dragging = false, currentDy = 0;
  sheet.addEventListener("touchstart", e => {
    if (window.innerWidth >= 769) return;
    const touchY = e.touches[0].clientY;
    const headerEl = sheet.querySelector(".akun-sheet-header");
    const headerBottom = headerEl.getBoundingClientRect().bottom;
    if (touchY > headerBottom) return;
    startY = touchY; currentDy = 0; dragging = true;
    sheet.style.willChange = "transform";
    sheet.style.transition = "none";
  }, { passive: true });
  sheet.addEventListener("touchmove", e => {
    if (!dragging) return;
    currentDy = e.touches[0].clientY - startY;
    if (currentDy < 0) currentDy = 0;
    const r = currentDy > 120 ? 120 + (currentDy - 120) * 0.25 : currentDy;
    sheet.style.transform = `translateY(${r}px)`;
  }, { passive: true });
  sheet.addEventListener("touchend", () => {
    if (!dragging) return;
    dragging = false; sheet.style.willChange = "";
    if (currentDy > 90) {
      sheet.style.transition = "transform 0.28s cubic-bezier(0.4,0,0.6,1)";
      sheet.style.transform = "translateY(110%)";
      overlay.style.transition = "opacity 0.28s ease";
      overlay.style.opacity = "0";
      setTimeout(() => { overlay.remove(); sheet.remove(); }, 300);
    } else {
      sheet.style.transition = "transform 0.22s cubic-bezier(0.2,0,0,1)";
      sheet.style.transform = "translateY(0)";
      setTimeout(() => { sheet.style.transition = ""; }, 220);
    }
  }, { passive: true });

  // Varian
  let varianList = [];
  window.getDoc(window.doc(window.db, "kantorCabang", activeAkunCabangId)).then(snap => {
    const kantorData   = snap.data() || {};
    const varianKantor = kantorData.varian || {};
    const hargaKantor  = kantorData.harga  || {};
    varianList = Object.keys(varianKantor).map(kode => ({
      kode, nama: varianKantor[kode],
      hargaKonsumen: hargaKantor[kode] || 0,
      hargaProduksi: 0, isAktif: true,
    }));
    renderVarianList();
  });

  function renderVarianList() {
    const container = document.getElementById("akunAddVarianList");
    if (!container) return;
    container.innerHTML = varianList.map((v, i) => `
      <div class="akun-varian-row">
        <div class="akun-varian-header">
          <div style="display:flex;gap:8px;align-items:center;flex:1;">
            <input class="edit-field-input akun-add-varian-kode" style="width:60px;font-weight:700;"
              value="${v.kode}" placeholder="Kode" data-index="${i}">
            <input class="edit-field-input akun-add-varian-nama" style="flex:1;"
              value="${v.nama}" placeholder="Nama" data-index="${i}">
          </div>
          <div style="display:flex;align-items:center;gap:8px;">
            <label class="akun-varian-toggle">
              <input type="checkbox" class="akun-add-varian-aktif" data-index="${i}" ${v.isAktif ? 'checked' : ''}>
              <span class="akun-toggle-label">Aktif</span>
            </label>
            <button class="btn-hapus-row akun-add-hapus-varian" data-index="${i}">
              <i class="fa-solid fa-trash"></i>
            </button>
          </div>
        </div>
        <div class="akun-varian-fields">
          <div class="edit-field" style="flex:1;">
            <div class="edit-field-label">Harga Konsumen</div>
            <input class="edit-field-input akun-add-varian-konsumen" type="number"
              value="${v.hargaKonsumen}" data-index="${i}">
          </div>
          <div class="edit-field" style="flex:1;">
            <div class="edit-field-label">Harga Produksi</div>
            <input class="edit-field-input akun-add-varian-produksi" type="number"
              value="${v.hargaProduksi}" data-index="${i}">
          </div>
        </div>
      </div>
    `).join("");

    container.querySelectorAll(".akun-add-varian-kode").forEach(el => {
      el.oninput = () => { varianList[parseInt(el.dataset.index)].kode = el.value.toUpperCase(); };
    });
    container.querySelectorAll(".akun-add-varian-nama").forEach(el => {
      el.oninput = () => { varianList[parseInt(el.dataset.index)].nama = el.value; };
    });
    container.querySelectorAll(".akun-add-varian-konsumen").forEach(el => {
      el.oninput = () => { varianList[parseInt(el.dataset.index)].hargaKonsumen = parseInt(el.value) || 0; };
    });
    container.querySelectorAll(".akun-add-varian-produksi").forEach(el => {
      el.oninput = () => { varianList[parseInt(el.dataset.index)].hargaProduksi = parseInt(el.value) || 0; };
    });
    container.querySelectorAll(".akun-add-varian-aktif").forEach(el => {
      el.onchange = () => { varianList[parseInt(el.dataset.index)].isAktif = el.checked; };
    });
    container.querySelectorAll(".akun-add-hapus-varian").forEach(el => {
      el.onclick = () => { varianList.splice(parseInt(el.dataset.index), 1); renderVarianList(); };
    });
  }

  document.getElementById("akunAddTambahVarian").onclick = () => {
    varianList.push({ kode: "", nama: "", hargaKonsumen: 0, hargaProduksi: 0, isAktif: true });
    renderVarianList();
  };

  // Foto
  const fotoWrap  = document.getElementById("akunSheetFotoWrap");
  const fotoInput = document.getElementById("akunSheetFotoInput");
  fotoWrap.onclick = () => fotoInput.click();
  fotoInput.onchange = e => {
    const file = e.target.files[0];
    if (!file) return;
    window.openCropModal({ file, ratio: 1, outputSize: { w: 400, h: 400 }, onSave: blob => {
      tempFotoBlob = blob;
      const url = URL.createObjectURL(blob);
      fotoWrap.querySelector(".edit-foto-empty, .edit-foto-preview").outerHTML =
        `<img src="${url}" class="edit-foto-preview">`;
    }});
  };

  // Enter pindah field
  const fields = ["akunAddNama","akunAddNik","akunAddNoTelpon","akunAddAlamat","akunAddMotivasi","akunAddEmail","akunAddPassword"];
  fields.forEach((id, i) => {
    const el = document.getElementById(id);
    if (!el) return;
    el.addEventListener("keydown", e => {
      if (e.key !== "Enter") return;
      e.preventDefault();
      const next = document.getElementById(fields[i + 1]);
      if (next) next.focus();
      else document.getElementById("akunSheetSimpan")?.click();
    });
  });

  // Simpan
  document.getElementById("akunSheetSimpan").onclick = async () => {
    const btn   = document.getElementById("akunSheetSimpan");
    const errEl = document.getElementById("akunSheetError");
    errEl.textContent = "";

    const nama     = document.getElementById("akunAddNama").value.trim();
    const nik      = document.getElementById("akunAddNik").value.trim();
    const noTelpon = document.getElementById("akunAddNoTelpon").value.trim();
    const alamat   = document.getElementById("akunAddAlamat").value.trim();
    const motivasi = document.getElementById("akunAddMotivasi").value.trim();
    const tglRaw   = document.getElementById("akunAddTanggalLahir").value;
    const email    = document.getElementById("akunAddEmail").value.trim();
    const password = document.getElementById("akunAddPassword").value;

    if (!nama)                            return errEl.textContent = "Nama wajib diisi";
    if (!nik)                             return errEl.textContent = "NIK wajib diisi";
    if (!noTelpon)                        return errEl.textContent = "No Telpon wajib diisi";
    if (!alamat)                          return errEl.textContent = "Alamat wajib diisi";
    if (!email)                           return errEl.textContent = "Email wajib diisi";
    if (!password || password.length < 6) return errEl.textContent = "Password min. 6 karakter";

    btn.disabled = true;
    btn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Membuat akun...`;

    try {
      const varianUsers = varianList.map(v => ({
        [v.kode]: {
          hargaKonsumen: v.hargaKonsumen,
          hargaProduksi: v.hargaProduksi,
          isAktif:       v.isAktif,
        }
      }));

      const cred   = await createUserWithEmailAndPassword(secondaryAuth, email, password);
      const newUid = cred.user.uid;

      let fotoUrl = "";
      if (tempFotoBlob) {
        btn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Kompres foto...`;
        const compressed = await window.compressImage(tempFotoBlob, 400, 0.78);
        btn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Upload foto 0%...`;
        const ref = window.storageRef(window.storage, `fotoUsers/${newUid}`);
        fotoUrl = await window.uploadWithProgress(ref, compressed, "image/jpeg", pct => {
          btn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Upload foto ${pct}%...`;
        });
      }

      btn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Menyimpan data...`;

      await window.setDoc(window.doc(window.db, "users", newUid), {
        id:           newUid,
        nama, nik, noTelpon, alamat, motivasi,
        tanggalLahir: tglRaw ? new Date(tglRaw) : null,
        email,
        foto:         fotoUrl,
        role,
        idCabang:     activeAkunCabangId,
        kantorCabang: activeAkunCabang?.namaCabang || "",
        varian:       varianUsers,
        status:       true,
        createdBy,
        createdAt:    window.serverTimestamp(),
      });

      await secondaryAuth.signOut();

      btn.innerHTML = `<i class="fa-solid fa-check"></i> Berhasil!`;
      btn.classList.add("btn-simpan--success");

      setTimeout(() => {
        closeSheet();
        loadMarketingTab(role);
      }, 1000);

    } catch(e) {
      console.error(e);
      btn.disabled = false;
      btn.innerHTML = `<i class="fa-solid fa-user-plus"></i> Buat Akun`;
      if (e.code === "auth/email-already-in-use") errEl.textContent = "Email sudah digunakan.";
      else if (e.code === "auth/invalid-email")   errEl.textContent = "Format email tidak valid.";
      else errEl.textContent = "Gagal membuat akun, coba lagi.";
    }
  };
}

// ── OPEN DETAIL AKUN ──
window.openAkunDetail = async function(uid) {
  const snap = await window.getDoc(window.doc(window.db, "users", uid));
  if (!snap.exists()) return;
  const u = { id: uid, ...snap.data() };
  renderAkunSheet(u);
};

function renderAkunSheet(u) {
  // Hapus sheet lama
  document.getElementById("akunSheetOverlay")?.remove();
  document.getElementById("akunSheet")?.remove();

  const initial = (u.nama || "?")[0].toUpperCase();
  const isAktif = u.status !== false;

  // Overlay
  const overlay = document.createElement("div");
  overlay.id = "akunSheetOverlay";
  overlay.className = "akun-sheet-overlay";
  document.body.appendChild(overlay);

  // Sheet
  const sheet = document.createElement("div");
  sheet.id = "akunSheet";
  sheet.className = "akun-sheet";
  sheet.innerHTML = `
    <div class="akun-sheet-handle"></div>

    <div class="akun-sheet-header">
      ${u.foto
        ? `<img src="${u.foto}" class="akun-sheet-foto" id="akunSheetFoto" onclick="openFotoPopup('${u.foto}')">`
        : `<div class="akun-sheet-foto-placeholder">${initial}</div>`
      }
      <div class="akun-sheet-info">
        <div class="akun-sheet-nama">${u.nama || "-"}</div>
        <div class="akun-sheet-role">${u.role || "-"} • <span class="akun-card-status ${isAktif ? 'aktif' : 'nonaktif'}">${isAktif ? 'Aktif' : 'Nonaktif'}</span></div>
      </div>
      <button class="akun-sheet-close" id="akunSheetClose">
        <i class="fa-solid fa-xmark"></i>
      </button>
    </div>

    <div class="akun-sheet-body" id="akunSheetBody">

      <!-- FOTO -->
      <div class="tab-card">
        <div class="tab-section-title">Foto Profil</div>
        <div class="edit-foto-wrap" id="akunSheetFotoWrap" style="cursor:pointer;">
          ${u.foto
            ? `<img src="${u.foto}" class="edit-foto-preview">`
            : `<div class="edit-foto-empty"><i class="fa-solid fa-user"></i></div>`
          }
          <div class="edit-foto-overlay"><i class="fa-solid fa-camera"></i> Ganti Foto</div>
        </div>
        <input type="file" id="akunSheetFotoInput" accept="image/*" class="edit-foto-input">
      </div>

      <!-- DATA UMUM -->
      <div class="tab-card">
        <div class="tab-section-title">Data Umum</div>
        ${editAkunField("Nama", "akunEditNama", u.nama)}
        ${editAkunField("NIK", "akunEditNik", u.nik)}
        ${editAkunField("No Telpon", "akunEditNoTelpon", u.noTelpon)}
        ${editAkunField("Alamat", "akunEditAlamat", u.alamat, "textarea")}
        ${editAkunField("Motivasi", "akunEditMotivasi", u.motivasi, "textarea")}
        <div class="edit-field">
          <div class="edit-field-label">Tanggal Lahir</div>
          <input id="akunEditTanggalLahir" type="date" class="edit-field-input" value="${
            u.tanggalLahir?.toDate
              ? u.tanggalLahir.toDate().toISOString().split("T")[0]
              : (u.tanggalLahir || "")
          }">
        </div>
        ${u.role === "adminCabang" ? editAkunField("Kantor Cabang", "akunEditKantorCabang", u.kantorCabang) : ""}
      </div>

      <!-- VARIAN -->
      <div class="tab-card">
        <div class="tab-section-title">Varian</div>
        ${(u.varian || []).map((v, i) => {
          const kode = Object.keys(v)[0];
          const val  = v[kode];
          return `
            <div class="akun-varian-row">
              <div class="akun-varian-header">
                <span class="akun-varian-kode">${kode}</span>
                <label class="akun-varian-toggle">
                  <input type="checkbox" id="akunVarianAktif_${i}" ${val.isAktif ? 'checked' : ''}>
                  <span class="akun-toggle-label">Aktif</span>
                </label>
              </div>
              <div class="akun-varian-fields">
                <div class="edit-field" style="flex:1;">
                  <div class="edit-field-label">Harga Konsumen</div>
                  <input id="akunVarianKonsumen_${i}" type="number" class="edit-field-input" value="${val.hargaKonsumen || 0}">
                </div>
                <div class="edit-field" style="flex:1;">
                  <div class="edit-field-label">Harga Produksi</div>
                  <input id="akunVarianProduksi_${i}" type="number" class="edit-field-input" value="${val.hargaProduksi || 0}">
                </div>
              </div>
            </div>
          `;
        }).join("")}
      </div>

      <div id="akunSheetError" style="color:#dc2626;font-size:12px;text-align:center;min-height:16px;margin-top:4px;"></div>
    </div>

    <div class="akun-sheet-footer">
      <button class="${isAktif ? 'btn-nonaktif' : 'btn-aktifkan'}" id="akunSheetToggleStatus">
        <i class="fa-solid ${isAktif ? 'fa-user-slash' : 'fa-user-check'}"></i>
        ${isAktif ? 'Nonaktifkan' : 'Aktifkan'}
      </button>
      <button class="btn-simpan" id="akunSheetSimpan" style="flex:2;">
        <i class="fa-solid fa-floppy-disk"></i> Simpan
      </button>
    </div>
  `;

  document.body.appendChild(sheet);

  // Animasi masuk
  requestAnimationFrame(() => {
    overlay.classList.add("show");
    sheet.classList.add("show");
  });

  let tempFotoBlob = null;

  // Close
  const closeSheet = () => {
    overlay.classList.remove("show");
    sheet.classList.remove("show");
    setTimeout(() => { overlay.remove(); sheet.remove(); }, 350);
  };

  document.getElementById("akunSheetClose").onclick = closeSheet;

  // Swipe down to close dari seluruh sheet header + handle
  const swipeZone = sheet.querySelector(".akun-sheet-header");
  let startY = 0, dragging = false, currentDy = 0;

  sheet.addEventListener("touchstart", e => {
    if (window.innerWidth >= 769) return;
    const touchY = e.touches[0].clientY;
    const sheetTop = sheet.getBoundingClientRect().top;
    const headerEl = sheet.querySelector(".akun-sheet-header");
    const headerBottom = headerEl.getBoundingClientRect().bottom;
    if (touchY > headerBottom) return;
    startY = touchY;
    currentDy = 0;
    dragging = true;
    sheet.style.willChange = "transform";
    sheet.style.transition = "none";
  }, { passive: true });

  sheet.addEventListener("touchmove", e => {
    if (!dragging) return;
    currentDy = e.touches[0].clientY - startY;
    if (currentDy < 0) currentDy = 0;
    const resistance = currentDy > 120 ? 120 + (currentDy - 120) * 0.25 : currentDy;
    sheet.style.transform = `translateY(${resistance}px)`;
  }, { passive: true });

  sheet.addEventListener("touchend", () => {
    if (!dragging) return;
    dragging = false;
    sheet.style.willChange = "";
    if (currentDy > 90) {
      sheet.style.transition = "transform 0.28s cubic-bezier(0.4,0,0.6,1)";
      sheet.style.transform = "translateY(110%)";
      overlay.style.transition = "opacity 0.28s ease";
      overlay.style.opacity = "0";
      setTimeout(() => { overlay.remove(); sheet.remove(); }, 300);
    } else {
      sheet.style.transition = "transform 0.22s cubic-bezier(0.2,0,0,1)";
      sheet.style.transform = "translateY(0)";
      setTimeout(() => { sheet.style.transition = ""; }, 220);
    }
  }, { passive: true });

  // Cegah scroll body sheet trigger pull to refresh
  const sheetBody = document.getElementById("akunSheetBody");
  sheetBody.addEventListener("touchmove", e => {
    e.stopPropagation();
  }, { passive: true });

  // Foto
  const fotoWrap  = document.getElementById("akunSheetFotoWrap");
  const fotoInput = document.getElementById("akunSheetFotoInput");
  fotoWrap.onclick = () => fotoInput.click();
  fotoInput.onchange = e => {
    const file = e.target.files[0];
    if (!file) return;
    window.openCropModal({ file, ratio: 1, outputSize: { w: 400, h: 400 }, onSave: blob => {
      tempFotoBlob = blob;
      const url = URL.createObjectURL(blob);
      fotoWrap.querySelector(".edit-foto-preview, .edit-foto-empty").outerHTML =
        `<img src="${url}" class="edit-foto-preview" id="akunSheetFotoPreview">`;
    }});
  };

  // Toggle status
  document.getElementById("akunSheetToggleStatus").onclick = () => {
    showConfirmToggleStatus(u, isAktif, closeSheet);
  };

  // Simpan
  document.getElementById("akunSheetSimpan").onclick = async () => {
    const btn    = document.getElementById("akunSheetSimpan");
    const errEl  = document.getElementById("akunSheetError");
    errEl.textContent = "";
    btn.disabled = true;
    btn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Menyimpan...`;

    try {
      // Baca varian dari DOM
      const varianFinal = (u.varian || []).map((v, i) => {
        const kode = Object.keys(v)[0];
        return {
          [kode]: {
            hargaKonsumen: parseInt(document.getElementById(`akunVarianKonsumen_${i}`)?.value) || 0,
            hargaProduksi: parseInt(document.getElementById(`akunVarianProduksi_${i}`)?.value) || 0,
            isAktif: document.getElementById(`akunVarianAktif_${i}`)?.checked ?? true,
          }
        };
      });

      const tglRaw = document.getElementById("akunEditTanggalLahir").value;
      const updates = {
        nama:         document.getElementById("akunEditNama").value.trim(),
        nik:          document.getElementById("akunEditNik").value.trim(),
        noTelpon:     document.getElementById("akunEditNoTelpon").value.trim(),
        alamat:       document.getElementById("akunEditAlamat").value.trim(),
        motivasi:     document.getElementById("akunEditMotivasi").value.trim(),
        tanggalLahir: tglRaw ? new Date(tglRaw) : null,
        varian:       varianFinal,
      };

      if (u.role === "adminCabang") {
        updates.kantorCabang = document.getElementById("akunEditKantorCabang").value.trim();
      }

      // Upload foto
      if (tempFotoBlob) {
        btn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Kompres foto...`;
        const compressed = await window.compressImage(tempFotoBlob, 400, 0.78);
        btn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Upload foto 0%...`;
        const ref = window.storageRef(window.storage, `fotoUsers/${u.id}`);
        updates.foto = await window.uploadWithProgress(ref, compressed, "image/jpeg", pct => {
          btn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Upload ${pct}%...`;
        });
      }

      await window.updateDoc(window.doc(window.db, "users", u.id), updates);

      btn.innerHTML = `<i class="fa-solid fa-check"></i> Tersimpan!`;
      btn.classList.add("btn-simpan--success");
      setTimeout(() => {
        closeSheet();
        // Reload tab yang aktif
        const activeTab = document.querySelector(".akun-tab.active")?.dataset.tab;
        if (activeTab === "adminCabang") loadAdminCabangTab();
        else loadMarketingTab();
      }, 1000);

    } catch(e) {
      console.error(e);
      errEl.textContent = "Gagal menyimpan, coba lagi.";
      btn.disabled = false;
      btn.innerHTML = `<i class="fa-solid fa-floppy-disk"></i> Simpan`;
    }
  };
}

// ── FIELD HELPER ──
function editAkunField(label, id, value, type = "input") {
  if (type === "textarea") return `
    <div class="edit-field">
      <div class="edit-field-label">${label}</div>
      <textarea id="${id}" class="edit-field-input edit-field-textarea" rows="2">${value || ""}</textarea>
    </div>`;
  if (type === "password") return `
    <div class="edit-field">
      <div class="edit-field-label">${label} (kosongkan jika tidak ingin diubah)</div>
      <input id="${id}" type="password" class="edit-field-input" placeholder="••••••">
    </div>`;
  return `
    <div class="edit-field">
      <div class="edit-field-label">${label}</div>
      <input id="${id}" type="text" class="edit-field-input" value="${value || ""}">
    </div>`;
}

// ── CONFIRM TOGGLE STATUS ──
function showConfirmToggleStatus(u, isAktif, onDone) {
  const existing = document.getElementById("confirmOverlay");
  if (existing) existing.remove();

  const overlay = document.createElement("div");
  overlay.id = "confirmOverlay";
  overlay.className = "confirm-overlay";
  overlay.innerHTML = `
    <div class="confirm-box">
      <div class="confirm-icon" style="background:${isAktif ? 'rgba(220,38,38,0.1)' : 'rgba(34,197,94,0.1)'};">
        <i class="fa-solid ${isAktif ? 'fa-user-slash' : 'fa-user-check'}" style="color:${isAktif ? '#dc2626' : 'var(--success)'}"></i>
      </div>
      <div class="confirm-title">${isAktif ? 'Nonaktifkan Akun?' : 'Aktifkan Akun?'}</div>
      <div class="confirm-msg">
        ${isAktif
          ? `Akun <strong>${u.nama}</strong> tidak bisa login setelah dinonaktifkan.`
          : `Akun <strong>${u.nama}</strong> akan aktif kembali dan bisa login.`
        }
      </div>
      <div class="confirm-actions">
        <button class="btn-batal" id="confirmBatal">Batal</button>
        <button class="btn-hapus" id="confirmOk" style="background:${isAktif ? '#dc2626' : 'var(--success)'}">
          ${isAktif ? 'Nonaktifkan' : 'Aktifkan'}
        </button>
      </div>
    </div>
  `;

  document.body.appendChild(overlay);
  requestAnimationFrame(() => overlay.classList.add("show"));

  const close = () => {
    overlay.classList.remove("show");
    setTimeout(() => overlay.remove(), 200);
  };

  document.getElementById("confirmBatal").onclick = close;
  overlay.onclick = e => { if (e.target === overlay) close(); };

  document.getElementById("confirmOk").onclick = async () => {
    try {
      await window.updateDoc(window.doc(window.db, "users", u.id), { status: !isAktif });
      close();
      onDone();
      const activeTab = document.querySelector(".akun-tab.active")?.dataset.tab;
      if (activeTab === "adminCabang") loadAdminCabangTab();
      else loadMarketingTab();
    } catch(e) {
      console.error(e);
      alert("Gagal mengubah status.");
    }
  };
}
