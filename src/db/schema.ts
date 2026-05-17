import { pgTable, serial, varchar, text, integer, numeric, timestamp, jsonb, pgEnum } from 'drizzle-orm/pg-core';

export const foodSourceEnum = pgEnum('food_source', ['manual', 'open_food_facts']);

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
  measurements: jsonb('measurements').$type<string[]>().default([]),
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
  isPublic: integer('is_public').notNull().default(0),
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
  calories: integer('calories').notNull(),
  servingUnit: varchar('serving_unit', { length: 50 }),
  dateAdded: timestamp('date_added').defaultNow(),
  dateUpdated: timestamp('date_updated'),
  dateDeleted: timestamp('date_deleted'),
});

export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  username: varchar('username', { length: 255 }).notNull(),
  password: varchar('password', { length: 255, }).notNull(),
  email: varchar('email', { length: 255 }).notNull(),
  cuisinePreferences: jsonb('cuisine_preferences').$type<string[]>().default([]),
  dietaryRestrictions: jsonb('dietary_restrictions').$type<string[]>().default([]),
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

export const login_attempts = pgTable('login_attempts', {
  id: serial('id').primaryKey(),
  userId: integer('user_id')
    .references(() => users.id, { onDelete: 'cascade' }),
  ipAddress: varchar('ip_address', { length: 45 }).notNull(),
  successful: integer('successful').notNull().default(0), // 0 = false, 1 = true
  dateAdded: timestamp('date_added').defaultNow().notNull(),
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
});
