import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  Loading,
  Relationship,
  useAppDispatch,
  useAppSelector,
} from "../../core";
import {
  ProfileState,
  getuserasgamer,
  getLeaderboard,
  BoardCard,
  AchievemetsCard,
  MatchsHistoryCard,
  UserCard,
} from "./components";
import { ProfileCards, Button } from "./styles";
import { Alert } from "@mui/material";

const Profile = () => {
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  const _uid = useParams<{ uid: string }>();
  const [start, setStart] = useState(false);

  const intraId = useAppSelector((state) => state.auth.user.intraId);
  const uid: number =
    typeof _uid.uid === "string" ? parseInt(_uid.uid, 10) : intraId;
  const isOwner: boolean = intraId === uid;

  const profileStates: ProfileState = useAppSelector((state) => state.profile);
  const Go: boolean = !useAppSelector(
    ({ profile }) =>
      profile.isLoading || profile.lead.isLoading || profile.matchs.isLoading
  );

  const user = profileStates.gamer.user;
  useEffect(() => {
    dispatch(getuserasgamer(uid));
    dispatch(getLeaderboard());
    setStart(true);
  }, []);

  if (!start) return <Loading />;
  if ((Go && !user) || uid < 1)
    return (
      <>
        user not found
        <Button onClick={() => navigate("/")}>go to home Page</Button>
      </>
    );

  return (
    <Relationship
      ifNORelation
      relations={["blocked", "blockedMe"]}
      opId={uid}
      isOwner={isOwner}
      notallow={
        <Alert severity="error">
          You are `NOT ALLOW` to see the history of this user
        </Alert>
      }
    >
      {!Go ? (
        <Loading />
      ) : (
        <ProfileCards>
          <UserCard gamer={profileStates.gamer} isOwner={isOwner} />
          <BoardCard />
          <MatchsHistoryCard
            uid={uid}
            matchs={profileStates.matchs.matchsHistory}
            userName={user.userName}
          />
          <AchievemetsCard
            achivs={profileStates.achievement}
            userName={user.userName}
          />
        </ProfileCards>
      )}
    </Relationship>
  );
};

/**
 *  Profile Component
 *
 * The Profile component is responsible for rendering and displaying user profile information.
 * It typically receives user data as props and presents it in a structured format.
 * This component can be used to show details such as the user's name, profile picture, bio,
 * and other relevant information.
 *
 **/
export { Profile };
