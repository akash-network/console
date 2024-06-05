"use client";
import { useRef, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { FormattedDate } from "react-intl";
import FormControl from "@mui/material/FormControl";
import InputLabel from "@mui/material/InputLabel";
import MenuItem from "@mui/material/MenuItem";
import Select from "@mui/material/Select";
import TextField from "@mui/material/TextField";
import { addYears, format } from "date-fns";
import { event } from "nextjs-google-analytics";

import { LinkTo } from "@src/components/shared/LinkTo";
import { Popup } from "@src/components/shared/Popup";
import { Alert } from "@src/components/ui/alert";
import { useWallet } from "@src/context/WalletProvider";
import { getUsdcDenom, useUsdcDenom } from "@src/hooks/useDenom";
import { useDenomData } from "@src/hooks/useWalletBalance";
import { GrantType } from "@src/types/grant";
import { AnalyticsEvents } from "@src/utils/analytics";
import { uAktDenom } from "@src/utils/constants";
import { denomToUdenom } from "@src/utils/mathHelpers";
import { aktToUakt, coinToDenom } from "@src/utils/priceUtils";
import { TransactionMessageData } from "@src/utils/TransactionMessageData";
import { handleDocClick } from "@src/utils/urlUtils";
type GrantFormValues = {
  token: string;
  amount: number;
  expiration: string;
  useDepositor: boolean;
  granteeAddress: string;
};

type Props = {
  address: string;
  editingGrant?: GrantType | null;
  onClose: () => void;
};

const supportedTokens = [
  { id: "akt", label: "AKT" },
  { id: "usdc", label: "USDC" }
];

export const GrantModal: React.FunctionComponent<Props> = ({ editingGrant, address, onClose }) => {
  const formRef = useRef<HTMLFormElement>(null);
  const [error, setError] = useState("");
  const { signAndBroadcastTx } = useWallet();
  const usdcDenom = useUsdcDenom();
  const { handleSubmit, control, watch, clearErrors, setValue } = useForm<GrantFormValues>({
    defaultValues: {
      token: editingGrant ? (editingGrant.authorization.spend_limit.denom === usdcDenom ? "usdc" : "akt") : "akt",
      amount: editingGrant ? coinToDenom(editingGrant.authorization.spend_limit) : 0,
      expiration: format(addYears(new Date(), 1), "yyyy-MM-dd'T'HH:mm"),
      useDepositor: false,
      granteeAddress: editingGrant?.grantee ?? ""
    }
  });
  const { amount, granteeAddress, expiration, token } = watch();
  const selectedToken = supportedTokens.find(x => x.id === token);
  const denom = token === "akt" ? uAktDenom : usdcDenom;
  const denomData = useDenomData(denom);

  const onDepositClick = event => {
    event.preventDefault();
    formRef.current?.dispatchEvent(new Event("submit", { cancelable: true, bubbles: true }));
  };

  const onSubmit = async ({ amount, expiration, granteeAddress }: GrantFormValues) => {
    setError("");
    clearErrors();
    const spendLimit = token === "akt" ? aktToUakt(amount) : denomToUdenom(amount);
    const usdcDenom = getUsdcDenom();
    const denom = token === "akt" ? uAktDenom : usdcDenom;

    const expirationDate = new Date(expiration);
    const message = TransactionMessageData.getGrantMsg(address, granteeAddress, spendLimit, expirationDate, denom);
    const response = await signAndBroadcastTx([message]);

    if (response) {
      event(AnalyticsEvents.AUTHORIZE_SPEND, {
        category: "deployments",
        label: "Authorize wallet to spend on deployment deposits"
      });

      onClose();
    }
  };

  const onBalanceClick = () => {
    clearErrors();
    setValue("amount", denomData?.inputMax || 0);
  };

  return (
    <Popup
      fullWidth
      open
      variant="custom"
      actions={[
        {
          label: "Cancel",
          color: "primary",
          variant: "text",
          side: "left",
          onClick: onClose
        },
        {
          label: "Grant",
          color: "secondary",
          variant: "default",
          side: "right",
          disabled: !amount,
          onClick: onDepositClick
        }
      ]}
      onClose={onClose}
      maxWidth="sm"
      enableCloseOnBackdropClick
      title="Authorize Spending"
    >
      <form onSubmit={handleSubmit(onSubmit)} ref={formRef}>
        <Alert
          className="mb-4"
          // severity="info"
        >
          <p className="text-sm text-muted-foreground">
            <LinkTo onClick={ev => handleDocClick(ev, "https://akash.network/docs/network-features/authorized-spend/")}>Authorized Spend</LinkTo> allows users
            to authorize spend of a set number of tokens from a source wallet to a destination, funded wallet. The authorized spend is restricted to Akash
            deployment activities and the recipient of the tokens would not have access to those tokens for other operations.
          </p>
        </Alert>

        <div className="mb-2 mt-2 text-right">
          <LinkTo onClick={() => onBalanceClick()}>
            Balance: {denomData?.balance} {denomData?.label}
          </LinkTo>
        </div>

        <FormControl className="mb-4 flex flex-row items-center" fullWidth>
          <InputLabel id="grant-token">Token</InputLabel>
          <Controller
            control={control}
            name="token"
            defaultValue=""
            rules={{
              required: true
            }}
            render={({ fieldState, field }) => {
              return (
                <Select {...field} labelId="grant-token" label="Token" size="medium" error={!!fieldState.error}>
                  {supportedTokens.map(token => (
                    <MenuItem key={token.id} value={token.id}>
                      {token.label}
                    </MenuItem>
                  ))}
                </Select>
              );
            }}
          />

          <Controller
            control={control}
            name="amount"
            rules={{
              required: true
            }}
            render={({ fieldState, field }) => {
              const helperText = fieldState.error?.type === "validate" ? "Invalid amount." : "Amount is required.";

              return (
                <TextField
                  {...field}
                  type="number"
                  variant="outlined"
                  label="Spending Limit"
                  autoFocus
                  error={!!fieldState.error}
                  helperText={fieldState.error && helperText}
                  inputProps={{ min: 0, step: 0.000001, max: denomData?.inputMax }}
                  sx={{ flexGrow: 1, marginLeft: "1rem" }}
                />
              );
            }}
          />
        </FormControl>

        <FormControl className="mb-4" fullWidth>
          <Controller
            control={control}
            name="granteeAddress"
            defaultValue=""
            rules={{
              required: true
            }}
            render={({ fieldState, field }) => {
              return (
                <TextField
                  {...field}
                  type="text"
                  variant="outlined"
                  label="Grantee Address"
                  disabled={!!editingGrant}
                  error={!!fieldState.error}
                  helperText={fieldState.error && "Grantee address is required."}
                />
              );
            }}
          />
        </FormControl>

        <FormControl className="mb-4" fullWidth>
          <Controller
            control={control}
            name="expiration"
            rules={{
              required: true
            }}
            render={({ fieldState, field }) => {
              return (
                <TextField
                  {...field}
                  type="datetime-local"
                  variant="outlined"
                  label="Expiration"
                  error={!!fieldState.error}
                  helperText={fieldState.error && "Expiration is required."}
                />
              );
            }}
          />
        </FormControl>

        {!!amount && granteeAddress && (
          <Alert
          // severity="info"
          >
            <p className="text-sm text-muted-foreground">
              This address will be able to spend up to {amount} {selectedToken?.label} on your behalf ending on{" "}
              <FormattedDate value={expiration} year="numeric" month="2-digit" day="2-digit" hour="2-digit" minute="2-digit" />.
            </p>
          </Alert>
        )}

        {error && <Alert variant="warning">{error}</Alert>}
      </form>
    </Popup>
  );
};
