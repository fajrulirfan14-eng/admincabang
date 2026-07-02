/* ── TRIKOTOMI ── */
const TRI_DEFAULT = {
  produktif:    { return: { min:0, max:1    }, expired: { min:0, max:0    } },
  stabil:       { return: { min:2, max:2    }, expired: { min:0, max:1    } },
  nonProduktif: { return: { min:3, max:9999 }, expired: { min:2, max:9999 } }
};

function triInRange(val, min, max) { return val >= min && val <= max; }

function triKlasifikasi(returnTotal, expiredTotal, tri) {
  function getK(val, field) {
    if (triInRange(val, tri.produktif[field].min,    tri.produktif[field].max))    return 1;
    if (triInRange(val, tri.stabil[field].min,       tri.stabil[field].max))       return 2;
    if (triInRange(val, tri.nonProduktif[field].min, tri.nonProduktif[field].max)) return 3;
    return 0;
  }
  const worst = Math.max(getK(returnTotal, "return"), getK(expiredTotal, "expired"));
  return worst === 3 ? "red" : worst === 2 ? "yellow" : worst === 1 ? "green" : "grey";
}

async function loadTrikotomiSetting() {
  const kantorCabang = await window.idb.getKantorCabang();
  const tri = kantorCabang?.trikotomi || null;
  return tri ? { ...TRI_DEFAULT, ...tri } : TRI_DEFAULT;
}

window.dsmAnalisaPeriode = 1;
window.dsmAnalisaFilter  = "default";

