import { Outlet, Link, createRootRoute, HeadContent, Scripts } from "@tanstack/react-router";

import appCss from "../styles.css?url";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-semibold text-foreground">Page not found</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          The page you're looking for doesn't exist or has been moved.
        </p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Go home
          </Link>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "ClaimPilot by ScaleAI" },
      { name: "description", content: "ClaimPilot by ScaleAI streamlines insurance claims processing for agents." },
      { name: "author", content: "ScaleAI" },
      { property: "og:title", content: "ClaimPilot by ScaleAI" },
      { property: "og:description", content: "ClaimPilot by ScaleAI streamlines insurance claims processing for agents." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "twitter:site", content: "@ScaleAI" },
      { name: "twitter:title", content: "ClaimPilot by ScaleAI" },
      { name: "twitter:description", content: "ClaimPilot by ScaleAI streamlines insurance claims processing for agents." },
      { property: "og:image", content: "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/06e73760-2f5b-4647-9194-522070ca1c36/id-preview-2bb6f0f2--75366585-65c5-4160-82a6-a977590460a4.lovable.app-1776621797305.png" },
      { name: "twitter:image", content: "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/06e73760-2f5b-4647-9194-522070ca1c36/id-preview-2bb6f0f2--75366585-65c5-4160-82a6-a977590460a4.lovable.app-1776621797305.png" },
    ],
    links: [
      {
        rel: "stylesheet",
        href: appCss,
      },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
});

function RootShell({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  return <Outlet />;
}
