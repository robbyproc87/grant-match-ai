"use client";

import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { EmptyState } from "@/components/empty-state";
import { toast } from "sonner";
import type { StoryBlock, StoryKind } from "@/lib/types/db";
import {
  createStoryBlock,
  updateStoryBlock,
  deleteStoryBlock,
  STORY_KINDS,
} from "./actions";

const KIND_LABELS: Record<StoryKind, string> = {
  impact_stat: "Impact Stat",
  testimonial: "Testimonial",
  program: "Program",
  narrative: "Narrative",
  other: "Other",
};

type FormState = {
  kind: StoryKind;
  title: string;
  content: string;
  tags: string;
};

const EMPTY_FORM: FormState = {
  kind: "impact_stat",
  title: "",
  content: "",
  tags: "",
};

type Props = {
  initialBlocks: StoryBlock[];
};

export function StoryBankClient({ initialBlocks }: Props) {
  const [blocks, setBlocks] = useState<StoryBlock[]>(initialBlocks);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  const openAdd = () => {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setShowForm(true);
  };

  const openEdit = (block: StoryBlock) => {
    setEditingId(block.id);
    setForm({
      kind: block.kind,
      title: block.title,
      content: block.content,
      tags: block.tags.join(", "),
    });
    setShowForm(true);
  };

  const closeForm = () => {
    setShowForm(false);
    setEditingId(null);
    setForm(EMPTY_FORM);
  };

  const parseTags = (raw: string): string[] =>
    raw
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean);

  const handleSave = async () => {
    if (!form.title.trim()) {
      toast.error("Title is required.");
      return;
    }
    setSaving(true);
    const tags = parseTags(form.tags);

    if (editingId) {
      // Optimistic update
      setBlocks((prev) =>
        prev.map((b) =>
          b.id === editingId
            ? {
                ...b,
                kind: form.kind,
                title: form.title.trim(),
                content: form.content,
                tags,
                updated_at: new Date().toISOString(),
              }
            : b,
        ),
      );
      closeForm();
      const result = await updateStoryBlock(editingId, {
        kind: form.kind,
        title: form.title.trim(),
        content: form.content,
        tags,
      });
      if (result.ok) {
        toast.success("Story updated.");
      } else {
        toast.error(result.error ?? "Failed to update.");
        // Note: server will revalidate; next navigation picks up real state
      }
    } else {
      // Optimistic add with a temp id
      const tempId = `temp-${Date.now()}`;
      const optimistic: StoryBlock = {
        id: tempId,
        org_id: "",
        kind: form.kind,
        title: form.title.trim(),
        content: form.content,
        tags,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      setBlocks((prev) => [optimistic, ...prev]);
      closeForm();
      const result = await createStoryBlock({
        kind: form.kind,
        title: form.title.trim(),
        content: form.content,
        tags,
      });
      if (result.ok) {
        // Reconcile the temp row with the real id/org_id so a subsequent
        // edit/delete in this session targets the actual DB row.
        setBlocks((prev) =>
          prev.map((b) =>
            b.id === tempId ? { ...b, id: result.id, org_id: result.org_id } : b,
          ),
        );
        toast.success("Story added.");
      } else {
        setBlocks((prev) => prev.filter((b) => b.id !== tempId));
        toast.error(result.error ?? "Failed to add.");
      }
    }
    setSaving(false);
  };

  const handleDelete = async (id: string) => {
    // Optimistic remove
    const removed = blocks.find((b) => b.id === id);
    setBlocks((prev) => prev.filter((b) => b.id !== id));
    setConfirmDelete(null);
    const result = await deleteStoryBlock(id);
    if (result.ok) {
      toast.success("Deleted.");
    } else {
      if (removed) setBlocks((prev) => [removed, ...prev]);
      toast.error(result.error ?? "Failed to delete.");
    }
  };

  // Group by kind
  const grouped = STORY_KINDS.reduce<Record<StoryKind, StoryBlock[]>>(
    (acc, k) => {
      acc[k] = blocks.filter((b) => b.kind === k);
      return acc;
    },
    {} as Record<StoryKind, StoryBlock[]>,
  );

  const hasBlocks = blocks.length > 0;

  return (
    <div className="animate-fade-in space-y-6">
      <div className="flex items-center justify-between px-1">
        <p className="text-xs text-muted-foreground">
          {blocks.length} entr{blocks.length !== 1 ? "ies" : "y"} — used by AI drafting
        </p>
        <Button
          size="sm"
          onClick={openAdd}
          className="bg-gm-purple700 text-white hover:bg-gm-purple700/90"
        >
          + Add story
        </Button>
      </div>

      {showForm && (
        <Card className="border-2 border-primary p-5 space-y-4">
          <h3 className="text-sm font-semibold">
            {editingId ? "Edit story" : "New story"}
          </h3>

          <div className="space-y-1.5">
            <Label htmlFor="sb-kind">Kind</Label>
            <select
              id="sb-kind"
              value={form.kind}
              onChange={(e) =>
                setForm((f) => ({ ...f, kind: e.target.value as StoryKind }))
              }
              className="flex h-10 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              {STORY_KINDS.map((k) => (
                <option key={k} value={k}>
                  {KIND_LABELS[k]}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="sb-title">Title</Label>
            <Input
              id="sb-title"
              placeholder="e.g. Youth served in 2023"
              value={form.title}
              onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="sb-content">Content</Label>
            <Textarea
              id="sb-content"
              rows={4}
              placeholder="The story, stat, or quote…"
              value={form.content}
              onChange={(e) => setForm((f) => ({ ...f, content: e.target.value }))}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="sb-tags">Tags (comma-separated)</Label>
            <Input
              id="sb-tags"
              placeholder="youth, health, outcomes"
              value={form.tags}
              onChange={(e) => setForm((f) => ({ ...f, tags: e.target.value }))}
            />
          </div>

          <div className="flex gap-2 justify-end">
            <Button variant="ghost" size="sm" onClick={closeForm}>
              Cancel
            </Button>
            <Button
              size="sm"
              disabled={saving}
              onClick={handleSave}
              className="bg-gm-purple700 text-white hover:bg-gm-purple700/90"
            >
              {saving ? "Saving…" : "Save"}
            </Button>
          </div>
        </Card>
      )}

      {!hasBlocks && !showForm && (
        <EmptyState
          icon="📚"
          title="No stories yet"
          description="Add impact stats, testimonials, program descriptions, and narratives. The AI drafting engine pulls from these when writing your applications."
        />
      )}

      {hasBlocks && (
        <div className="space-y-6">
          {STORY_KINDS.map((kind) => {
            const kindBlocks = grouped[kind];
            if (kindBlocks.length === 0) return null;
            return (
              <section key={kind}>
                <div className="mb-2 flex items-center gap-2">
                  <span className="rounded-full bg-gm-purple50 px-2.5 py-0.5 text-xs font-semibold text-gm-purple700">
                    {KIND_LABELS[kind]}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {kindBlocks.length}
                  </span>
                </div>
                <div className="space-y-3">
                  {kindBlocks.map((block) => (
                    <StoryBlockCard
                      key={block.id}
                      block={block}
                      onEdit={() => openEdit(block)}
                      onDelete={() => setConfirmDelete(block.id)}
                      confirmingDelete={confirmDelete === block.id}
                      onConfirmDelete={() => handleDelete(block.id)}
                      onCancelDelete={() => setConfirmDelete(null)}
                    />
                  ))}
                </div>
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}

function StoryBlockCard({
  block,
  onEdit,
  onDelete,
  confirmingDelete,
  onConfirmDelete,
  onCancelDelete,
}: {
  block: StoryBlock;
  onEdit: () => void;
  onDelete: () => void;
  confirmingDelete: boolean;
  onConfirmDelete: () => void;
  onCancelDelete: () => void;
}) {
  return (
    <Card className="border-2 border-transparent p-4 transition-all hover:border-gm-purple100">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="text-sm font-semibold">{block.title}</div>
          {block.content && (
            <p className="mt-1 text-xs text-muted-foreground line-clamp-3">
              {block.content}
            </p>
          )}
          {block.tags.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1">
              {block.tags.map((tag) => (
                <span
                  key={tag}
                  className="rounded-full bg-gm-purple50 px-2 py-0.5 text-xs text-gm-purple700"
                >
                  {tag}
                </span>
              ))}
            </div>
          )}
        </div>
        <div className="flex shrink-0 gap-1">
          <Button
            variant="ghost"
            size="sm"
            onClick={onEdit}
            className="h-7 px-2 text-xs"
          >
            Edit
          </Button>
          {confirmingDelete ? (
            <div className="flex items-center gap-1">
              <span className="text-xs text-destructive">Delete?</span>
              <Button
                variant="ghost"
                size="sm"
                onClick={onConfirmDelete}
                className="h-7 px-2 text-xs text-destructive hover:text-destructive"
              >
                Yes
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={onCancelDelete}
                className="h-7 px-2 text-xs"
              >
                No
              </Button>
            </div>
          ) : (
            <Button
              variant="ghost"
              size="sm"
              onClick={onDelete}
              className="h-7 px-2 text-xs text-muted-foreground hover:text-destructive"
            >
              Delete
            </Button>
          )}
        </div>
      </div>
    </Card>
  );
}
