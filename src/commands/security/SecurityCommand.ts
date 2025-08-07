/**
 * Security management command for SMS-Dev CLI
 * Handles security configuration, certificate generation, and auditing
 */

import chalk from 'chalk'
import { BaseCommand, CommandOptions } from '../base/BaseCommand.js'
import { 
  SecurityConfigManager, 
  CertificateManager, 
  SecurityAuditor,
  SecurityHelpers,
  type SecurityProfile,
  type EnhancedSecurityConfig 
} from '../../security/index.js'
import { loadConfig } from '../../utils/config.js'
import fs from 'fs'
import path from 'path'

/**
 * Options for the security command
 */
interface SecurityOptions extends CommandOptions {
  action?: string
  profile?: SecurityProfile
  domain?: string
  audit?: boolean
  format?: 'json' | 'markdown' | 'console'
  output?: string
  strict?: boolean
  genApiKey?: boolean
  showConfig?: boolean
}

/**
 * Command to manage security settings and certificates
 */
export class SecurityCommand extends BaseCommand {
  readonly name = 'security'
  readonly description = 'Manage security settings, certificates, and auditing'

  private securityManager?: SecurityConfigManager
  private certManager: CertificateManager
  private auditor: SecurityAuditor

  constructor() {
    super()
    this.certManager = new CertificateManager()
    this.auditor = new SecurityAuditor()
  }

  async execute(options: SecurityOptions): Promise<void> {
    try {
      // Initialize security manager with current config
      const cliConfig = await loadConfig()
      this.securityManager = SecurityConfigManager.fromCliConfig(cliConfig)

      const action = options.action || 'status'

      switch (action) {
        case 'status':
          await this.showSecurityStatus(options)
          break
        case 'profile':
          await this.manageProfile(options)
          break
        case 'cert':
          await this.manageCertificates(options)
          break
        case 'audit':
          await this.runSecurityAudit(options)
          break
        case 'config':
          await this.showSecurityConfig(options)
          break
        case 'generate-key':
          await this.generateApiKey(options)
          break
        default:
          this.showHelp()
      }
    } catch (error: any) {
      this.handleError(error, 'managing security')
    }
  }

  /**
   * Show security status overview
   */
  private async showSecurityStatus(options: SecurityOptions): Promise<void> {
    if (!this.securityManager) return

    const config = this.securityManager.getConfig()
    const summary = this.securityManager.getSummary()
    const readiness = this.securityManager.isProductionReady()

    this.logInfo('Security Status Overview')
    console.log('')

    // Profile and mode
    console.log(`📋 Profile: ${chalk.blue(config.profile)}`)
    console.log(`🔒 Strict Mode: ${config.strictMode ? chalk.green('Enabled') : chalk.yellow('Disabled')}`)
    console.log(`🌐 HTTPS Enforced: ${config.enforceHttps ? chalk.green('Yes') : chalk.red('No')}`)
    console.log('')

    // Security features
    console.log('🛡️  Security Features:')
    console.log(`  Content Security Policy: ${config.csp.enabled ? chalk.green('✅') : chalk.red('❌')}`)
    console.log(`  HTTP Strict Transport Security: ${config.hsts.enabled ? chalk.green('✅') : chalk.red('❌')}`)
    console.log(`  Cross-Origin Resource Sharing: ${config.cors.enabled ? chalk.green('✅') : chalk.red('❌')}`)
    console.log(`  Rate Limiting: ${config.rateLimit.enabled ? chalk.green('✅') : chalk.red('❌')}`)
    console.log(`  API Key Authentication: ${config.api.requireApiKey ? chalk.green('✅') : chalk.red('❌')}`)
    console.log(`  Webhook Validation: ${config.api.validateWebhookSignatures ? chalk.green('✅') : chalk.red('❌')}`)
    console.log('')

    // CORS configuration
    if (config.cors.enabled) {
      console.log(`🌍 CORS Origins: ${config.cors.origins.length === 1 && config.cors.origins[0] === '*' 
        ? chalk.yellow('All origins (*)') 
        : chalk.green(`${config.cors.origins.length} origins`)
      }`)
    }

    // Rate limiting
    if (config.rateLimit.enabled) {
      console.log(`⏱️  Rate Limit: ${chalk.blue(config.rateLimit.max)} requests per ${chalk.blue(config.rateLimit.windowMs / 1000)} seconds`)
    }

    console.log('')

    // Production readiness
    if (readiness.ready) {
      console.log(`${chalk.green('✅ Production Ready')}: All security checks passed`)
    } else {
      console.log(`${chalk.red('❌ Not Production Ready')}: ${readiness.issues.length} issue(s) found`)
      console.log('')
      console.log('Issues:')
      readiness.issues.forEach((issue, index) => {
        console.log(`  ${index + 1}. ${chalk.yellow(issue)}`)
      })
    }

    // Certificates
    const availableCerts = this.certManager.listCertificates()
    if (availableCerts.length > 0) {
      console.log('')
      console.log('📜 Available Certificates:')
      availableCerts.forEach(cert => {
        console.log(`  - ${cert}`)
      })
    }

    console.log('')
    console.log(chalk.gray('Use --help to see all security commands'))
  }

