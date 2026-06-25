import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { ROLES, ACCESS_LEVELS } from './lib/roles';

function decodeJwtPayload(token: string): any {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const base64Url = parts[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = atob(base64);
    return JSON.parse(jsonPayload);
  } catch (e) {
    return null;
  }
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // 1. Define protected route prefixes
  const isAdminRoute = pathname.startsWith('/admin');
  
  if (!isAdminRoute) {
    return NextResponse.next();
  }

  // 2. Get token from cookies
  const token = request.cookies.get('access_token')?.value;

  if (!token) {
    // Redirect to login if no token
    const url = new URL('/login', request.url);
    url.searchParams.set('callbackUrl', pathname);
    return NextResponse.redirect(url);
  }

  try {
    // 3. Decode JWT (signature verification is enforced by backend API)
    const payload = decodeJwtPayload(token);
    if (!payload) {
      throw new Error('Invalid JWT payload format');
    }
    const userRole = payload.role as string;
    console.log(`MIDDLEWARE DEBUG: Path ${pathname}, Role ${userRole}, Payload: ${JSON.stringify(payload)}`);

    // 4. Perform RBAC checks
    if (isAdminRoute) {
      if (!ACCESS_LEVELS.ADMIN_ONLY.includes(userRole as any)) {
        console.warn(`Unauthorized access attempt to ${pathname} by role ${userRole}`);
        const redirectUrl = new URL('/dashboard', request.url);
        redirectUrl.searchParams.set('role', userRole || 'undefined');
        return NextResponse.redirect(redirectUrl);
      }
    }

    return NextResponse.next();
  } catch (error) {
    console.error('Middleware JWT decoding failed:', error);
    // Clear invalid cookie and redirect
    const response = NextResponse.redirect(new URL('/login', request.url));
    response.cookies.delete('access_token');
    return response;
  }
}

// See "Matching Paths" below to learn more
export const config = {
  matcher: [
    '/admin/:path*',
  ],
};
