import { Schema } from "mongoose";

/**
 * Adds `organizationId` (required, indexed), `deletedAt` (soft delete), and
 * timestamps to a schema. Every model except Organization itself uses this —
 * see SPEC.md §4: "All models get { timestamps: true }, a compound index on
 * organizationId, and soft-delete via deletedAt: Date | null."
 */
export function orgScopedPlugin(schema: Schema) {
  schema.add({
    organizationId: {
      type: Schema.Types.ObjectId,
      ref: "Organization",
      required: true,
    },
    deletedAt: {
      type: Date,
      default: null,
    },
  });

  schema.set("timestamps", true);
  schema.index({ organizationId: 1, deletedAt: 1 });
}
