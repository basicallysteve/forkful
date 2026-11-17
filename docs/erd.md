# Database ERD

An entity relationship diagram of the EatForkful database: entity names, keys and relationships, not every column. The source of truth for the actual tables is `src/db/schema.ts`.

The diagram is Steve's (2026-11-17) and may describe the **intended** model, not only today's tables. It currently differs from the schema in several places; those differences are listed in the pull request that added this file (#279) and are waiting on Steve's decision, so the diagram has not been changed to match the schema.

A PR that changes `src/db/schema.ts` must update this file or say why not.

Last verified: 2026-11-16, against migration `0035_goofy_forgotten_one.sql` (main at `6e50725`). Verified means the differences were listed, not that the diagram matches the schema.

```mermaid
erDiagram
    %% Core Entities
    FOOD {
        int id PK
        string name
        string category
    }

    PRODUCT {
        int id PK
        int food_id FK
        string brand_name
        string UPC
    }

    USER {
        int id PK
        int family_id FK "Nullable"
        string username
        string email
    }

    FAMILY {
        int id PK
        string name
    }

    RECIPE {
        int id PK
        int user_id FK
        string title
        text description
        boolean is_public
    }

    INGREDIENT {
        int id PK
        int recipe_id FK
        int food_id FK "Nullable if linked to Product"
        int product_id FK "Nullable if linked to Food"
        string measurement
        float quantity
    }

    RECIPE_STEP {
        int id PK
        int recipe_id FK
        int step_number
        text instructions
    }

    RECIPE_REVIEW {
        int id PK
        int recipe_id FK
        int user_id FK
        int rating
        text comment
    }

    REVIEW_LIKE {
        int user_id PK, FK
        int review_id PK, FK
        datetime created_at
    }

    REVIEW_REPORT {
        int id PK
        int review_id FK
        int user_id FK "User who reported"
        string reason
        string status "e.g., pending, resolved"
        datetime created_at
    }

    SAVED_RECIPE {
        int user_id PK, FK
        int recipe_id PK, FK
    }

    SHOPPING_LIST {
        int id PK
        int user_id FK
        string name
        boolean is_active
    }

    SHOPPING_LIST_ITEM {
        int id PK
        int shopping_list_id FK
        int food_id FK "Nullable"
        int product_id FK "Nullable"
        string freeform_text "Nullable"
        boolean is_bought
        float price
        date expiration_date
    }

    PANTRY {
        int id PK
        int family_id FK "Nullable"
        int owner_user_id FK "Nullable if family owned"
        string name
    }

    PANTRY_ITEM {
        int id PK
        int pantry_id FK
        int food_id FK "Nullable"
        int product_id FK "Nullable"
        int recipe_id FK "Nullable"
        int origin_shopping_list_item_id FK "Nullable"
        float price
        date expiration_date
    }

    FOOD_LOG {
        int id PK
        int user_id FK
        datetime logged_at
        int food_id FK "Nullable"
        int product_id FK "Nullable"
        int pantry_item_id FK "Nullable"
        float serving_size
    }

    %% Relationships
    FOOD ||--o{ PRODUCT : "parent of many"
    FAMILY ||--o{ USER : "has many members"
    
    USER ||--o{ RECIPE : "creates"
    RECIPE ||--o{ INGREDIENT : "has many"
    
    %% Ingredient polymorphic link logic via Foreign Keys
    FOOD ||--o{ INGREDIENT : "types"
    PRODUCT ||--o{ INGREDIENT : "types"

    RECIPE ||--o{ RECIPE_STEP : "has many"
    RECIPE ||--o{ RECIPE_REVIEW : "has 0 or many"
    USER ||--o{ RECIPE_REVIEW : "writes"

    RECIPE_REVIEW ||--o{ REVIEW_LIKE : "has 0 or many"
    USER ||--o{ REVIEW_LIKE : "gives"

    RECIPE_REVIEW ||--o{ REVIEW_REPORT : "has 0 or many"
    USER ||--o{ REVIEW_REPORT : "submits"
    
    USER ||--o{ SAVED_RECIPE : "saves"
    RECIPE ||--o{ SAVED_RECIPE : "saved by (if public)"

    USER ||--o{ SHOPPING_LIST : "has"
    SHOPPING_LIST ||--o{ SHOPPING_LIST_ITEM : "contains"
    
    FOOD ||--o{ SHOPPING_LIST_ITEM : "references"
    PRODUCT ||--o{ SHOPPING_LIST_ITEM : "references"

    %% Pantry & Family Sharing Architecture
    FAMILY ||--o{ PANTRY : "shares"
    USER ||--o{ PANTRY : "owns personal"
    PANTRY ||--o{ PANTRY_ITEM : "contains"
    
    FOOD ||--o{ PANTRY_ITEM : "can be"
    PRODUCT ||--o{ PANTRY_ITEM : "can be"
    RECIPE ||--o{ PANTRY_ITEM : "can be prepared recipe"
    SHOPPING_LIST_ITEM ||--o| PANTRY_ITEM : "optionally originates from"

    USER ||--o{ FOOD_LOG : "logs"
    FOOD ||--o{ FOOD_LOG : "eats"
    PRODUCT ||--o{ FOOD_LOG : "eats"
    PANTRY_ITEM ||--o{ FOOD_LOG : "consumes from pantry"
```
