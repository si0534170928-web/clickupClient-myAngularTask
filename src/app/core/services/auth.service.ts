import { inject, Injectable, signal, computed } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, tap } from 'rxjs';
import { type RefreshResponseDTO ,type loginDTO, type RegisterDTO, type AuthResponseDTO } from '../../features/auth/auth.DTOs';
import { User } from '../DTOs/user.model';
import { environment } from '../../enviroment/environment.development';

/**
 * Shape of the response body from POST /api/auth/refresh.
 * The refresh token itself is never exposed here — the browser manages it
 * automatically as an HttpOnly cookie.
 */
@Injectable({
  providedIn: 'root',
})
export class AuthService {
  // -------------------------------------------------------------------------
  // Dependencies
  // -------------------------------------------------------------------------

  /**
   * Use HttpClient directly (not ApiService) for every auth endpoint so we can
   * pass `withCredentials: true` — required for the browser to attach / receive
   * the HttpOnly refresh-token cookie on cross-origin requests.
   */
  private readonly http = inject(HttpClient);
  private readonly baseUrl = environment.apiUrl;

  // -------------------------------------------------------------------------
  // In-memory state  (NEVER written to localStorage / sessionStorage)
  // -------------------------------------------------------------------------

  /**
   * The current short-lived access token held purely in JavaScript memory.
   * Storing it here (instead of Web Storage) eliminates the XSS attack surface
   * where malicious scripts could steal the token.
   * The value is wiped on logout, refresh failure, or full page reload.
   */
  private readonly _accessToken = signal<string | null>(null);

  /** The authenticated user's profile, kept in-memory alongside the token. */
  private readonly _currentUser = signal<User | null>(null);

  // -------------------------------------------------------------------------
  // Public reactive state
  // -------------------------------------------------------------------------

  /** Read-only view of the current user for use in templates and other services. */
  readonly currentUser = this._currentUser.asReadonly();

  /**
   * Computed signal — `true` only when BOTH an access token AND a user profile
   * are present in memory.  Drives route guards and UI visibility.
   */
  readonly isAuthenticated = computed(
    () => this._accessToken() !== null && this._currentUser() !== null,
  );

  // -------------------------------------------------------------------------
  // Token accessors — called exclusively by the AuthInterceptor
  // -------------------------------------------------------------------------

  /** Returns the current in-memory access token (synchronous read). */
  getAccessToken(): string | null {
    return this._accessToken();
  }

  /**
   * Called by the interceptor after a successful token refresh to update the
   * in-memory token so all subsequent requests use the new value.
   */
  setAccessToken(token: string | null): void {
    this._accessToken.set(token);
  }

  // -------------------------------------------------------------------------
  // Auth methods
  // -------------------------------------------------------------------------

  /**
   * Registers a new account.
   * `withCredentials: true` allows the server to set the initial HttpOnly
   * refresh-token cookie in its Set-Cookie response header.
   */
  register(data: RegisterDTO): Observable<AuthResponseDTO> {
    return this.http
      .post<AuthResponseDTO>(`${this.baseUrl}/auth/register`, data, {
        withCredentials: true,
      })
      .pipe(
        tap((response) => {
          // `response.token` is the ACCESS token — store in memory only.
          this._accessToken.set(response.token);
          this._currentUser.set(response.user);
        }),
      );
  }

  /**
   * Authenticates an existing user.
   *
   * - The server responds with:
   *   • `body.token`  — the short-lived access token  (stored IN MEMORY here)
   *   • `Set-Cookie`  — the long-lived HttpOnly refresh token cookie
   *                     (managed entirely by the browser, invisible to JS)
   * - `withCredentials: true` is required for the browser to persist that cookie.
   */
  login(data: loginDTO): Observable<AuthResponseDTO> {
    return this.http
      .post<AuthResponseDTO>(`${this.baseUrl}/auth/login`, data, {
        withCredentials: true,
      })
      .pipe(
        tap((response) => {
          this._accessToken.set(response.token);
          this._currentUser.set(response.user);
        }),
      );
  }

  /**
   * Logs the user out.
   *
   * The POST to `/auth/logout` tells the server to invalidate (revoke) the
   * refresh token stored in its database.  `withCredentials: true` sends the
   * HttpOnly cookie so the server can identify which token to revoke.
   *
   * Local state is always cleared — even if the server call fails — so the
   * user is never stuck in a broken half-logged-in state.
   *
   * IMPORTANT: callers must `.subscribe()` to this observable to trigger the
   * HTTP request.  Example:
   *   `this.authService.logout().subscribe();`
   */
  logout(): Observable<void> {
    return this.http
      .post<void>(`${this.baseUrl}/auth/logout`, {}, { withCredentials: true })
      .pipe(
        tap({
          next: () => this.clearSession(),
          // Always wipe local state even when the network call fails, so the
          // user is not left in a permanently locked-out state.
          error: () => this.clearSession(),
        }),
      );
  }

  /**
   * Silently exchanges the HttpOnly refresh-token cookie for a fresh access token.
   *
   * - Called automatically by the AuthInterceptor on every 401 response.
   * - Can also be called on app startup (`APP_INITIALIZER`) to restore a
   *   session after a page reload without requiring the user to log in again.
   * - `withCredentials: true` is what causes the browser to attach the cookie.
   *   No manual cookie reading or writing is needed.
   */
  refreshToken(): Observable<RefreshResponseDTO> {
    return this.http
      .post<RefreshResponseDTO>(
        `${this.baseUrl}/auth/refresh`,
        {},
        { withCredentials: true },
      )
      .pipe(
        tap((response) => {
          // Store the new access token in memory.
          this._accessToken.set(response.token);
        }),
      );
  }

  /**
   * Convenience wrapper around `refreshToken()` intended for use in an
   * `APP_INITIALIZER` to silently restore a session on page load.
   *
   * Usage in app.config.ts:
   * ```
   * {
   *   provide: APP_INITIALIZER,
   *   useFactory: (auth: AuthService) => () => auth.restoreSession().pipe(catchError(() => of(null))),
   *   deps: [AuthService],
   *   multi: true,
   * }
   * ```
   */
  restoreSession(): Observable<RefreshResponseDTO> {
    return this.refreshToken();
  }

  // -------------------------------------------------------------------------
  // Internal helpers
  // -------------------------------------------------------------------------

  /**
   * Wipes all in-memory auth state immediately.
   * Does NOT make any HTTP call — use `logout()` for a full server-side logout.
   */
  clearSession(): void {
    this._accessToken.set(null);
    this._currentUser.set(null);
  }
}
