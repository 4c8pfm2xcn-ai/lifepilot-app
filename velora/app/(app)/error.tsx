"use client";

import { Button } from "@/components/ui/button";
import { Notice } from "@/components/ui/notice";

export default function AppError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="mx-auto max-w-lg py-16">
      <Notice tone="danger" title="Something went wrong">
        We couldn&apos;t load this page. This is usually temporary.
      </Notice>
      <Button className="mt-6" variant="secondary" onClick={reset}>Try again</Button>
    </div>
  );
}
