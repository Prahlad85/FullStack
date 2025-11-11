import React from "react";

export default function PreviewCard({
  info,
  onDownload,
  downloading,
  progress,
  onCancel,
}) {
  if (!info) return null;

  const videoFormats = info.formats.filter((f) => f.type === "video");
  const audioFormats = info.formats.filter((f) => f.type === "audio");

  return (
    <div className="mt-4 p-4 border rounded flex gap-4 flex-col md:flex-row">
      <img
        src={info.thumbnail}
        alt="thumbnail"
        className="w-40 h-24 object-cover rounded"
      />
      <div className="flex-1">
        <h3 className="font-semibold">{info.title}</h3>
        <p className="text-sm">
          {info.author} • {info.duration}
        </p>

        <div className="mt-3 flex gap-2 flex-wrap">
          <label className="flex items-center gap-2">
            <span className="text-sm">Type</span>
            <select
              id="type-select"
              className="p-2 border rounded"
              defaultValue="video"
            >
              <option value="video">Video (MP4)</option>
              <option value="audio">Audio (MP3)</option>
            </select>
          </label>
          <label className="flex items-center gap-2">
            <span className="text-sm">Quality</span>
            <select id="quality-select" className="p-2 border rounded">
              <option value="best">Best</option>
              {videoFormats.map((f) => (
                <option key={f.quality} value={f.quality}>
                  {f.quality}
                </option>
              ))}
            </select>
          </label>

          <div className="ml-auto flex items-center gap-2">
            {!downloading ? (
              <button
                onClick={() => {
                  const type = document.getElementById("type-select").value;
                  const quality =
                    document.getElementById("quality-select").value;
                  onDownload({ type, quality });
                }}
                className="px-4 py-2 bg-[var(--accent)] text-white rounded"
              >
                Download
              </button>
            ) : (
              <>
                <div className="w-40">
                  <div className="h-2 bg-gray-200 rounded overflow-hidden">
                    <div
                      style={{ width: `${progress}%` }}
                      className="h-full bg-[var(--accent)]"
                    ></div>
                  </div>
                  <div className="text-sm mt-1">
                    {progress}%{" "}
                    {progress < 100 && `• ETA ${progress < 100 ? "..." : ""}`}
                  </div>
                </div>
                <button onClick={onCancel} className="px-3 py-1 border rounded">
                  Cancel
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
