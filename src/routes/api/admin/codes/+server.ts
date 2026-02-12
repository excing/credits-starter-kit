import { json, type RequestHandler } from '@sveltejs/kit';
import { guardAdmin } from '$lib/server/credits/admin';
import { createCodes, listCodes } from '$lib/server/credits/code-service';
import { getPackageById } from '$lib/server/credits/package-service';

export const GET: RequestHandler = async ({ url, locals }) => {
    if (!locals.session?.user) return json({ error: '请先登录' }, { status: 401 });
    const denied = guardAdmin(locals.session.user.email);
    if (denied) return denied;

    const packageId = url.searchParams.get('packageId') ?? undefined;
    const isActiveParam = url.searchParams.get('isActive');

    const codes = await listCodes({
        packageId,
        isActive: isActiveParam !== null ? isActiveParam === 'true' : undefined,
    });
    return json({ codes });
};

export const POST: RequestHandler = async ({ request, locals }) => {
    if (!locals.session?.user) return json({ error: '请先登录' }, { status: 401 });
    const denied = guardAdmin(locals.session.user.email);
    if (denied) return denied;

    let body: unknown;
    try {
        body = await request.json();
    } catch {
        return json({ error: '无效的请求格式' }, { status: 400 });
    }

    const { packageId, expiresAt, maxRedemptions, count } = body as {
        packageId?: string; expiresAt?: string | null; maxRedemptions?: number; count?: number;
    };

    if (!packageId) return json({ error: '请选择关联套餐' }, { status: 400 });

    const pkg = await getPackageById(packageId);
    if (!pkg) return json({ error: '套餐不存在' }, { status: 404 });
    if (!pkg.isActive) return json({ error: '该套餐已停用' }, { status: 400 });

    if (count !== undefined && (!Number.isInteger(count) || count < 1 || count > 100)) {
        return json({ error: '生成数量必须为1-100之间的整数' }, { status: 400 });
    }

    // 默认过期时间：30天后；传空字符串或 null 表示永不过期
    let resolvedExpiresAt: Date | null = null;
    if (expiresAt === undefined) {
        // 未传：使用默认 30 天
        resolvedExpiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
    } else if (expiresAt) {
        // 传了具体值：校验
        const expDate = new Date(expiresAt);
        if (isNaN(expDate.getTime())) {
            return json({ error: '无效的过期时间' }, { status: 400 });
        }
        if (expDate <= new Date()) {
            return json({ error: '过期时间必须在当前时间之后' }, { status: 400 });
        }
        resolvedExpiresAt = expDate;
    }
    // expiresAt 为 null 或空字符串：永不过期（resolvedExpiresAt 保持 null）

    const codes = await createCodes({
        packageId,
        expiresAt: resolvedExpiresAt,
        maxRedemptions: maxRedemptions ?? 1,
        count: count ?? 1,
    }, locals.session.user.id);

    return json({ codes }, { status: 201 });
};
