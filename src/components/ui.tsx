import { AlertTriangle, Check, Info, LoaderCircle, X } from "lucide-react";
import type { ReactNode } from "react";

export function PageHeader({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-col gap-4 border-b border-slate-200 pb-5 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-950">{title}</h1>
        <p className="mt-1 text-sm text-slate-500">{description}</p>
      </div>
      {action}
    </div>
  );
}

export function Button({
  variant = "primary",
  busy,
  className = "",
  children,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "danger" | "ghost";
  busy?: boolean;
}) {
  const variants = {
    primary: "bg-blue-700 text-white hover:bg-blue-800 shadow-sm",
    secondary: "border border-slate-300 bg-white text-slate-700 hover:bg-slate-50",
    danger: "bg-red-600 text-white hover:bg-red-700",
    ghost: "text-slate-600 hover:bg-slate-100",
  };
  return (
    <button
      {...props}
      disabled={props.disabled || busy}
      className={`inline-flex h-10 items-center justify-center gap-2 rounded-lg px-4 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-50 ${variants[variant]} ${className}`}
    >
      {busy && <LoaderCircle className="size-4 animate-spin" />}
      {children}
    </button>
  );
}

export function Badge({ children, tone = "slate" }: { children: ReactNode; tone?: string }) {
  const tones: Record<string, string> = {
    slate: "bg-slate-100 text-slate-700",
    blue: "bg-blue-50 text-blue-700 ring-blue-200",
    green: "bg-emerald-50 text-emerald-700 ring-emerald-200",
    amber: "bg-amber-50 text-amber-700 ring-amber-200",
    red: "bg-red-50 text-red-700 ring-red-200",
    violet: "bg-violet-50 text-violet-700 ring-violet-200",
  };
  return <span className={`inline-flex rounded-md px-2 py-1 text-xs font-semibold ring-1 ring-inset ${tones[tone] ?? tones.slate}`}>{children}</span>;
}

export function statusTone(status: string) {
  if (["sent", "送信済", "受注", "connected", "completed", "drafted"].includes(status)) return "green";
  if (["failed", "失注", "error", "配信停止"].includes(status)) return "red";
  if (["pending", "processing", "送信予定", "返信待ち", "unverified"].includes(status)) return "amber";
  if (["アポ獲得", "返信あり"].includes(status)) return "violet";
  return "blue";
}

export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <section className={`rounded-xl border border-slate-200 bg-white shadow-sm ${className}`}>{children}</section>;
}

export function Field({
  label,
  hint,
  required,
  children,
}: {
  label: string;
  hint?: string;
  required?: boolean;
  children: ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-semibold text-slate-700">
        {label} {required && <span className="text-red-600">*</span>}
      </span>
      {children}
      {hint && <span className="mt-1 block text-xs text-slate-500">{hint}</span>}
    </label>
  );
}

export const inputClass = "h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-blue-600 focus:ring-2 focus:ring-blue-100";
export const textareaClass = "w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm leading-6 text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-blue-600 focus:ring-2 focus:ring-blue-100";

export function Modal({
  title,
  description,
  children,
  onClose,
  footer,
  wide,
}: {
  title: string;
  description?: string;
  children: ReactNode;
  onClose: () => void;
  footer?: ReactNode;
  wide?: boolean;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 p-4 backdrop-blur-[2px]" role="dialog" aria-modal="true">
      <div className={`max-h-[92vh] w-full overflow-hidden rounded-2xl bg-white shadow-2xl ${wide ? "max-w-5xl" : "max-w-xl"}`}>
        <div className="flex items-start justify-between border-b border-slate-200 px-6 py-5">
          <div>
            <h2 className="text-lg font-bold text-slate-950">{title}</h2>
            {description && <p className="mt-1 text-sm text-slate-500">{description}</p>}
          </div>
          <button onClick={onClose} className="rounded-lg p-2 text-slate-500 hover:bg-slate-100" aria-label="閉じる"><X className="size-5" /></button>
        </div>
        <div className="max-h-[calc(92vh-150px)] overflow-y-auto px-6 py-5">{children}</div>
        {footer && <div className="flex items-center justify-end gap-3 border-t border-slate-200 bg-slate-50 px-6 py-4">{footer}</div>}
      </div>
    </div>
  );
}

export function Notice({ tone = "info", children }: { tone?: "info" | "warning" | "success" | "danger"; children: ReactNode }) {
  const styles = {
    info: "border-blue-200 bg-blue-50 text-blue-900",
    warning: "border-amber-200 bg-amber-50 text-amber-900",
    success: "border-emerald-200 bg-emerald-50 text-emerald-900",
    danger: "border-red-200 bg-red-50 text-red-900",
  };
  const Icon = tone === "warning" || tone === "danger" ? AlertTriangle : tone === "success" ? Check : Info;
  return <div className={`flex gap-3 rounded-lg border p-3 text-sm leading-6 ${styles[tone]}`}><Icon className="mt-0.5 size-4 shrink-0" /><div>{children}</div></div>;
}

export function EmptyState({ title, description, action }: { title: string; description: string; action?: ReactNode }) {
  return <div className="flex min-h-56 flex-col items-center justify-center px-6 text-center"><div className="rounded-full bg-slate-100 p-3"><Info className="size-5 text-slate-500" /></div><h3 className="mt-3 font-semibold text-slate-900">{title}</h3><p className="mt-1 max-w-md text-sm text-slate-500">{description}</p>{action && <div className="mt-4">{action}</div>}</div>;
}
