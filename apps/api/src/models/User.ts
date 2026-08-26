import bcrypt from "bcrypt";
import { Schema, Types, model, type HydratedDocument, type Model } from "mongoose";

import { ROLES, type Role } from "@halaqat/shared";

import { orgScopedPlugin } from "./plugins/orgScoped.js";

const BCRYPT_COST = 12;

export interface UserFields {
  organizationId: Types.ObjectId;
  fullName: string;
  email?: string;
  phone?: string;
  passwordHash: string;
  role: Role;
  avatarUrl?: string;
  isActive: boolean;
  lastLoginAt?: Date;
  deletedAt: Date | null;
}

export interface UserMethods {
  comparePassword(candidate: string): Promise<boolean>;
}

type UserModel = Model<UserFields, object, UserMethods>;

const userSchema = new Schema<UserFields, UserModel, UserMethods>({
  fullName: { type: String, required: true, trim: true },
  email: { type: String, trim: true, lowercase: true },
  phone: { type: String, trim: true },
  passwordHash: { type: String, required: true, select: false },
  role: { type: String, enum: ROLES, required: true },
  avatarUrl: { type: String },
  isActive: { type: Boolean, default: true },
  lastLoginAt: { type: Date },
});

userSchema.plugin(orgScopedPlugin);

// A plain `sparse: true` compound index would still index (and collide on)
// documents missing only `phone`/`email`, since a compound sparse index only
// excludes a document when *every* indexed field is absent — organizationId
// is always present. A partial filter on the field actually existing is what
// scopes uniqueness to documents that have it.
userSchema.index(
  { organizationId: 1, email: 1 },
  { unique: true, partialFilterExpression: { email: { $type: "string" } } },
);
userSchema.index(
  { organizationId: 1, phone: 1 },
  { unique: true, partialFilterExpression: { phone: { $type: "string" } } },
);

userSchema.methods.comparePassword = function (candidate: string) {
  return bcrypt.compare(candidate, this.passwordHash);
};

export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, BCRYPT_COST);
}

export type UserDocument = HydratedDocument<UserFields, UserMethods>;

export const User = model<UserFields, UserModel>("User", userSchema);
