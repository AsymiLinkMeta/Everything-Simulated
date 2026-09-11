import { Component, type ErrorInfo, type ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { useLocation } from "react-router-dom";
import { NotFoundError } from "@/shims/tanstack-react-router";
import { NotFoundPage } from "@/routes/not-found";
import { Button } from "@/components/ui/button";

type Props = { children: ReactNode };
type State = { error: Error | null };

class Boundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidCatch(error: Error, _info: ErrorInfo) {
    this.setState({ error });
  }

  render() {
    const err = this.state.error;
    if (!err) return this.props.children;
    if (err instanceof NotFoundError || err.name === "NotFoundError" || err.message === "Not Found") {
      return <NotFoundPage />;
    }
    return (
      <main className="grid min-h-dvh place-items-center bg-ink px-5 text-paper">
        <div className="es-card max-w-md space-y-4 p-8 text-center">
          <p className="es-kicker">Error</p>
          <h1 className="text-2xl font-medium">Something broke in the workshop</h1>
          <p className="text-sm text-muted">{err.message || "Please try again."}</p>
          <Button asChild>
            <Link to="/">Home</Link>
          </Button>
        </div>
      </main>
    );
  }
}

export function RouteError({ children }: { children: ReactNode }) {
  const loc = useLocation();
  return <Boundary key={loc.pathname}>{children}</Boundary>;
}
