import { createFileRoute } from "@tanstack/react-router";
import { ClaimsCopilot } from "@/components/ClaimsCopilot";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "ClaimPilot by ScaleAI" },
      { name: "description", content: "ClaimPilot by ScaleAI — AI-assisted insurance claim intake, assessment, and estimation." },
    ],
  }),
  component: () => <ClaimsCopilot />,
});
