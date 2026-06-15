const APP_VERSION  = "5";
const CACHE_STATIC = `static-v${APP_VERSION}`;

const STATIC_ASSETS = [
  "/",
  "/index.html",
  "/manifest.json",
  "/root.css",
  "/index.css",
  "/index.js",
  "/fcm.js",
  "/ai-float-btn.js",
  "/home.css",
  "/home.js",
  "/input.css",
  "/input.js",
  "/customer.css",
  "/customer.js",
  "/analisis.css",
  "/analisis.js",
  "/chat.css",
  "/chat.js",
  "/map.css",
  "/map.js",
  "/rolling.css",
  "/rolling.js",
  "/rollingcustomer.css",
  "/rollingcustomer.js",
  "/operasional.css",
  "/operasional.js",
  "/profil.css",
  "/profil.js",
  "/slip.css",
  "/slip.js",
  "/keamanan.css",
  "/keamanan.js",
  "/perjanjian.css",
  "/perjanjian.js",
  "/peraturan.css",
  "/peraturan.js",
  "/tentang.css",
  "/aksesibilitas.css",
  "/cleaner.css",
  "/login.html",
  "/login.css",
  "/login.js",
  "/LogoTTN.png",
  "/pin.png",
  "/pinOf.png",
  "/pinOn.png",
  "/icon_32.png",
  "/icon_48.png",
  "/icon_192.png",
  "/icon_512.png",
];

// Install — cache semua aset statis
self.addEventListener("install", event => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_STATIC).then(cache => cache.addAll(STATIC_ASSETS))
  );
});

// Activate — hapus cache lama
self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys.filter(k => k !== CACHE_STATIC).map(k => caches.delete(k))
      ))
      .then(() => self.clients.claim())
  );
});

// Fetch
self.addEventListener("fetch", event => {
  if (event.request.method !== "GET") return;

  const url = new URL(event.request.url);

  // Firebase/Google API — selalu network
  if (
    url.hostname.includes("firestore.googleapis.com") ||
    url.hostname.includes("firebase") ||
    url.hostname.includes("googleapis.com") ||
    url.hostname.includes("gstatic.com") ||
    url.hostname.includes("firebaseio.com")
  ) {
    event.respondWith(fetch(event.request));
    return;
  }

  // Google Maps — network first, fallback cache
  if (
    url.hostname.includes("maps.googleapis.com") ||
    url.hostname.includes("maps.gstatic.com")
  ) {
    event.respondWith(
      fetch(event.request)
        .then(res => {
          const clone = res.clone();
          caches.open(CACHE_STATIC).then(cache => cache.put(event.request, clone));
          return res;
        })
        .catch(() => caches.match(event.request))
    );
    return;
  }

  // Aset statis — cache first, fallback network
  event.respondWith(
    caches.match(event.request).then(cached => {
      if (cached) return cached;
      return fetch(event.request).then(res => {
        if (!res || res.status !== 200) return res;
        const clone = res.clone();
        caches.open(CACHE_STATIC).then(cache => cache.put(event.request, clone));
        return res;
      });
    })
  );
});