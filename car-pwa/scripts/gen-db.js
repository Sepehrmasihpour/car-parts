// scripts/gen-db.js

import fs from "fs";
import path from "path";
import xlsx from "xlsx";
import Database from "better-sqlite3";
import { fileURLToPath } from "node:url";

// Emulate __dirname in ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const XLS_DIR = path.resolve(__dirname, "../excel-files");
const OUT_DB = path.resolve(__dirname, "../public/carparts.db");
const SCHEMA = fs.readFileSync(
  path.resolve(__dirname, "../src/schema.sql"),
  "utf8"
);

const db = new Database(OUT_DB);
db.exec(SCHEMA);

const files = fs.readdirSync(XLS_DIR).filter((f) => f.endsWith(".xlsx"));

for (const file of files) {
  const wb = xlsx.readFile(path.join(XLS_DIR, file));
  const sheet = wb.Sheets[wb.SheetNames[0]];

  // header: [id, pn, name, designed_for, compatible_list]
  const rows = xlsx.utils.sheet_to_json(sheet, {
    header: 1,
    defval: "",
  });

  for (const [id, pn, designedFor, partName, compatibleStr] of rows.slice(1)) {
    const partId = Number(id);

    // insert part
    db.prepare(
      `INSERT OR IGNORE INTO car_parts (id, part_number, name) VALUES (?, ?, ?)`
    ).run(partId, pn, partName);

    // ensure designedFor car exists
    const carStmt = db.prepare(
      `INSERT OR IGNORE INTO car_models (name) VALUES (?)`
    );
    carStmt.run(designedFor);

    // lookup designedFor car_id
    const carId = db
      .prepare(`SELECT id FROM car_models WHERE name = ?`)
      .get(designedFor).id;

    // link designedFor
    db.prepare(
      `INSERT OR REPLACE INTO car_part_models (car_id, part_id, is_primary) VALUES (?, ?, 1)`
    ).run(carId, partId);

    // other compatible cars
    const models = compatibleStr
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);

    for (const model of models) {
      carStmt.run(model);
      const cid = db
        .prepare(`SELECT id FROM car_models WHERE name = ?`)
        .get(model).id;

      db.prepare(
        `INSERT OR IGNORE INTO car_part_models (car_id, part_id, is_primary) VALUES (?, ?, 0)`
      ).run(cid, partId);
    }
  }
}

db.close();
console.log("✅ Generated DB with", fs.statSync(OUT_DB).size, "bytes");
