import { NextResponse } from 'next/server'
import { getFoods, createFood } from '@/lib/foods'
import { taskRunner } from '@/lib/TaskRunner'
import type { Food } from '@/types/Food'

export async function GET() {
  const foods = await getFoods()
  return NextResponse.json(foods)
}

export async function POST(request: Request) {
  const body: Omit<Food, 'id'> = await request.json()
  const food = await taskRunner.run(() => createFood(body))
  return NextResponse.json(food, { status: 201 })
}
