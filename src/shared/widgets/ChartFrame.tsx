"use client"

/**
 * Measure-then-render gate for recharts charts.
 *
 * Recharts' `<ResponsiveContainer>` initialises with width/height = -1 and
 * logs "The width(-1) and height(-1) of chart should be greater than 0" on
 * every render that happens before its parent has a measured box — which is
 * common inside entrance animations, content-sized grid cells, and the first
 * paint before data resolves. Each of those renders also does real layout
 * work that is immediately thrown away.
 *
 * `ChartFrame` renders a sized wrapper div and only mounts its children (the
 * `<ResponsiveContainer>`) once that div reports a real box via a
 * `ResizeObserver`. The chart therefore never sees a -1 measurement: no
 * console spam, no wasted re-renders.
 *
 * Usage — wrap the existing sized div:
 *   <ChartFrame className="h-[160px] w-full">
 *     <ResponsiveContainer width="100%" height="100%">…</ResponsiveContainer>
 *   </ChartFrame>
 */

import { useEffect, useRef, useState, type HTMLAttributes, type ReactNode } from "react"

interface ChartFrameProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode
}

export function ChartFrame({ children, ...divProps }: ChartFrameProps): React.ReactNode {
  const ref = useRef<HTMLDivElement>(null)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const measure = () => {
      if (el.clientWidth > 0 && el.clientHeight > 0) setReady(true)
    }
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  return (
    <div ref={ref} {...divProps}>
      {ready ? children : null}
    </div>
  )
}
