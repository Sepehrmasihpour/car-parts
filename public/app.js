import initSqlJs from "sql.js";
// For browser IDB persistence
import { get, set, del } from "idb-keyval";
// For Node.js file persistence
import path from "path";
import fs from "fs/promises";

// File path for Node.js DB snapshot
const NODE_DB_PATH = path.resolve(process.cwd(), "offline.db");

export async function loadDatabase() {
  // 1. Bootstrap sql.js with locateFile for WASM
  const SQL = await initSqlJs({
    locateFile: (file) => {
      if (typeof window === "undefined") {
        // Node: load WASM from node_modules
        return path.resolve(
          process.cwd(),
          "node_modules",
          "sql.js",
          "dist",
          file
        );
      }
      // Browser: load WASM from public/sql-wasm
      return `/sql-wasm/${file}`;
    },
  });

  // 2. Restore snapshot
  let db;
  if (typeof window === "undefined") {
    // Node.js: read from local file
    try {
      const data = await fs.readFile(NODE_DB_PATH);
      db = new SQL.Database(new Uint8Array(data));
    } catch {
      // File missing -> new DB
      db = new SQL.Database();
    }
  } else {
    // Browser: use IndexedDB
    const saved = await get("offline-db");
    if (saved) {
      db = new SQL.Database(new Uint8Array(saved));
    } else {
      db = new SQL.Database();
    }
  }

  // 3. Ensure schema
  const [[{ values }]] = [
    db.exec(
      "SELECT name FROM sqlite_master WHERE type='table' AND name='car_model';"
    ) || [{ values: [] }],
  ];
  const hasCarModel = values.length > 0;
  if (!hasCarModel) {
    db.run(`
      CREATE TABLE car_model (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL
      );
      CREATE TABLE car_part (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        part_number TEXT UNIQUE NOT NULL,
        name TEXT NOT NULL,
        designed_for_model_id INTEGER NOT NULL,
        FOREIGN KEY(designed_for_model_id) REFERENCES car_model(id) ON DELETE RESTRICT
      );
      CREATE TABLE car_model_part (
        car_model_id INTEGER NOT NULL,
        car_part_id INTEGER NOT NULL,
        PRIMARY KEY(car_model_id, car_part_id),
        FOREIGN KEY(car_model_id) REFERENCES car_model(id) ON DELETE CASCADE,
        FOREIGN KEY(car_part_id) REFERENCES car_part(id) ON DELETE CASCADE
      );
    `);
  }

  return db;
}

export async function saveDatabase(db) {
  const data = db.export();
  if (typeof window === "undefined") {
    // Node.js: write to local file
    await fs.writeFile(NODE_DB_PATH, Buffer.from(data));
  } else {
    // Browser: store in IndexedDB
    await set("offline-db", data.buffer);
    if (navigator.serviceWorker && navigator.serviceWorker.controller) {
      navigator.serviceWorker.controller.postMessage({
        type: "SAVE_DB",
        payload: data.buffer,
      });
    }
  }
}

export async function clearDatabase(db) {
  // Drop user tables
  const res = db.exec(
    "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%';"
  );
  if (res.length > 0) {
    res[0].values.forEach(([name]) => {
      db.run(`DROP TABLE IF EXISTS "${name}";`);
    });
  }
  // Remove persisted snapshot
  if (typeof window === "undefined") {
    await fs.unlink(NODE_DB_PATH).catch(() => {});
  } else {
    await del("offline-db");
  }
}

// Bootstrap initial snapshot
(async () => {
  const db = await loadDatabase();
  await saveDatabase(db);
})();
