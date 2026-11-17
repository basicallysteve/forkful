// Stub so the failing tests assert on missing behavior rather than a missing import.
import type { Food } from '@/types/Food'

export interface QuickAddFoodModalProps {
  initialName: string
  onCreated: (food: Food) => void
  onHide: () => void
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export default function QuickAddFoodModal(_props: QuickAddFoodModalProps) {
  return null
}
