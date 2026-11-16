import { getSessionUser } from '@/lib/auth'
import { getUser } from '@/lib/users'
import { defaultMealSlots } from '@/constants/userPreferences'
import Log from '@/views/Log/Index'

export const dynamic = 'force-dynamic'

export default async function LogPage() {
  // The User's Meal Slots drive the Daily Log sections. Signed-out visitors still get the view (it
  // shows a sign-in prompt), with the default slots.
  const sessionUser = await getSessionUser()
  const user = sessionUser ? await getUser(sessionUser.userId) : null
  return <Log mealSlots={user?.mealSlots ?? [...defaultMealSlots]} />
}
