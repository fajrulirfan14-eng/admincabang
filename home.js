window.initHomeView = async function() {
  const user = window.currentUser;
  const now  = new Date();

  const greeting = now.getHours() < 11 ? "Selamat Pagi ☀️"
    : now.getHours() < 15 ? "Selamat Siang 🌤️"
    : now.getHours() < 18 ? "Selamat Sore 🌅"
    : "Selamat Malam 🌙";

  const tanggal = now.toLocaleDateString("id-ID", {
    weekday: "long", day: "numeric", month: "long", year: "numeric"
  });

  const el = id => document.getElementById(id);
  if (el("homeBannerGreeting")) el("homeBannerGreeting").textContent = greeting;
  if (el("homeBannerName"))     el("homeBannerName").textContent     = user?.nama || "Admin";
  if (el("homeBannerSub"))      el("homeBannerSub").textContent      = tanggal;

  window.onHomeReload = async () => {
    const reloadBtn = document.getElementById("topbarReload");
    const icon      = reloadBtn?.querySelector("i");
    if (icon) icon.classList.add("fa-spin");
    if (reloadBtn) reloadBtn.disabled = true;
    try {
      await window.idb.clearUsers();
      await loadUsers();
    } catch {}
    if (icon) icon.classList.remove("fa-spin");
    if (reloadBtn) reloadBtn.disabled = false;
  };

  await loadUsers();
};

let usersCache = [];

async function loadUsers() {
  const uid = window.auth?.currentUser?.uid;
  if (!uid) return;

  try {
    // selalu query Firestore saat buka home
    const snap = await window.getDocs(window.query(
      window.collection(window.db, "users"),
      window.where("createdBy", "==", uid)
    ));

    usersCache        = snap.docs.map(d => ({ uid: d.id, ...d.data() }));
    window.usersCache = usersCache;

    await window.idb.saveUsers(usersCache);
    await loadKantorCabang();

    renderStats();
    renderUsersList();
  } catch (err) {
    console.error("❌ loadUsers:", err);
    const listEl = document.getElementById("homeUsersList");
    if (listEl) listEl.innerHTML = `<div class="home-users-empty">Gagal memuat data</div>`;
  }
}

async function loadKantorCabang() {
  try {
    const idCabang = window.currentUser?.idCabang;
    if (!idCabang) return;

    const snap = await window.getDoc(window.doc(window.db, "kantorCabang", idCabang));
    if (snap.exists()) {
      const data = { id: snap.id, ...snap.data() };
      window.kantorCabang = data;
      await window.idb.saveKantorCabang(data);
    }
  } catch (err) {
    console.error("❌ loadKantorCabang:", err);
  }
}

function renderStats() {
  const kurir  = usersCache.filter(u => u.role === "kurir").length;
  const sales  = usersCache.filter(u => u.role === "sales").length;
  const hunter = usersCache.filter(u => u.role === "hunter").length;
  const total  = usersCache.length;

  const grid = document.getElementById("homeStatGrid");
  if (!grid) return;

  grid.innerHTML = `
    <div class="stat-card">
      <div class="stat-card-icon brown"><i class="fa-solid fa-users"></i></div>
      <div class="stat-card-label">Total Anggota</div>
      <div class="stat-card-value">${total}</div>
    </div>
    <div class="stat-card">
      <div class="stat-card-icon blue"><i class="fa-solid fa-motorcycle"></i></div>
      <div class="stat-card-label">Kurir</div>
      <div class="stat-card-value">${kurir}</div>
    </div>
    <div class="stat-card">
      <div class="stat-card-icon green"><i class="fa-solid fa-handshake"></i></div>
      <div class="stat-card-label">Sales</div>
      <div class="stat-card-value">${sales}</div>
    </div>
    <div class="stat-card">
      <div class="stat-card-icon purple"><i class="fa-solid fa-binoculars"></i></div>
      <div class="stat-card-label">Hunter</div>
      <div class="stat-card-value">${hunter}</div>
    </div>`;
}

function renderUsersList() {
  const listEl = document.getElementById("homeUsersList");
  if (!listEl) return;

  if (!usersCache.length) {
    listEl.innerHTML = `<div class="home-users-empty">Belum ada anggota</div>`;
    return;
  }

  listEl.innerHTML = usersCache.map(u => {
    const nama    = u.nama || "Tanpa Nama";
    const inisial = nama.trim().charAt(0).toUpperCase();
    const avatar  = u.foto
      ? `<img src="${esc(u.foto)}" alt="${esc(nama)}">`
      : inisial;
    return `
      <div class="home-user-card">
        <div class="home-user-avatar">${avatar}</div>
        <div class="home-user-info">
          <div class="home-user-nama">${esc(nama)}</div>
          <div class="home-user-role">${esc(u.role || "-")}</div>
        </div>
        <span class="home-user-badge badge-${esc(u.role || "kurir")}">${esc(u.role || "-")}</span>
      </div>`;
  }).join("");
}

function esc(str) {
  return String(str)
    .replace(/&/g,"&amp;").replace(/</g,"&lt;")
    .replace(/>/g,"&gt;").replace(/"/g,"&quot;");
}
