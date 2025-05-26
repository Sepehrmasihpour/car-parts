import initSqlJs from "./sql-wasm/sql-wasm.js";
import { get, set } from "idb-keyval";

async function loadDatabase() {
  const SQL = await initSqlJs({ locateFile: (file) => `/sql-wasm/${file}` });
  // Try to load persisted DB from IndexedDB
  const saved = await get("offline-db");
  let db;
  if (saved) {
    const u8 = new Uint8Array(saved);
    db = new SQL.Database(u8);
  } else {
    db = new SQL.Database();
    // initialize schema if first run
    db.run("CREATE TABLE items (id INTEGER PRIMARY KEY, name TEXT);");
  }
  return db;
}

async function saveDatabase(db) {
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

(async () => {
  const db = await loadDatabase();

  // Example query
  db.run("INSERT INTO items (name) VALUES (?)", ["Hello"]);
  const res = db.exec("SELECT * FROM items");
  console.log(res);

  // Persist after every transaction (or batch)
  await saveDatabase(db);
})();
