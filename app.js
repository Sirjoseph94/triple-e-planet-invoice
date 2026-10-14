/* Triple-E Invoices: form, preview, saved invoices, PDF. */
(function () {
  "use strict";
  const $ = (s, r) => (r || document).querySelector(s);
  const $$ = (s, r) => Array.from((r || document).querySelectorAll(s));
  const I = window.Invoice;

  /* ---------- storage ---------- */
  const KEY_SET = "te.settings.v1", KEY_INV = "te.invoices.v1", KEY_PROD = "te.products.v1";
  const DEFAULTS = {
    address: "1 Nosakhare Street off Ogheghe\nSapele Road, Benin City.",
    phones: "07066338543 / 08153003774",
    nextNo: 1, vat: 7.5, authSig: ""
  };
  function load(key, fallback) {
    try { const v = JSON.parse(localStorage.getItem(key)); return v == null ? fallback : v; } catch (e) { return fallback; }
  }
  function save(key, val) {
    try { localStorage.setItem(key, JSON.stringify(val)); return true; } catch (e) { toast("Could not save. Storage may be full or blocked."); return false; }
  }
  let settings = Object.assign({}, DEFAULTS, load(KEY_SET, {}));
  let saved = load(KEY_INV, []);
  let products = load(KEY_PROD, {});

  /* ---------- helpers ---------- */
  const pad = (n) => String(n).padStart(4, "0");
  function todayISO() {
    const d = new Date();
    return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
  }
  const blankItem = () => ({ qty: "", desc: "", rate: "" });
  function newInvoice() {
    return {
      id: null, no: pad(settings.nextNo), date: todayISO(), customer: "", phone: "", address: "",
      items: [blankItem(), blankItem(), blankItem()], vatOn: false, vatRate: String(settings.vat), custSig: ""
    };
  }
  let inv = newInvoice();
  let dirty = false;

  let toastTimer;
  function toast(msg) {
    const t = $("#toast");
    t.textContent = msg; t.classList.add("show");
    clearTimeout(toastTimer); toastTimer = setTimeout(() => t.classList.remove("show"), 2600);
  }
  const money = (n) => "₦" + I.fmt(n);
  const forRender = (d) => Object.assign({}, d, { vatRate: d.vatOn ? d.vatRate : 0 });

  /* ---------- navigation ---------- */
  function showView(name) {
    $$(".view").forEach((v) => v.classList.toggle("on", v.id === "view-" + name));
    $$(".tabs button").forEach((b) => b.classList.toggle("on", b.dataset.view === name));
    document.body.classList.toggle("on-new", name === "new");
    if (name === "saved") renderSaved();
    if (name === "settings") fillSettings();
    if (name === "new") requestAnimationFrame(fitPreview);
    window.scrollTo(0, 0);
  }
  $$(".tabs button").forEach((b) => b.addEventListener("click", () => showView(b.dataset.view)));
  $$(".seg button").forEach((b) => b.addEventListener("click", () => {
    $$(".seg button").forEach((x) => x.classList.toggle("on", x === b));
    $(".split").classList.toggle("show-preview", b.dataset.pane === "preview");
    requestAnimationFrame(fitPreview);
    window.scrollTo(0, 0);
  }));

  /* ---------- form <-> state ---------- */
  const F = { no: $("#f-no"), date: $("#f-date"), customer: $("#f-customer"), phone: $("#f-phone"), address: $("#f-address"),
    vatOn: $("#f-vatOn"), vatRate: $("#f-vatRate") };

  function fillForm() {
    F.no.value = inv.no; F.date.value = inv.date; F.customer.value = inv.customer;
    F.phone.value = inv.phone; F.address.value = inv.address;
    F.vatOn.checked = inv.vatOn; F.vatRate.value = inv.vatRate;
    $("#vatRateWrap").classList.toggle("off", !inv.vatOn);
    renderItems(); renderSigs(); update();
  }
  ["no", "date", "customer", "phone", "address", "vatRate"].forEach((k) => {
    F[k].addEventListener("input", () => { inv[k] = F[k].value; dirty = true; update(); });
  });
  F.vatOn.addEventListener("change", () => {
    inv.vatOn = F.vatOn.checked; dirty = true;
    $("#vatRateWrap").classList.toggle("off", !inv.vatOn); update();
  });

  /* ---------- items ---------- */
  function renderItems() {
    const box = $("#items");
    box.innerHTML = "";
    inv.items.forEach((it, i) => {
      const row = document.createElement("div");
      row.className = "item";
      row.innerHTML =
        `<div class="q"><input inputmode="decimal" placeholder="Qty" aria-label="Quantity, item ${i + 1}" value="${I.esc(it.qty)}"></div>` +
        `<div class="d"><input list="productList" placeholder="Description of goods" autocapitalize="sentences" aria-label="Description, item ${i + 1}" value="${I.esc(it.desc)}"></div>` +
        `<div class="r"><input inputmode="decimal" placeholder="Rate" aria-label="Rate, item ${i + 1}" value="${I.esc(it.rate)}"></div>` +
        `<div class="a"><small>Amount</small><span data-amt>${amountText(it)}</span></div>` +
        `<button type="button" class="x" aria-label="Remove item ${i + 1}">&times;</button>`;
      const [q, d, r] = $$("input", row);
      q.addEventListener("input", () => { it.qty = q.value; touchItem(row, it); });
      r.addEventListener("input", () => { it.rate = r.value; touchItem(row, it); });
      d.addEventListener("input", () => { it.desc = d.value; touchItem(row, it); });
      d.addEventListener("change", () => {
        const known = products[d.value.trim().toLowerCase()];
        if (known != null && String(it.rate).trim() === "") { it.rate = String(known); r.value = it.rate; touchItem(row, it); }
      });
      $(".x", row).addEventListener("click", () => {
        inv.items.splice(i, 1);
        if (!inv.items.length) inv.items.push(blankItem());
        dirty = true; renderItems(); update();
      });
      box.appendChild(row);
    });
    $("#itemCount").textContent = inv.items.filter((x) => x.desc || x.qty || x.rate).length + " item(s)";
  }
  const amountText = (it) => { const a = I.num(it.qty) * I.num(it.rate); return a ? I.fmt(a) : "0.00"; };
  function touchItem(row, it) { $("[data-amt]", row).textContent = amountText(it); dirty = true; update(); }
  $("#btnAdd").addEventListener("click", () => {
    inv.items.push(blankItem()); renderItems(); update();
    const last = $$("#items .item").pop(); if (last) $("input", last).focus();
  });

  function renderProductList() {
    const names = new Set();
    Object.keys(products).forEach((k) => names.add(k));
    $("#productList").innerHTML = Array.from(names).sort().map((n) => `<option value="${I.esc(titleCase(n))}">`).join("");
  }
  const titleCase = (s) => s.replace(/\b[a-z]/g, (c) => c.toUpperCase());

  /* ---------- signatures ---------- */
  function renderSigs() {
    $("#custSigPrev").innerHTML = inv.custSig ? `<img src="${inv.custSig}" alt="Customer signature">` : "Not signed";
    $("#authSigPrev").innerHTML = settings.authSig ? `<img src="${settings.authSig}" alt="Authorized signature">` : "Not set up";
    $("#btnCustClear").hidden = !inv.custSig;
    $("#btnAuthSig").textContent = settings.authSig ? "Change" : "Set up";
    $("#btnCustSig").textContent = inv.custSig ? "Sign again" : "Sign";
  }
  const dlg = $("#sigDlg"), cv = $("#sigCanvas"), ctx = cv.getContext("2d");
  let sigTarget = null, drawing = false, inked = false, last = null;
  function openSig(target) {
    sigTarget = target; inked = false;
    $("#sigTitle").textContent = target === "cust" ? "Customer signs here" : "Authorized signature (saved for every invoice)";
    ctx.clearRect(0, 0, cv.width, cv.height);
    dlg.showModal();
  }
  function pt(e) {
    const r = cv.getBoundingClientRect();
    return { x: (e.clientX - r.left) * cv.width / r.width, y: (e.clientY - r.top) * cv.height / r.height };
  }
  cv.addEventListener("pointerdown", (e) => {
    drawing = true; inked = true; last = pt(e); cv.setPointerCapture(e.pointerId);
    ctx.fillStyle = "#0a2a6b"; ctx.beginPath(); ctx.arc(last.x, last.y, 3, 0, 7); ctx.fill();
  });
  cv.addEventListener("pointermove", (e) => {
    if (!drawing) return;
    const p = pt(e);
    ctx.strokeStyle = "#0a2a6b"; ctx.lineWidth = 6; ctx.lineCap = "round"; ctx.lineJoin = "round";
    ctx.beginPath(); ctx.moveTo(last.x, last.y); ctx.lineTo(p.x, p.y); ctx.stroke(); last = p;
  });
  ["pointerup", "pointercancel"].forEach((ev) => cv.addEventListener(ev, () => { drawing = false; }));
  $("#sigClear").addEventListener("click", () => { ctx.clearRect(0, 0, cv.width, cv.height); inked = false; });
  $("#sigCancel").addEventListener("click", () => dlg.close());
  $("#sigOk").addEventListener("click", () => {
    if (!inked) { toast("Draw the signature first."); return; }
    const url = trimmedSig();
    if (sigTarget === "cust") { inv.custSig = url; dirty = true; }
    else { settings.authSig = url; save(KEY_SET, settings); }
    dlg.close(); renderSigs(); update();
  });
  function trimmedSig() {
    const { width: w, height: h } = cv, data = ctx.getImageData(0, 0, w, h).data;
    let x0 = w, y0 = h, x1 = 0, y1 = 0;
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (data[(y * w + x) * 4 + 3] > 10) {
      if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
    }
    const m = 8; x0 = Math.max(0, x0 - m); y0 = Math.max(0, y0 - m); x1 = Math.min(w - 1, x1 + m); y1 = Math.min(h - 1, y1 + m);
    const c = document.createElement("canvas"); c.width = x1 - x0 + 1; c.height = y1 - y0 + 1;
    c.getContext("2d").drawImage(cv, x0, y0, c.width, c.height, 0, 0, c.width, c.height);
    return c.toDataURL("image/png");
  }
  $("#btnCustSig").addEventListener("click", () => openSig("cust"));
  $("#btnAuthSig").addEventListener("click", () => openSig("auth"));
  $("#btnCustClear").addEventListener("click", () => { inv.custSig = ""; dirty = true; renderSigs(); update(); });

  /* ---------- preview ---------- */
  const bizInfo = () => ({ address: settings.address, phones: settings.phones, authSig: settings.authSig });
  let raf = 0;
  function update() {
    if (raf) return;
    raf = requestAnimationFrame(() => {
      raf = 0;
      const d = forRender(inv), c = I.compute(d);
      $("#pv").innerHTML = I.renderInvoice(d, bizInfo(), { uid: "p" });
      $("#liveTotal").textContent = money(c.total);
      $("#liveWords").textContent = I.amountInWords(c.total);
      $("#itemCount").textContent = c.lines.length + " item(s)";
      fitPreview();
    });
  }
  function fitPreview() {
    const wrap = $("#pvWrap"), pv = $("#pv");
    const w = wrap.clientWidth; if (!w) return;
    const s = w / 853;
    pv.style.transform = "scale(" + s + ")";
    wrap.style.height = Math.ceil(pv.offsetHeight * s) + "px";
  }
  if (window.ResizeObserver) new ResizeObserver(fitPreview).observe($("#pvWrap"));
  window.addEventListener("resize", fitPreview);

  /* ---------- save / new ---------- */
  function currentRecord() {
    const c = I.compute(forRender(inv));
    return Object.assign({}, inv, { total: c.total, savedAt: Date.now() });
  }
  function hasContent() { return I.compute(forRender(inv)).lines.length > 0; }
  function persist(quiet) {
    if (!hasContent()) { toast("Add at least one item first."); return false; }
    const isNew = !inv.id;
    if (isNew) inv.id = "i" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
    const rec = currentRecord();
    const at = saved.findIndex((x) => x.id === inv.id);
    if (at >= 0) saved[at] = rec; else saved.unshift(rec);
    // remember products and their last rate
    I.compute(forRender(inv)).lines.forEach((l) => {
      const k = String(l.desc).trim().toLowerCase();
      if (k && l.rate) products[k] = l.rate;
    });
    if (isNew) {
      const n = parseInt(inv.no, 10);
      if (isFinite(n) && n >= settings.nextNo) settings.nextNo = n + 1;
      save(KEY_SET, settings);
    }
    save(KEY_INV, saved); save(KEY_PROD, products); renderProductList();
    dirty = false;
    if (!quiet) toast("Invoice " + inv.no + " saved.");
    return true;
  }
  $("#btnSave").addEventListener("click", () => persist(false));
  $("#btnNew").addEventListener("click", () => {
    if (dirty && hasContent() && !confirmNew) {
      confirmNew = true; $("#btnNew").textContent = "Tap again to discard";
      setTimeout(resetNewBtn, 3000); return;
    }
    resetNewBtn(); inv = newInvoice(); dirty = false; fillForm(); toast("Started a new invoice.");
  });
  let confirmNew = false;
  function resetNewBtn() { confirmNew = false; $("#btnNew").textContent = "Start new"; }

  /* ---------- PDF ---------- */
  async function buildPdf() {
    const d = forRender(inv);
    const stage = $("#stage");
    stage.innerHTML = I.renderInvoice(d, bizInfo(), { uid: "s" });
    const el = stage.firstElementChild;
    if (document.fonts && document.fonts.ready) await document.fonts.ready;
    await Promise.all($$("img", stage).map((im) => (im.decode ? im.decode().catch(() => {}) : Promise.resolve())));
    const h = el.offsetHeight, w = 853;
    const canvas = await html2canvas(el, {
      scale: 3, backgroundColor: "#fcfefb", logging: false, useCORS: true,
      width: w, height: h, windowWidth: w, windowHeight: h, scrollX: 0, scrollY: 0,
      onclone: (doc) => { const s = doc.getElementById("stage"); if (s) { s.style.left = "0"; s.style.top = "0"; s.style.zIndex = "0"; } }
    });
    const jsPDF = window.jspdf.jsPDF;
    const pageW = 148, pageH = Math.round((pageW * h / w) * 100) / 100;
    const pdf = new jsPDF({ unit: "mm", format: [pageW, pageH], orientation: "portrait", compress: true });
    pdf.addImage(canvas.toDataURL("image/jpeg", 0.93), "JPEG", 0, 0, pageW, pageH, undefined, "FAST");
    pdf.setProperties({ title: "Invoice " + inv.no + " - Triple-E Food Planet", author: "Triple-E Food Planet" });
    stage.innerHTML = "";
    return pdf.output("blob");
  }
  function fileName() {
    const who = (inv.customer || "").trim().replace(/[^\w\- ]+/g, "").replace(/\s+/g, "-").slice(0, 30);
    return "Invoice-" + (inv.no || "0000") + (who ? "-" + who : "") + ".pdf";
  }
  function download(blob, name) {
    const url = URL.createObjectURL(blob), a = document.createElement("a");
    a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 30000);
  }
  async function withBusy(btn, label, fn) {
    const old = btn.textContent; btn.disabled = true; btn.textContent = label;
    try { await fn(); } catch (e) { console.error(e); toast("Something went wrong making the PDF. Try again."); }
    finally { btn.disabled = false; btn.textContent = old; }
  }
  $("#btnPdf").addEventListener("click", () => {
    if (!hasContent()) { toast("Add at least one item first."); return; }
    withBusy($("#btnPdf"), "Making PDF...", async () => {
      persist(true);
      const blob = await buildPdf(); download(blob, fileName()); toast("PDF ready. Invoice saved.");
    });
  });
  $("#btnShare").addEventListener("click", () => {
    if (!hasContent()) { toast("Add at least one item first."); return; }
    withBusy($("#btnShare"), "Making PDF...", async () => {
      persist(true);
      const blob = await buildPdf(), name = fileName();
      const file = new File([blob], name, { type: "application/pdf" });
      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        try {
          await navigator.share({ files: [file], title: "Invoice " + inv.no, text: "Invoice " + inv.no + " from Triple-E Food Planet" });
        } catch (e) { if (e && e.name !== "AbortError") { download(blob, name); toast("Sharing is not available here. PDF downloaded instead."); } }
      } else { download(blob, name); toast("This device cannot share files from the app. PDF downloaded instead."); }
    });
  });

  /* ---------- saved list ---------- */
  function renderSaved() {
    const q = $("#q").value.trim().toLowerCase();
    const today = todayISO();
    const todays = saved.filter((x) => x.date === today);
    $("#sumCard").innerHTML =
      `<div><span>Today</span><b>${money(todays.reduce((s, x) => s + (x.total || 0), 0))}</b></div>` +
      `<div><span>Invoices today</span><b>${todays.length}</b></div>` +
      `<div><span>All saved</span><b>${saved.length}</b></div>`;
    const list = saved.filter((x) => !q || [x.customer, x.phone, x.no].join(" ").toLowerCase().includes(q));
    const box = $("#savedList");
    if (!list.length) {
      box.innerHTML = `<div class="empty">${saved.length ? "No invoice matches that search." : "No saved invoices yet. Invoices you save, download or share will appear here."}</div>`;
      return;
    }
    box.innerHTML = list.map((x) =>
      `<div class="inv-card" data-id="${x.id}">
        <div class="nm">${I.esc(x.customer || "Walk-in customer")}</div><div class="tt">${money(x.total || 0)}</div>
        <div class="mt">No. ${I.esc(x.no)} &middot; ${I.esc(I.formatDate(x.date))}${x.phone ? " &middot; " + I.esc(x.phone) : ""}</div><div></div>
        <div class="btns"><button type="button" class="ghost sm" data-act="open">Open</button><button type="button" class="ghost sm" data-act="pdf">PDF</button><button type="button" class="ghost sm" data-act="share">Share</button><button type="button" class="ghost sm danger" data-act="del">Delete</button></div>
      </div>`).join("");
  }
  $("#q").addEventListener("input", renderSaved);
  let delArm = null;
  $("#savedList").addEventListener("click", async (e) => {
    const btn = e.target.closest("button[data-act]"); if (!btn) return;
    const id = btn.closest(".inv-card").dataset.id, rec = saved.find((x) => x.id === id); if (!rec) return;
    const act = btn.dataset.act;
    if (act === "open") {
      inv = JSON.parse(JSON.stringify(rec)); delete inv.total; delete inv.savedAt; dirty = false;
      showView("new"); fillForm(); return;
    }
    if (act === "del") {
      if (delArm !== id) { delArm = id; btn.textContent = "Tap again to delete"; setTimeout(() => { if (delArm === id) { delArm = null; btn.textContent = "Delete"; } }, 3000); return; }
      saved = saved.filter((x) => x.id !== id); save(KEY_INV, saved); delArm = null; renderSaved(); toast("Invoice deleted."); return;
    }
    // pdf / share for a saved record
    const keep = inv, keepDirty = dirty;
    inv = JSON.parse(JSON.stringify(rec));
    await withBusy(btn, "Making...", async () => {
      const blob = await buildPdf(), name = fileName();
      if (act === "share") {
        const file = new File([blob], name, { type: "application/pdf" });
        if (navigator.canShare && navigator.canShare({ files: [file] })) {
          try { await navigator.share({ files: [file], title: "Invoice " + inv.no }); } catch (er) { if (er && er.name !== "AbortError") download(blob, name); }
        } else { download(blob, name); toast("Sharing is not available here. PDF downloaded instead."); }
      } else { download(blob, name); toast("PDF ready."); }
    });
    inv = keep; dirty = keepDirty;
  });

  /* ---------- settings ---------- */
  function fillSettings() {
    $("#s-address").value = settings.address; $("#s-phones").value = settings.phones;
    $("#s-next").value = settings.nextNo; $("#s-vat").value = settings.vat;
    $("#verNote").textContent = "Works offline once opened. Your invoices stay on this device.";
  }
  const bindSetting = (id, fn) => $(id).addEventListener("input", (e) => { fn(e.target.value); save(KEY_SET, settings); update(); });
  bindSetting("#s-address", (v) => (settings.address = v));
  bindSetting("#s-phones", (v) => (settings.phones = v));
  bindSetting("#s-next", (v) => { const n = parseInt(v, 10); if (isFinite(n) && n > 0) settings.nextNo = n; });
  bindSetting("#s-vat", (v) => { const n = I.num(v); settings.vat = n; });

  $("#btnExport").addEventListener("click", () => {
    const blob = new Blob([JSON.stringify({ app: "triple-e-invoices", v: 1, settings, saved, products }, null, 1)], { type: "application/json" });
    download(blob, "triple-e-invoices-backup-" + todayISO() + ".json"); toast("Backup file saved.");
  });
  $("#fileImport").addEventListener("change", async (e) => {
    const f = e.target.files[0]; if (!f) return;
    try {
      const data = JSON.parse(await f.text());
      if (data.app !== "triple-e-invoices" || !Array.isArray(data.saved)) throw new Error("bad file");
      const have = new Set(saved.map((x) => x.id));
      data.saved.forEach((x) => { if (!have.has(x.id)) saved.push(x); });
      saved.sort((a, b) => (b.savedAt || 0) - (a.savedAt || 0));
      products = Object.assign({}, data.products || {}, products);
      if (data.settings) settings = Object.assign({}, data.settings, { nextNo: Math.max(settings.nextNo, data.settings.nextNo || 1) });
      save(KEY_INV, saved); save(KEY_SET, settings); save(KEY_PROD, products);
      fillSettings(); renderProductList(); update(); toast("Backup restored. " + saved.length + " invoices on this device.");
    } catch (err) { toast("That file is not a Triple-E backup."); }
    e.target.value = "";
  });

  /* ---------- start ---------- */
  document.body.classList.add("on-new");
  renderProductList(); fillForm();
  window.addEventListener("beforeunload", (e) => { if (dirty && hasContent()) { e.preventDefault(); e.returnValue = ""; } });
  if ("serviceWorker" in navigator && location.protocol.startsWith("http")) {
    navigator.serviceWorker.register("sw.js").catch(() => {});
  }
})();
