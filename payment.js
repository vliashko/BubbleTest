async function checkExistingConnection() {
    const restored = await tonConnectUI.connectionRestored;
    if (restored) {
        console.log(
            'Connection restored. Wallet:',
            JSON.stringify({
                ...tonConnectUI.wallet,
                ...tonConnectUI.walletInfo,
            })
        );
    } else {
        console.log('Connection was not restored.');
    }

    return restored;
}

async function purchaseTON(data) {
    const parsedData = JSON.parse(data);
    const generatedPayload = parsedData.generatedPayload;
    const price = parsedData.price;
    
    if (!window.LUCKY) {
        window.LUCKY = { initializeSuccess: true, payload: generatedPayload };
    }

    if (!window.tonConnectUI) {
        window.tonConnectUI = new TON_CONNECT_UI.TonConnectUI({
            manifestUrl:
                'https://lucky-tg.s3.eu-central-1.amazonaws.com/manifest.json',
            buttonRootId: 'ton-connect',
        });

        window.addEventListener('transaction-signing-failed', (event) => {
            console.log('Transaction failed');
            window.UNITY_INSTANCE.SendMessage(
                "WebBridge",
                "Purchased",
                JSON.stringify({
                    boc: null,
                    proof: null,
                })
            );
        });

        tonConnectUI.onStatusChange((wallet) => {
            console.log('CHANGE', wallet);
            if (!wallet) return;

            if (
                wallet.connectItems?.tonProof &&
                'proof' in wallet.connectItems.tonProof
            ) {
                const proof = {
                    address: wallet.account.address,
                    network: wallet.account.chain,
                    public_key: wallet.account.publicKey,
                    proof: {
                        ...wallet.connectItems.tonProof.proof,
                        state_init: wallet.account.walletStateInit,
                    },
                };

                window.LUCKY.proof = proof;
                console.log(JSON.stringify(proof));
                console.log('proof success!');
                doTransaction();
            } else {
                console.log('no proof');
            }
        });
    }
    
    
    if (window.LUCKY.proof) {
        doTransaction();
        return;
    }

    const isConnection = await this.checkExistingConnection();
    if (isConnection) {
        await tonConnectUI.disconnect();
    }

    tonConnectUI.setConnectRequestParameters({
        state: 'ready',
        value: {
            tonProof: window.LUCKY.payload,
        },
    });

    await tonConnectUI.openSingleWalletModal('telegram-wallet');

    const unsubscribe = tonConnectUI.onSingleWalletModalStateChange(
        async (state) => {
            console.log('Modal state changed:', state);

            if (state.status === 'closed') {
                unsubscribe();
                if (state.closeReason === 'action-cancelled') {
                    if (!window.LUCKY.proof) {
                        window.UNITY_INSTANCE.SendMessage(
                            "WebBridge",
                            "Purchased",
                            JSON.stringify({
                                boc: null,
                                proof: null,
                            })
                        );
                    }
                    return;
                }


            }
        }
    );

    async function doTransaction() {
        const transaction = {
            validUntil: Math.floor(Date.now() / 1000) + 360,
            messages: [
                {
                    address: 'UQA6rx_H35iRtx5PuJCO6ewXKAvkNVOKB_UjjobiwWV8p4VO', //TODO
                    amount: price, //Toncoin in nanotons
                },
            ],
        };

        try {
            const result = await tonConnectUI.sendTransaction(transaction);
            console.log(
                'Transaction sent successfully',
                JSON.stringify(result)
            );

            const body = JSON.stringify({
                boc: result.boc,
                proof: window.LUCKY.proof,
            });

            window.UNITY_INSTANCE.SendMessage(
                "WebBridge",
                "Purchased",
                body
            );
        } catch(error) {
            window.UNITY_INSTANCE.SendMessage(
                "WebBridge",
                "Purchased",
                JSON.stringify({
                    boc: null,
                    proof: null,
                })
            );
            
            console.error(error);
        }
    }
}
window.checkExistingConnection = checkExistingConnection;
window.purchaseTON = purchaseTON;