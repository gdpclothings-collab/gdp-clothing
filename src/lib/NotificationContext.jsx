import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  AlertTriangle,
  CheckCircle2,
  CircleHelp,
  Info,
  ShieldAlert,
} from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "@/components/ui/use-toast";
import { cn } from "@/lib/utils";

const NotificationContext = createContext(null);
let externalConfirmAction = null;

const TONE_CONFIG = {
  default: {
    icon: CircleHelp,
    iconClass: "bg-foreground/[0.06] text-foreground",
    actionClass: "bg-foreground text-background hover:bg-foreground/90",
    variant: "default",
  },
  info: {
    icon: Info,
    iconClass: "bg-sky-500/10 text-sky-700 dark:text-sky-300",
    actionClass: "bg-foreground text-background hover:bg-foreground/90",
    variant: "info",
  },
  success: {
    icon: CheckCircle2,
    iconClass: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
    actionClass: "bg-foreground text-background hover:bg-foreground/90",
    variant: "success",
  },
  warning: {
    icon: AlertTriangle,
    iconClass: "bg-amber-500/12 text-amber-700 dark:text-amber-300",
    actionClass: "bg-foreground text-background hover:bg-foreground/90",
    variant: "warning",
  },
  destructive: {
    icon: ShieldAlert,
    iconClass: "bg-destructive/10 text-destructive",
    actionClass: "bg-destructive text-destructive-foreground hover:bg-destructive/90",
    variant: "destructive",
  },
};

const DESTRUCTIVE_CONFIRM_PATTERN = /\b(delete|remove|clear|archive|retire|cancel|reset|discard)\b/i;
const WARNING_CONFIRM_PATTERN = /\b(publish|restore|enable|disable|switch|live mode|maintenance|replace|optimize|convert|move|load defaults)\b/i;
const ERROR_NOTIFICATION_PATTERN = /\b(could not|failed|failure|error|unable|invalid|unexpected|problem)\b/i;

function inferLegacyConfirmation(message) {
  const text = String(message || "")
    .replace(/\s*\n+\s*/g, " ")
    .replace(/\s{2,}/g, " ")
    .trim();
  const questionIndex = text.indexOf("?");
  const candidateTitle = questionIndex >= 0 ? text.slice(0, questionIndex + 1).trim() : "";
  const title = candidateTitle && candidateTitle.length <= 125
    ? candidateTitle
    : "Confirm this action?";
  const trailing = questionIndex >= 0 ? text.slice(questionIndex + 1).trim() : "";
  const description = trailing || (title === "Confirm this action?" ? text : "Review the details before continuing.");
  const destructive = DESTRUCTIVE_CONFIRM_PATTERN.test(text);
  const warning = WARNING_CONFIRM_PATTERN.test(text);

  return {
    title,
    description,
    tone: destructive ? "destructive" : warning ? "warning" : "default",
    confirmLabel: destructive ? "Confirm action" : "Continue",
    cancelLabel: destructive ? "Keep current" : "Cancel",
  };
}

function normalizeConfirmation(options = {}) {
  const legacy = typeof options === "string" ? inferLegacyConfirmation(options) : null;
  const normalized = legacy || options;
  return {
    eyebrow: normalized.eyebrow || "GDP Clothing",
    title: normalized.title || "Confirm this action?",
    description: normalized.description || "Review the details before continuing.",
    confirmLabel: normalized.confirmLabel || "Continue",
    cancelLabel: normalized.cancelLabel || "Cancel",
    tone: TONE_CONFIG[normalized.tone] ? normalized.tone : "default",
  };
}

function normalizeNotification(options = {}) {
  if (typeof options !== "string") {
    const tone = TONE_CONFIG[options?.tone] ? options.tone : "default";
    return { ...options, tone };
  }

  const description = String(options).trim() || "Something needs your attention.";
  const isError = ERROR_NOTIFICATION_PATTERN.test(description);
  return {
    tone: isError ? "destructive" : "warning",
    title: isError ? "Something went wrong" : "Action needs attention",
    description,
  };
}

export function requestNotification(options = {}) {
  const normalized = normalizeNotification(options);
  const config = TONE_CONFIG[normalized.tone] || TONE_CONFIG.default;
  return toast({
    title: normalized.title,
    description: normalized.description,
    variant: config.variant,
    duration: Number(normalized.duration || 4800),
    action: normalized.action,
  });
}

