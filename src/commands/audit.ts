import { promisify } from 'util'
import { exec } from 'child_process'

// Advisory severities
export const SeverityLevels = <const>['low', 'moderate', 'high', 'critical']
export const [DefaultSeverityLevel] = SeverityLevels
type SeverityLevel = typeof SeverityLevels[number]

interface Advisory {
  github_advisory_id: string
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

export const auditCommand = async ({
  auditLevel,
  ignoreAdvisories,
  strict
}: {
  auditLevel: SeverityLevel
  ignoreAdvisories: string[]
  strict: boolean
}) => {
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
  const ignored = [...new Set(ignoreAdvisories.reduce<string[]>((ids, id) => [...ids, ...`${id}`.split(',')], []))]
    .filter(advisory => advisory !== '')
    .map(advisory => advisory.trim())

  const minSeverityLevel = SeverityLevels.indexOf(auditLevel)

  const json = await pnpmAuditJson(`pnpm audit --json --audit-level=${auditLevel}`)

  if (json === null) {
    throw { code: 1 }
  }

  const {
    advisories,
    metadata: { totalDependencies }
  } = json

  // Ignore advisories below minimum severity level or excluded
  const vulnerabilities = Object.values(advisories).filter(
    ({ github_advisory_id: id, severity }) =>
      !ignored.includes(id) && SeverityLevels.indexOf(severity) >= minSeverityLevel
  )

  // Detect outdated exclusions
  const exclusions = ignored.reduce<{ excluded: string[]; outdated: string[] }>(
    (result, id) => {
      return {
        ...result,
        ...(Object.values(advisories).find(advisory => advisory.github_advisory_id === id)
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
  vulnerabilities.forEach(({ title, severity, github_advisory_id, findings }) => {
    console.log(` - ${github_advisory_id}: ${title} (${severity.toUpperCase()})`)
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

  const errors = vulnerabilities.length + (strict ? exclusions.outdated.length : 0)

  // Return the number of vulerabilities found (optionally fail if outdated ignored advisories)
  if (errors) {
    throw { code: errors }
  }
}
