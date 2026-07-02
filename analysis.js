
// ============================================
// REALTIME CLOCK
// ============================================
function updateClock() {
  const now = new Date();
  const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit' };
  document.getElementById('realtime-clock').textContent = now.toLocaleDateString('id-ID', options);
}
setInterval(updateClock, 1000);
updateClock();

// ============================================
// PERIOD FILTER HANDLER
// ============================================
document.querySelectorAll('.period-btn').forEach(btn => {
  btn.addEventListener('click', function() {
    document.querySelectorAll('.period-btn').forEach(b => b.classList.remove('active'));
    this.classList.add('active');
  });
});

// ============================================
// COUNTER ANIMATION
// ============================================
function animateCounter(element, target, prefix = '', suffix = '', duration = 1500) {
  const start = 0;
  const startTime = performance.now();
  function update(currentTime) {
    const elapsed = currentTime - startTime;
    const progress = Math.min(elapsed / duration, 1);
    const easeOut = 1 - Math.pow(1 - progress, 3);
    const current = Math.floor(start + (target - start) * easeOut);
    element.textContent = prefix + current.toLocaleString('id-ID') + suffix;
    if (progress < 1) requestAnimationFrame(update);
  }
  requestAnimationFrame(update);
}

function formatCurrency(value) {
  if (value >= 1000000000) return 'Rp ' + (value / 1000000000).toFixed(1) + ' M';
  if (value >= 1000000) return 'Rp ' + (value / 1000000).toFixed(1) + ' Jt';
  if (value >= 1000) return 'Rp ' + (value / 1000).toFixed(1) + ' Rb';
  return 'Rp ' + value.toLocaleString('id-ID');
}

function formatNumber(value) {
  if (value >= 1000000) return (value / 1000000).toFixed(1) + ' Jt';
  if (value >= 1000) return (value / 1000).toFixed(1) + ' Rb';
  return value.toLocaleString('id-ID');
}

// ============================================
// KPI DATA
// ============================================
const kpiData = [
  { label: 'Total Revenue', value: 2875000000, prefix: 'Rp ', suffix: '', icon: 'M2.25 18L9 11.25l4.306 4.307a11.95 11.95 0 015.814-5.519l2.74-1.22m0 0l-5.94-2.28m5.94 2.28l-2.28 5.941', change: 12.5, up: true },
  { label: 'Gross Profit', value: 892500000, prefix: 'Rp ', suffix: '', icon: 'M12 6v12m-3-2.818l.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 11-18 0 9 9 0 0118 0z', change: 8.3, up: true },
  { label: 'Net Profit', value: 431250000, prefix: 'Rp ', suffix: '', icon: 'M2.25 18L9 11.25l4.306 4.307a11.95 11.95 0 015.814-5.519l2.74-1.22m0 0l-5.94-2.28m5.94 2.28l-2.28 5.941', change: 5.7, up: true },
  { label: 'Total Sales Order', value: 12458, prefix: '', suffix: '', icon: 'M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 002.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 00-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 00.75-.75 2.25 2.25 0 00-.1-.664m-5.8 0A2.251 2.251 0 0113.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25zM6.75 12h.008v.008H6.75V12zm0 3h.008v.008H6.75V15zm0 3h.008v.008H6.75V18z', change: 15.2, up: true },
  { label: 'Customer Aktif', value: 3847, prefix: '', suffix: '', icon: 'M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z', change: 3.4, up: true },
  { label: 'Hunter Aktif', value: 56, prefix: '', suffix: '', icon: 'M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z', change: 8.1, up: true },
  { label: 'Sales Aktif', value: 128, prefix: '', suffix: '', icon: 'M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z', change: 2.1, up: true },
  { label: 'Kurir Aktif', value: 89, prefix: '', suffix: '', icon: 'M8.25 18.75a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m3 0h6m-9 0H3.375a1.125 1.125 0 01-1.125-1.125V14.25m17.25 4.5a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m3 0h1.125c.621 0 1.129-.504 1.09-1.124a17.902 17.902 0 00-3.213-9.193 2.056 2.056 0 00-1.58-.86H14.25M16.5 18.75h-2.25m0-11.177v-.958c0-.568-.422-1.048-.987-1.106a48.554 48.554 0 00-10.026 0 1.106 1.106 0 00-.987 1.106v7.635m12-6.677v6.677m0 4.5v-4.5m0 0h-12', change: -1.2, up: false },
  { label: 'Total Cabang', value: 24, prefix: '', suffix: '', icon: 'M3.75 21h16.5M4.5 3h15M5.25 3v18m13.5-18v18M9 6.75h1.5m-1.5 3h1.5m-1.5 3h1.5m3-6H15m-1.5 3H15m-1.5 3H15M9 21v-3.375c0-.621.504-1.125 1.125-1.125h3.75c.621 0 1.125.504 1.125 1.125V21', change: 4.3, up: true },
  { label: 'Collection Rate', value: 87, prefix: '', suffix: '%', icon: 'M2.25 18.75a7.5 7.5 0 0115 0M2.25 18.75a7.5 7.5 0 0115 0M2.25 18.75a7.5 7.5 0 0115 0M2.25 18.75a7.5 7.5 0 0115 0M2.25 18.75a7.5 7.5 0 0115 0M2.25 18.75a7.5 7.5 0 0115 0M2.25 18.75a7.5 7.5 0 0115 0M2.25 18.75a7.5 7.5 0 0115 0', change: 2.8, up: true },
  { label: 'Conversion Rate', value: 34, prefix: '', suffix: '%', icon: 'M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v2.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125v-2.25zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v2.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125v-2.25zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v2.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125v-2.25z', change: 1.5, up: true },
  { label: 'Retention Rate', value: 78, prefix: '', suffix: '%', icon: 'M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99', change: -0.8, up: false }
];

