<script lang="ts">
    import * as Card from "$lib/components/ui/card";
    import * as Table from "$lib/components/ui/table";
    import * as Dialog from "$lib/components/ui/dialog";
    import * as Select from "$lib/components/ui/select";
    import { Button } from "$lib/components/ui/button";
    import { Input } from "$lib/components/ui/input";
    import { Label } from "$lib/components/ui/label";
    import { Badge } from "$lib/components/ui/badge";
    import { Separator } from "$lib/components/ui/separator";
    import {
        Ticket, Plus, Copy, Check, RefreshCw, Eye, Undo2,
    } from "lucide-svelte";
    import { toast } from "svelte-sonner";
    import type {
        CreditPackage,
        RedemptionCodeWithPackage,
        RedemptionDetail,
    } from "$lib/types/credits";

    // List state
    let codes = $state<RedemptionCodeWithPackage[]>([]);
    let packages = $state<CreditPackage[]>([]);
    let loading = $state(true);

    // Filters
    let filterPackageId = $state<string>("");
    let filterStatus = $state<string>("");

    // Generate dialog state
    let generateOpen = $state(false);
    let genPackageId = $state("");
    let genCount = $state("1");
    let genExpiresAt = $state("");
    let genMaxRedemptions = $state("");
    let generating = $state(false);

    // Redemptions dialog state
    let redemptionsOpen = $state(false);
    let redemptionsCode = $state<RedemptionCodeWithPackage | null>(null);
    let redemptions = $state<RedemptionDetail[]>([]);
    let loadingRedemptions = $state(false);
    let refunding = $state<string | null>(null);

    // Clipboard state
    let copiedId = $state<string | null>(null);

    async function loadPackages() {
        try {
            const res = await fetch("/api/admin/packages");
            if (res.ok) {
                const data = await res.json();
                packages = data.packages;
            }
        } catch {
            // silent
        }
    }

    async function loadCodes() {
        loading = true;
        try {
            const params = new URLSearchParams();
            if (filterPackageId) params.set("packageId", filterPackageId);
            if (filterStatus) params.set("isActive", filterStatus);
            const res = await fetch(`/api/admin/codes?${params.toString()}`);
            if (res.ok) {
                const data = await res.json();
                codes = data.codes;
            }
        } catch {
            toast.error("加载兑换码列表失败");
        } finally {
            loading = false;
        }
    }

    function openGenerateDialog() {
        genPackageId = "";
        genCount = "1";
        genExpiresAt = "";
        genMaxRedemptions = "";
        generateOpen = true;
    }

    async function handleGenerate() {
        if (!genPackageId) {
            toast.error("请选择关联套餐");
            return;
        }
        const count = parseInt(genCount, 10);
        if (!count || count < 1 || count > 100) {
            toast.error("生成数量必须为1-100之间的整数");
            return;
        }
        generating = true;
        try {
            const body: Record<string, unknown> = {
                packageId: genPackageId,
                count,
            };
            if (genExpiresAt) body.expiresAt = new Date(genExpiresAt).toISOString();
            if (genMaxRedemptions) {
                const maxR = parseInt(genMaxRedemptions, 10);
                if (maxR > 0) body.maxRedemptions = maxR;
            }
            const res = await fetch("/api/admin/codes", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(body),
            });
            const data = await res.json();
            if (!res.ok) {
                toast.error(data.error || "生成失败");
                return;
            }
            toast.success(`成功生成 ${data.codes.length} 个兑换码`);
            generateOpen = false;
            await loadCodes();
        } catch {
            toast.error("网络错误，请重试");
        } finally {
            generating = false;
        }
    }

    async function copyCode(code: string, id: string) {
        try {
            await navigator.clipboard.writeText(code);
            copiedId = id;
            toast.success("已复制到剪贴板");
            setTimeout(() => { copiedId = null; }, 2000);
        } catch {
            toast.error("复制失败");
        }
    }

    async function openRedemptions(code: RedemptionCodeWithPackage) {
        redemptionsCode = code;
        redemptions = [];
        redemptionsOpen = true;
        loadingRedemptions = true;
        try {
            const res = await fetch(`/api/admin/codes/${encodeURIComponent(code.code)}/redemptions`);
            if (res.ok) {
                const data = await res.json();
                redemptions = data.redemptions;
            } else {
                toast.error("加载兑换记录失败");
            }
        } catch {
            toast.error("网络错误");
        } finally {
            loadingRedemptions = false;
        }
    }

    async function handleRefund(transactionId: string) {
        refunding = transactionId;
        try {
            const res = await fetch("/api/admin/refund", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ transactionId }),
            });
            const data = await res.json();
            if (!res.ok) {
                toast.error(data.error || "退款失败");
                return;
            }
            toast.success(`退款成功，扣除 ${data.creditsDeducted} 积分`);
            // Refresh redemptions list
            if (redemptionsCode) {
                await openRedemptions(redemptionsCode);
            }
            await loadCodes();
        } catch {
            toast.error("网络错误，请重试");
        } finally {
            refunding = null;
        }
    }

    function formatDate(dateStr: string): string {
        return new Date(dateStr).toLocaleString("zh-CN", {
            year: "numeric",
            month: "2-digit",
            day: "2-digit",
            hour: "2-digit",
            minute: "2-digit",
        });
    }

    function formatDateShort(dateStr: string): string {
        return new Date(dateStr).toLocaleString("zh-CN", {
            year: "numeric",
            month: "2-digit",
            day: "2-digit",
        });
    }

    function isExpired(expiresAt: string | null): boolean {
        if (!expiresAt) return false;
        return new Date(expiresAt) < new Date();
    }

    function getCodeStatus(code: RedemptionCodeWithPackage): { label: string; variant: "default" | "secondary" | "destructive" | "outline" } {
        if (!code.isActive) return { label: "停用", variant: "secondary" };
        if (isExpired(code.expiresAt)) return { label: "已过期", variant: "destructive" };
        if (code.maxRedemptions !== null && code.currentRedemptions >= code.maxRedemptions) {
            return { label: "已用完", variant: "outline" };
        }
        return { label: "有效", variant: "default" };
    }

    // Active packages for the select dropdown
    let activePackages = $derived(packages.filter(p => p.isActive));

    $effect(() => {
        loadPackages();
        loadCodes();
    });

    // Re-load codes when filters change
    $effect(() => {
        // Access reactive values to track them
        filterPackageId;
        filterStatus;
        loadCodes();
    });
