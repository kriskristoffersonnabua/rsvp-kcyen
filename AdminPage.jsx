import { useState, useEffect, useCallback } from "react";
import PropTypes from "prop-types";
import { onAuthStateChanged, signInWithEmailAndPassword, signOut } from "firebase/auth";
import { auth } from "./firebaseConfig";
import { createRsvpLink, listRsvpLinks, deleteRsvpLink, listAttendees, updateAttendee, deleteAttendee, getAttendeesByHash, getGuestLimit, setGuestLimit } from "./firebaseApi";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Alert, AlertDescription } from "@/components/ui/alert";

function generateHash() {
  const arr = new Uint8Array(9);
  crypto.getRandomValues(arr);
  return Array.from(arr, (b) => b.toString(16).padStart(2, "0"))
    .join("")
    .slice(0, 16);
}

function getRsvpUrl(hash) {
  return `${globalThis.location.origin}${globalThis.location.pathname}?hash=${hash}`;
}

function formatDate(timestamp) {
  if (!timestamp) return "—";
  return new Date(timestamp).toLocaleDateString("en-PH", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function exportGuestsCsv(guests) {
  const headers = ["First Name", "Middle Name", "Last Name", "Attending", "Has Own Car", "Date Submitted"];
  const rows = guests.map((g) => [
    g.firstName ?? "",
    g.middleName ?? "",
    g.lastName ?? "",
    g.attending ? "Yes" : "No",
    g.hasOwnCar ? "Yes" : "No",
    formatDate(g.createdAt),
  ]);
  const csv = [headers, ...rows]
    .map((row) => row.map((v) => `"${String(v).replaceAll('"', '""')}"`).join(","))
    .join("\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "guests.csv";
  a.click();
  URL.revokeObjectURL(url);
}

const TH = "text-left text-[#8a9ab5] tracking-widest uppercase py-2 pr-4 whitespace-nowrap font-normal";
const TD = "py-2.5 pr-4 whitespace-nowrap";
const ACTION_BTN = "font-mono text-[10px] tracking-widest uppercase transition-colors";

// ─────────────────────────────────────────────
//  GuestRow sub-components
// ─────────────────────────────────────────────
function GuestEditRow({ guest, editForm, setEditForm, savingGuest, onSave, onCancelEdit }) {
  return (
    <tr className="border-b border-[#1e2438]/40 bg-[#131520]/80">
      <td className="py-2 pr-3">
        <input value={editForm.firstName} onChange={(e) => setEditForm((f) => ({ ...f, firstName: e.target.value }))}
          className="w-24 bg-[#0c0d10] border border-[#1e2438] text-[#edf0f5] rounded px-2 py-1 font-mono text-xs focus:border-[#8C2038] outline-none" />
      </td>
      <td className="py-2 pr-3">
        <input value={editForm.middleName} onChange={(e) => setEditForm((f) => ({ ...f, middleName: e.target.value }))}
          className="w-24 bg-[#0c0d10] border border-[#1e2438] text-[#edf0f5] rounded px-2 py-1 font-mono text-xs focus:border-[#8C2038] outline-none" />
      </td>
      <td className="py-2 pr-3">
        <input value={editForm.lastName} onChange={(e) => setEditForm((f) => ({ ...f, lastName: e.target.value }))}
          className="w-24 bg-[#0c0d10] border border-[#1e2438] text-[#edf0f5] rounded px-2 py-1 font-mono text-xs focus:border-[#8C2038] outline-none" />
      </td>
      <td className="py-2 pr-3">
        <button onClick={() => setEditForm((f) => ({ ...f, attending: !f.attending }))}
          className={`text-[10px] font-mono px-2 py-0.5 rounded border transition-colors ${editForm.attending ? "border-emerald-900/50 text-emerald-400 bg-emerald-950/30" : "border-red-900/50 text-red-400 bg-red-950/30"}`}>
          {editForm.attending ? "Yes" : "No"}
        </button>
      </td>
      <td className="py-2 pr-3">
        <button onClick={() => setEditForm((f) => ({ ...f, hasOwnCar: !f.hasOwnCar }))}
          className={`text-[10px] font-mono px-2 py-0.5 rounded border transition-colors ${editForm.hasOwnCar ? "border-[#8C2038]/50 text-[#8C2038] bg-[#8C2038]/10" : "border-[#1e2438] text-[#6b7a90]"}`}>
          {editForm.hasOwnCar ? "Yes" : "No"}
        </button>
      </td>
      <td className={`${TD} text-[#2e3548]`}>{guest.rsvpHash}</td>
      <td className={`${TD} text-[#6b7a90]`}>{formatDate(guest.createdAt)}</td>
      <td className="py-2">
        <div className="flex gap-1.5">
          <button onClick={() => onSave(guest.id)} disabled={savingGuest} className={`${ACTION_BTN} text-[#8C2038] hover:text-[#711830] disabled:opacity-50`}>
            {savingGuest ? "Saving…" : "Save"}
          </button>
          <span className="text-[#1e2438]">·</span>
          <button onClick={onCancelEdit} className={`${ACTION_BTN} text-[#6b7a90] hover:text-[#8a9ab5]`}>Cancel</button>
        </div>
      </td>
    </tr>
  );
}

GuestEditRow.propTypes = {
  guest: PropTypes.shape({ id: PropTypes.string, rsvpHash: PropTypes.string, createdAt: PropTypes.number }).isRequired,
  editForm: PropTypes.shape({ firstName: PropTypes.string, middleName: PropTypes.string, lastName: PropTypes.string, attending: PropTypes.bool, hasOwnCar: PropTypes.bool }).isRequired,
  setEditForm: PropTypes.func.isRequired,
  savingGuest: PropTypes.bool.isRequired,
  onSave: PropTypes.func.isRequired,
  onCancelEdit: PropTypes.func.isRequired,
};

function GuestViewRow({ guest, isDeleteTarget, onEdit, onDelete, onCancelDelete }) {
  const attendingClass = guest.attending
    ? "border-emerald-900/50 text-emerald-400"
    : "border-red-900/50 text-red-400";

  return (
    <tr className={`border-b border-[#1e2438]/40 transition-colors ${isDeleteTarget ? "bg-red-950/10" : "hover:bg-[#131520]/60"}`}>
      <td className={`${TD} text-[#edf0f5]`}>{guest.firstName}</td>
      <td className={`${TD} text-[#8a9ab5]`}>{guest.middleName || "—"}</td>
      <td className={`${TD} text-[#edf0f5]`}>{guest.lastName}</td>
      <td className="py-2.5 pr-4">
        <Badge variant="outline" className={`text-[10px] font-mono ${attendingClass}`}>
          {guest.attending ? "Yes" : "No"}
        </Badge>
      </td>
      <td className={`${TD} text-[#8a9ab5]`}>{guest.hasOwnCar ? "Yes" : "No"}</td>
      <td className={`${TD} text-[#2e3548]`}>{guest.rsvpHash}</td>
      <td className={`${TD} text-[#6b7a90]`}>{formatDate(guest.createdAt)}</td>
      <td className="py-2.5">
        {isDeleteTarget ? (
          <div className="flex gap-1.5 items-center">
            <button onClick={() => onDelete(guest.id)} className={`${ACTION_BTN} text-red-400 hover:text-red-300`}>Confirm</button>
            <span className="text-[#1e2438]">·</span>
            <button onClick={onCancelDelete} className={`${ACTION_BTN} text-[#6b7a90] hover:text-[#8a9ab5]`}>Cancel</button>
          </div>
        ) : (
          <div className="flex gap-1.5 items-center">
            <button onClick={() => onEdit(guest)} className={`${ACTION_BTN} text-[#8C2038] hover:text-[#711830]`}>Edit</button>
            <span className="text-[#1e2438]">·</span>
            <button onClick={() => onDelete(guest.id)} className={`${ACTION_BTN} text-[#6b7a90] hover:text-red-400`}>Delete</button>
          </div>
        )}
      </td>
    </tr>
  );
}

GuestViewRow.propTypes = {
  guest: PropTypes.shape({
    id: PropTypes.string, firstName: PropTypes.string, middleName: PropTypes.string,
    lastName: PropTypes.string, attending: PropTypes.bool, hasOwnCar: PropTypes.bool,
    rsvpHash: PropTypes.string, createdAt: PropTypes.number,
  }).isRequired,
  isDeleteTarget: PropTypes.bool.isRequired,
  onEdit: PropTypes.func.isRequired,
  onDelete: PropTypes.func.isRequired,
  onCancelDelete: PropTypes.func.isRequired,
};

// ─────────────────────────────────────────────
//  LoginForm
// ─────────────────────────────────────────────
function LoginForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e) {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      await signInWithEmailAndPassword(auth, email, password);
    } catch {
      setError("Invalid email or password.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#0c0d10] flex items-center justify-center px-4">
      <div
        className="pointer-events-none fixed inset-0 opacity-[0.03]"
        style={{ backgroundImage: "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)' opacity='1'/%3E%3C/svg%3E\")" }}
      />
      <Card className="bg-[#131520] border border-[#1e2438] shadow-2xl shadow-black/60 w-full max-w-sm relative">
        <CardHeader className="text-center space-y-3 pb-2">
          <p className="text-[#8a9ab5] text-xs tracking-[0.3em] uppercase font-mono">Admin</p>
          <CardTitle className="text-3xl font-bold text-[#edf0f5]" style={{ fontFamily: "'Cormorant Garamond', Georgia, serif" }}>
            Sign In
          </CardTitle>
          <Separator className="bg-[#1e2438]" />
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <Alert className="border-red-900/50 bg-red-950/30 text-red-300">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
            <div className="space-y-1.5">
              <Label className="text-[#8a9ab5] text-xs tracking-widest uppercase font-mono">Email</Label>
              <Input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="admin@example.com"
                className="bg-[#0c0d10] border-[#1e2438] text-[#edf0f5] placeholder:text-[#2e3548] focus:border-[#8C2038] focus:ring-0 transition-colors"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-[#8a9ab5] text-xs tracking-widest uppercase font-mono">Password</Label>
              <Input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="bg-[#0c0d10] border-[#1e2438] text-[#edf0f5] placeholder:text-[#2e3548] focus:border-[#8C2038] focus:ring-0 transition-colors"
              />
            </div>
            <Button
              type="submit"
              disabled={loading}
              className="w-full bg-[#8C2038] hover:bg-[#711830] text-white font-mono text-sm tracking-[0.15em] uppercase h-11 transition-all duration-200 disabled:opacity-50"
            >
              {loading ? "Signing in…" : "Sign In"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

// ─────────────────────────────────────────────
//  AdminPage
// ─────────────────────────────────────────────
export default function AdminPage() {
  const [user, setUser] = useState(undefined); // undefined = checking, null = logged out
  const [activeTab, setActiveTab] = useState("links");

  // ── Links tab state ─────────────────────────────────────────────
  const [links, setLinks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [label, setLabel] = useState("");
  const [maxInvitees, setMaxInvitees] = useState(1);
  const [generating, setGenerating] = useState(false);
  const [generatedLink, setGeneratedLink] = useState(null);
  const [copiedKey, setCopiedKey] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [attendeeDeletePrompt, setAttendeeDeletePrompt] = useState(null);
  const [exceedGuestWarning, setExceedGuestWarning] = useState(null);
  const [error, setError] = useState("");
  const [guestLimit, setGuestLimitState] = useState(130);
  const [editingLimit, setEditingLimit] = useState(false);
  const [limitInput, setLimitInput] = useState("130");
  const [savingLimit, setSavingLimit] = useState(false);

  // ── Guests tab state ────────────────────────────────────────────
  const [guests, setGuests] = useState([]);
  const [guestsLoading, setGuestsLoading] = useState(false);
  const [guestsLoaded, setGuestsLoaded] = useState(false);
  const [guestsError, setGuestsError] = useState("");
  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState({});
  const [savingGuest, setSavingGuest] = useState(false);
  const [deleteGuestTarget, setDeleteGuestTarget] = useState(null);
  const [guestSortField, setGuestSortField] = useState("createdAt");
  const [guestSortOrder, setGuestSortOrder] = useState("desc");

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => setUser(u ?? null));
    return unsub;
  }, []);

  const fetchLinks = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const data = await listRsvpLinks();
      data.sort((a, b) => (b.createdAt ?? 0) - (a.createdAt ?? 0));
      setLinks(data);
    } catch {
      setError("Failed to load links. Check your Firebase connection.");
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchGuests = useCallback(async () => {
    setGuestsLoading(true);
    setGuestsError("");
    try {
      const data = await listAttendees();
      data.sort((a, b) => (b.createdAt ?? 0) - (a.createdAt ?? 0));
      setGuests(data);
      setGuestsLoaded(true);
    } catch {
      setGuestsError("Failed to load guests. Check your Firebase connection.");
    } finally {
      setGuestsLoading(false);
    }
  }, []);

  function handleGuestEdit(guest) {
    setEditingId(guest.id);
    setEditForm({
      firstName: guest.firstName ?? "",
      middleName: guest.middleName ?? "",
      lastName: guest.lastName ?? "",
      attending: guest.attending ?? true,
      hasOwnCar: guest.hasOwnCar ?? false,
    });
    setDeleteGuestTarget(null);
  }

  function handleGuestEditCancel() {
    setEditingId(null);
    setEditForm({});
  }

  async function handleGuestSave(id) {
    setSavingGuest(true);
    try {
      await updateAttendee(id, editForm);
      setGuests((prev) => prev.map((g) => (g.id === id ? { ...g, ...editForm } : g)));
      setEditingId(null);
      setEditForm({});
    } catch {
      setGuestsError("Failed to update guest.");
    } finally {
      setSavingGuest(false);
    }
  }

  async function handleGuestDelete(id) {
    if (deleteGuestTarget !== id) {
      setDeleteGuestTarget(id);
      setEditingId(null);
      return;
    }
    try {
      await deleteAttendee(id);
      setGuests((prev) => prev.filter((g) => g.id !== id));
      setDeleteGuestTarget(null);
    } catch {
      setGuestsError("Failed to delete guest.");
    }
  }

  function handleGuestSort(field) {
    if (guestSortField === field) {
      setGuestSortOrder(guestSortOrder === "asc" ? "desc" : "asc");
    } else {
      setGuestSortField(field);
      setGuestSortOrder("asc");
    }
  }

  function getSortedGuests() {
    const sorted = [...guests];
    sorted.sort((a, b) => {
      let aVal, bVal;

      switch (guestSortField) {
        case "firstName":
          aVal = (a.firstName ?? "").toLowerCase();
          bVal = (b.firstName ?? "").toLowerCase();
          break;
        case "middleName":
          aVal = (a.middleName ?? "").toLowerCase();
          bVal = (b.middleName ?? "").toLowerCase();
          break;
        case "lastName":
          aVal = (a.lastName ?? "").toLowerCase();
          bVal = (b.lastName ?? "").toLowerCase();
          break;
        case "attending":
          aVal = a.attending ? 1 : 0;
          bVal = b.attending ? 1 : 0;
          break;
        case "hasOwnCar":
          aVal = a.hasOwnCar ? 1 : 0;
          bVal = b.hasOwnCar ? 1 : 0;
          break;
        case "rsvpHash":
          aVal = a.rsvpHash ?? "";
          bVal = b.rsvpHash ?? "";
          break;
        case "createdAt":
        default:
          aVal = a.createdAt ?? 0;
          bVal = b.createdAt ?? 0;
          break;
      }

      if (aVal < bVal) return guestSortOrder === "asc" ? -1 : 1;
      if (aVal > bVal) return guestSortOrder === "asc" ? 1 : -1;
      return 0;
    });
    return sorted;
  }

  useEffect(() => {
    fetchLinks();
    getGuestLimit().then((limit) => {
      setGuestLimitState(limit);
      setLimitInput(String(limit));
    });
  }, [fetchLinks]);

  useEffect(() => {
    if (activeTab === "guests" && !guestsLoaded) fetchGuests();
  }, [activeTab, guestsLoaded, fetchGuests]);

  async function createLink(hash, maxInviteesValue, labelValue) {
    setGenerating(true);
    setError("");
    setGeneratedLink(null);
    try {
      await createRsvpLink(hash, maxInviteesValue, labelValue.trim());
      setGeneratedLink({ hash, url: getRsvpUrl(hash) });
      setLabel("");
      await fetchLinks();
    } catch {
      setError("Failed to generate link.");
    } finally {
      setGenerating(false);
    }
  }

  function handleGenerate() {
    const currentTotal = links.reduce((sum, link) => sum + (link.maxInvitees || 0), 0);
    const newTotal = currentTotal + maxInvitees;

    if (newTotal > guestLimit) {
      setExceedGuestWarning({ newTotal, maxInvitees });
    } else {
      const hash = generateHash();
      createLink(hash, maxInvitees, label);
    }
  }

  async function handleConfirmExceed() {
    const hash = generateHash();
    await createLink(hash, maxInvitees, label);
    setExceedGuestWarning(null);
  }

  function handleDelete(hash) {
    if (deleteTarget !== hash) {
      setDeleteTarget(hash);
      return;
    }
    setDeleteTarget(null);
    setAttendeeDeletePrompt(hash);
  }

  async function handleDeleteWithAttendees(withAttendees) {
    const hash = attendeeDeletePrompt;
    setAttendeeDeletePrompt(null);
    try {
      if (withAttendees) {
        const attendees = await getAttendeesByHash(hash);
        await Promise.all(attendees.map((a) => deleteAttendee(a.id)));
        if (guestsLoaded) {
          setGuests((prev) => prev.filter((g) => g.rsvpHash !== hash));
        }
      }
      await deleteRsvpLink(hash);
      if (generatedLink?.hash === hash) setGeneratedLink(null);
      await fetchLinks();
    } catch {
      setError("Failed to delete link.");
    }
  }

  async function handleCopy(text, key) {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedKey(key);
      setTimeout(() => setCopiedKey(null), 2000);
    } catch {
      setError("Clipboard access denied.");
    }
  }

  async function handleSaveLimit() {
    const parsed = Number.parseInt(limitInput);
    if (!parsed || parsed < 1) return;
    setSavingLimit(true);
    try {
      await setGuestLimit(parsed);
      setGuestLimitState(parsed);
      setEditingLimit(false);
    } catch {
      setError("Failed to update guest limit.");
    } finally {
      setSavingLimit(false);
    }
  }

  // ── Auth gate ───────────────────────────────────────────────────
  if (user === undefined) {
    return (
      <div className="min-h-screen bg-[#0c0d10] flex items-center justify-center">
        <p className="text-[#6b7a90] font-mono text-sm tracking-widest animate-pulse">Loading…</p>
      </div>
    );
  }

  if (user === null) return <LoginForm />;

  // ── Derived counts ──────────────────────────────────────────────
  const pendingCount = links.filter((l) => !l.used).length;
  const usedCount = links.filter((l) => l.used).length;
  const attendingCount = guests.filter((g) => g.attending).length;
  const notAttendingCount = guests.filter((g) => !g.attending).length;
  const withTransportCount = guests.filter((g) => g.hasOwnCar).length;
  const noTransportCount = guests.filter((g) => !g.hasOwnCar).length;
  const totalInvitedGuests = links.reduce((sum, l) => sum + (l.maxInvitees || 0), 0);

  // ── Links table body ────────────────────────────────────────────
  let linksBody;
  if (loading) {
    linksBody = <p className="text-[#6b7a90] font-mono text-sm text-center py-6 animate-pulse">Loading…</p>;
  } else if (links.length === 0) {
    linksBody = <p className="text-[#2e3548] font-mono text-sm text-center py-6">No links generated yet.</p>;
  } else {
    linksBody = (
      <div className="overflow-x-auto">
        <table className="w-full text-xs font-mono border-collapse">
          <thead>
            <tr className="border-b border-[#1e2438]">
              {["Label", "Hash", "Status", "Guests", "Date", "Actions"].map((h) => (
                <th key={h} className={TH}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {links.map((link) => {
              const isDelTarget = deleteTarget === link.id;
              const statusClass = link.used
                ? "border-emerald-900/50 text-emerald-400"
                : "border-amber-900/50 text-amber-400";
              return (
                <tr key={link.id} className={`border-b border-[#1e2438]/40 transition-colors ${isDelTarget ? "bg-red-950/10" : "hover:bg-[#131520]/60"}`}>
                  <td className={`${TD} text-[#edf0f5]`}>{link.label || "—"}</td>
                  <td className={`${TD} text-[#6b7a90]`}>{link.id}</td>
                  <td className="py-2.5 pr-4">
                    <Badge variant="outline" className={`text-[10px] font-mono ${statusClass}`}>
                      {link.used ? "Used" : "Pending"}
                    </Badge>
                  </td>
                  <td className={`${TD} text-[#8a9ab5]`}>{link.maxInvitees}</td>
                  <td className={`${TD} text-[#6b7a90]`}>{formatDate(link.createdAt)}</td>
                  <td className="py-2.5">
                    {isDelTarget ? (
                      <div className="flex gap-1.5 items-center">
                        <button onClick={() => handleDelete(link.id)} className={`${ACTION_BTN} text-red-400 hover:text-red-300`}>Confirm</button>
                        <span className="text-[#1e2438]">·</span>
                        <button onClick={() => setDeleteTarget(null)} className={`${ACTION_BTN} text-[#6b7a90] hover:text-[#8a9ab5]`}>Cancel</button>
                      </div>
                    ) : (
                      <div className="flex gap-1.5 items-center">
                        <button onClick={() => handleCopy(getRsvpUrl(link.id), link.id)} className={`${ACTION_BTN} text-[#8C2038] hover:text-[#711830]`}>
                          {copiedKey === link.id ? "Copied!" : "Copy"}
                        </button>
                        <span className="text-[#1e2438]">·</span>
                        <button onClick={() => handleDelete(link.id)} className={`${ACTION_BTN} text-[#6b7a90] hover:text-red-400`}>Delete</button>
                      </div>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    );
  }

  // ── Guests table body ───────────────────────────────────────────
  let guestsBody;
  if (guestsLoading) {
    guestsBody = <p className="text-[#6b7a90] font-mono text-sm text-center py-6 animate-pulse">Loading…</p>;
  } else if (guests.length === 0) {
    guestsBody = <p className="text-[#2e3548] font-mono text-sm text-center py-6">No guests have submitted yet.</p>;
  } else {
    const sortedGuests = getSortedGuests();
    const columnConfig = [
      { label: "First Name", key: "firstName" },
      { label: "Middle Name", key: "middleName" },
      { label: "Last Name", key: "lastName" },
      { label: "Attending", key: "attending" },
      { label: "Transport", key: "hasOwnCar" },
      { label: "Hash", key: "rsvpHash" },
      { label: "Date", key: "createdAt" },
      { label: "Actions", key: null },
    ];

    guestsBody = (
      <div className="overflow-x-auto">
        <table className="w-full text-xs font-mono border-collapse">
          <thead>
            <tr className="border-b border-[#1e2438]/40">
              <td colSpan={8} className="pb-1 font-mono text-[11px]">
                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3 text-[#6b7a90]">
                    <span><span className="text-emerald-400">{attendingCount}</span> attending</span>
                    <span className="text-[#1e2438]">·</span>
                    <span><span className="text-red-400">{notAttendingCount}</span> not attending</span>
                    <span className="text-[#1e2438]">·</span>
                    <span><span className="text-[#8C2038]">{withTransportCount}</span> w/ transport</span>
                    <span className="text-[#1e2438]">·</span>
                    <span><span className="text-[#8a9ab5]">{noTransportCount}</span> no transport</span>
                  </div>
                  <span className="text-[#8C2038]">{totalInvitedGuests} guest{totalInvitedGuests !== 1 ? "s" : ""} total</span>
                </div>
              </td>
            </tr>
            <tr className="border-b border-[#1e2438]">
              {columnConfig.map((col) => (
                <th
                  key={col.label}
                  onClick={() => col.key && handleGuestSort(col.key)}
                  className={`${TH} ${col.key ? "cursor-pointer hover:text-[#edf0f5] transition-colors" : ""}`}
                >
                  <div className="flex items-center gap-1">
                    {col.label}
                    {col.key === guestSortField && (
                      <span className="text-[#8C2038]">{guestSortOrder === "asc" ? "↑" : "↓"}</span>
                    )}
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sortedGuests.map((guest) =>
              editingId === guest.id ? (
                <GuestEditRow
                  key={guest.id}
                  guest={guest}
                  editForm={editForm}
                  setEditForm={setEditForm}
                  savingGuest={savingGuest}
                  onSave={handleGuestSave}
                  onCancelEdit={handleGuestEditCancel}
                />
              ) : (
                <GuestViewRow
                  key={guest.id}
                  guest={guest}
                  isDeleteTarget={deleteGuestTarget === guest.id}
                  onEdit={handleGuestEdit}
                  onDelete={handleGuestDelete}
                  onCancelDelete={() => setDeleteGuestTarget(null)}
                />
              )
            )}
          </tbody>
        </table>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0c0d10] py-8 sm:py-12 px-4">
      <div
        className="pointer-events-none fixed inset-0 opacity-[0.03]"
        style={{ backgroundImage: "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)' opacity='1'/%3E%3C/svg%3E\")" }}
      />

      <div className="w-full max-w-4xl mx-auto space-y-6 relative">
        {/* Header */}
        <div className="text-center space-y-2 pb-2">
          <p className="text-[#8a9ab5] text-xs tracking-[0.3em] uppercase font-mono">Admin</p>
          <h1 className="text-3xl sm:text-4xl font-bold text-[#edf0f5]" style={{ fontFamily: "'Cormorant Garamond', Georgia, serif" }}>
            RSVP Manager
          </h1>
          <p className="text-[#6b7a90] text-xs font-mono">
            {!loading && `${pendingCount} pending · ${usedCount} used`}
            {guestsLoaded && ` · ${attendingCount} attending`}
          </p>
        </div>

        {/* Tabs + Sign Out */}
        <div className="flex items-center justify-between border-b border-[#1e2438]">
          <div className="flex">
            {[{ id: "links", label: "Links" }, { id: "guests", label: "All Guests" }].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`px-5 py-2 font-mono text-xs tracking-widest uppercase transition-colors ${
                  activeTab === tab.id
                    ? "text-[#8C2038] border-b-2 border-[#8C2038] -mb-px"
                    : "text-[#6b7a90] hover:text-[#8a9ab5]"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
          <button
            onClick={() => signOut(auth)}
            className="text-[#6b7a90] hover:text-red-400 font-mono text-[10px] tracking-widest uppercase transition-colors pb-2"
          >
            Sign Out
          </button>
        </div>

        {/* ── LINKS TAB ───────────────────────────────────────────── */}
        {activeTab === "links" && (
          <>
            {error && (
              <Alert className="border-red-900/50 bg-red-950/30 text-red-300">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <Card className="bg-[#131520] border border-[#1e2438] shadow-xl shadow-black/40">
              <CardHeader className="pb-3">
                <CardTitle className="text-[#edf0f5] text-base" style={{ fontFamily: "'Cormorant Garamond', serif" }}>
                  Generate New Link
                </CardTitle>
                <Separator className="bg-[#1e2438] mt-2" />
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-[#8a9ab5] text-xs tracking-widest uppercase font-mono">
                      Label <span className="text-[#2e3548]">(optional)</span>
                    </Label>
                    <Input
                      value={label}
                      onChange={(e) => setLabel(e.target.value)}
                      placeholder="e.g. Garcia Family"
                      className="bg-[#0c0d10] border-[#1e2438] text-[#edf0f5] placeholder:text-[#2e3548] focus:border-[#8C2038] focus:ring-0 transition-colors"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-[#8a9ab5] text-xs tracking-widest uppercase font-mono">
                      Number of Guests <span className="text-[#8C2038]">*</span>
                    </Label>
                    <Input
                      type="number"
                      min={1}
                      max={20}
                      value={maxInvitees}
                      onChange={(e) => setMaxInvitees(Math.max(1, Number.parseInt(e.target.value) || 1))}
                      className="bg-[#0c0d10] border-[#1e2438] text-[#edf0f5] focus:border-[#8C2038] focus:ring-0 transition-colors"
                    />
                  </div>
                </div>
                <Button onClick={handleGenerate} disabled={generating}
                  className="w-full bg-[#8C2038] hover:bg-[#711830] text-white font-mono text-sm tracking-[0.15em] uppercase h-11 transition-all duration-200 disabled:opacity-50">
                  {generating ? "Generating…" : "Generate Link"}
                </Button>
                {generatedLink && (
                  <div className="bg-[#0c0d10] border border-[#8a9ab5]/30 rounded-md p-3 space-y-2">
                    <p className="text-[#8a9ab5] text-[10px] font-mono tracking-widest uppercase">Link Ready</p>
                    <p className="text-[#edf0f5] text-xs font-mono break-all leading-relaxed">{generatedLink.url}</p>
                    <Button size="sm" onClick={() => handleCopy(generatedLink.url, "__generated")}
                      className="bg-[#1e2438] hover:bg-[#2e3548] text-[#8a9ab5] font-mono text-[10px] tracking-widest uppercase border border-[#8a9ab5]/20 h-8">
                      {copiedKey === "__generated" ? "Copied!" : "Copy Link"}
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* ── Guest Limit Setting ─────────────────────────────── */}
            <Card className="bg-[#131520] border border-[#1e2438] shadow-xl shadow-black/40">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-[#edf0f5] text-base" style={{ fontFamily: "'Cormorant Garamond', serif" }}>Guest Limit</CardTitle>
                  {!editingLimit && (
                    <button
                      onClick={() => { setLimitInput(String(guestLimit)); setEditingLimit(true); }}
                      className="text-[#6b7a90] hover:text-[#8C2038] font-mono text-[10px] tracking-widest uppercase transition-colors"
                    >
                      Edit
                    </button>
                  )}
                </div>
                <Separator className="bg-[#1e2438] mt-2" />
              </CardHeader>
              <CardContent>
                {editingLimit ? (
                  <div className="flex items-end gap-3">
                    <div className="space-y-1.5 flex-1">
                      <Label className="text-[#8a9ab5] text-xs tracking-widest uppercase font-mono">Max total guests</Label>
                      <Input
                        type="number"
                        min={1}
                        value={limitInput}
                        onChange={(e) => setLimitInput(e.target.value)}
                        className="bg-[#0c0d10] border-[#1e2438] text-[#edf0f5] focus:border-[#8C2038] focus:ring-0 transition-colors"
                      />
                    </div>
                    <div className="flex gap-2 pb-0.5">
                      <Button
                        onClick={handleSaveLimit}
                        disabled={savingLimit}
                        className="bg-[#8C2038] hover:bg-[#711830] text-white font-mono text-xs tracking-widest uppercase h-9 px-4 disabled:opacity-50"
                      >
                        {savingLimit ? "Saving…" : "Save"}
                      </Button>
                      <Button
                        onClick={() => setEditingLimit(false)}
                        variant="outline"
                        className="border-[#1e2438] text-[#6b7a90] hover:text-[#8a9ab5] hover:border-[#2e3548] font-mono text-xs tracking-widest uppercase h-9 px-4 bg-transparent"
                      >
                        Cancel
                      </Button>
                    </div>
                  </div>
                ) : (
                  <p className="text-[#6b7a90] font-mono text-xs">
                    Current limit: <span className="text-[#edf0f5] text-sm">{guestLimit}</span> guests
                  </p>
                )}
              </CardContent>
            </Card>

            <Card className="bg-[#131520] border border-[#1e2438] shadow-xl shadow-black/40">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-[#edf0f5] text-base" style={{ fontFamily: "'Cormorant Garamond', serif" }}>All Links</CardTitle>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="text-[10px] border-[#1e2438] text-[#6b7a90] font-mono">{links.length} links</Badge>
                    <Badge variant="outline" className="text-[10px] border-[#1e2438] text-[#8a9ab5] font-mono">{totalInvitedGuests} guests</Badge>
                    <button onClick={fetchLinks} className="text-[#6b7a90] hover:text-[#8C2038] font-mono text-[10px] tracking-widest uppercase transition-colors">Refresh</button>
                  </div>
                </div>
                <Separator className="bg-[#1e2438] mt-2" />
              </CardHeader>
              <CardContent>{linksBody}</CardContent>
            </Card>
          </>
        )}

        {/* ── GUESTS TAB ──────────────────────────────────────────── */}
        {activeTab === "guests" && (
          <>
            {guestsError && (
              <Alert className="border-red-900/50 bg-red-950/30 text-red-300">
                <AlertDescription>{guestsError}</AlertDescription>
              </Alert>
            )}
            <Card className="bg-[#131520] border border-[#1e2438] shadow-xl shadow-black/40">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-[#edf0f5] text-base" style={{ fontFamily: "'Cormorant Garamond', serif" }}>All Guests</CardTitle>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="text-[10px] border-[#1e2438] text-[#6b7a90] font-mono">{guests.length} total</Badge>
                    <button onClick={fetchGuests} className="text-[#6b7a90] hover:text-[#8C2038] font-mono text-[10px] tracking-widest uppercase transition-colors">Refresh</button>
                    {guests.length > 0 && (
                      <button onClick={() => exportGuestsCsv(guests)} className="text-[#8C2038] hover:text-[#711830] font-mono text-[10px] tracking-widest uppercase transition-colors">
                        Export CSV
                      </button>
                    )}
                  </div>
                </div>
                <Separator className="bg-[#1e2438] mt-2" />
              </CardHeader>
              <CardContent>{guestsBody}</CardContent>
            </Card>
          </>
        )}
      </div>

      {/* ── Guest count exceeded warning ────────────────────────── */}
      {exceedGuestWarning && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
          <div className="bg-[#131520] border border-[#1e2438] rounded-lg shadow-2xl shadow-black/60 p-6 max-w-sm w-full mx-4">
            <p className="text-[#edf0f5] font-mono text-sm tracking-wide mb-1">Guest limit exceeded?</p>
            <p className="text-[#6b7a90] font-mono text-xs mb-6">
              Total guests will be <span className="text-[#8a9ab5]">{exceedGuestWarning.newTotal}</span> (exceeds {guestLimit} limit). Continue generating link?
            </p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setExceedGuestWarning(null)}
                className="px-4 py-1.5 font-mono text-xs tracking-widest uppercase border border-[#1e2438] text-[#6b7a90] hover:text-[#8a9ab5] hover:border-[#2e3548] rounded transition-colors"
              >
                No
              </button>
              <button
                onClick={handleConfirmExceed}
                disabled={generating}
                className="px-4 py-1.5 font-mono text-xs tracking-widest uppercase bg-[#8C2038]/30 border border-[#8C2038]/50 text-[#8C2038] hover:bg-[#8C2038]/50 hover:text-[#ff6b8a] rounded transition-colors disabled:opacity-50"
              >
                {generating ? "Generating…" : "Yes, continue"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Delete attendees prompt ──────────────────────────────── */}
      {attendeeDeletePrompt && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
          <div className="bg-[#131520] border border-[#1e2438] rounded-lg shadow-2xl shadow-black/60 p-6 max-w-sm w-full mx-4">
            <p className="text-[#edf0f5] font-mono text-sm tracking-wide mb-1">Delete attendees?</p>
            <p className="text-[#6b7a90] font-mono text-xs mb-6">
              Also delete all attendees associated with hash{" "}
              <span className="text-[#8a9ab5]">{attendeeDeletePrompt}</span>?
            </p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => handleDeleteWithAttendees(false)}
                className="px-4 py-1.5 font-mono text-xs tracking-widest uppercase border border-[#1e2438] text-[#6b7a90] hover:text-[#8a9ab5] hover:border-[#2e3548] rounded transition-colors"
              >
                No
              </button>
              <button
                onClick={() => handleDeleteWithAttendees(true)}
                className="px-4 py-1.5 font-mono text-xs tracking-widest uppercase bg-red-900/30 border border-red-900/50 text-red-400 hover:bg-red-900/50 hover:text-red-300 rounded transition-colors"
              >
                Yes, delete all
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
