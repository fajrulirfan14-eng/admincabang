window.openCropModal = function({ file, ratio = 16/9, onSave }) {
  const existing = document.getElementById("cropModalOverlay");
  if (existing) existing.remove();

  const reader = new FileReader();
  reader.onload = e => {
    const imgSrc = e.target.result;

    const overlay = document.createElement("div");
    overlay.id = "cropModalOverlay";
    overlay.style.cssText = `
      position: fixed; inset: 0; z-index: 99999;
      background: rgba(0,0,0,0.92);
      display: flex; flex-direction: column;
      align-items: center; justify-content: center;
      gap: 16px; padding: 20px;
    `;

    overlay.innerHTML = `
      <div style="color:#fff;font-size:14px;font-weight:600;font-family:'Poppins',sans-serif;">
        Crop Foto (16:9)
      </div>
      <div id="cropWrap" style="
        position: relative;
        width: 100%; max-width: 600px;
        background: #111;
        border-radius: 16px;
        overflow: hidden;
        touch-action: none;
      ">
        <canvas id="cropCanvas" style="display:block;width:100%;"></canvas>
        <div id="cropBox" style="
          position: absolute;
          border: 2px solid #fff;
          box-shadow: 0 0 0 9999px rgba(0,0,0,0.55);
          cursor: move;
          touch-action: none;
        "></div>
      </div>
      <div style="display:flex;gap:12px;">
        <button id="cropCancel" style="
          padding: 10px 24px;
          background: rgba(255,255,255,0.1);
          border: 1px solid rgba(255,255,255,0.2);
          border-radius: 10px; color: #fff;
          font-size: 13px; font-weight: 600;
          font-family: 'Poppins', sans-serif;
          cursor: pointer;
        ">Batal</button>
        <button id="cropSave" style="
          padding: 10px 24px;
          background: var(--brand-primary);
          border: none; border-radius: 10px; color: #fff;
          font-size: 13px; font-weight: 600;
          font-family: 'Poppins', sans-serif;
          cursor: pointer;
        ">Simpan</button>
      </div>
    `;

    document.body.appendChild(overlay);

    const canvas  = document.getElementById("cropCanvas");
    const cropBox = document.getElementById("cropBox");
    const ctx     = canvas.getContext("2d");
    const img     = new Image();

    img.onload = () => {
      const maxW  = Math.min(600, window.innerWidth - 40);
      const scale = maxW / img.width;
      canvas.width  = img.width;
      canvas.height = img.height;
      canvas.style.width  = maxW + "px";
      canvas.style.height = (img.height * scale) + "px";
      ctx.drawImage(img, 0, 0);

      // Init crop box 16:9
      const dispW = maxW;
      const dispH = img.height * scale;
      let bw = dispW * 0.9;
      let bh = bw / ratio;
      if (bh > dispH * 0.9) { bh = dispH * 0.9; bw = bh * ratio; }
      let bx = (dispW - bw) / 2;
      let by = (dispH - bh) / 2;

      function updateBox() {
        cropBox.style.left   = bx + "px";
        cropBox.style.top    = by + "px";
        cropBox.style.width  = bw + "px";
        cropBox.style.height = bh + "px";
      }
      updateBox();

      // Drag crop box
      let dragging = false, startX = 0, startY = 0, startBx = 0, startBy = 0;

      function onDown(cx, cy) {
        dragging = true;
        startX = cx; startY = cy;
        startBx = bx; startBy = by;
      }
      function onMove(cx, cy) {
        if (!dragging) return;
        const wrap = document.getElementById("cropWrap");
        const rect = wrap.getBoundingClientRect();
        const dispW = rect.width;
        const dispH = rect.height;
        bx = Math.min(Math.max(startBx + (cx - startX), 0), dispW - bw);
        by = Math.min(Math.max(startBy + (cy - startY), 0), dispH - bh);
        updateBox();
      }
      function onUp() { dragging = false; }

      cropBox.addEventListener("mousedown",  e => { e.preventDefault(); onDown(e.clientX, e.clientY); });
      document.addEventListener("mousemove", e => onMove(e.clientX, e.clientY));
      document.addEventListener("mouseup",   onUp);
      cropBox.addEventListener("touchstart", e => { e.preventDefault(); onDown(e.touches[0].clientX, e.touches[0].clientY); }, { passive: false });
      document.addEventListener("touchmove", e => { if (dragging) { e.preventDefault(); onMove(e.touches[0].clientX, e.touches[0].clientY); } }, { passive: false });
      document.addEventListener("touchend",  onUp);

      // Simpan
      document.getElementById("cropSave").onclick = () => {
        const wrap  = document.getElementById("cropWrap");
        const rect  = wrap.getBoundingClientRect();
        const scaleX = img.width  / rect.width;
        const scaleY = img.height / rect.height;
        const sx = bx * scaleX;
        const sy = by * scaleY;
        const sw = bw * scaleX;
        const sh = bh * scaleY;

        const out = document.createElement("canvas");
        out.width  = 1280;
        out.height = 720;
        const octx = out.getContext("2d");
        octx.drawImage(img, sx, sy, sw, sh, 0, 0, 1280, 720);

        // Compress
        out.toBlob(blob => {
          overlay.remove();
          onSave(blob);
        }, "image/jpeg", 0.78);
      };

      document.getElementById("cropCancel").onclick = () => overlay.remove();
      overlay.addEventListener("click", e => { if (e.target === overlay) overlay.remove(); });
    };

    img.src = imgSrc;
  };
  reader.readAsDataURL(file);
};