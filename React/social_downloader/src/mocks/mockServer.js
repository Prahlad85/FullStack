import { setupWorker, rest } from "msw";

const mockInspect = (url) => {
  // make a naive provider detection
  let provider = "unknown";
  if (/youtu/.test(url)) provider = "YouTube";
  if (/instagram/.test(url)) provider = "Instagram";
  if (/facebook|fb\./.test(url)) provider = "Facebook";

  return {
    id: Math.random().toString(36).slice(2, 9),
    title: `${provider} Demo Video`,
    author: `${provider} Creator`,
    thumbnail: "https://via.placeholder.com/320x180.png?text=Thumbnail",
    duration: "4:12",
    provider,
    formats: [
      { type: "video", quality: "1080p", ext: "mp4" },
      { type: "video", quality: "720p", ext: "mp4" },
      { type: "video", quality: "480p", ext: "mp4" },
      { type: "audio", quality: "128kbps", ext: "mp3" },
    ],
  };
};
export const worker = setupWorker(
  rest.post("/api/inspect", async (req, res, ctx) => {
    const { url } = await req.json();
    if (!url || !/^https?:\/\/.+/.test(url)) {
      return res(ctx.status(400), ctx.json({ error: "Invalid URL" }));
    }

    // simulate rate limit sometimes
    if (url.includes("ratelimit")) {
      return res(ctx.status(429), ctx.json({ error: "Rate limit" }));
    }

    const data = mockInspect(url);
    return res(ctx.delay(800), ctx.status(200), ctx.json(data));
  }),

  rest.post("/api/prepare", async (req, res, ctx) => {
    const { id, format } = await req.json();
    if (!id || !format)
      return res(ctx.status(400), ctx.json({ error: "Missing params" }));
    return res(
      ctx.delay(400),
      ctx.status(200),
      ctx.json({ downloadUrl: `/api/download/${id}-${format}`, token: id })
    );
  }),
  rest.get("/api/download/:token", (req, res, ctx) => {
    // stream endpoint in real server. Here we just return ok
    return res(ctx.status(200), ctx.body("mock-stream"));
  })
);
