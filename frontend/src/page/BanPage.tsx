import AddModeratorIcon from '@mui/icons-material/AddModerator';
import DocumentScannerIcon from '@mui/icons-material/DocumentScanner';
import InfoIcon from '@mui/icons-material/Info';
import { FormControl, Select } from '@mui/material';
import Button from '@mui/material/Button';
import ButtonGroup from '@mui/material/ButtonGroup';
import InputLabel from '@mui/material/InputLabel';
import Link from '@mui/material/Link';
import List from '@mui/material/List';
import ListItem from '@mui/material/ListItem';
import ListItemText from '@mui/material/ListItemText';
import MenuItem from '@mui/material/MenuItem';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import Grid from '@mui/material/Unstable_Grid2';
import React, { useCallback, useEffect, useMemo, useState, JSX } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
    apiCreateBanMessage,
    apiDeleteBanMessage,
    apiGetBanMessages,
    apiGetBanSteam,
    apiSetBanAppealState,
    apiUpdateBanMessage,
    AppealState,
    AppealStateCollection,
    appealStateString,
    AuthorMessage,
    BannedPerson,
    BanReasons,
    banTypeString,
    PermissionLevel,
    UserMessage
} from '../api';
import { ContainerWithHeader } from '../component/ContainerWithHeader';
import { MDEditor } from '../component/MDEditor';
import { ProfileInfoBox } from '../component/ProfileInfoBox';
import { SourceBansList } from '../component/SourceBansList';
import { SteamIDList } from '../component/SteamIDList';
import { UnbanSteamModal } from '../component/UnbanSteamModal';
import { UserMessageView } from '../component/UserMessageView';
import { useCurrentUserCtx } from '../contexts/CurrentUserCtx';
import { useUserFlashCtx } from '../contexts/UserFlashCtx';
import { logErr } from '../util/errors';
import { renderDateTime, renderTimeDistance } from '../util/text';
import { NotNull } from '../util/types';

