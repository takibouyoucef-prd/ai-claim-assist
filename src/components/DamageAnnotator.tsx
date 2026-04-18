import { useRef, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export type Damage = {
  location: string;
  type: string;
  severity: "Low" | "Medium" | "High" | string;
  description: string;
  cost?: number;
  imageIndex?: number;
  x?: number;
  y?: number;
};

type Preview = { src: string; label: string };

interface Props {
  previews: Preview[];
  damages: Damage[];
  onAdd: (imageIndex: number, x: number, y: number) => void;
  onUpdate: (idx: number, patch: Partial<Damage>) => void;
  onRemove: (idx: number) => void;
}

const TYPES = ["Dent", "Scratch", "Broken Part", "Crack", "Paint Damage", "Other"];
const SEVERITIES = ["Low", "Medium", "High"];

const severityColor = (s: string) =>
  s === "High"
    ? "bg-destructive border-destructive text-destructive-foreground"
    : s === "Medium"
      ? "bg-amber-500 border-amber-500 text-white"
      : "bg-emerald-500 border-emerald-500 text-white";

export function DamageAnnotator({ previews, damages, onAdd, onUpdate, onRemove }: Props) {
  const [activeImage, setActiveImage] = useState(0);
  const [editingIdx, setEditingIdx] = useState<number | null>(null);
  const [addMode, setAddMode] = useState(false);
  const imgWrapRef = useRef<HTMLDivElement>(null);

  if (previews.length === 0) {
    return (
      <p className="text-sm text-muted-foreground italic">
        No media uploaded — annotations are unavailable.
      </p>
    );
  }

  const safeIdx = Math.min(activeImage, previews.length - 1);
  const current = previews[safeIdx];
  const damagesOnImage = damages
    .map((d, i) => ({ d, i }))
    .filter(({ d }) => (d.imageIndex ?? 0) === safeIdx);

  const handleImageClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!addMode) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;
    onAdd(safeIdx, x, y);
    setAddMode(false);
    // Open the edit dialog for the newly added damage (last index)
    setTimeout(() => setEditingIdx(damages.length), 0);
  };

  const editing = editingIdx !== null ? damages[editingIdx] : null;

  return (
    <div className="space-y-3">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap gap-1.5">
          {previews.map((p, i) => (
            <button
              key={i}
              onClick={() => {
                setActiveImage(i);
                setAddMode(false);
              }}
              className={`text-xs px-2 py-1 rounded border ${
                i === safeIdx
                  ? "bg-foreground text-background border-foreground"
                  : "hover:bg-muted"
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
        <Button
          size="sm"
          variant={addMode ? "default" : "outline"}
          onClick={() => setAddMode((v) => !v)}
        >
          {addMode ? "Click image to place…" : "+ Add damage"}
        </Button>
      </div>

      {/* Image with markers */}
      <div
        ref={imgWrapRef}
        className={`relative w-full overflow-hidden rounded border bg-muted select-none ${
          addMode ? "cursor-crosshair" : "cursor-default"
        }`}
        onClick={handleImageClick}
      >
        <img
          src={current.src}
          alt={current.label}
          className="w-full max-h-[480px] object-contain pointer-events-none"
          draggable={false}
        />
        {damagesOnImage.map(({ d, i }) => {
          const x = d.x ?? 50;
          const y = d.y ?? 50;
          // Marker number = position in the full damages array (1-based)
          return (
            <button
              key={i}
              onClick={(e) => {
                e.stopPropagation();
                setEditingIdx(i);
              }}
              style={{ left: `${x}%`, top: `${y}%` }}
              className={`absolute -translate-x-1/2 -translate-y-1/2 w-7 h-7 rounded-full border-2 text-xs font-bold flex items-center justify-center shadow-md hover:scale-110 transition-transform ${severityColor(
                d.severity,
              )}`}
              title={`${d.location} — ${d.type} (${d.severity})`}
            >
              {i + 1}
            </button>
          );
        })}
        {addMode && (
          <div className="absolute top-2 left-2 bg-background/90 text-xs px-2 py-1 rounded border">
            Click anywhere on the image to add a damage marker
          </div>
        )}
      </div>

      {/* Legend / damages list */}
      <div className="space-y-1.5">
        {damages.length === 0 ? (
          <p className="text-xs text-muted-foreground italic">
            No damages recorded. Use "Add damage" to mark one.
          </p>
        ) : (
          damages.map((d, i) => (
            <div
              key={i}
              className="flex items-center gap-3 text-sm p-2 rounded border hover:bg-muted/50"
            >
              <span
                className={`w-6 h-6 rounded-full border-2 text-xs font-bold flex items-center justify-center shrink-0 ${severityColor(
                  d.severity,
                )}`}
              >
                {i + 1}
              </span>
              <div className="flex-1 min-w-0">
                <div className="font-medium truncate">{d.location}</div>
                <div className="text-xs text-muted-foreground">
                  {d.type} · Image {(d.imageIndex ?? 0) + 1}
                </div>
              </div>
              <Badge
                variant={
                  d.severity === "High"
                    ? "destructive"
                    : d.severity === "Medium"
                      ? "default"
                      : "secondary"
                }
              >
                {d.severity}
              </Badge>
              <div className="flex items-center">
                <span className="text-xs text-muted-foreground mr-1">$</span>
                <Input
                  type="number"
                  value={d.cost ?? 0}
                  onChange={(e) =>
                    onUpdate(i, { cost: Number(e.target.value) || 0 })
                  }
                  className="w-24 h-8 text-right font-mono text-xs"
                />
              </div>
              <button
                onClick={() => {
                  setActiveImage(d.imageIndex ?? 0);
                  setEditingIdx(i);
                }}
                className="text-xs text-muted-foreground hover:text-foreground px-2"
              >
                Edit
              </button>
              <button
                onClick={() => onRemove(i)}
                className="text-xs text-muted-foreground hover:text-destructive px-1"
                aria-label="Remove damage"
              >
                ✕
              </button>
            </div>
          ))
        )}
      </div>

      {/* Edit dialog */}
      <Dialog
        open={editingIdx !== null && editing !== null}
        onOpenChange={(open) => !open && setEditingIdx(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit damage marker</DialogTitle>
          </DialogHeader>
          {editing && editingIdx !== null && (
            <div className="space-y-3">
              <div>
                <Label>Location</Label>
                <Input
                  value={editing.location}
                  onChange={(e) =>
                    onUpdate(editingIdx, { location: e.target.value })
                  }
                  placeholder="e.g. Front bumper, Driver door"
                  className="mt-1.5"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Type</Label>
                  <Select
                    value={editing.type}
                    onValueChange={(v) => onUpdate(editingIdx, { type: v })}
                  >
                    <SelectTrigger className="mt-1.5">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {TYPES.map((t) => (
                        <SelectItem key={t} value={t}>
                          {t}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Severity</Label>
                  <Select
                    value={editing.severity}
                    onValueChange={(v) => onUpdate(editingIdx, { severity: v })}
                  >
                    <SelectTrigger className="mt-1.5">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {SEVERITIES.map((s) => (
                        <SelectItem key={s} value={s}>
                          {s}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div>
                <Label>Description</Label>
                <Textarea
                  value={editing.description}
                  onChange={(e) =>
                    onUpdate(editingIdx, { description: e.target.value })
                  }
                  rows={3}
                  className="mt-1.5"
                />
              </div>
              <div>
                <Label>Estimated cost ($)</Label>
                <Input
                  type="number"
                  value={editing.cost ?? 0}
                  onChange={(e) =>
                    onUpdate(editingIdx, { cost: Number(e.target.value) || 0 })
                  }
                  className="mt-1.5 font-mono"
                />
              </div>
            </div>
          )}
          <DialogFooter className="sm:justify-between">
            <Button
              variant="ghost"
              onClick={() => {
                if (editingIdx !== null) onRemove(editingIdx);
                setEditingIdx(null);
              }}
              className="text-destructive hover:text-destructive"
            >
              Remove (false positive)
            </Button>
            <Button onClick={() => setEditingIdx(null)}>Done</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
