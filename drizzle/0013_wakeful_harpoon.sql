CREATE INDEX "recipe_steps_recipe_id_deleted_position_idx" ON "recipe_steps" USING btree ("recipe_id","date_deleted","position");
