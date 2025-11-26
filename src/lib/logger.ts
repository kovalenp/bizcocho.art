import pino, { type Logger } from 'pino'

/**
 * Production-grade Pino logger configuration
 *
 * Environment-based configuration:
 * - Development: Pretty-printed, colorized logs with readable timestamps
 * - Production: JSON-formatted logs optimized for log aggregation (Sentry, CloudWatch, etc.)
 *
 * Configuration via environment variables:
 * - NODE_ENV: 'development' | 'production'
 * - LOG_LEVEL: 'fatal' | 'error' | 'warn' | 'info' | 'debug' | 'trace' (default: 'info')
 */

const isDevelopment = process.env.NODE_ENV !== 'production'
const logLevel = process.env.LOG_LEVEL || (isDevelopment ? 'debug' : 'info')

/**
 * Development transport configuration with pino-pretty
 * Provides human-readable, colorized output for local development
 */
const developmentTransport = {
  target: 'pino-pretty',
  options: {
    colorize: true,
    translateTime: 'SYS:standard',
    ignore: 'pid,hostname',
    messageFormat: '{levelLabel} - {msg}',
    singleLine: false,
    // Show error stack traces in development
    errorProps: 'message,stack,type,code',
  },
}

/**
 * Base Pino configuration
 * Uses JSON format in production for structured logging
 */
const baseConfig: pino.LoggerOptions = {
  level: logLevel,
  // Use pino-pretty transport only in development
  transport: isDevelopment ? developmentTransport : undefined,

  // Format configuration
  formatters: {
    level: (label) => {
      return { level: label.toUpperCase() }
    },
    bindings: (bindings) => {
      // In production, include pid and hostname for distributed systems
      // In development, omit for cleaner output (pino-pretty handles this via 'ignore')
      return isDevelopment ? {} : {
        pid: bindings.pid,
        hostname: bindings.hostname,
      }
    },
  },

  // ISO 8601 timestamp format
  timestamp: pino.stdTimeFunctions.isoTime,

  // Base context that will be included in all logs
  base: {
    env: process.env.NODE_ENV || 'development',
    service: 'bizcocho-art',
  },

  // Redact sensitive fields from logs
  redact: {
    paths: [
      'req.headers.authorization',
      'req.headers.cookie',
      'res.headers["set-cookie"]',
      'password',
      'secret',
      'token',
      'apiKey',
      'api_key',
    ],
    remove: true,
  },
}

/**
 * Main application logger instance
 * Use this throughout the application for consistent logging
 */
export const logger: Logger = pino(baseConfig)

/**
 * Structured logging helper types
 * Enforces consistent log format across the application
 */
export interface LogContext {
  message: string
  payload?: Record<string, unknown>
  error?: Error | unknown
  [key: string]: unknown
}

/**
 * Utility function for structured error logging
 * Ensures errors are properly serialized with stack traces
 */
export function logError(message: string, error: unknown, payload?: Record<string, unknown>): void {
  const errorObj: Record<string, unknown> = error instanceof Error ? {
    message: error.message,
    stack: error.stack,
    name: error.name,
  } : { error }

  if (error instanceof Error && error.cause !== undefined) {
    errorObj.cause = error.cause
  }

  logger.error({
    message,
    error: errorObj,
    ...(payload && { payload }),
  })
}

/**
 * Utility function for structured info logging
 */
export function logInfo(message: string, payload?: Record<string, unknown>): void {
  logger.info({
    message,
    ...(payload && { payload }),
  })
}

/**
 * Utility function for structured warning logging
 */
export function logWarn(message: string, payload?: Record<string, unknown>): void {
  logger.warn({
    message,
    ...(payload && { payload }),
  })
}

/**
 * Utility function for structured debug logging
 */
export function logDebug(message: string, payload?: Record<string, unknown>): void {
  logger.debug({
    message,
    ...(payload && { payload }),
  })
}

/**
 * Create a child logger with additional context
 * Useful for scoping logs to specific modules or operations
 *
 * @example
 * const routeLogger = createChildLogger({ module: 'api', route: '/checkout' })
 * routeLogger.info('Processing checkout')
 */
export function createChildLogger(context: Record<string, unknown>): Logger {
  return logger.child(context)
}
