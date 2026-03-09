import { NextRequest, NextResponse } from 'next/server'
import { isAuthenticated } from '@/lib/auth'
import { getModerationFeed, flagConversation } from '@/lib/queries/admin-logs'
import { getAllConfig } from '@/lib/queries/admin-config'

export async function GET(req: NextRequest) {
  if (!await isAuthenticated(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { searchParams } = req.nextUrl
  const config = await getAllConfig()

  const data = await getModerationFeed({
    status: searchParams.get('status') ?? 'pending',
    limit: Number(searchParams.get('limit') ?? 50),
    page: Number(searchParams.get('page') ?? 1),
    keywords: (config as unknown as Record<string, unknown>).moderationKeywords as string[] | undefined,
  })
  return NextResponse.json(data)
}

export async function POST(req: NextRequest) {
  if (!await isAuthenticated(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { conversationId, reason, userId } = await req.json() as { conversationId: string; reason: string; userId: string }
  await flagConversation(conversationId, reason, userId)
  return NextResponse.json({ ok: true })
}
