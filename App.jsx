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
import { useEffect, useState } from "react";
import RSVPPage from "./RSVPPage";
import AdminPage from "./AdminPage";

export default function App() {
  const [hash, setHash] = useState(null);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    setIsAdmin(params.get("page") === "admin");
    setHash(params.get("hash") || "");
  }, []);

  if (hash === null) return null; // still reading URL

  if (isAdmin) return <AdminPage />;

  if (!hash) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0d0d0d]">
        <p className="text-[#b0a090] font-serif text-lg tracking-wide">
          No invitation link provided.
        </p>
      </div>
    );
  }

  return <RSVPPage hash={hash} />;
}
