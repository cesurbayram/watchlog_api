export interface UserResponseDto {
  id: string;
  name: string;
  lastName: string;
  userName: string;
  email: string;
  role: string;
  bcryptPassword: string;
  roleId?: string;
  roleName?: string;
  controllerIds: string[];
}

export interface UserRequestDto {
  id?: string;
  name: string;
  lastName: string;
  userName: string;
  email: string;
  role: string;
  password: string;
  controllerIds: string[];
}
