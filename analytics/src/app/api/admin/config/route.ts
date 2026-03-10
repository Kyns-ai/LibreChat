import { NextRequest, NextResponse } from 'next/server'
import { isAuthenticated } from '@/lib/auth'
import { getAllConfig, updateConfig } from '@/lib/queries/admin-config'
import type { PlatformConfig } from '@/lib/queries/admin-config'

export async function GET(req: NextRequest)  {
  try {
    if (!await isAuthenticated(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const config = await getAllConfig()
    return NextResponse.json(config)

  } catch (e) {
    console.error('[API]', e)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}

export async function PUT(req: NextRequest)  {
  try {
    if (!await isAuthenticated(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const body = await req.json() as Partial<PlatformConfig>
    await updateConfig(body)
    return NextResponse.json({ ok: true })

  } catch (e) {
    console.error('[API]', e)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
