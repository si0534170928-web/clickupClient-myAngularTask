import { Component, signal, inject } from '@angular/core';
import { RouterOutlet, RouterLink, RouterLinkActive, Router } from '@angular/router';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatListModule } from '@angular/material/list';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatDividerModule } from '@angular/material/divider';
import { MatTooltipModule } from '@angular/material/tooltip';
import { UserMenu } from './shared/components/user-menu/user-menu';
import { Notifications } from './shared/components/notifications/notifications';
import { AuthService } from './core/services/auth.service';

@Component({
  selector: 'app-root',
  imports: [
    RouterOutlet,
    RouterLink,
    RouterLinkActive,
    MatToolbarModule,
    MatListModule,
    MatIconModule,
    MatButtonModule,
    MatDividerModule,
    MatTooltipModule,
    UserMenu,
    Notifications
  ],
  templateUrl: './app.html',
  styleUrl: './app.css'
})
export class App {
  protected readonly title = signal('TaskFlow Pro');
  protected sidebarOpen = signal(true);
  
  private authService = inject(AuthService);
  private router = inject(Router);
  protected isAuthenticated = this.authService.isAuthenticated;

  getCurrentUserName(): string {
    return this.authService.currentUser()?.name || 'User';
  }

  toggleSidebar(): void {
    this.sidebarOpen.set(!this.sidebarOpen());
  }

  logout(): void {
    this.authService.logout().subscribe();
    this.router.navigate(['/auth/login']);
  }
}