export const BanPage = (): JSX.Element => {
    const [ban, setBan] = React.useState<NotNull<BannedPerson>>();
    const [messages, setMessages] = useState<AuthorMessage[]>([]);
    const [unbanOpen, setUnbanOpen] = useState<boolean>(false);
    const [appealState, setAppealState] = useState<AppealState>(
        AppealState.Open
    );
    const { currentUser } = useCurrentUserCtx();
    const { sendFlash } = useUserFlashCtx();
    const { ban_id } = useParams();
    const navigate = useNavigate();
    const id = useMemo(() => parseInt(ban_id || '0'), [ban_id]);

    const canPost = useMemo(() => {
        return (
            currentUser.permission_level >= PermissionLevel.Moderator ||
            (ban?.ban.appeal_state == AppealState.Open &&
                ban?.person.steam_id == currentUser.steam_id)
        );
    }, [ban, currentUser]);

    useEffect(() => {
        if (id <= 0) {
            navigate('/');
            return;
        }
        apiGetBanSteam(id, true)
            .then((banPerson) => {
                setAppealState(banPerson.ban.appeal_state);
                setBan(banPerson);
                loadMessages();
            })
            .catch(() => {
                sendFlash('error', 'Failed to get ban, permission denied');
                navigate('/');
                return;
            });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [id, navigate, sendFlash]);

    const loadMessages = useCallback(() => {
        if (!id) {
            return;
        }
        apiGetBanMessages(id)
            .then((response) => {
                setMessages(response);
            })
            .catch(logErr);
    }, [id]);

    const onSave = useCallback(
        (message: string, onSuccess?: () => void) => {
            if (!ban) {
                return;
            }
            apiCreateBanMessage(ban?.ban.ban_id, message)
                .then((response) => {
                    setMessages([
                        ...messages,
                        { author: currentUser, message: response }
                    ]);
                    onSuccess && onSuccess();
                })
                .catch((e) => {
                    sendFlash('error', 'Failed to create message');
                    logErr(e);
                });
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
    const onSaveAppealState = useCallback(() => {
        apiSetBanAppealState(id, appealState)
            .then(() => {
                sendFlash('success', 'Appeal state updated');
            })
            .catch((reason) => {
                sendFlash('error', 'Could not set appeal state');
                logErr(reason);
                return;
            });
    }, [appealState, id, sendFlash]);

    return (
        <Grid container spacing={2}>
            <Grid xs={8}>
                <Stack spacing={2}>
                    {canPost && messages.length == 0 && (
                        <ContainerWithHeader title={`Ban Appeal #${id}`}>
                            <Typography
                                variant={'body2'}
                                padding={2}
                                textAlign={'center'}
                            >
                                You can start the appeal process by replying on
                                this form.
                            </Typography>
                        </ContainerWithHeader>
                    )}

                    {ban &&
                        currentUser.permission_level >=
                            PermissionLevel.Moderator && (
                            <SourceBansList
                                steam_id={ban?.ban.source_id}
                                is_reporter={true}
                            />
                        )}

                    {ban &&
                        currentUser.permission_level >=
                            PermissionLevel.Moderator && (
                            <SourceBansList
                                steam_id={ban?.ban.target_id}
                                is_reporter={false}
                            />
                        )}

                    {messages.map((m) => (
                        <UserMessageView
                            onSave={onEdit}
                            onDelete={onDelete}
                            author={m.author}
                            message={m.message}
                            key={m.message.message_id}
                        />
                    ))}
                    {canPost && (
                        <Paper elevation={1}>
                            <Stack spacing={2}>
                                <MDEditor
                                    initialBodyMDValue={''}
                                    onSave={onSave}
                                    saveLabel={'Send Message'}
                                />
                            </Stack>
                        </Paper>
                    )}
                    {!canPost && ban && (
                        <Paper elevation={1}>
                            <Typography
                                variant={'body2'}
                                padding={2}
                                textAlign={'center'}
                            >
                                The ban appeal is closed:{' '}
                                {appealStateString(ban.ban.appeal_state)}
                            </Typography>
                        </Paper>
                    )}
                </Stack>
            </Grid>
            <Grid xs={4}>
                <Stack spacing={2}>
                    {ban && (
                        <ProfileInfoBox
                            profile={{ player: ban?.person, friends: [] }}
                        />
                    )}
                    {ban && (
                        <ContainerWithHeader
                            title={'Ban Details'}
                            iconRight={<InfoIcon />}
                            align={'flex-end'}
                        >
                            <List dense={true}>
                                <ListItem>
                                    <ListItemText
                                        primary={'Reason'}
                                        secondary={BanReasons[ban.ban.reason]}
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
                                        primary={'Created At'}
                                        secondary={renderDateTime(
                                            ban.ban.created_on
                                        )}
                                    />
                                </ListItem>
                                <ListItem>
                                    <ListItemText
                                        primary={'Expires At'}
                                        secondary={renderDateTime(
                                            ban.ban.valid_until
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
                                {ban &&
                                    currentUser.permission_level >=
                                        PermissionLevel.Moderator && (
                                        <ListItem>
                                            <ListItemText
                                                primary={'Author'}
                                                secondary={ban.ban.source_id.toString()}
                                            />
                                        </ListItem>
                                    )}
                            </List>
                        </ContainerWithHeader>
                    )}

                    {ban && <SteamIDList steam_id={ban?.ban.target_id} />}

                    {ban &&
                        currentUser.permission_level >=
                            PermissionLevel.Moderator &&
                        ban.ban.note != '' && (
                            <ContainerWithHeader
                                title={'Mod Notes'}
                                iconRight={<DocumentScannerIcon />}
                                align={'flex-end'}
                            >
                                <Typography variant={'body2'} padding={2}>
                                    {ban.ban.note}
                                </Typography>
                            </ContainerWithHeader>
                        )}

                    {currentUser.permission_level >=
                        PermissionLevel.Moderator && (
                        <ContainerWithHeader
                            title={'Moderation Tools'}
                            iconRight={<AddModeratorIcon />}
                            align={'flex-end'}
                        >
                            <Stack spacing={2} padding={2}>
                                <Stack direction={'row'} spacing={2}>
                                    <FormControl fullWidth>
                                        <InputLabel id="appeal-status-label">
                                            Appeal Status
                                        </InputLabel>
                                        <Select<AppealState>
                                            value={appealState}
                                            labelId={'appeal-status-label'}
                                            id={'appeal-status'}
                                            label={'Appeal Status'}
                                            onChange={(evt) => {
                                                setAppealState(
                                                    evt.target
                                                        .value as AppealState
                                                );
                                            }}
                                        >
                                            {AppealStateCollection.map((as) => {
                                                return (
                                                    <MenuItem
                                                        value={as}
                                                        key={as}
                                                    >
                                                        {appealStateString(as)}
                                                    </MenuItem>
                                                );
                                            })}
                                        </Select>
                                    </FormControl>
                                    <Button
                                        variant={'contained'}
                                        onClick={onSaveAppealState}
                                    >
                                        Apply Status
                                    </Button>
                                </Stack>

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
                        </ContainerWithHeader>
                    )}
                </Stack>
            </Grid>
        </Grid>
    );
};
