export interface ShiftResponseDto {
  id: string;
  name: string;
  shiftStart: string;
  shiftEnd: string;
  createdAt?: string;
  updatedAt?: string;
  deletedAt?: string;
}

export interface ShiftRequestDto {
  name: string;
  shiftStart: string;
  shiftEnd: string;
}
