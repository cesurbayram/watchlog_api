export interface UserResponseDto {
  id: string;
  name: string;
  lastName: string;
  userName: string;
  email: string;
  role: string;
  bcryptPassword: string;
}

export interface UserRequestDto {
  id?: string;
  name: string;
  lastName: string;
  userName: string;
  email: string;
  role: string;
  password: string;
}
