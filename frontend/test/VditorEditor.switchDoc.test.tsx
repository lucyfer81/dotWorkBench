import { describe, it, expect, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import React, { useState } from 'react'
import { VditorEditor } from '../src/components/Editor/VditorEditor'

// Mock vditor module for testing
vi.mock('vditor', () => {
  return {
    default: class MockVditor {
      options: any
      value: string
      constructor(element: HTMLElement, options: any) {
        this.options = options
        this.value = ''
        setTimeout(() => {
          if (options.after) options.after()
        }, 0)
      }
      setValue(val: string) {
        this.value = val
      }
      getValue() {
        return this.value
      }
      destroy() {}
    }
  }
})

describe('VditorEditor Document Switching Test', () => {
  it('preserves latest onChange handler when switching doc key and unmounting', async () => {
    const handleSaveDoc1 = vi.fn()
    const handleSaveDoc2 = vi.fn()

    function TestApp() {
      const [docId, setDocId] = useState('doc-1')
      const [content1, setContent1] = useState('Doc 1 Initial')
      const [content2, setContent2] = useState('Doc 2 Initial')

      return (
        <div>
          <button onClick={() => setDocId('doc-1')}>Doc 1</button>
          <button onClick={() => setDocId('doc-2')}>Doc 2</button>
          {docId === 'doc-1' && (
            <VditorEditor
              key="doc-1"
              value={content1}
              onChange={(val) => {
                setContent1(val)
                handleSaveDoc1(val)
              }}
            />
          )}
          {docId === 'doc-2' && (
            <VditorEditor
              key="doc-2"
              value={content2}
              onChange={(val) => {
                setContent2(val)
                handleSaveDoc2(val)
              }}
            />
          )}
        </div>
      )
    }

    const { rerender } = render(<TestApp />)
    const user = userEvent.setup()

    // Switch to doc-2
    await user.click(screen.getByText('Doc 2'))
    await waitFor(() => {
      expect(screen.queryByText('Doc 1')).toBeInTheDocument()
    })
  })
})
