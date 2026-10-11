import * as React from 'react'

import { cn } from '@/lib/utils'

// Activity/audit history. The connector line is drawn by each item, so the
// last one can omit it via `last`.

function Timeline({ className, ...props }: React.ComponentProps<'ol'>) {
  return <ol className={cn('relative space-y-4', className)} {...props} />
}

const dotVariants = {
  default: 'border-border bg-background',
  primary: 'border-primary bg-primary',
  success: 'border-green-600 bg-green-600 dark:border-green-500 dark:bg-green-500',
  destructive: 'border-destructive bg-destructive',
  muted: 'border-border bg-muted',
} as const

function TimelineItem({
  className,
  variant = 'default',
  icon,
  last = false,
  children,
  ...props
}: React.ComponentProps<'li'> & {
  variant?: keyof typeof dotVariants
  icon?: React.ReactNode
  last?: boolean
}) {
  return (
    <li className={cn('relative flex gap-3 pl-1', className)} {...props}>
      <div className="flex flex-col items-center">
        <span
          className={cn(
            'z-10 flex size-6 shrink-0 items-center justify-center rounded-full border-2 [&>svg]:size-3',
            dotVariants[variant],
            variant !== 'default' && variant !== 'muted' && 'text-white',
          )}
        >
          {icon}
        </span>
        {!last && <span className="bg-border w-px flex-1" />}
      </div>
      <div className="min-w-0 flex-1 pb-1">{children}</div>
    </li>
  )
}

function TimelineTitle({ className, ...props }: React.ComponentProps<'p'>) {
  return <p className={cn('text-sm font-medium', className)} {...props} />
}

function TimelineTime({ className, ...props }: React.ComponentProps<'time'>) {
  return <time className={cn('text-muted-foreground text-xs', className)} {...props} />
}

function TimelineDescription({ className, ...props }: React.ComponentProps<'p'>) {
  return <p className={cn('text-muted-foreground mt-0.5 text-sm', className)} {...props} />
}

export { Timeline, TimelineItem, TimelineTitle, TimelineTime, TimelineDescription }
