import {
  createRouter,
  createRoute,
  createRootRoute,
  Outlet,
} from "@tanstack/react-router";
import { Header } from "./components/Header";
import { HomePage } from "./pages/HomePage";
import { GamePage } from "./pages/GamePage";
import ThreePage from "./pages/ThreePage";

const rootRoute = createRootRoute({
  component: () => (
    <div style={{ backgroundColor: "white", minHeight: "100vh" }}>
      <Header />
      <main>
        <Outlet />
      </main>
    </div>
  ),
});

const homeRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/",
  component: HomePage,
});

const gameRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/game",
  component: GamePage,
});

const ThreeDGameRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/3d-game",
  component: ThreePage,
});

const routeTree = rootRoute.addChildren([
  homeRoute,
  gameRoute,
  ThreeDGameRoute,
]);

export const router = createRouter({ routeTree });

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}
