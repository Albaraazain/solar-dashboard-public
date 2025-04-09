"use client";

import React from 'react';
import { Button } from './ui/button';
import { Alert, AlertDescription, AlertTitle } from './ui/alert';

interface QuoteErrorBoundaryProps {
  children: React.ReactNode;
  onRetry: () => void;
}

interface QuoteErrorBoundaryState {
  hasError: boolean;
  error?: Error;
}

export class QuoteErrorBoundary extends React.Component<
  QuoteErrorBoundaryProps,
  QuoteErrorBoundaryState
> {
  constructor(props: QuoteErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: undefined });
    this.props.onRetry();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="space-y-4 p-4">
          <Alert variant="destructive">
            <AlertTitle>Calculation Error</AlertTitle>
            <AlertDescription>
              {this.state.error?.message || 'An unknown error occurred'}
            </AlertDescription>
          </Alert>
          
          <div className="flex gap-2">
            <Button variant="outline" onClick={this.handleRetry}>
              Retry Calculation
            </Button>
            <Button variant="secondary" onClick={() => window.location.reload()}>
              Reload Page
            </Button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}