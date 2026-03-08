import { Component, type ReactNode } from "react";
import { AlertCircle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error) {
    console.error("[ErrorBoundary] Uncaught error:", error);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;

      return (
        <div className="flex items-center justify-center py-12 px-4">
          <div className="max-w-md w-full space-y-4">
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Algo deu errado</AlertTitle>
              <AlertDescription>
                {this.state.error?.message || "Ocorreu um erro inesperado nesta seção."}
              </AlertDescription>
            </Alert>
            <Button
              variant="outline"
              onClick={this.handleReset}
              className="w-full gap-2"
            >
              <RefreshCw className="h-4 w-4" />
              Tentar novamente
            </Button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
