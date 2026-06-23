import { StreamLanguage } from '@codemirror/language'
import type { StreamParser, StringStream } from '@codemirror/language'
import { MASS_UNITS, VOLUME_UNITS } from '@/utils/unitConversion'

const KNOWN_UNITS = new Set([...MASS_UNITS, ...VOLUME_UNITS].map(u => u.toLowerCase()))
const METADATA_KEYS = new Set(['meal', 'serves', 'preptime', 'cooktime', 'totaltime'])

type Section = 'pre-title' | 'metadata' | 'description' | 'ingredients' | 'steps' | 'other'
type IngredientPos = 'bullet' | 'qty' | 'unit' | 'name'

interface RecipeState {
  section: Section
  ingPos: IngredientPos
}

const recipeStreamParser: StreamParser<RecipeState> = {
  startState: () => ({ section: 'pre-title', ingPos: 'bullet' }),

  token(stream: StringStream, state: RecipeState): string | null {
    // Reset ingredient position at start of each line
    if (stream.sol()) {
      state.ingPos = 'bullet'
    }

    // Skip whitespace — return null so CodeMirror knows there's no token
    if (stream.eatSpace()) return null

    const { section } = state

    // Title line: # Recipe Name
    if (section === 'pre-title') {
      if (stream.match(/^#\s+/)) {
        stream.skipToEnd()
        state.section = 'metadata'
        return 'header'
      }
      stream.next()
      return null
    }

    // Section headings: ## Ingredients, ## Steps, etc.
    if (stream.match(/^##\s+/)) {
      const rest = stream.match(/^(.+)$/) as RegExpMatchArray | null
      if (rest) {
        const heading = rest[0].trim().toLowerCase()
        if (heading === 'ingredients') state.section = 'ingredients'
        else if (heading === 'steps') state.section = 'steps'
        else if (heading === 'description') state.section = 'description'
        else state.section = 'other'
      }
      return 'header'
    }

    // Metadata section: key: value
    if (section === 'metadata') {
      const keyMatch = stream.match(/^([a-zA-Z]+)\s*:/) as RegExpMatchArray | null
      if (keyMatch) {
        const key = keyMatch[1].toLowerCase()
        return METADATA_KEYS.has(key) ? 'keyword' : 'meta'
      }
      stream.skipToEnd()
      return 'string'
    }

    // Description: plain text
    if (section === 'description') {
      stream.skipToEnd()
      return 'string'
    }

    // Ingredients section: - <qty> <unit> <food name>
    if (section === 'ingredients') {
      const pos = state.ingPos

      if (pos === 'bullet') {
        if (stream.match(/^-\s*/)) {
          state.ingPos = 'qty'
          return 'operator'
        }
        stream.skipToEnd()
        return null
      }

      if (pos === 'qty') {
        // Match a number (quantity)
        if (stream.match(/^\d+(?:[.,]\d+)?/)) {
          state.ingPos = 'unit'
          return 'number'
        }
        // Not a valid number — mark as error and advance to unit pos
        if (stream.match(/^\S+/)) {
          state.ingPos = 'unit'
          return 'error'
        }
        stream.next()
        return null
      }

      if (pos === 'unit') {
        const unitMatch = stream.match(/^([a-zA-Z][a-zA-Z-]*)/) as RegExpMatchArray | null
        if (unitMatch) {
          const unit = unitMatch[1].toLowerCase()
          state.ingPos = 'name'
          return KNOWN_UNITS.has(unit) ? 'keyword' : 'error'
        }
        state.ingPos = 'name'
        stream.next()
        return null
      }

      if (pos === 'name') {
        stream.skipToEnd()
        return 'variable'
      }
    }

    // Steps section: 1. Step text
    if (section === 'steps') {
      if (stream.match(/^\d+\.\s*/)) return 'number'
      stream.skipToEnd()
      return 'string'
    }

    stream.next()
    return null
  },
}

export const recipeLanguage = StreamLanguage.define(recipeStreamParser)
