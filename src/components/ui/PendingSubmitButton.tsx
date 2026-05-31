"use client";

import { useFormStatus } from "react-dom";

import { Button } from "@/components/ui/Button";

export function PendingSubmitButton({
  idleLabel = "Simpan",
  pendingLabel = "Menyimpan..."
}: {
  idleLabel?: string;
  pendingLabel?: string;
}) {
  const { pending } = useFormStatus();

  return (
    <Button disabled={pending} type="submit">
      {pending ? pendingLabel : idleLabel}
    </Button>
  );
}
