export interface Team {
  id: string;
  name: string;
  loginCode: string; // unique code for team login (e.g., "TEAM001")
  members: string[]; // student names
  gameId: string;
}
