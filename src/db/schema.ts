import { sql } from 'drizzle-orm';
import { pgTable, serial, varchar, text, integer, numeric, timestamp, jsonb, boolean, pgEnum, unique, index, uniqueIndex } from 'drizzle-orm/pg-core';
import type { Measurement } from '@/types/Food'

export const foodSourceEnum = pgEnum('food_source', ['manual', 'open_food_facts', 'usda']);
export const productSourceEnum = pgEnum('product_source', ['manual', 'open_food_facts', 'usda_branded']);
export const recipeSuggestionFrequencyEnum = pgEnum('recipe_suggestion_frequency', ['never', 'weekly', 'monthly']);
export const pantryExpirationFrequencyEnum = pgEnum('pantry_expiration_frequency', ['never', 'daily', 'weekly']);
export const accountClosureActionEnum = pgEnum('account_closure_action', ['deactivated', 'deleted']);
export const shoppingListStatusEnum = pgEnum('shopping_list_status', ['active', 'archived']);
export const shoppingListItemSourceTypeEnum = pgEnum('shopping_list_item_source_type', ['food', 'product', 'freeform']);
export const shoppingListItemStatusEnum = pgEnum('shopping_list_item_status', ['to_buy', 'bought', 'unavailable']);

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
  density: numeric('density', { precision: 10, scale: 4 }),
  saturatedFat: numeric('saturated_fat', { precision: 10, scale: 2 }),
  sugar: numeric('sugar', { precision: 10, scale: 2 }),
  sodium: numeric('sodium', { precision: 10, scale: 1 }),
  externalId: varchar('external_id', { length: 100 }),
  source: foodSourceEnum('source').notNull().default('manual'),
  dateAdded: timestamp('date_added').defaultNow(),
  dateUpdated: timestamp('date_updated'),
  dateDeleted: timestamp('date_deleted'),
});

export const products = pgTable('products', {
  id: serial('id').primaryKey(),
  name: varchar('name', { length: 255 }).notNull(),
  slug: varchar('slug', { length: 255 }).unique(),
  barcode: varchar('barcode', { length: 50 }),
  externalId: varchar('external_id', { length: 100 }),
  parentFoodId: integer('parent_food_id').references(() => foods.id, { onDelete: 'set null' }),
  calories: integer('calories').notNull(),
  protein: numeric('protein', { precision: 10, scale: 2 }).notNull().default('0'),
  carbs: numeric('carbs', { precision: 10, scale: 2 }).notNull().default('0'),
  fat: numeric('fat', { precision: 10, scale: 2 }).notNull().default('0'),
  fiber: numeric('fiber', { precision: 10, scale: 2 }).notNull().default('0'),
  servingSize: numeric('serving_size', { precision: 10, scale: 2 }).notNull().default('1'),
  servingUnit: varchar('serving_unit', { length: 50 }),
  measurements: jsonb('measurements').$type<Measurement[]>().default([]),
  density: numeric('density', { precision: 10, scale: 4 }),
  saturatedFat: numeric('saturated_fat', { precision: 10, scale: 2 }),
  sugar: numeric('sugar', { precision: 10, scale: 2 }),
  sodium: numeric('sodium', { precision: 10, scale: 1 }),
  source: productSourceEnum('source').notNull().default('manual'),
  dateAdded: timestamp('date_added').defaultNow(),
  dateUpdated: timestamp('date_updated'),
  dateDeleted: timestamp('date_deleted'),
});

export const recipes = pgTable('recipes', {
  id: serial('id').primaryKey(),
  name: varchar('name', { length: 255 }).notNull(),
  shortId: varchar('short_id', { length: 8 }).notNull().unique(),
  slug: varchar('slug', { length: 255 }),
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
  viewCount: integer('view_count').notNull().default(0),
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
  // When off, the shopping list stops prompting for (and hides manual entry of) Line Price & expiration.
  enableShoppingListPricingCollection: boolean('enable_shopping_list_pricing_collection').notNull().default(true),
  dateAdded: timestamp('date_added').defaultNow(),
  dateDeleted: timestamp('date_deleted'),
  deactivationWarningEmailSentAt: timestamp('deactivation_warning_email_sent_at'),
});

