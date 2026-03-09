import { NextRequest, NextResponse } from 'next/server'
import { isAuthenticated } from '@/lib/auth'
import { getAllConfig, updateConfig } from '@/lib/queries/admin-config'

export async function GET(req: NextRequest) {
  if (!await isAuthenticated(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const config = await getAllConfig()
  return NextResponse.json({
    webhook: config.alertWebhook,
    email: config.alertEmail,
    thresholds: config.alertThresholds,
  })
}

export async function PUT(req: NextRequest) {
  if (!await isAuthenticated(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const body = await req.json() as Record<string, unknown>
  await updateConfig({
    alertWebhook: String(body.webhook ?? ''),
    alertEmail: String(body.email ?? ''),
    alertThresholds: body.thresholds as Parameters<typeof updateConfig>[0]['alertThresholds'],
  })
  return NextResponse.json({ ok: true })
}
