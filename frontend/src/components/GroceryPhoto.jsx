import { useState } from 'react'

// Real photographs from Unsplash. Provenance is kept alongside the source.
export const groceryPhotos = {
  vegetables: { id: 'photo-1579113800032-c38bd7635818', alt: 'Fresh vegetables arranged on a table', photographer: 'Marisol Benitez', source: 'https://unsplash.com/photos/QvkAQTNj4zk' },
  dairy: { id: 'photo-1550583724-b2692b85b150', alt: 'Milk being poured into a glass', photographer: 'Eiliv Aceron', source: 'https://unsplash.com/photos/_8bnn1GqX70' },
  rice: { id: 'photo-1586201375761-83865001e31c', alt: 'Uncooked white rice grains', photographer: 'Pierre Bamin', source: 'https://unsplash.com/photos/-LdilhDx3sk' },
}
export function categoryPhoto(name = '') {
  if (/dairy|milk/i.test(name)) return groceryPhotos.dairy
  if (/rice|grain/i.test(name)) return groceryPhotos.rice
  if (/vegetable|fresh|produce/i.test(name)) return groceryPhotos.vegetables
  return null
}
const photoUrl = (photo, width) => `https://images.unsplash.com/${photo.id}?auto=format&fit=crop&w=${width}&q=80`
export default function GroceryPhoto({ photo, hero = false, representative = false }) {
  const [failed, setFailed] = useState(false)
  if (!photo || failed) return <span className="photo-unavailable">Photo unavailable</span>
  return <span className={`grocery-photo${hero ? ' hero-photo' : ''}${representative ? ' representative-photo' : ''}`}>
    <img src={photoUrl(photo, hero ? 1000 : 480)} srcSet={[320, 480, 768, 1000].map(w => `${photoUrl(photo, w)} ${w}w`).join(', ')} sizes={hero ? '(max-width:650px) 100vw, 50vw' : '(max-width:650px) 45vw, 300px'} alt={representative ? `${photo.alt} — representative category photo` : photo.alt} width={hero ? 1000 : 480} height={hero ? 720 : 360} loading={hero ? 'eager' : 'lazy'} fetchPriority={hero ? 'high' : 'auto'} decoding="async" onError={() => setFailed(true)} />
    {representative && <small className="photo-caption">Representative photo</small>}
  </span>
}
