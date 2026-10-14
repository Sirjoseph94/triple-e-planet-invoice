/* Invoice rendering and money helpers. No DOM access except in renderInvoice's returned string. */
(function () {
  "use strict";

  const ONES = ["", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten", "Eleven",
    "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen", "Seventeen", "Eighteen", "Nineteen"];
  const TENS = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];
  const SCALES = ["", "Thousand", "Million", "Billion", "Trillion"];

  function below1000(n) {
    let out = "";
    if (n >= 100) {
      out += ONES[Math.floor(n / 100)] + " Hundred";
      n %= 100;
      if (n) out += " and ";
    }
    if (n >= 20) {
      out += TENS[Math.floor(n / 10)];
      if (n % 10) out += "-" + ONES[n % 10];
    } else if (n > 0) {
      out += ONES[n];
    }
    return out;
  }

  function integerToWords(n) {
    if (n === 0) return "Zero";
    const parts = [];
    let scale = 0;
    while (n > 0 && scale < SCALES.length) {
      const chunk = n % 1000;
      if (chunk) {
        let w = below1000(chunk);
        if (SCALES[scale]) w += " " + SCALES[scale];
        parts.unshift(w);
      }
      n = Math.floor(n / 1000);
      scale++;
    }
    // "One Million and Five" style: add "and" before a last chunk that is under 100
    let s = parts.join(" ");
    return s.replace(/(Thousand|Million|Billion|Trillion) (?=(?:[A-Z][a-z]+(?:-[A-Z][a-z]+)?)$)/, "$1 and ");
  }

  /** 1500.5 -> "One Thousand Five Hundred Naira, Fifty Kobo Only" */
  function amountInWords(total) {
    const kobo = Math.round(total * 100);
    if (!isFinite(kobo) || kobo <= 0) return "";
    const naira = Math.floor(kobo / 100);
    const k = kobo % 100;
    let s = "";
    if (naira > 0) s += integerToWords(naira) + " Naira";
    if (k > 0) s += (s ? ", " : "") + integerToWords(k) + " Kobo";
    return s + " Only";
  }

  function num(v) {
    const n = parseFloat(String(v).replace(/,/g, ""));
    return isFinite(n) ? n : 0;
  }

  function fmt(n) {
    return n.toLocaleString("en-NG", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  }

  function compute(d) {
    const lines = (d.items || []).map((it) => {
      const q = num(it.qty), r = num(it.rate);
      const has = String(it.qty).trim() !== "" || String(it.desc).trim() !== "" || String(it.rate).trim() !== "";
      return { qty: it.qty, desc: it.desc, rate: r, amount: q * r, has, q };
    }).filter((l) => l.has);
    const sub = lines.reduce((s, l) => s + l.amount, 0);
    const vatRate = num(d.vatRate);
    const vat = vatRate > 0 ? Math.round(sub * vatRate) / 100 : 0;
    const total = sub + vat;
    return { lines, sub, vat, vatRate, total };
  }

  const LEAF = (id) => `
    <linearGradient id="${id}" x1="0" y1="1" x2="0.6" y2="0">
      <stop offset="0" stop-color="#2e8b2f"/><stop offset=".55" stop-color="#7fc241"/><stop offset="1" stop-color="#d6e85a"/>
    </linearGradient>`;
  const LEAF_PATH = "M0 34 C-24 20 -22 -14 2 -40 C26 -14 24 20 0 34 Z";

  // Decorations are drawn as <img> with an inline SVG so the PDF capture renders them reliably.
  function svgImg(cls, w, h, inner, style) {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">${inner}</svg>`;
    return `<img class="${cls}" ${style ? `style="${style}" ` : ""}width="${w}" height="${h}" alt="" src="data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}">`;
  }

  function topDeco() {
    return svgImg("deco-top", 853, 270, `
      <defs>${LEAF("lgA")}${LEAF("lgB")}
        <linearGradient id="gtop" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#0a5a34"/><stop offset="1" stop-color="#033f27"/></linearGradient></defs>
      <path d="M575 0 C690 32 810 90 853 172 L853 0 Z" fill="url(#gtop)"/>
      <path d="M520 0 C655 36 800 104 853 208 L853 172 C810 90 690 32 575 0 Z" fill="#fcca04"/>
      <g transform="translate(782 52) rotate(-26)"><path d="${LEAF_PATH}" fill="url(#lgA)"/><path d="M0 30 L1 -30" stroke="#f4ffd0" stroke-opacity=".7" stroke-width="1.4"/></g>
      <g transform="translate(818 74) rotate(28) scale(.92)"><path d="${LEAF_PATH}" fill="url(#lgB)"/><path d="M0 30 L1 -30" stroke="#f4ffd0" stroke-opacity=".7" stroke-width="1.4"/></g>
    `);
  }

  function botDeco() {
    return svgImg("deco-bot", 853, 150, `
      <defs><linearGradient id="gbot" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#16702f"/><stop offset="1" stop-color="#0b5a30"/></linearGradient>
        <linearGradient id="lgC" x1="0" y1="1" x2="0.5" y2="0"><stop offset="0" stop-color="#f6c800"/><stop offset=".5" stop-color="#cfe13c"/><stop offset="1" stop-color="#8ccf3f"/></linearGradient></defs>
      <path d="M0 52 C190 106 430 118 610 114 C725 112 800 84 853 50 L853 150 L0 150 Z" fill="url(#gbot)"/>
      <path d="M0 150 L0 90 C150 112 330 122 560 112 L300 150 Z" fill="#000" fill-opacity=".07"/>
      <path d="M0 30 C190 98 430 112 610 104 C730 98 805 66 853 26 L853 50 C800 84 725 112 610 114 C430 118 190 106 0 52 Z" fill="#fcca04"/>
      <g transform="translate(802 106) rotate(38) scale(1.2)"><path d="${LEAF_PATH}" fill="url(#lgC)"/><path d="M0 30 L1 -30" stroke="#fffbd0" stroke-opacity=".75" stroke-width="1.4"/></g>
    `);
  }

  const PIN = svgImg("ic", 26, 30, `<path d="M13 0C6.4 0 1.5 5 1.5 11.3 1.5 19.6 13 30 13 30S24.5 19.6 24.5 11.3C24.5 5 19.6 0 13 0Z" fill="#05492e"/><circle cx="13" cy="11.3" r="4.6" fill="#fcfefb"/>`, "left:38px;top:2px");
  const PHONE = svgImg("ic", 34, 34, `<circle cx="17" cy="17" r="17" fill="#05492e"/><path d="M12.2 9.2c.5-.5 1.4-.5 1.9.1l1.9 2.4c.4.5.4 1.2 0 1.7l-1 1.1c.9 1.9 2.3 3.4 4.2 4.5l1.2-.9c.5-.4 1.2-.4 1.7 0l2.4 1.8c.6.4.7 1.3.2 1.9l-1 1.2c-.8.9-2.1 1.3-3.3.9C15.7 23 11 18.3 9.9 13.9c-.3-1.2 0-2.4.9-3.2z" fill="#fcfefb"/>`, "left:34px;top:50px");

  /**
   * data: {no, date, customer, phone, address, items[], vatRate, custSig}
   * biz:  {address, phones, authSig}
   */
  function renderInvoice(d, biz, opts) {
    opts = opts || {};
    const c = compute(d);
    const minRows = 9;
    const rows = [];
    c.lines.forEach((l) => {
      const hasRate = String(l.rate) !== "0" || l.amount !== 0;
      rows.push(`<div class="tr"><div>${esc(l.qty)}</div><div>${esc(l.desc)}</div><div>${hasRate ? fmt(l.rate) : ""}</div><div>${l.amount ? fmt(l.amount) : ""}</div></div>`);
    });
    for (let i = rows.length; i < minRows; i++) rows.push(`<div class="tr"><div></div><div></div><div></div><div></div></div>`);

    const addr = esc(biz.address).replace(/\n/g, "<br>");
    const dateStr = d.date ? formatDate(d.date) : "";

    const html = `<div class="inv">
      ${topDeco()}${botDeco()}
      <div class="hd">
        <img class="logo" src="assets/logo.png" alt="">
        <div class="vr"></div>
        <div class="t1">TRIPLE-E</div><div class="t2">FOOD PLANET</div>
        <div class="tag"><i></i><b>Nourish the World</b><i></i></div>
        <div class="l1">FOODSTUFF &nbsp;•&nbsp; PROVISIONS &nbsp;•&nbsp; DRINKS &amp; BEVERAGES</div>
        <div class="l2">QUALITY FOOD &nbsp;|&nbsp; FRESH SUPPLIES &nbsp;|&nbsp; GREAT VALUE</div>
      </div>
      <div class="banner"><h1>CASH SALES INVOICE / RECEIPT</h1><div class="thanks">Thank you<br>for your patronage!</div></div>
      <div class="fields">
        <div class="frow"><div class="f w1"><label>Invoice No.:</label><div class="v">${esc(d.no)}</div></div><div class="f w2"><label>Date:</label><div class="v">${esc(dateStr)}</div></div></div>
        <div class="frow"><div class="f"><label>Customer Name:</label><div class="v">${esc(d.customer)}</div></div></div>
        <div class="frow"><div class="f"><label>Phone No.:</label><div class="v">${esc(d.phone)}</div></div></div>
        <div class="frow"><div class="f"><label>Address:</label><div class="v">${esc(d.address)}</div></div></div>
      </div>
      <div class="tbl">
        <div class="tr th"><div>QTY</div><div>DESCRIPTION OF GOODS</div><div>RATE</div><div>AMOUNT</div></div>
        <div class="tb"><img class="wm" src="assets/logo.png" alt="">${rows.join("")}</div>
      </div>
      <div class="tot">
        <div class="trow"><div class="k">SUB TOTAL</div><div class="n">${c.sub ? fmt(c.sub) : ""}</div></div>
        <div class="trow"><div class="k">VAT<small>(if any)</small></div><div class="n">${c.vat ? fmt(c.vat) : ""}</div></div>
        <div class="trow yl"><div class="k">TOTAL</div><div class="n">${c.total ? fmt(c.total) : ""}</div></div>
      </div>
      <div class="words"><b>AMOUNT IN WORDS:</b><div class="line">${esc(amountInWords(c.total))}</div></div>
      <div class="ft">
        ${PIN}<div class="addr">${addr}</div>
        ${PHONE}<div class="ph">${esc(biz.phones)}</div>
        <div class="vr2"></div>
        <div class="sig cu"><div class="pad">${d.custSig ? `<img src="${d.custSig}" alt="">` : ""}</div><div class="ln"></div><span>Customer Signature</span></div>
        <div class="sig au"><div class="pad">${biz.authSig ? `<img src="${biz.authSig}" alt="">` : ""}</div><div class="ln"></div><span>Authorized Signature</span></div>
      </div>
    </div>`;
    return html;
  }

  function formatDate(iso) {
    // iso "2026-10-14" -> "14/10/2026"
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
    return m ? `${m[3]}/${m[2]}/${m[1]}` : iso;
  }

  window.Invoice = { renderInvoice, compute, amountInWords, fmt, num, esc, formatDate };
})();
