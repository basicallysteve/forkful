'use client'

import { Editor } from 'primereact/editor'
import { FileUpload, type FileUploadHandlerEvent } from 'primereact/fileupload'
import { sanitizeRichText } from '@/lib/sanitize'
import type { RecipeStep } from '@/types/RecipeStep'

interface RecipeStepBlockProps {
  step: RecipeStep
  index: number
  totalSteps: number
  editMode: boolean
  onChange: (id: number, field: 'title' | 'content', value: string) => void
  onMove: (id: number, direction: 'up' | 'down') => void
  onDelete: (id: number) => void
  onImageUpload: (id: number, file: File) => void
}

export default function RecipeStepBlock({
  step,
  index,
  totalSteps,
  editMode,
  onChange,
  onMove,
  onDelete,
  onImageUpload,
}: RecipeStepBlockProps) {
  return (
    <div className="step-block">
      <div className="step-header">
        <span className="step-number">{index + 1}</span>
        {editMode ? (
          <input
            type="text"
            className="step-title-input"
            placeholder="Step title (optional)"
            value={step.title ?? ''}
            onChange={(e) => onChange(step.id, 'title', e.target.value)}
            aria-label={`Step ${index + 1} title`}
          />
        ) : (
          step.title && <h4 className="step-title">{step.title}</h4>
        )}
        {editMode && (
          <div className="step-controls">
            <button type="button" className="ghost-button step-btn" onClick={() => onMove(step.id, 'up')} disabled={index === 0} aria-label="Move step up">↑</button>
            <button type="button" className="ghost-button step-btn" onClick={() => onMove(step.id, 'down')} disabled={index === totalSteps - 1} aria-label="Move step down">↓</button>
            <button type="button" className="danger-button step-btn" onClick={() => onDelete(step.id)} aria-label={`Delete step ${index + 1}`}>Remove</button>
          </div>
        )}
      </div>
      {editMode ? (
        <div className="step-editor-wrap">
          <Editor
            value={step.content}
            onTextChange={(e) => onChange(step.id, 'content', e.htmlValue ?? '')}
            style={{ height: '120px' }}
            aria-label={`Step ${index + 1} content`}
          />
          <FileUpload
            className="step-image-upload"
            mode="basic"
            accept="image/*"
            maxFileSize={10 * 1024 * 1024}
            auto
            customUpload
            chooseLabel="+ Image"
            uploadHandler={(e: FileUploadHandlerEvent) => {
              const file = e.files[0]
              if (file) {
                onImageUpload(step.id, file)
                e.options.clear()
              }
            }}
            aria-label={`Upload image for step ${index + 1}`}
          />
        </div>
      ) : (
        <div
          className="step-content"
          dangerouslySetInnerHTML={{ __html: sanitizeRichText(step.content) }}
        />
      )}
    </div>
  )
}
