import * as React from 'react'

import { cn } from '@/lib/utils'

// A vertical stack of rows — settings screens, feeds, search results. Distinct
// from `card`, which is a standalone panel, and from `table`, which is tabular.

function List({ className, ...props }: React.ComponentProps<'ul'>) {
  return <ul className={cn('divide-border divide-y rounded-md border', className)} {...props} />
}

function ListItem({
  className,
  selected,
  ...props
}: React.ComponentProps<'li'> & { selected?: boolean }) {
  return (
    <li
      data-state={selected ? 'selected' : undefined}
      className={cn('flex items-center gap-3 p-3 text-sm data-[state=selected]:bg-muted', className)}
      {...props}
    />
  )
}

function ListItemLeading({ className, ...props }: React.ComponentProps<'div'>) {
  return <div className={cn('flex shrink-0 items-center', className)} {...props} />
}

function ListItemContent({ className, ...props }: React.ComponentProps<'div'>) {
  return <div className={cn('min-w-0 flex-1 space-y-0.5', className)} {...props} />
}

function ListItemTitle({ className, ...props }: React.ComponentProps<'p'>) {
  return <p className={cn('truncate font-medium', className)} {...props} />
}

function ListItemDescription({ className, ...props }: React.ComponentProps<'p'>) {
  return <p className={cn('text-muted-foreground truncate text-sm', className)} {...props} />
}

function ListItemTrailing({ className, ...props }: React.ComponentProps<'div'>) {
  return <div className={cn('flex shrink-0 items-center gap-2', className)} {...props} />
}

export { List, ListItem, ListItemLeading, ListItemContent, ListItemTitle, ListItemDescription, ListItemTrailing }
