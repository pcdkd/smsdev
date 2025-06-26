import chalk from 'chalk'

export async function showStatus(): Promise<void> {
  console.log(chalk.blue('📊 sms-dev Status'))
  console.log('')
  
  // Check API server
  try {
    const apiResponse = await fetch('http://localhost:4001/health')
    if (apiResponse.ok) {
      console.log(chalk.green('✅ API Server:'), 'Running on port 4001')
    } else {
      console.log(chalk.red('❌ API Server:'), 'Not responding')
    }
  } catch (error) {
    console.log(chalk.red('❌ API Server:'), 'Not running')
  }
  
  // Check UI server
  try {
    const uiResponse = await fetch('http://localhost:4000')
    if (uiResponse.ok) {
      console.log(chalk.green('✅ UI Server:'), 'Running on port 4000')
    } else {
      console.log(chalk.red('❌ UI Server:'), 'Not responding')
    }
  } catch (error) {
    console.log(chalk.red('❌ UI Server:'), 'Not running')
  }
  
  console.log('')
  console.log(chalk.gray('Use'), chalk.cyan('sms-dev start'), chalk.gray('to start the servers'))
} 