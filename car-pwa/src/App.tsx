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
  const [view, setView] = useState<"search" | "details">("search");
  const [details, setDetails] = useState<CarDetails | null>(null);
  const [searchClicked, setSearchClicked] = useState<boolean>(false);

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
      } catch (e: any) {
        setError(e.message);
        setLoading(false);
      }
    };

    loadDb(); // run the async function
  }, []);

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

  const handleSelect = (row: (string | number)[]): void => {
    if (!db) return;
    const id = Number(row[0]);
    if (filter === "cars") {
      const partsRes = db.exec(
        `SELECT cp.name, cp.part_number, CASE WHEN cpm.car_id = ? THEN 1 ELSE 0 END as is_primary
         FROM car_parts cp
         JOIN car_part_models cpm ON cpm.part_id = cp.id
         WHERE cpm.car_id = ?`,
        [id, id]
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
        `SELECT cm.name, CASE WHEN cpm.part_id = ? THEN 1 ELSE 0 END as is_primary
         FROM car_models cm
         JOIN car_part_models cpm ON cpm.car_id = cm.id
         WHERE cpm.part_id = ?`,
        [id, id]
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

  const handleBack = (): void => {
    setView("search");
    setSearchClicked(false);
    setResults([]);
  };

  if (loading) return <div className="container">Loading database…</div>;
  if (error) return <div className="container error">Error: {error}</div>;

  return (
    <div className="container">
      {view === "search" ? (
        <>
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
