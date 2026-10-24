export interface User {
  id: number;
  adObjectId: string;
  username: string;
  displayName: string | null;
  email: string | null;
  isActive: boolean | null;
  lastLoginAt: Date | null;
  createdAt: Date;
}
