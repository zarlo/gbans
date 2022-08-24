import React, { useCallback, useEffect, useMemo, useState } from 'react';
import Grid from '@mui/material/Grid';
import { useNavigate, useParams } from 'react-router-dom';
import {
    apiCreateBanMessage,
    apiDeleteBanMessage,
    apiGetBanMessages,
    apiGetBanSteam,
    apiUpdateBanMessage,
    AuthorMessage,
    BannedPerson,
    BanReasons,
    banTypeString,
    PermissionLevel,
    UserMessage
} from '../api';
import { NotNull } from '../util/types';
import { Heading } from '../component/Heading';
import { SteamIDList } from '../component/SteamIDList';
import { ProfileInfoBox } from '../component/ProfileInfoBox';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import ListItem from '@mui/material/ListItem';
import ListItemText from '@mui/material/ListItemText';
import List from '@mui/material/List';
import { MDEditor } from '../component/MDEditor';
import { UserMessageView } from '../component/UserMessageView';
import { logErr } from '../util/errors';
import { useUserFlashCtx } from '../contexts/UserFlashCtx';
import { useCurrentUserCtx } from '../contexts/CurrentUserCtx';
import ButtonGroup from '@mui/material/ButtonGroup';
import Button from '@mui/material/Button';
import { UnbanSteamModal } from '../component/UnbanSteamModal';
import {
    parseDateTime,
    renderDateTime,
    renderTimeDistance
} from '../util/text';
import Typography from '@mui/material/Typography';
import Link from '@mui/material/Link';

