/* eslint-disable @typescript-eslint/no-unused-vars */
"use client";

import {
    WalletDisconnectButton,
    WalletMultiButton
} from '@solana/wallet-adapter-react-ui';
import { useWallet } from '@solana/wallet-adapter-react';
import { useEffect, useState } from 'react';
import axios from 'axios';
import { BASE_URL } from '@/utils';


export const Appbar = () => {
    const { publicKey, signMessage } = useWallet();
    const [loading, setLoading] = useState(false);

    async function signAndSend() {
        if (!publicKey || !signMessage) return;

        setLoading(true);
        try {
            const message = new TextEncoder().encode("Sign into cryptolabeler");
            const signature = await signMessage(message);

            const response = await axios.post(`${BASE_URL}/v1/user/signin`, {
                signature,
                publicKey: publicKey.toString()
            });

            localStorage.setItem("token", response.data.token);
        } catch (error) {
            console.error("Sign-in failed:", error);
        } finally {
            setLoading(false);
        }
    }

    useEffect(() => {
        if (publicKey) signAndSend();
    }, [publicKey]);

    return (
        <div className="flex justify-between border-b pb-2 pt-2">
            <div className="text-2xl text-black pl-4 flex justify-center pt-3">
                CryptoLabeler
            </div>
            <div className="text-xl text-black pr-4 pb-2">
                {publicKey ? <WalletDisconnectButton disabled={loading} /> : <WalletMultiButton />}
            </div>
        </div>
    );
};
