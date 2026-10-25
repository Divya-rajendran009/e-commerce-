import { useEffect, useState } from 'react'
import { Download, Eye, Share2, Link2 } from 'lucide-react'
import api, { errorMessage } from '../services/api'
import { copyText } from '../utils/clipboard'

export default function InvoiceActions({ order, admin = false, compact = false, onIssued }) {
  const [file, setFile] = useState(null)
  const [preview, setPreview] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [includeQR, setIncludeQR] = useState(true)
  useEffect(
    () => () => {
      if (file) URL.revokeObjectURL(file.url)
    },
    [file]
  )
  const prepare = async () => {
    if (file) return file
    const path = `${admin ? '/admin' : ''}/orders/${order.id}/invoice/`
    const response = admin
      ? await api.post(path, { include_qr: includeQR }, { responseType: 'blob' })
      : await api.get(path, { responseType: 'blob' })
    const result = {
      blob: response.data,
      url: URL.createObjectURL(response.data),
      name: `INV-${order.order_number}.pdf`
    }
    setFile(result)
    onIssued?.()
    return result
  }
  const act = async (action) => {
    setBusy(true)
    setError('')
    setNotice('')
    try {
      const ready = await prepare()
      if (action === 'view') setPreview(true)
      else {
        const anchor = document.createElement('a')
        anchor.href = ready.url
        anchor.download = ready.name
        anchor.click()
        setNotice('Invoice downloaded.')
      }
    } catch (e) {
      if (e.response?.data instanceof Blob) {
        try {
          e.response.data = JSON.parse(await e.response.data.text())
        } catch {
          /* Keep the network error. */
        }
      }
      setError(errorMessage(e))
    } finally {
      setBusy(false)
    }
  }
  const share = async () => {
    if (!file) return
    const pdf = new File([file.blob], file.name, { type: 'application/pdf' })
    try {
      if (navigator.canShare?.({ files: [pdf] }))
        await navigator.share({ files: [pdf], title: `Invoice ${order.order_number}` })
      else setNotice('File sharing is unavailable in this browser. Download the PDF to share it.')
    } catch (e) {
      if (e.name !== 'AbortError') setError('Could not share the invoice. You can download it instead.')
    }
  }
  return (
    <div className="invoice-actions">
      {!compact && (
        <>
          <h2>Invoice</h2>
          <p className="order-muted">
            Download a PDF of the items, charges, and payment split. The first generated copy is saved and
            stays unchanged.
          </p>
          {order.status === 'cancelled' && (
            <p className="order-warning">
              This order is cancelled. An invoice does not confirm delivery or payment.
            </p>
          )}
          {admin && !file && !order.invoice_info && (
            <label className="invoice-qr">
              <input
                type="checkbox"
                checked={includeQR}
                onChange={(event) => setIncludeQR(event.target.checked)}
                disabled={busy}
              />{' '}
              Include a QR with invoice reference and total
            </label>
          )}
          {order.invoice_info && <p className="order-muted">{order.invoice_info.number} · Saved invoice</p>}
        </>
      )}
      <div className="order-action-row">
        <button
          type="button"
          className="button secondary small"
          disabled={busy}
          onClick={() => act('download')}
        >
          <Download size={16} />
          {busy ? 'Preparing…' : 'Download invoice'}
        </button>
        {!compact && (
          <>
            <button
              type="button"
              className="button secondary small"
              disabled={busy}
              onClick={() => act('view')}
            >
              <Eye size={16} />
              View invoice
            </button>
            {file && (
              <button type="button" className="button secondary small" onClick={share}>
                <Share2 size={16} />
                Share PDF
              </button>
            )}
            <button
              type="button"
              className="button secondary small"
              onClick={async () => {
                try {
                  await copyText(`${window.location.origin}/orders/${order.id}`)
                  setNotice('Order link copied. Only this customer can open it after signing in.')
                } catch (e) {
                  setError(e.message)
                }
              }}
            >
              <Link2 size={16} />
              Copy order link
            </button>
          </>
        )}
      </div>
      {error && (
        <p className="order-warning" role="alert">
          {error}
        </p>
      )}
      {notice && (
        <p className="order-muted" role="status">
          {notice}
        </p>
      )}
      {preview && file && (
        <div className="invoice-preview">
          <button type="button" className="text-link" onClick={() => setPreview(false)}>
            Close preview
          </button>
          <iframe title={`Invoice ${order.order_number}`} src={file.url} />
          <a href={file.url} download={file.name}>
            Download PDF if the preview is unavailable
          </a>
        </div>
      )}
    </div>
  )
}