function renderKPIs() {
  const grid = document.getElementById('kpi-grid');
  kpiData.forEach((kpi, index) => {
    const card = document.createElement('div');
    card.className = 'kpi-card';
    card.innerHTML = `
      <div class="kpi-icon">
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
          <path stroke-linecap="round" stroke-linejoin="round" d="${kpi.icon}"/>
        </svg>
      </div>
      <div class="kpi-label">${kpi.label}</div>
      <div class="kpi-value" data-target="${kpi.value}" data-prefix="${kpi.prefix}" data-suffix="${kpi.suffix}">0</div>
      <div class="kpi-change ${kpi.up ? 'up' : 'down'}">
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" style="width:12px;height:12px;">
          <path stroke-linecap="round" stroke-linejoin="round" d="${kpi.up ? 'M4.5 15.75l7.5-7.5 7.5 7.5' : 'M19.5 8.25l-7.5 7.5-7.5-7.5'}"/>
        </svg>
        ${kpi.change > 0 ? '+' : ''}${kpi.change}% vs bulan lalu
      </div>
    `;
    grid.appendChild(card);
    setTimeout(() => {
      const valEl = card.querySelector('.kpi-value');
      animateCounter(valEl, kpi.value, kpi.prefix, kpi.suffix);
    }, index * 100);
  });
}

// ============================================
// SALES DATA
// ============================================
const salesData = [
  { rank: 1, name: 'Ahmad Fauzi', branch: 'Jakarta Pusat', orders: 342, revenue: 485000000, profit: 145500000, achievement: 112 },
  { rank: 2, name: 'Dewi Kusuma', branch: 'Bandung', orders: 318, revenue: 452000000, profit: 135600000, achievement: 108 },
  { rank: 3, name: 'Budi Santoso', branch: 'Surabaya', orders: 295, revenue: 418000000, profit: 125400000, achievement: 105 },
  { rank: 4, name: 'Siti Rahayu', branch: 'Bekasi', orders: 278, revenue: 394000000, profit: 118200000, achievement: 98 },
  { rank: 5, name: 'Rudi Hartono', branch: 'Tangerang', orders: 264, revenue: 375000000, profit: 112500000, achievement: 94 },
  { rank: 6, name: 'Nina Wulandari', branch: 'Semarang', orders: 251, revenue: 356000000, profit: 106800000, achievement: 91 },
  { rank: 7, name: 'Eko Prasetyo', branch: 'Medan', orders: 238, revenue: 338000000, profit: 101400000, achievement: 89 },
  { rank: 8, name: 'Lina Susanti', branch: 'Makassar', orders: 225, revenue: 319000000, profit: 95700000, achievement: 86 },
  { rank: 9, name: 'Doni Kurniawan', branch: 'Jakarta Selatan', orders: 212, revenue: 301000000, profit: 90300000, achievement: 82 },
  { rank: 10, name: 'Maya Indah', branch: 'Jakarta Utara', orders: 198, revenue: 281000000, profit: 84300000, achievement: 78 }
];

function renderSalesTable() {
  const tbody = document.getElementById('sales-tbody');
  salesData.forEach(sales => {
    const tr = document.createElement('tr');
    const rankClass = sales.rank <= 3 ? `rank-${sales.rank}` : 'rank-other';
    const achClass = sales.achievement >= 100 ? 'high' : sales.achievement >= 90 ? 'medium' : 'low';
    tr.innerHTML = `
      <td><span class="rank-badge ${rankClass}">${sales.rank}</span></td>
      <td><strong>${sales.name}</strong></td>
      <td>${sales.branch}</td>
      <td>${sales.orders.toLocaleString('id-ID')}</td>
      <td>${formatCurrency(sales.revenue)}</td>
      <td>${formatCurrency(sales.profit)}</td>
      <td>
        <div style="display:flex;align-items:center;gap:8px;">
          <div class="progress-bar-bg" style="width:80px;">
            <div class="progress-bar-fill ${achClass}" style="width:${sales.achievement}%"></div>
          </div>
          <span style="font-size:0.8rem;font-weight:700;color:var(--text-heading);">${sales.achievement}%</span>
        </div>
      </td>
    `;
    tbody.appendChild(tr);
  });
}

