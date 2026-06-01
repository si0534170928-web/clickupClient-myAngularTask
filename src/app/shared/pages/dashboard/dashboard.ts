import { Component, inject } from '@angular/core';
import { Router } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { AuthService } from '../../../core/services/auth.service';

@Component({
  selector: 'app-dashboard',
  imports: [MatIconModule],
  templateUrl: './dashboard.html',
  styleUrl: './dashboard.css',
})
export class Dashboard {
  private router = inject(Router);
  private authService = inject(AuthService);
  
  get isAuthenticated() {
    return this.authService.isAuthenticated();
  }
  
  // ניווט לעמוד צוותים
  goToTeams() {
    this.router.navigate(['/teams']);
  }
  
  // ניווט לעמוד משימות
  goToTasks() {
    this.router.navigate(['/tasks']);
  }
  
  // קבלת שם המשתמש
  get userName() {
    const user = this.authService.currentUser();
    return user?.name || 'Guest';
  }
}
