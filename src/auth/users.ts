export type Role = 'admin' | 'supervisor' | 'asesor';

export interface User {
  username: string;
  role: Role;
}

/**
 * In-memory test users. There is no persistence layer for users: this
 * assessment only requires role-based access control, not a user entity.
 */
export const USERS: User[] = [
  { username: 'admin1', role: 'admin' },
  { username: 'supervisor1', role: 'supervisor' },
  { username: 'asesor1', role: 'asesor' },
  { username: 'asesor2', role: 'asesor' },
];

export function findUserByUsername(username: string): User | undefined {
  return USERS.find((user) => user.username === username);
}
