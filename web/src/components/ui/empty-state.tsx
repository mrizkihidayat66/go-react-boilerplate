import { Inbox } from 'lucide-react'
import * as React from 'react'

import { cn } from '@/lib/utils'

function EmptyState({
  icon,
  title,
  description,
  action,
  className,
  ...props
}: React.ComponentProps<'div'> & {
  icon?: React.ReactNode
  title: string
  description?: string
  /** Primary call to action, e.g. a Button. */
  action?: React.ReactNode
}) {
  return (
    <div
      className={cn('flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed p-10 text-center', className)}
      {...props}
    >
      <div className="bg-muted text-muted-foreground flex size-11 items-center justify-center rounded-full [&>svg]:size-5">
        {icon ?? <Inbox />}
      </div>
      <div className="space-y-1">
        <p className="font-medium">{title}</p>
        {description && <p className="text-muted-foreground max-w-sm text-sm">{description}</p>}
      </div>
      {action}
    </div>
  )
}

export { EmptyState }
