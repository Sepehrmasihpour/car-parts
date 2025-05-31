import React, { useState, useEffect, useCallback } from "react";
import initSqlJs, { Database } from "sql.js";
import "./App.css";

interface CarDetails {
  title: string;
  type: "car" | "part";
  data: (string | number | boolean)[][];
}

const App: React.FC = () => {
  const [db, setDb] = useState<Database | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState<string>("");
  const [filter, setFilter] = useState<"cars" | "parts">("cars");
  const [results, setResults] = useState<(string | number)[][]>([]);
  const [view, setView] = useState<"search" | "details" | "adding">("search");
  const [details, setDetails] = useState<CarDetails | null>(null);
  const [searchClicked, setSearchClicked] = useState<boolean>(false);
  const [isAddingCar, setIsAddingCar] = useState<boolean>(true);
  const [formName, setFormName] = useState("");
  const [formPartNumber, setFormPartNumber] = useState("");
  const [selectedParts, setSelectedParts] = useState<Set<number>>(new Set());
  const [allParts, setAllParts] = useState<(string | number)[][]>([]);
  const [partSearch, setPartSearch] = useState("");
  const [warning, setWarning] = useState<string | null>(null);
  // Initialize database
  useEffect(() => {
    const loadDb = async () => {
      try {
        const res = await fetch("/carparts.db");
        const buffer = await res.arrayBuffer();
        const SQL = await initSqlJs({
          locateFile: (f) => `https://sql.js.org/dist/${f}`,
        });
        const db = new SQL.Database(new Uint8Array(buffer));
        setDb(db);
        setLoading(false);

        const parts = isAddingCar
          ? db.exec("SELECT id, name, part_number FROM car_parts")
          : db.exec("SELECT id, name FROM car_models");

        setAllParts(parts[0]?.values || []);
      } catch (e: any) {
        setError(e.message);
        setLoading(false);
      }
    };
    loadDb();
  }, [isAddingCar]);
  // Shared search helper
  const doSearch = useCallback(() => {
    if (!db) return [];
    const table = filter === "cars" ? "car_models" : "car_parts";
    const column = filter === "cars" ? "name" : "part_number";
    const sql = search
      ? `SELECT * FROM ${table} WHERE ${column} LIKE ?`
      : `SELECT * FROM ${table}`;
    const params = search ? [`%${search}%`] : [];
    try {
      const res = db.exec(sql, params);
      return res[0]?.values || [];
    } catch {
      return [];
    }
  }, [db, filter, search]);

  // Effect: re-run when filter, search, or click state changes
  useEffect(() => {
    if (!db || !searchClicked) return;
    setResults(doSearch());
  }, [db, filter, search, searchClicked, doSearch]);

  const handleSearch = (): void => {
    if (!db) return;
    setResults(doSearch());
    setSearchClicked(true);
  };

  const togglePart = (id: number) => {
    const next = new Set(selectedParts);
    next.has(id) ? next.delete(id) : next.add(id);
    setSelectedParts(next);
  };

  const handleSave = () => {
    if (!db) return;
    setWarning(null);
    try {
      if (isAddingCar) {
        const exists = db.exec("SELECT * FROM car_models WHERE name = ?", [
          formName,
        ]);
        if (exists.length)
          return setWarning("A car with this name already exists.");
        db.exec("INSERT INTO car_models (name) VALUES (?)", [formName]);
        const carId = db.exec("SELECT id FROM car_models WHERE name = ?", [
          formName,
        ])[0].values[0][0];
        for (const partId of selectedParts) {
          db.exec(
            "INSERT INTO car_part_models (car_id, part_id, is_primary) VALUES (?, ?, 0)",
            [carId, partId]
          );
        }
      } else {
        const exists = db.exec(
          "SELECT * FROM car_parts WHERE part_number = ?",
          [formPartNumber]
        );
        if (exists.length)
          return setWarning("A part with this part number already exists.");
        db.exec("INSERT INTO car_parts (part_number, name) VALUES (?, ?)", [
          formPartNumber,
          formName,
        ]);
        const partId = db.exec(
          "SELECT id FROM car_parts WHERE part_number = ?",
          [formPartNumber]
        )[0].values[0][0];
        for (const carId of selectedParts) {
          db.exec(
            "INSERT INTO car_part_models (car_id, part_id, is_primary) VALUES (?, ?, 0)",
            [carId, partId]
          );
        }
      }
      handleBack();
    } catch (e: any) {
      setWarning(e.message);
    }
  };

  const handleBack = () => {
    setView("search");
    setFormName("");
    setFormPartNumber("");
    setSelectedParts(new Set());
    setWarning(null);
    setSearchClicked(false);
    setResults([]);
  };

  const filteredParts = allParts.filter(
    ([, name, partNumber]) =>
      String(name).toLowerCase().includes(partSearch.toLowerCase()) ||
      String(partNumber).toLowerCase().includes(partSearch.toLowerCase())
  );

  const handleSelect = (row: (string | number)[]): void => {
    if (!db) return;
    const id = Number(row[0]);
    if (filter === "cars") {
      const partsRes = db.exec(
        `SELECT cp.name, cp.part_number, cpm.is_primary
         FROM car_parts cp
         JOIN car_part_models cpm ON cpm.part_id = cp.id
         WHERE cpm.car_id = ?`,
        [id]
      );
      setDetails({
        title: String(row[1]),
        type: "car",
        data: partsRes[0]?.values || [],
      });
    } else {
      const partNumber = String(row[1]);
      const name = String(row[2]);
      const carsRes = db.exec(
        `SELECT cm.name, cpm.is_primary
         FROM car_models cm
         JOIN car_part_models cpm ON cpm.car_id = cm.id
         WHERE cpm.part_id = ?`,
        [id]
      );
      setDetails({
        title: `${name} (${partNumber})`,
        type: "part",
        data: carsRes[0]?.values || [],
      });
    }
    setView("details");
    setSearchClicked(false);
  };

  if (loading) return <div className="container">Loading database…</div>;
  if (error) return <div className="container error">Error: {error}</div>;

  if (view === "adding")
    return (
      <div className="container">
        <button onClick={handleBack} className="back-button">
          ⬅ Back
        </button>
        <h2>Add a new {isAddingCar ? "Car Model" : "Car Part"}</h2>

        <label>
          <input
            type="radio"
            name="addingType"
            checked={isAddingCar}
            onChange={() => setIsAddingCar(true)}
          />
          Adding Car Model
        </label>
        <label>
          <input
            type="radio"
            name="addingType"
            checked={!isAddingCar}
            onChange={() => setIsAddingCar(false)}
          />
          Adding Car Part
        </label>
        <input
          type="text"
          value={formName}
          onChange={(e) => setFormName(e.target.value)}
          placeholder={
            isAddingCar
              ? "Car name (supports Persian)"
              : "Part name (supports Persian)"
          }
          className="input"
        />

        {!isAddingCar && (
          <input
            type="text"
            value={formPartNumber}
            onChange={(e) => setFormPartNumber(e.target.value)}
            placeholder="Part Number"
            className="input"
          />
        )}
        <input
          type="text"
          value={partSearch}
          onChange={(e) => setPartSearch(e.target.value)}
          placeholder={`Search ${isAddingCar ? "parts" : "cars"} to link`}
          className="input"
        />

        <div className="select-list">
          {filteredParts.map(([id, name, identifier]) => (
            <label key={id} className="select-item">
              <input
                type="checkbox"
                checked={selectedParts.has(Number(id))}
                onChange={() => togglePart(Number(id))}
              />
              <span className="select-name">{name}</span>
              {identifier && <span className="select-id">({identifier})</span>}
            </label>
          ))}
        </div>

        {warning && <div className="warning">{warning}</div>}

        <button className="button" onClick={handleSave}>
          Save
        </button>
      </div>
    );

  return (
    <div className="container">
      {view === "search" ? (
        <>
          <button className="add-button" onClick={() => setView("adding")}>
            + Add New
          </button>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSearch()}
            className="input"
            placeholder="Search..."
          />

          <div className="radio-group">
            {["cars", "parts"].map((opt) => (
              <label key={opt}>
                <input
                  type="radio"
                  name="filter"
                  value={opt}
                  checked={filter === opt}
                  onChange={() => setFilter(opt as "cars" | "parts")}
                />{" "}
                {opt === "cars" ? "Cars" : "Car Parts"}
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
          <button onClick={handleBack} className="back-button">
            ⬅ Back
          </button>
          <h2 className="details-title">{details?.title}</h2>
          <ul className="details-list">
            {details?.data.map((row, idx) => (
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
