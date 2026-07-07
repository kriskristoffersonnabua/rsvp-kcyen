import { useState, useRef, useEffect, useCallback } from "react";
import html2canvas from "html2canvas";
import { saveFloorPlan, loadFloorPlan } from "./firebaseApi";
import PropTypes from "prop-types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";

const STORAGE_KEY = "rsvp_floor_plan_v1";
const BG_STORAGE_KEY = "rsvp_floor_plan_bg_v1";
const BG_ORIENTATION_KEY = "rsvp_floor_plan_bg_orientation_v1";

function loadPlan() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY)) ?? { tables: [] };
  } catch {
    return { tables: [] };
  }
}

function savePlan(plan) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(plan));
}

function genId() {
  return Math.random().toString(36).slice(2, 10);
}

function TableCard({ table, guests, unassignedGuests, onMouseDown, onRemove, onUnassign, onResizeStart, onToggleMinimize, onStartAssign, isAssigning }) {
  const filled = (table.guestIds ?? []).length;
  const empty = Math.max(0, table.capacity - filled);
  const width = table.width ?? 180;
  const height = table.height ?? null;
  const minimized = table.minimized ?? false;
  const miniSize = table.miniSize ?? 64;
  const fillPct = table.capacity > 0 ? filled / table.capacity : 0;

  if (minimized) {
    return (
      <div
        className="absolute select-none group"
        style={{ left: table.x, top: table.y, width: miniSize }}
      >
        {/* Circle – draggable */}
        <div
          onMouseDown={onMouseDown}
          className="rounded-full cursor-grab active:cursor-grabbing relative"
          style={{ width: miniSize, height: miniSize, backgroundColor: "#111320", boxShadow: "0 3px 14px rgba(0,0,0,0.85)" }}
        >
          {/* Fill arc */}
          <svg className="absolute inset-0 w-full h-full -rotate-90" viewBox="0 0 36 36">
            <circle cx="18" cy="18" r="15.9" fill="none" stroke="#8C2038" strokeWidth="2" strokeOpacity="0.25" />
            <circle
              cx="18" cy="18" r="15.9" fill="none"
              stroke="#e05070" strokeWidth="2.5"
              strokeDasharray={`${fillPct * 100} 100`}
              strokeLinecap="round"
            />
          </svg>
          {/* Seat count centred in circle */}
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="font-mono text-[11px] font-bold" style={{ color: "#f9a0b0", textShadow: "0 1px 4px rgba(0,0,0,1)" }}>
              {filled}/{table.capacity}
            </span>
          </div>

          {/* Hover controls */}
          <div className="absolute -top-1 -right-1 hidden group-hover:flex gap-0.5 z-20">
            {filled < table.capacity && unassignedGuests.length > 0 && (
              <button
                onMouseDown={(e) => e.stopPropagation()}
                onClick={onStartAssign}
                className="w-4 h-4 rounded-full font-mono text-[8px] flex items-center justify-center leading-none transition-colors"
                style={{ backgroundColor: isAssigning ? "#8C2038" : "#1e2438", color: isAssigning ? "#fff" : "#f08090" }}
                title="Assign guest"
              >
                +
              </button>
            )}
            <button
              onMouseDown={(e) => e.stopPropagation()}
              onClick={onToggleMinimize}
              className="w-4 h-4 rounded-full bg-[#8C2038] text-white font-mono text-[8px] flex items-center justify-center hover:bg-[#711830] leading-none"
              title="Expand"
            >
              ⤢
            </button>
            <button
              onMouseDown={(e) => e.stopPropagation()}
              onClick={onRemove}
              className="w-4 h-4 rounded-full bg-[#1e2438] text-[#6b7a90] font-mono text-[8px] flex items-center justify-center hover:text-red-400 leading-none"
            >
              ✕
            </button>
          </div>

          {/* Resize handle */}
          <div
            onMouseDown={(e) => { e.stopPropagation(); onResizeStart(e); }}
            className="absolute bottom-0 right-0 w-3 h-3 cursor-se-resize opacity-0 group-hover:opacity-100 transition-opacity"
            style={{ zIndex: 10 }}
          >
            <svg width="6" height="6" viewBox="0 0 8 8" fill="none">
              <path d="M7 1L1 7M7 4L4 7" stroke="#8C2038" strokeWidth="1.2" strokeLinecap="round"/>
            </svg>
          </div>
        </div>

        {/* Label below circle */}
        <div className="flex items-center justify-center mt-1" style={{ width: "max-content", transform: "translateX(-50%)", marginLeft: miniSize / 2 }}>
          <span
            className="font-mono font-bold uppercase text-white text-center leading-tight"
            style={{ fontSize: 11, letterSpacing: 1, textShadow: "0 1px 4px rgba(0,0,0,1), 0 0 8px rgba(0,0,0,0.9)", whiteSpace: "nowrap" }}
          >
            {table.name}
          </span>
        </div>
      </div>
    );
  }

  return (
    <div
      className="absolute select-none"
      style={{ left: table.x, top: table.y, width, ...(height ? { height, overflow: "hidden" } : {}) }}
    >
      {/* Title bar – draggable */}
      <div
        onMouseDown={onMouseDown}
        className="flex items-center justify-between px-2.5 py-1.5 rounded-t cursor-grab active:cursor-grabbing"
        style={{ background: "linear-gradient(135deg, #a02040 0%, #6e1530 100%)", boxShadow: "0 2px 4px rgba(0,0,0,0.4)" }}
      >
        <span className="text-white font-mono text-[11px] tracking-widest uppercase truncate mr-2" style={{ textShadow: "0 1px 2px rgba(0,0,0,0.5)" }}>
          {table.name}
        </span>
        <div className="flex items-center gap-1.5 shrink-0">
          <span className="text-white/70 font-mono text-[9px]">{filled}/{table.capacity}</span>
          <button
            onMouseDown={(e) => e.stopPropagation()}
            onClick={onToggleMinimize}
            className="text-white/60 hover:text-white font-mono text-[10px] leading-none"
            title="Minimize"
          >
            ⊖
          </button>
          <button
            onMouseDown={(e) => e.stopPropagation()}
            onClick={onRemove}
            className="text-white/60 hover:text-white font-mono text-[10px] leading-none"
          >
            ✕
          </button>
        </div>
      </div>

      {/* Body */}
      <div
        className="border border-t-0 rounded-b px-2.5 pb-2.5 pt-1.5 space-y-0.5"
        style={{
          backgroundColor: "#1a1d2e",
          borderColor: "#3a1525",
          ...(height ? { height: height - 33, overflowY: "auto" } : {}),
        }}
      >
        {(table.guestIds ?? []).map((gid, ri) => {
          const g = guests.find((x) => x.id === gid);
          if (!g) return null;
          return (
            <div
              key={gid}
              className="flex items-center justify-between gap-1 px-1.5 py-0.5 rounded"
              style={{ backgroundColor: ri % 2 === 0 ? "rgba(255,255,255,0.04)" : "transparent" }}
            >
              <span className="text-white font-mono text-[10px] truncate" style={{ textShadow: "0 1px 2px rgba(0,0,0,0.6)" }}>
                {g.firstName} {g.lastName}
              </span>
              <button
                onClick={() => onUnassign(gid)}
                className="text-white/30 hover:text-red-400 font-mono text-[9px] shrink-0 transition-colors"
              >
                ✕
              </button>
            </div>
          );
        })}

        {/* Empty seats */}
        {Array.from({ length: empty }).map((_, i) => (
          <div key={`empty-${i}`} className="h-4 border border-dashed rounded" style={{ borderColor: "#2e1a22" }} />
        ))}

        {/* Assign button */}
        {filled < table.capacity && unassignedGuests.length > 0 && (
          <div className="pt-1">
            <button
              onClick={onStartAssign}
              className={`w-full text-center font-mono text-[9px] tracking-widest uppercase border border-dashed rounded py-0.5 transition-colors ${
                isAssigning
                  ? "border-[#e05070]/80 bg-[#8C2038]/20"
                  : "border-[#8C2038]/40 hover:border-[#e05070]/60 hover:bg-[#8C2038]/10"
              }`}
              style={{ color: isAssigning ? "#f08090" : "#c05060" }}
            >
              {isAssigning ? "· Assigning ·" : "+ Assign"}
            </button>
          </div>
        )}

        {/* Capacity badge */}
        <div className="text-right pt-1">
          <span className="font-mono text-[9px]" style={{ color: filled === table.capacity ? "#e05070" : "#6a7a90" }}>
            {filled}/{table.capacity} seats
          </span>
        </div>
      </div>

      {/* Resize handle */}
      <div
        onMouseDown={(e) => { e.stopPropagation(); onResizeStart(e); }}
        className="absolute bottom-0 right-0 w-4 h-4 cursor-se-resize flex items-end justify-end"
        style={{ zIndex: 10 }}
      >
        <svg width="8" height="8" viewBox="0 0 8 8" fill="none">
          <path d="M7 1L1 7M7 4L4 7" stroke="#8C2038" strokeWidth="1.2" strokeLinecap="round"/>
        </svg>
      </div>
    </div>
  );
}

