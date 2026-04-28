import React from 'react'

interface EditorChangeParams {
  htmlValue: string | null
  textValue: string
  delta: unknown
  source: string
}

interface MockEditorProps {
  value?: string
  onTextChange?: (e: EditorChangeParams) => void
  placeholder?: string
  style?: React.CSSProperties
  className?: string
  'aria-label'?: string
  readOnly?: boolean
}

export function Editor({
  value = '',
  onTextChange,
  placeholder,
  style,
  className,
  'aria-label': ariaLabel,
}: MockEditorProps) {
  return (
    <textarea
      value={value}
      onChange={(e) => {
        onTextChange?.({
          htmlValue: e.target.value,
          textValue: e.target.value,
          delta: null,
          source: 'user',
        })
      }}
      placeholder={placeholder}
      aria-label={ariaLabel}
      style={style}
      className={className}
    />
  )
}
