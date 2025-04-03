"use client";
import { DynamicReactJson } from "../DynamicJsonView";
// v1beta1
import { MsgCloseBid } from "./akash/v1beta1/MsgCloseBid";
import { MsgCloseDeployment } from "./akash/v1beta1/MsgCloseDeployment";
import { MsgCloseGroup } from "./akash/v1beta1/MsgCloseGroup";
import { MsgCloseLease } from "./akash/v1beta1/MsgCloseLease";
import { MsgCreateBid } from "./akash/v1beta1/MsgCreateBid";
import { MsgCreateCertificate } from "./akash/v1beta1/MsgCreateCertificate";
import { MsgCreateDeployment } from "./akash/v1beta1/MsgCreateDeployment";
import { MsgCreateLease } from "./akash/v1beta1/MsgCreateLease";
import { MsgCreateProvider } from "./akash/v1beta1/MsgCreateProvider";
import { MsgDeleteProvider } from "./akash/v1beta1/MsgDeleteProvider";
import { MsgDeleteProviderAttributes } from "./akash/v1beta1/MsgDeleteProviderAttributes";
import { MsgDepositDeployment } from "./akash/v1beta1/MsgDepositDeployment";
import { MsgPauseGroup } from "./akash/v1beta1/MsgPauseGroup";
import { MsgRevokeCertificate } from "./akash/v1beta1/MsgRevokeCertificate";
import { MsgSignProviderAttributes } from "./akash/v1beta1/MsgSignProviderAttributes";
import { MsgStartGroup } from "./akash/v1beta1/MsgStartGroup";
import { MsgUpdateDeployment } from "./akash/v1beta1/MsgUpdateDeployment";
import { MsgUpdateProvider } from "./akash/v1beta1/MsgUpdateProvider";
import { MsgWithdrawLease } from "./akash/v1beta1/MsgWithdrawLease";
// v1beta2
import { MsgCloseBid as MsgCloseBid_v2 } from "./akash/v1beta2/MsgCloseBid";
import { MsgCloseDeployment as MsgCloseDeployment_v2 } from "./akash/v1beta2/MsgCloseDeployment";
import { MsgCloseGroup as MsgCloseGroup_v2 } from "./akash/v1beta2/MsgCloseGroup";
import { MsgCloseLease as MsgCloseLease_v2 } from "./akash/v1beta2/MsgCloseLease";
import { MsgCreateBid as MsgCreateBid_v2 } from "./akash/v1beta2/MsgCreateBid";
import { MsgCreateCertificate as MsgCreateCertificate_v2 } from "./akash/v1beta2/MsgCreateCertificate";
import { MsgCreateDeployment as MsgCreateDeployment_v2 } from "./akash/v1beta2/MsgCreateDeployment";
import { MsgCreateLease as MsgCreateLease_v2 } from "./akash/v1beta2/MsgCreateLease";
import { MsgCreateProvider as MsgCreateProvider_v2 } from "./akash/v1beta2/MsgCreateProvider";
import { MsgDeleteProvider as MsgDeleteProvider_v2 } from "./akash/v1beta2/MsgDeleteProvider";
import { MsgDeleteProviderAttributes as MsgDeleteProviderAttributes_v2 } from "./akash/v1beta2/MsgDeleteProviderAttributes";
import { MsgDepositDeployment as MsgDepositDeployment_v2 } from "./akash/v1beta2/MsgDepositDeployment";
import { MsgPauseGroup as MsgPauseGroup_v2 } from "./akash/v1beta2/MsgPauseGroup";
import { MsgRevokeCertificate as MsgRevokeCertificate_v2 } from "./akash/v1beta2/MsgRevokeCertificate";
import { MsgSignProviderAttributes as MsgSignProviderAttributes_v2 } from "./akash/v1beta2/MsgSignProviderAttributes";
import { MsgStartGroup as MsgStartGroup_v2 } from "./akash/v1beta2/MsgStartGroup";
import { MsgUpdateDeployment as MsgUpdateDeployment_v2 } from "./akash/v1beta2/MsgUpdateDeployment";
import { MsgUpdateProvider as MsgUpdateProvider_v2 } from "./akash/v1beta2/MsgUpdateProvider";
import { MsgWithdrawLease as MsgWithdrawLease_v2 } from "./akash/v1beta2/MsgWithdrawLease";
// v1beta3
import { MsgCloseBid as MsgCloseBid_v3 } from "./akash/v1beta3/MsgCloseBid";
import { MsgCloseDeployment as MsgCloseDeployment_v3 } from "./akash/v1beta3/MsgCloseDeployment";
import { MsgCloseGroup as MsgCloseGroup_v3 } from "./akash/v1beta3/MsgCloseGroup";
import { MsgCloseLease as MsgCloseLease_v3 } from "./akash/v1beta3/MsgCloseLease";
import { MsgCreateBid as MsgCreateBid_v3 } from "./akash/v1beta3/MsgCreateBid";
import { MsgCreateCertificate as MsgCreateCertificate_v3 } from "./akash/v1beta3/MsgCreateCertificate";
import { MsgCreateDeployment as MsgCreateDeployment_v3 } from "./akash/v1beta3/MsgCreateDeployment";
import { MsgCreateLease as MsgCreateLease_v3 } from "./akash/v1beta3/MsgCreateLease";
import { MsgCreateProvider as MsgCreateProvider_v3 } from "./akash/v1beta3/MsgCreateProvider";
import { MsgDeleteProvider as MsgDeleteProvider_v3 } from "./akash/v1beta3/MsgDeleteProvider";
import { MsgDeleteProviderAttributes as MsgDeleteProviderAttributes_v3 } from "./akash/v1beta3/MsgDeleteProviderAttributes";
import { MsgDepositDeployment as MsgDepositDeployment_v3 } from "./akash/v1beta3/MsgDepositDeployment";
import { MsgPauseGroup as MsgPauseGroup_v3 } from "./akash/v1beta3/MsgPauseGroup";
import { MsgRevokeCertificate as MsgRevokeCertificate_v3 } from "./akash/v1beta3/MsgRevokeCertificate";
import { MsgSignProviderAttributes as MsgSignProviderAttributes_v3 } from "./akash/v1beta3/MsgSignProviderAttributes";
import { MsgStartGroup as MsgStartGroup_v3 } from "./akash/v1beta3/MsgStartGroup";
import { MsgUpdateDeployment as MsgUpdateDeployment_v3 } from "./akash/v1beta3/MsgUpdateDeployment";
import { MsgUpdateProvider as MsgUpdateProvider_v3 } from "./akash/v1beta3/MsgUpdateProvider";
import { MsgWithdrawLease as MsgWithdrawLease_v3 } from "./akash/v1beta3/MsgWithdrawLease";
// v1beta4
import { MsgCloseBid as MsgCloseBid_v4 } from "./akash/v1beta4/MsgCloseBid";
import { MsgCloseLease as MsgCloseLease_v4 } from "./akash/v1beta4/MsgCloseLease";
import { MsgCreateBid as MsgCreateBid_v4 } from "./akash/v1beta4/MsgCreateBid";
import { MsgCreateLease as MsgCreateLease_v4 } from "./akash/v1beta4/MsgCreateLease";
import { MsgWithdrawLease as MsgWithdrawLease_v4 } from "./akash/v1beta4/MsgWithdrawLease";
import { MsgAcknowledgement } from "./generic/MsgAcknowledgement";
import { MsgBeginRedelegate } from "./generic/MsgBeginRedelegate";
import { MsgChannelCloseConfirm } from "./generic/MsgChannelCloseConfirm";
import { MsgChannelCloseInit } from "./generic/MsgChannelCloseInit";
import { MsgChannelOpenAck } from "./generic/MsgChannelOpenAck";
import { MsgChannelOpenConfirm } from "./generic/MsgChannelOpenConfirm";
import { MsgChannelOpenInit } from "./generic/MsgChannelOpenInit";
import { MsgChannelOpenTry } from "./generic/MsgChannelOpenTry";
import { MsgConnectionOpenAck } from "./generic/MsgConnectionOpenAck";
import { MsgConnectionOpenConfirm } from "./generic/MsgConnectionOpenConfirm";
import { MsgConnectionOpenInit } from "./generic/MsgConnectionOpenInit";
import { MsgConnectionOpenTry } from "./generic/MsgConnectionOpenTry";
import { MsgCreateClient } from "./generic/MsgCreateClient";
import { MsgCreateValidator } from "./generic/MsgCreateValidator";
import { MsgDelegate } from "./generic/MsgDelegate";
import { MsgDeposit } from "./generic/MsgDeposit";
import { MsgEditValidator } from "./generic/MsgEditValidator";
import { MsgFundCommunityPool } from "./generic/MsgFundCommunityPool";
import { MsgMultiSend } from "./generic/MsgMultiSend";
import { MsgRecvPacket } from "./generic/MsgRecvPacket";
import { MsgSend } from "./generic/MsgSend";
import { MsgSetWithdrawAddress } from "./generic/MsgSetWithdrawAddress";
import { MsgSubmitMisbehaviour } from "./generic/MsgSubmitMisbehaviour";
import { MsgSubmitProposal } from "./generic/MsgSubmitProposal";
import { MsgTimeout } from "./generic/MsgTimeout";
import { MsgTimeoutOnClose } from "./generic/MsgTimeoutOnClose";
import { MsgTransfer } from "./generic/MsgTransfer";
import { MsgUndelegate } from "./generic/MsgUndelegate";
import { MsgUnjail } from "./generic/MsgUnjail";
import { MsgUpdateClient } from "./generic/MsgUpdateClient";
import { MsgUpgradeClient } from "./generic/MsgUpgradeClient";
import { MsgVote } from "./generic/MsgVote";
import { MsgWithdrawDelegatorReward } from "./generic/MsgWithdrawDelegatorReward";
import { MsgWithdrawValidatorCommission } from "./generic/MsgWithdrawValidatorCommission";

