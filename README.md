# Triple-E Invoices (PWA)

Cash sales invoice / receipt maker for Triple-E Food Planet. It builds the invoice on screen and creates a PDF
that matches your printed design, ready to send to the customer.

## Put it online (free, about 2 minutes)

A PWA must be served over https to be installable. The simplest way:

1. Unzip this folder on a computer.
2. Open https://app.netlify.com/drop and drag the whole `invoice-pwa` folder onto the page.
3. Netlify gives you a link. Open it on the phone.

(GitHub Pages, Cloudflare Pages or Vercel also work. Upload the folder as it is; there is no build step.)

## Install on the phone

- Android (Chrome): menu (three dots) > Install app / Add to Home screen.
- iPhone (Safari): Share button > Add to Home Screen.

After the first open it works without internet.

## Using it

1. Fill in the customer and the goods. Amounts, VAT and the amount in words are worked out for you.
2. Tap **Share PDF** to send it straight to WhatsApp or any app, or **Download PDF**.
3. Every invoice you download or share is saved under **Saved**, where you can reopen, resend or delete it.
4. In **Settings**: set the next invoice number, default VAT %, shop address and phone numbers, and the authorized signature.
   Use **Save backup file** now and then. Invoices live on the phone's browser storage.

## Files

- `index.html`, `app.css`, `app.js`: the app
- `invoice.css`, `invoice.js`: the invoice layout (853 x 1280 design, same proportions as your original)
- `assets/logo.png`: logo cut out of your design. Replace it with your original high-resolution logo for a sharper PDF
  (keep the file name; a square PNG with transparent background works best).
- `sw.js`, `manifest.webmanifest`, `icons/`: offline support and install details
- `vendor/`, `fonts/`: PDF libraries and fonts, bundled so nothing is loaded from the internet
