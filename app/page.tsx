import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

// Temporary design-system preview — replaced by the real Simulator in Phase 1.7.
export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4">
      <p className="text-muted-foreground">Gatekeeper AI — simulator shell</p>
      <div className="flex items-center gap-3">
        <Button>Book Meeting</Button>
        <Badge variant="destructive">Rejected</Badge>
      </div>
    </main>
  );
}
