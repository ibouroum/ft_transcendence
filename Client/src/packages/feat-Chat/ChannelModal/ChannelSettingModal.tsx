import { useEffect, useState } from 'react'
import { Person, LogoutRounded, Close, PersonAddAltRounded } from '@mui/icons-material';
import { Box, Modal } from '@mui/material';
import "./channelSettingModal.css"
import { SearchComponent, useAppDispatch, useAppSelector } from '../../../core';
import { getDirectConversations } from '../components/conversations/conversationThunk';

// interface conversation {
//         id: number,
//         createdAt: string,
//         type: string,
//         messages: [],
//         participants: [] | undefined
// }
export const ChannelSettingModal = () => {
    const dispatch = useAppDispatch();
    // const conversations: any = useAppSelector((state) => state.conversation.conversations);

    const [open, setOpen] = useState(false);
    const [openInviteModal, setOpenInviteModal] = useState(false);

    const handleClose = () => {
        setOpen(!open);
    }

    // useEffect(()=> {
    //     dispatch(getDirectConversations());
    //   }, [dispatch]);
    
    // console.log("conversation in ChannelSetting: ", conversation.type);
    // console.log("conversation type: ", conversation.type);
    return (
        <>
            <p>channel</p>
            <div className="icons-holder">
            <div className="channel-members" onClick={() => setOpen(true)}>
                <Person />
                20
                <Modal
                    open={open}
                    onClose={handleClose}
                    aria-labelledby="modal-search-invite-users-to-room"
                    aria-describedby="modal-description"
                >
                    <Box sx={boxStyle}>
                        <div className="modalHeader">
                            <h2>Users</h2>
                            <button onClick={() => { setOpen(false)}}>X</button>
                            {/* <Close className={"close-button"} style={{cursor: 'pointer'}} onClick={() => setOpen(false)} /> */}
                        </div>
                        <div style={{overflow: 'hidden', maxHeight: '400px'}}>
                           <div className="modal-search">
                                <SearchComponent />
                           </div>
                           <div className="modal-invite-user" onClick={() => setOpenInviteModal(true)}>
                                <PersonAddAltRounded fontSize='large' />
                                <h4  style={{marginLeft: '10px'}}>Invite user</h4>
                                {/* <Modal
                                    open = {openInviteModal}
                                    onClose={() => {setOpenInviteModal(false)}}
                                    aria-labelledby="modal-modal-title"
                                    aria-describedby="modal-modal-description"
                                >
                                <Box sx={boxStyle}>
                                    hello
                                    <button onClick={() => {setOpenInviteModal(false)}} >X</button>
                                </Box>
                                </Modal> */}
                           </div>
                           <div className="modal-users">
                                <p  className='user-element'>user 1</p>
                                <p  className='user-element'>user 1</p>
                                <p  className='user-element'>user 1</p>
                                <p  className='user-element'>user 1</p>
                                <p  className='user-element'>user 1</p>
                                <p  className='user-element'>user 1</p>
                                <p  className='user-element'>user 1</p>
                                <p  className='user-element'>user 1</p>
                                <p  className='user-element'>user 1</p>
                                <p  className='user-element'>user 1</p>
                                <p  className='user-element'>user 1</p>
                                <p  className='user-element'>user 1</p>
                           </div>
                        </div>  
                    </Box>
                </Modal>
            </div>
            <LogoutRounded />    
            </div>
        </>
    )
}

const boxStyle = {
    position: "absolute" as "absolute",
    top: "50%",
    left: "50%",
    transform: "translate(-50%, -50%)",
    width: 300,
    bgcolor: "background.paper",
    border: "1px solid #000",
    boxShadow: 24,
    p: 4,
    borderRadius: "20px",
    overflow: 'hidden',
};