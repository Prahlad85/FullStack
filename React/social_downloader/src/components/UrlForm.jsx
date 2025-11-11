import React, { useEffect, useRef } from 'react'

const SUPPORTED = [
  /https?:\/\/www\.youtube\.com\/.+/i,
  /https?:\/\/youtu\.be\/.+/i,
  /https?:\/\/m\.youtube\.com\/.+/i,
  /https?:\/\/www\.instagram\.com\/.+/i,
  /https?:\/\/instagram\.com\/.+/i,
  /https?:\/\/www\.facebook\.com\/.+/i,
  /https?:\/\/fb\.watch\/.+/i,
]

export function isSupportedUrl(url) {
  return SUPPORTED.some((r) => r.test(url))
}

export default function UrlForm({ onSubmit, loading }) {
  const inputRef = useRef(null)

  useEffect(() => {
    // auto-paste if clipboard contains text when focused
    const el = inputRef.current
    if (!el) return
    const handleFocus = async () => {
      try {
        const text = await navigator.clipboard.readText()
        if (text && !el.value) el.value = text
      } catch (e) {
        // ignore clipboard errors (permission denied)
      }
    }
    el.addEventListener('focus', handleFocus)
    return () => el.removeEventListener('focus', handleFocus)
  }, [])

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        const val = inputRef.current.value.trim()
        onSubmit(val)
      }}
      className="flex gap-2 items-center"
      aria-label="URL input form"
    >
      <input
        aria-label="Video URL"
        ref={inputRef}
        type="url"
        placeholder="Paste YouTube / Instagram / Facebook link"
        className="flex-1 p-3 border rounded"
      />
      <button
        type="submit"
        className="px-4 py-2 bg-[var(--accent)] text-white rounded"
        disabled={loading}
        aria-disabled={loading}
      >
        {loading ? 'Fetching…' : 'Fetch'}
      </button>
    </form>
  )
}
