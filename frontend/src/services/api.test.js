import { describe, expect, it } from 'vitest'
import { errorMessage } from './api'

describe('errorMessage', () => {
  it('uses a useful server detail message', () => {
    expect(errorMessage({ response: { data: { detail: 'Stock is unavailable.' } } })).toBe('Stock is unavailable.')
  })

  it('uses the first field validation error', () => {
    expect(errorMessage({ response: { data: { address: ['Enter a delivery address.'] } } })).toBe('Enter a delivery address.')
  })
})
