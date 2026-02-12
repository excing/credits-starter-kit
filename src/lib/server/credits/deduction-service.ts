import { db } from '$lib/server/db';
import { user, creditTransaction } from '$lib/server/db/schema';
import { sql } from 'drizzle-orm';
import { randomUUID } from 'crypto';
import type { DeductionInput, DeductionResult } from './billing-types';

/**
 * 原子扣除用户积分并记录交易。
 *
 * 使用带条件的 UPDATE（WHERE credit_balance >= amount）防止余额为负，
 * 在数据库层面拦截并发竞态，无需显式行锁。
 *
 * 事务流程：
 * 1. UPDATE user SET credit_balance = credit_balance - amount WHERE id = userId AND credit_balance >= amount
 * 2. 若 0 行受影响 → 余额不足（竞态被拦截）
 * 3. INSERT credit_transaction (type='usage', amount=-N)
 */
export async function deductCredits(input: DeductionInput): Promise<DeductionResult> {
	const { userId, amount, description, metadata, endpoint } = input;

	if (amount <= 0) {
		return { success: false, error: '扣费金额必须大于零' };
	}

	const txnId = randomUUID();

	try {
		const newBalance = await db.transaction(async (tx) => {
			// 条件更新：仅当余额充足时扣除
			const [updated] = await tx
				.update(user)
				.set({
					creditBalance: sql`${user.creditBalance} - ${amount}`,
				})
				.where(
					sql`${user.id} = ${userId} AND ${user.creditBalance} >= ${amount}`
				)
				.returning({ newBalance: user.creditBalance });

			if (!updated) {
				throw new Error('INSUFFICIENT_BALANCE');
			}

			// 记录交易（amount 为负数，遵循已有 refund 约定）
			await tx.insert(creditTransaction).values({
				id: txnId,
				userId,
				amount: -amount,
				type: 'usage',
				referenceId: null,
				description,
				metadata: {
					...metadata,
					endpoint,
					deductedAt: new Date().toISOString(),
				},
			});

			return updated.newBalance;
		});

		return {
			success: true,
			transactionId: txnId,
			newBalance,
		};
	} catch (error) {
		if (error instanceof Error && error.message === 'INSUFFICIENT_BALANCE') {
			return {
				success: false,
				error: '积分余额不足，无法完成扣费',
			};
		}
		console.error('[billing] 扣费异常:', error);
		return {
			success: false,
			error: '扣费失败，请稍后重试',
		};
	}
}
