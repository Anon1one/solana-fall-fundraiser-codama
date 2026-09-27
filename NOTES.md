## Versions
anchor-cli 1.1.2 · solana-cli 3.1.10 · node v26.5.0 · @codama/cli 1.6.3 · @codama/renderers-js 2.5.0 · @solana/kit 8.3.0
Tests run with `--validator legacy` (no Surfpool).

## TODO 3
Required: fundraiser, vault. Optional: contributorAccount, contributorAta, tokenProgram, systemProgram.
In `contribute` the fundraiser PDA is seeded with `fundraiser.maker`, a field stored inside the fundraiser account itself, so Codama would need the account to find the account; the vault has the same problem because its mint is `fundraiser.mint_to_raise`. In `initialize` the same PDA is seeded with the `maker` signer the caller already passes, so there Codama derives it and `fundraiser` is optional, while `contributorAccount` (seeds: fundraiser + contributor) and `contributorAta` (contributor + mintToRaise) only need inputs we already gave, and the two programs are constants.

## Bonus
Attempted. A Codama-built `contribute` sent through the Anchor provider via `toWeb3Instruction`; vault grows by exactly AMOUNT.

## One thing that surprised me
`anchor test` ran 0 tests at first: the script's `tests/**/*.ts` glob is expanded by `sh`, where `**` behaves like `*`, so it only matched `tests/helpers/kit-adapter.ts`. Quoting the glob (`'tests/**/*.ts'`) so mocha expands it runs all suites.
