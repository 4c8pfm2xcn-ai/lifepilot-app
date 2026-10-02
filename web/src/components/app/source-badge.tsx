import { Cpu, Sparkles } from "lucide-react";
import { Badge } from "@/components/ui/badge";

export function SourceBadge({ source }: { source: "ai" | "heuristic" | "offline" | "computed" | "manual" | null | undefined }) {
  if (source === "ai") {
    return (
      <Badge tone="accent">
        <Sparkles className="h-3 w-3" /> AI
      </Badge>
    );
  }
  if (!source || source === "manual") return null;
  return (
    <Badge tone="neutral">
      <Cpu className="h-3 w-3" /> {source === "computed" ? "Computed" : "On-device"}
    </Badge>
  );
}
