import { platform, arch, release, homedir, tmpdir } from 'os'
import { resolve, join, sep } from 'path'
import { spawn, exec } from 'child_process'
import { promisify } from 'util'

const execAsync = promisify(exec)

export interface PlatformInfo {
  platform: string
  architecture: string
  release: string
  isWindows: boolean
  isMacOS: boolean
  isLinux: boolean
  shell: string
  homeDir: string
  tempDir: string
  pathSeparator: string
}

export interface CompatibilityCheck {
  supported: boolean
  issues: string[]
  warnings: string[]
  recommendations: string[]
}

export class PlatformCompatibility {
  private static platformInfo: PlatformInfo | null = null

  /**
   * Get detailed platform information
   */
  static getPlatformInfo(): PlatformInfo {
    if (this.platformInfo) {
      return this.platformInfo
    }

    const platformName = platform()
    const info: PlatformInfo = {
      platform: platformName,
      architecture: arch(),
      release: release(),
      isWindows: platformName === 'win32',
      isMacOS: platformName === 'darwin',
      isLinux: platformName === 'linux',
      shell: this.detectShell(),
      homeDir: homedir(),
      tempDir: tmpdir(),
      pathSeparator: sep
    }

    this.platformInfo = info
    return info
  }

  /**
   * Check if current platform is supported
   */
  static async checkCompatibility(): Promise<CompatibilityCheck> {
    const info = this.getPlatformInfo()
    const issues: string[] = []
    const warnings: string[] = []
    const recommendations: string[] = []

    // Check platform support
    if (!info.isWindows && !info.isMacOS && !info.isLinux) {
      issues.push(`Unsupported platform: ${info.platform}`)
      recommendations.push('Only Windows, macOS, and Linux are officially supported')
    }

    // Check Node.js version
         const nodeVersion = process.version
     const majorVersion = parseInt(nodeVersion.slice(1).split('.')[0] || '0')
    
    if (majorVersion < 18) {
      issues.push(`Node.js ${nodeVersion} is not supported`)
      recommendations.push('Please upgrade to Node.js 18 or higher')
    } else if (majorVersion < 20) {
      warnings.push(`Node.js ${nodeVersion} works but v20+ is recommended`)
      recommendations.push('Consider upgrading to Node.js 20+ for better performance')
    }

    // Check architecture
    if (!['x64', 'arm64'].includes(info.architecture)) {
      warnings.push(`Architecture ${info.architecture} may have limited support`)
      recommendations.push('x64 or arm64 architectures are recommended')
    }

    // Platform-specific checks
    if (info.isWindows) {
      await this.checkWindowsCompatibility(issues, warnings, recommendations)
    } else if (info.isMacOS) {
      await this.checkMacOSCompatibility(issues, warnings, recommendations)
    } else if (info.isLinux) {
      await this.checkLinuxCompatibility(issues, warnings, recommendations)
    }

    // Check available ports
    try {
      await this.checkPortAvailability([4001, 4000], warnings, recommendations)
    } catch (error) {
      warnings.push('Could not check port availability')
    }

    return {
      supported: issues.length === 0,
      issues,
      warnings,
      recommendations
    }
  }

  /**
   * Get platform-specific paths
   */
  static getPlatformPaths(): {
    configDir: string
    cacheDir: string
    logDir: string
    binDir?: string
  } {
    const info = this.getPlatformInfo()
    
    if (info.isWindows) {
      const appData = process.env.APPDATA || join(info.homeDir, 'AppData', 'Roaming')
      return {
        configDir: join(appData, 'sms-dev'),
        cacheDir: join(appData, 'sms-dev', 'cache'),
        logDir: join(appData, 'sms-dev', 'logs')
      }
    } else if (info.isMacOS) {
      return {
        configDir: join(info.homeDir, '.config', 'sms-dev'),
        cacheDir: join(info.homeDir, 'Library', 'Caches', 'sms-dev'),
        logDir: join(info.homeDir, 'Library', 'Logs', 'sms-dev'),
        binDir: '/usr/local/bin'
      }
    } else {
      // Linux and other Unix-like systems
      const xdgConfigHome = process.env.XDG_CONFIG_HOME || join(info.homeDir, '.config')
      const xdgCacheHome = process.env.XDG_CACHE_HOME || join(info.homeDir, '.cache')
      
      return {
        configDir: join(xdgConfigHome, 'sms-dev'),
        cacheDir: join(xdgCacheHome, 'sms-dev'),
        logDir: join(xdgCacheHome, 'sms-dev', 'logs'),
        binDir: join(info.homeDir, '.local', 'bin')
      }
    }
  }

