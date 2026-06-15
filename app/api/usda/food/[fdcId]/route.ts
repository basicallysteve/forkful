import { type NextRequest, NextResponse } from 'next/server'
import { fetchFoodDetail, mapPortionsToData } from '@/lib/usda'
import type { Measurement } from '@/types/Food'

export interface USDAFoodPortionsResponse {
  measurements: Measurement[]
  density: number | null
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ fdcId: string }> }
) {
  const { fdcId } = await params
  const id = Number(fdcId)

  if (!id || isNaN(id)) {
    return NextResponse.json<USDAFoodPortionsResponse>({ measurements: [], density: null })
  }

  try {
    const detail = await fetchFoodDetail(id)
    if (!detail?.foodPortions?.length) {
      return NextResponse.json<USDAFoodPortionsResponse>({ measurements: [], density: null })
    }
    const { measurements, density } = mapPortionsToData(detail.foodPortions)
    return NextResponse.json<USDAFoodPortionsResponse>({ measurements, density: density ?? null })
  } catch {
    return NextResponse.json<USDAFoodPortionsResponse>({ measurements: [], density: null })
  }
}
