import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { jwtVerify } from 'jose';
import { ROLES, ACCESS_LEVELS } from './lib/roles';

// The secret must be the same as the backend's SECRET_KEY
// In a real app, this would be an environment variable
const SECRET = new TextEncoder().encode(process.env.JWT_SECRET);
if (!process.env.JWT_SECRET) {
  console.warn("JWT_SECRET environment variable is not set! Middleware security may be compromised.");
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
    // 3. Verify JWT using jose (Edge-compatible)
    const { payload } = await jwtVerify(token, SECRET);
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
    console.error('Middleware JWT verification failed:', error);
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
