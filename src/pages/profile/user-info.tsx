import { UserInfoSkeleton } from "@/components/skeleton";
import TransitionLink from "@/components/transition-link";
import { loadableUserInfoState } from "@/state";
import { useAtomValue } from "jotai";
import { PropsWithChildren, useState } from "react";
import { Icon } from "zmp-ui";
import Register from "./register";
import { DEFAULT_AVATAR_URL } from "@/lib/medusa-sdk";

function UserInfo({ children }: PropsWithChildren) {
  const userInfo = useAtomValue(loadableUserInfoState);

  if (userInfo.state === "hasData" && userInfo.data) {
    const { name, avatar, phone } = userInfo.data;
    const [imgSrc, setImgSrc] = useState<string>(avatar || DEFAULT_AVATAR_URL);

    return (
      <>
        <div className="bg-section rounded-lg p-4 flex items-center space-x-4 border-[0.5px] border-black/15">
          <img
            className="rounded-full h-10 w-10 object-cover"
            src={imgSrc}
            alt={name || "User avatar"}
            onError={() => {
              if (imgSrc !== DEFAULT_AVATAR_URL) setImgSrc(DEFAULT_AVATAR_URL);
            }}
          />
          <div className="space-y-0.5 flex-1 overflow-hidden">
            <div className="text-lg truncate">{name}</div>
            <div className="text-sm text-subtitle truncate">{phone}</div>
          </div>
          <TransitionLink to="/profile/edit">
            <Icon icon="zi-edit-text" />
          </TransitionLink>
        </div>
        {children}
      </>
    );
  }

  if (userInfo.state === "loading") {
    return <UserInfoSkeleton />;
  }

  return <Register />;
}

export default UserInfo;