window.renderDsmAnalisa = async function renderDsmAnalisa() {
  const groupEl = document.getElementById("dsmAnalisaGroups");
  if (!groupEl) return;

  const state = window._dsmGetState();
  const { dsmSelectedKurir, dsmSelectedHari, dsmSelectedBulan, dsmSelectedTahun, dsmMingguKe, dsmCustomers } = state;

  if (!dsmSelectedKurir) {
    groupEl.innerHTML = `<div class="dh-ringkasan-empty">Pilih kurir dulu</div>`;
    return;
  }

  groupEl.innerHTML = `<div class="dh-ringkasan-empty">Memuat analisa...</div>`;

  const tri = await loadTrikotomiSetting();
  const tanggalList = window._dsmHitungMinggu(dsmSelectedHari, dsmSelectedBulan, dsmSelectedTahun);

  let refDates = [];
  if (window.dsmAnalisaPeriode === 1) {
    const d = tanggalList[dsmMingguKe - 1 - 1];
    if (d) refDates = [d];
  } else {
    const d1 = tanggalList[dsmMingguKe - 1 - 1];
    const d2 = tanggalList[dsmMingguKe - 1 - 2];
    refDates = [d1, d2].filter(Boolean);
  }

  if (!refDates.length) {
    groupEl.innerHTML = `<div class="dh-ringkasan-empty">Tidak ada data minggu sebelumnya</div>`;
    document.getElementById("dsmAnalisaGreen").textContent  = "0";
    document.getElementById("dsmAnalisaYellow").textContent = "0";
    document.getElementById("dsmAnalisaRed").textContent    = "0";
    document.getElementById("dsmAnalisaGrey").textContent   = String(dsmCustomers.length);
    return;
  }

  const refMaps = [];
  for (const d of refDates) {
    const tStr = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
    const data = await window._dsmGetDataCached(dsmSelectedKurir, tStr);
    refMaps.push(data?.customers || {});
  }

  const result = dsmCustomers.map(c => {
    const docs = refMaps.map(m => m[c.id]).filter(Boolean);

    let retTotal = 0, expTotal = 0, statusKet = "";
    if (docs.length) {
      if (window.dsmAnalisaPeriode === 1) {
        const dh = docs[0];
        retTotal = Object.values(dh.return  || {}).reduce((a,v) => a+(Number(v)||0), 0);
        expTotal = Object.values(dh.expired || {}).reduce((a,v) => a+(Number(v)||0), 0);
        statusKet = dh.keterangan?.status?.toLowerCase() || "";
      } else {
        const sums = docs.map(dh => ({
          r: Object.values(dh.return  || {}).reduce((a,v) => a+(Number(v)||0), 0),
          e: Object.values(dh.expired || {}).reduce((a,v) => a+(Number(v)||0), 0),
        }));
        retTotal = Math.round(sums.reduce((a,s) => a+s.r, 0) / docs.length);
        expTotal = Math.round(sums.reduce((a,s) => a+s.e, 0) / docs.length);
        statusKet = docs[docs.length-1].keterangan?.status?.toLowerCase() || "";
      }
    }

    let status = docs.length ? triKlasifikasi(retTotal, expTotal, tri) : "grey";
    if ((statusKet === "tutup" || statusKet === "pending") && status !== "red") {
      status = "yellow";
    }

    return { nama: c.namaCustomer || "-", status, retTotal, expTotal, statusKet, hasData: docs.length > 0 };
  });

  let filteredResult = result;
  if (window.dsmAnalisaFilter === "return")  filteredResult = result.filter(c => c.retTotal > 0);
  if (window.dsmAnalisaFilter === "expired") filteredResult = result.filter(c => c.expTotal > 0);
  if (window.dsmAnalisaFilter === "tutup")   filteredResult = result.filter(c => c.statusKet === "tutup");
  if (window.dsmAnalisaFilter === "pending") filteredResult = result.filter(c => c.statusKet === "pending");

  const green  = filteredResult.filter(x => x.status === "green");
  const yellow = filteredResult.filter(x => x.status === "yellow");
  const red    = filteredResult.filter(x => x.status === "red");
  const grey   = filteredResult.filter(x => x.status === "grey");

  document.getElementById("dsmAnalisaGreen").textContent  = green.length;
  document.getElementById("dsmAnalisaYellow").textContent = yellow.length;
  document.getElementById("dsmAnalisaRed").textContent    = red.length;
  document.getElementById("dsmAnalisaGrey").textContent   = grey.length;

  const refLabel = refDates.map(d => d.toLocaleDateString("id-ID", { day:"numeric", month:"short" })).join(" & ");
  document.getElementById("dsmAnalisaSubtitle").textContent =
    `${document.getElementById("dsmKurirLabel")?.textContent || "-"} · Referensi: ${refLabel}`;

  const statusColor = { green: "#3a9a62", yellow: "#f5a623", red: "#d05050", grey: "#787878" };
  const statusLabel = { green: "Produktif", yellow: "Stabil", red: "Non Produktif", grey: "Belum Ada Data" };

  if (!filteredResult.length) {
    groupEl.innerHTML = `<div class="dh-ringkasan-empty">Tidak ada customer</div>`;
    return;
  }

  const renderColumn = (items, status) => `
    <div class="dsm-analisa-col">
      <div class="dsm-analisa-col-header" style="color:${statusColor[status]}">
        ${statusLabel[status]} (${items.length})
      </div>
      <div class="dsm-analisa-col-list">
        ${items.length ? items.map(c => `
          <div class="dsm-analisa-item" style="border-left:4px solid ${statusColor[c.status]}">
            <div class="dsm-analisa-item-nama">${escTri(c.nama)}</div>
            <div class="dsm-analisa-item-info">
              ${c.hasData ? `<span class="dsm-analisa-item-detail">Return: ${c.retTotal} · Expired: ${c.expTotal}</span>` : `<span class="dsm-analisa-item-detail">Tidak ada data</span>`}
            </div>
          </div>`).join("") : `<div class="dsm-analisa-col-empty">Tidak ada</div>`}
      </div>
    </div>`;

  groupEl.innerHTML = `
    <div class="dsm-analisa-grid">
      ${renderColumn(green,  "green")}
      ${renderColumn(yellow, "yellow")}
      ${renderColumn(red,    "red")}
      ${renderColumn(grey,   "grey")}
    </div>`;
};

function escTri(str) {
  return String(str)
    .replace(/&/g,"&amp;").replace(/</g,"&lt;")
    .replace(/>/g,"&gt;").replace(/"/g,"&quot;");
}
