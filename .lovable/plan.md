
User wants to expand the existing app PRD (`claims-copilot-prd.docx`) with three new AI subsections (5.2, 5.3, 5.4). I'll regenerate the doc with these added, keeping the same formatting (11pt body, 14pt titles, max 3 pages) and save as a new versioned file `claims-copilot-prd_v2.docx`.

## Plan

1. Re-generate the PRD as `claims-copilot-prd_v2.docx` keeping all existing sections, plus a new section "5. AI Systems" with three subsections using the user's exact content (lightly tightened for flow):
   - **5.2 AI Media Validation & Fraud Detection** — quality checks (blur, missing angles, vehicle-type match vs policy, video frame extraction), fraud signals (inconsistent damage patterns, suspicious artifacts). Output: validation recommendation, fraud risk flag, confidence score.
   - **5.3 AI Damage Assessment** — detects/classifies damage by type, location, severity, description, cost estimate. Output: structured damage report.
   - **5.4 AI Cost Estimation** — generates Damages/Parts/Labor lines with subtotals + total, agent-editable with catalog reference. Recommendation banding driven by confidence, fraud signals, media coverage, and validated total. Output: validated estimate + banded next-step recommendations (auto-approve / review / adjuster sign-off).
2. Use docx-js per the skill: 11pt Arial body, 14pt bold headings, US Letter, 1" margins, proper bullet numbering (no unicode bullets), keep within 3 pages by tightening prose and reusing compact bullet lists.
3. QA: convert to PDF → images, inspect every page for layout/overflow/page count, fix and re-run if needed.
4. Deliver `claims-copilot-prd_v2.docx` via `<lov-artifact>`.

No code changes to the app. Single artifact output.
