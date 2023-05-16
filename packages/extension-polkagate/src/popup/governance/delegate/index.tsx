// Copyright 2019-2023 @polkadot/extension-polkagate authors & contributors
// SPDX-License-Identifier: Apache-2.0

/* eslint-disable react/jsx-max-props-per-line */

import type { Balance } from '@polkadot/types/interfaces';

import { ArrowForwardIos as ArrowForwardIosIcon, Close as CloseIcon } from '@mui/icons-material';
import { Box, ClickAwayListener, Grid, List, ListItem, ListItemButton, ListItemIcon, ListItemText, Modal, Skeleton, Typography, useTheme } from '@mui/material';
import React, { useCallback, useEffect, useMemo, useState } from 'react';

import { ApiPromise } from '@polkadot/api';
import { AccountsStore } from '@polkadot/extension-base/stores';
import { BN, BN_ONE, BN_ZERO, BN_MAX_INTEGER } from '@polkadot/util';
import keyring from '@polkadot/ui-keyring';
import { cryptoWaitReady } from '@polkadot/util-crypto';

import { AmountWithOptions, Checkbox2, Convictions, From, Infotip2, PButton, Progress, ShowBalance } from '../../../components';
import { useAccountLocks, useApi, useBalances, useBlockInterval, useConvictionOptions, useCurrentBlockNumber, useDecimal, useFormatted, useToken, useTracks, useTranslation } from '../../../hooks';
import { MAX_AMOUNT_LENGTH } from '../../../util/constants';
import { amountToHuman, amountToMachine, remainingTime } from '../../../util/utils';
import { toTitleCase } from '../utils/util';
import AlreadyLockedTooltipText, { getAlreadyLockedValue } from './AlreadyLockedTooltipText ';
import ChooseDelegator from './ChooseDelegator';
import DelegateNote from './DelegationNote';
import Review from './Review';

interface Props {
  api: ApiPromise | undefined;
  address: string | undefined;
  open: boolean;
  setOpen: (value: React.SetStateAction<boolean>) => void;
  showDelegationNote: boolean;
}

export interface DelegateInformation {
  delegateeAddress?: string;
  delegateAmount: string;
  delegateAmountBN: BN;
  delegateConviction: number;
  delegatePower: number;
  delegatedTracks: BN[];
}

