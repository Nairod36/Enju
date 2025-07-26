import { createRouter, createRoute, createRootRoute, Outlet } from '@tanstack/react-router'
import { Header } from './components/Header'
import { HomePage } from './pages/HomePage'
import { GamePage } from './pages/JeuPage'

const rootRoute = createRootRoute({
  component: () => (
    <div style={{ backgroundColor: 'white', minHeight: '100vh' }}>
      <Header />
      <main>
        <Outlet />
      </main>
    </div>
  ),
})

const homeRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/',
  component: HomePage,
})

const gameRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/game',
  component: GamePage,
})

const routeTree = rootRoute.addChildren([homeRoute, gameRoute])

export const router = createRouter({ routeTree })

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router
  }
}