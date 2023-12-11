import { useNavigate } from "react-router-dom";
import { CheckCircle, DoNotDisturbOn, Dangerous } from "@mui/icons-material";
import { Avatar, Match, Matchshistory, Text } from "../styles";
import { MatchHistoryType } from "./statsType";

const MatchsHistoryCard = (props: {
  userName: string;
  uid: number;
  matchs: MatchHistoryType[];
}) => {
  const { userName, matchs, uid } = props;
  const getresult = (one: number, two: number, results: Array<any>) =>
    one > two ? results[0] : one < two ? results[1] : results[2];
  const navigate = useNavigate();

  return (
    <Matchshistory onClick={() => navigate(`/gamesHistory?uid=${uid}`)}>
      <Text
        variant="h5"
        sx={{
          width: "100%",
          textAlignLast: "center",
          fontSize: "19px",
          fontFamily: "monospace",
          fontWeight: "bolder",
        }}
      >
        {`${userName.slice(0, 8)}'s Last Matches`}
      </Text>
      {matchs && matchs.length ? (
        matchs.map(
          (item, index) =>
            index < 5 && (
              <Match
                win={getresult(item.gain, item.nogain, [
                  "#2fa025b8",
                  "#b0141495",
                  "#3b4243b7",
                ])}
              >
                <Avatar
                  sx={{ width: 60, height: 60, mb: 2 }}
                  alt="we"
                  src={`/images/${item.pic}`}
                />
                <Text> {item.name} </Text>
                <p> {`${item.gain} : ${item.nogain}`} </p>
                {getresult(item.gain, item.nogain, [
                  <CheckCircle color="success" />,
                  <DoNotDisturbOn color="error" />,
                  <Dangerous color="disabled" />,
                ])}
              </Match>
            )
        )
      ) : (
        <div
          style={{
            textAlign: "center",
            lineHeight: "35px",
            fontFamily: "Roboto, sans-serif",
          }}
        >
          No match palyed yet <br /> Play to see your history
        </div>
      )}
    </Matchshistory>
  );
};

export default MatchsHistoryCard;
