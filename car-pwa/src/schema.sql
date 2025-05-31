-- src/schema.sql
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
  car_id INTEGER,
  part_id INTEGER,
  is_primary INTEGER DEFAULT 0,
  PRIMARY KEY(car_id,part_id)
);
