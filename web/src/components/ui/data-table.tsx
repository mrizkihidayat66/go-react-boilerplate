// DataTable — the interactive layer on top of the presentational `table.tsx`
// primitives. Sorting, global filtering, row selection with bulk actions,
// column visibility and pagination, all client-side and generic over the row
// type. Adapted from the data-grid conventions shared by TanStack Table,
// Ant Design's Table and MUI's DataGrid, but with no extra dependency: the
// starter already ships every piece this needs.
//
// Usage:
//   const columns: DataTableColumn<User>[] = [
//     { id: 'name', header: 'Name', accessor: (u) => u.name, cell: (u) => u.name, sortable: true },
//   ]
//   <DataTable columns={columns} data={users} getRowId={(u) => u.id} />

import { ArrowDown, ArrowUp, ArrowUpDown, ChevronDown, Settings2, X } from 'lucide-react'
import * as React from 'react'

import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { cn } from '@/lib/utils'

export type SortDirection = 'asc' | 'desc'

export interface DataTableColumn<T> {
  /** Stable identity for the column — also used for sorting and visibility. */
  id: string
  /** Rendered in the header cell. */
  header: React.ReactNode
  /** Renders the cell body. */
  cell: (row: T) => React.ReactNode
  /**
   * Value used for sorting and global filtering. Omit to make the column
   * unsortable and invisible to the filter box (e.g. an actions column).
   */
  accessor?: (row: T) => string | number | null | undefined
  sortable?: boolean
  align?: 'left' | 'center' | 'right'
  className?: string
  headClassName?: string
  /** Set false to hide the column initially (the user can still show it). */
  defaultVisible?: boolean
  /** Set false to keep the column out of the visibility menu entirely. */
  hideable?: boolean
}

interface DataTableProps<T> {
  columns: DataTableColumn<T>[]
  data: T[]
  /** Stable row identity — required for selection. */
  getRowId: (row: T) => string | number
  /** Show the filter box. Default: true when there is more than one row. */
  enableFilter?: boolean
  filterPlaceholder?: string
  /** Checkbox column with a header select-all. Default: false. */
  enableSelection?: boolean
  onSelectionChange?: (selected: T[]) => void
  /** Rendered in the toolbar when at least one row is selected. */
  bulkActions?: (selected: T[]) => React.ReactNode
  /** Column visibility menu. Default: true when there are 3+ hideable columns. */
  enableColumnVisibility?: boolean
  /** Rows per page. Pass 0 to disable pagination. Default: 10. */
  pageSize?: number
  isLoading?: boolean
  emptyMessage?: string
  /** Extra controls placed at the end of the toolbar. */
  toolbar?: React.ReactNode
  className?: string
}

const alignClass: Record<NonNullable<DataTableColumn<unknown>['align']>, string> = {
  left: 'text-left',
  center: 'text-center',
  right: 'text-right',
}

function defaultCompare(a: unknown, b: unknown): number {
  if (a == null && b == null) return 0
  if (a == null) return -1
  if (b == null) return 1
  if (typeof a === 'number' && typeof b === 'number') return a - b
  return String(a).localeCompare(String(b), undefined, { numeric: true, sensitivity: 'base' })
}

