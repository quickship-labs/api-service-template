import { and, asc, count, desc, eq, ilike } from 'drizzle-orm';

import { db } from '../db/client.js';
import { items } from '../db/schema.js';
import type { Item, NewItem } from '../db/schema.js';
import { NotFoundError } from '../lib/errors.js';
import type { PaginationMeta } from '../types/index.js';

// ──────────────────────────────────────────────
// Types
// ──────────────────────────────────────────────

export interface ListParams {
  page: number;
  limit: number;
  sortBy: string;
  sortOrder: 'asc' | 'desc';
  search?: string;
  status?: string;
}

export interface ListResult {
  data: Item[];
  meta: PaginationMeta;
}

// ──────────────────────────────────────────────
// CRUD Operations
// ──────────────────────────────────────────────

/**
 * List items for a user with pagination, sorting, and optional filtering.
 */
export async function list(userId: string, params: ListParams): Promise<ListResult> {
  const { page, limit, sortBy, sortOrder, search, status } = params;
  const offset = (page - 1) * limit;

  // Build where conditions
  const conditions = [eq(items.userId, userId)];

  if (status) {
    conditions.push(eq(items.status, status));
  }

  if (search) {
    conditions.push(ilike(items.title, `%${search}%`));
  }

  const whereClause = and(...conditions);

  // Determine sort column
  const sortColumn = sortBy === 'title' ? items.title : items.createdAt;
  const orderFn = sortOrder === 'asc' ? asc : desc;

  // Execute query and count in parallel
  const [data, [countResult]] = await Promise.all([
    db
      .select()
      .from(items)
      .where(whereClause)
      .orderBy(orderFn(sortColumn))
      .limit(limit)
      .offset(offset),
    db.select({ value: count() }).from(items).where(whereClause),
  ]);

  const total = countResult?.value ?? 0;

  return {
    data,
    meta: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  };
}

/**
 * Get a single item by ID.
 * Scoped to the requesting user.
 */
export async function getById(userId: string, itemId: string): Promise<Item> {
  const item = await db.query.items.findFirst({
    where: and(eq(items.id, itemId), eq(items.userId, userId)),
  });

  if (!item) {
    throw new NotFoundError('Item not found');
  }

  return item;
}

/**
 * Create a new item.
 */
export async function create(
  userId: string,
  data: { title: string; description?: string; status?: string },
): Promise<Item> {
  const [item] = await db
    .insert(items)
    .values({
      userId,
      title: data.title,
      description: data.description ?? null,
      status: data.status ?? 'active',
    } satisfies Omit<NewItem, 'id' | 'createdAt' | 'updatedAt'>)
    .returning();

  return item!;
}

/**
 * Update an existing item.
 * Scoped to the requesting user.
 */
export async function update(
  userId: string,
  itemId: string,
  data: { title?: string; description?: string; status?: string },
): Promise<Item> {
  // Verify ownership first
  await getById(userId, itemId);

  const [updated] = await db
    .update(items)
    .set({
      ...(data.title !== undefined && { title: data.title }),
      ...(data.description !== undefined && { description: data.description }),
      ...(data.status !== undefined && { status: data.status }),
    })
    .where(and(eq(items.id, itemId), eq(items.userId, userId)))
    .returning();

  return updated!;
}

/**
 * Delete an item.
 * Scoped to the requesting user.
 */
export async function remove(userId: string, itemId: string): Promise<void> {
  // Verify ownership first
  await getById(userId, itemId);

  await db.delete(items).where(and(eq(items.id, itemId), eq(items.userId, userId)));
}
