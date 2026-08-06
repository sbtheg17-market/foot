import {
  integer,
  pgEnum,
  pgTable,
  serial,
  timestamp,
  index,
  unique,
} from "drizzle-orm/pg-core";
import { usersTable } from "./users";

/**
 * Transitional multi-role membership table.
 *
 * `users.role` remains the compatibility field until a separately approved
 * cleanup checkpoint. Membership rows are not authorization by themselves;
 * provider operations will later also require an approved application.
 */
export const accountRoleEnum = pgEnum("account_role", [
  "client",
  "provider",
  "admin",
]);

export const accountRolesTable = pgTable(
  "account_roles",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id")
      .notNull()
      .references(() => usersTable.id, { onDelete: "cascade" }),
    role: accountRoleEnum("role").notNull(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => [
    index("account_roles_user_id_idx").on(table.userId),
    index("account_roles_role_idx").on(table.role),
    unique("account_roles_user_role_unique").on(table.userId, table.role),
  ],
);

export type AccountRole = typeof accountRolesTable.$inferSelect;
export type InsertAccountRole = typeof accountRolesTable.$inferInsert;