export const pantryItems = pgTable('pantry_items', {
  id: serial('id').primaryKey(),
  userId: integer('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  sourceType: varchar('source_type', { length: 20 }).notNull().default('food'),
  foodId: integer('food_id')
    .references(() => foods.id, { onDelete: 'cascade' }),
  productId: integer('product_id')
    .references(() => products.id, { onDelete: 'cascade' }),
  recipeId: integer('recipe_id')
    .references(() => recipes.id, { onDelete: 'set null' }),
  recipeNameSnapshot: varchar('recipe_name_snapshot', { length: 255 }),
  expirationDate: timestamp('expiration_date'),
  originalSizeAmount: numeric('original_size_amount', { precision: 10, scale: 2 }).notNull(),
  originalSizeUnit: varchar('original_size_unit', { length: 50 }),
  currentSizeAmount: numeric('current_size_amount', { precision: 10, scale: 2 }).notNull(),
  currentSizeUnit: varchar('current_size_unit', { length: 50 }),
  addedDate: timestamp('added_date').defaultNow().notNull(),
  frozenDate: timestamp('frozen_date'),
  dateDeleted: timestamp('date_deleted'),
});

export const shoppingLists = pgTable('shopping_lists', {
  id: serial('id').primaryKey(),
  userId: integer('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  status: shoppingListStatusEnum('status').notNull().default('active'),
  dateAdded: timestamp('date_added').defaultNow().notNull(),
}, (t) => ({
  activeListPerUserUnique: uniqueIndex('shopping_lists_user_active_unique').on(t.userId).where(sql`${t.status} = 'active'`),
}));

export const shoppingListItems = pgTable('shopping_list_items', {
  id: serial('id').primaryKey(),
  shoppingListId: integer('shopping_list_id')
    .notNull()
    .references(() => shoppingLists.id, { onDelete: 'cascade' }),
  sourceType: shoppingListItemSourceTypeEnum('source_type').notNull().default('food'),
  // A line links to at most one of food/product; a freeform line links to neither and carries its
  // own `name`. Which column is populated is governed by `sourceType`.
  foodId: integer('food_id')
    .references(() => foods.id, { onDelete: 'cascade' }),
  productId: integer('product_id')
    .references(() => products.id, { onDelete: 'cascade' }),
  name: varchar('name', { length: 255 }),
  amount: numeric('amount', { precision: 10, scale: 2 }).notNull(),
  // Null for freeform lines that omit a unit; always set for food/product lines.
  unit: varchar('unit', { length: 50 }),
  status: shoppingListItemStatusEnum('status').notNull().default('to_buy'),
  // Total paid for the whole line (not per-unit), in the app's single currency. Optionally recorded
  // at check-off; per-unit cost is derived as line_price / amount when needed. Null until entered.
  linePrice: numeric('line_price', { precision: 10, scale: 2 }),
  // Optionally recorded at check-off; transfers to the resulting Pantry Item's expirationDate on Trip
  // Completion. Null when the user leaves it blank.
  expirationDate: timestamp('expiration_date'),
  dateAdded: timestamp('date_added').defaultNow().notNull(),
}, (t) => ({
  shoppingListIdIdx: index('shopping_list_items_shopping_list_id_idx').on(t.shoppingListId),
}));

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
  userId: integer('user_id').notNull(),
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

export const reviewReportReasonEnum = pgEnum('review_report_reason', ['spam', 'offensive_language', 'harassment', 'off_topic']);

export const reviews = pgTable('reviews', {
  id: serial('id').primaryKey(),
  userId: integer('user_id')
    .references(() => users.id, { onDelete: 'set null' }),
  recipeId: integer('recipe_id')
    .notNull()
    .references(() => recipes.id, { onDelete: 'cascade' }),
  rating: integer('rating').notNull(),
  body: text('body'),
  dateAdded: timestamp('date_added').defaultNow().notNull(),
  dateUpdated: timestamp('date_updated'),
}, (t) => ({
  userRecipeUnique: unique('reviews_user_recipe_unique').on(t.userId, t.recipeId),
  recipeIdIdx: index('reviews_recipe_id_idx').on(t.recipeId),
}));

export const reviewLikes = pgTable('review_likes', {
  id: serial('id').primaryKey(),
  userId: integer('user_id')
    .references(() => users.id, { onDelete: 'set null' }),
  reviewId: integer('review_id')
    .notNull()
    .references(() => reviews.id, { onDelete: 'cascade' }),
  dateAdded: timestamp('date_added').defaultNow().notNull(),
}, (t) => ({
  userReviewUnique: unique('review_likes_user_review_unique').on(t.userId, t.reviewId),
  reviewIdIdx: index('review_likes_review_id_idx').on(t.reviewId),
}));

export const reviewReports = pgTable('review_reports', {
  id: serial('id').primaryKey(),
  userId: integer('user_id')
    .references(() => users.id, { onDelete: 'set null' }),
  reviewId: integer('review_id')
    .notNull()
    .references(() => reviews.id, { onDelete: 'cascade' }),
  reason: reviewReportReasonEnum('reason').notNull(),
  comment: text('comment'),
  dateAdded: timestamp('date_added').defaultNow().notNull(),
}, (t) => ({
  userReviewUnique: unique('review_reports_user_review_unique').on(t.userId, t.reviewId),
  reviewIdIdx: index('review_reports_review_id_idx').on(t.reviewId),
  dateAddedIdx: index('review_reports_date_added_idx').on(t.dateAdded),
}));
