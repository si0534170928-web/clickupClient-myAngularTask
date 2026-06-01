import { Component, inject } from '@angular/core';
import { Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatChipsModule } from '@angular/material/chips';
import { TasksService } from '../../tasks.service';
import { AuthService } from '../../../../core/services/auth.service';
import { Task } from '../../tasks.DTOs';

@Component({
  selector: 'app-tasks',
  standalone: true,
  imports: [CommonModule, MatCardModule, MatIconModule, MatButtonModule, MatChipsModule],
  templateUrl: './tasks.html',
  styleUrl: './tasks.css',
})
export class Tasks {
  private tasksService = inject(TasksService);
  private authService = inject(AuthService);
  private router = inject(Router);

  // Use role-filtered tasks for "My Tasks" view
  todoTasks = this.tasksService.todoTasks;
  inProgressTasks = this.tasksService.inProgressTasks;
  doneTasks = this.tasksService.doneTasks;
  isLoading = this.tasksService.isLoading;
  
  // Display current user info and filtering status
  currentUser = this.authService.currentUser;
  canSeeAllTasks = this.tasksService.canSeeAllTasks();

  constructor() {
    this.tasksService.loadAllTasks();
  }

  onTaskClick(task: Task) {
    this.router.navigate(['/projects', task.project_id, 'tasks', task.id]);
  }

  getPriorityColor(priority: string): string {
    const colors: Record<string, string> = {
      high: 'warn',
      normal: 'primary',
      low: 'accent'
    };
    return colors[priority] ?? 'primary';
  }
}