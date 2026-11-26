"use client"

import * as React from "react"
import { cn } from "cn"

/**
 * Labels each body cell with its column header (`data-label`) so a table with
 * `stackOnMobile` can show "Header: value" pairs when its rows become cards on
 * phones. Re-runs when rows are added or replaced.
 */
function labelCells(table: HTMLTableElement) {
  const headers = Array.from(table.querySelectorAll<HTMLTableCellElement>("thead tr:last-child th")).map((th) =>
    (th.textContent ?? "").trim()
  )
  table.querySelectorAll<HTMLTableRowElement>("tbody tr").forEach((tr) => {
    let col = 0
    Array.from(tr.cells).forEach((cell) => {
      const label = cell.colSpan > 1 ? "" : headers[col] ?? ""
      if (label) cell.setAttribute("data-label", label)
      else cell.removeAttribute("data-label")
      col += cell.colSpan
    })
  })
}

function Table({
  className,
  stackOnMobile = false,
  ...props
}: React.ComponentProps<"table"> & {
  /** Below the `sm` breakpoint, show each row as a card of "Header: value" pairs instead of scrolling sideways. */
  stackOnMobile?: boolean
}) {
  const ref = React.useRef<HTMLTableElement>(null)

  React.useEffect(() => {
    const table = ref.current
    if (!stackOnMobile || !table) return
    labelCells(table)
    const observer = new MutationObserver(() => labelCells(table))
    observer.observe(table, { childList: true, subtree: true, characterData: true })
    return () => observer.disconnect()
  }, [stackOnMobile])

  return (
    <div
      data-slot="table-container"
      className="relative w-full overflow-x-auto"
    >
      <table
        ref={ref}
        data-slot="table"
        data-stack={stackOnMobile ? "mobile" : undefined}
        className={cn("w-full caption-bottom text-sm", className)}
        {...props}
      />
    </div>
  )
}

function TableHeader({ className, ...props }: React.ComponentProps<"thead">) {
  return (
    <thead
      data-slot="table-header"
      className={cn("[&_tr]:border-b", className)}
      {...props}
    />
  )
}

function TableBody({ className, ...props }: React.ComponentProps<"tbody">) {
  return (
    <tbody
      data-slot="table-body"
      className={cn("[&_tr:last-child]:border-0", className)}
      {...props}
    />
  )
}

function TableFooter({ className, ...props }: React.ComponentProps<"tfoot">) {
  return (
    <tfoot
      data-slot="table-footer"
      className={cn(
        "border-t bg-muted/50 font-medium [&>tr]:last:border-b-0",
        className
      )}
      {...props}
    />
  )
}

function TableRow({ className, ...props }: React.ComponentProps<"tr">) {
  return (
    <tr
      data-slot="table-row"
      className={cn(
        "border-b transition-colors hover:bg-muted/50 has-aria-expanded:bg-muted/50 data-[state=selected]:bg-muted",
        className
      )}
      {...props}
    />
  )
}

function TableHead({ className, ...props }: React.ComponentProps<"th">) {
  return (
    <th
      data-slot="table-head"
      className={cn(
        "h-10 px-2 text-left align-middle font-medium whitespace-nowrap text-foreground [&:has([role=checkbox])]:pr-0",
        className
      )}
      {...props}
    />
  )
}

function TableCell({ className, ...props }: React.ComponentProps<"td">) {
  return (
    <td
      data-slot="table-cell"
      className={cn(
        "p-2 align-middle whitespace-nowrap [&:has([role=checkbox])]:pr-0",
        className
      )}
      {...props}
    />
  )
}

function TableCaption({
  className,
  ...props
}: React.ComponentProps<"caption">) {
  return (
    <caption
      data-slot="table-caption"
      className={cn("mt-4 text-sm text-muted-foreground", className)}
      {...props}
    />
  )
}

export {
  Table,
  TableHeader,
  TableBody,
  TableFooter,
  TableHead,
  TableRow,
  TableCell,
  TableCaption,
}
