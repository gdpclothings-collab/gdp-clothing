import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { AlertTriangle, Save } from "lucide-react";
import { useNavigate } from "react-router-dom";

const UnsavedChangesContext = createContext(null);
let guardSequence = 0;

function getDirtyGuards(guards) {
  return Array.from(guards.values()).filter((guard) => guard?.isDirty);
}

export function UnsavedChangesProvider({ children }) {
  const navigate = useNavigate();
  const guardsRef = useRef(new Map());
  const [version, setVersion] = useState(0);
  const [pendingAction, setPendingAction] = useState(null);
  const [saving, setSaving] = useState(false);

  const upsertGuard = useCallback((id, guard) => {
    guardsRef.current.set(id, guard);
    setVersion((current) => current + 1);
  }, []);

  const removeGuard = useCallback((id) => {
    if (guardsRef.current.delete(id)) {
      setVersion((current) => current + 1);
    }
  }, []);

  const requestAction = useCallback((action, options = {}) => {
    if (typeof action !== "function") return;
    const dirtyGuards = getDirtyGuards(guardsRef.current);
    if (!dirtyGuards.length) {
      action();
      return;
    }

    setPendingAction({
      action,
      title: options.title || "You have unsaved changes",
      description:
        options.description ||
        "Save your changes before leaving, discard them, or keep editing.",
    });
  }, []);

  useEffect(() => {
    const handleBeforeUnload = (event) => {
      if (!getDirtyGuards(guardsRef.current).length) return;
      event.preventDefault();
      event.returnValue = "";
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, []);

  useEffect(() => {
    const handleDocumentClick = (event) => {
      if (
        event.defaultPrevented ||
        event.button !== 0 ||
        event.metaKey ||
        event.ctrlKey ||
        event.shiftKey ||
        event.altKey ||
        !getDirtyGuards(guardsRef.current).length
      ) {
        return;
      }

      const anchor = event.target?.closest?.("a[href]");
      if (
        !anchor ||
        anchor.hasAttribute("download") ||
        anchor.dataset.unsavedBypass === "true" ||
        (anchor.target && anchor.target !== "_self")
      ) {
        return;
      }

      let url;
      try {
        url = new URL(anchor.href, window.location.href);
      } catch {
        return;
      }

      if (url.origin !== window.location.origin || url.href === window.location.href) return;

      event.preventDefault();
      event.stopPropagation();

      requestAction(() => {
        navigate(`${url.pathname}${url.search}${url.hash}`);
      });
    };

    document.addEventListener("click", handleDocumentClick, true);
    return () => document.removeEventListener("click", handleDocumentClick, true);
  }, [navigate, requestAction, version]);

  const dirtyGuards = useMemo(
    () => getDirtyGuards(guardsRef.current),
    [version]
  );

  const canSave = dirtyGuards.every((guard) => typeof guard.onSave === "function");

  const keepEditing = () => {
    if (saving) return;
    setPendingAction(null);
  };

  const discardAndContinue = () => {
    if (saving) return;
    const action = pendingAction?.action;
    setPendingAction(null);
    action?.();
  };

  const saveAndContinue = async () => {
    if (saving) return;
    const activeGuards = getDirtyGuards(guardsRef.current);
    if (!activeGuards.length) {
      const action = pendingAction?.action;
      setPendingAction(null);
      action?.();
      return;
    }

    if (activeGuards.some((guard) => typeof guard.onSave !== "function")) {
      window.alert("Please save these changes before leaving this editor.");
      return;
    }

    setSaving(true);
    try {
      for (const guard of activeGuards) {
        const result = await guard.onSave();
        if (result === false) return;
      }

      const action = pendingAction?.action;
      setPendingAction(null);
      action?.();
    } catch (error) {
      console.error("Could not save pending changes:", error);
      window.alert(error?.message || "Could not save your changes.");
    } finally {
      setSaving(false);
    }
  };

  const contextValue = useMemo(
    () => ({
      hasUnsavedChanges: dirtyGuards.length > 0,
      requestAction,
      upsertGuard,
      removeGuard,
    }),
    [dirtyGuards.length, requestAction, upsertGuard, removeGuard]
  );

  return (
    <UnsavedChangesContext.Provider value={contextValue}>
      {children}

      {pendingAction && (
        <div className="fixed inset-0 z-[250] grid place-items-center bg-black/50 p-4" role="presentation">
          <div
            className="w-full max-w-md rounded-2xl border border-[#dedede] bg-white p-5 shadow-2xl"
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="unsaved-changes-title"
            aria-describedby="unsaved-changes-description"
          >
            <div className="flex items-start gap-3">
              <div className="mt-0.5 grid h-10 w-10 shrink-0 place-items-center rounded-full bg-amber-50 text-amber-700">
                <AlertTriangle size={20} />
              </div>
              <div className="min-w-0">
                <h2 id="unsaved-changes-title" className="text-base font-semibold text-[#1f1f1f]">
                  {pendingAction.title}
                </h2>
                <p id="unsaved-changes-description" className="mt-1 text-sm leading-5 text-[#666]">
                  {pendingAction.description}
                </p>
                {dirtyGuards.length > 0 && (
                  <p className="mt-2 text-xs font-medium text-amber-700">
                    {dirtyGuards.length === 1
                      ? `${dirtyGuards[0].label || "This editor"} has unsaved changes.`
                      : `${dirtyGuards.length} editors have unsaved changes.`}
                  </p>
                )}
              </div>
            </div>

            <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={keepEditing}
                disabled={saving}
                className="h-10 rounded-lg border border-[#d5d5d5] bg-white px-4 text-sm font-medium text-[#333] disabled:opacity-40"
              >
                Keep editing
              </button>
              <button
                type="button"
                onClick={discardAndContinue}
                disabled={saving}
                className="h-10 rounded-lg border border-red-200 bg-red-50 px-4 text-sm font-medium text-red-700 disabled:opacity-40"
              >
                Discard changes
              </button>
              <button
                type="button"
                onClick={saveAndContinue}
                disabled={saving || !canSave}
                className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-[#222] px-4 text-sm font-semibold text-white disabled:opacity-40"
              >
                <Save size={15} />
                {saving ? "Saving…" : "Save changes"}
              </button>
            </div>
          </div>
        </div>
      )}
    </UnsavedChangesContext.Provider>
  );
}

export function useUnsavedChanges() {
  const context = useContext(UnsavedChangesContext);
  if (!context) {
    throw new Error("useUnsavedChanges must be used inside UnsavedChangesProvider.");
  }
  return context;
}

export function useUnsavedChangesGuard({
  isDirty,
  onSave,
  label = "This editor",
}) {
  const { requestAction, upsertGuard, removeGuard } = useUnsavedChanges();
  const idRef = useRef(null);
  const saveRef = useRef(onSave);

  if (!idRef.current) {
    guardSequence += 1;
    idRef.current = `unsaved-guard-${guardSequence}`;
  }

  saveRef.current = onSave;

  useEffect(() => {
    upsertGuard(idRef.current, {
      isDirty: Boolean(isDirty),
      label,
      onSave: typeof saveRef.current === "function" ? () => saveRef.current?.() : null,
    });
  }, [isDirty, label, upsertGuard]);

  useEffect(
    () => () => {
      removeGuard(idRef.current);
    },
    [removeGuard]
  );

  const requestGuardedAction = useCallback(
    (action, options) => requestAction(action, options),
    [requestAction]
  );

  return {
    isDirty: Boolean(isDirty),
    requestAction: requestGuardedAction,
  };
}


export function useUnsavedEditorGuard({
  value,
  onSave,
  onClose,
  label = "This editor",
}) {
  const baselineRef = useRef(null);
  const snapshot = JSON.stringify(value);

  if (baselineRef.current === null) {
    baselineRef.current = snapshot;
  }

  const isDirty = snapshot !== baselineRef.current;
  const { requestAction } = useUnsavedChangesGuard({
    isDirty,
    onSave,
    label,
  });

  const requestClose = useCallback(
    () =>
      requestAction(onClose, {
        title: "You have unsaved changes",
        description: "Save your changes before closing, discard them, or keep editing.",
      }),
    [onClose, requestAction]
  );

  return { isDirty, requestClose };
}