import { useFriendlyMessageType } from "@/hooks/useFriendlyMessageType";
import type { TransactionMessage } from "@/types";

type Props = {
  message: TransactionMessage;
};

export const TxMessageRow: React.FunctionComponent<Props> = ({ message }) => {
  const friendlyType = useFriendlyMessageType(message.type);

  return (
    <div>
      <div className="mb-4 border-b border-b-muted-foreground/10 p-4 text-muted-foreground">{friendlyType}</div>

      <div className="break-all px-4 pb-4 pt-0">
        <TxMessage message={message} />
      </div>
    </div>
  );
};

type TxMessageProps = {
  message: TransactionMessage;
};
const TxMessage: React.FunctionComponent<TxMessageProps> = ({ message }) => {
  switch (message.type) {
    case "/cosmos.bank.v1beta1.MsgSend": // 9E0552141F53CDB5C535C73755C1D873B9781FB545E2F13A4DC6D0A76908A588
      return <MsgSend message={message} />;
    case "/cosmos.bank.v1beta1.MsgMultiSend": // 50AAE52BA7086C49A3D7ECEAAEDF76998129BB628DD3E4BFBB4EC52873FB885E
      return <MsgMultiSend message={message} />;
    case "/cosmos.distribution.v1beta1.MsgFundCommunityPool": // 7B5B2A574EF2C6396588686266F07CC9EDF00423DC4E273825C42429A88B2C2F
      return <MsgFundCommunityPool message={message} />;
    case "/cosmos.distribution.v1beta1.MsgSetWithdrawAddress": // EBFC70654B794185D50756EAF876E9B9F62D9BEF14DE8E27CB6F2A436B28B517
      return <MsgSetWithdrawAddress message={message} />;
    case "/cosmos.distribution.v1beta1.MsgWithdrawDelegatorReward": // 8024548CD2EFF13659EB80002CA3731E2F635B8C1C9E2DFE0C7220F529743235
      return <MsgWithdrawDelegatorReward message={message} />;
    case "/cosmos.distribution.v1beta1.MsgWithdrawValidatorCommission": // 9493A5A0E829050B4894D613345BD4E4021105519548D17D22A072C4B53F70E7
      return <MsgWithdrawValidatorCommission message={message} />;
    case "/cosmos.gov.v1beta1.MsgDeposit": // 98ED75B6F160CB6EC5EC6FA3A8352AAD1D090D470B2B9694E227726339E435C5
      return <MsgDeposit message={message} />;
    case "/cosmos.gov.v1beta1.MsgSubmitProposal": // 81006C190ED97B43E3F586BF2876723998C21AB676B11893D0532D48A353FD2F
      return <MsgSubmitProposal message={message} />;
    case "/cosmos.gov.v1beta1.MsgVote": // BA99265B00E346F8A3DA1BEC9EE08D957755361C4EAE5D704A95B6224579040E
      return <MsgVote message={message} />;
    case "/cosmos.staking.v1beta1.MsgBeginRedelegate": // B405A028719C2102E57A81C0796BA763EA4E02850164CD87871FF74B070ADF0C
      return <MsgBeginRedelegate message={message} />;
    case "/cosmos.staking.v1beta1.MsgCreateValidator": // FD062F7AA2C73C11D0762BCF6A96658D4CA6AA6BAAF8D0F8B17B7744D6E3B3F5
      return <MsgCreateValidator message={message} />;
    case "/cosmos.staking.v1beta1.MsgDelegate": // D50D12D264563D3CB0F9D6D80879A1BE85FD9AEBD4ADE8126176556A0C2C0EFE
      return <MsgDelegate message={message} />;
    case "/cosmos.staking.v1beta1.MsgEditValidator": // 6E9D20C623F27710365C3F5F5F31F5D8160C277E0D64BD6028888CB2F82C633F
      return <MsgEditValidator message={message} />;
    case "/cosmos.staking.v1beta1.MsgUndelegate": // D377D7F397173C765D288093B1F03EF22F6457844D76A44FD0486193E826C894
      return <MsgUndelegate message={message} />;
    case "/cosmos.slashing.v1beta1.MsgUnjail": // 72788A166E647BB8271AC8267231C8E6A6186C5D9C52908B1E134176443D00B5
      return <MsgUnjail message={message} />;
    case "/ibc.core.channel.v1.MsgChannelOpenInit": // 3DB7A2B95EDE93CDD426164943F1EA3F6403275B512FDD300EE62C3840D4DB2C
      return <MsgChannelOpenInit message={message} />;
    case "/ibc.core.channel.v1.MsgChannelOpenTry": // E89080A7032F675278B997CB9C9DCCF2A8F6501A11450FD90E4A25BA3EE59C90
      return <MsgChannelOpenTry message={message} />;
    case "/ibc.core.channel.v1.MsgChannelOpenAck": // 7FDCA742547DC91FEDFA20798F7036D30ECA1497DA774CABD1D37DFF65291E23
      return <MsgChannelOpenAck message={message} />;
    case "/ibc.core.channel.v1.MsgChannelOpenConfirm": // 24F851EA290C99D05B2A6E47473ADB2029275D592E2AC4420950475B0F929B1A
      return <MsgChannelOpenConfirm message={message} />;
    case "/ibc.core.channel.v1.MsgChannelCloseInit": // No TX
      return <MsgChannelCloseInit message={message} />;
    case "/ibc.core.channel.v1.MsgChannelCloseConfirm": // No TX
      return <MsgChannelCloseConfirm message={message} />;
    case "/ibc.core.channel.v1.MsgRecvPacket": // 63B341F12A4009DBABC275500B6BC3086C84681C42EC122ED4B6DCCC3502AA2A
      return <MsgRecvPacket message={message} />;
    case "/ibc.core.channel.v1.MsgTimeout": // F44F7036BEE538584E8AA8D19D8FA670B718AA16355ADBFF25F43402814B0B67
      return <MsgTimeout message={message} />;
    case "/ibc.core.channel.v1.MsgTimeoutOnClose": // No TX
      return <MsgTimeoutOnClose message={message} />;
    case "/ibc.core.channel.v1.MsgAcknowledgement": // 0DACE8966B9075C029B3F87900F8360C425F38505FA15F9E78AC20DB830E8B54
      return <MsgAcknowledgement message={message} />;
    case "/ibc.core.client.v1.MsgCreateClient": // 825ECB50EB0FAFBE72EC900FE9E98015348FBCBCC7DBC8179D656E83393B78AF
      return <MsgCreateClient message={message} />;
    case "/ibc.core.client.v1.MsgUpdateClient": // 5AC2730C38F2767BCA6812DA056401E7A8057AEB54312605DB2D2070C884FCC9
      return <MsgUpdateClient message={message} />;
    case "/ibc.core.client.v1.MsgUpgradeClient": // D58610C22DDA260E97C99AAE955DAC4751F5EC3128B28C85BA3B3E66AA557AD2
      return <MsgUpgradeClient message={message} />;
    case "/ibc.core.client.v1.MsgSubmitMisbehaviour": // No TX
      return <MsgSubmitMisbehaviour message={message} />;
    case "/ibc.core.connection.v1.MsgConnectionOpenInit": // 7E707AFAC58A97ED919654C1768EED5D5D53C19FEDF50608174E888DB3BBA9D2
      return <MsgConnectionOpenInit message={message} />;
    case "/ibc.core.connection.v1.MsgConnectionOpenTry": // 05439B33446FC851B51B292A2199229B11DDCEB635A6731A4938B41476C01171
      return <MsgConnectionOpenTry message={message} />;
    case "/ibc.core.connection.v1.MsgConnectionOpenAck": // 8C768F08B7A2DED485EDC4ADEDA67867A6674EDFF1E8C98D6D914BB89ACFCEE9
      return <MsgConnectionOpenAck message={message} />;
    case "/ibc.core.connection.v1.MsgConnectionOpenConfirm": // 2F6212C5827DD87B784ADCF4B4530B002EE2A815B67C9D2868DBE508EA94ED13
      return <MsgConnectionOpenConfirm message={message} />;
    case "/ibc.applications.transfer.v1.MsgTransfer": // DCBD6E451A7EF0B20EA26219E9D856F130D05FC38F4DA8AE2320EB59F0FF0FB8
      return <MsgTransfer message={message} />;

    // *******************
    // AKASH TYPES
    // *******************

    case "/akash.market.v1beta1.MsgCloseBid": // 7EB791286425C17E17FACAC37C0ED99EE99A5594EFED133C8695F132F5EBB770
      return <MsgCloseBid message={message} />;
    case "/akash.deployment.v1beta1.MsgCloseDeployment": // BD2A62990B5065AA321A428604827603206EBEC8091384C4C699E95194292548
      return <MsgCloseDeployment message={message} />;
    case "/akash.deployment.v1beta1.MsgCloseGroup": // 20F3A3C841CE190E13F6D96D792FCF785E4ECBC3D18DA39E69D473C098023D7B
      return <MsgCloseGroup message={message} />;
    case "/akash.market.v1beta1.MsgCloseLease": // D1BF1CA2384323AE4E53CA4D592C299C6DAB9DFABA9B0A3063897C4A8C1B8BDD
      return <MsgCloseLease message={message} />;
    case "/akash.market.v1beta1.MsgCreateBid": // A1513A7671DEB65A52E729C7A2557A84A50CE103118431ACF1B1B47D4946F57A
      return <MsgCreateBid message={message} />;
    case "/akash.cert.v1beta1.MsgCreateCertificate": // 4F38155867112CC6AEF70BAF6AD8BE97D41C0BA317FF8B1F3F54C7CC62640E4F
      return <MsgCreateCertificate message={message} />;
    case "/akash.deployment.v1beta1.MsgCreateDeployment": // F4E652D5E28E40C533CD5B4E557DBA476A7C1E1A8323052992462C0C3AA67FA9
      return <MsgCreateDeployment message={message} />;
    case "/akash.market.v1beta1.MsgCreateLease": // AB7CE62D6FE9448FE82FDCBCCDCAF63AEC628B9176EA48122C26B188508FB56D
      return <MsgCreateLease message={message} />;
    case "/akash.provider.v1beta1.MsgCreateProvider": // 1F82F736F1C4E1A8CBB6F6FBC8468AB625259072B379CA5A697B4DEBCE04A536
      return <MsgCreateProvider message={message} />;
    case "/akash.provider.v1beta1.MsgDeleteProvider":
      return <MsgDeleteProvider message={message} />;
    case "/akash.audit.v1beta1.MsgDeleteProviderAttributes": // 88554C32AF45F4AE961BEDB45B236A59D18E5C559355984CB6D334986B4FEC06
      return <MsgDeleteProviderAttributes message={message} />;
    case "/akash.deployment.v1beta1.MsgDepositDeployment": // 799C4904CC094FCDF8F538A35B16307C801F516356A2DD7912C2C7F7EC436507
      return <MsgDepositDeployment message={message} />;
    case "/akash.deployment.v1beta1.MsgPauseGroup": // AE8751F67C2D1380550308A7F9B68177F204D0BA6DE638C1898469ACB3C83FA4
      return <MsgPauseGroup message={message} />;
    case "/akash.cert.v1beta1.MsgRevokeCertificate": // B9FBFACBA724AA27865BA2968E876FBA362BDEBB398C9CB023E1C01877850FDE
      return <MsgRevokeCertificate message={message} />;
    case "/akash.audit.v1beta1.MsgSignProviderAttributes": // 547650D65F7B4972EA2C40C721F10EEFFFC579395FCE1F987F4192DECC5837A9
      return <MsgSignProviderAttributes message={message} />;
    case "/akash.deployment.v1beta1.MsgStartGroup": // CEE408E69BD8D692C85216A1993D3236CC688A363B838B3993FCFCAF4F7FCC92
      return <MsgStartGroup message={message} />;
    case "/akash.deployment.v1beta1.MsgUpdateDeployment": // 4913B4D05FC438E245A304F44100B8AA898DE7835ABBDC13A381C0B07581A0BB
      return <MsgUpdateDeployment message={message} />;
    case "/akash.provider.v1beta1.MsgUpdateProvider": // 93E029FC179ED84E3390C1796AD5C83E60EAC8D4421D00538B23EF296ED6985B
      return <MsgUpdateProvider message={message} />;
    case "/akash.market.v1beta1.MsgWithdrawLease": // B79D9B64BFFA5C1880253758281C8F3D20222EA5094BBC2D522BE820ABBFE7C1
      return <MsgWithdrawLease message={message} />;

    // *******************
    // AKASH V2 TYPES
    // *******************

    case "/akash.market.v1beta2.MsgCloseBid": // 3FAFB81B9C46E362963C1E524856FFEADCD382800046C83EE8A4123C3236A8E2
      return <MsgCloseBid_v2 message={message} />;
    case "/akash.deployment.v1beta2.MsgCloseDeployment": // BD2A62990B5065AA321A428604827603206EBEC8091384C4C699E95194292548
      return <MsgCloseDeployment_v2 message={message} />;
    case "/akash.deployment.v1beta2.MsgCloseGroup": // 20F3A3C841CE190E13F6D96D792FCF785E4ECBC3D18DA39E69D473C098023D7B
      return <MsgCloseGroup_v2 message={message} />;
    case "/akash.market.v1beta2.MsgCloseLease": // 882E12A27E945F681579C16C7DD84F8F47EF72BD343A39F03C315FB503330ECC
      return <MsgCloseLease_v2 message={message} />;
    case "/akash.market.v1beta2.MsgCreateBid": // 646A9333FA818A2C13C145D4570B53839675A78D1BB548EBD3D6438B16EAC686
      return <MsgCreateBid_v2 message={message} />;
    case "/akash.cert.v1beta2.MsgCreateCertificate": // 4F38155867112CC6AEF70BAF6AD8BE97D41C0BA317FF8B1F3F54C7CC62640E4F
      return <MsgCreateCertificate_v2 message={message} />;
    case "/akash.deployment.v1beta2.MsgCreateDeployment": // FA9BB5E1FBEDF2655C984A7A3126A6317A73C861C5127F52EA1B876E8CD4933C
      return <MsgCreateDeployment_v2 message={message} />;
    case "/akash.market.v1beta2.MsgCreateLease": // EA0CB8F0D56734594270EBB5A3C7849D7660D3B34DC1B7F6C6775B9D5ECA8785
      return <MsgCreateLease_v2 message={message} />;
    case "/akash.provider.v1beta2.MsgCreateProvider": // 996DD0F90F09E4ABE9583E0DCEF4F1A29D8F63711C0C83111E9EFAA9F3D5B66B
      return <MsgCreateProvider_v2 message={message} />;
    case "/akash.provider.v1beta2.MsgDeleteProvider":
      return <MsgDeleteProvider_v2 message={message} />;
    case "/akash.audit.v1beta2.MsgDeleteProviderAttributes": // 0E708A727028E976954B41C2B3E52D08246082EF6031C9BE629D9F8C7E037F70
      return <MsgDeleteProviderAttributes_v2 message={message} />;
    case "/akash.deployment.v1beta2.MsgDepositDeployment": // 9765F5F540AD14BD677E238A9CD50D1F42CE0EE32EE9DDB267C5C6AC87DFEC86
      return <MsgDepositDeployment_v2 message={message} />;
    case "/akash.deployment.v1beta2.MsgPauseGroup":
      return <MsgPauseGroup_v2 message={message} />;
    case "/akash.cert.v1beta2.MsgRevokeCertificate": // B9FBFACBA724AA27865BA2968E876FBA362BDEBB398C9CB023E1C01877850FDE
      return <MsgRevokeCertificate_v2 message={message} />;
    case "/akash.audit.v1beta2.MsgSignProviderAttributes": // 547650D65F7B4972EA2C40C721F10EEFFFC579395FCE1F987F4192DECC5837A9
      return <MsgSignProviderAttributes_v2 message={message} />;
    case "/akash.deployment.v1beta2.MsgStartGroup": // 542FB75797D6647B17BC529FF1C6D092A8E1B210EED31966F76D2A03C8EB3E79
      return <MsgStartGroup_v2 message={message} />;
    case "/akash.deployment.v1beta2.MsgUpdateDeployment": // 434C6D26B60E64AC9E1563A3F12F2A59C4C3134570044FBA5A46FDB30A34752C
      return <MsgUpdateDeployment_v2 message={message} />;
    case "/akash.provider.v1beta2.MsgUpdateProvider": // 81872E0273B71511F3F2B2F2971156EDAE8C0BDEE1FDF136C538A0E3C933D0DA
      return <MsgUpdateProvider_v2 message={message} />;
    case "/akash.market.v1beta2.MsgWithdrawLease": // F5DC09219E604843E55C49B8B66E1DAD9EF417EF8AD8207BB696CF3863985446
      return <MsgWithdrawLease_v2 message={message} />;

    // *******************
    // AKASH V3 TYPES
    // *******************

    case "/akash.market.v1beta3.MsgCloseBid": // 3FAFB81B9C46E362963C1E524856FFEADCD382800046C83EE8A4123C3236A8E2
      return <MsgCloseBid_v3 message={message} />;
    case "/akash.deployment.v1beta3.MsgCloseDeployment": // BD2A62990B5065AA321A428604827603206EBEC8091384C4C699E95194292548
      return <MsgCloseDeployment_v3 message={message} />;
    case "/akash.deployment.v1beta3.MsgCloseGroup": // 20F3A3C841CE190E13F6D96D792FCF785E4ECBC3D18DA39E69D473C098023D7B
      return <MsgCloseGroup_v3 message={message} />;
    case "/akash.market.v1beta3.MsgCloseLease": // 882E12A27E945F681579C16C7DD84F8F47EF72BD343A39F03C315FB503330ECC
      return <MsgCloseLease_v3 message={message} />;
    case "/akash.market.v1beta3.MsgCreateBid": // 646A9333FA818A2C13C145D4570B53839675A78D1BB548EBD3D6438B16EAC686
      return <MsgCreateBid_v3 message={message} />;
    case "/akash.cert.v1beta3.MsgCreateCertificate": // 4F38155867112CC6AEF70BAF6AD8BE97D41C0BA317FF8B1F3F54C7CC62640E4F
      return <MsgCreateCertificate_v3 message={message} />;
    case "/akash.deployment.v1beta3.MsgCreateDeployment": // FA9BB5E1FBEDF2655C984A7A3126A6317A73C861C5127F52EA1B876E8CD4933C
      return <MsgCreateDeployment_v3 message={message} />;
    case "/akash.market.v1beta3.MsgCreateLease": // EA0CB8F0D56734594270EBB5A3C7849D7660D3B34DC1B7F6C6775B9D5ECA8785
      return <MsgCreateLease_v3 message={message} />;
    case "/akash.provider.v1beta3.MsgCreateProvider": // 996DD0F90F09E4ABE9583E0DCEF4F1A29D8F63711C0C83111E9EFAA9F3D5B66B
      return <MsgCreateProvider_v3 message={message} />;
    case "/akash.provider.v1beta3.MsgDeleteProvider":
      return <MsgDeleteProvider_v3 message={message} />;
    case "/akash.audit.v1beta3.MsgDeleteProviderAttributes": // 0E708A727028E976954B41C2B3E52D08246082EF6031C9BE629D9F8C7E037F70
      return <MsgDeleteProviderAttributes_v3 message={message} />;
    case "/akash.deployment.v1beta3.MsgDepositDeployment": // 9765F5F540AD14BD677E238A9CD50D1F42CE0EE32EE9DDB267C5C6AC87DFEC86
      return <MsgDepositDeployment_v3 message={message} />;
    case "/akash.deployment.v1beta3.MsgPauseGroup":
      return <MsgPauseGroup_v3 message={message} />;
    case "/akash.cert.v1beta3.MsgRevokeCertificate": // B9FBFACBA724AA27865BA2968E876FBA362BDEBB398C9CB023E1C01877850FDE
      return <MsgRevokeCertificate_v3 message={message} />;
    case "/akash.audit.v1beta3.MsgSignProviderAttributes": // 547650D65F7B4972EA2C40C721F10EEFFFC579395FCE1F987F4192DECC5837A9
      return <MsgSignProviderAttributes_v3 message={message} />;
    case "/akash.deployment.v1beta3.MsgStartGroup": // 542FB75797D6647B17BC529FF1C6D092A8E1B210EED31966F76D2A03C8EB3E79
      return <MsgStartGroup_v3 message={message} />;
    case "/akash.deployment.v1beta3.MsgUpdateDeployment": // 434C6D26B60E64AC9E1563A3F12F2A59C4C3134570044FBA5A46FDB30A34752C
      return <MsgUpdateDeployment_v3 message={message} />;
    case "/akash.provider.v1beta3.MsgUpdateProvider": // 81872E0273B71511F3F2B2F2971156EDAE8C0BDEE1FDF136C538A0E3C933D0DA
      return <MsgUpdateProvider_v3 message={message} />;
    case "/akash.market.v1beta3.MsgWithdrawLease": // F5DC09219E604843E55C49B8B66E1DAD9EF417EF8AD8207BB696CF3863985446
      return <MsgWithdrawLease_v3 message={message} />;

    // *******************
    // AKASH V4 TYPES
    // *******************

    case "/akash.market.v1beta4.MsgCloseBid":
      return <MsgCloseBid_v4 message={message} />;
    case "/akash.market.v1beta4.MsgCloseLease":
      return <MsgCloseLease_v4 message={message} />;
    case "/akash.market.v1beta4.MsgCreateBid":
      return <MsgCreateBid_v4 message={message} />;
    case "/akash.market.v1beta4.MsgCreateLease":
      return <MsgCreateLease_v4 message={message} />;
    case "/akash.market.v1beta4.MsgWithdrawLease":
      return <MsgWithdrawLease_v4 message={message} />;

    default:
      return <DynamicReactJson src={JSON.parse(JSON.stringify(message?.data))} />;
  }
};
