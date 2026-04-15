import ProfileActions from "./actions";
import FollowOA from "./follow-oa";
import UserInfo from "./user-info";

export default function ProfilePage() {
  return (
    <div className="min-h-full bg-background p-4 space-y-2.5">
      <UserInfo>
        {/* Loyalty profile UI disabled until server implements loyalty-profile. */}
      </UserInfo>
      <ProfileActions />
      <FollowOA />
    </div>
  );
}
