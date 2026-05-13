import { FormEvent } from "react";

import { Button } from "@/components/ui/Button";

export function AssistantInput({
  input,
  isSending,
  onInputChange,
  onSubmit
}: {
  input: string;
  isSending: boolean;
  onInputChange: (value: string) => void;
  onSubmit: () => void;
}) {
  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    onSubmit();
  }

  return (
    <form className="border-t border-slate-200 p-3" onSubmit={handleSubmit}>
      <div className="flex gap-2">
        <input
          className="min-h-10 min-w-0 flex-1 rounded-md border border-slate-200 bg-white px-3 py-2 text-sm outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
          disabled={isSending}
          onChange={(event) => onInputChange(event.target.value)}
          placeholder="Tanyakan pengeluaranmu..."
          value={input}
        />
        <Button className="min-w-20 px-3" disabled={isSending || !input.trim()} type="submit">
          Kirim
        </Button>
      </div>
    </form>
  );
}
