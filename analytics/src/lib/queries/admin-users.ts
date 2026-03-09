import { ObjectId } from 'mongodb'
import { getCollection } from '../mongodb'

export interface AdminUser {
  _id: string
  name: string
  email: string
  provider: string
  createdAt: Date
  updatedAt: Date
  lastActive: Date | null
  totalMessages: number
  totalConversations: number
  favoriteMode: string
  status: 'active' | 'inactive' | 'banned'
  role: string
  balance: number
  plan: string
}

export interface UserListResult {
  users: AdminUser[]
  total: number
  page: number
  pages: number
}

export async function getUserList(opts: {
  search?: string
  status?: string
  sort?: string
  order?: 'asc' | 'desc'
  page?: number
  limit?: number
}): Promise<UserListResult> {
  const users = await getCollection('users')
  const messages = await getCollection('messages')

  const page = opts.page ?? 1
  const limit = Math.min(opts.limit ?? 50, 200)
  const skip = (page - 1) * limit

  const match: Record<string, unknown> = {}
  if (opts.search) {
    const re = new RegExp(opts.search, 'i')
    match['$or'] = [{ name: re }, { email: re }]
  }
  if (opts.status === 'banned') match['banned'] = true
  else if (opts.status === 'inactive') {
    const cutoff = new Date(Date.now() - 30 * 86400_000)
    match['banned'] = { $ne: true }
    match['updatedAt'] = { $lt: cutoff }
  } else if (opts.status === 'active') {
    const cutoff = new Date(Date.now() - 30 * 86400_000)
    match['banned'] = { $ne: true }
    match['updatedAt'] = { $gte: cutoff }
  }

  const sortField = opts.sort ?? 'createdAt'
  const sortDir = opts.order === 'asc' ? 1 : -1

  const [docs, total] = await Promise.all([
    users.find(match).sort({ [sortField]: sortDir }).skip(skip).limit(limit).toArray(),
    users.countDocuments(match),
  ])

  const userIds = docs.map((d) => String(d._id))

  const msgAgg = await messages.aggregate([
    { $match: { user: { $in: userIds }, isCreatedByUser: true } },
    { $group: { _id: '$user', count: { $sum: 1 }, lastMsg: { $max: '$createdAt' }, modes: { $push: '$endpoint' } } },
  ]).toArray()

  const msgMap = new Map(msgAgg.map((a) => [String(a._id), a]))

  return {
    users: docs.map((d) => {
      const stats = msgMap.get(String(d._id))
      const modes = (stats?.modes ?? []) as string[]
      const modeCount: Record<string, number> = {}
      for (const m of modes) modeCount[m] = (modeCount[m] ?? 0) + 1
      const favoriteMode = Object.entries(modeCount).sort((a, b) => b[1] - a[1])[0]?.[0] ?? '—'
      const banned = (d as Record<string, unknown>).banned === true
      const lastActive = (stats?.lastMsg as Date | undefined) ?? null
      const thirtyDaysAgo = new Date(Date.now() - 30 * 86400_000)
      const status: AdminUser['status'] = banned
        ? 'banned'
        : lastActive && lastActive > thirtyDaysAgo
        ? 'active'
        : 'inactive'

      return {
        _id: String(d._id),
        name: String((d as Record<string, unknown>).name ?? ''),
        email: String((d as Record<string, unknown>).email ?? ''),
        provider: String((d as Record<string, unknown>).provider ?? 'local'),
        createdAt: (d as Record<string, unknown>).createdAt as Date,
        updatedAt: (d as Record<string, unknown>).updatedAt as Date,
        lastActive,
        totalMessages: stats?.count ?? 0,
        totalConversations: 0,
        favoriteMode,
        status,
        role: String((d as Record<string, unknown>).role ?? 'user'),
        balance: Number((d as Record<string, unknown>).tokenBalance ?? 0),
        plan: String((d as Record<string, unknown>).plan ?? 'free'),
      }
    }),
    total,
    page,
    pages: Math.ceil(total / limit),
  }
}