export function DataTable<T>({
  columns,
  data,
  getRowId,
  enableFilter,
  filterPlaceholder = 'Filter…',
  enableSelection = false,
  onSelectionChange,
  bulkActions,
  enableColumnVisibility,
  pageSize = 10,
  isLoading = false,
  emptyMessage = 'No results.',
  toolbar,
  className,
}: DataTableProps<T>) {
  const [sort, setSort] = React.useState<{ id: string; direction: SortDirection } | null>(null)
  const [query, setQuery] = React.useState('')
  const [page, setPage] = React.useState(1)
  const [selected, setSelected] = React.useState<Set<string | number>>(new Set())
  const [hidden, setHidden] = React.useState<Set<string>>(
    () => new Set(columns.filter((c) => c.defaultVisible === false).map((c) => c.id)),
  )

  const showFilter = enableFilter ?? data.length > 1
  const showVisibility = enableColumnVisibility ?? columns.filter((c) => c.hideable !== false).length >= 3
  const paginate = pageSize > 0

  const visibleColumns = columns.filter((c) => !hidden.has(c.id))
  const filterable = columns.filter((c) => c.accessor)

  // Filter -> sort. Both are derived so they stay correct when `data` changes
  // (e.g. after a mutation invalidates the query).
  const filtered = React.useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return data
    return data.filter((row) =>
      filterable.some((col) => String(col.accessor?.(row) ?? '').toLowerCase().includes(q)),
    )
  }, [data, query, filterable])

  const sorted = React.useMemo(() => {
    if (!sort) return filtered
    const col = columns.find((c) => c.id === sort.id)
    if (!col?.accessor) return filtered
    const accessor = col.accessor
    const rows = [...filtered]
    rows.sort((a, b) => defaultCompare(accessor(a), accessor(b)))
    if (sort.direction === 'desc') rows.reverse()
    return rows
  }, [filtered, sort, columns])

  const pageCount = paginate ? Math.max(1, Math.ceil(sorted.length / pageSize)) : 1
  const currentPage = Math.min(page, pageCount)
  const rows = paginate ? sorted.slice((currentPage - 1) * pageSize, currentPage * pageSize) : sorted

  // Keep selection to rows that still exist after filtering.
  React.useEffect(() => {
    if (selected.size === 0) return
    const live = new Set(data.map(getRowId))
    const pruned = new Set([...selected].filter((id) => live.has(id)))
    if (pruned.size !== selected.size) setSelected(pruned)
  }, [data, getRowId, selected])

  React.useEffect(() => {
    if (!onSelectionChange) return
    onSelectionChange(data.filter((row) => selected.has(getRowId(row))))
    // onSelectionChange is intentionally not a dependency: callers pass inline
    // arrow functions, and including it would fire on every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected, data])

  const toggleSort = (col: DataTableColumn<T>) => {
    if (!col.sortable || !col.accessor) return
    setSort((prev) => {
      if (prev?.id !== col.id) return { id: col.id, direction: 'asc' }
      if (prev.direction === 'asc') return { id: col.id, direction: 'desc' }
      return null
    })
  }

  const pageIds = rows.map(getRowId)
  const allOnPageSelected = pageIds.length > 0 && pageIds.every((id) => selected.has(id))
  const someOnPageSelected = pageIds.some((id) => selected.has(id)) && !allOnPageSelected

  const toggleAllOnPage = (checked: boolean) => {
    setSelected((prev) => {
      const next = new Set(prev)
      for (const id of pageIds) {
        if (checked) next.add(id)
        else next.delete(id)
      }
      return next
    })
  }

  const toggleRow = (id: string | number, checked: boolean) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (checked) next.add(id)
      else next.delete(id)
      return next
    })
  }

  const selectedRows = data.filter((row) => selected.has(getRowId(row)))
  const hasSelection = selected.size > 0

  return (
    <div className={cn('space-y-3', className)}>
      {(showFilter || showVisibility || toolbar || hasSelection) && (
        <div className="flex flex-wrap items-center gap-2">
          {hasSelection && bulkActions ? (
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-muted-foreground text-sm">
                {selected.size} selected
              </span>
              {bulkActions(selectedRows)}
              <Button variant="ghost" size="sm" onClick={() => setSelected(new Set())}>
                <X className="size-3.5" />
                Clear
              </Button>
            </div>
          ) : (
            showFilter && (
              <Input
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value)
                  setPage(1)
                }}
                placeholder={filterPlaceholder}
                aria-label="Filter rows"
                className="h-9 max-w-xs"
              />
            )
          )}

          <div className="ml-auto flex items-center gap-2">
            {toolbar}
            {showVisibility && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm">
                    <Settings2 className="size-3.5" />
                    Columns
                    <ChevronDown className="size-3.5 opacity-60" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-44">
                  <DropdownMenuLabel>Toggle columns</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  {columns
                    .filter((c) => c.hideable !== false)
                    .map((col) => (
                      <DropdownMenuCheckboxItem
                        key={col.id}
                        checked={!hidden.has(col.id)}
                        onSelect={(e) => e.preventDefault()}
                        onCheckedChange={(checked) =>
                          setHidden((prev) => {
                            const next = new Set(prev)
                            if (checked) next.delete(col.id)
                            else next.add(col.id)
                            return next
                          })
                        }
                      >
                        {col.header}
                      </DropdownMenuCheckboxItem>
                    ))}
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>
        </div>
      )}

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              {enableSelection && (
                <TableHead className="w-10">
                  <Checkbox
                    checked={allOnPageSelected ? true : someOnPageSelected ? 'indeterminate' : false}
                    onCheckedChange={(v) => toggleAllOnPage(v === true)}
                    aria-label="Select all rows on this page"
                  />
                </TableHead>
              )}
              {visibleColumns.map((col) => {
                const sortable = Boolean(col.sortable && col.accessor)
                const active = sort?.id === col.id
                const Icon = !active ? ArrowUpDown : sort?.direction === 'asc' ? ArrowUp : ArrowDown
                return (
                  <TableHead
                    key={col.id}
                    aria-sort={active ? (sort?.direction === 'asc' ? 'ascending' : 'descending') : undefined}
                    className={cn(alignClass[col.align ?? 'left'], col.headClassName)}
                  >
                    {sortable ? (
                      <button
                        type="button"
                        onClick={() => toggleSort(col)}
                        className="hover:text-foreground focus-visible:ring-ring -mx-1 inline-flex items-center gap-1 rounded px-1 py-0.5 transition-colors focus-visible:ring-2 focus-visible:outline-none"
                      >
                        {col.header}
                        <Icon className={cn('size-3.5', active ? 'opacity-100' : 'opacity-40')} />
                      </button>
                    ) : (
                      col.header
                    )}
                  </TableHead>
                )
              })}
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              Array.from({ length: Math.min(pageSize || 5, 5) }).map((_, i) => (
                <TableRow key={`skeleton-${i}`}>
                  {enableSelection && (
                    <TableCell>
                      <Skeleton className="size-4" />
                    </TableCell>
                  )}
                  {visibleColumns.map((col) => (
                    <TableCell key={col.id}>
                      <Skeleton className="h-4 w-full max-w-40" />
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : rows.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={visibleColumns.length + (enableSelection ? 1 : 0)}
                  className="text-muted-foreground h-24 text-center"
                >
                  {emptyMessage}
                </TableCell>
              </TableRow>
            ) : (
              rows.map((row) => {
                const id = getRowId(row)
                const isSelected = selected.has(id)
                return (
                  <TableRow key={id} data-state={isSelected ? 'selected' : undefined}>
                    {enableSelection && (
                      <TableCell>
                        <Checkbox
                          checked={isSelected}
                          onCheckedChange={(v) => toggleRow(id, v === true)}
                          aria-label="Select row"
                        />
                      </TableCell>
                    )}
                    {visibleColumns.map((col) => (
                      <TableCell key={col.id} className={cn(alignClass[col.align ?? 'left'], col.className)}>
                        {col.cell(row)}
                      </TableCell>
                    ))}
                  </TableRow>
                )
              })
            )}
          </TableBody>
        </Table>
      </div>

      {paginate && sorted.length > pageSize && (
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-muted-foreground text-sm">
            {hasSelection ? `${selected.size} of ` : ''}
            {sorted.length} row{sorted.length === 1 ? '' : 's'}
            {query && ` (filtered from ${data.length})`}
          </p>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={currentPage <= 1}
            >
              Previous
            </Button>
            <span className="text-muted-foreground text-sm">
              Page {currentPage} of {pageCount}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => Math.min(pageCount, p + 1))}
              disabled={currentPage >= pageCount}
            >
              Next
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
