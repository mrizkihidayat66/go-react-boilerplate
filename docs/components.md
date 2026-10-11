# UI components

Every primitive lives in `web/src/components/ui/` and is rendered, with
its variants and states, on the **`/components`** route — the living
style guide. Open that page first when you restyle the design system;
it is the fastest way to see what a token change does.

The primitives follow the shadcn/ui pattern: a thin wrapper around a
headless primitive (usually Radix) styled with Tailwind and CVA
variants, using the OKLCH design tokens declared in `web/src/index.css`.
You own the source — edit the file, not a theme config.

## Inventory

### Layout & structure

| Component | File | Notes |
|---|---|---|
| `Card` | `card.tsx` | Panel with `CardHeader` / `CardTitle` / `CardDescription` / `CardContent` / `CardFooter` |
| `Grid`, `GridItem` | `grid.tsx` | 12-column responsive grid. `span` takes a number or `{ base, sm, md, lg, xl }` |
| `Separator` | `separator.tsx` | Horizontal or vertical rule |
| `ScrollArea` | `scroll-area.tsx` | Custom scrollbar for a fixed-height region |
| `AspectRatio` | `aspect-ratio.tsx` | Reserves media space so the layout doesn't jump while loading |
| `Collapsible` | `collapsible.tsx` | Single show/hide region |
| `Accordion` | `accordion.tsx` | Stacked collapsible sections, single or multiple open |

### Navigation

| Component | File | Notes |
|---|---|---|
| `Breadcrumb` | `breadcrumb.tsx` | `List` / `Item` / `Link` / `Page` / `Separator` |
| `Pagination` | `pagination.tsx` | `Link` takes `isActive`; plus `Previous` / `Next` / `Ellipsis` |
| `Tabs` | `tabs.tsx` | Keyboard-navigable panels |
| `Stepper` | `stepper.tsx` | Multi-step progress; `current` is a zero-based index |

### Forms

| Component | File | Notes |
|---|---|---|
| `Input`, `Textarea`, `Label` | `input.tsx`, `textarea.tsx`, `label.tsx` | Base fields |
| `Checkbox`, `RadioGroup`, `Switch` | `checkbox.tsx`, `radio-group.tsx`, `switch.tsx` | Boolean, single-choice, toggle |
| `Select` | `select.tsx` | Radix select with search-free dropdown |
| `Combobox` | `combobox.tsx` | Searchable single-select; options take `keywords` |
| `Slider` | `slider.tsx` | One thumb per value — pass two for a range |
| `DatePicker` | `date-picker.tsx` | Popover-hosted date input |
| `Toggle`, `ToggleGroup` | `toggle.tsx`, `toggle-group.tsx` | Pressable formatting-style controls |

### Overlays

| Component | File | Notes |
|---|---|---|
| `Dialog` | `dialog.tsx` | `role="dialog"`; closes on Escape and outside click; has `DialogClose` |
| `ConfirmDialog` | `dialog.tsx` | `role="alertdialog"`; requires an explicit choice |
| `Sheet` | `sheet.tsx` | Off-canvas drawer; `side` = top / bottom / left / right |
| `DropdownMenu` | `dropdown-menu.tsx` | Includes `CheckboxItem` for toggles |
| `ContextMenu` | `context-menu.tsx` | Right-click actions |
| `Popover` | `popover.tsx` | Anchored content panel |
| `Tooltip` | `tooltip.tsx` | Short hint on hover/focus |
| `HoverCard` | `hover-card.tsx` | Rich hover preview (vs a plain tooltip) |
| `Command`, `CommandDialog` | `command.tsx` | cmdk-based ⌘K palette |

### Data display

| Component | File | Notes |
|---|---|---|
| `Table` | `table.tsx` | Presentational only — `Header` / `Body` / `Row` / `Head` / `Cell` |
| `DataTable` | `data-table.tsx` | The interactive layer: sorting, filtering, row selection, bulk actions, column visibility, pagination |
| `List` | `list.tsx` | Vertical item rows for settings and feeds |
| `Descriptions` | `descriptions.tsx` | Key/value pairs for detail views |
| `Timeline` | `timeline.tsx` | Activity / audit history |
| `Stat`, `StatGroup` | `stat.tsx` | Dashboard metric tiles with a delta |
| `Badge` | `badge.tsx` | Status chips |
| `Avatar` | `avatar.tsx` | Identity |
| `Progress` | `progress.tsx` | Determinate bar |

### Feedback

| Component | File | Notes |
|---|---|---|
| `Alert` | `alert.tsx` | Inline message; variants default / success / warning / destructive |
| `EmptyState` | `empty-state.tsx` | Zero-data screen with an optional action |
| `Spinner` | `spinner.tsx` | Indeterminate loading, sizes sm / default / lg |
| `Skeleton` | `skeleton.tsx` | Loading placeholder |

## Using the data table

`DataTable` is generic over the row type and needs no extra
dependency. Describe your columns and pass the rows:

```tsx
import { DataTable, type DataTableColumn } from '@/components/ui/data-table'

const columns: DataTableColumn<User>[] = [
  { id: 'name', header: 'Name', accessor: (u) => u.name, sortable: true,
    cell: (u) => <span className="font-medium">{u.name}</span> },
  { id: 'role', header: 'Role', accessor: (u) => u.role,
    cell: (u) => <Badge>{u.role}</Badge> },
]

<DataTable
  columns={columns}
  data={users}
  getRowId={(u) => u.id}
  enableSelection
  onSelectionChange={setSelected}
  pageSize={10}
  isLoading={query.isPending}
  bulkActions={() => <Button>Delete</Button>}
/>
```

- `accessor` powers both sorting and the filter box. Omit it for an
  actions column (it then sorts and filters out automatically).
- `defaultVisible: false` starts a column hidden; `hideable: false`
  keeps it out of the visibility menu.
- Filtering and sorting are derived with `useMemo`, so they stay correct
  after a mutation invalidates the query.

## Conventions

- **Tailwind v4 needs literal class names.** Class names are detected
  statically, so a dynamic `\`col-span-${n}\`` produces no CSS. That is
  why `grid.tsx` maps spans through a `Record<Span, string>` of full
  class strings instead of interpolating.
- **Semantic tokens, not raw colours.** Use `bg-background`,
  `text-muted-foreground`, `border-border`, `bg-primary` — they resolve
  to the OKLCH variables and follow the light/dark switch. Reach for a
  raw colour only for a one-off (e.g. the green in `success`).
- **`cn()` for merging.** Import from `@/lib/utils` so callers can
  override styles via `className`.
- **Icons are `lucide-react`**, sized `size-4` inside buttons and
  alerts. Icon-bearing `Alert`s need their text wrapped in a `<div>` so
  the flex row has exactly two children and the icon stays vertically
  centred regardless of how many lines the text takes.

## Adding a component

1. Create `web/src/components/ui/<name>.tsx` following the pattern of a
   neighbour (headless primitive → `cn()` → CVA variants → named
   exports).
2. Add a section to `pages/components.tsx` rendering every variant.
3. Add a Playwright case to `e2e/components.spec.ts` for its
   interactive behaviour, and add the section title to the
   `renders every section` list.