// ============================================
// HUNTER DATA
// ============================================
const hunterData = [
  { name: 'Rian Wijaya', branch: 'Jakarta Pusat', leads: 245, prospect: 89, closing: 34, conversion: 13.9 },
  { name: 'Putri Amelia', branch: 'Bandung', leads: 198, prospect: 72, closing: 28, conversion: 14.1 },
  { name: 'Andi Nugroho', branch: 'Surabaya', leads: 187, prospect: 65, closing: 25, conversion: 13.4 },
  { name: 'Diana Sari', branch: 'Bekasi', leads: 176, prospect: 58, closing: 22, conversion: 12.5 },
  { name: 'Fajar Maulana', branch: 'Tangerang', leads: 165, prospect: 54, closing: 20, conversion: 12.1 },
  { name: 'Rina Oktavia', branch: 'Semarang', leads: 154, prospect: 48, closing: 18, conversion: 11.7 },
  { name: 'Hendra Gunawan', branch: 'Medan', leads: 143, prospect: 45, closing: 16, conversion: 11.2 },
  { name: 'Intan Permata', branch: 'Makassar', leads: 132, prospect: 41, closing: 15, conversion: 11.4 },
  { name: 'Joko Widodo', branch: 'Jakarta Selatan', leads: 121, prospect: 38, closing: 14, conversion: 11.6 },
  { name: 'Kartika Dewi', branch: 'Jakarta Utara', leads: 110, prospect: 34, closing: 12, conversion: 10.9 }
];

function renderHunters() {
  const grid = document.getElementById('hunter-grid');
  hunterData.forEach((hunter, index) => {
    const card = document.createElement('div');
    card.className = 'hunter-card';
    card.style.animationDelay = `${index * 0.05}s`;
    card.innerHTML = `
      <div class="hunter-header">
        <div class="hunter-avatar">${hunter.name.split(' ').map(n => n[0]).join('')}</div>
        <div>
          <div class="hunter-name">${hunter.name}</div>
          <div class="hunter-branch">${hunter.branch}</div>
        </div>
      </div>
      <div class="hunter-stats">
        <div class="hunter-stat">
          <div class="hunter-stat-value">${hunter.leads}</div>
          <div class="hunter-stat-label">Leads</div>
        </div>
        <div class="hunter-stat">
          <div class="hunter-stat-value">${hunter.prospect}</div>
          <div class="hunter-stat-label">Prospect</div>
        </div>
        <div class="hunter-stat">
          <div class="hunter-stat-value">${hunter.closing}</div>
          <div class="hunter-stat-label">Closing</div>
        </div>
        <div class="hunter-stat">
          <div class="hunter-stat-value">${hunter.conversion}%</div>
          <div class="hunter-stat-label">Conversion</div>
        </div>
      </div>
    `;
    grid.appendChild(card);
  });
}

// ============================================
// PRODUCT DATA
// ============================================
const productData = [
  { rank: 1, name: 'Minyak Goreng Bimoli 2L', category: 'Sembako', qty: 8540, revenue: 597800000, profit: 89670000, margin: 15.0 },
  { rank: 2, name: 'Beras Premium 5kg', category: 'Sembako', qty: 7230, revenue: 506100000, profit: 75915000, margin: 15.0 },
  { rank: 3, name: 'Susu UHT Indomilk 1L', category: 'Dairy', qty: 6120, revenue: 428400000, profit: 64260000, margin: 15.0 },
  { rank: 4, name: 'Mie Instan Indomie 40pcs', category: 'Instant', qty: 5890, revenue: 412300000, profit: 82460000, margin: 20.0 },
  { rank: 5, name: 'Gula Pasir Gulaku 1kg', category: 'Sembako', qty: 5340, revenue: 373800000, profit: 56070000, margin: 15.0 },
  { rank: 6, name: 'Kopi Kapal Api 165g', category: 'Beverage', qty: 4890, revenue: 342300000, profit: 68460000, margin: 20.0 },
  { rank: 7, name: 'Sabun Lifebuoy 85g', category: 'Personal Care', qty: 4560, revenue: 319200000, profit: 63840000, margin: 20.0 },
  { rank: 8, name: 'Shampoo Clear 170ml', category: 'Personal Care', qty: 4230, revenue: 296100000, profit: 59220000, margin: 20.0 },
  { rank: 9, name: 'Tepung Terigu Segitiga 1kg', category: 'Sembako', qty: 3980, revenue: 278600000, profit: 41790000, margin: 15.0 },
  { rank: 10, name: 'Teh Celup Sariwangi 25s', category: 'Beverage', qty: 3650, revenue: 255500000, profit: 51100000, margin: 20.0 }
];