export async function getUserById(id: string): Promise<AdminUser | null> {
  const users = await getCollection('users')
  let query: Record<string, unknown>
  try {
    query = { _id: new ObjectId(id) }
  } catch {
    query = { _id: id }
  }
  const d = await users.findOne(query)
  if (!d) return null

  const messages = await getCollection('messages')
  const userId = String(d._id)
  const [msgCount, lastMsg] = await Promise.all([
    messages.countDocuments({ user: userId, isCreatedByUser: true }),
    messages.find({ user: userId }).sort({ createdAt: -1 }).limit(1).toArray(),
  ])

  const lastActive = lastMsg[0] ? (lastMsg[0] as Record<string, unknown>).createdAt as Date : null
  const banned = (d as Record<string, unknown>).banned === true
  const thirtyDaysAgo = new Date(Date.now() - 30 * 86400_000)
  const status: AdminUser['status'] = banned ? 'banned' : lastActive && lastActive > thirtyDaysAgo ? 'active' : 'inactive'

  return {
    _id: userId,
    name: String((d as Record<string, unknown>).name ?? ''),
    email: String((d as Record<string, unknown>).email ?? ''),
    provider: String((d as Record<string, unknown>).provider ?? 'local'),
    createdAt: (d as Record<string, unknown>).createdAt as Date,
    updatedAt: (d as Record<string, unknown>).updatedAt as Date,
    lastActive,
    totalMessages: msgCount,
    totalConversations: 0,
    favoriteMode: '—',
    status,
    role: String((d as Record<string, unknown>).role ?? 'user'),
    balance: Number((d as Record<string, unknown>).tokenBalance ?? 0),
    plan: String((d as Record<string, unknown>).plan ?? 'free'),
  }
}

export async function getUserRecentConversations(userId: string) {
  const conversations = await getCollection('conversations')
  const messages = await getCollection('messages')
  const convs = await conversations.find({ user: userId }).sort({ createdAt: -1 }).limit(20).toArray()

  return Promise.all(convs.map(async (c) => {
    const convId = String((c as Record<string, unknown>).conversationId ?? '')
    const msgCount = await messages.countDocuments({ conversationId: convId })
    return {
      conversationId: convId,
      endpoint: (c as Record<string, unknown>).endpoint ?? '—',
      model: (c as Record<string, unknown>).model ?? '',
      agentId: (c as Record<string, unknown>).agent_id ?? null,
      title: (c as Record<string, unknown>).title ?? 'Sem título',
      createdAt: (c as Record<string, unknown>).createdAt,
      messageCount: msgCount,
    }
  }))
}

export async function updateUser(id: string, updates: Record<string, unknown>) {
  const users = await getCollection('users')
  let query: Record<string, unknown>
  try {
    query = { _id: new ObjectId(id) }
  } catch {
    query = { _id: id }
  }
  return users.updateOne(query, { $set: { ...updates, updatedAt: new Date() } })
}

export async function deleteUser(id: string) {
  const users = await getCollection('users')
  let query: Record<string, unknown>
  try {
    query = { _id: new ObjectId(id) }
  } catch {
    query = { _id: id }
  }
  return users.deleteOne(query)
}

export async function getSuspiciousUsers() {
  const messages = await getCollection('messages')
  const oneHourAgo = new Date(Date.now() - 3600_000)
  const agg = await messages.aggregate([
    { $match: { createdAt: { $gte: oneHourAgo }, isCreatedByUser: true } },
    { $group: { _id: '$user', count: { $sum: 1 } } },
    { $match: { count: { $gte: 50 } } },
    { $sort: { count: -1 } },
    { $limit: 20 },
  ]).toArray()

  if (!agg.length) return []

  const users = await getCollection('users')
  const ids = agg.map((a) => String(a._id))
  const userDocs = await users.find({ _id: { $in: ids } } as Record<string, unknown>).toArray()
  const userMap = new Map(userDocs.map((u) => [String(u._id), u]))

  return agg.map((a) => ({
    userId: String(a._id),
    msgsLastHour: a.count as number,
    email: String((userMap.get(String(a._id)) as Record<string, unknown> | undefined)?.email ?? '—'),
    name: String((userMap.get(String(a._id)) as Record<string, unknown> | undefined)?.name ?? '—'),
  }))
}
