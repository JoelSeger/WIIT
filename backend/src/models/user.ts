export interface User {
<<<<<<< Updated upstream
  id: number,
  ad_object_id: string,
  username: string,
  display_name: string,
  email: string,
  is_active: boolean | null, // is bit in the db but that translates to an int thats 1, 0 or null.
  last_login_at: Date,
  created_at: Date,
=======
  id: number;
  adObjectId: string;
  username: string;
  displayName: string | null;
  email: string | null;
  isActive: boolean | null;
  lastLoginAt: Date | null;
  createdAt: Date;
>>>>>>> Stashed changes
}
