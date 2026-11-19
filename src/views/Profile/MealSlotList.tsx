'use client'

import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type Announcements,
  type DragEndEvent,
} from '@dnd-kit/core'
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'

export interface MealSlot {
  id: number
  name: string
}

interface Props {
  slots: MealSlot[]
  onReorder: (slots: MealSlot[]) => void
  onRemove: (id: number) => void
}

function SortableRow({ slot, onRemove }: { slot: MealSlot; onRemove: (id: number) => void }) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } =
    useSortable({ id: slot.id })
  const style = {
    // Vertical list: ignore any sideways drift of the pointer.
    transform: CSS.Transform.toString(transform ? { ...transform, x: 0 } : null),
    transition,
  }
  return (
    <li ref={setNodeRef} style={style} className={`meal-slot-row${isDragging ? ' is-dragging' : ''}`}>
      <button
        type="button"
        ref={setActivatorNodeRef}
        className="meal-slot-handle"
        {...attributes}
        {...listeners}
        aria-label={`Reorder ${slot.name}`}
      >
        <i className="pi pi-bars" aria-hidden="true" />
      </button>
      <span className="meal-slot-name">{slot.name}</span>
      <button
        type="button"
        className="icon-button icon-button--danger"
        aria-label={`Remove ${slot.name}`}
        onClick={() => onRemove(slot.id)}
      >
        <i className="pi pi-trash" aria-hidden="true" />
      </button>
    </li>
  )
}

export default function MealSlotList({ slots, onReorder, onRemove }: Props) {
  const sensors = useSensors(
    // The pointer sensor covers mouse, pen and touch. Dragging starts only from the
    // handle (touch-action: none there), so scrolling the page elsewhere still works.
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  const nameOf = (id: string | number) => slots.find(s => s.id === id)?.name ?? 'slot'
  const position = (id: string | number) => slots.findIndex(s => s.id === id) + 1
  const announcements: Announcements = {
    onDragStart: ({ active }) => `Picked up ${nameOf(active.id)}, position ${position(active.id)} of ${slots.length}.`,
    onDragOver: ({ active, over }) =>
      over ? `${nameOf(active.id)} moved to position ${position(over.id)} of ${slots.length}.` : undefined,
    onDragEnd: ({ active, over }) =>
      `${nameOf(active.id)} dropped at position ${position(over?.id ?? active.id)} of ${slots.length}.`,
    onDragCancel: ({ active }) => `Reordering cancelled. ${nameOf(active.id)} returned to position ${position(active.id)}.`,
  }

  function handleDragEnd({ active, over }: DragEndEvent) {
    if (!over || active.id === over.id) return
    const from = slots.findIndex(s => s.id === active.id)
    const to = slots.findIndex(s => s.id === over.id)
    if (from === -1 || to === -1) return
    onReorder(arrayMove(slots, from, to))
  }

  return (
    <DndContext
      id="meal-slots-dnd"
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragEnd={handleDragEnd}
      accessibility={{
        announcements,
        screenReaderInstructions: {
          draggable:
            'To pick up a meal slot, press space or enter. Use the up and down arrow keys to move it, then press space or enter to drop it, or escape to cancel.',
        },
      }}
    >
      <SortableContext items={slots.map(s => s.id)} strategy={verticalListSortingStrategy}>
        <ul className="meal-slot-list" aria-label="Meal slots">
          {slots.map(slot => (
            <SortableRow key={slot.id} slot={slot} onRemove={onRemove} />
          ))}
        </ul>
      </SortableContext>
    </DndContext>
  )
}
