import type { UserRecord } from "../models";

export interface IUserRepository {
  findById(id: string): Promise<UserRecord | null>;
  findByEmail(email: string): Promise<UserRecord | null>;
  create(data: {
    id: string;
    email: string;
    roles?: string;
    created_at?: number;
  }): Promise<UserRecord>;
  updateRoles(id: string, rolesJson: string, updatedAt: number): Promise<void>;
  setActive(id: string, isActive: number, updatedAt: number): Promise<void>;
}
