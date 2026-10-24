import { useState } from 'react'

// Real photographs from Unsplash. Provenance is kept alongside the source.
export const groceryPhotos = {
  family: { id: 'photo-1509913265763-b64490c3c1b3', alt: 'Parents and their child together on a shopping-centre escalator', source: 'https://unsplash.com/photos/atx6RnKB3aw' },
  clothing: { id: 'photo-1558769132-cb1aea458c5e', alt: 'Clothing neatly arranged on a rail', source: 'https://unsplash.com/photos/TS--uNw-JqE' },
  toiletries: { id: 'photo-1603990103103-baf3ada7af1c', alt: 'Personal-care bottles arranged on a bathroom shelf', source: 'https://unsplash.com/photos/APszipc01pA' },
  perfume: { id: 'photo-1594035910387-fea47794261f', alt: 'Perfume bottle photographed in warm light', source: 'https://unsplash.com/photos/4sKdeIMiFEI' },
  shopping: { id: 'photo-1483985988355-763728e1935b', alt: 'A shopper carrying everyday purchases in shopping bags', photographer: 'freestocks', source: 'https://unsplash.com/photos/_3Q3tsJ01nc' },
  homeCooking: { id: 'photo-1507048331197-7d4ac70811cf', alt: 'Hands preparing fresh vegetables for a home-cooked meal', photographer: 'Maarten van den Heuvel', source: 'https://unsplash.com/photos/EzH46XCDQRY' },
  vegetables: { id: 'photo-1579113800032-c38bd7635818', alt: 'Fresh vegetables arranged on a table', photographer: 'Marisol Benitez', source: 'https://unsplash.com/photos/QvkAQTNj4zk' },
  dairy: { id: 'photo-1550583724-b2692b85b150', alt: 'Milk being poured into a glass', photographer: 'Eiliv Aceron', source: 'https://unsplash.com/photos/_8bnn1GqX70' },
  rice: { id: 'photo-1586201375761-83865001e31c', alt: 'Uncooked white rice grains', photographer: 'Pierre Bamin', source: 'https://unsplash.com/photos/-LdilhDx3sk' },
}
export function categoryPhoto(name = '') {
  if (/cloth|fashion|apparel|wear/i.test(name)) return groceryPhotos.clothing
  if (/toiletr|personal care|bath|hygiene/i.test(name)) return groceryPhotos.toiletries
  if (/perfume|fragrance/i.test(name)) return groceryPhotos.perfume
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
