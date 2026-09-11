// I have nothing but my burger and I want nothing more
import type { IDeviceCodeRepository } from "./device.repository";
import type { IMagicLinkRepository } from "./magic-link.repository";
import type { IOAuthRepository } from "./oauth.repository";
import type { IRefreshTokenRepository } from "./token.repository";
import type { IUserRepository } from "./user.repository";

export interface IDatabase {
  readonly users: IUserRepository;
  readonly magicLinks: IMagicLinkRepository;
  readonly tokens: IRefreshTokenRepository;
  readonly oauth: IOAuthRepository;
  readonly deviceCodes: IDeviceCodeRepository;

  init(): Promise<void>;
  close(): Promise<void>;
}
