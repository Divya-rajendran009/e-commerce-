import { useEffect, useRef } from 'react'
import { ShoppingBag, X } from 'lucide-react'
import Cart from '../pages/Cart'

export default function CartDrawer({ open, onClose }) {
  const dialog = useRef(null)
  useEffect(() => {
    if (!open) { dialog.current?.close(); return }
    dialog.current.showModal()
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = previousOverflow }
  }, [open])
  return <dialog ref={dialog} className="cart-drawer" aria-labelledby="cart-drawer-title" onCancel={onClose} onClose={onClose} onClick={e => { if (e.target === dialog.current) onClose() }}><header className="cart-drawer-header"><h2 id="cart-drawer-title"><ShoppingBag size={21} /> My cart</h2><button type="button" autoFocus aria-label="Close cart" onClick={onClose}><X size={22} /></button></header>{open && <Cart drawer />}</dialog>
}
