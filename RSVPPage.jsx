/**
 * RSVPPage.jsx
 * ─────────────────────────────────────────────────────
 * Validates the hash on mount, renders attendee sub-forms
 * (one per allowed invitee), then submits everything atomically.
 *
 * UI: shadcn/ui components + TailwindCSS
 * shadcn components used: Card, Input, Label, Button, Checkbox,
 *                          Badge, Separator, Alert
 */
import { useEffect, useState } from "react";
import { validateRsvpLink, submitRsvp, getAttendeesByHash } from "./firebaseApi";

// ── shadcn/ui primitives (adjust import paths to your setup) ──────
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Alert, AlertDescription } from "@/components/ui/alert";

// ─────────────────────────────────────────────────────────────────

const EMPTY_ATTENDEE = () => ({
  firstName: "",
  lastName: "",
  middleName: "",
  attending: true,
  hasOwnCar: false,
});

// Screen states
const STATE = {
  LOADING: "loading",
  INVALID: "invalid",
  USED: "used",
  FORM: "form",
  SUBMITTING: "submitting",
  SUCCESS: "success",
  ERROR: "error",
};

export default function RSVPPage({ hash }) {
  const [screen, setScreen] = useState(STATE.LOADING);
  const [maxInvitees, setMaxInvitees] = useState(1);
  const [attendees, setAttendees] = useState([EMPTY_ATTENDEE()]);
  const [submittedAttendees, setSubmittedAttendees] = useState([]);
  const [submitError, setSubmitError] = useState("");

  // ── Validate link on mount ──────────────────────────────────────
  useEffect(() => {
    (async () => {
      try {
        const result = await validateRsvpLink(hash);
        if (!result.exists) return setScreen(STATE.INVALID);
        if (result.used) {
          const prior = await getAttendeesByHash(hash);
          setSubmittedAttendees(prior);
          return setScreen(STATE.USED);
        }

        const max = result.maxInvitees;
        setMaxInvitees(max);
        setAttendees(Array.from({ length: max }, EMPTY_ATTENDEE));
        setScreen(STATE.FORM);
      } catch (err) {
        console.error(err);
        setScreen(STATE.ERROR);
        setSubmitError("Failed to validate your invitation link. Please try again later.");
      }
    })();
  }, [hash]);

  // ── Field update helper ─────────────────────────────────────────
  function updateAttendee(index, field, value) {
    setAttendees((prev) =>
      prev.map((a, i) => (i === index ? { ...a, [field]: value } : a))
    );
  }

  // ── Submit ──────────────────────────────────────────────────────
  async function handleSubmit(e) {
    e.preventDefault();
    setScreen(STATE.SUBMITTING);
    setSubmitError("");
    try {
      await submitRsvp(hash, attendees);
      setScreen(STATE.SUCCESS);
    } catch (err) {
      console.error(err);
      setSubmitError("Something went wrong while submitting. Please try again.");
      setScreen(STATE.FORM);
    }
  }

  // ── Render helpers ──────────────────────────────────────────────
  if (screen === STATE.LOADING) return <FullScreenMessage>Validating your invitation…</FullScreenMessage>;
  if (screen === STATE.INVALID) return <StatusCard type="invalid" />;
  if (screen === STATE.USED)    return <UsedScreen attendees={submittedAttendees} />;
  if (screen === STATE.SUCCESS) return <StatusCard type="success" />;

  // ── Form ────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-[#0c0d10] flex items-start justify-center py-8 sm:py-16 px-4">
      {/* Subtle grain overlay */}
      <div
        className="pointer-events-none fixed inset-0 opacity-[0.03]"
        style={{
          backgroundImage:
            "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)' opacity='1'/%3E%3C/svg%3E\")",
        }}
      />

      <div className="w-full max-w-2xl space-y-6 relative">
        {/* ── Header ─────────────────────────────────────────────── */}
        <div className="text-center space-y-3 pb-2">
          <p className="text-[#8a9ab5] text-xs tracking-[0.15em] sm:tracking-[0.3em] uppercase font-mono">
            You're Invited
          </p>
          <h1
            className="text-3xl sm:text-4xl md:text-5xl font-bold text-[#edf0f5]"
            style={{ fontFamily: "'Cormorant Garamond', Georgia, serif", letterSpacing: "-0.01em" }}
          >
            RSVP
          </h1>
          <p className="text-[#6b7a90] text-sm font-mono">
            {maxInvitees === 1
              ? "Your invitation is for 1 guest."
              : `Your invitation covers ${maxInvitees} guests.`}
          </p>
        </div>

        {/* ── Error alert ────────────────────────────────────────── */}
        {submitError && (
          <Alert className="border-red-900/50 bg-red-950/30 text-red-300">
            <AlertDescription>{submitError}</AlertDescription>
          </Alert>
        )}

        {/* ── Form ───────────────────────────────────────────────── */}
        <form onSubmit={handleSubmit} className="space-y-5">
          {attendees.map((attendee, index) => (
            <Card
              key={index}
              className="bg-[#131520] border border-[#1e2438] shadow-xl shadow-black/40"
            >
              <CardHeader className="pb-3 sm:pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle
                    className="text-[#edf0f5] text-base"
                    style={{ fontFamily: "'Cormorant Garamond', serif" }}
                  >
                    Guest {index + 1}
                  </CardTitle>
                  <Badge
                    variant="outline"
                    className="text-[10px] border-[#1e2438] text-[#6b7a90] font-mono"
                  >
                    #{index + 1} of {maxInvitees}
                  </Badge>
                </div>
                <Separator className="bg-[#1e2438] mt-2" />
              </CardHeader>

              <CardContent className="space-y-4">
                {/* Name row */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-[#8a9ab5] text-xs tracking-widest uppercase font-mono">
                      First Name <span className="text-[#8C2038]">*</span>
                    </Label>
                    <Input
                      required
                      value={attendee.firstName}
                      onChange={(e) => updateAttendee(index, "firstName", e.target.value)}
                      placeholder="Juan"
                      className="bg-[#0c0d10] border-[#1e2438] text-[#edf0f5] placeholder:text-[#2e3548] focus:border-[#8C2038] focus:ring-0 transition-colors"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-[#8a9ab5] text-xs tracking-widest uppercase font-mono">
                      Middle Name
                    </Label>
                    <Input
                      value={attendee.middleName}
                      onChange={(e) => updateAttendee(index, "middleName", e.target.value)}
                      placeholder="Reyes"
                      className="bg-[#0c0d10] border-[#1e2438] text-[#edf0f5] placeholder:text-[#2e3548] focus:border-[#8C2038] focus:ring-0 transition-colors"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-[#8a9ab5] text-xs tracking-widest uppercase font-mono">
                      Last Name <span className="text-[#8C2038]">*</span>
                    </Label>
                    <Input
                      required
                      value={attendee.lastName}
                      onChange={(e) => updateAttendee(index, "lastName", e.target.value)}
                      placeholder="dela Cruz"
                      className="bg-[#0c0d10] border-[#1e2438] text-[#edf0f5] placeholder:text-[#2e3548] focus:border-[#8C2038] focus:ring-0 transition-colors"
                    />
                  </div>
                </div>

                {/* Toggles */}
                <div className="flex flex-col sm:flex-row gap-4 pt-1">
                  <label className="flex items-center gap-3 cursor-pointer group">
                    <Checkbox
                      checked={attendee.attending}
                      onCheckedChange={(val) => updateAttendee(index, "attending", !!val)}
                      className="border-[#1e2438] data-[state=checked]:bg-[#8C2038] data-[state=checked]:border-[#8C2038]"
                    />
                    <span className="text-sm text-[#8a9ab5] group-hover:text-[#edf0f5] transition-colors font-mono tracking-wide">
                      Will attend
                    </span>
                  </label>

                  <label className="flex items-center gap-3 cursor-pointer group">
                    <Checkbox
                      checked={attendee.hasOwnCar}
                      onCheckedChange={(val) => updateAttendee(index, "hasOwnCar", !!val)}
                      className="border-[#1e2438] data-[state=checked]:bg-[#8C2038] data-[state=checked]:border-[#8C2038]"
                    />
                    <span className="text-sm text-[#8a9ab5] group-hover:text-[#edf0f5] transition-colors font-mono tracking-wide">
                      Has own transportation
                    </span>
                  </label>
                </div>
              </CardContent>
            </Card>
          ))}

          {/* ── Submit ─────────────────────────────────────────────── */}
          <div className="pt-2">
            <Button
              type="submit"
              disabled={screen === STATE.SUBMITTING}
              className="w-full bg-[#8C2038] hover:bg-[#711830] text-white font-mono text-sm tracking-[0.15em] uppercase h-12 transition-all duration-200 disabled:opacity-50"
            >
              {screen === STATE.SUBMITTING ? "Submitting…" : "Confirm RSVP"}
            </Button>
            <p className="text-center text-[#2e3548] text-xs font-mono mt-3 tracking-wide">
              This link can only be used once.
            </p>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
//  Status screens
// ─────────────────────────────────────────────
function StatusCard({ type }) {
  const content = {
    invalid: {
      label: "Invalid Link",
      color: "text-red-400",
      badge: "border-red-900/50 text-red-400",
      message:
        "This invitation link doesn't exist. Please double-check the URL or contact the event organizer.",
    },
    used: {
      label: "Already Submitted",
      color: "text-amber-400",
      badge: "border-amber-900/50 text-amber-400",
      message:
        "This invitation link has already been used. Your RSVP was recorded. See you at the event!",
    },
    success: {
      label: "RSVP Confirmed",
      color: "text-emerald-400",
      badge: "border-emerald-900/50 text-emerald-400",
      message:
        "Thank you! Your attendance has been recorded. We look forward to seeing you.",
    },
  }[type];

  return (
    <div className="min-h-screen bg-[#0c0d10] flex items-center justify-center px-4">
      <Card className="bg-[#131520] border border-[#1e2438] max-w-md w-full shadow-2xl shadow-black/60">
        <CardHeader className="text-center pb-2 space-y-3">
          <p className="text-[#8a9ab5] text-xs tracking-[0.3em] uppercase font-mono">
            Invitation Status
          </p>
          <CardTitle
            className={`text-3xl ${content.color}`}
            style={{ fontFamily: "'Cormorant Garamond', serif" }}
          >
            {content.label}
          </CardTitle>
        </CardHeader>
        <CardContent className="text-center">
          <Separator className="bg-[#1e2438] mb-4" />
          <CardDescription className="text-[#8a9ab5] text-sm leading-relaxed font-mono">
            {content.message}
          </CardDescription>
        </CardContent>
      </Card>
    </div>
  );
}

function UsedScreen({ attendees }) {
  return (
    <div className="min-h-screen bg-[#0c0d10] flex items-start justify-center py-8 sm:py-16 px-4">
      <div className="w-full max-w-2xl space-y-6">
        <div className="text-center space-y-3 pb-2">
          <p className="text-[#8a9ab5] text-xs tracking-[0.15em] sm:tracking-[0.3em] uppercase font-mono">
            Invitation Status
          </p>
          <h1
            className="text-3xl sm:text-4xl font-bold text-amber-400"
            style={{ fontFamily: "'Cormorant Garamond', Georgia, serif" }}
          >
            Already Submitted
          </h1>
          <p className="text-[#6b7a90] text-sm font-mono">
            This link has already been used. Here are the guests that were submitted.
          </p>
        </div>

        <Card className="bg-[#131520] border border-[#1e2438] shadow-xl shadow-black/40">
          {attendees.length === 0 ? (
            <CardContent className="py-6 text-center">
              <p className="text-[#6b7a90] font-mono text-sm">No attendee records found.</p>
            </CardContent>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm font-mono">
                <thead>
                  <tr className="border-b border-[#1e2438]">
                    <th className="text-left text-[#8a9ab5] text-xs tracking-widest uppercase px-4 py-3 font-normal">#</th>
                    <th className="text-left text-[#8a9ab5] text-xs tracking-widest uppercase px-4 py-3 font-normal">Name</th>
                    <th className="text-left text-[#8a9ab5] text-xs tracking-widest uppercase px-4 py-3 font-normal">Status</th>
                    <th className="text-left text-[#8a9ab5] text-xs tracking-widest uppercase px-4 py-3 font-normal">Transportation</th>
                  </tr>
                </thead>
                <tbody>
                  {attendees.map((a, index) => (
                    <tr key={a.id} className="border-b border-[#1e2438] last:border-0 hover:bg-[#1a1e2e] transition-colors">
                      <td className="px-4 py-3 text-[#2e3548]">{index + 1}</td>
                      <td className="px-4 py-3 text-[#edf0f5]">
                        {[a.firstName, a.middleName, a.lastName].filter(Boolean).join(" ")}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`text-xs px-2 py-1 rounded border ${
                          a.attending
                            ? "border-emerald-900/50 text-emerald-400 bg-emerald-950/20"
                            : "border-red-900/50 text-red-400 bg-red-950/20"
                        }`}>
                          {a.attending ? "Attending" : "Not attending"}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        {a.hasOwnCar ? (
                          <span className="text-xs px-2 py-1 rounded border border-[#1e2438] text-[#8a9ab5] bg-[#0c0d10]">
                            Has own
                          </span>
                        ) : (
                          <span className="text-[#2e3548]">—</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}

function FullScreenMessage({ children }) {
  return (
    <div className="min-h-screen bg-[#0c0d10] flex items-center justify-center">
      <p className="text-[#6b7a90] font-mono text-sm tracking-widest animate-pulse">
        {children}
      </p>
    </div>
  );
}
