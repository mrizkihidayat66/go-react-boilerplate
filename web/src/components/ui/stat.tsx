import { ArrowDownRight, ArrowUpRight, type LucideIcon } from 'lucide-react'
import * as React from 'react'

import { cn } from '@/lib/utils'

function StatGroup({ className, ...props }: React.ComponentProps<'div'>) {
  return <div className={cn('grid gap-4 sm:grid-cols-2 lg:grid-cols-3', className)} {...props} />
}

function Stat({
  label,
  value,
  delta,
  hint,
  icon: Icon,
  className,
  ...props
}: React.ComponentProps<'div'> & {
  label: string
  value: React.ReactNode
  /** Percentage change vs the previous period. Sign picks the colour. */
  delta?: number
  hint?: string
  icon?: LucideIcon
}) {
  const positive = (delta ?? 0) >= 0
  const DeltaIcon = positive ? ArrowUpRight : ArrowDownRight

  return (
    <div className={cn('rounded-lg border p-4', className)} {...props}>
      <div className="flex items-center justify-between gap-2">
        <p className="text-muted-foreground text-sm">{label}</p>
        {Icon && <Icon className="text-muted-foreground size-4" />}
      </div>
      <p className="mt-2 text-2xl font-semibold tracking-tight">{value}</p>
      {(delta !== undefined || hint) && (
        <div className="mt-1 flex items-center gap-1.5 text-xs">
          {delta !== undefined && (
            <span className={cn('inline-flex items-center gap-0.5 font-medium', positive ? 'text-green-600 dark:text-green-400' : 'text-destructive')}>
              <DeltaIcon className="size-3.5" />
              {positive ? '+' : ''}
              {delta}%
            </span>
          )}
          {hint && <span className="text-muted-foreground">{hint}</span>}
        </div>
      )}
    </div>
  )
}

export { Stat, StatGroup }
