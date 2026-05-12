"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { signIn } from "next-auth/react";
import { useState, useTransition } from "react";

import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";

export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [error, setError] = useState("");
  const [isPending, startTransition] = useTransition();
  const registered = searchParams.get("registered") === "1";

  function handleSubmit(formData: FormData) {
    setError("");
    startTransition(async () => {
      const result = await signIn("credentials", {
        email: formData.get("email"),
        password: formData.get("password"),
        redirect: false
      });

      if (result?.error) {
        setError("Email atau kata sandi tidak sesuai.");
        return;
      }

      router.push("/dashboard");
      router.refresh();
    });
  }

  return (
    <form action={handleSubmit} className="grid gap-4">
      {registered ? <p className="rounded-md bg-brand-50 p-3 text-sm text-brand-700">Akun berhasil dibuat. Silakan masuk.</p> : null}
      {error ? <p className="rounded-md bg-red-50 p-3 text-sm text-red-700">{error}</p> : null}
      <Input autoComplete="email" label="Email" name="email" required type="email" />
      <Input autoComplete="current-password" label="Kata sandi" name="password" required type="password" />
      <Button disabled={isPending} type="submit">
        {isPending ? "Memproses..." : "Masuk"}
      </Button>
    </form>
  );
}
