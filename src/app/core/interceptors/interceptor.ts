import {
  HttpInterceptorFn,
  HttpErrorResponse,
  HttpRequest,
  HttpHandlerFn,
  HttpEvent,
} from '@angular/common/http';
import { inject } from '@angular/core';
import {
  BehaviorSubject,
  Observable,
  catchError,
  filter,
  switchMap,
  take,
  throwError,
} from 'rxjs';
import { Router } from '@angular/router';

import { AuthService } from '../services/auth.service';
import { NotificationService } from '../services/notification.service';

// ---------------------------------------------------------------------------
// Module-level concurrency guards
//
// Because this is a functional interceptor (a plain function, not a class
// instance), module-level variables act as a singleton — they are initialized
// once when the module is loaded and shared across every invocation of the
// interceptor function for the lifetime of the application.
// ---------------------------------------------------------------------------

/**
 * Set to `true` while a token-refresh HTTP call is in-flight.
 * Prevents N simultaneous 401 responses from triggering N parallel refresh calls.
 */
let isRefreshing = false;

/**
 * Acts as a "waiting room" for requests that received a 401 while a refresh
 * was already in-flight.
 *
 * - Value `null`        → refresh is in-flight; new arrivals should wait.
 * - Value `<token str>` → refresh succeeded; waiting requests are unblocked
 *                         and can retry with the new token.
 */
const refreshTokenSubject = new BehaviorSubject<string | null>(null);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Clones `req` and adds (or replaces) the Authorization header. */
function attachToken(
  req: HttpRequest<unknown>,
  token: string,
): HttpRequest<unknown> {
  return req.clone({ setHeaders: { Authorization: `Bearer ${token}` } });
}

/**
 * Returns `true` for endpoints that carry their own credentials (cookie /
 * plain credentials) and must NOT have an Authorization header injected.
 */
function isAuthEndpoint(url: string): boolean {
  return (
    url.includes('/auth/login') ||
    url.includes('/auth/register') ||
    url.includes('/auth/refresh')
  );
}

// ---------------------------------------------------------------------------
// Exported interceptor
// ---------------------------------------------------------------------------

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const authService = inject(AuthService);
  const notifications = inject(NotificationService);
  const router = inject(Router);

  // 1. Attach the in-memory access token to every non-auth request.
  //    Auth endpoints (/login, /register, /refresh) carry credentials via the
  //    HttpOnly cookie — injecting a Bearer header would be redundant / wrong.
  const token = authService.getAccessToken();
  const outgoingReq =
    token && !isAuthEndpoint(req.url) ? attachToken(req, token) : req;

  // 2. Execute the request; intercept errors for special handling.
  return next(outgoingReq).pipe(
    catchError((error: HttpErrorResponse) => {
      if (error.status === 401 && !isAuthEndpoint(req.url)) {
        // Kick off the refresh flow (with built-in concurrency protection).
        return handle401(
          req,   // pass the ORIGINAL (un-modified) request so we can re-clone it
          next,
          authService,
          notifications,
          router,
        );
      }
      return handleGenericError(error, notifications);
    }),
  );
};

// ---------------------------------------------------------------------------
// 401 handler — token refresh with concurrency queue
// ---------------------------------------------------------------------------

function handle401(
  originalReq: HttpRequest<unknown>,
  next: HttpHandlerFn,
  authService: AuthService,
  notifications: NotificationService,
  router: Router,
): Observable<HttpEvent<unknown>> {
  if (!isRefreshing) {
    // ------------------------------------------------------------------
    // FIRST request to see the 401 — this one drives the refresh call.
    // ------------------------------------------------------------------
    isRefreshing = true;

    // Signal to any concurrent requests arriving now that they should wait.
    refreshTokenSubject.next(null);

    return authService.refreshToken().pipe(
      switchMap((response) => {
        isRefreshing = false;
        const newToken = response.token;

        // Broadcast the new token so every waiting request is unblocked.
        refreshTokenSubject.next(newToken);

        // Retry the original request with the fresh access token.
        return next(attachToken(originalReq, newToken)) as Observable<HttpEvent<unknown>>;
      }),
      catchError((refreshError) => {
        // ------------------------------------------------------------------
        // Refresh token is expired or revoked — the session is fully dead.
        // ------------------------------------------------------------------
        isRefreshing = false;

        // Wipe all in-memory auth state.
        authService.clearSession();

        notifications.error('Your session has expired. Please log in again.');
        router.navigate(['/auth/login']);

        return throwError(() => refreshError);
      }),
    );
  } else {
    // ------------------------------------------------------------------
    // SUBSEQUENT requests — a refresh is already in-flight.
    // Block here and wait for `refreshTokenSubject` to emit a real token.
    // ------------------------------------------------------------------
    return refreshTokenSubject.pipe(
      // Ignore the `null` that was set at the start of the refresh.
      filter((token): token is string => token !== null),
      // Take only the first emission (the new access token).
      take(1),
      // Retry this request using the new token emitted by the first request.
      switchMap((token) => next(attachToken(originalReq, token)) as Observable<HttpEvent<unknown>>),
    );
  }
}

// ---------------------------------------------------------------------------
// Generic error handler (non-401 errors)
// ---------------------------------------------------------------------------

function handleGenericError(
  error: HttpErrorResponse,
  notifications: NotificationService,
): Observable<never> {
  switch (error.status) {
    case 403:
      notifications.error('You do not have permission to perform this action.');
      break;
    case 404:
      notifications.error('The requested resource was not found.');
      break;
    case 500:
      notifications.error('A server error occurred. Please try again later.');
      break;
    case 0:
      notifications.error(
        'Cannot connect to the server. Please check your connection.',
      );
      break;
  }
  return throwError(() => error);
}
