/* ── MAP ROLLING (panel kanan customer hunter) ── */

const hariColorsRolling = {
  "Senin": "#e74c3c", "Selasa": "#e67e22", "Rabu": "#f1c40f",
  "Kamis": "#2ecc71", "Jumat": "#3498db", "Sabtu": "#9b59b6", "Minggu": "#1abc9c",
};

let rollingMap       = null;
let rollingTileLayer = null;
let rollingSavedTile = localStorage.getItem("rollingTileCabang") || "Alidade Smooth";

const mapTilesRolling = {
  "Alidade Smooth": { url: "https://tiles.stadiamaps.com/tiles/alidade_smooth/{z}/{x}/{y}{r}.png", attribution: "© Stadia Maps" },
  "CartoDB Positron": { url: "https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png", attribution: "© CartoDB" },
  "CartoDB Dark": { url: "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png", attribution: "© CartoDB" },
  "Esri Satelit": { url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}", attribution: "© Esri" },
  "OpenStreetMap": { url: "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", attribution: "© OpenStreetMap" },
};

function loadLeafletRolling() {
  return new Promise(resolve => {
    if (window.L) return resolve();
    if (!document.getElementById("leafletCSSRolling")) {
      const link = document.createElement("link");
      link.id = "leafletCSSRolling"; link.rel = "stylesheet";
      link.href = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
      document.head.appendChild(link);
    }
    const script = document.createElement("script");
    script.src = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js";
    script.onload = resolve;
    document.head.appendChild(script);
  });
}

