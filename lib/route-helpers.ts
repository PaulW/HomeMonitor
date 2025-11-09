/**
 * Route Helper Utilities
 * 
 * Common utilities for Express route handlers to reduce boilerplate:
 * - Async error handling wrapper
 * - Request validation
 * - Response formatting
 * 
 * @module lib/route-helpers
 */

import { Request, Response, NextFunction, RequestHandler } from 'express';

/**
 * Wraps async route handlers to catch errors and pass to Express error handler
 * 
 * Eliminates the need for try-catch blocks in every route handler.
 * Any errors thrown in the async handler will be automatically caught
 * and passed to Express's error handling middleware.
 * 
 * @param fn - Async route handler function
 * @returns Wrapped route handler with error catching
 * 
 * @example
 * router.get('/api/data', asyncHandler(async (req, res) => {
 *   const data = await fetchData(); // Errors automatically caught
 *   res.json(data);
 * }));
 */
export function asyncHandler(fn: RequestHandler): RequestHandler {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

/**
 * Sends a successful JSON response with consistent structure
 * 
 * @param res - Express Response object
 * @param data - Data to include in response
 * @param message - Optional success message
 * 
 * @example
 * sendSuccess(res, { devices: [] }, 'Devices loaded successfully');
 * // Returns: { success: true, devices: [], message: '...' }
 */
export function sendSuccess(res: Response, data: Record<string, any> = {}, message?: string): void {
  res.json({
    success: true,
    ...data,
    ...(message && { message }),
  });
}

/**
 * Sends an error JSON response with consistent structure
 * 
 * Extracts error message from Error objects, uses fallback for unknown errors.
 * Automatically sets appropriate HTTP status code.
 * 
 * @param res - Express Response object
 * @param error - Error object or message
 * @param statusCode - HTTP status code (default: 500)
 * 
 * @example
 * sendError(res, new Error('Not found'), 404);
 * // Returns: { success: false, error: 'Not found' } with status 404
 */
export function sendError(res: Response, error: unknown, statusCode: number = 500): void {
  const message = error instanceof Error ? error.message : String(error);
  res.status(statusCode).json({
    success: false,
    error: message,
  });
}

/**
 * Validates that required fields exist in request body
 * 
 * @param body - Request body to validate
 * @param requiredFields - Array of required field names
 * @throws {Error} If any required field is missing or null/undefined
 * 
 * @example
 * validateRequiredFields(req.body, ['username', 'password']);
 */
export function validateRequiredFields(
  body: Record<string, any>,
  requiredFields: string[]
): void {
  const missing = requiredFields.filter(
    field => body[field] === undefined || body[field] === null || body[field] === ''
  );
  
  if (missing.length > 0) {
    throw new Error(`Missing required fields: ${missing.join(', ')}`);
  }
}

/**
 * Validates a number is within specified range
 * 
 * @param value - Number to validate
 * @param min - Minimum allowed value (inclusive)
 * @param max - Maximum allowed value (inclusive)
 * @param fieldName - Name of field for error message
 * @throws {Error} If value is outside range
 * 
 * @example
 * validateNumberRange(req.body.temperature, 5, 35, 'temperature');
 */
export function validateNumberRange(
  value: number,
  min: number,
  max: number,
  fieldName: string
): void {
  if (isNaN(value) || value < min || value > max) {
    throw new Error(`${fieldName} must be between ${min} and ${max}`);
  }
}

/**
 * Parses and validates an integer from request body
 * 
 * @param value - Value to parse
 * @param defaultValue - Default value if parsing fails
 * @param min - Optional minimum value
 * @param max - Optional maximum value
 * @returns Parsed integer
 * @throws {Error} If value is outside min/max range
 * 
 * @example
 * const deviceId = parseIntSafe(req.body.deviceId, 0, 1, 9999);
 */
export function parseIntSafe(
  value: any,
  defaultValue: number,
  min?: number,
  max?: number
): number {
  const parsed = parseInt(value);
  
  if (isNaN(parsed)) {
    return defaultValue;
  }
  
  if (min !== undefined && parsed < min) {
    throw new Error(`Value must be at least ${min}`);
  }
  
  if (max !== undefined && parsed > max) {
    throw new Error(`Value must be at most ${max}`);
  }
  
  return parsed;
}

/**
 * Parses and validates a float from request body
 * 
 * @param value - Value to parse
 * @param defaultValue - Default value if parsing fails
 * @param min - Optional minimum value
 * @param max - Optional maximum value
 * @returns Parsed float
 * @throws {Error} If value is outside min/max range
 * 
 * @example
 * const temperature = parseFloatSafe(req.body.temp, 20.0, 5.0, 35.0);
 */
export function parseFloatSafe(
  value: any,
  defaultValue: number,
  min?: number,
  max?: number
): number {
  const parsed = parseFloat(value);
  
  if (isNaN(parsed)) {
    return defaultValue;
  }
  
  if (min !== undefined && parsed < min) {
    throw new Error(`Value must be at least ${min}`);
  }
  
  if (max !== undefined && parsed > max) {
    throw new Error(`Value must be at most ${max}`);
  }
  
  return parsed;
}
