#!/usr/bin/env node

/**
 * Script: importData.js
 * Reads all .xlsx files in public/data, parses rows, and uses your CRUD helpers
 * to populate the SQL.js database with car models, parts, and links.
 *
 * Usage:
 *   npm install xlsx
 *   node scripts/importData.js
 */

import fs from "fs";
import path from "path";
import xlsx from "xlsx";
import {
  createCarModel,
  getCarModelsByName,
  createCarPart,
  createCarModelPart,
} from "../db.js";

async function ensureModel(name) {
  // Try exact match
  const matches = await getCarModelsByName(name);
  const exact = matches.find((m) => m.name === name);
  if (exact) return exact.id;
  // Otherwise create
  return await createCarModel(name);
}

async function processFile(filePath) {
  const wb = xlsx.readFile(filePath);
  const sheet = wb.Sheets[wb.SheetNames[0]];
  // Parse with headers: A=id, B=part_number, C=plog, D=name, E=others
  const rows = xlsx.utils.sheet_to_json(sheet, {
    header: ["id", "part_number", "plog", "name", "others"],
    range: 1, // skip header row
    defval: "",
  });

  for (const { part_number, plog, name, others } of rows) {
    // Ensure the designated model exists
    const modelId = await ensureModel(plog);
    // Create part under that model
    const partId = await createCarPart(part_number, name, modelId);

    // Process other compatible models (comma-separated or space-separated)
    if (others) {
      // split by comma, semicolon, or slash
      const separators = /[,;/]/;
      const altModels = others
        .split(separators)
        .map((s) => s.trim())
        .filter(Boolean);
      for (const alt of altModels) {
        const altId = await ensureModel(alt);
        await createCarModelPart(altId, partId);
      }
    }
  }
}

(async () => {
  const dataDir = path.resolve(process.cwd(), "public/data");
  const files = fs.readdirSync(dataDir).filter((f) => f.endsWith(".xlsx"));
  console.log(`Found ${files.length} files to process.`);

  for (const file of files) {
    console.log(`Importing ${file}...`);
    await processFile(path.join(dataDir, file));
  }

  console.log("Import complete.");
})();