export const BanPage = (): JSX.Element => {
    const [ban, setBan] = React.useState<NotNull<BannedPerson>>();
    const [messages, setMessages] = useState<AuthorMessage[]>([]);
    const [unbanOpen, setUnbanOpen] = useState<boolean>(false);
    const { currentUser } = useCurrentUserCtx();
    const { sendFlash } = useUserFlashCtx();
    const { ban_id } = useParams();
    const navigate = useNavigate();
    const id = useMemo(() => parseInt(ban_id || '0'), [ban_id]);

    useEffect(() => {
        if (id <= 0) {
            navigate('/');
            return;
        }
        apiGetBanSteam(id, true)
            .then((banPerson) => {
                if (!banPerson.status || !banPerson.result) {
                    sendFlash('error', 'Failed to get ban, permission denied');
                    navigate('/');
                    return;
                }
                setBan(banPerson.result);
                loadMessages();
            })
            .catch(() => {
                sendFlash(
                    'error',
                    'Permission denied. Must login with banned account.'
                );
                navigate('/');
                return;
            });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [ban_id]);

    const loadMessages = useCallback(() => {
        if (!id) {
            return;
        }
        apiGetBanMessages(id)
            .then((response) => {
                setMessages(response.result || []);
            })
            .catch(logErr);
    }, [id]);

    const onSave = useCallback(
        (message: string) => {
            if (!ban) {
                return;
            }
            apiCreateBanMessage(ban?.ban.ban_id, message)
                .then((response) => {
                    if (!response.status || !response.result) {
                        sendFlash('error', 'Failed to create message');
                        return;
                    }
                    setMessages([
                        ...messages,
                        { author: currentUser, message: response.result }
                    ]);
                })
                .catch(logErr);
        },
        [ban, messages, currentUser, sendFlash]
    );

    const onEdit = useCallback(
        (message: UserMessage) => {
            apiUpdateBanMessage(message.message_id, message.contents)
                .then(() => {
                    sendFlash('success', 'Updated message successfully');
                    loadMessages();
                })
                .catch(logErr);
        },
        [loadMessages, sendFlash]
    );

    const onDelete = useCallback(
        (message_id: number) => {
            apiDeleteBanMessage(message_id)
                .then(() => {
                    sendFlash('success', 'Deleted message successfully');
                    loadMessages();
                })
                .catch(logErr);
        },
        [loadMessages, sendFlash]
    );

    return (
        <Grid container paddingTop={3} spacing={2}>
            <Grid item xs={8}>
                <Stack spacing={2}>
                    <Heading>{`Ban Appeal #${id}`}</Heading>
                    {messages.map((m) => (
                        <UserMessageView
                            onSave={onEdit}
                            onDelete={onDelete}
                            author={m.author}
                            message={m.message}
                            key={m.message.message_id}
                        />
                    ))}
                    <Paper elevation={1}>
                        <Stack spacing={2}>
                            <MDEditor
                                initialBodyMDValue={''}
                                onSave={onSave}
                                saveLabel={'Send Message'}
                            />
                        </Stack>
                    </Paper>
                </Stack>
            </Grid>
            <Grid item xs={4}>
                <Stack spacing={2}>
                    {ban && (
                        <ProfileInfoBox
                            profile={{ player: ban?.person, friends: [] }}
                        />
                    )}
                    {ban && (
                        <Paper elevation={1}>
                            <Stack>
                                <Heading>Ban Details</Heading>
                                <List dense={true}>
                                    <ListItem>
                                        <ListItemText
                                            primary={'Reason'}
                                            secondary={
                                                BanReasons[ban.ban.reason]
                                            }
                                        />
                                    </ListItem>
                                    <ListItem>
                                        <ListItemText
                                            primary={'Ban Type'}
                                            secondary={banTypeString(
                                                ban.ban.ban_type
                                            )}
                                        />
                                    </ListItem>
                                    {ban.ban.reason_text != '' && (
                                        <ListItem>
                                            <ListItemText
                                                primary={'Reason (Custom)'}
                                                secondary={ban.ban.reason_text}
                                            />
                                        </ListItem>
                                    )}
                                    <ListItem>
                                        <ListItemText
                                            primary={'Author'}
                                            secondary={ban.ban.target_id.toString()}
                                        />
                                    </ListItem>
                                    <ListItem>
                                        <ListItemText
                                            primary={'Created At'}
                                            secondary={renderDateTime(
                                                parseDateTime(
                                                    ban.ban.created_on as string
                                                )
                                            )}
                                        />
                                    </ListItem>
                                    <ListItem>
                                        <ListItemText
                                            primary={'Expires At'}
                                            secondary={renderDateTime(
                                                parseDateTime(
                                                    ban.ban
                                                        .valid_until as string
                                                )
                                            )}
                                        />
                                    </ListItem>
                                    <ListItem>
                                        <ListItemText
                                            primary={'Expires'}
                                            secondary={renderTimeDistance(
                                                ban.ban.valid_until
                                            )}
                                        />
                                    </ListItem>
                                </List>
                            </Stack>
                        </Paper>
                    )}

                    {ban && (
                        <Paper elevation={1}>
                            <SteamIDList steam_id={ban?.ban.target_id} />
                        </Paper>
                    )}

                    {ban &&
                        currentUser.permission_level >=
                            PermissionLevel.Moderator &&
                        ban.ban.note != '' && (
                            <Paper>
                                <Heading>Mod Notes</Heading>
                                <Typography variant={'body2'} padding={2}>
                                    {ban.ban.note}
                                </Typography>
                            </Paper>
                        )}

                    {currentUser.permission_level >=
                        PermissionLevel.Moderator && (
                        <Paper>
                            <Heading>Moderation Tools</Heading>
                            <Stack spacing={2} padding={2}>
                                {ban && ban?.ban.report_id > 0 && (
                                    <Button
                                        fullWidth
                                        color={'secondary'}
                                        variant={'contained'}
                                        onClick={() => {
                                            navigate(
                                                `/report/${ban?.ban.report_id}`
                                            );
                                        }}
                                    >
                                        View Report #{ban?.ban.report_id}
                                    </Button>
                                )}
                                <Button
                                    variant={'contained'}
                                    color={'secondary'}
                                    component={Link}
                                    href={`https://logs.viora.sh/messages?q[for_player]=${ban?.person.steam_id.toString()}`}
                                >
                                    Ext. Chat Logs
                                </Button>
                                {ban && ban?.ban.ban_id > 0 && (
                                    <UnbanSteamModal
                                        banId={ban?.ban.ban_id}
                                        personaName={
                                            ban?.person.personaname ??
                                            ban?.person.steam_id.toString()
                                        }
                                        open={unbanOpen}
                                        setOpen={setUnbanOpen}
                                    />
                                )}
                                <ButtonGroup fullWidth variant={'contained'}>
                                    <Button color={'warning'}>Edit Ban</Button>
                                    <Button
                                        color={'success'}
                                        onClick={() => {
                                            setUnbanOpen(true);
                                        }}
                                    >
                                        Unban
                                    </Button>
                                </ButtonGroup>
                            </Stack>
                        </Paper>
                    )}
                </Stack>
            </Grid>
        </Grid>
    );
};