function renderProducts() {
  const tbody = document.getElementById('product-tbody');
  productData.forEach(prod => {
    const tr = document.createElement('tr');
    const rankClass = prod.rank <= 3 ? `rank-${prod.rank}` : 'rank-other';
    tr.innerHTML = `
      <td><span class="rank-badge ${rankClass}">${prod.rank}</span></td>
      <td><strong>${prod.name}</strong></td>
      <td><span style="background:var(--laporan-chip-bg);border:1px solid var(--laporan-chip-border);padding:2px 8px;border-radius:var(--radius-full);font-size:0.7rem;color:var(--laporan-chip-color);">${prod.category}</span></td>
      <td>${prod.qty.toLocaleString('id-ID')}</td>
      <td>${formatCurrency(prod.revenue)}</td>
      <td>${formatCurrency(prod.profit)}</td>
      <td><span style="font-weight:700;color:${prod.margin >= 18 ? '#179c4b' : prod.margin >= 15 ? '#f39c12' : '#d63031'};">${prod.margin}%</span></td>
    `;
    tbody.appendChild(tr);
  });
}

// ============================================
// REGION DATA
// ============================================
const regionData = [
  { name: 'Jawa Barat', revenue: 845000000, customers: 1245, growth: 15.2 },
  { name: 'DKI Jakarta', revenue: 723000000, customers: 1089, growth: 12.8 },
  { name: 'Banten', revenue: 456000000, customers: 678, growth: 8.5 },
  { name: 'Jawa Tengah', revenue: 389000000, customers: 567, growth: 10.3 },
  { name: 'Jawa Timur', revenue: 312000000, customers: 456, growth: 7.2 }
];

function renderRegions() {
  const grid = document.getElementById('region-grid');
  regionData.forEach(region => {
    const card = document.createElement('div');
    card.className = 'region-card';
    card.innerHTML = `
      <div class="region-name">${region.name}</div>
      <div class="region-stat">
        <span class="region-stat-label">Revenue</span>
        <span class="region-stat-value">${formatCurrency(region.revenue)}</span>
      </div>
      <div class="region-stat">
        <span class="region-stat-label">Customer</span>
        <span class="region-stat-value">${region.customers.toLocaleString('id-ID')}</span>
      </div>
      <div class="region-stat">
        <span class="region-stat-label">Growth</span>
        <span class="region-stat-value" style="color:#179c4b;">+${region.growth}%</span>
      </div>
    `;
    grid.appendChild(card);
  });
}

// ============================================
// GAUGE DATA
// ============================================
const gaugeData = [
  { label: 'Gross Margin', value: 31, color: '#b18b63', sub: 'Target: 30%' },
  { label: 'Net Margin', value: 15, color: '#2ecc71', sub: 'Target: 14%' },
  { label: 'Operating Margin', value: 22, color: '#3498db', sub: 'Target: 20%' },
  { label: 'ROI', value: 18, color: '#9b59b6', sub: 'Target: 15%' },
  { label: 'ROA', value: 12, color: '#e67e22', sub: 'Target: 10%' }
];

function renderGauges() {
  const grid = document.getElementById('gauge-grid');
  gaugeData.forEach((gauge, index) => {
    const card = document.createElement('div');
    card.className = 'gauge-card';
    const circumference = 2 * Math.PI * 50;
    const offset = circumference - (gauge.value / 100) * circumference;
    card.innerHTML = `
      <div class="gauge-wrapper">
        <svg class="gauge-svg" width="120" height="120" viewBox="0 0 120 120">
          <circle class="gauge-bg" cx="60" cy="60" r="50"/>
          <circle class="gauge-fill" cx="60" cy="60" r="50" 
            stroke="${gauge.color}" 
            stroke-dasharray="${circumference}" 
            stroke-dashoffset="${circumference}"
            data-offset="${offset}"/>
        </svg>
        <div class="gauge-text">${gauge.value}%</div>
      </div>
      <div class="gauge-label">${gauge.label}</div>
      <div class="gauge-sub">${gauge.sub}</div>
    `;
    grid.appendChild(card);
    setTimeout(() => {
      const fill = card.querySelector('.gauge-fill');
      fill.style.strokeDashoffset = offset;
    }, 300 + index * 150);
  });
}

