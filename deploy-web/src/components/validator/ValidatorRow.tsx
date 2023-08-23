import TableCell from "@mui/material/TableCell";
import Link from "next/link";
import { ValidatorSummaryDetail } from "@src/types/validator";
import { udenomToDenom } from "@src/utils/mathHelpers";
import { AKTLabel } from "@src/components/shared/AKTLabel";
import { FormattedNumber } from "react-intl";
import { UrlService } from "@src/utils/urlUtils";
import { Avatar, Box, ClickAwayListener, IconButton, lighten, MenuItem, MenuList, Paper, Popper, useTheme } from "@mui/material";
import { makeStyles } from "tss-react/mui";
import { getShortText } from "@src/hooks/useShortText";
import { CustomTableRow } from "../shared/CustomTable";
import { AKTAmount } from "../shared/AKTAmount";
import { useKeplr } from "@src/context/KeplrWalletProvider";
import MoreVertIcon from "@mui/icons-material/MoreVert";
import { useState } from "react";
import { usePopupState, bindTrigger, bindPopper } from "material-ui-popup-state/hooks";
import { event } from "nextjs-google-analytics";
import { AnalyticsEvents } from "@src/utils/analytics";
import { DelegateModal } from "./DelegateModal";
import { RedelegateModal } from "./RedelegateModal";
import { MsgWithdrawDelegatorReward } from "cosmjs-types/cosmos/distribution/v1beta1/tx";

type Props = {
  errors?: string;
  validator: ValidatorSummaryDetail;
  reward?: number;
  delegatedAmount?: number;
};

const useStyles = makeStyles()(theme => ({}));

export const ValidatorRow: React.FunctionComponent<Props> = ({ validator, reward, delegatedAmount }) => {
  const [isShowingDelegateModal, setIsShowingDelegateModal] = useState<boolean>(false);
  const [isShowingRedelegateModal, setIsShowingRedelegateModal] = useState<boolean>(false);
  const popupState = usePopupState({ variant: "popper", popupId: "delegationActionMenu" });
  const theme = useTheme();
  const { classes } = useStyles();
  const { address, signAndBroadcastTx } = useKeplr();
  const isTop10 = validator.rank <= 10;

  async function claimClick() {
    await signAndBroadcastTx([
      {
        typeUrl: "/cosmos.distribution.v1beta1.MsgWithdrawDelegatorReward",
        value: MsgWithdrawDelegatorReward.fromJSON({
          delegatorAddress: address,
          validatorAddress: validator.operatorAddress
        })
      }
    ]);

    event(AnalyticsEvents.VALIDATORS_CLAIM_REWARDS, {
      category: "validators",
      label: "Claim validator rewards"
    });
  }

  function onDelegateModalClose() {
    setIsShowingDelegateModal(false);
  }

  function onRedelegateModalClose() {
    setIsShowingRedelegateModal(false);
  }

  return (
    <CustomTableRow>
      <TableCell>
        <Box
          sx={{
            width: "1.5rem",
            height: "1.5rem",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: isTop10 ? theme.palette.secondary.main : lighten(theme.palette.secondary.main, 0.9),
            color: isTop10 ? theme.palette.secondary.contrastText : theme.palette.secondary.main,
            borderRadius: "50%",
            fontWeight: "bold",
            fontSize: ".75rem"
          }}
        >
          {validator.rank}
        </Box>
      </TableCell>
      <TableCell>
        <Box sx={{ display: "flex", alignItems: "center" }}>
          <Link href={UrlService.validator(validator.operatorAddress)} style={{ display: "inline-flex", alignItems: "center" }}>
            <Box mr={1}>
              <Avatar src={validator.keybaseAvatarUrl} sx={{ width: "26px", height: "26px" }} />
            </Box>
            {getShortText(validator.moniker, 20)}
          </Link>
        </Box>
      </TableCell>
      <TableCell align="right">
        <FormattedNumber value={udenomToDenom(validator.votingPower)} maximumFractionDigits={0} />
        &nbsp;
        <AKTLabel />
        &nbsp;(
        <FormattedNumber style="percent" value={validator.votingPowerRatio} minimumFractionDigits={2} />)
      </TableCell>
      <TableCell align="center">
        <FormattedNumber style="percent" value={validator.commission} minimumFractionDigits={2} />
      </TableCell>

      {address && (
        <>
          <TableCell align="right">{!!delegatedAmount && <AKTAmount uakt={delegatedAmount} showAKTLabel />}</TableCell>
          <TableCell align="right">
            <>
              {!!reward && <AKTAmount uakt={reward} showAKTLabel />}
              <DelegateModal
                onClose={onDelegateModalClose}
                open={isShowingDelegateModal}
                validatorAddress={validator.operatorAddress}
                validatorMoniker={validator.moniker}
              />
              <RedelegateModal
                onClose={onRedelegateModalClose}
                open={isShowingRedelegateModal}
                validatorAddress={validator.operatorAddress}
                validatorMoniker={validator.moniker}
                delegatedAmount={delegatedAmount}
              />
              <IconButton {...bindTrigger(popupState)}>
                <MoreVertIcon />
              </IconButton>
              <Popper {...(bindPopper(popupState) as any)}>
                <Paper elevation={2}>
                  <ClickAwayListener onClickAway={() => popupState.close()}>
                    <MenuList>
                      {!!reward && <MenuItem onClick={claimClick}>Claim</MenuItem>}
                      <MenuItem
                        onClick={() => {
                          setIsShowingDelegateModal(true);

                          event(AnalyticsEvents.VALIDATORS_DELEGATE_CLICK, {
                            category: "validators",
                            label: "Delegate to validator click"
                          });
                        }}
                      >
                        Delegate
                      </MenuItem>
                      {!!delegatedAmount && (
                        <MenuItem
                          onClick={() => {
                            setIsShowingRedelegateModal(true);

                            event(AnalyticsEvents.VALIDATORS_REDELEGATE_CLICK, {
                              category: "validators",
                              label: "Redelegate to validator click"
                            });
                          }}
                        >
                          Redelegate
                        </MenuItem>
                      )}
                    </MenuList>
                  </ClickAwayListener>
                </Paper>
              </Popper>
            </>
          </TableCell>
        </>
      )}
    </CustomTableRow>
  );
};