  /**
   * Manage security profiles
   */
  private async manageProfile(options: SecurityOptions): Promise<void> {
    if (!this.securityManager) return

    if (options.profile) {
      // Switch to new profile
      this.logInfo(`Switching to ${options.profile} security profile`)
      
      const newManager = new SecurityConfigManager(options.profile)
      const newConfig = newManager.getConfig()
      
      console.log('')
      console.log('New Security Configuration:')
      console.log(`  Profile: ${chalk.blue(newConfig.profile)}`)
      console.log(`  HTTPS Enforced: ${newConfig.enforceHttps ? chalk.green('Yes') : chalk.red('No')}`)
      console.log(`  Strict Mode: ${newConfig.strictMode ? chalk.green('Enabled') : chalk.yellow('Disabled')}`)
      console.log(`  Rate Limit: ${newConfig.rateLimit.max} requests per ${newConfig.rateLimit.windowMs / 1000}s`)
      
      this.logSuccess('Profile updated successfully')
      this.logInfo('Restart the server to apply changes')
    } else {
      // Show available profiles
      console.log('Available Security Profiles:')
      console.log('')
      
      const profiles: { name: SecurityProfile; description: string }[] = [
        { name: 'development', description: 'Permissive settings for local development' },
        { name: 'testing', description: 'Minimal security for automated testing' },
        { name: 'production', description: 'Strict security for production environments' },
        { name: 'custom', description: 'Custom configuration from config file' }
      ]

      profiles.forEach(profile => {
        const current = profile.name === this.securityManager?.getConfig().profile
        const marker = current ? chalk.green('→') : ' '
        console.log(`${marker} ${chalk.blue(profile.name.padEnd(12))} ${profile.description}`)
      })

      console.log('')
      console.log('Usage: sms-dev security profile --profile <profile-name>')
    }
  }

  /**
   * Manage SSL/TLS certificates
   */
  private async manageCertificates(options: SecurityOptions): Promise<void> {
    const domain = options.domain || 'localhost'

    if (options.action === 'generate') {
      this.startSpinner(`Generating certificate for ${domain}`)
      
      try {
        const certInfo = await this.certManager.generateSelfSignedCert(domain)
        this.stopSpinner('Certificate generated successfully')
        
        console.log('')
        console.log(`📜 Certificate Details:`)
        console.log(`   Domain: ${chalk.blue(domain)}`)
        console.log(`   Valid for: 365 days`)
        console.log(`   Location: ${chalk.gray('~/.sms-dev/certificates/')}`)
        
        const info = this.certManager.getCertificateInfo(certInfo.cert)
        if (info) {
          console.log(`   Fingerprint: ${chalk.gray(info.fingerprint.substring(0, 32))}...`)
        }
        
        this.logWarning('This is a self-signed certificate for development only')
        this.logInfo('For production, use certificates from a trusted CA')

      } catch (error: any) {
        this.stopSpinner('Certificate generation failed')
        throw error
      }
    } else if (options.action === 'list') {
      const certs = this.certManager.listCertificates()
      
      if (certs.length === 0) {
        console.log('📜 No certificates found')
        console.log('')
        console.log('Generate a certificate with:')
        console.log('  sms-dev security cert generate --domain localhost')
      } else {
        console.log('📜 Available Certificates:')
        console.log('')
        
        for (const cert of certs) {
          const certInfo = await this.certManager.loadCertificate(cert)
          if (certInfo) {
            const info = this.certManager.getCertificateInfo(certInfo.cert)
            const isValid = await this.certManager.validateCertificate(certInfo)
            
            console.log(`  ${isValid ? chalk.green('✓') : chalk.red('✗')} ${chalk.blue(cert)}`)
            if (info) {
              console.log(`    Valid: ${info.validFrom.toISOString().split('T')[0]} → ${info.validTo.toISOString().split('T')[0]}`)
            }
          }
        }
      }
    } else if (options.action === 'remove') {
      const removed = this.certManager.removeCertificate(domain)
      if (removed) {
        this.logSuccess(`Certificate for ${domain} removed`)
      } else {
        this.logWarning(`No certificate found for ${domain}`)
      }
    } else {
      console.log('Certificate Commands:')
      console.log('  generate  Generate a new self-signed certificate')
      console.log('  list      List available certificates')
      console.log('  remove    Remove a certificate')
      console.log('')
      console.log('Examples:')
      console.log('  sms-dev security cert generate --domain localhost')
      console.log('  sms-dev security cert list')
      console.log('  sms-dev security cert remove --domain localhost')
    }
  }

