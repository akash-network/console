import React, { lazy, Suspense, useEffect } from 'react';
import './style/app.css';
import { BrowserRouter as Router, Route, Routes, useNavigate } from 'react-router-dom';
import SideNav from './components/SideNav';
import Keplr from './components/KeplrLogin';
import Logging from './components/Logging';
import { useRecoilState } from 'recoil';
import { activeCertificate, keplrState } from './recoil/atoms';
import { getKeplr } from './_helpers/keplr-utils';
import { loadActiveCertificate } from './recoil/api';
import { useWallet } from './hooks/useWallet';

// Lazy loading all pages in appropriate time
const DeploymentStepper = lazy(() => import("./components/DeploymentStepper"));
const Deployment = lazy(() => import("./components/Deployment"));
const ReDeploy = lazy(() => import("./pages/ReDeploy"));
const Settings = lazy(() => import("./pages/Settings"));
const MyDeployments = lazy(() => import("./pages/MyDeployments"));
const UpdateDeployment = lazy(() => import("./pages/UpdateDeployment"));
const CustomApp = lazy(() => import("./pages/CustomApp"));
const Provider = lazy(() => import("./pages/Provider"));

const Welcome = () => {
  const navigate = useNavigate();

  useEffect(() => {
    navigate('/new-deployment');
  }, []);

  return <></>;
};

const AppRouter = () => {
  return (
    <Router>
      <div className="console-container">
        <SideNav>
          <Routes>
            <Route path="/" element={<Welcome />} />
            <Route path="new-deployment">
              <Route path="" element={<DeploymentStepper />} />
              <Route path=":folderName/" element={<DeploymentStepper />} />
              <Route path=":folderName/:templateId" element={<DeploymentStepper />} />
              <Route path=":folderName/:templateId/:intentId" element={<DeploymentStepper />} />
              <Route path="custom-sdl" element={<CustomApp />} />
              <Route path="custom-sdl/:intentId" element={<CustomApp />} />
            </Route>
            <Route
              path="configure-deployment/:dseq/"
              element={
                <DeploymentStepper />
              }
            />
            <Route
              path="provider/:providerId"
              element={
                <Provider />
              }
            />
            <Route path="my-deployments">
              <Route
                path=""
                element={
                  <MyDeployments />
                }
              />
              <Route
                path=":dseq"
                element={
                  <Deployment />
                }
              />
              <Route
                path=":dseq/update-deployment"
                element={
                  <UpdateDeployment />
                }
              />
              <Route
                path=":dseq/re-deploy"
                element={
                  <ReDeploy />
                }
              />
            </Route>
            <Route
              path="settings"
              element={
                <Settings />
              }
            />
          </Routes>
        </SideNav>
      </div>
    </Router>
  );
};

export default function App() {
  const [keplr, setKeplr] = useRecoilState(keplrState);
  const [certificate, setCertificate] = useRecoilState(activeCertificate);
  const { isConnected } = useWallet();

  useEffect(() => {
    let timer: NodeJS.Timeout | null = null;

    const checkKeplr = async () => {
      if (isConnected && window.keplr && keplr.accounts.length > 0 && keplr.accounts[0].address) {
        const wallet = window.keplr.getOfflineSigner('akashnet-2');

        try {
          const accounts = await wallet.getAccounts();

          // if the wallet's changed, update the atom
          if (accounts[0].address !== keplr.accounts[0].address) {
            setKeplr(await getKeplr());
            setCertificate(await loadActiveCertificate(accounts[0].address));
          } else if (certificate.$type === 'Invalid Certificate') {
            const activeCert = await loadActiveCertificate(keplr.accounts[0].address);

            if (activeCert.$type === 'TLS Certificate') {
              setCertificate(activeCert);
            }
          }
        } catch (err) {
          console.warn('unable to update keplr status', err)
        }
      }

      // schedule next check
      timer = setTimeout(checkKeplr, 2000);
    };

    // start polling
    checkKeplr();

    return () => {
      if (timer) {
        clearTimeout(timer);
      }
    }
  }, [isConnected, certificate, setCertificate, keplr, setKeplr]);

  return (
    <Logging>
      <Suspense fallback={<div>Loading...</div>}>
        <Keplr>
          <AppRouter />
        </Keplr>
      </Suspense>
    </Logging>
  );
}
