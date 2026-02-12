<script lang="ts">
    import * as Card from "$lib/components/ui/card";
    import * as Table from "$lib/components/ui/table";
    import * as Dialog from "$lib/components/ui/dialog";
    import { Button } from "$lib/components/ui/button";
    import { Input } from "$lib/components/ui/input";
    import { Label } from "$lib/components/ui/label";
    import { Badge } from "$lib/components/ui/badge";
    import { Textarea } from "$lib/components/ui/textarea";
    import { Package, Plus, Pencil, RefreshCw } from "lucide-svelte";
    import { toast } from "svelte-sonner";
    import type { CreditPackage } from "$lib/types/credits";

    let packages = $state<CreditPackage[]>([]);
    let loading = $state(true);

    // Dialog state
    let dialogOpen = $state(false);
    let editing = $state<CreditPackage | null>(null);
    let formName = $state("");
    let formCredits = $state("");
    let formPrice = $state("");
    let formDescription = $state("");
    let submitting = $state(false);

    async function loadPackages() {
        loading = true;
        try {
            const res = await fetch("/api/admin/packages");
            if (res.ok) {
                const data = await res.json();
                packages = data.packages;
            }
        } catch {
            toast.error("加载套餐列表失败");
        } finally {
            loading = false;
        }
    }

    function openCreateDialog() {
        editing = null;
        formName = "";
        formCredits = "";
        formPrice = "";
        formDescription = "";
        dialogOpen = true;
    }

    function openEditDialog(pkg: CreditPackage) {
        editing = pkg;
        formName = pkg.name;
        formCredits = String(pkg.credits);
        formPrice = String(pkg.price);
        formDescription = pkg.description ?? "";
        dialogOpen = true;
    }

    async function handleSubmit() {
        if (!formName.trim()) {
            toast.error("套餐名称不能为空");
            return;
        }
        const credits = parseInt(formCredits, 10);
        if (!credits || credits <= 0) {
            toast.error("积分数量必须为正整数");
            return;
        }
        const price = parseInt(formPrice, 10);
        if (isNaN(price) || price < 0) {
            toast.error("价格必须为非负整数（单位：分）");
            return;
        }
        submitting = true;
        try {
            if (editing) {
                const res = await fetch(`/api/admin/packages/${editing.id}`, {
                    method: "PUT",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        name: formName.trim(),
                        credits,
                        price,
                        description: formDescription.trim() || null,
                    }),
                });
                const data = await res.json();
                if (!res.ok) {
                    toast.error(data.error || "更新失败");
                    return;
                }
                toast.success("套餐已更新");
            } else {
                const res = await fetch("/api/admin/packages", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        name: formName.trim(),
                        credits,
                        price,
                        description: formDescription.trim() || undefined,
                    }),
                });
                const data = await res.json();
                if (!res.ok) {
                    toast.error(data.error || "创建失败");
                    return;
                }
                toast.success("套餐已创建");
            }
            dialogOpen = false;
            await loadPackages();
        } catch {
            toast.error("网络错误，请重试");
        } finally {
            submitting = false;
        }
    }

    async function toggleActive(pkg: CreditPackage) {
        try {
            const res = await fetch(`/api/admin/packages/${pkg.id}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ isActive: !pkg.isActive }),
            });
            const data = await res.json();
            if (!res.ok) {
                toast.error(data.error || "操作失败");
                return;
            }
            toast.success(pkg.isActive ? "套餐已停用" : "套餐已启用");
            await loadPackages();
        } catch {
            toast.error("网络错误，请重试");
        }
    }

    function formatDate(dateStr: string): string {
        return new Date(dateStr).toLocaleString("zh-CN", {
            year: "numeric",
            month: "2-digit",
            day: "2-digit",
        });
    }

    $effect(() => {
        loadPackages();
    });
</script>

<section class="flex w-full flex-col items-start justify-start p-6">
    <div class="w-full">
        <div class="flex items-center justify-between">
            <div class="flex flex-col items-start justify-center gap-2">
                <h1 class="text-3xl font-semibold tracking-tight">套餐管理</h1>
                <p class="text-muted-foreground">创建和管理积分套餐</p>
            </div>
            <Button onclick={openCreateDialog}>
                <Plus class="mr-2 h-4 w-4" />
                创建套餐
            </Button>
        </div>

        <div class="mt-6">
            {#if loading}
                <Card.Root>
                    <Card.Content class="py-8 text-center">
                        <RefreshCw class="text-muted-foreground mx-auto h-6 w-6 animate-spin" />
                        <p class="text-muted-foreground mt-2 text-sm">加载中...</p>
                    </Card.Content>
                </Card.Root>
            {:else if packages.length === 0}
                <Card.Root>
                    <Card.Content class="py-8 text-center">
                        <Package class="text-muted-foreground mx-auto h-8 w-8" />
                        <p class="text-muted-foreground mt-2 text-sm">暂无套餐，点击上方按钮创建</p>
                    </Card.Content>
                </Card.Root>
            {:else}
                <Card.Root>
                    <Table.Root>
                        <Table.Header>
                            <Table.Row>
                                <Table.Head>名称</Table.Head>
                                <Table.Head>积分</Table.Head>
                                <Table.Head>价格</Table.Head>
                                <Table.Head class="hidden md:table-cell">描述</Table.Head>
                                <Table.Head>状态</Table.Head>
                                <Table.Head class="hidden sm:table-cell">创建时间</Table.Head>
                                <Table.Head class="text-right">操作</Table.Head>
                            </Table.Row>
                        </Table.Header>
                        <Table.Body>
                            {#each packages as pkg (pkg.id)}
                                <Table.Row class={pkg.isActive ? "" : "opacity-60"}>
                                    <Table.Cell class="font-medium">{pkg.name}</Table.Cell>
                                    <Table.Cell>{pkg.credits.toLocaleString()}</Table.Cell>
                                    <Table.Cell>¥{(pkg.price / 100).toFixed(2)}</Table.Cell>
                                    <Table.Cell class="text-muted-foreground hidden max-w-48 truncate md:table-cell">
                                        {pkg.description ?? "-"}
                                    </Table.Cell>
                                    <Table.Cell>
                                        {#if pkg.isActive}
                                            <Badge variant="default">启用</Badge>
                                        {:else}
                                            <Badge variant="secondary">停用</Badge>
                                        {/if}
                                    </Table.Cell>
                                    <Table.Cell class="text-muted-foreground hidden text-sm sm:table-cell">
                                        {formatDate(pkg.createdAt)}
                                    </Table.Cell>
                                    <Table.Cell class="text-right">
                                        <div class="flex items-center justify-end gap-2">
                                            <Button variant="ghost" size="sm" onclick={() => openEditDialog(pkg)}>
                                                <Pencil class="h-4 w-4" />
                                            </Button>
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                onclick={() => toggleActive(pkg)}
                                            >
                                                {pkg.isActive ? "停用" : "启用"}
                                            </Button>
                                        </div>
                                    </Table.Cell>
                                </Table.Row>
                            {/each}
                        </Table.Body>
                    </Table.Root>
                </Card.Root>
            {/if}
        </div>
    </div>
</section>

<!-- Create/Edit Dialog -->
<Dialog.Root bind:open={dialogOpen}>
    <Dialog.Content>
        <Dialog.Header>
            <Dialog.Title>{editing ? "编辑套餐" : "创建套餐"}</Dialog.Title>
            <Dialog.Description>
                {editing ? "修改套餐信息" : "填写以下信息创建新的积分套餐"}
            </Dialog.Description>
        </Dialog.Header>
        <form
            class="flex flex-col gap-4"
            onsubmit={(e) => { e.preventDefault(); handleSubmit(); }}
        >
            <div class="space-y-2">
                <Label for="pkg-name">套餐名称</Label>
                <Input
                    id="pkg-name"
                    bind:value={formName}
                    placeholder="例如：基础套餐"
                    disabled={submitting}
                />
            </div>
            <div class="space-y-2">
                <Label for="pkg-credits">积分数量</Label>
                <Input
                    id="pkg-credits"
                    type="number"
                    bind:value={formCredits}
                    placeholder="例如：100"
                    min="1"
                    disabled={submitting}
                />
            </div>
            <div class="space-y-2">
                <Label for="pkg-price">价格（分）</Label>
                <Input
                    id="pkg-price"
                    type="number"
                    bind:value={formPrice}
                    placeholder="例如：990 表示 ¥9.90"
                    min="0"
                    disabled={submitting}
                />
            </div>
            <div class="space-y-2">
                <Label for="pkg-desc">描述（可选）</Label>
                <Textarea
                    id="pkg-desc"
                    bind:value={formDescription}
                    placeholder="套餐描述"
                    disabled={submitting}
                />
            </div>
            <Dialog.Footer>
                <Button variant="outline" type="button" onclick={() => (dialogOpen = false)} disabled={submitting}>
                    取消
                </Button>
                <Button type="submit" disabled={submitting}>
                    {#if submitting}
                        <RefreshCw class="mr-2 h-4 w-4 animate-spin" />
                        提交中...
                    {:else}
                        {editing ? "保存" : "创建"}
                    {/if}
                </Button>
            </Dialog.Footer>
        </form>
    </Dialog.Content>
</Dialog.Root>