TableCard.propTypes = {
  table: PropTypes.shape({
    id: PropTypes.string,
    name: PropTypes.string,
    capacity: PropTypes.number,
    guestIds: PropTypes.arrayOf(PropTypes.string),
    x: PropTypes.number,
    y: PropTypes.number,
    width: PropTypes.number,
    height: PropTypes.number,
    minimized: PropTypes.bool,
    miniSize: PropTypes.number,
  }).isRequired,
  guests: PropTypes.array.isRequired,
  unassignedGuests: PropTypes.array.isRequired,
  onMouseDown: PropTypes.func.isRequired,
  onRemove: PropTypes.func.isRequired,
  onUnassign: PropTypes.func.isRequired,
  onResizeStart: PropTypes.func.isRequired,
  onToggleMinimize: PropTypes.func.isRequired,
  onStartAssign: PropTypes.func.isRequired,
  isAssigning: PropTypes.bool,
};

export default function FloorPlanTab({ guests }) {
  const attendingGuests = guests.filter((g) => g.attending);

  const [plan, setPlan] = useState(loadPlan);
  const [newName, setNewName] = useState("");
  const [newCap, setNewCap] = useState(8);
  const [dragging, setDragging] = useState(null);
  const [resizing, setResizing] = useState(null);
  const [bgImage, setBgImage] = useState(() => localStorage.getItem(BG_STORAGE_KEY) ?? null);
  const [bgOrientation, setBgOrientation] = useState(() => localStorage.getItem(BG_ORIENTATION_KEY) ?? "landscape");
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [assigningTableId, setAssigningTableId] = useState(null);
  const [assignSearch, setAssignSearch] = useState("");
  const searchRef = useRef(null);
  const canvasRef = useRef(null);
  const bgInputRef = useRef(null);

  // On mount: if localStorage has no data, pull everything from Firebase
  useEffect(() => {
    const localPlan = localStorage.getItem(STORAGE_KEY);
    const localBg   = localStorage.getItem(BG_STORAGE_KEY);
    const hasLocal  = (localPlan && JSON.parse(localPlan)?.tables?.length > 0) || localBg;
    if (!hasLocal) {
      loadFloorPlan().then((remote) => {
        if (!remote) return;
        if (remote.tables?.length > 0) {
          setPlan({ tables: remote.tables });
          savePlan({ tables: remote.tables });
        }
        if (remote.bgImage) {
          setBgImage(remote.bgImage);
          localStorage.setItem(BG_STORAGE_KEY, remote.bgImage);
        }
        if (remote.bgOrientation) {
          setBgOrientation(remote.bgOrientation);
          localStorage.setItem(BG_ORIENTATION_KEY, remote.bgOrientation);
        }
      }).catch(() => {});
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Save plan to localStorage immediately; sync everything to Firebase debounced
  useEffect(() => {
    savePlan(plan);
    const t = setTimeout(() => {
      saveFloorPlan({ tables: plan.tables, bgImage, bgOrientation }).catch(() => {});
    }, 1500);
    return () => clearTimeout(t);
  }, [plan, bgImage, bgOrientation]);

  useEffect(() => {
    if (assigningTableId && sidebarOpen) {
      setTimeout(() => searchRef.current?.focus(), 50);
    }
  }, [assigningTableId, sidebarOpen]);

  useEffect(() => {
    function onKeyDown(e) {
      if (e.key === "Escape" && assigningTableId) {
        setAssigningTableId(null);
        setAssignSearch("");
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [assigningTableId]);

  const assignedIds = new Set(plan.tables.flatMap((t) => t.guestIds ?? []));
  const unassignedGuests = attendingGuests.filter((g) => !assignedIds.has(g.id));

  function addTable() {
    const name = newName.trim() || `Table ${plan.tables.length + 1}`;
    const col = plan.tables.length % 4;
    const row = Math.floor(plan.tables.length / 4);
    setPlan((p) => ({
      ...p,
      tables: [
        ...p.tables,
        { id: genId(), name, capacity: newCap, guestIds: [], x: 20 + col * 200, y: 20 + row * 230, width: 180, height: null },
      ],
    }));
    setNewName("");
  }

  function removeTable(id) {
    setPlan((p) => ({ ...p, tables: p.tables.filter((t) => t.id !== id) }));
  }

  function assignGuest(tableId, guestId) {
    setPlan((p) => {
      const table = p.tables.find((t) => t.id === tableId);
      if (!table || (table.guestIds ?? []).length >= table.capacity) return p;
      const updated = p.tables.map((t) =>
        t.id === tableId ? { ...t, guestIds: [...(t.guestIds ?? []), guestId] } : t
      );
      const updatedTable = updated.find((t) => t.id === tableId);
      if (updatedTable.guestIds.length >= updatedTable.capacity) {
        setAssigningTableId(null);
      }
      return { ...p, tables: updated };
    });
    setAssignSearch("");
  }

  function startAssign(tableId) {
    setAssigningTableId((prev) => prev === tableId ? null : tableId);
    setAssignSearch("");
    if (!sidebarOpen) setSidebarOpen(true);
  }

  function unassignGuest(tableId, guestId) {
    setPlan((p) => ({
      ...p,
      tables: p.tables.map((t) =>
        t.id === tableId ? { ...t, guestIds: (t.guestIds ?? []).filter((id) => id !== guestId) } : t
      ),
    }));
  }

  function handleMouseDown(e, tableId) {
    e.preventDefault();
    const rect = canvasRef.current.getBoundingClientRect();
    const table = plan.tables.find((t) => t.id === tableId);
    setDragging({ tableId, ox: e.clientX - rect.left - table.x, oy: e.clientY - rect.top - table.y });
  }

  function handleResizeStart(e, tableId) {
    e.preventDefault();
    const table = plan.tables.find((t) => t.id === tableId);
    if (table.minimized) {
      setResizing({ tableId, startX: e.clientX, startY: e.clientY, startW: table.miniSize ?? 64, startH: table.miniSize ?? 64, mini: true });
    } else {
      setResizing({
        tableId,
        startX: e.clientX,
        startY: e.clientY,
        startW: table.width ?? 180,
        startH: table.height ?? canvasRef.current.querySelector(`[data-table-id="${tableId}"]`)?.offsetHeight ?? 200,
        mini: false,
      });
    }
  }

  function toggleMinimize(tableId) {
    setPlan((p) => ({
      ...p,
      tables: p.tables.map((t) =>
        t.id === tableId ? { ...t, minimized: !(t.minimized ?? false) } : t
      ),
    }));
  }

  function handleMouseMove(e) {
    if (dragging) {
      const rect = canvasRef.current.getBoundingClientRect();
      const x = Math.max(0, e.clientX - rect.left - dragging.ox);
      const y = Math.max(0, e.clientY - rect.top - dragging.oy);
      setPlan((p) => ({
        ...p,
        tables: p.tables.map((t) => (t.id === dragging.tableId ? { ...t, x, y } : t)),
      }));
    }
    if (resizing) {
      const dx = e.clientX - resizing.startX;
      const dy = e.clientY - resizing.startY;
      if (resizing.mini) {
        const miniSize = Math.max(40, Math.round(resizing.startW + Math.max(dx, dy)));
        setPlan((p) => ({
          ...p,
          tables: p.tables.map((t) => t.id === resizing.tableId ? { ...t, miniSize } : t),
        }));
      } else {
        const width = Math.max(140, resizing.startW + dx);
        const height = Math.max(80, resizing.startH + dy);
        setPlan((p) => ({
          ...p,
          tables: p.tables.map((t) =>
            t.id === resizing.tableId ? { ...t, width, height } : t
          ),
        }));
      }
    }
  }

  function handleMouseUp() {
    setDragging(null);
    setResizing(null);
  }

  function clearAll() {
    setPlan({ tables: [] });
  }

  function handleBgUpload(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const dataUrl = ev.target.result;
      const img = new Image();
      img.onload = () => {
        const orientation = img.naturalHeight > img.naturalWidth ? "portrait" : "landscape";
        setBgOrientation(orientation);
        localStorage.setItem(BG_ORIENTATION_KEY, orientation);
      };
      img.src = dataUrl;
      setBgImage(dataUrl);
      localStorage.setItem(BG_STORAGE_KEY, dataUrl);
    };
    reader.readAsDataURL(file);
    e.target.value = "";
  }

  function removeBg() {
    setBgImage(null);
    setBgOrientation("landscape");
    localStorage.removeItem(BG_STORAGE_KEY);
    localStorage.removeItem(BG_ORIENTATION_KEY);
  }

  const exportFloorPlan = useCallback(async () => {
    if (!canvasRef.current) return;

    // Capture floor plan
    const planCanvas = await html2canvas(canvasRef.current, {
      useCORS: true,
      allowTaint: true,
      backgroundColor: "#0c0d10",
      scale: 2,
    });

    // Build off-screen summary element
    const SCALE = 2;
    const summaryWidth = planCanvas.width;
    const colW = Math.floor(summaryWidth / 3);
    const PAD = 24 * SCALE;
    const ROW_H = 22 * SCALE;
    const HEADER_H = 40 * SCALE;
    const SECTION_GAP = 16 * SCALE;
    const FONT = `${11 * SCALE}px monospace`;
    const FONT_SM = `${9 * SCALE}px monospace`;

    // Measure height needed
    const cols = [[], [], []];
    plan.tables.forEach((t, i) => {
      cols[i % 3].push(t);
    });
    const tallestCol = Math.max(...cols.map((col) =>
      col.reduce((h, t) => h + HEADER_H + ((t.guestIds ?? []).length + 1) * ROW_H + SECTION_GAP, 0)
    ), 0);
    const summaryHeight = PAD * 2 + 30 * SCALE + SECTION_GAP + tallestCol;

    // Draw summary on a new canvas
    const sc = document.createElement("canvas");
    sc.width = summaryWidth;
    sc.height = summaryHeight;
    const ctx = sc.getContext("2d");

    // Background
    ctx.fillStyle = "#12131e";
    ctx.fillRect(0, 0, sc.width, sc.height);

    // Top divider
    const divGrad = ctx.createLinearGradient(0, 0, sc.width, 0);
    divGrad.addColorStop(0, "#8C2038");
    divGrad.addColorStop(1, "#3a1525");
    ctx.fillStyle = divGrad;
    ctx.fillRect(0, 0, sc.width, 3 * SCALE);

    // Title
    ctx.fillStyle = "#ffffff";
    ctx.font = `bold ${14 * SCALE}px monospace`;
    ctx.letterSpacing = `${3 * SCALE}px`;
    ctx.fillText("SEATING SUMMARY", PAD, PAD + 15 * SCALE);

    ctx.fillStyle = "#8a9ab5";
    ctx.font = FONT_SM;
    ctx.letterSpacing = "0px";
    const seated = plan.tables.reduce((s, t) => s + (t.guestIds ?? []).length, 0);
    const totalCap = plan.tables.reduce((s, t) => s + t.capacity, 0);
    ctx.fillText(
      `${plan.tables.length} tables  ·  ${seated} / ${totalCap} seats filled`,
      PAD,
      PAD + 30 * SCALE,
    );

    // Draw each column
    cols.forEach((col, ci) => {
      let y = PAD + 44 * SCALE + SECTION_GAP;
      const x = PAD + ci * colW;
      const cardW = colW - PAD;

      col.forEach((table) => {
        const gids = table.guestIds ?? [];

        // Card shadow / background
        ctx.fillStyle = "#1a1d2e";
        ctx.fillRect(x, y, cardW, HEADER_H + Math.max(gids.length, 1) * ROW_H + 4 * SCALE);

        // Table header gradient bar
        const hGrad = ctx.createLinearGradient(x, y, x + cardW, y);
        hGrad.addColorStop(0, "#a02040");
        hGrad.addColorStop(1, "#6e1530");
        ctx.fillStyle = hGrad;
        ctx.fillRect(x, y, cardW, HEADER_H - 2 * SCALE);

        // Left accent stripe
        ctx.fillStyle = "#f08090";
        ctx.fillRect(x, y, 3 * SCALE, HEADER_H - 2 * SCALE);

        ctx.fillStyle = "#ffffff";
        ctx.font = `bold ${11 * SCALE}px monospace`;
        ctx.letterSpacing = `${1 * SCALE}px`;
        ctx.fillText(table.name.toUpperCase(), x + 10 * SCALE, y + 15 * SCALE);

        ctx.letterSpacing = "0px";
        ctx.fillStyle = gids.length === table.capacity ? "#f08090" : "rgba(255,255,255,0.65)";
        ctx.font = FONT_SM;
        ctx.fillText(`${gids.length} / ${table.capacity} seats`, x + 10 * SCALE, y + 28 * SCALE);

        y += HEADER_H;

        // Guest rows
        if (gids.length === 0) {
          ctx.fillStyle = "#2e3548";
          ctx.font = FONT_SM;
          ctx.fillText("(empty)", x + 10 * SCALE, y + 14 * SCALE);
          y += ROW_H;
        } else {
          gids.forEach((gid, ri) => {
            const g = attendingGuests.find((ag) => ag.id === gid);
            if (!g) return;
            // Alternating row bg
            ctx.fillStyle = ri % 2 === 0 ? "rgba(255,255,255,0.04)" : "transparent";
            ctx.fillRect(x, y, cardW, ROW_H);
            // Row number
            ctx.fillStyle = "#5a6070";
            ctx.font = FONT_SM;
            ctx.fillText(`${ri + 1}.`, x + 6 * SCALE, y + 15 * SCALE);
            // Name
            ctx.fillStyle = "#edf0f5";
            ctx.font = FONT;
            ctx.fillText(`${g.firstName} ${g.lastName}`, x + 20 * SCALE, y + 15 * SCALE);
            y += ROW_H;
          });
        }

        // Bottom border
        ctx.fillStyle = "#3a1525";
        ctx.fillRect(x, y, cardW, 1 * SCALE);

        y += SECTION_GAP + 4 * SCALE;
      });
    });

    // Combine floor plan + summary into one final canvas
    const final = document.createElement("canvas");
    final.width = planCanvas.width;
    final.height = planCanvas.height + sc.height;
    const fctx = final.getContext("2d");
    fctx.drawImage(planCanvas, 0, 0);
    fctx.drawImage(sc, 0, planCanvas.height);

    const link = document.createElement("a");
    link.download = "floor-plan.png";
    link.href = final.toDataURL("image/png");
    link.click();
  }, [plan, attendingGuests]);

  const totalSeats = plan.tables.reduce((s, t) => s + t.capacity, 0);
  const totalFilled = plan.tables.reduce((s, t) => s + (t.guestIds ?? []).length, 0);

  return (
    <div className="flex flex-col gap-4">
      {/* Toolbar */}
      <div className="bg-[#131520] border border-[#1e2438] rounded-lg px-4 py-3 flex flex-wrap items-end gap-3">
        <div className="flex flex-col gap-1">
          <label className="text-[#8a9ab5] font-mono text-[9px] tracking-widest uppercase">Table Name</label>
          <Input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && addTable()}
            placeholder="e.g. Table 1"
            className="bg-[#0c0d10] border-[#1e2438] text-[#edf0f5] placeholder:text-[#2e3548] focus:border-[#8C2038] focus:ring-0 h-8 text-xs font-mono w-36"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-[#8a9ab5] font-mono text-[9px] tracking-widest uppercase">Seats</label>
          <Input
            type="number"
            min={1}
            max={30}
            value={newCap}
            onChange={(e) => setNewCap(Math.max(1, Number.parseInt(e.target.value) || 1))}
            className="bg-[#0c0d10] border-[#1e2438] text-[#edf0f5] focus:border-[#8C2038] focus:ring-0 h-8 text-xs font-mono w-20"
          />
        </div>
        <Button
          onClick={addTable}
          className="bg-[#8C2038] hover:bg-[#711830] text-white font-mono text-[10px] tracking-widest uppercase h-8 px-4"
        >
          Add Table
        </Button>

        {/* Background image controls */}
        <div className="flex flex-col gap-1">
          <label className="text-[#8a9ab5] font-mono text-[9px] tracking-widest uppercase">Background</label>
          <div className="flex gap-2">
            <input
              ref={bgInputRef}
              type="file"
              accept="image/*"
              onChange={handleBgUpload}
              className="hidden"
            />
            <Button
              onClick={() => bgInputRef.current?.click()}
              variant="outline"
              className="bg-[#0c0d10] border-[#1e2438] text-[#8a9ab5] hover:bg-[#1e2438] hover:text-[#edf0f5] font-mono text-[10px] tracking-widest uppercase h-8 px-3"
            >
              {bgImage ? "Change Image" : "Upload Image"}
            </Button>
            {bgImage && (
              <button
                onClick={removeBg}
                className="text-[#6b7a90] hover:text-red-400 font-mono text-[9px] tracking-widest uppercase transition-colors"
              >
                Remove
              </button>
            )}
          </div>
        </div>

        <div className="ml-auto flex items-center gap-3">
          <div className="flex gap-2 font-mono text-[10px]">
            <span className="text-[#6b7a90]">
              <span className="text-[#edf0f5]">{totalFilled}</span>/{totalSeats} seated
            </span>
            <span className="text-[#1e2438]">·</span>
            <span className="text-[#6b7a90]">
              <span className="text-amber-400">{unassignedGuests.length}</span> unassigned
            </span>
          </div>
          <button
            onClick={exportFloorPlan}
            className="text-[#8a9ab5] hover:text-[#edf0f5] font-mono text-[9px] tracking-widest uppercase transition-colors border border-[#1e2438] hover:border-[#8a9ab5] rounded px-2 py-1"
          >
            Export PNG
          </button>
          {plan.tables.length > 0 && (
            <button
              onClick={clearAll}
              className="text-[#6b7a90] hover:text-red-400 font-mono text-[9px] tracking-widest uppercase transition-colors"
            >
              Clear All
            </button>
          )}
        </div>
      </div>

      <div className="flex gap-4 items-start">
        {/* Canvas */}
        <div
          ref={canvasRef}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          className="flex-1 relative border border-[#1e2438] rounded-lg overflow-auto scrollbar-hide"
          style={{
            backgroundColor: "#0c0d10",
            backgroundImage: bgImage
              ? `url(${bgImage})`
              : "radial-gradient(circle, #1e2438 1px, transparent 1px)",
            backgroundSize: bgImage ? "contain" : "24px 24px",
            backgroundPosition: bgImage ? "center" : undefined,
            backgroundRepeat: "no-repeat",
            cursor: dragging || resizing ? "grabbing" : "default",
            minHeight: bgImage ? undefined : (bgOrientation === "portrait" ? 680 : 480),
            aspectRatio: bgImage ? (bgOrientation === "portrait" ? "3 / 4" : "16 / 9") : undefined,
          }}
        >
          {/* Dim overlay when bg image is set so tables stay readable */}
          {bgImage && (
            <div className="absolute inset-0 bg-black/40 pointer-events-none" />
          )}

          {plan.tables.length === 0 && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <p className="text-[#2e3548] font-mono text-sm text-center">
                Add a table to start plotting your floor plan
              </p>
            </div>
          )}
          {plan.tables.map((table) => (
            <TableCard
              key={table.id}
              table={table}
              guests={attendingGuests}
              unassignedGuests={unassignedGuests}
              onMouseDown={(e) => handleMouseDown(e, table.id)}
              onRemove={() => removeTable(table.id)}
              onUnassign={(gid) => unassignGuest(table.id, gid)}
              onResizeStart={(e) => handleResizeStart(e, table.id)}
              onToggleMinimize={() => toggleMinimize(table.id)}
              onStartAssign={() => startAssign(table.id)}
              isAssigning={assigningTableId === table.id}
            />
          ))}
        </div>

        {/* Unassigned sidebar */}
        <div className={`bg-[#131520] border rounded-lg flex flex-col shrink-0 transition-all duration-200 ${sidebarOpen ? "w-52" : "w-8"} ${assigningTableId ? "border-[#8C2038]/60" : "border-[#1e2438]"}`}>
          {/* Header */}
          <div
            className="px-2 py-2.5 border-b border-[#1e2438] flex items-center justify-between cursor-pointer select-none"
            onClick={() => setSidebarOpen((o) => !o)}
            title={sidebarOpen ? "Collapse" : "Expand"}
          >
            {sidebarOpen ? (
              <>
                <span className={`font-mono text-[9px] tracking-widest uppercase ${assigningTableId ? "text-[#8C2038]" : "text-[#8a9ab5]"}`}>
                  {assigningTableId
                    ? `→ ${plan.tables.find((t) => t.id === assigningTableId)?.name ?? "Table"}`
                    : "Unassigned"}
                </span>
                <div className="flex items-center gap-1.5">
                  <Badge variant="outline" className="text-[9px] border-[#1e2438] text-[#6b7a90] font-mono px-1">
                    {unassignedGuests.length}
                  </Badge>
                  <span className="text-[#6b7a90] text-[10px]">‹</span>
                </div>
              </>
            ) : (
              <span className="text-[#6b7a90] text-[10px] mx-auto">›</span>
            )}
          </div>

          {sidebarOpen && (
            <>
              {/* Search */}
              <div className="px-2 py-2 border-b border-[#1e2438]">
                <input
                  ref={searchRef}
                  value={assignSearch}
                  onChange={(e) => setAssignSearch(e.target.value)}
                  placeholder="Search guest..."
                  className="w-full bg-[#0c0d10] border border-[#1e2438] focus:border-[#8C2038] rounded px-2 py-1 font-mono text-[10px] text-[#edf0f5] placeholder:text-[#2e3548] outline-none"
                />
              </div>

              {/* Guest list */}
              <div className="flex-1 overflow-y-auto py-1">
                {(() => {
                  const q = assignSearch.trim().toLowerCase();
                  const filtered = q
                    ? unassignedGuests.filter((g) =>
                        `${g.firstName} ${g.lastName}`.toLowerCase().includes(q)
                      )
                    : unassignedGuests;

                  if (filtered.length === 0) {
                    return (
                      <p className="text-[#2e3548] font-mono text-[10px] text-center py-4 px-2">
                        {unassignedGuests.length === 0
                          ? attendingGuests.length === 0 ? "No attending guests" : "All guests seated!"
                          : "No match"}
                      </p>
                    );
                  }

                  return filtered.map((g) => (
                    <div
                      key={g.id}
                      className={`px-3 py-1.5 border-b border-[#1e2438]/30 flex items-center justify-between gap-1 ${assigningTableId ? "cursor-pointer hover:bg-[#8C2038]/10 group" : ""}`}
                      onClick={() => assigningTableId && assignGuest(assigningTableId, g.id)}
                    >
                      <p className={`font-mono text-[10px] truncate transition-colors ${assigningTableId ? "text-[#edf0f5] group-hover:text-white" : "text-[#8a9ab5]"}`}>
                        {g.firstName} {g.lastName}
                      </p>
                      {assigningTableId && (
                        <span className="text-[#8C2038] font-mono text-[9px] shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">+</span>
                      )}
                    </div>
                  ));
                })()}
              </div>

              {/* Cancel assign mode */}
              {assigningTableId && (
                <div className="px-2 py-2 border-t border-[#1e2438]">
                  <button
                    onClick={() => { setAssigningTableId(null); setAssignSearch(""); }}
                    className="w-full text-center font-mono text-[9px] tracking-widest uppercase text-[#6b7a90] hover:text-[#edf0f5] transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      <p className="text-[#2e3548] font-mono text-[9px] text-center">
        Layout auto-saved · drag tables to reposition · drag corner to resize
      </p>
    </div>
  );
}

FloorPlanTab.propTypes = {
  guests: PropTypes.array.isRequired,
};
