import { describe, it, expect, vi } from 'vitest'
import { render } from '@testing-library/react'
import type { MenuItem } from 'primereact/menuitem'
import ToolBar from './ToolBar'

let model: MenuItem[] = []

vi.mock('primereact/megamenu', () => ({
  MegaMenu: (props: { model: MenuItem[] }) => {
    model = props.model
    return <div />
  },
}))
vi.mock('./ThemeToggle', () => ({ default: () => <div /> }))
vi.mock('./ThemedLogo', () => ({ default: () => <div /> }))

describe('ToolBar — MegaMenu model urls', () => {
  it('sets url on leaves (for Ctrl/Cmd-click) but not on parent triggers', () => {
    render(
      <ToolBar
        menuOptions={[
          { label: 'Recipes', to: '/recipes' },
          { label: 'Pantry', children: [{ label: 'Items', to: '/pantry' }] },
        ]}
      />,
    )
    expect(model[0].url).toBe('/recipes')
    expect(model[1].url).toBeUndefined()
    const child = (model[1].items as MenuItem[][][])[0][0].items![0]
    expect(child.url).toBe('/pantry')
  })
})
