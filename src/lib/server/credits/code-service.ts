import { db } from '$lib/server/db';
import { redemptionCode, creditPackage } from '$lib/server/db/schema';
import { eq, desc, and } from 'drizzle-orm';
import { randomUUID } from 'crypto';

const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

export function generateCodeString(): string {
    let code = '';
    for (let i = 0; i < 12; i++) {
        if (i > 0 && i % 4 === 0) code += '-';
        code += CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)];
    }
    return code;
}

export interface CreateCodesInput {
    packageId: string;
    expiresAt: Date | null;
    maxRedemptions: number | null;
    count?: number;
}

export async function createCodes(input: CreateCodesInput, createdBy: string) {
    const count = Math.min(Math.max(input.count ?? 1, 1), 100);
    const values = [];
    for (let i = 0; i < count; i++) {
        values.push({
            id: randomUUID(),
            code: generateCodeString(),
            packageId: input.packageId,
            expiresAt: input.expiresAt,
            maxRedemptions: input.maxRedemptions,
            currentRedemptions: 0,
            isActive: true,
            createdBy,
        });
    }
    return db.insert(redemptionCode).values(values).returning();
}

export async function listCodes(filters?: { packageId?: string; isActive?: boolean }) {
    const conditions = [];
    if (filters?.packageId) {
        conditions.push(eq(redemptionCode.packageId, filters.packageId));
    }
    if (filters?.isActive !== undefined) {
        conditions.push(eq(redemptionCode.isActive, filters.isActive));
    }

    const query = db.select({
        id: redemptionCode.id,
        code: redemptionCode.code,
        packageId: redemptionCode.packageId,
        expiresAt: redemptionCode.expiresAt,
        maxRedemptions: redemptionCode.maxRedemptions,
        currentRedemptions: redemptionCode.currentRedemptions,
        isActive: redemptionCode.isActive,
        createdBy: redemptionCode.createdBy,
        createdAt: redemptionCode.createdAt,
        packageName: creditPackage.name,
        packageCredits: creditPackage.credits,
    })
    .from(redemptionCode)
    .leftJoin(creditPackage, eq(redemptionCode.packageId, creditPackage.id))
    .orderBy(desc(redemptionCode.createdAt));

    if (conditions.length > 0) {
        return query.where(and(...conditions));
    }
    return query;
}

export async function getCodeByString(codeStr: string) {
    const [row] = await db.select()
        .from(redemptionCode)
        .where(eq(redemptionCode.code, codeStr.toUpperCase().trim()));
    return row ?? null;
}

export async function getCodeById(id: string) {
    const [row] = await db.select()
        .from(redemptionCode)
        .where(eq(redemptionCode.id, id));
    return row ?? null;
}