window.openMapRolling = async function() {
  const rightPanel = document.getElementById("custRightPanel");
  const empty      = document.getElementById("custRightEmpty");
  const content    = document.getElementById("custRightContent");
  if (!rightPanel) return;

  // hide empty & content, inject map wrap
  if (empty)   empty.style.display   = "none";
  if (content) content.style.display = "flex";

  const body = document.getElementById("custRightBody");
  if (!body) return;
  body.style.padding = "0";
  body.style.overflow = "hidden";
  // hapus instance lama
  const oldWrap = document.getElementById("mapRollingWrap");
  if (oldWrap) { oldWrap.remove(); if (rollingMap) { rollingMap.remove(); rollingMap = null; } }

  // buat wrap baru
  const wrap = document.createElement("div");
  wrap.id = "mapRollingWrap";
  wrap.className = "map-rolling-wrap";
  wrap.innerHTML = `
    <div class="map-rolling-header">
      <div class="map-rolling-search" id="mapRollingSearchWrap">
        <i class="fa-solid fa-magnifying-glass"></i>
        <input type="text" id="mapRollingSearchInput" placeholder="Cari customer...">
        <div class="map-rolling-suggest" id="mapRollingSuggest"></div>
      </div>
      <div class="map-tile-select-wrap" id="mapRollingTileWrap">
        <button class="map-tile-btn" id="mapRollingTileBtn">
          <i class="fa-solid fa-layer-group"></i>
          <span id="mapRollingTileBtnLabel">${rollingSavedTile}</span>
          <i class="fa-solid fa-chevron-down"></i>
        </button>
        <div class="map-tile-dropdown" id="mapRollingTileDropdown"></div>
      </div>
      <button class="map-rolling-close-btn" id="mapRollingClose">
        <i class="fa-solid fa-xmark"></i>
      </button>
    </div>
    <div class="map-rolling-filter-bar" id="mapRollingFilterBar">
      <div class="peta-filter-wrap" id="mapRollingFilterPemilikWrap">
        <button class="peta-filter-btn" id="mapRollingFilterPemilikBtn">
          <i class="fa-solid fa-user"></i>
          <span id="mapRollingFilterPemilikLabel">Pemilik</span>
          <i class="fa-solid fa-chevron-down"></i>
        </button>
        <button class="peta-filter-clear" id="mapRollingFilterPemilikClear" style="display:none">
          <i class="fa-solid fa-xmark"></i>
        </button>
        <div class="peta-filter-dropdown" id="mapRollingFilterPemilikDropdown" style="display:none"></div>
      </div>
      <div class="peta-filter-wrap" id="mapRollingFilterHariWrap">
        <button class="peta-filter-btn" id="mapRollingFilterHariBtn">
          <i class="fa-solid fa-calendar"></i>
          <span id="mapRollingFilterHariLabel">Hari</span>
          <i class="fa-solid fa-chevron-down"></i>
        </button>
        <button class="peta-filter-clear" id="mapRollingFilterHariClear" style="display:none">
          <i class="fa-solid fa-xmark"></i>
        </button>
        <div class="peta-filter-dropdown" id="mapRollingFilterHariDropdown" style="display:none"></div>
      </div>
      <div class="peta-filter-wrap">
        <button class="peta-filter-btn" id="mapRollingFilterNamaBtn">
          <i class="fa-solid fa-tag"></i>
          <span>Nama</span>
        </button>
      </div>
    </div>
    <div class="map-rolling-map-wrap">
      <div class="map-rolling-count" id="mapRollingCount">0 Customer</div>
      <div id="mapRollingEl"></div>
    </div>`;
  body.innerHTML = "";
  body.appendChild(wrap);

  const title = document.getElementById("custRightTitle");
  if (title) title.textContent = "Map Rolling";

  // mobile — show panel kanan
  if (window.innerWidth <= 768) {
    rightPanel.classList.add("show");
    const backBtn = document.getElementById("topbarBackBtn");
    if (backBtn) backBtn.style.display = "flex";
  }

  // mode rolling aktif — ubah tombol jadi toggle map/list di mobile
  const rollingMapBtn = document.getElementById("custRollingMapBtn");
  if (rollingMapBtn) {
    rollingMapBtn.classList.add("active");
    rollingMapBtn.innerHTML = window.innerWidth <= 768
      ? `<i class="fa-solid fa-map"></i>`
      : `<i class="fa-solid fa-xmark"></i>`;
    const newBtn = rollingMapBtn.cloneNode(true);
    rollingMapBtn.parentNode.replaceChild(newBtn, rollingMapBtn);
    newBtn.addEventListener("click", () => {
      if (window.innerWidth <= 768) {
        const rightPanel = document.getElementById("custRightPanel");
        const isShow = rightPanel?.classList.contains("show");
        if (isShow) {
          rightPanel.classList.remove("show");
          newBtn.innerHTML = `<i class="fa-solid fa-map"></i>`;
        } else {
          rightPanel.classList.add("show");
          newBtn.innerHTML = `<i class="fa-solid fa-map"></i>`;
          setTimeout(() => rollingMap?.invalidateSize(), 150);
        }
      } else {
        window.closeMapRolling();
      }
    });

    // tombol X close mode rolling — hanya di mobile
    const closeBtn = document.getElementById("custRollingCloseBtn");
    if (closeBtn) {
      closeBtn.style.display = window.innerWidth <= 768 ? "flex" : "none";
      // filter hari dropdown
    let rollingFilterHari = localStorage.getItem("rollingFilterHari") || "Senin";
    const hariWrap     = document.getElementById("custRollingHariWrap");
    const hariBtn      = document.getElementById("custRollingHariBtn");
    const hariLabel    = document.getElementById("custRollingHariLabel");
    const hariClear    = document.getElementById("custRollingHariClear");
    const hariDropdown = document.getElementById("custRollingHariDropdown");
    if (hariWrap) hariWrap.style.display = "flex";

    // restore state
    if (rollingFilterHari) {
      if (hariLabel) hariLabel.textContent = rollingFilterHari;
      hariBtn?.classList.add("active");
      if (hariClear) hariClear.style.display = "flex";
      hariDropdown?.querySelectorAll(".peta-filter-option").forEach(o => {
        o.classList.toggle("selected", o.dataset.hari === rollingFilterHari);
      });
    }

    hariBtn?.addEventListener("click", e => {
      e.stopPropagation();
      const isOpen = hariDropdown?.style.display !== "none";
      hariDropdown.style.display = isOpen ? "none" : "block";
    });

    hariDropdown?.querySelectorAll(".peta-filter-option").forEach(opt => {
      opt.addEventListener("click", e => {
        e.stopPropagation();
        rollingFilterHari = opt.dataset.hari;
        localStorage.setItem("rollingFilterHari", rollingFilterHari);
        if (hariLabel) hariLabel.textContent = rollingFilterHari || "Hari";
        hariBtn?.classList.toggle("active", !!rollingFilterHari);
        if (hariClear) hariClear.style.display = rollingFilterHari ? "flex" : "none";
        hariDropdown.querySelectorAll(".peta-filter-option").forEach(o => o.classList.remove("selected"));
        opt.classList.add("selected");
        hariDropdown.style.display = "none";
      });
    });

    hariClear?.addEventListener("click", e => {
      e.stopPropagation();
      rollingFilterHari = "";
      localStorage.removeItem("rollingFilterHari");
      if (hariLabel) hariLabel.textContent = "Hari";
      hariBtn?.classList.remove("active");
      hariClear.style.display = "none";
      hariDropdown?.querySelectorAll(".peta-filter-option").forEach(o => {
        o.classList.toggle("selected", o.dataset.hari === "Senin");
      });
    });

    document.addEventListener("click", e => {
      if (!hariWrap?.contains(e.target)) hariDropdown.style.display = "none";
    });
      const newClose = closeBtn.cloneNode(true);
      closeBtn.parentNode.replaceChild(newClose, closeBtn);
      newClose.addEventListener("click", () => window.closeMapRolling());
    }
  }
  await loadLeafletRolling();

  const kantorCabang = await window.idb.getKantorCabang();
  const centerLat    = kantorCabang?.lokasiCabang?.latitude  || -6.2;
  const centerLng    = kantorCabang?.lokasiCabang?.longitude || 106.8;

  const renderer = L.canvas();
  rollingMap = L.map("mapRollingEl", {
    center: [centerLat, centerLng], zoom: 12,
    zoomControl: true, renderer
  });
  setTimeout(() => rollingMap.invalidateSize(), 150);

  // tile
  const tileConf = mapTilesRolling[rollingSavedTile] || mapTilesRolling["Alidade Smooth"];
  rollingTileLayer = L.tileLayer(tileConf.url, { attribution: tileConf.attribution, maxZoom: 19 }).addTo(rollingMap);

  // tile dropdown
  const tileDropdown = document.getElementById("mapRollingTileDropdown");
  tileDropdown.innerHTML = Object.keys(mapTilesRolling).map(name =>
    `<div class="map-tile-option ${name === rollingSavedTile ? "active" : ""}" data-tile="${name}">${name}</div>`
  ).join("");
  document.getElementById("mapRollingTileBtn").onclick = e => {
    e.stopPropagation(); tileDropdown.classList.toggle("show");
  };
  tileDropdown.querySelectorAll(".map-tile-option").forEach(opt => {
    opt.onclick = e => {
      e.stopPropagation();
      rollingSavedTile = opt.dataset.tile;
      localStorage.setItem("rollingTileCabang", rollingSavedTile);
      document.getElementById("mapRollingTileBtnLabel").textContent = rollingSavedTile;
      rollingMap.removeLayer(rollingTileLayer);
      const conf = mapTilesRolling[rollingSavedTile];
      rollingTileLayer = L.tileLayer(conf.url, { attribution: conf.attribution, maxZoom: 19 }).addTo(rollingMap);
      tileDropdown.querySelectorAll(".map-tile-option").forEach(o => o.classList.remove("active"));
      opt.classList.add("active");
      tileDropdown.classList.remove("show");
    };
  });

  // kantor cabang pin
  if (kantorCabang?.lokasiCabang?.latitude) {
    const pinIcon = L.icon({ iconUrl: "pin.png", iconSize: [36,36], iconAnchor: [18,36] });
    L.marker([centerLat, centerLng], { icon: pinIcon })
      .bindPopup(`<strong>${kantorCabang.namaCabang || "Kantor Cabang"}</strong>`)
      .addTo(rollingMap);
  }

  // load semua customer dari IDB
  const HARI_LIST   = ["Senin","Selasa","Rabu","Kamis","Jumat","Sabtu","Minggu"];
  const kurirUsers  = (window.usersCache||[]).filter(u => u.role === "kurir");
  const hunterUsers = (window.usersCache||[]).filter(u => u.role === "hunter");
  const salesUsers  = (window.usersCache||[]).filter(u => u.role === "sales");
  const allUsers    = [...kurirUsers, ...hunterUsers, ...salesUsers];

  const allRoles = [
    { users: kurirUsers,  getIdb: (uid, h) => window.idb.getCustKurir(uid, h),  pinType: "kurir"  },
    { users: hunterUsers, getIdb: (uid, h) => window.idb.getCustHunter(uid, h), pinType: "hunter" },
    { users: salesUsers,  getIdb: (uid, h) => window.idb.getCustSales(uid, h),  pinType: "sales"  },
  ];

  const layerGroups = {};
  const allMarkers  = [];
  const allBounds   = [];

  for (const h of HARI_LIST) {
    layerGroups[h] = L.layerGroup().addTo(rollingMap);
    for (const { users: roleUsers, getIdb, pinType } of allRoles) {
      for (const u of roleUsers) {
        const customers = await getIdb(u.uid, h) || [];
        customers.forEach(c => {
          const lat = c.lokasiCustomer?.latitude  || c.lokasiCustomer?._lat;
          const lng = c.lokasiCustomer?.longitude || c.lokasiCustomer?._long;
          if (!lat || !lng) return;
          allBounds.push([lat, lng]);

          let marker;
          if (pinType === "hunter") {
            marker = L.marker([lat, lng], { icon: L.icon({ iconUrl: "pinHunter.png", iconSize: [28,28], iconAnchor: [14,28] }) });
          } else if (pinType === "sales") {
            marker = L.marker([lat, lng], { icon: L.icon({ iconUrl: "pinSales.png", iconSize: [28,28], iconAnchor: [14,28] }) });
          } else {
            marker = L.circleMarker([lat, lng], {
              renderer, radius: 7,
              fillColor: hariColorsRolling[h], fillOpacity: 1, color: "#fff", weight: 2,
            });
          }

          marker._petaNama        = c.namaCustomer || "";
          marker._petaHari        = h;
          marker._petaPemilikId   = u.uid;
          marker._petaPemilikNama = u.nama || "-";
          marker._petaId          = c.id   || "";
          marker.bindPopup(`
            <div class="cust-popup">
              ${c.foto ? `<img src="${c.foto}" class="cust-popup-foto">` : ""}
              <div class="cust-popup-info">
                <strong>${c.namaCustomer || "-"}</strong>
                <span>${pinType}: ${u.nama || "-"}</span>
                <span style="color:${hariColorsRolling[h]};font-weight:600">${h}</span>
              </div>
            </div>`, { maxWidth: 220 });
          layerGroups[h].addLayer(marker);
          allMarkers.push(marker);
        });
      }
    }
  }
  window.rollingMap = rollingMap;
  window._rollingAllMarkers = allMarkers;
  if (allBounds.length) rollingMap.fitBounds(allBounds, { padding: [40,40] });
  document.getElementById("mapRollingCount").textContent = `${allMarkers.length} Customer`;

  // filter & search
  let filterPemilik = null;
  let filterHari    = null;
  let showNama      = false;

  const namaLabels = [];
  function applyRollingFilter() {
    const q = document.getElementById("mapRollingSearchInput")?.value.toLowerCase().trim() || "";
    let count = 0;

    // hapus semua label dulu
    namaLabels.forEach(label => rollingMap.removeLayer(label));
    namaLabels.length = 0;

    // hapus semua layer dulu
    Object.values(layerGroups).forEach(lg => lg.clearLayers());

    // tambah hanya yang match
    allMarkers.forEach(m => {
      const match = (!q || m._petaNama.toLowerCase().includes(q))
                 && (!filterPemilik || m._petaPemilikId === filterPemilik)
                 && (!filterHari    || m._petaHari === filterHari);
      if (!match) return;
      count++;
      layerGroups[m._petaHari].addLayer(m);

      // label on-demand hanya untuk yang match
      if (showNama) {
        const text  = showNamaType === "pemilik" ? m._petaPemilikNama : m._petaNama;
        const label = L.marker(m.getLatLng(), {
          icon: L.divIcon({ html: `<div class="peta-nama-label">${text}</div>`, className: "", iconSize: null, iconAnchor: [0,20] }),
          interactive: false,
        });
        label.addTo(rollingMap);
        namaLabels.push(label);
      }
    });

    document.getElementById("mapRollingCount").textContent = `${count} Customer`;
  }

  // dropdown pemilik
  const pemilikMap      = {};
  allUsers.forEach(u => { pemilikMap[u.uid] = u.nama || "-"; });
  const pemilikDropdown = document.getElementById("mapRollingFilterPemilikDropdown");
  pemilikDropdown.innerHTML = [
    `<div class="peta-filter-option selected" data-id="">Semua Pemilik</div>`,
    ...allUsers.map(u => `<div class="peta-filter-option" data-id="${u.uid}">${u.nama||"-"} (${u.role})</div>`)
  ].join("");
  document.getElementById("mapRollingFilterPemilikBtn").onclick = e => {
    e.stopPropagation();
    const isOpen = pemilikDropdown.style.display !== "none";
    document.getElementById("mapRollingFilterHariDropdown").style.display = "none";
    pemilikDropdown.style.display = isOpen ? "none" : "block";
  };
  pemilikDropdown.querySelectorAll(".peta-filter-option").forEach(opt => {
    opt.onclick = e => {
      e.stopPropagation();
      filterPemilik = opt.dataset.id || null;
      document.getElementById("mapRollingFilterPemilikLabel").textContent = filterPemilik ? pemilikMap[filterPemilik] : "Pemilik";
      document.getElementById("mapRollingFilterPemilikBtn").classList.toggle("active", !!filterPemilik);
      document.getElementById("mapRollingFilterPemilikClear").style.display = filterPemilik ? "flex" : "none";
      pemilikDropdown.querySelectorAll(".peta-filter-option").forEach(o => o.classList.remove("selected"));
      opt.classList.add("selected");
      pemilikDropdown.style.display = "none";
      applyRollingFilter();
    };
  });
  document.getElementById("mapRollingFilterPemilikClear").onclick = e => {
    e.stopPropagation();
    filterPemilik = null;
    document.getElementById("mapRollingFilterPemilikLabel").textContent = "Pemilik";
    document.getElementById("mapRollingFilterPemilikBtn").classList.remove("active");
    document.getElementById("mapRollingFilterPemilikClear").style.display = "none";
    pemilikDropdown.querySelector("[data-id='']")?.classList.add("selected");
    applyRollingFilter();
  };

  // dropdown hari
  const hariDropdown = document.getElementById("mapRollingFilterHariDropdown");
  hariDropdown.innerHTML = [
    `<div class="peta-filter-option selected" data-hari="">Semua Hari</div>`,
    ...HARI_LIST.map(h => `<div class="peta-filter-option" data-hari="${h}" style="border-left:3px solid ${hariColorsRolling[h]};padding-left:9px">${h}</div>`)
  ].join("");
  document.getElementById("mapRollingFilterHariBtn").onclick = e => {
    e.stopPropagation();
    const isOpen = hariDropdown.style.display !== "none";
    document.getElementById("mapRollingFilterPemilikDropdown").style.display = "none";
    hariDropdown.style.display = isOpen ? "none" : "block";
  };
  hariDropdown.querySelectorAll(".peta-filter-option").forEach(opt => {
    opt.onclick = e => {
      e.stopPropagation();
      filterHari = opt.dataset.hari || null;
      document.getElementById("mapRollingFilterHariLabel").textContent = filterHari || "Hari";
      document.getElementById("mapRollingFilterHariBtn").classList.toggle("active", !!filterHari);
      document.getElementById("mapRollingFilterHariClear").style.display = filterHari ? "flex" : "none";
      hariDropdown.querySelectorAll(".peta-filter-option").forEach(o => o.classList.remove("selected"));
      opt.classList.add("selected");
      hariDropdown.style.display = "none";
      applyRollingFilter();
    };
  });
  document.getElementById("mapRollingFilterHariClear").onclick = e => {
    e.stopPropagation();
    filterHari = null;
    document.getElementById("mapRollingFilterHariLabel").textContent = "Hari";
    document.getElementById("mapRollingFilterHariBtn").classList.remove("active");
    document.getElementById("mapRollingFilterHariClear").style.display = "none";
    hariDropdown.querySelector("[data-hari='']")?.classList.add("selected");
    applyRollingFilter();
  };

  // nama dropdown
  let showNamaType = null;
  const namaDropdown = document.createElement("div");
  namaDropdown.className = "peta-filter-dropdown";
  namaDropdown.style.display = "none";
  namaDropdown.innerHTML = `
    <div class="peta-filter-option" data-nama="customer">Nama Customer</div>
    <div class="peta-filter-option" data-nama="pemilik">Nama Pemilik</div>`;
  document.getElementById("mapRollingFilterNamaBtn")?.parentElement?.appendChild(namaDropdown);

  document.getElementById("mapRollingFilterNamaBtn").onclick = e => {
    e.stopPropagation();
    const isOpen = namaDropdown.style.display !== "none";
    document.getElementById("mapRollingFilterPemilikDropdown").style.display = "none";
    document.getElementById("mapRollingFilterHariDropdown").style.display = "none";
    namaDropdown.style.display = isOpen ? "none" : "block";
  };

  namaDropdown.querySelectorAll(".peta-filter-option").forEach(opt => {
    opt.onclick = e => {
      e.stopPropagation();
      const val = opt.dataset.nama;
      if (showNamaType === val) {
        showNamaType = null;
        showNama = false;
        namaDropdown.querySelectorAll(".peta-filter-option").forEach(o => o.classList.remove("selected"));
        document.getElementById("mapRollingFilterNamaBtn").classList.remove("active");
        namaLabels.forEach(label => rollingMap.removeLayer(label));
      } else {
        showNamaType = val;
        showNama = true;
        namaDropdown.querySelectorAll(".peta-filter-option").forEach(o => o.classList.remove("selected"));
        opt.classList.add("selected");
        document.getElementById("mapRollingFilterNamaBtn").classList.add("active");
      }
      namaDropdown.style.display = "none";

      // update label sesuai tipe
      // hapus label lama
      namaLabels.forEach(label => rollingMap.removeLayer(label));
      namaLabels.length = 0;

      // buat label baru on-demand
      if (showNama) {
        allMarkers.forEach(m => {
          const text = showNamaType === "pemilik" ? m._petaPemilikNama : m._petaNama;
          const label = L.marker(m.getLatLng(), {
            icon: L.divIcon({ html: `<div class="peta-nama-label">${text}</div>`, className: "", iconSize: null, iconAnchor: [0,20] }),
            interactive: false,
          });
          namaLabels.push(label);
        });
      }
      rollingMap.on("zoomend", applyRollingFilter);
      applyRollingFilter();
    };
  });
  // search suggest
  const searchInput = document.getElementById("mapRollingSearchInput");
  const suggestEl   = document.getElementById("mapRollingSuggest");
  searchInput?.addEventListener("input", () => {
    const q = searchInput.value.toLowerCase().trim();
    if (!q) { suggestEl.innerHTML = ""; suggestEl.style.display = "none"; applyRollingFilter(); return; }
    const matches = allMarkers.filter(m =>
      m._petaNama.toLowerCase().includes(q) ||
      m._petaPemilikNama.toLowerCase().includes(q) ||
      m._petaHari.toLowerCase().includes(q)
    ).slice(0, 10);
    if (!matches.length) { suggestEl.innerHTML = ""; suggestEl.style.display = "none"; return; }
    suggestEl.style.display = "block";
    suggestEl.innerHTML = matches.map((m, i) => `
      <div class="map-rolling-suggest-item" data-idx="${i}">
        <div class="map-rolling-suggest-nama">${m._petaNama}</div>
        <div class="map-rolling-suggest-sub">
          <span style="color:${hariColorsRolling[m._petaHari]};font-weight:600">${m._petaHari}</span>
          · ${m._petaPemilikNama}
        </div>
      </div>`).join("");
    suggestEl.querySelectorAll(".map-rolling-suggest-item").forEach((item, i) => {
      item.addEventListener("click", () => {
        const m = matches[i];
        searchInput.value = m._petaNama;
        suggestEl.innerHTML = ""; suggestEl.style.display = "none";
        rollingMap.flyTo(m.getLatLng(), 16, { animate: true, duration: 0.8 });
        setTimeout(() => {
          if (!layerGroups[m._petaHari].hasLayer(m)) layerGroups[m._petaHari].addLayer(m);
          m.openPopup();
          if (m.setStyle) m.setStyle({ radius: 12, weight: 3 });
          setTimeout(() => { if (m.setStyle) m.setStyle({ radius: 7, weight: 2 }); }, 1500);
        }, 900);
      });
    });
  });

  // close dropdown klik luar
  document.addEventListener("click", () => {
    pemilikDropdown.style.display = "none";
    hariDropdown.style.display    = "none";
    namaDropdown.style.display    = "none";
    tileDropdown.classList.remove("show");
    suggestEl.innerHTML = ""; suggestEl.style.display = "none";
  });
  document.getElementById("mapRollingClose").onclick = () => window.closeMapRolling();
};
window.closeMapRolling = function() {
  const wrap = document.getElementById("mapRollingWrap");
  if (wrap) wrap.remove();
  if (rollingMap) { rollingMap.remove(); rollingMap = null; }
  // reset active card
  document.querySelectorAll("#custDetailList .cust-card").forEach(c => c.classList.remove("active"));
  window.rollingMap = null;
  window._rollingAllMarkers = [];
  // reset panel kanan
  const empty   = document.getElementById("custRightEmpty");
  const content = document.getElementById("custRightContent");
  const body    = document.getElementById("custRightBody");
  if (empty)   empty.style.display   = "flex";
  if (content) content.style.display = "none";
  if (body)    { body.style.padding = ""; body.style.overflow = ""; body.innerHTML = ""; }

  // reset tombol rolling
  const rollingMapBtn = document.getElementById("custRollingMapBtn");
  if (rollingMapBtn) {
    rollingMapBtn.classList.remove("active");
    rollingMapBtn.innerHTML = `<i class="fa-solid fa-shuffle"></i>`;
    const newBtn = rollingMapBtn.cloneNode(true);
    rollingMapBtn.parentNode.replaceChild(newBtn, rollingMapBtn);
    newBtn.addEventListener("click", () => window.openMapRolling());
  }
  // hide tombol X
  const closeBtn = document.getElementById("custRollingCloseBtn");
  if (closeBtn) closeBtn.style.display = "none";
  // hide filter hari
  const hariWrap = document.getElementById("custRollingHariWrap");
  if (hariWrap) hariWrap.style.display = "none";
  // mobile — hide panel kanan
  if (window.innerWidth <= 768) {
    document.getElementById("custRightPanel")?.classList.remove("show");
    const backBtn = document.getElementById("topbarBackBtn");
    if (backBtn) backBtn.style.display = "none";
  }
};
