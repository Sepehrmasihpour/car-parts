-- src/schema.sql
CREATE TABLE car_models (
  id INTEGER PRIMARY KEY,
  name TEXT UNIQUE
);
CREATE TABLE car_parts (
  id INTEGER PRIMARY KEY,
  part_number TEXT UNIQUE,
  name TEXT
);
CREATE TABLE car_part_models (
  car_id INTEGER,
  part_id INTEGER,
  PRIMARY KEY(car_id,part_id)
);