export function Delegate({ address, open, setOpen, showDelegationNote }: Props): React.ReactElement<Props> {
  const { t } = useTranslation();
  const theme = useTheme();
  const token = useToken(address);
  const api = useApi(address);
  const decimal = useDecimal(address);
  const formatted = useFormatted(address);
  const tracks = useTracks(address);
  const accountLocks = useAccountLocks(address, 'referenda', 'convictionVoting', true);
  const blockTime = useBlockInterval(address);
  const convictionOptions = useConvictionOptions(address, blockTime, t);
  const currentBlock = useCurrentBlockNumber(address);

  const balances = useBalances(address, undefined, undefined, true);
  const [estimatedFee, setEstimatedFee] = useState<Balance>();
  const [delegateAmount, setDelegateAmount] = useState<string>('0');
  const [conviction, setConviction] = useState<number | undefined>();
  const [checked, setChecked] = useState<BN[]>([]);
  const [showExistingVoted, setShowExistingVoted] = useState(false);
  const [step, setStep] = useState<number>(showDelegationNote ? 0 : 1);
  const [delegateInformation, setDelegateInformation] = useState<DelegateInformation | undefined>();

  const delegate = api && api.tx.convictionVoting.delegate;

  const handleClose = useCallback(() => {
    setOpen(false);
  }, [setOpen]);

  const lockedAmount = useMemo(() => getAlreadyLockedValue(balances), [balances]);
  const unvotedTracks = useMemo(() => accountLocks && tracks && tracks.filter((value) => !accountLocks.find((lock) => lock.classId.eq(value[0]))), [accountLocks, tracks]);
  const existingVotes: Record<string, number> | undefined = useMemo(() => {
    if (tracks && accountLocks) {
      const result = {};

      accountLocks.forEach((lock) => {
        if (!result[lock.classId]) {
          result[lock.classId] = 1;
        } else {
          result[lock.classId]++;
        }
      });

      const replacedKey = Object.keys(result).reduce((acc, key) => {
        const newKey = tracks.find((value) => String(value[0]) === key)?.[1].name; // Convert numeric key to custom key
        acc[newKey] = result[key];

        return acc;
      }, {});

      return replacedKey;
    }
  }, [accountLocks, tracks]);
  const delegateAmountBN = useMemo(() => (amountToMachine(delegateAmount, decimal)), [decimal, delegateAmount]);
  const delegatePower = useMemo(() => {
    if (conviction === undefined || delegateAmountBN.isZero()) {
      return 0;
    }

    const bn = conviction !== 0.1 ? delegateAmountBN.muln(conviction) : delegateAmountBN.divn(10);

    return amountToHuman(bn, decimal);
  }, [conviction, decimal, delegateAmountBN]);

  const nextDisable = useMemo(() => (!delegateInformation || !checked.length || delegateAmountBN.isZero() || delegateAmountBN.gt(balances?.votingBalance || BN_ZERO)), [balances?.votingBalance, checked.length, delegateAmountBN, delegateInformation]);

  useEffect(() => {
    cryptoWaitReady().then(() => keyring.loadAll({ store: new AccountsStore() })).catch(() => null);
  }, []);

  useEffect(() => {
    convictionOptions === undefined && setConviction(1);
  }, [convictionOptions]);

  useEffect(() => {
    if (!formatted || !delegate) {
      return;
    }

    if (!api?.call?.transactionPaymentApi) {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-return
      return setEstimatedFee(api?.createType('Balance', BN_ONE));
    }

    const dummyAddress = 'Cgp9bcq1dGP1Z9B6F2ccTSTHNez9jq2iUX993ZbDVByPSU2';
    const feeDummyParams = [0, dummyAddress, 1, BN_ONE];

    delegate(...feeDummyParams).paymentInfo(formatted).then((i) => setEstimatedFee(i?.partialFee)).catch(console.error);
  }, [api, formatted, delegate]);

  useEffect(() => {
    if (!delegateAmount || delegateAmountBN.isZero() || conviction === undefined || !checked.length) {
      return;
    }

    setDelegateInformation({
      delegateAmount,
      delegateAmountBN,
      delegateConviction: conviction === 0.1 ? 0 : conviction,
      delegatePower,
      delegatedTracks: checked
    });
  }, [checked, conviction, delegateAmount, delegateAmountBN, delegatePower]);

  const onLockedAmount = useCallback(() => {
    if (!lockedAmount) {
      return;
    }

    setDelegateAmount(amountToHuman(lockedAmount, decimal));
  }, [decimal, lockedAmount]);

  const onMaxAmount = useCallback(() => {
    if (!api || !balances || !estimatedFee) {
      return;
    }

    const ED = api.consts.balances.existentialDeposit as unknown as BN;
    const max = new BN(balances.votingBalance.toString()).sub(ED.muln(2)).sub(new BN(estimatedFee));
    const maxToHuman = amountToHuman(max.toString(), decimal);

    maxToHuman && setDelegateAmount(maxToHuman);
  }, [api, balances, decimal, estimatedFee]);

  const onValueChange = useCallback((value: string) => {
    if (!decimal) {
      return;
    }

    if (value.length > decimal - 1) {
      console.log(`The amount digits is more than decimal:${decimal} `);

      return;
    }

    setDelegateAmount(value.slice(0, MAX_AMOUNT_LENGTH));
  }, [decimal]);

  const handleToggle = (value: number) => () => {
    const currentIndex = checked.indexOf(value);
    const newChecked = [...checked];

    if (currentIndex === -1) {
      newChecked.push(value);
    } else {
      newChecked.splice(currentIndex, 1);
    }

    setChecked(newChecked);
  };

  const onSelectAll = useCallback(() => {
    const toChecked = unvotedTracks && checked.length !== unvotedTracks.length ? unvotedTracks.map((value) => value[0]) : [];

    setChecked(toChecked);
  }, [checked.length, unvotedTracks]);

  const handleNext = useCallback(() => setStep(2), []);
  const toggleExistingVotes = useCallback(() => setShowExistingVoted(!showExistingVoted), [showExistingVoted]);

  const ExistingVotesDisplay = () => {
    return (
      <ClickAwayListener onClickAway={toggleExistingVotes}>
        <Grid container sx={{ '> :not(:first-child)': { borderBottom: 1, borderColor: 'rgba(0,0,0,0.2)' }, bgcolor: 'background.default', border: 1, borderColor: 'primary.main', borderRadius: '5px', boxShadow: '3px 5px 5px 2px rgba(0, 0, 0, 0.25)', display: 'block', height: '245px', overflowY: 'scroll', position: 'absolute', top: '92px', zIndex: 100 }}>
          <Grid container item justifyContent='space-between' sx={{ borderBottom: 1, borderColor: 'primary.main', fontSize: '18px', fontWeight: 500, lineHeight: '40px' }}>
            <Grid item px='25px'>
              {t('Categories')}
            </Grid>
            <Grid item px='30px'>
              {t('Votes')}
            </Grid>
          </Grid>
          {existingVotes
            ? Object.keys(existingVotes).map((key, index) => (
              <Grid container item justifyContent='space-between' key={index} sx={{ lineHeight: '40px' }}>
                <Grid item px='25px'>
                  {toTitleCase(key)}
                </Grid>
                <Grid item px='50px'>
                  {existingVotes[key]}
                </Grid>
              </Grid>
            ))
            : <Grid container item pb='25px' style={{ border: 'none' }}>
              <Progress pt='60px' size={50} title={t('Loading your existing votes ...')} />
            </Grid>
          }
        </Grid>
      </ClickAwayListener>
    );
  };

  const ReferendaTracks = () => {
    return (
      <>
        <Grid container justifyContent='space-between' pt='15px'>
          <Grid item>
            <Infotip2 iconTop={26} showQuestionMark text={'Please select all the categories in which you would like to delegate your votes.'}>
              <Typography fontSize='16px' fontWeight={400} sx={{ textAlign: 'left' }}>
                {t('Referenda Category')}
              </Typography>
            </Infotip2>
          </Grid>
          <Grid item onClick={onSelectAll}>
            <Typography fontSize='16px' fontWeight={400} sx={{ color: theme.palette.mode === 'dark' ? 'text.primary' : 'primary.main', cursor: 'pointer', textAlign: 'left', textDecorationLine: 'underline' }}>
              {checked.length === unvotedTracks?.length ? t('Deselect All') : t('Select All')}
            </Typography>
          </Grid>
        </Grid>
        <List disablePadding sx={{ bgcolor: 'background.paper', border: 1, borderColor: 'primary.main', borderRadius: '5px', height: '175px', maxWidth: '100%', overflowY: 'scroll', width: '100%' }}>
          {unvotedTracks
            ? unvotedTracks.map((value, index) => (
              <ListItem
                disablePadding
                key={index}
                sx={{ height: '25px' }}
              >
                <ListItemButton dense onClick={handleToggle(value[0] as unknown as number)} role={undefined}>
                  <ListItemText
                    primary={`${toTitleCase(value[1].name as unknown as string) as string}`}
                  />
                  <ListItemIcon sx={{ minWidth: '20px' }}>
                    <Checkbox2
                      checked={checked.indexOf(value[0] as unknown as BN) !== -1}
                      iconStyle={{ transform: 'scale(1.13)' }}
                      label={''}
                    // onChange={}
                    />
                  </ListItemIcon>
                </ListItemButton>
              </ListItem>
            ))
            : <Progress pt='35px' size={70} title={t('Loading referenda tracks...')} />
          }
        </List>
      </>
    );
  };

  const style = {
    bgcolor: 'background.default',
    border: '2px solid #000',
    borderRadius: '10px',
    boxShadow: 24,
    left: '50%',
    maxHeight: '700px',
    pb: 3,
    position: 'absolute',
    pt: 2,
    px: 4,
    top: '50%',
    transform: 'translate(-50%, -50%)',
    width: '500px'
  };

  const getLockedUntil = (endBlock: BN, currentBlock: number) => {
    if (endBlock.eq(BN_MAX_INTEGER)) {
      return 'underway';
    }

    return remainingTime(endBlock.toNumber() - currentBlock);
  };

  const alreadyLockedTooltipText = useMemo(() => accountLocks && currentBlock &&
    (<>
      <Typography variant='body2'>
        <Grid container spacing={2}>
          <Grid item xs={2.5}>
            {t('Ref.')}
          </Grid>
          <Grid item xs={3.6}>
            {t('Amount')}
          </Grid>
          <Grid item xs={2.9}>
            {t('Multiplier')}
          </Grid>
          <Grid item xs={3}>
            {t('Expires')}
          </Grid>
          {accountLocks.map((l, index) =>
            <React.Fragment key={index}>
              <Grid item xs={2.5}>
                {l.refId.toNumber()}
              </Grid>
              <Grid item xs={3.6}>
                {amountToHuman(l.total, decimal)} {token}
              </Grid>
              <Grid item xs={2.9}>
                {l.locked === 'None' ? 'N/A' : l.locked.replace('Locked', '')}
              </Grid>
              <Grid item xs={3}>
                {getLockedUntil(l.endBlock, currentBlock)}
              </Grid>
            </React.Fragment>
          )}
        </Grid>
      </Typography>
    </>
    ), [accountLocks, currentBlock, decimal, t, token]);

  return (
    <Modal onClose={handleClose} open={open}>
      <Box sx={{ ...style }}>
        <Grid alignItems='center' container justifyContent='space-between' pt='5px'>
          <Grid item>
            <Typography fontSize='22px' fontWeight={700}>
              {step === 0
                ? t('Delegate Vote')
                : step < 3
                  ? t('Delegate Vote ({{step}}/3)', { replace: { step } })
                  : step === 3
                    ? t('Review Your Delegation ({{step}}/3)', { replace: { step } })
                    : step === 4
                      ? t('Delegating')
                      : step === 5
                        ? t('Delegation Completed')
                        : ''
              }
            </Typography>
          </Grid>
          <Grid item>
            {step !== 4 && <CloseIcon onClick={handleClose} sx={{ color: 'primary.main', cursor: 'pointer', stroke: theme.palette.primary.main, strokeWidth: 1.5 }} />}
          </Grid>
        </Grid>
        {step === 0
          ? <DelegateNote setStep={setStep} />
          : step === 1
            ? <Grid container>
              <Grid alignItems='center' container justifyContent='space-between' position='relative' pt='10px'>
                <Grid item xs={8.5}>
                  <From
                    address={address}
                    api={api}
                    style={{ '> div': { px: '10px' }, '> p': { fontWeight: 400 } }}
                    title={t<string>('Delegate from account')}
                  />
                </Grid>
                <Grid alignItems='center' container item onClick={toggleExistingVotes} sx={{ cursor: 'pointer', mt: '25px' }} xs={3}>
                  {t('Existing votes')}
                  <ArrowForwardIosIcon sx={{ color: 'secondary.light', fontSize: 18, m: 'auto', stroke: '#BA2882', strokeWidth: '2px', transform: showExistingVoted ? 'rotate(-90deg)' : 'rotate(90deg)', transitionDuration: '0.3s', transitionProperty: 'transform' }} />
                </Grid>
                {showExistingVoted &&
                  <ExistingVotesDisplay />
                }
              </Grid>
              <ReferendaTracks />
              <AmountWithOptions
                inputWidth={8.4}
                label={t<string>('Delegate Vote Value ({{token}})', { replace: { token } })}
                onChangeAmount={onValueChange}
                onPrimary={onMaxAmount}
                onSecondary={onLockedAmount}
                primaryBtnText={t<string>('Max amount')}
                secondaryBtnText={t<string>('Locked amount')}
                style={{
                  fontSize: '16px',
                  mt: '15px',
                  width: '100%'
                }}
                value={delegateAmount}
              />
              <Grid container item>
                <Grid container item justifyContent='space-between' sx={{ mt: '10px', width: '70.25%' }}>
                  <Grid item sx={{ fontSize: '16px' }}>
                    {t('Available Voting Balance')}
                  </Grid>
                  <Grid item sx={{ fontSize: '20px', fontWeight: 500 }}>
                    <ShowBalance balance={balances?.votingBalance} decimal={decimal} decimalPoint={2} token={token} />
                  </Grid>
                </Grid>
                <Grid alignItems='center' container item justifyContent='space-between' sx={{ lineHeight: '20px', width: '75%' }}>
                  <Grid item sx={{ fontSize: '16px' }}>
                    <Infotip2 showQuestionMark text={t('The maximum number of tokens that are already locked in the ecosystem')}>
                      {t('Already Locked Balance')}
                    </Infotip2>
                  </Grid>
                  <Grid item sx={{ fontSize: '20px', fontWeight: 500 }}>
                    <Infotip2 showInfoMark text={alreadyLockedTooltipText || 'Fetching ...'}>
                      <ShowBalance balance={getAlreadyLockedValue(balances)} decimal={decimal} decimalPoint={2} token={token} />
                    </Infotip2>
                  </Grid>
                </Grid>
              </Grid>
              <Convictions
                address={address}
                conviction={conviction}
                setConviction={setConviction}
              >
                <Grid alignItems='center' container item justifyContent='space-between' sx={{ lineHeight: '24px' }}>
                  <Grid item>
                    <Typography sx={{ fontSize: '16px' }}>
                      {/* {t('Your final delegated vote power after multiplying')} */}
                      {t('Your final delegated vote power')}
                    </Typography>
                  </Grid>
                  <Grid item sx={{ fontSize: '20px', fontWeight: 500 }}>
                    <Typography fontSize='28px' fontWeight={500}>
                      {/* {nFormatter(delegatePower, 2)} */}
                      {delegatePower}
                    </Typography>
                  </Grid>
                </Grid>
              </Convictions>
              <Grid container justifyContent='flex-end'>
                <PButton
                  _ml={0}
                  _mt='10px'
                  _onClick={handleNext}
                  _width={100}
                  disabled={nextDisable}
                  text={t<string>('Next')}
                />
              </Grid>
            </Grid>
            : step === 2
              ? <ChooseDelegator setDelegateInformation={setDelegateInformation} setStep={setStep} />
              : delegateInformation &&
              <Review
                address={address}
                delegateInformation={delegateInformation}
                estimatedFee={estimatedFee}
                formatted={String(formatted)}
                handleClose={handleClose}
                setStep={setStep}
                step={step}
              />
        }
      </Box>
    </Modal>
  );
}
