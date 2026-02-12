import { createOpenAI } from '@ai-sdk/openai';
import { streamText, convertToModelMessages } from 'ai';
import { json } from '@sveltejs/kit';
import type { RequestHandler } from '@sveltejs/kit';
import { env } from '$env/dynamic/private';

// 创建自定义 OpenAI provider，支持自定义 baseURL
const openai = createOpenAI({
    baseURL: env.OPENAI_BASE_URL || 'https://api.openai.com/v1',
    apiKey: env.OPENAI_API_KEY,
});

export const POST: RequestHandler = async ({ request, locals }) => {
    // 认证检查：确保用户已登录
    if (!locals.session?.user) {
        return json({ error: '请先登录后再使用聊天功能' }, { status: 401 });
    }

    // 输入验证
    let body: unknown;
    try {
        body = await request.json();
    } catch {
        return json({ error: '无效的请求格式' }, { status: 400 });
    }

    const { messages } = body as { messages?: unknown };
    if (!Array.isArray(messages) || messages.length === 0) {
        return json({ error: '消息内容不能为空' }, { status: 400 });
    }

    // 将 UI messages（包含 parts）转换为 core messages（包含 content）
    const modelMessages = await convertToModelMessages(messages);

    // ── 计费集成：捕获 token 用量 ──
    const billingCtx = locals.billingContext;

    const result = streamText({
        model: openai.chat(env.OPENAI_MODEL),
        messages: modelMessages,
        maxOutputTokens: 4096,
        onFinish: billingCtx
            ? ({ usage }) => {
                  billingCtx.usageData = usage;
                  billingCtx.resolveUsageData();
              }
            : undefined,
    });

    return result.toUIMessageStreamResponse();
};
