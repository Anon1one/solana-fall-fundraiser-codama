// Codama challenge: three TODOs.
//
// Everything above the TODOs is already written: the setup in `before()` opens a
// campaign and makes one contribution with the Anchor client you already know.
// Your job is to do the same three things with the client Codama generated:
// read an account, build an instruction, and let it resolve accounts for you.
//
// Nothing in `../clients/js/src/generated` exists until you run
//     npx codama init      (answer: target/idl/fundraiser.json, JS only, clients/js)
//     npx codama run js
// Guide: README.md, checkpoints 02 through 07.

import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { Fundraiser } from "../target/types/fundraiser";
import {
  ASSOCIATED_TOKEN_PROGRAM_ID,
  TOKEN_PROGRAM_ID,
  createMint,
  getAssociatedTokenAddressSync,
  getOrCreateAssociatedTokenAccount,
  mintTo,
} from "@solana/spl-token";
import NodeWallet from "@coral-xyz/anchor/dist/cjs/nodewallet";
import { assert } from "chai";
import { address, createNoopSigner } from "@solana/kit";
import { toWeb3Instruction } from "./helpers/kit-adapter";

// ─── TODO 1 · import the client you generated ────────────────────────────────
// Uncomment once `clients/js/src/generated/index.ts` exists.
//
import {
  getFundraiserDecoder,
  getContributeInstruction,
  getContributeInstructionAsync,
  FUNDRAISER_PROGRAM_ADDRESS,
} from "../clients/js/src/generated";
// ─────────────────────────────────────────────────────────────────────────────

const TARGET = 30_000_000; // 30 tokens on a 6-decimal mint
const AMOUNT = 1_000_000; //  1 token, the minimum contribute accepts

