import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { DamageAnnotator } from "./DamageAnnotator";
import { ExplainChat } from "./ExplainChat";
import demoImg1 from "@/assets/demo-damage-1.jpg";
import demoImg2 from "@/assets/demo-damage-2.jpg";

type Step = "start" | "intake" | "upload" | "processing" | "report" | "estimate" | "review" | "done";

type EstimateLine = { item: string; category: "Parts" | "Labor"; cost: number };

type Damage = {
  location: string;
  type: string;
  severity: "Low" | "Medium" | "High" | string;
  description: string;
  cost?: number; // per-damage estimated cost, agent-editable
  imageIndex?: number; // which preview image the marker belongs to
  x?: number; // 0-100 percentage
  y?: number; // 0-100 percentage
};
type LineItem = { item: string; cost: number };
type Assessment = {
  summary: string;
  damages: Damage[];
  estimatedCost: number;
  lineItems: LineItem[];
  mediaValidation: { status: string; notes: string };
  fraudRisk: { level: "Low" | "Medium" | "High" | string; reason: string };
  recommendation: string;
  confidence: number;
};

type ProcessingStep = { label: string; status: "pending" | "active" | "done" };

type ImageFile = { name: string; dataUrl: string };
type VideoFile = { name: string; dataUrl: string; frames: string[] };

const extractVideoFrames = (dataUrl: string, count = 3): Promise<string[]> =>
  new Promise((resolve) => {
    const video = document.createElement("video");
    video.src = dataUrl;
    video.muted = true;
    video.playsInline = true;
    video.crossOrigin = "anonymous";

    const frames: string[] = [];

    video.addEventListener("loadedmetadata", () => {
      const duration = video.duration || 0;
      if (!duration || !isFinite(duration)) {
        resolve([]);
        return;
      }
      // Pick timestamps at ~20%, 50%, 80% of duration
      const stops = Array.from({ length: count }, (_, i) => duration * ((i + 1) / (count + 1)));
      let idx = 0;

      const canvas = document.createElement("canvas");
      const w = video.videoWidth || 640;
      const h = video.videoHeight || 360;
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext("2d");

      const captureNext = () => {
        if (idx >= stops.length) {
          resolve(frames);
          return;
        }
        video.currentTime = stops[idx];
      };

      video.addEventListener("seeked", () => {
        if (ctx) {
          ctx.drawImage(video, 0, 0, w, h);
          frames.push(canvas.toDataURL("image/jpeg", 0.7));
        }
        idx += 1;
        captureNext();
      });

      captureNext();
    });

    video.addEventListener("error", () => resolve([]));
  });

