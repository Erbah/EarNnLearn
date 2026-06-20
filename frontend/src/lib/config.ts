export const PLATFORM_NAME = process.env.NEXT_PUBLIC_PLATFORM_NAME || 'EarNnLearN';
export const PLATFORM_DESCRIPTION = process.env.NEXT_PUBLIC_PLATFORM_DESCRIPTION || 'Standardizing Identity through Decentralized Learning';
export const API_PREFIX = '/api/v1';

// The canonical public URL of the frontend app.
// Set NEXT_PUBLIC_APP_URL in your Railway frontend environment variables
// to the live URL (e.g. https://earnnnlearn.up.railway.app)
// so that share/invite links always point to the live site, not localhost.
export const APP_URL = (process.env.NEXT_PUBLIC_APP_URL || '').replace(/\/$/, '');
