export interface RelationType {
  id: number;
  code: string;
  name: string;
<<<<<<< Updated upstream
  inverseName: string;
  eadElement: string;
=======
  inverseName: string | null;
  eadElement: string | null;
>>>>>>> Stashed changes
  isActive: boolean | null;
}