  /**
   * Execute command with platform-specific handling
   */
  static async executeCommand(
    command: string, 
    args: string[] = [], 
    options: { timeout?: number; cwd?: string } = {}
  ): Promise<{ stdout: string; stderr: string; success: boolean }> {
    const info = this.getPlatformInfo()
    let actualCommand = command
    let actualArgs = args

    // Handle Windows command execution
    if (info.isWindows) {
      if (!command.endsWith('.exe') && !command.endsWith('.cmd') && !command.endsWith('.bat')) {
        // Try to find the command in common locations
        const windowsCommands = ['npm.cmd', 'node.exe', 'git.exe']
        const matchingCommand = windowsCommands.find(cmd => cmd.startsWith(command))
        if (matchingCommand) {
          actualCommand = matchingCommand
        } else {
          // Use cmd to execute
          actualCommand = 'cmd'
          actualArgs = ['/c', command, ...args]
        }
      }
    }

    return new Promise((resolve) => {
      const child = spawn(actualCommand, actualArgs, {
        cwd: options.cwd || process.cwd(),
        stdio: 'pipe',
        shell: info.isWindows
      })

      let stdout = ''
      let stderr = ''

      child.stdout?.on('data', (data) => {
        stdout += data.toString()
      })

      child.stderr?.on('data', (data) => {
        stderr += data.toString()
      })

      const timeout = options.timeout || 30000
      const timer = setTimeout(() => {
        child.kill()
        resolve({
          stdout,
          stderr: stderr + '\nCommand timed out',
          success: false
        })
      }, timeout)

      child.on('close', (code) => {
        clearTimeout(timer)
        resolve({
          stdout,
          stderr,
          success: code === 0
        })
      })

      child.on('error', (error) => {
        clearTimeout(timer)
        resolve({
          stdout,
          stderr: stderr + error.message,
          success: false
        })
      })
    })
  }

  /**
   * Get platform-specific configuration
   */
  static getPlatformConfig(): {
    lineEnding: string
    maxPathLength: number
    caseSensitive: boolean
    shellExtension: string
  } {
    const info = this.getPlatformInfo()
    
    if (info.isWindows) {
      return {
        lineEnding: '\r\n',
        maxPathLength: 260,
        caseSensitive: false,
        shellExtension: '.bat'
      }
    } else {
      return {
        lineEnding: '\n',
        maxPathLength: 4096,
        caseSensitive: true,
        shellExtension: '.sh'
      }
    }
  }

  /**
   * Detect shell environment
   */
  private static detectShell(): string {
    const info = platform()
    
    if (info === 'win32') {
      return process.env.COMSPEC || 'cmd.exe'
    }
    
    return process.env.SHELL || '/bin/bash'
  }

  /**
   * Windows-specific compatibility checks
   */
  private static async checkWindowsCompatibility(
    issues: string[], 
    warnings: string[], 
    recommendations: string[]
  ): Promise<void> {
    try {
      // Check Windows version
      const release = this.getPlatformInfo().release
      const versionMatch = release.match(/^(\d+)\.(\d+)/)
             if (versionMatch) {
         const major = parseInt(versionMatch[1] || '0')
         const minor = parseInt(versionMatch[2] || '0')
        
        if (major < 10) {
          warnings.push(`Windows ${major}.${minor} may have limited support`)
          recommendations.push('Windows 10 or higher is recommended')
        }
      }

      // Check PowerShell availability
      const powershellResult = await this.executeCommand('powershell', ['-Command', 'Get-Host'], { timeout: 5000 })
      if (!powershellResult.success) {
        warnings.push('PowerShell not available')
        recommendations.push('Install PowerShell for better Windows support')
      }

      // Check Windows Subsystem for Linux
      try {
        const wslResult = await this.executeCommand('wsl', ['--status'], { timeout: 3000 })
        if (wslResult.success) {
          warnings.push('WSL detected - some features may behave differently')
        }
      } catch {
        // WSL not installed, that's fine
      }

    } catch (error) {
      warnings.push('Could not perform complete Windows compatibility check')
    }
  }

  /**
   * macOS-specific compatibility checks
   */
  private static async checkMacOSCompatibility(
    issues: string[], 
    warnings: string[], 
    recommendations: string[]
  ): Promise<void> {
    try {
      // Check macOS version
      const result = await this.executeCommand('sw_vers', ['-productVersion'], { timeout: 5000 })
      if (result.success) {
        const version = result.stdout.trim()
                 const versionParts = version.split('.').map(Number)
         
         if ((versionParts[0] || 0) < 10 || ((versionParts[0] || 0) === 10 && (versionParts[1] || 0) < 15)) {
          warnings.push(`macOS ${version} may have limited support`)
          recommendations.push('macOS 10.15+ is recommended')
        }
      }

      // Check Xcode Command Line Tools
      const xcodeResult = await this.executeCommand('xcode-select', ['--print-path'], { timeout: 5000 })
      if (!xcodeResult.success) {
        warnings.push('Xcode Command Line Tools not installed')
        recommendations.push('Install with: xcode-select --install')
      }

      // Check Homebrew
      const brewResult = await this.executeCommand('brew', ['--version'], { timeout: 5000 })
      if (!brewResult.success) {
        warnings.push('Homebrew not installed')
        recommendations.push('Install Homebrew for easier package management')
      }

    } catch (error) {
      warnings.push('Could not perform complete macOS compatibility check')
    }
  }

