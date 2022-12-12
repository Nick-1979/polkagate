// Copyright 2019-2022 @polkadot/extension-polkadot authors & contributors
// SPDX-License-Identifier: Apache-2.0

/* eslint-disable react/jsx-max-props-per-line */

/**
 * @description
 * this component opens unstake review page
 * */

import type { AccountId } from '@polkadot/types/interfaces';

import { Grid, Typography, useTheme } from '@mui/material';
import React, { useCallback, useEffect, useMemo, useState } from 'react';

import { ApiPromise } from '@polkadot/api';
import { DeriveAccountInfo } from '@polkadot/api-derive/types';
import { BN } from '@polkadot/util';

import { Checkbox2, Infotip, InputFilter, Motion, PButton, Popup } from '../../../components';
import { useChain, useDecimal, useToken, useTranslation } from '../../../hooks';
import { HeaderBrand } from '../../../partials';
import { DEFAULT_FILTERS } from '../../../util/constants';
import { AllValidators, Filter, StakingConsts, ValidatorInfo, ValidatorInfoWithIdentity } from '../../../util/types';
import { getComparator } from '../partial/comparators';
import Filters from '../partial/Filters';
import Review from './SelectValidatorsReview';
import ValidatorsTable from './ValidatorsTable';

interface Props {
  address: string;
  allValidatorsIdentities: DeriveAccountInfo[] | null | undefined;
  allValidatorsInfo: AllValidators;
  api: ApiPromise;
  title: string;
  setShow: React.Dispatch<React.SetStateAction<boolean>>;
  show: boolean;
  nominatedValidatorsIds: AccountId[] | null | undefined;
  stakingConsts: StakingConsts | null | undefined;
  stashId: AccountId;
  staked: BN;
  poolId?: BN;
}

