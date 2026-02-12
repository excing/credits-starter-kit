import { db } from '$lib/server/db';
import { creditPackage } from '$lib/server/db/schema';
import { eq, desc } from 'drizzle-orm';
import { randomUUID } from 'crypto';

export interface CreatePackageInput {
    name: string;
    credits: number;
    description?: string;
}

export interface UpdatePackageInput {
    name?: string;
    credits?: number;
    description?: string | null;
    isActive?: boolean;
}

export async function createPackage(input: CreatePackageInput) {
    const id = randomUUID();
    const [pkg] = await db.insert(creditPackage).values({
        id,
        name: input.name,
        credits: input.credits,
        description: input.description ?? null,
    }).returning();
    return pkg;
}

export async function listPackages(includeInactive = false) {
    if (includeInactive) {
        return db.select().from(creditPackage).orderBy(desc(creditPackage.createdAt));
    }
    return db.select().from(creditPackage)
        .where(eq(creditPackage.isActive, true))
        .orderBy(desc(creditPackage.createdAt));
}

export async function getPackageById(id: string) {
    const [pkg] = await db.select().from(creditPackage).where(eq(creditPackage.id, id));
    return pkg ?? null;
}

export async function updatePackage(id: string, input: UpdatePackageInput) {
    const [pkg] = await db.update(creditPackage)
        .set({ ...input, updatedAt: new Date() })
        .where(eq(creditPackage.id, id))
        .returning();
    return pkg ?? null;
}