// ============================================
// ALERT DATA
// ============================================
const alertData = [
  { severity: 'critical', title: 'Revenue Turun Drastis', desc: 'Cabang Medan mengalami penurunan revenue 18% dibanding bulan lalu. Perlu evaluasi strategi penjualan segera.', icon: 'M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z' },
  { severity: 'high', title: 'Piutang Overdue Tinggi', desc: 'Total piutang overdue 90+ hari mencapai Rp 1.2 Miliar. Fokus collection pada 15 customer prioritas.', icon: 'M12 6v12m-3-2.818l.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 11-18 0 9 9 0 0118 0z' },
  { severity: 'high', title: 'Sales Target Belum Tercapai', desc: '5 sales di cabang Tangerang dan Bekasi belum mencapai 80% target bulan ini. Coaching intensif diperlukan.', icon: 'M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v2.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125v-2.25zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v2.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125v-2.25zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v2.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125v-2.25z' },
  { severity: 'medium', title: 'Performa Cabang Turun', desc: 'Cabang Semarang menunjukkan tren penurunan order 8% selama 2 minggu terakhir.', icon: 'M3 3v1.5M3 21v-1.5M3 11.25a.75.75 0 01.75-.75h16.5a.75.75 0 010 1.5H3.75a.75.75 0 01-.75-.75zm0 4.5a.75.75 0 01.75-.75h16.5a.75.75 0 010 1.5H3.75a.75.75 0 01-.75-.75zm0 4.5a.75.75 0 01.75-.75h16.5a.75.75 0 010 1.5H3.75a.75.75 0 01-.75-.75zM3 6.75a.75.75 0 01.75-.75h16.5a.75.75 0 010 1.5H3.75A.75.75 0 013 6.75z' },
  { severity: 'medium', title: 'Churn Rate Meningkat', desc: 'Customer churn rate naik 2.3% di wilayah Jawa Timur. Perlu program retensi khusus.', icon: 'M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z' },
  { severity: 'low', title: 'Stok Produk Menipis', desc: 'Minyak Goreng Bimoli 2L di cabang Makassar hampir habis. Reorder diperlukan dalam 3 hari.', icon: 'M20.25 7.5l-.625 10.632a2.25 2.25 0 01-2.247 2.118H6.622a2.25 2.25 0 01-2.247-2.118L3.75 7.5M10 11.25h4M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125z' }
];

function renderAlerts() {
  const grid = document.getElementById('alert-grid');
  alertData.forEach(alert => {
    const card = document.createElement('div');
    card.className = 'alert-card';
    card.innerHTML = `
      <div class="alert-icon ${alert.severity}">
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
          <path stroke-linecap="round" stroke-linejoin="round" d="${alert.icon}"/>
        </svg>
      </div>
      <div>
        <div class="alert-title">${alert.title}</div>
        <div class="alert-desc">${alert.desc}</div>
        <span class="alert-badge ${alert.severity}">${alert.severity.toUpperCase()}</span>
      </div>
    `;
    grid.appendChild(card);
  });
}

// ============================================
// AI INSIGHT DATA
// ============================================
const insightData = [
  { label: 'Ringkasan Bulan Ini', value: 'Revenue tumbuh 12.5% dengan profit margin stabil di 31%. Total order mencapai 12,458 unit, melebihi target bulanan sebesar 8%.', type: 'neutral' },
  { label: 'Cabang Terbaik', value: 'Jakarta Pusat memimpin dengan revenue Rp 485 Juta dan achievement 112%. Bandung dan Surabaya mengikuti dengan pertumbuhan solid.', type: 'positive' },
  { label: 'Sales Terbaik', value: 'Ahmad Fauzi (Jakarta Pusat) mencapai 342 order dengan revenue Rp 485 Juta. Dewi Kusuma dan Budi Santoso berada di posisi 2 dan 3.', type: 'positive' },
  { label: 'Produk Terbaik', value: 'Minyak Goreng Bimoli 2L mendominasi dengan 8,540 unit terjual. Beras Premium 5kg dan Susu UHT Indomilk 1L mengikuti di posisi berikutnya.', type: 'positive' },
  { label: 'Area Perhatian', value: 'Cabang Medan perlu perhatian khusus dengan penurunan revenue 18%. Piutang overdue 90+ hari mencapai Rp 1.2 Miliar. 5 sales di bawah target 80%.', type: 'negative' },
  { label: 'Rekomendasi AI', value: 'Fokuskan resource ke cabang Medan dan Semarang. Tingkatkan program retensi customer di Jawa Timur. Lakukan coaching intensif untuk sales di bawah target.', type: 'neutral' }
];

function renderInsights() {
  const body = document.getElementById('insight-body');
  insightData.forEach(insight => {
    const item = document.createElement('div');
    item.className = 'insight-item';
    item.innerHTML = `
      <div class="insight-item-label">${insight.label}</div>
      <div class="insight-item-value ${insight.type}">${insight.value}</div>
    `;
    body.appendChild(item);
  });
}

// ============================================
// ORDER STATS
// ============================================
const orderStats = [
  { label: 'Order Selesai', value: 10234, change: 12.5, up: true },
  { label: 'Order Pending', value: 1567, change: -3.2, up: false },
  { label: 'Order Dibatalkan', value: 489, change: -8.1, up: false },
  { label: 'Order Retur', value: 168, change: 2.4, up: true }
];

