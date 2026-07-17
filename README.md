# BillPilot ✈️

**A simple, free invoice maker for freelancers.** Create a professional invoice in under a minute — every world currency, live preview, one-click PDF download. No account, no server: all your data stays in your browser.

## Features

- **Beautiful invoice template** — clean white & beige minimalist design (serif headings, elegant table, payment details, thank-you footer)
- **Every currency on Earth** — all ISO 4217 currencies with correct symbols and decimal rules (uses the browser's built-in `Intl` data)
- **Live preview** — the invoice updates as you type
- **Everything a freelancer needs** — line items, discounts (% or fixed), tax/VAT/GST, shipping, partial payments & balance due, payment method / bank details, notes, logo upload
- **Invoice management** — save, search, filter, duplicate, and delete invoices; Draft / Sent / Paid / Overdue statuses; dashboard totals
- **One-click PDF** — print-perfect A4 output via the browser's Save-as-PDF
- **Smart defaults** — remembers your business details, currency, and tax rate for the next invoice; auto-increments invoice numbers
- **100% private** — everything is stored in `localStorage`; nothing ever leaves your device

## Running it

It's a static site — no build step.

```
python -m http.server 8720
```

…or just open `index.html`.

## Stack

Plain HTML + CSS + vanilla JavaScript. No frameworks, no dependencies.
