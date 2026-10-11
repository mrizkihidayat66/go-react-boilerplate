// A 12-column responsive grid, in the spirit of Bootstrap's
// `col-{n}` / `col-{bp}-{n}`. Tailwind needs literal class names to
// detect them, so spans are resolved through static lookup maps rather
// than string interpolation.

import * as React from 'react'

import { cn } from '@/lib/utils'

export type Span = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12

/** A span per breakpoint; `base` applies below `sm`. */
export interface ResponsiveSpan {
  base?: Span
  sm?: Span
  md?: Span
  lg?: Span
  xl?: Span
}

const base: Record<Span, string> = {
  1: 'col-span-1',
  2: 'col-span-2',
  3: 'col-span-3',
  4: 'col-span-4',
  5: 'col-span-5',
  6: 'col-span-6',
  7: 'col-span-7',
  8: 'col-span-8',
  9: 'col-span-9',
  10: 'col-span-10',
  11: 'col-span-11',
  12: 'col-span-12',
}
const sm: Record<Span, string> = {
  1: 'sm:col-span-1',
  2: 'sm:col-span-2',
  3: 'sm:col-span-3',
  4: 'sm:col-span-4',
  5: 'sm:col-span-5',
  6: 'sm:col-span-6',
  7: 'sm:col-span-7',
  8: 'sm:col-span-8',
  9: 'sm:col-span-9',
  10: 'sm:col-span-10',
  11: 'sm:col-span-11',
  12: 'sm:col-span-12',
}
const md: Record<Span, string> = {
  1: 'md:col-span-1',
  2: 'md:col-span-2',
  3: 'md:col-span-3',
  4: 'md:col-span-4',
  5: 'md:col-span-5',
  6: 'md:col-span-6',
  7: 'md:col-span-7',
  8: 'md:col-span-8',
  9: 'md:col-span-9',
  10: 'md:col-span-10',
  11: 'md:col-span-11',
  12: 'md:col-span-12',
}
const lg: Record<Span, string> = {
  1: 'lg:col-span-1',
  2: 'lg:col-span-2',
  3: 'lg:col-span-3',
  4: 'lg:col-span-4',
  5: 'lg:col-span-5',
  6: 'lg:col-span-6',
  7: 'lg:col-span-7',
  8: 'lg:col-span-8',
  9: 'lg:col-span-9',
  10: 'lg:col-span-10',
  11: 'lg:col-span-11',
  12: 'lg:col-span-12',
}
const xl: Record<Span, string> = {
  1: 'xl:col-span-1',
  2: 'xl:col-span-2',
  3: 'xl:col-span-3',
  4: 'xl:col-span-4',
  5: 'xl:col-span-5',
  6: 'xl:col-span-6',
  7: 'xl:col-span-7',
  8: 'xl:col-span-8',
  9: 'xl:col-span-9',
  10: 'xl:col-span-10',
  11: 'xl:col-span-11',
  12: 'xl:col-span-12',
}

const maps = { base, sm, md, lg, xl } as const

/** Turn a span or responsive span into the matching Tailwind classes. */
export function spanClasses(span: Span | ResponsiveSpan | undefined): string {
  if (span == null) return ''
  if (typeof span === 'number') return base[span]
  return (Object.keys(maps) as (keyof typeof maps)[])
    .map((bp) => {
      const value = span[bp]
      return value ? maps[bp][value] : ''
    })
    .filter(Boolean)
    .join(' ')
}

const gridCols: Record<Span, string> = {
  1: 'grid-cols-1',
  2: 'grid-cols-2',
  3: 'grid-cols-3',
  4: 'grid-cols-4',
  5: 'grid-cols-5',
  6: 'grid-cols-6',
  7: 'grid-cols-7',
  8: 'grid-cols-8',
  9: 'grid-cols-9',
  10: 'grid-cols-10',
  11: 'grid-cols-11',
  12: 'grid-cols-12',
}

interface GridProps extends React.ComponentProps<'div'> {
  /** Number of columns at the smallest breakpoint (default 12). */
  cols?: Span
  /** Row gap utility; defaults to `gap-4`. */
  gap?: string
}

/** A 12-column grid container. Children should be `<GridItem>`. */
export function Grid({ cols = 12, gap = 'gap-4', className, ...props }: GridProps) {
  return <div className={cn('grid', gridCols[cols], gap, className)} {...props} />
}

interface GridItemProps extends React.ComponentProps<'div'> {
  /** Columns to span: a number (1–12) or a per-breakpoint object. */
  span?: Span | ResponsiveSpan
}

/** A grid cell that spans 1–12 columns, optionally per breakpoint. */
export function GridItem({ span, className, ...props }: GridItemProps) {
  return <div className={cn(spanClasses(span), className)} {...props} />
}
