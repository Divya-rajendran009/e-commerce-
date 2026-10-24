import { Link } from 'react-router-dom'

export const policyPaths = {
  terms: '/terms-and-conditions',
  privacy: '/privacy-policy',
  delivery: '/delivery-policy',
  returns: '/return-refund-policy',
  ugc: '/ugc-policy',
}

export default function PolicyLink({ policy, children, ...props }) {
  const to = policyPaths[policy]

  return <Link
    {...props}
    to={to}
    onClick={(event) => {
      props.onClick?.(event)
      if (!event.defaultPrevented) {
        event.preventDefault()
        window.dispatchEvent(new CustomEvent('store:open-policy', { detail: { policy } }))
      }
    }}
  >{children}</Link>
}
