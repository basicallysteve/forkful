import { pgTable, serial, varchar, text, integer, timestamp } from 'drizzle-orm/pg-core';

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
  foodName: varchar('food_name', { length: 255 }).notNull(),
  quantity: integer('quantity').notNull(),
  calories: integer('calories').notNull(),
});


export const foods = pgTable('foods', {
  id: serial('id').primaryKey(),
  name: varchar('name', { length: 255 }).notNull(),
  calories: integer('calories').notNull(),
  servingUnit: varchar('serving_unit', { length: 50 }),
});