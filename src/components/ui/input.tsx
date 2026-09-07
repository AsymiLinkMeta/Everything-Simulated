import type { InputHTMLAttributes, TextareaHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

export function Input({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={cn(
        "flex min-h-11 w-full rounded-md border border-line bg-raised px-3 text-sm text-paper placeholder:text-subtle outline-none focus:border-muted",
        className,
      )}
      {...props}
    />
  );
}

export function Textarea({ className, ...props }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      className={cn(
        "flex min-h-24 w-full rounded-md border border-line bg-raised px-3 py-2 text-sm text-paper placeholder:text-subtle outline-none focus:border-muted",
        className,
      )}
      {...props}
    />
  );
}
