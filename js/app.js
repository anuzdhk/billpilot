/* ============================================================
   BillPilot — Simple Invoice Maker
   Vanilla JS. All data stays in localStorage.
   ============================================================ */
(function () {
  "use strict";

  var STORE_KEY = "billpilot.invoices";
  var BIZ_KEY = "billpilot.business";
  var $ = function (id) { return document.getElementById(id); };

  /* ---------------- Currencies (every ISO 4217 currency) ---------------- */
  var FALLBACK_CURRENCIES = ["USD","EUR","GBP","JPY","CNY","INR","AUD","CAD","CHF","NZD","SGD","HKD","SEK","NOK","DKK","PLN","CZK","HUF","RON","BGN","TRY","RUB","UAH","AED","SAR","QAR","KWD","BHD","OMR","ILS","EGP","MAD","TND","DZD","NGN","GHS","KES","TZS","UGX","ZAR","ETB","XOF","XAF","BRL","MXN","ARS","CLP","COP","PEN","UYU","BOB","PYG","VES","GTQ","CRC","DOP","JMD","TTD","BSD","BBD","BZD","HNL","NIO","PAB","KRW","TWD","THB","VND","IDR","MYR","PHP","PKR","BDT","LKR","NPR","MMK","KHR","LAK","MNT","KZT","UZS","AZN","GEL","AMD","BYN","MDL","RSD","MKD","ALL","BAM","ISK","FJD","PGK","WST","TOP","XPF","MUR","SCR","MVR","BND","JOD","LBP","IQD","IRR","AFN","YER","SYP","SDG","SOS","RWF","BIF","MWK","ZMW","MZN","AOA","NAD","BWP","SZL","LSL","MGA","KMF","DJF","ERN","GMD","GNF","LRD","SLE","STN","CVE","MRU","LYD","HTG","CUP","AWG","ANG","XCD","KYD","BMD","GIP","FKP","SHP","TMT","TJS","KGS","BTN","SBD","VUV","KID","TVD"];

  function buildCurrencyList() {
    var codes;
    try {
      codes = Intl.supportedValuesOf("currency");
    } catch (e) {
      codes = FALLBACK_CURRENCIES.slice();
    }
    var names;
    try { names = new Intl.DisplayNames(["en"], { type: "currency" }); } catch (e) { names = null; }
    var list = codes.map(function (code) {
      var name = names ? names.of(code) : code;
      var symbol = code;
      try {
        symbol = (0).toLocaleString("en", { style: "currency", currency: code, minimumFractionDigits: 0, maximumFractionDigits: 0 }).replace(/[\d\s.,-]/g, "") || code;
      } catch (e) { /* keep code */ }
      return { code: code, name: name === code ? code : name, symbol: symbol };
    });
    list.sort(function (a, b) { return a.name.localeCompare(b.name); });
    return list;
  }

  var CURRENCIES = buildCurrencyList();
  var POPULAR = ["USD", "EUR", "GBP", "INR", "AUD", "CAD", "JPY", "CNY", "NPR"];

  function fmtMoney(amount, code) {
    if (!isFinite(amount)) amount = 0;
    try {
      return new Intl.NumberFormat("en", { style: "currency", currency: code, currencyDisplay: "symbol" }).format(amount);
    } catch (e) {
      return code + " " + amount.toFixed(2);
    }
  }

  /* ---------------- Storage ---------------- */
  function loadInvoices() {
    try { return JSON.parse(localStorage.getItem(STORE_KEY)) || []; }
    catch (e) { return []; }
  }
  function saveInvoices(list) {
    localStorage.setItem(STORE_KEY, JSON.stringify(list));
  }
  function loadBusiness() {
    try { return JSON.parse(localStorage.getItem(BIZ_KEY)) || {}; }
    catch (e) { return {}; }
  }
  function saveBusiness(biz) {
    localStorage.setItem(BIZ_KEY, JSON.stringify(biz));
  }

  function nextInvoiceNumber() {
    var list = loadInvoices();
    var max = 0;
    list.forEach(function (inv) {
      var m = /(\d+)\s*$/.exec(inv.number || "");
      if (m) max = Math.max(max, parseInt(m[1], 10));
    });
    return "INV-" + String(max + 1).padStart(4, "0");
  }

  function uid() {
    return "inv_" + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  }

  function todayISO(offsetDays) {
    var d = new Date();
    if (offsetDays) d.setDate(d.getDate() + offsetDays);
    return d.getFullYear() + "-" +
      String(d.getMonth() + 1).padStart(2, "0") + "-" +
      String(d.getDate()).padStart(2, "0");
  }

  function fmtDate(iso) {
    if (!iso) return "";
    var parts = iso.split("-");
    if (parts.length !== 3) return iso;
    var d = new Date(Date.UTC(+parts[0], +parts[1] - 1, +parts[2]));
    return d.toLocaleDateString("en-US", { day: "2-digit", month: "short", year: "numeric", timeZone: "UTC" });
  }

  /* ---------------- Current editor state ---------------- */
  var current = null;   // invoice being edited
  var dirty = false;

  function blankInvoice() {
    var biz = loadBusiness();
    return {
      id: uid(),
      number: nextInvoiceNumber(),
      status: "draft",
      currency: biz.currency || "USD",
      issueDate: todayISO(0),
      dueDate: todayISO(14),
      from: {
        name: biz.name || "", address: biz.address || "", email: biz.email || "",
        phone: biz.phone || "", website: biz.website || "", logo: biz.logo || ""
      },
      to: { name: "", address: "", email: "", phone: "" },
      items: [{ date: todayISO(0), desc: "", qty: 1, price: 0 }],
      discountType: "none", discountValue: 0,
      taxLabel: biz.taxLabel || "Tax", taxRate: biz.taxRate || 0,
      shipping: 0, amountPaid: 0,
      payMethod: biz.payMethod || "", bankName: biz.bankName || "", account: biz.account || "",
      notes: "", thanks: "THANK YOU!",
      createdAt: Date.now(), updatedAt: Date.now()
    };
  }

  /* ---------------- Math ---------------- */
  function calc(inv) {
    var subtotal = inv.items.reduce(function (s, it) {
      return s + (Number(it.qty) || 0) * (Number(it.price) || 0);
    }, 0);
    var discount = 0;
    if (inv.discountType === "percent") discount = subtotal * (Number(inv.discountValue) || 0) / 100;
    else if (inv.discountType === "fixed") discount = Number(inv.discountValue) || 0;
    discount = Math.min(discount, subtotal);
    var taxable = subtotal - discount;
    var tax = taxable * (Number(inv.taxRate) || 0) / 100;
    var shipping = Number(inv.shipping) || 0;
    var total = taxable + tax + shipping;
    var paid = Number(inv.amountPaid) || 0;
    var balance = total - paid;
    return { subtotal: subtotal, discount: discount, tax: tax, shipping: shipping, total: total, paid: paid, balance: balance };
  }

  function effectiveStatus(inv) {
    if (inv.status === "paid") return "paid";
    if (inv.status === "sent" && inv.dueDate && inv.dueDate < todayISO(0)) return "overdue";
    return inv.status;
  }

  /* ============================================================
     VIEW: invoice list
     ============================================================ */
  function showList() {
    $("view-editor").classList.add("hidden");
    $("view-list").classList.remove("hidden");
    renderList();
  }

  function renderList() {
    var list = loadInvoices().slice().sort(function (a, b) { return b.updatedAt - a.updatedAt; });
    var q = $("list-search").value.trim().toLowerCase();
    var filter = $("list-filter").value;

    var shown = list.filter(function (inv) {
      var st = effectiveStatus(inv);
      if (filter !== "all" && st !== filter) return false;
      if (!q) return true;
      return (inv.number || "").toLowerCase().indexOf(q) >= 0 ||
             (inv.to.name || "").toLowerCase().indexOf(q) >= 0;
    });

    var tbody = $("invoice-rows");
    tbody.innerHTML = "";
    shown.forEach(function (inv) {
      var t = calc(inv);
      var st = effectiveStatus(inv);
      var tr = document.createElement("tr");
      tr.innerHTML =
        '<td class="inv-num">' + esc(inv.number) + "</td>" +
        "<td>" + (esc(inv.to.name) || "<em>—</em>") + "</td>" +
        "<td>" + fmtDate(inv.issueDate) + "</td>" +
        "<td>" + fmtDate(inv.dueDate) + "</td>" +
        '<td><span class="badge badge-' + st + '">' + st + "</span></td>" +
        '<td class="ta-r">' + fmtMoney(t.total, inv.currency) + "</td>" +
        '<td><div class="row-actions">' +
          '<button class="icon-btn" data-act="dup" title="Duplicate">⧉</button>' +
          '<button class="icon-btn danger" data-act="del" title="Delete">✕</button>' +
        "</div></td>";
      tr.addEventListener("click", function (e) {
        var act = e.target.getAttribute("data-act");
        if (act === "del") {
          e.stopPropagation();
          if (confirm("Delete invoice " + inv.number + "? This cannot be undone.")) {
            saveInvoices(loadInvoices().filter(function (x) { return x.id !== inv.id; }));
            renderList();
          }
          return;
        }
        if (act === "dup") {
          e.stopPropagation();
          var copy = JSON.parse(JSON.stringify(inv));
          copy.id = uid();
          copy.number = nextInvoiceNumber();
          copy.status = "draft";
          copy.issueDate = todayISO(0);
          copy.dueDate = todayISO(14);
          copy.createdAt = copy.updatedAt = Date.now();
          var all = loadInvoices(); all.push(copy); saveInvoices(all);
          openEditor(copy.id);
          return;
        }
        openEditor(inv.id);
      });
      tbody.appendChild(tr);
    });

    $("empty-state").classList.toggle("hidden", list.length > 0);
    $("invoice-table").style.display = shown.length ? "" : "none";

    renderStats(list);
  }

  function renderStats(list) {
    var byCur = {};
    var counts = { total: 0, outstanding: 0, paid: 0 };
    list.forEach(function (inv) {
      var t = calc(inv);
      var cur = inv.currency;
      byCur[cur] = byCur[cur] || { total: 0, outstanding: 0, paid: 0 };
      byCur[cur].total += t.total;
      if (effectiveStatus(inv) === "paid") byCur[cur].paid += t.total;
      else byCur[cur].outstanding += t.balance;
    });
    var curs = Object.keys(byCur);
    function sumStr(key) {
      if (!curs.length) return "—";
      return curs.map(function (c) { return fmtMoney(byCur[c][key], c); }).join(" + ");
    }
    $("stat-total").textContent = sumStr("total");
    $("stat-outstanding").textContent = sumStr("outstanding");
    $("stat-paid").textContent = sumStr("paid");
    $("stat-count").textContent = String(list.length);
  }

  /* ============================================================
     VIEW: editor
     ============================================================ */
  function openEditor(id) {
    if (id) {
      var found = loadInvoices().filter(function (x) { return x.id === id; })[0];
      current = found ? JSON.parse(JSON.stringify(found)) : blankInvoice();
    } else {
      current = blankInvoice();
    }
    dirty = false;
    $("view-list").classList.add("hidden");
    $("view-editor").classList.remove("hidden");
    fillForm();
    renderItems();
    renderPreview();
    setSaveHint("");
    window.scrollTo(0, 0);
  }

  function fillForm() {
    $("f-number").value = current.number;
    $("f-currency").value = current.currency;
    $("f-issue").value = current.issueDate;
    $("f-due").value = current.dueDate;
    $("inv-status").value = current.status;

    $("f-from-name").value = current.from.name;
    $("f-from-address").value = current.from.address;
    $("f-from-email").value = current.from.email;
    $("f-from-phone").value = current.from.phone;
    $("f-from-website").value = current.from.website;
    $("f-logo-clear").classList.toggle("hidden", !current.from.logo);

    $("f-to-name").value = current.to.name;
    $("f-to-address").value = current.to.address;
    $("f-to-email").value = current.to.email;
    $("f-to-phone").value = current.to.phone;

    $("f-discount-type").value = current.discountType;
    $("f-discount-value").value = current.discountValue;
    $("f-tax-label").value = current.taxLabel;
    $("f-tax-rate").value = current.taxRate;
    $("f-shipping").value = current.shipping;
    $("f-paid").value = current.amountPaid;

    $("f-pay-method").value = current.payMethod;
    $("f-bank-name").value = current.bankName;
    $("f-account").value = current.account;
    $("f-notes").value = current.notes;
    $("f-thanks").value = current.thanks;
  }

  function renderItems() {
    var wrap = $("items-list");
    wrap.innerHTML = "";
    current.items.forEach(function (item, idx) {
      var row = document.createElement("div");
      row.className = "item-row";
      row.innerHTML =
        '<input type="date" data-f="date" value="' + esc(item.date || "") + '" title="Item date" />' +
        '<input type="text" data-f="desc" value="' + esc(item.desc) + '" placeholder="Description of work…" />' +
        '<input type="number" data-f="price" value="' + Number(item.price) + '" min="0" step="0.01" placeholder="Price" title="Unit price" />' +
        '<input type="number" data-f="qty" value="' + Number(item.qty) + '" min="0" step="any" placeholder="Qty" title="Quantity" />' +
        '<button type="button" class="item-remove" title="Remove item">✕</button>';
      row.querySelectorAll("input").forEach(function (inp) {
        inp.addEventListener("input", function () {
          var f = inp.getAttribute("data-f");
          current.items[idx][f] = (f === "qty" || f === "price") ? Number(inp.value) : inp.value;
          markDirty();
          renderPreview();
        });
      });
      row.querySelector(".item-remove").addEventListener("click", function () {
        current.items.splice(idx, 1);
        if (!current.items.length) current.items.push({ date: todayISO(0), desc: "", qty: 1, price: 0 });
        markDirty();
        renderItems();
        renderPreview();
      });
      wrap.appendChild(row);
    });
  }

  function readForm() {
    current.number = $("f-number").value.trim();
    current.currency = $("f-currency").value;
    current.issueDate = $("f-issue").value;
    current.dueDate = $("f-due").value;
    current.status = $("inv-status").value;

    current.from.name = $("f-from-name").value;
    current.from.address = $("f-from-address").value;
    current.from.email = $("f-from-email").value;
    current.from.phone = $("f-from-phone").value;
    current.from.website = $("f-from-website").value;

    current.to.name = $("f-to-name").value;
    current.to.address = $("f-to-address").value;
    current.to.email = $("f-to-email").value;
    current.to.phone = $("f-to-phone").value;

    current.discountType = $("f-discount-type").value;
    current.discountValue = Number($("f-discount-value").value) || 0;
    current.taxLabel = $("f-tax-label").value || "Tax";
    current.taxRate = Number($("f-tax-rate").value) || 0;
    current.shipping = Number($("f-shipping").value) || 0;
    current.amountPaid = Number($("f-paid").value) || 0;

    current.payMethod = $("f-pay-method").value;
    current.bankName = $("f-bank-name").value;
    current.account = $("f-account").value;
    current.notes = $("f-notes").value;
    current.thanks = $("f-thanks").value;
  }

  /* ---------------- Preview ---------------- */
  function setText(id, text) { $(id).textContent = text; }

  function renderPreview() {
    var inv = current;
    var t = calc(inv);
    var cur = inv.currency;

    setText("pv-number", inv.number || "—");
    setText("pv-issue", fmtDate(inv.issueDate));
    $("pv-due-row").style.display = inv.dueDate ? "" : "none";
    setText("pv-due", fmtDate(inv.dueDate));

    var logo = $("pv-logo");
    if (inv.from.logo) { logo.src = inv.from.logo; logo.classList.remove("hidden"); }
    else { logo.classList.add("hidden"); }

    setText("pv-from-name", inv.from.name || "Your Business Name");
    setText("pv-from-address", inv.from.address);
    setText("pv-to-name", inv.to.name || "Client Name");
    setText("pv-to-address", inv.to.address);
    setText("pv-to-contact", [inv.to.email, inv.to.phone].filter(Boolean).join(" · "));

    // items
    var tbody = $("pv-items");
    tbody.innerHTML = "";
    inv.items.forEach(function (item) {
      if (!item.desc && !Number(item.price)) return;
      var tr = document.createElement("tr");
      var lineTotal = (Number(item.qty) || 0) * (Number(item.price) || 0);
      tr.innerHTML =
        "<td>" + fmtDate(item.date) + "</td>" +
        "<td>" + esc(item.desc) + "</td>" +
        '<td class="n">' + fmtMoney(Number(item.price) || 0, cur) + "</td>" +
        '<td class="n">' + (Number(item.qty) || 0) + "</td>" +
        '<td class="n">' + fmtMoney(lineTotal, cur) + "</td>";
      tbody.appendChild(tr);
    });
    if (!tbody.children.length) {
      var tr0 = document.createElement("tr");
      tr0.innerHTML = '<td></td><td style="color:#9a9a92">Your line items will appear here…</td><td class="n"></td><td class="n"></td><td class="n"></td>';
      tbody.appendChild(tr0);
    }

    // totals block
    var lines = $("pv-totals-lines");
    lines.innerHTML = "";
    function addLine(lbl, val) {
      var d = document.createElement("div");
      d.innerHTML = "<span>" + esc(lbl) + "</span><span>" + val + "</span>";
      lines.appendChild(d);
    }
    var showBreakdown = t.discount > 0 || t.tax > 0 || t.shipping > 0;
    if (showBreakdown) addLine("Subtotal", fmtMoney(t.subtotal, cur));
    if (t.discount > 0) {
      var dLbl = inv.discountType === "percent" ? "Discount (" + inv.discountValue + "%)" : "Discount";
      addLine(dLbl, "−" + fmtMoney(t.discount, cur));
    }
    if (t.tax > 0) addLine(inv.taxLabel + " (" + inv.taxRate + "%)", fmtMoney(t.tax, cur));
    if (t.shipping > 0) addLine("Shipping / other", fmtMoney(t.shipping, cur));
    setText("pv-grand", fmtMoney(t.total, cur));

    var balRow = $("pv-balance-row");
    if (t.paid > 0) {
      balRow.classList.remove("hidden");
      setText("pv-balance", fmtMoney(t.balance, cur));
    } else {
      balRow.classList.add("hidden");
    }

    // payment + contact
    setText("pv-pay-method", inv.payMethod);
    setText("pv-bank", inv.bankName ? "Bank Name : " + inv.bankName : "");
    setText("pv-account", inv.account ? "Account Number : " + inv.account : "");
    var payBlock = document.querySelector(".pv-payment");
    payBlock.querySelector(".pv-pay-title").style.display =
      (inv.payMethod || inv.bankName || inv.account) ? "" : "none";
    setText("pv-notes", inv.notes);
    setText("pv-from-phone", inv.from.phone);
    setText("pv-from-email", inv.from.email);
    setText("pv-from-website", inv.from.website);
    setText("pv-thanks", inv.thanks || "");
  }

  /* ---------------- Save ---------------- */
  function persistCurrent() {
    readForm();
    current.updatedAt = Date.now();
    var all = loadInvoices();
    var idx = all.findIndex(function (x) { return x.id === current.id; });
    if (idx >= 0) all[idx] = current; else all.push(current);
    saveInvoices(all);

    // remember business defaults for next time
    saveBusiness({
      name: current.from.name, address: current.from.address, email: current.from.email,
      phone: current.from.phone, website: current.from.website, logo: current.from.logo,
      currency: current.currency, taxLabel: current.taxLabel, taxRate: current.taxRate,
      payMethod: current.payMethod, bankName: current.bankName, account: current.account
    });

    dirty = false;
    setSaveHint("Saved ✓");
  }

  function setSaveHint(msg) {
    $("save-hint").textContent = msg;
    if (msg) setTimeout(function () { if (!dirty) $("save-hint").textContent = ""; }, 2500);
  }

  function markDirty() {
    dirty = true;
    $("save-hint").textContent = "Unsaved changes";
  }

  /* ---------------- Helpers ---------------- */
  function esc(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
  }

  /* ============================================================
     Wire-up
     ============================================================ */
  function populateCurrencySelect() {
    var sel = $("f-currency");
    var popGroup = document.createElement("optgroup");
    popGroup.label = "Popular";
    POPULAR.forEach(function (code) {
      var c = CURRENCIES.filter(function (x) { return x.code === code; })[0];
      if (!c) return;
      var o = document.createElement("option");
      o.value = c.code;
      o.textContent = c.code + " — " + c.name + (c.symbol && c.symbol !== c.code ? " (" + c.symbol + ")" : "");
      popGroup.appendChild(o);
    });
    var allGroup = document.createElement("optgroup");
    allGroup.label = "All currencies (A–Z)";
    CURRENCIES.forEach(function (c) {
      var o = document.createElement("option");
      o.value = c.code;
      o.textContent = c.code + " — " + c.name + (c.symbol && c.symbol !== c.code ? " (" + c.symbol + ")" : "");
      allGroup.appendChild(o);
    });
    sel.appendChild(popGroup);
    sel.appendChild(allGroup);
  }

  function init() {
    populateCurrencySelect();

    // nav
    $("nav-new").addEventListener("click", function () { openEditor(null); });
    $("empty-new").addEventListener("click", function () { openEditor(null); });
    $("nav-invoices").addEventListener("click", showList);
    $("brand-home").addEventListener("click", function (e) { e.preventDefault(); showList(); });
    $("btn-back").addEventListener("click", function () {
      if (dirty && !confirm("You have unsaved changes. Leave without saving?")) return;
      showList();
    });

    // list tools
    $("list-search").addEventListener("input", renderList);
    $("list-filter").addEventListener("change", renderList);

    // editor actions
    $("btn-save").addEventListener("click", persistCurrent);
    $("btn-pdf").addEventListener("click", function () {
      persistCurrent();
      document.title = (current.number || "invoice") + " — BillPilot";
      window.print();
      document.title = "BillPilot — Simple Invoice Maker for Freelancers";
    });
    $("btn-add-item").addEventListener("click", function () {
      current.items.push({ date: todayISO(0), desc: "", qty: 1, price: 0 });
      markDirty();
      renderItems();
      renderPreview();
    });

    // logo upload
    $("f-logo").addEventListener("change", function () {
      var file = this.files && this.files[0];
      if (!file) return;
      var reader = new FileReader();
      reader.onload = function () {
        current.from.logo = reader.result;
        $("f-logo-clear").classList.remove("hidden");
        markDirty();
        renderPreview();
      };
      reader.readAsDataURL(file);
    });
    $("f-logo-clear").addEventListener("click", function () {
      current.from.logo = "";
      $("f-logo").value = "";
      this.classList.add("hidden");
      markDirty();
      renderPreview();
    });

    // every other form field: live update
    $("invoice-form").addEventListener("input", function (e) {
      if (e.target.id === "f-logo") return;
      readForm();
      markDirty();
      renderPreview();
    });
    $("inv-status").addEventListener("change", function () {
      current.status = this.value;
      markDirty();
    });

    // warn before closing tab with unsaved edits
    window.addEventListener("beforeunload", function (e) {
      if (dirty) { e.preventDefault(); e.returnValue = ""; }
    });

    showList();
  }

  document.addEventListener("DOMContentLoaded", init);
})();
