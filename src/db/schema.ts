import { pgTable, serial, varchar, text, integer, numeric, timestamp, jsonb, boolean, pgEnum, unique, index } from 'drizzle-orm/pg-core';
import type { Measurement } from '@/types/Food'

export const foodSourceEnum = pgEnum('food_source', ['manual', 'open_food_facts']);
export const recipeSuggestionFrequencyEnum = pgEnum('recipe_suggestion_frequency', ['never', 'weekly', 'monthly']);
export const pantryExpirationFrequencyEnum = pgEnum('pantry_expiration_frequency', ['never', 'daily', 'weekly']);
export const accountClosureActionEnum = pgEnum('account_closure_action', ['deactivated', 'deleted']);

export const foods = pgTable('foods', {
  id: serial('id').primaryKey(),
  name: varchar('name', { length: 255 }).notNull(),
  slug: varchar('slug', { length: 255 }).unique(),
  calories: integer('calories').notNull(),
  protein: numeric('protein', { precision: 10, scale: 2 }).notNull().default('0'),
  carbs: numeric('carbs', { precision: 10, scale: 2 }).notNull().default('0'),
  fat: numeric('fat', { precision: 10, scale: 2 }).notNull().default('0'),
  fiber: numeric('fiber', { precision: 10, scale: 2 }).notNull().default('0'),
  servingSize: numeric('serving_size', { precision: 10, scale: 2 }).notNull().default('1'),
  servingUnit: varchar('serving_unit', { length: 50 }),
  measurements: jsonb('measurements').$type<Measurement[]>().default([]),
  saturatedFat: numeric('saturated_fat', { precision: 10, scale: 2 }),
  sugar: numeric('sugar', { precision: 10, scale: 2 }),
  sodium: numeric('sodium', { precision: 10, scale: 1 }),
  barcode: varchar('barcode', { length: 50 }),
  source: foodSourceEnum('source').notNull().default('manual'),
  dateAdded: timestamp('date_added').defaultNow(),
  dateUpdated: timestamp('date_updated'),
  dateDeleted: timestamp('date_deleted'),
});

export const recipes = pgTable('recipes', {
  id: serial('id').primaryKey(),
  name: varchar('name', { length: 255 }).notNull(),
  slug: varchar('slug', { length: 255 }).unique(),
  meal: varchar('meal', { length: 50 }),
  description: text('description'),
  prepTime: integer('prep_time'),
  cookTime: integer('cook_time'),
  totalTime: integer('total_time'),
  cuisineType: varchar('cuisine_type', { length: 100 }),
  dietaryTags: jsonb('dietary_tags').$type<string[]>().default([]),
  isPublic: integer('is_public').notNull().default(0),
  serves: integer('serves'),
  nutritionComplete: boolean('nutrition_complete').notNull().default(true),
  userId: integer('user_id').references(() => users.id, { onDelete: 'set null' }),
  dateAdded: timestamp('date_added').defaultNow(),
  datePublished: timestamp('date_published'),
  dateDeleted: timestamp('date_deleted'),
});

export const ingredients = pgTable('ingredients', {
  id: serial('id').primaryKey(),
  recipeId: integer('recipe_id')
    .notNull()
    .references(() => recipes.id, { onDelete: 'cascade' }),
  foodId: integer('food_id')
    .notNull()
    .references(() => foods.id, { onDelete: 'cascade' }),
  quantity: numeric('quantity', { precision: 10, scale: 2 }).notNull(),
  servingUnit: varchar('serving_unit', { length: 50 }),
  dateAdded: timestamp('date_added').defaultNow(),
  dateUpdated: timestamp('date_updated'),
  dateDeleted: timestamp('date_deleted'),
});

