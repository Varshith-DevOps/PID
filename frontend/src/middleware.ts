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
export function middleware(request: NextRequest) {
  const token = request.cookies.get('token')?.value || request.headers.get('authorization')?.replace('Bearer ', '');
  const isLoginPage = request.nextUrl.pathname === '/';
  const isDashboard = request.nextUrl.pathname.startsWith('/dashboard');

  if (isDashboard && !token) {
    return NextResponse.redirect(new URL('/', request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico).*)'],
};
