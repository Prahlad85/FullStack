import React, { useState, useEffect } from "react";
import Header from "./components/Header";
import UrlForm, { isSupportedUrl } from "./components/UrlForm";
import PreviewCard from "./components/PreviewCard";
import HistoryList from "./components/HistoryList";
import Modal from "./components/Modal";
import { inspectUrl, prepareDownload } from "./api/client";
import useDownloader from "./hooks/useDownloader";

const HISTORY_KEY = "dl_history_v1";

function readHistory() {
  try {
    return JSON.parse(localStorage.getItem(HISTORY_KEY) || "[]");
  } catch (e) {
    return [];
  }
}

function writeHistory(list) {
  localStorage.setItem(HISTORY_KEY, JSON.stringify(list.slice(0, 10)));
}
export default function App() {
  const [info, setInfo] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [history, setHistory] = useState(readHistory());
  const [modalOpen, setModalOpen] = useState(false);
  const [downloading, setDownloading] = useState(false);

  const { progress, eta, startDownload, cancel } = useDownloader();

  useEffect(() => writeHistory(history), [history]);

  async function handleSubmit(url) {
    setError("");
    setInfo(null);

    if (!url) {
      setError("Please enter a URL");
      return;
    }
    if (!isSupportedUrl(url)) {
      setError("Unsupported link or invalid URL.");
      return;
    }

    setLoading(true);
    try {
      const data = await inspectUrl(url);
      setInfo(data);
      setModalOpen(true);
    } catch (err) {
      console.error(err);
      setError(err.message || "Failed to fetch metadata");
    } finally {
      setLoading(false);
    }
  }
  function addToHistory(item) {
    const newH = [item, ...history.filter((h) => h.id !== item.id)].slice(
      0,
      10
    );
    setHistory(newH);
    writeHistory(newH);
  }

  async function handleDownload({ type, quality }) {
    if (!info) return;
    setDownloading(true);
    setError("");
    try {
      const { token, downloadUrl } = await prepareDownload(info.id, {
        type,
        quality,
      });
      // for demo we simulate streaming via startDownload hook
      startDownload(downloadUrl, () => {
        setDownloading(false);
        addToHistory({
          id: info.id,
          title: info.title,
          provider: info.provider,
          duration: info.duration,
        });
        alert("Download finished (demo)");
      });
    } catch (err) {
      setError(err.message || "Failed to prepare download");
      setDownloading(false);
    }
  }
  function handleUseHistory(item) {
    // use history item to prefill (simulate reload)
    setInfo({
      ...item,
      thumbnail: "https://via.placeholder.com/320x180.png?text=Thumbnail",
      formats: [
        { type: "video", quality: "720p", ext: "mp4" },
        { type: "audio", quality: "128kbps", ext: "mp3" },
      ],
    });
    setModalOpen(true);
  }

  return (
    <div className="min-h-screen bg-white text-slate-800">
      <Header onHistoryClick={() => setModalOpen(true)} />
      <main className="p-4 max-w-4xl mx-auto">
        <section className="hero p-6 rounded">
          <h1 className="text-2xl font-bold mb-3">Downloader Demo</h1>
          <p className="text-sm text-gray-600 mb-4">
            Only download content you own or are permitted to download.
          </p>

          <UrlForm onSubmit={handleSubmit} loading={loading} />

          {error && (
            <div role="alert" className="mt-3 text-red-600">
              {error}
            </div>
          )}

          {loading && (
            <div className="mt-4 animate-pulse">
              <div className="h-24 bg-gray-100 rounded" />
            </div>
          )}
          {info && (
            <PreviewCard
              info={info}
              onDownload={handleDownload}
              downloading={downloading}
              progress={progress}
              onCancel={() => {
                cancel();
                setDownloading(false);
              }}
            />
          )}
        </section>

        <section className="mt-6 grid md:grid-cols-3 gap-4">
          <div className="md:col-span-2">
            <h2 className="text-lg font-medium">About</h2>
            <p className="text-sm text-gray-600">
              This UI is a demo with mocked endpoints. Connect a server
              implementing the API contract to make it work for real.
            </p>
          </div>

          <div>
            <HistoryList
              items={history}
              onUse={handleUseHistory}
              onClear={() => {
                setHistory([]);
                writeHistory([]);
              }}
            />
          </div>
        </section>
      </main>

      <Modal open={modalOpen} onClose={() => setModalOpen(false)}>
        {info ? (
          <div>
            <img
              src={info.thumbnail}
              alt="thumb"
              className="w-full h-40 object-cover rounded"
            />
            <h3 className="mt-2 font-semibold">{info.title}</h3>
            <p className="text-sm text-gray-600">
              {info.author} • {info.duration}
            </p>
            <div className="mt-4">
              <PreviewCard
                info={info}
                onDownload={handleDownload}
                downloading={downloading}
                progress={progress}
                onCancel={() => {
                  cancel();
                  setDownloading(false);
                }}
              />
            </div>
          </div>
        ) : (
          <p>Loading…</p>
        )}
      </Modal>
    </div>
  );
}
