// ============================================
// ERROR HANDLING UTILITIES
// ============================================

export class AppError extends Error {
  public code?: string;
  public statusCode?: number;
  public details?: unknown;

  constructor(
    message: string,
    code?: string,
    statusCode?: number,
    details?: unknown
  ) {
    super(message);
    this.name = 'AppError';
    this.code = code;
    this.statusCode = statusCode;
    this.details = details;
  }
}

export class DatabaseError extends AppError {
  constructor(message: string, details?: unknown) {
    super(message, 'DATABASE_ERROR', 500, details);
    this.name = 'DatabaseError';
  }
}

export class ValidationError extends AppError {
  constructor(message: string, details?: unknown) {
    super(message, 'VALIDATION_ERROR', 400, details);
    this.name = 'ValidationError';
  }
}

export class AuthError extends AppError {
  constructor(message: string, details?: unknown) {
    super(message, 'AUTH_ERROR', 401, details);
    this.name = 'AuthError';
  }
}

export class NetworkError extends AppError {
  constructor(message: string, details?: unknown) {
    super(message, 'NETWORK_ERROR', 0, details);
    this.name = 'NetworkError';
  }
}

/**
 * Parse error to user-friendly message
 */
export const parseError = (error: unknown): string => {
  if (error instanceof AppError) {
    return error.message;
  }

  if (error instanceof Error) {
    // Check for common error patterns
    if (error.message.includes('Network')) {
      return 'Network error. Please check your connection.';
    }
    if (error.message.includes('timeout')) {
      return 'Request timed out. Please try again.';
    }
    if (error.message.includes('not found')) {
      return 'Resource not found.';
    }
    if (error.message.includes('permission')) {
      return 'You do not have permission to perform this action.';
    }

    return error.message;
  }

  if (typeof error === 'string') {
    return error;
  }

  return 'An unexpected error occurred.';
};

/**
 * Log error to console with context
 */
export const logError = (
  error: unknown,
  context?: string,
  additionalInfo?: Record<string, unknown>
): void => {
  console.error('[Error]', context || 'Unknown context', {
    error,
    message: parseError(error),
    timestamp: new Date().toISOString(),
    ...additionalInfo,
  });

  // In production, you might want to send to an error tracking service
  // like Sentry, LogRocket, etc.
};

/**
 * Handle async errors with try-catch
 */
export const handleAsync = async <T>(
  promise: Promise<T>,
  errorHandler?: (error: unknown) => void
): Promise<[T | null, unknown]> => {
  try {
    const data = await promise;
    return [data, null];
  } catch (error) {
    if (errorHandler) {
      errorHandler(error);
    }
    return [null, error];
  }
};

/**
 * Retry async operation with exponential backoff
 */
export const retryAsync = async <T>(
  fn: () => Promise<T>,
  options: {
    retries?: number;
    delay?: number;
    backoff?: number;
    onRetry?: (attempt: number, error: unknown) => void;
  } = {}
): Promise<T> => {
  const { retries = 3, delay = 1000, backoff = 2, onRetry } = options;

  let lastError: unknown;

  for (let i = 0; i <= retries; i++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;

      if (i < retries) {
        const waitTime = delay * Math.pow(backoff, i);
        if (onRetry) {
          onRetry(i + 1, error);
        }
        await new Promise((resolve) => setTimeout(resolve, waitTime));
      }
    }
  }

  throw lastError;
};

/**
 * Validation helpers
 */
export const validate = {
  required: (value: unknown, fieldName: string): void => {
    if (value === null || value === undefined || value === '') {
      throw new ValidationError(`${fieldName} is required`);
    }
  },

  number: (value: unknown, fieldName: string): void => {
    if (typeof value !== 'number' || isNaN(value)) {
      throw new ValidationError(`${fieldName} must be a valid number`);
    }
  },

  positiveNumber: (value: number, fieldName: string): void => {
    validate.number(value, fieldName);
    if (value < 0) {
      throw new ValidationError(`${fieldName} must be positive`);
    }
  },

  string: (value: unknown, fieldName: string): void => {
    if (typeof value !== 'string') {
      throw new ValidationError(`${fieldName} must be a string`);
    }
  },

  minLength: (value: string, min: number, fieldName: string): void => {
    validate.string(value, fieldName);
    if (value.length < min) {
      throw new ValidationError(`${fieldName} must be at least ${min} characters`);
    }
  },

  maxLength: (value: string, max: number, fieldName: string): void => {
    validate.string(value, fieldName);
    if (value.length > max) {
      throw new ValidationError(`${fieldName} must be at most ${max} characters`);
    }
  },

  email: (value: string, fieldName: string = 'Email'): void => {
    validate.string(value, fieldName);
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(value)) {
      throw new ValidationError(`${fieldName} must be a valid email address`);
    }
  },

  pattern: (value: string, pattern: RegExp, fieldName: string, message?: string): void => {
    validate.string(value, fieldName);
    if (!pattern.test(value)) {
      throw new ValidationError(message || `${fieldName} format is invalid`);
    }
  },

  openNumber: (value: string): void => {
    if (!/^\d{1}$/.test(value)) {
      throw new ValidationError('Open number must be exactly 1 digit');
    }
  },

  akraNumber: (value: string): void => {
    if (!/^\d{2}$/.test(value)) {
      throw new ValidationError('Akra number must be exactly 2 digits');
    }
  },

  ringNumber: (value: string): void => {
    if (!/^\d{3}$/.test(value)) {
      throw new ValidationError('Ring number must be exactly 3 digits');
    }
  },

  packetNumber: (value: string): void => {
    if (!/^\d{4}$/.test(value)) {
      throw new ValidationError('Packet number must be exactly 4 digits');
    }
  },
};

/**
 * Safe JSON parse
 */
export const safeJsonParse = <T>(json: string, fallback: T): T => {
  try {
    return JSON.parse(json) as T;
  } catch {
    return fallback;
  }
};

/**
 * Create error boundary context
 */
export interface ErrorBoundaryContext {
  error: Error | null;
  errorInfo: React.ErrorInfo | null;
  hasError: boolean;
  resetError: () => void;
}

/**
 * Format error for display
 */
export const formatErrorForDisplay = (error: unknown): {
  title: string;
  message: string;
  details?: string;
} => {
  if (error instanceof AppError) {
    return {
      title: error.name,
      message: error.message,
      details: error.details ? JSON.stringify(error.details, null, 2) : undefined,
    };
  }

  if (error instanceof Error) {
    return {
      title: error.name || 'Error',
      message: error.message,
      details: error.stack,
    };
  }

  return {
    title: 'Unknown Error',
    message: String(error),
  };
};

