# Recipe builder flow

How a signed-in user creates a recipe: from the Recipes page through "Add New", the three creation methods (guided entry, website import, Markdown editor), the shared Importer window, saving, and visibility. Diagram by Steve; it is the intended flow, and the PR that added it lists where the code currently differs.

Last verified: 2026-11-16, against commit 6e50725

Key files: `src/views/Recipes/Index.tsx` (Add New), `src/views/Recipe/Store.tsx` (guided entry and mode switch), `src/views/Recipe/RecipeImporter.tsx` (website import), `src/views/Recipe/MarkdownImport.tsx` (Markdown editor), `src/views/Recipe/RecipeImportPreview.tsx` (Importer window), `src/views/Recipe/Index.tsx` (publish and visibility).

```mermaid
flowchart TD
    Start([User Logs In]) --> Access[Access Recipes Page]
    Access --> AddNew[Click Add New]
    AddNew --> Method{Choose Creation Method}

    %% Manual Path
    Method -->|Manual Entry| Guided[Start Guided Process]
    Guided --> Header[Add Recipe Header Data]
    Header --> Ingredients[Add Ingredients & Measurements]
    Ingredients --> Save

    %% Import Path
    Method -->|Website Import| ImportWeb[Import Recipe from Website]
    ImportWeb --> Importer

    %% Markdown Path
    Method -->|Markdown Editor| MarkdownEd[Use Advanced Markdown Editor]
    MarkdownEd --> Importer

    %% Shared Importer & Main Flow
    Importer[Importer Window:<br/>Link ingredients with EatForkful food records] --> Save[Save Recipe]
    Save --> Created[Recipe Created]
    Created --> Publish{Publish Recipe?}

    %% Visibility Path
    Publish -->|Yes - Public| Public[Set Visibility to Public]
    Publish -->|No - Private| Private[Keep Visibility Private]

    Public --> End([Done])
    Private --> End
```
