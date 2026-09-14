import { useMemo, useReducer } from "react";

/** @typedef {{ type: "set", key: string, value: any }} WorkflowAction */

/**
 * @param {any} current
 * @param {any} value
 */
function resolveNext(current, value) {
  return typeof value === "function" ? value(current) : value;
}

/**
 * @param {Record<string, any>} state
 * @param {WorkflowAction} action
 */
function workflowReducer(state, action) {
  if (!action || action.type !== "set") return state;
  const nextValue = resolveNext(state[action.key], action.value);
  if (Object.is(nextValue, state[action.key])) return state;
  return { ...state, [action.key]: nextValue };
}

/** @param {any} fallbackGarment */
function createInitialWorkflowState(fallbackGarment) {
  return {
    step: 1,
    seasonalMode: false,
    seasonalDraft: null,
    seasonalPrepared: null,
    designPath: "",
    catalog: [],
    product: null,
    designMood: "Original",
    designIntensity: 3,
    garment: fallbackGarment,
    color: "",
    size: "",
    qty: 1,
    placement: "front",
    previewSide: "front",
    designStylesBySide: { front: "", back: "" },
    groupGarments: [],
  };
}

/** @param {any} fallbackGarment */
export function useCustomStudioWorkflowState(fallbackGarment) {
  const [state, dispatch] = useReducer(workflowReducer, createInitialWorkflowState(fallbackGarment));

  const setters = useMemo(() => ({
    setStep: (value) => dispatch({ type: "set", key: "step", value }),
    setSeasonalMode: (value) => dispatch({ type: "set", key: "seasonalMode", value }),
    setSeasonalDraft: (value) => dispatch({ type: "set", key: "seasonalDraft", value }),
    setSeasonalPrepared: (value) => dispatch({ type: "set", key: "seasonalPrepared", value }),
    setDesignPath: (value) => dispatch({ type: "set", key: "designPath", value }),
    setCatalog: (value) => dispatch({ type: "set", key: "catalog", value }),
    setProduct: (value) => dispatch({ type: "set", key: "product", value }),
    setDesignMood: (value) => dispatch({ type: "set", key: "designMood", value }),
    setDesignIntensity: (value) => dispatch({ type: "set", key: "designIntensity", value }),
    setGarment: (value) => dispatch({ type: "set", key: "garment", value }),
    setColor: (value) => dispatch({ type: "set", key: "color", value }),
    setSize: (value) => dispatch({ type: "set", key: "size", value }),
    setQty: (value) => dispatch({ type: "set", key: "qty", value }),
    setPlacement: (value) => dispatch({ type: "set", key: "placement", value }),
    setPreviewSide: (value) => dispatch({ type: "set", key: "previewSide", value }),
    setDesignStylesBySide: (value) => dispatch({ type: "set", key: "designStylesBySide", value }),
    setGroupGarments: (value) => dispatch({ type: "set", key: "groupGarments", value }),
  }), []);

  return { ...state, ...setters };
}