  /**
   * Run security audit
   */
  private async runSecurityAudit(options: SecurityOptions): Promise<void> {
    if (!this.securityManager) return

    this.startSpinner('Running security audit')

    try {
      const config = this.securityManager.getConfig()
      const auditResult = await this.auditor.auditConfiguration(config)
      
      this.stopSpinner('Security audit completed')

      // Display results based on format
      const format = options.format || 'console'
      
      if (format === 'console') {
        this.displayAuditResults(auditResult)
      } else if (format === 'json') {
        const output = JSON.stringify(auditResult, null, 2)
        if (options.output) {
          fs.writeFileSync(options.output, output)
          this.logSuccess(`Audit results saved to ${options.output}`)
        } else {
          console.log(output)
        }
      } else if (format === 'markdown') {
        const report = this.auditor.generateSecurityReport(auditResult)
        if (options.output) {
          fs.writeFileSync(options.output, report)
          this.logSuccess(`Security report saved to ${options.output}`)
        } else {
          console.log(report)
        }
      }

    } catch (error: any) {
      this.stopSpinner('Security audit failed')
      throw error
    }
  }

  /**
   * Display audit results in console format
   */
  private displayAuditResults(auditResult: any): void {
    console.log('')
    console.log(`🔍 Security Audit Results`)
    console.log('')
    
    // Score with color coding
    const score = auditResult.score
    const scoreColor = score >= 90 ? chalk.green : score >= 70 ? chalk.yellow : chalk.red
    console.log(`📊 Security Score: ${scoreColor(score)}/100`)
    console.log('')

    // Compliance
    console.log('📋 Compliance Status:')
    console.log(`  OWASP: ${auditResult.compliance.owasp ? chalk.green('✅ Compliant') : chalk.red('❌ Non-compliant')}`)
    console.log(`  CIS: ${auditResult.compliance.cis ? chalk.green('✅ Compliant') : chalk.red('❌ Non-compliant')}`)
    console.log(`  NIST: ${auditResult.compliance.nist ? chalk.green('✅ Compliant') : chalk.red('❌ Non-compliant')}`)
    console.log('')

    // Issues summary
    const issuesBySeverity = auditResult.issues.reduce((acc: any, issue: any) => {
      acc[issue.severity] = (acc[issue.severity] || 0) + 1
      return acc
    }, {})

    console.log('⚠️  Security Issues:')
    console.log(`  🔴 Critical: ${issuesBySeverity.critical || 0}`)
    console.log(`  🟠 High: ${issuesBySeverity.high || 0}`)
    console.log(`  🟡 Medium: ${issuesBySeverity.medium || 0}`)
    console.log(`  🟢 Low: ${issuesBySeverity.low || 0}`)
    console.log('')

    // Top issues
    if (auditResult.issues.length > 0) {
      console.log('🚨 Security Issues:')
      auditResult.issues.forEach((issue: any, index: number) => {
        const emoji = { critical: '🔴', high: '🟠', medium: '🟡', low: '🟢' }[issue.severity]
        console.log(`  ${index + 1}. ${emoji} ${issue.description}`)
        console.log(`     ${chalk.gray(issue.recommendation)}`)
      })
      console.log('')
    }

    // Recommendations
    if (auditResult.recommendations.length > 0) {
      console.log('💡 Recommendations:')
      auditResult.recommendations.forEach((rec: string, index: number) => {
        console.log(`  ${index + 1}. ${rec}`)
      })
      console.log('')
    }

    if (score >= 90) {
      this.logSuccess('Excellent security configuration!')
    } else if (score >= 70) {
      this.logWarning('Good security, but room for improvement')
    } else {
      this.logError('Security configuration needs attention')
    }
  }