function renderOrderStats() {
  const container = document.getElementById('order-stats');
  orderStats.forEach(stat => {
    const div = document.createElement('div');
    div.className = 'order-stat';
    div.innerHTML = `
      <div class="order-stat-value">${stat.value.toLocaleString('id-ID')}</div>
      <div class="order-stat-label">${stat.label}</div>
      <div class="order-stat-change ${stat.up ? 'up' : 'down'}">
        ${stat.up ? '▲' : '▼'} ${Math.abs(stat.change)}% vs bulan lalu
      </div>
    `;
    container.appendChild(div);
  });
}

// ============================================
// DELIVERY STATS
// ============================================
const deliveryStats = [
  { label: 'On Time', value: '94.2%' },
  { label: 'Late', value: '3.8%' },
  { label: 'Failed', value: '1.5%' },
  { label: 'Avg Time', value: '2.4h' }
];

function renderDeliveryStats() {
  const container = document.getElementById('delivery-stats');
  deliveryStats.forEach(stat => {
    const div = document.createElement('div');
    div.className = 'delivery-stat';
    div.innerHTML = `
      <div class="delivery-stat-value">${stat.value}</div>
      <div class="delivery-stat-label">${stat.label}</div>
    `;
    container.appendChild(div);
  });
}

// ============================================
// CUSTOMER STATS
// ============================================
const customerStats = [
  { label: 'Customer Growth', value: '+15.2%', sub: 'vs bulan lalu' },
  { label: 'Customer Churn', value: '4.8%', sub: 'vs bulan lalu' },
  { label: 'Retention Rate', value: '78.3%', sub: 'vs bulan lalu' }
];

function renderCustomerStats() {
  const container = document.getElementById('customer-stats');
  customerStats.forEach(stat => {
    const div = document.createElement('div');
    div.className = 'customer-stat';
    div.innerHTML = `
      <div class="customer-stat-value">${stat.value}</div>
      <div class="customer-stat-label">${stat.label}</div>
    `;
    container.appendChild(div);
  });
}

// ============================================
// AGING DATA
// ============================================
const agingData = [
  { label: '0-30 Hari', value: 'Rp 2.1 M' },
  { label: '31-60 Hari', value: 'Rp 890 Jt' },
  { label: '61-90 Hari', value: 'Rp 450 Jt' },
  { label: '90+ Hari', value: 'Rp 1.2 M' }
];

function renderAging() {
  const grid = document.getElementById('aging-grid');
  agingData.forEach(aging => {
    const div = document.createElement('div');
    div.className = 'aging-item';
    div.innerHTML = `
      <div class="aging-value">${aging.value}</div>
      <div class="aging-label">${aging.label}</div>
    `;
    grid.appendChild(div);
  });
}

// ============================================
// CHART CONFIGURATION
// ============================================
Chart.defaults.font.family = "'Inter', sans-serif";
Chart.defaults.color = '#8a6540';
Chart.defaults.scale.grid.color = 'rgba(176,138,92,0.08)';

// ===== REVENUE TREND CHART =====
function initRevenueChart() {
  const ctx = document.getElementById('revenueChart').getContext('2d');
  new Chart(ctx, {
    type: 'line',
    data: {
      labels: ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'],
      datasets: [
        {
          label: 'Revenue',
          data: [2100, 1950, 2300, 2180, 2450, 2600, 2380, 2520, 2710, 2580, 2750, 2875],
          borderColor: '#b18b63',
          backgroundColor: 'rgba(177,139,99,0.1)',
          borderWidth: 3,
          tension: 0.4,
          fill: true,
          pointBackgroundColor: '#b18b63',
          pointBorderColor: '#fff',
          pointBorderWidth: 2,
          pointRadius: 4,
          pointHoverRadius: 6
        },
        {
          label: 'Profit',
          data: [650, 580, 720, 680, 780, 850, 740, 800, 890, 820, 870, 892],
          borderColor: '#2ecc71',
          backgroundColor: 'rgba(46,204,113,0.08)',
          borderWidth: 3,
          tension: 0.4,
          fill: true,
          pointBackgroundColor: '#2ecc71',
          pointBorderColor: '#fff',
          pointBorderWidth: 2,
          pointRadius: 4,
          pointHoverRadius: 6
        },
        {
          label: 'Target',
          data: [2200, 2200, 2400, 2400, 2500, 2600, 2500, 2600, 2700, 2700, 2800, 2900],
          borderColor: '#e74c3c',
          backgroundColor: 'transparent',
          borderWidth: 2,
          borderDash: [6, 4],
          tension: 0.4,
          fill: false,
          pointRadius: 0,
          pointHoverRadius: 4
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: 'index', intersect: false },
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: 'rgba(111,83,50,0.95)',
          titleColor: '#fff',
          bodyColor: '#fff',
          borderColor: 'rgba(176,138,92,0.22)',
          borderWidth: 1,
          padding: 12,
          cornerRadius: 8,
          displayColors: true,
          callbacks: {
            label: function(context) {
              return context.dataset.label + ': Rp ' + context.parsed.y + ' Juta';
            }
          }
        }
      },
      scales: {
        y: {
          beginAtZero: true,
          ticks: {
            callback: function(value) { return 'Rp ' + value + ' Jt'; }
          }
        },
        x: {
          grid: { display: false }
        }
      }
    }
  });
}

