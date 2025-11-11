import React from "react";

export default function Modal({ open, onClose, children }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center p-4">
      <div className="bg-white rounded p-4 max-w-lg w-full">
        <button onClick={onClose} className="float-right">
          Close
        </button>
        {children}
      </div>
    </div>
  );
}
