"use client"

/**
 * Entity Configuration Hooks
 */

import { useReducer, useEffect } from "react"
import { getEntityConfig, hasEntityConfig, ensureEntityConfig, subscribeToRegistry } from "./registry"
import type { EntityConfig } from "./types"

type LoadState = { loading: boolean; error: Error | null; loadedName: string | null }
type LoadAction = { type: "LOADED"; name: string } | { type: "LOADING" } | { type: "ERROR"; error: Error }

function loadReducer(state: LoadState, action: LoadAction): LoadState {
  switch (action.type) {
    case "LOADED":
      return { loading: false, error: null, loadedName: action.name }
    case "LOADING":
      return { ...state, loading: true, error: null }
    case "ERROR":
      return { loading: false, error: action.error, loadedName: null }
    default:
      return state
  }
}

/**
 * Hook to safely access an entity configuration, loading it if necessary.
 *
 * Performance: Uses a reducer to batch state updates. If the config is already
 * in the registry (common case after first load), returns synchronously with
 * isLoading=false — no async work needed.
 */
export function useEntityConfig<TEntity = unknown, TFormValues = unknown>(
  entityName: string,
): {
  config: EntityConfig<TEntity, TFormValues> | null
  isLoading: boolean
  error: Error | null
} {
  const alreadyLoaded = hasEntityConfig(entityName)

  const [state, dispatch] = useReducer(loadReducer, {
    loading: !alreadyLoaded,
    error: null,
    loadedName: alreadyLoaded ? entityName : null,
  })

  // Re-render the moment this entity's config registers — covers the case
  // where the async `LOADED` dispatch below is dropped (render churn / a
  // mount race) yet the config IS in the registry. Without this safety net the
  // page can freeze on its skeleton even though the data is ready.
  useEffect(() => {
    return subscribeToRegistry(() => {
      if (hasEntityConfig(entityName)) dispatch({ type: "LOADED", name: entityName })
    })
  }, [entityName])

  useEffect(() => {
    // Already loaded this entity name
    if (state.loadedName === entityName) return

    // Config arrived in registry between renders (loaded by another component)
    if (hasEntityConfig(entityName)) {
      dispatch({ type: "LOADED", name: entityName })
      return
    }

    // Async load. We dispatch unconditionally on settle (no `mountedRef` guard):
    // the dispatch is what forces the re-render that lets the hook read the
    // now-registered config. Guarding it on "still mounted" created a race —
    // under render churn the live instance could end up with `mountedRef.current
    // === false`, the dispatch was skipped, and the page froze on its skeleton
    // forever. A dispatch to an unmounted reducer is a harmless no-op in React
    // 18+, so dropping the guard is safe and makes loading always converge.
    dispatch({ type: "LOADING" })

    ensureEntityConfig(entityName)
      .then(() => dispatch({ type: "LOADED", name: entityName }))
      .catch(err => dispatch({ type: "ERROR", error: err instanceof Error ? err : new Error(String(err)) }))
  }, [entityName, state.loadedName])

  const has = hasEntityConfig(entityName)
  const config = has ? getEntityConfig<TEntity, TFormValues>(entityName) : null

  // Self-heal: the registry is a synchronous module-level store, so once the
  // config is present it IS ready — regardless of whether the async `LOADED`
  // dispatch landed. The dispatch can be missed under render churn / a
  // mount-unmount race (the `mountedRef` guard skips it), which previously
  // left `isLoading` stuck `true` forever and froze every config-driven page
  // on its skeleton. Deriving loading from registry presence makes the hook
  // converge on the next render no matter how the async settled.
  const isLoading = !has && state.loading

  return { config, isLoading, error: state.error }
}