  /**
   * Linux-specific compatibility checks
   */
  private static async checkLinuxCompatibility(
    issues: string[], 
    warnings: string[], 
    recommendations: string[]
  ): Promise<void> {
    try {
      // Check distribution
      const osReleaseResult = await this.executeCommand('cat', ['/etc/os-release'], { timeout: 5000 })
      if (osReleaseResult.success) {
        const osRelease = osReleaseResult.stdout
        if (osRelease.includes('Ubuntu') || osRelease.includes('Debian')) {
          // Check for essential packages
          const packages = ['curl', 'wget', 'build-essential']
          for (const pkg of packages) {
            const result = await this.executeCommand('dpkg', ['-l', pkg], { timeout: 3000 })
            if (!result.success) {
              warnings.push(`Package ${pkg} not installed`)
              recommendations.push(`Install with: sudo apt install ${pkg}`)
            }
          }
        } else if (osRelease.includes('CentOS') || osRelease.includes('Red Hat') || osRelease.includes('Fedora')) {
          // Check for essential packages
          const packages = ['curl', 'wget', 'gcc']
          for (const pkg of packages) {
            const result = await this.executeCommand('rpm', ['-q', pkg], { timeout: 3000 })
            if (!result.success) {
              warnings.push(`Package ${pkg} not installed`)
              recommendations.push(`Install with: sudo yum install ${pkg} or sudo dnf install ${pkg}`)
            }
          }
        }
      }

      // Check systemd
      const systemdResult = await this.executeCommand('systemctl', ['--version'], { timeout: 5000 })
      if (!systemdResult.success) {
        warnings.push('systemd not available')
        recommendations.push('Some service management features may not work')
      }

    } catch (error) {
      warnings.push('Could not perform complete Linux compatibility check')
    }
  }

  /**
   * Check if ports are available
   */
  private static async checkPortAvailability(
    ports: number[], 
    warnings: string[], 
    recommendations: string[]
  ): Promise<void> {
    const info = this.getPlatformInfo()
    
    for (const port of ports) {
      try {
        let command: string
        let args: string[]
        
        if (info.isWindows) {
          command = 'netstat'
          args = ['-an']
        } else {
          command = 'lsof'
          args = ['-i', `:${port}`]
        }
        
        const result = await this.executeCommand(command, args, { timeout: 5000 })
        
        if (info.isWindows) {
          if (result.stdout.includes(`:${port} `)) {
            warnings.push(`Port ${port} appears to be in use`)
            recommendations.push(`Stop the service using port ${port} or use a different port`)
          }
        } else {
          if (result.success && result.stdout.trim()) {
            warnings.push(`Port ${port} appears to be in use`)
            recommendations.push(`Stop the service using port ${port} or use a different port`)
          }
        }
      } catch (error) {
        // Ignore errors in port checking
      }
    }
  }
}

/**
 * Format platform information for CLI display
 */
export function formatPlatformInfo(): string {
  const info = PlatformCompatibility.getPlatformInfo()
  const paths = PlatformCompatibility.getPlatformPaths()
  const config = PlatformCompatibility.getPlatformConfig()
  
  const lines = [
    '🖥️  Platform Information',
    '=====================',
    '',
    '💻 System:',
    `   Platform: ${info.platform} (${info.isWindows ? 'Windows' : info.isMacOS ? 'macOS' : 'Linux'})`,
    `   Architecture: ${info.architecture}`,
    `   Release: ${info.release}`,
    `   Node.js: ${process.version}`,
    '',
    '🐚 Environment:',
    `   Shell: ${info.shell}`,
    `   Home: ${info.homeDir}`,
    `   Temp: ${info.tempDir}`,
    '',
    '📁 Paths:',
    `   Config: ${paths.configDir}`,
    `   Cache: ${paths.cacheDir}`,
    `   Logs: ${paths.logDir}`,
    ...(paths.binDir ? [`   Bin: ${paths.binDir}`] : []),
    '',
    '⚙️  Configuration:',
    `   Line Ending: ${config.lineEnding === '\r\n' ? 'CRLF' : 'LF'}`,
    `   Max Path: ${config.maxPathLength} chars`,
    `   Case Sensitive: ${config.caseSensitive ? 'Yes' : 'No'}`,
    `   Shell Extension: ${config.shellExtension}`
  ]
  
  return lines.join('\n')
} 