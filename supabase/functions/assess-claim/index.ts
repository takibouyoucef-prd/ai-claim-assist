import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { vehicleType, description, images } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const userContent: any[] = [
      {
        type: "text",
        text: `You are an insurance claims assessor. Analyze this claim and respond ONLY with valid JSON (no markdown, no code fences) matching this schema:
{
  "summary": "string - 2-3 sentence damage assessment",
  "damages": [{"location": "string (e.g. Front bumper, Driver door)", "type": "Dent|Scratch|Broken Part|Crack|Paint Damage|Other", "severity": "Low|Medium|High", "description": "string"}],
  "estimatedCost": number (USD total),
  "lineItems": [{"item": "string", "cost": number}],
  "mediaValidation": {"status": "Sufficient coverage|Missing angle|Insufficient", "notes": "string - 1 sentence on what's covered or missing"},
  "fraudRisk": {"level": "Low|Medium|High", "reason": "string - brief reason"},
  "recommendation": "Approve|Review|Deny",
  "confidence": number (0-100)
}

Vehicle: ${vehicleType}
Incident: ${description}
${images?.length ? `Analyze the ${images.length} attached image(s) for damage location, type, severity, and angle coverage.` : "No images provided — note this in mediaValidation."}`,
      },
      ...(images || []).map((url: string) => ({
        type: "image_url",
        image_url: { url },
      })),
    ];

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [{ role: "user", content: userContent }],
        response_format: { type: "json_object" },
      }),
    });

    if (response.status === 429) {
      return new Response(JSON.stringify({ error: "Rate limit exceeded. Try again shortly." }), {
        status: 429,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (response.status === 402) {
      return new Response(JSON.stringify({ error: "AI credits exhausted. Add funds in Settings → Workspace → Usage." }), {
        status: 402,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (!response.ok) {
      const t = await response.text();
      console.error("AI gateway error:", response.status, t);
      return new Response(JSON.stringify({ error: "AI assessment failed" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || "{}";
    const assessment = JSON.parse(content);

    return new Response(JSON.stringify({ assessment }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("assess-claim error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
