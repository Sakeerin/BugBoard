"use client";

import type { Toast } from "@/hooks/useToast";

interface Props {
  toasts: Toast[];
  onDismiss: (id: number) => void;
}

export default function ToastStack({ toasts, onDismiss }: Props) {
  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2">
      {toasts.map((t) => (
        <div
          key={t.id}
          onClick={() => onDismiss(t.id)}
          className={`flex cursor-pointer items-center gap-3 rounded-lg px-4 py-3 text-sm font-medium text-white shadow-lg ${
            t.type === "error" ? "bg-red-600" : "bg-green-600"
          }`}
        >
          <span>{t.type === "error" ? "✕" : "✓"}</span>
          <span>{t.message}</span>
        </div>
      ))}
    </div>
  );
}
