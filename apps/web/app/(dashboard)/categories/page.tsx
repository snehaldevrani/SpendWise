"use client";

import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Pencil, Trash2, Tag, Search } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { api } from "@/lib/api";
import type { CustomCategoryDto } from "@/lib/api";

// ─── Built-in categories (read-only reference) ────────────────────────────────

const BUILT_IN = [
  { slug: "food", name: "Food & Dining", emoji: "🍔", color: "#f59e0b" },
  { slug: "shopping", name: "Shopping", emoji: "🛒", color: "#8b5cf6" },
  { slug: "travel", name: "Travel", emoji: "🚗", color: "#3b82f6" },
  { slug: "utilities", name: "Bills & Utilities", emoji: "💡", color: "#10b981" },
  { slug: "entertainment", name: "Entertainment", emoji: "🎬", color: "#ec4899" },
  { slug: "health", name: "Health", emoji: "🏥", color: "#ef4444" },
  { slug: "subscriptions", name: "Subscriptions", emoji: "🔄", color: "#06b6d4" },
  { slug: "income", name: "Income", emoji: "💰", color: "#84cc16" },
  { slug: "other", name: "Other", emoji: "📦", color: "#6b7280" },
];

// ─── Preset colours for the colour picker ─────────────────────────────────────

const PRESET_COLORS = [
  "#ef4444", "#f97316", "#eab308", "#22c55e",
  "#06b6d4", "#3b82f6", "#8b5cf6", "#ec4899",
  "#10b981", "#f59e0b", "#6b7280", "#ffffff",
];

// ─── Preset emojis for quick pick ─────────────────────────────────────────────

const PRESET_EMOJIS = [
  "🏠", "🐾", "🏋️", "📚", "✈️", "🎓", "🧴", "🎁",
  "🍕", "🚌", "💊", "🏦", "👗", "🔧", "⚽", "🎮",
];

// ─── Types ────────────────────────────────────────────────────────────────────

interface FormState {
  name: string;
  emoji: string;
  color: string;
  merchantSearch: string;
  selectedMerchants: string[];
}

