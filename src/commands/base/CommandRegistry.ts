import { Command } from 'commander'
import { BaseCommand, CommandOptions } from './BaseCommand.js'
import chalk from 'chalk'

/**
 * Interface for command registration information
 */
export interface CommandRegistration {
  command: BaseCommand
  aliases?: string[]
  options?: CommandOption[]
  arguments?: CommandArgument[]
}

/**
 * Interface for command options
 */
export interface CommandOption {
  flags: string
  description: string
  defaultValue?: any
}

/**
 * Interface for command arguments
 */
export interface CommandArgument {
  name: string
  description: string
  required?: boolean
}

/**
 * Registry for managing and registering CLI commands
 */
export class CommandRegistry {
  private commands = new Map<string, CommandRegistration>()
  private program: Command
  
  constructor(program: Command) {
    this.program = program
  }
  
  /**
   * Register a command with the CLI program
   */
  register(registration: CommandRegistration): void {
    const { command, aliases = [], options = [], arguments: args = [] } = registration
    
    // Create the commander command
    const cmd = this.program
      .command(command.name)
      .description(command.description)
    
    // Add aliases
    if (aliases.length > 0) {
      cmd.aliases(aliases)
    }
    
    // Add arguments
    args.forEach(arg => {
      if (arg.required) {
        cmd.requiredOption(`<${arg.name}>`, arg.description)
      } else {
        cmd.argument(`[${arg.name}]`, arg.description)
      }
    })
    
    // Add options
    options.forEach(option => {
      if (option.defaultValue !== undefined) {
        cmd.option(option.flags, option.description, option.defaultValue)
      } else {
        cmd.option(option.flags, option.description)
      }
    })
    
    // Add common options that all commands support
    cmd.option('-v, --verbose', 'Enable verbose logging', false)
    cmd.option('--api-url <url>', 'API base URL', 'http://localhost:4001')
    
    // Set the action handler
    cmd.action(async (...args) => {
      // The last argument is always the options object
      const options = args[args.length - 1] as CommandOptions
      
      // Add any positional arguments to options
      args.slice(0, -1).forEach((arg, index) => {
        const registration = this.commands.get(command.name)
        if (registration?.arguments && index < registration.arguments.length) {
          const argName = registration.arguments[index]?.name
          if (argName) {
            options[argName] = arg
          }
        }
      })
      
      try {
        // Initialize the command with options
        command.initialize(options)
        
        // Execute the command
        await command.execute(options)
      } catch (error) {
        command['handleError'](error, command.name)
      }
    })
    
    // Store the registration
    this.commands.set(command.name, registration)
  }
  
  /**
   * Register multiple commands at once
   */
  registerAll(registrations: CommandRegistration[]): void {
    registrations.forEach(registration => this.register(registration))
  }
  
  /**
   * Get a registered command by name
   */
  getCommand(name: string): CommandRegistration | undefined {
    return this.commands.get(name)
  }
  
  /**
   * Get all registered command names
   */
  getCommandNames(): string[] {
    return Array.from(this.commands.keys())
  }
  
  /**
   * Check if a command is registered
   */
  hasCommand(name: string): boolean {
    return this.commands.has(name)
  }
  
  /**
   * Show help for all commands
   */
  showHelp(): void {
    console.log(chalk.blue('📋 Available Commands:'))
    console.log()
    
    for (const [name, registration] of this.commands) {
      console.log(chalk.green(`  ${name}`))
      console.log(chalk.gray(`    ${registration.command.description}`))
      
      if (registration.aliases && registration.aliases.length > 0) {
        console.log(chalk.gray(`    Aliases: ${registration.aliases.join(', ')}`))
      }
      
      console.log()
    }
    
    console.log(chalk.yellow('Use --help with any command for detailed options'))
  }
}