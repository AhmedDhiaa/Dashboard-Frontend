"use client"
// Calls useLocale() — required to be a Client Component. Enforced by
// scripts/check-rsc-boundaries.mjs.

import * as React from "react"
import { ChevronLeft, ChevronRight } from "lucide-react"
import { DayPicker } from "react-day-picker"
import { cn } from "@/shared/utils"
import { buttonVariants } from "@/ui/design-system/primitives/button"
import { useLocale } from "@/shared/config"

export type CalendarProps = React.ComponentProps<typeof DayPicker>

function Calendar({ className, classNames, showOutsideDays = true, ...props }: CalendarProps) {
  const { isRTL } = useLocale()

  return (
    <DayPicker
      dir={isRTL ? "rtl" : "ltr"}
      showOutsideDays={showOutsideDays}
      className={cn("p-6 select-none", className)}
      classNames={{
        months: "flex flex-row gap-12",
        month: "space-y-6",
        month_caption: "flex justify-between pt-1 relative items-center mb-6 px-1",
        caption_label: cn(
          "text-base font-black uppercase tracking-[0.15em] bg-gradient-to-r from-foreground to-primary bg-clip-text text-transparent",
          props.captionLayout === "dropdown" && "hidden",
        ),
        dropdowns: "flex justify-center items-center gap-3",
        nav: "flex items-center gap-2",
        button_previous: cn(
          buttonVariants({ variant: "ghost" }),
          "h-10 w-10 bg-gradient-to-br from-primary/10 to-primary/5 p-0 text-primary hover:from-primary/20 hover:to-primary/10 hover:text-primary transition-all rounded-xl border-2 border-primary/20 hover:border-primary/40 shadow-sm hover:shadow-md hover:shadow-primary/10 touch-manipulation focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2",
        ),
        button_next: cn(
          buttonVariants({ variant: "ghost" }),
          "h-10 w-10 bg-gradient-to-br from-primary/10 to-primary/5 p-0 text-primary hover:from-primary/20 hover:to-primary/10 hover:text-primary transition-all rounded-xl border-2 border-primary/20 hover:border-primary/40 shadow-sm hover:shadow-md hover:shadow-primary/10 touch-manipulation focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2",
        ),
        month_grid: "w-full border-collapse",
        weeks: "w-full",
        weekdays: "grid grid-cols-7 mb-5",
        weekday:
          "text-primary/60 font-black text-xs uppercase tracking-[0.15em] text-center flex items-center justify-center h-10",
        week: "grid grid-cols-7 mt-2",
        day: cn(
          "h-11 w-11 text-center text-sm p-0 relative transition-all duration-300 flex items-center justify-center rounded-xl",
          "aria-selected:bg-primary/5",
          "hover:bg-gradient-to-br hover:from-primary/20 hover:to-primary/10 hover:text-primary transition-all border-2 border-transparent hover:border-primary/30 active:scale-95 mx-auto touch-manipulation hover:shadow-lg hover:shadow-primary/10",
        ),
        day_button: cn(
          buttonVariants({ variant: "ghost" }),
          "h-11 w-11 p-0 font-bold aria-selected:opacity-100 rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2",
        ),
        range_end: "day-range-end select-none",
        range_start: "day-range-start select-none",
        selected: cn(
          "!bg-gradient-to-br !from-primary !to-primary/80 !text-primary-foreground hover:!from-primary hover:!to-primary/90 focus:!from-primary focus:!to-primary/90 shadow-xl shadow-primary/30 border-primary/50 scale-105 font-black",
          "relative after:absolute after:inset-0 after:rounded-xl after:shadow-[0_0_20px_rgba(var(--primary-rgb),0.4)] after:opacity-100",
        ),
        today:
          "bg-accent/10 text-accent-foreground ring-2 ring-accent/30 ring-offset-2 ring-offset-background font-black relative overflow-hidden",
        outside:
          "day-outside text-muted-foreground/30 opacity-40 aria-selected:bg-primary/5 aria-selected:text-muted-foreground/50 aria-selected:opacity-30",
        disabled: "text-muted-foreground/20 opacity-30 cursor-not-allowed",
        range_middle:
          "aria-selected:bg-gradient-to-r aria-selected:from-primary/15 aria-selected:to-primary/10 aria-selected:!text-primary font-bold border-primary/10",
        hidden: "invisible",
        // Dropdown styles - enhanced
        dropdown:
          "flex focus:outline-none appearance-none bg-gradient-to-br from-primary/10 to-primary/5 border-2 border-primary/20 rounded-xl px-3 py-2 cursor-pointer font-black text-sm hover:from-primary/20 hover:to-primary/10 hover:border-primary/40 transition-all focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 shadow-sm",
        dropdown_month: "min-w-[100px]",
        dropdown_year: "min-w-[80px]",
        ...classNames,
      }}
      components={{
        Chevron: ({ orientation }: { orientation?: "left" | "right" | "up" | "down" }) =>
          orientation === "left" ? (
            <ChevronLeft className="h-5 w-5 rtl:rotate-180" />
          ) : (
            <ChevronRight className="h-5 w-5 rtl:rotate-180" />
          ),
      }}
      {...props}
    />
  )
}
Calendar.displayName = "Calendar"

export { Calendar }
