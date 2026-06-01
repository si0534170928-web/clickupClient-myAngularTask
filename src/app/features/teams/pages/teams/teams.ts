import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { TeamsService } from '../../teams.service';
import { TeamsList } from '../../components/teams-list/teams-list';
import { ActionButton } from '../../../../shared/components/action-button/action-button';
import { TeamForm, CreateTeamDTO } from '../../components/team-form/team-form';
import { AddMemberForm } from '../../components/add-member-form/add-member-form';
import { Team, AddMemberDTO } from '../../teams.DTOs';
import { AuthService } from '../../../../core/services/auth.service';
import { tap } from 'rxjs';

@Component({
  selector: 'app-teams',
  standalone: true,
  imports: [CommonModule, MatCardModule, MatIconModule, TeamsList, ActionButton, TeamForm, AddMemberForm],
  templateUrl: './teams.html',
  styleUrl: './teams.css',
})
export class Teams {
  private teamsService = inject(TeamsService);
  private authService = inject(AuthService);
  private router = inject(Router);
  teams = this.teamsService.teams;
  isLoading = signal(false);
  showCreateModal = signal(false);
  showAddMemberModal = signal(false);
  isCreating = signal(false);
  isAddingMember = signal(false);
  selectedTeam = signal<Team | null>(null);
  
  // Success and error message signals
  successMessage = signal<string>('');
  errorMessage = signal<string>('');

  constructor() {
    // Initialize data if not already loaded
    if (this.teams().length === 0) {
      this.isLoading.set(true);
      this.teamsService.getTeams().subscribe({
        next: () => this.isLoading.set(false),
        error: (error: any) => {
          this.isLoading.set(false);
          console.error('Error loading teams:', error);
        }
      });
    }
  }

  canAddMembers(): boolean {
    const user = this.authService.currentUser();
    // Allow global admins to add members to any team
    return user?.role === 'admin';
  }

  onTeamSelected(team: Team) {
    this.router.navigate(['/projects'], { queryParams: { teamId: team.id } });
  }

  onCreateTeam() {
    this.showCreateModal.set(true);
  }

  onAddMember(team: Team) {
    if (!this.canAddMembers()) {
      this.errorMessage.set('You need admin privileges to add members to teams.');
      this.clearMessagesAfterDelay();
      return;
    }
    this.selectedTeam.set(team);
    this.showAddMemberModal.set(true);
  }

  onCloseCreateModal() {
    this.showCreateModal.set(false);
  }

  onSubmitTeamForm(data: CreateTeamDTO) {
    this.isCreating.set(true);
    this.teamsService.createTeam(data).subscribe({
      next: () => {
        this.isCreating.set(false);
        this.showCreateModal.set(false);
        console.log('Team created successfully');
      },
      error: (error: any) => {
        this.isCreating.set(false);
        console.error('Error creating team:', error);
      }
    });
  }

  onSubmitAddMemberForm(data: AddMemberDTO) {
    const team = this.selectedTeam();
    if (!team) return;

    if (!data.userId) return;

    this.isAddingMember.set(true);

    this.teamsService.addMember(team.id, { userId: data.userId, role: 'member' })
      .subscribe({
      next: () => {
        this.isAddingMember.set(false);
        this.showAddMemberModal.set(false);
        this.selectedTeam.set(null);
        this.successMessage.set('Member added successfully!');
        this.clearMessagesAfterDelay();
        console.log('Member added successfully');
      },
      error: (error: any) => {
        this.isAddingMember.set(false);
        console.error('Error adding member:', error);
        
        // Provide specific error messages based on error status
        if (error.status === 404) {
          this.errorMessage.set('User not found. Please make sure the email is registered in the system.');
        } else if (error.status === 409) {
          this.errorMessage.set('This user is already a member of the team.');
        } else if (error.status === 403) {
          this.errorMessage.set('You do not have permission to add members to this team.');
        } else if (error.status === 400) {
          this.errorMessage.set('Bad request. Please try again.');
        } else {
          this.errorMessage.set('Failed to add member. Please try again later.');
        }
        this.clearMessagesAfterDelay();
      }
    });
  }

  onCloseAddMemberModal() {
    this.showAddMemberModal.set(false);
    this.selectedTeam.set(null);
    this.clearMessages();
  }
  
  private clearMessages() {
    this.successMessage.set('');
    this.errorMessage.set('');
  }
  
  private clearMessagesAfterDelay() {
    setTimeout(() => {
      this.clearMessages();
    }, 5000); // Clear messages after 5 seconds
  }
}
