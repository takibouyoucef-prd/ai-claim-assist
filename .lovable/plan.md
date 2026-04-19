
The user wants a small PRD documenting how the Cost Estimate page works in the Claims Copilot, focused on business topics (not deeply technical). I'll generate it as a downloadable Word document (.docx) and place it in `/mnt/documents/` so the user can download it.

Before generating, I should clarify the format — the user said "in the form" which is ambiguous (could mean "in the form of a doc" i.e. a downloadable file, or could mean inside a form/UI in the app). Given the phrasing "document … a small PRD", a downloadable artifact is the most natural interpretation, but per the rules I must ask before generating any deliverable where format is ambiguous.

## Plan

1. Confirm with the user the desired format for the PRD (downloadable file vs in-app page vs markdown in repo).
2. Once confirmed, produce the PRD covering:
   - **Purpose** — why the Cost Estimate step exists in the claims flow.
   - **User & context** — claims agent reviewing an AI-generated estimate before sending to adjuster.
   - **Inputs** — AI assessment (damages, suggested parts/labor), policy data (deductible, coverage), agent edits.
   - **Page behavior** — editable line items (Parts/Labor), add via catalog search, remove lines, live total recalculation, deductible breakdown.
   - **Business rules** — deductible subtraction, total vs net payout, recommendation thresholds (approve / review / reject bands).
   - **Outputs** — finalized estimate passed to the adjuster decision step.
   - **Success metrics** — time-to-estimate, agent override rate, estimate-to-final-payout variance.
   - **Out of scope / future** — supplier integration, real-time parts pricing, multi-currency.

The PRD will be ~1–2 pages, plain business language, minimal jargon.