export default function SelectValidators({ address, allValidatorsIdentities, allValidatorsInfo, api, nominatedValidatorsIds, poolId, setShow, show, staked, stakingConsts, stashId, title }: Props): React.ReactElement {
  const { t } = useTranslation();
  const theme = useTheme();
  const token = useToken(address);
  const decimal = useDecimal(address);
  const chain = useChain(address);

  const allValidators = useMemo(() => allValidatorsInfo?.current?.concat(allValidatorsInfo.waiting)?.filter((v) => !v.validatorPrefs.blocked), [allValidatorsInfo]);
  const [systemSuggestion, setSystemSuggestion] = useState<boolean>(false);
  const [showFilters, setShowFilters] = useState<boolean>(false);
  const [filteredValidators, setFilteredValidators] = useState<ValidatorInfo[] | undefined>(allValidators);
  const [validatorsToList, setValidatorsToList] = useState<ValidatorInfo[] | undefined>(allValidators);
  const [searchedValidators, setSearchedValidators] = useState<ValidatorInfo[] | undefined>(allValidators);
  const [newSelectedValidators, setNewSelectedValidators] = useState<ValidatorInfo[]>([]);
  const [showReview, setShowReview] = useState<boolean>(false);
  const [searchKeyword, setSearchKeyword] = useState<string>();
  const [filters, setFilters] = useState<Filter>(structuredClone(DEFAULT_FILTERS) as Filter);
  const [sortValue, setSortValue] = useState<number>();
  const [apply, setApply] = useState<boolean>(false);

  useEffect(() => {
    /** apply filtered validators on searched validators */
    searchedValidators?.length &&
      setValidatorsToList([...filteredValidators?.filter((f) => searchedValidators?.find((s) => s.accountId === f.accountId)) || []]);
  }, [searchedValidators, filteredValidators]);

  useEffect(() => {
    /** show selected validators  on top */
    if (systemSuggestion && newSelectedValidators?.length) {
      const notSelected = allValidators?.filter((a) => !newSelectedValidators.find((n) => a.accountId === n.accountId));

      setValidatorsToList(newSelectedValidators.concat(notSelected));
    }
  }, [systemSuggestion, newSelectedValidators, allValidators]);

  const applySearch = useCallback((keyword: string) => {
    const validatorsWithIdentity = allValidators?.map((v: ValidatorInfoWithIdentity) => {
      v.identity = allValidatorsIdentities?.find((vi) => vi.accountId === v.accountId)?.identity;

      return v;
    });

    const searched = validatorsWithIdentity?.filter((v) =>
      `${v.identity?.display}${v.identity?.displayParent}`.toLowerCase().includes(keyword.toLowerCase()) ||
      String(v.accountId).toLowerCase().includes(keyword.toLowerCase())
    );

    setSearchedValidators(searched?.length ? [...searched] : []);
  }, [allValidatorsIdentities, allValidators]);

  const onLimitValidatorsPerOperator = useCallback((validators: ValidatorInfoWithIdentity[] | undefined, limit: number): ValidatorInfoWithIdentity[] => {
    if (!validators?.length) {
      return [];
    }

    const aDeepCopyOfValidators = JSON.parse(JSON.stringify(validators)) as ValidatorInfoWithIdentity[];

    aDeepCopyOfValidators.forEach((v) => {
      const vId = allValidatorsIdentities?.find((vi) => vi.accountId === v.accountId);

      v.identity = vId?.identity;
    });

    aDeepCopyOfValidators.sort((v1, v2) => ('' + v1?.identity?.displayParent).localeCompare(v2?.identity?.displayParent));

    let counter = 1;
    let indicator = aDeepCopyOfValidators[0];

    return aDeepCopyOfValidators.filter((v, index) => {
      if (indicator.identity?.displayParent && indicator.identity?.displayParent === v.identity?.displayParent && limit >= counter++) {
        return true;
      }

      if (indicator.identity?.displayParent && indicator.identity?.displayParent === v.identity?.displayParent) {
        return false;
      }

      counter = 1;
      indicator = aDeepCopyOfValidators[index + 1];

      return true;
    });
  }, [allValidatorsIdentities]);

  // TODO: find a better algorithm to select validators automatically
  const selectBestValidators = useCallback((allValidators: ValidatorInfo[], stakingConsts: StakingConsts): ValidatorInfo[] => {
    const filtered1 = allValidators.filter((v) =>
      // !v.validatorPrefs.blocked && // filter blocked validators
      (Number(v.validatorPrefs.commission) / (10 ** 7)) < DEFAULT_FILTERS.maxCommission.value && // filter high commission validators
      v.exposure.others.length && v.exposure.others.length < stakingConsts?.maxNominatorRewardedPerValidator// filter oversubscribed
      // && v.exposure.others.length > stakingConsts?.maxNominatorRewardedPerValidator / 4 // filter validators with very low nominators
    );
    const filtered2 = onLimitValidatorsPerOperator(filtered1, DEFAULT_FILTERS.limitOfValidatorsPerOperator.value);

    const filtered3 = filtered2.filter((v) => v?.identity?.display); // filter has no identity

    return filtered3.sort(getComparator('Commissions')).slice(0, stakingConsts?.maxNominations);
  }, [onLimitValidatorsPerOperator]);

  const _onBackClick = useCallback(() => {
    // clearFilters();
    setShow(false);
  }, [setShow]);

  const onFilters = useCallback(() => {
    systemSuggestion && setNewSelectedValidators([]);
    setSystemSuggestion(false); // remove system suggestions when click on filters

    setShowFilters(true);
  }, [systemSuggestion]);

  const onSystemSuggestion = useCallback((event, checked: boolean) => {
    setSearchKeyword('');
    setSystemSuggestion(checked);
    checked && allValidators && stakingConsts && setNewSelectedValidators([...selectBestValidators(allValidators, stakingConsts)]);
    !checked && setNewSelectedValidators([]);
  }, [allValidators, selectBestValidators, stakingConsts]);

  const onSearch = useCallback((filter: string) => {
    onSystemSuggestion(undefined, false);// to reset system suggestion on search
    setSearchKeyword(filter);
    applySearch(filter);
  }, [applySearch, onSystemSuggestion]);

  const isSelected = useCallback((v: ValidatorInfo) => !!newSelectedValidators.find((n) => n.accountId === v.accountId), [newSelectedValidators]);

  const handleCheck = useCallback((e: React.ChangeEvent<HTMLInputElement>, validator: ValidatorInfo) => {
    const checked = e.target.checked;

    if (newSelectedValidators.length >= stakingConsts?.maxNominations && checked) {
      console.log('Max validators are selected !');

      return;
    }

    const newSelected: ValidatorInfo[] = [...newSelectedValidators];

    if (checked) {
      newSelected.push(validator);
    } else {
      /** remove unchecked from the selection */
      const selectedIndex = newSelectedValidators.indexOf(validator);

      newSelected.splice(selectedIndex, 1);
    }

    setNewSelectedValidators([...newSelected]);
  }, [newSelectedValidators, stakingConsts?.maxNominations]);

  const TableSubInfoWithClear = () => (
    <Grid container justifyContent='space-between' pt='5px'>
      <Grid item>
        <Typography sx={{ fontSize: '14px', fontWeight: 400 }}>
          {t('{{selectedCount}} of {{maxSelectable}} is selected', { replace: { selectedCount: newSelectedValidators?.length, maxSelectable: stakingConsts?.maxNominations } })}
        </Typography>
      </Grid>
      <Grid item>
        <Typography onClick={() => setNewSelectedValidators([])} sx={{ cursor: 'pointer', fontSize: '14px', fontWeight: 400, textDecorationLine: 'underline' }}>
          {t('Clear selection')}
        </Typography>
      </Grid>
    </Grid>
  );

  return (
    <Motion>
      <Popup show={show}>
        <HeaderBrand
          noBorder
          onBackClick={_onBackClick}
          paddingBottom={0}
          showBackArrow
          showClose
          text={title}
          withSteps={{
            current: 1,
            total: 2
          }}
        />
        <Grid container sx={{ justifyContent: 'flex-start', px: '15px' }}>
          <Grid container item justifyContent='center' ml='-15px'>
            <Infotip
              iconLeft={6}
              iconTop={6}
              showQuestionMark
              text={t<string>('Our system suggests trusted, high return, low commission validators which not slashed before.')}
            >
              <Checkbox2
                checked={systemSuggestion}
                label={t<string>('System Suggestions')}
                labelStyle={{ fontSize: '16px', fontWeight: '400' }}
                onChange={onSystemSuggestion}
              />
            </Infotip>
          </Grid>
          <Grid item justifyContent='flex-start' py='10px' width='73%'>
            <InputFilter
              autoFocus={false}
              onChange={onSearch}
              placeholder={t<string>('🔍 Search validator')}
              theme={theme}
              value={searchKeyword ?? ''}
            />
          </Grid>
          <Grid alignItems='center' container fontSize='16px' fontWeight={400} item justifyContent='flex-start' onClick={onFilters} pl='15px' py='10px' width='27%' sx={{ cursor: 'pointer' }}>
            {t('Filters')}
            <Grid alignItems='center' container item justifyContent='center' pl='10px' sx={{ cursor: 'pointer', width: '40%' }}>
              <vaadin-icon icon='vaadin:ellipsis-dots-v' style={{ color: `${theme.palette.secondary.light}`, width: '33px' }} />
            </Grid>
          </Grid>
          <Grid item xs={12}>
            {validatorsToList &&
              <ValidatorsTable
                allValidatorsIdentities={allValidatorsIdentities}
                api={api}
                chain={chain}
                decimal={decimal}
                formatted={stashId}
                handleCheck={handleCheck}
                height={window.innerHeight - 230}
                isSelected={isSelected}
                maxSelected={newSelectedValidators.length === stakingConsts?.maxNominations}
                nominatedValidatorsIds={nominatedValidatorsIds}
                setSelectedValidators={setNewSelectedValidators}
                showCheckbox
                staked={staked}
                stakingConsts={stakingConsts}
                token={token}
                validatorsToList={validatorsToList}
              />
            }
          </Grid>
          <TableSubInfoWithClear />
          {showFilters &&
            <Grid ml='-15px' position='absolute'>
              <Filters
                allValidators={searchKeyword ? searchedValidators : allValidators}
                allValidatorsIdentities={allValidatorsIdentities}
                apply={apply}
                filters={filters}
                newSelectedValidators={newSelectedValidators}
                onLimitValidatorsPerOperator={onLimitValidatorsPerOperator}
                setApply={setApply}
                setFilteredValidators={setFilteredValidators}
                setFilters={setFilters}
                setNewSelectedValidators={setNewSelectedValidators}
                setShow={setShowFilters}
                setSortValue={setSortValue}
                show={showFilters}
                sortValue={sortValue}
                stakingConsts={stakingConsts}
              />
            </Grid>
          }
        </Grid>
        <PButton
          _onClick={() => setShowReview(true)}
          disabled={!newSelectedValidators?.length}
          text={t<string>('Next')}
        />
      </Popup>
      {showReview && newSelectedValidators &&
        <Review
          address={address}
          allValidators={searchKeyword ? searchedValidators : allValidators}
          api={api}
          newSelectedValidators={newSelectedValidators}
          poolId={poolId}
          setShow={setShowReview}
          show={showReview}
          staked={staked}
          stakingConsts={stakingConsts}
        />
      }
    </Motion>
  );
}
