import fs from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";
import { fileURLToPath } from "node:url";

// Emulate __dirname in ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Path to the database
const OUT_DB = path.resolve(__dirname, "../public/carparts.db");

// Ensure DB exists
if (!fs.existsSync(OUT_DB)) {
  console.error("❌ Database file not found:", OUT_DB);
  process.exit(1);
}

// Connect to the database
const db = new Database(OUT_DB);

try {
  // Wrap in a transaction for safety
  db.transaction(() => {
    db.exec("DELETE FROM car_part_models;");
    db.exec("DELETE FROM car_parts;");
    db.exec("DELETE FROM car_models;");
  })();

  console.log("✅ Database cleaned successfully.");
} catch (err) {
  console.error("❌ Failed to clean database:", err.message);
} finally {
  db.close();
}
