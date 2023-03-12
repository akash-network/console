import React, { useMemo } from 'react';
import { useRecoilValue } from 'recoil';
import { aktMarketCap, keplrState } from '../recoil/atoms';
import { Box, Button, Stack, Typography } from '@mui/material';
import { DeploymentTable } from '../components/DeploymentTable';
import useDeploymentData from '../hooks/useDeploymentData';
import Loading from '../components/Loading';
import { WordSwitch } from '../components/Switch/WordSwitch';
import { PlaceholderCard } from '../components/PlaceholderCard';
import { Icon } from '../components/Icons';
import { useNavigate } from 'react-router-dom';
import { useWallet } from '../hooks/useWallet';

type MyDeploymentsPlaceholderProps = {
  hidden: number,
}

const MyDeploymentsPlaceholder: React.FC<MyDeploymentsPlaceholderProps> = ({ hidden }) => {
  const navigate = useNavigate();
  const { isConnected, connect } = useWallet();

  const handleCreateDeployment = () => {
    navigate('/new-deployment');
  }

  const handleConnectWallet = () => {
    connect();
  }

  return <PlaceholderCard
    icon="newDeploy"
    title="Nothing here yet">
    <Typography variant="body2">
      {(hidden > 0
        ? <>No active deployments to show for this wallet.<br />Create a new deployment, or view past deployments.</>
        : <>No deployments to show for this wallet.<br />Create a new deployment to get started.</>
      )}
    </Typography >
    <Stack direction="row" padding="1.5rem" gap="1rem" justifyContent="center">
      {isConnected
        ? (
          <Button variant="contained" onClick={handleCreateDeployment}>
            <Box paddingRight="0.5rem">
              <Icon type="add" />
            </Box>
            Create New Deployment
          </Button>
        )
        : (
          <Button variant="contained" onClick={handleConnectWallet}>
            Connect Wallet
          </Button>
        )
      }
    </Stack>
  </PlaceholderCard >
}

const MyDeploymentsTable: React.FC<{ showAll: boolean }> = ({ showAll }) => {
  const keplr = useRecoilValue(keplrState);
  const akt = useRecoilValue(aktMarketCap);
  const deployments = useDeploymentData(keplr?.accounts[0].address);

  const tableData = useMemo(() => {
    const filtered = (
      deployments &&
      deployments.filter((deployment) => showAll || deployment.status === 1).map((obj) => obj)
    );

    return filtered;
  }, [deployments, showAll, akt]);

  if (!tableData || !deployments) {
    return <Loading />;
  }

  return <>
    {tableData.length > 0
      ? <DeploymentTable rows={tableData} showAll={showAll} />
      : <MyDeploymentsPlaceholder hidden={deployments.length - tableData.length} />
    }
  </>;
}

const MyDeployments: React.FC<{}> = () => {
  const [showAll, setShowAll] = React.useState(false);
  const wallet = useWallet();

  const handleToggleAll = (e: React.ChangeEvent<HTMLInputElement>) => {
    setShowAll(!e.target.checked);
  };

  return (
    <div>
      <Stack direction="row" spacing={1} alignItems="center" sx={{ marginBottom: '24px' }}>
        <WordSwitch on="Active only" off="All" checked={!showAll} onChange={handleToggleAll} />
      </Stack>
      {wallet.isConnected
        ? <MyDeploymentsTable showAll={showAll} />
        : <MyDeploymentsPlaceholder hidden={0} />
      }
    </div>
  );
};

export default MyDeployments;
