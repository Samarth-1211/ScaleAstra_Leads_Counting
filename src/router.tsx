import { Link, Outlet, createRootRoute, createRoute, createRouter } from '@tanstack/react-router';
import { HomePage } from './components/HomePage';

const rootRoute = createRootRoute({
  component: Outlet,
  notFoundComponent: () => (
    <main className="not-found">
      <p>This page doesn't exist.</p>
      <Link to="/" className="btn btn-primary">
        Open the lead app
      </Link>
    </main>
  ),
});

const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/',
  component: HomePage,
});

export const router = createRouter({ routeTree: rootRoute.addChildren([indexRoute]) });

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router;
  }
}
