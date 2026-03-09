import { NextRequest, NextResponse } from 'next/server'
import { isAuthenticated } from '@/lib/auth'
import { getInfrastructureStatus } from '@/lib/queries/admin-infrastructure'

export async function GET(req: NextRequest) {
  if (!await isAuthenticated(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const data = await getInfrastructureStatus()
  return NextResponse.json(data)
}
