import { createFileRoute } from "@tanstack/react-router";
import { ClaimsCopilot } from "@/components/ClaimsCopilot";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "AI Claims Copilot" },
      { name: "description", content: "AI-assisted insurance claim intake, assessment, and estimation." },
    ],
  }),
  component: () => <ClaimsCopilot />,
});
