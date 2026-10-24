import { Link } from 'react-router-dom'
import { ArrowLeft, ChevronRight } from 'lucide-react'
import departments from '../data/departments.json'
import { departmentUrl } from '../utils/storeThemes'

const groups = [
  { name: 'Style & personal care', names: ['Clothing', 'Toiletries', 'Perfumes'] },
  { name: 'Grocery & kitchen', names: ['Vegetables', 'Dairy', 'Rice & grains', 'Pantry'] },
]

export default function Categories() {
  return <section className="category-directory wrap">
    <div className="simple-page-title"><Link to="/" aria-label="Back to home"><ArrowLeft size={21} /></Link><h1>Categories</h1></div>
    {groups.map(group => <section key={group.name}><h2>{group.name}</h2><div className="directory-grid">
      {group.names.map(name => {
        const image = departments.find(department => department.name === name)
        return <Link to={departmentUrl(name)} key={name}><span><img src={image.image_url} alt="" width="80" height="80" loading="lazy" /></span><strong>{name}</strong></Link>
      })}
    </div></section>)}
    <Link className="directory-festive" to={departmentUrl('Diwali')}><span><small>THE DIWALI EDIT</small><strong>Explore festive picks</strong></span><ChevronRight size={20} /></Link>
    <Link className="text-link" to="/products">Browse the existing store catalogue <ChevronRight size={16} /></Link>
  </section>
}