// ===== BRANCH CHART =====
function initBranchChart() {
  const ctx = document.getElementById('branchChart').getContext('2d');
  new Chart(ctx, {
    type: 'bar',
    data: {
      labels: ['Jakarta Pusat', 'Bandung', 'Bekasi', 'Tangerang', 'Surabaya', 'Semarang', 'Medan', 'Makassar'],
      datasets: [{
        label: 'Revenue',
        data: [485, 452, 394, 375, 418, 356, 338, 319],
        backgroundColor: [
          'rgba(177,139,99,0.85)',
          'rgba(177,139,99,0.75)',
          'rgba(177,139,99,0.65)',
          'rgba(177,139,99,0.55)',
          'rgba(177,139,99,0.70)',
          'rgba(177,139,99,0.60)',
          'rgba(177,139,99,0.50)',
          'rgba(177,139,99,0.45)'
        ],
        borderColor: 'rgba(177,139,99,0.9)',
        borderWidth: 1,
        borderRadius: 6,
        borderSkipped: false
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: 'rgba(111,83,50,0.95)',
          titleColor: '#fff',
          bodyColor: '#fff',
          padding: 12,
          cornerRadius: 8,
          callbacks: {
            label: function(context) {
              return 'Revenue: Rp ' + context.parsed.y + ' Juta';
            }
          }
        }
      },
      scales: {
        y: {
          beginAtZero: true,
          ticks: {
            callback: function(value) { return 'Rp ' + value + ' Jt'; }
          }
        },
        x: {
          grid: { display: false },
          ticks: { font: { size: 11 } }
        }
      }
    }
  });
}

// ===== CUSTOMER PIE CHART =====
function initCustomerChart() {
  const ctx = document.getElementById('customerChart').getContext('2d');
  new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: ['Retail', 'Grosir', 'Reseller', 'Corporate'],
      datasets: [{
        data: [1845, 1154, 577, 271],
        backgroundColor: ['#b18b63', '#2ecc71', '#3498db', '#9b59b6'],
        borderColor: 'rgba(255,255,255,0.6)',
        borderWidth: 3,
        hoverOffset: 8
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      cutout: '65%',
      plugins: {
        legend: {
          position: 'bottom',
          labels: { padding: 16, usePointStyle: true, pointStyle: 'circle' }
        },
        tooltip: {
          backgroundColor: 'rgba(111,83,50,0.95)',
          titleColor: '#fff',
          bodyColor: '#fff',
          padding: 12,
          cornerRadius: 8,
          callbacks: {
            label: function(context) {
              const total = context.dataset.data.reduce((a, b) => a + b, 0);
              const percentage = ((context.parsed / total) * 100).toFixed(1);
              return context.label + ': ' + context.parsed.toLocaleString('id-ID') + ' (' + percentage + '%)';
            }
          }
        }
      }
    }
  });
}

// ===== ORDER PIE CHART =====
function initOrderPieChart() {
  const ctx = document.getElementById('orderPieChart').getContext('2d');
  new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: ['Selesai', 'Pending', 'Dibatalkan', 'Retur'],
      datasets: [{
        data: [10234, 1567, 489, 168],
        backgroundColor: ['#2ecc71', '#f39c12', '#e74c3c', '#3498db'],
        borderColor: 'rgba(255,255,255,0.6)',
        borderWidth: 3,
        hoverOffset: 8
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      cutout: '60%',
      plugins: {
        legend: {
          position: 'bottom',
          labels: { padding: 12, usePointStyle: true, pointStyle: 'circle', font: { size: 11 } }
        },
        tooltip: {
          backgroundColor: 'rgba(111,83,50,0.95)',
          titleColor: '#fff',
          bodyColor: '#fff',
          padding: 12,
          cornerRadius: 8
        }
      }
    }
  });
}

