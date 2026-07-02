const DB_NAME    = "adminCabangDB";
const DB_VERSION = 5;

function openAdminDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = e => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains("users")) {
        db.createObjectStore("users", { keyPath: "uid" });
      }
      if (!db.objectStoreNames.contains("kantorCabang")) {
        db.createObjectStore("kantorCabang", { keyPath: "id" });
      }
      if (!db.objectStoreNames.contains("dataHarian")) {
        db.createObjectStore("dataHarian", { keyPath: "id" });
      }
      if (!db.objectStoreNames.contains("custKurir")) {
        db.createObjectStore("custKurir", { keyPath: "id" });
      }
      if (!db.objectStoreNames.contains("custHunter")) {
        db.createObjectStore("custHunter", { keyPath: "id" });
      }
      if (!db.objectStoreNames.contains("custSales")) {
        db.createObjectStore("custSales", { keyPath: "id" });
      }
      if (!db.objectStoreNames.contains("dsmData")) {
        db.createObjectStore("dsmData", { keyPath: "id" });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror   = () => reject(req.error);
  });
}

window.idb = {
  async saveUsers(users) {
    try {
      const db = await openAdminDB();
      const tx = db.transaction("users", "readwrite");
      const st = tx.objectStore("users");
      users.forEach(u => st.put(u));
      await new Promise((res, rej) => { tx.oncomplete = res; tx.onerror = () => rej(tx.error); });
    } catch (err) { console.error("❌ idb.saveUsers:", err); }
  },

  async getUsers() {
    try {
      const db = await openAdminDB();
      return new Promise((resolve, reject) => {
        const req = db.transaction("users", "readonly").objectStore("users").getAll();
        req.onsuccess = () => resolve(req.result);
        req.onerror   = () => reject(req.error);
      });
    } catch (err) { console.error("❌ idb.getUsers:", err); return []; }
  },

  async clearUsers() {
    try {
      const db = await openAdminDB();
      const tx = db.transaction("users", "readwrite");
      tx.objectStore("users").clear();
      await new Promise((res, rej) => { tx.oncomplete = res; tx.onerror = () => rej(tx.error); });
    } catch (err) { console.error("❌ idb.clearUsers:", err); }
  },

  async saveKantorCabang(data) {
    try {
      const db = await openAdminDB();
      const tx = db.transaction("kantorCabang", "readwrite");
      tx.objectStore("kantorCabang").put(data);
      await new Promise((res, rej) => { tx.oncomplete = res; tx.onerror = () => rej(tx.error); });
    } catch (err) { console.error("❌ idb.saveKantorCabang:", err); }
  },

  async getKantorCabang() {
    try {
      const db = await openAdminDB();
      return new Promise((resolve, reject) => {
        const req = db.transaction("kantorCabang", "readonly").objectStore("kantorCabang").getAll();
        req.onsuccess = () => resolve(req.result?.[0] || null);
        req.onerror   = () => reject(req.error);
      });
    } catch (err) { console.error("❌ idb.getKantorCabang:", err); return null; }
  },

  async clearKantorCabang() {
    try {
      const db = await openAdminDB();
      const tx = db.transaction("kantorCabang", "readwrite");
      tx.objectStore("kantorCabang").clear();
      await new Promise((res, rej) => { tx.oncomplete = res; tx.onerror = () => rej(tx.error); });
    } catch (err) { console.error("❌ idb.clearKantorCabang:", err); }
  },

  async saveDataHarian(uidKurir, tanggal, data) {
    try {
      const db = await openAdminDB();
      const tx = db.transaction("dataHarian", "readwrite");
      tx.objectStore("dataHarian").put({ id: `${uidKurir}_${tanggal}`, uidKurir, tanggal, data, updatedAt: Date.now() });
      await new Promise((res, rej) => { tx.oncomplete = res; tx.onerror = () => rej(tx.error); });
    } catch (err) { console.error("❌ idb.saveDataHarian:", err); }
  },

  async getDataHarian(uidKurir, tanggal) {
    try {
      const db = await openAdminDB();
      return new Promise((resolve, reject) => {
        const req = db.transaction("dataHarian", "readonly").objectStore("dataHarian").get(`${uidKurir}_${tanggal}`);
        req.onsuccess = () => resolve(req.result?.data ?? null);
        req.onerror   = () => reject(req.error);
      });
    } catch (err) { console.error("❌ idb.getDataHarian:", err); return null; }
  },

  async clearDataHarian(uidKurir, tanggal) {
    try {
      const db = await openAdminDB();
      const tx = db.transaction("dataHarian", "readwrite");
      tx.objectStore("dataHarian").delete(`${uidKurir}_${tanggal}`);
      await new Promise((res, rej) => { tx.oncomplete = res; tx.onerror = () => rej(tx.error); });
    } catch (err) { console.error("❌ idb.clearDataHarian:", err); }
  },
  
  // ── CUSTOMER KURIR ──
  async saveCustKurir(uid, hari, data) {
    try {
      const db = await openAdminDB();
      const tx = db.transaction("custKurir", "readwrite");
      tx.objectStore("custKurir").put({ id: `${uid}_${hari}`, uid, hari, data, updatedAt: Date.now() });
      await new Promise((res, rej) => { tx.oncomplete = res; tx.onerror = () => rej(tx.error); });
    } catch (err) { console.error("❌ idb.saveCustKurir:", err); }
  },

  async getCustKurir(uid, hari) {
    try {
      const db = await openAdminDB();
      return new Promise((resolve, reject) => {
        const req = db.transaction("custKurir", "readonly").objectStore("custKurir").get(`${uid}_${hari}`);
        req.onsuccess = () => resolve(req.result?.data ?? null);
        req.onerror   = () => reject(req.error);
      });
    } catch (err) { console.error("❌ idb.getCustKurir:", err); return null; }
  },

  async clearCustKurir(uid, hari) {
    try {
      const db = await openAdminDB();
      const tx = db.transaction("custKurir", "readwrite");
      tx.objectStore("custKurir").delete(`${uid}_${hari}`);
      await new Promise((res, rej) => { tx.oncomplete = res; tx.onerror = () => rej(tx.error); });
    } catch (err) { console.error("❌ idb.clearCustKurir:", err); }
  },

  // ── CUSTOMER HUNTER ──
  async saveCustHunter(uid, hari, data) {
    try {
      const db = await openAdminDB();
      const tx = db.transaction("custHunter", "readwrite");
      tx.objectStore("custHunter").put({ id: `${uid}_${hari}`, uid, hari, data, updatedAt: Date.now() });
      await new Promise((res, rej) => { tx.oncomplete = res; tx.onerror = () => rej(tx.error); });
    } catch (err) { console.error("❌ idb.saveCustHunter:", err); }
  },

  async getCustHunter(uid, hari) {
    try {
      const db = await openAdminDB();
      return new Promise((resolve, reject) => {
        const req = db.transaction("custHunter", "readonly").objectStore("custHunter").get(`${uid}_${hari}`);
        req.onsuccess = () => resolve(req.result?.data ?? null);
        req.onerror   = () => reject(req.error);
      });
    } catch (err) { console.error("❌ idb.getCustHunter:", err); return null; }
  },

  async clearCustHunter(uid, hari) {
    try {
      const db = await openAdminDB();
      const tx = db.transaction("custHunter", "readwrite");
      tx.objectStore("custHunter").delete(`${uid}_${hari}`);
      await new Promise((res, rej) => { tx.oncomplete = res; tx.onerror = () => rej(tx.error); });
    } catch (err) { console.error("❌ idb.clearCustHunter:", err); }
  },

  // ── CUSTOMER SALES ──
  async saveCustSales(uid, hari, data) {
    try {
      const db = await openAdminDB();
      const tx = db.transaction("custSales", "readwrite");
      tx.objectStore("custSales").put({ id: `${uid}_${hari}`, uid, hari, data, updatedAt: Date.now() });
      await new Promise((res, rej) => { tx.oncomplete = res; tx.onerror = () => rej(tx.error); });
    } catch (err) { console.error("❌ idb.saveCustSales:", err); }
  },

  async getCustSales(uid, hari) {
    try {
      const db = await openAdminDB();
      return new Promise((resolve, reject) => {
        const req = db.transaction("custSales", "readonly").objectStore("custSales").get(`${uid}_${hari}`);
        req.onsuccess = () => resolve(req.result?.data ?? null);
        req.onerror   = () => reject(req.error);
      });
    } catch (err) { console.error("❌ idb.getCustSales:", err); return null; }
  },

  async clearCustSales(uid, hari) {
    try {
      const db = await openAdminDB();
      const tx = db.transaction("custSales", "readwrite");
      tx.objectStore("custSales").delete(`${uid}_${hari}`);
      await new Promise((res, rej) => { tx.oncomplete = res; tx.onerror = () => rej(tx.error); });
    } catch (err) { console.error("❌ idb.clearCustSales:", err); }
  },
  
  async saveDsmData(uidKurir, tanggal, data) {
    try {
      const db = await openAdminDB();
      const tx = db.transaction("dsmData", "readwrite");
      tx.objectStore("dsmData").put({ id: `${uidKurir}_${tanggal}`, uidKurir, tanggal, data, updatedAt: Date.now() });
      await new Promise((res, rej) => { tx.oncomplete = res; tx.onerror = () => rej(tx.error); });
    } catch (err) { console.error("❌ idb.saveDsmData:", err); }
  },

  async getDsmData(uidKurir, tanggal) {
    try {
      const db = await openAdminDB();
      return new Promise((resolve, reject) => {
        const req = db.transaction("dsmData", "readonly").objectStore("dsmData").get(`${uidKurir}_${tanggal}`);
        req.onsuccess = () => resolve(req.result?.data ?? null);
        req.onerror   = () => reject(req.error);
      });
    } catch (err) { console.error("❌ idb.getDsmData:", err); return null; }
  },

  async clearDsmData(uidKurir, tanggal) {
    try {
      const db = await openAdminDB();
      const tx = db.transaction("dsmData", "readwrite");
      tx.objectStore("dsmData").delete(`${uidKurir}_${tanggal}`);
      await new Promise((res, rej) => { tx.oncomplete = res; tx.onerror = () => rej(tx.error); });
    } catch (err) { console.error("❌ idb.clearDsmData:", err); }
  },
};
