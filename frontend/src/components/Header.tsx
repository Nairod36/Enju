import { Link } from '@tanstack/react-router'

export function Header() {
  return (
    <header style={{ backgroundColor: 'white', padding: '20px', borderBottom: '1px solid #ccc' }}>
      <nav>
        <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', gap: '20px' }}>
          <li>
            <Link to="/" style={{ textDecoration: 'none', color: 'black' }}>
              Home
            </Link>
          </li>
          <li>
            <Link to="/game" style={{ textDecoration: 'none', color: 'black' }}>
              Game
            </Link>
          </li>
        </ul>
      </nav>
    </header>
  )
}