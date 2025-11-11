import React from "react";

export default function HistoryList({ items, onUse, onClear }) {
  return (
    <aside className="p-4 border rounded max-h-80 overflow-auto">
      <div className="flex justify-between items-center mb-2">
        <strong>History</strong>
        <button onClick={onClear} className="text-sm">
          Clear
        </button>
      </div>
      {items.length === 0 ? (
        <p className="text-sm text-gray-500">No recent downloads</p>
      ) : (
        <ul className="space-y-2">
          {items.map((it, idx) => (
            <li key={it.id} className="flex items-center justify-between">
              <div>
                <div className="text-sm font-medium">{it.title}</div>
                <div className="text-xs text-gray-600">
                  {it.provider} • {it.duration}
                </div>
              </div>
              <div>
                <button
                  onClick={() => onUse(it)}
                  className="px-2 py-1 border rounded text-sm"
                >
                  Use
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </aside>
  );
}
