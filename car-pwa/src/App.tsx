import React, { useState, useEffect, useCallback } from "react";
import initSqlJs, { Database } from "sql.js";
import "./App.css";
import { get, set } from "idb-keyval";

interface CarDetails {
  title: string;
  type: "car" | "part";
  data: (string | number | boolean)[][];
}

// ──────────────── CONSTANTS ────────────────
const DB_STORAGE_KEY = "carparts-db-export";
// ───────────────────────────────────────────

const App: React.FC = () => {
  // ──────────────── STATE ────────────────
  const [db, setDb] = useState<Database | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Search / Filter / Results / Views
  const [search, setSearch] = useState<string>("");
  const [filter, setFilter] = useState<"cars" | "parts">("cars");
  const [results, setResults] = useState<(string | number)[][]>([]);
  const [view, setView] = useState<"search" | "details" | "adding">("search");
  const [details, setDetails] = useState<CarDetails | null>(null);
  const [searchClicked, setSearchClicked] = useState<boolean>(false);

  // “Adding” View
  const [isAddingCar, setIsAddingCar] = useState<boolean>(true);
  const [formName, setFormName] = useState<string>("");
  const [formPartNumber, setFormPartNumber] = useState<string>("");
  const [selectedParts, setSelectedParts] = useState<Set<number>>(new Set());
  const [allParts, setAllParts] = useState<(string | number)[][]>([]);
  const [partSearch, setPartSearch] = useState<string>("");
  const [warning, setWarning] = useState<string | null>(null);
  const [showList, setShowList] = useState<boolean>(true);
  // ──────────────────────────────────────────

  // ──────────────── 1. LOAD/REHYDRATE DB ────────────────
  useEffect(() => {
    let didCancel = false; // to prevent setting state after unmount

    const loadOrRehydrateDb = async () => {
      try {
        // 1a. Initialize sql.js (loads the WASM)
        const SQL = await initSqlJs({
          locateFile: (filename: any) => `https://sql.js.org/dist/${filename}`,
        });

        // 1b. Try retrieving our saved Uint8Array from IndexedDB
        const savedBytes: Uint8Array | undefined = await get(DB_STORAGE_KEY);

        let database: Database;
        if (savedBytes) {
          // 1c. Rehydrate from IndexedDB
          database = new SQL.Database(new Uint8Array(savedBytes));
        } else {
          // 1d. Fallback: fetch the original .db from /public
          const response = await fetch("/carparts.db");
          const buffer = await response.arrayBuffer();
          database = new SQL.Database(new Uint8Array(buffer));
          // 1e. Persist that “original” copy to IndexedDB for next time
          await set(DB_STORAGE_KEY, database.export());
        }

        if (didCancel) return; // component might have unmounted

        // 1f. Store in state, flip loading off
        setDb(database);
        setLoading(false);

        // 1g. Populate “allParts” immediately (based on initial isAddingCar)
        refreshAllParts(database, isAddingCar);
      } catch (e: any) {
        if (!didCancel) {
          setError(e.message);
          setLoading(false);
        }
      }
    };

    loadOrRehydrateDb();

    return () => {
      didCancel = true;
    };
  }, []); // runs once on mount

  // ─────────────── 2. REFRESH “allParts” WHEN db OR isAddingCar CHANGES ───────────────
  useEffect(() => {
    if (!db) return;
    refreshAllParts(db, isAddingCar);
  }, [db, isAddingCar]);

  // ────────────────────────────────────────────────────────────────────────────────────────

  // ──────────────── 3. HELPER: REFRESH allParts ────────────────
  const refreshAllParts = (database: Database, addingCar: boolean) => {
    try {
      // If adding a car, we need a list of all “parts” to link. Otherwise, a list of all “cars” to link.
      const query = addingCar
        ? "SELECT id, name, part_number FROM car_parts"
        : "SELECT id, name FROM car_models";
      const result = database.exec(query);
      setAllParts(result[0]?.values || []);
    } catch {
      setAllParts([]); // If something went wrong or tables are empty
    }
  };
  // ─────────────────────────────────────────────────────────────

  // ──────────────── 4. SHARED SEARCH HELPER ────────────────
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

  useEffect(() => {
    if (!db || !searchClicked) return;
    setResults(doSearch());
  }, [db, filter, search, searchClicked, doSearch]);

  const handleSearch = (): void => {
    if (!db) return;
    setResults(doSearch());
    setSearchClicked(true);
  };
  // ─────────────────────────────────────────────────────────────

  // ──────────────── 5. “ADDING” VIEW: handleSave ────────────────
  // Make it async so we can await the IndexedDB write
  const handleSave = async () => {
    if (!db) return;
    setWarning(null);

    try {
      if (isAddingCar) {
        // A. Check for duplicate car name
        const exists = db.exec("SELECT id FROM car_models WHERE name = ?", [
          formName,
        ]);
        if (exists.length) {
          return setWarning("A car with this name already exists.");
        }

        // B. Insert new car
        db.exec("INSERT INTO car_models (name) VALUES (?)", [formName]);

        // C. Get the new car’s ID
        const carId = db.exec("SELECT id FROM car_models WHERE name = ?", [
          formName,
        ])[0].values[0][0] as number;

        // D. Link selected parts
        for (const partId of selectedParts) {
          db.exec(
            "INSERT INTO car_part_models (car_id, part_id, is_primary) VALUES (?, ?, 0)",
            [carId, partId]
          );
        }
      } else {
        // E. Check for duplicate part number
        const exists = db.exec(
          "SELECT id FROM car_parts WHERE part_number = ?",
          [formPartNumber]
        );
        if (exists.length) {
          return setWarning("A part with this part number already exists.");
        }

        // F. Insert new part
        db.exec("INSERT INTO car_parts (part_number, name) VALUES (?, ?)", [
          formPartNumber,
          formName,
        ]);

        // G. Get the new part’s ID
        const partId = db.exec(
          "SELECT id FROM car_parts WHERE part_number = ?",
          [formPartNumber]
        )[0].values[0][0] as number;

        // H. Link selected cars
        for (const carId of selectedParts) {
          db.exec(
            "INSERT INTO car_part_models (car_id, part_id, is_primary) VALUES (?, ?, 0)",
            [carId, partId]
          );
        }
      }

      // I. Persist this updated DB to IndexedDB
      const updatedBytes = db.export();
      await set(DB_STORAGE_KEY, updatedBytes);

      // J. Return to “Search” view
      handleBack();
    } catch (e: any) {
      setWarning(e.message);
    }
  };
  // ──────────────────────────────────────────────────────────────────

  // ──────────────── 6. “DETAILS” VIEW: handleSelect & handleDelete ────────────────
  const handleSelect = (row: (string | number)[]) => {
    if (!db) return;
    const id = Number(row[0]);

    if (filter === "cars") {
      // Fetch all parts linked to this car
      const partsRes = db.exec(
        `SELECT cp.name, cp.part_number, cpm.is_primary
         FROM car_parts cp
         JOIN car_part_models cpm ON cpm.part_id = cp.id
         WHERE cpm.car_id = ?`,
        [id]
      );

      setDetails({
        title: String(row[1]), // car name
        type: "car",
        data: partsRes[0]?.values || [],
      });
    } else {
      // Fetch all cars linked to this part
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

  // Delete the selected car or part (and its join‐table rows), then persist
  const handleDelete = async () => {
    if (!db || !details) return;

    // Build a confirmation prompt
    const confirmMsg =
      details.type === "car"
        ? `Delete the car "${details.title}" and all its links?`
        : `Delete the part "${details.title}" and all its links?`;

    if (!window.confirm(confirmMsg)) return;

    try {
      if (details.type === "car") {
        // details.title is just the car name
        const carName = details.title;
        const rows = db.exec("SELECT id FROM car_models WHERE name = ?", [
          carName,
        ])[0]?.values;
        if (!rows?.length) throw new Error("Car not found");
        const carId = rows[0][0] as number;

        // 1. Delete all links for this car
        db.exec("DELETE FROM car_part_models WHERE car_id = ?", [carId]);
        // 2. Delete the car itself
        db.exec("DELETE FROM car_models WHERE id = ?", [carId]);
      } else {
        // details.title looks like "PartName (PARTNUMBER)"
        const match = details.title.match(/\(([^)]+)\)$/);
        const partNumber = match ? match[1] : "";
        if (!partNumber) throw new Error("Cannot parse part number");
        const rows = db.exec("SELECT id FROM car_parts WHERE part_number = ?", [
          partNumber,
        ])[0]?.values;
        if (!rows?.length) throw new Error("Part not found");
        const partId = rows[0][0] as number;

        // 1. Delete all links for this part
        db.exec("DELETE FROM car_part_models WHERE part_id = ?", [partId]);
        // 2. Delete the part itself
        db.exec("DELETE FROM car_parts WHERE id = ?", [partId]);
      }

      // Persist the deletion
      const updatedBytes = db.export();
      await set(DB_STORAGE_KEY, updatedBytes);

      // Return to “Search”
      handleBack();
    } catch (e: any) {
      alert("Delete failed: " + e.message);
    }
  };
  // ──────────────────────────────────────────────────────────────────────────────────

  // ──────────────── 7. UTILITY FUNCTIONS ────────────────
  const handleBack = () => {
    setView("search");
    setFormName("");
    setFormPartNumber("");
    setSelectedParts(new Set());
    setWarning(null);
    setSearchClicked(false);
    setResults([]);
  };

  const togglePart = (id: number) => {
    const next = new Set(selectedParts);
    next.has(id) ? next.delete(id) : next.add(id);
    setSelectedParts(next);
  };

  const filteredParts = allParts.filter(([, name, identifier]) => {
    const text = `${name} ${identifier ?? ""}`.toLowerCase();
    return text.includes(partSearch.toLowerCase());
  });
  // ─────────────────────────────────────────────────────────────────

  // ──────────────── 8. RENDER (Loading / Error / Adding / Search / Details) ────────────────
  if (loading) return <div className="container">Loading database…</div>;
  if (error) return <div className="container error">Error: {error}</div>;

  // 8a. “Adding” View
  if (view === "adding") {
    return (
      <div className="container">
        <button onClick={handleBack} className="back-button">
          ⬅ Back
        </button>
        <h2>Add a new {isAddingCar ? "Car Model" : "Car Part"}</h2>

        <div className="radio-group">
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
        </div>

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

        <label className="show">
          <input
            type="checkbox"
            checked={showList}
            onChange={(e) => setShowList(e.target.checked)}
          />
          Show list
        </label>

        {showList && (
          <div className="select-list">
            {filteredParts.map(([id, name, identifier]) => (
              <label key={id} className="select-item">
                <input
                  type="checkbox"
                  checked={selectedParts.has(Number(id))}
                  onChange={() => togglePart(Number(id))}
                />
                <span className="select-name">{name}</span>
                {identifier && (
                  <span className="select-id">({identifier})</span>
                )}
              </label>
            ))}
          </div>
        )}

        {warning && <div className="warning">{warning}</div>}

        <button className="button" onClick={handleSave}>
          Save
        </button>
      </div>
    );
  }

  // 8b. “Search” View
  if (view === "search") {
    return (
      <div className="container">
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
      </div>
    );
  }

  // 8c. “Details” View
  return (
    <div className="container">
      <div className="details-header">
        <button onClick={handleBack} className="back-button">
          ⬅ Back
        </button>
        <button onClick={handleDelete} className="delete-button">
          ❌ Delete
        </button>
      </div>
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
    </div>
  );
};

export default App;