const generateClaimId = () =>
  `CLM-${new Date().getFullYear()}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;

const fileToDataUrl = (file: File): Promise<string> =>
  new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result as string);
    r.onerror = reject;
    r.readAsDataURL(file);
  });

export function ClaimsCopilot() {
  const [step, setStep] = useState<Step>("start");
  const [claimId, setClaimId] = useState("");
  const [vehicleType, setVehicleType] = useState("");
  const [description, setDescription] = useState("");
  const [images, setImages] = useState<ImageFile[]>([]);
  const [video, setVideo] = useState<VideoFile | null>(null);
  const [extracting, setExtracting] = useState(false);
  const [loading, setLoading] = useState(false);
  const [assessment, setAssessment] = useState<Assessment | null>(null);
  const [decision, setDecision] = useState<"approved" | "rejected" | "pending_review" | null>(null);
  const [processingSteps, setProcessingSteps] = useState<ProcessingStep[]>([
    { label: "Validating media", status: "pending" },
    { label: "Detecting damage", status: "pending" },
    { label: "Estimating cost", status: "pending" },
  ]);
  const [estimateLines, setEstimateLines] = useState<EstimateLine[]>([]);

  const startClaim = () => {
    setClaimId(generateClaimId());
    setVehicleType("");
    setDescription("");
    setImages([]);
    setVideo(null);
    setAssessment(null);
    setDecision(null);
    setEstimateLines([]);
    setStep("intake");
  };

  const loadDemoClaim = () => {
    const demoAssessment: Assessment = {
      summary:
        "Front-end collision with moderate cosmetic and structural damage. Front bumper and headlight assembly require replacement; driver door panel can be repaired and repainted. Rear quarter panel shows secondary scrape damage consistent with the reported incident.",
      damages: [
        {
          location: "Front bumper",
          type: "Dent",
          severity: "High",
          description: "Deep crumple across the center of the front bumper, structural deformation visible.",
          cost: 1200,
          imageIndex: 0,
          x: 52,
          y: 58,
        },
        {
          location: "Driver-side door",
          type: "Scratch",
          severity: "Medium",
          description: "Long horizontal paint scratch running along the driver door panel.",
          cost: 480,
          imageIndex: 0,
          x: 18,
          y: 52,
        },
        {
          location: "Left headlight",
          type: "Broken Part",
          severity: "High",
          description: "Headlight assembly cracked and partially detached, requires replacement.",
          cost: 650,
          imageIndex: 0,
          x: 22,
          y: 38,
        },
        {
          location: "Rear quarter panel",
          type: "Paint Damage",
          severity: "Medium",
          description: "Paint scrape and shallow dent on the passenger-side rear quarter panel.",
          cost: 420,
          imageIndex: 1,
          x: 38,
          y: 55,
        },
      ],
      estimatedCost: 2750,
      lineItems: [
        { item: "Front bumper replacement", cost: 1200 },
        { item: "Headlight assembly", cost: 650 },
        { item: "Door panel paint & repair", cost: 480 },
        { item: "Rear quarter panel touch-up", cost: 420 },
        { item: "Labor (8 hours)", cost: 720 },
      ],
      mediaValidation: {
        status: "Sufficient coverage",
        notes: "Front and rear views provided with clear lighting. All reported damage areas are visible.",
      },
      fraudRisk: {
        level: "Low",
        reason: "Damage pattern matches reported incident; no inconsistencies detected.",
      },
      recommendation: "Approve",
      confidence: 87,
    };

    setClaimId(generateClaimId());
    setVehicleType("Sedan");
    setDescription(
      "Rear-ended at low speed in a parking lot, then pushed into a concrete barrier causing front-end damage. Driver and passenger uninjured.",
    );
    setImages([
      { name: "front-damage.jpg", dataUrl: demoImg1 },
      { name: "rear-damage.jpg", dataUrl: demoImg2 },
    ]);
    setVideo(null);
    setAssessment(demoAssessment);
    setDecision(null);
    setEstimateLines([
      { item: "Front bumper replacement", category: "Parts", cost: 1200 },
      { item: "Headlight assembly", category: "Parts", cost: 650 },
      { item: "Door panel paint & repair", category: "Parts", cost: 480 },
      { item: "Rear quarter panel touch-up", category: "Parts", cost: 420 },
      { item: "Labor (8 hours)", category: "Labor", cost: 720 },
    ]);
    setProcessingSteps([
      { label: "Validating media", status: "done" },
      { label: "Detecting damage", status: "done" },
      { label: "Estimating cost", status: "done" },
    ]);
    setStep("estimate");
    toast.success("Demo claim loaded — ready for review");
  };

  const submitIntake = (e: React.FormEvent) => {
    e.preventDefault();
    if (!vehicleType || !description.trim()) {
      toast.error("Please fill out claim details");
      return;
    }
    if (images.length === 0 && !video) {
      toast.error("Please upload at least one photo or video");
      return;
    }
    runAssessment();
  };

  const handleImages = async (files: FileList | null) => {
    if (!files) return;
    const arr = Array.from(files).filter((f) => f.type.startsWith("image/"));
    const loaded = await Promise.all(
      arr.map(async (f) => ({ name: f.name, dataUrl: await fileToDataUrl(f) })),
    );
    setImages((prev) => [...prev, ...loaded].slice(0, 8));
  };

  const handleVideo = async (files: FileList | null) => {
    if (!files || !files[0]) return;
    const f = files[0];
    if (!f.type.startsWith("video/")) {
      toast.error("Please select a video file");
      return;
    }
    setExtracting(true);
    try {
      const dataUrl = await fileToDataUrl(f);
      const frames = await extractVideoFrames(dataUrl, 3);
      setVideo({ name: f.name, dataUrl, frames });
      toast.success(`Extracted ${frames.length} key frames`);
    } catch {
      toast.error("Could not process video");
    } finally {
      setExtracting(false);
    }
  };

  const runAssessment = async () => {
    setLoading(true);
    setStep("processing");
    const initial: ProcessingStep[] = [
      { label: "Validating media", status: "active" },
      { label: "Detecting damage", status: "pending" },
      { label: "Estimating cost", status: "pending" },
    ];
    setProcessingSteps(initial);

    // Animate the checklist while the AI request runs
    const t1 = setTimeout(() => {
      setProcessingSteps([
        { label: "Validating media", status: "done" },
        { label: "Detecting damage", status: "active" },
        { label: "Estimating cost", status: "pending" },
      ]);
    }, 900);
    const t2 = setTimeout(() => {
      setProcessingSteps([
        { label: "Validating media", status: "done" },
        { label: "Detecting damage", status: "done" },
        { label: "Estimating cost", status: "active" },
      ]);
    }, 2200);

    try {
      const allImages = [
        ...images.map((m) => m.dataUrl),
        ...(video?.frames ?? []),
      ];
      const { data, error } = await supabase.functions.invoke("assess-claim", {
        body: { vehicleType, description, images: allImages },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      setProcessingSteps([
        { label: "Validating media", status: "done" },
        { label: "Detecting damage", status: "done" },
        { label: "Estimating cost", status: "done" },
      ]);
      // Brief pause so the user sees all steps complete
      await new Promise((r) => setTimeout(r, 400));
      // Auto-assign default marker positions to AI-detected damages so they
      // immediately appear on the preview panel and can be repositioned later.
      const totalImages = images.length + (video?.frames.length ?? 0);
      const rawDamages: Damage[] = data.assessment.damages || [];
      // Distribute AI total across damages weighted by severity, so each
      // damage has an editable cost the agent can tune.
      const weight = (s: string) => (s === "High" ? 3 : s === "Medium" ? 2 : 1);
      const totalWeight = rawDamages.reduce((sum, d) => sum + weight(d.severity), 0) || 1;
      const aiTotal = Number(data.assessment.estimatedCost) || 0;
      const annotated: Assessment = {
        ...data.assessment,
        damages: rawDamages.map((d, i) => ({
          ...d,
          cost: Math.round((aiTotal * weight(d.severity)) / totalWeight),
          imageIndex: totalImages > 0 ? i % totalImages : 0,
          x: 25 + ((i * 17) % 50),
          y: 25 + ((i * 23) % 50),
        })),
      };
      setAssessment(annotated);
      setStep("report");
    } catch (e: any) {
      toast.error(e.message || "Assessment failed");
      setStep("intake");
    } finally {
      clearTimeout(t1);
      clearTimeout(t2);
      setLoading(false);
    }
  };

  const generateEstimate = () => {
    if (!assessment) return;
    // Categorize AI line items into Parts vs Labor heuristically.
    const partsKeywords = /(part|panel|bumper|fender|hood|door|glass|light|mirror|paint|trim|grille|wheel|tire|sensor|airbag|radiator)/i;
    const labor: EstimateLine[] = [];
    const parts: EstimateLine[] = [];
    assessment.lineItems.forEach((li) => {
      const isLabor = /labor|labour|hours?|install|repair time|paint(ing)? labor/i.test(li.item);
      const isPart = partsKeywords.test(li.item);
      if (isLabor && !isPart) {
        labor.push({ item: li.item, category: "Labor", cost: li.cost });
      } else if (isPart) {
        parts.push({ item: li.item, category: "Parts", cost: li.cost });
      } else {
        // Default unknown items to Parts; include a small labor bucket if missing
        parts.push({ item: li.item, category: "Parts", cost: li.cost });
      }
    });
    if (labor.length === 0) {
      // Add a default labor line so the agent can edit it
      const partsTotal = parts.reduce((s, l) => s + l.cost, 0);
      labor.push({ item: "Repair labor", category: "Labor", cost: Math.round(partsTotal * 0.35) });
    }
    setEstimateLines([...parts, ...labor]);
    setStep("estimate");
  };

  const updateLine = (idx: number, patch: Partial<EstimateLine>) => {
    setEstimateLines((prev) =>
      prev.map((l, i) => (i === idx ? { ...l, ...patch } : l)),
    );
  };

  const removeLine = (idx: number) => {
    setEstimateLines((prev) => prev.filter((_, i) => i !== idx));
  };

  const addLine = (category: "Parts" | "Labor") => {
    setEstimateLines((prev) => [...prev, { item: "New item", category, cost: 0 }]);
  };

  const updateDamage = (idx: number, patch: Partial<Damage>) => {
    setAssessment((prev) =>
      prev
        ? { ...prev, damages: prev.damages.map((d, i) => (i === idx ? { ...d, ...patch } : d)) }
        : prev,
    );
  };

  const removeDamage = (idx: number) => {
    setAssessment((prev) =>
      prev ? { ...prev, damages: prev.damages.filter((_, i) => i !== idx) } : prev,
    );
  };

  const addDamage = (imageIndex: number, x: number, y: number) => {
    setAssessment((prev) => {
      if (!prev) return prev;
      const newDamage: Damage = {
        location: "New location",
        type: "Dent",
        severity: "Medium",
        description: "Manually added damage",
        cost: 0,
        imageIndex,
        x,
        y,
      };
      return { ...prev, damages: [...prev.damages, newDamage] };
    });
  };

  const finalize = (choice: "approved" | "rejected" | "pending_review") => {
    setDecision(choice);
    setStep("done");
    toast.success(
      choice === "approved"
        ? "Claim approved"
        : choice === "pending_review"
          ? "Claim sent for senior review"
          : "Claim rejected",
    );
  };

  // Compute recommended next steps based on the current claim state.
  const getNextSteps = (): { label: string; tone: "default" | "warn" | "danger" | "good" }[] => {
    const steps: { label: string; tone: "default" | "warn" | "danger" | "good" }[] = [];
    if (!assessment) return steps;
    if (assessment.fraudRisk.level === "High") {
      steps.push({ label: "Potential fraud — escalate to SIU before approving", tone: "danger" });
    } else if (assessment.fraudRisk.level === "Medium") {
      steps.push({ label: "Medium fraud risk — verify policy details and incident report", tone: "warn" });
    }
    if (assessment.confidence < 70) {
      steps.push({
        label: `Low AI confidence (${assessment.confidence}%) — escalate or request manual inspection`,
        tone: "warn",
      });
    }
    if (assessment.mediaValidation.status !== "Sufficient coverage") {
      steps.push({ label: "Request additional images of missing angles", tone: "warn" });
    }
    if (assessment.damages.some((d) => d.severity === "High")) {
      steps.push({ label: "High-severity damage detected — confirm parts availability", tone: "default" });
    }
    if (step === "report") {
      steps.push({ label: "Generate the cost estimate to continue", tone: "default" });
    }
    if (step === "estimate" || step === "review") {
      if (assessment.fraudRisk.level !== "High" && assessment.confidence >= 70) {
        steps.push({ label: "Approve estimate and finalize claim", tone: "good" });
      }
    }
    if (steps.length === 0) {
      steps.push({ label: "All checks look clean — proceed to approval", tone: "good" });
    }
    return steps;
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b">
        <div className="mx-auto max-w-4xl px-6 py-4 flex items-center justify-between">
          <h1 className="text-lg font-semibold">AI Claims Copilot</h1>
          {step !== "start" && (
            <div className="flex items-center gap-3 text-sm text-muted-foreground">
              <span className="font-mono">{claimId}</span>
              <Button variant="ghost" size="sm" onClick={() => setStep("start")}>
                Exit
              </Button>
            </div>
          )}
        </div>
        {step !== "start" && (
          <Stepper
            step={step}
            hasMedia={images.length > 0 || !!video}
            hasAssessment={!!assessment}
            hasEstimate={estimateLines.length > 0}
            decision={decision}
          />
        )}
      </header>

      <main key={step} className="mx-auto max-w-4xl px-6 py-8 animate-in fade-in duration-300">
        {step === "start" && (
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <h2 className="text-3xl font-bold mb-3">Process insurance claims faster</h2>
            <p className="text-muted-foreground mb-8 max-w-md">
              Intake a claim, upload damage photos, and let AI generate an assessment and estimate
              for your review.
            </p>
            <div className="flex flex-col sm:flex-row gap-3">
              <Button size="lg" onClick={startClaim}>
                Create New Claim
              </Button>
              <Button size="lg" variant="outline" onClick={loadDemoClaim}>
                Load Demo Claim
              </Button>
            </div>
            <p className="text-xs text-muted-foreground mt-4">
              Demo loads a pre-filled sedan collision claim with photos, AI assessment, and estimate
              ready to review.
            </p>
          </div>
        )}

        {step === "intake" && (
          <Card className="p-6">
            <h2 className="text-xl font-semibold mb-1">Create Claim</h2>
            <p className="text-sm text-muted-foreground mb-6">Step 1 of 4 — Claim details and damage media</p>
            <form onSubmit={submitIntake} className="space-y-4">
              <div>
                <Label>Claim ID</Label>
                <Input value={claimId} readOnly className="font-mono mt-1.5 bg-muted" />
              </div>
              <div>
                <Label htmlFor="vehicle">Vehicle Type</Label>
                <Select value={vehicleType} onValueChange={setVehicleType}>
                  <SelectTrigger id="vehicle" className="mt-1.5">
                    <SelectValue placeholder="Select vehicle type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Sedan">Sedan</SelectItem>
                    <SelectItem value="SUV">SUV</SelectItem>
                    <SelectItem value="Truck">Truck</SelectItem>
                    <SelectItem value="Van">Van</SelectItem>
                    <SelectItem value="Motorcycle">Motorcycle</SelectItem>
                    <SelectItem value="Other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="desc">Incident Description</Label>
                <Textarea
                  id="desc"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Describe what happened..."
                  rows={4}
                  className="mt-1.5"
                />
              </div>

              <div className="border-t pt-5">
                <h3 className="font-medium mb-1">Damage Media</h3>
                <p className="text-sm text-muted-foreground mb-4">Add damage photos and (optionally) one video</p>

                <div className="grid md:grid-cols-2 gap-4">
                  <div>
                    <Label className="mb-1.5 block">Images</Label>
                    <label className="block border-2 border-dashed rounded-md p-6 text-center cursor-pointer hover:bg-muted/50">
                      <input
                        type="file"
                        accept="image/*"
                        multiple
                        className="hidden"
                        onChange={(e) => handleImages(e.target.files)}
                      />
                      <p className="text-sm text-muted-foreground">
                        Click to select images (multiple allowed)
                      </p>
                    </label>
                  </div>

                  <div>
                    <Label className="mb-1.5 block">Video (optional)</Label>
                    <label className="block border-2 border-dashed rounded-md p-6 text-center cursor-pointer hover:bg-muted/50">
                      <input
                        type="file"
                        accept="video/*"
                        className="hidden"
                        onChange={(e) => handleVideo(e.target.files)}
                      />
                      <p className="text-sm text-muted-foreground">
                        {extracting ? "Extracting key frames..." : "Click to select one video file"}
                      </p>
                    </label>
                  </div>
                </div>

                {(images.length > 0 || video) && (
                  <div className="mt-5 space-y-5">
                    <div className="flex items-center gap-2">
                      <Badge>Media Uploaded</Badge>
                      <span className="text-sm text-muted-foreground">
                        {images.length} image{images.length === 1 ? "" : "s"}
                        {video ? ` · 1 video (${video.frames.length} key frames)` : ""}
                      </span>
                    </div>

                    {images.length > 0 && (
                      <div>
                        <h4 className="text-sm font-medium mb-2">Images</h4>
                        <div className="grid grid-cols-4 gap-3">
                          {images.map((m, i) => (
                            <div
                              key={i}
                              className="relative aspect-square rounded-md overflow-hidden bg-muted"
                            >
                              <img
                                src={m.dataUrl}
                                alt={m.name}
                                className="w-full h-full object-cover"
                              />
                              <button
                                type="button"
                                onClick={() =>
                                  setImages((prev) => prev.filter((_, idx) => idx !== i))
                                }
                                className="absolute top-1 right-1 bg-background/80 rounded px-1.5 text-xs"
                              >
                                ✕
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {video && (
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <h4 className="text-sm font-medium">
                            Video key frames —{" "}
                            <span className="text-muted-foreground font-normal">{video.name}</span>
                          </h4>
                          <button
                            type="button"
                            onClick={() => setVideo(null)}
                            className="text-xs text-muted-foreground hover:text-foreground"
                          >
                            Remove video
                          </button>
                        </div>
                        {video.frames.length > 0 ? (
                          <div className="grid grid-cols-3 gap-3">
                            {video.frames.map((src, i) => (
                              <div
                                key={i}
                                className="relative aspect-video rounded-md overflow-hidden bg-muted border"
                              >
                                <img
                                  src={src}
                                  alt={`Frame ${i + 1}`}
                                  className="w-full h-full object-cover"
                                />
                                <span className="absolute bottom-1 left-1 bg-background/80 rounded px-1.5 text-[10px] font-mono">
                                  Frame {i + 1}
                                </span>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <p className="text-sm text-muted-foreground">
                            Could not extract frames from this video.
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div className="flex justify-end pt-2">
                <Button type="submit" disabled={extracting}>
                  Create Claim and run AI Assessment
                </Button>
              </div>
            </form>
          </Card>
        )}

        {step === "processing" && loading && (
          <Card className="p-8">
            <h2 className="text-xl font-semibold mb-1">AI Processing</h2>
            <p className="text-sm text-muted-foreground mb-6">
              Step 2 of 4 — Running automated analysis on your media
            </p>
            <ul className="space-y-3">
              {processingSteps.map((s, i) => (
                <li key={i} className="flex items-center gap-3">
                  <span
                    className={`w-6 h-6 rounded-full flex items-center justify-center text-xs ${
                      s.status === "done"
                        ? "bg-primary text-primary-foreground"
                        : s.status === "active"
                          ? "border-2 border-primary"
                          : "border border-muted-foreground/30 text-muted-foreground"
                    }`}
                  >
                    {s.status === "done" ? (
                      "✓"
                    ) : s.status === "active" ? (
                      <span className="w-2 h-2 rounded-full bg-primary animate-pulse" />
                    ) : (
                      i + 1
                    )}
                  </span>
                  <span
                    className={`text-sm ${
                      s.status === "pending"
                        ? "text-muted-foreground"
                        : s.status === "active"
                          ? "font-medium"
                          : ""
                    }`}
                  >
                    {s.label}
                  </span>
                  {s.status === "active" && (
                    <span className="text-xs text-muted-foreground ml-auto">in progress…</span>
                  )}
                </li>
              ))}
            </ul>
          </Card>
        )}

        {step === "report" && assessment && (
          <div className="space-y-4">
            {/* Damage Validation & Preview */}
            <Card className="p-6">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h2 className="text-xl font-semibold">Damage Validation &amp; Preview</h2>
                  <p className="text-sm text-muted-foreground">Step 2 of 4 — The AI checks the uploaded media for clarity, sufficiency, and integrity, then highlights detected damage for your review.</p>
                </div>
                <Badge variant="outline">Confidence: {assessment.confidence}%</Badge>
              </div>
              <p className="text-sm leading-relaxed">{assessment.summary}</p>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-5">
                <div className="rounded border p-3">
                  <div className="text-xs text-muted-foreground mb-1">Media Validation</div>
                  <Badge
                    variant={
                      assessment.mediaValidation.status === "Sufficient coverage"
                        ? "default"
                        : "secondary"
                    }
                  >
                    {assessment.mediaValidation.status}
                  </Badge>
                  <p className="text-xs text-muted-foreground mt-2">
                    {assessment.mediaValidation.notes}
                  </p>
                </div>
                <div className="rounded border p-3">
                  <div className="text-xs text-muted-foreground mb-1">Fraud Risk</div>
                  <Badge
                    variant={
                      assessment.fraudRisk.level === "High"
                        ? "destructive"
                        : assessment.fraudRisk.level === "Medium"
                          ? "default"
                          : "secondary"
                    }
                  >
                    {assessment.fraudRisk.level}
                  </Badge>
                  <p className="text-xs text-muted-foreground mt-2">
                    {assessment.fraudRisk.reason}
                  </p>
                </div>
                <div className="rounded border p-3">
                  <div className="text-xs text-muted-foreground mb-1">Confidence Score</div>
                  <div className="text-2xl font-semibold">{assessment.confidence}%</div>
                  <div className="h-1.5 bg-muted rounded mt-2 overflow-hidden">
                    <div
                      className="h-full bg-primary"
                      style={{ width: `${assessment.confidence}%` }}
                    />
                  </div>
                </div>
              </div>

              {/* Unhappy-path media validation: actionable CTAs per recommendation */}
              {assessment.mediaValidation.status !== "Sufficient coverage" && (
                <div className="mt-5 rounded-lg border border-amber-500/40 bg-amber-500/5 p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <Badge variant="default" className="bg-amber-500 hover:bg-amber-500">Action needed</Badge>
                    <h3 className="text-sm font-medium">Media coverage recommendations</h3>
                  </div>
                  <ul className="space-y-2">
                    {[
                      { label: "Request additional photos from the policyholder", action: "request-photos" },
                      { label: "Upload more images now", action: "upload-more" },
                      { label: "Schedule an in-person inspection", action: "schedule-inspection" },
                    ].map((rec) => (
                      <li key={rec.action} className="flex items-center justify-between gap-3 text-sm bg-background rounded-md border p-2.5">
                        <span>{rec.label}</span>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            if (rec.action === "upload-more") {
                              setStep("intake");
                            } else if (rec.action === "request-photos") {
                              toast.success("Photo request sent to policyholder");
                            } else {
                              toast.success("Inspection scheduling request created");
                            }
                          }}
                        >
                          {rec.action === "upload-more" ? "Upload" : rec.action === "request-photos" ? "Send request" : "Schedule"}
                        </Button>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              <div className="mt-6 mb-3 flex items-center justify-between gap-3">
                <h3 className="font-medium text-sm">Damage Preview &amp; Annotations</h3>
                <Badge variant="secondary" className="text-[10px]">⚡ AI-generated cost estimates · review &amp; adjust</Badge>
              </div>
              <DamageAnnotator
                previews={[
                  ...images.map((m, i) => ({ src: m.dataUrl, label: `Image ${i + 1}` })),
                  ...(video?.frames ?? []).map((src, i) => ({
                    src,
                    label: `Video frame ${i + 1}`,
                  })),
                ]}
                damages={assessment.damages}
                onAdd={addDamage}
                onUpdate={updateDamage}
                onRemove={removeDamage}
              />

              <div className="flex justify-end mt-6">
                <Button onClick={generateEstimate}>Continue to Cost Estimate</Button>
              </div>
            </Card>
          </div>
        )}

        {step === "estimate" && assessment && (
          <div className="space-y-4">
            {(() => {
              const partsTotal = estimateLines
                .filter((l) => l.category === "Parts")
                .reduce((s, l) => s + (Number(l.cost) || 0), 0);
              const laborTotal = estimateLines
                .filter((l) => l.category === "Labor")
                .reduce((s, l) => s + (Number(l.cost) || 0), 0);
              const damagesTotal = assessment.damages.reduce(
                (s, d) => s + (Number(d.cost) || 0),
                0,
              );
              const total = partsTotal + laborTotal + damagesTotal;
              return (
                <Card className="p-6">
                  <h2 className="text-xl font-semibold mb-1">Cost Estimate Validation</h2>
                  <p className="text-sm text-muted-foreground mb-4">
                    Step 3 of 4 — Review and edit each damage marker, parts, and labor line
                  </p>

                  {/* Damage markers as editable line items */}
                  <div className="mb-5">
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="font-medium text-sm">Damage Markers</h3>
                      <span className="text-xs text-muted-foreground">{assessment.damages.length} item{assessment.damages.length === 1 ? "" : "s"}</span>
                    </div>
                    {assessment.damages.length === 0 ? (
                      <p className="text-xs text-muted-foreground italic">No damage markers recorded.</p>
                    ) : (
                      <div className="space-y-2">
                        {assessment.damages.map((d, i) => (
                          <div key={i} className="flex items-center gap-2 p-2 rounded border">
                            <span
                              className={`w-6 h-6 rounded-full text-xs font-bold flex items-center justify-center shrink-0 ${
                                d.severity === "High"
                                  ? "bg-destructive text-destructive-foreground"
                                  : d.severity === "Medium"
                                    ? "bg-amber-500 text-white"
                                    : "bg-emerald-500 text-white"
                              }`}
                            >
                              {i + 1}
                            </span>
                            <Input
                              value={d.location}
                              onChange={(e) => updateDamage(i, { location: e.target.value })}
                              className="flex-1 min-w-0"
                              placeholder="Location"
                            />
                            <Badge
                              variant={
                                d.severity === "High"
                                  ? "destructive"
                                  : d.severity === "Medium"
                                    ? "default"
                                    : "secondary"
                              }
                              className="hidden sm:inline-flex"
                            >
                              {d.severity}
                            </Badge>
                            <div className="flex items-center">
                              <span className="text-sm text-muted-foreground mr-1">$</span>
                              <Input
                                type="number"
                                value={d.cost ?? 0}
                                onChange={(e) => updateDamage(i, { cost: Number(e.target.value) || 0 })}
                                className="w-24 text-right font-mono"
                              />
                            </div>
                            <button
                              onClick={() => removeDamage(i)}
                              className="text-muted-foreground hover:text-destructive text-sm px-2"
                              aria-label="Remove damage"
                            >
                              ✕
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {(["Parts", "Labor"] as const).map((cat) => {
                    const lines = estimateLines
                      .map((l, i) => ({ l, i }))
                      .filter(({ l }) => l.category === cat);
                    const subtotal = lines.reduce((s, { l }) => s + (Number(l.cost) || 0), 0);
                    return (
                      <div key={cat} className="mb-5">
                        <div className="flex items-center justify-between mb-2">
                          <h3 className="font-medium text-sm">{cat}</h3>
                          <button
                            onClick={() => addLine(cat)}
                            className="text-xs text-muted-foreground hover:text-foreground"
                          >
                            + Add line
                          </button>
                        </div>
                        {lines.length === 0 && (
                          <p className="text-xs text-muted-foreground italic">No {cat.toLowerCase()} items.</p>
                        )}
                        <div className="space-y-2">
                          {lines.map(({ l, i }) => (
                            <div key={i} className="flex items-center gap-2">
                              <Input
                                value={l.item}
                                onChange={(e) => updateLine(i, { item: e.target.value })}
                                className="flex-1"
                              />
                              <div className="flex items-center">
                                <span className="text-sm text-muted-foreground mr-1">$</span>
                                <Input
                                  type="number"
                                  value={l.cost}
                                  onChange={(e) =>
                                    updateLine(i, { cost: Number(e.target.value) || 0 })
                                  }
                                  className="w-28 text-right font-mono"
                                />
                              </div>
                              <button
                                onClick={() => removeLine(i)}
                                className="text-muted-foreground hover:text-destructive text-sm px-2"
                                aria-label="Remove line"
                              >
                                ✕
                              </button>
                            </div>
                          ))}
                        </div>
                        <div className="text-xs text-muted-foreground text-right mt-2">
                          {cat} subtotal:{" "}
                          <span className="font-mono">${subtotal.toLocaleString()}</span>
                        </div>
                      </div>
                    );
                  })}

                  {damagesTotal > 0 && (
                    <div className="flex items-center justify-between text-sm pb-2 border-b mb-2">
                      <span className="text-muted-foreground">Damage markers subtotal</span>
                      <span className="font-mono">${damagesTotal.toLocaleString()}</span>
                    </div>
                  )}
                  <div className="border-t pt-3 flex items-center justify-between">
                    <span className="font-semibold">Total Estimated Cost</span>
                    <span className="font-mono text-lg font-semibold">
                      ${total.toLocaleString()}
                    </span>
                  </div>
                  <div className="mt-3 text-xs text-muted-foreground">
                    AI suggested ${assessment.estimatedCost.toLocaleString()} ·
                    Recommendation:{" "}
                    <Badge variant="outline" className="ml-1">
                      {assessment.recommendation}
                    </Badge>
                  </div>
                </Card>
              );
            })()}

            {/* Recommended Next Steps — visible from report onward */}
            <Card className="p-6">
              <h2 className="text-xl font-semibold mb-1">Recommended Next Steps</h2>
              <p className="text-sm text-muted-foreground mb-4">
                Based on AI confidence, fraud signals, and media coverage
              </p>
              <ul className="space-y-2">
                {getNextSteps().map((s, i) => (
                  <li
                    key={i}
                    className={`flex items-start gap-2 p-3 rounded border text-sm ${
                      s.tone === "danger"
                        ? "border-destructive/40 bg-destructive/5"
                        : s.tone === "warn"
                          ? "border-amber-500/40 bg-amber-500/5"
                          : s.tone === "good"
                            ? "border-emerald-500/40 bg-emerald-500/5"
                            : "border-border"
                    }`}
                  >
                    <span
                      className={`mt-0.5 ${
                        s.tone === "danger"
                          ? "text-destructive"
                          : s.tone === "warn"
                            ? "text-amber-600"
                            : s.tone === "good"
                              ? "text-emerald-600"
                              : "text-muted-foreground"
                      }`}
                    >
                      ●
                    </span>
                    <span>{s.label}</span>
                  </li>
                ))}
              </ul>
            </Card>

            <Card className="p-6">
              <h2 className="text-xl font-semibold mb-1">Submit for Final Approval</h2>
              <p className="text-sm text-muted-foreground mb-4">
                Step 4 of 4 — Forward this validated estimate to the claims adjuster for the final decision
              </p>
              <div className="flex flex-col sm:flex-row gap-3">
                <Button variant="outline" onClick={() => setStep("report")} className="sm:w-auto">
                  Back to damage validation
                </Button>
                <Button
                  onClick={() => finalize("pending_review")}
                  className="flex-1"
                  size="lg"
                >
                  Submit for Final Approval
                </Button>
              </div>
            </Card>
          </div>
        )}

        {step === "done" && (
          <div className="space-y-4">
            <Card className="p-8 text-center">
              <div className="text-4xl mb-3">⌛</div>
              <h2 className="text-2xl font-semibold mb-2">Final Overview</h2>
              <p className="text-muted-foreground font-mono text-sm">{claimId}</p>
              <p className="text-muted-foreground mt-2 text-sm">
                Submitted to the claims adjuster for final approval.
              </p>
            </Card>

            {assessment && (
              <Card className="p-6">
                <h2 className="text-xl font-semibold mb-4">Claim Summary</h2>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-6">
                  <div className="rounded border p-3">
                    <div className="text-xs text-muted-foreground mb-1">Vehicle</div>
                    <div className="font-medium">{vehicleType}</div>
                  </div>
                  <div className="rounded border p-3">
                    <div className="text-xs text-muted-foreground mb-1">Decision</div>
                    <Badge
                      variant={
                        decision === "approved"
                          ? "default"
                          : decision === "pending_review"
                            ? "secondary"
                            : "destructive"
                      }
                    >
                      {decision === "approved"
                        ? "Approved"
                        : decision === "pending_review"
                          ? "Pending Review"
                          : "Rejected"}
                    </Badge>
                  </div>
                  <div className="rounded border p-3">
                    <div className="text-xs text-muted-foreground mb-1">AI Confidence</div>
                    <div className="font-medium">{assessment.confidence}%</div>
                  </div>
                </div>

                <h3 className="font-medium text-sm mb-2">Final Damage Report</h3>
                {assessment.damages.length === 0 ? (
                  <p className="text-xs text-muted-foreground italic mb-4">No damages recorded.</p>
                ) : (
                  <div className="space-y-1.5 mb-6">
                    {assessment.damages.map((d, i) => (
                      <div
                        key={i}
                        className="flex items-center justify-between text-sm p-2 rounded border"
                      >
                        <div className="flex-1 min-w-0">
                          <div className="font-medium truncate">{d.location}</div>
                          <div className="text-xs text-muted-foreground">{d.type}</div>
                        </div>
                        <Badge
                          variant={
                            d.severity === "High"
                              ? "destructive"
                              : d.severity === "Medium"
                                ? "default"
                                : "secondary"
                          }
                          className="mr-3"
                        >
                          {d.severity}
                        </Badge>
                        <span className="font-mono text-sm w-24 text-right">
                          ${(d.cost ?? 0).toLocaleString()}
                        </span>
                      </div>
                    ))}
                  </div>
                )}

                <h3 className="font-medium text-sm mb-2">Final Cost Estimate</h3>
                {(() => {
                  const partsTotal = estimateLines
                    .filter((l) => l.category === "Parts")
                    .reduce((s, l) => s + (Number(l.cost) || 0), 0);
                  const laborTotal = estimateLines
                    .filter((l) => l.category === "Labor")
                    .reduce((s, l) => s + (Number(l.cost) || 0), 0);
                  const damagesTotal = assessment.damages.reduce(
                    (s, d) => s + (Number(d.cost) || 0),
                    0,
                  );
                  const total = partsTotal + laborTotal + damagesTotal;
                  return (
                    <div className="space-y-1 text-sm">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Parts</span>
                        <span className="font-mono">${partsTotal.toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Labor</span>
                        <span className="font-mono">${laborTotal.toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Damage markers</span>
                        <span className="font-mono">${damagesTotal.toLocaleString()}</span>
                      </div>
                      <div className="border-t pt-2 mt-2 flex justify-between font-semibold">
                        <span>
                          {decision === "approved" ? "Approved Payout" : "Total Estimate"}
                        </span>
                        <span className="font-mono text-lg">${total.toLocaleString()}</span>
                      </div>
                    </div>
                  );
                })()}
              </Card>
            )}

            <div className="flex justify-center">
              <Button onClick={startClaim}>Create Another Claim</Button>
            </div>
          </div>
        )}
      </main>

      {assessment && step !== "start" && (
        <ExplainChat
          context={{
            claimId,
            vehicleType,
            description,
            step,
            assessment,
            estimateLines,
            decision,
          }}
        />
      )}
    </div>
  );
}

function Stepper({
  step,
  hasMedia,
  hasAssessment,
  hasEstimate,
  decision,
}: {
  step: Step;
  hasMedia: boolean;
  hasAssessment: boolean;
  hasEstimate: boolean;
  decision: "approved" | "rejected" | "pending_review" | null;
}) {
  // 4-stage workflow.
  const stages = [
    { key: "created", label: "Create Claim" },
    { key: "assessed", label: "Review Damage" },
    { key: "estimate", label: "Cost Estimate" },
    { key: "final", label: "Track Claim Status" },
  ];

  // Determine which stage is currently active.
  let activeIndex = 0;
  if (step === "intake") activeIndex = 0;
  else if (step === "processing" || step === "report") activeIndex = 1;
  else if (step === "estimate" || step === "review") activeIndex = 2;
  else if (step === "done") activeIndex = 3;

  // A stage is done if the workflow has progressed past it.
  const isDone = (i: number) => {
    if (step === "done" && i < 3) return true;
    if (i === 0) return hasMedia && step !== "intake";
    if (i === 1) return hasAssessment && (step === "estimate" || step === "review" || step === "done");
    if (i === 2) return hasEstimate && step === "done";
    return false;
  };

  return (
    <div className="mx-auto max-w-4xl px-6 pb-3 overflow-x-auto">
      <div className="flex gap-1 text-xs min-w-fit">
        {stages.map((s, i) => {
          const done = isDone(i);
          const current = i === activeIndex && step !== "done";
          const isFinalDone = i === 3 && step === "done";
          return (
            <div key={s.key} className="flex items-center gap-2 flex-1 min-w-[120px]">
              <div
                className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-medium shrink-0 ${
                  isFinalDone
                    ? "bg-amber-500 text-white"
                    : done
                      ? "bg-primary text-primary-foreground"
                      : current
                        ? "bg-foreground text-background"
                        : "bg-muted text-muted-foreground"
                }`}
              >
                {done || isFinalDone ? "✓" : i + 1}
              </div>
              <span
                className={`truncate ${
                  current ? "font-medium" : isFinalDone ? "font-medium" : "text-muted-foreground"
                }`}
              >
                {s.label}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

