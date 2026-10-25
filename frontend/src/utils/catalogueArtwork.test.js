import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import departments from '../data/departments.json'
import products from '../data/demoProducts.json'
import artwork from '../data/catalogueArtwork.json'
import { categoryImageSource, productImageSource } from './catalogueArtwork'

describe('distinct catalogue photographs', () => {
  it('never classifies Toiletries as oil or pantry', () => {
    expect(categoryImageSource('Toiletries')).toBe('/images/catalogue/categories/toiletries.webp')
    expect(categoryImageSource('Personal care')).toBe(categoryImageSource('Toiletries'))
    expect(categoryImageSource('Cooking oil')).toBe(categoryImageSource('Pantry'))
    expect(categoryImageSource('  RICE & GRAINS ')).toBe('/images/catalogue/categories/rice-grains.webp')
    expect(categoryImageSource('Spoilers')).toBeNull()
  })

  it('assigns a separate image to every category and every sample product', () => {
    expect(new Set(departments.map(d => categoryImageSource(d.name))).size).toBe(7)
    expect(products).toHaveLength(18)
    expect(new Set(products.map(productImageSource)).size).toBe(products.length)
    for (const product of products) {
      expect(productImageSource(product)).toMatch(/^\/images\/catalogue\/products\//)
    }
  })

  it('ships all 25 assets with different file contents', () => {
    const paths = [...departments, ...artwork].map(item => item.image_url)
    expect(new Set(paths).size).toBe(25)
    const hashes = paths.map(path => {
      const file = readFileSync(new URL(`../../public${path}`, import.meta.url))
      expect(file.length).toBeGreaterThan(1000)
      expect(file.subarray(8, 12).toString()).toBe('WEBP')
      return createHash('sha256').update(file).digest('hex')
    })
    expect(new Set(hashes).size).toBe(paths.length)
  })

  it('keeps uploaded photos even when the name, id or category matches a sample', () => {
    for (const source of ['/media/products/my-rice.jpg', 'https://shop.example/rice.webp']) {
      expect(productImageSource({ ...products[0], image_url: source })).toBe(source)
    }
    expect(productImageSource({ name:'Rice', category_name:'Rice & grains' })).toBeNull()
    expect(productImageSource({ image_url:'' })).toBeNull()
  })

  it('recognizes sample cache parameters but leaves unknown URLs untouched', () => {
    expect(productImageSource({ image_url:artwork[0].source+'?v=2#photo' })).toBe(artwork[0].image_url)
    for (const source of [
      'https://cdn.dummyjson.com/product-images/groceries/unknown/thumbnail.webp',
      artwork[0].source.replace('cdn.dummyjson.com', 'cdn.dummyjson.com.example.org'),
    ]) expect(productImageSource({ image_url:source })).toBe(source)
  })
})
