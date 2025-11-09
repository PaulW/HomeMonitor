/**
 * Template Rendering Utility
 * 
 * Centralizes HTML template rendering for plugins.
 * Uses the server's layout system to wrap plugin templates in the main layout.
 * 
 * @module lib/template-renderer
 */

import { Request, Response } from 'express';
import { readFile } from 'fs/promises';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * Renders an HTML template for a plugin page using server's template system
 * 
 * @param pluginName - Name of the plugin (e.g., 'evohome', 'mydevice')
 * @param templateName - Name of template file (without .html extension)
 * @param title - Page title for browser tab and layout
 * @param req - Express Request object
 * @param res - Express Response object
 * @param logger - Optional logging function for errors
 * @throws {Error} If template rendering fails
 * 
 * @example
 * await renderPluginTemplate('evohome', 'dashboard', 'EvoHome Dashboard', req, res);
 */
export async function renderPluginTemplate(
  pluginName: string,
  templateName: string,
  title: string,
  req: Request,
  res: Response,
  logger?: (message: string) => void
): Promise<void> {
  try {
    // Construct path to template file
    // From lib/ -> ../plugins/{pluginName}/web/templates/{templateName}.html
    const templatePath = join(
      __dirname,
      '..',
      'plugins',
      pluginName,
      'web',
      'templates',
      `${templateName}.html`
    );
    
    // Read template content
    const templateContent = await readFile(templatePath, 'utf-8');

    // Get server's template helpers from app.locals
    const renderWithLayout = req.app.locals.renderWithLayout;
    const getPlugins = req.app.locals.getPlugins;
    
    if (!renderWithLayout || !getPlugins) {
      throw new Error('Server template helpers not available');
    }
    
    // Render template with layout
    const html = await renderWithLayout(templateContent, title, getPlugins());
    res.send(html);
    
  } catch (error) {
    const errorMsg = `Failed to render ${pluginName} template ${templateName}: ${
      error instanceof Error ? error.message : String(error)
    }`;
    
    if (logger) {
      logger(errorMsg);
    }
    
    res.status(500).send('Failed to render page');
  }
}
