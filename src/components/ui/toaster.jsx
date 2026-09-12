import {
  AlertTriangle,
  CheckCircle2,
  Info,
  ShieldAlert,
  Sparkles,
} from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import {
  Toast,
  ToastClose,
  ToastDescription,
  ToastProvider,
  ToastTitle,
  ToastViewport,
} from "@/components/ui/toast";
import { cn } from "@/lib/utils";

const ICONS = {
  default: Sparkles,
  info: Info,
  success: CheckCircle2,
  warning: AlertTriangle,
  destructive: ShieldAlert,
};

const ICON_STYLES = {
  default: "bg-foreground/[0.06] text-foreground",
  info: "bg-sky-500/10 text-sky-700 dark:text-sky-300",
  success: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
  warning: "bg-amber-500/12 text-amber-700 dark:text-amber-300",
  destructive: "bg-destructive/10 text-destructive",
};

export function Toaster() {
  const { toasts } = useToast();

  return (
    <ToastProvider>
      {toasts.map(function ({ id, title, description, action, variant = "default", ...props }) {
        const Icon = ICONS[variant] || ICONS.default;
        return (
          <Toast key={id} variant={variant} {...props}>
            <div
              className={cn(
                "mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-xl",
                ICON_STYLES[variant] || ICON_STYLES.default
              )}
              aria-hidden="true"
            >
              <Icon size={17} strokeWidth={1.9} />
            </div>
            <div className="min-w-0 flex-1 grid gap-0.5">
              {title && <ToastTitle>{title}</ToastTitle>}
              {description && (
                <ToastDescription>{description}</ToastDescription>
              )}
            </div>
            {action}
            <ToastClose />
          </Toast>
        );
      })}
      <ToastViewport />
    </ToastProvider>
  );
}