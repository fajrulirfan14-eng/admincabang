/* ── MAP CABANG (adminCabang SPA) ── */

const mapTilesCabang = {
  "Alidade Smooth": { url: "https://tiles.stadiamaps.com/tiles/alidade_smooth/{z}/{x}/{y}{r}.png", attribution: "© Stadia Maps" },
  "CartoDB Positron": { url: "https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png", attribution: "© CartoDB" },
  "CartoDB Dark": { url: "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png", attribution: "© CartoDB" },
  "Esri Satelit": { url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}", attribution: "© Esri" },
  "OpenStreetMap": { url: "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", attribution: "© OpenStreetMap" },
};

const hariColorsCabang = {
  "Senin": "#e74c3c", "Selasa": "#e67e22", "Rabu": "#f1c40f",
  "Kamis": "#2ecc71", "Jumat": "#3498db", "Sabtu": "#9b59b6", "Minggu": "#1abc9c",
};

let petaMap       = null;
let petaTileLayer = null;
let petaSavedTile = localStorage.getItem("petaTileCabang") || "Alidade Smooth";

function loadLeafletCabang() {
  return new Promise(resolve => {
    if (window.L) return resolve();
    if (!document.getElementById("leafletCSSCabang")) {
      const link = document.createElement("link");
      link.id = "leafletCSSCabang"; link.rel = "stylesheet";
      link.href = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
      document.head.appendChild(link);
    }
    const script = document.createElement("script");
    script.src = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js";
    script.onload = resolve;
    document.head.appendChild(script);
  });
}

