import { Link } from 'react-router-dom'
import { ShoppingBag, Lamp, Shirt, Bath, SprayCan, Carrot, Milk, Wheat, Package } from 'lucide-react'
import { departmentUrl, storeThemes } from '../utils/storeThemes'

const icons = { All: ShoppingBag, Diwali: Lamp, Clothing: Shirt, Toiletries: Bath, Perfumes: SprayCan, Vegetables: Carrot, Dairy: Milk, 'Rice & grains': Wheat, Pantry: Package }

export default function DepartmentNav({ selected }) {
  return <nav className="compact-departments wrap" aria-label="Shop departments">
    {Object.keys(storeThemes).map(name => {
      const Icon = icons[name]
      return <Link key={name} to={departmentUrl(name)} aria-current={selected === name ? 'page' : undefined} onClick={event => event.currentTarget.scrollIntoView({ block: 'nearest', inline: 'nearest' })}>
        <Icon size={20} strokeWidth={1.5} aria-hidden="true" /><span>{name}</span>
      </Link>
    })}
  </nav>
}
