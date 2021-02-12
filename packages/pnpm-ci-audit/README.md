# pnpm-ci-audit

[![NPM](https://nodei.co/npm/pnpm-ci-audit.png)](https://nodei.co/npm/pnpm-ci-audit/)

This package provides a command that allows [pnpm audit](https://pnpm.js.org/en/cli/audit) to be used in a CI/CD environment.

This project was inspired by similar tools available for [npm](https://www.npmjs.com/package/better-npm-audit) and [yarn](https://www.npmjs.com/package/improved-yarn-audit)

## Check for all advisories.
```sh
pnpx pnpm-ci-audit
```

## Set the Minimum Severity Level of Advisories (--audit-level)
Only advisories that meet the minimum severity level are reported.
```sh
pnpx pnpm-ci-audit --audit-level=[low,moderate,high,critical]
```

## Ignore Specific Advisories (--ignore-advisories, -i)
Advisories with the specified `id` values are not reported.
```sh
pnpx pnpm-ci-audit -i 123,456
```
or
```sh
pnpx pnpm-ci-audit -i 123 -i 456
```

## Strict Mode (--strict)
In this mode, any advisory that is ignored using `--ignore-advisories` but is not detected by the audit will cause the command to fail.
```sh
pnpx pnpm-ci-audit -i 123,456 --strict
```

## Local Installation
As an alternative to using `pnpx`, this package can be installed as a dev dependency in a project and run from an npm script.
```sh
pnpm add -D pnpm-ci-audit
```
If installing this package in a monorepo that uses [pnpm workspaces](https://pnpm.js.org/en/workspaces) then install it in the workspace root using:
```sh
pnpm add -D -w pnpm-ci-audit
```