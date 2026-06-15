"use client"

/**
 * Entity Configuration Hooks
 */

import { useReducer, useEffect, useRef } from "react"
import { getEntityConfig, hasEntityConfig, ensureEntityConfig } from "./registry"
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

  const mountedRef = useRef(true)
  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
    }
  }, [])

  useEffect(() => {
    // Already loaded this entity name
    if (state.loadedName === entityName) return

    // Config arrived in registry between renders (loaded by another component)
    if (hasEntityConfig(entityName)) {
      dispatch({ type: "LOADED", name: entityName })
      return
    }

    // Async load
    dispatch({ type: "LOADING" })

    ensureEntityConfig(entityName)
      .then(() => {
        if (mountedRef.current) dispatch({ type: "LOADED", name: entityName })
      })
      .catch(err => {
        if (mountedRef.current) {
          dispatch({ type: "ERROR", error: err instanceof Error ? err : new Error(String(err)) })
        }
      })
  }, [entityName, state.loadedName])

  const config = hasEntityConfig(entityName) ? getEntityConfig<TEntity, TFormValues>(entityName) : null

  return { config, isLoading: state.loading, error: state.error }
}