window.openPetaGlobal = async function(focusCustomer = null) {
  const overlay = document.getElementById("petaGlobalOverlay");
  if (!overlay) return;
  overlay.style.display = "flex";
  requestAnimationFrame(() => overlay.classList.add("show"));

  // set static listeners sekali saja
  if (!overlay._listenersSet) {
    overlay._listenersSet = true;
    document.getElementById("petaGlobalClose")?.addEventListener("click", () => {
      overlay.classList.remove("show");
      setTimeout(() => {
        overlay.style.display = "none";
        if (petaMap) { petaMap.remove(); petaMap = null; }
      }, 250);
    });
    document.getElementById("petaLocateBtn")?.addEventListener("click", () => {
      const kc = kantorCabang;
      if (kc?.lokasiCabang?.latitude && kantorPin) {
        petaMap?.flyTo([kc.lokasiCabang.latitude, kc.lokasiCabang.longitude], 14, {
          animate: true, duration: 0.8
        });
        setTimeout(() => kantorPin.openPopup(), 850);
      }
    });
  }

  await loadLeafletCabang();
  if (petaMap) { petaMap.remove(); petaMap = null; }

  const kantorCabang = await window.idb.getKantorCabang();
  const centerLat    = kantorCabang?.lokasiCabang?.latitude  || -6.2;
  const centerLng    = kantorCabang?.lokasiCabang?.longitude || 106.8;
  let kantorPin = null;
  const renderer = L.canvas();
  petaMap = L.map("petaGlobalMapEl", {
    center: [centerLat, centerLng], zoom: 12,
    zoomControl: true, renderer
  });
  setTimeout(() => petaMap.invalidateSize(), 100);

  // tile layer
  const tileConf = mapTilesCabang[petaSavedTile] || mapTilesCabang["Alidade Smooth"];
  petaTileLayer  = L.tileLayer(tileConf.url, { attribution: tileConf.attribution, maxZoom: 19 }).addTo(petaMap);
  document.getElementById("petaTileBtnLabel").textContent = petaSavedTile;

  // tile dropdown
  const tileDropdown = document.getElementById("petaTileDropdown");
  tileDropdown.innerHTML = Object.keys(mapTilesCabang).map(name =>
    `<div class="map-tile-option ${name === petaSavedTile ? "active" : ""}" data-tile="${name}">${name}</div>`
  ).join("");
  document.getElementById("petaTileBtn").onclick = e => {
    e.stopPropagation();
    tileDropdown.classList.toggle("show");
  };
  tileDropdown.querySelectorAll(".map-tile-option").forEach(opt => {
    opt.onclick = e => {
      e.stopPropagation();
      petaSavedTile = opt.dataset.tile;
      localStorage.setItem("petaTileCabang", petaSavedTile);
      document.getElementById("petaTileBtnLabel").textContent = petaSavedTile;
      petaMap.removeLayer(petaTileLayer);
      const conf = mapTilesCabang[petaSavedTile];
      petaTileLayer = L.tileLayer(conf.url, { attribution: conf.attribution, maxZoom: 19 }).addTo(petaMap);
      tileDropdown.querySelectorAll(".map-tile-option").forEach(o => o.classList.remove("active"));
      opt.classList.add("active");
      tileDropdown.classList.remove("show");
    };
  });

  // kantor cabang pin
  if (kantorCabang?.lokasiCabang?.latitude) {
    const pinIcon = L.icon({
      iconUrl: "pin.png",
      iconSize: [36,36],
      iconAnchor: [18,36]
    });
    kantorPin = L.marker([centerLat, centerLng], { icon: pinIcon })
      .bindPopup(`<strong>${kantorCabang.namaCabang || "Kantor Cabang"}</strong><br><small>${kantorCabang.alamatCabang || ""}</small>`)
      .addTo(petaMap);
  }

  const HARI_LIST    = ["Senin","Selasa","Rabu","Kamis","Jumat","Sabtu","Minggu"];
  const kurirUsers   = (window.usersCache || []).filter(u => u.role === "kurir");
  const hunterUsers  = (window.usersCache || []).filter(u => u.role === "hunter");
  const salesUsers   = (window.usersCache || []).filter(u => u.role === "sales");
  const allUsers     = [...kurirUsers, ...hunterUsers, ...salesUsers];

  const allRoles = [
    { users: kurirUsers,  getIdb: (uid, h) => window.idb.getCustKurir(uid, h),  pinType: "kurir"  },
    { users: hunterUsers, getIdb: (uid, h) => window.idb.getCustHunter(uid, h), pinType: "hunter" },
    { users: salesUsers,  getIdb: (uid, h) => window.idb.getCustSales(uid, h),  pinType: "sales"  },
  ];

  const layerGroups = {};
  const allMarkers  = [];
  const allBounds   = [];

  for (const h of HARI_LIST) {
    layerGroups[h] = L.layerGroup().addTo(petaMap);
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
            marker = L.marker([lat, lng], {
              icon: L.icon({ iconUrl: "pinHunter.png", iconSize: [28,28], iconAnchor: [14,28] })
            });
          } else if (pinType === "sales") {
            marker = L.marker([lat, lng], {
              icon: L.icon({ iconUrl: "pinSales.png", iconSize: [28,28], iconAnchor: [14,28] })
            });
          } else {
            marker = L.circleMarker([lat, lng], {
              renderer, radius: 7,
              fillColor: hariColorsCabang[h], fillOpacity: 1,
              color: "#fff", weight: 2,
            });
          }

          marker._petaNama        = c.namaCustomer || "";
          marker._petaHari        = h;
          marker._petaPemilikId   = u.uid;
          marker._petaPemilikNama = u.nama || "-";
          marker._petaId          = c.id || "";
          marker.bindPopup(`
            <div class="cust-popup">
              ${c.foto ? `<img src="${c.foto}" class="cust-popup-foto">` : ""}
              <div class="cust-popup-info">
                <strong>${c.namaCustomer || "-"}</strong>
                <span>${pinType.charAt(0).toUpperCase()+pinType.slice(1)}: ${u.nama || "-"}</span>
                <span style="color:${hariColorsCabang[h]};font-weight:600">${h}</span>
              </div>
            </div>`, { maxWidth: 220 });
          layerGroups[h].addLayer(marker);
          allMarkers.push(marker);
        });
      }
    }
  }

  if (focusCustomer?.lat) {
    petaMap.flyTo([focusCustomer.lat, focusCustomer.lng], 14, { animate: true, duration: 0.8 });
    setTimeout(() => {
      const target = allMarkers.find(m => m._petaId === focusCustomer.id);
      if (target) {
        const h = target._petaHari;
        if (!layerGroups[h].hasLayer(target)) layerGroups[h].addLayer(target);
        target.openPopup();
        if (target.setStyle) target.setStyle({ radius: 12, weight: 3 });
        setTimeout(() => { if (target.setStyle) target.setStyle({ radius: 7, weight: 2 }); }, 1500);
      }
    }, 900);
  } else if (allBounds.length) {
    petaMap.fitBounds(allBounds, { padding: [40,40] });
  }
  document.getElementById("petaCustomerCount").textContent = `${allMarkers.length} Customer`;

  // filter & search
  let filterPemilik = null;
  let filterHari    = null;
  let showNama      = false;

  const namaLabels = allMarkers.map(m => L.marker(m.getLatLng(), {
    icon: L.divIcon({ html: `<div class="peta-nama-label">${m._petaNama}</div>`, className: "", iconSize: null, iconAnchor: [0,20] }),
    interactive: false,
  }));

  function applyPetaFilter() {
    const q = document.getElementById("petaSearchInput")?.value.toLowerCase().trim() || "";
    let count = 0;

    // hapus semua label dulu
    namaLabels.forEach(label => petaMap.removeLayer(label));
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

      if (showNama) {
        const text  = showNamaType === "pemilik" ? m._petaPemilikNama : m._petaNama;
        const label = L.marker(m.getLatLng(), {
          icon: L.divIcon({ html: `<div class="peta-nama-label">${text}</div>`, className: "", iconSize: null, iconAnchor: [0,20] }),
          interactive: false,
        });
        label.addTo(petaMap);
        namaLabels.push(label);
      }
    });

    document.getElementById("petaCustomerCount").textContent = `${count} Customer`;
  }

  // dropdown pemilik
  const kurirMap = {};
  allUsers.forEach(u => { kurirMap[u.uid] = u.nama || "-"; });
  const pemilikDropdown = document.getElementById("petaFilterPemilikDropdown");
  pemilikDropdown.innerHTML = [
    `<div class="peta-filter-option selected" data-id="">Semua Pemilik</div>`,
    ...allUsers.map(u => `<div class="peta-filter-option" data-id="${u.uid}">${u.nama||"-"} (${u.role})</div>`)
  ].join("");
  document.getElementById("petaFilterPemilikBtn").onclick = e => {
    e.stopPropagation();
    const isOpen = pemilikDropdown.style.display !== "none";
    document.getElementById("petaFilterHariDropdown").style.display = "none";
    pemilikDropdown.style.display = isOpen ? "none" : "block";
  };
  pemilikDropdown.querySelectorAll(".peta-filter-option").forEach(opt => {
    opt.onclick = e => {
      e.stopPropagation();
      filterPemilik = opt.dataset.id || null;
      document.getElementById("petaFilterPemilikLabel").textContent = filterPemilik ? kurirMap[filterPemilik] : "Pemilik";
      document.getElementById("petaFilterPemilikBtn").classList.toggle("active", !!filterPemilik);
      document.getElementById("petaFilterPemilikClear").style.display = filterPemilik ? "flex" : "none";
      pemilikDropdown.querySelectorAll(".peta-filter-option").forEach(o => o.classList.remove("selected"));
      opt.classList.add("selected");
      pemilikDropdown.style.display = "none";
      applyPetaFilter();
    };
  });
  document.getElementById("petaFilterPemilikClear").onclick = e => {
    e.stopPropagation();
    filterPemilik = null;
    document.getElementById("petaFilterPemilikLabel").textContent = "Pemilik";
    document.getElementById("petaFilterPemilikBtn").classList.remove("active");
    document.getElementById("petaFilterPemilikClear").style.display = "none";
    pemilikDropdown.querySelector("[data-id='']")?.classList.add("selected");
    applyPetaFilter();
  };

  // dropdown hari
  const hariDropdown = document.getElementById("petaFilterHariDropdown");
  hariDropdown.innerHTML = [
    `<div class="peta-filter-option selected" data-hari="">Semua Hari</div>`,
    ...HARI_LIST.map(h => `<div class="peta-filter-option" data-hari="${h}" style="border-left:3px solid ${hariColorsCabang[h]};padding-left:9px">${h}</div>`)
  ].join("");
  document.getElementById("petaFilterHariBtn").onclick = e => {
    e.stopPropagation();
    const isOpen = hariDropdown.style.display !== "none";
    document.getElementById("petaFilterPemilikDropdown").style.display = "none";
    hariDropdown.style.display = isOpen ? "none" : "block";
  };
  hariDropdown.querySelectorAll(".peta-filter-option").forEach(opt => {
    opt.onclick = e => {
      e.stopPropagation();
      filterHari = opt.dataset.hari || null;
      document.getElementById("petaFilterHariLabel").textContent = filterHari || "Hari";
      document.getElementById("petaFilterHariBtn").classList.toggle("active", !!filterHari);
      document.getElementById("petaFilterHariClear").style.display = filterHari ? "flex" : "none";
      hariDropdown.querySelectorAll(".peta-filter-option").forEach(o => o.classList.remove("selected"));
      opt.classList.add("selected");
      hariDropdown.style.display = "none";
      applyPetaFilter();
    };
  });
  document.getElementById("petaFilterHariClear").onclick = e => {
    e.stopPropagation();
    filterHari = null;
    document.getElementById("petaFilterHariLabel").textContent = "Hari";
    document.getElementById("petaFilterHariBtn").classList.remove("active");
    document.getElementById("petaFilterHariClear").style.display = "none";
    hariDropdown.querySelector("[data-hari='']")?.classList.add("selected");
    applyPetaFilter();
  };

  // nama dropdown
  const namaDropdown = document.createElement("div");
  namaDropdown.className = "peta-filter-dropdown";
  namaDropdown.style.display = "none";
  namaDropdown.innerHTML = `
    <div class="peta-filter-option ${showNama ? 'selected' : ''}" data-nama="customer">Nama Customer</div>
    <div class="peta-filter-option" data-nama="pemilik">Nama Pemilik</div>
  `;
  document.getElementById("petaFilterNamaWrap")?.appendChild(namaDropdown);

  let showNamaType = null; // "customer" | "pemilik" | null

  document.getElementById("petaFilterNamaBtn").onclick = e => {
    e.stopPropagation();
    const isOpen = namaDropdown.style.display !== "none";
    document.getElementById("petaFilterPemilikDropdown").style.display = "none";
    document.getElementById("petaFilterHariDropdown").style.display = "none";
    namaDropdown.style.display = isOpen ? "none" : "block";
  };

  namaDropdown.querySelectorAll(".peta-filter-option").forEach(opt => {
    opt.onclick = e => {
      e.stopPropagation();
      const val = opt.dataset.nama;
      if (showNamaType === val) {
        // toggle off
        showNamaType = null;
        showNama = false;
        namaDropdown.querySelectorAll(".peta-filter-option").forEach(o => o.classList.remove("selected"));
        document.getElementById("petaFilterNamaBtn").classList.remove("active");
        namaLabels.forEach(label => petaMap.removeLayer(label));
      } else {
        showNamaType = val;
        showNama = true;
        namaDropdown.querySelectorAll(".peta-filter-option").forEach(o => o.classList.remove("selected"));
        opt.classList.add("selected");
        document.getElementById("petaFilterNamaBtn").classList.add("active");
      }
      namaDropdown.style.display = "none";

      // update label di namaLabels sesuai tipe
      namaLabels.forEach((label, i) => {
        const m    = allMarkers[i];
        const text = showNamaType === "pemilik" ? m._petaPemilikNama : m._petaNama;
        label.setIcon(L.divIcon({
          html: `<div class="peta-nama-label">${text}</div>`,
          className: "", iconSize: null, iconAnchor: [0, 20]
        }));
      });

      petaMap.on("zoomend", () => applyPetaFilter());
      applyPetaFilter();
    };
  });

  // search suggest
  const searchInput = document.getElementById("petaSearchInput");
  const searchWrap  = searchInput?.closest(".peta-search-bar");

  // buat suggest container
  const suggestEl = document.createElement("div");
  suggestEl.className = "peta-suggest-list";
  searchWrap?.appendChild(suggestEl);

  searchInput?.addEventListener("input", () => {
    const q = searchInput.value.toLowerCase().trim();
    if (!q) { suggestEl.innerHTML = ""; suggestEl.style.display = "none"; applyPetaFilter(); return; }

    const matches = allMarkers.filter(m =>
      m._petaNama.toLowerCase().includes(q) ||
      m._petaPemilikNama.toLowerCase().includes(q) ||
      m._petaHari.toLowerCase().includes(q)
    ).slice(0, 10);

    if (!matches.length) { suggestEl.innerHTML = ""; suggestEl.style.display = "none"; return; }

    suggestEl.style.display = "block";
    suggestEl.innerHTML = matches.map((m, i) => `
      <div class="peta-suggest-item" data-idx="${i}">
        <div class="peta-suggest-nama">${m._petaNama}</div>
        <div class="peta-suggest-sub">
          <span style="color:${hariColorsCabang[m._petaHari]};font-weight:600">${m._petaHari}</span>
          · ${m._petaPemilikNama}
        </div>
      </div>`).join("");

    suggestEl.querySelectorAll(".peta-suggest-item").forEach((item, i) => {
      item.addEventListener("click", () => {
        const m   = matches[i];
        const lat = m.getLatLng().lat;
        const lng = m.getLatLng().lng;

        searchInput.value = m._petaNama;
        suggestEl.innerHTML = ""; suggestEl.style.display = "none";

        petaMap.flyTo([lat, lng], 16, { animate: true, duration: 0.8 });
        setTimeout(() => {
          // pastikan layer aktif
          const h = m._petaHari;
          if (!layerGroups[h].hasLayer(m)) layerGroups[h].addLayer(m);
          m.openPopup();
          // highlight
          if (m.setStyle) m.setStyle({ radius: 12, weight: 3 });
          setTimeout(() => { if (m.setStyle) m.setStyle({ radius: 7, weight: 2 }); }, 1500);
        }, 850);
      });
    });
  });

  document.addEventListener("click", e => {
    if (!searchWrap?.contains(e.target)) {
      suggestEl.innerHTML = ""; suggestEl.style.display = "none";
    }
  });

  // close dropdown klik luar
  document.addEventListener("click", () => {
    pemilikDropdown.style.display = "none";
    hariDropdown.style.display    = "none";
    tileDropdown.classList.remove("show");
  });
};

// tombol map di topbar
document.getElementById("topbarMap")?.addEventListener("click", () => {
  window.openPetaGlobal();
});