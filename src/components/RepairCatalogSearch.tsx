import { useMemo, useState } from "react";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export type CatalogItem = {
  id: string;
  name: string;
  category: "Parts" | "Labor" | "Damage";
  cost: number;
  // Free-text aliases / intents that should match the user's query
  keywords: string[];
  // Short note shown in the result row
  note?: string;
};

// Mock database — represents what would come from a parts/labor pricing service.
export const REPAIR_CATALOG: CatalogItem[] = [
  // Parts
  { id: "p-bumper-f", name: "Front bumper cover", category: "Parts", cost: 620, keywords: ["bumper", "front", "fascia", "nose"], note: "OEM equivalent" },
  { id: "p-bumper-r", name: "Rear bumper cover", category: "Parts", cost: 580, keywords: ["bumper", "rear", "back"] },
  { id: "p-grille", name: "Front grille assembly", category: "Parts", cost: 240, keywords: ["grille", "grill", "front"] },
  { id: "p-headlight", name: "Headlight assembly", category: "Parts", cost: 410, keywords: ["headlight", "light", "lamp", "front"] },
  { id: "p-taillight", name: "Tail light assembly", category: "Parts", cost: 290, keywords: ["taillight", "tail", "rear", "lamp"] },
  { id: "p-fender", name: "Fender panel", category: "Parts", cost: 360, keywords: ["fender", "wing", "quarter"] },
  { id: "p-door", name: "Door shell", category: "Parts", cost: 780, keywords: ["door", "panel"] },
  { id: "p-mirror", name: "Side mirror assembly", category: "Parts", cost: 185, keywords: ["mirror", "side", "wing"] },
  { id: "p-windshield", name: "Windshield glass", category: "Parts", cost: 520, keywords: ["windshield", "windscreen", "glass", "crack"] },
  { id: "p-hood", name: "Hood panel", category: "Parts", cost: 540, keywords: ["hood", "bonnet"] },
  { id: "p-wheel", name: "Alloy wheel (single)", category: "Parts", cost: 320, keywords: ["wheel", "rim", "alloy"] },
  { id: "p-tire", name: "Tire replacement (single)", category: "Parts", cost: 180, keywords: ["tire", "tyre", "rubber"] },
  // Labor
  { id: "l-paint-panel", name: "Paint single panel", category: "Labor", cost: 420, keywords: ["paint", "panel", "respray", "color"], note: "incl. blend" },
  { id: "l-paint-full", name: "Full repaint", category: "Labor", cost: 2400, keywords: ["paint", "full", "respray"] },
  { id: "l-pdr", name: "Paintless dent repair", category: "Labor", cost: 220, keywords: ["dent", "pdr", "paintless", "ding"] },
  { id: "l-bodywork", name: "Bodywork & filler", category: "Labor", cost: 380, keywords: ["bodywork", "filler", "smooth", "shape"] },
  { id: "l-align", name: "Wheel alignment", category: "Labor", cost: 120, keywords: ["alignment", "wheel", "tracking"] },
  { id: "l-diag", name: "Diagnostic scan", category: "Labor", cost: 95, keywords: ["diagnostic", "scan", "obd", "check"] },
  { id: "l-detail", name: "Post-repair detailing", category: "Labor", cost: 140, keywords: ["detail", "clean", "polish", "wash"] },
  { id: "l-r-and-i", name: "Remove & reinstall trim", category: "Labor", cost: 160, keywords: ["remove", "reinstall", "r&i", "trim"] },
  // Damages (typical repair packages)
  { id: "d-scratch-light", name: "Light scratch repair", category: "Damage", cost: 180, keywords: ["scratch", "scuff", "light", "minor"] },
  { id: "d-scratch-deep", name: "Deep scratch repair", category: "Damage", cost: 480, keywords: ["scratch", "deep", "primer"] },
  { id: "d-dent-small", name: "Small dent repair", category: "Damage", cost: 250, keywords: ["dent", "small", "ding"] },
  { id: "d-dent-large", name: "Large dent + repaint", category: "Damage", cost: 720, keywords: ["dent", "large", "deep"] },
  { id: "d-crack-bumper", name: "Cracked bumper repair", category: "Damage", cost: 540, keywords: ["crack", "bumper", "split"] },
  { id: "d-glass-chip", name: "Windshield chip repair", category: "Damage", cost: 90, keywords: ["chip", "glass", "windshield", "rock"] },
];

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onPick: (item: CatalogItem) => void;
}

export function RepairCatalogSearch({ open, onOpenChange, onPick }: Props) {
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const score = (it: CatalogItem) => {
      if (!q) return 1;
      const hay = `${it.name} ${it.category} ${it.keywords.join(" ")}`.toLowerCase();
      // Token-AND: every word must appear somewhere
      const tokens = q.split(/\s+/).filter(Boolean);
      return tokens.every((t) => hay.includes(t)) ? 1 : 0;
    };
    const matched = REPAIR_CATALOG.filter((it) => score(it) > 0);
    return {
      Parts: matched.filter((i) => i.category === "Parts"),
      Labor: matched.filter((i) => i.category === "Labor"),
      Damage: matched.filter((i) => i.category === "Damage"),
    };
  }, [query]);

  const renderGroup = (
    heading: string,
    items: CatalogItem[],
    badge: "secondary" | "default" | "destructive",
  ) => {
    if (items.length === 0) return null;
    return (
      <CommandGroup heading={heading}>
        {items.map((it) => (
          <CommandItem
            key={it.id}
            value={`${it.name} ${it.keywords.join(" ")}`}
            onSelect={() => {
              onPick(it);
              setQuery("");
            }}
            className="flex items-center gap-3"
          >
            <Badge variant={badge} className="text-[10px] shrink-0">
              {it.category}
            </Badge>
            <div className="flex-1 min-w-0">
              <div className="text-sm truncate">{it.name}</div>
              {it.note && (
                <div className="text-[11px] text-muted-foreground truncate">{it.note}</div>
              )}
            </div>
            <span className="font-mono text-sm text-muted-foreground shrink-0">
              ${it.cost.toLocaleString()}
            </span>
          </CommandItem>
        ))}
      </CommandGroup>
    );
  };

  return (
    <CommandDialog open={open} onOpenChange={onOpenChange}>
      <CommandInput
        placeholder="Search parts, labor, or damages — e.g. 'cracked bumper', 'paint panel', 'headlight'…"
        value={query}
        onValueChange={setQuery}
      />
      <CommandList className="max-h-[420px]">
        <CommandEmpty>
          <div className="py-6 text-center text-sm">
            <p className="text-muted-foreground">No catalog match for "{query}".</p>
            <p className="text-xs text-muted-foreground mt-1">
              You can still add it manually from the line editor.
            </p>
          </div>
        </CommandEmpty>
        {renderGroup("Parts", filtered.Parts, "secondary")}
        {filtered.Parts.length > 0 && (filtered.Labor.length > 0 || filtered.Damage.length > 0) && (
          <CommandSeparator />
        )}
        {renderGroup("Labor", filtered.Labor, "default")}
        {filtered.Labor.length > 0 && filtered.Damage.length > 0 && <CommandSeparator />}
        {renderGroup("Damages", filtered.Damage, "destructive")}
      </CommandList>
      <div className="flex items-center justify-between gap-2 border-t px-3 py-2 text-[11px] text-muted-foreground">
        <span>↑↓ navigate · ↵ add · esc close</span>
        <Button
          size="sm"
          variant="ghost"
          className="h-6 text-[11px]"
          onClick={() => onOpenChange(false)}
        >
          Done
        </Button>
      </div>
    </CommandDialog>
  );
}
