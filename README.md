# Car Parts PWA

A Progressive Web App (PWA) for browsing, searching, and managing car models and their compatible parts entirely in the browser.
Built with React, Vite, and SQL.js, it uses IndexedDB for offline-first data persistence and a service worker to cache static assets. You can add or delete cars/parts while offline, and install it on your device like a native app.

---

## Table of Contents

1. [Features](#features)
2. [Tech Stack](#tech-stack)
3. [Project Structure](#project-structure)
4. [Getting Started](#getting-started)
   4.1. [Prerequisites](#prerequisites)
   4.2. [Installation](#installation)
   4.3. [Running in Development](#running-in-development)
   4.4. [Building for Production](#building-for-production)
5. [Offline & PWA Support](#offline--pwa-support)
   5.1. [Service Worker](#service-worker)
   5.2. [Web App Manifest](#web-app-manifest)
   5.3. [IndexedDB Database Persistence](#indexeddb-database-persistence)
   5.4. [Installation as PWA](#installation-as-pwa)
6. [Data Model & SQL.js](#data-model--sqljs)
   6.1. [SQLite Schema](#sqlite-schema)
   6.2. [Database Initialization & Sync](#database-initialization--sync)
7. [Usage](#usage)
   7.1. [Searching Cars & Parts](#searching-cars--parts)
   7.2. [Viewing Details](#viewing-details)
   7.3. [Adding a New Car or Part](#adding-a-new-car-or-part)
   7.4. [Deleting a Car or Part](#deleting-a-car-or-part)
8. [Deployment](#deployment)
   8.1. [Netlify](#netlify)
   8.2. [GitHub Pages (Optional)](#github-pages-optional)
9. [Contributing](#contributing)
10. [License](#license)

---

## Features

* **Search & Filter**

  * Search car models by name or car parts by part number.
  * Filter results between “Cars” and “Car Parts” using radio buttons.
* **Details View**

  * Tap on any search result to see a list of its compatible items (e.g., parts for a car, cars for a part).
  * Primary compatibility is flagged with `(Primary)`.
* **Add New Car / Part**

  * Switch between “Adding Car Model” and “Adding Car Part.”
  * Enter a name (and part number, if adding a part), search a list of existing items to link (parts → cars or cars → parts), and save.
  * Prevents duplicates by checking existing names/part numbers.
* **Delete Car / Part**

  * From the Details view, delete the selected car (or part).
  * Automatically removes all entries in the join table (`car_part_models`) that reference that record.
* **Offline-First Persistence**

  * On first load, fetches `carparts.db` from `/public/` and stores it into IndexedDB.
  * All subsequent reads/writes happen in memory and are persisted back to IndexedDB (via SQL.js’s `db.export()` + `idb-keyval`).
  * You can add, delete, and search even when completely offline.
* **PWA Installable**

  * Contains a `manifest.json` and a service worker that caches HTML, JS, CSS, icons, and the raw database file.
  * Launches in “standalone” mode without the browser UI.
  * Users see an “Install” prompt in Chrome/Edge or “Add to Home Screen” in Safari.

---

## Tech Stack

* **Framework & Build**

  * **React** (with Function Components and Hooks)
  * **Vite** (fast build tooling)
* **Database**

  * **SQL.js** (SQLite compiled to WebAssembly)
  * **IndexedDB** (via `idb-keyval`) for persisting the binary database
* **Styling**

  * Plain CSS (in `src/App.css`)
* **PWA**

  * **Service Worker** (in `public/service-worker.js`)
  * **Web App Manifest** (in `public/manifest.json`)
* **Deployment**

  * **Netlify** (HTTPS hosting + automatic builds)
  * (Optional) **GitHub Pages** via `gh-pages`

---

## Project Structure

```
car-pwa/                     # React/Vite project root
├── public/
│   ├── carparts.db          # Original SQLite file (used on first load)
│   ├── favicon.ico
│   ├── icons/
│   │   ├── icon-192.png
│   │   └── icon-512.png
│   ├── index.html
│   ├── manifest.json
│   └── service-worker.js
│
├── src/
│   ├── App.tsx              # Main React component with search / add / delete / details logic
│   ├── index.css            # Any global CSS
│   ├── main.tsx             # React entry point; registers service worker
│   ├── sqljs.d.ts           # Ambient declaration: `declare module "sql.js";`
│   └── ...                  # Other supporting files (e.g. icons, utilities)
│
├── tsconfig.json            # Root references (points to tsconfig.app.json)
├── tsconfig.app.json        # Actual TS settings, includes `src/**/*.ts` and `src/**/*.d.ts`
├── tsconfig.node.json       # Node/Electron settings (unused here)
├── package.json             # NPM scripts + dependencies
├── vite.config.ts           # Vite configuration
└── README.md                # ← This file
```

---

## Getting Started

### Prerequisites

* **Node.js** (v14+ recommended)
* **npm** (v6+)
* (Optional) A GitHub repository if you plan to deploy via GitHub Pages

### Installation

1. Clone this repository (or download it) into your local machine:

   ```bash
   git clone https://github.com/<your-username>/car-pwa.git
   cd car-pwa
   ```
2. Install dependencies:

   ```bash
   npm install
   ```

   or, if you use Yarn:

   ```bash
   yarn
   ```

### Running in Development

Start the Vite dev server (with hot-module reloading):

```bash
npm run dev
```

* The app will open at `http://localhost:5173/` (by default).
* Browse to that URL to see the PWA shell.
* The console will show “Service worker registered” once the SW is active.
* Try searching, adding, deleting—once IndexedDB is populated, you can reload and stay offline.

### Building for Production

Generate a production build optimized for deployment:

```bash
npm run build
```

* This outputs a `dist/` folder containing minified JS/CSS, `index.html`, `manifest.json`, `service-worker.js`, and icons.
* `dist/` is the folder you’ll serve on Netlify, GitHub Pages, or any static host.

---

## Offline & PWA Support

### Service Worker

* **File:** `public/service-worker.js`
* **Role:**

  1. **Install phase**: caches all static assets listed in `ASSETS_TO_CACHE` (including `/carparts.db`) under a named cache (e.g. `carparts-pwa-v1`).
  2. **Activate phase**: cleans up old caches.
  3. **Fetch handler**: serves from cache first; if not cached, fetches from network and then caches the response for future visits.

Because of this, your app shell and the raw database file are available offline after the first successful load.

### Web App Manifest

* **File:** `public/manifest.json`
* **Key fields:**

  ```jsonc
  {
    "name": "Car Parts PWA",
    "short_name": "CarParts",
    "start_url": "/",
    "display": "standalone",
    "theme_color": "#1976d2",
    "background_color": "#ffffff",
    "icons": [
      { "src": "/icons/icon-192.png", "sizes": "192x192", "type": "image/png" },
      { "src": "/icons/icon-512.png", "sizes": "512x512", "type": "image/png" }
    ]
  }
  ```
* Linked from `index.html` via:

  ```html
  <link rel="manifest" href="/manifest.json" />
  <meta name="theme-color" content="#1976d2" />
  <link rel="apple-touch-icon" href="/icons/icon-192.png" />
  ```

Browsers that support PWAs will read this and offer “Install” prompts once the service worker is active and the site is served over HTTPS.

### IndexedDB Database Persistence

* **Initial load** (when IndexedDB is empty):

  1. In `App.tsx`, the first `useEffect` does `const savedBytes = await get(DB_STORAGE_KEY)`.
  2. If no saved bytes, it fetches `/carparts.db` from the network (or SW cache if the SW is already installed).
  3. Creates an in-memory SQL.js database with `new SQL.Database(new Uint8Array(buffer))`.
  4. Immediately writes those bytes into IndexedDB using `await set(DB_STORAGE_KEY, database.export())`.
* **Subsequent loads** (online or offline):

  1. The code sees `savedBytes` in IndexedDB → rehydrates with `new SQL.Database(new Uint8Array(savedBytes))`.
  2. No network fetch is needed to load data.
* **All data operations** (search, add, delete) happen in‐memory with SQL.js, then upon each save/delete, the code does:

  ```ts
  const updatedBytes = db.export();
  await set(DB_STORAGE_KEY, updatedBytes);
  ```

  to persist any changes back into IndexedDB. That ensures your entire SQLite file is always up-to-date in the browser.

### Installation as PWA

1. **First visit (HTTPS)**

   * The service worker installs and caches everything.
   * The browser sees a valid `manifest.json` and service worker, so it shows an “Install” or “Add to Home Screen” prompt.
2. **Installing**

   * On Android Chrome: look for the blue install icon in the Omnibox or the “Add to Home Screen” banner.
   * On iOS Safari: tap the “Share” button → “Add to Home Screen.”
3. **Standalone Mode**

   * Once installed, your Car Parts PWA launches without the browser UI, using your theme color for the status bar/splash screen.
   * All functionality (search, add, delete) works offline thanks to IndexedDB + SW caching.

---

## Data Model & SQL.js

### SQLite Schema

The SQLite schema (stored in `public/carparts.db` or applied via `scripts/gen-db.js` if you regenerate locally) defines three tables:

```sql
CREATE TABLE IF NOT EXISTS car_models (
  id INTEGER PRIMARY KEY,
  name TEXT UNIQUE
);

CREATE TABLE IF NOT EXISTS car_parts (
  id INTEGER PRIMARY KEY,
  part_number TEXT UNIQUE,
  name TEXT
);

CREATE TABLE IF NOT EXISTS car_part_models (
  car_id    INTEGER,
  part_id   INTEGER,
  is_primary INTEGER DEFAULT 0,
  PRIMARY KEY (car_id, part_id),
  FOREIGN KEY (car_id) REFERENCES car_models(id) ON DELETE CASCADE,
  FOREIGN KEY (part_id) REFERENCES car_parts(id) ON DELETE CASCADE
);
```

* **car\_models**: each row is a unique car model (`id`, `name`).
* **car\_parts**: each row is a unique part (`id`, `part_number`, `name`).
* **car\_part\_models**: join table linking cars ↔ parts, with an optional `is_primary` flag.

### Database Initialization & Sync

* **Local dev/regeneration** (optional)

  * You can re-generate `carparts.db` by running `node scripts/gen-db.js` (assuming you have `excel-files/` and `schema.sql`). That process reads `.xlsx` files and populates the SQLite file.
* **In‐App Logic**

  * On first load, your React code attempts to rehydrate from `idb-keyval`. If no database is in IndexedDB, it fetches `/carparts.db` and writes it to IDB.
  * All subsequent queries (`db.exec("SELECT …")`) and updates (`db.exec("INSERT …")` / `DELETE …`) operate on the in-memory SQL.js instance.
  * After any write (add/delete), code does `await set(DB_STORAGE_KEY, db.export())` to persist the updated binary to IndexedDB.

---

## Usage

### Searching Cars & Parts

1. In the **Search view** (default), enter text into the top search box:

   * If **Cars** is selected, it searches `car_models.name LIKE '%query%'`.
   * If **Car Parts** is selected, it searches `car_parts.part_number LIKE '%query%'`.
2. Click **Search** (or press Enter).
3. Matching rows appear below.

   * **Cars**: each result shows `car_models.id, car_models.name`.
   * **Car Parts**: each result shows `car_parts.name (part_number)`.

### Viewing Details

1. Click on any search result row.

2. If viewing a **Car**, you see:

   * A **Delete** button (red) and a **Back** button (gray) at top.
   * The car’s name as a title.
   * A list of all compatible parts:

     ```
     <part_name> (part_number) (Primary)
     ```

     The `(Primary)` label shows if `is_primary = 1`.

3. If viewing a **Part**, you see:

   * **Delete** and **Back** buttons.
   * The part’s title appears as `name (part_number)`.
   * A list of all cars that use that part:

     ```
     <car_name> (Primary)
     ```

     `(Primary)` if `is_primary = 1`.

### Adding a New Car or Part

1. From the **Search view**, click **+ Add New**.

2. The view switches to **Adding**:

   * Two radio buttons: **Adding Car Model** (default) or **Adding Car Part**.
   * A text field for **Name** (always).
   * If **Adding Car Part** is selected, a second field appears for **Part Number**.
   * A **Search** box below labeled “Search parts to link” (if adding a car) or “Search cars to link” (if adding a part).
   * A checkbox “Show list” toggles the display of a scrollable list of all existing items of the opposite type.
   * Each item in that list is a label with a checkbox:

     ```
     [ ] <name> (identifier)
     ```

     * If adding a car, the identifier is the part number; if adding a part, the identifier is empty (but you could tweak it to show part number vs name).
   * Click any combination of checkboxes to link multiple parts → car (or cars → part).
   * Click **Save**:

     * Validates for duplicates: car names must be unique in `car_models`, part numbers must be unique in `car_parts`.
     * Inserts a new row into `car_models` or `car_parts`.
     * Inserts join‐table rows into `car_part_models (car_id, part_id, is_primary=0)` for each selected item.
     * Persists the entire DB to IndexedDB.
     * Returns to Search view.

3. If there’s a duplicate, a warning below the form appears (e.g. “A car with this name already exists.” or “A part with this part number already exists.”). You must correct it before saving.

### Deleting a Car or Part

1. In **Details view**, click the red **❌ Delete** button.
2. A browser confirmation appears:

   ```
   Delete the car "Camry" and all its links?
   ```

   or

   ```
   Delete the part "Brake Pad (BP-123)" and all its links?
   ```
3. If you confirm:

   * All rows in `car_part_models` referencing that `car_id` (or `part_id`) are deleted.
   * The row in `car_models` (or `car_parts`) is deleted.
   * The updated database is serialized and saved to IndexedDB.
   * The view returns to **Search**, and the deleted item no longer appears.

---

## Deployment

### Netlify

Because Netlify serves over HTTPS by default and supports static sites with custom build settings, it’s an easy choice:

1. **Link your Git repo** in the Netlify dashboard (New site from Git → GitHub).
2. **Set Build & Deploy settings**:

   * **Base directory**: (If your `package.json` is at the root) leave blank or `.`.
   * **Build command**:

     ```bash
     npm run build
     ```
   * **Publish directory**:

     ```
     dist
     ```
3. **Add a `_redirects` file** (if you need client-side routing) in `/public/_redirects`:

   ```
   /*    /index.html   200
   ```
4. **Deploy**. After a few moments, Netlify will run `npm install` → `npm run build` → publish `dist/`.
5. **Verify**:

   * Visit your Netlify URL (e.g. `https://car-parts-pwa.netlify.app/`).
   * Open DevTools → Application: Service Workers (should see `/service-worker.js`), Manifest (should see app name/icons).
   * You should see an “Install” prompt once the SW is active.

### GitHub Pages (Optional)

If you prefer GitHub Pages, use the `gh-pages` package:

1. Install as a dev dependency (if you have Internet):

   ```bash
   npm install --save-dev gh-pages
   ```
2. Add these fields to your `package.json`:

   ```jsonc
   {
     "homepage": "https://<your-username>.github.io/<repo-name>",
     "scripts": {
       "build": "vite build",
       "predeploy": "npm run build",
       "deploy": "gh-pages -d dist"
     }
   }
   ```
3. Run:

   ```bash
   npm run deploy
   ```

   This will build your app and publish `dist/` to the `gh-pages` branch.
4. Go to your GitHub repo → Settings → Pages → Source: select `gh-pages` branch → Save.
5. Your site becomes available at `https://<your-username>.github.io/<repo-name>/`.
6. Verify PWA features (Manifest, Service Worker, offline) same as above.

---

## Contributing

1. **Fork** this repository.
2. **Create a new branch** (`git checkout -b feature/YourFeature`).
3. **Install dependencies** (`npm install`).
4. **Run in dev mode** (`npm run dev`), implement your changes.
5. **Test thoroughly** (especially offline flows).
6. **Commit** and push to your fork (`git push origin feature/YourFeature`).
7. **Open a Pull Request**—describe your changes and why they’re needed.

Please make sure any new code is properly typed (TypeScript) and includes any necessary updates to `sqljs.d.ts` if you introduce new libraries without type declarations.

---

## License

This project is open-source under the MIT License. See [LICENSE](LICENSE) for details.
