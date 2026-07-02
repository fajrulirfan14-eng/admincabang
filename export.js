
/* ── LOAD LIBRARY ── */
async function loadHtml2Canvas() {
  if (window.html2canvas) return window.html2canvas;
  return new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = "https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js";
    script.onload  = () => resolve(window.html2canvas);
    script.onerror = () => reject(new Error("Gagal load html2canvas"));
    document.head.appendChild(script);
  });
}

async function loadJsPDF() {
  if (window.jspdf) return window.jspdf.jsPDF;
  return new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = "https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js";
    script.onload  = () => resolve(window.jspdf.jsPDF);
    script.onerror = () => reject(new Error("Gagal load jsPDF"));
    document.head.appendChild(script);
  });
}
/* ── EXPORT PNG TABEL (full scroll) ── */
window.exportTabelPNG = async function(elementId, filename = "export") {
  const el = document.getElementById(elementId);
  if (!el) { window.showToast?.("Element tidak ditemukan", "error"); return; }

  try {
    window.showToast?.("Menyiapkan PNG...", "");
    const html2canvas = await loadHtml2Canvas();

    // simpan scroll position
    const scrollTop  = el.scrollTop;
    const scrollLeft = el.scrollLeft;
    const origH      = el.style.height;
    const origOF     = el.style.overflow;

    // expand element supaya semua konten terlihat
    el.style.height   = el.scrollHeight + "px";
    el.style.overflow = "visible";
    el.scrollTop  = 0;
    el.scrollLeft = 0;

    const canvas = await html2canvas(el, {
      scale: 2,
      useCORS: true,
      backgroundColor: "#ffffff",
      width:  el.scrollWidth,
      height: el.scrollHeight,
      logging: false,
    });

    // restore
    el.style.height   = origH;
    el.style.overflow = origOF;
    el.scrollTop  = scrollTop;
    el.scrollLeft = scrollLeft;

    const link = document.createElement("a");
    link.download = `${filename}.png`;
    link.href = canvas.toDataURL("image/png");
    link.click();
    window.showToast?.("PNG berhasil diexport", "success");
  } catch (err) {
    console.error("❌ exportTabelPNG:", err);
    window.showToast?.("Gagal export PNG", "error");
  }
};

/* ── EXPORT CSV TABEL ── */
window.exportTabelCSV = function(elementId, filename = "export") {
  const el = document.getElementById(elementId);
  if (!el) { window.showToast?.("Element tidak ditemukan", "error"); return; }

  try {
    const table = el.querySelector("table");
    if (!table) { window.showToast?.("Tabel tidak ditemukan", "error"); return; }

    const rows = [];
    table.querySelectorAll("tr").forEach(tr => {
      const cells = [];
      tr.querySelectorAll("th, td").forEach(td => {
        const span = Number(td.getAttribute("colspan") || 1);
        const text = td.innerText.trim().replace(/\n/g, " ");
        cells.push(text);
        for (let i = 1; i < span; i++) cells.push(""); // expand colspan
      });
      rows.push(cells);
    });

    const escape = v => `"${String(v ?? "").replace(/"/g, '""')}"`;
    const csv = rows.map(r => r.map(escape).join(",")).join("\n");

    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.href     = URL.createObjectURL(blob);
    link.download = `${filename}.csv`;
    link.click();
    URL.revokeObjectURL(link.href);
    window.showToast?.("CSV berhasil diexport", "success");
  } catch (err) {
    console.error("❌ exportTabelCSV:", err);
    window.showToast?.("Gagal export CSV", "error");
  }
};

/* ── EXPORT PDF ── */
window.exportPDF = async function(elementId, filename = "export") {
  const el = document.getElementById(elementId);
  if (!el) { window.showToast?.("Element tidak ditemukan", "error"); return; }

  try {
    window.showToast?.("Menyiapkan PDF...", "");
    const html2canvas = await loadHtml2Canvas();
    const jsPDF       = await loadJsPDF();

    const canvas = await html2canvas(el, {
      scale: 2,
      useCORS: true,
      backgroundColor: "#ffffff",
      scrollX: 0,
      scrollY: 0,
      width: el.scrollWidth,
      height: el.scrollHeight,
      windowWidth: el.scrollWidth,
      windowHeight: el.scrollHeight,
    });

    const imgData = canvas.toDataURL("image/png");
    const imgW    = canvas.width;
    const imgH    = canvas.height;

    // A4 landscape jika tabel lebar
    const orientation = imgW > imgH ? "landscape" : "portrait";
    const pdf  = new jsPDF({ orientation, unit: "px", format: "a4" });
    const pdfW = pdf.internal.pageSize.getWidth();
    const pdfH = (imgH / imgW) * pdfW;

    pdf.addImage(imgData, "PNG", 0, 0, pdfW, pdfH);
    pdf.save(`${filename}.pdf`);
    window.showToast?.("PDF berhasil diexport", "success");
  } catch (err) {
    console.error("❌ exportPDF:", err);
    window.showToast?.("Gagal export PDF", "error");
  }
};

/* ── EXPORT CSV ── */
// headers: array string
// rows: array of array
window.exportCSV = function(headers, rows, filename = "export") {
  try {
    const escape = v => `"${String(v ?? "").replace(/"/g, '""')}"`;
    const csv = [
      headers.map(escape).join(","),
      ...rows.map(r => r.map(escape).join(","))
    ].join("\n");

    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.href     = URL.createObjectURL(blob);
    link.download = `${filename}.csv`;
    link.click();
    URL.revokeObjectURL(link.href);
    window.showToast?.("CSV berhasil diexport", "success");
  } catch (err) {
    console.error("❌ exportCSV:", err);
    window.showToast?.("Gagal export CSV", "error");
  }
};
