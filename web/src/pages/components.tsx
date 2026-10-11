// Component showcase — the starter's living style guide. Every UI
// primitive is rendered here with its variants, so restyling the design
// system has an immediate visual reference (like Bootstrap's component
// gallery). Route: /components (any authenticated user).

import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation } from '@tanstack/react-query'
import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  AlertCircle,
  AlertTriangle,
  Bell,
  Bold,
  CheckCircle2,
  ChevronDown,
  Copy,
  Info,
  Italic,
  Loader2,
  Mail,
  Menu,
  Pencil,
  Star,
  Trash2,
  Underline,
} from 'lucide-react'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { toast } from 'sonner'
import { z } from 'zod'

import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { AspectRatio } from '@/components/ui/aspect-ratio'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { Combobox } from '@/components/ui/combobox'
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandShortcut,
} from '@/components/ui/command'
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuLabel,
  ContextMenuSeparator,
  ContextMenuShortcut,
  ContextMenuTrigger,
} from '@/components/ui/context-menu'
import { DataTable, type DataTableColumn } from '@/components/ui/data-table'
import { DatePicker } from '@/components/ui/date-picker'
import { DescriptionDetail, DescriptionItem, Descriptions, DescriptionTerm } from '@/components/ui/descriptions'
import { EmptyState } from '@/components/ui/empty-state'
import { HoverCard, HoverCardContent, HoverCardTrigger } from '@/components/ui/hover-card'
import { List, ListItem, ListItemContent, ListItemDescription, ListItemLeading, ListItemTitle, ListItemTrailing } from '@/components/ui/list'
import { Stat, StatGroup } from '@/components/ui/stat'
import { Stepper } from '@/components/ui/stepper'
import { Timeline, TimelineDescription, TimelineItem, TimelineTime, TimelineTitle } from '@/components/ui/timeline'
import {
  ConfirmDialog,
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Grid, GridItem } from '@/components/ui/grid'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from '@/components/ui/pagination'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Progress } from '@/components/ui/progress'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet'
import { Skeleton } from '@/components/ui/skeleton'
import { Slider } from '@/components/ui/slider'
import { Spinner } from '@/components/ui/spinner'
import { Switch } from '@/components/ui/switch'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Textarea } from '@/components/ui/textarea'
import { Toggle } from '@/components/ui/toggle'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { useDocumentTitle } from '@/lib/use-document-title'

function Section({
  title,
  description,
  children,
}: {
  title: string
  description?: string
  children: React.ReactNode
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">{title}</CardTitle>
        {description && <CardDescription>{description}</CardDescription>}
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  )
}

function Row({ label, children }: { label?: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-center gap-3">
      {label && <span className="text-muted-foreground w-28 shrink-0 text-sm">{label}</span>}
      {children}
    </div>
  )
}

const demoSchema = z.object({
  name: z.string().min(2, 'Must be at least 2 characters.'),
  email: z.string().email('Must be a valid email address.'),
})

type DemoForm = z.infer<typeof demoSchema>

interface DemoUser {
  id: number
  name: string
  role: 'admin' | 'user'
  active: boolean
}

const initialRows: DemoUser[] = [
  { id: 1, name: 'Ada Lovelace', role: 'admin', active: true },
  { id: 2, name: 'Grace Hopper', role: 'user', active: false },
  { id: 3, name: 'Alan Turing', role: 'user', active: true },
]

