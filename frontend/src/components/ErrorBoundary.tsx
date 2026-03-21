import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RotateCcw } from 'lucide-react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
}

class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error:', error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-surface p-4">
          <div className="max-w-md w-full bg-surface-container-low p-10 rounded-[2rem] border border-outline-variant shadow-2xl text-center">
            <div className="w-16 h-16 bg-error-container text-error rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-lg">
              <AlertTriangle size={32} />
            </div>
            <h2 className="font-headline text-2xl font-black text-on-surface mb-2 tracking-tight">System Fault Detected</h2>
            <p className="text-on-surface-variant font-medium text-sm opacity-60 mb-8 leading-relaxed">
              An unrecoverable error has occurred in the interface. The localized session has been halted to prevent data corruption.
            </p>
            <div className="bg-surface-container p-4 rounded-xl mb-8 text-left">
              <p className="text-[10px] font-black text-on-surface-variant uppercase tracking-widest mb-1 opacity-40">Error Trace</p>
              <p className="text-xs font-mono text-error break-words leading-tight">{this.state.error?.message}</p>
            </div>
            <button 
              onClick={() => window.location.reload()}
              className="w-full py-4 bg-primary-container text-white font-black rounded-2xl shadow-lg shadow-blue-900/20 flex items-center justify-center gap-3 hover:scale-[1.02] active:scale-95 transition-all uppercase tracking-widest text-xs"
            >
              <RotateCcw size={18} />
              Re-establish Connection
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
