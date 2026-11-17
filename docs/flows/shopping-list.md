# Shopping list flow

How items get onto the shopping list, get checked off, and end up in the pantry when the trip is completed. The diagram is Steve's (issue #278); domain terms are defined in `CONTEXT.md` (Shopping List, Shopping List Item, Pantry-Gap Fill, Shopping Trip Completion).

Last verified: 2026-11-16, against 6e50725

Key code: `src/views/ShoppingList/Index.tsx`, `src/views/Recipe/Index.tsx` (Add Missing to List), `src/lib/shoppingList.ts` (`fillPantryGapFromRecipe`, `completeShoppingTrip`), `app/api/shopping-list/`.

```mermaid
flowchart TD
    %% Start
    Start([User Logs In]) --> Choice{How to add items?}

    %% Path A: From Shopping List Page
    Choice -->|Access Shopping List| ListPage[Access Shopping List Page]
    ListPage --> AddManual[Add Item:<br/>Food, Product, or Freeform]
    AddManual --> ViewList

    %% Path B: From Recipes
    Choice -->|Access Recipes| RecipePage[Access a Recipe]
    RecipePage --> AddRecipeIngredients[Add Ingredients Not in Pantry to Shopping List]
    AddRecipeIngredients --> ViewList[Access Shopping List]

    %% Active Shopping Flow
    ViewList --> MarkOff[Mark Items Off as Purchased]
    MarkOff --> FeatureFlow{Is Price/Expiration<br/>Flow Enabled?}

    %% Optional Detail Entry Flow
    FeatureFlow -->|Yes| EnterDetails[Enter Item Price + Expiration Date]
    EnterDetails --> CarryToPantry[Carry Over Data to Pantry]
    CarryToPantry --> FinishShopping

    FeatureFlow -->|No| FinishShopping

    %% Finalize Shopping
    FinishShopping[Complete Shopping List] --> LeaveItems{Leave Remaining<br/>Items in List?}

    LeaveItems -->|Yes| KeepItems[Keep Unbought Items in List]
    LeaveItems -->|No| RemoveItems[Clear Unbought Items]

    %% Completion
    KeepItems --> SaveToPantry[Move Bought Food/Product Items into Pantry]
    RemoveItems --> SaveToPantry
    SaveToPantry --> End([Done])
```
