import { NextRequest, NextResponse } from 'next/server'
import { isAuthenticated } from '@/lib/auth'
import { getUserById, getUserRecentConversations, updateUser, deleteUser } from '@/lib/queries/admin-users'

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  if (!await isAuthenticated(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = req.nextUrl
  if (searchParams.get('conversations') === 'true') {
    const convs = await getUserRecentConversations(params.id)
    return NextResponse.json(convs)
  }

  const user = await getUserById(params.id)
  if (!user) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json(user)
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  if (!await isAuthenticated(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json() as Record<string, unknown>
  const { action, ...data } = body

  const allowedFields = ['banned', 'role', 'plan', 'tokenBalance', 'name']
  if (action === 'ban') await updateUser(params.id, { banned: true })
  else if (action === 'unban') await updateUser(params.id, { banned: false })
  else if (action === 'update') {
    const updates: Record<string, unknown> = {}
    for (const f of allowedFields) if (f in data) updates[f] = data[f]
    await updateUser(params.id, updates)
  } else {
    return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
  }

  return NextResponse.json({ ok: true })
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  if (!await isAuthenticated(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  await deleteUser(params.id)
  return NextResponse.json({ ok: true })
}
