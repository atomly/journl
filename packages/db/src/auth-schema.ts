import { pgTable } from "drizzle-orm/pg-core";

export const user = pgTable("user", (t) => ({
	createdAt: t.timestamp().notNull(),
	email: t.text().notNull().unique(),
	emailVerified: t.boolean().notNull(),
	id: t.text().primaryKey(),
	image: t.text(),
	name: t.text().notNull(),
	updatedAt: t.timestamp().notNull(),
}));

export const session = pgTable("session", (t) => ({
	createdAt: t.timestamp().notNull(),
	expiresAt: t.timestamp().notNull(),
	id: t.text().primaryKey(),
	ipAddress: t.text(),
	token: t.text().notNull().unique(),
	updatedAt: t.timestamp().notNull(),
	userAgent: t.text(),
	userId: t
		.text()
		.notNull()
		.references(() => user.id, { onDelete: "cascade" }),
}));

export const account = pgTable("account", (t) => ({
	accessToken: t.text(),
	accessTokenExpiresAt: t.timestamp(),
	accountId: t.text().notNull(),
	createdAt: t.timestamp().notNull(),
	id: t.text().primaryKey(),
	idToken: t.text(),
	password: t.text(),
	providerId: t.text().notNull(),
	refreshToken: t.text(),
	refreshTokenExpiresAt: t.timestamp(),
	scope: t.text(),
	updatedAt: t.timestamp().notNull(),
	userId: t
		.text()
		.notNull()
		.references(() => user.id, { onDelete: "cascade" }),
}));

export const verification = pgTable("verification", (t) => ({
	createdAt: t.timestamp(),
	expiresAt: t.timestamp().notNull(),
	id: t.text().primaryKey(),
	identifier: t.text().notNull(),
	updatedAt: t.timestamp(),
	value: t.text().notNull(),
}));