  /**
   * Show detailed security configuration
   */
  private async showSecurityConfig(options: SecurityOptions): Promise<void> {
    if (!this.securityManager) return

    const config = this.securityManager.getConfig()
    const format = options.format || 'console'

    if (format === 'json') {
      const output = JSON.stringify(config, null, 2)
      if (options.output) {
        fs.writeFileSync(options.output, output)
        this.logSuccess(`Configuration saved to ${options.output}`)
      } else {
        console.log(output)
      }
    } else {
      console.log('🔒 Security Configuration:')
      console.log('')
      console.log(`Profile: ${chalk.blue(config.profile)}`)
      console.log(`Strict Mode: ${config.strictMode ? chalk.green('Enabled') : chalk.red('Disabled')}`)
      console.log(`HTTPS Enforced: ${config.enforceHttps ? chalk.green('Yes') : chalk.red('No')}`)
      console.log('')
      
      console.log('Content Security Policy:')
      if (config.csp.enabled) {
        Object.entries(config.csp.directives).forEach(([directive, values]) => {
          console.log(`  ${directive}: ${values.join(' ')}`)
        })
      } else {
        console.log('  Disabled')
      }
      console.log('')
      
      console.log('CORS Configuration:')
      console.log(`  Enabled: ${config.cors.enabled ? 'Yes' : 'No'}`)
      if (config.cors.enabled) {
        console.log(`  Origins: ${config.cors.origins.join(', ')}`)
      }
      console.log('')
      
      console.log('Rate Limiting:')
      console.log(`  Enabled: ${config.rateLimit.enabled ? 'Yes' : 'No'}`)
      if (config.rateLimit.enabled) {
        console.log(`  Max Requests: ${config.rateLimit.max}`)
        console.log(`  Window: ${config.rateLimit.windowMs / 1000} seconds`)
      }
    }
  }

  /**
   * Generate API key
   */
  private async generateApiKey(options: SecurityOptions): Promise<void> {
    const apiKey = SecurityHelpers.generateApiKey()
    
    console.log('🔑 Generated API Key:')
    console.log('')
    console.log(`  ${chalk.green(apiKey)}`)
    console.log('')
    console.log('⚠️  Store this key securely - it will not be shown again')
    console.log('')
    console.log('Usage:')
    console.log('  Add to requests: Authorization: Bearer <api-key>')
    console.log('  Environment: SMS_DEV_API_KEY=<api-key>')
    
    if (options.output) {
      fs.writeFileSync(options.output, apiKey)
      this.logSuccess(`API key saved to ${options.output}`)
      this.logWarning('Secure this file with appropriate permissions')
    }
  }

  /**
   * Show help for security commands
   */
  private showHelp(): void {
    console.log(chalk.blue('SMS-Dev Security Management'))
    console.log('')
    console.log('Commands:')
    console.log('  status          Show security status overview')
    console.log('  profile         Manage security profiles')
    console.log('  cert            Manage SSL/TLS certificates')
    console.log('  audit           Run security audit')
    console.log('  config          Show security configuration')
    console.log('  generate-key    Generate API key')
    console.log('')
    console.log('Examples:')
    console.log('  sms-dev security status')
    console.log('  sms-dev security profile --profile production')
    console.log('  sms-dev security cert generate --domain api.example.com')
    console.log('  sms-dev security audit --format json --output audit.json')
    console.log('  sms-dev security generate-key')
    console.log('')
    console.log('Options:')
    console.log('  --profile <name>    Security profile (development, production, testing)')
    console.log('  --domain <domain>   Domain for certificate generation')
    console.log('  --format <format>   Output format (console, json, markdown)')
    console.log('  --output <file>     Output file path')
    console.log('  --audit             Run security audit')
  }
}