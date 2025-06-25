import * as anchor from "@coral-xyz/anchor";
import {Program, Wallet, web3} from "@coral-xyz/anchor";
import { Claim } from "../target/types/claim";
import {before} from "mocha";
import {clusterApiUrl, Keypair, PublicKey} from "@solana/web3.js";
import {assert} from "chai";
import {BN} from "bn.js";
import nacl from "tweetnacl";

describe("claim", () => {
    // Configure the client to use the local cluster.
    const connection = new web3.Connection(clusterApiUrl("devnet"));
    const myWallet = Keypair.fromSecretKey(Uint8Array.from([137,201,74,114,111,20,163,211,95,120,169,189,184,75,236,254,53,24,161,194,101,138,44,242,175,98,68,140,209,102,140,51,9,99,199,69,150,19,164,38,103,84,153,176,157,119,116,29,87,255,34,140,54,205,129,53,160,56,172,68,141,24,234,4]));
    // const myWallet = Keypair.fromSecretKey(Uint8Array.from([5,203,58,216,48,159,97,233,129,12,165,186,219,67,167,35,127,162,170,95,231,200,138,115,10,107,241,59,215,156,92,8,11,178,171,201,216,84,91,126,144,91,183,177,10,89,32,8,122,121,46,144,176,215,240,58,176,55,75,175,133,192,153,105]));
    const wallet = new Wallet(myWallet);
    const provider = new anchor.AnchorProvider(connection, wallet)
    anchor.setProvider(provider);

    const program = anchor.workspace.Claim as Program<Claim>;

    const backWallet = Keypair.fromSecretKey(Uint8Array.from([178,108,149,10,119,180,144,213,150,64,79,90,83,181,225,246,252,21,137,81,29,176,186,59,36,227,200,234,131,180,33,154,8,222,44,136,46,141,119,142,11,191,195,119,31,20,191,244,77,87,161,36,209,227,135,176,83,69,16,145,70,123,132,53]));
    let globalState;
    let userState;
    let vault;

    before(async () => {
        globalState = PublicKey.findProgramAddressSync([Buffer.from("global")], program.programId);
        userState = PublicKey.findProgramAddressSync([Buffer.from("user"), provider.publicKey.toBuffer()], program.programId);
        vault = PublicKey.findProgramAddressSync([Buffer.from("vault")], program.programId);
    })

    it("Global State is initialized!", async () => {
        const globalStateAcc = await provider.connection.getAccountInfo(globalState[0]);
        if (globalStateAcc === null) {
            const initGlobal = await program.methods.initGlobal(backWallet.publicKey).rpc({commitment: "finalized"})
            console.log("InitGlobalIx tx signature: ", initGlobal);

            let globalStateStruct = await program.account.globalState.fetch(globalState[0])
            assert.equal(globalStateStruct.bump, globalState[1], "incorrect bump");
            assert.equal(globalStateStruct.vaultBump, vault[1], "incorrect vault bump");
            assert.equal(globalStateStruct.authority, provider.publicKey, "incorrect authority");
            assert.equal(globalStateStruct.backendAuthority, backWallet.publicKey, "incorrect backend authority");
            assert.equal(globalStateStruct.vault, vault[0], "incorrect vault");
            assert.equal(globalStateStruct.pause, false, "incorrect pause");
            assert.equal(globalStateStruct.dailyLimit, null, "incorrect daily limit");
            assert.equal(globalStateStruct.today, new BN(0), "incorrect today");
            assert.equal(globalStateStruct.todayTotal, new BN(0), "incorrect today total");
            assert.equal(globalStateStruct.claimRequestsLimit, null, "incorrect claim requests limit");

            let vaultAcc = await provider.connection.getAccountInfo(vault[0])
            let rent = await provider.connection.getMinimumBalanceForRentExemption(0)
            assert.equal(vaultAcc.lamports, rent, "incorrect vault balance");
            assert.equal(vaultAcc.data.length, 0, "incorrect vault data len");
        }

        try {
            await program.account.globalState.fetch(globalState[0])
        } catch (err) {
            throw new Error("Структура Global State не соответсвует ожидаемой");
        }

    });


    it("Global State is updated!", async () => {
        const newKp = Keypair.generate()

        const updateGlobal = await program.methods.updateGlobal({
            pause: true, // bool/null
            authority: null, // publicKey/null
            backendAuthority: newKp.publicKey, // publicKey/null
            dailyLimit: new BN(10000000000), // 10 SOL | BN/null
            claimRequestsLimit: 2 // number/null
        }).rpc({commitment: "finalized"})

        console.log("updateGlobalIx tx signature: ", updateGlobal);

        let globalStateStruct = await program.account.globalState.fetch(globalState[0])

        assert.equal(globalStateStruct.authority.toBase58, provider.publicKey.toBase58, "incorrect authority");
        assert.equal(globalStateStruct.backendAuthority.toBase58(), newKp.publicKey.toBase58(), "incorrect backend authority");
        assert.equal(globalStateStruct.pause, true, "incorrect pause");
        assert.ok(globalStateStruct.dailyLimit.eq(new BN(10000000000)), "incorrect daily limit");
        assert.equal(globalStateStruct.claimRequestsLimit, 2, "incorrect claim requests limit");

    });


    it("Global State updating with invalid authority", async () => {
        const fakeAuthority = Keypair.generate()
        let rent = await provider.connection.getMinimumBalanceForRentExemption(0)

        const depToFakeAuthIx = web3.SystemProgram.transfer({
            fromPubkey: provider.publicKey,
            toPubkey: fakeAuthority.publicKey,
            lamports: 5000 + rent
        })
        const transferTx = new web3.Transaction().add(depToFakeAuthIx);
        await provider.sendAndConfirm(transferTx, [], {commitment: "finalized"})

        const updateGlobalIx = await program.methods.updateGlobal({
            pause: false, // bool/null
            authority: fakeAuthority.publicKey, // publicKey/null
            backendAuthority: null, // publicKey/null
            dailyLimit: null, // 10 SOL | BN/null
            claimRequestsLimit: null // number/null
        }).instruction()

        updateGlobalIx.keys[0].pubkey = fakeAuthority.publicKey

        const fakeAuthorityUpdateTx = new web3.Transaction()
            .add(updateGlobalIx)

        try {
            await provider.connection.sendTransaction(fakeAuthorityUpdateTx, [fakeAuthority])
            throw new Error("Error was expected"); // провал, если ошибки не было
        }
        catch (err) {
            if (!err.message.includes("AnchorError caused by account: global_state. Error Code: ConstraintHasOne. Error Number: 2001. Error Message: A has one constraint was violated.")) {
                throw new Error("Not that error was expected");
            }
        }
    })


    it("regular claim", async () => {
        await program.methods.updateGlobal({
            pause: false, // bool/null
            authority: null, // publicKey/null
            backendAuthority: backWallet.publicKey, // publicKey/null
            dailyLimit: new BN(0), // 10 SOL | BN/null
            claimRequestsLimit: 0 // number/null
        }).rpc({commitment: "finalized"});

        let time = Math.trunc(Date.now() / 1000);
        let today = Math.trunc(time / 86400);
        let expectedClaimCount;
        let expectedTodayClaimedTotal
        let expectedToday;
        let total;
        let userWalletBefore = await provider.connection.getAccountInfo(provider.publicKey)
        let lamportsBefore = userWalletBefore.lamports;

        const userStateStructBefore = await program.account.userState.fetch(userState[0]);
        if (userStateStructBefore.today < new BN(today)) {
            expectedClaimCount = 1;
        } else {
            expectedClaimCount = userStateStructBefore.todayClaimCount + 1;
        }

        const userStateAccBefore = await provider.connection.getAccountInfo(userState[0]);
        if (userStateAccBefore === null) {
            total = BigInt(10000000);
            lamportsBefore -= await provider.connection.getMinimumBalanceForRentExemption(program.account.userState.size);
        } else {
            total = BigInt(10000000) + BigInt(userStateStructBefore.claimedTotal.toString())
        }

        const globalStateStructBefore = await program.account.globalState.fetch(globalState[0]);
        if (globalStateStructBefore.today < new BN(today)) {
            expectedToday = today;
            expectedTodayClaimedTotal = new BN(10000000);
        } else {
            expectedToday = globalStateStructBefore.today;
            expectedTodayClaimedTotal = globalStateStructBefore.todayTotal.add(new BN(10000000));
        }

        // message/ix params
        const deadline = BigInt((Math.trunc(Date.now() / 1000)) + 600) // 10 minutes from now
        const pubkey = provider.publicKey

        // creating message
        const buf_total = Buffer.alloc(8);
        const buf_deadline = Buffer.alloc(8);
        buf_total.writeBigUInt64LE(total)
        buf_deadline.writeBigUInt64LE(deadline)
        const b_total = Uint8Array.from(buf_total)
        const b_deadline = Uint8Array.from(buf_deadline)
        const MSG = new Uint8Array([...pubkey.toBytes(), 0xff, ...b_total, 0xff, ...b_deadline]);
        // sign message
        const signature = nacl.sign.detached(MSG, backWallet.secretKey);


        // Ed25519 instruction
        const edIx = anchor.web3.Ed25519Program.createInstructionWithPublicKey({
            publicKey: backWallet.publicKey.toBytes(),
            message: MSG,
            signature: signature,
        });

        const claim = await program.methods.claim().preInstructions([edIx]).rpc({commitment: "finalized"})
        console.log("claimIx tx signature: ", claim)

        let userWalletAfter = await provider.connection.getAccountInfo(provider.publicKey)
        let lamportsAfter = userWalletAfter.lamports;
        const userStatestructAfter = await program.account.userState.fetch(userState[0]);
        assert.equal(userStatestructAfter.bump, userState[1], "incorrect bump");
        assert.equal(userStatestructAfter.isInitialized, true, "incorrect is init");
        assert.equal(userStatestructAfter.claimedTotal, total, "incorrect claimed total");
        assert.ok(userStatestructAfter.today.eq(new BN(today)), "incorrect today");
        assert.equal(userStatestructAfter.todayClaimCount, expectedClaimCount, "incorrect today claimed count");
        assert.equal((lamportsBefore + 10000000 - 10000), lamportsAfter, "incorrect lamports balance");

        let globalStateStructAfter = await program.account.globalState.fetch(globalState[0]);
        assert.ok(globalStateStructAfter.today.eq(expectedToday), "incorrect today");
        assert.ok(globalStateStructAfter.todayTotal.eq(expectedTodayClaimedTotal), "incorrect today total");
    })


    it("fake backend authority signed claim", async () => {
        await program.methods.updateGlobal({
            pause: false, // bool/null
            authority: null, // publicKey/null
            backendAuthority: backWallet.publicKey, // publicKey/null
            dailyLimit: new BN(0), // 10 SOL | BN/null
            claimRequestsLimit: 0 // number/null
        }).rpc({commitment: "finalized"});

        let fakeBackendKp = Keypair.generate();
        let total;
        const userStateStructBefore = await program.account.userState.fetch(userState[0]);

        const userStateAccBefore = await provider.connection.getAccountInfo(userState[0]);
        if (userStateAccBefore === null) {
            total = BigInt(10000000);
        } else {
            total = BigInt(10000000) + BigInt(userStateStructBefore.claimedTotal.toString())
        }

        // message/ix params
        const deadline = BigInt((Math.trunc(Date.now() / 1000)) + 600) // 10 minutes from now
        const pubkey = provider.publicKey

        // creating message
        const buf_total = Buffer.alloc(8);
        const buf_deadline = Buffer.alloc(8);
        buf_total.writeBigUInt64LE(total)
        buf_deadline.writeBigUInt64LE(deadline)
        const b_total = Uint8Array.from(buf_total)
        const b_deadline = Uint8Array.from(buf_deadline)
        const MSG = new Uint8Array([...pubkey.toBytes(), 0xff, ...b_total, 0xff, ...b_deadline]);
        // sign message
        const signature = nacl.sign.detached(MSG, fakeBackendKp.secretKey);


        // Ed25519 instruction
        const edIx = anchor.web3.Ed25519Program.createInstructionWithPublicKey({
            publicKey: backWallet.publicKey.toBytes(),
            message: MSG,
            signature: signature,
        });


        try {
            await program.methods.claim().preInstructions([edIx]).rpc({commitment: "finalized"})
            throw new Error("Error was expected"); // провал, если ошибки не было
        }
        catch (err) {
            if (!err.message.includes("Transaction simulation failed: Error processing Instruction 0: custom program error: 0x2.")) {
                throw new Error("Not that error was expected");
            }
        }
    })


    it("exceeding daily total limit", async () => {
        let time = Math.trunc(Date.now() / 1000);
        let today = Math.trunc(time / 86400);
        let dailyLimit;

        const globalStateStruct = await program.account.globalState.fetch(globalState[0]);
        if (globalStateStruct.today < new BN(today)) {
            dailyLimit = new BN(10000000)
        } else {
            dailyLimit = globalStateStruct.todayTotal.add(new BN(10000000))
        }

        await program.methods.updateGlobal({
            pause: false,
            authority: null,
            backendAuthority: backWallet.publicKey,
            dailyLimit: dailyLimit,
            claimRequestsLimit: 0
        }).rpc({commitment: "finalized"});

        let total;
        const userStateStructBefore = await program.account.userState.fetch(userState[0]);

        const userStateAccBefore = await provider.connection.getAccountInfo(userState[0]);
        if (userStateAccBefore === null) {
            total = BigInt(10000001);
        } else {
            total = BigInt(10000001) + BigInt(userStateStructBefore.claimedTotal.toString())
        }

        // message/ix params
        const deadline = BigInt((Math.trunc(Date.now() / 1000)) + 600) // 10 minutes from now
        const pubkey = provider.publicKey

        // creating message
        const buf_total = Buffer.alloc(8);
        const buf_deadline = Buffer.alloc(8);
        buf_total.writeBigUInt64LE(total)
        buf_deadline.writeBigUInt64LE(deadline)
        const b_total = Uint8Array.from(buf_total)
        const b_deadline = Uint8Array.from(buf_deadline)
        const MSG = new Uint8Array([...pubkey.toBytes(), 0xff, ...b_total, 0xff, ...b_deadline]);
        // sign message
        const signature = nacl.sign.detached(MSG, backWallet.secretKey);


        // Ed25519 instruction
        const edIx = anchor.web3.Ed25519Program.createInstructionWithPublicKey({
            publicKey: backWallet.publicKey.toBytes(),
            message: MSG,
            signature: signature,
        });

        try {
            await program.methods.claim().preInstructions([edIx]).rpc({commitment: "finalized"})
            throw new Error("Error was expected"); // провал, если ошибки не было
        }
        catch (err) {
            if (!err.message.includes("Error Code: ExcessLimit. Error Number: 6002. Error Message: The daily claim limit has been exceeded.")) {
                throw new Error("Not that error was expected");
            }
        }
    })


    it("exceeding daily claim count limit", async () => {
        let time = Math.trunc(Date.now() / 1000);
        let today = Math.trunc(time / 86400);
        let claimLimit;

        const userStateStruct = await program.account.userState.fetch(userState[0]);
        const globalStateStruct = await program.account.globalState.fetch(globalState[0]);
        if (userState.today < new BN(today)) {
            claimLimit = 1
        } else {
            claimLimit = userStateStruct.todayClaimCount + 1;
        }

        await program.methods.updateGlobal({
            pause: false,
            authority: null,
            backendAuthority: backWallet.publicKey,
            dailyLimit: new BN(0),
            claimRequestsLimit: claimLimit
        }).rpc({commitment: "finalized"});

        let total;

        const userStateAccBefore = await provider.connection.getAccountInfo(userState[0]);
        if (userStateAccBefore === null) {
            total = BigInt(10000000);
        } else {
            total = BigInt(10000000) + BigInt(userStateStruct.claimedTotal.toString())
        }

        // message/ix params
        const deadline = BigInt((Math.trunc(Date.now() / 1000)) + 600) // 10 minutes from now
        const pubkey = provider.publicKey

        // creating message
        const first_buf_total = Buffer.alloc(8);
        const first_buf_deadline = Buffer.alloc(8);
        first_buf_total.writeBigUInt64LE(total)
        first_buf_deadline.writeBigUInt64LE(deadline)

        const second_buf_total = Buffer.alloc(8);
        const second_buf_deadline = Buffer.alloc(8);
        second_buf_total.writeBigUInt64LE(total)
        second_buf_deadline.writeBigUInt64LE(deadline)

        const first_b_total = Uint8Array.from(first_buf_total)
        const first_b_deadline = Uint8Array.from(first_buf_deadline)

        const second_b_total = Uint8Array.from(second_buf_total)
        const second_b_deadline = Uint8Array.from(second_buf_deadline)

        const firstMSG = new Uint8Array([...pubkey.toBytes(), 0xff, ...first_b_total, 0xff, ...first_b_deadline]);
        const secondMSG = new Uint8Array([...pubkey.toBytes(), 0xff, ...second_b_total, 0xff, ...second_b_deadline]);
        // sign message
        const first_signature = nacl.sign.detached(firstMSG, backWallet.secretKey);
        const second_signature = nacl.sign.detached(secondMSG, backWallet.secretKey);


        // Ed25519 instruction
        const firstEdIx = anchor.web3.Ed25519Program.createInstructionWithPublicKey({
            publicKey: backWallet.publicKey.toBytes(),
            message: firstMSG,
            signature: first_signature,
        });

        const secondEdIx = anchor.web3.Ed25519Program.createInstructionWithPublicKey({
            publicKey: backWallet.publicKey.toBytes(),
            message: secondMSG,
            signature: second_signature,
        });

        await program.methods.claim().preInstructions([firstEdIx]).rpc({commitment: "finalized"})

        try {
            await program.methods.claim().preInstructions([secondEdIx]).rpc({commitment: "finalized"})
            throw new Error("Error was expected"); // провал, если ошибки не было
        }
        catch (err) {
            if (!err.message.includes("Error Code: ClaimLimit. Error Number: 6003. Error Message: Your daily claim limit has been exceeded.")) {
                throw new Error("Not that error was expected");
            }
        }
    })


    it("claim on pause", async () => {
        await program.methods.updateGlobal({
            pause: true, // bool/null
            authority: null, // publicKey/null
            backendAuthority: backWallet.publicKey, // publicKey/null
            dailyLimit: new BN(0), // 10 SOL | BN/null
            claimRequestsLimit: 0 // number/null
        }).rpc({commitment: "finalized"});

        let total;

        const userStateStructBefore = await program.account.userState.fetch(userState[0]);
        const userStateAccBefore = await provider.connection.getAccountInfo(userState[0]);
        if (userStateAccBefore === null) {
            total = BigInt(10000000);
        } else {
            total = BigInt(10000000) + BigInt(userStateStructBefore.claimedTotal.toString())
        }

        // message/ix params
        const deadline = BigInt((Math.trunc(Date.now() / 1000)) + 600) // 10 minutes from now
        const pubkey = provider.publicKey

        // creating message
        const buf_total = Buffer.alloc(8);
        const buf_deadline = Buffer.alloc(8);
        buf_total.writeBigUInt64LE(total)
        buf_deadline.writeBigUInt64LE(deadline)
        const b_total = Uint8Array.from(buf_total)
        const b_deadline = Uint8Array.from(buf_deadline)
        const MSG = new Uint8Array([...pubkey.toBytes(), 0xff, ...b_total, 0xff, ...b_deadline]);
        // sign message
        const signature = nacl.sign.detached(MSG, backWallet.secretKey);

        // Ed25519 instruction
        const edIx = anchor.web3.Ed25519Program.createInstructionWithPublicKey({
            publicKey: backWallet.publicKey.toBytes(),
            message: MSG,
            signature: signature,
        });

        try {
            await program.methods.claim().preInstructions([edIx]).rpc({commitment: "finalized"})
            throw new Error("Error was expected"); // провал, если ошибки не было
        }
        catch (err) {
            if (!err.message.includes("Error Code: ClaimSuspended. Error Number: 6001. Error Message: Claim on pause.")) {
                throw new Error("Not that error was expected");
            }
        }

    })


    it("claim with fake wallet in message", async () => {
        await program.methods.updateGlobal({
            pause: false, // bool/null
            authority: null, // publicKey/null
            backendAuthority: backWallet.publicKey, // publicKey/null
            dailyLimit: new BN(0), // 10 SOL | BN/null
            claimRequestsLimit: 0 // number/null
        }).rpc({commitment: "finalized"});

        let total;
        const fakeWallet = Keypair.generate()

        const userStateStructBefore = await program.account.userState.fetch(userState[0]);
        const userStateAccBefore = await provider.connection.getAccountInfo(userState[0]);
        if (userStateAccBefore === null) {
            total = BigInt(10000000);
        } else {
            total = BigInt(10000000) + BigInt(userStateStructBefore.claimedTotal.toString())
        }

        // message/ix params
        const deadline = BigInt((Math.trunc(Date.now() / 1000)) + 600) // 10 minutes from now
        const pubkey = provider.publicKey

        // creating message
        const buf_total = Buffer.alloc(8);
        const buf_deadline = Buffer.alloc(8);
        buf_total.writeBigUInt64LE(total)
        buf_deadline.writeBigUInt64LE(deadline)
        const b_total = Uint8Array.from(buf_total)
        const b_deadline = Uint8Array.from(buf_deadline)
        const MSG = new Uint8Array([...fakeWallet.publicKey.toBytes(), 0xff, ...b_total, 0xff, ...b_deadline]);
        // sign message
        const signature = nacl.sign.detached(MSG, backWallet.secretKey);

        // Ed25519 instruction
        const edIx = anchor.web3.Ed25519Program.createInstructionWithPublicKey({
            publicKey: backWallet.publicKey.toBytes(),
            message: MSG,
            signature: signature,
        });

        try {
            await program.methods.claim().preInstructions([edIx]).rpc({commitment: "finalized"})
            throw new Error("Error was expected"); // провал, если ошибки не было
        }
        catch (err) {
            if (!err.message.includes("Error Code: SigVerificationFailed. Error Number: 6000. Error Message: Signature verification failed.")) {
                throw new Error("Not that error was expected");
            }
        }
    })


    it("claim with overdue deadline", async () => {
        await program.methods.updateGlobal({
            pause: false, // bool/null
            authority: null, // publicKey/null
            backendAuthority: backWallet.publicKey, // publicKey/null
            dailyLimit: new BN(0), // 10 SOL | BN/null
            claimRequestsLimit: 0 // number/null
        }).rpc({commitment: "finalized"});

        let total;
        const fakeWallet = Keypair.generate()

        const userStateStructBefore = await program.account.userState.fetch(userState[0]);
        const userStateAccBefore = await provider.connection.getAccountInfo(userState[0]);
        if (userStateAccBefore === null) {
            total = BigInt(10000000);
        } else {
            total = BigInt(10000000) + BigInt(userStateStructBefore.claimedTotal.toString())
        }

        // message/ix params
        const deadline = BigInt((Math.trunc(Date.now() / 1000)) - 600) // expired 10 minutes ago
        const pubkey = provider.publicKey

        // creating message
        const buf_total = Buffer.alloc(8);
        const buf_deadline = Buffer.alloc(8);
        buf_total.writeBigUInt64LE(total)
        buf_deadline.writeBigUInt64LE(deadline)
        const b_total = Uint8Array.from(buf_total)
        const b_deadline = Uint8Array.from(buf_deadline)
        const MSG = new Uint8Array([...pubkey.toBytes(), 0xff, ...b_total, 0xff, ...b_deadline]);
        // sign message
        const signature = nacl.sign.detached(MSG, backWallet.secretKey);

        // Ed25519 instruction
        const edIx = anchor.web3.Ed25519Program.createInstructionWithPublicKey({
            publicKey: backWallet.publicKey.toBytes(),
            message: MSG,
            signature: signature,
        });

        try {
            await program.methods.claim().preInstructions([edIx]).rpc({commitment: "finalized"})
            throw new Error("Error was expected"); // провал, если ошибки не было
        } catch (err) {
            if (!err.message.includes("Error Code: SigVerificationFailed. Error Number: 6000. Error Message: Signature verification failed.")) {
                throw new Error("Not that error was expected");
            }
        }
    })


    it("emergency withdrawal on pause", async () => {
        await program.methods.updateGlobal({
            pause: true, // bool/null
            authority: null, // publicKey/null
            backendAuthority: backWallet.publicKey, // publicKey/null
            dailyLimit: new BN(0), // 10 SOL | BN/null
            claimRequestsLimit: 0 // number/null
        }).rpc({commitment: "finalized"});

        let rent = await provider.connection.getMinimumBalanceForRentExemption(0);

        let globalStateStruct = await program.account.globalState.fetch(globalState[0]);
        assert.equal(globalStateStruct.pause, true, "incorrect pause");
        let userWalletBefore = await provider.connection.getAccountInfo(provider.publicKey);
        let vaultAccBefore = await provider.connection.getAccountInfo(vault[0]);
        let userLamportsBefore = userWalletBefore.lamports;
        let vaultLamportsBefore = vaultAccBefore.lamports;

        let withdrawSg = await program.methods.emergencyWithdrawal().rpc({commitment: "finalized"});
        console.log("Emergency withdraw Ix tx: ", withdrawSg);

        let userWalletAfter = await provider.connection.getAccountInfo(provider.publicKey);
        let vaultAccAfter = await provider.connection.getAccountInfo(vault[0]);
        let userLamportsAfter = userWalletAfter.lamports;
        let vaultLamportsAfter = vaultAccAfter.lamports;

        assert.equal(vaultLamportsAfter, rent, "incorrect vault balance");
        assert.equal(userLamportsAfter, (userLamportsBefore + vaultLamportsBefore - rent - 5000), "incorrect user balance");

        const transferIx = web3.SystemProgram.transfer({
            fromPubkey: provider.publicKey,
            toPubkey: vault[0],
            lamports: vaultLamportsBefore - vaultLamportsAfter
        })

        const tx = new web3.Transaction().add(transferIx)
        await provider.sendAndConfirm(tx, [], {commitment: "finalized"});

    })


    it("emergency withdrawal from fake authority", async () => {
        let rent = await provider.connection.getMinimumBalanceForRentExemption(0);
        const fakeAuthority = Keypair.generate();
        const transferIx = web3.SystemProgram.transfer({
            fromPubkey: provider.publicKey,
            toPubkey: fakeAuthority.publicKey,
            lamports: 5000 + rent
        });
        const transferTx = new web3.Transaction().add(transferIx);
        await provider.sendAndConfirm(transferTx, [], {commitment: "finalized"});


        let withdrawIx = await program.methods.emergencyWithdrawal().instruction();
        withdrawIx.keys[0].pubkey = fakeAuthority.publicKey;

        const fakeTx = new web3.Transaction().add(withdrawIx)

        try {
            await provider.connection.sendTransaction(fakeTx, [fakeAuthority], {preflightCommitment: "finalized"});
            throw new Error("Error was expected"); // провал, если ошибки не было
        } catch (err) {
            if (!err.message.includes("AnchorError caused by account: global_state. Error Code: ConstraintHasOne. Error Number: 2001. Error Message: A has one constraint was violated.")) {
                throw new Error("Not that error was expected");
            }
        }
    })

});
