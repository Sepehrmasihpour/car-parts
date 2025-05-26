import { loadDatabase, saveDatabase } from "../public/app.js";

/**
 * Create a new car model.
 * @param {string} name
 * @returns {Promise<number>} inserted model ID
 */
export async function createCarModel(name) {
  const db = await loadDatabase();
  db.run("INSERT INTO car_model (name) VALUES (?);", [name]);
  await saveDatabase(db);
  const [{ values }] = db.exec("SELECT last_insert_rowid() AS id;");
  return values[0][0];
}

/**
 * Delete a car model by ID.
 * @param {number} id
 */
export async function deleteCarModel(id) {
  const db = await loadDatabase();
  db.run("DELETE FROM car_model WHERE id = ?;", [id]);
  await saveDatabase(db);
}

/**
 * Create a new car part for a specific model.
 * @param {string} name
 * @param {number} designedForModelId
 * @returns {Promise<number>} inserted part ID
 */
export async function createCarPart(partNumber, name, designedForModelId) {
  const db = await loadDatabase();

  // Insert into part_number (unique), name, and FK column:
  db.run(
    `INSERT INTO car_part (part_number, name, designed_for_model_id)
       VALUES (?, ?, ?);`,
    [partNumber, name, designedForModelId]
  );

  // Persist the change
  await saveDatabase(db);

  // Grab and return the auto-assigned id
  const [{ values }] = db.exec(`SELECT last_insert_rowid() AS id;`);
  return values[0][0];
}

/**
 * Link a part to a model (many-to-many).
 * @param {number} carModelId
 * @param {number} carPartId
 */
export async function createCarModelPart(carModelId, carPartId) {
  const db = await loadDatabase();
  db.run(
    "INSERT INTO car_model_part (car_model_id, car_part_id) VALUES (?, ?);",
    [carModelId, carPartId]
  );
  await saveDatabase(db);
}

/**
 * Delete a part-to-model link.
 * @param {number} carModelId
 * @param {number} carPartId
 */
export async function deleteCarModelPart(carModelId, carPartId) {
  const db = await loadDatabase();
  db.run(
    "DELETE FROM car_model_part WHERE car_model_id = ? AND car_part_id = ?;",
    [carModelId, carPartId]
  );
  await saveDatabase(db);
}

/**
 * Get a car model by ID.
 * @param {number} id
 * @returns {Promise<{id: number, name: string} | null>}
 */
export async function getCarModelById(id) {
  const db = await loadDatabase();
  const [res] = db.exec("SELECT id, name FROM car_model WHERE id = ?;", [id]);
  if (!res) return null;
  const [row] = res.values;
  return { id: row[0], name: row[1] };
}

/**
 * Get all car parts for a given model ID (including original and linked).
 * @param {number} modelId
 * @returns {Promise<Array<{id: number, name: string, designed_for_model_id: number}>>}
 */
export async function getCarPartsByModelId(modelId) {
  const db = await loadDatabase();
  const [res] = db.exec(
    `
    SELECT p.id, p.name, p.designed_for_model_id
      FROM car_part p
      LEFT JOIN car_model_part m
        ON p.id = m.car_part_id
     WHERE m.car_model_id = ?
    UNION
    SELECT id, name, designed_for_model_id 
      FROM car_part
     WHERE designed_for_model_id = ?;
    `,
    [modelId, modelId]
  );
  if (!res) return [];
  return res.values.map(([id, name, designedFor]) => ({
    id,
    name,
    designed_for_model_id: designedFor,
  }));
}

/**
 * Get car models by name (partial or exact match).
 * @param {string} name
 * @returns {Promise<Array<{id: number, name: string}>>}
 */
export async function getCarModelsByName(name) {
  const db = await loadDatabase();
  const [res] = db.exec("SELECT id, name FROM car_model WHERE name LIKE ?;", [
    `%${name}%`,
  ]);
  if (!res) return [];
  return res.values.map(([id, nm]) => ({ id, name: nm }));
}

/**
 * Mass-create models, parts, and links in one transaction.
 * @param {Array<string>} modelNames
 * @param {Array<{name: string, designed_for_model_id: number}>} parts
 * @param {Array<{car_model_id: number, car_part_id: number}>} links
 */
export async function massCreate(modelNames, parts, links) {
  const db = await loadDatabase();
  db.run("BEGIN TRANSACTION;");
  // Create models
  modelNames.forEach((name) => {
    db.run("INSERT INTO car_model (name) VALUES (?);", [name]);
  });
  // Create parts
  parts.forEach(({ name, designed_for_model_id }) => {
    db.run(
      "INSERT INTO car_part (name, designed_for_model_id) VALUES (?, ?);",
      [name, designed_for_model_id]
    );
  });
  // Create links
  links.forEach(({ car_model_id, car_part_id }) => {
    db.run(
      "INSERT INTO car_model_part (car_model_id, car_part_id) VALUES (?, ?);",
      [car_model_id, car_part_id]
    );
  });
  db.run("COMMIT;");
  await saveDatabase(db);
}
