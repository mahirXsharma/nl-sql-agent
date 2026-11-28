"use client"

import React, { useState } from "react";

export default function Home() {
  const [q, setQ] = useState("");
  const [rows, setRows] = useState<Record<string, unknown>[]>([]);
  const [sql, setSql] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!q.trim()) return;

    setLoading(true);
    setError("");
    setSql("");

    try {
      const res = await fetch("/api/ask", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: q }),
      });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Query failed");
        if (data.sql) setSql(data.sql);
        setRows([]);
      } else {
        setSql(data.sql);
        setRows(data.rows);
      }
    } catch {
      setError("Network error talking to /api/ask");
    } finally {
      setLoading(false);
    }
  }
  return (
    <div>
      <div className="flex flex-col h-screen">
        <div className="flex-1 overflow-y-auto p-6">
          {loading && <p className="mt-4">Thinking...</p>}
          {error && <p className="mt-4 text-red-400">{error}</p>}

          {rows.length > 0 && (
            <table className="mt-4 border-collapse border">
              <thead>
                <tr>
                  {Object.keys(rows[0]).map((col) => (
                    <th key={col} className="border px-4 py-2 text-left">
                      {col}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((row, i) => (
                  <tr key={i}>
                    {Object.keys(row).map((col) => (
                      <td key={col} className="border px-4 py-2">
                        {String(row[col] ?? "")}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {sql && (
            <details className="mt-4">
              <summary className="cursor-pointer text-sm text-zinc-400">
                View SQL
              </summary>
              <pre className="mt-2 overflow-x-auto bg-zinc-900 p-3 text-sm text-green-400">
                {sql}
              </pre>
            </details>
          )}
        </div>

        <form className="flex justify-center p-4" onSubmit={(e) => handleSubmit(e)}>
          <input
            type="text"
            placeholder="Write Your Query Here"
            className="border-2 p-2"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
          <button>Submit</button>
        </form>
      </div>

    </div>
  );
}
