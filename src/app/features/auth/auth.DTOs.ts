import { User } from '../../core/DTOs/user.model';

export interface RegisterDTO{
    name:string;
    email:string;
    password:string;
}
export interface loginDTO
{
    email:string;
    password:string;
}  
export interface AuthResponseDTO{
    user:User;
    token:string;
}
export interface RefreshResponseDTO {
  token: string;
}
