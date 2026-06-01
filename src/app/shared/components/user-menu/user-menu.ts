import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AuthService } from '../../../core/services/auth.service';
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

  get isAuthenticated() {
    return this.authService.isAuthenticated();
  }

  get userInitial() {
    if (!this.user?.name) return '👤';
    
    const nameParts = this.user.name.trim().split(' ').filter(part => part.length > 0);
    if (nameParts.length === 0) return '👤';
    
    if (nameParts.length === 1) {
      // Only one name part, take first two letters
      return nameParts[0].substring(0, 2).toUpperCase();
    }
    
    // Take first letter of first name and first letter of last name
    const firstInitial = nameParts[0].charAt(0).toUpperCase();
    const lastInitial = nameParts[nameParts.length - 1].charAt(0).toUpperCase();
    return `${firstInitial}${lastInitial}`;
  }

  toggleMenu() {
    this.showMenu.set(!this.showMenu());
  }

  logout() {
    this.authService.logout().subscribe();
    this.showMenu.set(false);
    this.router.navigate(['/auth/login']);
  }

  goToLogin() {
    this.showMenu.set(false);
    this.router.navigate(['/auth/login']);
  }

  goToRegister() {
    this.showMenu.set(false);
    this.router.navigate(['/auth/register']);
  }
}
