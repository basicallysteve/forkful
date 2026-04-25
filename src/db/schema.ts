import { pgTable, serial, varchar, text, integer, numeric, timestamp, jsonb } from 'drizzle-orm/pg-core';

export const foods = pgTable('foods', {
  id: serial('id').primaryKey(),
  name: varchar('name', { length: 255 }).notNull(),
  calories: integer('calories').notNull(),
  protein: numeric('protein', { precision: 10, scale: 2 }).notNull().default('0'),
  carbs: numeric('carbs', { precision: 10, scale: 2 }).notNull().default('0'),
  fat: numeric('fat', { precision: 10, scale: 2 }).notNull().default('0'),
  fiber: numeric('fiber', { precision: 10, scale: 2 }).notNull().default('0'),
  servingSize: numeric('serving_size', { precision: 10, scale: 2 }).notNull().default('1'),
  servingUnit: varchar('serving_unit', { length: 50 }),
  measurements: jsonb('measurements').$type<string[]>().default([]),
});

export const recipes = pgTable('recipes', {
  id: serial('id').primaryKey(),
  name: varchar('name', { length: 255 }).notNull(),
  meal: varchar('meal', { length: 50 }),
  description: text('description'),
  dateAdded: timestamp('date_added').defaultNow(),
  datePublished: timestamp('date_published'),
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
});