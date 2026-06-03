# Yardi Voyager 7S — Frontend Clone

A **frontend-only** reproduction of the Yardi Voyager 7S experience (no backend, no Yardi
code — purely a visual/behavioural clone built from the supplied DOM + screenshots).

## Stack
- **HTML / CSS** — classic YSI / *GreyGreenRust* theme recreated in `css/voyager.css`
- **JavaScript + jQuery 3.5.1** — `js/voyager.js` implements every inline handler the
  ASP.NET DOM calls (`__doPostBack`, `SetClear`, `SelectAll`, `showgrid`, `show_calendar`, …)
- **Bootstrap 5.3.3** — used for the YardiOne identity pages (login + dashboard), matching the
  real DOM
- **jQuery UI 1.13.2** — datepickers / autocomplete used by the Bank Reconcile screens
- **Font Awesome 6 (Free)** — icons
- **Node** — a tiny zero-dependency static server (`server.js`)

All libraries are vendored under `vendor/` so the app runs fully offline.

## Run
```bash
npm start          # -> http://localhost:8080/
# or:  node server.js   (PORT env var optional, default 8080)
```
Open **http://localhost:8080/**

## Flow (mirrors real Yardi)
1. **YardiOne sign-in** — `/identityserver/login.html` (PARAMARK) → *Sign in with Passkey* or *Login*
2. **YardiOne dashboard** — `/dashboard.html` (app tiles) → click **Voyager 7S - Live**
3. **Voyager login** — `/65431weis/pages/loginoidc.html` (Live / Test → **PROCEED**)
4. **Voyager shell** — `/65431weis/pages/menu.html` : blue banner + left side-menu + content frame
   (defaults to the **quick-menu** application tiles)
5. **Side menu:** `G/L ▸ Banking ▸ Bank Functions ▸ Bank Reconcile` → **Bank Rec Filter** → **Submit** → **Bank Reconcile**

## Page map
| File | Recreates |
|------|-----------|
| `identityserver/login.html` | YardiOne / PARAMARK login |
| `dashboard.html` | YardiOne app dashboard |
| `65431weis/pages/loginoidc.html` | Voyager Live/Test login (`loginoidc.aspx`) |
| `65431weis/pages/menu.html` | Voyager shell — banner, side menu, flyouts, content iframe (`menu.aspx`) |
| `65431weis/pages/iData_quickMenu.html` | "Select your Yardi Voyager application" tiles |
| `65431weis/pages/BankRecFilter.html` | Bank Reconciliation filter (`BankRecFilter.aspx`) |
| `65431weis/pages/BankReconcile.html` | Bank Reconcile screen (`BankReconcile.aspx`) |
| `65431weis/pages/placeholder.html` | Stub shown for not-implemented side-menu items |

## Bank Reconcile (fully interactive)
The screen uses the **exact** YSI DOM ids/classes/names from the document. The data grids hold
the real rows (26 deposits, 42 checks, 2 book-reconciling items). Ticking **Clear?**:
- auto-fills the *Clear Date* with the closing day,
- updates the **Item Totals** box,
- moves the amount out of *Deposits in Transit* / *Outstanding Checks*,
- recomputes **Reconciled Statement Balance**, **Reconciled G/L Balance** and the **Difference**.

Initial figures reproduce the document exactly: GL 40,137.98 · Book −2,531.25 · Reconciled G/L
37,606.73 · Bank Stmt 11,950.43 · DIT 60,486.75 · Outstanding 57,098.88 · Reconciled Stmt 15,338.30 ·
Difference −22,268.43. `Item ▸` dropdown switches grids; `Search` toggles Number/Date; `Select All`,
`Unselect All`, `Print`, `Save`, `Post` all work.

## Notes / deviations (frontend-only demo)
- Product wordmark tiles, the Voyager logo, app icons and the calendar icon are generated raster
  assets (so the original `<img src>` paths resolve). The PARAMARK logo is a generated PNG rather
  than the document's inline base64.
- External Yardi/app URLs were re-pointed to local pages (Voyager tiles) or show a demo notice
  (other YardiOne apps).
- ASP.NET server plumbing (`__VIEWSTATE`/postbacks) is reduced to client-side behaviour.
