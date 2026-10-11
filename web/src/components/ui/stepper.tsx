import { Check } from 'lucide-react'
import * as React from 'react'

import { cn } from '@/lib/utils'

export interface Step {
  title: string
  description?: string
}

/** Multi-step form progress indicator. `current` is a zero-based index. */
function Stepper({ steps, current, className, ...props }: React.ComponentProps<'ol'> & { steps: Step[]; current: number }) {
  return (
    <ol className={cn('flex items-start', className)} {...props}>
      {steps.map((step, i) => {
        const done = i < current
        const active = i === current
        return (
          <li key={step.title} className={cn('flex flex-1 items-start gap-3', i > 0 && 'pl-3')}>
            {i > 0 && (
              <span
                aria-hidden
                className={cn('mt-4 -ml-3 h-px w-3 shrink-0', done || active ? 'bg-primary' : 'bg-border')}
              />
            )}
            <div className="flex min-w-0 flex-1 flex-col items-center gap-2 text-center">
              <span
                aria-current={active ? 'step' : undefined}
                className={cn(
                  'flex size-8 shrink-0 items-center justify-center rounded-full border-2 text-sm font-medium',
                  done && 'border-primary bg-primary text-primary-foreground',
                  active && 'border-primary text-primary',
                  !done && !active && 'border-border text-muted-foreground',
                )}
              >
                {done ? <Check className="size-4" /> : i + 1}
              </span>
              <div className="min-w-0">
                <p className={cn('text-sm font-medium', !done && !active && 'text-muted-foreground')}>{step.title}</p>
                {step.description && <p className="text-muted-foreground text-xs">{step.description}</p>}
              </div>
            </div>
          </li>
        )
      })}
    </ol>
  )
}

export { Stepper }
