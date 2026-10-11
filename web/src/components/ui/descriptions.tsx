import * as React from 'react'

import { cn } from '@/lib/utils'

// Key/value pairs for detail and profile views. `columns` controls how many
// pairs sit on one row at sm and up.

function Descriptions({
  columns = 1,
  className,
  ...props
}: React.ComponentProps<'dl'> & { columns?: 1 | 2 | 3 }) {
  const cols = { 1: 'sm:grid-cols-1', 2: 'sm:grid-cols-2', 3: 'sm:grid-cols-3' }[columns]
  return <dl className={cn('grid grid-cols-1 gap-x-6 gap-y-4', cols, className)} {...props} />
}

function DescriptionItem({ className, ...props }: React.ComponentProps<'div'>) {
  return <div className={cn('space-y-1', className)} {...props} />
}

function DescriptionTerm({ className, ...props }: React.ComponentProps<'dt'>) {
  return <dt className={cn('text-muted-foreground text-xs font-medium tracking-wide uppercase', className)} {...props} />
}

function DescriptionDetail({ className, ...props }: React.ComponentProps<'dd'>) {
  return <dd className={cn('text-sm', className)} {...props} />
}

export { Descriptions, DescriptionItem, DescriptionTerm, DescriptionDetail }
