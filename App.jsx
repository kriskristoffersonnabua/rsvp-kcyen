/**
 * App.jsx
 * Entry point — reads ?hash= from the URL and renders the correct screen.
 *
 * Screens
 *  1. /rsvp?hash=<value>  →  RSVPPage  (validates hash then shows form)
 *  2. anything else       →  NotFound
 *
 * Run with:  npm run dev
 * Stack:     Vite + React + TailwindCSS + shadcn/ui + Firebase
 */
import { lazy, Suspense, useEffect, useState } from "react";

const RSVPPage = lazy(() => import("./RSVPPage"));
const AdminPage = lazy(() => import("./AdminPage"));

function PageLoader() {
  return (
    <div className="min-h-screen bg-[#0f0e0c] flex items-center justify-center">
      <p className="text-[#7a6f63] font-mono text-sm tracking-widest animate-pulse">Loading…</p>
    </div>
  );
}

export default function App() {
  const [hash, setHash] = useState(null);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(globalThis.location.search);
    setIsAdmin(params.get("page") === "admin");
    setHash(params.get("hash") || "");
  }, []);

  if (hash === null) return null; // still reading URL

  if (isAdmin) return <Suspense fallback={<PageLoader />}><AdminPage /></Suspense>;

  if (!hash) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0d0d0d]">
        <p className="text-[#b0a090] font-serif text-lg tracking-wide">
          No invitation link provided.
        </p>
      </div>
    );
  }

  return <Suspense fallback={<PageLoader />}><RSVPPage hash={hash} /></Suspense>;
}
