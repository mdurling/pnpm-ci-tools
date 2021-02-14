#!/usr/bin/env node
import type { Argv } from 'yargs'
import { promisify } from 'util'
import { exec } from 'child_process'

// Advisory severities
const SeverityLevels = <const>['low', 'moderate', 'high', 'critical']
type SeverityLevel = typeof SeverityLevels[number]

interface Advisory {
  id: number
  title: string
  severity: SeverityLevel
  url: string
  findings: {
    version: string
    paths: string[]
  }[]
}

interface AuditJson {
  advisories: { [x: string]: Advisory }
  metadata: { totalDependencies: number }
}

// Important: Use named function
export default function audit(yargs: Argv): Argv {
  return yargs.command(
    'audit',
    'Run pnpm audit',
    argv =>
      argv.parserConfiguration({ 'unknown-options-as-args': true, 'greedy-arrays': false }).options({
        'audit-level': {
          description: 'Include advisories with severity greater than or equal to <audit-level>',
          choices: SeverityLevels
        },
        'ignore-advisories': {
          description: 'Ignore advisories with the specified ids',
          alias: 'i',
          array: true
        },
        strict: {
          description: 'Strict Mode: Fail if ignored advisories are not detected by the audit',
          boolean: true,
          default: false
        }
      }),
    async options => {
      const pnpmAuditJson = async (command: string): Promise<AuditJson> => {
        const pnpmAudit = async (): Promise<string> => {
          try {
            console.log(`Running: "${command.trim()}"`)
            const { stdout } = await promisify(exec)(command)
            return stdout
          } catch ({ stdout }) {
            return stdout
          }
        }
        const result = await pnpmAudit()
        try {
          return <AuditJson>JSON.parse(result)
        } catch (error) {
          console.error(`Skipping audit due to unexpected error: ${result}`)
          process.exit(0)
        }
      }

      // Parse minimum severity level and advisory exclusions from command line arguments
      const {
        _: [, ...args],
        'audit-level': auditLevel = 'low',
        'ignore-advisories': ignoreAdvisories = [],
        strict
      } = options

      const ignored = [...new Set(ignoreAdvisories.reduce<string[]>((ids, id) => [...ids, ...`${id}`.split(',')], []))]

      const minSeverityLevel = SeverityLevels.indexOf(auditLevel)

      const json = await pnpmAuditJson(`pnpm audit --json --audit-level=${auditLevel} ${args.join(' ')}`)

      if (json === null) {
        return 1
      }

      const {
        advisories,
        metadata: { totalDependencies }
      } = json

      // Ignore advisories below minimum severity level or excluded
      const vulnerabilities = Object.entries(advisories).filter(
        ([id, { severity }]) => !ignored.includes(id) && SeverityLevels.indexOf(severity) >= minSeverityLevel
      )

      // Detect outdated exclusions
      const exclusions = ignored.reduce<{ excluded: string[]; outdated: string[] }>(
        (result, id) => {
          return {
            ...result,
            ...(Object.keys(advisories).includes(id)
              ? { excluded: [...result.excluded, id] }
              : { outdated: [...result.outdated, id] })
          }
        },
        {
          excluded: [],
          outdated: []
        }
      )

      // Display results
      console.log(
        `Found ${vulnerabilities.length === 0 ? 'no' : `${vulnerabilities.length}`} known ${
          vulnerabilities.length === 1 ? 'vulnerability' : 'vulnerabilities'
        } in ${totalDependencies} dependencies${
          exclusions.excluded.length > 0 ? ` (excluding ${exclusions.excluded.join(', ')})` : ''
        }`
      )

      // Display vulnerabilities
      vulnerabilities.forEach(([, { title, severity, url, findings }]) => {
        console.log(` - ${url}: ${title} (${severity.toUpperCase()})`)
        findings.forEach(({ version, paths }) => {
          paths.forEach(path => {
            console.log(`    - ${path.replace(/>/g, ' > ')}@${version}`)
          })
        })
      })

      // Display outdated exclusions
      exclusions.outdated.forEach(id => {
        console.log(`Exclusion for advisory "${id}" is no longer required`)
      })

      // Return the number of vulerabilities found (optionally fail if outdated ignored advisories)
      return process.exit(vulnerabilities.length + (strict ? exclusions.outdated.length : 0))
    }
  )
}
