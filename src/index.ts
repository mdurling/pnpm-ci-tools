import { Command, Option } from 'commander'
import { auditCommand, SeverityLevels } from './commands/audit'

const cli = async () => {
  try {
    await new Command()
      .version(process.env.npm_package_version ?? '0.0.0')
      .command('audit')
      .description('Run pnpm audit')
      .addOption(
        new Option(
          '-l, --audit-level <audit-level>',
          'Include advisories with severity greater than or equal to <audit-level>'
        )
          .choices([...SeverityLevels])
          .default(SeverityLevels[0])
      )
      .addOption(new Option('-i, --ignore-advisories [ids...]', 'Ignore advisories with the specified ids').default([]))
      .addOption(
        new Option('--strict', 'Strict Mode: Fail if ignored advisories are not detected by the audit').default(false)
      )
      .action(auditCommand)
      .exitOverride()
      .parseAsync()
  } catch (error) {
    process.exit(error.code)
  }
}

cli()
