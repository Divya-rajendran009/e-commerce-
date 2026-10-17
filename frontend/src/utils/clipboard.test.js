import { afterEach, describe, expect, it, vi } from 'vitest'
import { copyText } from './clipboard'

afterEach(() => vi.unstubAllGlobals())

describe('copyText', () => {
  it('uses the Clipboard API when available', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined)
    vi.stubGlobal('navigator', { clipboard: { writeText } })

    await copyText('https://example.test/register?ref=ABC')

    expect(writeText).toHaveBeenCalledWith('https://example.test/register?ref=ABC')
  })

  it('falls back to document copy when the Clipboard API rejects', async () => {
    const input = {
      style: {},
      setAttribute: vi.fn(),
      select: vi.fn(),
      remove: vi.fn(),
    }
    const execCommand = vi.fn().mockReturnValue(true)
    vi.stubGlobal('navigator', { clipboard: { writeText: vi.fn().mockRejectedValue(new Error('Clipboard permission denied')) } })
    vi.stubGlobal('document', {
      body: { appendChild: vi.fn() },
      createElement: vi.fn().mockReturnValue(input),
      execCommand,
    })

    await copyText('REFERRAL-CODE')

    expect(execCommand).toHaveBeenCalledWith('copy')
    expect(input.remove).toHaveBeenCalledOnce()
  })

  it('uses and removes a temporary input when the Clipboard API is unavailable', async () => {
    const input = {
      style: {},
      setAttribute: vi.fn(),
      select: vi.fn(),
      remove: vi.fn(),
    }
    const appendChild = vi.fn()
    const execCommand = vi.fn().mockReturnValue(true)
    vi.stubGlobal('navigator', {})
    vi.stubGlobal('document', {
      body: { appendChild },
      createElement: vi.fn().mockReturnValue(input),
      execCommand,
    })

    await copyText('REFERRAL-CODE')

    expect(input.value).toBe('REFERRAL-CODE')
    expect(appendChild).toHaveBeenCalledWith(input)
    expect(execCommand).toHaveBeenCalledWith('copy')
    expect(input.remove).toHaveBeenCalledOnce()
  })

  it('reports unavailable clipboard access', async () => {
    vi.stubGlobal('navigator', {})
    vi.stubGlobal('document', {
      body: { appendChild: vi.fn() },
      createElement: vi.fn(() => ({
        style: {},
        setAttribute: vi.fn(),
        select: vi.fn(),
        remove: vi.fn(),
      })),
      execCommand: vi.fn().mockReturnValue(false),
    })

    await expect(copyText('REFERRAL-CODE')).rejects.toThrow('Clipboard access is not available')
  })
})
