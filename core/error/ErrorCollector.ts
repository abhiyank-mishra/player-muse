import { ErrorLog } from '@/features/bug-report/bug-report.types';

class ErrorCollector {
  private static instance: ErrorCollector;
  private logs: ErrorLog[] = [];
  private isInitialized = false;

  private constructor() {}

  public static getInstance(): ErrorCollector {
    if (!ErrorCollector.instance) {
      ErrorCollector.instance = new ErrorCollector();
    }
    return ErrorCollector.instance;
  }

  public init() {
    if (this.isInitialized || typeof window === 'undefined') return;
    this.isInitialized = true;

    // Capture unhandled errors
    window.addEventListener('error', (event) => {
      this.logError({
        type: 'window.onerror',
        message: event.message,
        source: event.filename,
        lineno: event.lineno,
        colno: event.colno,
        error: event.error?.toString(),
        timestamp: new Date().toISOString(),
      });
    });

    // Capture unhandled promise rejections
    window.addEventListener('unhandledrejection', (event) => {
      this.logError({
        type: 'unhandledrejection',
        message: event.reason?.toString() || 'Unknown Promise Rejection',
        timestamp: new Date().toISOString(),
      });
    });

    // Override console methods to capture all logs
    const methods: ('error' | 'warn' | 'log' | 'info')[] = ['error', 'warn', 'log', 'info'];
    
    methods.forEach((method) => {
      const originalConsoleMethod = console[method];
      console[method] = (...args: any[]) => {
        this.logError({
          type: `console.${method}`,
          message: args.map(a => typeof a === 'object' ? JSON.stringify(a) : String(a)).join(' '),
          timestamp: new Date().toISOString(),
        });
        originalConsoleMethod.apply(console, args);
      };
    });
  }

  private logError(log: ErrorLog) {
    this.logs.push(log);
    // Keep only the last 50 logs to avoid memory bloat
    if (this.logs.length > 50) {
      this.logs.shift();
    }
  }

  public getLogs(): ErrorLog[] {
    return [...this.logs];
  }

  public clearLogs() {
    this.logs = [];
  }
}

export default ErrorCollector.getInstance();