/** A table whose Edit action opens a working, pre-filled dialog. */
function EditableTable() {
  const [rows, setRows] = useState<DemoUser[]>(initialRows)
  const [editing, setEditing] = useState<DemoUser | null>(null)
  const [draft, setDraft] = useState<DemoUser | null>(null)

  const openEdit = (row: DemoUser) => {
    setEditing(row)
    setDraft({ ...row })
  }

  const save = () => {
    if (!draft) return
    setRows((prev) => prev.map((r) => (r.id === draft.id ? draft : r)))
    toast.success(`Updated “${draft.name}”.`)
    setEditing(null)
  }

  return (
    <>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead>Role</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row) => (
            <TableRow key={row.id}>
              <TableCell className="font-medium">{row.name}</TableCell>
              <TableCell>
                <Badge variant={row.role === 'admin' ? 'default' : 'secondary'}>{row.role}</Badge>
              </TableCell>
              <TableCell>
                <Badge variant={row.active ? 'success' : 'destructive'}>
                  {row.active ? 'Active' : 'Disabled'}
                </Badge>
              </TableCell>
              <TableCell className="text-right">
                <Button variant="outline" size="sm" onClick={() => openEdit(row)}>
                  <Pencil className="size-3.5" />
                  Edit
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      {/* Controlled dialog: `open` follows `editing`, so Cancel and the
          backdrop both clear the selection. */}
      <Dialog open={editing !== null} onOpenChange={(open) => !open && setEditing(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Edit user</DialogTitle>
            <DialogDescription>Change the values and confirm to apply them to the row.</DialogDescription>
          </DialogHeader>
          {draft && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="edit-name">Name</Label>
                <Input
                  id="edit-name"
                  value={draft.name}
                  onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-role">Role</Label>
                <Select
                  value={draft.role}
                  onValueChange={(v) => setDraft({ ...draft, role: v as DemoUser['role'] })}
                >
                  <SelectTrigger id="edit-role">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="user">User</SelectItem>
                    <SelectItem value="admin">Admin</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center justify-between rounded-md border p-3">
                <Label htmlFor="edit-active" className="cursor-pointer">
                  Active
                </Label>
                <Switch
                  id="edit-active"
                  checked={draft.active}
                  onCheckedChange={(v) => setDraft({ ...draft, active: v })}
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline">Cancel</Button>
            </DialogClose>
            <Button onClick={save} disabled={!draft?.name.trim()}>
              Save changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}

interface DemoRecord {
  id: number
  name: string
  email: string
  role: 'admin' | 'user'
  status: 'active' | 'invited' | 'disabled'
  lastSeen: string
}

const demoRecords: DemoRecord[] = [
  { id: 1, name: 'Ada Lovelace', email: 'ada@example.com', role: 'admin', status: 'active', lastSeen: '2026-10-09' },
  { id: 2, name: 'Grace Hopper', email: 'grace@example.com', role: 'admin', status: 'active', lastSeen: '2026-10-11' },
  { id: 3, name: 'Alan Turing', email: 'alan@example.com', role: 'user', status: 'disabled', lastSeen: '2026-08-02' },
  { id: 4, name: 'Katherine Johnson', email: 'katherine@example.com', role: 'user', status: 'active', lastSeen: '2026-10-10' },
  { id: 5, name: 'Margaret Hamilton', email: 'margaret@example.com', role: 'user', status: 'invited', lastSeen: '—' },
  { id: 6, name: 'Barbara Liskov', email: 'barbara@example.com', role: 'user', status: 'active', lastSeen: '2026-09-28' },
  { id: 7, name: 'Donald Knuth', email: 'donald@example.com', role: 'user', status: 'invited', lastSeen: '—' },
  { id: 8, name: 'Barbara McClintock', email: 'bmc@example.com', role: 'user', status: 'active', lastSeen: '2026-10-01' },
  { id: 9, name: 'Edsger Dijkstra', email: 'edsger@example.com', role: 'admin', status: 'active', lastSeen: '2026-07-14' },
  { id: 10, name: 'Radia Perlman', email: 'radia@example.com', role: 'user', status: 'disabled', lastSeen: '2026-05-30' },
  { id: 11, name: 'Shafi Goldwasser', email: 'shafi@example.com', role: 'user', status: 'active', lastSeen: '2026-10-08' },
  { id: 12, name: 'Frances Allen', email: 'frances@example.com', role: 'user', status: 'invited', lastSeen: '—' },
]

/** A full data table: sort, filter, select, hide columns, paginate. */
function DataTableDemo() {
  const [selected, setSelected] = useState<DemoRecord[]>([])

  const columns: DataTableColumn<DemoRecord>[] = [
    { id: 'name', header: 'Name', accessor: (r) => r.name, sortable: true, cell: (r) => <span className="font-medium">{r.name}</span> },
    { id: 'email', header: 'Email', accessor: (r) => r.email, sortable: true, cell: (r) => <span className="text-muted-foreground">{r.email}</span> },
    {
      id: 'role',
      header: 'Role',
      accessor: (r) => r.role,
      sortable: true,
      cell: (r) => <Badge variant={r.role === 'admin' ? 'default' : 'secondary'}>{r.role}</Badge>,
    },
    {
      id: 'status',
      header: 'Status',
      accessor: (r) => r.status,
      sortable: true,
      cell: (r) => (
        <Badge variant={r.status === 'active' ? 'success' : r.status === 'invited' ? 'outline' : 'destructive'}>
          {r.status}
        </Badge>
      ),
    },
    { id: 'lastSeen', header: 'Last seen', accessor: (r) => r.lastSeen, sortable: true, cell: (r) => r.lastSeen },
    {
      id: 'actions',
      header: '',
      align: 'right',
      hideable: false,
      cell: (r) => (
        <Button variant="ghost" size="sm" onClick={() => toast.info(`Edit ${r.name} (demo).`)}>
          <Pencil className="size-3.5" />
          Edit
        </Button>
      ),
    },
  ]

  return (
    <DataTable
      columns={columns}
      data={demoRecords}
      getRowId={(r) => r.id}
      enableSelection
      onSelectionChange={setSelected}
      pageSize={5}
      bulkActions={() => (
        <Button
          variant="outline"
          size="sm"
          onClick={() => toast.success(`Acting on ${selected.length} row(s) (demo).`)}
        >
          <Trash2 className="size-3.5" />
          Delete
        </Button>
      )}
      emptyMessage="No users match the current filter."
    />
  )
}

export function ComponentsPage() {
  useDocumentTitle('Components')
  const form = useForm<DemoForm>({
    resolver: zodResolver(demoSchema),
    defaultValues: { name: '', email: '' },
  })

  const [date, setDate] = useState<string>('')
  const [accepted, setAccepted] = useState(false)
  const [plan, setPlan] = useState('pro')
  const [notifications, setNotifications] = useState(true)
  const [align, setAlign] = useState('left')
  const [volume, setVolume] = useState([40])
  const [priceRange, setPriceRange] = useState([20, 80])
  const [page, setPage] = useState(2)
  const [collapsibleOpen, setCollapsibleOpen] = useState(false)
  const [commandOpen, setCommandOpen] = useState(false)
  const [framework, setFramework] = useState('')
  const [step, setStep] = useState(1)

  const submit = useMutation({
    mutationFn: async (values: DemoForm) => {
      // Simulated save so the demo needs no backend.
      await new Promise((r) => setTimeout(r, 600))
      return values
    },
    onSuccess: (values) => toast.success(`Saved “${values.name}”.`),
  })

  return (
    <TooltipProvider delayDuration={200}>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Components</h1>
          <p className="text-muted-foreground text-sm">
            The starter's UI primitives and states — a living style guide for restyling.
          </p>
        </div>

        {/* Typography */}
        <Section title="Typography" description="Text scale from page title to caption.">
          <div className="space-y-2">
            <p className="text-2xl font-semibold tracking-tight">Heading / text-2xl</p>
            <p className="text-lg font-semibold">Section title / text-lg</p>
            <p className="text-base">Body text / text-base</p>
            <p className="text-muted-foreground text-sm">Muted helper text / text-sm</p>
            <p className="text-muted-foreground text-xs">Caption / text-xs</p>
            <p className="text-destructive text-sm">Destructive error message</p>
          </div>
        </Section>

        {/* Buttons */}
        <Section title="Buttons" description="Variants and sizes; every state an interactive element can be in.">
          <div className="space-y-4">
            <Row label="Variants">
              <Button>Default</Button>
              <Button variant="secondary">Secondary</Button>
              <Button variant="outline">Outline</Button>
              <Button variant="ghost">Ghost</Button>
              <Button variant="destructive">Destructive</Button>
              <Button variant="link">Link</Button>
            </Row>
            <Row label="Sizes">
              <Button size="sm">Small</Button>
              <Button size="default">Default</Button>
              <Button size="lg">Large</Button>
              <Button size="icon" aria-label="Icon example">
                <Info className="size-4" />
              </Button>
            </Row>
            <Row label="States">
              <Button disabled>Disabled</Button>
              <Button disabled variant="outline">
                Disabled outline
              </Button>
              <Button>
                <Loader2 className="size-4 animate-spin" />
                Loading
              </Button>
            </Row>
            <Row label="With icon">
              <Button variant="destructive">
                <Trash2 className="size-4" />
                Delete
              </Button>
            </Row>
          </div>
        </Section>

        {/* Badges */}
        <Section title="Badges" description="Status chips used in tables and headers.">
          <Row>
            <Badge>Default</Badge>
            <Badge variant="secondary">Secondary</Badge>
            <Badge variant="outline">Outline</Badge>
            <Badge variant="success">
              <CheckCircle2 />
              Active
            </Badge>
            <Badge variant="destructive">Disabled</Badge>
          </Row>
        </Section>

        {/* Alerts */}
        <Section title="Alerts" description="Inline messages for information, success, warning and error.">
          <div className="space-y-3">
            <Alert>
              <Info className="size-4" />
              <div>
                <AlertTitle>Heads up</AlertTitle>
                <AlertDescription>Neutral information the user should notice but need not act on.</AlertDescription>
              </div>
            </Alert>
            <Alert variant="success">
              <CheckCircle2 className="size-4" />
              <div>
                <AlertTitle>Saved</AlertTitle>
                <AlertDescription>Your changes were stored successfully.</AlertDescription>
              </div>
            </Alert>
            <Alert variant="warning">
              <AlertTriangle className="size-4" />
              <div>
                <AlertTitle>Check your input</AlertTitle>
                <AlertDescription>Some fields look incomplete — review them before continuing.</AlertDescription>
              </div>
            </Alert>
            <Alert variant="destructive">
              <AlertCircle className="size-4" />
              <div>
                <AlertTitle>Something went wrong</AlertTitle>
                <AlertDescription>We could not reach the server. Try again in a moment.</AlertDescription>
              </div>
            </Alert>
          </div>
        </Section>

        {/* Inputs & form states */}
        <Section title="Inputs & form states" description="Filled, focused, error and disabled states with helper text.">
          <form className="grid max-w-lg gap-4" onSubmit={form.handleSubmit((v) => submit.mutate(v))} noValidate>
            <div className="space-y-2">
              <Label htmlFor="demo-name">Name</Label>
              <Input id="demo-name" placeholder="Jane Doe" {...form.register('name')} />
              {form.formState.errors.name ? (
                <p className="text-destructive text-sm">{form.formState.errors.name.message}</p>
              ) : (
                <p className="text-muted-foreground text-xs">Helper text: your display name.</p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="demo-email">Email</Label>
              <Input id="demo-email" type="email" placeholder="jane@example.com" {...form.register('email')} />
              {form.formState.errors.email && (
                <p className="text-destructive text-sm">{form.formState.errors.email.message}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="demo-notes">Notes</Label>
              <Textarea id="demo-notes" placeholder="Free-form, multi-line input." rows={3} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="demo-disabled">Disabled input</Label>
              <Input id="demo-disabled" disabled placeholder="Not editable" />
            </div>
            <Button type="submit" className="w-fit" disabled={submit.isPending}>
              {submit.isPending && <Loader2 className="size-4 animate-spin" />}
              Submit demo form
            </Button>
          </form>
        </Section>

        {/* Selection controls */}
        <Section title="Checkbox, radio & switch" description="Boolean, single-choice and toggle controls.">
          <Grid gap="gap-6">
            <GridItem span={{ base: 12, md: 4 }}>
              <p className="mb-3 text-sm font-medium">Checkbox</p>
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="demo-terms"
                    checked={accepted}
                    onCheckedChange={(v) => setAccepted(v === true)}
                  />
                  <Label htmlFor="demo-terms" className="cursor-pointer">
                    I accept the terms
                  </Label>
                </div>
                <div className="flex items-center gap-2">
                  <Checkbox id="demo-checked" defaultChecked />
                  <Label htmlFor="demo-checked" className="cursor-pointer">
                    Pre-checked
                  </Label>
                </div>
                <div className="flex items-center gap-2">
                  <Checkbox id="demo-check-disabled" disabled />
                  <Label htmlFor="demo-check-disabled" className="text-muted-foreground cursor-not-allowed">
                    Disabled
                  </Label>
                </div>
                <p className="text-muted-foreground text-xs">
                  State: {accepted ? 'accepted' : 'not accepted'}
                </p>
              </div>
            </GridItem>

            <GridItem span={{ base: 12, md: 4 }}>
              <p className="mb-3 text-sm font-medium">Radio group</p>
              <RadioGroup value={plan} onValueChange={setPlan}>
                <div className="flex items-center gap-2">
                  <RadioGroupItem value="free" id="plan-free" />
                  <Label htmlFor="plan-free" className="cursor-pointer">
                    Free
                  </Label>
                </div>
                <div className="flex items-center gap-2">
                  <RadioGroupItem value="pro" id="plan-pro" />
                  <Label htmlFor="plan-pro" className="cursor-pointer">
                    Pro
                  </Label>
                </div>
                <div className="flex items-center gap-2">
                  <RadioGroupItem value="team" id="plan-team" />
                  <Label htmlFor="plan-team" className="cursor-pointer">
                    Team
                  </Label>
                </div>
              </RadioGroup>
              <p className="text-muted-foreground mt-3 text-xs">Selected: {plan}</p>
            </GridItem>

            <GridItem span={{ base: 12, md: 4 }}>
              <p className="mb-3 text-sm font-medium">Switch</p>
              <div className="flex items-center justify-between rounded-md border p-3">
                <Label htmlFor="demo-notify" className="cursor-pointer">
                  Email notifications
                </Label>
                <Switch id="demo-notify" checked={notifications} onCheckedChange={setNotifications} />
              </div>
              <p className="text-muted-foreground mt-3 text-xs">
                {notifications ? 'Notifications on' : 'Notifications off'}
              </p>
            </GridItem>
          </Grid>
        </Section>

        {/* Select & date picker */}
        <Section title="Select & date picker" description="Dropdown selection and a popover-hosted date input.">
          <Grid gap="gap-4">
            <GridItem span={{ base: 12, sm: 6 }}>
              <div className="space-y-2">
                <Label htmlFor="demo-select">Role</Label>
                <Select defaultValue="user">
                  <SelectTrigger id="demo-select">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="user">User</SelectItem>
                    <SelectItem value="admin">Admin</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </GridItem>
            <GridItem span={{ base: 12, sm: 6 }}>
              <div className="space-y-2">
                <Label htmlFor="demo-select-disabled">Disabled</Label>
                <Select defaultValue="user" disabled>
                  <SelectTrigger id="demo-select-disabled">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="user">User</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </GridItem>
            <GridItem span={{ base: 12, sm: 6 }}>
              <div className="space-y-2">
                <Label>Date</Label>
                <DatePicker value={date} onChange={setDate} />
                <p className="text-muted-foreground text-xs">Selected: {date || '—'}</p>
              </div>
            </GridItem>
          </Grid>
        </Section>

        {/* Overlays */}
        <Section title="Tooltip & popover" description="Lightweight overlays for hints and small content panels.">
          <Row>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="outline">Hover me</Button>
              </TooltipTrigger>
              <TooltipContent>Tooltips appear on hover and focus.</TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon" aria-label="Notifications">
                  <Bell className="size-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom">Notifications</TooltipContent>
            </Tooltip>

            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline">Open popover</Button>
              </PopoverTrigger>
              <PopoverContent className="w-64">
                <div className="space-y-2">
                  <p className="text-sm font-medium">Popover content</p>
                  <p className="text-muted-foreground text-xs">
                    Popovers hold richer content than a tooltip and stay open until dismissed.
                  </p>
                  <Button size="sm" className="w-full" onClick={() => toast.info('Action from popover.')}>
                    Do something
                  </Button>
                </div>
              </PopoverContent>
            </Popover>
          </Row>
        </Section>

        {/* Tabs */}
        <Section title="Tabs" description="Keyboard-navigable panels for grouping related content.">
          <Tabs defaultValue="overview">
            <TabsList>
              <TabsTrigger value="overview">Overview</TabsTrigger>
              <TabsTrigger value="activity">Activity</TabsTrigger>
              <TabsTrigger value="settings">Settings</TabsTrigger>
            </TabsList>
            <TabsContent value="overview" className="text-muted-foreground text-sm">
              A summary of the record. Each panel mounts only when active.
            </TabsContent>
            <TabsContent value="activity" className="text-muted-foreground text-sm">
              A timeline of recent changes would live here.
            </TabsContent>
            <TabsContent value="settings" className="text-muted-foreground text-sm">
              Configuration options for the record.
            </TabsContent>
          </Tabs>
        </Section>

        {/* Accordion */}
        <Section title="Accordion" description="Collapsible sections, single or multiple open at once.">
          <Accordion type="single" collapsible className="w-full">
            <AccordionItem value="item-1">
              <AccordionTrigger>What is this boilerplate?</AccordionTrigger>
              <AccordionContent>
                A Go API and a React SPA shipped as one binary, with auth, users CRUD and a design system.
              </AccordionContent>
            </AccordionItem>
            <AccordionItem value="item-2">
              <AccordionTrigger>How is the SPA served?</AccordionTrigger>
              <AccordionContent>
                The Vite build is embedded with <code>go:embed</code> and served from the same origin as the API.
              </AccordionContent>
            </AccordionItem>
            <AccordionItem value="item-3">
              <AccordionTrigger>Where do I add a new page?</AccordionTrigger>
              <AccordionContent>
                Create a component under <code>src/pages</code>, then register a route in <code>main.tsx</code>.
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </Section>

        {/* Toggles */}
        <Section title="Toggle & toggle group" description="Pressable buttons for formatting-style controls.">
          <div className="space-y-4">
            <Row label="Toggle">
              <Toggle aria-label="Star">
                <Star className="size-4" />
              </Toggle>
              <Toggle variant="outline" aria-label="Bold">
                <Bold className="size-4" />
              </Toggle>
              <Toggle variant="outline" defaultPressed aria-label="Italic">
                <Italic className="size-4" />
              </Toggle>
            </Row>
            <Row label="Group">
              <ToggleGroup type="single" value={align} onValueChange={(v) => v && setAlign(v)} variant="outline">
                <ToggleGroupItem value="left" aria-label="Align left">
                  <AlignLeft className="size-4" />
                </ToggleGroupItem>
                <ToggleGroupItem value="center" aria-label="Align center">
                  <AlignCenter className="size-4" />
                </ToggleGroupItem>
                <ToggleGroupItem value="right" aria-label="Align right">
                  <AlignRight className="size-4" />
                </ToggleGroupItem>
              </ToggleGroup>
            </Row>
            <Row label="Multiple">
              <ToggleGroup type="multiple" variant="outline">
                <ToggleGroupItem value="bold" aria-label="Bold">
                  <Bold className="size-4" />
                </ToggleGroupItem>
                <ToggleGroupItem value="italic" aria-label="Italic">
                  <Italic className="size-4" />
                </ToggleGroupItem>
                <ToggleGroupItem value="underline" aria-label="Underline">
                  <Underline className="size-4" />
                </ToggleGroupItem>
              </ToggleGroup>
            </Row>
          </div>
        </Section>

        {/* Avatar, progress, separator */}
        <Section title="Avatar, progress & separator" description="Identity, completion and section dividers.">
          <div className="space-y-6">
            <Row label="Avatar">
              <Avatar>
                <AvatarFallback>AL</AvatarFallback>
              </Avatar>
              <Avatar>
                <AvatarFallback>GH</AvatarFallback>
              </Avatar>
              <Avatar className="size-12">
                <AvatarFallback>AT</AvatarFallback>
              </Avatar>
            </Row>
            <div className="space-y-2">
              <p className="text-sm font-medium">Progress</p>
              <Progress value={35} />
              <Progress value={72} />
              <Progress value={100} />
            </div>
            <div className="space-y-2">
              <p className="text-sm font-medium">Separator</p>
              <p className="text-muted-foreground text-sm">Above the rule</p>
              <Separator />
              <p className="text-muted-foreground text-sm">Below the rule</p>
            </div>
          </div>
        </Section>

        {/* Grid system */}
        <Section
          title="Responsive grid"
          description="A 12-column grid. Spans accept a number (1–12) or a per-breakpoint object: base, sm, md, lg, xl."
        >
          <div className="space-y-6">
            <div>
              <p className="text-muted-foreground mb-2 text-sm">12 equal columns — span=1</p>
              <Grid gap="gap-2">
                {Array.from({ length: 12 }).map((_, i) => (
                  <GridItem key={i} span={1}>
                    <div className="bg-muted text-muted-foreground rounded px-1 py-2 text-center text-xs">1</div>
                  </GridItem>
                ))}
              </Grid>
            </div>

            <div>
              <p className="text-muted-foreground mb-2 text-sm">
                Common layouts — 12 / 6+6 / 4+4+4 / 8+4
              </p>
              <div className="space-y-2">
                <Grid gap="gap-2">
                  <GridItem span={12}>
                    <div className="bg-primary/10 text-center text-xs rounded py-2">12</div>
                  </GridItem>
                </Grid>
                <Grid gap="gap-2">
                  <GridItem span={6}>
                    <div className="bg-primary/10 text-center text-xs rounded py-2">6</div>
                  </GridItem>
                  <GridItem span={6}>
                    <div className="bg-primary/10 text-center text-xs rounded py-2">6</div>
                  </GridItem>
                </Grid>
                <Grid gap="gap-2">
                  <GridItem span={4}>
                    <div className="bg-primary/10 text-center text-xs rounded py-2">4</div>
                  </GridItem>
                  <GridItem span={4}>
                    <div className="bg-primary/10 text-center text-xs rounded py-2">4</div>
                  </GridItem>
                  <GridItem span={4}>
                    <div className="bg-primary/10 text-center text-xs rounded py-2">4</div>
                  </GridItem>
                </Grid>
                <Grid gap="gap-2">
                  <GridItem span={8}>
                    <div className="bg-primary/10 text-center text-xs rounded py-2">8</div>
                  </GridItem>
                  <GridItem span={4}>
                    <div className="bg-primary/10 text-center text-xs rounded py-2">4</div>
                  </GridItem>
                </Grid>
              </div>
            </div>

            <div>
              <p className="text-muted-foreground mb-2 text-sm">
                Responsive — full width on mobile, halves at md, thirds at lg. Resize the window.
              </p>
              <Grid gap="gap-2">
                {['A', 'B', 'C', 'D', 'E', 'F'].map((label) => (
                  <GridItem key={label} span={{ base: 12, md: 6, lg: 4 }}>
                    <div className="bg-primary/10 text-center text-xs rounded py-4">
                      {label} · base 12 / md 6 / lg 4
                    </div>
                  </GridItem>
                ))}
              </Grid>
            </div>
          </div>
        </Section>

        {/* Cards */}
        <Section title="Cards" description="The container primitive for panels and dialog content.">
          <Grid gap="gap-4">
            <GridItem span={{ base: 12, sm: 6 }}>
              <Card>
                <CardHeader>
                  <CardDescription>Card with header</CardDescription>
                  <CardTitle className="text-base">Monthly users</CardTitle>
                </CardHeader>
                <CardContent className="text-muted-foreground text-sm">1,204 (+12% vs last month)</CardContent>
              </Card>
            </GridItem>
            <GridItem span={{ base: 12, sm: 6 }}>
              <Card>
                <CardHeader>
                  <CardDescription>Empty card</CardDescription>
                  <CardTitle className="text-base">Nothing here yet</CardTitle>
                </CardHeader>
                <CardContent className="text-muted-foreground text-sm">
                  Cards render fine with minimal content.
                </CardContent>
              </Card>
            </GridItem>
          </Grid>
        </Section>

        {/* Table with working edit */}
        <Section
          title="Table with edit dialog"
          description="The Edit action opens a controlled dialog pre-filled with the row's values."
        >
          <EditableTable />
        </Section>

        {/* Data table */}
        <Section
          title="Data table"
          description="Sortable, filterable, selectable, paginated — with a column-visibility menu and bulk actions. Click a header to sort; use the checkboxes to select."
        >
          <DataTableDemo />
        </Section>

        {/* Combobox & command palette */}
        <Section
          title="Combobox & command palette"
          description="A searchable select, plus a ⌘K-style command overlay."
        >
          <div className="space-y-4">
            <div className="max-w-sm space-y-2">
              <Label htmlFor="demo-combobox">Framework</Label>
              <Combobox
                id="demo-combobox"
                value={framework}
                onChange={setFramework}
                placeholder="Pick a framework…"
                searchPlaceholder="Search frameworks…"
                options={[
                  { value: 'react', label: 'React', keywords: 'jsx spa' },
                  { value: 'vue', label: 'Vue', keywords: 'spa' },
                  { value: 'svelte', label: 'Svelte' },
                  { value: 'angular', label: 'Angular' },
                  { value: 'solid', label: 'Solid' },
                  { value: 'qwik', label: 'Qwik' },
                ]}
              />
              <p className="text-muted-foreground text-xs">Selected: {framework || '—'}</p>
            </div>

            <Row label="Command">
              <Button variant="outline" onClick={() => setCommandOpen(true)}>
                Open command palette
              </Button>
              <span className="text-muted-foreground text-xs">
                (or press <kbd className="bg-muted rounded border px-1.5 py-0.5 text-xs">⌘K</kbd>)
              </span>
            </Row>

            <CommandDialog open={commandOpen} onOpenChange={setCommandOpen}>
              <CommandInput placeholder="Type a command or search…" />
              <CommandList>
                <CommandEmpty>No results found.</CommandEmpty>
                <CommandGroup heading="Navigation">
                  <CommandItem onSelect={() => setCommandOpen(false)}>
                    Dashboard
                    <CommandShortcut>⌘D</CommandShortcut>
                  </CommandItem>
                  <CommandItem onSelect={() => setCommandOpen(false)}>
                    Users
                    <CommandShortcut>⌘U</CommandShortcut>
                  </CommandItem>
                  <CommandItem onSelect={() => setCommandOpen(false)}>
                    Components
                  </CommandItem>
                </CommandGroup>
                <CommandGroup heading="Actions">
                  <CommandItem onSelect={() => { setCommandOpen(false); toast.success('Invite sent (demo).') }}>
                    Invite user
                  </CommandItem>
                  <CommandItem onSelect={() => { setCommandOpen(false); toast.info('Theme toggled (demo).') }}>
                    Toggle theme
                  </CommandItem>
                </CommandGroup>
              </CommandList>
            </CommandDialog>
          </div>
        </Section>

        {/* Breadcrumb & pagination */}
        <Section title="Breadcrumb & pagination" description="Wayfinding above a page, and paging below a list.">
          <div className="space-y-6">
            <div className="space-y-2">
              <p className="text-muted-foreground text-sm">Breadcrumb</p>
              <Breadcrumb>
                <BreadcrumbList>
                  <BreadcrumbItem>
                    <BreadcrumbLink href="#">Home</BreadcrumbLink>
                  </BreadcrumbItem>
                  <BreadcrumbSeparator />
                  <BreadcrumbItem>
                    <BreadcrumbLink href="#">Settings</BreadcrumbLink>
                  </BreadcrumbItem>
                  <BreadcrumbSeparator />
                  <BreadcrumbItem>
                    <BreadcrumbPage>Profile</BreadcrumbPage>
                  </BreadcrumbItem>
                </BreadcrumbList>
              </Breadcrumb>
            </div>

            <div className="space-y-2">
              <p className="text-muted-foreground text-sm">Pagination — selected page {page}</p>
              <Pagination>
                <PaginationContent>
                  <PaginationItem>
                    <PaginationPrevious onClick={() => setPage((p) => Math.max(1, p - 1))} />
                  </PaginationItem>
                  {[1, 2, 3].map((n) => (
                    <PaginationItem key={n}>
                      <PaginationLink isActive={page === n} onClick={() => setPage(n)}>
                        {n}
                      </PaginationLink>
                    </PaginationItem>
                  ))}
                  <PaginationItem>
                    <PaginationEllipsis />
                  </PaginationItem>
                  <PaginationItem>
                    <PaginationLink isActive={page === 12} onClick={() => setPage(12)}>
                      12
                    </PaginationLink>
                  </PaginationItem>
                  <PaginationItem>
                    <PaginationNext onClick={() => setPage((p) => Math.min(12, p + 1))} />
                  </PaginationItem>
                </PaginationContent>
              </Pagination>
            </div>
          </div>
        </Section>

        {/* List & descriptions */}
        <Section title="List & descriptions" description="Vertical item rows for feeds and settings, and key/value detail pairs.">
          <Grid gap="gap-6">
            <GridItem span={{ base: 12, md: 6 }}>
              <div className="space-y-3">
                <p className="text-sm font-medium">List</p>
                <List>
                  {[
                    { name: 'Ada Lovelace', email: 'ada@example.com', role: 'Owner' },
                    { name: 'Grace Hopper', email: 'grace@example.com', role: 'Admin' },
                    { name: 'Alan Turing', email: 'alan@example.com', role: 'Member' },
                  ].map((person, i) => (
                    <ListItem key={person.email} selected={i === 1}>
                      <ListItemLeading>
                        <Avatar className="size-9">
                          <AvatarFallback>{person.name.split(' ').map((w) => w[0]).join('')}</AvatarFallback>
                        </Avatar>
                      </ListItemLeading>
                      <ListItemContent>
                        <ListItemTitle>{person.name}</ListItemTitle>
                        <ListItemDescription>{person.email}</ListItemDescription>
                      </ListItemContent>
                      <ListItemTrailing>
                        <Badge variant="secondary">{person.role}</Badge>
                      </ListItemTrailing>
                    </ListItem>
                  ))}
                </List>
              </div>
            </GridItem>

            <GridItem span={{ base: 12, md: 6 }}>
              <div className="space-y-3">
                <p className="text-sm font-medium">Descriptions</p>
                <Descriptions columns={2}>
                  <DescriptionItem>
                    <DescriptionTerm>Name</DescriptionTerm>
                    <DescriptionDetail>Ada Lovelace</DescriptionDetail>
                  </DescriptionItem>
                  <DescriptionItem>
                    <DescriptionTerm>Role</DescriptionTerm>
                    <DescriptionDetail>Admin</DescriptionDetail>
                  </DescriptionItem>
                  <DescriptionItem>
                    <DescriptionTerm>Email</DescriptionTerm>
                    <DescriptionDetail>ada@example.com</DescriptionDetail>
                  </DescriptionItem>
                  <DescriptionItem>
                    <DescriptionTerm>Joined</DescriptionTerm>
                    <DescriptionDetail>2026-01-14</DescriptionDetail>
                  </DescriptionItem>
                  <DescriptionItem>
                    <DescriptionTerm>Status</DescriptionTerm>
                    <DescriptionDetail>
                      <Badge variant="success">Active</Badge>
                    </DescriptionDetail>
                  </DescriptionItem>
                  <DescriptionItem>
                    <DescriptionTerm>Last seen</DescriptionTerm>
                    <DescriptionDetail>2 hours ago</DescriptionDetail>
                  </DescriptionItem>
                </Descriptions>
              </div>
            </GridItem>
          </Grid>
        </Section>

        {/* Stats & timeline */}
        <Section title="Stats & timeline" description="Dashboard metric tiles and an activity history.">
          <div className="space-y-6">
            <StatGroup>
              <Stat label="Total users" value="1,204" delta={12} hint="vs last month" icon={Bell} />
              <Stat label="Active sessions" value="318" delta={-4.5} hint="vs last week" />
              <Stat label="Uptime" value="99.98%" hint="last 30 days" />
            </StatGroup>

            <div className="space-y-3">
              <p className="text-sm font-medium">Timeline</p>
              <Timeline>
                <TimelineItem variant="success" icon={<CheckCircle2 />}>
                  <TimelineTitle>Deployment succeeded</TimelineTitle>
                  <TimelineTime>Today at 09:41</TimelineTime>
                  <TimelineDescription>Version 1.4.0 rolled out to production.</TimelineDescription>
                </TimelineItem>
                <TimelineItem variant="primary">
                  <TimelineTitle>Grace Hopper joined</TimelineTitle>
                  <TimelineTime>Yesterday at 16:02</TimelineTime>
                </TimelineItem>
                <TimelineItem variant="destructive" icon={<AlertCircle />}>
                  <TimelineTitle>Failed login attempt</TimelineTitle>
                  <TimelineTime>2 days ago</TimelineTime>
                  <TimelineDescription>Rate limit triggered for 203.0.113.7.</TimelineDescription>
                </TimelineItem>
                <TimelineItem last>
                  <TimelineTitle>Account created</TimelineTitle>
                  <TimelineTime>3 weeks ago</TimelineTime>
                </TimelineItem>
              </Timeline>
            </div>
          </div>
        </Section>

        {/* Stepper & empty state */}
        <Section title="Stepper & empty state" description="Wizard progress, and what a list looks like with nothing in it.">
          <div className="space-y-6">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium">Stepper — step {step + 1} of 3</p>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={() => setStep((s) => Math.max(0, s - 1))} disabled={step === 0}>
                    Back
                  </Button>
                  <Button size="sm" onClick={() => setStep((s) => Math.min(2, s + 1))} disabled={step === 2}>
                    Next
                  </Button>
                </div>
              </div>
              <Stepper
                current={step}
                steps={[
                  { title: 'Account', description: 'Your details' },
                  { title: 'Plan', description: 'Choose a tier' },
                  { title: 'Confirm', description: 'Review & finish' },
                ]}
              />
            </div>

            <div className="space-y-3">
              <p className="text-sm font-medium">Empty state</p>
              <EmptyState
                title="No users yet"
                description="Invite a teammate to get started — they'll appear here once they accept."
                action={<Button size="sm">Invite user</Button>}
              />
            </div>
          </div>
        </Section>

        {/* Hover card & context menu */}
        <Section title="Hover card & context menu" description="Rich hover previews, and right-click actions.">
          <Row label="Hover">
            <HoverCard>
              <HoverCardTrigger asChild>
                <Button variant="link" className="h-auto p-0">
                  @ada
                </Button>
              </HoverCardTrigger>
              <HoverCardContent>
                <div className="flex gap-3">
                  <Avatar className="size-10">
                    <AvatarFallback>AL</AvatarFallback>
                  </Avatar>
                  <div className="space-y-1">
                    <p className="text-sm font-medium">Ada Lovelace</p>
                    <p className="text-muted-foreground text-sm">First programmer. Writes about engines.</p>
                    <p className="text-muted-foreground text-xs">Joined January 2026</p>
                  </div>
                </div>
              </HoverCardContent>
            </HoverCard>
          </Row>

          <Row label="Right-click">
            <ContextMenu>
              <ContextMenuTrigger asChild>
                <div className="text-muted-foreground flex h-24 w-full max-w-sm cursor-context-menu items-center justify-center rounded-md border border-dashed text-sm">
                  Right-click anywhere in this box
                </div>
              </ContextMenuTrigger>
              <ContextMenuContent className="w-48">
                <ContextMenuLabel>Actions</ContextMenuLabel>
                <ContextMenuSeparator />
                <ContextMenuItem onSelect={() => toast.info('Copy (demo).')}>
                  <Copy className="size-4" />
                  Copy
                  <ContextMenuShortcut>⌘C</ContextMenuShortcut>
                </ContextMenuItem>
                <ContextMenuItem onSelect={() => toast.info('Rename (demo).')}>
                  <Pencil className="size-4" />
                  Rename
                </ContextMenuItem>
                <ContextMenuSeparator />
                <ContextMenuItem variant="destructive" onSelect={() => toast.error('Deleted (demo).')}>
                  <Trash2 className="size-4" />
                  Delete
                </ContextMenuItem>
              </ContextMenuContent>
            </ContextMenu>
          </Row>
        </Section>

        {/* Sheet, slider, collapsible, spinner, aspect ratio */}
        <Section
          title="Sheet, slider, collapsible, spinner & aspect ratio"
          description="Off-canvas drawer, range inputs, disclosure, loading indicator and media framing."
        >
          <div className="space-y-6">
            <Row label="Sheet">
              <Sheet>
                <SheetTrigger asChild>
                  <Button variant="outline">
                    <Menu className="size-4" />
                    Open sheet
                  </Button>
                </SheetTrigger>
                <SheetContent>
                  <SheetHeader>
                    <SheetTitle>Edit profile</SheetTitle>
                    <SheetDescription>Make changes here and save when you're done.</SheetDescription>
                  </SheetHeader>
                  <div className="space-y-4 py-4">
                    <div className="space-y-2">
                      <Label htmlFor="sheet-name">Name</Label>
                      <Input id="sheet-name" defaultValue="Ada Lovelace" />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="sheet-email">Email</Label>
                      <Input id="sheet-email" defaultValue="ada@example.com" />
                    </div>
                  </div>
                  <SheetFooter>
                    <SheetClose asChild>
                      <Button variant="outline">Cancel</Button>
                    </SheetClose>
                    <SheetClose asChild>
                      <Button onClick={() => toast.success('Saved (demo).')}>Save changes</Button>
                    </SheetClose>
                  </SheetFooter>
                </SheetContent>
              </Sheet>
              <span className="text-muted-foreground text-xs">Slides in from the right; drags on mobile.</span>
            </Row>

            <div className="max-w-sm space-y-4">
              <div className="space-y-2">
                <p className="text-sm font-medium">Slider — volume {volume[0]}</p>
                <Slider value={volume} onValueChange={setVolume} max={100} step={1} aria-label="Volume" />
              </div>
              <div className="space-y-2">
                <p className="text-sm font-medium">
                  Range slider — ${priceRange[0]}–${priceRange[1]}
                </p>
                <Slider value={priceRange} onValueChange={setPriceRange} max={100} step={5} aria-label="Price range" />
              </div>
            </div>

            <div className="space-y-2">
              <p className="text-sm font-medium">Collapsible</p>
              <Collapsible open={collapsibleOpen} onOpenChange={setCollapsibleOpen} className="max-w-sm space-y-2">
                <div className="flex items-center justify-between gap-4 rounded-md border px-3 py-2">
                  <span className="text-sm font-medium">3 items</span>
                  <CollapsibleTrigger asChild>
                    <Button variant="ghost" size="sm">
                      <ChevronDown className={collapsibleOpen ? 'size-4 rotate-180 transition-transform' : 'size-4 transition-transform'} />
                      {collapsibleOpen ? 'Hide' : 'Show'}
                    </Button>
                  </CollapsibleTrigger>
                </div>
                <CollapsibleContent className="space-y-2">
                  {['ada@example.com', 'grace@example.com', 'alan@example.com'].map((email) => (
                    <div key={email} className="rounded-md border px-3 py-2 text-sm">
                      {email}
                    </div>
                  ))}
                </CollapsibleContent>
              </Collapsible>
            </div>

            <Row label="Spinner">
              <Spinner size="sm" />
              <Spinner />
              <Spinner size="lg" />
              <Button disabled>
                <Spinner size="sm" />
                Loading
              </Button>
            </Row>

            <div className="space-y-2">
              <p className="text-sm font-medium">Aspect ratio — 16:9</p>
              <div className="max-w-md">
                <AspectRatio ratio={16 / 9}>
                  <div className="bg-muted text-muted-foreground flex h-full w-full items-center justify-center rounded-md border text-sm">
                    Media placeholder
                  </div>
                </AspectRatio>
              </div>
            </div>

            <div className="space-y-2">
              <p className="text-sm font-medium">Scroll area — styled scrollbar, fixed height</p>
              <ScrollArea className="h-40 max-w-sm rounded-md border">
                <div className="space-y-2 p-3">
                  {Array.from({ length: 12 }).map((_, i) => (
                    <div key={i} className="text-muted-foreground rounded border px-3 py-2 text-sm">
                      Row {i + 1} — scroll to see the custom thumb.
                    </div>
                  ))}
                </div>
                <ScrollBar />
              </ScrollArea>
            </div>
          </div>
        </Section>


        {/* Dialogs & dropdowns */}
        <Section title="Dialogs & dropdowns" description="Modal forms and confirmation prompts.">
          <Row>
            <Dialog>
              <DialogTrigger asChild>
                <Button variant="outline">Open dialog</Button>
              </DialogTrigger>
              <DialogContent className="max-w-md">
                <DialogHeader>
                  <DialogTitle>Sample dialog</DialogTitle>
                  <DialogDescription>
                    Dialogs trap focus, close on Escape and outside click.
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-2">
                  <Label htmlFor="dialog-input">Field inside a dialog</Label>
                  <Input id="dialog-input" placeholder="Focus starts here" />
                </div>
                <DialogFooter>
                  <DialogClose asChild>
                    <Button variant="outline">Cancel</Button>
                  </DialogClose>
                  <DialogClose asChild>
                    <Button onClick={() => toast.success('Confirmed (demo).')}>Confirm</Button>
                  </DialogClose>
                </DialogFooter>
              </DialogContent>
            </Dialog>

            <ConfirmDialog
              trigger={
                <span className="inline-flex">
                  <Button variant="destructive">
                    <Trash2 className="size-4" />
                    Delete something
                  </Button>
                </span>
              }
              title="Delete this record?"
              description="This permanently removes the record. This action cannot be undone."
              confirmLabel="Delete"
              onConfirm={() => {
                toast.success('Confirmed deletion (demo).')
              }}
            />

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline">Dropdown</Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="w-48">
                <DropdownMenuLabel className="font-normal">
                  <div className="text-sm font-medium">Menu label</div>
                  <div className="text-muted-foreground text-xs">user@example.com</div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem>
                  <Mail className="size-4" />
                  Profile
                </DropdownMenuItem>
                <DropdownMenuItem>Settings</DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem variant="destructive">Delete account</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </Row>
        </Section>

        {/* Loading / empty / error states */}
        <Section
          title="Loading, empty & error states"
          description="What users see while waiting, when nothing exists, or when things break."
        >
          <Grid gap="gap-6">
            <GridItem span={{ base: 12, md: 4 }}>
              <div className="space-y-2">
                <p className="text-muted-foreground text-sm">Loading (skeleton)</p>
                <div className="space-y-2">
                  <Skeleton className="h-4 w-3/4" />
                  <Skeleton className="h-4 w-1/2" />
                  <Skeleton className="h-8 w-full" />
                </div>
              </div>
            </GridItem>
            <GridItem span={{ base: 12, md: 4 }}>
              <div className="space-y-2">
                <p className="text-muted-foreground text-sm">Empty state</p>
                <div className="text-muted-foreground flex flex-col items-center gap-2 rounded-md border border-dashed py-8 text-sm">
                  <Info className="size-5" />
                  No records yet.
                </div>
              </div>
            </GridItem>
            <GridItem span={{ base: 12, md: 4 }}>
              <div className="space-y-2">
                <p className="text-muted-foreground text-sm">Error state</p>
                <div className="text-destructive flex flex-col items-center gap-3 rounded-md border border-dashed py-6 text-sm">
                  <p>Could not load data.</p>
                  <Button variant="outline" size="sm" onClick={() => toast.error('Retry clicked (demo).')}>
                    Retry
                  </Button>
                </div>
              </div>
            </GridItem>
          </Grid>
        </Section>

        {/* Toasts */}
        <Section title="Toasts" description="Transient feedback via sonner; top-right, auto-dismiss.">
          <Row>
            <Button variant="outline" onClick={() => toast.success('Changes saved.')}>
              Success toast
            </Button>
            <Button variant="outline" onClick={() => toast.error('Something went wrong.')}>
              Error toast
            </Button>
            <Button variant="outline" onClick={() => toast.info('Heads up — this is informational.')}>
              Info toast
            </Button>
          </Row>
        </Section>
      </div>
    </TooltipProvider>
  )
}
