import { BaseDomainEvent } from "@packages/ddd-kit";

interface UserEmailVerifiedPayload {
  userId: string;
  email: string;
  verifiedAt: Date;
}

export class UserEmailVerifiedEvent extends BaseDomainEvent<UserEmailVerifiedPayload> {
  readonly eventType = "user.email_verified";
  readonly aggregateId: string;
  readonly payload: UserEmailVerifiedPayload;

  constructor(userId: string, email: string) {
    super();
    this.aggregateId = userId;
    this.payload = {
      userId,
      email,
      verifiedAt: new Date(),
    };
  }
}
