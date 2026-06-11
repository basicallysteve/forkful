import { getFoods } from '@/lib/foods'
import FoodsList from '@/views/Foods/Index'

export default async function FoodsPage() {
  const foods = await getFoods()
  return <FoodsList initialFoods={foods} />
}
