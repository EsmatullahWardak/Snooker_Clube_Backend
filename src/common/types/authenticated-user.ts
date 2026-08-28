import { RoleName } from '../../generated/prisma/client';

export interface AuthenticatedUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: RoleName;
  permissions: string[];
}