const DEFAULT_FORM: FormState = {
  name: "",
  emoji: "",
  color: "#10b981",
  merchantSearch: "",
  selectedMerchants: [],
};

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function CategoriesPage() {
  const qc = useQueryClient();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<CustomCategoryDto | null>(null);
  const [form, setForm] = useState<FormState>(DEFAULT_FORM);

  // ── Data fetching ────────────────────────────────────────────────────────────

  const { data: customCats = [], isLoading: catsLoading } = useQuery<CustomCategoryDto[]>({
    queryKey: ["custom-categories"],
    queryFn: () => api.get<CustomCategoryDto[]>("/custom-categories").then((r) => r.data),
  });

  const { data: merchants = [], isLoading: merchantsLoading } = useQuery<string[]>({
    queryKey: ["merchants"],
    queryFn: () => api.get<string[]>("/transactions/merchants").then((r) => r.data),
    enabled: dialogOpen,
  });

  // ── Filtered merchant list ───────────────────────────────────────────────────

  const filteredMerchants = useMemo(() => {
    const q = form.merchantSearch.toLowerCase();
    return q ? merchants.filter((m) => m.toLowerCase().includes(q)) : merchants;
  }, [merchants, form.merchantSearch]);

  // ── Mutations ────────────────────────────────────────────────────────────────

  const createMutation = useMutation({
    mutationFn: (body: { name: string; merchants: string[]; emoji?: string; color?: string }) =>
      api.post("/custom-categories", body).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["custom-categories"] });
      qc.invalidateQueries({ queryKey: ["transactions"] });
      qc.invalidateQueries({ queryKey: ["overview"] });
      closeDialog();
      toast.success("Category created");
    },
    onError: () => toast.error("Failed to create category"),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, body }: { id: string; body: { name?: string; merchants?: string[]; emoji?: string; color?: string } }) =>
      api.patch(`/custom-categories/${id}`, body).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["custom-categories"] });
      qc.invalidateQueries({ queryKey: ["transactions"] });
      qc.invalidateQueries({ queryKey: ["overview"] });
      closeDialog();
      toast.success("Category updated");
    },
    onError: () => toast.error("Failed to update category"),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/custom-categories/${id}`).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["custom-categories"] });
      qc.invalidateQueries({ queryKey: ["transactions"] });
      qc.invalidateQueries({ queryKey: ["overview"] });
      setDeleteTarget(null);
      toast.success("Category deleted — transactions reset to Other");
    },
    onError: () => toast.error("Failed to delete category"),
  });

  // ── Handlers ─────────────────────────────────────────────────────────────────

  function openCreate() {
    setEditingId(null);
    setForm(DEFAULT_FORM);
    setDialogOpen(true);
  }

  function openEdit(cat: CustomCategoryDto) {
    setEditingId(cat.id);
    setForm({
      name: cat.name,
      emoji: cat.emoji ?? "",
      color: cat.color ?? "#10b981",
      merchantSearch: "",
      selectedMerchants: cat.merchants,
    });
    setDialogOpen(true);
  }

  function closeDialog() {
    setDialogOpen(false);
    setEditingId(null);
    setForm(DEFAULT_FORM);
  }

  function toggleMerchant(merchant: string) {
    setForm((f) => ({
      ...f,
      selectedMerchants: f.selectedMerchants.includes(merchant)
        ? f.selectedMerchants.filter((m) => m !== merchant)
        : [...f.selectedMerchants, merchant],
    }));
  }

  function handleSave() {
    if (!form.name.trim()) {
      toast.error("Category name is required");
      return;
    }
    const body = {
      name: form.name.trim(),
      merchants: form.selectedMerchants,
      emoji: form.emoji || undefined,
      color: form.color || undefined,
    };
    if (editingId) {
      updateMutation.mutate({ id: editingId, body });
    } else {
      createMutation.mutate(body);
    }
  }

  const isSaving = createMutation.isPending || updateMutation.isPending;

  return (
    <div className="max-w-5xl mx-auto">
      {/* Header */}
      <div className="mb-8 flex items-start justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Categories</h1>
          <p className="text-zinc-400 mt-1">
            Create custom categories and map merchant names to them. All matching transactions are classified automatically.
          </p>
        </div>
        <Button onClick={openCreate} className="bg-emerald-500 hover:bg-emerald-600 text-black font-semibold">
          <Plus className="h-4 w-4 mr-2" />New Category
        </Button>
      </div>

      {/* Custom categories */}
      <section className="mb-10">
        <h2 className="text-sm font-semibold text-zinc-400 uppercase tracking-wider mb-4">Your Categories</h2>
        {catsLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-36 bg-zinc-800 rounded-lg" />
            ))}
          </div>
        ) : customCats.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center border border-white/10 rounded-lg bg-zinc-900/30">
            <div className="p-3 rounded-full bg-emerald-500/10 mb-3">
              <Tag className="h-6 w-6 text-emerald-500" />
            </div>
            <p className="text-white font-medium mb-1">No custom categories yet</p>
            <p className="text-zinc-400 text-sm max-w-xs">
              Create a category like &quot;Rent&quot; or &quot;Pets&quot;, then select merchant names to classify all their transactions automatically.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {customCats.map((cat) => (
              <Card key={cat.id} className="bg-zinc-900/50 border-white/10 hover:border-emerald-500/30 transition-colors">
                <CardContent className="p-5">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <span
                        className="text-xl w-8 h-8 flex items-center justify-center rounded-md text-base"
                        style={{ backgroundColor: (cat.color ?? "#10b981") + "33" }}
                      >
                        {cat.emoji || "🏷️"}
                      </span>
                      <span className="text-white font-semibold">{cat.name}</span>
                    </div>
                    <div className="flex gap-1">
                      <button
                        onClick={() => openEdit(cat)}
                        className="p-1.5 text-zinc-500 hover:text-white transition-colors rounded"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                      <button
                        onClick={() => setDeleteTarget(cat)}
                        className="p-1.5 text-zinc-500 hover:text-red-400 transition-colors rounded"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                  <p className="text-zinc-500 text-xs mb-2">
                    {cat.merchants.length === 0
                      ? "No merchants assigned"
                      : `${cat.merchants.length} merchant${cat.merchants.length !== 1 ? "s" : ""}`}
                  </p>
                  <div className="flex flex-wrap gap-1">
                    {cat.merchants.slice(0, 4).map((m) => (
                      <Badge key={m} className="bg-zinc-800 text-zinc-300 border-0 text-xs font-normal">
                        {m}
                      </Badge>
                    ))}
                    {cat.merchants.length > 4 && (
                      <Badge className="bg-zinc-800 text-zinc-500 border-0 text-xs font-normal">
                        +{cat.merchants.length - 4} more
                      </Badge>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </section>

      {/* Built-in categories (read-only) */}
      <section>
        <h2 className="text-sm font-semibold text-zinc-400 uppercase tracking-wider mb-4">Built-in Categories</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          {BUILT_IN.map((cat) => (
            <div
              key={cat.slug}
              className="flex items-center gap-2.5 px-3 py-2.5 rounded-lg bg-zinc-900/40 border border-white/5"
            >
              <span
                className="text-base w-7 h-7 flex items-center justify-center rounded"
                style={{ backgroundColor: cat.color + "33" }}
              >
                {cat.emoji}
              </span>
              <span className="text-zinc-300 text-sm">{cat.name}</span>
            </div>
          ))}
        </div>
      </section>

      {/* Create / Edit dialog */}
      <Dialog open={dialogOpen} onOpenChange={(o) => !o && closeDialog()}>
        <DialogContent className="bg-zinc-900 border-white/10 text-white max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingId ? "Edit Category" : "New Category"}</DialogTitle>
          </DialogHeader>

          <div className="space-y-5 mt-2">
            {/* Name */}
            <div>
              <label className="text-sm text-zinc-400 mb-1.5 block">Category Name</label>
              <Input
                placeholder="e.g. Rent, Pets, EMI"
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                className="bg-zinc-800 border-white/10 text-white placeholder:text-zinc-500"
                maxLength={50}
              />
            </div>

            {/* Emoji + Color row */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm text-zinc-400 mb-1.5 block">Emoji</label>
                <Input
                  placeholder="🏠 or type any emoji"
                  value={form.emoji}
                  onChange={(e) => setForm((f) => ({ ...f, emoji: e.target.value }))}
                  className="bg-zinc-800 border-white/10 text-white placeholder:text-zinc-500"
                  maxLength={10}
                />
                <div className="flex flex-wrap gap-1 mt-2">
                  {PRESET_EMOJIS.map((e) => (
                    <button
                      key={e}
                      onClick={() => setForm((f) => ({ ...f, emoji: e }))}
                      className={`text-base w-7 h-7 rounded hover:bg-zinc-700 transition-colors ${form.emoji === e ? "bg-zinc-700 ring-1 ring-emerald-500" : ""}`}
                    >
                      {e}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="text-sm text-zinc-400 mb-1.5 block">Colour</label>
                <div className="flex flex-wrap gap-2 mt-1">
                  {PRESET_COLORS.map((c) => (
                    <button
                      key={c}
                      onClick={() => setForm((f) => ({ ...f, color: c }))}
                      className={`w-6 h-6 rounded-full border-2 transition-all ${form.color === c ? "border-white scale-110" : "border-transparent"}`}
                      style={{ backgroundColor: c }}
                    />
                  ))}
                </div>
              </div>
            </div>

            {/* Merchant multi-select */}
            <div>
              <label className="text-sm text-zinc-400 mb-1.5 block">
                Assign Merchants
                {form.selectedMerchants.length > 0 && (
                  <span className="ml-2 text-emerald-400">{form.selectedMerchants.length} selected</span>
                )}
              </label>
              <p className="text-xs text-zinc-500 mb-2">
                All transactions from selected merchants will be classified under this category.
              </p>

              {/* Search within merchants */}
              <div className="relative mb-2">
                <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-zinc-500" />
                <Input
                  placeholder="Search merchants..."
                  value={form.merchantSearch}
                  onChange={(e) => setForm((f) => ({ ...f, merchantSearch: e.target.value }))}
                  className="bg-zinc-800 border-white/10 text-white placeholder:text-zinc-500 pl-8 text-sm"
                />
              </div>

              <div className="max-h-52 overflow-y-auto rounded-md border border-white/10 bg-zinc-800/50">
                {merchantsLoading ? (
                  <div className="p-3 space-y-2">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <Skeleton key={i} className="h-5 w-full bg-zinc-700" />
                    ))}
                  </div>
                ) : filteredMerchants.length === 0 ? (
                  <p className="text-zinc-500 text-sm text-center py-6">
                    {merchants.length === 0 ? "No transactions uploaded yet" : "No merchants match your search"}
                  </p>
                ) : (
                  <ul>
                    {filteredMerchants.map((merchant) => {
                      const checked = form.selectedMerchants.includes(merchant);
                      return (
                        <li key={merchant}>
                          <button
                            onClick={() => toggleMerchant(merchant)}
                            className={`w-full flex items-center gap-2.5 px-3 py-2 text-sm text-left transition-colors hover:bg-zinc-700/50 ${checked ? "text-white" : "text-zinc-400"}`}
                          >
                            <span
                              className={`flex-shrink-0 w-4 h-4 rounded border flex items-center justify-center transition-colors ${
                                checked ? "bg-emerald-500 border-emerald-500" : "border-zinc-600"
                              }`}
                            >
                              {checked && (
                                <svg className="w-2.5 h-2.5 text-black" fill="none" viewBox="0 0 10 8">
                                  <path d="M1 4l3 3 5-6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                                </svg>
                              )}
                            </span>
                            {merchant}
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-3 pt-1">
              <Button variant="outline" className="flex-1 border-white/10 text-zinc-400" onClick={closeDialog}>
                Cancel
              </Button>
              <Button
                className="flex-1 bg-emerald-500 hover:bg-emerald-600 text-black font-semibold"
                onClick={handleSave}
                disabled={isSaving}
              >
                {isSaving ? "Saving..." : editingId ? "Update Category" : "Create Category"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <AlertDialogContent className="bg-zinc-900 border-white/10 text-white">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete &quot;{deleteTarget?.name}&quot;?</AlertDialogTitle>
            <AlertDialogDescription className="text-zinc-400">
              All transactions currently classified as <span className="text-white font-medium">{deleteTarget?.name}</span> will be reset to &quot;Other&quot;. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="border-white/10 text-zinc-400 hover:bg-zinc-800">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}
              className="bg-red-500 hover:bg-red-600 text-white"
              disabled={deleteMutation.isPending}
            >
              {deleteMutation.isPending ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
