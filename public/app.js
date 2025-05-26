import initSqlJs from "./sql-wasm/sql-wasm.js";
import { get, set, del } from "idb-keyval";

export async function loadDatabase() {
  // 1. Bootstrap sql.js (pointing to your .wasm)
  const SQL = await initSqlJs({
    locateFile: (file) => `/sql-wasm/${file}`,
  });

  // 2. Try to restore a previous snapshot
  const saved = await get("offline-db");
  let db;
  if (saved) {
    const u8 = new Uint8Array(saved);
    db = new SQL.Database(u8);
  } else {
    db = new SQL.Database();
  }

  // 3. Check if our schema is already in place
  const schemaCheck = db.exec(
    "SELECT name FROM sqlite_master WHERE type='table' AND name='car_model';"
  );
  const hasCarModel =
    schemaCheck.length > 0 && schemaCheck[0].values.length > 0;

  // 4. If not, create all three tables
  if (!hasCarModel) {
    db.run(`
      -- 1. Car Models
      CREATE TABLE car_model (
        id   INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT    NOT NULL
      );

      -- 2. Car Parts (each has one “home” model)
      CREATE TABLE car_part (
        id                    INTEGER PRIMARY KEY AUTOINCREMENT,
        part_number           TEXT    UNIQUE NOT NULL,
        name                  TEXT    NOT NULL,
        designed_for_model_id INTEGER NOT NULL,
        FOREIGN KEY (designed_for_model_id)
          REFERENCES car_model(id)
          ON DELETE RESTRICT
      );

      -- 3. Usage link table (many-to-many)
      CREATE TABLE car_model_part (
        car_model_id INTEGER NOT NULL,
        car_part_id  INTEGER NOT NULL,
        PRIMARY KEY (car_model_id, car_part_id),
        FOREIGN KEY (car_model_id)
          REFERENCES car_model(id)
          ON DELETE CASCADE,
        FOREIGN KEY (car_part_id)
          REFERENCES car_part(id)
          ON DELETE CASCADE
      );
    `);
  }

  return db;
}

export async function saveDatabase(db) {
  const data = db.export();
  // store raw ArrayBuffer
  await set("offline-db", data.buffer);
  // optionally notify SW for more advanced sync
  if (navigator.serviceWorker.controller) {
    navigator.serviceWorker.controller.postMessage({
      type: "SAVE_DB",
      payload: data.buffer,
    });
  }
}

export async function clearDatabase(db) {
  // 1. Find all user tables (ignore sqlite_ internal tables)
  const res = db.exec(
    "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%';"
  );

  if (res.length > 0 && res[0].values.length > 0) {
    // Extract table names
    const tableNames = res[0].values.map((row) => row[0]);
    // Drop each one
    tableNames.forEach((name) => {
      db.run(`DROP TABLE IF EXISTS "${name}";`);
    });
  }

  // 2. Remove the saved database from IndexedDB
  //    so loadDatabase() will create a fresh DB
  await del("offline-db");
}

(async () => {
  const db = await loadDatabase();

  // Persist after every transaction (or batch)
  await saveDatabase(db);
})();
