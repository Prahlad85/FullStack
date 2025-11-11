import { useState, useRef } from "react";

export default function useDownloader() {
  const [progress, setProgress] = useState(0);
  const [eta, setEta] = useState(null);
  const controllerRef = useRef(null);

  async function startDownload(url, onComplete) {
    try {
      setProgress(0);
      setEta(null);
      
      const abortController = new AbortController();
      controllerRef.current = abortController;

      console.log("Starting download from:", url); // Debug log

      const response = await fetch(url, { 
        signal: abortController.signal,
        mode: 'cors',
        headers: {
          'Accept': '*/*',
        }
      });

      if (!response.ok) {
        throw new Error(`Download failed with status: ${response.status}`);
      }

      const contentLength = response.headers.get("content-length");
      const total = parseInt(contentLength, 10) || 0;
      console.log("Content length:", total); // Debug log

      const start = Date.now();
      let loaded = 0;
      let lastLoaded = 0;
      let lastTime = start;

      // Get response as stream
      const reader = response.body.getReader();
      const chunks = [];

      // Process stream
      const processStream = async () => {
        while (true) {
          const { done, value } = await reader.read();
          
          if (done) {
            console.log("Stream complete"); // Debug log
            break;
          }

          chunks.push(value);
          loaded += value.length;

          // Calculate progress
          const currentTime = Date.now();
          const timeInterval = (currentTime - lastTime) / 1000;
          
          // Update progress more frequently
          const percent = total ? Math.round((loaded / total) * 100) : Math.round((loaded / 1024) / 10);
          setProgress(percent);

          if (timeInterval >= 0.5) { // Update ETA every 500ms
            const bytesPerSecond = (loaded - lastLoaded) / timeInterval;
            const remainingBytes = total - loaded;
            const estimatedSeconds = bytesPerSecond > 0 ? Math.ceil(remainingBytes / bytesPerSecond) : 0;
            
            console.log("Progress:", percent, "% Speed:", Math.round(bytesPerSecond/1024), "KB/s"); // Debug log
            
            setEta(estimatedSeconds);
            lastLoaded = loaded;
            lastTime = currentTime;
          }
        }
      };

      await processStream();

      // Create and trigger download
      const blob = new Blob(chunks, { type: response.headers.get("content-type") || 'application/octet-stream' });
      const filename = url.split("/").pop() || "download";
      
      const downloadUrl = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = downloadUrl;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(downloadUrl);

      setProgress(100);
      setEta(0);
      onComplete && onComplete();
      
    } catch (err) {
      console.error("Download error details:", err); // Detailed error logging
      if (err.name === "AbortError") {
        setProgress(0);
        setEta(null);
      } else {
        console.error("Download error:", err.message);
        setProgress(0);
        setEta(null);
      }
    }
  }

  function cancel() {
    if (controllerRef.current) controllerRef.current.abort();
    setProgress(0);
    setEta(null);
  }

  return { progress, eta, startDownload, cancel };
}