export function requestConfirmation(options = {}) {
  if (typeof externalConfirmAction !== "function") {
    console.warn("GDP confirmation requested before NotificationProvider was ready.");
    return Promise.resolve(false);
  }
  return externalConfirmAction(options);
}

export function NotificationProvider({ children }) {
  const [confirmation, setConfirmation] = useState(null);
  const resolverRef = useRef(null);

  const settleConfirmation = useCallback((result) => {
    const resolver = resolverRef.current;
    resolverRef.current = null;
    setConfirmation(null);
    resolver?.(Boolean(result));
  }, []);

  const confirmAction = useCallback((options = {}) => {
    if (resolverRef.current) {
      resolverRef.current(false);
      resolverRef.current = null;
    }

    setConfirmation(normalizeConfirmation(options));
    return new Promise((resolve) => {
      resolverRef.current = resolve;
    });
  }, []);

  const notify = useCallback((options = {}) => requestNotification(options), []);

  useEffect(() => {
    externalConfirmAction = confirmAction;

    if (typeof window === "undefined") {
      return () => {
        if (externalConfirmAction === confirmAction) externalConfirmAction = null;
      };
    }

    const previousAlert = window.alert;
    window.alert = (message) => requestNotification(String(message ?? ""));

    return () => {
      if (externalConfirmAction === confirmAction) externalConfirmAction = null;
      if (window.alert !== previousAlert) window.alert = previousAlert;
    };
  }, [confirmAction]);

  useEffect(
    () => () => {
      resolverRef.current?.(false);
      resolverRef.current = null;
    },
    []
  );

  const value = useMemo(
    () => ({ confirmAction, notify }),
    [confirmAction, notify]
  );

  const tone = confirmation?.tone || "default";
  const toneConfig = TONE_CONFIG[tone];
  const ToneIcon = toneConfig.icon;

  return (
    <NotificationContext.Provider value={value}>
      {children}

      <AlertDialog
        open={Boolean(confirmation)}
        onOpenChange={(open) => {
          if (!open && confirmation) settleConfirmation(false);
        }}
      >
        <AlertDialogContent className="max-w-[500px] overflow-hidden p-0">
          <div className="h-1 w-full bg-accent" aria-hidden="true" />
          <div className="p-5 sm:p-6">
            <AlertDialogHeader className="text-left">
              <div className="flex items-start gap-3.5">
                <div
                  className={cn(
                    "grid h-11 w-11 shrink-0 place-items-center rounded-2xl",
                    toneConfig.iconClass
                  )}
                  aria-hidden="true"
                >
                  <ToneIcon size={21} strokeWidth={1.9} />
                </div>
                <div className="min-w-0 flex-1 pt-0.5">
                  <div className="font-mono text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                    {confirmation?.eyebrow}
                  </div>
                  <AlertDialogTitle className="mt-1.5 text-xl font-semibold leading-tight tracking-[-0.02em] sm:text-[22px]">
                    {confirmation?.title}
                  </AlertDialogTitle>
                  <AlertDialogDescription className="mt-2 whitespace-pre-line text-sm leading-6 text-muted-foreground">
                    {confirmation?.description}
                  </AlertDialogDescription>
                </div>
              </div>
            </AlertDialogHeader>

            <AlertDialogFooter className="mt-6 gap-2 sm:space-x-0">
              <AlertDialogCancel
                onClick={() => settleConfirmation(false)}
                className="h-11 rounded-xl px-4 font-semibold"
              >
                {confirmation?.cancelLabel}
              </AlertDialogCancel>
              <AlertDialogAction
                onClick={() => settleConfirmation(true)}
                className={cn(
                  "h-11 rounded-xl px-5 font-semibold shadow-sm",
                  toneConfig.actionClass
                )}
              >
                {confirmation?.confirmLabel}
              </AlertDialogAction>
            </AlertDialogFooter>
          </div>
        </AlertDialogContent>
      </AlertDialog>
    </NotificationContext.Provider>
  );
}

export function useNotifications() {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error("useNotifications must be used inside NotificationProvider.");
  }
  return context;
}
