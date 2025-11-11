import React from 'react'


export default function Header({ onHistoryClick }) {
return (
<header className="flex items-center justify-between p-4 border-b">
<div className="flex items-center gap-2">
<div className="w-8 h-8 rounded bg-[var(--accent)]" aria-hidden></div>
<strong>Downly</strong>
</div>


<nav className="flex gap-4">
<button className="px-3 py-1" onClick={onHistoryClick} aria-label="Open history">History</button>
<a className="px-3 py-1" href="#about">About</a>
</nav>
</header>
)
}