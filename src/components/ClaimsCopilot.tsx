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

type Step = "start" | "intake" | "upload" | "processing" | "report" | "estimate" | "review" | "done";

type EstimateLine = { item: string; category: "Parts" | "Labor"; cost: number };

type Damage = {
  location: string;
  type: string;
  severity: "Low" | "Medium" | "High" | string;
  description: string;
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
  const [decision, setDecision] = useState<"approved" | "rejected" | null>(null);
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

  const submitIntake = (e: React.FormEvent) => {
    e.preventDefault();
    if (!vehicleType || !description.trim()) {
      toast.error("Please fill out all fields");
      return;
    }
    setStep("upload");
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
      setAssessment(data.assessment);
      setStep("report");
    } catch (e: any) {
      toast.error(e.message || "Assessment failed");
      setStep("upload");
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

  const finalize = (choice: "approved" | "rejected") => {
    setDecision(choice);
    setStep("done");
    toast.success(`Claim ${choice}`);
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
        {step !== "start" && <Stepper step={step} />}
      </header>

      <main className="mx-auto max-w-4xl px-6 py-8">
        {step === "start" && (
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <h2 className="text-3xl font-bold mb-3">Process insurance claims faster</h2>
            <p className="text-muted-foreground mb-8 max-w-md">
              Intake a claim, upload damage photos, and let AI generate an assessment and estimate
              for your review.
            </p>
            <Button size="lg" onClick={startClaim}>
              Create New Claim
            </Button>
          </div>
        )}

        {step === "intake" && (
          <Card className="p-6">
            <h2 className="text-xl font-semibold mb-1">Claim Intake</h2>
            <p className="text-sm text-muted-foreground mb-6">Step 1 of 5 — Basic information</p>
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
                  rows={5}
                  className="mt-1.5"
                />
              </div>
              <div className="flex justify-end">
                <Button type="submit">Continue</Button>
              </div>
            </form>
          </Card>
        )}

        {step === "upload" && (
          <Card className="p-6">
            <h2 className="text-xl font-semibold mb-1">Upload Media</h2>
            <p className="text-sm text-muted-foreground mb-6">
              Step 2 of 5 — Add damage photos and (optionally) one video
            </p>

            <div className="grid md:grid-cols-2 gap-4">
              {/* Images uploader */}
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

              {/* Video uploader */}
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
              <div className="mt-6 space-y-5">
                <div className="flex items-center gap-2">
                  <Badge>Media Uploaded</Badge>
                  <span className="text-sm text-muted-foreground">
                    {images.length} image{images.length === 1 ? "" : "s"}
                    {video ? ` · 1 video (${video.frames.length} key frames)` : ""}
                  </span>
                </div>

                {images.length > 0 && (
                  <div>
                    <h3 className="text-sm font-medium mb-2">Images</h3>
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
                      <h3 className="text-sm font-medium">
                        Video key frames —{" "}
                        <span className="text-muted-foreground font-normal">{video.name}</span>
                      </h3>
                      <button
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

            <div className="flex justify-between mt-6">
              <Button variant="outline" onClick={() => setStep("intake")}>
                Back
              </Button>
              <Button
                onClick={runAssessment}
                disabled={images.length === 0 && !video}
              >
                Run AI Assessment
              </Button>
            </div>
          </Card>
        )}

        {step === "processing" && loading && (
          <Card className="p-8">
            <h2 className="text-xl font-semibold mb-1">AI Processing</h2>
            <p className="text-sm text-muted-foreground mb-6">
              Step 3 of 5 — Running automated analysis on your media
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

        {(step === "report" || step === "estimate" || step === "review") && assessment && (
          <div className="space-y-4">
            {/* Damage Report card — always visible from report step onward */}
            <Card className="p-6">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h2 className="text-xl font-semibold">AI Assessment</h2>
                  <p className="text-sm text-muted-foreground">Step 3 of 5 — Damage report</p>
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

              <h3 className="font-medium mt-6 mb-2 text-sm">Damage Report</h3>
              <div className="space-y-2">
                {assessment.damages.map((d, i) => (
                  <div key={i} className="flex items-start gap-3 p-3 rounded border">
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
                    <div className="flex-1">
                      <div className="font-medium text-sm">{d.location}</div>
                      <div className="text-xs text-muted-foreground mb-1">Type: {d.type}</div>
                      <div className="text-sm text-muted-foreground">{d.description}</div>
                    </div>
                  </div>
                ))}
              </div>

              {step === "report" && (
                <div className="flex justify-end mt-6">
                  <Button onClick={generateEstimate}>Generate Estimate</Button>
                </div>
              )}
            </Card>

            {/* Editable Estimate card — only after Generate Estimate is clicked */}
            {(step === "estimate" || step === "review") && (() => {
              const partsTotal = estimateLines
                .filter((l) => l.category === "Parts")
                .reduce((s, l) => s + (Number(l.cost) || 0), 0);
              const laborTotal = estimateLines
                .filter((l) => l.category === "Labor")
                .reduce((s, l) => s + (Number(l.cost) || 0), 0);
              const total = partsTotal + laborTotal;
              return (
                <Card className="p-6">
                  <h2 className="text-xl font-semibold mb-1">Estimate</h2>
                  <p className="text-sm text-muted-foreground mb-4">
                    Step 4 of 5 — Review and edit the cost breakdown
                  </p>

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

            {(step === "estimate" || step === "review") && (
              <Card className="p-6">
                <h2 className="text-xl font-semibold mb-1">Review & Approve</h2>
                <p className="text-sm text-muted-foreground mb-4">
                  Step 5 of 5 — Your decision finalizes the claim
                </p>
                <div className="flex gap-3">
                  <Button onClick={() => finalize("approved")} className="flex-1">
                    Approve Claim
                  </Button>
                  <Button
                    onClick={() => finalize("rejected")}
                    variant="outline"
                    className="flex-1"
                  >
                    Reject
                  </Button>
                </div>
              </Card>
            )}
          </div>
        )}

        {step === "done" && (
          <Card className="p-12 text-center">
            <div className="text-4xl mb-3">{decision === "approved" ? "✓" : "✕"}</div>
            <h2 className="text-2xl font-semibold mb-2">
              Claim {decision === "approved" ? "Approved" : "Rejected"}
            </h2>
            <p className="text-muted-foreground mb-1 font-mono text-sm">{claimId}</p>
            {decision === "approved" && assessment && (
              <p className="text-muted-foreground">
                Payout: ${assessment.estimatedCost.toLocaleString()}
              </p>
            )}
            <Button onClick={startClaim} className="mt-6">
              Create Another Claim
            </Button>
          </Card>
        )}
      </main>
    </div>
  );
}

function Stepper({ step }: { step: Step }) {
  const steps = [
    { key: "intake", label: "Intake" },
    { key: "upload", label: "Media" },
    { key: "assessment", label: "Assessment" },
    { key: "estimate", label: "Estimate" },
    { key: "review", label: "Review" },
  ];
  // Map current step to a stepper index
  const stepIndexMap: Record<string, number> = {
    intake: 0,
    upload: 1,
    processing: 2,
    report: 2,
    estimate: 3,
    review: 4,
    done: 4,
  };
  const activeIndex = stepIndexMap[step] ?? 0;
  return (
    <div className="mx-auto max-w-4xl px-6 pb-3 flex gap-2 text-xs">
      {steps.map((s, i) => {
        const current = i === activeIndex;
        const done = i < activeIndex || step === "done";
        return (
          <div key={s.key} className="flex items-center gap-2 flex-1">
            <div
              className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-medium ${
                done
                  ? "bg-primary text-primary-foreground"
                  : current
                    ? "bg-foreground text-background"
                    : "bg-muted text-muted-foreground"
              }`}
            >
              {i + 1}
            </div>
            <span className={current ? "font-medium" : "text-muted-foreground"}>{s.label}</span>
          </div>
        );
      })}
    </div>
  );
}
