# Food log flow

How a User logs a Food they ate and how the Daily Log for a day is read back. Covers `food_log_entries`. Decision record: ADR-0025 (the log is a decoupled nutrition ledger with frozen macros and a client-derived local day). Terms (Food Log Entry, Daily Log, Log Date, Meal Slot) are in `CONTEXT.md`.

Last verified: 2026-11-25, against 524861d

Key code: `src/views/Log/Index.tsx`, `src/views/Log/LogFoodDialog.tsx`, `src/lib/api/foodLog.ts`, `app/api/log/route.ts`, `src/lib/foodLog.ts` (`createFoodLogEntry`, `computeFrozenMacros`, `getDailyLog`), `src/utils/foodNutrition.ts` (`macrosFor`, `unitResolvesForFood`), `src/utils/mealSlots.ts` (`groupEntriesBySlot`).

```mermaid
flowchart TD
    Open(["User opens /log"]) --> Page["Server page loads the User's Meal Slots<br/>(defaults for a signed-out visitor)"]
    Page --> SignedIn{"Signed in?"}
    SignedIn -->|"No"| Prompt["View shows a sign-in prompt"]
    SignedIn -->|"Yes"| Today["Client computes today's local date<br/>YYYY-MM-DD (never UTC)"]
    Today --> Read["GET /api/log?date=YYYY-MM-DD"]
    Read --> DateOk{"Real calendar date?"}
    DateOk -->|"No"| R400a["400 A valid date is required"]
    DateOk -->|"Yes"| Daily["getDailyLog(userId, date)"]
    Daily --> Query["Entries for that user and log_date<br/>where date_deleted is null,<br/>oldest first, left join foods"]
    Query --> Orphan{"Food row missing or soft-deleted?"}
    Orphan -->|"Yes"| NoFood["Entry returned with food null,<br/>still counted from its frozen macros"]
    Orphan -->|"No"| WithFood["Entry returned with its Food"]
    NoFood --> Total
    WithFood --> Total["total = sum of the entries' frozen macros<br/>(no daily_logs table)"]
    Total --> Group["Client groups entries by Meal Slot:<br/>one section per slot, then Other<br/>(unknown label) and Unsorted (no slot)"]

    Group --> Add["User picks a Food, amount, unit and optional slot<br/>in LogFoodDialog"]
    Add --> Warn{"Unit resolves to the Food's serving?"}
    Warn -->|"No"| Notice["Dialog warns that calories cannot be calculated;<br/>logging is still allowed"]
    Warn -->|"Yes"| Submit
    Notice --> Submit["POST /api/log<br/>foodId, amount, unit, logDate, mealSlot"]
    Submit --> Auth{"Signed in?"}
    Auth -->|"No"| R401["401 Unauthorized"]
    Auth -->|"Yes"| Valid{"foodId positive integer, amount above 0,<br/>unit non-empty, logDate real date,<br/>mealSlot null or 1 to 50 chars?"}
    Valid -->|"No"| R400b["400 with the field message"]
    Valid -->|"Yes"| Create["createFoodLogEntry (inside taskRunner)"]
    Create --> FoodRow{"Food exists and is not soft-deleted?"}
    FoodRow -->|"No"| R404["404 Food not found"]
    FoodRow -->|"Yes"| UnitOk{"Unit is one the Food offers?"}
    UnitOk -->|"No"| R400c["400 unit is not one of the food's measurements"]
    UnitOk -->|"Yes"| Freeze["computeFrozenMacros: scale the Food's<br/>calories, protein, carbs, fat, fiber, rounded to 2 places<br/>(all zero when the unit cannot resolve)"]
    Freeze --> Insert["Insert food_log_entries:<br/>source_type food, food_id, amount, unit,<br/>frozen macros, log_date, meal_slot snapshot"]
    Insert --> InsertOk{"Insert succeeded?"}
    InsertOk -->|"user_id FK error 23503"| R401b["401 session out of date"]
    InsertOk -->|"Other error"| R500["500 generic message, logged to Sentry"]
    InsertOk -->|"Yes"| R201["201 entry shown in its slot"]
    R201 --> Read
```

## Notes

- The macros are frozen when the entry is created and never recomputed on read, so editing a Food later does not change past totals (ADR-0025, Decision 2).
- The table has columns for `source_type` (`food`, `product`, `prepared_meal`) and `date_deleted`, but the code today only writes `source_type = food`, and there is no route to edit or delete an entry: `app/api/log/route.ts` has only `GET` and `POST`. ADR-0025's optional pantry link and stock deduction are not in the schema or the code yet. This diagram shows what runs today.
- `food_id` is `ON DELETE SET NULL` and the entry survives on its frozen macros; `user_id` cascades, so deleting an account removes its log.
- `meal_slot` is a text snapshot, not a foreign key: renaming or removing a slot in the profile never rewrites past entries, which then show under Other.