export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  username: varchar('username', { length: 255 }).notNull().unique(),
  password: varchar('password', { length: 255 }),
  email: varchar('email', { length: 255 }).notNull().unique(),
  cuisinePreferences: jsonb('cuisine_preferences').$type<string[]>().default([]),
  dietaryRestrictions: jsonb('dietary_restrictions').$type<string[]>().default([]),
  avatarUrl: varchar('avatar_url', { length: 500 }),
  onboardingCompletedAt: timestamp('onboarding_completed_at'),
  passwordChangedAt: timestamp('password_changed_at'),
  marketingEmailOptIn: boolean('marketing_email_opt_in').notNull().default(false),
  recipeSuggestionFrequency: recipeSuggestionFrequencyEnum('recipe_suggestion_frequency').notNull().default('weekly'),
  pantryExpirationFrequency: pantryExpirationFrequencyEnum('pantry_expiration_frequency').notNull().default('weekly'),
  dateAdded: timestamp('date_added').defaultNow(),
  dateDeleted: timestamp('date_deleted'),
});

export const pantryItems = pgTable('pantry_items', {
  id: serial('id').primaryKey(),
  userId: integer('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  foodId: integer('food_id')
    .notNull()
    .references(() => foods.id, { onDelete: 'cascade' }),
  expirationDate: timestamp('expiration_date'),
  originalSizeAmount: numeric('original_size_amount', { precision: 10, scale: 2 }).notNull(),
  originalSizeUnit: varchar('original_size_unit', { length: 50 }),
  currentSizeAmount: numeric('current_size_amount', { precision: 10, scale: 2 }).notNull(),
  currentSizeUnit: varchar('current_size_unit', { length: 50 }),
  addedDate: timestamp('added_date').defaultNow().notNull(),
  frozenDate: timestamp('frozen_date'),
  dateDeleted: timestamp('date_deleted'),
});

export const oauthAccounts = pgTable('oauth_accounts', {
  id: serial('id').primaryKey(),
  userId: integer('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  provider: varchar('provider', { length: 50 }).notNull(),
  providerAccountId: varchar('provider_account_id', { length: 255 }).notNull(),
  dateAdded: timestamp('date_added').defaultNow().notNull(),
}, (t) => ({
  providerAccountUnique: unique('oauth_accounts_provider_account_unique').on(t.provider, t.providerAccountId),
}));

export const passwordResetTokens = pgTable('password_reset_tokens', {
  id: serial('id').primaryKey(),
  userId: integer('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  tokenHash: varchar('token_hash', { length: 64 }).notNull(),
  expiresAt: timestamp('expires_at').notNull(),
  usedAt: timestamp('used_at'),
  dateAdded: timestamp('date_added').defaultNow().notNull(),
}, (t) => ({
  tokenHashUnique: unique('password_reset_tokens_token_hash_unique').on(t.tokenHash),
}));

export const login_attempts = pgTable('login_attempts', {
  id: serial('id').primaryKey(),
  userId: integer('user_id')
    .references(() => users.id, { onDelete: 'cascade' }),
  ipAddress: varchar('ip_address', { length: 45 }).notNull(),
  successful: integer('successful').notNull().default(0), // 0 = false, 1 = true
  dateAdded: timestamp('date_added').defaultNow().notNull(),
});

export const recipeSteps = pgTable('recipe_steps', {
  id: serial('id').primaryKey(),
  recipeId: integer('recipe_id')
    .notNull()
    .references(() => recipes.id, { onDelete: 'cascade' }),
  position: integer('position').notNull(),
  title: varchar('title', { length: 255 }),
  content: text('content').notNull().default(''),
  dateAdded: timestamp('date_added').defaultNow(),
  dateDeleted: timestamp('date_deleted'),
}, (t) => ({
  recipeStepsLookupIdx: index('recipe_steps_recipe_id_deleted_position_idx').on(t.recipeId, t.dateDeleted, t.position),
}));

export const accountFeedback = pgTable('account_feedback', {
  id: serial('id').primaryKey(),
  userId: integer('user_id'),
  action: accountClosureActionEnum('action').notNull(),
  reasons: jsonb('reasons').$type<string[]>().notNull().default([]),
  comment: text('comment'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const savedRecipes = pgTable('saved_recipes', {
  id: serial('id').primaryKey(),
  userId: integer('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  recipeId: integer('recipe_id')
    .notNull()
    .references(() => recipes.id, { onDelete: 'cascade' }),
  dateSaved: timestamp('date_saved').defaultNow().notNull(),
  dateDeleted: timestamp('date_deleted'),
}, (t) => ({
  userRecipeUnique: unique('saved_recipes_user_recipe_unique').on(t.userId, t.recipeId),
}));
