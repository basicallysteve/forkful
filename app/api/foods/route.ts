import { NextResponse } from 'next/server'
import { getFoods, createFood } from '@/lib/foods'
import { taskRunner } from '@/lib/TaskRunner'
import type { Food } from '@/types/Food'
import type { FoodQueryOptions } from '@/lib/foods'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const options: FoodQueryOptions = {}
  const search = searchParams.get('search')
  const sortBy = searchParams.get('sortBy') as FoodQueryOptions['sortBy']
  const sortDir = searchParams.get('sortDir') as FoodQueryOptions['sortDir']
  if (search) options.search = search
  if (sortBy) options.sortBy = sortBy
  if (sortDir) options.sortDir = sortDir
  const foods = await getFoods(options)
  return NextResponse.json(foods)
}

export async function POST(request: Request) {
  const body: Omit<Food, 'id'> = await request.json()
  const food = await taskRunner.run(() => createFood(body))
  return NextResponse.json(food, { status: 201 })
}
