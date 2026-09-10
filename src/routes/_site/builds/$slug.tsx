import { createFileRoute, Navigate } from "@tanstack/react-router";

export const Route = createFileRoute("/_site/builds/$slug")({
  component: function BuildRedirect() {
    const { slug } = Route.useParams();
    return <Navigate to={`/prebuilds/${slug}`} replace />;
  },
});
