// File: src/App.jsx
import React, { useState, useEffect } from "react";
import initSqlJs from "sql.js";
import "./App.css";

const App = () => {
  const [db, setDb] = useState(null);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("cars");
  const [results, setResults] = useState([]);
  const [view, setView] = useState("search"); // 'search' | 'car' | 'part'
  const [details, setDetails] = useState(null);

  useEffect(() => {
    initSqlJs({ locateFile: (file) => `https://sql.js.org/dist/${file}` }).then(
      (SQL) => {
        const db = new SQL.Database();
        db.run(`
          CREATE TABLE car_models (id INTEGER PRIMARY KEY, name TEXT);
          CREATE TABLE car_parts (id INTEGER PRIMARY KEY, part_number TEXT, name TEXT, car_id INTEGER);
          CREATE TABLE car_part_models (car_id INTEGER, part_id INTEGER);
  
          INSERT INTO car_models (id, name) VALUES
            (1, 'Toyota Corolla'),
            (2, 'Peugeot 206');
  
          INSERT INTO car_parts (id, part_number, name, car_id) VALUES
            (1, 'BP-1001', 'Brake Pad', 1),
            (2, 'OF-206', 'Oil Filter', 2),
            (3, 'TB-999', 'Timing Belt', 1);
  
          INSERT INTO car_part_models (car_id, part_id) VALUES
            (1, 1), (2, 2), (1, 3), (2, 3); -- Timing Belt fits both
        `);
        setDb(db);
      }
    );
  }, []);

  const handleSearch = () => {
    if (!db) return;
    let res = [];
    if (filter === "cars") {
      res = db.exec(`SELECT * FROM car_models WHERE name LIKE '%${search}%'`);
    } else {
      res = db.exec(
        `SELECT * FROM car_parts WHERE part_number LIKE '%${search}%'`
      );
    }
    setResults(res[0]?.values || []);
  };

  const handleSelect = (item) => {
    if (filter === "cars") {
      const [id, name] = item;
      const parts = db.exec(`
        SELECT cp.name, cp.part_number, cp.car_id = ${id} as is_primary
        FROM car_parts cp
        JOIN car_part_models cpm ON cpm.part_id = cp.id
        WHERE cpm.car_id = ${id};
      `);
      setDetails({ title: name, type: "car", data: parts[0]?.values || [] });
      setView("details");
    } else {
      const [id, part_number, name, car_id] = item;
      const cars = db.exec(`
        SELECT cm.name, cm.id = ${car_id} as is_primary
        FROM car_models cm
        JOIN car_part_models cpm ON cpm.car_id = cm.id
        WHERE cpm.part_id = ${id};
      `);
      setDetails({
        title: `${name} (${part_number})`,
        type: "part",
        data: cars[0]?.values || [],
      });
      setView("details");
    }
  };

  return (
    <div className="container">
      {view === "search" ? (
        <>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="input"
            placeholder="Search..."
          />
          <div className="radio-group">
            {["cars", "parts"].map((option) => (
              <label key={option}>
                <input
                  type="radio"
                  name="filter"
                  value={option}
                  checked={filter === option}
                  onChange={() => setFilter(option)}
                />{" "}
                {option === "cars" ? "Cars" : "Car Parts"}
              </label>
            ))}
          </div>
          <button onClick={handleSearch} className="button">
            Search
          </button>
          <div className="results">
            {results.map((row, idx) => (
              <div
                key={idx}
                className="result-item"
                onClick={() => handleSelect(row)}
              >
                {filter === "cars" ? row[1] : `${row[2]} (${row[1]})`}
              </div>
            ))}
          </div>
        </>
      ) : (
        <>
          <button onClick={() => setView("search")} className="back-button">
            ⬅ Back
          </button>
          <h2 className="details-title">{details.title}</h2>
          <ul className="details-list">
            {details.data.map((row, idx) => (
              <li key={idx} className="details-item">
                {details.type === "car"
                  ? `${row[0]} (${row[1]}) ${row[2] ? "(Primary)" : ""}`
                  : `${row[0]} ${row[1] ? "(Primary)" : ""}`}
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
};

export default App;
