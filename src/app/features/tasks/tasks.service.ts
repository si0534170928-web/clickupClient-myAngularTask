import { computed, inject, Injectable, signal } from '@angular/core';
import { map } from 'rxjs';
import { ApiService } from '../../core/services/api.service';
import { NotificationService } from '../../core/services/notification.service';
import { AuthService } from '../../core/services/auth.service';
import { TeamsService } from '../teams/teams.service';
import { Task, CreateTaskDTO, UpdateTaskDTO } from './tasks.DTOs';

@Injectable({
  providedIn: 'root'
})
export class TasksService {
  private api = inject(ApiService);
  private notifications = inject(NotificationService);
  private authService = inject(AuthService);
  private teamsService = inject(TeamsService);

  private _tasks = signal<Task[]>([]);
  private _isLoading = signal(false);

  tasks = this._tasks.asReadonly();
  isLoading = this._isLoading.asReadonly();

  // Computed signal to check if current user is a team leader
  private isTeamLeader = computed(() => {
    const user = this.authService.currentUser();
    if (!user) return false;
    
    // Check if user has global admin/manager role (non-default role)
    if (user.role && user.role !== 'user') return true;
    
    // For now, assume team creators/owners have leadership privileges
    // In a real implementation, we'd need an API endpoint to get user's team roles
    // This is a simplified approach - we could enhance it later with proper team role API
    return false; // Conservative approach: only users with explicit global roles are leaders
  });

  // Role-based filtered tasks - show only assigned tasks for regular users, all for leaders
  private filteredTasks = computed(() => {
    const allTasks = this._tasks();
    const user = this.authService.currentUser();
    const isLeader = this.isTeamLeader();
    
    if (!user || isLeader) {
      return allTasks; // Leaders see all tasks
    }
    
    // Regular users see only their assigned tasks
    return allTasks.filter(task => task.assignee_id === user.id);
  });

  // Computed signals for each kanban column using role-filtered tasks
  todoTasks = computed(() => this.filteredTasks().filter(t => t.status === 'todo'));
  inProgressTasks = computed(() => this.filteredTasks().filter(t => t.status === 'in_progress'));
  doneTasks = computed(() => this.filteredTasks().filter(t => t.status === 'done'));

  // Public computed signals for accessing filtered vs all tasks
  myTasks = this.filteredTasks; // Role-based filtered tasks for "My Tasks" page
  allTasks = this._tasks.asReadonly(); // All tasks for project views

  // Load all tasks and return a specific one by ID
  loadAllTasksAndFind(taskId: number) {
    return this.api.get<Task[]>('/tasks').pipe(
      map(tasks => {
        this._tasks.set(tasks);
        return tasks.find(t => t.id === taskId);
      })
    );
  }

  // Load all tasks for the logged-in user (across all projects)
  // Uses role-based filtering through computed signals
  loadAllTasks(): void {
    this._isLoading.set(true);
    this.api.get<Task[]>('/tasks').subscribe({
      next: (tasks) => { 
        this._tasks.set(tasks); 
        this._isLoading.set(false); 
      },
      error: () => { this._isLoading.set(false); } // handled by interceptor
    });
  }

  // Load tasks for a specific project (always shows ALL project tasks)
  loadProjectTasks(projectId: number): void {
    this.api.get<Task[]>(`/tasks?projectId=${projectId}`).subscribe({
      next: (tasks) => this._tasks.set(tasks),
      error: () => {} // handled by interceptor
    });
  }

  // Helper method to get task counts for UI
  getTaskCounts() {
    return computed(() => ({
      total: this.filteredTasks().length,
      todo: this.todoTasks().length,
      inProgress: this.inProgressTasks().length,
      done: this.doneTasks().length
    }));
  }

  // Helper method to check if current user can see all tasks
  canSeeAllTasks() {
    return this.isTeamLeader;
  }

  // Debug helper - get filtering info (can be removed in production)
  getFilteringInfo() {
    return computed(() => {
      const user = this.authService.currentUser();
      const isLeader = this.isTeamLeader();
      const allTasksCount = this._tasks().length;
      const filteredTasksCount = this.filteredTasks().length;
      
      return {
        userName: user?.name || 'Unknown',
        userRole: user?.role || 'user',
        isTeamLeader: isLeader,
        allTasksCount,
        filteredTasksCount,
        taskFilteringActive: !isLeader && filteredTasksCount < allTasksCount
      };
    });
  }

  createTask(data: CreateTaskDTO): void {
    this.api.post<Task, CreateTaskDTO>('/tasks', data).subscribe({
      next: (task) => {
        this._tasks.update(tasks => [...tasks, task]);
        this.notifications.success('Task created!');
      },
      error: () => this.notifications.error('Failed to create task')
    });
  }

  updateTask(id: number, data: UpdateTaskDTO): void {
    this.api.patch<Task, UpdateTaskDTO>(`/tasks/${id}`, data).subscribe({
      next: (updated) => {
        this._tasks.update(tasks => tasks.map(t => t.id === id ? updated : t));
      },
      error: () => this.notifications.error('Failed to update task')
    });
  }

  deleteTask(id: number): void {
    this.api.delete<void>(`/tasks/${id}`).subscribe({
      next: () => {
        this._tasks.update(tasks => tasks.filter(t => t.id !== id));
        this.notifications.success('Task deleted');
      },
      error: () => this.notifications.error('Failed to delete task')
    });
  }
}
