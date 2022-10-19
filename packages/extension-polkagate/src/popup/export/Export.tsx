// Copyright 2019-2022 @polkadot/extension-ui authors & contributors
// SPDX-License-Identifier: Apache-2.0

import { faExclamationTriangle } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { Grid, Typography, useTheme } from '@mui/material';
import { saveAs } from 'file-saver';
import React, { useCallback, useContext, useState } from 'react';
import { useParams } from 'react-router';

import { ActionContext, Address, ButtonWithCancel, InputWithLabel, Warning } from '../../components';
import useTranslation from '../../hooks/useTranslation';
import { exportAccount } from '../../messaging';
import { HeaderBrand, Password } from '../../partials';

interface Props {
  className?: string;
}

export default function Export({ className }: Props): React.ReactElement<Props> {
  const { t } = useTranslation();
  const { address } = useParams<{ address: string }>();
  const theme = useTheme();
  const onAction = useContext(ActionContext);
  const [isBusy, setIsBusy] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [pass, setPass] = useState('');
  const [isPasswordError, setIsPasswordError] = useState(false);

  const _goHome = useCallback(
    () => onAction('/'),
    [onAction]
  );

  const onPassChange = useCallback(
    (password: string | null) => {
      setPass(password);
      setIsPasswordError(false);
    }
    , []);

  const _onExportButtonClick = useCallback(
    (): void => {
      setIsBusy(true);

      exportAccount(address, pass)
        .then(({ exportedJson }) => {
          const blob = new Blob([JSON.stringify(exportedJson)], { type: 'application/json; charset=utf-8' });

          saveAs(blob, `${address}.json`);

          onAction('/');
        })
        .catch((err: Error) => {
          console.error(err);
          setIsPasswordError(true);
          setIsBusy(false);
        });
    },
    [address, onAction, pass]
  );

  return (
    <>
      <HeaderBrand
        onBackClick={_goHome}
        showBackArrow
        text={t<string>('Export account')}
      />
      {isPasswordError &&
        <Grid
          color='red'
          height='30px'
          m='auto'
          pt='5px'
          width='92%'
        >
          <Warning
            isBelowInput
            isDanger
            theme={theme}
          >
            {t<string>('You’ve used an incorrect password. Try again.')}
          </Warning>
        </Grid>
      }
      <Address
        address={address}
        showCopy
      />
      <Grid
        display='inline-flex'
        ml='6%'
        width='88%'
      >
        <FontAwesomeIcon
          className='warningImage'
          icon={faExclamationTriangle}
        />
        <Typography
          fontSize='14px'
          fontWeight={300}
          pl='10px'
          textAlign='left'
        >
          {t<string>('You are exporting your account. Keep it safe and don’t share it with anyone.')}
        </Typography>
      </Grid>
      {/* <Password
        label={t<string>('Create password')}
        onChange={onPassChange}
        onEnter={_onExportButtonClick}
      /> */}
      <Grid
        sx={{
          m: '20px auto',
          width: '92%'
        }}
      >
        <InputWithLabel
          isError={isPasswordError}
          label={t<string>('Password for this account')}
          onChange={onPassChange}
          setShowPassword={setShowPassword}
          showPassword={showPassword}
          type={showPassword ? 'text' : 'password'}
        />
        {isPasswordError && (
          <Warning
            isBelowInput
            isDanger
            theme={theme}
          >
            {t<string>('incorrect password')}
          </Warning>
        )}
      </Grid>
      <ButtonWithCancel
        _isBusy={isBusy}
        _onClick={_onExportButtonClick}
        _onClickCancel={_goHome}
        disabled={pass.length === 0 || !!isPasswordError}
        text={t<string>('Export')}
      />
    </>
  );
}
