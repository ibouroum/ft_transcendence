import { useEffect, useState } from "react";
import { SearchComponent, useAppDispatch, useAppSelector } from "../../core";
import AddIcon from "@mui/icons-material/Add";
import styled from "styled-components";
// import "./chat.css";
 
import { Badge } from "@mui/material";
import { convertDateTime, changeMessageLength } from "./Utils/utils";
import { I_DirectConversation, I_Discussion, I_Room } from "./Types/types";
import { ChatBox } from "./ChatBox";
import { CreateChannelModal } from "./channels/modals/CreateChannelModal";
import { getMemberships } from "./channels/redux/roomThunk";
import { getDirectConversations } from "./directMessages/redux/directMessageThunk";
import { setIsConversation } from "../../core/CoreSlice";


export const Chat = () => {
  console.log('Chat Rendring !')
  const dispatch = useAppDispatch();
  const { channels, directMessage, filter } = useAppSelector((state) => state);
  const [conversation, setConversation] = useState<I_Discussion | null>(null);
  useEffect(() => {
    dispatch(getMemberships());
    dispatch(getDirectConversations());
  }, []);

  // Filter chat rooms based on the search query
  const filteredRooms = channels.memberships.filter((item: any) =>
    item.room.name.toLowerCase().includes(filter.searchQuery.toLowerCase())
  );
  // Filter conversations based on the search query
  const filteredConversations = directMessage.conversations.filter(
    (discussion: any) =>
      discussion.receiver.firstName
        .toLowerCase()
        .includes(filter.searchQuery.toLowerCase())
  );

  const handleCLick = (
    type: "direct" | "channel",
    data: I_DirectConversation | I_Room
  ) => {
    setConversation({
      room: type == "channel" ? (data as I_Room) : null,
      direct: type == "direct" ? (data as I_DirectConversation) : null,
      type: type,
    });
    dispatch(setIsConversation(true));
  };


  return (
    <Root>
      <Discussions>
        <TextMessage>Discussions</TextMessage>
        <SearchComponent onInputUpdate={filter.searchQuery} />
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            color: "rgb(94, 53, 177)",
            margin: "0px 10px 0px 10px",
            fontWeight: "900",
          }}
        >
          <p>Channels</p>
          <CreateChannelModal />
        </div>
        <ChannelListHolder>
          {filteredRooms.map((item: any) => (
            <ChannelName
              key={item.room.id}
              className={`channel-name ${
                conversation?.room === item.id ? "selected" : ""
              }`}
              onClick={() => handleCLick("channel", item.room)}
            >
              # {item.room.name}
            </ChannelName>
          ))}
        </ChannelListHolder>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            color: "rgb(94, 53, 177)",
            margin: "0px 10px 0px 10px",
            fontWeight: "900",
          }}
        >
          <p>Direct Messages</p>
          <div>
            <AddIcon style={{ padding: "5px" }} />
          </div>
        </div>
        <DirectMessageListHolder>
          {filteredConversations.map((discussion: any) => (
            <Discussion
              key={discussion.id}
              selected={conversation?.direct === discussion.id}
              onClick={() => handleCLick("direct", discussion)}
            >
              <Badge
                anchorOrigin={{
                  vertical: "bottom",
                  horizontal: "right",
                }}
                color={
                  discussion.receiver.status === "ONLINE"
                    ? "success"
                    : "error"
                }
                overlap="circular"
                variant="dot"
              >
                {discussion.receiver.avatar_url !== null ? 
                (<AvatarImage src={require(`/app/images_uploads/${discussion.receiver.avatar_url}`)} alt="" />) 
                :
                (<AvatarImage src="" alt="" />)
                }
                
              </Badge>
              <ContactDescription>
                <DiscussionName>
                  {discussion.receiver.firstName}{" "}
                  {discussion.receiver.lastName}
                </DiscussionName>
                <DiscussionMessage>
                  {changeMessageLength(discussion.lastMessage.content)}
                </DiscussionMessage>
              </ContactDescription>
              <p style={{ fontSize: 13 }}>
                {convertDateTime(discussion.lastMessage.createdAt)}
              </p>
            </Discussion>
          ))}
        </DirectMessageListHolder>
      </Discussions>
        <ChatBox conversation={conversation} />
    </Root>
  );
};

const Root = styled.div`
  margin: 1vw;
  display: flex;
  background-color: rgb(255, 255, 255);
  border: 1px solid rgba(0, 0, 0, 0.125);
  border-radius: 0.25rem;auto;
  // padding: 0;
  // margin: 5px;
  height: 900px;
  border-radius: 20px:

`;

const Discussions = styled.div`
overflow: hidden;
/* display: inline-block; */
padding: 5px;
border-right:  1px solid #d7d7d7;
`;

const Discussion = styled.div<{selected?: boolean}>`
  display: flex;
  align-items: center;
  justify-content: space-around;
  margin: 10px 0px;
  &:hover {
    cursor: pointer;
    background-color:  #f5f6f7;
  }
  ${(props) =>
    props.selected &&
    `
    /* Add styles for the selected state */
    background-color: #f5f6f7;
  `}
`;


const TextMessage = styled.p`
margin: 10px; /* Remove default margin for <p> tag */
font-size: 40px;
`;

const ChannelListHolder = styled.div`
padding: 0px 15px;
overflow-y: scroll;
max-height: 35%;
`;

const DirectMessageListHolder = styled.div`
  overflow-y: scroll;
  padding: "0px 15px";
  max-height: 35%;
`;

const ChannelName = styled.h4`
  margin: 0px 0px 10px 0px;
  cursor: pointer;
  &:hover{
    background-color:  #f5f6f7;
  }
`;

const AvatarImage = styled.img`
  width: 45px;
  height: 45px;
`;

const IsOnline = styled.div`
  position: relative;
  top: 30px;
  left: 35px;
  width: 13px;
  height: 13px;
  background-color: #8bc34a;
  border-radius: 13px;
  border: 3px solid #fafafa;
`;

const ContactDescription = styled.div`
  max-width: 70%;
`;

const DiscussionName = styled.div`
  margin: 0 0 0 20px;
  font-family: "Montserrat", sans-serif;
  font-size: 11pt;
  color: #515151;
`;

const DiscussionMessage = styled.div`
  margin: 6px 0 0 20px;
  font-family: "Montserrat", sans-serif;
  font-size: 9pt;
  color: #515151;
`;

const Timer = styled.div`
  margin-left: 25%;
  font-family: "Open Sans", sans-serif;
  font-size: 11px;
  padding: 3px 8px;
  color: #bbb;
  background-color: #fff;
  border: 1px solid #e5e5e5;
  border-radius: 15px;
`;
// const boxStyle = {
//   position: "absolute" as "absolute",
//   top: "30%",
//   left: "50%",
//   transform: "translate(-50%, -50%)",
//   width: 400,
//   bgcolor: "background.paper",
//   border: "1px solid #000",
//   boxShadow: 24,
//   p: 4,
//   borderRadius: "20px",
//   height: "400px",
// };
