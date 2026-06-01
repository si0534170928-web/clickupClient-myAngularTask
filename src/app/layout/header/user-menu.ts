import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AuthService } from '../../core/services/auth.service';
import { Router } from '@angular/router';

@Component({
  selector: 'app-user-menu',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './user-menu.html',
  styleUrl: './user-menu.css',
})
export class UserMenu {
  private authService = inject(AuthService);
  private router = inject(Router);
  showMenu = signal(false);

  get user() {
    return this.authService.currentUser();
  }

  get userInitial() {
    return this.user?.name?.charAt(0).toUpperCase() || '?';
  }

  toggleMenu() {
    this.showMenu.set(!this.showMenu());
  }

  logout() {
    this.authService.logout().subscribe();
    this.showMenu.set(false);
    this.router.navigate(['/auth/login']);
  }
}
