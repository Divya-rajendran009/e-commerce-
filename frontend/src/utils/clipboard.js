export async function copyText(text) {
  let clipboardError
  if (globalThis.navigator?.clipboard?.writeText) {
    try {
      await globalThis.navigator.clipboard.writeText(text)
      return
    } catch (error) {
      clipboardError = error
    }
  }

  const documentRef = globalThis.document
  if (!documentRef?.body || !documentRef.createElement || !documentRef.execCommand) {
    const error = new Error('Clipboard access is not available on this device.')
    if (clipboardError) error.cause = clipboardError
    throw error
  }

  const input = documentRef.createElement('textarea')
  input.value = text
  input.setAttribute('readonly', '')
  input.style.position = 'fixed'
  input.style.opacity = '0'
  documentRef.body.appendChild(input)
  try {
    input.select()
    if (!documentRef.execCommand('copy')) {
      const error = new Error('Clipboard access is not available on this device.')
      if (clipboardError) error.cause = clipboardError
      throw error
    }
  } finally {
    input.remove()
  }
}