</script>

<section class="flex w-full flex-col items-start justify-start p-6">
    <div class="w-full">
        <div class="flex items-center justify-between">
            <div class="flex flex-col items-start justify-center gap-2">
                <h1 class="text-3xl font-semibold tracking-tight">兑换码管理</h1>
                <p class="text-muted-foreground">生成和管理兑换码</p>
            </div>
            <Button onclick={openGenerateDialog}>
                <Plus class="mr-2 h-4 w-4" />
                生成兑换码
            </Button>
        </div>

        <!-- Filters -->
        <div class="mt-6 flex flex-wrap items-center gap-3">
            <Select.Root type="single" bind:value={filterPackageId}>
                <Select.Trigger class="w-48">
                    {filterPackageId
                        ? packages.find(p => p.id === filterPackageId)?.name ?? "全部套餐"
                        : "全部套餐"}
                </Select.Trigger>
                <Select.Content>
                    <Select.Item value="">全部套餐</Select.Item>
                    {#each packages as pkg (pkg.id)}
                        <Select.Item value={pkg.id}>{pkg.name}</Select.Item>
                    {/each}
                </Select.Content>
            </Select.Root>
            <Select.Root type="single" bind:value={filterStatus}>
                <Select.Trigger class="w-36">
                    {filterStatus === "true" ? "启用" : filterStatus === "false" ? "停用" : "全部状态"}
                </Select.Trigger>
                <Select.Content>
                    <Select.Item value="">全部状态</Select.Item>
                    <Select.Item value="true">启用</Select.Item>
                    <Select.Item value="false">停用</Select.Item>
                </Select.Content>
            </Select.Root>
        </div>

        <!-- Codes Table -->
        <div class="mt-4">
            {#if loading}
                <Card.Root>
                    <Card.Content class="py-8 text-center">
                        <RefreshCw class="text-muted-foreground mx-auto h-6 w-6 animate-spin" />
                        <p class="text-muted-foreground mt-2 text-sm">加载中...</p>
                    </Card.Content>
                </Card.Root>
            {:else if codes.length === 0}
                <Card.Root>
                    <Card.Content class="py-8 text-center">
                        <Ticket class="text-muted-foreground mx-auto h-8 w-8" />
                        <p class="text-muted-foreground mt-2 text-sm">暂无兑换码</p>
                    </Card.Content>
                </Card.Root>
            {:else}
                <Card.Root>
                    <div class="overflow-x-auto">
                        <Table.Root>
                            <Table.Header>
                                <Table.Row>
                                    <Table.Head>兑换码</Table.Head>
                                    <Table.Head>套餐</Table.Head>
                                    <Table.Head>积分</Table.Head>
                                    <Table.Head>使用情况</Table.Head>
                                    <Table.Head>状态</Table.Head>
                                    <Table.Head class="hidden lg:table-cell">过期时间</Table.Head>
                                    <Table.Head class="text-right">操作</Table.Head>
                                </Table.Row>
                            </Table.Header>
                            <Table.Body>
                                {#each codes as code (code.id)}
                                    {@const status = getCodeStatus(code)}
                                    <Table.Row>
                                        <Table.Cell>
                                            <div class="flex items-center gap-2">
                                                <code class="rounded bg-muted px-1.5 py-0.5 text-xs font-mono">
                                                    {code.code}
                                                </code>
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    class="h-7 w-7 p-0"
                                                    onclick={() => copyCode(code.code, code.id)}
                                                >
                                                    {#if copiedId === code.id}
                                                        <Check class="h-3.5 w-3.5 text-green-500" />
                                                    {:else}
                                                        <Copy class="h-3.5 w-3.5" />
                                                    {/if}
                                                </Button>
                                            </div>
                                        </Table.Cell>
                                        <Table.Cell>{code.packageName ?? "-"}</Table.Cell>
                                        <Table.Cell>{code.packageCredits?.toLocaleString() ?? "-"}</Table.Cell>
                                        <Table.Cell>
                                            {code.currentRedemptions}{code.maxRedemptions !== null ? `/${code.maxRedemptions}` : "/∞"}
                                        </Table.Cell>
                                        <Table.Cell>
                                            <Badge variant={status.variant}>{status.label}</Badge>
                                        </Table.Cell>
                                        <Table.Cell class="text-muted-foreground hidden text-sm lg:table-cell">
                                            {code.expiresAt ? formatDateShort(code.expiresAt) : "永不过期"}
                                        </Table.Cell>
                                        <Table.Cell class="text-right">
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                onclick={() => openRedemptions(code)}
                                            >
                                                <Eye class="mr-1 h-4 w-4" />
                                                兑换记录
                                            </Button>
                                        </Table.Cell>
                                    </Table.Row>
                                {/each}
                            </Table.Body>
                        </Table.Root>
                    </div>
                </Card.Root>
            {/if}
        </div>
    </div>
</section>

<!-- Generate Codes Dialog -->
<Dialog.Root bind:open={generateOpen}>
    <Dialog.Content>
        <Dialog.Header>
            <Dialog.Title>生成兑换码</Dialog.Title>
            <Dialog.Description>选择套餐并设置兑换码参数</Dialog.Description>
        </Dialog.Header>
        <form
            class="flex flex-col gap-4"
            onsubmit={(e) => { e.preventDefault(); handleGenerate(); }}
        >
            <div class="space-y-2">
                <Label>关联套餐</Label>
                <Select.Root type="single" bind:value={genPackageId}>
                    <Select.Trigger class="w-full">
                        {genPackageId
                            ? activePackages.find(p => p.id === genPackageId)?.name ?? "请选择套餐"
                            : "请选择套餐"}
                    </Select.Trigger>
                    <Select.Content>
                        {#each activePackages as pkg (pkg.id)}
                            <Select.Item value={pkg.id}>
                                {pkg.name}（{pkg.credits} 积分）
                            </Select.Item>
                        {/each}
                    </Select.Content>
                </Select.Root>
            </div>
            <div class="space-y-2">
                <Label for="gen-count">生成数量</Label>
                <Input
                    id="gen-count"
                    type="number"
                    bind:value={genCount}
                    placeholder="1-100"
                    min="1"
                    max="100"
                    disabled={generating}
                />
            </div>
            <div class="space-y-2">
                <Label for="gen-expires">过期时间（可选）</Label>
                <Input
                    id="gen-expires"
                    type="datetime-local"
                    bind:value={genExpiresAt}
                    disabled={generating}
                />
            </div>
            <div class="space-y-2">
                <Label for="gen-max">最大使用次数（可选，留空为不限）</Label>
                <Input
                    id="gen-max"
                    type="number"
                    bind:value={genMaxRedemptions}
                    placeholder="不限"
                    min="1"
                    disabled={generating}
                />
            </div>
            <Dialog.Footer>
                <Button variant="outline" type="button" onclick={() => (generateOpen = false)} disabled={generating}>
                    取消
                </Button>
                <Button type="submit" disabled={generating}>
                    {#if generating}
                        <RefreshCw class="mr-2 h-4 w-4 animate-spin" />
                        生成中...
                    {:else}
                        生成
                    {/if}
                </Button>
            </Dialog.Footer>
        </form>
    </Dialog.Content>
</Dialog.Root>

<!-- Redemptions Dialog -->
<Dialog.Root bind:open={redemptionsOpen}>
    <Dialog.Content class="max-w-2xl">
        <Dialog.Header>
            <Dialog.Title>兑换记录</Dialog.Title>
            <Dialog.Description>
                {#if redemptionsCode}
                    兑换码：<code class="rounded bg-muted px-1.5 py-0.5 text-xs font-mono">{redemptionsCode.code}</code>
                    &nbsp;|&nbsp;套餐：{redemptionsCode.packageName ?? "-"}
                    &nbsp;|&nbsp;积分：{redemptionsCode.packageCredits?.toLocaleString() ?? "-"}
                {/if}
            </Dialog.Description>
        </Dialog.Header>
        <Separator />
        <div class="max-h-96 overflow-y-auto">
            {#if loadingRedemptions}
                <div class="py-8 text-center">
                    <RefreshCw class="text-muted-foreground mx-auto h-6 w-6 animate-spin" />
                    <p class="text-muted-foreground mt-2 text-sm">加载中...</p>
                </div>
            {:else if redemptions.length === 0}
                <div class="py-8 text-center">
                    <p class="text-muted-foreground text-sm">暂无兑换记录</p>
                </div>
            {:else}
                <Table.Root>
                    <Table.Header>
                        <Table.Row>
                            <Table.Head>用户</Table.Head>
                            <Table.Head>积分</Table.Head>
                            <Table.Head>时间</Table.Head>
                            <Table.Head class="text-right">操作</Table.Head>
                        </Table.Row>
                    </Table.Header>
                    <Table.Body>
                        {#each redemptions as r (r.id)}
                            <Table.Row>
                                <Table.Cell>
                                    <div>
                                        <p class="text-sm font-medium">{r.userName ?? "未知用户"}</p>
                                        <p class="text-muted-foreground text-xs">{r.userEmail ?? "-"}</p>
                                    </div>
                                </Table.Cell>
                                <Table.Cell class="font-medium">
                                    +{r.amount.toLocaleString()}
                                </Table.Cell>
                                <Table.Cell class="text-muted-foreground text-sm">
                                    {formatDate(r.createdAt)}
                                </Table.Cell>
                                <Table.Cell class="text-right">
                                    {#if r.refunded}
                                        <Badge variant="secondary">已退款</Badge>
                                    {:else}
                                        <Button
                                            variant="destructive"
                                            size="sm"
                                            disabled={refunding === r.id}
                                            onclick={() => handleRefund(r.id)}
                                        >
                                            {#if refunding === r.id}
                                                <RefreshCw class="mr-1 h-3.5 w-3.5 animate-spin" />
                                                退款中...
                                            {:else}
                                                <Undo2 class="mr-1 h-3.5 w-3.5" />
                                                退款
                                            {/if}
                                        </Button>
                                    {/if}
                                </Table.Cell>
                            </Table.Row>
                        {/each}
                    </Table.Body>
                </Table.Root>
            {/if}
        </div>
    </Dialog.Content>
</Dialog.Root>
