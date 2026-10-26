import { describe, expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { ProductPrice } from './Shared'

describe('honest price display', () => {
  it('does not relabel a previous selling price as MRP', () => {
    const html = renderToStaticMarkup(<ProductPrice product={{price:'95', regular_price:'100', mrp:null}} />)
    expect(html).toContain('MRP: Not provided')
    expect(html).toContain('Previous price:')
    expect(html).toContain('Save ₹5.00 (5%)')
  })
  it('does not invent savings for an estimated price', () => {
    const html = renderToStaticMarkup(<ProductPrice product={{price:'99', mrp:null}} />)
    expect(html).not.toContain('Save ')
    expect(html).not.toContain('<s>')
  })
})