describe("codama", () => {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);
  const program = anchor.workspace.Fundraiser as Program<Fundraiser>;
  const wallet = provider.wallet as NodeWallet;

  // Every suite in tests/ sets up its own campaign, so file order does not
  // matter and nothing here depends on tests/fundraiser.ts having run.
  const maker = anchor.web3.Keypair.generate();
  let mint: anchor.web3.PublicKey;
  let contributorAta: anchor.web3.PublicKey;
  let vault: anchor.web3.PublicKey;

  const [fundraiser] = anchor.web3.PublicKey.findProgramAddressSync(
    [Buffer.from("fundraiser"), maker.publicKey.toBuffer()],
    program.programId,
  );
  const [contributorAccount] = anchor.web3.PublicKey.findProgramAddressSync(
    [Buffer.from("contributor"), fundraiser.toBuffer(), provider.publicKey.toBuffer()],
    program.programId,
  );

  before(async () => {
    const sig = await provider.connection.requestAirdrop(maker.publicKey, anchor.web3.LAMPORTS_PER_SOL);
    await provider.connection.confirmTransaction({ signature: sig, ...(await provider.connection.getLatestBlockhash()) });

    mint = await createMint(provider.connection, wallet.payer, provider.publicKey, null, 6);
    contributorAta = (await getOrCreateAssociatedTokenAccount(provider.connection, wallet.payer, mint, provider.publicKey)).address;
    await mintTo(provider.connection, wallet.payer, mint, contributorAta, provider.publicKey, 10 * AMOUNT);
    vault = getAssociatedTokenAddressSync(mint, fundraiser, true);

    await program.methods
      .initialize(new anchor.BN(TARGET), 7)
      .accountsPartial({
        maker: maker.publicKey,
        fundraiser,
        mintToRaise: mint,
        vault,
        systemProgram: anchor.web3.SystemProgram.programId,
        tokenProgram: TOKEN_PROGRAM_ID,
        associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
      })
      .signers([maker])
      .rpc();

    await program.methods
      .contribute(new anchor.BN(AMOUNT))
      .accountsPartial({
        contributor: provider.publicKey,
        fundraiser,
        mintToRaise: mint,
        contributorAccount,
        contributorAta,
        vault,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .rpc();
  });

  // ─── TODO 1 · decode ───────────────────────────────────────────────────────
  // Fetch the raw bytes of the fundraiser account with web3.js, then decode
  // them with the generated `getFundraiserDecoder()`. Compare with what Anchor's
  // `program.account.fundraiser.fetch()` gives you. Note the types: Kit hands
  // you base58 strings for pubkeys and `bigint` for u64, not PublicKey / BN.
  it("TODO 1 · decodes the Fundraiser account with the generated decoder", async () => {
    assert.strictEqual(FUNDRAISER_PROGRAM_ADDRESS, program.programId.toBase58());

    const info = await provider.connection.getAccountInfo(fundraiser);
    const decoded = getFundraiserDecoder().decode(info.data);
    const viaAnchor = await program.account.fundraiser.fetch(fundraiser);

    assert.strictEqual(decoded.maker, maker.publicKey.toBase58());
    assert.strictEqual(decoded.amountToRaise, BigInt(TARGET));
    assert.strictEqual(decoded.currentAmount, BigInt(AMOUNT));
    assert.strictEqual(decoded.bump, viaAnchor.bump);
  });

  // ─── TODO 2 · encode ───────────────────────────────────────────────────────
  // Build the same `contribute` instruction twice, once with Anchor's
  // `.instruction()`, once with the generated `getContributeInstruction()`,
  // and prove they are identical: same data bytes, same accounts in the same
  // order. The generated function wants Kit types: wrap pubkeys with
  // `address(pk.toBase58())`, and the signer with `createNoopSigner(...)`
  // (nobody signs here; we are only comparing bytes).
  it("TODO 2 · builds a contribute instruction byte-for-byte equal to Anchor's", async () => {
    const anchorIx = await program.methods
      .contribute(new anchor.BN(AMOUNT))
      .accountsPartial({
        contributor: provider.publicKey,
        fundraiser,
        mintToRaise: mint,
        contributorAccount,
        contributorAta,
        vault,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .instruction();

    const kitIx = getContributeInstruction({
      contributor: createNoopSigner(address(provider.publicKey.toBase58())),
      mintToRaise: address(mint.toBase58()),
      fundraiser: address(fundraiser.toBase58()),
      contributorAccount: address(contributorAccount.toBase58()),
      contributorAta: address(contributorAta.toBase58()),
      vault: address(vault.toBase58()),
      amount: AMOUNT,
    });

    assert.isTrue(Buffer.from(kitIx.data).equals(anchorIx.data), "instruction data differs");
    assert.deepStrictEqual(
      kitIx.accounts.map((a) => a.address),
      anchorIx.keys.map((k) => k.pubkey.toBase58()),
      "account order differs",
    );
  });

  // ─── TODO 3 · resolution ───────────────────────────────────────────────────
  // Now use the *Async* variant and pass as few accounts as TypeScript lets
  // you. Hover the input type: some fields are `?:` optional, some are not.
  // Assert that the ones you left out were filled in with the right addresses.
  //
  // Then answer in NOTES.md at the repo root: which accounts did you still have
  // to pass, and why couldn't Codama derive them? (Look at their seeds in
  // programs/fundraiser/src/instructions/contribute.rs, and compare with the
  // same account in initialize.rs.)
  it("TODO 3 · resolves every account the IDL lets it derive", async () => {
    const ix = await getContributeInstructionAsync({
      contributor: createNoopSigner(address(provider.publicKey.toBase58())),
      mintToRaise: address(mint.toBase58()),
      fundraiser: address(fundraiser.toBase58()),
      vault: address(vault.toBase58()),
      amount: AMOUNT,
    });
    const got = ix.accounts.map((a) => a.address);

    assert.strictEqual(got[3], contributorAccount.toBase58(), "contributorAccount");
    assert.strictEqual(got[4], contributorAta.toBase58(), "contributorAta");
    assert.strictEqual(got[6], TOKEN_PROGRAM_ID.toBase58(), "tokenProgram");
  });

  // ─── BONUS · send it (optional) ────────────────────────────────────────────
  // The generated client speaks @solana/kit; the provider speaks web3.js v1.
  // `tests/helpers/kit-adapter.ts` converts one instruction shape into the
  // other. Build the instruction from TODO 3 again, convert it, send it through
  // `provider.sendAndConfirm`, and assert the vault grew by exactly AMOUNT.
  // Change `it.skip` to `it` when you attempt it.
  it("BONUS · a Codama-built instruction goes through Anchor's provider", async () => {
    const before = BigInt((await provider.connection.getTokenAccountBalance(vault)).value.amount);

    const ix = await getContributeInstructionAsync({
      contributor: createNoopSigner(address(provider.publicKey.toBase58())),
      mintToRaise: address(mint.toBase58()),
      fundraiser: address(fundraiser.toBase58()),
      vault: address(vault.toBase58()),
      amount: AMOUNT,
    });
    await provider.sendAndConfirm(new anchor.web3.Transaction().add(toWeb3Instruction(ix)));

    const after = BigInt((await provider.connection.getTokenAccountBalance(vault)).value.amount);
    assert.strictEqual(after - before, BigInt(AMOUNT));
  });
});
