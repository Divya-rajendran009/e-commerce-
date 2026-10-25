import OrderWorkspace from '../components/OrderWorkspace'

export default function OrderDetail({ admin = false }) {
  return <OrderWorkspace admin={admin} />
}
