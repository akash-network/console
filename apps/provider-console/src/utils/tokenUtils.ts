import { jwtDecode } from 'jwt-decode';

import authClient from './authClient';

interface DecodedToken {
  exp: number;
}

export async function checkAndRefreshToken(): Promise<string | null> {
  const accessToken = localStorage.getItem('accessToken');

  if (!accessToken) {
    return null;
  }

  try {
    const decodedToken = jwtDecode<DecodedToken>(accessToken);
    const currentTime = Math.floor(Date.now() / 1000);

    if (decodedToken.exp > currentTime) {
      return accessToken;
    }

    const refreshToken = localStorage.getItem('refreshToken');
    const walletAddress = localStorage.getItem('walletAddress');

    if (!refreshToken || !walletAddress) {
      throw new Error('Refresh token or wallet address not found');
    }

    const refreshResponse: any = await authClient.post('/auth/refresh', {
      refresh_token: refreshToken,
      address: walletAddress,
    });

    if (refreshResponse.status === 'success') {
      const newAccessToken = refreshResponse.data.access_token;
      const newRefreshToken = refreshResponse.data.refresh_token;

      localStorage.setItem('accessToken', newAccessToken);
      localStorage.setItem('refreshToken', newRefreshToken);

      return newAccessToken;
    } else {
      throw new Error('Refresh token failed');
    }
  } catch (error) {
    console.error('Error checking or refreshing token:', error);
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
    localStorage.removeItem('walletAddress');
    return null;
  }
}

