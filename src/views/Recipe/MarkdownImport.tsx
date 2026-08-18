'use client'

import { useState, useCallback } from 'react'
import dynamic from 'next/dynamic'
import { recipeLanguage } from '@/utils/recipeLanguage'
import { parseRecipeMarkdown } from '@/utils/recipeMarkdownParser'
import RecipeImportPreview from './RecipeImportPreview'
import type { ParsedRecipe } from '@/utils/recipeMarkdownParser'

const CodeMirror = dynamic(() => import('@uiw/react-codemirror'), { ssr: false })

const TEMPLATE = `# My Recipe
meal: Dinner
serves: 4
prepTime: 15
cookTime: 30

## Description
A brief description of your recipe.

## Ingredients
- 500g chicken breast
- 2 cup rice
- 1 tsp salt

## Steps
1. Prepare the ingredients.
2. Cook according to your method.
3. Serve and enjoy.
`

export default function MarkdownImport() {
  const [markdown, setMarkdown] = useState(TEMPLATE)
  const [parsed, setParsed] = useState<ParsedRecipe | null>(null)

  const extensions = [recipeLanguage]

  const handleParseAndPreview = useCallback(() => {
    setParsed(parseRecipeMarkdown(markdown))
  }, [markdown])

  if (parsed) {
    return <RecipeImportPreview parsed={parsed} onBack={() => setParsed(null)} backLabel="← Edit Markdown" />
  }

  return (
    <div className="markdown-import">
      <div className="mi-editor-wrap">
        <CodeMirror
          value={markdown}
          onChange={setMarkdown}
          extensions={extensions}
          theme="dark"
          height="420px"
          placeholder={TEMPLATE}
          basicSetup={{ lineNumbers: false, foldGutter: false, highlightActiveLine: true }}
        />
      </div>
      <div className="mi-format-ref">
        <span className="mi-format-ref-title">Format reference</span>
        <dl className="mi-format-grid">
          <dt># Title</dt>          <dd>Recipe name</dd>
          <dt>meal: Dinner</dt>     <dd>Breakfast · Lunch · Dinner · Snack · Dessert</dd>
          <dt>serves: 4</dt>        <dd>Number of servings</dd>
          <dt>prepTime: 15</dt>     <dd>Prep time in minutes</dd>
          <dt>cookTime: 30</dt>     <dd>Cook time in minutes</dd>
          <dt>## Ingredients</dt>   <dd>One ingredient per line, starting with <code>-</code></dd>
          <dt>- 500g chicken</dt>   <dd>Quantity + unit attached <em>or</em> separated: <code>2 cup rice</code></dd>
          <dt>## Steps</dt>         <dd>Numbered list: <code>1. Do this.</code></dd>
        </dl>
      </div>
      <div className="mi-editor-footer">
        <button
          type="button"
          className="primary-button"
          onClick={handleParseAndPreview}
          disabled={!markdown.trim()}
        >
          Parse & Preview
        </button>
      </div>
    </div>
  )
}