// ===== ORDER TREND CHART =====
function initOrderTrendChart() {
  const ctx = document.getElementById('orderTrendChart').getContext('2d');
  new Chart(ctx, {
    type: 'line',
    data: {
      labels: ['Minggu 1', 'Minggu 2', 'Minggu 3', 'Minggu 4'],
      datasets: [
        {
          label: 'Bulan Ini',
          data: [2856, 3124, 2987, 3501],
          borderColor: '#b18b63',
          backgroundColor: 'rgba(177,139,99,0.1)',
          borderWidth: 3,
          tension: 0.4,
          fill: true,
          pointRadius: 4,
          pointHoverRadius: 6
        },
        {
          label: 'Bulan Lalu',
          data: [2654, 2890, 2712, 3105],
          borderColor: '#8a6540',
          backgroundColor: 'transparent',
          borderWidth: 2,
          borderDash: [5, 5],
          tension: 0.4,
          fill: false,
          pointRadius: 3,
          pointHoverRadius: 5
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: 'index', intersect: false },
      plugins: {
        legend: {
          position: 'bottom',
          labels: { padding: 12, usePointStyle: true, pointStyle: 'circle' }
        },
        tooltip: {
          backgroundColor: 'rgba(111,83,50,0.95)',
          titleColor: '#fff',
          bodyColor: '#fff',
          padding: 12,
          cornerRadius: 8
        }
      },
      scales: {
        y: { beginAtZero: true },
        x: { grid: { display: false } }
      }
    }
  });
}

// ===== DELIVERY CHART =====
function initDeliveryChart() {
  const ctx = document.getElementById('deliveryChart').getContext('2d');
  new Chart(ctx, {
    type: 'bar',
    data: {
      labels: ['Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab', 'Min'],
      datasets: [
        {
          label: 'On Time',
          data: [142, 138, 145, 152, 148, 89, 45],
          backgroundColor: 'rgba(46,204,113,0.8)',
          borderRadius: 4,
          borderSkipped: false
        },
        {
          label: 'Late',
          data: [8, 12, 6, 5, 9, 4, 2],
          backgroundColor: 'rgba(243,156,18,0.8)',
          borderRadius: 4,
          borderSkipped: false
        },
        {
          label: 'Failed',
          data: [2, 3, 1, 1, 2, 1, 0],
          backgroundColor: 'rgba(231,76,60,0.8)',
          borderRadius: 4,
          borderSkipped: false
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: 'bottom',
          labels: { padding: 12, usePointStyle: true, pointStyle: 'circle' }
        },
        tooltip: {
          backgroundColor: 'rgba(111,83,50,0.95)',
          titleColor: '#fff',
          bodyColor: '#fff',
          padding: 12,
          cornerRadius: 8
        }
      },
      scales: {
        x: { stacked: true, grid: { display: false } },
        y: { stacked: true, beginAtZero: true }
      }
    }
  });
}

// ===== COLLECTION CHART =====
function initCollectionChart() {
  const ctx = document.getElementById('collectionChart').getContext('2d');
  new Chart(ctx, {
    type: 'bar',
    data: {
      labels: ['Jakarta Pusat', 'Bandung', 'Bekasi', 'Tangerang', 'Surabaya', 'Semarang', 'Medan', 'Makassar'],
      datasets: [
        {
          label: '0-30 Hari',
          data: [450, 380, 320, 290, 350, 280, 250, 220],
          backgroundColor: 'rgba(46,204,113,0.7)',
          borderRadius: 4
        },
        {
          label: '31-60 Hari',
          data: [180, 150, 120, 110, 140, 100, 90, 80],
          backgroundColor: 'rgba(243,156,18,0.7)',
          borderRadius: 4
        },
        {
          label: '61-90 Hari',
          data: [90, 80, 60, 50, 70, 40, 35, 30],
          backgroundColor: 'rgba(230,126,34,0.7)',
          borderRadius: 4
        },
        {
          label: '90+ Hari',
          data: [250, 200, 180, 160, 190, 150, 220, 170],
          backgroundColor: 'rgba(231,76,60,0.7)',
          borderRadius: 4
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: 'bottom',
          labels: { padding: 12, usePointStyle: true, pointStyle: 'circle' }
        },
        tooltip: {
          backgroundColor: 'rgba(111,83,50,0.95)',
          titleColor: '#fff',
          bodyColor: '#fff',
          padding: 12,
          cornerRadius: 8,
          callbacks: {
            label: function(context) {
              return context.dataset.label + ': Rp ' + context.parsed.y + ' Juta';
            }
          }
        }
      },
      scales: {
        x: { stacked: true, grid: { display: false } },
        y: {
          stacked: true,
          beginAtZero: true,
          ticks: {
            callback: function(value) { return 'Rp ' + value + ' Jt'; }
          }
        }
      }
    }
  });
}

// ============================================
// INITIALIZE ALL
// ============================================
document.addEventListener('DOMContentLoaded', function() {
  renderKPIs();
  renderSalesTable();
  renderHunters();
  renderProducts();
  renderRegions();
  renderGauges();
  renderAlerts();
  renderInsights();
  renderOrderStats();
  renderDeliveryStats();
  renderCustomerStats();
  renderAging();
  
  setTimeout(() => {
    initRevenueChart();
    initBranchChart();
    initCustomerChart();
    initOrderPieChart();
    initOrderTrendChart();
    initDeliveryChart();
    initCollectionChart();
  }, 300);
});
