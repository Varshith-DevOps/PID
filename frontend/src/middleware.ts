/**
 * @fileoverview Next.js route protection middleware.
 * Intercepts incoming dashboard requests to verify authentication token cookie/headers.
 * Redirects unauthenticated users to the login/landing page.
 * @module middleware
 */

import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

/**
 * Route protection middleware function.
 * Ensures that any dashboard route is gated by checking for a valid token cookie.
 *
 * @param {NextRequest} request - Incoming request object
 * @returns {NextResponse} Redirects or continues the routing pipeline
 */
function decodeJWT(token: string) {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const payload = parts[1];
    // Base64URL decode the payload
    const decoded = atob(payload.replace(/-/g, '+').replace(/_/g, '/'));
    return JSON.parse(decoded);
  } catch (e) {
    return null;
  }
}

export function middleware(request: NextRequest) {
  const token = request.cookies.get('token')?.value || request.headers.get('authorization')?.replace('Bearer ', '');
  const isDashboard = request.nextUrl.pathname.startsWith('/dashboard');

  if (isDashboard) {
    if (!token) {
      return NextResponse.redirect(new URL('/', request.url));
    }
    const decoded = decodeJWT(token);
    if (!decoded || !decoded.exp || decoded.exp * 1000 < Date.now()) {
      const response = NextResponse.redirect(new URL('/', request.url));
      response.cookies.delete('token');
      return response;
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico).*)'],
};
