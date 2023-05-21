// Copyright 2019-2023 @polkadot/extension-polkagate authors & contributors
// SPDX-License-Identifier: Apache-2.0

/* eslint-disable react/jsx-max-props-per-line */

import { Grid, Typography } from '@mui/material';
import React, { useCallback, useState } from 'react';
import { STEPS } from '.';

import { Checkbox2 as Checkbox, PButton } from '../../../../components';
import { useTranslation } from '../../../../hooks';

interface Props {
  setStep: React.Dispatch<React.SetStateAction<number>>;
}

export default function About({ setStep }: Props): React.ReactElement {
  const { t } = useTranslation();
  const [dontDisplay, setDisplayText] = useState<boolean>(false);

  const UL = ({ notes, title }: { title?: string, notes: string[] }) => {
    return (
      <Grid container direction='column' pt='15px'>
        {title &&
          <Grid container item>
            <Typography fontSize='14px' fontWeight={500}>
              {title}
            </Typography>
          </Grid>
        }
        <Grid container item>
          <ul style={{ margin: 0, paddingLeft: '25px' }}>
            {notes.map((note, index) => (
              <li key={index}>
                <Typography fontSize='14px' fontWeight={400} lineHeight='20px' textAlign='left'>
                  {note}
                </Typography>
              </li>
            ))}
          </ul>
        </Grid>
      </Grid>
    );
  };

  const toggleShow = useCallback(() => setDisplayText(!dontDisplay), [dontDisplay]);
  const handleNext = useCallback(() => {
    // eslint-disable-next-line no-void
    dontDisplay && window.localStorage.setItem('cast_vote_about_disabled', 'true');
    setStep((step) => step + 1);
  }, [dontDisplay, setStep]);

  return (
    <Grid container direction='column'>
      <Grid container item justifyContent='center' pb='20px' pt='45px'>
        <Typography fontSize='22px' fontWeight={700}>
          {t<string>('Some important information')}
        </Typography>
      </Grid>
      <Grid container item sx={{ bgcolor: 'background.paper', border: 1, borderColor: 'secondary.light', borderRadius: '5px', pb: '15px', px: '15px' }}>
        <Grid container item>
          <UL
            notes={[t<string>('When voting on a referendum, locking tokens for a period boosts voting power, but users can also choose not to lock their tokens.')]}
          />
        </Grid>
        <Grid container item>
          <UL
            notes={[t<string>('After users vote for a referendum and the result aligns with their vote, they can unlock their tokens once the unlock period expires.')]}
          />
        </Grid>
        <Grid container item>
          <UL
            notes={[t<string>('You can remove your vote during ongoing or cancelled referenda, as well as after the referenda ends if it was opposed or lacked conviction.')]}
          />
        </Grid>
      </Grid>
      <Grid container item pt='25px'>
        <Checkbox
          checked={dontDisplay}
          iconStyle={{ transform: 'scale(1.2)' }}
          label={t<string>('Don\'t show this again.')}
          labelStyle={{ fontSize: '14px', marginLeft: '7px' }}
          onChange={toggleShow}
          style={{ width: '92%' }}
        />
      </Grid>
      <Grid container item>
        <PButton
          _ml={0}
          _mt='15px'
          _onClick={handleNext}
          _width={100}
          text={t<string>('Next')}
        />
      </Grid>
    </Grid>
  );
}
