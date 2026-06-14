import { NextResponse } from 'next/server'
import { getProducts, createProduct } from '@/lib/products'
import { getSessionUser } from '@/lib/auth'
import { taskRunner } from '@/lib/TaskRunner'
import type { Product } from '@/types/Product'
import type { ProductQueryOptions } from '@/lib/products'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const options: ProductQueryOptions = {}
  const search = searchParams.get('search')
  const sortBy = searchParams.get('sortBy') as ProductQueryOptions['sortBy']
  const sortDir = searchParams.get('sortDir') as ProductQueryOptions['sortDir']
  if (search) options.search = search
  if (sortBy) options.sortBy = sortBy
  if (sortDir) options.sortDir = sortDir
  const list = await getProducts(options)
  return NextResponse.json(list)
}

export async function POST(request: Request) {
  const user = await getSessionUser(request)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const body: Omit<Product, 'id'> = await request.json()
  const product = await taskRunner.run(() => createProduct(body))
  return NextResponse.json(product, { status: 201 })
}
